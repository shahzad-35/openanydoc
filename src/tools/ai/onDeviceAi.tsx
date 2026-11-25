// The helpers and the viewers' small button component live together so a viewer loads only this light module.
/* oxlint-disable react/only-export-components */
import { Suspense, lazy, useEffect, useState } from 'react'
import { useT } from '../../i18n'

// Chrome's built-in AI (Summarizer, Translator, LanguageDetector, LanguageModel): the browser runs a model on the device and
// downloads it itself the first time, so nothing is sent anywhere and the page's connect-src stays 'self'. Only desktop Chrome
// with enough memory and disk has them; everywhere else the globals are missing or say 'unavailable', and the features are
// hidden (no server fallback, by design). The globals are not in TypeScript's DOM types yet, hence the small types below.

export type OnDeviceAiSupport = 'available' | 'downloadable' | 'downloading' | 'unavailable'
type DownloadMonitor = { addEventListener: (type: 'downloadprogress', listener: (event: { loaded: number }) => void) => void }
type CreateOptions = { monitor?: (monitor: DownloadMonitor) => void }

export type OnDeviceSummarizer = { summarize: (text: string, options?: { context?: string }) => Promise<string>; measureInputUsage?: (text: string) => Promise<number>; inputQuota?: number; destroy: () => void }
export type OnDeviceTranslator = { translate: (text: string) => Promise<string>; destroy: () => void }
type OnDeviceLanguageDetector = { detect: (text: string) => Promise<{ detectedLanguage: string; confidence: number }[]>; destroy: () => void }
export type OnDeviceChatSession = { promptStreaming: (text: string) => AsyncIterable<string>; contextWindow?: number; measureInputUsage?: (text: string) => Promise<number>; destroy: () => void }

export type SummaryType = 'key-points' | 'tldr' | 'long'
export type SummarizerOptions = { type: 'key-points' | 'tldr'; length: 'short' | 'medium' | 'long'; format: 'markdown' | 'plain-text'; expectedInputLanguages: string[]; outputLanguage: string }
export type TranslatorOptions = { sourceLanguage: string; targetLanguage: string }
type ChatOptions = { initialPrompts: { role: 'system'; content: string }[]; expectedInputs: { type: 'text'; languages: string[] }[]; expectedOutputs: { type: 'text'; languages: string[] }[] }

type BuiltInApi<Options, Instance> = { availability: (options?: Options) => Promise<OnDeviceAiSupport>; create: (options?: Options & CreateOptions) => Promise<Instance> }
const builtInApis = () =>
  globalThis as unknown as {
    Summarizer?: BuiltInApi<Partial<SummarizerOptions>, OnDeviceSummarizer>
    Translator?: BuiltInApi<TranslatorOptions, OnDeviceTranslator>
    LanguageDetector?: BuiltInApi<object, OnDeviceLanguageDetector>
    LanguageModel?: BuiltInApi<Partial<ChatOptions>, OnDeviceChatSession>
  }

// The languages the Summarizer and the Prompt API read and write (Chrome's documentation, checked 2026-11-23). A document in any
// other language is translated to English on the device, worked on, and the result translated back.
export const DIRECT_AI_LANGUAGES = ['en', 'es', 'ja', 'de', 'fr']
// The Translator's languages (the same documentation). Urdu is not among them.
export const TRANSLATOR_LANGUAGES = ['ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh', 'zh-Hant']
export const RIGHT_TO_LEFT_LANGUAGES = ['ar', 'he']

export type OnDeviceFeature = 'summarizer' | 'translator' | 'chat'

async function readOnDeviceAiSupport(feature: OnDeviceFeature): Promise<OnDeviceAiSupport> {
  const apis = builtInApis()
  try {
    if (feature === 'summarizer') return (await apis.Summarizer?.availability({ expectedInputLanguages: ['en'], outputLanguage: 'en' })) ?? 'unavailable'
    if (feature === 'translator') return apis.Translator && apis.LanguageDetector ? 'available' : 'unavailable'
    return (await apis.LanguageModel?.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })) ?? 'unavailable'
  } catch {
    return 'unavailable'
  }
}

