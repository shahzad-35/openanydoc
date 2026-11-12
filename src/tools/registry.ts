// Every tool of the site, the one list the tool pages, hub pages, the header search, the home page's popular tools, the sitemap
// and the share images are built from. Only tools with `isLive: true` are routed, linked, listed or prerendered; a tool that is
// planned but not built stays here with `isLive: false`.
//
// Every live tool is drawn by src/pages/ToolPage.tsx at /<slug>, with its words in src/content/tools/<slug>.<locale>.json (loaded
// only for the page shown: loadToolPageWords in src/seo.ts) and its two samples in src/samples/toolSamples.ts (samplesByPage). A tool with `loadComponent` works on the page (Merge
// PDF); the others are a viewer's page, a landing page or a converter from src/viewers.ts: the chosen file opens in its viewer,
// is converted first, or stays on the page (Mask data).
//
// The build script (Node) reads this file, so it imports only types; the components and the words are loaded only when called.
import type { ComponentType } from 'react'

type Locale = 'en' | 'ar'

export type ToolCategory = 'pdf' | 'image' | 'video' | 'audio' | 'data' | 'office' | 'ai' | 'utility'

// What a tool component gets from ToolPage: the files chosen so far (in order), a way to change that list, the file picker, and
// `onResult` for the finished file (ToolPage offers the download and the next tools).
export type ToolProps = {
  files: File[]
  onFilesChange: (files: File[]) => void
  onAddFiles: () => void
  onResult: (file: File) => void
}

export type Tool = {
  slug: string
  // The short name links use (menus, search, footer, related pages, hubs), in each language. Needed on every page, so it is here
  // and not in the tool's words.
  name?: Record<Locale, string>
  category: ToolCategory
  // The task group the hub page lists it under (Organize, Optimize, Convert to ...): a key of tools.group.* in en.json and ar.json.
  group: string
  inputFormats: string[]
  // Takes several files at once (Merge PDF).
  takesSeveralFiles?: boolean
  loadComponent?: () => Promise<{ default: ComponentType<ToolProps> }>
  // Tools offered after a download; the file is handed over in memory. Only live ones are shown.
  nextTools?: string[]
  // The "Related tools" links at the end of the page (tools and guides), when chosen by hand; otherwise six live tools.
  relatedPages?: string[]
  isLive: boolean
}

// `subtitle` is the sentence under the H1 that answers the search (the page's `answer`); `intro` the longer text under the tool.
// The optional titles replace the generic section headings; `handles`, `screenshot` (public/screenshots/<locale>-<viewer>.webp)
// and `comparison` (facts only) are drawn when present. A question's `link` turns a phrase of its answer into a link.
export type ComparisonTable = { title: string; columns: string[]; rows: { label: string; cells: string[] }[] }
export type ToolQuestion = { question: string; answer: string; link?: { text: string; path: string } }
export type ToolContent = {
  title: string
  description: string
  heading: string
  subtitle: string
  intro?: string
  features: { title: string; text: string }[]
  stepsTitle?: string
  steps: { title: string; text: string }[]
  handlesTitle?: string
  handles?: string[]
  screenshot?: { alt: string; caption: string }
  comparison?: ComparisonTable
  limits: string[]
  faqTitle?: string
  faq: ToolQuestion[]
}

const PDF = ['.pdf']

