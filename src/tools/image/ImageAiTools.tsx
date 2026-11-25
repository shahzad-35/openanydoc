// The image tools that run a small neural network on the device: Blur face (UltraFace, MIT), Remove background (U²-Net-p for any
// subject and MODNet for people, Apache-2.0) and Upscale image (Swin2SR, Apache-2.0). They run with onnxruntime-web (MIT). The
// runtime and the model files are on this site (/models/), read on first use and then kept by the browser; the picture never
// leaves the device (DECISIONS.md, Batch 6).
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InferenceSession, Tensor } from 'onnxruntime-web'
import { useT } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { ProgressBar } from '../pdf/PdfToolParts'
import { BeforeAfterSlider, ImageFileGrid, fieldClass, keptFormatOf, outputNameOf, useBatch, useReadImages } from './ImageToolParts'
import { runImageTask } from './imageTasks'

type Box = { x: number; y: number; width: number; height: number }

// onnxruntime's WebAssembly is emitted by Vite as a hashed file of this site (the bundle names it by its own address), so it is read
// from the site like any other file. One thread: the site is not cross-origin isolated, so worker threads can't share memory.
const sessionsByModel = new Map<string, Promise<InferenceSession>>()

async function loadOnnx() {
  const ort = await import('onnxruntime-web/wasm')
  ort.env.wasm.numThreads = 1
  // onnxruntime warns about harmless details of the models (weights kept as inputs); only errors reach the console.
  ort.env.logLevel = 'error'
  return ort
}

// A model loaded once per page visit.
function loadModel(modelFile: string) {
  let session = sessionsByModel.get(modelFile)
  if (!session) {
    session = loadOnnx().then((ort) => ort.InferenceSession.create(`/models/${modelFile}`, { executionProviders: ['wasm'], logSeverityLevel: 3 }))
    session.catch(() => sessionsByModel.delete(modelFile))
    sessionsByModel.set(modelFile, session)
  }
  return session
}

// A picture (or a part of it) drawn at `width` × `height` as a float tensor in NCHW order, each channel turned by `normalize`.
async function pictureToTensor(picture: CanvasImageSource, region: Box, width: number, height: number, normalize: (value: number, channel: number) => number): Promise<Tensor> {
  const ort = await loadOnnx()
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  context.drawImage(picture, region.x, region.y, region.width, region.height, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const data = new Float32Array(3 * width * height)
  for (let pixel = 0; pixel < width * height; pixel++) {
    for (let channel = 0; channel < 3; channel++) data[channel * width * height + pixel] = normalize(pixels[pixel * 4 + channel], channel)
  }
  return new ort.Tensor('float32', data, [1, 3, height, width])
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const outputTypeOf = (fileName: string) => ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/png' })[keptFormatOf(fileName)] ?? 'image/jpeg'
const extensionOfType = (type: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[type] as 'jpg' | 'png' | 'webp'

async function canvasToFile(canvas: HTMLCanvasElement | OffscreenCanvas, name: string, type: string) {
  const blob = canvas instanceof OffscreenCanvas ? await canvas.convertToBlob({ type, quality: 0.92 }) : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92))
  if (!blob) throw new Error('The picture could not be made')
  // Some browsers' canvases can't write WebP and quietly give a PNG instead: the image worker's own encoder makes the WebP then.
  if (type === 'image/webp' && blob.type !== 'image/webp') {
    const job = { name, picture: await createImageBitmap(canvas), steps: [], output: { format: 'webp' as const, quality: 92, optimisePng: false } }
    const answer = await runImageTask({ type: 'process', jobs: [job], zipName: null })
    const made = answer.status === 'ok' ? answer.images?.[0] : undefined
    if (!made) throw new Error('The picture could not be made')
    return new File([made.bytes as BlobPart], name, { type })
  }
  return new File([blob], name, { type })
}

// ---------------------------------------------------------------- Blur face

const FACE_MODEL = 'ultraface-rfb-320.onnx'
const FACE_INPUT = { width: 320, height: 240 }
const FACE_SCORE = 0.7
const OVERLAP_LIMIT = 0.3

const overlapOf = (first: Box, second: Box) => {
  const width = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
  const height = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)
  if (width <= 0 || height <= 0) return 0
  const shared = width * height
  return shared / (first.width * first.height + second.width * second.height - shared)
}

