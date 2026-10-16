import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChangeCounter, EditToolbar, ViewEditToggle } from '../components/EditControls'
import FileViewHeader from '../components/FileViewHeader'
import { Notice, REJECTED_FILE_TOAST_SECONDS } from '../components/Messages'
import { FILE_SAVED_EVENT, findFormatForFileName } from '../formats/registry'
import type { EditingModule, ViewMode } from '../formats/registry'
import { useEditSession } from '../formats/useEditSession'
import { localizePath, translateWithNodes, useT } from '../i18n'
import { useFileIntake } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import { findViewerForFileName, supportedExtensions } from '../viewers'
import { pickRelatedFormat } from '../whatsNew'

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
  const { locale, t } = useT()
  const viewer = findViewerForFileName(openedFile.file.name)
  const format = findFormatForFileName(openedFile.file.name)
  const editing = format?.editing
  const session = useEditSession<unknown>(editing?.createEmptyEdits ?? noEdits, editing?.countChanges ?? countNoEdits)
  const [mode, setMode] = useState<ViewMode>(editing?.alwaysEditable ? 'edit' : 'view')
  const [editingModule, setEditingModule] = useState<EditingModule | null>(null)
  const [editingLoadFailed, setEditingLoadFailed] = useState(false)
  const [selection, setSelection] = useState<unknown>(null)
  const [viewerCommands, setViewerCommands] = useState<unknown>(null)
  const [exportSource, setExportSource] = useState<unknown>(null)
  // One tip after a save, closed in React state only (nothing is stored); the page's key resets it for the next file.
  const [isSaveTipShown, setIsSaveTipShown] = useState(false)
  const { undo, redo } = session
  const hasUnsavedEdits = session.changeCount > 0
  const changeDescription = useMemo(() => editing?.describeChanges(session.edits, locale) ?? '', [editing, session.edits, locale])

  // The editing code is fetched the first time Edit is chosen, never while only viewing.
  function chooseMode(newMode: ViewMode) {
    setMode(newMode)
    if (newMode === 'edit' && editing && !editingModule) {
      editing.loadEditingModule?.().then(setEditingModule, () => setEditingLoadFailed(true))
    }
  }

  // An always-editable format (JSON) loads its tools straight away.
  useEffect(() => {
    if (editing?.alwaysEditable) editing.loadEditingModule?.().then(setEditingModule, () => setEditingLoadFailed(true))
  }, [editing])

  useEffect(() => {
    onUnsavedEditsChange(hasUnsavedEdits)
    return () => onUnsavedEditsChange(false)
  }, [hasUnsavedEdits, onUnsavedEditsChange])

  useEffect(() => {
    function showTipAfterSave() {
      setIsSaveTipShown(true)
    }
    window.addEventListener(FILE_SAVED_EVENT, showTipAfterSave)
    return () => window.removeEventListener(FILE_SAVED_EVENT, showTipAfterSave)
  }, [])

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
  const closeAfterConfirm = useCallback(async () => {
    if (await confirmBeforeClear()) onClose()
  }, [confirmBeforeClear, onClose])

  if (!format) return null
  const Viewer = format.ViewerComponent
  const tipFormat = viewer ? pickRelatedFormat(viewer.id) : undefined

  const fileMessages = (
    <div id="file-messages" aria-live="polite">
      <Notice
        id="another-file-error"
        kind={anotherFileIntake.errorDetail ? 'info' : 'error'}
        alwaysToast
        seconds={REJECTED_FILE_TOAST_SECONDS}
        attempt={anotherFileIntake.attemptCount}
        message={anotherFileIntake.errorMessage ?? ''}
        detail={anotherFileIntake.errorDetail ?? undefined}
      />
      <Notice
        id="another-file-coming-soon"
        kind="info"
        alwaysToast
        seconds={REJECTED_FILE_TOAST_SECONDS}
        attempt={anotherFileIntake.attemptCount}
        message={anotherFileIntake.comingSoonViewer ? t('intake.comingSoon', { format: anotherFileIntake.comingSoonViewer.label }) : ''}
        detail={t('intake.tryThese')}
      />
      <Notice
        id="another-file-warning"
        kind="warning"
        className="border-b border-rule bg-paper-raised px-4 py-2"
        message={anotherFileIntake.largeFileWarning ?? ''}
      />
    </div>
  )

  const viewerElement = (
    <Suspense fallback={<p id="file-loading" className="p-6 text-ink-soft">{t('file.reading')}</p>}>
      <Viewer
        openedFile={openedFile}
        mode={mode}
        session={session}
        editingComponents={editingModule?.components ?? null}
        confirmDiscardEdits={confirmDiscardEdits}
        onOpenAnotherFile={anotherFileIntake.openFilePicker}
        onOpenFile={(file) => anotherFileIntake.openFiles([file])}
        onClose={() => void closeAfterConfirm()}
        onSelectionChange={setSelection}
        onCommandsChange={setViewerCommands}
        onExportSourceChange={setExportSource}
      />
    </Suspense>
  )

  // A format that draws the whole screen (JSON) gets only the file chooser, the messages and dropping a file anywhere.
  if (format.ownsWholePage) {
    return (
      <div id="file-page" data-file-type={viewer?.id} data-dragging={anotherFileIntake.isDraggingOver} {...anotherFileIntake.dropTargetProps}>
        {anotherFileIntake.fileInput}
        {fileMessages}
        {viewerElement}
      </div>
    )
  }

  return (
    <div id="file-page" data-file-type={viewer?.id} className="flex h-dvh flex-col bg-paper font-sans text-[14px] leading-normal text-ink">
      <FileViewHeader
        openedFile={openedFile}
        onClose={onClose}
        onBeforeClear={confirmBeforeClear}
        onOpenAnotherFile={anotherFileIntake.openFilePicker}
        controls={
          editing && (
            <>
              {!editing.alwaysEditable && <ViewEditToggle mode={mode} onChange={chooseMode} />}
              <ChangeCounter description={changeDescription} />
            </>
          )
        }
      />
      {isSaveTipShown && tipFormat && (
        <div id="save-tip" role="status" className="flex items-center gap-3 border-b border-rule bg-paper-raised px-4 py-1.5 text-sm">
          <p id="save-tip-message" className="min-w-0 flex-1">
            {translateWithNodes(locale, 'tip.alsoOpens', {
              format: (
                <a href={localizePath(locale, tipFormat.viewer.toolPath as string)} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:text-accent">
                  {tipFormat.viewer.label}
                </a>
              ),
            })}
          </p>
          <button
            id="save-tip-close-button"
            type="button"
            aria-label={t('tip.close')}
            onClick={() => setIsSaveTipShown(false)}
            className="control-shape grid size-8 shrink-0 cursor-pointer place-items-center transition-colors duration-200 hover:bg-paper"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      )}
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
      {fileMessages}
      <Notice
        id="editing-load-error"
        kind="error"
        role="alert"
        className="border-b border-rule bg-paper-raised px-4 py-2 text-danger"
        message={editingLoadFailed ? t('file.editingLoadFailed') : ''}
      />
      {viewerElement}
    </div>
  )
}
