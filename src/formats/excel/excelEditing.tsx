// This module is fetched on demand, not hot-reloaded as a component file, so the fast-refresh rule does not apply.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { FocusEventHandler, KeyboardEventHandler, ReactNode } from 'react'
import { compactSecondaryButtonClassName, primaryButtonClassName, textControlClassName } from '../../buttonStyles'
import { toElementId } from '../../elementId'
import FindReplaceBar from '../../components/FindReplaceBar'
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
  getLabel: () => 'Save workbook',
  extension: null,
  getMimeType: (exportSource) => FILE_MIME_TYPE_BY_BOOK_TYPE[(exportSource as ExcelExportSource).parsed.bookType] ?? 'application/octet-stream',
  createFile: (edits, exportSource) => writeWorkbookFile((exportSource as ExcelExportSource).parsed, edits as ExcelEdits),
}

const describeDownload = () => 'all sheets, with your edits'

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

const NUMBER_FORMATS = [
  { label: 'General', format: 'General' },
  { label: 'Text', format: '@' },
  { label: 'Number (1,234.50)', format: '#,##0.00' },
  { label: 'Number, no decimals (1,235)', format: '#,##0' },
  { label: 'Percentage (12.50%)', format: '0.00%' },
  { label: 'Scientific (1.23E+03)', format: '0.00E+00' },
  { label: 'Accounting (1,234.50)', format: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)' },
  { label: 'Date (2026-03-15)', format: 'yyyy-mm-dd' },
  { label: 'Date (15/03/2026)', format: 'dd/mm/yyyy' },
  { label: 'Date (03/15/2026)', format: 'mm/dd/yyyy' },
  { label: 'Date (15 Mar 2026)', format: 'd mmm yyyy' },
  { label: 'Time (13:45:00)', format: 'hh:mm:ss' },
  { label: 'Date and time', format: 'yyyy-mm-dd hh:mm' },
]

// Currencies for the toolbar's currency menu: the symbol or code written before the number, and the decimals that currency uses.
const CURRENCIES = [
  { label: 'Saudi riyal (SAR)', prefix: 'SAR ', decimals: 2 },
  { label: 'Pakistani rupee (PKR)', prefix: 'Rs ', decimals: 2 },
  { label: 'US dollar ($)', prefix: '$', decimals: 2 },
  { label: 'UAE dirham (AED)', prefix: 'AED ', decimals: 2 },
  { label: 'Euro (€)', prefix: '€', decimals: 2 },
  { label: 'British pound (£)', prefix: '£', decimals: 2 },
  { label: 'Indian rupee (₹)', prefix: '₹', decimals: 2 },
  { label: 'Kuwaiti dinar (KWD)', prefix: 'KWD ', decimals: 3 },
  { label: 'Qatari riyal (QAR)', prefix: 'QAR ', decimals: 2 },
  { label: 'Egyptian pound (EGP)', prefix: 'EGP ', decimals: 2 },
  { label: 'Turkish lira (₺)', prefix: '₺', decimals: 2 },
  { label: 'Chinese yuan (CNY)', prefix: 'CN¥', decimals: 2 },
  { label: 'Japanese yen (¥)', prefix: '¥', decimals: 0 },
  { label: 'Canadian dollar (CAD)', prefix: 'CA$', decimals: 2 },
  { label: 'Australian dollar (AUD)', prefix: 'A$', decimals: 2 },
  { label: 'Swiss franc (CHF)', prefix: 'CHF ', decimals: 2 },
]

function currencyFormat({ prefix, decimals }: (typeof CURRENCIES)[number]) {
  return `"${prefix}"#,##0${decimals > 0 ? `.${'0'.repeat(decimals)}` : ''}`
}

const pluralize = (count: number, singular: string) => `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`

// ---------------------------------------------------------------- menus

const COLOR_CHOICES = ['000000', '595959', 'A6A6A6', 'FFFFFF', 'FF0000', 'FF9900', 'FFFF00', '00B050', '0070C0', '7030A0']

