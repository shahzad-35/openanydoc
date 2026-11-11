// Tells IndexNow which pages changed, after a deploy: Bing, Yandex, Naver and Seznam then crawl them soon (Google does not use it).
// It reads the live sitemap, so run it once the deploy is live:
//   node scripts/ping-indexnow.mjs                      pages whose <lastmod> is today
//   node scripts/ping-indexnow.mjs --since 2026-11-01   pages whose <lastmod> is that day or later
//   node scripts/ping-indexnow.mjs --all                every page (the first time)
// The key proves the site is ours: the same key is served at /<key>.txt (public/9802a1c1f7233d36ee689467d491f65d.txt).
import { SITE_ORIGIN } from '../src/seo.ts'

const INDEXNOW_KEY = '9802a1c1f7233d36ee689467d491f65d'
const RESPONSE_MEANINGS = {
  200: 'accepted',
  202: 'received; IndexNow is still checking the key file',
  400: 'bad request',
  403: 'the key file was not found or does not hold the key: deploy public/' + INDEXNOW_KEY + '.txt first',
  422: 'an address is not on this site, or the key does not match',
  429: 'too many requests: try again later',
}

const sendsEveryPage = process.argv.includes('--all')
const sinceArgumentIndex = process.argv.indexOf('--since')
const sinceDate = sinceArgumentIndex === -1 ? new Date().toISOString().slice(0, 10) : process.argv[sinceArgumentIndex + 1]
if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDate ?? '')) {
  console.error('Usage: node scripts/ping-indexnow.mjs [--since YYYY-MM-DD | --all]')
  process.exit(2)
}

const sitemap = await (await fetch(`${SITE_ORIGIN}/sitemap.xml`)).text()
const sitemapPages = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((match) => ({ url: match[1], lastmod: match[2] }))
const changedUrls = sitemapPages.filter((page) => sendsEveryPage || page.lastmod >= sinceDate).map((page) => page.url)
if (changedUrls.length === 0) {
  console.log(`No page in the live sitemap changed on or after ${sinceDate}; nothing sent.`)
  process.exit(0)
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE_ORIGIN).host, key: INDEXNOW_KEY, keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`, urlList: changedUrls }),
})
console.log(`Sent ${changedUrls.length} address(es) to IndexNow: ${response.status} ${RESPONSE_MEANINGS[response.status] ?? response.statusText}`)
for (const url of changedUrls) console.log(`  ${url}`)
process.exit(response.ok ? 0 : 1)