// Whether this browser can run a feature, known only after the page has mounted (the prerendered page knows nothing about the
// browser): null until then.
export function useOnDeviceAiSupport(feature: OnDeviceFeature) {
  const [support, setSupport] = useState<OnDeviceAiSupport | null>(null)
  useEffect(() => {
    let isCurrent = true
    void readOnDeviceAiSupport(feature).then((result) => isCurrent && setSupport(result))
    return () => {
      isCurrent = false
    }
  }, [feature])
  return support
}

// `onDownloadProgress` gets 0–1 while the browser downloads the model the first time; nothing is reported when it is already there.
const downloadMonitor = (onDownloadProgress: (share: number) => void) => (monitor: DownloadMonitor) => monitor.addEventListener('downloadprogress', (event) => onDownloadProgress(event.loaded))

// Chrome starts a model download only within a few seconds of a click. Reading and translating a long file outlast that, so a
// task downloads every model it needs at its start, all at once; later create() calls find them on the device and need no click.
// The few that can't be known up front (a translator for the detected language) may still miss the window: then the task stops
// with a NotAllowedError and the page asks for one more click (isClickNeededError).
type ModelToDownload = { api: 'Summarizer' | 'Translator' | 'LanguageDetector' | 'LanguageModel'; options?: object }
export async function downloadModelsFirst(models: ModelToDownload[], onDownloadProgress: (share: number) => void) {
  const apis = builtInApis() as Record<ModelToDownload['api'], BuiltInApi<object, { destroy: () => void }> | undefined>
  // Every download is waited for before a failure is reported: with the first rejection alone, the other models kept downloading
  // and their progress events brought the bar back over the "click once more" message, with the button still disabled.
  const results = await Promise.allSettled(
    models.map(async ({ api, options }) => {
      const builtInApi = apis[api]
      const support = await builtInApi?.availability(options)
      if (builtInApi && (support === 'downloadable' || support === 'downloading')) (await builtInApi.create({ ...options, monitor: downloadMonitor(onDownloadProgress) })).destroy()
    }),
  )
  const failure = results.find((result) => result.status === 'rejected')
  if (failure) throw failure.reason
}

export const isClickNeededError = (error: unknown) => error instanceof DOMException && error.name === 'NotAllowedError'

export async function createSummarizer(options: SummarizerOptions, onDownloadProgress: (share: number) => void) {
  const api = builtInApis().Summarizer
  if (!api) throw new Error('The Summarizer API is not available')
  return api.create({ ...options, monitor: downloadMonitor(onDownloadProgress) })
}

export async function createTranslator(options: TranslatorOptions, onDownloadProgress: (share: number) => void) {
  const api = builtInApis().Translator
  if (!api) throw new Error('The Translator API is not available')
  if ((await api.availability(options)) === 'unavailable') return null
  return api.create({ ...options, monitor: downloadMonitor(onDownloadProgress) })
}

export async function createChatSession(documentText: string, onDownloadProgress: (share: number) => void) {
  const api = builtInApis().LanguageModel
  if (!api) throw new Error('The Prompt API is not available')
  const systemPrompt = `Answer questions about the document below using only what it says. If the answer is not in it, say so. Answer in English, briefly.\n\nDOCUMENT:\n${documentText}`
  return api.create({ initialPrompts: [{ role: 'system', content: systemPrompt }], expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }], monitor: downloadMonitor(onDownloadProgress) })
}

// The language a text is written in (a short code such as "ar"), from its first part; "und" when the detector can't tell.
export async function detectDocumentLanguage(text: string) {
  const api = builtInApis().LanguageDetector
  if (!api) return 'und'
  const detector = await api.create()
  try {
    const [best] = await detector.detect(text.slice(0, 2000))
    return best && best.confidence > 0.5 ? best.detectedLanguage : 'und'
  } finally {
    detector.destroy()
  }
}

