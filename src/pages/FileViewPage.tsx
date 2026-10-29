import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChangeCounter, downloadEditedFile } from '../components/EditControls'
import MenuBar from '../components/MenuBar'
import type { MenuDefinition } from '../components/MenuBar'
import { Notice, REJECTED_FILE_TOAST_SECONDS, useToast } from '../components/Messages'
import { findFormatForFileName } from '../formats/registry'
import type { EditingModule } from '../formats/registry'
import type { ExcelSelection } from '../formats/excel/excelModel'
import { SheetIconSprite, TopBar, useIsNarrowScreen, useThemeToggle } from '../formats/sheet/SheetChrome'
import '../formats/sheet/sheetChrome.css'
import { useEditSession } from '../formats/useEditSession'
import { localizePath, useT } from '../i18n'
import { formatFileSize, useFileIntake } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import { findViewerForFileName, supportedExtensions } from '../viewers'
import type { ConversionTarget } from '../viewers'

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
  const { showToast } = useToast()
  const viewer = findViewerForFileName(openedFile.file.name)
  const format = findFormatForFileName(openedFile.file.name)
  const editing = format?.editing
  const session = useEditSession<unknown>(editing?.createEmptyEdits ?? noEdits, editing?.countChanges ?? countNoEdits)
  // Every editable format opens ready to edit; one that cannot be edited yet only shows the file.
  const mode = editing ? 'edit' : 'view'
  const [editingModule, setEditingModule] = useState<EditingModule | null>(null)
  const [editingLoadFailed, setEditingLoadFailed] = useState(false)
  const [selection, setSelection] = useState<unknown>(null)
  const [viewerCommands, setViewerCommands] = useState<unknown>(null)
  const [exportSource, setExportSource] = useState<unknown>(null)
  const { undo, redo } = session
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const hasUnsavedEdits = session.changeCount > 0
  const changeDescription = useMemo(() => editing?.describeChanges(session.edits, locale) ?? '', [editing, session.edits, locale])

  // The editing code is fetched as the file opens.
  useEffect(() => {
    if (editing?.alwaysEditable) editing.loadEditingModule?.().then(setEditingModule, () => setEditingLoadFailed(true))
  }, [editing])

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

  function openConvertedFile(convertedFile: File) {
    void convertedFile.arrayBuffer().then((convertedContents) => onReplaceFile(convertedFile, convertedContents))
  }

  const confirmBeforeClear = useCallback(async () => !hasUnsavedEdits || (await confirmDiscardEdits()), [hasUnsavedEdits, confirmDiscardEdits])
  const closeAfterConfirm = useCallback(async () => {
    if (await confirmBeforeClear()) onClose()
  }, [confirmBeforeClear, onClose])

  if (!format) return null
  const Viewer = format.ViewerComponent

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
        onOpenConvertedFile={openConvertedFile}
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

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: anotherFileIntake.openFilePicker },
        { id: 'download', label: t('menu.download'), icon: 'download', isDisabled: !editingModule || exportSource === null, onSelect: () => void downloadFile() },
        { id: 'revert-all', label: t('toolbar.revertAll'), icon: 'undo', isDisabled: !hasUnsavedEdits, onSelect: session.revertAll },
        ...(changeDescription ? [{ id: 'menu-changes-note', note: changeDescription }] : []),
        'separator',
        { id: 'close', label: t('menu.close'), icon: 'x', onSelect: () => void closeAfterConfirm() },
      ],
    },
    ...(editingModule?.getMenus?.(selection, viewerCommands, locale) ?? []),
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        { id: 'menu-link-privacy', label: t('legal.privacy'), icon: 'lock', href: localizePath(locale, '/privacy') },
        { id: 'menu-link-terms', label: t('legal.terms'), icon: 'file', href: localizePath(locale, '/terms') },
        { id: 'menu-disclaimer', note: t('legal.disclaimer') },
      ],
    },
  ]

  async function downloadFile() {
    if (editingModule) await downloadEditedFile(openedFile, editingModule, session.edits, exportSource, hasUnsavedEdits)
  }

  // The workbook as Download would save it, edits included; the sheet on screen is converted and opened in its new viewer.
  async function convertFile(convertTo: ConversionTarget) {
    if (!editingModule || !viewer) return
    const fileContents = await editingModule.downloadOption.createFile(session.edits, exportSource, { includeByteOrderMark: false })
    const { convertForViewer } = await import('../formats/conversion')
    const activeSheetName = (selection as ExcelSelection | null)?.activeSheetName
    const result = await convertForViewer(new File([fileContents], openedFile.file.name), viewer.id, convertTo, locale, activeSheetName)
    if ('error' in result) showToast({ message: result.error, kind: 'error' })
    else openConvertedFile(result.file)
  }
  const canConvert = viewer?.id === 'excel' && Boolean(editingModule) && exportSource !== null

  // The spreadsheet frame (Excel), the same as the CSV page's: title row, menu bar, one slim toolbar, then the workbook.
  return (
    <div id="file-page" data-file-type={viewer?.id} data-dragging={anotherFileIntake.isDraggingOver} {...anotherFileIntake.dropTargetProps}>
      <div id="excel-workbench" className="sidebar-closed">
      <SheetIconSprite />
      <TopBar
        format="xlsx"
        fileName={openedFile.file.name}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={hasUnsavedEdits}
        canUndo={session.canUndo}
        canRedo={session.canRedo}
        onUndo={undo}
        onRedo={redo}
        canDownload={Boolean(editingModule) && exportSource !== null}
        downloadLabel={editingModule && exportSource !== null ? editingModule.downloadOption.getLabel(exportSource, locale) : t('toolbar.download')}
        downloadTip={editingModule && exportSource !== null ? editingModule.describeDownload(exportSource, locale) : t('toolbar.download')}
        onDownload={() => void downloadFile()}
        onHome={() => void closeAfterConfirm()}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        convertItems={
          canConvert
            ? [
                { id: 'to-csv', label: t('convert.toCsv'), onSelect: () => void convertFile('csv') },
                { id: 'to-json', label: t('convert.toJson'), onSelect: () => void convertFile('json') },
              ]
            : []
        }
      />
      <MenuBar
        menus={menus}
        isCompact={isNarrow}
        label={t('menu.bar')}
        tools={editingModule?.ToolbarContent && <editingModule.ToolbarContent selection={selection} commands={viewerCommands} />}
      />
      {/* The change count is in the File menu; screen readers still hear it as it changes. */}
      <div className="sr-only">
        <ChangeCounter description={changeDescription} />
      </div>
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
    </div>
  )
}
