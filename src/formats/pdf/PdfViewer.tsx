// Shows a PDF with pdf.js (pdfjs-dist, Apache-2.0): continuous pages with a text layer (selectable, searchable, right to left
// where the PDF's text is), page thumbnails, zoom, fit to width or page, rotation, a page counter with go-to-page, search with
// highlights, and a password prompt. Everything runs in this tab: the file goes to pdf.js's worker on this device, a password
// goes only to pdf.js, and the only other reads are the site's own font and decoder files under /pdfjs/ when a PDF needs them.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { EventBus, PDFFindController, PDFViewer as PdfJsViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import { FatalFileError } from '../../components/Messages'
import NextSteps from '../../components/NextSteps'
import { localizePath, useT } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import { PDFJS_DATA_ROOT, loadPdfLibrary, pdfDocumentOptions } from './pdfLibrary'
import { reorderRightToLeftTextOf } from './pdfTextOrder'
import { DropOverlay, Icon, SheetIconSprite, Toolbar, ToolbarButton, ToolbarSeparator, TopBar, WorkbenchDialog, useIsNarrowScreen, useThemeToggle } from '../sheet/SheetChrome'
import '../sheet/sheetChrome.css'
import './pdfViewer.css'

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const THUMBNAIL_WIDTH = 120
// The viewer's own words (page labels for screen readers) would come from pdf.js's translation files, which it fetches; the
// site gives it none, so nothing is fetched and the page keeps the site's own labels.
const silentLocalization = {
  getLanguage: () => document.documentElement.lang || 'en',
  getDirection: () => 'ltr',
  get: async () => '',
  translate: async () => {},
  translateOnce: async () => {},
  pause: () => {},
  resume: () => {},
  destroy: async () => {},
}

type LoadState = 'loading' | 'ready' | 'failed' | 'locked'
type FindRequest = { query: string; isCaseMatched: boolean; isWholeWord: boolean; findPrevious?: boolean; type: '' | 'again' }

