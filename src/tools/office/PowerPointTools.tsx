/* oxlint-disable react/only-export-components */
// The PowerPoint tools: merge, split, extract media, search text, metadata, remove macros and watermark. Each edits the
// presentation's XML parts (officePackage.ts) and leaves the rest of the file as it was.
import { useEffect, useMemo, useState } from 'react'
import type JSZip from 'jszip'
import { useT } from '../../i18n'
import type { ToolProps } from '../registry'
import { baseNameOf, parsePageRanges } from '../pdf/PdfToolParts'
import type { PresentationText } from '../../formats/powerpoint/presentationText'
import { OfficeMetadata, OfficeToolLayout, OfficeToolProblem, WatermarkFields, fieldClass, openOfficePackage, panelClass, useOfficeTask } from './OfficeToolParts'
import type { WatermarkColor, WatermarkLayout } from './OfficeToolParts'
import {
  POWERPOINT_TYPE,
  RELATIONSHIP_TYPE,
  addRelationship,
  copyPartTree,
  escapeXmlText,
  extractMediaFiles,
  filesToResult,
  packageToFile,
  parseXmlElements,
  readRelationships,
  readXmlPart,
  removePart,
  removeRelationships,
  removeUnreferencedMedia,
  resolveTarget,
  setContentType,
  writeXmlPart,
} from './officePackage'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
const PRESENTATION = 'ppt/presentation.xml'
const PRESENTATION_MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
const isPresentationFile = (file: File) => /\.(pptx|ppsx|potx|pptm|ppsm|potm)$/i.test(file.name)
const typeEnd = (type: string) => type.slice(type.lastIndexOf('/') + 1)
const UNUSED_PART_FOLDERS = ['ppt/charts/', 'ppt/diagrams/', 'ppt/embeddings/', 'ppt/media/']

async function openPresentation(file: File) {
  const zip = await openOfficePackage(file)
  if (!zip.file(PRESENTATION)) throw new OfficeToolProblem('office.notPowerPoint')
  return zip
}

// The slides in show order: each slide id element with the path of its part.
async function readSlideList(zip: JSZip, presentationXml: XMLDocument) {
  const relationships = await readRelationships(zip, PRESENTATION)
  return Array.from(presentationXml.getElementsByTagNameNS(P, 'sldId'), (slideId) => {
    const relationship = relationships.find((candidate) => candidate.id === slideId.getAttributeNS(R, 'id'))
    return { slideId, relationshipId: relationship?.id ?? '', path: relationship ? resolveTarget(PRESENTATION, relationship.target) : '' }
  })
}

async function removeUnusedParts(zip: JSZip) {
  // Charts first: their own relationships keep embedded workbooks in use until they go.
  for (const folder of UNUSED_PART_FOLDERS) await removeUnreferencedMedia(zip, folder)
}

// ---------------------------------------------------------------- Merge

async function readLayouts(zip: JSZip) {
  const paths = Object.keys(zip.files).filter((path) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path))
  return Promise.all(
    paths.map(async (path) => {
      const xml = (await readXmlPart(zip, path))!
      return { path, type: xml.documentElement.getAttribute('type') ?? '', name: xml.getElementsByTagNameNS(P, 'cSld')[0]?.getAttribute('name') ?? '' }
    }),
  )
}

async function findNotesMasterPath(zip: JSZip) {
  const relationship = (await readRelationships(zip, PRESENTATION)).find((candidate) => typeEnd(candidate.type) === 'notesMaster')
  return relationship ? resolveTarget(PRESENTATION, relationship.target) : null
}

