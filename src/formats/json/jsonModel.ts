import type { EditingModule, ExportOption } from '../registry'

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonContainer = JsonValue[] | { [key: string]: JsonValue }
// The steps from the document root to a node: object keys and array positions.
export type JsonPath = (string | number)[]

export type JsonParseResult = { status: 'ok'; value: JsonValue } | { status: 'error'; message: string; line: number | null; column: number | null }

// The edit model: the parsed document, changed by copying only the path to the changed node, so the undo history shares
// everything else and stays small even for a 50 MB file. `root` is null until the first edit (the original text is then used).
export type JsonEdits = { root: JsonValue | null; indent: 0 | 2; changeCount: number }
export type JsonExportSource = { originalText: string }

export const createEmptyJsonEdits = (): JsonEdits => ({ root: null, indent: 2, changeCount: 0 })
export const countJsonChanges = (edits: unknown) => (edits as JsonEdits).changeCount

export function describeJsonChanges(edits: unknown) {
  const { changeCount } = edits as JsonEdits
  if (changeCount === 0) return ''
  return `${changeCount.toLocaleString()} ${changeCount === 1 ? 'edit' : 'edits'}`
}

export function isContainer(value: JsonValue): value is JsonContainer {
  return typeof value === 'object' && value !== null
}

export function isPlainObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
export function parseJsonText(text: string): Promise<JsonParseResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./jsonParse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<JsonParseResult>) => {
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = () => {
      worker.terminate()
      resolve({ status: 'error', message: 'The JSON reader could not start in this browser.', line: null, column: null })
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

// Adds a null at the end of an array, or a key named "newKey" (then "newKey2"...) to an object.
export function withAddedChild(root: JsonValue, containerPath: JsonPath): JsonValue {
  return withChangedContainer(root, containerPath, (container) => {
    if (Array.isArray(container)) return [...container, null]
    let newKey = 'newKey'
    for (let suffix = 2; newKey in container; suffix++) newKey = `newKey${suffix}`
    return { ...container, [newKey]: null }
  })
}

export function getNodeAt(root: JsonValue, path: JsonPath): JsonValue {
  return path.reduce<JsonValue>((node, step) => (isContainer(node) ? getChild(node, step) : node), root)
}

// The edits after the document became `newRoot`; the same object when nothing changed, so no empty undo step is recorded.
export function withNewRoot(currentEdits: JsonEdits, originalRoot: JsonValue, newRoot: JsonValue, indent: 0 | 2 = currentEdits.indent): JsonEdits {
  if (newRoot === (currentEdits.root ?? originalRoot) && indent === currentEdits.indent) return currentEdits
  return { root: newRoot, indent, changeCount: currentEdits.changeCount + 1 }
}

export const getPathKey = (path: JsonPath) => JSON.stringify(path)

// A path in the usual dotted form: $.users[0].address["zip code"]
export function formatPathText(path: JsonPath) {
  return path.reduce<string>(
    (text, step) => (typeof step === 'number' ? `${text}[${step}]` : /^[A-Za-z_$][\w$]*$/.test(step) ? `${text}.${step}` : `${text}[${JSON.stringify(step)}]`),
    '$',
  )
}

export type TreeRow = { path: JsonPath; pathKey: string; label: string | number | null; value: JsonValue; depth: number }

// The rows on screen: the root, and the children of every expanded container, in order.
export function flattenVisibleNodes(root: JsonValue, expandedKeys: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = []
  const pending: TreeRow[] = [{ path: [], pathKey: getPathKey([]), label: null, value: root, depth: 0 }]
  while (pending.length > 0) {
    const row = pending.pop() as TreeRow
    rows.push(row)
    if (isContainer(row.value) && expandedKeys.has(row.pathKey)) {
      const childRows = getChildEntries(row.value).map(([label, value]) => {
        const path = [...row.path, label]
        return { path, pathKey: getPathKey(path), label, value, depth: row.depth + 1 }
      })
      for (let position = childRows.length - 1; position >= 0; position--) pending.push(childRows[position])
    }
  }
  return rows
}

// Expand all stops once this many rows would be on screen, so a huge file does not freeze the page.
export const EXPAND_ALL_ROW_LIMIT = 20_000

export function expandNodesUpToLimit(root: JsonValue): { expandedKeys: Set<string>; isLimited: boolean } {
  const expandedKeys = new Set<string>()
  let rowCount = 1
  const queue: { path: JsonPath; value: JsonValue }[] = [{ path: [], value: root }]
  for (let position = 0; position < queue.length; position++) {
    const { path, value } = queue[position]
    if (!isContainer(value)) continue
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

const downloadOption: ExportOption = {
  id: 'json',
  getLabel: () => 'Download JSON',
  extension: null,
  getMimeType: () => 'application/json;charset=utf-8',
  createFile: (edits, exportSource) => buildJsonDownload(edits as JsonEdits, exportSource as JsonExportSource),
}

export const jsonEditingModule: EditingModule = {
  tools: [],
  downloadOption,
  describeDownload: (exportSource) => `${(exportSource as JsonExportSource).originalText.length.toLocaleString()} characters`,
  getDefaultByteOrderMark: () => false,
  components: null,
}
