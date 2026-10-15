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

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const distFolder = path.join(projectRoot, 'dist')
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const scratchFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'whats-new-test-'))
const SAVED_TEST_YEAR_START = Date.UTC(2027, 0, 1)

// ---------------------------------------------------------------- static server with the site's CSP

const contentSecurityPolicy = fs.readFileSync(path.join(projectRoot, 'public/_headers'), 'utf8').match(/Content-Security-Policy:\s*(.*)/i)?.[1]
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' }

function resolveFile(urlPath) {
  const candidate = path.join(distFolder, decodeURIComponent(urlPath.split('?')[0]))
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  const folderIndex = path.join(candidate, 'index.html')
  if (fs.existsSync(folderIndex)) return folderIndex
  return path.join(distFolder, 'index.html')
}

const server = http.createServer((request, response) => {
  const filePath = resolveFile(request.url ?? '/')
  response.writeHead(200, { 'content-type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream', 'content-security-policy': contentSecurityPolicy ?? '' })
  fs.createReadStream(filePath).pipe(response)
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

const sampleJson = path.join(scratchFolder, 'sample.json')
fs.writeFileSync(sampleJson, '{"a":1,"b":[1,2,3]}')
const unknownFile = path.join(scratchFolder, 'notes.docx')
fs.writeFileSync(unknownFile, 'not a real document')

const results = []
async function test(name, run) {
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
const bannerText = () => evaluate(`document.querySelector('[role=region]')?.innerText ?? null`)

await test('home page shows the banner, the badges and takes no focus', async () => {
  await openPage('/')
  const text = await bannerText()
  expect(text?.includes('New') && text.includes('You can now open and edit CSV, TXT, JSON, and Excel files'), `banner text was: ${text}`)
  expect(await evaluate(`document.activeElement === document.body`), 'the banner took focus')
  expect(await evaluate(`document.querySelectorAll('footer nav [data-file-type]').length >= 4`), 'footer badges are missing')
  expect(await evaluate(`[...document.querySelectorAll('footer nav li')].some((item) => item.innerText.includes('JSON viewer') && item.innerText.includes('New'))`), 'the JSON nav link has no New badge')
})

await test('the banner closes with the keyboard and stays closed while navigating in the tab', async () => {
  await openPage('/')
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Close announcement'`)) break
    await pressKey('Tab', 'Tab', 9)
  }
  expect(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Close announcement'`), 'could not reach the close button with Tab')
  await pressKey('Enter', 'Enter', 13, '\r')
  await waitFor(`!document.querySelector('[role=region]')`, 'the banner to close')
  await evaluate(`document.querySelector('footer nav a[href="/json-viewer"]').click()`)
  await waitFor(`location.pathname === '/json-viewer'`, 'navigation to the JSON page')
  expect((await bannerText()) === null, 'the banner came back after navigating')
  const crossLinks = await evaluate(`[...document.querySelectorAll('p')].find((p) => p.innerText.startsWith('Also works with'))?.innerText ?? null`)
  expect(crossLinks && crossLinks.includes('CSV') && crossLinks.includes('Excel') && !crossLinks.includes('JSON'), `cross-format line was: ${crossLinks}`)
})

await test('a reload brings the banner back, so nothing was remembered', async () => {
  await openPage('/json-viewer')
  const jsonPageBanner = await bannerText()
  expect(jsonPageBanner && !jsonPageBanner.includes('JSON') && jsonPageBanner.includes('Excel'), `the JSON page banner was: ${jsonPageBanner}`)
  await openPage('/')
  expect((await bannerText()) !== null, 'the banner did not come back after the reload')
})

await test('a JSON file dropped on the CSV page is offered the JSON viewer, with the same File', async () => {
  await openPage('/csv-viewer')
  await chooseFile(sampleJson)
  await waitFor(`document.body.innerText.includes('This looks like a JSON file.')`, 'the redirect offer')
  expect(await evaluate(`document.body.innerText.includes("can't be opened here")`) === false, 'the plain rejection was shown too')
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.innerText === 'Open it in the JSON viewer').click()`)
  await waitFor(`location.pathname === '/json-viewer' && document.querySelector('h1')?.innerText === 'sample.json'`, 'the file to open in the JSON viewer')
  expect(!(await evaluate('location.href')).includes('sample'), 'the file name reached the URL')
  const banner = await bannerText()
  expect(banner && !banner.includes('JSON') && banner.includes('Excel'), `viewer page banner was: ${banner}`)
})

await test('a file nobody opens keeps the friendly rejection', async () => {
  await openPage('/csv-viewer')
  await chooseFile(unknownFile)
  await waitFor(`document.body.innerText.includes("notes.docx can't be opened here")`, 'the rejection message')
  expect(!(await evaluate(`document.body.innerText.includes('This looks like')`)), 'a redirect was offered for an unregistered type')
})

await test('saving a file shows one dismissible tip', async () => {
  await openPage('/json-viewer')
  await chooseFile(sampleJson)
  await waitFor(`document.querySelector('h1')?.innerText === 'sample.json'`, 'the file to open')
  const downloadButton = `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Download')`
  await waitFor(`${downloadButton} && !${downloadButton}.disabled`, 'the Download button')
  await evaluate(`${downloadButton}.click()`)
  await waitFor(`[...document.querySelectorAll('[role=status]')].some((status) => status.innerText.includes('also opens and edits'))`, 'the tip')
  await evaluate(`document.querySelector('button[aria-label="Dismiss tip"]').click()`)
  await waitFor(`![...document.querySelectorAll('[role=status]')].some((status) => status.innerText.includes('also opens and edits'))`, 'the tip to close')
})

await test('after the window ends there are no badges and no banner', async () => {
  const fakeClock = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { const RealDate = Date; class FakeDate extends RealDate { constructor(...args) { if (args.length) super(...args); else super(${SAVED_TEST_YEAR_START}) } static now() { return ${SAVED_TEST_YEAR_START} } }; window.Date = FakeDate })()`,
  })
  try {
    await openPage('/')
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
    expect(html.includes(`rel="canonical" href="https://openanydoc.com/${locale}/changelog"`), 'canonical is missing')
    expect(/<title>[^<]+<\/title>/.test(html) && /name="description"\s+content="[^"]+/.test(html), 'title or description is missing')
    await openPage(`/${locale}/changelog`)
    expect((await evaluate(`document.documentElement.dir`)) === (locale === 'ar' ? 'rtl' : 'ltr'), 'wrong text direction')
    expect(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), 'the page scrolls sideways')
    expect(await evaluate(`document.querySelector('[role=region]') === null`), 'the changelog page should not show the banner')
  })
}

await test('home and format pages carry their own title, description, canonical and structured data', async () => {
  const titles = new Set()
  const questionLists = new Map()
  for (const address of ['/', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer']) {
    const html = await (await fetch(`${siteOrigin}${address}`)).text()
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1].replace(/&amp;/g, '&') ?? ''
    const description = /name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(title.length > 0 && title.length <= 60, `${address}: title is ${title.length} characters: ${title}`)
    expect(description.length >= 120 && description.length <= 160, `${address}: description is ${description.length} characters`)
    expect(html.includes(`<link rel="canonical" href="https://openanydoc.com${address}"`), `${address}: canonical is missing`)
    expect(html.includes('property="og:title"') && html.includes('property="og:description"'), `${address}: Open Graph tags are missing`)
    expect(html.includes('<noscript>') && html.includes('<h1>'), `${address}: the no-script text is missing`)
    const structuredData = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((match) => JSON.parse(match[1]))
    expect(structuredData.some((item) => item['@type'] === 'WebApplication'), `${address}: WebApplication data is missing`)
    expect(!titles.has(title), `${address}: the title is used on another page`)
    titles.add(title)
    const faq = structuredData.find((item) => item['@type'] === 'FAQPage')
    expect(faq, `${address}: there is no FAQPage data`)
    await openPage(address)
    const visibleQuestions = await evaluate(`document.querySelectorAll('dt').length`)
    expect(faq.mainEntity.length === visibleQuestions, `${address}: FAQ data has ${faq.mainEntity.length} questions but the page shows ${visibleQuestions}`)
    expect(await evaluate(`document.querySelectorAll('h1').length === 1`), `${address}: the page must have exactly one h1`)
    const visibleText = await evaluate(`document.body.innerText`)
    const firstAnswer = faq.mainEntity[0].acceptedAnswer.text
    expect(visibleText.includes(firstAnswer.slice(0, 60)), `${address}: the data answers are not the text on the page`)
    questionLists.set(address, faq.mainEntity.map((item) => item.name).join('|'))
  }
  expect(new Set(questionLists.values()).size === questionLists.size, 'two pages share the same questions: each page needs its own')
})

await test('sitemap.xml and robots.txt list the pages', async () => {
  const sitemap = await (await fetch(`${siteOrigin}/sitemap.xml`)).text()
  for (const address of ['/en/changelog', '/ar/changelog', '/json-viewer', '/excel-viewer']) expect(sitemap.includes(`https://openanydoc.com${address}`), `${address} is not in the sitemap`)
  expect(!sitemap.includes('/view-'), 'a /view- address is in the sitemap')
  expect((await (await fetch(`${siteOrigin}/robots.txt`)).text()).includes('Sitemap: https://openanydoc.com/sitemap.xml'), 'robots.txt does not point to the sitemap')
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
