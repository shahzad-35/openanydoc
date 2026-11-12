// Privacy and behaviour test for the "what's new" feature. Run with `npm run test:privacy` (it builds first).
//
// It serves dist/ with the site's Content-Security-Policy and drives headless Chrome over the DevTools protocol, with no
// dependency. While it runs, every page records any write to cookies, localStorage, sessionStorage, IndexedDB, the Cache API
// or a service worker, and any network call (fetch, XHR, beacon, WebSocket, EventSource, or any request to another origin).
// The only storage the site writes is the two keys that existed before this feature (the theme and the file-type colours);
// anything else fails the test, and so does a Content-Security-Policy violation. Set CHROME_PATH if Chrome is not in its usual macOS place.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

// The brand's social profiles (SOCIAL_PROFILES in src/seo.ts): linked from the footer and listed in the Organization's sameAs.
const socialProfileUrls = ['https://x.com/openanydoc', 'https://www.linkedin.com/company/145343043', 'https://www.youtube.com/channel/UCS78NF7U939ypL0mcBgQKlg']

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const distFolder = path.join(projectRoot, 'dist')
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const scratchFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'whats-new-test-'))
const SAVED_TEST_YEAR_START = Date.UTC(2027, 0, 1)

// ---------------------------------------------------------------- static server with the site's CSP

// The built _headers (the build adds the inline theme script's hash to the policy), _redirects, and the nearest 404.html for an
// unknown address with status 404: the same behaviour as Cloudflare's static assets.
const contentSecurityPolicy = fs.readFileSync(path.join(distFolder, '_headers'), 'utf8').match(/Content-Security-Policy:\s*(.*)/i)?.[1]
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' }
const redirects = Object.fromEntries(
  fs
    .readFileSync(path.join(distFolder, '_redirects'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [from, to, status] = line.trim().split(/\s+/)
      return [from, { to, status: Number(status) || 301 }]
    }),
)

function resolveFile(pathname) {
  const candidate = path.join(distFolder, pathname)
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  const folderIndex = path.join(candidate, 'index.html')
  if (fs.existsSync(folderIndex)) return folderIndex
  return null
}
function nearestNotFoundPage(pathname) {
  const localized = path.join(distFolder, pathname.split('/')[1] ?? '', '404.html')
  return fs.existsSync(localized) ? localized : path.join(distFolder, '404.html')
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent((request.url ?? '/').split('?')[0])
  const redirect = redirects[pathname]
  if (redirect) {
    response.writeHead(redirect.status, { location: redirect.to })
    response.end()
    return
  }
  const filePath = resolveFile(pathname)
  const headers = { 'content-type': filePath ? (contentTypes[path.extname(filePath)] ?? 'application/octet-stream') : contentTypes['.html'], 'content-security-policy': contentSecurityPolicy ?? '' }
  response.writeHead(filePath ? 200 : 404, headers)
  fs.createReadStream(filePath ?? nearestNotFoundPage(pathname)).pipe(response)
})
await new Promise((resolve) => server.listen(0, resolve))
const siteOrigin = `http://localhost:${server.address().port}`

// ---------------------------------------------------------------- Chrome over the DevTools protocol

const chromePort = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${chromePort}`, `--user-data-dir=${path.join(scratchFolder, 'profile')}`, '--window-size=1280,900', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

let targets = []
for (let attempt = 0; attempt < 60 && !targets.some((target) => target.type === 'page'); attempt++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${chromePort}/json`)).json()
  } catch {
    await sleep(250)
  }
}
const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve) => (socket.onopen = resolve))
let nextMessageId = 0
const pendingReplies = new Map()
const networkProblems = []
// Uncaught errors and console errors of the page, such as React's hydration mismatches.
const pageErrors = []
socket.onmessage = (message) => {
  const data = JSON.parse(message.data)
  if (data.id && pendingReplies.has(data.id)) {
    pendingReplies.get(data.id)(data)
    pendingReplies.delete(data.id)
  } else if (data.method === 'Network.requestWillBeSent') {
    const { url } = data.params.request
    const requestType = data.params.type
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    if (new URL(url).origin !== siteOrigin) networkProblems.push(`request to another origin: ${url}`)
    if (['Fetch', 'XHR', 'Ping', 'WebSocket', 'EventSource'].includes(requestType)) networkProblems.push(`${requestType} request: ${url}`)
  } else if (data.method === 'Runtime.exceptionThrown') {
    pageErrors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text)
  } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
    pageErrors.push(data.params.args.map((argument) => argument.value ?? argument.description).join(' '))
  } else if (data.method === 'Page.javascriptDialogOpening') {
    send('Page.handleJavaScriptDialog', { accept: true })
  }
}
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextMessageId
    pendingReplies.set(id, (reply) => (reply.error ? reject(new Error(`${method}: ${JSON.stringify(reply.error)}`)) : resolve(reply.result)))
    socket.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed')
  return result.result.value
}
async function waitFor(expression, description, timeoutMilliseconds = 8000) {
  const deadline = Date.now() + timeoutMilliseconds
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${description}`)
}
async function pressKey(key, code, keyCode, text) {
  const details = { key, code, windowsVirtualKeyCode: keyCode, ...(text ? { text } : {}) }
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...details })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...details })
}
async function chooseFile(filePath) {
  const { root } = await send('DOM.getDocument')
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
  await send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
}

await send('Page.enable')
await send('Runtime.enable')
await send('DOM.enable')
await send('Network.enable')
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(scratchFolder, 'downloads') })

// What every page records, set up before any of the site's own code runs.
const recorderScript = `(() => {
  const violations = []
  window.__privacyViolations = violations
  const allowedKeys = { localStorage: ['theme'], sessionStorage: ['extensionColorOrder'] }
  const storageName = (storage) => (storage === window.localStorage ? 'localStorage' : 'sessionStorage')
  const originalSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    if (!allowedKeys[storageName(this)].includes(key)) violations.push(storageName(this) + '.setItem(' + key + ')')
    return originalSetItem.call(this, key, value)
  }
  const originalRemoveItem = Storage.prototype.removeItem
  Storage.prototype.removeItem = function (key) {
    if (!allowedKeys[storageName(this)].includes(key)) violations.push(storageName(this) + '.removeItem(' + key + ')')
    return originalRemoveItem.call(this, key)
  }
  const originalClear = Storage.prototype.clear
  Storage.prototype.clear = function () {
    violations.push(storageName(this) + '.clear()')
    return originalClear.call(this)
  }
  document.addEventListener('securitypolicyviolation', (event) => violations.push('CSP: ' + event.violatedDirective + ' ' + event.blockedURI))
  const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
  Object.defineProperty(document, 'cookie', { get: () => cookieDescriptor.get.call(document), set: (value) => { violations.push('document.cookie = ' + value) } })
  const watch = (owner, name, label) => {
    if (!owner || typeof owner[name] !== 'function') return
    const original = owner[name]
    owner[name] = function (...args) { violations.push(label); return original.apply(this, args) }
  }
  watch(window.indexedDB, 'open', 'indexedDB.open')
  watch(window.caches, 'open', 'caches.open')
  watch(navigator.serviceWorker, 'register', 'serviceWorker.register')
  watch(window, 'fetch', 'fetch')
  watch(XMLHttpRequest.prototype, 'open', 'XMLHttpRequest.open')
  watch(navigator, 'sendBeacon', 'sendBeacon')
  for (const name of ['WebSocket', 'EventSource']) {
    const Original = window[name]
    if (Original) window[name] = function (...args) { violations.push(name); return new Original(...args) }
  }
})()`
await send('Page.addScriptToEvaluateOnNewDocument', { source: recorderScript })

async function openPage(pathname) {
  await send('Page.navigate', { url: `${siteOrigin}${pathname}` })
  await waitFor(`document.readyState === 'complete' && document.querySelector('#root').children.length > 0`, `${pathname} to load`)
  await sleep(300)
}

// ---------------------------------------------------------------- the tests

const formatPages = ['/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/word-viewer', '/powerpoint-viewer']
const conversionPages = ['/excel-to-csv', '/csv-to-excel', '/excel-to-json', '/csv-to-json', '/json-to-csv']
// Tools for several formats: last in the header's Convert menu, under Home only in the breadcrumb.
const toolPages = ['/mask-data']
const landingPages = ['/json-formatter', '/json-validator', '/tsv-viewer', '/large-csv-viewer', '/xls-viewer', ...conversionPages, ...toolPages]
// Pages of the tool engine (src/tools/registry.ts): tools drawn by ToolPage, and the hubs.
const registryToolPages = ['/merge-pdf', '/add-page-numbers']
const hubPages = ['/pdf-tools', '/data-tools', '/office-tools', '/all-tools']

const sampleJson = path.join(scratchFolder, 'sample.json')
fs.writeFileSync(sampleJson, '{"a":1,"b":[1,2,3]}')
const comingSoonFile = path.join(scratchFolder, 'report.pdf')
fs.writeFileSync(comingSoonFile, 'not a real PDF')
const unknownFile = path.join(scratchFolder, 'notes.xyz')
fs.writeFileSync(unknownFile, 'not a file type anyone opens')
const legacyDocument = path.join(scratchFolder, 'notes.doc')
fs.writeFileSync(legacyDocument, 'not a real document')
const legacyPresentation = path.join(scratchFolder, 'slides.ppt')
fs.writeFileSync(legacyPresentation, 'not a real presentation')

const results = []
async function test(name, run) {
  if (process.env.TEST_ONLY && !new RegExp(process.env.TEST_ONLY).test(name)) return
  const problemsBefore = networkProblems.length
  try {
    await run()
    const violations = await evaluate('window.__privacyViolations ?? []').catch(() => [])
    const newNetworkProblems = networkProblems.slice(problemsBefore)
    if (violations.length > 0 || newNetworkProblems.length > 0) throw new Error(`privacy problem: ${[...violations, ...newNetworkProblems].join('; ')}`)
    results.push({ name, ok: true })
  } catch (error) {
    results.push({ name, ok: false, reason: error.message })
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message)
}
// The text of the page as the server sent it, before any script runs: the markup in #root without its tags.
const prerenderedText = (html) =>
  (html.split('<div id="root" data-prerendered>')[1] ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
const bannerText = () => evaluate(`document.querySelector('[role=region]')?.innerText ?? null`)

await test('home page shows the banner, the badges and takes no focus', async () => {
  await openPage('/en')
  const text = await bannerText()
  // The formats named are the ones still inside their 30 days (NEW_WINDOW_DAYS), so the list changes with the date; the message
  // is read from the DOM because it is hidden below 640 px.
  const message = await evaluate(`document.querySelector('#banner-message')?.textContent ?? ''`)
  expect(text?.includes('New') && /^You can now open (and edit )?.+ files\.$/.test(message), `banner text was: ${text} / ${message}`)
  expect(await evaluate(`document.activeElement === document.body`), 'the banner took focus')
  expect(await evaluate(`document.querySelectorAll('footer nav [data-file-type]').length >= 4`), 'footer badges are missing')
  expect(await evaluate(`[...document.querySelectorAll('footer nav li')].some((item) => item.innerText.includes('JSON viewer') && item.innerText.includes('New'))`), 'the JSON nav link has no New badge')
})

await test('the banner closes with the keyboard and stays closed while navigating in the tab', async () => {
  await openPage('/en')
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Close announcement'`)) break
    await pressKey('Tab', 'Tab', 9)
  }
  expect(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Close announcement'`), 'could not reach the close button with Tab')
  await pressKey('Enter', 'Enter', 13, '\r')
  await waitFor(`!document.querySelector('[role=region]')`, 'the banner to close')
  await evaluate(`document.querySelector('footer nav a[href="/en/json-viewer"]').click()`)
  await waitFor(`location.pathname === '/en/json-viewer'`, 'navigation to the JSON page')
  expect((await bannerText()) === null, 'a banner showed on the JSON page')
  const crossLinks = await evaluate(`[...document.querySelectorAll('p')].find((p) => p.innerText.startsWith('Also works with'))?.innerText ?? null`)
  expect(crossLinks && crossLinks.includes('CSV') && crossLinks.includes('Excel') && !crossLinks.includes('JSON'), `cross-format line was: ${crossLinks}`)
})

await test('a reload brings the banner back, so nothing was remembered', async () => {
  await openPage('/en/json-viewer')
  expect((await bannerText()) === null, 'the announcement banner showed on a format page: it belongs on the home page only')
  expect(await evaluate(`document.querySelector('#footer-link-changelog') === null`), 'the changelog link showed on a format page')
  await openPage('/en')
  expect(await evaluate(`document.querySelector('#footer-link-changelog') !== null`), 'the changelog link is missing on the home page')
  expect((await bannerText()) !== null, 'the banner did not come back after the reload')
})

await test('a JSON file dropped on the CSV page is offered the JSON viewer, with the same File', async () => {
  await openPage('/en/csv-viewer')
  await chooseFile(sampleJson)
  await waitFor(`document.body.innerText.includes('This looks like a JSON file.')`, 'the redirect offer')
  expect(await evaluate(`document.body.innerText.includes("This file type isn't supported.")`) === false, 'the plain rejection was shown too')
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.innerText === 'Open it in the JSON viewer').click()`)
  await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'sample.json'`, 'the file to open in the JSON viewer')
  expect(!(await evaluate('location.href')).includes('sample'), 'the file name reached the URL')
  expect((await bannerText()) === null, 'the banner showed on a file page')
})

await test('a file nobody opens keeps the friendly rejection', async () => {
  await openPage('/en/csv-viewer')
  await chooseFile(unknownFile)
  await waitFor(`document.body.innerText.includes("This file type isn't supported.")`, 'the rejection message')
  expect(!(await evaluate(`document.body.innerText.includes('This looks like')`)), 'a redirect was offered for an unregistered type')
})

await test('saving a file shows no tip about other formats', async () => {
  // Excel is the format drawn in the shared page, which used to show a tip after a save (removed 2026-10-29).
  const tipWorkbook = path.join(scratchFolder, 'tip.xlsx')
  const tipBook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(tipBook, XLSX.utils.aoa_to_sheet([['one'], ['two']]), 'Data')
  fs.writeFileSync(tipWorkbook, XLSX.write(tipBook, { type: 'buffer', bookType: 'xlsx' }))
  await openPage('/en/excel-viewer')
  await chooseFile(tipWorkbook)
  await waitFor(`document.querySelector('h1')?.innerText === 'tip.xlsx'`, 'the file to open')
  const downloadButton = `document.querySelector('#download-button')`
  await waitFor(`${downloadButton} && !${downloadButton}.disabled`, 'the Download button')
  await evaluate(`${downloadButton}.click()`)
  await sleep(500)
  expect(await evaluate(`document.querySelector('#save-tip') === null && !document.body.innerText.includes('also opens and edits')`), 'a tip showed after the save')
})

