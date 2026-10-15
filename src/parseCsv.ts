import Papa from 'papaparse'
import { translate, translatePlural } from './i18n'
import type { Locale, MessageKey } from './i18n'

export type DelimiterChoice = 'auto' | ',' | ';' | '\t' | '|'

export const DELIMITER_OPTIONS: { value: DelimiterChoice; labelKey: MessageKey }[] = [
  { value: 'auto', labelKey: 'csv.delimiter.auto' },
  { value: ',', labelKey: 'csv.delimiter.comma' },
  { value: ';', labelKey: 'csv.delimiter.semicolon' },
  { value: '\t', labelKey: 'csv.delimiter.tab' },
  { value: '|', labelKey: 'csv.delimiter.pipe' },
]

// What went wrong or looks odd, kept as data so the page can show it in whichever language is active.
export type ParseNotice =
  | { kind: 'mismatchedRows'; rowCount: number }
  | { kind: 'unclosedQuote'; rowNumber: number }
  | { kind: 'noDelimiter' }
  | { kind: 'oneColumn' }

export type ParsedCsv =
  | { status: 'error'; reason: 'empty' | 'binary' | 'noRows' }
  | {
      status: 'ok'
      rows: string[][]
      columnCount: number
      detectedDelimiter: string
      encodingLabel: string
      // The file's own first bytes are the UTF-8 marker (EF BB BF) that makes Excel read Arabic correctly.
      hasUtf8Bom: boolean
      notices: ParseNotice[]
    }

export function describeParseNotice(notice: ParseNotice, locale: Locale) {
  switch (notice.kind) {
    case 'mismatchedRows':
      return translatePlural(locale, 'csv.notice.mismatchedRows', notice.rowCount)
    case 'unclosedQuote':
      return translate(locale, 'csv.notice.unclosedQuote', { row: notice.rowNumber })
    case 'noDelimiter':
      return translate(locale, 'csv.notice.noDelimiter')
    case 'oneColumn':
      return translate(locale, 'csv.notice.oneColumn')
  }
}

const BINARY_CHECK_BYTE_COUNT = 64 * 1024

export function decodeCsvBytes(fileContents: ArrayBuffer) {
  const bytes = new Uint8Array(fileContents)

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

function findParseProblems(errors: Papa.ParseError[], columnCount: number, mismatchedRowCount: number) {
  const notices: ParseNotice[] = []

  if (mismatchedRowCount > 0) notices.push({ kind: 'mismatchedRows', rowCount: mismatchedRowCount })

  const unclosedQuote = errors.find((error) => error.code === 'MissingQuotes')
  if (unclosedQuote) notices.push({ kind: 'unclosedQuote', rowNumber: (unclosedQuote.row ?? 0) + 1 })

  if (errors.some((error) => error.code === 'UndetectableDelimiter')) notices.push({ kind: 'noDelimiter' })

  if (columnCount === 1) notices.push({ kind: 'oneColumn' })

  return notices
}

export function parseCsv(fileContents: ArrayBuffer, delimiterChoice: DelimiterChoice): ParsedCsv {
  if (fileContents.byteLength === 0) {
    return { status: 'error', reason: 'empty' }
  }
  if (looksLikeBinary(fileContents)) return { status: 'error', reason: 'binary' }

  const { text, encodingLabel } = decodeCsvBytes(fileContents)
  if (text.trim() === '') {
    return { status: 'error', reason: 'empty' }
  }

  const parseResult = Papa.parse<string[]>(text, {
    delimiter: delimiterChoice === 'auto' ? '' : delimiterChoice,
    delimitersToGuess: [',', ';', '\t', '|'],
    skipEmptyLines: true,
  })

  const rows = parseResult.data
  if (rows.length === 0) {
    return { status: 'error', reason: 'noRows' }
  }

  // PapaParse only reports column-count mismatches when it uses a header row, so count them here.
  let columnCount = 0
  let mismatchedRowCount = 0
  for (const row of rows) {
    if (row.length > columnCount) columnCount = row.length
    if (row.length !== rows[0].length) mismatchedRowCount++
  }

  const notices = findParseProblems(parseResult.errors, rows.length > 1 ? columnCount : 0, mismatchedRowCount)

  return {
    status: 'ok',
    rows,
    columnCount,
    detectedDelimiter: parseResult.meta.delimiter,
    encodingLabel,
    hasUtf8Bom: encodingLabel.startsWith('UTF-8 with BOM'),
    notices,
  }
}

const NUMBER_PATTERN = /^[-+]?[\d.,]+%?$/

// Like Python's csv.Sniffer: the first row is a header when it is all text, has no empty cell, and the rows below hold numbers
// in a column where the first row has text. A table that is all text gives no such evidence, so it counts as having no header.
export function firstRowLooksLikeHeader(rows: string[][]) {
  const [firstRow, ...dataRows] = rows
  if (!firstRow || dataRows.length === 0) return false
  if (firstRow.some((cellText) => cellText.trim() === '' || NUMBER_PATTERN.test(cellText.trim()))) return false

  return firstRow.some((_, columnPosition) => {
    const sampledCells = dataRows.slice(0, 100).map((row) => (row[columnPosition] ?? '').trim()).filter((cellText) => cellText !== '')
    return sampledCells.length > 0 && sampledCells.filter((cellText) => NUMBER_PATTERN.test(cellText)).length / sampledCells.length >= 0.8
  })
}

// Excel needs a byte order mark to read Arabic and other non-ASCII text correctly, so add one when the source had it or the text needs it.
export function buildCsvDownloadText(rows: string[][], delimiter: string, sourceHadByteOrderMark: boolean) {
  const csvText = Papa.unparse(rows, { delimiter })
  const needsByteOrderMark = sourceHadByteOrderMark || /[^\p{ASCII}]/u.test(csvText)
  return needsByteOrderMark ? `\uFEFF${csvText}` : csvText
}
