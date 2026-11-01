// Masks the chosen fields of a document: consistent tokens (EMAIL-000001), a partial mask (****1234) or removal. Values of token
// fields are replaced inside free text with the same tokens. Plain code with no browser imports (worker and node tests).
import { findSensitiveSpansInText, getValueText, isMarkedBigNumber, jsonFieldId, resolveOverlappingSpans, tableFieldId } from './detectSensitiveData.ts'
import type { CellValue, MaskCategory, MaskDocument, MaskTable } from './detectSensitiveData.ts'

export type MaskStrategy = 'token' | 'partial' | 'remove'
export type MaskChoice = { fieldId: string; category: MaskCategory; strategy: MaskStrategy }
// The categories a value can be tokenised as (free text is masked by what is inside it).
type TokenCategory = Exclude<MaskCategory, 'freeText'>
export type TokenKeyEntry = { value: string; type: 'string' | 'number' | 'boolean' | 'date' }
export type TokenKey = { format: 'openanydoc-mask-key'; version: 1; createdFor: string; tokens: Record<string, TokenKeyEntry> }

const TOKEN_PREFIXES: Record<TokenCategory, string> = {
  name: 'NAME',
  email: 'EMAIL',
  phone: 'PHONE',
  nationalId: 'ID',
  iban: 'IBAN',
  card: 'CARD',
  address: 'ADDR',
  birthDate: 'DOB',
  other: 'VAL',
}
export const TOKEN_PATTERN = /\b(?:NAME|EMAIL|PHONE|ID|IBAN|CARD|ADDR|DOB|VAL)-\d{6}\b/g

export const PREVIEW_ROW_COUNT = 20
// Values that are too short to replace safely inside text ("Al", "5").
const MIN_TEXT_VALUE_LENGTH = 3

