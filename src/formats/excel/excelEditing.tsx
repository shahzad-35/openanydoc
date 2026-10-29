// This module is fetched on demand, not hot-reloaded as a component file, so the fast-refresh rule does not apply.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { FocusEventHandler, KeyboardEventHandler, ReactNode } from 'react'
import { textControlClassName } from '../../buttonStyles'
import { toElementId } from '../../elementId'
import { isolateText, translate, translatePlural, useT } from '../../i18n'
import type { Locale, MessageKey } from '../../i18n'
import FindReplaceBar from '../../components/FindReplaceBar'
import type { MenuDefinition, MenuEntry } from '../../components/MenuBar'
import ModalDialog from '../../components/ModalDialog'
import { ActionMenu, Icon, IconButton, IconMenuButton, iconButtonClassName } from '../../components/ToolbarControls'
import { CellInput } from '../DataTable'
import type { EditingModule, EditorTool, ExportOption } from '../registry'
import { FILE_MIME_TYPE_BY_BOOK_TYPE, writeWorkbookFile } from './excelSave'
import type { ExcelEdits, ExcelExportSource, ExcelSelection, ExcelViewerCommands } from './excelModel'

// Everything in this file is loaded only when Edit is first used.

// ---------------------------------------------------------------- toolbar tool and download

// Everything for this format lives in the toolbar menus below, so there are no separate tool buttons.
const tools: EditorTool[] = []

// The Download icon saves the whole workbook (every sheet, with the edits) in the format it was opened in.
const downloadOption: ExportOption = {
  id: 'workbook',
  getLabel: (_exportSource, locale) => translate(locale, 'excel.toolbar.saveWorkbook'),
  extension: null,
  getMimeType: (exportSource) => FILE_MIME_TYPE_BY_BOOK_TYPE[(exportSource as ExcelExportSource).parsed.bookType] ?? 'application/octet-stream',
  createFile: (edits, exportSource) => writeWorkbookFile((exportSource as ExcelExportSource).parsed, edits as ExcelEdits),
}

const describeDownload = (_exportSource: unknown, locale: Locale) => translate(locale, 'excel.toolbar.downloadDescription')

// ---------------------------------------------------------------- what the viewer lets the menus do

export type SheetDialog = { kind: 'add-sheet' } | { kind: 'rename-sheet' } | { kind: 'delete-sheet' } | { kind: 'column-width'; columnId: number } | { kind: 'link' }

export type ExcelActions = {
  toggleBold: () => void
  // 'all', 'outer', or one side; 'none' removes the borders.
  setBorders: (kind: 'all' | 'outer' | 'top' | 'bottom' | 'left' | 'right' | 'none') => void
  setFontFamily: (fontName: string) => void
  setFontSize: (fontSize: number) => void
  changeIndent: (delta: 1 | -1) => void
  transformText: (kind: 'upper' | 'lower' | 'capitalize' | 'trim') => void
  moveSheet: (delta: -1 | 1) => void
  openLink: () => void
  toggleUnderline: () => void
  toggleStrikethrough: () => void
  clearFormatting: () => void
  // One more (1) or one fewer (-1) decimal place.
  changeDecimals: (delta: 1 | -1) => void
  toggleItalic: () => void
  // A colour as six hex digits, or null to remove it.
  setTextColor: (hexColor: string | null) => void
  setFillColor: (hexColor: string | null) => void
  setAlignment: (alignment: 'left' | 'center' | 'right') => void
  toggleMerge: () => void
  insertRows: (side: 'above' | 'below') => void
  deleteRows: () => void
  clearRows: () => void
  insertColumns: (side: 'left' | 'right') => void
  deleteColumns: () => void
  clearColumns: () => void
  clearCells: () => void
  fillDown: () => void
  fillRight: () => void
  setNumberFormat: (format: string) => void
  openColumnWidth: () => void
  openAddSheet: () => void
  openRenameSheet: () => void
  openDeleteSheet: () => void
}

const FONT_FAMILIES = ['Arial', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana']
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 36]

// `idSuffix` keeps the four date formats' menu item ids apart ("date", "date-2" ...).
const NUMBER_FORMATS: { labelKey: MessageKey; format: string; idSuffix?: string }[] = [
  { labelKey: 'excel.menu.numGeneral', format: 'General' },
  { labelKey: 'excel.menu.numText', format: '@' },
  { labelKey: 'excel.menu.numNumber', format: '#,##0.00' },
  { labelKey: 'excel.menu.numNumberNoDecimals', format: '#,##0' },
  { labelKey: 'excel.menu.numPercentage', format: '0.00%' },
  { labelKey: 'excel.menu.numScientific', format: '0.00E+00' },
  { labelKey: 'excel.menu.numAccounting', format: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)' },
  { labelKey: 'excel.menu.numDateIso', format: 'yyyy-mm-dd' },
  { labelKey: 'excel.menu.numDateDayFirst', format: 'dd/mm/yyyy', idSuffix: '-2' },
  { labelKey: 'excel.menu.numDateMonthFirst', format: 'mm/dd/yyyy', idSuffix: '-3' },
  { labelKey: 'excel.menu.numDateShortMonth', format: 'd mmm yyyy', idSuffix: '-4' },
  { labelKey: 'excel.menu.numTime', format: 'hh:mm:ss' },
  { labelKey: 'excel.menu.numDateTime', format: 'yyyy-mm-dd hh:mm' },
]

