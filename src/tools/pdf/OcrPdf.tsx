// OCR PDF: pages that are pictures (scans, photos) are read by tesseract.js (Apache-2.0) in its own worker, and the words found are
// laid over the unchanged pages as invisible text (pdfTools.worker.ts, `text-layer-pdf`), so the PDF can be searched, selected and
// copied. tesseract's worker, its WebAssembly core and the English and Arabic language data are files on this site (/models/), read
// on first use and then kept by the browser; nothing goes anywhere else (DECISIONS.md, Batch 6).
import { useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { LayerWord } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, pdfResultFile, problemMessageKey, useOpenedPdfs } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

type OcrLanguage = 'eng' | 'ara' | 'ara+eng'

// Pages are drawn at 250 dots per inch for reading: sharp enough for small print, small enough to stay quick.
const READING_DPI = 250
const POINTS_PER_INCH = 72
// A page with at least this many characters of text already has a text layer and is left as it is.
const TEXT_PAGE_CHARACTERS = 40
const LOWEST_WORD_CONFIDENCE = 45
// The tesseract files: from node_modules while developing, copied to /models/tesseract/ by the build (build-static-pages.mjs).
const TESSERACT_ROOT = import.meta.env.DEV ? { worker: '/node_modules/tesseract.js/dist/worker.min.js', core: '/node_modules/tesseract.js-core/' } : { worker: '/models/tesseract/worker.min.js', core: '/models/tesseract/' }
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'

export default function OcrPdf({ files, onResult }: ToolProps) {
  const { locale, t } = useT()
  const file = files[0]
  const opened = useOpenedPdfs(files).get(file)
  const pdfDocument = opened && 'document' in opened ? opened.document : null
  const [language, setLanguage] = useState<OcrLanguage>(locale === 'ar' ? 'ara+eng' : 'eng')
  const [isTextPageSkipped, setIsTextPageSkipped] = useState(true)
  const [progress, setProgress] = useState<{ done: number; total: number; key: MessageKey } | null>(null)
  const [message, setMessage] = useState<{ file: File; key: MessageKey } | null>(null)
  const cards: GridCard[] = pdfDocument ? Array.from({ length: pdfDocument.numPages }, (_, pageIndex) => ({ key: `page-${pageIndex}`, caption: String(pageIndex + 1), document: pdfDocument, pageIndex })) : []

  async function readPages() {
    if (!pdfDocument) return
    setMessage(null)
    setProgress({ done: 0, total: 0, key: 'tools.ocr.loading' })
    const { createWorker, OEM } = await import('tesseract.js')
    // No copy of the language data in IndexedDB (the Privacy page lists what the site stores); the HTTP cache keeps /models/*.
    const worker = await createWorker(language, OEM.LSTM_ONLY, { workerPath: TESSERACT_ROOT.worker, corePath: TESSERACT_ROOT.core, langPath: '/models/tessdata', gzip: false, workerBlobURL: false, cacheMethod: 'none' }).catch(() => null)
    if (!worker) {
      setProgress(null)
      setMessage({ file, key: 'tools.ocr.loadFailed' })
      return
    }
    try {
      const pages: { pageIndex: number; words: LayerWord[] }[] = []
      for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex++) {
        setProgress({ done: pageIndex, total: pdfDocument.numPages, key: 'tools.progress.pages' })
        const page = await pdfDocument.getPage(pageIndex + 1)
        const existingText = (await page.getTextContent()).items.map((item) => ('str' in item ? item.str : '')).join('').trim()
        if (isTextPageSkipped && existingText.length >= TEXT_PAGE_CHARACTERS) continue
        const viewport = page.getViewport({ scale: READING_DPI / POINTS_PER_INCH })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({ canvas, viewport, background: '#ffffff' }).promise
        page.cleanup()
        const { data } = await worker.recognize(canvas, {}, { blocks: true })
        canvas.width = 0
        const pointsPerPixel = POINTS_PER_INCH / READING_DPI
        const words: LayerWord[] = []
        for (const line of (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))) {
          const { baseline } = line
          for (const word of line.words) {
            if (!word.text.trim() || word.confidence < LOWEST_WORD_CONFIDENCE) continue
            // The word sits on its line's baseline, which may slope a little on a scan.
            const baselineY = baseline.x1 === baseline.x0 ? word.bbox.y1 : baseline.y0 + ((baseline.y1 - baseline.y0) * (word.bbox.x0 - baseline.x0)) / (baseline.x1 - baseline.x0)
            words.push({ text: word.text, x: word.bbox.x0 * pointsPerPixel, baselineY: baselineY * pointsPerPixel, width: (word.bbox.x1 - word.bbox.x0) * pointsPerPixel, fontSize: Math.max(word.bbox.y1 - word.bbox.y0, 1) * pointsPerPixel })
          }
        }
        // Words of a line in visual order, left to right, as the text layer writes them.
        words.sort((first, second) => Math.round(first.baselineY / 3) - Math.round(second.baselineY / 3) || first.x - second.x)
        pages.push({ pageIndex, words })
      }
      if (pages.length === 0) {
        setMessage({ file, key: 'tools.ocr.allText' })
        return
      }
      if (pages.every((page) => page.words.length === 0)) {
        setMessage({ file, key: 'tools.ocr.noWords' })
        return
      }
      setProgress({ done: 0, total: 0, key: 'tools.progress.working' })
      const response = await runPdfTask({ type: 'text-layer-pdf', pdf: await file.arrayBuffer(), pages })
      if (response.status !== 'ok' || !response.pdf) {
        setMessage({ file, key: response.status === 'error' ? problemMessageKey(response.reason) : 'tools.ocr.failed' })
        return
      }
      onResult(pdfResultFile(response.pdf, `${baseNameOf(file.name)}-searchable.pdf`))
    } catch {
      setMessage({ file, key: 'tools.ocr.failed' })
    } finally {
      await worker.terminate()
      setProgress(null)
    }
  }

  return (
    <div id="ocr-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.ocr.hint')}</p>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.ocr.language')}
          <select id="ocr-language-select" value={language} onChange={(event) => setLanguage(event.target.value as OcrLanguage)} className={fieldClass}>
            <option value="eng">{t('tools.ocr.english')}</option>
            <option value="ara">{t('tools.ocr.arabic')}</option>
            <option value="ara+eng">{t('tools.ocr.both')}</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="ocr-skip-text-pages-checkbox" type="checkbox" checked={isTextPageSkipped} onChange={(event) => setIsTextPageSkipped(event.target.checked)} className="size-5" />
          {t('tools.ocr.skipTextPages')}
        </label>
        <button id="ocr-pdf-button" type="button" disabled={!pdfDocument || progress !== null} onClick={() => void readPages()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.ocr.button')}
        </button>
      </div>
      {!opened && <p className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      {opened && 'problem' in opened && <p id="pdf-problem" role="alert" className="text-center font-medium text-danger">{t(problemMessageKey(opened.problem))}</p>}
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t(progress.key, { done: progress.done + 1, total: progress.total })} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={message?.file === file ? t(message.key) : ''} />
      <PdfThumbnailGrid id="ocr-pdf-grid" label={t('tools.grid.pagesLabel')} cards={cards} />
    </div>
  )
}
