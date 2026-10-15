import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { textControlClassName } from '../../buttonStyles'
import { DELIMITER_OPTIONS, firstRowLooksLikeHeader, parseCsv } from '../../parseCsv'
import type { DelimiterChoice, ParsedCsv } from '../../parseCsv'
import { getLargeFileWarning } from '../../useFileIntake'
import { findTableFormat } from '../../viewers'
import type { FormatViewerProps } from '../registry'
import DataTable, { SearchIcon, columnLabel, getRowNumberColumnWidthPx, measureColumnWidthsPx, useVisibleRowIds } from '../DataTable'
import type { CellPosition, DataTableHandle, SortState } from '../DataTable'
import type { EditSession } from '../useEditSession'
import {
  buildDisplayIds,
  cellKey,
  countShownEditedCells,
  describeCsvChanges,
  getCellText,
  getOriginalCellText,
  isInsertedLine,
  parseCellKey,
  rowLabel,
  textMatches,
  withCellText,
  withDeletedLine,
  withInsertedLine,
  withReplacedText,
  withTransformedText,
  withFilledDown,
  withoutEmptyRows,
  withoutDuplicateRows,
} from './csvCells'
import type { CsvActions, CsvEdits, CsvExportSource, CsvSelection, CsvViewerCommands } from './csvCells'
import type { ChangeRow, CsvEditingComponents } from './csvEditing'

const MAX_LISTED_CHANGES = 200

type EditingCell = CellPosition & { draft: string; source: 'cell' | 'bar' }
const noRows: string[][] = []

// A row or column added here is shown until it is deleted; an original one until it is hidden by a delete.
function isLineShown(id: number, deletedIds: ReadonlySet<number>, insertedLines: CsvEdits['insertedRows']) {
  return isInsertedLine(id) ? insertedLines.some((line) => line.id === id) : !deletedIds.has(id)
}

