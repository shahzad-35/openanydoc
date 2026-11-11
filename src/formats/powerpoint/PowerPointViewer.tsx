import { useEffect, useRef, useState } from 'react'
import { PptxViewer } from '@aiden0z/pptx-renderer'
import type { SlideHandle } from '@aiden0z/pptx-renderer'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import { FatalFileError, Notice } from '../../components/Messages'
import NextSteps from '../../components/NextSteps'
import { localizePath, useT } from '../../i18n'
import { CONTACT_EMAIL } from '../../legalContent'
import { formatFileSize } from '../../useFileIntake'
import { getFormatCapabilities } from '../../whatsNew'
import { downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import { DropOverlay, Icon, SheetIconSprite, Toolbar, ToolbarButton, ToolbarSeparator, TopBar, useIsNarrowScreen, useThemeToggle } from '../sheet/SheetChrome'
import '../sheet/sheetChrome.css'
import './powerPointViewer.css'

const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const THUMBNAIL_WIDTH = 160
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

// Shows a .pptx one slide at a time with @aiden0z/pptx-renderer, with a thumbnail sidebar, keyboard navigation and full screen.
// View only for now: the Edit toggle is drawn disabled until the registry gives PowerPoint `editing`. A slide the renderer
// cannot draw fully shows a placeholder instead of its half-drawn shapes.
export default function PowerPointViewer({ openedFile, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t } = useT()
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const [renderState, setRenderState] = useState<'loading' | 'ready' | 'failed'>('loading')
  // The stage stays hidden until the slide has been sized to it: drawn at the renderer's size and resized after, the slide moved
  // (a layout shift of about 0.65 on a phone).
  const [isSlideSized, setIsSlideSized] = useState(false)
  const [slideCount, setSlideCount] = useState(0)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [failedSlideIndexes, setFailedSlideIndexes] = useState<ReadonlySet<number>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canGoFullscreen] = useState(() => document.fullscreenEnabled)
  const viewerRef = useRef<PptxViewer | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const slideViewRef = useRef<HTMLDivElement>(null)
  const thumbnailListRef = useRef<HTMLOListElement>(null)
  // Thumbnails render synchronously; a shape error raised meanwhile belongs to that thumbnail's slide, not the shown one.
  const thumbnailIndexBeingRenderedRef = useRef<number | null>(null)
  const canEdit = getFormatCapabilities('powerpoint')?.canEdit ?? false

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

    PptxViewer.open(openedFile.contents, slideView, {
      renderMode: 'slide',
      fitMode: 'contain',
      lazySlides: true,
      lazyMedia: true,
      pdfjs: false,
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
      slideView.style.width = `${Math.floor(Math.min(stage.clientWidth, stage.clientHeight * slideAspectRatio))}px`
      setIsSlideSized(true)
    })
    resizeObserver.observe(stage)
    return () => resizeObserver.disconnect()
  }, [renderState])

  // Each thumbnail is drawn once it scrolls into the sidebar, so a long deck does not lay out every slide on open.
  useEffect(() => {
    const viewer = viewerRef.current
    const thumbnailList = thumbnailListRef.current
    if (renderState !== 'ready' || !viewer || !thumbnailList) return
    const thumbnailHandles: SlideHandle[] = []
    const fallbackObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const thumbnailPicture = (mutation.target as Element).closest<HTMLElement>('.slide-thumbnail-picture')
        if (thumbnailPicture && RENDERER_FALLBACK_TEXT.test(thumbnailPicture.textContent ?? '')) markSlideFailed(Number(thumbnailPicture.dataset.slideIndex))
      }
    })
    fallbackObserver.observe(thumbnailList, { childList: true, subtree: true })
    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const thumbnailPicture = entry.target as HTMLElement
        intersectionObserver.unobserve(thumbnailPicture)
        const slideIndex = Number(thumbnailPicture.dataset.slideIndex)
        thumbnailIndexBeingRenderedRef.current = slideIndex
        try {
          const thumbnailHandle = viewer.renderThumbnailToContainer(slideIndex, thumbnailPicture, { width: THUMBNAIL_WIDTH })
          if (thumbnailHandle) thumbnailHandles.push(thumbnailHandle)
          else markSlideFailed(slideIndex)
        } catch {
          markSlideFailed(slideIndex)
        } finally {
          thumbnailIndexBeingRenderedRef.current = null
        }
      }
    }, { root: thumbnailList, rootMargin: '200px 0px' })
    thumbnailList.querySelectorAll('.slide-thumbnail-picture').forEach((thumbnailPicture) => intersectionObserver.observe(thumbnailPicture))
    return () => {
      intersectionObserver.disconnect()
      fallbackObserver.disconnect()
      for (const thumbnailHandle of thumbnailHandles) thumbnailHandle.dispose()
    }
  }, [renderState, slideCount, isNarrow])

  useEffect(() => {
    document.getElementById(`slide-thumbnail-${currentSlideIndex + 1}`)?.scrollIntoView({ block: 'nearest' })
  }, [currentSlideIndex])

  useEffect(() => {
    const showFullscreenState = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', showFullscreenState)
    return () => document.removeEventListener('fullscreenchange', showFullscreenState)
  }, [])

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
      if (!viewer || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="menubar"], [role="menu"], dialog')) return
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
  }, [renderState, locale])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    } catch {
      // Some browsers and app views do not allow full screen; the page simply stays as it is.
    }
  }

  const isReady = renderState === 'ready'
  const slideNumber = currentSlideIndex + 1
  const isCurrentSlideFailed = failedSlideIndexes.has(currentSlideIndex)
  const reportSlideHref =
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('powerpoint.reportSubject', { number: slideNumber }))}` +
    `&body=${encodeURIComponent(t('powerpoint.reportBody'))}`

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
        fileName={openedFile.file.name}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload
        downloadLabel={t('toolbar.download')}
        downloadTip={t('powerpoint.downloadTip')}
        onDownload={() => downloadTextFile(openedFile.file.name, openedFile.contents, PPTX_MIME_TYPE)}
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
        {canGoFullscreen && (
          <>
            <ToolbarSeparator />
            <button className="tbtn labelled" id="fullscreen-button" type="button" aria-label={t('powerpoint.fullscreen')} data-tip={t('powerpoint.fullscreenTip')} disabled={!isReady} onClick={toggleFullscreen}>
              <Icon name="fullscreen" />
              <span className="desk-only">{t('powerpoint.fullscreen')}</span>
            </button>
          </>
        )}
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
            ...(canGoFullscreen ? [{ id: 'fullscreen', label: t('nextSteps.presentFullscreen'), onSelect: () => void toggleFullscreen() }] : []),
            { id: 'open-another', label: t('nextSteps.openAnother'), onSelect: onOpenAnotherFile },
          ]}
        />
      )}
      {/* Shown from the start, not once the slides are ready: appearing then pushed the slides down (a layout shift on desktop). */}
      {renderState !== 'failed' && <Notice id="powerpoint-fidelity-note" kind="info" role="status" className="powerpoint-fidelity-note" message={t('powerpoint.fidelityNote')} />}
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
          {/* Slides keep their own layout; Arabic text inside them is right to left on its own. */}
          <div id="slide-stage" ref={stageRef} dir="ltr" hidden={renderState === 'failed'} className={isSlideSized ? undefined : 'is-sizing'}>
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
        </main>
      </div>
      <DropOverlay />
    </div>
  )
}
