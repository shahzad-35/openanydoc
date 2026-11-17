import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { PptxViewer } from '@aiden0z/pptx-renderer'
import type { SlideHandle } from '@aiden0z/pptx-renderer'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import { FatalFileError, Notice, useToast } from '../../components/Messages'
import NextSteps from '../../components/NextSteps'
import { localizePath, useT } from '../../i18n'
import { CONTACT_EMAIL } from '../../legalContent'
import { formatFileSize } from '../../useFileIntake'
import { getFormatCapabilities } from '../../whatsNew'
import { downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import { DropOverlay, Icon, SheetIconSprite, Sidebar, Toolbar, ToolbarButton, ToolbarSeparator, TopBar, useIsNarrowScreen, useThemeToggle } from '../sheet/SheetChrome'
import { outlineAsMarkdown, outlineAsText, readPresentationText } from './presentationText'
import { canvasToPngBlob, renderSlideInBox, renderSlideToCanvas, slideImageName, slidesToPngZip } from './slideCanvas'
import type { PresentationText } from './presentationText'
import type { SlideSearchResult } from './PowerPointPanels'
import '../sheet/sheetChrome.css'
import './powerPointViewer.css'

const SlideSearchPanel = lazy(() => import('./PowerPointPanels').then((module) => ({ default: module.SlideSearchPanel })))
const SlideListenPanel = lazy(() => import('./PowerPointPanels').then((module) => ({ default: module.SlideListenPanel })))
const PresenterView = lazy(() => import('./PowerPointPanels').then((module) => ({ default: module.PresenterView })))

type PowerPointPanelTab = 'search' | 'listen'

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
}
const THUMBNAIL_WIDTH = 160
const GRID_THUMBNAIL_WIDTH = 240
// Slides printed on a landscape page (A4 or Letter at 96 dpi, less a small margin).
const PRINT_AREA = { width: 1040, height: 720 }
// The renderer raises no error for a missing or unsupported picture: it draws its own grey box with this English text
// (pictures load after the slide, so the box can appear later). A slide with one counts as a slide it cannot display.
const RENDERER_FALLBACK_TEXT = /Image not found|Unsupported format:/

// The renderer sets a few styles (blend effects, equations) as style attributes, which the site's CSP refuses. The same text
// set through CSSOM is allowed and has the same effect, so style attributes are routed there.
let areStyleAttributesRouted = false
function routeStyleAttributesThroughCssom() {
  if (areStyleAttributesRouted) return
  areStyleAttributesRouted = true
  const setAttributeDirectly = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (name.toLowerCase() === 'style' && (this instanceof HTMLElement || this instanceof SVGElement)) this.style.cssText = value
    else setAttributeDirectly.call(this, name, value)
  }
}

// Draws each thumbnail of a list once it scrolls into view, so a long deck does not lay out every slide at once. Used by the
// sidebar and by the grid of all slides.
function drawThumbnailsWhenVisible(viewer: PptxViewer, listElement: HTMLElement, width: number, onSlideFailed: (slideIndex: number) => void, renderingIndexRef: { current: number | null }) {
  const thumbnailHandles: SlideHandle[] = []
  const fallbackObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const thumbnailPicture = (mutation.target as Element).closest<HTMLElement>('.slide-thumbnail-picture')
      if (thumbnailPicture && RENDERER_FALLBACK_TEXT.test(thumbnailPicture.textContent ?? '')) onSlideFailed(Number(thumbnailPicture.dataset.slideIndex))
    }
  })
  fallbackObserver.observe(listElement, { childList: true, subtree: true })
  const intersectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const thumbnailPicture = entry.target as HTMLElement
      intersectionObserver.unobserve(thumbnailPicture)
      const slideIndex = Number(thumbnailPicture.dataset.slideIndex)
      renderingIndexRef.current = slideIndex
      try {
        const thumbnailHandle = viewer.renderThumbnailToContainer(slideIndex, thumbnailPicture, { width })
        if (thumbnailHandle) thumbnailHandles.push(thumbnailHandle)
        else onSlideFailed(slideIndex)
      } catch {
        onSlideFailed(slideIndex)
      } finally {
        renderingIndexRef.current = null
      }
    }
  }, { root: listElement, rootMargin: '200px 0px' })
  listElement.querySelectorAll('.slide-thumbnail-picture').forEach((thumbnailPicture) => intersectionObserver.observe(thumbnailPicture))
  return () => {
    intersectionObserver.disconnect()
    fallbackObserver.disconnect()
    for (const thumbnailHandle of thumbnailHandles) thumbnailHandle.dispose()
  }
}

