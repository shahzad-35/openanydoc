// The CSV edit model and cell helpers, shared by the CSV viewer (loaded for viewing) and the CSV editing module (loaded on
// first Edit).
//
// Rows and columns have stable ids so that adding and deleting never shifts the edits: an original row or column keeps its
// position in the file as its id (0, 1, 2 ...); a row or column added by the visitor gets a negative id (-2, -3 ...). The id
// -1 is only ever used as an anchor meaning "before the first one". Edits are sparse, so a 100k-row file is never copied.

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
  displayColumnIds: number[]
  // Rows matching the current search, in the current sort order.
  visibleRowIds: number[]
}

// Things the toolbar can ask the viewer to do.
export type CsvViewerCommands = {
  toggleFindReplace: () => void
  // Selects a cell and scrolls it into view; a missing id means "the selected one" or the first.
  revealCell: (position: Partial<CellPosition>) => void
}

export function cellKey(rowId: number, columnId: number) {
  return `${rowId}:${columnId}`
}

export function parseCellKey(key: string): CellPosition {
  const separatorIndex = key.indexOf(':')
  return { rowId: Number(key.slice(0, separatorIndex)), columnId: Number(key.slice(separatorIndex + 1)) }
}

// 0 -> A, 25 -> Z, 26 -> AA, like the columns of a spreadsheet.
export function columnLabel(columnPosition: number) {
  let label = ''
  for (let remaining = columnPosition + 1; remaining > 0; remaining = Math.floor((remaining - 1) / 26)) {
    label = String.fromCharCode(65 + ((remaining - 1) % 26)) + label
  }
  return label
}

export function isInsertedLine(id: number) {
  return id <= -2
}

// The row number from the file; rows added here have none.
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

function pluralize(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`
}

// "3 edited cells, 1 row deleted": what the header counter says. Cells in deleted rows or columns are not counted.
export function describeCsvChanges(edits: CsvEdits) {
  const editedCellCount = countShownEditedCells(edits)
  return [
    editedCellCount > 0 && pluralize(editedCellCount, 'edited cell', 'edited cells'),
    edits.insertedRows.length > 0 && pluralize(edits.insertedRows.length, 'row added', 'rows added'),
    edits.deletedRowIds.size > 0 && pluralize(edits.deletedRowIds.size, 'row deleted', 'rows deleted'),
    edits.insertedColumns.length > 0 && pluralize(edits.insertedColumns.length, 'column added', 'columns added'),
    edits.deletedColumnIds.size > 0 && pluralize(edits.deletedColumnIds.size, 'column deleted', 'columns deleted'),
  ]
    .filter(Boolean)
    .join(', ')
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
