// The Excel workbook model, shared by the Excel viewer (loaded for viewing) and the Excel editing module (loaded on first
// Edit). Nothing outside src/formats/excel imports this file, so SheetJS and Excel state never reach the CSV or JSON viewers.
//
// The parsed SheetJS workbook is never changed. Like the CSV model, edits are a sparse, immutable layer over it: an original
// row or column keeps its position in the sheet as its id (0, 1, 2 ...), rows and columns added here get negative ids (-1, -2 ...),
// and cells are edited by "rowId:columnId". The workbook is rebuilt once, when it is downloaded.
//
// Formulas are stored (cell.f), never calculated: a formula that came from the file shows the result Excel saved with it, a
// formula typed here shows its formula text and is saved without a result, so the program that opens the file calculates it.

import * as XLSX from 'xlsx'
import type { CSSProperties } from 'react'
import type { CellPosition } from '../DataTable'
import type { ExcelActions } from './excelEditing'
import { emptySheetEdits } from './excelEdits'
import type { CellStyle, ExcelEdits, Merge, SheetEdits, SheetRecord } from './excelEdits'
export type { CellPosition, CellStyle, ExcelEdits, Merge, SheetEdits, SheetRecord }

export type OriginalSheet = {
  name: string
  worksheet: XLSX.WorkSheet
  rowCount: number
  columnCount: number
  merges: Merge[]
  // Cells that are part of a merged range but not its top-left cell; they are shown blank.
  coveredKeys: ReadonlySet<string>
}

export type ParsedWorkbook = {
  workbook: XLSX.WorkBook
  sheets: OriginalSheet[]
  bookType: XLSX.BookType
  // The file's cell styles by sheet position and "rowId:columnId", filled in after the file is shown (see excelStyles.ts); null
  // while loading, for file types or sizes without styles, and when they could not be read.
  styles: Map<number, Map<string, CellStyle>> | null
  // Set while the styles are being read, so a save made in that moment waits for them instead of dropping them.
  stylesLoading?: Promise<unknown>
}

export type CalculatedValue = string | number | boolean | null
// What a formula works out to: a value, an error text such as #DIV/0!, or nothing when it could not be calculated.
export type FormulaResult = { value: CalculatedValue } | { error: string } | undefined
export type FormulaCalculator = (sheetId: number, rowId: number, columnId: number) => FormulaResult

// Everything the functions below need to read one sheet. With a calculator, formula cells show their calculated value.
export type SheetView = {
  id: number
  original: OriginalSheet | null
  edits: SheetEdits | undefined
  calculator?: FormulaCalculator | null
  originalStyles?: ReadonlyMap<string, CellStyle>
}

export type ExcelExportSource = { parsed: ParsedWorkbook }

// What the toolbar menus need to know about the selection.
export type ExcelSelection = {
  activeSheetId: number
  activeSheetName: string
  sheetCount: number
  hasCell: boolean
  hasHeaderRow: boolean
  selectedRowCount: number
  selectedColumnCount: number
  canDeleteSheet: boolean
  // Styles can be changed and saved for .xlsx files whose styles were read; the focus cell's style shows on the buttons.
  canStyle: boolean
  isBold: boolean
  isItalic: boolean
  isUnderlined: boolean
  isStruckThrough: boolean
  alignment: string | undefined
  isMerged: boolean
} | null

// Things the toolbar can ask the viewer to do.
export type ExcelViewerCommands = {
  toggleFindReplace: () => void
  // The viewer's actions as they are now, read when a menu item is chosen.
  getActions: () => ExcelActions
}

export type ParseResult = { status: 'ok'; parsed: ParsedWorkbook } | { status: 'error'; message: string }

const BOOK_TYPE_BY_EXTENSION: Record<string, XLSX.BookType> = { xlsx: 'xlsx', xlsm: 'xlsm', xls: 'biff8', ods: 'ods' }
const MAX_FULL_SCAN_AREA = 1_000_000

export function cellKey(rowId: number, columnId: number) {
  return `${rowId}:${columnId}`
}

export function parseCellKey(key: string): CellPosition {
  const separatorIndex = key.indexOf(':')
  return { rowId: Number(key.slice(0, separatorIndex)), columnId: Number(key.slice(separatorIndex + 1)) }
}

// ---------------------------------------------------------------- reading a file

