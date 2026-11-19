// The batch image tools: compress, resize, crop, convert (and the focused pair pages), rotate and flip, watermark, and remove
// metadata. Each reads the chosen pictures once (useReadImages), shows the first one as a preview, and makes every picture in the
// image worker; several results come as one ZIP.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { decodeImage, extensionOf, readImageMetadata, stripMetadataLosslessly } from '../../formats/image/imageFiles'
import type { ToolProps } from '../registry'
import { baseNameOf, drawTextPicture, turnPicture } from '../pdf/PdfToolParts'
import type { StampPicture } from '../pdf/PdfToolParts'
import { IMAGE_MIME_TYPES, runImageTask } from './imageTasks'
import type { ImageFormat, ImageStep } from './imageTasks'
import { BeforeAfterSlider, ImageFileGrid, OutputFields, copySteps, useBatch, fieldClass, keptFormatOf, outputNameOf, previewAddressOf, runImageBatch, useReadImages } from './ImageToolParts'
import type { OutputChoice, ReadImage } from './ImageToolParts'

const ALL_FORMATS: ImageFormat[] = ['jpg', 'png', 'webp', 'avif']
type Readable = { file: File; picture: ImageBitmap; read: Extract<ReadImage, { picture: ImageBitmap }> }

function readablePictures(files: File[], readByFile: Map<File, ReadImage>): Readable[] {
  return files.flatMap((file) => {
    const read = readByFile.get(file)
    return read && 'picture' in read ? [{ file, picture: read.picture, read }] : []
  })
}

function ActionButton({ id, label, isDisabled, isRunning, onClick }: { id: string; label: string; isDisabled: boolean; isRunning: boolean; onClick: () => void }) {
  const { t } = useT()
  return (
    <div className="flex justify-center">
      <button id={id} type="button" disabled={isDisabled || isRunning} onClick={onClick} className="btn btn--primary press">
        {isRunning ? t('tools.working') : label}
      </button>
    </div>
  )
}

const zipNameOf = (files: File[], suffix: string) => `${baseNameOf(files[0]?.name ?? 'images')}-${suffix}.zip`
const formatOf = (choice: OutputChoice, fileName: string): ImageFormat => (choice === 'keep' ? keptFormatOf(fileName) : choice)

// ---------------------------------------------------------------- Compress

