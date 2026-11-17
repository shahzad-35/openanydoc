import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { defaultOptions, renderAsync } from 'docx-preview'
import type { HElement, Options as DocxPreviewOptions } from 'docx-preview'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import { FatalFileError, Notice, useToast } from '../../components/Messages'
import NextSteps from '../../components/NextSteps'
import { localizePath, useT } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { getFormatCapabilities } from '../../whatsNew'
import { downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import { DropOverlay, Icon, SheetIconSprite, Sidebar, Toolbar, ToolbarButton, ToolbarSeparator, TopBar, useIsNarrowScreen, useThemeToggle } from '../sheet/SheetChrome'
import { FIELD_MARK, exportDocument, insertDocumentHtml, isOpenDocumentFile, prepareOpenDocument, prepareWordDocument, readFlowingHtml } from './wordDocument'
import type { ExportKind, WordDocumentFacts } from './wordDocument'
import type { WordHeading, WordNote } from './WordPanels'
import '../sheet/sheetChrome.css'
import './wordViewer.css'

const NavigationPanel = lazy(() => import('./WordPanels').then((module) => ({ default: module.NavigationPanel })))
const SearchPanel = lazy(() => import('./WordPanels').then((module) => ({ default: module.SearchPanel })))
const InfoPanel = lazy(() => import('./WordPanels').then((module) => ({ default: module.InfoPanel })))
const ListenPanel = lazy(() => import('./WordPanels').then((module) => ({ default: module.ListenPanel })))
const NotesPanel = lazy(() => import('./WordPanels').then((module) => ({ default: module.NotesPanel })))
const NoteCard = lazy(() => import('./WordPanels').then((module) => ({ default: module.NoteCard })))

type WordPanelTab = 'navigation' | 'search' | 'info' | 'listen' | 'notes'
type ReadingTheme = 'light' | 'sepia' | 'dark'

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SMALLEST_FIT_ZOOM = 0.25
const READING_TEXT_SIZES = [100, 115, 130, 145, 160]
const MARGIN_CARD_GAP_PX = 8
const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  docm: 'application/vnd.ms-word.document.macroEnabled.12',
  odt: 'application/vnd.oasis.opendocument.text',
}
const PAGE_SELECTOR = 'section.docx, .odt-page'

// Documents name their fonts without carrying them, and a missing one (Calibri on a Mac) would fall back to the browser's
// serif font, and Arabic text to a decorative one with lines that collide. The site's Arabic font (loaded for Arabic letters
// only) and a generic family at the end keep the look close.
function addGenericFontFamily(fontFamily: string) {
  if (/(^|,)\s*(sans-serif|serif|monospace)\s*$/i.test(fontFamily)) return fontFamily
  return `${fontFamily}, "IBM Plex Sans Arabic", ${/times|georgia|garamond|cambria|roman|serif/i.test(fontFamily) ? 'serif' : 'sans-serif'}`
}

// docx-preview builds every element through this function. Two changes on the way: a style given as a string (a few shapes)
// is set through CSSOM, because the site's CSP refuses style attributes; and font names get a generic fallback.
function createDocumentElement(element: HElement | Node | string): Node {
  if (typeof element !== 'object' || element instanceof Node || !element.style) return defaultOptions.h(element)
  const { style, ...elementWithoutStyle } = element
  const node = defaultOptions.h(elementWithoutStyle) as HTMLElement
  if (typeof style === 'string') node.style.cssText = style
  else Object.assign(node.style, style)
  if (node.style.fontFamily) node.style.fontFamily = addGenericFontFamily(node.style.fontFamily)
  return node
}

const renderOptions: Partial<DocxPreviewOptions> = {
  className: 'docx',
  inWrapper: true,
  hideWrapperOnPrint: true,
  breakPages: true,
  // Word saves where its pages ended; following those marks gives the same pages as Word.
  ignoreLastRenderedPageBreak: false,
  useBase64URL: false,
  // Comments come as a mark (its popover is hidden by CSS; the margin shows them) and tracked changes as <ins>/<del>.
  renderComments: true,
  renderChanges: true,
  h: createDocumentElement,
}

