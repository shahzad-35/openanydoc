// Reading a Word file (.docx, .dotx, .docm) or an OpenDocument text (.odt) beyond what the renderers show: headings, comments,
// tracked changes, properties, macros and images; the CSP-safe insertion of an HTML string; and the exports (text, Markdown, HTML,
// images). mammoth (BSD-2) and odf-kit (Apache-2.0) are imported only when needed.
import JSZip from 'jszip'
import { defaultOptions, renderAsync } from 'docx-preview'
import type { HElement, Options as DocxPreviewOptions } from 'docx-preview'

export type WordComment = { id: string; author: string; date: string; text: string }
export type WordChange = { kind: 'inserted' | 'deleted'; author: string; date: string; text: string }
export type WordProperties = { title: string; author: string; lastModifiedBy: string; created: string; modified: string; application: string }
export type WordDocumentFacts = {
  // Paragraph style class (as docx-preview names it, `docx_<style id>`) → heading level 1–9.
  headingLevelByClass: Map<string, number>
  comments: WordComment[]
  changes: WordChange[]
  properties: WordProperties
  hasMacros: boolean
  imagePaths: string[]
}
export type ExportKind = 'text' | 'markdown' | 'html' | 'images'

const NO_PROPERTIES: WordProperties = { title: '', author: '', lastModifiedBy: '', created: '', modified: '', application: '' }

export const isOpenDocumentFile = (fileName: string) => /\.odt$/i.test(fileName)

// Stands in for a page-number field's saved text until the pages exist (a private-use character, never in real text).
export const FIELD_MARK = ''
// A PAGE or NUMPAGES field, complex (instrText, then the saved number after "separate") or simple (fldSimple), up to its number.
const COMPLEX_PAGE_FIELD = /(<w:instrText[^>]*>\s*(PAGE|NUMPAGES)\b[^<]*<\/w:instrText>(?:(?!fldCharType="end")[\s\S])*?fldCharType="separate"(?:(?!fldCharType="end")[\s\S])*?<w:t(?:\s[^>]*)?>)[^<]*/g
const SIMPLE_PAGE_FIELD = /(<w:fldSimple\s[^>]*w:instr="\s*(PAGE|NUMPAGES)\b[^"]*"[^>]*>(?:(?!<\/w:fldSimple>)[\s\S])*?<w:t(?:\s[^>]*)?>)[^<]*/g

const parseXml = (xmlText: string) => new DOMParser().parseFromString(xmlText, 'application/xml')
const attributeOf = (element: Element | null | undefined, name: string) => element?.getAttribute(name) ?? ''
const firstText = (xmlDocument: Document, tagName: string) => xmlDocument.getElementsByTagName(tagName)[0]?.textContent?.trim() ?? ''

// Style id → outline level, following w:basedOn; the built-in names ("heading 1", "Title") count when no level is set.
function readHeadingLevels(stylesXml: string) {
  const styles = new Map<string, { basedOn: string; outlineLevel: number | null; name: string }>()
  for (const style of Array.from(parseXml(stylesXml).getElementsByTagName('w:style'))) {
    if (attributeOf(style, 'w:type') !== 'paragraph') continue
    const outlineValue = attributeOf(style.getElementsByTagName('w:outlineLvl')[0], 'w:val')
    styles.set(attributeOf(style, 'w:styleId'), {
      basedOn: attributeOf(style.getElementsByTagName('w:basedOn')[0], 'w:val'),
      outlineLevel: outlineValue === '' ? null : Number(outlineValue),
      name: attributeOf(style.getElementsByTagName('w:name')[0], 'w:val').toLowerCase(),
    })
  }
  const headingLevelByClass = new Map<string, number>()
  for (const styleId of styles.keys()) {
    let level: number | null = null
    // Walk up the basedOn chain (bounded, in case a file loops).
    for (let currentId = styleId, step = 0; currentId && step < 10 && level === null; step++) {
      const style = styles.get(currentId)
      if (!style) break
      const builtInLevel = style.name === 'title' ? 0 : /^heading ([1-9])$/.exec(style.name)?.[1]
      level = style.outlineLevel ?? (builtInLevel === undefined ? null : Number(builtInLevel) - (style.name === 'title' ? 0 : 1))
      currentId = style.basedOn
    }
    // Outline level 9 is body text.
    if (level !== null && level >= 0 && level <= 8) headingLevelByClass.set(`docx_${styleId.replace(/[ .]+/g, '-').replace(/[&]+/g, 'and').toLowerCase()}`, level + 1)
  }
  return headingLevelByClass
}

