// Formula calculation for edited workbooks. SheetJS only stores formulas; this works out their values with fast-formula-parser
// (MIT, the common Excel functions) so edits show up in the cells that depend on them. A formula it cannot work out (a function
// it does not have) keeps the result the file was saved with, and the cells that use it read that saved result.
//
// Formulas refer to cells by their original row and column numbers, which never move when rows or columns are added or deleted
// here; `translateFormulaRefs` converts to and from the numbers the visitor sees and the numbers the saved file needs.

import FormulaParser, { FormulaError } from 'fast-formula-parser'
import { getSheetRecords, getSheetView, readCell } from './excelModel'
import type { CalculatedValue, ExcelEdits, FormulaCalculator, FormulaResult, ParsedWorkbook, SheetView } from './excelModel'


const SERIAL_BASE_MS = Date.UTC(1899, 11, 30)
const MAX_RANGE_CELLS = 1_000_000

function toSerialNumber(value: Date) {
  return (value.getTime() - SERIAL_BASE_MS) / 86_400_000
}

// Returns null while nothing is edited: the values saved in the file are then right.
export function createFormulaCalculator(parsed: ParsedWorkbook, edits: ExcelEdits): FormulaCalculator | null {
  if (edits.bySheetId.size === 0) return null
  const sheetRecords = getSheetRecords(parsed, edits)
  const sheetIdByLowerCaseName = new Map(sheetRecords.map((record) => [record.name.toLowerCase(), record.id]))
  const sheetNameById = new Map(sheetRecords.map((record) => [record.id, record.name]))
  const sheetViews = new Map<number, SheetView>()
  const results = new Map<string, FormulaResult>()
  const beingCalculated = new Set<string>()

  function viewOf(sheetId: number) {
    let view = sheetViews.get(sheetId)
    if (!view) {
      view = getSheetView(parsed, edits, sheetId)
      sheetViews.set(sheetId, view)
    }
    return view
  }

  // The value another formula sees in a cell: the calculated result, the saved result when it cannot be calculated, or the cell.
  function readValue(sheetId: number, rowId: number, columnId: number): unknown {
    const cell = readCell(viewOf(sheetId), rowId, columnId)
    if (!cell || cell.t === 'z') return null
    if (cell.f) {
      const result = calculate(sheetId, rowId, columnId)
      if (result && 'error' in result) return new FormulaError(result.error)
      if (result) return result.value
    }
    if (cell.t === 'e') return new FormulaError(String(cell.w ?? '#VALUE!'))
    return cell.v instanceof Date ? toSerialNumber(cell.v) : (cell.v ?? null)
  }

  function sheetIdOf(reference: { sheet: string }) {
    return sheetIdByLowerCaseName.get(reference.sheet.toLowerCase())
  }

  const parser = new FormulaParser({
    onCell: (reference) => {
      const sheetId = sheetIdOf(reference)
      return sheetId === undefined ? new FormulaError('#REF!') : readValue(sheetId, reference.row - 1, reference.col - 1)
    },
    onRange: (reference) => {
      const sheetId = sheetIdOf(reference)
      if (sheetId === undefined) return [[new FormulaError('#REF!')]]
      const lastRow = Math.min(reference.to.row, reference.from.row + MAX_RANGE_CELLS)
      const rows: unknown[][] = []
      for (let row = reference.from.row; row <= lastRow; row++) {
        const rowValues: unknown[] = []
        for (let column = reference.from.col; column <= reference.to.col; column++) rowValues.push(readValue(sheetId, row - 1, column - 1))
        rows.push(rowValues)
      }
      return rows
    },
  })

  function calculate(sheetId: number, rowId: number, columnId: number): FormulaResult {
    const key = `${sheetId}:${rowId}:${columnId}`
    if (results.has(key)) return results.get(key)
    const formula = readCell(viewOf(sheetId), rowId, columnId)?.f
    if (!formula) return undefined
    if (beingCalculated.has(key)) return { error: '#REF!' }
    beingCalculated.add(key)
    let result: FormulaResult
    try {
      const calculated = parser.parse(formula, { sheet: sheetNameById.get(sheetId) as string, row: rowId + 1, col: columnId + 1 })
      const value = Array.isArray(calculated) ? (calculated[0] as unknown[] | undefined)?.[0] : calculated
      if (value instanceof FormulaError) result = value.error === '#NAME?' ? undefined : { error: value.error }
      else if (value === undefined || value === null) result = { value: 0 }
      else result = { value: value as CalculatedValue }
    } catch (error) {
      // An unknown function (or a formula the parser cannot read): the saved result stays.
      result = error instanceof FormulaError && error.error !== '#NAME?' && error.error !== '#ERROR!' ? { error: error.error } : undefined
    }
    beingCalculated.delete(key)
    results.set(key, result)
    return result
  }

  return calculate
}

// ---------------------------------------------------------------- cell references inside formula text

const CELL_REFERENCE = /(?<![A-Za-z0-9_.!'"])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\dA-Za-z_(!])/g

function columnNumberOf(letters: string) {
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
}

function lettersOf(columnNumber: number) {
  let letters = ''
  for (let remaining = columnNumber; remaining > 0; remaining = Math.floor((remaining - 1) / 26)) letters = String.fromCharCode(65 + ((remaining - 1) % 26)) + letters
  return letters
}

// Rewrites the cell references of a formula (the ones on its own sheet) with row and column mappers that take and return
// 1-based numbers, or null for a row or column that is gone: that reference becomes #REF!. Text in quotes is left alone.
export function translateFormulaRefs(formula: string, mapRow: (rowNumber: number) => number | null, mapColumn: (columnNumber: number) => number | null) {
  let hasMissingReference = false
  const translatePart = (part: string) =>
    part.replace(CELL_REFERENCE, (_match, columnLock: string, letters: string, rowLock: string, digits: string) => {
      const newRow = mapRow(Number(digits))
      const newColumn = mapColumn(columnNumberOf(letters))
      if (newRow === null || newColumn === null) {
        hasMissingReference = true
        return '#REF!'
      }
      return `${columnLock}${lettersOf(newColumn)}${rowLock}${newRow}`
    })
  // Odd-numbered pieces of a split on quotes are the text inside quotes.
  const text = formula
    .split('"')
    .map((piece, index) => (index % 2 === 0 ? translatePart(piece) : piece))
    .join('"')
  return { text, hasMissingReference }
}
