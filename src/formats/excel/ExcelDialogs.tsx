// The Excel dialogs that are not about one cell: Workbook info, Print / Save as PDF, and Workbook files (split, merge, CSV ZIP).
// Fetched when one of them is first opened.
import { useState } from 'react'
import { isolateText, useT } from '../../i18n'
import { Icon } from '../sheet/SheetChrome'
import { downloadTextFile } from '../registry'
import type { ExcelEdits, ParseResult, ParsedWorkbook, SheetRecord } from './excelModel'
import { mergeWorkbookSheets, readOpenWorkbookForMerge, splitWorkbookIntoSheets, zipSheetsAsCsv } from './excelWorkbookFiles'
import type { MergeSource } from './excelWorkbookFiles'

function DialogHead({ titleId, title, onClose }: { titleId: string; title: string; onClose: () => void }) {
  const { t } = useT()
  return (
    <div className="dlg-head">
      <h2 id={titleId}>{title}</h2>
      <span className="spacer" />
      <button className="btn icon sm" type="button" id={`${titleId}-close-button`} aria-label={t('find.close')} onClick={onClose}>
        <Icon name="x" size="sm" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- Workbook info

// What the file holds, as it was opened: sheets and their sizes, frozen panes, formulas, notes, links, names, external links and
// macros. Macros are only reported, never run.
export function WorkbookInfoDialog({ parsed, fileName, fileSize, onClose }: { parsed: ParsedWorkbook; fileName: string; fileSize: string; onClose: () => void }) {
  const { t, tp } = useT()
  const counts = { formulas: 0, notes: 0, links: 0 }
  for (const sheet of parsed.sheets) {
    for (const [address, cell] of Object.entries(sheet.worksheet)) {
      if (address.startsWith('!')) continue
      if (cell.f) counts.formulas++
      if (cell.c?.length) counts.notes++
      if (cell.l) counts.links++
    }
  }
  const hiddenCount = parsed.sheets.filter((sheet) => sheet.visibility === 'hidden').length
  const veryHiddenCount = parsed.sheets.filter((sheet) => sheet.visibility === 'veryHidden').length
  const visibilityLabel = { visible: '', hidden: t('excel.info.hidden'), veryHidden: t('excel.info.veryHidden') }
  return (
    <>
      <DialogHead titleId="workbook-info-title" title={t('excel.info.title')} onClose={onClose} />
      <div className="dlg-body excel-info" id="workbook-info-body">
        <dl className="excel-info-list">
          <dt>{t('excel.info.file')}</dt>
          <dd>
            <bdi>{fileName}</bdi> · <span dir="ltr">{fileSize}</span>
          </dd>
          <dt>{t('excel.info.sheets')}</dt>
          <dd id="workbook-info-sheet-count">
            {tp('excel.status.sheets', parsed.sheets.length)}
            {hiddenCount + veryHiddenCount > 0 && ` · ${t('excel.info.hiddenCounts', { hidden: hiddenCount, veryHidden: veryHiddenCount })}`}
          </dd>
          <dt>{t('excel.info.contents')}</dt>
          <dd>{t('excel.info.counts', counts)}</dd>
          <dt>{t('excel.info.definedNames')}</dt>
          <dd dir={parsed.info.definedNames.length > 0 ? 'ltr' : undefined}>{parsed.info.definedNames.length > 0 ? parsed.info.definedNames.join(', ') : t('excel.info.none')}</dd>
          <dt>{t('excel.info.externalLinks')}</dt>
          <dd id="workbook-info-external-links">
            {parsed.info.externalLinks.length > 0 ? (
              <ul>
                {parsed.info.externalLinks.map((link) => (
                  <li key={link} dir="ltr">
                    {link}
                  </li>
                ))}
              </ul>
            ) : (
              t('excel.info.none')
            )}
          </dd>
          <dt>{t('excel.info.macros')}</dt>
          <dd id="workbook-info-macros">{parsed.info.hasMacros ? t('excel.info.hasMacros') : t('excel.info.noMacros')}</dd>
        </dl>
        <table className="excel-info-table" id="workbook-info-sheets">
          <thead>
            <tr>
              <th>{t('excel.info.sheet')}</th>
              <th>{t('excel.info.usedRange')}</th>
              <th>{t('excel.info.size')}</th>
              <th>{t('excel.info.frozen')}</th>
            </tr>
          </thead>
          <tbody>
            {parsed.sheets.map((sheet, position) => (
              <tr key={position}>
                <td>
                  <bdi>{sheet.name}</bdi>
                  {sheet.visibility !== 'visible' && <span className="excel-result-tag">{visibilityLabel[sheet.visibility]}</span>}
                </td>
                <td dir="ltr">{sheet.worksheet['!ref'] ?? '–'}</td>
                <td>{`${tp('excel.status.rows', sheet.rowCount)} × ${tp('excel.status.columns', sheet.columnCount)}`}</td>
                <td>{sheet.frozen ? t('excel.info.frozenSize', { rows: sheet.frozen.rowCount, columns: sheet.frozen.columnCount }) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="excel-panel-note">{t('excel.info.asOpened')}</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Print / Save as PDF

type PrintOptions = { fitToWidth: boolean; isLandscape: boolean; showGridlines: boolean }

// The sheet goes into a plain table that only the printout shows (see the print rules in index.css); the browser's own dialog
// prints it or saves it as a PDF, and the table is removed afterwards.
function printSheetTable(title: string, table: string[][], options: PrintOptions) {
  const printArea = document.createElement('div')
  printArea.id = 'print-area'
  printArea.className = [options.isLandscape && 'landscape', options.fitToWidth && 'fit-width', options.showGridlines && 'gridlines'].filter(Boolean).join(' ')
  const columnCount = Math.max(1, ...table.map((row) => row.length))
  // Fitting many columns on one page width means a smaller font.
  if (options.fitToWidth) printArea.style.setProperty('--print-font-size', `${Math.max(5, Math.min(10, 110 / columnCount)).toFixed(1)}pt`)
  const heading = document.createElement('h1')
  heading.textContent = title
  heading.dir = 'auto'
  const tableElement = document.createElement('table')
  tableElement.id = 'print-sheet'
  tableElement.dir = 'ltr'
  table.forEach((row, rowPosition) => {
    const rowElement = (rowPosition === 0 ? tableElement.createTHead() : (tableElement.tBodies[0] ?? tableElement.createTBody())).insertRow()
    for (const text of row) {
      const cellElement = document.createElement(rowPosition === 0 ? 'th' : 'td')
      cellElement.textContent = text
      cellElement.dir = 'auto'
      rowElement.append(cellElement)
    }
  })
  printArea.append(heading, tableElement)
  document.body.append(printArea)
  document.documentElement.classList.add('printing-sheet')
  function removePrintArea() {
    printArea.remove()
    document.documentElement.classList.remove('printing-sheet')
    window.removeEventListener('afterprint', removePrintArea)
  }
  window.addEventListener('afterprint', removePrintArea)
  window.print()
}

const MAX_PRINTED_CELLS = 20_000

// `readTable` gives the sheet as it is on screen: the shown rows (search and filters applied) and columns, the first row being the
// column names.
export function PrintSheetDialog({ sheetName, cellCount, readTable, onClose }: { sheetName: string; cellCount: number; readTable: () => string[][]; onClose: () => void }) {
  const { t } = useT()
  const [options, setOptions] = useState<PrintOptions>({ fitToWidth: true, isLandscape: false, showGridlines: true })
  const isTooLarge = cellCount > MAX_PRINTED_CELLS
  return (
    <>
      <DialogHead titleId="print-sheet-title" title={t('excel.print.title')} onClose={onClose} />
      <div className="dlg-body">
        <p className="excel-panel-note">{t('excel.print.intro', { name: isolateText(sheetName) })}</p>
        <label className="excel-panel-check">
          <input id="print-fit-width-checkbox" type="checkbox" checked={options.fitToWidth} onChange={(event) => setOptions({ ...options, fitToWidth: event.target.checked })} />
          {t('excel.print.fitToWidth')}
        </label>
        <label className="excel-panel-check">
          <input id="print-landscape-checkbox" type="checkbox" checked={options.isLandscape} onChange={(event) => setOptions({ ...options, isLandscape: event.target.checked })} />
          {t('excel.print.landscape')}
        </label>
        <label className="excel-panel-check">
          <input id="print-gridlines-checkbox" type="checkbox" checked={options.showGridlines} onChange={(event) => setOptions({ ...options, showGridlines: event.target.checked })} />
          {t('excel.print.gridlines')}
        </label>
        {isTooLarge && (
          <p className="excel-panel-error" id="print-too-large" role="alert">
            {t('excel.print.tooLarge', { count: MAX_PRINTED_CELLS.toLocaleString('en') })}
          </p>
        )}
      </div>
      <div className="dlg-foot">
        <span className="excel-panel-note">{t('excel.print.pdfHint')}</span>
        <span className="spacer" />
        <button className="btn outline" type="button" id="print-cancel-button" onClick={onClose}>
          {t('excel.toolbar.dialogCancel')}
        </button>
        <button
          className="btn primary"
          type="button"
          id="print-button"
          disabled={isTooLarge}
          onClick={() => {
            onClose()
            // The dialog closes first, so it is not in the printout's way.
            requestAnimationFrame(() => printSheetTable(sheetName, readTable(), options))
          }}
        >
          {t('excel.print.print')}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Workbook files

type MergeChoice = { key: string; fileName: string; workbook: MergeSource['workbook'] | null; sheetNames: string[]; chosenNames: ReadonlySet<string> }

// One file per sheet, every sheet as CSV in a ZIP, and merging sheets of several workbooks into one .xlsx file. Everything uses the
// workbook as Download would save it, edits included.
export function WorkbookFilesDialog({
  parsed,
  edits,
  sheetRecords,
  fileName,
  readOtherWorkbook,
  onOpenFile,
  onClose,
}: {
  parsed: ParsedWorkbook
  edits: ExcelEdits
  sheetRecords: readonly SheetRecord[]
  fileName: string
  readOtherWorkbook: (file: File) => Promise<ParseResult>
  onOpenFile: (file: File) => void
  onClose: () => void
}) {
  const { t, tp } = useT()
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const [busyAction, setBusyAction] = useState<'split' | 'csv' | 'merge' | 'read' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [mergedFile, setMergedFile] = useState<File | null>(null)
  const [mergeChoices, setMergeChoices] = useState<MergeChoice[]>(() => [
    { key: 'open', fileName, workbook: null, sheetNames: sheetRecords.map((record) => record.name), chosenNames: new Set(sheetRecords.map((record) => record.name)) },
  ])

  async function runAction(action: 'split' | 'csv' | 'merge', work: () => Promise<void>) {
    setBusyAction(action)
    setErrorMessage('')
    try {
      await work()
    } catch (error) {
      setErrorMessage(t('excel.files.failed', { reason: error instanceof Error ? error.message : String(error) }))
    } finally {
      setBusyAction(null)
    }
  }

  async function addWorkbooks(files: FileList | null) {
    if (!files) return
    setBusyAction('read')
    setErrorMessage('')
    for (const file of Array.from(files)) {
      const result = await readOtherWorkbook(file)
      if (result.status === 'error') {
        setErrorMessage(`${file.name}: ${result.message}`)
        continue
      }
      const sheetNames = result.parsed.workbook.SheetNames
      setMergeChoices((choices) => [...choices, { key: `${file.name}-${choices.length}`, fileName: file.name, workbook: result.parsed.workbook, sheetNames, chosenNames: new Set(sheetNames) }])
    }
    setBusyAction(null)
  }

  function toggleSheet(choiceKey: string, sheetName: string, isChosen: boolean) {
    setMergeChoices((choices) =>
      choices.map((choice) => {
        if (choice.key !== choiceKey) return choice
        const chosenNames = new Set(choice.chosenNames)
        if (isChosen) chosenNames.add(sheetName)
        else chosenNames.delete(sheetName)
        return { ...choice, chosenNames }
      }),
    )
  }

  const chosenSheetCount = mergeChoices.reduce((total, choice) => total + choice.chosenNames.size, 0)

  async function mergeAndDownload() {
    const openWorkbook = await readOpenWorkbookForMerge(parsed, edits)
    const sources = mergeChoices.map((choice) => ({ fileName: choice.fileName, workbook: choice.workbook ?? openWorkbook, sheetNames: choice.sheetNames.filter((name) => choice.chosenNames.has(name)) }))
    const mergedBlob = mergeWorkbookSheets(sources)
    const mergedName = `${baseName}-merged.xlsx`
    downloadTextFile(mergedName, mergedBlob, mergedBlob.type)
    setMergedFile(new File([mergedBlob], mergedName, { type: mergedBlob.type }))
  }

  return (
    <>
      <DialogHead titleId="workbook-files-title" title={t('excel.files.title')} onClose={onClose} />
      <div className="dlg-body excel-files">
        <section aria-labelledby="files-split-heading">
          <h3 id="files-split-heading">{t('excel.files.splitTitle')}</h3>
          <p className="excel-panel-note">{parsed.bookType === 'xlsx' && parsed.styles ? t('excel.files.splitNoteStyles') : t('excel.files.splitNoteValues')}</p>
          <button
            className="btn outline sm"
            type="button"
            id="files-split-button"
            disabled={busyAction !== null}
            onClick={() => void runAction('split', async () => downloadTextFile(`${baseName}-sheets.zip`, await splitWorkbookIntoSheets(parsed, edits, baseName), 'application/zip'))}
          >
            {busyAction === 'split' ? t('excel.files.working') : tp('excel.files.splitButton', sheetRecords.length)}
          </button>
        </section>
        <section aria-labelledby="files-csv-heading">
          <h3 id="files-csv-heading">{t('excel.files.csvTitle')}</h3>
          <button
            className="btn outline sm"
            type="button"
            id="files-csv-zip-button"
            disabled={busyAction !== null}
            onClick={() => void runAction('csv', async () => downloadTextFile(`${baseName}-csv.zip`, await zipSheetsAsCsv(parsed, edits, baseName), 'application/zip'))}
          >
            {busyAction === 'csv' ? t('excel.files.working') : t('excel.files.csvButton')}
          </button>
        </section>
        <section aria-labelledby="files-merge-heading">
          <h3 id="files-merge-heading">{t('excel.files.mergeTitle')}</h3>
          <p className="excel-panel-note">{t('excel.files.mergeNote')}</p>
          {mergeChoices.map((choice, choicePosition) => (
            <fieldset key={choice.key} className="excel-merge-source" id={`merge-source-${choicePosition}`}>
              <legend>
                <bdi>{choice.fileName}</bdi>
                {choice.workbook === null && ` (${t('excel.files.thisWorkbook')})`}
              </legend>
              {choice.sheetNames.map((sheetName, sheetPosition) => (
                <label key={sheetName} className="excel-panel-check">
                  <input
                    id={`merge-sheet-${choicePosition}-${sheetPosition}`}
                    type="checkbox"
                    checked={choice.chosenNames.has(sheetName)}
                    onChange={(event) => toggleSheet(choice.key, sheetName, event.target.checked)}
                  />
                  <bdi>{sheetName}</bdi>
                </label>
              ))}
              {choice.workbook !== null && (
                <button className="btn sm danger" type="button" id={`merge-remove-source-${choicePosition}`} onClick={() => setMergeChoices((choices) => choices.filter((other) => other.key !== choice.key))}>
                  {t('excel.files.remove')}
                </button>
              )}
            </fieldset>
          ))}
          <div className="excel-panel-row">
            <label className="btn outline sm" htmlFor="merge-add-input" id="merge-add-button">
              {busyAction === 'read' ? t('excel.view.reading') : t('excel.files.addWorkbooks')}
            </label>
            <input id="merge-add-input" type="file" accept=".xlsx,.xlsm,.xls,.ods" multiple hidden onChange={(event) => void addWorkbooks(event.target.files)} />
            <button className="btn primary sm" type="button" id="merge-button" disabled={busyAction !== null || chosenSheetCount === 0} onClick={() => void runAction('merge', mergeAndDownload)}>
              {busyAction === 'merge' ? t('excel.files.working') : tp('excel.files.mergeButton', chosenSheetCount)}
            </button>
          </div>
          {mergedFile && (
            <button className="btn sm outline" type="button" id="merge-open-button" onClick={() => onOpenFile(mergedFile)}>
              {t('excel.files.openMerged')}
            </button>
          )}
        </section>
        {errorMessage && (
          <p className="excel-panel-error" id="workbook-files-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </>
  )
}
