import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, Ref } from 'react'
import { useT } from '../../i18n'
import { COLUMN_TYPE_LABEL_KEYS } from './csvAnalysis'
import type { ColumnType } from './csvAnalysis'

const ROW_HEIGHT_PX = window.matchMedia('(max-width: 760px)').matches ? 35 : 31
const MIN_COLUMN_WIDTH_PX = 56
const MAX_COLUMN_WIDTH_PX = 420

export type GridColumn = {
  id: number
  name: string
  letter: string
  type: ColumnType
  widthPx: number
  isRightToLeft: boolean
}

// Positions in the shown rows and columns (not ids). r0/c0 is where the selection started, r1/c1 where it ends.
export type GridSelection = { r0: number; c0: number; r1: number; c1: number }

export type CsvGridHandle = {
  scrollToCell: (rowPosition: number, columnPosition: number) => void
  focus: () => void
}

type CsvGridProps = {
  gridRef: Ref<CsvGridHandle>
  label: string
  columns: GridColumn[]
  rowIds: readonly number[]
  getText: (rowId: number, columnId: number) => string
  getRowLabel: (rowId: number) => string
  isEdited: (rowId: number, columnId: number) => boolean
  isMissing: (rowId: number, columnId: number) => boolean
  frozenCount: number
  sortOrderByColumnId: ReadonlyMap<number, { level: number; direction: 'asc' | 'desc' }>
  showSortLevels: boolean
  filteredColumnIds: ReadonlySet<number>
  selectedColumnId: number | null
  selection: GridSelection | null
  active: { r: number; c: number } | null
  searchText: string
  // Find and replace: whether a cell's text matches, and the one column it looks in (null = all).
  findMatches: ((text: string) => boolean) | null
  findColumnId: number | null
  editingCell: { r: number; c: number; draft: string } | null
  onEditDraftChange: (draft: string) => void
  onEditFinish: (shouldSave: boolean, moveAfter?: 'down' | 'right') => void
  onCellMouseDown: (rowPosition: number, columnPosition: number, extend: boolean) => void
  onCellMouseEnter: (rowPosition: number, columnPosition: number) => void
  onCellDoubleClick: (rowPosition: number, columnPosition: number) => void
  onCellContextMenu: (rowPosition: number, columnPosition: number, event: ReactMouseEvent) => void
  onRowHeaderMouseDown: (rowPosition: number) => void
  onHeaderClick: (columnPosition: number, withShift: boolean) => void
  onHeaderMenu: (columnPosition: number, button: HTMLElement) => void
  onColumnResize: (columnId: number, widthPx: number) => void
  onColumnMove: (columnId: number, beforeColumnId: number) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  emptyContent: ReactNode
}

function FilterIcon() {
  return (
    <svg className="ico sm" aria-hidden="true">
      <use href="#i-filter" />
    </svg>
  )
}

// The search text marked once in a cell.
function MarkedText({ text, searchText }: { text: string; searchText: string }) {
  const matchStart = searchText === '' ? -1 : text.toLowerCase().indexOf(searchText.toLowerCase())
  if (matchStart === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, matchStart)}
      <mark>{text.slice(matchStart, matchStart + searchText.length)}</mark>
      {text.slice(matchStart + searchText.length)}
    </>
  )
}

