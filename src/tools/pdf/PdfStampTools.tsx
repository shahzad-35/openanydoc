// Watermark and Header & footer: settings put on every chosen page, with a live preview of the first one. Text is drawn by the
// browser and stamped as a picture (PdfToolParts: drawTextPicture), so Arabic is joined and right to left.
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { PagesChoice, PdfFileList, ProgressBar, StampPreview, baseNameOf, chosenPageIndexes, drawTextPicture, pdfResultFile, pngBytesOf, problemMessageKey, shownPageSizes, toArabicIndicDigits, turnPicture, useOpenedPdfs } from './PdfToolParts'
import type { PagesChoiceValue, StampPicture } from './PdfToolParts'
import { runPdfTask } from './pdfTasks'
import type { PageBox, PageStamp } from './pdfTasks'

const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const COLORS: Record<string, string> = { grey: '#808080', red: '#c0392b', blue: '#2f5fd0', black: '#1f1f1f' }
const EDGE_MARGIN_POINTS = 28
type PageSize = { width: number; height: number }
type PreviewStamp = { picture: StampPicture; box: PageBox; opacity: number }

// The chosen PDF opened with pdf.js and every page's size as shown, for placing stamps and drawing the preview.
function useChosenPdf(files: File[]) {
  const chosenFile = files[0]
  const opened = useOpenedPdfs(files).get(chosenFile)
  const pdfDocument = opened && 'document' in opened ? opened.document : null
  const [pageSizes, setPageSizes] = useState<PageSize[]>([])
  useEffect(() => {
    if (!pdfDocument) return
    let isCurrent = true
    void shownPageSizes(pdfDocument).then((sizes) => isCurrent && setPageSizes(sizes))
    return () => {
      isCurrent = false
    }
  }, [pdfDocument])
  return { chosenFile, pdfDocument, pageSizes, problem: opened && 'problem' in opened ? opened.problem : null }
}

