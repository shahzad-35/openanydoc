// This module is fetched on demand, not hot-reloaded as a component file, so the fast-refresh rule does not apply.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { FocusEventHandler, KeyboardEventHandler } from 'react'
import { compactSecondaryButtonClassName, textControlClassName } from '../../buttonStyles'
import FindReplaceBar from '../../components/FindReplaceBar'
import ModalDialog from '../../components/ModalDialog'
import { isolateLeftToRight, translate, translatePlural, useT } from '../../i18n'
import type { Locale } from '../../i18n'
import { Icon, IconButton, IconMenuButton } from '../../components/ToolbarControls'
import { CellInput } from '../DataTable'
import type { EditingModule, ExportOption } from '../registry'
import { buildCsvText } from './csvCells'
import type { CellPosition, CsvEdits, CsvExportSource, CsvSelection, CsvViewerCommands } from './csvCells'

// Everything in this file is loaded only when Edit is first used.

const hasSelectedCell = (selection: unknown) => (selection as CsvSelection)?.cell != null

// The icons in the page's edit toolbar, after Undo, Redo and Revert all: rows, columns, the selected cell, find and clean-up.
// Every action changes cell text or structure, so each one is saved in the downloaded file.
function CsvToolbar({ selection, commands }: { selection: unknown; commands: unknown }) {
  const { t, idFor } = useT()
  const getActions = (commands as CsvViewerCommands | null)?.getActions
  if (!getActions) return null
  const csvSelection = selection as CsvSelection
  const hasCell = hasSelectedCell(selection)
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  return (
    <>
      {divider}
      <IconMenuButton
        id={`toolbar-${idFor('csv.toolbar.rows')}`}
        label={t('csv.toolbar.rows')}
        isDisabled={!hasCell}
        items={[
          { id: idFor('csv.toolbar.insertRowAbove', true), label: t('csv.toolbar.insertRowAbove'), onSelect: () => getActions().insertRow('above') },
          { id: idFor('csv.toolbar.insertRowBelow', true), label: t('csv.toolbar.insertRowBelow'), onSelect: () => getActions().insertRow('below') },
          { id: idFor('csv.toolbar.deleteRow', true), label: t('csv.toolbar.deleteRow'), onSelect: () => getActions().deleteRow() },
        ]}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 10h18" />
          <path d="M3 15h18" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id={`toolbar-${idFor('csv.toolbar.columns')}`}
        label={t('csv.toolbar.columns')}
        isDisabled={!hasCell}
        items={[
          { id: idFor('csv.toolbar.insertColumnLeft', true), label: t('csv.toolbar.insertColumnLeft'), onSelect: () => getActions().insertColumn('left') },
          { id: idFor('csv.toolbar.insertColumnRight', true), label: t('csv.toolbar.insertColumnRight'), onSelect: () => getActions().insertColumn('right') },
          { id: idFor('csv.toolbar.deleteColumn', true), label: t('csv.toolbar.deleteColumn'), onSelect: () => getActions().deleteColumn(), isDisabled: (csvSelection?.columnCount ?? 0) < 2 },
        ]}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M9 4v16" />
          <path d="M15 4v16" />
        </Icon>
      </IconMenuButton>
      {divider}
      <IconButton id={`toolbar-${idFor('csv.toolbar.clearCell')}`} label={t('csv.toolbar.clearCell')} isDisabled={!hasCell} onClick={() => getActions().clearCell()}>
        <Icon>
          <path d="m7 21-4-4 11-11 7 7-6 6H7Z" />
          <path d="M9 11l6 6" />
        </Icon>
      </IconButton>
      <IconButton id={`toolbar-${idFor('csv.toolbar.revertCell')}`} label={t('csv.toolbar.revertCell')} isDisabled={csvSelection?.isEdited !== true} onClick={() => getActions().revertCell()}>
        <Icon>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </Icon>
      </IconButton>
      {divider}
      <IconMenuButton
        id={`toolbar-${idFor('csv.toolbar.cleanUp')}`}
        label={t('csv.toolbar.cleanUp')}
        isDisabled={csvSelection === null}
        items={[
          { id: idFor('csv.toolbar.columnUpper', true), label: t('csv.toolbar.columnUpper'), onSelect: () => getActions().transformColumn('upper'), isDisabled: !hasCell },
          { id: idFor('csv.toolbar.columnLower', true), label: t('csv.toolbar.columnLower'), onSelect: () => getActions().transformColumn('lower'), isDisabled: !hasCell },
          { id: idFor('csv.toolbar.columnCapitalize', true), label: t('csv.toolbar.columnCapitalize'), onSelect: () => getActions().transformColumn('capitalize'), isDisabled: !hasCell },
          { id: idFor('csv.toolbar.columnTrim', true), label: t('csv.toolbar.columnTrim'), onSelect: () => getActions().transformColumn('trim'), isDisabled: !hasCell },
          { id: idFor('csv.toolbar.columnFillDown', true), label: t('csv.toolbar.columnFillDown'), onSelect: () => getActions().fillColumnDown(), isDisabled: !hasCell },
          { id: idFor('csv.toolbar.tableTrim', true), label: t('csv.toolbar.tableTrim'), onSelect: () => getActions().trimAllCells() },
          { id: idFor('csv.toolbar.tableRemoveEmpty', true), label: t('csv.toolbar.tableRemoveEmpty'), onSelect: () => getActions().removeEmptyRows() },
          { id: idFor('csv.toolbar.tableRemoveDuplicates', true), label: t('csv.toolbar.tableRemoveDuplicates'), onSelect: () => getActions().removeDuplicateRows() },
        ]}
      >
        <span className="text-[11px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconButton id={`toolbar-${idFor('find.label')}`} label={t('find.label')} isDisabled={csvSelection === null} onClick={() => (commands as CsvViewerCommands).toggleFindReplace()}>
        <Icon>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.5-4.5" />
        </Icon>
      </IconButton>
      {divider}
    </>
  )
}

