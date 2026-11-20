import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { downloadTextFile } from '../../formats/registry'
import { findViewerForFileName } from '../../viewers'
import type { ToolProps } from '../registry'
import TextResultPanel from './TextResultPanel'
import { countCharacters, countTokens, countWords } from './textStats'

// The "AI-ready files" pages: Word and PowerPoint to Markdown (the Word viewer's reading-view HTML and the PowerPoint outline
// export), the token counter and JSON ↔ TOON. Everything is read and counted in this tab; no text is sent to any AI service.

const baseNameOf = (fileName: string) => fileName.replace(/\.[^.]+$/, '')
const boxClasses = 'space-y-4 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start'
const textBoxClasses = 'mt-1 w-full rounded-[14px] border-2 border-rule bg-paper-raised p-3 font-mono text-sm pointer-coarse:text-base'

// Reads the newest chosen file into some text; null while it is read, an error message key when it can't be.
function useFileText(files: File[], readText: (file: File) => Promise<string>) {
  const chosenFile = files.at(-1)
  const [result, setResult] = useState<{ file: File; text: string } | { file: File; failed: true } | null>(null)
  useEffect(() => {
    if (!chosenFile) return
    let isCurrent = true
    readText(chosenFile)
      .then((text) => isCurrent && setResult({ file: chosenFile, text }))
      .catch(() => isCurrent && setResult({ file: chosenFile, failed: true }))
    return () => {
      isCurrent = false
    }
    // readText is a new function on every render; the file itself is what starts this.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenFile])
  return result?.file === chosenFile ? result : null
}

// ---------------------------------------------------------------- Word and PowerPoint to Markdown

// The text of an element with bold, italic and links as Markdown; pictures are left out.
function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element)) return ''
  const text = [...node.childNodes].map(inlineMarkdown).join('')
  const tag = node.tagName.toLowerCase()
  if (tag === 'strong' || tag === 'b') return text.trim() ? `**${text}**` : text
  if (tag === 'em' || tag === 'i') return text.trim() ? `*${text}*` : text
  if (tag === 'a' && node.getAttribute('href') && !node.getAttribute('href')?.startsWith('#')) return `[${text}](${node.getAttribute('href')})`
  if (tag === 'br') return '\n'
  if (tag === 'img') return ''
  return text
}

