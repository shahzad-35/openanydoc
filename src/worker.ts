// Runs on Cloudflare only for "/" (run_worker_first in wrangler.jsonc); every other address is served straight from dist/.
// "/" has no language of its own, so it redirects to /ar or /en by the browser's Accept-Language. Crawlers send none and get /en.
type WorkerEnvironment = { ASSETS: { fetch(request: Request): Promise<Response> } }

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> | Response {
    const url = new URL(request.url)
    if (url.pathname !== '/') return environment.ASSETS.fetch(request)

    const acceptedLanguages = (request.headers.get('Accept-Language') ?? '').split(',').map((language) => language.trim().toLowerCase().slice(0, 2))
    const preferredLanguage = acceptedLanguages.find((code) => code === 'ar' || code === 'en') ?? 'en'
    return new Response(null, {
      status: 302,
      headers: { Location: `/${preferredLanguage}${url.search}`, Vary: 'Accept-Language', 'Cache-Control': 'no-store' },
    })
  },
}
