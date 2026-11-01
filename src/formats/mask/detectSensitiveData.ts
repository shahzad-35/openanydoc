// Finds the fields (table columns, JSON keys) that look like personal data, for the Mask Data page (/mask-data). Plain code with
// no browser or React imports: it runs in the mask worker and in `node scripts/test-mask-data.mjs`.
import { BIG_NUMBER_MARK } from '../json/jsonTools.ts'

export type SensitiveCategory = 'name' | 'email' | 'phone' | 'nationalId' | 'iban' | 'card' | 'address' | 'birthDate'
export type FindingCategory = SensitiveCategory | 'freeText'
// What the visitor can set a field to: a found category, or 'other' for a field the scan did not flag.
export type MaskCategory = FindingCategory | 'other'
export type Confidence = 'high' | 'medium' | 'low'
// Why a field was flagged: the column name, its values, a passed checksum, or matches inside long text.
export type FindingReason = 'headerAndValues' | 'values' | 'checksum' | 'header' | 'textMatches' | 'longText'

export type CellValue = string | number | boolean | Date | null
export type MaskTable = { sheetName: string; header: string[]; rows: CellValue[][] }
// A CSV file is one table, a workbook one table per sheet; JSON keeps its tree (big numbers in their marked form, see jsonTools); a
// text file is one field, its whole text.
export type MaskDocument = { kind: 'tables'; sourceFormat: 'csv' | 'excel'; tables: MaskTable[] } | { kind: 'json'; root: unknown } | { kind: 'text'; text: string }
// Every column or JSON key of the document, flagged or not, for the list the visitor picks from.
export type MaskField = { fieldId: string; label: string; sheetName: string }
export const TEXT_FIELD_ID = '"text"'

export type Finding = {
  // [sheet index, column index] for a table, the key path with '[]' for list items for JSON, as JSON text.
  fieldId: string
  label: string
  sheetName: string
  category: FindingCategory
  reason: FindingReason
  confidence: Confidence
  matchPercent: number
  examples: string[]
}

export type TextSpan = { start: number; end: number; category: SensitiveCategory }

const SAMPLE_SIZE = 1000
const MATCH_SHARE = 0.6
const CHECKSUM_SHARE = 0.8
const LONG_TEXT_LENGTH = 30

// Words in a column name, in English and Arabic. Latin words must be whole words; Arabic ones may be part of the name.
const HEADER_WORDS: Record<SensitiveCategory, string[]> = {
  name: ['name', 'first name', 'last name', 'full name', 'surname', 'given name', 'family name', 'customer name', 'اسم', 'الاسم'],
  email: ['email', 'e mail', 'mail', 'email address', 'بريد', 'ايميل', 'إيميل'],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'cell', 'whatsapp', 'جوال', 'الجوال', 'هاتف', 'موبايل', 'تلفون'],
  nationalId: ['national id', 'nationalid', 'iqama', 'iqama number', 'id number', 'nid', 'ssn', 'passport', 'civil id', 'هوية', 'الهوية', 'اقامة', 'إقامة', 'السجل المدني'],
  iban: ['iban', 'bank account', 'account number', 'ايبان', 'آيبان', 'الآيبان', 'رقم الحساب'],
  card: ['card', 'card number', 'credit card', 'pan', 'بطاقة'],
  address: ['address', 'street', 'addr', 'home address', 'عنوان', 'العنوان', 'الشارع'],
  birthDate: ['dob', 'birth', 'birthday', 'date of birth', 'birthdate', 'birth date', 'ميلاد', 'تاريخ الميلاد'],
}
// "Product name", "file name" and the like are not people.
const NOT_A_PERSON_WORDS = ['product', 'company', 'file', 'item', 'sheet', 'project', 'brand', 'category', 'city', 'country', 'street', 'bank', 'user', 'display', 'domain', 'host', 'منتج', 'شركة', 'ملف', 'مدينة']
const CATEGORY_ORDER: SensitiveCategory[] = ['email', 'iban', 'card', 'nationalId', 'phone', 'birthDate', 'address', 'name']
const CHECKSUM_CATEGORIES = new Set<SensitiveCategory>(['iban', 'card', 'nationalId'])
const VALUE_ONLY_CATEGORIES = new Set<SensitiveCategory>(['email', 'iban', 'card', 'nationalId', 'phone'])
const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const LATIN_NAME_WORD = /^\p{Lu}[\p{L}'’-]*$/u
const ARABIC_WORD = /^[ء-ي٠-٩ٮ-ۓ]+$/
const DATE_TEXT_PATTERN = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})([T ][\d:.]+Z?)?$/

