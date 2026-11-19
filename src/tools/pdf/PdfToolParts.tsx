// What the PDF tools share: opening the chosen PDFs with pdf.js (for thumbnails and pictures), the thumbnail grid (select, drag to
// reorder, per-page buttons), the progress bar, the list of chosen PDFs, and the file names of the results.
/* oxlint-disable react/only-export-components */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { isolateLeftToRight, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { PdfPasswordError, openPdfForReading } from '../../formats/pdf/pdfLibrary'
import type { LayerWord, PageBox, PagePicture, PdfTaskProblem } from './pdfTasks'

const THUMBNAIL_WIDTH = 132
const DRAG_THRESHOLD_PX = 6

// ---------------------------------------------------------------- opening PDFs

export type OpenedPdf = { document: PDFDocumentProxy } | { problem: 'encrypted' | 'unreadable' }

// Each chosen PDF opened once with pdf.js, in the order chosen; a document is freed when its file leaves the list.
export function useOpenedPdfs(files: File[]) {
  const [openedByFile, setOpenedByFile] = useState(new Map<File, OpenedPdf>())
  const openedRef = useRef(openedByFile)

  useEffect(() => {
    openedRef.current = openedByFile
  }, [openedByFile])
  useEffect(() => {
    let isCurrent = true
    for (const file of files) {
      if (openedRef.current.has(file)) continue
      void file
        .arrayBuffer()
        .then(openPdfForReading)
        .then(
          (document): OpenedPdf => ({ document }),
          (error): OpenedPdf => ({ problem: error instanceof PdfPasswordError ? 'encrypted' : 'unreadable' }),
        )
        .then((opened) => {
          if (isCurrent) setOpenedByFile((previous) => new Map(previous).set(file, opened))
          else if ('document' in opened) void opened.document.loadingTask.destroy()
        })
    }
    return () => {
      isCurrent = false
    }
  }, [files])

  // Documents of files no longer chosen are freed; all of them when the tool closes.
  useEffect(() => {
    for (const [file, opened] of openedByFile) {
      if (files.includes(file)) continue
      if ('document' in opened) void opened.document.loadingTask.destroy()
      setOpenedByFile((previous) => {
        const next = new Map(previous)
        next.delete(file)
        return next
      })
    }
  }, [files, openedByFile])
  useEffect(
    () => () => {
      for (const opened of openedRef.current.values()) if ('document' in opened) void opened.document.loadingTask.destroy()
    },
    [],
  )
  return openedByFile
}

const PROBLEM_MESSAGES: Record<PdfTaskProblem, MessageKey> = { encrypted: 'tools.pdf.encrypted', unreadable: 'tools.pdf.unreadable', 'wrong-password': 'tools.unlock.wrongPassword', 'not-encrypted': 'tools.unlock.notEncrypted' }
export const problemMessageKey = (problem: PdfTaskProblem): MessageKey => PROBLEM_MESSAGES[problem]

// ---------------------------------------------------------------- the thumbnail grid

// A card of the grid: a page of an opened PDF (drawn by pdf.js), a picture (an image address), or a blank page.
export type GridCard = { key: string; caption: string; rotation?: number; isMarked?: boolean } & ({ document: PDFDocumentProxy; pageIndex: number } | { imageUrl: string } | { isBlank: true } | { problem: string })

type PdfThumbnailGridProps = {
  id: string
  label: string
  cards: GridCard[]
  // Selection: cards are buttons that toggle; Shift selects the range from the last one.
  selectedKeys?: ReadonlySet<string>
  onSelectionChange?: (selectedKeys: Set<string>) => void
  // Reordering: dragged with a mouse, or moved with Alt+arrow keys (and the move buttons the tool adds).
  onReorder?: (fromIndex: number, toIndex: number) => void
  renderActions?: (card: GridCard, index: number) => ReactNode
}

export function PdfThumbnailGrid({ id, label, cards, selectedKeys, onSelectionChange, onReorder, renderActions }: PdfThumbnailGridProps) {
  const { locale, t } = useT()
  const listRef = useRef<HTMLOListElement>(null)
  const [drag, setDrag] = useState<{ fromIndex: number; overIndex: number } | null>(null)
  const pressRef = useRef<{ index: number; x: number; y: number; isDragging: boolean } | null>(null)
  const lastSelectedIndexRef = useRef<number | null>(null)
  const ignoreClickRef = useRef(false)

  // Pages are drawn as they come into view, once per card: a reordered card keeps its picture.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const canvas = entry.target as HTMLCanvasElement
          observer.unobserve(canvas)
          const card = cards.find((candidate) => candidate.key === canvas.dataset.cardKey)
          if (!card || !('document' in card)) continue
          void card.document
            .getPage(card.pageIndex + 1)
            .then((page) => {
              const unscaled = page.getViewport({ scale: 1 })
              const viewport = page.getViewport({ scale: (THUMBNAIL_WIDTH * Math.min(2, window.devicePixelRatio || 1)) / Math.max(unscaled.width, unscaled.height) })
              canvas.width = Math.floor(viewport.width)
              canvas.height = Math.floor(viewport.height)
              return page.render({ canvas, viewport }).promise
            })
            .then(() => (canvas.dataset.drawn = 'true'))
            .catch(() => undefined)
        }
      },
      { rootMargin: '300px 0px' },
    )
    list.querySelectorAll<HTMLCanvasElement>('canvas[data-card-key]:not([data-drawn])').forEach((canvas) => observer.observe(canvas))
    return () => observer.disconnect()
  }, [cards])

  function toggleCard(index: number, isRange: boolean) {
    if (!onSelectionChange || !selectedKeys) return
    const next = new Set(selectedKeys)
    const key = cards[index].key
    if (isRange && lastSelectedIndexRef.current !== null) {
      const [from, to] = [Math.min(lastSelectedIndexRef.current, index), Math.max(lastSelectedIndexRef.current, index)]
      for (const card of cards.slice(from, to + 1)) next.add(card.key)
    } else if (next.has(key)) next.delete(key)
    else next.add(key)
    lastSelectedIndexRef.current = index
    onSelectionChange(next)
  }

  function handlePointerDown(event: ReactPointerEvent, index: number) {
    if (!onReorder || event.pointerType === 'touch' || event.button !== 0) return
    pressRef.current = { index, x: event.clientX, y: event.clientY, isDragging: false }
    const handleMove = (moveEvent: PointerEvent) => {
      const press = pressRef.current
      if (!press) return
      if (!press.isDragging && Math.hypot(moveEvent.clientX - press.x, moveEvent.clientY - press.y) < DRAG_THRESHOLD_PX) return
      press.isDragging = true
      const overCard = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>('[data-card-index]')
      const overIndex = overCard ? Number(overCard.dataset.cardIndex) : press.index
      setDrag({ fromIndex: press.index, overIndex })
    }
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      const press = pressRef.current
      pressRef.current = null
      setDrag(null)
      if (!press?.isDragging) return
      ignoreClickRef.current = true
      const overCard = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest<HTMLElement>('[data-card-index]')
      if (overCard && Number(overCard.dataset.cardIndex) !== press.index) onReorder(press.index, Number(overCard.dataset.cardIndex))
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function handleKeyDown(event: ReactKeyboardEvent, index: number) {
    if (!onReorder || !event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    // The grid flows right to left in Arabic, so the left arrow moves a card later there.
    const isLater = (event.key === 'ArrowRight') !== (locale === 'ar')
    const toIndex = index + (isLater ? 1 : -1)
    if (toIndex < 0 || toIndex >= cards.length) return
    onReorder(index, toIndex)
    requestAnimationFrame(() => document.getElementById(`${id}-card-${toIndex + 1}`)?.focus())
  }

  return (
    <ol ref={listRef} id={id} aria-label={label} className="pdf-grid">
      {cards.map((card, index) => {
        const isSelected = selectedKeys?.has(card.key) ?? false
        const isDropTarget = drag !== null && drag.overIndex === index && drag.fromIndex !== index
        const picture =
          'document' in card ? (
            <canvas data-card-key={card.key} className="pdf-grid-canvas" style={{ transform: `rotate(${card.rotation ?? 0}deg)` }} width={THUMBNAIL_WIDTH} height={Math.round(THUMBNAIL_WIDTH * 1.41)} />
          ) : 'imageUrl' in card ? (
            <img src={card.imageUrl} alt="" className="pdf-grid-image" style={{ transform: `rotate(${card.rotation ?? 0}deg)` }} />
          ) : 'isBlank' in card ? (
            <span className="pdf-grid-blank">{t('tools.grid.blankPage')}</span>
          ) : (
            <span className="pdf-grid-problem">{card.problem}</span>
          )
        const cardProps = {
          id: `${id}-card-${index + 1}`,
          'data-card-index': index,
          className: `pdf-grid-card${isSelected ? ' is-selected' : ''}${card.isMarked ? ' is-marked' : ''}${isDropTarget ? ' is-drop-target' : ''}${drag?.fromIndex === index ? ' is-dragged' : ''}${onReorder ? ' is-movable' : ''}`,
          onPointerDown: (event: ReactPointerEvent) => handlePointerDown(event, index),
          onKeyDown: (event: ReactKeyboardEvent) => handleKeyDown(event, index),
        }
        const body = (
          <>
            <span className="pdf-grid-frame">{picture}</span>
            <span className="pdf-grid-caption" dir="auto">
              {card.caption}
            </span>
          </>
        )
        return (
          <li key={card.key} className="pdf-grid-item">
            {onSelectionChange ? (
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={(event) => {
                  if (ignoreClickRef.current) {
                    ignoreClickRef.current = false
                    return
                  }
                  toggleCard(index, event.shiftKey)
                }}
                {...cardProps}
              >
                {body}
              </button>
            ) : (
              <div tabIndex={onReorder ? 0 : undefined} role={onReorder ? 'group' : undefined} aria-roledescription={onReorder ? t('tools.grid.movableCard') : undefined} aria-label={card.caption} {...cardProps}>
                {body}
              </div>
            )}
            {renderActions && <span className="pdf-grid-actions">{renderActions(card, index)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

// Select all / Select none for a selectable grid, with the count.
export function SelectionBar({ idPrefix, total, selectedCount, onSelectAll, onSelectNone }: { idPrefix: string; total: number; selectedCount: number; onSelectAll: () => void; onSelectNone: () => void }) {
  const { t, tp } = useT()
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <span id={`${idPrefix}-selected-count`} aria-live="polite" className="font-medium">
        {tp('tools.grid.selected', selectedCount, { total })}
      </span>
      <button id={`${idPrefix}-select-all-button`} type="button" className="btn btn--quiet btn--compact press" disabled={selectedCount === total} onClick={onSelectAll}>
        {t('tools.grid.selectAll')}
      </button>
      <button id={`${idPrefix}-select-none-button`} type="button" className="btn btn--quiet btn--compact press" disabled={selectedCount === 0} onClick={onSelectNone}>
        {t('tools.grid.selectNone')}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- progress

export function ProgressBar({ id, done, total, label }: { id: string; done: number; total: number; label: string }) {
  return (
    <div className="mx-auto max-w-[480px] text-center" role="status">
      {/* With no total yet (one step that reports nothing on the way) the bar moves without a value. */}
      {total > 0 ? <progress id={id} className="tool-progress" max={total} value={done} aria-label={label} /> : <progress id={id} className="tool-progress" aria-label={label} />}
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------- the list of chosen PDFs (Add page numbers)

// The chosen PDFs, each with its size and page count (or why it cannot be read), with a button to remove each.
export function PdfFileList({ files, onFilesChange }: { files: File[]; onFilesChange: (files: File[]) => void }) {
  const { t, tp } = useT()
  const openedByFile = useOpenedPdfs(files)
  const iconButtonClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  return (
    <div id="pdf-file-list" className="mx-auto max-w-[640px] text-start">
      <ol className="divide-y divide-rule rounded-[18px] border-2 border-rule bg-paper-raised">
        {files.map((file, index) => {
          const opened = openedByFile.get(file)
          return (
            <li key={`${file.name}-${index}`} id={`pdf-file-${index + 1}`} className="flex items-center gap-2 py-2 ps-4 pe-2">
              <span aria-hidden="true" className="nav-icon nav-icon-pdf shrink-0" />
              <span className="min-w-0 flex-1">
                <bdi className="block truncate font-medium">{file.name}</bdi>
                <span className={`block text-sm ${opened && 'problem' in opened ? 'text-danger' : 'text-ink-soft'}`}>
                  {!opened ? t('tools.pdf.reading') : 'problem' in opened ? t(problemMessageKey(opened.problem)) : `${tp('tools.pdf.pages', opened.document.numPages)} · ${isolateLeftToRight(formatFileSize(file.size))}`}
                </span>
              </span>
              <button id={`pdf-file-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: file.name })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={iconButtonClass}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------- names and page ranges

export const baseNameOf = (fileName: string) => fileName.replace(/\.[^.]+$/, '') || 'document'

// [1, 2, 3, 5, 8, 9] → "1-3,5,8-9" (page numbers, from 1).
export function describePageNumbers(pageNumbers: number[]) {
  const sorted = [...new Set(pageNumbers)].sort((first, second) => first - second)
  const parts: string[] = []
  for (let start = 0; start < sorted.length; ) {
    let end = start
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++
    parts.push(start === end ? String(sorted[start]) : `${sorted[start]}-${sorted[end]}`)
    start = end + 1
  }
  return parts.join(',')
}

// "1-3, 5, 8-10" → [[1,2,3],[5],[8,9,10]] (each range one group), or null when a part is not a page range of this PDF. Arabic
// digits and the Arabic comma are read too.
export function parsePageRanges(text: string, pageCount: number): number[][] | null {
  const westernText = text.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660)).replace(/[،؛;]/g, ',')
  const parts = westernText.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const groups: number[][] = []
  for (const part of parts) {
    const match = /^(\d+)\s*(?:[-–]\s*(\d+))?$/.exec(part)
    if (!match) return null
    const first = Number(match[1])
    const last = match[2] ? Number(match[2]) : first
    if (first < 1 || last > pageCount || last < first) return null
    groups.push(Array.from({ length: last - first + 1 }, (_, offset) => first + offset))
  }
  return groups
}

export const pdfResultFile = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name, { type: 'application/pdf' })
export const zipResultFile = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name, { type: 'application/zip' })

// ---------------------------------------------------------------- text and pictures stamped on pages

// Text put on a page (page numbers, headers, watermarks, a typed signature, a flattened form value) is drawn by the browser,
// which joins Arabic letters and orders them right to left, and goes into the PDF as a transparent PNG: pdf-lib's own fonts
// have no Arabic (DECISIONS.md). Four pixels per point keeps it sharp in print.
const PIXELS_PER_POINT = 4
export const STAMP_FONT_FAMILY = '"Nunito Sans", "IBM Plex Sans Arabic", system-ui, sans-serif'
export type StampPicture = { canvas: HTMLCanvasElement; width: number; height: number }

const hasArabicLetters = (text: string) => /[؀-ۿ]/.test(text)
export const toArabicIndicDigits = (text: string) => text.replace(/\d/g, (digit) => String.fromCharCode(0x660 + Number(digit)))

// `width` and `height` are in points; the picture is turned `rotationDegrees` counter-clockwise inside its own box.
export async function drawTextPicture(text: string, { sizePoints, color, fontFamily = STAMP_FONT_FAMILY, fontWeight = 600, isItalic = false, rotationDegrees = 0 }: { sizePoints: number; color: string; fontFamily?: string; fontWeight?: number; isItalic?: boolean; rotationDegrees?: number }): Promise<StampPicture> {
  const font = `${isItalic ? 'italic ' : ''}${fontWeight} ${sizePoints * PIXELS_PER_POINT}px ${fontFamily}`
  await document.fonts.load(font, text)
  const measuring = document.createElement('canvas').getContext('2d')!
  measuring.font = font
  const metrics = measuring.measureText(text)
  const textWidth = Math.ceil(metrics.width) + 4
  const textHeight = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent) + 4
  const angle = (rotationDegrees * Math.PI) / 180
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(Math.abs(textWidth * Math.cos(angle)) + Math.abs(textHeight * Math.sin(angle)))
  canvas.height = Math.ceil(Math.abs(textWidth * Math.sin(angle)) + Math.abs(textHeight * Math.cos(angle)))
  const context = canvas.getContext('2d')!
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(-angle)
  context.font = font
  context.direction = hasArabicLetters(text) ? 'rtl' : 'ltr'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(text, 0, 0)
  return { canvas, width: canvas.width / PIXELS_PER_POINT, height: canvas.height / PIXELS_PER_POINT }
}

// A picture (watermark image, uploaded signature) turned counter-clockwise inside its own box, at most `longSidePoints` long.
// A picture keeps at most MAX_PICTURE_PIXELS on its long side (never more than it has), so a photo watermark stays small.
const MAX_PICTURE_PIXELS = 1600
export function turnPicture(source: CanvasImageSource & { width: number; height: number }, longSidePoints: number, rotationDegrees = 0): StampPicture {
  const longSidePixels = Math.min(longSidePoints * PIXELS_PER_POINT, MAX_PICTURE_PIXELS, Math.max(source.width, source.height))
  const pixelsPerPoint = longSidePixels / longSidePoints
  const scale = longSidePixels / Math.max(source.width, source.height)
  const drawnWidth = source.width * scale
  const drawnHeight = source.height * scale
  const angle = (rotationDegrees * Math.PI) / 180
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(Math.abs(drawnWidth * Math.cos(angle)) + Math.abs(drawnHeight * Math.sin(angle)))
  canvas.height = Math.ceil(Math.abs(drawnWidth * Math.sin(angle)) + Math.abs(drawnHeight * Math.cos(angle)))
  const context = canvas.getContext('2d')!
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(-angle)
  context.drawImage(source, -drawnWidth / 2, -drawnHeight / 2, drawnWidth, drawnHeight)
  return { canvas, width: canvas.width / pixelsPerPoint, height: canvas.height / pixelsPerPoint }
}

export async function pngBytesOf(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The picture could not be made')
  return blob.arrayBuffer()
}

// ---------------------------------------------------------------- pages rebuilt as pictures with a text layer

let measuringContext: CanvasRenderingContext2D | null = null

// The text runs of a page as shown (points from its top-left corner), for the invisible text layer over its picture: each run's
// box (from ascenders to descenders, wider by a third of the font size on each side) and its words, placed by their widths measured in a similar font, right to left for a right-to-left run. Turned text is
// left out. Each run's words come in visual order, left to right, as the layer writes them.
async function readPageRuns(page: PDFPageProxy): Promise<{ box: PageBox; words: LayerWord[] }[]> {
  const context = (measuringContext ??= document.createElement('canvas').getContext('2d'))
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const runs: { box: PageBox; words: LayerWord[] }[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim() || !context) continue
    const [scaleX, skewY, skewX, scaleY, baselineX, baselineY] = item.transform as number[]
    const directionLength = Math.hypot(scaleX, skewY) || 1
    const [startX, startY] = viewport.convertToViewportPoint(baselineX, baselineY)
    const [endX, endY] = viewport.convertToViewportPoint(baselineX + (scaleX / directionLength) * item.width, baselineY + (skewY / directionLength) * item.width)
    const fontSize = Math.hypot(skewX, scaleY)
    if (Math.abs(endY - startY) > 1 || fontSize === 0) continue
    context.font = `${fontSize}px sans-serif`
    const pieces = item.str.split(/(\s+)/).filter(Boolean)
    const measuredWidths = pieces.map((piece) => context.measureText(piece).width)
    const pointsPerMeasuredWidth = Math.abs(endX - startX) / (measuredWidths.reduce((sum, width) => sum + width, 0) || 1)
    const isRightToLeft = item.dir === 'rtl'
    let cursor = isRightToLeft ? Math.max(startX, endX) : Math.min(startX, endX)
    const runWords: LayerWord[] = []
    pieces.forEach((piece, index) => {
      const width = measuredWidths[index] * pointsPerMeasuredWidth
      const left = isRightToLeft ? cursor - width : cursor
      cursor = isRightToLeft ? cursor - width : cursor + width
      if (piece.trim()) runWords.push({ text: piece, x: left, baselineY: startY, width, fontSize })
    })
    const box = { x: Math.min(startX, endX) - fontSize / 3, y: startY - fontSize, width: Math.abs(endX - startX) + (2 * fontSize) / 3, height: fontSize * 1.25 }
    runs.push({ box, words: isRightToLeft ? runWords.reverse() : runWords })
  }
  return runs
}

const boxesOverlap = (first: PageBox, second: PageBox) => first.x < second.x + second.width && second.x < first.x + first.width && first.y < second.y + second.height && second.y < first.y + first.height

// A page drawn by pdf.js as a JPEG at 200 dpi on white, with its words for the text layer: what Redact PDF, Crop PDF (when what is
// outside is removed) and the repair of a damaged PDF put in place of the page. `blackBoxes` (points, as shown) are filled in and
// their words left out; with `keptBox` only that part of the page is kept, with the words inside it.
const PAGE_PICTURE_SCALE = 200 / 72
export async function drawPagePicture(document: PDFDocumentProxy, pageIndex: number, { blackBoxes = [], keptBox }: { blackBoxes?: PageBox[]; keptBox?: PageBox } = {}): Promise<PagePicture> {
  const page = await document.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: PAGE_PICTURE_SCALE })
  const shownSize = { width: viewport.width / PAGE_PICTURE_SCALE, height: viewport.height / PAGE_PICTURE_SCALE }
  const area = keptBox ?? { x: 0, y: 0, ...shownSize }
  const pageCanvas = window.document.createElement('canvas')
  pageCanvas.width = Math.floor(viewport.width)
  pageCanvas.height = Math.floor(viewport.height)
  await page.render({ canvas: pageCanvas, viewport, background: '#ffffff' }).promise
  const pageContext = pageCanvas.getContext('2d')!
  pageContext.fillStyle = '#000000'
  for (const box of blackBoxes) pageContext.fillRect(box.x * PAGE_PICTURE_SCALE, box.y * PAGE_PICTURE_SCALE, box.width * PAGE_PICTURE_SCALE, box.height * PAGE_PICTURE_SCALE)
  const canvas = window.document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width * PAGE_PICTURE_SCALE))
  canvas.height = Math.max(1, Math.round(area.height * PAGE_PICTURE_SCALE))
  canvas.getContext('2d')!.drawImage(pageCanvas, -area.x * PAGE_PICTURE_SCALE, -area.y * PAGE_PICTURE_SCALE)
  pageCanvas.width = 0
  const words = (await readPageRuns(page))
    // A word's place inside its run is only estimated (the PDF's font can be much wider or narrower than the measuring font), so a
    // run that a black box even touches is left out of the text layer whole.
    .filter((run) => !blackBoxes.some((box) => boxesOverlap(run.box, box)))
    .flatMap((run) => run.words)
    .filter((word) => !keptBox || (word.x >= area.x && word.x + word.width <= area.x + area.width && word.baselineY - word.fontSize >= area.y && word.baselineY <= area.y + area.height))
    .map((word) => ({ ...word, x: word.x - area.x, baselineY: word.baselineY - area.y }))
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  canvas.width = 0
  page.cleanup()
  if (!blob) throw new Error('The page picture could not be made')
  return { pageIndex, jpg: await blob.arrayBuffer(), widthPoints: area.width, heightPoints: area.height, words }
}

// Every page's size as shown (after its rotation), in points: the frame stamps and shapes are placed in.
export async function shownPageSizes(document: PDFDocumentProxy) {
  const sizes: { width: number; height: number }[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const viewport = (await document.getPage(pageNumber)).getViewport({ scale: 1 })
    sizes.push({ width: viewport.width, height: viewport.height })
  }
  return sizes
}

// A page drawn at `widthPixels` with stamps on it, as the saved PDF will show them (the settings tools' live preview).
export function StampPreview({ id, label, document, pageIndex, stamps }: { id: string; label: string; document: PDFDocumentProxy; pageIndex: number; stamps: { picture: StampPicture; box: PageBox; opacity: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let isCurrent = true
    const canvas = canvasRef.current
    if (!canvas) return
    void document.getPage(pageIndex + 1).then(async (page) => {
      const unscaled = page.getViewport({ scale: 1 })
      const scale = (PREVIEW_WIDTH * window.devicePixelRatio) / unscaled.width
      const viewport = page.getViewport({ scale })
      const drawing = window.document.createElement('canvas')
      drawing.width = viewport.width
      drawing.height = viewport.height
      await page.render({ canvas: drawing, viewport, background: '#ffffff' }).promise
      if (!isCurrent) return
      const context = drawing.getContext('2d')!
      for (const stamp of stamps) {
        context.globalAlpha = stamp.opacity
        context.drawImage(stamp.picture.canvas, stamp.box.x * scale, stamp.box.y * scale, stamp.box.width * scale, stamp.box.height * scale)
      }
      canvas.width = drawing.width
      canvas.height = drawing.height
      canvas.getContext('2d')!.drawImage(drawing, 0, 0)
    })
    return () => {
      isCurrent = false
    }
  }, [document, pageIndex, stamps])
  return <canvas id={id} ref={canvasRef} role="img" aria-label={label} className="stamp-preview" />
}
const PREVIEW_WIDTH = 300

// Which pages a setting applies to: all of them, or the ones typed as ranges ("1-3, 5"). `null` while the ranges are not valid.
export type PagesChoiceValue = { isAllPages: boolean; ranges: string }
export function chosenPageIndexes(choice: PagesChoiceValue, pageCount: number) {
  if (choice.isAllPages) return Array.from({ length: pageCount }, (_, pageIndex) => pageIndex)
  const groups = parsePageRanges(choice.ranges, pageCount)
  return groups ? [...new Set(groups.flat())].sort((first, second) => first - second).map((pageNumber) => pageNumber - 1) : null
}

export function PagesChoice({ idPrefix, pageCount, value, onChange }: { idPrefix: string; pageCount: number; value: PagesChoiceValue; onChange: (value: PagesChoiceValue) => void }) {
  const { t } = useT()
  const isInvalid = !value.isAllPages && chosenPageIndexes(value, pageCount) === null
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <legend className="mb-1 text-sm font-semibold">{t('tools.pagesChoice.label')}</legend>
      <label className="inline-flex min-h-11 items-center gap-2">
        <input id={`${idPrefix}-all-pages-radio`} type="radio" name={`${idPrefix}-pages`} checked={value.isAllPages} onChange={() => onChange({ ...value, isAllPages: true })} className="size-5" />
        {t('tools.pagesChoice.all', { count: pageCount })}
      </label>
      <label className="inline-flex min-h-11 items-center gap-2">
        <input id={`${idPrefix}-some-pages-radio`} type="radio" name={`${idPrefix}-pages`} checked={!value.isAllPages} onChange={() => onChange({ ...value, isAllPages: false })} className="size-5" />
        {t('tools.pagesChoice.some')}
      </label>
      {!value.isAllPages && (
        <input
          id={`${idPrefix}-pages-input`}
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={value.ranges}
          placeholder="1-3, 5"
          aria-label={t('tools.pagesChoice.rangesLabel')}
          aria-invalid={isInvalid}
          onChange={(event) => onChange({ ...value, ranges: event.target.value })}
          className="control-shape min-h-11 w-40 border-2 border-rule bg-paper-raised px-3 text-ink"
        />
      )}
      {isInvalid && value.ranges.trim() !== '' && <span className="text-sm font-medium text-danger">{t('tools.pagesChoice.invalid', { count: pageCount })}</span>}
    </fieldset>
  )
}