// The CSV table. In view mode it only reads; in edit mode the editing components (loaded on first Edit) add the value bar,
// the in-cell text box, find and replace and the changes list, and every change goes through the shared edit session.
export default function CsvViewer({
  openedFile,
  mode,
  session: untypedSession,
  editingComponents,
  confirmDiscardEdits,
  onSelectionChange,
  onCommandsChange,
  onExportSourceChange,
}: FormatViewerProps) {
  const session = untypedSession as EditSession<CsvEdits>
  const editing = editingComponents as CsvEditingComponents | null
  const isEditable = mode === 'edit' && editing !== null
  const tableFormat = findTableFormat(openedFile.file.name)
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>(tableFormat.defaultDelimiter)
  const [hasHeaderRow, setHasHeaderRow] = useState(tableFormat.headerRow === 'always')
  const [searchText, setSearchText] = useState('')
  const [sortState, setSortState] = useState<SortState>(null)
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null)
  const [pickedCell, setPickedCell] = useState<CellPosition | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [renamingColumn, setRenamingColumn] = useState<{ columnId: number; draft: string } | null>(null)
  const [columnMenu, setColumnMenu] = useState<{ columnId: number; left: number; top: number } | null>(null)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [replaceResultMessage, setReplaceResultMessage] = useState('')
  // What a clean-up action did, shown in the status line until the next change.
  const [cleanUpMessage, setCleanUpMessage] = useState<{ text: string; forEdits: CsvEdits } | null>(null)
  const deferredSearchText = useDeferredValue(searchText)
  const deferredFindText = useDeferredValue(findText)
  const tableRef = useRef<DataTableHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { reset: resetEditSession } = session
  const edits = session.edits
  const editedCount = session.changeCount
  const editsRef = useRef(edits)
  const editWasCancelledRef = useRef(false)
  const pendingRevealRef = useRef<Partial<CellPosition> | null>(null)

  useEffect(() => {
    editsRef.current = edits
  }, [edits])

  // Parse after the "Reading file" state has painted, so the page never looks frozen.
  useEffect(() => {
    // A new file or delimiter starts from a clean state; this is the reset, not a value derived from other state.
    // oxlint-disable-next-line react/set-state-in-effect
    setParsedCsv(null)
    setSortState(null)
    resetEditSession()
    setPickedCell(null)
    setEditingCell(null)
    setRenamingColumn(null)
    const parseTimerId = setTimeout(() => {
      const newParsedCsv = parseCsv(openedFile.contents, delimiterChoice)
      if (newParsedCsv.status === 'ok' && tableFormat.headerRow !== 'always') {
        setHasHeaderRow(firstRowLooksLikeHeader(newParsedCsv.rows))
      }
      setParsedCsv(newParsedCsv)
    }, 0)
    return () => clearTimeout(parseTimerId)
  }, [openedFile, delimiterChoice, tableFormat.headerRow, resetEditSession])

  // "/" jumps to the search box, like in many web apps.
  useEffect(() => {
    function focusSearchOnSlash(event: globalThis.KeyboardEvent) {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearchOnSlash)
    return () => window.removeEventListener('keydown', focusSearchOnSlash)
  }, [])

  const readableCsv = parsedCsv?.status === 'ok' ? parsedCsv : null
  const rows = readableCsv?.rows ?? noRows
  const originalRowCount = rows.length
  const originalColumnCount = readableCsv?.columnCount ?? 0
  const firstDataRowId = hasHeaderRow ? 1 : 0

  // Which rows and columns are on display, in order: the originals minus the deleted ones, plus the ones added here.
  const displayColumnIds = useMemo(
    () => buildDisplayIds(0, originalColumnCount, edits.deletedColumnIds, edits.insertedColumns),
    [originalColumnCount, edits.deletedColumnIds, edits.insertedColumns],
  )
  const displayRowIds = useMemo(
    () => buildDisplayIds(firstDataRowId, originalRowCount, edits.deletedRowIds, edits.insertedRows),
    [firstDataRowId, originalRowCount, edits.deletedRowIds, edits.insertedRows],
  )

  const columnNames = useMemo(
    () =>
      displayColumnIds.map(
        (columnId, columnPosition) => (hasHeaderRow ? getCellText(rows, edits, 0, columnId).trim() : '') || `Column ${columnPosition + 1}`,
      ),
    [displayColumnIds, hasHeaderRow, rows, edits],
  )

  const columnWidthsPx = useMemo(
    () => measureColumnWidthsPx(displayColumnIds, columnNames, firstDataRowId, originalRowCount, (rowId, columnId) => getOriginalCellText(rows, rowId, columnId)),
    [displayColumnIds, columnNames, rows, originalRowCount, firstDataRowId],
  )
  const rowNumberColumnWidthPx = getRowNumberColumnWidthPx(originalRowCount)

  // A cell stays selected only while its row and column are still shown (deleting them clears the selection).
  const selectedCell =
    pickedCell &&
    isLineShown(pickedCell.rowId, edits.deletedRowIds, edits.insertedRows) &&
    isLineShown(pickedCell.columnId, edits.deletedColumnIds, edits.insertedColumns)
      ? pickedCell
      : null

  const activeSort = sortState && displayColumnIds.includes(sortState.columnId) ? sortState : null

  // The table reads the edits as they were when the search or sort last changed (see useVisibleRowIds), through this ref.
  const visibleRowIds = useVisibleRowIds({
    rowIds: displayRowIds,
    columnIds: displayColumnIds,
    searchText: deferredSearchText,
    sort: activeSort,
    readText: (rowId, columnId) => getCellText(rows, editsRef.current, rowId, columnId),
    // Rows added here stay in view while searching, so a new row never disappears as it is created.
    isAlwaysShown: isInsertedLine,
    dataKey: rows,
  })

  function getText(rowId: number, columnId: number) {
    return getCellText(rows, edits, rowId, columnId)
  }

  function commitCellEdit(position: CellPosition, newText: string) {
    const originalText = getOriginalCellText(rows, position.rowId, position.columnId)
    session.update((currentEdits) => withCellText(currentEdits, position, originalText, newText))
  }

  function revertCell(key: string) {
    const position = parseCellKey(key)
    commitCellEdit(position, getOriginalCellText(rows, position.rowId, position.columnId))
  }

  function selectCellAtPosition(rowPosition: number, columnPosition: number) {
    if (visibleRowIds.length === 0 || displayColumnIds.length === 0) return
    const clampedRowPosition = Math.max(0, Math.min(rowPosition, visibleRowIds.length - 1))
    const clampedColumnPosition = Math.max(0, Math.min(columnPosition, displayColumnIds.length - 1))
    setPickedCell({ rowId: visibleRowIds[clampedRowPosition], columnId: displayColumnIds[clampedColumnPosition] })
    tableRef.current?.scrollToRow(clampedRowPosition)
  }

  function beginEditing(position: CellPosition, source: 'cell' | 'bar', draft?: string) {
    editWasCancelledRef.current = false
    setEditingCell({ ...position, draft: draft ?? getText(position.rowId, position.columnId), source })
  }

  function finishEditing(shouldCommit: boolean, moveAfter?: 'down' | 'right') {
    if (!editingCell) return
    if (shouldCommit) commitCellEdit(editingCell, editingCell.draft)
    else editWasCancelledRef.current = true
    const rowPosition = visibleRowIds.indexOf(editingCell.rowId)
    const columnPosition = displayColumnIds.indexOf(editingCell.columnId)
    setEditingCell(null)
    tableRef.current?.focus()
    if (moveAfter === 'down') selectCellAtPosition(rowPosition + 1, columnPosition)
    if (moveAfter === 'right') selectCellAtPosition(rowPosition, columnPosition + 1)
  }

  function startRenamingColumn(columnId: number) {
    if (!hasHeaderRow) return
    editWasCancelledRef.current = false
    setRenamingColumn({ columnId, draft: getText(0, columnId) })
  }

  function finishRenamingColumn(shouldCommit: boolean) {
    if (!renamingColumn) return
    if (shouldCommit) commitCellEdit({ rowId: 0, columnId: renamingColumn.columnId }, renamingColumn.draft)
    else editWasCancelledRef.current = true
    setRenamingColumn(null)
    tableRef.current?.focus()
  }

  // The menu opens right under the header, lined up with the name.
  function openColumnMenu(columnId: number, nameButton: HTMLElement) {
    const headerBottom = nameButton.closest('[role="columnheader"]')?.getBoundingClientRect().bottom ?? nameButton.getBoundingClientRect().bottom
    setColumnMenu({ columnId, left: nameButton.getBoundingClientRect().left, top: headerBottom + 2 })
  }

  function addColumnAfter(columnId: number) {
    pendingRevealRef.current = { columnId: edits.nextColumnId }
    session.update((currentEdits) => withInsertedLine(currentEdits, 'column', columnId))
  }

  function deleteColumn(columnId: number) {
    session.update((currentEdits) => withDeletedLine(currentEdits, 'column', columnId))
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys typed inside a text box in the header or a cell (a rename, an edit) belong to that box, never to the grid.
    const isTypingInATextBox = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    if (isTypingInATextBox || editingCell || renamingColumn || !selectedCell) return
    const rowPosition = visibleRowIds.indexOf(selectedCell.rowId)
    const columnPosition = displayColumnIds.indexOf(selectedCell.columnId)
    const isPrintableKey = event.key.length === 1 && event.key !== '/' && !event.ctrlKey && !event.metaKey && !event.altKey

    if (event.key === 'ArrowDown') selectCellAtPosition(rowPosition + 1, columnPosition)
    else if (event.key === 'ArrowUp') selectCellAtPosition(rowPosition - 1, columnPosition)
    else if (event.key === 'ArrowLeft') selectCellAtPosition(rowPosition, columnPosition - 1)
    else if (event.key === 'ArrowRight') selectCellAtPosition(rowPosition, columnPosition + 1)
    else if (isEditable && (event.key === 'Enter' || event.key === 'F2')) beginEditing(selectedCell, 'cell')
    else if (isEditable && (event.key === 'Delete' || event.key === 'Backspace')) commitCellEdit(selectedCell, '')
    else if (isEditable && isPrintableKey) beginEditing(selectedCell, 'cell', event.key)
    else return
    event.preventDefault()
  }

  function cycleSort(columnId: number) {
    setSortState((currentSort) => {
      if (currentSort?.columnId !== columnId) return { columnId, direction: 'asc' }
      return currentSort.direction === 'asc' ? { columnId, direction: 'desc' } : null
    })
  }

  async function changeDelimiter(newChoice: DelimiterChoice) {
    if (editedCount > 0 && !(await confirmDiscardEdits())) return
    setDelimiterChoice(newChoice)
  }

  function goToEditedCell(position: CellPosition) {
    const rowPosition = visibleRowIds.indexOf(position.rowId)
    if (rowPosition === -1) return
    selectCellAtPosition(rowPosition, displayColumnIds.indexOf(position.columnId))
    tableRef.current?.focus({ preventScroll: true })
  }

  function replaceAllMatches() {
    const { edits: replacedEdits, replacedCellCount } = withReplacedText(
      edits,
      rows,
      displayRowIds,
      displayColumnIds,
      findText,
      replaceText,
      matchCase,
    )
    session.update(() => replacedEdits)
    setReplaceResultMessage(`Replaced in ${replacedCellCount.toLocaleString()} ${replacedCellCount === 1 ? 'cell' : 'cells'}`)
  }

  // Find and replace counts the cells that match on every shown cell, not only the rows the search leaves visible. It reads
  // a deferred copy of the edits, so on a huge file an edit shows at once and the count follows a moment later.
  const deferredEdits = useDeferredValue(edits)
  const matchCount = useMemo(() => {
    if (!isFindOpen || deferredFindText === '') return 0
    let count = 0
    for (const rowId of displayRowIds) {
      for (const columnId of displayColumnIds) {
        if (textMatches(getCellText(rows, deferredEdits, rowId, columnId), deferredFindText, matchCase)) count++
      }
    }
    return count
  }, [isFindOpen, deferredFindText, matchCase, displayRowIds, displayColumnIds, rows, deferredEdits])

  // The toolbar's tools reach the viewer through these commands. The object never changes; it calls the latest functions.
  const latestActionsRef = useRef<CsvActions | null>(null)
  useEffect(() => {
    latestActionsRef.current = {
      insertRow: (side) => {
        if (!selectedCell) return
        const rowPosition = displayRowIds.indexOf(selectedCell.rowId)
        const afterId = side === 'below' ? selectedCell.rowId : (displayRowIds[rowPosition - 1] ?? -1)
        pendingRevealRef.current = { rowId: edits.nextRowId, columnId: selectedCell.columnId }
        session.update((currentEdits) => withInsertedLine(currentEdits, 'row', afterId))
      },
      deleteRow: () => {
        if (selectedCell) session.update((currentEdits) => withDeletedLine(currentEdits, 'row', selectedCell.rowId))
      },
      insertColumn: (side) => {
        if (!selectedCell) return
        const columnPosition = displayColumnIds.indexOf(selectedCell.columnId)
        const afterId = side === 'right' ? selectedCell.columnId : (displayColumnIds[columnPosition - 1] ?? -1)
        pendingRevealRef.current = { columnId: edits.nextColumnId }
        session.update((currentEdits) => withInsertedLine(currentEdits, 'column', afterId))
      },
      deleteColumn: () => {
        if (selectedCell && displayColumnIds.length > 1) deleteColumn(selectedCell.columnId)
      },
      clearCell: () => {
        if (selectedCell) commitCellEdit(selectedCell, '')
      },
      revertCell: () => {
        if (selectedCell) revertCell(cellKey(selectedCell.rowId, selectedCell.columnId))
      },
      transformColumn: (transform) => {
        if (selectedCell) session.update((currentEdits) => withTransformedText(currentEdits, rows, displayRowIds, [selectedCell.columnId], transform))
      },
      fillColumnDown: () => {
        if (selectedCell) session.update((currentEdits) => withFilledDown(currentEdits, rows, displayRowIds, selectedCell.columnId))
      },
      trimAllCells: () => session.update((currentEdits) => withTransformedText(currentEdits, rows, displayRowIds, displayColumnIds, 'trim')),
      removeEmptyRows: () => {
        const { edits: cleanedEdits, removedCount } = withoutEmptyRows(edits, rows, displayRowIds, displayColumnIds)
        session.update(() => cleanedEdits)
        setCleanUpMessage({ text: `Removed ${removedCount.toLocaleString()} empty ${removedCount === 1 ? 'row' : 'rows'}`, forEdits: cleanedEdits })
      },
      removeDuplicateRows: () => {
        const { edits: cleanedEdits, removedCount } = withoutDuplicateRows(edits, rows, displayRowIds, displayColumnIds)
        session.update(() => cleanedEdits)
        setCleanUpMessage({ text: `Removed ${removedCount.toLocaleString()} duplicate ${removedCount === 1 ? 'row' : 'rows'}`, forEdits: cleanedEdits })
      },
    }
  })
  const viewerCommands = useMemo<CsvViewerCommands>(
    () => ({
      toggleFindReplace: () => setIsFindOpen((wasOpen) => !wasOpen),
      getActions: () => latestActionsRef.current as CsvActions,
    }),
    [],
  )
  useEffect(() => {
    onCommandsChange(viewerCommands)
  }, [onCommandsChange, viewerCommands])

  // After a row or column was added, select its cell and scroll it into view once the new lists are drawn.
  useEffect(() => {
    const reveal = pendingRevealRef.current
    if (!reveal) return
    const rowId = reveal.rowId ?? selectedCell?.rowId ?? visibleRowIds[0]
    const columnId = reveal.columnId ?? selectedCell?.columnId ?? displayColumnIds[0]
    const rowPosition = visibleRowIds.indexOf(rowId)
    if (rowPosition === -1 || !displayColumnIds.includes(columnId)) return
    pendingRevealRef.current = null
    setPickedCell({ rowId, columnId })
    tableRef.current?.scrollToRow(rowPosition)
  }, [visibleRowIds, displayColumnIds, selectedCell])

  const totalRowCount = displayRowIds.length
  const isSearching = deferredSearchText.trim() !== ''
  const detectedDelimiterLabel =
    DELIMITER_OPTIONS.find((option) => option.value === readableCsv?.detectedDelimiter)?.label ?? 'Custom'
  const largeFileWarning = getLargeFileWarning(openedFile.file)
  const noticeLines = [...(largeFileWarning ? [largeFileWarning] : []), ...(readableCsv?.notices ?? [])]

  const selectedColumnPosition = selectedCell ? displayColumnIds.indexOf(selectedCell.columnId) : -1
  const selectedCellLabel = selectedCell ? `${columnLabel(selectedColumnPosition)}${rowLabel(selectedCell.rowId)}` : '–'
  const selectedCellText = selectedCell ? getText(selectedCell.rowId, selectedCell.columnId) : ''

  // The page's toolbar tools and Download panel work from these.
  useEffect(() => {
    if (!readableCsv) {
      onSelectionChange(null)
      return
    }
    const selection: CsvSelection = {
      cell: selectedCell,
      originalText: selectedCell ? getOriginalCellText(rows, selectedCell.rowId, selectedCell.columnId) : '',
      isEdited: selectedCell ? edits.cells.has(cellKey(selectedCell.rowId, selectedCell.columnId)) : false,
      lastRowId: displayRowIds.length > 0 ? displayRowIds[displayRowIds.length - 1] : -1,
      lastColumnId: displayColumnIds.length > 0 ? displayColumnIds[displayColumnIds.length - 1] : -1,
      columnCount: displayColumnIds.length,
      hasHeaderRow,
    }
    onSelectionChange(selection)
  }, [selectedCell, readableCsv, rows, edits, displayRowIds, displayColumnIds, hasHeaderRow, onSelectionChange])

  useEffect(() => {
    if (!readableCsv) {
      onExportSourceChange(null)
      return
    }
    const exportSource: CsvExportSource = {
      rows,
      hasHeaderRow,
      detectedDelimiter: readableCsv.detectedDelimiter,
      hadByteOrderMark: readableCsv.encodingLabel.startsWith('UTF-8 with BOM'),
      tableFormat,
      displayColumnIds,
      visibleRowIds,
    }
    onExportSourceChange(exportSource)
  }, [readableCsv, rows, hasHeaderRow, tableFormat, displayColumnIds, visibleRowIds, onExportSourceChange])

  // What the Changes list shows: the first edited cells with their old and new text, and how many there are in all.
  const visibleRowIdSet = useMemo(() => (isSearching ? new Set(visibleRowIds) : null), [isSearching, visibleRowIds])
  const changedCellCount = useMemo(() => countShownEditedCells(edits), [edits])
  const columnPositionById = useMemo(() => new Map(displayColumnIds.map((columnId, columnPosition) => [columnId, columnPosition])), [displayColumnIds])
  const changeRows = useMemo(() => {
    const listedRows: ChangeRow[] = []
    for (const [key, newText] of edits.cells) {
      const position = parseCellKey(key)
      const columnPosition = columnPositionById.get(position.columnId)
      if (columnPosition === undefined || !isLineShown(position.rowId, edits.deletedRowIds, edits.insertedRows)) continue
      listedRows.push({
        key,
        position,
        address: `${columnLabel(columnPosition)}${rowLabel(position.rowId)}`,
        columnName: columnNames[columnPosition],
        originalText: getOriginalCellText(rows, position.rowId, position.columnId),
        newText,
        isVisible: visibleRowIdSet === null || visibleRowIdSet.has(position.rowId),
      })
      if (listedRows.length === MAX_LISTED_CHANGES) break
    }
    return listedRows
  }, [edits, columnPositionById, columnNames, rows, visibleRowIdSet])
  const structureSummary = useMemo(
    () => describeCsvChanges({ ...edits, cells: new Map() }),
    [edits],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[13px]">
      {readableCsv && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-rule bg-paper px-4 py-1 md:flex-wrap md:overflow-visible">
          {isEditable && (
            <editing.EditBar
              selectedCellLabel={selectedCellLabel}
              isDisabled={!selectedCell}
              value={editingCell ? editingCell.draft : selectedCellText}
              onChange={(newValue) => {
                if (!selectedCell) return
                if (editingCell) setEditingCell({ ...editingCell, draft: newValue })
                else beginEditing(selectedCell, 'bar', newValue)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && editingCell) {
                  event.preventDefault()
                  finishEditing(true, 'down')
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  if (editingCell) finishEditing(false)
                  else tableRef.current?.focus()
                }
              }}
              onBlur={() => {
                if (editWasCancelledRef.current) {
                  editWasCancelledRef.current = false
                  return
                }
                if (editingCell?.source === 'bar') finishEditing(true)
              }}
            />
          )}

          <label className="relative shrink-0">
            <span className="sr-only">Search rows</span>
            <SearchIcon />
            <input
              id="search-input"
              ref={searchInputRef}
              type="search"
              dir="auto"
              placeholder="Search rows"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className={`${textControlClassName} w-48 pl-9 pr-10`}
            />
            {searchText === '' && (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-rule px-1.5 text-xs text-ink-soft"
              >
                /
              </kbd>
            )}
          </label>

          {isEditable && (
            <editing.ChangesControl
              changeRows={changeRows}
              changedCellCount={changedCellCount}
              structureSummary={structureSummary}
              onRevertCell={revertCell}
              onRevertAll={session.revertAll}
              onGoToCell={goToEditedCell}
            />
          )}
        </div>
      )}

      {isEditable && isFindOpen && (
        <editing.FindReplaceBar
          findText={findText}
          replaceText={replaceText}
          matchCase={matchCase}
          matchCount={matchCount}
          resultMessage={replaceResultMessage}
          onFindChange={(newText) => {
            setFindText(newText)
            setReplaceResultMessage('')
          }}
          onReplaceChange={(newText) => {
            setReplaceText(newText)
            setReplaceResultMessage('')
          }}
          onMatchCaseChange={(newValue) => {
            setMatchCase(newValue)
            setReplaceResultMessage('')
          }}
          onReplaceAll={replaceAllMatches}
          onClose={() => setIsFindOpen(false)}
        />
      )}

      {noticeLines.length > 0 && (
        <ul id="file-notices" role="status" className="space-y-1 border-b border-rule bg-paper-raised px-4 py-2 text-sm">
          {noticeLines.map((noticeLine) => (
            <li key={noticeLine}>{noticeLine}</li>
          ))}
        </ul>
      )}

      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        {parsedCsv === null && <p className="p-6 text-ink-soft">Reading file</p>}

        {parsedCsv?.status === 'error' && (
          <div id="file-error" role="alert" className="box-shape solid-box m-6 max-w-2xl border-danger p-6">
            <h2 className="type-h3">This file can't be shown</h2>
            <p className="mt-2">{parsedCsv.message}</p>
            <p className="mt-2 text-ink-soft">Use "Open another file" above to try a different file.</p>
          </div>
        )}

        {readableCsv && (
          <DataTable
            tableRef={tableRef}
            label={tableFormat.label}
            columnIds={displayColumnIds}
            columnNames={columnNames}
            columnWidthsPx={columnWidthsPx}
            rowNumberWidthPx={rowNumberColumnWidthPx}
            rowIds={visibleRowIds}
            getCellText={(rowId, columnId) =>
              editingCell?.source === 'bar' && editingCell.rowId === rowId && editingCell.columnId === columnId ? editingCell.draft : getText(rowId, columnId)
            }
            getOriginalText={(rowId, columnId) => getOriginalCellText(rows, rowId, columnId)}
            dataKey={rows}
            isCellEdited={(rowId, columnId) => edits.cells.has(cellKey(rowId, columnId)) || isInsertedLine(rowId) || isInsertedLine(columnId)}
            isInsertedRow={isInsertedLine}
            isFindMatch={isEditable && isFindOpen && deferredFindText !== '' ? (cellText) => textMatches(cellText, deferredFindText, matchCase) : undefined}
            selectedCell={selectedCell}
            sort={activeSort}
            onCycleSort={cycleSort}
            isEditable={isEditable}
            onColumnNameClick={isEditable ? openColumnMenu : undefined}
            openMenuColumnId={columnMenu?.columnId ?? null}
            renderHeaderExtras={
              isEditable
                ? (columnId, columnName) => (
                    <>
                      {columnMenu?.columnId === columnId && (
                        <editing.ColumnMenu
                          left={columnMenu.left}
                          top={columnMenu.top}
                          canRename={hasHeaderRow}
                          canDelete={displayColumnIds.length > 1}
                          onRename={() => startRenamingColumn(columnId)}
                          onAddColumnAfter={() => addColumnAfter(columnId)}
                          onDelete={() => deleteColumn(columnId)}
                          onClose={() => setColumnMenu(null)}
                        />
                      )}
                      {renamingColumn?.columnId === columnId && (
                        <editing.CellInput
                          ariaLabel={`Rename column ${columnName}`}
                          draft={renamingColumn.draft}
                          onDraftChange={(newDraft) => setRenamingColumn({ columnId, draft: newDraft })}
                          onFinish={finishRenamingColumn}
                          onBlur={() => {
                            if (editWasCancelledRef.current) {
                              editWasCancelledRef.current = false
                              return
                            }
                            finishRenamingColumn(true)
                          }}
                        />
                      )}
                    </>
                  )
                : undefined
            }
            renderCellEditor={
              isEditable
                ? (rowId, columnId, columnName) =>
                    editingCell?.source === 'cell' && editingCell.rowId === rowId && editingCell.columnId === columnId ? (
                      <editing.CellInput
                        ariaLabel={`Edit ${columnName}, row ${rowLabel(rowId)}`}
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
              beginEditing(position, 'cell')
            }}
            onKeyDown={handleGridKeyDown}
            emptyMessage={isSearching ? 'No rows match your search.' : 'This file has no data rows.'}
          />
        )}
      </main>

      {readableCsv && (
        <footer id="csv-status-bar" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-0.5 text-xs">
          <p aria-live="polite" className="whitespace-nowrap font-semibold">
            {isSearching
              ? `${visibleRowIds.length.toLocaleString()} of ${totalRowCount.toLocaleString()} rows`
              : `${totalRowCount.toLocaleString()} rows × ${displayColumnIds.length.toLocaleString()} columns`}
          </p>
          <label className="flex items-center gap-2 text-ink-soft">
            Delimiter
            <select
              id="delimiter-select"
              value={delimiterChoice}
              onChange={(event) => void changeDelimiter(event.target.value as DelimiterChoice)}
              className={textControlClassName}
            >
              {DELIMITER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'auto' ? `Auto-detect (${detectedDelimiterLabel})` : option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-8 pointer-coarse:min-h-11 items-center gap-2">
            <input
              id="header-row-checkbox"
              type="checkbox"
              checked={hasHeaderRow}
              onChange={(event) => {
                setHasHeaderRow(event.target.checked)
                setSortState(null)
              }}
              className="size-4 pointer-coarse:size-5"
            />
            First row is header
          </label>
          {cleanUpMessage?.forEdits === edits && (
            <span id="clean-up-message" role="status" className="font-medium">
              {cleanUpMessage.text}
            </span>
          )}
          <span className="hidden text-ink-soft sm:inline">{readableCsv.encodingLabel}</span>
          <span className="ml-auto hidden text-ink-soft md:inline">
            {isEditable ? 'Double-click or press Enter to edit · ' : ''}Press / to search
          </span>
        </footer>
      )}
    </div>
  )
}
