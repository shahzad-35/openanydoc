// Puts the original values back into a masked document from its private key file: whole-cell tokens get their original type,
// tokens inside text get their original text. Partial masks and removed fields cannot come back. No browser imports.
import { BIG_NUMBER_MARK } from '../json/jsonTools.ts'
import { isMarkedBigNumber } from './detectSensitiveData.ts'
import type { CellValue, MaskDocument } from './detectSensitiveData.ts'
import { TOKEN_PATTERN } from './maskData.ts'
import type { TokenKey, TokenKeyEntry } from './maskData.ts'

export type RestoreResult = { document: MaskDocument; restoredCount: number; unknownTokenCount: number }

// The key file as written by the Mask Data page, or null when the text is something else.
export function parseKeyFile(keyText: string): TokenKey | null {
  try {
    const key = JSON.parse(keyText.replace(/^﻿/, ''))
    const isKey = key?.format === 'openanydoc-mask-key' && key.version === 1 && typeof key.tokens === 'object' && key.tokens !== null
    if (!isKey) return null
    const entries = Object.values(key.tokens) as TokenKeyEntry[]
    return entries.every((entry) => typeof entry?.value === 'string' && ['string', 'number', 'boolean', 'date'].includes(entry.type)) ? key : null
  } catch {
    return null
  }
}

function toOriginalValue(entry: TokenKeyEntry, isJson: boolean): unknown {
  if (entry.type === 'date') return isJson ? entry.value : new Date(entry.value)
  if (entry.type === 'boolean') return entry.value === 'true'
  if (entry.type === 'number') {
    const number = Number(entry.value)
    // A number JSON cannot hold exactly (a long ID) goes back in its marked form, so it is written digit for digit.
    return isJson && String(number) !== entry.value ? { [BIG_NUMBER_MARK]: entry.value } : number
  }
  return entry.value
}

export function restoreDocument(document: MaskDocument, key: TokenKey): RestoreResult {
  let restoredCount = 0
  let unknownTokenCount = 0
  const isJson = document.kind === 'json'

  function restoreValue(value: unknown): unknown {
    if (typeof value !== 'string') return value
    const wholeEntry = key.tokens[value.trim()]
    if (wholeEntry && /^[A-Z]+-\d{6}$/.test(value.trim())) {
      restoredCount++
      return toOriginalValue(wholeEntry, isJson)
    }
    return value.replace(TOKEN_PATTERN, (token) => {
      const entry = key.tokens[token]
      if (!entry) {
        unknownTokenCount++
        return token
      }
      restoredCount++
      return entry.value
    })
  }

  function restoreJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(restoreJsonValue)
    if (typeof value === 'object' && value !== null && !isMarkedBigNumber(value)) return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, restoreJsonValue(child)]))
    return restoreValue(value)
  }

  const restoredDocument: MaskDocument =
    document.kind === 'text'
      ? { kind: 'text', text: restoreValue(document.text) as string }
      : document.kind === 'json'
      ? { kind: 'json', root: restoreJsonValue(document.root) }
      : { ...document, tables: document.tables.map((table) => ({ ...table, rows: table.rows.map((row) => row.map((cell) => restoreValue(cell) as CellValue)) })) }
  return { document: restoredDocument, restoredCount, unknownTokenCount }
}
