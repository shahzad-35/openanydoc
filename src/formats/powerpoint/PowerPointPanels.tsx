// The PowerPoint viewer's parts loaded on first use: search across slide text and notes, read aloud, and the presenter view with
// its audience window.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { PptxViewer, SlideHandle } from '@aiden0z/pptx-renderer'
import { useT } from '../../i18n'
import ReadAloudPanel from '../ReadAloudPanel'
import type { ReadAloudPart } from '../ReadAloudPanel'
import type { SlideText } from './presentationText'
import { renderSlideInBox } from './slideCanvas'

export type SlideSearchResult = { slideIndex: number; place: 'slide' | 'notes'; before: string; match: string; after: string }

const SNIPPET_RADIUS = 36
const escapeForPattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function findInSlides(slides: SlideText[], query: string, isCaseMatched: boolean): SlideSearchResult[] {
  if (query.trim() === '') return []
  const pattern = new RegExp(escapeForPattern(query), isCaseMatched ? 'gu' : 'giu')
  const results: SlideSearchResult[] = []
  slides.forEach((slide, slideIndex) => {
    const places: [SlideSearchResult['place'], string[]][] = [['slide', [slide.title, ...slide.paragraphs]], ['notes', slide.notes.split('\n')]]
    for (const [place, texts] of places) {
      for (const text of texts) {
        for (const found of text.matchAll(pattern)) {
          results.push({
            slideIndex,
            place,
            before: (found.index > SNIPPET_RADIUS ? '…' : '') + text.slice(Math.max(0, found.index - SNIPPET_RADIUS), found.index),
            match: found[0],
            after: text.slice(found.index + found[0].length, found.index + found[0].length + SNIPPET_RADIUS) + (text.length > found.index + found[0].length + SNIPPET_RADIUS ? '…' : ''),
          })
        }
      }
    }
  })
  return results
}

type SearchPanelProps = { slides: SlideText[]; focusRequest: number; onOpenResult: (result: SlideSearchResult, query: string, isCaseMatched: boolean) => void }

