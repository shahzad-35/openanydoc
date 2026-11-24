// The two recorders: the screen (with the tab's or screen's sound and the microphone, mixed into one track) and the webcam. Both
// record with the browser's own MediaRecorder on the page; on Stop the recording is remuxed in the video worker (same codecs, no
// re-encoding when they fit the container), because a raw MediaRecorder file often has no duration and can't be seeked.
// Every camera, microphone and screen track is stopped on Stop, when the page closes and when the tool unmounts.
import { useEffect, useRef, useState } from 'react'
import { isolateLeftToRight, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { fieldClass, formatDuration } from './VideoToolParts'
import { runVideoTask } from './videoTasks'

type RecordingFormat = { mimeType: string; container: 'mp4' | 'webm'; label: string }
// MP4 first (Safari, recent Chrome and Edge), then WebM (Firefox, older Chrome). H.264 as avc3 before avc1: avc3 repeats the
// picture settings inside the stream, so a recording whose size changes (a shared window resized, another tab shared, a phone
// turned) still plays; an avc1 recording stops with a decode error at the change.
const RECORDING_FORMATS: RecordingFormat[] = [
  { mimeType: 'video/mp4;codecs=avc3,mp4a.40.2', container: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/mp4;codecs=avc3', container: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', container: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/mp4;codecs=avc1', container: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/webm;codecs=vp9,opus', container: 'webm', label: 'WebM (VP9)' },
  { mimeType: 'video/webm;codecs=vp8,opus', container: 'webm', label: 'WebM (VP8)' },
  { mimeType: 'video/webm', container: 'webm', label: 'WebM' },
  { mimeType: 'video/mp4', container: 'mp4', label: 'MP4' },
]

function pickRecordingFormat() {
  if (typeof MediaRecorder === 'undefined') return null
  return RECORDING_FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null
}

// "screen-recording-2026-11-23-1405.mp4", in the visitor's own time.
function recordingFileName(prefix: string, extension: string) {
  const now = new Date()
  const twoDigits = (value: number) => String(value).padStart(2, '0')
  return `${prefix}-${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}.${extension}`
}

function stopStreams(streams: MediaStream[]) {
  for (const stream of streams) for (const track of stream.getTracks()) track.stop()
}

// Why the camera, microphone or screen could not be used, in plain words.
function mediaErrorKey(error: unknown, refusedKey: MessageKey): MessageKey {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return refusedKey
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'tools.video.recorder.notFound'
  if (name === 'NotReadableError') return 'tools.video.recorder.inUse'
  return 'tools.video.recorder.failed'
}

type RecordingPhase = 'idle' | 'recording' | 'paused' | 'finishing'

// The recording itself: MediaRecorder, the running time without the pauses, and on Stop the finished file handed to the page.
// `onStopped` runs when the recorder stops for any reason, so the caller can stop its tracks.
function useMediaRecording(fileNamePrefix: string, onResult: (file: File) => void, onUnsavedEditsChange?: (hasUnsavedEdits: boolean) => void) {
  const [format] = useState(pickRecordingFormat)
  const [phase, setPhase] = useState<RecordingPhase>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const clockRef = useRef({ startedAt: 0, bankedMilliseconds: 0 })

  useEffect(() => {
    if (phase !== 'recording') return
    const timer = setInterval(() => setElapsedSeconds((clockRef.current.bankedMilliseconds + performance.now() - clockRef.current.startedAt) / 1000), 250)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    onUnsavedEditsChange?.(phase !== 'idle')
  }, [phase, onUnsavedEditsChange])

  // Leaving the page throws the recording away (the recorder is dropped first, so its stop makes no file).
  useEffect(
    () => () => {
      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    },
    [],
  )

  function start(stream: MediaStream, onStopped: () => void) {
    if (!format) return
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = async () => {
      onStopped()
      if (recorderRef.current !== recorder) return
      recorderRef.current = null
      setPhase('finishing')
      const recorded = new Blob(chunks, { type: recorder.mimeType || format.mimeType })
      const name = recordingFileName(fileNamePrefix, format.container)
      let file: File
      try {
        const answer = await runVideoTask({ type: 'convert', file: recorded, settings: { container: format.container } })
        file = new File([answer.bytes as BlobPart], name, { type: answer.mimeType })
      } catch {
        // The raw recording still plays; it may only show no length in some players.
        file = new File([recorded], name, { type: `video/${format.container}` })
      }
      setPhase('idle')
      setElapsedSeconds(0)
      onResult(file)
    }
    recorderRef.current = recorder
    recorder.start(1000)
    clockRef.current = { startedAt: performance.now(), bankedMilliseconds: 0 }
    setElapsedSeconds(0)
    setPhase('recording')
  }

  function pause() {
    recorderRef.current?.pause()
    clockRef.current.bankedMilliseconds += performance.now() - clockRef.current.startedAt
    setPhase('paused')
  }

  function resume() {
    recorderRef.current?.resume()
    clockRef.current.startedAt = performance.now()
    setPhase('recording')
  }

  function stop() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  return { format, phase, elapsedSeconds, start, pause, resume, stop }
}

type MediaRecording = ReturnType<typeof useMediaRecording>

// Start (or the caller's own first step), Pause/Resume, Stop, the running time, the format and the privacy line.
function RecordingControls({ idPrefix, recording, startLabel, isStartDisabled, onStart }: { idPrefix: string; recording: MediaRecording; startLabel: string; isStartDisabled: boolean; onStart: () => void }) {
  const { t } = useT()
  const { phase, format } = recording
  const isActive = phase === 'recording' || phase === 'paused'
  return (
    <div className="space-y-3 text-center">
      <p id={`${idPrefix}-status`} role="status" className="flex items-center justify-center gap-2 font-semibold">
        {isActive && <span aria-hidden="true" className={`size-3 rounded-full ${phase === 'recording' ? 'animate-pulse bg-danger' : 'bg-ink-soft'}`} />}
        {phase === 'recording' && t('tools.video.recorder.recording')}
        {phase === 'paused' && t('tools.video.recorder.paused')}
        {phase === 'finishing' && t('tools.video.recorder.finishing')}
        <span id={`${idPrefix}-timer`} dir="ltr" className="font-mono text-2xl tabular-nums">
          {formatDuration(recording.elapsedSeconds, false)}
        </span>
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {!isActive && (
          <button id={`${idPrefix}-start`} type="button" disabled={isStartDisabled || phase === 'finishing'} onClick={onStart} className="btn btn--primary press">
            {startLabel}
          </button>
        )}
        {isActive && (
          <>
            <button id={`${idPrefix}-pause`} type="button" onClick={phase === 'recording' ? recording.pause : recording.resume} className="btn btn--quiet press">
              {phase === 'recording' ? t('tools.video.recorder.pause') : t('tools.video.recorder.resume')}
            </button>
            <button id={`${idPrefix}-stop`} type="button" onClick={recording.stop} className="btn btn--primary press">
              {t('tools.video.recorder.stop')}
            </button>
          </>
        )}
      </div>
      {format && (
        <p id={`${idPrefix}-format`} className="text-sm text-ink-soft">
          {t('tools.video.recorder.format', { format: isolateLeftToRight(format.label) })}
        </p>
      )}
      <p id={`${idPrefix}-privacy`} className="text-sm text-ink-soft">
        {t('tools.video.recorder.staysHere')}
      </p>
    </div>
  )
}

export function ScreenRecorder({ onResult, onUnsavedEditsChange }: ToolProps) {
  const { t } = useT()
  const recording = useMediaRecording('screen-recording', onResult, onUnsavedEditsChange)
  const [withSystemSound, setWithSystemSound] = useState(true)
  const [withMicrophone, setWithMicrophone] = useState(false)
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null)
  const [hasNoSystemSound, setHasNoSystemSound] = useState(false)
  const sourcesRef = useRef<{ streams: MediaStream[]; audioContext: AudioContext | null }>({ streams: [], audioContext: null })
  // The browser's prompt can still be open when the visitor leaves the page; a capture that arrives after that is stopped at once.
  const isMountedRef = useRef(false)
  const canShareScreen = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

  function stopSources() {
    stopStreams(sourcesRef.current.streams)
    void sourcesRef.current.audioContext?.close()
    sourcesRef.current = { streams: [], audioContext: null }
  }

  useEffect(() => {
    isMountedRef.current = true
    window.addEventListener('pagehide', stopSources)
    return () => {
      isMountedRef.current = false
      window.removeEventListener('pagehide', stopSources)
      stopSources()
    }
  }, [])

  async function startRecording() {
    setErrorKey(null)
    setHasNoSystemSound(false)
    // The screen first: the browser asks for it only right after a click.
    let screen: MediaStream
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: withSystemSound })
    } catch (error) {
      setErrorKey(mediaErrorKey(error, 'tools.video.recorder.screenRefused'))
      return
    }
    if (!isMountedRef.current) return stopStreams([screen])
    let microphone: MediaStream | null = null
    if (withMicrophone) {
      try {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (error) {
        stopStreams([screen])
        setErrorKey(mediaErrorKey(error, 'tools.video.recorder.microphoneRefused'))
        return
      }
    }
    if (!isMountedRef.current) return stopStreams([screen, ...(microphone ? [microphone] : [])])
    const screenSound = screen.getAudioTracks()
    if (withSystemSound && screenSound.length === 0) setHasNoSystemSound(true)
    const soundSources = [screenSound.length > 0 ? new MediaStream(screenSound) : null, microphone].filter((stream) => stream !== null)
    let audioContext: AudioContext | null = null
    let soundTracks = soundSources.flatMap((stream) => stream.getAudioTracks())
    // Two sound sources become one track: MediaRecorder records only the first audio track it is given.
    if (soundSources.length === 2) {
      audioContext = new AudioContext()
      const mixed = audioContext.createMediaStreamDestination()
      for (const stream of soundSources) audioContext.createMediaStreamSource(stream).connect(mixed)
      soundTracks = mixed.stream.getAudioTracks()
    }
    sourcesRef.current = { streams: [screen, ...(microphone ? [microphone] : [])], audioContext }
    // Ending the share from the browser's own bar stops the recording and saves it.
    screen.getVideoTracks()[0]?.addEventListener('ended', recording.stop)
    recording.start(new MediaStream([...screen.getVideoTracks(), ...soundTracks]), stopSources)
  }

  if (!canShareScreen || !recording.format) {
    return (
      <p id="screen-recorder-unsupported" role="alert" className="mx-auto max-w-[560px] rounded-[16px] border-2 border-rule bg-paper-raised p-4 text-center font-medium">
        {t(canShareScreen ? 'tools.video.recorder.noRecorder' : 'tools.video.recorder.noScreen')}
      </p>
    )
  }

  const isIdle = recording.phase === 'idle'
  return (
    <div className="space-y-5">
      <fieldset className="flex flex-col items-center gap-1">
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="screen-recorder-system-sound" type="checkbox" checked={withSystemSound} disabled={!isIdle} onChange={(event) => setWithSystemSound(event.target.checked)} className="size-5" />
          {t('tools.video.screen.systemSound')}
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="screen-recorder-microphone" type="checkbox" checked={withMicrophone} disabled={!isIdle} onChange={(event) => setWithMicrophone(event.target.checked)} className="size-5" />
          {t('tools.video.screen.microphone')}
        </label>
        <p className="max-w-[520px] text-center text-sm text-ink-soft">{t('tools.video.screen.systemSoundHint')}</p>
      </fieldset>
      <RecordingControls idPrefix="screen-recorder" recording={recording} startLabel={t('tools.video.screen.start')} isStartDisabled={false} onStart={() => void startRecording()} />
      {hasNoSystemSound && <Notice id="screen-recorder-no-sound" kind="info" role="status" className="text-center text-sm font-medium" message={t('tools.video.screen.noSystemSound')} />}
      <Notice id="screen-recorder-error" kind="error" role="alert" className="text-center font-medium text-danger" message={errorKey ? t(errorKey) : ''} />
    </div>
  )
}

