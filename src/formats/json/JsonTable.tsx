import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import DataTable, { CellInput, getRowNumberColumnWidthPx, measureColumnWidthsPx, useVisibleRowIds } from '../DataTable'
import type { CellPosition, DataTableHandle, SortState } from '../DataTable'
import { isolateText, useT } from '../../i18n'
import { isPlainObject } from './jsonModel'
import type { JsonValue } from './jsonModel'

const COLUMN_SCAN_ROW_COUNT = 1000
const MAX_COLUMNS = 200

type EditingCell = CellPosition & { draft: string }

type JsonTableProps = {
  rows: JsonValue[]
  // The document as it was opened, to mark the cells that were changed.
  originalRows: JsonValue
  isEditable: boolean
  // Lower-case search text; rows with no matching cell are hidden.
  searchText: string
  onSetCell: (rowPosition: number, columnName: string, newValue: JsonValue) => void
}

function readMember(row: JsonValue | undefined, columnName: string): JsonValue | undefined {
  return isPlainObject(row) ? row[columnName] : undefined
}

// Strings show as written; everything else (numbers, true, false, null, nested objects and arrays) as JSON. Numbers, booleans and
// null are written the same by String(), which is much faster over hundreds of thousands of cells.
function formatCell(value: JsonValue | undefined) {
  if (value === undefined) return ''
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

// Text in a text cell stays text. Any other cell (or a missing one) reads the text as JSON when it is valid JSON
// (5, true, null, {"a":1}), and as plain text otherwise.
function parseCellText(cellText: string, currentValue: JsonValue | undefined): JsonValue {
  if (typeof currentValue === 'string') return cellText
  try {
    return JSON.parse(cellText)
  } catch {
    return cellText
  }
}

// The keys used by the rows, in the order they first appear.
function collectColumnNames(rows: JsonValue[]) {
  const names = new Set<string>()
  const scannedRowCount = Math.min(rows.length, COLUMN_SCAN_ROW_COUNT)
  for (let rowPosition = 0; rowPosition < scannedRowCount; rowPosition++) {
    const row = rows[rowPosition]
    if (isPlainObject(row)) for (const key of Object.keys(row)) names.add(key)
  }
  return Array.from(names)
}

// A JSON array of objects as a table: a row per item, a column per key. Cells can be edited in Edit mode; every change goes
// to the viewer, which applies it to the document through the shared edit session.
export default function JsonTable({ rows, originalRows, isEditable, searchText, onSetCell }: JsonTableProps) {
  const { t, tp } = useT()
  const [sort, setSort] = useState<SortState>(null)
  const [pickedCell, setPickedCell] = useState<CellPosition | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const tableRef = useRef<DataTableHandle>(null)
  const rowsRef = useRef(rows)
  const editWasCancelledRef = useRef(false)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  // The column names keep their identity while the names stay the same, so editing a cell does not rebuild the table's layout.
  const allColumnNames = useMemo(() => collectColumnNames(rows), [rows])
  const columnNamesKey = allColumnNames.join('\u0000')
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const columnNames = useMemo(() => allColumnNames.slice(0, MAX_COLUMNS), [columnNamesKey])
  const columnIds = useMemo(() => columnNames.map((_, columnPosition) => columnPosition), [columnNames])
  const rowIds = useMemo(() => Array.from({ length: rows.length }, (_, rowPosition) => rowPosition), [rows.length])
  const originalRowList = Array.isArray(originalRows) ? originalRows : []

  const readCurrentText = (rowId: number, columnId: number) => formatCell(readMember(rows[rowId], columnNames[columnId]))
  const visibleRowIds = useVisibleRowIds({
    rowIds,
    columnIds,
    searchText,
    sort,
    readText: (rowId, columnId) => formatCell(readMember(rowsRef.current[rowId], columnNames[columnId])),
    dataKey: columnNames,
  })

  const columnWidthsPx = useMemo(
    () => measureColumnWidthsPx(columnIds, columnNames, 0, rows.length, (rowId, columnId) => formatCell(readMember(originalRowList[rowId], columnNames[columnId]))),
    // The widths come from the original rows, so an edit never changes them.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [columnIds, columnNames, rows.length, originalRows],
  )

  const activeSort = sort && columnIds.includes(sort.columnId) ? sort : null
  const selectedCell = pickedCell && pickedCell.rowId < rows.length && pickedCell.columnId < columnIds.length ? pickedCell : null

  function isCellEdited(rowId: number, columnId: number) {
    const row = rows[rowId]
    if (row === originalRowList[rowId]) return false
    const columnName = columnNames[columnId]
    return readMember(row, columnName) !== readMember(originalRowList[rowId], columnName)
  }

  function selectCellAtPosition(rowPosition: number, columnPosition: number) {
    if (visibleRowIds.length === 0 || columnIds.length === 0) return
    const clampedRowPosition = Math.max(0, Math.min(rowPosition, visibleRowIds.length - 1))
    const clampedColumnPosition = Math.max(0, Math.min(columnPosition, columnIds.length - 1))
    setPickedCell({ rowId: visibleRowIds[clampedRowPosition], columnId: columnIds[clampedColumnPosition] })
    tableRef.current?.scrollToRow(clampedRowPosition)
  }

  function beginEditing(position: CellPosition, draft?: string) {
    editWasCancelledRef.current = false
    setEditingCell({ ...position, draft: draft ?? readCurrentText(position.rowId, position.columnId) })
  }

  function finishEditing(shouldCommit: boolean, moveAfter?: 'down' | 'right') {
    if (!editingCell) return
    if (shouldCommit) {
      const columnName = columnNames[editingCell.columnId]
      const currentValue = readMember(rows[editingCell.rowId], columnName)
      const newValue = parseCellText(editingCell.draft, currentValue)
      const isMissingCellLeftEmpty = currentValue === undefined && editingCell.draft === ''
      if (isPlainObject(rows[editingCell.rowId]) && !isMissingCellLeftEmpty && JSON.stringify(newValue) !== JSON.stringify(currentValue)) {
        onSetCell(editingCell.rowId, columnName, newValue)
      }
    } else {
      editWasCancelledRef.current = true
    }
    const rowPosition = visibleRowIds.indexOf(editingCell.rowId)
    const columnPosition = columnIds.indexOf(editingCell.columnId)
    setEditingCell(null)
    tableRef.current?.focus()
    if (moveAfter === 'down') selectCellAtPosition(rowPosition + 1, columnPosition)
    if (moveAfter === 'right') selectCellAtPosition(rowPosition, columnPosition + 1)
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const isTypingInATextBox = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    if (isTypingInATextBox || editingCell || !selectedCell) return
    const rowPosition = visibleRowIds.indexOf(selectedCell.rowId)
    const columnPosition = columnIds.indexOf(selectedCell.columnId)
    const isPrintableKey = event.key.length === 1 && event.key !== '/' && !event.ctrlKey && !event.metaKey && !event.altKey

    if (event.key === 'ArrowDown') selectCellAtPosition(rowPosition + 1, columnPosition)
    else if (event.key === 'ArrowUp') selectCellAtPosition(rowPosition - 1, columnPosition)
    else if (event.key === 'ArrowLeft') selectCellAtPosition(rowPosition, columnPosition - 1)
    else if (event.key === 'ArrowRight') selectCellAtPosition(rowPosition, columnPosition + 1)
    else if (isEditable && (event.key === 'Enter' || event.key === 'F2')) beginEditing(selectedCell)
    else if (isEditable && isPrintableKey) beginEditing(selectedCell, event.key)
    else return
    event.preventDefault()
  }

  function cycleSort(columnId: number) {
    setSort((currentSort) => {
      if (currentSort?.columnId !== columnId) return { columnId, direction: 'asc' }
      return currentSort.direction === 'asc' ? { columnId, direction: 'desc' } : null
    })
  }

  const isSearching = searchText.trim() !== ''
  const hasHiddenColumns = allColumnNames.length > columnNames.length

  return (
    <>
      <DataTable
        tableRef={tableRef}
        label="JSON"
        columnIds={columnIds}
        columnNames={columnNames}
        columnWidthsPx={columnWidthsPx}
        rowNumberWidthPx={getRowNumberColumnWidthPx(rows.length)}
        rowIds={visibleRowIds}
        getCellText={readCurrentText}
        getOriginalText={(rowId, columnId) => formatCell(readMember(originalRowList[rowId], columnNames[columnId]))}
        dataKey={originalRows}
        isCellEdited={isCellEdited}
        showColumnLetters={false}
        selectedCell={selectedCell}
        sort={activeSort}
        onCycleSort={cycleSort}
        isEditable={isEditable}
        renderCellEditor={
          isEditable
            ? (rowId, columnId, columnName) =>
                editingCell?.rowId === rowId && editingCell.columnId === columnId ? (
                  <CellInput
                    ariaLabel={t('json.table.editCell', { column: isolateText(columnName), row: rowId + 1 })}
                    draft={editingCell.draft}
                    onDraftChange={(newDraft) => setEditingCell({ ...editingCell, draft: newDraft })}
                    onFinish={finishEditing}
                    onBlur={() => {
                      if (editWasCancelledRef.current) {
                        editWasCancelledRef.current = false
                        return
                      }
                      finishEditing(true)
                    }}
                  />
                ) : null
            : undefined
        }
        onCellClick={setPickedCell}
        onCellDoubleClick={(position) => {
          setPickedCell(position)
          beginEditing(position)
        }}
        onKeyDown={handleGridKeyDown}
        emptyMessage={isSearching ? t('json.table.noRowsMatch') : t('json.table.emptyArray')}
      />
      <p aria-live="polite" className="flex flex-wrap gap-x-6 border-t border-rule bg-paper px-4 py-1 text-xs">
        <span className="font-semibold">
          {isSearching ? tp('json.table.rowsFound', rows.length, { shown: visibleRowIds.length }) : `${tp('json.table.rowCount', rows.length)} × ${tp('json.table.columnCount', columnNames.length)}`}
        </span>
        {hasHiddenColumns && <span className="text-ink-soft">{t('json.table.firstColumns', { count: MAX_COLUMNS })}</span>}
        {isEditable && <span className="text-ink-soft">{t('json.table.editHint')}</span>}
      </p>
    </>
  )
}
