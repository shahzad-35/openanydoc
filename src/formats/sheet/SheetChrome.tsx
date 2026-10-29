/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from 'react'
import { MiniFormatIcon, Wordmark } from '../../components/KitIcon'
import type { MiniFormat } from '../../components/KitIcon'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { ActionMenu } from '../../components/ToolbarControls'
import type { MenuItem } from '../../components/ToolbarControls'
import { useT } from '../../i18n'
import './sheetChrome.css'

// The frame every sheet-like page (CSV, Excel) is built from, laid out like Google Sheets: a title row, the menu bar, one slim
// icon toolbar, the value bar, the grid with a sidebar, a status bar and the sheet tabs. The parts are plain components with
// data in and callbacks out; each format keeps its own state, grid and panel contents. Compact: 28 px controls, 13 px text,
// nothing bold but the file name.

export const PHONE_QUERY = '(max-width: 760px)'

// The icons, drawn once per page and used by name (`<Icon name="filter" />`). Static markup, no file content.
const ICON_SPRITE = `<defs>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/></symbol>
<symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/></symbol>
<symbol id="i-sort" viewBox="0 0 24 24"><path d="M7 4v16"/><path d="m3.5 7.5 3.5-3.5 3.5 3.5"/><path d="M17 20V4"/><path d="m13.5 16.5 3.5 3.5 3.5-3.5"/></symbol>
<symbol id="i-group" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></symbol>
<symbol id="i-columns" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M14.5 4.5v15"/></symbol>
<symbol id="i-wand" viewBox="0 0 24 24"><path d="m4 20 11-11M14 4v2M18 8h2M17 4.5l-1.2 1.2M19.5 11l-1.2-1.2M13 9l2 2"/></symbol>
<symbol id="i-replace" viewBox="0 0 24 24"><path d="M4 7h10l-3-3M20 17H10l3 3"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="17" r="2"/></symbol>
<symbol id="i-goto" viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5"/><path d="M4 5v14"/></symbol>
<symbol id="i-rows" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 5 4.5 9.5 9 14"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/></symbol>
<symbol id="i-redo" viewBox="0 0 24 24"><path d="m15 5 4.5 4.5L15 14"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"/></symbol>
<symbol id="i-open" viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></symbol>
<symbol id="i-warn" viewBox="0 0 24 24"><path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><path d="M12 17h.01"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5v-2A2.5 2.5 0 0 0 13 4H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/></symbol>
<symbol id="i-paste" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="15.5" rx="2"/><path d="M9 5V3.5h6V5"/></symbol>
<symbol id="i-grid-x" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M10 4.5v15"/></symbol>
<symbol id="i-review" viewBox="0 0 24 24"><path d="M5 5h14M5 10h14M5 15h8"/><path d="m15 18 2 2 4-4"/></symbol>
<symbol id="i-grip" viewBox="0 0 10 16"><circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>
<symbol id="i-more" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 19.5h16"/><rect x="5.5" y="11" width="3" height="6" rx=".6"/><rect x="10.5" y="6" width="3" height="11" rx=".6"/><rect x="15.5" y="13" width="3" height="4" rx=".6"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M9 4h6l-1 5 3 3H7l3-3zM12 12v8"/></symbol>
<symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c5 0 8.5 6 8.5 6a15 15 0 0 1-3 3.5M6.6 7.7A15 15 0 0 0 3.5 12S7 18 12 18a8 8 0 0 0 3.4-.8"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></symbol>
<symbol id="i-panel" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></symbol>
<symbol id="i-row-above" viewBox="0 0 24 24"><rect x="3.5" y="11.5" width="17" height="8" rx="1.5"/><path d="M12 3v6M9 6l3-3 3 3"/></symbol>
<symbol id="i-row-below" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="8" rx="1.5"/><path d="M12 15v6M9 18l3 3 3-3"/></symbol>
<symbol id="i-col-left" viewBox="0 0 24 24"><rect x="11.5" y="3.5" width="8" height="17" rx="1.5"/><path d="M3 12h6M6 9l-3 3 3 3"/></symbol>
<symbol id="i-col-right" viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="8" height="17" rx="1.5"/><path d="M15 12h6M18 9l3 3-3 3"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-sheet" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/></symbol>
</defs>`

export function SheetIconSprite() {
  return <svg width="0" height="0" className="icon-sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />
}

