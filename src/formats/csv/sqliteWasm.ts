// SQLite's WebAssembly (sql.js), bundled as a data: address (vite.config.ts inlines this one file), so it is decoded here and never
// fetched; the page hands it to sqlQuery.worker.ts. Used by the CSV viewer's SQL tab and SQL to CSV (src/formats/conversion.ts).
import sqliteWasmDataUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import type { SqlQueryResponse } from './sqlQuery.worker'

// The built site gets a data: address and decodes it (no request). Only the dev server (npm run dev) gives a file address, and
// there it is read from the dev server; that branch is removed from the build.
export async function readSqliteWasm(): Promise<ArrayBuffer> {
  if (import.meta.env.DEV && !sqliteWasmDataUrl.startsWith('data:')) return (await fetch(sqliteWasmDataUrl)).arrayBuffer()
  return Uint8Array.from(atob(sqliteWasmDataUrl.slice(sqliteWasmDataUrl.indexOf(',') + 1)), (character) => character.charCodeAt(0)).buffer
}

// SQL to CSV: MySQL and PostgreSQL (pg_dump --inserts) dumps are made readable by SQLite first (backtick names, table options,
// LOCK/SET lines, versioned comments; pg_dump's settings, owners, sequences, constraints and schema names), then the script runs
// in a worker and the largest table it made comes back as rows.
export async function readTableFromSqlScript(sqlText: string): Promise<{ columns: string[]; rows: string[][] }> {
  const sqliteSql = sqlText
    .replace(/\/\*![\s\S]*?\*\/;?/g, '')
    .replace(/^\s*(LOCK TABLES|UNLOCK TABLES|SET |USE |DELIMITER ).*$/gim, '')
    .replace(/^\s*(SELECT pg_catalog\.|ALTER |COMMENT ON |GRANT |REVOKE |CREATE SEQUENCE |CREATE (UNIQUE )?INDEX |CREATE SCHEMA )[\s\S]*?;\s*$/gim, '')
    .replace(/\bpublic\./g, '')
    .replace(/\s+DEFAULT nextval\('[^']*'(::regclass)?\)/gi, '')
    .replace(/`([^`]*)`/g, (_match, name: string) => `"${name.replace(/"/g, '""')}"`)
    .replace(/\)\s*(ENGINE|DEFAULT CHARSET|AUTO_INCREMENT|COLLATE|CHARSET|COMMENT)\b[^;]*;/gi, ');')
    .replace(/\bAUTO_INCREMENT\b/gi, '')
    .replace(/\bUNSIGNED\b/gi, '')
  const worker = new Worker(new URL('./sqlQuery.worker.ts', import.meta.url), { type: 'module' })
  try {
    const sqliteWasm = await readSqliteWasm()
    const response = await new Promise<SqlQueryResponse>((resolve) => {
      worker.onmessage = (event: MessageEvent<SqlQueryResponse>) => resolve(event.data)
      worker.onerror = () => resolve({ kind: 'error', message: 'SQLite could not start.' })
      worker.postMessage({ kind: 'script', sqliteWasm, sql: sqliteSql })
    })
    if (response.kind === 'error') throw new Error(response.message)
    if (response.kind !== 'result') throw new Error('No table')
    return { columns: response.columns, rows: response.rows }
  } finally {
    worker.terminate()
  }
}
