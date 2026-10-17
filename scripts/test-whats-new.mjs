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
import * as XLSX from 'xlsx'

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

const sampleJson = path.join(scratchFolder, 'sample.json')
fs.writeFileSync(sampleJson, '{"a":1,"b":[1,2,3]}')
const comingSoonFile = path.join(scratchFolder, 'letter.docx')
fs.writeFileSync(comingSoonFile, 'not a real document')
const unknownFile = path.join(scratchFolder, 'notes.doc')
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
  expect(text?.includes('New') && text.includes('You can now open and edit CSV, TXT, JSON, and Excel files'), `banner text was: ${text}`)
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

await test('saving a file shows one dismissible tip', async () => {
  // Excel is the format still drawn in the shared page, which has the tip (CSV, JSON and TXT draw their own pages).
  const tipWorkbook = path.join(scratchFolder, 'tip.xlsx')
  const tipBook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(tipBook, XLSX.utils.aoa_to_sheet([['one'], ['two']]), 'Data')
  fs.writeFileSync(tipWorkbook, XLSX.write(tipBook, { type: 'buffer', bookType: 'xlsx' }))
  await openPage('/en/excel-viewer')
  await chooseFile(tipWorkbook)
  await waitFor(`document.querySelector('h1')?.innerText === 'tip.xlsx'`, 'the file to open')
  await evaluate(`document.querySelector('#mode-edit-button').click()`)
  const downloadButton = `document.querySelector('#download-button')`
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
  for (const address of ['en', 'ar'].flatMap((locale) => ['', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer'].map((page) => `/${locale}${page}`))) {
    const html = await (await fetch(`${siteOrigin}${address}`)).text()
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1].replace(/&amp;/g, '&') ?? ''
    const description = /name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(title.length > 0 && title.length <= 60, `${address}: title is ${title.length} characters: ${title}`)
    expect(description.length >= 120 && description.length <= 160, `${address}: description is ${description.length} characters`)
    expect(html.includes(`<link rel="canonical" href="https://openanydoc.com${address}"`), `${address}: canonical is missing`)
    expect(html.includes('property="og:title"') && html.includes('property="og:description"'), `${address}: Open Graph tags are missing`)
    const structuredData = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((match) => JSON.parse(match[1]))
    const serverText = prerenderedText(html)
    const heading = /<h1 id="page-heading"[^>]*>([^<]+)<\/h1>/.exec(html)?.[1] ?? ''
    expect(heading.length > 0 && /<p id="page-intro"[^>]*>[^<]+<\/p>/.test(html), `${address}: the h1 or the intro is not in the server's HTML`)
    const breadcrumb = structuredData.find((item) => item['@type'] === 'BreadcrumbList')
    if (breadcrumb) expect(serverText.includes(breadcrumb.itemListElement[1].name), `${address}: the server's h1 is not the page heading`)
    if (address.length > 3) expect(html.includes('id="how-to-section"') && html.includes('id="handles-section"'), `${address}: "How it works" or "What it handles" is not in the server's HTML`)
    expect(structuredData.some((item) => item['@type'] === 'WebApplication'), `${address}: WebApplication data is missing`)
    expect(!titles.has(title), `${address}: the title is used on another page`)
    expect(html.includes(`<html lang="${address.slice(1, 3)}" dir="${address.startsWith('/ar') ? 'rtl' : 'ltr'}">`), `${address}: lang and dir are missing from the static HTML`)
    expect(html.includes('hreflang="ar"') && html.includes('hreflang="en"') && html.includes('hreflang="x-default"'), `${address}: hreflang alternates are missing`)
    titles.add(title)
    const faq = structuredData.find((item) => item['@type'] === 'FAQPage')
    expect(faq, `${address}: there is no FAQPage data`)
    const missingQuestion = faq.mainEntity.find((item) => !serverText.includes(item.name))
    expect(!missingQuestion, `${address}: the server's HTML lacks the question "${missingQuestion?.name}"`)
    const shareImage = /property="og:image" content="https:\/\/openanydoc\.com(\/og\/[\w-]+\.png)"/.exec(html)?.[1]
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
    if (address.length > 3) {
      const isArabic = address.startsWith('/ar')
      expect((await evaluate(`document.querySelector('#how-to-section h2')?.textContent ?? ''`)).startsWith(isArabic ? 'كيف يعمل' : 'How it works'), `${address}: the steps are not titled "How it works"`)
      expect(await evaluate(`document.querySelectorAll('section#handles-section #handles-list li[id^="handles-item-"]').length >= 4`), `${address}: the "What it handles" list is missing`)
      const sharedQuestions = isArabic
        ? ['هل يُرفع ملفي؟', 'هل يمكنني تعديله وحفظه؟', 'هل يتغير الملف الأصلي؟', 'هل هناك حد لحجم الملف؟', 'هل يعمل على الجوال؟', 'هل يعمل بدون إنترنت؟', 'هل يمكن لشركتي استضافة نسخة خاصة بها؟']
        : ['Is my file uploaded?', 'Can I edit and save it?', 'Is the original changed?', 'Is there a file size limit?', 'Does it work on mobile?', 'Does it work offline?', 'Can my company host its own copy?']
      expect(faq.mainEntity.slice(0, 7).map((item) => item.name).join('|') === sharedQuestions.join('|'), `${address}: the seven shared questions are not first`)
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

for (const [name, address, file, readyElement] of [
  ['CSV', '/en/csv-viewer', sampleCsv, '#data-table'],
  ['TXT', '/en/txt-viewer', sampleText, '#text-editor'],
  ['JSON', '/en/json-viewer', sampleJson, '#tree-view .row'],
  ['Excel', '/en/excel-viewer', sampleWorkbook, '#data-table'],
]) {
  for (const locale of ['en', 'ar']) await test(`${name} (${locale}): every field has an id and no id repeats (page, view mode, edit mode, an open menu)`, async () => {
    await openPage(address.replace('/en/', `/${locale}/`))
    await expectCleanIds(`${name} drop page`)
    await chooseFile(file)
    await waitFor(`document.querySelector('${readyElement}')`, `the ${name} file to show`)
    await expectCleanIds(`${name} view mode`)
    // JSON, CSV and TXT draw their own page, always editable, with their own menus; the other formats switch to Edit.
    const menuButton = name === 'JSON' ? '#indent-button:not(:disabled)' : name === 'CSV' ? '#more-menu-button:not(:disabled)' : name === 'TXT' ? '#ribbon-sort-menu-button' : '#edit-toolbar [aria-haspopup=menu]:not(:disabled)'
    await evaluate(`document.querySelector('#mode-edit-button')?.click()`)
    if (name === 'TXT') await evaluate(`document.querySelector('#ribbon-tab-lines').click()`)
    await waitFor(`document.querySelector('${menuButton}')`, 'the editing tools')
    await expectCleanIds(`${name} edit mode`)
    await evaluate(`document.querySelector('${menuButton}').click()`)
    await waitFor(`document.querySelector('[role=menu]')`, 'a menu to open')
    await expectCleanIds(`${name} with a menu open`)
  })
}

for (const address of ['/en', '/ar', '/en/changelog', '/ar/changelog', '/en/about', '/ar/about', '/en/privacy', '/ar/privacy', '/en/terms', '/ar/terms']) {
  await test(`${address}: every field has an id and no id repeats`, async () => {
    await openPage(address)
    await expectCleanIds(address)
  })
}

await test('sitemap.xml and robots.txt list the pages', async () => {
  const sitemap = await (await fetch(`${siteOrigin}/sitemap.xml`)).text()
  for (const address of ['/en', '/ar', '/en/changelog', '/ar/changelog', '/en/json-viewer', '/ar/json-viewer', '/en/excel-viewer', '/ar/excel-viewer', '/en/about', '/ar/about', '/en/privacy', '/ar/privacy', '/en/terms', '/ar/terms']) expect(sitemap.includes(`https://openanydoc.com${address}`), `${address} is not in the sitemap`)
  expect(!sitemap.includes('/view-'), 'a /view- address is in the sitemap')
  expect((await (await fetch(`${siteOrigin}/robots.txt`)).text()).includes('Sitemap: https://openanydoc.com/sitemap.xml'), 'robots.txt does not point to the sitemap')
})

const contentPages = ['', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/about', '/privacy', '/terms', '/changelog']

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
      const expected = { en: `https://openanydoc.com/en${page}`, ar: `https://openanydoc.com/ar${page}`, 'x-default': `https://openanydoc.com/en${page}` }
      expect(JSON.stringify(alternates) === JSON.stringify(expected), `${address}: hreflang is ${JSON.stringify(alternates)}`)
      // Reciprocal: the page in the other language lists the very same set.
      expect(JSON.stringify(alternatesOf(pages[locale === 'en' ? 'ar' : 'en'])) === JSON.stringify(alternates), `${address}: the other language lists different alternates`)
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]
      expect(canonical === alternates[locale], `${address}: canonical ${canonical} is not its hreflang address`)
      expect(html.includes(`<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`), `${address}: lang or dir is wrong`)
      const slashLinks = [...html.matchAll(/href="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((href) => (href.startsWith('/') || href.startsWith('https://openanydoc.com')) && href.endsWith('/') && href !== 'https://openanydoc.com/')
      expect(slashLinks.length === 0, `${address}: links end with a slash: ${slashLinks.join(', ')}`)
    }
  }
})

await test('every sitemap address has a lastmod date and is a built page without a trailing slash', async () => {
  const sitemap = await (await fetch(`${siteOrigin}/sitemap.xml`)).text()
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1])
  expect(entries.length === contentPages.length * 2, `the sitemap has ${entries.length} addresses, expected ${contentPages.length * 2}`)
  for (const entry of entries) {
    const address = /<loc>https:\/\/openanydoc\.com([^<]*)<\/loc>/.exec(entry)?.[1] ?? ''
    expect(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(entry), `${address}: no lastmod`)
    expect(!address.endsWith('/') && fs.existsSync(path.join(distFolder, address, 'index.html')), `${address}: not a built page, or it ends with a slash`)
  }
})

// ---------------------------------------------------------------- About, Privacy and Terms; footer and workbench links

await test('About, Privacy and Terms pages: one h1, their own title and description, hreflang, real text', async () => {
  const titles = new Set()
  for (const address of ['en', 'ar'].flatMap((locale) => ['/about', '/privacy', '/terms'].map((page) => `/${locale}${page}`))) {
    const html = await (await fetch(`${siteOrigin}${address}`)).text()
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1].replace(/&amp;/g, '&') ?? ''
    const description = /name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(title.length > 0 && title.length <= 60, `${address}: title is ${title.length} characters: ${title}`)
    expect(description.length >= 120 && description.length <= 160, `${address}: description is ${description.length} characters`)
    expect(!titles.has(title), `${address}: the title is used on another page`)
    titles.add(title)
    expect(html.includes(`<link rel="canonical" href="https://openanydoc.com${address}"`), `${address}: canonical is missing`)
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
  await openPage('/en/csv-viewer')
  await evaluate(`document.querySelector('#footer-link-privacy').click()`)
  await waitFor(`location.pathname === '/en/privacy' && document.querySelector('h1')?.innerText === 'Privacy Policy'`, 'the footer link to open the privacy policy in the page')
})

for (const [name, address, file, readyElement, menuButton] of [
  ['CSV', '/en/csv-viewer', sampleCsv, '#data-table', '#more-menu-button:not(:disabled)'],
  ['JSON', '/en/json-viewer', sampleJson, '#tree-view .row', '#more-button'],
  ['TXT', '/en/txt-viewer', sampleText, '#text-editor', '#ribbon-tab-file'],
  ['Excel', '/en/excel-viewer', sampleWorkbook, '#data-table', '#legal-menu-button'],
]) {
  for (const locale of ['en', 'ar']) await test(`${name} (${locale}): Privacy, Terms and the disclaimer in the menu, and the status bar links, open in a new tab`, async () => {
    await openPage(address.replace('/en/', `/${locale}/`))
    await chooseFile(file)
    await waitFor(`document.querySelector('${readyElement}') && document.querySelector('${menuButton}')`, `the ${name} file to show`)
    await evaluate(`document.querySelector('${menuButton}').click()`)
    await waitFor(`document.querySelector('#menu-link-privacy')?.checkVisibility()`, 'the menu with the legal links')
    const links = name === 'Excel' ? ['menu-link-privacy', 'menu-link-terms'] : ['menu-link-privacy', 'menu-link-terms', 'status-link-privacy', 'status-link-terms']
    for (const id of links) {
      const link = await evaluate(`(() => { const link = document.querySelector('#${id}'); return link && { href: link.getAttribute('href'), target: link.target, rel: link.rel } })()`)
      expect(link?.href === `/${locale}/${id.endsWith('privacy') ? 'privacy' : 'terms'}` && link.target === '_blank' && link.rel.includes('noopener'), `#${id} is ${JSON.stringify(link)}`)
    }
    expect((await evaluate(`document.querySelector('#menu-disclaimer')?.textContent ?? ''`)).includes('Microsoft Corporation'), 'the disclaimer is missing from the menu')
    await expectCleanIds(`${name} with the legal links showing`)
  })
}



// ---------------------------------------------------------------- one drop zone for every format

await test('the format list is read from the registry: View and edit, or Coming soon', async () => {
  for (const [locale, words] of [['en', { edit: 'View and edit', soon: 'Coming soon' }], ['ar', { edit: 'عرض وتحرير', soon: 'قريبًا' }]]) {
    await openPage(`/${locale}`)
    for (const id of ['csv', 'text', 'json', 'excel']) {
      expect((await evaluate(`document.querySelector('#extension-row-${id} #extension-capabilities-${id}')?.innerText`)) === words.edit, `${locale}: ${id} does not say "${words.edit}"`)
    }
    for (const id of ['word', 'pdf', 'powerpoint']) {
      expect((await evaluate(`document.querySelector('#extension-row-${id} #extension-capabilities-${id}')?.innerText`)) === words.soon, `${locale}: ${id} does not say "${words.soon}"`)
    }
  }
})

await test('one drop zone opens every live format with its View / Edit toggle and tools; Coming soon stays on the page', async () => {
  const sampleFiles = [['CSV', sampleCsv], ['TXT', sampleText], ['JSON', sampleJson], ['Excel', sampleWorkbook]]
  for (const [name, file] of sampleFiles) {
    await openPage('/en')
    await chooseFile(file)
    await waitFor(`document.querySelector('#mode-toggle') || (${name === 'JSON'} && document.querySelector('#json-workbench')) || (${name === 'CSV'} && document.querySelector('#csv-workbench')) || (${name === 'TXT'} && document.querySelector('#txt-workbench'))`, `the ${name} file page with its toggle`)
    expect(!(await evaluate('location.href')).includes('sample'), `${name}: the file name reached the URL`)
    await evaluate(`document.querySelector('#mode-edit-button')?.click()`)
    await waitFor(`document.querySelector('#edit-toolbar [aria-haspopup=menu]:not(:disabled), #edit-toolbar #toolbar-find-and-replace, #command-toolbar #validate-button, #command-bar #filter-button:not(:disabled), #ribbon-panel #ribbon-find-replace-button')`, `the ${name} tools`)
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
  for (const page of ['csv-viewer', 'excel-viewer', 'json-viewer', 'txt-viewer']) {
    await openPage(`/${page}`)
    expect((await evaluate('location.pathname')) === `/en/${page}`, `/${page} landed on ${await evaluate('location.pathname')}`)
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
  await evaluate(`document.querySelector('#open-sample-json-button').click()`)
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
  await evaluate(`document.querySelector('#open-sample-json-button').click()`)
  await waitFor(`document.querySelector('#tree-view .row')`, 'the tree')
  const layout = await evaluate(`({ home: document.querySelector('#home-button').getBoundingClientRect().right, download: document.querySelector('#download-button').getBoundingClientRect().left, width: innerWidth, tree: getComputedStyle(document.querySelector('#tree-view')).direction, code: getComputedStyle(document.querySelector('#json-text-input')).direction })`)
  expect(layout.home > layout.width - 60 && layout.download < 60, 'the command bar is not mirrored')
  expect(layout.tree === 'ltr' && layout.code === 'ltr', 'the tree or the code is right to left')
  await expectCleanIds('JSON (ar) workbench')
})

await test('JSON on a phone: Text, Tree and Inspector tabs instead of side by side', async () => {
  await onPhone(async () => {
    await openPage('/en/json-viewer')
    await evaluate(`document.querySelector('#open-sample-json-button').click()`)
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
    .flatMap((locale) => ['', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/about', '/privacy', '/terms', '/changelog'].map((page) => `/${locale}${page}`))
    .filter((address) => /<[^>]+\sstyle=/.test(fs.readFileSync(path.join(distFolder, address, 'index.html'), 'utf8')))
  expect(pagesWithStyle.length === 0, `style attributes in ${pagesWithStyle.join(', ')}`)
})

await test('prerendered pages hydrate with no console error, in both languages, light and dark', async () => {
  const addresses = ['en', 'ar'].flatMap((locale) => ['', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/about', '/privacy', '/terms', '/changelog'].map((page) => `/${locale}${page}`))
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
