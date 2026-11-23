// The one-PDF page tools: Split PDF, Remove pages, Extract pages, Rotate PDF, Crop PDF, Repair PDF, Protect PDF, Unlock PDF, Compress PDF,
// Flatten PDF and Remove PDF metadata. The page tools show the PDF's pages as thumbnails (Crop shows one page large); the work runs in
// pdfTools.worker.ts.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { isolateLeftToRight, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { formatFileSize } from '../../useFileIntake'
import { PdfPasswordError, loadPdfCore, openPdfForReading } from '../../formats/pdf/pdfLibrary'
import { runPdfTask } from './pdfTasks'
import type { OutputDocument, OutputPage, PageBox, PagePicture, PageStamp, PdfTaskRequest } from './pdfTasks'
import { PagesChoice, PdfThumbnailGrid, ProgressBar, SelectionBar, baseNameOf, chosenPageIndexes, describePageNumbers, drawPagePicture, drawTextPicture, parsePageRanges, pdfResultFile, pngBytesOf, problemMessageKey, useOpenedPdfs, zipResultFile } from './PdfToolParts'
import type { GridCard, PagesChoiceValue } from './PdfToolParts'

const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const pageKey = (pageIndex: number) => `page-${pageIndex}`
// One output PDF, or several (zipped), or the chosen pages cropped (only hidden, or rebuilt as pictures of the kept part).
type BuildRequest = { type: 'build-pdf'; pages: OutputPage[] } | { type: 'build-pdfs'; documents: OutputDocument[] } | { type: 'crop-pdf'; box: PageBox; pageIndexes: number[] } | { type: 'picture-pages'; pageCount: number; pictures: PagePicture[] }

