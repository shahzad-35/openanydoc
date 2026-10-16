// Pure helpers for the JSON page: exact big numbers, Repair, the path query, the map between text lines and tree nodes, and the
// document's stats. No imports (only types), so the parsing worker can use them too.
import type { JsonPath, JsonValue } from './jsonModel'

// ---------------------------------------------------------------- big numbers kept exactly

// A number JSON.parse would round (an integer beyond 2^53, or a decimal with more than 17 significant digits) is kept as the
// browser's "raw JSON" value: it holds the exact text and JSON.stringify writes that text back unchanged. Browsers without
// JSON.rawJSON (older Safari) keep the rounded number, as before.
// The optional never-typed member only keeps TypeScript from treating a BigNumber as a plain object.
export type BigNumber = { readonly rawJSON: string; readonly notAnObject?: never }
type JsonWithRawText = JSON & { rawJSON?: (text: string) => BigNumber; isRawJSON?: (value: unknown) => boolean }
const jsonWithRawText = JSON as JsonWithRawText

// A marker that survives the trip from the worker (raw JSON values cannot be posted); replaced by the real value afterwards.
export const BIG_NUMBER_MARK = '__openAnyDocBigNumber'
const LONG_DIGIT_RUN = /\d{16,}/

export function isBigNumber(value: unknown): value is BigNumber {
  return jsonWithRawText.isRawJSON?.(value) === true
}

function isRoundedNumber(value: number, sourceText: string) {
  if (/[.eE]/.test(sourceText)) {
    const significantDigits = sourceText.replace(/^-/, '').replace(/[eE].*$/, '').replace('.', '').replace(/^0+/, '')
    return significantDigits.length > 17
  }
  return !Number.isSafeInteger(value)
}

// JSON.parse, except that numbers it would round come back as `{ [BIG_NUMBER_MARK]: "exact text" }`. Most files have no long
// digit run, so they skip the (slower) reviver entirely.
export function parseKeepingBigNumbers(text: string): { value: unknown; bigNumberCount: number } {
  if (!LONG_DIGIT_RUN.test(text)) return { value: JSON.parse(text), bigNumberCount: 0 }
  let bigNumberCount = 0
  const value = JSON.parse(text, function keepExactNumber(this: unknown, _key: string, parsedValue: unknown, context?: { source?: string }) {
    if (typeof parsedValue !== 'number' || context?.source === undefined || !isRoundedNumber(parsedValue, context.source)) return parsedValue
    bigNumberCount++
    return { [BIG_NUMBER_MARK]: context.source }
  } as (key: string, value: unknown) => unknown)
  return { value, bigNumberCount }
}

function toBigNumber(sourceText: string): JsonValue {
  return (jsonWithRawText.rawJSON ? jsonWithRawText.rawJSON(sourceText) : Number(sourceText)) as JsonValue
}

// Replaces the worker's markers with real raw JSON values (in place: the parsed value is new and not shared yet).
export function restoreBigNumbers(value: unknown): JsonValue {
  if (typeof value !== 'object' || value === null) return value as JsonValue
  if (!Array.isArray(value) && BIG_NUMBER_MARK in value) return toBigNumber((value as Record<string, string>)[BIG_NUMBER_MARK])
  const container = value as Record<string, unknown>
  for (const key of Object.keys(container)) container[key] = restoreBigNumbers(container[key])
  return container as JsonValue
}

// A small JSON text typed by the visitor (a value in the tree or a table cell), with big numbers kept exactly.
export function parseValueExactly(text: string): JsonValue {
  const { value, bigNumberCount } = parseKeepingBigNumbers(text)
  return bigNumberCount > 0 ? restoreBigNumbers(value) : (value as JsonValue)
}

// ---------------------------------------------------------------- Repair

export type RepairFixes = {
  trailingCommas: number
  missingCommas: number
  comments: number
  singleQuotes: number
  smartQuotes: number
  unquotedKeys: number
  otherLiterals: number
}

const LITERAL_REPLACEMENTS: Record<string, string> = { True: 'true', False: 'false', None: 'null', NaN: 'null', undefined: 'null', Infinity: 'null' }
const OPENING_QUOTES: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’' }