// How far a sheet really goes. The range a file declares can be a whole formatted column or sheet, which would make
// a million empty rows, so a huge declared range is replaced by the extent of the cells that exist.
function measureSheet(worksheet: XLSX.WorkSheet) {
  const cellAddresses = Object.keys(worksheet).filter((key) => key[0] !== '!')
  if (cellAddresses.length === 0) return { rowCount: 0, columnCount: 0 }
  const declaredRange = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1')
  const declaredArea = (declaredRange.e.r + 1) * (declaredRange.e.c + 1)
  if (worksheet['!ref'] && declaredArea <= MAX_FULL_SCAN_AREA) return { rowCount: declaredRange.e.r + 1, columnCount: declaredRange.e.c + 1 }
  let lastRow = 0
  let lastColumn = 0
  for (const address of cellAddresses) {
    const { r, c } = XLSX.utils.decode_cell(address)
    lastRow = Math.max(lastRow, r)
    lastColumn = Math.max(lastColumn, c)
  }
  return { rowCount: lastRow + 1, columnCount: lastColumn + 1 }
}

const MAX_MERGE_AREA = 100_000

function rangeToMerge(range: XLSX.Range): Merge | null {
  if ((range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1) > MAX_MERGE_AREA) return null
  const rowIds = Array.from({ length: range.e.r - range.s.r + 1 }, (_, offset) => range.s.r + offset)
  const columnIds = Array.from({ length: range.e.c - range.s.c + 1 }, (_, offset) => range.s.c + offset)
  return { rowIds, columnIds }
}

// Every cell a merge covers except its top-left cell.
function findCoveredKeys(merges: readonly Merge[]) {
  const coveredKeys = new Set<string>()
  for (const merge of merges) {
    for (const rowId of merge.rowIds) {
      for (const columnId of merge.columnIds) {
        if (rowId !== merge.rowIds[0] || columnId !== merge.columnIds[0]) coveredKeys.add(cellKey(rowId, columnId))
      }
    }
  }
  return coveredKeys
}

const coveredKeysByMerges = new WeakMap<readonly Merge[], ReadonlySet<string>>()

export function getMerges(sheet: SheetView): readonly Merge[] {
  return sheet.edits?.merges ?? sheet.original?.merges ?? []
}

export function getCoveredKeys(sheet: SheetView) {
  const merges = getMerges(sheet)
  let coveredKeys = coveredKeysByMerges.get(merges)
  if (!coveredKeys) {
    coveredKeys = findCoveredKeys(merges)
    coveredKeysByMerges.set(merges, coveredKeys)
  }
  return coveredKeys
}

// SheetJS prints warnings (an ODS number format it cannot read) to the console; they are not errors of this app.
function readWithoutConsoleNoise(contents: ArrayBuffer) {
  const originalConsoleError = console.error
  console.error = () => {}
  try {
    return XLSX.read(contents, { type: 'array', cellDates: true, cellNF: true, cellStyles: false, bookVBA: false })
  } finally {
    console.error = originalConsoleError
  }
}

export function parseWorkbook(contents: ArrayBuffer, fileName: string): ParseResult {
  try {
    const workbook = readWithoutConsoleNoise(contents)
    const sheets = workbook.SheetNames.map((name): OriginalSheet => {
      const worksheet = workbook.Sheets[name]
      const merges = (worksheet['!merges'] ?? []).flatMap((range) => rangeToMerge(range) ?? [])
      return { name, worksheet, ...measureSheet(worksheet), merges, coveredKeys: findCoveredKeys(merges) }
    })
    const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    return { status: 'ok', parsed: { workbook, sheets, bookType: BOOK_TYPE_BY_EXTENSION[extension] ?? 'xlsx', styles: null } }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error'
    return { status: 'error', message: `This workbook could not be read (${reason}). It may be damaged or password protected.` }
  }
}

// ---------------------------------------------------------------- edits and sheets

export function getSheetRecords(parsed: ParsedWorkbook, edits: ExcelEdits): readonly SheetRecord[] {
  return edits.sheets ?? parsed.sheets.map((sheet, index) => ({ id: index, name: sheet.name }))
}

export function getSheetView(parsed: ParsedWorkbook, edits: ExcelEdits, sheetId: number, calculator?: FormulaCalculator | null): SheetView {
  return { id: sheetId, original: sheetId >= 0 ? (parsed.sheets[sheetId] ?? null) : null, edits: edits.bySheetId.get(sheetId), calculator, originalStyles: parsed.styles?.get(sheetId) }
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index)
}

export function getRowIds(sheet: SheetView) {
  return sheet.edits?.rowIds?.slice() ?? range(sheet.original?.rowCount ?? 0)
}

