import { translate, translatePlural } from '../../i18n'
import type { Locale } from '../../i18n'
import { isBigNumber, restoreBigNumbers } from './jsonTools'
import type { BigNumber } from './jsonTools'

// A BigNumber is a number too long to keep in a JavaScript number, held as its exact text (see jsonTools.ts).
export type JsonValue = null | boolean | number | BigNumber | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonContainer = JsonValue[] | { [key: string]: JsonValue }
// The steps from the document root to a node: object keys and array positions.
export type JsonPath = (string | number)[]

export type JsonParseResult = { status: 'ok'; value: JsonValue; bigNumberCount: number } | { status: 'error'; message: string; line: number | null; column: number | null }

// The edit model: the parsed document, changed by copying only the path to the changed node, so the undo history shares
// everything else and stays small even for a 50 MB file. `root` is null until the first edit (the original text is then used).
// `indent` is what JSON.stringify gets as its spacing: 0 is minified, a number is that many spaces, '\t' is a tab.
export type JsonIndent = 0 | 1 | 2 | 3 | 4 | 8 | '\t'
export type JsonEdits = { root: JsonValue | null; indent: JsonIndent; changeCount: number }
export type JsonExportSource = { originalText: string }

export const createEmptyJsonEdits = (): JsonEdits => ({ root: null, indent: 2, changeCount: 0 })
export const countJsonChanges = (edits: unknown) => (edits as JsonEdits).changeCount

export function describeJsonChanges(edits: unknown, locale: Locale) {
  const { changeCount } = edits as JsonEdits
  if (changeCount === 0) return ''
  return translatePlural(locale, 'json.changes.edits', changeCount)
}

export function isContainer(value: JsonValue): value is JsonContainer {
  return typeof value === 'object' && value !== null && !isBigNumber(value)
}

export function isPlainObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isBigNumber(value)
}

const TABLE_CHECK_ROW_COUNT = 1000

// The shape the table view can show: a list whose first items are all objects.
export function isArrayOfObjects(value: JsonValue | null): value is JsonValue[] {
  return Array.isArray(value) && value.length > 0 && value.slice(0, TABLE_CHECK_ROW_COUNT).every(isPlainObject)
}

export function getChildEntries(container: JsonContainer): [string | number, JsonValue][] {
  return Array.isArray(container) ? container.map((child, position) => [position, child]) : Object.entries(container)
}

function getChild(container: JsonContainer, step: string | number): JsonValue {
  return Array.isArray(container) ? container[step as number] : container[step as string]
}

// Parsing runs in a Web Worker so a 50 MB file never freezes the page.
export function parseJsonText(text: string, locale: Locale): Promise<JsonParseResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./jsonParse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<JsonParseResult>) => {
      worker.terminate()
      const result = event.data
      resolve(result.status === 'ok' && result.bigNumberCount > 0 ? { ...result, value: restoreBigNumbers(result.value) } : result)
    }
    worker.onerror = () => {
      worker.terminate()
      resolve({ status: 'error', message: translate(locale, 'json.parse.readerFailed'), line: null, column: null })
    }
    worker.postMessage(text)
  })
}

// The document with the container at `parentPath` replaced by changeContainer(it). Everything else is shared, not copied.
function withChangedContainer(root: JsonValue, parentPath: JsonPath, changeContainer: (container: JsonContainer) => JsonContainer): JsonValue {
  if (!isContainer(root)) return root
  if (parentPath.length === 0) return changeContainer(root)
  const [step, ...remainingPath] = parentPath
  const changedChild = withChangedContainer(getChild(root, step), remainingPath, changeContainer)
  if (Array.isArray(root)) {
    const copy = root.slice()
    copy[step as number] = changedChild
    return copy
  }
  return { ...root, [step]: changedChild }
}

export function withValueAt(root: JsonValue, path: JsonPath, newValue: JsonValue): JsonValue {
  if (path.length === 0) return newValue
  const step = path[path.length - 1]
  return withChangedContainer(root, path.slice(0, -1), (container) => {
    if (Array.isArray(container)) {
      const copy = container.slice()
      copy[step as number] = newValue
      return copy
    }
    return { ...container, [step]: newValue }
  })
}

export function withRenamedKey(root: JsonValue, path: JsonPath, newKey: string): JsonValue {
  const oldKey = path[path.length - 1]
  return withChangedContainer(root, path.slice(0, -1), (container) => {
    if (Array.isArray(container)) return container
    return Object.fromEntries(Object.entries(container).map(([key, child]) => [key === oldKey ? newKey : key, child]))
  })
}

