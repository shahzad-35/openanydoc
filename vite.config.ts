import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// pdf.js joins a text run's glyphs, then reverses an Arabic run character by character to reading order. A glyph that stands for
// several letters (the ligature لم, mapped to "لم" in visual order) is reversed with the run and comes out backwards ("مل", so
// "المخزون" reads "املخزون"). Its letters are stored reversed first, so the run's reversal puts them back. A glyph mapped to one
// ligature code point (U+FC32 "في", U+FEF9 "لإ", as Chrome's PDFs do) is only split into letters by pdf.js's normalisation, just
// before the reversal, so it is split here (NFKC, as pdf.js does) and stored reversed the same way. The worker is bundled by Vite
// (?worker&url in pdfLibrary.ts) so this applies; the build stops if pdf.js changes the line, so an upgrade is checked.
function fixPdfjsArabicLigatures(): Plugin {
  const glyphPushLine = 'textChunk.str.push(glyphUnicode);'
  return {
    name: 'pdfjs-arabic-ligatures',
    transform(code, id) {
      if (!id.endsWith('pdfjs-dist/build/pdf.worker.mjs')) return null
      if (!code.includes(glyphPushLine)) throw new Error('pdfjs-dist/build/pdf.worker.mjs changed: check the Arabic ligature fix in vite.config.ts')
      const glyphLetters = '(/^[\\uFB50-\\uFDFF\\uFE70-\\uFEFF]$/.test(glyphUnicode) ? glyphUnicode.normalize("NFKC") : glyphUnicode)'
      return code.replace(glyphPushLine, `textChunk.str.push(${glyphLetters}.length > 1 && /[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/.test(glyphUnicode) ? Array.from(${glyphLetters}).reverse().join("") : glyphUnicode);`)
    },
  }
}

// qpdf-wasm (ISC; qpdf is Apache-2.0) only fetches its .wasm by address, and the CSP refuses a data: address, so its instantiation
// is given the bytes pdfTools.worker.ts decodes from the inlined file (`wasmBinary`). The build stops if the line changes on an upgrade.
function feedQpdfWasmBytes(): Plugin {
  const instantiateStart = 'async function Fa(a){var b=Ca;'
  return {
    name: 'qpdf-wasm-bytes',
    transform(code, id) {
      if (!id.includes('@neslinesli93/qpdf-wasm/dist/qpdf.js')) return null
      if (!code.includes(instantiateStart)) throw new Error('@neslinesli93/qpdf-wasm changed: check feedQpdfWasmBytes in vite.config.ts')
      return code.replace(instantiateStart, 'async function Fa(a){if(f.wasmBinary)return WebAssembly.instantiate(f.wasmBinary,a);var b=Ca;')
    },
  }
}

// bergamot-translator (MPL-2.0; Translate PDF) starts its classic worker from a file next to its own module, which importScripts()
// its runtime and fetches its .wasm from the same folder. Those three files are kept as they are in public/models/translate/runtime/,
// so the worker is started from there instead of being bundled. The build stops if the line changes on an upgrade.
function startBergamotWorkerFromModels(): Plugin {
  const workerStart = "new Worker(new URL('./worker/translator-worker.js', import.meta.url))"
  return {
    name: 'bergamot-worker-address',
    transform(code, id) {
      if (!id.includes('@browsermt/bergamot-translator/translator.js')) return null
      if (!code.includes(workerStart)) throw new Error('@browsermt/bergamot-translator changed: check startBergamotWorkerFromModels in vite.config.ts')
      return code.replace(workerStart, "new Worker('/models/translate/runtime/translator-worker.js')")
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
const inlinedWasmFiles = ['sql-wasm-browser.wasm', 'mozjpeg_enc.wasm', 'squoosh_png_bg.wasm', 'pkg/squoosh_oxipng_bg.wasm', 'webp_enc.wasm', 'webp_enc_simd.wasm', 'avif_enc.wasm', 'squoosh_resize_bg.wasm', 'qpdf.wasm']

export default defineConfig({
  plugins: [react(), tailwindcss(), startBergamotWorkerFromModels()],
  // Pre-bundled, the translator would skip startBergamotWorkerFromModels in dev and start its worker from node_modules.
  optimizeDeps: { exclude: ['@browsermt/bergamot-translator'] },
  // The tool pages' sample files (src/samples/) are imported with ?inline, so they arrive as data inside a script: no fetch.
  assetsInclude: ['**/*.xlsx', '**/*.xls', '**/*.docx', '**/*.pptx', '**/*.heic'],
  // SQLite's WebAssembly for the CSV page's query mode (CsvQueryPanel) is inlined as data, like the samples: the site never fetches
  // (Vite has no ?inline for .wasm, so its ?url address is inlined here). Every other asset keeps the default limit.
  // Workers are ES modules (they are started with type: 'module'), so a worker's dynamic import becomes its own chunk: the CSV
  // parse worker fetches the Parquet reader only for a .parquet file.
  // Workers are bundled on their own and use only worker.plugins.
  worker: { format: 'es', plugins: () => [fixPdfjsArabicLigatures(), dropJsquashDefaultWasm(), keepLibheifLicenceNotice(), feedQpdfWasmBytes()] },
  // The image tools' codecs (jSquash) are inlined the same way and compiled in imageTools.worker.ts.
  build: { assetsInlineLimit: (filePath) => (inlinedWasmFiles.some((name) => filePath.endsWith(name)) ? true : undefined) },
})
