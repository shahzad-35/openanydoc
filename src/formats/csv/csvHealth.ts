// A table's health check: cells that break a column's type, cells with spaces at either end, and repeated rows, each with the rows
// it is about. Pure functions over cell text (no React, no language), so the CSV page's Issues panel and a future CSV checker page
// can both use them. Rows a file wrote with too few fields are found by the page itself (it needs the file as read).
import { parseNumber } from './csvAnalysis'

const MAX_LISTED_ROWS = 50
// A column is "mostly numbers" (or dates) when at least this share of its filled cells are; the rest are the odd ones out.
const MOSTLY_SHARE = 0.8
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/

export type HealthIssue =
  | { kind: 'mixedTypes'; columnId: number; expected: 'number' | 'date'; oddRowIds: number[]; oddCount: number }
  | { kind: 'outerSpaces'; columnId: number; rowIds: number[]; count: number }
  | { kind: 'duplicateRows'; repeats: { rowId: number; firstRowId: number }[]; count: number }

type HealthCheckInput = {
  readText: (rowId: number, columnId: number) => string
  rowIds: readonly number[]
  columnIds: readonly number[]
}

export function findHealthIssues({ readText, rowIds, columnIds }: HealthCheckInput): HealthIssue[] {
  const issues: HealthIssue[] = []
  for (const columnId of columnIds) {
    let numberCount = 0
    let dateCount = 0
    let filledCount = 0
    const spacedRowIds: number[] = []
    let spacedCount = 0
    for (const rowId of rowIds) {
      const text = readText(rowId, columnId)
      if (text === '') continue
      if (text !== text.trim()) {
        spacedCount++
        if (spacedRowIds.length < MAX_LISTED_ROWS) spacedRowIds.push(rowId)
      }
      const trimmed = text.trim()
      if (trimmed === '') continue
      filledCount++
      if (parseNumber(trimmed) !== null) numberCount++
      else if (DATE_PATTERN.test(trimmed)) dateCount++
    }
    if (spacedCount > 0) issues.push({ kind: 'outerSpaces', columnId, rowIds: spacedRowIds, count: spacedCount })
    const expected = numberCount >= dateCount ? 'number' : 'date'
    const expectedCount = expected === 'number' ? numberCount : dateCount
    if (filledCount > 0 && expectedCount < filledCount && expectedCount / filledCount >= MOSTLY_SHARE) {
      const isOdd = (text: string) => text !== '' && (expected === 'number' ? parseNumber(text) === null : !DATE_PATTERN.test(text))
      const oddRowIds = rowIds.filter((rowId) => isOdd(readText(rowId, columnId).trim()))
      issues.push({ kind: 'mixedTypes', columnId, expected, oddRowIds: oddRowIds.slice(0, MAX_LISTED_ROWS), oddCount: oddRowIds.length })
    }
  }
  const firstRowIdByText = new Map<string, number>()
  const repeats: { rowId: number; firstRowId: number }[] = []
  let duplicateCount = 0
  for (const rowId of rowIds) {
    const rowText = columnIds.map((columnId) => readText(rowId, columnId)).join('\u0000')
    const firstRowId = firstRowIdByText.get(rowText)
    if (firstRowId === undefined) {
      firstRowIdByText.set(rowText, rowId)
      continue
    }
    duplicateCount++
    if (repeats.length < MAX_LISTED_ROWS) repeats.push({ rowId, firstRowId })
  }
  if (duplicateCount > 0) issues.push({ kind: 'duplicateRows', repeats, count: duplicateCount })
  return issues
}
