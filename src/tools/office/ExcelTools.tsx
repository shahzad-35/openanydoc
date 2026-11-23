/* oxlint-disable react/only-export-components */
// The Excel tools: merge, split, remove sheet protection, repair, metadata and Excel to
// Word (Compare Excel is Compare CSV, which also reads workbooks). Workbooks are written by ExcelJS (MIT); .xls, .ods and damaged files are read by SheetJS first, which reads leniently.
// Sheet protection is taken off in the file's XML (officePackage.ts), touching nothing else.
import { useEffect, useState } from 'react'
import type { Workbook, Worksheet, CellValue } from 'exceljs'
import { useT } from '../../i18n'
import type { ToolProps } from '../registry'
import { baseNameOf } from '../pdf/PdfToolParts'
import { OfficeMetadata, OfficeToolLayout, OfficeToolProblem, fieldClass, openOfficePackage, useOfficeTask } from './OfficeToolParts'
import { EXCEL_TYPE, WORD_TYPE, filesToResult, isCompoundFile, packageToFile, safeFileName } from './officePackage'

const isOpenXmlWorkbook = (file: File) => /\.(xlsx|xlsm)$/i.test(file.name)
const isSpreadsheet = (file: File) => /\.(xlsx|xlsm|xls|ods|csv)$/i.test(file.name)
const RIGHT_TO_LEFT_LETTER = /[֐-ࣿ]/
const MAX_SHEET_NAME = 31

async function newWorkbook() {
  const { default: ExcelJS } = await import('exceljs')
  return new ExcelJS.Workbook()
}

// A sheet name Excel accepts, not yet used in the workbook.
function uniqueSheetName(wanted: string, workbook: Workbook) {
  const base = (wanted.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, MAX_SHEET_NAME)
  const isTaken = (name: string) => workbook.worksheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())
  let name = base
  for (let number = 2; isTaken(name); number++) name = `${base.slice(0, MAX_SHEET_NAME - String(number).length - 3)} (${number})`
  return name
}

// A workbook read by SheetJS (any format it knows, damaged files too) rebuilt in ExcelJS: values, formulas, merged cells and
// column widths. Returns the number of cells read.
async function workbookFromSheetJs(bytes: ArrayBuffer) {
  const XLSX = await import('xlsx')
  const source = XLSX.read(bytes, { type: 'array', cellDates: true, cellFormula: true })
  const workbook = await newWorkbook()
  let cellCount = 0
  for (const sheetName of source.SheetNames) {
    const sourceSheet = source.Sheets[sheetName]
    const sheet = workbook.addWorksheet(uniqueSheetName(sheetName, workbook))
    if (!sourceSheet['!ref']) continue
    const range = XLSX.utils.decode_range(sourceSheet['!ref'])
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let column = range.s.c; column <= range.e.c; column++) {
        const cell = sourceSheet[XLSX.utils.encode_cell({ r: row, c: column })] as import('xlsx').CellObject | undefined
        if (!cell || (cell.v === undefined && !cell.f)) continue
        const value = cell.t === 'e' ? (cell.w ?? '') : (cell.v as CellValue)
        sheet.getCell(row + 1, column + 1).value = cell.f ? ({ formula: cell.f, result: cell.t === 'e' ? undefined : cell.v } as CellValue) : value
        cellCount++
      }
    }
    for (const merge of sourceSheet['!merges'] ?? []) sheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1)
    for (const [column, info] of (sourceSheet['!cols'] ?? []).entries()) {
      const width = info?.wch ?? (info?.wpx ? info.wpx / 7 : undefined)
      if (width) sheet.getColumn(column + 1).width = width
    }
  }
  return { workbook, cellCount }
}

// .xlsx and .xlsm open in ExcelJS with their formatting; other formats come in as values through SheetJS.
async function readWorkbook(file: File) {
  const bytes = await file.arrayBuffer()
  if (isOpenXmlWorkbook(file) && isCompoundFile(bytes)) throw new OfficeToolProblem('office.compoundFile')
  if (!isOpenXmlWorkbook(file)) return (await workbookFromSheetJs(bytes)).workbook
  const workbook = await newWorkbook()
  try {
    await workbook.xlsx.load(bytes)
  } catch {
    throw new OfficeToolProblem('office.excel.unreadable')
  }
  return workbook
}

