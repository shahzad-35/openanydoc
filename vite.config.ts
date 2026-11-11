import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The tool pages' sample files (src/samples/) are imported with ?inline, so they arrive as data inside a script: no fetch.
  assetsInclude: ['**/*.xlsx', '**/*.xls', '**/*.docx', '**/*.pptx'],
})