// Fixes the mistakes people make when writing JSON by hand or copying it from code: comments, trailing commas, missing commas
// between values, single or curly quotes, unquoted keys, and True / False / None / NaN / undefined. Text inside strings is never
// changed. The result may still be invalid if something else is wrong; the caller checks it.
export function repairJson(text: string): { text: string; fixes: RepairFixes } {
  const fixes: RepairFixes = { trailingCommas: 0, missingCommas: 0, comments: 0, singleQuotes: 0, smartQuotes: 0, unquotedKeys: 0, otherLiterals: 0 }
  let output = ''
  // What the last meaningful thing written was: a whole value (so another value needs a comma first) or something else.
  let lastToken: 'value' | 'colon' | 'comma' | 'open' | 'start' = 'start'
  let position = 0

  function startValue() {
    if (lastToken === 'value') {
      output = output.replace(/(\s*)$/, ',$1')
      fixes.missingCommas++
    }
  }

  while (position < text.length) {
    const character = text[position]
    const next = text[position + 1]

    if (character === '/' && next === '/') {
      const lineEnd = text.indexOf('\n', position)
      position = lineEnd === -1 ? text.length : lineEnd
      fixes.comments++
      continue
    }
    if (character === '/' && next === '*') {
      const commentEnd = text.indexOf('*/', position + 2)
      position = commentEnd === -1 ? text.length : commentEnd + 2
      fixes.comments++
      continue
    }
    if (character in OPENING_QUOTES) {
      const closingQuote = OPENING_QUOTES[character]
      let content = ''
      position++
      while (position < text.length && text[position] !== closingQuote && !(character === '“' && text[position] === '“')) {
        if (text[position] === '\\' && position + 1 < text.length) {
          // An escaped single quote is just a quote in JSON; every other escape is kept as it was.
          content += text[position + 1] === "'" ? "'" : text.slice(position, position + 2)
          position += 2
          continue
        }
        content += character !== '"' && text[position] === '"' ? '\\"' : text[position]
        position++
      }
      position++
      if (character === "'") fixes.singleQuotes++
      if (character === '“' || character === '‘') fixes.smartQuotes++
      // A string straight after a value is a new key or value, so it needs a comma; after a colon it is the value.
      startValue()
      output += `"${content}"`
      lastToken = 'value'
      continue
    }
    if (/[A-Za-z_$]/.test(character)) {
      const word = /^[A-Za-z_$][\w$]*/.exec(text.slice(position))?.[0] ?? character
      position += word.length
      const isKey = /^\s*:/.test(text.slice(position))
      startValue()
      if (isKey) {
        output += JSON.stringify(word)
        fixes.unquotedKeys++
      } else if (word in LITERAL_REPLACEMENTS) {
        output += LITERAL_REPLACEMENTS[word]
        fixes.otherLiterals++
      } else {
        output += word
      }
      lastToken = 'value'
      continue
    }
    if (/[-\d]/.test(character)) {
      const numberText = /^-?[\d.]+(?:[eE][+-]?\d+)?/.exec(text.slice(position))?.[0] ?? character
      startValue()
      output += numberText
      position += numberText.length
      lastToken = 'value'
      continue
    }
    if (character === '{' || character === '[') {
      startValue()
      output += character
      lastToken = 'open'
      position++
      continue
    }
    if (character === '}' || character === ']') {
      const trailingComma = /,(\s*)$/.exec(output)
      if (trailingComma) {
        output = output.slice(0, trailingComma.index) + trailingComma[1]
        fixes.trailingCommas++
      }
      output += character
      lastToken = 'value'
      position++
      continue
    }
    if (character === ',') lastToken = 'comma'
    if (character === ':') lastToken = 'colon'
    output += character
    position++
  }
  return { text: output, fixes }
}

export function countRepairFixes(fixes: RepairFixes) {
  return Object.values(fixes).reduce((total, count) => total + count, 0)
}

// ---------------------------------------------------------------- path query

type QueryStep = { kind: 'child'; name: string | number } | { kind: 'all' } | { kind: 'descendant'; name: string }

