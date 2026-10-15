// Runs after `vite build`. Writes real, readable HTML for the changelog in English and Arabic (so search engines see the content),
// plus sitemap.xml and robots.txt. The React page in src/pages/ChangelogPage.tsx shows the same words and structure and takes over
// in the browser: keep the two in step. "New" badges are not written here on purpose: whether a format is new depends on the
// visitor's date, so it is decided in the browser and never frozen into this HTML.
//
// Run with Node 22.6 or newer (`--experimental-strip-types` reads src/viewers.ts as it is).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faqItems, features } from '../src/content.ts'
import { formatGuides } from '../src/pageContent.ts'
import { CHECK_ICON_PATH, changelogClasses } from '../src/pages/changelogMarkup.ts'
import { SITE_NAME, SITE_ORIGIN, pageSeo } from '../src/seo.ts'
import { viewers } from '../src/viewers.ts'
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const distFolder = path.join(projectRoot, 'dist')
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'))

const messages = { en: readJson('src/i18n/en.json'), ar: readJson('src/i18n/ar.json') }
const changelog = readJson('src/data/changelog.json')
const locales = ['en', 'ar']

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const translate = (locale, key, values = {}) => messages[locale][key].replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder)
const formatDate = (isoDate, locale) => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`))
const otherLocale = (locale) => (locale === 'en' ? 'ar' : 'en')
const viewerById = new Map(viewers.map((viewer) => [viewer.id, viewer]))

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
          return `<span class="inline-flex items-center"><a href="${viewer.toolPath}" class="${c.formatLink}">${t('viewer.name', { format: viewer.label })}</a></span>`
        })
        .join('')
      return (
        `<li data-file-type="${entry.formats[0]}" class="${c.entry}"><span aria-hidden="true" class="${c.dot}"></span><article class="${c.card}">` +
        `<p class="${c.meta}"><span class="${c.versionPill}">${t('changelog.version', { version: entry.version })}</span><time datetime="${entry.date}">${escapeHtml(formatDate(entry.date, locale))}</time></p>` +
        `<h2 class="${c.entryTitle}">${t(entry.title)}</h2><ul class="${c.items}">${items}</ul>` +
        `<p class="${c.tryIt}"><span class="${c.tryItLabel}">${t('changelog.tryIt')}</span>${links}</p></article></li>`
      )
    })
    .join('')
  const other = otherLocale(locale)
  return (
    `<div class="${c.page}">` +
    `<header class="${c.header}"><p><a href="/" class="${c.brandLink}">OpenAnyDoc</a></p>` +
    `<p><a href="/${other}/changelog" hreflang="${other}" lang="${other}" class="${c.languageLink}">${t('changelog.otherLanguage')}</a></p></header>` +
    `<main id="main" class="${c.main}"><div class="${c.intro}"><h1 class="${c.heading}">${t('changelog.heading')}</h1><p class="${c.introText}">${t('changelog.intro')}</p></div>` +
    `<ol class="${c.timeline}">${entries}</ol><a href="/" class="${c.backLink}">${t('changelog.home')}</a></main></div>`
  )
}

// What a search result shows: a title of at most 60 characters (65 is the hard stop) and a description of 120 to 160.
function checkSearchSnippet(label, title, description) {
  if (title.length > 65) throw new Error(`${label}: the title is ${title.length} characters (keep it at 60 or fewer).`)
  if (description.length < 110 || description.length > 165) throw new Error(`${label}: the description is ${description.length} characters (aim for 120 to 160).`)
}

function renderSocialTags(title, description, address) {
  return [
    `<meta property="og:type" content="website" data-changelog-head />`,
    `<meta property="og:site_name" content="${SITE_NAME}" data-changelog-head />`,
    `<meta property="og:title" content="${escapeHtml(title)}" data-changelog-head />`,
    `<meta property="og:description" content="${escapeHtml(description)}" data-changelog-head />`,
    `<meta property="og:url" content="${address}" data-changelog-head />`,
    `<meta name="twitter:card" content="summary" data-changelog-head />`,
  ].join('\n    ')
}

function renderHead(locale) {
  const alternates = [
    `<link rel="canonical" href="${SITE_ORIGIN}/${locale}/changelog" data-changelog-head />`,
    `<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/en/changelog" data-changelog-head />`,
    `<link rel="alternate" hreflang="ar" href="${SITE_ORIGIN}/ar/changelog" data-changelog-head />`,
    `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/changelog" data-changelog-head />`,
  ]
  const title = translate(locale, 'changelog.title')
  const description = translate(locale, 'changelog.description')
  return [...alternates, renderSocialTags(title, description, `${SITE_ORIGIN}/${locale}/changelog`)].join('\n    ')
}

const indexHtml = fs.readFileSync(path.join(distFolder, 'index.html'), 'utf8')

