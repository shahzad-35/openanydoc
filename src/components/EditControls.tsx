import type { ReactNode } from 'react'
import { useT } from '../i18n'
import { buildDownloadName, downloadTextFile } from '../formats/registry'
import type { EditingModule } from '../formats/registry'
import type { EditSession } from '../formats/useEditSession'
import type { OpenedFile } from '../useFileIntake'

const toolbarButtonClassName =
  'control-shape solid-box min-h-8 pointer-coarse:min-h-11 shrink-0 cursor-pointer border-rule px-3 text-[13px] transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50'

const historyButtonClassName =
  'control-shape grid size-8 pointer-coarse:size-11 shrink-0 cursor-pointer place-items-center transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:text-ink/40'

function HistoryIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 pointer-coarse:size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

// A live region: screen readers hear "3 edited cells, 1 row deleted" whenever it changes.
export function ChangeCounter({ description }: { description: string }) {
  return (
    <p id="change-counter" role="status" aria-live="polite" className="shrink-0 text-sm font-medium">
      {description !== '' && (
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-edit-mark" />
          {description}
        </span>
      )}
    </p>
  )
}

// One click saves the file with every edit, named like sales-edited.xlsx.
export async function downloadEditedFile(openedFile: OpenedFile, editingModule: EditingModule, edits: unknown, exportSource: unknown, hasEdits: boolean) {
  const { downloadOption } = editingModule
  downloadTextFile(
    buildDownloadName(openedFile.file.name, hasEdits, downloadOption.extension),
    await downloadOption.createFile(edits, exportSource, { includeByteOrderMark: editingModule.getDefaultByteOrderMark(exportSource) }),
    downloadOption.getMimeType(exportSource),
  )
}

type EditToolbarProps = {
  session: EditSession<unknown>
  editingModule: EditingModule | null
  selection: unknown
  viewerCommands: unknown
  changeDescription: string
}

// The slim toolbar under the menu bar: revert all, then this format's own tools, and the live count of changes at the end.
// Undo, redo and Download are in the title row.
export function EditToolbar({ session, editingModule, selection, viewerCommands, changeDescription }: EditToolbarProps) {
  const { t } = useT()
  return (
    <div id="edit-toolbar" role="toolbar" aria-label={t('toolbar.label')}>
      <div id="edit-toolbar-tools">
        <button id="revert-all-button" type="button" disabled={session.changeCount === 0} onClick={session.revertAll} aria-label={t('toolbar.revertAll')} data-tip={t('toolbar.revertAll')} className={historyButtonClassName}>
          <HistoryIcon>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 8v4l3 2" />
          </HistoryIcon>
        </button>
        {editingModule?.ToolbarContent ? <editingModule.ToolbarContent selection={selection} commands={viewerCommands} /> : <p className="text-sm text-ink-soft">{t('toolbar.loading')}</p>}
        {editingModule?.tools.map((tool) => (
          <button key={tool.id} id={`tool-${tool.id}-button`} type="button" disabled={!tool.isEnabled(selection)} onClick={() => tool.run(session, selection, viewerCommands)} className={toolbarButtonClassName}>
            {tool.label}
          </button>
        ))}
      </div>
      <ChangeCounter description={changeDescription} />
    </div>
  )
}