await test('after the window ends there are no badges and no banner', async () => {
  const fakeClock = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { const RealDate = Date; class FakeDate extends RealDate { constructor(...args) { if (args.length) super(...args); else super(${SAVED_TEST_YEAR_START}) } static now() { return ${SAVED_TEST_YEAR_START} } }; window.Date = FakeDate })()`,
  })
  try {
    await openPage('/en')
    expect((await bannerText()) === null, 'the banner showed after the window ended')
    expect(await evaluate(`document.querySelectorAll('footer nav [data-file-type]').length === 0`), 'badges showed after the window ended')
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fakeClock.identifier })
  }
})

for (const locale of ['en', 'ar']) {
  await test(`the ${locale} changelog is real HTML, with hreflang, and is right-to-left when Arabic`, async () => {
    const html = await (await fetch(`${siteOrigin}/${locale}/changelog`)).text()
    expect(html.includes('Version 1.3.0') || html.includes('الإصدار 1.3.0'), 'the changelog entries are not in the HTML')
    expect(html.includes('hreflang="en"') && html.includes('hreflang="ar"') && html.includes('hreflang="x-default"'), 'hreflang tags are missing')
    expect(html.includes(`rel="canonical" href="https://www.openanydoc.com/${locale}/changelog"`), 'canonical is missing')
    expect(/<title>[^<]+<\/title>/.test(html) && /name="description"\s+content="[^"]+/.test(html), 'title or description is missing')
    await openPage(`/${locale}/changelog`)
    expect((await evaluate(`document.documentElement.dir`)) === (locale === 'ar' ? 'rtl' : 'ltr'), 'wrong text direction')
    expect(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), 'the page scrolls sideways')
    expect(await evaluate(`document.querySelector('[role=region]') === null`), 'the changelog page should not show the banner')
  })
}

await test('home, format and landing pages carry their own title, h1, intro, questions, canonical and structured data', async () => {
  const titles = new Set()
  const headings = new Set()
  const intros = new Set()
  const questionLists = new Map()
  for (const address of ['en', 'ar'].flatMap((locale) => ['', ...formatPages, ...landingPages].map((page) => `/${locale}${page}`))) {
    const html = await (await fetch(`${siteOrigin}${address}`)).text()
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1].replace(/&amp;/g, '&') ?? ''
    const description = /name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(title.length >= 50 && title.length <= 60, `${address}: title is ${title.length} characters (50 to 60 for home, format and landing pages): ${title}`)
    // Tool pages follow Step 17C (120 to 155, one concrete benefit); the home page keeps 150 to 160.
    const [minDescription, maxDescription] = address.length > 3 ? [120, 155] : [150, 160]
    expect(description.length >= minDescription && description.length <= maxDescription, `${address}: description is ${description.length} characters (${minDescription} to ${maxDescription})`)
    expect(html.includes(`<link rel="canonical" href="https://www.openanydoc.com${address}"`), `${address}: canonical is missing`)
    expect(html.includes('property="og:title"') && html.includes('property="og:description"'), `${address}: Open Graph tags are missing`)
    const structuredData = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((match) => JSON.parse(match[1]))
    const serverText = prerenderedText(html)
    const heading = /<h1 id="page-heading"[^>]*>([^<]+)<\/h1>/.exec(html)?.[1] ?? ''
    const intro = /<p id="page-intro"[^>]*>([^<]+)<\/p>/.exec(html)?.[1] ?? ''
    expect(heading.length > 0 && intro.length > 0, `${address}: the h1 or the intro is not in the server's HTML`)
    expect(!headings.has(heading) && !intros.has(intro), `${address}: the h1 or the intro is used on another page`)
    headings.add(heading)
    intros.add(intro)
    const breadcrumb = structuredData.find((item) => item['@type'] === 'BreadcrumbList')
    if (breadcrumb) expect(serverText.includes(breadcrumb.itemListElement.at(-1).name), `${address}: the breadcrumb data's last step is not the breadcrumb shown in the server's HTML`)
    if (address.length > 3) expect(html.includes('id="how-to-section"') && html.includes('id="handles-section"'), `${address}: "How it works" or "What it handles" is not in the server's HTML`)
    const expectedType = address.length > 3 ? 'SoftwareApplication' : 'WebSite'
    expect(structuredData.some((item) => [item['@type']].flat().includes(expectedType)), `${address}: ${expectedType} data is missing`)
    expect(!titles.has(title), `${address}: the title is used on another page`)
    expect(html.includes(`<html lang="${address.slice(1, 3)}" dir="${address.startsWith('/ar') ? 'rtl' : 'ltr'}">`), `${address}: lang and dir are missing from the static HTML`)
    expect(html.includes('hreflang="ar"') && html.includes('hreflang="en"') && html.includes('hreflang="x-default"'), `${address}: hreflang alternates are missing`)
    titles.add(title)
    const faq = structuredData.find((item) => item['@type'] === 'FAQPage')
    expect(faq, `${address}: there is no FAQPage data`)
    const missingQuestion = faq.mainEntity.find((item) => !serverText.includes(item.name))
    expect(!missingQuestion, `${address}: the server's HTML lacks the question "${missingQuestion?.name}"`)
    const shareImage = /property="og:image" content="https:\/\/www\.openanydoc\.com(\/og\/[\w-]+\.png)"/.exec(html)?.[1]
    const imageFile = shareImage && path.join(distFolder, shareImage)
    expect(imageFile && fs.existsSync(imageFile), `${address}: the og:image file is missing`)
    const imageHeader = fs.readFileSync(imageFile)
    expect(imageHeader.readUInt32BE(16) === 1200 && imageHeader.readUInt32BE(20) === 630, `${address}: the og:image is not 1200 x 630`)
    expect(html.includes('name="twitter:card" content="summary_large_image"') && html.includes('name="twitter:image"'), `${address}: the twitter tags are missing`)
    await openPage(address)
    const visibleQuestions = await evaluate(`document.querySelectorAll('dt').length`)
    expect(faq.mainEntity.length === visibleQuestions, `${address}: FAQ data has ${faq.mainEntity.length} questions but the page shows ${visibleQuestions}`)
    expect(await evaluate(`document.querySelectorAll('h1').length === 1`), `${address}: the page must have exactly one h1`)
    const visibleText = await evaluate(`document.body.innerText`)
    const firstAnswer = faq.mainEntity[0].acceptedAnswer.text
    expect(visibleText.includes(firstAnswer.slice(0, 60)), `${address}: the data answers are not the text on the page`)
    questionLists.set(address, faq.mainEntity.map((item) => item.name).join('|'))
    const isLandingPage = landingPages.includes(address.slice(3))
    if (isLandingPage) {
      expect(faq.mainEntity.length >= 5 && faq.mainEntity.length <= 8, `${address}: a landing page needs 5 to 8 questions, it has ${faq.mainEntity.length}`)
      const crumbCount = toolPages.includes(address.slice(3)) ? 2 : 3
      expect(breadcrumb?.itemListElement.length === crumbCount, `${address}: the breadcrumb does not have ${crumbCount} steps`)
    }
    if (address.length > 3) {
      const isArabic = address.startsWith('/ar')
      expect((await evaluate(`document.querySelector('#how-to-section h2')?.textContent ?? ''`)).startsWith(isArabic ? 'كيف يعمل' : 'How it works'), `${address}: the steps are not titled "How it works"`)
      expect(await evaluate(`document.querySelectorAll('section#handles-section #handles-list li[id^="handles-item-"]').length >= 4`), `${address}: the "What it handles" list is missing`)
      const sharedQuestions = isArabic
        ? ['هل يُرفع ملفي؟', 'هل يمكنني تعديله وحفظه؟', 'هل يتغير الملف الأصلي؟', 'هل هناك حد لحجم الملف؟', 'هل يعمل على الجوال؟', 'هل يعمل بدون إنترنت؟', 'هل يمكن لشركتي استضافة نسخة خاصة بها؟']
        : ['Is my file uploaded?', 'Can I edit and save it?', 'Is the original changed?', 'Is there a file size limit?', 'Does it work on mobile?', 'Does it work offline?', 'Can my company host its own copy?']
      if (!isLandingPage) expect(faq.mainEntity.slice(0, 7).map((item) => item.name).join('|') === sharedQuestions.join('|'), `${address}: the seven shared questions are not first`)
    }
  }
  expect(new Set(questionLists.values()).size === questionLists.size, 'two pages share the same questions: each page needs its own')
})

// Every input, select, textarea and button has an id, and no id is used twice on the same page.
const idProblems = () =>
  evaluate(`(() => {
    const seen = new Map()
    for (const element of document.querySelectorAll('[id]')) seen.set(element.id, (seen.get(element.id) ?? 0) + 1)
    const duplicates = [...seen].filter(([, count]) => count > 1).map(([id, count]) => id + ' x' + count)
    const missing = [...document.querySelectorAll('input, select, textarea, button, main, header, footer, nav, aside, dialog')]
      .filter((element) => !element.id)
      .map((element) => element.tagName.toLowerCase() + (element.getAttribute('aria-label') ? '[' + element.getAttribute('aria-label') + ']' : '') + ':' + (element.textContent ?? '').trim().slice(0, 24))
    return { duplicates, missing }
  })()`)

async function expectCleanIds(where) {
  const { duplicates, missing } = await idProblems()
  expect(duplicates.length === 0, `${where}: duplicate ids: ${duplicates.slice(0, 6).join(', ')}`)
  expect(missing.length === 0, `${where}: elements without an id: ${missing.slice(0, 6).join(' | ')}`)
}

const sampleCsv = path.join(scratchFolder, 'sample.csv')
fs.writeFileSync(sampleCsv, 'id,name\n1,Alpha\n2,Beta\n')
const sampleText = path.join(scratchFolder, 'sample.txt')
fs.writeFileSync(sampleText, 'one\ntwo\nthree\n')
const sampleWorkbook = path.join(scratchFolder, 'sample.xlsx')
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Qty'], ['A', 1], ['B', 2]]), 'Data')
fs.writeFileSync(sampleWorkbook, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
const sampleLegacyWorkbook = path.join(scratchFolder, 'legacy.xls')
fs.writeFileSync(sampleLegacyWorkbook, XLSX.write(workbook, { type: 'buffer', bookType: 'biff8' }))
// The smallest real .docx: one paragraph and one table.
const sampleDocument = path.join(scratchFolder, 'sample.docx')
const documentZip = new JSZip()
documentZip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
documentZip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
documentZip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sample document</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Qty</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>')
fs.writeFileSync(sampleDocument, await documentZip.generateAsync({ type: 'nodebuffer' }))
// The smallest real .pptx: one slide with one text box, on a blank layout and master.
const samplePresentation = path.join(scratchFolder, 'sample.pptx')
const presentationZip = new JSZip()
const presentationNamespaces = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const presentationRelationships = (relationships) => `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`
const emptyShapeTree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'
presentationZip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>')
presentationZip.file('_rels/.rels', presentationRelationships([['rId1', 'officeDocument', 'ppt/presentation.xml']]))
presentationZip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${presentationNamespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)
presentationZip.file('ppt/_rels/presentation.xml.rels', presentationRelationships([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'slide', 'slides/slide1.xml']]))
presentationZip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster ${presentationNamespaces}><p:cSld><p:spTree>${emptyShapeTree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`)
presentationZip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', presentationRelationships([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]))
presentationZip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout ${presentationNamespaces}><p:cSld><p:spTree>${emptyShapeTree}</p:spTree></p:cSld></p:sldLayout>`)
presentationZip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', presentationRelationships([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]))
presentationZip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:sld ${presentationNamespaces}><p:cSld><p:spTree>${emptyShapeTree}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="6096000" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2800"/><a:t>Sample slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`)
presentationZip.file('ppt/slides/_rels/slide1.xml.rels', presentationRelationships([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]))
fs.writeFileSync(samplePresentation, await presentationZip.generateAsync({ type: 'nodebuffer' }))

for (const [name, address, file, readyElement] of [
  ['CSV', '/en/csv-viewer', sampleCsv, '#data-table'],
  ['TXT', '/en/txt-viewer', sampleText, '#text-editor'],
  ['JSON', '/en/json-viewer', sampleJson, '#tree-view .row'],
  ['Excel', '/en/excel-viewer', sampleWorkbook, '#data-table'],
  ['Word', '/en/word-viewer', sampleDocument, '#word-document section.docx'],
  ['PowerPoint', '/en/powerpoint-viewer', samplePresentation, '#slide-thumbnail-1'],
]) {
  for (const locale of ['en', 'ar']) await test(`${name} (${locale}): every field has an id and no id repeats (page, view mode, edit mode if editable, an open menu)`, async () => {
    await openPage(address.replace('/en/', `/${locale}/`))
    await expectCleanIds(`${name} drop page`)
    await chooseFile(file)
    await waitFor(`document.querySelector('${readyElement}')`, `the ${name} file to show`)
    await expectCleanIds(`${name} view mode`)
    // Every editable format opens ready to edit, with its own menus; the view-only formats (Word, PowerPoint) have the Help menu.
    const isViewOnly = name === 'Word' || name === 'PowerPoint'
    const menuButton = isViewOnly ? '#menu-bar #menu-help' : name === 'JSON' ? '#indent-button:not(:disabled)' : name === 'CSV' ? '#more-menu-button:not(:disabled)' : name === 'TXT' ? '#ribbon-sort-menu-button' : '#menu-bar #menu-format'
    if (name === 'TXT') await evaluate(`document.querySelector('#ribbon-tab-lines').click()`)
    await waitFor(`document.querySelector('${menuButton}')`, isViewOnly ? 'the menu bar' : 'the editing tools')
    if (!isViewOnly) await expectCleanIds(`${name} edit mode`)
    await evaluate(`document.querySelector('${menuButton}').click()`)
    await waitFor(`document.querySelector('[role=menu]')`, 'a menu to open')
    await expectCleanIds(`${name} with a menu open`)
  })
}

for (const address of ['/en', '/ar', '/en/changelog', '/ar/changelog', '/en/about', '/ar/about', '/en/privacy', '/ar/privacy', '/en/terms', '/ar/terms', '/en/fix-arabic-csv-in-excel', '/ar/fix-arabic-csv-in-excel', '/en/guides', '/ar/guides', '/en/csv-too-big-for-excel', '/ar/json-unexpected-token', '/en/mask-data', '/ar/mask-data', '/en/merge-pdf', '/ar/add-page-numbers', '/en/pdf-tools', '/ar/all-tools']) {
  await test(`${address}: every field has an id and no id repeats`, async () => {
    await openPage(address)
    await expectCleanIds(address)
  })
}

await test('sitemap.xml and robots.txt list the pages', async () => {
  const sitemap = await (await fetch(`${siteOrigin}/sitemap.xml`)).text()
  for (const address of ['/en', '/ar', '/en/changelog', '/ar/changelog', '/en/json-viewer', '/ar/json-viewer', '/en/excel-viewer', '/ar/excel-viewer', '/en/about', '/ar/about', '/en/privacy', '/ar/privacy', '/en/terms', '/ar/terms', '/en/fix-arabic-csv-in-excel', '/ar/fix-arabic-csv-in-excel', '/en/guides', '/ar/csv-opens-in-one-column', '/en/mask-data', '/ar/mask-data', '/en/merge-pdf', '/ar/add-page-numbers', '/en/pdf-tools', '/ar/data-tools', '/en/office-tools', '/ar/all-tools']) expect(sitemap.includes(`https://www.openanydoc.com${address}`), `${address} is not in the sitemap`)
  expect(!sitemap.includes('/view-'), 'a /view- address is in the sitemap')
  expect((await (await fetch(`${siteOrigin}/robots.txt`)).text()).includes('Sitemap: https://www.openanydoc.com/sitemap.xml'), 'robots.txt does not point to the sitemap')
})

await test('unknown addresses get a real 404 page with noindex, and open-file addresses redirect to their viewer', async () => {
  for (const locale of ['en', 'ar']) {
    const address = `/${locale}/this-page-does-not-exist`
    const response = await fetch(`${siteOrigin}${address}`)
    const html = await response.text()
    expect(response.status === 404, `${address}: status ${response.status}`)
    expect(html.includes('<meta name="robots" content="noindex" />') && html.includes(`<html lang="${locale}"`) && html.includes('id="not-found-page"'), `${address}: not the static not-found page`)
    expect(!html.includes('<script type="module"'), `${address}: the 404 page loads the app script (it would redraw the home page)`)
    await openPage(address)
    await expectCleanIds(address)
    expect(await evaluate(`document.querySelectorAll('h1').length === 1 && document.querySelector('#not-found-link-csv')?.getAttribute('href') === '/${locale}/csv-viewer'`), `${address}: the not-found page lacks its links`)
  }
  for (const [address, target] of [['/en/view-csv', '/en/csv-viewer'], ['/ar/view-excel', '/ar/excel-viewer'], ['/en/view-pdf', '/en'], ['/ar/view', '/ar']]) {
    const response = await fetch(`${siteOrigin}${address}`, { redirect: 'manual' })
    expect(response.status === 302 && response.headers.get('location') === target, `${address}: expected 302 to ${target}, got ${response.status} ${response.headers.get('location')}`)
  }
})

await test('security headers: HSTS, the inline theme script allowed by its hash only, Early Hints and font preloads', async () => {
  const headers = fs.readFileSync(path.join(distFolder, '_headers'), 'utf8')
  expect(headers.includes('Strict-Transport-Security: max-age=31536000; includeSubDomains'), 'HSTS is missing from _headers')
  expect(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+';/.test(headers) && !headers.includes('unsafe-inline'), 'the CSP does not allow the theme script by hash alone')
  expect(/^\/en\n  Link: <\/assets\/fredoka-latin-700[^>]+>; rel=preload; as=font; crossorigin/m.test(headers) && /^\/ar\/\*\n  Link: <\/assets\/ibm-plex-sans-arabic/m.test(headers), 'the Early Hints Link headers for the fonts are missing')
  const html = await (await fetch(`${siteOrigin}/en`)).text()
  expect(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="\/assets\/fredoka-latin-700/.test(html) && !html.includes('theme-init.js'), 'English pages should preload the display font and have no theme-init.js request')
  await openPage('/en')
  expect((await evaluate(`document.documentElement.style.getPropertyValue('--ext-pill-1')`)) !== '', 'the inline theme script did not run (blocked by the CSP?)')
})

const guidePagesList = ['/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing']
const contentPages = ['', ...formatPages, ...landingPages, ...registryToolPages, ...hubPages, '/about', '/privacy', '/terms', '/guides', ...guidePagesList, '/changelog']

await test('every page: hreflang en, ar and x-default match the canonical addresses, lang and dir are right, no link ends with a slash', async () => {
  const alternatesOf = (html) =>
    Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)].map((match) => [match[1], match[2]]))
  for (const page of contentPages) {
    const pages = {}
    for (const locale of ['en', 'ar']) pages[locale] = await (await fetch(`${siteOrigin}/${locale}${page}`)).text()
    for (const locale of ['en', 'ar']) {
      const address = `/${locale}${page}`
      const html = pages[locale]
      const alternates = alternatesOf(html)
      const expected = { en: `https://www.openanydoc.com/en${page}`, ar: `https://www.openanydoc.com/ar${page}`, 'x-default': `https://www.openanydoc.com/en${page}` }
      expect(JSON.stringify(alternates) === JSON.stringify(expected), `${address}: hreflang is ${JSON.stringify(alternates)}`)
      // Reciprocal: the page in the other language lists the very same set.
      expect(JSON.stringify(alternatesOf(pages[locale === 'en' ? 'ar' : 'en'])) === JSON.stringify(alternates), `${address}: the other language lists different alternates`)
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]
      expect(canonical === alternates[locale], `${address}: canonical ${canonical} is not its hreflang address`)
      expect(html.includes(`<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`), `${address}: lang or dir is wrong`)
      const slashLinks = [...html.matchAll(/href="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((href) => (href.startsWith('/') || href.startsWith('https://www.openanydoc.com')) && href.endsWith('/') && href !== 'https://www.openanydoc.com/')
      expect(slashLinks.length === 0, `${address}: links end with a slash: ${slashLinks.join(', ')}`)
    }
  }
})

await test('every sitemap address has a lastmod date and is a built page without a trailing slash', async () => {
  const sitemap = await (await fetch(`${siteOrigin}/sitemap.xml`)).text()
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1])
  expect(entries.length === contentPages.length * 2, `the sitemap has ${entries.length} addresses, expected ${contentPages.length * 2}`)
  for (const entry of entries) {
    const address = /<loc>https:\/\/www\.openanydoc\.com([^<]*)<\/loc>/.exec(entry)?.[1] ?? ''
    expect(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(entry), `${address}: no lastmod`)
    expect(!address.endsWith('/') && fs.existsSync(path.join(distFolder, address, 'index.html')), `${address}: not a built page, or it ends with a slash`)
  }
})