export const tools: Tool[] = [
  // PDF
  { slug: 'merge-pdf', name: { en: 'Merge PDF', ar: 'دمج PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/MergePdf'), nextTools: ['compress-pdf', 'sign-pdf', 'add-page-numbers'], isLive: true },
  { slug: 'split-pdf', category: 'pdf', group: 'organize', inputFormats: PDF, isLive: false },
  { slug: 'compress-pdf', category: 'pdf', group: 'optimize', inputFormats: PDF, isLive: false },
  { slug: 'jpg-to-pdf', category: 'pdf', group: 'convertTo', inputFormats: ['.jpg', '.jpeg', '.png'], isLive: false },
  { slug: 'pdf-to-jpg', category: 'pdf', group: 'convertFrom', inputFormats: PDF, isLive: false },
  { slug: 'add-page-numbers', name: { en: 'Add page numbers', ar: 'ترقيم الصفحات' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/AddPageNumbers'), nextTools: ['merge-pdf', 'compress-pdf', 'sign-pdf'], isLive: true },
  { slug: 'sign-pdf', category: 'pdf', group: 'security', inputFormats: PDF, isLive: false },
  { slug: 'summarize-pdf', category: 'pdf', group: 'intelligence', inputFormats: PDF, isLive: false },
  // Data: the existing viewers, converters and Mask data
  { slug: 'csv-viewer', name: { en: 'CSV viewer', ar: 'عارض CSV' }, category: 'data', group: 'view', inputFormats: ['.csv', '.tsv', '.tab'], relatedPages: ['/tsv-viewer', '/large-csv-viewer', '/excel-viewer', '/csv-to-excel', '/csv-to-json', '/mask-data', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/check-file-upload'], isLive: true },
  { slug: 'large-csv-viewer', name: { en: 'Large CSV file viewer', ar: 'عارض ملفات CSV الكبيرة' }, category: 'data', group: 'view', inputFormats: ['.csv'], relatedPages: ['/csv-viewer', '/tsv-viewer', '/excel-viewer', '/csv-too-big-for-excel'], isLive: true },
  { slug: 'tsv-viewer', name: { en: 'TSV viewer', ar: 'عارض TSV' }, category: 'data', group: 'view', inputFormats: ['.tsv', '.tab'], relatedPages: ['/csv-viewer', '/large-csv-viewer', '/excel-viewer', '/csv-to-excel', '/csv-opens-in-one-column'], isLive: true },
  { slug: 'json-viewer', name: { en: 'JSON viewer', ar: 'عارض JSON' }, category: 'data', group: 'view', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-validator', '/json-to-csv', '/mask-data', '/csv-viewer', '/open-json-file', '/anonymize-data-before-sharing'], isLive: true },
  { slug: 'json-formatter', name: { en: 'JSON formatter', ar: 'تنسيق JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-validator', '/json-viewer', '/json-unexpected-token', '/open-json-file'], isLive: true },
  { slug: 'json-validator', name: { en: 'JSON validator', ar: 'التحقق من JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-viewer', '/json-unexpected-token'], isLive: true },
  { slug: 'mask-data', name: { en: 'Mask sensitive data', ar: 'إخفاء البيانات الحساسة' }, category: 'data', group: 'clean', inputFormats: ['.csv', '.json', '.xlsx', '.txt'], relatedPages: ['/anonymize-data-before-sharing', '/csv-viewer', '/excel-viewer', '/json-viewer', '/check-file-upload'], isLive: true },
  { slug: 'csv-to-excel', name: { en: 'CSV to Excel', ar: 'تحويل CSV إلى Excel' }, category: 'data', group: 'convert', inputFormats: ['.csv'], relatedPages: ['/csv-to-json', '/csv-viewer', '/csv-too-big-for-excel'], isLive: true },
  { slug: 'csv-to-json', name: { en: 'CSV to JSON', ar: 'تحويل CSV إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.csv'], relatedPages: ['/csv-to-excel', '/json-to-csv', '/csv-viewer', '/csv-vs-excel-vs-json'], isLive: true },
  { slug: 'json-to-csv', name: { en: 'JSON to CSV', ar: 'تحويل JSON إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.json'], relatedPages: ['/csv-to-json', '/json-viewer', '/json-validator', '/csv-vs-excel-vs-json'], isLive: true },
  { slug: 'excel-to-csv', name: { en: 'Excel to CSV', ar: 'تحويل Excel إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.xlsx', '.xls'], relatedPages: ['/excel-to-json', '/excel-viewer', '/fix-arabic-csv-in-excel', '/csv-vs-excel-vs-json'], isLive: true },
  { slug: 'excel-to-json', name: { en: 'Excel to JSON', ar: 'تحويل Excel إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.xlsx', '.xls'], relatedPages: ['/excel-to-csv', '/excel-viewer', '/json-viewer'], isLive: true },
  // Office
  { slug: 'excel-viewer', name: { en: 'Excel viewer', ar: 'عارض Excel' }, category: 'office', group: 'view', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], relatedPages: ['/xls-viewer', '/csv-viewer', '/excel-to-csv', '/excel-to-json', '/mask-data', '/open-xlsx-without-excel', '/anonymize-data-before-sharing'], isLive: true },
  { slug: 'xls-viewer', name: { en: 'XLS viewer', ar: 'عارض XLS' }, category: 'office', group: 'view', inputFormats: ['.xls'], relatedPages: ['/excel-viewer', '/csv-viewer', '/excel-to-csv', '/open-xlsx-without-excel'], isLive: true },
  { slug: 'word-viewer', name: { en: 'Word viewer', ar: 'عارض Word' }, category: 'office', group: 'view', inputFormats: ['.docx'], relatedPages: ['/open-docx-without-word', '/powerpoint-viewer', '/txt-viewer', '/csv-viewer', '/check-file-upload'], isLive: true },
  { slug: 'powerpoint-viewer', name: { en: 'PowerPoint viewer (beta)', ar: 'عارض PowerPoint (تجريبي)' }, category: 'office', group: 'view', inputFormats: ['.pptx'], relatedPages: ['/word-viewer', '/excel-viewer', '/check-file-upload'], isLive: true },
  { slug: 'txt-viewer', name: { en: 'TXT editor', ar: 'محرر TXT' }, category: 'office', group: 'view', inputFormats: ['.txt'], relatedPages: ['/csv-viewer', '/json-viewer', '/word-viewer'], isLive: true },
]

// The words of each live tool drawn by ToolPage, by language and slug.
// Each live tool's words, one file per language, fetched for the page shown (and all of them by the build).
export const toolContentLoaders: Record<Locale, Record<string, () => Promise<{ default: unknown }>>> = {
  en: {
    'csv-viewer': () => import('../content/tools/csv-viewer.en.json', { with: { type: 'json' } }),
    'large-csv-viewer': () => import('../content/tools/large-csv-viewer.en.json', { with: { type: 'json' } }),
    'tsv-viewer': () => import('../content/tools/tsv-viewer.en.json', { with: { type: 'json' } }),
    'json-viewer': () => import('../content/tools/json-viewer.en.json', { with: { type: 'json' } }),
    'json-formatter': () => import('../content/tools/json-formatter.en.json', { with: { type: 'json' } }),
    'json-validator': () => import('../content/tools/json-validator.en.json', { with: { type: 'json' } }),
    'mask-data': () => import('../content/tools/mask-data.en.json', { with: { type: 'json' } }),
    'csv-to-excel': () => import('../content/tools/csv-to-excel.en.json', { with: { type: 'json' } }),
    'csv-to-json': () => import('../content/tools/csv-to-json.en.json', { with: { type: 'json' } }),
    'json-to-csv': () => import('../content/tools/json-to-csv.en.json', { with: { type: 'json' } }),
    'excel-to-csv': () => import('../content/tools/excel-to-csv.en.json', { with: { type: 'json' } }),
    'excel-to-json': () => import('../content/tools/excel-to-json.en.json', { with: { type: 'json' } }),
    'excel-viewer': () => import('../content/tools/excel-viewer.en.json', { with: { type: 'json' } }),
    'xls-viewer': () => import('../content/tools/xls-viewer.en.json', { with: { type: 'json' } }),
    'word-viewer': () => import('../content/tools/word-viewer.en.json', { with: { type: 'json' } }),
    'powerpoint-viewer': () => import('../content/tools/powerpoint-viewer.en.json', { with: { type: 'json' } }),
    'txt-viewer': () => import('../content/tools/txt-viewer.en.json', { with: { type: 'json' } }),
    'merge-pdf': () => import('../content/tools/merge-pdf.en.json', { with: { type: 'json' } }),
    'add-page-numbers': () => import('../content/tools/add-page-numbers.en.json', { with: { type: 'json' } }),
  },
  ar: {
    'csv-viewer': () => import('../content/tools/csv-viewer.ar.json', { with: { type: 'json' } }),
    'large-csv-viewer': () => import('../content/tools/large-csv-viewer.ar.json', { with: { type: 'json' } }),
    'tsv-viewer': () => import('../content/tools/tsv-viewer.ar.json', { with: { type: 'json' } }),
    'json-viewer': () => import('../content/tools/json-viewer.ar.json', { with: { type: 'json' } }),
    'json-formatter': () => import('../content/tools/json-formatter.ar.json', { with: { type: 'json' } }),
    'json-validator': () => import('../content/tools/json-validator.ar.json', { with: { type: 'json' } }),
    'mask-data': () => import('../content/tools/mask-data.ar.json', { with: { type: 'json' } }),
    'csv-to-excel': () => import('../content/tools/csv-to-excel.ar.json', { with: { type: 'json' } }),
    'csv-to-json': () => import('../content/tools/csv-to-json.ar.json', { with: { type: 'json' } }),
    'json-to-csv': () => import('../content/tools/json-to-csv.ar.json', { with: { type: 'json' } }),
    'excel-to-csv': () => import('../content/tools/excel-to-csv.ar.json', { with: { type: 'json' } }),
    'excel-to-json': () => import('../content/tools/excel-to-json.ar.json', { with: { type: 'json' } }),
    'excel-viewer': () => import('../content/tools/excel-viewer.ar.json', { with: { type: 'json' } }),
    'xls-viewer': () => import('../content/tools/xls-viewer.ar.json', { with: { type: 'json' } }),
    'word-viewer': () => import('../content/tools/word-viewer.ar.json', { with: { type: 'json' } }),
    'powerpoint-viewer': () => import('../content/tools/powerpoint-viewer.ar.json', { with: { type: 'json' } }),
    'txt-viewer': () => import('../content/tools/txt-viewer.ar.json', { with: { type: 'json' } }),
    'merge-pdf': () => import('../content/tools/merge-pdf.ar.json', { with: { type: 'json' } }),
    'add-page-numbers': () => import('../content/tools/add-page-numbers.ar.json', { with: { type: 'json' } }),
  },
}
// The words fetched so far, by language and slug.
export const toolContent: Record<Locale, Record<string, ToolContent>> = { en: {}, ar: {} }

// A hub page per category, with its task groups in the order shown. `guides`: the guides that help with that category's files.
export type Hub = { category: ToolCategory; path: string; groups: string[]; guides: string[] }

export const hubs: Hub[] = [
  { category: 'pdf', path: '/pdf-tools', groups: ['organize', 'optimize', 'convertTo', 'convertFrom', 'edit', 'security', 'intelligence'], guides: ['/check-file-upload'] },
  { category: 'image', path: '/image-tools', groups: ['edit', 'optimize', 'convert'], guides: [] },
  { category: 'video', path: '/video-tools', groups: ['edit', 'optimize', 'convert'], guides: [] },
  { category: 'audio', path: '/audio-tools', groups: ['edit', 'optimize', 'convert'], guides: [] },
  { category: 'data', path: '/data-tools', groups: ['view', 'convert', 'clean'], guides: ['/csv-opens-in-one-column', '/csv-too-big-for-excel', '/fix-arabic-csv-in-excel', '/open-json-file', '/json-unexpected-token', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing'] },
  { category: 'office', path: '/office-tools', groups: ['view'], guides: ['/open-xlsx-without-excel', '/open-docx-without-word'] },
  { category: 'ai', path: '/ai-tools', groups: ['intelligence'], guides: [] },
]
export const ALL_TOOLS_PATH = '/all-tools'

export const toolPath = (tool: Tool) => `/${tool.slug}`
export const liveTools = tools.filter((tool) => tool.isLive)
export const liveHubs = hubs.filter((hub) => liveTools.some((tool) => tool.category === hub.category))

export const findLiveToolPage = (path: string) => liveTools.find((tool) => toolPath(tool) === path)
export const findLiveHub = (path: string) => liveHubs.find((hub) => hub.path === path)
export const findLiveTool = (slug: string) => liveTools.find((tool) => tool.slug === slug)
export const findHubOfTool = (tool: Tool) => hubs.find((hub) => hub.category === tool.category) as Hub

// The small icon of a tool in menus and hub cards: a class nav-icon-<icon> in src/index.css.
const iconByExtension: Record<string, string> = { '.pdf': 'pdf', '.csv': 'csv', '.tsv': 'csv', '.json': 'json', '.xlsx': 'xlsx', '.xls': 'xlsx', '.docx': 'docx', '.pptx': 'pptx', '.txt': 'txt' }
export function findToolIcon(tool: Tool) {
  if (tool.slug === 'mask-data') return 'mask'
  if (tool.group === 'convert') return 'convert'
  return iconByExtension[tool.inputFormats[0]] ?? 'guide'
}

// The pages a tool page suggests at its end: its own `relatedPages`, or six live tools, the same category first, never itself.
export function findRelatedPages(tool: Tool) {
  if (tool.relatedPages) return tool.relatedPages
  const others = liveTools.filter((candidate) => candidate.slug !== tool.slug)
  return [...others.filter((candidate) => candidate.category === tool.category), ...others.filter((candidate) => candidate.category !== tool.category)].slice(0, 6).map(toolPath)
}

// The tools the home page shows under its drop zone. Hand-picked: the site counts no usage, so this is the most-searched tasks.
export const popularToolSlugs = ['csv-viewer', 'excel-viewer', 'merge-pdf', 'json-formatter', 'excel-to-csv', 'word-viewer', 'add-page-numbers', 'mask-data']
