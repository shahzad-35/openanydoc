import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useT } from '../../i18n'
import type { SheetRecord, SheetVisibility } from './excelModel'

type SheetTabsProps = {
  sheets: readonly SheetRecord[]
  // Sheets the file hides that have no tab yet; listed under a "hidden" button, and given a tab when chosen.
  hiddenSheets: readonly (SheetRecord & { visibility: SheetVisibility })[]
  activeSheetId: number
  // Edit mode adds the "+" button and lets a double-click rename the sheet.
  isEditable: boolean
  onSelect: (sheetId: number) => void
  onShowHiddenSheet: (sheetId: number) => void
  onAdd: () => void
  onRename: () => void
}

// The sheet names at the bottom of the workbook, like Excel's. The arrow keys move between tabs.
export default function SheetTabs({ sheets, hiddenSheets, activeSheetId, isEditable, onSelect, onShowHiddenSheet, onAdd, onRename }: SheetTabsProps) {
  const { t, tp } = useT()
  const [isHiddenListOpen, setIsHiddenListOpen] = useState(false)

  function moveBetweenTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const activePosition = sheets.findIndex((sheet) => sheet.id === activeSheetId)
    // The tab strip follows the page direction (it reads right to left in Arabic), so the arrow that points forward changes with it.
    const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
    const forwardKey = isRightToLeft ? 'ArrowLeft' : 'ArrowRight'
    const step = event.key === forwardKey ? 1 : -1
    const nextSheet = sheets[(activePosition + step + sheets.length) % sheets.length]
    event.preventDefault()
    onSelect(nextSheet.id)
    requestAnimationFrame(() => event.currentTarget.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
  }

  return (
    <div id="sheet-tabs" className="flex items-center gap-1 overflow-x-auto border-t border-rule bg-paper px-2 pt-1">
      <div id="sheet-tablist" role="tablist" aria-label={t('excel.tabs.label')} onKeyDown={moveBetweenTabs} className="flex items-end gap-1">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId
          return (
            <button
              key={sheet.id}
              id={`sheet-tab-${sheet.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              title={isEditable && isActive ? t('excel.tabs.renameTip') : sheet.name}
              onClick={() => onSelect(sheet.id)}
              onDoubleClick={isEditable && isActive ? onRename : undefined}
              dir="auto"
              className={`min-h-8 pointer-coarse:min-h-11 max-w-48 shrink-0 cursor-pointer truncate border-x border-b-2 px-3 text-[13px] transition-colors duration-200 ${
                isActive
                  ? 'border-x-rule border-b-(--file-color) bg-paper-raised font-semibold text-(--file-color)'
                  : 'border-transparent text-ink-soft hover:bg-paper-raised hover:text-ink'
              }`}
            >
              {sheet.name}
            </button>
          )
        })}
      </div>
      {isEditable && (
        <button
          id="add-sheet-button"
          type="button"
          onClick={onAdd}
          aria-label={t('excel.tabs.add')}
          title={t('excel.tabs.add')}
          className="control-shape grid size-8 pointer-coarse:size-11 shrink-0 cursor-pointer place-items-center text-lg leading-none transition-colors duration-200 hover:bg-paper-raised"
        >
          +
        </button>
      )}
      {hiddenSheets.length > 0 && (
        <div className="hidden-sheets">
          <button id="hidden-sheets-button" type="button" className="btn sm" aria-expanded={isHiddenListOpen} aria-controls="hidden-sheets-list" onClick={() => setIsHiddenListOpen(!isHiddenListOpen)}>
            {tp('excel.tabs.hiddenCount', hiddenSheets.length)}
          </button>
          {isHiddenListOpen && (
            <ul id="hidden-sheets-list" className="hidden-sheets-list">
              {hiddenSheets.map((sheet) => (
                <li key={sheet.id}>
                  <button
                    id={`show-hidden-sheet-${sheet.id}`}
                    type="button"
                    onClick={() => {
                      setIsHiddenListOpen(false)
                      onShowHiddenSheet(sheet.id)
                    }}
                  >
                    <bdi>{sheet.name}</bdi>
                    <span className="excel-result-tag">{sheet.visibility === 'veryHidden' ? t('excel.info.veryHidden') : t('excel.info.hidden')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
