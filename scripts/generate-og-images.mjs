// Draws the share pictures (og:image, 1200 x 630) into public/og/<locale>-<page>.png: the home page and each format page, in
// English and Arabic. Run by hand with `npm run og:images` after a heading in src/seo.ts changes, and commit the PNGs (the
// Cloudflare build has no Chrome). It renders an HTML card in headless Chrome over the DevTools protocol, with the IBM Plex fonts
// from node_modules and the colours of src/index.css. Set CHROME_PATH if Chrome is not in its usual macOS place.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getShareImage, pageSeo, pagesWithShareImage } from '../src/seo.ts'
import { viewers } from '../src/viewers.ts'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputFolder = path.join(projectRoot, 'public/og')
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const scratchFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'og-images-'))
const locales = ['en', 'ar']
const taglines = { en: 'Free · No upload · Runs in your browser', ar: 'مجاني · بدون رفع · يعمل في متصفحك' }

// The light palette: the variables of the first :root block in src/index.css.
const rootBlock = /:root\s*{([^}]*)}/.exec(fs.readFileSync(path.join(projectRoot, 'src/index.css'), 'utf8'))[1]
const palette = Object.fromEntries([...rootBlock.matchAll(/--([\w-]+):\s*(#[0-9a-f]+);/gi)].map((match) => [match[1], match[2]]))
const fontUrl = (relativePath) => pathToFileURL(path.join(projectRoot, 'node_modules/@fontsource', relativePath)).href
const markSvg = fs.readFileSync(path.join(projectRoot, 'public/favicon.svg'), 'utf8')
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function renderCard(locale, address) {
  const viewer = viewers.find((candidate) => candidate.toolPath === address)
  const shownViewers = viewer ? [viewer] : viewers.filter((candidate) => candidate.toolPath)
  const chips = shownViewers
    .flatMap((shown) => shown.extensions.map((extension) => `<span class="chip" style="background:${palette[`type-${shown.id}`]}">${extension}</span>`))
    .join('')
  // A band along the bottom in the format's colour; the home page gets one stripe per live format.
  const band = shownViewers.map((shown) => `<span style="background:${palette[`type-${shown.id}`]}"></span>`).join('')
  const documentLines = shownViewers.length === 1 ? Array(5).fill(palette[`type-${viewer.id}`]) : shownViewers.map((shown) => palette[`type-${shown.id}`])
  return `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<style>
  @font-face { font-family: 'Plex Sans'; font-weight: 500; src: url('${fontUrl('ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2')}'); }
  @font-face { font-family: 'Plex Sans'; font-weight: 700; src: url('${fontUrl('ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2')}'); }
  @font-face { font-family: 'Plex Arabic'; font-weight: 500; src: url('${fontUrl('ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2')}'); }
  @font-face { font-family: 'Plex Arabic'; font-weight: 700; src: url('${fontUrl('ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2')}'); }
  @font-face { font-family: 'Plex Mono'; font-weight: 500; src: url('${fontUrl('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}'); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { position: relative; background: ${palette.paper}; color: ${palette.ink}; font-family: 'Plex Arabic', 'Plex Sans', sans-serif; }
  .content { position: absolute; inset-block: 64px 78px; inset-inline-start: 80px; width: 720px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 18px; font-family: 'Plex Sans'; font-size: 34px; font-weight: 700; }
  .brand svg { width: 60px; height: 60px; }
  h1 { margin-top: auto; font-size: 62px; line-height: 1.12; font-weight: 700; letter-spacing: ${locale === 'ar' ? '0' : '-0.015em'}; text-wrap: balance; }
  .tagline { margin-top: 22px; font-size: 28px; font-weight: 500; color: ${palette['ink-soft']}; }
  .chips { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px; direction: ltr; justify-content: ${locale === 'ar' ? 'flex-end' : 'flex-start'}; }
  .chip { font-family: 'Plex Mono'; font-size: 24px; font-weight: 500; color: ${palette['on-accent']}; padding: 4px 16px; border-radius: 10px; }
  .document { position: absolute; top: 120px; inset-inline-end: 84px; width: 250px; height: 320px; background: ${palette['paper-raised']}; border: 2px solid ${palette.rule}; border-radius: 26px; padding: 92px 38px 0; transform: rotate(${locale === 'ar' ? '-4deg' : '4deg'}); box-shadow: 0 30px 60px -30px rgb(15 26 51 / 0.35); }
  .document span { display: block; height: 18px; border-radius: 9px; margin-bottom: 22px; }
  .document span:nth-child(even) { width: 72%; }
  .band { position: absolute; inset-inline: 0; bottom: 0; height: 16px; display: flex; }
  .band span { flex: 1; }
</style>
</head>
<body>
  <div class="document">${documentLines.map((color) => `<span style="background:${color}"></span>`).join('')}</div>
  <div class="content">
    <div class="brand">${markSvg}<span>OpenAnyDoc</span></div>
    <h1>${escapeHtml(pageSeo[locale][address].heading)}</h1>
    <p class="tagline">${taglines[locale]}</p>
    <div class="chips">${chips}</div>
  </div>
  <div class="band">${band}</div>
</body>
</html>`
}

// ---------------------------------------------------------------- Chrome over the DevTools protocol

const chromePort = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(
  chromePath,
  ['--headless=new', `--remote-debugging-port=${chromePort}`, `--user-data-dir=${path.join(scratchFolder, 'profile')}`, '--allow-file-access-from-files', '--hide-scrollbars', '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
)
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

try {
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
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data)
    if (data.id && pendingReplies.has(data.id)) {
      pendingReplies.get(data.id)(data)
      pendingReplies.delete(data.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextMessageId
      pendingReplies.set(id, (reply) => (reply.error ? reject(new Error(`${method}: ${JSON.stringify(reply.error)}`)) : resolve(reply.result)))
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false })
  fs.mkdirSync(outputFolder, { recursive: true })
  for (const locale of locales) {
    for (const address of pagesWithShareImage) {
      const cardFile = path.join(scratchFolder, `${locale}-${address.slice(1) || 'home'}.html`)
      fs.writeFileSync(cardFile, renderCard(locale, address))
      await send('Page.navigate', { url: pathToFileURL(cardFile).href })
      await sleep(300)
      const result = await send('Runtime.evaluate', { expression: `document.fonts.ready.then(() => [...document.fonts].filter((font) => font.status === 'loaded').length)`, awaitPromise: true, returnByValue: true })
      if (result.result.value < 3) throw new Error(`${cardFile}: the fonts did not load`)
      const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } })
      const outputFile = path.join(projectRoot, 'public', getShareImage(locale, address).path)
      fs.writeFileSync(outputFile, Buffer.from(data, 'base64'))
      console.log(`${path.relative(projectRoot, outputFile)}  ${Math.round(fs.statSync(outputFile).size / 1024)} KB`)
    }
  }
  socket.close()
} finally {
  chrome.kill()
  fs.rmSync(scratchFolder, { recursive: true, force: true })
}
