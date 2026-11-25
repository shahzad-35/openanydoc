/* oxlint-disable react/only-export-components */
// The Word tools: merge, split, compare, count, find and replace, remove comments and tracked changes, metadata, extract images,
// watermark and mail merge. Each one edits the .docx's XML parts (officePackage.ts) and leaves the rest of the file as it was.
import { useEffect, useMemo, useState } from 'react'
import type JSZip from 'jszip'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import type { ToolProps } from '../registry'
import { countCharacters, countWords } from '../ai/textStats'
import { baseNameOf } from '../pdf/PdfToolParts'
import { downloadTextFile } from '../../formats/registry'
import { OfficeMetadata, OfficeToolLayout, OfficeToolProblem, WatermarkFields, fieldClass, openOfficePackage, panelClass, useOfficeTask } from './OfficeToolParts'
import type { WatermarkColor, WatermarkLayout } from './OfficeToolParts'
import {
  RELATIONSHIP_TYPE,
  WORD_TYPE,
  addRelationship,
  copyPartTree,
  declareNamespaces,
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
  safeFileName,
  setContentType,
  writeXmlPart,
} from './officePackage'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml'
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace'
const DOCUMENT = 'word/document.xml'
const isWordFile = (file: File) => /\.(docx|docm|dotx)$/i.test(file.name)

const wordElements = (root: Document | Element, localName: string) => Array.from(root.getElementsByTagNameNS(W, localName))
const wordAttribute = (element: Element, localName: string) => element.getAttributeNS(W, localName) ?? ''
const childElement = (parent: Element, localName: string) => Array.from(parent.children).find((child) => child.namespaceURI === W && child.localName === localName) ?? null

function unwrap(element: Element) {
  element.replaceWith(...Array.from(element.childNodes))
}

// The parts with the document's text: the body, headers, footers, footnotes and endnotes.
const wordTextPartPaths = (zip: JSZip) => Object.keys(zip.files).filter((path) => path === DOCUMENT || /^word\/(header|footer)\d*\.xml$/.test(path) || path === 'word/footnotes.xml' || path === 'word/endnotes.xml')

async function openWordPackage(file: File) {
  const zip = await openOfficePackage(file)
  if (!zip.file(DOCUMENT)) throw new OfficeToolProblem('office.notWord')
  return zip
}

// ---------------------------------------------------------------- text across runs

// A paragraph's text elements, in order, not counting those of paragraphs nested in it (a text box inside a run).
function paragraphTextElements(paragraph: Element) {
  return wordElements(paragraph, 't').filter((textElement) => {
    let ancestor = textElement.parentElement
    while (ancestor && !(ancestor.namespaceURI === W && ancestor.localName === 'p')) ancestor = ancestor.parentElement
    return ancestor === paragraph
  })
}

type TextMatch = { start: number; end: number }
const isWordCharacter = (character: string | undefined) => character !== undefined && /[\p{L}\p{N}\p{M}_]/u.test(character)

function findTextMatches(text: string, search: string, matchCase: boolean, wholeWords: boolean): TextMatch[] {
  if (search === '') return []
  const [haystack, needle] = matchCase ? [text, search] : [text.toLocaleLowerCase(), search.toLocaleLowerCase()]
  const matches: TextMatch[] = []
  for (let start = haystack.indexOf(needle); start !== -1; start = haystack.indexOf(needle, start + needle.length)) {
    const end = start + needle.length
    if (wholeWords && (isWordCharacter(text[start - 1]) || isWordCharacter(text[end]))) continue
    matches.push({ start, end })
  }
  return matches
}

// Replaces characters `start`–`end` of the paragraph's joined text: the replacement goes into the text element where the match
// starts (keeping that run's formatting), and the rest of the match is cut from the elements after it.
function replaceTextRange(textElements: Element[], { start, end }: TextMatch, replacement: string) {
  let offset = 0
  let isReplacementPlaced = false
  for (const textElement of textElements) {
    const text = textElement.textContent ?? ''
    const [elementStart, elementEnd] = [offset, offset + text.length]
    offset = elementEnd
    if (elementEnd <= start || elementStart >= end) continue
    const cutFrom = Math.max(start, elementStart) - elementStart
    const cutTo = Math.min(end, elementEnd) - elementStart
    textElement.textContent = text.slice(0, cutFrom) + (isReplacementPlaced ? '' : replacement) + text.slice(cutTo)
    textElement.setAttributeNS(XML_NAMESPACE, 'xml:space', 'preserve')
    isReplacementPlaced = true
  }
}

// ---------------------------------------------------------------- Find and replace

async function replaceInDocument(zip: JSZip, search: string, replacement: string, matchCase: boolean, wholeWords: boolean, shouldWrite: boolean) {
  let matchCount = 0
  for (const partPath of wordTextPartPaths(zip)) {
    const xml = (await readXmlPart(zip, partPath))!
    let partMatchCount = 0
    for (const paragraph of wordElements(xml, 'p')) {
      const textElements = paragraphTextElements(paragraph)
      const matches = findTextMatches(textElements.map((textElement) => textElement.textContent ?? '').join(''), search, matchCase, wholeWords)
      partMatchCount += matches.length
      if (shouldWrite) for (const match of matches.reverse()) replaceTextRange(textElements, match, replacement)
    }
    matchCount += partMatchCount
    if (shouldWrite && partMatchCount > 0) writeXmlPart(zip, partPath, xml)
  }
  return matchCount
}

