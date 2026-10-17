// Runs after `vite build` and the server build of src/entry-server.tsx (into dist-ssr, deleted at the end). Writes every page in
// English and Arabic with real markup in <div id="root">: the home, format, About, Privacy and Terms pages are React's own render
// (the browser takes it over with hydrateRoot), the changelog is written by hand below. Plus sitemap.xml and robots.txt. The React page in src/pages/ChangelogPage.tsx shows the same words and structure and takes over
// in the browser: keep the two in step. "New" badges are not written here on purpose: whether a format is new depends on the
// visitor's date, so it is decided in the browser and never frozen into this HTML.
//
// Run with Node 22.6 or newer (`--experimental-strip-types` reads src/viewers.ts as it is).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faqItems } from '../src/content.ts'
import { formatGuides } from '../src/pageContent.ts'
import { CONTACT_EMAIL, infoPages } from '../src/legalContent.ts'
import { CHECK_ICON_PATH, changelogClasses, changelogIds, footerClasses, legalFooterLinks } from '../src/pages/changelogMarkup.ts'
import { SITE_NAME, SITE_ORIGIN, getShareImage, openGraphLocales, pageSeo } from '../src/seo.ts'
import { findViewerByToolPath, landingPages, viewers } from '../src/viewers.ts'
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const distFolder = path.join(projectRoot, 'dist')
const serverBuildFolder = path.join(projectRoot, 'dist-ssr')
const { renderPage } = await import(path.join(serverBuildFolder, 'entry-server.js'))
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'))