// Currencies for the toolbar's currency menu: the symbol or code written before the number, and the decimals that currency uses.
const CURRENCIES: { labelKey: MessageKey; prefix: string; decimals: number }[] = [
  { labelKey: 'excel.menu.currencySar', prefix: 'SAR ', decimals: 2 },
  { labelKey: 'excel.menu.currencyPkr', prefix: 'Rs ', decimals: 2 },
  { labelKey: 'excel.menu.currencyUsd', prefix: '$', decimals: 2 },
  { labelKey: 'excel.menu.currencyAed', prefix: 'AED ', decimals: 2 },
  { labelKey: 'excel.menu.currencyEur', prefix: '€', decimals: 2 },
  { labelKey: 'excel.menu.currencyGbp', prefix: '£', decimals: 2 },
  { labelKey: 'excel.menu.currencyInr', prefix: '₹', decimals: 2 },
  { labelKey: 'excel.menu.currencyKwd', prefix: 'KWD ', decimals: 3 },
  { labelKey: 'excel.menu.currencyQar', prefix: 'QAR ', decimals: 2 },
  { labelKey: 'excel.menu.currencyEgp', prefix: 'EGP ', decimals: 2 },
  { labelKey: 'excel.menu.currencyTry', prefix: '₺', decimals: 2 },
  { labelKey: 'excel.menu.currencyCny', prefix: 'CN¥', decimals: 2 },
  { labelKey: 'excel.menu.currencyJpy', prefix: '¥', decimals: 0 },
  { labelKey: 'excel.menu.currencyCad', prefix: 'CA$', decimals: 2 },
  { labelKey: 'excel.menu.currencyAud', prefix: 'A$', decimals: 2 },
  { labelKey: 'excel.menu.currencyChf', prefix: 'CHF ', decimals: 2 },
]

function currencyFormat({ prefix, decimals }: { prefix: string; decimals: number }) {
  return `"${prefix}"#,##0${decimals > 0 ? `.${'0'.repeat(decimals)}` : ''}`
}

// ---------------------------------------------------------------- menus

const COLOR_CHOICES: { hexColor: string; nameKey: MessageKey }[] = [
  { hexColor: '000000', nameKey: 'excel.toolbar.colorBlack' },
  { hexColor: '595959', nameKey: 'excel.toolbar.colorDarkGray' },
  { hexColor: 'A6A6A6', nameKey: 'excel.toolbar.colorGray' },
  { hexColor: 'FFFFFF', nameKey: 'excel.toolbar.colorWhite' },
  { hexColor: 'FF0000', nameKey: 'excel.toolbar.colorRed' },
  { hexColor: 'FF9900', nameKey: 'excel.toolbar.colorOrange' },
  { hexColor: 'FFFF00', nameKey: 'excel.toolbar.colorYellow' },
  { hexColor: '00B050', nameKey: 'excel.toolbar.colorGreen' },
  { hexColor: '0070C0', nameKey: 'excel.toolbar.colorBlue' },
  { hexColor: '7030A0', nameKey: 'excel.toolbar.colorPurple' },
]


const COLOR_MENU_WIDTH_PX = 176 // the menu's w-44

