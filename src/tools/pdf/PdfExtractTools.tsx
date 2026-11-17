// The PDF tools that read a PDF with pdf.js (Apache-2.0): PDF to JPG (pages drawn as pictures), PDF to text, and Extract images
// (the pictures a PDF holds). pdf.js parses in its own worker; pages are drawn one at a time with a progress bar, and the ZIP is
// made in pdfTools.worker.ts (fflate), so the page keeps responding.
import { useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { loadPdfCore } from '../../formats/pdf/pdfLibrary'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, SelectionBar, baseNameOf, describePageNumbers, problemMessageKey, useOpenedPdfs, zipResultFile } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const SMALLEST_IMAGE_PX = 16
const twoDigits = (number: number) => String(number).padStart(2, '0')
// Lets the page draw between two pages of work.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const canvasToBytes = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<ArrayBuffer>((resolve, reject) => canvas.toBlob((blob) => (blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error('picture'))), type, quality))

// The chosen PDF opened, its pages as cards, page progress and an error line.
function useReadPdf(files: File[]) {
  const { t } = useT()
  const file = files[0]
  const opened = useOpenedPdfs(files).get(file)
  const pdfDocument = opened && 'document' in opened ? opened.document : null
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ file: File; key: MessageKey } | null>(null)
  const cards: GridCard[] = pdfDocument ? Array.from({ length: pdfDocument.numPages }, (_, pageIndex) => ({ key: `page-${pageIndex}`, caption: String(pageIndex + 1), document: pdfDocument, pageIndex })) : []
  const status = (
    <>
      {!opened && <p className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      {opened && 'problem' in opened && <p id="pdf-problem" role="alert" className="text-center font-medium text-danger">{t(problemMessageKey(opened.problem))}</p>}
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.pages', { done: progress.done, total: progress.total })} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={message?.file === file ? t(message.key) : ''} />
    </>
  )
  return { file, baseName: baseNameOf(file.name), pdfDocument, cards, progress, setProgress, showMessage: (key: MessageKey) => setMessage({ file, key }), clearMessage: () => setMessage(null), status }
}

async function zipFiles(files: { name: string; bytes: ArrayBuffer }[]) {
  const response = await runPdfTask({ type: 'zip', files })
  if (response.status !== 'ok' || !response.zip) throw new Error('zip')
  return response.zip
}

// ---------------------------------------------------------------- PDF to JPG

type PictureFormat = 'jpg' | 'png'

