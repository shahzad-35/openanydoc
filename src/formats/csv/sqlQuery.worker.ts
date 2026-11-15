// The CSV page's query mode: the table goes into an in-memory SQLite database (sql.js, MIT) and a query runs on it, off the
// page's thread. The SQLite WebAssembly arrives with the first table (CsvQueryPanel bundles it as data), so nothing is fetched;
// the Content-Security-Policy allows WebAssembly with 'wasm-unsafe-eval'. Started by CsvQueryPanel, never from a module it imports.
import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'

export type SqlQueryRequest =
  | { kind: 'load'; sqliteWasm: ArrayBuffer | null; tableName: string; header: string[]; isNumberColumn: boolean[]; rows: string[][] }
  | { kind: 'run'; sql: string }
export type SqlQueryResponse = { kind: 'loaded' } | { kind: 'result'; columns: string[]; rows: string[][] } | { kind: 'error'; message: string }

let sqlJsReady: Promise<SqlJsStatic> | null = null
let database: Database | null = null

const quoteName = (name: string) => `"${name.replace(/"/g, '""')}"`

async function loadTable({ sqliteWasm, tableName, header, isNumberColumn, rows }: Extract<SqlQueryRequest, { kind: 'load' }>) {
  if (!sqlJsReady && sqliteWasm) sqlJsReady = initSqlJs({ wasmBinary: sqliteWasm })
  if (!sqlJsReady) throw new Error('SQLite is not loaded')
  const SQL = await sqlJsReady
  database?.close()
  database = new SQL.Database()
  const columnNames = header.map((name, position) => quoteName(name.trim() || `column_${position + 1}`))
  database.run(`CREATE TABLE ${quoteName(tableName)} (${columnNames.map((name, position) => `${name} ${isNumberColumn[position] ? 'REAL' : 'TEXT'}`).join(', ')})`)
  const insert = database.prepare(`INSERT INTO ${quoteName(tableName)} VALUES (${columnNames.map(() => '?').join(', ')})`)
  database.run('BEGIN')
  for (const row of rows) {
    insert.run(columnNames.map((_, position) => {
      const text = row[position] ?? ''
      if (!isNumberColumn[position]) return text
      // Number columns keep the number (thousands separators removed); an empty cell is NULL.
      return text.trim() === '' ? null : Number(text.replace(/,/g, ''))
    }))
  }
  database.run('COMMIT')
  insert.free()
}

self.onmessage = async (event: MessageEvent<SqlQueryRequest>) => {
  const request = event.data
  try {
    if (request.kind === 'load') {
      await loadTable(request)
      self.postMessage({ kind: 'loaded' } satisfies SqlQueryResponse)
      return
    }
    if (!database) throw new Error('No table loaded')
    // The last statement's result is the answer; statements without rows (UPDATE ...) give an empty result.
    const results = database.exec(request.sql)
    const lastResult = results.at(-1)
    const rows = (lastResult?.values ?? []).map((row) => row.map((value) => (value === null ? '' : value instanceof Uint8Array ? `[${value.length} bytes]` : String(value))))
    self.postMessage({ kind: 'result', columns: lastResult?.columns ?? [], rows } satisfies SqlQueryResponse)
  } catch (error) {
    self.postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) } satisfies SqlQueryResponse)
  }
}