// The upper bound was 900 before the home page gained its stats row, shortcut keycaps, privacy comparison and the note on how
// the demo works (2026-10-19), and 1000 before the five conversion pages joined the home page's tool links (2026-10-29), and 1050 before the Word viewer
// added its nav and footer links, home card and format group (2026-11-02), and 1100 before the PowerPoint viewer did the same (2026-11-02).
await test('the home page has 600 to 1150 words in its server HTML, eight questions and a card linking to each tool page', async () => {
  for (const locale of ['en', 'ar']) {
    const html = await (await fetch(`${siteOrigin}/${locale}`)).text()
    const wordCount = prerenderedText(html).split(/\s+/).filter(Boolean).length
    expect(wordCount >= 600 && wordCount <= 1150, `/${locale}: ${wordCount} words`)
    expect((html.match(/id="faq-item-\d+"/g) ?? []).length === 8, `/${locale}: the FAQ does not have eight questions`)
    for (const page of ['csv-viewer', 'excel-viewer', 'json-viewer', 'txt-viewer', 'word-viewer', 'powerpoint-viewer']) {
      expect(new RegExp(`id="tool-card-link-${page}" href="/${locale}/${page}"`).test(html), `/${locale}: no card links to /${locale}/${page}`)
    }
  }
})

// The fields Google's rich-result documentation requires or recommends for each type we publish.
await test('every JSON-LD block is valid data with the fields search engines need, and the logo exists', async () => {
  const isAbsoluteUrl = (value) => typeof value === 'string' && value.startsWith('https://www.openanydoc.com')
  for (const page of contentPages) {
    for (const locale of ['en', 'ar']) {
      const address = `/${locale}${page}`
      const html = await (await fetch(`${siteOrigin}${address}`)).text()
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((match) => JSON.parse(match[1]))
      const types = blocks.flatMap((block) => [block['@type']].flat())
      const expectedTypes = { '': ['WebSite', 'Organization', 'SoftwareApplication', 'FAQPage'], '/about': ['ProfilePage', 'BreadcrumbList'], '/privacy': [], '/terms': [], '/guides': ['CollectionPage', 'BreadcrumbList'], '/changelog': ['BreadcrumbList'], ...Object.fromEntries(guidePagesList.map((guide) => [guide, ['Article', 'BreadcrumbList']])), ...Object.fromEntries(registryToolPages.map((tool) => [tool, ['WebApplication', 'FAQPage', 'BreadcrumbList']])), ...Object.fromEntries(hubPages.map((hub) => [hub, ['CollectionPage', 'BreadcrumbList']])) }[page] ?? ['SoftwareApplication', 'FAQPage', 'BreadcrumbList']
      expect(expectedTypes.every((type) => types.includes(type)), `${address}: has ${types.join(', ')}, expected ${expectedTypes.join(', ')}`)
      // Every reference to the organisation or website points at the one id the home page defines.
      const entityIds = ['https://www.openanydoc.com/#organization', 'https://www.openanydoc.com/#website', 'https://www.openanydoc.com/#founder']
      // No rating or review markup: there are no real reviews on the page.
      expect(!/"(aggregateRating|review)"/.test(JSON.stringify(blocks)), `${address}: rating or review markup must not be published`)
      const references = [...JSON.stringify(blocks).matchAll(/"@id":"([^"]+)"/g)].map((match) => match[1])
      expect(references.every((reference) => entityIds.includes(reference)), `${address}: an @id points somewhere unknown: ${references.join(', ')}`)
      if (page === '') expect(blocks.some((block) => block['@type'] === 'Organization' && block['@id'] === entityIds[0]) && blocks.some((block) => block['@type'] === 'WebSite' && block['@id'] === entityIds[1] && block.publisher?.['@id'] === entityIds[0]), `${address}: the Organization and WebSite are not linked by @id`)
      for (const block of blocks) {
        const type = [block['@type']].flat()[0]
        const problem = (message) => `${address} ${type}: ${message}`
        expect(block['@context'] === 'https://schema.org', problem('@context is not https://schema.org'))
        if (type === 'WebSite') {
          expect(block.name === 'OpenAnyDoc' && block.url === canonical && block.inLanguage === locale, problem('name, url or inLanguage is wrong'))
          expect(JSON.stringify(block.alternateName) === JSON.stringify(['Open Any Doc', 'OpenAnyDoc.com']), problem('alternateName is wrong'))
        } else if (type === 'Organization') {
          expect(block.name === 'OpenAnyDoc' && block.url === 'https://www.openanydoc.com', problem('name or url is wrong'))
          expect(block.founder?.['@type'] === 'Person' && block.founder['@id'] === entityIds[2] && block.founder.name === 'Shahzad Ali' && block.email === 'support@openanydoc.com', problem('founder or email is wrong'))
          expect(block.sameAs.includes('https://www.saashub.com/openanydoc'), problem('sameAs lacks the SaaSHub listing'))
          expect(Array.isArray(block.sameAs) && block.sameAs.every((profile) => /^https:\/\//.test(profile)), problem('sameAs must list the public profiles as absolute URLs'))
          expect(socialProfileUrls.every((profileUrl) => block.sameAs.includes(profileUrl)), problem('sameAs lacks a social profile'))
          expect(block.contactPoint?.email === 'support@openanydoc.com' && block.foundingDate === '2026-10', problem('contactPoint or foundingDate is wrong'))
          expect(isAbsoluteUrl(block.logo), problem('the logo is not an absolute URL'))
          const logoFile = path.join(distFolder, new URL(block.logo).pathname)
          expect(fs.existsSync(logoFile), problem(`the logo file ${block.logo} does not exist`))
          const logoHeader = fs.readFileSync(logoFile)
          expect(logoHeader.toString('ascii', 1, 4) === 'PNG' && logoHeader.readUInt32BE(16) === 512 && logoHeader.readUInt32BE(20) === 512, problem('the logo is not a 512 x 512 PNG'))
        } else if (type === 'SoftwareApplication') {
          expect(typeof block.name === 'string' && block.name.length > 0, problem('name is missing'))
          expect(block.offers?.['@type'] === 'Offer' && block.offers.price === '0' && block.offers.priceCurrency === 'USD', problem('offers is not a free Offer in USD'))
          expect(block.applicationCategory === 'UtilitiesApplication' && block.operatingSystem === 'Any (web browser)', problem('applicationCategory or operatingSystem is wrong'))
          expect(Array.isArray(block.featureList) && block.featureList.length > 0, problem('featureList is empty'))
          // A format or landing page lists its format's features from src/viewers.ts (three, plus the landing page's own name).
          if (page !== '' && page !== '/mask-data') expect([3, 4].includes(block.featureList.length), problem(`featureList has ${block.featureList.length} items, not the format's features`))
          expect(block.url === canonical && block.inLanguage === locale, problem('url or inLanguage is wrong'))
          expect(!('aggregateRating' in block) && !('review' in block), problem('ratings or reviews must not be published'))
        } else if (type === 'FAQPage') {
          expect(Array.isArray(block.mainEntity) && block.mainEntity.length > 0, problem('mainEntity is empty'))
          for (const question of block.mainEntity) {
            expect(question['@type'] === 'Question' && question.name?.length > 0, problem('a Question has no name'))
            expect(question.acceptedAnswer?.['@type'] === 'Answer' && question.acceptedAnswer.text?.length > 0, problem(`"${question.name}" has no Answer text`))
          }
        } else if (type === 'Article') {
          expect(block.headline?.length > 0 && isAbsoluteUrl(block.image) && /^\d{4}-\d{2}-\d{2}T00:00:00\+00:00$/.test(block.datePublished) && /^\d{4}-\d{2}-\d{2}T/.test(block.dateModified), problem('headline, image or dates are wrong'))
          expect(block.author?.['@type'] === 'Person' && block.author['@id'] === entityIds[2] && block.author.name?.length > 0 && isAbsoluteUrl(block.author.url) && block.mainEntityOfPage === canonical, problem('author or mainEntityOfPage is wrong'))
        } else if (type === 'CollectionPage') {
          const items = block.mainEntity?.itemListElement ?? []
          expect(block.url === canonical && block.mainEntity?.['@type'] === 'ItemList' && items.length === guidePagesList.length, problem(`url is wrong or the list does not hold the ${guidePagesList.length} guides`))
          items.forEach((item, index) => expect(item.position === index + 1 && item.name?.length > 0 && item.url === `https://www.openanydoc.com/${locale}${guidePagesList[index]}`, problem(`item ${index + 1} is not ${guidePagesList[index]}`)))
        } else if (type === 'ProfilePage') {
          expect(block.mainEntity?.['@type'] === 'Person' && block.mainEntity['@id'] === entityIds[2] && block.mainEntity.name === 'Shahzad Ali' && block.url === canonical, problem('mainEntity or url is wrong'))
        } else if (type === 'BreadcrumbList') {
          const items = block.itemListElement ?? []
          expect(items.length >= 2, problem('fewer than two items'))
          items.forEach((item, index) => expect(item['@type'] === 'ListItem' && item.position === index + 1 && item.name?.length > 0 && isAbsoluteUrl(item.item), problem(`item ${index + 1} needs position, name and item`)))
          expect(items.at(-1).item === canonical, problem('the last item is not this page'))
        } else {
          throw new Error(problem('a type this test does not know'))
        }
      }
    }
  }
})

// ---------------------------------------------------------------- the tool engine: tool pages, hubs, Tools menu

await test('tool pages and hubs: their own title and description, h1, the no-upload badge, the PDF tools in the search', async () => {
  for (const address of ['en', 'ar'].flatMap((locale) => [...registryToolPages, ...hubPages].map((page) => `/${locale}${page}`))) {
    const html = await (await fetch(`${siteOrigin}${address}`)).text()
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1].replace(/&amp;/g, '&') ?? ''
    const description = /name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    const isToolPage = registryToolPages.some((page) => address.endsWith(page))
    const [maxTitle, minDescription, maxDescription] = isToolPage ? [60, 120, 155] : [65, 150, 160]
    expect(title.length <= maxTitle && description.length >= minDescription && description.length <= maxDescription, `${address}: title ${title.length}, description ${description.length}`)
    expect(/<h1 id="page-heading"/.test(html), `${address}: the h1 is not in the server's HTML`)
    if (isToolPage) expect(html.includes('id="tool-privacy-badge"') && html.includes('id="format-faq-list"') && html.includes('id="tool-limits-list"'), `${address}: the badge, questions or limits are not in the server's HTML`)
  }
  for (const locale of ['en', 'ar']) {
    await openPage(`/${locale}/csv-viewer`)
    await evaluate(`document.querySelector('#site-search-button').click()`)
    await waitFor(`document.querySelector('#site-search-option-merge-pdf')`, 'the PDF tools in the search')
    expect(await evaluate(`document.querySelector('#site-search-option-merge-pdf').getAttribute('href') === '/${locale}/merge-pdf' && !document.querySelector('#site-search-option-split-pdf') && document.querySelector('#site-search-all-tools-link')?.getAttribute('href') === '/${locale}/all-tools'`), `/${locale}: the search lists a tool that is not live, or misses Merge PDF or the All tools link`)
  }
})

await test('Merge PDF merges the two samples, and Add page numbers takes the result in memory', async () => {
  await openPage('/en/merge-pdf')
  await evaluate(`document.querySelector('#sample-button-report-pdf').click()`)
  await waitFor(`document.querySelector('#pdf-file-1')?.innerText.includes('3 pages')`, 'the first sample to be read')
  await evaluate(`document.querySelector('#sample-button-letter-pdf').click()`)
  await waitFor(`document.querySelector('#pdf-file-2')?.innerText.includes('2 pages') && !document.querySelector('#merge-pdf-button').disabled`, 'the second sample to be read')
  await evaluate(`document.querySelector('#merge-pdf-button').click()`)
  await waitFor(`document.querySelector('#tool-download-button')`, 'the merged file')
  await evaluate(`window.__blobs = []; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__blobs.push(blob); return make(blob) }`)
  await evaluate(`document.querySelector('#tool-download-button').click()`)
  await waitFor(`window.__blobs.length === 1 && document.querySelector('#next-step-add-page-numbers')`, 'the download and the next steps')
  expect(!(await evaluate(`Boolean(document.querySelector('#next-step-compress-pdf'))`)), 'a next step that is not live is shown')
  await evaluate(`document.querySelector('#next-step-add-page-numbers').click()`)
  await waitFor(`location.pathname === '/en/add-page-numbers' && document.querySelector('#pdf-file-1')?.innerText.includes('5 pages')`, 'Add page numbers to receive the merged PDF')
  expect(await evaluate(`location.search === '' && location.hash === ''`), 'the file must not travel in the address')
})

// ---------------------------------------------------------------- About, Privacy and Terms; footer and workbench links

await test('About, Privacy, Terms and guide pages: one h1, their own title and description, hreflang, real text', async () => {
  const titles = new Set()
  for (const address of ['en', 'ar'].flatMap((locale) => ['/about', '/privacy', '/terms', '/guides', ...guidePagesList].map((page) => `/${locale}${page}`))) {
    const html = await (await fetch(`${siteOrigin}${address}`)).text()
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1].replace(/&amp;/g, '&') ?? ''
    const description = /name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(title.length > 0 && title.length <= 60, `${address}: title is ${title.length} characters: ${title}`)
    expect(description.length >= 150 && description.length <= 160, `${address}: description is ${description.length} characters`)
    expect(!titles.has(title), `${address}: the title is used on another page`)
    titles.add(title)
    expect(html.includes(`<link rel="canonical" href="https://www.openanydoc.com${address}"`), `${address}: canonical is missing`)
    expect(html.includes('hreflang="ar"') && html.includes('hreflang="en"') && html.includes('hreflang="x-default"'), `${address}: hreflang alternates are missing`)
    expect(html.includes(`<html lang="${address.slice(1, 3)}" dir="${address.startsWith('/ar') ? 'rtl' : 'ltr'}">`), `${address}: lang and dir are missing from the static HTML`)
    expect(html.includes('id="info-sections"') && prerenderedText(html).includes('support@openanydoc.com'), `${address}: the server's HTML lacks the sections or the contact address`)
    await openPage(address)
    expect(await evaluate(`document.querySelectorAll('h1').length === 1 && document.querySelectorAll('main h2').length >= 3`), `${address}: needs one h1 and its h2 sections`)
    expect((await evaluate('document.title')) === title, `${address}: the browser title differs from the static one`)
    expect(await evaluate(`document.querySelector('#contact-email-link')?.getAttribute('href') === 'mailto:support@openanydoc.com'`), `${address}: the contact link is missing`)
    expect(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), `${address}: the page scrolls sideways`)
  }
  await openPage('/en/privacy')
  const privacyText = await evaluate('document.body.innerText')
  expect(privacyText.includes('Last updated: 2026-10-17') && privacyText.includes('No analytics, no cookies, no tracking') && privacyText.includes('Cloudflare'), 'the privacy policy is missing a required part')
})

await test('format pages show a real screenshot and a comparison table in both languages', async () => {
  for (const locale of ['en', 'ar']) {
    for (const [page, viewerId] of [['/csv-viewer', 'csv'], ['/excel-viewer', 'excel'], ['/json-viewer', 'json'], ['/txt-viewer', 'text'], ['/word-viewer', 'word'], ['/powerpoint-viewer', 'powerpoint']]) {
      const html = await (await fetch(`${siteOrigin}/${locale}${page}`)).text()
      const image = /<img src="(\/screenshots\/[\w-]+\.webp)" width="1200" height="750" loading="lazy" decoding="async" alt="([^"]+)"/.exec(html)
      expect(image !== null && image[1] === `/screenshots/${locale}-${viewerId}.webp` && image[2].length > 20, `/${locale}${page}: the screenshot is missing its size, lazy loading or alt text`)
      expect(fs.existsSync(path.join(distFolder, image[1])), `/${locale}${page}: ${image[1]} is not a built file`)
      expect((html.match(/<th scope="row"/g) ?? []).length === 6 && html.includes('id="comparison-table"'), `/${locale}${page}: the comparison table is missing or has the wrong rows`)
    }
  }
})

await test('the Arabic CSV guide links to built pages, and the CSV page, its FAQ and the footer link to the guide', async () => {
  for (const locale of ['en', 'ar']) {
    await openPage(`/${locale}/fix-arabic-csv-in-excel`)
    const guideLinks = await evaluate(`[...document.querySelectorAll('#info-sections a[href^="/"]')].map((link) => link.getAttribute('href'))`)
    expect(guideLinks.length >= 4, `/${locale}: the guide links only ${guideLinks.length} pages`)
    for (const href of guideLinks) expect(fs.existsSync(path.join(distFolder, href, 'index.html')), `/${locale}: the guide links ${href}, which is not a built page`)
    expect(await evaluate(`document.querySelector('#footer-link-guides')?.getAttribute('href') === '/${locale}/guides' && document.querySelector('#page-byline time')?.getAttribute('datetime') === '2026-10-20'`), `/${locale}: the guide lacks the Guides link or its byline date`)
  }
  await openPage('/en/csv-viewer')
  for (const [id, target, where] of [['related-link-fix-arabic-csv-in-excel', '/en/fix-arabic-csv-in-excel', 'related tools'], ['format-faq-link-fix-arabic-csv-in-excel', '/en/fix-arabic-csv-in-excel', 'FAQ answer'], ['footer-link-guides', '/en/guides', 'footer'], ['related-link-csv-opens-in-one-column', '/en/csv-opens-in-one-column', 'related tools (one column)']]) {
    expect((await evaluate(`document.querySelector('#${id}')?.getAttribute('href')`)) === target, `the CSV page's ${where} does not link to ${target}`)
  }
  await evaluate(`document.querySelector('#format-faq-link-fix-arabic-csv-in-excel').click()`)
  await waitFor(`location.pathname === '/en/fix-arabic-csv-in-excel' && document.querySelector('#info-sections') !== null`, 'the FAQ link to open the guide')
  await openPage('/en/guides')
  expect(await evaluate(`['fix-arabic-csv-in-excel', 'csv-opens-in-one-column', 'csv-too-big-for-excel', 'json-unexpected-token'].every((guide) => document.querySelector('#info-link-' + guide)?.getAttribute('href') === '/en/' + guide)`), 'the guides index does not link every guide')
})

