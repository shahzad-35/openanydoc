// Reads a Parquet file into the CSV viewer's table shape (a header row, then rows of cell text), with hyparquet (MIT, pure
// JavaScript). Loaded by the CSV parse worker only when a .parquet file is opened. Parquet is read, never written back: the viewer
// saves the table as CSV (or another export).
import { parquetMetadata, parquetRead, parquetSchema } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import type { ParsedCsv } from '../../parseCsv'

// A cell's text: big integers and dates as text, nested values as JSON, missing values empty.
function toCellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value, (_key, nested) => (typeof nested === 'bigint' ? nested.toString() : nested))
  return String(value)
}

export async function readParquetTable(contents: ArrayBuffer): Promise<ParsedCsv> {
  let header: string[]
  try {
    header = parquetSchema(parquetMetadata(contents)).children.map((column) => column.element.name)
  } catch {
    return { status: 'error', reason: 'binary' }
  }
  const dataRows: string[][] = []
  await parquetRead({ file: contents, compressors, onComplete: (rows) => {
    for (const row of rows as unknown[][]) dataRows.push(row.map(toCellText))
  } })
  if (dataRows.length === 0) return { status: 'error', reason: 'noRows' }
  return { status: 'ok', rows: [header, ...dataRows], columnCount: header.length, detectedDelimiter: ',', encodingLabel: 'Parquet', hasUtf8Bom: false, usesCrlf: false, notices: [] }
}
