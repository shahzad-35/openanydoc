import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The tool pages' sample files (src/samples/) are imported with ?inline, so they arrive as data inside a script: no fetch.
  assetsInclude: ['**/*.xlsx', '**/*.xls', '**/*.docx', '**/*.pptx'],
  // SQLite's WebAssembly for the CSV page's query mode (CsvQueryPanel) is inlined as data, like the samples: the site never fetches
  // (Vite has no ?inline for .wasm, so its ?url address is inlined here). Every other asset keeps the default limit.
  // Workers are ES modules (they are started with type: 'module'), so a worker's dynamic import becomes its own chunk: the CSV
  // parse worker fetches the Parquet reader only for a .parquet file.
  worker: { format: 'es' },
  build: { assetsInlineLimit: (filePath) => (filePath.endsWith('sql-wasm-browser.wasm') ? true : undefined) },
})