await test('the footer has About, Privacy and Terms links and the Microsoft disclaimer on every content page', async () => {
  for (const address of ['/en', '/ar', '/en/csv-viewer', '/ar/excel-viewer', '/en/json-viewer', '/ar/txt-viewer', '/en/about', '/ar/privacy', '/en/terms', '/en/changelog', '/ar/changelog']) {
    await openPage(address)
    const locale = address.slice(1, 3)
    for (const page of ['about', 'privacy', 'terms']) {
      expect((await evaluate(`document.querySelector('footer nav#footer-legal #footer-link-${page}')?.getAttribute('href')`)) === `/${locale}/${page}`, `${address}: the ${page} link is missing from the footer`)
    }
    const disclaimer = await evaluate(`document.querySelector('footer p#footer-disclaimer')?.textContent ?? ''`)
    const expected = locale === 'en' ? 'OpenAnyDoc is not affiliated with Microsoft. Word, Excel and PowerPoint are trademarks of Microsoft Corporation.' : 'OpenAnyDoc غير تابع لشركة Microsoft.'
    expect(disclaimer.includes(expected), `${address}: the footer disclaimer is "${disclaimer}"`)
  }
  for (const locale of ['en', 'ar']) {
    const html = await (await fetch(`${siteOrigin}/${locale}/changelog`)).text()
    expect(html.includes('id="footer-disclaimer"') && html.includes(`id="footer-link-privacy" href="/${locale}/privacy"`), `${locale}: the static changelog has no footer`)
  }
  await openPage('/en')
  expect(await evaluate(`document.querySelectorAll('#footer-viewers li svg').length === 6 && document.querySelector('#footer-more #footer-link-json-formatter') !== null`), 'the footer should show a glyph per viewer and the landing pages under More file tools')
  await openPage('/ar')
  const arabicFooterFits = await evaluate(`(() => {
    const width = document.documentElement.clientWidth
    const inside = (link) => { const box = link.getBoundingClientRect(); return box.left >= 0 && box.right <= width }
    return document.documentElement.scrollWidth <= width && [...document.querySelectorAll('#site-footer a')].every(inside)
  })()`)
  expect(arabicFooterFits, 'the Arabic footer has a link outside the viewport')
  await openPage('/en/csv-viewer')
  await evaluate(`document.querySelector('#footer-link-privacy').click()`)
  await waitFor(`location.pathname === '/en/privacy' && document.querySelector('h1')?.innerText === 'Privacy Policy'`, 'the footer link to open the privacy policy in the page')
})

for (const [name, address, file, readyElement, menuButton] of [
  ['CSV', '/en/csv-viewer', sampleCsv, '#data-table', '#more-menu-button:not(:disabled)'],
  ['JSON', '/en/json-viewer', sampleJson, '#tree-view .row', '#more-button'],
  ['TXT', '/en/txt-viewer', sampleText, '#text-editor', '#ribbon-tab-file'],
  ['Excel', '/en/excel-viewer', sampleWorkbook, '#data-table', '#menu-help'],
  ['Word', '/en/word-viewer', sampleDocument, '#word-document section.docx', '#menu-help'],
  ['PowerPoint', '/en/powerpoint-viewer', samplePresentation, '#slide-thumbnail-1', '#menu-help'],
]) {
  for (const locale of ['en', 'ar']) await test(`${name} (${locale}): Privacy, Terms and the disclaimer in the menu, and the status bar links, open in a new tab`, async () => {
    await openPage(address.replace('/en/', `/${locale}/`))
    await chooseFile(file)
    await waitFor(`document.querySelector('${readyElement}') && document.querySelector('${menuButton}')`, `the ${name} file to show`)
    await evaluate(`document.querySelector('${menuButton}').click()`)
    await waitFor(`document.querySelector('#menu-link-privacy')?.checkVisibility()`, 'the menu with the legal links')
    const links = ['Excel', 'Word', 'PowerPoint'].includes(name) ? ['menu-link-privacy', 'menu-link-terms'] : ['menu-link-privacy', 'menu-link-terms', 'status-link-privacy', 'status-link-terms']
    for (const id of links) {
      const link = await evaluate(`(() => { const link = document.querySelector('#${id}'); return link && { href: link.getAttribute('href'), target: link.target, rel: link.rel } })()`)
      expect(link?.href === `/${locale}/${id.endsWith('privacy') ? 'privacy' : 'terms'}` && link.target === '_blank' && link.rel.includes('noopener'), `#${id} is ${JSON.stringify(link)}`)
    }
    expect((await evaluate(`document.querySelector('#menu-disclaimer')?.textContent ?? ''`)).includes('Microsoft Corporation'), 'the disclaimer is missing from the menu')
    await expectCleanIds(`${name} with the legal links showing`)
  })
}



// ---------------------------------------------------------------- one drop zone for every format

await test('the format list is read from the registry: View and edit, View, or Coming soon', async () => {
  for (const [locale, words] of [['en', { edit: 'View and edit', view: 'View', soon: 'Coming soon' }], ['ar', { edit: 'عرض وتحرير', view: 'عرض', soon: 'قريبًا' }]]) {
    await openPage(`/${locale}`)
    for (const id of ['csv', 'text', 'json', 'excel']) {
      expect((await evaluate(`document.querySelector('#extension-row-${id} #extension-capabilities-${id}')?.innerText`)) === words.edit, `${locale}: ${id} does not say "${words.edit}"`)
    }
    for (const id of ['word', 'powerpoint']) {
      expect((await evaluate(`document.querySelector('#extension-row-${id} #extension-capabilities-${id}')?.innerText`)) === words.view, `${locale}: ${id} does not say "${words.view}"`)
    }
    for (const id of ['pdf']) {
      expect((await evaluate(`document.querySelector('#extension-row-${id} #extension-capabilities-${id}')?.innerText`)) === words.soon, `${locale}: ${id} does not say "${words.soon}"`)
    }
  }
})

await test('one drop zone opens every live format with its tools; Coming soon stays on the page', async () => {
  const sampleFiles = [['CSV', sampleCsv], ['TXT', sampleText], ['JSON', sampleJson], ['Excel', sampleWorkbook], ['Word', sampleDocument], ['PowerPoint', samplePresentation]]
  for (const [name, file] of sampleFiles) {
    await openPage('/en')
    await chooseFile(file)
    await waitFor(`(${name === 'Excel'} && document.querySelector('#excel-workbench')) || (${name === 'JSON'} && document.querySelector('#json-workbench')) || (${name === 'CSV'} && document.querySelector('#csv-workbench')) || (${name === 'TXT'} && document.querySelector('#txt-workbench')) || (${name === 'Word'} && document.querySelector('#word-document section.docx')) || (${name === 'PowerPoint'} && document.querySelector('#slide-thumbnail-1'))`, `the ${name} file page`)
    expect(!(await evaluate('location.href')).includes('sample'), `${name}: the file name reached the URL`)
    await waitFor(`document.querySelector('#menu-bar #menu-format, #command-toolbar #validate-button, #command-bar #filter-button:not(:disabled), #ribbon-panel #ribbon-find-replace-button, #toolbar #fit-width-button, #toolbar #next-slide-button')`, `the ${name} tools`)
  }
  for (const locale of ['en', 'ar']) {
    await openPage(`/${locale}`)
    await chooseFile(comingSoonFile)
    await waitFor(`document.querySelector('#toast-region:popover-open')`, 'the Coming soon toast')
    expect((await evaluate('location.pathname')) === `/${locale}`, `${locale}: left the home page`)
    expect(await evaluate(`document.querySelector('#file-page') === null && document.querySelector('#coming-soon-message') === null`), `${locale}: a file page or an inline line showed for a Coming soon format`)
  }
  expect(await evaluate(`document.querySelector('#privacy-note').innerText.length > 40`), 'the privacy note is missing')
})

// ---------------------------------------------------------------- languages

async function setBrowserLanguage(acceptLanguage) {
  await send('Emulation.setUserAgentOverride', { userAgent: await evaluate('navigator.userAgent'), acceptLanguage })
}

await test('/ goes to /ar for an Arabic browser and to /en otherwise; old addresses go to /en', async () => {
  await setBrowserLanguage('ar-SA,ar;q=0.9,en;q=0.5')
  try {
    await openPage('/')
    expect((await evaluate('location.pathname')) === '/ar', `an Arabic browser landed on ${await evaluate('location.pathname')}`)
    expect(await evaluate(`document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'`), 'lang and dir are not ar and rtl')
  } finally {
    await setBrowserLanguage('en-US,en;q=0.9')
  }
  await openPage('/')
  expect((await evaluate('location.pathname')) === '/en', `an English browser landed on ${await evaluate('location.pathname')}`)
  expect(await evaluate(`document.documentElement.lang === 'en' && document.documentElement.dir === 'ltr'`), 'lang and dir are not en and ltr')
  for (const page of ['csv-viewer', 'excel-viewer', 'json-viewer', 'txt-viewer', 'word-viewer', 'powerpoint-viewer']) {
    await openPage(`/${page}`)
    expect((await evaluate('location.pathname')) === `/en/${page}`, `/${page} landed on ${await evaluate('location.pathname')}`)
  }
})

await test('an old .doc file gets the "only .docx" message, on the Word page and the home page', async () => {
  for (const address of ['/en/word-viewer', '/ar/word-viewer', '/en']) {
    await openPage(address)
    await chooseFile(legacyDocument)
    await waitFor(`document.querySelector('#toast-region:popover-open')`, `${address}: the .doc message`)
    expect((await evaluate(`document.querySelector('#toast-region').innerText`)).includes('.docx'), `${address}: the .doc message does not mention .docx`)
    expect((await evaluate('location.pathname')) === address, `${address}: the page changed for a .doc file`)
    await evaluate(`document.querySelector('[id^=toast-dismiss-button]').click()`)
  }
})

await test('an old .ppt file gets the "only .pptx" message, on the PowerPoint page and the home page', async () => {
  for (const address of ['/en/powerpoint-viewer', '/ar/powerpoint-viewer', '/en']) {
    await openPage(address)
    await chooseFile(legacyPresentation)
    await waitFor(`document.querySelector('#toast-region:popover-open')`, `${address}: the .ppt message`)
    expect((await evaluate(`document.querySelector('#toast-region').innerText`)).includes('.pptx'), `${address}: the .ppt message does not mention .pptx`)
    expect((await evaluate('location.pathname')) === address, `${address}: the page changed for a .ppt file`)
    await evaluate(`document.querySelector('[id^=toast-dismiss-button]').click()`)
  }
})

await test('the language switch keeps the page and an open file with its edits', async () => {
  await openPage('/en/csv-viewer')
  await chooseFile(sampleCsv)
  await waitFor(`document.querySelector('#csv-workbench #data-table tbody td')`, 'the CSV to show')
  expect((await evaluate('location.pathname')) === '/en/csv-viewer', 'the open file is not at /en/csv-viewer')
  await evaluate(`document.querySelector('#language-switch-link').click()`)
  await waitFor(`document.documentElement.dir === 'rtl'`, 'the page to turn right-to-left')
  expect((await evaluate('location.pathname')) === '/ar/csv-viewer', `the address is ${await evaluate('location.pathname')}`)
  expect(await evaluate(`document.querySelector('#data-table')?.getAttribute('dir') === 'ltr'`), 'the table is not left-to-right')
  expect(await evaluate(`document.querySelector('#undo-button')?.getAttribute('aria-label') === 'تراجع'`), 'the toolbar is not in Arabic')
  expect(await evaluate(`getComputedStyle(document.body).fontFamily.includes('IBM Plex Sans Arabic')`), 'the Arabic font is not in use')
  await evaluate(`document.querySelector('#language-switch-link').click()`)
  await waitFor(`document.documentElement.dir === 'ltr'`, 'the page to turn back')
  expect(await evaluate(`document.querySelector('#data-table') !== null`), 'the open file was lost by switching language')
})

await test('an Arabic CSV without a UTF-8 BOM offers the Excel copy, in both languages', async () => {
  const arabicCsv = path.join(scratchFolder, 'arabic.csv')
  fs.writeFileSync(arabicCsv, 'name,city\nأحمد,الرياض\n')
  const arabicCsvWithBom = path.join(scratchFolder, 'arabic-bom.csv')
  fs.writeFileSync(arabicCsvWithBom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('name,city\nأحمد,الرياض\n')]))
  for (const locale of ['en', 'ar']) {
    await openPage(`/${locale}/csv-viewer`)
    await chooseFile(arabicCsv)
    await waitFor(`document.querySelector('#data-table')`, 'the Arabic CSV to show')
    expect(await evaluate(`document.querySelector('#download-excel-copy-button') !== null`), `${locale}: the Excel copy button is missing`)
    await evaluate(`window.__blobs = []; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__blobs.push(blob); return make(blob) }`)
    await evaluate(`document.querySelector('#download-excel-copy-button').click()`)
    await waitFor(`window.__blobs.length === 1`, 'the copy to be made')
    const firstBytes = await evaluate(`window.__blobs[0].arrayBuffer().then((buffer) => [...new Uint8Array(buffer).slice(0, 3)].join(','))`)
    expect(firstBytes === '239,187,191', `${locale}: the copy starts with ${firstBytes}, not a UTF-8 BOM`)
    await openPage(`/${locale}/csv-viewer`)
    await chooseFile(arabicCsvWithBom)
    await waitFor(`document.querySelector('#data-table')`, 'the BOM CSV to show')
    expect(await evaluate(`document.querySelector('#download-excel-copy-button') === null`), `${locale}: the button shows for a file that already has a BOM`)
    await openPage(`/${locale}/csv-viewer`)
    await chooseFile(sampleCsv)
    await waitFor(`document.querySelector('#data-table')`, 'the ASCII CSV to show')
    expect(await evaluate(`document.querySelector('#download-excel-copy-button') === null`), `${locale}: the button shows for an ASCII file`)
  }
})


// ---------------------------------------------------------------- messages on a phone: toasts and modals

const emptyCsv = path.join(scratchFolder, 'empty.csv')
fs.writeFileSync(emptyCsv, '')
const brokenJson = path.join(scratchFolder, 'broken.json')
fs.writeFileSync(brokenJson, '{"a": 1,}')
const arabicCsvForPhone = path.join(scratchFolder, 'arabic-phone.csv')
fs.writeFileSync(arabicCsvForPhone, 'name,city\nأحمد,الرياض\n')

async function onPhone(run) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 2, mobile: true })
  await send('Emulation.setTouchEmulationEnabled', { enabled: true })
  try {
    await run()
  } finally {
    await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await send('Emulation.clearDeviceMetricsOverride')
  }
}
const toastRegionText = () => evaluate(`document.querySelector('#toast-region:popover-open')?.innerText ?? ''`)

await test('on a phone an unsupported file shows a toast, not a banner; it can be dismissed', async () => {
  await onPhone(async () => {
    for (const locale of ['en', 'ar']) {
      await openPage(`/${locale}`)
      await chooseFile(unknownFile)
      await waitFor(`document.querySelector('#toast-region:popover-open [role=status]')`, `${locale}: the error toast`)
      expect(await evaluate(`document.querySelector('#drop-error') === null`), `${locale}: the inline error showed on a phone`)
      expect((await toastRegionText()).length > 0 && (await toastRegionText()).length < 120, `${locale}: the toast is empty or long`)
      expect(await evaluate(`document.querySelector('#toast-region').getBoundingClientRect().bottom > innerHeight - 40`), `${locale}: the toast is not at the bottom`)
      expect(await evaluate(`document.querySelectorAll('#toast-region button').length === 1`), `${locale}: the toast must have one button, to dismiss it`)
      await evaluate(`document.querySelector('[id^=toast-dismiss-button]').click()`)
      await waitFor(`!document.querySelector('#toast-region:popover-open')`, `${locale}: the toast to close`)
    }
    await openPage('/en')
    await chooseFile(comingSoonFile)
    await waitFor(`document.querySelector('#toast-region:popover-open [role=status]')`, 'the Coming soon toast')
    expect(await evaluate(`document.querySelector('#coming-soon-message') === null`), 'the inline Coming soon line showed on a phone')
  })
})

await test('on a phone a toast goes away by itself', async () => {
  await onPhone(async () => {
    await openPage('/en')
    await chooseFile(unknownFile)
    await waitFor(`document.querySelector('#toast-region:popover-open')`, 'the toast')
    const shownAt = Date.now()
    await waitFor(`!document.querySelector('#toast-region:popover-open')`, 'the toast to go away by itself', 6000)
    expect(Date.now() - shownAt < 5200, `the toast stayed ${Date.now() - shownAt} ms; it should go after about 3 seconds`)
  })
})