// A button that opens a small grid of colours (and "None"), for text and fill colour.
function ColorMenuButton({ label, isDisabled, currentColor, onPick, children }: { label: string; isDisabled: boolean; currentColor: string; onPick: (hexColor: string | null) => void; children: ReactNode }) {
  const buttonId = `toolbar-${toElementId(label)}`
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
          style={menuPosition}
          className="box-shape solid-box fixed m-0 w-44 border-rule bg-paper-raised p-2 text-ink"
        >
          <div className="grid grid-cols-5 gap-1.5">
            {COLOR_CHOICES.map((hexColor) => (
              <button
                key={hexColor}
                id={`${buttonId}-menu-${hexColor}`}
                type="button"
                role="menuitem"
                aria-label={`#${hexColor}`}
                title={`#${hexColor}`}
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
            None
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

// Like a Google Sheets toolbar: icon buttons for number format, text style, colours, alignment and merge, then icon menus for
// rows, columns, cells and sheets. All of it sits in the page's edit toolbar row, after Undo and Redo.
function ToolbarMenus({ selection, commands }: { selection: unknown; commands: unknown }) {
  const { hasCell, selectedRowCount, selectedColumnCount, canDeleteSheet, canStyle, isBold, isItalic, isUnderlined, isStruckThrough, alignment, isMerged } =
    (selection as NonNullable<ExcelSelection> | null) ?? {
      hasCell: false,
      selectedRowCount: 0,
      selectedColumnCount: 0,
      canDeleteSheet: false,
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
  const styleHint = canStyle ? '' : ' (styles can be changed in .xlsx files)'
  const rowNoun = pluralize(selectedRowCount, 'row')
  const columnNoun = pluralize(selectedColumnCount, 'column')
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  return (
    <>
      {divider}
      <IconMenuButton
        label="Format as currency"
        isDisabled={!hasSelection}
        items={CURRENCIES.map((currency) => ({ label: currency.label, onSelect: () => getActions().setNumberFormat(currencyFormat(currency)) }))}
      >
        <span>$</span>
      </IconMenuButton>
      <IconButton label="Format as percent" isDisabled={!hasSelection} onClick={() => getActions().setNumberFormat('0.00%')}>
        %
      </IconButton>
      <IconButton label="Fewer decimal places" isDisabled={!hasSelection} onClick={() => getActions().changeDecimals(-1)}>
        <span className="text-[11px] font-semibold">.0←</span>
      </IconButton>
      <IconButton label="More decimal places" isDisabled={!hasSelection} onClick={() => getActions().changeDecimals(1)}>
        <span className="text-[11px] font-semibold">.00→</span>
      </IconButton>
      <IconMenuButton
        label="More number formats"
        isDisabled={!hasSelection}
        items={NUMBER_FORMATS.map(({ label, format }) => ({ label, onSelect: () => getActions().setNumberFormat(format) }))}
      >
        <span className="text-[11px] font-semibold">123</span>
      </IconMenuButton>
      {divider}
      <IconButton label={`Bold${styleHint}`} isPressed={isBold} isDisabled={styleDisabled} onClick={() => getActions().toggleBold()}>
        <span className="font-bold">B</span>
      </IconButton>
      <IconButton label={`Italic${styleHint}`} isPressed={isItalic} isDisabled={styleDisabled} onClick={() => getActions().toggleItalic()}>
        <span className="font-serif italic">I</span>
      </IconButton>
      <IconButton label={`Underline${styleHint}`} isPressed={isUnderlined} isDisabled={styleDisabled} onClick={() => getActions().toggleUnderline()}>
        <span className="underline">U</span>
      </IconButton>
      <IconButton label={`Strikethrough${styleHint}`} isPressed={isStruckThrough} isDisabled={styleDisabled} onClick={() => getActions().toggleStrikethrough()}>
        <span className="line-through">S</span>
      </IconButton>
      <ColorMenuButton label={`Text colour${styleHint}`} isDisabled={styleDisabled} currentColor="#d93025" onPick={(hexColor) => getActions().setTextColor(hexColor)}>
        <span className="font-semibold">A</span>
      </ColorMenuButton>
      <ColorMenuButton label={`Fill colour${styleHint}`} isDisabled={styleDisabled} currentColor="#fbbc04" onPick={(hexColor) => getActions().setFillColor(hexColor)}>
        <Icon>
          <path d="m5 12 7-7 7 7-7 7-7-7Z" />
          <path d="M20 16c0 1.5-1 2.5-1 2.5s-1-1-1-2.5a1 1 0 0 1 2 0Z" />
        </Icon>
      </ColorMenuButton>
      <IconMenuButton label={`Font${styleHint}`} isDisabled={styleDisabled} items={FONT_FAMILIES.map((fontName) => ({ label: fontName, onSelect: () => getActions().setFontFamily(fontName) }))}>
        <span className="text-[12px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconMenuButton label={`Font size${styleHint}`} isDisabled={styleDisabled} items={FONT_SIZES.map((size) => ({ label: String(size), onSelect: () => getActions().setFontSize(size) }))}>
        <span className="text-[11px] font-semibold">pt</span>
      </IconMenuButton>
      <IconMenuButton
        label={`Borders${styleHint}`}
        isDisabled={styleDisabled}
        items={[
          { label: 'All borders', onSelect: () => getActions().setBorders('all') },
          { label: 'Outer borders', onSelect: () => getActions().setBorders('outer') },
          { label: 'Top border', onSelect: () => getActions().setBorders('top') },
          { label: 'Bottom border', onSelect: () => getActions().setBorders('bottom') },
          { label: 'Left border', onSelect: () => getActions().setBorders('left') },
          { label: 'Right border', onSelect: () => getActions().setBorders('right') },
          { label: 'No borders', onSelect: () => getActions().setBorders('none') },
        ]}
      >
        <Icon>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M12 4v16" strokeDasharray="2 2" />
          <path d="M4 12h16" strokeDasharray="2 2" />
        </Icon>
      </IconMenuButton>
      <IconButton label={`Clear formatting${styleHint}`} isDisabled={styleDisabled} onClick={() => getActions().clearFormatting()}>
        <span className="text-[13px]">
          T<sub className="text-[9px]">x</sub>
        </span>
      </IconButton>
      {divider}
      {(['left', 'center', 'right'] as const).map((side) => (
        <IconButton key={side} label={`Align ${side}${styleHint}`} isPressed={alignment === side} isDisabled={styleDisabled} onClick={() => getActions().setAlignment(side)}>
          <AlignIcon alignment={side} />
        </IconButton>
      ))}
      <IconButton label={`Decrease indent${styleHint}`} isDisabled={styleDisabled} onClick={() => getActions().changeIndent(-1)}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m8 9-3 3 3 3" />
        </Icon>
      </IconButton>
      <IconButton label={`Increase indent${styleHint}`} isDisabled={styleDisabled} onClick={() => getActions().changeIndent(1)}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m5 9 3 3-3 3" />
        </Icon>
      </IconButton>
      <IconButton id="toolbar-merge-cells" label={isMerged ? 'Unmerge cells' : 'Merge cells'} isPressed={isMerged} isDisabled={!hasSelection} onClick={() => getActions().toggleMerge()}>
        <Icon>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="M8 12h8" />
          <path d="m10 9-2 3 2 3" />
          <path d="m14 9 2 3-2 3" />
        </Icon>
      </IconButton>
      {divider}
      <IconMenuButton
        label="Rows"
        items={[
          { label: 'Insert row above', onSelect: () => getActions().insertRows('above') },
          { label: 'Insert row below', onSelect: () => getActions().insertRows('below') },
          { label: `Delete ${rowNoun}`, onSelect: () => getActions().deleteRows(), isDisabled: !hasSelection },
          { label: `Clear ${rowNoun}`, onSelect: () => getActions().clearRows(), isDisabled: !hasSelection },
        ]}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 10h18" />
          <path d="M3 15h18" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        label="Columns"
        items={[
          { label: 'Insert column left', onSelect: () => getActions().insertColumns('left') },
          { label: 'Insert column right', onSelect: () => getActions().insertColumns('right') },
          { label: `Delete ${columnNoun}`, onSelect: () => getActions().deleteColumns(), isDisabled: !hasSelection },
          { label: `Clear ${columnNoun}`, onSelect: () => getActions().clearColumns(), isDisabled: !hasSelection },
          { label: 'Column width', onSelect: () => getActions().openColumnWidth(), isDisabled: !hasSelection },
        ]}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M9 4v16" />
          <path d="M15 4v16" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        label="Cells"
        items={[
          { label: 'Clear cells', onSelect: () => getActions().clearCells(), isDisabled: !hasSelection },
          { label: 'Fill down', onSelect: () => getActions().fillDown(), isDisabled: !hasSelection || selectedRowCount < 2 },
          { label: 'Fill right', onSelect: () => getActions().fillRight(), isDisabled: !hasSelection || selectedColumnCount < 2 },
        ]}
      >
        <Icon>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M12 4v16" />
          <path d="M4 12h16" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        label="Clean up text"
        isDisabled={!hasSelection}
        items={[
          { label: 'UPPERCASE', onSelect: () => getActions().transformText('upper') },
          { label: 'lowercase', onSelect: () => getActions().transformText('lower') },
          { label: 'Capitalize Each Word', onSelect: () => getActions().transformText('capitalize') },
          { label: 'Trim extra spaces', onSelect: () => getActions().transformText('trim') },
        ]}
      >
        <span className="text-[11px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconButton label="Insert or edit link" isDisabled={!hasSelection} onClick={() => getActions().openLink()}>
        <Icon>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
        </Icon>
      </IconButton>
      <IconMenuButton
        label="Sheets"
        items={[
          { label: 'Add sheet', onSelect: () => getActions().openAddSheet() },
          { label: 'Rename sheet', onSelect: () => getActions().openRenameSheet() },
          { label: 'Move sheet left', onSelect: () => getActions().moveSheet(-1) },
          { label: 'Move sheet right', onSelect: () => getActions().moveSheet(1) },
          { label: 'Delete sheet', onSelect: () => getActions().openDeleteSheet(), isDisabled: !canDeleteSheet },
        ]}
      >
        <Icon>
          <rect x="8" y="3" width="13" height="13" rx="1" />
          <path d="M5 8H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-1" />
        </Icon>
      </IconMenuButton>
      <IconButton label="Find and replace" onClick={() => (commands as ExcelViewerCommands).toggleFindReplace()}>
        <Icon>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.5-4.5" />
        </Icon>
      </IconButton>
      {divider}
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
  return (
    <ActionMenu
      id="column-actions-menu"
      ariaLabel="Column actions"
      left={left}
      top={top}
      onClose={onClose}
      items={[
        { label: 'Rename column', onSelect: onRename, isDisabled: !canRename },
        { label: 'Select column', onSelect },
        { label: 'Insert column left', onSelect: onInsertLeft },
        { label: 'Insert column right', onSelect: onInsertRight },
        { label: 'Clear column', onSelect: onClear },
        { label: 'Column width', onSelect: onWidth },
        { label: 'Delete column', onSelect: onDelete, isDisabled: !canDelete },
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
  return (
    <>
      <p
        id="selected-cell-label"
        aria-label="Selected cell"
        className="control-shape solid-box flex min-h-8 pointer-coarse:min-h-11 min-w-16 shrink-0 items-center justify-center border-rule bg-paper-raised px-3 font-mono text-sm"
      >
        {selectedCellLabel}
      </p>
      <input
        id="cell-value-input"
        dir="auto"
        aria-label="Value or formula of the selected cell"
        placeholder="Select a cell, then type a value or a formula starting with ="
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
  const [draft, setDraft] = useState(
    dialog.kind === 'add-sheet' ? suggestedSheetName : dialog.kind === 'rename-sheet' ? activeSheetName : dialog.kind === 'link' ? currentLink : String(Math.round(currentColumnWidthPx)),
  )
  const otherNames = dialog.kind === 'rename-sheet' ? sheetNames.filter((name) => name !== activeSheetName) : sheetNames
  const widthPx = Number(draft)
  const problem =
    dialog.kind === 'column-width'
      ? Number.isFinite(widthPx) && widthPx >= MIN_COLUMN_WIDTH_PX && widthPx <= MAX_COLUMN_WIDTH_PX
        ? null
        : `Type a width between ${MIN_COLUMN_WIDTH_PX} and ${MAX_COLUMN_WIDTH_PX} pixels.`
      : dialog.kind === 'delete-sheet' || dialog.kind === 'link'
        ? null
        : validateSheetName(draft, otherNames)

  const titles = { 'add-sheet': 'Add sheet', 'rename-sheet': 'Rename sheet', 'delete-sheet': 'Delete sheet', 'column-width': 'Column width', link: 'Link' }

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
    <ModalDialog title={titles[dialog.kind]} onClose={onClose} widthClassName="w-[min(26rem,calc(100vw-2rem))]">
      <form
        id="sheet-dialog-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="mt-3 space-y-3"
      >
        {dialog.kind === 'delete-sheet' ? (
          <p>
            Delete the sheet "{activeSheetName}" and everything in it? You can undo this until you leave the page.
          </p>
        ) : (
          <label htmlFor="dialog-input" className="block">
            <span className="text-sm text-ink-soft">{dialog.kind === 'column-width' ? 'Width in pixels' : dialog.kind === 'link' ? 'Web address (leave empty to remove the link)' : 'Sheet name'}</span>
            <input
              id="dialog-input"
              autoFocus
              dir="auto"
              inputMode={dialog.kind === 'column-width' ? 'numeric' : dialog.kind === 'link' ? 'url' : undefined}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-invalid={problem !== null}
              className={`${textControlClassName} mt-1 w-full`}
            />
          </label>
        )}
        {problem && draft !== '' && (
          <p id="dialog-error" role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button id="dialog-cancel-button" type="button" onClick={onClose} className={compactSecondaryButtonClassName}>
            Cancel
          </button>
          <button id="dialog-submit-button" type="submit" disabled={problem !== null} className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}>
            {dialog.kind === 'delete-sheet' ? 'Delete' : dialog.kind === 'add-sheet' ? 'Add' : 'Save'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
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
  ToolbarContent: ToolbarMenus,
  components: { EditBar, CellInput, FindReplaceBar, ColumnMenu, SheetDialogs } satisfies ExcelEditingComponents,
}