// A button that opens a small grid of colours (and "None"), for text and fill colour.
function ColorMenuButton({ id: buttonId, label, isDisabled, currentColor, onPick, children }: { id: string; label: string; isDisabled: boolean; currentColor: string; onPick: (hexColor: string | null) => void; children: ReactNode }) {
  const { t } = useT()
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    menu.showPopover()
    menu.querySelector<HTMLElement>('button')?.focus()
    return () => {
      if (menu.matches(':popover-open')) menu.hidePopover()
      opener?.focus()
    }
  }, [menuPosition !== null]) // oxlint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        id={buttonId}
        type="button"
        aria-label={label}
        data-tip={label}
        aria-haspopup="menu"
        aria-controls={menuPosition ? `${buttonId}-menu` : undefined}
        aria-expanded={menuPosition !== null}
        disabled={isDisabled}
        onClick={(event) => {
          const buttonBox = event.currentTarget.getBoundingClientRect()
          setMenuPosition({ left: buttonBox.left, top: buttonBox.bottom + 2 })
        }}
        className={iconButtonClassName}
      >
        <span className="flex flex-col items-center leading-none">
          {children}
          <span className="mt-0.5 h-1 w-4 rounded-sm border border-rule" style={{ backgroundColor: currentColor }} />
        </span>
      </button>
      {menuPosition && (
        <div
          id={`${buttonId}-menu`}
          ref={menuRef}
          popover="auto"
          role="menu"
          aria-label={label}
          onToggle={(event) => {
            if (event.newState === 'closed') setMenuPosition(null)
          }}
          style={{ left: Math.min(menuPosition.left, window.innerWidth - COLOR_MENU_WIDTH_PX - 8), top: menuPosition.top }}
          className="box-shape solid-box fixed m-0 w-44 border-rule bg-paper-raised p-2 text-ink"
        >
          <div className="grid grid-cols-5 gap-1.5">
            {COLOR_CHOICES.map(({ hexColor, nameKey }) => (
              <button
                key={hexColor}
                id={`${buttonId}-menu-${hexColor}`}
                type="button"
                role="menuitem"
                aria-label={t(nameKey)}
                title={t(nameKey)}
                onClick={() => {
                  onPick(hexColor)
                  setMenuPosition(null)
                }}
                style={{ backgroundColor: `#${hexColor}` }}
                className="size-6 cursor-pointer rounded-sm border border-rule"
              />
            ))}
          </div>
          <button
            id={`${buttonId}-menu-none`}
            type="button"
            role="menuitem"
            onClick={() => {
              onPick(null)
              setMenuPosition(null)
            }}
            className="mt-2 min-h-8 w-full cursor-pointer rounded px-2 text-start text-sm hover:bg-paper"
          >
            {t('excel.toolbar.colorNone')}
          </button>
        </div>
      )}
    </>
  )
}

const alignIconPaths = {
  left: ['M4 6h16', 'M4 10h10', 'M4 14h16', 'M4 18h10'],
  center: ['M4 6h16', 'M7 10h10', 'M4 14h16', 'M7 18h10'],
  right: ['M4 6h16', 'M10 10h10', 'M4 14h16', 'M10 18h10'],
}

