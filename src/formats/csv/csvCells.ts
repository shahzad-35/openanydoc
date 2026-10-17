// The CSV edit model and cell helpers.
//
// Rows and columns have stable ids so that adding and deleting never shifts the edits: an original row or column keeps its
// position in the file as its id (0, 1, 2 ...); a row or column added by the visitor gets a negative id (-2, -3 ...). The id
// -1 is only ever used as an anchor meaning "before the first one". Edits are sparse, so a 100k-row file is never copied.
// Changes that rebuild the whole table (transpose, split or merge a column, apply the sort to the file) store the new table as
// `table`; the ids then count from that table, and the earlier sparse edits are folded into it.

import { translate, translatePlural } from '../../i18n'
import type { Locale } from '../../i18n'

export type CellPosition = { rowId: number; columnId: number }

// A row or column added by the visitor, shown right after the line with id `afterId` (-1 = before the first one).
export type InsertedLine = { id: number; afterId: number }

export type CsvEdits = {
  // New text for cells, by "rowId:columnId". A cell back at its original text is removed.
  cells: ReadonlyMap<string, string>
  deletedRowIds: ReadonlySet<number>
  deletedColumnIds: ReadonlySet<number>
  insertedRows: readonly InsertedLine[]
  insertedColumns: readonly InsertedLine[]
  nextRowId: number
  nextColumnId: number
  // The order of the columns after they were moved; null keeps the file's order.
  columnOrder: readonly number[] | null
  // The whole table after a change that rebuilt it (header row included when there is one); null uses the file as read.
  table: string[][] | null
}

type LineKind = 'row' | 'column'

export function cellKey(rowId: number, columnId: number) {
  return `${rowId}:${columnId}`
}

export function parseCellKey(key: string): CellPosition {
  const separatorIndex = key.indexOf(':')
  return { rowId: Number(key.slice(0, separatorIndex)), columnId: Number(key.slice(separatorIndex + 1)) }
}

export function isInsertedLine(id: number) {
  return id <= -2
}

export function createEmptyCsvEdits(): CsvEdits {
  return {
    cells: new Map(),
    deletedRowIds: new Set(),
    deletedColumnIds: new Set(),
    insertedRows: [],
    insertedColumns: [],
    nextRowId: -2,
    nextColumnId: -2,
    columnOrder: null,
    table: null,
  }
}

export function getOriginalCellText(rows: string[][], rowId: number, columnId: number) {
  return rowId >= 0 && columnId >= 0 ? (rows[rowId]?.[columnId] ?? '') : ''
}

export function getCellText(rows: string[][], edits: CsvEdits, rowId: number, columnId: number) {
  return edits.cells.get(cellKey(rowId, columnId)) ?? getOriginalCellText(rows, rowId, columnId)
}

// The ids in display order: the originals from `firstOriginalId` up to (not including) `endOriginalId` minus the deleted ones,
// with each added line placed after the line it was added below. Repeated adds below the same line stack newest first.
export function buildDisplayIds(
  firstOriginalId: number,
  endOriginalId: number,
  deletedIds: ReadonlySet<number>,
  insertedLines: readonly InsertedLine[],
) {
  const displayIds: number[] = []
  if (deletedIds.size === 0 && insertedLines.length === 0) {
    for (let id = firstOriginalId; id < endOriginalId; id++) displayIds.push(id)
    return displayIds
  }
  const addedByAnchor = new Map<number, number[]>()
  for (let position = insertedLines.length - 1; position >= 0; position--) {
    const { id, afterId } = insertedLines[position]
    addedByAnchor.set(afterId, [...(addedByAnchor.get(afterId) ?? []), id])
  }
  function pushAddedAfter(anchorId: number) {
    for (const addedId of addedByAnchor.get(anchorId) ?? []) {
      displayIds.push(addedId)
      pushAddedAfter(addedId)
    }
  }
  pushAddedAfter(-1)
  for (let id = firstOriginalId; id < endOriginalId; id++) {
    if (!deletedIds.has(id)) displayIds.push(id)
    pushAddedAfter(id)
  }
  return displayIds
}

