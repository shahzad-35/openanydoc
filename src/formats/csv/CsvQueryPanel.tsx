import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { buildCsvText } from '../conversion'
import { downloadTextFile } from '../registry'
import type { SqlQueryRequest, SqlQueryResponse } from './sqlQuery.worker'
// SQLite's WebAssembly (sql.js), bundled as a data: address (vite.config.ts inlines this one file), so it is decoded here and never
// fetched; sent to the worker with the first table.
import sqliteWasmDataUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'

// The built site gets a data: address and decodes it (no request). Only the dev server (npm run dev) gives a file address, and
// there it is read from the dev server; that branch is removed from the build.
async function readSqliteWasm(): Promise<ArrayBuffer> {
  if (import.meta.env.DEV && !sqliteWasmDataUrl.startsWith('data:')) return (await fetch(sqliteWasmDataUrl)).arrayBuffer()
  return Uint8Array.from(atob(sqliteWasmDataUrl.slice(sqliteWasmDataUrl.indexOf(',') + 1)), (character) => character.charCodeAt(0)).buffer
}

const MAX_SHOWN_RESULT_ROWS = 200

type QueryResult = { columns: string[]; rows: string[][] }

// The CSV page's query mode: SQL on the open table, run by SQLite in a worker (sqlQuery.worker.ts). The table goes to the worker
// on the first run and again whenever it changed (`tableKey`). Loaded when its panel opens; a future "Query CSV with SQL" page can
// use it with the same props.
export default function CsvQueryPanel({ tableKey, readTable, isNumberColumn, defaultTableName, fileName }: {
  tableKey: unknown
  // The whole table with its edits: the header, then every row (not only the filtered ones).
  readTable: () => string[][]
  isNumberColumn: boolean[]
  defaultTableName: string
  fileName: string
}) {
  const { t } = useT()
  const [tableName, setTableName] = useState(defaultTableName)
  const [sql, setSql] = useState(() => `SELECT * FROM "${defaultTableName}" LIMIT 100`)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const workerRef = useRef<Worker | null>(null)
  const loadedRef = useRef<{ tableKey: unknown; tableName: string } | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('./sqlQuery.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
      loadedRef.current = null
    }
  }, [])

  function ask(request: SqlQueryRequest) {
    const worker = workerRef.current
    if (!worker) return Promise.resolve<SqlQueryResponse>({ kind: 'error', message: '' })
    return new Promise<SqlQueryResponse>((resolve) => {
      worker.onmessage = (event: MessageEvent<SqlQueryResponse>) => resolve(event.data)
      worker.onerror = () => resolve({ kind: 'error', message: t('csv.query.failed') })
      worker.postMessage(request)
    })
  }

  // Every failure ends the run with its message, so the button never stays on "Running…".
  async function runQuery() {
    setIsRunning(true)
    setErrorMessage('')
    try {
      const chosenTableName = tableName.trim() || defaultTableName
      if (loadedRef.current?.tableKey !== tableKey || loadedRef.current?.tableName !== chosenTableName) {
        const [header = [], ...rows] = readTable()
        const loaded = await ask({ kind: 'load', sqliteWasm: loadedRef.current ? null : await readSqliteWasm(), tableName: chosenTableName, header, isNumberColumn, rows })
        if (loaded.kind === 'error') throw new Error(loaded.message || t('csv.query.failed'))
        loadedRef.current = { tableKey, tableName: chosenTableName }
      }
      const answer = await ask({ kind: 'run', sql })
      if (answer.kind === 'error') throw new Error(answer.message || t('csv.query.failed'))
      if (answer.kind === 'result') setResult({ columns: answer.columns, rows: answer.rows })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsRunning(false)
    }
  }

  function downloadResult() {
    if (!result) return
    const baseName = fileName.replace(/\.[^.]+$/, '')
    downloadTextFile(`${baseName}-query.csv`, buildCsvText([result.columns, ...result.rows], ',', true), 'text/csv')
  }

  return (
    <>
      <div className="sec">
        <label className="field">
          {t('csv.query.tableName')}
          <input id="query-table-name-input" type="text" dir="ltr" value={tableName} onChange={(event) => setTableName(event.target.value)} />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          {t('csv.query.sql')}
          <textarea
            id="query-sql-input"
            dir="ltr"
            rows={5}
            spellCheck={false}
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                void runQuery()
              }
            }}
            className="query-sql"
          />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button className="btn sm primary" id="query-run-button" type="button" disabled={isRunning || sql.trim() === ''} onClick={() => void runQuery()}>
            {isRunning ? t('csv.query.running') : t('csv.query.run')}
          </button>
          <button className="btn sm outline" id="query-download-button" type="button" disabled={!result || result.columns.length === 0} onClick={downloadResult}>
            {t('csv.query.download')}
          </button>
        </div>
        <div className="small-note" style={{ marginTop: 8 }}>
          {t('csv.query.note')}
        </div>
      </div>
      <div className="sec">
        {errorMessage && (
          <p id="query-error" role="alert" className="query-error" dir="ltr">
            {errorMessage}
          </p>
        )}
        {result && !errorMessage && (
          <>
            <div className="small-note" id="query-result-count">
              {t('csv.query.resultCount', { rows: result.rows.length, shown: Math.min(result.rows.length, MAX_SHOWN_RESULT_ROWS) })}
            </div>
            <div className="query-result" dir="ltr">
              <table id="query-result-table">
                <thead>
                  <tr>
                    {result.columns.map((column, position) => (
                      <th key={position}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, MAX_SHOWN_RESULT_ROWS).map((row, rowPosition) => (
                    <tr key={rowPosition}>
                      {row.map((cell, position) => (
                        <td key={position} dir="auto">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
