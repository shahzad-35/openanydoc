import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { primaryButtonClassName, secondaryButtonClassName } from '../buttonStyles'
import { DELIMITER_OPTIONS, buildCsvDownloadText, parseCsv } from '../parseCsv'
import type { DelimiterChoice, ParsedCsv } from '../parseCsv'
import { getLargeFileWarning } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import FileViewHeader from './FileViewHeader'

const ROW_HEIGHT_PX = 36
const COLUMN_MIN_WIDTH_PX = 180
const ROW_NUMBER_MIN_WIDTH_PX = 56
const UNSAVED_EDITS_WARNING = 'You have edits that have not been downloaded. Open another file and lose them?'

type CellPosition = { rowIndex: number; columnIndex: number }
type EditingCell = CellPosition & { draft: string; source: 'cell' | 'bar' }
type SortState = { columnIndex: number; direction: 'asc' | 'desc' } | null

const cellCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function cellKey(rowIndex: number, columnIndex: number) {
  return `${rowIndex}:${columnIndex}`
}

function parseCellKey(key: string): CellPosition {
  const [rowIndex, columnIndex] = key.split(':').map(Number)
  return { rowIndex, columnIndex }
}

// 0 -> A, 25 -> Z, 26 -> AA, like the columns of a spreadsheet.
function columnLabel(columnIndex: number) {
  let label = ''
  for (let remaining = columnIndex + 1; remaining > 0; remaining = Math.floor((remaining - 1) / 26)) {
    label = String.fromCharCode(65 + ((remaining - 1) % 26)) + label
  }
  return label
}

function compareCells(firstCell: string, secondCell: string) {
  const firstNumber = Number(firstCell)
  const secondNumber = Number(secondCell)
  const bothAreNumbers =
    firstCell.trim() !== '' && secondCell.trim() !== '' && !Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)
  return bothAreNumbers ? firstNumber - secondNumber : cellCollator.compare(firstCell, secondCell)
}