// The chosen PDF opened, its pages as cards, and running a task on it with progress and an error line.
function useOnePdf({ files, onResult }: Pick<ToolProps, 'files' | 'onResult'>) {
  const { t } = useT()
  const file = files[0]
  const opened = useOpenedPdfs(files).get(file)
  const pageCount = opened && 'document' in opened ? opened.document.numPages : 0
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<{ file: File; message: string } | null>(null)

  function pageCards(rotationOf: (pageIndex: number) => number = () => 0, isMarked: (pageIndex: number) => boolean = () => false): GridCard[] {
    if (!opened || !('document' in opened)) return []
    return Array.from({ length: pageCount }, (_, pageIndex) => ({ key: pageKey(pageIndex), caption: String(pageIndex + 1), document: opened.document, pageIndex, rotation: rotationOf(pageIndex), isMarked: isMarked(pageIndex) }))
  }

  async function run(request: BuildRequest, resultName: string) {
    setError(null)
    setProgress({ done: 0, total: request.type === 'build-pdfs' ? request.documents.length : 0 })
    const fileBytes = await file.arrayBuffer()
    const fullRequest: PdfTaskRequest = request.type === 'crop-pdf' || request.type === 'picture-pages' ? { ...request, pdf: fileBytes } : { ...request, sources: [fileBytes] }
    const response = await runPdfTask(fullRequest, (done, total) => setProgress({ done, total })).catch(() => null)
    setProgress(null)
    if (response?.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${resultName}.pdf`))
    else if (response?.status === 'ok' && response.zip) onResult(zipResultFile(response.zip, `${resultName}.zip`))
    else setError({ file, message: t(response?.status === 'error' ? problemMessageKey(response.reason) : 'tools.pdf.unreadable') })
  }

  const status: ReactNode = (
    <>
      {!opened && <p className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      {opened && 'problem' in opened && <p id="pdf-problem" role="alert" className="text-center font-medium text-danger">{t(problemMessageKey(opened.problem))}</p>}
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.files', { done: progress.done, total: progress.total }) : t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error?.file === file ? error.message : ''} />
    </>
  )
  return { file, baseName: baseNameOf(file.name), pdfDocument: opened && 'document' in opened ? opened.document : null, pageCount, pageCards, run, isWorking: progress !== null, status }
}

// ---------------------------------------------------------------- Split PDF

type SplitMode = 'ranges' | 'every' | 'each'

export function SplitPdf({ files, onResult }: ToolProps) {
  const { t, tp } = useT()
  const pdf = useOnePdf({ files, onResult })
  const [mode, setMode] = useState<SplitMode>('ranges')
  const [rangesText, setRangesText] = useState('')
  const [pagesPerFile, setPagesPerFile] = useState(1)

  const groups: number[][] | null =
    mode === 'ranges'
      ? parsePageRanges(rangesText, pdf.pageCount)
      : Array.from({ length: Math.ceil(pdf.pageCount / (mode === 'each' ? 1 : Math.max(1, pagesPerFile))) }, (_, groupIndex) => {
          const size = mode === 'each' ? 1 : Math.max(1, pagesPerFile)
          return Array.from({ length: Math.min(size, pdf.pageCount - groupIndex * size) }, (_, offset) => groupIndex * size + offset + 1)
        })
  const isRangesTextWrong = mode === 'ranges' && rangesText.trim() !== '' && groups === null

  function split() {
    if (!groups?.length) return
    const documents: OutputDocument[] = groups.map((pageNumbers) => ({ name: `${pdf.baseName}-pages-${describePageNumbers(pageNumbers)}.pdf`, pages: pageNumbers.map((pageNumber) => ({ sourceIndex: 0, pageIndex: pageNumber - 1, rotation: 0 })) }))
    if (documents.length === 1) void pdf.run({ type: 'build-pdf', pages: documents[0].pages }, documents[0].name.replace(/\.pdf$/, ''))
    else void pdf.run({ type: 'build-pdfs', documents }, `${pdf.baseName}-split`)
  }

  const modes: [SplitMode, MessageKey][] = [['ranges', 'tools.split.byRanges'], ['every', 'tools.split.everyN'], ['each', 'tools.split.eachPage']]
  return (
    <div id="split-pdf-tool" className="space-y-4">
      <fieldset className="mx-auto flex max-w-[640px] flex-wrap justify-center gap-x-5 gap-y-2">
        <legend className="sr-only">{t('tools.split.modeLabel')}</legend>
        {modes.map(([value, labelKey]) => (
          <label key={value} className="flex min-h-11 items-center gap-2 font-medium">
            <input id={`split-mode-${value}-radio`} type="radio" name="split-mode" checked={mode === value} onChange={() => setMode(value)} className="size-5" />
            {t(labelKey)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        {mode === 'ranges' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.split.rangesLabel')}
            <input id="split-ranges-input" type="text" inputMode="numeric" dir="ltr" placeholder="1-3, 5, 8-10" value={rangesText} onChange={(event) => setRangesText(event.target.value)} aria-invalid={isRangesTextWrong} className={`${fieldClass} w-64`} />
          </label>
        )}
        {mode === 'every' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.split.pagesPerFile')}
            <input id="split-every-input" type="number" min={1} max={Math.max(1, pdf.pageCount)} dir="ltr" value={pagesPerFile} onChange={(event) => setPagesPerFile(Number(event.target.value) || 1)} className={`${fieldClass} w-28`} />
          </label>
        )}
        <button id="split-pdf-button" type="button" disabled={!groups?.length || pdf.isWorking || pdf.pageCount === 0} onClick={split} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.split.button')}
        </button>
      </div>
      <p id="split-pdf-summary" aria-live="polite" className={`text-center text-sm ${isRangesTextWrong ? 'font-medium text-danger' : 'text-ink-soft'}`}>
        {isRangesTextWrong ? t('tools.split.rangesWrong', { count: pdf.pageCount }) : groups?.length ? tp('tools.split.willMake', groups.length) : mode === 'ranges' ? t('tools.split.rangesHint') : ''}
      </p>
      {pdf.status}
      <PdfThumbnailGrid id="split-pdf-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards()} />
    </div>
  )
}

// ---------------------------------------------------------------- Remove pages, Extract pages, Rotate PDF (pages chosen by clicking)

function usePageSelection() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const selectedPageNumbers = [...selectedKeys].map((key) => Number(key.replace('page-', '')) + 1).sort((first, second) => first - second)
  return { selectedKeys, setSelectedKeys, selectedPageNumbers }
}

export function RemovePdfPages({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { selectedKeys, setSelectedKeys, selectedPageNumbers } = usePageSelection()
  const isEveryPageChosen = pdf.pageCount > 0 && selectedPageNumbers.length === pdf.pageCount

  function removePages() {
    const keptPages: OutputPage[] = Array.from({ length: pdf.pageCount }, (_, pageIndex) => pageIndex).filter((pageIndex) => !selectedKeys.has(pageKey(pageIndex))).map((pageIndex) => ({ sourceIndex: 0, pageIndex, rotation: 0 }))
    void pdf.run({ type: 'build-pdf', pages: keptPages }, `${pdf.baseName}-without-pages-${describePageNumbers(selectedPageNumbers)}`)
  }

  return (
    <div id="remove-pdf-pages-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.remove.hint')}</p>
      <SelectionBar idPrefix="remove-pages" total={pdf.pageCount} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.pageCards().map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <div className="flex justify-center">
        <button id="remove-pages-button" type="button" disabled={selectedPageNumbers.length === 0 || isEveryPageChosen || pdf.isWorking} onClick={removePages} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.remove.button')}
        </button>
      </div>
      {isEveryPageChosen && <p id="remove-pages-all" role="alert" className="text-center text-sm font-medium text-danger">{t('tools.remove.notAll')}</p>}
      {pdf.status}
      <PdfThumbnailGrid id="remove-pages-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards(undefined, (pageIndex) => selectedKeys.has(pageKey(pageIndex)))} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}

export function ExtractPdfPages({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { selectedKeys, setSelectedKeys, selectedPageNumbers } = usePageSelection()
  const [isOnePdfPerPage, setIsOnePdfPerPage] = useState(false)

  function extractPages() {
    const pageOf = (pageNumber: number): OutputPage => ({ sourceIndex: 0, pageIndex: pageNumber - 1, rotation: 0 })
    if (isOnePdfPerPage && selectedPageNumbers.length > 1) {
      void pdf.run({ type: 'build-pdfs', documents: selectedPageNumbers.map((pageNumber) => ({ name: `${pdf.baseName}-page-${pageNumber}.pdf`, pages: [pageOf(pageNumber)] })) }, `${pdf.baseName}-pages`)
    } else void pdf.run({ type: 'build-pdf', pages: selectedPageNumbers.map(pageOf) }, `${pdf.baseName}-pages-${describePageNumbers(selectedPageNumbers)}`)
  }

  return (
    <div id="extract-pdf-pages-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.extract.hint')}</p>
      <SelectionBar idPrefix="extract-pages" total={pdf.pageCount} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.pageCards().map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="extract-one-per-page-checkbox" type="checkbox" checked={isOnePdfPerPage} onChange={(event) => setIsOnePdfPerPage(event.target.checked)} className="size-5" />
          {t('tools.extract.onePerPage')}
        </label>
        <button id="extract-pages-button" type="button" disabled={selectedPageNumbers.length === 0 || pdf.isWorking} onClick={extractPages} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.extract.button')}
        </button>
      </div>
      {pdf.status}
      <PdfThumbnailGrid id="extract-pages-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards()} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}

export function RotatePdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { selectedKeys, setSelectedKeys, selectedPageNumbers } = usePageSelection()
  const [rotationByPage, setRotationByPage] = useState(new Map<number, number>())
  const rotationOf = (pageIndex: number) => rotationByPage.get(pageIndex) ?? 0
  const hasTurnedPage = [...rotationByPage.values()].some((rotation) => rotation % 360 !== 0)

  // With no page selected, every page turns.
  function turnPages(degrees: number) {
    const pageIndexes = selectedPageNumbers.length ? selectedPageNumbers.map((pageNumber) => pageNumber - 1) : Array.from({ length: pdf.pageCount }, (_, pageIndex) => pageIndex)
    setRotationByPage((previous) => {
      const next = new Map(previous)
      for (const pageIndex of pageIndexes) next.set(pageIndex, (((next.get(pageIndex) ?? 0) + degrees) % 360 + 360) % 360)
      return next
    })
  }

  function savePdf() {
    const pages: OutputPage[] = Array.from({ length: pdf.pageCount }, (_, pageIndex) => ({ sourceIndex: 0, pageIndex, rotation: rotationOf(pageIndex) }))
    void pdf.run({ type: 'build-pdf', pages }, `${pdf.baseName}-rotated`)
  }

  return (
    <div id="rotate-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.rotate.hint')}</p>
      <SelectionBar idPrefix="rotate-pages" total={pdf.pageCount} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.pageCards().map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="rotate-left-button" type="button" disabled={pdf.pageCount === 0} onClick={() => turnPages(-90)} className="btn btn--quiet press">
          {t('tools.rotate.left')}
        </button>
        <button id="rotate-right-button" type="button" disabled={pdf.pageCount === 0} onClick={() => turnPages(90)} className="btn btn--quiet press">
          {t('tools.rotate.right')}
        </button>
        <button id="rotate-half-button" type="button" disabled={pdf.pageCount === 0} onClick={() => turnPages(180)} className="btn btn--quiet press">
          {t('tools.rotate.half')}
        </button>
        <button id="rotate-pdf-button" type="button" disabled={!hasTurnedPage || pdf.isWorking} onClick={savePdf} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.rotate.button')}
        </button>
      </div>
      <p id="rotate-pdf-scope" aria-live="polite" className="text-center text-sm text-ink-soft">
        {selectedPageNumbers.length ? t('tools.rotate.selectedPages', { pages: describePageNumbers(selectedPageNumbers) }) : t('tools.rotate.allPages')}
      </p>
      {pdf.status}
      <PdfThumbnailGrid id="rotate-pages-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards(rotationOf)} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}

// ---------------------------------------------------------------- Crop PDF

const POINTS_TO_MILLIMETRES = 25.4 / 72
const SMALLEST_CROP_SHARE = 0.05
const STARTING_CROP_BOX: PageBox = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }

// The box moved or resized by a share of the page, kept inside it (drag and arrow keys).
function changedCropBox(start: PageBox, mode: 'move' | 'resize', deltaX: number, deltaY: number): PageBox {
  if (mode === 'move') return { ...start, x: Math.min(Math.max(start.x + deltaX, 0), 1 - start.width), y: Math.min(Math.max(start.y + deltaY, 0), 1 - start.height) }
  return { ...start, width: Math.min(Math.max(start.width + deltaX, SMALLEST_CROP_SHARE), 1 - start.x), height: Math.min(Math.max(start.height + deltaY, SMALLEST_CROP_SHARE), 1 - start.y) }
}

export function CropPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { pdfDocument } = pdf
  const [shownPageIndex, setShownPageIndex] = useState(0)
  const [shownPageSize, setShownPageSize] = useState<{ width: number; height: number } | null>(null)
  // A share (0 to 1) of the page as shown; the same share is cut from every chosen page.
  const [box, setBox] = useState<PageBox>(STARTING_CROP_BOX)
  const [pagesChoice, setPagesChoice] = useState<PagesChoiceValue>({ isAllPages: true, ranges: '' })
  const [isOutsideRemoved, setIsOutsideRemoved] = useState(true)
  const [isDrawingPages, setIsDrawingPages] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startBox: PageBox } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!pdfDocument || !canvas) return
    let isCurrent = true
    void pdfDocument.getPage(shownPageIndex + 1).then(async (page) => {
      const unscaled = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: (640 * Math.min(2, window.devicePixelRatio || 1)) / Math.max(unscaled.width, unscaled.height) })
      const drawing = document.createElement('canvas')
      drawing.width = Math.floor(viewport.width)
      drawing.height = Math.floor(viewport.height)
      await page.render({ canvas: drawing, viewport, background: '#ffffff' }).promise
      if (!isCurrent) return
      canvas.width = drawing.width
      canvas.height = drawing.height
      canvas.getContext('2d')!.drawImage(drawing, 0, 0)
      setShownPageSize({ width: unscaled.width, height: unscaled.height })
    })
    return () => {
      isCurrent = false
    }
  }, [pdfDocument, shownPageIndex])
  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    element.style.left = `${box.x * 100}%`
    element.style.top = `${box.y * 100}%`
    element.style.width = `${box.width * 100}%`
    element.style.height = `${box.height * 100}%`
  }, [box, shownPageSize])

  function startDrag(event: ReactPointerEvent, mode: 'move' | 'resize') {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, startBox: box }
  }
  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    const frame = frameRef.current
    if (!drag || !frame) return
    setBox(changedCropBox(drag.startBox, drag.mode, (event.clientX - drag.startX) / frame.clientWidth, (event.clientY - drag.startY) / frame.clientHeight))
  }
  // Arrow keys move the box by 1% of the page; with Shift they resize it.
  function moveWithKeys(event: ReactKeyboardEvent) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }
    if (!steps[event.key]) return
    event.preventDefault()
    setBox(changedCropBox(box, event.shiftKey ? 'resize' : 'move', steps[event.key][0], steps[event.key][1]))
  }

  const pageIndexes = chosenPageIndexes(pagesChoice, pdf.pageCount)
  const isWorking = pdf.isWorking || isDrawingPages

  // With what is outside removed, each chosen page becomes a picture of the kept part with its text laid over it, so nothing outside
  // the box stays in the file; otherwise only the visible area changes and the page stays as it is.
  async function crop() {
    if (!pageIndexes?.length || !pdfDocument) return
    if (!isOutsideRemoved) {
      void pdf.run({ type: 'crop-pdf', box, pageIndexes }, `${pdf.baseName}-cropped`)
      return
    }
    setIsDrawingPages(true)
    const pictures: PagePicture[] = []
    for (const pageIndex of pageIndexes) {
      const shown = (await pdfDocument.getPage(pageIndex + 1)).getViewport({ scale: 1 })
      pictures.push(await drawPagePicture(pdfDocument, pageIndex, { keptBox: { x: box.x * shown.width, y: box.y * shown.height, width: box.width * shown.width, height: box.height * shown.height } }))
    }
    setIsDrawingPages(false)
    void pdf.run({ type: 'picture-pages', pageCount: pdf.pageCount, pictures }, `${pdf.baseName}-cropped`)
  }


  const sizeInMillimetres = shownPageSize ? `${Math.round(box.width * shownPageSize.width * POINTS_TO_MILLIMETRES)} × ${Math.round(box.height * shownPageSize.height * POINTS_TO_MILLIMETRES)} mm` : ''
  return (
    <div id="crop-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.crop.hint')}</p>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.crop.shownPage')}
          <select id="crop-shown-page-select" value={shownPageIndex} disabled={pdf.pageCount === 0} onChange={(event) => setShownPageIndex(Number(event.target.value))} className={fieldClass}>
            {Array.from({ length: pdf.pageCount }, (_, pageIndex) => (
              <option key={pageIndex} value={pageIndex}>
                {pageIndex + 1}
              </option>
            ))}
          </select>
        </label>
        <button id="crop-reset-button" type="button" disabled={pdf.pageCount === 0} onClick={() => setBox(STARTING_CROP_BOX)} className="btn btn--quiet press">
          {t('tools.crop.reset')}
        </button>
      </div>
      <div className="flex flex-col items-center gap-2">
        {/* The page itself stays left to right on an Arabic page. */}
        <div ref={frameRef} dir="ltr" className={`crop-frame${shownPageSize ? '' : ' invisible'}`} onPointerMove={moveDrag} onPointerUp={() => (dragRef.current = null)}>
          <canvas ref={canvasRef} id="crop-pdf-page" width={453} height={640} role="img" aria-label={t('tools.crop.pageLabel', { page: shownPageIndex + 1 })} className="crop-picture" />
          <div ref={boxRef} id="crop-pdf-box" className="crop-box" role="group" tabIndex={0} aria-label={t('tools.crop.box', { size: sizeInMillimetres })} aria-describedby="crop-pdf-keyboard-hint" onKeyDown={moveWithKeys} onPointerDown={(event) => startDrag(event, 'move')}>
            <span className="crop-handle" onPointerDown={(event) => startDrag(event, 'resize')} aria-hidden="true" />
          </div>
        </div>
        <p id="crop-pdf-size" className="text-sm text-ink-soft" dir="ltr">
          {sizeInMillimetres}
        </p>
        <p id="crop-pdf-keyboard-hint" className="sr-only">
          {t('tools.crop.keyboardHint')}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <PagesChoice idPrefix="crop-pdf" pageCount={pdf.pageCount} value={pagesChoice} onChange={setPagesChoice} />
        <button id="crop-pdf-button" type="button" disabled={!pageIndexes?.length || isWorking} onClick={() => void crop()} className="btn btn--primary press">
          {isWorking ? t('tools.working') : t('tools.crop.button')}
        </button>
      </div>
      <label className="mx-auto flex min-h-11 max-w-[640px] items-start justify-center gap-2 text-start text-sm">
        <input id="crop-remove-outside-checkbox" type="checkbox" checked={isOutsideRemoved} onChange={(event) => setIsOutsideRemoved(event.target.checked)} className="mt-0.5 size-5 shrink-0" />
        <span>
          <span className="font-medium">{t('tools.crop.removeOutside')}</span> <span className="text-ink-soft">{isOutsideRemoved ? t('tools.crop.removeOutsideOn') : t('tools.crop.removeOutsideOff')}</span>
        </span>
      </label>
      {pdf.status}
    </div>
  )
}

// ---------------------------------------------------------------- Repair PDF

// First pdf-lib reads the file leniently and writes it again (a new cross-reference table), and the copy must then open in pdf.js
// with every page readable. If that fails, pdf.js (which reads more broken files) draws every page and the copy is made of those
// pictures; its name says so.
export function RepairPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<{ file: File; key: MessageKey } | null>(null)
  const baseName = baseNameOf(file.name)

  async function opensWithEveryPage(bytes: Uint8Array) {
    const document = await openPdfForReading(bytes.slice().buffer).catch(() => null)
    if (!document) return false
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) await (await document.getPage(pageNumber)).getOperatorList()
      return document.numPages > 0
    } catch {
      return false
    } finally {
      void document.loadingTask.destroy()
    }
  }

  async function repair() {
    setError(null)
    setProgress({ done: 0, total: 0 })
    const fileBytes = await file.arrayBuffer()
    const rebuilt = await runPdfTask({ type: 'repair-pdf', pdf: fileBytes.slice(0) }).catch(() => null)
    if (rebuilt?.status === 'error' && rebuilt.reason === 'encrypted') {
      setError({ file, key: 'tools.pdf.encrypted' })
      setProgress(null)
      return
    }
    if (rebuilt?.status === 'ok' && rebuilt.pdf && (await opensWithEveryPage(rebuilt.pdf))) {
      setProgress(null)
      onResult(pdfResultFile(rebuilt.pdf, `${baseName}-repaired.pdf`))
      return
    }
    try {
      const document = await openPdfForReading(fileBytes)
      const pictures = []
      for (let pageIndex = 0; pageIndex < document.numPages; pageIndex++) {
        setProgress({ done: pageIndex, total: document.numPages })
        pictures.push(await drawPagePicture(document, pageIndex).catch(() => null))
      }
      const pageCount = document.numPages
      void document.loadingTask.destroy()
      const readablePictures = pictures.filter((picture) => picture !== null)
      if (readablePictures.length === 0) throw new Error('No page could be drawn')
      const response = await runPdfTask({ type: 'picture-pages', pdf: null, pageCount: readablePictures.length, pictures: readablePictures.map((picture, pageIndex) => ({ ...picture, pageIndex })) })
      if (response.status !== 'ok' || !response.pdf) throw new Error('The copy could not be made')
      onResult(pdfResultFile(response.pdf, `${baseName}-repaired-as-pictures${readablePictures.length < pageCount ? '-some-pages-lost' : ''}.pdf`))
    } catch (problem) {
      setError({ file, key: problem instanceof PdfPasswordError ? 'tools.pdf.encrypted' : 'tools.repair.failed' })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div id="repair-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.repair.hint')}</p>
      <p className="text-center font-medium">
        <bdi>{file.name}</bdi>
      </p>
      <div className="flex justify-center">
        <button id="repair-pdf-button" type="button" disabled={progress !== null} onClick={() => void repair()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.repair.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.pages', { done: progress.done, total: progress.total }) : t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error?.file === file ? t(error.key) : ''} />
    </div>
  )
}

// ---------------------------------------------------------------- Protect PDF and Unlock PDF (qpdf in pdfTools.worker.ts)

const SHORTEST_PASSWORD = 4

// One qpdf task on the chosen file (Protect, Unlock, Flatten PDF, Remove PDF metadata): working state, the result offered, the error
// line; `request` is given the file's bytes.
function useOneFileTask({ files, onResult }: Pick<ToolProps, 'files' | 'onResult'>, resultSuffix: string) {
  const file = files[0]
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<{ file: File; key: MessageKey } | null>(null)
  async function run(request: (fileBytes: ArrayBuffer) => PdfTaskRequest) {
    setError(null)
    setIsWorking(true)
    const response = await runPdfTask(request(await file.arrayBuffer())).catch(() => null)
    setIsWorking(false)
    if (response?.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${baseNameOf(file.name)}-${resultSuffix}.pdf`))
    else setError({ file, key: response?.status === 'error' ? problemMessageKey(response.reason) : 'tools.pdf.unreadable' })
  }
  return { file, isWorking, run, errorKey: error?.file === file ? error.key : null }
}

