// Add text to video and Blur video area. The worker draws on every frame before encoding (`settings.overlay`); the page draws
// the same thing over the paused player as a preview. Places are fractions of the shown video, so they fit any preview size.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { localizePath, translateWithNodes, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import type { ToolProps } from '../registry'
import { STAMP_FONT_FAMILY } from '../pdf/PdfToolParts'
import { ActionButton, TimeRangeFields, fieldClass, formatDuration, useVideoInfos, useVideoJob, videoInfoOf } from './VideoToolParts'
import type { ReadVideo } from './VideoToolParts'
import { resultFileOf, runVideoTask } from './videoTasks'
import type { FrameBox, VideoContainer } from './videoTasks'

const VIDEO_CONTAINERS: VideoContainer[] = ['mp4', 'webm', 'mov', 'mkv']
// The result keeps the chosen file's container when the browser can write it (an .avi or .m4v becomes an MP4).
function containerOf(file: File): VideoContainer {
  const extension = file.name.split('.').pop()?.toLowerCase() as VideoContainer
  return VIDEO_CONTAINERS.includes(extension) ? extension : 'mp4'
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// The show-from and show-to times for the worker, left out when they cover the whole video.
function timesOf(start: number, end: number, durationSeconds: number) {
  return { fromSeconds: start > 0 ? start : undefined, toSeconds: end < durationSeconds - 0.05 ? end : undefined }
}

// The chosen video, paused on one frame, with layers drawn over it (`children`), a Play button and a slider to pick the frame.
function VideoStage({ idPrefix, file, read, videoRef, frameRef, children }: { idPrefix: string; file: File; read: ReadVideo | undefined; videoRef: RefObject<HTMLVideoElement | null>; frameRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const { t } = useT()
  const [address, setAddress] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setAddress(url)
    setCurrentTime(0)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const info = videoInfoOf(read)
  const durationSeconds = info?.durationSeconds ?? 0

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  return (
    <figure id={`${idPrefix}-stage`} className="flex flex-col items-center gap-2">
      {/* The video and the layers over it stay left to right on an Arabic page. */}
      <div ref={frameRef} dir="ltr" className="crop-frame rounded-[10px] bg-black">
        {address && (
          <video
            ref={videoRef}
            id={`${idPrefix}-player`}
            src={address}
            playsInline
            preload="auto"
            className="block max-h-[360px] max-w-full"
            aria-label={file.name}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
        {children}
      </div>
      <div dir="ltr" className="flex w-full max-w-[640px] items-center gap-3">
        <button id={`${idPrefix}-play-button`} type="button" onClick={togglePlay} className="btn btn--quiet btn--compact press">
          {isPlaying ? t('tools.video.stage.pause') : t('tools.video.stage.play')}
        </button>
        <input
          id={`${idPrefix}-seek`}
          type="range"
          min="0"
          max={durationSeconds}
          step="0.1"
          value={currentTime}
          disabled={durationSeconds === 0}
          aria-label={t('tools.video.stage.seek')}
          onChange={(event) => {
            const time = Number(event.target.value)
            setCurrentTime(time)
            if (videoRef.current) videoRef.current.currentTime = time
          }}
          className="min-h-11 flex-1"
        />
        <span className="text-sm text-ink-soft tabular-nums">
          {formatDuration(currentTime)} / {formatDuration(durationSeconds)}
        </span>
      </div>
      <figcaption className="text-center text-sm text-ink-soft">
        <bdi>{file.name}</bdi>
        {info?.video && (
          <>
            {' · '}
            <bdi dir="ltr">{`${info.video.width} × ${info.video.height}`}</bdi>
          </>
        )}
        {read && 'problem' in read && <span className="block text-danger">{t('tools.video.unreadable')}</span>}
        {info && !info.video && <span className="block text-danger">{t('tools.video.noVideo')}</span>}
      </figcaption>
    </figure>
  )
}

// The show-from and show-to fields, set to the whole video when a video is read.
function useShownTimes(file: File | undefined, durationSeconds: number) {
  const [times, setTimes] = useState({ start: 0, end: 0 })
  useEffect(() => setTimes({ start: 0, end: durationSeconds }), [file, durationSeconds])
  return [times, setTimes] as const
}

// ---------------------------------------------------------------- Add text to video

// `x`, `y` is a point of the video; `alignX`, `alignY` say which point of the text block sits on it (0 start, 0.5 middle, 1 end).
type TextPlace = { x: number; y: number; alignX: 0 | 0.5 | 1; alignY: 0 | 0.5 | 1 }
type TextLook = { text: string; sizePercent: number; color: string; hasBox: boolean; place: TextPlace }

const EDGE_GAP = 0.04
const ALIGNMENTS = [0, 0.5, 1] as const
const placeOf = (alignX: 0 | 0.5 | 1, alignY: 0 | 0.5 | 1): TextPlace => ({ x: EDGE_GAP + alignX * (1 - 2 * EDGE_GAP), y: EDGE_GAP + alignY * (1 - 2 * EDGE_GAP), alignX, alignY })
const PLACE_NAMES = [
  ['top-left', 'top-centre', 'top-right'],
  ['middle-left', 'centre', 'middle-right'],
  ['bottom-left', 'bottom-centre', 'bottom-right'],
]

const fontOf = (sizePixels: number) => `700 ${sizePixels}px ${STAMP_FONT_FAMILY}`
const fontSizeOf = (look: TextLook, frameHeight: number) => Math.max(8, (look.sizePercent / 100) * frameHeight)
// A line runs right to left when its first letter is Arabic, as the text box (dir="auto") shows it.
const startsRightToLeft = (line: string) => /^[^A-Za-z؀-ۿ]*[؀-ۿ]/.test(line)

// Draws the text on a transparent canvas the video's size (the fonts must be loaded first). Each line runs in its own direction,
// so Arabic lines run right to left; the browser joins the Arabic letters.
function drawTextLayer(canvas: HTMLCanvasElement, width: number, height: number, look: TextLook) {
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const lines = look.text.replace(/\s+$/, '').split('\n')
  if (!lines.some((line) => line.trim())) return
  const fontSize = fontSizeOf(look, height)
  context.font = fontOf(fontSize)
  const lineHeight = fontSize * 1.3
  const padding = look.hasBox ? fontSize * 0.4 : 0
  const blockWidth = Math.max(...lines.map((line) => context.measureText(line).width)) + 2 * padding
  const blockHeight = lines.length * lineHeight + 2 * padding
  const left = clamp(look.place.x * width - look.place.alignX * blockWidth, 0, Math.max(0, width - blockWidth))
  const top = clamp(look.place.y * height - look.place.alignY * blockHeight, 0, Math.max(0, height - blockHeight))
  if (look.hasBox) {
    context.fillStyle = 'rgba(0, 0, 0, 0.6)'
    context.beginPath()
    context.roundRect(left, top, blockWidth, blockHeight, fontSize * 0.25)
    context.fill()
  } else {
    context.shadowColor = 'rgba(0, 0, 0, 0.75)'
    context.shadowBlur = fontSize * 0.15
  }
  context.fillStyle = look.color
  context.textBaseline = 'middle'
  context.textAlign = look.place.alignX === 0 ? 'left' : look.place.alignX === 1 ? 'right' : 'center'
  const textX = left + padding + look.place.alignX * (blockWidth - 2 * padding)
  lines.forEach((line, index) => {
    context.direction = startsRightToLeft(line) ? 'rtl' : 'ltr'
    context.fillText(line, textX, top + padding + lineHeight * (index + 0.5))
  })
}

export function AddTextToVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const readByFile = useVideoInfos(files)
  const read = file && readByFile.get(file)
  const info = videoInfoOf(read)
  const durationSeconds = info?.durationSeconds ?? 0
  const [text, setText] = useState('')
  const [sizePercent, setSizePercent] = useState(8)
  const [color, setColor] = useState('#ffffff')
  const [hasBox, setHasBox] = useState(true)
  const [place, setPlace] = useState<TextPlace>(placeOf(0.5, 1))
  const [times, setTimes] = useShownTimes(file, durationSeconds)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startPlace: TextPlace } | null>(null)
  const job = useVideoJob(onResult)
  const frameWidth = info?.video?.width ?? 0
  const frameHeight = info?.video?.height ?? 0

  // The preview is the very picture the worker gets: drawn at the video's own size, then scaled down with the player.
  useEffect(() => {
    const canvas = layerRef.current
    if (!canvas || !frameWidth) return
    let isCurrent = true
    const look = { text, sizePercent, color, hasBox, place }
    void document.fonts.load(fontOf(fontSizeOf(look, frameHeight)), text || 'a').then(() => isCurrent && drawTextLayer(canvas, frameWidth, frameHeight, look))
    return () => {
      isCurrent = false
    }
  }, [text, sizePercent, color, hasBox, place, frameWidth, frameHeight])

  function startDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startX: event.clientX, startY: event.clientY, startPlace: place }
  }
  function moveDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag) return
    const { width, height } = event.currentTarget.getBoundingClientRect()
    setPlace({ ...drag.startPlace, x: clamp(drag.startPlace.x + (event.clientX - drag.startX) / width, 0, 1), y: clamp(drag.startPlace.y + (event.clientY - drag.startY) / height, 0, 1) })
  }
  // Arrow keys move the text by 1% of the video.
  function moveWithKeys(event: ReactKeyboardEvent) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    setPlace({ ...place, x: clamp(place.x + step[0], 0, 1), y: clamp(place.y + step[1], 0, 1) })
  }

  function addText() {
    if (!file || !frameWidth) return
    const look = { text, sizePercent, color, hasBox, place }
    void job.run(async (onProgress, signal) => {
      await document.fonts.load(fontOf(fontSizeOf(look, frameHeight)), text)
      const canvas = document.createElement('canvas')
      drawTextLayer(canvas, frameWidth, frameHeight, look)
      const picture = await createImageBitmap(canvas)
      const answer = await runVideoTask({ type: 'convert', file, settings: { container: containerOf(file), quality: 'high', overlay: { picture, ...timesOf(times.start, times.end, durationSeconds) } } }, onProgress, signal)
      return resultFileOf(answer, file.name, 'with-text')
    })
  }

  if (!file) return null
  return (
    <div id="add-text-to-video-tool" className="space-y-5 text-start">
      <VideoStage idPrefix="add-text-to-video" file={file} read={read} videoRef={videoRef} frameRef={frameRef}>
        {frameWidth > 0 && (
          <canvas
            ref={layerRef}
            id="add-text-to-video-layer"
            tabIndex={0}
            role="img"
            aria-label={t('tools.video.text.layer')}
            aria-describedby="add-text-to-video-move-hint"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => (dragRef.current = null)}
            onKeyDown={moveWithKeys}
            className="absolute inset-0 h-full w-full cursor-move touch-none focus-visible:outline-3 focus-visible:outline-accent"
          />
        )}
      </VideoStage>
      <p id="add-text-to-video-move-hint" className="text-center text-sm text-ink-soft">
        {t('tools.video.text.moveHint')}
      </p>
      <label className="mx-auto grid max-w-[640px] gap-1 text-sm font-medium">
        {t('tools.video.text.text')}
        <textarea id="add-text-to-video-text" dir="auto" rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={t('tools.video.text.placeholder')} className={`${fieldClass} py-2`} />
      </label>
      <div className="flex flex-wrap items-end justify-center gap-5">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.text.size', { size: sizePercent })}
          <input id="add-text-to-video-size" type="range" min="3" max="20" step="1" value={sizePercent} onChange={(event) => setSizePercent(Number(event.target.value))} className="min-h-11 w-44" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.text.color')}
          <input id="add-text-to-video-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="min-h-11 w-20 cursor-pointer rounded-md border-2 border-rule bg-paper-raised" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="add-text-to-video-box-checkbox" type="checkbox" checked={hasBox} onChange={(event) => setHasBox(event.target.checked)} className="size-5" />
          {t('tools.video.text.box')}
        </label>
      </div>
      <fieldset className="flex flex-col items-center gap-2">
        <legend className="mb-2 w-full text-center text-sm font-medium">{t('tools.video.text.position')}</legend>
        {/* Laid out as the video is, left to right, on both pages. */}
        <div dir="ltr" className="grid grid-cols-3 gap-2">
          {ALIGNMENTS.map((alignY, row) =>
            ALIGNMENTS.map((alignX, column) => {
              const name = PLACE_NAMES[row][column]
              const isChosen = place.alignX === alignX && place.alignY === alignY && place.x === placeOf(alignX, alignY).x && place.y === placeOf(alignX, alignY).y
              return (
                <button key={name} id={`add-text-to-video-place-${name}-button`} type="button" aria-pressed={isChosen} onClick={() => setPlace(placeOf(alignX, alignY))} className="btn btn--quiet btn--compact press">
                  {t(`tools.video.text.place.${name}` as MessageKey)}
                </button>
              )
            }),
          )}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 w-full text-center text-sm font-medium">{t('tools.video.text.when')}</legend>
        {durationSeconds > 0 && <TimeRangeFields idPrefix="add-text-to-video" durationSeconds={durationSeconds} start={times.start} end={times.end} onChange={(start, end) => setTimes({ start, end })} />}
      </fieldset>
      <ActionButton id="add-text-to-video-button" label={t('tools.video.text.button')} isDisabled={!text.trim() || !info?.video?.canDecode} isRunning={job.isRunning} onClick={addText} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Blur video area

