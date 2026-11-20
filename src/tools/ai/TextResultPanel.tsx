import { useEffect, useState } from 'react'
import { useToast } from '../../components/Messages'
import { useT } from '../../i18n'
import { downloadTextFile } from '../../formats/registry'
import { countTokens } from './textStats'

// The result of an AI-ready converter (PDF, Word, PowerPoint to Markdown): the text to read and copy, its token count (the same
// tokenizer as the token counter), and a download per format offered. The box shows the start of a long text; Copy and the
// downloads always take all of it.
export type TextDownload = { id: string; label: string; fileName: string; text: string; mimeType: string }

const MAX_PREVIEW_CHARACTERS = 200_000

export default function TextResultPanel({ id, label, text, downloads }: { id: string; label: string; text: string; downloads: TextDownload[] }) {
  const { t } = useT()
  const { showToast } = useToast()
  const [tokenCount, setTokenCount] = useState<{ text: string; count: number } | null>(null)

  useEffect(() => {
    let isCurrent = true
    void countTokens(text).then((count) => isCurrent && setTokenCount({ text, count }))
    return () => {
      isCurrent = false
    }
  }, [text])

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text)
      showToast({ kind: 'success', message: t('aiReady.copied') })
    } catch {
      showToast({ kind: 'error', message: t('json.status.copyNotAllowed') })
    }
  }

  return (
    <div id={id} className="space-y-3 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start">
      <label htmlFor={`${id}-text`} className="block text-sm font-semibold">
        {label}
      </label>
      <textarea id={`${id}-text`} dir="auto" readOnly rows={14} spellCheck={false} value={text.length > MAX_PREVIEW_CHARACTERS ? `${text.slice(0, MAX_PREVIEW_CHARACTERS)}\n…` : text} className="w-full rounded-[14px] border-2 border-rule bg-surface p-3 font-mono text-sm" />
      <p id={`${id}-token-count`} className="text-sm text-ink-soft" aria-live="polite">
        {tokenCount?.text === text ? t('aiReady.resultTokens', { tokens: tokenCount.count.toLocaleString('en'), characters: text.length.toLocaleString('en') }) : t('aiReady.countingTokens')}
      </p>
      <div className="flex flex-wrap gap-3">
        <button id={`${id}-copy-button`} type="button" onClick={() => void copyText()} className="btn btn--primary btn--compact press">
          {t('aiReady.copy')}
        </button>
        {downloads.map((download) => (
          <button key={download.id} id={`${id}-download-${download.id}-button`} type="button" onClick={() => downloadTextFile(download.fileName, download.text, download.mimeType)} className="btn btn--quiet btn--compact press">
            {t('aiReady.download', { format: download.label })}
          </button>
        ))}
      </div>
    </div>
  )
}