export function SlideSearchPanel({ slides, focusRequest, onOpenResult }: SearchPanelProps) {
  const { t, tp } = useT()
  const [query, setQuery] = useState('')
  const [isCaseMatched, setIsCaseMatched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusRequest])
  const results = findInSlides(slides, query, isCaseMatched)
  return (
    <div className="sec ppt-search">
      <label className="ppt-field">
        <span className="sr-only">{t('powerpoint.search.label')}</span>
        <input ref={inputRef} id="ppt-search-input" className="ppt-input" type="search" dir="auto" value={query} placeholder={t('powerpoint.search.placeholder')} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className="ppt-check">
        <input id="ppt-search-match-case-checkbox" type="checkbox" checked={isCaseMatched} onChange={(event) => setIsCaseMatched(event.target.checked)} />
        {t('powerpoint.search.matchCase')}
      </label>
      <p id="ppt-search-count" className="ppt-panel-note" aria-live="polite">
        {query.trim() === '' ? '' : results.length === 0 ? t('powerpoint.search.none') : tp('powerpoint.search.count', results.length)}
      </p>
      <ol className="ppt-search-results">
        {results.slice(0, 500).map((result, position) => (
          <li key={position}>
            <button id={`ppt-search-result-${position}`} type="button" className="ppt-search-result" onClick={() => onOpenResult(result, query, isCaseMatched)}>
              <span className="ppt-search-place">
                {t('powerpoint.search.slideNumber', { number: result.slideIndex + 1 })} · {result.place === 'slide' ? t('powerpoint.search.inSlide') : t('powerpoint.search.inNotes')}
              </span>
              <span className="ppt-search-snippet" dir="auto">
                {result.before}
                <mark>{result.match}</mark>
                {result.after}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

type ListenPanelProps = { slides: SlideText[]; currentSlideIndex: number; getNotesElement: () => HTMLElement | null; onGoToSlide: (slideIndex: number) => void }

// Reads the slide text or the speaker notes, of this slide or from this slide to the end; the shown slide follows the reading.
export function SlideListenPanel({ slides, currentSlideIndex, getNotesElement, onGoToSlide }: ListenPanelProps) {
  const { t } = useT()
  const [source, setSource] = useState<'slide' | 'notes'>('slide')
  const [scope, setScope] = useState<'current' | 'rest'>('current')
  function readParts(): ReadAloudPart[] {
    const lastSlideIndex = scope === 'current' ? currentSlideIndex : slides.length - 1
    const parts: ReadAloudPart[] = []
    for (let slideIndex = currentSlideIndex; slideIndex <= lastSlideIndex; slideIndex++) {
      const slide = slides[slideIndex]
      const texts = source === 'slide' ? [slide.title, ...slide.paragraphs] : slide.notes.split('\n')
      for (const text of texts) parts.push({ text, element: source === 'notes' ? (getNotesElement() ?? undefined) : undefined, onStart: () => onGoToSlide(slideIndex) })
    }
    return parts
  }
  return (
    <ReadAloudPanel readParts={readParts} resetKey={`${source}-${scope}`} isReady={slides.length > 0}>
      <label className="read-aloud-field">
        <span>{t('powerpoint.listen.read')}</span>
        <select id="ppt-listen-source-select" value={source} onChange={(event) => setSource(event.target.value as 'slide' | 'notes')}>
          <option value="slide">{t('powerpoint.listen.slideText')}</option>
          <option value="notes">{t('powerpoint.listen.notes')}</option>
        </select>
      </label>
      <label className="read-aloud-field">
        <span>{t('powerpoint.listen.scope')}</span>
        <select id="ppt-listen-scope-select" value={scope} onChange={(event) => setScope(event.target.value as 'current' | 'rest')}>
          <option value="current">{t('powerpoint.listen.thisSlide')}</option>
          <option value="rest">{t('powerpoint.listen.toTheEnd')}</option>
        </select>
      </label>
    </ReadAloudPanel>
  )
}

// Draws a slide into a container, scaled to fit it, and again when the container (or its window) changes size.
function drawSlideInContainer(viewer: PptxViewer, slideIndex: number, container: HTMLElement, ownerWindow: Window) {
  let handle: SlideHandle | null = null
  const draw = () => {
    handle?.dispose()
    container.replaceChildren()
    const scale = Math.min(container.clientWidth / viewer.slideWidth, container.clientHeight / viewer.slideHeight)
    if (scale > 0) handle = renderSlideInBox(viewer, slideIndex, container, scale)
  }
  draw()
  const resizeObserver = new (ownerWindow as typeof window).ResizeObserver(draw)
  resizeObserver.observe(container)
  return () => {
    resizeObserver.disconnect()
    handle?.dispose()
    container.replaceChildren()
  }
}

const formatElapsed = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

type PresenterViewProps = {
  viewer: PptxViewer
  deckName: string
  slides: SlideText[]
  currentSlideIndex: number
  onGoToSlide: (slideIndex: number) => void
  onExit: () => void
  onPresentHere: () => void
}

// Current slide, next slide, notes and a timer in this tab; the audience sees the slide alone in a second window, which follows
// every move and has its own Full screen button (a window can only go full screen from its own click).
export function PresenterView({ viewer, deckName, slides, currentSlideIndex, onGoToSlide, onExit, onPresentHere }: PresenterViewProps) {
  const { locale, t } = useT()
  const currentSlideRef = useRef<HTMLDivElement>(null)
  const nextSlideRef = useRef<HTMLDivElement>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [clock, setClock] = useState(() => new Date())
  const [notesTextSize, setNotesTextSize] = useState(20)
  const [audienceWindow, setAudienceWindow] = useState<Window | null>(null)
  const [isPopupBlocked, setIsPopupBlocked] = useState(false)
  const hasNextSlide = currentSlideIndex + 1 < viewer.slideCount

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date())
      if (isTimerRunning) setElapsedSeconds((seconds) => seconds + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isTimerRunning])

  useEffect(() => {
    const container = currentSlideRef.current
    if (container) return drawSlideInContainer(viewer, currentSlideIndex, container, window)
  }, [viewer, currentSlideIndex])
  useEffect(() => {
    const container = nextSlideRef.current
    if (container && hasNextSlide) return drawSlideInContainer(viewer, currentSlideIndex + 1, container, window)
  }, [viewer, currentSlideIndex, hasNextSlide])

  // The audience window follows the current slide.
  useEffect(() => {
    const container = audienceWindow?.document.getElementById('audience-slide')
    if (!audienceWindow || !container) return
    return drawSlideInContainer(viewer, currentSlideIndex, container, audienceWindow)
  }, [viewer, audienceWindow, currentSlideIndex])

  // The audience window closes with the presenter view (and with this page).
  useEffect(() => {
    if (!audienceWindow) return
    const closeAudienceWindow = () => audienceWindow.close()
    window.addEventListener('pagehide', closeAudienceWindow)
    const watchClosed = window.setInterval(() => {
      if (audienceWindow.closed) setAudienceWindow(null)
    }, 1000)
    return () => {
      window.removeEventListener('pagehide', closeAudienceWindow)
      window.clearInterval(watchClosed)
      closeAudienceWindow()
    }
  }, [audienceWindow])

  function openAudienceWindow() {
    if (audienceWindow && !audienceWindow.closed) {
      audienceWindow.focus()
      return
    }
    const opened = window.open('', 'openanydoc-audience', 'popup,width=960,height=600')
    if (!opened) {
      setIsPopupBlocked(true)
      return
    }
    setIsPopupBlocked(false)
    const audienceDocument = opened.document
    audienceDocument.title = t('powerpoint.presenter.audienceTitle', { name: deckName })
    audienceDocument.documentElement.lang = locale
    audienceDocument.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    audienceDocument.body.replaceChildren()
    audienceDocument.body.style.cssText = 'margin:0;height:100vh;background:#000;overflow:hidden;font-family:system-ui,sans-serif'
    const slideContainer = audienceDocument.createElement('div')
    slideContainer.id = 'audience-slide'
    slideContainer.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center'
    const fullscreenButton = audienceDocument.createElement('button')
    fullscreenButton.id = 'audience-fullscreen-button'
    fullscreenButton.type = 'button'
    fullscreenButton.textContent = t('powerpoint.presenter.audienceFullscreen')
    fullscreenButton.style.cssText = 'position:fixed;top:12px;inset-inline-end:12px;z-index:1;padding:8px 14px;border:0;border-radius:8px;background:rgba(255,255,255,.85);color:#111;font:500 14px system-ui,sans-serif;cursor:pointer'
    fullscreenButton.addEventListener('click', () => void audienceDocument.documentElement.requestFullscreen().catch(() => undefined))
    audienceDocument.addEventListener('fullscreenchange', () => {
      fullscreenButton.hidden = audienceDocument.fullscreenElement !== null
    })
    // Keys pressed in the audience window move the slides too.
    const forwardArrow = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight'
    const backwardArrow = locale === 'ar' ? 'ArrowRight' : 'ArrowLeft'
    audienceDocument.addEventListener('keydown', (event) => {
      if ([forwardArrow, 'ArrowDown', 'PageDown', ' '].includes(event.key)) onGoToSlide(viewer.currentSlideIndex + 1)
      if ([backwardArrow, 'ArrowUp', 'PageUp'].includes(event.key)) onGoToSlide(viewer.currentSlideIndex - 1)
    })
    audienceDocument.body.append(slideContainer, fullscreenButton)
    setAudienceWindow(opened)
  }

  const notes = slides[currentSlideIndex]?.notes ?? ''
  return (
    <div id="presenter-view" role="dialog" aria-modal="true" aria-labelledby="presenter-title">
      <header className="presenter-bar">
        <h2 id="presenter-title" className="presenter-title">
          {t('powerpoint.presenter.title')}
        </h2>
        <span id="presenter-slide-counter" className="presenter-counter" dir="ltr">
          {currentSlideIndex + 1} / {viewer.slideCount}
        </span>
        <span className="presenter-timer">
          <span className="sr-only">{t('powerpoint.presenter.timer')}</span>
          <span id="presenter-timer" dir="ltr">
            {formatElapsed(elapsedSeconds)}
          </span>
          <button className="btn sm" id="presenter-timer-pause-button" type="button" onClick={() => setIsTimerRunning((isRunning) => !isRunning)}>
            {isTimerRunning ? t('powerpoint.presenter.pause') : t('powerpoint.presenter.resume')}
          </button>
          <button className="btn sm" id="presenter-timer-reset-button" type="button" onClick={() => setElapsedSeconds(0)}>
            {t('powerpoint.presenter.reset')}
          </button>
        </span>
        <span id="presenter-clock" className="presenter-clock" aria-label={t('powerpoint.presenter.clock')}>
          {new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(clock)}
        </span>
        <span className="spacer" />
        <button className="btn sm primary" id="audience-window-button" type="button" onClick={openAudienceWindow}>
          {audienceWindow ? t('powerpoint.presenter.audienceOpen') : t('powerpoint.presenter.openAudience')}
        </button>
        <button className="btn sm" id="presenter-exit-button" type="button" onClick={onExit}>
          {t('powerpoint.presenter.exit')}
        </button>
      </header>
      {isPopupBlocked && (
        <p id="presenter-popup-blocked" className="presenter-popup-blocked" role="alert">
          {t('powerpoint.presenter.popupBlocked')}{' '}
          <button className="btn sm" id="present-here-button" type="button" onClick={onPresentHere}>
            {t('powerpoint.presenter.presentHere')}
          </button>
        </p>
      )}
      <div className="presenter-body">
        <section className="presenter-current" aria-label={t('powerpoint.counterLabel', { current: currentSlideIndex + 1, total: viewer.slideCount })}>
          <div id="presenter-current-slide" ref={currentSlideRef} className="presenter-slide" dir="ltr" />
          <div className="presenter-nav">
            <button className="btn" id="presenter-previous-button" type="button" disabled={currentSlideIndex === 0} onClick={() => onGoToSlide(currentSlideIndex - 1)}>
              {t('powerpoint.previous')}
            </button>
            <button className="btn primary" id="presenter-next-button" type="button" disabled={!hasNextSlide} onClick={() => onGoToSlide(currentSlideIndex + 1)}>
              {t('powerpoint.next')}
            </button>
          </div>
        </section>
        <aside className="presenter-side">
          <h3 className="presenter-label">{t('powerpoint.presenter.next')}</h3>
          {hasNextSlide ? (
            <div id="presenter-next-slide" ref={nextSlideRef} className="presenter-slide presenter-next" dir="ltr" />
          ) : (
            <p id="presenter-end" className="presenter-end">
              {t('powerpoint.presenter.end')}
            </p>
          )}
          <div className="presenter-notes-head">
            <h3 className="presenter-label">{t('powerpoint.notes.label')}</h3>
            <button className="btn icon sm" id="presenter-notes-smaller-button" type="button" aria-label={t('powerpoint.presenter.notesSmaller')} data-tip={t('powerpoint.presenter.notesSmaller')} disabled={notesTextSize <= 14} onClick={() => setNotesTextSize((size) => size - 2)}>
              A−
            </button>
            <button className="btn icon sm" id="presenter-notes-larger-button" type="button" aria-label={t('powerpoint.presenter.notesLarger')} data-tip={t('powerpoint.presenter.notesLarger')} data-tip-align="end" disabled={notesTextSize >= 36} onClick={() => setNotesTextSize((size) => size + 2)}>
              A+
            </button>
          </div>
          <div id="presenter-notes" className="presenter-notes" dir="auto" style={{ fontSize: `${notesTextSize}px` }}>
            {notes || t('powerpoint.notes.empty')}
          </div>
        </aside>
      </div>
    </div>
  )
}
