import type { EditingModule, ViewMode } from '../formats/registry'
import type { EditSession } from '../formats/useEditSession'
import type { OpenedFile } from '../useFileIntake'

const toolbarButtonClassName =
  'control-shape solid-box min-h-8 pointer-coarse:min-h-11 shrink-0 cursor-pointer border-rule px-3 text-[13px] transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50'

// "sales.csv" -> "sales-edited.csv" (or "sales-edited.json" when converting); an untouched copy keeps its name.
function buildDownloadName(fileName: string, hasEdits: boolean, newExtension: string | null) {
  const dotIndex = fileName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const extension = newExtension ?? (dotIndex > 0 ? fileName.slice(dotIndex) : '')
  return `${baseName}${hasEdits ? '-edited' : ''}${extension}`
}

function ModeIcon({ mode }: { mode: ViewMode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 pointer-coarse:size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {mode === 'view' ? (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" />
          <path d="m14.5 6 3.5 3.5" />
        </>
      )}
    </svg>
  )
}

const modeOptions = [
  { mode: 'view', label: 'View' },
  { mode: 'edit', label: 'Edit' },
] as const

// A sliding switch in the spirit of the light/dark toggle: the accent thumb glides to the chosen side. Each side is an
// icon (an eye to look, a pencil to edit) with no visible text; the names are in the tooltip and for screen readers.
export function ViewEditToggle({ mode, onChange }: { mode: ViewMode; onChange: (newMode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="Mode" className="control-shape solid-box relative grid shrink-0 grid-cols-2 border-ink bg-paper p-0.5">
      <span
        aria-hidden="true"
        className={`control-shape absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] bg-accent transition-transform duration-300 ease-out ${
          mode === 'edit' ? 'translate-x-full' : ''
        }`}
      />
      {modeOptions.map(({ mode: optionMode, label }) => (
        <button
          key={optionMode}
          type="button"
          aria-pressed={mode === optionMode}
          title={label}
          onClick={() => onChange(optionMode)}
          className={`control-shape relative grid min-h-7 min-w-10 pointer-coarse:min-h-10 pointer-coarse:min-w-14 cursor-pointer place-items-center transition-colors duration-300 ${
            mode === optionMode ? 'text-on-accent' : 'text-ink hover:text-accent'
          }`}
        >
          <ModeIcon mode={optionMode} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}

// A live region: screen readers hear "3 edited cells, 1 row deleted" whenever it changes.
export function ChangeCounter({ description }: { description: string }) {
  return (
    <p role="status" aria-live="polite" className="shrink-0 text-sm font-medium">
      {description !== '' && (
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-edit-mark" />
          {description}
        </span>
      )}
    </p>
  )
}

type DownloadControlProps = {
  openedFile: OpenedFile
  editingModule: EditingModule
  edits: unknown
  exportSource: unknown
  hasEdits: boolean
}

// An icon only, and one click saves what you see: CSV with the edits, the current sort order and only the rows the search
// leaves, named like sales-edited.csv. The tooltip says which rows.
function DownloadControl({ openedFile, editingModule, edits, exportSource, hasEdits }: DownloadControlProps) {
  const { downloadOption } = editingModule
  const downloadLabel = exportSource === null ? 'Download' : `${downloadOption.label}: ${editingModule.describeDownload(exportSource)}`

  function downloadWhatYouSee() {
    const includeByteOrderMark = editingModule.getDefaultByteOrderMark(exportSource)
    const fileText = downloadOption.createFile(edits, exportSource, { includeByteOrderMark })
    const downloadUrl = URL.createObjectURL(new Blob([fileText], { type: downloadOption.mimeType }))
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = buildDownloadName(openedFile.file.name, hasEdits, downloadOption.extension)
    downloadLink.click()
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }

  return (
    <button
      type="button"
      disabled={exportSource === null}
      onClick={downloadWhatYouSee}
      aria-label={downloadLabel}
      title={downloadLabel}
      className="control-shape grid size-8 pointer-coarse:size-11 shrink-0 cursor-pointer place-items-center bg-accent text-on-accent transition duration-200 hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 pointer-coarse:size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v11" />
        <path d="m7 11 5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
    </button>
  )
}

type EditToolbarProps = {
  openedFile: OpenedFile
  session: EditSession<unknown>
  editingModule: EditingModule | null
  selection: unknown
  viewerCommands: unknown
  exportSource: unknown
}

// Shown in Edit mode: undo, redo and revert all for every format, then this format's own tools and the Download icon.
export function EditToolbar({ openedFile, session, editingModule, selection, viewerCommands, exportSource }: EditToolbarProps) {
  return (
    <div role="toolbar" aria-label="Editing tools" className="flex items-start gap-2 border-b border-rule bg-paper px-4 py-1">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
      <button type="button" disabled={!session.canUndo} onClick={session.undo} title="Undo (Ctrl+Z)" className={toolbarButtonClassName}>
        Undo
      </button>
      <button type="button" disabled={!session.canRedo} onClick={session.redo} title="Redo (Ctrl+Shift+Z)" className={toolbarButtonClassName}>
        Redo
      </button>
      <button type="button" disabled={session.changeCount === 0} onClick={session.revertAll} className={toolbarButtonClassName}>
        Revert all
      </button>
      {editingModule?.tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          disabled={!tool.isEnabled(selection)}
          onClick={() => tool.run(session, selection, viewerCommands)}
          className={toolbarButtonClassName}
        >
          {tool.label}
        </button>
      ))}
      </div>
      <div className="shrink-0">
        {editingModule ? (
          <DownloadControl
            openedFile={openedFile}
            editingModule={editingModule}
            edits={session.edits}
            exportSource={exportSource}
            hasEdits={session.changeCount > 0}
          />
        ) : (
          <p className="text-sm text-ink-soft">Loading editing tools</p>
        )}
      </div>
    </div>
  )
}
