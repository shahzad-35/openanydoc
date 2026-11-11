import { readWorkbookFile } from './excelModel'
import type { ParsedWorkbook } from './excelModel'

export type ExcelParseRequest = { contents: ArrayBuffer; fileName: string }
export type ExcelParseMessage = { status: 'ok'; parsed: ParsedWorkbook } | { status: 'error'; reason: string }

self.onmessage = (event: MessageEvent<ExcelParseRequest>) => {
  const { contents, fileName } = event.data
  let message: ExcelParseMessage
  try {
    message = { status: 'ok', parsed: readWorkbookFile(contents, fileName) }
  } catch (error) {
    message = { status: 'error', reason: error instanceof Error ? error.message : '' }
  }
  self.postMessage(message)
}
