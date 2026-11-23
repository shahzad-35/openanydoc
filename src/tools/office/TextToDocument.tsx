/* oxlint-disable react/only-export-components */
// Markdown, HTML and text to Word and to PDF. The text (typed, pasted or read from a file) becomes a document element: Markdown
// through marked (MIT, loaded only here), HTML cleaned as a Word file's HTML is (insertDocumentHtml: no scripts, frames, event
// attributes or unsafe addresses) with every picture not written into the text itself left out, so nothing is ever requested.
// That element is written as a .docx (docx, MIT) or laid out on pages as a PDF with selectable text (OfficeToPdf.tsx).
import { useEffect, useState } from 'react'
import type { FileChild, IParagraphOptions, ParagraphChild } from 'docx'
import { translate, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice, useToast } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { PageSizeSelect, flowingPagePictures, picturesToPdfFile } from '../pdf/OfficeToPdf'
import type { PageSizeName } from '../pdf/OfficeToPdf'
import { ProgressBar, baseNameOf } from '../pdf/PdfToolParts'
import './textDocument.css'

type SourceFormat = 'markdown' | 'html' | 'text'
type DocumentOutput = 'word' | 'pdf'
type RunFormat = { isBold?: boolean; isItalic?: boolean; isUnderlined?: boolean; isStruck?: boolean; isCode?: boolean; isLink?: boolean }