export function getColumnIds(sheet: SheetView) {
  return sheet.edits?.columnIds?.slice() ?? range(sheet.original?.columnCount ?? 0)
}

function withSheetEdits(edits: ExcelEdits, sheetId: number, change: (sheetEdits: SheetEdits) => SheetEdits): ExcelEdits {
  const currentSheetEdits = edits.bySheetId.get(sheetId) ?? emptySheetEdits
  const changedSheetEdits = change(currentSheetEdits)
  if (changedSheetEdits === currentSheetEdits) return edits
  return { ...edits, bySheetId: new Map(edits.bySheetId).set(sheetId, changedSheetEdits) }
}

// ---------------------------------------------------------------- reading cells

export function readOriginalCell(sheet: SheetView, rowId: number, columnId: number): XLSX.CellObject | undefined {
  if (!sheet.original || rowId < 0 || columnId < 0) return undefined
  return sheet.original.worksheet[XLSX.utils.encode_cell({ r: rowId, c: columnId })]
}

export function readCell(sheet: SheetView, rowId: number, columnId: number): XLSX.CellObject | undefined {
  const key = cellKey(rowId, columnId)
  if (sheet.edits?.cells.has(key)) return sheet.edits.cells.get(key) ?? undefined
  return readOriginalCell(sheet, rowId, columnId)
}

export function formatCellText(cell: XLSX.CellObject | undefined) {
  if (!cell || cell.t === 'z') return ''
  if (cell.v === undefined || cell.v === null) return cell.f ? `=${cell.f}` : ''
  if (cell.w !== undefined) return cell.w
  try {
    return XLSX.utils.format_cell(cell)
  } catch {
    return String(cell.v)
  }
}

// The text a calculated formula cell shows, formatted with the cell's own number format.
function formatFormulaResult(result: NonNullable<FormulaResult>, cell: XLSX.CellObject) {
  if ('error' in result) return result.error
  const { value } = result
  if (value === null) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'string') return value
  try {
    return XLSX.SSF.format(typeof cell.z === 'string' ? cell.z : 'General', value)
  } catch {
    return String(value)
  }
}

export function getCellText(sheet: SheetView, rowId: number, columnId: number) {
  const key = cellKey(rowId, columnId)
  const isEdited = sheet.edits?.cells.has(key) ?? false
  if (!isEdited && getCoveredKeys(sheet).has(key)) return ''
  const cell = isEdited ? (sheet.edits?.cells.get(key) ?? undefined) : readOriginalCell(sheet, rowId, columnId)
  const result = cell?.f ? sheet.calculator?.(sheet.id, rowId, columnId) : undefined
  return cell && result ? formatFormulaResult(result, cell) : formatCellText(cell)
}

export function getOriginalCellText(sheet: SheetView, rowId: number, columnId: number) {
  if (sheet.original?.coveredKeys.has(cellKey(rowId, columnId))) return ''
  return formatCellText(readOriginalCell(sheet, rowId, columnId))
}

// What the value bar shows while editing: a formula as typed, other cells as displayed.
export function getCellEditText(sheet: SheetView, rowId: number, columnId: number) {
  const cell = readCell(sheet, rowId, columnId)
  return cell?.f ? `=${cell.f}` : getCellText(sheet, rowId, columnId)
}

function isSameCell(firstCell: XLSX.CellObject | undefined, secondCell: XLSX.CellObject | undefined) {
  if (JSON.stringify(firstCell?.s) !== JSON.stringify(secondCell?.s) || JSON.stringify(firstCell?.l) !== JSON.stringify(secondCell?.l)) return false
  const firstIsBlank = !firstCell || firstCell.t === 'z'
  const secondIsBlank = !secondCell || secondCell.t === 'z'
  if (firstIsBlank || secondIsBlank) return firstIsBlank && secondIsBlank
  return firstCell.t === secondCell.t && firstCell.v === secondCell.v && firstCell.f === secondCell.f && firstCell.z === secondCell.z
}

export function readStyle(sheet: SheetView, rowId: number, columnId: number): CellStyle | undefined {
  const key = cellKey(rowId, columnId)
  if (sheet.edits?.cells.has(key)) return sheet.edits.cells.get(key)?.s as CellStyle | undefined
  return sheet.originalStyles?.get(key)
}

// The cell as the file has it, with its style.
function readOriginalCellWithStyle(sheet: SheetView, rowId: number, columnId: number): XLSX.CellObject | undefined {
  const cell = readOriginalCell(sheet, rowId, columnId)
  const style = sheet.originalStyles?.get(cellKey(rowId, columnId))
  return style ? { ...(cell ?? { t: 'z' }), s: style } : cell
}

