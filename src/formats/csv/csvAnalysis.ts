// What the CSV page works out about the data, without changing it: each column's type, the filters and the sort that decide
// which rows are shown, a column's profile, and group-by totals. Pure functions over cell text.

import type { MessageKey } from '../../i18n'

export type ColumnType = 'text' | 'number' | 'date' | 'bool'

export const COLUMN_TYPE_LABEL_KEYS: Record<ColumnType, MessageKey> = {
  text: 'csv.wb.type.text',
  number: 'csv.wb.type.number',
  date: 'csv.wb.type.date',
  bool: 'csv.wb.type.bool',
}

// What a column holds, guessed from its first filled cells. `decimals` is the most decimal places seen, for showing numbers.
export type ColumnInfo = { type: ColumnType; decimals: number; isRightToLeft: boolean }

export type ColumnFilter =
  | { columnId: number; kind: 'in'; values: string[] }
  | { columnId: number; kind: 'contains' | 'equals'; value: string }
  | { columnId: number; kind: 'empty' | 'notEmpty' }
  | { columnId: number; kind: 'range'; min: number | null; max: number | null }
  | { columnId: number; kind: 'dateRange'; from: string; to: string }
  | { columnId: number; kind: 'bool'; value: 'true' | 'false' }

export type SortLevel = { columnId: number; direction: 'asc' | 'desc' }

export type GroupAggregate = 'count' | 'sum' | 'avg'

const TYPE_SAMPLE_SIZE = 1000
const NUMBER_PATTERN = /^[-+]?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/
// Only ISO dates count as dates, so that text comparison puts them in order.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/
const BOOLEAN_TEXTS = new Set(['true', 'false'])
const ARABIC_LETTER_PATTERN = /[؀-ۿ]/
const textCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function parseNumber(text: string): number | null {
  const trimmed = text.trim()
  if (!NUMBER_PATTERN.test(trimmed)) return null
  return Number(trimmed.replace(/,/g, ''))
}

export function detectColumnInfo(readText: (rowId: number) => string, rowIds: readonly number[]): ColumnInfo {
  const samples: string[] = []
  for (const rowId of rowIds) {
    const text = readText(rowId).trim()
    if (text !== '') samples.push(text)
    if (samples.length === TYPE_SAMPLE_SIZE) break
  }
  const isRightToLeft = samples.length > 0 && samples.filter((text) => ARABIC_LETTER_PATTERN.test(text)).length > samples.length / 2
  if (samples.length === 0) return { type: 'text', decimals: 0, isRightToLeft }
  if (samples.every((text) => NUMBER_PATTERN.test(text))) {
    const decimals = Math.min(6, Math.max(...samples.map((text) => (text.split('.')[1] ?? '').length)))
    return { type: 'number', decimals, isRightToLeft: false }
  }
  if (samples.every((text) => DATE_PATTERN.test(text))) return { type: 'date', decimals: 0, isRightToLeft: false }
  if (samples.every((text) => BOOLEAN_TEXTS.has(text.toLowerCase()))) return { type: 'bool', decimals: 0, isRightToLeft: false }
  return { type: 'text', decimals: 0, isRightToLeft }
}

export function passesFilter(text: string, filter: ColumnFilter) {
  switch (filter.kind) {
    case 'in':
      return filter.values.includes(text)
    case 'contains':
      return text.toLowerCase().includes(filter.value.toLowerCase())
    case 'equals':
      return text === filter.value
    case 'empty':
      return text.trim() === ''
    case 'notEmpty':
      return text.trim() !== ''
    case 'range': {
      const number = parseNumber(text)
      return number !== null && (filter.min === null || number >= filter.min) && (filter.max === null || number <= filter.max)
    }
    case 'dateRange':
      return text !== '' && (filter.from === '' || text >= filter.from) && (filter.to === '' || text.slice(0, 10) <= filter.to)
    case 'bool':
      return text.toLowerCase() === filter.value
  }
}

// Empty cells always go last; numbers compare as numbers, everything else as text.
export function compareCellTexts(firstText: string, secondText: string, type: ColumnType) {
  if (firstText === '' || secondText === '') return firstText === secondText ? 0 : firstText === '' ? 1 : -1
  if (type === 'number') return (parseNumber(firstText) ?? 0) - (parseNumber(secondText) ?? 0)
  return textCollator.compare(firstText, secondText)
}

// The rows in sort order: level by level, ties keep their order (a stable sort).
export function sortRowIds(rowIds: readonly number[], sortLevels: readonly SortLevel[], readText: (rowId: number, columnId: number) => string, typeOf: (columnId: number) => ColumnType) {
  if (sortLevels.length === 0) return rowIds
  return [...rowIds].sort((firstRowId, secondRowId) => {
    for (const { columnId, direction } of sortLevels) {
      const result = compareCellTexts(readText(firstRowId, columnId), readText(secondRowId, columnId), typeOf(columnId))
      if (result !== 0) return direction === 'asc' ? result : -result
    }
    return 0
  })
}

