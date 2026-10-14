// The helpers and hooks live beside the component because every format that uses the table needs them together.
/* oxlint-disable react/only-export-components */
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'

// The table shared by every format that shows rows and columns (CSV, JSON arrays of objects, later Excel). It draws the grid,
// keeps only the rows on screen in the page, and sorts and searches lists of row ids. It owns no data and no editing state:
// the format that uses it keeps the selection and the edits, and tells the table what to show.

export type CellPosition = { rowId: number; columnId: number }
export type SortState = { columnId: number; direction: 'asc' | 'desc' } | null

const CELL_LINE_HEIGHT_PX = 20
// Rows are at least 28px for a mouse so more data fits on screen, and 36px on touch screens where cells are tapped.
const ROW_HEIGHT_PX = window.matchMedia('(pointer: coarse)').matches ? 36 : 28
const CELL_VERTICAL_PADDING_PX = (ROW_HEIGHT_PX - CELL_LINE_HEIGHT_PX) / 2
const COLUMN_MIN_WIDTH_PX = 80
const COLUMN_MAX_WIDTH_PX = 384
// Room around a cell's text (padding and the column border) and around a header's name (padding, sort arrow, menu button).
const CELL_PADDING_PX = 26
const HEADER_EXTRA_PX = 56
// Only the first rows are measured, so a 120,000-row file opens as fast as a small one.
const ROWS_MEASURED_FOR_WIDTH = 500
// A cell whose text is wider than its column wraps onto more lines, and its row grows to fit, up to this many lines.
const MAX_CELL_LINES = 6
const CELL_FONT = '14px system-ui, sans-serif'
const HEADER_FONT = '600 12px system-ui, sans-serif'
const measuringContext = document.createElement('canvas').getContext('2d')
const ROW_NUMBER_MIN_WIDTH_PX = 56

// Setting a canvas font is slow, so it is set only when it changes: measuring the rows of a big file sets it once.
let measuringFont = ''
function measureTextWidth(text: string, font: string) {
  if (!measuringContext) return 0
  if (measuringFont !== font) {
    measuringContext.font = font
    measuringFont = font
  }
  return measuringContext.measureText(text).width
}

const cellCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function compareCells(firstCell: string, secondCell: string) {
  const firstNumber = Number(firstCell)
  const secondNumber = Number(secondCell)
  const bothAreNumbers =
    firstCell.trim() !== '' && secondCell.trim() !== '' && !Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)
  return bothAreNumbers ? firstNumber - secondNumber : cellCollator.compare(firstCell, secondCell)
}

// 0 -> A, 25 -> Z, 26 -> AA, like the columns of a spreadsheet.
export function columnLabel(columnPosition: number) {
  let label = ''
  for (let remaining = columnPosition + 1; remaining > 0; remaining = Math.floor((remaining - 1) / 26)) {
    label = String.fromCharCode(65 + ((remaining - 1) % 26)) + label
  }
  return label
}

// How many lines a cell's text takes in a column of this width (a close estimate of the browser's wrapping).
function countCellLines(cellText: string, columnWidthPx: number) {
  const textWidthPx = columnWidthPx - CELL_PADDING_PX
  // Most cells are short: nine pixels per character is wider than almost any character at this size.
  if (cellText.length * 9 <= textWidthPx && !cellText.includes('\n')) return 1
  if (!measuringContext) return 1
  let lineCount = 0
  for (const paragraph of cellText.split(/\r\n|\n|\r/)) {
    lineCount += Math.max(1, Math.ceil((measureTextWidth(paragraph, CELL_FONT) * 1.05) / textWidthPx))
    if (lineCount >= MAX_CELL_LINES) return MAX_CELL_LINES
  }
  return lineCount
}

export const getRowNumberColumnWidthPx = (rowCount: number) => Math.max(ROW_NUMBER_MIN_WIDTH_PX, rowCount.toLocaleString().length * 10 + 36)

// Each column is as wide as its longest text among the first rows (and its header name), within a minimum and maximum.
// Original text only, so a column does not change width while it is being edited. Rows run from `firstRowId` up to (not
// including) `endRowId`.
export function measureColumnWidthsPx(
  columnIds: number[],
  columnNames: string[],
  firstRowId: number,
  endRowId: number,
  getOriginalText: (rowId: number, columnId: number) => string,
) {
  if (!measuringContext) return columnIds.map(() => COLUMN_MIN_WIDTH_PX)
  const lastMeasuredRowId = Math.min(endRowId, firstRowId + ROWS_MEASURED_FOR_WIDTH)
  return columnIds.map((columnId, columnPosition) => {
    let widestTextPx = measureTextWidth(columnNames[columnPosition], HEADER_FONT) + HEADER_EXTRA_PX - CELL_PADDING_PX
    for (let rowId = firstRowId; rowId < lastMeasuredRowId; rowId++) {
      widestTextPx = Math.max(widestTextPx, measureTextWidth(getOriginalText(rowId, columnId), CELL_FONT))
    }
    return Math.min(COLUMN_MAX_WIDTH_PX, Math.max(COLUMN_MIN_WIDTH_PX, Math.ceil(widestTextPx + CELL_PADDING_PX)))
  })
}

