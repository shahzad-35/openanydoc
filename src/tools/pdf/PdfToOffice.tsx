// PDF to Word, PDF to Excel, PDF to PowerPoint and Translate PDF: each page is read with pdf.js as lines of text (position, size, bold, italic,
// direction, and the gaps that split a line into columns) and pictures (where they sit), then written as editable content with
// docx (MIT), ExcelJS (MIT) or pptxgenjs (MIT), each loaded only here. The layout is close, not exact: drawn shapes, colours and
// backgrounds are left out, as the pages say. PDF to PowerPoint's default instead puts each page on its slide as a picture.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { loadPdfCore } from '../../formats/pdf/pdfLibrary'
import { loadExcelJs } from '../../formats/excel/excelStyles'
import type { ToolProps } from '../registry'
import { canvasToBytes, decodedImageToCanvas } from './PdfExtractTools'
import type { DecodedImage } from './PdfExtractTools'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, problemMessageKey, useOpenedPdfs } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

// A run of a line's text with no wide gap in it (a cell of a table row); points from the page's top-left corner.
type LinePiece = { text: string; x: number; width: number }
type LayoutLine = { pieces: LinePiece[]; x: number; top: number; baselineY: number; width: number; fontSize: number; isBold: boolean; isItalic: boolean; isRightToLeft: boolean }
type LayoutPicture = { x: number; top: number; width: number; height: number; png: ArrayBuffer; pixelWidth: number; pixelHeight: number }
type PageLayout = { width: number; height: number; lines: LayoutLine[]; pictures: LayoutPicture[] }
// Lines that read as one block: a heading (level 1 to 3), a list item, or a paragraph of several lines.
type TextBlock = { kind: 'heading' | 'list' | 'paragraph'; level: number; lines: LayoutLine[] }

const RIGHT_TO_LEFT_LETTER = /[֐-׿؀-ٟ٪-ۯۺ-ۿݐ-ݿיִ-﷿ﹰ-﻿]/
// A gap wider than this many font sizes splits a line into pieces (table columns, a label and its value).
const COLUMN_GAP_EMS = 1.2
const SMALLEST_PICTURE_PX = 16
const BULLET_START = /^\s*[•●▪◦‣*–-]\s+/
const HEADING_SIZE_RATIO = 1.2
const LONGEST_HEADING = 120
const PARAGRAPH_GAP_LINES = 1.6
const POINTS_PER_INCH = 72
const TWIPS_PER_POINT = 20
const PIXELS_PER_POINT = 96 / 72
const roundedSize = (fontSize: number) => Math.round(fontSize * 2) / 2
const lineText = (line: LayoutLine) => line.pieces.map((piece) => piece.text).join(' ')
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'

// The pictures a page draws, with the box each is drawn in: pdf.js's drawing steps are followed for the transforms (save,
// restore, transform), since a picture is drawn into the unit square of the transform in force.
async function readPagePictures(page: PDFPageProxy, viewport: ReturnType<PDFPageProxy['getViewport']>) {
  const pdfjs = await loadPdfCore()
  const operatorList = await page.getOperatorList()
  const pictures: LayoutPicture[] = []
  let transform = [1, 0, 0, 1, 0, 0]
  const savedTransforms: number[][] = []
  for (const [operationIndex, operation] of operatorList.fnArray.entries()) {
    const args = operatorList.argsArray[operationIndex]
    if (operation === pdfjs.OPS.save) savedTransforms.push(transform)
    else if (operation === pdfjs.OPS.restore) transform = savedTransforms.pop() ?? [1, 0, 0, 1, 0, 0]
    else if (operation === pdfjs.OPS.transform) {
      const [a, b, c, d, e, f] = args as number[]
      const [ta, tb, tc, td, te, tf] = transform
      transform = [a * ta + b * tc, a * tb + b * td, c * ta + d * tc, c * tb + d * td, e * ta + f * tc + te, e * tb + f * td + tf]
    } else if (operation === pdfjs.OPS.paintImageXObject || operation === pdfjs.OPS.paintInlineImageXObject) {
      const objectId = operation === pdfjs.OPS.paintImageXObject ? (args[0] as string) : null
      const image: DecodedImage | null = objectId ? await new Promise((resolve) => (objectId.startsWith('g_') ? page.commonObjs : page.objs).get(objectId, resolve)) : (args[0] as DecodedImage)
      if (!image || image.width < SMALLEST_PICTURE_PX || image.height < SMALLEST_PICTURE_PX) continue
      const canvas = decodedImageToCanvas(image)
      if (!canvas) continue
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => viewport.convertToViewportPoint(transform[0] * u + transform[2] * v + transform[4], transform[1] * u + transform[3] * v + transform[5]))
      const xs = corners.map(([x]) => x)
      const ys = corners.map(([, y]) => y)
      pictures.push({ x: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), png: await canvasToBytes(canvas, 'image/png'), pixelWidth: canvas.width, pixelHeight: canvas.height })
    }
  }
  return pictures
}

