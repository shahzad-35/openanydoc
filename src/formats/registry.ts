import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { MenuDefinition } from '../components/MenuBar'
import type { Locale } from '../i18n'
import type { OpenedFile } from '../useFileIntake'
import { viewers } from '../viewers'
import type { Viewer } from '../viewers'
import { countExcelEdits, createEmptyExcelEdits, describeExcelChanges } from './excel/excelEdits'
import type { ExcelEdits } from './excel/excelEdits'
import { countCsvEdits, createEmptyCsvEdits, describeCsvChanges } from './csv/csvCells'
import type { CsvEdits } from './csv/csvCells'
import { countJsonChanges, createEmptyJsonEdits, describeJsonChanges, parseJsonText } from './json/jsonModel'
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
  // Opens the system file chooser (the "Open another file" button's action), for the way out of a fatal error.
  onOpenAnotherFile: () => void
  // Goes back to the home page, asking first when there are unsaved edits (for a format that draws its own header).
  onClose: () => void
  // Opens a file made on the page (pasted text, a sample) through the same checks as a chosen one.
  onOpenFile: (file: File) => void
  onSelectionChange: (selection: unknown) => void
  // Things the toolbar can ask the viewer to do (rename a column, open find and replace, scroll to a cell).
  onCommandsChange: (commands: unknown) => void
  onExportSourceChange: (exportSource: unknown) => void
  // Opens a file converted from this one (Convert in the top bar) in the viewer of its format, in place of this file. The
  // edits are inside the converted file, so this does not ask about them.
  onOpenConvertedFile: (file: File) => void
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
  // This format's menus for the menu bar of the file page (between File and Help).
  // Icon tools for this format, drawn in the menu bar row after the menu names (the same actions are in the menus).
  ToolbarContent?: ComponentType<{ selection: unknown; commands: unknown }>
  getMenus?: (selection: unknown, commands: unknown, locale: Locale) => MenuDefinition[]
  components: unknown
}

export type FormatEditing = {
  createEmptyEdits: () => unknown
  countChanges: (edits: unknown) => number
  // "3 edited cells, 1 row deleted"; empty when nothing changed.
  describeChanges: (edits: unknown, locale: Locale) => string
  // Absent for a format that draws its own page with its own tools (CSV, JSON, TXT).
  loadEditingModule?: () => Promise<EditingModule>
  // A workbench that is always editable (JSON): it opens in Edit mode with its tools loaded, and has no View / Edit switch.
  alwaysEditable?: boolean
}

export type FormatDefinition = {
  viewerId: Viewer['id']
  // The day the format went live (YYYY-MM-DD). A format without it is not released yet: it is never announced, linked or suggested.
  addedOn?: string
  // Two or three short feature keys (translated in src/i18n/en.json and ar.json), used in the changelog.
  highlights?: string[]
  ViewerComponent: LazyExoticComponent<ComponentType<FormatViewerProps>>
  // Fetches everything opening a file of this format needs (the viewer and what it loads on open), so a page can do it while idle
  // and the file then opens with no network.
  preloadViewer?: () => Promise<unknown>
  // The viewer draws the whole screen itself (JSON): no shared header, edit toolbar or save tip around it.
  ownsWholePage?: boolean
  // Larger files are refused before they are read, because the page would become slow with them.
  maxFileBytes?: number
  // Absent while a format cannot be edited yet; the View / Edit toggle is then not shown.
  editing?: FormatEditing
  // The viewer offers Mask data (a button in its top bar and its menus) for this format's files: src/formats/mask.
  canMask?: boolean
}

const comingSoonViewer = lazy(() => import('./ComingSoonViewer'))
const loadCsvViewer = () => import('./csv/CsvViewer')
const loadTextViewer = () => import('./text/TextViewer')
const loadJsonViewer = () => import('./json/JsonViewer')
const loadExcelViewer = () => import('./excel/ExcelViewer')
const loadExcelEditing = () => import('./excel/excelEditing')
const loadWordViewer = () => import('./word/WordViewer')
const loadPowerPointViewer = () => import('./powerpoint/PowerPointViewer')

