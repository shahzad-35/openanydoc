/* oxlint-disable react/only-export-components */
// The PDF tools that read a PDF with pdf.js (Apache-2.0): PDF to JPG (pages drawn as pictures), PDF to grayscale, PDF to text, PDF to Markdown,
// Extract images (the pictures a PDF holds) and Compare PDF (two versions, line by line and picture by picture). pdf.js parses in
// its own worker; pages are drawn one at a time with a progress bar, and the ZIP is made in pdfTools.worker.ts (fflate), so the
// page keeps responding.
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { loadPdfCore, openPdfForReading } from '../../formats/pdf/pdfLibrary'
import TextResultPanel from '../ai/TextResultPanel'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import { PdfFileList, PdfThumbnailGrid, ProgressBar, SelectionBar, baseNameOf, describePageNumbers, drawPagePicture, pdfResultFile, problemMessageKey, useOpenedPdfs, zipResultFile } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const SMALLEST_IMAGE_PX = 16
const twoDigits = (number: number) => String(number).padStart(2, '0')
// Lets the page draw between two pages of work.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

export const canvasToBytes = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
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

// ---------------------------------------------------------------- PDF to grayscale (beta)

// Every page drawn grey as a picture (drawPagePicture) and put together in pdfTools.worker.ts (`picture-pages`) with an invisible
// text layer, so the text can still be selected and searched.
export function PdfToGrayscale({ files, onResult }: ToolProps) {
  const { t } = useT()
  const pdf = useReadPdf(files)

  async function makeGrayscale() {
    const pdfDocument = pdf.pdfDocument
    if (!pdfDocument) return
    pdf.clearMessage()
    const pageCount = pdfDocument.numPages
    const pictures = []
    try {
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        pdf.setProgress({ done: pageIndex, total: pageCount })
        await nextFrame()
        pictures.push(await drawPagePicture(pdfDocument, pageIndex, { isGrayscale: true }))
      }
      pdf.setProgress({ done: pageCount, total: pageCount })
      const response = await runPdfTask({ type: 'picture-pages', pdf: null, pageCount, pictures })
      if (response.status !== 'ok' || !response.pdf) throw new Error('The grey copy could not be made')
      onResult(pdfResultFile(response.pdf, `${pdf.baseName}-grayscale.pdf`))
    } catch {
      pdf.showMessage('tools.pdfGrayscale.failed')
    } finally {
      pdf.setProgress(null)
    }
  }

  return (
    <div id="pdf-to-grayscale-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.pdfGrayscale.hint')}</p>
      <p id="pdf-to-grayscale-note" className="text-center text-sm text-ink-soft">{t('tools.pdfGrayscale.note')}</p>
      <div className="flex justify-center">
        <button id="pdf-to-grayscale-button" type="button" disabled={!pdf.pdfDocument || pdf.progress !== null} onClick={() => void makeGrayscale()} className="btn btn--primary press">
          {pdf.progress ? t('tools.working') : t('tools.pdfGrayscale.button')}
        </button>
      </div>
      {pdf.status}
      <PdfThumbnailGrid id="pdf-to-grayscale-grid" label={t('tools.grid.pagesLabel')} cards={pdf.cards} />
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
export type DecodedImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8Array | Uint8ClampedArray; kind?: number }
const IMAGE_KIND = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 }

