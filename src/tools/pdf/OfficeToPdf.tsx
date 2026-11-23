/* oxlint-disable react/only-export-components */
// Office files to PDF and to JPG: Word, Excel, CSV and PowerPoint files, and documents made from Markdown, HTML or text
// (TextToDocument.tsx), are rendered off screen the way the site's viewers show them (docx-preview for Word, a table for Excel and
// CSV, the PowerPoint viewer's renderer for slides), each page is drawn as a picture by modern-screenshot (as slides are,
// slideCanvas.ts), and the words' places on the page are measured in the DOM to lay an invisible text layer over the picture, so
// the PDF's text can still be selected, searched and copied. The PDF is put together in pdfTools.worker.ts (`picture-pages`); the
// JPG pages are the same pictures.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type * as XLSX from 'xlsx'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import { readImageAsDataUrl } from '../../formats/powerpoint/slideCanvas'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { LayerWord, PagePicture } from './pdfTasks'
import { ProgressBar, baseNameOf, pdfResultFile, zipResultFile } from './PdfToolParts'

type Region = { x: number; y: number; width: number; height: number }
export type PageSizeName = 'a4' | 'letter'
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
    // A word belongs to the part its centre is in: a large heading's glyph box reaches a little above its line, past the part's top.
    .filter((word) => {
      const [centerX, centerY] = [word.box.x + word.box.width / 2, word.box.y + word.box.height / 2]
      return centerX >= region.x && centerX < region.x + region.width && centerY >= region.y && centerY < region.y + region.height
    })
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

type PictureOutput = 'pdf' | 'jpg'

// The page pictures as one PDF, each with its invisible text layer.
export async function picturesToPdfFile(pictures: PagePicture[], fileName: string) {
  const response = await runPdfTask({ type: 'picture-pages', pdf: null, pageCount: pictures.length, pictures })
  if (response.status !== 'ok' || !response.pdf) throw new Error('The PDF could not be made')
  return pdfResultFile(response.pdf, fileName)
}

// Running a conversion with progress, an error line and the result handed to the page: one PDF, or the pages as JPG pictures (one
// picture as it is, several in a ZIP).
function usePictureConversion({ files, onResult }: Pick<ToolProps, 'files' | 'onResult'>, output: PictureOutput, pictureName: 'page' | 'slide') {
  const file = files[0]
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<{ file: File; key: MessageKey } | null>(null)
  async function run(makePictures: (onProgress: (done: number, total: number) => void) => Promise<PagePicture[]>) {
    setError(null)
    setProgress({ done: 0, total: 0 })
    try {
      const pictures = await makePictures((done, total) => setProgress({ done, total }))
      if (pictures.length === 0) throw new Error('Nothing to convert')
      const baseName = baseNameOf(file.name)
      if (output === 'pdf') onResult(await picturesToPdfFile(pictures, `${baseName}.pdf`))
      else if (pictures.length === 1) onResult(new File([pictures[0].jpg], `${baseName}.jpg`, { type: 'image/jpeg' }))
      else {
        const digits = Math.max(2, String(pictures.length).length)
        const zipFiles = pictures.map((picture, index) => ({ name: `${baseName}-${pictureName}-${String(index + 1).padStart(digits, '0')}.jpg`, bytes: picture.jpg }))
        const response = await runPdfTask({ type: 'zip', files: zipFiles })
        if (response.status !== 'ok' || !response.zip) throw new Error('The ZIP could not be made')
        onResult(zipResultFile(response.zip, `${baseName}-jpg.zip`))
      }
    } catch {
      setError({ file, key: 'tools.officePdf.failed' })
    } finally {
      setProgress(null)
    }
  }
  return { file, run, isWorking: progress !== null, progress, errorKey: error?.file === file ? error.key : null }
}