const messages = { en: readJson('src/i18n/en.json'), ar: readJson('src/i18n/ar.json') }
const changelog = readJson('src/data/changelog.json')
const locales = ['en', 'ar']

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const translate = (locale, key, values = {}) => messages[locale][key].replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder)
const formatDate = (isoDate, locale) => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`))
const otherLocale = (locale) => (locale === 'en' ? 'ar' : 'en')
// The address of a page in a language: '/csv-viewer' in Arabic is '/ar/csv-viewer', the home page is '/ar'.
const localizePath = (locale, address) => (address === '/' ? `/${locale}` : `/${locale}${address}`)
const viewerById = new Map(viewers.map((viewer) => [viewer.id, viewer]))

// The site footer as src/components/SiteFooter.tsx draws it on the changelog page (without the "New" badges, for the same reason as above).
function renderChangelogFooter(locale) {
  const t = (key, values) => escapeHtml(translate(locale, key, values))
  const f = footerClasses
  const link = (id, address, label) => `<a id="${id}" href="${localizePath(locale, address)}" class="${f.link}">${label}</a>`
  const viewerItems = viewers
    .filter((viewer) => viewer.toolPath)
    .map((viewer) => `<li class="${f.item}">${link(`footer-link-${viewer.id}`, viewer.toolPath, t('viewer.name', { format: viewer.label }))}</li>`)
    .join('')
  const legalItems = legalFooterLinks.map((item) => `<li>${link(item.id, item.path, t(item.labelKey))}</li>`).join('')
  return (
    `<footer id="site-footer" class="${f.footer}"><div class="${f.columns}"><div><p class="${f.brand}">OpenAnyDoc</p><p class="${f.text}">${t('footer.text')}</p></div>` +
    `<nav id="footer-viewers" aria-label="${t('footer.viewers')}"><h2 class="${f.heading}">${t('footer.viewers')}</h2><ul class="${f.list}">${viewerItems}</ul></nav>` +
    `<nav id="footer-more" aria-label="${t('footer.more')}"><h2 class="${f.heading}">${t('footer.more')}</h2><ul class="${f.list}"><li>${link('footer-link-all-types', '/', t('footer.allTypes'))}</li></ul></nav>` +
    `<nav id="footer-legal" aria-label="${t('footer.legal')}"><h2 class="${f.heading}">${t('footer.legal')}</h2><ul class="${f.list}">${legalItems}</ul></nav></div>` +
    `<p id="footer-disclaimer" class="${f.disclaimer}">${t('legal.disclaimer')}</p></footer>`
  )
}

function renderChangelogBody(locale) {
  const t = (key, values) => escapeHtml(translate(locale, key, values))
  const c = changelogClasses
  const entries = changelog
    .map((entry) => {
      const items = entry.items
        .map(
          (itemKey) =>
            `<li class="${c.item}"><svg aria-hidden="true" viewBox="0 0 24 24" class="${c.checkIcon}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${CHECK_ICON_PATH}"></path></svg><span>${t(itemKey)}</span></li>`,
        )
        .join('')
      const links = entry.formats
        .map((viewerId) => {
          const viewer = viewerById.get(viewerId)
          return `<span class="inline-flex items-center"><a id="${changelogIds.tryFormat(entry.version, viewerId)}" href="${localizePath(locale, viewer.toolPath)}" class="${c.formatLink}">${t('viewer.name', { format: viewer.label })}</a></span>`
        })
        .join('')
      return (
        `<li id="${changelogIds.release(entry.version)}" data-file-type="${entry.formats[0]}" class="${c.entry}"><span aria-hidden="true" class="${c.dot}"></span><article class="${c.card}">` +
        `<p class="${c.meta}"><span class="${c.versionPill}">${t('changelog.version', { version: entry.version })}</span><time datetime="${entry.date}">${escapeHtml(formatDate(entry.date, locale))}</time></p>` +
        `<h2 id="${changelogIds.releaseTitle(entry.version)}" class="${c.entryTitle}">${t(entry.title)}</h2><ul class="${c.items}">${items}</ul>` +
        `<p class="${c.tryIt}"><span class="${c.tryItLabel}">${t('changelog.tryIt')}</span>${links}</p></article></li>`
      )
    })
    .join('')
  const other = otherLocale(locale)
  return (
    `<div id="${changelogIds.page}" class="${c.page}">` +
    `<header id="${changelogIds.header}" class="${c.header}"><p><a id="${changelogIds.brandLink}" href="/${locale}" class="${c.brandLink}">OpenAnyDoc</a></p>` +
    `<p><a id="${changelogIds.languageLink}" href="/${other}/changelog" hreflang="${other}" lang="${other}" class="${c.languageLink}">${t('changelog.otherLanguage')}</a></p></header>` +
    `<main id="${changelogIds.main}" class="${c.main}"><div class="${c.intro}"><h1 id="${changelogIds.heading}" class="${c.heading}">${t('changelog.heading')}</h1><p id="${changelogIds.intro}" class="${c.introText}">${t('changelog.intro')}</p></div>` +
    `<ol id="${changelogIds.timeline}" class="${c.timeline}">${entries}</ol><a id="${changelogIds.backLink}" href="/${locale}" class="${c.backLink}">${t('changelog.home')}</a></main>${renderChangelogFooter(locale)}</div>`
  )
}

// What a search result shows: a title of at most 60 characters (65 is the hard stop) and a description of 150 to 160.
function checkSearchSnippet(label, title, description) {
  if (title.length > 65) throw new Error(`${label}: the title is ${title.length} characters (keep it at 60 or fewer).`)
  if (description.length < 150 || description.length > 160) throw new Error(`${label}: the description is ${description.length} characters (it must be 150 to 160).`)
}

// Canonical, language alternates and the share tags (Open Graph, X/Twitter) of a page; `address` is the page without its language.
// src/pages/HomePage.tsx (usePageHead) sets the same tags when the page changes in the browser: keep the two in step.
function renderHeadTags(locale, address, title, description) {
  const pageUrl = `${SITE_ORIGIN}${localizePath(locale, address)}`
  const shareImage = getShareImage(locale, address)
  const imageUrl = `${SITE_ORIGIN}${shareImage.path}`
  return [
    `<link rel="canonical" href="${pageUrl}" />`,
    ...locales.map((alternate) => `<link rel="alternate" hreflang="${alternate}" href="${SITE_ORIGIN}${localizePath(alternate, address)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${localizePath('en', address)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(shareImage.alt)}" />`,
    `<meta property="og:locale" content="${openGraphLocales[locale]}" />`,
    `<meta property="og:locale:alternate" content="${openGraphLocales[otherLocale(locale)]}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
  ].join('\n    ')
}

