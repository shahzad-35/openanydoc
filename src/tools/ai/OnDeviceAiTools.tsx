import { useEffect, useRef, useState } from 'react'
import ModalDialog, { CONTROL_CLASSES } from '../../components/ModalDialog'
import type { ControlLook } from '../../components/ModalDialog'
import { Notice } from '../../components/Messages'
import { translate, useT } from '../../i18n'
import { ProgressBar } from '../pdf/PdfToolParts'
import type { ToolProps } from '../registry'
import { readFileAsText } from './AiReadyTools'
import TextResultPanel from './TextResultPanel'
import {
  DIRECT_AI_LANGUAGES,
  RIGHT_TO_LEFT_LANGUAGES,
  TRANSLATOR_LANGUAGES,
  createChatSession,
  createSummarizer,
  createTranslator,
  detectDocumentLanguage,
  downloadModelsFirst,
  isClickNeededError,
  summarizeLongText,
  translateLongText,
  useOnDeviceAiSupport,
} from './onDeviceAi'
import type { OnDeviceChatSession, SummaryType } from './onDeviceAi'

// The on-device AI pages (/ai-summarizer, /translate-document, /chat-with-pdf) and the Summarise / Translate dialog of the PDF,
// Word and PowerPoint viewers. Everything runs on Chrome's built-in AI in this tab; where the browser hasn't got it, the page says
// so and offers nothing else (no upload fallback).

type Progress = { label: string; done: number; total: number }
const baseNameOf = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

class LanguageNotSupportedError extends Error {
  language: string
  constructor(language: string) {
    super(`No on-device model for ${language}`)
    this.language = language
  }
}

function failureMessage(error: unknown, t: ReturnType<typeof useT>['t'], languageName: (code: string) => string) {
  if (error instanceof LanguageNotSupportedError) return t('onDeviceAi.languageNotSupported', { language: languageName(error.language) })
  return isClickNeededError(error) ? t('onDeviceAi.clickAgain') : t('onDeviceAi.failed')
}

function useLanguageName() {
  const { locale } = useT()
  const names = new Intl.DisplayNames([locale], { type: 'language' })
  return (code: string) => names.of(code) ?? code
}

// The file's text, the way the AI-ready pages read it; '' when it has none (a scanned PDF), null while reading.
// The effect depends on the file and locale only: useT's `t` is a new function on every render, and with it here each
// progress update re-read the file, endlessly, until Chrome ran out of memory.
function useDocumentText(file: File | undefined) {
  const { locale } = useT()
  const [result, setResult] = useState<{ file: File; text: string } | { file: File; failed: true } | null>(null)
  useEffect(() => {
    if (!file) return
    let isCurrent = true
    const labels = { slide: translate(locale, 'powerpoint.export.slideLabel'), notes: translate(locale, 'powerpoint.notes.label'), sheet: translate(locale, 'aiReady.sheet') }
    readFileAsText(file, labels, locale)
      .then((text) => isCurrent && setResult({ file, text }))
      .catch(() => isCurrent && setResult({ file, failed: true }))
    return () => {
      isCurrent = false
    }
  }, [file, locale])
  return result?.file === file ? result : null
}

// The message instead of a feature this browser can't run, or the reading problems of the file; null when all is well.
function DocumentProblem({ idPrefix, support, documentText }: { idPrefix: string; support: string | null; documentText: ReturnType<typeof useDocumentText> }) {
  const { t } = useT()
  if (support === 'unavailable') return <Notice id={`${idPrefix}-unavailable`} kind="info" role="status" className="text-center font-medium" message={t('onDeviceAi.unavailable')} />
  if (documentText && 'failed' in documentText) return <p id={`${idPrefix}-error`} role="alert" className="text-center font-medium text-danger">{t('aiReady.unreadable')}</p>
  if (documentText && documentText.text.trim() === '') return <p id={`${idPrefix}-empty`} role="status" className="text-center font-medium">{t('aiReady.noText')}</p>
  return null
}

// ---------------------------------------------------------------- summarise

