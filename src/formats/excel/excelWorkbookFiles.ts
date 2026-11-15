// Workbook files: one file per sheet, several workbooks' sheets in one file, and every sheet as CSV in one ZIP. Each starts from
// the workbook as Download would save it (edits included), so what is split or zipped is what the visitor sees. Loaded on demand.

import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { writeWorkbookFile } from './excelSave'
import { loadExcelJs } from './excelStyles'
import type { ExcelEdits, ParsedWorkbook } from './excelModel'

const MAX_SHEET_NAME_LENGTH = 31
// Characters a file name cannot hold on common systems.
const fileNameOf = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'sheet'

function readSavedWorkbook(savedBytes: ArrayBuffer) {
  return XLSX.read(savedBytes, { type: 'array', cellDates: true, cellNF: true })
}

// One file per sheet, in the workbook's own type, zipped. An .xlsx file whose styles were read keeps them: ExcelJS loads the saved
// file once per sheet and removes the other sheets. Other files are rebuilt from values with SheetJS.
export async function splitWorkbookIntoSheets(parsed: ParsedWorkbook, edits: ExcelEdits, baseName: string) {
  const savedBytes = await (await writeWorkbookFile(parsed, edits)).arrayBuffer()
  const extension = parsed.bookType === 'biff8' ? 'xls' : parsed.bookType
  const zip = new JSZip()
  if (parsed.bookType === 'xlsx' && parsed.styles) {
    const ExcelJS = await loadExcelJs()
    const sheetCount = (await new ExcelJS.Workbook().xlsx.load(savedBytes)).worksheets.length
    for (let keptPosition = 0; keptPosition < sheetCount; keptPosition++) {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(savedBytes)
      const keptSheet = workbook.worksheets[keptPosition]
      for (const worksheet of [...workbook.worksheets]) if (worksheet !== keptSheet) workbook.removeWorksheet(worksheet.id)
      keptSheet.state = 'visible'
      zip.file(`${baseName}-${fileNameOf(keptSheet.name)}.xlsx`, await workbook.xlsx.writeBuffer())
    }
  } else {
    const workbook = readSavedWorkbook(savedBytes)
    for (const sheetName of workbook.SheetNames) {
      const sheetBook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(sheetBook, workbook.Sheets[sheetName], sheetName)
      zip.file(`${baseName}-${fileNameOf(sheetName)}.${extension}`, XLSX.write(sheetBook, { type: 'array', bookType: parsed.bookType, bookSST: true }))
    }
  }
  return zip.generateAsync({ type: 'blob' })
}

// Every sheet as a CSV file (UTF-8 with a byte order mark, so Excel reads accents and Arabic correctly), zipped. Hidden sheets too.
export async function zipSheetsAsCsv(parsed: ParsedWorkbook, edits: ExcelEdits, baseName: string) {
  const workbook = readSavedWorkbook(await (await writeWorkbookFile(parsed, edits)).arrayBuffer())
  const zip = new JSZip()
  for (const sheetName of workbook.SheetNames) zip.file(`${baseName}-${fileNameOf(sheetName)}.csv`, `﻿${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}`)
  return zip.generateAsync({ type: 'blob' })
}

export type MergeSource = { fileName: string; workbook: XLSX.WorkBook; sheetNames: string[] }

// The open workbook as Download would save it, read back so its sheets can be merged with other files' sheets.
export async function readOpenWorkbookForMerge(parsed: ParsedWorkbook, edits: ExcelEdits) {
  return readSavedWorkbook(await (await writeWorkbookFile(parsed, edits)).arrayBuffer())
}

// The chosen sheets of several workbooks in one .xlsx file, in the order given. Values, formulas, number formats, column widths,
// merges, comments and links are kept; fonts, colours and borders are not (SheetJS Community writes no styles). A name already used
// gets " (2)", " (3)" ... within Excel's 31 characters.
export function mergeWorkbookSheets(sources: readonly MergeSource[]) {
  const mergedBook = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  for (const source of sources) {
    for (const sheetName of source.sheetNames) {
      let mergedName = sheetName.slice(0, MAX_SHEET_NAME_LENGTH)
      for (let copyNumber = 2; usedNames.has(mergedName.toLowerCase()); copyNumber++) {
        const suffix = ` (${copyNumber})`
        mergedName = `${sheetName.slice(0, MAX_SHEET_NAME_LENGTH - suffix.length)}${suffix}`
      }
      usedNames.add(mergedName.toLowerCase())
      XLSX.utils.book_append_sheet(mergedBook, source.workbook.Sheets[sheetName], mergedName)
    }
  }
  return new Blob([XLSX.write(mergedBook, { type: 'array', bookType: 'xlsx', bookSST: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
