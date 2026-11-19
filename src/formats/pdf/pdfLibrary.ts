// pdf.js (pdfjs-dist, Apache-2.0), loaded on first use and shared by the PDF viewer and the PDF tools (thumbnails, pages as
// pictures, text, embedded images). Its worker parses the file; the worker is bundled by Vite (not copied) so vite.config.ts can
// fix how it orders Arabic ligatures.
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?worker&url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { reorderRightToLeftTextOf } from './pdfTextOrder'

// pdf.js reads these (same origin) only when a PDF needs them: CJK character maps, the 14 standard fonts, image decoders and
// colour profiles. The build copies them to dist/pdfjs/ (scripts/build-static-pages.mjs); in development they come from node_modules.
export const PDFJS_DATA_ROOT = import.meta.env.DEV ? '/node_modules/pdfjs-dist/' : '/pdfjs/'

let pdfCorePromise: Promise<typeof import('pdfjs-dist')> | null = null

// The viewer components (pdf_viewer.mjs) read the core from globalThis.pdfjsLib, so the core publishes itself there.
export function loadPdfCore() {
  pdfCorePromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    ;(globalThis as { pdfjsLib?: unknown }).pdfjsLib = pdfjs
    return pdfjs
  })
  return pdfCorePromise
}

export async function loadPdfLibrary() {
  const pdfjs = await loadPdfCore()
  const viewer = await import('pdfjs-dist/web/pdf_viewer.mjs')
  return { pdfjs, viewer }
}

// Loads the library (core and viewer components) and starts the worker once, so their scripts are cached and a PDF opens without the
// network later.
export async function warmUpPdfWorker() {
  const { pdfjs } = await loadPdfLibrary()
  const worker = new pdfjs.PDFWorker()
  await worker.promise
  worker.destroy()
}

// pdf.js moves the bytes it is given to its worker, so it always gets a copy: the chosen file stays whole.
export function pdfDocumentOptions(fileContents: ArrayBuffer) {
  return {
    data: new Uint8Array(fileContents.slice(0)),
    enableXfa: false,
    cMapUrl: `${PDFJS_DATA_ROOT}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_DATA_ROOT}standard_fonts/`,
    wasmUrl: `${PDFJS_DATA_ROOT}wasm/`,
    iccUrl: `${PDFJS_DATA_ROOT}iccs/`,
  }
}

export class PdfPasswordError extends Error {}

// Opens a PDF for reading without a password prompt (the tools): a password-protected PDF is refused with PdfPasswordError.
export async function openPdfForReading(fileContents: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfCore()
  const loadingTask = pdfjs.getDocument(pdfDocumentOptions(fileContents))
  let needsPassword = false
  loadingTask.onPassword = () => {
    needsPassword = true
    void loadingTask.destroy()
  }
  try {
    const pdfDocument = await loadingTask.promise
    reorderRightToLeftTextOf(await pdfDocument.getPage(1))
    return pdfDocument
  } catch (error) {
    throw needsPassword ? new PdfPasswordError('password') : error
  }
}