// The page's lines: pdf.js's runs (Arabic lines already in reading order, pdfTextOrder.ts) grouped by baseline, ordered top to
// bottom, each split into pieces at wide gaps. Bold and italic come from the font's name. Turned text is left out.
async function readPageLayout(page: PDFPageProxy): Promise<PageLayout> {
  const viewport = page.getViewport({ scale: 1 })
  const pictures = await readPagePictures(page, viewport)
  const content = await page.getTextContent()
  type Run = { text: string; x: number; width: number; baselineY: number; fontSize: number; fontName: string; isRightToLeft: boolean }
  const runs: Run[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const [scaleX, skewY, skewX, scaleY, baselineX, baselineY] = item.transform as number[]
    const directionLength = Math.hypot(scaleX, skewY) || 1
    const [startX, startY] = viewport.convertToViewportPoint(baselineX, baselineY)
    const [endX, endY] = viewport.convertToViewportPoint(baselineX + (scaleX / directionLength) * item.width, baselineY + (skewY / directionLength) * item.width)
    if (Math.abs(endY - startY) > 1) continue
    runs.push({ text: item.str, x: Math.min(startX, endX), width: Math.abs(endX - startX), baselineY: startY, fontSize: Math.hypot(skewX, scaleY), fontName: item.fontName, isRightToLeft: item.dir === 'rtl' || RIGHT_TO_LEFT_LETTER.test(item.str) })
  }
  runs.sort((first, second) => first.baselineY - second.baselineY || first.x - second.x)
  const lineRuns: Run[][] = []
  for (const run of runs) {
    const current = lineRuns.at(-1)
    if (current && Math.abs(current[0].baselineY - run.baselineY) <= Math.max(current[0].fontSize, run.fontSize) * 0.3) current.push(run)
    else lineRuns.push([run])
  }
  const fontNameOf = (fontName: string) => (page.commonObjs.has(fontName) ? ((page.commonObjs.get(fontName) as { name?: string }).name ?? '') : '')
  const lines = lineRuns.map((runsOfLine): LayoutLine => {
    const ordered = [...runsOfLine].sort((first, second) => first.x - second.x)
    const fontSize = Math.max(...ordered.map((run) => run.fontSize))
    const pieces: LinePiece[] = []
    for (const run of ordered) {
      const previous = pieces.at(-1)
      if (previous && run.x - (previous.x + previous.width) < COLUMN_GAP_EMS * fontSize) {
        previous.text += (run.x - (previous.x + previous.width) > fontSize * 0.15 && !previous.text.endsWith(' ') ? ' ' : '') + run.text
        previous.width = run.x + run.width - previous.x
      } else pieces.push({ text: run.text, x: run.x, width: run.width })
    }
    const isRightToLeft = ordered.filter((run) => run.isRightToLeft).length * 2 > ordered.length
    // A right-to-left line's pieces are listed in reading order, right to left.
    if (isRightToLeft) pieces.reverse()
    const fontNames = ordered.map((run) => fontNameOf(run.fontName))
    const left = ordered[0].x
    return {
      pieces: pieces.map((piece) => ({ ...piece, text: piece.text.trim() })),
      x: left,
      top: ordered[0].baselineY - fontSize,
      baselineY: ordered[0].baselineY,
      width: Math.max(...ordered.map((run) => run.x + run.width)) - left,
      fontSize,
      isBold: fontNames.length > 0 && fontNames.every((name) => /Bold|Black|Heavy|Semibold/i.test(name)),
      isItalic: fontNames.length > 0 && fontNames.every((name) => /Italic|Oblique/i.test(name)),
      isRightToLeft,
    }
  })
  return { width: viewport.width, height: viewport.height, lines, pictures }
}

