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
  // The editing tools (Edit, Sign, Fill PDF): tell the page whether there are edits not yet saved, and ask the visitor before
  // throwing them away (the same "Discard your edits?" dialog as the file pages).
  onUnsavedEditsChange?: (hasUnsavedEdits: boolean) => void
  confirmDiscardEdits?: () => Promise<boolean>
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
  // Edits pages in a wide editor (Edit, Sign, Fill PDF): the workspace is wider and the result card offers "Back to editing".
  isEditor?: boolean
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
// The pictures JPG to PDF takes; HEIC only opens where the browser can read it (Safari).
const IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.svg']
// Every picture the image tools read.
const IMAGE_FILES = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.heic', '.heif', '.tif', '.tiff', '.svg']

export const tools: Tool[] = [
  // PDF
  { slug: 'pdf-viewer', name: { en: 'PDF viewer', ar: 'عارض PDF' }, category: 'pdf', group: 'view', inputFormats: PDF, nextTools: ['edit-pdf', 'sign-pdf', 'merge-pdf', 'pdf-to-jpg'], relatedPages: ['/edit-pdf', '/sign-pdf', '/merge-pdf', '/split-pdf', '/pdf-to-jpg', '/pdf-to-text', '/jpg-to-pdf', '/extract-pdf-images', '/check-file-upload'], isLive: true },
  { slug: 'merge-pdf', name: { en: 'Merge PDF', ar: 'دمج PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/MergePdf'), nextTools: ['split-pdf', 'organize-pdf', 'add-page-numbers', 'pdf-to-jpg'], isLive: true },
  { slug: 'split-pdf', name: { en: 'Split PDF', ar: 'تقسيم PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.SplitPdf })), nextTools: ['merge-pdf', 'extract-pdf-pages', 'remove-pdf-pages', 'pdf-to-jpg'], isLive: true },
  { slug: 'remove-pdf-pages', name: { en: 'Remove PDF pages', ar: 'حذف صفحات PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.RemovePdfPages })), nextTools: ['organize-pdf', 'rotate-pdf', 'merge-pdf', 'add-page-numbers'], isLive: true },
  { slug: 'extract-pdf-pages', name: { en: 'Extract PDF pages', ar: 'استخراج صفحات PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.ExtractPdfPages })), nextTools: ['merge-pdf', 'rotate-pdf', 'pdf-to-jpg', 'split-pdf'], isLive: true },
  { slug: 'organize-pdf', name: { en: 'Organize PDF', ar: 'ترتيب صفحات PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/OrganizePdf'), nextTools: ['merge-pdf', 'add-page-numbers', 'pdf-to-jpg', 'split-pdf'], isLive: true },
  { slug: 'rotate-pdf', name: { en: 'Rotate PDF', ar: 'تدوير PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.RotatePdf })), nextTools: ['organize-pdf', 'merge-pdf', 'add-page-numbers', 'pdf-to-jpg'], isLive: true },
  { slug: 'compress-pdf', category: 'pdf', group: 'optimize', inputFormats: PDF, isLive: false },
  { slug: 'jpg-to-pdf', name: { en: 'JPG to PDF', ar: 'تحويل JPG إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: IMAGES, takesSeveralFiles: true, loadComponent: () => import('./pdf/ImagesToPdf'), nextTools: ['merge-pdf', 'organize-pdf', 'rotate-pdf', 'add-page-numbers'], isLive: true },
  { slug: 'pdf-to-jpg', name: { en: 'PDF to JPG', ar: 'تحويل PDF إلى JPG' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.PdfToImages })), nextTools: ['jpg-to-pdf', 'pdf-to-text', 'extract-pdf-images', 'split-pdf'], isLive: true },
  { slug: 'pdf-to-text', name: { en: 'PDF to text', ar: 'تحويل PDF إلى نص' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.PdfToText })), nextTools: ['pdf-to-jpg', 'extract-pdf-images', 'split-pdf', 'merge-pdf'], isLive: true },
  { slug: 'extract-pdf-images', name: { en: 'Extract images from PDF', ar: 'استخراج الصور من PDF' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.ExtractPdfImages })), nextTools: ['pdf-to-jpg', 'pdf-to-text', 'split-pdf', 'merge-pdf'], isLive: true },
  { slug: 'add-page-numbers', name: { en: 'Add page numbers', ar: 'ترقيم الصفحات' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/AddPageNumbers'), nextTools: ['header-footer-pdf', 'watermark-pdf', 'sign-pdf', 'merge-pdf'], isLive: true },
  { slug: 'edit-pdf', name: { en: 'Edit PDF', ar: 'تعديل PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.EditPdf })), nextTools: ['sign-pdf', 'watermark-pdf', 'organize-pdf', 'pdf-to-jpg'], relatedPages: ['/sign-pdf', '/fill-pdf', '/watermark-pdf', '/header-footer-pdf', '/organize-pdf', '/pdf-viewer'], isLive: true },
  { slug: 'fill-pdf', name: { en: 'Fill PDF form', ar: 'تعبئة نموذج PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.FillPdf })), nextTools: ['sign-pdf', 'merge-pdf', 'add-page-numbers', 'pdf-to-jpg'], relatedPages: ['/sign-pdf', '/edit-pdf', '/merge-pdf', '/pdf-viewer', '/pdf-to-text', '/check-file-upload'], isLive: true },
  { slug: 'watermark-pdf', name: { en: 'Watermark PDF', ar: 'علامة مائية على PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfStampTools').then((tools) => ({ default: tools.WatermarkPdf })), nextTools: ['sign-pdf', 'header-footer-pdf', 'add-page-numbers', 'merge-pdf'], relatedPages: ['/header-footer-pdf', '/add-page-numbers', '/sign-pdf', '/edit-pdf', '/merge-pdf', '/pdf-to-jpg'], isLive: true },
  { slug: 'header-footer-pdf', name: { en: 'Header and footer', ar: 'رأس وتذييل PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfStampTools').then((tools) => ({ default: tools.HeaderFooterPdf })), nextTools: ['watermark-pdf', 'sign-pdf', 'merge-pdf', 'pdf-to-jpg'], relatedPages: ['/add-page-numbers', '/watermark-pdf', '/edit-pdf', '/sign-pdf', '/merge-pdf', '/organize-pdf'], isLive: true },
  { slug: 'sign-pdf', name: { en: 'Sign PDF', ar: 'توقيع PDF' }, category: 'pdf', group: 'security', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.SignPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'pdf-to-jpg', 'watermark-pdf'], relatedPages: ['/sign-pdf-without-adobe', '/fill-pdf', '/edit-pdf', '/merge-pdf', '/add-page-numbers', '/watermark-pdf', '/pdf-tools-without-upload'], isLive: true },
  { slug: 'summarize-pdf', category: 'pdf', group: 'intelligence', inputFormats: PDF, isLive: false },
  // Images (Step 17S)
  { slug: 'image-viewer', name: { en: 'Image viewer', ar: 'عارض الصور' }, category: 'image', group: 'view', inputFormats: IMAGE_FILES, nextTools: ['compress-image', 'resize-image', 'remove-image-metadata', 'jpg-to-pdf'], relatedPages: ['/compress-image', '/resize-image', '/remove-image-metadata', '/heic-to-jpg', '/jpg-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'compress-image', name: { en: 'Compress image', ar: 'ضغط الصور' }, category: 'image', group: 'optimize', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.CompressImage })), nextTools: ['resize-image', 'image-to-webp', 'remove-image-metadata', 'jpg-to-pdf'], relatedPages: ['/resize-image', '/image-to-webp', '/convert-image', '/remove-image-metadata', '/jpg-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'resize-image', name: { en: 'Resize image', ar: 'تغيير حجم الصورة' }, category: 'image', group: 'optimize', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.ResizeImage })), nextTools: ['compress-image', 'crop-image', 'convert-image', 'jpg-to-pdf'], relatedPages: ['/crop-image', '/compress-image', '/rotate-image', '/convert-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'crop-image', name: { en: 'Crop image', ar: 'قص الصورة' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.CropImage })), nextTools: ['resize-image', 'compress-image', 'photo-editor', 'jpg-to-pdf'], relatedPages: ['/resize-image', '/rotate-image', '/photo-editor', '/compress-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'rotate-image', name: { en: 'Rotate image', ar: 'تدوير الصورة' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.RotateImage })), nextTools: ['crop-image', 'compress-image', 'jpg-to-pdf', 'resize-image'], relatedPages: ['/crop-image', '/resize-image', '/photo-editor', '/jpg-to-pdf'], isLive: true },
  { slug: 'watermark-image', name: { en: 'Watermark image', ar: 'علامة مائية على الصور' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.WatermarkImage })), nextTools: ['compress-image', 'resize-image', 'remove-image-metadata', 'jpg-to-pdf'], relatedPages: ['/remove-image-metadata', '/photo-editor', '/compress-image', '/watermark-pdf', '/jpg-to-pdf'], isLive: true },
  { slug: 'remove-image-metadata', name: { en: 'Remove image metadata', ar: 'حذف بيانات الصور' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.RemoveImageMetadata })), nextTools: ['compress-image', 'watermark-image', 'image-viewer', 'jpg-to-pdf'], relatedPages: ['/image-viewer', '/compress-image', '/mask-data', '/check-file-upload', '/jpg-to-pdf'], isLive: true },
  { slug: 'photo-editor', name: { en: 'Photo editor', ar: 'محرر الصور' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, isEditor: true, loadComponent: () => import('./image/ImageEditors').then((tools) => ({ default: tools.PhotoEditor })), nextTools: ['compress-image', 'resize-image', 'meme-generator', 'jpg-to-pdf'], relatedPages: ['/crop-image', '/meme-generator', '/watermark-image', '/compress-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'convert-image', name: { en: 'Convert image', ar: 'تحويل الصور' }, category: 'image', group: 'convert', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.ConvertImage })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'image-viewer'], relatedPages: ['/heic-to-jpg', '/webp-to-jpg', '/png-to-jpg', '/jpg-to-png', '/svg-to-png', '/image-to-webp', '/jpg-to-pdf', '/pdf-to-jpg'], isLive: true },
  { slug: 'heic-to-jpg', name: { en: 'HEIC to JPG', ar: 'تحويل HEIC إلى JPG' }, category: 'image', group: 'convert', inputFormats: ['.heic', '.heif'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.HeicToJpg })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'remove-image-metadata'], relatedPages: ['/convert-image', '/remove-image-metadata', '/compress-image', '/jpg-to-pdf', '/image-viewer'], isLive: true },
  { slug: 'webp-to-jpg', name: { en: 'WebP to JPG', ar: 'تحويل WebP إلى JPG' }, category: 'image', group: 'convert', inputFormats: ['.webp'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.WebpToJpg })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'image-to-webp'], relatedPages: ['/convert-image', '/image-to-webp', '/png-to-jpg', '/jpg-to-pdf'], isLive: true },
  { slug: 'png-to-jpg', name: { en: 'PNG to JPG', ar: 'تحويل PNG إلى JPG' }, category: 'image', group: 'convert', inputFormats: ['.png'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.PngToJpg })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'jpg-to-png'], relatedPages: ['/convert-image', '/jpg-to-png', '/compress-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'jpg-to-png', name: { en: 'JPG to PNG', ar: 'تحويل JPG إلى PNG' }, category: 'image', group: 'convert', inputFormats: ['.jpg', '.jpeg'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.JpgToPng })), nextTools: ['compress-image', 'crop-image', 'png-to-jpg', 'jpg-to-pdf'], relatedPages: ['/convert-image', '/png-to-jpg', '/crop-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'svg-to-png', name: { en: 'SVG to PNG', ar: 'تحويل SVG إلى PNG' }, category: 'image', group: 'convert', inputFormats: ['.svg'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.SvgToPng })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'image-to-webp'], relatedPages: ['/convert-image', '/resize-image', '/image-to-webp', '/jpg-to-pdf'], isLive: true },
  { slug: 'image-to-webp', name: { en: 'Image to WebP', ar: 'تحويل الصور إلى WebP' }, category: 'image', group: 'convert', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.ImageToWebp })), nextTools: ['compress-image', 'resize-image', 'webp-to-jpg', 'jpg-to-pdf'], relatedPages: ['/compress-image', '/webp-to-jpg', '/convert-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'meme-generator', name: { en: 'Meme generator', ar: 'صانع الميمز' }, category: 'image', group: 'create', inputFormats: IMAGE_FILES, isEditor: true, loadComponent: () => import('./image/ImageEditors').then((tools) => ({ default: tools.MemeGenerator })), nextTools: ['compress-image', 'photo-editor', 'resize-image', 'jpg-to-pdf'], relatedPages: ['/photo-editor', '/watermark-image', '/crop-image', '/compress-image'], isLive: true },
  // Data: the existing viewers, converters and Mask data
  { slug: 'csv-viewer', name: { en: 'CSV viewer', ar: 'عارض CSV' }, category: 'data', group: 'view', inputFormats: ['.csv', '.tsv', '.tab'], relatedPages: ['/tsv-viewer', '/large-csv-viewer', '/excel-viewer', '/csv-to-excel', '/csv-to-json', '/mask-data', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/check-file-upload'], isLive: true },
  { slug: 'large-csv-viewer', name: { en: 'Large CSV file viewer', ar: 'عارض ملفات CSV الكبيرة' }, category: 'data', group: 'view', inputFormats: ['.csv'], relatedPages: ['/csv-viewer', '/tsv-viewer', '/excel-viewer', '/csv-too-big-for-excel'], isLive: true },
  { slug: 'tsv-viewer', name: { en: 'TSV viewer', ar: 'عارض TSV' }, category: 'data', group: 'view', inputFormats: ['.tsv', '.tab'], relatedPages: ['/csv-viewer', '/large-csv-viewer', '/excel-viewer', '/csv-to-excel', '/csv-opens-in-one-column'], isLive: true },
  { slug: 'json-viewer', name: { en: 'JSON viewer', ar: 'عارض JSON' }, category: 'data', group: 'view', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-validator', '/json-escape-unescape', '/json-to-csv', '/mask-data', '/csv-viewer', '/open-json-file', '/anonymize-data-before-sharing'], isLive: true },
  { slug: 'json-formatter', name: { en: 'JSON formatter', ar: 'تنسيق JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-validator', '/json-viewer', '/json-escape-unescape', '/json-unexpected-token', '/open-json-file'], isLive: true },
  { slug: 'json-validator', name: { en: 'JSON validator', ar: 'التحقق من JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-viewer', '/json-unexpected-token'], isLive: true },
  { slug: 'json-escape-unescape', name: { en: 'JSON escape / unescape', ar: 'تهريب JSON وفكه' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-validator', '/json-viewer', '/json-unexpected-token'], isLive: true },
  { slug: 'mask-data', name: { en: 'Mask sensitive data', ar: 'إخفاء البيانات الحساسة' }, category: 'data', group: 'clean', inputFormats: ['.csv', '.json', '.xlsx', '.txt'], relatedPages: ['/anonymize-data-before-sharing', '/csv-viewer', '/excel-viewer', '/json-viewer', '/check-file-upload'], isLive: true },
  { slug: 'csv-to-excel', name: { en: 'CSV to Excel', ar: 'تحويل CSV إلى Excel' }, category: 'data', group: 'convert', inputFormats: ['.csv'], relatedPages: ['/csv-to-json', '/csv-viewer', '/csv-too-big-for-excel'], isLive: true },
  { slug: 'csv-to-json', name: { en: 'CSV to JSON', ar: 'تحويل CSV إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.csv'], relatedPages: ['/csv-to-excel', '/json-to-csv', '/csv-viewer', '/csv-vs-excel-vs-json'], isLive: true },
  { slug: 'json-to-csv', name: { en: 'JSON to CSV', ar: 'تحويل JSON إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.json'], relatedPages: ['/csv-to-json', '/json-viewer', '/json-validator', '/csv-vs-excel-vs-json'], isLive: true },
  { slug: 'excel-to-csv', name: { en: 'Excel to CSV', ar: 'تحويل Excel إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.xlsx', '.xls'], relatedPages: ['/excel-to-json', '/excel-viewer', '/fix-arabic-csv-in-excel', '/csv-vs-excel-vs-json'], isLive: true },
  { slug: 'excel-to-json', name: { en: 'Excel to JSON', ar: 'تحويل Excel إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.xlsx', '.xls'], relatedPages: ['/excel-to-csv', '/excel-viewer', '/json-viewer'], isLive: true },
  // Office
  { slug: 'excel-viewer', name: { en: 'Excel viewer', ar: 'عارض Excel' }, category: 'office', group: 'view', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], relatedPages: ['/xls-viewer', '/csv-viewer', '/excel-to-csv', '/excel-to-json', '/mask-data', '/open-xlsx-without-excel', '/anonymize-data-before-sharing'], isLive: true },
  { slug: 'xls-viewer', name: { en: 'XLS viewer', ar: 'عارض XLS' }, category: 'office', group: 'view', inputFormats: ['.xls'], relatedPages: ['/excel-viewer', '/csv-viewer', '/excel-to-csv', '/open-xlsx-without-excel'], isLive: true },
  { slug: 'word-viewer', name: { en: 'Word viewer', ar: 'عارض Word' }, category: 'office', group: 'view', inputFormats: ['.docx', '.dotx', '.docm', '.odt'], relatedPages: ['/open-docx-without-word', '/powerpoint-viewer', '/txt-viewer', '/csv-viewer', '/check-file-upload'], isLive: true },
  { slug: 'powerpoint-viewer', name: { en: 'PowerPoint viewer (beta)', ar: 'عارض PowerPoint (تجريبي)' }, category: 'office', group: 'view', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], relatedPages: ['/word-viewer', '/excel-viewer', '/check-file-upload'], isLive: true },
  { slug: 'txt-viewer', name: { en: 'TXT editor', ar: 'محرر TXT' }, category: 'office', group: 'view', inputFormats: ['.txt'], relatedPages: ['/csv-viewer', '/json-viewer', '/word-viewer'], isLive: true },
]

// The words of each live tool drawn by ToolPage, by language and slug.
// Each live tool's words, one file per language, fetched for the page shown. Vite turns each into its own chunk; the Node build
// scripts read the files from disk instead (the browser would refuse a `with { type: 'json' }` import of Vite's dev-server JSON).
export const toolContentLoaders: Record<Locale, Record<string, () => Promise<{ default: unknown }>>> = {
  en: {
    'csv-viewer': () => import('../content/tools/csv-viewer.en.json'),
    'large-csv-viewer': () => import('../content/tools/large-csv-viewer.en.json'),
    'tsv-viewer': () => import('../content/tools/tsv-viewer.en.json'),
    'json-viewer': () => import('../content/tools/json-viewer.en.json'),
    'json-formatter': () => import('../content/tools/json-formatter.en.json'),
    'json-escape-unescape': () => import('../content/tools/json-escape-unescape.en.json'),
    'json-validator': () => import('../content/tools/json-validator.en.json'),
    'mask-data': () => import('../content/tools/mask-data.en.json'),
    'csv-to-excel': () => import('../content/tools/csv-to-excel.en.json'),
    'csv-to-json': () => import('../content/tools/csv-to-json.en.json'),
    'json-to-csv': () => import('../content/tools/json-to-csv.en.json'),
    'excel-to-csv': () => import('../content/tools/excel-to-csv.en.json'),
    'excel-to-json': () => import('../content/tools/excel-to-json.en.json'),
    'excel-viewer': () => import('../content/tools/excel-viewer.en.json'),
    'xls-viewer': () => import('../content/tools/xls-viewer.en.json'),
    'word-viewer': () => import('../content/tools/word-viewer.en.json'),
    'powerpoint-viewer': () => import('../content/tools/powerpoint-viewer.en.json'),
    'txt-viewer': () => import('../content/tools/txt-viewer.en.json'),
    'pdf-viewer': () => import('../content/tools/pdf-viewer.en.json'),
    'merge-pdf': () => import('../content/tools/merge-pdf.en.json'),
    'add-page-numbers': () => import('../content/tools/add-page-numbers.en.json'),
    'split-pdf': () => import('../content/tools/split-pdf.en.json'),
    'remove-pdf-pages': () => import('../content/tools/remove-pdf-pages.en.json'),
    'extract-pdf-pages': () => import('../content/tools/extract-pdf-pages.en.json'),
    'organize-pdf': () => import('../content/tools/organize-pdf.en.json'),
    'rotate-pdf': () => import('../content/tools/rotate-pdf.en.json'),
    'jpg-to-pdf': () => import('../content/tools/jpg-to-pdf.en.json'),
    'pdf-to-jpg': () => import('../content/tools/pdf-to-jpg.en.json'),
    'pdf-to-text': () => import('../content/tools/pdf-to-text.en.json'),
    'extract-pdf-images': () => import('../content/tools/extract-pdf-images.en.json'),
    'edit-pdf': () => import('../content/tools/edit-pdf.en.json'),
    'sign-pdf': () => import('../content/tools/sign-pdf.en.json'),
    'fill-pdf': () => import('../content/tools/fill-pdf.en.json'),
    'watermark-pdf': () => import('../content/tools/watermark-pdf.en.json'),
    'header-footer-pdf': () => import('../content/tools/header-footer-pdf.en.json'),
    'image-viewer': () => import('../content/tools/image-viewer.en.json'),
    'compress-image': () => import('../content/tools/compress-image.en.json'),
    'resize-image': () => import('../content/tools/resize-image.en.json'),
    'crop-image': () => import('../content/tools/crop-image.en.json'),
    'rotate-image': () => import('../content/tools/rotate-image.en.json'),
    'watermark-image': () => import('../content/tools/watermark-image.en.json'),
    'remove-image-metadata': () => import('../content/tools/remove-image-metadata.en.json'),
    'photo-editor': () => import('../content/tools/photo-editor.en.json'),
    'convert-image': () => import('../content/tools/convert-image.en.json'),
    'heic-to-jpg': () => import('../content/tools/heic-to-jpg.en.json'),
    'webp-to-jpg': () => import('../content/tools/webp-to-jpg.en.json'),
    'png-to-jpg': () => import('../content/tools/png-to-jpg.en.json'),
    'jpg-to-png': () => import('../content/tools/jpg-to-png.en.json'),
    'svg-to-png': () => import('../content/tools/svg-to-png.en.json'),
    'image-to-webp': () => import('../content/tools/image-to-webp.en.json'),
    'meme-generator': () => import('../content/tools/meme-generator.en.json'),
  },
  ar: {
    'csv-viewer': () => import('../content/tools/csv-viewer.ar.json'),
    'large-csv-viewer': () => import('../content/tools/large-csv-viewer.ar.json'),
    'tsv-viewer': () => import('../content/tools/tsv-viewer.ar.json'),
    'json-viewer': () => import('../content/tools/json-viewer.ar.json'),
    'json-formatter': () => import('../content/tools/json-formatter.ar.json'),
    'json-escape-unescape': () => import('../content/tools/json-escape-unescape.ar.json'),
    'json-validator': () => import('../content/tools/json-validator.ar.json'),
    'mask-data': () => import('../content/tools/mask-data.ar.json'),
    'csv-to-excel': () => import('../content/tools/csv-to-excel.ar.json'),
    'csv-to-json': () => import('../content/tools/csv-to-json.ar.json'),
    'json-to-csv': () => import('../content/tools/json-to-csv.ar.json'),
    'excel-to-csv': () => import('../content/tools/excel-to-csv.ar.json'),
    'excel-to-json': () => import('../content/tools/excel-to-json.ar.json'),
    'excel-viewer': () => import('../content/tools/excel-viewer.ar.json'),
    'xls-viewer': () => import('../content/tools/xls-viewer.ar.json'),
    'word-viewer': () => import('../content/tools/word-viewer.ar.json'),
    'powerpoint-viewer': () => import('../content/tools/powerpoint-viewer.ar.json'),
    'txt-viewer': () => import('../content/tools/txt-viewer.ar.json'),
    'pdf-viewer': () => import('../content/tools/pdf-viewer.ar.json'),
    'merge-pdf': () => import('../content/tools/merge-pdf.ar.json'),
    'add-page-numbers': () => import('../content/tools/add-page-numbers.ar.json'),
    'split-pdf': () => import('../content/tools/split-pdf.ar.json'),
    'remove-pdf-pages': () => import('../content/tools/remove-pdf-pages.ar.json'),
    'extract-pdf-pages': () => import('../content/tools/extract-pdf-pages.ar.json'),
    'organize-pdf': () => import('../content/tools/organize-pdf.ar.json'),
    'rotate-pdf': () => import('../content/tools/rotate-pdf.ar.json'),
    'jpg-to-pdf': () => import('../content/tools/jpg-to-pdf.ar.json'),
    'pdf-to-jpg': () => import('../content/tools/pdf-to-jpg.ar.json'),
    'pdf-to-text': () => import('../content/tools/pdf-to-text.ar.json'),
    'extract-pdf-images': () => import('../content/tools/extract-pdf-images.ar.json'),
    'edit-pdf': () => import('../content/tools/edit-pdf.ar.json'),
    'sign-pdf': () => import('../content/tools/sign-pdf.ar.json'),
    'fill-pdf': () => import('../content/tools/fill-pdf.ar.json'),
    'watermark-pdf': () => import('../content/tools/watermark-pdf.ar.json'),
    'header-footer-pdf': () => import('../content/tools/header-footer-pdf.ar.json'),
    'image-viewer': () => import('../content/tools/image-viewer.ar.json'),
    'compress-image': () => import('../content/tools/compress-image.ar.json'),
    'resize-image': () => import('../content/tools/resize-image.ar.json'),
    'crop-image': () => import('../content/tools/crop-image.ar.json'),
    'rotate-image': () => import('../content/tools/rotate-image.ar.json'),
    'watermark-image': () => import('../content/tools/watermark-image.ar.json'),
    'remove-image-metadata': () => import('../content/tools/remove-image-metadata.ar.json'),
    'photo-editor': () => import('../content/tools/photo-editor.ar.json'),
    'convert-image': () => import('../content/tools/convert-image.ar.json'),
    'heic-to-jpg': () => import('../content/tools/heic-to-jpg.ar.json'),
    'webp-to-jpg': () => import('../content/tools/webp-to-jpg.ar.json'),
    'png-to-jpg': () => import('../content/tools/png-to-jpg.ar.json'),
    'jpg-to-png': () => import('../content/tools/jpg-to-png.ar.json'),
    'svg-to-png': () => import('../content/tools/svg-to-png.ar.json'),
    'image-to-webp': () => import('../content/tools/image-to-webp.ar.json'),
    'meme-generator': () => import('../content/tools/meme-generator.ar.json'),
  },
}
// The words fetched so far, by language and slug.
export const toolContent: Record<Locale, Record<string, ToolContent>> = { en: {}, ar: {} }

// A hub page per category, with its task groups in the order shown. `guides`: the guides that help with that category's files.
// `relatedTools`: tools of another category the hub also links (the image hub's JPG to PDF and PDF to JPG).
export type Hub = { category: ToolCategory; path: string; groups: string[]; guides: string[]; relatedTools?: string[] }

export const hubs: Hub[] = [
  { category: 'pdf', path: '/pdf-tools', groups: ['view', 'organize', 'optimize', 'convertTo', 'convertFrom', 'edit', 'security', 'intelligence'], guides: ['/check-file-upload'] },
  { category: 'image', path: '/image-tools', groups: ['view', 'optimize', 'edit', 'convert', 'create'], guides: ['/check-file-upload'], relatedTools: ['jpg-to-pdf', 'pdf-to-jpg'] },
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
const iconByExtension: Record<string, string> = { '.pdf': 'pdf', '.csv': 'csv', '.tsv': 'csv', '.json': 'json', '.xlsx': 'xlsx', '.xls': 'xlsx', '.docx': 'docx', '.dotx': 'docx', '.docm': 'docx', '.odt': 'docx', '.pptx': 'pptx', '.ppsx': 'pptx', '.potx': 'pptx', '.pptm': 'pptx', '.txt': 'txt', '.jpg': 'convert', '.jpeg': 'convert', '.png': 'convert', '.webp': 'convert', '.heic': 'convert', '.heif': 'convert', '.tif': 'convert', '.tiff': 'convert', '.svg': 'convert' }
export function findToolIcon(tool: Tool) {
  if (tool.slug === 'mask-data') return 'mask'
  if (tool.category === 'image') return 'image'
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
export const popularToolSlugs = ['csv-viewer', 'excel-viewer', 'merge-pdf', 'edit-pdf', 'json-formatter', 'sign-pdf', 'word-viewer', 'mask-data']
