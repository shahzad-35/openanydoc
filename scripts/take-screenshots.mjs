// Draws the pictures the format pages show (public/screenshots/<locale>-<viewer>.webp, 1200 x 750): each viewer with a small synthetic
// file, in English and Arabic, light theme. Run after `npm run build` (it serves dist/) with Chrome and cwebp installed
// (`brew install webp`); commit the files (Cloudflare has no Chrome). Set CHROME_PATH if Chrome is not in its usual macOS place.

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const distFolder = path.join(projectRoot, 'dist')
const outputFolder = path.join(projectRoot, 'public/screenshots')
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const scratchFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshots-'))
const WIDTH = 1200
const HEIGHT = 750

// ---------------------------------------------------------------- synthetic files, one per viewer and language

const sampleFiles = {
  en: {
    csv: ['orders.csv', 'order_id,customer,city,amount,status\n1001,Northwind Ltd,Riyadh,1250.00,paid\n1002,Acme Trading,Jeddah,310.50,pending\n1003,Globex,Dammam,980.00,paid\n1004,Initech,Riyadh,45.90,refunded\n1005,Umbrella Co,Mecca,2210.00,paid\n'],
    json: ['products.json', JSON.stringify({ store: 'Northwind', updated: '2026-10-22', products: [{ id: 1, name: 'Notebook', price: 12.5, tags: ['paper', 'office'], inStock: true }, { id: 2, name: 'Pen set', price: 7.25, tags: ['office'], inStock: false }, { id: 3, name: 'Desk lamp', price: 39.9, tags: ['light'], inStock: true }] }, null, 2)],
    text: ['notes.txt', 'Release notes\n\n- Opened the quarterly export without Excel.\n- Fixed the Arabic encoding in the customer list.\n- Shared the filtered rows with the finance team.\n\nNext: compare the two exports and keep the diff.\n'],
    excel: ['budget.xlsx', [['Item', 'Qty', 'Unit price', 'Total'], ['Desks', 4, 320, { t: 'n', f: 'B2*C2', v: 1280 }], ['Chairs', 8, 95, { t: 'n', f: 'B3*C3', v: 760 }], ['Monitors', 6, 210, { t: 'n', f: 'B4*C4', v: 1260 }], ['Total', '', '', { t: 'n', f: 'SUM(D2:D4)', v: 3300 }]]],
  },
  ar: {
    csv: ['الطلبات.csv', 'رقم الطلب,العميل,المدينة,المبلغ,الحالة\n1001,شركة الشمال,الرياض,1250.00,مدفوع\n1002,أكمي للتجارة,جدة,310.50,قيد الانتظار\n1003,جلوبكس,الدمام,980.00,مدفوع\n1004,إنيتك,الرياض,45.90,مسترد\n1005,شركة المظلة,مكة,2210.00,مدفوع\n'],
    json: ['المنتجات.json', JSON.stringify({ store: 'الشمال', updated: '2026-10-22', products: [{ id: 1, name: 'دفتر', price: 12.5, tags: ['ورق', 'مكتب'], inStock: true }, { id: 2, name: 'طقم أقلام', price: 7.25, tags: ['مكتب'], inStock: false }, { id: 3, name: 'مصباح مكتب', price: 39.9, tags: ['إضاءة'], inStock: true }] }, null, 2)],
    text: ['ملاحظات.txt', 'ملاحظات الإصدار\n\n- فتحنا التصدير الربعي بدون Excel.\n- أصلحنا ترميز العربية في قائمة العملاء.\n- شاركنا الصفوف المصفّاة مع فريق المالية.\n\nالتالي: مقارنة التصديرين والاحتفاظ بالفرق.\n'],
    excel: ['الميزانية.xlsx', [['البند', 'الكمية', 'سعر الوحدة', 'الإجمالي'], ['مكاتب', 4, 320, { t: 'n', f: 'B2*C2', v: 1280 }], ['كراسي', 8, 95, { t: 'n', f: 'B3*C3', v: 760 }], ['شاشات', 6, 210, { t: 'n', f: 'B4*C4', v: 1260 }], ['الإجمالي', '', '', { t: 'n', f: 'SUM(D2:D4)', v: 3300 }]]],
  },
}
const pagePath = { csv: '/csv-viewer', json: '/json-viewer', text: '/txt-viewer', excel: '/excel-viewer' }
const readySelector = { csv: '#data-table [id^="cell-"]', json: '#tree-view .row', text: '#text-editor', excel: '#data-table [id^="cell-"]' }

function writeSampleFile(locale, viewerId) {
  const [name, content] = sampleFiles[locale][viewerId]
  fs.mkdirSync(path.join(scratchFolder, locale), { recursive: true })
  const filePath = path.join(scratchFolder, locale, name)
  if (viewerId === 'excel') {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(content), locale === 'ar' ? 'الميزانية' : 'Budget')
    fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
  } else {
    fs.writeFileSync(filePath, '﻿' + content)
  }
  return filePath
}

// ---------------------------------------------------------------- static server and Chrome over the DevTools protocol

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent((request.url ?? '/').split('?')[0])
  const candidate = path.join(distFolder, pathname)
  const filePath = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : fs.existsSync(path.join(candidate, 'index.html')) ? path.join(candidate, 'index.html') : path.join(distFolder, '404.html')
  response.writeHead(200, { 'content-type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(response)
})
await new Promise((resolve) => server.listen(0, resolve))
const origin = `http://localhost:${server.address().port}`

const chromePort = 9500 + Math.floor(Math.random() * 300)
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${chromePort}`, `--user-data-dir=${path.join(scratchFolder, 'profile')}`, `--window-size=${WIDTH},${HEIGHT}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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
socket.onmessage = (event) => {
  const data = JSON.parse(event.data)
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
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
async function waitFor(expression, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${description}`)
}
await send('Page.enable')
await send('Runtime.enable')
await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

fs.mkdirSync(outputFolder, { recursive: true })
for (const locale of ['en', 'ar']) {
  for (const viewerId of Object.keys(pagePath)) {
    await send('Page.navigate', { url: `${origin}/${locale}${pagePath[viewerId]}` })
    await waitFor(`document.readyState === 'complete' && document.querySelector('#file-input')`, `${locale}${pagePath[viewerId]} to load`)
    await sleep(300)
    const { root } = await send('DOM.getDocument')
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
    await send('DOM.setFileInputFiles', { nodeId, files: [writeSampleFile(locale, viewerId)] })
    await waitFor(`document.querySelector('${readySelector[viewerId]}')`, `the ${viewerId} file to show`)
    await sleep(900)
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    const pngFile = path.join(scratchFolder, `${locale}-${viewerId}.png`)
    fs.writeFileSync(pngFile, Buffer.from(data, 'base64'))
    const webpFile = path.join(outputFolder, `${locale}-${viewerId}.webp`)
    execFileSync('cwebp', ['-quiet', '-q', '82', pngFile, '-o', webpFile])
    console.log(`${path.relative(projectRoot, webpFile)}: ${Math.round(fs.statSync(webpFile).size / 1024)} KB`)
  }
}
chrome.kill()
server.close()
process.exit(0)
