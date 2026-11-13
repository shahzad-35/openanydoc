// The Excel side panels that read the whole workbook: every formula, search across all sheets, and compare two sheets. Fetched when
// one of them is first opened.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { columnLabel } from '../DataTable'
import { downloadTextFile } from '../registry'
import { cellKey, compareSheetCells, getCellText, getColumnIds, getRowIds, getSheetView, readCell, textMatches } from './excelModel'
import type { ExcelEdits, FormulaCalculator, ParseResult, ParsedWorkbook, SheetRecord } from './excelModel'
import { createEmptyExcelEdits } from './excelEdits'

const MAX_LISTED_FORMULAS = 2000
const MAX_SEARCH_RESULTS = 1000
const MAX_LISTED_DIFFERENCES = 1000

type WorkbookProps = {
  parsed: ParsedWorkbook
  edits: ExcelEdits
  calculator: FormulaCalculator | null
  sheetRecords: readonly SheetRecord[]
  onGoToCell: (sheetId: number, rowId: number, columnId: number) => void
}

type FoundCell = { sheetId: number; sheetName: string; rowId: number; columnId: number; address: string; text: string; formula: string }

// Every cell of every sheet, in tab order, row by row, with its address as the sheet shows it now. Stops once `isEnough` says so.
function readWorkbookCells(parsed: ParsedWorkbook, edits: ExcelEdits, calculator: FormulaCalculator | null, sheetRecords: readonly SheetRecord[], keep: (cell: FoundCell) => boolean, isEnough: () => boolean) {
  for (const record of sheetRecords) {
    const sheet = getSheetView(parsed, edits, record.id, calculator)
    const columnIds = getColumnIds(sheet)
    for (const [rowPosition, rowId] of getRowIds(sheet).entries()) {
      for (const [columnPosition, columnId] of columnIds.entries()) {
        const formula = readCell(sheet, rowId, columnId)?.f
        const foundCell = { sheetId: record.id, sheetName: record.name, rowId, columnId, address: `${columnLabel(columnPosition)}${rowPosition + 1}`, text: getCellText(sheet, rowId, columnId), formula: formula ? `=${formula}` : '' }
        if (keep(foundCell) && isEnough()) return
      }
    }
  }
}

function isHiddenSheet(parsed: ParsedWorkbook, sheetId: number) {
  return sheetId >= 0 && parsed.sheets[sheetId]?.visibility !== 'visible'
}

function CellResult({ id, cell, isHidden, onGoToCell }: { id: string; cell: FoundCell; isHidden: boolean; onGoToCell: WorkbookProps['onGoToCell'] }) {
  const { t } = useT()
  return (
    <li>
      <button type="button" id={id} className="excel-result" onClick={() => onGoToCell(cell.sheetId, cell.rowId, cell.columnId)}>
        <span className="excel-result-address" dir="ltr">
          <bdi>{cell.sheetName}</bdi>!{cell.address}
          {isHidden && <span className="excel-result-tag">{t('excel.panel.hiddenSheet')}</span>}
        </span>
        <span className="excel-result-text" dir={cell.formula ? 'ltr' : 'auto'}>
          {cell.formula || cell.text}
        </span>
        {cell.formula && (
          <span className="excel-result-value" dir="auto">
            = {cell.text}
          </span>
        )}
      </button>
    </li>
  )
}

