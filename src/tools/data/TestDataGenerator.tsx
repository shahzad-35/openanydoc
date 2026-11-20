import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { buildXlsxBlob } from '../../formats/conversion'
import { downloadTextFile } from '../../formats/registry'
import type { ToolProps } from '../registry'

// Synthetic rows for testing imports, demos and screenshots, made on the page: names from short lists of common first and family
// names (English and Arabic), example.com addresses, phone numbers in the 555-0100 to 555-0199 range set aside for fiction, and
// dates and numbers in ranges. Values in a row are not related to each other. No national IDs, IBANs or card numbers, on purpose.

type GeneratedColumn = 'id' | 'nameEnglish' | 'nameArabic' | 'email' | 'phone' | 'date' | 'wholeNumber' | 'decimalNumber'
type OutputFormat = 'csv' | 'xlsx' | 'json'

const COLUMN_HEADERS: Record<GeneratedColumn, string> = { id: 'id', nameEnglish: 'name', nameArabic: 'name_ar', email: 'email', phone: 'phone', date: 'date', wholeNumber: 'quantity', decimalNumber: 'amount' }
const ALL_COLUMNS = Object.keys(COLUMN_HEADERS) as GeneratedColumn[]
const MAX_ROWS = 100_000
const PREVIEW_ROWS = 8

const ENGLISH_FIRST_NAMES = ['James', 'Mary', 'John', 'Linda', 'David', 'Sarah', 'Michael', 'Emma', 'Daniel', 'Olivia', 'Thomas', 'Sophia', 'Robert', 'Grace', 'William', 'Chloe', 'Joseph', 'Hannah', 'Samuel', 'Lucy', 'Henry', 'Alice', 'Jack', 'Ella', 'Oliver', 'Mia', 'Adam', 'Zoe', 'Ryan', 'Laura']
const ENGLISH_LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright', 'Hughes', 'Green', 'Hall', 'Wood', 'Clarke', 'Turner', 'Hill', 'Moore', 'Baker', 'Carter', 'Mitchell', 'Parker', 'Cooper', 'Ward']
const ARABIC_FIRST_NAMES = ['محمد', 'أحمد', 'عبدالله', 'خالد', 'فهد', 'سعود', 'عمر', 'يوسف', 'علي', 'إبراهيم', 'نورة', 'سارة', 'فاطمة', 'مريم', 'هند', 'ريم', 'لمى', 'جود', 'دانة', 'ليان', 'عبدالرحمن', 'تركي', 'ناصر', 'سلمان', 'منيرة', 'العنود', 'هيا', 'رهف', 'غادة', 'بدر']
const ARABIC_FAMILY_NAMES = ['العتيبي', 'القحطاني', 'الشهري', 'الغامدي', 'الزهراني', 'الدوسري', 'الحربي', 'المطيري', 'السبيعي', 'العنزي', 'الشمري', 'الأحمدي', 'الخالدي', 'السلمي', 'التميمي', 'المالكي', 'البقمي', 'الجهني', 'الرشيدي', 'الفيفي']
const AREA_CODES = ['202', '212', '305', '312', '415', '503', '617', '702', '808', '917']

// A small seeded random generator (mulberry32), so the preview shows the first rows of exactly what is downloaded.
function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

type GeneratorSettings = { columns: GeneratedColumn[]; fromDate: string; toDate: string; wholeMin: number; wholeMax: number; decimalMin: number; decimalMax: number }

