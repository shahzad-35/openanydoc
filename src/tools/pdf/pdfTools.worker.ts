import { zipSync } from 'fflate'
import { EncryptedPDFError, PDFDocument, degrees, rgb } from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'
import type { OutputPage, PageOrientation, PageShape, PageSize, PdfTaskProgress, PdfTaskRequest, PdfTaskResponse } from './pdfTasks'

const ARROW_HEAD_LENGTH = 12
const PAGE_SIZES_IN_POINTS: Record<Exclude<PageSize, 'fit'>, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }
// A picture's own size becomes the page size at 96 pixels per inch (72 points per inch).
const POINTS_PER_PIXEL = 72 / 96

function reportProgress(done: number, total: number) {
  postMessage({ status: 'progress', done, total } satisfies PdfTaskProgress)
}

// One output PDF from pages of the sources. Each source's pages are copied in one call (its fonts and pictures are copied once),
// a page used twice is copied twice, and each page's turn is added to the rotation it already has.
async function buildPdf(sources: PDFDocument[], pages: OutputPage[]) {
  const output = await PDFDocument.create()
  const copiedPagesBySource = new Map<number, Awaited<ReturnType<PDFDocument['copyPages']>>>()
  for (const [sourceIndex, source] of sources.entries()) {
    const pageIndexes = pages.flatMap((page) => ('sourceIndex' in page && page.sourceIndex === sourceIndex ? [page.pageIndex] : []))
    if (pageIndexes.length) copiedPagesBySource.set(sourceIndex, await output.copyPages(source, pageIndexes))
  }
  for (const page of pages) {
    if ('blankSize' in page) {
      output.addPage(page.blankSize)
      continue
    }
    const copiedPage = copiedPagesBySource.get(page.sourceIndex)!.shift()!
    copiedPage.setRotation(degrees((((copiedPage.getRotation().angle + page.rotation) % 360) + 360) % 360))
    output.addPage(copiedPage)
  }
  return output.save()
}

// "Fit" makes the page the picture's own size plus the margin; A4 and Letter keep their size, turned to suit the picture.
function imagePageSize(image: { width: number; height: number }, pageSize: PageSize, orientation: PageOrientation, marginPoints: number): [number, number] {
  if (pageSize === 'fit') return [image.width * POINTS_PER_PIXEL + 2 * marginPoints, image.height * POINTS_PER_PIXEL + 2 * marginPoints]
  const [shortSide, longSide] = PAGE_SIZES_IN_POINTS[pageSize]
  const isLandscape = orientation === 'landscape' || (orientation === 'auto' && image.width > image.height)
  return isLandscape ? [longSide, shortSide] : [shortSide, longSide]
}

// A point on a page as it is shown (from its top-left corner, after the page's rotation, inside its crop box) in the page's own
// PDF coordinates. pdf.js shows /Rotate clockwise: at 90 the crop box's bottom-left corner is the top-left corner on screen.
function shownPointToPdf(page: PDFPage, shownX: number, shownY: number) {
  const { x: left, y: bottom, width, height } = page.getCropBox()
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270
  if (rotation === 90) return { x: left + shownY, y: bottom + shownX }
  if (rotation === 180) return { x: left + width - shownX, y: bottom + shownY }
  if (rotation === 270) return { x: left + width - shownY, y: bottom + height - shownX }
  return { x: left + shownX, y: bottom + height - shownY }
}

function drawShape(page: PDFPage, shape: PageShape) {
  const rotate = degrees(page.getRotation().angle)
  const color = rgb(...shape.color)
  const { x, y, width, height } = shape.box
  if (shape.kind === 'rectangle' || shape.kind === 'ellipse') {
    // Drawn upright as shown: anchored at its bottom-left corner on screen and turned with the page.
    const fill = shape.fill ? rgb(...shape.fill) : undefined
    if (shape.kind === 'rectangle') {
      page.drawRectangle({ ...shownPointToPdf(page, x, y + height), width, height, rotate, borderColor: color, borderWidth: shape.thickness, color: fill })
    } else {
      const isTurnedSideways = page.getRotation().angle % 180 !== 0
      page.drawEllipse({ ...shownPointToPdf(page, x + width / 2, y + height / 2), xScale: (isTurnedSideways ? height : width) / 2, yScale: (isTurnedSideways ? width : height) / 2, borderColor: color, borderWidth: shape.thickness, color: fill })
    }
    return
  }
  const line = (fromX: number, fromY: number, toX: number, toY: number) =>
    page.drawLine({ start: shownPointToPdf(page, fromX, fromY), end: shownPointToPdf(page, toX, toY), thickness: shape.thickness, color, lineCap: 1 })
  line(x, y, x + width, y + height)
  if (shape.kind !== 'arrow') return
  const angle = Math.atan2(height, width)
  for (const side of [-1, 1]) {
    const headAngle = angle + Math.PI + (side * Math.PI) / 7
    line(x + width, y + height, x + width + ARROW_HEAD_LENGTH * Math.cos(headAngle), y + height + ARROW_HEAD_LENGTH * Math.sin(headAngle))
  }
}

