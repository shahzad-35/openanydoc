import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// pdf.js joins a text run's glyphs, then reverses an Arabic run character by character to reading order. A glyph that stands for
// several letters (the ligature لم, mapped to "لم" in visual order) is reversed with the run and comes out backwards ("مل", so
// "المخزون" reads "املخزون"). Its letters are stored reversed first, so the run's reversal puts them back. The worker is bundled by
// Vite (?worker&url in PdfViewer.tsx) so this applies; the build stops if pdf.js changes the line, so an upgrade is checked.
function fixPdfjsArabicLigatures(): Plugin {
  const glyphPushLine = 'textChunk.str.push(glyphUnicode);'
  return {
    name: 'pdfjs-arabic-ligatures',
    transform(code, id) {
      if (!id.endsWith('pdfjs-dist/build/pdf.worker.mjs')) return null
      if (!code.includes(glyphPushLine)) throw new Error('pdfjs-dist/build/pdf.worker.mjs changed: check the Arabic ligature fix in vite.config.ts')
      return code.replace(glyphPushLine, 'textChunk.str.push(glyphUnicode.length > 1 && /[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/.test(glyphUnicode) ? Array.from(glyphUnicode).reverse().join("") : glyphUnicode);')
    },
  }
}

// jSquash's codecs name their default .wasm with new URL('….wasm', import.meta.url). imageTools.worker.ts always hands them a
// compiled module, so that default is never loaded; left in, Vite would inline every codec a second time (or emit it as a file).
function dropJsquashDefaultWasm(): Plugin {
  return {
    name: 'jsquash-default-wasm',
    transform(code, id) {
      if (!id.includes('/node_modules/@jsquash/')) return null
      return code.replace(/new URL\((["'])[\w.-]+\.wasm\1,\s*import\.meta\.url\)/g, 'new URL("about:blank")')
    },
  }
}

// libheif-js (LGPL-3.0) keeps its notice in the shipped chunk: a /*! comment survives minification. Full text: public/licenses/.
function keepLibheifLicenceNotice(): Plugin {
  return {
    name: 'libheif-licence-notice',
    transform(code, id) {
      if (!id.includes('/node_modules/libheif-js/')) return null
      return `/*! libheif-js 1.23.5 (libheif, libde265), unmodified. LGPL-3.0: /licenses/libheif-js.txt */\n${code}`
    },
  }
}

// https://vite.dev/config/
const inlinedWasmFiles = ['sql-wasm-browser.wasm', 'mozjpeg_enc.wasm', 'squoosh_png_bg.wasm', 'pkg/squoosh_oxipng_bg.wasm', 'webp_enc.wasm', 'webp_enc_simd.wasm', 'avif_enc.wasm', 'squoosh_resize_bg.wasm']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The tool pages' sample files (src/samples/) are imported with ?inline, so they arrive as data inside a script: no fetch.
  assetsInclude: ['**/*.xlsx', '**/*.xls', '**/*.docx', '**/*.pptx', '**/*.heic'],
  // SQLite's WebAssembly for the CSV page's query mode (CsvQueryPanel) is inlined as data, like the samples: the site never fetches
  // (Vite has no ?inline for .wasm, so its ?url address is inlined here). Every other asset keeps the default limit.
  // Workers are ES modules (they are started with type: 'module'), so a worker's dynamic import becomes its own chunk: the CSV
  // parse worker fetches the Parquet reader only for a .parquet file.
  // Workers are bundled on their own and use only worker.plugins.
  worker: { format: 'es', plugins: () => [fixPdfjsArabicLigatures(), dropJsquashDefaultWasm(), keepLibheifLicenceNotice()] },
  // The image tools' codecs (jSquash) are inlined the same way and compiled in imageTools.worker.ts.
  build: { assetsInlineLimit: (filePath) => (inlinedWasmFiles.some((name) => filePath.endsWith(name)) ? true : undefined) },
})