// Sets one cell's new text, or removes the edit when the text is back to the original. Unchanged text returns the same
// object, so it never adds an undo step.
export function withCellText(edits: CsvEdits, position: CellPosition, originalText: string, newText: string): CsvEdits {
  const key = cellKey(position.rowId, position.columnId)
  if (newText === (edits.cells.get(key) ?? originalText)) return edits
  const nextCells = new Map(edits.cells)
  if (newText === originalText) nextCells.delete(key)
  else nextCells.set(key, newText)
  return { ...edits, cells: nextCells }
}

// The columns on display, in order: the file's order (or the moved order), minus the deleted ones, plus the added ones.
export function getDisplayColumnIds(edits: CsvEdits, columnCount: number) {
  const columnIds = buildDisplayIds(0, columnCount, edits.deletedColumnIds, edits.insertedColumns)
  if (edits.columnOrder === null) return columnIds
  const shownIds = new Set(columnIds)
  return edits.columnOrder.filter((columnId) => shownIds.has(columnId))
}

export function withInsertedLine(edits: CsvEdits, kind: LineKind, afterId: number): CsvEdits {
  if (kind === 'row') {
    return { ...edits, insertedRows: [...edits.insertedRows, { id: edits.nextRowId, afterId }], nextRowId: edits.nextRowId - 1 }
  }
  let columnOrder = edits.columnOrder
  if (columnOrder !== null) {
    const nextOrder = [...columnOrder]
    nextOrder.splice(nextOrder.indexOf(afterId) + 1, 0, edits.nextColumnId)
    columnOrder = nextOrder
  }
  return {
    ...edits,
    insertedColumns: [...edits.insertedColumns, { id: edits.nextColumnId, afterId }],
    nextColumnId: edits.nextColumnId - 1,
    columnOrder,
  }
}

// Moves a column to another place among the shown columns (`toPosition` counts from 0 in the shown order).
export function withMovedColumn(edits: CsvEdits, displayColumnIds: readonly number[], columnId: number, toPosition: number): CsvEdits {
  const fromPosition = displayColumnIds.indexOf(columnId)
  if (fromPosition === -1 || fromPosition === toPosition || toPosition < 0 || toPosition >= displayColumnIds.length) return edits
  const columnOrder = [...displayColumnIds]
  columnOrder.splice(fromPosition, 1)
  columnOrder.splice(toPosition, 0, columnId)
  return { ...edits, columnOrder }
}

// Deleting an original line hides it; deleting one added here removes it for good, with its typed cells, and whatever was
// added below it moves up to follow what it followed.
export function withDeletedLine(edits: CsvEdits, kind: LineKind, id: number): CsvEdits {
  const deletedKey = kind === 'row' ? 'deletedRowIds' : 'deletedColumnIds'
  if (!isInsertedLine(id)) {
    return { ...edits, [deletedKey]: new Set([...edits[deletedKey], id]) }
  }
  const insertedKey = kind === 'row' ? 'insertedRows' : 'insertedColumns'
  const removedLine = edits[insertedKey].find((line) => line.id === id)
  if (!removedLine) return edits
  const remainingLines = edits[insertedKey]
    .filter((line) => line.id !== id)
    .map((line) => (line.afterId === id ? { ...line, afterId: removedLine.afterId } : line))
  const remainingCells = new Map(edits.cells)
  for (const key of edits.cells.keys()) {
    const position = parseCellKey(key)
    if ((kind === 'row' ? position.rowId : position.columnId) === id) remainingCells.delete(key)
  }
  return { ...edits, [insertedKey]: remainingLines, cells: remainingCells }
}

export function countCsvEdits(edits: CsvEdits) {
  return (
    edits.cells.size +
    edits.deletedRowIds.size +
    edits.deletedColumnIds.size +
    edits.insertedRows.length +
    edits.insertedColumns.length +
    (edits.columnOrder === null ? 0 : 1) +
    (edits.table === null ? 0 : 1)
  )
}

// Edited cells that are still on display (cells in deleted rows or columns no longer count).
export function countShownEditedCells(edits: CsvEdits) {
  if (edits.deletedRowIds.size === 0 && edits.deletedColumnIds.size === 0) return edits.cells.size
  let count = 0
  for (const key of edits.cells.keys()) {
    const { rowId, columnId } = parseCellKey(key)
    if (!edits.deletedRowIds.has(rowId) && !edits.deletedColumnIds.has(columnId)) count++
  }
  return count
}

