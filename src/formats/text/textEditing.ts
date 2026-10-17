import { translate, translatePlural } from '../../i18n'
import type { Locale, MessageKey } from '../../i18n'
import { CHARACTER_TOOL_IDS, transformLines } from './textTools'
import type { TextToolId, TextToolOptions, TextTransformId } from './textTools'

export type TextLineEnding = '\n' | '\r\n' | '\r'
export type LineEndingCounts = { crlf: number; lf: number; cr: number }

// The edit model of a text file. The whole edited text is kept (not each keystroke), together with how many lines differ
// from the original, so the change counter never has to compare two large texts again.
//
// `lineEnding` is set only when the visitor chose another line ending than the file has (or fixed mixed ones); the download
// then uses it.
export type TextEdits = { text: string | null; changedLineCount: number; lineEnding?: TextLineEnding }

// Everything the download needs besides the edits. `lineEnding` is the file's most common line ending.
export type TextExportSource = { originalText: string; lineEnding: TextLineEnding; lineEndingCounts: LineEndingCounts; hadByteOrderMark: boolean }

export const createEmptyTextEdits = (): TextEdits => ({ text: null, changedLineCount: 0 })

export const countTextChanges = (edits: unknown) => (edits as TextEdits).changedLineCount + ((edits as TextEdits).lineEnding ? 1 : 0)

const LINE_ENDING_NAMES: Record<TextLineEnding, string> = { '\n': 'LF', '\r\n': 'CRLF', '\r': 'CR' }

export function describeTextChanges(edits: unknown, locale: Locale) {
  const { changedLineCount, lineEnding } = edits as TextEdits
  const changedLines = changedLineCount > 0 ? translatePlural(locale, 'text.changes.lines', changedLineCount) : ''
  const changedLineEnding = lineEnding ? translate(locale, 'text.changes.lineEnding', { type: LINE_ENDING_NAMES[lineEnding] }) : ''
  return [changedLines, changedLineEnding].filter(Boolean).join(locale === 'ar' ? '، ' : ', ')
}

// Lines that differ at the same position, plus the lines added or removed at the end.
function countDifferentLines(originalLines: string[], editedLines: string[]) {
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
  return { ...currentEdits, text: editedText, changedLineCount: countDifferentLines(originalText.split('\n'), editedText.split('\n')) }
}

// The edits with another line ending for the download; choosing the file's own line ending again removes the change, unless the
// file had mixed line endings: then choosing one is the fix, and stays a change.
export function withLineEnding(currentEdits: TextEdits, sourceLineEnding: TextLineEnding, lineEnding: TextLineEnding, sourceHasMixedLineEndings = false): TextEdits {
  if (lineEnding === currentEdits.lineEnding || (lineEnding === sourceLineEnding && !currentEdits.lineEnding && !sourceHasMixedLineEndings)) return currentEdits
  return lineEnding === sourceLineEnding && !sourceHasMixedLineEndings ? { ...currentEdits, lineEnding: undefined } : { ...currentEdits, lineEnding }
}

// ---------------------------------------------------------------- reading

export function countLineEndings(text: string): LineEndingCounts {
  const counts = { crlf: 0, lf: 0, cr: 0 }
  for (let position = 0; position < text.length; position++) {
    const characterCode = text.charCodeAt(position)
    if (characterCode === 10) counts.lf++
    else if (characterCode === 13) {
      if (text.charCodeAt(position + 1) === 10) {
        counts.crlf++
        position++
      } else counts.cr++
    }
  }
  return counts
}

export const hasMixedLineEndings = (counts: LineEndingCounts) => [counts.crlf, counts.lf, counts.cr].filter((count) => count > 0).length > 1

function mostCommonLineEnding(counts: LineEndingCounts): TextLineEnding {
  if (counts.crlf >= counts.lf && counts.crlf >= counts.cr && counts.crlf > 0) return '\r\n'
  return counts.cr > counts.lf ? '\r' : '\n'
}

