// Scan to PDF: photos of paper pages (taken with the phone's own camera, or chosen) are straightened from four corners dragged by
// hand, cleaned with a document filter and put in one PDF. The pictures are read as in JPG to PDF (readPicture); each page is
// warped on the page, one at a time, and the PDF is made in pdfTools.worker.ts (`images-to-pdf`).
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { readPicture } from './ImagesToPdf'
import type { ReadPicture } from './ImagesToPdf'
import { runPdfTask } from './pdfTasks'
import type { EmbeddableImage, PageSize } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, pdfResultFile } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

// A point as a share (0 to 1) of the turned photo's width and height.
type Point = { x: number; y: number }
type ScanFilter = 'document' | 'grayscale' | 'original'
// The page's corners in order: top left, top right, bottom right, bottom left.
type PageSettings = { corners: [Point, Point, Point, Point]; rotation: number; filter: ScanFilter }

const CORNER_INSET = 0.03
const startingCorners = (): PageSettings['corners'] => [
  { x: CORNER_INSET, y: CORNER_INSET },
  { x: 1 - CORNER_INSET, y: CORNER_INSET },
  { x: 1 - CORNER_INSET, y: 1 - CORNER_INSET },
  { x: CORNER_INSET, y: 1 - CORNER_INSET },
]
const startingSettings = (): PageSettings => ({ corners: startingCorners(), rotation: 0, filter: 'document' })
const PREVIEW_LONG_SIDE_PX = 900
const SOURCE_LONG_SIDE_PX = 3000
const PAGE_LONG_SIDE_PX = 2000
// The size of the blocks the paper's brightness is measured in: larger than a letter, smaller than a shadow.
const PAPER_BLOCK_PX = 40
const CORNER_NAMES: MessageKey[] = ['tools.scan.corner.topLeft', 'tools.scan.corner.topRight', 'tools.scan.corner.bottomRight', 'tools.scan.corner.bottomLeft']
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const actionClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

// The photo turned by `rotation` degrees (a multiple of 90, clockwise) on a canvas at most `longSidePx` long.
async function drawTurnedPhoto(image: EmbeddableImage, rotation: number, longSidePx: number) {
  const bitmap = await createImageBitmap(new Blob([image.bytes]))
  const scale = Math.min(1, longSidePx / Math.max(bitmap.width, bitmap.height))
  const [width, height] = [Math.round(bitmap.width * scale), Math.round(bitmap.height * scale)]
  const isSideways = rotation % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = isSideways ? height : width
  canvas.height = isSideways ? width : height
  const context = canvas.getContext('2d')!
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((rotation * Math.PI) / 180)
  context.drawImage(bitmap, -width / 2, -height / 2, width, height)
  bitmap.close()
  return canvas
}

// The projective map from the unit square (u along the top edge, v down the left edge) to the four corners, in pixels.
function squareToCorners([topLeft, topRight, bottomRight, bottomLeft]: Point[]) {
  const sumX = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x
  const sumY = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y
  let perspectiveU = 0
  let perspectiveV = 0
  if (Math.abs(sumX) > 1e-9 || Math.abs(sumY) > 1e-9) {
    const [edgeX1, edgeX2, edgeY1, edgeY2] = [topRight.x - bottomRight.x, bottomLeft.x - bottomRight.x, topRight.y - bottomRight.y, bottomLeft.y - bottomRight.y]
    const determinant = edgeX1 * edgeY2 - edgeX2 * edgeY1
    perspectiveU = (sumX * edgeY2 - edgeX2 * sumY) / determinant
    perspectiveV = (edgeX1 * sumY - sumX * edgeY1) / determinant
  }
  const a = topRight.x - topLeft.x + perspectiveU * topRight.x
  const b = bottomLeft.x - topLeft.x + perspectiveV * bottomLeft.x
  const d = topRight.y - topLeft.y + perspectiveU * topRight.y
  const e = bottomLeft.y - topLeft.y + perspectiveV * bottomLeft.y
  return (u: number, v: number) => {
    const w = perspectiveU * u + perspectiveV * v + 1
    return { x: (a * u + b * v + topLeft.x) / w, y: (d * u + e * v + topLeft.y) / w }
  }
}