export function Icon({ name, size = '', className = '', flipped = false }: { name: string; size?: '' | 'sm' | 'xs'; className?: string; flipped?: boolean }) {
  return (
    <svg className={`ico${size ? ` ${size}` : ''}${className ? ` ${className}` : ''}${flipped ? ' flipped' : ''}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  )
}

export function useIsNarrowScreen() {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY)
    const update = () => setIsNarrow(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isNarrow
}

// Light and dark follow the site's `.dark` class; the choice is kept in the one storage key the site has always had.
export function useThemeToggle(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
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
  return [isDark, toggleTheme]
}

// A native modal <dialog> that is open while `isOpen` is true; Escape and the backdrop close it through `onClose`. Chrome fires
// `close` a frame late, so it is passed on only while the dialog is meant to be open (closing one dialog and opening another in
// the same frame would otherwise close the new one).
export function WorkbenchDialog({ id, titleId, isOpen, onClose, children }: { id: string; titleId: string; isOpen: boolean; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])
  return (
    <dialog id={id} ref={dialogRef} aria-labelledby={titleId} onClose={() => isOpen && onClose()}>
      {isOpen && children}
    </dialog>
  )
}

type TopBarProps = {
  format: MiniFormat
  fileName: string
  fileSize: string
  isModified: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  canDownload: boolean
  downloadLabel: string
  downloadTip: string
  onDownload: () => void
  onHome: () => void
  isDark: boolean
  onToggleTheme: () => void
  // The Convert button's choices for the open file (to CSV, to JSON); no button when there are none.
  convertItems?: MenuItem[]
}

export function TopBar({ format, fileName, fileSize, isModified, canUndo, canRedo, onUndo, onRedo, canDownload, downloadLabel, downloadTip, onDownload, onHome, isDark, onToggleTheme, convertItems = [] }: TopBarProps) {
  const { t } = useT()
  const [convertMenuPosition, setConvertMenuPosition] = useState<{ left: number; top: number } | null>(null)
  return (
    <header id="top-bar">
      <button className="brand" type="button" id="home-button" aria-label={t('sheet.home')} onClick={onHome}>
        <MiniFormatIcon format={format} size={24} className="logo" />
        <Wordmark className="brand-name" />
      </button>
      <div className="file-title">
        <h1 id="file-name" dir="auto" title={fileName}>
          {fileName}
        </h1>
        <span className="file-size" id="file-size-chip" dir="ltr">
          {fileSize}
        </span>
        {isModified && <span className="mod" id="modified-dot" role="img" aria-label={t('sheet.edited')} title={t('sheet.edited')} />}
      </div>
      <span className="privacy-pill">
        <Icon name="lock" size="sm" />
        {t('sheet.privacy')}
      </span>
      <span className="spacer" />
      {convertItems.length > 0 && (
        <button
          className="btn"
          id="convert-button"
          type="button"
          aria-label={t('convert.menuHeading')}
          aria-haspopup="menu"
          aria-expanded={convertMenuPosition !== null}
          onClick={(event) => {
            const buttonBox = event.currentTarget.getBoundingClientRect()
            setConvertMenuPosition({ left: document.documentElement.dir === 'rtl' ? buttonBox.right - 224 : buttonBox.left, top: buttonBox.bottom + 4 })
          }}
        >
          <Icon name="replace" />
          <span className="desk-only">{t('convert.menuHeading')}</span>
          <Icon name="down" size="xs" />
        </button>
      )}
      {convertMenuPosition && <ActionMenu id="convert-button-menu" ariaLabel={t('convert.menuHeading')} {...convertMenuPosition} items={convertItems} onClose={() => setConvertMenuPosition(null)} />}
      <button className="btn icon" id="undo-button" type="button" aria-label={t('toolbar.undo')} data-tip={t('toolbar.undoTip')} disabled={!canUndo} onClick={onUndo}>
        <Icon name="undo" />
      </button>
      <button className="btn icon" id="redo-button" type="button" aria-label={t('toolbar.redo')} data-tip={t('toolbar.redoTip')} disabled={!canRedo} onClick={onRedo}>
        <Icon name="redo" />
      </button>
      <span className="vsep desk-only" />
      <LanguageSwitcher className="btn desk-only" />
      <button className="btn primary icon" id="download-button" type="button" disabled={!canDownload} aria-label={downloadLabel} data-tip={downloadTip} data-tip-align="end" onClick={onDownload}>
        <Icon name="download" />
      </button>
      <button className="btn icon" id="theme-toggle" type="button" aria-label={isDark ? t('theme.toLight') : t('theme.toDark')} data-tip={isDark ? t('theme.toLight') : t('theme.toDark')} data-tip-align="end" onClick={onToggleTheme}>
        <Icon name={isDark ? 'sun' : 'moon'} />
      </button>
    </header>
  )
}

export function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div id="toolbar" role="toolbar" aria-label={label}>
      {children}
    </div>
  )
}

type ToolbarButtonProps = {
  id: string
  label: string
  icon: string
  isPressed?: boolean
  isDisabled?: boolean
  hasMenu?: boolean
  // A small number drawn on the icon (active filters).
  count?: number
  countId?: string
  onClick: (button: HTMLButtonElement) => void
}

export function ToolbarButton({ id, label, icon, isPressed, isDisabled, hasMenu, count, countId, onClick }: ToolbarButtonProps) {
  return (
    <button className="tbtn" id={id} type="button" aria-label={label} data-tip={label} aria-pressed={isPressed} aria-haspopup={hasMenu ? 'menu' : undefined} disabled={isDisabled} onClick={(event) => onClick(event.currentTarget)}>
      <Icon name={icon} />
      {count !== undefined && count > 0 && (
        <span className="count" id={countId}>
          {count}
        </span>
      )}
    </button>
  )
}

export function ToolbarSeparator() {
  return <span className="vsep" />
}

export function ToolbarSearch({ inputRef, value, placeholder, countText, onChange }: { inputRef: Ref<HTMLInputElement>; value: string; placeholder: string; countText: string; onChange: (value: string) => void }) {
  return (
    <label className="search" htmlFor="search-input">
      <Icon name="search" size="sm" />
      <input id="search-input" ref={inputRef} type="search" dir="auto" placeholder={placeholder} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
      <span id="search-count">{countText}</span>
      <kbd className="desk-only">/</kbd>
    </label>
  )
}

type ValueBarProps = {
  // The address of the active cell ("B6"), or '' when none is selected.
  address: string
  onAddressSubmit: (address: string) => void
  // What stands between the address and the value: the column's name and type.
  columnInfo?: ReactNode
  value: string
  isDisabled: boolean
  onValueChange: (value: string) => void
  // Enter commits and moves on to the grid; leaving the box only commits.
  onCommit: (reason: 'enter' | 'blur') => void
  onCancel: () => void
  note: ReactNode
}

export function ValueBar({ address, onAddressSubmit, columnInfo, value, isDisabled, onValueChange, onCommit, onCancel, note }: ValueBarProps) {
  const { t } = useT()
  return (
    <div id="value-bar">
      <input
        id="cell-address-input"
        aria-label={t('sheet.cellAddress')}
        key={address}
        defaultValue={address}
        dir="ltr"
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onAddressSubmit(event.currentTarget.value)
        }}
      />
      {columnInfo}
      <span className="fx" aria-hidden="true">
        fx
      </span>
      <input
        id="cell-value-input"
        aria-label={t('sheet.cellValue')}
        autoComplete="off"
        dir="auto"
        disabled={isDisabled}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onCommit('enter')
          } else if (event.key === 'Escape') onCancel()
        }}
        onBlur={() => onCommit('blur')}
      />
      <span className="vb-note" id="value-bar-note">
        {note}
      </span>
    </div>
  )
}

export type SidebarTab = { id: string; label: string }

type SidebarProps = {
  tabs: SidebarTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  title: string
  subtitle: string
  onClose: () => void
  // On a phone the sidebar is a bottom sheet with a handle that shows a one-line summary while it is closed.
  isSheetOpen: boolean
  onSheetToggle: () => void
  sheetSummary: ReactNode
  children: ReactNode
}

export function Sidebar({ tabs, activeTab, onTabChange, title, subtitle, onClose, isSheetOpen, onSheetToggle, sheetSummary, children }: SidebarProps) {
  const { t } = useT()
  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const isRightToLeft = document.documentElement.dir === 'rtl'
    const step = event.key === 'ArrowRight' ? (isRightToLeft ? -1 : 1) : event.key === 'ArrowLeft' ? (isRightToLeft ? 1 : -1) : 0
    if (!step) return
    event.preventDefault()
    const position = tabs.findIndex((tab) => tab.id === activeTab)
    const nextTab = tabs[(position + step + tabs.length) % tabs.length]
    onTabChange(nextTab.id)
    document.getElementById(`sidebar-tab-${nextTab.id}`)?.focus()
  }
  return (
    <aside id="sidebar" className={isSheetOpen ? 'open' : undefined} aria-labelledby="sidebar-title">
      <button className="sheet-handle" id="sheet-handle-button" type="button" aria-expanded={isSheetOpen} aria-label={t('sheet.openPanel')} onClick={onSheetToggle}>
        <span className="bar" />
        <span className="sheet-sum" id="sheet-summary">
          {sheetSummary}
        </span>
      </button>
      <div className="sidebar-top">
        <div id="sidebar-tabs" role="tablist" aria-label={t('sheet.panels')} onKeyDown={handleTabKeyDown}>
          {tabs.map((tab) => (
            <button key={tab.id} id={`sidebar-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`sidebar-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => onTabChange(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <button className="btn icon sm" id="sidebar-close-button" type="button" aria-label={t('sheet.closePanel')} data-tip={t('sheet.closePanel')} data-tip-align="end" onClick={onClose}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="sidebar-head">
        <h2 id="sidebar-title" dir="auto">
          {title}
        </h2>
        <span className="sidebar-sub" id="sidebar-subtitle">
          {subtitle}
        </span>
      </div>
      <div className="sidebar-panel" id={`sidebar-panel-${activeTab}`} role="tabpanel" aria-labelledby={`sidebar-tab-${activeTab}`}>
        <div className="scroll" id={`${activeTab}-scroll`}>
          {children}
        </div>
      </div>
    </aside>
  )
}

export function SidebarResizer({ widthPx, onWidthChange }: { widthPx: number; onWidthChange: (widthPx: number) => void }) {
  const { t } = useT()
  const clamp = (width: number) => Math.max(280, Math.min(560, width))
  return (
    <button
      id="sidebar-resizer"
      type="button"
      aria-label={t('sheet.resizePanel')}
      title={t('sheet.dragToResize')}
      onMouseDown={(event) => {
        event.preventDefault()
        const startX = event.clientX
        const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
        const handle = event.currentTarget
        handle.classList.add('dragging')
        function resizeSidebar(moveEvent: MouseEvent) {
          const moved = isRightToLeft ? moveEvent.clientX - startX : startX - moveEvent.clientX
          onWidthChange(clamp(widthPx + moved))
        }
        function stopResizing() {
          handle.classList.remove('dragging')
          document.removeEventListener('mousemove', resizeSidebar)
          document.removeEventListener('mouseup', stopResizing)
        }
        document.addEventListener('mousemove', resizeSidebar)
        document.addEventListener('mouseup', stopResizing)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
        const grows = (event.key === 'ArrowLeft') !== isRightToLeft
        onWidthChange(clamp(widthPx + (grows ? 16 : -16)))
      }}
    >
      <span className="grip" />
    </button>
  )
}

export function StatusBar({ children }: { children: ReactNode }) {
  return <footer id="status-bar">{children}</footer>
}

export type SheetTab = { id: string; label: string }

export function SheetTabs({ tabs, activeId, onSelect, onAdd }: { tabs: SheetTab[]; activeId: string; onSelect: (id: string) => void; onAdd?: () => void }) {
  const { t } = useT()
  return (
    <div id="sheet-tabs">
      {onAdd && (
        <button className="btn icon sm" id="add-sheet-button" type="button" aria-label={t('sheet.addSheet')} data-tip={t('sheet.addSheet')} onClick={onAdd}>
          <Icon name="plus" size="sm" />
        </button>
      )}
      <div id="sheet-tablist" role="tablist" aria-label={t('sheet.sheets')}>
        {tabs.map((tab) => (
          <button key={tab.id} id={`sheet-tab-${tab.id}`} className="sheet-tab" type="button" role="tab" aria-selected={tab.id === activeId} dir="auto" onClick={() => onSelect(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ActionBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav id="action-bar" aria-label={label}>
      {children}
    </nav>
  )
}

export function ActionBarButton({ id, label, icon, count, countId, onClick }: { id: string; label: string; icon: string; count?: number; countId?: string; onClick: (button: HTMLButtonElement) => void }) {
  return (
    <button className="ab" id={id} type="button" onClick={(event) => onClick(event.currentTarget)}>
      <Icon name={icon} />
      {label}
      {count !== undefined && count > 0 && (
        <span className="dot" id={countId}>
          {count}
        </span>
      )}
    </button>
  )
}

export function ToastRegion({ id, message, undoLabel, onUndo }: { id: string; message: string | null; undoLabel: string; onUndo: (() => void) | null }) {
  return (
    <div id={id} className="toast-region" role="status" aria-live="polite">
      {message !== null && (
        <div className="toast">
          <span>{message}</span>
          {onUndo && (
            <button className="btn sm" id="toast-undo-button" type="button" onClick={onUndo}>
              {undoLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function DropOverlay() {
  const { t } = useT()
  return <div id="drop-overlay">{t('sheet.dropOverlay')}</div>
}
