import type { EditingModule, ExportOption } from '../registry'

// The edit model of a text file. The whole edited text is kept (not each keystroke), together with how many lines differ
// from the original, so the change counter never has to compare two large texts again.
export type TextEdits = { text: string | null; changedLineCount: number }

// Everything the download needs besides the edits.
export type TextExportSource = { originalText: string; lineEnding: '\n' | '\r\n'; hadByteOrderMark: boolean }

export const createEmptyTextEdits = (): TextEdits => ({ text: null, changedLineCount: 0 })

export const countTextChanges = (edits: unknown) => (edits as TextEdits).changedLineCount

export function describeTextChanges(edits: unknown) {
  const { changedLineCount } = edits as TextEdits
  if (changedLineCount === 0) return ''
  return `${changedLineCount.toLocaleString()} changed ${changedLineCount === 1 ? 'line' : 'lines'}`
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
  if (editedText === originalText) return createEmptyTextEdits()
  return { text: editedText, changedLineCount: countChangedLines(originalText, editedText) }
}

// The text as it will be saved: the edits applied, with the file's own line endings.
export function buildTextDownload(edits: TextEdits, source: TextExportSource, includeByteOrderMark: boolean) {
  const text = (edits.text ?? source.originalText).replace(/\n/g, source.lineEnding)
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