// Every formula in the workbook with its cell and current value; a click selects the cell.
export function FormulaListPanel({ parsed, edits, calculator, sheetRecords, activeSheetId, onGoToCell }: WorkbookProps & { activeSheetId: number }) {
  const { t, tp } = useT()
  const [filterText, setFilterText] = useState('')
  const [isThisSheetOnly, setIsThisSheetOnly] = useState(false)
  const deferredFilterText = useDeferredValue(filterText)
  const deferredEdits = useDeferredValue(edits)
  const { formulas, totalCount } = useMemo(() => {
    const foundFormulas: FoundCell[] = []
    let count = 0
    const records = isThisSheetOnly ? sheetRecords.filter((record) => record.id === activeSheetId) : sheetRecords
    readWorkbookCells(
      parsed,
      deferredEdits,
      calculator,
      records,
      (cell) => {
        if (!cell.formula || (deferredFilterText !== '' && !textMatches(cell.formula, deferredFilterText, false))) return false
        count++
        if (foundFormulas.length < MAX_LISTED_FORMULAS) foundFormulas.push(cell)
        return true
      },
      () => false,
    )
    return { formulas: foundFormulas, totalCount: count }
  }, [parsed, deferredEdits, calculator, sheetRecords, activeSheetId, isThisSheetOnly, deferredFilterText])

  return (
    <div className="excel-panel" id="formula-list-panel">
      <div className="excel-panel-controls">
        <input id="formula-filter-input" type="search" dir="ltr" className="excel-panel-input" placeholder={t('excel.formulas.filterPlaceholder')} aria-label={t('excel.formulas.filterPlaceholder')} value={filterText} onChange={(event) => setFilterText(event.target.value)} />
        <label className="excel-panel-check">
          <input id="formula-this-sheet-checkbox" type="checkbox" checked={isThisSheetOnly} onChange={(event) => setIsThisSheetOnly(event.target.checked)} />
          {t('excel.formulas.thisSheetOnly')}
        </label>
      </div>
      <p className="excel-panel-summary" id="formula-count" role="status">
        {totalCount === 0 ? t('excel.formulas.none') : tp('excel.formulas.count', totalCount)}
        {totalCount > MAX_LISTED_FORMULAS && ` ${t('excel.panel.firstShown', { count: MAX_LISTED_FORMULAS })}`}
      </p>
      <ul className="excel-result-list" id="formula-list">
        {formulas.map((cell, position) => (
          <CellResult key={position} id={`formula-list-item-${position}`} cell={cell} isHidden={isHiddenSheet(parsed, cell.sheetId)} onGoToCell={onGoToCell} />
        ))}
      </ul>
    </div>
  )
}