const passwordFieldClass = `${fieldClass} w-64`

export function ProtectPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOneFileTask({ files, onResult }, 'protected')
  const [password, setPassword] = useState('')
  const [repeatedPassword, setRepeatedPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [isShown, setIsShown] = useState(false)
  const [allowed, setAllowed] = useState({ canPrint: true, canCopy: true, canEdit: true })
  const passwordProblem: MessageKey | null = password.length > 0 && password.length < SHORTEST_PASSWORD ? 'tools.protect.tooShort' : repeatedPassword && repeatedPassword !== password ? 'tools.protect.mismatch' : null
  const isReady = password.length >= SHORTEST_PASSWORD && repeatedPassword === password
  const permissionLabels: [keyof typeof allowed, MessageKey][] = [['canPrint', 'tools.protect.allowPrint'], ['canCopy', 'tools.protect.allowCopy'], ['canEdit', 'tools.protect.allowEdit']]
  return (
    <div id="protect-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.protect.hint')}</p>
      <p className="text-center font-medium">
        <bdi>{task.file.name}</bdi>
      </p>
      <form
        id="protect-pdf-form"
        className="mx-auto flex max-w-[640px] flex-col items-center gap-3 text-start"
        onSubmit={(event) => {
          event.preventDefault()
          if (isReady) void task.run((pdf) => ({ type: 'protect-pdf', pdf, userPassword: password, ownerPassword, ...allowed }))
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.protect.password')}
          <input id="protect-password-input" type={isShown ? 'text' : 'password'} autoComplete="new-password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={passwordProblem === 'tools.protect.tooShort'} className={passwordFieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.protect.repeat')}
          <input id="protect-repeat-input" type={isShown ? 'text' : 'password'} autoComplete="new-password" dir="ltr" value={repeatedPassword} onChange={(event) => setRepeatedPassword(event.target.value)} aria-invalid={passwordProblem === 'tools.protect.mismatch'} className={passwordFieldClass} />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="protect-show-checkbox" type="checkbox" checked={isShown} onChange={(event) => setIsShown(event.target.checked)} className="size-5" />
          {t('tools.protect.show')}
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">{t('tools.protect.permissions')}</legend>
          {permissionLabels.map(([key, labelKey]) => (
            <label key={key} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
              <input id={`protect-${key.replace('can', '').toLowerCase()}-checkbox`} type="checkbox" checked={allowed[key]} onChange={(event) => setAllowed({ ...allowed, [key]: event.target.checked })} className="size-5" />
              {t(labelKey)}
            </label>
          ))}
        </fieldset>
        {!(allowed.canPrint && allowed.canCopy && allowed.canEdit) && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.protect.ownerPassword')}
            <input id="protect-owner-password-input" type={isShown ? 'text' : 'password'} autoComplete="new-password" dir="ltr" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} className={passwordFieldClass} />
            <span className="max-w-64 text-ink-soft">{t('tools.protect.ownerHint')}</span>
          </label>
        )}
        <button id="protect-pdf-button" type="submit" disabled={!isReady || task.isWorking} className="btn btn--primary press">
          {task.isWorking ? t('tools.working') : t('tools.protect.button')}
        </button>
      </form>
      <p id="protect-password-problem" aria-live="polite" className="text-center text-sm font-medium text-danger">
        {passwordProblem ? t(passwordProblem) : ''}
      </p>
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={task.errorKey ? t(task.errorKey) : ''} />
    </div>
  )
}