await test('on a phone a file for another viewer is offered in a dialog, and an unreadable file in a dialog with a way out', async () => {
  await onPhone(async () => {
    await openPage('/en/csv-viewer')
    await chooseFile(sampleJson)
    await waitFor(`document.querySelector('#dialog-wrong-file[open] #open-in-viewer-button')`, 'the wrong-file dialog')
    expect(await evaluate(`document.querySelector('#wrong-file-redirect') === null`), 'the inline offer showed on a phone')
    await evaluate(`document.querySelector('#open-in-viewer-button').click()`)
    await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'sample.json'`, 'the JSON file to open')
    await openPage('/en/csv-viewer')
    await chooseFile(emptyCsv)
    await waitFor(`document.querySelector('#dialog-file-error[open]')`, 'the file error dialog')
    expect(await evaluate(`document.querySelector('#file-error') === null`), 'the inline error box showed behind the dialog')
    await evaluate(`window.__pickerClicks = 0; const click = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') window.__pickerClicks++; else click.call(this) }`)
    await evaluate(`document.querySelector('#file-error-open-another-button').click()`)
    expect((await evaluate('window.__pickerClicks')) === 1, '"Open another file" did not open the chooser')
    await openPage('/en/csv-viewer')
    await chooseFile(emptyCsv)
    await waitFor(`document.querySelector('#dialog-file-error[open]')`, 'the file error dialog again')
    await evaluate(`document.querySelector('#file-error-close-button').click()`)
    await waitFor(`document.querySelector('#file-error') && !document.querySelector('#dialog-file-error')`, 'the box to stay after closing the dialog')
  })
})

await test('on a phone a JSON syntax error opens the Text tab with the error and Repair; the Arabic Excel copy is a toast with a button', async () => {
  await onPhone(async () => {
    await openPage('/en/json-viewer')
    await chooseFile(brokenJson)
    await waitFor(`document.querySelector('#json-workbench[data-mtab=text] #editor-notice.error #notice-repair-button')`, 'the error in the Text tab')
    expect(await evaluate(`getComputedStyle(document.querySelector('#text-pane')).display === 'flex' && getComputedStyle(document.querySelector('#tree-pane')).display === 'none'`), 'the Text tab is not the one shown')
    expect(await evaluate(`document.querySelector('#mobile-validity-dot').classList.contains('err')`), 'the Text tab has no red dot')
    for (const locale of ['en', 'ar']) {
      await openPage(`/${locale}/csv-viewer`)
      await chooseFile(arabicCsvForPhone)
      await waitFor(`document.querySelector('#toast-region:popover-open [id^=toast-action-button]')`, `${locale}: the Excel copy toast`)
      expect(await evaluate(`document.querySelector('#excel-copy-notice') === null`), `${locale}: the inline Excel strip showed on a phone`)
    }
  })
})


// ---------------------------------------------------------------- the What's new card

await test("the What's new card floats at the bottom end and moves nothing", async () => {
  for (const locale of ['en', 'ar']) {
    await openPage(`/${locale}`)
    const card = await evaluate(`(() => { const box = document.querySelector('#whats-new-banner').getBoundingClientRect(); return { position: getComputedStyle(document.querySelector('#whats-new-banner')).position, left: box.left, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight, heroTop: document.querySelector('#hero').getBoundingClientRect().top } })()`)
    expect(card.position === 'fixed' && card.bottom <= card.height && card.bottom > card.height - 40, `${locale}: the card is not fixed at the bottom`)
    if (locale === 'en') expect(card.right > card.width - 40 && card.left > card.width / 2, 'the card is not at the bottom right')
    else expect(card.left < 40 && card.right < card.width / 2, 'the card is not at the bottom left in Arabic')
    await evaluate(`document.querySelector('#banner-close-button').click()`)
    const heroTopAfter = await evaluate(`document.querySelector('#hero').getBoundingClientRect().top`)
    expect(heroTopAfter === card.heroTop, `${locale}: the page moved when the card closed (${card.heroTop} to ${heroTopAfter})`)
  }
  await onPhone(async () => {
    await openPage('/en')
    const fits = await evaluate(`(() => { const box = document.querySelector('#whats-new-banner').getBoundingClientRect(); return box.left >= 8 && box.right <= innerWidth - 8 && box.height < 190 })()`)
    expect(fits, 'the card does not fit a phone, or it is too tall')
  })
})


await test("the What's new card closes itself after about 3 seconds, waits while the pointer is over it, and returns after a reload", async () => {
  await openPage('/en')
  expect((await bannerText()) !== null, 'the card was not there at first')
  await waitFor(`!document.querySelector('#whats-new-banner')`, 'the card to close by itself', 6000)
  await openPage('/en')
  const box = await evaluate(`(() => { const b = document.querySelector('#whats-new-banner').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  await sleep(4500)
  expect((await bannerText()) !== null, 'the card closed while the pointer was over it')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })
  await waitFor(`!document.querySelector('#whats-new-banner')`, 'the card to close after the pointer left', 6000)
})


await test('the same unsupported file twice shows the toast both times', async () => {
  await openPage('/en')
  await chooseFile(unknownFile)
  await waitFor(`document.querySelector('#toast-region:popover-open')`, 'the first toast')
  await evaluate(`document.querySelector('[id^=toast-dismiss-button]').click()`)
  await waitFor(`!document.querySelector('#toast-region:popover-open')`, 'the first toast to close')
  await chooseFile(unknownFile)
  await waitFor(`document.querySelector('#toast-region:popover-open')`, 'the toast for the second try')
  await chooseFile(unknownFile)
  await waitFor(`document.querySelectorAll('#toast-region [id^=toast-title]').length === 1`, 'one toast, not two, while the first one is still showing')
  await evaluate(`document.querySelector('[id^=toast-dismiss-button]').click()`)
  await chooseFile(comingSoonFile)
  await waitFor(`document.querySelector('#toast-region:popover-open')`, 'the Coming soon toast')
  await evaluate(`document.querySelector('[id^=toast-dismiss-button]').click()`)
  await chooseFile(comingSoonFile)
  await waitFor(`document.querySelector('#toast-region:popover-open')`, 'the Coming soon toast for the second try')
})


// ---------------------------------------------------------------- JSON workbench (text and tree side by side)

await test('JSON: sample, split panes, validate, path query, big numbers kept exactly, and the logo goes home', async () => {
  await openPage('/en/json-viewer')
  await evaluate(`document.querySelector('#sample-button-nested-json').click()`)
  await waitFor(`document.querySelector('#text-pane #json-text-input') && document.querySelector('#tree-pane #tree-view .row')`, 'the text and the tree side by side')
  expect(await evaluate(`document.querySelector('#tree-view').innerText.includes('9007199254740993') && document.querySelector('#tree-view .badge.big') !== null`), 'the big number was rounded or not marked in the tree')
  expect(await evaluate(`document.querySelector('#file-page header') === document.querySelector('#command-bar') && document.querySelector('#edit-toolbar') === null`), 'the shared header or edit toolbar is still on the JSON page')
  await evaluate(`document.querySelector('#validate-button').click()`)
  await waitFor(`document.querySelector('#editor-notice.ok')?.innerText.includes('Valid JSON.')`, 'the valid message')
  const validText = await evaluate(`document.querySelector('#editor-notice').innerText`)
  expect(validText.includes('33 keys') && validText.includes('depth 5'), `the valid message was: ${validText}`)
  const statusKeys = await evaluate(`document.querySelector('#stat-keys').textContent`)
  expect(statusKeys === '33 keys', `the status bar says "${statusKeys}"`)
  await evaluate(`document.querySelector('#path-query-input').focus()`)
  await send('Input.insertText', { text: '$.orders[*].total' })
  await waitFor(`document.querySelector('#query-results-button')?.innerText === '3' && document.querySelector('#query-result-1')`, 'three query results')
  await evaluate(`document.querySelector('#query-result-1').click()`)
  await waitFor(`document.querySelector('#inspector-path')?.innerText === '$.orders[1].total'`, 'the inspector to show the chosen result')
  await evaluate(`window.__blobs = []; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__blobs.push(blob); return make(blob) }`)
  await evaluate(`document.querySelector('#download-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the download')
  expect(await evaluate(`window.__blobs[0].text().then((text) => text.includes('9007199254740993'))`), 'the download lost the big number')
  await evaluate(`document.querySelector('#home-button').click()`)
  await waitFor(`document.querySelector('#json-workbench') === null`, 'the logo to leave the file page')
})

await test('JSON: Repair fixes a broken file, and the cursor in the text selects the node in the tree', async () => {
  const brokenText = path.join(scratchFolder, 'hand-written.json')
  fs.writeFileSync(brokenText, "{\n  // a comment\n  name: 'Demo',\n  \"list\": [1, 2,],\n  \"ok\": True,\n}\n")
  await openPage('/en/json-viewer')
  await chooseFile(brokenText)
  await waitFor(`document.querySelector('#editor-notice.error #notice-repair-button')`, 'the error message with Repair')
  expect(await evaluate(`document.querySelector('#mode-edit-button') === null && document.querySelector('.hl-line.err-line') !== null`), 'a View / Edit switch shows, or the error line is not marked')
  await evaluate(`document.querySelector('#repair-button').click()`)
  await waitFor(`document.querySelector('#editor-notice.info')?.innerText.includes('Repaired:')`, 'the repair message')
  const note = await evaluate(`document.querySelector('#editor-notice').innerText`)
  expect(note.includes('removed 1 comment') && note.includes('quoted 1 key') && note.includes('trailing comma'), `the repair message was: ${note}`)
  await waitFor(`document.querySelector('#tree-view').innerText.includes('name')`, 'the tree after repair')
  const textBox = `document.querySelector('#json-text-input')`
  await waitFor(`${textBox}.value.includes('"list"')`, 'the repaired text')
  await evaluate(`(() => { const box = ${textBox}; const at = box.value.indexOf('"list"') + 1; box.focus(); box.setSelectionRange(at, at) })()`)
  await pressKey('ArrowRight', 'ArrowRight', 39)
  await sleep(300)
  await waitFor(`document.querySelector('#inspector-path')?.innerText === '$.list'`, 'the node under the cursor to be selected')
  expect(await evaluate(`document.querySelector('#cursor-position') !== null`), 'the cursor position is not shown')
})

await test('JSON: pasting JSON on the JSON page opens it; Format offers 1, 2, 3, 4, 8 spaces and tab; Minify writes one line', async () => {
  await openPage('/en/json-viewer')
  await evaluate(`(() => { const data = new DataTransfer(); data.setData('text/plain', '{"pasted": [1, 2]}'); window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data })) })()`)
  await waitFor(`document.querySelector('#json-workbench .file-tab')?.innerText === 'pasted.json'`, 'the pasted JSON to open')
  await waitFor(`document.querySelector('#indent-button:not(:disabled)')`, 'the indentation menu')
  await evaluate(`document.querySelector('#indent-button').click()`)
  await waitFor(`document.querySelector('#indent-button-menu')`, 'the indentation menu to open')
  const itemCount = await evaluate(`document.querySelectorAll('#indent-button-menu [role=menuitemradio]').length`)
  expect(itemCount === 6, `the indentation menu has ${itemCount} choices`)
  await evaluate(`document.querySelector('#indent-button-menu-4-spaces').click()`)
  await waitFor(`document.querySelector('#json-text-input').value.includes('\\n    "pasted"')`, 'the text with 4 spaces')
  await evaluate(`document.querySelector('#minify-button').click()`)
  await waitFor(`document.querySelector('#json-text-input').value === '{"pasted":[1,2]}' && document.querySelector('#indent-status').innerText === 'Minified'`, 'the minified text')
})

await test('CSV: filters, multi-column sort, profile, selection stats, editing, transpose with undo, and download options', async () => {
  const ordersCsv = path.join(scratchFolder, 'orders.csv')
  fs.writeFileSync(ordersCsv, 'order_id,city,total,paid\n1001,Karachi,192.00,true\n1002,Riyadh,28.00,false\n1003,Karachi,2.40,true\n1004,Lahore,49.95,true\n1005,Riyadh,14.00,true\n')
  await openPage('/en/csv-viewer')
  await chooseFile(ordersCsv)
  await waitFor(`document.querySelector('#csv-workbench #data-table tbody td')`, 'the grid')
  expect(await evaluate(`document.querySelector('#file-page header') === document.querySelector('#top-bar') && document.querySelector('#edit-toolbar') === null && document.querySelector('#mode-toggle') === null`), 'the shared header, toolbar or View / Edit switch is still on the CSV page')
  const types = await evaluate(`[...document.querySelectorAll('#data-table .hd-type')].map((label) => label.textContent).join(',')`)
  expect(types === 'Number,Text,Number,Yes/No', `the column types are ${types}`)
  const header = (name) => `[...document.querySelectorAll('#data-table .hd')].find((th) => th.querySelector('.hd-name').textContent === '${name}')`
  await evaluate(`${header('total')}.querySelector('.hd-inner').click()`)
  await waitFor(`document.querySelector('#dock-title')?.textContent === 'total' && document.querySelector('#profile-scroll .stats')?.textContent.includes('192.00')`, 'the profile of total')
  // A filter from the column menu: city is not Riyadh.
  await evaluate(`${header('city')}.querySelector('.hd-btn').click()`)
  await waitFor(`document.querySelector('#popover #filter-checklist')`, 'the city filter')
  await evaluate(`[...document.querySelectorAll('#filter-checklist label')].find((label) => label.textContent.startsWith('Riyadh')).querySelector('input').click()`)
  await waitFor(`document.querySelector('#filter-preview')?.textContent === '3 of 5 rows'`, 'the filter preview')
  await evaluate(`document.querySelector('#filter-apply-button').click()`)
  await waitFor(`document.querySelectorAll('#data-table tbody tr:not(.grid-spacer)').length === 3 && document.querySelector('#chips-bar .chip')`, 'three rows and a filter chip')
  await evaluate(`document.querySelector('#remove-filter-0').click()`)
  // Two sort levels with Shift+click: city, then total (clicked twice: high to low).
  for (const [name, clicks] of [['city', 1], ['total', 2]]) {
    for (let click = 0; click < clicks; click++) await evaluate(`${header(name)}.querySelector('.hd-inner').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`)
  }
  await waitFor(`document.querySelectorAll('#chips-bar .chip.sort').length === 2`, 'two sort chips')
  const sortedIds = await evaluate(`[...document.querySelectorAll('#data-table tbody tr:not(.grid-spacer)')].map((row) => row.children[1].textContent).join(',')`)
  expect(sortedIds === '1001,1003,1004,1002,1005', `sorted by city then total high to low gave ${sortedIds}`)
  await evaluate(`document.querySelector('#clear-all-filters-button').click()`)
  // A range in total: Count, Sum and Average in the status bar.
  const cellCenter = (id) => evaluate(`(() => { const box = document.querySelector('#${id}').getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } })()`)
  const first = await cellCenter('cell-0-2')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: first.x, y: first.y, button: 'left', clickCount: 1 })
  // The value bar appears with the first selected cell and moves the grid down, so find the end cell after the press.
  const last = await cellCenter('cell-2-2')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: last.x, y: last.y, button: 'left' })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: last.x, y: last.y, button: 'left', clickCount: 1 })
  await waitFor(`document.querySelector('#status-bar').textContent.includes('Sum 222.40')`, 'the selection sum (192.00 + 28.00 + 2.40)')
  // Edit a cell by typing into it.
  const cityCell = await cellCenter('cell-1-1')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cityCell.x, y: cityCell.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cityCell.x, y: cityCell.y, button: 'left', clickCount: 1 })
  await pressKey('J', 'KeyJ', 74, 'J')
  await waitFor(`document.querySelector('#cell-value-inline-input')`, 'the cell editor')
  await send('Input.insertText', { text: 'eddah' })
  await pressKey('Enter', 'Enter', 13)
  await waitFor(`document.querySelector('#cell-1-1')?.textContent === 'Jeddah' && document.querySelector('#status-changes-button')`, 'the edited cell')
  // Transpose, then undo.
  await evaluate(`document.querySelector('#clean-menu-button').click()`)
  await waitFor(`document.querySelector('#clean-menu-transpose')`, 'the Clean up menu')
  await evaluate(`document.querySelector('#clean-menu-transpose').click()`)
  await waitFor(`document.querySelector('#dialog-clean-tool[open] #clean-tool-apply-button')`, 'the transpose dialog')
  await evaluate(`document.querySelector('#clean-tool-apply-button').click()`)
  await waitFor(`document.querySelectorAll('#data-table thead .hd').length === 6`, 'the transposed table (5 rows become 6 columns with the header)')
  await evaluate(`document.querySelector('#undo-button').click()`)
  await waitFor(`document.querySelectorAll('#data-table thead .hd').length === 4 && document.querySelector('#cell-1-1')?.textContent === 'Jeddah'`, 'the table back after undo, with the edit')
  // Download with options: semicolons, every field quoted.
  await evaluate(`window.__blobs = []; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__blobs.push(blob); return make(blob) }`)
  await evaluate(`document.querySelector('#more-menu-button').click()`)
  await waitFor(`document.querySelector('#more-menu-download')`, 'the More menu')
  await evaluate(`document.querySelector('#more-menu-download').click()`)
  await waitFor(`document.querySelector('#dialog-download[open] #download-delimiter-select')`, 'the download dialog')
  await evaluate(`(() => { const select = document.querySelector('#download-delimiter-select'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, ';'); select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await evaluate(`document.querySelector('#download-quote-checkbox').click()`)
  await evaluate(`document.querySelector('#download-confirm-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the download')
  const savedText = await evaluate(`window.__blobs[0].text()`)
  expect(savedText.startsWith('"order_id";"city";"total";"paid"') && savedText.includes('"1002";"Jeddah";"28.00";"false"'), `the download was: ${savedText.slice(0, 120)}`)
})

