import { EncryptedPDFError, PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PdfTaskRequest, PdfTaskResponse } from './pdfTasks'

const PAGE_NUMBER_SIZE = 11
const PAGE_NUMBER_MARGIN = 24

async function runTask(request: PdfTaskRequest): Promise<PdfTaskResponse> {
  if (request.type === 'warm-up') return { status: 'ok' }
  if (request.type === 'count-pages') return { status: 'ok', pageCount: (await PDFDocument.load(request.pdf)).getPageCount() }
  if (request.type === 'merge') {
    const mergedPdf = await PDFDocument.create()
    for (const pdfBytes of request.pdfs) {
      const sourcePdf = await PDFDocument.load(pdfBytes)
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
      for (const page of copiedPages) mergedPdf.addPage(page)
    }
    return { status: 'ok', pdf: await mergedPdf.save() }
  }
  const pdf = await PDFDocument.load(request.pdf)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const [vertical, horizontal] = request.position.split('-')
  pdf.getPages().forEach((page, pageIndex) => {
    const label = String(request.firstNumber + pageIndex)
    const labelWidth = font.widthOfTextAtSize(label, PAGE_NUMBER_SIZE)
    // The visible area of the page, which can start away from 0,0.
    const { x: left, y: bottom, width, height } = page.getCropBox()
    const x = horizontal === 'left' ? left + PAGE_NUMBER_MARGIN : horizontal === 'right' ? left + width - PAGE_NUMBER_MARGIN - labelWidth : left + (width - labelWidth) / 2
    const y = vertical === 'top' ? bottom + height - PAGE_NUMBER_MARGIN - PAGE_NUMBER_SIZE : bottom + PAGE_NUMBER_MARGIN
    page.drawText(label, { x, y, size: PAGE_NUMBER_SIZE, font, color: rgb(0.2, 0.2, 0.2) })
  })
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