// Sends the stamps to the worker and hands the stamped PDF to the page, with progress and a message when it fails.
function useStampRunner(files: File[], onResult: (file: File) => void, resultSuffix: string) {
  const { t } = useT()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<{ files: File[]; message: string } | null>(null)
  async function stamp(buildStamps: () => Promise<{ images: ArrayBuffer[]; stamps: PageStamp[] }>) {
    setError(null)
    setProgress({ done: 0, total: 0 })
    try {
      const { images, stamps } = await buildStamps()
      const response = await runPdfTask({ type: 'stamp-pdf', pdf: await files[0].arrayBuffer(), images, stamps }, (done, total) => setProgress({ done, total }))
      if (response.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${baseNameOf(files[0].name)}-${resultSuffix}.pdf`))
      else setError({ files, message: t(problemMessageKey(response.status === 'error' ? response.reason : 'unreadable')) })
    } catch {
      setError({ files, message: t('tools.pdf.unreadable') })
    }
    setProgress(null)
  }
  return { progress, errorMessage: error?.files === files ? error.message : '', stamp }
}

function SelectField({ id, label, value, onChange, choices }: { id: string; label: string; value: string; onChange: (value: string) => void; choices: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        {choices.map(([choice, choiceLabel]) => (
          <option key={choice} value={choice}>
            {choiceLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

// ---------------------------------------------------------------- Watermark

type WatermarkPosition = `${'top' | 'middle' | 'bottom'}-${'start' | 'center' | 'end'}` | 'tiled'
const GRID_POSITIONS: WatermarkPosition[] = ['top-start', 'top-center', 'top-end', 'middle-start', 'middle-center', 'middle-end', 'bottom-start', 'bottom-center', 'bottom-end']

// The boxes a watermark of this size takes on a page: one in the chosen cell of a 3×3 grid (start/end are left/right on the
// page itself, not the site's language), or a staggered grid of copies covering the page.
function watermarkBoxes(position: WatermarkPosition, page: PageSize, size: { width: number; height: number }): PageBox[] {
  if (position === 'tiled') {
    const boxes: PageBox[] = []
    const stepX = size.width * 1.6
    const stepY = size.height * 2.2
    for (let row = 0, y = -size.height / 2; y < page.height; row++, y += stepY) {
      for (let x = (row % 2) * (stepX / 2) - size.width / 2; x < page.width; x += stepX) boxes.push({ x, y, ...size })
    }
    return boxes
  }
  const [vertical, horizontal] = position.split('-')
  const column = horizontal === 'start' ? 0 : horizontal === 'center' ? 1 : 2
  const row = vertical === 'top' ? 0 : vertical === 'middle' ? 1 : 2
  return [{ x: EDGE_MARGIN_POINTS + (column * (page.width - 2 * EDGE_MARGIN_POINTS - size.width)) / 2, y: EDGE_MARGIN_POINTS + (row * (page.height - 2 * EDGE_MARGIN_POINTS - size.height)) / 2, ...size }]
}

export function WatermarkPdf({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const { chosenFile, pdfDocument, pageSizes, problem } = useChosenPdf(files)
  const [isImage, setIsImage] = useState(false)
  const [text, setText] = useState(() => t('tools.watermark.defaultText'))
  const [textSize, setTextSize] = useState(60)
  const [color, setColor] = useState('grey')
  const [picture, setPicture] = useState<ImageBitmap | null>(null)
  const [pictureWidthPercent, setPictureWidthPercent] = useState(40)
  const [opacityPercent, setOpacityPercent] = useState(30)
  const [rotation, setRotation] = useState(45)
  const [position, setPosition] = useState<WatermarkPosition>('middle-center')
  const [pagesChoice, setPagesChoice] = useState<PagesChoiceValue>({ isAllPages: true, ranges: '' })
  const [preview, setPreview] = useState<{ pageIndex: number; stamps: PreviewStamp[] } | null>(null)
  const pictureInputRef = useRef<HTMLInputElement>(null)
  const { progress, errorMessage, stamp } = useStampRunner(files, onResult, 'watermarked')
  const pageIndexes = chosenPageIndexes(pagesChoice, pageSizes.length)
  const isReady = pageSizes.length > 0 && pageIndexes !== null && pageIndexes.length > 0 && (isImage ? picture !== null : text.trim() !== '')

  // The watermark at its drawn size for a page (a picture is sized against each page's width).
  async function watermarkPicture() {
    return isImage && picture ? turnPicture(picture, 600, rotation) : drawTextPicture(text.trim(), { sizePoints: textSize, color: COLORS[color], fontWeight: 700, rotationDegrees: rotation })
  }
  function boxSizeOn(page: PageSize, drawn: StampPicture) {
    if (!isImage) return { width: drawn.width, height: drawn.height }
    const width = (page.width * pictureWidthPercent) / 100
    return { width, height: (width * drawn.height) / drawn.width }
  }

  useEffect(() => {
    if (!isReady || !pageIndexes) return
    let isCurrent = true
    const pageIndex = pageIndexes[0]
    void watermarkPicture().then((drawn) => {
      if (!isCurrent) return
      setPreview({ pageIndex, stamps: watermarkBoxes(position, pageSizes[pageIndex], boxSizeOn(pageSizes[pageIndex], drawn)).map((box) => ({ picture: drawn, box, opacity: opacityPercent / 100 })) })
    })
    return () => {
      isCurrent = false
    }
    // The helpers read the settings listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isImage, text, textSize, color, picture, pictureWidthPercent, opacityPercent, rotation, position, pageSizes, pagesChoice])

  function saveWatermarkedPdf() {
    void stamp(async () => {
      const drawn = await watermarkPicture()
      const stamps = (pageIndexes ?? []).flatMap((pageIndex) => watermarkBoxes(position, pageSizes[pageIndex], boxSizeOn(pageSizes[pageIndex], drawn)).map((box) => ({ pageIndex, imageIndex: 0, box, opacity: opacityPercent / 100 })))
      return { images: [await pngBytesOf(drawn.canvas)], stamps }
    })
  }

  const rotationChoices: [string, string][] = ['0', '45', '90', '-45'].map((angle) => [angle, t('tools.watermark.degrees', { angle })])
  return (
    <div id="watermark-pdf-tool" className="space-y-5 text-start">
      <PdfFileList files={files} onFilesChange={onFilesChange} />
      <fieldset className="flex flex-wrap items-center justify-center gap-4">
        <legend className="sr-only">{t('tools.watermark.kind')}</legend>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="watermark-type-text-radio" type="radio" name="watermark-kind" checked={!isImage} onChange={() => setIsImage(false)} className="size-5" />
          {t('tools.watermark.text')}
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input id="watermark-type-image-radio" type="radio" name="watermark-kind" checked={isImage} onChange={() => setIsImage(true)} className="size-5" />
          {t('tools.watermark.image')}
        </label>
      </fieldset>
      <div className="flex flex-wrap items-end justify-center gap-4">
        {isImage ? (
          <>
            <input
              ref={pictureInputRef}
              id="watermark-image-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const pictureFile = event.target.files?.[0]
                if (pictureFile) void createImageBitmap(pictureFile).then(setPicture, () => setPicture(null))
                event.target.value = ''
              }}
            />
            <button id="watermark-choose-image-button" type="button" onClick={() => pictureInputRef.current?.click()} className="btn btn--quiet press">
              {picture ? t('tools.watermark.changeImage') : t('tools.watermark.chooseImage')}
            </button>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.watermark.imageWidth', { percent: pictureWidthPercent })}
              <input id="watermark-image-width-input" type="range" min="10" max="100" step="5" value={pictureWidthPercent} onChange={(event) => setPictureWidthPercent(Number(event.target.value))} className="min-h-11 w-40" />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.watermark.textLabel')}
              <input id="watermark-text-input" type="text" dir="auto" value={text} onChange={(event) => setText(event.target.value)} className={`${fieldClass} w-56`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('tools.watermark.textSize', { size: textSize })}
              <input id="watermark-text-size-input" type="range" min="16" max="120" step="2" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} className="min-h-11 w-40" />
            </label>
            <SelectField id="watermark-color-select" label={t('tools.watermark.color')} value={color} onChange={setColor} choices={Object.keys(COLORS).map((name) => [name, t(`tools.color.${name}` as MessageKey)])} />
          </>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.watermark.opacity', { percent: opacityPercent })}
          <input id="watermark-opacity-input" type="range" min="10" max="100" step="5" value={opacityPercent} onChange={(event) => setOpacityPercent(Number(event.target.value))} className="min-h-11 w-40" />
        </label>
        <SelectField id="watermark-rotation-select" label={t('tools.watermark.rotation')} value={String(rotation)} onChange={(value) => setRotation(Number(value))} choices={rotationChoices} />
      </div>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t('tools.watermark.position')}</legend>
          {/* The grid shows the page itself, so it stays left to right on an Arabic page. */}
          <div dir="ltr" className="grid w-max grid-cols-3 gap-1">
            {GRID_POSITIONS.map((cell) => (
              <button key={cell} id={`watermark-position-${cell}-button`} type="button" aria-pressed={position === cell} aria-label={t(`tools.watermark.cell.${cell}` as MessageKey)} onClick={() => setPosition(cell)} className={`size-11 rounded-md border-2 ${position === cell ? 'border-accent bg-accent/20' : 'border-rule bg-paper-raised'}`} />
            ))}
          </div>
          <label className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input id="watermark-tiled-checkbox" type="checkbox" checked={position === 'tiled'} onChange={(event) => setPosition(event.target.checked ? 'tiled' : 'middle-center')} className="size-5" />
            {t('tools.watermark.tiled')}
          </label>
        </fieldset>
        <PagesChoice idPrefix="watermark" pageCount={pageSizes.length} value={pagesChoice} onChange={setPagesChoice} />
      </div>
      {pdfDocument && preview && <StampPreview id="watermark-preview" label={t('tools.stamp.previewLabel', { page: preview.pageIndex + 1 })} document={pdfDocument} pageIndex={preview.pageIndex} stamps={preview.stamps} />}
      <p id="watermark-picture-note" className="text-center text-sm text-ink-soft">{t(isImage ? 'tools.watermark.imageNote' : 'tools.stamp.pictureNote')}</p>
      <div className="flex justify-center">
        <button id="watermark-pdf-button" type="button" disabled={!chosenFile || !isReady || progress !== null} onClick={saveWatermarkedPdf} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.watermark.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={problem ? t(problemMessageKey(problem)) : errorMessage} />
    </div>
  )
}

// ---------------------------------------------------------------- Header & footer

type Slot = `${'header' | 'footer'}-${'start' | 'center' | 'end'}`
const SLOTS: Slot[] = ['header-start', 'header-center', 'header-end', 'footer-start', 'footer-center', 'footer-end']
const MARGINS_IN_POINTS = { small: 18, medium: 30, large: 45 }
const HEADER_SIZES_IN_POINTS = { small: 8, medium: 10, large: 13 }
const TOKENS = ['page', 'pages', 'date'] as const

export function HeaderFooterPdf({ files, onFilesChange, onResult }: ToolProps) {
  const { locale, t } = useT()
  const { chosenFile, pdfDocument, pageSizes, problem } = useChosenPdf(files)
  const [texts, setTexts] = useState<Record<Slot, string>>({ 'header-start': '', 'header-center': '', 'header-end': '', 'footer-start': '', 'footer-center': '{page} / {pages}', 'footer-end': '' })
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [isArabicIndic, setIsArabicIndic] = useState(locale === 'ar')
  const [size, setSize] = useState<keyof typeof HEADER_SIZES_IN_POINTS>('medium')
  const [margin, setMargin] = useState<keyof typeof MARGINS_IN_POINTS>('medium')
  const [isFirstPageSkipped, setIsFirstPageSkipped] = useState(false)
  const [pagesChoice, setPagesChoice] = useState<PagesChoiceValue>({ isAllPages: true, ranges: '' })
  const [preview, setPreview] = useState<{ pageIndex: number; stamps: PreviewStamp[] } | null>(null)
  const lastFocusedSlotRef = useRef<Slot>('footer-center')
  const { progress, errorMessage, stamp } = useStampRunner(files, onResult, 'header-footer')
  const pageIndexes = chosenPageIndexes(pagesChoice, pageSizes.length)?.filter((pageIndex) => !(isFirstPageSkipped && pageIndex === 0)) ?? null
  const hasText = SLOTS.some((slot) => texts[slot].trim() !== '')
  const isReady = pageSizes.length > 0 && pageIndexes !== null && pageIndexes.length > 0 && hasText
  const formattedDate = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00Z`))

  function slotText(slot: Slot, pageIndex: number) {
    const filled = texts[slot].trim().replaceAll('{page}', String(pageIndex + 1)).replaceAll('{pages}', String(pageSizes.length)).replaceAll('{date}', formattedDate)
    return isArabicIndic ? toArabicIndicDigits(filled) : filled
  }
  // The pictures and boxes of one page. Start and end follow the site's language: on an Arabic page, start is the right edge.
  async function pageStamps(pageIndex: number) {
    const page = pageSizes[pageIndex]
    const marginPoints = MARGINS_IN_POINTS[margin]
    const stamps: { picture: StampPicture; box: PageBox }[] = []
    for (const slot of SLOTS) {
      const text = slotText(slot, pageIndex)
      if (!text) continue
      const picture = await drawTextPicture(text, { sizePoints: HEADER_SIZES_IN_POINTS[size], color: '#333333', fontWeight: 500 })
      const [band, place] = slot.split('-')
      const isLeft = (place === 'start') === (locale !== 'ar')
      const x = place === 'center' ? (page.width - picture.width) / 2 : isLeft ? marginPoints : page.width - marginPoints - picture.width
      const y = band === 'header' ? marginPoints : page.height - marginPoints - picture.height
      stamps.push({ picture, box: { x, y, width: picture.width, height: picture.height } })
    }
    return stamps
  }

  useEffect(() => {
    if (!isReady || !pageIndexes) return
    let isCurrent = true
    const pageIndex = pageIndexes[0]
    void pageStamps(pageIndex).then((stamps) => isCurrent && setPreview({ pageIndex, stamps: stamps.map((stamped) => ({ ...stamped, opacity: 1 })) }))
    return () => {
      isCurrent = false
    }
    // pageStamps reads the settings listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, texts, date, isArabicIndic, size, margin, isFirstPageSkipped, pagesChoice, pageSizes, locale])

  function saveHeaderFooterPdf() {
    void stamp(async () => {
      const images: ArrayBuffer[] = []
      const stamps: PageStamp[] = []
      for (const pageIndex of pageIndexes ?? []) {
        for (const stamped of await pageStamps(pageIndex)) {
          images.push(await pngBytesOf(stamped.picture.canvas))
          stamps.push({ pageIndex, imageIndex: images.length - 1, box: stamped.box })
        }
      }
      return { images, stamps }
    })
  }

  function insertToken(token: (typeof TOKENS)[number]) {
    const slot = lastFocusedSlotRef.current
    setTexts((current) => ({ ...current, [slot]: `${current[slot]}${current[slot] && !current[slot].endsWith(' ') ? ' ' : ''}{${token}}` }))
    document.getElementById(`${slot}-input`)?.focus()
  }

  return (
    <div id="header-footer-pdf-tool" className="space-y-5 text-start">
      <PdfFileList files={files} onFilesChange={onFilesChange} />
      {(['header', 'footer'] as const).map((band) => (
        <fieldset key={band}>
          <legend className="mb-1 text-sm font-semibold">{t(`tools.headerFooter.${band}`)}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SLOTS.filter((slot) => slot.startsWith(band)).map((slot) => (
              <input
                key={slot}
                id={`${slot}-input`}
                type="text"
                dir="auto"
                value={texts[slot]}
                aria-label={t(`tools.headerFooter.slot.${slot}` as MessageKey)}
                placeholder={t(`tools.headerFooter.place.${slot.split('-')[1]}` as MessageKey)}
                onFocus={() => (lastFocusedSlotRef.current = slot)}
                onChange={(event) => setTexts((current) => ({ ...current, [slot]: event.target.value }))}
                className={`${fieldClass} w-full ${slot.endsWith('center') ? 'text-center' : slot.endsWith('end') ? 'text-end' : ''}`}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="font-medium">{t('tools.headerFooter.insert')}</span>
        {TOKENS.map((token) => (
          <button key={token} id={`header-footer-insert-${token}-button`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertToken(token)} className="btn btn--quiet btn--compact press">
            {t(`tools.headerFooter.token.${token}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.headerFooter.date')}
          <input id="header-footer-date-input" type="date" dir="ltr" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
        </label>
        <SelectField id="header-footer-digits-select" label={t('tools.pageNumbers.digits')} value={isArabicIndic ? 'arabic' : 'western'} onChange={(value) => setIsArabicIndic(value === 'arabic')} choices={[['western', t('tools.pageNumbers.digits.western')], ['arabic', t('tools.pageNumbers.digits.arabic')]]} />
        <SelectField id="header-footer-size-select" label={t('tools.pageNumbers.size')} value={size} onChange={(value) => setSize(value as keyof typeof HEADER_SIZES_IN_POINTS)} choices={(['small', 'medium', 'large'] as const).map((option) => [option, t(`tools.pageNumbers.size.${option}`)])} />
        <SelectField id="header-footer-margin-select" label={t('tools.headerFooter.margin')} value={margin} onChange={(value) => setMargin(value as keyof typeof MARGINS_IN_POINTS)} choices={(['small', 'medium', 'large'] as const).map((option) => [option, t(`tools.headerFooter.margin.${option}`)])} />
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="header-footer-skip-first-checkbox" type="checkbox" checked={isFirstPageSkipped} onChange={(event) => setIsFirstPageSkipped(event.target.checked)} className="size-5" />
          {t('tools.pageNumbers.skipFirst')}
        </label>
      </div>
      <div className="flex justify-center">
        <PagesChoice idPrefix="header-footer" pageCount={pageSizes.length} value={pagesChoice} onChange={setPagesChoice} />
      </div>
      {pdfDocument && preview && <StampPreview id="header-footer-preview" label={t('tools.stamp.previewLabel', { page: preview.pageIndex + 1 })} document={pdfDocument} pageIndex={preview.pageIndex} stamps={preview.stamps} />}
      <p id="header-footer-picture-note" className="text-center text-sm text-ink-soft">{t('tools.stamp.pictureNote')}</p>
      <div className="flex justify-center">
        <button id="header-footer-pdf-button" type="button" disabled={!chosenFile || !isReady || progress !== null} onClick={saveHeaderFooterPdf} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.headerFooter.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={problem ? t(problemMessageKey(problem)) : errorMessage} />
    </div>
  )
}