function finishRenderedPages(pagesElement: HTMLElement, isTableRightToLeft: boolean[]) {
  pagesElement.querySelectorAll<HTMLTableElement>('section.docx > article table').forEach((table, tableIndex) => {
    if (isTableRightToLeft[tableIndex]) table.dir = 'rtl'
  })
  const pages = pagesElement.querySelectorAll('section.docx')
  pages.forEach((page, pageIndex) => {
    const textWalker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT)
    for (let textNode = textWalker.nextNode(); textNode; textNode = textWalker.nextNode()) {
      if (!textNode.nodeValue?.includes(FIELD_MARK)) continue
      textNode.nodeValue = textNode.nodeValue.replaceAll(`${FIELD_MARK}PAGE${FIELD_MARK}`, String(pageIndex + 1)).replaceAll(`${FIELD_MARK}NUMPAGES${FIELD_MARK}`, String(pages.length))
    }
  })
}

// Marks the rendered heading paragraphs (by their style class) and lists the comment marks and tracked changes with what the file
// says about them, in document order. Changes are matched to the file's list by position.
function markHeadingsAndNotes(pagesElement: HTMLElement, facts: WordDocumentFacts) {
  for (const paragraph of Array.from(pagesElement.querySelectorAll<HTMLElement>('section.docx > article p'))) {
    const level = Math.min(...Array.from(paragraph.classList, (className) => facts.headingLevelByClass.get(className) ?? 99))
    if (level < 99) paragraph.dataset.headingLevel = String(level)
  }
  const commentsById = new Map(facts.comments.map((comment) => [comment.id, comment]))
  const anchors = Array.from(pagesElement.querySelectorAll<HTMLElement>('section.docx > article .docx-comment-ref, section.docx > article ins, section.docx > article del'))
  let changePosition = 0
  const notes: WordNote[] = []
  anchors.forEach((anchor, position) => {
    anchor.id = `word-note-anchor-${position}`
    if (anchor.classList.contains('docx-comment-ref')) {
      // docx-preview puts an HTML comment "comment #<id> by …" just before the mark.
      const commentId = /comment #(\S+)/.exec(anchor.previousSibling?.textContent ?? '')?.[1] ?? ''
      const comment = commentsById.get(commentId)
      notes.push({ anchorId: anchor.id, kind: 'comment', author: comment?.author ?? '', date: comment?.date ?? '', text: comment?.text ?? '' })
      return
    }
    const change = facts.changes[changePosition++]
    notes.push({ anchorId: anchor.id, kind: anchor.tagName === 'INS' ? 'inserted' : 'deleted', author: change?.author ?? '', date: change?.date ?? anchor.getAttribute('datetime') ?? '', text: change?.text ?? anchor.textContent ?? '' })
  })
  return notes
}

function collectHeadings(viewElement: HTMLElement, idPrefix: string): WordHeading[] {
  return Array.from(viewElement.querySelectorAll<HTMLElement>('[data-heading-level]'))
    .map((element, position) => {
      element.id ||= `${idPrefix}-${position}`
      return { id: element.id, level: Number(element.dataset.headingLevel), text: (element.textContent ?? '').trim() }
    })
    .filter((heading) => heading.text !== '')
}

