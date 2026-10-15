import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { Locale } from '../i18n'
import type { OpenedFile } from '../useFileIntake'
import { viewers } from '../viewers'
import type { Viewer } from '../viewers'
import { countExcelEdits, createEmptyExcelEdits, describeExcelChanges } from './excel/excelEdits'
import type { ExcelEdits } from './excel/excelEdits'
import { countCsvEdits, createEmptyCsvEdits, describeCsvChanges } from './csv/csvCells'
import type { CsvEdits } from './csv/csvCells'
import { countJsonChanges, createEmptyJsonEdits, describeJsonChanges } from './json/jsonModel'
import { countTextChanges, createEmptyTextEdits, describeTextChanges } from './text/textEditing'
import type { EditSession } from './useEditSession'

export type ViewMode = 'view' | 'edit'

// What every viewer receives. `session`, `editingComponents` and the selection are specific to the format, so they are
// typed `unknown` here and each viewer narrows them once.
export type FormatViewerProps = {
  openedFile: OpenedFile
  mode: ViewMode
  session: EditSession<unknown>
  // Set once the format's editing module has loaded after Edit was first used; null while viewing.
  editingComponents: unknown
  confirmDiscardEdits: () => Promise<boolean>
  onSelectionChange: (selection: unknown) => void
  // Things the toolbar can ask the viewer to do (rename a column, open find and replace, scroll to a cell).
  onCommandsChange: (commands: unknown) => void
  onExportSourceChange: (exportSource: unknown) => void
}

// One button in the edit toolbar, for this format only (undo, redo and revert all are shared and always there).
export type EditorTool = {
  id: string
  label: string
  isEnabled(selection: unknown): boolean
  run(session: EditSession<unknown>, selection: unknown, commands: unknown): void
}

export type ExportSettings = { includeByteOrderMark: boolean }

// The file the Download icon saves.
export type ExportOption = {
  id: string
  getLabel(exportSource: unknown, locale: Locale): string
  // null keeps the original file's extension.
  extension: string | null
  getMimeType(exportSource: unknown): string
  // Text for CSV, TSV and JSON; bytes for a workbook.
  createFile(edits: unknown, exportSource: unknown, settings: ExportSettings): BlobPart | Promise<BlobPart>
}

// Loaded the first time Edit is used, so viewing never pays for editing code.
export type EditingModule = {
  tools: EditorTool[]
  downloadOption: ExportOption
  // What the Download icon will save, for its tooltip, e.g. "visible rows (2)".
  describeDownload(exportSource: unknown, locale: Locale): string
  getDefaultByteOrderMark(exportSource: unknown): boolean
  // Extra toolbar content for this format (menus), drawn in the edit toolbar's single row after Undo and Redo.
  ToolbarContent?: ComponentType<{ selection: unknown; commands: unknown }>
  components: unknown
}

export type FormatEditing = {
  createEmptyEdits: () => unknown
  countChanges: (edits: unknown) => number
  // "3 edited cells, 1 row deleted"; empty when nothing changed.
  describeChanges: (edits: unknown, locale: Locale) => string
  loadEditingModule: () => Promise<EditingModule>
}

export type FormatDefinition = {
  viewerId: Viewer['id']
  // The day the format went live (YYYY-MM-DD). A format without it is not released yet: it is never announced, linked or suggested.
  addedOn?: string
  // Two or three short feature keys (translated in src/i18n/en.json and ar.json), used in the changelog.
  highlights?: string[]
  // Formats worth suggesting to someone who just saved a file of this format.
  related?: Viewer['id'][]
  ViewerComponent: LazyExoticComponent<ComponentType<FormatViewerProps>>
  // Absent while a format cannot be edited yet; the View / Edit toggle is then not shown.
  editing?: FormatEditing
}

const comingSoonViewer = lazy(() => import('./ComingSoonViewer'))