// Headings come from text clearly larger than the body text (the three largest such sizes), list items from bullets and numbers,
// and lines of the same size, close together and starting at the same place make one paragraph.
function groupIntoBlocks(pages: PageLayout[]) {
  const characterCountBySize = new Map<number, number>()
  for (const line of pages.flatMap((page) => page.lines)) characterCountBySize.set(roundedSize(line.fontSize), (characterCountBySize.get(roundedSize(line.fontSize)) ?? 0) + lineText(line).length)
  const bodySize = [...characterCountBySize].sort((first, second) => second[1] - first[1])[0]?.[0] ?? 0
  const headingSizes = [...characterCountBySize.keys()].filter((size) => size >= bodySize * HEADING_SIZE_RATIO).sort((first, second) => second - first)
  return pages.map((page) => {
    const blocks: TextBlock[] = []
    for (const line of page.lines) {
      const headingLevel = headingSizes.indexOf(roundedSize(line.fontSize)) + 1
      const previousBlock = blocks.at(-1)
      const previousLine = previousBlock?.lines.at(-1)
      if (headingLevel > 0 && lineText(line).length <= LONGEST_HEADING && line.pieces.length === 1) blocks.push({ kind: 'heading', level: Math.min(headingLevel, 3), lines: [line] })
      else if (BULLET_START.test(lineText(line))) blocks.push({ kind: 'list', level: 0, lines: [line] })
      else if (
        previousBlock?.kind === 'paragraph' &&
        previousLine &&
        line.pieces.length === 1 &&
        previousLine.pieces.length === 1 &&
        roundedSize(previousLine.fontSize) === roundedSize(line.fontSize) &&
        line.baselineY - previousLine.baselineY <= PARAGRAPH_GAP_LINES * line.fontSize * 1.2 &&
        Math.abs((line.isRightToLeft ? line.x + line.width : line.x) - (previousLine.isRightToLeft ? previousLine.x + previousLine.width : previousLine.x)) < line.fontSize * 2
      ) {
        previousBlock.lines.push(line)
      } else blocks.push({ kind: 'paragraph', level: 0, lines: [line] })
    }
    return blocks
  })
}

// ---------------------------------------------------------------- the page shared by the three tools

type WrittenFile = { bytes: BlobPart; extension: string; type: string }

function useOfficeConversion(files: File[], onResult: ToolProps['onResult']) {
  const { t } = useT()
  const file = files[0]
  const opened = useOpenedPdfs(files).get(file)
  const pdfDocument = opened && 'document' in opened ? opened.document : null
  const [progress, setProgress] = useState<{ done: number; total: number; labelKey: MessageKey } | null>(null)
  const [message, setMessage] = useState<{ file: File; key: MessageKey } | null>(null)
  const cards: GridCard[] = pdfDocument ? Array.from({ length: pdfDocument.numPages }, (_, pageIndex) => ({ key: `page-${pageIndex}`, caption: String(pageIndex + 1), document: pdfDocument, pageIndex })) : []

  const showPageProgress = (done: number, total: number) => setProgress({ done, total, labelKey: 'tools.progress.pages' })

  // Writes the file from the opened PDF and hands it over; `writeFile` returns null when it has shown its own message.
  async function writeResult(writeFile: (pdfDocument: PDFDocumentProxy) => Promise<WrittenFile | null>, failedKey: MessageKey) {
    if (!pdfDocument) return
    setMessage(null)
    try {
      const written = await writeFile(pdfDocument)
      if (written) onResult(new File([written.bytes], `${baseNameOf(file.name)}.${written.extension}`, { type: written.type }))
    } catch {
      setMessage({ file, key: failedKey })
    } finally {
      setProgress(null)
    }
  }

  // Reads every page's text and pictures (readPageLayout) and writes the file from them.
  function convert(writeFile: (pages: PageLayout[], showProgress: (done: number, total: number) => void) => Promise<WrittenFile>, failedKey: MessageKey = 'tools.office.failed') {
    return writeResult(async (pdfDocument) => {
      const pages: PageLayout[] = []
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        showPageProgress(pageNumber - 1, pdfDocument.numPages)
        await nextFrame()
        const page = await pdfDocument.getPage(pageNumber)
        pages.push(await readPageLayout(page))
        page.cleanup()
      }
      if (pages.every((page) => page.lines.length === 0)) {
        setMessage({ file, key: 'tools.text.noText' })
        return null
      }
      showPageProgress(pdfDocument.numPages, pdfDocument.numPages)
      return writeFile(pages, (done, total) => setProgress({ done, total, labelKey: 'tools.translate.progress' }))
    }, failedKey)
  }

  const status = (
    <>
      {!opened && <p className="text-center text-sm text-ink-soft">{t('tools.pdf.reading')}</p>}
      {opened && 'problem' in opened && <p id="pdf-problem" role="alert" className="text-center font-medium text-danger">{t(problemMessageKey(opened.problem))}</p>}
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t(progress.labelKey, { done: progress.done, total: progress.total })} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={message?.file === file ? t(message.key) : ''} />
    </>
  )
  return { pdfDocument, isReady: pdfDocument !== null && progress === null, isWorking: progress !== null, cards, convert, writeResult, showPageProgress, status }
}

