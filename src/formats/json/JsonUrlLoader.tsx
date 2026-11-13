import { useState } from 'react'
import { useT } from '../../i18n'

const MAX_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 20_000
const KNOWN_EXTENSION_PATTERN = /\.(json|jsonl|ndjson|json5|geojson|ya?ml)$/i

// "Open from a URL": the visitor's own browser asks that site for the file, only when they click Load. Nothing is sent to
// OpenAnyDoc and nothing is kept: no history of addresses, the box starts empty each time and the address never goes into the
// page's own. Many sites do not let other pages read their files (CORS); then the visitor is told to download and open the file.
// The page's Content-Security-Policy allows https requests for this (connect-src https:).
export default function JsonUrlLoader({ onFileLoaded }: { onFileLoaded: (file: File) => void }) {
  const { t } = useT()
  const [address, setAddress] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadAddress() {
    setErrorMessage('')
    let url: URL
    try {
      url = new URL(address.trim())
    } catch {
      setErrorMessage(t('json.url.notAnAddress'))
      return
    }
    if (url.protocol !== 'https:') {
      setErrorMessage(t('json.url.httpsOnly'))
      return
    }
    setIsLoading(true)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'follow', signal: controller.signal })
      if (!response.ok) {
        setErrorMessage(t('json.url.status', { status: response.status }))
        return
      }
      if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) {
        setErrorMessage(t('json.url.tooLarge'))
        return
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > MAX_BYTES) {
        setErrorMessage(t('json.url.tooLarge'))
        return
      }
      // The file's name is the address's last part; JSON without a known ending is named .json.
      const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '') || 'download'
      const isYaml = /yaml/i.test(response.headers.get('content-type') ?? '')
      const fileName = KNOWN_EXTENSION_PATTERN.test(lastPart) ? lastPart : `${lastPart}${isYaml ? '.yaml' : '.json'}`
      setAddress('')
      onFileLoaded(new File([bytes], fileName, { type: response.headers.get('content-type') ?? 'application/json' }))
    } catch (error) {
      // A blocked request (CORS), no network or an address that does not answer all end here, without saying which.
      setErrorMessage(error instanceof DOMException && error.name === 'AbortError' ? t('json.url.timedOut') : t('json.url.blocked'))
    } finally {
      window.clearTimeout(timer)
      setIsLoading(false)
    }
  }

  return (
    <form
      id="url-loader"
      className="url-loader"
      onSubmit={(event) => {
        event.preventDefault()
        void loadAddress()
      }}
    >
      <label htmlFor="url-input">{t('json.url.label')}</label>
      <div className="url-row">
        <input id="url-input" type="url" dir="ltr" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://example.com/data.json" value={address} onChange={(event) => setAddress(event.target.value)} />
        <button id="url-load-button" type="submit" className="btn btn--primary btn--compact press" disabled={isLoading || address.trim() === ''}>
          {isLoading ? t('json.url.loading') : t('json.url.load')}
        </button>
      </div>
      <p className="url-note" id="url-note">
        {t('json.url.note')}
      </p>
      {errorMessage && (
        <p className="url-error" id="url-error" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  )
}
