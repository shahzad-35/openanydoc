// Word to PDF and Excel to PDF: the file is rendered off screen the way the site's viewers show it (docx-preview for Word, a table
// built from the workbook for Excel), each page is drawn as a picture by modern-screenshot (as slides are, slideCanvas.ts), and the
// words' places on the page are measured in the DOM to lay an invisible text layer over the picture, so the PDF's text can still
// be selected, searched and copied. The PDF is put together in pdfTools.worker.ts (`picture-pages`).
import { useState } from 'react'
import type * as XLSX from 'xlsx'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { readImageAsDataUrl } from '../../formats/powerpoint/slideCanvas'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { LayerWord, PagePicture } from './pdfTasks'
import { ProgressBar, baseNameOf, pdfResultFile } from './PdfToolParts'

type Region = { x: number; y: number; width: number; height: number }
type PageSizeName = 'a4' | 'letter'
type Orientation = 'auto' | 'portrait' | 'landscape'

// CSS pixels are 96 to the inch and PDF points 72; pages are drawn at 200 dots per inch.
const POINTS_PER_PIXEL = 72 / 96
const PICTURE_SCALE = 200 / 96
const PAGE_SIZES_PX: Record<PageSizeName, [number, number]> = { a4: [794, 1123], letter: [816, 1056] }
const SHEET_MARGIN_PX = 36
const SMALLEST_SHEET_SCALE = 0.5
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

// A holder off screen but laid out (so sizes can be measured and drawn), in the light colour scheme whatever the site's theme,
// and left to right whatever the site's language: the document sets its own direction.
function makeOffscreenHolder() {
  const holder = document.createElement('div')
  holder.dir = 'ltr'
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;color-scheme:light;background:#fff'
  holder.setAttribute('aria-hidden', 'true')
  document.body.append(holder)
  return holder
}

// Every word of an element with its box, in pixels from the element's top-left corner.
function measureWords(element: HTMLElement) {
  const elementBox = element.getBoundingClientRect()
  const words: { text: string; box: Region; fontSizePx: number }[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let textNode = walker.nextNode() as Text | null; textNode; textNode = walker.nextNode() as Text | null) {
    const parent = textNode.parentElement
    if (!parent) continue
    const fontSizePx = parseFloat(getComputedStyle(parent).fontSize) || 12
    for (const match of (textNode.nodeValue ?? '').matchAll(/\S+/g)) {
      range.setStart(textNode, match.index)
      range.setEnd(textNode, match.index + match[0].length)
      const box = range.getClientRects()[0]
      if (!box || box.width === 0 || box.height === 0) continue
      words.push({ text: match[0], box: { x: box.left - elementBox.left, y: box.top - elementBox.top, width: box.width, height: box.height }, fontSizePx })
    }
  }
  return words
}

// Where a tall element is cut into pages: the first part at most `firstPageHeight` long, the others at most `pageHeight`, each at
// the lowest place that cuts no line of text, table row or picture (a picture taller than a page is cut where it must be).
function findPageCuts(element: HTMLElement, pageHeight: number, words: ReturnType<typeof measureWords>, firstPageHeight = pageHeight) {
  const elementTop = element.getBoundingClientRect().top
  const keptTogether = [
    ...words.map((word) => word.box),
    ...Array.from(element.querySelectorAll('tr, img, svg'), (child) => {
      const box = child.getBoundingClientRect()
      return { x: 0, y: box.top - elementTop, width: box.width, height: box.height }
    }),
  ].filter((box) => box.height < pageHeight)
  const totalHeight = Math.ceil(element.getBoundingClientRect().height)
  const cuts = [0]
  while (totalHeight - cuts.at(-1)! > (cuts.length === 1 ? firstPageHeight : pageHeight)) {
    const start = cuts.at(-1)!
    const height = cuts.length === 1 ? firstPageHeight : pageHeight
    const limit = start + height
    const candidates = [limit, ...keptTogether.map((box) => Math.ceil(box.y + box.height)).filter((y) => y > start + height / 2 && y < limit)].sort((first, second) => second - first)
    cuts.push(candidates.find((y) => !keptTogether.some((box) => box.y < y && box.y + box.height > y)) ?? limit)
  }
  // A cut can fall at the very end; the empty part after it is dropped.
  if (totalHeight > cuts.at(-1)! + 1) cuts.push(totalHeight)
  return cuts
}