export function UnlockPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOneFileTask({ files, onResult }, 'unlocked')
  const [password, setPassword] = useState('')
  const [isShown, setIsShown] = useState(false)
  return (
    <div id="unlock-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.unlock.hint')}</p>
      <p className="text-center font-medium">
        <bdi>{task.file.name}</bdi>
      </p>
      <form
        id="unlock-pdf-form"
        className="mx-auto flex max-w-[640px] flex-col items-center gap-3 text-start"
        onSubmit={(event) => {
          event.preventDefault()
          void task.run((pdf) => ({ type: 'unlock-pdf', pdf, password }))
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.unlock.password')}
          <input id="unlock-password-input" type={isShown ? 'text' : 'password'} autoComplete="off" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="unlock-password-hint" className={passwordFieldClass} />
          <span id="unlock-password-hint" className="max-w-64 text-ink-soft">{t('tools.unlock.passwordHint')}</span>
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="unlock-show-checkbox" type="checkbox" checked={isShown} onChange={(event) => setIsShown(event.target.checked)} className="size-5" />
          {t('tools.protect.show')}
        </label>
        <button id="unlock-pdf-button" type="submit" disabled={task.isWorking} className="btn btn--primary press">
          {task.isWorking ? t('tools.working') : t('tools.unlock.button')}
        </button>
      </form>
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={task.errorKey ? t(task.errorKey) : ''} />
    </div>
  )
}

// ---------------------------------------------------------------- Compress PDF, Flatten PDF and Remove PDF metadata (qpdf in pdfTools.worker.ts)

const panelClass = 'space-y-3 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start'
const shownSize = (byteCount: number) => isolateLeftToRight(formatFileSize(byteCount))

type CompressionLevel = 'high' | 'balanced' | 'smallest'
// Measured on 2026-11-23: a 2.1 MB PDF of two photos became 1.46 MB, 691 KB and 445 KB; a PDF that is only text barely changes.
const JPEG_QUALITY_BY_LEVEL: Record<CompressionLevel, number> = { high: 85, balanced: 70, smallest: 50 }
// A copy less than a tenth smaller is offered with a note that the PDF was compact already.

// The new size is shown before the copy is offered, so a PDF that hardly shrinks (or grows) is never handed over as a smaller one.
export function CompressPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const [level, setLevel] = useState<CompressionLevel>('balanced')
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<{ file: File; key: MessageKey } | null>(null)
  // A copy that came out no smaller is not offered; the page says so instead.
  const [notSmallerFor, setNotSmallerFor] = useState<{ file: File; level: CompressionLevel } | null>(null)
  const isNotSmaller = notSmallerFor?.file === file && notSmallerFor.level === level

  async function compress() {
    setError(null)
    setIsWorking(true)
    const response = await runPdfTask({ type: 'compress-pdf', pdf: await file.arrayBuffer(), jpegQuality: JPEG_QUALITY_BY_LEVEL[level] }).catch(() => null)
    setIsWorking(false)
    if (response?.status !== 'ok' || !response.pdf) setError({ file, key: response?.status === 'error' ? problemMessageKey(response.reason) : 'tools.pdf.unreadable' })
    else if (response.pdf.length >= file.size) setNotSmallerFor({ file, level })
    else onResult(pdfResultFile(response.pdf, `${baseNameOf(file.name)}-compressed.pdf`))
  }

  const levelLabels: [CompressionLevel, MessageKey][] = [['high', 'tools.compressPdf.levelHigh'], ['balanced', 'tools.compressPdf.levelBalanced'], ['smallest', 'tools.compressPdf.levelSmallest']]
  return (
    <div id="compress-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.compressPdf.hint')}</p>
      <p className="text-center font-medium">
        <bdi>{file.name}</bdi> <span id="compress-pdf-original-size" className="text-sm font-normal text-ink-soft">· {shownSize(file.size)}</span>
      </p>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.compressPdf.level')}
          <select id="compress-pdf-level-select" value={level} disabled={isWorking} onChange={(event) => setLevel(event.target.value as CompressionLevel)} className={fieldClass}>
            {levelLabels.map(([value, labelKey]) => (
              <option key={value} value={value}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </label>
        <button id="compress-pdf-button" type="button" disabled={isWorking || isNotSmaller} onClick={() => void compress()} className="btn btn--primary press">
          {isWorking ? t('tools.working') : t('tools.compressPdf.button')}
        </button>
      </div>
      <Notice id="compress-pdf-note" kind="info" role="status" className="text-center text-sm text-ink-soft" message={isNotSmaller ? t('tools.compressPdf.notSmaller') : ''} />
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error?.file === file ? t(error.key) : ''} />
    </div>
  )
}

// A form field as pdf.js reads it from a page.
type FormWidget = { subtype: string; fieldType?: string; fieldName?: string; fieldValue?: unknown; multiLine?: boolean; rect: number[]; options?: { exportValue: string; displayValue: string }[] }
const hasLettersOutsideLatin1 = (text: string) => [...text].some((character) => character.codePointAt(0)! > 0xff)

// The text and choice values qpdf can't draw (letters outside Latin-1, which it turns into "?", and multi-line values, which it writes
// on one huge line), drawn by the browser in their boxes as Fill PDF does, with the names of their fields.
async function browserDrawnFieldValues(pdfDocument: PDFDocumentProxy) {
  const images: ArrayBuffer[] = []
  const stamps: PageStamp[] = []
  const drawnFieldNames = new Set<string>()
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    for (const widget of (await page.getAnnotations()) as FormWidget[]) {
      if (widget.subtype !== 'Widget' || !widget.fieldName || (widget.fieldType !== 'Tx' && widget.fieldType !== 'Ch')) continue
      const chosenValues = Array.isArray(widget.fieldValue) ? widget.fieldValue : [widget.fieldValue]
      const text = widget.fieldType === 'Tx' ? String(widget.fieldValue ?? '') : chosenValues.map((value) => widget.options?.find((option) => option.exportValue === value)?.displayValue ?? String(value ?? '')).filter(Boolean).join(', ')
      if (!hasLettersOutsideLatin1(text) && !(widget.fieldType === 'Tx' && widget.multiLine)) continue
      drawnFieldNames.add(widget.fieldName)
      if (!text.trim()) continue
      const [left, top] = viewport.convertToViewportPoint(widget.rect[0], widget.rect[1])
      const [right, bottom] = viewport.convertToViewportPoint(widget.rect[2], widget.rect[3])
      const box = { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) }
      const picture = await drawTextPicture(text, { sizePoints: Math.min(11, box.height * 0.7), color: '#111111', fontWeight: 500 })
      // The value fits its box: smaller when it is too wide, at the start of the box (the right for Arabic), centred up and down.
      const fit = Math.min(1, (box.width - 4) / picture.width)
      const width = picture.width * fit
      const height = picture.height * fit
      images.push(await pngBytesOf(picture.canvas))
      stamps.push({ pageIndex: pageNumber - 1, imageIndex: images.length - 1, box: { x: /[؀-ۿ]/.test(text) ? box.x + box.width - width - 2 : box.x + 2, y: box.y + (box.height - height) / 2, width, height } })
    }
  }
  return { images, stamps, drawnFieldNames: [...drawnFieldNames] }
}

