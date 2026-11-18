// Shared by the image tools: reading the chosen pictures (pixels, a thumbnail and their metadata), the picture grid (the PDF tools'
// thumbnail grid with image cards), the output format and quality fields, the batch run (one picture or a ZIP) and the
// before/after comparison slider.
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '../../i18n'
import { Notice } from '../../components/Messages'
import { formatFileSize } from '../../useFileIntake'
import { ImageReadError, decodeImage, extensionOf, readImageMetadata } from '../../formats/image/imageFiles'
import type { ImageMetadata } from '../../formats/image/imageFiles'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, zipResultFile } from '../pdf/PdfToolParts'
import type { GridCard } from '../pdf/PdfToolParts'
import { IMAGE_MIME_TYPES, runImageTask } from './imageTasks'
import type { ImageFormat, ImageJob, ImageStep, MadeImage } from './imageTasks'

const THUMBNAIL_LONG_SIDE = 720
export const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
export type ReadImage = { picture: ImageBitmap; previewUrl: string; metadata: ImageMetadata } | { problem: 'unreadable' | 'heic' }

// A small copy of a picture as an address the page can show (thumbnails and previews).
export async function previewAddressOf(picture: ImageBitmap | HTMLCanvasElement, longSide = THUMBNAIL_LONG_SIDE) {
  const scale = Math.min(1, longSide / Math.max(picture.width, picture.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(picture.width * scale))
  canvas.height = Math.max(1, Math.round(picture.height * scale))
  canvas.getContext('2d')!.drawImage(picture, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  return blob ? URL.createObjectURL(blob) : ''
}

// Every chosen picture read once, in the order chosen; thumbnails are freed when the tool closes.
export function useReadImages(files: File[], svgLongSide?: number) {
  const [readByFile, setReadByFile] = useState(new Map<File, ReadImage>())
  const readRef = useRef(readByFile)
  useEffect(() => {
    readRef.current = readByFile
  }, [readByFile])
  useEffect(() => {
    let isCurrent = true
    for (const file of files) {
      if (readRef.current.has(file)) continue
      void (async (): Promise<ReadImage> => {
        try {
          const picture = await decodeImage(file, svgLongSide)
          return { picture, previewUrl: await previewAddressOf(picture), metadata: await readImageMetadata(file) }
        } catch (error) {
          return { problem: error instanceof ImageReadError ? error.reason : 'unreadable' }
        }
      })().then((read) => {
        if (isCurrent) setReadByFile((previous) => new Map(previous).set(file, read))
      })
    }
    return () => {
      isCurrent = false
    }
  }, [files, svgLongSide])
  useEffect(
    () => () => {
      for (const read of readRef.current.values()) if ('previewUrl' in read) URL.revokeObjectURL(read.previewUrl)
    },
    [],
  )
  return readByFile
}

// The chosen pictures as cards, with buttons to move and remove them.
export function ImageFileGrid({ id, files, readByFile, onFilesChange }: { id: string; files: File[]; readByFile: Map<File, ReadImage>; onFilesChange: (files: File[]) => void }) {
  const { t } = useT()
  const timesSeen = new Map<File, number>()
  const cards: GridCard[] = files.map((file) => {
    timesSeen.set(file, (timesSeen.get(file) ?? 0) + 1)
    const key = `${file.name}-${file.size}-${file.lastModified}-${timesSeen.get(file)}`
    const read = readByFile.get(file)
    const caption = `${file.name} · ${formatFileSize(file.size)}`
    if (!read) return { key, caption, problem: t('tools.pdf.reading') }
    if ('problem' in read) return { key, caption, problem: t(read.problem === 'heic' ? 'tools.image.heicFailed' : 'tools.image.unreadable') }
    return { key, caption, imageUrl: read.previewUrl }
  })
  function moveFile(fromIndex: number, toIndex: number) {
    const reorderedFiles = [...files]
    const [movedFile] = reorderedFiles.splice(fromIndex, 1)
    reorderedFiles.splice(toIndex, 0, movedFile)
    onFilesChange(reorderedFiles)
  }
  const actionClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  return (
    <PdfThumbnailGrid
      id={id}
      label={t('tools.image.listLabel')}
      cards={cards}
      onReorder={files.length > 1 ? moveFile : undefined}
      renderActions={(card, index) => (
        <button id={`${id}-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: card.caption })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={actionClass}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      )}
    />
  )
}

// The format a picture keeps when "Keep the format" is chosen: its own, when it can be written; SVG, GIF and BMP become PNG
// (they often have transparency or flat colours), HEIC and TIFF become JPG.
export function keptFormatOf(fileName: string): ImageFormat {
  const extension = extensionOf(fileName)
  if (extension === 'jpg' || extension === 'jpeg' || extension === 'heic' || extension === 'heif' || extension === 'tif' || extension === 'tiff') return 'jpg'
  if (extension === 'webp' || extension === 'avif') return extension
  return 'png'
}

export const outputNameOf = (fileName: string, suffix: string, format: ImageFormat) => `${baseNameOf(fileName)}${suffix ? `-${suffix}` : ''}.${format}`

export type OutputChoice = ImageFormat | 'keep'
export function OutputFields({ idPrefix, format, onFormatChange, quality, onQualityChange, formats, withKeep }: { idPrefix: string; format: OutputChoice; onFormatChange: (format: OutputChoice) => void; quality: number; onQualityChange: (quality: number) => void; formats: ImageFormat[]; withKeep: boolean }) {
  const { t } = useT()
  const isLossy = format !== 'png'
  return (
    <div className="flex flex-wrap items-end justify-center gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('tools.image.format')}
        <select id={`${idPrefix}-format-select`} value={format} onChange={(event) => onFormatChange(event.target.value as OutputChoice)} className={fieldClass}>
          {withKeep && <option value="keep">{t('tools.image.keepFormat')}</option>}
          {formats.map((choice) => (
            <option key={choice} value={choice}>
              {choice.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      {isLossy && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.image.quality', { quality })}
          <input id={`${idPrefix}-quality-input`} type="range" min="10" max="100" step="5" value={quality} onChange={(event) => onQualityChange(Number(event.target.value))} className="min-h-11 w-44" />
        </label>
      )}
    </div>
  )
}

// One job per readable picture through the worker; a single result is a picture, several are a ZIP. Each job gets a copy of the
// picture, because the worker takes ownership of what it is sent.
export async function runImageBatch(jobs: Omit<ImageJob, 'picture'>[], pictures: ImageBitmap[], zipName: string, onProgress: (done: number, total: number) => void): Promise<{ file: File; images: MadeImage[] }> {
  const copied = await Promise.all(pictures.map((picture) => createImageBitmap(picture)))
  const response = await runImageTask({ type: 'process', jobs: jobs.map((job, index) => ({ ...job, picture: copied[index] })), zipName: jobs.length > 1 ? zipName : null }, onProgress)
  if (response.status !== 'ok' || !response.images) throw new Error('The pictures could not be made')
  if (response.zip) return { file: zipResultFile(response.zip, zipName), images: response.images }
  const [image] = response.images
  const format = jobs[0].output.format
  return { file: new File([image.bytes as BlobPart], image.name, { type: IMAGE_MIME_TYPES[format] }), images: response.images }
}

// The steps' overlays are copied for every job (the worker takes ownership of what it is sent).
export async function copySteps(steps: ImageStep[]) {
  return Promise.all(steps.map(async (step) => (step.type === 'overlay' ? { ...step, picture: await createImageBitmap(step.picture) } : step)))
}

// Two pictures one over the other, with a handle to compare them: before on the start side, after on the end side.
export function BeforeAfterSlider({ id, beforeUrl, afterUrl, beforeLabel, afterLabel }: { id: string; beforeUrl: string; afterUrl: string; beforeLabel: string; afterLabel: string }) {
  const { t } = useT()
  const [split, setSplit] = useState(50)
  const frameRef = useRef<HTMLDivElement>(null)
  const afterRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (afterRef.current) afterRef.current.style.clipPath = `inset(0 0 0 ${split}%)`
    if (lineRef.current) lineRef.current.style.left = `${split}%`
  }, [split])
  function moveTo(event: ReactPointerEvent) {
    const box = frameRef.current!.getBoundingClientRect()
    setSplit(Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)))
  }
  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        id={id}
        dir="ltr"
        className="before-after"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          moveTo(event)
        }}
        onPointerMove={(event) => event.buttons === 1 && moveTo(event)}
      >
        <img src={beforeUrl} alt={beforeLabel} className="before-after-picture" draggable={false} />
        <div ref={afterRef} className="before-after-after">
          <img src={afterUrl} alt={afterLabel} className="before-after-picture" draggable={false} />
        </div>
        <span className="before-after-line" ref={lineRef} aria-hidden="true" />
        <span className="before-after-tag before-after-tag-before">{beforeLabel}</span>
        <span className="before-after-tag before-after-tag-after">{afterLabel}</span>
      </div>
      <label className="flex items-center justify-center gap-3 text-sm">
        <span className="sr-only">{t('tools.image.compareLabel')}</span>
        <input id={`${id}-range`} type="range" min="0" max="100" value={Math.round(split)} onChange={(event) => setSplit(Number(event.target.value))} className="w-64 min-h-11" aria-label={t('tools.image.compareLabel')} />
      </label>
    </div>
  )
}

// Progress, the error line and the run itself, the same in every image tool.
export function useBatch(onResult: (file: File) => void) {
  const { t } = useT()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  async function run(make: (onProgress: (done: number, total: number) => void) => Promise<File>) {
    setError('')
    setProgress({ done: 0, total: 0 })
    try {
      onResult(await make((done, total) => setProgress({ done, total })))
    } catch {
      setError(t('tools.image.failed'))
    }
    setProgress(null)
  }
  const progressBar = progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.images', { done: progress.done, total: progress.total })} />
  const errorLine = <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
  return { isRunning: progress !== null, run, progressBar, errorLine }
}