// The file the Download icon saves: see buildCsvText for what it holds.
const downloadOption: ExportOption = {
  id: 'csv',
  getLabel: (exportSource, locale) => translate(locale, 'csv.download.label', { format: isolateLeftToRight((exportSource as CsvExportSource).tableFormat.label) }),
  extension: null,
  getMimeType: (exportSource) => `${(exportSource as CsvExportSource).tableFormat.mimeType};charset=utf-8`,
  createFile(edits, exportSource, settings) {
    const csvText = buildCsvText(edits as CsvEdits, exportSource as CsvExportSource)
    return settings.includeByteOrderMark ? `\uFEFF${csvText}` : csvText
  },
}

function describeDownload(exportSource: unknown, locale: Locale) {
  return translatePlural(locale, 'csv.download.rows', (exportSource as CsvExportSource).visibleRowIds.length)
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
  const { t } = useT()
  return (
    <>
      <p
        id="selected-cell-label"
        dir="ltr"
        aria-label={t('csv.selectedCell')}
        className="control-shape solid-box flex min-h-8 pointer-coarse:min-h-11 min-w-16 shrink-0 items-center justify-center border-rule bg-paper-raised px-3 font-mono text-sm"
      >
        {selectedCellLabel}
      </p>
      <input
        id="cell-value-input"
        dir="auto"
        aria-label={t('csv.valueOfCell')}
        placeholder={t('csv.valuePlaceholder')}
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
  const { t, tp, idFor } = useT()
  const [isOpen, setIsOpen] = useState(false)
  const hasChanges = changedCellCount > 0 || structureSummary !== ''

  return (
    <>
      <button
        id="review-changes-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen && hasChanges}
        disabled={!hasChanges}
        onClick={() => setIsOpen(true)}
        className="control-shape solid-box min-h-8 pointer-coarse:min-h-11 shrink-0 cursor-pointer border-rule px-3 text-sm transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('csv.changes.review')}
      </button>

      {isOpen && hasChanges && (
        <ModalDialog title={t('csv.changes.title')} id={`dialog-${idFor('csv.changes.title')}`} onClose={() => setIsOpen(false)} widthClassName="w-[min(30rem,calc(100vw-2rem))]">
          <div className="mt-3 flex items-center justify-between gap-3">
            {structureSummary ? <p className="text-ink-soft">{structureSummary}</p> : <span />}
            <button
              id="changes-revert-all-button"
              type="button"
              onClick={() => {
                onRevertAll()
                setIsOpen(false)
              }}
              className={compactSecondaryButtonClassName}
            >
              {t('csv.changes.revertAll')}
            </button>
          </div>
          <ul className="mt-3 divide-y divide-rule">
            {changeRows.map((change) => (
              <li key={change.key} id={`change-${change.address}`} className="flex items-center gap-2 py-2">
                <button
                  id={`change-go-to-${change.address}`}
                  type="button"
                  disabled={!change.isVisible}
                  title={change.isVisible ? t('csv.changes.goTo') : t('csv.changes.hidden')}
                  onClick={() => {
                    setIsOpen(false)
                    // The page behind a modal dialog cannot take focus, so go to the cell once the dialog is gone.
                    window.setTimeout(() => onGoToCell(change.position), 0)
                  }}
                  className="min-w-0 flex-1 cursor-pointer text-start disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="font-mono text-sm text-ink-soft">
                    <bdi dir="ltr">{change.address}</bdi> · <bdi>{change.columnName}</bdi>
                  </span>
                  <span dir="auto" className="block truncate text-start text-ink-soft line-through">
                    {change.originalText === '' ? t('csv.changes.empty') : change.originalText}
                  </span>
                  <span dir="auto" className="block truncate text-start font-medium">
                    {change.newText === '' ? t('csv.changes.empty') : change.newText}
                  </span>
                </button>
                <button
                  id={`change-revert-${change.address}`}
                  type="button"
                  aria-label={t('csv.changes.revertCell', { address: isolateLeftToRight(change.address) })}
                  onClick={() => onRevertCell(change.key)}
                  className="control-shape min-h-8 pointer-coarse:min-h-11 shrink-0 cursor-pointer px-3 text-sm font-medium transition-colors duration-200 hover:bg-paper"
                >
                  {t('csv.changes.revert')}
                </button>
              </li>
            ))}
          </ul>
          {changedCellCount > changeRows.length && (
            <p className="mt-3 text-sm text-ink-soft">
              {tp('csv.changes.more', changedCellCount - changeRows.length)}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button id="changes-close-button" type="button" onClick={() => setIsOpen(false)} className={compactSecondaryButtonClassName}>
              {t('csv.changes.close')}
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
  const { t } = useT()
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
    'min-h-8 pointer-coarse:min-h-11 w-full cursor-pointer rounded px-3 text-start text-sm transition-colors duration-200 hover:bg-paper focus-visible:bg-paper disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div
      id="column-actions-menu"
      ref={menuRef}
      popover="auto"
      role="menu"
      aria-label={t('csv.columnMenu.label')}
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
        id="column-rename-item"
        type="button"
        role="menuitem"
        disabled={!canRename}
        title={canRename ? undefined : t('csv.columnMenu.renameDisabled')}
        onClick={() => runAndClose(onRename)}
        className={itemClassName}
      >
        {t('csv.columnMenu.rename')}
      </button>
      <button id="column-add-after-item" type="button" role="menuitem" onClick={() => runAndClose(onAddColumnAfter)} className={itemClassName}>
        {t('csv.columnMenu.addAfter')}
      </button>
      <button id="column-delete-item" type="button" role="menuitem" disabled={!canDelete} onClick={() => runAndClose(onDelete)} className={itemClassName}>
        {t('csv.columnMenu.delete')}
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
  tools: [],
  ToolbarContent: CsvToolbar,
  downloadOption,
  describeDownload,
  getDefaultByteOrderMark,
  components: { EditBar, CellInput, ChangesControl, FindReplaceBar, ColumnMenu } satisfies CsvEditingComponents,
}
