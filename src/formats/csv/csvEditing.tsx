// This module is fetched on demand, not hot-reloaded as a component file, so the fast-refresh rule does not apply.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { FocusEventHandler, KeyboardEventHandler } from 'react'
import Papa from 'papaparse'
import { compactSecondaryButtonClassName, textControlClassName } from '../../buttonStyles'
import ModalDialog from '../../components/ModalDialog'
import type { EditingModule, EditorTool, ExportOption } from '../registry'
import type { EditSession } from '../useEditSession'
import { getCellText, withCellText, withDeletedLine, withInsertedLine } from './csvCells'
import type { CellPosition, CsvEdits, CsvExportSource, CsvSelection, CsvViewerCommands } from './csvCells'

// Everything in this file is loaded only when Edit is first used.

function setSelectedCellText(session: EditSession<unknown>, selection: unknown, newText: string) {
  const { cell, originalText } = selection as NonNullable<CsvSelection>
  if (!cell) return
  session.update((edits) => withCellText(edits as CsvEdits, cell, originalText, newText))
}

function addRowBelowSelection(session: EditSession<unknown>, selection: unknown, commands: unknown) {
  const { cell, lastRowId } = selection as NonNullable<CsvSelection>
  const newRowId = (session.edits as CsvEdits).nextRowId
  session.update((currentEdits) => withInsertedLine(currentEdits as CsvEdits, 'row', cell?.rowId ?? lastRowId))
  ;(commands as CsvViewerCommands).revealCell({ rowId: newRowId, columnId: cell?.columnId })
}

function deleteSelectedRow(session: EditSession<unknown>, selection: unknown) {
  const { cell } = selection as NonNullable<CsvSelection>
  if (!cell) return
  session.update((edits) => withDeletedLine(edits as CsvEdits, 'row', cell.rowId))
}

const hasSelectedCell = (selection: unknown) => (selection as CsvSelection)?.cell != null

const tools: EditorTool[] = [
  {
    id: 'find-replace',
    label: 'Find and replace',
    isEnabled: (selection) => selection !== null,
    run: (_session, _selection, commands) => (commands as CsvViewerCommands).toggleFindReplace(),
  },
  {
    id: 'add-row',
    label: 'Add row',
    isEnabled: (selection) => selection !== null,
    run: addRowBelowSelection,
  },
  { id: 'delete-row', label: 'Delete row', isEnabled: hasSelectedCell, run: deleteSelectedRow },
  {
    id: 'clear-cell',
    label: 'Clear cell',
    isEnabled: hasSelectedCell,
    run: (session, selection) => setSelectedCellText(session, selection, ''),
  },
  {
    id: 'revert-cell',
    label: 'Revert cell',
    isEnabled: (selection) => (selection as CsvSelection)?.isEdited === true,
    run: (session, selection) => setSelectedCellText(session, selection, (selection as NonNullable<CsvSelection>).originalText),
  },
]

// The file the Download icon saves: the header (when the file has one) and the rows the search leaves, in the current sort
// order, with the edits applied and the deleted and added columns taken into account.
const downloadOption: ExportOption = {
  id: 'csv',
  label: 'Download CSV',
  extension: null,
  mimeType: 'text/csv;charset=utf-8',
  createFile(edits, exportSource, settings) {
    const source = exportSource as CsvExportSource
    const dataRows = source.visibleRowIds.map((rowId) =>
      source.displayColumnIds.map((columnId) => getCellText(source.rows, edits as CsvEdits, rowId, columnId)),
    )
    const headerRows = source.hasHeaderRow ? [source.displayColumnIds.map((columnId) => getCellText(source.rows, edits as CsvEdits, 0, columnId))] : []
    const csvText = Papa.unparse([...headerRows, ...dataRows], { delimiter: source.detectedDelimiter })
    return settings.includeByteOrderMark ? `\uFEFF${csvText}` : csvText
  },
}

function describeDownload(exportSource: unknown) {
  return `visible rows (${(exportSource as CsvExportSource).visibleRowIds.length.toLocaleString()})`
}

// Excel needs a byte order mark to show Arabic and other non-ASCII text correctly in a CSV.
function getDefaultByteOrderMark(exportSource: unknown) {
  const source = exportSource as CsvExportSource
  return source.hadByteOrderMark || source.rows.some((row) => row.some((cellText) => /[^\p{ASCII}]/u.test(cellText)))
}

type EditBarProps = {
  selectedCellLabel: string
  isDisabled: boolean
  value: string
  onChange: (newValue: string) => void
  onKeyDown: KeyboardEventHandler<HTMLInputElement>
  onBlur: FocusEventHandler<HTMLInputElement>
}