// The layout every converter shares: a hint, the file's name, its options, the button, progress and errors.
function ConverterLayout({ toolId, hintKey, output, conversion, canRun = true, onRun, children }: { toolId: string; hintKey: MessageKey; output: PictureOutput; conversion: ReturnType<typeof usePictureConversion>; canRun?: boolean; onRun: () => void; children?: ReactNode }) {
  const { t } = useT()
  const { progress } = conversion
  return (
    <div id={`${toolId}-tool`} className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t(hintKey)}</p>
      <p className="text-center font-medium">
        <bdi>{conversion.file.name}</bdi>
      </p>
      {children && <div className="flex flex-wrap items-end justify-center gap-4 text-start">{children}</div>}
      <div className="flex justify-center">
        <button id={`${toolId}-button`} type="button" disabled={conversion.isWorking || !canRun} onClick={onRun} className="btn btn--primary press">
          {conversion.isWorking ? t('tools.working') : t(output === 'pdf' ? 'tools.officePdf.button' : 'tools.officePdf.jpgButton')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={progress.total > 0 ? t('tools.progress.pages', { done: progress.done, total: progress.total }) : t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={conversion.errorKey ? t(conversion.errorKey) : ''} />
    </div>
  )
}

export function PageSizeSelect({ id, value, onChange }: { id: string; value: PageSizeName; onChange: (value: PageSizeName) => void }) {
  const { t } = useT()
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {t('tools.images.pageSize')}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as PageSizeName)} className={fieldClass}>
        <option value="a4">{t('tools.images.sizeA4')}</option>
        <option value="letter">{t('tools.images.sizeLetter')}</option>
      </select>
    </label>
  )
}

function TableLayoutFields({ idPrefix, layout, onChange }: { idPrefix: string; layout: TableLayout; onChange: (layout: TableLayout) => void }) {
  const { t } = useT()
  return (
    <>
      <PageSizeSelect id={`${idPrefix}-page-size-select`} value={layout.pageSize} onChange={(pageSize) => onChange({ ...layout, pageSize })} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('tools.images.orientation')}
        <select id={`${idPrefix}-orientation-select`} value={layout.orientation} onChange={(event) => onChange({ ...layout, orientation: event.target.value as Orientation })} className={fieldClass}>
          <option value="auto">{t('tools.images.orientationAuto')}</option>
          <option value="portrait">{t('tools.images.orientationPortrait')}</option>
          <option value="landscape">{t('tools.images.orientationLandscape')}</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input id={`${idPrefix}-gridlines-checkbox`} type="checkbox" checked={layout.hasGridlines} onChange={(event) => onChange({ ...layout, hasGridlines: event.target.checked })} className="size-5" />
        {t('tools.officePdf.gridlines')}
      </label>
    </>
  )
}

// ---------------------------------------------------------------- Flowing text (Markdown, HTML, text) on pages

const DOCUMENT_MARGIN_PX = 72

// A document element (made from Markdown, HTML or text) laid out at the page's printable width and cut between lines onto pages.
export async function flowingPagePictures(documentElement: HTMLElement, pageSize: PageSizeName, onProgress: (done: number, total: number) => void) {
  const [pageWidth, pageHeight] = PAGE_SIZES_PX[pageSize]
  const holder = makeOffscreenHolder()
  documentElement.style.width = `${pageWidth - 2 * DOCUMENT_MARGIN_PX}px`
  holder.append(documentElement)
  try {
    await document.fonts.ready
    await Promise.all(Array.from(holder.querySelectorAll('img'), (image) => image.decode().catch(() => undefined)))
    const words = measureWords(documentElement)
    const cuts = findPageCuts(documentElement, pageHeight - 2 * DOCUMENT_MARGIN_PX, words)
    const pictures: PagePicture[] = []
    for (let part = 0; part < cuts.length - 1; part++) {
      onProgress(part, cuts.length - 1)
      await nextFrame()
      const region = { x: 0, y: cuts[part], width: documentElement.offsetWidth, height: cuts[part + 1] - cuts[part] }
      pictures.push(await drawPagePart(documentElement, region, [pageWidth, pageHeight], { x: DOCUMENT_MARGIN_PX, y: DOCUMENT_MARGIN_PX }, words, part))
    }
    return pictures
  } finally {
    holder.remove()
  }
}

