import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { textControlClassName } from '../../buttonStyles'
import { FatalFileError, Notice } from '../../components/Messages'
import { getLargeFileWarning } from '../../useFileIntake'
import { isolateText, useT } from '../../i18n'
import type { FormatViewerProps } from '../registry'
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
import type { CellPosition, CellStyle, ExcelEdits, ExcelExportSource, ExcelSelection, ExcelViewerCommands, ParseResult } from './excelModel'
import type { ExcelActions, ExcelEditingComponents, SheetDialog } from './excelEditing'
import { createFormulaCalculator, translateFormulaRefs } from './excelFormulas'
import { MAX_STYLED_FILE_BYTES, readWorkbookStyles } from './excelStyles'
import SheetTabs from './SheetTabs'
import type * as XLSX from 'xlsx'

type EditingCell = CellPosition & { draft: string; source: 'cell' | 'bar' | 'header'; startedByTyping: boolean }
type CellRange = { anchor: CellPosition; focus: CellPosition }

const noIds: number[] = []
const MAX_CLIPBOARD_CELLS = 200_000

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
  onSelectionChange,
  onCommandsChange,
  onExportSourceChange,
}: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const session = untypedSession as EditSession<ExcelEdits>
  const editing = editingComponents as ExcelEditingComponents | null
  const isEditable = mode === 'edit' && editing !== null
  const [stylesVersion, setStylesVersion] = useState(0)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [pickedSheetId, setPickedSheetId] = useState<number | null>(null)
  const [headerChoiceBySheetId, setHeaderChoiceBySheetId] = useState<Record<number, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [sortState, setSortState] = useState<SortState>(null)
  const [range, setRange] = useState<CellRange | null>(null)
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
  const deferredSearchText = useDeferredValue(searchText)
  const deferredFindText = useDeferredValue(findText)
  const tableRef = useRef<DataTableHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pendingRevealRef = useRef<CellPosition | null>(null)
  const editWasCancelledRef = useRef(false)
  const { reset: resetEditSession } = session
  const edits = session.edits

  // Parse after the "Reading file" state has painted, so the page never looks frozen.
  useEffect(() => {
    // A new file starts from a clean state; this is the reset, not a value derived from other state.
    // oxlint-disable-next-line react/set-state-in-effect
    setParseResult(null)
    setPickedSheetId(null)
    setHeaderChoiceBySheetId({})
    setSortState(null)
    setRange(null)
    setEditingCell(null)
    resetEditSession()
    const parseTimerId = setTimeout(() => setParseResult(parseWorkbook(openedFile.contents, openedFile.file.name, locale)), 0)
    return () => clearTimeout(parseTimerId)
    // A language change must not re-read the file and drop the visitor's edits.
  }, [openedFile, resetEditSession]) // oxlint-disable-line react-hooks/exhaustive-deps

  // "/" jumps to the search box. It is registered only while this viewer is on screen.
  useEffect(() => {
    function focusSearchOnSlash(event: globalThis.KeyboardEvent) {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
      if (event.key === '/' && !isTyping && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        searchInputRef.current?.focus()
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
      () => {},
    )
    return () => {
      isCancelled = true
    }
  }, [parsed, hasStyledFileType, openedFile])
  const sheetRecords = useMemo(() => (parsed ? getSheetRecords(parsed, edits) : []), [parsed, edits])
  const activeSheetId = sheetRecords.some((sheetRecord) => sheetRecord.id === pickedSheetId) ? pickedSheetId : (sheetRecords[0]?.id ?? null)
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

  // Search and sort read the sheet as it was when they last changed, so a row does not jump away while it is edited.
  const visibleRowIds = useVisibleRowIds({
    rowIds: displayRowIds,
    columnIds,
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
      const firstColumnPosition = columnPositionById.get(merge.columnIds[0])
      if (firstRowPosition === undefined || firstColumnPosition === undefined) continue
      const rowsAreTogether = merge.rowIds.every((rowId, offset) => visiblePositionByRowId.get(rowId) === firstRowPosition + offset)
      const columnsAreTogether = merge.columnIds.every((columnId, offset) => columnPositionById.get(columnId) === firstColumnPosition + offset)
      if (rowsAreTogether && columnsAreTogether && merge.rowIds.length * merge.columnIds.length > 1) {
        spans.set(cellKey(merge.rowIds[0], merge.columnIds[0]), { rowSpan: merge.rowIds.length, columnSpan: merge.columnIds.length })
      }
    }
    return spans
  }, [sheet, visiblePositionByRowId, columnPositionById])

  // The selected cell is the end of the range; it stays selected only while its row and column are still shown.
  const selectedCell = range && visiblePositionByRowId.has(range.focus.rowId) && columnPositionById.has(range.focus.columnId) ? range.focus : null
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
    const columnPosition = Math.max(0, Math.min((columnPositionById.get(selectedCell.columnId) as number) + columnStep, columnIds.length - 1))
    const newFocus = { rowId: visibleRowIds[rowPosition], columnId: columnIds[columnPosition] }
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
  const deferredSheet = useDeferredValue(sheet)
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
    if (rowPosition === undefined || !columnPositionById.has(reveal.columnId)) return
    pendingRevealRef.current = null
    // A line was just added; selecting it once it is on screen is the point of this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    setRange({ anchor: reveal, focus: reveal })
    tableRef.current?.scrollToRow(rowPosition)
  }, [visiblePositionByRowId, columnPositionById])

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
      isBold: focusStyle?.font?.bold === true,
      isItalic: focusStyle?.font?.italic === true,
      isUnderlined: !!focusStyle?.font?.underline,
      isStruckThrough: focusStyle?.font?.strike === true,
      alignment: focusStyle?.alignment?.horizontal,
      isMerged: sheet && selectedCell ? findMergeAt(sheet, selectedCell) !== undefined : false,
    }
    onSelectionChange(selection)
  }, [parsed, sheet, activeSheetName, sheetRecords.length, selectedCell, hasHeaderRow, selectedRowIds.length, selectedColumnIds.length, canStyle, focusStyle, onSelectionChange])

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

      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        {parseResult === null && <p className="p-6 text-ink-soft">{t('excel.view.reading')}</p>}

        {parseResult?.status === 'error' && (
          <FatalFileError title={t('excel.view.errorTitle')} reason={parseResult.message} hint={t('excel.view.errorHint')} onOpenAnotherFile={onOpenAnotherFile} />
        )}

        {parsed && sheet && isSheetEmpty && (
          <p className="p-6 text-ink-soft">{isEditable ? t('excel.view.sheetEmptyEditable') : t('excel.view.sheetEmpty')}</p>
        )}

        {parsed && sheet && !isSheetEmpty && (
          <div dir="ltr" className="flex min-h-0 flex-1 flex-col" onCopy={copySelection} onCut={cutSelection} onPaste={pasteIntoSelection}>
            <DataTable
              tableRef={tableRef}
              label={activeSheetName}
              columnIds={columnIds}
              columnNames={columnNames}
              columnWidthsPx={columnWidthsPx}
              rowNumberWidthPx={rowNumberColumnWidthPx}
              rowIds={visibleRowIds}
              getCellText={(rowId, columnId) => (editingCell?.source === 'bar' && editingCell.rowId === rowId && editingCell.columnId === columnId ? editingCell.draft : getText(rowId, columnId))}
              getOriginalText={(rowId, columnId) => getOriginalCellText(sheet, rowId, columnId)}
              dataKey={sheetDataKey}
              isCellEdited={(rowId, columnId) => rowId < 0 || columnId < 0 || (sheet.edits?.cells.has(cellKey(rowId, columnId)) ?? false)}
              getCellSpan={(rowId, columnId) => mergeSpanByAnchorKey.get(cellKey(rowId, columnId)) ?? null}
              getCellStyle={(rowId, columnId) => {
                const css = cssForStyle(readStyle(sheet, rowId, columnId))
                // A cell with a link looks like a link unless it was given its own colour.
                return readCell(sheet, rowId, columnId)?.l?.Target ? { color: '#0563c1', textDecoration: 'underline', ...css } : css
              }}
              getRowLabel={(rowId) => String((allRowPositionById.get(rowId) ?? 0) + 1)}
              isFindMatch={isEditable && isFindOpen && deferredFindText !== '' ? (cellText) => textMatches(cellText, deferredFindText, matchCase) : undefined}
              isCellInSelection={(rowId, columnId) => {
                if (!rangeBounds || (rangeBounds.firstRow === rangeBounds.lastRow && rangeBounds.firstColumn === rangeBounds.lastColumn)) return false
                const rowPosition = visiblePositionByRowId.get(rowId) as number
                const columnPosition = columnPositionById.get(columnId) as number
                return rowPosition >= rangeBounds.firstRow && rowPosition <= rangeBounds.lastRow && columnPosition >= rangeBounds.firstColumn && columnPosition <= rangeBounds.lastColumn
              }}
              onCellMouseDown={(position, event) => {
                if (event.button !== 0) return
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

      {parsed && activeSheetId !== null && (
        <SheetTabs
          sheets={sheetRecords}
          activeSheetId={activeSheetId}
          isEditable={isEditable}
          onSelect={selectSheet}
          onAdd={actions.openAddSheet}
          onRename={actions.openRenameSheet}
        />
      )}

      {parsed && (
        <footer id="excel-status-bar" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-0.5 text-xs">
          <p id="sheet-size" aria-live="polite" className="whitespace-nowrap font-semibold">
            {isSearching
              ? t('excel.status.rowsFound', { shown: visibleRowIds.length, total: displayRowIds.length })
              : `${tp('excel.status.rows', displayRowIds.length)} × ${tp('excel.status.columns', columnIds.length)}`}
          </p>
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