export function CompressImage({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const pictures = readablePictures(files, readByFile)
  const [format, setFormat] = useState<OutputChoice>('keep')
  const [quality, setQuality] = useState(75)
  const [preview, setPreview] = useState<{ beforeUrl: string; afterUrl: string; beforeSize: number; afterSize: number } | null>(null)
  const batch = useBatch(onResult)
  // The picture and file, not pictures[0]: readablePictures builds new objects on every render, which would rerun the effects.
  const firstPicture = pictures[0]?.picture
  const firstFile = pictures[0]?.file
  const previewUrlsRef = useRef<string[]>([])

  // The first picture compressed with the current settings, shown before and after, a moment after the settings stop changing.
  useEffect(() => {
    if (!firstPicture || !firstFile) return
    let isCurrent = true
    const timer = window.setTimeout(async () => {
      try {
        const outputFormat = formatOf(format, firstFile.name)
        const { images } = await runImageBatch([{ name: outputNameOf(firstFile.name, 'compressed', outputFormat), steps: [], output: { format: outputFormat, quality, optimisePng: true } }], [firstPicture], 'preview.zip', () => {})
        if (!isCurrent) return
        const afterUrl = URL.createObjectURL(new Blob([images[0].bytes as BlobPart], { type: IMAGE_MIME_TYPES[outputFormat] }))
        const beforeUrl = await previewAddressOf(firstPicture, 1600)
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
        previewUrlsRef.current = [beforeUrl, afterUrl]
        setPreview({ beforeUrl, afterUrl, beforeSize: firstFile.size, afterSize: images[0].bytes.length })
      } catch {
        // The preview stays as it was; the Compress button reports its own errors.
      }
    }, 400)
    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [firstPicture, firstFile, format, quality])
  useEffect(() => () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), [])

  function compressAll() {
    void batch.run(async (onProgress) => {
      const jobs = pictures.map(({ file }) => {
        const outputFormat = formatOf(format, file.name)
        return { name: outputNameOf(file.name, 'compressed', outputFormat), steps: [], output: { format: outputFormat, quality, optimisePng: true } }
      })
      return (await runImageBatch(jobs, pictures.map(({ picture }) => picture), zipNameOf(files, 'compressed'), onProgress)).file
    })
  }

  const savedPercent = preview ? Math.round((1 - preview.afterSize / preview.beforeSize) * 100) : 0
  return (
    <div id="compress-image-tool" className="space-y-5 text-start">
      <OutputFields idPrefix="compress-image" format={format} onFormatChange={setFormat} quality={quality} onQualityChange={setQuality} formats={ALL_FORMATS} withKeep />
      {preview && (
        <>
          <BeforeAfterSlider id="compress-image-compare" beforeUrl={preview.beforeUrl} afterUrl={preview.afterUrl} beforeLabel={t('tools.image.before')} afterLabel={t('tools.image.after')} />
          <p id="compress-image-saved" className="text-center font-medium" aria-live="polite">
            <bdi dir="ltr">{formatFileSize(preview.beforeSize)} → {formatFileSize(preview.afterSize)}</bdi>{' '}
            {t(savedPercent >= 0 ? 'tools.image.saved' : 'tools.image.larger', { percent: Math.abs(savedPercent) })}
          </p>
        </>
      )}
      <ActionButton id="compress-image-button" label={t('tools.image.compressButton', { count: pictures.length })} isDisabled={pictures.length === 0} isRunning={batch.isRunning} onClick={compressAll} />
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="compress-image-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Resize

type ResizeMode = 'pixels' | 'percent' | 'preset'
// Common sizes; passport photos at 300 dots per inch. Offices set their own rules, which the page asks visitors to check.
const PRESETS = [
  { id: 'instagram-square', width: 1080, height: 1080 },
  { id: 'instagram-portrait', width: 1080, height: 1350 },
  { id: 'instagram-story', width: 1080, height: 1920 },
  { id: 'whatsapp-profile', width: 500, height: 500 },
  { id: 'passport-us', width: 600, height: 600 },
  { id: 'passport-uk-eu', width: 413, height: 531 },
  { id: 'passport-saudi', width: 472, height: 709 },
  { id: 'passport-india', width: 413, height: 531 },
] as const

// The centred part of a picture with the target's proportions (cropping only what does not fit), as fractions.
function coverCrop(pictureWidth: number, pictureHeight: number, targetWidth: number, targetHeight: number): ImageStep {
  const pictureRatio = pictureWidth / pictureHeight
  const targetRatio = targetWidth / targetHeight
  const width = pictureRatio > targetRatio ? targetRatio / pictureRatio : 1
  const height = pictureRatio > targetRatio ? 1 : pictureRatio / targetRatio
  return { type: 'crop', x: (1 - width) / 2, y: (1 - height) / 2, width, height, isCircle: false }
}

export function ResizeImage({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const pictures = readablePictures(files, readByFile)
  const [mode, setMode] = useState<ResizeMode>('pixels')
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [isRatioKept, setIsRatioKept] = useState(true)
  const [percent, setPercent] = useState(50)
  const [presetId, setPresetId] = useState<(typeof PRESETS)[number]['id']>('instagram-square')
  const [format, setFormat] = useState<OutputChoice>('keep')
  const [quality, setQuality] = useState(90)
  const batch = useBatch(onResult)
  const first = pictures[0]
  const firstPicture = first?.picture

  // The fields start at the first picture's own size, once per picture, so an emptied field stays empty while typing.
  useEffect(() => {
    if (!firstPicture) return
    setWidth(firstPicture.width)
    setHeight(firstPicture.height)
  }, [firstPicture])

  function changeWidth(value: number) {
    setWidth(value)
    if (isRatioKept && first) setHeight(Math.round((value * first.picture.height) / first.picture.width))
  }
  function changeHeight(value: number) {
    setHeight(value)
    if (isRatioKept && first) setWidth(Math.round((value * first.picture.width) / first.picture.height))
  }

  // Every picture's steps: with the proportions kept, each fits inside width × height; a preset fills its exact size.
  function stepsFor(picture: ImageBitmap): ImageStep[] {
    if (mode === 'percent') return [{ type: 'resize', width: (picture.width * percent) / 100, height: (picture.height * percent) / 100 }]
    if (mode === 'preset') {
      const preset = PRESETS.find((candidate) => candidate.id === presetId)!
      return [coverCrop(picture.width, picture.height, preset.width, preset.height), { type: 'resize', width: preset.width, height: preset.height }]
    }
    if (!isRatioKept) return [{ type: 'resize', width, height }]
    const scale = Math.min(width / picture.width, height / picture.height)
    return [{ type: 'resize', width: picture.width * scale, height: picture.height * scale }]
  }

  function resizeAll() {
    void batch.run(async (onProgress) => {
      const jobs = pictures.map(({ file, picture }) => {
        const outputFormat = formatOf(format, file.name)
        return { name: outputNameOf(file.name, 'resized', outputFormat), steps: stepsFor(picture), output: { format: outputFormat, quality, optimisePng: false } }
      })
      return (await runImageBatch(jobs, pictures.map(({ picture }) => picture), zipNameOf(files, 'resized'), onProgress)).file
    })
  }

  const isValid = mode !== 'pixels' || (width > 0 && height > 0 && width <= 16384 && height <= 16384)
  return (
    <div id="resize-image-tool" className="space-y-5 text-start">
      <fieldset className="flex flex-wrap items-center justify-center gap-4">
        <legend className="sr-only">{t('tools.image.resize.mode')}</legend>
        {(['pixels', 'percent', 'preset'] as const).map((choice) => (
          <label key={choice} className="inline-flex min-h-11 items-center gap-2 font-medium">
            <input id={`resize-mode-${choice}-radio`} type="radio" name="resize-mode" checked={mode === choice} onChange={() => setMode(choice)} className="size-5" />
            {t(`tools.image.resize.mode.${choice}`)}
          </label>
        ))}
      </fieldset>
      {mode === 'pixels' && (
        <div className="flex flex-wrap items-end justify-center gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.image.resize.width')}
            <input id="resize-width-input" type="number" min="1" max="16384" dir="ltr" value={width || ''} onChange={(event) => changeWidth(Math.round(Number(event.target.value) || 0))} className={`${fieldClass} w-32`} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.image.resize.height')}
            <input id="resize-height-input" type="number" min="1" max="16384" dir="ltr" value={height || ''} onChange={(event) => changeHeight(Math.round(Number(event.target.value) || 0))} className={`${fieldClass} w-32`} />
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input id="resize-keep-ratio-checkbox" type="checkbox" checked={isRatioKept} onChange={(event) => setIsRatioKept(event.target.checked)} className="size-5" />
            {t('tools.image.resize.keepRatio')}
          </label>
        </div>
      )}
      {mode === 'percent' && (
        <label className="flex flex-col items-center gap-1 text-sm font-medium">
          {t('tools.image.resize.percent', { percent })}
          <input id="resize-percent-input" type="range" min="5" max="200" step="5" value={percent} onChange={(event) => setPercent(Number(event.target.value))} className="min-h-11 w-64" />
        </label>
      )}
      {mode === 'preset' && (
        <div className="flex flex-col items-center gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.image.resize.preset')}
            <select id="resize-preset-select" value={presetId} onChange={(event) => setPresetId(event.target.value as typeof presetId)} className={fieldClass}>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(`tools.image.preset.${preset.id}` as MessageKey)} ({preset.width} × {preset.height})
                </option>
              ))}
            </select>
          </label>
          {presetId.startsWith('passport') && <p id="resize-passport-note" className="max-w-md text-center text-sm text-ink-soft">{t('tools.image.resize.passportNote')}</p>}
        </div>
      )}
      <OutputFields idPrefix="resize-image" format={format} onFormatChange={setFormat} quality={quality} onQualityChange={setQuality} formats={ALL_FORMATS} withKeep />
      <ActionButton id="resize-image-button" label={t('tools.image.resizeButton', { count: pictures.length })} isDisabled={pictures.length === 0 || !isValid} isRunning={batch.isRunning} onClick={resizeAll} />
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="resize-image-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Crop

const CROP_RATIOS = [
  { id: 'free', ratio: 0 },
  { id: 'square', ratio: 1 },
  { id: '4-3', ratio: 4 / 3 },
  { id: '3-2', ratio: 3 / 2 },
  { id: '16-9', ratio: 16 / 9 },
  { id: '9-16', ratio: 9 / 16 },
  { id: 'passport', ratio: 35 / 45 },
  { id: 'circle', ratio: 1 },
] as const
type CropBox = { x: number; y: number; width: number; height: number }

// The largest centred box with this ratio (width / height, in pixels) inside a picture, as fractions.
function centredBox(pictureWidth: number, pictureHeight: number, ratio: number): CropBox {
  if (!ratio) return { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
  const pictureRatio = pictureWidth / pictureHeight
  const width = pictureRatio > ratio ? ratio / pictureRatio : 1
  const height = pictureRatio > ratio ? 1 : pictureRatio / ratio
  return { x: (1 - width * 0.9) / 2, y: (1 - height * 0.9) / 2, width: width * 0.9, height: height * 0.9 }
}

export function CropImage({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const pictures = readablePictures(files, readByFile)
  const [ratioId, setRatioId] = useState<(typeof CROP_RATIOS)[number]['id']>('free')
  const [box, setBox] = useState<CropBox>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
  const [format, setFormat] = useState<OutputChoice>('keep')
  const [quality, setQuality] = useState(90)
  const frameRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startBox: CropBox } | null>(null)
  const batch = useBatch(onResult)
  const first = pictures[0]
  const ratio = CROP_RATIOS.find((choice) => choice.id === ratioId)!.ratio
  const isCircle = ratioId === 'circle'

  const firstPicture = first?.picture

  useEffect(() => {
    if (firstPicture) setBox(centredBox(firstPicture.width, firstPicture.height, ratio))
  }, [firstPicture, ratio])
  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    element.style.left = `${box.x * 100}%`
    element.style.top = `${box.y * 100}%`
    element.style.width = `${box.width * 100}%`
    element.style.height = `${box.height * 100}%`
  }, [box])

  function startDrag(event: ReactPointerEvent, mode: 'move' | 'resize') {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, startBox: box }
  }
  // The box moved or resized by a share of the picture, kept inside it (drag and arrow keys).
  function changedBox(start: CropBox, mode: 'move' | 'resize', deltaX: number, deltaY: number, picture: ImageBitmap): CropBox {
    if (mode === 'move') return { ...start, x: Math.min(Math.max(start.x + deltaX, 0), 1 - start.width), y: Math.min(Math.max(start.y + deltaY, 0), 1 - start.height) }
    let width = Math.min(Math.max(start.width + deltaX, 0.05), 1 - start.x)
    let height = Math.min(Math.max(start.height + deltaY, 0.05), 1 - start.y)
    // A fixed ratio is kept in pixels, so the box's fractions follow the picture's own shape.
    if (ratio) {
      height = (width * picture.width) / ratio / picture.height
      if (start.y + height > 1) {
        height = 1 - start.y
        width = (height * picture.height * ratio) / picture.width
      }
    }
    return { ...start, width, height }
  }
  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    const frame = frameRef.current
    if (!drag || !frame || !firstPicture) return
    setBox(changedBox(drag.startBox, drag.mode, (event.clientX - drag.startX) / frame.clientWidth, (event.clientY - drag.startY) / frame.clientHeight, firstPicture))
  }
  // Arrow keys move the box by 1% of the picture; with Shift they resize it.
  function moveWithKeys(event: ReactKeyboardEvent) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }
    if (!steps[event.key] || !firstPicture) return
    event.preventDefault()
    setBox(changedBox(box, event.shiftKey ? 'resize' : 'move', steps[event.key][0], steps[event.key][1], firstPicture))
  }

  // The box applies to every picture; with a fixed ratio, other pictures get the largest centred box of that ratio.
  function cropAll() {
    void batch.run(async (onProgress) => {
      const jobs = pictures.map(({ file, picture }, index) => {
        const pictureBox = index === 0 || !ratio ? box : centredBox(picture.width, picture.height, ratio)
        const outputFormat = isCircle ? 'png' : formatOf(format, file.name)
        return { name: outputNameOf(file.name, 'cropped', outputFormat), steps: [{ type: 'crop', ...pictureBox, isCircle } as ImageStep], output: { format: outputFormat, quality, optimisePng: false } }
      })
      return (await runImageBatch(jobs, pictures.map(({ picture }) => picture), zipNameOf(files, 'cropped'), onProgress)).file
    })
  }

  const pixelSize = first ? `${Math.round(box.width * first.picture.width)} × ${Math.round(box.height * first.picture.height)} px` : ''
  return (
    <div id="crop-image-tool" className="space-y-5 text-start">
      <fieldset className="flex flex-wrap items-center justify-center gap-2">
        <legend className="sr-only">{t('tools.image.crop.ratio')}</legend>
        {CROP_RATIOS.map((choice) => (
          <button key={choice.id} id={`crop-ratio-${choice.id}-button`} type="button" aria-pressed={ratioId === choice.id} onClick={() => setRatioId(choice.id)} className="btn btn--quiet btn--compact press">
            {t(`tools.image.crop.ratio.${choice.id}` as MessageKey)}
          </button>
        ))}
      </fieldset>
      {first && (
        <div className="flex flex-col items-center gap-2">
          {/* The picture itself stays left to right on an Arabic page. */}
          <div ref={frameRef} dir="ltr" className="crop-frame" onPointerMove={moveDrag} onPointerUp={() => (dragRef.current = null)}>
            <img src={first.read.previewUrl} alt={first.file.name} className="crop-picture" draggable={false} />
            <div ref={boxRef} id="crop-box" className={`crop-box${isCircle ? ' is-circle' : ''}`} role="group" tabIndex={0} aria-label={t('tools.image.crop.box', { size: pixelSize })} aria-describedby="crop-keyboard-hint" onKeyDown={moveWithKeys} onPointerDown={(event) => startDrag(event, 'move')}>
              <span className="crop-handle" onPointerDown={(event) => startDrag(event, 'resize')} aria-hidden="true" />
            </div>
          </div>
          <p id="crop-size" className="text-sm text-ink-soft" dir="ltr">{pixelSize}</p>
          <p id="crop-keyboard-hint" className="sr-only">{t('tools.image.crop.keyboardHint')}</p>
          {pictures.length > 1 && <p className="max-w-md text-center text-sm text-ink-soft">{t('tools.image.crop.batchNote')}</p>}
        </div>
      )}
      {!isCircle && <OutputFields idPrefix="crop-image" format={format} onFormatChange={setFormat} quality={quality} onQualityChange={setQuality} formats={ALL_FORMATS} withKeep />}
      {isCircle && <p id="crop-circle-note" className="text-center text-sm text-ink-soft">{t('tools.image.crop.circleNote')}</p>}
      <ActionButton id="crop-image-button" label={t('tools.image.cropButton', { count: pictures.length })} isDisabled={pictures.length === 0} isRunning={batch.isRunning} onClick={cropAll} />
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="crop-image-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Convert, and the pair pages

const SVG_SIZES = [1000, 2000, 4000]

function ConvertImage({ files, onFilesChange, onResult, target, idPrefix = 'convert-image' }: ToolProps & { target?: ImageFormat; idPrefix?: string }) {
  const { t } = useT()
  const hasSvg = files.some((file) => extensionOf(file.name) === 'svg')
  const [svgLongSide, setSvgLongSide] = useState(2000)
  const readByFile = useReadImages(files, svgLongSide)
  const pictures = readablePictures(files, readByFile)
  const [format, setFormat] = useState<OutputChoice>(target ?? 'jpg')
  const [quality, setQuality] = useState(90)
  const batch = useBatch(onResult)
  const outputFormat = format === 'keep' ? 'jpg' : format

  function convertAll() {
    void batch.run(async (onProgress) => {
      const jobs = pictures.map(({ file }) => ({ name: outputNameOf(file.name, '', outputFormat), steps: [], output: { format: outputFormat, quality, optimisePng: false } }))
      return (await runImageBatch(jobs, pictures.map(({ picture }) => picture), zipNameOf(files, outputFormat), onProgress)).file
    })
  }

  return (
    <div id={`${idPrefix}-tool`} className="space-y-5 text-start">
      {target ? (
        outputFormat !== 'png' && (
          <label className="flex flex-col items-center gap-1 text-sm font-medium">
            {t('tools.image.quality', { quality })}
            <input id={`${idPrefix}-quality-input`} type="range" min="10" max="100" step="5" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="min-h-11 w-44" />
          </label>
        )
      ) : (
        <OutputFields idPrefix={idPrefix} format={format} onFormatChange={setFormat} quality={quality} onQualityChange={setQuality} formats={ALL_FORMATS} withKeep={false} />
      )}
      {hasSvg && (
        <label className="flex flex-col items-center gap-1 text-sm font-medium">
          {t('tools.image.convert.svgSize')}
          <select id={`${idPrefix}-svg-size-select`} value={svgLongSide} onChange={(event) => setSvgLongSide(Number(event.target.value))} className={fieldClass}>
            {SVG_SIZES.map((size) => (
              <option key={size} value={size}>
                {t('tools.image.convert.longSide', { size })}
              </option>
            ))}
          </select>
        </label>
      )}
      {outputFormat === 'jpg' && <p className="text-center text-sm text-ink-soft">{t('tools.image.convert.jpgBackground')}</p>}
      <ActionButton id={`${idPrefix}-button`} label={t('tools.image.convertButton', { count: pictures.length, format: outputFormat.toUpperCase() })} isDisabled={pictures.length === 0} isRunning={batch.isRunning} onClick={convertAll} />
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id={`${idPrefix}-grid`} files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

export { ConvertImage }
export const HeicToJpg = (props: ToolProps) => <ConvertImage {...props} target="jpg" idPrefix="heic-to-jpg" />
export const WebpToJpg = (props: ToolProps) => <ConvertImage {...props} target="jpg" idPrefix="webp-to-jpg" />
export const PngToJpg = (props: ToolProps) => <ConvertImage {...props} target="jpg" idPrefix="png-to-jpg" />
export const JpgToPng = (props: ToolProps) => <ConvertImage {...props} target="png" idPrefix="jpg-to-png" />
export const SvgToPng = (props: ToolProps) => <ConvertImage {...props} target="png" idPrefix="svg-to-png" />
export const ImageToWebp = (props: ToolProps) => <ConvertImage {...props} target="webp" idPrefix="image-to-webp" />

// ---------------------------------------------------------------- Rotate and flip

export function RotateImage({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const pictures = readablePictures(files, readByFile)
  const [quarterTurns, setQuarterTurns] = useState<0 | 1 | 2 | 3>(0)
  const [flipHorizontal, setFlipHorizontal] = useState(false)
  const [flipVertical, setFlipVertical] = useState(false)
  const [quality, setQuality] = useState(92)
  const previewRef = useRef<HTMLImageElement>(null)
  const batch = useBatch(onResult)
  const first = pictures[0]
  const turn = (by: number) => setQuarterTurns((current) => ((((current + by) % 4) + 4) % 4) as 0 | 1 | 2 | 3)

  useEffect(() => {
    if (previewRef.current) previewRef.current.style.transform = `rotate(${quarterTurns * 90}deg) scale(${flipHorizontal ? -1 : 1}, ${flipVertical ? -1 : 1})`
  }, [quarterTurns, flipHorizontal, flipVertical, first?.picture])

  function rotateAll() {
    void batch.run(async (onProgress) => {
      const jobs = pictures.map(({ file }) => {
        const outputFormat = keptFormatOf(file.name)
        return { name: outputNameOf(file.name, 'rotated', outputFormat), steps: [{ type: 'rotate', quarterTurns, flipHorizontal, flipVertical } as ImageStep], output: { format: outputFormat, quality, optimisePng: false } }
      })
      return (await runImageBatch(jobs, pictures.map(({ picture }) => picture), zipNameOf(files, 'rotated'), onProgress)).file
    })
  }

  const hasChange = quarterTurns !== 0 || flipHorizontal || flipVertical
  const buttons: [string, MessageKey, () => void, boolean][] = [
    ['rotate-left', 'tools.image.rotate.left', () => turn(-1), false],
    ['rotate-right', 'tools.image.rotate.right', () => turn(1), false],
    ['rotate-half', 'tools.image.rotate.half', () => turn(2), false],
    ['flip-horizontal', 'tools.image.rotate.flipHorizontal', () => setFlipHorizontal((isFlipped) => !isFlipped), flipHorizontal],
    ['flip-vertical', 'tools.image.rotate.flipVertical', () => setFlipVertical((isFlipped) => !isFlipped), flipVertical],
  ]
  return (
    <div id="rotate-image-tool" className="space-y-5 text-start">
      <div className="flex flex-wrap justify-center gap-2">
        {buttons.map(([id, labelKey, onClick, isPressed]) => (
          <button key={id} id={`image-${id}-button`} type="button" aria-pressed={id.startsWith('flip') ? isPressed : undefined} onClick={onClick} className="btn btn--quiet btn--compact press">
            {t(labelKey)}
          </button>
        ))}
      </div>
      {first && (
        <div className="rotate-preview" dir="ltr">
          <img ref={previewRef} src={first.read.previewUrl} alt={first.file.name} className="rotate-preview-picture" />
        </div>
      )}
      <label className="flex flex-col items-center gap-1 text-sm font-medium">
        {t('tools.image.quality', { quality })}
        <input id="rotate-image-quality-input" type="range" min="50" max="100" step="5" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="min-h-11 w-44" />
      </label>
      <ActionButton id="rotate-image-button" label={t('tools.image.rotateButton', { count: pictures.length })} isDisabled={pictures.length === 0 || !hasChange} isRunning={batch.isRunning} onClick={rotateAll} />
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="rotate-image-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Watermark

type WatermarkPlace = `${'top' | 'middle' | 'bottom'}-${'start' | 'center' | 'end'}` | 'tiled'
const PLACES: WatermarkPlace[] = ['top-start', 'top-center', 'top-end', 'middle-start', 'middle-center', 'middle-end', 'bottom-start', 'bottom-center', 'bottom-end']
const WATERMARK_COLORS: Record<string, string> = { white: '#ffffff', grey: '#808080', black: '#1f1f1f', red: '#c0392b' }
const EDGE_MARGIN = 0.03

// Where the watermark goes on one picture, as fractions; `widthShare` is its width as a share of the picture's width.
function watermarkSteps(mark: StampPicture & { bitmap: ImageBitmap }, picture: ImageBitmap, widthShare: number, place: WatermarkPlace, opacity: number): ImageStep[] {
  const width = widthShare
  const height = (widthShare * mark.height * picture.width) / (mark.width * picture.height)
  const overlay = (x: number, y: number): ImageStep => ({ type: 'overlay', picture: mark.bitmap, x, y, width, height, opacity })
  if (place === 'tiled') {
    const steps: ImageStep[] = []
    for (let row = 0, y = -height / 2; y < 1; row++, y += height * 2.4) for (let x = (row % 2) * width * 0.8 - width / 2; x < 1; x += width * 1.6) steps.push(overlay(x, y))
    return steps
  }
  const [vertical, horizontal] = place.split('-')
  const column = horizontal === 'start' ? 0 : horizontal === 'center' ? 1 : 2
  const row = vertical === 'top' ? 0 : vertical === 'middle' ? 1 : 2
  return [overlay(EDGE_MARGIN + (column * (1 - 2 * EDGE_MARGIN - width)) / 2, EDGE_MARGIN + (row * (1 - 2 * EDGE_MARGIN - height)) / 2)]
}

export function WatermarkImage({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const pictures = readablePictures(files, readByFile)
  const [isLogo, setIsLogo] = useState(false)
  // null until the visitor types, so the suggested text follows the page language.
  const [typedText, setTypedText] = useState<string | null>(null)
  const text = typedText ?? t('tools.image.watermark.defaultText')
  const [color, setColor] = useState('white')
  const [logo, setLogo] = useState<ImageBitmap | null>(null)
  const [sizePercent, setSizePercent] = useState(30)
  const [opacityPercent, setOpacityPercent] = useState(50)
  const [rotation, setRotation] = useState(0)
  const [place, setPlace] = useState<WatermarkPlace>('bottom-end')
  const [mark, setMark] = useState<(StampPicture & { bitmap: ImageBitmap }) | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const batch = useBatch(onResult)
  const firstPicture = pictures[0]?.picture

  useEffect(() => {
    let isCurrent = true
    if (!(isLogo ? logo : text.trim())) {
      setMark(null)
      return
    }
    void (async () => {
      const drawn = isLogo && logo ? turnPicture(logo, 600, rotation) : await drawTextPicture(text.trim(), { sizePoints: 40, color: WATERMARK_COLORS[color], fontWeight: 700, rotationDegrees: rotation })
      const bitmap = await createImageBitmap(drawn.canvas)
      if (!isCurrent) {
        bitmap.close()
        return
      }
      // The previous watermark picture is freed when a new one replaces it.
      setMark((previous) => {
        previous?.bitmap.close()
        return { ...drawn, bitmap }
      })
    })()
    return () => {
      isCurrent = false
    }
  }, [isLogo, logo, text, color, rotation])

  // The first picture with the watermark, drawn on the page as the worker will draw it.
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !firstPicture || !mark) return
    const scale = Math.min(1, 720 / firstPicture.width)
    canvas.width = Math.round(firstPicture.width * scale)
    canvas.height = Math.round(firstPicture.height * scale)
    const context = canvas.getContext('2d')!
    context.drawImage(firstPicture, 0, 0, canvas.width, canvas.height)
    for (const step of watermarkSteps(mark, firstPicture, sizePercent / 100, place, opacityPercent / 100)) {
      if (step.type !== 'overlay') continue
      context.globalAlpha = step.opacity
      context.drawImage(step.picture, step.x * canvas.width, step.y * canvas.height, step.width * canvas.width, step.height * canvas.height)
    }
    context.globalAlpha = 1
  }, [firstPicture, mark, sizePercent, place, opacityPercent])

  function watermarkAll() {
    if (!mark) return
    void batch.run(async (onProgress) => {
      const jobs = await Promise.all(
        pictures.map(async ({ file, picture }) => {
          const outputFormat = keptFormatOf(file.name)
          return { name: outputNameOf(file.name, 'watermarked', outputFormat), steps: await copySteps(watermarkSteps(mark, picture, sizePercent / 100, place, opacityPercent / 100)), output: { format: outputFormat, quality: 90, optimisePng: false } }
        }),
      )
      return (await runImageBatch(jobs, pictures.map(({ picture }) => picture), zipNameOf(files, 'watermarked'), onProgress)).file
    })
  }

  return (
    <div id="watermark-image-tool" className="space-y-5 text-start">
      <fieldset className="flex flex-wrap items-center justify-center gap-4">
        <legend className="sr-only">{t('tools.watermark.kind')}</legend>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="image-watermark-text-radio" type="radio" name="image-watermark-kind" checked={!isLogo} onChange={() => setIsLogo(false)} className="size-5" />
          {t('tools.watermark.text')}
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="image-watermark-logo-radio" type="radio" name="image-watermark-kind" checked={isLogo} onChange={() => setIsLogo(true)} className="size-5" />
          {t('tools.image.watermark.logo')}
        </label>
      </fieldset>
      <div className="flex flex-wrap items-end justify-center gap-4">
        {isLogo ? (
          <>
            <input ref={logoInputRef} id="image-watermark-logo-input" type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(event) => {
              const logoFile = event.target.files?.[0]
              // decodeImage reads every picture format, SVG included (createImageBitmap can't read an SVG file).
              if (logoFile) void decodeImage(logoFile).then(
                (decoded) => setLogo((previous) => {
                  previous?.close()
                  return decoded
                }),
                () => setLogo(null),
              )
              event.target.value = ''
            }} />
            <button id="image-watermark-choose-logo-button" type="button" onClick={() => logoInputRef.current?.click()} className="btn btn--quiet press">
              {logo ? t('tools.image.watermark.changeLogo') : t('tools.image.watermark.chooseLogo')}
            </button>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.watermark.textLabel')}
              <input id="image-watermark-text-input" type="text" dir="auto" value={text} onChange={(event) => setTypedText(event.target.value)} className={`${fieldClass} w-56`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.watermark.color')}
              <select id="image-watermark-color-select" value={color} onChange={(event) => setColor(event.target.value)} className={fieldClass}>
                {Object.keys(WATERMARK_COLORS).map((name) => (
                  <option key={name} value={name}>
                    {t(`tools.color.${name}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.image.watermark.size', { percent: sizePercent })}
          <input id="image-watermark-size-input" type="range" min="5" max="90" step="5" value={sizePercent} onChange={(event) => setSizePercent(Number(event.target.value))} className="min-h-11 w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.watermark.opacity', { percent: opacityPercent })}
          <input id="image-watermark-opacity-input" type="range" min="10" max="100" step="5" value={opacityPercent} onChange={(event) => setOpacityPercent(Number(event.target.value))} className="min-h-11 w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.watermark.rotation')}
          <select id="image-watermark-rotation-select" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} className={fieldClass}>
            {[0, 45, 90, -45].map((angle) => (
              <option key={angle} value={angle}>
                {t('tools.watermark.degrees', { angle })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col items-center gap-2">
        <legend className="mb-1 text-sm font-semibold">{t('tools.watermark.position')}</legend>
        {/* The grid shows the picture itself, so it stays left to right on an Arabic page. */}
        <div dir="ltr" className="grid w-max grid-cols-3 gap-1">
          {PLACES.map((cell) => (
            <button key={cell} id={`image-watermark-position-${cell}-button`} type="button" aria-pressed={place === cell} aria-label={t(`tools.watermark.cell.${cell}` as MessageKey)} onClick={() => setPlace(cell)} className={`size-11 rounded-md border-2 ${place === cell ? 'border-accent bg-accent/20' : 'border-rule bg-paper-raised'}`} />
          ))}
        </div>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="image-watermark-tiled-checkbox" type="checkbox" checked={place === 'tiled'} onChange={(event) => setPlace(event.target.checked ? 'tiled' : 'bottom-end')} className="size-5" />
          {t('tools.watermark.tiled')}
        </label>
      </fieldset>
      {firstPicture && mark && <canvas id="image-watermark-preview" ref={previewRef} role="img" aria-label={t('tools.image.previewLabel')} className="image-tool-preview" />}
      <ActionButton id="watermark-image-button" label={t('tools.image.watermarkButton', { count: pictures.length })} isDisabled={pictures.length === 0 || !mark} isRunning={batch.isRunning} onClick={watermarkAll} />
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="watermark-image-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Remove metadata

export function RemoveImageMetadata({ files, onFilesChange, onResult }: ToolProps) {
  const { locale, t, tp } = useT()
  const readByFile = useReadImages(files)
  const pictures = readablePictures(files, readByFile)
  const batch = useBatch(onResult)

  // Each picture without its metadata: copied without re-encoding where the format allows, otherwise drawn again (JPG, or PNG for
  // pictures that may be transparent). The copy is read back before it is offered.
  function removeAll() {
    void batch.run(async (onProgress) => {
      const made: { name: string; bytes: Uint8Array; type: string }[] = []
      for (const [position, { file, picture, read }] of pictures.entries()) {
        const extension = extensionOf(file.name)
        const stripped = stripMetadataLosslessly(new Uint8Array(await file.arrayBuffer()), read.metadata.orientation)
        if (stripped) {
          made.push({ name: `${baseNameOf(file.name)}-clean.${extension}`, bytes: stripped, type: file.type || IMAGE_MIME_TYPES[keptFormatOf(file.name)] })
        } else {
          const outputFormat = keptFormatOf(file.name)
          const { images } = await runImageBatch([{ name: outputNameOf(file.name, 'clean', outputFormat), steps: [], output: { format: outputFormat, quality: 92, optimisePng: false } }], [picture], 'clean.zip', () => {})
          made.push({ name: images[0].name, bytes: images[0].bytes, type: IMAGE_MIME_TYPES[outputFormat] })
        }
        const check = await readImageMetadata(new Blob([made[made.length - 1].bytes as BlobPart], { type: made[made.length - 1].type }))
        if (check.latitude !== undefined || check.camera || check.takenAt) throw new Error('Metadata is still there')
        onProgress(position + 1, pictures.length)
      }
      if (made.length === 1) return new File([made[0].bytes as BlobPart], made[0].name, { type: made[0].type })
      const response = await runImageTask({ type: 'zip', files: made.map(({ name, bytes }) => ({ name, bytes })) })
      if (response.status !== 'ok' || !response.zip) throw new Error('zip failed')
      return new File([response.zip as BlobPart], `${baseNameOf(files[0].name)}-clean.zip`, { type: 'application/zip' })
    })
  }

  const dateFormat = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div id="remove-image-metadata-tool" className="space-y-5 text-start">
      <ul id="metadata-findings" className="space-y-3">
        {pictures.map(({ file, read }, index) => {
          const { metadata } = read
          const hasGps = metadata.latitude !== undefined && metadata.longitude !== undefined
          return (
            <li key={`${file.name}-${index}`} id={`metadata-finding-${index + 1}`} className="rounded-[16px] border-2 border-rule bg-paper-raised p-4">
              <p className="font-semibold">
                <bdi dir="ltr">{file.name}</bdi>
              </p>
              {hasGps && (
                <p id={`metadata-gps-${index + 1}`} className="mt-2 font-semibold text-danger" role="note">
                  {t('tools.image.metadata.gpsFound')} <bdi dir="ltr" className="font-mono text-sm">({metadata.latitude!.toFixed(4)}, {metadata.longitude!.toFixed(4)})</bdi>
                </p>
              )}
              <ul className="mt-2 list-disc space-y-1 ps-6 text-sm">
                {metadata.camera && <li>{t('tools.image.metadata.camera', { camera: metadata.camera })}</li>}
                {metadata.takenAt && <li>{t('tools.image.metadata.takenAt', { date: dateFormat.format(metadata.takenAt) })}</li>}
                {metadata.software && <li>{t('tools.image.metadata.software', { software: metadata.software })}</li>}
                {metadata.author && <li>{t('tools.image.metadata.author', { author: metadata.author })}</li>}
                {metadata.fieldCount > 0 && <li>{tp('tools.image.metadata.fields', metadata.fieldCount)}</li>}
              </ul>
              {metadata.fieldCount === 0 && <p className="mt-2 text-sm text-ink-soft">{t('tools.image.metadata.none')}</p>}
            </li>
          )
        })}
      </ul>
      <ActionButton id="remove-image-metadata-button" label={t('tools.image.metadata.button', { count: pictures.length })} isDisabled={pictures.length === 0} isRunning={batch.isRunning} onClick={removeAll} />
      <p className="text-center text-sm text-ink-soft">{t('tools.image.metadata.note')}</p>
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="remove-image-metadata-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}