await test('CSV in Arabic: the bars mirror, the table stays left to right', async () => {
  await openPage('/ar/csv-viewer')
  await chooseFile(sampleCsv)
  await waitFor(`document.querySelector('#csv-workbench #data-table tbody td')`, 'the grid')
  const layout = await evaluate(`({ home: document.querySelector('#home-button').getBoundingClientRect().right, download: document.querySelector('#download-button').getBoundingClientRect().left, width: innerWidth, grid: getComputedStyle(document.querySelector('#grid-scroll')).direction })`)
  expect(layout.home > layout.width - 80 && layout.download < 200, 'the top bar is not mirrored')
  expect(layout.grid === 'ltr', 'the table scrolls right to left')
  expect(!(await evaluate(`document.body.innerText.includes('{')`)), 'a text still has an unfilled {placeholder}')
})

await test('JSON over 10 MB is refused with a toast before it is read; 10 MB exactly opens', async () => {
  const limitBytes = 10 * 1024 * 1024
  const tooLargeJson = path.join(scratchFolder, 'too-large.json')
  const limitJson = path.join(scratchFolder, 'at-limit.json')
  fs.writeFileSync(tooLargeJson, `[${' '.repeat(limitBytes + limitBytes / 20)}]`)
  fs.writeFileSync(limitJson, `[${' '.repeat(limitBytes - 2)}]`)
  for (const address of ['/en', '/en/json-viewer', '/ar/json-viewer']) {
    await openPage(address)
    await chooseFile(tooLargeJson)
    await waitFor(`document.querySelector('#toast-region:popover-open')?.innerText.includes('10 MB')`, `${address}: the too-large toast with the limit`)
    const toastText = await evaluate(`document.querySelector('#toast-region').outerHTML.replace(/<[^>]+>/g, ' ')`)
    expect(address.startsWith('/ar') ? toastText.includes('10 MB') : toastText.includes('too large') && toastText.includes('JSON files up to'), `${address}: the toast said: ${toastText}`)
    expect(await evaluate(`document.querySelector('#json-workbench') === null`), `${address}: the too-large file opened`)
  }
  await openPage('/en/json-viewer')
  await chooseFile(limitJson)
  await waitFor(`document.querySelector('#json-workbench #tree-view')`, 'the 10 MB file to open')
})

await test('JSON in Arabic: the bars mirror, the code and tree stay left to right', async () => {
  await openPage('/ar/json-viewer')
  await evaluate(`document.querySelector('#sample-button-nested-json').click()`)
  await waitFor(`document.querySelector('#tree-view .row')`, 'the tree')
  const layout = await evaluate(`({ home: document.querySelector('#home-button').getBoundingClientRect().right, download: document.querySelector('#download-button').getBoundingClientRect().left, width: innerWidth, tree: getComputedStyle(document.querySelector('#tree-view')).direction, code: getComputedStyle(document.querySelector('#json-text-input')).direction })`)
  expect(layout.home > layout.width - 60 && layout.download < 60, 'the command bar is not mirrored')
  expect(layout.tree === 'ltr' && layout.code === 'ltr', 'the tree or the code is right to left')
  await expectCleanIds('JSON (ar) workbench')
})

await test('JSON on a phone: Text, Tree and Inspector tabs instead of side by side', async () => {
  await onPhone(async () => {
    await openPage('/en/json-viewer')
    await evaluate(`document.querySelector('#sample-button-nested-json').click()`)
    await waitFor(`document.querySelector('#tree-view .row')`, 'the tree')
    const shown = (id) => `getComputedStyle(document.querySelector('${id}')).display !== 'none'`
    expect(await evaluate(`${shown('#mobile-pane-tabs')} && ${shown('#tree-pane')} && !(${shown('#text-pane')})`), 'both panes show on a phone')
    await evaluate(`document.querySelector('#mobile-tab-text').click()`)
    await waitFor(`${shown('#text-pane')} && !(${shown('#tree-pane')})`, 'the text tab')
    await evaluate(`document.querySelector('#mobile-tab-inspector').click()`)
    await waitFor(`${shown('#inspector-drawer')} && !(${shown('#tree-view')})`, 'the inspector tab')
    expect(await evaluate(`${shown('#mobile-action-bar')}`), 'the action bar is missing on a phone')
    expect(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'the page scrolls sideways on a phone')
  })
})

// ---------------------------------------------------------------- internal links: header nav, related tools, footer, home

await test('the header nav, related tools, footer and home links point at built pages, with descriptive text and the current page marked', async () => {
  const builtPage = (href) => fs.existsSync(path.join(distFolder, href, 'index.html'))
  const linksIn = (html, startTag, endTag) => {
    const start = html.indexOf(startTag)
    if (start === -1) return null
    const block = html.slice(start, html.indexOf(endTag, start))
    return [...block.matchAll(/<a [^>]*?href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => ({ tag: match[0], href: match[1], text: match[2].trim() }))
  }
  for (const page of contentPages) {
    for (const locale of ['en', 'ar']) {
      const address = `/${locale}${page}`
      const html = await (await fetch(`${siteOrigin}${address}`)).text()
      // The header is a search box: no links in the served page (the footer links every page instead).
      const navLinks = linksIn(html, '<nav id="site-nav"', '</nav>')
      expect(navLinks?.length === 0 && html.includes('id="site-search-button"'), `${address}: the header should hold the search box and no links`)
      const relatedLinks = linksIn(html, '<section id="related-tools"', '</section>')
      if (formatPages.includes(page) || landingPages.includes(page)) expect(relatedLinks?.length >= 2, `${address}: no related tools`)
      else expect(relatedLinks === null, `${address}: related tools on a page that is not a tool page`)
      const footerLinks = linksIn(html, '<footer id="site-footer"', '</footer>')
      // The social logos have no text, so linksIn skips them: each needs its address and a spoken name.
      for (const profileUrl of socialProfileUrls) expect(new RegExp(`<a [^>]*href="${profileUrl}"[^>]*aria-label="OpenAnyDoc [^"]+"`).test(html), `${address}: the footer lacks the ${profileUrl} logo link`)
      expect(landingPages.every((landingPage) => landingPage === page || footerLinks.some((link) => link.href === `/${locale}${landingPage}`)), `${address}: the footer lacks a landing page`)
      for (const link of [...(relatedLinks ?? []), ...footerLinks]) {
        // The footer's Contact link (mailto:) and the brand's social profiles are the only links that are not pages.
        expect(link.href.startsWith('mailto:') || socialProfileUrls.includes(link.href) || builtPage(link.href), `${address}: ${link.href} is not a built page`)
        expect(!/^(click here|here|tools|more|read more|اضغط هنا|هنا|أدوات|المزيد)$/i.test(link.text), `${address}: the link text "${link.text}" does not say where it goes`)
      }
      const selfLinks = [...(relatedLinks ?? []), ...linksIn(html, '<nav id="footer-viewers"', '</nav>')].filter((link) => link.href === address)
      expect(selfLinks.length === 0, `${address}: related tools or the footer's viewer links point at the page itself`)
    }
  }
  for (const locale of ['en', 'ar']) {
    const html = await (await fetch(`${siteOrigin}/${locale}`)).text()
    for (const landingPage of landingPages) expect(html.includes(`id="landing-link-${landingPage.slice(1)}" href="/${locale}${landingPage}"`), `/${locale}: the home page does not link ${landingPage}`)
  }
})

await test('the changelog writes the same search box as the browser draws, and it fits a phone', async () => {
  for (const locale of ['en', 'ar']) {
    const html = await (await fetch(`${siteOrigin}/${locale}/changelog`)).text()
    const staticNav = html.slice(html.indexOf('<nav id="site-nav"'), html.indexOf('</nav>', html.indexOf('<nav id="site-nav"')) + 6)
    await openPage(`/${locale}/changelog`)
    const liveNav = await evaluate(`document.querySelector('#site-nav').outerHTML`)
    expect(liveNav === staticNav, `/${locale}/changelog: the static nav differs from the React one:\n${staticNav}\n${liveNav}`)
  }
  const navState = () => evaluate(`({ box: document.querySelector('#site-search-button').checkVisibility(), sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth })`)
  for (const address of ['/en', '/ar/json-formatter', '/en/about', '/ar/fix-arabic-csv-in-excel', '/ar/changelog', '/ar/mask-data', '/en/merge-pdf', '/ar/pdf-tools']) {
    await openPage(address)
    const desktop = await navState()
    expect(desktop.box && !desktop.sideways, `${address} at 1280px: the search box should show (${JSON.stringify(desktop)})`)
    await onPhone(async () => {
      await openPage(address)
      const closed = await navState()
      expect(closed.box && !closed.sideways, `${address} at 390px: the search box should fit (${JSON.stringify(closed)})`)
      await evaluate(`document.querySelector('#site-search-button').click()`)
      await waitFor(`document.querySelector('#site-search-input') === document.activeElement`, `${address} at 390px: the search to open`)
      expect(!(await navState()).sideways, `${address} at 390px: the open search scrolls sideways`)
    })
  }
})

// ---------------------------------------------------------------- the <head> follows the page when it changes without a reload

// The tags that describe a page, read from a document: the live page, or the HTML the build wrote for that address.
const readHeadTags = `(document) => ({
  lang: document.documentElement.lang,
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content,
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
  alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => link.hreflang + ' ' + link.getAttribute('href')).sort().join(', '),
  ogUrl: document.querySelector('meta[property="og:url"]')?.content,
  ogTitle: document.querySelector('meta[property="og:title"]')?.content,
  ogImage: document.querySelector('meta[property="og:image"]')?.content,
})`

async function expectHeadOfBuiltPage(address) {
  const builtHtml = fs.readFileSync(path.join(distFolder, address, 'index.html'), 'utf8')
  const difference = await evaluate(`(() => {
    const read = ${readHeadTags}
    const live = read(document)
    const built = read(new DOMParser().parseFromString(${JSON.stringify(builtHtml)}, 'text/html'))
    return Object.keys(built).filter((key) => live[key] !== built[key]).map((key) => key + ': "' + live[key] + '" instead of "' + built[key] + '"').join('; ')
  })()`)
  expect(difference === '', `${address}: ${difference}`)
}

await test('following links and switching language updates the title, description, canonical, alternates, share tags and lang', async () => {
  await openPage('/en')
  await evaluate(`document.querySelector('#footer-link-csv').click()`)
  await waitFor(`location.pathname === '/en/csv-viewer'`, 'the CSV page')
  await expectHeadOfBuiltPage('/en/csv-viewer')
  await evaluate(`document.querySelector('#footer-link-about').click()`)
  await waitFor(`location.pathname === '/en/about' && document.querySelector('#info-page')`, 'the About page')
  await expectHeadOfBuiltPage('/en/about')
  const githubLink = await evaluate(`(() => { const link = document.querySelector('#info-link-github'); return link && { target: link.target, rel: link.rel } })()`)
  expect(githubLink?.target === '_blank' && githubLink.rel.includes('noopener'), `the About page's GitHub link is ${JSON.stringify(githubLink)}; it should open in a new tab`)
  await evaluate(`document.querySelector('#language-switch-link').click()`)
  await waitFor(`location.pathname === '/ar/about' && document.documentElement.dir === 'rtl'`, 'the Arabic About page')
  await expectHeadOfBuiltPage('/ar/about')
  await evaluate(`document.querySelector('#footer-link-json').click()`)
  await waitFor(`location.pathname === '/ar/json-viewer'`, 'the Arabic JSON page')
  await expectHeadOfBuiltPage('/ar/json-viewer')
  await evaluate(`document.querySelector('#language-switch-link').click()`)
  await waitFor(`location.pathname === '/en/json-viewer' && document.documentElement.dir === 'ltr'`, 'the English JSON page')
  await expectHeadOfBuiltPage('/en/json-viewer')
})

// ---------------------------------------------------------------- the browser takes over the build's markup without a mismatch

await test('the build markup has no style attributes (the Content-Security-Policy would block them)', async () => {
  const pagesWithStyle = ['en', 'ar']
    .flatMap((locale) => contentPages.map((page) => `/${locale}${page}`))
    .filter((address) => /<[^>]+\sstyle=/.test(fs.readFileSync(path.join(distFolder, address, 'index.html'), 'utf8')))
  expect(pagesWithStyle.length === 0, `style attributes in ${pagesWithStyle.join(', ')}`)
})

await test('prerendered pages hydrate with no console error, in both languages, light and dark', async () => {
  const addresses = ['en', 'ar'].flatMap((locale) => contentPages.map((page) => `/${locale}${page}`))
  await openPage('/en')
  for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.setItem('theme', '${theme}')`)
    for (const address of addresses) {
      const errorsBefore = pageErrors.length
      await openPage(address)
      await sleep(400)
      expect((await evaluate(`document.documentElement.classList.contains('dark')`)) === (theme === 'dark'), `${address}: the ${theme} theme is not applied`)
      expect(pageErrors.length === errorsBefore, `${address} (${theme}): ${pageErrors.slice(errorsBefore).join(' | ').slice(0, 300)}`)
    }
  }
  await evaluate(`localStorage.removeItem('theme')`)
  await openPage('/en/csv-viewer')
  await chooseFile(sampleCsv)
  await waitFor(`document.querySelector('#data-table')`, 'the CSV file to open after hydration')
})

await test('landing pages accept their own file types, offer another type its viewer, and open a file after hydration', async () => {
  const sampleTsv = path.join(scratchFolder, 'sample.tsv')
  fs.writeFileSync(sampleTsv, 'id\tname\n1\tAlpha\n2\tBeta\n')
  await openPage('/en/tsv-viewer')
  expect((await evaluate(`document.querySelector('#file-input').accept`)) === '.tsv,.tab,text/tab-separated-values', 'the TSV page accepts other types (the media types follow the extensions)')
  await chooseFile(sampleCsv)
  await waitFor(`document.querySelector('#open-in-viewer-button')`, 'the CSV viewer to be offered for a .csv file')
  await chooseFile(sampleTsv)
  await waitFor(`[...document.querySelectorAll('#data-table [id^="cell-"]')].some((cell) => cell.textContent.trim() === 'Alpha')`, 'the TSV file to open with tabs as columns')
  expect((await evaluate('location.pathname')) === '/en/csv-viewer', 'the open TSV file does not have the CSV viewer address')
  await openPage('/en/xls-viewer')
  expect((await evaluate(`document.querySelector('#file-input').accept`)) === '.xls,application/vnd.ms-excel', 'the XLS page accepts other types (the media types follow the extensions)')
  for (const address of ['/en/json-formatter', '/ar/json-validator']) {
    await openPage(address)
    await chooseFile(sampleJson)
    await waitFor(`document.querySelector('#json-workbench .file-tab')?.innerText === 'sample.json' && document.querySelector('#tree-view .row')`, `the JSON file to open on ${address}`)
  }
  // Each landing page opens its viewer in its own mode, so the pages are not copies of one funnel.
  expect(await evaluate(`document.querySelector('#json-workbench').dataset.openedFrom === 'json-validator'`), 'the validator page did not tell the viewer where the file came from')
  await waitFor(`document.querySelector('#editor-notice.notice.ok')`, 'the validator page to validate the file on open')
  await openPage('/en/json-formatter')
  await chooseFile(sampleJson)
  await waitFor(`document.querySelector('#editor-notice')?.innerText.includes('2 spaces')`, 'the formatter page to open with the formatted-view hint')
  await openPage('/en/large-csv-viewer')
  await chooseFile(sampleCsv)
  await waitFor(`document.querySelector('#toast-region')?.innerText.includes('only the shown rows')`, 'the large-CSV page to show the cut-down hint')
  await openPage('/en/xls-viewer')
  await chooseFile(sampleLegacyWorkbook)
  await waitFor(`document.querySelector('#legacy-format-note')?.innerText.includes('97-2003')`, 'the XLS page to show the legacy-format note')
})

await test('Excel: the tools are in the menu bar (icons and menus), ready on open, and a submenu opens in place, goes back and applies its choice', async () => {
  await openPage('/en/excel-viewer')
  await chooseFile(sampleWorkbook)
  await waitFor(`document.querySelector('#cell-1-0')`, 'the workbook')
  expect(await evaluate(`document.querySelector('#edit-toolbar') === null`), 'the edit toolbar is still drawn')
  // Like a spreadsheet, the first cell is selected when the workbook opens, so the tools work without a click first.
  await waitFor(`document.querySelector('#menu-bar-row #menu-bar-tools #toolbar-bold:not(:disabled)') && document.querySelector('#menu-bar-tools #toolbar-text-colour:not(:disabled)')`, 'the icon tools in the menu bar row, ready to use')
  await evaluate(`document.querySelector('#menu-format').click()`)
  await waitFor(`document.querySelector('#menu-format-text-colour:not(:disabled)')`, 'Text colour in the Format menu')
  for (const submenuId of ['number-format', 'currency', 'font', 'font-size', 'fill-colour', 'borders']) {
    expect(await evaluate(`document.querySelector('#menu-format-${submenuId}')?.getAttribute('aria-haspopup') === 'menu'`), `Format has no ${submenuId} submenu`)
  }
  await evaluate(`document.querySelector('#menu-format-text-colour').focus()`)
  await pressKey('ArrowRight', 'ArrowRight', 39)
  await waitFor(`document.activeElement?.id === 'menu-format-text-colour-000000'`, 'the colours, with the first one focused')
  await expectCleanIds('Excel with a submenu open')
  await pressKey('ArrowLeft', 'ArrowLeft', 37)
  await waitFor(`document.activeElement?.id === 'menu-format-text-colour' && !document.querySelector('#menu-submenu-back-button')`, 'Left to go back to the Format menu')
  await evaluate(`document.querySelector('#menu-format-text-colour').click()`)
  await waitFor(`document.querySelector('#menu-format-text-colour-ff0000')`, 'the colours again')
  await evaluate(`document.querySelector('#menu-format-text-colour-ff0000').click()`)
  await waitFor(`[document.querySelector('#cell-1-0'), ...document.querySelectorAll('#cell-1-0 *')].some((element) => getComputedStyle(element).color === 'rgb(255, 0, 0)')`, 'the cell to turn red')
  await evaluate(`document.querySelector('#menu-file').click()`)
  await waitFor(`document.querySelector('#menu-changes-note') && document.querySelector('#menu-file-revert-all:not(:disabled)')`, 'the change count and Revert all in the File menu')
  await evaluate(`document.querySelector('#menu-sheets').click()`)
  await waitFor(`document.querySelector('#menu-sheets-add-sheet') && document.querySelector('#menu-sheets-move-sheet-right')`, 'the Sheets menu')
})

const captureDownloads = `window.__blobs = []; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__blobs.push(blob); return make(blob) }`
const chooseOption = (selector, value) =>
  evaluate(`(() => { const select = document.querySelector('${selector}'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, '${value}'); select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
const peopleCsv = path.join(scratchFolder, 'people.csv')
fs.writeFileSync(peopleCsv, ['name,city,code,score', ...Array.from({ length: 25 }, (_, position) => `Person ${position + 1},الرياض,00${position},${position}.5`)].join('\n'))

await test('conversion pages open the converted file in its own viewer: CSV to JSON and CSV to Excel', async () => {
  await openPage('/en/csv-to-json')
  await expectCleanIds('/en/csv-to-json')
  await chooseFile(peopleCsv)
  await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'people.json'`, 'people.json in the JSON viewer')
  await waitFor(`document.querySelector('#json-text-input')?.value.length > 0 || document.querySelector('#tree-view .row')`, 'the converted JSON')
  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#download-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the JSON download from the viewer')
  const records = JSON.parse(await evaluate(`window.__blobs[0].text()`))
  expect(records.length === 25 && records[0].code === '000' && records[0].score === 0.5 && records[0].city === 'الرياض', `the first object was: ${JSON.stringify(records[0])}`)

  await openPage('/ar/csv-to-excel')
  await chooseFile(peopleCsv)
  await waitFor(`location.pathname === '/ar/excel-viewer' && document.querySelector('#file-name')?.innerText === 'people.xlsx'`, 'people.xlsx in the Excel viewer')
  await waitFor(`[...document.querySelectorAll('#data-table [id^="cell-"]')].some((cell) => cell.textContent === '000')`, 'the code with its leading zero in the workbook')
  await waitFor(`document.querySelector('#download-button') && !document.querySelector('#download-button').disabled`, 'the Excel Download button')
  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#download-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the Excel download from the viewer')
  const workbookBase64 = await evaluate(`window.__blobs[0].arrayBuffer().then((buffer) => { let text = ''; for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte); return btoa(text) })`)
  const convertedWorkbook = new ExcelJS.Workbook()
  await convertedWorkbook.xlsx.load(Buffer.from(workbookBase64, 'base64'))
  const convertedSheet = convertedWorkbook.worksheets[0]
  expect(convertedSheet.getCell('A1').font?.bold === true, 'the header row is not bold')
  expect(convertedSheet.getCell('C2').value === '000' && convertedSheet.getCell('D2').value === 0.5 && convertedSheet.getCell('B2').value === 'الرياض', 'the cells lost their leading zero, their number or their Arabic text')
})

await test('conversion pages open the converted file in its own viewer: Excel to CSV (first sheet), Excel to JSON, JSON to CSV, and a JSON that is not a table', async () => {
  const reportWorkbook = path.join(scratchFolder, 'report.xlsx')
  const twoSheets = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([['Name', 'City'], ['A', 'جدة']]), 'Q1')
  XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([['Name', 'City'], ['B', 'Riyadh, KSA']]), 'Q2')
  fs.writeFileSync(reportWorkbook, XLSX.write(twoSheets, { type: 'buffer', bookType: 'xlsx' }))
  await openPage('/en/excel-to-csv')
  await chooseFile(reportWorkbook)
  await waitFor(`location.pathname === '/en/csv-viewer' && document.querySelector('#open-menu-button')?.innerText.includes('report-Q1.csv')`, 'the first sheet as report-Q1.csv in the CSV viewer')
  await waitFor(`[...document.querySelectorAll('#data-table [id^="cell-"]')].some((cell) => cell.textContent === 'جدة')`, 'the first sheet with its Arabic text')
  expect(await evaluate(`document.querySelector('#status-bar').innerText.includes('UTF-8 with BOM')`), 'the CSV has no UTF-8 byte order mark for its Arabic text')

  await openPage('/en/excel-to-json')
  await chooseFile(sampleWorkbook)
  await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'sample.json'`, 'the workbook in the JSON viewer')
  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#download-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the JSON download')
  const sheetJson = await evaluate(`window.__blobs[0].text()`)
  expect(JSON.stringify(JSON.parse(sheetJson)) === '[{"Name":"A","Qty":1},{"Name":"B","Qty":2}]', `the Excel JSON was: ${sheetJson}`)

  const nestedJson = path.join(scratchFolder, 'orders.json')
  fs.writeFileSync(nestedJson, JSON.stringify([{ id: 1, address: { city: 'Riyadh', zip: '11564' }, tags: ['a', 'b'] }, { id: 2, address: { city: 'Jeddah' }, extra: true }]))
  await openPage('/en/json-to-csv')
  await chooseFile(nestedJson)
  await waitFor(`location.pathname === '/en/csv-viewer' && document.querySelector('#open-menu-button')?.innerText.includes('orders.csv')`, 'orders.csv in the CSV viewer')
  await evaluate(captureDownloads)
  await waitFor(`document.querySelector('#download-button') && !document.querySelector('#download-button').disabled`, 'the CSV Download button')
  await evaluate(`document.querySelector('#download-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the CSV download')
  const flatCsv = await evaluate(`window.__blobs[0].text()`)
  expect(flatCsv.replace(/\r\n/g, '\n') === 'id,address.city,address.zip,tags.0,tags.1,extra\n1,Riyadh,11564,a,b,\n2,Jeddah,,,,true\n', `the flattened CSV was: ${JSON.stringify(flatCsv)}`)

  const listOfNumbers = path.join(scratchFolder, 'numbers.json')
  fs.writeFileSync(listOfNumbers, '[1, 2, 3]')
  await openPage('/en/json-to-csv')
  await chooseFile(listOfNumbers)
  await waitFor(`document.querySelector('#conversion-error')?.innerText.includes('list of objects')`, 'the message that a list of numbers is not a table')
  expect((await evaluate('location.pathname')) === '/en/json-to-csv', 'a file that cannot be converted left the conversion page')
  await expectCleanIds('/en/json-to-csv with an error')
})

await test('Convert in the top bar of the CSV, JSON and Excel viewers opens the converted file, with the edits, in its own viewer', async () => {
  await openPage('/en/csv-viewer')
  await chooseFile(sampleCsv)
  await waitFor(`document.querySelector('#cell-0-1')?.textContent === 'Alpha'`, 'the CSV table')
  const nameCell = await evaluate(`(() => { const box = document.querySelector('#cell-0-1').getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } })()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: nameCell.x, y: nameCell.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: nameCell.x, y: nameCell.y, button: 'left', clickCount: 1 })
  await pressKey('G', 'KeyG', 71, 'G')
  await waitFor(`document.querySelector('#cell-value-inline-input')`, 'the cell editor')
  await send('Input.insertText', { text: 'amma' })
  await pressKey('Enter', 'Enter', 13)
  await waitFor(`document.querySelector('#cell-0-1')?.textContent === 'Gamma'`, 'the edited cell')
  expect(await evaluate(`document.querySelector('#menu-file-convert-to-json') === null`), 'Convert is still in the File menu')
  await evaluate(`document.querySelector('#convert-button').click()`)
  await waitFor(`document.querySelector('#convert-menu-to-json')`, 'the Convert menu')
  await expectCleanIds('CSV viewer with the Convert menu open')
  await evaluate(`document.querySelector('#convert-menu-to-json').click()`)
  await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'sample.json'`, 'the converted file in the JSON viewer')
  await waitFor(`document.querySelector('#json-text-input')?.value.includes('"Gamma"') || document.querySelector('#tree-view')?.innerText.includes('Gamma')`, 'the edit in the converted JSON')
  expect(await evaluate(`document.querySelector('dialog[open]') === null`), 'converting asked to discard the edits')

  await evaluate(`document.querySelector('#convert-button').click()`)
  await waitFor(`document.querySelector('#convert-button-menu-to-csv')`, 'the JSON viewer Convert menu')
  await evaluate(`document.querySelector('#convert-button-menu-to-csv').click()`)
  await waitFor(`location.pathname === '/en/csv-viewer' && [...document.querySelectorAll('#data-table [id^="cell-"]')].some((cell) => cell.textContent === 'Gamma')`, 'the JSON converted back to CSV in the CSV viewer')

  const twoSheetWorkbook = path.join(scratchFolder, 'two-sheets.xlsx')
  const twoSheets = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([['Name', 'Qty'], ['A', 1]]), 'First')
  XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([['Name', 'Qty'], ['B', 2]]), 'Second')
  fs.writeFileSync(twoSheetWorkbook, XLSX.write(twoSheets, { type: 'buffer', bookType: 'xlsx' }))
  await openPage('/en/excel-viewer')
  await chooseFile(twoSheetWorkbook)
  await waitFor(`document.querySelector('#data-table') && document.querySelectorAll('[id^="sheet-tab-"]').length === 2`, 'the workbook with two sheets')
  await evaluate(`document.querySelectorAll('[id^="sheet-tab-"]')[1].click()`)
  await waitFor(`document.querySelector('[id^="sheet-tab-"][aria-selected="true"]')?.textContent.includes('Second')`, 'the second sheet')
  await waitFor(`document.querySelector('#convert-button')`, 'the Convert button in the top bar')
  await evaluate(`document.querySelector('#convert-button').click()`)
  await waitFor(`document.querySelector('#convert-button-menu-to-json')`, 'the Excel Convert menu')
  await evaluate(`document.querySelector('#convert-button-menu-to-json').click()`)
  await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'two-sheets-Second.json'`, 'the sheet on screen, opened as JSON')
})