const argbToCss = (color: { argb?: string } | undefined) => (color?.argb ? `#${color.argb.slice(-6)}` : undefined)

// The CSS for a cell's style, or undefined when it has nothing to show.
export function cssForStyle(style: CellStyle | undefined): CSSProperties | undefined {
  if (!style) return undefined
  const css: CSSProperties = {}
  const { font, fill, alignment } = style
  const fillColor = fill?.type === 'pattern' && fill.pattern === 'solid' ? argbToCss(fill.fgColor) : undefined
  if (fillColor) css.backgroundColor = fillColor
  const textColor = argbToCss(font?.color)
  // Excel's automatic text colour is black, which stays readable on any fill; in dark mode the page's own colour is light.
  if (textColor) css.color = textColor
  else if (fillColor) css.color = '#000000'
  if (font?.bold) css.fontWeight = 700
  if (font?.italic) css.fontStyle = 'italic'
  if (font?.underline || font?.strike) css.textDecoration = [font.underline ? 'underline' : '', font.strike ? 'line-through' : ''].join(' ').trim()
  if (font?.size) css.fontSize = `${Math.round((font.size / 11) * 14)}px`
  if (alignment?.horizontal === 'left' || alignment?.horizontal === 'center' || alignment?.horizontal === 'right') css.textAlign = alignment.horizontal
  if (alignment?.indent) css.textIndent = `${alignment.indent * 10}px`
  if (font?.name) css.fontFamily = `"${font.name}", system-ui, sans-serif`
  const { border } = style
  for (const [side, cssProperty] of [['top', 'borderTop'], ['bottom', 'borderBottom'], ['left', 'borderLeft'], ['right', 'borderRight']] as const) {
    const edge = border?.[side]
    if (edge?.style) css[cssProperty] = `1px solid ${argbToCss(edge.color) ?? '#000000'}`
  }
  return Object.keys(css).length > 0 ? css : undefined
}

// ---------------------------------------------------------------- typing into a cell

const SERIAL_BASE_MS = Date.UTC(1899, 11, 30)
const DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/
const NUMBER_TEXT = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i
const GROUPED_NUMBER_TEXT = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/

// A date typed as 2026-03-15 (or with a time) becomes a date serial number with a date format, as Excel stores dates.
function parseDateText(text: string) {
  const match = DATE_TEXT.exec(text.trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const milliseconds = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0))
  if (Number.isNaN(milliseconds) || new Date(milliseconds).getUTCMonth() !== Number(month) - 1) return null
  return { serial: (milliseconds - SERIAL_BASE_MS) / 86_400_000, hasTime: hour !== undefined }
}

function parseNumberText(text: string) {
  const trimmedText = text.trim()
  const isPercent = trimmedText.endsWith('%')
  const numberText = (isPercent ? trimmedText.slice(0, -1) : trimmedText).trim()
  if (!NUMBER_TEXT.test(numberText) && !GROUPED_NUMBER_TEXT.test(numberText)) return null
  const value = Number(numberText.replaceAll(',', ''))
  const decimalCount = numberText.split('.')[1]?.replace(/e.*$/i, '').length ?? 0
  return Number.isFinite(value) ? { value, isPercent, decimalCount } : null
}

export type CellInputResult = { cell: XLSX.CellObject | null } | { error: string }

