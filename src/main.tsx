import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.tsx'
import { getBrowserLocale, loadLocale, splitLocalePath } from './i18n'
import { loadToolPageWords } from './seo'
import './index.css'

const rootElement = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)
// Pages the build rendered with React (src/entry-server.tsx) are taken over as they are. Any other address starts empty, and the
// changelog's hand-written markup (not React's) is replaced.
// The page's language file, and a tool page's words, must be there before the first render (an address without a language
// follows the browser).
const { locale: addressLocale, path } = splitLocalePath(window.location.pathname)
// The same language App resolves: the browser's on the home page, English for any other address without one.
const locale = addressLocale ?? (path === '/' ? getBrowserLocale() : 'en')
void Promise.all([loadLocale(locale), loadToolPageWords(locale, path)]).then(() => {
  if (rootElement.hasAttribute('data-prerendered')) hydrateRoot(rootElement, app)
  else createRoot(rootElement).render(app)
})
