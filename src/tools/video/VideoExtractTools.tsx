// Video to MP3, Video to GIF and Extract video frames: the sound, a short animated picture or still pictures taken from one video.
import { useRef, useState } from 'react'
import { useT } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { ActionButton, TimeRangeFields, VideoPreview, fieldClass, useVideoInfos, useVideoJob, videoInfoOf } from './VideoToolParts'
import { resultFileOf, runVideoTask } from './videoTasks'
import type { AudioContainer } from './videoTasks'

type TimeRange = { start: number; end: number }

const OTHER_AUDIO_FORMATS: { container: AudioContainer; label: string }[] = [
  { container: 'm4a', label: 'M4A (AAC)' },
  { container: 'wav', label: 'WAV' },
  { container: 'ogg', label: 'OGG (Opus)' },
]
const MP3_BITRATES = [128, 192, 256, 320]

export function VideoToMp3({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const readByFile = useVideoInfos(files)
  const info = videoInfoOf(readByFile.get(file))
  const [container, setContainer] = useState<AudioContainer>('mp3')
  const [bitrateKbps, setBitrateKbps] = useState(192)
  const [isTrimmed, setIsTrimmed] = useState(false)
  const [chosenRange, setChosenRange] = useState<TimeRange | null>(null)
  const job = useVideoJob(onResult)
  const range = chosenRange ?? { start: 0, end: info?.durationSeconds ?? 0 }
  const hasNoSound = Boolean(info && !info.audio)

  function extractSound() {
    void job.run(async (onProgress, signal) => {
      const settings = { container, audioBitrate: container === 'mp3' ? bitrateKbps * 1000 : undefined, trim: isTrimmed ? range : undefined }
      return resultFileOf(await runVideoTask({ type: 'convert', file, settings }, onProgress, signal), file.name, '')
    })
  }

  if (!file) return null
  return (
    <div id="video-to-mp3-tool" className="space-y-5 text-start">
      <VideoPreview id="video-to-mp3-preview" file={file} read={readByFile.get(file)} />
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.mp3.format')}
          <select id="video-to-mp3-format-select" value={container} onChange={(event) => setContainer(event.target.value as AudioContainer)} className={fieldClass}>
            <option value="mp3">MP3</option>
            <optgroup label={t('tools.video.mp3.otherFormats')}>
              {OTHER_AUDIO_FORMATS.map((format) => (
                <option key={format.container} value={format.container}>
                  {format.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {container === 'mp3' && (
          <label className="grid gap-1 text-sm font-medium">
            {t('tools.video.mp3.bitrate')}
            <select id="video-to-mp3-bitrate-select" value={bitrateKbps} onChange={(event) => setBitrateKbps(Number(event.target.value))} className={fieldClass}>
              {MP3_BITRATES.map((bitrate) => (
                <option key={bitrate} value={bitrate}>
                  {t('tools.video.mp3.kbps', { bitrate })}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="flex min-h-11 items-center justify-center gap-2 font-medium">
        <input id="video-to-mp3-trim-checkbox" type="checkbox" checked={isTrimmed} onChange={(event) => setIsTrimmed(event.target.checked)} className="size-5" />
        {t('tools.video.mp3.trim')}
      </label>
      {isTrimmed && info && <TimeRangeFields idPrefix="video-to-mp3" durationSeconds={info.durationSeconds} start={range.start} end={range.end} onChange={(start, end) => setChosenRange({ start, end })} />}
      <Notice id="video-to-mp3-no-sound" kind="error" role="alert" className="text-center font-medium text-danger" message={hasNoSound ? t('tools.video.noAudio') : ''} />
      <ActionButton id="video-to-mp3-button" label={t('tools.video.mp3.button', { format: container.toUpperCase() })} isDisabled={!info || hasNoSound} isRunning={job.isRunning} onClick={extractSound} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// A GIF repeats every pixel of every frame, so a long one gets very large: 30 seconds at most.
const GIF_MAX_SECONDS = 30
const GIF_WIDTHS = [240, 320, 480, 640]
const GIF_FRAME_RATES = [5, 10, 15, 20]
const GIF_MANY_FRAMES = 300
const evenSize = (size: number) => Math.max(2, Math.round(size / 2) * 2)

export function VideoToGif({ files, onResult }: ToolProps) {
  const { t, tp } = useT()
  const file = files[0]
  const readByFile = useVideoInfos(files)
  const info = videoInfoOf(readByFile.get(file))
  const [chosenRange, setChosenRange] = useState<TimeRange | null>(null)
  // Re-drawn when an end past 30 seconds is pulled back, so the fields show the kept end.
  const [rangeFieldsKey, setRangeFieldsKey] = useState(0)
  const [width, setWidth] = useState(480)
  const [frameRate, setFrameRate] = useState(10)
  const job = useVideoJob(onResult)
  const duration = info?.durationSeconds ?? 0
  const range = chosenRange ?? { start: 0, end: Math.min(5, duration) }
  const frameCount = Math.ceil((range.end - range.start) * frameRate - 1e-6)
  const gifWidth = info?.video ? evenSize(Math.min(width, info.video.width)) : width
  const gifHeight = info?.video ? evenSize((info.video.height * gifWidth) / info.video.width) : 0

  function changeRange(start: number, end: number) {
    const keptEnd = Math.min(end, start + GIF_MAX_SECONDS)
    if (keptEnd !== end) setRangeFieldsKey((key) => key + 1)
    setChosenRange({ start, end: keptEnd })
  }

  function makeGif() {
    void job.run(async (onProgress, signal) => resultFileOf(await runVideoTask({ type: 'gif', file, start: range.start, end: range.end, frameRate, width }, onProgress, signal), file.name, ''))
  }

  if (!file) return null
  return (
    <div id="video-to-gif-tool" className="space-y-5 text-start">
      <VideoPreview id="video-to-gif-preview" file={file} read={readByFile.get(file)} />
      {info && <TimeRangeFields key={rangeFieldsKey} idPrefix="video-to-gif" durationSeconds={duration} start={range.start} end={range.end} onChange={changeRange} />}
      <p id="video-to-gif-length-note" className="text-center text-sm text-ink-soft">
        {t('tools.video.gif.maxLength', { seconds: GIF_MAX_SECONDS })}
      </p>
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.gif.width')}
          <select id="video-to-gif-width-select" value={width} onChange={(event) => setWidth(Number(event.target.value))} className={fieldClass}>
            {GIF_WIDTHS.map((choice) => (
              <option key={choice} value={choice}>
                {t('tools.video.extract.pixels', { size: choice })}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.gif.frameRate')}
          <select id="video-to-gif-frame-rate-select" value={frameRate} onChange={(event) => setFrameRate(Number(event.target.value))} className={fieldClass}>
            {GIF_FRAME_RATES.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>
      </div>
      {info?.video && (
        <p id="video-to-gif-estimate" className="text-center text-sm font-medium">
          {tp('tools.video.gif.estimate', frameCount)} · <bdi dir="ltr">{`${gifWidth} × ${gifHeight}`}</bdi>
        </p>
      )}
      <Notice id="video-to-gif-many-frames" kind="warning" role="status" className="text-center text-sm font-medium text-danger" message={frameCount > GIF_MANY_FRAMES ? t('tools.video.gif.manyFrames') : ''} />
      <ActionButton id="video-to-gif-button" label={t('tools.video.gif.button')} isDisabled={!info?.video || frameCount < 1} isRunning={job.isRunning} onClick={makeGif} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

type FramesMode = 'every' | 'spread' | 'current'
const FRAME_GAPS_SECONDS = [1, 2, 5, 10, 30, 60]
const FRAME_MAX_WIDTHS = [0, 1920, 1280, 640, 320]
const MAX_FRAMES = 500

// The times of the pictures to take: every few seconds from the start, a number spread evenly (each in the middle of its share of
// the video), or the player's paused frame.
function frameTimesOf(mode: FramesMode, duration: number, gapSeconds: number, spreadCount: number, currentTime: number) {
  if (mode === 'current') return [currentTime]
  if (mode === 'spread') return Array.from({ length: spreadCount }, (_, index) => ((index + 0.5) * duration) / spreadCount)
  return Array.from({ length: Math.ceil(duration / gapSeconds - 1e-6) }, (_, index) => index * gapSeconds)
}

export function ExtractVideoFrames({ files, onResult }: ToolProps) {
  const { t, tp } = useT()
  const file = files[0]
  const readByFile = useVideoInfos(files)
  const info = videoInfoOf(readByFile.get(file))
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<FramesMode>('every')
  const [gapSeconds, setGapSeconds] = useState(1)
  const [spreadCount, setSpreadCount] = useState(10)
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [maxWidth, setMaxWidth] = useState(0)
  const job = useVideoJob(onResult)
  const duration = info?.durationSeconds ?? 0
  const plannedCount = mode === 'current' ? 1 : frameTimesOf(mode, duration, gapSeconds, spreadCount, 0).length
  const pictureCount = Math.min(plannedCount, MAX_FRAMES)

  function saveFrames() {
    const times = frameTimesOf(mode, duration, gapSeconds, spreadCount, videoRef.current?.currentTime ?? 0).slice(0, MAX_FRAMES)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video'
    void job.run(async (onProgress, signal) => resultFileOf(await runVideoTask({ type: 'frames', file, times, format, maxWidth: maxWidth || undefined, baseName }, onProgress, signal), file.name, times.length === 1 ? 'frame' : 'frames'))
  }

  if (!file) return null
  return (
    <div id="extract-video-frames-tool" className="space-y-5 text-start">
      <VideoPreview id="extract-video-frames-preview" file={file} read={readByFile.get(file)} videoRef={videoRef} />
      <fieldset className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <legend className="sr-only">{t('tools.video.frames.mode')}</legend>
        {(['every', 'spread', 'current'] as const).map((choice) => (
          <label key={choice} className="inline-flex min-h-11 items-center gap-2 font-medium">
            <input id={`extract-video-frames-${choice}-radio`} type="radio" name="extract-video-frames-mode" checked={mode === choice} onChange={() => setMode(choice)} className="size-5" />
            {t(`tools.video.frames.mode.${choice}`)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end justify-center gap-4">
        {mode === 'every' && (
          <label className="grid gap-1 text-sm font-medium">
            {t('tools.video.frames.gap')}
            <select id="extract-video-frames-gap-select" value={gapSeconds} onChange={(event) => setGapSeconds(Number(event.target.value))} className={fieldClass}>
              {FRAME_GAPS_SECONDS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {t('tools.video.frames.seconds', { seconds })}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'spread' && (
          <label className="grid gap-1 text-sm font-medium">
            {t('tools.video.frames.count')}
            <input id="extract-video-frames-count-input" type="number" min="1" max={MAX_FRAMES} dir="ltr" value={spreadCount || ''} onChange={(event) => setSpreadCount(Math.min(MAX_FRAMES, Math.max(0, Math.round(Number(event.target.value) || 0))))} className={`${fieldClass} w-28`} />
          </label>
        )}
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.frames.format')}
          <select id="extract-video-frames-format-select" value={format} onChange={(event) => setFormat(event.target.value as 'png' | 'jpg')} className={fieldClass}>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.frames.maxWidth')}
          <select id="extract-video-frames-width-select" value={maxWidth} onChange={(event) => setMaxWidth(Number(event.target.value))} className={fieldClass}>
            {FRAME_MAX_WIDTHS.map((choice) => (
              <option key={choice} value={choice}>
                {choice === 0 ? t('tools.video.frames.originalSize') : t('tools.video.extract.pixels', { size: choice })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {info && (
        <p id="extract-video-frames-count-note" className="text-center text-sm font-medium">
          {mode === 'current' ? t('tools.video.frames.currentHint') : tp('tools.video.frames.willMake', pictureCount)}
        </p>
      )}
      <Notice id="extract-video-frames-capped" kind="warning" role="status" className="text-center text-sm font-medium text-danger" message={plannedCount > MAX_FRAMES ? t('tools.video.frames.capped', { max: MAX_FRAMES }) : ''} />
      <ActionButton id="extract-video-frames-button" label={tp('tools.video.frames.button', pictureCount)} isDisabled={!info?.video || pictureCount < 1} isRunning={job.isRunning} onClick={saveFrames} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}
