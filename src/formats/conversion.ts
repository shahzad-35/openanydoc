// Converts a file between CSV, Excel and JSON in the browser, for the conversion pages (/excel-to-csv, /csv-to-excel,
// /excel-to-json, /csv-to-json, /json-to-csv) and the viewers' Convert button. The result is a new File that opens in the viewer
// of its format. Loaded only when a conversion runs, so SheetJS and ExcelJS never weigh on the pages.
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { translate } from '../i18n'
import type { Locale } from '../i18n'
import { parseCsv } from '../parseCsv'
import { findTableFormat } from '../viewers'
import type { ConversionTarget, Viewer } from '../viewers'
import { columnLabel } from './DataTable'
import { loadExcelJs } from './excel/excelStyles'
import { isPlainObject, parseJsonText } from './json/jsonModel'
import type { JsonValue } from './json/jsonModel'
import { isBigNumber } from './json/jsonTools'
import { buildDownloadName } from './registry'

type CellValue = string | number | boolean | Date | null
// One sheet of the input (a CSV or JSON file is one table), header row first.
type InputTable = { sheetName: string; rows: CellValue[][] }
type ReadResult = { status: 'error'; message: string } | { status: 'ok'; tables: InputTable[] }

// Only plain decimals become numbers; "007", phone numbers and long IDs stay text so nothing is lost.
const PLAIN_NUMBER_PATTERN = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/
const OUTPUT_FORMATS = {
  csv: { extension: '.csv', mimeType: 'text/csv' },
  xlsx: { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  json: { extension: '.json', mimeType: 'application/json' },
}

function readNumberOrText(text: string): CellValue {
  return PLAIN_NUMBER_PATTERN.test(text) ? Number(text) : text
}

function getCellText(value: CellValue) {
  if (value === null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

// { a: { b: 1 }, tags: ['x'] } -> { 'a.b': 1, 'tags.0': 'x' }. An empty object or list stays as its JSON text.
function flattenToDotKeys(value: JsonValue, keyPrefix: string, flatRecord: Map<string, string>) {
  const isContainerWithEntries = (Array.isArray(value) || isPlainObject(value)) && Object.keys(value).length > 0
  if (!isContainerWithEntries) {
    flatRecord.set(keyPrefix, value === null ? '' : isBigNumber(value) ? value.rawJSON : typeof value === 'object' ? JSON.stringify(value) : String(value))
    return
  }
  for (const [key, child] of Object.entries(value as object)) flattenToDotKeys(child as JsonValue, keyPrefix === '' ? key : `${keyPrefix}.${key}`, flatRecord)
}

// A list of objects (or one object) as a table whose columns are the dot-notation keys, in the order they first appear.
function readJsonRecordsAsTable(value: JsonValue): CellValue[][] | null {
  const records = Array.isArray(value) ? value : [value]
  if (records.length === 0 || !records.every(isPlainObject)) return null
  const flatRecords = records.map((record) => {
    const flatRecord = new Map<string, string>()
    flattenToDotKeys(record, '', flatRecord)
    return flatRecord
  })
  const columnKeys = [...new Set(flatRecords.flatMap((flatRecord) => [...flatRecord.keys()]))]
  return [columnKeys, ...flatRecords.map((flatRecord) => columnKeys.map((key) => flatRecord.get(key) ?? ''))]
}

// For JSON output, cells keep their type (numbers stay numbers); for CSV and Excel output they are the text the sheet shows.
async function readInputTables(file: File, contents: ArrayBuffer, inputViewerId: Viewer['id'], convertTo: ConversionTarget, locale: Locale): Promise<ReadResult> {
  if (inputViewerId === 'excel') {
    try {
      // UTC: a date cell is a calendar day, not a moment, so it must not move by the visitor's time zone in the ISO text.
      const workbook = XLSX.read(contents, { type: 'array', cellDates: true, UTC: true })
      const tables = workbook.SheetNames.map((sheetName) => ({
        sheetName,
        rows: XLSX.utils.sheet_to_json<CellValue[]>(workbook.Sheets[sheetName], { header: 1, raw: convertTo === 'json', defval: convertTo === 'json' ? null : '', blankrows: false, UTC: true }),
      }))
      return { status: 'ok', tables }
    } catch {
      return { status: 'error', message: translate(locale, 'convert.readFailed') }
    }
  }
  if (inputViewerId === 'csv') {
    const parsedCsv = parseCsv(contents, findTableFormat(file.name).defaultDelimiter)
    if (parsedCsv.status === 'error') return { status: 'error', message: translate(locale, 'convert.readFailed') }
    const rows = convertTo === 'csv' ? parsedCsv.rows : parsedCsv.rows.map((row, rowPosition) => (rowPosition === 0 ? row : row.map(readNumberOrText)))
    return { status: 'ok', tables: [{ sheetName: '', rows }] }
  }
  const parseResult = await parseJsonText(new TextDecoder().decode(contents), locale)
  if (parseResult.status === 'error') return { status: 'error', message: parseResult.message }
  const rows = readJsonRecordsAsTable(parseResult.value)
  return rows ? { status: 'ok', tables: [{ sheetName: '', rows }] } : { status: 'error', message: translate(locale, 'convert.notATable') }
}

// Header cells as object keys: an empty one becomes its column letter, a repeated one gets _2, _3 ...
function buildRecordKeys(headerRow: CellValue[], columnCount: number) {
  const usedKeys = new Set<string>()
  return Array.from({ length: columnCount }, (_, columnPosition) => {
    const baseKey = getCellText(headerRow[columnPosition] ?? null).trim() || columnLabel(columnPosition)
    let key = baseKey
    for (let copyNumber = 2; usedKeys.has(key); copyNumber++) key = `${baseKey}_${copyNumber}`
    usedKeys.add(key)
    return key
  })
}

function buildRecords(rows: CellValue[][]) {
  const columnCount = Math.max(0, ...rows.map((row) => row.length))
  const recordKeys = buildRecordKeys(rows[0] ?? [], columnCount)
  return rows.slice(1).map((row) => Object.fromEntries(recordKeys.map((key, columnPosition) => [key, row[columnPosition] ?? null])))
}

function buildCsvText(rows: CellValue[][], delimiter: string, includeByteOrderMark: boolean) {
  const csvText = Papa.unparse(rows.map((row) => row.map(getCellText)), { delimiter, newline: '\r\n' })
  return `${includeByteOrderMark ? '﻿' : ''}${csvText}\r\n`
}

// One sheet with a bold header row and each column as wide as its longest cell (up to 60 characters).
async function buildXlsxBlob(rows: CellValue[][], sheetName: string) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Sheet1')
  worksheet.addRows(rows)
  worksheet.getRow(1).font = { bold: true }
  const columnCount = Math.max(0, ...rows.map((row) => row.length))
  for (let columnPosition = 0; columnPosition < columnCount; columnPosition++) {
    const longestTextLength = Math.max(...rows.map((row) => getCellText(row[columnPosition] ?? null).length))
    worksheet.getColumn(columnPosition + 1).width = Math.min(60, Math.max(8, longestTextLength + 2))
  }
  return new Blob([await workbook.xlsx.writeBuffer()])
}

// "sales.xlsx" -> "sales.csv"; a workbook with several sheets adds the sheet's name: "sales-Q2.csv".
function buildConvertedFileName(fileName: string, sheetName: string, hasSeveralSheets: boolean, extension: string) {
  if (!hasSeveralSheets) return buildDownloadName(fileName, false, extension)
  const dotIndex = fileName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return `${baseName}-${sheetName}${extension}`
}

// Excel opens a UTF-8 CSV without a byte order mark as Windows text, which garbles Arabic and other non-Latin letters.
function hasNonAsciiText(tables: InputTable[]) {
  return tables.some((table) => table.rows.some((row) => row.some((cell) => /[^\p{ASCII}]/u.test(getCellText(cell)))))
}

// The converted file: comma-separated CSV (with a byte order mark when there is non-Latin text), an .xlsx workbook, or JSON
// indented with 2 spaces. Other delimiters, minified JSON and the like are chosen in the viewer it opens in.
async function buildConvertedFile(table: InputTable, convertTo: ConversionTarget, fileName: string) {
  const { mimeType } = OUTPUT_FORMATS[convertTo]
  const contents =
    convertTo === 'csv'
      ? buildCsvText(table.rows, ',', hasNonAsciiText([table]))
      : convertTo === 'xlsx'
        ? await buildXlsxBlob(table.rows, table.sheetName || fileName.replace(/\.[^.]+$/, ''))
        : JSON.stringify(buildRecords(table.rows), null, 2)
  return new File([contents], fileName, { type: mimeType })
}

// Converts a file (from a conversion page, or from a viewer with its edits written in) into a file of the `convertTo` format,
// ready to open in that format's viewer. `sheetName` picks a workbook's sheet (the one on screen in the Excel viewer); without
// it, the first sheet is converted. An error is the message to show.
export async function convertForViewer(file: File, inputViewerId: Viewer['id'], convertTo: ConversionTarget, locale: Locale, sheetName = ''): Promise<{ file: File } | { error: string }> {
  const readResult = await readInputTables(file, await file.arrayBuffer(), inputViewerId, convertTo, locale)
  if (readResult.status === 'error') return { error: readResult.message }
  const { tables } = readResult
  const table = tables.find((sheet) => sheet.sheetName === sheetName) ?? tables[0]
  const fileName = buildConvertedFileName(file.name, table.sheetName, tables.length > 1, OUTPUT_FORMATS[convertTo].extension)
  return { file: await buildConvertedFile(table, convertTo, fileName) }
}