export function WordFindReplace({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const file = files[0]
  const [search, setSearch] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWords, setWholeWords] = useState(false)
  const [counted, setCounted] = useState<{ key: string; count: number } | null>(null)
  const countKey = JSON.stringify([file.name, file.size, search, matchCase, wholeWords])
  const { setErrorKey } = task
  useEffect(() => {
    if (search === '') return
    let isCurrent = true
    const timer = setTimeout(() => {
      openWordPackage(file)
        .then((zip) => replaceInDocument(zip, search, '', matchCase, wholeWords, false))
        .then((count) => isCurrent && setCounted({ key: countKey, count }))
        .catch((error: unknown) => isCurrent && setErrorKey(error instanceof OfficeToolProblem ? error.messageKey : 'office.failed'))
    }, 250)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [file, search, matchCase, wholeWords, countKey, setErrorKey])
  const matchCount = counted?.key === countKey ? counted.count : null
  return (
    <OfficeToolLayout
      toolId="word-find-replace"
      hintKey="office.findReplace.hint"
      files={files}
      task={task}
      buttonKey="office.findReplace.button"
      canRun={search !== '' && (matchCount ?? 0) > 0}
      onRun={() =>
        void task.run(async () => {
          const zip = await openWordPackage(file)
          await replaceInDocument(zip, search, replacement, matchCase, wholeWords, true)
          onResult(await packageToFile(zip, `${baseNameOf(file.name)}-replaced.docx`, WORD_TYPE))
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('office.findReplace.find')}
          <input id="word-find-input" dir="auto" value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('office.findReplace.replace')}
          <input id="word-replace-input" dir="auto" value={replacement} onChange={(event) => setReplacement(event.target.value)} className={fieldClass} />
        </label>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="word-match-case-checkbox" type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} className="size-5" />
          {t('office.findReplace.matchCase')}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="word-whole-words-checkbox" type="checkbox" checked={wholeWords} onChange={(event) => setWholeWords(event.target.checked)} className="size-5" />
          {t('office.findReplace.wholeWords')}
        </label>
      </div>
      <p id="word-match-count" role="status" className="text-center text-sm text-ink-soft">
        {search !== '' && matchCount !== null ? t('office.findReplace.count', { count: matchCount }) : ''}
      </p>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Remove comments and tracked changes

type ChangesChoice = 'accept' | 'reject' | 'keep'
const COMMENT_PART_TYPES = /\/(comments|commentsExtended|commentsIds|commentsExtensible|people)$/
const PROPERTY_CHANGES = ['rPrChange', 'pPrChange', 'sectPrChange', 'tblPrChange', 'tcPrChange', 'trPrChange', 'tblGridChange', 'tblPrExChange', 'numberingChange']
const RANGE_MARKS = ['moveFromRangeStart', 'moveFromRangeEnd', 'moveToRangeStart', 'moveToRangeEnd', 'customXmlInsRangeStart', 'customXmlInsRangeEnd', 'customXmlDelRangeStart', 'customXmlDelRangeEnd']

function removeCommentMarks(root: Document | Element) {
  for (const mark of [...wordElements(root, 'commentRangeStart'), ...wordElements(root, 'commentRangeEnd')]) mark.remove()
  for (const reference of wordElements(root, 'commentReference')) {
    const run = reference.parentElement!
    const hasOtherContent = Array.from(run.children).some((child) => child !== reference && child.localName !== 'rPr')
    if (hasOtherContent) reference.remove()
    else run.remove()
  }
}

// Accepting keeps what was inserted and drops what was deleted; rejecting does the opposite. Changed formatting is kept
// (accepted) or set back to what the change recorded (rejected).
function resolveTrackedChanges(xml: XMLDocument, choice: 'accept' | 'reject') {
  for (const mark of RANGE_MARKS.flatMap((localName) => wordElements(xml, localName))) mark.remove()
  for (const localName of PROPERTY_CHANGES) {
    for (const change of wordElements(xml, localName)) {
      if (choice === 'reject' && change.firstElementChild) {
        const owner = change.parentElement!
        const keptChildren = Array.from(owner.children).filter((child) => child !== change && ['rPr', 'sectPr', 'pPrChange'].includes(child.localName) && owner.localName === 'pPr')
        owner.replaceChildren(...Array.from(change.firstElementChild.children), ...keptChildren.filter((child) => child.localName !== 'pPrChange'))
      } else change.remove()
    }
  }
  // Inserted or deleted table rows and paragraph marks are marked inside their properties.
  for (const marker of [...wordElements(xml, 'ins'), ...wordElements(xml, 'del')].filter((element) => ['rPr', 'trPr', 'tcPr'].includes(element.parentElement?.localName ?? ''))) {
    const isRowRemoved = marker.parentElement!.localName === 'trPr' && ((choice === 'accept' && marker.localName === 'del') || (choice === 'reject' && marker.localName === 'ins'))
    if (isRowRemoved) marker.closest('tr')?.remove()
    else marker.remove()
  }
  const [kept, dropped] = choice === 'accept' ? [['ins', 'moveTo'], ['del', 'moveFrom']] : [['del', 'moveFrom'], ['ins', 'moveTo']]
  for (const localName of dropped) for (const element of wordElements(xml, localName)) element.remove()
  for (const localName of kept) for (const element of wordElements(xml, localName)) unwrap(element)
  if (choice === 'reject') {
    for (const deletedText of [...wordElements(xml, 'delText'), ...wordElements(xml, 'delInstrText')]) {
      const restored = xml.createElementNS(W, deletedText.localName === 'delText' ? 'w:t' : 'w:instrText')
      restored.setAttributeNS(XML_NAMESPACE, 'xml:space', 'preserve')
      restored.textContent = deletedText.textContent
      deletedText.replaceWith(restored)
    }
  }
}

async function cleanWordDocument(zip: JSZip, shouldRemoveComments: boolean, changesChoice: ChangesChoice) {
  for (const partPath of wordTextPartPaths(zip)) {
    const xml = (await readXmlPart(zip, partPath))!
    if (shouldRemoveComments) removeCommentMarks(xml)
    if (changesChoice !== 'keep') resolveTrackedChanges(xml, changesChoice)
    writeXmlPart(zip, partPath, xml)
  }
  if (shouldRemoveComments) {
    for (const relationship of await removeRelationships(zip, DOCUMENT, (candidate) => COMMENT_PART_TYPES.test(candidate.type))) await removePart(zip, resolveTarget(DOCUMENT, relationship.target))
  }
}

export function RemoveWordComments({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const file = files[0]
  const [shouldRemoveComments, setShouldRemoveComments] = useState(true)
  const [changesChoice, setChangesChoice] = useState<ChangesChoice>('accept')
  return (
    <OfficeToolLayout
      toolId="remove-word-comments"
      hintKey="office.clean.hint"
      files={files}
      task={task}
      buttonKey="office.clean.button"
      canRun={shouldRemoveComments || changesChoice !== 'keep'}
      onRun={() =>
        void task.run(async () => {
          const zip = await openWordPackage(file)
          await cleanWordDocument(zip, shouldRemoveComments, changesChoice)
          onResult(await packageToFile(zip, `${baseNameOf(file.name)}-clean.docx`, WORD_TYPE))
        })
      }
    >
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="remove-comments-checkbox" type="checkbox" checked={shouldRemoveComments} onChange={(event) => setShouldRemoveComments(event.target.checked)} className="size-5" />
          {t('office.clean.comments')}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('office.clean.changes')}
          <select id="tracked-changes-select" value={changesChoice} onChange={(event) => setChangesChoice(event.target.value as ChangesChoice)} className={fieldClass}>
            <option value="accept">{t('office.clean.accept')}</option>
            <option value="reject">{t('office.clean.reject')}</option>
            <option value="keep">{t('office.clean.keep')}</option>
          </select>
        </label>
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Merge

const relationshipTypeEnd = (type: string) => type.slice(type.lastIndexOf('/') + 1)

async function findLinkedPart(zip: JSZip, partPath: string, typeEnd: string) {
  const relationship = (await readRelationships(zip, partPath)).find((candidate) => relationshipTypeEnd(candidate.type) === typeEnd)
  return relationship ? resolveTarget(partPath, relationship.target) : null
}

const highestNumber = (elements: Element[], attribute: string) => Math.max(0, ...elements.map((element) => Number(wordAttribute(element, attribute)) || 0))

// Copies the numbered and bulleted lists used by `nodes` from the source's numbering part into the target's, with new ids.
async function importNumbering(source: JSZip, target: JSZip, nodes: Element[]) {
  const usedNumIds = new Set(nodes.flatMap((node) => wordElements(node, 'numId').map((element) => wordAttribute(element, 'val'))).filter((value) => value !== '0'))
  if (usedNumIds.size === 0) return
  const sourcePath = await findLinkedPart(source, DOCUMENT, 'numbering')
  const sourceXml = sourcePath ? await readXmlPart(source, sourcePath) : null
  if (!sourceXml) return
  let targetPath = await findLinkedPart(target, DOCUMENT, 'numbering')
  if (!targetPath) {
    targetPath = 'word/numbering.xml'
    target.file(targetPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:numbering xmlns:w="${W}"/>`)
    await setContentType(target, targetPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml')
    await addRelationship(target, DOCUMENT, `${RELATIONSHIP_TYPE}/numbering`, 'numbering.xml')
  }
  const targetXml = (await readXmlPart(target, targetPath))!
  const targetRoot = targetXml.documentElement
  let nextAbstractId = highestNumber(wordElements(targetXml, 'abstractNum'), 'abstractNumId') + 1
  let nextNumId = highestNumber(wordElements(targetXml, 'num'), 'numId') + 1
  const newNumIds = new Map<string, string>()
  for (const numId of usedNumIds) {
    const sourceNum = wordElements(sourceXml, 'num').find((element) => wordAttribute(element, 'numId') === numId)
    const abstractId = sourceNum ? wordAttribute(childElement(sourceNum, 'abstractNumId')!, 'val') : null
    const sourceAbstract = wordElements(sourceXml, 'abstractNum').find((element) => wordAttribute(element, 'abstractNumId') === abstractId)
    if (!sourceNum || !sourceAbstract) continue
    const abstractCopy = targetXml.importNode(sourceAbstract, true) as Element
    abstractCopy.setAttributeNS(W, 'w:abstractNumId', String(nextAbstractId))
    // A shared list id would join this list to another; picture bullets point at pictures not copied.
    for (const element of [...wordElements(abstractCopy, 'nsid'), ...wordElements(abstractCopy, 'lvlPicBulletId'), ...wordElements(abstractCopy, 'numStyleLink'), ...wordElements(abstractCopy, 'styleLink')]) element.remove()
    const numCopy = targetXml.importNode(sourceNum, true) as Element
    numCopy.setAttributeNS(W, 'w:numId', String(nextNumId))
    childElement(numCopy, 'abstractNumId')!.setAttributeNS(W, 'w:val', String(nextAbstractId))
    const firstNum = wordElements(targetXml, 'num')[0] ?? childElement(targetRoot, 'numIdMacAtCleanup')
    targetRoot.insertBefore(abstractCopy, firstNum)
    targetRoot.insertBefore(numCopy, childElement(targetRoot, 'numIdMacAtCleanup'))
    newNumIds.set(numId, String(nextNumId))
    nextAbstractId++
    nextNumId++
  }
  writeXmlPart(target, targetPath, targetXml)
  for (const element of nodes.flatMap((node) => wordElements(node, 'numId'))) {
    const newId = newNumIds.get(wordAttribute(element, 'val'))
    if (newId) element.setAttributeNS(W, 'w:val', newId)
  }
}

// Styles the target lacks are copied from the source (without list numbering, which would point at the wrong lists).
async function importMissingStyles(source: JSZip, target: JSZip) {
  const [sourcePath, targetPath] = [await findLinkedPart(source, DOCUMENT, 'styles'), await findLinkedPart(target, DOCUMENT, 'styles')]
  const sourceXml = sourcePath ? await readXmlPart(source, sourcePath) : null
  const targetXml = targetPath ? await readXmlPart(target, targetPath) : null
  if (!sourceXml || !targetXml || !targetPath) return
  const targetIds = new Set(wordElements(targetXml, 'style').map((style) => wordAttribute(style, 'styleId')))
  for (const style of wordElements(sourceXml, 'style').filter((candidate) => !targetIds.has(wordAttribute(candidate, 'styleId')))) {
    const copy = targetXml.importNode(style, true) as Element
    for (const numbering of wordElements(copy, 'numPr')) numbering.remove()
    targetXml.documentElement.appendChild(copy)
  }
  writeXmlPart(target, targetPath, targetXml)
}

// Footnotes or endnotes of the appended document copied into the target's with new ids. A target without such a part gets
// one made from the source's, with only its separator lines kept.
async function importNotes(source: JSZip, target: JSZip, nodes: Element[], kind: 'footnote' | 'endnote') {
  const references = nodes.flatMap((node) => wordElements(node, `${kind}Reference`))
  if (references.length === 0) return
  const sourcePath = await findLinkedPart(source, DOCUMENT, `${kind}s`)
  const sourceXml = sourcePath ? await readXmlPart(source, sourcePath) : null
  if (!sourceXml) {
    for (const reference of references) reference.remove()
    return
  }
  const linkedTargetPath = await findLinkedPart(target, DOCUMENT, `${kind}s`)
  const targetPath = linkedTargetPath ?? `word/${kind}s.xml`
  let targetXml = linkedTargetPath ? await readXmlPart(target, linkedTargetPath) : null
  if (!targetXml) {
    if (!linkedTargetPath) await addRelationship(target, DOCUMENT, `${RELATIONSHIP_TYPE}/${kind}s`, `${kind}s.xml`)
    targetXml = sourceXml.cloneNode(true) as XMLDocument
    for (const note of wordElements(targetXml, kind)) if (['', 'normal'].includes(wordAttribute(note, 'type'))) note.remove()
    await setContentType(target, targetPath, `application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}s+xml`)
  }
  let nextId = highestNumber(wordElements(targetXml, kind), 'id') + 1
  for (const reference of references) {
    const note = wordElements(sourceXml, kind).find((candidate) => wordAttribute(candidate, 'id') === wordAttribute(reference, 'id'))
    if (!note) {
      reference.remove()
      continue
    }
    const copy = targetXml.importNode(note, true) as Element
    copy.setAttributeNS(W, 'w:id', String(nextId))
    // Pictures inside a note point at the source's relationships; they are left out.
    for (const element of [copy, ...Array.from(copy.getElementsByTagName('*'))]) for (const attribute of Array.from(element.attributes)) if (attribute.namespaceURI === R) element.removeAttributeNode(attribute)
    targetXml.documentElement.appendChild(copy)
    reference.setAttributeNS(W, 'w:id', String(nextId))
    nextId++
  }
  writeXmlPart(target, targetPath, targetXml)
}

// The body of `source` (without its own section settings) is prepared to live in `target`: relationships copied, lists, styles
// and notes imported, ids that must be unique moved out of the target's range.
async function importBody(source: JSZip, target: JSZip, targetXml: XMLDocument, idOffset: number) {
  const sourceXml = (await readXmlPart(source, DOCUMENT))!
  const sourceBody = wordElements(sourceXml, 'body')[0]
  const nodes = Array.from(sourceBody.children).filter((child) => !(child.namespaceURI === W && child.localName === 'sectPr')).map((child) => targetXml.importNode(child, true) as Element)
  const sourceRelationships = await readRelationships(source, DOCUMENT)
  const newIds = new Map<string, string>()
  const copied = new Map<string, string>()
  for (const element of nodes.flatMap((node) => [node, ...Array.from(node.getElementsByTagName('*'))])) {
    if (element.namespaceURI === W && element.localName === 'sectPr') {
      element.remove()
      continue
    }
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI === W14 && (attribute.localName === 'paraId' || attribute.localName === 'textId')) element.removeAttributeNode(attribute)
      else if (attribute.namespaceURI === W && attribute.localName === 'id' && !['footnoteReference', 'endnoteReference'].includes(element.localName)) attribute.value = String((Number(attribute.value) || 0) + idOffset)
      else if (attribute.namespaceURI === R) {
        const sourceId = attribute.value
        if (!newIds.has(sourceId)) {
          const relationship = sourceRelationships.find((candidate) => candidate.id === sourceId)
          if (!relationship) continue
          const targetPart = relationship.isExternal ? relationship.target : await copyPartTree(source, resolveTarget(DOCUMENT, relationship.target), target, () => undefined, copied)
          newIds.set(sourceId, await addRelationship(target, DOCUMENT, relationship.type, relationship.isExternal ? targetPart : targetPart.replace(/^word\//, ''), relationship.isExternal))
        }
        attribute.value = newIds.get(sourceId)!
      }
    }
  }
  for (const node of nodes) removeCommentMarks(node)
  await importNumbering(source, target, nodes)
  await importMissingStyles(source, target)
  await importNotes(source, target, nodes, 'footnote')
  await importNotes(source, target, nodes, 'endnote')
  return nodes
}

async function mergeWordDocuments(files: File[]) {
  const target = await openWordPackage(files[0])
  const targetXml = (await readXmlPart(target, DOCUMENT))!
  for (const [position, file] of files.slice(1).entries()) {
    const nodes = await importBody(await openWordPackage(file), target, targetXml, (position + 1) * 100000)
    // Parts written while importing (relationships) are on disk; the document itself is kept in memory until the end.
    const body = wordElements(targetXml, 'body')[0]
    const finalSection = childElement(body, 'sectPr')
    body.insertBefore(parseXmlElements(targetXml, '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')[0], finalSection)
    for (const node of nodes) body.insertBefore(node, finalSection)
  }
  // Every drawing needs its own id in the whole document; the headers' ids are left as they are.
  const headerIds = []
  for (const partPath of wordTextPartPaths(target).filter((path) => path !== DOCUMENT)) {
    const partXml = (await readXmlPart(target, partPath))!
    headerIds.push(...Array.from(partXml.getElementsByTagNameNS(WP, 'docPr'), (element) => Number(element.getAttribute('id')) || 0))
  }
  let nextDrawingId = Math.max(0, ...headerIds) + 1
  for (const drawing of Array.from(targetXml.getElementsByTagNameNS(WP, 'docPr'))) drawing.setAttribute('id', String(nextDrawingId++))
  writeXmlPart(target, DOCUMENT, targetXml)
  return packageToFile(target, `${baseNameOf(files[0].name)}-merged.docx`, WORD_TYPE)
}

export function MergeWord({ files, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const wordFiles = files.filter(isWordFile)
  return (
    <OfficeToolLayout
      toolId="merge-word"
      hintKey="office.mergeWord.hint"
      files={wordFiles}
      task={task}
      buttonKey="office.mergeWord.button"
      canRun={wordFiles.length >= 2}
      onRun={() => void task.run(async () => onResult(await mergeWordDocuments(wordFiles)))}
    >
      <div className="flex justify-center">
        <button id="merge-word-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('office.addFiles')}
        </button>
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Split

type SplitWordMode = 'heading1' | 'heading2' | 'pageBreaks'

async function readHeadingLevels(zip: JSZip) {
  const stylesPath = await findLinkedPart(zip, DOCUMENT, 'styles')
  const stylesXml = stylesPath ? await readXmlPart(zip, stylesPath) : null
  const levels = new Map<string, number>()
  for (const style of stylesXml ? wordElements(stylesXml, 'style') : []) {
    const outline = wordElements(style, 'outlineLvl')[0]
    const nameMatch = /^heading (\d)$/i.exec(wordAttribute(childElement(style, 'name') ?? style, 'val'))
    const level = outline ? Number(wordAttribute(outline, 'val')) + 1 : nameMatch ? Number(nameMatch[1]) : 0
    if (level > 0) levels.set(wordAttribute(style, 'styleId'), level)
  }
  return levels
}

function headingLevelOf(paragraph: Element, styleLevels: Map<string, number>) {
  const properties = childElement(paragraph, 'pPr')
  const ownOutline = properties ? childElement(properties, 'outlineLvl') : null
  if (ownOutline) return Number(wordAttribute(ownOutline, 'val')) + 1
  const style = properties ? childElement(properties, 'pStyle') : null
  return style ? (styleLevels.get(wordAttribute(style, 'val')) ?? 0) : 0
}

async function splitWordDocument(file: File, mode: SplitWordMode) {
  const bytes = await file.arrayBuffer()
  const zip = await openWordPackage(file)
  const xml = (await readXmlPart(zip, DOCUMENT))!
  const blocks = Array.from(wordElements(xml, 'body')[0].children).filter((child) => !(child.namespaceURI === W && child.localName === 'sectPr'))
  const styleLevels = await readHeadingLevels(zip)
  // Index ranges of the body's blocks, one per part.
  const starts = [0]
  for (const [index, block] of blocks.entries()) {
    const isParagraph = block.localName === 'p'
    if (mode === 'pageBreaks') {
      const properties = isParagraph ? childElement(block, 'pPr') : null
      if (index > 0 && properties && childElement(properties, 'pageBreakBefore')) starts.push(index)
      const endsPage = isParagraph && (wordElements(block, 'br').some((breakElement) => wordAttribute(breakElement, 'type') === 'page') || (properties !== null && childElement(properties, 'sectPr') !== null))
      if (endsPage && index + 1 < blocks.length) starts.push(index + 1)
    } else if (index > 0 && isParagraph) {
      const level = headingLevelOf(block, styleLevels)
      if (level > 0 && level <= (mode === 'heading1' ? 1 : 2)) starts.push(index)
    }
  }
  const ranges = [...new Set(starts)].sort((first, second) => first - second).map((start, position, all) => [start, all[position + 1] ?? blocks.length] as const)
  if (ranges.length < 2) throw new OfficeToolProblem('office.splitWord.nothingToSplit')
  const digits = Math.max(2, String(ranges.length).length)
  const parts: File[] = []
  for (const [partIndex, [start, end]] of ranges.entries()) {
    const partZip = await openWordPackage(new File([bytes], file.name))
    const partXml = (await readXmlPart(partZip, DOCUMENT))!
    const partBlocks = Array.from(wordElements(partXml, 'body')[0].children).filter((child) => !(child.namespaceURI === W && child.localName === 'sectPr'))
    partBlocks.forEach((block, index) => (index < start || index >= end) && block.remove())
    // The part's last paragraph ends the document: its page break and section break would leave an empty page.
    const lastBlock = partBlocks[end - 1]
    if (lastBlock.localName === 'p') {
      for (const breakElement of wordElements(lastBlock, 'br')) if (wordAttribute(breakElement, 'type') === 'page') breakElement.remove()
      const properties = childElement(lastBlock, 'pPr')
      childElement(properties ?? lastBlock, 'sectPr')?.remove()
    }
    writeXmlPart(partZip, DOCUMENT, partXml)
    const usedIds = new Set(Array.from(partXml.getElementsByTagName('*')).flatMap((element) => Array.from(element.attributes).filter((attribute) => attribute.namespaceURI === R).map((attribute) => attribute.value)))
    await removeRelationships(partZip, DOCUMENT, (relationship) => /\/(image|chart|diagramData|diagramLayout|diagramColors|diagramQuickStyle|oleObject|package)$/.test(relationship.type) && !usedIds.has(relationship.id))
    await removeUnreferencedMedia(partZip, 'word/media/')
    const firstText = partBlocks.slice(start, end).map((block) => paragraphTextElements(block).map((textElement) => textElement.textContent).join('').trim()).find(Boolean) ?? ''
    parts.push(await packageToFile(partZip, `${String(partIndex + 1).padStart(digits, '0')}-${safeFileName(firstText, 'part')}.docx`, WORD_TYPE))
  }
  return filesToResult(parts, `${baseNameOf(file.name)}-parts.zip`)
}

export function SplitWord({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const [mode, setMode] = useState<SplitWordMode>('heading1')
  return (
    <OfficeToolLayout toolId="split-word" hintKey="office.splitWord.hint" files={files.slice(0, 1)} task={task} buttonKey="office.splitWord.button" onRun={() => void task.run(async () => onResult(await splitWordDocument(files[0], mode)))}>
      <div className="flex justify-center">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('office.splitWord.at')}
          <select id="split-word-mode-select" value={mode} onChange={(event) => setMode(event.target.value as SplitWordMode)} className={fieldClass}>
            <option value="heading1">{t('office.splitWord.heading1')}</option>
            <option value="heading2">{t('office.splitWord.heading2')}</option>
            <option value="pageBreaks">{t('office.splitWord.pageBreaks')}</option>
          </select>
        </label>
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Compare

type TextChange = { value: string; added?: boolean; removed?: boolean }

async function readWordText(file: File) {
  const mammoth = await import('mammoth')
  return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
}

const isRightToLeftText = (text: string) => /^[^A-Za-z\u0590-\u08FF]*[\u0590-\u08FF]/.test(text)
// The differences as a Word document: added words underlined in green, removed words struck through in red.
async function writeComparisonReport(changes: TextChange[], title: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const paragraphs = [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] })]
  let runs: InstanceType<typeof TextRun>[] = []
  let lineText = ''
  for (const change of changes) {
    const lines = change.value.split('\n')
    for (const [lineIndex, line] of lines.entries()) {
      if (lineIndex > 0) {
        paragraphs.push(new Paragraph({ children: runs, bidirectional: isRightToLeftText(lineText) }))
        lineText = ''
        runs = []
      }
      lineText += line
      if (line) runs.push(new TextRun({ text: line, color: change.added ? '1E7B34' : change.removed ? 'C0392B' : undefined, underline: change.added ? {} : undefined, strike: change.removed }))
    }
  }
  paragraphs.push(new Paragraph({ children: runs, bidirectional: isRightToLeftText(lineText) }))
  return Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }))
}

export function CompareWord({ files, onAddFiles }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const [oldFile, newFile] = files.filter(isWordFile).slice(-2)
  const [comparison, setComparison] = useState<{ files: File[]; changes: TextChange[] } | null>(null)
  const shownChanges = comparison && comparison.files[0] === oldFile && comparison.files[1] === newFile ? comparison.changes : null
  const counts = useMemo(() => ({ added: (shownChanges ?? []).filter((change) => change.added).reduce((total, change) => total + countWords(change.value), 0), removed: (shownChanges ?? []).filter((change) => change.removed).reduce((total, change) => total + countWords(change.value), 0) }), [shownChanges])
  return (
    <OfficeToolLayout
      toolId="compare-word"
      hintKey="office.compareWord.hint"
      files={[oldFile, newFile].filter(Boolean)}
      task={task}
      buttonKey="office.compareWord.button"
      canRun={Boolean(oldFile && newFile)}
      onRun={() =>
        void task.run(async () => {
          const [{ diffWords }, oldText, newText] = await Promise.all([import('diff'), readWordText(oldFile), readWordText(newFile)])
          setComparison({ files: [oldFile, newFile], changes: diffWords(oldText, newText) })
        })
      }
    >
      {!newFile && (
        <div className="flex justify-center">
          <button id="compare-word-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
            {t('office.compareWord.addSecond')}
          </button>
        </div>
      )}
      {shownChanges && (
        <div id="compare-word-result" className={panelClass}>
          <p id="compare-word-summary" role="status" className="font-medium">
            {counts.added === 0 && counts.removed === 0 ? t('office.compareWord.same') : t('office.compareWord.summary', { added: counts.added, removed: counts.removed })}
          </p>
          <div id="compare-word-text" dir="auto" className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-[14px] bg-surface p-3 text-sm leading-relaxed">
            {shownChanges.map((change, position) =>
              change.added ? (
                <ins key={position} className="bg-green-500/15 text-green-800 underline dark:text-green-300">
                  {change.value}
                </ins>
              ) : change.removed ? (
                <del key={position} className="bg-red-500/15 text-red-700 dark:text-red-300">
                  {change.value}
                </del>
              ) : (
                <span key={position}>{change.value}</span>
              ),
            )}
          </div>
          <button
            id="compare-word-download-button"
            type="button"
            onClick={() => void writeComparisonReport(shownChanges, t('office.compareWord.reportTitle', { old: oldFile.name, new: newFile.name })).then((report) => downloadTextFile(`${baseNameOf(newFile.name)}-changes.docx`, report, WORD_TYPE))}
            className="btn btn--quiet press"
          >
            {t('office.compareWord.download')}
          </button>
        </div>
      )}
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Word counter

const WORDS_PER_PAGE = 500
const READING_WORDS_PER_MINUTE = 200
const SPEAKING_WORDS_PER_MINUTE = 130

async function readTextOfFile(file: File) {
  if (isWordFile(file)) return readWordText(file)
  if (/\.odt$/i.test(file.name)) {
    const { readFlowingHtml } = await import('../../formats/word/wordDocument')
    const html = await readFlowingHtml(file.name, await file.arrayBuffer())
    return Array.from(new DOMParser().parseFromString(html.replace(/(<[^>]*?\s)style="[^"]*"/g, '$1'), 'text/html').body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th'), (block) => block.textContent ?? '').join('\n')
  }
  return file.text()
}

function countSentences(text: string) {
  let sentenceCount = 0
  for (const segment of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)) if (/[\p{L}\p{N}]/u.test(segment.segment)) sentenceCount++
  return sentenceCount
}

const formatMinutes = (words: number, wordsPerMinute: number) => Math.max(words > 0 ? 1 : 0, Math.round(words / wordsPerMinute))

export function WordCounter({ files }: ToolProps) {
  const { t } = useT()
  const [text, setText] = useState('')
  const [readError, setReadError] = useState<MessageKey | null>(null)
  const chosenFile = files.at(-1)
  useEffect(() => {
    if (!chosenFile) return
    let isCurrent = true
    readTextOfFile(chosenFile)
      .then((fileText) => isCurrent && (setText(fileText), setReadError(null)))
      .catch(() => isCurrent && setReadError('office.failed'))
    return () => {
      isCurrent = false
    }
  }, [chosenFile])
  const stats = useMemo(() => {
    const words = countWords(text)
    return {
      words,
      characters: countCharacters(text),
      charactersWithoutSpaces: countCharacters(text.replace(/\s+/g, '')),
      paragraphs: text.split(/\n+/).filter((line) => line.trim() !== '').length,
      sentences: countSentences(text),
      pages: Math.round((words / WORDS_PER_PAGE) * 10) / 10,
      readingMinutes: formatMinutes(words, READING_WORDS_PER_MINUTE),
      speakingMinutes: formatMinutes(words, SPEAKING_WORDS_PER_MINUTE),
    }
  }, [text])
  const rows: [string, MessageKey, number][] = [
    ['words', 'office.counter.words', stats.words],
    ['characters', 'office.counter.characters', stats.characters],
    ['characters-no-spaces', 'office.counter.charactersNoSpaces', stats.charactersWithoutSpaces],
    ['paragraphs', 'office.counter.paragraphs', stats.paragraphs],
    ['sentences', 'office.counter.sentences', stats.sentences],
    ['pages', 'office.counter.pages', stats.pages],
    ['reading', 'office.counter.reading', stats.readingMinutes],
    ['speaking', 'office.counter.speaking', stats.speakingMinutes],
  ]
  return (
    <div id="word-counter-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('office.counter.hint')}</p>
      <label className="block text-sm font-medium">
        {t('office.counter.textLabel')}
        <textarea id="word-counter-text-input" dir="auto" rows={10} value={text} onChange={(event) => setText(event.target.value)} className="mt-1 w-full rounded-[14px] border-2 border-rule bg-paper-raised p-3 text-start text-sm pointer-coarse:text-base" />
      </label>
      <dl id="word-counter-stats" aria-live="polite" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map(([id, labelKey, value]) => (
          <div key={id} id={`word-counter-${id}`} className="rounded-[14px] border-2 border-rule bg-paper-raised p-3 text-center">
            <dt className="text-xs text-ink-soft">{t(labelKey)}</dt>
            <dd className="type-h3 tabular-nums">{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      {readError && (
        <p id="tool-error" role="alert" className="text-center font-medium text-danger">
          {t(readError)}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Extract images

export function ExtractWordImages({ files, onResult }: ToolProps) {
  const task = useOfficeTask()
  const file = files[0]
  return (
    <OfficeToolLayout
      toolId="extract-word-images"
      hintKey="office.extractWord.hint"
      files={files.slice(0, 1)}
      task={task}
      buttonKey="office.extractImages.button"
      onRun={() =>
        void task.run(async () => {
          const images = await extractMediaFiles(await openWordPackage(file), 'word/media/')
          if (images.length === 0) throw new OfficeToolProblem('office.extractImages.none')
          onResult(await filesToResult(images, `${baseNameOf(file.name)}-images.zip`))
        })
      }
    />
  )
}

// ---------------------------------------------------------------- Watermark

const VML_NAMESPACES = { v: 'urn:schemas-microsoft-com:vml', o: 'urn:schemas-microsoft-com:office:office', w10: 'urn:schemas-microsoft-com:office:word', r: R }
const WATERMARK_COLORS: Record<WatermarkColor, string> = { silver: '#C0C0C0', red: '#C0392B', blue: '#2F5FD0' }

// Word's own text watermark: a WordArt shape in the header, behind the text, centred on the page.
function watermarkRunXml(text: string, color: WatermarkColor, layout: WatermarkLayout, shapeNumber: number) {
  const width = 468
  const height = Math.round(Math.min(117, (width / Math.max(text.length, 4)) * 1.6))
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:pict><v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype><v:shape id="PowerPlusWaterMarkObject${shapeNumber}" o:spid="_x0000_s${2049 + shapeNumber}" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:${width}pt;height:${height}pt;${layout === 'diagonal' ? 'rotation:315;' : ''}z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f" fillcolor="${WATERMARK_COLORS[color]}" stroked="f"><v:fill opacity=".5"/><v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="${escapeXmlText(text)}"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape></w:pict></w:r>`
}

async function addWordWatermark(zip: JSZip, text: string, color: WatermarkColor, layout: WatermarkLayout) {
  const documentXml = (await readXmlPart(zip, DOCUMENT))!
  const sections = wordElements(documentXml, 'sectPr').filter((section) => section.parentElement?.localName !== 'sectPrChange')
  const relationships = await readRelationships(zip, DOCUMENT)
  const headerPaths = new Set<string>()
  for (const reference of wordElements(documentXml, 'headerReference')) {
    const relationship = relationships.find((candidate) => candidate.id === reference.getAttributeNS(R, 'id'))
    if (relationship) headerPaths.add(resolveTarget(DOCUMENT, relationship.target))
  }
  // A section without its own default header uses the one before it; only the first section may need a new one.
  const firstSection = sections[0]
  if (firstSection && !wordElements(firstSection, 'headerReference').some((reference) => wordAttribute(reference, 'type') === 'default')) {
    let number = 1
    while (zip.file(`word/header${number}.xml`)) number++
    const headerPath = `word/header${number}.xml`
    zip.file(headerPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:hdr xmlns:w="${W}"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>`)
    await setContentType(zip, headerPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml')
    const id = await addRelationship(zip, DOCUMENT, `${RELATIONSHIP_TYPE}/header`, `header${number}.xml`)
    declareNamespaces(documentXml, { r: R })
    const reference = documentXml.createElementNS(W, 'w:headerReference')
    reference.setAttributeNS(W, 'w:type', 'default')
    reference.setAttributeNS(R, 'r:id', id)
    firstSection.insertBefore(reference, firstSection.firstChild)
    writeXmlPart(zip, DOCUMENT, documentXml)
    headerPaths.add(headerPath)
  }
  let shapeNumber = 1
  for (const headerPath of headerPaths) {
    const headerXml = await readXmlPart(zip, headerPath)
    if (!headerXml) continue
    declareNamespaces(headerXml, VML_NAMESPACES)
    const paragraph = wordElements(headerXml, 'p')[0] ?? headerXml.documentElement.appendChild(parseXmlElements(headerXml, '<w:p/>')[0])
    const [run] = parseXmlElements(headerXml, watermarkRunXml(text, color, layout, shapeNumber++))
    const properties = childElement(paragraph, 'pPr')
    paragraph.insertBefore(run, properties ? properties.nextSibling : paragraph.firstChild)
    writeXmlPart(zip, headerPath, headerXml)
  }
}

export function WatermarkWord({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const [text, setText] = useState(() => t('office.watermark.defaultText'))
  const [color, setColor] = useState<WatermarkColor>('silver')
  const [layout, setLayout] = useState<WatermarkLayout>('diagonal')
  const file = files[0]
  return (
    <OfficeToolLayout
      toolId="watermark-word"
      hintKey="office.watermarkWord.hint"
      files={files.slice(0, 1)}
      task={task}
      buttonKey="office.watermark.button"
      canRun={text.trim() !== ''}
      onRun={() =>
        void task.run(async () => {
          const zip = await openWordPackage(file)
          await addWordWatermark(zip, text.trim(), color, layout)
          onResult(await packageToFile(zip, `${baseNameOf(file.name)}-watermarked.docx`, WORD_TYPE))
        })
      }
    >
      <WatermarkFields idPrefix="watermark-word" text={text} onTextChange={setText} color={color} onColorChange={setColor} layout={layout} onLayoutChange={setLayout} />
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Mail merge

const FIELD_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g
const isDataFile = (file: File) => /\.(csv|tsv|txt|xlsx|xls|xlsm|ods)$/i.test(file.name)

// The data file's rows as text, the first row naming the columns.
async function readDataRows(file: File): Promise<string[][]> {
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const { default: Papa } = await import('papaparse')
    return Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' }).data
  }
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  return XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: '', blankrows: false })
}

// Word often splits a typed {{field}} across several runs (spell check, editing); each field is joined into one text element so
// it can be filled in by a plain text replacement. Returns the field names found.
async function joinTemplateFields(zip: JSZip) {
  const fieldNames = new Set<string>()
  for (const partPath of wordTextPartPaths(zip)) {
    const xml = (await readXmlPart(zip, partPath))!
    let hasFields = false
    for (const paragraph of wordElements(xml, 'p')) {
      const textElements = paragraphTextElements(paragraph)
      const text = textElements.map((textElement) => textElement.textContent ?? '').join('')
      const matches = Array.from(text.matchAll(FIELD_PATTERN))
      for (const match of matches.reverse()) {
        fieldNames.add(match[1])
        replaceTextRange(textElements, { start: match.index, end: match.index + match[0].length }, `{{${match[1]}}}`)
        hasFields = true
      }
    }
    if (hasFields) writeXmlPart(zip, partPath, xml)
  }
  return [...fieldNames]
}

async function mailMerge(template: File, dataFile: File, nameColumn: number) {
  const zip = await openWordPackage(template)
  await joinTemplateFields(zip)
  const [header, ...rows] = await readDataRows(dataFile)
  const partTexts = new Map(await Promise.all(wordTextPartPaths(zip).map(async (path) => [path, await zip.file(path)!.async('string')] as const)))
  const digits = Math.max(3, String(rows.length).length)
  const usedNames = new Set<string>()
  const documents: File[] = []
  for (const [rowIndex, row] of rows.entries()) {
    for (const [path, xml] of partTexts) {
      zip.file(path, xml.replace(FIELD_PATTERN, (field, name: string) => {
        const column = header.findIndex((columnName) => escapeXmlText(columnName.trim()) === name.trim())
        return column === -1 ? field : escapeXmlText(row[column] ?? '')
      }))
    }
    let name = safeFileName(nameColumn >= 0 ? (row[nameColumn] ?? '') : '', `document-${String(rowIndex + 1).padStart(digits, '0')}`)
    while (usedNames.has(name.toLowerCase())) name = `${name}-${rowIndex + 1}`
    usedNames.add(name.toLowerCase())
    documents.push(await packageToFile(zip, `${name}.docx`, WORD_TYPE))
  }
  return filesToResult(documents, `${baseNameOf(template.name)}-merged-documents.zip`)
}

export function WordMailMerge({ files, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const template = files.filter(isWordFile).at(-1)
  const dataFile = files.filter(isDataFile).at(-1)
  const [read, setRead] = useState<{ template: File; dataFile: File; fieldNames: string[]; columns: string[]; rowCount: number } | null>(null)
  const [nameColumn, setNameColumn] = useState(-1)
  const { setErrorKey } = task
  useEffect(() => {
    if (!template || !dataFile) return
    let isCurrent = true
    Promise.all([openWordPackage(template).then(joinTemplateFields), readDataRows(dataFile)])
      .then(([fieldNames, rows]) => isCurrent && setRead({ template, dataFile, fieldNames, columns: (rows[0] ?? []).map((name) => name.trim()), rowCount: Math.max(0, rows.length - 1) }))
      .catch((error: unknown) => isCurrent && setErrorKey(error instanceof OfficeToolProblem ? error.messageKey : 'office.failed'))
    return () => {
      isCurrent = false
    }
  }, [template, dataFile, setErrorKey])
  const shown = read?.template === template && read?.dataFile === dataFile ? read : null
  const missingFields = shown ? shown.fieldNames.filter((name) => !shown.columns.map(escapeXmlText).includes(name.trim())) : []
  return (
    <OfficeToolLayout
      toolId="word-mail-merge"
      hintKey="office.mailMerge.hint"
      files={[template, dataFile].filter((file): file is File => Boolean(file))}
      task={task}
      buttonKey="office.mailMerge.button"
      canRun={Boolean(shown && shown.fieldNames.length > 0 && shown.rowCount > 0)}
      onRun={() => void task.run(async () => onResult(await mailMerge(template!, dataFile!, nameColumn)))}
    >
      {(!template || !dataFile) && (
        <div className="space-y-2 text-center">
          <p id="mail-merge-need" className="text-sm">{t(!template ? 'office.mailMerge.needTemplate' : 'office.mailMerge.needData')}</p>
          <button id="mail-merge-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
            {t('office.addFiles')}
          </button>
        </div>
      )}
      {shown && (
        <div id="mail-merge-summary" className={panelClass}>
          <p>{shown.fieldNames.length === 0 ? t('office.mailMerge.noFields') : t('office.mailMerge.summary', { fields: shown.fieldNames.length, rows: shown.rowCount })}</p>
          {missingFields.length > 0 && (
            <p id="mail-merge-missing" className="text-danger">
              {t('office.mailMerge.missing')} <bdi>{missingFields.map((name) => `{{${name}}}`).join(', ')}</bdi>
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('office.mailMerge.nameColumn')}
            <select id="mail-merge-name-select" value={nameColumn} onChange={(event) => setNameColumn(Number(event.target.value))} className={fieldClass}>
              <option value={-1}>{t('office.mailMerge.numbered')}</option>
              {shown.columns.map((column, index) => (
                <option key={index} value={index}>
                  {column}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Metadata

export const WordMetadata = (props: ToolProps) => <OfficeMetadata {...props} toolId="word-metadata" />