// To make another format editable, add `editing` to its entry. CSV, plain text, JSON and Excel are editable for now.
export const formatDefinitions: FormatDefinition[] = [
  {
    viewerId: 'csv',
    addedOn: '2026-10-05',
    highlights: ['highlights.csv.open', 'highlights.csv.edit', 'highlights.csv.large'],
    related: ['excel', 'json'],
    ViewerComponent: lazy(() => import('./csv/CsvViewer')),
    editing: {
      createEmptyEdits: createEmptyCsvEdits,
      countChanges: (edits) => countCsvEdits(edits as CsvEdits),
      describeChanges: (edits, locale) => describeCsvChanges(edits as CsvEdits, locale),
      loadEditingModule: () => import('./csv/csvEditing').then((editingFile) => editingFile.csvEditingModule),
    },
  },
  {
    viewerId: 'text',
    addedOn: '2026-10-14',
    highlights: ['highlights.text.view', 'highlights.text.edit', 'highlights.text.endings'],
    related: ['csv', 'json'],
    ViewerComponent: lazy(() => import('./text/TextViewer')),
    editing: {
      createEmptyEdits: createEmptyTextEdits,
      countChanges: countTextChanges,
      describeChanges: describeTextChanges,
      loadEditingModule: () => import('./text/textToolbar').then((toolbarFile) => toolbarFile.textEditingModuleWithToolbar),
    },
  },
  {
    viewerId: 'json',
    addedOn: '2026-10-14',
    highlights: ['highlights.json.views', 'highlights.json.edit', 'highlights.json.errors'],
    related: ['csv', 'excel'],
    ViewerComponent: lazy(() => import('./json/JsonViewer')),
    editing: {
      createEmptyEdits: createEmptyJsonEdits,
      countChanges: countJsonChanges,
      describeChanges: describeJsonChanges,
      loadEditingModule: () => import('./json/jsonToolbar').then((toolbarFile) => toolbarFile.jsonEditingModuleWithToolbar),
    },
  },
  {
    viewerId: 'excel',
    addedOn: '2026-10-15',
    highlights: ['highlights.excel.open', 'highlights.excel.edit', 'highlights.excel.format'],
    related: ['csv', 'json'],
    ViewerComponent: lazy(() => import('./excel/ExcelViewer')),
    editing: {
      createEmptyEdits: createEmptyExcelEdits,
      countChanges: (edits) => countExcelEdits(edits as ExcelEdits),
      describeChanges: (edits, locale) => describeExcelChanges(edits as ExcelEdits, locale),
      loadEditingModule: () => import('./excel/excelEditing').then((editingFile) => editingFile.excelEditingModule),
    },
  },
  { viewerId: 'word', ViewerComponent: comingSoonViewer },
  { viewerId: 'pdf', ViewerComponent: comingSoonViewer },
  { viewerId: 'powerpoint', ViewerComponent: comingSoonViewer },
]

// Extensions come from `viewers.ts`, the one place that lists what each format accepts.
const formatByExtension = new Map(
  viewers.flatMap((viewer) => {
    const definition = formatDefinitions.find((candidate) => candidate.viewerId === viewer.id)
    return definition ? viewer.extensions.map((extension) => [extension, definition] as const) : []
  }),
)

export function findFormatForFileName(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase()
  for (const [extension, definition] of formatByExtension) {
    if (lowerCaseFileName.endsWith(extension)) return definition
  }
  return undefined
}

// "sales.csv" -> "sales-edited.csv" (or "sales-edited.json" when converting); an untouched copy keeps its name.
export function buildDownloadName(fileName: string, hasEdits: boolean, newExtension: string | null) {
  const dotIndex = fileName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const extension = newExtension ?? (dotIndex > 0 ? fileName.slice(dotIndex) : '')
  return `${baseName}${hasEdits ? '-edited' : ''}${extension}`
}

// Sent on the window after a file is saved, so the page can offer a tip. It carries nothing: no file name, no content.
export const FILE_SAVED_EVENT = 'openanydoc:saved'

// Saves text (or bytes) as a file by clicking a temporary link to it.
export function downloadTextFile(fileName: string, fileText: BlobPart, mimeType: string) {
  const downloadUrl = URL.createObjectURL(new Blob([fileText], { type: mimeType }))
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = fileName
  downloadLink.click()
  window.dispatchEvent(new Event(FILE_SAVED_EVENT))
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}