// Faces in a picture, in its pixels. UltraFace looks at a 320 × 240 copy, which misses small faces in a large photo, so a large
// photo is also looked at in four overlapping quarters; the same face found twice is kept once.
async function findFaces(picture: ImageBitmap) {
  const session = await loadModel(FACE_MODEL)
  const regions: Box[] = [{ x: 0, y: 0, width: picture.width, height: picture.height }]
  if (Math.max(picture.width, picture.height) > 900) {
    const [quarterWidth, quarterHeight] = [picture.width * 0.55, picture.height * 0.55]
    for (const [x, y] of [[0, 0], [picture.width - quarterWidth, 0], [0, picture.height - quarterHeight], [picture.width - quarterWidth, picture.height - quarterHeight]]) regions.push({ x, y, width: quarterWidth, height: quarterHeight })
  }
  const found: (Box & { score: number })[] = []
  for (const region of regions) {
    const input = await pictureToTensor(picture, region, FACE_INPUT.width, FACE_INPUT.height, (value) => (value - 127) / 128)
    const output = await session.run({ [session.inputNames[0]]: input })
    const scores = output.scores.data as Float32Array
    const boxes = output.boxes.data as Float32Array
    for (let candidate = 0; candidate < scores.length / 2; candidate++) {
      const score = scores[candidate * 2 + 1]
      if (score < FACE_SCORE) continue
      const [left, top, right, bottom] = boxes.slice(candidate * 4, candidate * 4 + 4)
      found.push({ x: region.x + left * region.width, y: region.y + top * region.height, width: (right - left) * region.width, height: (bottom - top) * region.height, score })
    }
    await nextFrame()
  }
  const kept: Box[] = []
  for (const face of found.sort((first, second) => second.score - first.score)) if (!kept.some((other) => overlapOf(face, other) > OVERLAP_LIMIT)) kept.push(face)
  return kept
}

type BlurStyle = 'blur' | 'pixelate'

// Each area is covered from a little outside its box (hair, chin), as an oval: blurred, or drawn in large squares.
function hideAreas(picture: ImageBitmap, areas: Box[], style: BlurStyle, strength: number) {
  const canvas = document.createElement('canvas')
  canvas.width = picture.width
  canvas.height = picture.height
  const context = canvas.getContext('2d')!
  context.drawImage(picture, 0, 0)
  for (const area of areas) {
    const grown = { x: area.x - area.width * 0.12, y: area.y - area.height * 0.18, width: area.width * 1.24, height: area.height * 1.3 }
    context.save()
    context.beginPath()
    context.ellipse(grown.x + grown.width / 2, grown.y + grown.height / 2, grown.width / 2, grown.height / 2, 0, 0, Math.PI * 2)
    context.clip()
    if (style === 'blur') {
      context.filter = `blur(${Math.max(4, (grown.width * strength) / 40)}px)`
      context.drawImage(picture, 0, 0)
    } else {
      const block = Math.max(6, (grown.width * strength) / 60)
      const small = document.createElement('canvas')
      small.width = Math.max(1, Math.round(grown.width / block))
      small.height = Math.max(1, Math.round(grown.height / block))
      small.getContext('2d')!.drawImage(picture, grown.x, grown.y, grown.width, grown.height, 0, 0, small.width, small.height)
      context.imageSmoothingEnabled = false
      context.drawImage(small, grown.x, grown.y, grown.width, grown.height)
    }
    context.restore()
  }
  return canvas
}