type DeviceChoice = { deviceId: string; label: string }
const NO_MICROPHONE = 'none'

export function WebcamRecorder({ onResult, onUnsavedEditsChange }: ToolProps) {
  const { t } = useT()
  const recording = useMediaRecording('webcam-recording', onResult, onUnsavedEditsChange)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameras, setCameras] = useState<DeviceChoice[]>([])
  const [microphones, setMicrophones] = useState<DeviceChoice[]>([])
  const [cameraId, setCameraId] = useState('')
  const [microphoneId, setMicrophoneId] = useState('')
  const [isMirrored, setIsMirrored] = useState(true)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  // As on the screen recorder: a camera that turns on after the visitor has left the page is turned off at once.
  const isMountedRef = useRef(false)
  const canUseCamera = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

  function turnOffCamera() {
    if (cameraStreamRef.current) stopStreams([cameraStreamRef.current])
    cameraStreamRef.current = null
    setCameraStream(null)
  }

  useEffect(() => {
    isMountedRef.current = true
    window.addEventListener('pagehide', turnOffCamera)
    return () => {
      isMountedRef.current = false
      window.removeEventListener('pagehide', turnOffCamera)
      if (cameraStreamRef.current) stopStreams([cameraStreamRef.current])
    }
  }, [])

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = cameraStream
  }, [cameraStream])

  async function turnOnCamera(wantedCameraId: string, wantedMicrophoneId: string) {
    setErrorKey(null)
    setIsStartingCamera(true)
    turnOffCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: wantedCameraId ? { deviceId: { exact: wantedCameraId } } : true,
        audio: wantedMicrophoneId === NO_MICROPHONE ? false : wantedMicrophoneId ? { deviceId: { exact: wantedMicrophoneId } } : true,
      })
      if (!isMountedRef.current) return stopStreams([stream])
      cameraStreamRef.current = stream
      setCameraStream(stream)
      // Device names are given only once the visitor has allowed the camera.
      const devices = await navigator.mediaDevices.enumerateDevices()
      const choicesOf = (kind: MediaDeviceKind, fallbackKey: MessageKey) =>
        devices.filter((device) => device.kind === kind && device.deviceId).map((device, position) => ({ deviceId: device.deviceId, label: device.label || `${t(fallbackKey)} ${position + 1}` }))
      setCameras(choicesOf('videoinput', 'tools.video.webcam.camera'))
      setMicrophones(choicesOf('audioinput', 'tools.video.webcam.microphone'))
      setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? wantedCameraId)
      setMicrophoneId(wantedMicrophoneId === NO_MICROPHONE ? NO_MICROPHONE : (stream.getAudioTracks()[0]?.getSettings().deviceId ?? wantedMicrophoneId))
    } catch (error) {
      setErrorKey(mediaErrorKey(error, 'tools.video.recorder.cameraRefused'))
    }
    setIsStartingCamera(false)
  }

  if (!canUseCamera || !recording.format) {
    return (
      <p id="webcam-recorder-unsupported" role="alert" className="mx-auto max-w-[560px] rounded-[16px] border-2 border-rule bg-paper-raised p-4 text-center font-medium">
        {t('tools.video.recorder.noRecorder')}
      </p>
    )
  }

  const isIdle = recording.phase === 'idle'
  return (
    <div className="space-y-5">
      {cameraStream ? (
        <>
          <video ref={previewRef} id="webcam-recorder-preview" autoPlay muted playsInline aria-label={t('tools.video.webcam.preview')} className={`mx-auto w-full max-w-[640px] rounded-[10px] border border-rule bg-black ${isMirrored ? '-scale-x-100' : ''}`} />
          <div className="flex flex-wrap items-end justify-center gap-4">
            <label className="grid gap-1 text-sm font-medium">
              {t('tools.video.webcam.camera')}
              <select id="webcam-recorder-camera" value={cameraId} disabled={!isIdle || isStartingCamera} onChange={(event) => void turnOnCamera(event.target.value, microphoneId)} className={`${fieldClass} max-w-[280px]`}>
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('tools.video.webcam.microphone')}
              <select id="webcam-recorder-microphone" value={microphoneId} disabled={!isIdle || isStartingCamera} onChange={(event) => void turnOnCamera(cameraId, event.target.value)} className={`${fieldClass} max-w-[280px]`}>
                <option value={NO_MICROPHONE}>{t('tools.video.webcam.noMicrophone')}</option>
                {microphones.map((microphone) => (
                  <option key={microphone.deviceId} value={microphone.deviceId}>
                    {microphone.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-col items-center">
            <label className="inline-flex min-h-11 items-center gap-2 font-medium">
              <input id="webcam-recorder-mirror" type="checkbox" checked={isMirrored} onChange={(event) => setIsMirrored(event.target.checked)} className="size-5" />
              {t('tools.video.webcam.mirror')}
            </label>
            <p className="text-sm text-ink-soft">{t('tools.video.webcam.mirrorHint')}</p>
          </div>
          <RecordingControls idPrefix="webcam-recorder" recording={recording} startLabel={t('tools.video.webcam.start')} isStartDisabled={isStartingCamera} onStart={() => recording.start(cameraStream, turnOffCamera)} />
        </>
      ) : (
        <div className="space-y-3 text-center">
          <button id="webcam-recorder-turn-on" type="button" disabled={isStartingCamera || recording.phase === 'finishing'} onClick={() => void turnOnCamera(cameraId, microphoneId)} className="btn btn--primary press">
            {recording.phase === 'finishing' ? t('tools.video.recorder.finishing') : t('tools.video.webcam.turnOn')}
          </button>
          <p id="webcam-recorder-privacy" className="text-sm text-ink-soft">
            {t('tools.video.recorder.staysHere')}
          </p>
        </div>
      )}
      <Notice id="webcam-recorder-error" kind="error" role="alert" className="text-center font-medium text-danger" message={errorKey ? t(errorKey) : ''} />
    </div>
  )
}