function SummarizePanel({ file, idPrefix, look = 'page' }: { file: File | undefined; idPrefix: string; look?: ControlLook }) {
  const classes = CONTROL_CLASSES[look]
  const { t } = useT()
  const languageName = useLanguageName()
  const support = useOnDeviceAiSupport('summarizer')
  const documentText = useDocumentText(file)
  const [summaryType, setSummaryType] = useState<SummaryType>('key-points')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [summary, setSummary] = useState<{ text: string; translatedFrom: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const problem = <DocumentProblem idPrefix={idPrefix} support={support} documentText={documentText} />
  if (support === 'unavailable' || (documentText && ('failed' in documentText || documentText.text.trim() === ''))) return problem
  const text = documentText && !('failed' in documentText) ? documentText.text : ''

  async function summarize() {
    setSummary(null)
    setErrorMessage('')
    const showDownload = (share: number) => setProgress({ label: t('onDeviceAi.downloading'), done: Math.round(share * 100), total: 100 })
    try {
      await downloadModelsFirst([{ api: 'LanguageDetector' }, { api: 'Summarizer', options: { expectedInputLanguages: ['en'], outputLanguage: 'en' } }], showDownload)
      const detected = await detectDocumentLanguage(text)
      const language = detected === 'und' ? 'en' : detected.split('-')[0]
      const worksDirectly = DIRECT_AI_LANGUAGES.includes(language)
      if (!worksDirectly && !TRANSLATOR_LANGUAGES.includes(language)) throw new LanguageNotSupportedError(language)
      if (!worksDirectly) {
        await downloadModelsFirst(
          [
            { api: 'Translator', options: { sourceLanguage: language, targetLanguage: 'en' } },
            { api: 'Translator', options: { sourceLanguage: 'en', targetLanguage: language } },
          ],
          showDownload,
        )
      }
      let englishText = text
      if (!worksDirectly) {
        const toEnglish = await createTranslator({ sourceLanguage: language, targetLanguage: 'en' }, showDownload)
        if (!toEnglish) throw new LanguageNotSupportedError(language)
        try {
          englishText = await translateLongText(text, toEnglish, (done, total) => setProgress({ label: t('onDeviceAi.translatingToEnglish'), done, total }))
        } finally {
          toEnglish.destroy()
        }
      }
      const summaryLanguage = worksDirectly ? language : 'en'
      const summarizer = await createSummarizer(
        { type: summaryType === 'key-points' ? 'key-points' : 'tldr', length: summaryType === 'tldr' ? 'short' : 'long', format: 'markdown', expectedInputLanguages: [summaryLanguage], outputLanguage: summaryLanguage },
        showDownload,
      )
      let summaryText: string
      try {
        summaryText = await summarizeLongText(englishText, summarizer, (done, total) => setProgress({ label: t('onDeviceAi.summarizing'), done, total }))
      } finally {
        summarizer.destroy()
      }
      if (!worksDirectly) {
        const fromEnglish = await createTranslator({ sourceLanguage: 'en', targetLanguage: language }, showDownload)
        if (!fromEnglish) throw new LanguageNotSupportedError(language)
        try {
          summaryText = await translateLongText(summaryText, fromEnglish, (done, total) => setProgress({ label: t('onDeviceAi.translatingBack'), done, total }))
        } finally {
          fromEnglish.destroy()
        }
      }
      setSummary({ text: summaryText, translatedFrom: worksDirectly ? '' : language })
    } catch (error) {
      setErrorMessage(failureMessage(error, t, languageName))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div id={`${idPrefix}-summarize`} className={classes.box}>
      <p id={`${idPrefix}-promise`} className="text-sm font-semibold text-ink-soft">{t('onDeviceAi.promise')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={`${idPrefix}-summary-type-select`} className={classes.label}>
          {t('onDeviceAi.summaryType')}
          <select id={`${idPrefix}-summary-type-select`} value={summaryType} onChange={(event) => setSummaryType(event.target.value as SummaryType)} className={classes.select}>
            <option value="key-points">{t('onDeviceAi.summaryType.keyPoints')}</option>
            <option value="tldr">{t('onDeviceAi.summaryType.short')}</option>
            <option value="long">{t('onDeviceAi.summaryType.long')}</option>
          </select>
        </label>
        <button id={`${idPrefix}-summarize-button`} type="button" disabled={!text || support === null || progress !== null} onClick={() => void summarize()} className={classes.primaryButton}>
          {t('onDeviceAi.summarize')}
        </button>
      </div>
      {progress && <ProgressBar id={`${idPrefix}-progress`} done={progress.done} total={progress.total} label={progress.label} />}
      {errorMessage && <p id={`${idPrefix}-failed`} role="alert" className="text-sm text-danger">{errorMessage}</p>}
      {summary && (
        <>
          {summary.translatedFrom && <p id={`${idPrefix}-through-translation`} className="text-sm text-ink-soft">{t('onDeviceAi.throughTranslation', { language: languageName(summary.translatedFrom) })}</p>}
          <TextResultPanel
            id={`${idPrefix}-summary-result`}
            look={look}
            label={t('onDeviceAi.summaryResult')}
            text={summary.text}
            downloads={[
              { id: 'md', label: '.md', fileName: `${baseNameOf(file?.name ?? 'summary')}-summary.md`, text: summary.text, mimeType: 'text/markdown;charset=utf-8' },
              { id: 'txt', label: '.txt', fileName: `${baseNameOf(file?.name ?? 'summary')}-summary.txt`, text: summary.text, mimeType: 'text/plain;charset=utf-8' },
            ]}
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- translate

async function writeTextAsDocx(text: string, isRightToLeft: boolean) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const paragraphs = text.split('\n').map((line) => new Paragraph({ bidirectional: isRightToLeft, children: [new TextRun({ text: line, rightToLeft: isRightToLeft })] }))
  return Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }))
}

// A detected language as one of the Translator's codes ("pt-BR" → "pt"); English when the Translator hasn't got it.
const translatorLanguageOf = (detected: string) => (TRANSLATOR_LANGUAGES.includes(detected) ? detected : TRANSLATOR_LANGUAGES.includes(detected.split('-')[0]) ? detected.split('-')[0] : 'en')

function TranslatePanel({ file, idPrefix, look = 'page' }: { file: File | undefined; idPrefix: string; look?: ControlLook }) {
  const classes = CONTROL_CLASSES[look]
  const { locale, t } = useT()
  const languageName = useLanguageName()
  const support = useOnDeviceAiSupport('translator')
  const documentText = useDocumentText(file)
  const text = documentText && !('failed' in documentText) ? documentText.text : ''
  const [sourceLanguage, setSourceLanguage] = useState('auto')
  const [targetLanguage, setTargetLanguage] = useState(locale === 'ar' ? 'ar' : 'en')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [translation, setTranslation] = useState<{ text: string; language: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // The language is filled in on open when the detector is already on the device; otherwise "Detect language" stays chosen and
  // the detection runs on the Translate click (a first download needs a click).
  useEffect(() => {
    if (!text || support !== 'available') return
    let isCurrent = true
    detectDocumentLanguage(text)
      .then((detected) => {
        if (!isCurrent) return
        const language = translatorLanguageOf(detected)
        setSourceLanguage(language)
        setTargetLanguage((current) => (current === language ? (language === 'en' ? 'ar' : 'en') : current))
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [text, support])

  const problem = <DocumentProblem idPrefix={idPrefix} support={support} documentText={documentText} />
  if (support === 'unavailable' || (documentText && ('failed' in documentText || text.trim() === ''))) return problem

  async function translate() {
    setTranslation(null)
    setErrorMessage('')
    const showDownload = (share: number) => setProgress({ label: t('onDeviceAi.downloading'), done: Math.round(share * 100), total: 100 })
    try {
      let fromLanguage = sourceLanguage
      if (fromLanguage === 'auto') {
        await downloadModelsFirst([{ api: 'LanguageDetector' }], showDownload)
        fromLanguage = translatorLanguageOf(await detectDocumentLanguage(text))
        setSourceLanguage(fromLanguage)
      }
      const translator = fromLanguage === targetLanguage ? null : await createTranslator({ sourceLanguage: fromLanguage, targetLanguage }, showDownload)
      if (!translator) {
        setErrorMessage(t('onDeviceAi.pairUnavailable', { from: languageName(fromLanguage), to: languageName(targetLanguage) }))
        return
      }
      try {
        const translatedText = await translateLongText(text, translator, (done, total) => setProgress({ label: t('onDeviceAi.translating'), done, total }))
        setTranslation({ text: translatedText, language: targetLanguage })
      } finally {
        translator.destroy()
      }
    } catch (error) {
      setErrorMessage(failureMessage(error, t, languageName))
    } finally {
      setProgress(null)
    }
  }

  async function downloadDocx() {
    if (!translation) return
    const { downloadTextFile } = await import('../../formats/registry')
    downloadTextFile(`${baseNameOf(file?.name ?? 'translation')}-${translation.language}.docx`, await writeTextAsDocx(translation.text, RIGHT_TO_LEFT_LANGUAGES.includes(translation.language)), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }

  const languageOptions = [...TRANSLATOR_LANGUAGES].sort((first, second) => languageName(first).localeCompare(languageName(second), locale))
  const fileBaseName = baseNameOf(file?.name ?? 'translation')
  return (
    <div id={`${idPrefix}-translate`} className={classes.box}>
      <p id={`${idPrefix}-promise`} className="text-sm font-semibold text-ink-soft">{t('onDeviceAi.promise')}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label htmlFor={`${idPrefix}-from-select`} className={classes.label}>
          {t('onDeviceAi.from')}
          <select id={`${idPrefix}-from-select`} value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} className={classes.select}>
            <option value="auto">{t('onDeviceAi.detectLanguage')}</option>
            {languageOptions.map((code) => (
              <option key={code} value={code}>{languageName(code)}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${idPrefix}-to-select`} className={classes.label}>
          {t('onDeviceAi.to')}
          <select id={`${idPrefix}-to-select`} value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className={classes.select}>
            {languageOptions.map((code) => (
              <option key={code} value={code}>{languageName(code)}</option>
            ))}
          </select>
        </label>
        <button id={`${idPrefix}-translate-button`} type="button" disabled={!text || sourceLanguage === targetLanguage || progress !== null} onClick={() => void translate()} className={classes.primaryButton}>
          {t('onDeviceAi.translate')}
        </button>
      </div>
      {progress && <ProgressBar id={`${idPrefix}-progress`} done={progress.done} total={progress.total} label={progress.label} />}
      {errorMessage && <p id={`${idPrefix}-failed`} role="alert" className="text-sm text-danger">{errorMessage}</p>}
      {translation && (
        <>
          <TextResultPanel
            id={`${idPrefix}-translation-result`}
            look={look}
            label={t('onDeviceAi.translationResult', { language: languageName(translation.language) })}
            text={translation.text}
            downloads={[
              { id: 'txt', label: '.txt', fileName: `${fileBaseName}-${translation.language}.txt`, text: translation.text, mimeType: 'text/plain;charset=utf-8' },
              { id: 'md', label: '.md', fileName: `${fileBaseName}-${translation.language}.md`, text: translation.text, mimeType: 'text/markdown;charset=utf-8' },
            ]}
          />
          <button id={`${idPrefix}-download-docx-button`} type="button" onClick={() => void downloadDocx()} className={classes.secondaryButton}>
            {t('aiReady.download', { format: '.docx' })}
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the tool pages

export function AiSummarizer({ files }: ToolProps) {
  return <SummarizePanel file={files.at(-1)} idPrefix="ai-summarizer" />
}

export function TranslateDocument({ files }: ToolProps) {
  return <TranslatePanel file={files.at(-1)} idPrefix="translate-document" />
}

// ---------------------------------------------------------------- chat with a PDF

// The on-device model reads only a few thousand words at once. A document within this many characters goes into one chat whole
// (follow-up questions work); a longer one is searched for each question, and the paragraphs sharing the most words with it go
// into a fresh chat.
const WHOLE_DOCUMENT_CHARACTERS = 12_000

function selectRelevantParagraphs(text: string, question: string) {
  const questionWords = new Set(question.toLowerCase().split(/\W+/).filter((word) => word.length > 3))
  const paragraphs = text.split(/\n{2,}/).map((paragraph, position) => ({ paragraph, position, score: paragraph.toLowerCase().split(/\W+/).filter((word) => questionWords.has(word)).length }))
  const chosen: typeof paragraphs = []
  let length = 0
  for (const candidate of [...paragraphs].sort((first, second) => second.score - first.score)) {
    if (length + candidate.paragraph.length > WHOLE_DOCUMENT_CHARACTERS) continue
    chosen.push(candidate)
    length += candidate.paragraph.length
  }
  return chosen.sort((first, second) => first.position - second.position).map((candidate) => candidate.paragraph).join('\n\n')
}

type ChatMessage = { id: number; role: 'question' | 'answer'; text: string }

export function ChatWithPdf({ files }: ToolProps) {
  const { t } = useT()
  const languageName = useLanguageName()
  const file = files.at(-1)
  const support = useOnDeviceAiSupport('chat')
  const documentText = useDocumentText(file)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [documentLanguage, setDocumentLanguage] = useState('')
  // The English text the model reads (the document itself, or its translation), the whole-document chat, and the translators
  // for a document in another language; kept for the follow-up questions about the same file.
  const preparedRef = useRef<{ file: File; englishText: string; language: string; session: OnDeviceChatSession | null } | null>(null)

  useEffect(() => {
    return () => preparedRef.current?.session?.destroy()
  }, [file])

  const text = documentText && !('failed' in documentText) ? documentText.text : ''
  if (support === 'unavailable' || (documentText && ('failed' in documentText || text.trim() === ''))) return <DocumentProblem idPrefix="chat-with-pdf" support={support} documentText={documentText} />

  const showDownload = (share: number) => setProgress({ label: t('onDeviceAi.downloading'), done: Math.round(share * 100), total: 100 })

  async function prepareDocument() {
    const alreadyPrepared = preparedRef.current
    if (alreadyPrepared && alreadyPrepared.file === file) return alreadyPrepared
    await downloadModelsFirst([{ api: 'LanguageDetector' }, { api: 'LanguageModel', options: { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] } }], showDownload)
    const detected = await detectDocumentLanguage(text)
    const language = detected === 'und' ? 'en' : detected.split('-')[0]
    let englishText = text
    if (language !== 'en') {
      if (!TRANSLATOR_LANGUAGES.includes(language)) throw new LanguageNotSupportedError(language)
      await downloadModelsFirst(
        [
          { api: 'Translator', options: { sourceLanguage: language, targetLanguage: 'en' } },
          { api: 'Translator', options: { sourceLanguage: 'en', targetLanguage: language } },
        ],
        showDownload,
      )
      const toEnglish = await createTranslator({ sourceLanguage: language, targetLanguage: 'en' }, showDownload)
      if (!toEnglish) throw new LanguageNotSupportedError(language)
      try {
        englishText = await translateLongText(text, toEnglish, (done, total) => setProgress({ label: t('onDeviceAi.translatingToEnglish'), done, total }))
      } finally {
        toEnglish.destroy()
      }
    }
    setDocumentLanguage(language)
    const prepared: { file: File; englishText: string; language: string; session: OnDeviceChatSession | null } = { file: file as File, englishText, language, session: null }
    preparedRef.current = prepared
    return prepared
  }

  async function ask() {
    const askedQuestion = question.trim()
    if (!askedQuestion) return
    setQuestion('')
    setErrorMessage('')
    setMessages((current) => [...current, { id: current.length, role: 'question', text: askedQuestion }])
    try {
      setProgress({ label: t('onDeviceAi.chat.preparing'), done: 0, total: 0 })
      const prepared = await prepareDocument()
      let englishQuestion = askedQuestion
      if (prepared.language !== 'en') {
        const toEnglish = await createTranslator({ sourceLanguage: prepared.language, targetLanguage: 'en' }, showDownload)
        englishQuestion = toEnglish ? await toEnglish.translate(askedQuestion) : askedQuestion
        toEnglish?.destroy()
      }
      const fitsWhole = prepared.englishText.length <= WHOLE_DOCUMENT_CHARACTERS
      if (fitsWhole && !prepared.session) prepared.session = await createChatSession(prepared.englishText, showDownload)
      const session = fitsWhole && prepared.session ? prepared.session : await createChatSession(selectRelevantParagraphs(prepared.englishText, englishQuestion), showDownload)
      setProgress({ label: t('onDeviceAi.chat.thinking'), done: 0, total: 0 })
      let answer = ''
      const answerId = Date.now()
      try {
        for await (const piece of session.promptStreaming(englishQuestion)) {
          answer += piece
          setMessages((current) => [...current.filter((message) => message.id !== answerId), { id: answerId, role: 'answer', text: answer }])
        }
      } finally {
        if (session !== prepared.session) session.destroy()
      }
      if (prepared.language !== 'en' && answer) {
        const fromEnglish = await createTranslator({ sourceLanguage: 'en', targetLanguage: prepared.language }, showDownload)
        const translatedAnswer = fromEnglish ? await translateLongText(answer, fromEnglish, () => {}) : answer
        fromEnglish?.destroy()
        setMessages((current) => current.map((message) => (message.id === answerId ? { ...message, text: translatedAnswer } : message)))
      }
    } catch (error) {
      setErrorMessage(failureMessage(error, t, languageName))
      // Asked for one more click: the question goes back into the box (the log's last message) so the same click resends it.
      if (isClickNeededError(error)) {
        setQuestion(askedQuestion)
        setMessages((current) => current.slice(0, -1))
      }
    } finally {
      setProgress(null)
    }
  }

  function clearChat() {
    preparedRef.current?.session?.destroy()
    if (preparedRef.current) preparedRef.current.session = null
    setMessages([])
    setErrorMessage('')
  }

  return (
    <div id="chat-with-pdf-tool" className={CONTROL_CLASSES.page.box}>
      <p id="chat-with-pdf-promise" className="text-sm font-semibold text-ink-soft">{t('onDeviceAi.promise')}</p>
      <p id="chat-with-pdf-note" className="text-sm text-ink-soft">{t('onDeviceAi.chat.note')}</p>
      {documentLanguage && documentLanguage !== 'en' && <p id="chat-with-pdf-through-translation" className="text-sm text-ink-soft">{t('onDeviceAi.chat.throughTranslation', { language: languageName(documentLanguage) })}</p>}
      <ol id="chat-with-pdf-log" aria-live="polite" className="space-y-3">
        {messages.map((message) => (
          <li key={message.id} id={`chat-message-${message.id}`} dir="auto" className={`rounded-[14px] border-2 border-rule p-3 text-[15px] whitespace-pre-wrap ${message.role === 'question' ? 'bg-surface' : 'bg-paper-raised'}`}>
            <span className="block text-xs font-semibold text-ink-soft">{message.role === 'question' ? t('onDeviceAi.chat.you') : t('onDeviceAi.chat.answer')}</span>
            {message.text}
          </li>
        ))}
      </ol>
      {progress && <ProgressBar id="chat-with-pdf-progress" done={progress.done} total={progress.total} label={progress.label} />}
      {errorMessage && <p id="chat-with-pdf-failed" role="alert" className="text-sm text-danger">{errorMessage}</p>}
      <form
        id="chat-with-pdf-form"
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void ask()
        }}
      >
        <label htmlFor="chat-with-pdf-question-input" className="sr-only">
          {t('onDeviceAi.chat.question')}
        </label>
        <input id="chat-with-pdf-question-input" dir="auto" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('onDeviceAi.chat.question')} className="min-w-0 flex-1 rounded-[12px] border-2 border-rule bg-paper-raised px-3 py-2 text-[15px] pointer-coarse:min-h-11" />
        <button id="chat-with-pdf-ask-button" type="submit" disabled={!text || support === null || progress !== null || question.trim() === ''} className="btn btn--primary btn--compact press">
          {t('onDeviceAi.chat.ask')}
        </button>
        <button id="chat-with-pdf-clear-button" type="button" disabled={messages.length === 0 || progress !== null} onClick={clearChat} className="btn btn--quiet btn--compact press">
          {t('onDeviceAi.chat.clear')}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------- the viewers' Summarise / Translate dialog

export function OnDeviceAiDialog({ mode, file, idPrefix, onClose }: { mode: 'summarizer' | 'translator'; file: File; idPrefix: string; onClose: () => void }) {
  const { t } = useT()
  // Opened from a viewer's toolbar, so it takes the viewer's own dialog look (title row with its Close button, body).
  return (
    <ModalDialog id={`${idPrefix}-ai-dialog`} title={mode === 'summarizer' ? t('onDeviceAi.dialog.summarizeTitle') : t('onDeviceAi.dialog.translateTitle')} onClose={onClose} inWorkbench>
      <div className="dlg-body">{mode === 'summarizer' ? <SummarizePanel file={file} idPrefix={`${idPrefix}-ai`} look="workbench" /> : <TranslatePanel file={file} idPrefix={`${idPrefix}-ai`} look="workbench" />}</div>
    </ModalDialog>
  )
}
