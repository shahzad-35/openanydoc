import { parseCsv } from '../../parseCsv'
import type { DelimiterChoice, ParsedCsv } from '../../parseCsv'
import type { EncodingChoice } from '../text/textEditing'

export type CsvParseRequest = { contents: ArrayBuffer; delimiterChoice: DelimiterChoice; encodingChoice: EncodingChoice }
// The rows come back in batches, then the rest of the result without them: copying 120,000 rows in one message took the page
// about 100 ms in one go, long enough to delay a click; each batch takes a few milliseconds.
export type CsvParseMessage = { kind: 'rows'; rows: string[][] } | { kind: 'done'; parsedCsv: ParsedCsv }

const ROWS_PER_MESSAGE = 10_000

self.onmessage = (event: MessageEvent<CsvParseRequest>) => {
  const { contents, delimiterChoice, encodingChoice } = event.data
  const parsedCsv = parseCsv(contents, delimiterChoice, encodingChoice)
  if (parsedCsv.status === 'ok') {
    for (let start = 0; start < parsedCsv.rows.length; start += ROWS_PER_MESSAGE) {
      self.postMessage({ kind: 'rows', rows: parsedCsv.rows.slice(start, start + ROWS_PER_MESSAGE) } satisfies CsvParseMessage)
    }
    self.postMessage({ kind: 'done', parsedCsv: { ...parsedCsv, rows: [] } } satisfies CsvParseMessage)
  } else {
    self.postMessage({ kind: 'done', parsedCsv } satisfies CsvParseMessage)
  }
}
