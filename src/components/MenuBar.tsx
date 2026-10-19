import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useT } from '../i18n'
import './menuBar.css'

// The text menu bar of the file pages (File, Edit, View ...), like a desktop application's. Each editor passes its own
// menus as data; the bar draws them, keeps the keyboard behaviour (Left and Right move between menus, Up and Down inside one,
// Home and End, Enter or Space choose, Escape closes and gives focus back) and closes on a click outside. The open menu is a
// popover in the browser's top layer, so nothing on the page covers it. On a phone the bar is one Menu button that opens the
// same menus as a bottom sheet with the list of menu names first.
//
// Ids: a menu's button is `menu-<menu id>`, its open list `menu-<menu id>-menu`, and an action in it `menu-<menu id>-<item id>`.
// Links and notes keep the id they are given (the legal links are `menu-link-privacy`, `menu-link-terms`, `menu-disclaimer` on
// every page). Ids never come from a translated label.

export type MenuAction = {
  id: string
  label: string
  // A shortcut shown at the end of the row, such as "⌘Z".
  hint?: string
  // A glyph of the page's icon sprite, used as `#i-<icon>`.
  icon?: string
  kind?: 'checkbox' | 'radio'
  isChecked?: boolean
  isDisabled?: boolean
  isDanger?: boolean
  onSelect: () => void
}
export type MenuLink = { id: string; label: string; href: string; icon?: string; external?: boolean }
export type MenuNote = { id: string; note: string }
export type MenuEntry = MenuAction | MenuLink | MenuNote | { heading: string } | 'separator'
export type MenuDefinition = { id: string; label: string; items: MenuEntry[] }

type OpenMenu = { menuId: string | null } // menuId null: the phone's list of menu names
const MENU_ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])'

function isRightToLeftPage() {
  return document.documentElement.dir === 'rtl'
}

