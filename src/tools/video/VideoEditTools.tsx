// The one-video edit pages: compress, trim, crop, rotate, flip and resize. Each works on the first chosen video and makes the
// result in the video worker ('convert'): MP4, WebM, MOV and MKV keep their format, any other video becomes MP4.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { isolateLeftToRight, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { formatFileSize } from '../../useFileIntake'
import type { ToolProps } from '../registry'
import { ActionButton, TimeRangeFields, VideoPreview, fieldClass, formatDuration, useVideoInfos, useVideoJob, videoInfoOf } from './VideoToolParts'
import { resultFileOf, runVideoTask } from './videoTasks'
import type { ConvertSettings, FrameBox, VideoContainer, VideoQuality } from './videoTasks'

const KEPT_CONTAINERS: VideoContainer[] = ['mp4', 'webm', 'mov', 'mkv']
const choiceClass = 'btn btn--quiet btn--compact press aria-pressed:bg-accent/20'
const MEGABYTE = 1024 * 1024

function outputContainerOf(fileName: string): VideoContainer {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return KEPT_CONTAINERS.find((container) => container === extension) ?? 'mp4'
}

const evenUp = (size: number) => Math.ceil(size / 2) * 2

// The first chosen video made again with these settings, named like "clip-trimmed.mp4".
function convertVideo(file: File, suffix: string, settings: Omit<ConvertSettings, 'container'>) {
  return async (onProgress: (done: number, total: number) => void, signal: AbortSignal) => {
    const answer = await runVideoTask({ type: 'convert', file, settings: { container: outputContainerOf(file.name), ...settings } }, onProgress, signal)
    return resultFileOf(answer, file.name, suffix)
  }
}

// The first chosen video, its facts once read, and the run.
function useFirstVideo(files: File[], onResult: (file: File) => void) {
  const readByFile = useVideoInfos(files)
  const file = files[0] as File | undefined
  const read = file && readByFile.get(file)
  return { file, read, info: videoInfoOf(read), job: useVideoJob(onResult) }
}

// A still of the video half a second in, for the crop box and the turned previews; `transform` turns or mirrors it.
function VideoStill({ file, className, transform }: { file: File; className: string; transform?: string }) {
  const [address, setAddress] = useState('')
  const stillRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setAddress(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (stillRef.current) stillRef.current.style.transform = transform ?? ''
  }, [transform, address])
  return address ? <video ref={stillRef} src={`${address}#t=0.5`} muted playsInline preload="auto" className={className} aria-label={file.name} draggable={false} /> : null
}

// The new width or height when the shorter side becomes `shortSide`; the worker works out the other side, keeping the shape.
function shortSideSize(width: number, height: number, shortSide: number) {
  return width >= height ? { height: shortSide } : { width: shortSide }
}

// The size the worker makes from a wanted width and/or height (one side alone keeps the shape, both are a box).
function madeSizeOf(width: number, height: number, wanted: { width?: number; height?: number }) {
  if (wanted.width && wanted.height) return { width: evenUp(wanted.width), height: evenUp(wanted.height) }
  if (wanted.width) return { width: evenUp(wanted.width), height: evenUp(Math.round((wanted.width * height) / width)) }
  if (wanted.height) return { width: evenUp(Math.round((wanted.height * width) / height)), height: evenUp(wanted.height) }
  return { width, height }
}

// ---------------------------------------------------------------- Compress

const QUALITY_CHOICES: { quality: VideoQuality; label: MessageKey }[] = [
  { quality: 'very-low', label: 'tools.video.compress.smallest' },
  { quality: 'low', label: 'tools.video.compress.small' },
  { quality: 'medium', label: 'tools.video.compress.balanced' },
  { quality: 'high', label: 'tools.video.compress.best' },
]
const SMALLER_SIDES = [1080, 720, 480]
const AUDIO_BITRATE = 96_000
const LOWEST_VIDEO_BITRATE = 150_000
// The quality estimate compresses this many seconds from the start and scales the size up to the whole video.
const SAMPLE_SECONDS = 3