// Shows a Word file (.docx, .dotx, .docm) as pages, close to how Word lays it out, with docx-preview; an OpenDocument text
// (.odt) as one flowing page from odf-kit. View only for now: the Edit toggle is drawn disabled until the registry gives Word `editing`.
export default function WordViewer({ openedFile, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const { showToast } = useToast()
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const fileName = openedFile.file.name
  const isOpenDocument = isOpenDocumentFile(fileName)
  const [renderState, setRenderState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [zoom, setZoom] = useState(1)
  const [isFitToWidth, setIsFitToWidth] = useState(false)
  const [facts, setFacts] = useState<WordDocumentFacts | null>(null)
  const [notes, setNotes] = useState<WordNote[]>([])
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [panelTab, setPanelTab] = useState<WordPanelTab | null>(null)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [isMarkupShown, setIsMarkupShown] = useState(true)
  const [isReadingMode, setIsReadingMode] = useState(false)
  const [readingState, setReadingState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [readingTextSize, setReadingTextSize] = useState(READING_TEXT_SIZES[1])
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('light')
  // The view the panels read (the pages or the reading view), with a version that changes whenever its content does.
  const [shownView, setShownView] = useState<{ element: HTMLElement; version: number } | null>(null)
  const [headings, setHeadings] = useState<WordHeading[]>([])
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null)
  const [exportingKind, setExportingKind] = useState<ExportKind | null>(null)
  const canvasRef = useRef<HTMLElement>(null)
  const documentRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const marginRef = useRef<HTMLDivElement>(null)
  const readingRef = useRef<HTMLDivElement>(null)
  const openContentsRef = useRef(openedFile.contents)
  useEffect(() => {
    openContentsRef.current = openedFile.contents
  }, [openedFile.contents])
  const canEdit = getFormatCapabilities('word')?.canEdit ?? false
  const isReady = renderState === 'ready'
  const hasNotes = notes.length > 0
  const isMarginShown = isReady && hasNotes && isMarkupShown && !isNarrow && !isReadingMode

  function showView(element: HTMLElement | null, idPrefix: string) {
    if (!element) return
    setHeadings(collectHeadings(element, idPrefix))
    setShownView((view) => ({ element, version: (view?.version ?? 0) + 1 }))
  }

  useEffect(() => {
    const pagesElement = pagesRef.current
    const readingElement = readingRef.current
    if (!pagesElement) return
    // Each run renders into its own holder, so a render that finishes after the file changed lands nowhere.
    const pagesHolder = document.createElement('div')
    pagesElement.append(pagesHolder)
    // The document's CSS comes out as <style> elements, which the CSP blocks; they are left unattached and their text is
    // adopted as constructed stylesheets instead.
    const detachedStyleHolder = document.createElement('div')
    let adoptedSheets: CSSStyleSheet[] = []
    let isCancelled = false
    setRenderState('loading')
    setReadingState('idle')
    setIsReadingMode(false)
    setNotes([])
    setFacts(null)

    async function renderFile() {
      if (isOpenDocument) {
        const { html, facts: fileFacts } = await prepareOpenDocument(openedFile.contents)
        if (isCancelled) return
        const page = document.createElement('div')
        page.className = 'odt-page'
        page.dir = 'auto'
        pagesHolder.append(page)
        insertDocumentHtml(page, html)
        setFacts(fileFacts)
        setPageCount(null)
        return
      }
      const { documentBytes, isTableRightToLeft, facts: fileFacts } = await prepareWordDocument(openedFile.contents)
      await renderAsync(documentBytes, pagesHolder, detachedStyleHolder, renderOptions)
      if (isCancelled) return
      adoptedSheets = Array.from(detachedStyleHolder.querySelectorAll('style'), (styleElement) => {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync((styleElement.textContent ?? '').replace(/font-family:\s*([^;}]+)/g, (_, fontFamily: string) => `font-family: ${addGenericFontFamily(fontFamily.trim())}`))
        return sheet
      })
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...adoptedSheets]
      finishRenderedPages(pagesHolder, isTableRightToLeft)
      setNotes(markHeadingsAndNotes(pagesHolder, fileFacts))
      setFacts(fileFacts)
      setPageCount(pagesHolder.querySelectorAll('section.docx').length)
    }

    renderFile()
      .then(() => {
        if (isCancelled) return
        // Pages wider than the screen (any page on a phone) start fitted to the width. The zoom is measured while the pages are
        // still hidden and set together with 'ready', so they appear at their final size: shown first and fitted after, they
        // moved (a layout shift of about 0.6 on a phone).
        const fitZoom = measureFitZoom()
        if (fitZoom < 1) {
          setZoom(fitZoom)
          setIsFitToWidth(true)
        }
        setRenderState('ready')
        showView(documentRef.current, 'word-heading')
      })
      .catch(() => {
        if (!isCancelled) setRenderState('failed')
      })

    return () => {
      isCancelled = true
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => !adoptedSheets.includes(sheet))
      // Images and embedded fonts are blob: URLs; free them with the pages.
      const styleText = Array.from(detachedStyleHolder.querySelectorAll('style'), (styleElement) => styleElement.textContent ?? '').join('')
      const imageUrls = Array.from(pagesHolder.querySelectorAll('img'), (image) => image.src)
      for (const blobUrl of [...imageUrls, ...(styleText.match(/blob:[^"')\s]+/g) ?? [])]) {
        if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl)
      }
      pagesHolder.remove()
      readingElement?.replaceChildren()
      setShownView(null)
      setHeadings([])
    }
    // showView and measureFitZoom are new functions on every render; the render follows the file only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFile.contents, isOpenDocument])

  // The reading view is made the first time it is asked for (mammoth for Word files, odf-kit for .odt), then kept for this file.
  // A load that finishes after the file changed is dropped (the contents it was made from are no longer the open ones).
  useEffect(() => {
    if (!isReadingMode) {
      if (isReady) showView(documentRef.current, 'word-heading')
      return
    }
    if (readingState === 'ready') {
      showView(readingRef.current, 'reading-heading')
      return
    }
    if (readingState !== 'idle') return
    const contents = openedFile.contents
    setReadingState('loading')
    readFlowingHtml(fileName, contents)
      .then((html) => {
        if (openContentsRef.current !== contents || !readingRef.current) return
        insertDocumentHtml(readingRef.current, html)
        setReadingState('ready')
      })
      .catch(() => {
        if (openContentsRef.current === contents) setReadingState('failed')
      })
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadingMode, readingState, isReady])

  // The zoom at which the widest page just fits the canvas. The applied zoom is read from the element, because the resize
  // observer below keeps the function of the render that started it.
  function measureFitZoom() {
    const canvas = canvasRef.current
    const appliedZoom = parseFloat(documentRef.current?.style.zoom ?? '') || 1
    const widestPage = Math.max(0, ...Array.from(documentRef.current?.querySelectorAll(PAGE_SELECTOR) ?? [], (page) => page.getBoundingClientRect().width / appliedZoom))
    if (!canvas || widestPage === 0) return 1
    const canvasStyle = getComputedStyle(canvas)
    const availableWidth = canvas.clientWidth - parseFloat(canvasStyle.paddingInlineStart) - parseFloat(canvasStyle.paddingInlineEnd)
    // The room kept for the margin is inside the zoomed element, so it scales with the pages.
    const documentStyle = documentRef.current ? getComputedStyle(documentRef.current) : null
    const marginRoom = documentStyle ? parseFloat(documentStyle.paddingLeft) + parseFloat(documentStyle.paddingRight) : 0
    return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(SMALLEST_FIT_ZOOM, availableWidth / (widestPage + marginRoom)))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!isFitToWidth || renderState !== 'ready' || !canvas) return
    const resizeObserver = new ResizeObserver(() => setZoom(measureFitZoom()))
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
    // measureFitZoom is a new function on every render; fitting follows the canvas size, not the zoom.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isFitToWidth, renderState, isMarginShown])

  // Opening the side panel or the margin narrows the room for the pages; if they no longer fit, they are fitted to the width
  // (only ever made smaller here, so a zoom the reader chose that still fits is kept).
  useEffect(() => {
    if (!isReady || isReadingMode) return
    const canvas = canvasRef.current
    if (canvas && canvas.scrollWidth > canvas.clientWidth + 1) setIsFitToWidth(true)
  }, [isReady, isReadingMode, panelTab, isMarginShown])

  // Margin cards sit level with their mark, pushed down so they never overlap. Positions are in the document's own (unzoomed)
  // pixels, because the margin is inside the zoomed element.
  useEffect(() => {
    const documentElement = documentRef.current
    const margin = marginRef.current
    if (!isMarginShown || !documentElement || !margin) return
    function placeCards() {
      const documentTop = documentElement!.getBoundingClientRect().top
      let nextFreeTop = 0
      for (const card of Array.from(margin!.querySelectorAll<HTMLElement>('.word-margin-item'))) {
        const anchor = document.getElementById(card.dataset.anchorId ?? '')
        const anchorTop = anchor ? (anchor.getBoundingClientRect().top - documentTop) / zoom : nextFreeTop
        const top = Math.max(anchorTop, nextFreeTop)
        card.style.top = `${top}px`
        nextFreeTop = top + card.offsetHeight + MARGIN_CARD_GAP_PX
      }
    }
    // The cards are lazy: they are placed again once they have drawn, and whenever the pages change size.
    const resizeObserver = new ResizeObserver(placeCards)
    resizeObserver.observe(documentElement)
    const cardObserver = new MutationObserver(placeCards)
    cardObserver.observe(margin, { childList: true, subtree: true })
    placeCards()
    return () => {
      resizeObserver.disconnect()
      cardObserver.disconnect()
    }
  }, [isMarginShown, zoom, notes])

  // The heading in view is marked in the navigation pane while scrolling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || headings.length === 0) return
    let frame = 0
    function markCurrentHeading() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const canvasTop = canvas!.getBoundingClientRect().top + 80
        let currentId: string | null = headings[0].id
        for (const heading of headings) {
          const element = document.getElementById(heading.id)
          if (element && element.getBoundingClientRect().top <= canvasTop) currentId = heading.id
        }
        setCurrentHeadingId(currentId)
      })
    }
    markCurrentHeading()
    canvas.addEventListener('scroll', markCurrentHeading, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      canvas.removeEventListener('scroll', markCurrentHeading)
    }
  }, [headings])

  // Ctrl/⌘+F opens the search in the document instead of the browser's.
  useEffect(() => {
    if (!isReady) return
    function openSearchOnShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      setPanelTab('search')
      setSearchFocusRequest((request) => request + 1)
    }
    window.addEventListener('keydown', openSearchOnShortcut)
    return () => window.removeEventListener('keydown', openSearchOnShortcut)
  }, [isReady])

  const nextZoomIn = ZOOM_STEPS.find((step) => step > zoom + 0.001)
  const nextZoomOut = ZOOM_STEPS.findLast((step) => step < zoom - 0.001)
  function zoomTo(newZoom: number | undefined) {
    if (newZoom === undefined) return
    setIsFitToWidth(false)
    setZoom(newZoom)
  }
  const printDocument = () => window.print()
  function jumpTo(elementId: string) {
    const element = document.getElementById(elementId)
    if (!element) return
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    element.classList.add('is-jump-target')
    setTimeout(() => element.classList.remove('is-jump-target'), 1600)
  }
  function openPanel(tab: WordPanelTab) {
    setPanelTab(tab)
    if (tab === 'search') setSearchFocusRequest((request) => request + 1)
  }
  async function exportAs(kind: ExportKind) {
    if (!facts) return
    setExportingKind(kind)
    try {
      const { name, blob } = await exportDocument(kind, fileName, openedFile.contents, facts)
      downloadTextFile(name, blob, blob.type)
    } catch (error) {
      showToast({ message: t('word.export.failed', { reason: error instanceof Error ? error.message : String(error) }), kind: 'error' })
    } finally {
      setExportingKind(null)
    }
  }

  const hasImages = (facts?.imagePaths.length ?? 0) > 0
  const exportItems = [
    { id: 'export-text', label: t('word.export.text'), kind: 'text' as const, disabledReason: '' },
    { id: 'export-markdown', label: t('word.export.markdown'), kind: 'markdown' as const, disabledReason: isOpenDocument ? t('word.export.noMarkdownOdt') : '' },
    { id: 'export-html', label: t('word.export.html'), kind: 'html' as const, disabledReason: '' },
    { id: 'export-images', label: t('word.export.images'), kind: 'images' as const, disabledReason: hasImages ? '' : t('word.export.noImages') },
  ]
  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: onOpenAnotherFile },
        {
          id: 'export',
          label: t('word.exportAs'),
          icon: 'download',
          isDisabled: !isReady || exportingKind !== null,
          disabledReason: exportingKind ? t('word.export.working') : '',
          items: exportItems.map((item) => ({ id: item.id, label: item.label, isDisabled: item.disabledReason !== '', disabledReason: item.disabledReason, onSelect: () => exportAs(item.kind) })),
        },
        { id: 'print', label: t('word.print'), icon: 'print', isDisabled: !isReady, onSelect: printDocument },
        { id: 'close', label: t('menu.close'), icon: 'x', onSelect: onClose },
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        { id: 'navigation', label: t('word.view.navigation'), icon: 'panel', isDisabled: !isReady, onSelect: () => openPanel('navigation') },
        { id: 'search', label: t('word.view.search'), icon: 'search', hint: 'Ctrl+F', isDisabled: !isReady, onSelect: () => openPanel('search') },
        { id: 'document-info', label: t('word.view.info'), icon: 'info', isDisabled: !isReady, onSelect: () => openPanel('info') },
        { id: 'read-aloud', label: t('word.view.readAloud'), icon: 'review', isDisabled: !isReady, onSelect: () => openPanel('listen') },
        'separator',
        { id: 'show-markup', label: t('word.view.showMarkup'), kind: 'checkbox', isChecked: hasNotes && isMarkupShown, isDisabled: !hasNotes, disabledReason: t('word.view.noMarkup'), onSelect: () => setIsMarkupShown((isShown) => !isShown) },
        { id: 'comments-list', label: t('word.view.notesList'), icon: 'flag', isDisabled: !hasNotes, disabledReason: t('word.view.noMarkup'), onSelect: () => openPanel('notes') },
        { id: 'reading-mode', label: t('word.view.readingMode'), kind: 'checkbox', isChecked: isReadingMode, isDisabled: !isReady, onSelect: () => setIsReadingMode((isOn) => !isOn) },
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

  const panelTabs: { id: WordPanelTab; label: string }[] = [
    { id: 'navigation', label: t('word.tab.navigation') },
    { id: 'search', label: t('word.tab.search') },
    { id: 'info', label: t('word.tab.info') },
    { id: 'listen', label: t('word.tab.listen') },
    ...(hasNotes ? [{ id: 'notes' as const, label: t('word.tab.notes') }] : []),
  ]
  const panelTitles: Record<WordPanelTab, string> = {
    navigation: t('word.view.navigation'),
    search: t('word.view.search'),
    info: t('word.view.info'),
    listen: t('word.view.readAloud'),
    notes: t('word.notes.title'),
  }
  const panelSubtitles: Record<WordPanelTab, string> = {
    navigation: tp('word.nav.count', headings.length),
    search: '',
    info: '',
    listen: '',
    notes: tp('word.notes.count', notes.length),
  }
  const readingSizePosition = READING_TEXT_SIZES.indexOf(readingTextSize)
  const isDocumentShown = !isReadingMode

  return (
    <div id="docs-workbench">
      <SheetIconSprite />
      <TopBar
        format="docx"
        fileName={fileName}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload
        downloadLabel={t('toolbar.download')}
        downloadTip={t('word.downloadTip')}
        onDownload={() => downloadTextFile(fileName, openedFile.contents, MIME_TYPE_BY_EXTENSION[fileName.split('.').pop()?.toLowerCase() ?? 'docx'] ?? MIME_TYPE_BY_EXTENSION.docx)}
        onHome={onClose}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <MenuBar menus={menus} isCompact={isNarrow} label={t('menu.bar')} />
      <Toolbar label={t('word.toolbar')}>
        <ToolbarButton id="panel-toggle-button" label={t('word.panelToggle')} icon="panel" isPressed={panelTab !== null} isDisabled={!isReady} onClick={() => setPanelTab((tab) => (tab === null ? 'navigation' : null))} />
        <ToolbarSeparator />
        {isDocumentShown ? (
          <>
            <ToolbarButton id="zoom-out-button" label={t('word.zoomOut')} icon="zoom-out" isDisabled={!isReady || nextZoomOut === undefined} onClick={() => zoomTo(nextZoomOut)} />
            <span id="zoom-value" className="zoom-value" dir="ltr" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarButton id="zoom-in-button" label={t('word.zoomIn')} icon="zoom-in" isDisabled={!isReady || nextZoomIn === undefined} onClick={() => zoomTo(nextZoomIn)} />
            <ToolbarButton id="fit-width-button" label={t('word.fitWidth')} icon="fit-width" isPressed={isFitToWidth} isDisabled={!isReady} onClick={() => setIsFitToWidth(true)} />
          </>
        ) : (
          <>
            <ToolbarButton id="reading-text-smaller-button" label={t('word.reading.smaller')} icon="zoom-out" isDisabled={readingSizePosition <= 0} onClick={() => setReadingTextSize(READING_TEXT_SIZES[readingSizePosition - 1])} />
            <span id="reading-text-size" className="zoom-value" dir="ltr" aria-live="polite">
              {readingTextSize}%
            </span>
            <ToolbarButton id="reading-text-larger-button" label={t('word.reading.larger')} icon="zoom-in" isDisabled={readingSizePosition >= READING_TEXT_SIZES.length - 1} onClick={() => setReadingTextSize(READING_TEXT_SIZES[readingSizePosition + 1])} />
            <label className="reading-theme">
              <span className="sr-only">{t('word.reading.theme')}</span>
              <select id="reading-theme-select" value={readingTheme} onChange={(event) => setReadingTheme(event.target.value as ReadingTheme)}>
                <option value="light">{t('word.reading.light')}</option>
                <option value="sepia">{t('word.reading.sepia')}</option>
                <option value="dark">{t('word.reading.dark')}</option>
              </select>
            </label>
          </>
        )}
        <ToolbarSeparator />
        <button className="tbtn labelled" id="reading-mode-toggle" type="button" aria-pressed={isReadingMode} aria-label={t('word.view.readingMode')} data-tip={t('word.readingTip')} disabled={!isReady} onClick={() => setIsReadingMode((isOn) => !isOn)}>
          <Icon name="file" />
          <span className="desk-only">{t('word.view.readingMode')}</span>
        </button>
        {hasNotes && (
          <button className="tbtn labelled" id="markup-toggle" type="button" aria-pressed={isMarkupShown} aria-label={t('word.view.showMarkup')} data-tip={t('word.markupTip')} disabled={!isReady || isReadingMode} onClick={() => (isNarrow ? openPanel('notes') : setIsMarkupShown((isShown) => !isShown))}>
            <Icon name="flag" />
            <span className="desk-only">{t('word.markupShort')}</span>
          </button>
        )}
        <ToolbarSeparator />
        <button className="tbtn labelled" id="print-button" type="button" aria-label={t('word.print')} data-tip={t('word.printTip')} disabled={!isReady} onClick={printDocument}>
          <Icon name="print" />
          <span className="desk-only">{t('word.print')}</span>
        </button>
        <span className="spacer" />
        <button className="tbtn labelled" id="edit-toggle" type="button" aria-pressed={false} aria-label={t(canEdit ? 'word.edit' : 'word.editComingSoon')} data-tip={t(canEdit ? 'word.edit' : 'word.editComingSoon')} data-tip-align="end" disabled={!canEdit}>
          <Icon name="edit" />
          <span className="desk-only">{t(canEdit ? 'word.edit' : 'word.editComingSoon')}</span>
        </button>
      </Toolbar>
      {renderState !== 'failed' && (
        <NextSteps
          isReady={isReady}
          steps={[
            { id: 'print', label: t('nextSteps.printPdf'), onSelect: printDocument },
            { id: 'export-text', label: t('word.nextSteps.exportText'), onSelect: () => exportAs('text') },
            { id: 'reading-mode', label: t('word.view.readingMode'), onSelect: () => setIsReadingMode(true) },
          ]}
        />
      )}
      <Notice id="word-macro-notice" kind="info" role="status" className="word-notice" message={facts?.hasMacros ? t('word.msg.macros') : ''} />
      <div id="word-studio">
        <main id="main" className="docs-canvas" ref={canvasRef}>
          {renderState === 'loading' && (
            <p id="word-loading" className="word-loading">
              {t('word.loading')}
            </p>
          )}
          {renderState === 'failed' && <FatalFileError title={t('word.error.title')} reason={t('word.error.reason')} hint={t('word.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />}
          {/* The pages keep the document's own direction; Arabic paragraphs and tables are right to left inside it. */}
          <div
            id="word-document"
            ref={documentRef}
            dir="ltr"
            hidden={renderState === 'failed' || isReadingMode}
            className={[renderState === 'ready' ? '' : 'is-sizing', isMarginShown ? `has-margin margin-${locale === 'ar' ? 'left' : 'right'}` : '', hasNotes && !isMarkupShown ? 'markup-hidden' : ''].filter(Boolean).join(' ') || undefined}
            style={{ zoom }}
          >
            <div id="word-pages" ref={pagesRef} />
            {isMarginShown && (
              <div id="word-margin" ref={marginRef} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-label={t('word.notes.title')} role="region">
                <Suspense fallback={null}>
                  {notes.map((note, position) =>
                    note.anchorId ? (
                      <div key={position} className="word-margin-item" data-anchor-id={note.anchorId}>
                        <NoteCard note={note} locale={locale} id={`margin-card-${position}`} onJump={jumpTo} />
                      </div>
                    ) : null,
                  )}
                </Suspense>
              </div>
            )}
          </div>
          {isReadingMode && readingState === 'loading' && (
            <p id="reading-loading" className="word-loading">
              {t('word.reading.loading')}
            </p>
          )}
          {isReadingMode && readingState === 'failed' && (
            <p id="reading-failed" className="word-loading" role="alert">
              {t('word.reading.failed')}
            </p>
          )}
          <div id="reading-view" ref={readingRef} className={`reading-theme-${readingTheme}`} hidden={!isReadingMode || readingState !== 'ready'} style={{ fontSize: `${readingTextSize}%` }} />
        </main>
        {panelTab !== null && isReady && facts && (
          <Sidebar
            tabs={panelTabs}
            activeTab={panelTab}
            onTabChange={(tabId) => openPanel(tabId as WordPanelTab)}
            title={panelTitles[panelTab]}
            subtitle={panelSubtitles[panelTab]}
            onClose={() => setPanelTab(null)}
            isSheetOpen
            onSheetToggle={() => setPanelTab(null)}
            sheetSummary={panelTitles[panelTab]}
          >
            <Suspense fallback={<p className="word-panel-note">{t('word.loading')}</p>}>
              {panelTab === 'navigation' && <NavigationPanel headings={headings} currentHeadingId={currentHeadingId} onJump={jumpTo} />}
              {panelTab === 'search' && <SearchPanel viewElement={shownView?.element ?? null} viewVersion={shownView?.version ?? 0} isDeletedTextHidden={!isMarkupShown} focusRequest={searchFocusRequest} />}
              {panelTab === 'info' && <InfoPanel viewElement={shownView?.element ?? null} viewVersion={shownView?.version ?? 0} facts={facts} fileName={fileName} fileSize={formatFileSize(openedFile.file.size)} pageCount={isOpenDocument ? null : pageCount} />}
              {panelTab === 'listen' && <ListenPanel viewElement={shownView?.element ?? null} viewVersion={shownView?.version ?? 0} />}
              {panelTab === 'notes' && <NotesPanel notes={notes} onJump={(anchorId) => {
                setIsReadingMode(false)
                jumpTo(anchorId)
              }} />}
            </Suspense>
          </Sidebar>
        )}
      </div>
      <DropOverlay />
    </div>
  )
}
