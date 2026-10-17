import Papa from 'papaparse'
import { translate, translatePlural } from './i18n'
import type { Locale, MessageKey } from './i18n'
import { decodeTextBytes, looksLikeBinary } from './formats/text/textEditing'
import type { EncodingChoice } from './formats/text/textEditing'
import { getCellText } from './formats/csv/csvCells'
import type { CsvEdits } from './formats/csv/csvCells'

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
      // The file's lines end with CR LF (Windows), so a download keeps that.
      usesCrlf: boolean
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

function findParseProblems(errors: Papa.ParseError[], columnCount: number, mismatchedRowCount: number) {
  const notices: ParseNotice[] = []

  if (mismatchedRowCount > 0) notices.push({ kind: 'mismatchedRows', rowCount: mismatchedRowCount })

  const unclosedQuote = errors.find((error) => error.code === 'MissingQuotes')
  if (unclosedQuote) notices.push({ kind: 'unclosedQuote', rowNumber: (unclosedQuote.row ?? 0) + 1 })

  if (errors.some((error) => error.code === 'UndetectableDelimiter')) notices.push({ kind: 'noDelimiter' })

  if (columnCount === 1) notices.push({ kind: 'oneColumn' })

  return notices
}

export function parseCsv(fileContents: ArrayBuffer, delimiterChoice: DelimiterChoice, encodingChoice: EncodingChoice = 'auto'): ParsedCsv {
  if (fileContents.byteLength === 0) {
    return { status: 'error', reason: 'empty' }
  }
  if (looksLikeBinary(fileContents)) return { status: 'error', reason: 'binary' }

  const { text, encodingLabel } = decodeTextBytes(fileContents, encodingChoice)
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
    hasUtf8Bom: new Uint8Array(fileContents, 0, Math.min(3, fileContents.byteLength)).join(',') === '239,187,191',
    usesCrlf: text.includes('\r\n'),
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

export type CsvFileOptions = {
  rowIds: readonly number[]
  columnIds: readonly number[]
  // The header row (row 0) goes first; only when the table has one.
  includeHeaderRow: boolean
  delimiter: string
  lineEnding: '\n' | '\r\n'
  quoteAllFields: boolean
  byteOrderMark: boolean
}

// The CSV text a download saves, with the edits applied.
export function buildCsvFileText(rows: string[][], edits: CsvEdits, options: CsvFileOptions) {
  const readRow = (rowId: number) => options.columnIds.map((columnId) => getCellText(rows, edits, rowId, columnId))
  const tableRows = [...(options.includeHeaderRow ? [readRow(0)] : []), ...options.rowIds.map(readRow)]
  const csvText = Papa.unparse(tableRows, { delimiter: options.delimiter, newline: options.lineEnding, quotes: options.quoteAllFields })
  return `${options.byteOrderMark ? '﻿' : ''}${csvText}${options.lineEnding}`
}
