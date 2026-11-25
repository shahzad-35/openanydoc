import { useEffect, useMemo, useState } from 'react'
import { dump } from 'js-yaml'
import { useToast } from '../../components/Messages'
import { useT } from '../../i18n'
import { readInputTables, readNumberOrText } from '../../formats/conversion'
import { buildFixedWidthText, buildHtmlTable, buildHtmlTableElement, buildLatexTable, buildMarkdownTable, buildSqlInserts, buildXmlRows, toSqlTableName } from '../../formats/csv/csvExport'
import { downloadTextFile } from '../../formats/registry'
import { findViewerForFileName } from '../../viewers'
import type { ToolProps } from '../registry'

// The CSV and Excel to SQL, XML, YAML, Markdown, HTML, LaTeX and fixed-width pages: the file is read as a table (an Excel sheet
// at a time, cells as Excel shows them, General numbers in full), and the text appears at once to copy or download, with that
// format's options. The builders are the CSV download dialog's (src/formats/csv/csvExport.ts); YAML is js-yaml's.

type TextFormat = 'sql' | 'xml' | 'yaml' | 'markdown' | 'html' | 'latex' | 'fixedWidth'
type InputTable = { sheetName: string; rows: string[][] }

const OUTPUT_FILES: Record<TextFormat, { extension: string; mimeType: string }> = {
  sql: { extension: '.sql', mimeType: 'application/sql;charset=utf-8' },
  xml: { extension: '.xml', mimeType: 'application/xml;charset=utf-8' },
  yaml: { extension: '.yaml', mimeType: 'application/yaml;charset=utf-8' },
  markdown: { extension: '.md', mimeType: 'text/markdown;charset=utf-8' },
  html: { extension: '.html', mimeType: 'text/html;charset=utf-8' },
  latex: { extension: '.tex', mimeType: 'application/x-tex;charset=utf-8' },
  fixedWidth: { extension: '.txt', mimeType: 'text/plain;charset=utf-8' },
}
// The box shows the start of a long result; Copy and Download always take all of it.
const MAX_PREVIEW_LINES = 5000

// One mapping per row; plain decimals become numbers ("007", phone numbers and long IDs stay text). js-yaml's default schema
// quotes strings another reader would take for a number, a boolean or a date (007, yes, on, 2026-01-01).
function buildYamlRows(rows: string[][]) {
  const [header = [], ...dataRows] = rows
  const keys = header.map((name, position) => name.trim() || `column_${position + 1}`)
  const records = dataRows.map((cells) => Object.fromEntries(keys.map((key, position) => [key, readNumberOrText(cells[position] ?? '')])))
  return dump(records, { lineWidth: -1, noRefs: true })
}

