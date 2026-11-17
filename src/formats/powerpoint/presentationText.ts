// Reads a presentation's words straight from the file (the renderer has no speaker notes and parses slides lazily): each slide's
// title, its other text in order, and its speaker notes; and whether it carries macros (detected only, never run). Also writes
// the outline exports.
import JSZip from 'jszip'

export type SlideText = { title: string; paragraphs: string[]; notes: string }
export type PresentationText = { slides: SlideText[]; hasMacros: boolean }

const TITLE_PLACEHOLDERS = new Set(['title', 'ctrTitle'])
// Placeholders on a notes page that are not the notes: the slide picture, its number, the date, header and footer.
const NOT_NOTES_PLACEHOLDERS = new Set(['sldImg', 'sldNum', 'dt', 'hdr', 'ftr'])

const parseXml = (xmlText: string) => new DOMParser().parseFromString(xmlText, 'application/xml')

// A relationship target is relative to the part's folder ("slides/slide1.xml" from ppt/, "../notesSlides/n1.xml" from ppt/slides/).
function resolvePartPath(partFolder: string, target: string) {
  const segments = (target.startsWith('/') ? target.slice(1) : `${partFolder}/${target}`).split('/')
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '..') resolved.pop()
    else if (segment !== '.' && segment !== '') resolved.push(segment)
  }
  return resolved.join('/')
}

async function readRelationshipTargets(zip: JSZip, relsPath: string, partFolder: string) {
  const relsText = await zip.file(relsPath)?.async('string')
  const targetsById = new Map<string, { type: string; path: string }>()
  if (!relsText) return targetsById
  for (const relationship of Array.from(parseXml(relsText).getElementsByTagName('Relationship'))) {
    if (relationship.getAttribute('TargetMode') === 'External') continue
    targetsById.set(relationship.getAttribute('Id') ?? '', { type: relationship.getAttribute('Type') ?? '', path: resolvePartPath(partFolder, relationship.getAttribute('Target') ?? '') })
  }
  return targetsById
}

const paragraphTexts = (textBody: Element) =>
  Array.from(textBody.getElementsByTagName('a:p'), (paragraph) => Array.from(paragraph.getElementsByTagName('a:t'), (text) => text.textContent ?? '').join('').trim()).filter(Boolean)

const placeholderTypeOf = (shape: Element) => {
  const placeholder = shape.getElementsByTagName('p:ph')[0]
  return placeholder ? (placeholder.getAttribute('type') ?? 'body') : null
}

// Shapes and table cells in document order; a group's shapes are reached through the same walk.
function readSlideXml(slideXml: string) {
  const slide = parseXml(slideXml)
  let title = ''
  const paragraphs: string[] = []
  for (const element of Array.from(slide.getElementsByTagName('*'))) {
    if (element.tagName === 'p:sp') {
      const textBody = element.getElementsByTagName('p:txBody')[0]
      if (!textBody) continue
      const texts = paragraphTexts(textBody)
      if (TITLE_PLACEHOLDERS.has(placeholderTypeOf(element) ?? '') && !title) title = texts.join(' ')
      else paragraphs.push(...texts)
    } else if (element.tagName === 'a:tc') {
      const cellText = paragraphTexts(element).join(' ')
      if (cellText) paragraphs.push(cellText)
    }
  }
  return { title, paragraphs }
}

function readNotesXml(notesXml: string) {
  const notes = parseXml(notesXml)
  return Array.from(notes.getElementsByTagName('p:sp'))
    .filter((shape) => !NOT_NOTES_PLACEHOLDERS.has(placeholderTypeOf(shape) ?? ''))
    .flatMap((shape) => {
      const textBody = shape.getElementsByTagName('p:txBody')[0]
      return textBody ? paragraphTexts(textBody) : []
    })
    .join('\n')
}

export async function readPresentationText(fileContents: ArrayBuffer): Promise<PresentationText> {
  const zip = await JSZip.loadAsync(fileContents)
  const hasMacros = Object.keys(zip.files).some((name) => /vbaProject\.bin$/i.test(name))
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string')
  if (!presentationXml) return { slides: [], hasMacros }
  const presentationTargets = await readRelationshipTargets(zip, 'ppt/_rels/presentation.xml.rels', 'ppt')
  const slideIds = Array.from(parseXml(presentationXml).getElementsByTagName('p:sldId'), (slideId) => slideId.getAttribute('r:id') ?? '')
  const slides: SlideText[] = []
  for (const slideId of slideIds) {
    const slidePath = presentationTargets.get(slideId)?.path
    const slideXml = slidePath ? await zip.file(slidePath)?.async('string') : undefined
    if (!slidePath || !slideXml) {
      slides.push({ title: '', paragraphs: [], notes: '' })
      continue
    }
    const slideFolder = slidePath.slice(0, slidePath.lastIndexOf('/'))
    const slideFileName = slidePath.slice(slidePath.lastIndexOf('/') + 1)
    const slideTargets = await readRelationshipTargets(zip, `${slideFolder}/_rels/${slideFileName}.rels`, slideFolder)
    const notesPath = [...slideTargets.values()].find((target) => target.type.endsWith('/notesSlide'))?.path
    const notesXml = notesPath ? await zip.file(notesPath)?.async('string') : undefined
    slides.push({ ...readSlideXml(slideXml), notes: notesXml ? readNotesXml(notesXml) : '' })
  }
  return { slides, hasMacros }
}

type OutlineLabels = { slide: string; notes: string }

export function outlineAsMarkdown(slides: SlideText[], deckName: string, labels: OutlineLabels) {
  const escape = (text: string) => text.replace(/([\\`*_[\]#<>|])/g, '\\$1')
  const sections = slides.map((slide, position) => {
    const lines = [`## ${labels.slide} ${position + 1}${slide.title ? `: ${escape(slide.title)}` : ''}`, '']
    if (slide.paragraphs.length) lines.push(...slide.paragraphs.map((paragraph) => `- ${escape(paragraph)}`), '')
    if (slide.notes) lines.push(`> **${labels.notes}:**`, ...slide.notes.split('\n').map((line) => `> ${escape(line)}`), '')
    return lines.join('\n')
  })
  return `# ${escape(deckName)}\n\n${sections.join('\n')}`
}

export function outlineAsText(slides: SlideText[], deckName: string, labels: OutlineLabels) {
  const sections = slides.map((slide, position) => {
    const lines = [`${labels.slide} ${position + 1}${slide.title ? `: ${slide.title}` : ''}`]
    lines.push(...slide.paragraphs.map((paragraph) => `  ${paragraph}`))
    if (slide.notes) lines.push(`  ${labels.notes}:`, ...slide.notes.split('\n').map((line) => `    ${line}`))
    return lines.join('\n')
  })
  return `${deckName}\n\n${sections.join('\n\n')}\n`
}