export default function PdfViewer({ openedFile, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t } = useT()
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const fileName = openedFile.file.name
  const [loadState, setLoadState] = useState<LoadState>('loading')
  // pdf.js's own code could not be fetched (offline before it was cached, or an older page after a release): thrown while drawing,
  // so App's LoadFailedBoundary shows the reload message rather than calling the file damaged.
  const [codeLoadError, setCodeLoadError] = useState<unknown>(null)
  if (codeLoadError) throw codeLoadError
  const [passwordPrompt, setPasswordPrompt] = useState<'needed' | 'wrong' | null>(null)
  const [password, setPassword] = useState('')
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [scale, setScale] = useState(1)
  const [scalePreset, setScalePreset] = useState<string>('page-width')
  const [rotation, setRotation] = useState(0)
  const [areThumbnailsShown, setAreThumbnailsShown] = useState(!isNarrow)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isCaseMatched, setIsCaseMatched] = useState(false)
  const [isWholeWord, setIsWholeWord] = useState(false)
  const [matches, setMatches] = useState({ current: 0, total: 0 })
  const [isSearching, setIsSearching] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const thumbnailListRef = useRef<HTMLOListElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<PdfJsViewer | null>(null)
  const eventBusRef = useRef<EventBus | null>(null)
  const findControllerRef = useRef<PDFFindController | null>(null)
  const passwordCallbackRef = useRef<((password: string) => void) | null>(null)
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const isReady = loadState === 'ready'

  useEffect(() => {
    const scrollElement = scrollRef.current
    const pagesElement = pagesRef.current
    if (!scrollElement || !pagesElement) return
    let isCancelled = false
    setLoadState('loading')
    setPasswordPrompt(null)
    setPdfDocument(null)
    setPageCount(0)
    setCurrentPage(1)
    setRotation(0)
    setMatches({ current: 0, total: 0 })

    let isLibraryLoaded = false
    loadPdfLibrary()
      .then(async ({ pdfjs, viewer }) => {
        isLibraryLoaded = true
        if (isCancelled) return
        const eventBus = new viewer.EventBus()
        const linkService = new viewer.PDFLinkService({ eventBus, externalLinkTarget: viewer.LinkTarget.BLANK, externalLinkRel: 'noopener noreferrer nofollow' })
        const findController = new viewer.PDFFindController({ eventBus, linkService, updateMatchesCountOnProgress: true })
        const pdfViewer = new viewer.PDFViewer({
          container: scrollElement,
          viewer: pagesElement,
          eventBus,
          linkService,
          findController,
          l10n: silentLocalization as unknown as NonNullable<ConstructorParameters<typeof viewer.PDFViewer>[0]['l10n']>,
          annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS,
          imageResourcesPath: `${PDFJS_DATA_ROOT}web/images/`,
        })
        linkService.setViewer(pdfViewer)
        eventBus.on('pagesinit', () => {
          pdfViewer.currentScaleValue = isNarrow ? 'page-width' : 'auto'
        })
        eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
          setCurrentPage(pageNumber)
          setPageInput(String(pageNumber))
        })
        eventBus.on('scalechanging', ({ scale: newScale, presetValue }: { scale: number; presetValue?: string }) => {
          setScale(newScale)
          setScalePreset(presetValue ?? '')
        })
        eventBus.on('rotationchanging', ({ pagesRotation }: { pagesRotation: number }) => setRotation(pagesRotation))
        eventBus.on('updatefindmatchescount', ({ matchesCount }: { matchesCount: { current: number; total: number } }) => setMatches(matchesCount))
        eventBus.on('updatefindcontrolstate', ({ matchesCount, state }: { matchesCount: { current: number; total: number }; state: number }) => {
          setMatches(matchesCount)
          setIsSearching(state === viewer.FindState.PENDING)
        })
        viewerRef.current = pdfViewer
        eventBusRef.current = eventBus
        findControllerRef.current = findController

        // pdf.js moves the bytes it is given to its worker, so it gets a copy: the opened file stays whole for Download.
        const loadingTask = pdfjs.getDocument(pdfDocumentOptions(openedFile.contents))
        loadingTaskRef.current = loadingTask
        loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number) => {
          passwordCallbackRef.current = updatePassword
          setPasswordPrompt(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? 'wrong' : 'needed')
        }
        const openedDocument = await loadingTask.promise
        if (isCancelled) return
        reorderRightToLeftTextOf(await openedDocument.getPage(1))
        setPasswordPrompt(null)
        pdfViewer.setDocument(openedDocument)
        linkService.setDocument(openedDocument)
        setPdfDocument(openedDocument)
        setPageCount(openedDocument.numPages)
        setLoadState('ready')
      })
      .catch((error) => {
        if (isCancelled) return
        if (!isLibraryLoaded) setCodeLoadError(error)
        else setLoadState((state) => (state === 'locked' ? 'locked' : 'failed'))
      })

    return () => {
      isCancelled = true
      passwordCallbackRef.current = null
      viewerRef.current?.setDocument(null as unknown as PDFDocumentProxy)
      viewerRef.current = null
      eventBusRef.current = null
      findControllerRef.current = null
      // Destroying the loading task also frees the document and stops its worker.
      void loadingTaskRef.current?.destroy()
      loadingTaskRef.current = null
      pagesElement.replaceChildren()
    }
    // The viewer is built once per file; isNarrow only picks the first zoom.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFile.contents])

  // Each thumbnail is drawn once it scrolls into the list (and again when the pages are rotated).
  useEffect(() => {
    const thumbnailList = thumbnailListRef.current
    if (!pdfDocument || !thumbnailList || !areThumbnailsShown) return
    let isCancelled = false
    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const canvas = entry.target as HTMLCanvasElement
        intersectionObserver.unobserve(canvas)
        const pageNumber = Number(canvas.dataset.pageNumber)
        void pdfDocument.getPage(pageNumber).then((page) => {
          if (isCancelled) return
          const unscaled = page.getViewport({ scale: 1, rotation: page.rotate + rotation })
          const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH / unscaled.width, rotation: page.rotate + rotation })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          return page.render({ canvas, viewport }).promise
        }).catch(() => undefined)
      }
    }, { root: thumbnailList, rootMargin: '300px 0px' })
    thumbnailList.querySelectorAll('canvas').forEach((canvas) => intersectionObserver.observe(canvas))
    return () => {
      isCancelled = true
      intersectionObserver.disconnect()
    }
  }, [pdfDocument, areThumbnailsShown, rotation])

  useEffect(() => {
    document.getElementById(`pdf-thumbnail-${currentPage}`)?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  // Ctrl/⌘+F opens the search in the document; Ctrl/⌘ +, − and 0 zoom.
  useEffect(() => {
    if (!isReady) return
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openSearch()
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomBy(1)
      } else if (event.key === '-') {
        event.preventDefault()
        zoomBy(-1)
      } else if (event.key === '0') {
        event.preventDefault()
        setScaleValue('page-width')
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
    // The handlers only read refs and set state.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady])

  function goToPage(pageNumber: number) {
    const pdfViewer = viewerRef.current
    if (!pdfViewer || pageCount === 0) return
    pdfViewer.currentPageNumber = Math.min(pageCount, Math.max(1, Math.round(pageNumber)))
  }
  function setScaleValue(value: string) {
    if (viewerRef.current) viewerRef.current.currentScaleValue = value
  }
  function zoomBy(direction: 1 | -1) {
    const pdfViewer = viewerRef.current
    if (!pdfViewer) return
    const currentScale = pdfViewer.currentScale
    const nextScale = direction > 0 ? ZOOM_STEPS.find((step) => step > currentScale + 0.001) : ZOOM_STEPS.findLast((step) => step < currentScale - 0.001)
    if (nextScale !== undefined) pdfViewer.currentScaleValue = String(nextScale)
  }
  function rotate() {
    if (viewerRef.current) viewerRef.current.pagesRotation = (viewerRef.current.pagesRotation + 90) % 360
  }
  function sendFind(request: FindRequest) {
    eventBusRef.current?.dispatch('find', { source: null, type: request.type, query: request.query, caseSensitive: request.isCaseMatched, entireWord: request.isWholeWord, highlightAll: true, findPrevious: request.findPrevious ?? false, matchDiacritics: false })
  }
  function openSearch() {
    setIsSearchOpen(true)
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }
  function closeSearch() {
    setIsSearchOpen(false)
    setQuery('')
    setMatches({ current: 0, total: 0 })
    sendFind({ query: '', isCaseMatched, isWholeWord, type: '' })
  }
  function submitPassword(event: FormEvent) {
    event.preventDefault()
    // The password goes only to pdf.js in this tab; the field is emptied straight away. The prompt stays open until pdf.js has
    // checked it: it closes when the PDF opens, or asks again with "wrong password".
    setPassword('')
    passwordCallbackRef.current?.(password)
  }
  function cancelPassword() {
    setPassword('')
    setPasswordPrompt(null)
    setLoadState('locked')
    void loadingTaskRef.current?.destroy()
  }

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: onOpenAnotherFile },
        { id: 'close', label: t('menu.close'), icon: 'x', onSelect: onClose },
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        { id: 'search', label: t('pdf.search.open'), icon: 'search', hint: 'Ctrl+F', isDisabled: !isReady, onSelect: openSearch },
        { id: 'thumbnails', label: t('pdf.thumbnails.toggle'), kind: 'checkbox', isChecked: areThumbnailsShown, isDisabled: !isReady, onSelect: () => setAreThumbnailsShown((isShown) => !isShown) },
        'separator',
        { id: 'zoom-in', label: t('pdf.zoomIn'), icon: 'zoom-in', hint: 'Ctrl++', isDisabled: !isReady, onSelect: () => zoomBy(1) },
        { id: 'zoom-out', label: t('pdf.zoomOut'), icon: 'zoom-out', hint: 'Ctrl+−', isDisabled: !isReady, onSelect: () => zoomBy(-1) },
        { id: 'fit-width', label: t('pdf.fitWidth'), kind: 'radio', isChecked: scalePreset === 'page-width', isDisabled: !isReady, onSelect: () => setScaleValue('page-width') },
        { id: 'fit-page', label: t('pdf.fitPage'), kind: 'radio', isChecked: scalePreset === 'page-fit', isDisabled: !isReady, onSelect: () => setScaleValue('page-fit') },
        { id: 'rotate', label: t('pdf.rotate'), icon: 'convert', isDisabled: !isReady, onSelect: rotate },
      ],
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        { id: 'menu-link-privacy', label: t('legal.privacy'), icon: 'lock', href: localizePath(locale, '/privacy') },
        { id: 'menu-link-terms', label: t('legal.terms'), icon: 'file', href: localizePath(locale, '/terms') },
        { id: 'menu-disclaimer', note: t('legal.disclaimer') },
      ],
    },
  ]

  const isFailed = loadState === 'failed' || loadState === 'locked'
  const matchesText = query.trim() === '' ? '' : isSearching && matches.total === 0 ? t('pdf.search.searching') : matches.total === 0 ? t('pdf.search.none') : t('pdf.search.position', { current: matches.current, total: matches.total })
  return (
    <div id="docs-workbench" className="pdf-workbench">
      <SheetIconSprite />
      <TopBar
        format="pdf"
        fileName={fileName}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload
        downloadLabel={t('toolbar.download')}
        downloadTip={t('pdf.downloadTip')}
        onDownload={() => downloadTextFile(fileName, openedFile.contents, 'application/pdf')}
        onHome={onClose}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <MenuBar menus={menus} isCompact={isNarrow} label={t('menu.bar')} />
      <Toolbar label={t('pdf.toolbar')}>
        <ToolbarButton id="pdf-thumbnails-toggle" label={t('pdf.thumbnails.toggle')} icon="panel" isPressed={areThumbnailsShown} isDisabled={!isReady} onClick={() => setAreThumbnailsShown((isShown) => !isShown)} />
        <ToolbarSeparator />
        <ToolbarButton id="pdf-previous-page-button" label={t('pdf.previousPage')} icon="previous" isDisabled={!isReady || currentPage <= 1} onClick={() => goToPage(currentPage - 1)} />
        <form
          className="pdf-page-form"
          onSubmit={(event) => {
            event.preventDefault()
            goToPage(Number(pageInput) || currentPage)
          }}
        >
          <label className="sr-only" htmlFor="pdf-page-input">
            {t('pdf.goToPage')}
          </label>
          <input id="pdf-page-input" className="pdf-page-input" type="text" inputMode="numeric" dir="ltr" value={pageInput} disabled={!isReady} onChange={(event) => setPageInput(event.target.value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660)))} onBlur={() => setPageInput(String(currentPage))} />
          <span id="pdf-page-count" className="pdf-page-count" dir="ltr">
            / {pageCount || '–'}
          </span>
        </form>
        <ToolbarButton id="pdf-next-page-button" label={t('pdf.nextPage')} icon="next" isDisabled={!isReady || currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)} />
        <ToolbarSeparator />
        <ToolbarButton id="pdf-zoom-out-button" label={t('pdf.zoomOut')} icon="zoom-out" isDisabled={!isReady || scale <= ZOOM_STEPS[0] + 0.001} onClick={() => zoomBy(-1)} />
        <span id="pdf-zoom-value" className="zoom-value" dir="ltr" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton id="pdf-zoom-in-button" label={t('pdf.zoomIn')} icon="zoom-in" isDisabled={!isReady || scale >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.001} onClick={() => zoomBy(1)} />
        <ToolbarButton id="pdf-fit-width-button" label={t('pdf.fitWidth')} icon="fit-width" isPressed={scalePreset === 'page-width'} isDisabled={!isReady} onClick={() => setScaleValue('page-width')} />
        <ToolbarButton id="pdf-rotate-button" label={t('pdf.rotate')} icon="convert" isDisabled={!isReady} onClick={rotate} />
        <ToolbarSeparator />
        <ToolbarButton id="pdf-search-button" label={t('pdf.search.open')} icon="search" isPressed={isSearchOpen} isDisabled={!isReady} onClick={() => (isSearchOpen ? closeSearch() : openSearch())} />
      </Toolbar>
      {!isFailed && (
        <NextSteps
          isReady={isReady}
          steps={[
            { id: 'search', label: t('pdf.search.open'), onSelect: openSearch },
            { id: 'fit-width', label: t('pdf.fitWidth'), onSelect: () => setScaleValue('page-width') },
          ]}
        />
      )}
      {isSearchOpen && (
        <div id="pdf-search-bar" className="pdf-search-bar" role="search">
          <label className="sr-only" htmlFor="pdf-search-input">
            {t('pdf.search.label')}
          </label>
          <input
            ref={searchInputRef}
            id="pdf-search-input"
            className="pdf-search-input"
            type="search"
            dir="auto"
            value={query}
            placeholder={t('pdf.search.placeholder')}
            onChange={(event) => {
              setQuery(event.target.value)
              sendFind({ query: event.target.value, isCaseMatched, isWholeWord, type: '' })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                sendFind({ query, isCaseMatched, isWholeWord, findPrevious: event.shiftKey, type: 'again' })
              } else if (event.key === 'Escape') closeSearch()
            }}
          />
          <span id="pdf-search-count" className="pdf-search-count" aria-live="polite">
            {matchesText}
          </span>
          <button className="btn icon sm" id="pdf-search-previous-button" type="button" aria-label={t('pdf.search.previous')} data-tip={t('pdf.search.previous')} disabled={matches.total === 0} onClick={() => sendFind({ query, isCaseMatched, isWholeWord, findPrevious: true, type: 'again' })}>
            <Icon name="previous" size="sm" />
          </button>
          <button className="btn icon sm" id="pdf-search-next-button" type="button" aria-label={t('pdf.search.next')} data-tip={t('pdf.search.next')} disabled={matches.total === 0} onClick={() => sendFind({ query, isCaseMatched, isWholeWord, type: 'again' })}>
            <Icon name="next" size="sm" />
          </button>
          <label className="pdf-search-option">
            <input
              id="pdf-search-match-case-checkbox"
              type="checkbox"
              checked={isCaseMatched}
              onChange={(event) => {
                setIsCaseMatched(event.target.checked)
                sendFind({ query, isCaseMatched: event.target.checked, isWholeWord, type: '' })
              }}
            />
            {t('pdf.search.matchCase')}
          </label>
          <label className="pdf-search-option">
            <input
              id="pdf-search-whole-word-checkbox"
              type="checkbox"
              checked={isWholeWord}
              onChange={(event) => {
                setIsWholeWord(event.target.checked)
                sendFind({ query, isCaseMatched, isWholeWord: event.target.checked, type: '' })
              }}
            />
            {t('pdf.search.wholeWord')}
          </label>
          <button className="btn icon sm" id="pdf-search-close-button" type="button" aria-label={t('pdf.search.close')} data-tip={t('pdf.search.close')} data-tip-align="end" onClick={closeSearch}>
            <Icon name="x" size="sm" />
          </button>
        </div>
      )}
      <div className="pdf-layout">
        {areThumbnailsShown && !isFailed && (
          <nav id="pdf-thumbnails" aria-label={t('pdf.thumbnails.label')}>
            <ol ref={thumbnailListRef}>
              {Array.from({ length: pageCount }, (_, pageIndex) => (
                <li key={`${pageIndex}-${rotation}`}>
                  <button id={`pdf-thumbnail-${pageIndex + 1}`} type="button" className="pdf-thumbnail" aria-label={t('pdf.thumbnails.page', { number: pageIndex + 1 })} aria-current={pageIndex + 1 === currentPage ? 'page' : undefined} onClick={() => {
                      goToPage(pageIndex + 1)
                      // On a phone the list covers the page; it closes once a page is picked.
                      if (isNarrow) setAreThumbnailsShown(false)
                    }}>
                    <canvas className="pdf-thumbnail-canvas" data-page-number={pageIndex + 1} width={THUMBNAIL_WIDTH} height={Math.round(THUMBNAIL_WIDTH * 1.414)} />
                    <span className="pdf-thumbnail-number">{pageIndex + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <main id="main" className="pdf-canvas">
          {loadState === 'loading' && passwordPrompt === null && (
            <p id="pdf-loading" className="pdf-loading">
              {t('pdf.loading')}
            </p>
          )}
          {loadState === 'failed' && <FatalFileError title={t('pdf.error.title')} reason={t('pdf.error.reason')} hint={t('pdf.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />}
          {loadState === 'locked' && <FatalFileError title={t('pdf.locked.title')} reason={t('pdf.locked.reason')} hint={t('pdf.locked.hint')} onOpenAnotherFile={onOpenAnotherFile} />}
          {/* pdf.js needs an absolutely positioned scroll box holding a .pdfViewer element. Pages are drawn as the PDF lays
              them out; the text layer inside each page gives Arabic runs their own direction. */}
          <div id="pdf-scroll" ref={scrollRef} dir="ltr" hidden={isFailed} className={isReady ? undefined : 'is-sizing'}>
            <div id="pdf-pages" ref={pagesRef} className="pdfViewer" />
          </div>
        </main>
      </div>
      <WorkbenchDialog id="pdf-password-dialog" titleId="pdf-password-title" isOpen={passwordPrompt !== null} onClose={cancelPassword}>
        <form onSubmit={submitPassword}>
          <div className="dlg-head">
            <h2 id="pdf-password-title">{t('pdf.password.title')}</h2>
          </div>
          <div className="dlg-body">
            <p className="pdf-password-text">{passwordPrompt === 'wrong' ? t('pdf.password.wrong') : t('pdf.password.needed', { name: fileName })}</p>
            <label className="field pdf-password-field">
              <span>{t('pdf.password.label')}</span>
              <input id="pdf-password-input" type="password" autoComplete="off" dir="ltr" value={password} autoFocus onChange={(event) => setPassword(event.target.value)} />
            </label>
            <p className="pdf-password-note">{t('pdf.password.localOnly')}</p>
          </div>
          <div className="dlg-foot">
            <span className="spacer" />
            <button className="btn" id="pdf-password-cancel-button" type="button" onClick={cancelPassword}>
              {t('pdf.password.cancel')}
            </button>
            <button className="btn primary" id="pdf-password-open-button" type="submit" disabled={password === ''}>
              {t('pdf.password.open')}
            </button>
          </div>
        </form>
      </WorkbenchDialog>
      <DropOverlay />
    </div>
  )
}
