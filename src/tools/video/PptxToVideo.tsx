// PowerPoint to video: each slide drawn by the PowerPoint viewer's renderer (renderSlideToCanvas, the one path from a slide to
// pixels), then shown for a few seconds each in an MP4 or WebM made by the video worker.
import { useState } from 'react'
import { useT } from '../../i18n'
import type { ToolProps } from '../registry'
import { parsePageRanges } from '../pdf/PdfToolParts'
import { resultFileOf, runVideoTask } from './videoTasks'
import { ActionButton, fieldClass, useVideoJob } from './VideoToolParts'

// Slides don't move, so a low frame rate keeps the file small and the encoding quick.
const SLIDE_FRAME_RATE = 10
const WIDTH_BY_SIZE = { '1080p': 1920, '720p': 1280 }
type VideoSize = keyof typeof WIDTH_BY_SIZE
// The range field is checked before the deck is opened, so its numbers are checked against a ceiling rather than the slide count.
const HIGHEST_SLIDE_NUMBER = 999

// The chosen slides as 0-based indexes in deck order; numbers past the deck's end are left out. All slides when the field is empty.
function chosenSlideIndexes(rangesText: string, slideCount: number) {
  if (!rangesText.trim()) return Array.from({ length: slideCount }, (_, index) => index)
  const groups = parsePageRanges(rangesText, HIGHEST_SLIDE_NUMBER) ?? []
  return [...new Set(groups.flat())].filter((slideNumber) => slideNumber <= slideCount).sort((first, second) => first - second).map((slideNumber) => slideNumber - 1)
}

async function slidesToVideo(file: File, settings: { secondsEach: number; size: VideoSize; container: 'mp4' | 'webm'; rangesText: string }, onSlideDrawn: (done: number, total: number) => void, onProgress: (done: number, total: number) => void, signal: AbortSignal) {
  const [{ PptxViewer }, { renderSlideToCanvas, routeStyleAttributesThroughCssom }] = await Promise.all([import('@aiden0z/pptx-renderer'), import('../../formats/powerpoint/slideCanvas')])
  routeStyleAttributesThroughCssom()
  const stage = document.createElement('div')
  stage.dir = 'ltr'
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;color-scheme:light;background:#fff'
  stage.setAttribute('aria-hidden', 'true')
  document.body.append(stage)
  const pictures: ImageBitmap[] = []
  let viewer: Awaited<ReturnType<typeof PptxViewer.open>> | null = null
  try {
    viewer = await PptxViewer.open(await file.arrayBuffer(), stage, { renderMode: 'slide', lazySlides: true, lazyMedia: true, pdfjs: false, externalMedia: 'block' })
    const slideIndexes = chosenSlideIndexes(settings.rangesText, viewer.slideCount)
    if (slideIndexes.length === 0) throw new Error('No slides to draw')
    for (const [doneCount, slideIndex] of slideIndexes.entries()) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      onSlideDrawn(doneCount, slideIndexes.length)
      const canvas = await renderSlideToCanvas(viewer, slideIndex, { width: WIDTH_BY_SIZE[settings.size] })
      pictures.push(await createImageBitmap(canvas))
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    const answer = await runVideoTask({ type: 'pictures-to-video', pictures, secondsEach: settings.secondsEach, container: settings.container, frameRate: SLIDE_FRAME_RATE }, onProgress, signal)
    return resultFileOf(answer, file.name, '')
  } finally {
    // Pictures handed to the worker are already detached; closing them again does nothing.
    pictures.forEach((picture) => picture.close())
    viewer?.destroy()
    stage.remove()
  }
}

export function PptxToVideo({ files, onResult }: ToolProps) {
  const { t } = useT()
  const job = useVideoJob(onResult)
  const [secondsEach, setSecondsEach] = useState(5)
  const [size, setSize] = useState<VideoSize>('1080p')
  const [container, setContainer] = useState<'mp4' | 'webm'>('mp4')
  const [rangesText, setRangesText] = useState('')
  const [phaseText, setPhaseText] = useState('')
  const file = files[0]
  const isRangeInvalid = rangesText.trim() !== '' && parsePageRanges(rangesText, HIGHEST_SLIDE_NUMBER) === null
  const isSecondsInvalid = !(secondsEach >= 1 && secondsEach <= 30)

  function makeVideo() {
    if (!file) return
    void job.run((onProgress, signal) =>
      slidesToVideo(
        file,
        { secondsEach, size, container, rangesText },
        (done, total) => {
          setPhaseText(t('tools.video.slides.drawing', { done: done + 1, total }))
          onProgress(done, total)
        },
        (done, total) => {
          setPhaseText(t('tools.video.slides.encoding'))
          onProgress(done, total)
        },
        signal,
      ),
    )
  }

  return (
    <div id="pptx-to-video-tool" className="space-y-4 text-start">
      {file && (
        <p className="text-center font-medium">
          <bdi>{file.name}</bdi>
        </p>
      )}
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.slides.seconds')}
          <input id="pptx-to-video-seconds" type="number" dir="ltr" min="1" max="30" step="1" inputMode="numeric" value={Number.isNaN(secondsEach) ? '' : secondsEach} onChange={(event) => setSecondsEach(event.target.valueAsNumber)} aria-invalid={isSecondsInvalid} className={`${fieldClass} w-28 text-center`} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.slides.size')}
          <select id="pptx-to-video-size" value={size} onChange={(event) => setSize(event.target.value as VideoSize)} className={fieldClass}>
            <option value="1080p">{t('tools.video.slides.size1080')}</option>
            <option value="720p">{t('tools.video.slides.size720')}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.slides.format')}
          <select id="pptx-to-video-format" value={container} onChange={(event) => setContainer(event.target.value as 'mp4' | 'webm')} className={fieldClass}>
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t('tools.video.slides.only')}
          <input id="pptx-to-video-slides" dir="ltr" value={rangesText} onChange={(event) => setRangesText(event.target.value)} placeholder="1-3, 5" aria-invalid={isRangeInvalid} className={`${fieldClass} w-36 text-center`} />
        </label>
      </div>
      <p className="text-center text-xs text-ink-soft">{t('tools.video.slides.hint')}</p>
      {isRangeInvalid && <p className="text-center text-sm text-danger">{t('tools.video.slides.invalidRange')}</p>}
      {isSecondsInvalid && <p className="text-center text-sm text-danger">{t('tools.video.slides.invalidSeconds')}</p>}
      <ActionButton id="pptx-to-video-button" label={t('tools.video.slides.button')} isDisabled={!file || isRangeInvalid || isSecondsInvalid} isRunning={job.isRunning} onClick={makeVideo} />
      {job.isRunning && phaseText && (
        <p id="pptx-to-video-phase" className="text-center text-sm font-medium">
          {phaseText}
        </p>
      )}
      {job.progressBar}
      {job.errorLine}
    </div>
  )
}
