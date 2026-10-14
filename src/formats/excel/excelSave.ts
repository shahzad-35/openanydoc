// Saving: the original workbook is never changed, so the file is built from the sheets as they are now (the rows and columns in
// their shown order, with the edits applied). .xlsx files with their styles loaded are written with ExcelJS, which keeps cell
// styles; every other type (and large .xlsx files) is written with SheetJS, which keeps values, formulas, number formats, merges
// and column widths but no styles.

import type { CellValue } from 'exceljs'
import * as XLSX from 'xlsx'
import { createFormulaCalculator, translateFormulaRefs } from './excelFormulas'
import { getColumnIds, getCoveredKeys, getMerges, getRowIds, getSheetRecords, getSheetView, readCell, readStyle } from './excelModel'
import type { ExcelEdits, FormulaCalculator, ParsedWorkbook, SheetView } from './excelModel'
import { loadExcelJs } from './excelStyles'

export const FILE_MIME_TYPE_BY_BOOK_TYPE: Partial<Record<XLSX.BookType, string>> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  biff8: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
}

const ERROR_CODE_BY_NAME: Record<string, number> = { '#NULL!': 0, '#DIV/0!': 7, '#VALUE!': 15, '#REF!': 23, '#NAME?': 29, '#NUM!': 36, '#N/A': 42 }
const ERROR_NAME_BY_CODE = new Map(Object.entries(ERROR_CODE_BY_NAME).map(([name, code]) => [code, name]))
const PIXELS_PER_CHARACTER = 7

type SheetLayout = {
  rowIds: number[]
  columnIds: number[]
  rowPositionById: Map<number, number>
  columnPositionById: Map<number, number>
}

function layoutOf(sheet: SheetView): SheetLayout {
  const rowIds = getRowIds(sheet)
  const columnIds = getColumnIds(sheet)
  return {
    rowIds,
    columnIds,
    rowPositionById: new Map(rowIds.map((rowId, position) => [rowId, position])),
    columnPositionById: new Map(columnIds.map((columnId, position) => [columnId, position])),
  }
}

// A cell as the file holds it: a formula uses the row and column numbers of the saved sheet, and carries the value calculated
// from the edits so that programs which do not calculate still show the right number.
function getCellToSave(sheet: SheetView, layout: SheetLayout, rowId: number, columnId: number): XLSX.CellObject | undefined {
  const cell = readCell(sheet, rowId, columnId)
  if (!cell || cell.t === 'z') return undefined
  if (!cell.f) return cell
  const { text: formula } = translateFormulaRefs(
    cell.f,
    (rowNumber) => {
      const position = layout.rowPositionById.get(rowNumber - 1)
      return position === undefined ? null : position + 1
    },
    (columnNumber) => {
      const position = layout.columnPositionById.get(columnNumber - 1)
      return position === undefined ? null : position + 1
    },
  )
  const { w: _formattedText, ...cellWithoutText } = cell
  const savedCell: XLSX.CellObject = { ...cellWithoutText, f: formula }
  const result = sheet.calculator?.(sheet.id, rowId, columnId)
  if (!result) return savedCell
  if ('error' in result) {
    if (result.error in ERROR_CODE_BY_NAME) return { ...savedCell, t: 'e', v: ERROR_CODE_BY_NAME[result.error] }
    return savedCell
  }
  if (typeof result.value === 'number') return { ...savedCell, t: 'n', v: result.value }
  if (typeof result.value === 'boolean') return { ...savedCell, t: 'b', v: result.value }
  return { ...savedCell, t: 's', v: result.value ?? '' }
}

// A merge is saved when its rows and columns are still next to each other.
function getMergesToSave(sheet: SheetView, layout: SheetLayout) {
  const isNextToEachOther = (ids: readonly number[], positionById: Map<number, number>) =>
    ids.every((id, index) => positionById.has(id) && positionById.get(id) === (positionById.get(ids[0]) as number) + index)
  return getMerges(sheet).flatMap((merge) =>
    isNextToEachOther(merge.rowIds, layout.rowPositionById) && isNextToEachOther(merge.columnIds, layout.columnPositionById)
      ? [
          {
            s: { r: layout.rowPositionById.get(merge.rowIds[0]) as number, c: layout.columnPositionById.get(merge.columnIds[0]) as number },
            e: { r: layout.rowPositionById.get(merge.rowIds[merge.rowIds.length - 1]) as number, c: layout.columnPositionById.get(merge.columnIds[merge.columnIds.length - 1]) as number },
          },
        ]
      : [],
  )
}

// ---------------------------------------------------------------- SheetJS

