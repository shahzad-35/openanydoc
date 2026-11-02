import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { localizePath, useT } from '../i18n'
import type { Locale, MessageKey } from '../i18n'
import { SEARCH_ICON_PATH, navClasses, searchBoxFormats } from '../pages/changelogMarkup'
import { guideAddresses, pageSeo } from '../seo'
import { landingPages, viewers } from '../viewers'
import type { Viewer } from '../viewers'

type SearchGroup = 'viewers' | 'tools' | 'convert' | 'guides'
// A page the search can open. `searchText` holds the words a query is matched against: the page's name and heading in the page's
// language, the words of its address and the extensions it opens.
type SearchEntry = { path: string; name: string; note: string; icon: string; group: SearchGroup; searchText: string }
// A file people look for that the site cannot open: shown with its advice, never opened.
type UnsupportedEntry = { id: string; icon: string; nameKey: MessageKey; noteKey: MessageKey }

const viewerIcons: Record<Viewer['id'], string> = { csv: 'csv', text: 'txt', json: 'json', excel: 'xlsx', word: 'docx', pdf: 'pdf', powerpoint: 'pptx' }
const searchGroups: SearchGroup[] = ['viewers', 'tools', 'convert', 'guides']
const unsupportedEntries: UnsupportedEntry[] = [
  { id: 'ppt', icon: 'pptx', nameKey: 'search.unsupported.ppt', noteKey: 'search.unsupported.pptNote' },
  { id: 'doc', icon: 'docx', nameKey: 'search.unsupported.doc', noteKey: 'search.unsupported.docNote' },
  { id: 'pdf', icon: 'pdf', nameKey: 'search.unsupported.pdf', noteKey: 'search.unsupported.pdfNote' },
]

function buildSearchEntries(locale: Locale, translate: (key: MessageKey) => string): SearchEntry[] {
  const entry = (path: string, icon: string, group: SearchGroup, extensions: string[]): SearchEntry => {
    const seo = pageSeo[locale][path]
    const note = group === 'guides' ? translate('search.group.guides') : translate(`nav.note.${path.slice(1)}` as MessageKey)
    return { path, name: seo.linkText ?? seo.heading, note, icon, group, searchText: `${seo.linkText ?? ''} ${seo.heading} ${path.replaceAll('-', ' ')} ${extensions.join(' ')}` }
  }
  const viewerEntries = viewers.filter((viewer) => viewer.toolPath).map((viewer) => entry(viewer.toolPath as string, viewerIcons[viewer.id], 'viewers', viewer.extensions))
  const landingEntries = landingPages.map((page) => {
    const viewer = viewers.find((candidate) => candidate.id === page.viewerId) as Viewer
    const isConversionOrTool = Boolean(page.convertTo || page.tool)
    const icon = page.tool ? 'mask' : page.convertTo ? 'convert' : viewerIcons[page.viewerId]
    return entry(page.path, icon, isConversionOrTool ? 'convert' : 'tools', page.extensions ?? viewer.extensions)
  })
  const guideEntries = guideAddresses.map((path) => entry(path, 'guide', 'guides', []))
  return [...viewerEntries, ...landingEntries, ...guideEntries]
}

// The words of a text, for matching: letters and digits in any script, lower case.
const wordsOf = (text: string) => text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

// Every typed word must start a word of the entry (a word of one or two letters, such as "to", must be a whole word); entries
// whose name starts with the first typed word come first. With nothing typed: the viewers and the converters.
function findMatchingEntries(entries: SearchEntry[], query: string) {
  const typedWords = wordsOf(query)
  if (typedWords.length === 0) return entries.filter((entry) => entry.group === 'viewers' || entry.group === 'convert')
  const matchesTypedWords = (text: string) => {
    const words = wordsOf(text)
    return typedWords.every((typedWord) => words.some((word) => (typedWord.length <= 2 ? word === typedWord : word.startsWith(typedWord))))
  }
  const startsWithFirstWord = (entry: SearchEntry) => (entry.name.toLocaleLowerCase().startsWith(typedWords[0]) ? 0 : 1)
  return entries
    .filter((entry) => matchesTypedWords(entry.searchText))
    .sort((first, second) => searchGroups.indexOf(first.group) - searchGroups.indexOf(second.group) || startsWithFirstWord(first) - startsWithFirstWord(second))
}

