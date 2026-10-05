export type Viewer = {
  label: string
  path: string
  extensions: string[]
  description: string
  acceptsPastedText?: boolean
}

export const viewers: Viewer[] = [
  { label: 'CSV', path: '/csv-viewer', extensions: ['.csv'], acceptsPastedText: true, description: 'Open comma-separated files as a clean, searchable table.' },
  { label: 'Excel', path: '/excel-viewer', extensions: ['.xlsx', '.xls'], description: 'Browse sheets and cells from .xlsx and .xls workbooks.' },
  { label: 'Word', path: '/word-viewer', extensions: ['.docx'], description: 'Read .docx documents with their original formatting.' },
  { label: 'PowerPoint', path: '/pptx-viewer', extensions: ['.pptx'], description: 'Flip through .pptx slides right in your browser.' },
]
