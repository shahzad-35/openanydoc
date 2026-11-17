// The Word viewer's side panels, loaded on first use: headings, search, document info, read aloud, and the comments and changes.
// They read the shown view (the pages or the reading view) straight from the DOM; nothing here changes the document's text.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import ReadAloudPanel from '../ReadAloudPanel'
import type { ReadAloudPart } from '../ReadAloudPanel'
import type { WordDocumentFacts } from './wordDocument'

export type WordHeading = { id: string; level: number; text: string }
export type WordNote = { anchorId: string | null; kind: 'comment' | 'inserted' | 'deleted'; author: string; date: string; text: string }

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, td, th'

// The body's paragraphs: on the pages, the article of each page (not headers, footers or comment popovers); a block that holds
// other blocks (a list item with paragraphs) is left to its children.
export function listTextBlocks(viewElement: HTMLElement) {
  const pageBodies = viewElement.querySelectorAll<HTMLElement>('section.docx > article')
  const roots = pageBodies.length > 0 ? Array.from(pageBodies) : [viewElement]
  return roots.flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)).filter((block) => !block.closest('.docx-comment-popover') && !block.querySelector(BLOCK_SELECTOR)))
}

// A block's text as one string, with where each text node starts in it. Deleted text is left out when the markup is hidden, and
// always for counting; comment marks and popovers never count.
function readBlockText(block: HTMLElement, isDeletedTextSkipped: boolean) {
  const pieces: { node: Text; start: number }[] = []
  let text = ''
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest('.docx-comment-ref, .docx-comment-popover') || (isDeletedTextSkipped && node.parentElement?.closest('del')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    pieces.push({ node, start: text.length })
    text += node.data
  }
  return { text, pieces }
}

export function countDocumentText(viewElement: HTMLElement) {
  const texts = listTextBlocks(viewElement).map((block) => readBlockText(block, true).text.trim()).filter(Boolean)
  const joined = texts.join('\n')
  return {
    words: (joined.match(/\S+/g) ?? []).length,
    characters: joined.replace(/\n/g, '').length,
    charactersWithoutSpaces: joined.replace(/\s/g, '').length,
    paragraphs: texts.length,
  }
}

const formatCount = (count: number) => count.toLocaleString('en-US')

export function NavigationPanel({ headings, currentHeadingId, onJump }: { headings: WordHeading[]; currentHeadingId: string | null; onJump: (headingId: string) => void }) {
  const { t } = useT()
  if (headings.length === 0) return <p className="word-panel-note">{t('word.nav.empty')}</p>
  return (
    <ol className="word-heading-list" aria-label={t('word.tab.navigation')}>
      {headings.map((heading, position) => (
        <li key={heading.id} className={`level-${Math.min(heading.level, 6)}`}>
          <button id={`word-heading-link-${position}`} type="button" dir="auto" aria-current={heading.id === currentHeadingId ? 'location' : undefined} onClick={() => onJump(heading.id)}>
            {heading.text}
          </button>
        </li>
      ))}
    </ol>
  )
}