// Shows a presentation (.pptx, .ppsx, .potx, .pptm) one slide at a time with @aiden0z/pptx-renderer: thumbnails, speaker notes,
// a grid of all slides, search, read aloud, a presenter view, outline and picture exports, and printing. View only for now:
// the Edit toggle is drawn disabled until the registry gives PowerPoint `editing`. A slide the renderer cannot draw fully shows
// a placeholder instead of its half-drawn shapes.
export default function PowerPointViewer({ openedFile, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const { showToast } = useToast()
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const fileName = openedFile.file.name
  const deckName = fileName.replace(/\.[^.]+$/, '')
  const [renderState, setRenderState] = useState<'loading' | 'ready' | 'failed'>('loading')
  // The stage stays hidden until the slide has been sized to it: drawn at the renderer's size and resized after, the slide moved
  // (a layout shift of about 0.65 on a phone).
  const [isSlideSized, setIsSlideSized] = useState(false)
  const [slideCount, setSlideCount] = useState(0)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [failedSlideIndexes, setFailedSlideIndexes] = useState<ReadonlySet<number>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canGoFullscreen] = useState(() => document.fullscreenEnabled)
  const [presentationText, setPresentationText] = useState<PresentationText | null>(null)
  const [isNotesShown, setIsNotesShown] = useState(true)
  const [isGridShown, setIsGridShown] = useState(false)
  const [panelTab, setPanelTab] = useState<PowerPointPanelTab | null>(null)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [notesSearch, setNotesSearch] = useState<{ query: string; isCaseMatched: boolean } | null>(null)
  const [isPresenterShown, setIsPresenterShown] = useState(false)
  const [busyMessage, setBusyMessage] = useState('')
  const viewerRef = useRef<PptxViewer | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const slideViewRef = useRef<HTMLDivElement>(null)
  const thumbnailListRef = useRef<HTMLOListElement>(null)
  const gridListRef = useRef<HTMLOListElement>(null)
  const notesTextRef = useRef<HTMLDivElement>(null)
  // Thumbnails render synchronously; a shape error raised meanwhile belongs to that thumbnail's slide, not the shown one.
  const thumbnailIndexBeingRenderedRef = useRef<number | null>(null)
  const canEdit = getFormatCapabilities('powerpoint')?.canEdit ?? false
  const slides = presentationText?.slides ?? []
  const hasNotes = slides.some((slide) => slide.notes !== '')

  function markSlideFailed(slideIndex: number) {
    setFailedSlideIndexes((indexes) => (indexes.has(slideIndex) ? indexes : new Set(indexes).add(slideIndex)))
  }

  useEffect(() => {
    const slideView = slideViewRef.current
    if (!slideView) return
    routeStyleAttributesThroughCssom()
    const abortController = new AbortController()
    let openedViewer: PptxViewer | null = null
    const fallbackObserver = new MutationObserver(() => {
      if (RENDERER_FALLBACK_TEXT.test(slideView.textContent ?? '')) markSlideFailed(openedViewer?.currentSlideIndex ?? 0)
    })
    fallbackObserver.observe(slideView, { childList: true, subtree: true })
    setRenderState('loading')
    setIsSlideSized(false)
    setFailedSlideIndexes(new Set())
    setCurrentSlideIndex(0)
    setPresentationText(null)
    setIsGridShown(false)
    setIsPresenterShown(false)

    // The words and notes are read from the file next to the renderer, which has no notes.
    readPresentationText(openedFile.contents)
      .then((text) => {
        if (abortController.signal.aborted) return
        setPresentationText(text)
        setIsNotesShown(text.slides.some((slide) => slide.notes !== ''))
      })
      .catch(() => {
        if (!abortController.signal.aborted) setPresentationText({ slides: [], hasMacros: false })
      })

    PptxViewer.open(openedFile.contents, slideView, {
      renderMode: 'slide',
      fitMode: 'contain',
      lazySlides: true,
      lazyMedia: true,
      pdfjs: false,
      // Pictures linked from the web are never requested: the file stays on this device, and nothing reaches another server.
      externalMedia: 'block',
      signal: abortController.signal,
      onSlideChange: setCurrentSlideIndex,
      onSlideError: markSlideFailed,
      onNodeError: () => markSlideFailed(thumbnailIndexBeingRenderedRef.current ?? openedViewer?.currentSlideIndex ?? 0),
    })
      .then((viewer) => {
        if (abortController.signal.aborted) return viewer.destroy()
        if (viewer.slideCount === 0) {
          viewer.destroy()
          setRenderState('failed')
          return
        }
        openedViewer = viewer
        viewerRef.current = viewer
        setSlideCount(viewer.slideCount)
        setRenderState('ready')
      })
      .catch(() => {
        if (!abortController.signal.aborted) setRenderState('failed')
      })

    return () => {
      abortController.abort()
      fallbackObserver.disconnect()
      openedViewer?.destroy()
      viewerRef.current = null
    }
  }, [openedFile.contents])

  // The slide is as large as the stage allows in both directions (the renderer itself only fits the width), also in full screen.
  useEffect(() => {
    const stage = stageRef.current
    const slideView = slideViewRef.current
    const viewer = viewerRef.current
    if (renderState !== 'ready' || !stage || !slideView || !viewer) return
    const slideAspectRatio = viewer.slideWidth / viewer.slideHeight
    const resizeObserver = new ResizeObserver(() => {
      if (stage.clientWidth === 0) return
      slideView.style.width = `${Math.floor(Math.min(stage.clientWidth, stage.clientHeight * slideAspectRatio))}px`
      setIsSlideSized(true)
    })
    resizeObserver.observe(stage)
    return () => resizeObserver.disconnect()
  }, [renderState])

  useEffect(() => {
    const viewer = viewerRef.current
    const thumbnailList = thumbnailListRef.current
    if (renderState !== 'ready' || !viewer || !thumbnailList) return
    return drawThumbnailsWhenVisible(viewer, thumbnailList, THUMBNAIL_WIDTH, markSlideFailed, thumbnailIndexBeingRenderedRef)
  }, [renderState, slideCount, isNarrow])

  useEffect(() => {
    const viewer = viewerRef.current
    const gridList = gridListRef.current
    if (renderState !== 'ready' || !viewer || !gridList || !isGridShown) return
    gridList.querySelector<HTMLElement>(`#slide-grid-item-${currentSlideIndex + 1}`)?.focus()
    return drawThumbnailsWhenVisible(viewer, gridList, GRID_THUMBNAIL_WIDTH, markSlideFailed, thumbnailIndexBeingRenderedRef)
    // The grid is drawn when it opens; the slide it focuses is the one shown then.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [renderState, slideCount, isGridShown])

  useEffect(() => {
    document.getElementById(`slide-thumbnail-${currentSlideIndex + 1}`)?.scrollIntoView({ block: 'nearest' })
  }, [currentSlideIndex])

  useEffect(() => {
    const showFullscreenState = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', showFullscreenState)
    return () => document.removeEventListener('fullscreenchange', showFullscreenState)
  }, [])

  // A search match in the notes is marked there (CSS Custom Highlight API: the notes text itself is not changed).
  useEffect(() => {
    const notesText = notesTextRef.current
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
    CSS.highlights.delete('ppt-notes-search')
    if (!notesSearch || !notesText) return
    const pattern = new RegExp(notesSearch.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), notesSearch.isCaseMatched ? 'gu' : 'giu')
    const ranges: Range[] = []
    const walker = document.createTreeWalker(notesText, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      for (const found of node.data.matchAll(pattern)) {
        const range = new Range()
        range.setStart(node, found.index)
        range.setEnd(node, found.index + found[0].length)
        ranges.push(range)
      }
    }
    CSS.highlights.set('ppt-notes-search', new Highlight(...ranges))
    return () => {
      CSS.highlights.delete('ppt-notes-search')
    }
  }, [notesSearch, currentSlideIndex, isNotesShown])

  function goToSlide(slideIndex: number) {
    const viewer = viewerRef.current
    if (!viewer || slideIndex < 0 || slideIndex >= viewer.slideCount || slideIndex === viewer.currentSlideIndex) return
    void viewer.goToSlide(slideIndex)
  }

  // Arrow keys, Page Up/Down, Space, Home and End move between slides, unless the key is for a field, a menu or a button.
  // In Arabic the chrome is mirrored, so the left arrow goes forward.
  useEffect(() => {
    if (renderState !== 'ready') return
    function goToSlideByKey(event: KeyboardEvent) {
      const viewer = viewerRef.current
      if (!viewer || event.defaultPrevented || event.altKey) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openPanel('search')
        return
      }
      if (event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="menubar"], [role="menu"], dialog, #slide-grid')) return
      if (event.key === ' ' && target.closest('button, a')) return
      const forwardArrow = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight'
      const backwardArrow = locale === 'ar' ? 'ArrowRight' : 'ArrowLeft'
      let targetSlideIndex: number | null = null
      if ([forwardArrow, 'ArrowDown', 'PageDown', ' '].includes(event.key)) targetSlideIndex = viewer.currentSlideIndex + 1
      else if ([backwardArrow, 'ArrowUp', 'PageUp'].includes(event.key)) targetSlideIndex = viewer.currentSlideIndex - 1
      else if (event.key === 'Home') targetSlideIndex = 0
      else if (event.key === 'End') targetSlideIndex = viewer.slideCount - 1
      if (targetSlideIndex === null) return
      event.preventDefault()
      goToSlide(targetSlideIndex)
    }
    window.addEventListener('keydown', goToSlideByKey)
    return () => window.removeEventListener('keydown', goToSlideByKey)
    // openPanel only sets state.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [renderState, locale])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    } catch {
      // Some browsers and app views do not allow full screen; the page simply stays as it is.
    }
  }

  function openPanel(tab: PowerPointPanelTab) {
    setPanelTab(tab)
    if (tab === 'search') setSearchFocusRequest((request) => request + 1)
  }
  function openGridSlide(slideIndex: number) {
    setIsGridShown(false)
    goToSlide(slideIndex)
  }
  async function openSearchResult(result: SlideSearchResult, query: string, isCaseMatched: boolean) {
    const viewer = viewerRef.current
    if (!viewer) return
    setIsGridShown(false)
    viewer.clearSearchHighlights()
    if (viewer.currentSlideIndex !== result.slideIndex) await viewer.goToSlide(result.slideIndex)
    if (result.place === 'notes') {
      setIsNotesShown(true)
      setNotesSearch({ query, isCaseMatched })
      return
    }
    setNotesSearch(null)
    // The renderer finds the shape that holds the words once the slide is drawn, and outlines it on the slide.
    const onSlide = viewer.searchText(query, { matchCase: isCaseMatched }).find((found) => found.slideIndex === result.slideIndex)
    if (onSlide) await viewer.highlightSearchResult(onSlide)
  }
  function closePanel() {
    setPanelTab(null)
    setNotesSearch(null)
    viewerRef.current?.clearSearchHighlights()
  }

  function exportOutline(kind: 'markdown' | 'text') {
    const labels = { slide: t('powerpoint.export.slideLabel'), notes: t('powerpoint.notes.label') }
    if (kind === 'markdown') downloadTextFile(`${deckName}-outline.md`, outlineAsMarkdown(slides, deckName, labels), 'text/markdown;charset=utf-8')
    else downloadTextFile(`${deckName}-outline.txt`, outlineAsText(slides, deckName, labels), 'text/plain;charset=utf-8')
  }

  async function savePng(which: 'current' | 'all') {
    const viewer = viewerRef.current
    if (!viewer || busyMessage) return
    try {
      if (which === 'current') {
        setBusyMessage(t('powerpoint.png.working', { done: 0, total: 1 }))
        const canvas = await renderSlideToCanvas(viewer, viewer.currentSlideIndex)
        downloadTextFile(slideImageName(deckName, viewer.currentSlideIndex, viewer.slideCount), await canvasToPngBlob(canvas), 'image/png')
      } else {
        setBusyMessage(t('powerpoint.png.working', { done: 0, total: viewer.slideCount }))
        const zip = await slidesToPngZip(viewer, deckName, (doneCount) => setBusyMessage(t('powerpoint.png.working', { done: doneCount, total: viewer.slideCount })))
        downloadTextFile(`${deckName}-slides.zip`, zip, 'application/zip')
      }
    } catch (error) {
      showToast({ message: t('powerpoint.png.failed', { reason: error instanceof Error ? error.message : String(error) }), kind: 'error' })
    } finally {
      setBusyMessage('')
    }
  }

  // Every slide is drawn once into a print-only area, one per landscape page, then the browser's print dialog opens (Save as PDF
  // is one of its destinations). The area is removed when printing ends.
  async function printSlides() {
    const viewer = viewerRef.current
    if (!viewer || busyMessage) return
    setBusyMessage(t('powerpoint.printPreparing'))
    const printArea = document.createElement('div')
    printArea.id = 'print-slides'
    document.body.append(printArea)
    const scale = Math.min(PRINT_AREA.width / viewer.slideWidth, PRINT_AREA.height / viewer.slideHeight)
    const handles: SlideHandle[] = []
    for (let slideIndex = 0; slideIndex < viewer.slideCount; slideIndex++) {
      const page = document.createElement('div')
      page.className = 'print-slide'
      printArea.append(page)
      const handle = renderSlideInBox(viewer, slideIndex, page, scale)
      if (handle) handles.push(handle)
    }
    await Promise.all(handles.map((handle) => handle.ready.catch(() => undefined)))
    await Promise.all(Array.from(printArea.querySelectorAll('img'), (image) => image.decode().catch(() => undefined)))
    const finishPrinting = () => {
      window.removeEventListener('afterprint', finishPrinting)
      document.documentElement.classList.remove('printing-slides')
      for (const handle of handles) handle.dispose()
      printArea.remove()
    }
    window.addEventListener('afterprint', finishPrinting)
    document.documentElement.classList.add('printing-slides')
    setBusyMessage('')
    window.print()
  }

  async function presentHere() {
    setIsPresenterShown(false)
    await toggleFullscreen()
  }

  const isReady = renderState === 'ready'
  const slideNumber = currentSlideIndex + 1
  const isCurrentSlideFailed = failedSlideIndexes.has(currentSlideIndex)
  const currentNotes = slides[currentSlideIndex]?.notes ?? ''
  const reportSlideHref =
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('powerpoint.reportSubject', { number: slideNumber }))}` +
    `&body=${encodeURIComponent(t('powerpoint.reportBody'))}`
  const isWorking = busyMessage !== ''

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: onOpenAnotherFile },
        {
          id: 'export-outline',
          label: t('powerpoint.export.outline'),
          icon: 'file',
          isDisabled: !isReady || slides.length === 0,
          items: [
            { id: 'export-outline-markdown', label: t('powerpoint.export.outlineMarkdown'), onSelect: () => exportOutline('markdown') },
            { id: 'export-outline-text', label: t('powerpoint.export.outlineText'), onSelect: () => exportOutline('text') },
          ],
        },
        {
          id: 'save-png',
          label: t('powerpoint.png.menu'),
          icon: 'download',
          isDisabled: !isReady || isWorking,
          disabledReason: busyMessage,
          items: [
            { id: 'save-png-current', label: t('powerpoint.png.current'), onSelect: () => void savePng('current') },
            { id: 'save-png-all', label: t('powerpoint.png.all'), onSelect: () => void savePng('all') },
          ],
        },
        { id: 'print', label: t('powerpoint.print'), icon: 'print', isDisabled: !isReady || isWorking, onSelect: () => void printSlides() },
        { id: 'close', label: t('menu.close'), icon: 'x', onSelect: onClose },
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        { id: 'speaker-notes', label: t('powerpoint.view.notes'), kind: 'checkbox', isChecked: isNotesShown, isDisabled: !isReady, onSelect: () => setIsNotesShown((isShown) => !isShown) },
        { id: 'slide-grid', label: t('powerpoint.view.grid'), kind: 'checkbox', isChecked: isGridShown, isDisabled: !isReady, onSelect: () => setIsGridShown((isShown) => !isShown) },
        { id: 'search', label: t('powerpoint.view.search'), icon: 'search', hint: 'Ctrl+F', isDisabled: !isReady, onSelect: () => openPanel('search') },
        { id: 'read-aloud', label: t('powerpoint.view.readAloud'), icon: 'review', isDisabled: !isReady, onSelect: () => openPanel('listen') },
        'separator',
        { id: 'presenter-view', label: t('powerpoint.view.presenter'), icon: 'panel', isDisabled: !isReady, onSelect: () => setIsPresenterShown(true) },
        ...(canGoFullscreen ? [{ id: 'fullscreen', label: t('powerpoint.fullscreen'), icon: 'fullscreen', isDisabled: !isReady, onSelect: () => void toggleFullscreen() }] : []),
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

  return (
    <div id="docs-workbench">
      <SheetIconSprite />
      <TopBar
        format="pptx"
        fileName={fileName}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload
        downloadLabel={t('toolbar.download')}
        downloadTip={t('powerpoint.downloadTip')}
        onDownload={() => downloadTextFile(fileName, openedFile.contents, MIME_TYPE_BY_EXTENSION[fileName.split('.').pop()?.toLowerCase() ?? 'pptx'] ?? MIME_TYPE_BY_EXTENSION.pptx)}
        onHome={onClose}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <MenuBar menus={menus} isCompact={isNarrow} label={t('menu.bar')} />
      <Toolbar label={t('powerpoint.toolbar')}>
        <span id="beta-tag" className="beta-tag">
          {t('powerpoint.beta')}
        </span>
        <ToolbarButton id="previous-slide-button" label={t('powerpoint.previous')} icon="previous" isDisabled={!isReady || currentSlideIndex === 0} onClick={() => goToSlide(currentSlideIndex - 1)} />
        <span id="slide-counter" className="slide-counter" dir="ltr" aria-live="polite" aria-label={isReady ? t('powerpoint.counterLabel', { current: slideNumber, total: slideCount }) : undefined}>
          {isReady ? `${slideNumber} / ${slideCount}` : '–'}
        </span>
        <ToolbarButton id="next-slide-button" label={t('powerpoint.next')} icon="next" isDisabled={!isReady || currentSlideIndex >= slideCount - 1} onClick={() => goToSlide(currentSlideIndex + 1)} />
        <ToolbarSeparator />
        <ToolbarButton id="grid-view-toggle" label={t('powerpoint.view.grid')} icon="grid-x" isPressed={isGridShown} isDisabled={!isReady} onClick={() => setIsGridShown((isShown) => !isShown)} />
        <ToolbarButton id="notes-toggle" label={t('powerpoint.view.notes')} icon="file" isPressed={isNotesShown} isDisabled={!isReady} onClick={() => setIsNotesShown((isShown) => !isShown)} />
        <ToolbarButton id="panel-toggle-button" label={t('powerpoint.panelToggle')} icon="panel" isPressed={panelTab !== null} isDisabled={!isReady} onClick={() => (panelTab ? closePanel() : openPanel('search'))} />
        <ToolbarSeparator />
        <button className="tbtn labelled" id="presenter-view-button" type="button" aria-label={t('powerpoint.view.presenter')} data-tip={t('powerpoint.presenterTip')} disabled={!isReady} onClick={() => setIsPresenterShown(true)}>
          <Icon name="review" />
          <span className="desk-only">{t('powerpoint.presenterShort')}</span>
        </button>
        {canGoFullscreen && (
          <button className="tbtn labelled" id="fullscreen-button" type="button" aria-label={t('powerpoint.fullscreen')} data-tip={t('powerpoint.fullscreenTip')} disabled={!isReady} onClick={toggleFullscreen}>
            <Icon name="fullscreen" />
            <span className="desk-only">{t('powerpoint.fullscreen')}</span>
          </button>
        )}
        <button className="tbtn labelled" id="print-button" type="button" aria-label={t('powerpoint.print')} data-tip={t('powerpoint.printTip')} disabled={!isReady || isWorking} onClick={() => void printSlides()}>
          <Icon name="print" />
          <span className="desk-only">{t('powerpoint.printShort')}</span>
        </button>
        <span className="spacer" />
        <a className="tbtn labelled" id="report-slide-link" href={reportSlideHref} aria-label={t('powerpoint.report')} data-tip={t('powerpoint.reportTip')}>
          <Icon name="flag" />
          <span className="desk-only">{t('powerpoint.report')}</span>
        </a>
        <button className="tbtn labelled" id="edit-toggle" type="button" aria-pressed={false} aria-label={t(canEdit ? 'powerpoint.edit' : 'powerpoint.editComingSoon')} data-tip={t(canEdit ? 'powerpoint.edit' : 'powerpoint.editComingSoon')} data-tip-align="end" disabled={!canEdit}>
          <Icon name="edit" />
          <span className="desk-only">{t(canEdit ? 'powerpoint.edit' : 'powerpoint.editComingSoon')}</span>
        </button>
      </Toolbar>
      {renderState !== 'failed' && (
        <NextSteps
          isReady={isReady}
          steps={[
            { id: 'presenter-view', label: t('powerpoint.view.presenter'), onSelect: () => setIsPresenterShown(true) },
            ...(canGoFullscreen ? [{ id: 'fullscreen', label: t('nextSteps.presentFullscreen'), onSelect: () => void toggleFullscreen() }] : []),
            { id: 'save-png', label: t('powerpoint.nextSteps.png'), onSelect: () => void savePng('all') },
            { id: 'export-outline', label: t('powerpoint.nextSteps.outline'), onSelect: () => exportOutline('markdown') },
          ]}
        />
      )}
      {/* Shown from the start, not once the slides are ready: appearing then pushed the slides down (a layout shift on desktop). */}
      {renderState !== 'failed' && <Notice id="powerpoint-fidelity-note" kind="info" role="status" className="powerpoint-fidelity-note" message={presentationText?.hasMacros ? `${t('powerpoint.fidelityNote')} ${t('powerpoint.msg.macros')}` : t('powerpoint.fidelityNote')} />}
      {isWorking && (
        <p id="powerpoint-busy" className="powerpoint-busy" role="status">
          {busyMessage}
        </p>
      )}
      <div className="slides-layout">
        {/* Drawn (empty) while the slides load, so its fixed width does not push the slide sideways when they arrive. */}
        {renderState !== 'failed' && !isNarrow && (
          <nav id="slide-thumbnails" aria-label={t('powerpoint.thumbnails')}>
            <ol ref={thumbnailListRef} dir="ltr">
              {Array.from({ length: slideCount }, (_, slideIndex) => (
                <li key={slideIndex}>
                  <button
                    id={`slide-thumbnail-${slideIndex + 1}`}
                    type="button"
                    className="slide-thumbnail"
                    aria-label={t('powerpoint.thumbnailLabel', { number: slideIndex + 1 })}
                    aria-current={slideIndex === currentSlideIndex ? 'true' : undefined}
                    onClick={() => goToSlide(slideIndex)}
                  >
                    <span className="slide-thumbnail-number">{slideIndex + 1}</span>
                    <span className="slide-thumbnail-frame">
                      <span className="slide-thumbnail-picture" data-slide-index={slideIndex} hidden={failedSlideIndexes.has(slideIndex)} />
                      {failedSlideIndexes.has(slideIndex) && <span className="slide-thumbnail-placeholder">{t('powerpoint.thumbnailPlaceholder')}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <main id="main" className="docs-canvas slides-canvas">
          {renderState === 'loading' && (
            <p id="powerpoint-loading" className="powerpoint-loading">
              {t('powerpoint.loading')}
            </p>
          )}
          {renderState === 'failed' && <FatalFileError title={t('powerpoint.error.title')} reason={t('powerpoint.error.reason')} hint={t('powerpoint.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />}
          {isGridShown && (
            <section id="slide-grid" aria-label={t('powerpoint.grid.label')}>
              <ol ref={gridListRef} dir="ltr">
                {Array.from({ length: slideCount }, (_, slideIndex) => (
                  <li key={slideIndex}>
                    <button
                      id={`slide-grid-item-${slideIndex + 1}`}
                      type="button"
                      className="slide-grid-item"
                      aria-current={slideIndex === currentSlideIndex ? 'true' : undefined}
                      onClick={() => openGridSlide(slideIndex)}
                      onKeyDown={(event) => {
                        const step = { ArrowRight: locale === 'ar' ? -1 : 1, ArrowLeft: locale === 'ar' ? 1 : -1, ArrowDown: 4, ArrowUp: -4 }[event.key]
                        if (!step) return
                        event.preventDefault()
                        document.getElementById(`slide-grid-item-${Math.min(slideCount, Math.max(1, slideIndex + 1 + step))}`)?.focus()
                      }}
                    >
                      <span className="slide-grid-frame">
                        <span className="slide-thumbnail-picture" data-slide-index={slideIndex} hidden={failedSlideIndexes.has(slideIndex)} />
                        {failedSlideIndexes.has(slideIndex) && <span className="slide-thumbnail-placeholder">{t('powerpoint.thumbnailPlaceholder')}</span>}
                      </span>
                      <span className="slide-grid-caption" dir="auto">
                        <b>{slideIndex + 1}</b> {slides[slideIndex]?.title ?? ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {/* Slides keep their own layout; Arabic text inside them is right to left on its own. */}
          <div id="slide-stage" ref={stageRef} dir="ltr" hidden={renderState === 'failed' || isGridShown} className={isSlideSized ? undefined : 'is-sizing'}>
            <div id="slide-view" ref={slideViewRef} className={isCurrentSlideFailed ? 'is-covered' : undefined} />
            {isReady && isCurrentSlideFailed && (
              <div id="slide-placeholder" role="status" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <p className="slide-placeholder-title">{t('powerpoint.placeholder')}</p>
                <p className="slide-placeholder-hint">{t('powerpoint.placeholderHint')}</p>
              </div>
            )}
            {isFullscreen && (
              <span id="fullscreen-slide-counter" className="fullscreen-slide-counter" aria-hidden="true">
                {slideNumber} / {slideCount}
              </span>
            )}
          </div>
          {isReady && isNotesShown && !isGridShown && (
            <section id="speaker-notes" aria-labelledby="speaker-notes-title">
              <h2 id="speaker-notes-title" className="speaker-notes-title">
                {t('powerpoint.notes.label')}
              </h2>
              <div id="speaker-notes-text" ref={notesTextRef} className={currentNotes ? 'speaker-notes-text' : 'speaker-notes-text is-empty'} dir="auto">
                {currentNotes || (hasNotes ? t('powerpoint.notes.empty') : t('powerpoint.notes.noneInDeck'))}
              </div>
            </section>
          )}
        </main>
        {panelTab !== null && isReady && (
          <Sidebar
            tabs={[
              { id: 'search', label: t('powerpoint.tab.search') },
              { id: 'listen', label: t('powerpoint.tab.listen') },
            ]}
            activeTab={panelTab}
            onTabChange={(tabId) => openPanel(tabId as PowerPointPanelTab)}
            title={panelTab === 'search' ? t('powerpoint.view.search') : t('powerpoint.view.readAloud')}
            subtitle={tp('powerpoint.slideCount', slideCount)}
            onClose={closePanel}
            isSheetOpen
            onSheetToggle={closePanel}
            sheetSummary={panelTab === 'search' ? t('powerpoint.view.search') : t('powerpoint.view.readAloud')}
          >
            <Suspense fallback={<p className="ppt-panel-note">{t('powerpoint.loading')}</p>}>
              {panelTab === 'search' && <SlideSearchPanel slides={slides} focusRequest={searchFocusRequest} onOpenResult={(result, query, isCaseMatched) => void openSearchResult(result, query, isCaseMatched)} />}
              {panelTab === 'listen' && <SlideListenPanel slides={slides} currentSlideIndex={currentSlideIndex} getNotesElement={() => notesTextRef.current} onGoToSlide={goToSlide} />}
            </Suspense>
          </Sidebar>
        )}
      </div>
      {isPresenterShown && isReady && viewerRef.current && (
        <Suspense fallback={null}>
          <PresenterView viewer={viewerRef.current} deckName={deckName} slides={slides} currentSlideIndex={currentSlideIndex} onGoToSlide={goToSlide} onExit={() => setIsPresenterShown(false)} onPresentHere={() => void presentHere()} />
        </Suspense>
      )}
      <DropOverlay />
    </div>
  )
}