// Turns what was typed into a cell of the right type, keeping the number format the cell already had. A cell formatted as a
// number or a date refuses text, with a message that says what to type instead.
export function parseCellInput(text: string, currentCell: XLSX.CellObject | undefined): CellInputResult {
  if (text.trim() === '') return { cell: null }
  const currentFormat = typeof currentCell?.z === 'string' ? currentCell.z : undefined
  const withFormat = (cell: XLSX.CellObject, format: string | undefined): XLSX.CellObject => (format && format !== 'General' ? { ...cell, z: format } : cell)

  if (text.startsWith('=') && text.length > 1) return { cell: withFormat({ t: 'n', f: text.slice(1) }, currentFormat) }
  if (text.startsWith("'")) return { cell: { t: 's', v: text.slice(1) } }
  if (currentFormat === '@') return { cell: { t: 's', v: text, z: '@' } }

  const upperCaseText = text.trim().toUpperCase()
  if (upperCaseText === 'TRUE' || upperCaseText === 'FALSE') return { cell: { t: 'b', v: upperCaseText === 'TRUE' } }

  const number = parseNumberText(text)
  const date = parseDateText(text)
  const isDateFormat = currentFormat !== undefined && XLSX.SSF.is_date(currentFormat)
  const isNumberFormat = currentFormat !== undefined && currentFormat !== 'General' && !isDateFormat

  if (isDateFormat) {
    if (date) return { cell: { t: 'n', v: date.serial, z: date.hasTime && !currentFormat.includes('h') ? 'yyyy-mm-dd hh:mm:ss' : currentFormat } }
    if (number && !number.isPercent) return { cell: { t: 'n', v: number.value, z: currentFormat } }
    return { error: 'This cell is formatted as a date. Type a date such as 2026-03-15, or a number.' }
  }
  if (isNumberFormat) {
    if (!number) return { error: 'This cell is formatted as a number. Type a number such as 1250.50, or clear its format first.' }
    const isPercentFormat = currentFormat.includes('%')
    const value = number.isPercent || isPercentFormat ? number.value / 100 : number.value
    return { cell: { t: 'n', v: value, z: currentFormat } }
  }
  if (number) return { cell: number.isPercent ? { t: 'n', v: number.value / 100, z: `0${number.decimalCount > 0 ? `.${'0'.repeat(number.decimalCount)}` : ''}%` } : { t: 'n', v: number.value } }
  if (date) return { cell: { t: 'n', v: date.serial, z: date.hasTime ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd' } }
  return { cell: { t: 's', v: text } }
}

// ---------------------------------------------------------------- changing cells

// Sets many cells as one change (one undo step). A cell set back to what the file has is no longer an edit.
export function withCells(edits: ExcelEdits, parsed: ParsedWorkbook, sheetId: number, newCells: Iterable<[CellPosition, XLSX.CellObject | null]>): ExcelEdits {
  return withSheetEdits(edits, sheetId, (sheetEdits) => {
    const sheet: SheetView = { id: sheetId, original: sheetId >= 0 ? (parsed.sheets[sheetId] ?? null) : null, edits: sheetEdits, originalStyles: parsed.styles?.get(sheetId) }
    let nextCells: Map<string, XLSX.CellObject | null> | null = null
    for (const [{ rowId, columnId }, newCellWithoutStyle] of newCells) {
      const key = cellKey(rowId, columnId)
      const currentCells = nextCells ?? sheetEdits.cells
      const currentStyle = currentCells.has(key) ? (currentCells.get(key)?.s as CellStyle | undefined) : sheet.originalStyles?.get(key)
      const currentCell = currentCells.has(key) ? currentCells.get(key) : readOriginalCellWithStyle(sheet, rowId, columnId)
      // A new value keeps the cell's style, and clearing a cell clears its value only, as in Excel.
      const newCell = newCellWithoutStyle === null ? (currentStyle ? ({ t: 'z', s: currentStyle } as XLSX.CellObject) : null) : newCellWithoutStyle.s === undefined && currentStyle ? { ...newCellWithoutStyle, s: currentStyle } : newCellWithoutStyle
      if (isSameCell(currentCell ?? undefined, newCell ?? undefined)) continue
      nextCells ??= new Map(sheetEdits.cells)
      if (isSameCell(readOriginalCellWithStyle(sheet, rowId, columnId), newCell ?? undefined)) nextCells.delete(key)
      else nextCells.set(key, newCell)
    }
    return nextCells ? { ...sheetEdits, cells: nextCells } : sheetEdits
  })
}

// Changes the style of the given cells as one change. `change` gets a cell's current style and returns the new one.
export function withCellStyle(edits: ExcelEdits, parsed: ParsedWorkbook, sheet: SheetView, positions: CellPosition[], change: (style: CellStyle, position: CellPosition) => CellStyle, resetNumberFormat = false): ExcelEdits {
  const styledCells = positions.map((position): [CellPosition, XLSX.CellObject] => {
    const { w: _formattedText, ...cell } = readCell(sheet, position.rowId, position.columnId) ?? ({ t: 'z' } as XLSX.CellObject)
    const styledCell = { ...cell, s: change(readStyle(sheet, position.rowId, position.columnId) ?? {}, position) } as XLSX.CellObject
    return [position, resetNumberFormat ? { ...styledCell, z: undefined } : styledCell]
  })
  return withCells(edits, parsed, sheet.id, styledCells)
}

// One more or one fewer decimal place in a number format ("0.00" -> "0.0", "General" -> "0.0", "\"Rs \"#,##0" -> "\"Rs \"#,##0.0").
// Text, dates and a format that is already at 0 decimals going down are returned as they are.
export function changeDecimalPlaces(format: string, delta: 1 | -1) {
  if (format === '@' || (format !== 'General' && XLSX.SSF.is_date(format))) return format
  const baseFormat = format === 'General' ? '0' : format
  // Quoted text such as "Rs " is blanked out so its letters are never taken for digits.
  const masked = baseFormat.replace(/"[^"]*"/g, (quoted) => ' '.repeat(quoted.length))
  const match = /[0#?]+(?:\.(0+))?/.exec(masked)
  if (!match) return format
  const decimalCount = match[1]?.length ?? 0
  const newCount = Math.max(0, decimalCount + delta)
  if (newCount === decimalCount) return format
  const integerPart = match[0].split('.')[0]
  const replacement = integerPart + (newCount > 0 ? `.${'0'.repeat(newCount)}` : '')
  return baseFormat.slice(0, match.index) + replacement + baseFormat.slice(match.index + match[0].length)
}

// Sets a number format on the cells that have a value; `format` can be a function of the cell's current format.
export function withNumberFormat(edits: ExcelEdits, parsed: ParsedWorkbook, sheet: SheetView, positions: CellPosition[], format: string | ((currentFormat: string, cell: XLSX.CellObject) => string)): ExcelEdits {
  const changedCells: [CellPosition, XLSX.CellObject][] = []
  for (const position of positions) {
    const cell = readCell(sheet, position.rowId, position.columnId)
    if (!cell || cell.t === 'z') continue
    const { w: _formattedText, ...cellWithoutText } = cell
    const newFormat = typeof format === 'function' ? format(typeof cell.z === 'string' ? cell.z : 'General', cell) : format
    changedCells.push([position, newFormat === 'General' ? { ...cellWithoutText, z: undefined } : { ...cellWithoutText, z: newFormat }])
  }
  return withCells(edits, parsed, sheet.id, changedCells)
}

// Changes the text of the text cells among the given ones (formulas are left alone) as one change.
export function withTransformedText(edits: ExcelEdits, parsed: ParsedWorkbook, sheet: SheetView, positions: CellPosition[], transform: (text: string) => string): ExcelEdits {
  const changedCells: [CellPosition, XLSX.CellObject][] = []
  for (const position of positions) {
    const cell = readCell(sheet, position.rowId, position.columnId)
    if (cell?.t !== 's' || cell.f || typeof cell.v !== 'string') continue
    const { w: _formattedText, r: _richText, h: _html, ...plainCell } = cell
    changedCells.push([position, { ...plainCell, v: transform(cell.v) }])
  }
  return withCells(edits, parsed, sheet.id, changedCells)
}

// Gives the cell a link (or removes it when `address` is empty). The cell's value and style stay.
export function withLink(edits: ExcelEdits, parsed: ParsedWorkbook, sheet: SheetView, position: CellPosition, address: string): ExcelEdits {
  const cell = readCell(sheet, position.rowId, position.columnId) ?? ({ t: 'z' } as XLSX.CellObject)
  const { l: _oldLink, ...cellWithoutLink } = cell
  return withCells(edits, parsed, sheet.id, [[position, address === '' ? cellWithoutLink : { ...cellWithoutLink, l: { Target: address, Tooltip: address } }]])
}

// ---------------------------------------------------------------- rows and columns

type LineKind = 'row' | 'column'

function keepCellsWhere(cells: ReadonlyMap<string, XLSX.CellObject | null>, isKept: (position: CellPosition) => boolean) {
  const keptCells = new Map<string, XLSX.CellObject | null>()
  for (const [key, cell] of cells) {
    if (isKept(parseCellKey(key))) keptCells.set(key, cell)
  }
  return keptCells
}

// Adds `count` blank rows or columns so that the first one lands at `position` in the shown order.
export function withInsertedLines(edits: ExcelEdits, sheet: SheetView, kind: LineKind, position: number, count: number): ExcelEdits {
  return withSheetEdits(edits, sheet.id, (sheetEdits) => {
    const isRow = kind === 'row'
    const shownIds = isRow ? getRowIds(sheet) : getColumnIds(sheet)
    const firstNewId = isRow ? sheetEdits.nextRowId : sheetEdits.nextColumnId
    const newIds = Array.from({ length: count }, (_, index) => firstNewId - index)
    const clampedPosition = Math.max(0, Math.min(position, shownIds.length))
    const nextIds = [...shownIds.slice(0, clampedPosition), ...newIds, ...shownIds.slice(clampedPosition)]
    return isRow
      ? { ...sheetEdits, rowIds: nextIds, nextRowId: firstNewId - count, rowsAdded: sheetEdits.rowsAdded + count }
      : { ...sheetEdits, columnIds: nextIds, nextColumnId: firstNewId - count, columnsAdded: sheetEdits.columnsAdded + count }
  })
}

// Removes rows or columns, with the edits typed into them. Lines added here and then deleted leave no trace.
export function withDeletedLines(edits: ExcelEdits, sheet: SheetView, kind: LineKind, deletedIds: ReadonlySet<number>): ExcelEdits {
  return withSheetEdits(edits, sheet.id, (sheetEdits) => {
    const isRow = kind === 'row'
    const shownIds = isRow ? getRowIds(sheet) : getColumnIds(sheet)
    const nextIds = shownIds.filter((id) => !deletedIds.has(id))
    if (nextIds.length === shownIds.length) return sheetEdits
    const deletedCount = shownIds.length - nextIds.length
    const cells = keepCellsWhere(sheetEdits.cells, (position) => !deletedIds.has(isRow ? position.rowId : position.columnId))
    const addedDeletedCount = [...deletedIds].filter((id) => id < 0).length
    return isRow
      ? { ...sheetEdits, cells, rowIds: nextIds, rowsDeleted: sheetEdits.rowsDeleted + deletedCount - addedDeletedCount, rowsAdded: sheetEdits.rowsAdded - addedDeletedCount }
      : { ...sheetEdits, cells, columnIds: nextIds, columnsDeleted: sheetEdits.columnsDeleted + deletedCount - addedDeletedCount, columnsAdded: sheetEdits.columnsAdded - addedDeletedCount }
  })
}

// Merges the selected rows and columns into one cell, replacing any merge they overlap. Unmerging removes the merge that holds
// the cell. The cells a merge covers keep their values but are not shown.
export function withMergedCells(edits: ExcelEdits, sheet: SheetView, rowIds: readonly number[], columnIds: readonly number[]): ExcelEdits {
  return withSheetEdits(edits, sheet.id, (sheetEdits) => {
    const overlaps = (merge: Merge) => merge.rowIds.some((id) => rowIds.includes(id)) && merge.columnIds.some((id) => columnIds.includes(id))
    const otherMerges = getMerges(sheet).filter((merge) => !overlaps(merge))
    return { ...sheetEdits, merges: [...otherMerges, { rowIds, columnIds }], mergeChanges: sheetEdits.mergeChanges + 1 }
  })
}

export function withUnmergedCell(edits: ExcelEdits, sheet: SheetView, position: CellPosition): ExcelEdits {
  return withSheetEdits(edits, sheet.id, (sheetEdits) => {
    const keptMerges = getMerges(sheet).filter((merge) => !(merge.rowIds.includes(position.rowId) && merge.columnIds.includes(position.columnId)))
    return keptMerges.length === getMerges(sheet).length ? sheetEdits : { ...sheetEdits, merges: keptMerges, mergeChanges: sheetEdits.mergeChanges + 1 }
  })
}

export function findMergeAt(sheet: SheetView, position: CellPosition) {
  return getMerges(sheet).find((merge) => merge.rowIds.includes(position.rowId) && merge.columnIds.includes(position.columnId))
}

export function withColumnWidth(edits: ExcelEdits, sheetId: number, columnId: number, widthPx: number): ExcelEdits {
  return withSheetEdits(edits, sheetId, (sheetEdits) =>
    sheetEdits.columnWidthsPx.get(columnId) === widthPx ? sheetEdits : { ...sheetEdits, columnWidthsPx: new Map(sheetEdits.columnWidthsPx).set(columnId, widthPx) },
  )
}

// ---------------------------------------------------------------- sheets

const FORBIDDEN_SHEET_NAME_CHARACTERS = /[\\/?*[\]:]/

// Excel's rules for a sheet name; returns the problem, or null when the name is fine.
export function validateSheetName(name: string, otherNames: readonly string[]) {
  if (name.trim() === '') return 'Type a name for the sheet.'
  if (name.length > 31) return 'A sheet name can have at most 31 characters.'
  if (FORBIDDEN_SHEET_NAME_CHARACTERS.test(name)) return 'A sheet name cannot contain any of these characters: \\ / ? * [ ] :'
  if (name.startsWith("'") || name.endsWith("'")) return "A sheet name cannot start or end with an apostrophe (')."
  if (name.toLowerCase() === 'history') return '"History" is reserved by Excel. Choose another name.'
  if (otherNames.some((otherName) => otherName.toLowerCase() === name.toLowerCase())) return 'Another sheet already has this name (sheet names are not case sensitive).'
  return null
}

export function suggestNewSheetName(sheetRecords: readonly SheetRecord[]) {
  const usedNames = new Set(sheetRecords.map((sheet) => sheet.name.toLowerCase()))
  let number = sheetRecords.length + 1
  while (usedNames.has(`sheet${number}`)) number++
  return `Sheet${number}`
}

export function withAddedSheet(edits: ExcelEdits, currentSheets: readonly SheetRecord[], name: string): { edits: ExcelEdits; newSheetId: number } {
  const newSheetId = edits.nextSheetId
  return {
    edits: { ...edits, sheets: [...currentSheets, { id: newSheetId, name }], nextSheetId: newSheetId - 1, sheetChangeCount: edits.sheetChangeCount + 1 },
    newSheetId,
  }
}

export function withRenamedSheet(edits: ExcelEdits, currentSheets: readonly SheetRecord[], sheetId: number, name: string): ExcelEdits {
  return {
    ...edits,
    sheets: currentSheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, name } : sheet)),
    sheetChangeCount: edits.sheetChangeCount + 1,
  }
}