export function BlurFace({ files, onFilesChange, onResult }: ToolProps) {
  const { t, tp } = useT()
  const readByFile = useReadImages(files)
  const read = files[0] ? readByFile.get(files[0]) : undefined
  const picture = read && 'picture' in read ? read.picture : null
  const [areas, setAreas] = useState<(Box & { isHidden: boolean; isAdded: boolean })[]>([])
  const [findState, setFindState] = useState<'idle' | 'finding' | 'found' | 'failed'>('idle')
  const [style, setStyle] = useState<BlurStyle>('blur')
  const [strength, setStrength] = useState(6)
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; box: Box } | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const batch = useBatch(onResult)

  useEffect(() => {
    if (!picture) return
    let isCurrent = true
    setAreas([])
    setFindState('finding')
    findFaces(picture).then(
      (faces) => {
        if (!isCurrent) return
        setAreas(faces.map((face) => ({ ...face, isHidden: true, isAdded: false })))
        setFindState('found')
      },
      () => isCurrent && setFindState('failed'),
    )
    return () => {
      isCurrent = false
    }
  }, [picture])

  // The preview shows the picture as it will be saved.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!picture || !canvas) return
    const preview = hideAreas(picture, areas.filter((area) => area.isHidden), style, strength)
    canvas.width = preview.width
    canvas.height = preview.height
    canvas.getContext('2d')!.drawImage(preview, 0, 0)
  }, [picture, areas, style, strength])

  // A point on the preview in the picture's pixels.
  function picturePointAt(event: ReactPointerEvent) {
    const frame = frameRef.current!.getBoundingClientRect()
    return { x: ((event.clientX - frame.left) / frame.width) * picture!.width, y: ((event.clientY - frame.top) / frame.height) * picture!.height }
  }

  function saveBlurred() {
    if (!picture || !files[0]) return
    const type = outputTypeOf(files[0].name)
    void batch.run(async () => canvasToFile(hideAreas(picture, areas.filter((area) => area.isHidden), style, strength), outputNameOf(files[0].name, 'blurred', extensionOfType(type)), type))
  }

  const hiddenCount = areas.filter((area) => area.isHidden).length
  return (
    <div id="blur-face-tool" className="space-y-4 text-start">
      <p className="text-center text-sm text-ink-soft">{t('tools.blurFace.hint')}</p>
      <p id="blur-face-status" aria-live="polite" className="text-center text-sm font-medium">
        {findState === 'finding' ? t('tools.ai.loadingModel') : findState === 'failed' ? t('tools.ai.modelFailed') : findState === 'found' ? tp('tools.blurFace.found', areas.filter((area) => !area.isAdded).length) : ''}
      </p>
      {picture && (
        <div className="flex flex-col items-center gap-2">
          {/* The picture stays left to right on an Arabic page. */}
          <div
            ref={frameRef}
            dir="ltr"
            className="blur-face-frame"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button')) return
              event.currentTarget.setPointerCapture(event.pointerId)
              const point = picturePointAt(event)
              setDrawing({ startX: point.x, startY: point.y, box: { x: point.x, y: point.y, width: 0, height: 0 } })
            }}
            onPointerMove={(event) => {
              if (!drawing) return
              const point = picturePointAt(event)
              setDrawing({ ...drawing, box: { x: Math.min(drawing.startX, point.x), y: Math.min(drawing.startY, point.y), width: Math.abs(point.x - drawing.startX), height: Math.abs(point.y - drawing.startY) } })
            }}
            onPointerUp={() => {
              if (drawing && drawing.box.width > 8 && drawing.box.height > 8) setAreas([...areas, { ...drawing.box, isHidden: true, isAdded: true }])
              setDrawing(null)
            }}
          >
            <canvas ref={canvasRef} id="blur-face-preview" role="img" aria-label={t('tools.blurFace.previewLabel')} className="blur-face-picture" />
            {[...areas, ...(drawing ? [{ ...drawing.box, isHidden: true, isAdded: true }] : [])].map((area, index) => (
              <button
                key={index}
                id={`blur-face-area-${index + 1}`}
                type="button"
                aria-pressed={area.isHidden}
                aria-label={t(area.isHidden ? 'tools.blurFace.areaHidden' : 'tools.blurFace.areaShown', { number: index + 1 })}
                className="blur-face-area"
                style={{ left: `${(area.x / picture.width) * 100}%`, top: `${(area.y / picture.height) * 100}%`, width: `${(area.width / picture.width) * 100}%`, height: `${(area.height / picture.height) * 100}%` }}
                onClick={() => index < areas.length && setAreas(areas.map((other, otherIndex) => (otherIndex === index ? { ...other, isHidden: !other.isHidden } : other)))}
              />
            ))}
          </div>
          <p className="max-w-md text-center text-sm text-ink-soft">{t('tools.blurFace.areasHint')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.blurFace.style')}
          <select id="blur-face-style-select" value={style} onChange={(event) => setStyle(event.target.value as BlurStyle)} className={fieldClass}>
            <option value="blur">{t('tools.blurFace.blur')}</option>
            <option value="pixelate">{t('tools.blurFace.pixelate')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.blurFace.strength', { strength })}
          <input id="blur-face-strength-input" type="range" min="2" max="12" value={strength} onChange={(event) => setStrength(Number(event.target.value))} className="min-h-11 w-44" />
        </label>
        <button id="blur-face-button" type="button" disabled={!picture || hiddenCount === 0 || batch.isRunning} onClick={saveBlurred} className="btn btn--primary press">
          {batch.isRunning ? t('tools.working') : tp('tools.blurFace.button', hiddenCount)}
        </button>
      </div>
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="blur-face-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Remove background

type Subject = 'person' | 'object'
type Backdrop = 'transparent' | 'white'
const OBJECT_MODEL = { file: 'u2netp.onnx', size: 320 }
const PERSON_MODEL = { file: 'modnet-quantized.onnx', shortSide: 512 }
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_SPREAD = [0.229, 0.224, 0.225]

// How opaque each pixel of the picture is, from 0 (background) to 1 (subject), as a canvas the picture's size whose red channel is
// the opacity. U²-Net-p looks at a 320 × 320 copy (any subject); MODNet at a copy about 512 on its short side, a multiple of 32
// each way (people).
async function findSubjectMask(picture: ImageBitmap, subject: Subject) {
  const whole = { x: 0, y: 0, width: picture.width, height: picture.height }
  let maskWidth: number
  let maskHeight: number
  let opacity: Float32Array
  if (subject === 'object') {
    const session = await loadModel(OBJECT_MODEL.file)
    const input = await pictureToTensor(picture, whole, OBJECT_MODEL.size, OBJECT_MODEL.size, (value, channel) => (value / 255 - IMAGENET_MEAN[channel]) / IMAGENET_SPREAD[channel])
    const output = await session.run({ [session.inputNames[0]]: input })
    opacity = output[session.outputNames[0]].data as Float32Array
    ;[maskWidth, maskHeight] = [OBJECT_MODEL.size, OBJECT_MODEL.size]
    // U²-Net's map is stretched to the full range, as its authors do.
    let [lowest, highest] = [Infinity, -Infinity]
    for (const value of opacity) [lowest, highest] = [Math.min(lowest, value), Math.max(highest, value)]
    opacity = opacity.map((value) => (value - lowest) / (highest - lowest || 1))
  } else {
    const session = await loadModel(PERSON_MODEL.file)
    const scale = PERSON_MODEL.shortSide / Math.min(picture.width, picture.height)
    ;[maskWidth, maskHeight] = [Math.max(32, Math.round((picture.width * scale) / 32) * 32), Math.max(32, Math.round((picture.height * scale) / 32) * 32)]
    const input = await pictureToTensor(picture, whole, maskWidth, maskHeight, (value) => value / 127.5 - 1)
    const output = await session.run({ [session.inputNames[0]]: input })
    opacity = output[session.outputNames[0]].data as Float32Array
  }
  const small = new OffscreenCanvas(maskWidth, maskHeight)
  const smallContext = small.getContext('2d')!
  const image = smallContext.createImageData(maskWidth, maskHeight)
  for (let pixel = 0; pixel < maskWidth * maskHeight; pixel++) {
    image.data[pixel * 4] = Math.round(Math.min(Math.max(opacity[pixel], 0), 1) * 255)
    image.data[pixel * 4 + 3] = 255
  }
  smallContext.putImageData(image, 0, 0)
  const mask = new OffscreenCanvas(picture.width, picture.height)
  const maskContext = mask.getContext('2d')!
  maskContext.imageSmoothingQuality = 'high'
  maskContext.drawImage(small, 0, 0, picture.width, picture.height)
  return mask
}

function cutOut(picture: ImageBitmap, mask: OffscreenCanvas, backdrop: Backdrop) {
  const canvas = document.createElement('canvas')
  canvas.width = picture.width
  canvas.height = picture.height
  const context = canvas.getContext('2d')!
  context.drawImage(picture, 0, 0)
  const pixels = context.getImageData(0, 0, picture.width, picture.height)
  const opacity = mask.getContext('2d')!.getImageData(0, 0, picture.width, picture.height).data
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const alpha = opacity[offset] / 255
    if (backdrop === 'white') for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = pixels.data[offset + channel] * alpha + 255 * (1 - alpha)
    else pixels.data[offset + 3] = opacity[offset]
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}

export function RemoveBackground({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const read = files[0] ? readByFile.get(files[0]) : undefined
  const picture = read && 'picture' in read ? read.picture : null
  const [subject, setSubject] = useState<Subject>('object')
  const [backdrop, setBackdrop] = useState<Backdrop>('transparent')
  const [mask, setMask] = useState<{ picture: ImageBitmap; subject: Subject; mask: OffscreenCanvas } | null>(null)
  const [maskState, setMaskState] = useState<'idle' | 'working' | 'failed'>('idle')
  const [previewUrl, setPreviewUrl] = useState('')
  const batch = useBatch(onResult)
  const currentMask = mask && mask.picture === picture && mask.subject === subject ? mask.mask : null

  useEffect(() => {
    if (!picture) return
    let isCurrent = true
    setMaskState('working')
    findSubjectMask(picture, subject).then(
      (found) => {
        if (!isCurrent) return
        setMask({ picture, subject, mask: found })
        setMaskState('idle')
      },
      () => isCurrent && setMaskState('failed'),
    )
    return () => {
      isCurrent = false
    }
  }, [picture, subject])

  useEffect(() => {
    if (!picture || !currentMask) return
    let isCurrent = true
    let address = ''
    const cut = cutOut(picture, currentMask, backdrop)
    cut.toBlob((blob) => {
      if (!blob || !isCurrent) return
      address = URL.createObjectURL(blob)
      setPreviewUrl(address)
    }, 'image/png')
    return () => {
      isCurrent = false
      if (address) URL.revokeObjectURL(address)
    }
  }, [picture, currentMask, backdrop])

  function saveCutOut() {
    if (!picture || !currentMask || !files[0]) return
    const type = backdrop === 'transparent' ? 'image/png' : outputTypeOf(files[0].name)
    void batch.run(async () => canvasToFile(cutOut(picture, currentMask, backdrop), outputNameOf(files[0].name, 'no-background', extensionOfType(type)), type))
  }

  return (
    <div id="remove-background-tool" className="space-y-4 text-start">
      <p className="text-center text-sm text-ink-soft">{t('tools.removeBackground.hint')}</p>
      <fieldset className="flex flex-wrap items-center justify-center gap-4">
        <legend className="sr-only">{t('tools.removeBackground.subject')}</legend>
        {(['person', 'object'] as const).map((choice) => (
          <label key={choice} className="inline-flex min-h-11 items-center gap-2 font-medium">
            <input id={`remove-background-${choice}-radio`} type="radio" name="remove-background-subject" checked={subject === choice} onChange={() => setSubject(choice)} className="size-5" />
            {t(`tools.removeBackground.${choice}`)}
          </label>
        ))}
      </fieldset>
      <p id="remove-background-status" aria-live="polite" className="text-center text-sm font-medium">
        {maskState === 'working' ? t('tools.ai.loadingModel') : maskState === 'failed' ? t('tools.ai.modelFailed') : ''}
      </p>
      {read && 'picture' in read && previewUrl && currentMask && <BeforeAfterSlider id="remove-background-compare" beforeUrl={read.previewUrl} afterUrl={previewUrl} beforeLabel={t('tools.image.before')} afterLabel={t('tools.image.after')} />}
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.removeBackground.backdrop')}
          <select id="remove-background-backdrop-select" value={backdrop} onChange={(event) => setBackdrop(event.target.value as Backdrop)} className={fieldClass}>
            <option value="transparent">{t('tools.removeBackground.transparent')}</option>
            <option value="white">{t('tools.removeBackground.white')}</option>
          </select>
        </label>
        <button id="remove-background-button" type="button" disabled={!currentMask || batch.isRunning} onClick={saveCutOut} className="btn btn--primary press">
          {batch.isRunning ? t('tools.working') : t('tools.removeBackground.button')}
        </button>
      </div>
      {batch.progressBar}
      {batch.errorLine}
      <ImageFileGrid id="remove-background-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}

// ---------------------------------------------------------------- Upscale image

const UPSCALE_MODEL = 'swin2sr-lightweight-x2-quantized.onnx'
// Swin2SR doubles the size of what it is given; the picture goes through in tiles, each read with a margin of the picture around
// it (so tiles meet without seams) and sized to a multiple of 8, as the model's windows need.
const UPSCALE_TILE = 128
const UPSCALE_MARGIN = 8
// About 1.5 s per tile on a laptop, so 1,024 px (64 tiles) takes about a minute and a half.
const LONGEST_UPSCALE_INPUT = 1024
const roundUpToEight = (size: number) => Math.ceil(size / 8) * 8

async function doublePicture(picture: CanvasImageSource & { width: number; height: number }, onTileDone: () => Promise<void>) {
  const session = await loadModel(UPSCALE_MODEL)
  const output = new OffscreenCanvas(picture.width * 2, picture.height * 2)
  const outputContext = output.getContext('2d')!
  for (let top = 0; top < picture.height; top += UPSCALE_TILE) {
    for (let left = 0; left < picture.width; left += UPSCALE_TILE) {
      const tile = { x: left, y: top, width: Math.min(UPSCALE_TILE, picture.width - left), height: Math.min(UPSCALE_TILE, picture.height - top) }
      const read = { x: Math.max(0, tile.x - UPSCALE_MARGIN), y: Math.max(0, tile.y - UPSCALE_MARGIN) }
      const readRight = Math.min(picture.width, tile.x + tile.width + UPSCALE_MARGIN)
      const readBottom = Math.min(picture.height, tile.y + tile.height + UPSCALE_MARGIN)
      const region = { ...read, width: readRight - read.x, height: readBottom - read.y }
      const [inputWidth, inputHeight] = [roundUpToEight(region.width), roundUpToEight(region.height)]
      // The region is drawn at its own size into an input a little larger (to a multiple of 8); the extra edge is dropped after.
      const padded = new OffscreenCanvas(inputWidth, inputHeight)
      padded.getContext('2d')!.drawImage(picture, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height)
      const input = await pictureToTensor(padded, { x: 0, y: 0, width: inputWidth, height: inputHeight }, inputWidth, inputHeight, (value) => value / 255)
      const result = await session.run({ [session.inputNames[0]]: input })
      const doubled = result[session.outputNames[0]]
      const [, , doubledHeight, doubledWidth] = doubled.dims
      const values = doubled.data as Float32Array
      const image = outputContext.createImageData(tile.width * 2, tile.height * 2)
      const [offsetX, offsetY] = [(tile.x - region.x) * 2, (tile.y - region.y) * 2]
      for (let row = 0; row < tile.height * 2; row++) {
        for (let column = 0; column < tile.width * 2; column++) {
          const source = (row + offsetY) * doubledWidth + column + offsetX
          const target = (row * tile.width * 2 + column) * 4
          for (let channel = 0; channel < 3; channel++) image.data[target + channel] = Math.round(Math.min(Math.max(values[channel * doubledWidth * doubledHeight + source], 0), 1) * 255)
          image.data[target + 3] = 255
        }
      }
      outputContext.putImageData(image, tile.x * 2, tile.y * 2)
      await onTileDone()
    }
  }
  return output
}

export function UpscaleImage({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useReadImages(files)
  const read = files[0] ? readByFile.get(files[0]) : undefined
  const picture = read && 'picture' in read ? read.picture : null
  const [factor, setFactor] = useState<2 | 4>(2)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const isTooLarge = !!picture && Math.max(picture.width, picture.height) * (factor / 2) > LONGEST_UPSCALE_INPUT

  async function upscale() {
    if (!picture || !files[0]) return
    setError('')
    const tilesAcross = (size: number) => Math.ceil(size / UPSCALE_TILE)
    const total = tilesAcross(picture.width) * tilesAcross(picture.height) + (factor === 4 ? tilesAcross(picture.width * 2) * tilesAcross(picture.height * 2) : 0)
    let done = 0
    setProgress({ done, total })
    const onTileDone = async () => {
      setProgress({ done: ++done, total })
      await nextFrame()
    }
    try {
      let result: OffscreenCanvas = await doublePicture(picture, onTileDone)
      if (factor === 4) result = await doublePicture(result, onTileDone)
      const type = outputTypeOf(files[0].name)
      // The model works on colour only: a picture's transparency is enlarged the ordinary way and put back.
      if (type !== 'image/jpeg') {
        const alpha = new OffscreenCanvas(result.width, result.height)
        const alphaContext = alpha.getContext('2d')!
        alphaContext.imageSmoothingQuality = 'high'
        alphaContext.drawImage(picture, 0, 0, result.width, result.height)
        const opacity = alphaContext.getImageData(0, 0, result.width, result.height).data
        const resultContext = result.getContext('2d')!
        const pixels = resultContext.getImageData(0, 0, result.width, result.height)
        for (let offset = 3; offset < pixels.data.length; offset += 4) pixels.data[offset] = opacity[offset]
        resultContext.putImageData(pixels, 0, 0)
      }
      onResult(await canvasToFile(result, outputNameOf(files[0].name, `${factor}x`, extensionOfType(type)), type))
    } catch {
      setError(t('tools.ai.modelFailed'))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div id="upscale-image-tool" className="space-y-4 text-start">
      <p className="text-center text-sm text-ink-soft">{t('tools.upscale.hint')}</p>
      <fieldset className="flex flex-wrap items-center justify-center gap-4">
        <legend className="sr-only">{t('tools.upscale.factor')}</legend>
        {([2, 4] as const).map((choice) => (
          <label key={choice} className="inline-flex min-h-11 items-center gap-2 font-medium">
            <input id={`upscale-${choice}x-radio`} type="radio" name="upscale-factor" checked={factor === choice} onChange={() => setFactor(choice)} className="size-5" />
            {t('tools.upscale.times', { factor: choice })}
          </label>
        ))}
      </fieldset>
      {picture && (
        <p id="upscale-size" className="text-center text-sm text-ink-soft" dir="ltr">
          {picture.width} × {picture.height} → {picture.width * factor} × {picture.height * factor} px
        </p>
      )}
      {isTooLarge && <p id="upscale-too-large" role="alert" className="text-center text-sm font-medium text-danger">{t('tools.upscale.tooLarge', { size: LONGEST_UPSCALE_INPUT / (factor / 2) })}</p>}
      <div className="flex justify-center">
        <button id="upscale-image-button" type="button" disabled={!picture || isTooLarge || progress !== null} onClick={() => void upscale()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.upscale.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.upscale.progress', { done: progress.done, total: progress.total }) : t('tools.ai.loadingModel')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
      <ImageFileGrid id="upscale-image-grid" files={files} readByFile={readByFile} onFilesChange={onFilesChange} />
    </div>
  )
}