// The site's Arabic font, handed to modern-screenshot as inlined data (no fetch). Without it, Arabic text in a font the browser
// lacks (a Word document's Times New Roman) falls back to a decorative system font whose lines collide, as the Word viewer avoids
// by adding this font to every font list (addGenericFontFamily in wordDocument.ts).
let arabicFontCss: Promise<string> | null = null
function loadArabicFontCss() {
  arabicFontCss ??= Promise.all([import('@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?inline'), import('@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2?inline')]).then((fonts) =>
    fonts
      .map(({ default: fontAddress }, index) => `@font-face{font-family:"IBM Plex Sans Arabic";font-style:normal;font-weight:${index === 0 ? 400 : 700};src:url(${fontAddress}) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC4,U+10EFC-10EFF,U+1EE00-1EEF1}`)
      .join(''),
  )
  return arabicFontCss
}

// The part `region` of an element (its own pixels) drawn `contentScale` times its size on a white page `pageSizePx` wide and high,
// at `offset` (page pixels), with its words for the text layer.
async function drawPagePart(element: HTMLElement, region: Region, pageSizePx: [number, number], offset: { x: number; y: number }, words: ReturnType<typeof measureWords>, pageIndex: number, contentScale = 1): Promise<PagePicture> {
  const { domToCanvas } = await import('modern-screenshot')
  // The part is drawn through a frame of its size that holds the element moved up and left: modern-screenshot clips its root to the
  // size it is given, so shifting the root itself would cut off what lies below that size.
  const originalStyle = element.style.cssText
  const frame = document.createElement('div')
  frame.style.cssText = `position:relative;overflow:hidden;width:${region.width}px;height:${region.height}px;background:#fff`
  element.replaceWith(frame)
  frame.append(element)
  element.style.position = 'absolute'
  element.style.left = `${-region.x}px`
  element.style.top = `${-region.y}px`
  element.style.margin = '0'
  let part: HTMLCanvasElement
  try {
    part = await domToCanvas(frame, { width: region.width, height: region.height, scale: PICTURE_SCALE * contentScale, backgroundColor: '#ffffff', font: { cssText: await loadArabicFontCss() }, fetchFn: readImageAsDataUrl })
  } finally {
    frame.replaceWith(element)
    element.style.cssText = originalStyle
  }
  const page = document.createElement('canvas')
  page.width = Math.round(pageSizePx[0] * PICTURE_SCALE)
  page.height = Math.round(pageSizePx[1] * PICTURE_SCALE)
  const context = page.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, page.width, page.height)
  context.drawImage(part, offset.x * PICTURE_SCALE, offset.y * PICTURE_SCALE)
  part.width = 0
  const blob = await new Promise<Blob | null>((resolve) => page.toBlob(resolve, 'image/jpeg', 0.9))
  page.width = 0
  if (!blob) throw new Error('The page picture could not be made')
  const layerWords: LayerWord[] = words
    .filter((word) => word.box.x >= region.x - 1 && word.box.x + word.box.width <= region.x + region.width + 1 && word.box.y >= region.y - 1 && word.box.y + word.box.height <= region.y + region.height + 1)
    .map((word) => ({
      text: word.text,
      x: ((word.box.x - region.x) * contentScale + offset.x) * POINTS_PER_PIXEL,
      baselineY: ((word.box.y - region.y + word.box.height * 0.8) * contentScale + offset.y) * POINTS_PER_PIXEL,
      width: word.box.width * contentScale * POINTS_PER_PIXEL,
      fontSize: word.fontSizePx * contentScale * POINTS_PER_PIXEL,
    }))
    // Words of a line in visual order, left to right, as the text layer writes them.
    .sort((first, second) => Math.round(first.baselineY / 2) - Math.round(second.baselineY / 2) || first.x - second.x)
  return { pageIndex, jpg: await blob.arrayBuffer(), widthPoints: pageSizePx[0] * POINTS_PER_PIXEL, heightPoints: pageSizePx[1] * POINTS_PER_PIXEL, words: layerWords }
}