type VisibleRowIdsOptions = {
  rowIds: number[]
  columnIds: number[]
  searchText: string
  sort: SortState
  // The text a cell shows. Called only when the search or sort changes, so pass a reader of the edits as they are then.
  readText: (rowId: number, columnId: number) => string
  // Rows that stay in view while searching (rows the visitor just added), so a new row never disappears as it is created.
  isAlwaysShown?: (rowId: number) => boolean
  // Changes when the data behind `readText` is replaced (a new parse), so the lists are rebuilt.
  dataKey: unknown
}

// Rows are never copied: search and sort work on lists of row ids. They read the edits as they were when the search or
// sort last changed, so a row does not jump away from under the cursor while it is being edited.
export function useVisibleRowIds({ rowIds, columnIds, searchText, sort, readText, isAlwaysShown, dataKey }: VisibleRowIdsOptions) {
  const sortRowIds = useMemo(() => {
    if (!sort) return (ids: number[]) => ids
    const directionFactor = sort.direction === 'asc' ? 1 : -1
    return (ids: number[]) =>
      ids.sort((firstRowId, secondRowId) => directionFactor * compareCells(readText(firstRowId, sort.columnId), readText(secondRowId, sort.columnId)))
    // `readText` is a new function on every render; the lists are rebuilt only when the sort or the data changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, dataKey])

  return useMemo(() => {
    const lowerCaseSearch = searchText.trim().toLowerCase()
    if (lowerCaseSearch === '') return sortRowIds(rowIds.slice())
    const matchingRowIds = rowIds.filter(
      (rowId) => isAlwaysShown?.(rowId) || columnIds.some((columnId) => readText(rowId, columnId).toLowerCase().includes(lowerCaseSearch)),
    )
    return sortRowIds(matchingRowIds)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, rowIds, columnIds, dataKey, sortRowIds])
}

export function SortChevron({ direction }: { direction: 'asc' | 'desc' | null }) {
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

export function SearchIcon() {
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

type CellInputProps = {
  ariaLabel: string
  draft: string
  onDraftChange: (newDraft: string) => void
  onFinish: (shouldCommit: boolean, moveAfter?: 'down' | 'right') => void
  onBlur: () => void
}

// The text box that appears inside a cell (or a column header) while it is being edited.
export function CellInput({ ariaLabel, draft, onDraftChange, onFinish, onBlur }: CellInputProps) {
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

// A value that does not fit is cut off with an ellipsis. While the pointer is over the cell (or the cell is selected, which is
// how a tap works on a touch screen) the text grows over the neighbouring cells to show everything, wrapping onto more lines;
// a very long value stops growing (EXPANDED_MAX_*) and scrolls inside the cell. Nothing around it moves.
const EXPANDED_MAX_WIDTH_PX = 448 // = max-w-md
const EXPANDED_MAX_HEIGHT_PX = 192 // = max-h-48
const restingCellTextClassName = 'line-clamp-6 h-full w-full whitespace-pre-wrap break-words'
const expandedCellTextClassName =
  'z-[5] block h-auto max-h-48 min-h-full w-max min-w-full max-w-md overflow-auto whitespace-pre-wrap break-words leading-5'
const hoverExpandedCellTextClassName =
  'group-hover:z-[5] group-hover:h-auto group-hover:max-h-48 group-hover:min-h-full group-hover:w-max group-hover:min-w-full group-hover:max-w-md group-hover:overflow-auto group-hover:whitespace-pre-wrap group-hover:break-words group-hover:[-webkit-line-clamp:unset] group-hover:bg-paper-raised group-hover:leading-5 group-hover:outline group-hover:-outline-offset-1 group-hover:outline-rule'

const selectedCellTint = 'bg-[color-mix(in_srgb,var(--file-color)_14%,var(--paper-raised))]'

// Which way an expanded cell grows: away from the table's right and bottom edges, so it never adds scroll width or height.
type ExpandAnchor = CellPosition & { fromRight: boolean; fromBottom: boolean }

// What the format that owns the table can ask of it.
export type DataTableHandle = {
  scrollToRow: (rowPosition: number) => void
  focus: (options?: FocusOptions) => void
}

type DataTableProps = {
  // "CSV": the table is named "CSV data" for screen readers.
  label: string
  columnIds: number[]
  columnNames: string[]
  // Each column's measured width (see measureColumnWidthsPx); the table shares any spare room between the columns.
  columnWidthsPx: number[]
  rowNumberWidthPx: number
  // The rows to show, in order (after search and sort).
  rowIds: number[]
  getCellText: (rowId: number, columnId: number) => string
  // The text the row height is estimated from: the original text, so a row does not change height while it is edited.
  getOriginalText: (rowId: number, columnId: number) => string
  // Changes when the original text behind `getOriginalText` is replaced (a new file); row heights are worked out again then.
  dataKey: unknown
  isCellEdited: (rowId: number, columnId: number) => boolean
  // Rows added by the visitor show "new" instead of a row number.
  isInsertedRow?: (rowId: number) => boolean
  isFindMatch?: (cellText: string) => boolean
  selectedCell: CellPosition | null
  sort: SortState
  onCycleSort: (columnId: number) => void
  isEditable: boolean
  showColumnLetters?: boolean
  // When set, a column's name is a button (the column menu); otherwise it is plain text.
  onColumnNameClick?: (columnId: number, nameButton: HTMLElement) => void
  openMenuColumnId?: number | null
  renderHeaderExtras?: (columnId: number, columnName: string) => ReactNode
  // The text box for the cell being edited, or null when this cell is not being edited in place.
  renderCellEditor?: (rowId: number, columnId: number, columnName: string) => ReactNode
  onCellClick: (position: CellPosition) => void
  onCellDoubleClick: (position: CellPosition) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  // Shown under the header when there are no rows.
  emptyMessage: string | null
  tableRef: RefObject<DataTableHandle | null>
}

export default function DataTable({
  label,
  columnIds,
  columnNames,
  columnWidthsPx,
  rowNumberWidthPx,
  rowIds,
  getCellText,
  getOriginalText,
  dataKey,
  isCellEdited,
  isInsertedRow,
  isFindMatch,
  selectedCell,
  sort,
  onCycleSort,
  isEditable,
  showColumnLetters = true,
  onColumnNameClick,
  openMenuColumnId = null,
  renderHeaderExtras,
  renderCellEditor,
  onCellClick,
  onCellDoubleClick,
  onKeyDown,
  emptyMessage,
  tableRef,
}: DataTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // A row's height depends only on its original text and the column widths, so it is worked out once per row (measuring text is
  // slow) and kept while searching, sorting and editing change which rows are shown.
  const rowHeightCacheRef = useRef<{ dataKey: unknown; columnIds: number[]; widthsPx: number[]; heightsByRowId: Map<number, number> } | null>(null)
  const [gridWidthPx, setGridWidthPx] = useState(0)
  const [expandAnchor, setExpandAnchor] = useState<ExpandAnchor | null>(null)

  // Columns share any spare room equally (they grow to fill the window), so their real width can exceed the measured one.
  const shownColumnWidthsPx = useMemo(() => {
    const spareWidthPx = gridWidthPx - rowNumberWidthPx - columnWidthsPx.reduce((totalWidthPx, columnWidthPx) => totalWidthPx + columnWidthPx, 0)
    const extraWidthPerColumnPx = columnWidthsPx.length > 0 ? Math.max(0, spareWidthPx) / columnWidthsPx.length : 0
    return columnWidthsPx.map((columnWidthPx) => columnWidthPx + extraWidthPerColumnPx)
  }, [columnWidthsPx, gridWidthPx, rowNumberWidthPx])
  const tableMinWidthPx = rowNumberWidthPx + columnWidthsPx.reduce((totalWidthPx, columnWidthPx) => totalWidthPx + columnWidthPx, 0)

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rowIds.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (rowPosition) => {
      // Until the table's width is known the heights would be estimated from the wrong column widths, and then again.
      if (gridWidthPx === 0) return ROW_HEIGHT_PX
      let cache = rowHeightCacheRef.current
      if (!cache || cache.dataKey !== dataKey || cache.columnIds !== columnIds || cache.widthsPx !== shownColumnWidthsPx) {
        cache = { dataKey, columnIds, widthsPx: shownColumnWidthsPx, heightsByRowId: new Map() }
        rowHeightCacheRef.current = cache
      }
      const rowId = rowIds[rowPosition]
      const cachedHeight = cache.heightsByRowId.get(rowId)
      if (cachedHeight !== undefined) return cachedHeight
      let tallestCellLineCount = 1
      columnIds.forEach((columnId, columnPosition) => {
        const cellLineCount = countCellLines(getOriginalText(rowId, columnId), shownColumnWidthsPx[columnPosition])
        tallestCellLineCount = Math.max(tallestCellLineCount, cellLineCount)
      })
      const rowHeight = Math.max(ROW_HEIGHT_PX, tallestCellLineCount * CELL_LINE_HEIGHT_PX + 2 * CELL_VERTICAL_PADDING_PX)
      cache.heightsByRowId.set(rowId, rowHeight)
      return rowHeight
    },
    overscan: 12,
  })

  useImperativeHandle(
    tableRef,
    () => ({
      scrollToRow: (rowPosition) => rowVirtualizer.scrollToIndex(rowPosition),
      focus: (options) => scrollContainerRef.current?.focus(options),
    }),
    [rowVirtualizer],
  )

  // The window's width decides how much spare room the columns share.
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return
    const resizeObserver = new ResizeObserver(() => setGridWidthPx(scrollContainer.clientWidth))
    resizeObserver.observe(scrollContainer)
    return () => resizeObserver.disconnect()
  }, [])

  // The row heights depend on the column widths, which can change when columns are added, deleted or renamed.
  useEffect(() => {
    rowVirtualizer.measure()
  }, [rowVirtualizer, shownColumnWidthsPx])

  function anchorCellExpansion(cellElement: HTMLElement, position: CellPosition) {
    const containerBox = scrollContainerRef.current?.getBoundingClientRect()
    if (!containerBox) return
    const cellBox = cellElement.getBoundingClientRect()
    const fromRight = cellBox.left + EXPANDED_MAX_WIDTH_PX > containerBox.right
    const fromBottom = cellBox.top + EXPANDED_MAX_HEIGHT_PX > containerBox.bottom
    setExpandAnchor((current) =>
      current?.rowId === position.rowId && current.columnId === position.columnId && current.fromRight === fromRight && current.fromBottom === fromBottom
        ? current
        : { ...position, fromRight, fromBottom },
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${label} data, scrollable`}
      className="min-h-0 flex-1 overflow-auto outline-none"
      style={{ scrollPaddingTop: ROW_HEIGHT_PX, scrollPaddingLeft: rowNumberWidthPx }}
    >
      <div
        role="grid"
        aria-label={`${label} data`}
        aria-rowcount={rowIds.length + 1}
        aria-colcount={columnIds.length + 1}
        style={{ minWidth: tableMinWidthPx }}
      >
        <div role="row" aria-rowindex={1} className="sticky top-0 z-20 flex overflow-x-clip border-b-2 border-(--file-color) bg-paper">
          <div
            role="columnheader"
            className="sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-rule bg-paper px-3 text-xs text-ink-soft"
            style={{ width: rowNumberWidthPx, height: ROW_HEIGHT_PX }}
          >
            <span aria-hidden="true">#</span>
            <span className="sr-only">Row number</span>
          </div>
          {columnIds.map((columnId, columnPosition) => {
            const columnName = columnNames[columnPosition]
            const columnDirection = sort?.columnId === columnId ? sort.direction : null
            const isSelectedColumn = selectedCell?.columnId === columnId
            return (
              <div
                key={columnId}
                role="columnheader"
                aria-sort={columnDirection === 'asc' ? 'ascending' : columnDirection === 'desc' ? 'descending' : 'none'}
                className={`group relative min-w-0 border-r border-rule/60 ${isSelectedColumn ? selectedCellTint : ''}`}
                style={{ flex: `1 0 ${columnWidthsPx[columnPosition]}px`, height: ROW_HEIGHT_PX }}
              >
                {/* The name is cut off to fit the column. While the pointer is over the header (or it has focus) this strip grows to
                    show the whole name, over the neighbouring headers, and shrinks back when the pointer leaves. */}
                <div
                  className={`absolute inset-y-0 ${columnPosition === columnIds.length - 1 ? 'right-0' : 'left-0'} flex w-full items-center gap-1.5 px-2 group-focus-within:z-10 group-focus-within:w-max group-focus-within:max-w-96 group-focus-within:min-w-full group-focus-within:bg-paper-raised group-hover:z-10 group-hover:w-max group-hover:max-w-96 group-hover:min-w-full group-hover:bg-paper-raised group-hover:outline group-hover:-outline-offset-1 group-hover:outline-rule`}
                >
                  {showColumnLetters && (
                    <span aria-hidden="true" className="font-mono text-[10px] font-normal text-ink-soft">
                      {columnLabel(columnPosition)}
                    </span>
                  )}
                  {onColumnNameClick ? (
                    <button
                      type="button"
                      dir="auto"
                      aria-haspopup="menu"
                      aria-expanded={openMenuColumnId === columnId}
                      title={`Column actions for ${columnName}`}
                      onClick={(event) => onColumnNameClick(columnId, event.currentTarget)}
                      className="min-w-0 flex-1 cursor-pointer truncate text-start text-xs font-semibold hover:underline"
                    >
                      {columnName}
                    </button>
                  ) : (
                    <span dir="auto" className="min-w-0 flex-1 truncate text-xs font-semibold">
                      {columnName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onCycleSort(columnId)}
                    aria-label={`Sort by ${columnName}`}
                    title={`Sort by ${columnName}`}
                    className="grid size-5 pointer-coarse:size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200 hover:bg-paper-raised"
                  >
                    <SortChevron direction={columnDirection} />
                  </button>
                </div>
                {renderHeaderExtras?.(columnId, columnName)}
              </div>
            )
          })}
        </div>

        <div role="rowgroup" className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowId = rowIds[virtualRow.index]
            const isSelectedRow = selectedCell?.rowId === rowId
            const isNewRow = isInsertedRow?.(rowId) ?? false
            return (
              <div
                key={virtualRow.key}
                role="row"
                aria-rowindex={virtualRow.index + 2}
                className="absolute inset-x-0 flex border-b border-rule/70 bg-paper-raised"
                style={{ top: virtualRow.start, height: virtualRow.size }}
              >
                <div
                  role="rowheader"
                  className={`sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-rule px-3 text-xs tabular-nums ${
                    isSelectedRow ? `${selectedCellTint} font-semibold text-(--file-color)` : 'bg-paper text-ink-soft'
                  } ${isNewRow ? 'italic' : ''}`}
                  style={{ width: rowNumberWidthPx }}
                >
                  {isNewRow ? 'new' : (rowId + 1).toLocaleString()}
                </div>
                {columnIds.map((columnId, columnPosition) => {
                  const isEdited = isCellEdited(rowId, columnId)
                  const isSelected = isSelectedRow && selectedCell?.columnId === columnId
                  const cellText = getCellText(rowId, columnId)
                  const cellEditor = renderCellEditor?.(rowId, columnId, columnNames[columnPosition]) ?? null
                  const isMatch = isFindMatch?.(cellText) ?? false
                  const isExpandedHere = expandAnchor?.rowId === rowId && expandAnchor.columnId === columnId
                  return (
                    <div
                      key={columnId}
                      role="gridcell"
                      aria-selected={isSelected}
                      dir="auto"
                      onMouseEnter={(event) => anchorCellExpansion(event.currentTarget, { rowId, columnId })}
                      onClick={(event) => {
                        anchorCellExpansion(event.currentTarget, { rowId, columnId })
                        onCellClick({ rowId, columnId })
                        scrollContainerRef.current?.focus({ preventScroll: true })
                      }}
                      onDoubleClick={() => {
                        if (isEditable) onCellDoubleClick({ rowId, columnId })
                      }}
                      className={`group relative min-w-0 ${isEditable ? 'cursor-cell' : 'cursor-default'} border-r border-rule/60 tabular-nums ${
                        isSelected
                          ? `z-[1] ${selectedCellTint} outline-2 -outline-offset-2 outline-(--file-color)`
                          : isMatch
                            ? 'bg-accent/15'
                            : isEdited
                              ? 'bg-edit-mark/10'
                              : ''
                      }`}
                      style={{ flex: `1 0 ${columnWidthsPx[columnPosition]}px`, lineHeight: `${CELL_LINE_HEIGHT_PX}px` }}
                    >
                      {isEdited && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-edit-mark" />}
                      {cellEditor ?? (
                        <span
                          dir="auto"
                          style={{ paddingBlock: CELL_VERTICAL_PADDING_PX }}
                          className={`absolute px-3 ${isExpandedHere && expandAnchor.fromRight ? 'right-0' : 'left-0'} ${
                            isExpandedHere && expandAnchor.fromBottom ? 'bottom-0' : 'top-0'
                          } ${isSelected ? `${expandedCellTextClassName} ${selectedCellTint}` : `${restingCellTextClassName} ${hoverExpandedCellTextClassName}`}`}
                        >
                          {cellText}
                        </span>
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
      {rowIds.length === 0 && emptyMessage && <p className="p-6 text-ink-soft">{emptyMessage}</p>}
    </div>
  )
}