export function withoutNodeAt(root: JsonValue, path: JsonPath): JsonValue {
  const step = path[path.length - 1]
  return withChangedContainer(root, path.slice(0, -1), (container) => {
    if (Array.isArray(container)) return container.filter((_, position) => position !== step)
    return Object.fromEntries(Object.entries(container).filter(([key]) => key !== step))
  })
}

// Moves a child one place up (-1) or down (+1) among its siblings; the first and last stay put.
export function withMovedNode(root: JsonValue, path: JsonPath, direction: -1 | 1): JsonValue {
  const step = path[path.length - 1]
  return withChangedContainer(root, path.slice(0, -1), (container) => {
    if (Array.isArray(container)) {
      const newPosition = (step as number) + direction
      if (newPosition < 0 || newPosition >= container.length) return container
      const copy = container.slice()
      ;[copy[step as number], copy[newPosition]] = [copy[newPosition], copy[step as number]]
      return copy
    }
    const entries = Object.entries(container)
    const position = entries.findIndex(([key]) => key === step)
    const newPosition = position + direction
    if (newPosition < 0 || newPosition >= entries.length) return container
    ;[entries[position], entries[newPosition]] = [entries[newPosition], entries[position]]
    return Object.fromEntries(entries)
  })
}

// Adds a null to an array, or a key named "newKey" (then "newKey2"...) to an object: right after the child `afterStep`, or at the
// end when it is not given.
export function withAddedChild(root: JsonValue, containerPath: JsonPath, afterStep?: string | number): JsonValue {
  return withChangedContainer(root, containerPath, (container) => {
    if (Array.isArray(container)) {
      const copy = container.slice()
      copy.splice(afterStep === undefined ? copy.length : (afterStep as number) + 1, 0, null)
      return copy
    }
    let newKey = 'newKey'
    for (let suffix = 2; newKey in container; suffix++) newKey = `newKey${suffix}`
    const entries = Object.entries(container)
    entries.splice(afterStep === undefined ? entries.length : entries.findIndex(([key]) => key === afterStep) + 1, 0, [newKey, null])
    return Object.fromEntries(entries)
  })
}

export function getNodeAt(root: JsonValue, path: JsonPath): JsonValue {
  return path.reduce<JsonValue>((node, step) => (isContainer(node) ? getChild(node, step) : node), root)
}

// The edits after the document became `newRoot`; the same object when nothing changed, so no empty undo step is recorded.
export function withNewRoot(currentEdits: JsonEdits, originalRoot: JsonValue, newRoot: JsonValue, indent: JsonIndent = currentEdits.indent): JsonEdits {
  if (newRoot === (currentEdits.root ?? originalRoot) && indent === currentEdits.indent) return currentEdits
  return { root: newRoot, indent, changeCount: currentEdits.changeCount + 1 }
}

// The edits after the document is written with another indentation (or minified). While nothing is edited the original text is
// kept, so choosing the layout the file already has changes nothing.
export function withIndent(currentEdits: JsonEdits, originalText: string, originalRoot: JsonValue, indent: JsonIndent): JsonEdits {
  const root = currentEdits.root ?? originalRoot
  if (currentEdits.root === null ? JSON.stringify(root, null, indent) === originalText : indent === currentEdits.indent) return currentEdits
  return { root, indent, changeCount: currentEdits.changeCount + 1 }
}

// ---------------------------------------------------------------- toolbar edits

const keyCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// The value with the keys of its objects in order (this object only, or every object inside it too). The very same value comes
// back when nothing moved, so sharing is kept and no empty edit is recorded.
export function sortKeys(value: JsonValue, direction: 'asc' | 'desc', includeNested: boolean): JsonValue {
  if (!isContainer(value)) return value
  if (Array.isArray(value)) {
    if (!includeNested) return value
    const sortedItems = value.map((item) => sortKeys(item, direction, true))
    return sortedItems.every((item, position) => item === value[position]) ? value : sortedItems
  }
  const directionFactor = direction === 'asc' ? 1 : -1
  const sortedEntries = Object.entries(value)
    .map(([key, child]): [string, JsonValue] => [key, includeNested ? sortKeys(child, direction, true) : child])
    .sort(([firstKey], [secondKey]) => directionFactor * keyCollator.compare(firstKey, secondKey))
  const originalKeys = Object.keys(value)
  const isUnchanged = sortedEntries.every(([key, child], position) => key === originalKeys[position] && child === value[key])
  return isUnchanged ? value : Object.fromEntries(sortedEntries)
}

