import { parseKeepingBigNumbers } from './jsonTools'
import type { JsonParseResult, JsonValue } from './jsonModel'

// Line and column (both counted from 1) of a character position in the text.
function findLineAndColumn(text: string, position: number) {
  let line = 1
  let lineStart = 0
  for (let newline = text.indexOf('\n'); newline !== -1 && newline < position; newline = text.indexOf('\n', newline + 1)) {
    line++
    lineStart = newline + 1
  }
  return { line, column: position - lineStart + 1 }
}

// Chrome and Firefox say where the error is in their messages; Safari does not, so there the position stays unknown.
function findErrorPosition(message: string, text: string) {
  const lineAndColumn = message.match(/line (\d+) column (\d+)/)
  if (lineAndColumn) return { line: Number(lineAndColumn[1]), column: Number(lineAndColumn[2]) }
  const characterPosition = message.match(/position (\d+)/)
  if (characterPosition) return findLineAndColumn(text, Number(characterPosition[1]))
  if (/end of (JSON input|data)/i.test(message)) return findLineAndColumn(text, text.length)
  return { line: null, column: null }
}

self.onmessage = (event: MessageEvent<string>) => {
  const text = event.data
  let result: JsonParseResult
  try {
    const { value, bigNumberCount } = parseKeepingBigNumbers(text)
    result = { status: 'ok', value: value as JsonValue, bigNumberCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result = { status: 'error', message, ...findErrorPosition(message, text) }
  }
  postMessage(result)
}