const indexHtml = fs.readFileSync(path.join(distFolder, 'index.html'), 'utf8')
const assetNames = fs.readdirSync(path.join(distFolder, 'assets'))
function findAsset(pattern) {
  const name = assetNames.find((candidate) => pattern.test(candidate))
  if (!name) throw new Error(`No file in dist/assets matches ${pattern}.`)
  return `/assets/${name}`
}
// Arabic pages fetch their language file (src/i18n/ar.json, loaded by main.tsx before the first render) and the two Arabic font
// weights seen first (headings 700, text 400) right away, instead of after the main script or the stylesheet.
const arabicPreloads = [
  `<link rel="modulepreload" crossorigin href="${findAsset(/^ar-[\w-]+\.js$/)}" />`,
  ...[400, 700].map((weight) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${findAsset(new RegExp(`^ibm-plex-sans-arabic-arabic-${weight}-normal-[\\w-]+\\.woff2$`))}" />`),
].join('\n    ')

// dist/index.html in a language. Only "/" needs /locale-redirect.js (it picks /en or /ar); a page with a language skips that
// render-blocking request.
function pageShell(locale, { keepLocaleRedirect = false } = {}) {
  const page = indexHtml.replace(/<html lang="en">/, `<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`)
  if (keepLocaleRedirect) return page
  return page.replace('<script src="/locale-redirect.js"></script>', locale === 'ar' ? arabicPreloads : '')
}

for (const locale of locales) {
  checkSearchSnippet(`${locale} changelog`, translate(locale, 'changelog.title'), translate(locale, 'changelog.description'))
  const title = translate(locale, 'changelog.title')
  const description = translate(locale, 'changelog.description')
  const page = pageShell(locale)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace('</head>', `  ${renderHeadTags(locale, '/changelog', title, description)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderChangelogBody(locale)}</div>`)
  if (!page.includes('id="main"')) throw new Error(`Could not write the ${locale} changelog: dist/index.html has a different shape than expected.`)
  const pageFolder = path.join(distFolder, locale, 'changelog')
  fs.mkdirSync(pageFolder, { recursive: true })
  fs.writeFileSync(path.join(pageFolder, 'index.html'), page)
}

// ---------------------------------------------------------------- home and format pages: real <head> for search and sharing

const jsonLdScript = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

// `address` is the page without its language ('/' or '/csv-viewer'); the page is written once per language. `rootMarkup` is React's
// render of the page, or empty for an address the browser draws by itself.
function renderSeoPage(locale, address, rootMarkup, shellOptions) {
  const seo = pageSeo[locale][address]
  const pageUrl = `${SITE_ORIGIN}${localizePath(locale, address)}`
  const viewer = findViewerByToolPath(address)
  // A landing page (/json-formatter) sits under its viewer's page in the breadcrumb: Home › JSON viewer › JSON formatter.
  const landingPage = landingPages.find((page) => page.path === address)
  const parentAddress = landingPage && viewers.find((candidate) => candidate.id === landingPage.viewerId).toolPath
  // A format or landing page's "What it handles" lines are its application's feature list: true features only.
  const guide = formatGuides[locale][address]
  const structuredData = []
  if (address === '/') {
    structuredData.push(
      { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, alternateName: ['Open Any Doc', 'OpenAnyDoc.com'], url: pageUrl, inLanguage: locale },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: `${SITE_ORIGIN}/logo.png`,
        email: CONTACT_EMAIL,
        founder: { '@type': 'Person', name: 'Shahzad Ali' },
      },
    )
  }
  if (viewer) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': ['SoftwareApplication', 'WebApplication'],
      name: `${SITE_NAME} ${seo.linkText}`,
      url: pageUrl,
      inLanguage: locale,
      description: seo.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: guide.handles,
    })
  }
  // The questions published as data are exactly the ones the page shows: the home page's, or this format's own.
  const questions = address === '/' ? faqItems[locale] : (guide?.faq ?? [])
  if (questions.length > 0) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
    })
  }
  if (address !== '/') {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: SITE_NAME, item: `${SITE_ORIGIN}${localizePath(locale, '/')}` },
        ...(parentAddress ? [{ name: pageSeo[locale][parentAddress].linkText, item: `${SITE_ORIGIN}${localizePath(locale, parentAddress)}` }] : []),
        { name: seo.heading, item: pageUrl },
      ].map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
    })
  }
  const head = [renderHeadTags(locale, address, seo.title, seo.description), ...structuredData.map(jsonLdScript)].join('\n    ')
  checkSearchSnippet(`${locale} ${address}`, seo.title, seo.description)
  return pageShell(locale, shellOptions)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`)
    .replace('</head>', `  ${head}\n  </head>`)
    // A function, so a "$" in the markup is never read as a replacement pattern.
    .replace('<div id="root"></div>', () => (rootMarkup ? `<div id="root" data-prerendered>${rootMarkup}</div>` : '<div id="root"></div>'))
}

const seoAddresses = Object.keys(pageSeo.en)
const seoTitles = locales.flatMap((locale) => seoAddresses.map((address) => pageSeo[locale][address].title))
if (new Set(seoTitles).size !== seoTitles.length) throw new Error('Two pages have the same title: every page needs its own.')
for (const locale of locales) {
  for (const address of seoAddresses) {
    const pageFolder = path.join(distFolder, localizePath(locale, address))
    fs.mkdirSync(pageFolder, { recursive: true })
    fs.writeFileSync(path.join(pageFolder, 'index.html'), renderSeoPage(locale, address, await renderPage(locale, address)))
  }
}
// "/" has no language of its own: /locale-redirect.js sends the visitor to /en or /ar. Its HTML is the English home page's head
// pointing at /en (indexHtml was read before any page was written). Its root stays empty because the host also serves this file
// for unknown addresses, which the browser draws by itself.
fs.writeFileSync(path.join(distFolder, 'index.html'), renderSeoPage('en', '/', '', { keepLocaleRedirect: true }))

// The day a page last changed, for the sitemap's <lastmod>: the date of the last commit that touched the page's source files.
// The Cloudflare build may clone only the newest commit (a shallow clone, where every file looks changed that day) or have no
// git at all; then every page gets the newest release date from the changelog instead.
const newestChangeDate = changelog[0].date
const hasFullGitHistory = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'false'
  } catch {
    return false
  }
})()
function lastChangeDate(sourceFiles) {
  if (!hasFullGitHistory) return newestChangeDate
  const commitDate = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...sourceFiles], { cwd: projectRoot, encoding: 'utf8' }).trim()
  return commitDate || newestChangeDate
}
function pageSourceFiles(address) {
  if (address === '/') return ['src/seo.ts', 'src/content.ts', 'src/pages/HomePage.tsx', 'src/components/AboutSections.tsx']
  if (infoPages.en[address]) return ['src/seo.ts', 'src/legalContent.ts', 'src/pages/InfoPage.tsx']
  return ['src/seo.ts', 'src/pageContent.ts', 'src/pages/HomePage.tsx', 'src/components/FormatGuide.tsx']
}
const changelogLastChange = lastChangeDate(['src/data/changelog.json', 'src/pages/ChangelogPage.tsx'])

// Only pages that work as a page: no /view-* addresses (they exist only for a file open in one visitor's browser).
const changelogAlternates = [
  ...locales.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_ORIGIN}/${locale}/changelog"/>`),
  `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/changelog"/>`,
].join('')
const pageAlternates = (address) =>
  [...locales.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_ORIGIN}${localizePath(locale, address)}"/>`), `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${localizePath('en', address)}"/>`].join('')
const sitemapEntries = [
  ...locales.flatMap((locale) =>
    seoAddresses.map((address) => `<url><loc>${SITE_ORIGIN}${localizePath(locale, address)}</loc><lastmod>${lastChangeDate(pageSourceFiles(address))}</lastmod>${pageAlternates(address)}</url>`),
  ),
  ...locales.map((locale) => `<url><loc>${SITE_ORIGIN}/${locale}/changelog</loc><lastmod>${changelogLastChange}</lastmod>${changelogAlternates}</url>`),
]
fs.writeFileSync(
  path.join(distFolder, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries.join('\n')}\n</urlset>\n`,
)
fs.writeFileSync(path.join(distFolder, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)
fs.rmSync(serverBuildFolder, { recursive: true, force: true })
console.log(`Wrote ${seoAddresses.length * locales.length} prerendered pages, ${locales.length} changelog pages, sitemap.xml (lastmod from ${hasFullGitHistory ? 'git' : `the newest release, ${newestChangeDate}: no full git history`}) and robots.txt into dist/`)
