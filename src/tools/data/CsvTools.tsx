import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Papa from 'papaparse'
import { useT } from '../../i18n'
import { DELIMITER_OPTIONS, parseCsv } from '../../parseCsv'
import type { DelimiterChoice } from '../../parseCsv'
import { appendTables, compareByKey } from '../../formats/csv/csvCombine'
import { decodeTextBytes, encodeText } from '../../formats/text/textEditing'
import type { EncodingChoice, TextDownloadEncoding } from '../../formats/text/textEditing'
import { downloadTextFile } from '../../formats/registry'
import type { ToolProps } from '../registry'

// The CSV file tools on their own pages: Merge CSV, Compare CSV, Change CSV encoding and Change CSV delimiter. Files are read on
// the page with the CSV viewer's reader (parseCsv: delimiter and encoding found as the viewer finds them); nothing is stored.

const boxClasses = 'space-y-4 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start'
const fieldClasses = 'mt-1 block w-full rounded-[12px] border-2 border-rule bg-paper-raised px-3 py-2 text-sm pointer-coarse:min-h-11'
const labelClasses = 'text-sm font-semibold'
const tableClasses = 'w-full border-collapse text-sm [&_td]:border-b [&_td]:border-rule [&_td]:px-2 [&_td]:py-1 [&_th]:border-b-2 [&_th]:border-rule [&_th]:px-2 [&_th]:py-1 [&_th]:text-start'
const MAX_SHOWN_ROWS = 100

// An Excel workbook (Compare Excel) is read as its sheets' shown text; `rows` is its first sheet.
type ReadCsv = { fileName: string; rows: string[][]; delimiter: string; encodingLabel: string; usesCrlf: boolean; sheets?: { name: string; rows: string[][] }[] } | { fileName: string; error: true }

async function readCsvFile(file: File, delimiterChoice: DelimiterChoice = 'auto', encodingChoice: EncodingChoice = 'auto'): Promise<ReadCsv> {
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
    try {
      const [XLSX, { showFullGeneralNumbers }] = await Promise.all([import('xlsx'), import('../../formats/conversion')])
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellNF: true })
      const sheets = workbook.SheetNames.map((name) => {
        showFullGeneralNumbers(workbook.Sheets[name])
        return { name, rows: XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false }) }
      }).filter((sheet) => sheet.rows.length > 0)
      if (sheets.length === 0) return { fileName: file.name, error: true }
      return { fileName: file.name, rows: sheets[0].rows, delimiter: '', encodingLabel: '', usesCrlf: false, sheets }
    } catch {
      return { fileName: file.name, error: true }
    }
  }
  const parsed = parseCsv(await file.arrayBuffer(), delimiterChoice, encodingChoice)
  if (parsed.status === 'error') return { fileName: file.name, error: true }
  return { fileName: file.name, rows: parsed.rows, delimiter: parsed.detectedDelimiter, encodingLabel: parsed.encodingLabel, usesCrlf: parsed.usesCrlf }
}

// Reads every chosen file whenever the list changes; the newest answer wins.
function useReadCsvFiles(files: File[]) {
  const [readFiles, setReadFiles] = useState<ReadCsv[]>([])
  useEffect(() => {
    let isCurrent = true
    void Promise.all(files.map((file) => readCsvFile(file))).then((answers) => isCurrent && setReadFiles(answers))
    return () => {
      isCurrent = false
    }
  }, [files])
  return readFiles
}

const hasNonAsciiText = (rows: string[][]) => rows.some((row) => row.some((cellText) => /[^\p{ASCII}]/u.test(cellText)))
const baseNameOf = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

function PreviewLines({ id, label, text }: { id: string; label: string; text: string }) {
  return (
    <div>
      <p className={labelClasses}>{label}</p>
      <pre id={id} dir="ltr" className="mt-1 max-h-60 overflow-auto rounded-[14px] bg-surface p-3 font-mono text-sm">
        {text.split(/\r?\n/).slice(0, 8).map((line, position) => (
          <bdi key={position} dir="auto" className="block whitespace-pre">
            {line || ' '}
          </bdi>
        ))}
      </pre>
    </div>
  )
}