function OfficeToolPage({ idPrefix, hintKey, buttonKey, conversion, options }: { idPrefix: string; hintKey: MessageKey; buttonKey: MessageKey; conversion: ReturnType<typeof useOfficeConversion> & { run: () => void }; options?: ReactNode }) {
  const { t } = useT()
  return (
    <div id={`${idPrefix}-tool`} className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t(hintKey)}</p>
      {options}
      <div className="flex justify-center">
        <button id={`${idPrefix}-button`} type="button" disabled={!conversion.isReady} onClick={conversion.run} className="btn btn--primary press">
          {conversion.isWorking ? t('tools.working') : t(buttonKey)}
        </button>
      </div>
      {conversion.status}
      <PdfThumbnailGrid id={`${idPrefix}-grid`} label={t('tools.grid.pagesLabel')} cards={conversion.cards} />
    </div>
  )
}

// ---------------------------------------------------------------- PDF to Word

// The texts a block is written as: a paragraph of several lines as one text, otherwise each piece of its line (bullet left out).
function blockTexts(block: TextBlock) {
  if (block.kind === 'paragraph' && block.lines.length > 1) return [block.lines.map(lineText).join(' ')]
  return block.lines[0].pieces.map((piece) => (block.kind === 'list' ? piece.text.replace(BULLET_START, '') : piece.text))
}

// Translate PDF writes the same document with each block's texts translated, in the direction of the language it is written in.
type Translation = { blocksByPage: TextBlock[][]; textsByBlock: Map<TextBlock, string[]>; isRightToLeft: boolean }

