// The Mask Data page's file side, on the page: reads a CSV, workbook or JSON file for the mask worker, talks to the worker, and
// writes the masked (or restored) document as CSV, Excel or JSON with the converters' own writers (src/formats/conversion.ts).
import { translate } from '../../i18n'
import type { Locale } from '../../i18n'
import { findViewerForFileName } from '../../viewers'
import type { ConversionTarget } from '../../viewers'
import { OUTPUT_FORMATS, buildCsvText, buildRecords, buildXlsxBlob, getCellText, hasNonAsciiText, readInputTables, readJsonRecordsAsTable, readNumberOrText } from '../conversion'
import type { CellValue } from '../conversion'
import { restoreBigNumbers } from '../json/jsonTools'
import { decodeTextBytes } from '../text/textEditing'
import type { MaskDocument } from './detectSensitiveData'
import type { MaskSource, MaskWorkerRequest, MaskWorkerResponse } from './mask.worker'

// The formats a masked file can be saved in: a table or JSON as CSV, Excel or JSON; a text file as text only.
export type MaskOutputFormat = ConversionTarget | 'txt'

export function getFileFormat(fileName: string): MaskOutputFormat {
  const viewerId = findViewerForFileName(fileName)?.id
  return viewerId === 'excel' ? 'xlsx' : viewerId === 'json' ? 'json' : viewerId === 'text' ? 'txt' : 'csv'
}

const outputFileTypes: Record<MaskOutputFormat, { extension: string; mimeType: string }> = { ...OUTPUT_FORMATS, txt: { extension: '.txt', mimeType: 'text/plain' } }

// Workbooks keep their numbers and dates (raw cells); CSV cells stay the exact text of the file; a text file is read in its own
// encoding (UTF-8, UTF-16 or Windows-1256, as the TXT viewer reads it).
export async function readMaskSource(file: File, locale: Locale): Promise<{ source: MaskSource } | { error: string }> {
  const contents = await file.arrayBuffer()
  const format = getFileFormat(file.name)
  if (format === 'json') return { source: { kind: 'jsonBytes', bytes: contents } }
  if (format === 'txt') return { source: { kind: 'document', document: { kind: 'text', text: decodeTextBytes(contents).text } } }
  const readResult = await readInputTables(file, contents, format === 'xlsx' ? 'excel' : 'csv', format === 'xlsx' ? 'json' : 'csv', locale)
  if (readResult.status === 'error') return { error: readResult.message }
  const tables = readResult.tables.map(({ sheetName, rows }) => ({ sheetName, header: (rows[0] ?? []).map((cell) => getCellText(cell ?? null)), rows: rows.slice(1) }))
  return { source: { kind: 'document', document: { kind: 'tables', sourceFormat: format === 'xlsx' ? 'excel' : 'csv', tables } } }
}

// "people.csv" -> "people-masked.csv"; one sheet of a workbook as CSV adds its name: "people-Staff-masked.csv".
export function buildOutputFileName(fileName: string, suffix: string, target: MaskOutputFormat, sheetName = '') {
  const dotIndex = fileName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return `${baseName}${sheetName ? `-${sheetName}` : ''}-${suffix}${outputFileTypes[target].extension}`
}

// The document as a file of the `target` format. A workbook becomes one CSV of the sheet `sheetIndex`, every sheet in Excel, and
// in JSON a list of records (one sheet) or an object of lists by sheet name.
export async function buildOutputFile(document: MaskDocument, target: MaskOutputFormat, fileName: string, sheetIndex: number, locale: Locale): Promise<File | { error: string }> {
  const { mimeType } = outputFileTypes[target]
  if (document.kind === 'text') return new File([document.text], fileName, { type: mimeType })
  if (document.kind === 'json') {
    // A copy, because restoreBigNumbers changes the value it is given and the masked document is downloaded again in other formats.
    const root = restoreBigNumbers(structuredClone(document.root))
    if (target === 'json') return new File([JSON.stringify(root, null, 2)], fileName, { type: mimeType })
    const rows = readJsonRecordsAsTable(root)
    if (!rows) return { error: translate(locale, 'convert.notATable') }
    const contents = target === 'csv' ? buildCsvText(rows, ',', hasNonAsciiText([{ sheetName: '', rows }])) : await buildXlsxBlob([{ sheetName: 'Sheet1', rows }])
    return new File([contents], fileName, { type: mimeType })
  }
  // CSV text that is a plain number becomes a number in Excel and JSON, as on the conversion pages.
  const toTypedCell = (cell: CellValue) => (document.sourceFormat === 'csv' && typeof cell === 'string' ? readNumberOrText(cell) : cell)
  const tables = document.tables.map((table) => ({ sheetName: table.sheetName, rows: [table.header as CellValue[], ...table.rows.map((row) => (target === 'csv' ? row : row.map(toTypedCell)))] }))
  if (target === 'csv') {
    const table = tables[sheetIndex] ?? tables[0]
    return new File([buildCsvText(table.rows, ',', hasNonAsciiText([table]))], fileName, { type: mimeType })
  }
  if (target === 'xlsx') return new File([await buildXlsxBlob(tables.map((table) => ({ ...table, sheetName: table.sheetName || 'Sheet1' })))], fileName, { type: mimeType })
  const records = tables.length === 1 ? buildRecords(tables[0].rows) : Object.fromEntries(tables.map((table) => [table.sheetName, buildRecords(table.rows)]))
  return new File([JSON.stringify(records, null, 2)], fileName, { type: mimeType })
}

// One worker for the page's life. Requests are answered in the order they are sent; progress messages go to `onProgress`.
export function startMaskWorker(onProgress: (share: number) => void) {
  const worker = new Worker(new URL('./mask.worker.ts', import.meta.url), { type: 'module' })
  const waitingRequests: { resolve: (response: MaskWorkerResponse) => void; reject: (error: Error) => void }[] = []
  worker.onmessage = (event: MessageEvent<MaskWorkerResponse>) => {
    if (event.data.type === 'progress') onProgress(event.data.share)
    else waitingRequests.shift()?.resolve(event.data)
  }
  worker.onerror = () => {
    for (const request of waitingRequests.splice(0)) request.reject(new Error('mask worker failed'))
  }
  return {
    request(message: MaskWorkerRequest) {
      return new Promise<MaskWorkerResponse>((resolve, reject) => {
        waitingRequests.push({ resolve, reject })
        worker.postMessage(message)
      })
    },
    stop: () => worker.terminate(),
  }
}

// Fetches what masking needs (the worker and the Excel writer) while the page is idle, so the drawer then works with no network.
export async function warmUpMaskTool() {
  const worker = startMaskWorker(() => {})
  await worker.request({ type: 'scan', source: { kind: 'document', document: { kind: 'text', text: '' } } }).finally(() => worker.stop())
  const { loadExcelJs } = await import('../excel/excelStyles')
  await loadExcelJs()
}
