import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { textControlClassName } from '../../buttonStyles'
import { DELIMITER_OPTIONS, parseCsv } from '../../parseCsv'
import type { DelimiterChoice, ParsedCsv } from '../../parseCsv'
import { getLargeFileWarning } from '../../useFileIntake'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import {
  buildDisplayIds,
  cellKey,
  columnLabel,
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
} from './csvCells'
import type { CellPosition, CsvEdits, CsvExportSource, CsvSelection, CsvViewerCommands } from './csvCells'
import type { ChangeRow, CsvEditingComponents } from './csvEditing'

const ROW_HEIGHT_PX = 36
const COLUMN_MIN_WIDTH_PX = 180
const ROW_NUMBER_MIN_WIDTH_PX = 56
const MAX_LISTED_CHANGES = 200

type EditingCell = CellPosition & { draft: string; source: 'cell' | 'bar' }
type SortState = { columnId: number; direction: 'asc' | 'desc' } | null

const cellCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const noRows: string[][] = []

function compareCells(firstCell: string, secondCell: string) {
  const firstNumber = Number(firstCell)
  const secondNumber = Number(secondCell)
  const bothAreNumbers =
    firstCell.trim() !== '' && secondCell.trim() !== '' && !Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)
  return bothAreNumbers ? firstNumber - secondNumber : cellCollator.compare(firstCell, secondCell)
}

// A row or column added here is shown until it is deleted; an original one until it is hidden by a delete.
function isLineShown(id: number, deletedIds: ReadonlySet<number>, insertedLines: CsvEdits['insertedRows']) {
  return isInsertedLine(id) ? insertedLines.some((line) => line.id === id) : !deletedIds.has(id)
}

