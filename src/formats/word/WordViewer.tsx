import { useEffect, useRef, useState } from 'react'
import { defaultOptions, renderAsync } from 'docx-preview'
import type { HElement, Options as DocxPreviewOptions } from 'docx-preview'
import JSZip from 'jszip'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import { FatalFileError } from '../../components/Messages'
import NextSteps from '../../components/NextSteps'
import { localizePath, useT } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { getFormatCapabilities } from '../../whatsNew'
import { downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import { DropOverlay, Icon, SheetIconSprite, Toolbar, ToolbarButton, ToolbarSeparator, TopBar, useIsNarrowScreen, useThemeToggle } from '../sheet/SheetChrome'
import '../sheet/sheetChrome.css'
import './wordViewer.css'

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SMALLEST_FIT_ZOOM = 0.25
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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
  h: createDocumentElement,
}

// Stands in for a page-number field's saved text until the pages exist (a private-use character, never in real text).
const FIELD_MARK = ''
// A PAGE or NUMPAGES field, complex (instrText, then the saved number after "separate") or simple (fldSimple), up to its number.
const COMPLEX_PAGE_FIELD = /(<w:instrText[^>]*>\s*(PAGE|NUMPAGES)\b[^<]*<\/w:instrText>(?:(?!fldCharType="end")[\s\S])*?fldCharType="separate"(?:(?!fldCharType="end")[\s\S])*?<w:t(?:\s[^>]*)?>)[^<]*/g
const SIMPLE_PAGE_FIELD = /(<w:fldSimple\s[^>]*w:instr="\s*(PAGE|NUMPAGES)\b[^"]*"[^>]*>(?:(?!<\/w:fldSimple>)[\s\S])*?<w:t(?:\s[^>]*)?>)[^<]*/g

