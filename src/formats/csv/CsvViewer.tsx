import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { FatalFileError, useIsPhone, useToast } from '../../components/Messages'
import { useT } from '../../i18n'
import type { Locale, MessageKey } from '../../i18n'
import { DELIMITER_OPTIONS, ENCODING_LABELS, describeParseNotice, firstRowLooksLikeHeader, parseCsv } from '../../parseCsv'
import type { DelimiterChoice, EncodingChoice, ParsedCsv } from '../../parseCsv'
import { formatFileSize, getLargeFileWarning } from '../../useFileIntake'
import { findTableFormat } from '../../viewers'
import { columnLabel, measureColumnWidthsPx } from '../DataTable'
import { buildDownloadName, downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import CsvGrid from './CsvGrid'
import type { CsvGridHandle, GridColumn, GridSelection } from './CsvGrid'
import {
  COLUMN_TYPE_LABEL_KEYS,
  buildColumnProfile,
  buildFindPattern,
  buildHistogram,
  countRowsPerWeek,
  detectColumnInfo,
  groupRows,
  parseNumber,
  passesFilter,
  sortRowIds,
  summarizeNumbers,
} from './csvAnalysis'
import type { ColumnFilter, ColumnInfo, ColumnType, GroupAggregate, SortLevel } from './csvAnalysis'
import {
  buildCsvFileText,
  buildDisplayIds,
  cellKey,
  cellTextTransforms,
  describeCsvChanges,
  getCellText,
  getDisplayColumnIds,
  getOriginalCellText,
  isInsertedLine,
  mergeColumnsInTable,
  parseCellKey,
  readTable,
  splitColumnInTable,
  transposeTable,
  withCellText,
  withCellTexts,
  withDeletedLine,
  withDeletedRows,
  withFilledDown,
  withInsertedLine,
  withMappedCells,
  withMovedColumn,
  withRebuiltTable,
  withRestoredRow,
  withoutDuplicateRows,
  withoutEmptyRows,
} from './csvCells'
import type { CellTextTransform, CsvEdits, CsvFileOptions } from './csvCells'
import './csvWorkbench.css'

const MAX_LISTED_CHANGES = 200
const MAX_FILTER_VALUES = 200
const MAX_SPLIT_PARTS = 10
const TOAST_MS = 3200
const PHONE_QUERY = '(max-width: 760px)'
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const shortcutLabel = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`)

const headerMeasuringContext = document.createElement('canvas').getContext('2d')
const MAX_MEASURED_COLUMN_WIDTH_PX = 320

// A header holds the name, the type label and the menu button, so the column is at least that wide.
function measureHeaderWidthPx(name: string, typeLabel: string) {
  if (!headerMeasuringContext) return 120
  headerMeasuringContext.font = '600 12.5px system-ui, sans-serif'
  const nameWidth = headerMeasuringContext.measureText(name).width
  headerMeasuringContext.font = '500 10.5px system-ui, sans-serif'
  return Math.ceil(nameWidth + headerMeasuringContext.measureText(typeLabel).width + 34)
}

const ENCODING_CHOICES: EncodingChoice[] = ['auto', 'utf-8', 'utf-16le', 'utf-16be', 'windows-1256', 'iso-8859-1']

// The icons, drawn once and used by name (as in the design file). Static markup, no file content.
const ICON_SPRITE = `<defs>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
<symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/></symbol>
<symbol id="i-sort" viewBox="0 0 24 24"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M14 6h7M14 11h5M14 16h3"/></symbol>
<symbol id="i-group" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></symbol>
<symbol id="i-columns" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M14.5 4.5v15"/></symbol>
<symbol id="i-wand" viewBox="0 0 24 24"><path d="m4 20 11-11M14 4v2M18 8h2M17 4.5l-1.2 1.2M19.5 11l-1.2-1.2M13 9l2 2"/></symbol>
<symbol id="i-replace" viewBox="0 0 24 24"><path d="M4 7h10l-3-3M20 17H10l3 3"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="17" r="2"/></symbol>
<symbol id="i-goto" viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5"/><path d="M4 5v14"/></symbol>
<symbol id="i-rows" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></symbol>
<symbol id="i-redo" viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></symbol>
<symbol id="i-open" viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M6 3.5h8l4.5 4.5v12.5H6z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h6"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></symbol>
<symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></symbol>
<symbol id="i-paste" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="15.5" rx="2"/><path d="M9 5V3.5h6V5"/></symbol>
<symbol id="i-grid-x" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M10 4.5v15"/></symbol>
<symbol id="i-review" viewBox="0 0 24 24"><path d="M5 5h14M5 10h14M5 15h8"/><path d="m15 18 2 2 4-4"/></symbol>
<symbol id="i-grip" viewBox="0 0 10 16"><circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>
<symbol id="i-more" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 19.5h16"/><rect x="5.5" y="11" width="3" height="6" rx=".6"/><rect x="10.5" y="6" width="3" height="11" rx=".6"/><rect x="15.5" y="13" width="3" height="4" rx=".6"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M9 4h6l-1 5 3 3H7l3-3zM12 12v8"/></symbol>
<symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c5 0 8.5 6 8.5 6a15 15 0 0 1-3 3.5M6.6 7.7A15 15 0 0 0 3.5 12S7 18 12 18a8 8 0 0 0 3.4-.8"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></symbol>
<symbol id="i-panel" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></symbol>
</defs>`

type DockTab = 'profile' | 'group' | 'issues' | 'changes'
type CleanTool = 'split' | 'merge' | 'dupes' | 'transpose'
type PopoverKind = 'column' | 'filterPick' | 'sort' | 'columns' | 'clean' | 'file' | 'reading' | 'more' | 'find' | 'context'
type Popover = { kind: PopoverKind; anchor: HTMLElement | null; point?: { x: number; y: number }; columnPosition?: number }
type Toast = { id: number; message: string; canUndo: boolean }
type FindState = { text: string; replacement: string; matchCase: boolean; wholeCell: boolean; isRegularExpression: boolean; columnId: number | null }
type DownloadSettings = { fileName: string; onlyShownRows: boolean; delimiter: string; lineEnding: '\n' | '\r\n'; includeHeaderRow: boolean; quoteAllFields: boolean; byteOrderMark: boolean }
type ColumnDraft = {
  columnId: number
  nameDraft: string
  textKind: 'in' | 'contains' | 'equals' | 'empty' | 'notEmpty'
  textValue: string
  chosenValues: ReadonlySet<string>
  minText: string
  maxText: string
  fromDate: string
  toDate: string
  boolValue: '' | 'true' | 'false'
}
type Issue = { kind: 'warn' | 'info'; title: string; detail: string; goTo?: { rowId: number; columnId: number }; showBlanksOf?: number }

function Icon({ name, size = '', className = '', flipped = false }: { name: string; size?: '' | 'sm' | 'xs'; className?: string; flipped?: boolean }) {
  return (
    <svg className={`ico${size ? ` ${size}` : ''}${className ? ` ${className}` : ''}`} aria-hidden="true" style={flipped ? { transform: 'scaleY(-1)' } : undefined}>
      <use href={`#i-${name}`} />
    </svg>
  )
}

function formatNumber(number: number | null | undefined, decimals: number) {
  if (number === null || number === undefined || Number.isNaN(number)) return '—'
  return number.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatShortDate(text: string, locale: Locale) {
  const time = Date.parse(text.slice(0, 10))
  if (Number.isNaN(time)) return text
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(time)
}

function useIsNarrowScreen() {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY)
    const update = () => setIsNarrow(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isNarrow
}

// A native modal <dialog> that is open while `isOpen` is true; Escape and the backdrop close it through `onClose`.
function WorkbenchDialog({ id, titleId, isOpen, onClose, children }: { id: string; titleId: string; isOpen: boolean; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])
  return (
    <dialog id={id} ref={dialogRef} aria-labelledby={titleId} onClose={onClose}>
      {isOpen && children}
    </dialog>
  )
}

function HistogramChart({ numbers, decimals, columnName, activeRange, onBinClick }: { numbers: number[]; decimals: number; columnName: string; activeRange?: { min: number | null; max: number | null }; onBinClick?: (from: number, to: number) => void }) {
  const { t } = useT()
  const bins = buildHistogram(numbers, 10)
  if (bins.length === 0) return null
  const width = 320
  const height = 96
  const tallest = Math.max(...bins.map((bin) => bin.count))
  const binWidth = (width - 8) / bins.length
  const min = bins[0].from
  const max = bins[bins.length - 1].to
  return (
    <svg className="hist" viewBox={`0 0 ${width} ${height + 18}`} role="img" aria-label={t('csv.wb.histogramLabel', { name: columnName, from: formatNumber(min, decimals), to: formatNumber(max, decimals) })}>
      {bins.map((bin, binPosition) => {
        const barHeight = bin.count ? Math.max(3, (bin.count / tallest) * (height - 14)) : 0
        const isInRange = !activeRange || ((activeRange.min === null || bin.to >= activeRange.min) && (activeRange.max === null || bin.from <= activeRange.max))
        return (
          <g key={binPosition} onClick={onBinClick ? () => onBinClick(bin.from, bin.to) : undefined} style={onBinClick ? { cursor: 'pointer' } : undefined}>
            <rect className={`b${isInRange ? ' in' : ''}`} x={4 + binPosition * binWidth + 1.5} y={height - barHeight} width={binWidth - 3} height={barHeight} rx="2">
              <title>{t('csv.wb.histogramBin', { from: formatNumber(bin.from, decimals), to: formatNumber(bin.to, decimals), count: bin.count })}</title>
            </rect>
            {bin.count > 0 && (
              <text x={4 + binPosition * binWidth + binWidth / 2} y={height - barHeight - 3} textAnchor="middle">
                {bin.count}
              </text>
            )}
          </g>
        )
      })}
      <line className="axis" x1="4" x2={width - 4} y1={height + 0.5} y2={height + 0.5} />
      <text x="4" y={height + 13}>
        {formatNumber(min, decimals)}
      </text>
      <text x={width / 2} y={height + 13} textAnchor="middle">
        {formatNumber(min + (max - min) / 2, decimals)}
      </text>
      <text x={width - 4} y={height + 13} textAnchor="end">
        {formatNumber(max, decimals)}
      </text>
    </svg>
  )
}

function WeekChart({ dateTexts, locale }: { dateTexts: string[]; locale: Locale }) {
  const { t } = useT()
  const weekCounts = countRowsPerWeek(dateTexts)
  if (weekCounts.length === 0) return null
  const width = 320
  const height = 80
  const tallest = Math.max(...weekCounts)
  const barWidth = (width - 8) / weekCounts.length
  const sorted = [...dateTexts].sort()
  return (
    <svg className="hist" viewBox={`0 0 ${width} ${height + 18}`} role="img" aria-label={t('csv.wb.rowsPerWeek')}>
      {weekCounts.map((count, week) => {
        const barHeight = count ? Math.max(3, (count / tallest) * (height - 14)) : 0
        return (
          <g key={week}>
            <rect className="b in" x={4 + week * barWidth + 2} y={height - barHeight} width={Math.max(1, barWidth - 4)} height={barHeight} rx="2">
              <title>{t('csv.wb.weekBar', { week: week + 1, count })}</title>
            </rect>
            {count > 0 && (
              <text x={4 + week * barWidth + barWidth / 2} y={height - barHeight - 3} textAnchor="middle">
                {count}
              </text>
            )}
          </g>
        )
      })}
      <line className="axis" x1="4" x2={width - 4} y1={height + 0.5} y2={height + 0.5} />
      <text x="4" y={height + 13}>
        {formatShortDate(sorted[0], locale)}
      </text>
      <text x={width - 4} y={height + 13} textAnchor="end">
        {formatShortDate(sorted[sorted.length - 1], locale)}
      </text>
    </svg>
  )
}