// Moves a sheet one place left or right in the tab order.
export function withMovedSheet(edits: ExcelEdits, currentSheets: readonly SheetRecord[], sheetId: number, delta: -1 | 1): ExcelEdits {
  const position = currentSheets.findIndex((sheet) => sheet.id === sheetId)
  const newPosition = position + delta
  if (position === -1 || newPosition < 0 || newPosition >= currentSheets.length) return edits
  const reorderedSheets = currentSheets.slice()
  reorderedSheets.splice(newPosition, 0, reorderedSheets.splice(position, 1)[0])
  return { ...edits, sheets: reorderedSheets, sheetChangeCount: edits.sheetChangeCount + 1 }
}

export function withDeletedSheet(edits: ExcelEdits, currentSheets: readonly SheetRecord[], sheetId: number): ExcelEdits {
  const bySheetId = new Map(edits.bySheetId)
  bySheetId.delete(sheetId)
  return { ...edits, sheets: currentSheets.filter((sheet) => sheet.id !== sheetId), bySheetId, sheetChangeCount: edits.sheetChangeCount + 1 }
}

// ---------------------------------------------------------------- find and replace

export function textMatches(text: string, findText: string, matchCase: boolean) {
  return matchCase ? text.includes(findText) : text.toLowerCase().includes(findText.toLowerCase())
}