// Running a conversion with progress, an error line and the result handed to the page.
function usePdfConversion({ files, onResult }: Pick<ToolProps, 'files' | 'onResult'>) {
  const file = files[0]
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<{ file: File; key: MessageKey } | null>(null)
  async function run(makePictures: (onProgress: (done: number, total: number) => void) => Promise<PagePicture[]>) {
    setError(null)
    setProgress({ done: 0, total: 0 })
    try {
      const pictures = await makePictures((done, total) => setProgress({ done, total }))
      const response = await runPdfTask({ type: 'picture-pages', pdf: null, pageCount: pictures.length, pictures })
      if (response.status !== 'ok' || !response.pdf) throw new Error('The PDF could not be made')
      onResult(pdfResultFile(response.pdf, `${baseNameOf(file.name)}.pdf`))
    } catch {
      setError({ file, key: 'tools.officePdf.failed' })
    } finally {
      setProgress(null)
    }
  }
  return { file, run, isWorking: progress !== null, progress, errorKey: error?.file === file ? error.key : null }
}

function ConversionStatus({ conversion }: { conversion: ReturnType<typeof usePdfConversion> }) {
  const { t } = useT()
  const { progress } = conversion
  return (
    <>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.pages', { done: progress.done, total: progress.total }) : t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={conversion.errorKey ? t(conversion.errorKey) : ''} />
    </>
  )
}

// ---------------------------------------------------------------- Word to PDF

// The Word file's pages as the Word viewer shows them (Word's page size; a page longer than that, as in a file without Word's
// page-end marks, is cut between lines). An .odt file is one flowing A4-wide page, cut the same way.
async function wordPagePictures(file: File, onProgress: (done: number, total: number) => void) {
  const { insertDocumentHtml, isOpenDocumentFile, prepareOpenDocument, renderWordPages } = await import('../../formats/word/wordDocument')
  const holder = makeOffscreenHolder()
  const styleHolder = document.createElement('div')
  let adoptedSheets: CSSStyleSheet[] = []
  try {
    const contents = await file.arrayBuffer()
    if (isOpenDocumentFile(file.name)) {
      const page = document.createElement('div')
      page.className = 'odt-page'
      page.dir = 'auto'
      page.style.cssText = 'box-sizing:border-box;width:794px;padding:72px;background:#fff;color:#111;font:15px/1.5 "Liberation Serif","Times New Roman","IBM Plex Sans Arabic",serif'
      holder.append(page)
      insertDocumentHtml(page, (await prepareOpenDocument(contents)).html)
    } else adoptedSheets = (await renderWordPages(contents, holder, styleHolder)).adoptedSheets
    await document.fonts.ready
    await Promise.all(Array.from(holder.querySelectorAll('img'), (image) => image.decode().catch(() => undefined)))
    const pageElements = Array.from(holder.querySelectorAll<HTMLElement>('section.docx, .odt-page'))
    const pictures: PagePicture[] = []
    for (const [position, pageElement] of pageElements.entries()) {
      onProgress(position, pageElements.length)
      await nextFrame()
      const width = pageElement.offsetWidth
      // Word's page height is the section's minimum height (docx-preview gives it in points; the computed value is in pixels); an
      // .odt page is A4-shaped.
      const pageHeight = parseFloat(getComputedStyle(pageElement).minHeight) || Math.round((width * 297) / 210)
      // A page longer than the page size continues on further pages, each with the document's own top and bottom margins.
      const pageStyle = getComputedStyle(pageElement)
      const [topMargin, bottomMargin] = [parseFloat(pageStyle.paddingTop) || 0, parseFloat(pageStyle.paddingBottom) || 0]
      const words = measureWords(pageElement)
      // A page that fits stays whole, footer and all.
      const cuts = pageElement.getBoundingClientRect().height <= pageHeight + 1 ? [0, pageElement.getBoundingClientRect().height] : findPageCuts(pageElement, pageHeight - topMargin - bottomMargin, words, pageHeight - bottomMargin)
      for (let part = 0; part < cuts.length - 1; part++) {
        pictures.push(await drawPagePart(pageElement, { x: 0, y: cuts[part], width, height: cuts[part + 1] - cuts[part] }, [width, pageHeight], { x: 0, y: part === 0 ? 0 : topMargin }, words, pictures.length))
      }
    }
    return pictures
  } finally {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => !adoptedSheets.includes(sheet))
    for (const image of holder.querySelectorAll('img')) if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src)
    holder.remove()
  }
}