// A copy of the node right after it: an item in a list, or a key named "name copy" (then "name copy 2") in an object.
export function withDuplicatedNode(root: JsonValue, path: JsonPath): JsonValue {
  const step = path[path.length - 1]
  return withChangedContainer(root, path.slice(0, -1), (container) => {
    if (Array.isArray(container)) {
      const copy = container.slice()
      copy.splice((step as number) + 1, 0, container[step as number])
      return copy
    }
    let newKey = `${step} copy`
    for (let suffix = 2; newKey in container; suffix++) newKey = `${step} copy ${suffix}`
    const entries = Object.entries(container)
    entries.splice(entries.findIndex(([key]) => key === step) + 1, 0, [newKey, container[step as string]])
    return Object.fromEntries(entries)
  })
}

export const getPathKey = (path: JsonPath) => JSON.stringify(path)

// A path in the usual dotted form: $.users[0].address["zip code"]
export function formatPathText(path: JsonPath) {
  return path.reduce<string>(
    (text, step) => (typeof step === 'number' ? `${text}[${step}]` : /^[A-Za-z_$][\w$]*$/.test(step) ? `${text}.${step}` : `${text}[${JSON.stringify(step)}]`),
    '$',
  )
}

// `position` and `siblingCount` place the row among its parent's children (the root is 0 of 1).
export type TreeRow = { path: JsonPath; pathKey: string; label: string | number | null; value: JsonValue; depth: number; position: number; siblingCount: number }

// The rows on screen: the root, and the children of every expanded container, in order.
export function flattenVisibleNodes(root: JsonValue, expandedKeys: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = []
  const pending: TreeRow[] = [{ path: [], pathKey: getPathKey([]), label: null, value: root, depth: 0, position: 0, siblingCount: 1 }]
  while (pending.length > 0) {
    const row = pending.pop() as TreeRow
    rows.push(row)
    if (isContainer(row.value) && expandedKeys.has(row.pathKey)) {
      const entries = getChildEntries(row.value)
      const childRows = entries.map(([label, value], position) => {
        const path = [...row.path, label]
        return { path, pathKey: getPathKey(path), label, value, depth: row.depth + 1, position, siblingCount: entries.length }
      })
      for (let position = childRows.length - 1; position >= 0; position--) pending.push(childRows[position])
    }
  }
  return rows
}

// Expand all stops once this many rows would be on screen, so a huge file does not freeze the page.
export const EXPAND_ALL_ROW_LIMIT = 20_000

// Opens every container (or those above `maxLevel`: 1 opens the root only, 2 also its children ...) until the row limit.
export function expandNodesUpToLimit(root: JsonValue, maxLevel = Infinity): { expandedKeys: Set<string>; isLimited: boolean } {
  const expandedKeys = new Set<string>()
  let rowCount = 1
  const queue: { path: JsonPath; value: JsonValue }[] = [{ path: [], value: root }]
  for (let position = 0; position < queue.length; position++) {
    const { path, value } = queue[position]
    if (!isContainer(value) || path.length >= maxLevel) continue
    const children = getChildEntries(value)
    if (rowCount + children.length > EXPAND_ALL_ROW_LIMIT) return { expandedKeys, isLimited: true }
    rowCount += children.length
    expandedKeys.add(getPathKey(path))
    for (const [label, child] of children) queue.push({ path: [...path, label], value: child })
  }
  return { expandedKeys, isLimited: false }
}

// Keys and values that contain the (lower-case) search text, in document order, up to `limit` matches.
export function findMatchingPaths(root: JsonValue, lowerCaseSearch: string, limit: number): { paths: JsonPath[]; isLimited: boolean } {
  const paths: JsonPath[] = []
  const pending: { path: JsonPath; value: JsonValue }[] = [{ path: [], value: root }]
  while (pending.length > 0) {
    const { path, value } = pending.pop() as { path: JsonPath; value: JsonValue }
    const label = path[path.length - 1]
    const keyMatches = typeof label === 'string' && label.toLowerCase().includes(lowerCaseSearch)
    const valueMatches = !isContainer(value) && String(value).toLowerCase().includes(lowerCaseSearch)
    if (keyMatches || valueMatches) {
      if (paths.length === limit) return { paths, isLimited: true }
      paths.push(path)
    }
    if (isContainer(value)) {
      const children = getChildEntries(value)
      for (let position = children.length - 1; position >= 0; position--) pending.push({ path: [...path, children[position][0]], value: children[position][1] })
    }
  }
  return { paths, isLimited: false }
}

// The text that is saved: the original text while nothing is edited, so key order and number spelling survive untouched.
export function buildJsonDownload(edits: JsonEdits, source: JsonExportSource) {
  return edits.root === null ? source.originalText : JSON.stringify(edits.root, null, edits.indent)
}
