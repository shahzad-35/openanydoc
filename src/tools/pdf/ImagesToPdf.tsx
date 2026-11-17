// JPG to PDF: pictures (JPG, PNG, WebP, HEIC, TIFF, SVG) in the order shown become one PDF, or one PDF per picture in a ZIP, with
// a page size, orientation and margin. JPG and PNG go into the PDF as they are; the other formats are read by the browser (HEIC
// only where it can: Safari), TIFF by utif2 (MIT, loaded only for a TIFF), and drawn once on a canvas.
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { EmbeddableImage, PageOrientation, PageSize } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, pdfResultFile, zipResultFile } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

type ReadPicture = { image: EmbeddableImage; previewUrl: string } | { problem: 'heic' | 'unreadable' }
type Margin = 'none' | 'small' | 'large'

const MARGIN_POINTS: Record<Margin, number> = { none: 0, small: 18, large: 36 }
const SVG_LONG_SIDE_PX = 2000
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'

const extensionOf = (fileName: string) => fileName.toLowerCase().split('.').pop() ?? ''

// The EXIF orientation of a JPEG (1 when there is none). PDF viewers ignore it, so a turned photo is redrawn upright first.
function readJpegOrientation(bytes: ArrayBuffer) {
  const view = new DataView(bytes)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1
  for (let offset = 2; offset + 4 < view.byteLength; ) {
    const marker = view.getUint16(offset)
    const length = view.getUint16(offset + 2)
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
      const tiffStart = offset + 10
      const isLittleEndian = view.getUint16(tiffStart) === 0x4949
      const directoryStart = tiffStart + view.getUint32(tiffStart + 4, isLittleEndian)
      const entryCount = view.getUint16(directoryStart, isLittleEndian)
      for (let entry = 0; entry < entryCount; entry++) {
        const entryStart = directoryStart + 2 + entry * 12
        if (view.getUint16(entryStart, isLittleEndian) === 0x0112) return view.getUint16(entryStart + 8, isLittleEndian)
      }
      return 1
    }
    if ((marker & 0xff00) !== 0xff00) return 1
    offset += 2 + length
  }
  return 1
}

async function canvasToImage(canvas: HTMLCanvasElement, name: string, kind: 'jpg' | 'png'): Promise<ReadPicture> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.92))
  if (!blob) return { problem: 'unreadable' }
  return { image: { name, kind, bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height }, previewUrl: URL.createObjectURL(blob) }
}

async function readPicture(file: File): Promise<ReadPicture> {
  const extension = extensionOf(file.name)
  const bytes = await file.arrayBuffer()
  if (extension === 'tif' || extension === 'tiff') {
    try {
      const UTIF = await import('utif2')
      const [firstImage] = UTIF.decode(bytes)
      UTIF.decodeImage(bytes, firstImage)
      const width = Number(firstImage.width)
      const height = Number(firstImage.height)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(firstImage)), width, height), 0, 0)
      return canvasToImage(canvas, file.name, 'png')
    } catch {
      return { problem: 'unreadable' }
    }
  }
  const previewUrl = URL.createObjectURL(file)
  const picture = new Image()
  picture.src = previewUrl
  try {
    await picture.decode()
  } catch {
    URL.revokeObjectURL(previewUrl)
    return { problem: extension === 'heic' || extension === 'heif' ? 'heic' : 'unreadable' }
  }
  const isJpeg = extension === 'jpg' || extension === 'jpeg'
  if ((isJpeg && readJpegOrientation(bytes) === 1) || extension === 'png') {
    return { image: { name: file.name, kind: isJpeg ? 'jpg' : 'png', bytes, width: picture.naturalWidth, height: picture.naturalHeight }, previewUrl }
  }
  // WebP, HEIC, a turned JPEG and SVG are drawn once (upright, as the browser shows them); SVG at a size that prints sharply.
  URL.revokeObjectURL(previewUrl)
  const isSvg = extension === 'svg'
  const naturalWidth = picture.naturalWidth || 1000
  const naturalHeight = picture.naturalHeight || 1000
  const scale = isSvg ? SVG_LONG_SIDE_PX / Math.max(naturalWidth, naturalHeight) : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(naturalWidth * scale)
  canvas.height = Math.round(naturalHeight * scale)
  const context = canvas.getContext('2d')!
  if (!isSvg && extension !== 'webp') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(picture, 0, 0, canvas.width, canvas.height)
  return canvasToImage(canvas, file.name, isSvg || extension === 'webp' ? 'png' : 'jpg')
}

