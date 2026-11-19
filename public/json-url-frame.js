// "Open from a URL" on the JSON page: this hidden frame reads the https address the visitor typed. It is the only page of the site
// allowed to contact other sites (connect-src https:, in json-url-frame.html; _headers removes the site-wide policy for it), so
// every other page keeps connect-src 'self'. It answers only this site's own pages, with the file's bytes or the problem.
const MAX_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 20000

addEventListener('message', async (event) => {
  if (event.origin !== location.origin || event.source !== parent) return
  const answer = (message, transfer = []) => parent.postMessage(message, location.origin, transfer)
  let url
  try {
    url = new URL(event.data.address)
  } catch {
    return answer({ problem: 'blocked' })
  }
  if (url.protocol !== 'https:') return answer({ problem: 'blocked' })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'follow', signal: controller.signal })
    if (!response.ok) return answer({ problem: 'status', status: response.status })
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) return answer({ problem: 'tooLarge' })
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_BYTES) return answer({ problem: 'tooLarge' })
    answer({ bytes, contentType: response.headers.get('content-type') ?? '' }, [bytes])
  } catch (error) {
    // A blocked request (CORS), no network or an address that does not answer all end here, without saying which.
    answer({ problem: error instanceof DOMException && error.name === 'AbortError' ? 'timedOut' : 'blocked' })
  } finally {
    clearTimeout(timer)
  }
})
