// Edit, Sign and Fill PDF: the pages shown by pdf.js (pdfjs-dist, Apache-2.0) with things placed on them, saved as a new PDF.
// - Edit: pdf.js's own annotation editor for text boxes, highlights and freehand drawing, plus our own layer of shapes and
//   pictures that pdf-lib draws when the copy is saved (pdfTools.worker.ts, `stamp-pdf`).
// - Sign: a drawn, typed or uploaded signature placed as a picture on one or more pages (a visual signature only).
// - Fill: pdf.js's form fields; "Flatten on save" draws each value as a picture and takes the fields out.
// One undo history covers both our layer and pdf.js's editor, and the page asks before unsaved edits are thrown away.
// "Save a copy" makes a new file; the chosen file is never changed.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EventBus, PDFViewer as PdfJsViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition } from '../../components/MenuBar'
import ModalDialog from '../../components/ModalDialog'
import { ChangeCounter } from '../../components/EditControls'
import { Notice } from '../../components/Messages'
import { useEditSession } from '../../formats/useEditSession'
import { PDFJS_DATA_ROOT, loadPdfLibrary, pdfDocumentOptions } from '../../formats/pdf/pdfLibrary'
import { reorderRightToLeftTextOf } from '../../formats/pdf/pdfTextOrder'
import type { ToolProps } from '../registry'
import { PagesChoice, ProgressBar, baseNameOf, chosenPageIndexes, drawTextPicture, pdfResultFile, pngBytesOf, problemMessageKey, turnPicture } from './PdfToolParts'
import type { PagesChoiceValue, StampPicture } from './PdfToolParts'
import { runPdfTask } from './pdfTasks'
import type { PageBox, PageShape, PageStamp } from './pdfTasks'

// pdf.js's own words would come from its translation files, which it fetches; it gets none (as in the PDF viewer).
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
const COLORS: Record<string, string> = { black: '#1f1f1f', red: '#c0392b', blue: '#1d4fd8', green: '#1e8449' }
const PICTURE_LONG_SIDE_POINTS = 200
const SIGNATURE_WIDTH_POINTS = 160
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'

type ShapeKind = PageShape['kind']
type PictureItem = { id: number; pageIndex: number; box: PageBox; kind: 'picture'; picture: StampPicture; pictureUrl: string }
type ShapeItem = { id: number; pageIndex: number; box: PageBox; kind: ShapeKind; color: string; thickness: number }
type OverlayItem = PictureItem | ShapeItem
// Where a page sits in the overlay (CSS pixels from the overlay's top-left corner) and how many pixels a point takes.
type PageFrame = { left: number; top: number; width: number; height: number; pixelsPerPoint: number }

const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255) as [number, number, number]
const isNarrowScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

// Makes a stamped copy: the bytes (already holding pdf.js's own edits) plus our pictures and shapes.
async function stampOverlayItems(pdfBytes: Uint8Array, items: OverlayItem[], onProgress: (done: number, total: number) => void) {
  if (items.length === 0) return pdfBytes
  const images: ArrayBuffer[] = []
  const imageIndexByCanvas = new Map<HTMLCanvasElement, number>()
  const stamps: PageStamp[] = []
  const shapes: PageShape[] = []
  for (const item of items) {
    if (item.kind === 'picture') {
      if (!imageIndexByCanvas.has(item.picture.canvas)) {
        images.push(await pngBytesOf(item.picture.canvas))
        imageIndexByCanvas.set(item.picture.canvas, images.length - 1)
      }
      stamps.push({ pageIndex: item.pageIndex, imageIndex: imageIndexByCanvas.get(item.picture.canvas)!, box: item.box })
    } else {
      shapes.push({ pageIndex: item.pageIndex, kind: item.kind, box: item.box, color: hexToRgb(item.color), thickness: item.thickness, fill: null })
    }
  }
  const response = await runPdfTask({ type: 'stamp-pdf', pdf: pdfBytes.slice().buffer, images, stamps, shapes }, onProgress)
  if (response.status !== 'ok' || !response.pdf) throw new Error('stamp failed')
  return response.pdf
}

// ---------------------------------------------------------------- the page view

type ViewState = 'loading' | 'ready' | 'encrypted' | 'unreadable'