// The cell address and the value field that edits the selected cell.
function EditBar({ selectedCellLabel, isDisabled, value, onChange, onKeyDown, onBlur }: EditBarProps) {
  return (
    <>
      <p
        aria-label="Selected cell"
        className="control-shape solid-box flex min-h-9 pointer-coarse:min-h-11 min-w-16 shrink-0 items-center justify-center border-rule bg-paper-raised px-3 font-mono text-sm"
      >
        {selectedCellLabel}
      </p>
      <input
        dir="auto"
        aria-label="Value of the selected cell"
        placeholder="Select a cell to see or edit its value"
        disabled={isDisabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={`${textControlClassName} min-w-48 flex-1 disabled:cursor-not-allowed disabled:text-ink-soft`}
      />
    </>
  )
}

type CellInputProps = {
  ariaLabel: string
  draft: string
  onDraftChange: (newDraft: string) => void
  onFinish: (shouldCommit: boolean, moveAfter?: 'down' | 'right') => void
  onBlur: () => void
}

// The text box that appears inside a cell (or a column header) while it is being edited.
function CellInput({ ariaLabel, draft, onDraftChange, onFinish, onBlur }: CellInputProps) {
  return (
    <input
      autoFocus
      dir="auto"
      aria-label={ariaLabel}
      value={draft}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onDraftChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onFinish(true, 'down')
        } else if (event.key === 'Tab') {
          event.preventDefault()
          onFinish(true, 'right')
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onFinish(false)
        }
      }}
      onBlur={onBlur}
      className="absolute inset-0 w-full bg-paper-raised px-3 outline-none"
    />
  )
}

type FindReplaceBarProps = {
  findText: string
  replaceText: string
  matchCase: boolean
  matchCount: number
  resultMessage: string
  onFindChange: (newText: string) => void
  onReplaceChange: (newText: string) => void
  onMatchCaseChange: (newValue: boolean) => void
  onReplaceAll: () => void
  onClose: () => void
}

// Find and replace over every shown cell: a live count of matching cells and "Replace all" as one undoable change.
function FindReplaceBar({
  findText,
  replaceText,
  matchCase,
  matchCount,
  resultMessage,
  onFindChange,
  onReplaceChange,
  onMatchCaseChange,
  onReplaceAll,
  onClose,
}: FindReplaceBarProps) {
  const matchMessage = matchCount === 0 ? 'No matches' : `${matchCount.toLocaleString()} ${matchCount === 1 ? 'cell matches' : 'cells match'}`
  const countMessage = resultMessage || (findText === '' ? '' : matchMessage)
  return (
    <div
      role="search"
      aria-label="Find and replace"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      className="flex flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2"
    >
      <label className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">Find</span>
        <input autoFocus dir="auto" value={findText} onChange={(event) => onFindChange(event.target.value)} className={`${textControlClassName} w-44`} />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">Replace with</span>
        <input dir="auto" value={replaceText} onChange={(event) => onReplaceChange(event.target.value)} className={`${textControlClassName} w-44`} />
      </label>
      <label className="flex min-h-9 pointer-coarse:min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={matchCase} onChange={(event) => onMatchCaseChange(event.target.checked)} className="size-4 pointer-coarse:size-5" />
        Match case
      </label>
      <p role="status" aria-live="polite" className="min-w-28 text-sm font-medium">
        {countMessage}
      </p>
      <button
        type="button"
        disabled={findText === '' || matchCount === 0}
        onClick={onReplaceAll}
        className="control-shape solid-box min-h-9 pointer-coarse:min-h-11 cursor-pointer border-ink px-3 text-sm font-medium transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        Replace all
      </button>
      <button type="button" onClick={onClose} className="control-shape min-h-9 pointer-coarse:min-h-11 cursor-pointer px-3 text-sm transition-colors duration-200 hover:bg-paper-raised">
        Close
      </button>
    </div>
  )
}

export type ChangeRow = {
  key: string
  position: CellPosition
  address: string
  columnName: string
  originalText: string
  newText: string
  isVisible: boolean
}

type ChangesControlProps = {
  // The first edited cells, and how many cells are edited in all.
  changeRows: ChangeRow[]
  changedCellCount: number
  // "1 row added, 2 rows deleted": the changes that are not cell edits, which are listed below.
  structureSummary: string
  onRevertCell: (key: string) => void
  onRevertAll: () => void
  onGoToCell: (position: CellPosition) => void
}