// The table of the CSV page, drawn with the studio's markup: a sticky header with the column name, its type, its sort level
// and a menu button, a sticky row-number column, frozen first columns, and only the rows on screen.
export default function CsvGrid(props: CsvGridProps) {
  const { gridRef, label, columns, rowIds, getText, getRowLabel, frozenCount, selection, active, editingCell, searchText, findMatches, findColumnId } = props
  const { t } = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [paneWidthPx, setPaneWidthPx] = useState(0)
  const [dropBeforeColumnId, setDropBeforeColumnId] = useState<number | null>(null)
  const dragColumnIdRef = useRef<number | null>(null)
  const rowNumberWidthPx = Math.max(46, String(rowIds.length).length * 7 + 18)

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const rowVirtualizer = useVirtualizer({ count: rowIds.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_HEIGHT_PX, overscan: 12 })

  useImperativeHandle(gridRef, () => ({
    scrollToCell(rowPosition: number, columnPosition: number) {
      rowVirtualizer.scrollToIndex(rowPosition, { align: 'auto' })
      const scroller = scrollRef.current
      if (!scroller || columnPosition < frozenCount) return
      const columnStart = rowNumberWidthPx + columns.slice(0, columnPosition).reduce((total, column) => total + column.widthPx, 0)
      const frozenWidth = rowNumberWidthPx + columns.slice(0, frozenCount).reduce((total, column) => total + column.widthPx, 0)
      const columnEnd = columnStart + (columns[columnPosition]?.widthPx ?? 0)
      if (columnStart - frozenWidth < scroller.scrollLeft) scroller.scrollLeft = columnStart - frozenWidth
      else if (columnEnd > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = columnEnd - scroller.clientWidth
    },
    focus: () => scrollRef.current?.focus({ preventScroll: true }),
  }))

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const observer = new ResizeObserver(() => setPaneWidthPx(scroller.clientWidth))
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  // The last column takes any spare width, so the grid always fills the pane.
  const naturalWidthPx = rowNumberWidthPx + columns.reduce((total, column) => total + column.widthPx, 0)
  const spareWidthPx = Math.max(0, paneWidthPx - naturalWidthPx)
  const widthOf = (columnPosition: number) => columns[columnPosition].widthPx + (columnPosition === columns.length - 1 ? spareWidthPx : 0)
  const frozenLeftOf = (columnPosition: number) => rowNumberWidthPx + columns.slice(0, columnPosition).reduce((total, column) => total + column.widthPx, 0)

  const rowMin = selection ? Math.min(selection.r0, selection.r1) : -1
  const rowMax = selection ? Math.max(selection.r0, selection.r1) : -1
  const columnMin = selection ? Math.min(selection.c0, selection.c1) : -1
  const columnMax = selection ? Math.max(selection.c0, selection.c1) : -1
  const isRange = selection !== null && (rowMax > rowMin || columnMax > columnMin)

  function startResize(event: ReactMouseEvent, column: GridColumn) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = column.widthPx
    const handle = event.currentTarget
    handle.classList.add('dragging')
    function resizeWhileDragging(moveEvent: MouseEvent) {
      props.onColumnResize(column.id, Math.max(MIN_COLUMN_WIDTH_PX, Math.min(MAX_COLUMN_WIDTH_PX, startWidth + moveEvent.clientX - startX)))
    }
    function stopResizing() {
      handle.classList.remove('dragging')
      document.removeEventListener('mousemove', resizeWhileDragging)
      document.removeEventListener('mouseup', stopResizing)
    }
    document.addEventListener('mousemove', resizeWhileDragging)
    document.addEventListener('mouseup', stopResizing)
  }

  const virtualRows = rowVirtualizer.getVirtualItems()
  const topSpacerPx = virtualRows.length > 0 ? virtualRows[0].start : 0
  const bottomSpacerPx = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

  return (
    <div id="grid-scroll" ref={scrollRef} dir="ltr" tabIndex={0} onKeyDown={props.onKeyDown}>
      <table id="data-table" role="grid" aria-label={label} aria-rowcount={rowIds.length} dir="ltr" style={{ width: naturalWidthPx + spareWidthPx }}>
        <colgroup>
          <col style={{ width: rowNumberWidthPx }} />
          {columns.map((column, columnPosition) => (
            <col key={column.id} style={{ width: widthOf(columnPosition) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="rn" scope="col" style={{ width: rowNumberWidthPx }}>
              <span className="sr-only">{t('csv.wb.rowHeader')}</span>#
            </th>
            {columns.map((column, columnPosition) => {
              const sortOrder = props.sortOrderByColumnId.get(column.id)
              const isFrozen = columnPosition < frozenCount
              const className = [
                'hd',
                props.filteredColumnIds.has(column.id) && 'filtered',
                column.id === props.selectedColumnId && 'col-selected',
                isFrozen && 'frozen',
                isFrozen && columnPosition === frozenCount - 1 && 'frozen-edge',
                dropBeforeColumnId === column.id && 'drop-before',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <th
                  key={column.id}
                  scope="col"
                  className={className}
                  style={isFrozen ? { left: frozenLeftOf(columnPosition) } : undefined}
                  aria-sort={sortOrder ? (sortOrder.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onDragOver={(event) => {
                    if (dragColumnIdRef.current === null) return
                    event.preventDefault()
                    setDropBeforeColumnId(column.id)
                  }}
                  onDrop={(event) => {
                    if (dragColumnIdRef.current === null) return
                    event.preventDefault()
                    props.onColumnMove(dragColumnIdRef.current, column.id)
                    dragColumnIdRef.current = null
                    setDropBeforeColumnId(null)
                  }}
                >
                  <div className="hd-inner" onClick={(event) => props.onHeaderClick(columnPosition, event.shiftKey)}>
                    <span
                      className="grip-h"
                      draggable
                      title={t('csv.wb.dragToReorder')}
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        dragColumnIdRef.current = column.id
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', column.name)
                      }}
                      onDragEnd={() => {
                        dragColumnIdRef.current = null
                        setDropBeforeColumnId(null)
                      }}
                    >
                      <svg className="ico xs" viewBox="0 0 10 16" style={{ fill: 'currentColor', stroke: 'none' }} aria-hidden="true">
                        <use href="#i-grip" />
                      </svg>
                    </span>
                    <span className="hd-name" dir="auto" title={column.name}>
                      {column.name}
                    </span>
                    {sortOrder && (
                      <span className="sort-ind" title={t('csv.wb.sortLevel', { level: sortOrder.level })}>
                        {props.showSortLevels ? sortOrder.level : ''}
                        {sortOrder.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    <span className="hd-type">{t(COLUMN_TYPE_LABEL_KEYS[column.type])}</span>
                  </div>
                  <button
                    className="hd-btn"
                    id={`column-menu-${columnPosition}`}
                    type="button"
                    aria-label={t('csv.wb.columnMenu', { name: column.name })}
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onHeaderMenu(columnPosition, event.currentTarget)
                    }}
                  >
                    <FilterIcon />
                  </button>
                  <span className="col-resize" title={t('csv.wb.dragToResize')} onMouseDown={(event) => startResize(event, column)} />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {topSpacerPx > 0 && (
            <tr className="grid-spacer" aria-hidden="true">
              <td colSpan={columns.length + 1} style={{ height: topSpacerPx }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const rowPosition = virtualRow.index
            const rowId = rowIds[rowPosition]
            return (
              <tr key={rowId} aria-rowindex={rowPosition + 1}>
                <td className="rn" onMouseDown={() => props.onRowHeaderMouseDown(rowPosition)}>
                  {getRowLabel(rowId)}
                </td>
                {columns.map((column, columnPosition) => {
                  const text = getText(rowId, column.id)
                  const isEditing = editingCell !== null && editingCell.r === rowPosition && editingCell.c === columnPosition
                  const isFrozen = columnPosition < frozenCount
                  const isFindHit = findMatches !== null && (findColumnId === null || findColumnId === column.id) && findMatches(text)
                  const isMissingCell = props.isMissing(rowId, column.id)
                  const className = [
                    column.type === 'number' && 'r',
                    column.type === 'date' && 'd',
                    column.isRightToLeft && 'ar',
                    isMissingCell && 'missing',
                    props.isEdited(rowId, column.id) && 'edited',
                    column.id === props.selectedColumnId && 'col-sel',
                    isFrozen && 'frozen',
                    isFrozen && columnPosition === frozenCount - 1 && 'frozen-edge',
                    isFindHit && 'hit',
                    isRange && rowPosition >= rowMin && rowPosition <= rowMax && columnPosition >= columnMin && columnPosition <= columnMax && 'in-sel',
                    active !== null && active.r === rowPosition && active.c === columnPosition && 'active',
                    isEditing && 'editing',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <td
                      key={column.id}
                      id={`cell-${rowPosition}-${columnPosition}`}
                      className={className}
                      dir={column.isRightToLeft ? 'auto' : undefined}
                      style={isFrozen ? { left: frozenLeftOf(columnPosition) } : undefined}
                      title={isMissingCell ? t('csv.wb.missingField') : undefined}
                      onMouseDown={(event) => {
                        if (isEditing || event.button !== 0) return
                        event.preventDefault()
                        scrollRef.current?.focus({ preventScroll: true })
                        props.onCellMouseDown(rowPosition, columnPosition, event.shiftKey)
                      }}
                      onMouseEnter={() => props.onCellMouseEnter(rowPosition, columnPosition)}
                      onDoubleClick={() => props.onCellDoubleClick(rowPosition, columnPosition)}
                      onContextMenu={(event) => props.onCellContextMenu(rowPosition, columnPosition, event)}
                    >
                      {isEditing ? (
                        <input
                          id="cell-value-inline-input"
                          aria-label={t('csv.wb.editCell', { name: column.name })}
                          dir={column.isRightToLeft ? 'auto' : undefined}
                          autoFocus
                          value={editingCell.draft}
                          onFocus={(event) => {
                            if (event.currentTarget.value.length > 1) event.currentTarget.select()
                          }}
                          onChange={(event) => props.onEditDraftChange(event.target.value)}
                          onKeyDown={(event) => {
                            event.stopPropagation()
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              props.onEditFinish(true, 'down')
                            } else if (event.key === 'Tab') {
                              event.preventDefault()
                              props.onEditFinish(true, 'right')
                            } else if (event.key === 'Escape') {
                              event.preventDefault()
                              props.onEditFinish(false)
                            }
                          }}
                          onBlur={() => props.onEditFinish(true)}
                        />
                      ) : column.type === 'bool' && text !== '' ? (
                        <>
                          <span className={`b-dot ${text.toLowerCase() === 'true' ? 'y' : 'n'}`} />
                          {text}
                        </>
                      ) : (
                        <MarkedText text={text} searchText={searchText} />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {bottomSpacerPx > 0 && (
            <tr className="grid-spacer" aria-hidden="true">
              <td colSpan={columns.length + 1} style={{ height: bottomSpacerPx }} />
            </tr>
          )}
        </tbody>
      </table>
      {rowIds.length === 0 && (
        <div id="grid-empty" className="shown" dir="auto">
          {props.emptyContent}
        </div>
      )}
    </div>
  )
}
