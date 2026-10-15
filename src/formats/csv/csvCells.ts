// The CSV edit model and cell helpers, shared by the CSV viewer (loaded for viewing) and the CSV editing module (loaded on
// first Edit).
//
// Rows and columns have stable ids so that adding and deleting never shifts the edits: an original row or column keeps its
// position in the file as its id (0, 1, 2 ...); a row or column added by the visitor gets a negative id (-2, -3 ...). The id
// -1 is only ever used as an anchor meaning "before the first one". Edits are sparse, so a 100k-row file is never copied.

import Papa from 'papaparse'
import { translate, translatePlural } from '../../i18n'
import type { Locale } from '../../i18n'
import type { TableFormat } from '../../viewers'

import type { CellPosition } from '../DataTable'
export type { CellPosition }

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
}

type LineKind = 'row' | 'column'

// What the toolbar tools need to know about the table and the selected cell.
export type CsvSelection = {
  cell: CellPosition | null
  originalText: string
  isEdited: boolean
  // The last row and column shown, where "Add row" and "Add column" go when no cell is selected (-1 when there are none).
  lastRowId: number
  lastColumnId: number
  columnCount: number
  hasHeaderRow: boolean
} | null

// Everything the export functions need besides the edits.
export type CsvExportSource = {
  rows: string[][]
  hasHeaderRow: boolean
  detectedDelimiter: string
  hadByteOrderMark: boolean
  // The download's name and type: CSV, TSV or Text.
  tableFormat: TableFormat
  displayColumnIds: number[]
  // Rows matching the current search, in the current sort order.
  visibleRowIds: number[]
}

// Things the toolbar can ask the viewer to do.
export type CsvViewerCommands = {
  toggleFindReplace: () => void
  // The viewer's actions as they are now, read when a toolbar item is chosen.
  getActions: () => CsvActions
}

// What the toolbar's icons do. "Column" actions work on the column of the selected cell.
export type CsvActions = {
  insertRow: (side: 'above' | 'below') => void
  deleteRow: () => void
  insertColumn: (side: 'left' | 'right') => void
  deleteColumn: () => void
  clearCell: () => void
  revertCell: () => void
  transformColumn: (transform: CellTextTransform) => void
  fillColumnDown: () => void
  trimAllCells: () => void
  removeEmptyRows: () => void
  removeDuplicateRows: () => void
}

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

// The row number from the file; rows added here have none. Used in cell addresses and ids, so "new" is the same in every language.
export function rowLabel(rowId: number) {
  return isInsertedLine(rowId) ? 'new' : String(rowId + 1)
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

export function withInsertedLine(edits: CsvEdits, kind: LineKind, afterId: number): CsvEdits {
  if (kind === 'row') {
    return { ...edits, insertedRows: [...edits.insertedRows, { id: edits.nextRowId, afterId }], nextRowId: edits.nextRowId - 1 }
  }
  return {
    ...edits,
    insertedColumns: [...edits.insertedColumns, { id: edits.nextColumnId, afterId }],
    nextColumnId: edits.nextColumnId - 1,
  }
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
    edits.cells.size + edits.deletedRowIds.size + edits.deletedColumnIds.size + edits.insertedRows.length + edits.insertedColumns.length
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
  ]
    .filter(Boolean)
    .join(translate(locale, 'csv.summary.separator'))
}

// The CSV text the Download icon saves: the header (when the file has one) and the rows the search leaves, in the current
// sort order, with the edits applied and the deleted and added columns taken into account. No byte order mark.
export function buildCsvText(edits: CsvEdits, source: CsvExportSource) {
  const dataRows = source.visibleRowIds.map((rowId) =>
    source.displayColumnIds.map((columnId) => getCellText(source.rows, edits, rowId, columnId)),
  )
  const headerRows = source.hasHeaderRow ? [source.displayColumnIds.map((columnId) => getCellText(source.rows, edits, 0, columnId))] : []
  return Papa.unparse([...headerRows, ...dataRows], { delimiter: source.detectedDelimiter })
}

export function textMatches(text: string, findText: string, matchCase: boolean) {
  return matchCase ? text.includes(findText) : text.toLowerCase().includes(findText.toLowerCase())
}

function replaceInText(text: string, findText: string, replacement: string, matchCase: boolean) {
  if (matchCase) return text.split(findText).join(replacement)
  const escapedFindText = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escapedFindText, 'gi'), () => replacement)
}

// Replaces the text in every shown cell that contains it, as one change (one undo step). Rows and columns are the ones on
// display: deleted ones are skipped.
export function withReplacedText(
  edits: CsvEdits,
  rows: string[][],
  rowIds: readonly number[],
  columnIds: readonly number[],
  findText: string,
  replacement: string,
  matchCase: boolean,
) {
  const nextCells = new Map(edits.cells)
  let replacedCellCount = 0
  for (const rowId of rowIds) {
    for (const columnId of columnIds) {
      const currentText = getCellText(rows, edits, rowId, columnId)
      if (!textMatches(currentText, findText, matchCase)) continue
      const newText = replaceInText(currentText, findText, replacement, matchCase)
      if (newText === currentText) continue
      replacedCellCount++
      const key = cellKey(rowId, columnId)
      if (newText === getOriginalCellText(rows, rowId, columnId)) nextCells.delete(key)
      else nextCells.set(key, newText)
    }
  }
  return { edits: replacedCellCount === 0 ? edits : { ...edits, cells: nextCells }, replacedCellCount }
}

// ---------------------------------------------------------------- column and table clean-up
// Each function returns one edits object, so one toolbar action is one undo step.

export type CellTextTransform = 'trim' | 'upper' | 'lower' | 'capitalize'

const cellTextTransforms: Record<CellTextTransform, (text: string) => string> = {
  trim: (text) => text.trim().replace(/\s+/g, ' '),
  upper: (text) => text.toLocaleUpperCase(),
  lower: (text) => text.toLocaleLowerCase(),
  capitalize: (text) => text.toLocaleLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase()),
}

// Applies a text change to every shown cell of the given columns.
export function withTransformedText(
  edits: CsvEdits,
  rows: string[][],
  rowIds: readonly number[],
  columnIds: readonly number[],
  transform: CellTextTransform,
): CsvEdits {
  const nextCells = new Map(edits.cells)
  for (const rowId of rowIds) {
    for (const columnId of columnIds) {
      const currentText = getCellText(rows, edits, rowId, columnId)
      const newText = cellTextTransforms[transform](currentText)
      if (newText === currentText) continue
      const key = cellKey(rowId, columnId)
      if (newText === getOriginalCellText(rows, rowId, columnId)) nextCells.delete(key)
      else nextCells.set(key, newText)
    }
  }
  return nextCells.size === edits.cells.size && [...nextCells].every(([key, text]) => edits.cells.get(key) === text) ? edits : { ...edits, cells: nextCells }
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
function withDeletedRows(edits: CsvEdits, deletedRowIds: readonly number[]): CsvEdits {
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

// Keeps the first of every group of identical rows.
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