// ---------------------------------------------------------------- Word to PDF and to JPG

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

function WordConverter({ files, onResult, output }: ToolProps & { output: PictureOutput }) {
  const conversion = usePictureConversion({ files, onResult }, output, 'page')
  return <ConverterLayout toolId={`word-to-${output}`} hintKey={output === 'pdf' ? 'tools.officePdf.wordHint' : 'tools.officePdf.wordJpgHint'} output={output} conversion={conversion} onRun={() => void conversion.run((onProgress) => wordPagePictures(conversion.file, onProgress))} />
}

export const WordToPdf = (props: ToolProps) => <WordConverter {...props} output="pdf" />
export const WordToJpg = (props: ToolProps) => <WordConverter {...props} output="jpg" />

// ---------------------------------------------------------------- Tables on pages (Excel and CSV)

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

type TableLayout = { pageSize: PageSizeName; orientation: Orientation; hasGridlines: boolean }
type ParsedWorkbook = import('../../formats/excel/excelModel').ParsedWorkbook

const TABLE_STYLE = 'border-collapse:collapse;table-layout:fixed;font:14px Calibri,Carlito,Arial,"IBM Plex Sans Arabic",sans-serif;color:#000;background:#fff'
const cellStyleText = (hasGridlines: boolean) => `padding:1px 4px;white-space:nowrap;overflow:hidden;vertical-align:bottom;${hasGridlines ? 'border:1px solid #d4d4d4;' : ''}`

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
  table.style.cssText = TABLE_STYLE
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
      cellElement.style.cssText = cellStyleText(hasGridlines)
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

// A table (in `block`, already in the holder) on pages: scaled down to fit the page width (to half size at most), then cut between
// rows down the pages and, when still too wide, between columns across them.
async function addTablePages(block: HTMLElement, table: HTMLTableElement, layout: TableLayout, pictures: PagePicture[]) {
  const [shortSide, longSide] = PAGE_SIZES_PX[layout.pageSize]
  const naturalWidth = block.offsetWidth
  const isLandscape = layout.orientation === 'landscape' || (layout.orientation === 'auto' && naturalWidth > shortSide - 2 * SHEET_MARGIN_PX)
  const pageSize: [number, number] = isLandscape ? [longSide, shortSide] : [shortSide, longSide]
  const printable = { width: pageSize[0] - 2 * SHEET_MARGIN_PX, height: pageSize[1] - 2 * SHEET_MARGIN_PX }
  const scale = Math.max(SMALLEST_SHEET_SCALE, Math.min(1, printable.width / naturalWidth))
  // Cuts are measured in the table's own pixels: a page holds the printable area divided by the scale.
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
      // A right-to-left table sits against the page's right margin.
      const offsetX = table.dir === 'rtl' ? pageSize[0] - SHEET_MARGIN_PX - region.width * scale : SHEET_MARGIN_PX
      pictures.push(await drawPagePart(block, region, pageSize, { x: offsetX, y: SHEET_MARGIN_PX }, words, pictures.length, scale))
    }
  }
}

// Each chosen sheet on its own pages; `sheetChoice` is 'all' or a sheet's index.
async function excelPagePictures(contents: ArrayBuffer, parsed: ParsedWorkbook, sheetChoice: 'all' | number, layout: TableLayout, onProgress: (done: number, total: number) => void) {
  const { MAX_STYLED_FILE_BYTES, readWorkbookStyles } = await import('../../formats/excel/excelStyles')
  const chosenSheets = parsed.sheets.map((sheet, sheetIndex) => ({ sheet, sheetIndex })).filter(({ sheet, sheetIndex }) => sheet.visibility === 'visible' && sheet.rowCount > 0 && (sheetChoice === 'all' || sheetChoice === sheetIndex))
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
      const table = await buildSheetTable(sheet, styles?.get(sheetIndex), layout.hasGridlines)
      block.append(table)
      holder.replaceChildren(block)
      await addTablePages(block, table, layout, pictures)
    }
    return pictures
  } finally {
    holder.remove()
  }
}

