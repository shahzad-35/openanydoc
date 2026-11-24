// The video tools that change a video's timeline or sound: Merge, Loop, Change speed (the worker's `join`), Mute and Add audio
// (`convert`).
import { useState } from 'react'
import { isolateLeftToRight, isolateText, useT } from '../../i18n'
import type { ToolProps } from '../registry'
import { ActionButton, VideoPreview, fieldClass, formatDuration, useVideoInfos, useVideoJob, videoInfoOf } from './VideoToolParts'
import type { ReadVideo } from './VideoToolParts'
import { resultFileOf, runVideoTask } from './videoTasks'
import type { VideoContainer, VideoInfo } from './videoTasks'

// The result keeps the input's container when the worker can write it; any other video becomes MP4.
function outputContainerOf(file: File): VideoContainer {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension === 'webm' || extension === 'mov' || extension === 'mkv' ? extension : 'mp4'
}

const frameRateOf = (info: VideoInfo) => Math.round(info.video?.frameRate ?? 0) || 30

const lengthText = (seconds: number) => <bdi dir="ltr">{formatDuration(seconds)}</bdi>

// ---------------------------------------------------------------- Merge videos

type MergeSize = 'first' | '1080p' | '720p'

// 1080p and 720p follow the first clip's orientation (a phone video stays upright).
function mergeSizeOf(choice: MergeSize, first: { width: number; height: number }) {
  if (choice === 'first') return first
  const shortSide = choice === '1080p' ? 1080 : 720
  const longSide = Math.round((shortSide * 16) / 9)
  return first.width >= first.height ? { width: longSide, height: shortSide } : { width: shortSide, height: longSide }
}

