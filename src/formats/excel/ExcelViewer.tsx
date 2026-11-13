import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react'
import { textControlClassName } from '../../buttonStyles'
import { FatalFileError, Notice } from '../../components/Messages'
import { formatFileSize, getLargeFileWarning } from '../../useFileIntake'
import { isolateText, useT } from '../../i18n'
import type { Locale } from '../../i18n'
import type { FormatViewerProps } from '../registry'
import { ColumnProfileView } from '../ColumnProfile'
import { COLUMN_TYPE_LABEL_KEYS, buildColumnProfile, detectColumnInfo, formatFilterRowText, parseFilterRowText, parseNumber, passesFilter } from '../csv/csvAnalysis'
import type { ColumnFilter } from '../csv/csvAnalysis'
import { Sidebar, WorkbenchDialog } from '../sheet/SheetChrome'
import DataTable, { SearchIcon, columnLabel, getRowNumberColumnWidthPx, measureColumnWidthsPx, useVisibleRowIds } from '../DataTable'
import type { DataTableHandle, SortState } from '../DataTable'
import type { EditSession } from '../useEditSession'
import {
  cellKey,
  findMatchingCells,
  getCellEditText,
  getCellText,
  getColumnIds,
  getMerges,
  getOriginalCellText,
  cssForStyle,
  getRowIds,
  readStyle,
  getSheetRecords,
  getSheetView,
  parseCellInput,
  describeUnreadableWorkbook,
  findCellByAddress,
  getCellNote,
  getCellValueText,
  parseWorkbook,
  readCell,
  readOriginalCell,
  suggestNewSheetName,
  textMatches,
  validateSheetName,
  withAddedSheet,
  withCells,
  withCellStyle,
  withMergedCells,
  withUnmergedCell,
  findMergeAt,
  withColumnWidth,
  withDeletedLines,
  withDeletedSheet,
  withInsertedLines,
  withNumberFormat,
  withTransformedText,
  withLink,
  withMovedSheet,
  changeDecimalPlaces,
  withRenamedSheet,
  withReplacedText,
} from './excelModel'
import type { CellPosition, CellStyle, ExcelEdits, ExcelExportSource, ExcelPanelTab, ExcelSelection, ExcelViewerCommands, ExcelWorkbookDialog, ParseResult } from './excelModel'
import type { ExcelActions, ExcelEditingComponents, SheetDialog } from './excelEditing'
import { createFormulaCalculator, translateFormulaRefs } from './excelFormulas'
import { MAX_STYLED_FILE_BYTES, readWorkbookStyles } from './excelStyles'
import SheetTabs from './SheetTabs'
import type { ExcelParseMessage, ExcelParseRequest } from './excelParse.worker'
import type * as XLSX from 'xlsx'

type EditingCell = CellPosition & { draft: string; source: 'cell' | 'bar' | 'header'; startedByTyping: boolean }
type CellRange = { anchor: CellPosition; focus: CellPosition }

const noIds: number[] = []
const MAX_CLIPBOARD_CELLS = 200_000
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent)

// Only web and e-mail links are opened; javascript:, file: and other schemes are not.
function isSafeLink(address: string) {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(address).protocol)
  } catch {
    return false
  }
}

// The side panels and workbook dialogs are fetched when first opened.
const FormulaListPanel = lazy(() => import('./ExcelPanels').then((panels) => ({ default: panels.FormulaListPanel })))
const WorkbookSearchPanel = lazy(() => import('./ExcelPanels').then((panels) => ({ default: panels.WorkbookSearchPanel })))
const SheetComparePanel = lazy(() => import('./ExcelPanels').then((panels) => ({ default: panels.SheetComparePanel })))
const WorkbookInfoDialog = lazy(() => import('./ExcelDialogs').then((dialogs) => ({ default: dialogs.WorkbookInfoDialog })))
const PrintSheetDialog = lazy(() => import('./ExcelDialogs').then((dialogs) => ({ default: dialogs.PrintSheetDialog })))
const WorkbookFilesDialog = lazy(() => import('./ExcelDialogs').then((dialogs) => ({ default: dialogs.WorkbookFilesDialog })))

const DIALOG_TITLE_IDS: Record<ExcelWorkbookDialog, string> = { info: 'workbook-info-title', print: 'print-sheet-title', files: 'workbook-files-title' }

// SheetJS reads the file in a Web Worker (a 20,000-row workbook held the page for about 300 ms). It lives here, not in
// excelModel.ts, because the worker imports excelModel.ts. If the worker cannot start, the page reads the file itself.
export function readWorkbookInWorker(contents: ArrayBuffer, fileName: string, locale: Locale): Promise<ParseResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./excelParse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<ExcelParseMessage>) => {
      worker.terminate()
      const message = event.data
      resolve(message.status === 'ok' ? message : describeUnreadableWorkbook(message.reason, locale))
    }
    worker.onerror = () => {
      worker.terminate()
      resolve(parseWorkbook(contents, fileName, locale))
    }
    const request: ExcelParseRequest = { contents, fileName }
    worker.postMessage(request)
  })
}

// A first row of text-only cells, one in every column, reads as a header, like in most spreadsheets.
function firstRowLooksLikeHeader(rowCount: number, columnCount: number, readFirstRowCell: (columnId: number) => XLSX.CellObject | undefined) {
  if (rowCount < 2) return false
  const firstRowCells = Array.from({ length: columnCount }, (_, columnId) => readFirstRowCell(columnId))
  return columnCount > 0 && firstRowCells.every((cell) => cell?.t === 's')
}

