// Video player: plays a chosen video with speed, loop and "Save this frame", and lists what the file holds (container, codecs,
// sizes, bitrates) and whether this browser can play it.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { formatFileSize } from '../../useFileIntake'
import type { ToolProps } from '../registry'
import { baseNameOf } from '../pdf/PdfToolParts'
import { codecName } from './videoTasks'
import type { VideoInfo } from './videoTasks'
import { formatDuration, useVideoInfos, videoInfoOf } from './VideoToolParts'

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

// 2_400_000 → "2.4 Mb/s", 128_000 → "128 kb/s".
function formatBitrate(bitsPerSecond: number | null) {
  if (!bitsPerSecond) return null
  return bitsPerSecond >= 1_000_000 ? `${(bitsPerSecond / 1_000_000).toFixed(1)} Mb/s` : `${Math.round(bitsPerSecond / 1000)} kb/s`
}

// "H.264 (avc1.640015)"
function codecWithString(codec: string | null, codecString: string | null) {
  const name = codecName(codec) || codecString || '?'
  return codecString && codecString !== name ? `${name} (${codecString})` : name
}

function playabilityKey(info: VideoInfo): MessageKey {
  if (info.video && !info.video.canDecode) return 'tools.video.player.playsNo'
  if (info.audio && !info.audio.canDecode) return 'tools.video.player.playsNoSound'
  return 'tools.video.player.playsYes'
}

function channelsText(channels: number, t: ReturnType<typeof useT>['t']) {
  if (channels === 1) return t('tools.video.player.mono')
  if (channels === 2) return t('tools.video.player.stereo')
  return t('tools.video.player.channels', { count: channels })
}

