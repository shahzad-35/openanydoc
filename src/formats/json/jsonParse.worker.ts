import type { JsonSourceFormat } from './jsonFormats'
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

// `format`: a JSON Lines, JSON5 or YAML file is first turned into JSON text (jsonFormats.ts, fetched only then); the result then
// carries that text as `convertedText`, which the page shows and saves.
export type JsonParseRequest = { text: string; format: JsonSourceFormat }

self.onmessage = async (event: MessageEvent<JsonParseRequest>) => {
  const { format } = event.data
  let text = event.data.text
  let convertedText: string | undefined
  if (format !== 'json') {
    const converted = await (await import('./jsonFormats')).readSourceAsJsonText(text, format)
    if ('message' in converted) {
      postMessage({ status: 'error', message: converted.message, line: converted.line, column: null } satisfies JsonParseResult)
      return
    }
    text = converted.jsonText
    convertedText = converted.jsonText
  }
  let result: JsonParseResult
  try {
    const { value, bigNumberCount } = parseKeepingBigNumbers(text)
    result = { status: 'ok', value: value as JsonValue, bigNumberCount, convertedText }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result = { status: 'error', message, ...findErrorPosition(message, text) }
  }
  postMessage(result)
}
