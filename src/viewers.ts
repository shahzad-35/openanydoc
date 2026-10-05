export type Viewer = {
  id: 'csv' | 'excel' | 'word' | 'pdf' | 'powerpoint'
  label: string
  extensions: string[]
  description: string
}

export const viewers: Viewer[] = [
  { id: 'csv', label: 'CSV', extensions: ['.csv', '.tsv', '.tab', '.txt'], description: 'Open comma-separated files as a clean, searchable table.' },
  { id: 'excel', label: 'Excel', extensions: ['.xlsx', '.xls'], description: 'Browse sheets and cells from .xlsx and .xls workbooks.' },
  { id: 'word', label: 'Word', extensions: ['.docx'], description: 'Read .docx documents with their original formatting.' },
  { id: 'pdf', label: 'PDF', extensions: ['.pdf'], description: 'Read .pdf documents page by page in your browser.' },
  { id: 'powerpoint', label: 'PowerPoint', extensions: ['.pptx'], description: 'Flip through .pptx slides right in your browser.' },
]

export const supportedExtensions = viewers.flatMap((viewer) => viewer.extensions)

export function findViewerForFileName(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase()
  return viewers.find((viewer) => viewer.extensions.some((extension) => lowerCaseFileName.endsWith(extension)))
}