// Rows copied cell by cell with their values (formulas as formulas) and formatting; `rowNumbers` are the source rows in order.
function copyRows(source: Worksheet, target: Worksheet, rowNumbers: number[]) {
  for (const [position, rowNumber] of rowNumbers.entries()) {
    const sourceRow = source.getRow(rowNumber)
    const targetRow = target.getRow(position + 1)
    if (sourceRow.height) targetRow.height = sourceRow.height
    sourceRow.eachCell((cell, column) => {
      if (cell.isMerged && cell.master.address !== cell.address) return
      const targetCell = targetRow.getCell(column)
      targetCell.value = cell.formula ? ({ formula: cell.formula, result: cell.result } as CellValue) : (structuredClone(cell.value) as CellValue)
      targetCell.style = structuredClone(cell.style)
    })
  }
}

function copyColumnWidths(source: Worksheet, target: Worksheet) {
  for (let column = 1; column <= source.columnCount; column++) {
    const sourceColumn = source.getColumn(column)
    if (sourceColumn.width) target.getColumn(column).width = sourceColumn.width
    if (sourceColumn.hidden) target.getColumn(column).hidden = true
  }
}

function copyWorksheet(source: Worksheet, workbook: Workbook, name: string) {
  const target = workbook.addWorksheet(uniqueSheetName(name, workbook), { views: structuredClone(source.views), state: source.state, properties: structuredClone(source.properties) })
  copyColumnWidths(source, target)
  copyRows(source, target, Array.from({ length: source.rowCount }, (_, index) => index + 1))
  for (const range of (source.model as { merges?: string[] }).merges ?? []) target.mergeCells(range)
  return target
}

async function workbookToFile(workbook: Workbook, fileName: string) {
  return new File([await workbook.xlsx.writeBuffer()], fileName, { type: EXCEL_TYPE })
}

// ---------------------------------------------------------------- Merge

async function mergeWorkbooks(files: File[]) {
  const merged = await newWorkbook()
  for (const file of files) for (const sheet of (await readWorkbook(file)).worksheets) copyWorksheet(sheet, merged, sheet.name)
  return workbookToFile(merged, `${baseNameOf(files[0].name)}-merged.xlsx`)
}