function readComments(commentsXml: string): WordComment[] {
  return Array.from(parseXml(commentsXml).getElementsByTagName('w:comment'), (comment) => ({
    id: attributeOf(comment, 'w:id'),
    author: attributeOf(comment, 'w:author'),
    date: attributeOf(comment, 'w:date'),
    text: Array.from(comment.getElementsByTagName('w:p'), (paragraph) => Array.from(paragraph.getElementsByTagName('w:t'), (textElement) => textElement.textContent).join('')).join('\n'),
  }))
}

// The insertions and deletions that hold text, in document order (a w:ins inside w:rPr only marks a paragraph mark).
function readChanges(documentXml: Document): WordChange[] {
  const changes: WordChange[] = []
  for (const element of Array.from(documentXml.getElementsByTagName('*'))) {
    if (element.tagName !== 'w:ins' && element.tagName !== 'w:del') continue
    if (element.parentElement?.tagName === 'w:rPr' || element.getElementsByTagName('w:r').length === 0) continue
    const isInserted = element.tagName === 'w:ins'
    changes.push({
      kind: isInserted ? 'inserted' : 'deleted',
      author: attributeOf(element, 'w:author'),
      date: attributeOf(element, 'w:date'),
      text: Array.from(element.getElementsByTagName(isInserted ? 'w:t' : 'w:delText'), (textElement) => textElement.textContent).join(''),
    })
  }
  return changes
}

async function readProperties(documentZip: JSZip, corePath: string, appPath: string | null): Promise<WordProperties> {
  const coreText = await documentZip.file(corePath)?.async('string')
  if (!coreText) return NO_PROPERTIES
  const core = parseXml(coreText)
  const appText = appPath ? await documentZip.file(appPath)?.async('string') : undefined
  return {
    title: firstText(core, 'dc:title'),
    author: firstText(core, 'dc:creator') || firstText(core, 'meta:initial-creator'),
    lastModifiedBy: firstText(core, 'cp:lastModifiedBy'),
    created: firstText(core, 'dcterms:created') || firstText(core, 'meta:creation-date'),
    modified: firstText(core, 'dcterms:modified') || firstText(core, 'dc:date'),
    application: (appText ? firstText(parseXml(appText), 'Application') : '') || firstText(core, 'meta:generator'),
  }
}

// docx-preview misses two things that matter here, so the file is read once before rendering:
// - w:bidiVisual (a right-to-left table) is ignored, so an Arabic table's columns would run left to right; the tables are
//   listed in document order to mark the rendered ones afterwards.
// - fields are not computed, so every page would show the page number Word saved; the numbers in headers and footers are
//   swapped for marks that each rendered page fills in.
// The same pass reads the headings, comments, tracked changes, properties, macros and images.
export async function prepareWordDocument(fileContents: ArrayBuffer) {
  const documentZip = await JSZip.loadAsync(fileContents)
  const documentXml = (await documentZip.file('word/document.xml')?.async('string')) ?? ''
  const isTableRightToLeft = documentXml
    .split(/<w:tbl[\s>]/)
    .slice(1)
    .map((tableXml) => /<w:bidiVisual(\s+w:val="(1|true|on)")?\s*\/>/.test(tableXml.split('</w:tblPr>')[0]))
  for (const partName of Object.keys(documentZip.files).filter((name) => /^word\/(header|footer)\d*\.xml$/.test(name))) {
    const partXml = await documentZip.file(partName)!.async('string')
    const markedXml = partXml
      .replace(COMPLEX_PAGE_FIELD, (_, fieldStart: string, fieldName: string) => `${fieldStart}${FIELD_MARK}${fieldName}${FIELD_MARK}`)
      .replace(SIMPLE_PAGE_FIELD, (_, fieldStart: string, fieldName: string) => `${fieldStart}${FIELD_MARK}${fieldName}${FIELD_MARK}`)
    documentZip.file(partName, markedXml)
  }
  const stylesXml = await documentZip.file('word/styles.xml')?.async('string')
  const commentsXml = await documentZip.file('word/comments.xml')?.async('string')
  const facts: WordDocumentFacts = {
    headingLevelByClass: stylesXml ? readHeadingLevels(stylesXml) : new Map(),
    comments: commentsXml ? readComments(commentsXml) : [],
    changes: documentXml ? readChanges(parseXml(documentXml)) : [],
    properties: await readProperties(documentZip, 'docProps/core.xml', 'docProps/app.xml'),
    // Macros are only detected; nothing here ever runs them.
    hasMacros: Object.keys(documentZip.files).some((name) => /vbaProject\.bin$/i.test(name)),
    imagePaths: Object.keys(documentZip.files).filter((name) => /^word\/media\/[^/]+$/.test(name)),
  }
  return { documentBytes: await documentZip.generateAsync({ type: 'arraybuffer' }), isTableRightToLeft, facts }
}

