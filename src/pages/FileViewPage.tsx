import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChangeCounter, EditToolbar, ViewEditToggle } from '../components/EditControls'
import FileViewHeader from '../components/FileViewHeader'
import { findFormatForFileName } from '../formats/registry'
import type { EditingModule, ViewMode } from '../formats/registry'
import { useEditSession } from '../formats/useEditSession'
import { useFileIntake } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import { findViewerForFileName, supportedExtensions } from '../viewers'

type FileViewPageProps = {
  openedFile: OpenedFile
  onClose: () => void
  // Shows another file in place of this one (same page, no history entry).
  onReplaceFile: (file: File, fileContents: ArrayBuffer) => void
  // Resolves true when the visitor chose "Discard and start over" in the discard dialog.
  confirmDiscardEdits: () => Promise<boolean>
  // Tells App whether there are unsaved edits, so the browser's Back button can ask first.
  onUnsavedEditsChange: (hasUnsavedEdits: boolean) => void
}

const noEdits = () => null
const countNoEdits = () => 0

// The page a file opens on: the header, the View / Edit toggle, the edit toolbar and the format's viewer. It owns the edit
// session, so edits survive switching between View and Edit.
export default function FileViewPage({ openedFile, onClose, onReplaceFile, confirmDiscardEdits, onUnsavedEditsChange }: FileViewPageProps) {
  const viewer = findViewerForFileName(openedFile.file.name)
  const format = findFormatForFileName(openedFile.file.name)
  const editing = format?.editing
  const session = useEditSession<unknown>(editing?.createEmptyEdits ?? noEdits, editing?.countChanges ?? countNoEdits)
  const [mode, setMode] = useState<ViewMode>('view')
  const [editingModule, setEditingModule] = useState<EditingModule | null>(null)
  const [editingLoadFailed, setEditingLoadFailed] = useState(false)
  const [selection, setSelection] = useState<unknown>(null)
  const [viewerCommands, setViewerCommands] = useState<unknown>(null)
  const [exportSource, setExportSource] = useState<unknown>(null)
  const { undo, redo } = session
  const hasUnsavedEdits = session.changeCount > 0
  const changeDescription = useMemo(() => editing?.describeChanges(session.edits) ?? '', [editing, session.edits])

  // The editing code is fetched the first time Edit is chosen, never while only viewing.
  function chooseMode(newMode: ViewMode) {
    setMode(newMode)
    if (newMode === 'edit' && editing && !editingModule) {
      editing.loadEditingModule().then(setEditingModule, () => setEditingLoadFailed(true))
    }
  }

  useEffect(() => {
    onUnsavedEditsChange(hasUnsavedEdits)
    return () => onUnsavedEditsChange(false)
  }, [hasUnsavedEdits, onUnsavedEditsChange])

  // Closing or reloading the tab with unsaved edits makes the browser ask first.
  useEffect(() => {
    if (!hasUnsavedEdits) return
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasUnsavedEdits])

  // Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes. Text boxes keep their own undo while typing.
  useEffect(() => {
    if (mode !== 'edit') return
    function undoOrRedoOnShortcut(event: KeyboardEvent) {
      const target = event.target
      const isTypingInTextBox = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      if (isTypingInTextBox || !(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) redo()
      else if (key === 'z') undo()
      else if (key === 'y') redo()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', undoOrRedoOnShortcut)
    return () => window.removeEventListener('keydown', undoOrRedoOnShortcut)
  }, [mode, undo, redo])

  // "Open another file" shows the system's own file chooser. The chosen file goes through the same checks as on the home
  // screen (accepted types, one file at a time, size warning, read errors); unsaved edits then ask before being replaced.
  const anotherFileIntake = useFileIntake({
    acceptedExtensions: supportedExtensions,
    allowPaste: false,
    onFileLoaded: async (file, fileContents) => {
      if (hasUnsavedEdits && !(await confirmDiscardEdits())) return
      onReplaceFile(file, fileContents)
    },
  })

  const confirmBeforeClear = useCallback(async () => !hasUnsavedEdits || (await confirmDiscardEdits()), [hasUnsavedEdits, confirmDiscardEdits])

  if (!format) return null
  const Viewer = format.ViewerComponent

  return (
    <div data-file-type={viewer?.id} className="flex h-dvh flex-col bg-paper font-sans text-[14px] leading-normal text-ink">
      <FileViewHeader
        openedFile={openedFile}
        onClose={onClose}
        onBeforeClear={confirmBeforeClear}
        onOpenAnotherFile={anotherFileIntake.openFilePicker}
        controls={
          editing && (
            <>
              <ViewEditToggle mode={mode} onChange={chooseMode} />
              <ChangeCounter description={changeDescription} />
            </>
          )
        }
      />
      {mode === 'edit' && (
        <EditToolbar
          openedFile={openedFile}
          session={session}
          editingModule={editingModule}
          selection={selection}
          viewerCommands={viewerCommands}
          exportSource={exportSource}
        />
      )}
      {anotherFileIntake.fileInput}
      <div aria-live="polite">
        {anotherFileIntake.errorMessage && (
          <p role="alert" className="border-b border-rule bg-paper-raised px-4 py-2 font-medium text-danger">
            {anotherFileIntake.errorMessage}
          </p>
        )}
        {anotherFileIntake.largeFileWarning && (
          <p className="border-b border-rule bg-paper-raised px-4 py-2">{anotherFileIntake.largeFileWarning}</p>
        )}
      </div>
      {editingLoadFailed && (
        <p role="alert" className="border-b border-rule bg-paper-raised px-4 py-2 text-danger">
          The editing tools could not be loaded. Check your connection and reload the page; the file is still open for viewing.
        </p>
      )}
      <Suspense fallback={<p className="p-6 text-ink-soft">Reading file</p>}>
        <Viewer
          openedFile={openedFile}
          mode={mode}
          session={session}
          editingComponents={editingModule?.components ?? null}
          confirmDiscardEdits={confirmDiscardEdits}
          onSelectionChange={setSelection}
          onCommandsChange={setViewerCommands}
          onExportSourceChange={setExportSource}
        />
      </Suspense>
    </div>
  )
}
