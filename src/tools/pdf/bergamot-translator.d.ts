// @browsermt/bergamot-translator ships without types; only what TranslatePdf (PdfToOffice.tsx) uses is declared.
declare module '@browsermt/bergamot-translator/translator.js' {
  type TranslatorOptions = { registryUrl: string; pivotLanguage: string | null; workers?: number; downloadTimeout?: number }
  export class TranslatorBacking {
    constructor(options: TranslatorOptions)
    fetch(url: string, checksum?: string, extra?: { signal?: AbortSignal }): Promise<ArrayBuffer>
  }
  export class BatchTranslator {
    constructor(options: TranslatorOptions, backing?: TranslatorBacking)
    translate(request: { from: string; to: string; text: string; html: boolean }): Promise<{ target: { text: string } }>
    delete(): Promise<void>
  }
}