export default function ImagesToPdf({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const [readByFile, setReadByFile] = useState(new Map<File, ReadPicture>())
  const readRef = useRef(readByFile)
  useEffect(() => {
    readRef.current = readByFile
  }, [readByFile])
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [orientation, setOrientation] = useState<PageOrientation>('auto')
  const [margin, setMargin] = useState<Margin>('small')
  const [isOnePdfPerImage, setIsOnePdfPerImage] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')

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

  const timesSeen = new Map<File, number>()
  const cards: GridCard[] = files.map((file) => {
    timesSeen.set(file, (timesSeen.get(file) ?? 0) + 1)
    const key = `${file.name}-${file.size}-${file.lastModified}-${timesSeen.get(file)}`
    const picture = readByFile.get(file)
    if (!picture) return { key, caption: file.name, problem: t('tools.pdf.reading') }
    if ('problem' in picture) return { key, caption: file.name, problem: t(picture.problem === 'heic' ? 'tools.images.heicNotSupported' : 'tools.images.unreadable') }
    return { key, caption: file.name, imageUrl: picture.previewUrl }
  })
  const readyImages = files.flatMap((file) => {
    const picture = readByFile.get(file)
    return picture && 'image' in picture ? [picture.image] : []
  })
  const isEveryFileRead = files.every((file) => readByFile.has(file))

  function moveFile(fromIndex: number, toIndex: number) {
    const reorderedFiles = [...files]
    const [movedFile] = reorderedFiles.splice(fromIndex, 1)
    reorderedFiles.splice(toIndex, 0, movedFile)
    onFilesChange(reorderedFiles)
  }

  async function makePdf() {
    setError('')
    setProgress({ done: 0, total: readyImages.length })
    const baseName = readyImages.length === 1 ? baseNameOf(readyImages[0].name) : `${baseNameOf(readyImages[0].name)}-and-${readyImages.length - 1}-more`
    // The bytes are copied for the worker, so the pictures stay usable for another try.
    const images = readyImages.map((image) => ({ ...image, bytes: image.bytes.slice(0) }))
    const response = await runPdfTask({ type: 'images-to-pdf', images, pageSize, orientation, marginPoints: MARGIN_POINTS[margin], isOnePdfPerImage, pdfName: `${baseName}.pdf` }, (done, total) => setProgress({ done, total })).catch(() => null)
    setProgress(null)
    if (response?.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${baseName}.pdf`))
    else if (response?.status === 'ok' && response.zip) onResult(zipResultFile(response.zip, `${baseName}-pdfs.zip`))
    else setError(t('tools.images.failed'))
  }

  const options: { id: string; labelKey: MessageKey; value: string; onChange: (value: string) => void; choices: [string, MessageKey][] }[] = [
    { id: 'jpg-page-size-select', labelKey: 'tools.images.pageSize', value: pageSize, onChange: (value) => setPageSize(value as PageSize), choices: [['a4', 'tools.images.sizeA4'], ['letter', 'tools.images.sizeLetter'], ['fit', 'tools.images.sizeFit']] },
    { id: 'jpg-orientation-select', labelKey: 'tools.images.orientation', value: orientation, onChange: (value) => setOrientation(value as PageOrientation), choices: [['auto', 'tools.images.orientationAuto'], ['portrait', 'tools.images.orientationPortrait'], ['landscape', 'tools.images.orientationLandscape']] },
    { id: 'jpg-margin-select', labelKey: 'tools.images.margin', value: margin, onChange: (value) => setMargin(value as Margin), choices: [['none', 'tools.images.marginNone'], ['small', 'tools.images.marginSmall'], ['large', 'tools.images.marginLarge']] },
  ]
  const actionClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  return (
    <div id="jpg-to-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.images.hint')}</p>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        {options.map((option) => (
          <label key={option.id} className="flex flex-col gap-1 text-sm font-medium">
            {t(option.labelKey)}
            <select id={option.id} value={option.value} disabled={option.id === 'jpg-orientation-select' && pageSize === 'fit'} onChange={(event) => option.onChange(event.target.value)} className={fieldClass}>
              {option.choices.map(([value, labelKey]) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="jpg-one-pdf-per-image-checkbox" type="checkbox" checked={isOnePdfPerImage} onChange={(event) => setIsOnePdfPerImage(event.target.checked)} className="size-5" />
          {t('tools.images.onePerImage')}
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="jpg-add-images-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('tools.images.addMore')}
        </button>
        <button id="jpg-to-pdf-button" type="button" disabled={readyImages.length === 0 || !isEveryFileRead || progress !== null} onClick={() => void makePdf()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.images.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.images', { done: progress.done, total: progress.total })} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
      <PdfThumbnailGrid
        id="jpg-to-pdf-grid"
        label={t('tools.images.listLabel')}
        cards={cards}
        onReorder={moveFile}
        renderActions={(card, index) => (
          <>
            <button id={`jpg-earlier-${index + 1}`} type="button" aria-label={t('tools.grid.moveEarlier', { name: card.caption })} disabled={index === 0} onClick={() => moveFile(index, index - 1)} className={actionClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <button id={`jpg-later-${index + 1}`} type="button" aria-label={t('tools.grid.moveLater', { name: card.caption })} disabled={index === files.length - 1} onClick={() => moveFile(index, index + 1)} className={actionClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <button id={`jpg-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: card.caption })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={actionClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </>
        )}
      />
    </div>
  )
}