function SmallTable({ id, header, rows, renderCell }: { id: string; header: string[]; rows: string[][]; renderCell?: (text: string, rowPosition: number, columnPosition: number) => ReactNode }) {
  return (
    <div className="max-h-80 overflow-auto rounded-[14px] border-2 border-rule">
      <table id={id} className={tableClasses}>
        <thead>
          <tr>
            {header.map((name, position) => (
              <th key={position} dir="auto">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, MAX_SHOWN_ROWS).map((row, rowPosition) => (
            <tr key={rowPosition}>
              {header.map((_, columnPosition) => (
                <td key={columnPosition} dir="auto">
                  {renderCell ? renderCell(row[columnPosition] ?? '', rowPosition, columnPosition) : (row[columnPosition] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- Merge CSV

export function MergeCsv({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t, tp } = useT()
  const readFiles = useReadCsvFiles(files)
  const readableFiles = readFiles.filter((readFile): readFile is Extract<ReadCsv, { rows: string[][] }> => !('error' in readFile))
  const merged = readableFiles.length === readFiles.length && readableFiles.length > 0 ? appendTables(readableFiles[0].rows, readableFiles.slice(1).map((readFile) => ({ fileName: readFile.fileName, rows: readFile.rows }))) : null

  function moveFile(position: number, offset: number) {
    const reordered = [...files]
    const [moved] = reordered.splice(position, 1)
    reordered.splice(position + offset, 0, moved)
    onFilesChange(reordered)
  }

  function mergeFiles() {
    if (!merged || !('rows' in merged)) return
    const csvText = Papa.unparse(merged.rows, { newline: '\r\n' })
    onResult(new File([`${hasNonAsciiText(merged.rows) ? '﻿' : ''}${csvText}\r\n`], 'merged.csv', { type: 'text/csv' }))
  }

  return (
    <div id="merge-csv-tool" className={boxClasses}>
      <ol id="merge-csv-file-list" className="space-y-2">
        {files.map((file, position) => {
          const readFile = readFiles[position]
          return (
            <li key={`${file.name}-${position}`} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-surface px-3 py-2">
              <bdi className="min-w-0 flex-1 truncate font-semibold">{file.name}</bdi>
              <span className="text-sm text-ink-soft">{readFile && ('error' in readFile ? t('csvTools.unreadable') : tp('csvTools.rowCount', readFile.rows.length - 1))}</span>
              <button id={`merge-csv-up-button-${position}`} type="button" disabled={position === 0} onClick={() => moveFile(position, -1)} className="btn btn--quiet btn--compact press" aria-label={t('csvTools.moveUp', { name: file.name })}>
                ↑
              </button>
              <button id={`merge-csv-down-button-${position}`} type="button" disabled={position === files.length - 1} onClick={() => moveFile(position, 1)} className="btn btn--quiet btn--compact press" aria-label={t('csvTools.moveDown', { name: file.name })}>
                ↓
              </button>
              <button id={`merge-csv-remove-button-${position}`} type="button" onClick={() => onFilesChange(files.filter((_, otherPosition) => otherPosition !== position))} className="btn btn--quiet btn--compact press" aria-label={t('csvTools.remove', { name: file.name })}>
                ×
              </button>
            </li>
          )
        })}
      </ol>
      {merged && 'differingFileName' in merged && (
        <p id="merge-csv-mismatch" role="alert" className="text-sm font-semibold text-danger">
          {t('csvTools.merge.mismatch', { name: merged.differingFileName, first: files[0]?.name ?? '' })}
        </p>
      )}
      {merged && 'rows' in merged && (
        <p id="merge-csv-summary" role="status" className="text-sm">
          {tp('csvTools.merge.summary', merged.rows.length - 1, { files: files.length })}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button id="merge-csv-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet btn--compact press">
          {t('csvTools.merge.add')}
        </button>
        <button id="merge-csv-merge-button" type="button" disabled={!merged || !('rows' in merged) || files.length < 2} onClick={mergeFiles} className="btn btn--primary btn--compact press">
          {t('csvTools.merge.merge')}
        </button>
      </div>
      {files.length < 2 && <p className="text-sm text-ink-soft">{t('csvTools.merge.needTwo')}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- Compare CSV

export function CompareCsv({ files, onAddFiles }: ToolProps) {
  const { t, tp } = useT()
  // The last two files chosen: the first of them is the old version, the second the new one.
  const readFiles = useReadCsvFiles(files).slice(-2)
  const [readOld, readNew] = readFiles.length === 2 && readFiles.every((readFile) => !('error' in readFile)) ? (readFiles as Extract<ReadCsv, { rows: string[][] }>[]) : [null, null]
  // A workbook's sheet is chosen per file (by position in its sheet list).
  const [sheetChoices, setSheetChoices] = useState<[number, number]>([0, 0])
  const withChosenSheet = (readFile: Extract<ReadCsv, { rows: string[][] }> | null, choice: number) => (readFile?.sheets?.[choice] ? { ...readFile, rows: readFile.sheets[choice].rows } : readFile)
  const oldFile = useMemo(() => withChosenSheet(readOld, sheetChoices[0]), [readOld, sheetChoices])
  const newFile = useMemo(() => withChosenSheet(readNew, sheetChoices[1]), [readNew, sheetChoices])
  const sharedColumns = oldFile && newFile ? newFile.rows[0].map((name) => name.trim()).filter((name) => oldFile.rows[0].map((oldName) => oldName.trim()).includes(name)) : []
  const [chosenKey, setChosenKey] = useState('')
  const keyColumn = sharedColumns.includes(chosenKey) ? chosenKey : (sharedColumns.find((name) => /(^|[\s_-])id$|^id([\s_-]|$)|^key$|^code$/i.test(name)) ?? sharedColumns[0] ?? '')
  const oldRows = oldFile?.rows
  const newRows = newFile?.rows
  const comparison = useMemo(() => (oldRows && newRows && keyColumn ? compareByKey(oldRows, newRows, keyColumn) : null), [oldRows, newRows, keyColumn])

  function downloadDifferences() {
    if (!comparison || !newFile) return
    const changeLabel = { added: t('csvTools.compare.added'), removed: t('csvTools.compare.removed'), changed: t('csvTools.compare.changed') }
    const differenceRows = [
      [t('csvTools.compare.changeColumn'), ...comparison.header],
      ...comparison.addedRows.map((row) => [changeLabel.added, ...row]),
      ...comparison.removedRows.map((row) => [changeLabel.removed, ...row]),
      ...comparison.changedRows.map((changedRow) => [changeLabel.changed, ...comparison.header.map((name, position) => {
        const change = changedRow.changes.find((candidate) => candidate.column === name)
        return change ? `${change.oldText} → ${change.newText}` : (changedRow.newRow[position] ?? '')
      })]),
    ]
    downloadTextFile(`${baseNameOf(newFile.fileName)}-differences.csv`, `﻿${Papa.unparse(differenceRows, { newline: '\r\n' })}\r\n`, 'text/csv;charset=utf-8')
  }

  if (files.length < 2) {
    return (
      <div id="compare-csv-tool" className={boxClasses}>
        <p id="compare-csv-need-two" className="text-sm">
          {files.length === 1 ? t('csvTools.compare.chooseNew', { name: files[0].name }) : t('csvTools.compare.chooseTwo')}
        </p>
        <button id="compare-csv-add-button" type="button" onClick={onAddFiles} className="btn btn--primary btn--compact press">
          {t('csvTools.compare.add')}
        </button>
      </div>
    )
  }
  if (readFiles.some((readFile) => 'error' in readFile)) return <p id="compare-csv-error" role="alert" className="text-center font-medium text-danger">{t('csvTools.unreadable')}</p>
  if (!oldFile || !newFile) return null
  return (
    <div id="compare-csv-tool" className={boxClasses}>
      <p className="text-sm">
        {t('csvTools.compare.files', { old: oldFile.fileName, new: newFile.fileName })}
      </p>
      {[readOld, readNew].map(
        (readFile, position) =>
          readFile?.sheets &&
          readFile.sheets.length > 1 && (
            <label key={position} className={`block ${labelClasses}`}>
              {t(position === 0 ? 'csvTools.compare.oldSheet' : 'csvTools.compare.newSheet', { name: readFile.fileName })}
              <select id={`compare-${position === 0 ? 'old' : 'new'}-sheet-select`} value={sheetChoices[position]} onChange={(event) => setSheetChoices(position === 0 ? [Number(event.target.value), sheetChoices[1]] : [sheetChoices[0], Number(event.target.value)])} className={fieldClasses}>
                {readFile.sheets.map((sheet, sheetIndex) => (
                  <option key={sheetIndex} value={sheetIndex}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          ),
      )}
      {sharedColumns.length === 0 ? (
        <p id="compare-csv-no-key" role="alert" className="text-sm font-semibold text-danger">
          {t('csvTools.compare.noSharedColumn')}
        </p>
      ) : (
        <label htmlFor="compare-csv-key-select" className={`block ${labelClasses}`}>
          {t('csvTools.compare.key')}
          <select id="compare-csv-key-select" value={keyColumn} onChange={(event) => setChosenKey(event.target.value)} className={fieldClasses}>
            {sharedColumns.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {comparison && (
        <>
          <p id="compare-csv-summary" role="status" className="font-semibold">
            {t('csvTools.compare.summary', { added: comparison.addedRows.length, removed: comparison.removedRows.length, changed: comparison.changedRows.length })}
          </p>
          {(comparison.columnsOnlyInOld.length > 0 || comparison.columnsOnlyInNew.length > 0) && (
            <p id="compare-csv-columns-note" className="text-sm text-ink-soft">
              {t('csvTools.compare.columnsNote', { old: comparison.columnsOnlyInOld.join(', ') || '—', new: comparison.columnsOnlyInNew.join(', ') || '—' })}
            </p>
          )}
          {(comparison.repeatedKeys.length > 0 || comparison.rowsWithoutKey > 0) && (
            <p id="compare-csv-key-note" className="text-sm text-danger">
              {t('csvTools.compare.keyNote', { repeated: comparison.repeatedKeys.slice(0, 10).join(', ') || '—', missing: comparison.rowsWithoutKey })}
            </p>
          )}
          {comparison.changedRows.length > 0 && (
            <section id="compare-csv-changed" aria-label={t('csvTools.compare.changed')}>
              <h3 className="mb-2 font-semibold">{tp('csvTools.compare.changedTitle', comparison.changedRows.length)}</h3>
              <SmallTable
                id="compare-csv-changed-table"
                header={[keyColumn, t('csvTools.compare.column'), t('csvTools.compare.oldValue'), t('csvTools.compare.newValue')]}
                rows={comparison.changedRows.flatMap((changedRow) => changedRow.changes.map((change) => [changedRow.key, change.column, change.oldText, change.newText]))}
                renderCell={(text, _rowPosition, columnPosition) => (columnPosition === 3 ? <mark className="rounded bg-accent/15 px-1">{text}</mark> : text)}
              />
            </section>
          )}
          {comparison.addedRows.length > 0 && (
            <section id="compare-csv-added" aria-label={t('csvTools.compare.added')}>
              <h3 className="mb-2 font-semibold">{tp('csvTools.compare.addedTitle', comparison.addedRows.length)}</h3>
              <SmallTable id="compare-csv-added-table" header={comparison.header} rows={comparison.addedRows} />
            </section>
          )}
          {comparison.removedRows.length > 0 && (
            <section id="compare-csv-removed" aria-label={t('csvTools.compare.removed')}>
              <h3 className="mb-2 font-semibold">{tp('csvTools.compare.removedTitle', comparison.removedRows.length)}</h3>
              <SmallTable id="compare-csv-removed-table" header={comparison.header} rows={comparison.removedRows} />
            </section>
          )}
          <p className="text-sm text-ink-soft">{t('csvTools.compare.shownNote', { count: MAX_SHOWN_ROWS })}</p>
          <button id="compare-csv-download-button" type="button" onClick={downloadDifferences} className="btn btn--primary btn--compact press">
            {t('csvTools.compare.download')}
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Change CSV encoding

const INPUT_ENCODINGS: EncodingChoice[] = ['auto', 'utf-8', 'utf-16le', 'utf-16be', 'windows-1256', 'iso-8859-1']
const OUTPUT_ENCODINGS: TextDownloadEncoding[] = ['utf-8-bom', 'utf-8', 'utf-16le', 'windows-1256']

export function ChangeCsvEncoding({ files }: ToolProps) {
  const { t, tp } = useT()
  const chosenFile = files.at(-1)
  const [contents, setContents] = useState<ArrayBuffer | null>(null)
  const [inputEncoding, setInputEncoding] = useState<EncodingChoice>('auto')
  const [outputEncoding, setOutputEncoding] = useState<TextDownloadEncoding>('utf-8-bom')

  useEffect(() => {
    if (!chosenFile) return
    let isCurrent = true
    void chosenFile.arrayBuffer().then((buffer) => isCurrent && setContents(buffer))
    return () => {
      isCurrent = false
    }
  }, [chosenFile])

  if (!chosenFile || !contents) return null
  const { text, encodingLabel } = decodeTextBytes(contents, inputEncoding)
  const { bytes, unencodableCount } = encodeText(text.replace(/^﻿/, ''), outputEncoding)
  const outputName = `${baseNameOf(chosenFile.name)}-${outputEncoding}.csv`

  return (
    <div id="csv-encoding-tool" className={boxClasses}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="csv-encoding-input-select" className={labelClasses}>
          {t('csvTools.encoding.input')}
          <select id="csv-encoding-input-select" value={inputEncoding} onChange={(event) => setInputEncoding(event.target.value as EncodingChoice)} className={fieldClasses}>
            {INPUT_ENCODINGS.map((encoding) => (
              <option key={encoding} value={encoding}>
                {encoding === 'auto' ? t('csvTools.encoding.detected', { encoding: decodeTextBytes(contents, 'auto').encodingLabel }) : encoding.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="csv-encoding-output-select" className={labelClasses}>
          {t('csvTools.encoding.output')}
          <select id="csv-encoding-output-select" value={outputEncoding} onChange={(event) => setOutputEncoding(event.target.value as TextDownloadEncoding)} className={fieldClasses}>
            {OUTPUT_ENCODINGS.map((encoding) => (
              <option key={encoding} value={encoding}>
                {t(`csvTools.encoding.${encoding}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PreviewLines id="csv-encoding-preview" label={t('csvTools.encoding.preview', { encoding: encodingLabel })} text={text} />
      {unencodableCount > 0 && (
        <p id="csv-encoding-warning" role="alert" className="text-sm text-danger">
          {tp('csvTools.encoding.unencodable', unencodableCount)}
        </p>
      )}
      <button id="csv-encoding-download-button" type="button" onClick={() => downloadTextFile(outputName, bytes, 'text/csv')} className="btn btn--primary btn--compact press">
        {t('csvTools.download', { name: outputName })}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- Change CSV delimiter

export function ChangeCsvDelimiter({ files }: ToolProps) {
  const { t } = useT()
  const chosenFile = files.at(-1)
  const [inputDelimiter, setInputDelimiter] = useState<DelimiterChoice>('auto')
  const [outputDelimiter, setOutputDelimiter] = useState<Exclude<DelimiterChoice, 'auto'>>(';')
  const [readFile, setReadFile] = useState<ReadCsv | null>(null)
  const [isByteOrderMarkAdded, setIsByteOrderMarkAdded] = useState<boolean | null>(null)

  useEffect(() => {
    if (!chosenFile) return
    let isCurrent = true
    void readCsvFile(chosenFile, inputDelimiter).then((answer) => isCurrent && setReadFile(answer))
    return () => {
      isCurrent = false
    }
  }, [chosenFile, inputDelimiter])

  if (!chosenFile || !readFile) return null
  if ('error' in readFile) return <p id="csv-delimiter-error" role="alert" className="text-center font-medium text-danger">{t('csvTools.unreadable')}</p>
  const delimiterLabel = (delimiter: string) => t(DELIMITER_OPTIONS.find((option) => option.value === delimiter)?.labelKey ?? 'csv.delimiter.comma')
  const lineEnding = readFile.usesCrlf ? '\r\n' : '\n'
  const byteOrderMark = isByteOrderMarkAdded ?? hasNonAsciiText(readFile.rows)
  const outputText = `${byteOrderMark ? '﻿' : ''}${Papa.unparse(readFile.rows, { delimiter: outputDelimiter, newline: lineEnding })}${lineEnding}`
  const outputName = `${baseNameOf(chosenFile.name)}${outputDelimiter === '\t' ? '.tsv' : '.csv'}`

  return (
    <div id="csv-delimiter-tool" className={boxClasses}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="csv-delimiter-input-select" className={labelClasses}>
          {t('csvTools.delimiter.input')}
          <select id="csv-delimiter-input-select" value={inputDelimiter} onChange={(event) => setInputDelimiter(event.target.value as DelimiterChoice)} className={fieldClasses}>
            {DELIMITER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === 'auto' ? t('csvTools.delimiter.detected', { delimiter: delimiterLabel(readFile.delimiter) }) : t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="csv-delimiter-output-select" className={labelClasses}>
          {t('csvTools.delimiter.output')}
          <select id="csv-delimiter-output-select" value={outputDelimiter} onChange={(event) => setOutputDelimiter(event.target.value as Exclude<DelimiterChoice, 'auto'>)} className={fieldClasses}>
            {DELIMITER_OPTIONS.filter((option) => option.value !== 'auto').map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label htmlFor="csv-delimiter-bom-checkbox" className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
        <input id="csv-delimiter-bom-checkbox" type="checkbox" checked={byteOrderMark} onChange={(event) => setIsByteOrderMarkAdded(event.target.checked)} className="size-4" />
        {t('csvTools.delimiter.byteOrderMark')}
      </label>
      <PreviewLines id="csv-delimiter-preview" label={t('csvTools.delimiter.preview', { rows: readFile.rows.length, columns: readFile.rows[0]?.length ?? 0 })} text={outputText.replace(/^﻿/, '')} />
      <button id="csv-delimiter-download-button" type="button" onClick={() => downloadTextFile(outputName, outputText, 'text/csv;charset=utf-8')} className="btn btn--primary btn--compact press">
        {t('csvTools.download', { name: outputName })}
      </button>
    </div>
  )
}
