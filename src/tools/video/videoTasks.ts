// The video tools' work runs in videoTools.worker.ts (Mediabunny, MPL-2.0, unmodified, on the browser's WebCodecs), so long
// videos never freeze the page. One worker per task, started here; cancelling a task ends its worker.
import type { AudioCodec, VideoCodec } from 'mediabunny'

export type VideoContainer = 'mp4' | 'webm' | 'mov' | 'mkv'
export type AudioContainer = 'mp3' | 'm4a' | 'wav' | 'ogg'
export type OutputContainer = VideoContainer | AudioContainer
export type VideoQuality = 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
// A part of the picture as fractions (0 to 1) of the video's shown width and height.
export type FrameBox = { x: number; y: number; width: number; height: number }

export type VideoInfo = {
  container: string
  durationSeconds: number
  sizeBytes: number
  video: { codec: VideoCodec | null; codecString: string | null; width: number; height: number; rotation: number; frameRate: number | null; bitrate: number | null; canDecode: boolean } | null
  audio: { codec: AudioCodec | null; codecString: string | null; sampleRate: number; channels: number; bitrate: number | null; canDecode: boolean } | null
  trackCount: number
}

// Drawn on every frame (from `fromSeconds` to `toSeconds` of the result when set): a picture the size of the frame (text drawn
// by the page) and blurred boxes.
export type FrameOverlay = { picture?: ImageBitmap; blurBoxes?: FrameBox[]; blurStrength?: number; fromSeconds?: number; toSeconds?: number }

export type ConvertSettings = {
  container: OutputContainer
  // A codec the visitor chose. Without one, a picture that isn't changed is copied when the container can hold its codec;
  // otherwise the container's usual codec this browser can make is used.
  videoCodec?: VideoCodec
  quality?: VideoQuality
  // Bits per second; wins over `quality` (Compress to a target size).
  videoBitrate?: number
  audioBitrate?: number
  width?: number
  height?: number
  rotate?: 0 | 90 | 180 | 270
  flip?: 'horizontal' | 'vertical'
  crop?: FrameBox
  frameRate?: number
  trim?: { start: number; end: number }
  dropAudio?: boolean
  overlay?: FrameOverlay
  // Replaces the video's sound with this file's (repeated when `loop` and shorter than the video).
  addedAudio?: { file: Blob; loop: boolean }
}

export type VideoTaskRequest =
  | { type: 'probe'; file: Blob }
  // The codecs this browser can make for a container, at a size: the pages offer only these.
  | { type: 'encodable'; container: OutputContainer; width?: number; height?: number }
  | { type: 'convert'; file: Blob; settings: ConvertSettings }
  // Parts played one after another into one video (Merge, Loop: the same file several times, Change speed: one part).
  | { type: 'join'; parts: { file: Blob; start?: number; end?: number }[]; container: VideoContainer; width: number; height: number; frameRate: number; speed: number; dropAudio: boolean; quality: VideoQuality }
  | { type: 'frames'; file: Blob; times: number[]; format: 'png' | 'jpg'; maxWidth?: number; baseName: string }
  | { type: 'gif'; file: Blob; start: number; end: number; frameRate: number; width: number }
  // Pictures shown one after another, each for `secondsEach` (PowerPoint to video).
  | { type: 'pictures-to-video'; pictures: ImageBitmap[]; secondsEach: number; container: VideoContainer; frameRate: number }

export type VideoTaskError =
  | 'unreadable'
  | 'no-video'
  | 'no-audio'
  // The browser cannot read (`decode`) or make (`encode`) `codec`; `suggestion` is one it can make for the same container.
  | 'decode'
  | 'encode'
  | 'failed'

export type VideoTaskResponse =
  // `soundDropped`: the video had sound this browser couldn't read, so the result has none.
  | { status: 'ok'; bytes?: Uint8Array; mimeType?: string; extension?: string; info?: VideoInfo; videoCodecs?: VideoCodec[]; audioCodecs?: AudioCodec[]; soundDropped?: boolean }
  | { status: 'error'; reason: VideoTaskError; codec?: string; suggestion?: string }
export type VideoTaskProgress = { status: 'progress'; done: number; total: number }

// Codec names as people know them (format names, fine on the pages).
export const CODEC_NAMES: Record<string, string> = {
  avc: 'H.264',
  hevc: 'H.265 (HEVC)',
  vp8: 'VP8',
  vp9: 'VP9',
  av1: 'AV1',
  prores: 'ProRes',
  aac: 'AAC',
  opus: 'Opus',
  mp3: 'MP3',
  vorbis: 'Vorbis',
  flac: 'FLAC',
  ac3: 'AC-3',
  eac3: 'E-AC-3',
  'pcm-s16': 'PCM',
}
export const codecName = (codec: string | null | undefined) => (codec ? (CODEC_NAMES[codec] ?? codec.toUpperCase()) : '')

export const CONTAINER_MIME_TYPES: Record<OutputContainer, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
}

export class VideoTaskFailed extends Error {
  readonly reason: VideoTaskError
  readonly codec?: string
  readonly suggestion?: string
  constructor(reason: VideoTaskError, codec?: string, suggestion?: string) {
    super(reason)
    this.reason = reason
    this.codec = codec
    this.suggestion = suggestion
  }
}

function transferablesOf(request: VideoTaskRequest): Transferable[] {
  if (request.type === 'pictures-to-video') return request.pictures
  if (request.type === 'convert' && request.settings.overlay?.picture) return [request.settings.overlay.picture]
  return []
}

// Resolves with the worker's answer; an error answer rejects with VideoTaskFailed, a cancel with an AbortError.
export function runVideoTask(request: VideoTaskRequest, onProgress?: (done: number, total: number) => void, signal?: AbortSignal) {
  const worker = new Worker(new URL('./videoTools.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<Extract<VideoTaskResponse, { status: 'ok' }>>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => {
      worker.terminate()
      reject(new DOMException('Cancelled', 'AbortError'))
    })
    worker.onmessage = (event: MessageEvent<VideoTaskResponse | VideoTaskProgress>) => {
      const answer = event.data
      if (answer.status === 'progress') onProgress?.(answer.done, answer.total)
      else if (answer.status === 'ok') resolve(answer)
      else reject(new VideoTaskFailed(answer.reason, answer.codec, answer.suggestion))
    }
    worker.onerror = () => reject(new VideoTaskFailed('failed'))
    worker.postMessage(request, transferablesOf(request))
  }).finally(() => worker.terminate())
}

// Results whose source sound couldn't be read, so useVideoJob can say so without every page passing the flag along.
export const resultsWithoutSound = new WeakSet<File>()

// The result as a file named after the input: "holiday.mov" → "holiday-trimmed.mp4".
export function resultFileOf(answer: { bytes?: Uint8Array; mimeType?: string; extension?: string; soundDropped?: boolean }, inputName: string, suffix: string) {
  const baseName = inputName.replace(/\.[^.]+$/, '') || 'video'
  const file = new File([answer.bytes as BlobPart], `${baseName}${suffix ? `-${suffix}` : ''}.${answer.extension}`, { type: answer.mimeType })
  if (answer.soundDropped) resultsWithoutSound.add(file)
  return file
}
