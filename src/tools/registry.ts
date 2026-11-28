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
  // Opens a file on another page of the site, in memory (the XML viewer's "Open as JSON" goes to /xml-to-json).
  onOpenInPage?: (file: File, path: string) => void
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
  // Works on typed or pasted text (Base64, JWT, XML viewer): the tool is drawn at once, before any file; a file fills its text box.
  takesText?: boolean
  // Needs no file at all (the test data generator): the page has no drop zone or samples.
  needsNoFile?: boolean
  // The result card shows the chosen file's size beside the result's (Compress PDF).
  showsSizeChange?: boolean
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
  // `image` names a page's own picture (public/screenshots/<locale>-<image>.webp) instead of its viewer's.
  screenshot?: { alt: string; caption: string; image?: string }
  comparison?: ComparisonTable
  limits: string[]
  // Office conversion pages: what converts well and what may be lost, drawn with a link to report a file that converted badly.
  worksBest?: string[]
  mayNotKeep?: string[]
  faqTitle?: string
  faq: ToolQuestion[]
}

const PDF = ['.pdf']
// The table files the data tools read: CSV-like text and Excel workbooks (an Excel file's first sheet, read as the sheet shows it).
const CSV_FILES = ['.csv', '.tsv']
const EXCEL_FILES = ['.xlsx', '.xls', '.xlsm', '.ods']
// The pictures JPG to PDF takes; HEIC only opens where the browser can read it (Safari).
const IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.svg']
// What Base64 encodes: any of these files (its bytes), or a text file's text.
const TEXT_TOOL_FILES = ['.txt', '.json', '.xml', '.csv', '.yaml', '.yml', '.html', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.zip', '.bin']
// Every video the video tools read (what plays depends on the browser: the page says so when a codec can't be read), and the
// sound files Add audio to video takes.
const VIDEO_FILES = ['.mp4', '.mov', '.webm', '.mkv', '.m4v', '.3gp']
const AUDIO_FILES = ['.mp3', '.m4a', '.wav', '.ogg', '.aac']
// Every picture the image tools read.
const IMAGE_FILES = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.heic', '.heif', '.tif', '.tiff', '.svg']

export const tools: Tool[] = [
  // PDF
  { slug: 'pdf-viewer', name: { en: 'PDF viewer', ar: 'عارض PDF' }, category: 'pdf', group: 'view', inputFormats: PDF, nextTools: ['edit-pdf', 'sign-pdf', 'merge-pdf', 'pdf-to-jpg'], relatedPages: ['/fix-arabic-text-copied-from-pdf', '/open-pdf-without-adobe', '/edit-pdf', '/sign-pdf', '/merge-pdf', '/split-pdf', '/pdf-to-jpg', '/pdf-to-text', '/jpg-to-pdf', '/extract-pdf-images', '/check-file-upload', '/repair-pdf', '/rotate-pdf', '/unlock-pdf', '/compare-pdf', '/crop-pdf'], isLive: true },
  { slug: 'merge-pdf', name: { en: 'Merge PDF', ar: 'دمج PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/MergePdf'), nextTools: ['split-pdf', 'organize-pdf', 'add-page-numbers', 'pdf-to-jpg'], relatedPages: ['/how-to-merge-pdf-files', '/split-pdf', '/organize-pdf', '/jpg-to-pdf', '/add-page-numbers', '/pdf-tools-without-upload', '/compress-pdf'], isLive: true },
  { slug: 'split-pdf', name: { en: 'Split PDF', ar: 'تقسيم PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.SplitPdf })), nextTools: ['merge-pdf', 'extract-pdf-pages', 'remove-pdf-pages', 'pdf-to-jpg'], relatedPages: ['/how-to-split-a-pdf', '/extract-pdf-pages', '/remove-pdf-pages', '/merge-pdf', '/organize-pdf', '/pdf-to-jpg'], isLive: true },
  { slug: 'remove-pdf-pages', name: { en: 'Remove PDF pages', ar: 'حذف صفحات PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.RemovePdfPages })), nextTools: ['organize-pdf', 'rotate-pdf', 'merge-pdf', 'add-page-numbers'], isLive: true },
  { slug: 'extract-pdf-pages', name: { en: 'Extract PDF pages', ar: 'استخراج صفحات PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.ExtractPdfPages })), nextTools: ['merge-pdf', 'rotate-pdf', 'pdf-to-jpg', 'split-pdf'], isLive: true },
  { slug: 'organize-pdf', name: { en: 'Organize PDF', ar: 'ترتيب صفحات PDF' }, category: 'pdf', group: 'organize', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/OrganizePdf'), nextTools: ['merge-pdf', 'add-page-numbers', 'pdf-to-jpg', 'split-pdf'], isLive: true },
  { slug: 'scan-to-pdf', name: { en: 'Scan to PDF', ar: 'مسح ضوئي إلى PDF' }, category: 'pdf', group: 'organize', inputFormats: IMAGES, takesSeveralFiles: true, loadComponent: () => import('./pdf/ScanToPdf'), nextTools: ['merge-pdf', 'organize-pdf', 'add-page-numbers', 'sign-pdf'], relatedPages: ['/jpg-to-pdf', '/merge-pdf', '/organize-pdf', '/sign-pdf', '/heic-to-jpg', '/check-file-upload', '/image-to-text'], isLive: true },
  { slug: 'rotate-pdf', name: { en: 'Rotate PDF', ar: 'تدوير PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.RotatePdf })), nextTools: ['organize-pdf', 'merge-pdf', 'add-page-numbers', 'pdf-to-jpg'], isLive: true },
  { slug: 'crop-pdf', name: { en: 'Crop PDF', ar: 'قص PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.CropPdf })), nextTools: ['rotate-pdf', 'merge-pdf', 'add-page-numbers', 'pdf-to-jpg'], isLive: true },
  { slug: 'ocr-pdf', name: { en: 'OCR PDF', ar: 'التعرّف الضوئي على نص PDF' }, category: 'pdf', group: 'optimize', inputFormats: PDF, loadComponent: () => import('./pdf/OcrPdf'), nextTools: ['pdf-to-text', 'pdf-to-word', 'merge-pdf', 'compress-pdf'], relatedPages: ['/make-scanned-pdf-searchable', '/fix-arabic-text-copied-from-pdf', '/pdf-to-text', '/pdf-to-word', '/scan-to-pdf', '/pdf-viewer', '/check-file-upload', '/translate-pdf', '/image-to-text'], isLive: true },
  { slug: 'compress-pdf', name: { en: 'Compress PDF', ar: 'ضغط PDF' }, category: 'pdf', group: 'optimize', inputFormats: PDF, showsSizeChange: true, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.CompressPdf })), nextTools: ['merge-pdf', 'protect-pdf', 'pdf-to-jpg'], relatedPages: ['/pdf-to-grayscale', '/remove-pdf-metadata', '/compress-image', '/merge-pdf', '/repair-pdf', '/check-file-upload'], isLive: true },
  { slug: 'pdf-to-grayscale', name: { en: 'PDF to grayscale (beta)', ar: 'تحويل PDF إلى تدرج رمادي (تجريبي)' }, category: 'pdf', group: 'optimize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.PdfToGrayscale })), nextTools: ['compress-pdf', 'merge-pdf', 'protect-pdf'], relatedPages: ['/compress-pdf', '/pdf-to-jpg', '/redact-pdf', '/merge-pdf', '/pdf-viewer', '/check-file-upload'], isLive: true },
  { slug: 'repair-pdf', name: { en: 'Repair PDF', ar: 'إصلاح PDF' }, category: 'pdf', group: 'optimize', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.RepairPdf })), nextTools: ['merge-pdf', 'split-pdf', 'pdf-to-text', 'pdf-to-jpg'], relatedPages: ['/open-pdf-without-adobe', '/pdf-viewer', '/pdf-to-text', '/pdf-to-jpg', '/merge-pdf', '/split-pdf', '/check-file-upload'], isLive: true },
  { slug: 'jpg-to-pdf', name: { en: 'JPG to PDF', ar: 'تحويل JPG إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: IMAGES, takesSeveralFiles: true, loadComponent: () => import('./pdf/ImagesToPdf'), nextTools: ['merge-pdf', 'organize-pdf', 'rotate-pdf', 'add-page-numbers'], relatedPages: ['/photos-to-one-pdf', '/scan-to-pdf', '/merge-pdf', '/compress-image', '/heic-to-jpg', '/pdf-to-jpg', '/images-to-pptx'], isLive: true },
  { slug: 'word-to-pdf', name: { en: 'Word to PDF', ar: 'تحويل Word إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.docx', '.dotx', '.docm', '.odt'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.WordToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'sign-pdf'], relatedPages: ['/word-viewer', '/pdf-to-word', '/merge-pdf', '/protect-pdf', '/open-docx-without-word', '/check-file-upload', '/excel-to-pdf', '/word-to-jpg', '/pptx-to-pdf', '/markdown-to-pdf'], isLive: true },
  { slug: 'excel-to-pdf', name: { en: 'Excel to PDF', ar: 'تحويل Excel إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.ExcelToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'watermark-pdf'], relatedPages: ['/excel-viewer', '/pdf-to-excel', '/merge-pdf', '/open-xlsx-without-excel', '/check-file-upload', '/excel-to-jpg', '/csv-to-pdf', '/excel-to-word'], isLive: true },
  { slug: 'pptx-to-pdf', name: { en: 'PowerPoint to PDF', ar: 'تحويل PowerPoint إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.PptxToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'pdf-to-jpg'], relatedPages: ['/powerpoint-viewer', '/pptx-to-jpg', '/pptx-to-video', '/pdf-to-powerpoint', '/open-pptx-without-powerpoint', '/word-to-pdf', '/check-file-upload', '/pptm-to-pptx'], isLive: true },
  { slug: 'markdown-to-pdf', name: { en: 'Markdown to PDF', ar: 'تحويل Markdown إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.md', '.markdown', '.txt'], takesText: true, loadComponent: () => import('./office/TextToDocument').then((tools) => ({ default: tools.MarkdownToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'sign-pdf'], relatedPages: ['/markdown-to-word', '/text-to-pdf', '/html-to-pdf', '/pdf-to-markdown', '/word-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'text-to-pdf', name: { en: 'Text to PDF', ar: 'تحويل النص إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.txt'], takesText: true, loadComponent: () => import('./office/TextToDocument').then((tools) => ({ default: tools.TextToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'sign-pdf'], relatedPages: ['/text-to-word', '/markdown-to-pdf', '/txt-viewer', '/pdf-to-text', '/open-txt-file', '/check-file-upload'], isLive: true },
  { slug: 'csv-to-pdf', name: { en: 'CSV to PDF', ar: 'تحويل CSV إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.csv', '.tsv'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.CsvToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'watermark-pdf'], relatedPages: ['/csv-viewer', '/excel-to-pdf', '/csv-to-excel', '/csv-to-html', '/open-csv-without-excel', '/check-file-upload'], isLive: true },
  { slug: 'html-to-pdf', name: { en: 'HTML to PDF', ar: 'تحويل HTML إلى PDF' }, category: 'pdf', group: 'convertTo', inputFormats: ['.html', '.htm'], takesText: true, loadComponent: () => import('./office/TextToDocument').then((tools) => ({ default: tools.HtmlToPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'protect-pdf', 'sign-pdf'], relatedPages: ['/html-to-word', '/markdown-to-pdf', '/text-to-pdf', '/html-table-to-csv', '/word-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'pdf-to-jpg', name: { en: 'PDF to JPG', ar: 'تحويل PDF إلى JPG' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.PdfToImages })), nextTools: ['jpg-to-pdf', 'pdf-to-text', 'extract-pdf-images', 'split-pdf'], relatedPages: ['/pdf-to-grayscale'], isLive: true },
  { slug: 'pdf-to-text', name: { en: 'PDF to text', ar: 'تحويل PDF إلى نص' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.PdfToText })), nextTools: ['pdf-to-jpg', 'extract-pdf-images', 'split-pdf', 'merge-pdf'], relatedPages: ['/fix-arabic-text-copied-from-pdf', '/ocr-pdf', '/pdf-to-word', '/pdf-to-markdown', '/pdf-viewer', '/check-file-upload'], isLive: true },
  { slug: 'pdf-to-word', name: { en: 'PDF to Word', ar: 'تحويل PDF إلى Word' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfToOffice').then((tools) => ({ default: tools.PdfToWord })), nextTools: ['pdf-to-text', 'pdf-to-excel', 'pdf-to-powerpoint'], relatedPages: ['/fix-arabic-text-copied-from-pdf', '/cant-edit-text-in-pdf', '/pdf-to-excel', '/pdf-to-powerpoint', '/pdf-to-text', '/word-viewer', '/check-file-upload', '/translate-pdf'], isLive: true },
  { slug: 'pdf-to-excel', name: { en: 'PDF to Excel', ar: 'تحويل PDF إلى Excel' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfToOffice').then((tools) => ({ default: tools.PdfToExcel })), nextTools: ['pdf-to-word', 'pdf-to-text', 'pdf-to-powerpoint'], relatedPages: ['/pdf-to-word', '/pdf-to-powerpoint', '/excel-viewer', '/excel-to-csv', '/check-file-upload'], isLive: true },
  { slug: 'pdf-to-powerpoint', name: { en: 'PDF to PowerPoint', ar: 'تحويل PDF إلى PowerPoint' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfToOffice').then((tools) => ({ default: tools.PdfToPowerPoint })), nextTools: ['pdf-to-word', 'pdf-to-jpg', 'pdf-to-excel'], relatedPages: ['/pdf-to-word', '/pdf-to-excel', '/pdf-to-jpg', '/powerpoint-viewer', '/check-file-upload', '/images-to-pptx', '/pptx-to-pdf'], isLive: true },
  { slug: 'pdf-to-markdown', name: { en: 'PDF to Markdown', ar: 'تحويل PDF إلى Markdown' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.PdfToMarkdown })), nextTools: ['pdf-to-text', 'extract-pdf-images', 'split-pdf'], relatedPages: ['/pdf-to-ai-chat-with-tables', '/pdf-to-text', '/extract-pdf-images', '/pdf-to-jpg', '/pdf-viewer', '/check-file-upload', '/pptx-to-markdown', '/markdown-to-pdf'], isLive: true },
  { slug: 'extract-pdf-images', name: { en: 'Extract images from PDF', ar: 'استخراج الصور من PDF' }, category: 'pdf', group: 'convertFrom', inputFormats: PDF, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.ExtractPdfImages })), nextTools: ['pdf-to-jpg', 'pdf-to-text', 'split-pdf', 'merge-pdf'], isLive: true },
  { slug: 'add-page-numbers', name: { en: 'Add page numbers', ar: 'ترقيم الصفحات' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/AddPageNumbers'), nextTools: ['header-footer-pdf', 'watermark-pdf', 'sign-pdf', 'merge-pdf'], isLive: true },
  { slug: 'edit-pdf', name: { en: 'Edit PDF', ar: 'تعديل PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.EditPdf })), nextTools: ['sign-pdf', 'watermark-pdf', 'organize-pdf', 'pdf-to-jpg'], relatedPages: ['/cant-edit-text-in-pdf', '/sign-pdf', '/fill-pdf', '/watermark-pdf', '/header-footer-pdf', '/organize-pdf', '/pdf-viewer', '/pdf-forms', '/crop-pdf', '/rotate-pdf'], isLive: true },
  { slug: 'fill-pdf', name: { en: 'Fill PDF form', ar: 'تعبئة نموذج PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.FillPdf })), nextTools: ['sign-pdf', 'merge-pdf', 'add-page-numbers', 'pdf-to-jpg'], relatedPages: ['/fill-pdf-form-without-acrobat', '/sign-pdf', '/edit-pdf', '/merge-pdf', '/pdf-viewer', '/pdf-to-text', '/check-file-upload', '/pdf-forms', '/flatten-pdf'], isLive: true },
  { slug: 'flatten-pdf', name: { en: 'Flatten PDF (beta)', ar: 'تسطيح PDF (تجريبي)' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.FlattenPdf })), nextTools: ['protect-pdf', 'merge-pdf', 'compress-pdf'], relatedPages: ['/fill-pdf', '/pdf-forms', '/sign-pdf', '/edit-pdf', '/remove-pdf-metadata', '/check-file-upload'], isLive: true },
  { slug: 'pdf-forms', name: { en: 'PDF Forms', ar: 'إنشاء نماذج PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.CreatePdfForm })), nextTools: ['fill-pdf', 'sign-pdf', 'merge-pdf', 'add-page-numbers'], relatedPages: ['/fill-pdf-form-without-acrobat', '/fill-pdf', '/sign-pdf', '/edit-pdf', '/merge-pdf', '/scan-to-pdf', '/check-file-upload', '/flatten-pdf'], isLive: true },
  { slug: 'watermark-pdf', name: { en: 'Watermark PDF', ar: 'علامة مائية على PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfStampTools').then((tools) => ({ default: tools.WatermarkPdf })), nextTools: ['sign-pdf', 'header-footer-pdf', 'add-page-numbers', 'merge-pdf'], relatedPages: ['/header-footer-pdf', '/add-page-numbers', '/sign-pdf', '/edit-pdf', '/merge-pdf', '/pdf-to-jpg'], isLive: true },
  { slug: 'header-footer-pdf', name: { en: 'Header and footer', ar: 'رأس وتذييل PDF' }, category: 'pdf', group: 'edit', inputFormats: PDF, loadComponent: () => import('./pdf/PdfStampTools').then((tools) => ({ default: tools.HeaderFooterPdf })), nextTools: ['watermark-pdf', 'sign-pdf', 'merge-pdf', 'pdf-to-jpg'], relatedPages: ['/add-page-numbers', '/watermark-pdf', '/edit-pdf', '/sign-pdf', '/merge-pdf', '/organize-pdf'], isLive: true },
  { slug: 'sign-pdf', name: { en: 'Sign PDF', ar: 'توقيع PDF' }, category: 'pdf', group: 'security', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.SignPdf })), nextTools: ['merge-pdf', 'add-page-numbers', 'pdf-to-jpg', 'watermark-pdf'], relatedPages: ['/sign-pdf-without-adobe', '/fill-pdf', '/edit-pdf', '/merge-pdf', '/add-page-numbers', '/watermark-pdf', '/pdf-tools-without-upload'], isLive: true },
  { slug: 'redact-pdf', name: { en: 'Redact PDF', ar: 'تنقيح PDF' }, category: 'pdf', group: 'security', inputFormats: PDF, isEditor: true, loadComponent: () => import('./pdf/PdfEditTools').then((tools) => ({ default: tools.RedactPdf })), nextTools: ['sign-pdf', 'merge-pdf', 'watermark-pdf', 'compare-pdf'], relatedPages: ['/edit-pdf', '/sign-pdf', '/compare-pdf', '/mask-data', '/anonymize-data-before-sharing', '/check-file-upload', '/remove-pdf-metadata'], isLive: true },
  { slug: 'compare-pdf', name: { en: 'Compare PDF', ar: 'مقارنة ملفات PDF' }, category: 'pdf', group: 'security', inputFormats: PDF, takesSeveralFiles: true, loadComponent: () => import('./pdf/PdfExtractTools').then((tools) => ({ default: tools.ComparePdf })), relatedPages: ['/pdf-to-text', '/pdf-viewer', '/redact-pdf', '/edit-pdf', '/check-file-upload'], isLive: true },
  { slug: 'protect-pdf', name: { en: 'Protect PDF', ar: 'حماية PDF بكلمة مرور' }, category: 'pdf', group: 'security', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.ProtectPdf })), nextTools: ['merge-pdf', 'sign-pdf', 'watermark-pdf'], relatedPages: ['/password-protect-pdf-free', '/unlock-pdf', '/redact-pdf', '/watermark-pdf', '/sign-pdf', '/check-file-upload', '/remove-pdf-metadata', '/compress-pdf'], isLive: true },
  { slug: 'remove-pdf-metadata', name: { en: 'Remove PDF metadata', ar: 'إزالة بيانات PDF الوصفية' }, category: 'pdf', group: 'security', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.RemovePdfMetadata })), nextTools: ['protect-pdf', 'redact-pdf', 'compress-pdf'], relatedPages: ['/redact-pdf', '/protect-pdf', '/word-metadata', '/remove-image-metadata', '/flatten-pdf', '/check-file-upload'], isLive: true },
  { slug: 'unlock-pdf', name: { en: 'Unlock PDF', ar: 'فتح قفل PDF' }, category: 'pdf', group: 'security', inputFormats: PDF, loadComponent: () => import('./pdf/PdfPageTools').then((tools) => ({ default: tools.UnlockPdf })), nextTools: ['merge-pdf', 'split-pdf', 'pdf-to-text', 'edit-pdf'], relatedPages: ['/open-pdf-without-adobe', '/protect-pdf', '/merge-pdf', '/pdf-to-text', '/pdf-viewer', '/check-file-upload', '/repair-pdf'], isLive: true },
  { slug: 'translate-pdf', name: { en: 'Translate PDF', ar: 'ترجمة PDF' }, category: 'pdf', group: 'intelligence', inputFormats: PDF, loadComponent: () => import('./pdf/PdfToOffice').then((tools) => ({ default: tools.TranslatePdf })), nextTools: ['pdf-to-word', 'pdf-to-text', 'ocr-pdf'], relatedPages: ['/pdf-to-word', '/ocr-pdf', '/pdf-to-text', '/word-viewer', '/check-file-upload', '/translate-document'], isLive: true },
  // Images (Step 17S)
  { slug: 'image-viewer', name: { en: 'Image viewer', ar: 'عارض الصور' }, category: 'image', group: 'view', inputFormats: IMAGE_FILES, nextTools: ['compress-image', 'resize-image', 'remove-image-metadata', 'jpg-to-pdf'], relatedPages: ['/compress-image', '/resize-image', '/remove-image-metadata', '/heic-to-jpg', '/jpg-to-pdf', '/check-file-upload', '/upscale-image', '/meme-generator', '/svg-to-png', '/remove-background', '/image-to-text'], isLive: true },
  { slug: 'compress-image', name: { en: 'Compress image', ar: 'ضغط الصور' }, category: 'image', group: 'optimize', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.CompressImage })), nextTools: ['resize-image', 'image-to-webp', 'remove-image-metadata', 'jpg-to-pdf'], relatedPages: ['/reduce-photo-file-size', '/resize-image', '/image-to-webp', '/convert-image', '/remove-image-metadata', '/jpg-to-pdf', '/check-file-upload', '/meme-generator', '/compress-video'], isLive: true },
  { slug: 'resize-image', name: { en: 'Resize image', ar: 'تغيير حجم الصورة' }, category: 'image', group: 'optimize', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.ResizeImage })), nextTools: ['compress-image', 'crop-image', 'convert-image', 'jpg-to-pdf'], relatedPages: ['/crop-image', '/compress-image', '/rotate-image', '/convert-image', '/jpg-to-pdf', '/upscale-image'], isLive: true },
  { slug: 'crop-image', name: { en: 'Crop image', ar: 'قص الصورة' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.CropImage })), nextTools: ['resize-image', 'compress-image', 'photo-editor', 'jpg-to-pdf'], relatedPages: ['/resize-image', '/rotate-image', '/photo-editor', '/compress-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'rotate-image', name: { en: 'Rotate image', ar: 'تدوير الصورة' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.RotateImage })), nextTools: ['crop-image', 'compress-image', 'jpg-to-pdf', 'resize-image'], relatedPages: ['/crop-image', '/resize-image', '/photo-editor', '/jpg-to-pdf'], isLive: true },
  { slug: 'watermark-image', name: { en: 'Watermark image', ar: 'علامة مائية على الصور' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.WatermarkImage })), nextTools: ['compress-image', 'resize-image', 'remove-image-metadata', 'jpg-to-pdf'], relatedPages: ['/remove-image-metadata', '/photo-editor', '/compress-image', '/watermark-pdf', '/jpg-to-pdf'], isLive: true },
  { slug: 'blur-face', name: { en: 'Blur faces', ar: 'تمويه الوجوه' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, loadComponent: () => import('./image/ImageAiTools').then((tools) => ({ default: tools.BlurFace })), nextTools: ['remove-image-metadata', 'compress-image', 'watermark-image', 'resize-image'], relatedPages: ['/remove-image-metadata', '/watermark-image', '/photo-editor', '/crop-image', '/blur-video-area', '/check-file-upload'], isLive: true },
  { slug: 'remove-background', name: { en: 'Remove background', ar: 'إزالة خلفية الصورة' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, loadComponent: () => import('./image/ImageAiTools').then((tools) => ({ default: tools.RemoveBackground })), nextTools: ['resize-image', 'compress-image', 'image-to-webp', 'crop-image'], relatedPages: ['/remove-background-without-upload', '/crop-image', '/resize-image', '/photo-editor', '/image-to-webp', '/check-file-upload'], isLive: true },
  { slug: 'upscale-image', name: { en: 'Upscale image (beta)', ar: 'تكبير الصورة بدقة (تجريبي)' }, category: 'image', group: 'optimize', inputFormats: IMAGE_FILES, loadComponent: () => import('./image/ImageAiTools').then((tools) => ({ default: tools.UpscaleImage })), nextTools: ['compress-image', 'crop-image', 'convert-image', 'remove-background'], relatedPages: ['/resize-image', '/compress-image', '/remove-background', '/photo-editor', '/check-file-upload'], isLive: true },
  { slug: 'image-to-text', name: { en: 'Image to text', ar: 'تحويل الصورة إلى نص' }, category: 'image', group: 'convert', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./pdf/OcrPdf').then((tools) => ({ default: tools.ImageToText })), nextTools: ['ocr-pdf', 'jpg-to-pdf', 'scan-to-pdf', 'compress-image'], relatedPages: ['/ocr-pdf', '/scan-to-pdf', '/jpg-to-pdf', '/pdf-to-text', '/image-viewer', '/check-file-upload'], isLive: true },
  { slug: 'remove-image-metadata', name: { en: 'Remove image metadata', ar: 'حذف بيانات الصور' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.RemoveImageMetadata })), nextTools: ['compress-image', 'watermark-image', 'image-viewer', 'jpg-to-pdf'], relatedPages: ['/remove-location-from-photo', '/image-viewer', '/compress-image', '/mask-data', '/check-file-upload', '/jpg-to-pdf', '/blur-face'], isLive: true },
  { slug: 'photo-editor', name: { en: 'Photo editor', ar: 'محرر الصور' }, category: 'image', group: 'edit', inputFormats: IMAGE_FILES, isEditor: true, loadComponent: () => import('./image/ImageEditors').then((tools) => ({ default: tools.PhotoEditor })), nextTools: ['compress-image', 'resize-image', 'meme-generator', 'jpg-to-pdf'], relatedPages: ['/crop-image', '/meme-generator', '/watermark-image', '/compress-image', '/jpg-to-pdf', '/blur-face', '/remove-background'], isLive: true },
  { slug: 'convert-image', name: { en: 'Convert image', ar: 'تحويل الصور' }, category: 'image', group: 'convert', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.ConvertImage })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'image-viewer'], relatedPages: ['/heic-to-jpg', '/webp-to-jpg', '/png-to-jpg', '/jpg-to-png', '/svg-to-png', '/image-to-webp', '/jpg-to-pdf', '/pdf-to-jpg'], isLive: true },
  { slug: 'heic-to-jpg', name: { en: 'HEIC to JPG', ar: 'تحويل HEIC إلى JPG' }, category: 'image', group: 'convert', inputFormats: ['.heic', '.heif'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.HeicToJpg })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'remove-image-metadata'], relatedPages: ['/open-heic-on-windows', '/convert-image', '/remove-image-metadata', '/compress-image', '/jpg-to-pdf', '/image-viewer'], isLive: true },
  { slug: 'webp-to-jpg', name: { en: 'WebP to JPG', ar: 'تحويل WebP إلى JPG' }, category: 'image', group: 'convert', inputFormats: ['.webp'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.WebpToJpg })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'image-to-webp'], relatedPages: ['/convert-image', '/image-to-webp', '/png-to-jpg', '/jpg-to-pdf'], isLive: true },
  { slug: 'png-to-jpg', name: { en: 'PNG to JPG', ar: 'تحويل PNG إلى JPG' }, category: 'image', group: 'convert', inputFormats: ['.png'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.PngToJpg })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'jpg-to-png'], relatedPages: ['/convert-image', '/jpg-to-png', '/compress-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'jpg-to-png', name: { en: 'JPG to PNG', ar: 'تحويل JPG إلى PNG' }, category: 'image', group: 'convert', inputFormats: ['.jpg', '.jpeg'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.JpgToPng })), nextTools: ['compress-image', 'crop-image', 'png-to-jpg', 'jpg-to-pdf'], relatedPages: ['/convert-image', '/png-to-jpg', '/crop-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'svg-to-png', name: { en: 'SVG to PNG', ar: 'تحويل SVG إلى PNG' }, category: 'image', group: 'convert', inputFormats: ['.svg'], takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.SvgToPng })), nextTools: ['compress-image', 'resize-image', 'jpg-to-pdf', 'image-to-webp'], relatedPages: ['/convert-image', '/resize-image', '/image-to-webp', '/jpg-to-pdf'], isLive: true },
  { slug: 'image-to-webp', name: { en: 'Image to WebP', ar: 'تحويل الصور إلى WebP' }, category: 'image', group: 'convert', inputFormats: IMAGE_FILES, takesSeveralFiles: true, loadComponent: () => import('./image/ImageTools').then((tools) => ({ default: tools.ImageToWebp })), nextTools: ['compress-image', 'resize-image', 'webp-to-jpg', 'jpg-to-pdf'], relatedPages: ['/compress-image', '/webp-to-jpg', '/convert-image', '/jpg-to-pdf'], isLive: true },
  { slug: 'meme-generator', name: { en: 'Meme generator', ar: 'صانع الميمز' }, category: 'image', group: 'create', inputFormats: IMAGE_FILES, isEditor: true, loadComponent: () => import('./image/ImageEditors').then((tools) => ({ default: tools.MemeGenerator })), nextTools: ['compress-image', 'photo-editor', 'resize-image', 'jpg-to-pdf'], relatedPages: ['/photo-editor', '/watermark-image', '/crop-image', '/compress-image', '/video-to-gif'], isLive: true },
  // Video (Step 17X): one worker (src/tools/video/videoTools.worker.ts) for every tool, the recorders on the page.
  { slug: 'video-player', name: { en: 'Video player', ar: 'مشغل الفيديو' }, category: 'video', group: 'view', inputFormats: VIDEO_FILES, takesSeveralFiles: true, loadComponent: () => import('./video/VideoPlayer').then((tools) => ({ default: tools.VideoPlayer })), nextTools: ['compress-video', 'trim-video', 'video-converter', 'video-to-mp3'], relatedPages: ['/video-converter', '/compress-video', '/trim-video', '/video-to-mp3', '/video-to-gif', '/extract-video-frames', '/image-viewer', '/check-file-upload'], isLive: true },
  { slug: 'video-converter', name: { en: 'Video converter', ar: 'محول الفيديو' }, category: 'video', group: 'convert', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoConvert').then((tools) => ({ default: tools.VideoConverter })), nextTools: ['compress-video', 'trim-video', 'resize-video', 'video-to-mp3'], relatedPages: ['/mov-to-mp4', '/webm-to-mp4', '/mkv-to-mp4', '/video-to-mp3', '/video-to-gif', '/video-player', '/merge-videos'], isLive: true },
  { slug: 'mov-to-mp4', name: { en: 'MOV to MP4', ar: 'تحويل MOV إلى MP4' }, category: 'video', group: 'convert', inputFormats: ['.mov'], loadComponent: () => import('./video/VideoConvert').then((tools) => ({ default: tools.MovToMp4 })), nextTools: ['compress-video', 'trim-video', 'rotate-video', 'video-to-mp3'], relatedPages: ['/video-converter', '/webm-to-mp4', '/mkv-to-mp4', '/video-player', '/video-to-mp3', '/extract-video-frames'], isLive: true },
  { slug: 'webm-to-mp4', name: { en: 'WebM to MP4', ar: 'تحويل WebM إلى MP4' }, category: 'video', group: 'convert', inputFormats: ['.webm'], loadComponent: () => import('./video/VideoConvert').then((tools) => ({ default: tools.WebmToMp4 })), nextTools: ['trim-video', 'compress-video', 'crop-video', 'video-to-gif'], relatedPages: ['/video-converter', '/mov-to-mp4', '/mkv-to-mp4', '/screen-recorder', '/video-to-gif', '/blur-video-area'], isLive: true },
  { slug: 'mkv-to-mp4', name: { en: 'MKV to MP4', ar: 'تحويل MKV إلى MP4' }, category: 'video', group: 'convert', inputFormats: ['.mkv'], loadComponent: () => import('./video/VideoConvert').then((tools) => ({ default: tools.MkvToMp4 })), nextTools: ['trim-video', 'compress-video', 'merge-videos', 'video-to-mp3'], relatedPages: ['/video-converter', '/mov-to-mp4', '/webm-to-mp4', '/merge-videos', '/video-to-mp3', '/mute-video'], isLive: true },
  { slug: 'compress-video', name: { en: 'Compress video', ar: 'ضغط الفيديو' }, category: 'video', group: 'optimize', inputFormats: VIDEO_FILES, showsSizeChange: true, loadComponent: () => import('./video/VideoEditTools').then((tools) => ({ default: tools.CompressVideo })), nextTools: ['trim-video', 'resize-video', 'video-to-gif', 'video-converter'], relatedPages: ['/trim-video', '/resize-video', '/video-converter', '/video-to-gif', '/compress-image', '/check-file-upload', '/compress-video-without-upload'], isLive: true },
  { slug: 'resize-video', name: { en: 'Resize video', ar: 'تغيير حجم الفيديو' }, category: 'video', group: 'optimize', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoEditTools').then((tools) => ({ default: tools.ResizeVideo })), nextTools: ['compress-video', 'crop-video', 'trim-video', 'video-converter'], relatedPages: ['/compress-video', '/crop-video', '/video-converter', '/resize-image', '/trim-video', '/check-file-upload'], isLive: true },
  { slug: 'trim-video', name: { en: 'Trim video', ar: 'قص الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoEditTools').then((tools) => ({ default: tools.TrimVideo })), nextTools: ['compress-video', 'crop-video', 'video-to-gif', 'video-to-mp3'], relatedPages: ['/compress-video', '/crop-video', '/video-to-gif', '/merge-videos', '/video-to-mp3', '/check-file-upload'], isLive: true },
  { slug: 'crop-video', name: { en: 'Crop video', ar: 'اقتصاص الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoEditTools').then((tools) => ({ default: tools.CropVideo })), nextTools: ['resize-video', 'compress-video', 'trim-video', 'video-to-gif'], relatedPages: ['/resize-video', '/trim-video', '/rotate-video', '/compress-video', '/crop-image', '/check-file-upload'], isLive: true },
  { slug: 'rotate-video', name: { en: 'Rotate video', ar: 'تدوير الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoEditTools').then((tools) => ({ default: tools.RotateVideo })), nextTools: ['flip-video', 'crop-video', 'compress-video', 'trim-video'], relatedPages: ['/flip-video', '/crop-video', '/compress-video', '/rotate-image', '/video-converter', '/check-file-upload'], isLive: true },
  { slug: 'flip-video', name: { en: 'Flip video', ar: 'قلب الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoEditTools').then((tools) => ({ default: tools.FlipVideo })), nextTools: ['rotate-video', 'crop-video', 'compress-video', 'trim-video'], relatedPages: ['/rotate-video', '/crop-video', '/trim-video', '/rotate-image', '/check-file-upload'], isLive: true },
  { slug: 'merge-videos', name: { en: 'Merge videos', ar: 'دمج مقاطع الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, takesSeveralFiles: true, loadComponent: () => import('./video/VideoTimelineTools').then((tools) => ({ default: tools.MergeVideos })), nextTools: ['trim-video', 'compress-video', 'add-audio-to-video', 'video-to-gif'], relatedPages: ['/trim-video', '/loop-video', '/add-audio-to-video', '/compress-video', '/video-converter', '/resize-video'], isLive: true },
  { slug: 'loop-video', name: { en: 'Loop video', ar: 'تكرار الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoTimelineTools').then((tools) => ({ default: tools.LoopVideo })), nextTools: ['add-audio-to-video', 'compress-video', 'video-to-gif', 'trim-video'], relatedPages: ['/merge-videos', '/trim-video', '/video-to-gif', '/change-video-speed', '/add-audio-to-video', '/compress-video'], isLive: true },
  { slug: 'change-video-speed', name: { en: 'Change video speed', ar: 'تغيير سرعة الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoTimelineTools').then((tools) => ({ default: tools.ChangeVideoSpeed })), nextTools: ['mute-video', 'add-audio-to-video', 'compress-video', 'video-to-gif'], relatedPages: ['/trim-video', '/loop-video', '/mute-video', '/add-audio-to-video', '/video-to-gif', '/compress-video'], isLive: true },
  { slug: 'mute-video', name: { en: 'Mute video', ar: 'كتم صوت الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoTimelineTools').then((tools) => ({ default: tools.MuteVideo })), nextTools: ['add-audio-to-video', 'compress-video', 'trim-video', 'video-to-mp3'], relatedPages: ['/add-audio-to-video', '/video-to-mp3', '/trim-video', '/compress-video', '/change-video-speed', '/video-converter'], isLive: true },
  { slug: 'add-audio-to-video', name: { en: 'Add audio to video', ar: 'إضافة صوت إلى الفيديو' }, category: 'video', group: 'edit', inputFormats: [...VIDEO_FILES, ...AUDIO_FILES], takesSeveralFiles: true, loadComponent: () => import('./video/VideoTimelineTools').then((tools) => ({ default: tools.AddAudioToVideo })), nextTools: ['trim-video', 'compress-video', 'merge-videos', 'add-text-to-video'], relatedPages: ['/mute-video', '/video-to-mp3', '/loop-video', '/merge-videos', '/trim-video', '/compress-video'], isLive: true },
  { slug: 'add-text-to-video', name: { en: 'Add text to video', ar: 'إضافة نص إلى الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoDrawTools').then((tools) => ({ default: tools.AddTextToVideo })), nextTools: ['compress-video', 'trim-video', 'blur-video-area', 'video-to-gif'], relatedPages: ['/blur-video-area', '/trim-video', '/crop-video', '/compress-video', '/add-audio-to-video', '/video-to-gif', '/watermark-image'], isLive: true },
  { slug: 'blur-video-area', name: { en: 'Blur part of a video', ar: 'تمويه جزء من الفيديو' }, category: 'video', group: 'edit', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoDrawTools').then((tools) => ({ default: tools.BlurVideoArea })), nextTools: ['compress-video', 'trim-video', 'add-text-to-video', 'crop-video'], relatedPages: ['/blur-face', '/crop-video', '/trim-video', '/add-text-to-video', '/compress-video', '/mute-video', '/check-file-upload'], isLive: true },
  { slug: 'video-to-mp3', name: { en: 'Video to MP3', ar: 'تحويل الفيديو إلى MP3' }, category: 'video', group: 'convert', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoExtractTools').then((tools) => ({ default: tools.VideoToMp3 })), nextTools: ['trim-video', 'mute-video', 'add-audio-to-video', 'video-to-gif'], relatedPages: ['/mute-video', '/add-audio-to-video', '/trim-video', '/video-converter', '/video-to-gif', '/extract-video-frames'], isLive: true },
  { slug: 'video-to-gif', name: { en: 'Video to GIF', ar: 'تحويل الفيديو إلى GIF' }, category: 'video', group: 'convert', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoExtractTools').then((tools) => ({ default: tools.VideoToGif })), nextTools: ['extract-video-frames', 'trim-video', 'crop-video', 'compress-image'], relatedPages: ['/trim-video', '/crop-video', '/extract-video-frames', '/resize-video', '/video-to-mp3', '/compress-image', '/meme-generator'], isLive: true },
  { slug: 'extract-video-frames', name: { en: 'Extract video frames', ar: 'استخراج إطارات الفيديو' }, category: 'video', group: 'convert', inputFormats: VIDEO_FILES, loadComponent: () => import('./video/VideoExtractTools').then((tools) => ({ default: tools.ExtractVideoFrames })), nextTools: ['compress-image', 'jpg-to-pdf', 'video-to-gif', 'crop-image'], relatedPages: ['/video-to-gif', '/video-to-mp3', '/trim-video', '/compress-image', '/jpg-to-pdf', '/crop-image', '/video-player'], isLive: true },
  { slug: 'pptx-to-video', name: { en: 'PowerPoint to video', ar: 'تحويل PowerPoint إلى فيديو' }, category: 'video', group: 'convert', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./video/PptxToVideo').then((tools) => ({ default: tools.PptxToVideo })), nextTools: ['compress-video', 'trim-video', 'video-to-gif'], relatedPages: ['/pptx-to-pdf', '/pptx-to-jpg', '/powerpoint-viewer', '/compress-video', '/images-to-pptx', '/check-file-upload'], isLive: true },
  { slug: 'screen-recorder', name: { en: 'Screen recorder', ar: 'مسجّل الشاشة' }, category: 'video', group: 'create', inputFormats: [], needsNoFile: true, loadComponent: () => import('./video/VideoRecorders').then((tools) => ({ default: tools.ScreenRecorder })), nextTools: ['trim-video', 'compress-video', 'video-to-gif', 'video-converter'], relatedPages: ['/webcam-recorder', '/trim-video', '/compress-video', '/video-to-gif', '/video-converter', '/blur-video-area', '/webm-to-mp4'], isLive: true },
  { slug: 'webcam-recorder', name: { en: 'Webcam recorder', ar: 'مسجّل الكاميرا' }, category: 'video', group: 'create', inputFormats: [], needsNoFile: true, loadComponent: () => import('./video/VideoRecorders').then((tools) => ({ default: tools.WebcamRecorder })), nextTools: ['trim-video', 'flip-video', 'compress-video', 'video-to-mp3'], relatedPages: ['/screen-recorder', '/trim-video', '/flip-video', '/compress-video', '/video-to-mp3', '/add-text-to-video', '/video-converter'], isLive: true },
  // Data: the existing viewers, converters and Mask data
  { slug: 'csv-viewer', name: { en: 'CSV viewer', ar: 'عارض CSV' }, category: 'data', group: 'view', inputFormats: ['.csv', '.tsv', '.tab'], relatedPages: ['/open-csv-without-excel', '/tsv-viewer', '/large-csv-viewer', '/excel-viewer', '/csv-to-excel', '/csv-to-json', '/mask-data', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/check-file-upload', '/html-table-to-csv', '/chart-maker', '/sql-to-csv', '/csv-to-pdf', '/word-mail-merge', '/best-free-csv-viewers'], isLive: true },
  { slug: 'large-csv-viewer', name: { en: 'Large CSV file viewer', ar: 'عارض ملفات CSV الكبيرة' }, category: 'data', group: 'view', inputFormats: ['.csv'], relatedPages: ['/open-csv-without-excel', '/csv-viewer', '/tsv-viewer', '/excel-viewer', '/csv-too-big-for-excel', '/split-csv', '/large-csv-test', '/openanydoc-vs-google-sheets-large-files', '/excel-row-and-column-limits'], isLive: true },
  { slug: 'tsv-viewer', name: { en: 'TSV viewer', ar: 'عارض TSV' }, category: 'data', group: 'view', inputFormats: ['.tsv', '.tab'], relatedPages: ['/csv-viewer', '/large-csv-viewer', '/excel-viewer', '/csv-to-excel', '/csv-opens-in-one-column', '/split-csv'], isLive: true },
  { slug: 'json-viewer', name: { en: 'JSON viewer', ar: 'عارض JSON' }, category: 'data', group: 'view', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-validator', '/json-escape', '/json-to-csv', '/mask-data', '/csv-viewer', '/open-json-file', '/anonymize-data-before-sharing', '/json-graph', '/json-minify', '/json-to-toon', '/jsonformatter-alternative', '/json-vs-json-lines'], isLive: true },
  { slug: 'json-formatter', name: { en: 'JSON formatter', ar: 'تنسيق JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/jsonformatter-alternative', '/json-validator', '/json-viewer', '/json-escape', '/json-unexpected-token', '/open-json-file', '/json-graph', '/json-minify', '/json-to-toon', '/best-free-json-formatters'], isLive: true },
  { slug: 'json-validator', name: { en: 'JSON validator', ar: 'التحقق من JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/jsonformatter-alternative', '/json-formatter', '/json-viewer', '/json-unexpected-token'], isLive: true },
  { slug: 'json-escape', name: { en: 'JSON escape / unescape', ar: 'تهريب JSON وفكه' }, category: 'data', group: 'encode', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-validator', '/base64-encode-decode', '/url-encode-decode', '/json-unexpected-token'], isLive: true },
  // The JSON viewer's other landing pages: the same viewer, opened in the page's own mode (jsonPageModes in JsonViewer.tsx).
  { slug: 'json-minify', name: { en: 'JSON minifier', ar: 'تصغير JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-validator', '/json-sort', '/json-viewer'], isLive: true },
  { slug: 'json-sort', name: { en: 'Sort JSON keys', ar: 'ترتيب مفاتيح JSON' }, category: 'data', group: 'clean', inputFormats: ['.json'], relatedPages: ['/json-formatter', '/json-compare', '/json-minify', '/json-viewer'], isLive: true },
  { slug: 'json-tree-viewer', name: { en: 'JSON tree viewer', ar: 'عارض شجرة JSON' }, category: 'data', group: 'view', inputFormats: ['.json'], relatedPages: ['/json-viewer', '/json-graph', '/jsonpath', '/json-formatter', '/open-json-file'], isLive: true },
  { slug: 'json-graph', name: { en: 'JSON graph', ar: 'رسم عقد JSON' }, category: 'data', group: 'view', inputFormats: ['.json'], relatedPages: ['/json-tree-viewer', '/json-viewer', '/json-schema', '/json-compare'], isLive: true },
  { slug: 'json-compare', name: { en: 'Compare JSON', ar: 'مقارنة JSON' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-sort', '/json-formatter', '/json-schema', '/json-viewer', '/compare-two-json-files'], isLive: true },
  { slug: 'json-schema', name: { en: 'JSON Schema', ar: 'مخطط JSON' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-validator', '/json-to-typescript', '/json-compare', '/jsonpath'], isLive: true },
  { slug: 'jsonpath', name: { en: 'JSONPath tester', ar: 'مختبر JSONPath' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-tree-viewer', '/json-viewer', '/json-schema', '/json-to-csv'], isLive: true },
  { slug: 'json-to-yaml', name: { en: 'JSON to YAML', ar: 'تحويل JSON إلى YAML' }, category: 'data', group: 'convert', inputFormats: ['.json'], relatedPages: ['/yaml-to-json', '/yaml-formatter', '/json-to-xml', '/json-formatter'], isLive: true },
  { slug: 'yaml-to-json', name: { en: 'YAML to JSON', ar: 'تحويل YAML إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.yaml', '.yml'], relatedPages: ['/json-to-yaml', '/yaml-formatter', '/json-validator', '/json-viewer'], isLive: true },
  { slug: 'json-to-xml', name: { en: 'JSON to XML', ar: 'تحويل JSON إلى XML' }, category: 'data', group: 'convert', inputFormats: ['.json'], relatedPages: ['/xml-to-json', '/xml-viewer', '/json-to-yaml', '/json-formatter'], isLive: true },
  { slug: 'xml-to-json', name: { en: 'XML to JSON', ar: 'تحويل XML إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.xml'], relatedPages: ['/json-to-xml', '/xml-viewer', '/json-viewer', '/json-to-csv'], isLive: true },
  { slug: 'json-to-typescript', name: { en: 'JSON to TypeScript', ar: 'تحويل JSON إلى TypeScript' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-schema', '/json-to-python', '/json-to-go', '/json-to-java', '/json-to-csharp'], isLive: true },
  { slug: 'json-to-python', name: { en: 'JSON to Python', ar: 'تحويل JSON إلى Python' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-to-typescript', '/json-to-go', '/json-to-java', '/json-to-csharp', '/json-schema'], isLive: true },
  { slug: 'json-to-go', name: { en: 'JSON to Go', ar: 'تحويل JSON إلى Go' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-to-typescript', '/json-to-python', '/json-to-java', '/json-to-csharp', '/json-schema'], isLive: true },
  { slug: 'json-to-java', name: { en: 'JSON to Java', ar: 'تحويل JSON إلى Java' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-to-typescript', '/json-to-python', '/json-to-go', '/json-to-csharp', '/json-schema'], isLive: true },
  { slug: 'json-to-csharp', name: { en: 'JSON to C#', ar: 'تحويل JSON إلى C#' }, category: 'data', group: 'developer', inputFormats: ['.json'], relatedPages: ['/json-to-typescript', '/json-to-python', '/json-to-go', '/json-to-java', '/json-schema'], isLive: true },
  // Step 19: the CSV and Excel to text converters (one component, a different export per format), other formats to CSV (opened in
  // the CSV viewer), the CSV viewer opened on one job (csvPageModes in CsvViewer.tsx), and the CSV file tools.
  { slug: 'csv-to-sql', name: { en: 'CSV to SQL', ar: 'CSV إلى SQL' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToSql })), relatedPages: ['/excel-to-sql', '/csv-viewer', '/csv-to-json', '/json-to-csv'], isLive: true },
  { slug: 'excel-to-sql', name: { en: 'Excel to SQL', ar: 'Excel إلى SQL' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToSql })), relatedPages: ['/csv-to-sql', '/excel-viewer', '/excel-to-json', '/json-to-csv'], isLive: true },
  { slug: 'csv-to-xml', name: { en: 'CSV to XML', ar: 'CSV إلى XML' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToXml })), relatedPages: ['/excel-to-xml', '/csv-viewer', '/csv-to-json', '/json-to-csv'], isLive: true },
  { slug: 'excel-to-xml', name: { en: 'Excel to XML', ar: 'Excel إلى XML' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToXml })), relatedPages: ['/csv-to-xml', '/excel-viewer', '/excel-to-json', '/json-to-csv'], isLive: true },
  { slug: 'csv-to-yaml', name: { en: 'CSV to YAML', ar: 'CSV إلى YAML' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToYaml })), relatedPages: ['/excel-to-yaml', '/csv-viewer', '/csv-to-json', '/json-to-csv'], isLive: true },
  { slug: 'excel-to-yaml', name: { en: 'Excel to YAML', ar: 'Excel إلى YAML' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToYaml })), relatedPages: ['/csv-to-yaml', '/excel-viewer', '/excel-to-json', '/json-to-csv'], isLive: true },
  { slug: 'csv-to-markdown', name: { en: 'CSV to Markdown', ar: 'CSV إلى Markdown' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToMarkdown })), relatedPages: ['/make-markdown-table-from-csv', '/excel-to-markdown', '/csv-viewer', '/csv-to-json', '/json-to-csv', '/csv-to-fixed-width', '/csv-to-latex'], isLive: true },
  { slug: 'excel-to-markdown', name: { en: 'Excel to Markdown', ar: 'Excel إلى Markdown' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToMarkdown })), relatedPages: ['/spreadsheet-to-ai-chat', '/csv-to-markdown', '/excel-viewer', '/excel-to-json', '/json-to-csv', '/excel-to-fixed-width', '/excel-to-latex', '/excel-to-yaml'], isLive: true },
  { slug: 'csv-to-html', name: { en: 'CSV to HTML', ar: 'CSV إلى HTML' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToHtml })), relatedPages: ['/excel-to-html', '/csv-viewer', '/csv-to-json', '/json-to-csv', '/html-table-to-csv', '/csv-to-fixed-width', '/csv-to-latex'], isLive: true },
  { slug: 'excel-to-html', name: { en: 'Excel to HTML', ar: 'Excel إلى HTML' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToHtml })), relatedPages: ['/csv-to-html', '/excel-viewer', '/excel-to-json', '/json-to-csv', '/excel-to-fixed-width', '/excel-to-latex'], isLive: true },
  { slug: 'csv-to-latex', name: { en: 'CSV to LaTeX', ar: 'CSV إلى LaTeX' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToLatex })), relatedPages: ['/excel-to-latex', '/csv-viewer', '/csv-to-json', '/json-to-csv'], isLive: true },
  { slug: 'excel-to-latex', name: { en: 'Excel to LaTeX', ar: 'Excel إلى LaTeX' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToLatex })), relatedPages: ['/csv-to-latex', '/excel-viewer', '/excel-to-json', '/json-to-csv'], isLive: true },
  { slug: 'csv-to-fixed-width', name: { en: 'CSV to fixed width', ar: 'CSV إلى نص بعرض ثابت' }, category: 'data', group: 'convert', inputFormats: CSV_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToFixedWidth })), relatedPages: ['/excel-to-fixed-width', '/csv-viewer', '/csv-to-json', '/json-to-csv'], isLive: true },
  { slug: 'excel-to-fixed-width', name: { en: 'Excel to fixed width', ar: 'Excel إلى نص بعرض ثابت' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, loadComponent: () => import('./data/TableToText').then((tools) => ({ default: tools.TableToFixedWidth })), relatedPages: ['/csv-to-fixed-width', '/excel-viewer', '/excel-to-json', '/json-to-csv'], isLive: true },
  { slug: 'xml-to-csv', name: { en: 'XML to CSV', ar: 'XML إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.xml'], relatedPages: ['/csv-to-xml', '/xml-to-json', '/xml-viewer', '/csv-viewer'], isLive: true },
  { slug: 'yaml-to-csv', name: { en: 'YAML to CSV', ar: 'YAML إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.yaml', '.yml'], relatedPages: ['/csv-to-yaml', '/yaml-to-json', '/yaml-formatter', '/csv-viewer'], isLive: true },
  { slug: 'html-table-to-csv', name: { en: 'HTML table to CSV', ar: 'جدول HTML إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.html', '.htm'], relatedPages: ['/csv-to-html', '/csv-viewer', '/csv-to-markdown', '/excel-to-html'], isLive: true },
  { slug: 'sql-to-csv', name: { en: 'SQL to CSV', ar: 'SQL إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.sql'], relatedPages: ['/csv-to-sql', '/sql-on-csv', '/csv-viewer', '/excel-to-sql'], isLive: true },
  { slug: 'csv-validator', name: { en: 'CSV validator', ar: 'مدقق CSV' }, category: 'data', group: 'clean', inputFormats: CSV_FILES, relatedPages: ['/csv-viewer', '/remove-duplicates', '/change-csv-encoding', '/change-csv-delimiter', '/csv-opens-in-one-column', '/change-case'], isLive: true },
  { slug: 'split-csv', name: { en: 'Split CSV', ar: 'تقسيم CSV' }, category: 'data', group: 'table', inputFormats: CSV_FILES, relatedPages: ['/merge-csv', '/large-csv-viewer', '/csv-viewer', '/csv-too-big-for-excel', '/split-large-csv'], isLive: true },
  { slug: 'sql-on-csv', name: { en: 'SQL on CSV', ar: 'SQL على CSV' }, category: 'data', group: 'analyze', inputFormats: [...CSV_FILES, ...EXCEL_FILES], relatedPages: ['/csv-to-sql', '/sql-to-csv', '/pivot-table', '/csv-viewer'], isLive: true },
  { slug: 'pivot-table', name: { en: 'Pivot table', ar: 'جدول محوري' }, category: 'data', group: 'analyze', inputFormats: [...CSV_FILES, ...EXCEL_FILES], relatedPages: ['/chart-maker', '/sql-on-csv', '/csv-viewer', '/excel-viewer'], isLive: true },
  { slug: 'chart-maker', name: { en: 'Chart maker', ar: 'صانع الرسوم البيانية' }, category: 'data', group: 'analyze', inputFormats: [...CSV_FILES, ...EXCEL_FILES], relatedPages: ['/pivot-table', '/sql-on-csv', '/csv-viewer', '/excel-viewer'], isLive: true },
  { slug: 'remove-duplicates', name: { en: 'Remove duplicates', ar: 'حذف المكررات' }, category: 'data', group: 'clean', inputFormats: [...CSV_FILES, ...EXCEL_FILES], relatedPages: ['/csv-validator', '/compare-csv', '/merge-csv', '/csv-viewer'], isLive: true },
  { slug: 'transpose', name: { en: 'Transpose', ar: 'تبديل الصفوف والأعمدة' }, category: 'data', group: 'table', inputFormats: [...CSV_FILES, ...EXCEL_FILES], relatedPages: ['/pivot-table', '/change-case', '/csv-viewer', '/excel-viewer'], isLive: true },
  { slug: 'change-case', name: { en: 'Change case', ar: 'تغيير حالة الأحرف' }, category: 'data', group: 'clean', inputFormats: [...CSV_FILES, ...EXCEL_FILES], relatedPages: ['/remove-duplicates', '/transpose', '/csv-viewer', '/excel-viewer'], isLive: true },
  { slug: 'merge-csv', name: { en: 'Merge CSV', ar: 'دمج CSV' }, category: 'data', group: 'table', inputFormats: CSV_FILES, takesSeveralFiles: true, loadComponent: () => import('./data/CsvTools').then((tools) => ({ default: tools.MergeCsv })), nextTools: ['csv-viewer', 'split-csv', 'remove-duplicates'], relatedPages: ['/split-csv', '/compare-csv', '/remove-duplicates', '/csv-viewer'], isLive: true },
  { slug: 'compare-csv', name: { en: 'Compare CSV', ar: 'مقارنة CSV' }, category: 'data', group: 'analyze', inputFormats: CSV_FILES, takesSeveralFiles: true, loadComponent: () => import('./data/CsvTools').then((tools) => ({ default: tools.CompareCsv })), relatedPages: ['/merge-csv', '/remove-duplicates', '/json-compare', '/csv-viewer', '/compare-pdf'], isLive: true },
  { slug: 'change-csv-encoding', name: { en: 'Change CSV encoding', ar: 'تغيير ترميز CSV' }, category: 'data', group: 'clean', inputFormats: CSV_FILES, loadComponent: () => import('./data/CsvTools').then((tools) => ({ default: tools.ChangeCsvEncoding })), relatedPages: ['/fix-arabic-csv-in-excel', '/change-csv-delimiter', '/csv-validator', '/csv-viewer'], isLive: true },
  { slug: 'change-csv-delimiter', name: { en: 'Change CSV delimiter', ar: 'تغيير فاصل CSV' }, category: 'data', group: 'clean', inputFormats: CSV_FILES, loadComponent: () => import('./data/CsvTools').then((tools) => ({ default: tools.ChangeCsvDelimiter })), relatedPages: ['/change-csv-encoding', '/csv-opens-in-one-column', '/csv-validator', '/tsv-viewer'], isLive: true },
  { slug: 'test-data-generator', name: { en: 'Test data generator', ar: 'مولّد بيانات الاختبار' }, category: 'data', group: 'table', inputFormats: [], takesText: true, needsNoFile: true, loadComponent: () => import('./data/TestDataGenerator'), relatedPages: ['/mask-data', '/csv-viewer', '/excel-viewer', '/json-viewer'], isLive: true },
  // AI-ready files (the /ai-tools hub): files made into text to paste into an AI chat, and their token count. No AI runs here.
  { slug: 'word-to-markdown', name: { en: 'Word to Markdown', ar: 'تحويل Word إلى Markdown' }, category: 'ai', group: 'aiReady', inputFormats: ['.docx', '.dotx', '.docm'], loadComponent: () => import('./ai/AiReadyTools').then((tools) => ({ default: tools.WordToMarkdown })), relatedPages: ['/word-document-to-ai-chat', '/pptx-to-markdown', '/pdf-to-markdown', '/token-counter', '/word-viewer', '/mask-data', '/word-to-pdf', '/markdown-to-word'], isLive: true },
  { slug: 'pptx-to-markdown', name: { en: 'PowerPoint to Markdown', ar: 'تحويل PowerPoint إلى Markdown' }, category: 'ai', group: 'aiReady', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./ai/AiReadyTools').then((tools) => ({ default: tools.PptxToMarkdown })), relatedPages: ['/powerpoint-to-ai-chat', '/open-pptx-without-powerpoint', '/word-to-markdown', '/pdf-to-markdown', '/token-counter', '/powerpoint-viewer', '/mask-data', '/search-pptx'], isLive: true },
  { slug: 'token-counter', name: { en: 'Token counter', ar: 'عدّاد الرموز' }, category: 'ai', group: 'aiReady', inputFormats: ['.txt', '.md', '.json', '.csv', '.tsv', '.xlsx', '.xls', '.xlsm', '.ods', '.docx', '.dotx', '.docm', '.pptx', '.ppsx', '.potx', '.pptm', '.pdf'], takesText: true, loadComponent: () => import('./ai/AiReadyTools').then((tools) => ({ default: tools.TokenCounter })), relatedPages: ['/how-many-tokens-is-my-pdf', '/json-to-toon', '/pdf-to-markdown', '/word-to-markdown', '/excel-to-markdown', '/mask-data', '/file-too-large-for-chatgpt'], isLive: true },
  { slug: 'json-to-toon', name: { en: 'JSON to TOON', ar: 'تحويل JSON إلى TOON' }, category: 'ai', group: 'aiReady', inputFormats: ['.json', '.toon'], takesText: true, loadComponent: () => import('./ai/AiReadyTools').then((tools) => ({ default: tools.JsonToToon })), relatedPages: ['/what-is-toon-format', '/token-counter', '/json-formatter', '/json-to-yaml', '/csv-to-json', '/mask-data'], isLive: true },
  { slug: 'ai-summarizer', name: { en: 'AI summarizer', ar: 'تلخيص بالذكاء الاصطناعي' }, category: 'ai', group: 'onDevice', inputFormats: ['.pdf', '.docx', '.dotx', '.docm', '.pptx', '.ppsx', '.potx', '.pptm', '.txt', '.md'], loadComponent: () => import('./ai/OnDeviceAiTools').then((tools) => ({ default: tools.AiSummarizer })), relatedPages: ['/chat-with-pdf', '/translate-document', '/pdf-to-markdown', '/token-counter', '/pdf-viewer', '/check-file-upload'], isLive: true },
  { slug: 'translate-document', name: { en: 'Translate document', ar: 'ترجمة مستند' }, category: 'ai', group: 'onDevice', inputFormats: ['.pdf', '.docx', '.dotx', '.docm', '.txt', '.md'], loadComponent: () => import('./ai/OnDeviceAiTools').then((tools) => ({ default: tools.TranslateDocument })), relatedPages: ['/translate-pdf', '/ai-summarizer', '/chat-with-pdf', '/word-viewer', '/pdf-to-word', '/check-file-upload'], isLive: true },
  { slug: 'chat-with-pdf', name: { en: 'Chat with PDF', ar: 'محادثة مع PDF' }, category: 'ai', group: 'onDevice', inputFormats: PDF, loadComponent: () => import('./ai/OnDeviceAiTools').then((tools) => ({ default: tools.ChatWithPdf })), relatedPages: ['/ai-summarizer', '/translate-document', '/pdf-to-markdown', '/ocr-pdf', '/pdf-viewer', '/check-file-upload'], isLive: true },
  // Tools that work on typed or pasted text, drawn at once (`takesText`); a chosen file or a sample fills their text box.
  { slug: 'xml-viewer', name: { en: 'XML viewer', ar: 'عارض XML' }, category: 'data', group: 'view', inputFormats: ['.xml'], takesText: true, loadComponent: () => import('./data/MarkupWorkbench').then((tools) => ({ default: tools.XmlViewer })), relatedPages: ['/xml-to-json', '/json-to-xml', '/json-tree-viewer', '/yaml-formatter', '/xml-to-csv'], isLive: true },
  { slug: 'yaml-formatter', name: { en: 'YAML formatter', ar: 'تنسيق YAML' }, category: 'data', group: 'clean', inputFormats: ['.yaml', '.yml'], takesText: true, loadComponent: () => import('./data/MarkupWorkbench').then((tools) => ({ default: tools.YamlFormatter })), relatedPages: ['/yaml-to-json', '/json-to-yaml', '/json-formatter', '/xml-viewer', '/yaml-to-csv'], isLive: true },
  { slug: 'base64-encode-decode', name: { en: 'Base64 encode / decode', ar: 'ترميز Base64 وفكّه' }, category: 'data', group: 'encode', inputFormats: TEXT_TOOL_FILES, takesText: true, loadComponent: () => import('./data/EncoderTools').then((tools) => ({ default: tools.Base64Tool })), relatedPages: ['/url-encode-decode', '/jwt-decoder', '/json-escape', '/json-formatter'], isLive: true },
  { slug: 'url-encode-decode', name: { en: 'URL encode / decode', ar: 'ترميز الروابط وفكّه' }, category: 'data', group: 'encode', inputFormats: ['.txt'], takesText: true, loadComponent: () => import('./data/EncoderTools').then((tools) => ({ default: tools.UrlTool })), relatedPages: ['/base64-encode-decode', '/jwt-decoder', '/json-escape'], isLive: true },
  { slug: 'jwt-decoder', name: { en: 'JWT decoder', ar: 'فك ترميز JWT' }, category: 'data', group: 'encode', inputFormats: ['.txt', '.jwt'], takesText: true, loadComponent: () => import('./data/EncoderTools').then((tools) => ({ default: tools.JwtDecoder })), relatedPages: ['/base64-encode-decode', '/json-formatter', '/json-tree-viewer', '/url-encode-decode'], isLive: true },
  { slug: 'mask-data', name: { en: 'Mask sensitive data', ar: 'إخفاء البيانات الحساسة' }, category: 'data', group: 'clean', inputFormats: ['.csv', '.tsv', '.tab', '.json', '.xlsx', '.xls', '.xlsm', '.ods', '.txt'], relatedPages: ['/anonymize-data-before-sharing', '/csv-viewer', '/excel-viewer', '/json-viewer', '/check-file-upload', '/test-data-generator'], isLive: true },
  { slug: 'csv-to-excel', name: { en: 'CSV to Excel', ar: 'تحويل CSV إلى Excel' }, category: 'data', group: 'convert', inputFormats: ['.csv', '.tsv', '.tab'], relatedPages: ['/csv-to-json', '/csv-viewer', '/csv-too-big-for-excel', '/transpose'], isLive: true },
  { slug: 'csv-to-json', name: { en: 'CSV to JSON', ar: 'تحويل CSV إلى JSON' }, category: 'data', group: 'convert', inputFormats: ['.csv', '.tsv', '.tab'], relatedPages: ['/csv-to-excel', '/json-to-csv', '/csv-viewer', '/csv-vs-excel-vs-json', '/test-data-generator', '/sql-to-csv'], isLive: true },
  { slug: 'json-to-csv', name: { en: 'JSON to CSV', ar: 'تحويل JSON إلى CSV' }, category: 'data', group: 'convert', inputFormats: ['.json'], relatedPages: ['/csv-to-json', '/json-viewer', '/json-validator', '/csv-vs-excel-vs-json', '/xml-to-csv', '/yaml-to-csv'], isLive: true },
  { slug: 'excel-to-csv', name: { en: 'Excel to CSV', ar: 'تحويل Excel إلى CSV' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, relatedPages: ['/excel-to-json', '/excel-viewer', '/fix-arabic-csv-in-excel', '/csv-vs-excel-vs-json', '/repair-excel', '/excel-to-csv-without-breaking-arabic'], isLive: true },
  { slug: 'excel-to-json', name: { en: 'Excel to JSON', ar: 'تحويل Excel إلى JSON' }, category: 'data', group: 'convert', inputFormats: EXCEL_FILES, relatedPages: ['/convert-excel-to-json-for-api', '/excel-to-csv', '/excel-viewer', '/json-viewer', '/excel-to-xml', '/excel-to-yaml'], isLive: true },
  // Office
  { slug: 'excel-viewer', name: { en: 'Excel viewer', ar: 'عارض Excel' }, category: 'office', group: 'view', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], relatedPages: ['/xls-viewer', '/csv-viewer', '/excel-to-csv', '/excel-to-json', '/mask-data', '/open-xlsx-without-excel', '/anonymize-data-before-sharing', '/excel-to-pdf', '/chart-maker', '/excel-to-xml', '/transpose', '/change-case', '/excel-to-jpg', '/excel-to-word', '/split-excel', '/repair-excel', '/unprotect-excel', '/find-hidden-sheets-in-excel'], isLive: true },
  { slug: 'xls-viewer', name: { en: 'XLS viewer', ar: 'عارض XLS' }, category: 'office', group: 'view', inputFormats: ['.xls'], relatedPages: ['/excel-viewer', '/csv-viewer', '/excel-to-csv', '/open-xlsx-without-excel'], isLive: true },
  { slug: 'word-viewer', name: { en: 'Word viewer', ar: 'عارض Word' }, category: 'office', group: 'view', inputFormats: ['.docx', '.dotx', '.docm', '.odt'], relatedPages: ['/open-docx-without-word', '/powerpoint-viewer', '/txt-viewer', '/csv-viewer', '/check-file-upload', '/word-to-pdf', '/word-to-jpg', '/text-to-word', '/word-find-replace', '/merge-word', '/word-mail-merge', '/extract-word-images'], isLive: true },
  { slug: 'powerpoint-viewer', name: { en: 'PowerPoint viewer (beta)', ar: 'عارض PowerPoint (تجريبي)' }, category: 'office', group: 'view', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], relatedPages: ['/open-pptx-without-powerpoint', '/word-viewer', '/excel-viewer', '/check-file-upload', '/pptx-to-markdown', '/pptx-to-pdf', '/pptx-to-jpg', '/pptx-to-video', '/search-pptx', '/watermark-pptx', '/merge-pptx', '/split-pptx', '/extract-pptx-media', '/read-speaker-notes-without-powerpoint'], isLive: true },
  { slug: 'txt-viewer', name: { en: 'TXT editor', ar: 'محرر TXT' }, category: 'office', group: 'view', inputFormats: ['.txt'], relatedPages: ['/open-txt-file', '/csv-viewer', '/json-viewer', '/word-viewer', '/text-to-pdf', '/text-to-word'], isLive: true },
  { slug: 'pptx-to-jpg', name: { en: 'PowerPoint to JPG', ar: 'تحويل PowerPoint إلى JPG' }, category: 'office', group: 'convert', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.PptxToJpg })), nextTools: ['jpg-to-pdf', 'compress-image', 'images-to-pptx'], relatedPages: ['/powerpoint-viewer', '/pptx-to-pdf', '/pptx-to-video', '/word-to-jpg', '/images-to-pptx', '/open-pptx-without-powerpoint', '/check-file-upload'], isLive: true },
  { slug: 'word-to-jpg', name: { en: 'Word to JPG', ar: 'تحويل Word إلى JPG' }, category: 'office', group: 'convert', inputFormats: ['.docx', '.dotx', '.docm', '.odt'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.WordToJpg })), nextTools: ['jpg-to-pdf', 'compress-image', 'image-viewer'], relatedPages: ['/word-viewer', '/word-to-pdf', '/excel-to-jpg', '/pptx-to-jpg', '/open-docx-without-word', '/check-file-upload'], isLive: true },
  { slug: 'excel-to-jpg', name: { en: 'Excel to JPG', ar: 'تحويل Excel إلى JPG' }, category: 'office', group: 'convert', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], loadComponent: () => import('./pdf/OfficeToPdf').then((tools) => ({ default: tools.ExcelToJpg })), nextTools: ['jpg-to-pdf', 'compress-image', 'image-viewer'], relatedPages: ['/excel-viewer', '/excel-to-pdf', '/excel-to-html', '/word-to-jpg', '/open-xlsx-without-excel', '/check-file-upload'], isLive: true },
  { slug: 'markdown-to-word', name: { en: 'Markdown to Word', ar: 'تحويل Markdown إلى Word' }, category: 'office', group: 'convert', inputFormats: ['.md', '.markdown', '.txt'], takesText: true, loadComponent: () => import('./office/TextToDocument').then((tools) => ({ default: tools.MarkdownToWord })), nextTools: ['word-to-pdf', 'word-to-markdown'], relatedPages: ['/markdown-to-pdf', '/html-to-word', '/text-to-word', '/word-to-markdown', '/word-viewer', '/check-file-upload'], isLive: true },
  { slug: 'html-to-word', name: { en: 'HTML to Word', ar: 'تحويل HTML إلى Word' }, category: 'office', group: 'convert', inputFormats: ['.html', '.htm'], takesText: true, loadComponent: () => import('./office/TextToDocument').then((tools) => ({ default: tools.HtmlToWord })), nextTools: ['word-to-pdf', 'word-to-markdown'], relatedPages: ['/html-to-pdf', '/markdown-to-word', '/text-to-word', '/word-viewer', '/html-table-to-csv', '/check-file-upload'], isLive: true },
  { slug: 'text-to-word', name: { en: 'Text to Word', ar: 'تحويل النص إلى Word' }, category: 'office', group: 'convert', inputFormats: ['.txt'], takesText: true, loadComponent: () => import('./office/TextToDocument').then((tools) => ({ default: tools.TextToWord })), nextTools: ['word-to-pdf', 'word-to-markdown'], relatedPages: ['/text-to-pdf', '/markdown-to-word', '/txt-viewer', '/word-viewer', '/open-txt-file', '/check-file-upload'], isLive: true },
  { slug: 'images-to-pptx', name: { en: 'Images to PowerPoint', ar: 'تحويل الصور إلى PowerPoint' }, category: 'office', group: 'convert', inputFormats: IMAGES, takesSeveralFiles: true, loadComponent: () => import('./pdf/ImagesToPdf').then((tools) => ({ default: tools.ImagesToPptx })), nextTools: ['pptx-to-pdf', 'pptx-to-jpg'], relatedPages: ['/jpg-to-pdf', '/pptx-to-jpg', '/powerpoint-viewer', '/compress-image', '/heic-to-jpg', '/check-file-upload'], isLive: true },
  { slug: 'merge-word', name: { en: 'Merge Word (beta)', ar: 'دمج ملفات Word (تجريبي)' }, category: 'office', group: 'organize', inputFormats: ['.docx'], takesSeveralFiles: true, loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.MergeWord })), nextTools: ['word-to-pdf', 'word-counter', 'watermark-word'], relatedPages: ['/split-word', '/word-viewer', '/word-to-pdf', '/merge-pdf', '/merge-pptx', '/check-file-upload'], isLive: true },
  { slug: 'split-word', name: { en: 'Split Word', ar: 'تقسيم ملف Word' }, category: 'office', group: 'organize', inputFormats: ['.docx'], loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.SplitWord })), nextTools: ['merge-word', 'word-to-pdf'], relatedPages: ['/merge-word', '/word-viewer', '/split-pdf', '/split-pptx', '/word-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'compare-word', name: { en: 'Compare Word', ar: 'مقارنة ملفات Word' }, category: 'office', group: 'analyze', inputFormats: ['.docx'], takesSeveralFiles: true, loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.CompareWord })), nextTools: ['remove-word-comments', 'word-to-pdf'], relatedPages: ['/compare-pdf', '/compare-excel', '/word-viewer', '/remove-word-comments', '/word-counter', '/check-file-upload'], isLive: true },
  { slug: 'word-counter', name: { en: 'Word counter', ar: 'عدّاد الكلمات' }, category: 'office', group: 'analyze', inputFormats: ['.docx', '.odt', '.txt'], takesText: true, loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.WordCounter })), nextTools: ['word-to-pdf'], relatedPages: ['/token-counter', '/compare-word', '/word-viewer', '/txt-viewer', '/word-find-replace', '/check-file-upload'], isLive: true },
  { slug: 'word-find-replace', name: { en: 'Find and replace in Word', ar: 'البحث والاستبدال في Word' }, category: 'office', group: 'edit', inputFormats: ['.docx'], loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.WordFindReplace })), nextTools: ['word-to-pdf', 'word-metadata'], relatedPages: ['/word-mail-merge', '/word-viewer', '/remove-word-comments', '/word-counter', '/search-pptx', '/check-file-upload'], isLive: true },
  { slug: 'remove-word-comments', name: { en: 'Remove comments from Word', ar: 'إزالة التعليقات من Word' }, category: 'office', group: 'edit', inputFormats: ['.docx'], loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.RemoveWordComments })), nextTools: ['word-metadata', 'word-to-pdf'], relatedPages: ['/word-metadata', '/compare-word', '/word-viewer', '/word-to-pdf', '/watermark-word', '/check-file-upload'], isLive: true },
  { slug: 'word-metadata', name: { en: 'Remove Word metadata', ar: 'إزالة بيانات Word الوصفية' }, category: 'office', group: 'security', inputFormats: ['.docx'], loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.WordMetadata })), nextTools: ['remove-word-comments', 'word-to-pdf'], relatedPages: ['/remove-word-comments', '/excel-metadata', '/pptx-metadata', '/remove-image-metadata', '/word-viewer', '/check-file-upload'], isLive: true },
  { slug: 'extract-word-images', name: { en: 'Extract images from Word', ar: 'استخراج الصور من Word' }, category: 'office', group: 'convert', inputFormats: ['.docx'], loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.ExtractWordImages })), nextTools: ['compress-image', 'jpg-to-pdf'], relatedPages: ['/extract-pptx-media', '/extract-pdf-images', '/word-viewer', '/word-to-jpg', '/remove-image-metadata', '/check-file-upload'], isLive: true },
  { slug: 'watermark-word', name: { en: 'Watermark Word', ar: 'علامة مائية على Word' }, category: 'office', group: 'edit', inputFormats: ['.docx'], loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.WatermarkWord })), nextTools: ['word-to-pdf', 'word-metadata'], relatedPages: ['/watermark-pptx', '/watermark-pdf', '/word-viewer', '/word-to-pdf', '/remove-word-comments', '/check-file-upload'], isLive: true },
  { slug: 'word-mail-merge', name: { en: 'Mail merge', ar: 'دمج المراسلات' }, category: 'office', group: 'organize', inputFormats: ['.docx', '.csv', '.xlsx', '.xls', '.ods'], takesSeveralFiles: true, loadComponent: () => import('./office/WordTools').then((tools) => ({ default: tools.WordMailMerge })), nextTools: ['word-to-pdf'], relatedPages: ['/word-find-replace', '/csv-viewer', '/excel-viewer', '/word-viewer', '/merge-word', '/check-file-upload'], isLive: true },
  { slug: 'merge-excel', name: { en: 'Merge Excel', ar: 'دمج ملفات Excel' }, category: 'office', group: 'organize', inputFormats: ['.xlsx', '.xlsm', '.xls', '.ods', '.csv'], takesSeveralFiles: true, loadComponent: () => import('./office/ExcelTools').then((tools) => ({ default: tools.MergeExcel })), nextTools: ['excel-to-pdf', 'excel-metadata'], relatedPages: ['/split-excel', '/merge-csv', '/excel-viewer', '/compare-excel', '/excel-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'split-excel', name: { en: 'Split Excel', ar: 'تقسيم ملف Excel' }, category: 'office', group: 'organize', inputFormats: ['.xlsx', '.xlsm', '.xls', '.ods'], loadComponent: () => import('./office/ExcelTools').then((tools) => ({ default: tools.SplitExcel })), nextTools: ['merge-excel', 'excel-to-pdf'], relatedPages: ['/merge-excel', '/split-csv', '/excel-viewer', '/excel-to-csv', '/compare-excel', '/check-file-upload'], isLive: true },
  { slug: 'compare-excel', name: { en: 'Compare Excel', ar: 'مقارنة ملفات Excel' }, category: 'office', group: 'analyze', inputFormats: ['.xlsx', '.xlsm', '.xls', '.ods'], takesSeveralFiles: true, loadComponent: () => import('./data/CsvTools').then((tools) => ({ default: tools.CompareCsv })), nextTools: ['excel-to-pdf'], relatedPages: ['/compare-csv', '/compare-word', '/excel-viewer', '/merge-excel', '/excel-to-csv', '/check-file-upload'], isLive: true },
  { slug: 'unprotect-excel', name: { en: 'Unprotect Excel', ar: 'إزالة حماية Excel' }, category: 'office', group: 'security', inputFormats: ['.xlsx', '.xlsm'], loadComponent: () => import('./office/ExcelTools').then((tools) => ({ default: tools.UnprotectExcel })), nextTools: ['excel-metadata', 'excel-to-pdf'], relatedPages: ['/excel-viewer', '/repair-excel', '/excel-metadata', '/unlock-pdf', '/excel-to-csv', '/check-file-upload'], isLive: true },
  { slug: 'repair-excel', name: { en: 'Repair Excel', ar: 'إصلاح ملف Excel' }, category: 'office', group: 'edit', inputFormats: ['.xlsx', '.xlsm', '.xls', '.ods'], loadComponent: () => import('./office/ExcelTools').then((tools) => ({ default: tools.RepairExcel })), nextTools: ['excel-to-pdf', 'excel-to-csv'], relatedPages: ['/excel-viewer', '/unprotect-excel', '/excel-to-csv', '/repair-pdf', '/open-xlsx-without-excel', '/check-file-upload'], isLive: true },
  { slug: 'excel-metadata', name: { en: 'Remove Excel metadata', ar: 'إزالة بيانات Excel الوصفية' }, category: 'office', group: 'security', inputFormats: ['.xlsx', '.xlsm'], loadComponent: () => import('./office/ExcelTools').then((tools) => ({ default: tools.ExcelMetadata })), nextTools: ['excel-to-pdf'], relatedPages: ['/word-metadata', '/pptx-metadata', '/unprotect-excel', '/excel-viewer', '/remove-image-metadata', '/check-file-upload'], isLive: true },
  { slug: 'excel-to-word', name: { en: 'Excel to Word', ar: 'تحويل Excel إلى Word' }, category: 'office', group: 'convert', inputFormats: ['.xlsx', '.xls', '.xlsm', '.ods'], loadComponent: () => import('./office/ExcelTools').then((tools) => ({ default: tools.ExcelToWord })), nextTools: ['word-to-pdf', 'watermark-word'], relatedPages: ['/excel-to-pdf', '/excel-viewer', '/word-viewer', '/excel-to-html', '/csv-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'merge-pptx', name: { en: 'Merge PowerPoint (beta)', ar: 'دمج عروض PowerPoint (تجريبي)' }, category: 'office', group: 'organize', inputFormats: ['.pptx', '.ppsx', '.potx'], takesSeveralFiles: true, loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.MergePptx })), nextTools: ['pptx-to-pdf', 'watermark-pptx'], relatedPages: ['/split-pptx', '/powerpoint-viewer', '/merge-word', '/merge-pdf', '/pptx-to-pdf', '/check-file-upload'], isLive: true },
  { slug: 'split-pptx', name: { en: 'Split PowerPoint', ar: 'تقسيم عرض PowerPoint' }, category: 'office', group: 'organize', inputFormats: ['.pptx', '.ppsx', '.potx'], loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.SplitPptx })), nextTools: ['merge-pptx', 'pptx-to-pdf'], relatedPages: ['/merge-pptx', '/powerpoint-viewer', '/split-pdf', '/split-word', '/pptx-to-jpg', '/check-file-upload'], isLive: true },
  { slug: 'extract-pptx-media', name: { en: 'Extract PowerPoint media', ar: 'استخراج الوسائط من PowerPoint' }, category: 'office', group: 'convert', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.ExtractPptxMedia })), nextTools: ['compress-image', 'images-to-pptx'], relatedPages: ['/extract-word-images', '/extract-pdf-images', '/powerpoint-viewer', '/pptx-to-jpg', '/remove-image-metadata', '/check-file-upload'], isLive: true },
  { slug: 'search-pptx', name: { en: 'Search PowerPoint', ar: 'البحث في PowerPoint' }, category: 'office', group: 'analyze', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.SearchPptx })), nextTools: ['pptx-to-markdown'], relatedPages: ['/powerpoint-viewer', '/pptx-to-markdown', '/word-find-replace', '/pptx-to-pdf', '/open-pptx-without-powerpoint', '/check-file-upload'], isLive: true },
  { slug: 'pptx-metadata', name: { en: 'Remove PowerPoint metadata', ar: 'إزالة بيانات PowerPoint الوصفية' }, category: 'office', group: 'security', inputFormats: ['.pptx', '.ppsx', '.potx', '.pptm'], loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.PptxMetadata })), nextTools: ['pptx-to-pdf'], relatedPages: ['/word-metadata', '/excel-metadata', '/pptm-to-pptx', '/powerpoint-viewer', '/remove-image-metadata', '/check-file-upload'], isLive: true },
  { slug: 'pptm-to-pptx', name: { en: 'Remove PowerPoint macros', ar: 'إزالة الماكرو من PowerPoint' }, category: 'office', group: 'security', inputFormats: ['.pptm', '.potm', '.ppsm'], loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.PptmToPptx })), nextTools: ['pptx-to-pdf', 'pptx-metadata'], relatedPages: ['/pptx-metadata', '/powerpoint-viewer', '/pptx-to-pdf', '/split-pptx', '/open-pptx-without-powerpoint', '/check-file-upload'], isLive: true },
  { slug: 'watermark-pptx', name: { en: 'Watermark PowerPoint', ar: 'علامة مائية على PowerPoint' }, category: 'office', group: 'edit', inputFormats: ['.pptx', '.ppsx', '.potx'], loadComponent: () => import('./office/PowerPointTools').then((tools) => ({ default: tools.WatermarkPptx })), nextTools: ['pptx-to-pdf', 'pptx-metadata'], relatedPages: ['/watermark-word', '/watermark-pdf', '/powerpoint-viewer', '/pptx-to-pdf', '/merge-pptx', '/check-file-upload'], isLive: true },
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
    'json-escape': () => import('../content/tools/json-escape.en.json'),
    'json-minify': () => import('../content/tools/json-minify.en.json'),
    'json-sort': () => import('../content/tools/json-sort.en.json'),
    'json-tree-viewer': () => import('../content/tools/json-tree-viewer.en.json'),
    'json-graph': () => import('../content/tools/json-graph.en.json'),
    'json-compare': () => import('../content/tools/json-compare.en.json'),
    'json-schema': () => import('../content/tools/json-schema.en.json'),
    'jsonpath': () => import('../content/tools/jsonpath.en.json'),
    'json-to-yaml': () => import('../content/tools/json-to-yaml.en.json'),
    'yaml-to-json': () => import('../content/tools/yaml-to-json.en.json'),
    'json-to-xml': () => import('../content/tools/json-to-xml.en.json'),
    'xml-to-json': () => import('../content/tools/xml-to-json.en.json'),
    'json-to-typescript': () => import('../content/tools/json-to-typescript.en.json'),
    'json-to-python': () => import('../content/tools/json-to-python.en.json'),
    'json-to-go': () => import('../content/tools/json-to-go.en.json'),
    'json-to-java': () => import('../content/tools/json-to-java.en.json'),
    'json-to-csharp': () => import('../content/tools/json-to-csharp.en.json'),
    'xml-viewer': () => import('../content/tools/xml-viewer.en.json'),
    'yaml-formatter': () => import('../content/tools/yaml-formatter.en.json'),
    'base64-encode-decode': () => import('../content/tools/base64-encode-decode.en.json'),
    'url-encode-decode': () => import('../content/tools/url-encode-decode.en.json'),
    'jwt-decoder': () => import('../content/tools/jwt-decoder.en.json'),
    'word-to-markdown': () => import('../content/tools/word-to-markdown.en.json'),
    'pptx-to-markdown': () => import('../content/tools/pptx-to-markdown.en.json'),
    'token-counter': () => import('../content/tools/token-counter.en.json'),
    'json-to-toon': () => import('../content/tools/json-to-toon.en.json'),
    'ai-summarizer': () => import('../content/tools/ai-summarizer.en.json'),
    'translate-document': () => import('../content/tools/translate-document.en.json'),
    'chat-with-pdf': () => import('../content/tools/chat-with-pdf.en.json'),
    'csv-to-sql': () => import('../content/tools/csv-to-sql.en.json'),
    'excel-to-sql': () => import('../content/tools/excel-to-sql.en.json'),
    'csv-to-xml': () => import('../content/tools/csv-to-xml.en.json'),
    'excel-to-xml': () => import('../content/tools/excel-to-xml.en.json'),
    'csv-to-yaml': () => import('../content/tools/csv-to-yaml.en.json'),
    'excel-to-yaml': () => import('../content/tools/excel-to-yaml.en.json'),
    'csv-to-markdown': () => import('../content/tools/csv-to-markdown.en.json'),
    'excel-to-markdown': () => import('../content/tools/excel-to-markdown.en.json'),
    'csv-to-html': () => import('../content/tools/csv-to-html.en.json'),
    'excel-to-html': () => import('../content/tools/excel-to-html.en.json'),
    'csv-to-latex': () => import('../content/tools/csv-to-latex.en.json'),
    'excel-to-latex': () => import('../content/tools/excel-to-latex.en.json'),
    'csv-to-fixed-width': () => import('../content/tools/csv-to-fixed-width.en.json'),
    'excel-to-fixed-width': () => import('../content/tools/excel-to-fixed-width.en.json'),
    'xml-to-csv': () => import('../content/tools/xml-to-csv.en.json'),
    'yaml-to-csv': () => import('../content/tools/yaml-to-csv.en.json'),
    'html-table-to-csv': () => import('../content/tools/html-table-to-csv.en.json'),
    'sql-to-csv': () => import('../content/tools/sql-to-csv.en.json'),
    'csv-validator': () => import('../content/tools/csv-validator.en.json'),
    'split-csv': () => import('../content/tools/split-csv.en.json'),
    'sql-on-csv': () => import('../content/tools/sql-on-csv.en.json'),
    'pivot-table': () => import('../content/tools/pivot-table.en.json'),
    'chart-maker': () => import('../content/tools/chart-maker.en.json'),
    'remove-duplicates': () => import('../content/tools/remove-duplicates.en.json'),
    'transpose': () => import('../content/tools/transpose.en.json'),
    'change-case': () => import('../content/tools/change-case.en.json'),
    'merge-csv': () => import('../content/tools/merge-csv.en.json'),
    'compare-csv': () => import('../content/tools/compare-csv.en.json'),
    'change-csv-encoding': () => import('../content/tools/change-csv-encoding.en.json'),
    'change-csv-delimiter': () => import('../content/tools/change-csv-delimiter.en.json'),
    'test-data-generator': () => import('../content/tools/test-data-generator.en.json'),
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
    'crop-pdf': () => import('../content/tools/crop-pdf.en.json'),
    'redact-pdf': () => import('../content/tools/redact-pdf.en.json'),
    'compare-pdf': () => import('../content/tools/compare-pdf.en.json'),
    'pdf-to-markdown': () => import('../content/tools/pdf-to-markdown.en.json'),
    'repair-pdf': () => import('../content/tools/repair-pdf.en.json'),
    'scan-to-pdf': () => import('../content/tools/scan-to-pdf.en.json'),
    'pdf-forms': () => import('../content/tools/pdf-forms.en.json'),
    'protect-pdf': () => import('../content/tools/protect-pdf.en.json'),
    'compress-pdf': () => import('../content/tools/compress-pdf.en.json'),
    'pdf-to-grayscale': () => import('../content/tools/pdf-to-grayscale.en.json'),
    'remove-pdf-metadata': () => import('../content/tools/remove-pdf-metadata.en.json'),
    'flatten-pdf': () => import('../content/tools/flatten-pdf.en.json'),
    'unlock-pdf': () => import('../content/tools/unlock-pdf.en.json'),
    'pdf-to-word': () => import('../content/tools/pdf-to-word.en.json'),
    'translate-pdf': () => import('../content/tools/translate-pdf.en.json'),
    'pdf-to-excel': () => import('../content/tools/pdf-to-excel.en.json'),
    'pdf-to-powerpoint': () => import('../content/tools/pdf-to-powerpoint.en.json'),
    'word-to-pdf': () => import('../content/tools/word-to-pdf.en.json'),
    'excel-to-pdf': () => import('../content/tools/excel-to-pdf.en.json'),
    'pptx-to-pdf': () => import('../content/tools/pptx-to-pdf.en.json'),
    'markdown-to-pdf': () => import('../content/tools/markdown-to-pdf.en.json'),
    'text-to-pdf': () => import('../content/tools/text-to-pdf.en.json'),
    'csv-to-pdf': () => import('../content/tools/csv-to-pdf.en.json'),
    'html-to-pdf': () => import('../content/tools/html-to-pdf.en.json'),
    'pptx-to-jpg': () => import('../content/tools/pptx-to-jpg.en.json'),
    'word-to-jpg': () => import('../content/tools/word-to-jpg.en.json'),
    'excel-to-jpg': () => import('../content/tools/excel-to-jpg.en.json'),
    'markdown-to-word': () => import('../content/tools/markdown-to-word.en.json'),
    'html-to-word': () => import('../content/tools/html-to-word.en.json'),
    'text-to-word': () => import('../content/tools/text-to-word.en.json'),
    'images-to-pptx': () => import('../content/tools/images-to-pptx.en.json'),
    'merge-word': () => import('../content/tools/merge-word.en.json'),
    'split-word': () => import('../content/tools/split-word.en.json'),
    'compare-word': () => import('../content/tools/compare-word.en.json'),
    'word-counter': () => import('../content/tools/word-counter.en.json'),
    'word-find-replace': () => import('../content/tools/word-find-replace.en.json'),
    'remove-word-comments': () => import('../content/tools/remove-word-comments.en.json'),
    'word-metadata': () => import('../content/tools/word-metadata.en.json'),
    'extract-word-images': () => import('../content/tools/extract-word-images.en.json'),
    'watermark-word': () => import('../content/tools/watermark-word.en.json'),
    'word-mail-merge': () => import('../content/tools/word-mail-merge.en.json'),
    'merge-excel': () => import('../content/tools/merge-excel.en.json'),
    'split-excel': () => import('../content/tools/split-excel.en.json'),
    'compare-excel': () => import('../content/tools/compare-excel.en.json'),
    'unprotect-excel': () => import('../content/tools/unprotect-excel.en.json'),
    'repair-excel': () => import('../content/tools/repair-excel.en.json'),
    'excel-metadata': () => import('../content/tools/excel-metadata.en.json'),
    'excel-to-word': () => import('../content/tools/excel-to-word.en.json'),
    'merge-pptx': () => import('../content/tools/merge-pptx.en.json'),
    'split-pptx': () => import('../content/tools/split-pptx.en.json'),
    'extract-pptx-media': () => import('../content/tools/extract-pptx-media.en.json'),
    'search-pptx': () => import('../content/tools/search-pptx.en.json'),
    'pptx-metadata': () => import('../content/tools/pptx-metadata.en.json'),
    'pptm-to-pptx': () => import('../content/tools/pptm-to-pptx.en.json'),
    'watermark-pptx': () => import('../content/tools/watermark-pptx.en.json'),
    'ocr-pdf': () => import('../content/tools/ocr-pdf.en.json'),
    'image-to-text': () => import('../content/tools/image-to-text.en.json'),
    'blur-face': () => import('../content/tools/blur-face.en.json'),
    'remove-background': () => import('../content/tools/remove-background.en.json'),
    'upscale-image': () => import('../content/tools/upscale-image.en.json'),
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
    'resize-video': () => import('../content/tools/resize-video.en.json'),
    'flip-video': () => import('../content/tools/flip-video.en.json'),
    'rotate-video': () => import('../content/tools/rotate-video.en.json'),
    'crop-video': () => import('../content/tools/crop-video.en.json'),
    'trim-video': () => import('../content/tools/trim-video.en.json'),
    'compress-video': () => import('../content/tools/compress-video.en.json'),
    'add-audio-to-video': () => import('../content/tools/add-audio-to-video.en.json'),
    'mute-video': () => import('../content/tools/mute-video.en.json'),
    'change-video-speed': () => import('../content/tools/change-video-speed.en.json'),
    'loop-video': () => import('../content/tools/loop-video.en.json'),
    'merge-videos': () => import('../content/tools/merge-videos.en.json'),
    'blur-video-area': () => import('../content/tools/blur-video-area.en.json'),
    'add-text-to-video': () => import('../content/tools/add-text-to-video.en.json'),
    'extract-video-frames': () => import('../content/tools/extract-video-frames.en.json'),
    'video-to-gif': () => import('../content/tools/video-to-gif.en.json'),
    'video-to-mp3': () => import('../content/tools/video-to-mp3.en.json'),
    'webcam-recorder': () => import('../content/tools/webcam-recorder.en.json'),
    'screen-recorder': () => import('../content/tools/screen-recorder.en.json'),
    'mkv-to-mp4': () => import('../content/tools/mkv-to-mp4.en.json'),
    'webm-to-mp4': () => import('../content/tools/webm-to-mp4.en.json'),
    'mov-to-mp4': () => import('../content/tools/mov-to-mp4.en.json'),
    'video-converter': () => import('../content/tools/video-converter.en.json'),
    'video-player': () => import('../content/tools/video-player.en.json'),
    'pptx-to-video': () => import('../content/tools/pptx-to-video.en.json'),
  },
  ar: {
    'csv-viewer': () => import('../content/tools/csv-viewer.ar.json'),
    'large-csv-viewer': () => import('../content/tools/large-csv-viewer.ar.json'),
    'tsv-viewer': () => import('../content/tools/tsv-viewer.ar.json'),
    'json-viewer': () => import('../content/tools/json-viewer.ar.json'),
    'json-formatter': () => import('../content/tools/json-formatter.ar.json'),
    'json-escape': () => import('../content/tools/json-escape.ar.json'),
    'json-minify': () => import('../content/tools/json-minify.ar.json'),
    'json-sort': () => import('../content/tools/json-sort.ar.json'),
    'json-tree-viewer': () => import('../content/tools/json-tree-viewer.ar.json'),
    'json-graph': () => import('../content/tools/json-graph.ar.json'),
    'json-compare': () => import('../content/tools/json-compare.ar.json'),
    'json-schema': () => import('../content/tools/json-schema.ar.json'),
    'jsonpath': () => import('../content/tools/jsonpath.ar.json'),
    'json-to-yaml': () => import('../content/tools/json-to-yaml.ar.json'),
    'yaml-to-json': () => import('../content/tools/yaml-to-json.ar.json'),
    'json-to-xml': () => import('../content/tools/json-to-xml.ar.json'),
    'xml-to-json': () => import('../content/tools/xml-to-json.ar.json'),
    'json-to-typescript': () => import('../content/tools/json-to-typescript.ar.json'),
    'json-to-python': () => import('../content/tools/json-to-python.ar.json'),
    'json-to-go': () => import('../content/tools/json-to-go.ar.json'),
    'json-to-java': () => import('../content/tools/json-to-java.ar.json'),
    'json-to-csharp': () => import('../content/tools/json-to-csharp.ar.json'),
    'xml-viewer': () => import('../content/tools/xml-viewer.ar.json'),
    'yaml-formatter': () => import('../content/tools/yaml-formatter.ar.json'),
    'base64-encode-decode': () => import('../content/tools/base64-encode-decode.ar.json'),
    'url-encode-decode': () => import('../content/tools/url-encode-decode.ar.json'),
    'jwt-decoder': () => import('../content/tools/jwt-decoder.ar.json'),
    'word-to-markdown': () => import('../content/tools/word-to-markdown.ar.json'),
    'pptx-to-markdown': () => import('../content/tools/pptx-to-markdown.ar.json'),
    'token-counter': () => import('../content/tools/token-counter.ar.json'),
    'json-to-toon': () => import('../content/tools/json-to-toon.ar.json'),
    'ai-summarizer': () => import('../content/tools/ai-summarizer.ar.json'),
    'translate-document': () => import('../content/tools/translate-document.ar.json'),
    'chat-with-pdf': () => import('../content/tools/chat-with-pdf.ar.json'),
    'csv-to-sql': () => import('../content/tools/csv-to-sql.ar.json'),
    'excel-to-sql': () => import('../content/tools/excel-to-sql.ar.json'),
    'csv-to-xml': () => import('../content/tools/csv-to-xml.ar.json'),
    'excel-to-xml': () => import('../content/tools/excel-to-xml.ar.json'),
    'csv-to-yaml': () => import('../content/tools/csv-to-yaml.ar.json'),
    'excel-to-yaml': () => import('../content/tools/excel-to-yaml.ar.json'),
    'csv-to-markdown': () => import('../content/tools/csv-to-markdown.ar.json'),
    'excel-to-markdown': () => import('../content/tools/excel-to-markdown.ar.json'),
    'csv-to-html': () => import('../content/tools/csv-to-html.ar.json'),
    'excel-to-html': () => import('../content/tools/excel-to-html.ar.json'),
    'csv-to-latex': () => import('../content/tools/csv-to-latex.ar.json'),
    'excel-to-latex': () => import('../content/tools/excel-to-latex.ar.json'),
    'csv-to-fixed-width': () => import('../content/tools/csv-to-fixed-width.ar.json'),
    'excel-to-fixed-width': () => import('../content/tools/excel-to-fixed-width.ar.json'),
    'xml-to-csv': () => import('../content/tools/xml-to-csv.ar.json'),
    'yaml-to-csv': () => import('../content/tools/yaml-to-csv.ar.json'),
    'html-table-to-csv': () => import('../content/tools/html-table-to-csv.ar.json'),
    'sql-to-csv': () => import('../content/tools/sql-to-csv.ar.json'),
    'csv-validator': () => import('../content/tools/csv-validator.ar.json'),
    'split-csv': () => import('../content/tools/split-csv.ar.json'),
    'sql-on-csv': () => import('../content/tools/sql-on-csv.ar.json'),
    'pivot-table': () => import('../content/tools/pivot-table.ar.json'),
    'chart-maker': () => import('../content/tools/chart-maker.ar.json'),
    'remove-duplicates': () => import('../content/tools/remove-duplicates.ar.json'),
    'transpose': () => import('../content/tools/transpose.ar.json'),
    'change-case': () => import('../content/tools/change-case.ar.json'),
    'merge-csv': () => import('../content/tools/merge-csv.ar.json'),
    'compare-csv': () => import('../content/tools/compare-csv.ar.json'),
    'change-csv-encoding': () => import('../content/tools/change-csv-encoding.ar.json'),
    'change-csv-delimiter': () => import('../content/tools/change-csv-delimiter.ar.json'),
    'test-data-generator': () => import('../content/tools/test-data-generator.ar.json'),
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
    'crop-pdf': () => import('../content/tools/crop-pdf.ar.json'),
    'redact-pdf': () => import('../content/tools/redact-pdf.ar.json'),
    'compare-pdf': () => import('../content/tools/compare-pdf.ar.json'),
    'pdf-to-markdown': () => import('../content/tools/pdf-to-markdown.ar.json'),
    'repair-pdf': () => import('../content/tools/repair-pdf.ar.json'),
    'scan-to-pdf': () => import('../content/tools/scan-to-pdf.ar.json'),
    'pdf-forms': () => import('../content/tools/pdf-forms.ar.json'),
    'protect-pdf': () => import('../content/tools/protect-pdf.ar.json'),
    'compress-pdf': () => import('../content/tools/compress-pdf.ar.json'),
    'pdf-to-grayscale': () => import('../content/tools/pdf-to-grayscale.ar.json'),
    'remove-pdf-metadata': () => import('../content/tools/remove-pdf-metadata.ar.json'),
    'flatten-pdf': () => import('../content/tools/flatten-pdf.ar.json'),
    'unlock-pdf': () => import('../content/tools/unlock-pdf.ar.json'),
    'pdf-to-word': () => import('../content/tools/pdf-to-word.ar.json'),
    'translate-pdf': () => import('../content/tools/translate-pdf.ar.json'),
    'pdf-to-excel': () => import('../content/tools/pdf-to-excel.ar.json'),
    'pdf-to-powerpoint': () => import('../content/tools/pdf-to-powerpoint.ar.json'),
    'word-to-pdf': () => import('../content/tools/word-to-pdf.ar.json'),
    'excel-to-pdf': () => import('../content/tools/excel-to-pdf.ar.json'),
    'pptx-to-pdf': () => import('../content/tools/pptx-to-pdf.ar.json'),
    'markdown-to-pdf': () => import('../content/tools/markdown-to-pdf.ar.json'),
    'text-to-pdf': () => import('../content/tools/text-to-pdf.ar.json'),
    'csv-to-pdf': () => import('../content/tools/csv-to-pdf.ar.json'),
    'html-to-pdf': () => import('../content/tools/html-to-pdf.ar.json'),
    'pptx-to-jpg': () => import('../content/tools/pptx-to-jpg.ar.json'),
    'word-to-jpg': () => import('../content/tools/word-to-jpg.ar.json'),
    'excel-to-jpg': () => import('../content/tools/excel-to-jpg.ar.json'),
    'markdown-to-word': () => import('../content/tools/markdown-to-word.ar.json'),
    'html-to-word': () => import('../content/tools/html-to-word.ar.json'),
    'text-to-word': () => import('../content/tools/text-to-word.ar.json'),
    'images-to-pptx': () => import('../content/tools/images-to-pptx.ar.json'),
    'merge-word': () => import('../content/tools/merge-word.ar.json'),
    'split-word': () => import('../content/tools/split-word.ar.json'),
    'compare-word': () => import('../content/tools/compare-word.ar.json'),
    'word-counter': () => import('../content/tools/word-counter.ar.json'),
    'word-find-replace': () => import('../content/tools/word-find-replace.ar.json'),
    'remove-word-comments': () => import('../content/tools/remove-word-comments.ar.json'),
    'word-metadata': () => import('../content/tools/word-metadata.ar.json'),
    'extract-word-images': () => import('../content/tools/extract-word-images.ar.json'),
    'watermark-word': () => import('../content/tools/watermark-word.ar.json'),
    'word-mail-merge': () => import('../content/tools/word-mail-merge.ar.json'),
    'merge-excel': () => import('../content/tools/merge-excel.ar.json'),
    'split-excel': () => import('../content/tools/split-excel.ar.json'),
    'compare-excel': () => import('../content/tools/compare-excel.ar.json'),
    'unprotect-excel': () => import('../content/tools/unprotect-excel.ar.json'),
    'repair-excel': () => import('../content/tools/repair-excel.ar.json'),
    'excel-metadata': () => import('../content/tools/excel-metadata.ar.json'),
    'excel-to-word': () => import('../content/tools/excel-to-word.ar.json'),
    'merge-pptx': () => import('../content/tools/merge-pptx.ar.json'),
    'split-pptx': () => import('../content/tools/split-pptx.ar.json'),
    'extract-pptx-media': () => import('../content/tools/extract-pptx-media.ar.json'),
    'search-pptx': () => import('../content/tools/search-pptx.ar.json'),
    'pptx-metadata': () => import('../content/tools/pptx-metadata.ar.json'),
    'pptm-to-pptx': () => import('../content/tools/pptm-to-pptx.ar.json'),
    'watermark-pptx': () => import('../content/tools/watermark-pptx.ar.json'),
    'ocr-pdf': () => import('../content/tools/ocr-pdf.ar.json'),
    'image-to-text': () => import('../content/tools/image-to-text.ar.json'),
    'blur-face': () => import('../content/tools/blur-face.ar.json'),
    'remove-background': () => import('../content/tools/remove-background.ar.json'),
    'upscale-image': () => import('../content/tools/upscale-image.ar.json'),
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
    'resize-video': () => import('../content/tools/resize-video.ar.json'),
    'flip-video': () => import('../content/tools/flip-video.ar.json'),
    'rotate-video': () => import('../content/tools/rotate-video.ar.json'),
    'crop-video': () => import('../content/tools/crop-video.ar.json'),
    'trim-video': () => import('../content/tools/trim-video.ar.json'),
    'compress-video': () => import('../content/tools/compress-video.ar.json'),
    'add-audio-to-video': () => import('../content/tools/add-audio-to-video.ar.json'),
    'mute-video': () => import('../content/tools/mute-video.ar.json'),
    'change-video-speed': () => import('../content/tools/change-video-speed.ar.json'),
    'loop-video': () => import('../content/tools/loop-video.ar.json'),
    'merge-videos': () => import('../content/tools/merge-videos.ar.json'),
    'blur-video-area': () => import('../content/tools/blur-video-area.ar.json'),
    'add-text-to-video': () => import('../content/tools/add-text-to-video.ar.json'),
    'extract-video-frames': () => import('../content/tools/extract-video-frames.ar.json'),
    'video-to-gif': () => import('../content/tools/video-to-gif.ar.json'),
    'video-to-mp3': () => import('../content/tools/video-to-mp3.ar.json'),
    'webcam-recorder': () => import('../content/tools/webcam-recorder.ar.json'),
    'screen-recorder': () => import('../content/tools/screen-recorder.ar.json'),
    'mkv-to-mp4': () => import('../content/tools/mkv-to-mp4.ar.json'),
    'webm-to-mp4': () => import('../content/tools/webm-to-mp4.ar.json'),
    'mov-to-mp4': () => import('../content/tools/mov-to-mp4.ar.json'),
    'video-converter': () => import('../content/tools/video-converter.ar.json'),
    'video-player': () => import('../content/tools/video-player.ar.json'),
    'pptx-to-video': () => import('../content/tools/pptx-to-video.ar.json'),
  },
}
// The words fetched so far, by language and slug.
export const toolContent: Record<Locale, Record<string, ToolContent>> = { en: {}, ar: {} }

