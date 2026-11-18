// The image tools' worker: decodes pictures, applies the steps on an OffscreenCanvas, encodes with the jSquash codecs (Squoosh,
// Apache-2.0) and zips batches with fflate (MIT). Each codec's WebAssembly is bundled as a data: address (vite.config.ts inlines
// these files), decoded here and compiled, so no .wasm is ever fetched; a codec loads only when first used.
import { zipSync } from 'fflate'
import { simd } from 'wasm-feature-detect'
import { adjustPixels } from './imageTasks'
import type { ImageJob, ImageStep, ImageTaskProgress, ImageTaskRequest, ImageTaskResponse, MadeImage } from './imageTasks'

function reportProgress(done: number, total: number) {
  postMessage({ status: 'progress', done, total } satisfies ImageTaskProgress)
}

// The built site gets a data: address; only the dev server gives a file address, read from the dev server (removed from the build).
async function compileBundledWasm(loadAddress: () => Promise<{ default: string }>) {
  const { default: address } = await loadAddress()
  if (import.meta.env.DEV && !address.startsWith('data:')) return WebAssembly.compile(await (await fetch(address)).arrayBuffer())
  return WebAssembly.compile(Uint8Array.from(atob(address.slice(address.indexOf(',') + 1)), (character) => character.charCodeAt(0)))
}

let jpegEncoder: Promise<typeof import('@jsquash/jpeg/encode').default> | null = null
let pngEncoder: Promise<typeof import('@jsquash/png/encode').default> | null = null
let pngOptimiser: Promise<typeof import('@jsquash/oxipng/optimise').default> | null = null
let webpEncoder: Promise<typeof import('@jsquash/webp/encode').default> | null = null
let avifEncoder: Promise<typeof import('@jsquash/avif/encode').default> | null = null
let resizer: Promise<typeof import('@jsquash/resize').default> | null = null

const loadJpegEncoder = () =>
  (jpegEncoder ??= (async () => {
    const codec = await import('@jsquash/jpeg/encode')
    await codec.init(await compileBundledWasm(() => import('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url')))
    return codec.default
  })())
const loadPngEncoder = () =>
  (pngEncoder ??= (async () => {
    const codec = await import('@jsquash/png/encode')
    await codec.init(await compileBundledWasm(() => import('@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url')))
    return codec.default
  })())
// The single-threaded OxiPNG: threads need a cross-origin isolated page, which this site is not.
const loadPngOptimiser = () =>
  (pngOptimiser ??= (async () => {
    const codec = await import('@jsquash/oxipng/optimise')
    await codec.init(await compileBundledWasm(() => import('@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url')))
    return codec.default
  })())
// jSquash picks its SIMD build when the browser has SIMD, so it gets the matching module.
const loadWebpEncoder = () =>
  (webpEncoder ??= (async () => {
    const codec = await import('@jsquash/webp/encode')
    const wasm = (await simd()) ? () => import('@jsquash/webp/codec/enc/webp_enc_simd.wasm?url') : () => import('@jsquash/webp/codec/enc/webp_enc.wasm?url')
    await codec.init(await compileBundledWasm(wasm))
    return codec.default
  })())
const loadAvifEncoder = () =>
  (avifEncoder ??= (async () => {
    const codec = await import('@jsquash/avif/encode')
    await codec.init(await compileBundledWasm(() => import('@jsquash/avif/codec/enc/avif_enc.wasm?url')))
    return codec.default
  })())
const loadResizer = () =>
  (resizer ??= (async () => {
    const codec = await import('@jsquash/resize')
    await codec.initResize(await compileBundledWasm(() => import('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm?url')))
    return codec.default
  })())

// libheif-js (LGPL-3.0), unmodified, with its WebAssembly inside the module: loaded only for a HEIC the browser cannot read.
async function decodeHeic(file: Blob) {
  const { default: createLibheif } = await import('libheif-js/libheif-wasm/libheif-bundle.mjs')
  const libheif = await createLibheif()
  const decoder = new libheif.HeifDecoder()
  const [image] = decoder.decode(new Uint8Array(await file.arrayBuffer()))
  if (!image) throw new Error('No image in the HEIC file')
  const width = image.get_width()
  const height = image.get_height()
  const pixels = await new Promise<ImageData>((resolve, reject) =>
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (shown: ImageData | null) => (shown ? resolve(shown) : reject(new Error('HEIC decode failed')))),
  )
  image.free()
  return createImageBitmap(new ImageData(new Uint8ClampedArray(pixels.data), width, height))
}

async function decodeTiff(file: Blob) {
  const UTIF = await import('utif2')
  const bytes = await file.arrayBuffer()
  const [firstImage] = UTIF.decode(bytes)
  UTIF.decodeImage(bytes, firstImage)
  const width = Number(firstImage.width)
  const height = Number(firstImage.height)
  return createImageBitmap(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(firstImage)), width, height))
}