function replaceInText(text: string, findText: string, replacement: string, matchCase: boolean) {
  if (matchCase) return text.split(findText).join(replacement)
  const escapedFindText = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escapedFindText, 'gi'), () => replacement)
}

// The cells on display whose text contains `findText`, row by row.
export function findMatchingCells(sheet: SheetView, findText: string, matchCase: boolean) {
  const matches: CellPosition[] = []
  if (findText === '') return matches
  const columnIds = getColumnIds(sheet)
  for (const rowId of getRowIds(sheet)) {
    for (const columnId of columnIds) {
      if (textMatches(getCellText(sheet, rowId, columnId), findText, matchCase)) matches.push({ rowId, columnId })
    }
  }
  return matches
}

// Replaces the text in the given cells as one change. Formulas are left alone (their text is a result, not what they hold), and a
// replacement a number-formatted cell refuses is skipped; both are counted so the visitor is told.
export function withReplacedText(
  edits: ExcelEdits,
  parsed: ParsedWorkbook,
  sheet: SheetView,
  positions: CellPosition[],
  findText: string,
  replacement: string,
  matchCase: boolean,
) {
  const replacedCells: [CellPosition, XLSX.CellObject | null][] = []
  let skippedCount = 0
  for (const position of positions) {
    const cell = readCell(sheet, position.rowId, position.columnId)
    if (cell?.f) {
      skippedCount++
      continue
    }
    const result = parseCellInput(replaceInText(getCellText(sheet, position.rowId, position.columnId), findText, replacement, matchCase), cell)
    if ('error' in result) skippedCount++
    else replacedCells.push([position, result.cell])
  }
  return { edits: withCells(edits, parsed, sheet.id, replacedCells), replacedCount: replacedCells.length, skippedCount }
}
