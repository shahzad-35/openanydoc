import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import App from './App'
import { loadLocale, localizePath } from './i18n'
import type { Locale } from './i18n'

// The build's server render: scripts/build-static-pages.mjs puts this markup into each page's <div id="root">, and src/main.tsx
// takes it over in the browser. `prerender` (not renderToString) waits for the lazily loaded pages (About, Privacy, Terms).
export async function renderPage(locale: Locale, path: string) {
  await loadLocale(locale)
  const { prelude } = await prerender(
    <StrictMode>
      <App initialPathname={localizePath(locale, path)} />
    </StrictMode>,
  )
  return new Response(prelude).text()
}
