import type { DelimiterChoice } from './parseCsv'

export type Viewer = {
  id: 'csv' | 'text' | 'json' | 'excel' | 'word' | 'pdf' | 'powerpoint'
  label: string
  extensions: string[]
  description: string
  // The address of this format's own page (a drop zone for just this format), for formats that work. The open file keeps it.
  toolPath?: string
}

export const viewers: Viewer[] = [
  { id: 'csv', label: 'CSV', extensions: ['.csv', '.tsv', '.tab'], description: 'Open comma- and tab-separated files as a clean, searchable table.', toolPath: '/csv-viewer' },
  { id: 'text', label: 'TXT', extensions: ['.txt'], description: 'Read plain text files as they were written.', toolPath: '/txt-viewer' },
  { id: 'json', label: 'JSON', extensions: ['.json'], description: 'Explore JSON as a tree or as formatted code, and fix mistakes.', toolPath: '/json-viewer' },
  { id: 'excel', label: 'Excel', extensions: ['.xlsx', '.xls', '.xlsm', '.ods'], description: 'Browse sheets, edit cells and formulas, and save the workbook.', toolPath: '/excel-viewer' },
  { id: 'word', label: 'Word', extensions: ['.docx'], description: 'Read .docx documents with their original formatting.' },
  { id: 'pdf', label: 'PDF', extensions: ['.pdf'], description: 'Read .pdf documents page by page in your browser.' },
  { id: 'powerpoint', label: 'PowerPoint', extensions: ['.pptx'], description: 'Flip through .pptx slides right in your browser.' },
]

// How the table viewer treats each kind of table file: .csv starts on auto-detect (real CSVs are often semicolon separated),
// .tsv and .tab are tab separated. Quotes are handled the same for all, as Excel and Google Sheets write them.
// `headerRow`: whether the first row is the header by default ('detect' checks how the rows look).
export type TableFormat = { label: string; defaultDelimiter: DelimiterChoice; headerRow: 'always' | 'detect'; mimeType: string }

const CSV_FORMAT: TableFormat = { label: 'CSV', defaultDelimiter: 'auto', headerRow: 'always', mimeType: 'text/csv' }
const TSV_FORMAT: TableFormat = { label: 'TSV', defaultDelimiter: '\t', headerRow: 'detect', mimeType: 'text/tab-separated-values' }

export function findTableFormat(fileName: string): TableFormat {
  const lowerCaseFileName = fileName.toLowerCase()
  if (lowerCaseFileName.endsWith('.tsv') || lowerCaseFileName.endsWith('.tab')) return TSV_FORMAT
  return CSV_FORMAT
}

export const supportedExtensions = viewers.flatMap((viewer) => viewer.extensions)

const LEGACY_FILE_VIEW_PATH = '/view'

// A file keeps the address of its format's own page (/csv-viewer, /txt-viewer, /json-viewer), so the address and a reload
// both make sense. Formats without a page of their own use /view-excel, /view-word, /view-pdf, /view-powerpoint while open.
export function getFileViewPath(fileName: string) {
  const viewer = findViewerForFileName(fileName)
  return viewer?.toolPath ?? `/view-${viewer?.id ?? 'file'}`
}

// Addresses that only exist while a file is open; a reload or Forward sends them home because the file lives in memory.
export function isFileViewPath(pathname: string) {
  return pathname === LEGACY_FILE_VIEW_PATH || viewers.some((viewer) => pathname === `/view-${viewer.id}`)
}

export function findViewerByToolPath(pathname: string) {
  return viewers.find((viewer) => viewer.toolPath === pathname)
}

export function findViewerForFileName(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase()
  return viewers.find((viewer) => viewer.extensions.some((extension) => lowerCaseFileName.endsWith(extension)))
}