// 'auto' finds the encoding (byte order mark, then UTF-8, else Windows-1256); the others read the bytes as that encoding.
export type EncodingChoice = 'auto' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1256' | 'iso-8859-1'

export const ENCODING_LABELS: Record<Exclude<EncodingChoice, 'auto'>, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  'windows-1256': 'Windows-1256',
  'iso-8859-1': 'ISO-8859-1',
}

const BINARY_CHECK_BYTE_COUNT = 64 * 1024

export function decodeTextBytes(fileContents: ArrayBuffer, encodingChoice: EncodingChoice = 'auto') {
  const bytes = new Uint8Array(fileContents)
  if (encodingChoice !== 'auto') return { text: new TextDecoder(encodingChoice).decode(bytes), encodingLabel: ENCODING_LABELS[encodingChoice] }

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes), encodingLabel: 'UTF-8 with BOM' }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes), encodingLabel: 'UTF-16 LE' }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes), encodingLabel: 'UTF-16 BE' }
  }

  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encodingLabel: 'UTF-8' }
  } catch {
    return {
      text: new TextDecoder('windows-1256').decode(bytes),
      encodingLabel: 'Windows-1256 (the file was not valid UTF-8)',
    }
  }
}

export function looksLikeBinary(fileContents: ArrayBuffer) {
  const bytes = new Uint8Array(fileContents, 0, Math.min(fileContents.byteLength, BINARY_CHECK_BYTE_COUNT))
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
  return !isUtf16 && bytes.includes(0)
}

export type ReadableText = ({ status: 'ok'; encodingLabel: string } & TextExportSource) | { status: 'error'; messageKey: MessageKey }

// The file's text with every line ending turned into `\n`. 'auto' finds the encoding; another choice reopens the same bytes
// with that encoding.
export function readTextFile(fileContents: ArrayBuffer, encodingChoice: EncodingChoice = 'auto'): ReadableText {
  if (fileContents.byteLength === 0) return { status: 'error', messageKey: 'text.error.empty' }
  // UTF-16 without a byte order mark is full of zero bytes, so a chosen UTF-16 is not checked for binary.
  if (!encodingChoice.startsWith('utf-16') && looksLikeBinary(fileContents)) {
    return { status: 'error', messageKey: 'text.error.binary' }
  }

  const { text, encodingLabel } = decodeTextBytes(fileContents, encodingChoice)
  if (text.trim() === '') return { status: 'error', messageKey: 'text.error.empty' }

  const lineEndingCounts = countLineEndings(text)
  return {
    status: 'ok',
    originalText: text.replace(/\r\n|\r/g, '\n'),
    lineEnding: mostCommonLineEnding(lineEndingCounts),
    lineEndingCounts,
    hadByteOrderMark: new Uint8Array(fileContents, 0, Math.min(3, fileContents.byteLength)).join(',') === '239,187,191',
    encodingLabel,
  }
}

// ---------------------------------------------------------------- download and encodings

export type TextDownloadEncoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'windows-1256'

// Windows-1256 byte of each character above ASCII, taken from the browser's own decoder.
let windows1256ByteByCharacterCode: Map<number, number> | null = null

function encodeWindows1256(text: string) {
  if (!windows1256ByteByCharacterCode) {
    windows1256ByteByCharacterCode = new Map()
    const decoder = new TextDecoder('windows-1256')
    for (let byte = 0x80; byte <= 0xff; byte++) {
      const character = decoder.decode(new Uint8Array([byte]))
      if (character !== '�') windows1256ByteByCharacterCode.set(character.charCodeAt(0), byte)
    }
  }
  const bytes = new Uint8Array(text.length)
  let byteCount = 0
  let unencodableCount = 0
  for (let position = 0; position < text.length; position++) {
    const characterCode = text.charCodeAt(position)
    const byte = characterCode < 0x80 ? characterCode : windows1256ByteByCharacterCode.get(characterCode)
    if (byte !== undefined) {
      bytes[byteCount++] = byte
      continue
    }
    // A character outside the table becomes '?'; a surrogate pair is one character.
    if (characterCode >= 0xd800 && characterCode <= 0xdbff) position++
    unencodableCount++
    bytes[byteCount++] = 0x3f
  }
  return { bytes: bytes.slice(0, byteCount), unencodableCount }
}