function getValueType(value: unknown): TokenKeyEntry['type'] {
  if (value instanceof Date) return 'date'
  if (typeof value === 'number' || isMarkedBigNumber(value)) return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

// The same value always gets the same token, whichever field or text it is in. Numbers count per category.
function createTokenRegistry() {
  const tokensByValue = new Map<string, string>()
  const nextNumbers = new Map<TokenCategory, number>()
  const tokens: Record<string, TokenKeyEntry> = {}
  return {
    tokens,
    getToken(category: TokenCategory, value: unknown) {
      const text = getValueText(value)
      const valueKey = `${category}\u0000${text}`
      const knownToken = tokensByValue.get(valueKey)
      if (knownToken) return knownToken
      const tokenNumber = (nextNumbers.get(category) ?? 0) + 1
      nextNumbers.set(category, tokenNumber)
      const token = `${TOKEN_PREFIXES[category]}-${String(tokenNumber).padStart(6, '0')}`
      tokensByValue.set(valueKey, token)
      tokens[token] = { value: text, type: getValueType(value) }
      return token
    },
  }
}
type TokenRegistry = ReturnType<typeof createTokenRegistry>

// Emails keep their first letter and domain, dates their year, names and addresses their first letter, everything else its
// last four characters: "****1234".
export function partiallyMaskValue(value: unknown, category: TokenCategory) {
  const text = getValueText(value).trim()
  if (category === 'email') {
    const atIndex = text.lastIndexOf('@')
    return atIndex > 0 ? `${text[0]}***${text.slice(atIndex)}` : '****'
  }
  if (category === 'birthDate') {
    const year = text.match(/\b(19|20)\d{2}\b/)?.[0]
    return year ? `${year}-**-**` : '****'
  }
  if (category === 'name' || category === 'address') return text.length > 1 ? `${[...text][0]}***` : '****'
  return text.length > 4 ? `****${text.slice(-4)}` : '****'
}

// The exact values of the token and partial fields, matched inside free text as whole words, longest first.
type KnownValue = { category: TokenCategory; strategy: MaskStrategy }

function escapeForPattern(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildKnownValuePattern(knownValues: Map<string, KnownValue>) {
  const texts = [...knownValues.keys()].filter((text) => text.length >= MIN_TEXT_VALUE_LENGTH).sort((first, second) => second.length - first.length)
  if (texts.length === 0) return null
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${texts.map(escapeForPattern).join('|')})(?![\\p{L}\\p{N}])`, 'gu')
}

type FreeTextMasker = (text: string, strategy: MaskStrategy) => string

function createFreeTextMasker(knownValues: Map<string, KnownValue>, registry: TokenRegistry): FreeTextMasker {
  const knownValuePattern = buildKnownValuePattern(knownValues)
  return (text, strategy) => {
    const spans: { start: number; end: number; category: TokenCategory; strategy: MaskStrategy }[] = findSensitiveSpansInText(text).map((span) => ({ ...span, strategy }))
    if (knownValuePattern) {
      for (const match of text.matchAll(knownValuePattern)) {
        const known = knownValues.get(match[0]) as KnownValue
        spans.push({ start: match.index, end: match.index + match[0].length, category: known.category, strategy: known.strategy === 'partial' ? 'partial' : strategy })
      }
    }
    if (spans.length === 0) return text
    let maskedText = ''
    let position = 0
    for (const span of resolveOverlappingSpans(spans)) {
      const original = text.slice(span.start, span.end)
      maskedText += text.slice(position, span.start) + (span.strategy === 'partial' ? partiallyMaskValue(original, span.category) : registry.getToken(span.category, original))
      position = span.end
    }
    return maskedText + text.slice(position)
  }
}

function maskValue(value: unknown, choice: MaskChoice, registry: TokenRegistry, maskFreeText: FreeTextMasker): unknown {
  if (getValueText(value).trim() === '') return value
  if (choice.category === 'freeText') return typeof value === 'string' ? maskFreeText(value, choice.strategy) : value
  return choice.strategy === 'partial' ? partiallyMaskValue(value, choice.category) : registry.getToken(choice.category, value)
}

function collectKnownValue(knownValues: Map<string, KnownValue>, value: unknown, choice: MaskChoice) {
  const text = getValueText(value)
  if (choice.category !== 'freeText' && choice.strategy !== 'remove' && text.trim() !== '' && !knownValues.has(text)) knownValues.set(text, { category: choice.category, strategy: choice.strategy })
}

function collectKnownTableValues(tables: MaskTable[], choicesById: Map<string, MaskChoice>, knownValues: Map<string, KnownValue>) {
  tables.forEach((table, sheetIndex) => {
    table.header.forEach((_, columnIndex) => {
      const choice = choicesById.get(tableFieldId(sheetIndex, columnIndex))
      if (choice) for (const row of table.rows) collectKnownValue(knownValues, row[columnIndex], choice)
    })
  })
}

function collectKnownJsonValues(value: unknown, path: string[], choicesById: Map<string, MaskChoice>, knownValues: Map<string, KnownValue>) {
  if (Array.isArray(value)) {
    for (const item of value) collectKnownJsonValues(item, [...path, '[]'], choicesById, knownValues)
  } else if (typeof value === 'object' && value !== null && !isMarkedBigNumber(value)) {
    for (const [key, child] of Object.entries(value)) collectKnownJsonValues(child, [...path, key], choicesById, knownValues)
  } else {
    const choice = choicesById.get(jsonFieldId(path))
    if (choice) collectKnownValue(knownValues, value, choice)
  }
}

function maskJsonValue(value: unknown, path: string[], choicesById: Map<string, MaskChoice>, registry: TokenRegistry, maskFreeText: FreeTextMasker): unknown {
  if (Array.isArray(value)) return value.map((item) => maskJsonValue(item, [...path, '[]'], choicesById, registry, maskFreeText))
  if (typeof value === 'object' && value !== null && !isMarkedBigNumber(value)) {
    const maskedObject: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      const childPath = [...path, key]
      if (choicesById.get(jsonFieldId(childPath))?.strategy === 'remove') continue
      maskedObject[key] = maskJsonValue(child, childPath, choicesById, registry, maskFreeText)
    }
    return maskedObject
  }
  const choice = choicesById.get(jsonFieldId(path))
  return choice ? maskValue(value, choice, registry, maskFreeText) : value
}

// The rows of one sheet with its choices applied; `rowLimit` masks only the first rows (the preview), numbering tokens the same
// way the full run does because rows are masked in order.
function maskTable(table: MaskTable, sheetIndex: number, choicesById: Map<string, MaskChoice>, registry: TokenRegistry, maskFreeText: FreeTextMasker, rowLimit = Infinity): MaskTable {
  const columnChoices = table.header.map((_, columnIndex) => choicesById.get(tableFieldId(sheetIndex, columnIndex)))
  const keptColumns = table.header.map((_, columnIndex) => columnIndex).filter((columnIndex) => columnChoices[columnIndex]?.strategy !== 'remove')
  const rows = table.rows.slice(0, rowLimit).map((row) =>
    keptColumns.map((columnIndex) => {
      const choice = columnChoices[columnIndex]
      const value = row[columnIndex] ?? null
      return choice ? (maskValue(value, choice, registry, maskFreeText) as CellValue) : value
    }),
  )
  return { sheetName: table.sheetName, header: keptColumns.map((columnIndex) => table.header[columnIndex]), rows }
}

// The masked copy of `document` and the tokens it used. With `previewSheetIndex`, only that sheet's first `previewRowCount`
// rows are masked (the before/after preview); the known values still come from the whole file.
export function maskDocument(document: MaskDocument, choices: MaskChoice[], preview?: { sheetIndex: number; rowCount: number }): { document: MaskDocument; tokens: Record<string, TokenKeyEntry> } {
  const choicesById = new Map(choices.map((choice) => [choice.fieldId, choice]))
  const registry = createTokenRegistry()
  const knownValues = new Map<string, KnownValue>()
  if (document.kind === 'text') {
    const choice = choices[0]
    const text = choice && choice.strategy !== 'remove' ? createFreeTextMasker(knownValues, registry)(document.text, choice.strategy) : choice ? '' : document.text
    return { document: { kind: 'text', text }, tokens: registry.tokens }
  }
  if (document.kind === 'json') {
    collectKnownJsonValues(document.root, [], choicesById, knownValues)
    const maskFreeText = createFreeTextMasker(knownValues, registry)
    return { document: { kind: 'json', root: maskJsonValue(document.root, [], choicesById, registry, maskFreeText) }, tokens: registry.tokens }
  }
  collectKnownTableValues(document.tables, choicesById, knownValues)
  const maskFreeText = createFreeTextMasker(knownValues, registry)
  const tables = preview
    ? [maskTable(document.tables[preview.sheetIndex], preview.sheetIndex, choicesById, registry, maskFreeText, preview.rowCount)]
    : document.tables.map((table, sheetIndex) => maskTable(table, sheetIndex, choicesById, registry, maskFreeText))
  return { document: { ...document, tables }, tokens: registry.tokens }
}

export function buildTokenKey(tokens: Record<string, TokenKeyEntry>, createdFor: string): TokenKey {
  return { format: 'openanydoc-mask-key', version: 1, createdFor, tokens }
}