async function writeWordDocument(pages: PageLayout[], translation?: Translation) {
  const { Document, ImageRun, Packer, Paragraph, TabStopType, TextRun } = await import('docx')
  const blocksByPage = translation?.blocksByPage ?? groupIntoBlocks(pages)
  const firstPage = pages[0]
  const leftMargin = Math.min(Math.max(Math.min(...pages.flatMap((page) => page.lines.map((line) => line.x)), POINTS_PER_INCH), 36), POINTS_PER_INCH)
  const rightMargin = leftMargin
  const textRun = (text: string, line: LayoutLine, isRightToLeft: boolean) => new TextRun({ text, size: Math.round(line.fontSize * 2), bold: line.isBold, italics: line.isItalic, rightToLeft: isRightToLeft, font: 'Arial' })
  const children = blocksByPage.flatMap((blocks, pageIndex) => {
    const page = pages[pageIndex]
    // Blocks and pictures in the order they sit down the page.
    const items: ({ top: number; block: TextBlock } | { top: number; picture: LayoutPicture })[] = [...blocks.map((block) => ({ top: block.lines[0].top, block })), ...page.pictures.map((picture) => ({ top: picture.top, picture }))].sort((first, second) => first.top - second.top)
    let previousBottom = 0
    return items.map((item, itemIndex) => {
      const spaceBefore = Math.round(Math.min(Math.max(item.top - previousBottom, 0), 72) * TWIPS_PER_POINT * 0.6)
      const pageBreakBefore = pageIndex > 0 && itemIndex === 0
      if ('picture' in item) {
        previousBottom = item.picture.top + item.picture.height
        return new Paragraph({
          pageBreakBefore,
          spacing: { before: spaceBefore },
          indent: { left: Math.round(Math.max(item.picture.x - leftMargin, 0) * TWIPS_PER_POINT) },
          children: [new ImageRun({ type: 'png', data: item.picture.png, transformation: { width: Math.round(item.picture.width * PIXELS_PER_POINT), height: Math.round(item.picture.height * PIXELS_PER_POINT) } })],
        })
      }
      const { block } = item
      const firstLine = block.lines[0]
      const lastLine = block.lines.at(-1)!
      previousBottom = lastLine.baselineY + lastLine.fontSize * 0.25
      const isRightToLeft = translation ? translation.isRightToLeft : firstLine.isRightToLeft
      // A line split into pieces (a table row, a label and its value) keeps them apart with tab stops where they were.
      const tabStops = firstLine.pieces.length > 1 ? firstLine.pieces.slice(1).map((piece) => ({ type: TabStopType.LEFT, position: Math.round(Math.max(piece.x - leftMargin, 0) * TWIPS_PER_POINT) })) : undefined
      const texts = translation?.textsByBlock.get(block) ?? blockTexts(block)
      const runs = texts.flatMap((text, textIndex) => [...(textIndex > 0 ? [new TextRun({ text: '\t' })] : []), textRun(text, firstLine, isRightToLeft)])
      return new Paragraph({
        pageBreakBefore,
        bidirectional: isRightToLeft,
        spacing: { before: spaceBefore, after: 0 },
        indent: isRightToLeft ? undefined : { left: Math.round(Math.max(firstLine.x - leftMargin, 0) * TWIPS_PER_POINT) },
        heading: block.kind === 'heading' ? (['Heading1', 'Heading2', 'Heading3'] as const)[block.level - 1] : undefined,
        bullet: block.kind === 'list' ? { level: 0 } : undefined,
        tabStops,
        children: runs,
      })
    })
  })
  const document = new Document({
    sections: [
      {
        properties: { page: { size: { width: Math.round(firstPage.width * TWIPS_PER_POINT), height: Math.round(firstPage.height * TWIPS_PER_POINT) }, margin: { top: 720, bottom: 720, left: Math.round(leftMargin * TWIPS_PER_POINT), right: Math.round(rightMargin * TWIPS_PER_POINT) } } },
        children,
      },
    ],
  })
  return { bytes: await Packer.toBlob(document), extension: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
}

export function PdfToWord({ files, onResult }: ToolProps) {
  const conversion = useOfficeConversion(files, onResult)
  return <OfficeToolPage idPrefix="pdf-to-word" hintKey="tools.office.wordHint" buttonKey="tools.office.wordButton" conversion={{ ...conversion, run: () => void conversion.convert((pages) => writeWordDocument(pages)) }} />
}

// ---------------------------------------------------------------- Translate PDF

type TranslationDirection = 'en-ar' | 'ar-en'
// Text with no letter of the language translated from (numbers, codes, text already in the other language) is kept as it is.
const SOURCE_LETTER: Record<string, RegExp> = { en: /[A-Za-z]/, ar: /[؀-ۿ]/ }

// Mozilla's English–Arabic models (MPL-2.0, Firefox's "base-memory") run in bergamot-translator's WebAssembly worker (MPL-2.0).
// The models, the worker and the runtime are files of this site (public/models/translate/), read on first use; the models are
// kept gzipped and unpacked here, so the runtime's own download (which would check the gzipped bytes' hash) is replaced.
async function translateBlocks(pages: PageLayout[], direction: TranslationDirection, showProgress: (done: number, total: number) => void): Promise<Translation> {
  const { BatchTranslator, TranslatorBacking } = await import('@browsermt/bergamot-translator/translator.js')
  class SiteModelBacking extends TranslatorBacking {
    async fetch(url: string) {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Could not read ${url}`)
      const bytes = await response.arrayBuffer()
      // A server may send the .gz file with Content-Encoding: gzip (Vite's dev server does), and the browser has then unpacked it.
      const [firstByte, secondByte] = new Uint8Array(bytes, 0, 2)
      const isGzipped = firstByte === 0x1f && secondByte === 0x8b
      return isGzipped ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes
    }
  }
  const options = { registryUrl: '/models/translate/registry.json', pivotLanguage: null, workers: 1, downloadTimeout: 0 }
  const translator = new BatchTranslator(options, new SiteModelBacking(options))
  const [from, to] = direction.split('-')
  const blocksByPage = groupIntoBlocks(pages)
  const blocks = blocksByPage.flat()
  let done = 0
  showProgress(0, blocks.length)
  try {
    const translatedBlocks = await Promise.all(
      blocks.map(async (block) => {
        const texts = await Promise.all(blockTexts(block).map(async (text) => (SOURCE_LETTER[from].test(text) ? (await translator.translate({ from, to, text, html: false })).target.text : text)))
        showProgress(++done, blocks.length)
        return [block, texts] as const
      }),
    )
    return { blocksByPage, textsByBlock: new Map(translatedBlocks), isRightToLeft: to === 'ar' }
  } finally {
    await translator.delete()
  }
}

// The direction the file most likely needs: Arabic to English when most letters on its first page are Arabic.
async function guessTranslationDirection(pdfDocument: PDFDocumentProxy): Promise<TranslationDirection> {
  const page = await pdfDocument.getPage(1)
  const text = (await page.getTextContent()).items.map((item) => ('str' in item ? item.str : '')).join('')
  const arabicLetters = text.match(/[؀-ۿ]/g)?.length ?? 0
  const latinLetters = text.match(/[A-Za-z]/g)?.length ?? 0
  return arabicLetters > latinLetters ? 'ar-en' : 'en-ar'
}

export function TranslatePdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const conversion = useOfficeConversion(files, onResult)
  const { pdfDocument } = conversion
  const [direction, setDirection] = useState<{ pdfDocument: typeof pdfDocument; value: TranslationDirection } | null>(null)
  const chosenDirection = direction?.pdfDocument === pdfDocument ? direction.value : 'en-ar'

  useEffect(() => {
    if (!pdfDocument) return
    let isCurrent = true
    guessTranslationDirection(pdfDocument)
      .then((value) => isCurrent && setDirection((current) => (current?.pdfDocument === pdfDocument ? current : { pdfDocument, value })))
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [pdfDocument])

  const options = (
    <div className="flex justify-center">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('tools.translate.direction')}
        <select id="translate-pdf-direction-select" value={chosenDirection} disabled={!pdfDocument} onChange={(event) => setDirection({ pdfDocument, value: event.target.value as TranslationDirection })} className={fieldClass}>
          <option value="en-ar">{t('tools.translate.englishToArabic')}</option>
          <option value="ar-en">{t('tools.translate.arabicToEnglish')}</option>
        </select>
      </label>
    </div>
  )
  const run = () => void conversion.convert(async (pages, showProgress) => writeWordDocument(pages, await translateBlocks(pages, chosenDirection, showProgress)), 'tools.translate.failed')
  return <OfficeToolPage idPrefix="translate-pdf" hintKey="tools.translate.hint" buttonKey="tools.translate.button" conversion={{ ...conversion, run }} options={options} />
}

// ---------------------------------------------------------------- PDF to Excel

const NUMBER_TEXT = /^[-+]?\(?\d{1,3}(,\d{3})*(\.\d+)?\)?$|^[-+]?\d+(\.\d+)?$/

// One sheet per page. Columns come from the table rows (lines split into several pieces): pieces whose spans across the page
// overlap belong to one column, so left-aligned, centred and right-aligned columns all line up. Every line is a row and each piece
// goes in the column its middle falls in (a line in one piece, such as a title, goes in the first); numbers become numbers.
async function writeWorkbook(pages: PageLayout[]) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  for (const [pageIndex, page] of pages.entries()) {
    const isRightToLeft = page.lines.filter((line) => line.isRightToLeft).length * 2 > page.lines.length
    const sheet = workbook.addWorksheet(`Page ${pageIndex + 1}`, { views: [{ rightToLeft: isRightToLeft }] })
    const columnSpans: { start: number; end: number }[] = []
    const tablePieces = page.lines.filter((line) => line.pieces.length > 1).flatMap((line) => line.pieces)
    for (const piece of [...tablePieces].sort((first, second) => first.x - second.x)) {
      const lastSpan = columnSpans.at(-1)
      if (lastSpan && piece.x <= lastSpan.end + COLUMN_EDGE_TOLERANCE) lastSpan.end = Math.max(lastSpan.end, piece.x + piece.width)
      else columnSpans.push({ start: piece.x, end: piece.x + piece.width })
    }
    // Columns are numbered in reading order: right to left on a right-to-left page.
    if (isRightToLeft) columnSpans.reverse()
    const columnOf = (piece: LinePiece, line: LayoutLine) => {
      if (line.pieces.length === 1) return 1
      const middle = piece.x + piece.width / 2
      const distances = columnSpans.map((span) => (middle < span.start ? span.start - middle : middle > span.end ? middle - span.end : 0))
      return distances.indexOf(Math.min(...distances)) + 1
    }
    let rowNumber = 0
    let previousLine: LayoutLine | null = null
    const longestTextByColumn = new Map<number, number>()
    for (const line of page.lines) {
      // A wide gap between lines becomes an empty row.
      rowNumber += previousLine && line.baselineY - previousLine.baselineY > PARAGRAPH_GAP_LINES * 1.2 * line.fontSize ? 2 : 1
      previousLine = line
      for (const piece of line.pieces) {
        const column = columnOf(piece, line)
        const cell = sheet.getCell(rowNumber, column)
        const numberText = piece.text.replace(/,/g, '').replace(/^\((.*)\)$/, '-$1')
        cell.value = NUMBER_TEXT.test(piece.text) && Number.isFinite(Number(numberText)) ? Number(numberText) : piece.text
        if (line.isBold) cell.font = { bold: true }
        longestTextByColumn.set(column, Math.max(longestTextByColumn.get(column) ?? 0, piece.text.length))
      }
    }
    for (const [column, length] of longestTextByColumn) sheet.getColumn(column).width = Math.min(Math.max(length + 2, 8), 60)
  }
  return { bytes: await workbook.xlsx.writeBuffer(), extension: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
}
const COLUMN_EDGE_TOLERANCE = 6

export function PdfToExcel({ files, onResult }: ToolProps) {
  const conversion = useOfficeConversion(files, onResult)
  return <OfficeToolPage idPrefix="pdf-to-excel" hintKey="tools.office.excelHint" buttonKey="tools.office.excelButton" conversion={{ ...conversion, run: () => void conversion.convert(writeWorkbook) }} />
}

// ---------------------------------------------------------------- PDF to PowerPoint

// One slide per page, the size of the first page: every block of text an editable text box where it was, every picture where
// it was.
async function writePresentation(pages: PageLayout[]) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const presentation = new PptxGenJS()
  const inches = (points: number) => points / POINTS_PER_INCH
  presentation.defineLayout({ name: 'PDF', width: inches(pages[0].width), height: inches(pages[0].height) })
  presentation.layout = 'PDF'
  const blocksByPage = groupIntoBlocks(pages)
  for (const [pageIndex, page] of pages.entries()) {
    const slide = presentation.addSlide()
    for (const picture of page.pictures) {
      const base64 = btoa(Array.from(new Uint8Array(picture.png), (byte) => String.fromCharCode(byte)).join(''))
      slide.addImage({ data: `image/png;base64,${base64}`, x: inches(picture.x), y: inches(picture.top), w: inches(picture.width), h: inches(picture.height) })
    }
    for (const block of blocksByPage[pageIndex]) {
      const left = Math.min(...block.lines.map((line) => line.x))
      const right = Math.max(...block.lines.map((line) => line.x + line.width))
      const top = block.lines[0].top
      const bottom = block.lines.at(-1)!.baselineY + block.lines.at(-1)!.fontSize * 0.3
      const firstLine = block.lines[0]
      const text = block.lines.map((line) => line.pieces.map((piece) => piece.text).join('\t')).join('\n')
      // A little wider than the text, so a font of slightly different widths doesn't wrap it.
      slide.addText(block.kind === 'list' ? text.replace(BULLET_START, '') : text, {
        x: inches(left),
        y: inches(top),
        w: inches((right - left) * 1.08 + firstLine.fontSize),
        h: inches(bottom - top),
        fontSize: Math.max(Math.round(firstLine.fontSize), 6),
        fontFace: 'Arial',
        bold: firstLine.isBold,
        italic: firstLine.isItalic,
        bullet: block.kind === 'list',
        rtlMode: firstLine.isRightToLeft,
        align: firstLine.isRightToLeft ? 'right' : 'left',
        valign: 'top',
        margin: 0,
        fit: 'none',
      })
    }
  }
  return savePresentation(presentation)
}

async function savePresentation(presentation: InstanceType<typeof import('pptxgenjs').default>): Promise<WrittenFile> {
  const { removeTypesOfMissingParts } = await import('../office/officePackage')
  return { bytes: await removeTypesOfMissingParts((await presentation.write({ outputType: 'arraybuffer' })) as ArrayBuffer), extension: 'pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
}

// Pages drawn at 200 dpi, at most 2000 pixels on the long side.
const SLIDE_PICTURE_DPI = 200
const LONGEST_SLIDE_PICTURE_PX = 2000

// One slide per page, the size of the first page, each page drawn by pdf.js as a JPEG filling the slide: it looks exactly like
// the PDF, but nothing on it can be edited. A page of another shape is fitted inside the slide and centred.
async function writePicturePresentation(pdfDocument: PDFDocumentProxy, showProgress: (done: number, total: number) => void) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const presentation = new PptxGenJS()
  const inches = (points: number) => points / POINTS_PER_INCH
  const firstPageSize = (await pdfDocument.getPage(1)).getViewport({ scale: 1 })
  presentation.defineLayout({ name: 'PDF', width: inches(firstPageSize.width), height: inches(firstPageSize.height) })
  presentation.layout = 'PDF'
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    showProgress(pageNumber - 1, pdfDocument.numPages)
    await nextFrame()
    const page = await pdfDocument.getPage(pageNumber)
    const pageSize = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(SLIDE_PICTURE_DPI / POINTS_PER_INCH, LONGEST_SLIDE_PICTURE_PX / Math.max(pageSize.width, pageSize.height)) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvas, viewport, background: '#ffffff' }).promise
    const jpeg = await canvasToBytes(canvas, 'image/jpeg', 0.92)
    canvas.width = 0
    page.cleanup()
    const fitScale = Math.min(firstPageSize.width / pageSize.width, firstPageSize.height / pageSize.height)
    const [width, height] = [pageSize.width * fitScale, pageSize.height * fitScale]
    const base64 = btoa(Array.from(new Uint8Array(jpeg), (byte) => String.fromCharCode(byte)).join(''))
    presentation.addSlide().addImage({ data: `image/jpeg;base64,${base64}`, x: inches((firstPageSize.width - width) / 2), y: inches((firstPageSize.height - height) / 2), w: inches(width), h: inches(height) })
  }
  showProgress(pdfDocument.numPages, pdfDocument.numPages)
  return savePresentation(presentation)
}

type SlidesMode = 'pictures' | 'editable'

export function PdfToPowerPoint({ files, onResult }: ToolProps) {
  const { t } = useT()
  const conversion = useOfficeConversion(files, onResult)
  const [slidesMode, setSlidesMode] = useState<SlidesMode>('pictures')
  const options = (
    <div className="flex justify-center">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('tools.office.slidesMode')}
        <select id="pdf-to-powerpoint-mode-select" value={slidesMode} onChange={(event) => setSlidesMode(event.target.value as SlidesMode)} className={fieldClass}>
          <option value="pictures">{t('tools.office.slidesModePictures')}</option>
          <option value="editable">{t('tools.office.slidesModeEditable')}</option>
        </select>
      </label>
    </div>
  )
  const run = () => void (slidesMode === 'pictures' ? conversion.writeResult((pdfDocument) => writePicturePresentation(pdfDocument, conversion.showPageProgress), 'tools.office.failed') : conversion.convert(writePresentation))
  return <OfficeToolPage idPrefix="pdf-to-powerpoint" hintKey={slidesMode === 'pictures' ? 'tools.office.powerpointPicturesHint' : 'tools.office.powerpointHint'} buttonKey="tools.office.powerpointButton" conversion={{ ...conversion, run }} options={options} />
}