// `unencodableCount` is how many characters the encoding cannot store (only Windows-1256 can have any); they are saved as '?'.
export function encodeText(text: string, encoding: TextDownloadEncoding): { bytes: Uint8Array<ArrayBuffer>; unencodableCount: number } {
  if (encoding === 'windows-1256') return encodeWindows1256(text)
  if (encoding === 'utf-16le') {
    const bytes = new Uint8Array(2 + text.length * 2)
    bytes[0] = 0xff
    bytes[1] = 0xfe
    for (let position = 0; position < text.length; position++) {
      const characterCode = text.charCodeAt(position)
      bytes[2 + position * 2] = characterCode & 0xff
      bytes[3 + position * 2] = characterCode >> 8
    }
    return { bytes, unencodableCount: 0 }
  }
  const utf8Bytes = new TextEncoder().encode(text)
  if (encoding === 'utf-8') return { bytes: utf8Bytes, unencodableCount: 0 }
  const bytes = new Uint8Array(3 + utf8Bytes.length)
  bytes.set([0xef, 0xbb, 0xbf])
  bytes.set(utf8Bytes, 3)
  return { bytes, unencodableCount: 0 }
}

// The file as it will be saved: the edits applied, with the chosen line ending (else the edits' or the file's own).
export function buildTextDownload(edits: TextEdits, source: TextExportSource, { encoding, lineEnding }: { encoding: TextDownloadEncoding; lineEnding?: TextLineEnding }) {
  const text = (edits.text ?? source.originalText).replace(/\n/g, lineEnding ?? edits.lineEnding ?? source.lineEnding)
  return encodeText(text, encoding)
}

// ---------------------------------------------------------------- transforms and the chain

export type TextTransformResult = { text: string; selectionStart: number; selectionEnd: number }