// docx-preview misses two things that matter here, so the file is read once before rendering:
// - w:bidiVisual (a right-to-left table) is ignored, so an Arabic table's columns would run left to right; the tables are
//   listed in document order to mark the rendered ones afterwards.
// - fields are not computed, so every page would show the page number Word saved; the numbers in headers and footers are
//   swapped for marks that each rendered page fills in.
async function prepareDocument(fileContents: ArrayBuffer) {
  const documentZip = await JSZip.loadAsync(fileContents)
  const documentXml = (await documentZip.file('word/document.xml')?.async('string')) ?? ''
  const isTableRightToLeft = documentXml
    .split(/<w:tbl[\s>]/)
    .slice(1)
    .map((tableXml) => /<w:bidiVisual(\s+w:val="(1|true|on)")?\s*\/>/.test(tableXml.split('</w:tblPr>')[0]))
  for (const partName of Object.keys(documentZip.files).filter((name) => /^word\/(header|footer)\d*\.xml$/.test(name))) {
    const partXml = await documentZip.file(partName)!.async('string')
    const markedXml = partXml
      .replace(COMPLEX_PAGE_FIELD, (_, fieldStart: string, fieldName: string) => `${fieldStart}${FIELD_MARK}${fieldName}${FIELD_MARK}`)
      .replace(SIMPLE_PAGE_FIELD, (_, fieldStart: string, fieldName: string) => `${fieldStart}${FIELD_MARK}${fieldName}${FIELD_MARK}`)
    documentZip.file(partName, markedXml)
  }
  return { documentBytes: await documentZip.generateAsync({ type: 'arraybuffer' }), isTableRightToLeft }
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

// Shows a .docx as pages, close to how Word lays it out, with docx-preview. View only for now: the Edit toggle is drawn
// disabled until the registry gives Word `editing`.
export default function WordViewer({ openedFile, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t } = useT()
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()
  const [renderState, setRenderState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [zoom, setZoom] = useState(1)
  const [isFitToWidth, setIsFitToWidth] = useState(false)
  const canvasRef = useRef<HTMLElement>(null)
  const documentRef = useRef<HTMLDivElement>(null)
  const canEdit = getFormatCapabilities('word')?.canEdit ?? false

  useEffect(() => {
    const documentElement = documentRef.current
    if (!documentElement) return
    // Each run renders into its own holder, so a render that finishes after the file changed lands nowhere.
    const pagesHolder = document.createElement('div')
    documentElement.append(pagesHolder)
    // The document's CSS comes out as <style> elements, which the CSP blocks; they are left unattached and their text is
    // adopted as constructed stylesheets instead.
    const detachedStyleHolder = document.createElement('div')
    let adoptedSheets: CSSStyleSheet[] = []
    let isCancelled = false
    setRenderState('loading')

    prepareDocument(openedFile.contents)
      .then(async ({ documentBytes, isTableRightToLeft }) => {
        await renderAsync(documentBytes, pagesHolder, detachedStyleHolder, renderOptions)
        if (isCancelled) return
        adoptedSheets = Array.from(detachedStyleHolder.querySelectorAll('style'), (styleElement) => {
          const sheet = new CSSStyleSheet()
          sheet.replaceSync((styleElement.textContent ?? '').replace(/font-family:\s*([^;}]+)/g, (_, fontFamily: string) => `font-family: ${addGenericFontFamily(fontFamily.trim())}`))
          return sheet
        })
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...adoptedSheets]
        finishRenderedPages(pagesHolder, isTableRightToLeft)
        // Pages wider than the screen (any page on a phone) start fitted to the width. The zoom is measured while the pages are
        // still hidden and set together with 'ready', so they appear at their final size: shown first and fitted after, they
        // moved (a layout shift of about 0.6 on a phone).
        const fitZoom = measureFitZoom()
        if (fitZoom < 1) {
          setZoom(fitZoom)
          setIsFitToWidth(true)
        }
        setRenderState('ready')
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
    }
  }, [openedFile.contents])

  // The zoom at which the widest page just fits the canvas. The applied zoom is read from the element, because the resize
  // observer below keeps the function of the render that started it.
  function measureFitZoom() {
    const canvas = canvasRef.current
    const appliedZoom = parseFloat(documentRef.current?.style.zoom ?? '') || 1
    const widestPage = Math.max(0, ...Array.from(documentRef.current?.querySelectorAll('section.docx') ?? [], (page) => page.getBoundingClientRect().width / appliedZoom))
    if (!canvas || widestPage === 0) return 1
    const canvasStyle = getComputedStyle(canvas)
    const availableWidth = canvas.clientWidth - parseFloat(canvasStyle.paddingInlineStart) - parseFloat(canvasStyle.paddingInlineEnd)
    return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(SMALLEST_FIT_ZOOM, availableWidth / widestPage))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!isFitToWidth || renderState !== 'ready' || !canvas) return
    const resizeObserver = new ResizeObserver(() => setZoom(measureFitZoom()))
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
    // measureFitZoom is a new function on every render; fitting follows the canvas size, not the zoom.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isFitToWidth, renderState])

  const nextZoomIn = ZOOM_STEPS.find((step) => step > zoom + 0.001)
  const nextZoomOut = ZOOM_STEPS.findLast((step) => step < zoom - 0.001)
  function zoomTo(newZoom: number | undefined) {
    if (newZoom === undefined) return
    setIsFitToWidth(false)
    setZoom(newZoom)
  }
  const printDocument = () => window.print()

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: onOpenAnotherFile },
        { id: 'print', label: t('word.print'), icon: 'print', isDisabled: renderState !== 'ready', onSelect: printDocument },
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

  const isReady = renderState === 'ready'
  return (
    <div id="docs-workbench">
      <SheetIconSprite />
      <TopBar
        format="docx"
        fileName={openedFile.file.name}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload
        downloadLabel={t('toolbar.download')}
        downloadTip={t('word.downloadTip')}
        onDownload={() => downloadTextFile(openedFile.file.name, openedFile.contents, DOCX_MIME_TYPE)}
        onHome={onClose}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <MenuBar menus={menus} isCompact={isNarrow} label={t('menu.bar')} />
      <Toolbar label={t('word.toolbar')}>
        <ToolbarButton id="zoom-out-button" label={t('word.zoomOut')} icon="zoom-out" isDisabled={!isReady || nextZoomOut === undefined} onClick={() => zoomTo(nextZoomOut)} />
        <span id="zoom-value" className="zoom-value" dir="ltr" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarButton id="zoom-in-button" label={t('word.zoomIn')} icon="zoom-in" isDisabled={!isReady || nextZoomIn === undefined} onClick={() => zoomTo(nextZoomIn)} />
        <ToolbarButton id="fit-width-button" label={t('word.fitWidth')} icon="fit-width" isPressed={isFitToWidth} isDisabled={!isReady} onClick={() => setIsFitToWidth(true)} />
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
            { id: 'fit-width', label: t('word.fitWidth'), onSelect: () => setIsFitToWidth(true) },
          ]}
        />
      )}
      <main id="main" className="docs-canvas" ref={canvasRef}>
        {renderState === 'loading' && (
          <p id="word-loading" className="word-loading">
            {t('word.loading')}
          </p>
        )}
        {renderState === 'failed' && <FatalFileError title={t('word.error.title')} reason={t('word.error.reason')} hint={t('word.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />}
        {/* The pages keep the document's own direction; Arabic paragraphs and tables are right to left inside it. */}
        <div id="word-document" ref={documentRef} dir="ltr" hidden={renderState === 'failed'} className={renderState === 'ready' ? undefined : 'is-sizing'} style={{ zoom }} />
      </main>
      <DropOverlay />
    </div>
  )
}
