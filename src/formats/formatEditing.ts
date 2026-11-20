// How each editable format counts and describes its edits (the "3 edited cells" line and the unsaved-edits checks). Imported
// only by the file page (FileViewPage, a lazy chunk), so the tool and content pages never load the edit models.
import type { Viewer } from '../viewers'
import { countExcelEdits, createEmptyExcelEdits, describeExcelChanges } from './excel/excelEdits'
import type { ExcelEdits } from './excel/excelEdits'
import { countCsvEdits, createEmptyCsvEdits, describeCsvChanges } from './csv/csvCells'
import type { CsvEdits } from './csv/csvCells'
import { countJsonChanges, createEmptyJsonEdits, describeJsonChanges } from './json/jsonModel'
import { countTextChanges, createEmptyTextEdits, describeTextChanges } from './text/textEditing'
import { loadExcelEditing } from './registry'
import type { FormatEditing } from './registry'

export const formatEditingByViewer: Partial<Record<Viewer['id'], FormatEditing>> = {
  csv: {
    createEmptyEdits: createEmptyCsvEdits,
    countChanges: (edits) => countCsvEdits(edits as CsvEdits),
    describeChanges: (edits, locale) => describeCsvChanges(edits as CsvEdits, locale),
    alwaysEditable: true,
  },
  text: {
    createEmptyEdits: createEmptyTextEdits,
    countChanges: countTextChanges,
    describeChanges: describeTextChanges,
    alwaysEditable: true,
  },
  json: {
    createEmptyEdits: createEmptyJsonEdits,
    countChanges: countJsonChanges,
    describeChanges: describeJsonChanges,
    alwaysEditable: true,
  },
  excel: {
    createEmptyEdits: createEmptyExcelEdits,
    countChanges: (edits) => countExcelEdits(edits as ExcelEdits),
    describeChanges: (edits, locale) => describeExcelChanges(edits as ExcelEdits, locale),
    loadEditingModule: () => loadExcelEditing().then((editingFile) => editingFile.excelEditingModule),
    alwaysEditable: true,
  },
}