// The whole lines a selection touches, as text offsets (`end` is before the last line's break). A selection that ends just
// after a line break leaves the next line out. With nothing selected it is the whole text, without its final line break, which
// ends the last line rather than starting another one.
export function findSelectedLineRegion(text: string, selectionStart: number, selectionEnd: number) {
  if (selectionEnd <= selectionStart) return { start: 0, end: text.endsWith('\n') ? text.length - 1 : text.length }
  const lastSelectedCharacter = text[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd
  const nextLineBreak = text.indexOf('\n', lastSelectedCharacter)
  return { start: selectionStart === 0 ? 0 : text.lastIndexOf('\n', selectionStart - 1) + 1, end: nextLineBreak === -1 ? text.length : nextLineBreak }
}

function replaceRegionLines(text: string, region: { start: number; end: number }, changeLines: (lines: string[]) => string[]) {
  const changedRegion = changeLines(text.slice(region.start, region.end).split('\n')).join('\n')
  return { text: text.slice(0, region.start) + changedRegion + text.slice(region.end), changedRegionEnd: region.start + changedRegion.length }
}

function pad(number: number) {
  return String(number).padStart(2, '0')
}

// Applies a tool to the selected text (character tools) or the lines the selection touches (line tools); with nothing selected
// it applies to the whole text. Returns the new text (the same string when nothing changes) and where the selection should be.
export function applyTextTransform(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  toolId: TextToolId,
  options: TextToolOptions = {},
  now = new Date(),
): TextTransformResult {
  if (toolId === 'insertDateTime') {
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    const caret = selectionStart + stamp.length
    return { text: text.slice(0, selectionStart) + stamp + text.slice(selectionEnd), selectionStart: caret, selectionEnd: caret }
  }
  const hasSelection = selectionEnd > selectionStart
  if (hasSelection && CHARACTER_TOOL_IDS.has(toolId)) {
    const selectedText = text.slice(selectionStart, selectionEnd)
    const changed = transformLines(selectedText.split('\n'), toolId, options).join('\n')
    if (changed === selectedText) return { text, selectionStart, selectionEnd }
    return { text: text.slice(0, selectionStart) + changed + text.slice(selectionEnd), selectionStart, selectionEnd: selectionStart + changed.length }
  }
  const region = findSelectedLineRegion(text, selectionStart, selectionEnd)
  const result = replaceRegionLines(text, region, (lines) => transformLines(lines, toolId, options))
  if (result.text === text) return { text, selectionStart, selectionEnd }
  return hasSelection
    ? { text: result.text, selectionStart: region.start, selectionEnd: result.changedRegionEnd }
    : { text: result.text, selectionStart: Math.min(selectionStart, result.text.length), selectionEnd: Math.min(selectionEnd, result.text.length) }
}

export type TextChainStep = { toolId: TextTransformId; options?: TextToolOptions; enabled: boolean }

// Runs the enabled steps in order on the selected lines (or the whole text); the page records the result as one undo step.
// `changedLineCounts` has one number per step: how many lines that step changed (0 for a step that is off).
export function applyToolChain(text: string, steps: TextChainStep[], selection?: { start: number; end: number }) {
  const changedLineCounts: number[] = []
  const region = findSelectedLineRegion(text, selection?.start ?? 0, selection?.end ?? 0)
  const result = replaceRegionLines(text, region, (lines) =>
    steps.reduce((currentLines, step) => {
      if (!step.enabled) {
        changedLineCounts.push(0)
        return currentLines
      }
      const changedLines = transformLines(currentLines, step.toolId, step.options)
      changedLineCounts.push(countDifferentLines(currentLines, changedLines))
      return changedLines
    }, lines),
  )
  return { text: result.text === text ? text : result.text, changedLineCounts }
}

// ---------------------------------------------------------------- find and replace

export type FindQuery = { query: string; isRegex: boolean; matchCase: boolean; wholeWord: boolean }
export type FindPatternError = 'emptyQuery' | 'invalidPattern'
// Line and columns start at 0; `offset` is where the match starts in the whole text.
export type TextMatch = { line: number; start: number; end: number; offset: number }

export function buildFindPattern({ query, isRegex, matchCase, wholeWord }: FindQuery): RegExp | FindPatternError {
  if (query === '') return 'emptyQuery'
  let source = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`
  try {
    return new RegExp(source, matchCase ? 'gu' : 'giu')
  } catch {
    return 'invalidPattern'
  }
}

// Every non-empty match, line by line (a match never spans a line break), in the lines the selection touches or the whole text.
export function findTextMatches(text: string, pattern: RegExp, selection?: { start: number; end: number }) {
  const region = findSelectedLineRegion(text, selection?.start ?? 0, selection?.end ?? 0)
  const lineMatcher = new RegExp(pattern.source, pattern.flags)
  const matches: TextMatch[] = []
  let line = 0
  for (let position = text.indexOf('\n'); position !== -1 && position < region.start; position = text.indexOf('\n', position + 1)) line++
  for (let lineStart = region.start; lineStart <= region.end; line++) {
    const lineBreak = text.indexOf('\n', lineStart)
    const lineEnd = lineBreak === -1 || lineBreak > region.end ? region.end : lineBreak
    const lineText = text.slice(lineStart, lineEnd)
    lineMatcher.lastIndex = 0
    for (let found = lineMatcher.exec(lineText); found; found = lineMatcher.exec(lineText)) {
      if (found[0] === '') {
        lineMatcher.lastIndex++
        continue
      }
      matches.push({ line, start: found.index, end: found.index + found[0].length, offset: lineStart + found.index })
    }
    lineStart = lineEnd + 1
  }
  return matches
}

// The replacement text: `$1`..`$9` and `$&` take the matched groups (regex only); `\n`, `\t` and `\\` are a line break, a tab and
// a backslash in both modes.
function expandReplacement(replacement: string, matchedText: string, groups: (string | undefined)[], isRegex: boolean) {
  return replacement.replace(/\$(\d|&)|\\(n|t|\\)/g, (sequence, groupCode?: string, escapeCode?: string) => {
    if (escapeCode) return escapeCode === 'n' ? '\n' : escapeCode === 't' ? '\t' : '\\'
    if (!isRegex) return sequence
    return groupCode === '&' ? matchedText : (groups[Number(groupCode) - 1] ?? '')
  })
}

// Replaces one match found by `findTextMatches`; the selection covers the replacement.
export function replaceTextMatch(text: string, pattern: RegExp, match: TextMatch, replacement: string, isRegex: boolean): TextTransformResult {
  const lineStart = match.offset - match.start
  const lineBreak = text.indexOf('\n', lineStart)
  const lineText = text.slice(lineStart, lineBreak === -1 ? text.length : lineBreak)
  const lineMatcher = new RegExp(pattern.source, pattern.flags)
  lineMatcher.lastIndex = match.start
  const found = lineMatcher.exec(lineText)
  if (!found || found.index !== match.start) return { text, selectionStart: match.offset, selectionEnd: match.offset }
  const replacementText = expandReplacement(replacement, found[0], found.slice(1), isRegex)
  return {
    text: text.slice(0, match.offset) + replacementText + text.slice(match.offset + found[0].length),
    selectionStart: match.offset,
    selectionEnd: match.offset + replacementText.length,
  }
}

export function replaceAllTextMatches(text: string, pattern: RegExp, replacement: string, isRegex: boolean, selection?: { start: number; end: number }) {
  let replacedCount = 0
  const region = findSelectedLineRegion(text, selection?.start ?? 0, selection?.end ?? 0)
  const result = replaceRegionLines(text, region, (lines) =>
    lines.map((line) =>
      line.replace(pattern, (matchedText: string, ...rest: unknown[]) => {
        replacedCount++
        const groups = rest.slice(0, rest.findIndex((item) => typeof item === 'number')) as (string | undefined)[]
        return expandReplacement(replacement, matchedText, groups, isRegex)
      }),
    ),
  )
  return { text: result.text === text ? text : result.text, replacedCount }
}

// Keeps (or removes) the lines with a match, in the lines the selection touches or the whole text.
export function filterLinesByPattern(text: string, pattern: RegExp, keepMatchingLines: boolean, selection?: { start: number; end: number }) {
  const lineMatcher = new RegExp(pattern.source, pattern.flags)
  const region = findSelectedLineRegion(text, selection?.start ?? 0, selection?.end ?? 0)
  const result = replaceRegionLines(text, region, (lines) =>
    lines.filter((line) => {
      lineMatcher.lastIndex = 0
      return lineMatcher.test(line) === keepMatchingLines
    }),
  )
  return result.text === text ? text : result.text
}

// How often a piece of text (for example the selection, line breaks included) occurs in the whole text.
export function countOccurrences(text: string, searchedText: string, matchCase: boolean) {
  const pattern = buildFindPattern({ query: searchedText, isRegex: false, matchCase, wholeWord: false })
  if (typeof pattern === 'string') return 0
  let occurrenceCount = 0
  while (pattern.exec(text)) occurrenceCount++
  return occurrenceCount
}

// ---------------------------------------------------------------- compare with the original

export type DiffRange = { start: number; end: number }
// Line numbers start at 0. A changed row pairs a removed and an added line, with the characters that differ in each.
export type TextDiffRow =
  | { kind: 'removed'; originalLine: number }
  | { kind: 'added'; currentLine: number }
  | { kind: 'changed'; originalLine: number; currentLine: number; originalRange: DiffRange; currentRange: DiffRange }
// The lines between two hunks (and before the first, after the last) are equal; ends are exclusive.
export type TextDiffHunk = { originalStart: number; originalEnd: number; currentStart: number; currentEnd: number; rows: TextDiffRow[] }
export type TextDiff = {
  originalLines: string[]
  currentLines: string[]
  hunks: TextDiffHunk[]
  removedLineCount: number
  addedLineCount: number
  // Where "Go to" lands: each added or changed line, and for a removal the line now at its place.
  changedLineNumbers: number[]
  // The lines differ in too many places to work out each change; the whole differing middle is one hunk.
  tooManyChanges: boolean
}

// Above this many removed plus added lines the exact diff (its time and memory grow with the square of it) is skipped.
const MAX_DIFF_EDIT_COUNT = 2000

export function splitIntoLines(text: string) {
  const lines = text.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

// Myers' diff of two lists of line ids: for each original line whether it is kept, and for each current line whether it is
// kept. Null when more than `maxEditCount` lines would be removed or added.
function diffLineIds(originalIds: Int32Array, currentIds: Int32Array, maxEditCount: number) {
  const originalCount = originalIds.length
  const currentCount = currentIds.length
  const editLimit = Math.min(originalCount + currentCount, maxEditCount)
  const offset = editLimit + 1
  const furthest = new Int32Array(2 * editLimit + 3)
  const history: Int32Array[] = []
  let editCount = -1
  for (let edits = 0; edits <= editLimit && editCount === -1; edits++) {
    for (let diagonal = -edits; diagonal <= edits; diagonal += 2) {
      const goesDown = diagonal === -edits || (diagonal !== edits && furthest[offset + diagonal - 1] < furthest[offset + diagonal + 1])
      let originalPosition = goesDown ? furthest[offset + diagonal + 1] : furthest[offset + diagonal - 1] + 1
      let currentPosition = originalPosition - diagonal
      while (originalPosition < originalCount && currentPosition < currentCount && originalIds[originalPosition] === currentIds[currentPosition]) {
        originalPosition++
        currentPosition++
      }
      furthest[offset + diagonal] = originalPosition
      if (originalPosition >= originalCount && currentPosition >= currentCount) editCount = edits
    }
    history.push(furthest.slice(offset - edits, offset + edits + 1))
  }
  if (editCount === -1) return null

  const originalKept = new Uint8Array(originalCount).fill(1)
  const currentKept = new Uint8Array(currentCount).fill(1)
  let originalPosition = originalCount
  let currentPosition = currentCount
  for (let edits = editCount; edits > 0; edits--) {
    const previous = history[edits - 1]
    const diagonal = originalPosition - currentPosition
    const cameDown = diagonal === -edits || (diagonal !== edits && previous[diagonal - 1 + edits - 1] < previous[diagonal + 1 + edits - 1])
    const previousDiagonal = cameDown ? diagonal + 1 : diagonal - 1
    const previousOriginalPosition = previous[previousDiagonal + edits - 1]
    const previousCurrentPosition = previousOriginalPosition - previousDiagonal
    if (cameDown) currentKept[previousCurrentPosition] = 0
    else originalKept[previousOriginalPosition] = 0
    originalPosition = previousOriginalPosition
    currentPosition = previousCurrentPosition
  }
  return { originalKept, currentKept }
}

// The characters that differ between two lines: what is left after their shared start and end.
function findChangedRanges(originalLine: string, currentLine: string) {
  let sharedStart = 0
  while (sharedStart < originalLine.length && sharedStart < currentLine.length && originalLine[sharedStart] === currentLine[sharedStart]) sharedStart++
  let sharedEnd = 0
  while (
    sharedEnd < originalLine.length - sharedStart &&
    sharedEnd < currentLine.length - sharedStart &&
    originalLine[originalLine.length - 1 - sharedEnd] === currentLine[currentLine.length - 1 - sharedEnd]
  )
    sharedEnd++
  return { originalRange: { start: sharedStart, end: originalLine.length - sharedEnd }, currentRange: { start: sharedStart, end: currentLine.length - sharedEnd } }
}

export function diffLines(originalText: string, currentText: string, { ignoreWhitespace = false, ignoreCase = false } = {}): TextDiff {
  const originalLines = splitIntoLines(originalText)
  const currentLines = splitIntoLines(currentText)
  const lineIds = new Map<string, number>()
  const toIds = (lines: string[]) =>
    Int32Array.from(lines, (line) => {
      let comparedLine = ignoreWhitespace ? line.replace(/\s+/g, ' ').trim() : line
      if (ignoreCase) comparedLine = comparedLine.toLowerCase()
      let id = lineIds.get(comparedLine)
      if (id === undefined) lineIds.set(comparedLine, (id = lineIds.size))
      return id
    })
  const originalIds = toIds(originalLines)
  const currentIds = toIds(currentLines)

  // The shared first and last lines are left out of the diff, so a few edits in a large file stay quick.
  let sharedStart = 0
  while (sharedStart < originalIds.length && sharedStart < currentIds.length && originalIds[sharedStart] === currentIds[sharedStart]) sharedStart++
  let sharedEnd = 0
  while (
    sharedEnd < originalIds.length - sharedStart &&
    sharedEnd < currentIds.length - sharedStart &&
    originalIds[originalIds.length - 1 - sharedEnd] === currentIds[currentIds.length - 1 - sharedEnd]
  )
    sharedEnd++
  const originalMiddle = originalIds.subarray(sharedStart, originalIds.length - sharedEnd)
  const currentMiddle = currentIds.subarray(sharedStart, currentIds.length - sharedEnd)
  const exactDiff = diffLineIds(originalMiddle, currentMiddle, MAX_DIFF_EDIT_COUNT)
  const kept = exactDiff ?? {
    originalKept: new Uint8Array(originalMiddle.length),
    currentKept: new Uint8Array(currentMiddle.length),
  }

  const hunks: TextDiffHunk[] = []
  const changedLineNumbers: number[] = []
  let removedLineCount = 0
  let addedLineCount = 0
  let originalPosition = 0
  let currentPosition = 0
  while (originalPosition < originalMiddle.length || currentPosition < currentMiddle.length) {
    if (kept.originalKept[originalPosition] && kept.currentKept[currentPosition]) {
      originalPosition++
      currentPosition++
      continue
    }
    const hunkOriginalStart = originalPosition
    const hunkCurrentStart = currentPosition
    while (originalPosition < originalMiddle.length && !kept.originalKept[originalPosition]) originalPosition++
    while (currentPosition < currentMiddle.length && !kept.currentKept[currentPosition]) currentPosition++
    const removedCount = originalPosition - hunkOriginalStart
    const addedCount = currentPosition - hunkCurrentStart
    removedLineCount += removedCount
    addedLineCount += addedCount
    const rows: TextDiffRow[] = []
    for (let rowPosition = 0; rowPosition < Math.max(removedCount, addedCount); rowPosition++) {
      const originalLine = sharedStart + hunkOriginalStart + rowPosition
      const currentLine = sharedStart + hunkCurrentStart + rowPosition
      if (rowPosition < removedCount && rowPosition < addedCount) {
        rows.push({ kind: 'changed', originalLine, currentLine, ...findChangedRanges(originalLines[originalLine], currentLines[currentLine]) })
      } else if (rowPosition < removedCount) rows.push({ kind: 'removed', originalLine })
      else rows.push({ kind: 'added', currentLine })
      if (rowPosition < addedCount) changedLineNumbers.push(currentLine)
    }
    if (addedCount === 0) changedLineNumbers.push(Math.min(sharedStart + hunkCurrentStart, Math.max(currentLines.length - 1, 0)))
    hunks.push({
      originalStart: sharedStart + hunkOriginalStart,
      originalEnd: sharedStart + originalPosition,
      currentStart: sharedStart + hunkCurrentStart,
      currentEnd: sharedStart + currentPosition,
      rows,
    })
  }
  return { originalLines, currentLines, hunks, removedLineCount, addedLineCount, changedLineNumbers, tooManyChanges: exactDiff === null }
}