function generateRows(rowCount: number, seed: number, settings: GeneratorSettings): (string | number)[][] {
  const random = createRandom(seed)
  const pick = <Item,>(items: Item[]) => items[Math.floor(random() * items.length)]
  const between = (low: number, high: number) => low + random() * (high - low)
  const fromTime = Date.parse(`${settings.fromDate}T00:00:00Z`) || 0
  const toTime = Math.max(fromTime, Date.parse(`${settings.toDate}T00:00:00Z`) || fromTime)
  const makeValue: Record<GeneratedColumn, (rowNumber: number) => string | number> = {
    id: (rowNumber) => rowNumber,
    nameEnglish: () => `${pick(ENGLISH_FIRST_NAMES)} ${pick(ENGLISH_LAST_NAMES)}`,
    nameArabic: () => `${pick(ARABIC_FIRST_NAMES)} ${pick(ARABIC_FAMILY_NAMES)}`,
    email: () => `${pick(ENGLISH_FIRST_NAMES).toLowerCase()}.${pick(ENGLISH_LAST_NAMES).toLowerCase()}${Math.floor(random() * 1000)}@example.com`,
    phone: () => `+1 ${pick(AREA_CODES)} 555 01${String(Math.floor(random() * 100)).padStart(2, '0')}`,
    date: () => new Date(Math.floor(between(fromTime, toTime + 86_400_000) / 86_400_000) * 86_400_000).toISOString().slice(0, 10),
    wholeNumber: () => Math.floor(between(Math.min(settings.wholeMin, settings.wholeMax), Math.max(settings.wholeMin, settings.wholeMax) + 1)),
    decimalNumber: () => Math.round(between(Math.min(settings.decimalMin, settings.decimalMax), Math.max(settings.decimalMin, settings.decimalMax)) * 100) / 100,
  }
  return Array.from({ length: rowCount }, (_, rowPosition) => settings.columns.map((column) => makeValue[column](rowPosition + 1)))
}