// Reads a path such as $.orders[*].total, $..id, $["zip code"] or items[0]. Returns null when it cannot be read.
function readQuery(query: string): QueryStep[] | null {
  const steps: QueryStep[] = []
  let rest = query.trim().replace(/^\$/, '')
  if (rest !== '' && !/^[.[]/.test(rest)) rest = `.${rest}`
  while (rest !== '') {
    const match =
      /^\.\.([A-Za-z_$][\w$-]*)/.exec(rest) ??
      /^\.\*/.exec(rest) ??
      /^\.([A-Za-z_$][\w$-]*)/.exec(rest) ??
      /^\[\*\]/.exec(rest) ??
      /^\[(-?\d+)\]/.exec(rest) ??
      /^\[\s*(["'])((?:\\.|(?!\1).)*)\1\s*\]/.exec(rest)
    if (!match) return null
    const token = match[0]
    if (token.startsWith('..')) steps.push({ kind: 'descendant', name: match[1] })
    else if (token === '.*' || token === '[*]') steps.push({ kind: 'all' })
    else if (token.startsWith('.')) steps.push({ kind: 'child', name: match[1] })
    else if (/^\[-?\d+\]$/.test(token)) steps.push({ kind: 'child', name: Number(match[1]) })
    else steps.push({ kind: 'child', name: match[2].replace(/\\(.)/g, '$1') })
    rest = rest.slice(token.length)
  }
  return steps
}

function childrenOf(value: JsonValue): [string | number, JsonValue][] {
  if (typeof value !== 'object' || value === null || isBigNumber(value)) return []
  return Array.isArray(value) ? value.map((child, position) => [position, child]) : Object.entries(value)
}

// The paths that a query selects, in document order (at most `limit`), or null when the query cannot be read.
export function runPathQuery(root: JsonValue, query: string, limit: number): JsonPath[] | null {
  const steps = readQuery(query)
  if (steps === null) return null
  let current: { path: JsonPath; value: JsonValue }[] = [{ path: [], value: root }]
  for (const step of steps) {
    const nextNodes: { path: JsonPath; value: JsonValue }[] = []
    for (const node of current) {
      if (step.kind === 'all') {
        for (const [label, child] of childrenOf(node.value)) nextNodes.push({ path: [...node.path, label], value: child })
      } else if (step.kind === 'child') {
        const children = childrenOf(node.value)
        const label = typeof step.name === 'number' && Array.isArray(node.value) && step.name < 0 ? node.value.length + step.name : step.name
        const found = children.find(([childLabel]) => childLabel === label)
        if (found) nextNodes.push({ path: [...node.path, found[0]], value: found[1] })
      } else {
        const pending = [node]
        while (pending.length > 0 && nextNodes.length < limit) {
          const candidate = pending.shift() as { path: JsonPath; value: JsonValue }
          for (const [label, child] of childrenOf(candidate.value)) {
            const childNode = { path: [...candidate.path, label], value: child }
            if (label === step.name) nextNodes.push(childNode)
            pending.push(childNode)
          }
        }
      }
      if (nextNodes.length >= limit) break
    }
    current = nextNodes.slice(0, limit)
  }
  return current.map((node) => node.path)
}

// ---------------------------------------------------------------- text lines and tree nodes

const pathKeyOf = (path: JsonPath) => JSON.stringify(path)
// Above this size the text and the tree are not linked line by line (the scan would slow every edit down).
export const LINE_MAP_MAX_CHARACTERS = 2_000_000

export type LineMap = {
  // Where each node starts (line and column, from 1): its key for an object member, its first character otherwise.
  startByPathKey: Map<string, { line: number; column: number }>
  // For each line, the nodes that start on it, with their column (from 1), in order.
  nodesByLine: Map<number, { column: number; pathKey: string }[]>
}

// Scans the text once and notes where every node starts. Invalid text gives the nodes found before the mistake.
export function buildLineMap(text: string): LineMap {
  const startByPathKey = new Map<string, { line: number; column: number }>()
  const nodesByLine = new Map<number, { column: number; pathKey: string }[]>()
  const path: JsonPath = []
  let position = 0
  let line = 1
  let lineStart = 0

  function skipWhitespace() {
    while (position < text.length && /\s/.test(text[position])) {
      if (text[position] === '\n') {
        line++
        lineStart = position + 1
      }
      position++
    }
  }
  function noteStart(startLine: number, startColumn: number) {
    const pathKey = pathKeyOf(path)
    startByPathKey.set(pathKey, { line: startLine, column: startColumn })
    const lineNodes = nodesByLine.get(startLine) ?? []
    lineNodes.push({ column: startColumn, pathKey })
    nodesByLine.set(startLine, lineNodes)
  }
  function readString() {
    const start = position
    position++
    while (position < text.length && text[position] !== '"') position += text[position] === '\\' ? 2 : 1
    position++
    return JSON.parse(text.slice(start, position)) as string
  }
  function readValue(isAlreadyNoted: boolean) {
    skipWhitespace()
    if (!isAlreadyNoted) noteStart(line, position - lineStart + 1)
    const character = text[position]
    if (character === '{') {
      position++
      skipWhitespace()
      if (text[position] === '}') {
        position++
        return
      }
      for (;;) {
        skipWhitespace()
        const keyLine = line
        const keyColumn = position - lineStart + 1
        if (text[position] !== '"') throw new Error('key expected')
        const key = readString()
        skipWhitespace()
        if (text[position] !== ':') throw new Error('colon expected')
        position++
        path.push(key)
        noteStart(keyLine, keyColumn)
        readValue(true)
        path.pop()
        skipWhitespace()
        if (text[position] === ',') {
          position++
          continue
        }
        if (text[position] === '}') {
          position++
          return
        }
        throw new Error('comma expected')
      }
    }
    if (character === '[') {
      position++
      skipWhitespace()
      if (text[position] === ']') {
        position++
        return
      }
      for (let index = 0; ; index++) {
        path.push(index)
        readValue(false)
        path.pop()
        skipWhitespace()
        if (text[position] === ',') {
          position++
          continue
        }
        if (text[position] === ']') {
          position++
          return
        }
        throw new Error('comma expected')
      }
    }
    if (character === '"') {
      readString()
      return
    }
    while (position < text.length && !/[\s,\]}]/.test(text[position])) position++
  }

  try {
    readValue(false)
  } catch {
    // Invalid or very deeply nested text: keep what was found so far.
  }
  return { startByPathKey, nodesByLine }
}

// The node under a cursor: the last node that starts on its line at or before its column (or the first one on the line).
export function findPathKeyAt(lineMap: LineMap, line: number, column: number): string | null {
  const lineNodes = lineMap.nodesByLine.get(line)
  if (!lineNodes || lineNodes.length === 0) return null
  let found = lineNodes[0]
  for (const lineNode of lineNodes) if (lineNode.column <= column) found = lineNode
  return found.pathKey
}

// ---------------------------------------------------------------- how values are shown

// A value as JSON writes it; a big number keeps its exact digits.
export function formatValueText(value: JsonValue) {
  return isBigNumber(value) ? value.rawJSON : JSON.stringify(value)
}

// The kind of value, in the words of JSON itself (a technical label like the key names, so it is not translated).
export function getTypeName(value: JsonValue) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (isBigNumber(value)) return 'number'
  return typeof value
}

export function getValueClassName(value: JsonValue) {
  if (typeof value === 'string') return 's'
  if (typeof value === 'number' || isBigNumber(value)) return 'n'
  return value === null ? 'z' : 'b'
}

// ---------------------------------------------------------------- stats

export type JsonStats = { keys: number; values: number; depth: number; objects: number; arrays: number; bigNumbers: number }

export function computeJsonStats(root: JsonValue): JsonStats {
  const stats: JsonStats = { keys: 0, values: 0, depth: 0, objects: 0, arrays: 0, bigNumbers: 0 }
  // Depth counts the levels of objects and lists: {"a": [1]} is 2 deep, a single value 0.
  const pending: { value: JsonValue; depth: number }[] = [{ value: root, depth: 1 }]
  while (pending.length > 0) {
    const { value, depth } = pending.pop() as { value: JsonValue; depth: number }
    if (typeof value === 'object' && value !== null && !isBigNumber(value)) stats.depth = Math.max(stats.depth, depth)
    if (isBigNumber(value)) {
      stats.values++
      stats.bigNumbers++
    } else if (Array.isArray(value)) {
      stats.arrays++
      for (const child of value) pending.push({ value: child, depth: depth + 1 })
    } else if (typeof value === 'object' && value !== null) {
      stats.objects++
      const children = Object.values(value)
      stats.keys += children.length
      for (const child of children) pending.push({ value: child, depth: depth + 1 })
    } else {
      stats.values++
    }
  }
  return stats
}

// ---------------------------------------------------------------- sample

// Synthetic data for the "Sample" button: no real people or companies.
export const SAMPLE_JSON_TEXT = `{
  "store": "Demo Books & Co.",
  "storeId": 9007199254740993,
  "open": true,
  "rating": 4.7,
  "address": { "city": "Lahore", "country": "PK", "postcode": "54000" },
  "tags": ["books", "stationery", "gifts"],
  "orders": [
    { "id": 1001, "customer": "Customer A", "total": 42.5, "paid": true, "items": [{ "sku": "BK-01", "qty": 2 }, { "sku": "PN-07", "qty": 5 }] },
    { "id": 1002, "customer": "Customer B", "total": 18.0, "paid": false, "items": [{ "sku": "GF-12", "qty": 1 }] },
    { "id": 1003, "customer": "Customer C", "total": 7.25, "paid": true, "items": [] }
  ],
  "manager": null,
  "updatedAt": "2026-10-15T09:30:00Z"
}
`
