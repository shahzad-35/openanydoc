// The one-PDF page tools: Split PDF, Remove pages, Extract pages and Rotate PDF. Each shows the PDF's pages as thumbnails; the
// work runs in pdfTools.worker.ts.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { OutputDocument, OutputPage } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, SelectionBar, baseNameOf, describePageNumbers, parsePageRanges, pdfResultFile, problemMessageKey, useOpenedPdfs, zipResultFile } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const pageKey = (pageIndex: number) => `page-${pageIndex}`
// One output PDF, or several (zipped).
type BuildRequest = { type: 'build-pdf'; pages: OutputPage[] } | { type: 'build-pdfs'; documents: OutputDocument[] }

// The chosen PDF opened, its pages as cards, and running a task on it with progress and an error line.
function useOnePdf({ files, onResult }: Pick<ToolProps, 'files' | 'onResult'>) {
  const { t } = useT()
  const file = files[0]
  const opened = useOpenedPdfs(files).get(file)
  const pageCount = opened && 'document' in opened ? opened.document.numPages : 0
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<{ file: File; message: string } | null>(null)

  function pageCards(rotationOf: (pageIndex: number) => number = () => 0, isMarked: (pageIndex: number) => boolean = () => false): GridCard[] {
    if (!opened || !('document' in opened)) return []
    return Array.from({ length: pageCount }, (_, pageIndex) => ({ key: pageKey(pageIndex), caption: String(pageIndex + 1), document: opened.document, pageIndex, rotation: rotationOf(pageIndex), isMarked: isMarked(pageIndex) }))
  }

  async function run(request: BuildRequest, resultName: string) {
    setError(null)
    setProgress({ done: 0, total: request.type === 'build-pdfs' ? request.documents.length : 0 })
    const sources = [await file.arrayBuffer()]
    const response = await runPdfTask({ ...request, sources }, (done, total) => setProgress({ done, total })).catch(() => null)
    setProgress(null)
    if (response?.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${resultName}.pdf`))
    else if (response?.status === 'ok' && response.zip) onResult(zipResultFile(response.zip, `${resultName}.zip`))
    else setError({ file, message: t(response?.status === 'error' ? problemMessageKey(response.reason) : 'tools.pdf.unreadable') })
  }

  const status: ReactNode = (
    <>
      {!opened && <p className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      {opened && 'problem' in opened && <p id="pdf-problem" role="alert" className="text-center font-medium text-danger">{t(problemMessageKey(opened.problem))}</p>}
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.files', { done: progress.done, total: progress.total }) : t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error?.file === file ? error.message : ''} />
    </>
  )
  return { file, baseName: baseNameOf(file.name), pageCount, pageCards, run, isWorking: progress !== null, status }
}

// ---------------------------------------------------------------- Split PDF

type SplitMode = 'ranges' | 'every' | 'each'

export function SplitPdf({ files, onResult }: ToolProps) {
  const { t, tp } = useT()
  const pdf = useOnePdf({ files, onResult })
  const [mode, setMode] = useState<SplitMode>('ranges')
  const [rangesText, setRangesText] = useState('')
  const [pagesPerFile, setPagesPerFile] = useState(1)

  const groups: number[][] | null =
    mode === 'ranges'
      ? parsePageRanges(rangesText, pdf.pageCount)
      : Array.from({ length: Math.ceil(pdf.pageCount / (mode === 'each' ? 1 : Math.max(1, pagesPerFile))) }, (_, groupIndex) => {
          const size = mode === 'each' ? 1 : Math.max(1, pagesPerFile)
          return Array.from({ length: Math.min(size, pdf.pageCount - groupIndex * size) }, (_, offset) => groupIndex * size + offset + 1)
        })
  const isRangesTextWrong = mode === 'ranges' && rangesText.trim() !== '' && groups === null

  function split() {
    if (!groups?.length) return
    const documents: OutputDocument[] = groups.map((pageNumbers) => ({ name: `${pdf.baseName}-pages-${describePageNumbers(pageNumbers)}.pdf`, pages: pageNumbers.map((pageNumber) => ({ sourceIndex: 0, pageIndex: pageNumber - 1, rotation: 0 })) }))
    if (documents.length === 1) void pdf.run({ type: 'build-pdf', pages: documents[0].pages }, documents[0].name.replace(/\.pdf$/, ''))
    else void pdf.run({ type: 'build-pdfs', documents }, `${pdf.baseName}-split`)
  }

  const modes: [SplitMode, MessageKey][] = [['ranges', 'tools.split.byRanges'], ['every', 'tools.split.everyN'], ['each', 'tools.split.eachPage']]
  return (
    <div id="split-pdf-tool" className="space-y-4">
      <fieldset className="mx-auto flex max-w-[640px] flex-wrap justify-center gap-x-5 gap-y-2">
        <legend className="sr-only">{t('tools.split.modeLabel')}</legend>
        {modes.map(([value, labelKey]) => (
          <label key={value} className="flex min-h-11 items-center gap-2 font-medium">
            <input id={`split-mode-${value}-radio`} type="radio" name="split-mode" checked={mode === value} onChange={() => setMode(value)} className="size-5" />
            {t(labelKey)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        {mode === 'ranges' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.split.rangesLabel')}
            <input id="split-ranges-input" type="text" inputMode="numeric" dir="ltr" placeholder="1-3, 5, 8-10" value={rangesText} onChange={(event) => setRangesText(event.target.value)} aria-invalid={isRangesTextWrong} className={`${fieldClass} w-64`} />
          </label>
        )}
        {mode === 'every' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.split.pagesPerFile')}
            <input id="split-every-input" type="number" min={1} max={Math.max(1, pdf.pageCount)} dir="ltr" value={pagesPerFile} onChange={(event) => setPagesPerFile(Number(event.target.value) || 1)} className={`${fieldClass} w-28`} />
          </label>
        )}
        <button id="split-pdf-button" type="button" disabled={!groups?.length || pdf.isWorking || pdf.pageCount === 0} onClick={split} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.split.button')}
        </button>
      </div>
      <p id="split-pdf-summary" aria-live="polite" className={`text-center text-sm ${isRangesTextWrong ? 'font-medium text-danger' : 'text-ink-soft'}`}>
        {isRangesTextWrong ? t('tools.split.rangesWrong', { count: pdf.pageCount }) : groups?.length ? tp('tools.split.willMake', groups.length) : mode === 'ranges' ? t('tools.split.rangesHint') : ''}
      </p>
      {pdf.status}
      <PdfThumbnailGrid id="split-pdf-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards()} />
    </div>
  )
}

// ---------------------------------------------------------------- Remove pages, Extract pages, Rotate PDF (pages chosen by clicking)

function usePageSelection() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const selectedPageNumbers = [...selectedKeys].map((key) => Number(key.replace('page-', '')) + 1).sort((first, second) => first - second)
  return { selectedKeys, setSelectedKeys, selectedPageNumbers }
}

export function RemovePdfPages({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { selectedKeys, setSelectedKeys, selectedPageNumbers } = usePageSelection()
  const isEveryPageChosen = pdf.pageCount > 0 && selectedPageNumbers.length === pdf.pageCount

  function removePages() {
    const keptPages: OutputPage[] = Array.from({ length: pdf.pageCount }, (_, pageIndex) => pageIndex).filter((pageIndex) => !selectedKeys.has(pageKey(pageIndex))).map((pageIndex) => ({ sourceIndex: 0, pageIndex, rotation: 0 }))
    void pdf.run({ type: 'build-pdf', pages: keptPages }, `${pdf.baseName}-without-pages-${describePageNumbers(selectedPageNumbers)}`)
  }

  return (
    <div id="remove-pdf-pages-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.remove.hint')}</p>
      <SelectionBar idPrefix="remove-pages" total={pdf.pageCount} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.pageCards().map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <div className="flex justify-center">
        <button id="remove-pages-button" type="button" disabled={selectedPageNumbers.length === 0 || isEveryPageChosen || pdf.isWorking} onClick={removePages} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.remove.button')}
        </button>
      </div>
      {isEveryPageChosen && <p id="remove-pages-all" role="alert" className="text-center text-sm font-medium text-danger">{t('tools.remove.notAll')}</p>}
      {pdf.status}
      <PdfThumbnailGrid id="remove-pages-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards(undefined, (pageIndex) => selectedKeys.has(pageKey(pageIndex)))} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}

export function ExtractPdfPages({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { selectedKeys, setSelectedKeys, selectedPageNumbers } = usePageSelection()
  const [isOnePdfPerPage, setIsOnePdfPerPage] = useState(false)

  function extractPages() {
    const pageOf = (pageNumber: number): OutputPage => ({ sourceIndex: 0, pageIndex: pageNumber - 1, rotation: 0 })
    if (isOnePdfPerPage && selectedPageNumbers.length > 1) {
      void pdf.run({ type: 'build-pdfs', documents: selectedPageNumbers.map((pageNumber) => ({ name: `${pdf.baseName}-page-${pageNumber}.pdf`, pages: [pageOf(pageNumber)] })) }, `${pdf.baseName}-pages`)
    } else void pdf.run({ type: 'build-pdf', pages: selectedPageNumbers.map(pageOf) }, `${pdf.baseName}-pages-${describePageNumbers(selectedPageNumbers)}`)
  }

  return (
    <div id="extract-pdf-pages-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.extract.hint')}</p>
      <SelectionBar idPrefix="extract-pages" total={pdf.pageCount} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.pageCards().map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="extract-one-per-page-checkbox" type="checkbox" checked={isOnePdfPerPage} onChange={(event) => setIsOnePdfPerPage(event.target.checked)} className="size-5" />
          {t('tools.extract.onePerPage')}
        </label>
        <button id="extract-pages-button" type="button" disabled={selectedPageNumbers.length === 0 || pdf.isWorking} onClick={extractPages} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.extract.button')}
        </button>
      </div>
      {pdf.status}
      <PdfThumbnailGrid id="extract-pages-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards()} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}

export function RotatePdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useOnePdf({ files, onResult })
  const { selectedKeys, setSelectedKeys, selectedPageNumbers } = usePageSelection()
  const [rotationByPage, setRotationByPage] = useState(new Map<number, number>())
  const rotationOf = (pageIndex: number) => rotationByPage.get(pageIndex) ?? 0
  const hasTurnedPage = [...rotationByPage.values()].some((rotation) => rotation % 360 !== 0)

  // With no page selected, every page turns.
  function turnPages(degrees: number) {
    const pageIndexes = selectedPageNumbers.length ? selectedPageNumbers.map((pageNumber) => pageNumber - 1) : Array.from({ length: pdf.pageCount }, (_, pageIndex) => pageIndex)
    setRotationByPage((previous) => {
      const next = new Map(previous)
      for (const pageIndex of pageIndexes) next.set(pageIndex, (((next.get(pageIndex) ?? 0) + degrees) % 360 + 360) % 360)
      return next
    })
  }

  function savePdf() {
    const pages: OutputPage[] = Array.from({ length: pdf.pageCount }, (_, pageIndex) => ({ sourceIndex: 0, pageIndex, rotation: rotationOf(pageIndex) }))
    void pdf.run({ type: 'build-pdf', pages }, `${pdf.baseName}-rotated`)
  }

  return (
    <div id="rotate-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.rotate.hint')}</p>
      <SelectionBar idPrefix="rotate-pages" total={pdf.pageCount} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.pageCards().map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="rotate-left-button" type="button" disabled={pdf.pageCount === 0} onClick={() => turnPages(-90)} className="btn btn--quiet press">
          {t('tools.rotate.left')}
        </button>
        <button id="rotate-right-button" type="button" disabled={pdf.pageCount === 0} onClick={() => turnPages(90)} className="btn btn--quiet press">
          {t('tools.rotate.right')}
        </button>
        <button id="rotate-half-button" type="button" disabled={pdf.pageCount === 0} onClick={() => turnPages(180)} className="btn btn--quiet press">
          {t('tools.rotate.half')}
        </button>
        <button id="rotate-pdf-button" type="button" disabled={!hasTurnedPage || pdf.isWorking} onClick={savePdf} className="btn btn--primary press">
          {pdf.isWorking ? t('tools.working') : t('tools.rotate.button')}
        </button>
      </div>
      <p id="rotate-pdf-scope" aria-live="polite" className="text-center text-sm text-ink-soft">
        {selectedPageNumbers.length ? t('tools.rotate.selectedPages', { pages: describePageNumbers(selectedPageNumbers) }) : t('tools.rotate.allPages')}
      </p>
      {pdf.status}
      <PdfThumbnailGrid id="rotate-pages-grid" label={t('tools.grid.pagesLabel')} cards={pdf.pageCards(rotationOf)} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}