function SortChevron({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`size-3 shrink-0 ${direction ? 'text-(--file-color)' : 'text-ink-soft opacity-50'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === 'asc' && <path d="M3 7.5 6 4.5l3 3" />}
      {direction === 'desc' && <path d="M3 4.5 6 7.5l3-3" />}
      {direction === null && (
        <>
          <path d="M3 5 6 2.5 9 5" />
          <path d="M3 7 6 9.5 9 7" />
        </>
      )}
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}

const selectedCellTint = 'bg-[color-mix(in_srgb,var(--file-color)_14%,var(--paper-raised))]'

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
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>('auto')
  const [hasHeaderRow, setHasHeaderRow] = useState(true)
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
  const deferredSearchText = useDeferredValue(searchText)
  const deferredFindText = useDeferredValue(findText)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
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
    setParsedCsv(null)
    setSortState(null)
    resetEditSession()
    setPickedCell(null)
    setEditingCell(null)
    setRenamingColumn(null)
    const parseTimerId = setTimeout(() => setParsedCsv(parseCsv(openedFile.contents, delimiterChoice)), 0)
    return () => clearTimeout(parseTimerId)
  }, [openedFile, delimiterChoice, resetEditSession])

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

  // A cell stays selected only while its row and column are still shown (deleting them clears the selection).
  const selectedCell =
    pickedCell &&
    isLineShown(pickedCell.rowId, edits.deletedRowIds, edits.insertedRows) &&
    isLineShown(pickedCell.columnId, edits.deletedColumnIds, edits.insertedColumns)
      ? pickedCell
      : null

  const activeSort = sortState && displayColumnIds.includes(sortState.columnId) ? sortState : null

  // Rows are never copied: search and sort work on lists of row ids. They read the edits as they were when the search or
  // sort last changed, so a row does not jump away from under the cursor while it is being edited.
  const sortRowIds = useMemo(() => {
    if (!activeSort) return (rowIds: number[]) => rowIds
    const directionFactor = activeSort.direction === 'asc' ? 1 : -1
    return (rowIds: number[]) => {
      const currentEdits = editsRef.current
      return rowIds.sort(
        (firstRowId, secondRowId) =>
          directionFactor *
          compareCells(
            getCellText(rows, currentEdits, firstRowId, activeSort.columnId),
            getCellText(rows, currentEdits, secondRowId, activeSort.columnId),
          ),
      )
    }
  }, [activeSort, rows])

  const visibleRowIds = useMemo(() => {
    const lowerCaseSearch = deferredSearchText.trim().toLowerCase()
    if (lowerCaseSearch === '') return sortRowIds(displayRowIds.slice())
    const currentEdits = editsRef.current
    const matchingRowIds = displayRowIds.filter(
      // Rows added here stay in view while searching, so a new row never disappears as it is created.
      (rowId) =>
        isInsertedLine(rowId) ||
        displayColumnIds.some((columnId) => getCellText(rows, currentEdits, rowId, columnId).toLowerCase().includes(lowerCaseSearch)),
    )
    return sortRowIds(matchingRowIds)
  }, [deferredSearchText, displayRowIds, displayColumnIds, rows, sortRowIds])

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: visibleRowIds.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
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
    rowVirtualizer.scrollToIndex(clampedRowPosition)
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
    scrollContainerRef.current?.focus()
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
    scrollContainerRef.current?.focus()
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
    scrollContainerRef.current?.focus({ preventScroll: true })
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
  const latestActionsRef = useRef({ toggleFindReplace: () => {}, revealCell: (_position: Partial<CellPosition>) => {} })
  useEffect(() => {
    latestActionsRef.current = {
      toggleFindReplace: () => setIsFindOpen((wasOpen) => !wasOpen),
      revealCell: (position) => {
        pendingRevealRef.current = position
      },
    }
  })
  const viewerCommands = useMemo<CsvViewerCommands>(
    () => ({
      toggleFindReplace: () => latestActionsRef.current.toggleFindReplace(),
      revealCell: (position) => latestActionsRef.current.revealCell(position),
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
    rowVirtualizer.scrollToIndex(rowPosition)
  }, [visibleRowIds, displayColumnIds, selectedCell, rowVirtualizer])

  const totalRowCount = displayRowIds.length
  const isSearching = deferredSearchText.trim() !== ''
  const rowNumberWidthPx = Math.max(ROW_NUMBER_MIN_WIDTH_PX, originalRowCount.toLocaleString().length * 10 + 36)
  const tableMinWidthPx = rowNumberWidthPx + displayColumnIds.length * COLUMN_MIN_WIDTH_PX
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
      displayColumnIds,
      visibleRowIds,
    }
    onExportSourceChange(exportSource)
  }, [readableCsv, rows, hasHeaderRow, displayColumnIds, visibleRowIds, onExportSourceChange])

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
    <div className="flex min-h-0 flex-1 flex-col text-[16px]">
      {readableCsv && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-rule bg-paper px-4 py-1.5 md:flex-wrap md:overflow-visible">
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
                  else scrollContainerRef.current?.focus()
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
        <ul role="status" className="space-y-1 border-b border-rule bg-paper-raised px-4 py-2 text-sm">
          {noticeLines.map((noticeLine) => (
            <li key={noticeLine}>{noticeLine}</li>
          ))}
        </ul>
      )}

      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        {parsedCsv === null && <p className="p-6 text-ink-soft">Reading file</p>}

        {parsedCsv?.status === 'error' && (
          <div role="alert" className="box-shape solid-box m-6 max-w-2xl border-danger p-6">
            <h2 className="type-h3">This file can't be shown</h2>
            <p className="mt-2">{parsedCsv.message}</p>
            <p className="mt-2 text-ink-soft">Use "Open another file" above to try a different file.</p>
          </div>
        )}

        {readableCsv && (
          <div
            ref={scrollContainerRef}
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
            aria-label="CSV data, scrollable"
            className="min-h-0 flex-1 overflow-auto outline-none"
            style={{ scrollPaddingTop: ROW_HEIGHT_PX, scrollPaddingLeft: rowNumberWidthPx }}
          >
            <div
              role="grid"
              aria-label="CSV data"
              aria-rowcount={visibleRowIds.length + 1}
              aria-colcount={displayColumnIds.length + 1}
              style={{ minWidth: tableMinWidthPx }}
            >
              <div role="row" aria-rowindex={1} className="sticky top-0 z-20 flex border-b-2 border-(--file-color) bg-paper">
                <div
                  role="columnheader"
                  className="sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-rule bg-paper px-3 text-sm text-ink-soft"
                  style={{ width: rowNumberWidthPx, height: ROW_HEIGHT_PX }}
                >
                  <span aria-hidden="true">#</span>
                  <span className="sr-only">Row number</span>
                </div>
                {displayColumnIds.map((columnId, columnPosition) => {
                  const columnName = columnNames[columnPosition]
                  const columnDirection = activeSort?.columnId === columnId ? activeSort.direction : null
                  const isSelectedColumn = selectedCell?.columnId === columnId
                  const isRenamingHere = isEditable && renamingColumn?.columnId === columnId
                  return (
                    <div
                      key={columnId}
                      role="columnheader"
                      aria-sort={columnDirection === 'asc' ? 'ascending' : columnDirection === 'desc' ? 'descending' : 'none'}
                      className={`relative min-w-0 border-r border-rule/60 ${isSelectedColumn ? selectedCellTint : ''}`}
                      style={{ flex: `1 0 ${COLUMN_MIN_WIDTH_PX}px`, height: ROW_HEIGHT_PX }}
                    >
                      <div className="flex h-full items-center gap-2 px-3">
                        <span aria-hidden="true" className="font-mono text-xs font-normal text-ink-soft">
                          {columnLabel(columnPosition)}
                        </span>
                        {isEditable ? (
                          <button
                            type="button"
                            dir="auto"
                            aria-haspopup="menu"
                            aria-expanded={columnMenu?.columnId === columnId}
                            title={`Column actions for ${columnName}`}
                            onClick={(event) => openColumnMenu(columnId, event.currentTarget)}
                            className="min-w-0 flex-1 cursor-pointer truncate text-start font-semibold hover:underline"
                          >
                            {columnName}
                          </button>
                        ) : (
                          <span dir="auto" className="min-w-0 flex-1 truncate font-semibold">
                            {columnName}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => cycleSort(columnId)}
                          aria-label={`Sort by ${columnName}`}
                          title={`Sort by ${columnName}`}
                          className="grid size-7 pointer-coarse:size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200 hover:bg-paper-raised"
                        >
                          <SortChevron direction={columnDirection} />
                        </button>
                      </div>
                      {isEditable && columnMenu?.columnId === columnId && (
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
                      {isRenamingHere && (
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
                    </div>
                  )
                })}
              </div>

              <div role="rowgroup" className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const rowId = visibleRowIds[virtualRow.index]
                  const isSelectedRow = selectedCell?.rowId === rowId
                  const isNewRow = isInsertedLine(rowId)
                  return (
                    <div
                      key={virtualRow.key}
                      role="row"
                      aria-rowindex={virtualRow.index + 2}
                      className="absolute inset-x-0 flex border-b border-rule/70 bg-paper-raised"
                      style={{ top: virtualRow.start, height: ROW_HEIGHT_PX }}
                    >
                      <div
                        role="rowheader"
                        className={`sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-rule px-3 text-sm tabular-nums ${
                          isSelectedRow ? `${selectedCellTint} font-semibold text-(--file-color)` : 'bg-paper text-ink-soft'
                        } ${isNewRow ? 'italic' : ''}`}
                        style={{ width: rowNumberWidthPx }}
                      >
                        {isNewRow ? 'new' : (rowId + 1).toLocaleString()}
                      </div>
                      {displayColumnIds.map((columnId, columnPosition) => {
                        const key = cellKey(rowId, columnId)
                        const isEdited = edits.cells.has(key) || isNewRow || isInsertedLine(columnId)
                        const isSelected = isSelectedRow && selectedCell?.columnId === columnId
                        const isEditingHere = editingCell?.rowId === rowId && editingCell.columnId === columnId
                        const cellText = isEditingHere && editingCell?.source === 'bar' ? editingCell.draft : getText(rowId, columnId)
                        const isFindMatch = isEditable && isFindOpen && deferredFindText !== '' && textMatches(cellText, deferredFindText, matchCase)
                        return (
                          <div
                            key={columnId}
                            role="gridcell"
                            aria-selected={isSelected}
                            dir="auto"
                            title={isEditingHere ? undefined : cellText}
                            onClick={() => {
                              setPickedCell({ rowId, columnId })
                              scrollContainerRef.current?.focus({ preventScroll: true })
                            }}
                            onDoubleClick={() => {
                              if (!isEditable) return
                              setPickedCell({ rowId, columnId })
                              beginEditing({ rowId, columnId }, 'cell')
                            }}
                            className={`relative min-w-0 ${isEditable ? 'cursor-cell' : 'cursor-default'} truncate border-r border-rule/60 px-3 leading-9 tabular-nums ${
                              isSelected
                                ? `z-[1] ${selectedCellTint} outline-2 -outline-offset-2 outline-(--file-color)`
                                : isFindMatch
                                  ? 'bg-accent/15'
                                  : isEdited
                                    ? 'bg-edit-mark/10'
                                    : ''
                            }`}
                            style={{ flex: `1 0 ${COLUMN_MIN_WIDTH_PX}px` }}
                          >
                            {isEdited && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-edit-mark" />}
                            {isEditable && isEditingHere && editingCell?.source === 'cell' ? (
                              <editing.CellInput
                                ariaLabel={`Edit ${columnNames[columnPosition]}, row ${rowLabel(rowId)}`}
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
                            ) : (
                              cellText
                            )}
                            {isEdited && <span className="sr-only">(edited)</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
            {visibleRowIds.length === 0 && <p className="p-6 text-ink-soft">{isSearching ? 'No rows match your search.' : 'This file has no data rows.'}</p>}
          </div>
        )}
      </main>

      {readableCsv && (
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-1 text-sm">
          <p aria-live="polite" className="whitespace-nowrap font-semibold">
            {isSearching
              ? `${visibleRowIds.length.toLocaleString()} of ${totalRowCount.toLocaleString()} rows`
              : `${totalRowCount.toLocaleString()} rows × ${displayColumnIds.length.toLocaleString()} columns`}
          </p>
          <label className="flex items-center gap-2 text-ink-soft">
            Delimiter
            <select
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
          <label className="flex min-h-9 pointer-coarse:min-h-11 items-center gap-2">
            <input
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
          <span className="hidden text-ink-soft sm:inline">{readableCsv.encodingLabel}</span>
          <span className="ml-auto hidden text-ink-soft md:inline">
            {isEditable ? 'Double-click or press Enter to edit · ' : ''}Press / to search
          </span>
        </footer>
      )}
    </div>
  )
}