export function decodedImageToCanvas(image: DecodedImage) {
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

// ---------------------------------------------------------------- the lines of a page (PDF to Markdown, Compare PDF)

// A line of a page as pdf.js reads it: its text, its largest font size, its baseline (PDF units, from the bottom), and its cells:
// the line cut where two pieces of text are further apart than 1.2 text heights (as pdfTextOrder.ts splits a table row).
type TextLine = { text: string; fontSize: number; baselineY: number; cells: string[] }
const CELL_GAP_HEIGHTS = 1.2

async function readPageLines(page: PDFPageProxy) {
  const content = await page.getTextContent()
  const lines: TextLine[] = []
  let current: TextLine | null = null
  let previousBox: { start: number; end: number } | null = null
  for (const item of content.items) {
    if (!('str' in item)) continue
    current ??= { text: '', fontSize: 0, baselineY: item.transform[5], cells: [''] }
    const textHeight = Math.hypot(item.transform[2], item.transform[3])
    const box = { start: item.transform[4], end: item.transform[4] + item.width }
    // The gap to the previous piece, whichever way the line runs (Arabic lines run right to left).
    const gap = previousBox ? Math.max(box.start - previousBox.end, previousBox.start - box.end) : 0
    if (item.str.trim() && previousBox && gap > CELL_GAP_HEIGHTS * (textHeight || current.fontSize)) current.cells.push('')
    current.text += item.str
    current.cells[current.cells.length - 1] += item.str
    if (item.str.trim()) {
      current.fontSize = Math.max(current.fontSize, textHeight)
      previousBox = box
    }
    if (item.hasEOL) {
      lines.push(current)
      current = null
      previousBox = null
    }
  }
  if (current) lines.push(current)
  return lines
    .map((line) => ({ ...line, text: line.text.trimEnd(), cells: line.cells.map((cell) => cell.trim()).filter((cell) => cell !== '') }))
    .filter((line) => line.text.trim() !== '')
}

// ---------------------------------------------------------------- PDF to Markdown

const BULLET_START = /^\s*[•●▪◦‣*–-]\s+/
const NUMBER_START = /^\s*(\d+)[.)]\s+/
// A heading is at least this much larger than the body text, and short.
const HEADING_SIZE_RATIO = 1.2
const LONGEST_HEADING = 120
// A gap between two lines larger than this many line heights starts a new paragraph.
const PARAGRAPH_GAP_LINES = 1.6
// A table: at least this many lines in a row, each cut into the same number (2 or more) of cells.
const SHORTEST_TABLE_LINES = 3
const roundedSize = (fontSize: number) => Math.round(fontSize * 2) / 2

type DocumentBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; number: string; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'table'; rows: string[][] }

// The lines from `start` that form a table (same cell count, 2 or more, for at least three lines), or 0.
function countTableLines(lines: TextLine[], start: number) {
  const cellCount = lines[start].cells.length
  if (cellCount < 2) return 0
  let end = start
  while (end < lines.length && lines[end].cells.length === cellCount) end++
  return end - start >= SHORTEST_TABLE_LINES ? end - start : 0
}

// Headings come from font sizes (the three largest sizes above the body text become levels 1 to 3), lists from bullets and
// numbers at the start of a line, tables from lines cut into the same columns, paragraphs from the gaps between lines.
function linesToBlocks(pages: TextLine[][]): DocumentBlock[] {
  const characterCountBySize = new Map<number, number>()
  for (const line of pages.flat()) characterCountBySize.set(roundedSize(line.fontSize), (characterCountBySize.get(roundedSize(line.fontSize)) ?? 0) + line.text.length)
  const bodySize = [...characterCountBySize].sort((first, second) => second[1] - first[1])[0]?.[0] ?? 0
  const headingSizes = [...characterCountBySize.keys()].filter((size) => size >= bodySize * HEADING_SIZE_RATIO).sort((first, second) => second - first)
  const blocks: DocumentBlock[] = []
  for (const lines of pages) {
    let paragraph: string[] = []
    const endParagraph = () => {
      if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      const text = line.text.trim()
      const headingLevel = headingSizes.indexOf(roundedSize(line.fontSize)) + 1
      const previous = lines[index - 1]
      if (previous && previous.baselineY - line.baselineY > PARAGRAPH_GAP_LINES * previous.fontSize * 1.2) endParagraph()
      const tableLineCount = countTableLines(lines, index)
      if (tableLineCount > 0) {
        endParagraph()
        blocks.push({ kind: 'table', rows: lines.slice(index, index + tableLineCount).map((tableLine) => tableLine.cells) })
        index += tableLineCount - 1
      } else if (headingLevel > 0 && text.length <= LONGEST_HEADING) {
        endParagraph()
        blocks.push({ kind: 'heading', level: Math.min(headingLevel, 3), text })
      } else if (BULLET_START.test(text)) {
        endParagraph()
        blocks.push({ kind: 'bullet', text: text.replace(BULLET_START, '') })
      } else if (NUMBER_START.test(text)) {
        endParagraph()
        blocks.push({ kind: 'numbered', number: NUMBER_START.exec(text)?.[1] ?? '1', text: text.replace(NUMBER_START, '') })
      } else paragraph.push(text)
    }
    endParagraph()
  }
  return blocks
}

