import { Fragment, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { viewers } from '../../viewers'
import { MiniFormatIcon } from '../KitIcon'
import type { MiniFormat } from '../KitIcon'

// 'mod' is ⌘ on an Apple keyboard and Ctrl elsewhere; anything else is the key's own letter.
type ShortcutKey = 'mod' | 'shift' | 'enter' | string
type Shortcut = { keys: ShortcutKey[]; labelKey: MessageKey }
type ShortcutTab = { id: string; format: MiniFormat; labelKey: MessageKey; shortcuts: Shortcut[]; noteKey: MessageKey; extensions?: string[] }

// Only shortcuts the viewers really have: see the keydown handlers in src/formats/*/…Viewer.tsx and src/pages/FileViewPage.tsx.
const shortcutTabs: ShortcutTab[] = [
  {
    id: 'spreadsheets',
    format: 'xlsx',
    labelKey: 'tabs.spreadsheets',
    noteKey: 'shortcut.note.spreadsheets',
    shortcuts: [
      { keys: ['mod', 'z'], labelKey: 'shortcut.undo' },
      { keys: ['mod', 'shift', 'z'], labelKey: 'shortcut.redo' },
      { keys: ['mod', 'k'], labelKey: 'shortcut.search' },
      { keys: ['mod', 'g'], labelKey: 'shortcut.goToRow' },
    ],
  },
  {
    id: 'json',
    format: 'json',
    labelKey: 'tabs.json',
    noteKey: 'shortcut.note.json',
    shortcuts: [
      { keys: ['mod', 'k'], labelKey: 'shortcut.search' },
      { keys: ['mod', 'enter'], labelKey: 'shortcut.validate' },
      { keys: ['mod', 'z'], labelKey: 'shortcut.undo' },
      { keys: ['mod', 'v'], labelKey: 'shortcut.paste' },
    ],
  },
  {
    id: 'text',
    format: 'txt',
    labelKey: 'tabs.text',
    noteKey: 'shortcut.note.text',
    shortcuts: [
      { keys: ['mod', 'f'], labelKey: 'shortcut.find' },
      { keys: ['mod', 'g'], labelKey: 'shortcut.goToLine' },
      { keys: ['mod', 'z'], labelKey: 'shortcut.undo' },
      { keys: ['mod', 'shift', 'z'], labelKey: 'shortcut.redo' },
    ],
  },
  {
    id: 'soon',
    format: 'unsupported',
    labelKey: 'tabs.soon',
    noteKey: 'shortcut.note.soon',
    shortcuts: [],
    extensions: viewers.filter((viewer) => !viewer.toolPath).flatMap((viewer) => viewer.extensions),
  },
]

const isMacKeyboard = () => /Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent)
const subscribeToNothing = () => () => {}

// ⌘ on Apple keyboards, Ctrl elsewhere. False in the build's server render, which has no keyboard to ask about.
// oxlint-disable-next-line react/only-export-components
export function useIsMacKeyboard() {
  return useSyncExternalStore(subscribeToNothing, isMacKeyboard, () => false)
}

// A physical keycap: the symbol large, the key's name small under it (left out when the symbol is the name).
export function Keycap({ keyName, isMac }: { keyName: ShortcutKey; isMac: boolean }) {
  const cap =
    keyName === 'mod'
      ? isMac
        ? { symbol: '⌘', name: 'Cmd' }
        : { symbol: 'Ctrl', name: 'Control' }
      : keyName === 'shift'
        ? { symbol: '⇧', name: 'Shift' }
        : keyName === 'enter'
          ? { symbol: '↵', name: 'Enter' }
          : { symbol: keyName.toUpperCase(), name: '' }
  return (
    <kbd className="keycap">
      <span aria-hidden={cap.name ? true : undefined} className={cap.symbol.length > 1 ? 'keycap-symbol keycap-symbol--text' : 'keycap-symbol'}>
        {cap.symbol}
      </span>
      {cap.name && <span className="keycap-name">{cap.name}</span>}
    </kbd>
  )
}

// A strip of format tabs; the panel under it lists that format's shortcuts as keycaps.
export default function ShortcutTabs() {
  const { t } = useT()
  const isMac = useIsMacKeyboard()
  const [selectedId, setSelectedId] = useState(shortcutTabs[0].id)
  const selectedTab = shortcutTabs.find((tab) => tab.id === selectedId) ?? shortcutTabs[0]

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
    let step = 0
    if (event.key === 'ArrowRight') step = isRightToLeft ? -1 : 1
    else if (event.key === 'ArrowLeft') step = isRightToLeft ? 1 : -1
    else if (event.key === 'Home') step = -position
    else if (event.key === 'End') step = shortcutTabs.length - 1 - position
    else return
    event.preventDefault()
    const nextTab = shortcutTabs[(position + step + shortcutTabs.length) % shortcutTabs.length]
    setSelectedId(nextTab.id)
    document.getElementById(`format-tab-${nextTab.id}`)?.focus()
  }

  return (
    <section id="shortcuts" aria-labelledby="shortcuts-heading" className="section-gap">
      <h2 id="shortcuts-heading" className="type-h2 text-balance">{t('tabs.heading')}</h2>
      <p className="type-lead mt-3 max-w-[640px] text-ink-soft">{t('tabs.lead')}</p>
      <div role="tablist" aria-label={t('tabs.heading')} className="mt-8 flex flex-wrap gap-3">
        {shortcutTabs.map((tab, position) => (
          <button
            key={tab.id}
            id={`format-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={tab.id === selectedId}
            aria-controls={`format-panel-${tab.id}`}
            tabIndex={tab.id === selectedId ? 0 : -1}
            className="format-tab"
            onClick={() => setSelectedId(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, position)}
          >
            <MiniFormatIcon format={tab.format} size={22} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      <div id={`format-panel-${selectedTab.id}`} role="tabpanel" aria-labelledby={`format-tab-${selectedTab.id}`} className="soft-card mt-6">
        {selectedTab.shortcuts.length > 0 ? (
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {selectedTab.shortcuts.map((shortcut) => (
              <li key={shortcut.labelKey} className="flex flex-wrap items-center gap-4">
                <span dir="ltr" className="flex items-center gap-2">
                  {shortcut.keys.map((key, position) => (
                    <Fragment key={key}>
                      {position > 0 && (
                        <span aria-hidden="true" className="keycap-plus">
                          +
                        </span>
                      )}
                      <Keycap keyName={key} isMac={isMac} />
                    </Fragment>
                  ))}
                </span>
                <span className="text-lg font-semibold">{t(shortcut.labelKey)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedTab.extensions?.map((extension) => (
              <span key={extension} dir="ltr" className="chip chip--soft">
                {extension}
              </span>
            ))}
          </div>
        )}
        <p className="mt-6 text-sm text-ink-soft">{t(selectedTab.noteKey)}</p>
      </div>
    </section>
  )
}