export function WordToPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const conversion = usePdfConversion({ files, onResult })
  return (
    <div id="word-to-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.officePdf.wordHint')}</p>
      <p className="text-center font-medium">
        <bdi>{conversion.file.name}</bdi>
      </p>
      <div className="flex justify-center">
        <button id="word-to-pdf-button" type="button" disabled={conversion.isWorking} onClick={() => void conversion.run((onProgress) => wordPagePictures(conversion.file, onProgress))} className="btn btn--primary press">
          {conversion.isWorking ? t('tools.working') : t('tools.officePdf.button')}
        </button>
      </div>
      <ConversionStatus conversion={conversion} />
    </div>
  )
}

// ---------------------------------------------------------------- Excel to PDF

const RIGHT_TO_LEFT_LETTER = /[֐-׿؀-ۿݐ-ݿיִ-﷿ﹰ-﻿]/
const DEFAULT_COLUMN_WIDTH_PX = 64
const DEFAULT_ROW_HEIGHT_PX = 20

// The workbook read by the Excel viewer's own worker (excelParse.worker.ts), started here rather than through ExcelViewer.tsx so the
// viewer and its styles are not loaded with this page.
function readWorkbookFileInWorker(contents: ArrayBuffer, fileName: string) {
  return new Promise<import('../../formats/excel/excelModel').ParsedWorkbook>((resolve, reject) => {
    const worker = new Worker(new URL('../../formats/excel/excelParse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<import('../../formats/excel/excelParse.worker').ExcelParseMessage>) => {
      worker.terminate()
      if (event.data.status === 'ok') resolve(event.data.parsed)
      else reject(new Error(event.data.reason))
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('The workbook could not be read'))
    }
    worker.postMessage({ contents, fileName } satisfies import('../../formats/excel/excelParse.worker').ExcelParseRequest)
  })
}

type SheetOptions = { isFirstSheetOnly: boolean; pageSize: PageSizeName; orientation: Orientation; hasGridlines: boolean }

// A sheet's used range as a table, as the Excel viewer shows it: the cells' shown text, merges, hidden rows and columns left out,
// column widths and row heights from the file, and the file's styles where they were read (.xlsx and .xlsm).
async function buildSheetTable(sheet: import('../../formats/excel/excelModel').OriginalSheet, styles: Map<string, import('../../formats/excel/excelEdits').CellStyle> | undefined, hasGridlines: boolean) {
  const { cellKey, cssForStyle, formatCellText } = await import('../../formats/excel/excelModel')
  const { worksheet } = sheet
  const columnInfo = (worksheet['!cols'] ?? []) as XLSX.ColInfo[]
  const rowInfo = (worksheet['!rows'] ?? []) as XLSX.RowInfo[]
  const shownColumns = Array.from({ length: sheet.columnCount }, (_, column) => column).filter((column) => !columnInfo[column]?.hidden)
  const shownRows = Array.from({ length: sheet.rowCount }, (_, row) => row).filter((row) => !rowInfo[row]?.hidden)
  const mergeAt = new Map(sheet.merges.map((merge) => [cellKey(merge.rowIds[0], merge.columnIds[0]), merge]))
  const table = document.createElement('table')
  table.style.cssText = 'border-collapse:collapse;table-layout:fixed;font:14px Calibri,Carlito,Arial,"IBM Plex Sans Arabic",sans-serif;color:#000;background:#fff'
  const columnGroup = document.createElement('colgroup')
  for (const column of shownColumns) {
    const columnElement = document.createElement('col')
    const info = columnInfo[column]
    columnElement.style.width = `${info?.wpx ?? (info?.wch ? info.wch * 7 + 5 : DEFAULT_COLUMN_WIDTH_PX)}px`
    columnGroup.append(columnElement)
  }
  table.append(columnGroup)
  let rightToLeftCount = 0
  let leftToRightCount = 0
  for (const row of shownRows) {
    const rowElement = document.createElement('tr')
    rowElement.style.height = `${rowInfo[row]?.hpx ?? DEFAULT_ROW_HEIGHT_PX}px`
    for (const column of shownColumns) {
      const key = cellKey(row, column)
      if (sheet.coveredKeys.has(key)) continue
      const cellElement = document.createElement('td')
      const text = formatCellText(worksheet[`${encodeColumn(column)}${row + 1}`] as XLSX.CellObject | undefined)
      cellElement.textContent = text
      if (RIGHT_TO_LEFT_LETTER.test(text)) rightToLeftCount++
      else if (/[A-Za-z]/.test(text)) leftToRightCount++
      const merge = mergeAt.get(key)
      if (merge) {
        cellElement.colSpan = merge.columnIds.filter((mergedColumn) => shownColumns.includes(mergedColumn)).length
        cellElement.rowSpan = merge.rowIds.filter((mergedRow) => shownRows.includes(mergedRow)).length
      }
      cellElement.style.cssText = `padding:1px 4px;white-space:nowrap;overflow:hidden;vertical-align:bottom;${hasGridlines ? 'border:1px solid #d4d4d4;' : ''}`
      const cellStyle = cssForStyle(styles?.get(key))
      if (cellStyle) Object.assign(cellElement.style, cellStyle)
      rowElement.append(cellElement)
    }
    table.append(rowElement)
  }
  if (rightToLeftCount > leftToRightCount) table.dir = 'rtl'
  return table
}
const encodeColumn = (column: number): string => (column < 26 ? String.fromCharCode(65 + column) : encodeColumn(Math.floor(column / 26) - 1) + String.fromCharCode(65 + (column % 26)))