// The CSV file page ("Grid studio"): its own top bar and command bar, a full-height grid with filters, multi-column sort and
// frozen columns, a side panel (column profile, group by, issues, changes) and a status bar with selection stats. It fills the
// whole screen (the format is `ownsWholePage`). Every change goes through the shared edit session (one change, one undo step);
// filters, sort, hidden and frozen columns and widths are view settings that the download can use or leave out.
export default function CsvViewer({ openedFile, session: untypedSession, confirmDiscardEdits, onOpenAnotherFile, onOpenFile, onClose }: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const session = untypedSession as EditSession<CsvEdits>
  const edits = session.edits
  const { reset: resetEditSession } = session
  const fileName = openedFile.file.name
  const tableFormat = findTableFormat(fileName)
  const isNarrow = useIsNarrowScreen()
  const isPhone = useIsPhone()
  const { showToast: showSiteToast, dismissToast: dismissSiteToast } = useToast()

  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>(tableFormat.defaultDelimiter)
  const [encodingChoice, setEncodingChoice] = useState<EncodingChoice>('auto')
  const [hasHeaderRow, setHasHeaderRow] = useState(tableFormat.headerRow === 'always')
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<ColumnFilter[]>([])
  const [matchAllFilters, setMatchAllFilters] = useState(true)
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([])
  const [hiddenColumnIds, setHiddenColumnIds] = useState<ReadonlySet<number>>(new Set())
  const [frozenCount, setFrozenCount] = useState(1)
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<ReadonlyMap<number, number>>(new Map())
  const [typeOverrides, setTypeOverrides] = useState<ReadonlyMap<number, ColumnType>>(new Map())
  const [selectedColumnId, setSelectedColumnId] = useState<number | null>(null)
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ r: number; c: number; draft: string } | null>(null)
  const [valueDraft, setValueDraft] = useState<string | null>(null)
  const [dockTab, setDockTab] = useState<DockTab>('profile')
  const [isDockOpen, setIsDockOpen] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [dockWidthPx, setDockWidthPx] = useState(316)
  const [popover, setPopover] = useState<Popover | null>(null)
  const [columnDraft, setColumnDraft] = useState<ColumnDraft | null>(null)
  const [downloadDraft, setDownloadDraft] = useState<DownloadSettings | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [goToText, setGoToText] = useState('')
  const [openDialog, setOpenDialog] = useState<'download' | 'paste' | 'goTo' | 'clean' | null>(null)
  const [cleanTool, setCleanTool] = useState<CleanTool>('split')
  const [find, setFind] = useState<FindState>({ text: '', replacement: '', matchCase: false, wholeCell: false, isRegularExpression: false, columnId: null })
  const [groupSettings, setGroupSettings] = useState<{ byColumnId: number | null; aggregate: GroupAggregate; ofColumnId: number | null }>({ byColumnId: null, aggregate: 'sum', ofColumnId: null })
  const [toast, setToast] = useState<Toast | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const deferredSearchText = useDeferredValue(searchText.trim())
  const gridRef = useRef<CsvGridHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const editsRef = useRef(edits)
  const isDraggingSelectionRef = useRef(false)
  const toastTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    editsRef.current = edits
  }, [edits])

  const pageTitle = t('file.title', { name: fileName })
  useEffect(() => {
    const previousTitle = document.title
    document.title = pageTitle
    return () => {
      document.title = previousTitle
    }
  }, [pageTitle])

  // Parse after the "Reading file" state has painted, so the page never looks frozen.
  useEffect(() => {
    // A new file, delimiter or encoding starts from a clean state; this is the reset, not a value derived from other state.
    // oxlint-disable-next-line react/set-state-in-effect
    setParsedCsv(null)
    setSortLevels([])
    setFilters([])
    setSelection(null)
    setActive(null)
    setEditingCell(null)
    resetEditSession()
    const parseTimerId = setTimeout(() => {
      const newParsedCsv = parseCsv(openedFile.contents, delimiterChoice, encodingChoice)
      if (newParsedCsv.status === 'ok' && tableFormat.headerRow !== 'always') setHasHeaderRow(firstRowLooksLikeHeader(newParsedCsv.rows))
      setParsedCsv(newParsedCsv)
    }, 0)
    return () => clearTimeout(parseTimerId)
  }, [openedFile, delimiterChoice, encodingChoice, tableFormat.headerRow, resetEditSession])

  const readableCsv = parsedCsv?.status === 'ok' ? parsedCsv : null
  const parsedRows = readableCsv?.rows
  const rows = useMemo(() => edits.table ?? parsedRows ?? [], [edits.table, parsedRows])
  const columnCount = edits.table ? Math.max(0, ...edits.table.map((row) => row.length)) : (readableCsv?.columnCount ?? 0)
  const firstDataRowId = hasHeaderRow ? 1 : 0

  const displayColumnIds = useMemo(() => getDisplayColumnIds(edits, columnCount), [edits, columnCount])
  const displayRowIds = useMemo(
    () => buildDisplayIds(firstDataRowId, rows.length, edits.deletedRowIds, edits.insertedRows),
    [firstDataRowId, rows.length, edits.deletedRowIds, edits.insertedRows],
  )

  const getText = (rowId: number, columnId: number) => getCellText(rows, edits, rowId, columnId)
  const columnNameById = useMemo(() => {
    const names = new Map<number, string>()
    displayColumnIds.forEach((columnId, columnPosition) => {
      names.set(columnId, (hasHeaderRow ? getCellText(rows, edits, 0, columnId).trim() : '') || t('csv.columnName', { number: columnPosition + 1 }))
    })
    return names
  }, [displayColumnIds, hasHeaderRow, rows, edits, t])
  const nameOf = (columnId: number) => columnNameById.get(columnId) ?? ''

  // What each column holds, read from its first filled cells; "Read as" in the profile can change it.
  const detectedInfoById = useMemo(() => {
    const infos = new Map<number, ColumnInfo>()
    for (const columnId of displayColumnIds) infos.set(columnId, detectColumnInfo((rowId) => getCellText(rows, editsRef.current, rowId, columnId), displayRowIds))
    return infos
  }, [displayColumnIds, displayRowIds, rows])
  const infoOf = (columnId: number): ColumnInfo => {
    const detected = detectedInfoById.get(columnId) ?? { type: 'text', decimals: 0, isRightToLeft: false }
    const override = typeOverrides.get(columnId)
    return override ? { ...detected, type: override, decimals: override === 'number' ? Math.max(detected.decimals, 0) : 0 } : detected
  }
  const typeOf = (columnId: number) => infoOf(columnId).type

  // The column types as one value, so memos can depend on them.
  const typesKey = displayColumnIds.map((columnId) => typeOf(columnId)).join(',')
  const shownColumnIds = useMemo(() => displayColumnIds.filter((columnId) => !hiddenColumnIds.has(columnId)), [displayColumnIds, hiddenColumnIds])
  const measuredWidths = useMemo(() => {
    if (!parsedRows) return new Map<number, number>()
    const names = displayColumnIds.map((columnId) => columnNameById.get(columnId) ?? '')
    const widths = measureColumnWidthsPx(displayColumnIds, names, firstDataRowId, rows.length, (rowId, columnId) => getOriginalCellText(rows, rowId, columnId))
    return new Map(
      displayColumnIds.map((columnId, position) => {
        const headerWidth = measureHeaderWidthPx(names[position], t(COLUMN_TYPE_LABEL_KEYS[typesKey.split(',')[position] as ColumnType]))
        return [columnId, Math.min(MAX_MEASURED_COLUMN_WIDTH_PX, Math.max(widths[position], headerWidth))]
      }),
    )
    // typesKey stands for the column types.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRows, displayColumnIds, columnNameById, firstDataRowId, rows, typesKey, t])

  // The rows on screen: filters, then search, then sort. They read the edits as they were when one of these last changed (so a
  // row never jumps away while it is edited).
  const visibleRowIds = useMemo(() => {
    const currentEdits = editsRef.current
    const read = (rowId: number, columnId: number) => getCellText(rows, currentEdits, rowId, columnId)
    let rowIds: readonly number[] = displayRowIds
    if (filters.length > 0) {
      rowIds = rowIds.filter((rowId) => (matchAllFilters ? filters.every((filter) => passesFilter(read(rowId, filter.columnId), filter)) : filters.some((filter) => passesFilter(read(rowId, filter.columnId), filter))))
    }
    const search = deferredSearchText.toLowerCase()
    if (search !== '') rowIds = rowIds.filter((rowId) => isInsertedLine(rowId) || shownColumnIds.some((columnId) => read(rowId, columnId).toLowerCase().includes(search)))
    const typeByColumnId = new Map(typesKey.split(',').map((type, position) => [displayColumnIds[position], type as ColumnType]))
    return sortRowIds(rowIds, sortLevels, read, (columnId) => typeByColumnId.get(columnId) ?? 'text')
    // typesKey stands for the column types.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRowIds, filters, matchAllFilters, deferredSearchText, sortLevels, rows, shownColumnIds, typesKey])

  const gridColumns: GridColumn[] = shownColumnIds.map((columnId, position) => ({
    id: columnId,
    name: nameOf(columnId),
    letter: columnLabel(position),
    type: typeOf(columnId),
    widthPx: columnWidthOverrides.get(columnId) ?? measuredWidths.get(columnId) ?? 120,
    isRightToLeft: infoOf(columnId).isRightToLeft,
  }))
  const shownFrozenCount = Math.min(frozenCount, Math.max(0, gridColumns.length - 1))

  // Rows the file wrote with fewer fields than the header (only for the file as read).
  const unevenRowIds = useMemo(() => {
    if (!parsedRows || edits.table) return []
    return displayRowIds.filter((rowId) => rowId >= 0 && parsedRows[rowId].length < columnCount)
  }, [parsedRows, edits.table, displayRowIds, columnCount])
  const isMissing = (rowId: number, columnId: number) => !edits.table && rowId >= 0 && columnId >= 0 && parsedRows !== undefined && columnId >= parsedRows[rowId].length && columnId < columnCount
  const rowNumberOf = (rowId: number) => (isInsertedLine(rowId) ? t('csv.wb.newRow') : String(rowId - firstDataRowId + 1))
  const isEdited = (rowId: number, columnId: number) => edits.cells.has(cellKey(rowId, columnId)) || isInsertedLine(rowId) || isInsertedLine(columnId)

  // ---------------------------------------------------------------- messages
  function showToast(message: string, canUndo = false) {
    window.clearTimeout(toastTimerRef.current)
    setToast({ id: Date.now(), message, canUndo })
    toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }

  // One change: one undo step, and an optional message with Undo.
  function applyEdits(newEdits: CsvEdits, message?: string) {
    if (newEdits === edits) return false
    session.update(() => newEdits)
    if (message) showToast(message, true)
    return true
  }

  // ---------------------------------------------------------------- selection and editing
  const activeRowId = active ? visibleRowIds[active.r] : undefined
  const activeColumnId = active ? shownColumnIds[active.c] : undefined
  const hasActiveCell = activeRowId !== undefined && activeColumnId !== undefined

  function selectCell(rowPosition: number, columnPosition: number, extend = false) {
    if (rowPosition < 0 || columnPosition < 0 || rowPosition >= visibleRowIds.length || columnPosition >= shownColumnIds.length) return
    setSelection((current) => (extend && current ? { ...current, r1: rowPosition, c1: columnPosition } : { r0: rowPosition, c0: columnPosition, r1: rowPosition, c1: columnPosition }))
    setActive({ r: rowPosition, c: columnPosition })
    setValueDraft(null)
    setSelectedColumnId(shownColumnIds[columnPosition])
    gridRef.current?.scrollToCell(rowPosition, columnPosition)
  }

  function selectionPositions() {
    if (!selection) return []
    const positions: { r: number; c: number }[] = []
    for (let r = Math.min(selection.r0, selection.r1); r <= Math.max(selection.r0, selection.r1); r++) {
      for (let c = Math.min(selection.c0, selection.c1); c <= Math.max(selection.c0, selection.c1); c++) {
        if (r < visibleRowIds.length && c < shownColumnIds.length) positions.push({ r, c })
      }
    }
    return positions
  }

  function commitCell(rowId: number, columnId: number, text: string) {
    session.update((currentEdits) => withCellText(currentEdits, { rowId, columnId }, getOriginalCellText(rows, rowId, columnId), text))
  }

  function startEditing(rowPosition: number, columnPosition: number, initialText?: string) {
    const rowId = visibleRowIds[rowPosition]
    const columnId = shownColumnIds[columnPosition]
    if (rowId === undefined || columnId === undefined) return
    setEditingCell({ r: rowPosition, c: columnPosition, draft: initialText ?? getText(rowId, columnId) })
  }

  function finishEditing(shouldSave: boolean, moveAfter?: 'down' | 'right') {
    if (!editingCell) return
    const { r, c, draft } = editingCell
    setEditingCell(null)
    if (shouldSave) commitCell(visibleRowIds[r], shownColumnIds[c], draft)
    gridRef.current?.focus()
    if (moveAfter === 'down') selectCell(Math.min(r + 1, visibleRowIds.length - 1), c)
    if (moveAfter === 'right') selectCell(r, Math.min(c + 1, shownColumnIds.length - 1))
  }

  function selectColumn(columnPosition: number) {
    const columnId = shownColumnIds[columnPosition]
    setSelectedColumnId(columnId)
    if (visibleRowIds.length > 0) {
      setSelection({ r0: 0, c0: columnPosition, r1: visibleRowIds.length - 1, c1: columnPosition })
      setActive({ r: 0, c: columnPosition })
    }
    if (dockTab !== 'group') setDockTab('profile')
  }

  function copySelection(withByteOrderMark: boolean) {
    if (!selection) return
    const lines: string[] = []
    for (let r = Math.min(selection.r0, selection.r1); r <= Math.max(selection.r0, selection.r1); r++) {
      const parts: string[] = []
      for (let c = Math.min(selection.c0, selection.c1); c <= Math.max(selection.c0, selection.c1); c++) parts.push(getText(visibleRowIds[r], shownColumnIds[c]))
      lines.push(parts.join('\t'))
    }
    const cellCount = selectionPositions().length
    navigator.clipboard.writeText(`${withByteOrderMark ? '﻿' : ''}${lines.join('\n')}`).then(
      () => showToast(withByteOrderMark ? tp('csv.wb.copiedForExcel', cellCount) : tp('csv.wb.copiedCells', cellCount)),
      () => showToast(t('csv.wb.copyNotAllowed')),
    )
  }

  function pasteText(text: string) {
    if (!active) return
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((line) => line.split('\t'))
    const changes = lines.flatMap((parts, rowOffset) =>
      parts.flatMap((part, columnOffset) => {
        const rowId = visibleRowIds[active.r + rowOffset]
        const columnId = shownColumnIds[active.c + columnOffset]
        return rowId === undefined || columnId === undefined ? [] : [{ rowId, columnId, text: part }]
      }),
    )
    const { edits: pastedEdits, changedCount } = withCellTexts(edits, rows, changes)
    applyEdits(pastedEdits, tp('csv.wb.pastedCells', changedCount))
  }

  function clearSelectedCells() {
    const changes = selectionPositions().map(({ r, c }) => ({ rowId: visibleRowIds[r], columnId: shownColumnIds[c], text: '' }))
    applyEdits(withCellTexts(edits, rows, changes).edits)
  }

  function deleteSelectedRows() {
    const rowIds = [...new Set(selectionPositions().map(({ r }) => visibleRowIds[r]))]
    if (rowIds.length === 0) return
    setSelection(null)
    setActive(null)
    applyEdits(withDeletedRows(edits, rowIds), tp('csv.wb.rowsDeleted', rowIds.length))
  }

  function addRow() {
    const lastRowId = displayRowIds.length > 0 ? displayRowIds[displayRowIds.length - 1] : -1
    const newRowId = edits.nextRowId
    applyEdits(withInsertedLine(edits, 'row', lastRowId), t('csv.wb.rowAdded'))
    setFilters([])
    setSearchText('')
    pendingRevealRowIdRef.current = newRowId
  }
  const pendingRevealRowIdRef = useRef<number | null>(null)
  useEffect(() => {
    const rowId = pendingRevealRowIdRef.current
    if (rowId === null) return
    const rowPosition = visibleRowIds.indexOf(rowId)
    if (rowPosition === -1) return
    pendingRevealRowIdRef.current = null
    selectCell(rowPosition, 0)
    // Only when the shown rows change after an add.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRowIds])

  function insertColumnAfter(columnId: number) {
    applyEdits(withInsertedLine(edits, 'column', columnId), t('csv.wb.columnInserted'))
  }

  function deleteColumn(columnId: number) {
    if (displayColumnIds.length <= 1) return
    applyEdits(withDeletedLine(edits, 'column', columnId), t('csv.wb.columnDeleted', { name: nameOf(columnId) }))
    if (selectedColumnId === columnId) setSelectedColumnId(null)
  }

  function renameColumn(columnId: number, newName: string) {
    if (!hasHeaderRow || newName.trim() === '' || newName === nameOf(columnId)) return
    commitCell(0, columnId, newName.trim())
    showToast(t('csv.wb.columnRenamed', { name: newName.trim() }), true)
  }

  function moveColumn(columnId: number, toPosition: number) {
    applyEdits(withMovedColumn(edits, displayColumnIds, columnId, toPosition))
  }

  function transformSelectedColumn(transform: CellTextTransform | 'fillDown') {
    if (selectedColumnId === null) return
    const name = nameOf(selectedColumnId)
    const newEdits = transform === 'fillDown' ? withFilledDown(edits, rows, visibleRowIds, selectedColumnId) : withMappedCells(edits, rows, visibleRowIds, [selectedColumnId], cellTextTransforms[transform]).edits
    if (!applyEdits(newEdits, t('csv.wb.columnChanged', { name }))) showToast(t('csv.wb.nothingToChange', { name }))
  }

  function rebuildTable(newTable: string[][], message: string) {
    applyEdits(withRebuiltTable(newTable), message)
    setFilters([])
    setSortLevels([])
    setSelection(null)
    setActive(null)
    setSelectedColumnId(null)
    setHiddenColumnIds(new Set())
    setColumnWidthOverrides(new Map())
    setTypeOverrides(new Map())
  }

  function currentTable(rowIds: readonly number[]) {
    return readTable(rows, edits, hasHeaderRow ? [0, ...rowIds] : rowIds, displayColumnIds)
  }

  function applySortToFile() {
    if (sortLevels.length === 0) return
    const sortedRowIds = sortRowIds(displayRowIds, sortLevels, getText, typeOf)
    rebuildTable(currentTable(sortedRowIds), t('csv.wb.sortApplied'))
  }

  function goToRow(rowNumberText: string) {
    const match = /^\s*([A-Za-z]*)\s*(\d+)\s*$/.exec(rowNumberText)
    if (!match) {
      showToast(t('csv.wb.goToHelp'))
      return
    }
    const rowId = Number(match[2]) - 1 + firstDataRowId
    const columnPosition = match[1] ? shownColumnIds.findIndex((_, position) => columnLabel(position) === match[1].toUpperCase()) : (active?.c ?? 0)
    if (!displayRowIds.includes(rowId)) {
      showToast(t('csv.wb.noSuchRow', { row: match[2] }))
      return
    }
    const rowPosition = visibleRowIds.indexOf(rowId)
    if (rowPosition === -1) {
      setFilters([])
      setSearchText('')
      showToast(t('csv.wb.filtersClearedToShow', { row: match[2] }))
      pendingGoToRef.current = { rowId, columnPosition: Math.max(0, columnPosition) }
      return
    }
    selectCell(rowPosition, Math.max(0, columnPosition))
    gridRef.current?.focus()
  }
  const pendingGoToRef = useRef<{ rowId: number; columnPosition: number } | null>(null)
  useEffect(() => {
    const pending = pendingGoToRef.current
    if (!pending) return
    const rowPosition = visibleRowIds.indexOf(pending.rowId)
    if (rowPosition === -1) return
    pendingGoToRef.current = null
    selectCell(rowPosition, pending.columnPosition)
    // Only when the shown rows change after a cleared filter.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRowIds])

  function goToCell(rowId: number, columnId: number) {
    const columnPosition = Math.max(0, shownColumnIds.indexOf(columnId))
    goToRow(`${columnLabel(columnPosition)}${rowId - firstDataRowId + 1}`)
    setIsSheetOpen(false)
  }

  function setFilter(columnId: number, filter: ColumnFilter | null) {
    setFilters((current) => {
      const others = current.filter((existing) => existing.columnId !== columnId)
      return filter ? [...others, filter] : others
    })
    setSelection(null)
    setActive(null)
  }

  function filterToValue(columnId: number, text: string) {
    const type = typeOf(columnId)
    const number = parseNumber(text)
    setFilter(
      columnId,
      type === 'bool' ? { columnId, kind: 'bool', value: text.toLowerCase() === 'true' ? 'true' : 'false' } : type === 'number' && number !== null ? { columnId, kind: 'range', min: number, max: number } : { columnId, kind: 'in', values: [text] },
    )
  }

  // ---------------------------------------------------------------- find and replace
  const findPattern = buildFindPattern(find.text, find)
  const isFindInvalid = find.isRegularExpression && find.text !== '' && findPattern === null
  const findMatches = popover?.kind === 'find' && findPattern ? (text: string) => text.search(findPattern) !== -1 : null
  const findColumnIds = find.columnId === null ? shownColumnIds : [find.columnId]
  const findHits = useMemo(() => {
    if (popover?.kind !== 'find' || !findPattern) return []
    const hits: { rowId: number; columnId: number; text: string; newText: string }[] = []
    for (const rowId of visibleRowIds) {
      for (const columnId of findColumnIds) {
        const text = getText(rowId, columnId)
        if (text.search(findPattern) === -1) continue
        hits.push({ rowId, columnId, text, newText: text.replace(findPattern, find.replacement) })
      }
    }
    return hits
    // The pattern is rebuilt from `find` on every render; `find` and the rows decide the hits.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [popover?.kind, find, visibleRowIds, edits, rows, shownColumnIds])

  function replaceAllFound() {
    const { edits: replacedEdits, changedCount } = withCellTexts(
      edits,
      rows,
      findHits.map((hit) => ({ rowId: hit.rowId, columnId: hit.columnId, text: hit.newText })),
    )
    applyEdits(replacedEdits, tp('csv.wb.replacedCells', changedCount))
    setPopover(null)
  }

  function goToNextFound() {
    if (findHits.length === 0) return
    const positions = findHits.map((hit) => ({ r: visibleRowIds.indexOf(hit.rowId), c: shownColumnIds.indexOf(hit.columnId) }))
    const next = positions.find((position) => active === null || position.r > active.r || (position.r === active.r && position.c > active.c)) ?? positions[0]
    selectCell(next.r, next.c)
  }

  // ---------------------------------------------------------------- download
  const defaultDownloadSettings = (): DownloadSettings => ({
    fileName: buildDownloadName(fileName, session.changeCount > 0, null),
    onlyShownRows: false,
    delimiter: readableCsv?.detectedDelimiter ?? ',',
    lineEnding: readableCsv?.usesCrlf ? '\r\n' : '\n',
    includeHeaderRow: hasHeaderRow,
    quoteAllFields: false,
    byteOrderMark: (readableCsv?.hasUtf8Bom ?? false) || rows.some((row) => row.some((cellText) => /[^\p{ASCII}]/u.test(cellText))),
  })

  function downloadCsv(settings: DownloadSettings) {
    const options: CsvFileOptions = {
      rowIds: settings.onlyShownRows ? visibleRowIds : displayRowIds,
      columnIds: settings.onlyShownRows ? shownColumnIds : displayColumnIds,
      includeHeaderRow: settings.includeHeaderRow && hasHeaderRow,
      delimiter: settings.delimiter,
      lineEnding: settings.lineEnding,
      quoteAllFields: settings.quoteAllFields,
      byteOrderMark: settings.byteOrderMark,
    }
    downloadTextFile(settings.fileName, buildCsvFileText(rows, edits, options), `${tableFormat.mimeType};charset=utf-8`)
    showToast(tp('csv.wb.saved', options.rowIds.length, { name: settings.fileName }))
  }

  // Excel shows Arabic letters as garbled text unless the file starts with the UTF-8 marker, so offer a copy that has it.
  const offersExcelCopy = readableCsv !== null && !readableCsv.hasUtf8Bom && rows.some((row) => row.some((cellText) => /[؀-ۿ]/.test(cellText)))
  function downloadExcelCopy() {
    const settings = defaultDownloadSettings()
    downloadCsv({ ...settings, fileName: settings.fileName.replace(/(\.[^.]*)?$/, '-excel$1'), byteOrderMark: true, lineEnding: '\r\n' })
  }
  const downloadExcelCopyRef = useRef(downloadExcelCopy)
  useEffect(() => {
    downloadExcelCopyRef.current = downloadExcelCopy
  })
  const excelCopyReason = t('csv.excelCopy.reason')
  const excelCopyButtonLabel = t('csv.excelCopy.button')
  useEffect(() => {
    if (!isPhone || !offersExcelCopy) return
    const toastId = showSiteToast({ message: excelCopyReason, kind: 'info', action: { label: excelCopyButtonLabel, onClick: () => downloadExcelCopyRef.current() } })
    return () => dismissSiteToast(toastId)
  }, [isPhone, offersExcelCopy, excelCopyReason, excelCopyButtonLabel, showSiteToast, dismissSiteToast])

  // ---------------------------------------------------------------- reading options
  async function changeReading(change: () => void) {
    if (session.changeCount > 0 && !(await confirmDiscardEdits())) return
    change()
  }

  // ---------------------------------------------------------------- page shortcuts
  const latestShortcutsRef = useRef({ focusSearch: () => {}, openGoTo: () => {}, closePopover: () => {} })
  useEffect(() => {
    latestShortcutsRef.current = {
      focusSearch: () => searchInputRef.current?.focus(),
      openGoTo: openGoToDialog,
      closePopover: () => setPopover(null),
    }
  })
  useEffect(() => {
    function runShortcut(event: KeyboardEvent) {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      const hasModifier = event.metaKey || event.ctrlKey
      if (event.key === 'Escape') latestShortcutsRef.current.closePopover()
      else if (hasModifier && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        latestShortcutsRef.current.openGoTo()
      } else if ((hasModifier && event.key.toLowerCase() === 'k') || (event.key === '/' && !isTyping)) {
        event.preventDefault()
        latestShortcutsRef.current.focusSearch()
      }
    }
    window.addEventListener('keydown', runShortcut)
    return () => window.removeEventListener('keydown', runShortcut)
  }, [])

  useEffect(() => {
    function stopDraggingSelection() {
      isDraggingSelectionRef.current = false
    }
    document.addEventListener('mouseup', stopDraggingSelection)
    return () => document.removeEventListener('mouseup', stopDraggingSelection)
  }, [])

  // A click outside the open popover closes it.
  useEffect(() => {
    if (!popover) return
    function closeOnOutsideMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || popover?.anchor?.contains(target)) return
      setPopover(null)
    }
    document.addEventListener('mousedown', closeOnOutsideMouseDown)
    return () => document.removeEventListener('mousedown', closeOnOutsideMouseDown)
  }, [popover])

  // The popover opens under its button (or at the pointer), kept on screen.
  useLayoutEffect(() => {
    const element = popoverRef.current
    if (!popover || !element || isNarrow) return
    const anchorBox = popover.anchor?.getBoundingClientRect() ?? { left: popover.point?.x ?? 0, bottom: popover.point?.y ?? 0, top: popover.point?.y ?? 0 }
    const width = element.offsetWidth
    const height = element.offsetHeight
    const left = Math.max(8, Math.min(anchorBox.left, window.innerWidth - width - 8))
    const top = anchorBox.bottom + 6 + height > window.innerHeight - 8 ? Math.max(8, anchorBox.top - height - 6) : anchorBox.bottom + 6
    element.style.left = `${left}px`
    element.style.top = `${top}px`
    element.querySelector<HTMLElement>('input,select,button')?.focus({ preventScroll: true })
  }, [popover, isNarrow])

  function openPopover(kind: PopoverKind, anchor: HTMLElement | null, extra: Partial<Popover> = {}) {
    setPopover({ kind, anchor, ...extra })
  }

  // The values a column's filter offers: its texts with counts, or its numbers, or its dates (from all shown rows).
  function readColumnMenuValues(columnId: number) {
    const type = typeOf(columnId)
    const counts = new Map<string, number>()
    const numbers: number[] = []
    const dates: string[] = []
    for (const rowId of displayRowIds) {
      const text = getText(rowId, columnId)
      if (type === 'text') counts.set(text, (counts.get(text) ?? 0) + 1)
      if (type === 'number') {
        const number = parseNumber(text)
        if (number !== null) numbers.push(number)
      }
      if (type === 'date' && text !== '') dates.push(text)
    }
    return { valueCounts: [...counts.entries()].sort((first, second) => first[0].localeCompare(second[0])), numbers, dates: dates.sort() }
  }
  const columnMenuColumnId = popover?.kind === 'column' && columnDraft ? columnDraft.columnId : null
  const columnMenuValues = useMemo(
    () => (columnMenuColumnId === null ? { valueCounts: [] as [string, number][], numbers: [] as number[], dates: [] as string[] } : readColumnMenuValues(columnMenuColumnId)),
    // Read once when the menu opens for a column.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [columnMenuColumnId],
  )

  function openColumnMenu(columnPosition: number, anchor: HTMLElement | null) {
    const columnId = shownColumnIds[columnPosition]
    if (columnId === undefined) return
    const existing = filters.find((filter) => filter.columnId === columnId)
    setSelectedColumnId(columnId)
    setColumnDraft({
      columnId,
      nameDraft: nameOf(columnId),
      textKind: existing && (existing.kind === 'in' || existing.kind === 'contains' || existing.kind === 'equals' || existing.kind === 'empty' || existing.kind === 'notEmpty') ? existing.kind : 'in',
      textValue: existing && (existing.kind === 'contains' || existing.kind === 'equals') ? existing.value : '',
      chosenValues: new Set(existing?.kind === 'in' ? existing.values : readColumnMenuValues(columnId).valueCounts.map(([value]) => value)),
      minText: existing?.kind === 'range' && existing.min !== null ? String(existing.min) : '',
      maxText: existing?.kind === 'range' && existing.max !== null ? String(existing.max) : '',
      fromDate: existing?.kind === 'dateRange' ? existing.from : '',
      toDate: existing?.kind === 'dateRange' ? existing.to : '',
      boolValue: existing?.kind === 'bool' ? existing.value : '',
    })
    openPopover('column', anchor, { columnPosition })
  }

  function openDownloadDialog() {
    setDownloadDraft(defaultDownloadSettings())
    setOpenDialog('download')
  }

  function openGoToDialog() {
    setPopover(null)
    setGoToText(activeRowId !== undefined ? rowNumberOf(activeRowId) : '1')
    setOpenDialog('goTo')
  }

  function showDockTab(tab: DockTab) {
    setPopover(null)
    setDockTab(tab)
    setIsDockOpen(true)
    if (isNarrow) setIsSheetOpen(true)
  }

  function toggleTheme() {
    const nextIsDark = !isDark
    document.documentElement.classList.toggle('dark', nextIsDark)
    try {
      localStorage.setItem('theme', nextIsDark ? 'dark' : 'light')
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    setIsDark(nextIsDark)
  }

  // ---------------------------------------------------------------- grid keyboard and clipboard
  function handleGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || editingCell) return
    const hasModifier = event.metaKey || event.ctrlKey
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      if (!active || !selection) {
        selectCell(0, 0)
        return
      }
      const fromRow = event.shiftKey ? selection.r1 : active.r
      const fromColumn = event.shiftKey ? selection.c1 : active.c
      const nextRow = Math.max(0, Math.min(visibleRowIds.length - 1, fromRow + move[0]))
      const nextColumn = Math.max(0, Math.min(shownColumnIds.length - 1, fromColumn + move[1]))
      if (event.shiftKey) {
        setSelection({ ...selection, r1: nextRow, c1: nextColumn })
        gridRef.current?.scrollToCell(nextRow, nextColumn)
      } else selectCell(nextRow, nextColumn)
      return
    }
    if (event.key === 'Escape') {
      setSelection(null)
      setActive(null)
      return
    }
    if (!active) return
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      startEditing(active.r, active.c)
    } else if (hasModifier && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      copySelection(false)
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !hasModifier) {
      event.preventDefault()
      clearSelectedCells()
    } else if (event.key.length === 1 && event.key !== '/' && !hasModifier && !event.altKey) {
      event.preventDefault()
      startEditing(active.r, active.c, event.key)
    }
  }

  const latestPasteRef = useRef(pasteText)
  useEffect(() => {
    latestPasteRef.current = pasteText
  })
  useEffect(() => {
    function pasteIntoGrid(event: ClipboardEvent) {
      if (document.activeElement?.id !== 'grid-scroll') return
      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (text === '') return
      event.preventDefault()
      latestPasteRef.current(text)
    }
    document.addEventListener('paste', pasteIntoGrid)
    return () => document.removeEventListener('paste', pasteIntoGrid)
  }, [])

  // ---------------------------------------------------------------- what the panels show
  const selectedCells = selectionPositions()
  const selectionStats = useMemo(() => {
    if (selectedCells.length < 2) return null
    let filledCount = 0
    let decimals = 0
    const numbers: number[] = []
    for (const { r, c } of selectedCells) {
      const columnId = shownColumnIds[c]
      const text = getText(visibleRowIds[r], columnId)
      if (text.trim() !== '') filledCount++
      if (typeOf(columnId) === 'number') {
        const number = parseNumber(text)
        if (number !== null) numbers.push(number)
        decimals = Math.max(decimals, infoOf(columnId).decimals)
      }
    }
    return { filledCount, decimals, summary: summarizeNumbers(numbers) }
    // Worked out from the selection and the cells it covers.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, visibleRowIds, shownColumnIds, edits, rows, typesKey])

  const deferredEdits = useDeferredValue(edits)
  const isProfileShown = (isDockOpen || isNarrow) && dockTab === 'profile'
  const profileColumnId = selectedColumnId !== null && displayColumnIds.includes(selectedColumnId) ? selectedColumnId : null
  const profile = useMemo(() => {
    if (!isProfileShown || profileColumnId === null) return null
    const texts = visibleRowIds.map((rowId) => getCellText(rows, deferredEdits, rowId, profileColumnId))
    return { texts, ...buildColumnProfile(texts, typeOf(profileColumnId)) }
    // typesKey stands for the column types.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileShown, profileColumnId, visibleRowIds, rows, deferredEdits, typesKey])

  const overview = useMemo(() => {
    if (!isProfileShown || profileColumnId !== null) return null
    let blankCount = 0
    const filledByColumn = displayColumnIds.map((columnId) => {
      let filled = 0
      for (const rowId of displayRowIds) {
        if (getCellText(rows, deferredEdits, rowId, columnId).trim() !== '') filled++
      }
      blankCount += displayRowIds.length - filled
      return { columnId, filled }
    })
    return { blankCount, filledByColumn }
  }, [isProfileShown, profileColumnId, displayColumnIds, displayRowIds, rows, deferredEdits])

  const groupByColumnId = groupSettings.byColumnId !== null && displayColumnIds.includes(groupSettings.byColumnId) ? groupSettings.byColumnId : (displayColumnIds.find((columnId) => typeOf(columnId) !== 'number') ?? displayColumnIds[0] ?? null)
  const groupOfColumnId = groupSettings.ofColumnId !== null && displayColumnIds.includes(groupSettings.ofColumnId) ? groupSettings.ofColumnId : (displayColumnIds.find((columnId) => typeOf(columnId) === 'number') ?? null)
  const groupAggregate: GroupAggregate = groupOfColumnId === null ? 'count' : groupSettings.aggregate
  const groupTotals = useMemo(() => {
    if (!((isDockOpen || isNarrow) && dockTab === 'group') || groupByColumnId === null) return []
    return groupRows(
      visibleRowIds,
      (rowId) => getCellText(rows, deferredEdits, rowId, groupByColumnId) || t('csv.wb.blankGroup'),
      (rowId) => (groupOfColumnId === null ? null : parseNumber(getCellText(rows, deferredEdits, rowId, groupOfColumnId))),
      groupAggregate,
    )
  }, [isDockOpen, isNarrow, dockTab, groupByColumnId, groupOfColumnId, groupAggregate, visibleRowIds, rows, deferredEdits, t])

  const largeFileWarning = getLargeFileWarning(openedFile.file, locale)
  const parseNoticeTexts = (readableCsv?.notices ?? []).filter((notice) => notice.kind !== 'mismatchedRows').map((notice) => describeParseNotice(notice, locale))
  const issues = useMemo<Issue[]>(() => {
    if (!((isDockOpen || isNarrow) && dockTab === 'issues')) return []
    const found: Issue[] = []
    if (largeFileWarning) found.push({ kind: 'info', title: largeFileWarning, detail: '' })
    for (const noticeText of parseNoticeTexts) found.push({ kind: 'warn', title: noticeText, detail: '' })
    for (const rowId of unevenRowIds.slice(0, 50)) {
      const fieldCount = parsedRows?.[rowId].length ?? 0
      found.push({ kind: 'warn', title: t('csv.wb.unevenRowTitle', { row: rowId - firstDataRowId + 1, fields: fieldCount, total: columnCount }), detail: t('csv.wb.unevenRowDetail'), goTo: { rowId, columnId: Math.min(fieldCount, columnCount - 1) } })
    }
    for (const columnId of displayColumnIds) {
      const blankRowIds = displayRowIds.filter((rowId) => getCellText(rows, deferredEdits, rowId, columnId).trim() === '' && !isMissing(rowId, columnId))
      if (blankRowIds.length === 0) continue
      if (blankRowIds.length <= 2) {
        for (const rowId of blankRowIds) found.push({ kind: 'warn', title: t('csv.wb.blankCellTitle', { name: nameOf(columnId), row: rowId - firstDataRowId + 1 }), detail: typeOf(columnId) === 'number' ? t('csv.wb.blankNumberDetail') : t('csv.wb.blankCellDetail'), goTo: { rowId, columnId } })
      } else found.push({ kind: 'info', title: tp('csv.wb.blankCellsTitle', blankRowIds.length, { name: nameOf(columnId) }), detail: t('csv.wb.blankCellsDetail'), showBlanksOf: columnId })
    }
    const seenRows = new Set<string>()
    let duplicateCount = 0
    for (const rowId of displayRowIds) {
      const rowText = displayColumnIds.map((columnId) => getCellText(rows, deferredEdits, rowId, columnId)).join('\u0000')
      if (seenRows.has(rowText)) duplicateCount++
      else seenRows.add(rowText)
    }
    found.push({ kind: 'info', title: duplicateCount ? tp('csv.wb.duplicateRows', duplicateCount) : t('csv.wb.noDuplicateRows'), detail: duplicateCount ? t('csv.wb.duplicateRowsDetail') : tp('csv.wb.noDuplicateRowsDetail', displayColumnIds.length) })
    return found
    // Worked out while the Issues panel is open, from the table as it is.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isDockOpen, isNarrow, dockTab, unevenRowIds, displayColumnIds, displayRowIds, rows, deferredEdits, locale])

  const changeRows = useMemo(() => {
    const listed: { key: string; rowId: number; columnId: number; address: string; columnName: string; oldText: string; newText: string; isRename: boolean }[] = []
    for (const [key, newText] of edits.cells) {
      const { rowId, columnId } = parseCellKey(key)
      const columnPosition = displayColumnIds.indexOf(columnId)
      if (columnPosition === -1 || (!isInsertedLine(rowId) && edits.deletedRowIds.has(rowId))) continue
      const isRename = hasHeaderRow && rowId === 0
      listed.push({ key, rowId, columnId, address: isRename ? columnLabel(columnPosition) : `${columnLabel(columnPosition)}${rowNumberOf(rowId)}`, columnName: nameOf(columnId), oldText: getOriginalCellText(rows, rowId, columnId), newText, isRename })
      if (listed.length === MAX_LISTED_CHANGES) break
    }
    return listed
    // Listed from the edits; names and numbers follow them.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, displayColumnIds, rows, hasHeaderRow])
  const structureSummary = describeCsvChanges({ ...edits, cells: new Map(), deletedRowIds: new Set() }, locale)

  // ---------------------------------------------------------------- labels
  const shownRowCount = visibleRowIds.length
  const totalRowCount = displayRowIds.length
  const delimiterLabel = (delimiter: string) => {
    const option = DELIMITER_OPTIONS.find((candidate) => candidate.value === delimiter)
    return option ? t(option.labelKey) : t('csv.delimiter.custom')
  }
  const statusDelimiter = delimiterChoice === 'auto' ? t('csv.wb.autoDetected', { name: delimiterLabel(readableCsv?.detectedDelimiter ?? ',') }) : delimiterLabel(delimiterChoice)
  const statusEncoding = encodingChoice === 'auto' ? t('csv.wb.autoDetected', { name: readableCsv?.encodingLabel.startsWith('Windows-1256') ? 'Windows-1256' : (readableCsv?.encodingLabel ?? 'UTF-8') }) : ENCODING_LABELS[encodingChoice]
  const statusLineEnding = readableCsv?.usesCrlf ? 'CRLF' : 'LF'
  const unevenCount = unevenRowIds.length
  const hiddenCount = displayColumnIds.length - shownColumnIds.length
  const sortOrderByColumnId = new Map(sortLevels.map((level, position) => [level.columnId, { level: position + 1, direction: level.direction }]))
  const filteredColumnIds = new Set(filters.map((filter) => filter.columnId))
  const sortDirectionLabel = (columnId: number, direction: 'asc' | 'desc') => t(typeOf(columnId) === 'number' ? (direction === 'asc' ? 'csv.wb.lowToHigh' : 'csv.wb.highToLow') : direction === 'asc' ? 'csv.wb.aToZ' : 'csv.wb.zToA')

  function describeFilter(filter: ColumnFilter): [string, string] {
    const decimals = infoOf(filter.columnId).decimals
    switch (filter.kind) {
      case 'in':
        return [t('csv.wb.is'), filter.values.length > 3 ? `${filter.values.slice(0, 3).join(', ')} +${filter.values.length - 3}` : filter.values.map((value) => value || t('csv.wb.blank')).join(', ')]
      case 'contains':
        return [t('csv.wb.contains'), `“${filter.value}”`]
      case 'equals':
        return [t('csv.wb.is'), `“${filter.value}”`]
      case 'empty':
        return [t('csv.wb.is'), t('csv.wb.empty')]
      case 'notEmpty':
        return [t('csv.wb.is'), t('csv.wb.notEmpty')]
      case 'range':
        if (filter.min !== null && filter.max !== null) return [t('csv.wb.between'), `${formatNumber(filter.min, decimals)} – ${formatNumber(filter.max, decimals)}`]
        return filter.min !== null ? ['≥', formatNumber(filter.min, decimals)] : ['≤', formatNumber(filter.max, decimals)]
      case 'dateRange':
        return [t('csv.wb.from'), `${filter.from ? formatShortDate(filter.from, locale) : t('csv.wb.start')} – ${filter.to ? formatShortDate(filter.to, locale) : t('csv.wb.end')}`]
      case 'bool':
        return [t('csv.wb.is'), filter.value === 'true' ? t('csv.wb.yes') : t('csv.wb.no')]
    }
  }

  // ---------------------------------------------------------------- popovers
  type MenuItem = { id: string; label: string; icon?: string; hint?: string; isDanger?: boolean; isDisabled?: boolean; onSelect: () => void } | 'separator' | { heading: string }
  function renderMenuItems(items: MenuItem[]) {
    return (
      <div role="menu">
        {items.map((item, position) =>
          item === 'separator' ? (
            <div key={position} className="mi-sep" />
          ) : 'heading' in item ? (
            <div key={position} className="menu-label">
              {item.heading}
            </div>
          ) : (
            <button
              key={item.id}
              className={`mi${item.isDanger ? ' danger' : ''}`}
              id={item.id}
              type="button"
              role="menuitem"
              disabled={item.isDisabled}
              onClick={() => {
                setPopover(null)
                item.onSelect()
              }}
            >
              {item.icon ? <Icon name={item.icon} size="sm" /> : <span style={{ width: 14 }} />}
              {item.label}
              {item.hint && <span className="hint">{item.hint}</span>}
            </button>
          ),
        )}
      </div>
    )
  }

  function renderPopoverContent(): ReactNode {
    if (!popover) return null
    switch (popover.kind) {
      case 'column':
        return popover.columnPosition === undefined || shownColumnIds[popover.columnPosition] === undefined ? null : renderColumnMenu(shownColumnIds[popover.columnPosition])
      case 'filterPick':
        return renderMenuItems([{ heading: t('csv.wb.filterByColumn') }, ...shownColumnIds.map((columnId, position) => ({ id: `filter-pick-${position}`, label: nameOf(columnId), hint: t(COLUMN_TYPE_LABEL_KEYS[typeOf(columnId)]), onSelect: () => openColumnMenu(position, document.getElementById(`column-menu-${position}`)) }))])
      case 'sort':
        return renderSortPopover()
      case 'columns':
        return renderColumnsPopover()
      case 'clean':
        return renderMenuItems([
              { heading: selectedColumnId !== null ? t('csv.wb.columnHeading', { name: nameOf(selectedColumnId) }) : t('csv.wb.columnHeadingNone') },
              { id: 'clean-menu-upper', label: t('csv.wb.upperCase'), icon: 'edit', isDisabled: selectedColumnId === null, onSelect: () => transformSelectedColumn('upper') },
              { id: 'clean-menu-lower', label: t('csv.wb.lowerCase'), icon: 'edit', isDisabled: selectedColumnId === null, onSelect: () => transformSelectedColumn('lower') },
              { id: 'clean-menu-capitalize', label: t('csv.wb.capitalize'), icon: 'edit', isDisabled: selectedColumnId === null, onSelect: () => transformSelectedColumn('capitalize') },
              { id: 'clean-menu-trim', label: t('csv.wb.trimSpaces'), icon: 'edit', isDisabled: selectedColumnId === null, onSelect: () => transformSelectedColumn('trim') },
              { id: 'clean-menu-fill-down', label: t('csv.wb.fillDown'), icon: 'down', isDisabled: selectedColumnId === null, onSelect: () => transformSelectedColumn('fillDown') },
              { id: 'clean-menu-split', label: t('csv.wb.splitColumn'), icon: 'columns', onSelect: () => openCleanTool('split') },
              { id: 'clean-menu-merge', label: t('csv.wb.mergeColumns'), icon: 'columns', isDisabled: displayColumnIds.length < 2, onSelect: () => openCleanTool('merge') },
              'separator',
              { heading: t('csv.wb.wholeFile') },
              {
                id: 'clean-menu-trim-all',
                label: t('csv.wb.trimAll'),
                icon: 'grid-x',
                onSelect: () => {
                  if (!applyEdits(withMappedCells(edits, rows, displayRowIds, displayColumnIds, cellTextTransforms.trim).edits, t('csv.wb.trimmedAll'))) showToast(t('csv.wb.nothingToTrim'))
                },
              },
              {
                id: 'clean-menu-remove-empty-rows',
                label: t('csv.wb.removeEmptyRows'),
                icon: 'rows',
                onSelect: () => {
                  const { edits: cleanedEdits, removedCount } = withoutEmptyRows(edits, rows, displayRowIds, displayColumnIds)
                  if (!applyEdits(cleanedEdits, tp('csv.cleanUp.removedEmptyRows', removedCount))) showToast(t('csv.wb.noEmptyRows'))
                },
              },
              { id: 'clean-menu-remove-duplicates', label: t('csv.wb.removeDuplicates'), icon: 'rows', onSelect: () => openCleanTool('dupes') },
              { id: 'clean-menu-transpose', label: t('csv.wb.transpose'), icon: 'grid-x', onSelect: () => openCleanTool('transpose') },
              { id: 'clean-menu-apply-sort', label: t('csv.wb.applySort'), icon: 'sort', isDisabled: sortLevels.length === 0, onSelect: applySortToFile },
            ])
      case 'file':
        return (
          <div role="menu">
            {renderMenuItems([
                { id: 'open-menu-file', label: t('csv.wb.openFile'), icon: 'open', hint: shortcutLabel('O'), onSelect: onOpenAnotherFile },
                {
                  id: 'open-menu-paste',
                  label: t('csv.wb.pasteCsv'),
                  icon: 'paste',
                  onSelect: () => {
                    setPastedText('')
                    setOpenDialog('paste')
                  },
                },
              ])}
            <div className="pop-sec small-note" style={{ padding: '8px 10px' }}>
              {t('csv.wb.openNote')}
            </div>
          </div>
        )
      case 'reading':
        return (
          <>
            <div className="pop-head">
              <span className="pop-title">{t('csv.wb.readingTitle')}</span>
            </div>
            <div className="pop-sec" style={{ display: 'grid', gap: 10 }}>
              <label className="field">
                {t('csv.delimiter.label')}
                <select id="delimiter-select" value={delimiterChoice} onChange={(event) => void changeReading(() => setDelimiterChoice(event.target.value as DelimiterChoice))}>
                  {DELIMITER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value === 'auto' ? t('csv.delimiter.autoDetected', { detected: delimiterLabel(readableCsv?.detectedDelimiter ?? ',') }) : t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t('csv.wb.encoding')}
                <select id="encoding-select" value={encodingChoice} onChange={(event) => void changeReading(() => setEncodingChoice(event.target.value as EncodingChoice))}>
                  {ENCODING_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice === 'auto' ? t('csv.wb.encodingAuto', { detected: readableCsv?.encodingLabel ?? 'UTF-8' }) : ENCODING_LABELS[choice]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  id="header-row-checkbox"
                  checked={hasHeaderRow}
                  onChange={(event) => {
                    setHasHeaderRow(event.target.checked)
                    setSortLevels([])
                    setFilters([])
                    setSelection(null)
                    setActive(null)
                  }}
                />
                {t('csv.headerRow')}
              </label>
            </div>
            <div className="pop-sec small-note">{t('csv.wb.readingNote', { lines: rows.length, lineEnding: statusLineEnding })}</div>
          </>
        )
      case 'more':
        return renderMenuItems([
              ...(isNarrow
                ? [
                    { id: 'more-menu-group', label: t('csv.wb.groupBy'), icon: 'group', onSelect: () => showDockTab('group') },
                    { id: 'more-menu-find', label: t('find.label'), icon: 'replace', onSelect: () => openPopover('find', document.getElementById('mobile-find-button')) },
                    { id: 'more-menu-undo', label: t('toolbar.undo'), icon: 'undo', isDisabled: !session.canUndo, onSelect: session.undo },
                    { id: 'more-menu-redo', label: t('toolbar.redo'), icon: 'redo', isDisabled: !session.canRedo, onSelect: session.redo },
                    'separator' as const,
                  ]
                : []),
              { heading: t('csv.wb.rows') },
              { id: 'more-menu-insert-row', label: t('csv.wb.addRow'), icon: 'plus', onSelect: addRow },
              { id: 'more-menu-delete-rows', label: t('csv.wb.deleteSelectedRows'), icon: 'trash', isDanger: true, hint: isNarrow ? undefined : 'Del', isDisabled: !selection, onSelect: deleteSelectedRows },
              { id: 'more-menu-go-to', label: t('csv.wb.goToRow'), icon: 'goto', hint: isNarrow ? undefined : shortcutLabel('G'), onSelect: openGoToDialog },
              { heading: t('csv.wb.columns') },
              { id: 'more-menu-insert-column', label: t('csv.wb.insertColumn'), icon: 'plus', isDisabled: selectedColumnId === null, onSelect: () => selectedColumnId !== null && insertColumnAfter(selectedColumnId) },
              {
                id: 'more-menu-rename-column',
                label: t('csv.wb.renameColumn'),
                icon: 'edit',
                isDisabled: selectedColumnId === null || !hasHeaderRow,
                onSelect: () => selectedColumnId !== null && openColumnMenu(shownColumnIds.indexOf(selectedColumnId), document.getElementById(`column-menu-${shownColumnIds.indexOf(selectedColumnId)}`)),
              },
              { id: 'more-menu-delete-column', label: t('csv.wb.deleteColumn'), icon: 'trash', isDanger: true, isDisabled: selectedColumnId === null || displayColumnIds.length <= 1, onSelect: () => selectedColumnId !== null && deleteColumn(selectedColumnId) },
              'separator',
              { id: 'more-menu-issues', label: t('csv.wb.issues'), icon: 'warn', onSelect: () => showDockTab('issues') },
              { id: 'more-menu-changes', label: t('csv.wb.reviewChanges'), icon: 'review', onSelect: () => showDockTab('changes') },
              { id: 'more-menu-reading', label: t('csv.wb.readingMenu'), icon: 'settings', onSelect: () => openPopover('reading', document.getElementById(isNarrow ? 'mobile-more-button' : 'status-delimiter-button')) },
              { id: 'more-menu-download', label: t('csv.wb.downloadOptions'), icon: 'download', onSelect: openDownloadDialog },
              ...(offersExcelCopy ? [{ id: 'more-menu-excel-copy', label: t('csv.excelCopy.button'), icon: 'download', onSelect: downloadExcelCopy }] : []),
            ])
      case 'find':
        return renderFindPopover()
      case 'context':
        return renderMenuItems([
              { id: 'context-copy', label: t('csv.wb.copy'), icon: 'copy', hint: shortcutLabel('C'), onSelect: () => copySelection(false) },
              { id: 'context-excel-copy', label: t('csv.wb.excelCopy'), icon: 'copy', onSelect: () => copySelection(true) },
              { id: 'context-paste', label: t('csv.wb.paste'), icon: 'paste', hint: shortcutLabel('V'), onSelect: () => showToast(t('csv.wb.pasteHint', { shortcut: shortcutLabel('V') })) },
              'separator',
              { id: 'context-filter-value', label: t('csv.wb.filterToValue'), icon: 'filter', isDisabled: !hasActiveCell, onSelect: () => hasActiveCell && filterToValue(activeColumnId, getText(activeRowId, activeColumnId)) },
              { id: 'context-insert-row', label: t('csv.wb.insertRowBelow'), icon: 'plus', isDisabled: !hasActiveCell, onSelect: () => hasActiveCell && applyEdits(withInsertedLine(edits, 'row', activeRowId), t('csv.wb.rowAdded')) },
              { id: 'context-delete-rows', label: t('csv.wb.deleteSelectedRows'), icon: 'trash', isDanger: true, onSelect: deleteSelectedRows },
            ])
    }
  }

  function renderColumnMenu(columnId: number) {
    if (!columnDraft || columnDraft.columnId !== columnId) return null
    const type = typeOf(columnId)
    const decimals = infoOf(columnId).decimals
    const existing = filters.find((filter) => filter.columnId === columnId) ?? null
    const { valueCounts, numbers, dates } = columnMenuValues
    const { nameDraft, textKind, textValue, chosenValues, minText, maxText, fromDate, toDate, boolValue } = columnDraft
    const changeDraft = (change: Partial<ColumnDraft>) => setColumnDraft({ ...columnDraft, ...change })
    const sortLevelOfColumn = sortLevels.findIndex((level) => level.columnId === columnId)
    const columnPosition = shownColumnIds.indexOf(columnId)

  function readDraftFilter(): ColumnFilter | null {
      if (type === 'text') {
        if (textKind === 'in') return chosenValues.size === valueCounts.length ? null : { columnId, kind: 'in', values: [...chosenValues] }
        if (textKind === 'contains' || textKind === 'equals') return textValue ? { columnId, kind: textKind, value: textValue } : null
        return { columnId, kind: textKind }
      }
      if (type === 'number') return minText === '' && maxText === '' ? null : { columnId, kind: 'range', min: minText === '' ? null : Number(minText), max: maxText === '' ? null : Number(maxText) }
      if (type === 'date') return fromDate === '' && toDate === '' ? null : { columnId, kind: 'dateRange', from: fromDate, to: toDate }
      return boolValue === '' ? null : { columnId, kind: 'bool', value: boolValue }
    }
    const draftFilter = readDraftFilter()
    const draftFilters = [...filters.filter((filter) => filter.columnId !== columnId), ...(draftFilter ? [draftFilter] : [])]
    const previewCount =
      draftFilters.length === 0
        ? displayRowIds.length
        : displayRowIds.filter((rowId) => (matchAllFilters ? draftFilters.every((filter) => passesFilter(getText(rowId, filter.columnId), filter)) : draftFilters.some((filter) => passesFilter(getText(rowId, filter.columnId), filter)))).length

    function applyColumnMenu() {
      setFilter(columnId, draftFilter)
      renameColumn(columnId, nameDraft)
      setPopover(null)
    }

    const lastDate = dates[dates.length - 1] ?? ''
    const monthStart = lastDate.slice(0, 7)
    const previousMonth = (() => {
      const time = Date.parse(`${monthStart}-01`)
      if (Number.isNaN(time)) return ''
      const date = new Date(time)
      date.setUTCMonth(date.getUTCMonth() - 1)
      return date.toISOString().slice(0, 7)
    })()
    const weekBefore = Number.isNaN(Date.parse(lastDate.slice(0, 10))) ? '' : new Date(Date.parse(lastDate.slice(0, 10)) - 6 * 86_400_000).toISOString().slice(0, 10)
    const filteredValueCounts = textKind === 'in' && textValue !== '' ? valueCounts.filter(([value]) => value.toLowerCase().includes(textValue.toLowerCase())) : valueCounts

    return (
      <div
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') {
            event.preventDefault()
            applyColumnMenu()
          }
        }}
      >
        <div className="pop-head">
          <span className="tb">{t(COLUMN_TYPE_LABEL_KEYS[type])}</span>
          <input
            type="text"
            id="rename-column-input"
            aria-label={t('csv.wb.columnName')}
            dir="auto"
            value={nameDraft}
            disabled={!hasHeaderRow}
            onChange={(event) => changeDraft({ nameDraft: event.target.value })}
            style={{ flex: 1, fontFamily: 'var(--mono)', fontWeight: 600 }}
          />
        </div>
        <div className="pop-sec" style={{ padding: 4 }}>
          {(['asc', 'desc'] as const).map((direction) => (
            <button
              key={direction}
              className="mi"
              id={`column-sort-${direction}-button`}
              type="button"
              onClick={() => {
                setSortLevels([{ columnId, direction }])
                setPopover(null)
              }}
            >
              <Icon name="sort" size="sm" flipped={direction === 'desc'} />
              {t('csv.wb.sortDirection', { direction: sortDirectionLabel(columnId, direction) })}
              <span className="hint">{sortLevelOfColumn >= 0 && sortLevels[sortLevelOfColumn].direction === direction ? t('csv.wb.sortLevel', { level: sortLevelOfColumn + 1 }) : ''}</span>
            </button>
          ))}
          <button
            className="mi"
            id="column-sort-then-button"
            type="button"
            onClick={() => {
              setSortLevels((current) => [...current.filter((level) => level.columnId !== columnId), { columnId, direction: type === 'number' ? 'desc' : 'asc' }])
              setPopover(null)
              showToast(t('csv.wb.sortLevelAdded', { level: sortLevels.filter((level) => level.columnId !== columnId).length + 1 }))
            }}
          >
            <Icon name="plus" size="sm" />
            {t('csv.wb.addSortLevel')}
            <span className="hint">{t('csv.wb.shiftClick')}</span>
          </button>
        </div>
        <div className="pop-sec">
          <div className="menu-label" style={{ padding: '0 0 6px' }}>
            {t('csv.wb.filterColumn', { name: nameOf(columnId) })}
          </div>
          {type === 'text' && (
            <>
              <div style={{ display: 'flex', gap: 6 }}>
                <select id="filter-op-select" aria-label={t('csv.wb.condition')} value={textKind} onChange={(event) => changeDraft({ textKind: event.target.value as ColumnDraft['textKind'] })} style={{ flex: 'none' }}>
                  <option value="in">{t('csv.wb.isOneOf')}</option>
                  <option value="contains">{t('csv.wb.contains')}</option>
                  <option value="equals">{t('csv.wb.equals')}</option>
                  <option value="empty">{t('csv.wb.isEmpty')}</option>
                  <option value="notEmpty">{t('csv.wb.isNotEmpty')}</option>
                </select>
                <input
                  type="text"
                  id="filter-value-input"
                  aria-label={t('csv.wb.value')}
                  dir="auto"
                  placeholder={textKind === 'in' ? t('csv.wb.searchValues') : t('csv.wb.value')}
                  disabled={textKind === 'empty' || textKind === 'notEmpty'}
                  value={textValue}
                  onChange={(event) => changeDraft({ textValue: event.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
              {textKind === 'in' && (
                <div className="checklist" id="filter-checklist">
                  {filteredValueCounts.slice(0, MAX_FILTER_VALUES).map(([value, count], position) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        id={`filter-value-${position}`}
                        checked={chosenValues.has(value)}
                        onChange={(event) => {
                          const next = new Set(chosenValues)
                          if (event.target.checked) next.add(value)
                          else next.delete(value)
                          changeDraft({ chosenValues: next })
                        }}
                      />
                      <span dir="auto">{value === '' ? <i style={{ color: 'var(--faint)' }}>{t('csv.wb.blank')}</i> : value}</span>
                      <span className="c">{count}</span>
                    </label>
                  ))}
                  {filteredValueCounts.length > MAX_FILTER_VALUES && <div className="small-note">{t('csv.wb.moreValues', { count: filteredValueCounts.length - MAX_FILTER_VALUES })}</div>}
                </div>
              )}
            </>
          )}
          {type === 'number' && (
            <>
              <div className="range-row">
                <input type="number" id="filter-min-input" aria-label={t('csv.wb.minimum')} placeholder={t('csv.wb.minPlaceholder', { value: formatNumber(summarizeNumbers(numbers)?.min, decimals) })} value={minText} step="any" onChange={(event) => changeDraft({ minText: event.target.value })} />
                <span>{t('csv.wb.to')}</span>
                <input type="number" id="filter-max-input" aria-label={t('csv.wb.maximum')} placeholder={t('csv.wb.maxPlaceholder', { value: formatNumber(summarizeNumbers(numbers)?.max, decimals) })} value={maxText} step="any" onChange={(event) => changeDraft({ maxText: event.target.value })} />
              </div>
              <div style={{ marginTop: 8 }}>
                <HistogramChart numbers={numbers} decimals={decimals} columnName={nameOf(columnId)} activeRange={draftFilter?.kind === 'range' ? draftFilter : undefined} />
              </div>
            </>
          )}
          {type === 'date' && (
            <>
              <div className="range-row">
                <input type="date" id="filter-from-input" aria-label={t('csv.wb.from')} value={fromDate} onChange={(event) => changeDraft({ fromDate: event.target.value })} />
                <span>{t('csv.wb.to')}</span>
                <input type="date" id="filter-to-input" aria-label={t('csv.wb.to')} value={toDate} onChange={(event) => changeDraft({ toDate: event.target.value })} />
              </div>
              {lastDate !== '' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn sm outline" id="filter-preset-last-month-button" type="button" onClick={() => changeDraft({ fromDate: `${monthStart}-01`, toDate: `${monthStart}-31` })}>
                    {new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.parse(`${monthStart}-01`))}
                  </button>
                  {previousMonth && (
                    <button className="btn sm outline" id="filter-preset-previous-month-button" type="button" onClick={() => changeDraft({ fromDate: `${previousMonth}-01`, toDate: `${previousMonth}-31` })}>
                      {new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.parse(`${previousMonth}-01`))}
                    </button>
                  )}
                  {weekBefore && (
                    <button className="btn sm outline" id="filter-preset-last-7-button" type="button" onClick={() => changeDraft({ fromDate: weekBefore, toDate: lastDate.slice(0, 10) })}>
                      {t('csv.wb.last7Days')}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {type === 'bool' && (
            <div className="seg" style={{ width: '100%' }}>
              {([['', 'any'], ['true', 'yes'], ['false', 'no']] as const).map(([value, name]) => (
                <button key={name} id={`filter-bool-${name}-button`} type="button" aria-pressed={boolValue === value} style={{ flex: 1 }} onClick={() => changeDraft({ boolValue: value })}>
                  {value === '' ? t('csv.wb.any') : `${t(value === 'true' ? 'csv.wb.yes' : 'csv.wb.no')} · ${displayRowIds.filter((rowId) => getText(rowId, columnId).toLowerCase() === value).length}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pop-sec" style={{ padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <button
            className="mi"
            id="column-freeze-button"
            type="button"
            onClick={() => {
              setFrozenCount(columnPosition + 1)
              setPopover(null)
              showToast(tp('csv.wb.frozenColumns', columnPosition + 1))
            }}
          >
            <Icon name="pin" size="sm" />
            {t('csv.wb.freezeHere')}
          </button>
          <button
            className="mi"
            id="column-hide-button"
            type="button"
            disabled={shownColumnIds.length <= 1}
            onClick={() => {
              setHiddenColumnIds((current) => new Set(current).add(columnId))
              setSelectedColumnId(null)
              setPopover(null)
              showToast(t('csv.wb.columnHidden'))
            }}
          >
            <Icon name="eye-off" size="sm" />
            {t('csv.wb.hideColumn')}
          </button>
          <button
            className="mi"
            id="column-insert-right-button"
            type="button"
            onClick={() => {
              setPopover(null)
              insertColumnAfter(columnId)
            }}
          >
            <Icon name="plus" size="sm" />
            {t('csv.wb.insertColumn')}
          </button>
          <button
            className="mi danger"
            id="column-delete-button"
            type="button"
            disabled={displayColumnIds.length <= 1}
            onClick={() => {
              setPopover(null)
              deleteColumn(columnId)
            }}
          >
            <Icon name="trash" size="sm" />
            {t('csv.wb.deleteColumn')}
          </button>
        </div>
        <div className="pop-actions">
          <button
            className="btn sm"
            id="filter-clear-button"
            type="button"
            disabled={!existing}
            onClick={() => {
              setFilter(columnId, null)
              setPopover(null)
            }}
          >
            {t('csv.wb.clearFilter')}
          </button>
          <span className="spacer" />
          <span className="small-note" id="filter-preview">
            {t('csv.wb.rowsOf', { shown: previewCount, total: displayRowIds.length })}
          </span>
          <button className="btn sm primary" id="filter-apply-button" type="button" onClick={applyColumnMenu}>
            {t('csv.wb.apply')}
          </button>
        </div>
      </div>
    )
  }

  function renderSortPopover() {
    return (
      <>
        <div className="pop-head">
          <span className="pop-title">{t('csv.wb.sort')}</span>
          <span className="spacer" />
          <span className="small-note">{t('csv.wb.stableSort')}</span>
        </div>
        <div className="pop-sec">
          {sortLevels.length === 0 && (
            <div className="small-note" style={{ marginBottom: 8 }}>
              {t('csv.wb.fileOrder')}
            </div>
          )}
          {sortLevels.map((level, position) => (
            <div key={level.columnId} className="sort-level">
              <span className="ord">{position + 1}</span>
              <select
                id={`sort-key-select-${position}`}
                aria-label={t('csv.wb.sortLevelColumn', { level: position + 1 })}
                value={level.columnId}
                onChange={(event) => setSortLevels((current) => current.map((existing, index) => (index === position ? { ...existing, columnId: Number(event.target.value) } : existing)))}
              >
                {displayColumnIds.map((columnId) => (
                  <option key={columnId} value={columnId}>
                    {nameOf(columnId)}
                  </option>
                ))}
              </select>
              <button
                className="btn sm outline"
                id={`sort-direction-${position}-button`}
                type="button"
                onClick={() => setSortLevels((current) => current.map((existing, index) => (index === position ? { ...existing, direction: existing.direction === 'asc' ? 'desc' : 'asc' } : existing)))}
              >
                {sortDirectionLabel(level.columnId, level.direction)}
              </button>
              <button className="btn sm icon" id={`sort-remove-${position}-button`} type="button" aria-label={t('csv.wb.removeSortLevel', { level: position + 1 })} onClick={() => setSortLevels((current) => current.filter((_, index) => index !== position))}>
                <Icon name="x" size="sm" />
              </button>
            </div>
          ))}
          <select
            id="sort-key-select-new"
            aria-label={t('csv.wb.addSortLevel')}
            style={{ width: '100%' }}
            value=""
            onChange={(event) => event.target.value !== '' && setSortLevels((current) => [...current, { columnId: Number(event.target.value), direction: 'asc' }])}
          >
            <option value="">{t('csv.wb.thenBy')}</option>
            {displayColumnIds
              .filter((columnId) => !sortLevels.some((level) => level.columnId === columnId))
              .map((columnId) => (
                <option key={columnId} value={columnId}>
                  {nameOf(columnId)}
                </option>
              ))}
          </select>
        </div>
        <div className="pop-actions">
          <button
            className="btn sm"
            id="sort-clear-button"
            type="button"
            onClick={() => {
              setSortLevels([])
              setPopover(null)
            }}
          >
            {t('csv.wb.clearSort')}
          </button>
          <span className="spacer" />
          <button
            className="btn sm outline"
            id="sort-apply-to-file-button"
            type="button"
            title={t('csv.wb.applySortTip')}
            disabled={sortLevels.length === 0}
            onClick={() => {
              setPopover(null)
              applySortToFile()
            }}
          >
            {t('csv.wb.applyToFile')}
          </button>
        </div>
      </>
    )
  }

  function renderColumnsPopover() {
    return (
      <>
        <div className="pop-head">
          <span className="pop-title">{t('csv.wb.columns')}</span>
          <span className="small-note">{t('csv.wb.columnsShown', { shown: shownColumnIds.length, total: displayColumnIds.length })}</span>
          <span className="spacer" />
          <button className="btn sm" id="columns-show-all-button" type="button" onClick={() => setHiddenColumnIds(new Set())}>
            {t('csv.wb.showAll')}
          </button>
        </div>
        <div className="pop-sec" style={{ padding: '4px 6px', maxHeight: 320, overflow: 'auto' }}>
          {displayColumnIds.map((columnId, position) => (
            <div key={columnId} className={`col-item${position === frozenCount - 1 ? ' frozen-line' : ''}`}>
              <span className="grip-h">
                <svg className="ico xs" viewBox="0 0 10 16" style={{ fill: 'currentColor', stroke: 'none' }} aria-hidden="true">
                  <use href="#i-grip" />
                </svg>
              </span>
              <input
                type="checkbox"
                id={`column-visible-${position}`}
                checked={!hiddenColumnIds.has(columnId)}
                aria-label={t('csv.wb.showColumn', { name: nameOf(columnId) })}
                disabled={!hiddenColumnIds.has(columnId) && shownColumnIds.length <= 1}
                onChange={(event) =>
                  setHiddenColumnIds((current) => {
                    const next = new Set(current)
                    if (event.target.checked) next.delete(columnId)
                    else next.add(columnId)
                    return next
                  })
                }
              />
              <label className="n" htmlFor={`column-visible-${position}`} dir="auto">
                {nameOf(columnId)}
              </label>
              <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <span className="tb">{t(COLUMN_TYPE_LABEL_KEYS[typeOf(columnId)])}</span>
                <button className="btn sm icon" id={`column-up-${position}`} type="button" aria-label={t('csv.wb.moveColumnLeft', { name: nameOf(columnId) })} disabled={position === 0} onClick={() => moveColumn(columnId, position - 1)}>
                  ↑
                </button>
                <button className="btn sm icon" id={`column-down-${position}`} type="button" aria-label={t('csv.wb.moveColumnRight', { name: nameOf(columnId) })} disabled={position === displayColumnIds.length - 1} onClick={() => moveColumn(columnId, position + 1)}>
                  ↓
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="pop-actions">
          <label className="toggle-row" htmlFor="freeze-count-select" style={{ height: 'auto' }}>
            <Icon name="pin" size="sm" />
            {t('csv.wb.freezeFirst')}
          </label>
          <select id="freeze-count-select" value={frozenCount} onChange={(event) => setFrozenCount(Number(event.target.value))}>
            {[0, 1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {tp('csv.wb.columnCount', count)}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="small-note">{t('csv.wb.dragHeaders')}</span>
        </div>
      </>
    )
  }

  function renderFindPopover() {
    return (
      <>
        <div className="pop-head">
          <span className="pop-title">{t('find.label')}</span>
          <span className="spacer" />
          <span className="small-note" id="find-count">
            {isFindInvalid ? t('csv.wb.invalidExpression') : find.text ? tp('find.matches', findHits.length) : ''}
          </span>
          <button className="btn sm icon" id="find-close-button" type="button" aria-label={t('csv.wb.closeFind')} onClick={() => setPopover(null)}>
            <Icon name="x" size="sm" />
          </button>
        </div>
        <div className="pop-sec" style={{ display: 'grid', gap: 6 }}>
          <input type="text" id="find-input" aria-label={t('find.find')} placeholder={t('find.find')} dir="auto" value={find.text} onChange={(event) => setFind({ ...find, text: event.target.value })} />
          <input type="text" id="replace-input" aria-label={t('find.replaceWith')} placeholder={t('find.replaceWith')} dir="auto" value={find.replacement} onChange={(event) => setFind({ ...find, replacement: event.target.value })} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            <label className="toggle-row" style={{ height: 24 }}>
              <input type="checkbox" id="find-case-checkbox" checked={find.matchCase} onChange={(event) => setFind({ ...find, matchCase: event.target.checked })} />
              {t('find.matchCase')}
            </label>
            <label className="toggle-row" style={{ height: 24 }}>
              <input type="checkbox" id="find-whole-checkbox" checked={find.wholeCell} onChange={(event) => setFind({ ...find, wholeCell: event.target.checked })} />
              {t('csv.wb.wholeCell')}
            </label>
            <label className="toggle-row" style={{ height: 24 }}>
              <input type="checkbox" id="find-regex-checkbox" checked={find.isRegularExpression} onChange={(event) => setFind({ ...find, isRegularExpression: event.target.checked })} />
              {t('csv.wb.regularExpression')}
            </label>
          </div>
          <label className="field">
            {t('csv.wb.onlyInColumn')}
            <select id="find-column-select" value={find.columnId ?? ''} onChange={(event) => setFind({ ...find, columnId: event.target.value === '' ? null : Number(event.target.value) })}>
              <option value="">{t('csv.wb.allColumns')}</option>
              {displayColumnIds.map((columnId) => (
                <option key={columnId} value={columnId}>
                  {nameOf(columnId)}
                </option>
              ))}
            </select>
          </label>
          {findHits.length > 0 && (
            <>
              <div className="opt-label" style={{ margin: '4px 0 0' }}>
                {t('csv.wb.preview')}
              </div>
              <div className="preview" id="find-preview" dir="ltr">
                {findHits.slice(0, 4).map((hit) => (
                  <div key={cellKey(hit.rowId, hit.columnId)}>
                    <span style={{ color: 'var(--faint)', width: 34 }}>{`${columnLabel(Math.max(0, shownColumnIds.indexOf(hit.columnId)))}${rowNumberOf(hit.rowId)}`}</span>
                    <del>{hit.text}</del>
                    <span>→</span>
                    <ins>{hit.newText || t('csv.wb.emptyValue')}</ins>
                  </div>
                ))}
                {findHits.length > 4 && <div style={{ color: 'var(--faint)' }}>{t('csv.wb.moreMatches', { count: findHits.length - 4 })}</div>}
              </div>
            </>
          )}
        </div>
        <div className="pop-actions">
          <span className="small-note">{t('csv.wb.matchesHighlighted')}</span>
          <span className="spacer" />
          <button className="btn sm outline" id="find-next-button" type="button" disabled={findHits.length === 0} onClick={goToNextFound}>
            {t('find.next')}
          </button>
          <button className="btn sm primary" id="find-replace-all-button" type="button" disabled={findHits.length === 0} onClick={replaceAllFound}>
            {t('find.replaceAll')}
          </button>
        </div>
      </>
    )
  }

  // ---------------------------------------------------------------- clean tools dialog
  const [splitSettings, setSplitSettings] = useState({ columnId: -1, separator: ' ', keepOriginal: true })
  const [mergeSettings, setMergeSettings] = useState({ firstColumnId: -1, secondColumnId: -1, separator: ' / ', name: '' })
  const [duplicateColumnIds, setDuplicateColumnIds] = useState<ReadonlySet<number>>(new Set())
  const [transposeShownOnly, setTransposeShownOnly] = useState(false)

  function openCleanTool(tool: CleanTool) {
    const firstColumnId = selectedColumnId ?? displayColumnIds[0]
    if (tool === 'split') setSplitSettings({ columnId: firstColumnId, separator: ' ', keepOriginal: true })
    if (tool === 'merge') {
      const secondColumnId = displayColumnIds[displayColumnIds.indexOf(firstColumnId) + 1] ?? displayColumnIds[0]
      setMergeSettings({ firstColumnId, secondColumnId, separator: ' / ', name: `${nameOf(firstColumnId)}_${nameOf(secondColumnId)}` })
    }
    if (tool === 'dupes') setDuplicateColumnIds(new Set(displayColumnIds))
    setCleanTool(tool)
    setOpenDialog('clean')
  }

  const duplicateCount = useMemo(() => {
    if (openDialog !== 'clean' || cleanTool !== 'dupes') return 0
    const chosen = displayColumnIds.filter((columnId) => duplicateColumnIds.has(columnId))
    return withoutDuplicateRows(edits, rows, displayRowIds, chosen).removedCount
  }, [openDialog, cleanTool, duplicateColumnIds, displayColumnIds, edits, rows, displayRowIds])

  function applyCleanTool() {
    setOpenDialog(null)
    if (cleanTool === 'dupes') {
      const chosen = displayColumnIds.filter((columnId) => duplicateColumnIds.has(columnId))
      const { edits: cleanedEdits, removedCount } = withoutDuplicateRows(edits, rows, displayRowIds, chosen)
      if (!applyEdits(cleanedEdits, tp('csv.cleanUp.removedDuplicateRows', removedCount))) showToast(t('csv.wb.noDuplicateRows'))
      return
    }
    const table = currentTable(cleanTool === 'transpose' && transposeShownOnly ? visibleRowIds : displayRowIds)
    if (cleanTool === 'transpose') rebuildTable(transposeTable(table), t('csv.wb.transposed'))
    if (cleanTool === 'split') rebuildTable(splitColumnInTable(table, displayColumnIds.indexOf(splitSettings.columnId), splitSettings.separator, splitSettings.keepOriginal, hasHeaderRow, MAX_SPLIT_PARTS), t('csv.wb.columnSplit', { name: nameOf(splitSettings.columnId) }))
    if (cleanTool === 'merge') rebuildTable(mergeColumnsInTable(table, displayColumnIds.indexOf(mergeSettings.firstColumnId), displayColumnIds.indexOf(mergeSettings.secondColumnId), mergeSettings.separator, mergeSettings.name, hasHeaderRow), t('csv.wb.columnsMerged', { name: mergeSettings.name }))
  }

  const columnOptions = displayColumnIds.map((columnId) => (
    <option key={columnId} value={columnId}>
      {nameOf(columnId)}
    </option>
  ))
  const previewRowIds = displayRowIds.slice(0, 3)

  // ---------------------------------------------------------------- the page
  const dockTitle = dockTab === 'profile' ? (profileColumnId !== null ? nameOf(profileColumnId) : t('csv.wb.overview')) : t(({ group: 'csv.wb.groupBy', issues: 'csv.wb.issues', changes: 'csv.wb.changes' } as Record<string, MessageKey>)[dockTab])
  const dockSubtitle =
    dockTab === 'profile'
      ? profileColumnId !== null
        ? `${t(COLUMN_TYPE_LABEL_KEYS[typeOf(profileColumnId)])} · ${shownRowCount < totalRowCount ? tp('csv.wb.shownRows', shownRowCount) : tp('csv.wb.allRows', totalRowCount)}`
        : fileName
      : dockTab === 'group'
        ? t('csv.wb.shownRowsOnly')
        : ''

  function renderProfileBody() {
    if (profileColumnId === null) {
      if (!overview) return null
      return (
        <>
          <div className="sec">
            <div className="stats">
              <div className="stat">
                <div className="l">{t('csv.wb.rowsLabel')}</div>
                <div className="v">{totalRowCount.toLocaleString('en-US')}</div>
              </div>
              <div className="stat">
                <div className="l">{t('csv.wb.columnsLabel')}</div>
                <div className="v">{displayColumnIds.length}</div>
              </div>
              <div className="stat">
                <div className="l">{t('csv.wb.blankCells')}</div>
                <div className="v">{overview.blankCount.toLocaleString('en-US')}</div>
              </div>
            </div>
          </div>
          <div className="sec">
            <div className="sec-title">{t('csv.wb.filledPerColumn')}</div>
            <ul className="fill-list">
              {overview.filledByColumn.map(({ columnId, filled }) => (
                <li key={columnId}>
                  <span className="n" dir="auto">
                    {nameOf(columnId)}
                  </span>
                  <span className="tb">{t(COLUMN_TYPE_LABEL_KEYS[typeOf(columnId)])}</span>
                  <span className="meter" title={t('csv.wb.filledOf', { filled, total: totalRowCount })}>
                    <span style={{ width: `${totalRowCount ? Math.round((filled / totalRowCount) * 100) : 0}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hint-line">
            <Icon name="chart" size="sm" />
            {t('csv.wb.clickHeaderHint')}
          </div>
        </>
      )
    }
    if (!profile) return null
    const type = typeOf(profileColumnId)
    const decimals = infoOf(profileColumnId).decimals
    const numberSummary = summarizeNumbers(profile.numbers)
    const statItems: [string, string][] = [
      [t('csv.wb.count'), profile.filledCount.toLocaleString('en-US')],
      [t('csv.wb.blanks'), profile.blankCount.toLocaleString('en-US')],
      [t('csv.wb.distinct'), profile.distinctCount.toLocaleString('en-US')],
      ...(type === 'number'
        ? ([
            [t('csv.wb.min'), formatNumber(numberSummary?.min, decimals)],
            [t('csv.wb.max'), formatNumber(numberSummary?.max, decimals)],
            [t('csv.wb.mean'), formatNumber(numberSummary?.mean, 2)],
          ] as [string, string][])
        : type === 'date'
          ? ([
              [t('csv.wb.earliest'), profile.dates ? formatShortDate(profile.dates.first, locale) : '—'],
              [t('csv.wb.latest'), profile.dates ? formatShortDate(profile.dates.last, locale) : '—'],
            ] as [string, string][])
          : []),
    ]
    const topMax = profile.topValues[0]?.[1] ?? 1
    const rangeFilter = filters.find((filter) => filter.columnId === profileColumnId && filter.kind === 'range')
    return (
      <>
        <div className="sec">
          <div className="stats">
            {statItems.map(([label, value]) => (
              <div key={label} className="stat">
                <div className="l">{label}</div>
                <div className="v" title={value}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sec">
          <div className="sec-title">{type === 'number' ? t('csv.wb.distribution') : type === 'date' ? t('csv.wb.rowsPerWeek') : t('csv.wb.topValues')}</div>
          {type === 'number' && (
            <HistogramChart
              numbers={profile.numbers}
              decimals={decimals}
              columnName={nameOf(profileColumnId)}
              activeRange={rangeFilter?.kind === 'range' ? rangeFilter : undefined}
              onBinClick={(from, to) => setFilter(profileColumnId, { columnId: profileColumnId, kind: 'range', min: Number(from.toFixed(decimals)), max: Number(to.toFixed(decimals)) })}
            />
          )}
          {type === 'date' && <WeekChart dateTexts={profile.texts.filter((text) => text !== '')} locale={locale} />}
          {(type === 'text' || type === 'bool') && (
            <ul className="top-list">
              {profile.topValues.length === 0 && <li style={{ color: 'var(--muted)' }}>{t('csv.wb.noValues')}</li>}
              {profile.topValues.map(([value, count], position) => (
                <li key={value}>
                  <button className="tv" id={`top-value-${position}`} type="button" title={t('csv.wb.showOnlyValue', { name: nameOf(profileColumnId), value })} onClick={() => filterToValue(profileColumnId, value)}>
                    <span className="fillbar" style={{ width: `${((count / topMax) * 100).toFixed(1)}%` }} />
                    <span dir="auto">{type === 'bool' ? (value.toLowerCase() === 'true' ? t('csv.wb.yesTrue') : t('csv.wb.noFalse')) : value}</span>
                  </button>
                  <span className="c">{count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="sec" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
          <label htmlFor="profile-type-select">{t('csv.wb.readAs')}</label>
          <select
            id="profile-type-select"
            className="type-select"
            value={type}
            onChange={(event) => {
              setTypeOverrides((current) => new Map(current).set(profileColumnId, event.target.value as ColumnType))
              showToast(t('csv.wb.readAsDone', { type: t(COLUMN_TYPE_LABEL_KEYS[event.target.value as ColumnType]) }))
            }}
          >
            {(Object.keys(COLUMN_TYPE_LABEL_KEYS) as ColumnType[]).map((columnType) => (
              <option key={columnType} value={columnType}>
                {t(COLUMN_TYPE_LABEL_KEYS[columnType])}
              </option>
            ))}
          </select>
        </div>
      </>
    )
  }

  function renderGroupBody() {
    if (groupByColumnId === null) return <div className="empty-note">{t('csv.wb.nothingToGroup')}</div>
    const decimals = groupAggregate === 'count' ? 0 : 2
    const tallest = Math.max(1, ...groupTotals.map((group) => group.value))
    const width = 320
    const labelWidth = 92
    const rowHeight = 24
    const shownGroups = groupTotals.slice(0, 40)
    const total = groupTotals.reduce((sum, group) => sum + group.value, 0)
    const ofName = groupOfColumnId === null ? '' : nameOf(groupOfColumnId)
    return (
      <>
        <div className="sec">
          <div className="group-controls">
            <label className="field">
              {t('csv.wb.groupByLabel')}
              <select id="group-by-select" value={groupByColumnId} onChange={(event) => setGroupSettings({ ...groupSettings, byColumnId: Number(event.target.value) })}>
                {columnOptions}
              </select>
            </label>
            <label className="field">
              {t('csv.wb.show')}
              <select id="group-agg-select" value={groupAggregate} onChange={(event) => setGroupSettings({ ...groupSettings, aggregate: event.target.value as GroupAggregate })}>
                <option value="count">{t('csv.wb.countOfRows')}</option>
                <option value="sum" disabled={groupOfColumnId === null}>
                  {t('csv.wb.sumOf')}
                </option>
                <option value="avg" disabled={groupOfColumnId === null}>
                  {t('csv.wb.averageOf')}
                </option>
              </select>
            </label>
            <label className="field" style={{ gridColumn: '1/-1' }}>
              {t('csv.wb.column')}
              <select id="group-of-select" value={groupOfColumnId ?? ''} disabled={groupAggregate === 'count'} onChange={(event) => setGroupSettings({ ...groupSettings, ofColumnId: Number(event.target.value) })}>
                {displayColumnIds
                  .filter((columnId) => typeOf(columnId) === 'number')
                  .map((columnId) => (
                    <option key={columnId} value={columnId}>
                      {nameOf(columnId)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
        <div className="sec">
          <div className="sec-title">
            {groupAggregate === 'count' ? t('csv.wb.rowsBy', { by: nameOf(groupByColumnId) }) : groupAggregate === 'sum' ? t('csv.wb.sumBy', { of: ofName, by: nameOf(groupByColumnId) }) : t('csv.wb.averageBy', { of: ofName, by: nameOf(groupByColumnId) })}
          </div>
          <svg className="gb-chart" viewBox={`0 0 ${width} ${Math.max(rowHeight, shownGroups.length * rowHeight)}`} width="100%" role="img" aria-label={t('csv.wb.groupChartLabel', { by: nameOf(groupByColumnId) })}>
            {shownGroups.map((group, position) => {
              const barWidth = (group.value / tallest) * (width - labelWidth - 70)
              const y = position * rowHeight
              return (
                <g key={group.group}>
                  <text className="lbl" x="0" y={y + 16}>
                    {group.group.length > 14 ? `${group.group.slice(0, 13)}…` : group.group}
                  </text>
                  <rect className="bg" x={labelWidth} y={y + 5} width={width - labelWidth - 70} height="14" rx="3" />
                  <rect className="fg" x={labelWidth} y={y + 5} width={Math.max(2, barWidth)} height="14" rx="3" />
                  <text x={width} y={y + 16} textAnchor="end">
                    {formatNumber(group.value, decimals)}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="small-note" style={{ marginTop: 8 }}>
            {groupAggregate === 'avg' ? tp('csv.wb.groupsNoteAverage', groupTotals.length, { rows: shownRowCount }) : tp('csv.wb.groupsNote', groupTotals.length, { total: formatNumber(total, decimals), rows: shownRowCount })}
          </div>
        </div>
      </>
    )
  }

  function renderIssuesBody() {
    return issues.map((issue, position) => (
      <div key={position} className="issue">
        <span className={`badge${issue.kind === 'warn' ? '' : ' info'}`}>
          <Icon name={issue.kind === 'warn' ? 'warn' : 'info'} size="sm" />
        </span>
        <div>
          <div className="t">{issue.title}</div>
          {issue.detail && <div className="d">{issue.detail}</div>}
        </div>
        {issue.goTo ? (
          <button className="btn sm outline" id={`issue-go-to-${position}`} type="button" onClick={() => issue.goTo && goToCell(issue.goTo.rowId, issue.goTo.columnId)}>
            {t('csv.wb.goTo')}
          </button>
        ) : issue.showBlanksOf !== undefined ? (
          <button
            className="btn sm outline"
            id={`issue-filter-${position}`}
            type="button"
            onClick={() => {
              if (issue.showBlanksOf === undefined) return
              setFilter(issue.showBlanksOf, { columnId: issue.showBlanksOf, kind: 'empty' })
              setIsSheetOpen(false)
            }}
          >
            {t('csv.wb.show')}
          </button>
        ) : (
          <span />
        )}
      </div>
    ))
  }

  function renderChangesBody() {
    const deletedRowIds = [...edits.deletedRowIds].slice(0, MAX_LISTED_CHANGES)
    const hasChanges = session.changeCount > 0
    return (
      <>
        <div className="sec" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="small-note" style={{ flex: 1 }}>
            {describeCsvChanges(edits, locale) || t('csv.wb.noChangesShort')}
          </span>
          <button className="btn sm danger" id="revert-all-button" type="button" disabled={!hasChanges} onClick={() => (session.revertAll(), showToast(t('csv.wb.revertedAll'), true))}>
            {t('toolbar.revertAll')}
          </button>
        </div>
        {!hasChanges && <div className="empty-note">{t('csv.wb.noChanges')}</div>}
        {structureSummary && <div className="empty-note">{structureSummary}</div>}
        {changeRows.map((change, position) => (
          <div key={change.key} className="change">
            <span className="addr">{change.address}</span>
            <span className="diff" dir="auto">
              {change.isRename ? t('csv.wb.columnWord') : change.columnName}: <del>{change.oldText || t('csv.wb.emptyValue')}</del> → <ins>{change.newText || t('csv.wb.emptyValue')}</ins>
            </span>
            <span style={{ display: 'flex', gap: 2 }}>
              {!change.isRename && (
                <button className="btn sm" id={`change-go-to-${position}`} type="button" onClick={() => goToCell(change.rowId, change.columnId)}>
                  {t('csv.wb.goTo')}
                </button>
              )}
              <button className="btn sm icon" id={`change-revert-${position}`} type="button" aria-label={t('csv.wb.revertCell')} onClick={() => commitCell(change.rowId, change.columnId, change.oldText)}>
                <Icon name="undo" size="sm" />
              </button>
            </span>
          </div>
        ))}
        {deletedRowIds.map((rowId) => (
          <div key={`deleted-${rowId}`} className="change">
            <span className="addr">{rowNumberOf(rowId)}</span>
            <span className="diff">
              <del>{t('csv.wb.rowDeleted', { row: rowNumberOf(rowId) })}</del>
            </span>
            <button className="btn sm" id={`restore-row-${rowId}`} type="button" onClick={() => applyEdits(withRestoredRow(edits, rowId))}>
              {t('csv.wb.restore')}
            </button>
          </div>
        ))}
      </>
    )
  }

  const sheetSummary =
    profileColumnId !== null && profile ? (
      <>
        <span className="prof-name" dir="auto">
          {nameOf(profileColumnId)}
        </span>
        <span className="tb">{t(COLUMN_TYPE_LABEL_KEYS[typeOf(profileColumnId)])}</span>
        <span>{typeOf(profileColumnId) === 'number' ? `${t('csv.wb.mean')} ${formatNumber(summarizeNumbers(profile.numbers)?.mean, 2)}` : tp('csv.wb.distinctCount', profile.distinctCount)}</span>
      </>
    ) : (
      <>
        <span className="prof-name">{t('csv.wb.overview')}</span>
        <span>{t('csv.wb.rowsAndColumns', { rows: tp('csv.rowCount', totalRowCount), columns: tp('csv.columnCount', displayColumnIds.length) })}</span>
      </>
    )

  const activeCellName = hasActiveCell ? nameOf(activeColumnId) : ''
  const activeCellText = hasActiveCell ? getText(activeRowId, activeColumnId) : ''
  const activeCellAddress = hasActiveCell && active ? `${columnLabel(active.c)}${rowNumberOf(activeRowId)}` : ''

  const gridEmpty = (
    <>
      {t('csv.wb.noRowsMatch')}{' '}
      <button
        className="link"
        id="empty-clear-filters-button"
        type="button"
        onClick={() => {
          setFilters([])
          setSearchText('')
        }}
      >
        {t('csv.wb.clearFilters')}
      </button>
    </>
  )

  return (
    <div id="csv-workbench" className={isDockOpen ? undefined : 'dock-closed'} style={{ '--dock-w': `${dockWidthPx}px` } as CSSProperties}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />

      <header id="top-bar">
        <button className="brand" type="button" id="home-button" aria-label={t('csv.wb.home')} onClick={onClose} style={{ border: 0, background: 'transparent', padding: 0 }}>
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
              <path d="M3.5 9.5h17M9.5 3.5v17" />
            </svg>
          </span>
          <span className="brand-name">OpenAnyDoc</span>
          <span className="slash" aria-hidden="true">
            /
          </span>
          <h1 className="page-title">{t('csv.wb.title')}</h1>
        </button>
        <button className="file-chip" id="open-menu-button" type="button" aria-haspopup="menu" aria-label={t('csv.wb.fileChipLabel', { name: fileName })} onClick={(event) => openPopover('file', event.currentTarget)}>
          <Icon name="file" size="sm" />
          <span className="fname" dir="auto">
            {fileName}
          </span>
          <span className="fmeta desk-only" dir="ltr">
            {formatFileSize(openedFile.file.size)}
          </span>
          {session.changeCount > 0 && <span className="mod" id="modified-dot" title={t('csv.wb.edited')} />}
          <Icon name="down" size="xs" />
        </button>
        <span className="privacy-pill">
          <Icon name="lock" size="sm" />
          {t('csv.wb.privacy')}
        </span>
        <span className="spacer" />
        <button className="btn icon" id="undo-button" type="button" aria-label={t('toolbar.undo')} title={t('toolbar.undoTip')} disabled={!session.canUndo} onClick={session.undo}>
          <Icon name="undo" />
        </button>
        <button className="btn icon" id="redo-button" type="button" aria-label={t('toolbar.redo')} title={t('toolbar.redoTip')} disabled={!session.canRedo} onClick={session.redo}>
          <Icon name="redo" />
        </button>
        <span className="vsep desk-only" />
        <LanguageSwitcher className="btn desk-only" />
        <button className="btn primary" id="download-button" type="button" disabled={!readableCsv} title={t('csv.wb.downloadTip')} onClick={() => downloadCsv(defaultDownloadSettings())}>
          <Icon name="download" />
          <span className="lbl">{t('csv.wb.downloadFormat', { format: tableFormat.label })}</span>
        </button>
        <button className="btn icon" id="theme-toggle" type="button" aria-label={isDark ? t('theme.toLight') : t('theme.toDark')} onClick={toggleTheme}>
          <Icon name="sun" className="i-sun" />
          <Icon name="moon" className="i-moon" />
        </button>
      </header>

      <nav id="command-bar" aria-label={t('csv.wb.commands')}>
        <label className="search" htmlFor="search-input">
          <Icon name="search" size="sm" />
          <input
            id="search-input"
            ref={searchInputRef}
            type="search"
            dir="auto"
            placeholder={t('csv.wb.searchAllCells')}
            autoComplete="off"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value)
              setSelection(null)
              setActive(null)
            }}
          />
          <span id="search-count">{deferredSearchText ? tp('csv.wb.rowCount', shownRowCount) : ''}</span>
          <kbd className="desk-only">/</kbd>
        </label>
        <button className="btn icon phone-only" id="mobile-find-button" type="button" aria-label={t('find.label')} onClick={(event) => openPopover('find', event.currentTarget)}>
          <Icon name="replace" />
        </button>
        <div className="cmd-group">
          <button
            className={`btn${filters.length ? ' on' : ''}`}
            id="filter-button"
            type="button"
            disabled={!readableCsv}
            onClick={(event) => {
              const position = selectedColumnId === null ? -1 : shownColumnIds.indexOf(selectedColumnId)
              if (position >= 0) openColumnMenu(position, document.getElementById(`column-menu-${position}`))
              else openPopover('filterPick', event.currentTarget)
            }}
          >
            <Icon name="filter" />
            {t('csv.wb.filter')}
            {filters.length > 0 && (
              <span className="count" id="filter-count">
                {filters.length}
              </span>
            )}
          </button>
          <button className={`btn${sortLevels.length ? ' on' : ''}`} id="sort-button" type="button" disabled={!readableCsv} onClick={(event) => openPopover('sort', event.currentTarget)}>
            <Icon name="sort" />
            {t('csv.wb.sort')}
          </button>
          <button className="btn" id="columns-button" type="button" disabled={!readableCsv} onClick={(event) => openPopover('columns', event.currentTarget)}>
            <Icon name="columns" />
            {t('csv.wb.columns')}
          </button>
          <button className="btn" id="group-by-button" type="button" disabled={!readableCsv} onClick={() => showDockTab('group')}>
            <Icon name="group" />
            {t('csv.wb.groupBy')}
          </button>
        </div>
        <span className="vsep" />
        <div className="cmd-group">
          <button className="btn" id="clean-menu-button" type="button" aria-haspopup="menu" disabled={!readableCsv} onClick={(event) => openPopover('clean', event.currentTarget)}>
            <Icon name="wand" />
            {t('csv.wb.cleanUp')}
            <Icon name="down" className="caret" />
          </button>
          <button className="btn" id="find-replace-button" type="button" disabled={!readableCsv} onClick={(event) => openPopover('find', event.currentTarget)}>
            <Icon name="replace" />
            {t('csv.wb.findReplace')}
          </button>
          <button className="btn" id="more-menu-button" type="button" aria-haspopup="menu" disabled={!readableCsv} onClick={(event) => openPopover('more', event.currentTarget)}>
            <Icon name="more" />
            {t('csv.wb.more')}
            <Icon name="down" className="caret" />
          </button>
        </div>
        <span className="spacer" />
        <button className="btn" id="panel-toggle-button" type="button" aria-pressed={isDockOpen} aria-controls="dock" title={t('csv.wb.panelTip')} onClick={() => setIsDockOpen(!isDockOpen)}>
          <Icon name="panel" />
          {t('csv.wb.panel')}
        </button>
      </nav>

      {hasActiveCell && (
        <div id="value-bar">
          <input
            id="cell-address-input"
            aria-label={t('csv.wb.cellAddress')}
            key={activeCellAddress}
            defaultValue={activeCellAddress}
            dir="ltr"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                goToRow(event.currentTarget.value)
              }
            }}
          />
          <span className="vb-col" id="value-bar-column">
            <span className="mono" style={{ color: 'var(--text)' }} dir="auto">
              {activeCellName}
            </span>
            <span className="tb">{t(COLUMN_TYPE_LABEL_KEYS[typeOf(activeColumnId)])}</span>
          </span>
          <span className="fx" aria-hidden="true">
            fx
          </span>
          <input
            id="cell-value-input"
            aria-label={t('csv.wb.cellValue')}
            autoComplete="off"
            dir="auto"
            value={valueDraft ?? activeCellText}
            onChange={(event) => setValueDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (valueDraft !== null) commitCell(activeRowId, activeColumnId, valueDraft)
                setValueDraft(null)
                gridRef.current?.focus()
              } else if (event.key === 'Escape') {
                setValueDraft(null)
                gridRef.current?.focus()
              }
            }}
            onBlur={() => {
              if (valueDraft !== null) commitCell(activeRowId, activeColumnId, valueDraft)
              setValueDraft(null)
            }}
          />
          <span className="vb-note" id="value-bar-note">
            {edits.cells.has(cellKey(activeRowId, activeColumnId)) ? (
              <>
                <b>{t('csv.wb.edited')}</b> · {t('csv.wb.was', { text: getOriginalCellText(rows, activeRowId, activeColumnId) || t('csv.wb.emptyValue') })}
              </>
            ) : isMissing(activeRowId, activeColumnId) ? (
              t('csv.wb.missingField')
            ) : (
              t('csv.wb.enterToSave')
            )}
          </span>
        </div>
      )}

      {(filters.length > 0 || sortLevels.length > 0) && (
        <div id="chips-bar" aria-label={t('csv.wb.activeFilters')}>
          {filters.length > 0 && <span className="chips-label">{t('csv.wb.filter')}</span>}
          {filters.map((filter, position) => {
            const [operator, value] = describeFilter(filter)
            const columnPosition = shownColumnIds.indexOf(filter.columnId)
            return (
              <span key={filter.columnId} style={{ display: 'contents' }}>
                <span className="chip">
                  <button className="chip-body" id={`edit-filter-${position}`} type="button" aria-label={t('csv.wb.editFilter', { name: nameOf(filter.columnId) })} onClick={(event) => columnPosition >= 0 && openColumnMenu(columnPosition, event.currentTarget)}>
                    <span className="k" dir="auto">
                      {nameOf(filter.columnId)}
                    </span>
                    <span className="op">{operator}</span>
                    <span dir="auto">{value}</span>
                  </button>
                  <button className="x" id={`remove-filter-${position}`} type="button" aria-label={t('csv.wb.removeFilter', { name: nameOf(filter.columnId) })} onClick={() => setFilter(filter.columnId, null)}>
                    <Icon name="x" size="xs" />
                  </button>
                </span>
                {position < filters.length - 1 && <span className="op" style={{ fontSize: 11, color: 'var(--faint)' }}>{matchAllFilters ? t('csv.wb.and') : t('csv.wb.or')}</span>}
              </span>
            )
          })}
          {filters.length > 0 && (
            <button className="chip-add" id="add-filter-button" type="button" onClick={(event) => openPopover('filterPick', event.currentTarget)}>
              <Icon name="plus" size="xs" />
              {t('csv.wb.addFilter')}
            </button>
          )}
          {filters.length > 1 && (
            <select className="match-mode" id="match-mode-select" aria-label={t('csv.wb.howFiltersCombine')} value={matchAllFilters ? 'all' : 'any'} onChange={(event) => setMatchAllFilters(event.target.value === 'all')}>
              <option value="all">{t('csv.wb.matchAll')}</option>
              <option value="any">{t('csv.wb.matchAny')}</option>
            </select>
          )}
          {sortLevels.length > 0 && (
            <>
              {filters.length > 0 && <span className="vsep" />}
              <span className="chips-label">{t('csv.wb.sort')}</span>
            </>
          )}
          {sortLevels.map((level, position) => (
            <span key={level.columnId} className="chip sort">
              <button className="chip-body" id={`edit-sort-${position}`} type="button" aria-label={t('csv.wb.editSort')} onClick={(event) => openPopover('sort', event.currentTarget)}>
                <span className="ord">{position + 1}</span>
                <span className="k" dir="auto">
                  {nameOf(level.columnId)}
                </span>
                <span className="op">{sortDirectionLabel(level.columnId, level.direction)}</span>
              </button>
              <button className="x" id={`remove-sort-${position}`} type="button" aria-label={t('csv.wb.removeSort', { name: nameOf(level.columnId) })} onClick={() => setSortLevels((current) => current.filter((_, index) => index !== position))}>
                <Icon name="x" size="xs" />
              </button>
            </span>
          ))}
          <span className="spacer" />
          <span className="row-count">{t('csv.wb.rowsOfBold', { shown: shownRowCount.toLocaleString('en-US'), total: totalRowCount.toLocaleString('en-US') })}</span>
          <button
            className="btn sm"
            id="clear-all-filters-button"
            type="button"
            onClick={() => {
              setFilters([])
              setSortLevels([])
              setSearchText('')
            }}
          >
            {t('csv.wb.clearAll')}
          </button>
        </div>
      )}

      <main id="studio">
        <section id="grid-pane" aria-label={t('csv.wb.table')}>
          {parsedCsv === null && (
            <p className="empty-note" id="file-loading-note" role="status">
              {t('csv.reading')}
            </p>
          )}
          {parsedCsv?.status === 'error' && (
            <div className="fatal">
              <FatalFileError title={t('csv.error.title')} reason={t(`csv.error.${parsedCsv.reason}`)} hint={t('csv.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />
            </div>
          )}
          {readableCsv && (
            <CsvGrid
              gridRef={gridRef}
              label={fileName}
              columns={gridColumns}
              rowIds={visibleRowIds}
              getText={getText}
              getRowLabel={rowNumberOf}
              isEdited={isEdited}
              isMissing={isMissing}
              frozenCount={shownFrozenCount}
              sortOrderByColumnId={sortOrderByColumnId}
              showSortLevels={sortLevels.length > 1}
              filteredColumnIds={filteredColumnIds}
              selectedColumnId={selectedColumnId}
              selection={selection}
              active={active}
              searchText={deferredSearchText}
              findMatches={findMatches}
              findColumnId={find.columnId}
              editingCell={editingCell}
              onEditDraftChange={(draft) => editingCell && setEditingCell({ ...editingCell, draft })}
              onEditFinish={finishEditing}
              onCellMouseDown={(rowPosition, columnPosition, extend) => {
                isDraggingSelectionRef.current = true
                selectCell(rowPosition, columnPosition, extend)
              }}
              onCellMouseEnter={(rowPosition, columnPosition) => {
                if (!isDraggingSelectionRef.current || !selection) return
                if (selection.r1 !== rowPosition || selection.c1 !== columnPosition) setSelection({ ...selection, r1: rowPosition, c1: columnPosition })
              }}
              onCellDoubleClick={(rowPosition, columnPosition) => startEditing(rowPosition, columnPosition)}
              onCellContextMenu={(rowPosition, columnPosition, event) => {
                event.preventDefault()
                const isInSelection = selectedCells.some((position) => position.r === rowPosition && position.c === columnPosition)
                if (!isInSelection) selectCell(rowPosition, columnPosition)
                openPopover('context', null, { point: { x: event.clientX, y: event.clientY } })
              }}
              onRowHeaderMouseDown={(rowPosition) => {
                setSelection({ r0: rowPosition, c0: 0, r1: rowPosition, c1: shownColumnIds.length - 1 })
                setActive({ r: rowPosition, c: 0 })
              }}
              onHeaderClick={(columnPosition, withShift) => {
                const columnId = shownColumnIds[columnPosition]
                if (withShift) {
                  setSortLevels((current) => (current.some((level) => level.columnId === columnId) ? current.map((level) => (level.columnId === columnId ? { ...level, direction: level.direction === 'asc' ? 'desc' : 'asc' } : level)) : [...current, { columnId, direction: 'asc' }]))
                  return
                }
                selectColumn(columnPosition)
              }}
              onHeaderMenu={openColumnMenu}
              onColumnResize={(columnId, widthPx) => setColumnWidthOverrides((current) => new Map(current).set(columnId, widthPx))}
              onColumnMove={(columnId, beforeColumnId) => moveColumn(columnId, displayColumnIds.indexOf(beforeColumnId) > displayColumnIds.indexOf(columnId) ? displayColumnIds.indexOf(beforeColumnId) - 1 : displayColumnIds.indexOf(beforeColumnId))}
              onKeyDown={handleGridKeyDown}
              emptyContent={gridEmpty}
            />
          )}
        </section>
        <button
          id="dock-resizer"
          type="button"
          aria-label={t('csv.wb.resizePanel')}
          title={t('csv.wb.dragToResize')}
          onMouseDown={(event) => {
            event.preventDefault()
            const startX = event.clientX
            const startWidth = dockWidthPx
            const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
            const handle = event.currentTarget
            handle.classList.add('dragging')
            function resizeDock(moveEvent: MouseEvent) {
              const moved = isRightToLeft ? moveEvent.clientX - startX : startX - moveEvent.clientX
              setDockWidthPx(Math.max(280, Math.min(560, startWidth + moved)))
            }
            function stopResizing() {
              handle.classList.remove('dragging')
              document.removeEventListener('mousemove', resizeDock)
              document.removeEventListener('mouseup', stopResizing)
            }
            document.addEventListener('mousemove', resizeDock)
            document.addEventListener('mouseup', stopResizing)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
            const grows = (event.key === 'ArrowLeft') !== isRightToLeft
            setDockWidthPx((width) => Math.max(280, Math.min(560, width + (grows ? 16 : -16))))
          }}
        >
          <span className="grip" />
        </button>
        <aside id="dock" className={isSheetOpen ? 'open' : undefined} aria-labelledby="dock-title">
          <button className="sheet-handle" id="sheet-handle-button" type="button" aria-label={t('csv.wb.openProfile')} onClick={() => setIsSheetOpen(!isSheetOpen)}>
            <span className="bar" />
            <span className="sheet-sum" id="sheet-summary">
              {sheetSummary}
              <span className="spacer" />
              <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{t('csv.wb.profile')}</span>
            </span>
          </button>
          <div className="dock-head">
            <h2 id="dock-title" dir="auto">
              {dockTitle}
            </h2>
            <span className="dock-sub" id="dock-subtitle">
              {dockSubtitle}
            </span>
            {dockTab !== 'profile' && (
              <button className="btn sm" id="dock-back-button" type="button" style={{ marginInlineStart: 'auto' }} onClick={() => setDockTab('profile')}>
                {t('csv.wb.profile')}
              </button>
            )}
          </div>
          <div className="dock-panel on" id={`dock-panel-${dockTab}`}>
            <div className="scroll" id={dockTab === 'profile' ? 'profile-scroll' : `${dockTab}-scroll`} style={{ flex: 1 }}>
              {dockTab === 'profile' && renderProfileBody()}
              {dockTab === 'group' && renderGroupBody()}
              {dockTab === 'issues' && renderIssuesBody()}
              {dockTab === 'changes' && renderChangesBody()}
            </div>
          </div>
        </aside>
      </main>

      <footer id="status-bar">
        <button className="sb" id="status-rows-button" type="button" title={t('csv.wb.goToRowTip', { shortcut: shortcutLabel('G') })} onClick={openGoToDialog}>
          {shownRowCount < totalRowCount ? (
            <>
              <b>{shownRowCount.toLocaleString('en-US')}</b> {t('csv.wb.ofRows', { total: totalRowCount.toLocaleString('en-US') })}
            </>
          ) : (
            <>
              <b>{totalRowCount.toLocaleString('en-US')}</b> {tp('csv.wb.rowsWord', totalRowCount)}
            </>
          )}{' '}
          · {tp('csv.columnCount', shownColumnIds.length)}
          {hiddenCount > 0 && ` ${t('csv.wb.hiddenCount', { count: hiddenCount })}`}
        </button>
        {selectionStats && (
          <>
            <span className="sb-sep" />
            <span className="sb">
              {t('csv.wb.count')} <span className="v">{selectionStats.filledCount}</span>
            </span>
            {selectionStats.summary && (
              <>
                <span className="sb">
                  {t('csv.wb.sum')} <span className="v">{formatNumber(selectionStats.summary.sum, selectionStats.decimals)}</span>
                </span>
                <span className="sb">
                  {t('csv.wb.avg')} <span className="v">{formatNumber(selectionStats.summary.mean, 2)}</span>
                </span>
                <span className="sb">
                  {t('csv.wb.min')} <span className="v">{formatNumber(selectionStats.summary.min, selectionStats.decimals)}</span>
                </span>
                <span className="sb">
                  {t('csv.wb.max')} <span className="v">{formatNumber(selectionStats.summary.max, selectionStats.decimals)}</span>
                </span>
              </>
            )}
            <button className="sb accent" id="status-copy-button" type="button" title={t('csv.wb.copyTip', { shortcut: shortcutLabel('C') })} onClick={() => copySelection(false)}>
              <Icon name="copy" size="xs" />
              {t('csv.wb.copy')}
            </button>
            <button className="sb accent" id="status-paste-button" type="button" title={t('csv.wb.pasteHint', { shortcut: shortcutLabel('V') })} onClick={() => showToast(t('csv.wb.pasteHint', { shortcut: shortcutLabel('V') }))}>
              <Icon name="paste" size="xs" />
              {t('csv.wb.paste')}
            </button>
          </>
        )}
        <span className="spacer" />
        {session.changeCount > 0 && (
          <>
            <button className="sb accent" id="status-changes-button" type="button" onClick={() => showDockTab('changes')}>
              {tp('csv.wb.changesCount', session.changeCount)}
            </button>
            <span className="sb-sep" />
          </>
        )}
        {offersExcelCopy && !isPhone && (
          <>
            <button className="sb accent" id="download-excel-copy-button" type="button" title={t('csv.excelCopy.reason')} onClick={downloadExcelCopy}>
              <Icon name="download" size="xs" />
              {t('csv.wb.excelCopyShort')}
            </button>
            <span className="sb-sep" />
          </>
        )}
        {(unevenCount > 0 || parseNoticeTexts.length > 0) && (
          <>
            <button className="sb quiet" id="status-issues-button" type="button" title={t('csv.wb.showIssues')} onClick={() => showDockTab('issues')}>
              <Icon name="warn" size="xs" />
              {unevenCount === 1 ? t('csv.wb.oneUnevenRow', { row: unevenRowIds[0] - firstDataRowId + 1 }) : unevenCount > 1 ? tp('csv.wb.unevenRows', unevenCount) : tp('csv.wb.notices', parseNoticeTexts.length)}
            </button>
            <span className="sb-sep" />
          </>
        )}
        <button className="sb" id="status-delimiter-button" type="button" title={t('csv.wb.readingMenu')} onClick={(event) => openPopover('reading', event.currentTarget)}>
          {statusDelimiter} · {statusEncoding} · {statusLineEnding}
        </button>
      </footer>
      <div id="mobile-status">
        <span>
          {shownRowCount < totalRowCount ? (
            <>
              <b>{shownRowCount.toLocaleString('en-US')}</b> {t('csv.wb.ofRows', { total: totalRowCount.toLocaleString('en-US') })}
            </>
          ) : (
            <>
              <b>{totalRowCount.toLocaleString('en-US')}</b> {tp('csv.wb.rowsWord', totalRowCount)}
            </>
          )}
        </span>
        {selectionStats?.summary && (
          <>
            <span>·</span>
            <span>
              {t('csv.wb.sum')} <span className="v">{formatNumber(selectionStats.summary.sum, selectionStats.decimals)}</span>
            </span>
            <span>
              {t('csv.wb.avg')} <span className="v">{formatNumber(selectionStats.summary.mean, 2)}</span>
            </span>
          </>
        )}
        <span className="spacer" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={t('csv.wb.privacy')}>
          <Icon name="lock" size="xs" />
          {t('csv.wb.nothingUploaded')}
        </span>
      </div>
      <nav id="action-bar" aria-label={t('csv.wb.commands')}>
        <button
          className="ab"
          id="mobile-filter-button"
          type="button"
          onClick={(event) => {
            const position = selectedColumnId === null ? -1 : shownColumnIds.indexOf(selectedColumnId)
            if (position >= 0) openColumnMenu(position, event.currentTarget)
            else openPopover('filterPick', event.currentTarget)
          }}
        >
          <Icon name="filter" />
          {t('csv.wb.filter')}
          {filters.length > 0 && (
            <span className="dot" id="mobile-filter-count">
              {filters.length}
            </span>
          )}
        </button>
        <button className="ab" id="mobile-sort-button" type="button" onClick={(event) => openPopover('sort', event.currentTarget)}>
          <Icon name="sort" />
          {t('csv.wb.sort')}
        </button>
        <button className="ab" id="mobile-columns-button" type="button" onClick={(event) => openPopover('columns', event.currentTarget)}>
          <Icon name="columns" />
          {t('csv.wb.columns')}
        </button>
        <button className="ab" id="mobile-clean-button" type="button" onClick={(event) => openPopover('clean', event.currentTarget)}>
          <Icon name="wand" />
          {t('csv.wb.cleanUp')}
        </button>
        <button className="ab" id="mobile-more-button" type="button" onClick={(event) => openPopover('more', event.currentTarget)}>
          <Icon name="more" />
          {t('csv.wb.more')}
        </button>
      </nav>

      {popover && (
        <div className="pop" id="popover" ref={popoverRef} role="dialog" aria-modal="false" style={{ width: popover.kind === 'column' ? 320 : popover.kind === 'sort' || popover.kind === 'find' ? 340 : popover.kind === 'columns' ? 360 : popover.kind === 'reading' || popover.kind === 'file' ? 300 : 260 }}>
          {renderPopoverContent()}
        </div>
      )}
      <div id="csv-toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.canUndo && session.canUndo && (
              <button
                className="btn sm"
                id="toast-undo-button"
                type="button"
                onClick={() => {
                  session.undo()
                  setToast(null)
                }}
              >
                {t('toolbar.undo')}
              </button>
            )}
          </div>
        )}
      </div>
      <div id="drop-overlay">{t('csv.wb.dropOverlay')}</div>

      <WorkbenchDialog id="dialog-download" titleId="download-dialog-title" isOpen={openDialog === 'download'} onClose={() => setOpenDialog(null)}>
        {downloadDraft && renderDownloadDialog(downloadDraft)}
      </WorkbenchDialog>

      <WorkbenchDialog id="dialog-paste" titleId="paste-dialog-title" isOpen={openDialog === 'paste'} onClose={() => setOpenDialog(null)}>
        {renderPasteDialog()}
      </WorkbenchDialog>

      <WorkbenchDialog id="dialog-go-to-row" titleId="go-to-row-dialog-title" isOpen={openDialog === 'goTo'} onClose={() => setOpenDialog(null)}>
        {renderGoToDialog()}
      </WorkbenchDialog>

      <WorkbenchDialog id="dialog-clean-tool" titleId="clean-tool-dialog-title" isOpen={openDialog === 'clean'} onClose={() => setOpenDialog(null)}>
        <div className="dlg-head">
          <h2 id="clean-tool-dialog-title">{t(({ split: 'csv.wb.splitTitle', merge: 'csv.wb.mergeTitle', dupes: 'csv.wb.dupesTitle', transpose: 'csv.wb.transposeTitle' } as Record<CleanTool, MessageKey>)[cleanTool])}</h2>
          <span className="spacer" />
          <button className="btn icon" id="clean-tool-close-button" type="button" aria-label={t('find.close')} onClick={() => setOpenDialog(null)}>
            <Icon name="x" />
          </button>
        </div>
        <div className="dlg-body" id="clean-tool-body">
          {cleanTool === 'split' && (
            <>
              <div className="two">
                <label className="field">
                  {t('csv.wb.column')}
                  <select id="split-column-select" value={splitSettings.columnId} onChange={(event) => setSplitSettings({ ...splitSettings, columnId: Number(event.target.value) })}>
                    {columnOptions}
                  </select>
                </label>
                <label className="field">
                  {t('csv.wb.separator')}
                  <input id="split-separator-input" value={splitSettings.separator} onChange={(event) => setSplitSettings({ ...splitSettings, separator: event.target.value })} />
                </label>
              </div>
              <label className="toggle-row">
                <input type="checkbox" id="split-keep-checkbox" checked={splitSettings.keepOriginal} onChange={(event) => setSplitSettings({ ...splitSettings, keepOriginal: event.target.checked })} />
                {t('csv.wb.keepOriginal')}
              </label>
              <div className="opt-label">{t('csv.wb.previewFirstRows')}</div>
              <div className="preview" dir="auto">
                {previewRowIds.map((rowId) => {
                  const text = getText(rowId, splitSettings.columnId)
                  return (
                    <div key={rowId}>
                      <span>{text}</span>
                      <span>→</span>
                      {(splitSettings.separator === '' ? [text] : text.split(splitSettings.separator).slice(0, MAX_SPLIT_PARTS)).map((part, position) => (
                        <ins key={position}>{part}</ins>
                      ))}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {cleanTool === 'merge' && (
            <>
              <div className="two">
                <label className="field">
                  {t('csv.wb.firstColumn')}
                  <select id="merge-first-select" value={mergeSettings.firstColumnId} onChange={(event) => setMergeSettings({ ...mergeSettings, firstColumnId: Number(event.target.value) })}>
                    {columnOptions}
                  </select>
                </label>
                <label className="field">
                  {t('csv.wb.secondColumn')}
                  <select id="merge-second-select" value={mergeSettings.secondColumnId} onChange={(event) => setMergeSettings({ ...mergeSettings, secondColumnId: Number(event.target.value) })}>
                    {columnOptions}
                  </select>
                </label>
              </div>
              <div className="two">
                <label className="field">
                  {t('csv.wb.joinedWith')}
                  <input id="merge-separator-input" value={mergeSettings.separator} onChange={(event) => setMergeSettings({ ...mergeSettings, separator: event.target.value })} />
                </label>
                <label className="field">
                  {t('csv.wb.newColumnName')}
                  <input id="merge-name-input" dir="auto" value={mergeSettings.name} disabled={!hasHeaderRow} onChange={(event) => setMergeSettings({ ...mergeSettings, name: event.target.value })} />
                </label>
              </div>
              <div className="opt-label">{t('csv.wb.preview')}</div>
              <div className="preview" dir="auto">
                {previewRowIds.map((rowId) => (
                  <div key={rowId}>
                    <ins>{[getText(rowId, mergeSettings.firstColumnId), getText(rowId, mergeSettings.secondColumnId)].filter((text) => text !== '').join(mergeSettings.separator)}</ins>
                  </div>
                ))}
              </div>
            </>
          )}
          {cleanTool === 'dupes' && (
            <>
              <div className="opt-label">{t('csv.wb.dupesColumns')}</div>
              <div className="checklist" style={{ gridTemplateColumns: '1fr 1fr', maxHeight: 220 }}>
                {displayColumnIds.map((columnId, position) => (
                  <label key={columnId}>
                    <input
                      type="checkbox"
                      id={`dupes-column-${position}`}
                      checked={duplicateColumnIds.has(columnId)}
                      onChange={(event) =>
                        setDuplicateColumnIds((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(columnId)
                          else next.delete(columnId)
                          return next
                        })
                      }
                    />
                    <span className="mono" dir="auto">
                      {nameOf(columnId)}
                    </span>
                  </label>
                ))}
              </div>
              <div className="notice" style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}>
                <Icon name="info" size="sm" />
                <span>{tp('csv.wb.dupesFound', duplicateCount)}</span>
              </div>
            </>
          )}
          {cleanTool === 'transpose' && (
            <>
              <div className="small-note" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {t('csv.wb.transposeNote', { columns: displayColumnIds.length, rows: totalRowCount })}
              </div>
              <label className="toggle-row">
                <input type="checkbox" id="transpose-filtered-checkbox" checked={transposeShownOnly} onChange={(event) => setTransposeShownOnly(event.target.checked)} />
                {tp('csv.wb.onlyShownRows', shownRowCount)}
              </label>
            </>
          )}
        </div>
        <div className="dlg-foot">
          <span className="small-note" id="clean-tool-note">
            {cleanTool === 'split' ? t('csv.wb.splitNote', { max: MAX_SPLIT_PARTS }) : cleanTool === 'merge' ? t('csv.wb.mergeNote') : t('csv.wb.oneUndoStep')}
          </span>
          <span className="spacer" />
          <button className="btn outline" id="clean-tool-cancel-button" type="button" onClick={() => setOpenDialog(null)}>
            {t('csv.wb.cancel')}
          </button>
          <button className="btn primary" id="clean-tool-apply-button" type="button" disabled={cleanTool === 'dupes' && duplicateColumnIds.size === 0} onClick={applyCleanTool}>
            {t('csv.wb.apply')}
          </button>
        </div>
      </WorkbenchDialog>
    </div>
  )

  function renderDownloadDialog(settings: DownloadSettings) {
    const setSettings = setDownloadDraft
    return (
      <>
        <div className="dlg-head">
          <h2 id="download-dialog-title">{t('csv.wb.downloadFormat', { format: tableFormat.label })}</h2>
          <span className="spacer" />
          <button className="btn icon" id="download-dialog-close-button" type="button" aria-label={t('find.close')} onClick={() => setOpenDialog(null)}>
            <Icon name="x" />
          </button>
        </div>
        <div className="dlg-body">
          <div className="field">
            <label htmlFor="download-name-input">{t('csv.wb.fileName')}</label>
            <input id="download-name-input" dir="auto" value={settings.fileName} onChange={(event) => setSettings({ ...settings, fileName: event.target.value })} />
          </div>
          <div>
            <div className="opt-label">{t('csv.wb.rows')}</div>
            <div className="seg" id="download-rows-seg">
              <button id="download-rows-all-button" type="button" aria-pressed={!settings.onlyShownRows} onClick={() => setSettings({ ...settings, onlyShownRows: false })}>
                {tp('csv.wb.allRowsButton', totalRowCount)}
              </button>
              <button id="download-rows-filtered-button" type="button" aria-pressed={settings.onlyShownRows} onClick={() => setSettings({ ...settings, onlyShownRows: true })}>
                {tp('csv.wb.onlyShownRows', shownRowCount)}
              </button>
            </div>
            <div className="small-note" style={{ marginTop: 5 }}>
              {t('csv.wb.shownRowsNote')}
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="download-delimiter-select">{t('csv.delimiter.label')}</label>
              <select id="download-delimiter-select" value={settings.delimiter} onChange={(event) => setSettings({ ...settings, delimiter: event.target.value })}>
                {DELIMITER_OPTIONS.filter((option) => option.value !== 'auto').map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="opt-label">{t('csv.wb.lineEndings')}</div>
              <div className="seg">
                <button id="download-lf-button" type="button" aria-pressed={settings.lineEnding === '\n'} onClick={() => setSettings({ ...settings, lineEnding: '\n' })}>
                  LF
                </button>
                <button id="download-crlf-button" type="button" aria-pressed={settings.lineEnding === '\r\n'} onClick={() => setSettings({ ...settings, lineEnding: '\r\n' })}>
                  CRLF
                </button>
              </div>
            </div>
          </div>
          <label className="toggle-row">
            <input type="checkbox" id="download-header-checkbox" checked={settings.includeHeaderRow} disabled={!hasHeaderRow} onChange={(event) => setSettings({ ...settings, includeHeaderRow: event.target.checked })} />
            {t('csv.wb.includeHeader')}
          </label>
          <label className="toggle-row">
            <input type="checkbox" id="download-quote-checkbox" checked={settings.quoteAllFields} onChange={(event) => setSettings({ ...settings, quoteAllFields: event.target.checked })} />
            {t('csv.wb.quoteAll')}
          </label>
          <label className="toggle-row">
            <input type="checkbox" id="download-bom-checkbox" checked={settings.byteOrderMark} onChange={(event) => setSettings({ ...settings, byteOrderMark: event.target.checked })} />
            {t('csv.wb.byteOrderMark')}
          </label>
        </div>
        <div className="dlg-foot">
          <span className="small-note">{t('csv.wb.alwaysFormat', { format: tableFormat.label })}</span>
          <span className="spacer" />
          <button className="btn outline" id="download-cancel-button" type="button" onClick={() => setOpenDialog(null)}>
            {t('csv.wb.cancel')}
          </button>
          <button
            className="btn primary"
            id="download-confirm-button"
            type="button"
            onClick={() => {
              setOpenDialog(null)
              downloadCsv(settings)
            }}
          >
            <Icon name="download" />
            {t('csv.wb.download')}
          </button>
        </div>
      </>
    )
  }

  function renderPasteDialog() {
    return (
      <>
        <div className="dlg-head">
          <h2 id="paste-dialog-title">{t('csv.wb.pasteCsvTitle')}</h2>
          <span className="spacer" />
          <button className="btn icon" id="paste-dialog-close-button" type="button" aria-label={t('find.close')} onClick={() => setOpenDialog(null)}>
            <Icon name="x" />
          </button>
        </div>
        <div className="dlg-body">
          <textarea id="paste-text-input" aria-label={t('csv.wb.csvText')} placeholder={'order_id,city,total\n1001,Riyadh,28.00'} spellCheck={false} dir="auto" value={pastedText} onChange={(event) => setPastedText(event.target.value)} />
          <div className="small-note">{t('csv.wb.pasteNote')}</div>
        </div>
        <div className="dlg-foot">
          <span className="spacer" />
          <button className="btn outline" id="paste-cancel-button" type="button" onClick={() => setOpenDialog(null)}>
            {t('csv.wb.cancel')}
          </button>
          <button
            className="btn primary"
            id="paste-open-button"
            type="button"
            disabled={pastedText.trim() === ''}
            onClick={() => {
              setOpenDialog(null)
              onOpenFile(new File([pastedText], 'pasted.csv', { type: 'text/csv' }))
            }}
          >
            {t('csv.wb.openAsTable')}
          </button>
        </div>
      </>
    )
  }

  function renderGoToDialog() {
    const rowText = goToText
    const setRowText = setGoToText
    function goNow() {
      setOpenDialog(null)
      goToRow(rowText)
    }
    return (
      <>
        <div className="dlg-head">
          <h2 id="go-to-row-dialog-title">{t('csv.wb.goToRow')}</h2>
          <span className="spacer" />
          <kbd>{shortcutLabel('G')}</kbd>
        </div>
        <div className="dlg-body">
          <div className="field">
            <label htmlFor="go-to-row-input">{t('csv.wb.goToLabel', { last: totalRowCount })}</label>
            <input
              id="go-to-row-input"
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              autoFocus
              value={rowText}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setRowText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  goNow()
                }
              }}
            />
          </div>
          <div className="small-note">{t('csv.wb.goToNote')}</div>
        </div>
        <div className="dlg-foot">
          <span className="spacer" />
          <button className="btn outline" id="go-to-row-cancel-button" type="button" onClick={() => setOpenDialog(null)}>
            {t('csv.wb.cancel')}
          </button>
          <button className="btn primary" id="go-to-row-confirm-button" type="button" onClick={goNow}>
            {t('csv.wb.go')}
          </button>
        </div>
      </>
    )
  }
}