// An OpenDocument text as an HTML string (odf-kit), with the same facts (no comments margin: odf-kit gives the text only).
export async function prepareOpenDocument(fileContents: ArrayBuffer) {
  const [{ odtToHtml }, documentZip] = await Promise.all([import('odf-kit/odt-reader'), JSZip.loadAsync(fileContents)])
  const html = odtToHtml(new Uint8Array(fileContents), { fragment: true })
  const facts: WordDocumentFacts = {
    headingLevelByClass: new Map(),
    comments: [],
    changes: [],
    properties: await readProperties(documentZip, 'meta.xml', null),
    hasMacros: Object.keys(documentZip.files).some((name) => /^Basic\/.+\.xml$/i.test(name) && !/script-lc\.xml$/i.test(name)),
    imagePaths: Object.keys(documentZip.files).filter((name) => /^Pictures\/[^/]+$/.test(name)),
  }
  return { html, facts }
}

// Parses an HTML string made from the file. The file is not trusted: scripts, frames, event attributes and addresses of any
// scheme but web, mail, phone, data: pictures and blob: are dropped. Inline styles are renamed before parsing (a style attribute is
// refused by the CSP even in a DOMParser document) to data-inline-style. Every block reads its own direction. With
// `hasOnlyDataPictures` (HTML a visitor pasted), every picture or media not written into the text itself is dropped before the
// document is imported, so nothing is requested.
function parseUntrustedDocumentHtml(html: string, hasOnlyDataPictures: boolean) {
  // Attribute values are escaped in the HTML (a quote inside is &quot;), so ' style="' only ever starts an attribute.
  const parsed = new DOMParser().parseFromString(html.replace(/(<[^>]*?\s)style="/g, '$1data-inline-style="'), 'text/html')
  parsed.querySelectorAll('script, iframe, object, embed, link, meta, style, base, form, animate, set, animateMotion, animateTransform').forEach((element) => element.remove())
  if (hasOnlyDataPictures) {
    parsed.querySelectorAll('video, audio, source, track, image, use').forEach((element) => element.remove())
    parsed.querySelectorAll('img').forEach((image) => !/^\s*data:image\//i.test(image.getAttribute('src') ?? '') && image.remove())
    parsed.querySelectorAll('[srcset]').forEach((element) => element.removeAttribute('srcset'))
    parsed.querySelectorAll('[data-inline-style*="url("]').forEach((element) => element.removeAttribute('data-inline-style'))
  }
  for (const element of Array.from(parsed.body.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) element.removeAttribute(attribute.name)
      const hasUnsafeScheme = /^\s*[a-z][a-z\d+.-]*:/i.test(attribute.value) && !/^\s*(https?:|mailto:|tel:|blob:|data:image\/)/i.test(attribute.value)
      if ((name === 'href' || name === 'src' || name === 'xlink:href') && hasUnsafeScheme) element.removeAttribute(attribute.name)
    }
    if (/^(P|LI|H[1-6]|TD|TH|BLOCKQUOTE)$/.test(element.tagName)) element.setAttribute('dir', 'auto')
  }
  return parsed
}

// Puts an HTML string made from the file into the page: cleaned, links open in a new tab, headings get data-heading-level, and
// inline styles are set through CSSOM.
export function insertDocumentHtml(container: HTMLElement, html: string, hasOnlyDataPictures = false) {
  const parsed = parseUntrustedDocumentHtml(html, hasOnlyDataPictures)
  for (const element of Array.from(parsed.body.querySelectorAll('*'))) {
    if (element instanceof HTMLAnchorElement) {
      element.target = '_blank'
      element.rel = 'noopener noreferrer'
    }
    if (/^H[1-6]$/.test(element.tagName)) element.setAttribute('data-heading-level', element.tagName[1])
  }
  container.replaceChildren(...Array.from(document.importNode(parsed.body, true).childNodes))
  for (const element of Array.from(container.querySelectorAll<HTMLElement>('[data-inline-style]'))) {
    element.style.cssText = element.dataset.inlineStyle ?? ''
    element.removeAttribute('data-inline-style')
  }
}

const withoutInlineStyles = (html: string) => html.replace(/(<[^>]*?\s)style="[^"]*"/g, '$1')

// The reading view's HTML: mammoth for Word files (images inlined as data: addresses), odf-kit's for .odt.
export async function readFlowingHtml(fileName: string, fileContents: ArrayBuffer) {
  if (isOpenDocumentFile(fileName)) return (await prepareOpenDocument(fileContents)).html
  const mammoth = await import('mammoth')
  return (await mammoth.convertToHtml({ arrayBuffer: fileContents })).value
}

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

function blockTextsOfHtml(html: string) {
  const parsed = new DOMParser().parseFromString(withoutInlineStyles(html), 'text/html')
  return Array.from(parsed.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th'), (block) => block.textContent?.trim() ?? '').filter(Boolean)
}

export async function exportDocument(kind: ExportKind, fileName: string, fileContents: ArrayBuffer, facts: WordDocumentFacts): Promise<{ name: string; blob: Blob }> {
  const isOpenDocument = isOpenDocumentFile(fileName)
  if (kind === 'images') {
    const documentZip = await JSZip.loadAsync(fileContents)
    const imagesZip = new JSZip()
    for (const imagePath of facts.imagePaths) imagesZip.file(imagePath.split('/').pop()!, await documentZip.file(imagePath)!.async('uint8array'))
    return { name: `${baseName(fileName)}-images.zip`, blob: await imagesZip.generateAsync({ type: 'blob' }) }
  }
  if (kind === 'text') {
    const text = isOpenDocument
      ? blockTextsOfHtml((await prepareOpenDocument(fileContents)).html).join('\n\n')
      : (await (await import('mammoth')).extractRawText({ arrayBuffer: fileContents })).value
    return { name: `${baseName(fileName)}.txt`, blob: new Blob([text.replace(/\n{3,}/g, '\n\n').trim() + '\n'], { type: 'text/plain;charset=utf-8' }) }
  }
  if (kind === 'markdown') {
    // mammoth's Markdown writer is marked deprecated but kept in 1.13; .odt has no Markdown export (the menu says so).
    const mammoth = (await import('mammoth')) as unknown as { convertToMarkdown: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
    const markdown = (await mammoth.convertToMarkdown({ arrayBuffer: fileContents })).value
    return { name: `${baseName(fileName)}.md`, blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }) }
  }
  // The exported page is cleaned like the viewer's and has its own CSP, since it is opened outside this site.
  const bodyHtml = parseUntrustedDocumentHtml(await readFlowingHtml(fileName, fileContents), false).body.innerHTML.replace(/(<[^>]*?\s)data-inline-style="/g, '$1style="')
  const title = facts.properties.title || baseName(fileName)
  const escapedTitle = title.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`)
  const page = `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapedTitle}</title>\n<style>body{max-width:46rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`
  return { name: `${baseName(fileName)}.html`, blob: new Blob([page], { type: 'text/html;charset=utf-8' }) }
}

// ---------------------------------------------------------------- rendering Word pages (the Word viewer and Word to PDF)

// Documents name their fonts without carrying them, and a missing one (Calibri on a Mac) would fall back to the browser's
// serif font, and Arabic text to a decorative one with lines that collide. The site's Arabic font (loaded for Arabic letters
// only) and a generic family at the end keep the look close.
export function addGenericFontFamily(fontFamily: string) {
  if (/(^|,)\s*(sans-serif|serif|monospace)\s*$/i.test(fontFamily)) return fontFamily
  return `${fontFamily}, "IBM Plex Sans Arabic", ${/times|georgia|garamond|cambria|roman|serif/i.test(fontFamily) ? 'serif' : 'sans-serif'}`
}

// docx-preview builds every element through this function. Two changes on the way: a style given as a string (a few shapes)
// is set through CSSOM, because the site's CSP refuses style attributes; and font names get a generic fallback.
function createDocumentElement(element: HElement | Node | string): Node {
  if (typeof element !== 'object' || element instanceof Node || !element.style) return defaultOptions.h(element)
  const { style, ...elementWithoutStyle } = element
  const node = defaultOptions.h(elementWithoutStyle) as HTMLElement
  if (typeof style === 'string') node.style.cssText = style
  else Object.assign(node.style, style)
  if (node.style.fontFamily) node.style.fontFamily = addGenericFontFamily(node.style.fontFamily)
  return node
}

const renderOptions: Partial<DocxPreviewOptions> = {
  className: 'docx',
  inWrapper: true,
  hideWrapperOnPrint: true,
  breakPages: true,
  // Word saves where its pages ended; following those marks gives the same pages as Word.
  ignoreLastRenderedPageBreak: false,
  useBase64URL: false,
  // Comments come as a mark (its popover is hidden by CSS; the margin shows them) and tracked changes as <ins>/<del>.
  renderComments: true,
  renderChanges: true,
  // An altChunk is HTML from the file's author, which docx-preview shows in an unsandboxed frame of this site.
  renderAltChunks: false,
  h: createDocumentElement,
}

function finishRenderedPages(pagesElement: HTMLElement, isTableRightToLeft: boolean[]) {
  pagesElement.querySelectorAll<HTMLTableElement>('section.docx > article table').forEach((table, tableIndex) => {
    if (isTableRightToLeft[tableIndex]) table.dir = 'rtl'
  })
  const pages = pagesElement.querySelectorAll('section.docx')
  pages.forEach((page, pageIndex) => {
    const textWalker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT)
    for (let textNode = textWalker.nextNode(); textNode; textNode = textWalker.nextNode()) {
      if (!textNode.nodeValue?.includes(FIELD_MARK)) continue
      textNode.nodeValue = textNode.nodeValue.replaceAll(`${FIELD_MARK}PAGE${FIELD_MARK}`, String(pageIndex + 1)).replaceAll(`${FIELD_MARK}NUMPAGES${FIELD_MARK}`, String(pages.length))
    }
  })
}

// The document's CSS is built from the file: docx-preview pastes style names and values into it unescaped, so a crafted file can
// close a rule and add its own, such as one that hides the site's navigation. Each parsed rule is kept only inside
// @scope (:has(> .docx-wrapper)), the element holding the pages (scoped selectors match inside the root, and the document's own
// rules start at .docx-wrapper), so they cannot reach the rest of the page; a browser without @scope gets the rule as it is.
function documentCssSheet(cssText: string) {
  const parsedSheet = new CSSStyleSheet()
  parsedSheet.replaceSync(cssText)
  const scopedSheet = new CSSStyleSheet()
  for (const rule of Array.from(parsedSheet.cssRules)) {
    try {
      scopedSheet.insertRule(rule instanceof CSSFontFaceRule ? rule.cssText : `@scope (:has(> .docx-wrapper)) { ${rule.cssText} }`, scopedSheet.cssRules.length)
    } catch {
      scopedSheet.insertRule(rule.cssText, scopedSheet.cssRules.length)
    }
  }
  return scopedSheet
}

// Renders a Word file as pages into `pagesHolder` with docx-preview. The document's CSS comes out as <style> elements, which the
// CSP blocks; they stay in `detachedStyleHolder` (unattached) and their text is adopted as constructed stylesheets, returned so
// the caller can drop them with the pages.
export async function renderWordPages(fileContents: ArrayBuffer, pagesHolder: HTMLElement, detachedStyleHolder: HTMLElement) {
  const { documentBytes, isTableRightToLeft, facts } = await prepareWordDocument(fileContents)
  await renderAsync(documentBytes, pagesHolder, detachedStyleHolder, renderOptions)
  const adoptedSheets = Array.from(detachedStyleHolder.querySelectorAll('style'), (styleElement) =>
    documentCssSheet((styleElement.textContent ?? '').replace(/font-family:\s*([^;}]+)/g, (_, fontFamily: string) => `font-family: ${addGenericFontFamily(fontFamily.trim())}`)),
  )
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...adoptedSheets]
  // The renderer writes the file's links itself: they open in a new tab (the page keeps its edits), and only web and mail
  // addresses stay; in-document links (#bookmark) work as before.
  for (const link of Array.from(pagesHolder.querySelectorAll('a[href]'))) {
    const address = link.getAttribute('href') ?? ''
    if (address.startsWith('#')) continue
    if (!/^\s*(https?:|mailto:)/i.test(address)) link.removeAttribute('href')
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }
  finishRenderedPages(pagesHolder, isTableRightToLeft)
  return { facts, adoptedSheets }
}