// Each sheet on its own pages: scaled down to fit the page width (to half size at most), then cut between rows down the pages and,
// when still too wide, between columns across them.
async function excelPagePictures(file: File, options: SheetOptions, onProgress: (done: number, total: number) => void) {
  const { MAX_STYLED_FILE_BYTES, readWorkbookStyles } = await import('../../formats/excel/excelStyles')
  const contents = await file.arrayBuffer()
  const parsed = await readWorkbookFileInWorker(contents.slice(0), file.name)
  const sheets = parsed.sheets.map((sheet, sheetIndex) => ({ sheet, sheetIndex })).filter(({ sheet }) => sheet.visibility === 'visible' && sheet.rowCount > 0)
  const chosenSheets = options.isFirstSheetOnly ? sheets.slice(0, 1) : sheets
  const hasStyles = (parsed.bookType === 'xlsx' || parsed.bookType === 'xlsm') && contents.byteLength <= MAX_STYLED_FILE_BYTES
  const styles = hasStyles ? await readWorkbookStyles(contents, parsed.sheets.map((sheet) => sheet.name)).catch(() => null) : null
  const holder = makeOffscreenHolder()
  const pictures: PagePicture[] = []
  try {
    for (const [position, { sheet, sheetIndex }] of chosenSheets.entries()) {
      onProgress(position, chosenSheets.length)
      await nextFrame()
      const block = document.createElement('div')
      block.style.cssText = 'display:inline-block;background:#fff'
      if (chosenSheets.length > 1) {
        const title = document.createElement('div')
        title.textContent = sheet.name
        title.dir = 'auto'
        title.style.cssText = 'font:600 13px Arial,"IBM Plex Sans Arabic",sans-serif;color:#444;padding:0 0 6px'
        block.append(title)
      }
      const table = await buildSheetTable(sheet, styles?.get(sheetIndex), options.hasGridlines)
      block.append(table)
      holder.replaceChildren(block)
      const [shortSide, longSide] = PAGE_SIZES_PX[options.pageSize]
      const naturalWidth = block.offsetWidth
      const isLandscape = options.orientation === 'landscape' || (options.orientation === 'auto' && naturalWidth > shortSide - 2 * SHEET_MARGIN_PX)
      const pageSize: [number, number] = isLandscape ? [longSide, shortSide] : [shortSide, longSide]
      const printable = { width: pageSize[0] - 2 * SHEET_MARGIN_PX, height: pageSize[1] - 2 * SHEET_MARGIN_PX }
      const scale = Math.max(SMALLEST_SHEET_SCALE, Math.min(1, printable.width / naturalWidth))
      // Cuts are measured in the sheet's own pixels: a page holds the printable area divided by the scale.
      const words = measureWords(block)
      const rowCuts = findPageCuts(block, printable.height / scale, words)
      // Columns too wide even at the smallest scale go onto further pages, cut at column edges.
      const blockLeft = block.getBoundingClientRect().left
      const columnEdges = Array.from(table.rows[0]?.cells ?? [], (cell) => cell.getBoundingClientRect().right - blockLeft)
      const columnCuts = [0]
      while (naturalWidth - columnCuts.at(-1)! > printable.width / scale + 1) {
        const limit = columnCuts.at(-1)! + printable.width / scale
        columnCuts.push(columnEdges.filter((edge) => edge <= limit && edge > columnCuts.at(-1)!).at(-1) ?? limit)
      }
      columnCuts.push(naturalWidth)
      for (let rowPart = 0; rowPart < rowCuts.length - 1; rowPart++) {
        for (let columnPart = 0; columnPart < columnCuts.length - 1; columnPart++) {
          const region = { x: columnCuts[columnPart], y: rowCuts[rowPart], width: columnCuts[columnPart + 1] - columnCuts[columnPart], height: rowCuts[rowPart + 1] - rowCuts[rowPart] }
          // A right-to-left sheet sits against the page's right margin.
          const offsetX = table.dir === 'rtl' ? pageSize[0] - SHEET_MARGIN_PX - region.width * scale : SHEET_MARGIN_PX
          pictures.push(await drawPagePart(block, region, pageSize, { x: offsetX, y: SHEET_MARGIN_PX }, words, pictures.length, scale))
        }
      }
    }
    return pictures
  } finally {
    holder.remove()
  }
}

