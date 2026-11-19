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
// A word of the invisible text layer laid over a page picture, so the page's text can still be selected, searched and copied: in
// points from the picture's top-left corner, `baselineY` down to the word's baseline.
export type LayerWord = { text: string; x: number; baselineY: number; width: number; fontSize: number }
// A page replaced by a JPEG picture of it (redacted, cropped with what is outside removed, or rebuilt from a damaged file), the
// size it is shown at in points, and the words of its text layer.
export type PagePicture = { pageIndex: number; jpg: ArrayBuffer; widthPoints: number; heightPoints: number; words: LayerWord[] }

// A fillable field to add (PDF Forms), placed in a box on a page as shown. `options`: a drop-down's choices or a radio group's
// buttons (stacked down the box); `defaultValue`: the starting text, the chosen option, or "checked" for a checkbox.
export type FormFieldKind = 'text' | 'multiline' | 'checkbox' | 'dropdown' | 'radio' | 'date' | 'signature'
export type NewFormField = { kind: FormFieldKind; name: string; pageIndex: number; box: PageBox; isRequired: boolean; defaultValue: string; options: string[] }

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
  // The chosen pages cut to `box`, given as shares (0 to 1) of each page as shown.
  | { type: 'crop-pdf'; pdf: ArrayBuffer; box: PageBox; pageIndexes: number[] }
  // A new PDF: each page is the picture given for it, or else the source's page copied (`pdf` is null when every page is a picture).
  // Built afresh, so nothing of a replaced page stays in the file.
  | { type: 'picture-pages'; pdf: ArrayBuffer | null; pageCount: number; pictures: PagePicture[] }
  | { type: 'add-form-fields'; pdf: ArrayBuffer; fields: NewFormField[] }
  // OCR PDF: the pages stay as they are and the words read from their pictures are laid over them as invisible text.
  | { type: 'text-layer-pdf'; pdf: ArrayBuffer; pages: { pageIndex: number; words: LayerWord[] }[] }
  // qpdf (WebAssembly): AES-256 with a password to open; the permissions password guards the allowed actions.
  | { type: 'protect-pdf'; pdf: ArrayBuffer; userPassword: string; ownerPassword: string; canPrint: boolean; canCopy: boolean; canEdit: boolean }
  // qpdf: the encryption taken off with the password (none needed when only the actions are restricted).
  | { type: 'unlock-pdf'; pdf: ArrayBuffer; password: string }
  // Read leniently by pdf-lib and written again, which rebuilds the cross-reference table.
  | { type: 'repair-pdf'; pdf: ArrayBuffer }

// `pdf`: one PDF; `zip`: several files in a ZIP. `encrypted`: a PDF needs a password to open; `wrong-password`: Unlock PDF's
// password does not open it; `not-encrypted`: Unlock PDF got a PDF with no protection; `unreadable`: anything else.
export type PdfTaskProblem = 'encrypted' | 'unreadable' | 'wrong-password' | 'not-encrypted'
export type PdfTaskResponse = { status: 'ok'; pageCount?: number; pdf?: Uint8Array; zip?: Uint8Array } | { status: 'error'; reason: PdfTaskProblem }
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