// Paragraph by paragraph (the Translator works best on short texts), keeping the blank lines and Markdown marks between them.
export async function translateLongText(text: string, translator: OnDeviceTranslator, onProgress: (done: number, total: number) => void) {
  const paragraphs = text.split(/\n/)
  const translated: string[] = []
  for (const [position, paragraph] of paragraphs.entries()) {
    const leadingMark = /^\s*(#{1,6} |[-*] |\d+\. |\| )?/.exec(paragraph)?.[0] ?? ''
    const body = paragraph.slice(leadingMark.length)
    translated.push(body.trim() === '' ? paragraph : leadingMark + (await translator.translate(body)))
    onProgress(position + 1, paragraphs.length)
  }
  return translated.join('\n')
}

// A text longer than the summarizer takes at once is cut at paragraphs into parts that fit; each part is summarised, then the
// part summaries are summarised together (in parts again if they still don't fit).
export async function summarizeLongText(text: string, summarizer: OnDeviceSummarizer, onProgress: (done: number, total: number) => void): Promise<string> {
  const fitsAtOnce = async (part: string) => !summarizer.measureInputUsage || !summarizer.inputQuota || (await summarizer.measureInputUsage(part)) <= summarizer.inputQuota
  if (await fitsAtOnce(text)) {
    onProgress(1, 1)
    return summarizer.summarize(text)
  }
  // A paragraph too long on its own is cut at sentence ends, and a sentence too long on its own into even slices, so every word is read.
  const piecesThatFit = async (paragraph: string): Promise<string[]> => {
    if (await fitsAtOnce(paragraph)) return [paragraph]
    const sentences = paragraph.split(/(?<=[.!?؟。])\s+/)
    if (sentences.length > 1) {
      const pieces: string[] = []
      for (const sentence of sentences) pieces.push(...(await piecesThatFit(sentence)))
      return pieces
    }
    const sliceCount = Math.ceil((await summarizer.measureInputUsage!(paragraph)) / summarizer.inputQuota!) + 1
    const sliceLength = Math.ceil(paragraph.length / sliceCount)
    return Array.from({ length: sliceCount }, (_, index) => paragraph.slice(index * sliceLength, (index + 1) * sliceLength)).filter(Boolean)
  }
  const parts: string[] = []
  let currentPart = ''
  for (const paragraph of text.split(/\n{2,}/)) {
    for (const piece of await piecesThatFit(paragraph)) {
      const candidate = currentPart ? `${currentPart}\n\n${piece}` : piece
      if (currentPart && !(await fitsAtOnce(candidate))) {
        parts.push(currentPart)
        currentPart = piece
      } else currentPart = candidate
    }
  }
  if (currentPart) parts.push(currentPart)
  const partSummaries: string[] = []
  for (const [position, part] of parts.entries()) {
    partSummaries.push(await summarizer.summarize(part))
    onProgress(position + 1, parts.length + 1)
  }
  const summary = await summarizeLongText(partSummaries.join('\n\n'), summarizer, () => {})
  onProgress(parts.length + 1, parts.length + 1)
  return summary
}

// The Summarise and Translate buttons at the end of the PDF, Word and PowerPoint viewers' toolbars, so nothing moves when they
// appear; hidden where the browser can't run the feature. The dialog and the readers behind it load on the first click.
const OnDeviceAiDialog = lazy(() => import('./OnDeviceAiTools').then((tools) => ({ default: tools.OnDeviceAiDialog })))

export function ViewerAiButtons({ file, idPrefix, isReady }: { file: File; idPrefix: string; isReady: boolean }) {
  const { t } = useT()
  const summarizerSupport = useOnDeviceAiSupport('summarizer')
  const translatorSupport = useOnDeviceAiSupport('translator')
  const [openMode, setOpenMode] = useState<'summarizer' | 'translator' | null>(null)
  const canSummarize = summarizerSupport !== null && summarizerSupport !== 'unavailable'
  const canTranslate = translatorSupport !== null && translatorSupport !== 'unavailable'
  return (
    <>
      {(canSummarize || canTranslate) && <span className="vsep" />}
      {canSummarize && (
        <button id={`${idPrefix}-summarize-button`} type="button" className="tbtn labelled" aria-haspopup="dialog" disabled={!isReady} onClick={() => setOpenMode('summarizer')}>
          {t('onDeviceAi.summarize')}
        </button>
      )}
      {canTranslate && (
        <button id={`${idPrefix}-translate-button`} type="button" className="tbtn labelled" aria-haspopup="dialog" disabled={!isReady} onClick={() => setOpenMode('translator')}>
          {t('onDeviceAi.translate')}
        </button>
      )}
      {openMode && (
        <Suspense fallback={null}>
          <OnDeviceAiDialog mode={openMode} file={file} idPrefix={idPrefix} onClose={() => setOpenMode(null)} />
        </Suspense>
      )}
    </>
  )
}