function escapeForPattern(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function SearchPanel({ viewElement, viewVersion, isDeletedTextHidden, focusRequest }: { viewElement: HTMLElement | null; viewVersion: number; isDeletedTextHidden: boolean; focusRequest: number }) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [isCaseMatched, setIsCaseMatched] = useState(false)
  const [isWholeWord, setIsWholeWord] = useState(false)
  const [matches, setMatches] = useState<Range[]>([])
  const [currentPosition, setCurrentPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusRequest])

  // Matches are found per paragraph across its text nodes (Word splits words into runs), and drawn with the CSS Custom Highlight
  // API, which leaves the document's DOM as it is.
  useEffect(() => {
    if (!viewElement || query.trim() === '') {
      // oxlint-disable-next-line react/set-state-in-effect
      setMatches([])
      return
    }
    const flags = isCaseMatched ? 'gu' : 'giu'
    const body = escapeForPattern(query)
    const pattern = new RegExp(isWholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, flags)
    const found: Range[] = []
    for (const block of listTextBlocks(viewElement)) {
      const { text, pieces } = readBlockText(block, isDeletedTextHidden)
      const locate = (offset: number, isEnd: boolean) => {
        const piece = pieces.findLast((candidate) => (isEnd ? candidate.start < offset : candidate.start <= offset)) ?? pieces[0]
        return { node: piece.node, offset: offset - piece.start }
      }
      for (const match of text.matchAll(pattern)) {
        if (match[0] === '') continue
        const start = locate(match.index, false)
        const end = locate(match.index + match[0].length, true)
        const range = new Range()
        range.setStart(start.node, start.offset)
        range.setEnd(end.node, end.offset)
        found.push(range)
      }
    }
    setMatches(found)
    setCurrentPosition(0)
  }, [viewElement, viewVersion, query, isCaseMatched, isWholeWord, isDeletedTextHidden])

  useEffect(() => {
    const current = matches[currentPosition]
    if (canHighlight) {
      CSS.highlights.set('word-search', new Highlight(...matches))
      if (current) CSS.highlights.set('word-search-current', new Highlight(current))
      else CSS.highlights.delete('word-search-current')
    } else if (current) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(current)
    }
    current?.startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }, [matches, currentPosition, canHighlight])

  useEffect(
    () => () => {
      if (canHighlight) {
        CSS.highlights.delete('word-search')
        CSS.highlights.delete('word-search-current')
      }
    },
    [canHighlight],
  )

  const step = (direction: 1 | -1) => {
    if (matches.length > 0) setCurrentPosition((position) => (position + direction + matches.length) % matches.length)
  }
  return (
    <div className="sec word-search">
      <label className="word-field">
        <span className="sr-only">{t('word.search.label')}</span>
        <input
          ref={inputRef}
          id="word-search-input"
          className="word-input"
          type="search"
          dir="auto"
          value={query}
          placeholder={t('word.search.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            step(event.shiftKey ? -1 : 1)
          }}
        />
      </label>
      <div className="word-search-row">
        <span id="word-search-count" className="word-search-count" aria-live="polite">
          {query.trim() === '' ? '' : matches.length === 0 ? t('word.search.none') : t('word.search.position', { current: formatCount(currentPosition + 1), total: formatCount(matches.length) })}
        </span>
        <button className="btn icon sm" id="word-search-previous-button" type="button" aria-label={t('word.search.previous')} data-tip={t('word.search.previous')} disabled={matches.length === 0} onClick={() => step(-1)}>
          <svg className="ico sm" aria-hidden="true">
            <use href="#i-previous" />
          </svg>
        </button>
        <button className="btn icon sm" id="word-search-next-button" type="button" aria-label={t('word.search.next')} data-tip={t('word.search.next')} data-tip-align="end" disabled={matches.length === 0} onClick={() => step(1)}>
          <svg className="ico sm" aria-hidden="true">
            <use href="#i-next" />
          </svg>
        </button>
      </div>
      <label className="word-check">
        <input id="word-search-match-case-checkbox" type="checkbox" checked={isCaseMatched} onChange={(event) => setIsCaseMatched(event.target.checked)} />
        {t('word.search.matchCase')}
      </label>
      <label className="word-check">
        <input id="word-search-whole-word-checkbox" type="checkbox" checked={isWholeWord} onChange={(event) => setIsWholeWord(event.target.checked)} />
        {t('word.search.wholeWord')}
      </label>
      <p className="word-panel-note">{t('word.search.hint')}</p>
    </div>
  )
}

type InfoPanelProps = { viewElement: HTMLElement | null; viewVersion: number; facts: WordDocumentFacts; fileName: string; fileSize: string; pageCount: number | null }

