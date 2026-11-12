// Every tool of the site, the one list the tool pages, hub pages, the header's Tools menu, the home page's popular tools, the
// sitemap and the share images are built from. Only tools with `isLive: true` are routed, linked, listed or prerendered; a tool
// that is planned but not built stays here with `isLive: false`.
//
// Two kinds of tool:
// - `existingPage: true`: a viewer, landing page or converter that already has its own page (src/viewers.ts, words in src/seo.ts
//   and src/pageContent.ts). It is listed in hubs and menus by its address; its page is unchanged.
// - otherwise a tool drawn by src/pages/ToolPage.tsx at /<slug>: its component (`loadComponent`), its words in
//   src/content/tools/<slug>.<locale>.json (imported below) and its two samples in src/samples/toolSamples.ts (samplesByPage).
//
// The build script (Node) reads this file, so it imports only JSON and types; the components are loaded only when called.
import type { ComponentType } from 'react'
import mergePdfEn from '../content/tools/merge-pdf.en.json' with { type: 'json' }
import mergePdfAr from '../content/tools/merge-pdf.ar.json' with { type: 'json' }
import addPageNumbersEn from '../content/tools/add-page-numbers.en.json' with { type: 'json' }
import addPageNumbersAr from '../content/tools/add-page-numbers.ar.json' with { type: 'json' }

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
  category: ToolCategory
  // The task group the hub page lists it under (Organize, Optimize, Convert to ...): a key of tools.group.* in en.json and ar.json.
  group: string
  inputFormats: string[]
  // Takes several files at once (Merge PDF).
  takesSeveralFiles?: boolean
  loadComponent?: () => Promise<{ default: ComponentType<ToolProps> }>
  // Tools offered after a download; the file is handed over in memory. Only live ones are shown.
  nextTools?: string[]
  isLive: boolean
  existingPage?: true
}

export type ToolContent = {
  title: string
  description: string
  heading: string
  subtitle: string
  linkText: string
  features: { title: string; text: string }[]
  steps: { title: string; text: string }[]
  limits: string[]
  faq: { question: string; answer: string }[]
}

const PDF = ['.pdf']

export const tools: Tool[] = [
  // PDF
  { slug: 'merge-pdf', category: 'pdf', group: 'organize', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/MergePdf'), nextTools: ['compress-pdf', 'sign-pdf', 'add-page-numbers'], isLive: true },
  { slug: 'split-pdf', category: 'pdf', group: 'organize', inputFormats: PDF, isLive: false },
  { slug: 'compress-pdf', category: 'pdf', group: 'optimize', inputFormats: PDF, isLive: false },
  { slug: 'jpg-to-pdf', category: 'pdf', group: 'convertTo', inputFormats: ['.jpg', '.jpeg', '.png'], isLive: false },
  { slug: 'pdf-to-jpg', category: 'pdf', group: 'convertFrom', inputFormats: PDF, isLive: false },
  { slug: 'add-page-numbers', category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/AddPageNumbers'), nextTools: ['merge-pdf', 'compress-pdf', 'sign-pdf'], isLive: true },
  { slug: 'sign-pdf', category: 'pdf', group: 'security', inputFormats: PDF, isLive: false },
  { slug: 'summarize-pdf', category: 'pdf', group: 'intelligence', inputFormats: PDF, isLive: false },
  // Data: the existing viewers, converters and Mask data
  { slug: 'csv-viewer', category: 'data', group: 'view', inputFormats: ['.csv', '.tsv', '.tab'], isLive: true, existingPage: true },
  { slug: 'large-csv-viewer', category: 'data', group: 'view', inputFormats: ['.csv'], isLive: true, existingPage: true },
  { slug: 'tsv-viewer', category: 'data', group: 'view', inputFormats: ['.tsv', '.tab'], isLive: true, existingPage: true },
  { slug: 'json-viewer', category: 'data', group: 'view', inputFormats: ['.json'], isLive: true, existingPage: true },
  { slug: 'json-formatter', category: 'data', group: 'clean', inputFormats: ['.json'], isLive: true, existingPage: true },
  { slug: 'json-validator', category: 'data', group: 'clean', inputFormats: ['.json'], isLive: true, existingPage: true },
  { slug: 'mask-data', category: 'data', group: 'clean', inputFormats: ['.csv', '.json', '.xlsx', '.txt'], isLive: true, existingPage: true },
  { slug: 'csv-to-excel', category: 'data', group: 'convert', inputFormats: ['.csv'], isLive: true, existingPage: true },
  { slug: 'csv-to-json', category: 'data', group: 'convert', inputFormats: ['.csv'], isLive: true, existingPage: true },
  { slug: 'json-to-csv', category: 'data', group: 'convert', inputFormats: ['.json'], isLive: true, existingPage: true },
  { slug: 'excel-to-csv', category: 'data', group: 'convert', inputFormats: ['.xlsx', '.xls'], isLive: true, existingPage: true },
  { slug: 'excel-to-json', category: 'data', group: 'convert', inputFormats: ['.xlsx', '.xls'], isLive: true, existingPage: true },
  // Office
  { slug: 'excel-viewer', category: 'office', group: 'view', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], isLive: true, existingPage: true },
  { slug: 'xls-viewer', category: 'office', group: 'view', inputFormats: ['.xls'], isLive: true, existingPage: true },
  { slug: 'word-viewer', category: 'office', group: 'view', inputFormats: ['.docx'], isLive: true, existingPage: true },
  { slug: 'powerpoint-viewer', category: 'office', group: 'view', inputFormats: ['.pptx'], isLive: true, existingPage: true },
  { slug: 'txt-viewer', category: 'office', group: 'view', inputFormats: ['.txt'], isLive: true, existingPage: true },
]

// The words of each live tool drawn by ToolPage, by language and slug.
export const toolContent: Record<Locale, Record<string, ToolContent>> = {
  en: { 'merge-pdf': mergePdfEn, 'add-page-numbers': addPageNumbersEn },
  ar: { 'merge-pdf': mergePdfAr, 'add-page-numbers': addPageNumbersAr },
}

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
// The tools drawn by ToolPage (not the existing viewer and converter pages).
export const liveToolPages = liveTools.filter((tool) => !tool.existingPage)
export const liveHubs = hubs.filter((hub) => liveTools.some((tool) => tool.category === hub.category))

export const findLiveToolPage = (path: string) => liveToolPages.find((tool) => toolPath(tool) === path)
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

// Six live tools to suggest on a tool page: the same category first, then the rest, never the tool itself.
export function findRelatedTools(tool: Tool) {
  const others = liveTools.filter((candidate) => candidate.slug !== tool.slug)
  return [...others.filter((candidate) => candidate.category === tool.category), ...others.filter((candidate) => candidate.category !== tool.category)].slice(0, 6)
}

// The tools the home page shows under its drop zone. Hand-picked: the site counts no usage, so this is the most-searched tasks.
export const popularToolSlugs = ['csv-viewer', 'excel-viewer', 'merge-pdf', 'json-formatter', 'excel-to-csv', 'word-viewer', 'add-page-numbers', 'mask-data']