export function isMarkedBigNumber(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && BIG_NUMBER_MARK in value
}

export function getValueText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (isMarkedBigNumber(value)) return value[BIG_NUMBER_MARK]
  return String(value)
}

export function isLuhnValid(digits: string) {
  let sum = 0
  for (let position = 0; position < digits.length; position++) {
    let digit = Number(digits[digits.length - 1 - position])
    if (position % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return digits.length > 0 && sum % 10 === 0
}

// ISO 13616: move the first four characters to the end, letters become 10..35, and the number mod 97 must be 1.
export function isValidIban(text: string) {
  const iban = text.replace(/[\s-]/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const character of rearranged) {
    const digits = /\d/.test(character) ? character : String(character.charCodeAt(0) - 55)
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

// Visa, Mastercard, Amex, Discover, JCB and Diners prefixes, 13 to 19 digits, and the Luhn check.
export function isValidCardNumber(text: string) {
  const digits = text.replace(/[\s-]/g, '')
  return /^\d{13,19}$/.test(digits) && /^(4|5[1-5]|2[2-7]|3[47]|30[0-5]|3[68]|35|6011|65)/.test(digits) && isLuhnValid(digits)
}

// Saudi national ID (starts with 1) and Iqama (starts with 2): 10 digits checked with the Luhn method.
export function isValidSaudiNationalId(text: string) {
  return /^[12]\d{9}$/.test(text) && isLuhnValid(text)
}

// A number with a + or 00 country prefix, or a Saudi mobile (05..., 5..., 9665...), 8 to 15 digits.
function isPhoneNumber(text: string) {
  if (/[^\d\s()+.-]/.test(text)) return false
  const compact = text.replace(/[\s().-]/g, '')
  if (!/^(\+|00)?\d{8,15}$/.test(compact)) return false
  return /^(\+|00)/.test(compact) || /^(966|0)?5\d{8}$/.test(compact)
}

function looksLikePersonName(text: string, isStrict: boolean) {
  if (text.length > 60 || /\d/.test(text)) return false
  const words = text.trim().split(/\s+/)
  if (words.length > 4 || (isStrict && words.length < 2)) return false
  return words.every((word) => LATIN_NAME_WORD.test(word) || ARABIC_WORD.test(word) || (!isStrict && /^[\p{L}'’.-]+$/u.test(word)))
}

function looksLikeAddress(text: string) {
  return text.length >= 8 && /\p{L}/u.test(text) && (/\d/.test(text) || text.includes(',') || text.includes('،'))
}

function looksLikeDate(value: unknown) {
  return value instanceof Date || DATE_TEXT_PATTERN.test(getValueText(value).trim())
}

function valueMatchesCategory(value: unknown, category: SensitiveCategory): boolean {
  const text = getValueText(value).trim()
  switch (category) {
    case 'email':
      return EMAIL_PATTERN.test(text)
    case 'iban':
      return isValidIban(text)
    case 'card':
      return isValidCardNumber(text)
    case 'nationalId':
      return isValidSaudiNationalId(text)
    case 'phone':
      return isPhoneNumber(text)
    case 'birthDate':
      return looksLikeDate(value)
    case 'address':
      return looksLikeAddress(text)
    case 'name':
      return looksLikePersonName(text, false)
  }
}

// "firstName", "first_name" and "First Name" all read as "first name".
function normalizeHeader(header: string) {
  return header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_\-./:#()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function headerMatchesCategory(header: string, category: SensitiveCategory) {
  const normalized = normalizeHeader(header)
  if (normalized === '') return false
  const paddedHeader = ` ${normalized} `
  const compactHeader = normalized.replace(/ /g, '')
  if (category === 'name' && NOT_A_PERSON_WORDS.some((word) => normalized.includes(word))) return false
  return HEADER_WORDS[category].some((word) => {
    if (/[؀-ۿ]/.test(word)) return normalized.includes(word)
    if (paddedHeader.includes(` ${word} `)) return true
    const compactWord = word.replace(/ /g, '')
    return compactWord.length >= 5 && compactHeader === compactWord
  })
}

// Spans of emails, IBANs, card numbers, phone numbers and national IDs inside free text. Spans can overlap here;
// resolveOverlappingSpans keeps one of each overlapping group.
export function findSensitiveSpansInText(text: string): TextSpan[] {
  const spans: TextSpan[] = []
  const collect = (pattern: RegExp, category: SensitiveCategory, isValid: (match: string) => boolean) => {
    for (const match of text.matchAll(pattern)) {
      if (isValid(match[0])) spans.push({ start: match.index, end: match.index + match[0].length, category })
    }
  }
  collect(/[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[A-Za-z]{2,}/g, 'email', () => true)
  collect(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, 'iban', isValidIban)
  collect(/\b\d(?:[ -]?\d){12,18}\b/g, 'card', isValidCardNumber)
  collect(/\b[12]\d{9}\b/g, 'nationalId', isValidSaudiNationalId)
  collect(/(?:\+|\b00)\d[\d -]{6,16}\d\b|\b0?5\d(?:[ -]?\d){7}\b/g, 'phone', (match) => isPhoneNumber(match))
  return spans
}

// Sorted by start, the longer span first where two start together; a span that overlaps one already kept is dropped.
export function resolveOverlappingSpans<Span extends { start: number; end: number }>(spans: Span[]): Span[] {
  const sortedSpans = [...spans].sort((first, second) => first.start - second.start || second.end - first.end)
  const keptSpans: Span[] = []
  for (const span of sortedSpans) {
    const lastKept = keptSpans[keptSpans.length - 1]
    if (!lastKept || span.start >= lastKept.end) keptSpans.push(span)
  }
  return keptSpans
}

// One field and up to SAMPLE_SIZE of its non-empty values.
type SampledField = { fieldId: string; label: string; sheetName: string; headerWord: string; values: unknown[] }

function addSample(fieldsById: Map<string, SampledField>, fieldId: string, label: string, sheetName: string, headerWord: string, value: unknown) {
  let field = fieldsById.get(fieldId)
  if (!field) {
    field = { fieldId, label, sheetName, headerWord, values: [] }
    fieldsById.set(fieldId, field)
  }
  if (field.values.length < SAMPLE_SIZE && getValueText(value).trim() !== '') field.values.push(value)
}

// JSON path of an object key or list item, for the field id ('[]' stands for every item of a list) and the label.
export function jsonFieldId(path: string[]) {
  return JSON.stringify(path)
}

function jsonFieldLabel(path: string[]) {
  return path.map((step, position) => (step === '[]' ? '[]' : position === 0 ? step : `.${step}`)).join('') || '(root)'
}

function sampleJsonFields(value: unknown, path: string[], fieldsById: Map<string, SampledField>) {
  if (Array.isArray(value)) {
    for (const item of value) sampleJsonFields(item, [...path, '[]'], fieldsById)
    return
  }
  if (typeof value === 'object' && value !== null && !isMarkedBigNumber(value)) {
    for (const [key, child] of Object.entries(value)) sampleJsonFields(child, [...path, key], fieldsById)
    return
  }
  const lastKey = [...path].reverse().find((step) => step !== '[]') ?? ''
  addSample(fieldsById, jsonFieldId(path), jsonFieldLabel(path), '', lastKey, value)
}

export function tableFieldId(sheetIndex: number, columnIndex: number) {
  return JSON.stringify([sheetIndex, columnIndex])
}

function sampleFields(document: MaskDocument): SampledField[] {
  const fieldsById = new Map<string, SampledField>()
  if (document.kind === 'text') return [{ fieldId: TEXT_FIELD_ID, label: '', sheetName: '', headerWord: '', values: [document.text] }]
  if (document.kind === 'json') {
    sampleJsonFields(document.root, [], fieldsById)
    return [...fieldsById.values()]
  }
  document.tables.forEach((table, sheetIndex) => {
    table.header.forEach((header, columnIndex) => {
      const fieldId = tableFieldId(sheetIndex, columnIndex)
      fieldsById.set(fieldId, { fieldId, label: header, sheetName: table.sheetName, headerWord: header, values: [] })
      for (const row of table.rows) {
        if (fieldsById.get(fieldId)!.values.length >= SAMPLE_SIZE) break
        addSample(fieldsById, fieldId, header, table.sheetName, header, row[columnIndex] ?? null)
      }
    })
  })
  return [...fieldsById.values()]
}

function shortExample(value: unknown) {
  const text = getValueText(value).trim()
  return text.length > 40 ? `${text.slice(0, 39)}…` : text
}

function findDistinctExamples(values: unknown[], isMatch: (value: unknown) => boolean) {
  const examples = new Set<string>()
  for (const value of values) {
    if (examples.size === 3) break
    if (isMatch(value)) examples.add(shortExample(value))
  }
  return [...examples]
}

function classifyField(field: SampledField): Finding | null {
  const { values } = field
  if (values.length === 0) return null
  let bestFinding: Finding | null = null
  for (const category of CATEGORY_ORDER) {
    const hasHeaderHint = headerMatchesCategory(field.headerWord, category)
    const isMatch = (value: unknown) => valueMatchesCategory(value, category)
    const matchShare = values.filter(isMatch).length / values.length
    let confidence: Confidence | null = null
    let reason: FindingReason = 'values'
    if (hasHeaderHint && matchShare >= MATCH_SHARE) {
      confidence = 'high'
      reason = 'headerAndValues'
    } else if (VALUE_ONLY_CATEGORIES.has(category) && matchShare >= MATCH_SHARE) {
      const passesChecksum = CHECKSUM_CATEGORIES.has(category) && matchShare >= CHECKSUM_SHARE
      confidence = passesChecksum ? 'high' : 'medium'
      reason = passesChecksum ? 'checksum' : 'values'
    } else if (category === 'name' && values.filter((value) => looksLikePersonName(getValueText(value).trim(), true)).length / values.length >= CHECKSUM_SHARE) {
      // Names found by their shape alone are often products or places, so they are offered but not selected.
      confidence = 'low'
    } else if (hasHeaderHint) {
      confidence = 'low'
      reason = 'header'
    }
    if (!confidence) continue
    const examples = findDistinctExamples(values, reason === 'header' ? () => true : category === 'name' && reason === 'values' ? (value) => looksLikePersonName(getValueText(value).trim(), true) : isMatch)
    const finding: Finding = { fieldId: field.fieldId, label: field.label, sheetName: field.sheetName, category, reason, confidence, matchPercent: Math.round(matchShare * 100), examples }
    if (!bestFinding || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[bestFinding.confidence] || (confidence === bestFinding.confidence && finding.matchPercent > bestFinding.matchPercent)) bestFinding = finding
  }
  return bestFinding ?? classifyFreeText(field)
}

// Long text with spaces (notes, comments, descriptions) may mention the masked values or contain emails and phone numbers.
function classifyFreeText(field: SampledField): Finding | null {
  const texts = field.values.filter((value): value is string => typeof value === 'string')
  if (texts.length < field.values.length / 2) return null
  const averageLength = texts.reduce((total, text) => total + text.length, 0) / texts.length
  const shareWithSpaces = texts.filter((text) => /\s/.test(text.trim())).length / texts.length
  if (averageLength < LONG_TEXT_LENGTH || shareWithSpaces < 0.5) return null
  const textsWithMatches = texts.filter((text) => findSensitiveSpansInText(text).length > 0)
  const examples = [...new Set(textsWithMatches.slice(0, 3).map(shortExample))]
  return {
    fieldId: field.fieldId,
    label: field.label,
    sheetName: field.sheetName,
    category: 'freeText',
    reason: textsWithMatches.length > 0 ? 'textMatches' : 'longText',
    confidence: textsWithMatches.length > 0 ? 'medium' : 'low',
    matchPercent: Math.round((textsWithMatches.length / texts.length) * 100),
    examples: examples.length > 0 ? examples : texts.slice(0, 1).map(shortExample),
  }
}

// A text file is free text as a whole: what it holds is found by the patterns (emails, phone numbers, IDs, IBANs, cards).
function classifyText(field: SampledField): Finding {
  const text = getValueText(field.values[0])
  const spans = findSensitiveSpansInText(text)
  return {
    fieldId: field.fieldId,
    label: field.label,
    sheetName: '',
    category: 'freeText',
    reason: spans.length > 0 ? 'textMatches' : 'longText',
    confidence: spans.length > 0 ? 'medium' : 'low',
    matchPercent: spans.length,
    examples: [...new Set(spans.slice(0, 3).map((span) => shortExample(text.slice(span.start, span.end))))],
  }
}

// Every field of the document, and the flagged ones as findings, both in the order the fields appear. `onProgress` gets the
// share of fields checked (0 to 1).
export function detectSensitiveFields(document: MaskDocument, onProgress?: (share: number) => void): { fields: MaskField[]; findings: Finding[] } {
  const sampledFields = sampleFields(document)
  const findings: Finding[] = []
  sampledFields.forEach((field, position) => {
    const finding = document.kind === 'text' ? classifyText(field) : classifyField(field)
    if (finding) findings.push(finding)
    onProgress?.((position + 1) / sampledFields.length)
  })
  return { fields: sampledFields.map(({ fieldId, label, sheetName }) => ({ fieldId, label, sheetName })), findings }
}

// High and medium findings start selected; free text is always selected, since replacing inside it changes only what matches.
export function isSelectedByDefault(finding: Finding) {
  return finding.category === 'freeText' || finding.confidence !== 'low'
}