await test('the header search finds a converter by name, and choosing one then a file opens the result in its viewer', async () => {
  for (const locale of ['en', 'ar']) {
    await openPage(`/${locale}`)
    expect(await evaluate(`document.querySelector('#site-header').getBoundingClientRect().height < 100`), `/${locale}: the header no longer fits on one line at 1280 px`)
    await evaluate(`document.querySelector('#site-search-button').click()`)
    await waitFor(`document.querySelector('#site-search-option-csv-to-excel')?.checkVisibility()`, `/${locale}: the search with its starting list`)
    const panelBox = await evaluate(`JSON.stringify(document.querySelector('#site-search-panel').getBoundingClientRect())`)
    const { left, right } = JSON.parse(panelBox)
    expect(left >= 0 && right <= 1280, `/${locale}: the search panel is cut off at the edge (${panelBox})`)
    await pressKey('Escape', 'Escape', 27)
    await waitFor(`!document.querySelector('#site-search-panel') && document.activeElement?.id === 'site-search-button'`, `/${locale}: Escape to close the search`)
  }
  // Typing a converter's name, then Enter, then a file, lands in the viewer of the converted format.
  await openPage('/en')
  for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 4 })
  await waitFor(`document.activeElement?.id === 'site-search-input'`, '⌘K to open the search')
  await send('Input.insertText', { text: 'csv to json' })
  await waitFor(`document.querySelector('#site-search-option-csv-to-json')?.getAttribute('aria-selected') === 'true'`, 'CSV to JSON as the first result')
  await pressKey('Enter', 'Enter', 13)
  await waitFor(`location.pathname === '/en/csv-to-json' && !document.querySelector('#site-search-panel')`, 'the CSV to JSON page, with the search closed')
  await chooseFile(peopleCsv)
  await waitFor(`location.pathname === '/en/json-viewer' && document.querySelector('#json-workbench .file-tab')?.innerText === 'people.json'`, 'the converted file in the JSON viewer')
})

// A popover's default `inset: 0` used to win over the menu's `left` in right-to-left, pinning the menu to the far edge.
await test('in Arabic the top-bar Convert menu opens under its button', async () => {
  await openPage('/ar/excel-viewer')
  await chooseFile(sampleWorkbook)
  await waitFor(`document.querySelector('#excel-workbench #convert-button')`, 'the Excel viewer')
  await evaluate(`document.querySelector('#convert-button').click()`)
  await waitFor(`document.querySelector('#convert-button-menu')`, 'the Convert menu')
  const boxes = JSON.parse(await evaluate(`JSON.stringify([document.querySelector('#convert-button').getBoundingClientRect(), document.querySelector('#convert-button-menu').getBoundingClientRect()])`))
  expect(Math.abs(boxes[0].right - boxes[1].right) < 2, `the menu's end edge is at ${boxes[1].right}, the button's at ${boxes[0].right}`)
})

// Mask Data. Every value is made up: test card numbers, the published example IBAN, IDs with a computed check digit.
function makeSyntheticId(firstDigits) {
  const isLuhnValid = (digits) => [...digits].reverse().reduce((sum, digit, position) => sum + (position % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][digit] : Number(digit)), 0) % 10 === 0
  for (let checkDigit = 0; checkDigit <= 9; checkDigit++) if (isLuhnValid(`${firstDigits}${checkDigit}`)) return `${firstDigits}${checkDigit}`
}
const maskCsv = path.join(scratchFolder, 'customers.csv')
const maskCsvText = [
  'name,email,phone,national_id,iban,card,amount,notes',
  `Sara Example,sara@example.com,+966500000001,${makeSyntheticId('100000001')},GB82WEST12345698765432,4111111111111111,10.50,Sara Example asked us to write to sara@example.com instead`,
  `سارة مثال,omar@example.org,0500000002,${makeSyntheticId('200000002')},GB82WEST12345698765432,5555555555554444,20.00,Call back on 0500000009 about the late delivery please`,
  `Omar Sample,lina@example.net,0500000003,${makeSyntheticId('100000003')},GB82WEST12345698765432,4111111111111111,30.25,Nothing to add for this customer at the moment really`,
].join('\n')
fs.writeFileSync(maskCsv, maskCsvText)
const maskJson = path.join(scratchFolder, 'customers.json')
fs.writeFileSync(maskJson, JSON.stringify({ customers: [{ profile: { fullName: 'Sara Example', email: 'sara@example.com' }, points: 12 }, { profile: { fullName: 'Omar Sample', email: 'omar@example.org' }, points: 7 }] }))
const maskWorkbook = path.join(scratchFolder, 'people.xlsx')
const maskSheets = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(maskSheets, XLSX.utils.aoa_to_sheet([['Name', 'Email'], ['Sara Example', 'sara@example.com'], ['Omar Sample', 'omar@example.org']]), 'Staff')
XLSX.utils.book_append_sheet(maskSheets, XLSX.utils.aoa_to_sheet([['Client name', 'Mobile', 'Orders'], ['Lina Demo', '0500000004', 3]]), 'Clients')
fs.writeFileSync(maskWorkbook, XLSX.write(maskSheets, { type: 'buffer', bookType: 'xlsx' }))

async function chooseFileIn(selector, filePath) {
  const { root } = await send('DOM.getDocument')
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector })
  await send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
}
const lastBlobText = () => evaluate(`window.__blobs[window.__blobs.length - 1].text()`)
const rowIdFor = (category) => evaluate(`document.querySelector('#mask-chosen-fields .mw-row[data-category="${category}"]')?.id ?? ''`)
const chosenCategories = () => evaluate(`[...document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]')].map((row) => row.dataset.category).join(',')`)
const goToMaskStep = async (step) => {
  await evaluate(`document.querySelector('#mask-step-${step}-button').click()`)
  await waitFor(`document.querySelector('#mask-step-${step}-button').getAttribute('aria-current') === 'step'`, `mask step ${step}`)
}
const maskText = path.join(scratchFolder, 'note.txt')
fs.writeFileSync(maskText, 'Hello team,\nplease write to sara@example.com or call +966 50 000 0001 before Friday.\nThanks')