const MAX_TEXT_BYTES = 10 * 1024 * 1024
const WORD_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const RIGHT_TO_LEFT_FIRST_LETTER = /^[^A-Za-z֐-ࣿ]*[֐-ࣿ]/
const CONTAINER_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'NAV', 'ASIDE', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD', 'ADDRESS', 'CENTER', 'DETAILS', 'SUMMARY', 'LI'])
const BLOCK_TAGS = new Set([...CONTAINER_TAGS, 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE', 'HR'])
const LARGEST_PICTURE_WIDTH_PX = 600
const QUOTE_INDENT_TWIPS = 720

const HINT_KEYS: Record<SourceFormat, MessageKey> = { markdown: 'tools.textDocument.markdownHint', html: 'tools.textDocument.htmlHint', text: 'tools.textDocument.textHint' }
const LABEL_KEYS: Record<SourceFormat, MessageKey> = { markdown: 'tools.textDocument.markdownLabel', html: 'tools.textDocument.htmlLabel', text: 'tools.textDocument.textLabel' }

// The text as a document element, cleaned and with its own direction per block.
async function makeDocumentElement(text: string, format: SourceFormat) {
  const documentElement = document.createElement('div')
  documentElement.className = 'text-document'
  if (format === 'text') {
    documentElement.classList.add('is-plain-text')
    for (const line of text.split(/\r?\n/)) {
      const paragraph = document.createElement('p')
      paragraph.dir = 'auto'
      paragraph.textContent = line
      documentElement.append(paragraph)
    }
    return documentElement
  }
  const { insertDocumentHtml } = await import('../../formats/word/wordDocument')
  const html = format === 'markdown' ? await (await import('marked')).marked.parse(text, { gfm: true }) : text
  insertDocumentHtml(documentElement, html, true)
  return documentElement
}

// A data: picture as PNG bytes and the size it is shown at (no wider than a page's text).
async function readPicture(image: HTMLImageElement) {
  const picture = new Image()
  picture.src = image.getAttribute('src') ?? ''
  await picture.decode()
  const canvas = document.createElement('canvas')
  canvas.width = picture.naturalWidth || 1
  canvas.height = picture.naturalHeight || 1
  canvas.getContext('2d')!.drawImage(picture, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The picture could not be read')
  const scale = Math.min(1, LARGEST_PICTURE_WIDTH_PX / canvas.width)
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: Math.round(canvas.width * scale), height: Math.round(canvas.height * scale) }
}

// The document element as a Word file: headings, paragraphs, bulleted and numbered lists (nested), tables with merged cells, code,
// quotes, links, bold, italic, underlined and struck text, and pictures. Right-to-left paragraphs are marked as such.
async function writeWordDocument(documentElement: HTMLElement) {
  const { AlignmentType, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx')
  const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
  let numberedListCount = 0
  // Plain text keeps its spaces (indents, columns lined up); HTML and Markdown collapse them as a browser does.
  const keepsSpaces = documentElement.classList.contains('is-plain-text')

  async function inlineRuns(node: Node, format: RunFormat, isRightToLeft: boolean): Promise<ParagraphChild[]> {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = keepsSpaces ? (node.nodeValue ?? '') : (node.nodeValue ?? '').replace(/\s+/g, ' ')
      if (text === '') return []
      return [new TextRun({ text, bold: format.isBold, italics: format.isItalic, underline: format.isUnderlined ? {} : undefined, strike: format.isStruck, font: format.isCode ? 'Courier New' : undefined, style: format.isLink ? 'Hyperlink' : undefined, rightToLeft: isRightToLeft })]
    }
    if (!(node instanceof HTMLElement)) return []
    const tag = node.tagName
    if (tag === 'BR') return [new TextRun({ break: 1 })]
    if (tag === 'IMG') {
      const picture = await readPicture(node as HTMLImageElement).catch(() => null)
      return picture ? [new ImageRun({ type: 'png', data: picture.bytes, transformation: { width: picture.width, height: picture.height } })] : []
    }
    const childFormat: RunFormat = {
      isBold: format.isBold || ['STRONG', 'B', 'TH'].includes(tag),
      isItalic: format.isItalic || ['EM', 'I', 'CITE'].includes(tag),
      isUnderlined: format.isUnderlined || tag === 'U',
      isStruck: format.isStruck || ['DEL', 'S', 'STRIKE'].includes(tag),
      isCode: format.isCode || ['CODE', 'KBD', 'SAMP'].includes(tag),
      isLink: format.isLink || tag === 'A',
    }
    const runs = (await Promise.all(Array.from(node.childNodes, (child) => inlineRuns(child, childFormat, isRightToLeft)))).flat()
    const address = node.getAttribute('href') ?? ''
    if (tag === 'A' && /^(https?:|mailto:)/i.test(address)) return [new ExternalHyperlink({ link: address, children: runs })]
    return runs
  }

  async function paragraph(nodes: Node[], options: IParagraphOptions, format: RunFormat = {}) {
    const isRightToLeft = RIGHT_TO_LEFT_FIRST_LETTER.test(nodes.map((node) => node.textContent ?? '').join('').trim())
    const runs = (await Promise.all(nodes.map((node) => inlineRuns(node, format, isRightToLeft)))).flat()
    return new Paragraph({ ...options, children: runs, bidirectional: isRightToLeft })
  }

  async function listBlocks(list: HTMLElement, level: number): Promise<FileChild[]> {
    const instance = list.tagName === 'OL' ? ++numberedListCount : 0
    const blocks: FileChild[] = []
    for (const item of Array.from(list.children).filter((child) => child.tagName === 'LI')) {
      // A loose list wraps each item's text in a paragraph; its words count as the item's own.
      const itemNodes = Array.from(item.childNodes).flatMap((child) => (child.nodeName === 'P' ? Array.from(child.childNodes) : child.nodeName === 'UL' || child.nodeName === 'OL' ? [] : [child]))
      blocks.push(await paragraph(itemNodes, instance ? { numbering: { reference: 'numbered-list', level, instance } } : { bullet: { level } }))
      for (const nestedList of Array.from(item.children).filter((child) => child.tagName === 'UL' || child.tagName === 'OL')) blocks.push(...(await listBlocks(nestedList as HTMLElement, Math.min(level + 1, 8))))
    }
    return blocks
  }

  async function tableBlock(table: HTMLTableElement) {
    const rows = []
    for (const row of Array.from(table.rows)) {
      if (row.cells.length === 0) continue
      const cells = []
      for (const cell of Array.from(row.cells)) cells.push(new TableCell({ children: [await paragraph(Array.from(cell.childNodes), {}, { isBold: cell.tagName === 'TH' })], columnSpan: cell.colSpan, rowSpan: cell.rowSpan }))
      rows.push(new TableRow({ children: cells }))
    }
    return rows.length > 0 ? [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })] : []
  }

  // The blocks of a container; inline content between blocks becomes a paragraph of its own.
  async function containerBlocks(container: Element, indentTwips: number): Promise<FileChild[]> {
    const blocks: FileChild[] = []
    let looseNodes: Node[] = []
    const indent = indentTwips > 0 ? { indent: { left: indentTwips } } : {}
    async function addLooseParagraph() {
      if (looseNodes.some((node) => (node.textContent ?? '').trim() !== '' || node.nodeName === 'IMG')) blocks.push(await paragraph(looseNodes, indent))
      looseNodes = []
    }
    for (const child of Array.from(container.childNodes)) {
      if (!(child instanceof HTMLElement) || !BLOCK_TAGS.has(child.tagName)) {
        looseNodes.push(child)
        continue
      }
      await addLooseParagraph()
      const tag = child.tagName
      if (/^H[1-6]$/.test(tag)) blocks.push(await paragraph(Array.from(child.childNodes), { ...indent, heading: headingLevels[Number(tag[1]) - 1] }))
      else if (tag === 'P') blocks.push(await paragraph(Array.from(child.childNodes), indent))
      else if (tag === 'UL' || tag === 'OL') blocks.push(...(await listBlocks(child, 0)))
      else if (tag === 'TABLE') blocks.push(...(await tableBlock(child as HTMLTableElement)))
      else if (tag === 'HR') blocks.push(new Paragraph({ thematicBreak: true, children: [] }))
      else if (tag === 'PRE') {
        for (const line of (child.textContent ?? '').replace(/\n$/, '').split('\n')) {
          blocks.push(new Paragraph({ ...indent, shading: { type: ShadingType.CLEAR, fill: 'F3F3F3' }, children: [new TextRun({ text: line, font: 'Courier New', size: 20 })] }))
        }
      } else if (tag === 'BLOCKQUOTE') blocks.push(...(await containerBlocks(child, indentTwips + QUOTE_INDENT_TWIPS)))
      else blocks.push(...(await containerBlocks(child, indentTwips)))
    }
    await addLooseParagraph()
    return blocks
  }

  const children = await containerBlocks(documentElement, 0)
  const numberingLevels = Array.from({ length: 9 }, (_, level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } }))
  const wordDocument = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: { config: [{ reference: 'numbered-list', levels: numberingLevels }] },
    sections: [{ children: children.length > 0 ? children : [new Paragraph({ children: [] })] }],
  })
  return Packer.toBlob(wordDocument)
}

