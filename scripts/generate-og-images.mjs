// Draws the share pictures (og:image, 1200 x 630) into public/og/<locale>-<page>.png: the home page and each format page, in
// English and Arabic, and each landing page. Also draws public/logo.png (512 x 512), the logo in the home page's structured data. Run by hand with `npm run og:images` after a heading in src/seo.ts changes, and commit the PNGs (the
// Cloudflare build has no Chrome). Also draws the LinkedIn logo and cover into .claude/launch-kit/brand/. It renders an HTML card in
// headless Chrome over the DevTools protocol, with the Toy Blocks fonts from node_modules and the colours of src/index.css. Set CHROME_PATH if Chrome is not in its usual macOS place.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getShareImage, pageSeo, pagesWithShareImage } from '../src/seo.ts'
import { findViewerByToolPath, viewers } from '../src/viewers.ts'

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

// The Toy Blocks type and the brand row (mark and wordmark), shared by the share pictures and the LinkedIn images.
const brandFontFaces = `
  @font-face { font-family: 'Fredoka'; font-weight: 500; src: url('${fontUrl('fredoka/files/fredoka-latin-500-normal.woff2')}'); }
  @font-face { font-family: 'Fredoka'; font-weight: 600; src: url('${fontUrl('fredoka/files/fredoka-latin-600-normal.woff2')}'); }
  @font-face { font-family: 'Baloo Bhaijaan 2'; font-weight: 500; src: url('${fontUrl('baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-500-normal.woff2')}'); }
  @font-face { font-family: 'Nunito Sans'; font-weight: 400; src: url('${fontUrl('nunito-sans/files/nunito-sans-latin-400-normal.woff2')}'); }
  @font-face { font-family: 'Plex Arabic'; font-weight: 400; src: url('${fontUrl('ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2')}'); }
  @font-face { font-family: 'Plex Mono'; font-weight: 500; src: url('${fontUrl('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}'); }`
const brandStyles = `
  .brand { display: flex; align-items: center; gap: 16px; direction: ltr; align-self: flex-start; font-family: 'Fredoka'; font-size: 40px; font-weight: 600; letter-spacing: -0.01em; color: ${palette.ink}; }
  .brand svg { width: 64px; height: 64px; }
  .brand b { font-weight: 600; color: ${palette.accent}; }`
const brandRow = `<div class="brand">${markSvg}<span>open<b>any</b>doc</span></div>`