export function MergeVideos({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useVideoInfos(files)
  const job = useVideoJob(onResult)
  const [sizeChoice, setSizeChoice] = useState<MergeSize>('first')
  const [container, setContainer] = useState<'mp4' | 'webm'>('mp4')
  const [keepsSound, setKeepsSound] = useState(true)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const infos = files.map((file) => videoInfoOf(readByFile.get(file)))
  const isEveryClipReady = infos.every((info) => info?.video)
  const firstInfo = infos[0]
  const totalSeconds = infos.reduce((sum, info) => sum + (info?.durationSeconds ?? 0), 0)

  function moveClip(fromIndex: number, toIndex: number) {
    const reorderedFiles = [...files]
    const [movedFile] = reorderedFiles.splice(fromIndex, 1)
    reorderedFiles.splice(toIndex, 0, movedFile)
    onFilesChange(reorderedFiles)
  }

  function mergeClips() {
    if (!firstInfo?.video) return
    const size = mergeSizeOf(sizeChoice, firstInfo.video)
    void job.run(async (onProgress, signal) => {
      const request = { type: 'join' as const, parts: files.map((file) => ({ file })), container, ...size, frameRate: frameRateOf(firstInfo), speed: 1, dropAudio: !keepsSound, quality: 'high' as const }
      return resultFileOf(await runVideoTask(request, onProgress, signal), files[0].name, 'merged')
    })
  }

  // Keyed by the file (and how often it was chosen before), not by position, so React keeps each row as it moves.
  const timesSeen = new Map<File, number>()
  const moveButtonClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  return (
    <div id="merge-videos-tool" className="space-y-5 text-start">
      <p className="text-center text-sm text-ink-soft">{t('tools.video.merge.dragHint')}</p>
      <ol id="merge-videos-list" aria-label={t('tools.video.merge.listLabel')} className="space-y-2">
        {files.map((file, index) => {
          timesSeen.set(file, (timesSeen.get(file) ?? 0) + 1)
          const info = infos[index]
          const read = readByFile.get(file)
          const facts = info && [formatDuration(info.durationSeconds), info.video && `${info.video.width} × ${info.video.height}`].filter(Boolean).join(' · ')
          return (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${timesSeen.get(file)}`}
              id={`merge-videos-clip-${index + 1}`}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedIndex !== null && draggedIndex !== index) moveClip(draggedIndex, index)
                setDraggedIndex(null)
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex cursor-grab items-center gap-3 rounded-[14px] border-2 bg-paper-raised py-1 ps-4 pe-1 ${draggedIndex === index ? 'border-accent opacity-60' : 'border-rule'}`}
            >
              <span className="font-semibold text-ink-soft" dir="ltr">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <bdi className="block truncate font-medium">{file.name}</bdi>
                <span className="block text-sm text-ink-soft">
                  {facts ? <bdi dir="ltr">{facts}</bdi> : read && 'problem' in read ? <span className="text-danger">{t('tools.video.unreadable')}</span> : info && !info.video ? <span className="text-danger">{t('tools.video.noVideo')}</span> : t('tools.video.timeline.reading')}
                </span>
              </span>
              <button id={`merge-videos-earlier-${index + 1}`} type="button" aria-label={t('tools.grid.moveEarlier', { name: file.name })} disabled={index === 0} onClick={() => moveClip(index, index - 1)} className={moveButtonClass}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
              </button>
              <button id={`merge-videos-later-${index + 1}`} type="button" aria-label={t('tools.grid.moveLater', { name: file.name })} disabled={index === files.length - 1} onClick={() => moveClip(index, index + 1)} className={moveButtonClass}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <button id={`merge-videos-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: file.name })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={moveButtonClass}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="flex justify-center">
        <button id="merge-videos-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('tools.video.timeline.addMore')}
        </button>
      </div>
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.merge.size')}
          <select id="merge-videos-size-select" value={sizeChoice} onChange={(event) => setSizeChoice(event.target.value as MergeSize)} className={fieldClass}>
            <option value="first">{t('tools.video.merge.sizeFirst')}</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.timeline.format')}
          <select id="merge-videos-format-select" value={container} onChange={(event) => setContainer(event.target.value as 'mp4' | 'webm')} className={fieldClass}>
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="merge-videos-keep-sound-checkbox" type="checkbox" checked={keepsSound} onChange={(event) => setKeepsSound(event.target.checked)} className="size-5" />
          {t('tools.video.timeline.keepSound')}
        </label>
      </div>
      <p id="merge-videos-size-note" className="text-center text-sm text-ink-soft">{t('tools.video.merge.letterboxNote')}</p>
      {files.length > 1 && isEveryClipReady && (
        <p id="merge-videos-length" className="text-center text-sm font-medium">
          {t('tools.video.timeline.resultLength')} {lengthText(totalSeconds)}
        </p>
      )}
      {files.length === 1 && <p id="merge-videos-hint" className="text-center text-sm text-ink-soft">{t('tools.video.merge.needTwo', { name: isolateText(files[0].name) })}</p>}
      <ActionButton id="merge-videos-button" label={t('tools.video.merge.button')} isDisabled={files.length < 2 || !isEveryClipReady} isRunning={job.isRunning} onClick={mergeClips} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Loop video

const MAX_LOOP_SECONDS = 600

export function LoopVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const read = useVideoInfos(files).get(file)
  const info = videoInfoOf(read)
  const job = useVideoJob(onResult)
  const [mode, setMode] = useState<'times' | 'seconds'>('times')
  const [times, setTimes] = useState(3)
  const [targetSeconds, setTargetSeconds] = useState(30)

  const clipSeconds = info?.durationSeconds ?? 0
  const isTargetValid = targetSeconds > clipSeconds && targetSeconds <= MAX_LOOP_SECONDS
  const isValid = mode === 'times' ? times >= 2 && times <= 20 : isTargetValid
  const resultSeconds = mode === 'times' ? clipSeconds * times : targetSeconds
  const repeatCount = mode === 'times' ? times : Math.ceil(targetSeconds / clipSeconds)

  // "Until it lasts N seconds": whole repeats, then the start of the clip up to the exact length.
  function partsToJoin() {
    if (mode === 'times') return Array.from({ length: times }, () => ({ file }))
    const wholeRepeats = Math.floor(targetSeconds / clipSeconds)
    const remainder = targetSeconds - wholeRepeats * clipSeconds
    const parts: { file: File; start?: number; end?: number }[] = Array.from({ length: wholeRepeats }, () => ({ file }))
    if (remainder > 0.05) parts.push({ file, start: 0, end: remainder })
    return parts
  }

  function loopClip() {
    if (!info?.video) return
    const { width, height } = info.video
    void job.run(async (onProgress, signal) => {
      const request = { type: 'join' as const, parts: partsToJoin(), container: outputContainerOf(file), width, height, frameRate: frameRateOf(info), speed: 1, dropAudio: false, quality: 'high' as const }
      return resultFileOf(await runVideoTask(request, onProgress, signal), file.name, 'loop')
    })
  }

  return (
    <div id="loop-video-tool" className="space-y-5 text-start">
      <VideoPreview id="loop-video-preview" file={file} read={read} />
      <fieldset className="flex flex-wrap items-center justify-center gap-4">
        <legend className="sr-only">{t('tools.video.loop.mode')}</legend>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="loop-video-mode-times-radio" type="radio" name="loop-video-mode" checked={mode === 'times'} onChange={() => setMode('times')} className="size-5" />
          {t('tools.video.loop.modeTimes')}
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="loop-video-mode-seconds-radio" type="radio" name="loop-video-mode" checked={mode === 'seconds'} onChange={() => setMode('seconds')} className="size-5" />
          {t('tools.video.loop.modeSeconds')}
        </label>
      </fieldset>
      <div className="flex justify-center">
        {mode === 'times' ? (
          <label className="grid gap-1 text-sm font-medium">
            {t('tools.video.loop.times')}
            <input id="loop-video-times-input" type="number" min="2" max="20" dir="ltr" value={times || ''} onChange={(event) => setTimes(Math.round(Number(event.target.value) || 0))} className={`${fieldClass} w-32 text-center`} />
          </label>
        ) : (
          <label className="grid gap-1 text-sm font-medium">
            {t('tools.video.loop.seconds')}
            <input id="loop-video-seconds-input" type="number" min="1" max={MAX_LOOP_SECONDS} step="0.5" dir="ltr" value={targetSeconds || ''} onChange={(event) => setTargetSeconds(Number(event.target.value) || 0)} className={`${fieldClass} w-32 text-center`} />
          </label>
        )}
      </div>
      {info?.video && (
        <p id="loop-video-length" className="text-center text-sm font-medium">
          {mode === 'seconds' && !isTargetValid
            ? t('tools.video.loop.secondsRange', { min: isolateLeftToRight(formatDuration(clipSeconds)), max: MAX_LOOP_SECONDS })
            : t('tools.video.loop.summary', { count: repeatCount, length: isolateLeftToRight(formatDuration(resultSeconds)) })}
        </p>
      )}
      <ActionButton id="loop-video-button" label={t('tools.video.loop.button')} isDisabled={!info?.video || !isValid} isRunning={job.isRunning} onClick={loopClip} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Change video speed

const SPEEDS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 3, 4]

export function ChangeVideoSpeed({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const read = useVideoInfos(files).get(file)
  const info = videoInfoOf(read)
  const job = useVideoJob(onResult)
  const [speedChoice, setSpeedChoice] = useState('2')
  const [customSpeed, setCustomSpeed] = useState(1.1)
  const [keepsSound, setKeepsSound] = useState(true)

  const speed = speedChoice === 'custom' ? customSpeed : Number(speedChoice)
  const isSpeedValid = speed >= 0.1 && speed <= 10 && speed !== 1

  function changeSpeed() {
    if (!info?.video) return
    const { width, height } = info.video
    void job.run(async (onProgress, signal) => {
      const request = { type: 'join' as const, parts: [{ file }], container: outputContainerOf(file), width, height, frameRate: frameRateOf(info), speed, dropAudio: !keepsSound, quality: 'high' as const }
      return resultFileOf(await runVideoTask(request, onProgress, signal), file.name, `${speed}x`)
    })
  }

  return (
    <div id="change-video-speed-tool" className="space-y-5 text-start">
      <VideoPreview id="change-video-speed-preview" file={file} read={read} />
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.speed.label')}
          <select id="change-video-speed-select" value={speedChoice} onChange={(event) => setSpeedChoice(event.target.value)} className={fieldClass}>
            {SPEEDS.map((value) => (
              <option key={value} value={String(value)}>
                {value}× {value < 1 ? t('tools.video.speed.slower') : t('tools.video.speed.faster')}
              </option>
            ))}
            <option value="custom">{t('tools.video.speed.custom')}</option>
          </select>
        </label>
        {speedChoice === 'custom' && (
          <label className="grid gap-1 text-sm font-medium">
            {t('tools.video.speed.customLabel')}
            <input id="change-video-speed-custom-input" type="number" min="0.1" max="10" step="0.05" dir="ltr" value={customSpeed || ''} onChange={(event) => setCustomSpeed(Number(event.target.value) || 0)} className={`${fieldClass} w-32 text-center`} />
          </label>
        )}
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="change-video-speed-keep-sound-checkbox" type="checkbox" checked={keepsSound} onChange={(event) => setKeepsSound(event.target.checked)} className="size-5" />
          {t('tools.video.timeline.keepSound')}
        </label>
      </div>
      {keepsSound && <p id="change-video-speed-sound-note" className="text-center text-sm text-ink-soft">{t('tools.video.speed.soundNote')}</p>}
      {info?.video && (
        <p id="change-video-speed-length" className="text-center text-sm font-medium">
          {isSpeedValid ? t('tools.video.speed.newLength', { original: isolateLeftToRight(formatDuration(info.durationSeconds)), length: isolateLeftToRight(formatDuration(info.durationSeconds / speed)) }) : t('tools.video.speed.range')}
        </p>
      )}
      <ActionButton id="change-video-speed-button" label={t('tools.video.speed.button')} isDisabled={!info?.video || !isSpeedValid} isRunning={job.isRunning} onClick={changeSpeed} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Mute video

export function MuteVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const read = useVideoInfos(files).get(file)
  const info = videoInfoOf(read)
  const job = useVideoJob(onResult)

  function removeSound() {
    void job.run(async (onProgress, signal) => {
      const answer = await runVideoTask({ type: 'convert', file, settings: { container: outputContainerOf(file), dropAudio: true } }, onProgress, signal)
      return resultFileOf(answer, file.name, 'muted')
    })
  }

  return (
    <div id="mute-video-tool" className="space-y-5 text-start">
      <VideoPreview id="mute-video-preview" file={file} read={read} />
      <p id="mute-video-note" className="text-center text-sm text-ink-soft">
        {info && !info.audio ? t('tools.video.mute.alreadySilent') : t('tools.video.mute.note')}
      </p>
      <ActionButton id="mute-video-button" label={t('tools.video.mute.button')} isDisabled={!info?.video} isRunning={job.isRunning} onClick={removeSound} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Add audio to video

const SOUND_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'aac']

// The probe decides once it has read the file (a picture track means a video); until then the type and extension do.
function isSoundFile(file: File, read: ReadVideo | undefined) {
  const info = videoInfoOf(read)
  if (info) return !info.video && Boolean(info.audio)
  return file.type.startsWith('audio/') || SOUND_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() ?? '')
}

export function AddAudioToVideo({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const readByFile = useVideoInfos(files)
  const job = useVideoJob(onResult)
  const [repeatsSound, setRepeatsSound] = useState(true)

  const soundFiles = files.filter((file) => isSoundFile(file, readByFile.get(file)))
  const videoFiles = files.filter((file) => !soundFiles.includes(file))
  const videoFile = videoFiles[0]
  const soundFile = soundFiles[0]
  const videoInfo = videoInfoOf(readByFile.get(videoFile))
  const soundInfo = videoInfoOf(readByFile.get(soundFile))

  const missingMessage =
    videoFiles.length > 1 ? t('tools.video.addAudio.oneVideo')
    : soundFiles.length > 1 ? t('tools.video.addAudio.oneSound')
    : !videoFile ? t('tools.video.addAudio.needVideo')
    : !soundFile ? t('tools.video.addAudio.needSound')
    : ''

  function addSound() {
    void job.run(async (onProgress, signal) => {
      const answer = await runVideoTask({ type: 'convert', file: videoFile, settings: { container: outputContainerOf(videoFile), addedAudio: { file: soundFile, loop: repeatsSound } } }, onProgress, signal)
      return resultFileOf(answer, videoFile.name, 'with-sound')
    })
  }

  return (
    <div id="add-audio-to-video-tool" className="space-y-5 text-start">
      {videoFile && <VideoPreview id="add-audio-to-video-preview" file={videoFile} read={readByFile.get(videoFile)} />}
      <ul id="add-audio-to-video-files" aria-label={t('tools.video.addAudio.filesLabel')} className="space-y-2">
        {files.map((file, index) => {
          const info = videoInfoOf(readByFile.get(file))
          return (
            <li key={`${file.name}-${index}`} id={`add-audio-to-video-file-${index + 1}`} className="flex items-center gap-3 rounded-[14px] border-2 border-rule bg-paper-raised py-1 ps-4 pe-1">
              <span className="min-w-0 flex-1">
                <bdi className="block truncate font-medium">{file.name}</bdi>
                <span className="block text-sm text-ink-soft">
                  {soundFiles.includes(file) ? t('tools.video.addAudio.roleSound') : t('tools.video.addAudio.roleVideo')}
                  {info && (
                    <>
                      {' · '}
                      {lengthText(info.durationSeconds)}
                    </>
                  )}
                </span>
              </span>
              <button id={`add-audio-to-video-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: file.name })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </li>
          )
        })}
      </ul>
      {missingMessage && (
        <div className="space-y-3 text-center">
          <p id="add-audio-to-video-missing" role="status" className="font-medium">{missingMessage}</p>
          {(!videoFile || !soundFile) && (
            <button id="add-audio-to-video-add-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
              {!videoFile ? t('tools.video.addAudio.chooseVideo') : t('tools.video.addAudio.chooseSound')}
            </button>
          )}
        </div>
      )}
      {!missingMessage && (
        <>
          <div className="flex justify-center">
            <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
              <input id="add-audio-to-video-repeat-checkbox" type="checkbox" checked={repeatsSound} onChange={(event) => setRepeatsSound(event.target.checked)} className="size-5" />
              {t('tools.video.addAudio.repeat')}
            </label>
          </div>
          <p id="add-audio-to-video-note" className="text-center text-sm text-ink-soft">
            {t('tools.video.addAudio.note')}
            {videoInfo && soundInfo && (
              <>
                {' '}
                {t('tools.video.addAudio.lengths')} {lengthText(videoInfo.durationSeconds)} / {lengthText(soundInfo.durationSeconds)}
              </>
            )}
          </p>
        </>
      )}
      <ActionButton id="add-audio-to-video-button" label={t('tools.video.addAudio.button')} isDisabled={Boolean(missingMessage) || !videoInfo?.video || !soundInfo} isRunning={job.isRunning} onClick={addSound} />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}
