// This module is fetched on demand, not hot-reloaded as a component file, so the fast-refresh rule does not apply.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { FocusEventHandler, KeyboardEventHandler, ReactNode } from 'react'
import { compactSecondaryButtonClassName, primaryButtonClassName, textControlClassName } from '../../buttonStyles'
import { toElementId } from '../../elementId'
import { isolateText, translate, useT } from '../../i18n'
import type { Locale, MessageKey } from '../../i18n'
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

// The English text of a menu item that names a count ("Delete 3 rows"): its element id is made from it, so ids stay the same in every language.
const countedItemId = (verb: string, count: number, noun: string) => toElementId(`${verb} ${count.toLocaleString('en')} ${noun}${count === 1 ? '' : 's'}`, true)

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

// Like a Google Sheets toolbar: icon buttons for number format, text style, colours, alignment and merge, then icon menus for
// rows, columns, cells and sheets. All of it sits in the page's edit toolbar row, after Undo and Redo.
function ToolbarMenus({ selection, commands }: { selection: unknown; commands: unknown }) {
  const { t, tp, idFor } = useT()
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
      <IconMenuButton
        id={toolbarId('excel.toolbar.moreNumberFormats')}
        label={t('excel.toolbar.moreNumberFormats')}
        isDisabled={!hasSelection}
        items={NUMBER_FORMATS.map(({ labelKey, format, idSuffix = '' }) => ({ id: `${idFor(labelKey, true)}${idSuffix}`, label: t(labelKey), onSelect: () => getActions().setNumberFormat(format) }))}
      >
        <span className="text-[11px] font-semibold">123</span>
      </IconMenuButton>
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
        id={toolbarId('excel.toolbar.font')}
        label={styledLabel('excel.toolbar.font')}
        isDisabled={styleDisabled}
        items={FONT_FAMILIES.map((fontName) => ({ id: toElementId(fontName, true), label: fontName, onSelect: () => getActions().setFontFamily(fontName) }))}
      >
        <span className="text-[12px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconMenuButton
        id={toolbarId('excel.toolbar.fontSize')}
        label={styledLabel('excel.toolbar.fontSize')}
        isDisabled={styleDisabled}
        items={FONT_SIZES.map((size) => ({ id: String(size), label: String(size), onSelect: () => getActions().setFontSize(size) }))}
      >
        <span className="text-[11px] font-semibold">pt</span>
      </IconMenuButton>
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
      <IconButton id={toolbarId('excel.toolbar.clearFormatting')} label={styledLabel('excel.toolbar.clearFormatting')} isDisabled={styleDisabled} onClick={() => getActions().clearFormatting()}>
        <span className="text-[13px]">
          T<sub className="text-[9px]">x</sub>
        </span>
      </IconButton>
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
      <IconButton id={toolbarId('excel.toolbar.decreaseIndent')} label={styledLabel('excel.toolbar.decreaseIndent')} isDisabled={styleDisabled} onClick={() => getActions().changeIndent(-1)}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m8 9-3 3 3 3" />
        </Icon>
      </IconButton>
      <IconButton id={toolbarId('excel.toolbar.increaseIndent')} label={styledLabel('excel.toolbar.increaseIndent')} isDisabled={styleDisabled} onClick={() => getActions().changeIndent(1)}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m5 9 3 3-3 3" />
        </Icon>
      </IconButton>
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
      {divider}
      <IconMenuButton
        id={toolbarId('excel.toolbar.rows')}
        label={t('excel.toolbar.rows')}
        items={[
          { id: idFor('excel.menu.insertRowAbove', true), label: t('excel.menu.insertRowAbove'), onSelect: () => getActions().insertRows('above') },
          { id: idFor('excel.menu.insertRowBelow', true), label: t('excel.menu.insertRowBelow'), onSelect: () => getActions().insertRows('below') },
          { id: countedItemId('Delete', selectedRowCount, 'row'), label: tp('excel.menu.deleteRows', selectedRowCount), onSelect: () => getActions().deleteRows(), isDisabled: !hasSelection },
          { id: countedItemId('Clear', selectedRowCount, 'row'), label: tp('excel.menu.clearRows', selectedRowCount), onSelect: () => getActions().clearRows(), isDisabled: !hasSelection },
        ]}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 10h18" />
          <path d="M3 15h18" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id={toolbarId('excel.toolbar.columns')}
        label={t('excel.toolbar.columns')}
        items={[
          { id: idFor('excel.menu.insertColumnLeft', true), label: t('excel.menu.insertColumnLeft'), onSelect: () => getActions().insertColumns('left') },
          { id: idFor('excel.menu.insertColumnRight', true), label: t('excel.menu.insertColumnRight'), onSelect: () => getActions().insertColumns('right') },
          { id: countedItemId('Delete', selectedColumnCount, 'column'), label: tp('excel.menu.deleteColumns', selectedColumnCount), onSelect: () => getActions().deleteColumns(), isDisabled: !hasSelection },
          { id: countedItemId('Clear', selectedColumnCount, 'column'), label: tp('excel.menu.clearColumns', selectedColumnCount), onSelect: () => getActions().clearColumns(), isDisabled: !hasSelection },
          { id: idFor('excel.menu.columnWidth', true), label: t('excel.menu.columnWidth'), onSelect: () => getActions().openColumnWidth(), isDisabled: !hasSelection },
        ]}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M9 4v16" />
          <path d="M15 4v16" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id={toolbarId('excel.toolbar.cells')}
        label={t('excel.toolbar.cells')}
        items={[
          { id: idFor('excel.menu.clearCells', true), label: t('excel.menu.clearCells'), onSelect: () => getActions().clearCells(), isDisabled: !hasSelection },
          { id: idFor('excel.menu.fillDown', true), label: t('excel.menu.fillDown'), onSelect: () => getActions().fillDown(), isDisabled: !hasSelection || selectedRowCount < 2 },
          { id: idFor('excel.menu.fillRight', true), label: t('excel.menu.fillRight'), onSelect: () => getActions().fillRight(), isDisabled: !hasSelection || selectedColumnCount < 2 },
        ]}
      >
        <Icon>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M12 4v16" />
          <path d="M4 12h16" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id={toolbarId('excel.toolbar.cleanUpText')}
        label={t('excel.toolbar.cleanUpText')}
        isDisabled={!hasSelection}
        items={[
          { id: idFor('excel.menu.upperCase', true), label: t('excel.menu.upperCase'), onSelect: () => getActions().transformText('upper') },
          { id: idFor('excel.menu.lowerCase', true), label: t('excel.menu.lowerCase'), onSelect: () => getActions().transformText('lower') },
          { id: idFor('excel.menu.capitalizeEachWord', true), label: t('excel.menu.capitalizeEachWord'), onSelect: () => getActions().transformText('capitalize') },
          { id: idFor('excel.menu.trimExtraSpaces', true), label: t('excel.menu.trimExtraSpaces'), onSelect: () => getActions().transformText('trim') },
        ]}
      >
        <span className="text-[11px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconButton id={toolbarId('excel.toolbar.insertOrEditLink')} label={t('excel.toolbar.insertOrEditLink')} isDisabled={!hasSelection} onClick={() => getActions().openLink()}>
        <Icon>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
        </Icon>
      </IconButton>
      <IconMenuButton
        id={toolbarId('excel.toolbar.sheets')}
        label={t('excel.toolbar.sheets')}
        items={[
          { id: idFor('excel.menu.addSheet', true), label: t('excel.menu.addSheet'), onSelect: () => getActions().openAddSheet() },
          { id: idFor('excel.menu.renameSheet', true), label: t('excel.menu.renameSheet'), onSelect: () => getActions().openRenameSheet() },
          { id: idFor('excel.menu.moveSheetLeft', true), label: t('excel.menu.moveSheetLeft'), onSelect: () => getActions().moveSheet(-1) },
          { id: idFor('excel.menu.moveSheetRight', true), label: t('excel.menu.moveSheetRight'), onSelect: () => getActions().moveSheet(1) },
          { id: idFor('excel.menu.deleteSheet', true), label: t('excel.menu.deleteSheet'), onSelect: () => getActions().openDeleteSheet(), isDisabled: !canDeleteSheet },
        ]}
      >
        <Icon>
          <rect x="8" y="3" width="13" height="13" rx="1" />
          <path d="M5 8H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-1" />
        </Icon>
      </IconMenuButton>
      <IconButton id={toolbarId('find.label')} label={t('find.label')} onClick={() => (commands as ExcelViewerCommands).toggleFindReplace()}>
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
    <ModalDialog title={t(titleKey)} id={`dialog-${idFor(titleKey)}`} onClose={onClose} widthClassName="w-[min(26rem,calc(100vw-2rem))]">
      <form
        id="sheet-dialog-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="mt-3 space-y-3"
      >
        {dialog.kind === 'delete-sheet' ? (
          <p>{t('excel.toolbar.deleteSheetConfirm', { name: isolateText(activeSheetName) })}</p>
        ) : (
          <label htmlFor="dialog-input" className="block">
            <span className="text-sm text-ink-soft">{dialog.kind === 'column-width' ? t('excel.toolbar.widthLabel') : dialog.kind === 'link' ? t('excel.toolbar.linkLabel') : t('excel.toolbar.sheetNameLabel')}</span>
            <input
              id="dialog-input"
              autoFocus
              dir={dialog.kind === 'column-width' || dialog.kind === 'link' ? 'ltr' : 'auto'}
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
            {t('excel.toolbar.dialogCancel')}
          </button>
          <button id="dialog-submit-button" type="submit" disabled={problem !== null} className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}>
            {t(dialog.kind === 'delete-sheet' ? 'excel.toolbar.dialogDelete' : dialog.kind === 'add-sheet' ? 'excel.toolbar.dialogAdd' : 'excel.toolbar.dialogSave')}
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
