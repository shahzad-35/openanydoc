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
    const fields = (await exifr.parse(file, { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false, mergeOutput: true, translateValues: false, reviveValues: true })) as Record<string, unknown> | undefined
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

// Only what draws the picture is kept (an allowlist): a file can carry metadata in many more places than the usual ones (preview
// images and gain maps after the picture, the MPF index, C2PA manifests, makers' own segments and chunks).

// JPEG: the JFIF header (APP0), the colour profile (APP2 ICC_PROFILE), Adobe's colour marker (APP14), the tables, the frame and the
// scans, up to the end of the first picture. Every other application segment, the comments and everything after the picture's end
// go. A file whose end can't be found returns null, so it is re-encoded instead.
function stripJpeg(bytes: Uint8Array) {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)]
  const startsWithText = (at: number, text: string) => Array.from(text).every((character, index) => bytes[at + index] === character.charCodeAt(0))
  let offset = 2
  while (offset + 1 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]
    // 0xFF fill bytes may come before a marker.
    if (marker === 0xff) {
      offset++
      continue
    }
    if (marker === 0xd9) {
      kept.push(bytes.subarray(offset, offset + 2))
      return concatBytes(kept)
    }
    const segmentEnd = offset + 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3])
    const isApplicationSegment = marker >= 0xe0 && marker <= 0xef
    const isKept = isApplicationSegment ? (marker === 0xe0 && startsWithText(offset + 4, 'JFIF\0')) || (marker === 0xe2 && startsWithText(offset + 4, 'ICC_PROFILE\0')) || marker === 0xee : marker !== 0xfe
    if (isKept) kept.push(bytes.subarray(offset, segmentEnd))
    offset = segmentEnd
    if (marker === 0xda) {
      // A scan's coded data runs to the next marker: 0xFF followed by 0x00 (an escaped byte) or a restart marker belongs to it.
      let scanEnd = offset
      while (scanEnd + 1 < bytes.length && !(bytes[scanEnd] === 0xff && bytes[scanEnd + 1] !== 0x00 && (bytes[scanEnd + 1] < 0xd0 || bytes[scanEnd + 1] > 0xd7))) scanEnd++
      kept.push(bytes.subarray(offset, scanEnd))
      offset = scanEnd
    }
  }
  return null
}

// PNG: the picture's chunks, its colour and transparency, its pixel size and an animation's frames, up to IEND.
const KEPT_PNG_CHUNKS = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'mDCV', 'cLLI', 'bKGD', 'pHYs', 'acTL', 'fcTL', 'fdAT']
function stripPng(bytes: Uint8Array) {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)]
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint32(0)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (KEPT_PNG_CHUNKS.includes(type)) kept.push(bytes.subarray(offset, offset + 12 + length))
    offset += 12 + length
    if (type === 'IEND') break
  }
  return concatBytes(kept)
}

// WebP: the picture, alpha, animation and colour profile chunks; the extended header's EXIF and XMP flags are cleared.
const KEPT_WEBP_CHUNKS = ['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']
function stripWebp(bytes: Uint8Array) {
  const kept: Uint8Array[] = []
  const riffEnd = Math.min(bytes.length, 8 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true))
  let offset = 12
  while (offset + 8 <= riffEnd) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4))
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint32(4, true)
    const chunk = bytes.slice(offset, offset + 8 + size + (size % 2))
    if (type === 'VP8X') chunk[8] &= ~0x0c
    if (KEPT_WEBP_CHUNKS.includes(type)) kept.push(chunk)
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
// for a JPEG turned by its EXIF orientation (without that field it would show sideways) and for a JPEG whose end can't be found,
// which are re-encoded instead.
// The format is read from the file's first bytes, so a file with the wrong extension is re-encoded rather than garbled.
export function stripMetadataLosslessly(bytes: Uint8Array, orientation: number | undefined) {
  const startsWith = (signature: number[], at = 0) => signature.every((byte, index) => bytes[at + index] === byte)
  if (startsWith([0xff, 0xd8])) return (orientation ?? 1) === 1 ? stripJpeg(bytes) : null
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return stripPng(bytes)
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return stripWebp(bytes)
  return null
}
