// The PDF tools' work runs in pdfTools.worker.ts (pdf-lib, MIT, and fflate, MIT), so a large PDF never freezes the page. One worker
// per task, started here from the tool components, never from a module the worker imports.

// A page of an output PDF: a page of one of the source PDFs, turned by `rotation` degrees (a multiple of 90) on top of its own
// rotation, or a blank page of the given size in points.
export type OutputPage = { sourceIndex: number; pageIndex: number; rotation: number } | { blankSize: [number, number] }
export type OutputDocument = { name: string; pages: OutputPage[] }
export type PageSize = 'fit' | 'a4' | 'letter'
export type PageOrientation = 'auto' | 'portrait' | 'landscape'
// A picture ready to embed: JPEG or PNG bytes (every other format is turned into one of them first, on the page).
export type EmbeddableImage = { name: string; kind: 'jpg' | 'png'; bytes: ArrayBuffer; width: number; height: number }
// A box on a page as it is shown (turned by the page's own rotation, inside its crop box), in points from the top-left corner.
// pdf.js's viewport at scale 1 measures pages the same way.
export type PageBox = { x: number; y: number; width: number; height: number }
// A PNG drawn upright on a page as shown (text drawn by the browser, a signature, a picture); `imageIndex` points into the
// request's `images`, so a picture used on many pages is stored once.
export type PageStamp = { pageIndex: number; imageIndex: number; box: PageBox; opacity?: number }
// A shape drawn with pdf-lib. A line or arrow goes from the box's top-left corner to its opposite corner (width and height may be
// negative). Colours are RGB from 0 to 1.
export type PageShape = { pageIndex: number; kind: 'rectangle' | 'ellipse' | 'line' | 'arrow'; box: PageBox; color: [number, number, number]; thickness: number; fill: [number, number, number] | null }

export type PdfTaskRequest =
  | { type: 'warm-up' }
  | { type: 'count-pages'; pdf: ArrayBuffer }
  // Stamps and shapes on the pages of one PDF; `removeFormFields` takes every form field out (a flattened form: its values are
  // among the stamps).
  | { type: 'stamp-pdf'; pdf: ArrayBuffer; images: ArrayBuffer[]; stamps: PageStamp[]; shapes?: PageShape[]; removeFormFields?: boolean }
  | { type: 'build-pdf'; sources: ArrayBuffer[]; pages: OutputPage[] }
  | { type: 'build-pdfs'; sources: ArrayBuffer[]; documents: OutputDocument[] }
  | { type: 'images-to-pdf'; images: EmbeddableImage[]; pageSize: PageSize; orientation: PageOrientation; marginPoints: number; isOnePdfPerImage: boolean; pdfName: string }
  | { type: 'zip'; files: { name: string; bytes: ArrayBuffer }[] }

// `pdf`: one PDF; `zip`: several files in a ZIP. `encrypted`: a PDF needs a password to open; `unreadable`: anything else.
export type PdfTaskResponse = { status: 'ok'; pageCount?: number; pdf?: Uint8Array; zip?: Uint8Array } | { status: 'error'; reason: 'encrypted' | 'unreadable' }
export type PdfTaskProgress = { status: 'progress'; done: number; total: number }

export function runPdfTask(request: PdfTaskRequest, onProgress?: (done: number, total: number) => void) {
  const worker = new Worker(new URL('./pdfTools.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<PdfTaskResponse>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<PdfTaskResponse | PdfTaskProgress>) => {
      if (event.data.status === 'progress') onProgress?.(event.data.done, event.data.total)
      else resolve(event.data)
    }
    worker.onerror = () => reject(new Error('PDF worker failed'))
    worker.postMessage(request)
  }).finally(() => worker.terminate())
}