// Search every sheet (hidden ones too) for text in the cells' shown values, or in their formulas.
export function WorkbookSearchPanel({ parsed, edits, calculator, sheetRecords, onGoToCell }: WorkbookProps) {
  const { t, tp } = useT()
  const [searchText, setSearchText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [isWholeCell, setIsWholeCell] = useState(false)
  const [isInFormulas, setIsInFormulas] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const deferredSearchText = useDeferredValue(searchText)
  const deferredEdits = useDeferredValue(edits)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const foundCells: FoundCell[] = []
    if (deferredSearchText === '') return foundCells
    const matches = (text: string) => (isWholeCell ? (matchCase ? text === deferredSearchText : text.toLowerCase() === deferredSearchText.toLowerCase()) : textMatches(text, deferredSearchText, matchCase))
    readWorkbookCells(
      parsed,
      deferredEdits,
      calculator,
      sheetRecords,
      (cell) => {
        if (!matches(cell.text) && !(isInFormulas && cell.formula !== '' && matches(cell.formula))) return false
        foundCells.push(cell)
        return true
      },
      () => foundCells.length >= MAX_SEARCH_RESULTS,
    )
    return foundCells
  }, [parsed, deferredEdits, calculator, sheetRecords, deferredSearchText, matchCase, isWholeCell, isInFormulas])

  const resultsBySheet = useMemo(() => {
    const groups = new Map<number, { sheetName: string; cells: { cell: FoundCell; position: number }[] }>()
    results.forEach((cell, position) => {
      const group = groups.get(cell.sheetId) ?? { sheetName: cell.sheetName, cells: [] }
      group.cells.push({ cell, position })
      groups.set(cell.sheetId, group)
    })
    return [...groups.entries()]
  }, [results])

  return (
    <div className="excel-panel" id="workbook-search-panel">
      <div className="excel-panel-controls">
        <input ref={inputRef} id="excel-search-input" type="search" dir="auto" className="excel-panel-input" placeholder={t('excel.search.placeholder')} aria-label={t('excel.search.placeholder')} value={searchText} onChange={(event) => setSearchText(event.target.value)} />
        <label className="excel-panel-check">
          <input id="excel-search-match-case-checkbox" type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} />
          {t('excel.search.matchCase')}
        </label>
        <label className="excel-panel-check">
          <input id="excel-search-whole-cell-checkbox" type="checkbox" checked={isWholeCell} onChange={(event) => setIsWholeCell(event.target.checked)} />
          {t('excel.search.wholeCell')}
        </label>
        <label className="excel-panel-check">
          <input id="excel-search-formulas-checkbox" type="checkbox" checked={isInFormulas} onChange={(event) => setIsInFormulas(event.target.checked)} />
          {t('excel.search.inFormulas')}
        </label>
      </div>
      {deferredSearchText !== '' && (
        <p className="excel-panel-summary" id="excel-search-count" role="status">
          {results.length === 0 ? t('excel.search.none') : tp('excel.search.count', results.length)}
          {results.length >= MAX_SEARCH_RESULTS && ` ${t('excel.panel.firstShown', { count: MAX_SEARCH_RESULTS })}`}
        </p>
      )}
      {resultsBySheet.map(([sheetId, group]) => (
        <section key={sheetId} className="excel-result-group" aria-labelledby={`excel-search-sheet-${sheetId}`}>
          <h3 id={`excel-search-sheet-${sheetId}`} dir="auto">
            {group.sheetName} <span className="excel-result-count">{group.cells.length}</span>
          </h3>
          <ul className="excel-result-list">
            {group.cells.map(({ cell, position }) => (
              <CellResult key={position} id={`excel-search-result-${position}`} cell={cell} isHidden={isHiddenSheet(parsed, cell.sheetId)} onGoToCell={onGoToCell} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

type OtherWorkbook = { fileName: string; parsed: ParsedWorkbook }

// Compare the open sheet with another sheet of this workbook or of another workbook, cell by cell. The open sheet's changed cells are
// tinted while the panel is open (`onComparedCellsChange`).
export function SheetComparePanel({
  parsed,
  edits,
  calculator,
  sheetRecords,
  activeSheetId,
  onGoToCell,
  readOtherWorkbook,
  onComparedCellsChange,
}: WorkbookProps & { activeSheetId: number; readOtherWorkbook: (file: File) => Promise<ParseResult>; onComparedCellsChange: (cellKeys: ReadonlySet<string>) => void }) {
  const { t } = useT()
  const [otherWorkbook, setOtherWorkbook] = useState<OtherWorkbook | null>(null)
  const [otherSheetChoice, setOtherSheetChoice] = useState<number | null>(null)
  const [compareFormulas, setCompareFormulas] = useState(false)
  const [readError, setReadError] = useState('')
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deferredEdits = useDeferredValue(edits)

  // The sheets the open one can be compared with: this workbook's other sheets, or every sheet of the chosen workbook.
  const otherSheetChoices = useMemo(
    () => (otherWorkbook ? otherWorkbook.parsed.sheets.map((sheet, position) => ({ id: position, name: sheet.name })) : sheetRecords.filter((record) => record.id !== activeSheetId)),
    [otherWorkbook, sheetRecords, activeSheetId],
  )
  const otherSheetId = otherSheetChoices.some((choice) => choice.id === otherSheetChoice) ? otherSheetChoice : (otherSheetChoices[0]?.id ?? null)
  const activeSheetName = sheetRecords.find((record) => record.id === activeSheetId)?.name ?? ''

  const comparison = useMemo(() => {
    if (otherSheetId === null) return null
    const openSheet = getSheetView(parsed, deferredEdits, activeSheetId, calculator)
    const otherSheet = otherWorkbook ? getSheetView(otherWorkbook.parsed, createEmptyExcelEdits(), otherSheetId) : getSheetView(parsed, deferredEdits, otherSheetId, calculator)
    const result = compareSheetCells(openSheet, otherSheet, compareFormulas, MAX_LISTED_DIFFERENCES)
    const openRowIds = getRowIds(openSheet)
    const openColumnIds = getColumnIds(openSheet)
    const changedCellKeys = new Set<string>()
    const differences = result.differences.map((difference) => {
      const rowId = openRowIds[difference.rowPosition]
      const columnId = openColumnIds[difference.columnPosition]
      if (rowId !== undefined && columnId !== undefined) changedCellKeys.add(cellKey(rowId, columnId))
      return { ...difference, rowId, columnId, address: `${columnLabel(difference.columnPosition)}${difference.rowPosition + 1}` }
    })
    return { ...result, differences, changedCellKeys }
  }, [parsed, deferredEdits, calculator, activeSheetId, otherWorkbook, otherSheetId, compareFormulas])

  useEffect(() => {
    onComparedCellsChange(comparison?.changedCellKeys ?? new Set())
  }, [comparison, onComparedCellsChange])
  useEffect(() => () => onComparedCellsChange(new Set()), [onComparedCellsChange])

  async function chooseOtherWorkbook(file: File | undefined) {
    if (!file) return
    setReadError('')
    setIsReading(true)
    const result = await readOtherWorkbook(file)
    setIsReading(false)
    if (result.status === 'error') setReadError(result.message)
    else {
      setOtherWorkbook({ fileName: file.name, parsed: result.parsed })
      setOtherSheetChoice(null)
    }
  }

  function downloadDifferences() {
    if (!comparison) return
    const escapeCsv = (text: string) => (/[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text)
    const lines = [['cell', 'change', 'before', 'after'], ...comparison.differences.map((difference) => [difference.address, difference.kind, difference.before, difference.after])]
    downloadTextFile(`${activeSheetName.replace(/[\\/:*?"<>|]/g, '_')}-differences.csv`, `﻿${lines.map((line) => line.map(escapeCsv).join(',')).join('\r\n')}\r\n`, 'text/csv;charset=utf-8')
  }

  const differenceCount = comparison ? comparison.counts.added + comparison.counts.removed + comparison.counts.changed : 0
  return (
    <div className="excel-panel" id="sheet-compare-panel">
      <div className="excel-panel-controls">
        <p className="excel-panel-note">
          {t('excel.compare.openSheet')} <bdi className="font-medium">{activeSheetName}</bdi>
        </p>
        <div className="excel-panel-row">
          <input ref={fileInputRef} id="compare-workbook-file-input" type="file" accept=".xlsx,.xlsm,.xls,.ods" hidden onChange={(event) => void chooseOtherWorkbook(event.target.files?.[0])} />
          <button type="button" id="compare-choose-workbook-button" className="btn sm outline" disabled={isReading} onClick={() => fileInputRef.current?.click()}>
            {isReading ? t('excel.view.reading') : t('excel.compare.chooseWorkbook')}
          </button>
          {otherWorkbook && (
            <button type="button" id="compare-this-workbook-button" className="btn sm" onClick={() => setOtherWorkbook(null)}>
              {t('excel.compare.useThisWorkbook')}
            </button>
          )}
        </div>
        {otherWorkbook && (
          <p className="excel-panel-note" id="compare-other-workbook">
            {t('excel.compare.otherWorkbook')} <bdi>{otherWorkbook.fileName}</bdi>
          </p>
        )}
        <label className="excel-panel-field">
          {t('excel.compare.withSheet')}
          <select id="compare-sheet-select" value={otherSheetId ?? ''} disabled={otherSheetChoices.length === 0} onChange={(event) => setOtherSheetChoice(Number(event.target.value))}>
            {otherSheetChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
        </label>
        <label className="excel-panel-check">
          <input id="compare-formulas-checkbox" type="checkbox" checked={compareFormulas} onChange={(event) => setCompareFormulas(event.target.checked)} />
          {t('excel.compare.formulasToo')}
        </label>
      </div>
      {readError && (
        <p className="excel-panel-error" id="compare-read-error" role="alert">
          {readError}
        </p>
      )}
      {otherSheetChoices.length === 0 && <p className="excel-panel-summary">{t('excel.compare.oneSheet')}</p>}
      {comparison && (
        <>
          <p className="excel-panel-summary" id="compare-summary" role="status">
            {differenceCount === 0 ? t('excel.compare.same') : t('excel.compare.summary', { changed: comparison.counts.changed, added: comparison.counts.added, removed: comparison.counts.removed })}
          </p>
          {differenceCount > 0 && (
            <button type="button" id="compare-download-button" className="btn sm outline excel-panel-action" onClick={downloadDifferences}>
              {t('excel.compare.download')}
            </button>
          )}
          {differenceCount > MAX_LISTED_DIFFERENCES && <p className="excel-panel-note">{t('excel.panel.firstShown', { count: MAX_LISTED_DIFFERENCES })}</p>}
          <ul className="excel-result-list" id="compare-differences">
            {comparison.differences.map((difference, position) => (
              <li key={position}>
                <button
                  type="button"
                  id={`compare-difference-${position}`}
                  className={`excel-result excel-difference-${difference.kind}`}
                  disabled={difference.rowId === undefined || difference.columnId === undefined}
                  onClick={() => onGoToCell(activeSheetId, difference.rowId as number, difference.columnId as number)}
                >
                  <span className="excel-result-address" dir="ltr">
                    {difference.address}
                    <span className="excel-result-tag">{t(`excel.compare.kind.${difference.kind}` as MessageKey)}</span>
                  </span>
                  <span className="excel-result-text" dir="auto">
                    <del>{difference.before}</del>
                    {difference.before !== '' && difference.after !== '' && ' → '}
                    <ins>{difference.after}</ins>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