// The part of the photo inside the corners, straightened to a rectangle as long and wide as its sides (at most PAGE_LONG_SIDE_PX),
// sampled with bilinear filtering.
function warpToRectangle(photo: HTMLCanvasElement, cornerShares: Point[]) {
  const corners = cornerShares.map((corner) => ({ x: corner.x * photo.width, y: corner.y * photo.height }))
  const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y)
  const sideWidth = (distance(corners[0], corners[1]) + distance(corners[3], corners[2])) / 2
  const sideHeight = (distance(corners[0], corners[3]) + distance(corners[1], corners[2])) / 2
  const scale = Math.min(1, PAGE_LONG_SIDE_PX / Math.max(sideWidth, sideHeight))
  const width = Math.max(1, Math.round(sideWidth * scale))
  const height = Math.max(1, Math.round(sideHeight * scale))
  const source = photo.getContext('2d')!.getImageData(0, 0, photo.width, photo.height).data
  const page = new ImageData(width, height)
  const mapToPhoto = squareToCorners(corners)
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const { x, y } = mapToPhoto((column + 0.5) / width, (row + 0.5) / height)
      const left = Math.min(Math.max(Math.floor(x - 0.5), 0), photo.width - 2)
      const top = Math.min(Math.max(Math.floor(y - 0.5), 0), photo.height - 2)
      const shareX = Math.min(Math.max(x - 0.5 - left, 0), 1)
      const shareY = Math.min(Math.max(y - 0.5 - top, 0), 1)
      const target = (row * width + column) * 4
      for (let channel = 0; channel < 3; channel++) {
        const topLeft = source[(top * photo.width + left) * 4 + channel]
        const topRight = source[(top * photo.width + left + 1) * 4 + channel]
        const bottomLeft = source[((top + 1) * photo.width + left) * 4 + channel]
        const bottomRight = source[((top + 1) * photo.width + left + 1) * 4 + channel]
        page.data[target + channel] = (topLeft * (1 - shareX) + topRight * shareX) * (1 - shareY) + (bottomLeft * (1 - shareX) + bottomRight * shareX) * shareY
      }
      page.data[target + 3] = 255
    }
  }
  return page
}

// Grey levels; for `document` each pixel is also divided by the paper's own brightness around it, which evens out shadows, then
// stretched so the paper turns white and the ink dark.
function applyScanFilter(page: ImageData, filter: ScanFilter) {
  if (filter === 'original') return page
  const pixels = page.data
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const grey = 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2]
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = grey
  }
  if (filter === 'grayscale') return page
  // The paper's brightness: the brightest grey in each block (ink is darker, so text never lowers it), spread smoothly by drawing
  // the small map at full size.
  const small = document.createElement('canvas')
  small.width = Math.ceil(page.width / PAPER_BLOCK_PX)
  small.height = Math.ceil(page.height / PAPER_BLOCK_PX)
  const brightest = new ImageData(small.width, small.height)
  for (let row = 0; row < page.height; row++) {
    for (let column = 0; column < page.width; column++) {
      const block = (Math.floor(row / PAPER_BLOCK_PX) * small.width + Math.floor(column / PAPER_BLOCK_PX)) * 4
      brightest.data[block] = Math.max(brightest.data[block], pixels[(row * page.width + column) * 4])
    }
  }
  for (let offset = 0; offset < brightest.data.length; offset += 4) {
    brightest.data[offset + 1] = brightest.data[offset + 2] = brightest.data[offset]
    brightest.data[offset + 3] = 255
  }
  small.getContext('2d')!.putImageData(brightest, 0, 0)
  const backgroundCanvas = document.createElement('canvas')
  backgroundCanvas.width = page.width
  backgroundCanvas.height = page.height
  const backgroundContext = backgroundCanvas.getContext('2d')!
  backgroundContext.imageSmoothingQuality = 'high'
  backgroundContext.drawImage(small, 0, 0, page.width, page.height)
  const background = backgroundContext.getImageData(0, 0, page.width, page.height).data
  for (let offset = 0; offset < pixels.length; offset += 4) {
    // Paper (close to its own background) turns white; the curve keeps thin, light strokes of ink visible instead of cutting them.
    const evenedOut = pixels[offset] / Math.max(background[offset], 1)
    const lightness = Math.min(1, Math.max(0, (evenedOut - 0.3) / 0.62))
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255 * lightness * lightness
  }
  return page
}

