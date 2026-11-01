// The Mask Data page's worker: it holds the file being masked, scans it, builds the before/after preview and masks or restores
// it, so large files never freeze the page. Nothing leaves it except back to the page.
import { parseKeepingBigNumbers } from '../json/jsonTools'
import { detectSensitiveFields, getValueText, isMarkedBigNumber } from './detectSensitiveData'
import type { Finding, MaskDocument, MaskField } from './detectSensitiveData'
import { PREVIEW_ROW_COUNT, maskDocument } from './maskData'
import type { MaskChoice, TokenKeyEntry } from './maskData'
import { parseKeyFile, restoreDocument } from './restoreData'

// A CSV file or workbook arrives as tables (read on the page with SheetJS), a text file as its text; JSON arrives as bytes and is
// parsed here.
export type MaskSource = { kind: 'document'; document: MaskDocument } | { kind: 'jsonBytes'; bytes: ArrayBuffer }
export type PreviewTable = { header: string[]; rows: string[][] }

export type MaskWorkerRequest =
  | { type: 'scan'; source: MaskSource }
  | { type: 'preview'; choices: MaskChoice[]; sheetIndex: number }
  | { type: 'mask'; choices: MaskChoice[] }
  | { type: 'restore'; source: MaskSource; keyText: string }

export type MaskWorkerResponse =
  | { type: 'progress'; share: number }
  | { type: 'scanned'; fields: MaskField[]; findings: Finding[]; sheetNames: string[] }
  | { type: 'preview'; before: PreviewTable; after: PreviewTable }
  | { type: 'masked'; document: MaskDocument; tokens: Record<string, TokenKeyEntry> }
  | { type: 'restored'; document: MaskDocument; restoredCount: number; unknownTokenCount: number }
  | { type: 'error'; reason: 'json' | 'key'; detail: string }

let loadedDocument: MaskDocument | null = null

function readSource(source: MaskSource): MaskDocument {
  if (source.kind === 'document') return source.document
  return { kind: 'json', root: parseKeepingBigNumbers(new TextDecoder().decode(source.bytes)).value }
}

// The list of records the JSON preview shows: the document itself when it is a list, else the first list of objects inside it.
function findPreviewPath(value: unknown, path: string[] = []): string[] | null {
  if (Array.isArray(value)) return path.length === 0 || value.some((item) => typeof item === 'object' && item !== null) ? path : null
  if (typeof value !== 'object' || value === null || isMarkedBigNumber(value)) return null
  for (const [key, child] of Object.entries(value)) {
    const childPath = findPreviewPath(child, [...path, key])
    if (childPath) return childPath
  }
  return null
}

function flattenForPreview(value: unknown, keyPrefix: string, flatRecord: Map<string, string>) {
  if (typeof value === 'object' && value !== null && !isMarkedBigNumber(value) && Object.keys(value).length > 0) {
    for (const [key, child] of Object.entries(value)) flattenForPreview(child, keyPrefix === '' ? key : `${keyPrefix}.${key}`, flatRecord)
    return
  }
  flatRecord.set(keyPrefix || 'value', typeof value === 'object' && value !== null && !isMarkedBigNumber(value) ? JSON.stringify(value) : getValueText(value))
}

function buildJsonPreview(root: unknown, previewPath: string[] | null): PreviewTable {
  const records = previewPath ? (previewPath.reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], root) as unknown[]).slice(0, PREVIEW_ROW_COUNT) : [root]
  const flatRecords = records.map((record) => {
    const flatRecord = new Map<string, string>()
    flattenForPreview(record, '', flatRecord)
    return flatRecord
  })
  const header = [...new Set(flatRecords.flatMap((flatRecord) => [...flatRecord.keys()]))]
  return { header, rows: flatRecords.map((flatRecord) => header.map((key) => flatRecord.get(key) ?? '')) }
}

// The first lines that have text, one per row.
function buildTextPreview(text: string): PreviewTable {
  return { header: ['text'], rows: text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, PREVIEW_ROW_COUNT).map((line) => [line]) }
}

function buildTablePreview(document: MaskDocument, sheetIndex: number): PreviewTable {
  if (document.kind !== 'tables') return { header: [], rows: [] }
  const table = document.tables.length === 1 ? document.tables[0] : document.tables[sheetIndex]
  return { header: table.header, rows: table.rows.slice(0, PREVIEW_ROW_COUNT).map((row) => table.header.map((_, columnIndex) => getValueText(row[columnIndex]))) }
}

function handleRequest(request: MaskWorkerRequest): MaskWorkerResponse {
  const reportProgress = (share: number) => postMessage({ type: 'progress', share } satisfies MaskWorkerResponse)
  switch (request.type) {
    case 'scan': {
      loadedDocument = readSource(request.source)
      const { fields, findings } = detectSensitiveFields(loadedDocument, reportProgress)
      return { type: 'scanned', fields, findings, sheetNames: loadedDocument.kind === 'tables' ? loadedDocument.tables.map((table) => table.sheetName) : [] }
    }
    case 'preview': {
      const document = loadedDocument as MaskDocument
      if (document.kind === 'text') {
        const maskedText = (maskDocument(document, request.choices).document as { text: string }).text
        return { type: 'preview', before: buildTextPreview(document.text), after: buildTextPreview(maskedText) }
      }
      if (document.kind === 'json') {
        const previewPath = findPreviewPath(document.root)
        const maskedRoot = (maskDocument(document, request.choices).document as { root: unknown }).root
        return { type: 'preview', before: buildJsonPreview(document.root, previewPath), after: buildJsonPreview(maskedRoot, previewPath) }
      }
      const masked = maskDocument(document, request.choices, { sheetIndex: request.sheetIndex, rowCount: PREVIEW_ROW_COUNT }).document
      return { type: 'preview', before: buildTablePreview(document, request.sheetIndex), after: buildTablePreview(masked, 0) }
    }
    case 'mask':
      return { type: 'masked', ...maskDocument(loadedDocument as MaskDocument, request.choices) }
    case 'restore': {
      const key = parseKeyFile(request.keyText)
      if (!key) return { type: 'error', reason: 'key', detail: '' }
      return { type: 'restored', ...restoreDocument(readSource(request.source), key) }
    }
  }
}

self.onmessage = (event: MessageEvent<MaskWorkerRequest>) => {
  let response: MaskWorkerResponse
  try {
    response = handleRequest(event.data)
  } catch (error) {
    response = { type: 'error', reason: 'json', detail: error instanceof Error ? error.message : String(error) }
  }
  postMessage(response)
}