// To make another format editable, add `editing` to its entry. CSV, plain text, JSON and Excel are editable for now; Word and
// PowerPoint are view only, and their Edit toggles turn on by themselves once their entries have `editing`.
export const formatDefinitions: FormatDefinition[] = [
  {
    viewerId: 'csv',
    addedOn: '2026-10-05',
    highlights: ['highlights.csv.open', 'highlights.csv.edit', 'highlights.csv.large'],
    ViewerComponent: lazy(loadCsvViewer),
    preloadViewer: loadCsvViewer,
    ownsWholePage: true,
    canMask: true,
    editing: {
      createEmptyEdits: createEmptyCsvEdits,
      countChanges: (edits) => countCsvEdits(edits as CsvEdits),
      describeChanges: (edits, locale) => describeCsvChanges(edits as CsvEdits, locale),
      alwaysEditable: true,
    },
  },
  {
    viewerId: 'text',
    addedOn: '2026-10-14',
    highlights: ['highlights.text.view', 'highlights.text.edit', 'highlights.text.endings'],
    ViewerComponent: lazy(loadTextViewer),
    preloadViewer: loadTextViewer,
    ownsWholePage: true,
    editing: {
      createEmptyEdits: createEmptyTextEdits,
      countChanges: countTextChanges,
      describeChanges: describeTextChanges,
      alwaysEditable: true,
    },
  },
  {
    viewerId: 'json',
    addedOn: '2026-10-14',
    highlights: ['highlights.json.views', 'highlights.json.edit', 'highlights.json.errors'],
    ViewerComponent: lazy(loadJsonViewer),
    // Parsing a tiny document starts the parse worker once, so its file is cached too.
    preloadViewer: () => Promise.all([loadJsonViewer(), parseJsonText('null', 'en')]),
    ownsWholePage: true,
    // Measured 2026-10-16: up to 10 MB every action takes a third of a second or less; at 50 MB a tree edit takes 1.6 s and the
    // page holds 1 GB of memory.
    maxFileBytes: 10 * 1024 * 1024,
    canMask: true,
    editing: {
      createEmptyEdits: createEmptyJsonEdits,
      countChanges: countJsonChanges,
      describeChanges: describeJsonChanges,
      alwaysEditable: true,
    },
  },
  {
    viewerId: 'excel',
    addedOn: '2026-10-15',
    highlights: ['highlights.excel.open', 'highlights.excel.edit', 'highlights.excel.format'],
    ViewerComponent: lazy(loadExcelViewer),
    preloadViewer: () => Promise.all([loadExcelViewer(), loadExcelEditing(), import('./excel/excelStyles').then((stylesFile) => stylesFile.loadExcelJs())]),
    canMask: true,
    editing: {
      createEmptyEdits: createEmptyExcelEdits,
      countChanges: (edits) => countExcelEdits(edits as ExcelEdits),
      describeChanges: (edits, locale) => describeExcelChanges(edits as ExcelEdits, locale),
      loadEditingModule: () => loadExcelEditing().then((editingFile) => editingFile.excelEditingModule),
      alwaysEditable: true,
    },
  },
  {
    viewerId: 'word',
    addedOn: '2026-11-02',
    highlights: ['highlights.word.view', 'highlights.word.rtl', 'highlights.word.print'],
    ViewerComponent: lazy(loadWordViewer),
    preloadViewer: loadWordViewer,
    ownsWholePage: true,
  },
  { viewerId: 'pdf', ViewerComponent: comingSoonViewer, ownsWholePage: true },
  {
    viewerId: 'powerpoint',
    addedOn: '2026-11-02',
    highlights: ['highlights.powerpoint.view', 'highlights.powerpoint.thumbnails', 'highlights.powerpoint.fullscreen'],
    ViewerComponent: lazy(loadPowerPointViewer),
    preloadViewer: loadPowerPointViewer,
    ownsWholePage: true,
  },
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

// Saves text (or bytes) as a file by clicking a temporary link to it.
export function downloadTextFile(fileName: string, fileText: BlobPart, mimeType: string) {
  const downloadUrl = URL.createObjectURL(new Blob([fileText], { type: mimeType }))
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = fileName
  downloadLink.click()
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}
