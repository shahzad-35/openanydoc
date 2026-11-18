# OpenAnyDoc

**Free, open-source viewer, editor and converter for CSV, Excel, JSON and TXT files, a viewer for Word, PowerPoint, PDF and image files, and a set of PDF and image tools. Files stay in your browser: nothing is uploaded.**

Live site: **https://www.openanydoc.com** (English) · https://www.openanydoc.com/ar (Arabic)

Drop a file on the page. Your browser reads it, draws it, lets you search, sort, filter and edit it, and downloads a copy in the same format. There is no server that ever sees the file, no sign-up, no cookies and no analytics.

![The CSV viewer with a table, a column profile and the delimiter and encoding in the status bar](public/screenshots/en-csv.webp)

## Nothing is uploaded, and you can check

The privacy rule is enforced, not promised:

1. Open the site, press **F12** (DevTools) and open the **Network** tab.
2. Drop any file on the page, even a 50 MB one.
3. You will see **no request** leave your browser. The file is read with the browser's own File API and drawn on screen.

Behind that:

- The site's `Content-Security-Policy` is `default-src 'self'` with `connect-src 'self'`: the browser itself refuses any request to another origin. The only inline code is the theme script and the stylesheet, both allowed by their SHA-256 hashes.
- `npm run test:privacy` drives headless Chrome over the DevTools protocol through every page and every viewer, and **fails the build** on any `fetch`, XHR, beacon, WebSocket, cookie, IndexedDB, Cache API, service worker, or any browser-storage write other than the theme choice.
- No analytics, no fonts from a font host, no third-party script. Fonts and icons are bundled.

## What it opens

| Format | Files | What you can do | Limits |
|---|---|---|---|
| CSV, Parquet | `.csv` `.tsv` `.tab` `.parquet` (read) | Delimiter (comma, semicolon, tab, pipe) and encoding detected; search, filter, multi-column sort, column profiles; edit cells, rows and columns; find and replace; clean-up tools; download with your choice of delimiter, quotes, line endings and only the shown rows ; a filter row under the headers, a health check, a bar/line/pie chart (Chart.js), SQL queries (SQLite via sql.js), saving as .xlsx, Markdown, HTML or SQL INSERT, splitting into a zip of parts, adding rows from other CSVs | No row limit of its own; 120,000 rows open in under a second; a warning above 50 MB |
| Excel | `.xlsx` `.xls` `.xlsm` `.ods` | Every sheet with values, formulas that recalculate, number formats and merged cells; fonts, colours and fills for `.xlsx`/`.xlsm`; frozen panes, hidden rows, columns and sheets, notes and links (Ctrl+click); edit cells, rows, columns and sheets; bold, italic, colours, fills and alignment saved for `.xlsx`; column filters and profile, Show formulas, formula list, search across sheets, compare sheets or workbooks, split / merge / CSV ZIP, print or save as PDF, Workbook info (macros detected, never run) | Styles read up to 8 MB; hidden rows and columns and frozen panes read from `.xlsx`/`.xlsm` only; password-protected files get a message, not opened; charts, images, pivot tables, conditional formats, data validation, defined names and macros are not kept on save |
| JSON | `.json`, `.jsonl`/`.ndjson`, `.json5`, `.yaml`/`.yml`, `.geojson`, pasted text, or an https address | Tree, table and text views; validate with the line and column of an error; repair comments, trailing commas, single quotes and unquoted keys; format with 1–8 spaces or a tab, minify, sort keys; integers beyond 2^53 kept exactly; graph view (React Flow) with PNG/SVG export; compare two documents; JSON Schema validation (@cfworker/json-schema) and schema generation; live JSONPath (jsonpath-plus); remove nulls/empties, escape/unescape, Repair with a preview; convert to YAML (js-yaml), XML, TypeScript, CSV or Excel; GeoJSON feature table | 10 MB; the text pane starts closed above 5 MB |
| TXT | `.txt` | Line numbers, find and replace with regular expressions, case, whitespace, sort and duplicate tools, bookmarks; save as UTF-8, UTF-8 with BOM, UTF-16 or Windows-1256 with LF, CRLF or CR | A 46 MB file has been tested; a fast read view above 2 million characters |
| Word | `.docx`, `.dotx`, `.docm`, `.odt` | Pages with fonts, tables, images, lists, headers and footers; Arabic right to left; zoom, print and save as PDF; navigation pane, search, document info, comments and tracked changes in the margin, reading mode, read aloud with on-device voices; export as text, Markdown, HTML or the pictures as a ZIP | View only; macros are never run; `.odt` shows as one flowing page without the comments margin; old `.doc` files are not supported |
| PowerPoint (beta) | `.pptx`, `.ppsx`, `.potx`, `.pptm` | One slide at a time with text, images, tables and shapes; thumbnails, a grid of all slides, arrow keys and full screen; speaker notes; a presenter view (current and next slide, notes, timer) with the audience slide in a second window; search across slides and notes; read aloud with on-device voices; outline export (Markdown or text), slides as PNG (one or a ZIP), print / save as PDF; a note in place of a slide that cannot be drawn | View only; macros are never run; animations and transitions are not played; slide pictures use the device's fonts; old `.ppt` files are not supported |
| PDF | `.pdf` | Continuous pages with thumbnails, zoom, fit to width or page, rotation, go to page; search with highlights; selectable text, Arabic included; a password prompt for protected PDFs (the password stays on the device) | View only; scanned PDFs show their pictures, with no text to select or search (no OCR); forms are shown, not filled |

