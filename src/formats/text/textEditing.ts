import type { EditingModule, ExportOption } from '../registry'
import type { TextViewActions, TextViewSettings } from './textViewTools'

// The edit model of a text file. The whole edited text is kept (not each keystroke), together with how many lines differ
// from the original, so the change counter never has to compare two large texts again.
//
// `lineEnding` is set only when the visitor chose another line ending than the file has; the download then uses it.
export type TextEdits = { text: string | null; changedLineCount: number; lineEnding?: '\n' | '\r\n' }

// What the toolbar needs to know about the text box and the file.
export type TextSelection = { hasSelection: boolean; lineEnding: '\n' | '\r\n'; view: TextViewSettings } | null

// Things the toolbar can ask the viewer to do.
export type TextViewerCommands = {
  toggleFindReplace: () => void
  // The viewer's actions as they are now, read when a toolbar item is chosen.
  getActions: () => TextActions
}

export type TextActions = TextViewActions & {
  transform: (kind: TextTransformKind) => void
  setLineEnding: (lineEnding: '\n' | '\r\n') => void
}

// Everything the download needs besides the edits.
export type TextExportSource = { originalText: string; lineEnding: '\n' | '\r\n'; hadByteOrderMark: boolean }

export const createEmptyTextEdits = (): TextEdits => ({ text: null, changedLineCount: 0 })

export const countTextChanges = (edits: unknown) => (edits as TextEdits).changedLineCount + ((edits as TextEdits).lineEnding ? 1 : 0)

export function describeTextChanges(edits: unknown) {
  const { changedLineCount, lineEnding } = edits as TextEdits
  const changedLines = changedLineCount > 0 ? `${changedLineCount.toLocaleString()} changed ${changedLineCount === 1 ? 'line' : 'lines'}` : ''
  const changedLineEnding = lineEnding ? `line endings ${lineEnding === '\r\n' ? 'CRLF' : 'LF'}` : ''
  return [changedLines, changedLineEnding].filter(Boolean).join(', ')
}

// Lines that differ at the same position, plus the lines added or removed at the end.
function countChangedLines(originalText: string, editedText: string) {
  const originalLines = originalText.split('\n')
  const editedLines = editedText.split('\n')
  let changedLineCount = Math.abs(originalLines.length - editedLines.length)
  const sharedLineCount = Math.min(originalLines.length, editedLines.length)
  for (let lineNumber = 0; lineNumber < sharedLineCount; lineNumber++) {
    if (originalLines[lineNumber] !== editedLines[lineNumber]) changedLineCount++
  }
  return changedLineCount
}

// The edits after the text became `editedText`; the same object when nothing changes, so no empty undo step is recorded.
export function withEditedText(currentEdits: TextEdits, originalText: string, editedText: string): TextEdits {
  if (editedText === (currentEdits.text ?? originalText)) return currentEdits
  if (editedText === originalText) return { ...currentEdits, text: null, changedLineCount: 0 }
  return { ...currentEdits, text: editedText, changedLineCount: countChangedLines(originalText, editedText) }
}

// The edits with another line ending for the download; choosing the file's own line ending again removes the change.
export function withLineEnding(currentEdits: TextEdits, sourceLineEnding: '\n' | '\r\n', lineEnding: '\n' | '\r\n'): TextEdits {
  if (lineEnding === (currentEdits.lineEnding ?? sourceLineEnding)) return currentEdits
  return lineEnding === sourceLineEnding ? { ...currentEdits, lineEnding: undefined } : { ...currentEdits, lineEnding }
}

// The text as it will be saved: the edits applied, with the file's own line endings.
export function buildTextDownload(edits: TextEdits, source: TextExportSource, includeByteOrderMark: boolean) {
  const text = (edits.text ?? source.originalText).replace(/\n/g, edits.lineEnding ?? source.lineEnding)
  return includeByteOrderMark ? `﻿${text}` : text
}

const downloadOption: ExportOption = {
  id: 'txt',
  getLabel: () => 'Download TXT',
  extension: null,
  getMimeType: () => 'text/plain;charset=utf-8',
  createFile: (edits, exportSource, settings) => buildTextDownload(edits as TextEdits, exportSource as TextExportSource, settings.includeByteOrderMark),
}

export const textEditingModule: EditingModule = {
  tools: [],
  downloadOption,
  describeDownload: (exportSource) => `${(exportSource as TextExportSource).originalText.length.toLocaleString()} characters`,
  getDefaultByteOrderMark: (exportSource) => (exportSource as TextExportSource).hadByteOrderMark,
  components: null,
}

// ---------------------------------------------------------------- toolbar transforms

export type TextTransformKind =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'trimTrailingSpaces'
  | 'trimExtraSpaces'
  | 'removeBlankLines'
  | 'collapseBlankLines'
  | 'sortAscending'
  | 'sortDescending'
  | 'reverseLines'
  | 'removeDuplicateLines'
  | 'joinLines'
  | 'indent'
  | 'outdent'
  | 'insertDateTime'

