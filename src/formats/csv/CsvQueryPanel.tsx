import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { buildCsvText, buildXlsxBlob, readNumberOrText } from '../conversion'
import DataTable, { getRowNumberColumnWidthPx, measureColumnWidthsPx, useVisibleRowIds } from '../DataTable'
import type { DataTableHandle, SortState } from '../DataTable'
import { downloadTextFile } from '../registry'
import type { SqlQueryRequest, SqlQueryResponse } from './sqlQuery.worker'
import { readSqliteWasm } from './sqliteWasm'
type QueryResult = { columns: string[]; rows: string[][] }

// The result in the shared table (read-only, sortable by its headers, every row: the table draws only the rows on screen). Its
// ids carry "query-" so they never clash with the viewer's own grid.
function QueryResultTable({ result }: { result: QueryResult }) {
  const tableRef = useRef<DataTableHandle>(null)
  const [sort, setSort] = useState<SortState>(null)
  const columnIds = useMemo(() => result.columns.map((_, position) => position), [result])
  const rowIds = useMemo(() => result.rows.map((_, position) => position), [result])
  const readText = (rowId: number, columnId: number) => result.rows[rowId]?.[columnId] ?? ''
  const visibleRowIds = useVisibleRowIds({ rowIds, columnIds, searchText: '', sort, readText, dataKey: result })
  const columnWidthsPx = useMemo(() => measureColumnWidthsPx(columnIds, result.columns, 0, result.rows.length, (rowId, columnId) => result.rows[rowId]?.[columnId] ?? ''), [columnIds, result])
  return (
    <div className="query-result" dir="ltr">
      <DataTable
        tableRef={tableRef}
        idPrefix="query-"
        label="SQL"
        columnIds={columnIds}
        columnNames={result.columns}
        columnWidthsPx={columnWidthsPx}
        rowNumberWidthPx={getRowNumberColumnWidthPx(result.rows.length)}
        rowIds={visibleRowIds}
        getCellText={readText}
        getOriginalText={readText}
        dataKey={result}
        isCellEdited={() => false}
        showColumnLetters={false}
        selectedCell={null}
        sort={sort}
        onCycleSort={(columnId) => setSort((currentSort) => (currentSort?.columnId !== columnId ? { columnId, direction: 'asc' } : currentSort.direction === 'asc' ? { columnId, direction: 'desc' } : null))}
        isEditable={false}
        onCellClick={() => {}}
        onCellDoubleClick={() => {}}
        onKeyDown={() => {}}
        emptyMessage={null}
      />
    </div>
  )
}

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

  async function downloadResult(format: 'csv' | 'xlsx') {
    if (!result) return
    const baseName = fileName.replace(/\.[^.]+$/, '')
    if (format === 'csv') {
      downloadTextFile(`${baseName}-query.csv`, buildCsvText([result.columns, ...result.rows], ',', true), 'text/csv')
      return
    }
    const typedRows = result.rows.map((row) => row.map(readNumberOrText))
    downloadTextFile(`${baseName}-query.xlsx`, await buildXlsxBlob([{ sheetName: 'query', rows: [result.columns, ...typedRows] }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
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
          <button className="btn sm outline" id="query-download-button" type="button" disabled={!result || result.columns.length === 0} onClick={() => void downloadResult('csv')}>
            {t('csv.query.download')}
          </button>
          <button className="btn sm outline" id="query-download-excel-button" type="button" disabled={!result || result.columns.length === 0} onClick={() => void downloadResult('xlsx')}>
            {t('csv.query.downloadExcel')}
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
              {t('csv.query.rowCount', { rows: result.rows.length })}
            </div>
            <QueryResultTable result={result} />
          </>
        )}
      </div>
    </>
  )
}
