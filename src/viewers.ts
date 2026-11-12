import type { DelimiterChoice } from './parseCsv'
import { findHubOfTool, findLiveToolPage } from './tools/registry.ts'

export type Viewer = {
  id: 'csv' | 'text' | 'json' | 'excel' | 'word' | 'pdf' | 'powerpoint'
  label: string
  extensions: string[]
  // The address of this format's own page (a drop zone for just this format), without the language: /csv-viewer is served at
  // /en/csv-viewer and /ar/csv-viewer. Only for formats that work. The open file keeps it.
  toolPath?: string
  // Set on a conversion page's viewer (findViewerByToolPath): the page converts the file instead of opening it.
  convertTo?: ConversionTarget
  // Set on a tool page's viewer (findViewerByToolPath): the page is that tool, not a viewer of one format.
  tool?: 'mask'
  // The format's main features, as keys translated in src/i18n/en.json and ar.json: the featureList of its pages' WebApplication
  // structured data (scripts/build-static-pages.mjs).
  featureKeys?: string[]
}

export type ConversionTarget = 'csv' | 'xlsx' | 'json'

export const viewers: Viewer[] = [
  { id: 'csv', label: 'CSV', extensions: ['.csv', '.tsv', '.tab'], toolPath: '/csv-viewer', featureKeys: ['highlights.csv.open', 'highlights.csv.edit', 'highlights.csv.large'] },
  { id: 'text', label: 'TXT', extensions: ['.txt'], toolPath: '/txt-viewer', featureKeys: ['highlights.text.view', 'highlights.text.edit', 'highlights.text.endings'] },
  { id: 'json', label: 'JSON', extensions: ['.json'], toolPath: '/json-viewer', featureKeys: ['highlights.json.views', 'highlights.json.edit', 'highlights.json.errors'] },
  { id: 'excel', label: 'Excel', extensions: ['.xlsx', '.xls', '.xlsm', '.ods'], toolPath: '/excel-viewer', featureKeys: ['highlights.excel.open', 'highlights.excel.edit', 'highlights.excel.format'] },
  { id: 'word', label: 'Word', extensions: ['.docx'], toolPath: '/word-viewer', featureKeys: ['highlights.word.view', 'highlights.word.rtl', 'highlights.word.print'] },
  { id: 'pdf', label: 'PDF', extensions: ['.pdf'] },
  { id: 'powerpoint', label: 'PowerPoint', extensions: ['.pptx'], toolPath: '/powerpoint-viewer', featureKeys: ['highlights.powerpoint.view', 'highlights.powerpoint.thumbnails', 'highlights.powerpoint.fullscreen'] },
]

// How the table viewer treats each kind of table file: .csv starts on auto-detect (real CSVs are often semicolon separated),
// .tsv and .tab are tab separated. Quotes are handled the same for all, as Excel and Google Sheets write them.
// `headerRow`: whether the first row is the header by default ('detect' checks how the rows look).
export type TableFormat = { label: string; defaultDelimiter: DelimiterChoice; headerRow: 'always' | 'detect'; mimeType: string }

const CSV_FORMAT: TableFormat = { label: 'CSV', defaultDelimiter: 'auto', headerRow: 'always', mimeType: 'text/csv' }
const TSV_FORMAT: TableFormat = { label: 'TSV', defaultDelimiter: '\t', headerRow: 'detect', mimeType: 'text/tab-separated-values' }

export function findTableFormat(fileName: string): TableFormat {
  const lowerCaseFileName = fileName.toLowerCase()
  if (lowerCaseFileName.endsWith('.tsv') || lowerCaseFileName.endsWith('.tab')) return TSV_FORMAT
  return CSV_FORMAT
}

export const supportedExtensions = viewers.flatMap((viewer) => viewer.extensions)