async function decodePicture(file: Blob, extension: string): Promise<ImageBitmap> {
  if (extension === 'tif' || extension === 'tiff') return decodeTiff(file)
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (error) {
    if (extension === 'heic' || extension === 'heif') return decodeHeic(file)
    throw error
  }
}

const canvasOf = (width: number, height: number) => {
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
  return { canvas, context: canvas.getContext('2d')! }
}

async function applyStep(source: OffscreenCanvas, step: ImageStep): Promise<OffscreenCanvas> {
  const { width, height } = source
  if (step.type === 'resize') {
    const resize = await loadResizer()
    const resized = await resize(source.getContext('2d')!.getImageData(0, 0, width, height), { width: Math.max(1, Math.round(step.width)), height: Math.max(1, Math.round(step.height)) })
    const { canvas, context } = canvasOf(resized.width, resized.height)
    context.putImageData(resized, 0, 0)
    return canvas
  }
  if (step.type === 'crop') {
    const box = { x: Math.round(step.x * width), y: Math.round(step.y * height), width: Math.round(step.width * width), height: Math.round(step.height * height) }
    const { canvas, context } = canvasOf(box.width, box.height)
    if (step.isCircle) {
      context.beginPath()
      context.ellipse(box.width / 2, box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2)
      context.clip()
    }
    context.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height)
    return canvas
  }
  if (step.type === 'rotate') {
    const isSideways = step.quarterTurns % 2 === 1
    const { canvas, context } = canvasOf(isSideways ? height : width, isSideways ? width : height)
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((step.quarterTurns * Math.PI) / 2)
    context.scale(step.flipHorizontal ? -1 : 1, step.flipVertical ? -1 : 1)
    context.drawImage(source, -width / 2, -height / 2)
    return canvas
  }
  if (step.type === 'adjust') {
    const context = source.getContext('2d')!
    context.putImageData(adjustPixels(context.getImageData(0, 0, width, height), step.brightness, step.contrast, step.saturation, step.warmth, step.filter), 0, 0)
    return source
  }
  const context = source.getContext('2d')!
  context.globalAlpha = step.opacity
  context.drawImage(step.picture, step.x * width, step.y * height, step.width * width, step.height * height)
  context.globalAlpha = 1
  return source
}

async function makeImage(job: ImageJob): Promise<MadeImage> {
  let { canvas, context } = canvasOf(job.picture.width, job.picture.height)
  context.drawImage(job.picture, 0, 0)
  for (const step of job.steps) canvas = await applyStep(canvas, step)
  const { width, height } = canvas
  // JPG has no transparency: transparent parts become white, not black.
  if (job.output.format === 'jpg') {
    const flattened = canvasOf(width, height)
    flattened.context.fillStyle = '#ffffff'
    flattened.context.fillRect(0, 0, width, height)
    flattened.context.drawImage(canvas, 0, 0)
    canvas = flattened.canvas
  }
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height)
  const quality = job.output.quality
  let bytes: ArrayBuffer
  if (job.output.format === 'jpg') bytes = await (await loadJpegEncoder())(pixels, { quality })
  else if (job.output.format === 'webp') bytes = await (await loadWebpEncoder())(pixels, { quality })
  else if (job.output.format === 'avif') bytes = await (await loadAvifEncoder())(pixels, { quality })
  else bytes = job.output.optimisePng ? await (await loadPngOptimiser())(pixels, { level: 2 }) : await (await loadPngEncoder())(pixels)
  return { name: job.name, bytes: new Uint8Array(bytes), width, height }
}

async function runTask(request: ImageTaskRequest): Promise<ImageTaskResponse> {
  if (request.type === 'decode') {
    try {
      const picture = await decodePicture(request.file, request.extension)
      return { status: 'ok', picture }
    } catch {
      return { status: 'error', reason: request.extension === 'heic' || request.extension === 'heif' ? 'heic' : 'unreadable' }
    }
  }
  if (request.type === 'zip') return { status: 'ok', zip: zipSync(Object.fromEntries(request.files.map((file) => [file.name, file.bytes])), { level: 0 }) }
  const images: MadeImage[] = []
  for (const [position, job] of request.jobs.entries()) {
    images.push(await makeImage(job))
    reportProgress(position + 1, request.jobs.length)
  }
  // Pictures are compressed already; storing them keeps the ZIP quick to make.
  if (request.zipName) return { status: 'ok', images, zip: zipSync(Object.fromEntries(images.map((image) => [image.name, image.bytes])), { level: 0 }) }
  return { status: 'ok', images }
}

self.onmessage = async (event: MessageEvent<ImageTaskRequest>) => {
  let response: ImageTaskResponse
  try {
    response = await runTask(event.data)
  } catch {
    response = { status: 'error', reason: 'failed' }
  }
  postMessage(response, { transfer: response.status === 'ok' && response.picture ? [response.picture] : [] })
}