function AlignIcon({ alignment }: { alignment: 'left' | 'center' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {alignIconPaths[alignment].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}

// The most-used formatting tools as icons in the menu bar row, after the menu names (everything is also in the menus):
// number format, text style, colours, borders, alignment and merge.
function MenuBarTools({ selection, commands }: { selection: unknown; commands: unknown }) {
  const { t, idFor } = useT()
  const { hasCell, canStyle, isBold, isItalic, isUnderlined, isStruckThrough, alignment, isMerged } =
    (selection as NonNullable<ExcelSelection> | null) ?? {
      hasCell: false,
      canStyle: false,
      isBold: false,
      isItalic: false,
      isUnderlined: false,
      isStruckThrough: false,
      alignment: undefined,
      isMerged: false,
    }
  const getActions = (commands as ExcelViewerCommands | null)?.getActions
  if (!getActions) return null
  const hasSelection = hasCell
  const styleDisabled = !hasSelection || !canStyle
  const styleHint = canStyle ? '' : ` (${t('excel.toolbar.stylesXlsxOnly')})`
  const styledLabel = (key: MessageKey) => `${t(key)}${styleHint}`
  const toolbarId = (key: MessageKey) => `toolbar-${idFor(key)}`
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  return (
    <>
      {divider}
      <IconMenuButton
        id={toolbarId('excel.toolbar.formatAsCurrency')}
        label={t('excel.toolbar.formatAsCurrency')}
        isDisabled={!hasSelection}
        items={CURRENCIES.map((currency) => ({ id: idFor(currency.labelKey, true), label: t(currency.labelKey), onSelect: () => getActions().setNumberFormat(currencyFormat(currency)) }))}
      >
        <span>$</span>
      </IconMenuButton>
      <IconButton id={toolbarId('excel.toolbar.formatAsPercent')} label={t('excel.toolbar.formatAsPercent')} isDisabled={!hasSelection} onClick={() => getActions().setNumberFormat('0.00%')}>
        %
      </IconButton>
      <IconButton id={toolbarId('excel.toolbar.fewerDecimals')} label={t('excel.toolbar.fewerDecimals')} isDisabled={!hasSelection} onClick={() => getActions().changeDecimals(-1)}>
        <span dir="ltr" className="text-[11px] font-semibold">.0←</span>
      </IconButton>
      <IconButton id={toolbarId('excel.toolbar.moreDecimals')} label={t('excel.toolbar.moreDecimals')} isDisabled={!hasSelection} onClick={() => getActions().changeDecimals(1)}>
        <span dir="ltr" className="text-[11px] font-semibold">.00→</span>
      </IconButton>
      {divider}
      <IconButton id={toolbarId('excel.toolbar.bold')} label={styledLabel('excel.toolbar.bold')} isPressed={isBold} isDisabled={styleDisabled} onClick={() => getActions().toggleBold()}>
        <span className="font-bold">B</span>
      </IconButton>
      <IconButton id={toolbarId('excel.toolbar.italic')} label={styledLabel('excel.toolbar.italic')} isPressed={isItalic} isDisabled={styleDisabled} onClick={() => getActions().toggleItalic()}>
        <span className="font-serif italic">I</span>
      </IconButton>
      <IconButton id={toolbarId('excel.toolbar.underline')} label={styledLabel('excel.toolbar.underline')} isPressed={isUnderlined} isDisabled={styleDisabled} onClick={() => getActions().toggleUnderline()}>
        <span className="underline">U</span>
      </IconButton>
      <IconButton id={toolbarId('excel.toolbar.strikethrough')} label={styledLabel('excel.toolbar.strikethrough')} isPressed={isStruckThrough} isDisabled={styleDisabled} onClick={() => getActions().toggleStrikethrough()}>
        <span className="line-through">S</span>
      </IconButton>
      <ColorMenuButton id={toolbarId('excel.toolbar.textColour')} label={styledLabel('excel.toolbar.textColour')} isDisabled={styleDisabled} currentColor="#d93025" onPick={(hexColor) => getActions().setTextColor(hexColor)}>
        <span className="font-semibold">A</span>
      </ColorMenuButton>
      <ColorMenuButton id={toolbarId('excel.toolbar.fillColour')} label={styledLabel('excel.toolbar.fillColour')} isDisabled={styleDisabled} currentColor="#fbbc04" onPick={(hexColor) => getActions().setFillColor(hexColor)}>
        <Icon>
          <path d="m5 12 7-7 7 7-7 7-7-7Z" />
          <path d="M20 16c0 1.5-1 2.5-1 2.5s-1-1-1-2.5a1 1 0 0 1 2 0Z" />
        </Icon>
      </ColorMenuButton>
      <IconMenuButton
        id={toolbarId('excel.toolbar.borders')}
        label={styledLabel('excel.toolbar.borders')}
        isDisabled={styleDisabled}
        items={[
          { id: idFor('excel.menu.allBorders', true), label: t('excel.menu.allBorders'), onSelect: () => getActions().setBorders('all') },
          { id: idFor('excel.menu.outerBorders', true), label: t('excel.menu.outerBorders'), onSelect: () => getActions().setBorders('outer') },
          { id: idFor('excel.menu.topBorder', true), label: t('excel.menu.topBorder'), onSelect: () => getActions().setBorders('top') },
          { id: idFor('excel.menu.bottomBorder', true), label: t('excel.menu.bottomBorder'), onSelect: () => getActions().setBorders('bottom') },
          { id: idFor('excel.menu.leftBorder', true), label: t('excel.menu.leftBorder'), onSelect: () => getActions().setBorders('left') },
          { id: idFor('excel.menu.rightBorder', true), label: t('excel.menu.rightBorder'), onSelect: () => getActions().setBorders('right') },
          { id: idFor('excel.menu.noBorders', true), label: t('excel.menu.noBorders'), onSelect: () => getActions().setBorders('none') },
        ]}
      >
        <Icon>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M12 4v16" strokeDasharray="2 2" />
          <path d="M4 12h16" strokeDasharray="2 2" />
        </Icon>
      </IconMenuButton>
      {divider}
      {(
        [
          { side: 'left', labelKey: 'excel.toolbar.alignLeft' },
          { side: 'center', labelKey: 'excel.toolbar.alignCenter' },
          { side: 'right', labelKey: 'excel.toolbar.alignRight' },
        ] as const
      ).map(({ side, labelKey }) => (
        <IconButton key={side} id={toolbarId(labelKey)} label={styledLabel(labelKey)} isPressed={alignment === side} isDisabled={styleDisabled} onClick={() => getActions().setAlignment(side)}>
          <AlignIcon alignment={side} />
        </IconButton>
      ))}
      <IconButton
        id="toolbar-merge-cells"
        label={t(isMerged ? 'excel.toolbar.unmergeCells' : 'excel.toolbar.mergeCells')}
        isPressed={isMerged}
        isDisabled={!hasSelection}
        onClick={() => getActions().toggleMerge()}
      >
        <Icon>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="M8 12h8" />
          <path d="m10 9-2 3 2 3" />
          <path d="m14 9 2 3-2 3" />
        </Icon>
      </IconButton>
    </>
  )
}

type ColumnMenuProps = {
  left: number
  top: number
  canRename: boolean
  canDelete: boolean
  onRename: () => void
  onSelect: () => void
  onInsertLeft: () => void
  onInsertRight: () => void
  onDelete: () => void
  onClear: () => void
  onWidth: () => void
  onClose: () => void
}

// The menu under a column header in Edit mode.
function ColumnMenu({ left, top, canRename, canDelete, onRename, onSelect, onInsertLeft, onInsertRight, onDelete, onClear, onWidth, onClose }: ColumnMenuProps) {
  const { t, idFor } = useT()
  return (
    <ActionMenu
      id="column-actions-menu"
      ariaLabel={t('excel.menu.columnActions')}
      left={left}
      top={top}
      onClose={onClose}
      items={[
        { id: idFor('excel.menu.renameColumn', true), label: t('excel.menu.renameColumn'), onSelect: onRename, isDisabled: !canRename },
        { id: idFor('excel.menu.selectColumn', true), label: t('excel.menu.selectColumn'), onSelect },
        { id: idFor('excel.menu.insertColumnLeft', true), label: t('excel.menu.insertColumnLeft'), onSelect: onInsertLeft },
        { id: idFor('excel.menu.insertColumnRight', true), label: t('excel.menu.insertColumnRight'), onSelect: onInsertRight },
        { id: idFor('excel.menu.clearColumn', true), label: t('excel.menu.clearColumn'), onSelect: onClear },
        { id: idFor('excel.menu.columnWidth', true), label: t('excel.menu.columnWidth'), onSelect: onWidth },
        { id: idFor('excel.menu.deleteColumn', true), label: t('excel.menu.deleteColumn'), onSelect: onDelete, isDisabled: !canDelete },
      ]}
    />
  )
}

// ---------------------------------------------------------------- value bar, find and replace

type EditBarProps = {
  selectedCellLabel: string
  isDisabled: boolean
  value: string
  onChange: (newValue: string) => void
  onKeyDown: KeyboardEventHandler<HTMLInputElement>
  onBlur: FocusEventHandler<HTMLInputElement>
}

// The cell address and the value field that edits the selected cell. A value starting with = is stored as a formula.
function EditBar({ selectedCellLabel, isDisabled, value, onChange, onKeyDown, onBlur }: EditBarProps) {
  const { t } = useT()
  return (
    <>
      <p
        id="selected-cell-label"
        dir="ltr"
        aria-label={t('excel.toolbar.selectedCell')}
        className="control-shape solid-box flex min-h-8 pointer-coarse:min-h-11 min-w-16 shrink-0 items-center justify-center border-rule bg-paper-raised px-3 font-mono text-sm"
      >
        {selectedCellLabel}
      </p>
      <input
        id="cell-value-input"
        dir="auto"
        aria-label={t('excel.toolbar.valueInputLabel')}
        placeholder={t('excel.toolbar.valueInputPlaceholder')}
        disabled={isDisabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={`${textControlClassName} min-w-48 flex-1 disabled:cursor-not-allowed disabled:text-ink-soft`}
      />
    </>
  )
}

// ---------------------------------------------------------------- dialogs for sheets and column width

const MIN_COLUMN_WIDTH_PX = 40
const MAX_COLUMN_WIDTH_PX = 600

type SheetDialogsProps = {
  dialog: SheetDialog
  sheetNames: string[]
  activeSheetName: string
  suggestedSheetName: string
  validateSheetName: (name: string, otherNames: readonly string[]) => string | null
  currentColumnWidthPx: number
  currentLink: string
  onSetLink: (address: string) => void
  onAddSheet: (name: string) => void
  onRenameSheet: (name: string) => void
  onDeleteSheet: () => void
  onSetColumnWidth: (columnId: number, widthPx: number) => void
  onClose: () => void
}

function SheetDialogs({
  dialog,
  sheetNames,
  activeSheetName,
  suggestedSheetName,
  validateSheetName,
  currentColumnWidthPx,
  currentLink,
  onSetLink,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  onSetColumnWidth,
  onClose,
}: SheetDialogsProps) {
  const { t, idFor } = useT()
  const [draft, setDraft] = useState(
    dialog.kind === 'add-sheet' ? suggestedSheetName : dialog.kind === 'rename-sheet' ? activeSheetName : dialog.kind === 'link' ? currentLink : String(Math.round(currentColumnWidthPx)),
  )
  const otherNames = dialog.kind === 'rename-sheet' ? sheetNames.filter((name) => name !== activeSheetName) : sheetNames
  const widthPx = Number(draft)
  const problem =
    dialog.kind === 'column-width'
      ? Number.isFinite(widthPx) && widthPx >= MIN_COLUMN_WIDTH_PX && widthPx <= MAX_COLUMN_WIDTH_PX
        ? null
        : t('excel.toolbar.widthError', { min: MIN_COLUMN_WIDTH_PX, max: MAX_COLUMN_WIDTH_PX })
      : dialog.kind === 'delete-sheet' || dialog.kind === 'link'
        ? null
        : validateSheetName(draft, otherNames)

  const titleKeys = {
    'add-sheet': 'excel.menu.addSheet',
    'rename-sheet': 'excel.menu.renameSheet',
    'delete-sheet': 'excel.menu.deleteSheet',
    'column-width': 'excel.menu.columnWidth',
    link: 'excel.toolbar.linkTitle',
  } as const
  const titleKey = titleKeys[dialog.kind]

  function submit() {
    if (problem) return
    if (dialog.kind === 'add-sheet') onAddSheet(draft)
    else if (dialog.kind === 'rename-sheet') onRenameSheet(draft)
    else if (dialog.kind === 'delete-sheet') onDeleteSheet()
    else if (dialog.kind === 'link') onSetLink(draft.trim())
    else onSetColumnWidth(dialog.columnId, widthPx)
    onClose()
  }

  return (
    <ModalDialog title={t(titleKey)} id={`dialog-${idFor(titleKey)}`} onClose={onClose} inWorkbench>
      <form
        id="sheet-dialog-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="dlg-body">
          {dialog.kind === 'delete-sheet' ? (
            <p>{t('excel.toolbar.deleteSheetConfirm', { name: isolateText(activeSheetName) })}</p>
          ) : (
            <label htmlFor="dialog-input" className="field">
              {dialog.kind === 'column-width' ? t('excel.toolbar.widthLabel') : dialog.kind === 'link' ? t('excel.toolbar.linkLabel') : t('excel.toolbar.sheetNameLabel')}
              <input
                id="dialog-input"
                autoFocus
                dir={dialog.kind === 'column-width' || dialog.kind === 'link' ? 'ltr' : 'auto'}
                inputMode={dialog.kind === 'column-width' ? 'numeric' : dialog.kind === 'link' ? 'url' : undefined}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-invalid={problem !== null}
              />
            </label>
          )}
          {problem && draft !== '' && (
            <p id="dialog-error" role="alert" className="text-sm text-danger">
              {problem}
            </p>
          )}
        </div>
        <div className="dlg-foot">
          <span className="spacer" />
          <button id="dialog-cancel-button" type="button" onClick={onClose} className="btn outline">
            {t('excel.toolbar.dialogCancel')}
          </button>
          <button id="dialog-submit-button" type="submit" disabled={problem !== null} className="btn primary">
            {t(dialog.kind === 'delete-sheet' ? 'excel.toolbar.dialogDelete' : dialog.kind === 'add-sheet' ? 'excel.toolbar.dialogAdd' : 'excel.toolbar.dialogSave')}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

// The workbook's own menus in the menu bar (Edit, Insert, Format, Data). Every item calls an action the toolbar also offers.
// "excel.menu.numDateIso" -> "date-iso": a stable menu item id from a message key, never from the translated text.
const idFromKey = (key: MessageKey, prefix: string) => key.slice(prefix.length).replace(/[A-Z]/g, (letter, offset: number) => `${offset > 0 ? '-' : ''}${letter.toLowerCase()}`)

const BORDER_CHOICES: { side: 'all' | 'outer' | 'top' | 'bottom' | 'left' | 'right' | 'none'; labelKey: MessageKey }[] = [
  { side: 'all', labelKey: 'excel.menu.allBorders' },
  { side: 'outer', labelKey: 'excel.menu.outerBorders' },
  { side: 'top', labelKey: 'excel.menu.topBorder' },
  { side: 'bottom', labelKey: 'excel.menu.bottomBorder' },
  { side: 'left', labelKey: 'excel.menu.leftBorder' },
  { side: 'right', labelKey: 'excel.menu.rightBorder' },
  { side: 'none', labelKey: 'excel.menu.noBorders' },
]

// Every editing tool of the workbook, in the menu bar: Edit, Insert, Format (with submenus for number formats, currencies,
// fonts, sizes, colours and borders), Data and Sheets.
function buildExcelMenus(selection: unknown, commands: unknown, locale: Locale): MenuDefinition[] {
  const viewerCommands = commands as ExcelViewerCommands | null
  if (!viewerCommands) return []
  const current = selection as NonNullable<ExcelSelection> | null
  const text = (key: MessageKey) => translate(locale, key)
  const hasCell = current?.hasCell ?? false
  const selectedRowCount = current?.selectedRowCount ?? 0
  const selectedColumnCount = current?.selectedColumnCount ?? 0
  const styleDisabled = !hasCell || !current?.canStyle
  const run = (pick: (actions: ExcelActions) => void) => () => pick(viewerCommands.getActions())
  const colorItems = (setColor: (actions: ExcelActions, hexColor: string | null) => void): MenuEntry[] => [
    ...COLOR_CHOICES.map(({ hexColor, nameKey }) => ({ id: hexColor.toLowerCase(), label: text(nameKey), swatch: hexColor, onSelect: run((actions) => setColor(actions, hexColor)) })),
    'separator',
    { id: 'none', label: text('excel.toolbar.colorNone'), onSelect: run((actions) => setColor(actions, null)) },
  ]
  return [
    {
      id: 'edit',
      label: text('menu.edit'),
      items: [
        { id: 'find', label: text('menu.findReplace'), icon: 'search', onSelect: viewerCommands.toggleFindReplace },
        'separator',
        { id: 'clear-cells', label: text('excel.menu.clearCells'), isDisabled: !hasCell, onSelect: run((actions) => actions.clearCells()) },
        { id: 'fill-down', label: text('excel.menu.fillDown'), isDisabled: !hasCell || selectedRowCount < 2, onSelect: run((actions) => actions.fillDown()) },
        { id: 'fill-right', label: text('excel.menu.fillRight'), isDisabled: !hasCell || selectedColumnCount < 2, onSelect: run((actions) => actions.fillRight()) },
      ],
    },
    {
      id: 'insert',
      label: text('menu.insert'),
      items: [
        { id: 'row-above', label: text('excel.menu.insertRowAbove'), isDisabled: !hasCell, onSelect: run((actions) => actions.insertRows('above')) },
        { id: 'row-below', label: text('excel.menu.insertRowBelow'), isDisabled: !hasCell, onSelect: run((actions) => actions.insertRows('below')) },
        { id: 'column-left', label: text('excel.menu.insertColumnLeft'), isDisabled: !hasCell, onSelect: run((actions) => actions.insertColumns('left')) },
        { id: 'column-right', label: text('excel.menu.insertColumnRight'), isDisabled: !hasCell, onSelect: run((actions) => actions.insertColumns('right')) },
        'separator',
        { id: 'sheet', label: text('excel.menu.addSheet'), icon: 'plus', onSelect: run((actions) => actions.openAddSheet()) },
        { id: 'link', label: text('excel.toolbar.insertOrEditLink'), isDisabled: !hasCell, onSelect: run((actions) => actions.openLink()) },
      ],
    },
    {
      id: 'format',
      label: text('menu.format'),
      items: [
        {
          id: 'number-format',
          label: text('excel.menu.numberFormat'),
          isDisabled: !hasCell,
          items: NUMBER_FORMATS.map(({ labelKey, format }) => ({ id: idFromKey(labelKey, 'excel.menu.num'), label: text(labelKey), onSelect: run((actions) => actions.setNumberFormat(format)) })),
        },
        {
          id: 'currency',
          label: text('excel.toolbar.formatAsCurrency'),
          isDisabled: !hasCell,
          items: CURRENCIES.map((currency) => ({ id: idFromKey(currency.labelKey, 'excel.menu.currency'), label: text(currency.labelKey), onSelect: run((actions) => actions.setNumberFormat(currencyFormat(currency))) })),
        },
        { id: 'percent', label: text('excel.toolbar.formatAsPercent'), isDisabled: !hasCell, onSelect: run((actions) => actions.setNumberFormat('0.00%')) },
        { id: 'fewer-decimals', label: text('excel.toolbar.fewerDecimals'), isDisabled: !hasCell, onSelect: run((actions) => actions.changeDecimals(-1)) },
        { id: 'more-decimals', label: text('excel.toolbar.moreDecimals'), isDisabled: !hasCell, onSelect: run((actions) => actions.changeDecimals(1)) },
        'separator',
        { id: 'bold', label: text('excel.toolbar.bold'), kind: 'checkbox', isChecked: current?.isBold, isDisabled: styleDisabled, onSelect: run((actions) => actions.toggleBold()) },
        { id: 'italic', label: text('excel.toolbar.italic'), kind: 'checkbox', isChecked: current?.isItalic, isDisabled: styleDisabled, onSelect: run((actions) => actions.toggleItalic()) },
        { id: 'underline', label: text('excel.toolbar.underline'), kind: 'checkbox', isChecked: current?.isUnderlined, isDisabled: styleDisabled, onSelect: run((actions) => actions.toggleUnderline()) },
        { id: 'strikethrough', label: text('excel.toolbar.strikethrough'), kind: 'checkbox', isChecked: current?.isStruckThrough, isDisabled: styleDisabled, onSelect: run((actions) => actions.toggleStrikethrough()) },
        { id: 'font', label: text('excel.toolbar.font'), isDisabled: styleDisabled, items: FONT_FAMILIES.map((fontName) => ({ id: toElementId(fontName, true), label: fontName, onSelect: run((actions) => actions.setFontFamily(fontName)) })) },
        { id: 'font-size', label: text('excel.toolbar.fontSize'), isDisabled: styleDisabled, items: FONT_SIZES.map((size) => ({ id: `size-${size}`, label: String(size), onSelect: run((actions) => actions.setFontSize(size)) })) },
        { id: 'text-colour', label: text('excel.toolbar.textColour'), isDisabled: styleDisabled, items: colorItems((actions, hexColor) => actions.setTextColor(hexColor)) },
        { id: 'fill-colour', label: text('excel.toolbar.fillColour'), isDisabled: styleDisabled, items: colorItems((actions, hexColor) => actions.setFillColor(hexColor)) },
        'separator',
        { id: 'align-left', label: text('excel.toolbar.alignLeft'), kind: 'radio', isChecked: current?.alignment === 'left', isDisabled: styleDisabled, onSelect: run((actions) => actions.setAlignment('left')) },
        { id: 'align-center', label: text('excel.toolbar.alignCenter'), kind: 'radio', isChecked: current?.alignment === 'center', isDisabled: styleDisabled, onSelect: run((actions) => actions.setAlignment('center')) },
        { id: 'align-right', label: text('excel.toolbar.alignRight'), kind: 'radio', isChecked: current?.alignment === 'right', isDisabled: styleDisabled, onSelect: run((actions) => actions.setAlignment('right')) },
        { id: 'decrease-indent', label: text('excel.toolbar.decreaseIndent'), isDisabled: styleDisabled, onSelect: run((actions) => actions.changeIndent(-1)) },
        { id: 'increase-indent', label: text('excel.toolbar.increaseIndent'), isDisabled: styleDisabled, onSelect: run((actions) => actions.changeIndent(1)) },
        { id: 'borders', label: text('excel.toolbar.borders'), isDisabled: styleDisabled, items: BORDER_CHOICES.map(({ side, labelKey }) => ({ id: side, label: text(labelKey), onSelect: run((actions) => actions.setBorders(side)) })) },
        'separator',
        { id: 'merge', label: text(current?.isMerged ? 'excel.toolbar.unmergeCells' : 'excel.toolbar.mergeCells'), isDisabled: !hasCell, onSelect: run((actions) => actions.toggleMerge()) },
        { id: 'column-width', label: text('excel.menu.columnWidth'), isDisabled: !hasCell, onSelect: run((actions) => actions.openColumnWidth()) },
        { id: 'clear-formatting', label: text('excel.toolbar.clearFormatting'), isDisabled: styleDisabled, onSelect: run((actions) => actions.clearFormatting()) },
        ...(current && !current.canStyle ? [{ id: 'menu-styles-note', note: text('excel.menu.stylesXlsxOnly') }] : []),
      ],
    },
    {
      id: 'data',
      label: text('menu.data'),
      items: [
        { id: 'upper', label: text('excel.menu.upperCase'), isDisabled: !hasCell, onSelect: run((actions) => actions.transformText('upper')) },
        { id: 'lower', label: text('excel.menu.lowerCase'), isDisabled: !hasCell, onSelect: run((actions) => actions.transformText('lower')) },
        { id: 'capitalize', label: text('excel.menu.capitalizeEachWord'), isDisabled: !hasCell, onSelect: run((actions) => actions.transformText('capitalize')) },
        { id: 'trim', label: text('excel.menu.trimExtraSpaces'), isDisabled: !hasCell, onSelect: run((actions) => actions.transformText('trim')) },
        'separator',
        { id: 'clear-rows', label: translatePlural(locale, 'excel.menu.clearRows', selectedRowCount), isDisabled: !hasCell, onSelect: run((actions) => actions.clearRows()) },
        { id: 'clear-columns', label: translatePlural(locale, 'excel.menu.clearColumns', selectedColumnCount), isDisabled: !hasCell, onSelect: run((actions) => actions.clearColumns()) },
        { id: 'delete-rows', label: translatePlural(locale, 'excel.menu.deleteRows', selectedRowCount), isDanger: true, isDisabled: !selectedRowCount, onSelect: run((actions) => actions.deleteRows()) },
        { id: 'delete-columns', label: translatePlural(locale, 'excel.menu.deleteColumns', selectedColumnCount), isDanger: true, isDisabled: !selectedColumnCount, onSelect: run((actions) => actions.deleteColumns()) },
      ],
    },
    {
      id: 'sheets',
      label: text('excel.toolbar.sheets'),
      items: [
        { id: 'add-sheet', label: text('excel.menu.addSheet'), icon: 'plus', onSelect: run((actions) => actions.openAddSheet()) },
        { id: 'rename-sheet', label: text('excel.menu.renameSheet'), onSelect: run((actions) => actions.openRenameSheet()) },
        { id: 'move-sheet-left', label: text('excel.menu.moveSheetLeft'), onSelect: run((actions) => actions.moveSheet(-1)) },
        { id: 'move-sheet-right', label: text('excel.menu.moveSheetRight'), onSelect: run((actions) => actions.moveSheet(1)) },
        'separator',
        { id: 'delete-sheet', label: text('excel.menu.deleteSheet'), isDanger: true, isDisabled: !current?.canDeleteSheet, onSelect: run((actions) => actions.openDeleteSheet()) },
      ],
    },
  ]
}

export type ExcelEditingComponents = {
  EditBar: typeof EditBar
  CellInput: typeof CellInput
  FindReplaceBar: typeof FindReplaceBar
  ColumnMenu: typeof ColumnMenu
  SheetDialogs: typeof SheetDialogs
}

export const excelEditingModule: EditingModule = {
  tools,
  downloadOption,
  describeDownload,
  getDefaultByteOrderMark: () => false,
  ToolbarContent: MenuBarTools,
  getMenus: buildExcelMenus,
  components: { EditBar, CellInput, FindReplaceBar, ColumnMenu, SheetDialogs } satisfies ExcelEditingComponents,
}