function buildWorksheet(sheet: SheetView): XLSX.WorkSheet {
  const layout = layoutOf(sheet)
  const coveredKeys = getCoveredKeys(sheet)
  const worksheet: XLSX.WorkSheet = {}
  layout.rowIds.forEach((rowId, rowPosition) => {
    layout.columnIds.forEach((columnId, columnPosition) => {
      if (coveredKeys.has(`${rowId}:${columnId}`)) return
      const cell = getCellToSave(sheet, layout, rowId, columnId)
      if (cell) worksheet[XLSX.utils.encode_cell({ r: rowPosition, c: columnPosition })] = cell
    })
  })
  if (layout.rowIds.length > 0 && layout.columnIds.length > 0) {
    worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: layout.rowIds.length - 1, c: layout.columnIds.length - 1 } })
  }
  const originalColumns = sheet.original?.worksheet['!cols']
  const originalRows = sheet.original?.worksheet['!rows']
  worksheet['!cols'] = layout.columnIds.map((columnId) => {
    const widthPx = sheet.edits?.columnWidthsPx.get(columnId)
    return widthPx !== undefined ? { wpx: widthPx } : (originalColumns?.[columnId] ?? {})
  })
  if (originalRows) worksheet['!rows'] = layout.rowIds.map((rowId) => originalRows[rowId] ?? {})
  const merges = getMergesToSave(sheet, layout)
  if (merges.length > 0) worksheet['!merges'] = merges
  return worksheet
}

// A sheet nobody touched is reused as it was read, unless something was edited anywhere: formulas may use other sheets.
function writeWithSheetJs(parsed: ParsedWorkbook, edits: ExcelEdits, calculator: FormulaCalculator | null) {
  const workbookToSave = XLSX.utils.book_new()
  workbookToSave.Props = parsed.workbook.Props
  for (const record of getSheetRecords(parsed, edits)) {
    const sheet = getSheetView(parsed, edits, record.id, calculator)
    const worksheet = sheet.edits || !sheet.original || calculator ? buildWorksheet(sheet) : sheet.original.worksheet
    XLSX.utils.book_append_sheet(workbookToSave, worksheet, record.name)
  }
  return new Blob([XLSX.write(workbookToSave, { type: 'array', bookType: parsed.bookType, bookSST: true })])
}

// ---------------------------------------------------------------- ExcelJS (.xlsx with styles)

function toExcelJsValue(cell: XLSX.CellObject): CellValue {
  if (cell.l?.Target && !cell.f) return { text: cell.w ?? (XLSX.utils.format_cell(cell) || cell.l.Target), hyperlink: cell.l.Target }
  if (cell.t === 'e') return { error: (ERROR_NAME_BY_CODE.get(Number(cell.v)) ?? '#VALUE!') as '#VALUE!' }
  if (cell.f) return { formula: cell.f, result: cell.v as string | number | boolean | Date | undefined }
  return cell.v as string | number | boolean | Date
}

async function writeWithExcelJs(parsed: ParsedWorkbook, edits: ExcelEdits, calculator: FormulaCalculator | null) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  for (const record of getSheetRecords(parsed, edits)) {
    const sheet = getSheetView(parsed, edits, record.id, calculator)
    const layout = layoutOf(sheet)
    const coveredKeys = getCoveredKeys(sheet)
    const worksheet = workbook.addWorksheet(record.name)
    layout.rowIds.forEach((rowId, rowIndex) => {
      layout.columnIds.forEach((columnId, columnIndex) => {
        if (coveredKeys.has(`${rowId}:${columnId}`)) return
        const cell = getCellToSave(sheet, layout, rowId, columnId)
        const style = readStyle(sheet, rowId, columnId)
        if (!cell && !style) return
        const target = worksheet.getCell(rowIndex + 1, columnIndex + 1)
        if (cell) {
          target.value = toExcelJsValue(cell)
          if (typeof cell.z === 'string' && cell.z !== 'General') target.numFmt = cell.z
          else if (cell.t === 'd') target.numFmt = 'yyyy-mm-dd'
        }
        if (style?.font) target.font = style.font
        if (style?.fill) target.fill = style.fill
        if (style?.alignment) target.alignment = style.alignment
        if (style?.border) target.border = style.border
      })
    })
    const originalColumns = sheet.original?.worksheet['!cols']
    const originalRows = sheet.original?.worksheet['!rows']
    layout.columnIds.forEach((columnId, columnIndex) => {
      const editedWidthPx = sheet.edits?.columnWidthsPx.get(columnId)
      const originalColumn = originalColumns?.[columnId]
      const width = editedWidthPx !== undefined ? editedWidthPx / PIXELS_PER_CHARACTER : (originalColumn?.wch ?? (originalColumn?.wpx ? originalColumn.wpx / PIXELS_PER_CHARACTER : undefined))
      if (width !== undefined) worksheet.getColumn(columnIndex + 1).width = width
    })
    if (originalRows) {
      layout.rowIds.forEach((rowId, rowIndex) => {
        const heightPoints = originalRows[rowId]?.hpt
        if (heightPoints) worksheet.getRow(rowIndex + 1).height = heightPoints
      })
    }
    for (const merge of getMergesToSave(sheet, layout)) worksheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1)
  }
  return new Blob([await workbook.xlsx.writeBuffer()])
}

export async function writeWorkbookFile(parsed: ParsedWorkbook, edits: ExcelEdits) {
  await parsed.stylesLoading?.catch(() => {})
  const calculator = createFormulaCalculator(parsed, edits)
  return parsed.bookType === 'xlsx' && parsed.styles ? writeWithExcelJs(parsed, edits, calculator) : writeWithSheetJs(parsed, edits, calculator)
}