// The Excel viewer. In view mode it only reads; in edit mode the editing components (loaded on first Edit) add the menus, the
// value bar and find and replace. Every change goes through the shared edit session as an overlay on the parsed workbook.
export default function ExcelViewer({
  openedFile,
  mode,
  session: untypedSession,
  editingComponents,
  onOpenAnotherFile,
  onOpenFile,
  onSelectionChange,
  onCommandsChange,
  onExportSourceChange,
}: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const session = untypedSession as EditSession<ExcelEdits>
  const editing = editingComponents as ExcelEditingComponents | null
  const isEditable = mode === 'edit' && editing !== null
  const [stylesVersion, setStylesVersion] = useState(0)
  const [haveStylesFailed, setHaveStylesFailed] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [pickedSheetId, setPickedSheetId] = useState<number | null>(null)
  const [headerChoiceBySheetId, setHeaderChoiceBySheetId] = useState<Record<number, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [sortState, setSortState] = useState<SortState>(null)
  const [pickedRange, setRange] = useState<CellRange | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [columnMenu, setColumnMenu] = useState<{ columnId: number; left: number; top: number } | null>(null)
  const [dialog, setDialog] = useState<SheetDialog | null>(null)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [matchPosition, setMatchPosition] = useState(0)
  const [replaceResultMessage, setReplaceResultMessage] = useState('')
  const [showFormulas, setShowFormulas] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [isFilterRowShown, setIsFilterRowShown] = useState(false)
  // Filters belong to the sheet on screen and are cleared when another sheet is shown.
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])
  const [filterRowDrafts, setFilterRowDrafts] = useState<ReadonlyMap<number, string>>(new Map())
  const [panelTab, setPanelTab] = useState<ExcelPanelTab | null>(null)
  const [workbookDialog, setWorkbookDialog] = useState<ExcelWorkbookDialog | null>(null)
  // Hidden sheets the visitor chose to see get a tab.
  const [revealedSheetIds, setRevealedSheetIds] = useState<ReadonlySet<number>>(new Set())
  const [comparedCellKeys, setComparedCellKeys] = useState<ReadonlySet<string>>(new Set())
  const [revealRequestCount, setRevealRequestCount] = useState(0)
  const deferredSearchText = useDeferredValue(searchText)
  const deferredFindText = useDeferredValue(findText)
  const tableRef = useRef<DataTableHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pendingRevealRef = useRef<CellPosition | null>(null)
  const editWasCancelledRef = useRef(false)
  const { reset: resetEditSession } = session
  const edits = session.edits

  // Read in the worker; a newer file makes an older answer stale.
  useEffect(() => {
    // A new file starts from a clean state; this is the reset, not a value derived from other state.
    // oxlint-disable-next-line react/set-state-in-effect
    setParseResult(null)
    setPickedSheetId(null)
    setHeaderChoiceBySheetId({})
    setSortState(null)
    setRange(null)
    setEditingCell(null)
    setColumnFilters([])
    setRevealedSheetIds(new Set())
    resetEditSession()
    let isCurrentRead = true
    void readWorkbookInWorker(openedFile.contents, openedFile.file.name, locale).then((newParseResult) => {
      if (isCurrentRead) setParseResult(newParseResult)
    })
    return () => {
      isCurrentRead = false
    }
    // A language change must not re-read the file and drop the visitor's edits.
  }, [openedFile, resetEditSession]) // oxlint-disable-line react-hooks/exhaustive-deps

  // "/" jumps to the search box, Ctrl+` (⌘` on a Mac) shows formulas and Ctrl+Shift+F searches every sheet. They are registered only
  // while this viewer is on screen.
  useEffect(() => {
    function focusSearchOnSlash(event: globalThis.KeyboardEvent) {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
      const hasShortcutModifier = event.ctrlKey || event.metaKey
      if (event.key === '/' && !isTyping && !hasShortcutModifier) {
        event.preventDefault()
        searchInputRef.current?.focus()
      } else if (event.key === '`' && hasShortcutModifier) {
        event.preventDefault()
        setShowFormulas((isShown) => !isShown)
      } else if (event.key.toLowerCase() === 'f' && hasShortcutModifier && event.shiftKey) {
        event.preventDefault()
        setPanelTab('search')
      }
    }
    window.addEventListener('keydown', focusSearchOnSlash)
    return () => window.removeEventListener('keydown', focusSearchOnSlash)
  }, [])

  const parsed = parseResult?.status === 'ok' ? parseResult.parsed : null

  // Cell styles come from a second reader (ExcelJS) after the sheet is already on screen, for .xlsx and .xlsm files of moderate size.
  const fileName = openedFile.file.name.toLowerCase()
  const hasStyledFileType = fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm')
  useEffect(() => {
    if (!parsed || !hasStyledFileType || openedFile.file.size > MAX_STYLED_FILE_BYTES) return
    let isCancelled = false
    const stylesLoading = readWorkbookStyles(
      openedFile.contents,
      parsed.sheets.map((originalSheet) => originalSheet.name),
    )
    parsed.stylesLoading = stylesLoading
    stylesLoading.then(
      (styles) => {
        if (isCancelled) return
        parsed.styles = styles
        setStylesVersion((version) => version + 1)
      },
      () => {
        if (!isCancelled) setHaveStylesFailed(true)
      },
    )
    return () => {
      isCancelled = true
    }
  }, [parsed, hasStyledFileType, openedFile])
  const sheetRecords = useMemo(() => (parsed ? getSheetRecords(parsed, edits) : []), [parsed, edits])
  // A workbook opens on its first sheet that is not hidden.
  const isHiddenSheet = (sheetId: number) => sheetId >= 0 && parsed !== null && parsed.sheets[sheetId]?.visibility !== 'visible'
  const firstShownSheet = sheetRecords.find((sheetRecord) => !isHiddenSheet(sheetRecord.id)) ?? sheetRecords[0]
  const activeSheetId = sheetRecords.some((sheetRecord) => sheetRecord.id === pickedSheetId) ? pickedSheetId : (firstShownSheet?.id ?? null)
  const activeSheetName = sheetRecords.find((sheetRecord) => sheetRecord.id === activeSheetId)?.name ?? ''
  // Formula cells show values worked out from the edits; the calculator is rebuilt with every edit and works only on the cells drawn.
  const formulaCalculator = useMemo(() => (parsed ? createFormulaCalculator(parsed, edits) : null), [parsed, edits])
  const sheet = useMemo(
    () => (parsed && activeSheetId !== null ? getSheetView(parsed, edits, activeSheetId, formulaCalculator) : null),
    // The styles are added to `parsed` after the file is shown; the version number rebuilds the view when they arrive.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [parsed, edits, activeSheetId, formulaCalculator, stylesVersion],
  )
  const sheetRef = useRef(sheet)
  useEffect(() => {
    sheetRef.current = sheet
  }, [sheet])

  // Rows and columns on display. They are rebuilt only when the sheet's order changes, not on every cell edit.
  const sheetOriginal = sheet?.original ?? null
  const sheetRowOrder = sheet?.edits?.rowIds ?? null
  const sheetColumnOrder = sheet?.edits?.columnIds ?? null
  const allRowIds = useMemo(() => (sheet ? getRowIds(sheet) : noIds), [sheetOriginal, sheetRowOrder]) // oxlint-disable-line react-hooks/exhaustive-deps
  const columnIds = useMemo(() => (sheet ? getColumnIds(sheet) : noIds), [sheetOriginal, sheetColumnOrder]) // oxlint-disable-line react-hooks/exhaustive-deps
  // Judged from the file's own first row, so adding or deleting rows and columns never turns the header on or off.
  const looksLikeHeader = useMemo(() => {
    if (!sheet?.original) return false
    return firstRowLooksLikeHeader(sheet.original.rowCount, sheet.original.columnCount, (columnId) => readOriginalCell(sheet, 0, columnId))
  }, [sheet?.original]) // oxlint-disable-line react-hooks/exhaustive-deps
  const hasHeaderRow = activeSheetId !== null ? (headerChoiceBySheetId[activeSheetId] ?? (activeSheetId >= 0 && looksLikeHeader)) : false
  const headerRowId = hasHeaderRow ? allRowIds[0] : undefined
  const displayRowIds = useMemo(() => (hasHeaderRow ? allRowIds.slice(1) : allRowIds), [allRowIds, hasHeaderRow])
  const allRowPositionById = useMemo(() => new Map(allRowIds.map((rowId, position) => [rowId, position])), [allRowIds])

  // Rows and columns the file hides are left out unless "Show hidden rows and columns" is on.
  const hiddenRowIds = useMemo(() => new Set((sheetOriginal?.worksheet['!rows'] ?? []).flatMap((rowInfo, rowId) => (rowInfo?.hidden ? [rowId] : []))), [sheetOriginal])
  const hiddenColumnIds = useMemo(() => new Set((sheetOriginal?.worksheet['!cols'] ?? []).flatMap((columnInfo, columnId) => (columnInfo?.hidden ? [columnId] : []))), [sheetOriginal])
  const unhiddenRowIds = useMemo(() => (showHidden || hiddenRowIds.size === 0 ? displayRowIds : displayRowIds.filter((rowId) => !hiddenRowIds.has(rowId))), [displayRowIds, hiddenRowIds, showHidden])
  const shownColumnIds = useMemo(() => (showHidden || hiddenColumnIds.size === 0 ? columnIds : columnIds.filter((columnId) => !hiddenColumnIds.has(columnId))), [columnIds, hiddenColumnIds, showHidden])
  const shownColumnPositionById = useMemo(() => new Map(shownColumnIds.map((columnId, position) => [columnId, position])), [shownColumnIds])

  const columnNames = useMemo(
    () =>
      columnIds.map((columnId, columnPosition) => {
        const headerText = headerRowId !== undefined && sheet ? getCellText(sheet, headerRowId, columnId).trim() : ''
        return headerText || columnLabel(columnPosition)
      }),
    [columnIds, headerRowId, sheet],
  )
  const measuredColumnWidthsPx = useMemo(
    () =>
      sheet
        ? measureColumnWidthsPx(columnIds, columnNames, hasHeaderRow ? 1 : 0, sheetOriginal?.rowCount ?? 0, (rowId, columnId) => getOriginalCellText(sheet, rowId, columnId))
        : [],
    [columnIds, columnNames, hasHeaderRow, sheetOriginal], // oxlint-disable-line react-hooks/exhaustive-deps
  )
  const columnWidthsPx = useMemo(
    () => measuredColumnWidthsPx.map((measuredWidthPx, columnPosition) => sheet?.edits?.columnWidthsPx.get(columnIds[columnPosition]) ?? measuredWidthPx),
    [measuredColumnWidthsPx, columnIds, sheet?.edits?.columnWidthsPx],
  )
  const rowNumberColumnWidthPx = getRowNumberColumnWidthPx(allRowIds.length)

  const activeSort = sortState && columnIds.includes(sortState.columnId) ? sortState : null
  const sheetDataKey = useMemo(() => ({}), [parsed, activeSheetId]) // oxlint-disable-line react-hooks/exhaustive-deps

  // Column filters compare a cell's plain value (numbers without their format, dates as yyyy-mm-dd), read when the filters change.
  // Rows added here stay in view, and so do frozen rows (titles and headers), as Excel filters only below them.
  const frozenRowCount = sheetOriginal?.frozen?.rowCount ?? 0
  const filteredRowIds = useMemo(() => {
    if (columnFilters.length === 0 || !sheet) return unhiddenRowIds
    const isKept = (rowId: number) => rowId < 0 || (allRowPositionById.get(rowId) ?? Infinity) < frozenRowCount
    return unhiddenRowIds.filter((rowId) => isKept(rowId) || columnFilters.every((filter) => passesFilter(getCellValueText(sheet, rowId, filter.columnId), filter)))
  }, [unhiddenRowIds, columnFilters, frozenRowCount, sheetDataKey]) // oxlint-disable-line react-hooks/exhaustive-deps

  // Search and sort read the sheet as it was when they last changed, so a row does not jump away while it is edited.
  const visibleRowIds = useVisibleRowIds({
    rowIds: filteredRowIds,
    columnIds: shownColumnIds,
    searchText: deferredSearchText,
    sort: activeSort,
    readText: (rowId, columnId) => (sheetRef.current ? getCellText(sheetRef.current, rowId, columnId) : ''),
    // Rows added here stay in view while searching, so a new row never disappears as it is created.
    isAlwaysShown: (rowId) => rowId < 0,
    dataKey: sheetDataKey,
  })
  const visiblePositionByRowId = useMemo(() => new Map(visibleRowIds.map((rowId, position) => [rowId, position])), [visibleRowIds])
  const columnPositionById = useMemo(() => new Map(columnIds.map((columnId, position) => [columnId, position])), [columnIds])

  // A merge is drawn as one big cell when its rows and columns are next to each other on screen (not while sorted or searched).
  const mergeSpanByAnchorKey = useMemo(() => {
    const spans = new Map<string, { rowSpan: number; columnSpan: number }>()
    if (!sheet) return spans
    for (const merge of getMerges(sheet)) {
      const firstRowPosition = visiblePositionByRowId.get(merge.rowIds[0])
      const firstColumnPosition = shownColumnPositionById.get(merge.columnIds[0])
      if (firstRowPosition === undefined || firstColumnPosition === undefined) continue
      const rowsAreTogether = merge.rowIds.every((rowId, offset) => visiblePositionByRowId.get(rowId) === firstRowPosition + offset)
      const columnsAreTogether = merge.columnIds.every((columnId, offset) => shownColumnPositionById.get(columnId) === firstColumnPosition + offset)
      if (rowsAreTogether && columnsAreTogether && merge.rowIds.length * merge.columnIds.length > 1) {
        spans.set(cellKey(merge.rowIds[0], merge.columnIds[0]), { rowSpan: merge.rowIds.length, columnSpan: merge.columnIds.length })
      }
    }
    return spans
  }, [sheet, visiblePositionByRowId, shownColumnPositionById])

  // Frozen panes: the frozen rows that lead the shown rows stay under the header, and the frozen columns that lead the shown
  // columns stay at the start. Sorting a frozen row away simply unpins it.
  const frozen = sheetOriginal?.frozen ?? null
  let pinnedRowCount = 0
  while (frozen && pinnedRowCount < visibleRowIds.length && (allRowPositionById.get(visibleRowIds[pinnedRowCount]) ?? Infinity) < frozen.rowCount) pinnedRowCount++
  let frozenColumnCount = 0
  while (frozen && frozenColumnCount < shownColumnIds.length && (columnPositionById.get(shownColumnIds[frozenColumnCount]) ?? Infinity) < frozen.columnCount) frozenColumnCount++

  const shownColumnNames = useMemo(() => shownColumnIds.map((columnId) => columnNames[columnPositionById.get(columnId) ?? 0]), [shownColumnIds, columnNames, columnPositionById])
  const shownColumnWidthsPx = useMemo(() => shownColumnIds.map((columnId) => columnWidthsPx[columnPositionById.get(columnId) ?? 0]), [shownColumnIds, columnWidthsPx, columnPositionById])

  // Like a spreadsheet, a cell is always selected: the first one until the visitor picks another, so every tool works at once.
  // When a filter hides the picked cell's row, the first shown row of the same column is selected, so the column (and its profile)
  // stays the same.
  const firstRowId = visibleRowIds[0]
  const firstColumnId = pickedRange && shownColumnPositionById.has(pickedRange.focus.columnId) ? pickedRange.focus.columnId : shownColumnIds[0]
  const isPickedRowShown = pickedRange !== null && visiblePositionByRowId.has(pickedRange.focus.rowId)
  const range = useMemo(
    () => (pickedRange && (isPickedRowShown || columnFilters.length === 0) ? pickedRange : firstRowId !== undefined && firstColumnId !== undefined ? { anchor: { rowId: firstRowId, columnId: firstColumnId }, focus: { rowId: firstRowId, columnId: firstColumnId } } : null),
    [pickedRange, isPickedRowShown, columnFilters.length, firstRowId, firstColumnId],
  )
  // The selected cell is the end of the range; it stays selected only while its row and column are still shown.
  const selectedCell = range && visiblePositionByRowId.has(range.focus.rowId) && shownColumnPositionById.has(range.focus.columnId) ? range.focus : null
  const rangeBounds = useMemo(() => {
    if (!range || !selectedCell) return null
    const anchorRow = visiblePositionByRowId.get(range.anchor.rowId)
    const anchorColumn = columnPositionById.get(range.anchor.columnId)
    const focusRow = visiblePositionByRowId.get(range.focus.rowId) as number
    const focusColumn = columnPositionById.get(range.focus.columnId) as number
    const startRow = anchorRow ?? focusRow
    const startColumn = anchorColumn ?? focusColumn
    return {
      firstRow: Math.min(startRow, focusRow),
      lastRow: Math.max(startRow, focusRow),
      firstColumn: Math.min(startColumn, focusColumn),
      lastColumn: Math.max(startColumn, focusColumn),
    }
  }, [range, selectedCell, visiblePositionByRowId, columnPositionById])
  const selectedRowIds = rangeBounds ? visibleRowIds.slice(rangeBounds.firstRow, rangeBounds.lastRow + 1) : noIds
  const selectedColumnIds = rangeBounds ? columnIds.slice(rangeBounds.firstColumn, rangeBounds.lastColumn + 1) : noIds
  const selectedPositions = useMemo(
    () => selectedRowIds.flatMap((rowId) => selectedColumnIds.map((columnId) => ({ rowId, columnId }))),
    [selectedRowIds, selectedColumnIds],
  )

  // A formula keeps the original row and column numbers of the cells it uses, which never move; the visitor types and reads the
  // numbers that are on screen. These two convert between them.
  function formulaToTypedText(formula: string) {
    return translateFormulaRefs(
      formula,
      (rowNumber) => {
        const position = allRowPositionById.get(rowNumber - 1)
        return position === undefined ? null : position + 1
      },
      (columnNumber) => {
        const position = columnPositionById.get(columnNumber - 1)
        return position === undefined ? null : position + 1
      },
    ).text
  }

  function getEditText(rowId: number, columnId: number) {
    const text = sheet ? getCellEditText(sheet, rowId, columnId) : ''
    return text.startsWith('=') ? `=${formulaToTypedText(text.slice(1))}` : text
  }

  // Turns typed text into a cell. A typed formula is converted to original row and column numbers; it cannot use rows or columns
  // added here, which have no original number.
  function parseTypedCell(text: string, position: CellPosition) {
    if (!sheet) return { cell: null }
    if (!text.startsWith('=') || text.length < 2) return parseCellInput(text, readCell(sheet, position.rowId, position.columnId), locale)
    const { text: storedFormula, hasMissingReference } = translateFormulaRefs(
      text.slice(1),
      (rowNumber) => {
        const rowId = allRowIds[rowNumber - 1]
        return rowId === undefined || rowId < 0 ? null : rowId + 1
      },
      (columnNumber) => {
        const columnId = columnIds[columnNumber - 1]
        return columnId === undefined || columnId < 0 ? null : columnId + 1
      },
    )
    if (hasMissingReference) return { error: t('excel.msg.formulaOutsideSheet') }
    return parseCellInput(`=${storedFormula}`, readCell(sheet, position.rowId, position.columnId), locale)
  }

  function getText(rowId: number, columnId: number) {
    return sheet ? getCellText(sheet, rowId, columnId) : ''
  }

  // ------------------------------------------------------------ selection and moving

  function selectCell(position: CellPosition) {
    setRange({ anchor: position, focus: position })
  }

  function moveSelection(rowStep: number, columnStep: number, extendRange: boolean) {
    if (!selectedCell || !range) return
    const rowPosition = Math.max(0, Math.min((visiblePositionByRowId.get(selectedCell.rowId) as number) + rowStep, visibleRowIds.length - 1))
    const columnPosition = Math.max(0, Math.min((shownColumnPositionById.get(selectedCell.columnId) as number) + columnStep, shownColumnIds.length - 1))
    const newFocus = { rowId: visibleRowIds[rowPosition], columnId: shownColumnIds[columnPosition] }
    setRange({ anchor: extendRange ? range.anchor : newFocus, focus: newFocus })
    tableRef.current?.scrollToRow(rowPosition)
  }

  function selectRows(firstRowId: number, lastRowId: number) {
    if (columnIds.length === 0) return
    setRange({ anchor: { rowId: firstRowId, columnId: columnIds[0] }, focus: { rowId: lastRowId, columnId: columnIds[columnIds.length - 1] } })
  }

  function selectColumn(columnId: number) {
    if (visibleRowIds.length === 0) return
    setRange({ anchor: { rowId: visibleRowIds[0], columnId }, focus: { rowId: visibleRowIds[visibleRowIds.length - 1], columnId } })
  }

  // ------------------------------------------------------------ typing into cells

  // Returns false (and says why) when the cell refuses what was typed, so the box stays open for a fix.
  function commitCellText(position: CellPosition, newText: string) {
    if (!parsed || !sheet) return true
    if (newText === getEditText(position.rowId, position.columnId)) {
      setInputMessage('')
      return true
    }
    const result = parseTypedCell(newText, position)
    if ('error' in result) {
      setInputMessage(result.error)
      return false
    }
    setInputMessage('')
    session.update((currentEdits) => withCells(currentEdits, parsed, sheet.id, [[position, result.cell]]))
    return true
  }

  function beginEditing(position: CellPosition, source: EditingCell['source'], draft?: string) {
    if (!sheet) return
    editWasCancelledRef.current = false
    setInputMessage('')
    setEditingCell({ ...position, draft: draft ?? getEditText(position.rowId, position.columnId), source, startedByTyping: draft !== undefined })
  }

  function finishEditing(shouldCommit: boolean, moveAfter?: 'down' | 'right', keepOpenOnError = true) {
    if (!editingCell) return
    if (shouldCommit) {
      const wasAccepted = commitCellText(editingCell, editingCell.draft)
      if (!wasAccepted && keepOpenOnError) return
    } else {
      editWasCancelledRef.current = true
      setInputMessage('')
    }
    const wasRenamingHeader = editingCell.source === 'header'
    setEditingCell(null)
    tableRef.current?.focus()
    if (wasRenamingHeader) return
    if (moveAfter === 'down') moveSelection(1, 0, false)
    if (moveAfter === 'right') moveSelection(0, 1, false)
  }

  // ------------------------------------------------------------ changes to the selection

  function changeCells(newCells: [CellPosition, XLSX.CellObject | null][]) {
    if (!parsed || !sheet) return
    session.update((currentEdits) => withCells(currentEdits, parsed, sheet.id, newCells))
  }

  function clearSelectedCells() {
    changeCells(selectedPositions.map((position) => [position, null]))
  }

  // Fills the cells of the selection from its first row (down) or first column (right). Formulas are not copied: their
  // references would not move with the cell, which would give wrong results without warning.
  function fillSelection(direction: 'down' | 'right') {
    if (!sheet || !rangeBounds) return
    const filledCells: [CellPosition, XLSX.CellObject | null][] = []
    let skippedFormulaCount = 0
    for (const position of selectedPositions) {
      const sourcePosition = {
        rowId: direction === 'down' ? selectedRowIds[0] : position.rowId,
        columnId: direction === 'right' ? selectedColumnIds[0] : position.columnId,
      }
      if (sourcePosition.rowId === position.rowId && sourcePosition.columnId === position.columnId) continue
      const sourceCell = readCell(sheet, sourcePosition.rowId, sourcePosition.columnId)
      if (sourceCell?.f) skippedFormulaCount++
      else filledCells.push([position, sourceCell ?? null])
    }
    changeCells(filledCells)
    setInputMessage(skippedFormulaCount > 0 ? t('excel.msg.fillSkippedFormulas') : '')
  }

  // Styles are changed on every selected cell. Toggles follow the first selected cell: if it is bold, all become not bold.
  const canStyle = parsed !== null && parsed.bookType === 'xlsx' && parsed.styles !== null
  const stylesUnavailable =
    !parsed || canStyle ? null : parsed.bookType !== 'xlsx' ? 'notXlsx' : openedFile.file.size > MAX_STYLED_FILE_BYTES ? 'tooLarge' : haveStylesFailed ? 'unreadable' : 'loading'
  const focusStyle = sheet && selectedCell ? readStyle(sheet, selectedCell.rowId, selectedCell.columnId) : undefined

  function changeSelectionStyle(change: (style: CellStyle, position: CellPosition) => CellStyle, resetNumberFormat = false) {
    if (!parsed || !sheet || !canStyle) return
    session.update((currentEdits) => withCellStyle(currentEdits, parsed, sheet, selectedPositions, change, resetNumberFormat))
  }

  function setColor(property: 'text' | 'fill', hexColor: string | null) {
    const color = hexColor ? { argb: `FF${hexColor}` } : undefined
    if (property === 'text') changeSelectionStyle((style) => ({ ...style, font: { ...style.font, color } }))
    else changeSelectionStyle((style) => ({ ...style, fill: color ? { type: 'pattern', pattern: 'solid', fgColor: color } : undefined }))
  }

  // Merges the selected cells (they must be next to each other, so not while sorted or searched); on a merged cell it unmerges.
  function toggleMerge() {
    if (!sheet || !selectedCell) return
    const merge = findMergeAt(sheet, selectedCell)
    if (merge) {
      session.update((currentEdits) => withUnmergedCell(currentEdits, sheet, selectedCell))
      return
    }
    const firstRowPosition = allRowPositionById.get(selectedRowIds[0]) as number
    const rowsAreTogether = selectedRowIds.every((rowId, offset) => allRowPositionById.get(rowId) === firstRowPosition + offset)
    if (selectedRowIds.length * selectedColumnIds.length < 2) setInputMessage(t('excel.msg.mergeSelectTwo'))
    else if (!rowsAreTogether) setInputMessage(t('excel.msg.mergeClearSearchOrSort'))
    else {
      setInputMessage('')
      session.update((currentEdits) => withMergedCells(currentEdits, sheet, selectedRowIds, selectedColumnIds))
    }
  }

  // A link needs a scheme; a bare address such as example.com gets https://. The cell's text is the link text, or the address when empty.
  function setSelectedCellLink(address: string) {
    if (!parsed || !sheet || !selectedCell) return
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(address)
    const fullAddress = address === '' || hasScheme ? address : `https://${address}`
    const cell = readCell(sheet, selectedCell.rowId, selectedCell.columnId)
    session.update((currentEdits) => {
      const withText = !cell || cell.t === 'z' ? withCells(currentEdits, parsed, sheet.id, [[selectedCell, fullAddress === '' ? null : { t: 's', v: fullAddress }]]) : currentEdits
      const sheetWithText = getSheetView(parsed, withText, sheet.id, null)
      return withLink(withText, parsed, sheetWithText, selectedCell, fullAddress)
    })
  }

  function applyNumberFormat(format: string) {
    if (!parsed || !sheet) return
    session.update((currentEdits) => withNumberFormat(currentEdits, parsed, sheet, selectedPositions, format))
  }

  function insertLines(kind: 'row' | 'column', side: 'before' | 'after') {
    if (!parsed || !sheet) return
    const isRow = kind === 'row'
    const shownIds = isRow ? allRowIds : columnIds
    const selectedIds = isRow ? selectedRowIds : selectedColumnIds
    const count = Math.max(1, selectedIds.length)
    const firstSelectedPosition = selectedIds.length > 0 ? shownIds.indexOf(selectedIds[0]) : shownIds.length
    const lastSelectedPosition = selectedIds.length > 0 ? shownIds.indexOf(selectedIds[selectedIds.length - 1]) : shownIds.length - 1
    const position = side === 'before' ? firstSelectedPosition : lastSelectedPosition + 1
    const firstNewId = isRow ? (sheet.edits?.nextRowId ?? -1) : (sheet.edits?.nextColumnId ?? -1)
    // The new line is selected once it is drawn.
    pendingRevealRef.current = {
      rowId: isRow ? firstNewId : (selectedCell?.rowId ?? visibleRowIds[0] ?? firstNewId),
      columnId: isRow ? (selectedCell?.columnId ?? columnIds[0] ?? firstNewId) : firstNewId,
    }
    session.update((currentEdits) => withInsertedLines(currentEdits, sheet, kind, position, count))
  }

  // Adds one column next to the column whose menu was used and selects it once it is drawn.
  function insertColumnNextTo(columnId: number, side: 'before' | 'after') {
    if (!parsed || !sheet) return
    const columnPosition = columnIds.indexOf(columnId)
    const firstNewId = sheet.edits?.nextColumnId ?? -1
    pendingRevealRef.current = { rowId: visibleRowIds[0] ?? firstNewId, columnId: firstNewId }
    session.update((currentEdits) => withInsertedLines(currentEdits, sheet, 'column', side === 'before' ? columnPosition : columnPosition + 1, 1))
  }

  function deleteSelectedLines(kind: 'row' | 'column') {
    if (!sheet) return
    session.update((currentEdits) => withDeletedLines(currentEdits, sheet, kind, new Set(kind === 'row' ? selectedRowIds : selectedColumnIds)))
  }

  function clearSelectedLines(kind: 'row' | 'column') {
    const clearedRowIds = kind === 'row' ? selectedRowIds : visibleRowIds
    const clearedColumnIds = kind === 'row' ? columnIds : selectedColumnIds
    changeCells(clearedRowIds.flatMap((rowId) => clearedColumnIds.map((columnId): [CellPosition, null] => [{ rowId, columnId }, null])))
  }

  // ------------------------------------------------------------ clipboard

  function copySelection(event: ClipboardEvent<HTMLDivElement>) {
    if (!rangeBounds || editingCell || event.target instanceof HTMLInputElement) return
    const tabSeparatedRows = selectedRowIds.map((rowId) => selectedColumnIds.map((columnId) => getText(rowId, columnId)).join('\t')).join('\n')
    event.clipboardData.setData('text/plain', tabSeparatedRows)
    event.preventDefault()
  }

  function cutSelection(event: ClipboardEvent<HTMLDivElement>) {
    if (!isEditable || editingCell || event.target instanceof HTMLInputElement) return
    copySelection(event)
    clearSelectedCells()
  }

  // Pastes tab-separated text (as copied from Excel or Google Sheets) from the selected cell on, typing each value into its
  // cell. One value pasted onto a bigger selection fills all of it. What falls outside the sheet is skipped, and said so.
  function pasteIntoSelection(event: ClipboardEvent<HTMLDivElement>) {
    if (!isEditable || editingCell || !sheet || !rangeBounds || event.target instanceof HTMLInputElement) return
    event.preventDefault()
    const pastedText = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n').replace(/\n$/, '')
    if (pastedText === '') return
    const pastedRows = pastedText.split('\n').map((line) => line.split('\t'))
    const isSingleValue = pastedRows.length === 1 && pastedRows[0].length === 1
    const pastedCells: [CellPosition, XLSX.CellObject | null][] = []
    let skippedCount = 0
    function addPastedCell(rowPosition: number, columnPosition: number, text: string) {
      if (rowPosition >= visibleRowIds.length || columnPosition >= columnIds.length) {
        skippedCount++
        return
      }
      const position = { rowId: visibleRowIds[rowPosition], columnId: columnIds[columnPosition] }
      const result = parseTypedCell(text, position)
      if ('error' in result) skippedCount++
      else pastedCells.push([position, result.cell])
    }
    if (isSingleValue) {
      for (let rowPosition = rangeBounds.firstRow; rowPosition <= rangeBounds.lastRow; rowPosition++) {
        for (let columnPosition = rangeBounds.firstColumn; columnPosition <= rangeBounds.lastColumn; columnPosition++) addPastedCell(rowPosition, columnPosition, pastedRows[0][0])
      }
    } else if (pastedRows.length * Math.max(...pastedRows.map((pastedRow) => pastedRow.length)) <= MAX_CLIPBOARD_CELLS) {
      pastedRows.forEach((pastedRow, rowOffset) =>
        pastedRow.forEach((text, columnOffset) => addPastedCell(rangeBounds.firstRow + rowOffset, rangeBounds.firstColumn + columnOffset, text)),
      )
    } else {
      setInputMessage(t('excel.msg.pasteTooMuch'))
      return
    }
    changeCells(pastedCells)
    setInputMessage(skippedCount > 0 ? tp('excel.msg.pasteSkipped', skippedCount) : '')
  }

  // ------------------------------------------------------------ keyboard

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys typed inside a text box belong to that box, never to the grid.
    const isTypingInATextBox = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    if (isTypingInATextBox || editingCell || !selectedCell) return
    const hasShortcutModifier = event.ctrlKey || event.metaKey || event.altKey
    const isPrintableKey = event.key.length === 1 && event.key !== '/' && !hasShortcutModifier

    if (event.key === 'ArrowDown') moveSelection(1, 0, event.shiftKey)
    else if (event.key === 'ArrowUp') moveSelection(-1, 0, event.shiftKey)
    else if (event.key === 'ArrowLeft') moveSelection(0, -1, event.shiftKey)
    else if (event.key === 'ArrowRight') moveSelection(0, 1, event.shiftKey)
    else if (event.key === 'Tab') moveSelection(0, event.shiftKey ? -1 : 1, false)
    else if (isEditable && (event.key === 'Enter' || event.key === 'F2')) beginEditing(selectedCell, 'cell')
    else if (isEditable && (event.key === 'Delete' || event.key === 'Backspace')) clearSelectedCells()
    else if (isEditable && isPrintableKey) beginEditing(selectedCell, 'cell', event.key)
    else return
    event.preventDefault()
  }

  // ------------------------------------------------------------ sheets, find and replace

  function selectSheet(sheetId: number) {
    setPickedSheetId(sheetId)
    setSortState(null)
    setRange(null)
    setEditingCell(null)
    setInputMessage('')
    setColumnMenu(null)
    setColumnFilters([])
    setFilterRowDrafts(new Map())
  }

  // Shows a cell anywhere in the workbook (from the formula list, search, compare or a link): its sheet, with the search and filters
  // cleared and hidden rows and columns shown when it is in one, then selects it once it is drawn.
  function goToCell(sheetId: number, rowId: number, columnId: number) {
    const original = sheetId >= 0 ? parsed?.sheets[sheetId] : undefined
    if (original && original.visibility !== 'visible') setRevealedSheetIds((sheetIds) => new Set(sheetIds).add(sheetId))
    if (original?.worksheet['!rows']?.[rowId]?.hidden || original?.worksheet['!cols']?.[columnId]?.hidden) setShowHidden(true)
    if (sheetId !== activeSheetId) selectSheet(sheetId)
    setSearchText('')
    clearColumnFilters()
    pendingRevealRef.current = { rowId, columnId }
    setRevealRequestCount((count) => count + 1)
  }

  // A link opens with Ctrl+click (⌘+click on a Mac), as in Excel; a plain click selects the cell. A link to a place in the workbook
  // ("Sheet2!B4") goes there; only web and e-mail links open, in a new tab that cannot reach back to this page.
  function openCellLink(link: XLSX.Hyperlink) {
    const location = (link as XLSX.Hyperlink & { location?: string }).location
    const target = location ?? link.Target
    if (location || target.startsWith('#')) {
      const reference = target.replace(/^#/, '')
      const separatorPosition = reference.lastIndexOf('!')
      const sheetName = separatorPosition > 0 ? reference.slice(0, separatorPosition).replace(/^'(.*)'$/, '$1').replaceAll("''", "'") : activeSheetName
      const record = sheetRecords.find((sheetRecord) => sheetRecord.name.toLowerCase() === sheetName.toLowerCase())
      const targetCell = record && parsed ? findCellByAddress(getSheetView(parsed, edits, record.id), reference.slice(separatorPosition + 1).split(':')[0]) : null
      if (!record || !targetCell) setInputMessage(t('excel.msg.linkTargetMissing'))
      else goToCell(record.id, targetCell.rowId, targetCell.columnId)
      return
    }
    if (isSafeLink(target)) window.open(target, '_blank', 'noopener,noreferrer')
    else setInputMessage(t('excel.msg.linkBlocked'))
  }

  // ------------------------------------------------------------ column filters and profile

  function setColumnFilter(columnId: number, filter: ColumnFilter | null) {
    setColumnFilters((currentFilters) => {
      const otherFilters = currentFilters.filter((existing) => existing.columnId !== columnId)
      return filter ? [...otherFilters, filter] : otherFilters
    })
  }

  // A filter set from the profile replaces what was typed in that column's filter box.
  function setColumnFilterFromProfile(columnId: number, filter: ColumnFilter) {
    setColumnFilter(columnId, filter)
    setFilterRowDrafts((drafts) => {
      const remainingDrafts = new Map(drafts)
      remainingDrafts.delete(columnId)
      return remainingDrafts
    })
    setIsFilterRowShown(true)
  }

  function clearColumnFilters() {
    setColumnFilters([])
    setFilterRowDrafts(new Map())
  }

  // The filter row: a box's text becomes that column's filter at once ("north", ">=100", "10..20", "2026-01-01..", "=Done", "empty").
  const filterRow = {
    getText: (columnId: number) => {
      const draft = filterRowDrafts.get(columnId)
      if (draft !== undefined) return draft
      const filter = columnFilters.find((existing) => existing.columnId === columnId)
      return filter ? (formatFilterRowText(filter) ?? '') : ''
    },
    onChange: (columnId: number, text: string) => {
      setFilterRowDrafts((drafts) => new Map(drafts).set(columnId, text))
      setColumnFilter(columnId, parseFilterRowText(text, columnId))
    },
    onBlur: (columnId: number) =>
      setFilterRowDrafts((drafts) => {
        const remainingDrafts = new Map(drafts)
        remainingDrafts.delete(columnId)
        return remainingDrafts
      }),
  }

  // The profile describes the selected cell's column over the data rows on screen (frozen title and total rows left out).
  const deferredSheet = useDeferredValue(sheet)
  const profileColumnId = panelTab === 'profile' ? (selectedCell?.columnId ?? null) : null
  const deferredVisibleRowIds = useDeferredValue(visibleRowIds)
  const columnProfile = useMemo(() => {
    if (profileColumnId === null || !deferredSheet) return null
    const dataRowIds = frozenRowCount > 0 ? deferredVisibleRowIds.filter((rowId) => (allRowPositionById.get(rowId) ?? Infinity) >= frozenRowCount) : deferredVisibleRowIds
    const readValue = (rowId: number) => getCellValueText(deferredSheet, rowId, profileColumnId)
    const columnInfo = detectColumnInfo(readValue, dataRowIds)
    const texts = dataRowIds.map(readValue)
    return { ...columnInfo, texts, profile: buildColumnProfile(texts, columnInfo.type) }
  }, [profileColumnId, deferredVisibleRowIds, deferredSheet, frozenRowCount, allRowPositionById])

  // A click on a profile value shows only its rows, and opens the filter row so the filter can be seen and cleared.
  function filterColumnToValue(columnId: number, value: string) {
    const number = columnProfile?.type === 'number' ? parseNumber(value) : null
    setColumnFilterFromProfile(columnId, number !== null ? { columnId, kind: 'range', min: number, max: number } : { columnId, kind: 'equals', value })
  }

  function addSheet(name: string) {
    if (!parsed) return
    const { edits: editsWithSheet, newSheetId } = withAddedSheet(edits, sheetRecords, name)
    session.update(() => editsWithSheet)
    selectSheet(newSheetId)
  }

  function renameActiveSheet(name: string) {
    if (activeSheetId === null) return
    session.update((currentEdits) => withRenamedSheet(currentEdits, sheetRecords, activeSheetId, name))
  }

  function deleteActiveSheet() {
    if (activeSheetId === null) return
    const remainingSheets = sheetRecords.filter((sheetRecord) => sheetRecord.id !== activeSheetId)
    session.update((currentEdits) => withDeletedSheet(currentEdits, sheetRecords, activeSheetId))
    selectSheet(remainingSheets[0].id)
  }

  function setActiveColumnWidth(columnId: number, widthPx: number) {
    if (activeSheetId === null) return
    session.update((currentEdits) => withColumnWidth(currentEdits, activeSheetId, columnId, widthPx))
  }

  function cycleSort(columnId: number) {
    setSortState((currentSort) => {
      if (currentSort?.columnId !== columnId) return { columnId, direction: 'asc' }
      return currentSort.direction === 'asc' ? { columnId, direction: 'desc' } : null
    })
  }

  // Find and replace works on every shown cell of the active sheet; a live count and next / previous move the selection.
  const matchingCells = useMemo(
    () => (isFindOpen && deferredSheet ? findMatchingCells(deferredSheet, deferredFindText, matchCase) : []),
    [isFindOpen, deferredSheet, deferredFindText, matchCase],
  )

  function goToMatch(newPosition: number) {
    if (matchingCells.length === 0) return
    const wrappedPosition = (newPosition + matchingCells.length) % matchingCells.length
    const match = matchingCells[wrappedPosition]
    setMatchPosition(wrappedPosition)
    const rowPosition = visiblePositionByRowId.get(match.rowId)
    if (rowPosition === undefined) return
    selectCell(match)
    tableRef.current?.scrollToRow(rowPosition)
  }

  function replaceCurrentMatch() {
    if (!parsed || !sheet || matchingCells.length === 0) return
    const match = matchingCells[Math.min(matchPosition, matchingCells.length - 1)]
    const { edits: replacedEdits, replacedCount } = withReplacedText(edits, parsed, sheet, [match], findText, replaceText, matchCase)
    session.update(() => replacedEdits)
    setReplaceResultMessage(replacedCount === 0 ? t('excel.msg.replaceFailed') : t('excel.msg.replacedOne'))
  }

  function replaceAllMatches() {
    if (!parsed || !sheet) return
    const { edits: replacedEdits, replacedCount, skippedCount } = withReplacedText(edits, parsed, sheet, matchingCells, findText, replaceText, matchCase)
    session.update(() => replacedEdits)
    const skippedNote = skippedCount > 0 ? t('excel.msg.replacedSkipped', { count: skippedCount }) : ''
    setReplaceResultMessage(`${tp('excel.msg.replacedCells', replacedCount)}${skippedNote}`)
  }

  // ------------------------------------------------------------ what the page's toolbar can ask of this viewer

  // The toolbar's menus are drawn by the page, outside this viewer; they reach the latest actions through this stable object.
  const latestActionsRef = useRef<{ toggleFindReplace: () => void; actions: ExcelActions | null }>({ toggleFindReplace: () => {}, actions: null })
  const viewerCommands = useMemo<ExcelViewerCommands>(
    () => ({
      toggleFindReplace: () => latestActionsRef.current.toggleFindReplace(),
      getActions: () => latestActionsRef.current.actions as ExcelActions,
    }),
    [],
  )
  useEffect(() => {
    onCommandsChange(viewerCommands)
  }, [onCommandsChange, viewerCommands])

  useEffect(() => {
    const reveal = pendingRevealRef.current
    if (!reveal) return
    const rowPosition = visiblePositionByRowId.get(reveal.rowId)
    if (rowPosition === undefined || !shownColumnPositionById.has(reveal.columnId)) return
    pendingRevealRef.current = null
    // A line was just added or a cell was chosen in a panel; selecting it once it is on screen is the point of this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    setRange({ anchor: reveal, focus: reveal })
    tableRef.current?.scrollToRow(rowPosition)
    requestAnimationFrame(() => document.getElementById(`cell-${reveal.rowId}-${reveal.columnId}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  }, [visiblePositionByRowId, shownColumnPositionById, revealRequestCount])

  useEffect(() => {
    if (!parsed || !sheet) {
      onSelectionChange(null)
      return
    }
    const selection: ExcelSelection = {
      activeSheetId: sheet.id,
      activeSheetName,
      sheetCount: sheetRecords.length,
      hasCell: selectedCell !== null,
      hasHeaderRow,
      selectedRowCount: selectedRowIds.length,
      selectedColumnCount: selectedColumnIds.length,
      canDeleteSheet: sheetRecords.length > 1,
      canStyle,
      stylesUnavailable,
      isBold: focusStyle?.font?.bold === true,
      isItalic: focusStyle?.font?.italic === true,
      isUnderlined: !!focusStyle?.font?.underline,
      isStruckThrough: focusStyle?.font?.strike === true,
      alignment: focusStyle?.alignment?.horizontal,
      isMerged: sheet && selectedCell ? findMergeAt(sheet, selectedCell) !== undefined : false,
      showFormulas,
      showHidden,
      isFilterRowShown,
      panelTab,
    }
    onSelectionChange(selection)
  }, [parsed, sheet, activeSheetName, sheetRecords.length, selectedCell, hasHeaderRow, selectedRowIds.length, selectedColumnIds.length, canStyle, stylesUnavailable, focusStyle, showFormulas, showHidden, isFilterRowShown, panelTab, onSelectionChange])

  useEffect(() => {
    onExportSourceChange(parsed ? ({ parsed } satisfies ExcelExportSource) : null)
  }, [parsed, onExportSourceChange])

  // ------------------------------------------------------------ drawing

  const isSearching = deferredSearchText.trim() !== ''
  const isSheetEmpty = allRowIds.length === 0 || columnIds.length === 0
  const largeFileWarning = getLargeFileWarning(openedFile.file, locale)
  const isMacroFile = openedFile.file.name.toLowerCase().endsWith('.xlsm')
  const saveNote = [t('excel.view.saveNoteBase'), canStyle ? t('excel.view.saveNoteStyles') : t('excel.view.saveNoteNoStyles'), isMacroFile && t('excel.view.saveNoteMacros')].filter(Boolean).join(' ')
  const selectedCellLabel = selectedCell
    ? `${columnLabel(columnPositionById.get(selectedCell.columnId) as number)}${(allRowPositionById.get(selectedCell.rowId) ?? 0) + 1}`
    : '–'
  const selectedCellText = selectedCell ? getEditText(selectedCell.rowId, selectedCell.columnId) : ''
  const selectedCellLink = sheet && selectedCell ? readCell(sheet, selectedCell.rowId, selectedCell.columnId)?.l : undefined
  const selectedCellLinkTarget = selectedCellLink ? ((selectedCellLink as XLSX.Hyperlink & { location?: string }).location ?? selectedCellLink.Target) : ''
  const isSelectedLinkInWorkbook = selectedCellLinkTarget.startsWith('#') || Boolean((selectedCellLink as { location?: string } | undefined)?.location)
  const selectedCellNote = sheet && selectedCell ? getCellNote(sheet, selectedCell.rowId, selectedCell.columnId) : null
  const isFiltered = columnFilters.length > 0
  // Hidden sheets have no tab until the visitor asks to see one (or goes to a cell in it).
  const hiddenSheetRecords = sheetRecords.filter((sheetRecord) => isHiddenSheet(sheetRecord.id) && !revealedSheetIds.has(sheetRecord.id) && sheetRecord.id !== activeSheetId)
  const tabSheetRecords = sheetRecords.filter((sheetRecord) => !hiddenSheetRecords.includes(sheetRecord))
  const hiddenSheetCount = parsed ? parsed.sheets.filter((originalSheet) => originalSheet.visibility !== 'visible').length : 0
  const workbookNotice = parsed
    ? [
        hiddenSheetCount > 0 && tp('excel.msg.hiddenSheets', hiddenSheetCount),
        parsed.info.hasMacros && t('excel.msg.hasMacros'),
        parsed.info.externalLinks.length > 0 && tp('excel.msg.externalLinks', parsed.info.externalLinks.length),
      ]
        .filter(Boolean)
        .join(' ')
    : ''
  const profileRangeFilter = columnFilters.find((filter) => filter.columnId === profileColumnId && filter.kind === 'range')
  const readOtherWorkbook = async (file: File) => readWorkbookInWorker(await file.arrayBuffer(), file.name, locale)

  // The sheet as it is on screen, for printing: the column names, then the shown rows.
  function readShownTable() {
    const readShownText = (rowId: number, columnId: number) => (showFormulas && sheet && readCell(sheet, rowId, columnId)?.f ? getEditText(rowId, columnId) : getText(rowId, columnId))
    return [shownColumnNames, ...visibleRowIds.map((rowId) => shownColumnIds.map((columnId) => readShownText(rowId, columnId)))]
  }

  const panelTitle =
    panelTab === 'profile'
      ? selectedCell
        ? (shownColumnNames[shownColumnPositionById.get(selectedCell.columnId) ?? 0] ?? '')
        : t('excel.panel.profile')
      : panelTab
        ? t(({ formulas: 'excel.panel.formulas', search: 'excel.panel.search', compare: 'excel.panel.compare' } as const)[panelTab])
        : ''
  const panelSubtitle = panelTab === 'profile' && columnProfile ? `${t(COLUMN_TYPE_LABEL_KEYS[columnProfile.type])} · ${tp('csv.wb.shownRows', columnProfile.texts.length)}` : panelTab === 'search' || panelTab === 'formulas' ? t('excel.panel.allSheets') : ''

  const actions: ExcelActions = {
    insertRows: (side) => insertLines('row', side === 'above' ? 'before' : 'after'),
    deleteRows: () => deleteSelectedLines('row'),
    clearRows: () => clearSelectedLines('row'),
    insertColumns: (side) => insertLines('column', side === 'left' ? 'before' : 'after'),
    deleteColumns: () => deleteSelectedLines('column'),
    clearColumns: () => clearSelectedLines('column'),
    clearCells: clearSelectedCells,
    fillDown: () => fillSelection('down'),
    fillRight: () => fillSelection('right'),
    setNumberFormat: applyNumberFormat,
    toggleBold: () => changeSelectionStyle((style) => ({ ...style, font: { ...style.font, bold: !focusStyle?.font?.bold } })),
    toggleItalic: () => changeSelectionStyle((style) => ({ ...style, font: { ...style.font, italic: !focusStyle?.font?.italic } })),
    setBorders: (kind) => {
      if (!rangeBounds) return
      const thinBlack = { style: 'thin' as const, color: { argb: 'FF000000' } }
      const lastRow = selectedRowIds.length - 1
      const lastColumn = selectedColumnIds.length - 1
      changeSelectionStyle((style, position) => {
        if (kind === 'none') return { ...style, border: undefined }
        const rowOffset = selectedRowIds.indexOf(position.rowId)
        const columnOffset = selectedColumnIds.indexOf(position.columnId)
        const isOuterTop = rowOffset === 0
        const isOuterBottom = rowOffset === lastRow
        const isOuterLeft = columnOffset === 0
        const isOuterRight = columnOffset === lastColumn
        const wantsTop = kind === 'all' || ((kind === 'outer' || kind === 'top') && isOuterTop)
        const wantsBottom = kind === 'all' || ((kind === 'outer' || kind === 'bottom') && isOuterBottom)
        const wantsLeft = kind === 'all' || ((kind === 'outer' || kind === 'left') && isOuterLeft)
        const wantsRight = kind === 'all' || ((kind === 'outer' || kind === 'right') && isOuterRight)
        return {
          ...style,
          border: {
            ...style.border,
            ...(wantsTop ? { top: thinBlack } : {}),
            ...(wantsBottom ? { bottom: thinBlack } : {}),
            ...(wantsLeft ? { left: thinBlack } : {}),
            ...(wantsRight ? { right: thinBlack } : {}),
          },
        }
      })
    },
    setFontFamily: (fontName) => changeSelectionStyle((style) => ({ ...style, font: { ...style.font, name: fontName } })),
    setFontSize: (fontSize) => changeSelectionStyle((style) => ({ ...style, font: { ...style.font, size: fontSize } })),
    changeIndent: (delta) =>
      changeSelectionStyle((style) => ({
        ...style,
        alignment: { ...style.alignment, horizontal: style.alignment?.horizontal === 'center' || style.alignment?.horizontal === 'right' ? style.alignment.horizontal : 'left', indent: Math.max(0, Math.min(10, (style.alignment?.indent ?? 0) + delta)) },
      })),
    transformText: (kind) => {
      if (!parsed || !sheet) return
      const transforms = {
        upper: (text: string) => text.toLocaleUpperCase(),
        lower: (text: string) => text.toLocaleLowerCase(),
        capitalize: (text: string) => text.toLocaleLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toLocaleUpperCase()),
        trim: (text: string) => text.trim().replace(/\s+/g, ' '),
      }
      session.update((currentEdits) => withTransformedText(currentEdits, parsed, sheet, selectedPositions, transforms[kind]))
    },
    moveSheet: (delta) => {
      if (activeSheetId !== null) session.update((currentEdits) => withMovedSheet(currentEdits, sheetRecords, activeSheetId, delta))
    },
    openLink: () => selectedCell && setDialog({ kind: 'link' }),
    toggleUnderline: () => changeSelectionStyle((style) => ({ ...style, font: { ...style.font, underline: !focusStyle?.font?.underline } })),
    toggleStrikethrough: () => changeSelectionStyle((style) => ({ ...style, font: { ...style.font, strike: !focusStyle?.font?.strike } })),
    clearFormatting: () => changeSelectionStyle(() => ({}), true),
    changeDecimals: (delta) => {
      if (!parsed || !sheet) return
      session.update((currentEdits) => withNumberFormat(currentEdits, parsed, sheet, selectedPositions, (currentFormat, cell) => {
        // A General number shows all its digits, so one more or fewer is counted from those.
        if (currentFormat === 'General' && typeof cell.v === 'number') {
          const shownDecimals = Math.min(10, cell.v.toString().split('.')[1]?.length ?? 0)
          return shownDecimals + delta < 0 ? 'General' : `0${shownDecimals + delta > 0 ? `.${'0'.repeat(shownDecimals + delta)}` : ''}`
        }
        return changeDecimalPlaces(currentFormat, delta)
      }))
    },
    setTextColor: (hexColor) => setColor('text', hexColor),
    setFillColor: (hexColor) => setColor('fill', hexColor),
    setAlignment: (newAlignment) => changeSelectionStyle((style) => ({ ...style, alignment: { ...style.alignment, horizontal: newAlignment } })),
    toggleMerge,
    openColumnWidth: () => selectedCell && setDialog({ kind: 'column-width', columnId: selectedCell.columnId }),
    openAddSheet: () => setDialog({ kind: 'add-sheet' }),
    openRenameSheet: () => setDialog({ kind: 'rename-sheet' }),
    openDeleteSheet: () => setDialog({ kind: 'delete-sheet' }),
    toggleShowFormulas: () => setShowFormulas((isShown) => !isShown),
    toggleShowHidden: () => setShowHidden((isShown) => !isShown),
    toggleFilterRow: () => setIsFilterRowShown((isShown) => !isShown),
    clearFilters: clearColumnFilters,
    openPanel: (tab) => setPanelTab(tab),
    openWorkbookDialog: (kind) => setWorkbookDialog(kind),
  }
  useEffect(() => {
    latestActionsRef.current = { toggleFindReplace: () => setIsFindOpen((wasOpen) => !wasOpen), actions }
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[13px]">
      {parsed && (
        <div id="value-bar">
          {isEditable && (
            <editing.EditBar
              selectedCellLabel={selectedCellLabel}
              isDisabled={!selectedCell}
              value={editingCell ? editingCell.draft : selectedCellText}
              onChange={(newValue) => {
                if (!selectedCell) return
                if (editingCell) setEditingCell({ ...editingCell, draft: newValue })
                else beginEditing(selectedCell, 'bar', newValue)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && editingCell) {
                  event.preventDefault()
                  finishEditing(true, 'down')
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  if (editingCell) finishEditing(false)
                  else tableRef.current?.focus()
                }
              }}
              onBlur={() => {
                if (editWasCancelledRef.current) {
                  editWasCancelledRef.current = false
                  return
                }
                if (editingCell?.source === 'bar') finishEditing(true, undefined, false)
              }}
            />
          )}

          <label className="relative shrink-0">
            <span className="sr-only">{t('excel.view.searchRows')}</span>
            <SearchIcon />
            <input
              id="search-input"
              ref={searchInputRef}
              type="search"
              dir="auto"
              placeholder={t('excel.view.searchRows')}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className={`${textControlClassName} w-48 ps-9 pe-10`}
            />
            {searchText === '' && (
              <kbd aria-hidden="true" className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-rule px-1.5 text-xs text-ink-soft">
                /
              </kbd>
            )}
          </label>

        </div>
      )}

      {isEditable && isFindOpen && (
        <editing.FindReplaceBar
          findText={findText}
          replaceText={replaceText}
          matchCase={matchCase}
          matchCount={matchingCells.length}
          matchPosition={matchPosition}
          resultMessage={replaceResultMessage}
          onFindChange={(newText) => {
            setFindText(newText)
            setMatchPosition(0)
            setReplaceResultMessage('')
          }}
          onReplaceChange={(newText) => {
            setReplaceText(newText)
            setReplaceResultMessage('')
          }}
          onMatchCaseChange={(newValue) => {
            setMatchCase(newValue)
            setMatchPosition(0)
            setReplaceResultMessage('')
          }}
          onPrevious={() => goToMatch(matchPosition - 1)}
          onNext={() => goToMatch(matchPosition + 1)}
          onReplace={replaceCurrentMatch}
          onReplaceAll={replaceAllMatches}
          onClose={() => setIsFindOpen(false)}
        />
      )}

      <Notice
        id="input-message"
        kind="error"
        role="alert"
        className="border-b border-rule bg-paper-raised px-4 py-2 text-sm text-danger"
        message={isEditable ? inputMessage : ''}
      />

      <Notice
        id="large-file-warning"
        kind="warning"
        role="status"
        className="border-b border-rule bg-paper-raised px-4 py-1 text-sm"
        message={parsed && largeFileWarning ? largeFileWarning : ''}
      />

      <Notice
        id="legacy-format-note"
        kind="info"
        role="status"
        className="border-b border-rule bg-paper-raised px-4 py-1 text-sm"
        message={parsed?.bookType === 'biff8' ? t('excel.legacyNote') : ''}
      />

      <Notice id="workbook-notice" kind="info" role="status" className="border-b border-rule bg-paper-raised px-4 py-1 text-sm" message={workbookNotice} />

      {(selectedCellLink || selectedCellNote) && (
        <div id="cell-details-bar" className="cell-details-bar">
          {selectedCellLink &&
            (isSelectedLinkInWorkbook ? (
              <button type="button" id="selected-cell-link" className="link" onClick={() => openCellLink(selectedCellLink)}>
                {t('excel.link.goTo', { place: isolateText(selectedCellLinkTarget.replace(/^#/, '')) })}
              </button>
            ) : (
              <span className="cell-details-item">
                <span className="cell-details-label">{t('excel.link.label')}</span>
                {isSafeLink(selectedCellLinkTarget) ? (
                  <a id="selected-cell-link" href={selectedCellLinkTarget} target="_blank" rel="noopener noreferrer" dir="ltr">
                    {selectedCellLinkTarget}
                  </a>
                ) : (
                  <span id="selected-cell-link" dir="ltr" title={t('excel.msg.linkBlocked')}>
                    {selectedCellLinkTarget}
                  </span>
                )}
                <span className="cell-details-hint">{t('excel.link.hint', { key: IS_MAC ? '⌘' : 'Ctrl' })}</span>
              </span>
            ))}
          {selectedCellNote && (
            <span className="cell-details-item" id="selected-cell-note">
              <span className="cell-details-label">{t('excel.note.label')}</span>
              <span dir="auto">{selectedCellNote}</span>
            </span>
          )}
        </div>
      )}

      <div id="excel-studio" className="flex min-h-0 flex-1">
      <main id="main" className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper-raised">
        {parseResult === null && <p className="p-6 text-ink-soft">{t('excel.view.reading')}</p>}

        {parseResult?.status === 'error' && (
          <FatalFileError
            title={parseResult.isPasswordProtected ? t('excel.view.protectedTitle') : t('excel.view.errorTitle')}
            reason={parseResult.message}
            hint={t('excel.view.errorHint')}
            onOpenAnotherFile={onOpenAnotherFile}
          />
        )}

        {parsed && sheet && isSheetEmpty && (
          <p className="p-6 text-ink-soft">{isEditable ? t('excel.view.sheetEmptyEditable') : t('excel.view.sheetEmpty')}</p>
        )}

        {parsed && sheet && !isSheetEmpty && (
          <div dir="ltr" className="flex min-h-0 flex-1 flex-col" onCopy={copySelection} onCut={cutSelection} onPaste={pasteIntoSelection}>
            <DataTable
              tableRef={tableRef}
              label={activeSheetName}
              columnIds={shownColumnIds}
              columnNames={shownColumnNames}
              columnWidthsPx={shownColumnWidthsPx}
              rowNumberWidthPx={rowNumberColumnWidthPx}
              rowIds={visibleRowIds}
              getCellText={(rowId, columnId) => {
                if (editingCell?.source === 'bar' && editingCell.rowId === rowId && editingCell.columnId === columnId) return editingCell.draft
                return showFormulas && readCell(sheet, rowId, columnId)?.f ? getEditText(rowId, columnId) : getText(rowId, columnId)
              }}
              pinnedRowCount={pinnedRowCount}
              frozenColumnCount={frozenColumnCount}
              getColumnLetter={(columnId) => columnLabel(columnPositionById.get(columnId) ?? 0)}
              isHiddenLine={showHidden ? (kind, id) => (kind === 'row' ? hiddenRowIds : hiddenColumnIds).has(id) : undefined}
              hasHiddenLineBefore={
                showHidden
                  ? undefined
                  : (kind, id) => {
                      const position = kind === 'row' ? allRowPositionById.get(id) : columnPositionById.get(id)
                      if (!position) return false
                      return kind === 'row' ? hiddenRowIds.has(allRowIds[position - 1]) : hiddenColumnIds.has(columnIds[position - 1])
                    }
              }
              getCellNote={(rowId, columnId) => getCellNote(sheet, rowId, columnId)}
              filterRow={isFilterRowShown ? filterRow : null}
              getOriginalText={(rowId, columnId) => getOriginalCellText(sheet, rowId, columnId)}
              dataKey={sheetDataKey}
              isCellEdited={(rowId, columnId) => rowId < 0 || columnId < 0 || (sheet.edits?.cells.has(cellKey(rowId, columnId)) ?? false)}
              getCellSpan={(rowId, columnId) => mergeSpanByAnchorKey.get(cellKey(rowId, columnId)) ?? null}
              getCellStyle={(rowId, columnId) => {
                const css = cssForStyle(readStyle(sheet, rowId, columnId))
                // A cell with a link looks like a link unless it was given its own colour; a cell that differs in Compare is tinted.
                const linkedCss = readCell(sheet, rowId, columnId)?.l?.Target ? { color: '#0563c1', textDecoration: 'underline', ...css } : css
                return comparedCellKeys.has(cellKey(rowId, columnId)) ? { ...linkedCss, backgroundColor: 'color-mix(in srgb, #f5a623 32%, var(--paper-raised))' } : linkedCss
              }}
              getRowLabel={(rowId) => String((allRowPositionById.get(rowId) ?? 0) + 1)}
              isFindMatch={isEditable && isFindOpen && deferredFindText !== '' ? (cellText) => textMatches(cellText, deferredFindText, matchCase) : undefined}
              isCellInSelection={(rowId, columnId) => {
                if (!rangeBounds || (rangeBounds.firstRow === rangeBounds.lastRow && rangeBounds.firstColumn === rangeBounds.lastColumn)) return false
                const rowPosition = visiblePositionByRowId.get(rowId) as number
                const columnPosition = columnPositionById.get(columnId) as number
                return rowPosition >= rangeBounds.firstRow && rowPosition <= rangeBounds.lastRow && columnPosition >= rangeBounds.firstColumn && columnPosition <= rangeBounds.lastColumn
              }}
              onCellMouseDown={(position, event: MouseEvent<HTMLDivElement>) => {
                if (event.button !== 0) return
                const link = event.ctrlKey || event.metaKey ? readCell(sheet, position.rowId, position.columnId)?.l : undefined
                if (link) {
                  event.preventDefault()
                  selectCell(position)
                  openCellLink(link)
                  return
                }
                if (event.shiftKey && range) setRange({ anchor: range.anchor, focus: position })
                else selectCell(position)
              }}
              onCellDragOver={(position) => setRange((currentRange) => (currentRange ? { anchor: currentRange.anchor, focus: position } : currentRange))}
              onRowHeaderClick={(rowId, event) => (event.shiftKey && range ? selectRows(range.anchor.rowId, rowId) : selectRows(rowId, rowId))}
              selectedCell={selectedCell}
              sort={activeSort}
              onCycleSort={cycleSort}
              isEditable={isEditable}
              showColumnLetters={hasHeaderRow}
              onColumnNameClick={
                isEditable
                  ? (columnId, nameButton) => {
                      const headerBottom = nameButton.closest('[role="columnheader"]')?.getBoundingClientRect().bottom ?? nameButton.getBoundingClientRect().bottom
                      setColumnMenu({ columnId, left: nameButton.getBoundingClientRect().left, top: headerBottom + 2 })
                    }
                  : undefined
              }
              openMenuColumnId={columnMenu?.columnId ?? null}
              renderHeaderExtras={
                isEditable
                  ? (columnId, columnName) => (
                      <>
                        {columnMenu?.columnId === columnId && (
                          <editing.ColumnMenu
                            left={columnMenu.left}
                            top={columnMenu.top}
                            canRename={hasHeaderRow}
                            canDelete={columnIds.length > 1}
                            onRename={() => headerRowId !== undefined && beginEditing({ rowId: headerRowId, columnId }, 'header')}
                            onSelect={() => selectColumn(columnId)}
                            onInsertLeft={() => insertColumnNextTo(columnId, 'before')}
                            onInsertRight={() => insertColumnNextTo(columnId, 'after')}
                            onDelete={() => session.update((currentEdits) => withDeletedLines(currentEdits, sheet, 'column', new Set([columnId])))}
                            onClear={() => changeCells(visibleRowIds.map((rowId): [CellPosition, null] => [{ rowId, columnId }, null]))}
                            onWidth={() => setDialog({ kind: 'column-width', columnId })}
                            onClose={() => setColumnMenu(null)}
                          />
                        )}
                        {editingCell?.source === 'header' && editingCell.columnId === columnId && (
                          <editing.CellInput
                            ariaLabel={t('excel.view.renameColumn', { name: isolateText(columnName) })}
                            draft={editingCell.draft}
                            onDraftChange={(newDraft) => setEditingCell({ ...editingCell, draft: newDraft })}
                            onFinish={finishEditing}
                            onBlur={() => {
                              if (editWasCancelledRef.current) {
                                editWasCancelledRef.current = false
                                return
                              }
                              finishEditing(true, undefined, false)
                            }}
                          />
                        )}
                      </>
                    )
                  : undefined
              }
              renderCellEditor={
                isEditable
                  ? (rowId, columnId, columnName) =>
                      editingCell?.source === 'cell' && editingCell.rowId === rowId && editingCell.columnId === columnId ? (
                        <editing.CellInput
                          ariaLabel={t('excel.view.editCell', { column: isolateText(columnName), row: (allRowPositionById.get(rowId) ?? 0) + 1 })}
                          draft={editingCell.draft}
                          selectOnFocus={!editingCell.startedByTyping}
                          onDraftChange={(newDraft) => setEditingCell({ ...editingCell, draft: newDraft })}
                          onFinish={finishEditing}
                          onBlur={() => {
                            if (editWasCancelledRef.current) {
                              editWasCancelledRef.current = false
                              return
                            }
                            finishEditing(true, undefined, false)
                          }}
                        />
                      ) : null
                  : undefined
              }
              onCellClick={() => {}}
              onCellDoubleClick={(position) => {
                selectCell(position)
                beginEditing(position, 'cell')
              }}
              onKeyDown={handleGridKeyDown}
              emptyMessage={isSearching ? t('excel.view.noRowsMatch') : t('excel.view.noDataRows')}
            />
          </div>
        )}
      </main>

      {parsed && activeSheetId !== null && panelTab && (
        <Sidebar
          tabs={[
            { id: 'profile', label: t('excel.panel.profileShort') },
            { id: 'formulas', label: t('excel.panel.formulasShort') },
            { id: 'search', label: t('excel.panel.searchShort') },
            { id: 'compare', label: t('excel.panel.compareShort') },
          ]}
          activeTab={panelTab}
          onTabChange={(tabId) => setPanelTab(tabId as ExcelPanelTab)}
          title={panelTitle}
          subtitle={panelSubtitle}
          onClose={() => setPanelTab(null)}
          isSheetOpen
          onSheetToggle={() => setPanelTab(null)}
          sheetSummary={panelTitle}
        >
          <Suspense fallback={<p className="excel-panel-summary">{t('excel.view.reading')}</p>}>
            {panelTab === 'profile' &&
              (columnProfile && profileColumnId !== null ? (
                <ColumnProfileView
                  texts={columnProfile.texts}
                  profile={columnProfile.profile}
                  type={columnProfile.type}
                  decimals={columnProfile.decimals}
                  columnName={panelTitle}
                  activeRange={profileRangeFilter?.kind === 'range' ? profileRangeFilter : undefined}
                  onRangeClick={(from, to) => setColumnFilterFromProfile(profileColumnId, { columnId: profileColumnId, kind: 'range', min: Number(from.toFixed(columnProfile.decimals)), max: Number(to.toFixed(columnProfile.decimals)) })}
                  onValueClick={(value) => filterColumnToValue(profileColumnId, value)}
                />
              ) : (
                <p className="excel-panel-summary">{t('excel.panel.selectCell')}</p>
              ))}
            {panelTab === 'formulas' && <FormulaListPanel parsed={parsed} edits={edits} calculator={formulaCalculator} sheetRecords={sheetRecords} activeSheetId={activeSheetId} onGoToCell={goToCell} />}
            {panelTab === 'search' && <WorkbookSearchPanel parsed={parsed} edits={edits} calculator={formulaCalculator} sheetRecords={sheetRecords} onGoToCell={goToCell} />}
            {panelTab === 'compare' && (
              <SheetComparePanel
                parsed={parsed}
                edits={edits}
                calculator={formulaCalculator}
                sheetRecords={sheetRecords}
                activeSheetId={activeSheetId}
                onGoToCell={goToCell}
                readOtherWorkbook={readOtherWorkbook}
                onComparedCellsChange={setComparedCellKeys}
              />
            )}
          </Suspense>
        </Sidebar>
      )}
      </div>

      {parsed && activeSheetId !== null && (
        <SheetTabs
          sheets={tabSheetRecords}
          hiddenSheets={hiddenSheetRecords.map((sheetRecord) => ({ ...sheetRecord, visibility: parsed.sheets[sheetRecord.id]?.visibility ?? 'hidden' }))}
          activeSheetId={activeSheetId}
          isEditable={isEditable}
          onSelect={selectSheet}
          onShowHiddenSheet={(sheetId) => {
            setRevealedSheetIds((sheetIds) => new Set(sheetIds).add(sheetId))
            selectSheet(sheetId)
          }}
          onAdd={actions.openAddSheet}
          onRename={actions.openRenameSheet}
        />
      )}

      {parsed && (
        <footer id="excel-status-bar" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-0.5 text-xs">
          <p id="sheet-size" aria-live="polite" className="whitespace-nowrap font-semibold">
            {isSearching || isFiltered
              ? t('excel.status.rowsFound', { shown: visibleRowIds.length, total: displayRowIds.length })
              : `${tp('excel.status.rows', displayRowIds.length)} × ${tp('excel.status.columns', columnIds.length)}`}
          </p>
          {isFiltered && (
            <button type="button" id="clear-filters-button" className="link" onClick={clearColumnFilters}>
              {tp('excel.status.clearFilters', columnFilters.length)}
            </button>
          )}
          {(hiddenRowIds.size > 0 || hiddenColumnIds.size > 0) && (
            <button type="button" id="show-hidden-button" className="link" aria-pressed={showHidden} onClick={() => setShowHidden((isShown) => !isShown)}>
              {showHidden ? t('excel.status.hideHidden') : t('excel.status.hiddenLines', { rows: hiddenRowIds.size, columns: hiddenColumnIds.size })}
            </button>
          )}
          {showFormulas && (
            <button type="button" id="hide-formulas-button" className="link" onClick={() => setShowFormulas(false)}>
              {t('excel.status.showingFormulas')}
            </button>
          )}
          <span id="sheet-count" className="text-ink-soft">
            {tp('excel.status.sheets', sheetRecords.length)}
          </span>
          <label className="flex min-h-6 pointer-coarse:min-h-11 items-center gap-2 text-xs">
            <input
              id="header-row-checkbox"
              type="checkbox"
              checked={hasHeaderRow}
              disabled={allRowIds.length < 2}
              onChange={(event) => {
                if (activeSheetId === null) return
                const newChoice = event.target.checked
                setHeaderChoiceBySheetId((choices) => ({ ...choices, [activeSheetId]: newChoice }))
                setSortState(null)
              }}
              className="size-3.5 pointer-coarse:size-5"
            />
            {t('excel.status.headerRow')}
          </label>
          {isEditable && (
            <span title={saveNote} className="hidden cursor-help text-ink-soft lg:inline">
              {canStyle ? t('excel.status.recalcStyles') : t('excel.status.recalcNoStyles')}
            </span>
          )}
          <span className="ms-auto hidden text-ink-soft md:inline">{isEditable ? t('excel.status.editHint') : t('excel.status.searchHint')}</span>
        </footer>
      )}

      <WorkbenchDialog id="workbook-dialog" titleId={workbookDialog ? DIALOG_TITLE_IDS[workbookDialog] : 'workbook-info-title'} isOpen={workbookDialog !== null && parsed !== null} onClose={() => setWorkbookDialog(null)}>
        {parsed && (
          <Suspense fallback={<p className="excel-panel-summary">{t('excel.view.reading')}</p>}>
            {workbookDialog === 'info' && <WorkbookInfoDialog parsed={parsed} fileName={openedFile.file.name} fileSize={formatFileSize(openedFile.file.size)} onClose={() => setWorkbookDialog(null)} />}
            {workbookDialog === 'print' && <PrintSheetDialog sheetName={activeSheetName} cellCount={visibleRowIds.length * shownColumnIds.length} readTable={readShownTable} onClose={() => setWorkbookDialog(null)} />}
            {workbookDialog === 'files' && (
              <WorkbookFilesDialog parsed={parsed} edits={edits} sheetRecords={sheetRecords} fileName={openedFile.file.name} readOtherWorkbook={readOtherWorkbook} onOpenFile={onOpenFile} onClose={() => setWorkbookDialog(null)} />
            )}
          </Suspense>
        )}
      </WorkbenchDialog>

      {isEditable && dialog && sheet && (
        <editing.SheetDialogs
          dialog={dialog}
          sheetNames={sheetRecords.map((sheetRecord) => sheetRecord.name)}
          activeSheetName={activeSheetName}
          suggestedSheetName={suggestNewSheetName(sheetRecords)}
          validateSheetName={(name, otherNames) => validateSheetName(name, otherNames, locale)}
          currentLink={sheet && selectedCell ? (readCell(sheet, selectedCell.rowId, selectedCell.columnId)?.l?.Target ?? '') : ''}
          onSetLink={setSelectedCellLink}
          currentColumnWidthPx={dialog.kind === 'column-width' ? (columnWidthsPx[columnPositionById.get(dialog.columnId) ?? 0] ?? 0) : 0}
          onAddSheet={addSheet}
          onRenameSheet={renameActiveSheet}
          onDeleteSheet={deleteActiveSheet}
          onSetColumnWidth={setActiveColumnWidth}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