export function VideoPlayer({ files, onResult, onOpenInPage }: ToolProps) {
  const { t } = useT()
  const readByFile = useVideoInfos(files)
  const [chosenFile, setChosenFile] = useState<File | null>(null)
  const shownFile = chosenFile && files.includes(chosenFile) ? chosenFile : files[0]
  const [speed, setSpeed] = useState(1)
  const [isLooping, setIsLooping] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shownFile) return
    const url = URL.createObjectURL(shownFile)
    video.src = url
    return () => URL.revokeObjectURL(url)
  }, [shownFile])

  // A new source resets playbackRate to defaultPlaybackRate, so both are set.
  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.defaultPlaybackRate = speed
    videoRef.current.playbackRate = speed
  }, [speed])

  function saveFrame() {
    const video = videoRef.current
    if (!video || !shownFile || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const seconds = video.currentTime.toFixed(1)
    canvas.toBlob((blob) => {
      if (blob) onResult(new File([blob], `${baseNameOf(shownFile.name)}-frame-${seconds}s.png`, { type: 'image/png' }))
    }, 'image/png')
  }

  if (!shownFile) return null
  const read = readByFile.get(shownFile)
  const info = videoInfoOf(read)
  const cantPlayPicture = Boolean(info?.video && !info.video.canDecode)
  const notStated = t('tools.video.player.notStated')
  const latinValue = (text: string | null) => <bdi dir="ltr">{text ?? notStated}</bdi>

  const facts: [string, MessageKey, ReactNode][] = []
  facts.push(['name', 'tools.video.player.fileName', <bdi key="name">{shownFile.name}</bdi>])
  facts.push(['size', 'tools.video.player.fileSize', latinValue(formatFileSize(shownFile.size))])
  if (info) {
    facts.push(['container', 'tools.video.player.container', latinValue(info.container)])
    facts.push(['duration', 'tools.video.player.duration', latinValue(formatDuration(info.durationSeconds))])
    if (info.video) {
      facts.push(['picture-size', 'tools.video.player.pictureSize', latinValue(`${info.video.width} × ${info.video.height}`)])
      facts.push(['rotation', 'tools.video.player.rotation', latinValue(`${info.video.rotation}°`)])
      facts.push(['frame-rate', 'tools.video.player.frameRate', info.video.frameRate ? t('tools.video.player.fps', { rate: Number(info.video.frameRate.toFixed(2)) }) : notStated])
      facts.push(['video-codec', 'tools.video.player.videoCodec', latinValue(codecWithString(info.video.codec, info.video.codecString))])
      facts.push(['video-bitrate', 'tools.video.player.videoBitrate', latinValue(formatBitrate(info.video.bitrate))])
    } else facts.push(['video-codec', 'tools.video.player.videoCodec', t('tools.video.player.noPicture')])
    if (info.audio) {
      facts.push(['audio-codec', 'tools.video.player.audioCodec', latinValue(codecWithString(info.audio.codec, info.audio.codecString))])
      facts.push(['sample-rate', 'tools.video.player.sampleRate', latinValue(`${(info.audio.sampleRate / 1000).toFixed(info.audio.sampleRate % 1000 ? 1 : 0)} kHz`)])
      facts.push(['channels', 'tools.video.player.channelsLabel', channelsText(info.audio.channels, t)])
      facts.push(['audio-bitrate', 'tools.video.player.audioBitrate', latinValue(formatBitrate(info.audio.bitrate))])
    } else facts.push(['audio-codec', 'tools.video.player.audioCodec', t('tools.video.player.noSound')])
    facts.push(['tracks', 'tools.video.player.tracks', latinValue(String(info.trackCount))])
    facts.push(['plays', 'tools.video.player.plays', t(playabilityKey(info))])
  }

  return (
    <div id="video-player-tool" className="mx-auto max-w-[720px] space-y-5 text-start">
      {files.length > 1 && (
        <ul id="video-player-files" aria-label={t('tools.video.player.filesLabel')} className="flex flex-wrap justify-center gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              <button id={`video-player-file-${index + 1}`} type="button" aria-pressed={file === shownFile} onClick={() => setChosenFile(file)} className="btn btn--quiet btn--compact press max-w-[260px] truncate aria-pressed:bg-accent/20">
                <bdi>{file.name}</bdi>
              </button>
            </li>
          ))}
        </ul>
      )}
      <video
        ref={videoRef}
        id="video-player-video"
        controls
        playsInline
        loop={isLooping}
        preload="auto"
        onLoadStart={() => setHasFrame(false)}
        onLoadedData={() => setHasFrame(true)}
        aria-label={shownFile.name}
        className="mx-auto w-full max-h-[420px] rounded-[10px] border border-rule bg-black"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div role="group" id="video-player-speeds" aria-label={t('tools.video.player.speed')} className="flex flex-wrap justify-center gap-1" dir="ltr">
          {PLAYBACK_SPEEDS.map((choice) => (
            <button key={choice} id={`video-player-speed-${String(choice).replace('.', '-')}`} type="button" aria-pressed={speed === choice} onClick={() => setSpeed(choice)} className="btn btn--quiet btn--compact press aria-pressed:bg-accent/20">
              {choice}×
            </button>
          ))}
        </div>
        <button id="video-player-loop" type="button" aria-pressed={isLooping} onClick={() => setIsLooping((looping) => !looping)} className="btn btn--quiet btn--compact press aria-pressed:bg-accent/20">
          {t('tools.video.player.loop')}
        </button>
        <button id="video-player-save-frame" type="button" disabled={!hasFrame || cantPlayPicture} onClick={saveFrame} className="btn btn--quiet btn--compact press">
          {t('tools.video.player.saveFrame')}
        </button>
      </div>
      {cantPlayPicture && info?.video && (
        <div className="space-y-2 text-center">
          <Notice id="video-player-cant-play" kind="warning" role="alert" className="font-medium text-danger" message={t('tools.video.player.cantPlay', { codec: codecName(info.video.codec) || t('tools.video.thisCodec') })} />
          <button id="video-player-convert" type="button" onClick={() => onOpenInPage?.(shownFile, '/video-converter')} className="btn btn--primary press">
            {t('tools.video.player.openConverter')}
          </button>
        </div>
      )}
      {read && 'problem' in read && <Notice id="video-player-unreadable" kind="error" role="alert" className="text-center font-medium text-danger" message={t('tools.video.unreadable')} />}
      {!read && <p id="video-player-reading" className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      <table id="video-player-facts" className="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-rule [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-rule [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-medium [&_th]:text-ink-soft [&_th]:w-2/5">
        <caption className="pb-2 text-start font-semibold">{t('tools.video.player.factsTitle')}</caption>
        <tbody>
          {facts.map(([key, labelKey, value]) => (
            <tr key={key} id={`video-player-fact-${key}`}>
              <th scope="row">{t(labelKey)}</th>
              <td className="break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