// "3 edited cells, 1 row deleted": what the header counter says. Cells in deleted rows or columns are not counted.
export function describeCsvChanges(edits: CsvEdits, locale: Locale) {
  const editedCellCount = countShownEditedCells(edits)
  return [
    editedCellCount > 0 && translatePlural(locale, 'csv.summary.editedCells', editedCellCount),
    edits.insertedRows.length > 0 && translatePlural(locale, 'csv.summary.rowsAdded', edits.insertedRows.length),
    edits.deletedRowIds.size > 0 && translatePlural(locale, 'csv.summary.rowsDeleted', edits.deletedRowIds.size),
    edits.insertedColumns.length > 0 && translatePlural(locale, 'csv.summary.columnsAdded', edits.insertedColumns.length),
    edits.deletedColumnIds.size > 0 && translatePlural(locale, 'csv.summary.columnsDeleted', edits.deletedColumnIds.size),
    edits.columnOrder !== null && translate(locale, 'csv.summary.columnsMoved'),
    edits.table !== null && translate(locale, 'csv.summary.tableRebuilt'),
  ]
    .filter(Boolean)
    .join(translate(locale, 'csv.summary.separator'))
}

// The table as it is now (edits applied), for a change that rebuilds it.
export function readTable(rows: string[][], edits: CsvEdits, rowIds: readonly number[], columnIds: readonly number[]) {
  return rowIds.map((rowId) => columnIds.map((columnId) => getCellText(rows, edits, rowId, columnId)))
}

// The edits after a change that rebuilt the whole table: only the new table is kept, so this is one undo step.
export function withRebuiltTable(table: string[][]): CsvEdits {
  return { ...createEmptyCsvEdits(), table }
}

// The table turned on its side: columns become rows, so the old first column becomes the new first row.
export function transposeTable(table: string[][]) {
  const columnCount = Math.max(0, ...table.map((row) => row.length))
  return Array.from({ length: columnCount }, (_, columnPosition) => table.map((row) => row[columnPosition] ?? ''))
}

// A column split at every separator into new columns placed after it, named "name_1", "name_2"...; the original can stay.
export function splitColumnInTable(table: string[][], columnPosition: number, separator: string, keepOriginal: boolean, hasHeaderRow: boolean, maxParts: number) {
  if (separator === '') return table
  const dataStart = hasHeaderRow ? 1 : 0
  const partsByRow = table.map((row, rowPosition) => (rowPosition < dataStart ? [] : (row[columnPosition] ?? '').split(separator).slice(0, maxParts)))
  const partCount = Math.max(1, ...partsByRow.map((parts) => parts.length))
  const baseName = hasHeaderRow ? table[0][columnPosition] || `column${columnPosition + 1}` : ''
  return table.map((row, rowPosition) => {
    const newCells = Array.from({ length: partCount }, (_, partPosition) => (rowPosition < dataStart ? `${baseName}_${partPosition + 1}` : (partsByRow[rowPosition][partPosition] ?? '')))
    return [...row.slice(0, keepOriginal ? columnPosition + 1 : columnPosition), ...newCells, ...row.slice(columnPosition + 1)]
  })
}

// Two columns joined into a new column placed after the later one (empty parts are left out).
export function mergeColumnsInTable(table: string[][], firstPosition: number, secondPosition: number, separator: string, newName: string, hasHeaderRow: boolean) {
  const insertAt = Math.max(firstPosition, secondPosition) + 1
  return table.map((row, rowPosition) => {
    const mergedText = hasHeaderRow && rowPosition === 0 ? newName : [row[firstPosition] ?? '', row[secondPosition] ?? ''].filter((text) => text !== '').join(separator)
    return [...row.slice(0, insertAt), mergedText, ...row.slice(insertAt)]
  })
}

// ---------------------------------------------------------------- column and table clean-up
// Each function returns one edits object, so one toolbar action is one undo step.

export type CellTextTransform = 'trim' | 'upper' | 'lower' | 'capitalize'

export const cellTextTransforms: Record<CellTextTransform, (text: string) => string> = {
  trim: (text) => text.trim().replace(/\s+/g, ' '),
  upper: (text) => text.toLocaleUpperCase(),
  lower: (text) => text.toLocaleLowerCase(),
  capitalize: (text) => text.toLocaleLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase()),
}