function renderCard(locale, address) {
  const viewer = findViewerByToolPath(address)
  const shownViewers = viewer ? [viewer] : viewers.filter((candidate) => candidate.toolPath)
  const chips = shownViewers
    .flatMap((shown) => shown.extensions.map((extension) => `<span class="chip" style="background:${palette[`type-${shown.id}`]}">${extension}</span>`))
    .join('')
  // A band along the bottom in the format's colour; the home page gets one stripe per live format.
  const band = shownViewers.map((shown) => `<span style="background:${palette[`type-${shown.id}`]}"></span>`).join('')
  return `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<style>
  ${brandFontFaces}
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { position: relative; background: #ffffff; color: ${palette.ink}; font-family: 'Nunito Sans', 'Plex Arabic', sans-serif; }
  .content { position: absolute; inset-block: 64px 78px; inset-inline-start: 80px; width: 720px; display: flex; flex-direction: column; }
  ${brandStyles}
  h1 { margin-top: auto; font-family: 'Fredoka', 'Baloo Bhaijaan 2', sans-serif; font-size: 64px; line-height: 1.1; font-weight: 500; letter-spacing: ${locale === 'ar' ? '0' : '-0.015em'}; text-wrap: balance; }
  .tagline { margin-top: 22px; font-size: 28px; font-weight: 400; color: ${palette['ink-soft']}; }
  .chips { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px; direction: ltr; justify-content: ${locale === 'ar' ? 'flex-end' : 'flex-start'}; }
  .chip { font-family: 'Plex Mono'; font-size: 24px; font-weight: 500; color: ${palette['on-accent']}; padding: 4px 16px; border-radius: 10px; }
  .big-mark { position: absolute; top: 150px; inset-inline-end: 96px; width: 260px; height: 260px; transform: rotate(${locale === 'ar' ? '6deg' : '-6deg'}); filter: drop-shadow(0 34px 30px rgba(217, 169, 0, 0.35)); }
  .band { position: absolute; inset-inline: 0; bottom: 0; height: 16px; display: flex; }
  .band span { flex: 1; }
</style>
</head>
<body>
  <div class="big-mark">${markSvg}</div>
  <div class="content">
    ${brandRow}
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
  // The logo of the Organization in the home page's structured data: the brand mark at 512 x 512 on a transparent background, as a
  // PNG because Google does not take an SVG logo.
  await send('Emulation.setDeviceMetricsOverride', { width: 512, height: 512, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  const logoCardFile = path.join(scratchFolder, 'logo.html')
  fs.writeFileSync(logoCardFile, `<!doctype html><style>* { margin: 0; } svg { display: block; width: 512px; height: 512px; }</style>${markSvg}`)
  await send('Page.navigate', { url: pathToFileURL(logoCardFile).href })
  await sleep(300)
  const { data: logoData } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 512, height: 512, scale: 1 } })
  fs.writeFileSync(path.join(projectRoot, 'public/logo.png'), Buffer.from(logoData, 'base64'))
  console.log('public/logo.png')

  // LinkedIn: the profile logo (400 x 400, the mark on white) and the company page cover (1128 x 191). Written into the launch kit,
  // which is not committed. LinkedIn lays the logo over the cover's bottom left, so the cover keeps its content to the right.
  const linkedinFolder = path.join(projectRoot, '.claude/launch-kit/brand')
  fs.mkdirSync(linkedinFolder, { recursive: true })
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 255, g: 255, b: 255, a: 1 } })
  const linkedinImages = [
    { name: 'linkedin-logo.png', width: 400, height: 400, html: `<style>* { margin: 0; } body { width: 400px; height: 400px; display: grid; place-items: center; background: #fff; } svg { width: 288px; height: 288px; }</style>${markSvg}` },
    {
      name: 'linkedin-banner.png',
      width: 1128,
      height: 191,
      html: `<style>${brandFontFaces} ${brandStyles} * { margin: 0; box-sizing: border-box; } body { position: relative; width: 1128px; height: 191px; overflow: hidden; background: #fff; font-family: 'Nunito Sans'; }
        .text { position: absolute; inset-block: 0 10px; inset-inline-start: 300px; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
        .tagline { font-size: 22px; color: ${palette['ink-soft']}; }
        .band { position: absolute; inset-inline: 0; bottom: 0; height: 10px; display: flex; } .band span { flex: 1; }
        .chips { position: absolute; inset-inline-end: 56px; top: 50%; translate: 0 -60%; width: 330px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
        .chip { font-family: 'Plex Mono'; font-size: 19px; font-weight: 500; color: #fff; padding: 3px 12px; border-radius: 9px; }</style>
        <div class="text">${brandRow}<p class="tagline">${taglines.en}</p></div>
        <div class="chips">${viewers.filter((shown) => shown.toolPath).flatMap((shown) => shown.extensions.map((extension) => `<span class="chip" style="background:${palette[`type-${shown.id}`]}">${extension}</span>`)).join('')}</div>
        <div class="band">${viewers.filter((shown) => shown.toolPath).map((shown) => `<span style="background:${palette[`type-${shown.id}`]}"></span>`).join('')}</div>`,
    },
  ]
  for (const image of linkedinImages) {
    const imageFile = path.join(scratchFolder, image.name.replace('.png', '.html'))
    fs.writeFileSync(imageFile, `<!doctype html><meta charset="utf-8" />${image.html}`)
    await send('Emulation.setDeviceMetricsOverride', { width: image.width, height: image.height, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: pathToFileURL(imageFile).href })
    await sleep(300)
    await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: image.width, height: image.height, scale: 1 } })
    fs.writeFileSync(path.join(linkedinFolder, image.name), Buffer.from(data, 'base64'))
    console.log(path.relative(projectRoot, path.join(linkedinFolder, image.name)))
  }
  socket.close()
} finally {
  // Chrome holds files in the scratch folder until it has exited.
  const chromeHasExited = new Promise((resolve) => chrome.once('exit', resolve))
  chrome.kill()
  await chromeHasExited
  fs.rmSync(scratchFolder, { recursive: true, force: true })
}
