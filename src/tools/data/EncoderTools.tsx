import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useToast } from '../../components/Messages'
import { useT } from '../../i18n'
import type { Locale } from '../../i18n'
import { downloadTextFile } from '../../formats/registry'
import type { ToolProps } from '../registry'

// The encoder pages: Base64, URL encoding and the JWT decoder. Everything is worked out in this tab as you type; nothing is
// stored and nothing is sent (the JWT's signature is shown, never checked against a server).

const MAX_FILE_BYTES = 10 * 1024 * 1024
const TEXT_FILE_PATTERN = /\.(txt|json|xml|csv|ya?ml|html|svg|jwt)$/i

const textBoxClasses = 'mt-1 w-full rounded-[14px] border-2 border-rule bg-paper-raised p-3 font-mono text-sm pointer-coarse:text-base'
const labelClasses = 'block text-sm font-semibold'

// ---------------------------------------------------------------- Shared parts

// A chosen file or a sample, read as text (or as bytes for Base64's binary files) whenever a new one arrives.
function useChosenFile(files: File[], onFile: (file: File) => void) {
  const { t } = useT()
  const { showToast } = useToast()
  const chosenFile = files.at(-1)
  useEffect(() => {
    if (!chosenFile) return
    if (chosenFile.size > MAX_FILE_BYTES) showToast({ kind: 'error', message: t('encoder.fileTooLarge') })
    else onFile(chosenFile)
    // onFile is a new function on every render; the file itself is what starts this.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenFile])
}

function useCopyToClipboard() {
  const { t } = useT()
  const { showToast } = useToast()
  return async (copiedText: string) => {
    try {
      await navigator.clipboard.writeText(copiedText)
      showToast({ kind: 'success', message: t('encoder.copied') })
    } catch {
      showToast({ kind: 'error', message: t('json.status.copyNotAllowed') })
    }
  }
}

// Two buttons that act as one choice (Encode / Decode, Part of a URL / Whole URL).
function ChoiceButtons<Choice extends string>({ id, label, choices, value, onChange }: { id: string; label: string; choices: { value: Choice; label: string }[]; value: Choice; onChange: (choice: Choice) => void }) {
  return (
    <div id={id} role="group" aria-label={label} className="inline-flex gap-1 rounded-full border-2 border-rule bg-paper-raised p-1">
      {choices.map((choice) => (
        <button
          key={choice.value}
          id={`${id}-${choice.value}`}
          type="button"
          aria-pressed={value === choice.value}
          onClick={() => onChange(choice.value)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold pointer-coarse:min-h-11 ${value === choice.value ? 'bg-accent text-paper' : 'text-ink-soft hover:text-ink'}`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}

function ToolBox({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="space-y-4 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start">
      {children}
    </div>
  )
}

function ResultBox({ id, label, value, message }: { id: string; label: string; value: string; message: string }) {
  const { t } = useT()
  const copyToClipboard = useCopyToClipboard()
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <textarea id={id} dir="ltr" rows={6} readOnly value={value} spellCheck={false} className={textBoxClasses} />
      {message && (
        <p id={`${id}-message`} role="status" className="mt-1 text-sm text-danger">
          {message}
        </p>
      )}
      <button id={`${id}-copy-button`} type="button" disabled={value === ''} onClick={() => void copyToClipboard(value)} className="btn btn--quiet btn--compact press mt-2">
        {t('encoder.copy')}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- Base64

function bytesToBase64(bytes: Uint8Array, isUrlSafe: boolean) {
  let binaryText = ''
  for (let start = 0; start < bytes.length; start += 0x8000) binaryText += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  const base64Text = btoa(binaryText)
  return isUrlSafe ? base64Text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : base64Text
}

// Standard or URL-safe Base64, with or without padding and line breaks; null when it is not Base64.
function base64ToBytes(base64Text: string): Uint8Array<ArrayBuffer> | null {
  const compactText = base64Text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compactText) || compactText.replace(/=+$/, '').length % 4 === 1) return null
  const paddedText = compactText.replace(/=+$/, '').padEnd(Math.ceil(compactText.replace(/=+$/, '').length / 4) * 4, '=')
  return Uint8Array.from(atob(paddedText), (character) => character.charCodeAt(0))
}

const looksLikeBase64 = (text: string) => text.trim().length >= 8 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(text.trim())

export function Base64Tool({ files }: ToolProps) {
  const { t } = useT()
  const [inputText, setInputText] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [isUrlSafe, setIsUrlSafe] = useState(false)
  // A binary file to encode (a picture, a PDF): its bytes stand in for the text.
  const [binaryFile, setBinaryFile] = useState<{ name: string; bytes: Uint8Array } | null>(null)

  useChosenFile(files, (file) => {
    if (TEXT_FILE_PATTERN.test(file.name)) {
      void file.text().then((fileText) => {
        setBinaryFile(null)
        setInputText(fileText)
        setMode(looksLikeBase64(fileText) ? 'decode' : 'encode')
      })
    } else {
      void file.arrayBuffer().then((buffer) => {
        setBinaryFile({ name: file.name, bytes: new Uint8Array(buffer) })
        setMode('encode')
      })
    }
  })

  const decodedBytes = mode === 'decode' && inputText.trim() !== '' ? base64ToBytes(inputText) : null
  let decodedText: string | null = null
  if (decodedBytes) {
    try {
      decodedText = new TextDecoder('utf-8', { fatal: true }).decode(decodedBytes)
    } catch {
      decodedText = null
    }
  }
  const outputText = mode === 'encode' ? (binaryFile ? bytesToBase64(binaryFile.bytes, isUrlSafe) : inputText === '' ? '' : bytesToBase64(new TextEncoder().encode(inputText), isUrlSafe)) : (decodedText ?? '')
  const outputMessage = mode === 'decode' && inputText.trim() !== '' ? (decodedBytes === null ? t('encoder.base64.invalid') : decodedText === null ? t('encoder.base64.binary', { count: decodedBytes.length }) : '') : ''

  return (
    <ToolBox id="base64-tool">
      <ChoiceButtons
        id="base64-mode"
        label={t('encoder.mode')}
        value={mode}
        onChange={setMode}
        choices={[
          { value: 'encode', label: t('encoder.encode') },
          { value: 'decode', label: t('encoder.decode') },
        ]}
      />
      {binaryFile && mode === 'encode' ? (
        <p id="base64-file-note" className="text-sm">
          {t('encoder.base64.fileEncoded', { name: binaryFile.name, count: binaryFile.bytes.length })}{' '}
          <button id="base64-clear-file-button" type="button" onClick={() => setBinaryFile(null)} className="btn btn--quiet btn--compact press">
            {t('encoder.base64.typeInstead')}
          </button>
        </p>
      ) : (
        <div>
          <label htmlFor="base64-input" className={labelClasses}>
            {t(mode === 'encode' ? 'encoder.textToEncode' : 'encoder.base64.toDecode')}
          </label>
          <textarea id="base64-input" dir="auto" rows={6} spellCheck={false} value={inputText} onChange={(event) => setInputText(event.target.value)} className={textBoxClasses} />
        </div>
      )}
      <label htmlFor="base64-url-safe-checkbox" className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
        <input id="base64-url-safe-checkbox" type="checkbox" checked={isUrlSafe} onChange={(event) => setIsUrlSafe(event.target.checked)} className="size-4" />
        {t('encoder.base64.urlSafe')}
      </label>
      <ResultBox id="base64-output" label={t(mode === 'encode' ? 'encoder.base64.encoded' : 'encoder.decoded')} value={outputText} message={outputMessage} />
      {mode === 'decode' && decodedBytes !== null && decodedBytes.length > 0 && (
        <button id="base64-download-button" type="button" onClick={() => downloadTextFile('decoded.bin', decodedBytes, 'application/octet-stream')} className="btn btn--quiet btn--compact press">
          {t('encoder.base64.downloadBytes')}
        </button>
      )}
    </ToolBox>
  )
}

// ---------------------------------------------------------------- URL

export function UrlTool({ files }: ToolProps) {
  const { t } = useT()
  const [inputText, setInputText] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [scope, setScope] = useState<'part' | 'whole'>('part')

  useChosenFile(files, (file) => {
    void file.text().then((fileText) => {
      const link = fileText.trim()
      setInputText(link)
      setMode(/%[0-9A-Fa-f]{2}/.test(link) ? 'decode' : 'encode')
      setScope(/^[a-z][a-z0-9+.-]*:\/\//i.test(link) ? 'whole' : 'part')
    })
  })

  let outputText = ''
  let outputMessage = ''
  try {
    if (mode === 'encode') outputText = scope === 'part' ? encodeURIComponent(inputText) : encodeURI(inputText)
    else outputText = scope === 'part' ? decodeURIComponent(inputText) : decodeURI(inputText)
  } catch {
    outputMessage = t(mode === 'encode' ? 'encoder.url.invalidText' : 'encoder.url.invalidPercent')
  }

  return (
    <ToolBox id="url-tool">
      <div className="flex flex-wrap gap-3">
        <ChoiceButtons
          id="url-mode"
          label={t('encoder.mode')}
          value={mode}
          onChange={setMode}
          choices={[
            { value: 'encode', label: t('encoder.encode') },
            { value: 'decode', label: t('encoder.decode') },
          ]}
        />
        <ChoiceButtons
          id="url-scope"
          label={t('encoder.url.scope')}
          value={scope}
          onChange={setScope}
          choices={[
            { value: 'part', label: t('encoder.url.part') },
            { value: 'whole', label: t('encoder.url.whole') },
          ]}
        />
      </div>
      <p id="url-scope-note" className="text-sm text-ink-soft">
        {t(scope === 'part' ? 'encoder.url.partNote' : 'encoder.url.wholeNote')}
      </p>
      <div>
        <label htmlFor="url-input" className={labelClasses}>
          {t(mode === 'encode' ? 'encoder.textToEncode' : 'encoder.url.toDecode')}
        </label>
        <textarea id="url-input" dir="ltr" rows={4} spellCheck={false} value={inputText} onChange={(event) => setInputText(event.target.value)} className={textBoxClasses} />
      </div>
      <ResultBox id="url-output" label={t(mode === 'encode' ? 'encoder.url.encoded' : 'encoder.decoded')} value={outputText} message={outputMessage} />
    </ToolBox>
  )
}

// ---------------------------------------------------------------- JWT

type DecodedJwt = { status: 'decoded'; header: Record<string, unknown>; payload: Record<string, unknown>; signature: string } | { status: 'error'; messageKey: 'encoder.jwt.encrypted' | 'encoder.jwt.notAToken' | 'encoder.jwt.unreadable' }

function decodeJwtPart(part: string): Record<string, unknown> {
  const bytes = base64ToBytes(part)
  if (!bytes) throw new Error('not Base64')
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('not an object')
  return value as Record<string, unknown>
}

function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length === 5) return { status: 'error', messageKey: 'encoder.jwt.encrypted' }
  if (parts.length !== 3) return { status: 'error', messageKey: 'encoder.jwt.notAToken' }
  try {
    return { status: 'decoded', header: decodeJwtPart(parts[0]), payload: decodeJwtPart(parts[1]), signature: parts[2] }
  } catch {
    return { status: 'error', messageKey: 'encoder.jwt.unreadable' }
  }
}

// "in 2 hours", "3 days ago": the largest unit that fits.
function describeTimeFromNow(seconds: number, locale: Locale) {
  const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  const [unit, unitSeconds] = units.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1]
  return relativeTime.format(Math.round(seconds / unitSeconds), unit)
}

const TIME_CLAIMS = ['exp', 'iat', 'nbf'] as const

export function JwtDecoder({ files }: ToolProps) {
  const { locale, t } = useT()
  const [token, setToken] = useState('')
  // Read once: the page is drawn in the browser only (ToolPage draws text tools after mount).
  const [nowSeconds] = useState(() => Date.now() / 1000)

  useChosenFile(files, (file) => void file.text().then((fileText) => setToken(fileText.trim())))

  const decodedJwt = token.trim() === '' ? null : decodeJwt(token)
  const dateFormat = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'medium', timeStyle: 'long' })
  const payload = decodedJwt?.status === 'decoded' ? decodedJwt.payload : null
  const expiresAt = typeof payload?.exp === 'number' ? payload.exp : null
  const notBefore = typeof payload?.nbf === 'number' ? payload.nbf : null
  const validityText =
    expiresAt !== null && expiresAt < nowSeconds
      ? t('encoder.jwt.expired', { time: describeTimeFromNow(expiresAt - nowSeconds, locale) })
      : notBefore !== null && notBefore > nowSeconds
        ? t('encoder.jwt.notYetValid', { time: describeTimeFromNow(notBefore - nowSeconds, locale) })
        : expiresAt !== null
          ? t('encoder.jwt.validUntil', { time: describeTimeFromNow(expiresAt - nowSeconds, locale) })
          : t('encoder.jwt.noExpiry')

  return (
    <ToolBox id="jwt-tool">
      <div>
        <label htmlFor="jwt-input" className={labelClasses}>
          {t('encoder.jwt.token')}
        </label>
        <textarea id="jwt-input" dir="ltr" rows={4} spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} className={`${textBoxClasses} break-all`} />
      </div>
      {decodedJwt?.status === 'error' && (
        <p id="jwt-error" role="status" className="text-sm text-danger">
          {t(decodedJwt.messageKey)}
        </p>
      )}
      {decodedJwt?.status === 'decoded' && (
        <>
          <p id="jwt-validity" role="status" className={`font-semibold ${expiresAt !== null && expiresAt < nowSeconds ? 'text-danger' : 'text-ink'}`}>
            {validityText}
          </p>
          <dl id="jwt-times" className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            {TIME_CLAIMS.filter((claim) => typeof decodedJwt.payload[claim] === 'number').map((claim) => (
              <div key={claim} className="contents">
                <dt className="font-semibold">
                  {t(`encoder.jwt.claim.${claim}`)} <bdi dir="ltr" className="font-mono text-ink-soft">({claim})</bdi>
                </dt>
                <dd id={`jwt-claim-${claim}`}>{dateFormat.format(new Date((decodedJwt.payload[claim] as number) * 1000))}</dd>
              </div>
            ))}
          </dl>
          <ResultBox id="jwt-header" label={t('encoder.jwt.header', { algorithm: String(decodedJwt.header.alg ?? '?') })} value={JSON.stringify(decodedJwt.header, null, 2)} message="" />
          <ResultBox id="jwt-payload" label={t('encoder.jwt.payload')} value={JSON.stringify(decodedJwt.payload, null, 2)} message="" />
          <div>
            <p className={labelClasses}>{t('encoder.jwt.signature')}</p>
            <p id="jwt-signature" dir="ltr" className="mt-1 break-all rounded-[14px] bg-surface p-3 font-mono text-sm">
              {decodedJwt.signature}
            </p>
            <p id="jwt-signature-note" className="mt-1 text-sm text-ink-soft">
              {t('encoder.jwt.notVerified')}
            </p>
          </div>
        </>
      )}
    </ToolBox>
  )
}
