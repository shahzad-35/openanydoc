// The one-PDF page tools: Split PDF, Remove pages, Extract pages, Rotate PDF, Crop PDF, Repair PDF, Protect PDF and Unlock PDF. Each shows the PDF's pages
// as thumbnails (Crop shows one page large); the work runs in pdfTools.worker.ts.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { PdfPasswordError, openPdfForReading } from '../../formats/pdf/pdfLibrary'
import { runPdfTask } from './pdfTasks'
import type { OutputDocument, OutputPage, PageBox, PagePicture, PdfTaskRequest } from './pdfTasks'
import { PagesChoice, PdfThumbnailGrid, ProgressBar, SelectionBar, baseNameOf, chosenPageIndexes, describePageNumbers, drawPagePicture, parsePageRanges, pdfResultFile, problemMessageKey, useOpenedPdfs, zipResultFile } from './PdfToolParts'
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

// The chosen file's name, the button and the error line those two tools share; `request` is given the file's bytes.
function usePasswordTask({ files, onResult }: Pick<ToolProps, 'files' | 'onResult'>, resultSuffix: string) {
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
  const task = usePasswordTask({ files, onResult }, 'protected')
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
  const task = usePasswordTask({ files, onResult }, 'unlocked')
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