Encodings on every text format: UTF-8 with or without a BOM, UTF-16, and Windows-1256 for older Arabic files. Arabic text is shown right to left; the "Excel copy" button writes a UTF-8 BOM so Excel stops showing Arabic as symbols.

PDF tools, each on its own page and fully in the browser: [Merge PDF](https://www.openanydoc.com/en/merge-pdf) (drag files into order), [Split PDF](https://www.openanydoc.com/en/split-pdf) (page ranges, every N pages, or one file per page as a ZIP), [Remove pages](https://www.openanydoc.com/en/remove-pdf-pages) and [Extract pages](https://www.openanydoc.com/en/extract-pdf-pages) (click thumbnails), [Organize PDF](https://www.openanydoc.com/en/organize-pdf) (reorder, rotate, delete, duplicate, blank pages, add another PDF, undo), [Rotate PDF](https://www.openanydoc.com/en/rotate-pdf), [Add page numbers](https://www.openanydoc.com/en/add-page-numbers), [JPG to PDF](https://www.openanydoc.com/en/jpg-to-pdf) (JPG, PNG, WebP, TIFF, SVG; HEIC where the browser decodes it; page size, orientation and margin; one PDF or one per picture), [PDF to JPG](https://www.openanydoc.com/en/pdf-to-jpg) (JPG or PNG at 72/150/300 dpi), [PDF to text](https://www.openanydoc.com/en/pdf-to-text) and [Extract images from PDF](https://www.openanydoc.com/en/extract-pdf-images), [Edit PDF](https://www.openanydoc.com/en/edit-pdf) (text boxes, highlights and drawing with pdf.js's annotation editor; shapes and pictures; undo and redo), [Sign PDF](https://www.openanydoc.com/en/sign-pdf) (draw, type or upload a signature and place it on one or many pages: a visual signature, not a certificate-based digital signature), [Fill PDF form](https://www.openanydoc.com/en/fill-pdf) (with Flatten on save), [Watermark PDF](https://www.openanydoc.com/en/watermark-pdf) and [Header and footer](https://www.openanydoc.com/en/header-footer-pdf). "Save a copy" always makes a new file. Text added to pages (page numbers, headers, watermarks, typed signatures, flattened answers) is drawn by the browser and stamped as a picture, so Arabic is correct. They share a thumbnail grid, a progress bar and a preview of the result before download; PDFs are built in a Web Worker with [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT), pages are drawn and read with pdf.js (Apache-2.0), ZIP files are made with [fflate](https://github.com/101arrowz/fflate) (MIT) and TIFF pictures decoded with [UTIF2](https://github.com/photopea/UTIF.js) (MIT). Password-protected PDFs are not supported by the tools. The [PDF viewer](https://www.openanydoc.com/en/pdf-viewer) shows PDFs with [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0): continuous pages with thumbnails, zoom, fit to width, rotation, go to page, search with highlights, selectable text (Arabic included), and a password prompt that stays on the device.

![The Excel viewer with sheet tabs, formulas and the formatting toolbar](public/screenshots/en-excel.webp)
![The JSON viewer with the text pane and the tree view](public/screenshots/en-json.webp)
![The text editor with line numbers and the tools ribbon](public/screenshots/en-text.webp)

## Guides

Short, practical answers to the problems people hit with these files, each with the tool that fixes it:

- [Why your CSV shows broken Arabic text in Excel](https://www.openanydoc.com/en/fix-arabic-csv-in-excel)
- [CSV opens in one column in Excel: how to fix the delimiter](https://www.openanydoc.com/en/csv-opens-in-one-column)
- [CSV too big for Excel: the 1,048,576-row limit and what to do](https://www.openanydoc.com/en/csv-too-big-for-excel)
- [JSON "unexpected token" errors: find the line and fix it](https://www.openanydoc.com/en/json-unexpected-token)

All guides: https://www.openanydoc.com/en/guides

## Run it yourself

Requirements: Node.js 22.6 or newer (the build script reads TypeScript directly with `--experimental-strip-types`), npm, and for the tests and screenshots Google Chrome.

```sh
git clone https://github.com/shahzad-35/openanydoc.git
cd openanydoc
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```sh
npm run build        # type-check, bundle, prerender every page in English and Arabic, write sitemap.xml, robots.txt and the 404 pages into dist/
npm run test:privacy # build, then the privacy and behaviour suite in headless Chrome (79 tests)
npm run lint         # oxlint
npm run og:images    # draw the share pictures (public/og/) with headless Chrome
node --experimental-strip-types scripts/take-screenshots.mjs   # the viewer screenshots in this README (needs cwebp)
```

Because the site is a folder of static files, an organisation can host its own copy on an internal network: build it, serve `dist/` from any web server, and the files employees open never leave their devices.

## How it is built

- Vite, React 19, TypeScript and Tailwind CSS v4; no router package (the app switches on the address).
- CSV: PapaParse with TanStack Virtual for the table. Excel: SheetJS (community build) to read and write, ExcelJS for cell styles, a formula parser that recalculates after an edit. JSON: the browser's own parser, with a reviver that keeps big integers exact.
- Every page is prerendered at build time (`scripts/build-static-pages.mjs` with `react-dom/static`) and hydrated in the browser, so titles, descriptions, canonicals, hreflang, structured data and the full text are in the HTML itself.
- Hosted on Cloudflare as a Worker with static assets; the Worker only redirects `/` to `/en` or `/ar` by the browser language.
- Interface fonts (Fredoka, Nunito Sans, Baloo Bhaijaan 2, IBM Plex Sans Arabic) are bundled from Fontsource.

## Languages

The whole site is available in English and Arabic (`/en`, `/ar`). Every string lives in both `src/i18n/en.json` and `src/i18n/ar.json`; the type-check fails if the Arabic file lacks a key. The Arabic copy has not yet had a native-speaker review: corrections are welcome as issues or pull requests.

## Contributing and support

- Bugs and ideas: open an issue in this repository.
- Questions: support@openanydoc.com.
- Please do not attach real customer files or personal data to an issue; a synthetic file that shows the problem is enough.

## Licence

MIT. See `LICENSE`.
