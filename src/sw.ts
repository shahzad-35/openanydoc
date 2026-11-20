import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

const daysInSeconds = (days: number) => days * 24 * 60 * 60

// A file shared to the installed app on Android (manifest share_target, POST /en/share or /ar/share). The site has no server
// for it, so it is answered here: the file is kept in the shared-files cache until the page (src/pwa.ts, takeSharedFile) reads
// and removes it. It is never sent anywhere.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const shareMatch = url.pathname.match(/^\/(en|ar)\/share$/)
  if (event.request.method !== 'POST' || url.origin !== self.location.origin || !shareMatch) return
  event.respondWith(
    (async () => {
      const sharedFile = (await event.request.formData()).get('file')
      if (sharedFile instanceof File) {
        const sharedFilesCache = await caches.open('shared-files')
        const headers = { 'Content-Type': sharedFile.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(sharedFile.name) }
        await sharedFilesCache.put('/shared-file', new Response(sharedFile, { headers }))
      }
      return Response.redirect(`/${shareMatch[1]}?shared=1`, 303)
    })(),
  )
})

void self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// The app shell (main script, styles, Arabic words, fonts) and the two home pages, kept at install.
precacheAndRoute(self.__WB_MANIFEST)

// Each tool's code, workers and samples, cached the first time they are used. Their names carry a hash, so a cached copy is
// never out of date; old ones are dropped after 60 days or past 600 files.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
  new CacheFirst({ cacheName: 'tool-libraries', plugins: [new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: daysInSeconds(60) })] }),
)

// The AI tools' runtimes and models, and pdf.js's font and decoder data, after their first use. No hash in their names, so they
// are kept 30 days, as public/_headers tells the browser's own cache.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/models/'),
  new CacheFirst({ cacheName: 'ai-models', plugins: [new ExpirationPlugin({ maxAgeSeconds: daysInSeconds(30) })] }),
)
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/pdfjs/'),
  new CacheFirst({ cacheName: 'pdfjs-data', plugins: [new ExpirationPlugin({ maxAgeSeconds: daysInSeconds(30) })] }),
)

// Pages: the network first, so a new release shows at once; the last copy when offline. src/pwa.ts also asks for the open page
// by address (a CACHE_URLS message, not a navigation), hence the address test.
registerRoute(
  ({ request, url }) => url.origin === self.location.origin && (request.mode === 'navigate' || /^\/(en|ar)(\/[^.]*)?$/.test(url.pathname)),
  new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3 }),
)
