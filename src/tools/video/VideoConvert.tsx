// Video converter (MP4, WebM, MOV, MKV with a chosen codec and quality) and the focused MOV, WebM and MKV to MP4 pages, which make
// an MP4 with H.264 and AAC (the worker's defaults). One video at a time: choosing another replaces it.
import { useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import type { ToolProps } from '../registry'
import { Notice } from '../../components/Messages'
import { ActionButton, VideoPreview, fieldClass, useEncodableCodecs, useVideoInfos, useVideoJob, videoInfoOf } from './VideoToolParts'
import { codecName, resultFileOf, runVideoTask } from './videoTasks'
import type { VideoContainer, VideoQuality } from './videoTasks'
import type { VideoCodec } from 'mediabunny'

const CONTAINERS: VideoContainer[] = ['mp4', 'webm', 'mov', 'mkv']
const QUALITIES: VideoQuality[] = ['very-low', 'low', 'medium', 'high', 'very-high']
const QUALITY_LABELS: Record<VideoQuality, MessageKey> = {
  'very-low': 'tools.video.convert.qualityVeryLow',
  low: 'tools.video.convert.qualityLow',
  medium: 'tools.video.convert.qualityMedium',
  high: 'tools.video.convert.qualityHigh',
  'very-high': 'tools.video.convert.qualityVeryHigh',
}
// The codecs the worker tries first for each container, in its order (PREFERRED_VIDEO_CODECS in videoTools.worker.ts): the first
// one this browser can make is what "Automatic" gives, and the ones missing here are worth a word.
const AUTOMATIC_CODECS: Record<VideoContainer, VideoCodec[]> = { mp4: ['avc', 'hevc', 'vp9', 'av1'], mov: ['avc', 'hevc', 'prores'], mkv: ['avc', 'hevc', 'vp9', 'av1'], webm: ['vp9', 'vp8', 'av1'] }

function ConvertVideo({ slug, files, onResult, choosesFormat }: ToolProps & { slug: string; choosesFormat: boolean }) {
  const { t } = useT()
  const readByFile = useVideoInfos(files)
  const file = files[0]
  const info = videoInfoOf(file && readByFile.get(file))
  const [container, setContainer] = useState<VideoContainer>('mp4')
  const [videoCodec, setVideoCodec] = useState<VideoCodec | 'automatic'>('automatic')
  const [quality, setQuality] = useState<VideoQuality | 'keep'>('keep')
  const encodable = useEncodableCodecs(container)
  const job = useVideoJob(onResult)

  const madeCodec = videoCodec !== 'automatic' ? videoCodec : (AUTOMATIC_CODECS[container].find((codec) => encodable?.video.includes(codec)) ?? encodable?.video[0])
  const isCopied = info?.video?.codec === madeCodec && quality === 'keep'
  const missingCodecs = encodable ? AUTOMATIC_CODECS[container].filter((codec) => !encodable.video.includes(codec)) : []

  function chooseContainer(newContainer: VideoContainer) {
    setContainer(newContainer)
    setVideoCodec('automatic')
  }

  function convert() {
    void job.run(async (onProgress, signal) => {
      const settings = { container, videoCodec: videoCodec === 'automatic' ? undefined : videoCodec, quality: quality === 'keep' ? undefined : quality }
      const answer = await runVideoTask({ type: 'convert', file, settings }, onProgress, signal)
      return resultFileOf(answer, file.name, '')
    })
  }

  return (
    <div id={`${slug}-tool`} className="space-y-5 text-start">
      {file && <VideoPreview id={`${slug}-preview`} file={file} read={readByFile.get(file)} />}
      {choosesFormat && (
        <div className="flex flex-wrap items-end justify-center gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.video.convert.format')}
            <select id={`${slug}-format-select`} value={container} onChange={(event) => chooseContainer(event.target.value as VideoContainer)} className={fieldClass}>
              {CONTAINERS.map((choice) => (
                <option key={choice} value={choice}>
                  {choice.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.video.convert.codec')}
            <select id={`${slug}-codec-select`} value={videoCodec} disabled={!encodable} onChange={(event) => setVideoCodec(event.target.value as VideoCodec | 'automatic')} className={fieldClass}>
              <option value="automatic">{t('tools.video.convert.automatic')}</option>
              {encodable?.video.map((codec) => (
                <option key={codec} value={codec}>
                  {codecName(codec)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.video.convert.quality')}
            <select id={`${slug}-quality-select`} value={quality} onChange={(event) => setQuality(event.target.value as VideoQuality | 'keep')} className={fieldClass}>
              <option value="keep">{t('tools.video.convert.qualityKeep')}</option>
              {QUALITIES.map((choice) => (
                <option key={choice} value={choice}>
                  {t(QUALITY_LABELS[choice])}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {choosesFormat && missingCodecs.length > 0 && (
        <Notice id={`${slug}-missing-codecs`} kind="info" role="status" className="text-center text-sm text-ink-soft" message={t('tools.video.convert.missingCodecs', { codecs: missingCodecs.map(codecName).join(', ') })} />
      )}
      {info?.video && madeCodec && (
        <p id={`${slug}-plan`} className="text-center text-sm text-ink-soft">
          {isCopied ? t('tools.video.convert.willCopy', { codec: codecName(madeCodec) }) : t('tools.video.convert.willEncode', { codec: codecName(madeCodec) })}
        </p>
      )}
      <ActionButton
        id={`${slug}-button`}
        label={t('tools.video.convert.button', { format: container.toUpperCase() })}
        isDisabled={!info?.video || !encodable}
        isRunning={job.isRunning}
        onClick={convert}
      />
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}

export const VideoConverter = (props: ToolProps) => <ConvertVideo {...props} slug="video-converter" choosesFormat />
export const MovToMp4 = (props: ToolProps) => <ConvertVideo {...props} slug="mov-to-mp4" choosesFormat={false} />
export const WebmToMp4 = (props: ToolProps) => <ConvertVideo {...props} slug="webm-to-mp4" choosesFormat={false} />
export const MkvToMp4 = (props: ToolProps) => <ConvertVideo {...props} slug="mkv-to-mp4" choosesFormat={false} />