// The target has no notes master, so later decks' speaker notes would have nothing to stand on: the source's is copied in,
// with its theme, and listed in the presentation.
async function addNotesMaster(source: JSZip, sourcePath: string, target: JSZip, presentationXml: XMLDocument) {
  const targetPath = await copyPartTree(source, sourcePath, target, () => undefined)
  const relationshipId = await addRelationship(target, PRESENTATION, `${RELATIONSHIP_TYPE}/notesMaster`, targetPath.replace(/^ppt\//, ''))
  const [notesMasterList] = parseXmlElements(presentationXml, `<p:notesMasterIdLst><p:notesMasterId r:id="${relationshipId}"/></p:notesMasterIdLst>`)
  presentationXml.getElementsByTagNameNS(P, 'sldMasterIdLst')[0].after(notesMasterList)
  return targetPath
}

async function mergePresentations(files: File[]) {
  const target = await openPresentation(files[0])
  const presentationXml = (await readXmlPart(target, PRESENTATION))!
  const targetLayouts = await readLayouts(target)
  if (targetLayouts.length === 0) throw new OfficeToolProblem('office.notPowerPoint')
  let notesMasterPath = await findNotesMasterPath(target)
  let slideIdList = presentationXml.getElementsByTagNameNS(P, 'sldIdLst')[0]
  if (!slideIdList) {
    slideIdList = presentationXml.createElementNS(P, 'p:sldIdLst')
    const after = presentationXml.getElementsByTagNameNS(P, 'handoutMasterIdLst')[0] ?? presentationXml.getElementsByTagNameNS(P, 'notesMasterIdLst')[0] ?? presentationXml.getElementsByTagNameNS(P, 'sldMasterIdLst')[0]
    after.after(slideIdList)
  }
  let nextSlideId = Math.max(255, ...Array.from(presentationXml.getElementsByTagNameNS(P, 'sldId'), (element) => Number(element.getAttribute('id')) || 0)) + 1
  const sectionSlideLists = presentationXml.getElementsByTagNameNS(P14, 'sldIdLst')
  const lastSectionList = sectionSlideLists[sectionSlideLists.length - 1]
  for (const file of files.slice(1)) {
    const source = await openPresentation(file)
    const sourceXml = (await readXmlPart(source, PRESENTATION))!
    const sourceNotesMasterPath = await findNotesMasterPath(source)
    if (!notesMasterPath && sourceNotesMasterPath) notesMasterPath = await addNotesMaster(source, sourceNotesMasterPath, target, presentationXml)
    const copied = new Map<string, string>()
    for (const { path } of await readSlideList(source, sourceXml)) {
      if (!path || !source.file(path)) continue
      const newPath = await copyPartTree(
        source,
        path,
        target,
        async (relationship, linkedPath) => {
          const kind = typeEnd(relationship.type)
          if (kind === 'slideLayout') {
            const sourceLayout = (await readXmlPart(source, linkedPath))!
            const [type, name] = [sourceLayout.documentElement.getAttribute('type') ?? '', sourceLayout.getElementsByTagNameNS(P, 'cSld')[0]?.getAttribute('name') ?? '']
            return (targetLayouts.find((layout) => type !== '' && layout.type === type) ?? targetLayouts.find((layout) => layout.name === name) ?? targetLayouts[0]).path
          }
          if (kind === 'notesMaster') return notesMasterPath ?? null
          if (kind === 'notesSlide' && !notesMasterPath) return null
          // Comments name their authors in a list of the source presentation, which is not merged.
          if (/comment/i.test(kind)) return null
          return undefined
        },
        copied,
      )
      const relationshipId = await addRelationship(target, PRESENTATION, `${RELATIONSHIP_TYPE}/slide`, newPath.replace(/^ppt\//, ''))
      const [slideId] = parseXmlElements(presentationXml, `<p:sldId id="${nextSlideId}" r:id="${relationshipId}"/>`)
      slideIdList.appendChild(slideId)
      if (lastSectionList) lastSectionList.appendChild(parseXmlElements(presentationXml, `<p14:sldId xmlns:p14="${P14}" id="${nextSlideId}"/>`)[0])
      nextSlideId++
    }
  }
  writeXmlPart(target, PRESENTATION, presentationXml)
  await setContentType(target, PRESENTATION, PRESENTATION_MAIN_TYPE)
  return packageToFile(target, `${baseNameOf(files[0].name)}-merged.pptx`, POWERPOINT_TYPE)
}

export function MergePptx({ files, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const presentationFiles = files.filter(isPresentationFile)
  return (
    <OfficeToolLayout toolId="merge-pptx" hintKey="office.mergePptx.hint" files={presentationFiles} task={task} buttonKey="office.mergePptx.button" canRun={presentationFiles.length >= 2} onRun={() => void task.run(async () => onResult(await mergePresentations(presentationFiles)))}>
      <div className="flex justify-center">
        <button id="merge-pptx-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('office.addFiles')}
        </button>
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Split

// A copy of the presentation with only the slides at `keptIndexes` (0-based), their notes, comments and unused media removed.
async function keepSlides(bytes: ArrayBuffer, fileName: string, keptIndexes: Set<number>) {
  const zip = await openPresentation(new File([bytes], fileName))
  const presentationXml = (await readXmlPart(zip, PRESENTATION))!
  const removedIds = new Set<string>()
  for (const [index, slide] of (await readSlideList(zip, presentationXml)).entries()) {
    if (keptIndexes.has(index)) continue
    removedIds.add(slide.slideId.getAttribute('id') ?? '')
    slide.slideId.remove()
    await removeRelationships(zip, PRESENTATION, (relationship) => relationship.id === slide.relationshipId)
    for (const relationship of await readRelationships(zip, slide.path)) {
      if (!relationship.isExternal && /^(notesSlide|comments)$|comment/i.test(typeEnd(relationship.type))) await removePart(zip, resolveTarget(slide.path, relationship.target))
    }
    await removePart(zip, slide.path)
  }
  for (const sectionSlide of Array.from(presentationXml.getElementsByTagNameNS(P14, 'sldId'))) if (removedIds.has(sectionSlide.getAttribute('id') ?? '')) sectionSlide.remove()
  // Custom shows list slides that may be gone.
  for (const customShows of Array.from(presentationXml.getElementsByTagNameNS(P, 'custShowLst'))) customShows.remove()
  writeXmlPart(zip, PRESENTATION, presentationXml)
  await removeUnusedParts(zip)
  // The part is saved as .pptx, also when it comes from a slide show or a template.
  await setContentType(zip, PRESENTATION, PRESENTATION_MAIN_TYPE)
  return zip
}

async function splitPresentation(file: File, rangesText: string) {
  const bytes = await file.arrayBuffer()
  const zip = await openPresentation(file)
  const slideCount = (await readSlideList(zip, (await readXmlPart(zip, PRESENTATION))!)).length
  const groups = rangesText.trim() === '' ? Array.from({ length: slideCount }, (_, index) => [index + 1]) : parsePageRanges(rangesText, slideCount)
  if (!groups) throw new OfficeToolProblem('office.splitPptx.badRanges')
  if (slideCount < 2) throw new OfficeToolProblem('office.splitPptx.oneSlide')
  const parts: File[] = []
  for (const group of groups) {
    const part = await keepSlides(bytes, file.name, new Set(group.map((slideNumber) => slideNumber - 1)))
    const label = group.length === 1 ? `slide-${group[0]}` : `slides-${group[0]}-${group.at(-1)}`
    parts.push(await packageToFile(part, `${baseNameOf(file.name)}-${label}.pptx`, POWERPOINT_TYPE))
  }
  return filesToResult(parts, `${baseNameOf(file.name)}-parts.zip`)
}

export function SplitPptx({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const [rangesText, setRangesText] = useState('')
  return (
    <OfficeToolLayout toolId="split-pptx" hintKey="office.splitPptx.hint" files={files.slice(0, 1)} task={task} buttonKey="office.splitPptx.button" onRun={() => void task.run(async () => onResult(await splitPresentation(files[0], rangesText)))}>
      <div className="flex justify-center">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('office.splitPptx.ranges')}
          <input id="split-pptx-ranges-input" dir="ltr" placeholder="1-3, 4-8" value={rangesText} onChange={(event) => setRangesText(event.target.value)} className={fieldClass} />
        </label>
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Extract media

export function ExtractPptxMedia({ files, onResult }: ToolProps) {
  const task = useOfficeTask()
  const file = files[0]
  return (
    <OfficeToolLayout
      toolId="extract-pptx-media"
      hintKey="office.extractPptx.hint"
      files={files.slice(0, 1)}
      task={task}
      buttonKey="office.extractImages.button"
      onRun={() =>
        void task.run(async () => {
          const mediaFiles = await extractMediaFiles(await openPresentation(file), 'ppt/media/')
          if (mediaFiles.length === 0) throw new OfficeToolProblem('office.extractImages.none')
          onResult(await filesToResult(mediaFiles, `${baseNameOf(file.name)}-media.zip`))
        })
      }
    />
  )
}

// ---------------------------------------------------------------- Search text

const SNIPPET_RADIUS = 40

export function SearchPptx({ files }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const [read, setRead] = useState<{ file: File; text: PresentationText } | null>(null)
  const [query, setQuery] = useState('')
  const [hasFailed, setHasFailed] = useState(false)
  useEffect(() => {
    let isCurrent = true
    Promise.all([import('../../formats/powerpoint/presentationText'), file.arrayBuffer()])
      .then(([{ readPresentationText }, contents]) => readPresentationText(contents))
      .then((text) => isCurrent && (setRead({ file, text }), setHasFailed(false)))
      .catch(() => isCurrent && setHasFailed(true))
    return () => {
      isCurrent = false
    }
  }, [file])
  const slides = read?.file === file ? read.text.slides : null
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!slides || needle === '') return []
    return slides.flatMap((slide, slideIndex) =>
      [...[slide.title, ...slide.paragraphs].map((text) => ({ text, isNotes: false })), { text: slide.notes, isNotes: true }].flatMap(({ text, isNotes }) => {
        const lowerText = text.toLocaleLowerCase()
        const matches = []
        for (let index = lowerText.indexOf(needle); index !== -1; index = lowerText.indexOf(needle, index + needle.length)) {
          const start = Math.max(0, index - SNIPPET_RADIUS)
          matches.push({ slideNumber: slideIndex + 1, isNotes, before: `${start > 0 ? '…' : ''}${text.slice(start, index)}`, match: text.slice(index, index + needle.length), after: `${text.slice(index + needle.length, index + needle.length + SNIPPET_RADIUS)}${index + needle.length + SNIPPET_RADIUS < text.length ? '…' : ''}` })
        }
        return matches
      }),
    )
  }, [slides, query])
  return (
    <div id="search-pptx-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('office.searchPptx.hint')}</p>
      <label className="block text-sm font-medium">
        {t('office.searchPptx.label')}
        <input id="search-pptx-input" type="search" dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      {hasFailed && (
        <p id="tool-error" role="alert" className="text-center font-medium text-danger">
          {t('office.failed')}
        </p>
      )}
      {slides && query.trim() !== '' && (
        <div id="search-pptx-results" className={panelClass}>
          <p id="search-pptx-count" role="status" className="font-medium">
            {t('office.searchPptx.count', { count: results.length, slides: new Set(results.map((result) => result.slideNumber)).size })}
          </p>
          <ul className="space-y-2">
            {results.map((result, position) => (
              <li key={position} id={`search-pptx-result-${position + 1}`} className="text-sm">
                <span className="font-medium">{t(result.isNotes ? 'office.searchPptx.notesOf' : 'office.searchPptx.slide', { number: result.slideNumber })}</span>{' '}
                <bdi dir="auto" className="text-ink-soft">
                  {result.before}
                  <mark className="rounded bg-accent/20 px-0.5 text-ink">{result.match}</mark>
                  {result.after}
                </bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Metadata

export const PptxMetadata = (props: ToolProps) => <OfficeMetadata {...props} toolId="pptx-metadata" />

// ---------------------------------------------------------------- Remove macros

async function removeMacros(file: File) {
  const zip = await openPresentation(file)
  const macroRelationships = await removeRelationships(zip, PRESENTATION, (relationship) => typeEnd(relationship.type) === 'vbaProject')
  if (macroRelationships.length === 0) throw new OfficeToolProblem('office.macros.none')
  for (const relationship of macroRelationships) await removePart(zip, resolveTarget(PRESENTATION, relationship.target))
  for (const path of Object.keys(zip.files).filter((name) => /vbaProjectSignature[^/]*\.bin$|vbaData\.xml$/i.test(name))) await removePart(zip, path)
  const contentTypes = (await readXmlPart(zip, '[Content_Types].xml'))!
  for (const element of Array.from(contentTypes.documentElement.children)) if (element.getAttribute('ContentType') === 'application/vnd.ms-office.vbaProject') element.remove()
  writeXmlPart(zip, '[Content_Types].xml', contentTypes)
  await setContentType(zip, PRESENTATION, PRESENTATION_MAIN_TYPE)
  return packageToFile(zip, `${baseNameOf(file.name)}.pptx`, POWERPOINT_TYPE)
}

export function PptmToPptx({ files, onResult }: ToolProps) {
  const task = useOfficeTask()
  return <OfficeToolLayout toolId="pptm-to-pptx" hintKey="office.macros.hint" files={files.slice(0, 1)} task={task} buttonKey="office.macros.button" onRun={() => void task.run(async () => onResult(await removeMacros(files[0])))} />
}

// ---------------------------------------------------------------- Watermark

const WATERMARK_HEX: Record<WatermarkColor, string> = { silver: 'A6A6A6', red: 'C0392B', blue: '2F5FD0' }
const EMU_PER_POINT = 12700

async function addSlideWatermarks(zip: JSZip, text: string, color: WatermarkColor, layout: WatermarkLayout) {
  const presentationXml = (await readXmlPart(zip, PRESENTATION))!
  const slideSize = presentationXml.getElementsByTagNameNS(P, 'sldSz')[0]
  const [slideWidth, slideHeight] = [Number(slideSize?.getAttribute('cx')) || 12192000, Number(slideSize?.getAttribute('cy')) || 6858000]
  const [boxWidth, boxHeight] = [Math.round(slideWidth * 0.8), Math.round(slideHeight * 0.3)]
  const fontPoints = Math.max(12, Math.min(boxHeight / EMU_PER_POINT * 0.6, boxWidth / EMU_PER_POINT / Math.max(text.length, 4) * 1.6))
  const isRightToLeft = /[֐-ࣿ]/.test(text)
  for (const { path } of await readSlideList(zip, presentationXml)) {
    const slideXml = path ? await readXmlPart(zip, path) : null
    const shapeTree = slideXml?.getElementsByTagNameNS(P, 'spTree')[0]
    if (!slideXml || !shapeTree) continue
    const shapeId = Math.max(1, ...Array.from(slideXml.getElementsByTagNameNS(P, 'cNvPr'), (element) => Number(element.getAttribute('id')) || 0)) + 1
    const [shape] = parseXmlElements(
      slideXml,
      `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="Watermark ${shapeId}"/><p:cNvSpPr txBox="1"/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr><a:xfrm${layout === 'diagonal' ? ' rot="18900000"' : ''}><a:off x="${Math.round((slideWidth - boxWidth) / 2)}" y="${Math.round((slideHeight - boxHeight) / 2)}"/><a:ext cx="${boxWidth}" cy="${boxHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"${isRightToLeft ? ' rtl="1"' : ''}/><a:r><a:rPr lang="${isRightToLeft ? 'ar-SA' : 'en-US'}" sz="${Math.round(fontPoints) * 100}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${WATERMARK_HEX[color]}"><a:alpha val="35000"/></a:srgbClr></a:solidFill></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p></p:txBody></p:sp>`,
    )
    const extensionList = Array.from(shapeTree.children).find((child) => child.localName === 'extLst')
    shapeTree.insertBefore(shape, extensionList ?? null)
    writeXmlPart(zip, path, slideXml)
  }
}

export function WatermarkPptx({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const [text, setText] = useState(() => t('office.watermark.defaultText'))
  const [color, setColor] = useState<WatermarkColor>('silver')
  const [layout, setLayout] = useState<WatermarkLayout>('diagonal')
  const file = files[0]
  return (
    <OfficeToolLayout
      toolId="watermark-pptx"
      hintKey="office.watermarkPptx.hint"
      files={files.slice(0, 1)}
      task={task}
      buttonKey="office.watermark.button"
      canRun={text.trim() !== ''}
      onRun={() =>
        void task.run(async () => {
          const zip = await openPresentation(file)
          await addSlideWatermarks(zip, text.trim(), color, layout)
          onResult(await packageToFile(zip, `${baseNameOf(file.name)}-watermarked.pptx`, POWERPOINT_TYPE))
        })
      }
    >
      <WatermarkFields idPrefix="watermark-pptx" text={text} onTextChange={setText} color={color} onColorChange={setColor} layout={layout} onLayoutChange={setLayout} />
    </OfficeToolLayout>
  )
}