// The workbook is read once the file is chosen, so its sheets can be offered by name.
function ExcelConverter({ files, onResult, output }: ToolProps & { output: PictureOutput }) {
  const { t } = useT()
  const conversion = usePictureConversion({ files, onResult }, output, 'page')
  const toolId = `excel-to-${output}`
  const [workbook, setWorkbook] = useState<{ file: File; contents: ArrayBuffer; parsed: ParsedWorkbook | null } | null>(null)
  const [sheetChoice, setSheetChoice] = useState<'all' | number>('all')
  const [layout, setLayout] = useState<TableLayout>({ pageSize: 'a4', orientation: 'auto', hasGridlines: true })
  const chosenFile = conversion.file
  useEffect(() => {
    let isCurrent = true
    void chosenFile.arrayBuffer().then(async (contents) => {
      const parsed = await readWorkbookFileInWorker(contents.slice(0), chosenFile.name).catch(() => null)
      if (!isCurrent) return
      setWorkbook({ file: chosenFile, contents, parsed })
      setSheetChoice('all')
    })
    return () => {
      isCurrent = false
    }
  }, [chosenFile])
  const readWorkbook = workbook?.file === chosenFile ? workbook : null
  const visibleSheets = (readWorkbook?.parsed?.sheets ?? []).map((sheet, sheetIndex) => ({ sheet, sheetIndex })).filter(({ sheet }) => sheet.visibility === 'visible' && sheet.rowCount > 0)
  return (
    <ConverterLayout
      toolId={toolId}
      hintKey={output === 'pdf' ? 'tools.officePdf.excelHint' : 'tools.officePdf.excelJpgHint'}
      output={output}
      conversion={conversion}
      canRun={readWorkbook !== null}
      onRun={() => {
        if (!readWorkbook?.parsed) return void conversion.run(() => Promise.reject(new Error('The workbook could not be read')))
        const { contents, parsed } = readWorkbook
        void conversion.run((onProgress) => excelPagePictures(contents, parsed, sheetChoice, layout, onProgress))
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('tools.officePdf.sheets')}
        <select id={`${toolId}-sheets-select`} value={String(sheetChoice)} onChange={(event) => setSheetChoice(event.target.value === 'all' ? 'all' : Number(event.target.value))} className={fieldClass}>
          <option value="all">{t('tools.officePdf.allSheets')}</option>
          {visibleSheets.map(({ sheet, sheetIndex }) => (
            <option key={sheetIndex} value={sheetIndex}>
              {sheet.name}
            </option>
          ))}
        </select>
      </label>
      <TableLayoutFields idPrefix={toolId} layout={layout} onChange={setLayout} />
    </ConverterLayout>
  )
}

export const ExcelToPdf = (props: ToolProps) => <ExcelConverter {...props} output="pdf" />
export const ExcelToJpg = (props: ToolProps) => <ExcelConverter {...props} output="jpg" />

// A CSV file as one table, its first row as the header.
async function csvPagePictures(file: File, layout: TableLayout, onProgress: (done: number, total: number) => void) {
  const { default: Papa } = await import('papaparse')
  const rows = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' }).data
  onProgress(0, 1)
  const table = document.createElement('table')
  table.style.cssText = TABLE_STYLE
  let rightToLeftCount = 0
  let leftToRightCount = 0
  for (const [rowIndex, row] of rows.entries()) {
    const rowElement = document.createElement('tr')
    for (const text of row) {
      const cellElement = document.createElement(rowIndex === 0 ? 'th' : 'td')
      cellElement.textContent = text
      cellElement.style.cssText = cellStyleText(layout.hasGridlines) + (rowIndex === 0 ? 'font-weight:700;background:#f3f3f3;text-align:start;' : '')
      if (RIGHT_TO_LEFT_LETTER.test(text)) rightToLeftCount++
      else if (/[A-Za-z]/.test(text)) leftToRightCount++
      rowElement.append(cellElement)
    }
    table.append(rowElement)
  }
  if (rightToLeftCount > leftToRightCount) table.dir = 'rtl'
  const block = document.createElement('div')
  block.style.cssText = 'display:inline-block;background:#fff'
  block.append(table)
  const holder = makeOffscreenHolder()
  holder.append(block)
  const pictures: PagePicture[] = []
  try {
    await addTablePages(block, table, layout, pictures)
    return pictures
  } finally {
    holder.remove()
  }
}

export function CsvToPdf({ files, onResult }: ToolProps) {
  const conversion = usePictureConversion({ files, onResult }, 'pdf', 'page')
  const [layout, setLayout] = useState<TableLayout>({ pageSize: 'a4', orientation: 'auto', hasGridlines: true })
  return (
    <ConverterLayout toolId="csv-to-pdf" hintKey="tools.officePdf.csvHint" output="pdf" conversion={conversion} onRun={() => void conversion.run((onProgress) => csvPagePictures(conversion.file, layout, onProgress))}>
      <TableLayoutFields idPrefix="csv-to-pdf" layout={layout} onChange={setLayout} />
    </ConverterLayout>
  )
}

// ---------------------------------------------------------------- PowerPoint to PDF and to JPG

// Each slide rendered at its own size by the PowerPoint viewer's renderer, one page (or picture) per slide, with its words.
async function slidePagePictures(file: File, onProgress: (done: number, total: number) => void) {
  const [{ PptxViewer }, { routeStyleAttributesThroughCssom }] = await Promise.all([import('@aiden0z/pptx-renderer'), import('../../formats/powerpoint/slideCanvas')])
  routeStyleAttributesThroughCssom()
  const stage = makeOffscreenHolder()
  const viewer = await PptxViewer.open(await file.arrayBuffer(), stage, { renderMode: 'slide', lazySlides: true, lazyMedia: true, pdfjs: false, externalMedia: 'block' })
  const holder = makeOffscreenHolder()
  const pictures: PagePicture[] = []
  try {
    const slideSize: [number, number] = [viewer.slideWidth, viewer.slideHeight]
    holder.style.width = `${slideSize[0]}px`
    holder.style.height = `${slideSize[1]}px`
    holder.style.overflow = 'hidden'
    for (let slideIndex = 0; slideIndex < viewer.slideCount; slideIndex++) {
      onProgress(slideIndex, viewer.slideCount)
      const handle = viewer.renderSlideToContainer(slideIndex, holder, 1)
      if (!handle) throw new Error(`Slide ${slideIndex + 1} could not be rendered`)
      try {
        await handle.ready
        await Promise.all(Array.from(holder.querySelectorAll('img'), (image) => image.decode().catch(() => undefined)))
        const words = measureWords(handle.element)
        pictures.push(await drawPagePart(handle.element, { x: 0, y: 0, width: slideSize[0], height: slideSize[1] }, slideSize, { x: 0, y: 0 }, words, slideIndex))
      } finally {
        handle.dispose()
      }
    }
    return pictures
  } finally {
    viewer.destroy()
    stage.remove()
    holder.remove()
  }
}

function SlidesConverter({ files, onResult, output }: ToolProps & { output: PictureOutput }) {
  const conversion = usePictureConversion({ files, onResult }, output, 'slide')
  return <ConverterLayout toolId={`pptx-to-${output}`} hintKey={output === 'pdf' ? 'tools.officePdf.slidesHint' : 'tools.officePdf.slidesJpgHint'} output={output} conversion={conversion} onRun={() => void conversion.run((onProgress) => slidePagePictures(conversion.file, onProgress))} />
}

export const PptxToPdf = (props: ToolProps) => <SlidesConverter {...props} output="pdf" />
export const PptxToJpg = (props: ToolProps) => <SlidesConverter {...props} output="jpg" />
