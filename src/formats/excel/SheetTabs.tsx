import type { KeyboardEvent } from 'react'
import { useT } from '../../i18n'
import type { SheetRecord } from './excelModel'

type SheetTabsProps = {
  sheets: readonly SheetRecord[]
  activeSheetId: number
  // Edit mode adds the "+" button and lets a double-click rename the sheet.
  isEditable: boolean
  onSelect: (sheetId: number) => void
  onAdd: () => void
  onRename: () => void
}

// The sheet names at the bottom of the workbook, like Excel's. The arrow keys move between tabs.
export default function SheetTabs({ sheets, activeSheetId, isEditable, onSelect, onAdd, onRename }: SheetTabsProps) {
  const { t } = useT()

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
    </div>
  )
}