export type ColumnProfile = {
  filledCount: number
  blankCount: number
  distinctCount: number
  // Values with how often they appear, most frequent first.
  topValues: [string, number][]
  numbers: number[]
  // The earliest and latest date (for a date column).
  dates: { first: string; last: string } | null
}

const TOP_VALUE_COUNT = 5

export function buildColumnProfile(texts: readonly string[], type: ColumnType): ColumnProfile {
  const counts = new Map<string, number>()
  let blankCount = 0
  for (const text of texts) {
    if (text.trim() === '') blankCount++
    else counts.set(text, (counts.get(text) ?? 0) + 1)
  }
  const filledTexts = texts.filter((text) => text.trim() !== '')
  const numbers = type === 'number' ? filledTexts.map(parseNumber).filter((number): number is number => number !== null) : []
  const sortedDates = type === 'date' ? [...filledTexts].sort() : []
  // One pass keeping the best few: sorting every distinct value took 0.35 s on a 120k-row column, on every edit.
  const compareTopValues = (first: [string, number], second: [string, number]) => second[1] - first[1] || textCollator.compare(first[0], second[0])
  const topValues: [string, number][] = []
  for (const entry of counts) {
    if (topValues.length === TOP_VALUE_COUNT && compareTopValues(entry, topValues[TOP_VALUE_COUNT - 1]) >= 0) continue
    const insertAt = topValues.findIndex((topValue) => compareTopValues(entry, topValue) < 0)
    topValues.splice(insertAt === -1 ? topValues.length : insertAt, 0, entry)
    if (topValues.length > TOP_VALUE_COUNT) topValues.pop()
  }
  return {
    filledCount: filledTexts.length,
    blankCount,
    distinctCount: counts.size,
    topValues,
    numbers,
    dates: sortedDates.length > 0 ? { first: sortedDates[0], last: sortedDates[sortedDates.length - 1] } : null,
  }
}

export function summarizeNumbers(numbers: readonly number[]) {
  if (numbers.length === 0) return null
  let min = numbers[0]
  let max = numbers[0]
  let sum = 0
  for (const number of numbers) {
    if (number < min) min = number
    if (number > max) max = number
    sum += number
  }
  return { min, max, sum, mean: sum / numbers.length }
}

export type HistogramBin = { from: number; to: number; count: number }

export function buildHistogram(numbers: readonly number[], binCount: number): HistogramBin[] {
  const summary = summarizeNumbers(numbers)
  if (!summary) return []
  const step = (summary.max - summary.min) / binCount || 1
  const bins = Array.from({ length: binCount }, (_, binPosition) => ({ from: summary.min + binPosition * step, to: summary.min + (binPosition + 1) * step, count: 0 }))
  for (const number of numbers) bins[Math.min(binCount - 1, Math.floor((number - summary.min) / step))].count++
  return bins
}

// Rows per week from the first date, for a date column's chart.
export function countRowsPerWeek(dateTexts: readonly string[]) {
  const times = dateTexts.map((text) => Date.parse(text.slice(0, 10))).filter((time) => !Number.isNaN(time))
  if (times.length === 0) return []
  const firstTime = Math.min(...times)
  const counts: number[] = []
  for (const time of times) {
    const week = Math.floor((time - firstTime) / (7 * 86_400_000))
    counts[week] = (counts[week] ?? 0) + 1
  }
  return Array.from(counts, (count) => count ?? 0)
}

export type GroupTotal = { group: string; value: number }

export function groupRows(
  rowIds: readonly number[],
  readGroup: (rowId: number) => string,
  readNumber: (rowId: number) => number | null,
  aggregate: GroupAggregate,
): GroupTotal[] {
  const groups = new Map<string, { count: number; sum: number; numberCount: number }>()
  for (const rowId of rowIds) {
    const group = readGroup(rowId)
    const totals = groups.get(group) ?? { count: 0, sum: 0, numberCount: 0 }
    totals.count++
    if (aggregate !== 'count') {
      const number = readNumber(rowId)
      if (number !== null) {
        totals.sum += number
        totals.numberCount++
      }
    }
    groups.set(group, totals)
  }
  return [...groups.entries()]
    .map(([group, totals]) => ({ group, value: aggregate === 'count' ? totals.count : aggregate === 'sum' ? totals.sum : totals.numberCount ? totals.sum / totals.numberCount : 0 }))
    .sort((first, second) => second.value - first.value)
}

// A regular expression for find and replace, or null when the text is empty or the expression is not valid.
export function buildFindPattern(findText: string, options: { matchCase: boolean; wholeCell: boolean; isRegularExpression: boolean }) {
  if (findText === '') return null
  const source = options.isRegularExpression ? findText : findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    return new RegExp(options.wholeCell ? `^(?:${source})$` : source, options.matchCase ? 'g' : 'gi')
  } catch {
    return null
  }
}
