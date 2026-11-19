// The image tools' work runs in imageTools.worker.ts with OffscreenCanvas and the jSquash codecs (Squoosh, Apache-2.0), so large
// pictures and long batches never freeze the page. One worker per task, started here, never from a module the worker imports.

export type ImageFormat = 'jpg' | 'png' | 'webp' | 'avif'
export type PhotoFilter = 'none' | 'mono' | 'sepia' | 'vivid' | 'fade' | 'cool' | 'warm'

// One change to a picture, applied in order. Boxes and overlays are fractions (0 to 1) of the picture's size at that step, so the
// same steps fit every file of a batch.
export type ImageStep =
  | { type: 'resize'; width: number; height: number }
  | { type: 'crop'; x: number; y: number; width: number; height: number; isCircle: boolean }
  | { type: 'rotate'; quarterTurns: 0 | 1 | 2 | 3; flipHorizontal: boolean; flipVertical: boolean }
  | { type: 'adjust'; brightness: number; contrast: number; saturation: number; warmth: number; filter: PhotoFilter }
  | { type: 'overlay'; picture: ImageBitmap; x: number; y: number; width: number; height: number; opacity: number }

export type ImageOutput = { format: ImageFormat; quality: number; optimisePng: boolean }
export type ImageJob = { name: string; picture: ImageBitmap; steps: ImageStep[]; output: ImageOutput }
export type MadeImage = { name: string; bytes: Uint8Array; width: number; height: number }

export type ImageTaskRequest =
  // A picture file decoded to pixels (HEIC through libheif-js where the browser cannot, TIFF through utif2).
  | { type: 'decode'; file: Blob; extension: string }
  | { type: 'process'; jobs: ImageJob[]; zipName: string | null }
  | { type: 'zip'; files: { name: string; bytes: Uint8Array }[] }

export type ImageTaskResponse =
  | { status: 'ok'; picture?: ImageBitmap; images?: MadeImage[]; zip?: Uint8Array }
  | { status: 'error'; reason: 'unreadable' | 'heic' | 'failed' }
export type ImageTaskProgress = { status: 'progress'; done: number; total: number }

// Colour changes as pixel maths, so they look the same in every browser's OffscreenCanvas. Brightness, contrast and saturation
// are -100 to 100, warmth -100 (cool) to 100 (warm).
export function adjustPixels(pixels: ImageData, brightness: number, contrast: number, saturation: number, warmth: number, filter: PhotoFilter) {
  const data = pixels.data
  const contrastFactor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55))
  const saturationFactor = 1 + saturation / 100
  for (let index = 0; index < data.length; index += 4) {
    let red = data[index] + brightness * 2.55
    let green = data[index + 1] + brightness * 2.55
    let blue = data[index + 2] + brightness * 2.55
    red = contrastFactor * (red - 128) + 128
    green = contrastFactor * (green - 128) + 128
    blue = contrastFactor * (blue - 128) + 128
    const grey = 0.299 * red + 0.587 * green + 0.114 * blue
    red = grey + (red - grey) * saturationFactor
    green = grey + (green - grey) * saturationFactor
    blue = grey + (blue - grey) * saturationFactor
    red += warmth * 0.4
    blue -= warmth * 0.4
    if (filter === 'mono') red = green = blue = 0.299 * red + 0.587 * green + 0.114 * blue
    if (filter === 'sepia') [red, green, blue] = [0.393 * red + 0.769 * green + 0.189 * blue, 0.349 * red + 0.686 * green + 0.168 * blue, 0.272 * red + 0.534 * green + 0.131 * blue]
    if (filter === 'vivid') {
      const vividGrey = 0.299 * red + 0.587 * green + 0.114 * blue
      ;[red, green, blue] = [vividGrey + (red - vividGrey) * 1.35, vividGrey + (green - vividGrey) * 1.35, vividGrey + (blue - vividGrey) * 1.35]
    }
    if (filter === 'fade') [red, green, blue] = [red * 0.85 + 30, green * 0.85 + 30, blue * 0.85 + 30]
    if (filter === 'cool') [red, blue] = [red - 15, blue + 20]
    if (filter === 'warm') [red, blue] = [red + 20, blue - 15]
    data[index] = red
    data[index + 1] = green
    data[index + 2] = blue
  }
  return pixels
}

export const IMAGE_MIME_TYPES: Record<ImageFormat, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }

// Pictures, ImageBitmaps included, are moved to the worker rather than copied. Each is listed once: steps share a picture (a tiled
// watermark), and listing one twice throws.
function transferablesOf(request: ImageTaskRequest): Transferable[] {
  if (request.type !== 'process') return []
  return [...new Set(request.jobs.flatMap((job) => [job.picture, ...job.steps.flatMap((step) => (step.type === 'overlay' ? [step.picture] : []))]))]
}

export function runImageTask(request: ImageTaskRequest, onProgress?: (done: number, total: number) => void) {
  const worker = new Worker(new URL('./imageTools.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<ImageTaskResponse>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ImageTaskResponse | ImageTaskProgress>) => {
      if (event.data.status === 'progress') onProgress?.(event.data.done, event.data.total)
      else resolve(event.data)
    }
    worker.onerror = () => reject(new Error('Image worker failed'))
    worker.postMessage(request, transferablesOf(request))
  }).finally(() => worker.terminate())
}
