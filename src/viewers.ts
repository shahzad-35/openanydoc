import type { DelimiterChoice } from './parseCsv'

export type Viewer = {
  id: 'csv' | 'text' | 'excel' | 'word' | 'pdf' | 'powerpoint'
  label: string
  extensions: string[]
  description: string
}

export const viewers: Viewer[] = [
  { id: 'csv', label: 'CSV', extensions: ['.csv', '.tsv', '.tab'], description: 'Open comma- and tab-separated files as a clean, searchable table.' },
  { id: 'text', label: 'TXT', extensions: ['.txt'], description: 'Read plain text files as they were written.' },
  { id: 'excel', label: 'Excel', extensions: ['.xlsx', '.xls'], description: 'Browse sheets and cells from .xlsx and .xls workbooks.' },
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

export function findViewerForFileName(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase()
  return viewers.find((viewer) => viewer.extensions.some((extension) => lowerCaseFileName.endsWith(extension)))
}