// qpdf flattens what each field shows. It redraws the fields only when the file asks for that; the values its drawing would spoil are
// then drawn by the browser instead (the worker ignores them otherwise).
export function FlattenPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const task = useOneFileTask({ files, onResult }, 'flattened')
  const [isDrawing, setIsDrawing] = useState(false)

  async function flatten() {
    setIsDrawing(true)
    const pdfDocument = await openPdfForReading(await task.file.arrayBuffer()).catch(() => null)
    const drawnValues = pdfDocument ? await browserDrawnFieldValues(pdfDocument).catch(() => null) : null
    void pdfDocument?.loadingTask.destroy()
    setIsDrawing(false)
    // A locked or unreadable file still goes to the worker, which says which it is.
    void task.run((pdf) => ({ type: 'flatten-pdf', pdf, ...(drawnValues ?? { images: [], stamps: [], drawnFieldNames: [] }) }))
  }

  const isWorking = task.isWorking || isDrawing
  return (
    <div id="flatten-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.flattenPdf.hint')}</p>
      <p className="text-center font-medium">
        <bdi>{task.file.name}</bdi>
      </p>
      <div className="flex justify-center">
        <button id="flatten-pdf-button" type="button" disabled={isWorking} onClick={() => void flatten()} className="btn btn--primary press">
          {isWorking ? t('tools.working') : t('tools.flattenPdf.button')}
        </button>
      </div>
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={task.errorKey ? t(task.errorKey) : ''} />
    </div>
  )
}