export function PdfToImages({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useReadPdf(files)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<PictureFormat>('jpg')
  const [quality, setQuality] = useState(85)
  const [dotsPerInch, setDotsPerInch] = useState(150)
  const selectedPageNumbers = [...selectedKeys].map((key) => Number(key.replace('page-', '')) + 1).sort((first, second) => first - second)

  async function makePictures() {
    const pdfDocument = pdf.pdfDocument
    if (!pdfDocument) return
    pdf.clearMessage()
    // With no page selected, every page.
    const pageNumbers = selectedPageNumbers.length ? selectedPageNumbers : Array.from({ length: pdfDocument.numPages }, (_, pageIndex) => pageIndex + 1)
    const pictures: { name: string; bytes: ArrayBuffer }[] = []
    try {
      for (const [position, pageNumber] of pageNumbers.entries()) {
        pdf.setProgress({ done: position, total: pageNumbers.length })
        await nextFrame()
        const page = await pdfDocument.getPage(pageNumber)
        const viewport = page.getViewport({ scale: dotsPerInch / 72 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        // A JPG has no transparency: pages are drawn on white.
        await page.render({ canvas, viewport, background: '#ffffff' }).promise
        pictures.push({ name: `${pdf.baseName}-page-${twoDigits(pageNumber)}.${format}`, bytes: await canvasToBytes(canvas, format === 'jpg' ? 'image/jpeg' : 'image/png', quality / 100) })
        canvas.width = 0
        page.cleanup()
      }
      pdf.setProgress({ done: pageNumbers.length, total: pageNumbers.length })
      if (pictures.length === 1) onResult(new File([pictures[0].bytes], pictures[0].name, { type: format === 'jpg' ? 'image/jpeg' : 'image/png' }))
      else onResult(zipResultFile(await zipFiles(pictures), `${pdf.baseName}-${format === 'jpg' ? 'jpg' : 'png'}-pages.zip`))
    } catch {
      pdf.showMessage('tools.toImages.failed')
    } finally {
      pdf.setProgress(null)
    }
  }

  return (
    <div id="pdf-to-jpg-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.toImages.hint')}</p>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.toImages.format')}
          <select id="pdf-to-jpg-format-select" value={format} onChange={(event) => setFormat(event.target.value as PictureFormat)} className={fieldClass}>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.toImages.resolution')}
          <select id="pdf-to-jpg-resolution-select" value={dotsPerInch} onChange={(event) => setDotsPerInch(Number(event.target.value))} className={fieldClass}>
            <option value={72}>{t('tools.toImages.dpi72')}</option>
            <option value={150}>{t('tools.toImages.dpi150')}</option>
            <option value={300}>{t('tools.toImages.dpi300')}</option>
          </select>
        </label>
        {format === 'jpg' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.toImages.quality', { quality })}
            <input id="pdf-to-jpg-quality-input" type="range" min={60} max={100} step={5} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="min-h-11 w-44" />
          </label>
        )}
        <button id="pdf-to-jpg-button" type="button" disabled={!pdf.pdfDocument || pdf.progress !== null} onClick={() => void makePictures()} className="btn btn--primary press">
          {pdf.progress ? t('tools.working') : t('tools.toImages.button')}
        </button>
      </div>
      <SelectionBar idPrefix="pdf-to-jpg" total={pdf.cards.length} selectedCount={selectedPageNumbers.length} onSelectAll={() => setSelectedKeys(new Set(pdf.cards.map((card) => card.key)))} onSelectNone={() => setSelectedKeys(new Set())} />
      <p id="pdf-to-jpg-scope" aria-live="polite" className="text-center text-sm text-ink-soft">
        {selectedPageNumbers.length ? t('tools.toImages.selectedPages', { pages: describePageNumbers(selectedPageNumbers) }) : t('tools.toImages.allPages')}
      </p>
      {pdf.status}
      <PdfThumbnailGrid id="pdf-to-jpg-grid" label={t('tools.grid.pagesLabel')} cards={pdf.cards} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}

// ---------------------------------------------------------------- PDF to text

export function PdfToText({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useReadPdf(files)
  const [isPageMarked, setIsPageMarked] = useState(true)

  async function extractText() {
    const pdfDocument = pdf.pdfDocument
    if (!pdfDocument) return
    pdf.clearMessage()
    const pageTexts: string[] = []
    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        pdf.setProgress({ done: pageNumber - 1, total: pdfDocument.numPages })
        if (pageNumber % 10 === 1) await nextFrame()
        const page = await pdfDocument.getPage(pageNumber)
        const content = await page.getTextContent()
        // pdf.js marks the end of each line; Arabic lines arrive in reading order (pdfTextOrder.ts).
        const text = content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join('').replace(/[ \t]+\n/g, '\n').trim()
        pageTexts.push(isPageMarked ? `${t('tools.text.pageHeading', { number: pageNumber })}\n\n${text}` : text)
        page.cleanup()
      }
      if (pageTexts.every((text) => text.replace(/^.*\n\n/, '').trim() === '')) {
        pdf.showMessage('tools.text.noText')
        return
      }
      onResult(new File([`${pageTexts.join('\n\n')}\n`], `${pdf.baseName}.txt`, { type: 'text/plain;charset=utf-8' }))
    } catch {
      pdf.showMessage('tools.text.failed')
    } finally {
      pdf.setProgress(null)
    }
  }

  return (
    <div id="pdf-to-text-tool" className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="pdf-to-text-page-headings-checkbox" type="checkbox" checked={isPageMarked} onChange={(event) => setIsPageMarked(event.target.checked)} className="size-5" />
          {t('tools.text.markPages')}
        </label>
        <button id="pdf-to-text-button" type="button" disabled={!pdf.pdfDocument || pdf.progress !== null} onClick={() => void extractText()} className="btn btn--primary press">
          {pdf.progress ? t('tools.working') : t('tools.text.button')}
        </button>
      </div>
      {pdf.status}
      <PdfThumbnailGrid id="pdf-to-text-grid" label={t('tools.grid.pagesLabel')} cards={pdf.cards} />
    </div>
  )
}

// ---------------------------------------------------------------- Extract images

// An image as pdf.js decodes it: a ready bitmap, or raw pixels in one of three layouts.
type DecodedImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8Array | Uint8ClampedArray; kind?: number }
const IMAGE_KIND = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 }

