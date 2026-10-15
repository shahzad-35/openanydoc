// The home page (/) has no language of its own: it sends the visitor to /ar or /en by the browser's language.
// Other old addresses are redirected by _redirects (and by the app, for the development server).
if (location.pathname === '/') {
  const languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]
  const preferred = languages.map((language) => language.toLowerCase().slice(0, 2)).find((code) => code === 'ar' || code === 'en')
  location.replace('/' + (preferred === 'ar' ? 'ar' : 'en') + location.search + location.hash)
}