// The header's search box, on every content page (home, format and landing pages, About, Privacy, Terms, guides, changelog). It
// finds every viewer, landing page, converter and guide, and says which file types the site cannot open. ⌘K or Ctrl K opens it
// from anywhere on the page; arrows move, Enter opens, Esc or a click outside closes. `currentPath` is the page's address without
// its language. scripts/build-static-pages.mjs writes the same closed box into the changelog pages: keep the two identical.
export default function SiteNav({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navRef = useRef<HTMLElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const entries = buildSearchEntries(locale, t)
  const matchingEntries = findMatchingEntries(entries, query)
  const typedWords = wordsOf(query)
  const matchingUnsupported = typedWords.length === 0 ? [] : unsupportedEntries.filter((unsupported) => typedWords.every((typedWord) => wordsOf(`${unsupported.id} ${t(unsupported.nameKey)}`).some((word) => word.startsWith(typedWord))))

  function openSearch() {
    setQuery('')
    setActiveIndex(0)
    setIsOpen(true)
  }
  function closeSearch(shouldFocusButton: boolean) {
    setIsOpen(false)
    if (shouldFocusButton) searchButtonRef.current?.focus()
  }
  function openEntry(entry: SearchEntry) {
    setIsOpen(false)
    onNavigate(localizePath(locale, entry.path))
  }

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus()
  }, [isOpen])

  // ⌘K or Ctrl K opens the search from anywhere on the page, and closes it again; a click outside the box closes it.
  useEffect(() => {
    function toggleSearchOnShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      if (isOpen) closeSearch(true)
      else openSearch()
    }
    function closeSearchOnOutsideClick(event: MouseEvent) {
      if (isOpen && !navRef.current?.contains(event.target as Node)) closeSearch(false)
    }
    document.addEventListener('keydown', toggleSearchOnShortcut)
    document.addEventListener('mousedown', closeSearchOnOutsideClick)
    return () => {
      document.removeEventListener('keydown', toggleSearchOnShortcut)
      document.removeEventListener('mousedown', closeSearchOnOutsideClick)
    }
  })

  function moveOrOpenByKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') setActiveIndex((index) => (matchingEntries.length === 0 ? 0 : (index + 1) % matchingEntries.length))
    else if (event.key === 'ArrowUp') setActiveIndex((index) => (matchingEntries.length === 0 ? 0 : (index - 1 + matchingEntries.length) % matchingEntries.length))
    else if (event.key === 'Enter' && matchingEntries[activeIndex]) openEntry(matchingEntries[activeIndex])
    else if (event.key === 'Escape') closeSearch(true)
    else return
    event.preventDefault()
  }

  const optionId = (entry: SearchEntry) => `site-search-option-${entry.path.slice(1)}`
  const activeEntry = matchingEntries[activeIndex]
  return (
    <nav id="site-nav" ref={navRef} aria-label={t('search.label')} className={navClasses.nav}>
      <button id="site-search-button" ref={searchButtonRef} type="button" className={navClasses.searchButton} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => (isOpen ? closeSearch(false) : openSearch())}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={navClasses.searchIcon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={SEARCH_ICON_PATH} />
        </svg>
        <span className={navClasses.searchLabel}>{t('search.button')}</span>
        <span className={navClasses.searchFormats} aria-hidden="true">
          {searchBoxFormats.map((format) => (
            <span key={format} className={`nav-icon nav-icon-${format}`} />
          ))}
        </span>
      </button>
      {isOpen && (
        <div id="site-search-panel" role="dialog" aria-label={t('search.label')} className="fixed inset-0 z-40 flex flex-col bg-paper-raised p-3 xl:absolute xl:inset-auto xl:start-1/2 xl:top-full xl:mt-2 xl:max-h-[min(70vh,480px)] xl:w-[540px] xl:-translate-x-1/2 xl:rounded-[20px] xl:border-2 xl:border-line xl:p-2.5 xl:shadow-lg xl:rtl:translate-x-1/2">
          <div className="site-search-input-row flex h-12 flex-none items-center gap-2.5 rounded-2xl bg-surface ps-3.5 pe-1.5">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] flex-none text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={SEARCH_ICON_PATH} />
            </svg>
            <input
              id="site-search-input"
              ref={searchInputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="site-search-results"
              aria-autocomplete="list"
              aria-activedescendant={activeEntry ? optionId(activeEntry) : undefined}
              aria-label={t('search.label')}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={moveOrOpenByKey}
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none"
            />
            <button id="site-search-close-button" type="button" aria-label={t('search.close')} className="grid size-10 place-items-center rounded-full hover:bg-paper-raised xl:hidden" onClick={() => closeSearch(true)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <ul id="site-search-results" role="listbox" aria-label={t('search.label')} className="mt-1 min-h-0 flex-1 overflow-y-auto">
            {matchingEntries.length === 0 && matchingUnsupported.length === 0 && (
              <li role="presentation" className="px-3 py-4 text-sm text-ink-soft">
                {t('search.noMatch', { query })}
              </li>
            )}
            {matchingEntries.map((entry, index) => (
              <li key={entry.path} role="presentation">
                {entry.group !== matchingEntries[index - 1]?.group && <p className="px-3 pt-3 pb-1.5 text-[11.5px] font-bold tracking-wide text-ink-soft uppercase">{t(`search.group.${entry.group}`)}</p>}
                <a
                  id={optionId(entry)}
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-current={entry.path === currentPath ? 'page' : undefined}
                  href={localizePath(locale, entry.path)}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                    event.preventDefault()
                    openEntry(entry)
                  }}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 aria-selected:bg-surface"
                >
                  <span className={`nav-icon nav-icon-${entry.icon}`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="font-semibold text-ink">{entry.name}</span>
                    <span className="mt-0.5 truncate text-[13px] text-ink-soft">{entry.note}</span>
                  </span>
                  {index === activeIndex && <span className="ms-auto hidden text-xs text-ink-soft xl:inline">{t('search.enter')}</span>}
                </a>
              </li>
            ))}
            {matchingUnsupported.map((unsupported, index) => (
              <li key={unsupported.id} role="presentation">
                {index === 0 && <p className="px-3 pt-3 pb-1.5 text-[11.5px] font-bold tracking-wide text-ink-soft uppercase">{t('search.group.unsupported')}</p>}
                <p className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`nav-icon nav-icon-${unsupported.icon}`} aria-hidden="true" />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold text-ink">{t(unsupported.nameKey)}</span>
                    <span className="mt-0.5 text-[13px] text-ink-soft">{t(unsupported.noteKey)}</span>
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 hidden flex-none border-t border-line px-3 pt-2 text-xs text-ink-soft xl:block">{t('search.hint')}</p>
        </div>
      )}
    </nav>
  )
}