export type TextTransformResult = { text: string; selectionStart: number; selectionEnd: number }

const lineCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const characterTransforms: Partial<Record<TextTransformKind, (text: string) => string>> = {
  upper: (text) => text.toLocaleUpperCase(),
  lower: (text) => text.toLocaleLowerCase(),
  title: (text) => text.toLocaleLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase()),
  sentence: (text) => text.toLocaleLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase()),
}

const lineTransforms: Partial<Record<TextTransformKind, (lines: string[]) => string[]>> = {
  trimTrailingSpaces: (lines) => lines.map((line) => line.replace(/[ \t]+$/, '')),
  trimExtraSpaces: (lines) => lines.map((line) => line.trim().replace(/[ \t]+/g, ' ')),
  removeBlankLines: (lines) => lines.filter((line) => line.trim() !== ''),
  collapseBlankLines: (lines) => lines.filter((line, position) => line.trim() !== '' || position === 0 || lines[position - 1].trim() !== ''),
  sortAscending: (lines) => lines.slice().sort(lineCollator.compare),
  sortDescending: (lines) => lines.slice().sort((firstLine, secondLine) => lineCollator.compare(secondLine, firstLine)),
  reverseLines: (lines) => lines.slice().reverse(),
  removeDuplicateLines: (lines) => lines.filter((line, position) => lines.indexOf(line) === position),
  joinLines: (lines) => [lines.map((line) => line.trim()).filter((line) => line !== '').join(' ')],
  indent: (lines) => lines.map((line) => (line === '' ? line : `\t${line}`)),
  outdent: (lines) => lines.map((line) => line.replace(/^(\t| {1,4})/, '')),
}

function pad(number: number) {
  return String(number).padStart(2, '0')
}

// Applies a toolbar transform to the selected text (character changes) or the lines the selection touches (line changes);
// with nothing selected it applies to the whole text. Returns the new text and where the selection should be.
export function applyTextTransform(text: string, selectionStart: number, selectionEnd: number, kind: TextTransformKind, now = new Date()): TextTransformResult {
  if (kind === 'insertDateTime') {
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    const caret = selectionStart + stamp.length
    return { text: text.slice(0, selectionStart) + stamp + text.slice(selectionEnd), selectionStart: caret, selectionEnd: caret }
  }
  const hasSelection = selectionEnd > selectionStart
  const characterTransform = characterTransforms[kind]
  if (characterTransform) {
    const from = hasSelection ? selectionStart : 0
    const to = hasSelection ? selectionEnd : text.length
    const changed = characterTransform(text.slice(from, to))
    return { text: text.slice(0, from) + changed + text.slice(to), selectionStart: hasSelection ? from : selectionStart, selectionEnd: hasSelection ? from + changed.length : selectionEnd }
  }
  const lineTransform = lineTransforms[kind]
  if (!lineTransform) return { text, selectionStart, selectionEnd }
  const regionStart = hasSelection ? text.lastIndexOf('\n', selectionStart - 1) + 1 : 0
  const lastSelectedCharacter = hasSelection && text[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd
  const nextLineBreak = hasSelection ? text.indexOf('\n', lastSelectedCharacter) : -1
  const regionEnd = hasSelection ? (nextLineBreak === -1 ? text.length : nextLineBreak) : text.length
  const lines = text.slice(regionStart, regionEnd).split('\n')
  // A final line break ends the last line; it does not start another one, so it is kept out of the sort and put back.
  const endsWithLineBreak = !hasSelection && lines.length > 1 && lines[lines.length - 1] === ''
  if (endsWithLineBreak) lines.pop()
  const changedRegion = lineTransform(lines).join('\n') + (endsWithLineBreak ? '\n' : '')
  const newText = text.slice(0, regionStart) + changedRegion + text.slice(regionEnd)
  return hasSelection
    ? { text: newText, selectionStart: regionStart, selectionEnd: regionStart + changedRegion.length }
    : { text: newText, selectionStart: Math.min(selectionStart, newText.length), selectionEnd: Math.min(selectionEnd, newText.length) }
}

// ---------------------------------------------------------------- find and replace

export function findTextMatches(text: string, findText: string, matchCase: boolean) {
  const matchStarts: number[] = []
  if (findText === '') return matchStarts
  const searchedText = matchCase ? text : text.toLowerCase()
  const searchedFind = matchCase ? findText : findText.toLowerCase()
  for (let start = searchedText.indexOf(searchedFind); start !== -1; start = searchedText.indexOf(searchedFind, start + searchedFind.length)) matchStarts.push(start)
  return matchStarts
}

export function replaceAllTextMatches(text: string, findText: string, replacement: string, matchCase: boolean) {
  if (findText === '') return text
  if (matchCase) return text.split(findText).join(replacement)
  const escapedFindText = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escapedFindText, 'gi'), () => replacement)
}