async function makeScannedPage(image: EmbeddableImage, settings: PageSettings): Promise<EmbeddableImage> {
  const photo = await drawTurnedPhoto(image, settings.rotation, SOURCE_LONG_SIDE_PX)
  const page = applyScanFilter(warpToRectangle(photo, settings.corners), settings.filter)
  photo.width = 0
  const canvas = document.createElement('canvas')
  canvas.width = page.width
  canvas.height = page.height
  canvas.getContext('2d')!.putImageData(page, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  canvas.width = 0
  if (!blob) throw new Error('The page could not be made')
  return { name: image.name, kind: 'jpg', bytes: await blob.arrayBuffer(), width: page.width, height: page.height }
}

// The chosen page large, with its four corners to drag (or move with the arrow keys, Shift for larger steps).
function CornerEditor({ image, settings, onChange }: { image: EmbeddableImage; settings: PageSettings; onChange: (settings: PageSettings) => void }) {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [isDrawn, setIsDrawn] = useState(false)
  const dragRef = useRef<number | null>(null)

  useEffect(() => {
    let isCurrent = true
    void drawTurnedPhoto(image, settings.rotation, PREVIEW_LONG_SIDE_PX).then((preview) => {
      const canvas = canvasRef.current
      if (!isCurrent || !canvas) return
      canvas.width = preview.width
      canvas.height = preview.height
      canvas.getContext('2d')!.drawImage(preview, 0, 0)
      setIsDrawn(true)
    })
    return () => {
      isCurrent = false
    }
  }, [image, settings.rotation])

  function moveCorner(cornerIndex: number, point: Point) {
    const corners = [...settings.corners] as PageSettings['corners']
    corners[cornerIndex] = { x: Math.min(Math.max(point.x, 0), 1), y: Math.min(Math.max(point.y, 0), 1) }
    onChange({ ...settings, corners })
  }
  function dragCorner(event: ReactPointerEvent) {
    const frame = frameRef.current
    if (dragRef.current === null || !frame) return
    const frameBox = frame.getBoundingClientRect()
    moveCorner(dragRef.current, { x: (event.clientX - frameBox.left) / frameBox.width, y: (event.clientY - frameBox.top) / frameBox.height })
  }
  function moveCornerWithKeys(event: ReactKeyboardEvent, cornerIndex: number) {
    const step = event.shiftKey ? 0.02 : 0.005
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const corner = settings.corners[cornerIndex]
    moveCorner(cornerIndex, { x: corner.x + move[0], y: corner.y + move[1] })
  }

  return (
    // The photo stays left to right on an Arabic page.
    <div ref={frameRef} dir="ltr" className={`scan-frame${isDrawn ? '' : ' invisible'}`} onPointerMove={dragCorner} onPointerUp={() => (dragRef.current = null)}>
      <canvas ref={canvasRef} id="scan-page-photo" width={600} height={800} role="img" aria-label={t('tools.scan.photoLabel')} className="scan-picture" />
      <svg className="scan-outline" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={settings.corners.map((corner) => `${corner.x},${corner.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
      </svg>
      {settings.corners.map((corner, cornerIndex) => (
        <div
          key={cornerIndex}
          id={`scan-corner-${cornerIndex + 1}`}
          role="group"
          tabIndex={0}
          aria-label={t('tools.scan.cornerLabel', { corner: t(CORNER_NAMES[cornerIndex]) })}
          aria-describedby="scan-corner-hint"
          className="scan-corner"
          style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = cornerIndex
          }}
          onPointerMove={dragCorner}
          onPointerUp={() => (dragRef.current = null)}
          onKeyDown={(event) => moveCornerWithKeys(event, cornerIndex)}
        />
      ))}
    </div>
  )
}

export default function ScanToPdf({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const [readByFile, setReadByFile] = useState(new Map<File, ReadPicture>())
  const readRef = useRef(readByFile)
  const [settingsByFile, setSettingsByFile] = useState(new Map<File, PageSettings>())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    readRef.current = readByFile
  }, [readByFile])
  useEffect(() => {
    let isCurrent = true
    for (const file of files) {
      if (readRef.current.has(file)) continue
      void readPicture(file)
        .catch((): ReadPicture => ({ problem: 'unreadable' }))
        .then((picture) => {
          if (isCurrent) setReadByFile((previous) => new Map(previous).set(file, picture))
        })
    }
    return () => {
      isCurrent = false
    }
  }, [files])
  useEffect(
    () => () => {
      for (const picture of readRef.current.values()) if ('previewUrl' in picture) URL.revokeObjectURL(picture.previewUrl)
    },
    [],
  )

  const shownFile = selectedFile && files.includes(selectedFile) ? selectedFile : files[0]
  const shownPicture = shownFile ? readByFile.get(shownFile) : undefined
  const shownSettings = (shownFile && settingsByFile.get(shownFile)) ?? startingSettings()
  const changeShownSettings = (settings: PageSettings) => shownFile && setSettingsByFile((previous) => new Map(previous).set(shownFile, settings))
  const readyPages = files.flatMap((file) => {
    const picture = readByFile.get(file)
    return picture && 'image' in picture ? [{ image: picture.image, settings: settingsByFile.get(file) ?? startingSettings() }] : []
  })
  const isEveryFileRead = files.every((file) => readByFile.has(file))

  const keyOf = (index: number) => `scan-page-${index}`
  const cards: GridCard[] = files.map((file, index) => {
    const picture = readByFile.get(file)
    const caption = t('tools.scan.pageCaption', { number: index + 1 })
    if (!picture) return { key: keyOf(index), caption, problem: t('tools.pdf.reading') }
    if ('problem' in picture) return { key: keyOf(index), caption, problem: t(picture.problem === 'heic' ? 'tools.images.heicNotSupported' : 'tools.images.unreadable') }
    return { key: keyOf(index), caption, imageUrl: picture.previewUrl, rotation: settingsByFile.get(file)?.rotation ?? 0 }
  })

  function moveFile(fromIndex: number, toIndex: number) {
    const reorderedFiles = [...files]
    const [movedFile] = reorderedFiles.splice(fromIndex, 1)
    reorderedFiles.splice(toIndex, 0, movedFile)
    onFilesChange(reorderedFiles)
  }

  async function makePdf() {
    setError('')
    setProgress({ done: 0, total: readyPages.length })
    try {
      const pages: EmbeddableImage[] = []
      for (const page of readyPages) {
        await nextFrame()
        pages.push(await makeScannedPage(page.image, page.settings))
        setProgress({ done: pages.length, total: readyPages.length })
      }
      const pdfName = `${baseNameOf(readyPages[0].image.name)}-scan.pdf`
      const response = await runPdfTask({ type: 'images-to-pdf', images: pages, pageSize, orientation: 'auto', marginPoints: 0, isOnePdfPerImage: false, pdfName })
      if (response.status !== 'ok' || !response.pdf) throw new Error('The PDF could not be made')
      onResult(pdfResultFile(response.pdf, pdfName))
    } catch {
      setError(t('tools.scan.failed'))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div id="scan-to-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.scan.hint')}</p>
      <input
        ref={photoInputRef}
        id="scan-take-photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const photos = Array.from(event.target.files ?? [])
          if (photos.length) onFilesChange([...files, ...photos])
          event.target.value = ''
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="scan-take-photo-button" type="button" onClick={() => photoInputRef.current?.click()} className="btn btn--quiet press">
          {t('tools.scan.takePhoto')}
        </button>
        <button id="scan-add-photos-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('tools.images.addMore')}
        </button>
      </div>
      {shownFile && shownPicture && 'image' in shownPicture && (
        <section id="scan-page-editor" aria-labelledby="scan-page-editor-heading" className="space-y-3">
          <h3 id="scan-page-editor-heading" className="text-center font-semibold">
            {t('tools.scan.editing', { number: files.indexOf(shownFile) + 1, total: files.length })}
          </h3>
          <p className="text-center text-sm text-ink-soft">{t('tools.scan.cornersHint')}</p>
          <p id="scan-corner-hint" className="sr-only">{t('tools.scan.cornerKeys')}</p>
          <CornerEditor image={shownPicture.image} settings={shownSettings} onChange={changeShownSettings} />
          <div className="flex flex-wrap items-end justify-center gap-3 text-start">
            <button id="scan-rotate-left-button" type="button" onClick={() => changeShownSettings({ ...shownSettings, corners: startingCorners(), rotation: (shownSettings.rotation + 270) % 360 })} className="btn btn--quiet btn--compact press">
              {t('tools.rotate.left')}
            </button>
            <button id="scan-rotate-right-button" type="button" onClick={() => changeShownSettings({ ...shownSettings, corners: startingCorners(), rotation: (shownSettings.rotation + 90) % 360 })} className="btn btn--quiet btn--compact press">
              {t('tools.rotate.right')}
            </button>
            <button id="scan-reset-corners-button" type="button" onClick={() => changeShownSettings({ ...shownSettings, corners: startingCorners() })} className="btn btn--quiet btn--compact press">
              {t('tools.scan.resetCorners')}
            </button>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.scan.filter')}
              <select id="scan-filter-select" value={shownSettings.filter} onChange={(event) => changeShownSettings({ ...shownSettings, filter: event.target.value as ScanFilter })} className={fieldClass}>
                {(['document', 'grayscale', 'original'] as const).map((filter) => (
                  <option key={filter} value={filter}>
                    {t(`tools.scan.filter.${filter}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.images.pageSize')}
          <select id="scan-page-size-select" value={pageSize} onChange={(event) => setPageSize(event.target.value as PageSize)} className={fieldClass}>
            <option value="a4">{t('tools.images.sizeA4')}</option>
            <option value="letter">{t('tools.images.sizeLetter')}</option>
            <option value="fit">{t('tools.images.sizeFit')}</option>
          </select>
        </label>
        <button id="scan-to-pdf-button" type="button" disabled={readyPages.length === 0 || !isEveryFileRead || progress !== null} onClick={() => void makePdf()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.scan.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.pages', { done: progress.done, total: progress.total })} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
      <PdfThumbnailGrid
        id="scan-pages-grid"
        label={t('tools.scan.pagesLabel')}
        cards={cards}
        selectedKeys={new Set(shownFile ? [keyOf(files.indexOf(shownFile))] : [])}
        onSelectionChange={(keys) => {
          const clickedKey = [...keys].find((key) => key !== keyOf(files.indexOf(shownFile)))
          if (clickedKey) setSelectedFile(files[Number(clickedKey.replace('scan-page-', ''))])
        }}
        onReorder={moveFile}
        renderActions={(card, index) => (
          <>
            <button id={`scan-earlier-${index + 1}`} type="button" aria-label={t('tools.grid.moveEarlier', { name: card.caption })} disabled={index === 0} onClick={() => moveFile(index, index - 1)} className={actionClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <button id={`scan-later-${index + 1}`} type="button" aria-label={t('tools.grid.moveLater', { name: card.caption })} disabled={index === files.length - 1} onClick={() => moveFile(index, index + 1)} className={actionClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <button id={`scan-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: card.caption })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={actionClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </>
        )}
      />
    </div>
  )
}