// Only the rows that were edited are copied; every other row is shared with the original.
function applyEdits(rows: string[][], editedCells: Map<string, string>) {
  const editedRows = rows.slice()
  for (const [key, newText] of editedCells) {
    const { rowIndex, columnIndex } = parseCellKey(key)
    const editedRow = editedRows[rowIndex] === rows[rowIndex] ? [...rows[rowIndex]] : editedRows[rowIndex]
    while (editedRow.length <= columnIndex) editedRow.push('')
    editedRow[columnIndex] = newText
    editedRows[rowIndex] = editedRow
  }
  return editedRows
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

const controlClassName = 'control-shape solid-box min-h-11 border-ink-soft bg-paper-raised px-4 text-base text-ink'
const selectedCellTint = 'bg-[color-mix(in_srgb,var(--file-color)_14%,var(--paper-raised))]'

type CsvViewerProps = {
  openedFile: OpenedFile
  onClose: () => void
  onBeforeClear?: () => boolean | Promise<boolean>
}

// The full-page CSV editor: app bar, an edit bar with search and download, a table that fills the window, and a status bar.
export default function CsvViewer({ openedFile, onClose, onBeforeClear }: CsvViewerProps) {
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>('auto')
  const [hasHeaderRow, setHasHeaderRow] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [sortState, setSortState] = useState<SortState>(null)
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null)
  const [editedCells, setEditedCells] = useState<Map<string, string>>(() => new Map())
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [isChangesPanelOpen, setIsChangesPanelOpen] = useState(false)
  const [changesPanelTopPx, setChangesPanelTopPx] = useState(0)
  const deferredSearchText = useDeferredValue(searchText)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const changesButtonRef = useRef<HTMLButtonElement>(null)
  const changesPanelRef = useRef<HTMLDivElement>(null)
  const editedCellsRef = useRef(editedCells)
  const editWasCancelledRef = useRef(false)

  useEffect(() => {
    editedCellsRef.current = editedCells
  }, [editedCells])

  // Parse after the "Reading file" state has painted, so the page never looks frozen.
  useEffect(() => {
    setParsedCsv(null)
    setSortState(null)
    setEditedCells(new Map())
    setSelectedCell(null)
    setEditingCell(null)
    const parseTimerId = setTimeout(() => setParsedCsv(parseCsv(openedFile.contents, delimiterChoice)), 0)
    return () => clearTimeout(parseTimerId)
  }, [openedFile, delimiterChoice])

  // Ask the browser to confirm before the tab is closed or reloaded while edits would be lost.
  const editedCellCount = editedCells.size
  useEffect(() => {
    if (editedCellCount === 0) return
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [editedCellCount])

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

  // The changes panel closes on Escape or a click anywhere outside it.
  useEffect(() => {
    if (!isChangesPanelOpen) return
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node
      const isInside = changesPanelRef.current?.contains(target) || changesButtonRef.current?.contains(target)
      if (!isInside) setIsChangesPanelOpen(false)
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setIsChangesPanelOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isChangesPanelOpen])

  const readableCsv = parsedCsv?.status === 'ok' ? parsedCsv : null
  const firstDataRowIndex = hasHeaderRow ? 1 : 0
  const headerRow = hasHeaderRow ? readableCsv?.rows[0] : undefined
  const columnCount = readableCsv?.columnCount ?? 0

  const columnNames = useMemo(
    () => Array.from({ length: columnCount }, (_, columnIndex) => headerRow?.[columnIndex]?.trim() || `Column ${columnIndex + 1}`),
    [columnCount, headerRow],
  )

  // Rows are never copied: search and sort work on a list of row positions. They read the edits as they were when
  // the search or sort last changed, so a row does not jump away from under the cursor while it is being edited.
  const visibleRowIndexes = useMemo(() => {
    if (!readableCsv) return []
    const currentEdits = editedCellsRef.current
    const textAt = (rowIndex: number, columnIndex: number) =>
      currentEdits.get(cellKey(rowIndex, columnIndex)) ?? readableCsv.rows[rowIndex][columnIndex] ?? ''
    const lowerCaseSearch = deferredSearchText.trim().toLowerCase()
    const rowIndexes: number[] = []
    for (let rowIndex = firstDataRowIndex; rowIndex < readableCsv.rows.length; rowIndex++) {
      let matchesSearch = lowerCaseSearch === ''
      for (let columnIndex = 0; !matchesSearch && columnIndex < readableCsv.columnCount; columnIndex++) {
        matchesSearch = textAt(rowIndex, columnIndex).toLowerCase().includes(lowerCaseSearch)
      }
      if (matchesSearch) rowIndexes.push(rowIndex)
    }
    if (sortState) {
      const directionFactor = sortState.direction === 'asc' ? 1 : -1
      rowIndexes.sort(
        (firstRowIndex, secondRowIndex) =>
          directionFactor *
            compareCells(textAt(firstRowIndex, sortState.columnIndex), textAt(secondRowIndex, sortState.columnIndex)) ||
          firstRowIndex - secondRowIndex,
      )
    }
    return rowIndexes
  }, [readableCsv, deferredSearchText, firstDataRowIndex, sortState])

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: visibleRowIndexes.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
  })

  function getCellText(rowIndex: number, columnIndex: number) {
    return editedCells.get(cellKey(rowIndex, columnIndex)) ?? readableCsv?.rows[rowIndex]?.[columnIndex] ?? ''
  }

  function commitCellEdit(position: CellPosition, newText: string) {
    const originalText = readableCsv?.rows[position.rowIndex]?.[position.columnIndex] ?? ''
    const key = cellKey(position.rowIndex, position.columnIndex)
    setEditedCells((currentEdits) => {
      const nextEdits = new Map(currentEdits)
      if (newText === originalText) nextEdits.delete(key)
      else nextEdits.set(key, newText)
      return nextEdits
    })
  }

  function revertCell(key: string) {
    setEditedCells((currentEdits) => {
      const nextEdits = new Map(currentEdits)
      nextEdits.delete(key)
      return nextEdits
    })
  }

  function selectCellAtPosition(rowPosition: number, columnIndex: number) {
    if (visibleRowIndexes.length === 0 || columnCount === 0) return
    const clampedRowPosition = Math.max(0, Math.min(rowPosition, visibleRowIndexes.length - 1))
    const clampedColumnIndex = Math.max(0, Math.min(columnIndex, columnCount - 1))
    setSelectedCell({ rowIndex: visibleRowIndexes[clampedRowPosition], columnIndex: clampedColumnIndex })
    rowVirtualizer.scrollToIndex(clampedRowPosition)
  }

  function beginEditing(position: CellPosition, source: 'cell' | 'bar', draft?: string) {
    editWasCancelledRef.current = false
    setEditingCell({ ...position, draft: draft ?? getCellText(position.rowIndex, position.columnIndex), source })
  }

  function finishEditing(shouldCommit: boolean, moveAfter?: 'down' | 'right') {
    if (!editingCell) return
    if (shouldCommit) commitCellEdit(editingCell, editingCell.draft)
    else editWasCancelledRef.current = true
    const rowPosition = visibleRowIndexes.indexOf(editingCell.rowIndex)
    setEditingCell(null)
    scrollContainerRef.current?.focus()
    if (moveAfter === 'down') selectCellAtPosition(rowPosition + 1, editingCell.columnIndex)
    if (moveAfter === 'right') selectCellAtPosition(rowPosition, editingCell.columnIndex + 1)
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (editingCell || !selectedCell) return
    const rowPosition = visibleRowIndexes.indexOf(selectedCell.rowIndex)
    const { columnIndex } = selectedCell
    const isPrintableKey = event.key.length === 1 && event.key !== '/' && !event.ctrlKey && !event.metaKey && !event.altKey

    if (event.key === 'ArrowDown') selectCellAtPosition(rowPosition + 1, columnIndex)
    else if (event.key === 'ArrowUp') selectCellAtPosition(rowPosition - 1, columnIndex)
    else if (event.key === 'ArrowLeft') selectCellAtPosition(rowPosition, columnIndex - 1)
    else if (event.key === 'ArrowRight') selectCellAtPosition(rowPosition, columnIndex + 1)
    else if (event.key === 'Enter' || event.key === 'F2') beginEditing(selectedCell, 'cell')
    else if (event.key === 'Delete' || event.key === 'Backspace') commitCellEdit(selectedCell, '')
    else if (isPrintableKey) beginEditing(selectedCell, 'cell', event.key)
    else return
    event.preventDefault()
  }

  function cycleSort(columnIndex: number) {
    setSortState((currentSort) => {
      if (currentSort?.columnIndex !== columnIndex) return { columnIndex, direction: 'asc' }
      return currentSort.direction === 'asc' ? { columnIndex, direction: 'desc' } : null
    })
  }

  function changeDelimiter(newChoice: DelimiterChoice) {
    if (editedCellCount > 0 && !window.confirm('Changing the delimiter re-reads the file and discards your edits. Continue?')) return
    setDelimiterChoice(newChoice)
  }

  function toggleChangesPanel() {
    const buttonBottom = changesButtonRef.current?.getBoundingClientRect().bottom ?? 0
    setChangesPanelTopPx(buttonBottom + 8)
    setIsChangesPanelOpen((wasOpen) => !wasOpen)
  }

  function revertAllEdits() {
    setEditedCells(new Map())
    setIsChangesPanelOpen(false)
  }

  function goToEditedCell(position: CellPosition) {
    const rowPosition = visibleRowIndexes.indexOf(position.rowIndex)
    if (rowPosition === -1) return
    selectCellAtPosition(rowPosition, position.columnIndex)
    setIsChangesPanelOpen(false)
    scrollContainerRef.current?.focus({ preventScroll: true })
  }

  function downloadCsv() {
    if (!readableCsv) return
    const csvText = buildCsvDownloadText(
      applyEdits(readableCsv.rows, editedCells),
      readableCsv.detectedDelimiter,
      readableCsv.encodingLabel.startsWith('UTF-8 with BOM'),
    )
    const downloadName = editedCellCount > 0 ? openedFile.file.name.replace(/(\.[^.]+)?$/, '-edited$1') : openedFile.file.name
    const downloadUrl = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }))
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = downloadName
    downloadLink.click()
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }

  async function confirmBeforeClear() {
    if (editedCellCount > 0 && !window.confirm(UNSAVED_EDITS_WARNING)) return false
    return onBeforeClear ? onBeforeClear() : true
  }

  const totalRowCount = readableCsv ? readableCsv.rows.length - firstDataRowIndex : 0
  const isSearching = deferredSearchText.trim() !== ''
  const rowNumberWidthPx = Math.max(ROW_NUMBER_MIN_WIDTH_PX, (readableCsv?.rows.length ?? 0).toLocaleString().length * 10 + 36)
  const tableMinWidthPx = rowNumberWidthPx + columnCount * COLUMN_MIN_WIDTH_PX
  const detectedDelimiterLabel =
    DELIMITER_OPTIONS.find((option) => option.value === readableCsv?.detectedDelimiter)?.label ?? 'Custom'
  const largeFileWarning = getLargeFileWarning(openedFile.file)
  const noticeLines = [...(largeFileWarning ? [largeFileWarning] : []), ...(readableCsv?.notices ?? [])]

  const selectedCellLabel = selectedCell
    ? `${columnLabel(selectedCell.columnIndex)}${selectedCell.rowIndex + 1}`
    : '–'
  const selectedCellText = selectedCell ? getCellText(selectedCell.rowIndex, selectedCell.columnIndex) : ''
  const showChangesPanel = isChangesPanelOpen && editedCellCount > 0

  return (
    <div
      data-file-type="csv"
      className="flex h-dvh flex-col bg-paper font-sans text-[16px] leading-normal text-ink"
    >
      <FileViewHeader openedFile={openedFile} onClose={onClose} onBeforeClear={confirmBeforeClear} />

      {readableCsv && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-rule bg-paper px-4 py-2 md:flex-wrap md:overflow-visible">
          <p
            aria-label="Selected cell"
            className="control-shape solid-box flex min-h-11 min-w-20 shrink-0 items-center justify-center border-rule bg-paper-raised px-3 font-mono text-sm"
          >
            {selectedCellLabel}
          </p>
          <input
            dir="auto"
            aria-label="Value of the selected cell"
            placeholder="Select a cell to see or edit its value"
            disabled={!selectedCell}
            value={editingCell ? editingCell.draft : selectedCellText}
            onChange={(event) => {
              if (!selectedCell) return
              if (editingCell) setEditingCell({ ...editingCell, draft: event.target.value })
              else beginEditing(selectedCell, 'bar', event.target.value)
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
            className={`${controlClassName} min-w-48 flex-1 disabled:cursor-not-allowed disabled:text-ink-soft`}
          />

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
              className={`${controlClassName} w-48 pl-9 pr-10`}
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

          {editedCellCount > 0 && (
            <>
              <button
                ref={changesButtonRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={showChangesPanel}
                onClick={toggleChangesPanel}
                className="control-shape solid-box flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-edit-mark bg-edit-mark/10 px-4 text-base transition-colors duration-200 hover:bg-edit-mark/20"
              >
                <span aria-hidden="true" className="size-2 rounded-full bg-edit-mark" />
                {editedCellCount.toLocaleString()} {editedCellCount === 1 ? 'edit' : 'edits'}
                <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 4.5 3 3 3-3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={revertAllEdits}
                className="control-shape min-h-11 shrink-0 cursor-pointer px-3 text-base font-medium transition-colors duration-200 hover:bg-paper-raised"
              >
                Revert all
              </button>
            </>
          )}

          <button type="button" onClick={downloadCsv} className={`${primaryButtonClassName} shrink-0`}>
            Download
          </button>
        </div>
      )}

      {showChangesPanel && (
        <div
          ref={changesPanelRef}
          role="dialog"
          aria-label="Edited cells"
          className="box-shape solid-box fixed right-4 z-40 max-h-[60vh] w-[min(28rem,calc(100vw-2rem))] overflow-auto border-rule bg-paper-raised p-4"
          style={{ top: changesPanelTopPx }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="type-h3">Edited cells</h2>
            <button type="button" onClick={revertAllEdits} className={secondaryButtonClassName}>
              Revert all
            </button>
          </div>
          <ul className="mt-3 divide-y divide-rule">
            {Array.from(editedCells, ([key, newText]) => ({ key, ...parseCellKey(key), newText }))
              .sort((first, second) => first.rowIndex - second.rowIndex || first.columnIndex - second.columnIndex)
              .map((edit) => {
                const originalText = readableCsv?.rows[edit.rowIndex]?.[edit.columnIndex] ?? ''
                const isRowVisible = visibleRowIndexes.includes(edit.rowIndex)
                return (
                  <li key={edit.key} className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      disabled={!isRowVisible}
                      title={isRowVisible ? 'Go to this cell' : 'Hidden by the current search'}
                      onClick={() => goToEditedCell(edit)}
                      className="min-w-0 flex-1 cursor-pointer text-start disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="font-mono text-sm text-ink-soft">
                        {columnLabel(edit.columnIndex)}
                        {edit.rowIndex + 1} · {columnNames[edit.columnIndex]}
                      </span>
                      <span dir="auto" className="block truncate text-left text-ink-soft line-through">
                        {originalText === '' ? '(empty)' : originalText}
                      </span>
                      <span dir="auto" className="block truncate text-left font-medium">
                        {edit.newText === '' ? '(empty)' : edit.newText}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Revert ${columnLabel(edit.columnIndex)}${edit.rowIndex + 1}`}
                      onClick={() => revertCell(edit.key)}
                      className="control-shape min-h-11 shrink-0 cursor-pointer px-3 text-sm font-medium transition-colors duration-200 hover:bg-paper"
                    >
                      Revert
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
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
              aria-rowcount={visibleRowIndexes.length + 1}
              aria-colcount={columnCount + 1}
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
                {columnNames.map((columnName, columnIndex) => {
                  const columnDirection = sortState?.columnIndex === columnIndex ? sortState.direction : null
                  const isSelectedColumn = selectedCell?.columnIndex === columnIndex
                  return (
                    <div
                      key={columnIndex}
                      role="columnheader"
                      aria-sort={columnDirection === 'asc' ? 'ascending' : columnDirection === 'desc' ? 'descending' : 'none'}
                      className={`min-w-0 border-r border-rule/60 ${isSelectedColumn ? selectedCellTint : ''}`}
                      style={{ flex: `1 0 ${COLUMN_MIN_WIDTH_PX}px`, height: ROW_HEIGHT_PX }}
                    >
                      <button
                        type="button"
                        onClick={() => cycleSort(columnIndex)}
                        dir="auto"
                        title={`Sort by ${columnName}`}
                        className="flex h-full w-full cursor-pointer items-center gap-2 px-3 text-start font-semibold transition-colors duration-200 hover:bg-paper-raised"
                      >
                        <span aria-hidden="true" className="font-mono text-xs font-normal text-ink-soft">
                          {columnLabel(columnIndex)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{columnName}</span>
                        <SortChevron direction={columnDirection} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div role="rowgroup" className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const rowIndex = visibleRowIndexes[virtualRow.index]
                  const isSelectedRow = selectedCell?.rowIndex === rowIndex
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
                        }`}
                        style={{ width: rowNumberWidthPx }}
                      >
                        {(rowIndex + 1).toLocaleString()}
                      </div>
                      {columnNames.map((_, columnIndex) => {
                        const key = cellKey(rowIndex, columnIndex)
                        const isEdited = editedCellCount > 0 && editedCells.has(key)
                        const isSelected = isSelectedRow && selectedCell?.columnIndex === columnIndex
                        const isEditingHere = editingCell?.rowIndex === rowIndex && editingCell.columnIndex === columnIndex
                        const cellText = isEditingHere && editingCell?.source === 'bar' ? editingCell.draft : getCellText(rowIndex, columnIndex)
                        return (
                          <div
                            key={columnIndex}
                            role="gridcell"
                            aria-selected={isSelected}
                            dir="auto"
                            title={isEditingHere ? undefined : cellText}
                            onClick={() => {
                              setSelectedCell({ rowIndex, columnIndex })
                              scrollContainerRef.current?.focus({ preventScroll: true })
                            }}
                            onDoubleClick={() => {
                              setSelectedCell({ rowIndex, columnIndex })
                              beginEditing({ rowIndex, columnIndex }, 'cell')
                            }}
                            className={`relative min-w-0 cursor-cell truncate border-r border-rule/60 px-3 leading-9 tabular-nums ${
                              isSelected
                                ? `z-[1] ${selectedCellTint} outline-2 -outline-offset-2 outline-(--file-color)`
                                : isEdited
                                  ? 'bg-edit-mark/10'
                                  : ''
                            }`}
                            style={{ flex: `1 0 ${COLUMN_MIN_WIDTH_PX}px` }}
                          >
                            {isEdited && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-edit-mark" />}
                            {isEditingHere && editingCell?.source === 'cell' ? (
                              <input
                                autoFocus
                                dir="auto"
                                aria-label={`Edit ${columnNames[columnIndex]}, row ${(rowIndex + 1).toLocaleString()}`}
                                value={editingCell.draft}
                                onChange={(event) => setEditingCell({ ...editingCell, draft: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    finishEditing(true, 'down')
                                  } else if (event.key === 'Tab') {
                                    event.preventDefault()
                                    finishEditing(true, 'right')
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault()
                                    finishEditing(false)
                                  }
                                }}
                                onBlur={() => {
                                  if (editWasCancelledRef.current) {
                                    editWasCancelledRef.current = false
                                    return
                                  }
                                  finishEditing(true)
                                }}
                                className="absolute inset-0 w-full bg-paper-raised px-3 outline-none"
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
            {visibleRowIndexes.length === 0 && <p className="p-6 text-ink-soft">No rows match your search.</p>}
          </div>
        )}
      </main>

      {readableCsv && (
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-1 text-sm">
          <p aria-live="polite" className="whitespace-nowrap font-semibold">
            {isSearching
              ? `${visibleRowIndexes.length.toLocaleString()} of ${totalRowCount.toLocaleString()} rows`
              : `${totalRowCount.toLocaleString()} rows × ${columnCount.toLocaleString()} columns`}
          </p>
          <label className="flex items-center gap-2 text-ink-soft">
            Delimiter
            <select
              value={delimiterChoice}
              onChange={(event) => changeDelimiter(event.target.value as DelimiterChoice)}
              className={controlClassName}
            >
              {DELIMITER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'auto' ? `Auto-detect (${detectedDelimiterLabel})` : option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={hasHeaderRow}
              onChange={(event) => {
                setHasHeaderRow(event.target.checked)
                setSortState(null)
              }}
              className="size-5"
            />
            First row is header
          </label>
          <span className="hidden text-ink-soft sm:inline">{readableCsv.encodingLabel}</span>
          <span className="ml-auto hidden text-ink-soft md:inline">
            Double-click or press Enter to edit · Press / to search
          </span>
        </footer>
      )}
    </div>
  )
}