export default function TestDataGenerator({ onOpenInPage }: ToolProps) {
  const { t } = useT()
  const [rowCount, setRowCount] = useState(100)
  const [seed, setSeed] = useState(1)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('csv')
  const [settings, setSettings] = useState<GeneratorSettings>({ columns: ALL_COLUMNS, fromDate: '2020-01-01', toDate: '2026-12-31', wholeMin: 1, wholeMax: 100, decimalMin: 0, decimalMax: 5000 })
  const header = settings.columns.map((column) => COLUMN_HEADERS[column])
  const previewRows = useMemo(() => generateRows(Math.min(PREVIEW_ROWS, rowCount), seed, settings), [rowCount, seed, settings])
  const fieldClasses = 'mt-1 block w-full rounded-[12px] border-2 border-rule bg-paper-raised px-3 py-2 text-sm pointer-coarse:min-h-11'

  async function buildFile() {
    const rows = generateRows(rowCount, seed, settings)
    if (outputFormat === 'csv') return new File([`﻿${Papa.unparse([header, ...rows], { newline: '\r\n' })}\r\n`], 'test-data.csv', { type: 'text/csv' })
    if (outputFormat === 'xlsx') return new File([await buildXlsxBlob([{ sheetName: 'test-data', rows: [header, ...rows] }])], 'test-data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const records = rows.map((row) => Object.fromEntries(header.map((name, position) => [name, row[position]])))
    return new File([`${JSON.stringify(records, null, 2)}\n`], 'test-data.json', { type: 'application/json' })
  }

  function toggleColumn(column: GeneratedColumn) {
    const columns = settings.columns.includes(column) ? settings.columns.filter((chosen) => chosen !== column) : ALL_COLUMNS.filter((candidate) => candidate === column || settings.columns.includes(candidate))
    setSettings({ ...settings, columns })
  }

  return (
    <div id="test-data-tool" className="space-y-4 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start">
      <fieldset>
        <legend className="text-sm font-semibold">{t('testData.columns')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ALL_COLUMNS.map((column) => (
            <label key={column} htmlFor={`test-data-column-${column}`} className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
              <input id={`test-data-column-${column}`} type="checkbox" checked={settings.columns.includes(column)} onChange={() => toggleColumn(column)} className="size-4" />
              {t(`testData.column.${column}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="test-data-rows-input" className="text-sm font-semibold">
          {t('testData.rows')}
          <input id="test-data-rows-input" type="number" min={1} max={MAX_ROWS} dir="ltr" value={rowCount} onChange={(event) => setRowCount(Math.min(MAX_ROWS, Math.max(1, Math.floor(Number(event.target.value) || 1))))} className={fieldClasses} />
        </label>
        <label htmlFor="test-data-format-select" className="text-sm font-semibold">
          {t('testData.format')}
          <select id="test-data-format-select" value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as OutputFormat)} className={fieldClasses}>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="json">JSON</option>
          </select>
        </label>
        {settings.columns.includes('date') && (
          <>
            <label htmlFor="test-data-from-date-input" className="text-sm font-semibold">
              {t('testData.fromDate')}
              <input id="test-data-from-date-input" type="date" dir="ltr" value={settings.fromDate} onChange={(event) => setSettings({ ...settings, fromDate: event.target.value })} className={fieldClasses} />
            </label>
            <label htmlFor="test-data-to-date-input" className="text-sm font-semibold">
              {t('testData.toDate')}
              <input id="test-data-to-date-input" type="date" dir="ltr" value={settings.toDate} onChange={(event) => setSettings({ ...settings, toDate: event.target.value })} className={fieldClasses} />
            </label>
          </>
        )}
        {settings.columns.includes('wholeNumber') && (
          <>
            <label htmlFor="test-data-whole-min-input" className="text-sm font-semibold">
              {t('testData.wholeMin')}
              <input id="test-data-whole-min-input" type="number" dir="ltr" value={settings.wholeMin} onChange={(event) => setSettings({ ...settings, wholeMin: Math.floor(Number(event.target.value) || 0) })} className={fieldClasses} />
            </label>
            <label htmlFor="test-data-whole-max-input" className="text-sm font-semibold">
              {t('testData.wholeMax')}
              <input id="test-data-whole-max-input" type="number" dir="ltr" value={settings.wholeMax} onChange={(event) => setSettings({ ...settings, wholeMax: Math.floor(Number(event.target.value) || 0) })} className={fieldClasses} />
            </label>
          </>
        )}
        {settings.columns.includes('decimalNumber') && (
          <>
            <label htmlFor="test-data-decimal-min-input" className="text-sm font-semibold">
              {t('testData.decimalMin')}
              <input id="test-data-decimal-min-input" type="number" step="0.01" dir="ltr" value={settings.decimalMin} onChange={(event) => setSettings({ ...settings, decimalMin: Number(event.target.value) || 0 })} className={fieldClasses} />
            </label>
            <label htmlFor="test-data-decimal-max-input" className="text-sm font-semibold">
              {t('testData.decimalMax')}
              <input id="test-data-decimal-max-input" type="number" step="0.01" dir="ltr" value={settings.decimalMax} onChange={(event) => setSettings({ ...settings, decimalMax: Number(event.target.value) || 0 })} className={fieldClasses} />
            </label>
          </>
        )}
      </div>
      {settings.columns.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-[14px] border-2 border-rule">
          <table id="test-data-preview" className="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-rule [&_td]:px-2 [&_td]:py-1 [&_td]:whitespace-nowrap [&_th]:border-b-2 [&_th]:border-rule [&_th]:px-2 [&_th]:py-1 [&_th]:text-start">
            <caption className="p-2 text-start text-sm text-ink-soft">{t('testData.preview', { shown: previewRows.length, total: rowCount })}</caption>
            <thead>
              <tr>
                {header.map((name) => (
                  <th key={name} dir="ltr">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowPosition) => (
                <tr key={rowPosition}>
                  {row.map((value, position) => (
                    <td key={position} dir="auto">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button id="test-data-download-button" type="button" disabled={settings.columns.length === 0} onClick={() => void buildFile().then((file) => downloadTextFile(file.name, file, file.type))} className="btn btn--primary btn--compact press">
          {t('testData.download')}
        </button>
        <button
          id="test-data-open-button"
          type="button"
          disabled={settings.columns.length === 0}
          onClick={() => void buildFile().then((file) => onOpenInPage?.(file, outputFormat === 'csv' ? '/csv-viewer' : outputFormat === 'xlsx' ? '/excel-viewer' : '/json-viewer'))}
          className="btn btn--quiet btn--compact press"
        >
          {t('testData.openInViewer')}
        </button>
        <button id="test-data-again-button" type="button" onClick={() => setSeed((currentSeed) => currentSeed + 1)} className="btn btn--quiet btn--compact press">
          {t('testData.again')}
        </button>
      </div>
    </div>
  )
}