// Pages for one job of a live viewer (/json-formatter is the JSON viewer's page with its own words in seo.ts and pageContent.ts),
// served like a format page at /en/json-formatter and /ar/json-formatter. `extensions` narrows what their drop zone accepts.
// Only jobs the viewer really does. A page with `convertTo` is a converter: `viewerId` is the format it reads, and the file is
// converted as it is chosen (src/formats/conversion.ts) and the result opens in the viewer of its new format. A page with `tool`
// is a tool for several formats (/mask-data takes CSV, Excel and JSON): the file stays on the page; `viewerId` is the format of
// its breadcrumb and guide only.
export type LandingPage = { path: string; viewerId: Viewer['id']; extensions?: string[]; convertTo?: ConversionTarget; tool?: 'mask' }

export const landingPages: LandingPage[] = [
  { path: '/json-formatter', viewerId: 'json' },
  { path: '/json-validator', viewerId: 'json' },
  { path: '/tsv-viewer', viewerId: 'csv', extensions: ['.tsv', '.tab'] },
  { path: '/large-csv-viewer', viewerId: 'csv' },
  { path: '/xls-viewer', viewerId: 'excel', extensions: ['.xls'] },
  { path: '/excel-to-csv', viewerId: 'excel', convertTo: 'csv' },
  { path: '/csv-to-excel', viewerId: 'csv', convertTo: 'xlsx' },
  { path: '/excel-to-json', viewerId: 'excel', convertTo: 'json' },
  { path: '/csv-to-json', viewerId: 'csv', convertTo: 'json' },
  { path: '/json-to-csv', viewerId: 'json', convertTo: 'csv' },
  { path: '/mask-data', viewerId: 'csv', extensions: ['.csv', '.tsv', '.tab', '.json', '.xlsx', '.xls', '.xlsm', '.ods', '.txt'], tool: 'mask' },
]


const LEGACY_FILE_VIEW_PATH = '/view'

// A file keeps the address of its format's own page (/csv-viewer, /txt-viewer, /json-viewer), so the address and a reload
// both make sense. Formats without a page of their own use /view-pdf while open.
export function getFileViewPath(fileName: string) {
  const viewer = findViewerForFileName(fileName)
  return viewer?.toolPath ?? `/view-${viewer?.id ?? 'file'}`
}

// Addresses that only exist while a file is open; a reload or Forward sends them home because the file lives in memory.
export function isFileViewPath(pathname: string) {
  return pathname === LEGACY_FILE_VIEW_PATH || viewers.some((viewer) => pathname === `/view-${viewer.id}`)
}

// The viewer of a format page or a landing page, as that page uses it: `toolPath` is the page's own address and `extensions` the
// ones its drop zone accepts.
// The page between Home and this page in its breadcrumb (shown on the page and in its BreadcrumbList data): a guide sits under the
// guides index, a landing page under its viewer's page (Home › JSON viewer › JSON formatter), a tool page under its hub
// (Home › PDF tools › Merge PDF). A tool for several formats (/mask-data) and every other page sit under Home only.
export function findBreadcrumbParent(address: string, isGuide: boolean): string | undefined {
  if (isGuide) return '/guides'
  const toolPage = findLiveToolPage(address)
  if (toolPage) return findHubOfTool(toolPage).path
  const landingPage = landingPages.find((page) => page.path === address)
  if (!landingPage || landingPage.tool) return undefined
  return viewers.find((viewer) => viewer.id === landingPage.viewerId)?.toolPath
}

export function findViewerByToolPath(pathname: string): Viewer | undefined {
  const formatViewer = viewers.find((viewer) => viewer.toolPath === pathname)
  if (formatViewer) return formatViewer
  const landingPage = landingPages.find((page) => page.path === pathname)
  const landingViewer = landingPage && viewers.find((viewer) => viewer.id === landingPage.viewerId)
  return (
    landingViewer && {
      ...landingViewer,
      toolPath: landingPage.path,
      extensions: landingPage.extensions ?? landingViewer.extensions,
      convertTo: landingPage.convertTo,
      tool: landingPage.tool,
    }
  )
}

export function findViewerForFileName(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase()
  return viewers.find((viewer) => viewer.extensions.some((extension) => lowerCaseFileName.endsWith(extension)))
}