// A paragraph that starts like Markdown ("1. ", "- ", "# ") keeps that start as text.
const escapeLineStart = (line: string) => line.replace(/^(\d+)\. /, '$1\\. ').replace(/^([-*+#>]) /, '\\$1 ')

function listMarkdown(list: Element, depth: number): string[] {
  return [...list.children].flatMap((item, position) => {
    const marker = list.tagName.toLowerCase() === 'ol' ? `${position + 1}. ` : '- '
    const nestedLists = [...item.children].filter((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase()))
    const itemText = [...item.childNodes].filter((child) => !nestedLists.includes(child as Element)).map(inlineMarkdown).join('').trim()
    return [`${'   '.repeat(depth)}${marker}${itemText}`, ...nestedLists.flatMap((nested) => listMarkdown(nested, depth + 1))]
  })
}

// Word to Markdown: the document is read as HTML (headings, emphasis, lists, links, tables) and written as Markdown here, so a
// table becomes a Markdown table with its first row as the header. Pictures are left out.
async function readWordAsMarkdown(file: File) {
  const [{ readFlowingHtml }, { buildMarkdownTable }] = await Promise.all([import('../../formats/word/wordDocument'), import('../../formats/csv/csvExport')])
  const body = new DOMParser().parseFromString(await readFlowingHtml(file.name, await file.arrayBuffer()), 'text/html').body
  const blocks = [...body.children].map((element) => {
    const tag = element.tagName.toLowerCase()
    const heading = /^h([1-6])$/.exec(tag)
    if (heading) return `${'#'.repeat(Number(heading[1]))} ${inlineMarkdown(element).trim()}`
    if (tag === 'ul' || tag === 'ol') return listMarkdown(element, 0).join('\n')
    if (tag === 'table') {
      const rows = [...element.querySelectorAll('tr')].map((row) => [...row.children].map((cell) => [...cell.children].map((part) => inlineMarkdown(part).trim()).filter(Boolean).join('\n') || inlineMarkdown(cell).trim()))
      return rows.length > 0 ? buildMarkdownTable(rows).trim() : ''
    }
    return escapeLineStart(inlineMarkdown(element).trim())
  })
  return blocks.filter(Boolean).join('\n\n') + '\n'
}

async function readPresentationOutline(file: File, labels: { slide: string; notes: string }, format: 'markdown' | 'text') {
  const { outlineAsMarkdown, outlineAsText, readPresentationText } = await import('../../formats/powerpoint/presentationText')
  const { slides } = await readPresentationText(await file.arrayBuffer())
  return format === 'markdown' ? outlineAsMarkdown(slides, baseNameOf(file.name), labels) : outlineAsText(slides, baseNameOf(file.name), labels)
}

function MarkdownConverter({ files, readMarkdown }: ToolProps & { readMarkdown: (file: File) => Promise<string> }) {
  const { t } = useT()
  const result = useFileText(files, readMarkdown)
  if (!result) return null
  if ('failed' in result) return <p id="ai-ready-error" role="alert" className="text-center font-medium text-danger">{t('aiReady.unreadable')}</p>
  if (result.text.trim() === '' || /^#[^\n]*\n*$/.test(result.text.trim())) return <p id="ai-ready-empty" role="status" className="text-center font-medium">{t('aiReady.noText')}</p>
  const fileName = `${baseNameOf(result.file.name)}.md`
  return <TextResultPanel id="ai-ready-result" label={t('aiReady.markdownResult')} text={result.text} downloads={[{ id: 'md', label: '.md', fileName, text: result.text, mimeType: 'text/markdown;charset=utf-8' }]} />
}

export function WordToMarkdown(props: ToolProps) {
  return <MarkdownConverter {...props} readMarkdown={readWordAsMarkdown} />
}

export function PptxToMarkdown(props: ToolProps) {
  const { t } = useT()
  const labels = { slide: t('powerpoint.export.slideLabel'), notes: t('powerpoint.notes.label') }
  return <MarkdownConverter {...props} readMarkdown={(file) => readPresentationOutline(file, labels, 'markdown')} />
}

// ---------------------------------------------------------------- Token counter

// A file's text the way the AI-ready pages make it: a PDF as Markdown, a Word document's text, a deck's outline with speaker
// notes, every sheet of a workbook or a CSV as a Markdown table, anything else as its text.
async function readFileAsText(file: File, labels: { slide: string; notes: string; sheet: string }, locale: 'en' | 'ar') {
  const viewerId = findViewerForFileName(file.name)?.id
  if (viewerId === 'pdf') return (await import('../pdf/PdfExtractTools')).readPdfAsMarkdown(await file.arrayBuffer())
  if (viewerId === 'word') return (await (await import('mammoth')).extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  if (viewerId === 'powerpoint') return readPresentationOutline(file, labels, 'text')
  if (viewerId === 'excel' || (viewerId === 'csv' && !file.name.toLowerCase().endsWith('.parquet'))) {
    const [{ readInputTables }, { buildMarkdownTable }] = await Promise.all([import('../../formats/conversion'), import('../../formats/csv/csvExport')])
    const result = await readInputTables(file, await file.arrayBuffer(), viewerId, 'csv', locale)
    if (result.status === 'error') throw new Error(result.message)
    return result.tables.map((table) => `${table.sheetName ? `## ${labels.sheet} ${table.sheetName}\n\n` : ''}${buildMarkdownTable(table.rows.map((row) => row.map((cell) => (cell === null ? '' : String(cell)))))}`).join('\n')
  }
  return file.text()
}

export function TokenCounter({ files }: ToolProps) {
  const { locale, t } = useT()
  const [text, setText] = useState('')
  const [readError, setReadError] = useState('')
  const [tokenCount, setTokenCount] = useState<{ text: string; count: number } | null>(null)
  const chosenFile = files.at(-1)

  useEffect(() => {
    if (!chosenFile) return
    let isCurrent = true
    readFileAsText(chosenFile, { slide: t('powerpoint.export.slideLabel'), notes: t('powerpoint.notes.label'), sheet: t('aiReady.sheet') }, locale)
      .then((fileText) => {
        if (!isCurrent) return
        setReadError(fileText.trim() === '' ? t('aiReady.noText') : '')
        setText(fileText)
      })
      .catch(() => isCurrent && setReadError(t('aiReady.unreadable')))
    return () => {
      isCurrent = false
    }
  }, [chosenFile, locale, t])

  // Counted a moment after typing stops, so a long paste is counted once.
  useEffect(() => {
    let isCurrent = true
    const timer = window.setTimeout(() => void countTokens(text).then((count) => isCurrent && setTokenCount({ text, count })), 200)
    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [text])

  const statistics = [
    { id: 'tokens', label: t('aiReady.tokens'), value: tokenCount?.text === text ? tokenCount.count : null },
    { id: 'words', label: t('aiReady.words'), value: countWords(text) },
    { id: 'characters', label: t('aiReady.characters'), value: countCharacters(text) },
  ]
  return (
    <div id="token-counter-tool" className={boxClasses}>
      <label htmlFor="token-counter-input" className="block text-sm font-semibold">
        {chosenFile ? t('aiReady.textOfFile', { name: chosenFile.name }) : t('aiReady.pasteText')}
      </label>
      <textarea id="token-counter-input" dir="auto" rows={10} spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} className={textBoxClasses} />
      {readError && (
        <p id="token-counter-error" role="alert" className="text-sm text-danger">
          {readError}
        </p>
      )}
      <dl id="token-counter-statistics" className="grid grid-cols-3 gap-3 text-center" aria-live="polite">
        {statistics.map((statistic) => (
          <div key={statistic.id} className="rounded-[14px] bg-surface p-3">
            <dt className="text-sm text-ink-soft">{statistic.label}</dt>
            <dd id={`token-counter-${statistic.id}`} className="text-2xl font-semibold" dir="ltr">
              {statistic.value === null ? '…' : statistic.value.toLocaleString('en')}
            </dd>
          </div>
        ))}
      </dl>
      <p id="token-counter-note" className="text-sm text-ink-soft">
        {t('aiReady.tokenizerNote')}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- JSON ↔ TOON

type ToonDirection = 'toToon' | 'toJson'

export function JsonToToon({ files }: ToolProps) {
  const { t } = useT()
  const [inputText, setInputText] = useState('')
  const [direction, setDirection] = useState<ToonDirection>('toToon')
  const [conversion, setConversion] = useState<{ inputText: string; direction: ToonDirection; outputText: string; error: string } | null>(null)
  const [tokenCounts, setTokenCounts] = useState<{ input: number; output: number; forText: string } | null>(null)
  const chosenFile = files.at(-1)

  useEffect(() => {
    if (!chosenFile) return
    let isCurrent = true
    void chosenFile.text().then((fileText) => {
      if (!isCurrent) return
      setInputText(fileText)
      setDirection(chosenFile.name.toLowerCase().endsWith('.toon') ? 'toJson' : 'toToon')
    })
    return () => {
      isCurrent = false
    }
  }, [chosenFile])

  useEffect(() => {
    let isCurrent = true
    const timer = window.setTimeout(async () => {
      if (inputText.trim() === '') {
        if (isCurrent) setConversion(null)
        return
      }
      const { decode, encode } = await import('@toon-format/toon')
      let outputText = ''
      let error = ''
      try {
        outputText = direction === 'toToon' ? encode(JSON.parse(inputText)) : `${JSON.stringify(decode(inputText), null, 2)}\n`
      } catch (conversionError) {
        error = conversionError instanceof Error ? conversionError.message : String(conversionError)
      }
      if (!isCurrent) return
      setConversion({ inputText, direction, outputText, error })
      if (outputText) {
        const [input, output] = await Promise.all([countTokens(inputText), countTokens(outputText)])
        if (isCurrent) setTokenCounts({ input, output, forText: outputText })
      }
    }, 200)
    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [inputText, direction])

  const outputText = conversion && !conversion.error ? conversion.outputText : ''
  const counts = tokenCounts?.forText === outputText && outputText ? tokenCounts : null
  const toonTokens = counts ? (direction === 'toToon' ? counts.output : counts.input) : 0
  const jsonTokens = counts ? (direction === 'toToon' ? counts.input : counts.output) : 0
  const outputExtension = direction === 'toToon' ? '.toon' : '.json'
  const outputName = `${chosenFile ? baseNameOf(chosenFile.name) : 'data'}${outputExtension}`

  return (
    <div id="json-toon-tool" className={boxClasses}>
      <div id="json-toon-direction" role="group" aria-label={t('aiReady.toon.direction')} className="inline-flex gap-1 rounded-full border-2 border-rule bg-paper-raised p-1">
        {(['toToon', 'toJson'] as const).map((choice) => (
          <button
            key={choice}
            id={`json-toon-direction-${choice === 'toToon' ? 'to-toon' : 'to-json'}`}
            type="button"
            aria-pressed={direction === choice}
            onClick={() => {
              if (outputText) setInputText(outputText)
              setDirection(choice)
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold pointer-coarse:min-h-11 ${direction === choice ? 'bg-accent text-paper' : 'text-ink-soft hover:text-ink'}`}
          >
            {t(choice === 'toToon' ? 'aiReady.toon.toToon' : 'aiReady.toon.toJson')}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="json-toon-input" className="block text-sm font-semibold">
            {t(direction === 'toToon' ? 'aiReady.toon.jsonInput' : 'aiReady.toon.toonInput')}
          </label>
          <textarea id="json-toon-input" dir="ltr" rows={14} spellCheck={false} value={inputText} onChange={(event) => setInputText(event.target.value)} className={textBoxClasses} />
        </div>
        <div>
          <label htmlFor="json-toon-output" className="block text-sm font-semibold">
            {t(direction === 'toToon' ? 'aiReady.toon.toonOutput' : 'aiReady.toon.jsonOutput')}
          </label>
          <textarea id="json-toon-output" dir="ltr" rows={14} readOnly spellCheck={false} value={outputText} className={`${textBoxClasses} bg-surface`} />
        </div>
      </div>
      {conversion?.error && (
        <p id="json-toon-error" role="alert" className="text-sm text-danger" dir="auto">
          {t(direction === 'toToon' ? 'aiReady.toon.invalidJson' : 'aiReady.toon.invalidToon', { reason: conversion.error })}
        </p>
      )}
      {counts && (
        <p id="json-toon-saving" role="status" className="font-semibold">
          {t('aiReady.toon.saving', { json: jsonTokens.toLocaleString('en'), toon: toonTokens.toLocaleString('en'), percent: jsonTokens ? Math.round(((jsonTokens - toonTokens) / jsonTokens) * 100) : 0 })}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          id="json-toon-copy-button"
          type="button"
          disabled={!outputText}
          onClick={() => void navigator.clipboard.writeText(outputText).catch(() => {})}
          className="btn btn--primary btn--compact press"
        >
          {t('aiReady.copy')}
        </button>
        <button id="json-toon-download-button" type="button" disabled={!outputText} onClick={() => downloadTextFile(outputName, outputText, direction === 'toToon' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8')} className="btn btn--quiet btn--compact press">
          {t('aiReady.download', { format: outputExtension })}
        </button>
      </div>
      <p id="json-toon-note" className="text-sm text-ink-soft">
        {t('aiReady.tokenizerNote')}
      </p>
    </div>
  )
}