type BlurBox = FrameBox & { id: number }
const BLUR_STRENGTHS = { light: 8, medium: 16, strong: 32 }
type BlurStrength = keyof typeof BLUR_STRENGTHS
const SMALLEST_BOX = 0.02

// The worker's blur on the page (videoTools.worker.ts `blurBox`): the box is shrunk and stretched back, twice.
function blurPart(context: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, strength: number) {
  if (width < 2 || height < 2) return
  const small = new OffscreenCanvas(Math.max(1, Math.round(width / strength)), Math.max(1, Math.round(height / strength)))
  const smallContext = small.getContext('2d')!
  smallContext.imageSmoothingQuality = 'high'
  smallContext.drawImage(context.canvas, left, top, width, height, 0, 0, small.width, small.height)
  smallContext.drawImage(small, 0, 0, small.width, small.height, 0, 0, Math.max(1, small.width / 2), Math.max(1, small.height / 2))
  smallContext.drawImage(small, 0, 0, Math.max(1, small.width / 2), Math.max(1, small.height / 2), 0, 0, small.width, small.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(small, left, top, width, height)
}

// A box moved or resized by a share of the video, kept inside it (drag and arrow keys).
function changedBox(start: BlurBox, mode: 'move' | 'resize', deltaX: number, deltaY: number): BlurBox {
  if (mode === 'move') return { ...start, x: clamp(start.x + deltaX, 0, 1 - start.width), y: clamp(start.y + deltaY, 0, 1 - start.height) }
  return { ...start, width: clamp(start.width + deltaX, SMALLEST_BOX, 1 - start.x), height: clamp(start.height + deltaY, SMALLEST_BOX, 1 - start.y) }
}

export function BlurVideoArea({ files, onResult }: ToolProps) {
  const { t, locale } = useT()
  const file = files[0]
  const readByFile = useVideoInfos(files)
  const read = file && readByFile.get(file)
  const info = videoInfoOf(read)
  const durationSeconds = info?.durationSeconds ?? 0
  const [boxes, setBoxes] = useState<BlurBox[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [strength, setStrength] = useState<BlurStrength>('medium')
  const [isPartOnly, setIsPartOnly] = useState(false)
  const [times, setTimes] = useShownTimes(file, durationSeconds)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const nextIdRef = useRef(1)
  const dragRef = useRef<{ mode: 'draw' | 'move' | 'resize'; startX: number; startY: number; startBox: BlurBox } | null>(null)
  const job = useVideoJob(onResult)

  // The shown frame with the boxes blurred, drawn again on every frame the player shows (after a seek, while playing).
  useEffect(() => {
    const video = videoRef.current
    const canvas = previewRef.current
    if (!video || !canvas || !info?.video) return
    const drawPreview = () => {
      if (video.readyState < 2) return
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const context = canvas.getContext('2d')!
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const isShown = !isPartOnly || (video.currentTime >= times.start && video.currentTime < times.end)
      if (!isShown) return
      for (const box of boxes) blurPart(context, box.x * canvas.width, box.y * canvas.height, box.width * canvas.width, box.height * canvas.height, BLUR_STRENGTHS[strength])
    }
    let frameRequest = 0
    const onFrame = () => {
      drawPreview()
      frameRequest = video.requestVideoFrameCallback(onFrame)
    }
    frameRequest = video.requestVideoFrameCallback(onFrame)
    video.addEventListener('loadeddata', drawPreview)
    video.addEventListener('seeked', drawPreview)
    drawPreview()
    return () => {
      video.cancelVideoFrameCallback(frameRequest)
      video.removeEventListener('loadeddata', drawPreview)
      video.removeEventListener('seeked', drawPreview)
    }
  }, [boxes, strength, isPartOnly, times, info])

  const pointOf = (event: ReactPointerEvent) => {
    const rect = frameRef.current!.getBoundingClientRect()
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) }
  }
  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = pointOf(event)
    const box = { id: nextIdRef.current++, x, y, width: 0, height: 0 }
    setBoxes([...boxes, box])
    setSelectedId(box.id)
    dragRef.current = { mode: 'draw', startX: x, startY: y, startBox: box }
  }
  function startDrag(event: ReactPointerEvent, box: BlurBox, mode: 'move' | 'resize') {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = pointOf(event)
    setSelectedId(box.id)
    dragRef.current = { mode, startX: x, startY: y, startBox: box }
  }
  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const { x, y } = pointOf(event)
    const box =
      drag.mode === 'draw'
        ? { ...drag.startBox, x: Math.min(x, drag.startX), y: Math.min(y, drag.startY), width: Math.abs(x - drag.startX), height: Math.abs(y - drag.startY) }
        : changedBox(drag.startBox, drag.mode, x - drag.startX, y - drag.startY)
    setBoxes((current) => current.map((each) => (each.id === box.id ? box : each)))
  }
  // A box drawn too small to see (a click on the video) is dropped.
  function endDrag() {
    if (dragRef.current?.mode === 'draw') setBoxes((current) => current.filter((box) => box.width >= SMALLEST_BOX && box.height >= SMALLEST_BOX))
    dragRef.current = null
  }
  function deleteBox(id: number) {
    setBoxes(boxes.filter((box) => box.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  function addBox() {
    const box = { id: nextIdRef.current++, x: 0.35, y: 0.35, width: 0.3, height: 0.3 }
    setBoxes([...boxes, box])
    setSelectedId(box.id)
  }
  // Arrow keys move the box by 1% of the video; with Shift they resize it. Delete removes it.
  function changeWithKeys(event: ReactKeyboardEvent, box: BlurBox) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteBox(box.id)
      return
    }
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    const changed = changedBox(box, event.shiftKey ? 'resize' : 'move', step[0], step[1])
    setBoxes(boxes.map((each) => (each.id === box.id ? changed : each)))
  }

  function blurVideo() {
    if (!file || boxes.length === 0) return
    const blurBoxes = boxes.map(({ x, y, width, height }) => ({ x, y, width, height }))
    const shownTimes = isPartOnly ? timesOf(times.start, times.end, durationSeconds) : {}
    void job.run(async (onProgress, signal) => {
      const answer = await runVideoTask({ type: 'convert', file, settings: { container: containerOf(file), quality: 'high', overlay: { blurBoxes, blurStrength: BLUR_STRENGTHS[strength], ...shownTimes } } }, onProgress, signal)
      return resultFileOf(answer, file.name, 'blurred')
    })
  }

  if (!file) return null
  return (
    <div id="blur-video-area-tool" className="space-y-5 text-start">
      <VideoStage idPrefix="blur-video-area" file={file} read={read} videoRef={videoRef} frameRef={frameRef}>
        {info?.video && (
          <div className="absolute inset-0" onPointerMove={moveDrag} onPointerUp={endDrag}>
            <canvas ref={previewRef} id="blur-video-area-preview" aria-hidden="true" onPointerDown={startDrawing} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" />
            {boxes.map((box, index) => (
              <div
                key={box.id}
                ref={(element) => {
                  if (!element) return
                  element.style.left = `${box.x * 100}%`
                  element.style.top = `${box.y * 100}%`
                  element.style.width = `${box.width * 100}%`
                  element.style.height = `${box.height * 100}%`
                }}
                id={`blur-video-area-box-${box.id}`}
                role="group"
                tabIndex={0}
                aria-label={t('tools.video.blur.box', { number: index + 1 })}
                aria-describedby="blur-video-area-keyboard-hint"
                onPointerDown={(event) => startDrag(event, box, 'move')}
                onKeyDown={(event) => changeWithKeys(event, box)}
                onFocus={() => setSelectedId(box.id)}
                className={`absolute cursor-move touch-none border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.6)] focus-visible:outline-3 focus-visible:outline-accent ${box.id === selectedId ? 'border-accent' : 'border-dashed border-white'}`}
              >
                <span className="crop-handle" aria-hidden="true" onPointerDown={(event) => startDrag(event, box, 'resize')} />
              </div>
            ))}
          </div>
        )}
      </VideoStage>
      <p className="text-center text-sm text-ink-soft">{t('tools.video.blur.drawHint')}</p>
      <p id="blur-video-area-keyboard-hint" className="sr-only">
        {t('tools.video.blur.keyboardHint')}
      </p>
      <div id="blur-video-area-box-list" className="flex flex-wrap items-center justify-center gap-2">
        {boxes.map((box, index) => (
          <button key={box.id} id={`blur-video-area-delete-box-${box.id}-button`} type="button" onClick={() => deleteBox(box.id)} className="btn btn--quiet btn--compact press">
            {t('tools.video.blur.deleteBox', { number: index + 1 })}
          </button>
        ))}
        <button id="blur-video-area-add-box-button" type="button" onClick={addBox} disabled={!info?.video} className="btn btn--quiet btn--compact press">
          {t('tools.video.blur.addBox')}
        </button>
      </div>
      <div className="flex flex-wrap items-end justify-center gap-5">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.blur.strength')}
          <select id="blur-video-area-strength" value={strength} onChange={(event) => setStrength(event.target.value as BlurStrength)} className={fieldClass}>
            {(Object.keys(BLUR_STRENGTHS) as BlurStrength[]).map((choice) => (
              <option key={choice} value={choice}>
                {t(`tools.video.blur.strength.${choice}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="blur-video-area-part-checkbox" type="checkbox" checked={isPartOnly} onChange={(event) => setIsPartOnly(event.target.checked)} className="size-5" />
          {t('tools.video.blur.partOnly')}
        </label>
      </div>
      {isPartOnly && durationSeconds > 0 && <TimeRangeFields idPrefix="blur-video-area" durationSeconds={durationSeconds} start={times.start} end={times.end} onChange={(start, end) => setTimes({ start, end })} />}
      <p id="blur-video-area-still-note" className="mx-auto max-w-[640px] text-center text-sm text-ink-soft">
        {translateWithNodes(locale, 'tools.video.blur.stillNote', {
          link: (
            <a id="blur-video-area-blur-face-link" href={localizePath(locale, '/blur-face')} className="underline">
              {t('tools.video.blur.blurFaceLink')}
            </a>
          ),
        })}
      </p>
      <ActionButton id="blur-video-area-button" label={t('tools.video.blur.button')} isDisabled={boxes.length === 0 || !info?.video?.canDecode} isRunning={job.isRunning} onClick={blurVideo} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}