// pdf.js's scrolling page view of the chosen file. `editorMode` turns on pdf.js's annotation editor (Edit PDF); `withForms`
// makes form fields fillable (Fill PDF).
function usePdfPageView(file: File, { withEditor, withForms }: { withEditor: boolean; withForms: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [pdfViewer, setPdfViewer] = useState<PdfJsViewer | null>(null)
  const [eventBus, setEventBus] = useState<EventBus | null>(null)
  const [pdfjsLibrary, setPdfjsLibrary] = useState<typeof import('pdfjs-dist') | null>(null)
  const [uiManager, setUiManager] = useState<PdfJsUiManager | null>(null)
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([])

  useEffect(() => {
    let isCancelled = false
    let loadingTask: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | null = null
    const scrollElement = scrollRef.current
    const pagesElement = pagesRef.current
    if (!scrollElement || !pagesElement) return
    void (async () => {
      try {
        const { pdfjs, viewer } = await loadPdfLibrary()
        if (isCancelled) return
        const bus = new viewer.EventBus()
        const linkService = new viewer.PDFLinkService({ eventBus: bus })
        const createdViewer = new viewer.PDFViewer({
          container: scrollElement,
          viewer: pagesElement,
          eventBus: bus,
          linkService,
          l10n: silentLocalization as unknown as NonNullable<ConstructorParameters<typeof viewer.PDFViewer>[0]['l10n']>,
          annotationMode: withForms ? pdfjs.AnnotationMode.ENABLE_FORMS : pdfjs.AnnotationMode.ENABLE,
          annotationEditorMode: withEditor ? pdfjs.AnnotationEditorType.NONE : pdfjs.AnnotationEditorType.DISABLE,
          // pdf.js's own default list: without it, adding a highlight fails while naming its colour.
          annotationEditorHighlightColors: 'yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F',
          imageResourcesPath: `${PDFJS_DATA_ROOT}web/images/`,
        })
        linkService.setViewer(createdViewer)
        bus.on('pagesinit', () => {
          createdViewer.currentScaleValue = isNarrowScreen() ? 'page-width' : 'page-fit'
        })
        bus.on('annotationeditoruimanager', ({ uiManager: manager }: { uiManager: PdfJsUiManager }) => setUiManager(manager))
        loadingTask = pdfjs.getDocument(pdfDocumentOptions(await file.arrayBuffer()))
        let needsPassword = false
        loadingTask.onPassword = () => {
          needsPassword = true
          void loadingTask?.destroy()
        }
        const openedDocument = await loadingTask.promise.catch((error) => {
          throw needsPassword ? new Error('encrypted') : error
        })
        if (isCancelled) return
        reorderRightToLeftTextOf(await openedDocument.getPage(1))
        const sizes = []
        for (let pageNumber = 1; pageNumber <= openedDocument.numPages; pageNumber++) {
          const viewport = (await openedDocument.getPage(pageNumber)).getViewport({ scale: 1 })
          sizes.push({ width: viewport.width, height: viewport.height })
        }
        createdViewer.setDocument(openedDocument)
        linkService.setDocument(openedDocument)
        setPageSizes(sizes)
        setPdfjsLibrary(pdfjs)
        setEventBus(bus)
        setPdfViewer(createdViewer)
        setPdfDocument(openedDocument)
        setViewState('ready')
      } catch (error) {
        if (!isCancelled) setViewState(error instanceof Error && error.message === 'encrypted' ? 'encrypted' : 'unreadable')
      }
    })()
    return () => {
      isCancelled = true
      void loadingTask?.destroy()
    }
  }, [file, withEditor, withForms])

  return { scrollRef, pagesRef, viewState, pdfDocument, pdfViewer, eventBus, pdfjsLibrary, uiManager, pageSizes }
}
// The parts of pdf.js's AnnotationEditorUIManager used here (it is not in pdf.js's public types).
type PdfJsUiManager = { addCommands: (params: { type?: number; overwriteIfSameType?: boolean }) => void; undo: () => void; redo: () => void; getEditors: (pageIndex: number) => Iterable<{ isEmpty: () => boolean }> }

// Where every page sits inside the overlay, measured again when pdf.js lays the pages out (zoom, resize, first draw).
function usePageFrames(view: ReturnType<typeof usePdfPageView>, overlayRef: React.RefObject<HTMLDivElement | null>) {
  const [frames, setFrames] = useState<PageFrame[]>([])
  const measure = useCallback(() => {
    const overlay = overlayRef.current
    const pagesElement = view.pagesRef.current
    if (!overlay || !pagesElement || view.pageSizes.length === 0) return
    const overlayBox = overlay.getBoundingClientRect()
    setFrames(
      view.pageSizes.map((size, pageIndex) => {
        const pageBox = pagesElement.querySelector(`.page[data-page-number="${pageIndex + 1}"]`)?.getBoundingClientRect()
        if (!pageBox) return { left: 0, top: 0, width: 0, height: 0, pixelsPerPoint: 1 }
        return { left: pageBox.left - overlayBox.left, top: pageBox.top - overlayBox.top, width: pageBox.width, height: pageBox.height, pixelsPerPoint: pageBox.width / size.width }
      }),
    )
  }, [overlayRef, view.pagesRef, view.pageSizes])
  useLayoutEffect(() => {
    const { eventBus } = view
    if (!eventBus) return
    const remeasure = () => requestAnimationFrame(measure)
    for (const eventName of ['pagesinit', 'scalechanging', 'pagerendered', 'rotationchanging']) eventBus.on(eventName, remeasure)
    const resizeObserver = new ResizeObserver(remeasure)
    if (view.scrollRef.current) resizeObserver.observe(view.scrollRef.current)
    remeasure()
    return () => {
      for (const eventName of ['pagesinit', 'scalechanging', 'pagerendered', 'rotationchanging']) eventBus.off(eventName, remeasure)
      resizeObserver.disconnect()
    }
  }, [view, measure])
  return frames
}

// ---------------------------------------------------------------- our layer: pictures and shapes

function ShapeDrawing({ item, frame }: { item: ShapeItem; frame: PageFrame }) {
  const scale = frame.pixelsPerPoint
  const width = Math.max(Math.abs(item.box.width) * scale, 1)
  const height = Math.max(Math.abs(item.box.height) * scale, 1)
  const stroke = Math.max(item.thickness * scale, 1)
  const padding = stroke + 12 * scale
  const from = { x: padding + (item.box.width < 0 ? width : 0), y: padding + (item.box.height < 0 ? height : 0) }
  const to = { x: padding + (item.box.width < 0 ? 0 : width), y: padding + (item.box.height < 0 ? 0 : height) }
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const headLength = 12 * scale
  const head = [-1, 1].map((side) => `${to.x + headLength * Math.cos(angle + Math.PI + (side * Math.PI) / 7)},${to.y + headLength * Math.sin(angle + Math.PI + (side * Math.PI) / 7)}`)
  return (
    <svg width={width + 2 * padding} height={height + 2 * padding} className="pdf-item-shape" aria-hidden="true">
      {item.kind === 'rectangle' && <rect x={padding} y={padding} width={width} height={height} fill="none" stroke={item.color} strokeWidth={stroke} />}
      {item.kind === 'ellipse' && <ellipse cx={padding + width / 2} cy={padding + height / 2} rx={width / 2} ry={height / 2} fill="none" stroke={item.color} strokeWidth={stroke} />}
      {(item.kind === 'line' || item.kind === 'arrow') && <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={item.color} strokeWidth={stroke} strokeLinecap="round" />}
      {item.kind === 'arrow' && <polyline points={`${head[0]} ${to.x},${to.y} ${head[1]}`} fill="none" stroke={item.color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

// The box an item is drawn in on screen (a line's box is normalised, with room for its arrow head and stroke).
function itemScreenBox(item: OverlayItem, frame: PageFrame) {
  const scale = frame.pixelsPerPoint
  const left = frame.left + Math.min(item.box.x, item.box.x + item.box.width) * scale
  const top = frame.top + Math.min(item.box.y, item.box.y + item.box.height) * scale
  if (item.kind === 'picture') return { left, top, width: item.box.width * scale, height: item.box.height * scale, padding: 0 }
  const padding = Math.max(item.thickness * scale, 1) + 12 * scale
  return { left: left - padding, top: top - padding, width: Math.abs(item.box.width) * scale + 2 * padding, height: Math.abs(item.box.height) * scale + 2 * padding, padding }
}

type Drag = { itemId: number; mode: 'move' | 'resize'; startX: number; startY: number; startBox: PageBox; box: PageBox }

function OverlayLayer({
  overlayRef,
  frames,
  items,
  selectedId,
  drawingKind,
  onSelect,
  onChangeBox,
  onDelete,
  onCreateShape,
  pageSizes,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>
  frames: PageFrame[]
  items: OverlayItem[]
  selectedId: number | null
  drawingKind: ShapeKind | null
  onSelect: (id: number | null) => void
  onChangeBox: (id: number, box: PageBox) => void
  onDelete: (id: number) => void
  onCreateShape: (pageIndex: number, box: PageBox) => void
  pageSizes: { width: number; height: number }[]
}) {
  const { t } = useT()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [newShape, setNewShape] = useState<{ pageIndex: number; box: PageBox } | null>(null)

  // A point in the overlay as a page and a position on it, in points.
  function pagePointAt(clientX: number, clientY: number) {
    const overlayBox = overlayRef.current!.getBoundingClientRect()
    const x = clientX - overlayBox.left
    const y = clientY - overlayBox.top
    const pageIndex = frames.findIndex((frame) => x >= frame.left && x <= frame.left + frame.width && y >= frame.top && y <= frame.top + frame.height)
    if (pageIndex === -1) return null
    return { pageIndex, x: (x - frames[pageIndex].left) / frames[pageIndex].pixelsPerPoint, y: (y - frames[pageIndex].top) / frames[pageIndex].pixelsPerPoint }
  }

  function startShape(event: ReactPointerEvent<HTMLDivElement>) {
    const point = pagePointAt(event.clientX, event.clientY)
    if (!point || !drawingKind) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setNewShape({ pageIndex: point.pageIndex, box: { x: point.x, y: point.y, width: 0, height: 0 } })
  }
  function growShape(event: ReactPointerEvent<HTMLDivElement>) {
    if (!newShape) return
    const frame = frames[newShape.pageIndex]
    const overlayBox = overlayRef.current!.getBoundingClientRect()
    const x = Math.min(Math.max((event.clientX - overlayBox.left - frame.left) / frame.pixelsPerPoint, 0), pageSizes[newShape.pageIndex].width)
    const y = Math.min(Math.max((event.clientY - overlayBox.top - frame.top) / frame.pixelsPerPoint, 0), pageSizes[newShape.pageIndex].height)
    setNewShape({ ...newShape, box: { ...newShape.box, width: x - newShape.box.x, height: y - newShape.box.y } })
  }
  function finishShape() {
    if (!newShape) return
    const { box } = newShape
    const isLine = drawingKind === 'line' || drawingKind === 'arrow'
    // Shapes keep a positive box; a click without a drag makes a shape of a sensible size.
    const hasSize = Math.abs(box.width) > 3 || Math.abs(box.height) > 3
    const shapeBox = !hasSize ? { x: box.x, y: box.y, width: 120, height: isLine ? 0 : 80 } : isLine ? box : { x: Math.min(box.x, box.x + box.width), y: Math.min(box.y, box.y + box.height), width: Math.abs(box.width), height: Math.abs(box.height) }
    onCreateShape(newShape.pageIndex, shapeBox)
    setNewShape(null)
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, item: OverlayItem, mode: Drag['mode']) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(item.id)
    setDrag({ itemId: item.id, mode, startX: event.clientX, startY: event.clientY, startBox: item.box, box: item.box })
  }
  function moveDrag(event: ReactPointerEvent<HTMLElement>, item: OverlayItem) {
    if (!drag || drag.itemId !== item.id) return
    const scale = frames[item.pageIndex].pixelsPerPoint
    const deltaX = (event.clientX - drag.startX) / scale
    const deltaY = (event.clientY - drag.startY) / scale
    if (drag.mode === 'move') {
      setDrag({ ...drag, box: { ...drag.startBox, x: drag.startBox.x + deltaX, y: drag.startBox.y + deltaY } })
    } else if (item.kind === 'picture') {
      // Pictures keep their proportions.
      const width = Math.max(drag.startBox.width + deltaX, 20)
      setDrag({ ...drag, box: { ...drag.startBox, width, height: (width * drag.startBox.height) / drag.startBox.width } })
    } else {
      setDrag({ ...drag, box: { ...drag.startBox, width: drag.startBox.width + deltaX, height: drag.startBox.height + deltaY } })
    }
  }
  function endDrag() {
    if (drag && (drag.box.x !== drag.startBox.x || drag.box.y !== drag.startBox.y || drag.box.width !== drag.startBox.width || drag.box.height !== drag.startBox.height)) onChangeBox(drag.itemId, drag.box)
    setDrag(null)
  }

  function handleItemKeyDown(event: ReactKeyboardEvent, item: OverlayItem) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onDelete(item.id)
      return
    }
    const step = event.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    onChangeBox(item.id, { ...item.box, x: item.box.x + move[0], y: item.box.y + move[1] })
  }

  const overlayWidth = frames.reduce((widest, frame) => Math.max(widest, frame.left + frame.width), 0)
  const overlayHeight = frames.reduce((lowest, frame) => Math.max(lowest, frame.top + frame.height), 0)
  return (
    // The overlay is the pages' own space, so it stays left to right on an Arabic page.
    <div ref={overlayRef} dir="ltr" className={`pdf-overlay${drawingKind ? ' is-drawing' : ''}`}>
      {drawingKind && (
        <div
          className="pdf-overlay-surface"
          ref={(surface) => {
            if (!surface) return
            surface.style.width = `${overlayWidth}px`
            surface.style.height = `${overlayHeight}px`
          }}
          onPointerDown={startShape}
          onPointerMove={growShape}
          onPointerUp={finishShape}
        />
      )}
      {items.map((listedItem, position) => {
        const item = drag?.itemId === listedItem.id ? { ...listedItem, box: drag.box } : listedItem
        const frame = frames[item.pageIndex]
        if (!frame || frame.width === 0) return null
        const screenBox = itemScreenBox(item, frame)
        const isSelected = selectedId === item.id
        return (
          <div
            key={item.id}
            id={`pdf-item-${position + 1}`}
            role="group"
            tabIndex={0}
            aria-label={t(item.kind === 'picture' ? 'tools.editor.pictureItem' : `tools.editor.shape.${item.kind}`, { page: item.pageIndex + 1 })}
            className={`pdf-item${isSelected ? ' is-selected' : ''}`}
            ref={(element) => {
              if (!element) return
              element.style.left = `${screenBox.left}px`
              element.style.top = `${screenBox.top}px`
              element.style.width = `${screenBox.width}px`
              element.style.height = `${screenBox.height}px`
            }}
            onPointerDown={(event) => startDrag(event, item, 'move')}
            onPointerMove={(event) => moveDrag(event, item)}
            onPointerUp={endDrag}
            onFocus={() => onSelect(item.id)}
            onKeyDown={(event) => handleItemKeyDown(event, item)}
          >
            {item.kind === 'picture' ? <img src={item.pictureUrl} alt="" draggable={false} className="pdf-item-picture" /> : <ShapeDrawing item={item} frame={frame} />}
            {isSelected && (
              <>
                <span className="pdf-item-handle" aria-hidden="true" onPointerDown={(event) => startDrag(event, item, 'resize')} onPointerMove={(event) => moveDrag(event, item)} onPointerUp={endDrag} />
                <button id={`pdf-item-${position + 1}-delete-button`} type="button" className="pdf-item-delete" aria-label={t('tools.editor.deleteItem')} onPointerDown={(event) => event.stopPropagation()} onClick={() => onDelete(item.id)}>
                  ×
                </button>
              </>
            )}
          </div>
        )
      })}
      {newShape && frames[newShape.pageIndex] && <ShapePreview frame={frames[newShape.pageIndex]} box={newShape.box} />}
    </div>
  )
}

function ShapePreview({ frame, box }: { frame: PageFrame; box: PageBox }) {
  return (
    <div
      className="pdf-shape-preview"
      ref={(element) => {
        if (!element) return
        element.style.left = `${frame.left + Math.min(box.x, box.x + box.width) * frame.pixelsPerPoint}px`
        element.style.top = `${frame.top + Math.min(box.y, box.y + box.height) * frame.pixelsPerPoint}px`
        element.style.width = `${Math.abs(box.width) * frame.pixelsPerPoint}px`
        element.style.height = `${Math.abs(box.height) * frame.pixelsPerPoint}px`
      }}
    />
  )
}

// ---------------------------------------------------------------- one undo history for our layer and pdf.js's editor

// Our items live in an edit session (undo, redo); pdf.js keeps its own commands. A timeline of which one acted lets Undo and
// Redo step back through both in the order they happened.
function useOverlayHistory(uiManager: PdfJsUiManager | null) {
  const session = useEditSession<OverlayItem[]>(
    () => [],
    (items) => items.length,
  )
  const [timeline, setTimeline] = useState<{ undo: ('overlay' | 'pdfjs')[]; redo: ('overlay' | 'pdfjs')[] }>({ undo: [], redo: [] })

  useEffect(() => {
    if (!uiManager) return
    const addCommands = uiManager.addCommands.bind(uiManager)
    let lastType: number | undefined
    uiManager.addCommands = (params) => {
      // pdf.js merges a command into the last one of the same type (dragging a box): that is not a new step.
      const isMerged = params.overwriteIfSameType && params.type === lastType
      lastType = params.type
      addCommands(params)
      if (!isMerged) setTimeline((current) => ({ undo: [...current.undo, 'pdfjs'], redo: [] }))
    }
    return () => {
      uiManager.addCommands = addCommands
    }
  }, [uiManager])

  const changeItems = useCallback(
    (change: (items: OverlayItem[]) => OverlayItem[]) => {
      session.update(change)
      setTimeline((current) => ({ undo: [...current.undo, 'overlay'], redo: [] }))
    },
    [session],
  )
  function undo() {
    const source = timeline.undo.at(-1)
    if (!source) return
    if (source === 'overlay') session.undo()
    else uiManager?.undo()
    setTimeline({ undo: timeline.undo.slice(0, -1), redo: [...timeline.redo, source] })
  }
  function redo() {
    const source = timeline.redo.at(-1)
    if (!source) return
    if (source === 'overlay') session.redo()
    else uiManager?.redo()
    setTimeline({ undo: [...timeline.undo, source], redo: timeline.redo.slice(0, -1) })
  }
  return { items: session.edits, changeItems, undo, redo, canUndo: timeline.undo.length > 0, canRedo: timeline.redo.length > 0, editCount: timeline.undo.length }
}

// ---------------------------------------------------------------- the editor frame shared by the three tools

function EditorFrame({
  id,
  view,
  menus,
  toolbar,
  note,
  overlay,
  saveProgress,
  error,
}: {
  id: string
  view: ReturnType<typeof usePdfPageView>
  menus: MenuDefinition[]
  toolbar: ReactNode
  note: ReactNode
  overlay?: ReactNode
  saveProgress: { done: number; total: number } | null
  error: string
}) {
  const { t } = useT()
  const editorRef = useRef<HTMLDivElement>(null)
  // The pages are the work: once a file is open, the editor comes into view instead of staying below the page's introduction.
  useEffect(() => {
    editorRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  return (
    <div ref={editorRef} id={id} className="pdf-editor scroll-mt-4 space-y-3 text-start">
      <MenuBar menus={menus} isCompact={isNarrowScreen()} label={t('tools.editor.menuLabel')} />
      <div className="pdf-editor-toolbar" role="toolbar" aria-label={t('tools.editor.toolbarLabel')}>
        {toolbar}
      </div>
      {note}
      {saveProgress && <ProgressBar id="tool-progress" done={saveProgress.done} total={saveProgress.total} label={t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={view.viewState === 'encrypted' || view.viewState === 'unreadable' ? t(problemMessageKey(view.viewState)) : error} />
      <div className="pdf-editor-frame">
        {/* pdf.js measures and scrolls this box; it must be absolutely positioned. */}
        <div ref={view.scrollRef} id="pdf-editor-scroll" className="pdf-editor-scroll">
          <div ref={view.pagesRef} className="pdfViewer" />
          {overlay}
        </div>
        {view.viewState === 'loading' && <p className="pdf-editor-loading">{t('tools.pdf.reading')}</p>}
      </div>
    </div>
  )
}

// Saving, the unsaved-edits report and closing the file, the same in the three tools.
function useEditorSaving({ files, onFilesChange, onResult, onUnsavedEditsChange, confirmDiscardEdits }: ToolProps, hasEdits: boolean, resultSuffix: string) {
  const { t } = useT()
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    onUnsavedEditsChange?.(hasEdits)
  }, [hasEdits, onUnsavedEditsChange])
  async function saveCopy(makeBytes: (onProgress: (done: number, total: number) => void) => Promise<Uint8Array>) {
    setError('')
    setSaveProgress({ done: 0, total: 0 })
    try {
      const bytes = await makeBytes((done, total) => setSaveProgress({ done, total }))
      onResult(pdfResultFile(bytes, `${baseNameOf(files[0].name)}-${resultSuffix}.pdf`))
    } catch {
      setError(t('tools.editor.saveFailed'))
    }
    setSaveProgress(null)
  }
  async function closeFile() {
    if (hasEdits && confirmDiscardEdits && !(await confirmDiscardEdits())) return
    onUnsavedEditsChange?.(false)
    onFilesChange([])
  }
  return { saveProgress, error, saveCopy, closeFile }
}

function fileMenu(t: ReturnType<typeof useT>['t'], onSave: () => void, onClose: () => void, isSaveDisabled: boolean): MenuDefinition {
  return {
    id: 'file',
    label: t('tools.editor.menu.file'),
    items: [
      { id: 'save-copy', label: t('tools.editor.saveCopy'), isDisabled: isSaveDisabled, onSelect: onSave },
      'separator',
      { id: 'close', label: t('tools.editor.closeFile'), onSelect: onClose },
    ],
  }
}
function editMenu(t: ReturnType<typeof useT>['t'], history: ReturnType<typeof useOverlayHistory>, selectedId: number | null, onDelete: () => void): MenuDefinition {
  return {
    id: 'edit',
    label: t('tools.editor.menu.edit'),
    items: [
      { id: 'undo', label: t('tools.editor.undo'), isDisabled: !history.canUndo, onSelect: history.undo },
      { id: 'redo', label: t('tools.editor.redo'), isDisabled: !history.canRedo, onSelect: history.redo },
      'separator',
      { id: 'delete', label: t('tools.editor.deleteItem'), isDisabled: selectedId === null, onSelect: onDelete },
    ],
  }
}

// `itemCount`: what is on the pages now (our items and pdf.js's text boxes, highlights and drawings).
function UndoRedoButtons({ history, itemCount }: { history: ReturnType<typeof useOverlayHistory>; itemCount: number }) {
  const { t, tp } = useT()
  return (
    <>
      <button id="editor-undo-button" type="button" disabled={!history.canUndo} onClick={history.undo} className="btn btn--quiet btn--compact press">
        {t('tools.editor.undo')}
      </button>
      <button id="editor-redo-button" type="button" disabled={!history.canRedo} onClick={history.redo} className="btn btn--quiet btn--compact press">
        {t('tools.editor.redo')}
      </button>
      <ChangeCounter description={itemCount > 0 ? tp('tools.editor.changes', itemCount) : ''} />
    </>
  )
}

// A picture placed in the middle of the page being looked at, `widthPoints` wide.
function centredPictureItem(id: number, pageIndex: number, pageSize: { width: number; height: number }, picture: StampPicture, widthPoints: number): PictureItem {
  const width = Math.min(widthPoints, pageSize.width * 0.8)
  const height = (width * picture.height) / picture.width
  return { id, kind: 'picture', pageIndex, picture, pictureUrl: picture.canvas.toDataURL('image/png'), box: { x: (pageSize.width - width) / 2, y: (pageSize.height - height) / 2, width, height } }
}

const visiblePageIndex = (view: ReturnType<typeof usePdfPageView>) => Math.max(0, (view.pdfViewer?.currentPageNumber ?? 1) - 1)

// ---------------------------------------------------------------- Edit PDF

type EditMode = 'select' | 'text' | 'highlight' | 'draw' | ShapeKind

export function EditPdf(props: ToolProps) {
  const { t } = useT()
  const view = usePdfPageView(props.files[0], { withEditor: true, withForms: false })
  const overlayRef = useRef<HTMLDivElement>(null)
  const frames = usePageFrames(view, overlayRef)
  const history = useOverlayHistory(view.uiManager)
  const [mode, setMode] = useState<EditMode>('select')
  const [color, setColor] = useState('red')
  const [thickness, setThickness] = useState(2)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const nextIdRef = useRef(1)
  const pictureInputRef = useRef<HTMLInputElement>(null)
  const saving = useEditorSaving(props, history.editCount > 0, 'edited')
  const isShapeMode = mode === 'rectangle' || mode === 'ellipse' || mode === 'line' || mode === 'arrow'

  // pdf.js's editor follows the mode; our shapes are drawn on our own layer.
  const { pdfViewer, pdfjsLibrary, uiManager, eventBus, pdfDocument } = view
  // pdf.js's own items (text boxes, highlights, drawings), counted again after every step of the shared history (pdf.js reports
  // its state only when it flips, so its events are not enough), once pdf.js has finished the step.
  const [pdfjsItemCount, setPdfjsItemCount] = useState(0)
  useEffect(() => {
    if (!pdfDocument || !uiManager) return
    const frame = requestAnimationFrame(() => {
      let count = 0
      for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex++) for (const editor of uiManager.getEditors(pageIndex)) if (!editor.isEmpty()) count++
      setPdfjsItemCount(count)
    })
    return () => cancelAnimationFrame(frame)
  }, [pdfDocument, uiManager, history.editCount, mode])
  useEffect(() => {
    if (!pdfViewer || !pdfjsLibrary || !uiManager) return
    const { AnnotationEditorType } = pdfjsLibrary
    const pdfjsMode = mode === 'text' ? AnnotationEditorType.FREETEXT : mode === 'highlight' ? AnnotationEditorType.HIGHLIGHT : mode === 'draw' ? AnnotationEditorType.INK : AnnotationEditorType.NONE
    pdfViewer.annotationEditorMode = { mode: pdfjsMode }
  }, [mode, pdfViewer, pdfjsLibrary, uiManager])

  useEffect(() => {
    if (!eventBus || !pdfjsLibrary || !uiManager) return
    const { AnnotationEditorParamsType } = pdfjsLibrary
    if (mode === 'text') eventBus.dispatch('switchannotationeditorparams', { source: null, type: AnnotationEditorParamsType.FREETEXT_COLOR, value: COLORS[color] })
    if (mode === 'draw') {
      eventBus.dispatch('switchannotationeditorparams', { source: null, type: AnnotationEditorParamsType.INK_COLOR, value: COLORS[color] })
      eventBus.dispatch('switchannotationeditorparams', { source: null, type: AnnotationEditorParamsType.INK_THICKNESS, value: thickness })
    }
  }, [mode, color, thickness, eventBus, pdfjsLibrary, uiManager])

  function addShape(pageIndex: number, box: PageBox) {
    const id = nextIdRef.current++
    history.changeItems((items) => [...items, { id, kind: mode as ShapeKind, pageIndex, box, color: COLORS[color], thickness }])
    setSelectedId(id)
    setMode('select')
  }
  function addPicture(pictureFile: File) {
    void createImageBitmap(pictureFile).then((bitmap) => {
      const pageIndex = visiblePageIndex(view)
      const picture = turnPicture(bitmap, PICTURE_LONG_SIDE_POINTS)
      const id = nextIdRef.current++
      history.changeItems((items) => [...items, centredPictureItem(id, pageIndex, view.pageSizes[pageIndex], picture, PICTURE_LONG_SIDE_POINTS)])
      setSelectedId(id)
      setMode('select')
    })
  }
  const deleteItem = (id: number | null) => id !== null && history.changeItems((items) => items.filter((item) => item.id !== id))

  function saveEditedCopy() {
    if (!pdfDocument) return
    // pdf.js writes its own text boxes, highlights and drawings; our shapes and pictures go on top.
    void saving.saveCopy(async (onProgress) => stampOverlayItems(await pdfDocument.saveDocument(), history.items, onProgress))
  }

  const modeButtons: [EditMode, MessageKey][] = [
    ['select', 'tools.edit.mode.select'],
    ['text', 'tools.edit.mode.text'],
    ['highlight', 'tools.edit.mode.highlight'],
    ['draw', 'tools.edit.mode.draw'],
  ]
  const isReady = view.viewState === 'ready'
  return (
    <EditorFrame
      id="edit-pdf-tool"
      view={view}
      menus={[fileMenu(t, saveEditedCopy, () => void saving.closeFile(), !isReady || saving.saveProgress !== null), editMenu(t, history, selectedId, () => deleteItem(selectedId))]}
      saveProgress={saving.saveProgress}
      error={saving.error}
      note={<p id="edit-pdf-note" className="text-center text-sm text-ink-soft">{t('tools.edit.existingTextNote')}</p>}
      toolbar={
        <>
          {modeButtons.map(([buttonMode, labelKey]) => (
            <button key={buttonMode} id={`edit-mode-${buttonMode}-button`} type="button" aria-pressed={mode === buttonMode} disabled={!isReady} onClick={() => setMode(buttonMode)} className="btn btn--quiet btn--compact press">
              {t(labelKey)}
            </button>
          ))}
          <select id="edit-mode-shape-select" aria-label={t('tools.edit.shapeLabel')} value={isShapeMode ? mode : ''} disabled={!isReady} onChange={(event) => setMode((event.target.value || 'select') as EditMode)} className={fieldClass}>
            <option value="">{t('tools.edit.shapeLabel')}</option>
            {(['rectangle', 'ellipse', 'line', 'arrow'] as const).map((kind) => (
              <option key={kind} value={kind}>
                {t(`tools.editor.shapeName.${kind}`)}
              </option>
            ))}
          </select>
          <input ref={pictureInputRef} id="edit-image-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => {
            const pictureFile = event.target.files?.[0]
            if (pictureFile) addPicture(pictureFile)
            event.target.value = ''
          }} />
          <button id="edit-mode-image-button" type="button" disabled={!isReady} onClick={() => pictureInputRef.current?.click()} className="btn btn--quiet btn--compact press">
            {t('tools.edit.mode.image')}
          </button>
          <select id="edit-color-select" aria-label={t('tools.edit.color')} value={color} onChange={(event) => setColor(event.target.value)} className={fieldClass}>
            {Object.keys(COLORS).map((name) => (
              <option key={name} value={name}>
                {t(`tools.color.${name}` as MessageKey)}
              </option>
            ))}
          </select>
          <select id="edit-thickness-select" aria-label={t('tools.edit.thickness')} value={thickness} onChange={(event) => setThickness(Number(event.target.value))} className={fieldClass}>
            {[1, 2, 4, 8].map((points) => (
              <option key={points} value={points}>
                {t('tools.edit.thicknessValue', { points })}
              </option>
            ))}
          </select>
          <UndoRedoButtons history={history} itemCount={history.items.length + pdfjsItemCount} />
          <button id="edit-save-button" type="button" disabled={!isReady || saving.saveProgress !== null} onClick={saveEditedCopy} className="btn btn--primary btn--compact press">
            {t('tools.editor.saveCopy')}
          </button>
        </>
      }
      overlay={<OverlayLayer overlayRef={overlayRef} frames={frames} items={history.items} selectedId={selectedId} drawingKind={isShapeMode ? (mode as ShapeKind) : null} onSelect={setSelectedId} onChangeBox={(id, box) => history.changeItems((items) => items.map((item) => (item.id === id ? { ...item, box } : item)))} onDelete={deleteItem} onCreateShape={addShape} pageSizes={view.pageSizes} />}
    />
  )
}

// ---------------------------------------------------------------- Sign PDF

type SignatureTab = 'draw' | 'type' | 'upload'
const SIGNATURE_STYLES = [
  { id: 'classic', fontFamily: '"Nunito Sans", "IBM Plex Sans Arabic", sans-serif', fontWeight: 600, isItalic: true },
  { id: 'rounded', fontFamily: '"Fredoka", "IBM Plex Sans Arabic", sans-serif', fontWeight: 500, isItalic: false },
  { id: 'bold', fontFamily: '"Baloo Bhaijaan 2", "Fredoka", sans-serif', fontWeight: 700, isItalic: false },
] as const
const INK_COLORS: Record<string, string> = { black: '#1f1f1f', blue: '#1d3fa8' }

// The part of a canvas that has ink on it, as a new canvas (a drawn signature without the empty space around it).
function trimToInk(source: HTMLCanvasElement) {
  const context = source.getContext('2d')!
  const { data, width, height } = context.getImageData(0, 0, source.width, source.height)
  let top = height, left = width, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
  }
  if (right < 0) return null
  const trimmed = document.createElement('canvas')
  trimmed.width = right - left + 9
  trimmed.height = bottom - top + 9
  trimmed.getContext('2d')!.drawImage(source, left - 4, top - 4, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height)
  return trimmed
}