export function CompressVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const { file, read, info, job } = useFirstVideo(files, onResult)
  const [mode, setMode] = useState<'quality' | 'size'>('quality')
  const [quality, setQuality] = useState<VideoQuality>('low')
  const [typedTarget, setTypedTarget] = useState<string | null>(null)
  const [shortSide, setShortSide] = useState(0)
  const [sample, setSample] = useState<{ file: File; quality: VideoQuality; shortSide: number; estimate: number } | null>(null)
  const durationSeconds = info?.durationSeconds ?? 0
  const width = info?.video?.width ?? 0
  const height = info?.video?.height ?? 0

  useEffect(() => {
    if (!file || !info?.video || mode !== 'quality') return
    const controller = new AbortController()
    const sampleSeconds = Math.min(SAMPLE_SECONDS, info.durationSeconds)
    const resize = shortSide ? shortSideSize(info.video.width, info.video.height, shortSide) : {}
    const timer = window.setTimeout(() => {
      runVideoTask({ type: 'convert', file, settings: { container: outputContainerOf(file.name), quality, trim: { start: 0, end: sampleSeconds }, ...resize } }, undefined, controller.signal)
        .then((answer) => setSample({ file, quality, shortSide, estimate: ((answer.bytes?.length ?? 0) * info.durationSeconds) / sampleSeconds }))
        .catch(() => {})
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [file, info, mode, quality, shortSide])

  // The estimate measured for these settings, or none yet.
  const sampleEstimate = sample && sample.file === file && sample.quality === quality && sample.shortSide === shortSide ? sample.estimate : null
  // Half the file, as the first suggestion.
  const targetText = typedTarget ?? (file ? String(Number((file.size / 2 / MEGABYTE).toPrecision(2))) : '')
  const resize = shortSide ? shortSideSize(width, height, shortSide) : {}
  const targetBytes = Number(targetText.replace(',', '.')) * MEGABYTE
  const audioBitrate = info?.audio ? AUDIO_BITRATE : 0
  // Aimed 3% under the target: the encoders tend to land a little over the bitrate asked for.
  const videoBitrate = durationSeconds > 0 ? Math.round((targetBytes * 0.97 * 8) / durationSeconds - audioBitrate) : 0
  let sizeProblem = ''
  if (mode === 'size' && file && info) {
    if (!(targetBytes > 0)) sizeProblem = t('tools.video.compress.invalidSize')
    else if (videoBitrate < LOWEST_VIDEO_BITRATE) sizeProblem = t('tools.video.compress.tooSmall', { size: isolateLeftToRight(formatFileSize(Math.ceil(((LOWEST_VIDEO_BITRATE + audioBitrate) * durationSeconds) / 8))) })
    else if (targetBytes >= file.size) sizeProblem = t('tools.video.compress.alreadySmaller')
  }
  const estimate = mode === 'size' ? (sizeProblem ? null : targetBytes) : sampleEstimate
  const isNotSmaller = mode === 'quality' && file !== undefined && sampleEstimate !== null && sampleEstimate >= file.size

  function compress() {
    if (!file) return
    const settings = mode === 'size' ? { videoBitrate, audioBitrate: audioBitrate || undefined, ...resize } : { quality, ...resize }
    void job.run(convertVideo(file, 'compressed', settings))
  }

  return (
    <div id="compress-video-tool" className="space-y-5 text-start">
      {file && <VideoPreview id="compress-video-preview" file={file} read={read} />}
      <fieldset className="flex flex-wrap items-center justify-center gap-2">
        <legend className="sr-only">{t('tools.video.compress.how')}</legend>
        <button id="compress-video-by-quality-button" type="button" aria-pressed={mode === 'quality'} onClick={() => setMode('quality')} className={choiceClass}>
          {t('tools.video.compress.byQuality')}
        </button>
        <button id="compress-video-by-size-button" type="button" aria-pressed={mode === 'size'} onClick={() => setMode('size')} className={choiceClass}>
          {t('tools.video.compress.bySize')}
        </button>
      </fieldset>
      <div className="flex flex-wrap items-end justify-center gap-4">
        {mode === 'quality' ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.video.compress.quality')}
            <select id="compress-video-quality-select" value={quality} onChange={(event) => setQuality(event.target.value as VideoQuality)} className={fieldClass}>
              {QUALITY_CHOICES.map((choice) => (
                <option key={choice.quality} value={choice.quality}>
                  {t(choice.label)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.video.compress.target')}
            <input id="compress-video-target-input" dir="ltr" inputMode="decimal" value={targetText} onChange={(event) => setTypedTarget(event.target.value)} className={`${fieldClass} w-32 text-center`} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.video.compress.resolution')}
          <select id="compress-video-resolution-select" value={shortSide} onChange={(event) => setShortSide(Number(event.target.value))} className={fieldClass}>
            <option value={0}>{t('tools.video.compress.keepSize')}</option>
            {SMALLER_SIDES.filter((side) => side < Math.min(width, height)).map((side) => (
              <option key={side} value={side}>
                {side}p
              </option>
            ))}
          </select>
        </label>
      </div>
      {file && info && (
        <p id="compress-video-estimate" className="text-center font-medium" aria-live="polite">
          {t('tools.video.compress.original', { size: isolateLeftToRight(formatFileSize(file.size)) })}
          {' · '}
          {estimate !== null ? t('tools.video.compress.estimate', { size: isolateLeftToRight(formatFileSize(Math.round(estimate))) }) : mode === 'quality' ? t('tools.video.compress.estimating') : ''}
        </p>
      )}
      <Notice id="compress-video-size-problem" kind="info" role="status" className="text-center text-sm text-ink-soft" message={sizeProblem} />
      <Notice id="compress-video-not-smaller" kind="info" role="status" className="text-center text-sm text-ink-soft" message={isNotSmaller ? t('tools.video.compress.notSmaller') : ''} />
      <ActionButton id="compress-video-button" label={t('tools.video.compress.button')} isDisabled={!info?.video || sizeProblem !== ''} isRunning={job.isRunning} onClick={compress} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Trim

export function TrimVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const { file, read, info, job } = useFirstVideo(files, onResult)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [chosenRange, setChosenRange] = useState<{ start: number; end: number } | null>(null)
  const durationSeconds = info?.durationSeconds ?? 0
  const range = chosenRange ?? { start: 0, end: durationSeconds }

  function setEdgeFromPlayer(edge: 'start' | 'end') {
    const time = Math.min(Math.max(videoRef.current?.currentTime ?? 0, 0), durationSeconds)
    setChosenRange(edge === 'start' ? { start: Math.max(0, Math.min(time, range.end - 0.1)), end: range.end } : { start: range.start, end: Math.min(durationSeconds, Math.max(time, range.start + 0.1)) })
  }

  const keepsEverything = range.start <= 0 && range.end >= durationSeconds
  return (
    <div id="trim-video-tool" className="space-y-5 text-start">
      {file && <VideoPreview id="trim-video-preview" file={file} read={read} videoRef={videoRef} />}
      {info && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            <button id="trim-video-set-start-button" type="button" onClick={() => setEdgeFromPlayer('start')} className="btn btn--quiet btn--compact press">
              {t('tools.video.trim.setStart')}
            </button>
            <button id="trim-video-set-end-button" type="button" onClick={() => setEdgeFromPlayer('end')} className="btn btn--quiet btn--compact press">
              {t('tools.video.trim.setEnd')}
            </button>
          </div>
          <TimeRangeFields idPrefix="trim-video" durationSeconds={durationSeconds} start={range.start} end={range.end} onChange={(start, end) => setChosenRange({ start, end })} />
          <p id="trim-video-length" className="text-center font-medium" aria-live="polite">
            {t('tools.video.trim.length', { length: isolateLeftToRight(formatDuration(range.end - range.start)) })}
          </p>
        </>
      )}
      <ActionButton id="trim-video-button" label={t('tools.video.trim.button')} isDisabled={!info?.video || keepsEverything} isRunning={job.isRunning} onClick={() => file && void job.run(convertVideo(file, 'trimmed', { trim: range }))} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Crop

const CROP_SHAPES = [
  { id: 'free', ratio: 0 },
  { id: 'square', ratio: 1 },
  { id: '9-16', ratio: 9 / 16 },
  { id: '16-9', ratio: 16 / 9 },
  { id: '4-5', ratio: 4 / 5 },
] as const

// The largest centred box with this shape (width / height, in pixels) inside the picture, a little smaller, as fractions.
function centredBox(width: number, height: number, ratio: number): FrameBox {
  if (!ratio) return { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
  const pictureRatio = width / height
  const boxWidth = pictureRatio > ratio ? ratio / pictureRatio : 1
  const boxHeight = pictureRatio > ratio ? 1 : pictureRatio / ratio
  return { x: (1 - boxWidth * 0.9) / 2, y: (1 - boxHeight * 0.9) / 2, width: boxWidth * 0.9, height: boxHeight * 0.9 }
}

export function CropVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const { file, read, info, job } = useFirstVideo(files, onResult)
  const [shapeId, setShapeId] = useState<(typeof CROP_SHAPES)[number]['id']>('free')
  const [movedBox, setMovedBox] = useState<FrameBox | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startBox: FrameBox } | null>(null)
  const ratio = CROP_SHAPES.find((shape) => shape.id === shapeId)!.ratio
  const width = info?.video?.width ?? 0
  const height = info?.video?.height ?? 0

  const box = movedBox ?? centredBox(width, height, ratio)
  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    element.style.left = `${box.x * 100}%`
    element.style.top = `${box.y * 100}%`
    element.style.width = `${box.width * 100}%`
    element.style.height = `${box.height * 100}%`
  }, [box, info])

  function startDrag(event: ReactPointerEvent, mode: 'move' | 'resize') {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, startBox: box }
  }
  // The box moved or resized by a share of the picture, kept inside it (drag and arrow keys).
  function changedBox(start: FrameBox, mode: 'move' | 'resize', deltaX: number, deltaY: number): FrameBox {
    if (mode === 'move') return { ...start, x: Math.min(Math.max(start.x + deltaX, 0), 1 - start.width), y: Math.min(Math.max(start.y + deltaY, 0), 1 - start.height) }
    let boxWidth = Math.min(Math.max(start.width + deltaX, 0.05), 1 - start.x)
    let boxHeight = Math.min(Math.max(start.height + deltaY, 0.05), 1 - start.y)
    // A fixed shape is kept in pixels, so the box's fractions follow the picture's own shape.
    if (ratio) {
      boxHeight = (boxWidth * width) / ratio / height
      if (start.y + boxHeight > 1) {
        boxHeight = 1 - start.y
        boxWidth = (boxHeight * height * ratio) / width
      }
    }
    return { ...start, width: boxWidth, height: boxHeight }
  }
  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    const frame = frameRef.current
    if (!drag || !frame) return
    setMovedBox(changedBox(drag.startBox, drag.mode, (event.clientX - drag.startX) / frame.clientWidth, (event.clientY - drag.startY) / frame.clientHeight))
  }
  // Arrow keys move the box by 1% of the picture; with Shift they resize it.
  function moveWithKeys(event: ReactKeyboardEvent) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }
    if (!steps[event.key]) return
    event.preventDefault()
    setMovedBox(changedBox(box, event.shiftKey ? 'resize' : 'move', steps[event.key][0], steps[event.key][1]))
  }

  const pixelSize = info?.video ? `${evenUp(box.width * width)} × ${evenUp(box.height * height)}` : ''
  const cropFrame = file && info?.video && (
    <div className="flex flex-col items-center gap-2">
      {/* The picture itself stays left to right on an Arabic page. */}
      <div ref={frameRef} dir="ltr" className="crop-frame" onPointerMove={moveDrag} onPointerUp={() => (dragRef.current = null)}>
        <VideoStill file={file} className="crop-picture" />
        <div ref={boxRef} id="crop-video-box" className="crop-box" role="group" tabIndex={0} aria-label={t('tools.video.crop.box', { size: pixelSize })} aria-describedby="crop-video-keyboard-hint" onKeyDown={moveWithKeys} onPointerDown={(event) => startDrag(event, 'move')}>
          <span className="crop-handle" onPointerDown={(event) => startDrag(event, 'resize')} aria-hidden="true" />
        </div>
      </div>
      <p id="crop-video-size" className="text-sm text-ink-soft" dir="ltr">
        {pixelSize}
      </p>
      <p id="crop-video-keyboard-hint" className="sr-only">
        {t('tools.video.crop.keyboardHint')}
      </p>
    </div>
  )
  return (
    <div id="crop-video-tool" className="space-y-5 text-start">
      <fieldset className="flex flex-wrap items-center justify-center gap-2">
        <legend className="sr-only">{t('tools.video.crop.shape')}</legend>
        {CROP_SHAPES.map((shape) => (
          <button key={shape.id} id={`crop-video-shape-${shape.id}-button`} type="button" aria-pressed={shapeId === shape.id} onClick={() => {
              setShapeId(shape.id)
              setMovedBox(null)
            }} className={choiceClass}>
            {t(`tools.video.crop.shape.${shape.id}` as MessageKey)}
          </button>
        ))}
      </fieldset>
      {file && <VideoPreview id="crop-video-preview" file={file} read={read} picture={cropFrame || <div />} />}
      <ActionButton id="crop-video-button" label={t('tools.video.crop.button')} isDisabled={!info?.video} isRunning={job.isRunning} onClick={() => file && void job.run(convertVideo(file, 'cropped', { crop: box }))} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Rotate and flip

// The first video's still, turned or mirrored as the result will be, in a square box.
function TurnedPreview({ file, transform }: { file: File; transform: string }) {
  return (
    <div className="rotate-preview" dir="ltr">
      <VideoStill file={file} className="rotate-preview-picture" transform={transform} />
    </div>
  )
}

export function RotateVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const { file, read, info, job } = useFirstVideo(files, onResult)
  const [quarterTurns, setQuarterTurns] = useState(0)
  const turn = (by: number) => setQuarterTurns((current) => (((current + by) % 4) + 4) % 4)

  const isSideways = quarterTurns % 2 === 1
  const newSize = info?.video && (isSideways ? `${info.video.height} × ${info.video.width}` : `${info.video.width} × ${info.video.height}`)
  const buttons: [string, MessageKey, number][] = [
    ['left', 'tools.video.rotate.left', -1],
    ['right', 'tools.video.rotate.right', 1],
    ['half', 'tools.video.rotate.half', 2],
  ]
  return (
    <div id="rotate-video-tool" className="space-y-5 text-start">
      <div className="flex flex-wrap justify-center gap-2">
        {buttons.map(([id, label, by]) => (
          <button key={id} id={`rotate-video-${id}-button`} type="button" onClick={() => turn(by)} className="btn btn--quiet btn--compact press">
            {t(label)}
          </button>
        ))}
      </div>
      {file && <VideoPreview id="rotate-video-preview" file={file} read={read} picture={<TurnedPreview file={file} transform={`rotate(${quarterTurns * 90}deg)`} />} />}
      {newSize && quarterTurns !== 0 && (
        <p id="rotate-video-new-size" className="text-center font-medium">
          {t('tools.video.edit.newSize')} <bdi dir="ltr">{newSize}</bdi>
        </p>
      )}
      <ActionButton id="rotate-video-button" label={t('tools.video.rotate.button')} isDisabled={!info?.video || quarterTurns === 0} isRunning={job.isRunning} onClick={() => file && void job.run(convertVideo(file, 'rotated', { rotate: (quarterTurns * 90) as 90 | 180 | 270 }))} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

export function FlipVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const { file, read, info, job } = useFirstVideo(files, onResult)
  const [flip, setFlip] = useState<'horizontal' | 'vertical'>('horizontal')
  return (
    <div id="flip-video-tool" className="space-y-5 text-start">
      <fieldset className="flex flex-wrap items-center justify-center gap-2">
        <legend className="sr-only">{t('tools.video.flip.direction')}</legend>
        <button id="flip-video-horizontal-button" type="button" aria-pressed={flip === 'horizontal'} onClick={() => setFlip('horizontal')} className={choiceClass}>
          {t('tools.video.flip.horizontal')}
        </button>
        <button id="flip-video-vertical-button" type="button" aria-pressed={flip === 'vertical'} onClick={() => setFlip('vertical')} className={choiceClass}>
          {t('tools.video.flip.vertical')}
        </button>
      </fieldset>
      {file && <VideoPreview id="flip-video-preview" file={file} read={read} picture={<TurnedPreview file={file} transform={flip === 'horizontal' ? 'scaleX(-1)' : 'scaleY(-1)'} />} />}
      <ActionButton id="flip-video-button" label={t('tools.video.flip.button')} isDisabled={!info?.video} isRunning={job.isRunning} onClick={() => file && void job.run(convertVideo(file, 'flipped', { flip }))} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Resize

// Sizes by their shorter side keep the video's shape; the fixed boxes fit the whole picture inside, with black bars.
const RESIZE_PRESETS: { id: string; shortSide?: number; width?: number; height?: number }[] = [
  { id: '1080p', shortSide: 1080 },
  { id: '720p', shortSide: 720 },
  { id: '480p', shortSide: 480 },
  { id: '360p', shortSide: 360 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'story', width: 1080, height: 1920 },
  { id: 'custom' },
]
const LARGEST_SIDE = 7680

export function ResizeVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const { file, read, info, job } = useFirstVideo(files, onResult)
  const [presetId, setPresetId] = useState('720p')
  const [typedWidth, setTypedWidth] = useState<string | null>(null)
  const [typedHeight, setTypedHeight] = useState<string | null>(null)
  const [keepsShape, setKeepsShape] = useState(true)
  const width = info?.video?.width ?? 0
  const height = info?.video?.height ?? 0

  const customWidth = typedWidth ?? String(width)
  const customHeight = typedHeight ?? String(height)

  const preset = RESIZE_PRESETS.find((choice) => choice.id === presetId)!
  let wanted: { width?: number; height?: number }
  if (preset.shortSide) wanted = shortSideSize(width, height, preset.shortSide)
  else if (preset.width) wanted = { width: preset.width, height: preset.height }
  else wanted = keepsShape ? { width: Number(customWidth) } : { width: Number(customWidth), height: Number(customHeight) }
  const made = width && height ? madeSizeOf(width, height, wanted) : null
  const isValid = made !== null && [made.width, made.height].every((side) => Number.isInteger(side) && side >= 16 && side <= LARGEST_SIDE)
  const changesShape = isValid && Math.abs(made.width / made.height - width / height) > 0.01

  return (
    <div id="resize-video-tool" className="space-y-5 text-start">
      {file && <VideoPreview id="resize-video-preview" file={file} read={read} />}
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.video.resize.size')}
          <select id="resize-video-size-select" value={presetId} onChange={(event) => setPresetId(event.target.value)} className={fieldClass}>
            {RESIZE_PRESETS.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {t(`tools.video.resize.preset.${choice.id}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        {presetId === 'custom' && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.video.resize.width')}
              <input id="resize-video-width-input" dir="ltr" inputMode="numeric" value={customWidth} onChange={(event) => setTypedWidth(event.target.value)} className={`${fieldClass} w-28 text-center`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.video.resize.height')}
              <input id="resize-video-height-input" dir="ltr" inputMode="numeric" value={keepsShape ? String(made?.height ?? '') : customHeight} disabled={keepsShape} onChange={(event) => setTypedHeight(event.target.value)} className={`${fieldClass} w-28 text-center`} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input id="resize-video-keep-shape-checkbox" type="checkbox" checked={keepsShape} onChange={(event) => setKeepsShape(event.target.checked)} className="size-5" />
              {t('tools.video.resize.keepShape')}
            </label>
          </>
        )}
      </div>
      {isValid && (
        <p id="resize-video-new-size" className="text-center font-medium">
          {t('tools.video.edit.newSize')} <bdi dir="ltr">{`${made.width} × ${made.height}`}</bdi>
        </p>
      )}
      {changesShape && <p id="resize-video-bars-note" className="text-center text-sm text-ink-soft">{t('tools.video.resize.bars')}</p>}
      <ActionButton id="resize-video-button" label={t('tools.video.resize.button')} isDisabled={!info?.video || !isValid} isRunning={job.isRunning} onClick={() => file && void job.run(convertVideo(file, 'resized', wanted))} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}
