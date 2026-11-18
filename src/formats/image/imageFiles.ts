// Pictures on the page: decoding (in the image worker, except SVG, which only a page can draw), reading their metadata with exifr
// (MIT) and removing it. Shared by the image viewer, the image tools and JPG to PDF.
import { runImageTask } from '../../tools/image/imageTasks'

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.heic', '.heif', '.tif', '.tiff', '.svg']
export const extensionOf = (fileName: string) => fileName.toLowerCase().split('.').pop() ?? ''

// An SVG without its own size is drawn this many pixels on its long side.
const DEFAULT_SVG_LONG_SIDE = 1000

export class ImageReadError extends Error {
  readonly reason: 'unreadable' | 'heic'
  constructor(reason: 'unreadable' | 'heic') {
    super(reason)
    this.reason = reason
  }
}

// An SVG as pixels, `longSide` pixels on its longer side (its own size when not given).
export async function drawSvg(file: Blob, longSide?: number): Promise<ImageBitmap> {
  const address = URL.createObjectURL(file)
  try {
    const picture = new Image()
    picture.src = address
    await picture.decode()
    const ownWidth = picture.naturalWidth || DEFAULT_SVG_LONG_SIDE
    const ownHeight = picture.naturalHeight || DEFAULT_SVG_LONG_SIDE
    const scale = longSide ? longSide / Math.max(ownWidth, ownHeight) : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(ownWidth * scale)
    canvas.height = Math.round(ownHeight * scale)
    canvas.getContext('2d')!.drawImage(picture, 0, 0, canvas.width, canvas.height)
    return createImageBitmap(canvas)
  } catch {
    throw new ImageReadError('unreadable')
  } finally {
    URL.revokeObjectURL(address)
  }
}

// Any supported picture as pixels, upright (EXIF orientation applied).
export async function decodeImage(file: Blob & { name?: string }, svgLongSide?: number): Promise<ImageBitmap> {
  const extension = extensionOf(file.name ?? '')
  if (extension === 'svg' || file.type === 'image/svg+xml') return drawSvg(file, svgLongSide)
  const response = await runImageTask({ type: 'decode', file, extension })
  if (response.status === 'ok' && response.picture) return response.picture
  throw new ImageReadError(response.status === 'error' && response.reason === 'heic' ? 'heic' : 'unreadable')
}

// What a picture says about itself: the camera, when it was taken, where (GPS) and with what software. Empty when it holds nothing.
export type ImageMetadata = {
  camera?: string
  lens?: string
  takenAt?: Date
  software?: string
  latitude?: number
  longitude?: number
  altitude?: number
  orientation?: number
  author?: string
  // The number of metadata fields found in all, the ones above included.
  fieldCount: number
}

export async function readImageMetadata(file: Blob): Promise<ImageMetadata> {
  try {
    const exifr = await import('exifr')
    const fields = (await exifr.parse(file, { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false, mergeOutput: true, translateValues: true, reviveValues: true })) as Record<string, unknown> | undefined
    if (!fields) return { fieldCount: 0 }
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
    const make = text(fields.Make)
    const model = text(fields.Model)
    return {
      camera: model ? (make && !model.startsWith(make) ? `${make} ${model}` : model) : make,
      lens: text(fields.LensModel),
      takenAt: fields.DateTimeOriginal instanceof Date ? fields.DateTimeOriginal : fields.CreateDate instanceof Date ? fields.CreateDate : undefined,
      software: text(fields.Software),
      latitude: typeof fields.latitude === 'number' ? fields.latitude : undefined,
      longitude: typeof fields.longitude === 'number' ? fields.longitude : undefined,
      altitude: typeof fields.GPSAltitude === 'number' ? fields.GPSAltitude : undefined,
      orientation: typeof fields.Orientation === 'number' ? fields.Orientation : undefined,
      author: text(fields.Artist) ?? text(fields.creator),
      fieldCount: Object.keys(fields).length,
    }
  } catch {
    return { fieldCount: 0 }
  }
}

// ---------------------------------------------------------------- removing metadata without re-encoding

// JPEG: everything but the picture and how to show it goes: APP1 (EXIF, XMP), APP13 (IPTC), APP12 and comments. The JFIF header,
// the colour profile (APP2) and Adobe's colour marker (APP14) stay, so the picture looks exactly the same.
function stripJpeg(bytes: Uint8Array) {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)]
  let offset = 2
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]
    if (marker === 0xda) break
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xec || marker === 0xfe
    if (!isMetadata) kept.push(bytes.subarray(offset, offset + 2 + length))
    offset += 2 + length
  }
  kept.push(bytes.subarray(offset))
  return concatBytes(kept)
}

// PNG: text chunks (tEXt, iTXt, zTXt), EXIF (eXIf) and the time stamp (tIME) go; the picture's chunks stay.
function stripPng(bytes: Uint8Array) {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)]
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint32(0)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'].includes(type)) kept.push(bytes.subarray(offset, offset + 12 + length))
    offset += 12 + length
  }
  return concatBytes(kept)
}

// WebP: the EXIF and XMP chunks go and the extended header's flags for them are cleared.
function stripWebp(bytes: Uint8Array) {
  const kept: Uint8Array[] = []
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4))
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint32(4, true)
    const chunk = bytes.slice(offset, offset + 8 + size + (size % 2))
    if (type === 'VP8X') chunk[8] &= ~0x0c
    if (type !== 'EXIF' && type !== 'XMP ') kept.push(chunk)
    offset += 8 + size + (size % 2)
  }
  const body = concatBytes(kept)
  const header = bytes.slice(0, 12)
  new DataView(header.buffer).setUint32(4, body.length + 4, true)
  return concatBytes([header, body])
}

function concatBytes(parts: Uint8Array[]) {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}

// The picture without its metadata, when that is possible without re-encoding (JPEG, PNG, WebP); null for the other formats, and
// for a JPEG turned by its EXIF orientation (without that field it would show sideways), which are re-encoded instead.
export function stripMetadataLosslessly(bytes: Uint8Array, extension: string, orientation: number | undefined) {
  if ((extension === 'jpg' || extension === 'jpeg') && (orientation ?? 1) === 1) return stripJpeg(bytes)
  if (extension === 'png') return stripPng(bytes)
  if (extension === 'webp') return stripWebp(bytes)
  return null
}
