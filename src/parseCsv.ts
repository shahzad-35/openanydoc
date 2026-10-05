import Papa from 'papaparse'

export type DelimiterChoice = 'auto' | ',' | ';' | '\t' | '|'

export const DELIMITER_OPTIONS: { value: DelimiterChoice; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: ',', label: 'Comma' },
  { value: ';', label: 'Semicolon' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe' },
]

export type ParsedCsv =
  | { status: 'error'; message: string }
  | {
      status: 'ok'
      rows: string[][]
      columnCount: number
      detectedDelimiter: string
      encodingLabel: string
      notices: string[]
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

function looksLikeBinary(fileContents: ArrayBuffer) {
  const bytes = new Uint8Array(fileContents, 0, Math.min(fileContents.byteLength, BINARY_CHECK_BYTE_COUNT))
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
  return !isUtf16 && bytes.includes(0)
}

function describeParseProblems(errors: Papa.ParseError[], columnCount: number, mismatchedRowCount: number) {
  const notices: string[] = []

  if (mismatchedRowCount > 0) {
    notices.push(
      `${mismatchedRowCount.toLocaleString()} rows have a different number of columns than the first row. Missing cells are shown empty.`,
    )
  }

  const unclosedQuote = errors.find((error) => error.code === 'MissingQuotes')
  if (unclosedQuote) {
    notices.push(
      `A quoted value that starts on row ${((unclosedQuote.row ?? 0) + 1).toLocaleString()} never closes. Rows after it may be merged into one cell.`,
    )
  }

  if (errors.some((error) => error.code === 'UndetectableDelimiter')) {
    notices.push('The delimiter could not be detected, so a comma was assumed. You can choose another one above.')
  }

  if (columnCount === 1) {
    notices.push('Only one column was found. If the file uses a different delimiter, choose one above.')
  }

  return notices
}

export function parseCsv(fileContents: ArrayBuffer, delimiterChoice: DelimiterChoice): ParsedCsv {
  if (fileContents.byteLength === 0) {
    return { status: 'error', message: 'This file is empty.' }
  }
  if (looksLikeBinary(fileContents)) {
    return {
      status: 'error',
      message:
        "This doesn't look like a text CSV file. It contains binary data, so it may be corrupted or a different file type.",
    }
  }

  const { text, encodingLabel } = decodeCsvBytes(fileContents)
  if (text.trim() === '') {
    return { status: 'error', message: 'This file is empty.' }
  }

  const parseResult = Papa.parse<string[]>(text, {
    delimiter: delimiterChoice === 'auto' ? '' : delimiterChoice,
    delimitersToGuess: [',', ';', '\t', '|'],
    skipEmptyLines: true,
  })

  const rows = parseResult.data
  if (rows.length === 0) {
    return { status: 'error', message: 'No rows could be read from this file.' }
  }

  // PapaParse only reports column-count mismatches when it uses a header row, so count them here.
  let columnCount = 0
  let mismatchedRowCount = 0
  for (const row of rows) {
    if (row.length > columnCount) columnCount = row.length
    if (row.length !== rows[0].length) mismatchedRowCount++
  }

  const notices = describeParseProblems(parseResult.errors, rows.length > 1 ? columnCount : 0, mismatchedRowCount)

  return {
    status: 'ok',
    rows,
    columnCount,
    detectedDelimiter: parseResult.meta.delimiter,
    encodingLabel,
    notices,
  }
}

// Excel needs a byte order mark to read Arabic and other non-ASCII text correctly, so add one when the source had it or the text needs it.
export function buildCsvDownloadText(rows: string[][], delimiter: string, sourceHadByteOrderMark: boolean) {
  const csvText = Papa.unparse(rows, { delimiter })
  const needsByteOrderMark = sourceHadByteOrderMark || /[^\p{ASCII}]/u.test(csvText)
  return needsByteOrderMark ? `\uFEFF${csvText}` : csvText
}