function TableToText({ format, files }: ToolProps & { format: TextFormat }) {
  const { locale, t } = useT()
  const { showToast } = useToast()
  const [tables, setTables] = useState<InputTable[]>([])
  const [readError, setReadError] = useState('')
  const [sheetName, setSheetName] = useState('')
  // null until the visitor types a table name; until then the name follows the chosen sheet.
  const [typedTableName, setTypedTableName] = useState<string | null>(null)
  const [rootName, setRootName] = useState('rows')
  const [rowName, setRowName] = useState('row')
  const [isFullHtmlPage, setIsFullHtmlPage] = useState(true)
  const [gapSize, setGapSize] = useState(2)
  const chosenFile = files.at(-1)

  useEffect(() => {
    if (!chosenFile) return
    let isCurrentFile = true
    void chosenFile.arrayBuffer().then(async (contents) => {
      const viewerId = findViewerForFileName(chosenFile.name)?.id === 'excel' ? 'excel' : 'csv'
      const result = await readInputTables(chosenFile, contents, viewerId, 'csv', locale)
      if (!isCurrentFile) return
      if (result.status === 'error') {
        setReadError(result.message)
        setTables([])
        return
      }
      const textTables = result.tables.map((table) => ({ sheetName: table.sheetName, rows: table.rows.map((row) => row.map((cell) => (cell === null ? '' : String(cell)))) }))
      setReadError('')
      setTables(textTables)
      setSheetName(textTables[0]?.sheetName ?? '')
      setTypedTableName(null)
    })
    return () => {
      isCurrentFile = false
    }
  }, [chosenFile, locale])

  const chosenTable = tables.find((table) => table.sheetName === sheetName) ?? tables[0]
  const tableName = typedTableName ?? toSqlTableName(chosenTable?.sheetName || chosenFile?.name || '')
  const outputText = useMemo(() => {
    if (!chosenTable || chosenTable.rows.length === 0) return ''
    const rows = chosenTable.rows
    if (format === 'sql') return buildSqlInserts(rows, tableName.trim() || 'data')
    if (format === 'xml') return buildXmlRows(rows, rootName, rowName)
    if (format === 'yaml') return buildYamlRows(rows)
    if (format === 'markdown') return buildMarkdownTable(rows)
    if (format === 'html') return isFullHtmlPage ? buildHtmlTable(rows, chosenTable.sheetName || chosenFile?.name || 'table') : buildHtmlTableElement(rows)
    if (format === 'latex') return buildLatexTable(rows)
    return buildFixedWidthText(rows, gapSize)
  }, [chosenTable, format, tableName, rootName, rowName, isFullHtmlPage, gapSize, chosenFile])
  const outputLines = outputText.split('\n')
  const previewText = outputLines.length > MAX_PREVIEW_LINES ? outputLines.slice(0, MAX_PREVIEW_LINES).join('\n') : outputText

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(outputText)
      showToast({ kind: 'success', message: t('tableText.copied') })
    } catch {
      showToast({ kind: 'error', message: t('json.status.copyNotAllowed') })
    }
  }

  function downloadOutput() {
    const fileBaseName = (chosenFile?.name ?? 'table').replace(/\.[^.]+$/, '')
    const baseName = chosenTable && tables.length > 1 ? `${fileBaseName}-${chosenTable.sheetName}` : fileBaseName
    downloadTextFile(`${baseName}${OUTPUT_FILES[format].extension}`, outputText, OUTPUT_FILES[format].mimeType)
  }

  if (readError) {
    return (
      <p id="table-text-error" role="alert" className="text-center font-medium text-danger">
        {readError}
      </p>
    )
  }
  if (!chosenTable) return null
  const inputClasses = 'mt-1 block w-full rounded-[12px] border-2 border-rule bg-paper-raised px-3 py-2 text-sm pointer-coarse:min-h-11'
  return (
    <div id="table-text-tool" className="space-y-4 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start">
      <div className="grid gap-3 sm:grid-cols-2">
        {tables.length > 1 && (
          <label htmlFor="table-text-sheet-select" className="text-sm font-semibold">
            {t('tableText.sheet')}
            <select id="table-text-sheet-select" value={chosenTable.sheetName} onChange={(event) => setSheetName(event.target.value)} className={inputClasses}>
              {tables.map((table) => (
                <option key={table.sheetName} value={table.sheetName}>
                  {table.sheetName}
                </option>
              ))}
            </select>
          </label>
        )}
        {format === 'sql' && (
          <label htmlFor="table-text-table-name-input" className="text-sm font-semibold">
            {t('tableText.tableName')}
            <input id="table-text-table-name-input" dir="ltr" value={tableName} onChange={(event) => setTypedTableName(event.target.value)} className={inputClasses} />
          </label>
        )}
        {format === 'xml' && (
          <>
            <label htmlFor="table-text-root-input" className="text-sm font-semibold">
              {t('tableText.rootName')}
              <input id="table-text-root-input" dir="ltr" value={rootName} onChange={(event) => setRootName(event.target.value)} className={inputClasses} />
            </label>
            <label htmlFor="table-text-row-input" className="text-sm font-semibold">
              {t('tableText.rowName')}
              <input id="table-text-row-input" dir="ltr" value={rowName} onChange={(event) => setRowName(event.target.value)} className={inputClasses} />
            </label>
          </>
        )}
        {format === 'html' && (
          <label htmlFor="table-text-html-select" className="text-sm font-semibold">
            {t('tableText.htmlOutput')}
            <select id="table-text-html-select" value={isFullHtmlPage ? 'page' : 'table'} onChange={(event) => setIsFullHtmlPage(event.target.value === 'page')} className={inputClasses}>
              <option value="page">{t('tableText.fullPage')}</option>
              <option value="table">{t('tableText.tableOnly')}</option>
            </select>
          </label>
        )}
        {format === 'fixedWidth' && (
          <label htmlFor="table-text-gap-select" className="text-sm font-semibold">
            {t('tableText.gap')}
            <select id="table-text-gap-select" value={gapSize} onChange={(event) => setGapSize(Number(event.target.value))} className={inputClasses}>
              {[1, 2, 3, 4].map((size) => (
                <option key={size} value={size}>
                  {t('tableText.spaces', { count: size })}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div>
        <label htmlFor="table-text-output" className="block text-sm font-semibold">
          {t('tableText.result', { rows: Math.max(0, chosenTable.rows.length - 1), columns: chosenTable.rows[0]?.length ?? 0 })}
        </label>
        <textarea id="table-text-output" dir="ltr" readOnly rows={14} wrap="off" spellCheck={false} value={previewText} className="mt-1 w-full rounded-[14px] border-2 border-rule bg-surface p-3 font-mono text-sm" />
        {outputLines.length > MAX_PREVIEW_LINES && (
          <p id="table-text-preview-note" className="mt-1 text-sm text-ink-soft">
            {t('tableText.previewNote', { shown: MAX_PREVIEW_LINES, total: outputLines.length })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button id="table-text-copy-button" type="button" disabled={outputText === ''} onClick={() => void copyOutput()} className="btn btn--primary btn--compact press">
          {t('tableText.copy')}
        </button>
        <button id="table-text-download-button" type="button" disabled={outputText === ''} onClick={downloadOutput} className="btn btn--quiet btn--compact press">
          {t('tableText.download', { extension: OUTPUT_FILES[format].extension })}
        </button>
      </div>
    </div>
  )
}

export const TableToSql = (props: ToolProps) => <TableToText {...props} format="sql" />
export const TableToXml = (props: ToolProps) => <TableToText {...props} format="xml" />
export const TableToYaml = (props: ToolProps) => <TableToText {...props} format="yaml" />
export const TableToMarkdown = (props: ToolProps) => <TableToText {...props} format="markdown" />
export const TableToHtml = (props: ToolProps) => <TableToText {...props} format="html" />
export const TableToLatex = (props: ToolProps) => <TableToText {...props} format="latex" />
export const TableToFixedWidth = (props: ToolProps) => <TableToText {...props} format="fixedWidth" />
