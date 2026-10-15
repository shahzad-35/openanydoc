import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// The icon controls every format's editing toolbar is built from (see "Editing toolbar standard" in DESIGN.md): a plain icon
// button, an icon button that opens a menu of actions, and the popover menu itself.

export type MenuItem = { label: string; onSelect: () => void; isDisabled?: boolean }

type ActionMenuProps = {
  ariaLabel: string
  // Where the menu opens: right under what opened it.
  left: number
  top: number
  items: MenuItem[]
  onClose: () => void
}

// A menu in the browser's top layer (a popover), so the table can never cover it. Esc and a click outside close it, the arrow
// keys move between items, and focus returns to what opened it.
export function ActionMenu({ ariaLabel, left, top, items, onClose }: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = menuRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    menu?.showPopover()
    menu?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    return () => {
      // Give focus back to the opener, unless the chosen action already moved it (into a dialog or a text box).
      const focusMovedElsewhere = document.activeElement !== document.body && !menu?.contains(document.activeElement)
      if (menu?.matches(':popover-open')) menu.hidePopover()
      if (!focusMovedElsewhere && opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div
      ref={menuRef}
      popover="auto"
      role="menu"
      aria-label={ariaLabel}
      onToggle={(event) => {
        if (event.newState === 'closed') onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'))
        const position = buttons.indexOf(document.activeElement as HTMLElement)
        const step = event.key === 'ArrowDown' ? 1 : -1
        buttons[(position + step + buttons.length) % buttons.length]?.focus()
      }}
      style={{ left, top }}
      className="box-shape solid-box fixed m-0 max-h-[70vh] w-56 overflow-y-auto border-rule bg-paper-raised p-1 text-ink"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.isDisabled}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className="min-h-8 pointer-coarse:min-h-11 w-full cursor-pointer rounded px-3 text-start text-sm transition-colors duration-200 hover:bg-paper focus-visible:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export const iconButtonClassName =
  'control-shape grid size-8 pointer-coarse:size-11 shrink-0 cursor-pointer place-items-center text-[14px] transition-colors duration-200 hover:bg-paper-raised disabled:cursor-not-allowed disabled:text-ink/40 aria-pressed:bg-paper-raised aria-pressed:text-(--file-color)'

// An icon button with a small arrow that opens a menu of actions.
export function IconMenuButton({ label, items, isDisabled, children }: { label: string; items: MenuItem[]; isDisabled?: boolean; children: ReactNode }) {
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  return (
    <>
      <button
        type="button"
        aria-label={label}
        data-tip={label}
        aria-haspopup="menu"
        aria-expanded={menuPosition !== null}
        disabled={isDisabled}
        onClick={(event) => {
          const buttonBox = event.currentTarget.getBoundingClientRect()
          setMenuPosition({ left: buttonBox.left, top: buttonBox.bottom + 2 })
        }}
        className={`${iconButtonClassName.replace('grid ', 'inline-flex items-center ').replace('place-items-center', 'justify-center')} w-auto gap-0.5 px-1.5`}
      >
        {children}
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      {menuPosition && <ActionMenu ariaLabel={label} {...menuPosition} items={items} onClose={() => setMenuPosition(null)} />}
    </>
  )
}

export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}


export type IconButtonProps = { label: string; isPressed?: boolean; isDisabled?: boolean; onClick: () => void; children: ReactNode }

export function IconButton({ label, isPressed, isDisabled, onClick, children }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} data-tip={label} aria-pressed={isPressed} disabled={isDisabled} onClick={onClick} className={iconButtonClassName}>
      {children}
    </button>
  )
}