function decodedImageToCanvas(image: DecodedImage) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')!
  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0)
    return canvas
  }
  if (!image.data) return null
  const pixels = new Uint8ClampedArray(image.width * image.height * 4)
  if (image.kind === IMAGE_KIND.RGBA_32BPP) pixels.set(image.data.subarray(0, pixels.length))
  else if (image.kind === IMAGE_KIND.RGB_24BPP) {
    for (let source = 0, target = 0; target < pixels.length; source += 3, target += 4) {
      pixels[target] = image.data[source]
      pixels[target + 1] = image.data[source + 1]
      pixels[target + 2] = image.data[source + 2]
      pixels[target + 3] = 255
    }
  } else if (image.kind === IMAGE_KIND.GRAYSCALE_1BPP) {
    // One bit per pixel, rows padded to whole bytes; a set bit is white.
    const bytesPerRow = Math.ceil(image.width / 8)
    for (let row = 0; row < image.height; row++) {
      for (let column = 0; column < image.width; column++) {
        const isWhite = (image.data[row * bytesPerRow + (column >> 3)] >> (7 - (column & 7))) & 1
        const target = (row * image.width + column) * 4
        pixels[target] = pixels[target + 1] = pixels[target + 2] = isWhite ? 255 : 0
        pixels[target + 3] = 255
      }
    }
  } else return null
  context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0)
  return canvas
}

export function ExtractPdfImages({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useReadPdf(files)

  async function extractImages() {
    const pdfDocument = pdf.pdfDocument
    if (!pdfDocument) return
    pdf.clearMessage()
    const pdfjs = await loadPdfCore()
    const imageOperations = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintImageXObjectRepeat])
    const pictures: { name: string; bytes: ArrayBuffer }[] = []
    // An image drawn on several pages (a logo) is kept once.
    const seenImageIds = new Set<string>()
    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        pdf.setProgress({ done: pageNumber - 1, total: pdfDocument.numPages })
        await nextFrame()
        const page = await pdfDocument.getPage(pageNumber)
        const operatorList = await page.getOperatorList()
        let imageNumberOnPage = 0
        for (const [operationIndex, operation] of operatorList.fnArray.entries()) {
          const objectId = imageOperations.has(operation) ? (operatorList.argsArray[operationIndex][0] as string) : null
          const inlineImage = operation === pdfjs.OPS.paintInlineImageXObject ? (operatorList.argsArray[operationIndex][0] as DecodedImage) : null
          if (objectId && seenImageIds.has(objectId)) continue
          if (objectId) seenImageIds.add(objectId)
          const image: DecodedImage | null = objectId ? await new Promise((resolve) => (objectId.startsWith('g_') ? page.commonObjs : page.objs).get(objectId, resolve)) : inlineImage
          if (!image || image.width < SMALLEST_IMAGE_PX || image.height < SMALLEST_IMAGE_PX) continue
          const canvas = decodedImageToCanvas(image)
          if (!canvas) continue
          imageNumberOnPage++
          pictures.push({ name: `${pdf.baseName}-page-${twoDigits(pageNumber)}-image-${imageNumberOnPage}.png`, bytes: await canvasToBytes(canvas, 'image/png') })
        }
        page.cleanup()
      }
      if (pictures.length === 0) {
        pdf.showMessage('tools.extractImages.none')
        return
      }
      onResult(zipResultFile(await zipFiles(pictures), `${pdf.baseName}-embedded-images.zip`))
    } catch {
      pdf.showMessage('tools.extractImages.failed')
    } finally {
      pdf.setProgress(null)
    }
  }

  return (
    <div id="extract-pdf-images-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.extractImages.hint')}</p>
      <div className="flex justify-center">
        <button id="extract-pdf-images-button" type="button" disabled={!pdf.pdfDocument || pdf.progress !== null} onClick={() => void extractImages()} className="btn btn--primary press">
          {pdf.progress ? t('tools.working') : t('tools.extractImages.button')}
        </button>
      </div>
      {pdf.status}
      <PdfThumbnailGrid id="extract-pdf-images-grid" label={t('tools.grid.pagesLabel')} cards={pdf.cards} />
    </div>
  )
}
