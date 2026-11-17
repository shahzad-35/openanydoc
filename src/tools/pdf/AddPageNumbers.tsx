import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { PdfFileList, ProgressBar, StampPreview, baseNameOf, drawTextPicture, pdfResultFile, pngBytesOf, problemMessageKey, shownPageSizes, toArabicIndicDigits, useOpenedPdfs } from './PdfToolParts'
import type { StampPicture } from './PdfToolParts'
import { runPdfTask } from './pdfTasks'
import type { PageBox, PageStamp } from './pdfTasks'

type PageNumberPosition = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'
type NumberFormat = 'number' | 'number-of-total' | 'page-of-total'
const positions: PageNumberPosition[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left']
const formats: NumberFormat[] = ['number', 'number-of-total', 'page-of-total']
const SIZES_IN_POINTS = { small: 9, medium: 11, large: 15 }
const MARGIN_POINTS = 24
const NUMBER_COLOR = '#333333'
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'

// Where a number of this size sits on a page of this size (as shown), MARGIN_POINTS in from the chosen edges.
function numberBox(position: PageNumberPosition, page: { width: number; height: number }, picture: StampPicture): PageBox {
  const [vertical, horizontal] = position.split('-')
  const x = horizontal === 'left' ? MARGIN_POINTS : horizontal === 'right' ? page.width - MARGIN_POINTS - picture.width : (page.width - picture.width) / 2
  const y = vertical === 'top' ? MARGIN_POINTS : page.height - MARGIN_POINTS - picture.height
  return { x, y, width: picture.width, height: picture.height }
}

// Add page numbers: "1", "1 / 12" or "Page 1 of 12" on every page (or all but the first), in Western or Arabic-Indic digits. The
// numbers are drawn by the browser and stamped as pictures, so Arabic words and digits look right.
export default function AddPageNumbers({ files, onFilesChange, onResult }: ToolProps) {
  const { locale, t } = useT()
  const chosenFile = files[0]
  const opened = useOpenedPdfs(files).get(chosenFile)
  const pdfDocument = opened && 'document' in opened ? opened.document : null
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center')
  const [firstNumber, setFirstNumber] = useState(1)
  const [format, setFormat] = useState<NumberFormat>('number')
  const [isArabicIndic, setIsArabicIndic] = useState(locale === 'ar')
  const [size, setSize] = useState<keyof typeof SIZES_IN_POINTS>('medium')
  const [isFirstPageSkipped, setIsFirstPageSkipped] = useState(false)
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([])
  const [previewStamp, setPreviewStamp] = useState<{ picture: StampPicture; box: PageBox; opacity: number }[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // An error belongs to the files it was about; changing the list clears it.
  const [error, setError] = useState<{ files: File[]; message: string } | null>(null)
  const errorMessage = error?.files === files ? error.message : opened && 'problem' in opened ? t(problemMessageKey(opened.problem)) : ''
  const lastNumber = firstNumber + (pdfDocument?.numPages ?? 1) - 1

  function numberLabel(pageNumber: number) {
    const label = format === 'number' ? String(pageNumber) : format === 'number-of-total' ? `${pageNumber} / ${lastNumber}` : t('tools.pageNumbers.pageOfTotal', { page: pageNumber, total: lastNumber })
    return isArabicIndic ? toArabicIndicDigits(label) : label
  }

  useEffect(() => {
    if (!pdfDocument) return
    let isCurrent = true
    void shownPageSizes(pdfDocument).then((sizes) => isCurrent && setPageSizes(sizes))
    return () => {
      isCurrent = false
    }
  }, [pdfDocument])

  // The preview shows the first numbered page.
  const previewPageIndex = isFirstPageSkipped && pageSizes.length > 1 ? 1 : 0
  useEffect(() => {
    if (pageSizes.length === 0) return
    let isCurrent = true
    void drawTextPicture(numberLabel(firstNumber + previewPageIndex), { sizePoints: SIZES_IN_POINTS[size], color: NUMBER_COLOR }).then((picture) => {
      if (isCurrent) setPreviewStamp([{ picture, box: numberBox(position, pageSizes[previewPageIndex], picture), opacity: 1 }])
    })
    return () => {
      isCurrent = false
    }
    // numberLabel reads the options listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSizes, position, firstNumber, format, isArabicIndic, size, previewPageIndex, locale])

  async function addPageNumbers() {
    setError(null)
    setProgress({ done: 0, total: pageSizes.length })
    try {
      const images: ArrayBuffer[] = []
      const stamps: PageStamp[] = []
      for (const [pageIndex, pageSize] of pageSizes.entries()) {
        if (isFirstPageSkipped && pageIndex === 0) continue
        const picture = await drawTextPicture(numberLabel(firstNumber + pageIndex), { sizePoints: SIZES_IN_POINTS[size], color: NUMBER_COLOR })
        images.push(await pngBytesOf(picture.canvas))
        stamps.push({ pageIndex, imageIndex: images.length - 1, box: numberBox(position, pageSize, picture) })
      }
      const response = await runPdfTask({ type: 'stamp-pdf', pdf: await chosenFile.arrayBuffer(), images, stamps }, (done, total) => setProgress({ done, total }))
      if (response.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${baseNameOf(chosenFile.name)}-numbered.pdf`))
      else setError({ files, message: t(problemMessageKey(response.status === 'error' ? response.reason : 'unreadable')) })
    } catch {
      setError({ files, message: t('tools.pdf.unreadable') })
    }
    setProgress(null)
  }

  const selectOptions: { id: string; labelKey: MessageKey; value: string; onChange: (value: string) => void; choices: [string, string][] }[] = [
    { id: 'page-number-position-select', labelKey: 'tools.pageNumbers.position', value: position, onChange: (value) => setPosition(value as PageNumberPosition), choices: positions.map((option) => [option, t(`tools.pageNumbers.position.${option}` as MessageKey)]) },
    { id: 'numbers-format-select', labelKey: 'tools.pageNumbers.format', value: format, onChange: (value) => setFormat(value as NumberFormat), choices: formats.map((option) => [option, t(`tools.pageNumbers.format.${option}` as MessageKey)]) },
    { id: 'numbers-digits-select', labelKey: 'tools.pageNumbers.digits', value: isArabicIndic ? 'arabic' : 'western', onChange: (value) => setIsArabicIndic(value === 'arabic'), choices: [['western', t('tools.pageNumbers.digits.western')], ['arabic', t('tools.pageNumbers.digits.arabic')]] },
    { id: 'numbers-size-select', labelKey: 'tools.pageNumbers.size', value: size, onChange: (value) => setSize(value as keyof typeof SIZES_IN_POINTS), choices: (['small', 'medium', 'large'] as const).map((option) => [option, t(`tools.pageNumbers.size.${option}`)]) },
  ]
  return (
    <div id="add-page-numbers-tool" className="space-y-4">
      <PdfFileList files={files} onFilesChange={onFilesChange} />
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        {selectOptions.map((option) => (
          <label key={option.id} className="flex flex-col gap-1 text-sm font-medium">
            {t(option.labelKey)}
            <select id={option.id} value={option.value} onChange={(event) => option.onChange(event.target.value)} className={fieldClass}>
              {option.choices.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.pageNumbers.firstNumber')}
          <input id="page-number-first-input" type="number" min="0" dir="ltr" value={firstNumber} onChange={(event) => setFirstNumber(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className={`${fieldClass} w-28`} />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="numbers-skip-first-checkbox" type="checkbox" checked={isFirstPageSkipped} onChange={(event) => setIsFirstPageSkipped(event.target.checked)} className="size-5" />
          {t('tools.pageNumbers.skipFirst')}
        </label>
      </div>
      {pdfDocument && previewStamp.length > 0 && <StampPreview id="page-numbers-preview" label={t('tools.stamp.previewLabel', { page: previewPageIndex + 1 })} document={pdfDocument} pageIndex={previewPageIndex} stamps={previewStamp} />}
      <p id="page-numbers-picture-note" className="text-center text-sm text-ink-soft">{t('tools.stamp.pictureNote')}</p>
      <div className="flex justify-center">
        <button id="add-page-numbers-button" type="button" disabled={!pdfDocument || pageSizes.length === 0 || progress !== null} onClick={() => void addPageNumbers()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.pageNumbers.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.pages', { done: progress.done, total: progress.total })} />}
      <Notice id="add-page-numbers-error" kind="error" role="alert" className="text-center font-medium text-danger" message={errorMessage} />
    </div>
  )
}