async function runTask(request: PdfTaskRequest): Promise<PdfTaskResponse> {
  if (request.type === 'warm-up') return { status: 'ok' }
  if (request.type === 'count-pages') return { status: 'ok', pageCount: (await PDFDocument.load(request.pdf)).getPageCount() }
  if (request.type === 'build-pdf') {
    const sources = await Promise.all(request.sources.map((sourceBytes) => PDFDocument.load(sourceBytes)))
    return { status: 'ok', pdf: await buildPdf(sources, request.pages) }
  }
  if (request.type === 'build-pdfs') {
    const sources = await Promise.all(request.sources.map((sourceBytes) => PDFDocument.load(sourceBytes)))
    const zipEntries: Record<string, Uint8Array> = {}
    for (const [position, outputDocument] of request.documents.entries()) {
      zipEntries[outputDocument.name] = await buildPdf(sources, outputDocument.pages)
      reportProgress(position + 1, request.documents.length)
    }
    // PDFs are compressed inside already; storing them keeps the ZIP quick to make.
    return { status: 'ok', zip: zipSync(zipEntries, { level: 0 }) }
  }
  if (request.type === 'images-to-pdf') {
    const documents: { name: string; pdf: PDFDocument }[] = []
    let currentPdf: PDFDocument | null = null
    for (const [position, image] of request.images.entries()) {
      if (!currentPdf || request.isOnePdfPerImage) {
        currentPdf = await PDFDocument.create()
        documents.push({ name: request.isOnePdfPerImage ? `${image.name.replace(/\.[^.]+$/, '')}.pdf` : request.pdfName, pdf: currentPdf })
      }
      const embeddedImage = image.kind === 'jpg' ? await currentPdf.embedJpg(image.bytes) : await currentPdf.embedPng(image.bytes)
      const page = currentPdf.addPage(imagePageSize(image, request.pageSize, request.orientation, request.marginPoints))
      // The picture fills the room inside the margin, centred, keeping its proportions.
      const room = { width: page.getWidth() - 2 * request.marginPoints, height: page.getHeight() - 2 * request.marginPoints }
      const scale = Math.min(room.width / image.width, room.height / image.height)
      const drawn = { width: image.width * scale, height: image.height * scale }
      page.drawImage(embeddedImage, { x: (page.getWidth() - drawn.width) / 2, y: (page.getHeight() - drawn.height) / 2, ...drawn })
      reportProgress(position + 1, request.images.length)
    }
    if (documents.length === 1) return { status: 'ok', pdf: await documents[0].pdf.save() }
    const zipEntries: Record<string, Uint8Array> = {}
    for (const document of documents) zipEntries[document.name] = await document.pdf.save()
    return { status: 'ok', zip: zipSync(zipEntries, { level: 0 }) }
  }
  if (request.type === 'zip') {
    return { status: 'ok', zip: zipSync(Object.fromEntries(request.files.map((file) => [file.name, new Uint8Array(file.bytes)])), { level: 0 }) }
  }
  const pdf = await PDFDocument.load(request.pdf)
  if (request.removeFormFields) {
    const form = pdf.getForm()
    for (const field of form.getFields()) form.removeField(field)
  }
  const images = await Promise.all(request.images.map((imageBytes) => pdf.embedPng(imageBytes)))
  const pages = pdf.getPages()
  for (const [position, stamp] of request.stamps.entries()) {
    const page = pages[stamp.pageIndex]
    const { x, y, width, height } = stamp.box
    // The picture stands upright on screen: anchored at its bottom-left corner as shown, and turned with the page.
    page.drawImage(images[stamp.imageIndex], { ...shownPointToPdf(page, x, y + height), width, height, rotate: degrees(page.getRotation().angle), opacity: stamp.opacity ?? 1 })
    if (position % 25 === 24) reportProgress(position + 1, request.stamps.length)
  }
  for (const shape of request.shapes ?? []) drawShape(pages[shape.pageIndex], shape)
  return { status: 'ok', pdf: await pdf.save() }
}

self.onmessage = async (event: MessageEvent<PdfTaskRequest>) => {
  let response: PdfTaskResponse
  try {
    response = await runTask(event.data)
  } catch (error) {
    response = { status: 'error', reason: error instanceof EncryptedPDFError ? 'encrypted' : 'unreadable' }
  }
  postMessage(response)
}
