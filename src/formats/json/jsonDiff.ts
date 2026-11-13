// Comparing JSON: two documents node by node (Compare), each document written out with the path of every line (so differences
// can be marked line by line), and two texts line by line (Repair's preview). Pure functions, so a future "Compare JSON" page can
// use them too.
import { isBigNumber } from './jsonTools'
import type { JsonPath, JsonValue } from './jsonModel'

export type JsonDifference = { path: JsonPath; kind: 'added' | 'removed' | 'changed' | 'reordered' }

const isObject = (value: JsonValue): value is { [key: string]: JsonValue } => typeof value === 'object' && value !== null && !Array.isArray(value) && !isBigNumber(value)
// A big number compares by its exact text; everything else by type and value.
const sameLeaf = (left: JsonValue, right: JsonValue) => (isBigNumber(left) || isBigNumber(right) ? JSON.stringify(left) === JSON.stringify(right) : left === right)

// What changed from `left` to `right`: objects by key, arrays position by position. With `ignoreKeyOrder` off, an object whose
// keys are the same but in another order is reported as reordered.
export function diffJson(left: JsonValue, right: JsonValue, ignoreKeyOrder: boolean, path: JsonPath = [], differences: JsonDifference[] = []): JsonDifference[] {
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    for (const key of leftKeys) {
      if (!(key in right)) differences.push({ path: [...path, key], kind: 'removed' })
      else diffJson(left[key], right[key], ignoreKeyOrder, [...path, key], differences)
    }
    for (const key of rightKeys) if (!(key in left)) differences.push({ path: [...path, key], kind: 'added' })
    if (!ignoreKeyOrder) {
      const sharedLeft = leftKeys.filter((key) => key in right)
      const sharedRight = rightKeys.filter((key) => key in left)
      if (sharedLeft.join('\u0000') !== sharedRight.join('\u0000')) differences.push({ path, kind: 'reordered' })
    }
    return differences
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let position = 0; position < Math.max(left.length, right.length); position++) {
      if (position >= right.length) differences.push({ path: [...path, position], kind: 'removed' })
      else if (position >= left.length) differences.push({ path: [...path, position], kind: 'added' })
      else diffJson(left[position], right[position], ignoreKeyOrder, [...path, position], differences)
    }
    return differences
  }
  if (Array.isArray(left) !== Array.isArray(right) || isObject(left) !== isObject(right) || !sameLeaf(left, right)) differences.push({ path, kind: 'changed' })
  return differences
}

export type PathLine = { text: string; path: JsonPath }

// The document as indented JSON (2 spaces), each line with the path of the node it starts or ends. Keys keep their order, or are
// sorted when the comparison ignores key order, so equal objects line up.
export function formatWithPaths(value: JsonValue, sortKeys: boolean): PathLine[] {
  const lines: PathLine[] = []
  const write = (node: JsonValue, path: JsonPath, indent: string, label: string, isLast: boolean) => {
    const comma = isLast ? '' : ','
    if (Array.isArray(node) || isObject(node)) {
      const entries: [string | number, JsonValue][] = Array.isArray(node) ? node.map((child, position) => [position, child]) : (sortKeys ? Object.keys(node).sort() : Object.keys(node)).map((key) => [key, node[key]])
      const [open, close] = Array.isArray(node) ? ['[', ']'] : ['{', '}']
      if (entries.length === 0) {
        lines.push({ text: `${indent}${label}${open}${close}${comma}`, path })
        return
      }
      lines.push({ text: `${indent}${label}${open}`, path })
      entries.forEach(([step, child], position) => write(child, [...path, step], `${indent}  `, typeof step === 'string' ? `${JSON.stringify(step)}: ` : '', position === entries.length - 1))
      lines.push({ text: `${indent}${close}${comma}`, path })
      return
    }
    lines.push({ text: `${indent}${label}${JSON.stringify(node)}${comma}`, path })
  }
  write(value, [], '', '', true)
  return lines
}

export type LineChange = { kind: 'removed' | 'added'; lineNumber: number; text: string }

// Two texts line by line (longest common subsequence), as the removed and added lines with their line numbers in the old and new
// text. Long texts are compared only in the part that differs, after the shared first and last lines.
export function diffLines(oldText: string, newText: string, maxChanges: number): LineChange[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  let start = 0
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++
  let oldEnd = oldLines.length
  let newEnd = newLines.length
  while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  const oldMiddle = oldLines.slice(start, oldEnd)
  const newMiddle = newLines.slice(start, newEnd)
  const changes: LineChange[] = []
  // A middle too large to compare cell by cell is shown as all its old lines removed and all its new lines added.
  if (oldMiddle.length * newMiddle.length > 4_000_000) {
    oldMiddle.forEach((text, position) => changes.push({ kind: 'removed', lineNumber: start + position + 1, text }))
    newMiddle.forEach((text, position) => changes.push({ kind: 'added', lineNumber: start + position + 1, text }))
    return changes.slice(0, maxChanges)
  }
  const lengths = Array.from({ length: oldMiddle.length + 1 }, () => new Uint32Array(newMiddle.length + 1))
  for (let oldPosition = oldMiddle.length - 1; oldPosition >= 0; oldPosition--) {
    for (let newPosition = newMiddle.length - 1; newPosition >= 0; newPosition--) {
      lengths[oldPosition][newPosition] = oldMiddle[oldPosition] === newMiddle[newPosition] ? lengths[oldPosition + 1][newPosition + 1] + 1 : Math.max(lengths[oldPosition + 1][newPosition], lengths[oldPosition][newPosition + 1])
    }
  }
  let oldPosition = 0
  let newPosition = 0
  while ((oldPosition < oldMiddle.length || newPosition < newMiddle.length) && changes.length < maxChanges) {
    if (oldPosition < oldMiddle.length && newPosition < newMiddle.length && oldMiddle[oldPosition] === newMiddle[newPosition]) {
      oldPosition++
      newPosition++
    } else if (oldPosition < oldMiddle.length && (newPosition === newMiddle.length || lengths[oldPosition + 1][newPosition] >= lengths[oldPosition][newPosition + 1])) {
      // On a tie the old line goes first, so a changed line reads as removed, then added.
      changes.push({ kind: 'removed', lineNumber: start + oldPosition + 1, text: oldMiddle[oldPosition] })
      oldPosition++
    } else {
      changes.push({ kind: 'added', lineNumber: start + newPosition + 1, text: newMiddle[newPosition] })
      newPosition++
    }
  }
  return changes
}