// A hub page per category, with its task groups in the order shown. `guides`: the guides that help with that category's files.
// `relatedTools`: tools of another category the hub also links (the image hub's JPG to PDF and PDF to JPG).
// `sharedTools`: tools of another category also listed in one of this hub's groups (the AI hub's PDF, Excel and CSV to Markdown).
export type Hub = { category: ToolCategory; path: string; groups: string[]; guides: string[]; relatedTools?: string[]; sharedTools?: Record<string, string[]> }

export const hubs: Hub[] = [
  { category: 'pdf', path: '/pdf-tools', groups: ['view', 'organize', 'optimize', 'convertTo', 'convertFrom', 'edit', 'security', 'intelligence'], guides: ['/how-to-merge-pdf-files', '/how-to-split-a-pdf', '/photos-to-one-pdf', '/password-protect-pdf-free', '/make-scanned-pdf-searchable', '/open-pdf-without-adobe', '/fix-arabic-text-copied-from-pdf', '/cant-edit-text-in-pdf', '/fill-pdf-form-without-acrobat', '/stirling-pdf-alternative', '/check-file-upload', '/pdf-tools-without-upload'], sharedTools: { intelligence: ['ai-summarizer', 'chat-with-pdf', 'translate-document'] } },
  { category: 'image', path: '/image-tools', groups: ['view', 'optimize', 'edit', 'convert', 'create'], guides: ['/reduce-photo-file-size', '/open-heic-on-windows', '/remove-location-from-photo', '/remove-background-without-upload', '/check-file-upload'], relatedTools: ['jpg-to-pdf', 'pdf-to-jpg'] },
  { category: 'video', path: '/video-tools', groups: ['view', 'edit', 'optimize', 'convert', 'create'], guides: ['/compress-video-without-upload'] },
  { category: 'audio', path: '/audio-tools', groups: ['edit', 'optimize', 'convert'], guides: [] },
  { category: 'data', path: '/data-tools', groups: ['view', 'convert', 'clean', 'table', 'analyze', 'developer', 'encode'], guides: ['/convert-excel-to-json-for-api', '/open-csv-without-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/fix-arabic-csv-in-excel', '/open-json-file', '/json-unexpected-token', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing', '/jsonformatter-alternative', '/split-large-csv', '/json-vs-json-lines', '/compare-two-json-files', '/excel-row-and-column-limits', '/excel-to-csv-without-breaking-arabic', '/best-free-csv-viewers', '/best-free-json-formatters', '/openanydoc-vs-google-sheets-large-files', '/large-csv-test'] },
  { category: 'office', path: '/office-tools', groups: ['view', 'organize', 'edit', 'analyze', 'security', 'convert'], guides: ['/open-xlsx-without-excel', '/open-docx-without-word', '/open-pptx-without-powerpoint', '/open-txt-file', '/find-hidden-sheets-in-excel', '/read-speaker-notes-without-powerpoint'], sharedTools: { convert: ['word-to-pdf', 'excel-to-pdf', 'pptx-to-pdf', 'pptx-to-video', 'word-to-markdown', 'pptx-to-markdown'] } },
  { category: 'ai', path: '/ai-tools', groups: ['aiReady', 'onDevice', 'inBrowser'], guides: ['/pdf-to-ai-chat-with-tables', '/how-many-tokens-is-my-pdf', '/word-document-to-ai-chat', '/powerpoint-to-ai-chat', '/spreadsheet-to-ai-chat', '/make-markdown-table-from-csv', '/what-is-toon-format', '/anonymize-data-before-sharing', '/file-too-large-for-chatgpt'], sharedTools: { aiReady: ['pdf-to-markdown', 'excel-to-markdown', 'csv-to-markdown'], inBrowser: ['ocr-pdf', 'image-to-text', 'remove-background', 'blur-face', 'upscale-image', 'translate-pdf'] } },
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
const iconByExtension: Record<string, string> = { '.pdf': 'pdf', '.csv': 'csv', '.tsv': 'csv', '.json': 'json', '.xlsx': 'xlsx', '.xls': 'xlsx', '.docx': 'docx', '.dotx': 'docx', '.docm': 'docx', '.odt': 'docx', '.pptx': 'pptx', '.ppsx': 'pptx', '.potx': 'pptx', '.pptm': 'pptx', '.txt': 'txt', '.jpg': 'convert', '.jpeg': 'convert', '.png': 'convert', '.webp': 'convert', '.heic': 'convert', '.heif': 'convert', '.tif': 'convert', '.tiff': 'convert', '.svg': 'convert', '.md': 'txt', '.html': 'convert' }
export function findToolIcon(tool: Tool) {
  if (tool.slug === 'mask-data') return 'mask'
  if (tool.category === 'image') return 'image'
  if (tool.category === 'video') return 'video'
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