function TextToDocument({ files, onResult, format, output }: ToolProps & { format: SourceFormat; output: DocumentOutput }) {
  const { locale, t } = useT()
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [baseName, setBaseName] = useState('document')
  const [pageSize, setPageSize] = useState<PageSizeName>('a4')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const toolId = `${format}-to-${output}`

  // A chosen file or a sample fills the text box.
  const chosenFile = files.at(-1)
  useEffect(() => {
    if (!chosenFile) return
    if (chosenFile.size > MAX_TEXT_BYTES) {
      showToast({ kind: 'error', message: translate(locale, 'markup.tooLarge') })
      return
    }
    void chosenFile.text().then((fileText) => {
      setText(fileText)
      setBaseName(baseNameOf(chosenFile.name))
    })
  }, [chosenFile, showToast, locale])

  async function convert() {
    setError('')
    setProgress({ done: 0, total: 0 })
    try {
      const documentElement = await makeDocumentElement(text, format)
      if (output === 'word') onResult(new File([await writeWordDocument(documentElement)], `${baseName}.docx`, { type: WORD_TYPE }))
      else {
        const pictures = await flowingPagePictures(documentElement, pageSize, (done, total) => setProgress({ done, total }))
        onResult(await picturesToPdfFile(pictures, `${baseName}.pdf`))
      }
    } catch {
      setError(t('tools.officePdf.failed'))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div id={`${toolId}-tool`} className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t(HINT_KEYS[format])}</p>
      <label className="block text-sm font-medium">
        {t(LABEL_KEYS[format])}
        <textarea
          id={`${toolId}-text-input`}
          dir="auto"
          rows={12}
          spellCheck={false}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="mt-1 w-full rounded-[14px] border-2 border-rule bg-paper-raised p-3 text-start font-mono text-sm pointer-coarse:text-base"
        />
      </label>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        {output === 'pdf' && <PageSizeSelect id={`${toolId}-page-size-select`} value={pageSize} onChange={setPageSize} />}
        <button id={`${toolId}-button`} type="button" disabled={text.trim() === '' || progress !== null} onClick={() => void convert()} className="btn btn--primary press">
          {progress ? t('tools.working') : t(output === 'pdf' ? 'tools.officePdf.button' : 'tools.textDocument.wordButton')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.pages', { done: progress.done, total: progress.total }) : t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
    </div>
  )
}

export const MarkdownToWord = (props: ToolProps) => <TextToDocument {...props} format="markdown" output="word" />
export const HtmlToWord = (props: ToolProps) => <TextToDocument {...props} format="html" output="word" />
export const TextToWord = (props: ToolProps) => <TextToDocument {...props} format="text" output="word" />
export const MarkdownToPdf = (props: ToolProps) => <TextToDocument {...props} format="markdown" output="pdf" />
export const HtmlToPdf = (props: ToolProps) => <TextToDocument {...props} format="html" output="pdf" />
export const TextToPdf = (props: ToolProps) => <TextToDocument {...props} format="text" output="pdf" />