// A button that opens the list of every edited cell with the old and new value, a Revert and a Go to for each. The list is a
// modal dialog, so it always sits above the table.
function ChangesControl({ changeRows, changedCellCount, structureSummary, onRevertCell, onRevertAll, onGoToCell }: ChangesControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChanges = changedCellCount > 0 || structureSummary !== ''

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen && hasChanges}
        disabled={!hasChanges}
        onClick={() => setIsOpen(true)}
        className="control-shape solid-box min-h-9 pointer-coarse:min-h-11 shrink-0 cursor-pointer border-rule px-3 text-sm transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review changes
      </button>

      {isOpen && hasChanges && (
        <ModalDialog title="Changes" onClose={() => setIsOpen(false)} widthClassName="w-[min(30rem,calc(100vw-2rem))]">
          <div className="mt-3 flex items-center justify-between gap-3">
            {structureSummary ? <p className="text-ink-soft">{structureSummary}</p> : <span />}
            <button
              type="button"
              onClick={() => {
                onRevertAll()
                setIsOpen(false)
              }}
              className={compactSecondaryButtonClassName}
            >
              Revert all
            </button>
          </div>
          <ul className="mt-3 divide-y divide-rule">
            {changeRows.map((change) => (
              <li key={change.key} className="flex items-center gap-2 py-2">
                <button
                  type="button"
                  disabled={!change.isVisible}
                  title={change.isVisible ? 'Go to this cell' : 'Hidden by the current search'}
                  onClick={() => {
                    setIsOpen(false)
                    // The page behind a modal dialog cannot take focus, so go to the cell once the dialog is gone.
                    window.setTimeout(() => onGoToCell(change.position), 0)
                  }}
                  className="min-w-0 flex-1 cursor-pointer text-start disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="font-mono text-sm text-ink-soft">
                    {change.address} · {change.columnName}
                  </span>
                  <span dir="auto" className="block truncate text-left text-ink-soft line-through">
                    {change.originalText === '' ? '(empty)' : change.originalText}
                  </span>
                  <span dir="auto" className="block truncate text-left font-medium">
                    {change.newText === '' ? '(empty)' : change.newText}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Revert ${change.address}`}
                  onClick={() => onRevertCell(change.key)}
                  className="control-shape min-h-9 pointer-coarse:min-h-11 shrink-0 cursor-pointer px-3 text-sm font-medium transition-colors duration-200 hover:bg-paper"
                >
                  Revert
                </button>
              </li>
            ))}
          </ul>
          {changedCellCount > changeRows.length && (
            <p className="mt-3 text-sm text-ink-soft">
              And {(changedCellCount - changeRows.length).toLocaleString()} more edited cells. "Revert all" undoes every one of them.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => setIsOpen(false)} className={compactSecondaryButtonClassName}>
              Close
            </button>
          </div>
        </ModalDialog>
      )}
    </>
  )
}

type ColumnMenuProps = {
  // Where the header's name button is on screen; the menu opens right under it.
  left: number
  top: number
  canRename: boolean
  canDelete: boolean
  onRename: () => void
  onAddColumnAfter: () => void
  onDelete: () => void
  onClose: () => void
}

// The menu under a column header in Edit mode. It is a popover, drawn in the top layer so the table can never cover it;
// Esc and a click outside close it, the arrow keys move between items.
function ColumnMenu({ left, top, canRename, canDelete, onRename, onAddColumnAfter, onDelete, onClose }: ColumnMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = menuRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    menu?.showPopover()
    menu?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    return () => {
      // Give focus back to the header name, unless the chosen action already moved it (e.g. into the rename box).
      const focusMovedElsewhere = document.activeElement !== document.body && !menu?.contains(document.activeElement)
      if (menu?.matches(':popover-open')) menu.hidePopover()
      if (!focusMovedElsewhere && opener?.isConnected) opener.focus()
    }
  }, [])

  function runAndClose(action: () => void) {
    action()
    onClose()
  }

  const itemClassName =
    'min-h-9 pointer-coarse:min-h-11 w-full cursor-pointer rounded px-3 text-start text-sm transition-colors duration-200 hover:bg-paper focus-visible:bg-paper disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div
      ref={menuRef}
      popover="auto"
      role="menu"
      aria-label="Column actions"
      onToggle={(event) => {
        if (event.newState === 'closed') onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'))
        const position = items.indexOf(document.activeElement as HTMLElement)
        const step = event.key === 'ArrowDown' ? 1 : -1
        items[(position + step + items.length) % items.length]?.focus()
      }}
      style={{ left, top }}
      className="box-shape solid-box fixed m-0 w-52 border-rule bg-paper-raised p-1 text-ink"
    >
      <button
        type="button"
        role="menuitem"
        disabled={!canRename}
        title={canRename ? undefined : 'Turn on "First row is header" to rename columns'}
        onClick={() => runAndClose(onRename)}
        className={itemClassName}
      >
        Rename column
      </button>
      <button type="button" role="menuitem" onClick={() => runAndClose(onAddColumnAfter)} className={itemClassName}>
        Add column after
      </button>
      <button type="button" role="menuitem" disabled={!canDelete} onClick={() => runAndClose(onDelete)} className={itemClassName}>
        Delete column
      </button>
    </div>
  )
}

export type CsvEditingComponents = {
  EditBar: typeof EditBar
  CellInput: typeof CellInput
  ChangesControl: typeof ChangesControl
  FindReplaceBar: typeof FindReplaceBar
  ColumnMenu: typeof ColumnMenu
}

export const csvEditingModule: EditingModule = {
  tools,
  downloadOption,
  describeDownload,
  getDefaultByteOrderMark,
  components: { EditBar, CellInput, ChangesControl, FindReplaceBar, ColumnMenu } satisfies CsvEditingComponents,
}