const isListBlock = (block: DocumentBlock | undefined) => block?.kind === 'bullet' || block?.kind === 'numbered'

// List items stay together; everything else is separated by a blank line.
function joinBlocks(blocks: DocumentBlock[], writeBlock: (block: DocumentBlock) => string) {
  return blocks.reduce((written, block, index) => written + (index === 0 ? '' : isListBlock(block) && isListBlock(blocks[index - 1]) ? '\n' : '\n\n') + writeBlock(block), '') + '\n'
}

function blocksToMarkdown(blocks: DocumentBlock[]) {
  const escapeLineStart = (text: string) => (/^[#>+|]/.test(text) ? `\\${text}` : text)
  const tableCell = (text: string) => text.replace(/\|/g, '\\|')
  return joinBlocks(blocks, (block) => {
    if (block.kind === 'heading') return `${'#'.repeat(block.level)} ${block.text}`
    if (block.kind === 'bullet') return `- ${block.text}`
    if (block.kind === 'numbered') return `${block.number}. ${block.text}`
    if (block.kind === 'paragraph') return escapeLineStart(block.text)
    const [header, ...rows] = block.rows
    return [`| ${header.map(tableCell).join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(tableCell).join(' | ')} |`)].join('\n')
  })
}

function blocksToText(blocks: DocumentBlock[]) {
  return joinBlocks(blocks, (block) => {
    if (block.kind === 'bullet') return `• ${block.text}`
    if (block.kind === 'numbered') return `${block.number}. ${block.text}`
    if (block.kind === 'table') return block.rows.map((row) => row.join('\t')).join('\n')
    return block.text
  })
}

// A whole HTML page; lists become <ul>/<ol>, and every block follows its own text direction (dir="auto").
function blocksToHtml(blocks: DocumentBlock[], title: string) {
  const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parts: string[] = []
  blocks.forEach((block, index) => {
    const previous = blocks[index - 1]
    const next = blocks[index + 1]
    if (block.kind === 'bullet' || block.kind === 'numbered') {
      const listTag = block.kind === 'bullet' ? 'ul' : 'ol'
      if (previous?.kind !== block.kind) parts.push(`<${listTag} dir="auto">`)
      parts.push(`<li>${escapeHtml(block.text)}</li>`)
      if (next?.kind !== block.kind) parts.push(`</${listTag}>`)
    } else if (block.kind === 'heading') parts.push(`<h${block.level} dir="auto">${escapeHtml(block.text)}</h${block.level}>`)
    else if (block.kind === 'paragraph') parts.push(`<p dir="auto">${escapeHtml(block.text)}</p>`)
    else {
      const [header, ...rows] = block.rows
      parts.push(`<table>\n<thead><tr>${header.map((cell) => `<th dir="auto">${escapeHtml(cell)}</th>`).join('')}</tr></thead>\n<tbody>\n${rows.map((row) => `<tr>${row.map((cell) => `<td dir="auto">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n')}\n</tbody>\n</table>`)
    }
  })
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n${parts.join('\n')}\n</body>\n</html>\n`
}

// Every page's lines, read one page at a time (a frame every ten pages so the progress bar moves).
async function readDocumentLines(pdfDocument: PDFDocumentProxy, onProgress?: (done: number, total: number) => void) {
  const pages: TextLine[][] = []
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    onProgress?.(pageNumber - 1, pdfDocument.numPages)
    if (pageNumber % 10 === 1) await nextFrame()
    const page = await pdfDocument.getPage(pageNumber)
    pages.push(await readPageLines(page))
    page.cleanup()
  }
  return pages
}

// A PDF's text as Markdown, for the token counter (src/tools/ai/AiReadyTools.tsx); empty when the PDF has no text (a scan).
export async function readPdfAsMarkdown(fileContents: ArrayBuffer) {
  const pdfDocument = await openPdfForReading(fileContents)
  return blocksToMarkdown(linesToBlocks(await readDocumentLines(pdfDocument))).trim()
}

export function PdfToMarkdown({ files }: ToolProps) {
  const { t } = useT()
  const pdf = useReadPdf(files)
  const [outputs, setOutputs] = useState<{ markdown: string; text: string; html: string } | null>(null)

  async function makeMarkdown() {
    const pdfDocument = pdf.pdfDocument
    if (!pdfDocument) return
    pdf.clearMessage()
    try {
      const pages = await readDocumentLines(pdfDocument, (done, total) => pdf.setProgress({ done, total }))
      if (pages.every((lines) => lines.length === 0)) {
        pdf.showMessage('tools.text.noText')
        return
      }
      const blocks = linesToBlocks(pages)
      setOutputs({ markdown: blocksToMarkdown(blocks), text: blocksToText(blocks), html: blocksToHtml(blocks, pdf.baseName) })
    } catch {
      pdf.showMessage('tools.text.failed')
    } finally {
      pdf.setProgress(null)
    }
  }

  return (
    <div id="pdf-to-markdown-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.markdown.hint')}</p>
      <div className="flex justify-center">
        <button id="pdf-to-markdown-button" type="button" disabled={!pdf.pdfDocument || pdf.progress !== null} onClick={() => void makeMarkdown()} className="btn btn--primary press">
          {pdf.progress ? t('tools.working') : t('tools.markdown.button')}
        </button>
      </div>
      {pdf.status}
      {outputs && (
        <TextResultPanel
          id="pdf-markdown-result"
          label={t('aiReady.markdownResult')}
          text={outputs.markdown}
          downloads={[
            { id: 'md', label: '.md', fileName: `${pdf.baseName}.md`, text: outputs.markdown, mimeType: 'text/markdown;charset=utf-8' },
            { id: 'txt', label: '.txt', fileName: `${pdf.baseName}.txt`, text: outputs.text, mimeType: 'text/plain;charset=utf-8' },
            { id: 'html', label: '.html', fileName: `${pdf.baseName}.html`, text: outputs.html, mimeType: 'text/html;charset=utf-8' },
          ]}
        />
      )}
      <PdfThumbnailGrid id="pdf-to-markdown-grid" label={t('tools.grid.pagesLabel')} cards={pdf.cards} />
    </div>
  )
}

// ---------------------------------------------------------------- Compare PDF

type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string }
type PageDifferences = { pageNumber: number; lines: DiffLine[] }
// Past this many line pairs on one page, the page is shown as all removed and all added instead of matched line by line.
const LARGEST_LINE_COMPARISON = 1_000_000

// The lines of two versions of a page matched with the longest common subsequence: kept, removed and added lines in order.
function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  if (oldLines.length * newLines.length > LARGEST_LINE_COMPARISON) return [...oldLines.map((text) => ({ kind: 'removed' as const, text })), ...newLines.map((text) => ({ kind: 'added' as const, text }))]
  const commonAfter = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1))
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      commonAfter[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex] ? commonAfter[oldIndex + 1][newIndex + 1] + 1 : Math.max(commonAfter[oldIndex + 1][newIndex], commonAfter[oldIndex][newIndex + 1])
    }
  }
  const lines: DiffLine[] = []
  let [oldIndex, newIndex] = [0, 0]
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      lines.push({ kind: 'same', text: oldLines[oldIndex++] })
      newIndex++
    } else if (newIndex < newLines.length && (oldIndex === oldLines.length || commonAfter[oldIndex][newIndex + 1] >= commonAfter[oldIndex + 1][newIndex])) lines.push({ kind: 'added', text: newLines[newIndex++] })
    else lines.push({ kind: 'removed', text: oldLines[oldIndex++] })
  }
  return lines
}

// The two versions of one page drawn side by side at the same width, with every block of pixels that differs painted red on both.
function VisualPageDifference({ oldDocument, newDocument, pageIndex }: { oldDocument: PDFDocumentProxy; newDocument: PDFDocumentProxy; pageIndex: number }) {
  const { t } = useT()
  const oldCanvasRef = useRef<HTMLCanvasElement>(null)
  const newCanvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let isCurrent = true
    const drawPage = async (document: PDFDocumentProxy) => {
      const canvas = window.document.createElement('canvas')
      if (pageIndex >= document.numPages) return canvas
      const page = await document.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: COMPARE_WIDTH_PX / page.getViewport({ scale: 1 }).width })
      canvas.width = COMPARE_WIDTH_PX
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport, background: '#ffffff' }).promise
      return canvas
    }
    void Promise.all([drawPage(oldDocument), drawPage(newDocument)]).then(([oldDrawing, newDrawing]) => {
      const oldCanvas = oldCanvasRef.current
      const newCanvas = newCanvasRef.current
      if (!isCurrent || !oldCanvas || !newCanvas) return
      for (const [canvas, drawing] of [[oldCanvas, oldDrawing], [newCanvas, newDrawing]] as const) {
        canvas.width = drawing.width || COMPARE_WIDTH_PX
        canvas.height = drawing.height || Math.round(COMPARE_WIDTH_PX * 1.41)
        if (drawing.width) canvas.getContext('2d')!.drawImage(drawing, 0, 0)
      }
      const height = Math.min(oldDrawing.height, newDrawing.height)
      if (!height) return
      const oldPixels = oldDrawing.getContext('2d')!.getImageData(0, 0, COMPARE_WIDTH_PX, height).data
      const newPixels = newDrawing.getContext('2d')!.getImageData(0, 0, COMPARE_WIDTH_PX, height).data
      const changedBlocks = new Set<number>()
      const blocksPerRow = Math.ceil(COMPARE_WIDTH_PX / CHANGE_BLOCK_PX)
      for (let offset = 0; offset < newPixels.length; offset += 4) {
        const difference = Math.abs(oldPixels[offset] - newPixels[offset]) + Math.abs(oldPixels[offset + 1] - newPixels[offset + 1]) + Math.abs(oldPixels[offset + 2] - newPixels[offset + 2])
        if (difference <= PIXEL_DIFFERENCE_THRESHOLD) continue
        const pixel = offset / 4
        changedBlocks.add(Math.floor(pixel / COMPARE_WIDTH_PX / CHANGE_BLOCK_PX) * blocksPerRow + Math.floor((pixel % COMPARE_WIDTH_PX) / CHANGE_BLOCK_PX))
      }
      for (const canvas of [oldCanvas, newCanvas]) {
        const context = canvas.getContext('2d')!
        context.fillStyle = 'rgba(230, 30, 30, 0.4)'
        for (const block of changedBlocks) context.fillRect((block % blocksPerRow) * CHANGE_BLOCK_PX, Math.floor(block / blocksPerRow) * CHANGE_BLOCK_PX, CHANGE_BLOCK_PX, CHANGE_BLOCK_PX)
      }
    })
    return () => {
      isCurrent = false
    }
  }, [oldDocument, newDocument, pageIndex])
  return (
    <div dir="ltr" className="mx-auto grid max-w-[860px] grid-cols-2 gap-3">
      <canvas ref={oldCanvasRef} id="compare-old-page" width={COMPARE_WIDTH_PX} height={Math.round(COMPARE_WIDTH_PX * 1.41)} role="img" aria-label={t('tools.compare.oldPage', { page: pageIndex + 1 })} className="compare-canvas" />
      <canvas ref={newCanvasRef} id="compare-new-page" width={COMPARE_WIDTH_PX} height={Math.round(COMPARE_WIDTH_PX * 1.41)} role="img" aria-label={t('tools.compare.newPage', { page: pageIndex + 1 })} className="compare-canvas" />
    </div>
  )
}
const COMPARE_WIDTH_PX = 420
// The sum of the red, green and blue differences above which a pixel counts as changed (anti-aliasing stays under it), and
// the size of the blocks painted over changes, so a changed letter shows as a patch, not a few dots.
const PIXEL_DIFFERENCE_THRESHOLD = 96
const CHANGE_BLOCK_PX = 8

export function ComparePdf({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const openedByFile = useOpenedPdfs(files)
  const [oldOpened, newOpened] = [openedByFile.get(files[0]), files[1] ? openedByFile.get(files[1]) : undefined]
  const oldDocument = oldOpened && 'document' in oldOpened ? oldOpened.document : null
  const newDocument = newOpened && 'document' in newOpened ? newOpened.document : null
  const [view, setView] = useState<'text' | 'visual'>('text')
  const [differences, setDifferences] = useState<{ documents: [PDFDocumentProxy, PDFDocumentProxy]; pages: PageDifferences[] } | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [visualPageIndex, setVisualPageIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const shownDifferences = differences && differences.documents[0] === oldDocument && differences.documents[1] === newDocument ? differences.pages : null
  const changedLines = shownDifferences?.flatMap((page) => page.lines.filter((line) => line.kind !== 'same')) ?? []
  const addedCount = changedLines.filter((line) => line.kind === 'added').length
  const removedCount = changedLines.length - addedCount

  async function compareText() {
    if (!oldDocument || !newDocument) return
    setIsComparing(true)
    setFailed(false)
    try {
      const pageLines = async (document: PDFDocumentProxy, pageNumber: number) => {
        if (pageNumber > document.numPages) return []
        const page = await document.getPage(pageNumber)
        const lines = (await readPageLines(page)).map((line) => line.text.trim())
        page.cleanup()
        return lines
      }
      const pages: PageDifferences[] = []
      for (let pageNumber = 1; pageNumber <= Math.max(oldDocument.numPages, newDocument.numPages); pageNumber++) {
        pages.push({ pageNumber, lines: diffLines(await pageLines(oldDocument, pageNumber), await pageLines(newDocument, pageNumber)) })
      }
      setDifferences({ documents: [oldDocument, newDocument], pages })
    } catch {
      setFailed(true)
    } finally {
      setIsComparing(false)
    }
  }

  function downloadReport() {
    if (!shownDifferences) return
    const report = [
      t('tools.compare.reportTitle', { old: files[0].name, new: files[1].name }),
      t('tools.compare.summary', { added: addedCount, removed: removedCount }),
      ...shownDifferences
        .filter((page) => page.lines.some((line) => line.kind !== 'same'))
        .map((page) => [t('tools.text.pageHeading', { number: page.pageNumber }), ...page.lines.filter((line) => line.kind !== 'same').map((line) => `${line.kind === 'added' ? '+' : '-'} ${line.text}`)].join('\n')),
    ].join('\n\n')
    onResult(new File([`${report}\n`], `${baseNameOf(files[0].name)}-compared.txt`, { type: 'text/plain;charset=utf-8' }))
  }

  const problems = [oldOpened, newOpened].flatMap((opened) => (opened && 'problem' in opened ? [opened.problem] : []))
  const pageCount = Math.max(oldDocument?.numPages ?? 0, newDocument?.numPages ?? 0)
  return (
    <div id="compare-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.compare.hint')}</p>
      <PdfFileList files={files} onFilesChange={onFilesChange} />
      {files.length < 2 && (
        <div className="flex justify-center">
          <button id="compare-add-file-button" type="button" onClick={onAddFiles} className="btn btn--primary press">
            {t('tools.compare.addSecond')}
          </button>
        </div>
      )}
      {files.length > 2 && <p id="compare-only-two" className="text-center text-sm text-ink-soft">{t('tools.compare.onlyTwo')}</p>}
      {problems.length > 0 && <p id="pdf-problem" role="alert" className="text-center font-medium text-danger">{t(problemMessageKey(problems[0]))}</p>}
      {oldDocument && newDocument && (
        <>
          <div role="tablist" aria-label={t('tools.compare.viewLabel')} className="flex justify-center gap-2">
            {(['text', 'visual'] as const).map((tab) => (
              <button key={tab} id={`compare-${tab}-tab`} type="button" role="tab" aria-selected={view === tab} aria-controls={`compare-${tab}-panel`} onClick={() => setView(tab)} className="btn btn--quiet btn--compact press">
                {t(tab === 'text' ? 'tools.compare.textTab' : 'tools.compare.visualTab')}
              </button>
            ))}
          </div>
          {view === 'text' && (
            <div id="compare-text-panel" role="tabpanel" aria-labelledby="compare-text-tab" className="space-y-4">
              <div className="flex flex-wrap justify-center gap-3">
                <button id="compare-pdf-button" type="button" disabled={isComparing} onClick={() => void compareText()} className="btn btn--primary press">
                  {isComparing ? t('tools.working') : t('tools.compare.button')}
                </button>
                {shownDifferences && changedLines.length > 0 && (
                  <button id="compare-report-button" type="button" onClick={downloadReport} className="btn btn--quiet press">
                    {t('tools.compare.report')}
                  </button>
                )}
              </div>
              <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={failed ? t('tools.text.failed') : ''} />
              {shownDifferences && (
                <p id="compare-summary" aria-live="polite" className="text-center font-medium">
                  {changedLines.length ? t('tools.compare.summary', { added: addedCount, removed: removedCount }) : t('tools.compare.same')}
                </p>
              )}
              {shownDifferences
                ?.filter((page) => page.lines.some((line) => line.kind !== 'same'))
                .map((page) => (
                  <section key={page.pageNumber} id={`compare-page-${page.pageNumber}`} className="mx-auto max-w-[760px] text-start">
                    <h3 className="mb-1 text-sm font-semibold">{t('tools.compare.page', { page: page.pageNumber })}</h3>
                    <ul className="space-y-0.5 rounded-[14px] border-2 border-rule bg-paper-raised p-3 text-sm">
                      {page.lines
                        .filter((line) => line.kind !== 'same')
                        .map((line, index) => (
                          <li key={index} dir="auto" className={line.kind === 'added' ? 'diff-added' : 'diff-removed'}>
                            <span className="sr-only">{t(line.kind === 'added' ? 'tools.compare.added' : 'tools.compare.removed')} </span>
                            {line.text}
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
            </div>
          )}
          {view === 'visual' && (
            <div id="compare-visual-panel" role="tabpanel" aria-labelledby="compare-visual-tab" className="space-y-3">
              <div className="flex flex-wrap items-end justify-center gap-3 text-start">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  {t('tools.crop.shownPage')}
                  <select id="compare-visual-page-select" value={visualPageIndex} onChange={(event) => setVisualPageIndex(Number(event.target.value))} className={fieldClass}>
                    {Array.from({ length: pageCount }, (_, pageIndex) => (
                      <option key={pageIndex} value={pageIndex}>
                        {pageIndex + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-center text-sm text-ink-soft">{t('tools.compare.visualLegend')}</p>
              <VisualPageDifference oldDocument={oldDocument} newDocument={newDocument} pageIndex={Math.min(visualPageIndex, pageCount - 1)} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
