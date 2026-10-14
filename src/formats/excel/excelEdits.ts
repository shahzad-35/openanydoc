// The Excel edit state and its counters. Kept apart from excelModel.ts (which imports SheetJS) because the format registry needs
// these for the change counter, and the registry must not pull SheetJS into the pages that never open a workbook.

import type { Style } from 'exceljs'
import type { CellObject } from 'xlsx'

// What the toolbar can change about a cell, and what is read from and saved to .xlsx files. Colours are always { argb }.
export type CellStyle = Partial<Pick<Style, 'font' | 'fill' | 'alignment' | 'border'>>

export type SheetRecord = { id: number; name: string }

// A merged cell: the rows and columns it spans, in order. The first row and column hold its value.
export type Merge = { rowIds: readonly number[]; columnIds: readonly number[] }

export type SheetEdits = {
  // The sheet's merges once the visitor has merged or unmerged cells; null while the file's own merges are untouched.
  merges: readonly Merge[] | null
  mergeChanges: number
  // null clears the cell.
  cells: ReadonlyMap<string, CellObject | null>
  // The rows and columns on display in order; null while the original order is untouched.
  rowIds: readonly number[] | null
  columnIds: readonly number[] | null
  nextRowId: number
  nextColumnId: number
  columnWidthsPx: ReadonlyMap<number, number>
  rowsAdded: number
  rowsDeleted: number
  columnsAdded: number
  columnsDeleted: number
}

export type ExcelEdits = {
  // The sheets in tab order; null while the workbook's own sheets are untouched.
  sheets: readonly SheetRecord[] | null
  bySheetId: ReadonlyMap<number, SheetEdits>
  nextSheetId: number
  sheetChangeCount: number
}

export function createEmptyExcelEdits(): ExcelEdits {
  return { sheets: null, bySheetId: new Map(), nextSheetId: -1, sheetChangeCount: 0 }
}

export const emptySheetEdits: SheetEdits = {
  merges: null,
  mergeChanges: 0,
  cells: new Map(),
  rowIds: null,
  columnIds: null,
  nextRowId: -1,
  nextColumnId: -1,
  columnWidthsPx: new Map(),
  rowsAdded: 0,
  rowsDeleted: 0,
  columnsAdded: 0,
  columnsDeleted: 0,
}

export function countExcelEdits(edits: ExcelEdits) {
  let count = edits.sheetChangeCount
  for (const sheetEdits of edits.bySheetId.values()) {
    count += sheetEdits.cells.size + sheetEdits.mergeChanges + sheetEdits.rowsAdded + sheetEdits.rowsDeleted + sheetEdits.columnsAdded + sheetEdits.columnsDeleted
  }
  return count
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`
}

export function describeExcelChanges(edits: ExcelEdits) {
  let cells = 0
  let rowsAdded = 0
  let rowsDeleted = 0
  let columnsAdded = 0
  let columnsDeleted = 0
  let mergeChanges = 0
  for (const sheetEdits of edits.bySheetId.values()) {
    cells += sheetEdits.cells.size
    rowsAdded += sheetEdits.rowsAdded
    rowsDeleted += sheetEdits.rowsDeleted
    columnsAdded += sheetEdits.columnsAdded
    columnsDeleted += sheetEdits.columnsDeleted
    mergeChanges += sheetEdits.mergeChanges
  }
  return [
    cells > 0 && pluralize(cells, 'edited cell', 'edited cells'),
    rowsAdded > 0 && pluralize(rowsAdded, 'row added', 'rows added'),
    rowsDeleted > 0 && pluralize(rowsDeleted, 'row deleted', 'rows deleted'),
    columnsAdded > 0 && pluralize(columnsAdded, 'column added', 'columns added'),
    columnsDeleted > 0 && pluralize(columnsDeleted, 'column deleted', 'columns deleted'),
    mergeChanges > 0 && pluralize(mergeChanges, 'merge change', 'merge changes'),
    edits.sheetChangeCount > 0 && pluralize(edits.sheetChangeCount, 'sheet change', 'sheet changes'),
  ]
    .filter(Boolean)
    .join(', ')
}

