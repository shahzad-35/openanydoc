// Runs after `vite build` and the server build of src/entry-server.tsx (into dist-ssr, deleted at the end). Writes every page in
// English and Arabic with real markup in <div id="root">: the home, format, About, Privacy and Terms pages are React's own render
// (the browser takes it over with hydrateRoot), the changelog is written by hand below. Plus sitemap.xml and robots.txt. The React page in src/pages/ChangelogPage.tsx shows the same words and structure and takes over
// in the browser: keep the two in step. "New" badges are not written here on purpose: whether a format is new depends on the
// visitor's date, so it is decided in the browser and never frozen into this HTML.
//
// Run with Node 22.6 or newer (`--experimental-strip-types` reads src/viewers.ts as it is).

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faqItems } from '../src/content.ts'
import { formatGuides } from '../src/pageContent.ts'
import { guidePages } from '../src/guides.ts'
import { CONTACT_EMAIL, infoPages } from '../src/legalContent.ts'
import { BREADCRUMB_CHEVRON_PATH, CHECK_ICON_PATH, SEARCH_ICON_PATH, SOCIAL_ICON_PATHS, breadcrumbClasses, headerRowBreak, changelogClasses, changelogIds, footerClasses, legalFooterLinks, navClasses, searchBoxFormats } from '../src/pages/changelogMarkup.ts'
import { AUTHOR_NAME, REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, SOCIAL_PROFILES, X_HANDLE, SITE_ORIGIN, getShareImage, openGraphLocales, pageSeo } from '../src/seo.ts'
import { findBreadcrumbParent, findViewerByToolPath, landingPages, viewers } from '../src/viewers.ts'
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

// The header's closed search box as src/components/SiteNav.tsx draws it on the changelog page; React adds the results panel.
function renderChangelogNav(locale) {
  const label = escapeHtml(translate(locale, 'search.label'))
  // The classes hold "&" (arbitrary variants), which React writes as &amp;.
  const n = Object.fromEntries(Object.entries(navClasses).map(([part, classes]) => [part, escapeHtml(classes)]))
  const formatBlocks = searchBoxFormats.map((format) => `<span class="nav-icon nav-icon-${format}"></span>`).join('')
  return (
    `<nav id="site-nav" aria-label="${label}" class="${n.nav}"><button id="site-search-button" type="button" class="${n.searchButton}" aria-haspopup="dialog" aria-expanded="false">` +
    `<svg aria-hidden="true" viewBox="0 0 24 24" class="${n.searchIcon}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${SEARCH_ICON_PATH}"></path></svg>` +
    `<span class="${n.searchLabel}">${escapeHtml(translate(locale, 'search.button'))}</span><span class="${n.searchFormats}" aria-hidden="true">${formatBlocks}</span></button></nav>`
  )
}

