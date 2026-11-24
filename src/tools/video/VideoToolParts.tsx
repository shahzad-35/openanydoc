// Shared by the video tools: reading each chosen video's facts once (useVideoInfos), the player with the facts under it, the start
// and end fields, the codec message, and the run with its progress bar and Cancel button (useVideoJob).
import { useEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { formatFileSize } from '../../useFileIntake'
import { ProgressBar } from '../pdf/PdfToolParts'
import { VideoTaskFailed, codecName, runVideoTask } from './videoTasks'
import type { OutputContainer, VideoInfo } from './videoTasks'
import type { AudioCodec, VideoCodec } from 'mediabunny'

export const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
export type ReadVideo = { info: VideoInfo } | { problem: 'unreadable' }

// Every chosen video probed once, one after another, in the order chosen.
export function useVideoInfos(files: File[]) {
  const [readByFile, setReadByFile] = useState(new Map<File, ReadVideo>())
  const readRef = useRef(readByFile)
  useEffect(() => {
    let isCurrent = true
    const kept = new Map([...readRef.current].filter(([file]) => files.includes(file)))
    readRef.current = kept
    setReadByFile(kept)
    void (async () => {
      for (const file of files) {
        if (readRef.current.has(file)) continue
        let read: ReadVideo
        try {
          read = { info: (await runVideoTask({ type: 'probe', file })).info! }
        } catch {
          read = { problem: 'unreadable' }
        }
        if (!isCurrent) return
        readRef.current = new Map(readRef.current).set(file, read)
        setReadByFile(readRef.current)
      }
    })()
    return () => {
      isCurrent = false
    }
  }, [files])
  return readByFile
}

export const videoInfoOf = (read: ReadVideo | undefined) => (read && 'info' in read ? read.info : null)

// The codecs this browser can make for a container (null while asking).
export function useEncodableCodecs(container: OutputContainer, width?: number, height?: number) {
  const [codecs, setCodecs] = useState<{ video: VideoCodec[]; audio: AudioCodec[] } | null>(null)
  useEffect(() => {
    let isCurrent = true
    setCodecs(null)
    runVideoTask({ type: 'encodable', container, width, height })
      .then((answer) => isCurrent && setCodecs({ video: answer.videoCodecs ?? [], audio: answer.audioCodecs ?? [] }))
      .catch(() => isCurrent && setCodecs({ video: [], audio: [] }))
    return () => {
      isCurrent = false
    }
  }, [container, width, height])
  return codecs
}

// 75.4 → "1:15.4"; an hour or more → "1:02:03".
export function formatDuration(seconds: number, withTenths = true) {
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = seconds - hours * 3600 - minutes * 60
  const secondsText = withTenths ? rest.toFixed(1).padStart(4, '0') : String(Math.floor(rest)).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}` : `${minutes}:${secondsText}`
}

// "1:15.4", "75.4" or "1:02:03" → seconds; null when it is not a time.
export function parseDuration(text: string) {
  const parts = text.trim().replace(',', '.').split(':')
  if (parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

// A chosen video in a player, with its size, length, picture size and codecs under it. `videoRef` lets a tool read the playing time;
// `picture` replaces the player (a crop box or a turned still) and keeps the facts.
export function VideoPreview({ id, file, read, videoRef, picture }: { id: string; file: File; read: ReadVideo | undefined; videoRef?: Ref<HTMLVideoElement>; picture?: ReactNode }) {
  const { t } = useT()
  const [address, setAddress] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setAddress(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const info = videoInfoOf(read)
  const facts = info && [
    formatFileSize(file.size),
    formatDuration(info.durationSeconds),
    info.video && `${info.video.width} × ${info.video.height}`,
    [codecName(info.video?.codec), codecName(info.audio?.codec)].filter(Boolean).join(' + '),
  ]
  return (
    <figure id={id} className="mx-auto max-w-[640px] space-y-2">
      {picture ?? (address && <video ref={videoRef} id={`${id}-player`} src={address} controls playsInline preload="metadata" className="w-full max-h-[360px] rounded-[10px] border border-rule bg-black" aria-label={file.name} />)}
      <figcaption className="text-center text-sm text-ink-soft">
        {/* The name and the facts on their own lines, so an Arabic page doesn't reorder the separators between them. */}
        <bdi className="block">{file.name}</bdi>
        {facts && (
          <span dir="ltr" className="block">
            {facts.filter(Boolean).join(' · ')}
          </span>
        )}
        {read && 'problem' in read && <span className="block text-danger">{t('tools.video.unreadable')}</span>}
        {info?.video && !info.video.canDecode && <span className="block text-danger">{t('tools.video.cantDecode', { codec: codecName(info.video.codec) })}</span>}
      </figcaption>
    </figure>
  )
}

// Start and end of the part to keep, typed as 1:05.3 or seconds.
export function TimeRangeFields({ idPrefix, durationSeconds, start, end, onChange }: { idPrefix: string; durationSeconds: number; start: number; end: number; onChange: (start: number, end: number) => void }) {
  const { t } = useT()
  const [startText, setStartText] = useState(formatDuration(start))
  const [endText, setEndText] = useState(formatDuration(end))
  useEffect(() => setStartText(formatDuration(start)), [start])
  useEffect(() => setEndText(formatDuration(end)), [end])
  const commit = (startValue: string, endValue: string) => {
    const newStart = parseDuration(startValue)
    const newEnd = parseDuration(endValue)
    if (newStart === null || newEnd === null) return
    const clampedStart = Math.min(Math.max(0, newStart), durationSeconds)
    const clampedEnd = Math.min(Math.max(clampedStart + 0.1, newEnd), durationSeconds)
    onChange(clampedStart, clampedEnd)
  }
  return (
    <div className="flex flex-wrap items-end justify-center gap-4">
      <label className="grid gap-1 text-sm font-medium">
        {t('tools.video.start')}
        <input id={`${idPrefix}-start`} dir="ltr" inputMode="decimal" value={startText} onChange={(event) => setStartText(event.target.value)} onBlur={() => commit(startText, endText)} className={`${fieldClass} w-32 text-center`} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t('tools.video.end')}
        <input id={`${idPrefix}-end`} dir="ltr" inputMode="decimal" value={endText} onChange={(event) => setEndText(event.target.value)} onBlur={() => commit(startText, endText)} className={`${fieldClass} w-32 text-center`} />
      </label>
      <p className="w-full text-center text-xs text-ink-soft">{t('tools.video.timeHint')}</p>
    </div>
  )
}

export function ActionButton({ id, label, isDisabled, isRunning, onClick }: { id: string; label: string; isDisabled: boolean; isRunning: boolean; onClick: () => void }) {
  const { t } = useT()
  return (
    <div className="flex justify-center">
      <button id={id} type="button" disabled={isDisabled || isRunning} onClick={onClick} className="btn btn--primary press">
        {isRunning ? t('tools.working') : label}
      </button>
    </div>
  )
}

const ERROR_MESSAGES: Record<VideoTaskFailed['reason'], MessageKey> = {
  unreadable: 'tools.video.unreadable',
  'no-video': 'tools.video.noVideo',
  'no-audio': 'tools.video.noAudio',
  decode: 'tools.video.cantDecode',
  encode: 'tools.video.cantEncode',
  failed: 'tools.video.failed',
}

// The run of a video tool: progress with a Cancel button, the error line (naming a codec this browser can't read or make, and one
// it can), and the result handed to the page.
export function useVideoJob(onResult: (file: File) => void) {
  const { t } = useT()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => controllerRef.current?.abort(), [])

  async function run(make: (onProgress: (done: number, total: number) => void, signal: AbortSignal) => Promise<File>) {
    const controller = new AbortController()
    controllerRef.current = controller
    setError('')
    setProgress({ done: 0, total: 0 })
    try {
      const file = await make((done, total) => setProgress({ done, total }), controller.signal)
      if (!controller.signal.aborted) onResult(file)
    } catch (caught) {
      if (caught instanceof VideoTaskFailed) {
        const key = caught.reason === 'encode' && !caught.suggestion ? 'tools.video.cantEncodeNoOther' : ERROR_MESSAGES[caught.reason]
        setError(t(key, { codec: codecName(caught.codec) || t('tools.video.thisCodec'), suggestion: codecName(caught.suggestion) }))
      } else if (!(caught instanceof DOMException && caught.name === 'AbortError')) setError(t('tools.video.failed'))
    }
    setProgress(null)
  }

  const progressBar = progress && (
    <div className="space-y-2">
      <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.percent', { percent: Math.round((progress.done / progress.total) * 100) }) : t('tools.progress.working')} />
      <div className="flex justify-center">
        <button id="tool-cancel" type="button" className="btn btn--quiet" onClick={() => controllerRef.current?.abort()}>
          {t('tools.video.cancel')}
        </button>
      </div>
    </div>
  )
  const errorLine = <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
  return { isRunning: progress !== null, run, progressBar, errorLine, setError }
}
