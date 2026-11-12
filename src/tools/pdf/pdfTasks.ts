// The PDF tools' work runs in pdfTools.worker.ts (pdf-lib), so a large PDF never freezes the page. One worker per task, started
// here from the tool components, never from a module the worker imports.

export type PageNumberPosition = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'

export type PdfTaskRequest =
  | { type: 'warm-up' }
  | { type: 'count-pages'; pdf: ArrayBuffer }
  | { type: 'merge'; pdfs: ArrayBuffer[] }
  | { type: 'add-page-numbers'; pdf: ArrayBuffer; position: PageNumberPosition; firstNumber: number }

// `encrypted`: the PDF needs a password to open; `unreadable`: anything else pdf-lib could not read.
export type PdfTaskResponse = { status: 'ok'; pageCount?: number; pdf?: Uint8Array } | { status: 'error'; reason: 'encrypted' | 'unreadable' }

export function runPdfTask(request: PdfTaskRequest) {
  const worker = new Worker(new URL('./pdfTools.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<PdfTaskResponse>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<PdfTaskResponse>) => resolve(event.data)
    worker.onerror = () => reject(new Error('PDF worker failed'))
    worker.postMessage(request)
  }).finally(() => worker.terminate())
}