export function MergeExcel({ files, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const workbookFiles = files.filter(isSpreadsheet)
  return (
    <OfficeToolLayout toolId="merge-excel" hintKey="office.mergeExcel.hint" files={workbookFiles} task={task} buttonKey="office.mergeExcel.button" canRun={workbookFiles.length >= 2} onRun={() => void task.run(async () => onResult(await mergeWorkbooks(workbookFiles)))}>
      <div className="flex justify-center">
        <button id="merge-excel-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('office.addFiles')}
        </button>
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Split

type SplitExcelMode = 'sheets' | 'rows' | 'value'

async function splitWorkbook(file: File, workbook: Workbook, mode: SplitExcelMode, sheetIndex: number, rowsPerFile: number, valueColumn: number) {
  const parts: File[] = []
  if (mode === 'sheets') {
    for (const sheet of workbook.worksheets) {
      const part = await newWorkbook()
      copyWorksheet(sheet, part, sheet.name)
      parts.push(await workbookToFile(part, `${safeFileName(sheet.name, 'sheet')}.xlsx`))
    }
  } else {
    const sheet = workbook.worksheets[sheetIndex]
    const dataRows = Array.from({ length: Math.max(0, sheet.rowCount - 1) }, (_, index) => index + 2)
    const groups = new Map<string, number[]>()
    if (mode === 'rows') {
      const digits = Math.max(2, String(Math.ceil(dataRows.length / rowsPerFile)).length)
      for (let start = 0; start < dataRows.length; start += rowsPerFile) groups.set(`${baseNameOf(file.name)}-${String(start / rowsPerFile + 1).padStart(digits, '0')}`, dataRows.slice(start, start + rowsPerFile))
    } else {
      for (const rowNumber of dataRows) {
        const value = sheet.getRow(rowNumber).getCell(valueColumn).text.trim()
        groups.set(value, [...(groups.get(value) ?? []), rowNumber])
      }
    }
    const usedNames = new Set<string>()
    for (const [name, rowNumbers] of groups) {
      const part = await newWorkbook()
      const target = part.addWorksheet(uniqueSheetName(sheet.name, part), { views: structuredClone(sheet.views) })
      copyColumnWidths(sheet, target)
      copyRows(sheet, target, [1, ...rowNumbers])
      let fileName = safeFileName(name, 'empty')
      while (usedNames.has(fileName.toLowerCase())) fileName = `${fileName}-2`
      usedNames.add(fileName.toLowerCase())
      parts.push(await workbookToFile(part, `${fileName}.xlsx`))
    }
  }
  if (parts.length < 2) throw new OfficeToolProblem('office.splitExcel.nothingToSplit')
  return filesToResult(parts, `${baseNameOf(file.name)}-parts.zip`)
}

export function SplitExcel({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const file = files[0]
  const [read, setRead] = useState<{ file: File; workbook: Workbook } | null>(null)
  const [mode, setMode] = useState<SplitExcelMode>('sheets')
  const [sheetIndex, setSheetIndex] = useState(0)
  const [rowsPerFile, setRowsPerFile] = useState(100)
  const [valueColumn, setValueColumn] = useState(1)
  const { setErrorKey } = task
  useEffect(() => {
    let isCurrent = true
    readWorkbook(file)
      .then((workbook) => isCurrent && (setRead({ file, workbook }), setSheetIndex(0)))
      .catch((error: unknown) => isCurrent && setErrorKey(error instanceof OfficeToolProblem ? error.messageKey : 'office.failed'))
    return () => {
      isCurrent = false
    }
  }, [file, setErrorKey])
  const workbook = read?.file === file ? read.workbook : null
  const sheet = workbook?.worksheets[sheetIndex]
  const headers = sheet ? Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(1).getCell(index + 1).text || `${t('office.splitExcel.column')} ${index + 1}`) : []
  return (
    <OfficeToolLayout
      toolId="split-excel"
      hintKey="office.splitExcel.hint"
      files={files.slice(0, 1)}
      task={task}
      buttonKey="office.splitExcel.button"
      canRun={workbook !== null && rowsPerFile >= 1}
      onRun={() => void task.run(async () => onResult(await splitWorkbook(file, workbook!, mode, sheetIndex, rowsPerFile, valueColumn)))}
    >
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('office.splitExcel.by')}
          <select id="split-excel-mode-select" value={mode} onChange={(event) => setMode(event.target.value as SplitExcelMode)} className={fieldClass}>
            <option value="sheets">{t('office.splitExcel.sheets')}</option>
            <option value="rows">{t('office.splitExcel.rows')}</option>
            <option value="value">{t('office.splitExcel.value')}</option>
          </select>
        </label>
        {mode !== 'sheets' && workbook && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('office.excel.sheet')}
            <select id="split-excel-sheet-select" value={sheetIndex} onChange={(event) => setSheetIndex(Number(event.target.value))} className={fieldClass}>
              {workbook.worksheets.map((candidate, index) => (
                <option key={index} value={index}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'rows' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('office.splitExcel.rowsPerFile')}
            <input id="split-excel-rows-input" type="number" min={1} value={rowsPerFile} onChange={(event) => setRowsPerFile(Math.floor(Number(event.target.value)))} className={`${fieldClass} w-28`} />
          </label>
        )}
        {mode === 'value' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('office.splitExcel.column')}
            <select id="split-excel-column-select" value={valueColumn} onChange={(event) => setValueColumn(Number(event.target.value))} className={fieldClass}>
              {headers.map((header, index) => (
                <option key={index} value={index + 1}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Remove sheet protection

const PROTECTION_ELEMENTS = /<(sheetProtection|workbookProtection|protectedRanges)\b[^>]*?(\/>|>[\s\S]*?<\/\1>)/g

async function removeSheetProtection(file: File) {
  if (!isOpenXmlWorkbook(file)) throw new OfficeToolProblem('office.unprotect.onlyXlsx')
  const zip = await openOfficePackage(file)
  let removedCount = 0
  for (const path of Object.keys(zip.files).filter((name) => name === 'xl/workbook.xml' || /^xl\/(worksheets|chartsheets)\/[^/]+\.xml$/.test(name))) {
    const xml = await zip.file(path)!.async('string')
    const cleaned = xml.replace(PROTECTION_ELEMENTS, () => {
      removedCount++
      return ''
    })
    if (cleaned !== xml) zip.file(path, cleaned)
  }
  if (removedCount === 0) throw new OfficeToolProblem('office.unprotect.none')
  return packageToFile(zip, `${baseNameOf(file.name)}-unprotected.${file.name.split('.').pop()!.toLowerCase()}`, EXCEL_TYPE)
}

export function UnprotectExcel({ files, onResult }: ToolProps) {
  const task = useOfficeTask()
  return <OfficeToolLayout toolId="unprotect-excel" hintKey="office.unprotect.hint" files={files.slice(0, 1)} task={task} buttonKey="office.unprotect.button" onRun={() => void task.run(async () => onResult(await removeSheetProtection(files[0])))} />
}

// ---------------------------------------------------------------- Repair

export function RepairExcel({ files, onResult }: ToolProps) {
  const task = useOfficeTask()
  const file = files[0]
  return (
    <OfficeToolLayout
      toolId="repair-excel"
      hintKey="office.repair.hint"
      files={files.slice(0, 1)}
      task={task}
      buttonKey="office.repair.button"
      onRun={() =>
        void task.run(async () => {
          const repaired = await workbookFromSheetJs(await file.arrayBuffer()).catch(() => null)
          if (!repaired || repaired.cellCount === 0) throw new OfficeToolProblem('office.repair.nothing')
          onResult(await workbookToFile(repaired.workbook, `${baseNameOf(file.name)}-repaired.xlsx`))
        })
      }
    />
  )
}

// ---------------------------------------------------------------- Metadata

export const ExcelMetadata = (props: ToolProps) => <OfficeMetadata {...props} toolId="excel-metadata" />

// ---------------------------------------------------------------- Excel to Word

async function sheetToWordDocument(file: File, sheetName: string) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '', blankrows: false })
  if (rows.length === 0) throw new OfficeToolProblem('office.excelToWord.empty')
  const columnCount = Math.max(...rows.map((row) => row.length))
  const cells = rows.flat()
  const isRightToLeft = cells.filter((text) => RIGHT_TO_LEFT_LETTER.test(text)).length > cells.filter((text) => /[A-Za-z]/.test(text)).length
  const { Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx')
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: isRightToLeft,
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          tableHeader: rowIndex === 0,
          children: Array.from({ length: columnCount }, (_, column) => new TableCell({ children: [new Paragraph({ bidirectional: RIGHT_TO_LEFT_LETTER.test(row[column] ?? ''), children: [new TextRun({ text: row[column] ?? '', bold: rowIndex === 0, size: columnCount > 8 ? 16 : 20 })] })] })),
        }),
    ),
  })
  const wordDocument = new Document({ styles: { default: { document: { run: { font: 'Calibri' } } } }, sections: [{ properties: { page: { size: { orientation: columnCount > 6 ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT } } }, children: [table] }] })
  return new File([await Packer.toBlob(wordDocument)], `${baseNameOf(file.name)}-${safeFileName(sheetName, 'sheet')}.docx`, { type: WORD_TYPE })
}