// An uploaded signature on a canvas; near-white pixels become see-through when asked (a signature photographed on paper).
async function readSignaturePicture(pictureFile: File, isWhiteRemoved: boolean) {
  const bitmap = await createImageBitmap(pictureFile)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0)
  if (isWhiteRemoved) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (pixels.data[index] > 225 && pixels.data[index + 1] > 225 && pixels.data[index + 2] > 225) pixels.data[index + 3] = 0
    }
    context.putImageData(pixels, 0, 0)
  }
  return trimToInk(canvas) ?? canvas
}

function SignatureDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (picture: StampPicture) => void }) {
  const { t } = useT()
  const [tab, setTab] = useState<SignatureTab>('draw')
  const [inkColor, setInkColor] = useState('black')
  const [hasInk, setHasInk] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [styleId, setStyleId] = useState<(typeof SIGNATURE_STYLES)[number]['id']>('classic')
  const [typedPreview, setTypedPreview] = useState<StampPicture | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isWhiteRemoved, setIsWhiteRemoved] = useState(true)
  const [uploadedPreview, setUploadedPreview] = useState<HTMLCanvasElement | null>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const style = SIGNATURE_STYLES.find((candidate) => candidate.id === styleId)!
    if (!typedName.trim()) return
    let isCurrent = true
    void drawTextPicture(typedName.trim(), { sizePoints: 36, color: INK_COLORS[inkColor], fontFamily: style.fontFamily, fontWeight: style.fontWeight, isItalic: style.isItalic }).then((picture) => isCurrent && setTypedPreview(picture))
    return () => {
      isCurrent = false
    }
  }, [typedName, styleId, inkColor])
  useEffect(() => {
    if (!uploadedFile) return
    let isCurrent = true
    void readSignaturePicture(uploadedFile, isWhiteRemoved).then((canvas) => isCurrent && setUploadedPreview(canvas), () => isCurrent && setUploadedPreview(null))
    return () => {
      isCurrent = false
    }
  }, [uploadedFile, isWhiteRemoved])

  function pointOnCanvas(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const box = canvas.getBoundingClientRect()
    return { x: ((event.clientX - box.left) * canvas.width) / box.width, y: ((event.clientY - box.top) * canvas.height) / box.height }
  }
  function drawStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const lastPoint = lastPointRef.current
    if (!lastPoint) return
    const point = pointOnCanvas(event)
    const context = event.currentTarget.getContext('2d')!
    context.strokeStyle = INK_COLORS[inkColor]
    context.lineWidth = 4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(lastPoint.x, lastPoint.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPointRef.current = point
    setHasInk(true)
  }
  function clearDrawing() {
    const canvas = drawCanvasRef.current
    canvas?.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }
  function useSignature() {
    if (tab === 'draw' && drawCanvasRef.current) {
      const trimmed = trimToInk(drawCanvasRef.current)
      if (trimmed) onCreate(turnPicture(trimmed, SIGNATURE_WIDTH_POINTS * 2))
    } else if (tab === 'type' && typedPreview) {
      onCreate(typedPreview)
    } else if (tab === 'upload' && uploadedPreview) {
      onCreate(turnPicture(uploadedPreview, SIGNATURE_WIDTH_POINTS * 2))
    }
  }
  const canUse = tab === 'draw' ? hasInk : tab === 'type' ? typedName.trim() !== '' && typedPreview !== null : uploadedPreview !== null

  return (
    <ModalDialog id="dialog-create-signature" title={t('tools.sign.dialogTitle')} describedById="sign-dialog-note" onClose={onClose} widthClassName="w-[min(40rem,calc(100vw-2rem))]">
      <p id="sign-dialog-note" className="mt-2 text-sm text-ink-soft">
        {t('tools.sign.visualNote')}
      </p>
      <div role="tablist" aria-label={t('tools.sign.howLabel')} className="mt-4 flex gap-2">
        {(['draw', 'type', 'upload'] as const).map((tabName) => (
          <button key={tabName} id={`sign-tab-${tabName}`} role="tab" type="button" aria-selected={tab === tabName} aria-controls={`sign-panel-${tabName}`} onClick={() => setTab(tabName)} className={`btn btn--compact press ${tab === tabName ? 'btn--primary' : 'btn--quiet'}`}>
            {t(`tools.sign.tab.${tabName}`)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t('tools.sign.inkColor')}
          <select id="sign-ink-color-select" value={inkColor} onChange={(event) => setInkColor(event.target.value)} className={fieldClass}>
            {Object.keys(INK_COLORS).map((name) => (
              <option key={name} value={name}>
                {t(`tools.color.${name}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tab === 'draw' && (
        <div id="sign-panel-draw" role="tabpanel" aria-labelledby="sign-tab-draw" className="mt-3">
          <canvas
            ref={drawCanvasRef}
            id="sign-draw-canvas"
            width={900}
            height={300}
            aria-label={t('tools.sign.drawLabel')}
            className="sign-draw-canvas"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              lastPointRef.current = pointOnCanvas(event)
            }}
            onPointerMove={drawStroke}
            onPointerUp={() => (lastPointRef.current = null)}
          />
          <button id="sign-clear-button" type="button" onClick={clearDrawing} className="btn btn--quiet btn--compact press mt-2">
            {t('tools.sign.clear')}
          </button>
        </div>
      )}
      {tab === 'type' && (
        <div id="sign-panel-type" role="tabpanel" aria-labelledby="sign-tab-type" className="mt-3 space-y-3">
          <input id="sign-type-input" type="text" dir="auto" value={typedName} placeholder={t('tools.sign.typePlaceholder')} aria-label={t('tools.sign.typeLabel')} onChange={(event) => setTypedName(event.target.value)} className={`${fieldClass} w-full`} />
          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">{t('tools.sign.styleLabel')}</legend>
            {SIGNATURE_STYLES.map((style) => (
              <label key={style.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input id={`sign-style-${style.id}-radio`} type="radio" name="signature-style" checked={styleId === style.id} onChange={() => setStyleId(style.id)} className="size-5" />
                {t(`tools.sign.style.${style.id}`)}
              </label>
            ))}
          </fieldset>
          {typedPreview && typedName.trim() && <img id="sign-type-preview" src={typedPreview.canvas.toDataURL('image/png')} alt="" className="sign-preview" />}
        </div>
      )}
      {tab === 'upload' && (
        <div id="sign-panel-upload" role="tabpanel" aria-labelledby="sign-tab-upload" className="mt-3 space-y-3">
          <input id="sign-upload-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" aria-label={t('tools.sign.uploadLabel')} onChange={(event) => setUploadedFile(event.target.files?.[0] ?? null)} className="block text-sm" />
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input id="sign-remove-white-checkbox" type="checkbox" checked={isWhiteRemoved} onChange={(event) => setIsWhiteRemoved(event.target.checked)} className="size-5" />
            {t('tools.sign.removeWhite')}
          </label>
          {uploadedPreview && <img id="sign-upload-preview" src={uploadedPreview.toDataURL('image/png')} alt="" className="sign-preview" />}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button id="sign-use-button" type="button" disabled={!canUse} onClick={useSignature} className="btn btn--primary press">
          {t('tools.sign.use')}
        </button>
        <button id="sign-cancel-button" type="button" onClick={onClose} className="btn btn--quiet press">
          {t('tools.sign.cancel')}
        </button>
      </div>
    </ModalDialog>
  )
}

export function SignPdf(props: ToolProps) {
  const { t } = useT()
  const view = usePdfPageView(props.files[0], { withEditor: false, withForms: false })
  const overlayRef = useRef<HTMLDivElement>(null)
  const frames = usePageFrames(view, overlayRef)
  const history = useOverlayHistory(null)
  const [signature, setSignature] = useState<StampPicture | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [copyPages, setCopyPages] = useState<PagesChoiceValue>({ isAllPages: true, ranges: '' })
  const nextIdRef = useRef(1)
  const saving = useEditorSaving(props, history.editCount > 0 && history.items.length > 0, 'signed')
  const selectedItem = history.items.find((item) => item.id === selectedId)

  function placeSignature(picture: StampPicture) {
    const pageIndex = visiblePageIndex(view)
    const id = nextIdRef.current++
    history.changeItems((items) => [...items, centredPictureItem(id, pageIndex, view.pageSizes[pageIndex], picture, SIGNATURE_WIDTH_POINTS)])
    setSelectedId(id)
  }
  // The selected signature, at the same place and size, on every other chosen page (one undo step).
  function copyToPages() {
    if (!selectedItem || selectedItem.kind !== 'picture') return
    const pageIndexes = chosenPageIndexes(copyPages, view.pageSizes.length) ?? []
    history.changeItems((items) => [
      ...items,
      ...pageIndexes
        .filter((pageIndex) => pageIndex !== selectedItem.pageIndex)
        .map((pageIndex) => {
          const page = view.pageSizes[pageIndex]
          const box = { ...selectedItem.box, x: Math.min(selectedItem.box.x, page.width - selectedItem.box.width), y: Math.min(selectedItem.box.y, page.height - selectedItem.box.height) }
          return { ...selectedItem, id: nextIdRef.current++, pageIndex, box }
        }),
    ])
  }
  const deleteItem = (id: number | null) => id !== null && history.changeItems((items) => items.filter((item) => item.id !== id))
  function saveSignedCopy() {
    const { pdfDocument } = view
    if (!pdfDocument) return
    void saving.saveCopy(async (onProgress) => stampOverlayItems(await pdfDocument.getData(), history.items, onProgress))
  }

  const isReady = view.viewState === 'ready'
  return (
    <>
      <EditorFrame
        id="sign-pdf-tool"
        view={view}
        menus={[fileMenu(t, saveSignedCopy, () => void saving.closeFile(), !isReady || history.items.length === 0), editMenu(t, history, selectedId, () => deleteItem(selectedId))]}
        saveProgress={saving.saveProgress}
        error={saving.error}
        note={<p id="sign-pdf-note" className="text-center text-sm text-ink-soft">{t('tools.sign.visualNote')}</p>}
        toolbar={
          <>
            <button id="sign-open-dialog-button" type="button" disabled={!isReady} onClick={() => setIsDialogOpen(true)} className="btn btn--quiet btn--compact press">
              {signature ? t('tools.sign.newSignature') : t('tools.sign.createSignature')}
            </button>
            {signature && (
              <button id="sign-add-button" type="button" onClick={() => placeSignature(signature)} className="btn btn--quiet btn--compact press">
                {t('tools.sign.addAgain')}
              </button>
            )}
            <UndoRedoButtons history={history} itemCount={history.items.length} />
            <button id="sign-save-button" type="button" disabled={!isReady || history.items.length === 0 || saving.saveProgress !== null} onClick={saveSignedCopy} className="btn btn--primary btn--compact press">
              {t('tools.editor.saveCopy')}
            </button>
          </>
        }
        overlay={<OverlayLayer overlayRef={overlayRef} frames={frames} items={history.items} selectedId={selectedId} drawingKind={null} onSelect={setSelectedId} onChangeBox={(id, box) => history.changeItems((items) => items.map((item) => (item.id === id ? { ...item, box } : item)))} onDelete={deleteItem} onCreateShape={() => {}} pageSizes={view.pageSizes} />}
      />
      {selectedItem && (
        <div id="sign-copy-panel" className="mt-3 flex flex-wrap items-end justify-center gap-3">
          <PagesChoice idPrefix="sign-apply" pageCount={view.pageSizes.length} value={copyPages} onChange={setCopyPages} />
          <button id="sign-apply-pages-button" type="button" disabled={chosenPageIndexes(copyPages, view.pageSizes.length) === null} onClick={copyToPages} className="btn btn--quiet press">
            {t('tools.sign.copyToPages')}
          </button>
        </div>
      )}
      {isDialogOpen && (
        <SignatureDialog
          onClose={() => setIsDialogOpen(false)}
          onCreate={(picture) => {
            setSignature(picture)
            setIsDialogOpen(false)
            placeSignature(picture)
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------- Fill PDF

// A form field as pdf.js reads it (the parts used to draw its value when the form is flattened).
type FieldAnnotation = { id: string; fieldType?: string; rect: number[]; fieldValue?: unknown; exportValue?: string; buttonValue?: string; checkBox?: boolean; radioButton?: boolean; options?: { exportValue: string; displayValue: string }[]; subtype: string }

// Each filled field's value drawn in its box, for a flattened copy.
async function flattenedValueStamps(pdfDocument: PDFDocumentProxy) {
  const storage = pdfDocument.annotationStorage
  const images: ArrayBuffer[] = []
  const stamps: PageStamp[] = []
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    for (const annotation of (await page.getAnnotations()) as FieldAnnotation[]) {
      if (annotation.subtype !== 'Widget' || !annotation.fieldType) continue
      const stored = storage.getValue(annotation.id, { value: annotation.fieldValue }) as { value: unknown }
      let text = ''
      if (annotation.fieldType === 'Tx') text = typeof stored.value === 'string' ? stored.value : ''
      if (annotation.fieldType === 'Ch') {
        const chosen = Array.isArray(stored.value) ? stored.value : [stored.value]
        text = chosen.map((value) => annotation.options?.find((option) => option.exportValue === value)?.displayValue ?? String(value ?? '')).filter(Boolean).join(', ')
      }
      if (annotation.fieldType === 'Btn' && (annotation.checkBox || annotation.radioButton)) {
        const isOn = typeof stored.value === 'boolean' ? stored.value : annotation.checkBox ? stored.value === annotation.exportValue : stored.value === annotation.buttonValue
        text = isOn ? '✓' : ''
      }
      if (!text.trim()) continue
      const [left, top] = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1])
      const [right, bottom] = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3])
      const box = { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) }
      const picture = await drawTextPicture(text, { sizePoints: Math.min(11, box.height * 0.7), color: '#111111', fontWeight: 500 })
      // The value fits its box: smaller when it is too wide, at the start of the box (the right for Arabic), centred up and down.
      const fit = Math.min(1, (box.width - 4) / picture.width)
      const width = picture.width * fit
      const height = picture.height * fit
      const isRightAligned = /[؀-ۿ]/.test(text)
      images.push(await pngBytesOf(picture.canvas))
      stamps.push({ pageIndex: pageNumber - 1, imageIndex: images.length - 1, box: { x: annotation.checkBox || annotation.radioButton ? box.x + (box.width - width) / 2 : isRightAligned ? box.x + box.width - width - 2 : box.x + 2, y: box.y + (box.height - height) / 2, width, height } })
    }
  }
  return { images, stamps }
}

export function FillPdf(props: ToolProps) {
  const { t } = useT()
  const view = usePdfPageView(props.files[0], { withEditor: false, withForms: true })
  const [hasEdits, setHasEdits] = useState(false)
  const [hasFields, setHasFields] = useState<boolean | null>(null)
  const [isFlattened, setIsFlattened] = useState(false)
  const saving = useEditorSaving(props, hasEdits, 'filled')

  const { pdfDocument } = view
  useEffect(() => {
    if (!pdfDocument) return
    // pdf.js calls this when a field's value first changes (its type says null, but it is a settable callback).
    ;(pdfDocument.annotationStorage as unknown as { onSetModified: () => void }).onSetModified = () => setHasEdits(true)
    // A form field is a widget annotation with a field type (pdf.js's getFieldObjects() misses some forms, such as pdf-lib's).
    void (async () => {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        const annotations = (await (await pdfDocument.getPage(pageNumber)).getAnnotations()) as FieldAnnotation[]
        if (annotations.some((annotation) => annotation.subtype === 'Widget' && annotation.fieldType)) return setHasFields(true)
      }
      setHasFields(false)
    })()
  }, [pdfDocument])

  function saveFilledCopy() {
    const { pdfDocument } = view
    if (!pdfDocument) return
    void saving.saveCopy(async (onProgress) => {
      if (!isFlattened) return pdfDocument.saveDocument()
      // Flattening starts from the chosen file: pdf.js leaves fields it can't draw (Arabic text in a Helvetica field) without an
      // appearance, which pdf-lib can't remove. The answers come from pdf.js's form storage and are drawn as pictures.
      const { images, stamps } = await flattenedValueStamps(pdfDocument)
      const response = await runPdfTask({ type: 'stamp-pdf', pdf: await props.files[0].arrayBuffer(), images, stamps, removeFormFields: true }, onProgress)
      if (response.status !== 'ok' || !response.pdf) throw new Error('flatten failed')
      return response.pdf
    })
  }

  const isReady = view.viewState === 'ready' && hasFields === true
  return (
    <EditorFrame
      id="fill-pdf-tool"
      view={view}
      menus={[fileMenu(t, saveFilledCopy, () => void saving.closeFile(), !isReady || saving.saveProgress !== null)]}
      saveProgress={saving.saveProgress}
      error={hasFields === false ? t('tools.fill.noFields') : saving.error}
      note={<p id="fill-pdf-note" className="text-center text-sm text-ink-soft">{t('tools.fill.note')}</p>}
      toolbar={
        <>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input id="fill-flatten-checkbox" type="checkbox" checked={isFlattened} disabled={!isReady} onChange={(event) => setIsFlattened(event.target.checked)} className="size-5" />
            {t('tools.fill.flatten')}
          </label>
          <ChangeCounter description={hasEdits ? t('tools.fill.edited') : ''} />
          <button id="fill-save-button" type="button" disabled={!isReady || saving.saveProgress !== null} onClick={saveFilledCopy} className="btn btn--primary btn--compact press">
            {t('tools.editor.saveCopy')}
          </button>
        </>
      }
    />
  )
}