type PdfProperty = 'Title' | 'Author' | 'Subject' | 'Keywords' | 'Creator' | 'Producer' | 'CreationDate' | 'ModDate'
const PDF_PROPERTY_LABELS: [PdfProperty, MessageKey][] = [
  ['Title', 'office.metadata.title'],
  ['Author', 'office.metadata.author'],
  ['Subject', 'office.metadata.subject'],
  ['Keywords', 'office.metadata.keywords'],
  ['Creator', 'tools.pdfMetadata.creator'],
  ['Producer', 'tools.pdfMetadata.producer'],
  ['CreationDate', 'office.metadata.created'],
  ['ModDate', 'office.metadata.modified'],
]
type ShownPdfProperties = { rows: [MessageKey, string][]; hasXmp: boolean; customCount: number }

// The document's properties shown (as the PDF's information dictionary holds them), then removed with its XMP metadata in a copy.
export function RemovePdfMetadata({ files, onResult }: ToolProps) {
  const { t, locale } = useT()
  const task = useOneFileTask({ files, onResult }, 'no-metadata')
  const file = task.file
  const [shown, setShown] = useState<{ file: File; properties: ShownPdfProperties } | { file: File; problem: MessageKey } | null>(null)

  useEffect(() => {
    let isCurrent = true
    const dateFormat = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    void (async () => {
      try {
        const [pdfjs, document] = await Promise.all([loadPdfCore(), openPdfForReading(await file.arrayBuffer())])
        const { info, metadata } = await document.getMetadata()
        void document.loadingTask.destroy()
        const values = info as Partial<Record<PdfProperty, unknown>> & { Custom?: object }
        const rows: [MessageKey, string][] = []
        for (const [property, labelKey] of PDF_PROPERTY_LABELS) {
          const value = typeof values[property] === 'string' ? values[property].trim() : ''
          if (!value) continue
          const date = property.endsWith('Date') ? pdfjs.PDFDateString.toDateObject(value) : null
          rows.push([labelKey, date ? dateFormat.format(date) : value])
        }
        if (isCurrent) setShown({ file, properties: { rows, hasXmp: metadata !== null, customCount: Object.keys(values.Custom ?? {}).length } })
      } catch (problem) {
        if (isCurrent) setShown({ file, problem: problem instanceof PdfPasswordError ? 'tools.pdf.encrypted' : 'tools.pdf.unreadable' })
      }
    })()
    return () => {
      isCurrent = false
    }
  }, [file, locale])

  const properties = shown?.file === file && 'properties' in shown ? shown.properties : null
  const readProblem = shown?.file === file && 'problem' in shown ? shown.problem : null
  const isEmpty = properties !== null && properties.rows.length === 0 && !properties.hasXmp && properties.customCount === 0
  return (
    <div id="remove-pdf-metadata-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('office.metadata.hint')}</p>
      <p className="text-center font-medium">
        <bdi>{file.name}</bdi>
      </p>
      {!shown && <p className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      {properties && (
        <div id="remove-pdf-metadata-properties" className={panelClass}>
          {isEmpty ? (
            <p id="remove-pdf-metadata-none">{t('office.metadata.none')}</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {properties.rows.map(([labelKey, value]) => (
                <div key={labelKey} className="contents">
                  <dt className="font-medium">{t(labelKey)}</dt>
                  <dd dir="auto" className="break-words text-ink-soft">
                    {value}
                  </dd>
                </div>
              ))}
              {properties.customCount > 0 && (
                <>
                  <dt className="font-medium">{t('office.metadata.custom')}</dt>
                  <dd className="text-ink-soft">{properties.customCount}</dd>
                </>
              )}
              {properties.hasXmp && (
                <>
                  <dt className="font-medium">{t('tools.pdfMetadata.xmp')}</dt>
                  <dd className="text-ink-soft">{t('tools.pdfMetadata.stored')}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}
      <div className="flex justify-center">
        <button id="remove-pdf-metadata-button" type="button" disabled={task.isWorking || properties === null} onClick={() => void task.run((pdf) => ({ type: 'remove-pdf-metadata', pdf }))} className="btn btn--primary press">
          {task.isWorking ? t('tools.working') : t('office.metadata.button')}
        </button>
      </div>
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={readProblem ? t(readProblem) : task.errorKey ? t(task.errorKey) : ''} />
    </div>
  )
}
