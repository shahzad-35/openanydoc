import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { OpenedFile } from '../useFileIntake'
import { viewers } from '../viewers'
import type { Viewer } from '../viewers'
import { countCsvEdits, createEmptyCsvEdits, describeCsvChanges } from './csv/csvCells'
import type { CsvEdits } from './csv/csvCells'
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
  label: string
  // null keeps the original file's extension.
  extension: string | null
  mimeType: string
  createFile(edits: unknown, exportSource: unknown, settings: ExportSettings): string
}

// Loaded the first time Edit is used, so viewing never pays for editing code.
export type EditingModule = {
  tools: EditorTool[]
  downloadOption: ExportOption
  // What the Download icon will save, for its tooltip, e.g. "visible rows (2)".
  describeDownload(exportSource: unknown): string
  getDefaultByteOrderMark(exportSource: unknown): boolean
  components: unknown
}

export type FormatEditing = {
  createEmptyEdits: () => unknown
  countChanges: (edits: unknown) => number
  // "3 edited cells, 1 row deleted"; empty when nothing changed.
  describeChanges: (edits: unknown) => string
  loadEditingModule: () => Promise<EditingModule>
}

export type FormatDefinition = {
  viewerId: Viewer['id']
  ViewerComponent: LazyExoticComponent<ComponentType<FormatViewerProps>>
  // Absent while a format cannot be edited yet; the View / Edit toggle is then not shown.
  editing?: FormatEditing
}

const comingSoonViewer = lazy(() => import('./ComingSoonViewer'))

// To make another format editable, add `editing` to its entry. Only CSV is editable for now.
const formatDefinitions: FormatDefinition[] = [
  {
    viewerId: 'csv',
    ViewerComponent: lazy(() => import('./csv/CsvViewer')),
    editing: {
      createEmptyEdits: createEmptyCsvEdits,
      countChanges: (edits) => countCsvEdits(edits as CsvEdits),
      describeChanges: (edits) => describeCsvChanges(edits as CsvEdits),
      loadEditingModule: () => import('./csv/csvEditing').then((editingFile) => editingFile.csvEditingModule),
    },
  },
  { viewerId: 'excel', ViewerComponent: comingSoonViewer },
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