export function InfoPanel({ viewElement, viewVersion, facts, fileName, fileSize, pageCount }: InfoPanelProps) {
  const { locale, t, tp } = useT()
  const [counts, setCounts] = useState<ReturnType<typeof countDocumentText> | null>(null)
  useEffect(() => {
    // The counts are read from the shown view's DOM.
    // oxlint-disable-next-line react/set-state-in-effect
    if (viewElement) setCounts(countDocumentText(viewElement))
  }, [viewElement, viewVersion])
  const formatDate = (isoDate: string) => {
    const time = Date.parse(isoDate)
    return Number.isNaN(time) ? isoDate : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time)
  }
  const { properties } = facts
  const propertyRows: [string, string, string][] = [
    ['title', t('word.info.title'), properties.title],
    ['author', t('word.info.author'), properties.author],
    ['last-modified-by', t('word.info.lastModifiedBy'), properties.lastModifiedBy],
    ['created', t('word.info.created'), properties.created && formatDate(properties.created)],
    ['modified', t('word.info.modified'), properties.modified && formatDate(properties.modified)],
    ['application', t('word.info.application'), properties.application],
  ]
  const shownProperties = propertyRows.filter(([, , value]) => value)
  const words = counts?.words ?? 0
  return (
    <>
      <div className="sec">
        <div className="sec-title">{t('word.info.counts')}</div>
        <dl className="word-info-list" id="word-info-counts">
          <dt>{t('word.info.words')}</dt>
          <dd id="word-info-words">{formatCount(words)}</dd>
          <dt>{t('word.info.characters')}</dt>
          <dd id="word-info-characters">{formatCount(counts?.characters ?? 0)}</dd>
          <dt>{t('word.info.charactersNoSpaces')}</dt>
          <dd id="word-info-characters-no-spaces">{formatCount(counts?.charactersWithoutSpaces ?? 0)}</dd>
          <dt>{t('word.info.paragraphs')}</dt>
          <dd id="word-info-paragraphs">{formatCount(counts?.paragraphs ?? 0)}</dd>
          <dt>{t('word.info.pages')}</dt>
          <dd id="word-info-pages">{pageCount !== null ? formatCount(pageCount) : t('word.info.pagesAbout', { count: formatCount(Math.max(1, Math.ceil(words / 500))) })}</dd>
          <dt>{t('word.info.readingTimeLabel')}</dt>
          <dd id="word-info-reading-time">{tp('word.info.readingTime', Math.max(1, Math.ceil(words / 230)))}</dd>
        </dl>
        <p className="word-panel-note">{t('word.info.countNote')}</p>
      </div>
      <div className="sec">
        <div className="sec-title">{t('word.info.properties')}</div>
        {shownProperties.length === 0 ? (
          <p className="word-panel-note">{t('word.info.noProperties')}</p>
        ) : (
          <dl className="word-info-list" id="word-info-properties">
            {shownProperties.map(([key, label, value]) => (
              <div key={key} className="word-info-row">
                <dt>{label}</dt>
                <dd id={`word-info-${key}`} dir="auto">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="sec">
        <div className="sec-title">{t('word.info.file')}</div>
        <dl className="word-info-list">
          <dt>{t('word.info.file')}</dt>
          <dd dir="auto">
            <bdi>{fileName}</bdi> · {fileSize}
          </dd>
          <dt>{t('word.info.macros')}</dt>
          <dd id="word-info-macros">{facts.hasMacros ? t('word.info.hasMacros') : t('word.info.noMacros')}</dd>
        </dl>
      </div>
    </>
  )
}

// Reads the shown view aloud, one paragraph at a time (the shared panel offers on-device voices only).
export function ListenPanel({ viewElement, viewVersion }: { viewElement: HTMLElement | null; viewVersion: number }) {
  const readParagraphs = (): ReadAloudPart[] => (viewElement ? listTextBlocks(viewElement).map((element) => ({ element, text: readBlockText(element, true).text.trim() })) : [])
  return <ReadAloudPanel readParts={readParagraphs} resetKey={viewVersion} isReady={viewElement !== null} />
}

export function NotesPanel({ notes, onJump }: { notes: WordNote[]; onJump: (anchorId: string) => void }) {
  const { locale, t } = useT()
  if (notes.length === 0) return <p className="word-panel-note">{t('word.notes.empty')}</p>
  return (
    <ol className="word-note-list">
      {notes.map((note, position) => (
        <li key={position}>
          <NoteCard note={note} locale={locale} id={`word-note-item-${position}`} onJump={onJump} />
        </li>
      ))}
    </ol>
  )
}

export function NoteCard({ note, locale, id, onJump }: { note: WordNote; locale: string; id: string; onJump: (anchorId: string) => void }) {
  const { t } = useT()
  const time = Date.parse(note.date)
  const kindLabel = note.kind === 'comment' ? t('word.notes.comment') : note.kind === 'inserted' ? t('word.notes.inserted') : t('word.notes.deleted')
  return (
    <button className={`word-note-card kind-${note.kind}`} id={id} type="button" disabled={!note.anchorId} onClick={() => note.anchorId && onJump(note.anchorId)}>
      <span className="word-note-head">
        <span className="word-note-kind">{kindLabel}</span>
        <bdi className="word-note-author">{note.author || t('word.notes.unknownAuthor')}</bdi>
      </span>
      {!Number.isNaN(time) && <span className="word-note-date">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(time)}</span>}
      <span className="word-note-text" dir="auto">
        {note.text}
      </span>
    </button>
  )
}