// Sets many cells at once (paste, clear, replace): one edits object, so one undo step. Unchanged text adds nothing.
export function withCellTexts(edits: CsvEdits, rows: string[][], changes: readonly (CellPosition & { text: string })[]) {
  const nextCells = new Map(edits.cells)
  let changedCount = 0
  for (const { rowId, columnId, text } of changes) {
    const key = cellKey(rowId, columnId)
    const originalText = getOriginalCellText(rows, rowId, columnId)
    if (text === (nextCells.get(key) ?? originalText)) continue
    changedCount++
    if (text === originalText) nextCells.delete(key)
    else nextCells.set(key, text)
  }
  return { edits: changedCount === 0 ? edits : { ...edits, cells: nextCells }, changedCount }
}

// Applies a text change to every given cell (change case, trim, replace).
export function withMappedCells(edits: CsvEdits, rows: string[][], rowIds: readonly number[], columnIds: readonly number[], mapText: (text: string) => string) {
  const changes: (CellPosition & { text: string })[] = []
  for (const rowId of rowIds) {
    for (const columnId of columnIds) {
      const currentText = getCellText(rows, edits, rowId, columnId)
      const newText = mapText(currentText)
      if (newText !== currentText) changes.push({ rowId, columnId, text: newText })
    }
  }
  return withCellTexts(edits, rows, changes)
}

// Fills every empty cell of a column with the closest filled cell above it.
export function withFilledDown(edits: CsvEdits, rows: string[][], rowIds: readonly number[], columnId: number): CsvEdits {
  const nextCells = new Map(edits.cells)
  let lastFilledText = ''
  for (const rowId of rowIds) {
    const currentText = getCellText(rows, edits, rowId, columnId)
    if (currentText.trim() !== '') {
      lastFilledText = currentText
      continue
    }
    if (lastFilledText === '' || currentText === lastFilledText) continue
    const key = cellKey(rowId, columnId)
    if (lastFilledText === getOriginalCellText(rows, rowId, columnId)) nextCells.delete(key)
    else nextCells.set(key, lastFilledText)
  }
  return nextCells.size === edits.cells.size && [...nextCells].every(([key, text]) => edits.cells.get(key) === text) ? edits : { ...edits, cells: nextCells }
}

// Deletes many rows at once (a loop of withDeletedLine would copy the set for every row).
export function withDeletedRows(edits: CsvEdits, deletedRowIds: readonly number[]): CsvEdits {
  if (deletedRowIds.length === 0) return edits
  const originalIds = deletedRowIds.filter((rowId) => !isInsertedLine(rowId))
  let nextEdits: CsvEdits = { ...edits, deletedRowIds: new Set([...edits.deletedRowIds, ...originalIds]) }
  for (const rowId of deletedRowIds) {
    if (isInsertedLine(rowId)) nextEdits = withDeletedLine(nextEdits, 'row', rowId)
  }
  return nextEdits
}

export function withoutEmptyRows(edits: CsvEdits, rows: string[][], rowIds: readonly number[], columnIds: readonly number[]) {
  const emptyRowIds = rowIds.filter((rowId) => columnIds.every((columnId) => getCellText(rows, edits, rowId, columnId).trim() === ''))
  return { edits: withDeletedRows(edits, emptyRowIds), removedCount: emptyRowIds.length }
}

export function withRestoredRow(edits: CsvEdits, rowId: number): CsvEdits {
  if (!edits.deletedRowIds.has(rowId)) return edits
  const deletedRowIds = new Set(edits.deletedRowIds)
  deletedRowIds.delete(rowId)
  return { ...edits, deletedRowIds }
}

// Keeps the first of every group of rows that are the same in the given columns.
export function withoutDuplicateRows(edits: CsvEdits, rows: string[][], rowIds: readonly number[], columnIds: readonly number[]) {
  const seenRowTexts = new Set<string>()
  const duplicateRowIds: number[] = []
  for (const rowId of rowIds) {
    const rowText = columnIds.map((columnId) => getCellText(rows, edits, rowId, columnId)).join('\u0000')
    if (seenRowTexts.has(rowText)) duplicateRowIds.push(rowId)
    else seenRowTexts.add(rowText)
  }
  return { edits: withDeletedRows(edits, duplicateRowIds), removedCount: duplicateRowIds.length }
}