await test('Mask Data lists every column, starts with the sensitive ones, masks them with tokens (inside free text too), and restores them with the private key', async () => {
  await openPage('/en/mask-data')
  await waitFor(`document.querySelector('#mask-warning')`, 'the Mask Data panel')
  await expectCleanIds('/en/mask-data')
  expect((await evaluate(`document.querySelector('#mask-warning')?.innerText.trim()`)) === "Masking lowers the risk but isn't a guarantee. Check the result before you share it.", 'the warning is not shown word for word')
  await chooseFile(maskCsv)
  await waitFor(`document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]').length > 0`, 'the chosen columns')
  expect((await chosenCategories()) === 'name,email,phone,nationalId,iban,card,freeText', `the chosen columns were ${await chosenCategories()}`)
  await evaluate(`document.querySelector('#mask-columns-button').click()`)
  await waitFor(`document.querySelector('#mask-columns-list')`, 'the column list')
  expect(await evaluate(`document.querySelectorAll('#mask-columns-list input[type=checkbox]').length === 8 && !document.querySelector('#mask-field-7-checkbox').checked`), 'the list does not offer all 8 columns with amount unticked')
  await expectCleanIds('/en/mask-data with the column list open')
  // A column the scan did not flag can be added, as Other.
  await evaluate(`document.querySelector('#mask-field-7-checkbox').click()`)
  await waitFor(`document.querySelector('#mask-field-7')?.dataset.category === 'other'`, 'amount added as Other')
  await evaluate(`document.querySelector('#mask-field-7-remove').click()`)
  await waitFor(`!document.querySelector('#mask-field-7')`, 'amount removed again')

  await goToMaskStep(2)
  await waitFor(`document.querySelector('#mask-preview-table[data-view="after"]')?.innerText.includes('EMAIL-000001')`, 'the masked preview')
  await expectCleanIds('/en/mask-data on the preview step')
  await evaluate(`document.querySelector('#mask-preview-before-button').click()`)
  await waitFor(`document.querySelector('#mask-preview-table[data-view="before"]')?.innerText.includes('sara@example.com')`, 'the original rows')
  expect(await evaluate(`document.querySelectorAll('#mask-preview-table tbody tr').length === 3`), 'the preview does not show the 3 rows')
  await goToMaskStep(3)
  await expectCleanIds('/en/mask-data on the download step')

  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#mask-key-checkbox').click()`)
  await waitFor(`document.querySelector('#mask-key-warning') && document.querySelector('#download-mask-key-button')?.disabled`, 'the key warning and the key button waiting for a masked file')
  await evaluate(`document.querySelector('#download-masked-csv-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the masked CSV')
  const maskedCsv = await lastBlobText()
  for (const original of ['sara@example.com', 'Sara Example', '0500000009', '4111111111111111', 'GB82WEST']) expect(!maskedCsv.includes(original), `the masked CSV still has ${original}`)
  expect(maskedCsv.includes('NAME-000001 asked us to write to EMAIL-000001 instead') && maskedCsv.includes('10.50'), `the masked CSV was: ${maskedCsv}`)
  await waitFor(`!document.querySelector('#download-mask-key-button').disabled`, 'the key button')
  await evaluate(`document.querySelector('#download-mask-key-button').click()`)
  await waitFor(`window.__blobs.length === 2`, 'the private key')
  const keyText = await lastBlobText()
  expect(JSON.parse(keyText).tokens['EMAIL-000001'].value === 'sara@example.com', 'the key does not map EMAIL-000001 to its email')

  const maskedFile = path.join(scratchFolder, 'customers-masked.csv')
  const keyFile = path.join(scratchFolder, 'customers-private-key.json')
  fs.writeFileSync(maskedFile, maskedCsv)
  fs.writeFileSync(keyFile, keyText)
  await evaluate(`document.querySelector('#restore-tab').click()`)
  await waitFor(`document.querySelector('#restore-panel')`, 'the Restore tab')
  await expectCleanIds('/en/mask-data on the Restore tab')
  await chooseFileIn('#restore-file-input', maskedFile)
  await chooseFileIn('#restore-key-input', keyFile)
  await waitFor(`!document.querySelector('#restore-button').disabled`, 'the Restore button')
  await evaluate(`document.querySelector('#restore-button').click()`)
  await waitFor(`window.__blobs.length === 3`, 'the restored CSV')
  const restoredCsv = (await lastBlobText()).replace(/^﻿/, '').replace(/\r\n/g, '\n').trim()
  expect(restoredCsv === maskCsvText, `the restored CSV was: ${restoredCsv}`)
  expect((await evaluate(`document.querySelector('#restore-message')?.innerText`)).includes('customers-restored.csv'), 'no message names the restored file')

  // A wrong key is refused; a partial mask and a removed field change the download.
  await chooseFileIn('#restore-key-input', maskCsv)
  await evaluate(`document.querySelector('#restore-button').click()`)
  await waitFor(`document.querySelector('#restore-message')?.innerText.includes('not a Mask Data key')`, 'the message about a wrong key')
  await evaluate(`document.querySelector('#mask-tab').click()`)
  await goToMaskStep(1)
  await chooseOption(`#${await rowIdFor('card')}-strategy`, 'partial')
  await chooseOption(`#${await rowIdFor('iban')}-strategy`, 'remove')
  await goToMaskStep(2)
  await evaluate(`document.querySelector('#mask-preview-after-button').click()`)
  await waitFor(`document.querySelector('#mask-preview-table[data-view="after"]')?.innerText.includes('****1111') && !document.querySelector('#mask-preview-table').innerText.includes('iban')`, 'the preview with a partial card and no IBAN')
  await goToMaskStep(3)
  await evaluate(`document.querySelector('#download-masked-json-button').click()`)
  await waitFor(`window.__blobs.length === 4`, 'the masked JSON')
  const maskedRecords = JSON.parse(await lastBlobText())
  expect(maskedRecords[0].card === '****1111' && !('iban' in maskedRecords[0]) && maskedRecords[0].amount === 10.5, `the first masked record was ${JSON.stringify(maskedRecords[0])}`)
})

await test('Mask Data masks every sheet of a workbook, nested JSON keeping numbers, and a text file', async () => {
  await openPage('/ar/mask-data')
  await chooseFile(maskWorkbook)
  await waitFor(`document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]').length === 4`, 'the four sensitive columns of the two sheets')
  await expectCleanIds('/ar/mask-data with chosen columns')
  await goToMaskStep(2)
  await waitFor(`document.querySelector('#mask-preview-table')`, 'the preview step')
  expect(await evaluate(`document.querySelector('#mask-preview-sheet-select')?.options.length === 2`), 'no sheet picker for the two sheets')
  await goToMaskStep(3)
  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#download-masked-xlsx-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the masked workbook')
  const workbookBase64 = await evaluate(`window.__blobs[0].arrayBuffer().then((buffer) => { let text = ''; for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte); return btoa(text) })`)
  const maskedWorkbook = new ExcelJS.Workbook()
  await maskedWorkbook.xlsx.load(Buffer.from(workbookBase64, 'base64'))
  const [staffSheet, clientsSheet] = maskedWorkbook.worksheets
  expect(staffSheet.name === 'Staff' && staffSheet.getCell('B2').value === 'EMAIL-000001' && staffSheet.getCell('A3').value === 'NAME-000002', 'the Staff sheet is not masked')
  expect(clientsSheet.name === 'Clients' && clientsSheet.getCell('B2').value === 'PHONE-000001' && clientsSheet.getCell('C2').value === 3, 'the Clients sheet is not masked, or lost its number')

  await openPage('/en/mask-data')
  await chooseFile(maskJson)
  await waitFor(`document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]').length === 2`, 'the name and email of the JSON')
  await goToMaskStep(2)
  await waitFor(`document.querySelector('#mask-preview-table[data-view="after"]')?.innerText.includes('NAME-000001')`, 'the JSON preview')
  await goToMaskStep(3)
  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#download-masked-json-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the masked JSON')
  const masked = JSON.parse(await lastBlobText())
  expect(JSON.stringify(masked) === JSON.stringify({ customers: [{ profile: { fullName: 'NAME-000001', email: 'EMAIL-000001' }, points: 12 }, { profile: { fullName: 'NAME-000002', email: 'EMAIL-000002' }, points: 7 }] }), `the masked JSON was ${JSON.stringify(masked)}`)

  await openPage('/en/mask-data')
  await chooseFile(maskText)
  await waitFor(`document.querySelector('#mask-chosen-fields .mw-row[data-category]')?.dataset.category === 'freeText' && !document.querySelector('#mask-columns-button')`, 'the text file as one free-text field')
  await goToMaskStep(3)
  expect(await evaluate(`Boolean(document.querySelector('#download-masked-txt-button')) && !document.querySelector('#download-masked-csv-button')`), 'a text file is not offered as TXT only')
  await evaluate(captureDownloads)
  await evaluate(`document.querySelector('#download-masked-txt-button').click()`)
  await waitFor(`window.__blobs.length === 1`, 'the masked text')
  const maskedText = await lastBlobText()
  expect(maskedText === 'Hello team,\nplease write to EMAIL-000001 or call PHONE-000001 before Friday.\nThanks', `the masked text was ${JSON.stringify(maskedText)}`)
})

await test('the CSV, JSON and Excel viewers open Mask data in a drawer over the file, from a top-bar button and their menus', async () => {
  const drawerCases = [
    ['/en/csv-viewer', maskCsv, `document.querySelector('#csv-workbench #data-table tbody td')`, 7],
    ['/en/json-viewer', maskJson, `document.querySelector('#json-workbench .file-tab')?.innerText === 'customers.json'`, 2],
    ['/ar/excel-viewer', maskWorkbook, `document.querySelector('#excel-workbench #data-table')`, 4],
  ]
  for (const [address, file, openedCheck, rowCount] of drawerCases) {
    await openPage(address)
    await chooseFile(file)
    await waitFor(openedCheck, `${address}: the file`)
    // The workbook is written with its edits (ExcelJS) before it is masked, which takes longer under a full run.
    await waitFor(`document.querySelector('#mask-button') && !document.querySelector('#mask-button').disabled`, `${address}: the Mask button`, 20000)
    await evaluate(`document.querySelector('#mask-button').click()`)
    await waitFor(`document.querySelector('#mask-tool.mask-drawer') && document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]').length === ${rowCount}`, `${address}: the drawer with ${rowCount} chosen fields`, 20000)
    expect((await evaluate('location.pathname')) === address, `${address}: opening the drawer left the page`)
    await expectCleanIds(`${address} with the Mask drawer open`)
    await pressKey('Escape', 'Escape', 27)
    await waitFor(`!document.querySelector('#mask-tool') && document.activeElement?.id === 'mask-button'`, `${address}: the drawer to close on Escape, focus back on the button`)
  }
  await openPage('/en/txt-viewer')
  await chooseFile(maskText)
  await waitFor(`document.querySelector('#txt-workbench #file-name')`, 'the TXT viewer')
  expect(await evaluate(`!document.querySelector('#mask-button')`), 'the TXT viewer has a Mask button')
  // The CSV More menu opens the same drawer; the File menu no longer lists it (the top-bar button does).
  await openPage('/en/csv-viewer')
  await chooseFile(maskCsv)
  await waitFor(`document.querySelector('#csv-workbench #data-table tbody td')`, 'the CSV viewer')
  // On a wide screen the delimiter, header and encoding live in the status bar only, not in the More menu.
  await evaluate(`document.querySelector('#more-menu-button').click()`)
  await waitFor(`document.querySelector('#more-menu-download')`, 'the More menu')
  expect(await evaluate(`!document.querySelector('#more-menu-reading') && Boolean(document.querySelector('#status-delimiter-button'))`), 'the More menu still has Delimiter, header, encoding')
  await pressKey('Escape', 'Escape', 27)
  // A disabled menu item says why on hover.
  await evaluate(`document.querySelector('#menu-edit').click()`)
  await waitFor(`document.querySelector('#menu-edit-undo')`, 'the Edit menu')
  expect((await evaluate(`document.querySelector('#menu-edit-undo').title`)) === 'Nothing to undo', 'the disabled Undo does not say why')
  await pressKey('Escape', 'Escape', 27)
  await evaluate(`document.querySelector('#menu-file').click()`)
  await waitFor(`document.querySelector('#menu-file-open')`, 'the File menu')
  expect(await evaluate(`!document.querySelector('#menu-file-mask-data')`), 'the File menu still lists Mask data')
  await pressKey('Escape', 'Escape', 27)
  await evaluate(`document.querySelector('#more-menu-button').click()`)
  await waitFor(`document.querySelector('#more-menu-mask-data')`, 'Mask sensitive data in the More menu')
  await evaluate(`document.querySelector('#more-menu-mask-data').click()`)
  await waitFor(`document.querySelectorAll('#mask-tool.mask-drawer #mask-chosen-fields .mw-row[data-category]').length === 7`, 'the drawer from the More menu')
  await onPhone(async () => {
    const drawerBox = JSON.parse(await evaluate(`JSON.stringify(document.querySelector('#mask-tool').getBoundingClientRect())`))
    expect(drawerBox.width <= 390 && drawerBox.left >= 0, `the drawer does not fit a phone: ${JSON.stringify(drawerBox)}`)
  })
})

// The tool pages say the site works without a network once loaded: each page fetches its viewer while idle (App.tsx).
const goOffline = (offline) => send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
await test('once a tool page is idle, its file opens with no network; code that cannot load shows a reload message, not a blank page', async () => {
  const offlineCases = [
    ['/en/csv-viewer', sampleCsv, `document.querySelector('#csv-workbench #data-table tbody td')`],
    ['/en/json-viewer', sampleJson, `document.querySelector('#json-workbench .file-tab')?.innerText === 'sample.json' && !document.querySelector('#json-workbench [role="alert"]')`],
    ['/en/excel-viewer', sampleWorkbook, `document.querySelector('#excel-workbench #data-table')`],
    ['/en', sampleCsv, `document.querySelector('#csv-workbench #data-table tbody td')`],
    ['/en/mask-data', maskWorkbook, `document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]').length === 4`],
  ]
  try {
    for (const [address, file, openedCheck] of offlineCases) {
      await send('Network.clearBrowserCache')
      await openPage(address)
      await sleep(3000)
      await goOffline(true)
      await chooseFile(file)
      await waitFor(openedCheck, `${address}: the file to open offline`)
      await goOffline(false)
    }
    // Offline before the page has fetched anything: the file page cannot load.
    await send('Network.clearBrowserCache')
    await openPage('/en/txt-viewer')
    await goOffline(true)
    await chooseFile(sampleText)
    await waitFor(`document.querySelector('#load-failed-message') && document.querySelector('#reload-page-button')`, 'the reload message')
  } finally {
    await goOffline(false)
  }
})

// ---------------------------------------------------------------- first screen of the tool pages (Step 17C)

const formatPagesWithSamples = ['/csv-viewer', '/txt-viewer', '/json-viewer', '/excel-viewer', '/word-viewer', '/powerpoint-viewer', ...landingPages]

await test('every tool page shows its choose button and two sample files on the first screen of a 375 x 667 phone, in both languages', async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true })
  try {
    for (const locale of ['en', 'ar']) {
      for (const page of formatPagesWithSamples) {
        await openPage(`/${locale}${page}`)
        const firstScreen = await evaluate(`({ samples: document.querySelectorAll('#sample-files [id^="sample-button-"]').length, chooseBottom: document.querySelector('#choose-file-button').getBoundingClientRect().bottom, samplesBottom: document.querySelector('#sample-files')?.getBoundingClientRect().bottom ?? 9999, answer: document.querySelector('#page-answer')?.innerText ?? '', proofLink: document.querySelector('#page-proof-link')?.getAttribute('href') })`)
        expect(firstScreen.samples === 2, `/${locale}${page}: ${firstScreen.samples} sample buttons, not 2`)
        expect(firstScreen.chooseBottom <= 667 && firstScreen.samplesBottom <= 667, `/${locale}${page}: the choose button or the samples end at ${Math.round(firstScreen.samplesBottom)} px, below the 667 px first screen`)
        expect(firstScreen.answer.length > 30 && firstScreen.proofLink === `/${locale}/check-file-upload`, `/${locale}${page}: the answer sentence or the proof link is missing`)
      }
    }
  } finally {
    await send('Emulation.clearDeviceMetricsOverride')
  }
})

await test('a sample file opens with no network once its page is idle, with the Next strip of its format', async () => {
  const sampleCases = [
    ['/en/csv-viewer', 'arabic-csv', `document.querySelector('#csv-workbench #data-table tbody td')`, 'to-excel,to-json,mask'],
    ['/en/json-viewer', 'records-json', `document.querySelector('#json-workbench .file-tab')?.innerText === 'customers.json' && !document.querySelector('#json-workbench [role="alert"]')`, 'format,to-csv,mask'],
    ['/en/txt-viewer', 'release-notes-txt', `document.querySelector('#txt-workbench #file-name')`, 'find,sort-lines,remove-duplicates'],
    ['/en/excel-viewer', 'sales-xlsx', `document.querySelector('#excel-workbench #data-table') && document.querySelectorAll('#sheet-tabs [role="tab"], [id^="sheet-tab-"]').length >= 3`, 'to-csv,to-json,mask'],
    ['/en/word-viewer', 'quarterly-docx', `document.querySelector('#word-document section, #word-document .docx')`, 'print,fit-width'],
    ['/en/powerpoint-viewer', 'review-pptx', `document.querySelector('#slide-stage svg, #slide-stage div')`, ''],
    ['/en/mask-data', 'people-xlsx', `document.querySelectorAll('#mask-chosen-fields .mw-row[data-category]').length > 0`, null],
  ]
  try {
    for (const [address, sampleId, openedCheck, nextSteps] of sampleCases) {
      await send('Network.clearBrowserCache')
      await openPage(address)
      await sleep(3000)
      await goOffline(true)
      await evaluate(`document.querySelector('#sample-button-${sampleId}').click()`)
      await waitFor(openedCheck, `${address}: the ${sampleId} sample to open offline`)
      if (nextSteps === null) continue
      const strip = await evaluate(`[...document.querySelectorAll('#next-steps .next-step-button')].map((button) => button.id.replace('next-step-', '')).join(',')`)
      // PowerPoint offers full screen only where the browser allows it, so only its last step is fixed.
      expect(nextSteps ? strip === nextSteps : strip.endsWith('open-another'), `${address}: the Next strip was "${strip}"`)
      await goOffline(false)
    }
  } finally {
    await goOffline(false)
  }
  await openPage('/en/csv-viewer')
  await evaluate(`document.querySelector('#sample-button-customers-csv').click()`)
  await waitFor(`document.querySelector('#next-step-to-excel') && !document.querySelector('#next-step-to-excel').disabled`, 'the Next strip ready')
  await expectCleanIds('/en/csv-viewer with a sample and the Next strip')
  await evaluate(`document.querySelector('#next-step-to-excel').click()`)
  await waitFor(`location.pathname === '/en/excel-viewer' && document.querySelector('#excel-workbench #data-table')`, 'Convert to Excel from the Next strip')
})

// ---------------------------------------------------------------- report

let failureCount = 0
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok ? '' : `\n      ${result.reason}`}`)
  if (!result.ok) failureCount++
}
console.log(`\n${results.length - failureCount} of ${results.length} passed`)

socket.close()
const chromeHasExited = new Promise((resolve) => chrome.once('exit', resolve))
chrome.kill()
await chromeHasExited
server.close()
try {
  fs.rmSync(scratchFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
} catch {
  // The temporary folder is cleaned up by the system later.
}
process.exit(failureCount === 0 ? 0 : 1)