export function ExcelToWord({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOfficeTask()
  const file = files[0]
  const [read, setRead] = useState<{ file: File; sheetNames: string[] } | null>(null)
  const [sheetName, setSheetName] = useState('')
  const { setErrorKey } = task
  useEffect(() => {
    let isCurrent = true
    import('xlsx')
      .then(async (XLSX) => XLSX.read(await file.arrayBuffer(), { type: 'array', bookSheets: true }).SheetNames)
      .then((sheetNames) => isCurrent && (setRead({ file, sheetNames }), setSheetName(sheetNames[0] ?? '')))
      .catch(() => isCurrent && setErrorKey('office.excel.unreadable'))
    return () => {
      isCurrent = false
    }
  }, [file, setErrorKey])
  const sheetNames = read?.file === file ? read.sheetNames : []
  return (
    <OfficeToolLayout toolId="excel-to-word" hintKey="office.excelToWord.hint" files={files.slice(0, 1)} task={task} buttonKey="office.excelToWord.button" canRun={sheetNames.includes(sheetName)} onRun={() => void task.run(async () => onResult(await sheetToWordDocument(file, sheetName)))}>
      {sheetNames.length > 1 && (
        <div className="flex justify-center">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('office.excel.sheet')}
            <select id="excel-to-word-sheet-select" value={sheetName} onChange={(event) => setSheetName(event.target.value)} className={fieldClass}>
              {sheetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </OfficeToolLayout>
  )
}