export default function MenuBar({ menus, isCompact, label }: { menus: MenuDefinition[]; isCompact: boolean; label: string }) {
  const { t } = useT()
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null)
  // Roving tabindex: one menu button is in the Tab order.
  const [tabbableMenuId, setTabbableMenuId] = useState(menus[0]?.id ?? '')
  const barRef = useRef<HTMLElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const focusItemOnOpenRef = useRef<'first' | 'last' | null>(null)

  const menuIds = menus.map((menu) => menu.id)
  const openDefinition = openMenu?.menuId ? menus.find((menu) => menu.id === openMenu.menuId) : undefined

  function open(menuId: string | null, focusItem: 'first' | 'last' | null = null) {
    openerRef.current = document.getElementById(isCompact ? 'menu-button' : `menu-${menuId}`)
    focusItemOnOpenRef.current = focusItem
    setOpenMenu({ menuId })
    if (menuId) setTabbableMenuId(menuId)
  }

  function close(returnFocus: boolean) {
    setOpenMenu(null)
    if (returnFocus) openerRef.current?.focus()
  }

  function moveToMenu(fromMenuId: string, step: number, keepOpen: boolean) {
    const nextId = menuIds[(menuIds.indexOf(fromMenuId) + step + menuIds.length) % menuIds.length]
    setTabbableMenuId(nextId)
    if (keepOpen) open(nextId, 'first')
    else document.getElementById(`menu-${nextId}`)?.focus()
  }

  // Shows the popover, puts it under its button (kept on screen, mirrored in Arabic) and moves focus in when a key opened it.
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!openMenu || !pop) return
    if (!pop.matches(':popover-open')) pop.showPopover()
    const anchor = openerRef.current
    if (!isCompact && anchor) {
      const box = anchor.getBoundingClientRect()
      const width = pop.offsetWidth
      const height = pop.offsetHeight
      const start = isRightToLeftPage() ? box.right - width : box.left
      pop.style.left = `${Math.max(8, Math.min(start, window.innerWidth - width - 8))}px`
      pop.style.top = `${box.bottom + 2 + height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - height - 8) : box.bottom + 2}px`
    }
    const focusItem = focusItemOnOpenRef.current
    focusItemOnOpenRef.current = null
    if (focusItem) {
      const items = pop.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)
      items[focusItem === 'first' ? 0 : items.length - 1]?.focus()
    }
  }, [openMenu, isCompact])

  // A click outside the open menu and the bar closes it.
  useEffect(() => {
    if (!openMenu) return
    function closeOnOutsideMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (popRef.current?.contains(target) || barRef.current?.contains(target)) return
      setOpenMenu(null)
    }
    document.addEventListener('mousedown', closeOnOutsideMouseDown)
    return () => document.removeEventListener('mousedown', closeOnOutsideMouseDown)
  }, [openMenu])

  function handleMenuButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, menuId: string) {
    const isRightToLeft = isRightToLeftPage()
    const step = event.key === 'ArrowRight' ? (isRightToLeft ? -1 : 1) : event.key === 'ArrowLeft' ? (isRightToLeft ? 1 : -1) : 0
    if (step) moveToMenu(menuId, step, openMenu !== null)
    else if (event.key === 'Home' || event.key === 'End') moveToMenu(menuId, event.key === 'Home' ? -menuIds.indexOf(menuId) : menuIds.length - 1 - menuIds.indexOf(menuId), openMenu !== null)
    else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') open(menuId, 'first')
    else if (event.key === 'ArrowUp') open(menuId, 'last')
    else if (event.key === 'Escape' && openMenu) close(true)
    else return
    event.preventDefault()
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR))
    const position = items.indexOf(document.activeElement as HTMLElement)
    const isRightToLeft = isRightToLeftPage()
    const menuStep = event.key === 'ArrowRight' ? (isRightToLeft ? -1 : 1) : event.key === 'ArrowLeft' ? (isRightToLeft ? 1 : -1) : 0
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') items[(position + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    else if (event.key === 'Home') items[0]?.focus()
    else if (event.key === 'End') items[items.length - 1]?.focus()
    else if (menuStep && openMenu?.menuId && !isCompact) moveToMenu(openMenu.menuId, menuStep, true)
    else if (event.key === 'Escape') close(true)
    else if (event.key === 'Tab') close(false)
    else return
    if (event.key !== 'Tab') event.preventDefault()
  }

  // Focus goes back to the menu button first, so an action that opens a dialog or a text box keeps the focus it sets afterwards.
  function choose(action: () => void) {
    close(true)
    action()
  }

  function renderEntry(menuId: string, entry: MenuEntry, position: number) {
    if (entry === 'separator') return <div key={position} className="mi-sep" role="separator" />
    if ('heading' in entry) {
      return (
        <div key={position} className="menu-label" role="presentation">
          {entry.heading}
        </div>
      )
    }
    if ('note' in entry) {
      return (
        <p key={entry.id} id={entry.id} className="menu-note" role="presentation">
          {entry.note}
        </p>
      )
    }
    const icon = entry.icon ? (
      <svg className="mi-ico" aria-hidden="true">
        <use href={`#i-${entry.icon}`} />
      </svg>
    ) : (
      <span className="mi-ico" aria-hidden="true" />
    )
    if ('href' in entry) {
      // A link opens in a new tab, so the open file and its edits stay where they are.
      return (
        <a key={entry.id} id={entry.id} className="mi" role="menuitem" href={entry.href} target={entry.external === false ? undefined : '_blank'} rel="noopener" onClick={() => close(false)}>
          {icon}
          {entry.label}
        </a>
      )
    }
    const isCheck = entry.kind === 'checkbox' || entry.kind === 'radio'
    return (
      <button
        key={entry.id}
        id={`menu-${menuId}-${entry.id}`}
        className={`mi${entry.isDanger ? ' danger' : ''}`}
        type="button"
        role={entry.kind === 'checkbox' ? 'menuitemcheckbox' : entry.kind === 'radio' ? 'menuitemradio' : 'menuitem'}
        aria-checked={isCheck ? Boolean(entry.isChecked) : undefined}
        disabled={entry.isDisabled}
        onClick={() => choose(entry.onSelect)}
      >
        {isCheck ? (
          <svg className="mi-ico mi-check" viewBox="0 0 24 24" aria-hidden="true">
            {entry.isChecked && <path d="m5 12.5 4.5 4.5L19 7.5" />}
          </svg>
        ) : (
          icon
        )}
        {entry.label}
        {entry.hint && <span className="hint">{entry.hint}</span>}
      </button>
    )
  }

  function renderPopContents() {
    if (!openMenu) return null
    if (openMenu.menuId === null) {
      return menus.map((menu) => (
        <button key={menu.id} id={`menu-root-${menu.id}`} className="mi" type="button" role="menuitem" aria-haspopup="menu" onClick={() => open(menu.id)}>
          <span className="mi-ico" aria-hidden="true" />
          {menu.label}
          <svg className="mi-ico hint" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      ))
    }
    if (!openDefinition) return null
    return (
      <>
        {isCompact && (
          <button id="menu-back-button" className="mi menu-back" type="button" role="menuitem" onClick={() => open(null)}>
            <svg className="mi-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
            {openDefinition.label}
          </button>
        )}
        {openDefinition.items.map((entry, position) => renderEntry(openDefinition.id, entry, position))}
      </>
    )
  }

  const popId = openMenu ? (openMenu.menuId ? `menu-${openMenu.menuId}-menu` : 'menu-root-menu') : undefined
  return (
    <>
      <nav id="menu-bar" ref={barRef} role="menubar" aria-label={label} className={isCompact ? 'compact' : undefined}>
        {isCompact ? (
          <button id="menu-button" className="menu-top" type="button" role="menuitem" aria-haspopup="menu" aria-expanded={openMenu !== null} aria-controls={popId} onClick={() => (openMenu ? close(false) : open(null))}>
            <svg className="mi-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            {t('menu.menu')}
          </button>
        ) : (
          menus.map((menu) => (
            <button
              key={menu.id}
              id={`menu-${menu.id}`}
              className="menu-top"
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openMenu?.menuId === menu.id}
              aria-controls={openMenu?.menuId === menu.id ? popId : undefined}
              tabIndex={tabbableMenuId === menu.id ? 0 : -1}
              onClick={() => (openMenu?.menuId === menu.id ? close(false) : open(menu.id))}
              onMouseEnter={() => openMenu && openMenu.menuId !== menu.id && open(menu.id)}
              onKeyDown={(event) => handleMenuButtonKeyDown(event, menu.id)}
            >
              {menu.label}
            </button>
          ))
        )}
      </nav>
      {openMenu && (
        <div id={popId} ref={popRef} className={`menu-pop${isCompact ? ' sheet' : ''}`} popover="manual" role="menu" aria-label={openDefinition?.label ?? t('menu.menu')} onKeyDown={handleMenuKeyDown}>
          {renderPopContents()}
        </div>
      )}
    </>
  )
}