export function ExcelToPdf({ files, onResult }: ToolProps) {
  const { t } = useT()
  const conversion = usePdfConversion({ files, onResult })
  const [options, setOptions] = useState<SheetOptions>({ isFirstSheetOnly: false, pageSize: 'a4', orientation: 'auto', hasGridlines: true })
  return (
    <div id="excel-to-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.officePdf.excelHint')}</p>
      <p className="text-center font-medium">
        <bdi>{conversion.file.name}</bdi>
      </p>
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.officePdf.sheets')}
          <select id="excel-to-pdf-sheets-select" value={options.isFirstSheetOnly ? 'first' : 'all'} onChange={(event) => setOptions({ ...options, isFirstSheetOnly: event.target.value === 'first' })} className={fieldClass}>
            <option value="all">{t('tools.officePdf.allSheets')}</option>
            <option value="first">{t('tools.officePdf.firstSheet')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.images.pageSize')}
          <select id="excel-to-pdf-page-size-select" value={options.pageSize} onChange={(event) => setOptions({ ...options, pageSize: event.target.value as PageSizeName })} className={fieldClass}>
            <option value="a4">{t('tools.images.sizeA4')}</option>
            <option value="letter">{t('tools.images.sizeLetter')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.images.orientation')}
          <select id="excel-to-pdf-orientation-select" value={options.orientation} onChange={(event) => setOptions({ ...options, orientation: event.target.value as Orientation })} className={fieldClass}>
            <option value="auto">{t('tools.images.orientationAuto')}</option>
            <option value="portrait">{t('tools.images.orientationPortrait')}</option>
            <option value="landscape">{t('tools.images.orientationLandscape')}</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="excel-to-pdf-gridlines-checkbox" type="checkbox" checked={options.hasGridlines} onChange={(event) => setOptions({ ...options, hasGridlines: event.target.checked })} className="size-5" />
          {t('tools.officePdf.gridlines')}
        </label>
      </div>
      <div className="flex justify-center">
        <button id="excel-to-pdf-button" type="button" disabled={conversion.isWorking} onClick={() => void conversion.run((onProgress) => excelPagePictures(conversion.file, options, onProgress))} className="btn btn--primary press">
          {conversion.isWorking ? t('tools.working') : t('tools.officePdf.button')}
        </button>
      </div>
      <ConversionStatus conversion={conversion} />
    </div>
  )
}
