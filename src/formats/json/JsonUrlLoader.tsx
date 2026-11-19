import { useState } from 'react'
import { useT } from '../../i18n'

// The frame gives up after 20 s itself; this is for a frame that never answers (it could not load).
const FRAME_TIMEOUT_MS = 25_000
const KNOWN_EXTENSION_PATTERN = /\.(json|jsonl|ndjson|json5|geojson|ya?ml)$/i

// "Open from a URL": the visitor's own browser asks that site for the file, only when they click Load. Nothing is sent to
// OpenAnyDoc and nothing is kept: no history of addresses, the box starts empty each time and the address never goes into the
// page's own. Many sites do not let other pages read their files (CORS); then the visitor is told to download and open the file.
// The request is made by a hidden frame, /json-url-frame.html, the one page of the site allowed to contact other sites
// (connect-src https:); this page and every other keep connect-src 'self'.
type UrlFrameAnswer = { bytes: ArrayBuffer; contentType: string } | { problem: 'status'; status: number } | { problem: 'tooLarge' | 'timedOut' | 'blocked' }

function readAddressThroughFrame(address: string): Promise<UrlFrameAnswer> {
  return new Promise((resolve) => {
    let frame = document.getElementById('url-loader-frame') as HTMLIFrameElement | null
    const finish = (answer: UrlFrameAnswer) => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onFrameAnswer)
      resolve(answer)
    }
    const timer = window.setTimeout(() => finish({ problem: 'blocked' }), FRAME_TIMEOUT_MS)
    function onFrameAnswer(event: MessageEvent) {
      if (event.origin === window.location.origin && event.source === frame?.contentWindow) finish(event.data)
    }
    window.addEventListener('message', onFrameAnswer)
    const askFrame = () => frame?.contentWindow?.postMessage({ address }, window.location.origin)
    if (frame) {
      askFrame()
      return
    }
    frame = document.createElement('iframe')
    frame.id = 'url-loader-frame'
    frame.hidden = true
    frame.src = '/json-url-frame.html'
    frame.addEventListener('load', askFrame, { once: true })
    document.body.append(frame)
  })
}

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
    const answer = await readAddressThroughFrame(url.href)
    setIsLoading(false)
    if ('problem' in answer) {
      if (answer.problem === 'status') setErrorMessage(t('json.url.status', { status: answer.status }))
      else if (answer.problem === 'tooLarge') setErrorMessage(t('json.url.tooLarge'))
      else if (answer.problem === 'timedOut') setErrorMessage(t('json.url.timedOut'))
      else setErrorMessage(t('json.url.blocked'))
      return
    }
    // The file's name is the address's last part; JSON without a known ending is named .json.
    const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '') || 'download'
    const isYaml = /yaml/i.test(answer.contentType)
    const fileName = KNOWN_EXTENSION_PATTERN.test(lastPart) ? lastPart : `${lastPart}${isYaml ? '.yaml' : '.json'}`
    setAddress('')
    onFileLoaded(new File([answer.bytes], fileName, { type: answer.contentType || 'application/json' }))
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