// The site footer as src/components/SiteFooter.tsx draws it on the changelog page, without the format glyphs and the "New" badges
// (the changelog page is not hydrated, so React redraws the footer with them as soon as it loads).
function renderChangelogFooter(locale) {
  const t = (key, values) => escapeHtml(translate(locale, key, values))
  const f = footerClasses
  const link = (id, address, label) => `<a id="${id}" href="${localizePath(locale, address)}" class="${f.link}">${label}</a>`
  const item = (content) => `<li class="${f.item}">${content}</li>`
  const viewerItems = viewers
    .filter((viewer) => viewer.toolPath)
    .map((viewer) => item(link(`footer-link-${viewer.id}`, viewer.toolPath, t('viewer.name', { format: viewer.label }))))
    .join('')
  const moreItems =
    landingPages
      .map((page) => item(link(`footer-link-${page.path.slice(1)}`, page.path, escapeHtml(pageSeo[locale][page.path].linkText))))
      .join('') +
    item(link('footer-link-guides', '/guides', escapeHtml(pageSeo[locale]['/guides'].linkText))) +
    item(link('footer-link-all-types', '/', t('footer.allTypes')))
  const legalItems =
    legalFooterLinks.map((entry) => item(link(entry.id, entry.path, t(entry.labelKey)))).join('') +
    item(`<a id="footer-link-contact" href="mailto:${CONTACT_EMAIL}" class="${f.link}">${t('footer.contact')}</a>`)
  const socialItems = SOCIAL_PROFILES.map(
    (profile) =>
      `<li><a id="footer-link-${profile.id}" href="${profile.url}" rel="me noopener" aria-label="${t('footer.socialProfile', { name: profile.name })}" class="${f.socialLink}">` +
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${SOCIAL_ICON_PATHS[profile.id]}"></path></svg></a></li>`,
  ).join('')
  // The wordmark with the brand mark, as src/components/KitIcon.tsx draws it.
  const wordmark = '<span dir="ltr" class="wordmark"><img src="/favicon.svg" alt="" width="34" height="34" class="wordmark-mark">open<span class="text-accent">any</span>doc</span>'
  const column = (id, headingKey, items, className) => `<nav id="${id}" aria-label="${t(headingKey)}"${className ? ` class="${className}"` : ''}><h2 class="${f.heading}">${t(headingKey)}</h2><ul class="${f.list}">${items}</ul></nav>`
  return (
    `<footer id="site-footer" class="${f.footer}"><div class="${f.inner}"><div class="${f.columns}">` +
    `<div class="${f.brand}"><p class="${f.brandMark}">${wordmark}</p><p class="${f.brandText}">${t('footer.text')}</p>` +
    `<nav id="footer-social" aria-label="${t('footer.follow')}"><ul class="${f.socialList}">${socialItems}</ul></nav></div>` +
    column('footer-viewers', 'footer.viewers', viewerItems, f.viewersColumn) +
    column('footer-more', 'about.moreFileTools', moreItems) +
    column('footer-legal', 'footer.legal', legalItems) +
    `</div><div class="${f.bottom}"><p id="footer-disclaimer" class="${f.disclaimer}">${t('legal.disclaimer')}</p></div></div></footer>`
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
    `<header id="${changelogIds.header}" class="${c.header}"><p><a id="${changelogIds.brandLink}" href="/${locale}" class="${c.brandLink}"><span dir="ltr" class="wordmark"><img src="/favicon.svg" alt="" width="34" height="34" class="wordmark-mark">open<span class="text-accent">any</span>doc</span></a></p><span aria-hidden="true" class="${headerRowBreak}"></span>${renderChangelogNav(locale)}` +
    `<p><a id="${changelogIds.languageLink}" href="/${other}/changelog" hreflang="${other}" lang="${other}" class="${c.languageLink}">${t('changelog.otherLanguage')}</a></p></header>` +
    `<main id="${changelogIds.main}" class="${c.main}"><div class="${c.intro}">` +
    `<nav id="breadcrumb" aria-label="${t('breadcrumb.label')}" class="${breadcrumbClasses.nav}"><ol class="${breadcrumbClasses.list}"><li class="${breadcrumbClasses.item}"><a id="breadcrumb-link-home" href="/${locale}" class="${breadcrumbClasses.link}">${t('breadcrumb.home')}</a><svg aria-hidden="true" viewBox="0 0 24 24" class="${breadcrumbClasses.separator}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${BREADCRUMB_CHEVRON_PATH}"></path></svg></li><li class="${breadcrumbClasses.item}"><span aria-current="page" class="${breadcrumbClasses.current}">${t('breadcrumb.changelog')}</span></li></ol></nav>` +
    `<h1 id="${changelogIds.heading}" class="${c.heading}">${t('changelog.heading')}</h1><p id="${changelogIds.intro}" class="${c.introText}">${t('changelog.intro')}</p></div>` +
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
    `<meta name="twitter:site" content="${X_HANDLE}" />`,
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
// The fonts seen first on a page are fetched right away instead of after the stylesheet: the wordmark and headings (Fredoka 700 and
// 500, Baloo Bhaijaan 2 700 in Arabic) and the body text (Nunito Sans 400, IBM Plex Sans Arabic 400 and 700). Arabic pages also fetch
// their language file (src/i18n/ar.json, loaded by main.tsx before the first render).
const preloadedFonts = {
  en: [/^fredoka-latin-700-normal-[\w-]+\.woff2$/, /^fredoka-latin-500-normal-[\w-]+\.woff2$/, /^nunito-sans-latin-400-normal-[\w-]+\.woff2$/].map(findAsset),
  ar: [/^ibm-plex-sans-arabic-arabic-400-normal-[\w-]+\.woff2$/, /^ibm-plex-sans-arabic-arabic-700-normal-[\w-]+\.woff2$/, /^baloo-bhaijaan-2-arabic-700-normal-[\w-]+\.woff2$/].map(findAsset),
}
const fontPreloadTag = (asset) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${asset}" />`
const preloadTags = {
  en: preloadedFonts.en.map(fontPreloadTag).join('\n    '),
  ar: [`<link rel="modulepreload" crossorigin href="${findAsset(/^ar-[\w-]+\.js$/)}" />`, ...preloadedFonts.ar.map(fontPreloadTag)].join('\n    '),
}

// The theme script is inline in index.html (no render-blocking request) and so is the stylesheet (17 KB gzipped: one round trip
// less before the first paint); the Content-Security-Policy allows exactly those two by their hashes. The same fonts go into Link
// headers, so Cloudflare's Early Hints can announce them before the HTML.
const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`
const inlineThemeScript = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1]
if (!inlineThemeScript) throw new Error('index.html has no inline theme script to allow in the Content-Security-Policy.')
const stylesheetTag = /<link rel="stylesheet"[^>]*href="(\/assets\/index-[\w-]+\.css)"[^>]*>/.exec(indexHtml)
if (!stylesheetTag) throw new Error('dist/index.html has no stylesheet link to inline.')
const stylesheetText = fs.readFileSync(path.join(distFolder, stylesheetTag[1]), 'utf8')
const headersFile = path.join(distFolder, '_headers')
const earlyHintHeader = (locale) => `  Link: ${preloadedFonts[locale].map((asset) => `<${asset}>; rel=preload; as=font; crossorigin`).join(', ')}`
fs.writeFileSync(
  headersFile,
  fs.readFileSync(headersFile, 'utf8').replace("script-src 'self'", `script-src 'self' ${sha256(inlineThemeScript)}`).replace("style-src 'self'", `style-src 'self' ${sha256(stylesheetText)}`) +
    locales.map((locale) => `\n/${locale}\n${earlyHintHeader(locale)}\n\n/${locale}/*\n${earlyHintHeader(locale)}\n`).join(''),
)

// dist/index.html in a language. Only "/" needs /locale-redirect.js (it picks /en or /ar); a page with a language skips that
// render-blocking request.
function pageShell(locale, { keepLocaleRedirect = false } = {}) {
  const page = indexHtml.replace(/<html lang="en">/, `<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`).replace(stylesheetTag[0], () => `<style>${stylesheetText}</style>`)
  if (keepLocaleRedirect) return page
  return page.replace('<script src="/locale-redirect.js"></script>', preloadTags[locale])
}

// A real "not found" page in each language: Cloudflare serves the nearest 404.html with status 404 (wrangler.jsonc). It is static
// (no app script), so the browser does not redraw it as the home page, and it tells search engines not to index it.
function renderNotFoundPage(locale) {
  const t = (key, values) => escapeHtml(translate(locale, key, values))
  const c = changelogClasses
  const other = otherLocale(locale)
  const viewerLinks = viewers
    .filter((viewer) => viewer.toolPath)
    .map((viewer) => `<li><a id="not-found-link-${viewer.id}" href="${localizePath(locale, viewer.toolPath)}" class="${c.formatLink}">${t('viewer.name', { format: viewer.label })}</a></li>`)
    .join('')
  const body =
    `<div id="not-found-page" class="${c.page}">` +
    `<header id="${changelogIds.header}" class="${c.header}"><p><a id="${changelogIds.brandLink}" href="/${locale}" class="${c.brandLink}"><span dir="ltr" class="wordmark"><img src="/favicon.svg" alt="" width="34" height="34" class="wordmark-mark">open<span class="text-accent">any</span>doc</span></a></p><span aria-hidden="true" class="${headerRowBreak}"></span>${renderChangelogNav(locale)}` +
    `<p><a id="${changelogIds.languageLink}" href="/${other}" hreflang="${other}" lang="${other}" class="${c.languageLink}">${t('changelog.otherLanguage')}</a></p></header>` +
    `<main id="main" class="${c.main}"><div class="${c.intro}"><h1 id="page-heading" class="${c.heading}">${t('notFound.heading')}</h1><p id="page-intro" class="${c.introText}">${t('notFound.text')}</p></div>` +
    `<ul id="not-found-links" class="mt-8 flex flex-wrap gap-3">${viewerLinks}</ul><a id="not-found-home-link" href="/${locale}" class="${c.backLink}">${t('changelog.home')}</a></main>${renderChangelogFooter(locale)}</div>`
  return pageShell(locale)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t('notFound.title')}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${t('notFound.text')}$2`)
    .replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>')
    .replace(/\s*<script type="module"[^>]*><\/script>/, '')
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
}
fs.writeFileSync(path.join(distFolder, '404.html'), renderNotFoundPage('en'))
fs.mkdirSync(path.join(distFolder, 'ar'), { recursive: true })
fs.writeFileSync(path.join(distFolder, 'ar', '404.html'), renderNotFoundPage('ar'))

// The site's entities, named once by @id so every page's data points at the same organisation and website.
const organizationId = `${SITE_ORIGIN}/#organization`
const websiteId = `${SITE_ORIGIN}/#website`

const jsonLdScript = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

function changelogBreadcrumb(locale) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: translate(locale, 'breadcrumb.home'), item: `${SITE_ORIGIN}${localizePath(locale, '/')}` },
      { '@type': 'ListItem', position: 2, name: translate(locale, 'breadcrumb.changelog'), item: `${SITE_ORIGIN}${localizePath(locale, '/changelog')}` },
    ],
  })
}

for (const locale of locales) {
  checkSearchSnippet(`${locale} changelog`, translate(locale, 'changelog.title'), translate(locale, 'changelog.description'))
  const title = translate(locale, 'changelog.title')
  const description = translate(locale, 'changelog.description')
  const page = pageShell(locale)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace('</head>', `  ${renderHeadTags(locale, '/changelog', title, description)}\n    ${changelogBreadcrumb(locale)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderChangelogBody(locale)}</div>`)
  if (!page.includes('id="main"')) throw new Error(`Could not write the ${locale} changelog: dist/index.html has a different shape than expected.`)
  const pageFolder = path.join(distFolder, locale, 'changelog')
  fs.mkdirSync(pageFolder, { recursive: true })
  fs.writeFileSync(path.join(pageFolder, 'index.html'), page)
}

// ---------------------------------------------------------------- home and format pages: real <head> for search and sharing


// `address` is the page without its language ('/' or '/csv-viewer'); the page is written once per language. `rootMarkup` is React's
// render of the page, or empty for an address the browser draws by itself.
function renderSeoPage(locale, address, rootMarkup, shellOptions) {
  const seo = pageSeo[locale][address]
  const pageUrl = `${SITE_ORIGIN}${localizePath(locale, address)}`
  const viewer = findViewerByToolPath(address)
  const parentAddress = findBreadcrumbParent(address, Boolean(guidePages.en[address]))
  // A format or landing page's "What it handles" lines are its application's feature list: true features only.
  const guide = formatGuides[locale][address]
  const structuredData = []
  if (address === '/') {
    structuredData.push(
      { '@context': 'https://schema.org', '@type': 'WebSite', '@id': websiteId, name: SITE_NAME, alternateName: ['Open Any Doc', 'OpenAnyDoc.com'], url: pageUrl, inLanguage: locale, description: SITE_DESCRIPTION[locale], publisher: { '@id': organizationId } },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        description: SITE_DESCRIPTION[locale],
        url: SITE_ORIGIN,
        logo: `${SITE_ORIGIN}/logo.png`,
        email: CONTACT_EMAIL,
        contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: CONTACT_EMAIL, availableLanguage: ['en', 'ar'] },
        foundingDate: '2026-10',
        founder: { '@type': 'Person', name: AUTHOR_NAME },
        sameAs: [REPOSITORY_URL, ...SOCIAL_PROFILES.map((profile) => profile.url)],
      },
      // The product as a whole; its features are the tools it links to, by their page names.
      {
        '@context': 'https://schema.org',
        '@type': ['SoftwareApplication', 'WebApplication'],
        name: SITE_NAME,
        url: pageUrl,
        inLanguage: locale,
        description: SITE_DESCRIPTION[locale],
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any (web browser)',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [...viewers.filter((tool) => tool.toolPath).map((tool) => tool.toolPath), ...landingPages.map((page) => page.path)].map((toolAddress) => pageSeo[locale][toolAddress].linkText),
        publisher: { '@id': organizationId },
      },
    )
  }
  // The guides index lists every published guide, in the order it shows them.
  if (address === '/guides') {
    const publishedGuides = Object.entries(guidePages[locale]).filter(([, guide]) => guide.published)
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.heading,
      url: pageUrl,
      inLanguage: locale,
      description: seo.description,
      isPartOf: { '@id': websiteId },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: publishedGuides.map(([guideAddress], index) => ({ '@type': 'ListItem', position: index + 1, name: pageSeo[locale][guideAddress].heading, url: `${SITE_ORIGIN}${localizePath(locale, guideAddress)}` })),
      },
    })
  }
  // The About page is the author's page; a guide is an article with its author and dates (the byline InfoPage draws).
  if (address === '/about') {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: pageUrl,
      inLanguage: locale,
      mainEntity: { '@type': 'Person', name: AUTHOR_NAME, url: pageUrl, email: CONTACT_EMAIL, sameAs: [REPOSITORY_URL], knowsAbout: ['CSV files', 'Excel workbooks', 'JSON', 'text encodings', 'Arabic and right-to-left text'] },
    })
  }
  const guidePage = guidePages[locale][address]
  if (guidePage?.published) {
    const shareImage = getShareImage(locale, address)
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: seo.heading,
      description: seo.description,
      image: `${SITE_ORIGIN}${shareImage.path}`,
      datePublished: `${guidePage.published}T00:00:00+00:00`,
      dateModified: `${guidePage.updated ?? guidePage.published}T00:00:00+00:00`,
      author: { '@type': 'Person', name: AUTHOR_NAME, url: `${SITE_ORIGIN}${localizePath(locale, '/about')}` },
      publisher: { '@type': 'Organization', '@id': organizationId, name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo.png` } },
      mainEntityOfPage: pageUrl,
      inLanguage: locale,
    })
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
      publisher: { '@id': organizationId },
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
        // The same trail and names as the breadcrumb on the page (PageBreadcrumb in src/components/SiteFooter.tsx).
        { name: translate(locale, 'breadcrumb.home'), item: `${SITE_ORIGIN}${localizePath(locale, '/')}` },
        ...(parentAddress ? [{ name: pageSeo[locale][parentAddress].linkText ?? pageSeo[locale][parentAddress].heading, item: `${SITE_ORIGIN}${localizePath(locale, parentAddress)}` }] : []),
        { name: seo.linkText ?? seo.heading, item: pageUrl },
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
// What a reader sees of a page: its title, description and the text of its <main> without the breadcrumb. Tags and attributes are
// left out, so a new class or asset name is not a content change, and neither is shared chrome (a new tool page adds a footer link
// everywhere; renaming a viewer changes its landing pages' breadcrumbs).
function hashPageContent(seo, rootMarkup) {
  const mainMarkup = (rootMarkup.match(/<main[\s\S]*<\/main>/)?.[0] ?? rootMarkup).replace(/<nav id="breadcrumb"[\s\S]*?<\/nav>/, '')
  const mainText = mainMarkup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(`${seo.title}\n${seo.description}\n${mainText}`).digest('hex')
}
const pageContentHashes = new Map()
for (const locale of locales) {
  for (const address of seoAddresses) {
    const pageFolder = path.join(distFolder, localizePath(locale, address))
    fs.mkdirSync(pageFolder, { recursive: true })
    const rootMarkup = await renderPage(locale, address)
    pageContentHashes.set(localizePath(locale, address), hashPageContent(pageSeo[locale][address], rootMarkup))
    fs.writeFileSync(path.join(pageFolder, 'index.html'), renderSeoPage(locale, address, rootMarkup))
  }
}
// "/" has no language of its own: /locale-redirect.js sends the visitor to /en or /ar. Its HTML is the English home page's head
// pointing at /en (indexHtml was read before any page was written). Its root stays empty because the host also serves this file
// for unknown addresses, which the browser draws by itself.
fs.writeFileSync(path.join(distFolder, 'index.html'), renderSeoPage('en', '/', '', { keepLocaleRedirect: true }))

// The date of the last commit that touched a page's source files: the starting <lastmod> of a page new to src/data/pageDates.json,
// and the changelog's.
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
  if (guidePages.en[address]) return ['src/seo.ts', 'src/guides.ts', 'src/pages/InfoPage.tsx']
  return ['src/seo.ts', 'src/pageContent.ts', 'src/pages/HomePage.tsx', 'src/components/FormatGuide.tsx']
}
const changelogLastChange = lastChangeDate(['src/data/changelog.json', 'src/pages/ChangelogPage.tsx'])

// The day each page's content last changed, kept with its content hash in src/data/pageDates.json; commit that file with the
// change. A page whose hash differs from the stored one gets today's date; a page new to the file starts from its git date. So a
// copy edit in a shared file (src/seo.ts) moves only the pages whose words changed, and a shallow clone keeps the real dates.
const pageDatesFile = path.join(projectRoot, 'src', 'data', 'pageDates.json')
const storedPageDates = fs.existsSync(pageDatesFile) ? JSON.parse(fs.readFileSync(pageDatesFile, 'utf8')) : {}
const today = new Date().toISOString().slice(0, 10)
const pageDates = {}
const pagesWithNewDate = []
for (const locale of locales) {
  for (const address of seoAddresses) {
    const localizedAddress = localizePath(locale, address)
    const hash = pageContentHashes.get(localizedAddress)
    const stored = storedPageDates[localizedAddress]
    if (stored?.hash === hash) {
      pageDates[localizedAddress] = stored
      continue
    }
    pageDates[localizedAddress] = { hash, date: stored ? today : lastChangeDate(pageSourceFiles(address)) }
    pagesWithNewDate.push(localizedAddress)
  }
}
if (pagesWithNewDate.length > 0) {
  fs.writeFileSync(pageDatesFile, `${JSON.stringify(pageDates, null, 2)}\n`)
  console.log(`New lastmod for ${pagesWithNewDate.length} page(s), saved in src/data/pageDates.json (commit it): ${pagesWithNewDate.join(', ')}`)
}

// Only pages that work as a page: no /view-* addresses (they exist only for a file open in one visitor's browser).
const changelogAlternates = [
  ...locales.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_ORIGIN}/${locale}/changelog"/>`),
  `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/changelog"/>`,
].join('')
const pageAlternates = (address) =>
  [...locales.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_ORIGIN}${localizePath(locale, address)}"/>`), `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${localizePath('en', address)}"/>`].join('')
const sitemapEntries = [
  ...locales.flatMap((locale) =>
    seoAddresses.map((address) => `<url><loc>${SITE_ORIGIN}${localizePath(locale, address)}</loc><lastmod>${pageDates[localizePath(locale, address)].date}</lastmod>${pageAlternates(address)}</url>`),
  ),
  ...locales.map((locale) => `<url><loc>${SITE_ORIGIN}/${locale}/changelog</loc><lastmod>${changelogLastChange}</lastmod>${changelogAlternates}</url>`),
]
fs.writeFileSync(
  path.join(distFolder, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries.join('\n')}\n</urlset>\n`,
)
fs.writeFileSync(path.join(distFolder, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)
fs.rmSync(serverBuildFolder, { recursive: true, force: true })
console.log(`Wrote ${seoAddresses.length * locales.length} prerendered pages, ${locales.length} changelog pages, sitemap.xml (lastmod from src/data/pageDates.json) and robots.txt into dist/`)