for (const locale of locales) {
  checkSearchSnippet(`${locale} changelog`, translate(locale, 'changelog.title'), translate(locale, 'changelog.description'))
  const title = escapeHtml(translate(locale, 'changelog.title'))
  const description = escapeHtml(translate(locale, 'changelog.description'))
  const page = indexHtml
    .replace(/<html lang="en">/, `<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace('</head>', `  ${renderHead(locale)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderChangelogBody(locale)}</div>`)
  if (!page.includes('id="main"')) throw new Error(`Could not write the ${locale} changelog: dist/index.html has a different shape than expected.`)
  const pageFolder = path.join(distFolder, locale, 'changelog')
  fs.mkdirSync(pageFolder, { recursive: true })
  fs.writeFileSync(path.join(pageFolder, 'index.html'), page)
}

// ---------------------------------------------------------------- home and format pages: real <head> for search and sharing

const jsonLdScript = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

function renderSeoPage(address) {
  const seo = pageSeo[address]
  const pageUrl = `${SITE_ORIGIN}${address === '/' ? '/' : address}`
  const viewer = viewers.find((candidate) => candidate.toolPath === address)
  const liveViewers = viewers.filter((candidate) => candidate.toolPath)
  const application = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: pageUrl,
    description: seo.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: liveViewers.map((candidate) => candidate.description),
  }
  const structuredData = [application]
  // The questions published as data are exactly the ones the page shows: the home page's, or this format's own.
  const guide = formatGuides[address]
  const questions = address === '/' ? faqItems : (guide?.faq ?? [])
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
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: seo.heading, item: pageUrl },
      ],
    })
  }
  const head = [
    `<link rel="canonical" href="${pageUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta name="twitter:card" content="summary" />`,
    ...structuredData.map(jsonLdScript),
  ].join('\n    ')
  // For readers and crawlers that do not run scripts. A visitor with scripts on never sees it: the app draws the real page.
  const links = liveViewers.map((candidate) => `<li><a href="${candidate.toolPath}">${escapeHtml(pageSeo[candidate.toolPath].heading)}</a></li>`).join('')
  const questionsHtml = questions.length > 0 ? `<h2>${escapeHtml(guide?.faqTitle ?? 'Frequently asked questions')}</h2>${questions.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join('')}` : ''
  const featureList = address === '/' ? `<h2>Features</h2><ul>${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>` : ''
  const stepsHtml = guide ? `<h2>${escapeHtml(guide.stepsTitle)}</h2><ol>${guide.steps.map((step) => `<li><strong>${escapeHtml(step.title)}.</strong> ${escapeHtml(step.text)}</li>`).join('')}</ol>` : ''
  const noscript = `<noscript><main><h1>${escapeHtml(seo.heading)}</h1><p>${escapeHtml(seo.intro)}</p><p>Turn on JavaScript to open your file. It is read in your browser and never uploaded.</p><nav aria-label="File viewers"><ul>${links}</ul></nav>${stepsHtml}${featureList}${questionsHtml}</main></noscript>`
  checkSearchSnippet(viewer ? viewer.label : 'home page', seo.title, seo.description)
  return indexHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`)
    .replace('</head>', `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`)
}

const seoAddresses = Object.keys(pageSeo)
const seoTitles = seoAddresses.map((address) => pageSeo[address].title)
if (new Set(seoTitles).size !== seoTitles.length) throw new Error('Two pages have the same title: every page needs its own.')
for (const address of seoAddresses) {
  const page = renderSeoPage(address)
  if (address === '/') fs.writeFileSync(path.join(distFolder, 'index.html'), page)
  else {
    fs.mkdirSync(path.join(distFolder, address), { recursive: true })
    fs.writeFileSync(path.join(distFolder, address, 'index.html'), page)
  }
}

// Only pages that work as a page: no /view-* addresses (they exist only for a file open in one visitor's browser).
const newestChangeDate = changelog[0].date
const changelogAlternates = [
  ...locales.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_ORIGIN}/${locale}/changelog"/>`),
  `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/changelog"/>`,
].join('')
const sitemapEntries = [
  `<url><loc>${SITE_ORIGIN}/</loc></url>`,
  ...viewers.filter((viewer) => viewer.toolPath).map((viewer) => `<url><loc>${SITE_ORIGIN}${viewer.toolPath}</loc></url>`),
  ...locales.map((locale) => `<url><loc>${SITE_ORIGIN}/${locale}/changelog</loc><lastmod>${newestChangeDate}</lastmod>${changelogAlternates}</url>`),
]
fs.writeFileSync(
  path.join(distFolder, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries.join('\n')}\n</urlset>\n`,
)
fs.writeFileSync(path.join(distFolder, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)
console.log(`Wrote ${seoAddresses.length} page heads, ${locales.length} changelog pages, sitemap.xml and robots.txt into dist/`)
