// The words search engines and visitors see first for each page: title, description, main heading and the sentence under it.
// Keyed by language ('en', 'ar'), then by page address.
// Plain data whose only import is the tool registry (JSON and types), because scripts/build-static-pages.mjs also reads it to write
// each page's <head> at build time.
//
// Rules for anything added here (see CLAUDE.md, "Writing for search"): the main phrase a person would type comes first in the
// title and the heading; a title is at most 60 characters and a description 150 to 160; every page has its own; say only what
// the page really does (no format that is not built); the heading is the only h1 of the page.
import { liveHubs, liveTools, toolContent, toolContentLoaders, toolPath, ALL_TOOLS_PATH } from './tools/registry.ts'
import type { ToolContent } from './tools/registry.ts'

export const SITE_ORIGIN = 'https://www.openanydoc.com'
export const SITE_NAME = 'OpenAnyDoc'
export const AUTHOR_NAME = 'Shahzad Ali'
export const REPOSITORY_URL = 'https://github.com/shahzad-35/openanydoc'
// The brand's own accounts: the footer links them and the Organization JSON-LD lists them in sameAs. Names are brands, the same in both languages.
export const SOCIAL_PROFILES = [
  { id: 'x', name: 'X', url: 'https://x.com/openanydoc' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/company/145343043' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/channel/UCS78NF7U939ypL0mcBgQKlg' },
] as const
// Directory listings that are live (no footer icon): in the Organization's sameAs and on the About page. Add Product Hunt,
// AlternativeTo and the Chrome Web Store only once their pages are public.
export const LISTING_PROFILES = [{ id: 'saashub', name: 'SaaSHub', url: 'https://www.saashub.com/openanydoc' }] as const
// Every profile of the brand, for the Organization's sameAs and the About page.
export const ALL_PROFILE_URLS = [REPOSITORY_URL, ...SOCIAL_PROFILES.map((profile) => profile.url), ...LISTING_PROFILES.map((profile) => profile.url)]
export const X_HANDLE = '@openanydoc'
// The one sentence that says what OpenAnyDoc is, wherever the brand is described as data (Organization, WebSite, llms.txt, README).
export const SITE_DESCRIPTION: Record<'en' | 'ar', string> = {
  en: 'OpenAnyDoc is a free, open-source viewer, editor and converter for CSV, Excel, JSON and TXT files, a viewer for Word, PowerPoint, PDF and image files, and a set of PDF and image tools, that runs in your browser: files are never uploaded.',
  ar: 'OpenAnyDoc عارض ومحرر ومحوّل مجاني ومفتوح المصدر لملفات CSV وExcel وJSON وTXT، وعارض لملفات Word وPowerPoint وPDF والصور، ومجموعة أدوات PDF والصور، يعمل في متصفحك: لا تُرفع الملفات أبدًا.',
}

type Locale = 'en' | 'ar'

// `linkText`: the short, descriptive name that links to a format or landing page use (header nav, footer, related tools).
// `answer`: a tool page's one sentence under the H1 that answers the search (the tool stays on a phone's first screen; `intro` moves
// under the tool).
// `body`: the paragraphs a hub page shows under its tools (what the group is for and how to choose), so the page says more than a list.
export type PageSeo = { title: string; description: string; heading: string; intro: string; answer?: string; linkText?: string; body?: string[] }

// Keyed by language, then by the page address: the home page, the info pages, the guides and the hubs. The tool pages (format,
// landing and conversion pages, Mask data, PDF tools) are added below from src/content/tools/.
export const pageSeo: Record<Locale, Record<string, PageSeo>> = {
  en: {
    '/': {
      title: 'Free Online File Viewer and Editor, No Upload – OpenAnyDoc',
      description: 'Free online file viewer and editor: open CSV, Excel, JSON, TXT, Word and PowerPoint files with no software and edit them in your browser. No upload, no sign-up.',
      heading: 'Free online file viewer and editor: open any file, upload nothing',
      intro: 'Drop a CSV, Excel, JSON or text file to edit it, view Word, PowerPoint and PDF files, or edit, sign and merge PDFs, right here in your browser. A free online file viewer and editor, with no upload and no sign-up.',
    },
    '/about': {
      title: 'About OpenAnyDoc – Private Online File Viewer',
      description: 'About OpenAnyDoc, built and run by Shahzad Ali: a free file viewer and editor that runs in your browser, never uploads files, and opens CSV to PowerPoint.',
      heading: 'About OpenAnyDoc',
      intro: 'A free, privacy-first file viewer and editor that runs in your browser.',
    },
    '/privacy': {
      title: 'Privacy Policy: No Uploads, No Tracking – OpenAnyDoc',
      description: 'OpenAnyDoc privacy policy: files open in your browser and are never uploaded. No analytics, no cookies, no tracking. What your browser keeps and who hosts us.',
      heading: 'Privacy Policy',
      intro: 'In short: your files stay on your device, and we do not track you.',
    },
    '/terms': {
      title: 'Terms of Use for the Free File Viewer – OpenAnyDoc',
      description: 'OpenAnyDoc terms of use: the file viewer and editor is free and provided as is, without warranty. Keep your original files: you are responsible for your edits.',
      heading: 'Terms of Use',
      intro: 'The short rules for using OpenAnyDoc.',
    },
    '/fix-arabic-csv-in-excel': {
      title: 'Why Your CSV Shows Broken Arabic in Excel (and the Fix)',
      description: 'Arabic in a CSV turns into Ø§Ù„ symbols or question marks in Excel because the file has no UTF-8 marker. Three fixes, one of them free with no upload at all.',
      heading: 'Why your CSV shows broken Arabic text in Excel',
      intro: 'Excel guesses the wrong encoding when a UTF-8 file has no byte order mark. Here is what happens, and three ways to fix it.',
      linkText: 'Fix broken Arabic in a CSV',
    },
    '/csv-opens-in-one-column': {
      title: 'CSV Opens in One Column in Excel? Fix the Delimiter',
      description: 'Excel puts a whole CSV row into one cell when the file\'s separator is not the one your region uses. Why it happens and three fixes, one free in your browser.',
      heading: 'CSV opens in one column in Excel: how to fix the delimiter',
      intro: 'Excel splits a CSV on your region\'s list separator, not on commas. Here is why the file lands in column A and three ways to fix it.',
      linkText: 'CSV opens in one column',
    },
    '/csv-too-big-for-excel': {
      title: 'CSV Too Big for Excel? The Row Limit and What to Do',
      description: 'A worksheet stops at 1,048,576 rows and big CSV files freeze Excel. Three ways to open, cut down or load a large CSV, one of them free with nothing uploaded.',
      heading: 'CSV too big for Excel: the 1,048,576-row limit and what to do',
      intro: 'A worksheet holds 1,048,576 rows and large files freeze Excel long before that. Here is why, and how to open, cut down or load the file anyway.',
      linkText: 'CSV too big for Excel',
    },
    '/json-unexpected-token': {
      title: 'JSON Unexpected Token Error: Find the Line and Fix It',
      description: 'Unexpected token in JSON means the parser hit something the format forbids: a trailing comma, a quote, HTML. What each token means, where to look, and the fix.',
      heading: 'JSON "unexpected token" errors: find the line and fix it',
      intro: 'The parser stopped at a character JSON does not allow. Here is what each token means, how to find the exact line, and how to fix it.',
      linkText: 'JSON unexpected token',
    },
    '/check-file-upload': {
      title: 'Does a Website Upload Your File? How to Check in 2 Minutes',
      description: 'How to see whether an online file viewer or converter uploads your file: the browser Network tab, the offline test and the security policy, step by step.',
      heading: 'How to check that a website does not upload your file',
      intro: 'Four checks anyone can run in a desktop browser, with what each one proves and what it does not.',
      linkText: 'Check a site does not upload your file',
    },
    '/open-json-file': {
      title: 'How to Open a JSON File: Browser, Phone, Editor, Online',
      description: 'How to open a JSON file on Windows, Mac or a phone: in your browser, a text or code editor, or a free online viewer, and what to do when the file will not open.',
      heading: 'How to open a JSON file',
      intro: 'Every way to open and read a .json file, from the quickest to the most powerful, and how to fix one that will not open.',
      linkText: 'How to open a JSON file',
    },
    '/open-xlsx-without-excel': {
      title: 'How to Open an XLSX File Without Excel: Free Options',
      description: 'Free ways to open an .xlsx file without Excel: in your browser with no upload, LibreOffice, Google Sheets, Apple Numbers or a phone, and what each keeps.',
      heading: 'How to open an XLSX file without Excel',
      intro: 'The free options, which of them upload your workbook, and how much of its formulas and formatting each one keeps.',
      linkText: 'Open XLSX without Excel',
    },
    '/open-docx-without-word': {
      title: 'How to Open a DOCX File Without Word: Free Options',
      description: 'Free ways to open a .docx file without Microsoft Word: in your browser with no upload, LibreOffice, Google Docs, Apple Pages or a phone, and what each keeps.',
      heading: 'How to open a DOCX file without Word',
      intro: 'The free options, which of them upload your document, and how much of its layout and formatting each one keeps.',
      linkText: 'Open DOCX without Word',
    },
    '/csv-vs-excel-vs-json': {
      title: 'CSV vs Excel vs JSON: Differences and When to Use Each',
      description: 'CSV, Excel (XLSX) and JSON compared: structure, data types, formulas, size limits and encoding, which to use for what, and how to convert between them for free.',
      heading: 'CSV vs Excel vs JSON: the differences and when to use each',
      intro: 'What each format can hold, where each one breaks, and a simple rule for picking the right one.',
      linkText: 'CSV vs Excel vs JSON',
    },
    '/anonymize-data-before-sharing': {
      title: 'How to Anonymize a CSV or Excel File Before Sharing It',
      description: 'Anonymize a CSV, Excel or JSON file before sharing it: what counts as personal data, masking vs anonymization, the steps in your browser, and what to check.',
      heading: 'How to anonymize a CSV or Excel file before sharing it',
      intro: 'What to hide, the difference between masking and anonymizing, and how to do it without uploading the file anywhere.',
      linkText: 'Anonymize data before sharing',
    },
    '/sign-pdf-without-adobe': {
      title: 'How to Sign a PDF Without Adobe: Free Ways, No Upload',
      description: 'Sign a PDF without Adobe Acrobat for free: in the browser with no upload, with Preview on Mac, Markup on iPhone or Edge on Windows, and when a digital ID helps.',
      heading: 'How to sign a PDF without Adobe',
      intro: 'Free ways to sign a PDF on a computer or phone, which of them upload your file, and when a picture of a signature is not enough.',
      linkText: 'Sign a PDF without Adobe',
    },
    '/pdf-tools-without-upload': {
      title: 'PDF Tools That Don\'t Upload Your File: iLovePDF Alternatives',
      description: 'How iLovePDF, Smallpdf, PDF24 and Sejda handle your PDF, from their own pages, and free PDF tools that run in your browser so the file never leaves your device.',
      heading: 'PDF tools that do not upload your file',
      intro: 'How popular PDF sites handle your file, where they do more, and the tools that keep a PDF on your own device.',
      linkText: 'PDF tools without upload',
    },
    '/guides': {
      title: 'Guides: Fix CSV, Excel, JSON and Word File Problems',
      description: 'Practical guides to CSV, Excel, JSON and Word files: open them without Excel or Word, fix broken Arabic and one-column CSVs, and check a site does not upload.',
      heading: 'Guides',
      intro: 'Practical answers to common file problems, each with the free tool that fixes it in your browser.',
      linkText: 'Guides',
    },
    '/pdf-tools': {
      title: 'PDF Tools Online – Edit, Sign, Merge, Convert PDF, No Upload',
      description: 'Free PDF tools in your browser: edit, sign, fill, watermark, merge, split and number PDFs, convert JPG to PDF and PDF to JPG. Nothing uploaded, no sign-up.',
      heading: 'PDF tools',
      intro: 'Free PDF tools that work on your own device: add text, highlights, drawings and a signature, fill in forms, add watermarks, headers and page numbers, merge, split and organize pages, and turn pictures into a PDF and pages into pictures or text, without uploading anything.',
      linkText: 'PDF tools',
      body: [
        'Every PDF tool here runs on your own device. Your browser reads the PDF, changes it and hands you a new file; nothing is sent to a server, so contracts, invoices and forms stay private, and the tools keep working offline once the page has loaded.',
        'To change which pages a PDF has, use Merge, Split, Remove pages, Extract pages or Organize. To change what is on the pages, use Edit PDF for text boxes, highlights, drawings and shapes, Sign PDF for a drawn, typed or uploaded signature, Fill PDF form for form fields, and Watermark, Header and footer or Add page numbers for text on every page. To change the format, turn pictures into a PDF with JPG to PDF, or a PDF into pictures, text or its embedded images.',
        'Each tool shows a preview before you download, and its next steps pass the result to another tool in memory, so you can merge, number and sign a PDF in one visit.',
      ],
    },
    '/image-tools': {
      title: 'Image Tools Online – Compress, Resize, Convert, No Upload',
      description: 'Free image tools in your browser: compress, resize, crop, rotate and watermark pictures, convert HEIC to JPG, remove GPS data and make memes. Nothing uploaded.',
      heading: 'Image tools',
      intro: 'Free picture tools that work on your own device: make photos smaller, resize them for Instagram, WhatsApp or a passport, crop, rotate and watermark them, convert HEIC, WebP, PNG and SVG, remove the GPS location, and edit photos or make memes, many pictures at once.',
      linkText: 'Image tools',
      body: [
        'Every image tool here runs on your own device. Your browser reads the pictures, a background worker changes them, and you download the result; nothing is sent to a server, so family photos, ID pictures and screenshots stay private, and the tools keep working offline once the page has loaded.',
        'To make pictures smaller, use Compress image or convert them to WebP. To change their shape, use Resize, Crop or Rotate. To change their format, use the image converter or one of the pages for a single pair, such as HEIC to JPG for iPhone photos. To protect them, add a watermark, or remove the camera, date and GPS location before you share them.',
        'Most tools take many pictures at once and hand you one ZIP file. JPG to PDF puts pictures into a PDF, and PDF to JPG turns PDF pages back into pictures.',
      ],
    },
    '/data-tools': {
      title: 'Data Tools Online – Convert CSV, JSON and Excel, No Upload',
      description: 'Free data tools for CSV, TSV, JSON and Excel files: view large tables, convert between formats, format and validate JSON, and mask personal data. No upload.',
      heading: 'Data tools',
      intro: 'Free tools for tables and data files: open CSV and JSON, convert between CSV, Excel and JSON, check JSON and hide personal data, all in your browser.',
      linkText: 'Data tools',
      body: [
        'The data tools open CSV, TSV, JSON and Excel files as tables or trees in your browser, convert between them and clean them up, without uploading a single row. Large files are read in a background worker, so a CSV with 120,000 rows opens in about a second.',
        'Use the converters to move data between formats: CSV to Excel or JSON, Excel to CSV or JSON, and JSON to CSV with nested objects flattened into columns. Use the JSON formatter and validator to pretty print a file or find the exact line of a syntax error, and Mask sensitive data to replace names, emails, phone numbers and IDs before you share a file.',
      ],
    },
    '/office-tools': {
      title: 'Office Tools Online – Open Word, Excel and PowerPoint Files',
      description: 'Free office file tools: open Word documents, Excel workbooks, old XLS files, PowerPoint slides and text files in your browser, no Office needed. No upload.',
      heading: 'Office tools',
      intro: 'Open Word, Excel, PowerPoint and text files without installing Office: free viewers that run in your browser and never upload your files.',
      linkText: 'Office tools',
      body: [
        'The office tools open the files people send at work without Microsoft Office: Word documents (.docx, .dotx, .docm and OpenDocument .odt), Excel workbooks (.xlsx, .xlsm, .ods and old .xls files), PowerPoint presentations (.pptx and .ppsx, in beta) and plain text files. Everything is drawn by your browser, so a confidential document is never uploaded to read it.',
        'The Word viewer shows pages with their fonts, tables and pictures, plus a navigation pane, search, comments and read aloud. The Excel viewer keeps formulas, number formats and frozen panes and lets you edit cells and download the workbook. The PowerPoint viewer shows slides with notes, a grid and a presenter view. Each can print or save as PDF, and Arabic documents display right to left.',
      ],
    },
    '/all-tools': {
      title: 'All Free File Tools: PDF, Data and Office – OpenAnyDoc',
      description: 'Every free OpenAnyDoc tool in one place: PDF tools, CSV and JSON converters, data masking, and viewers for Word, Excel and PowerPoint files. Nothing uploaded.',
      heading: 'All tools',
      intro: 'Every tool on OpenAnyDoc, grouped by the kind of file it works on. Each one runs in your browser, and none of them uploads your files.',
      linkText: 'All tools',
      body: [
        'Every OpenAnyDoc tool works the same way: you choose a file, your browser does the work, and you download the result. Nothing is uploaded, there is no account and no watermark, and the tools work offline once a page has loaded. Pick a tool from the PDF, data or office groups above, or drop any supported file on the home page and it opens in the right viewer.',
      ],
    },
  },
  ar: {
    '/': {
      title: 'عارض ملفات اون لاين مجاني – فتح الملفات بدون برامج',
      description: 'عارض ملفات اون لاين مجاني: افتح ملفات CSV وExcel وJSON وTXT وWord وPowerPoint في متصفحك وعدّلها، بدون برامج وبدون تسجيل، وملفاتك لا تُرفع ولا تغادر جهازك.',
      heading: 'عارض ومحرر ملفات اون لاين مجاني: افتح أي ملف بدون رفع',
      intro: 'أفلِت ملف CSV أو Excel أو JSON أو ملفًا نصيًا لتعدّله، أو اعرض ملفات Word وPowerPoint وPDF، أو عدّل ملفات PDF ووقّعها وادمجها، هنا في متصفحك مباشرة. عارض ملفات اون لاين مجاني ومحرر للملفات، بدون رفع وبدون تسجيل.',
    },
    '/about': {
      title: 'عن OpenAnyDoc – عارض ملفات خاص اون لاين',
      description: 'عن OpenAnyDoc الذي يبنيه ويديره شهزاد علي: عارض ومحرر ملفات مجاني يعمل في متصفحك ولا يرفع ملفاتك أبدًا. يدعم اليوم CSV وExcel وJSON وTXT وWord وPowerPoint.',
      heading: 'عن OpenAnyDoc',
      intro: 'عارض ومحرر ملفات مجاني يضع الخصوصية أولًا ويعمل داخل متصفحك.',
    },
    '/privacy': {
      title: 'سياسة الخصوصية: لا رفع للملفات ولا تتبع – OpenAnyDoc',
      description: 'سياسة الخصوصية في OpenAnyDoc: تُفتح الملفات في متصفحك ولا تُرفع أبدًا. لا تحليلات ولا ملفات تعريف ارتباط ولا تتبع. ما يحفظه المتصفح ومن يستضيف الموقع.',
      heading: 'سياسة الخصوصية',
      intro: 'باختصار: ملفاتك تبقى على جهازك، ونحن لا نتتبعك.',
    },
    '/terms': {
      title: 'شروط استخدام عارض الملفات المجاني – OpenAnyDoc',
      description: 'شروط استخدام OpenAnyDoc: عارض ومحرر الملفات مجاني ويُقدَّم كما هو دون أي ضمان. احتفظ دائمًا بملفاتك الأصلية، فأنت مسؤول عن الملفات التي تفتحها وتعدّلها.',
      heading: 'شروط الاستخدام',
      intro: 'القواعد المختصرة لاستخدام OpenAnyDoc.',
    },
    '/fix-arabic-csv-in-excel': {
      title: 'لماذا تظهر العربية في ملف CSV برموز غريبة في Excel؟',
      description: 'تظهر العربية في ملف CSV على شكل رموز أو علامات استفهام في Excel لأن الملف لا يحمل علامة UTF-8. ثلاثة حلول، منها حل مجاني لا يرفع ملفك أبدًا ولا يغادر جهازك.',
      heading: 'لماذا تظهر العربية في ملف CSV برموز غريبة في Excel',
      intro: 'يخمّن Excel ترميزًا خاطئًا عندما يخلو ملف UTF-8 من علامة ترتيب البايتات. إليك ما يحدث وثلاث طرق لإصلاحه.',
      linkText: 'إصلاح العربية المشوّهة في CSV',
    },
    '/csv-opens-in-one-column': {
      title: 'ملف CSV يُفتح في عمود واحد في Excel؟ هكذا تصلح الفاصل',
      description: 'يضع Excel صف CSV كاملًا في خلية واحدة عندما يستخدم الملف فاصلًا غير فاصل منطقتك. إليك سبب المشكلة وثلاثة حلول عملية، أحدها مجاني في متصفحك ولا يرفع ملفك.',
      heading: 'ملف CSV يُفتح في عمود واحد في Excel: كيف تصلح الفاصل',
      intro: 'يقسّم Excel ملف CSV على فاصل القائمة في منطقتك لا على الفواصل. إليك لماذا يستقر الملف في العمود A وثلاث طرق لإصلاحه.',
      linkText: 'ملف CSV في عمود واحد',
    },
    '/csv-too-big-for-excel': {
      title: 'ملف CSV أكبر من أن يفتحه Excel؟ حد الصفوف وما تفعله',
      description: 'تتوقف ورقة العمل عند 1,048,576 صفًا وتجمّد ملفات CSV الكبيرة Excel. ثلاث طرق لفتح ملف CSV كبير أو اقتطاعه أو تحميله، إحداها مجانية في متصفحك ولا ترفع شيئًا.',
      heading: 'ملف CSV أكبر من أن يفتحه Excel: حد 1,048,576 صفًا وما تفعله',
      intro: 'تتسع ورقة العمل لـ 1,048,576 صفًا، وتجمّد الملفات الكبيرة Excel قبل ذلك بكثير. إليك السبب وكيف تفتح الملف أو تقتطعه أو تحمّله.',
      linkText: 'ملف CSV أكبر من Excel',
    },
    '/json-unexpected-token': {
      title: 'خطأ JSON Unexpected Token: اعثر على السطر وأصلحه',
      description: 'يعني Unexpected token في JSON أن المحلل صادف ما تمنعه الصيغة: فاصلة زائدة أو علامة اقتباس أو HTML. ماذا يعني كل رمز، وأين تبحث عنه، وكيف تصلحه مجانًا في متصفحك.',
      heading: 'أخطاء JSON "unexpected token": اعثر على السطر وأصلحه',
      intro: 'توقف المحلل عند حرف لا يسمح به JSON. إليك ما يعنيه كل رمز، وكيف تعثر على السطر بالضبط، وكيف تصلحه.',
      linkText: 'خطأ JSON unexpected token',
    },
    '/check-file-upload': {
      title: 'هل يرفع الموقع ملفك؟ كيف تتحقق بنفسك في دقيقتين',
      description: 'كيف تعرف إن كان عارض أو محوّل ملفات على الإنترنت يرفع ملفك: تبويب Network في المتصفح، واختبار قطع الاتصال، وسياسة أمان الموقع، خطوة بخطوة وبلا أي برنامج.',
      heading: 'كيف تتحقق من أن الموقع لا يرفع ملفك',
      intro: 'أربعة اختبارات يجريها أي شخص في متصفح الحاسوب، مع ما يثبته كل منها وما لا يثبته.',
      linkText: 'تحقق أن الموقع لا يرفع ملفك',
    },
    '/open-json-file': {
      title: 'كيف تفتح ملف JSON: في المتصفح والهاتف والمحرر مجانًا',
      description: 'كيف تفتح ملف JSON على ويندوز أو ماك أو الهاتف: في المتصفح، أو في محرر نصوص أو شيفرة، أو في عارض مجاني على الإنترنت، وماذا تفعل حين يرفض الملف أن يُفتح.',
      heading: 'كيف تفتح ملف JSON',
      intro: 'كل طرق فتح ملف json وقراءته، من الأسرع إلى الأقوى، وكيف تصلح ملفًا لا يُفتح.',
      linkText: 'كيف تفتح ملف JSON',
    },
    '/open-xlsx-without-excel': {
      title: 'كيف تفتح ملف XLSX بدون Excel: خيارات مجانية بلا رفع',
      description: 'طرق مجانية لفتح ملف xlsx دون Microsoft Excel: في متصفحك دون رفع، وفي LibreOffice وGoogle Sheets وApple Numbers وعلى الهاتف، مع ما يحتفظ به كل خيار من الملف.',
      heading: 'كيف تفتح ملف XLSX بدون Excel',
      intro: 'الخيارات المجانية، وأيها يرفع مصنفك، وكم يحتفظ كل منها بالصيغ والتنسيق.',
      linkText: 'فتح XLSX بدون Excel',
    },
    '/open-docx-without-word': {
      title: 'كيف تفتح ملف DOCX بدون وورد: طرق مجانية بلا رفع',
      description: 'طرق مجانية لفتح ملف وورد docx دون برنامج Microsoft Word: في متصفحك دون رفع، وفي LibreOffice وGoogle Docs وApple Pages وعلى الهاتف، مع ما يحفظه كل خيار.',
      heading: 'كيف تفتح ملف DOCX بدون وورد',
      intro: 'الخيارات المجانية، وأيها يرفع مستندك، وكم يحفظ كل منها من تخطيطه وتنسيقه.',
      linkText: 'فتح DOCX بدون وورد',
    },
    '/csv-vs-excel-vs-json': {
      title: 'CSV أم Excel أم JSON: الفروق ومتى تستخدم كل صيغة',
      description: 'مقارنة بين CSV وExcel (XLSX) وJSON: البنية وأنواع البيانات والصيغ وحدود الحجم وترميز النص، وأي صيغة تناسب كل استخدام، وكيف تحوّل بينها مجانًا في متصفحك.',
      heading: 'CSV أم Excel أم JSON: الفروق ومتى تستخدم كلًا منها',
      intro: 'ما تتسع له كل صيغة، وأين تتعثر، وقاعدة بسيطة لاختيار المناسبة.',
      linkText: 'CSV أم Excel أم JSON',
    },
    '/anonymize-data-before-sharing': {
      title: 'كيف تخفي البيانات الشخصية في ملف CSV أو Excel قبل مشاركته',
      description: 'أخفِ البيانات الشخصية في ملف CSV أو Excel أو JSON قبل مشاركته: ما الذي يُعد بيانات شخصية، والفرق بين الإخفاء وإخفاء الهوية، والخطوات في متصفحك، وما تراجعه.',
      heading: 'كيف تخفي البيانات الشخصية في ملف CSV أو Excel قبل مشاركته',
      intro: 'ما الذي تخفيه، والفرق بين الإخفاء وإخفاء الهوية، وكيف تفعل ذلك دون رفع الملف إلى أي مكان.',
      linkText: 'إخفاء البيانات قبل المشاركة',
    },
    '/sign-pdf-without-adobe': {
      title: 'كيف توقّع ملف PDF بدون Adobe: طرق مجانية دون رفع',
      description: 'وقّع ملف PDF دون Adobe Acrobat مجانًا: في متصفحك دون رفع، أو بتطبيق Preview على Mac، أو Markup على iPhone، أو Edge على Windows، ومتى تحتاج إلى هوية رقمية.',
      heading: 'كيف توقّع ملف PDF بدون Adobe',
      intro: 'طرق مجانية لتوقيع ملف PDF على الحاسوب أو الهاتف، وأيّها يرفع ملفك، ومتى لا تكفي صورة التوقيع.',
      linkText: 'توقيع PDF بدون Adobe',
    },
    '/pdf-tools-without-upload': {
      title: 'أدوات PDF لا ترفع ملفك: بدائل iLovePDF وSmallpdf',
      description: 'كيف تتعامل iLovePDF وSmallpdf وPDF24 وSejda مع ملف PDF وفق صفحاتها، وأدوات PDF مجانية تعمل في متصفحك فلا يغادر الملف جهازك أبدًا ولا يُرفع إلى أي خادم.',
      heading: 'أدوات PDF لا ترفع ملفك',
      intro: 'كيف تتعامل مواقع PDF الشائعة مع ملفك، وأين تقدّم أكثر، والأدوات التي تُبقي الملف على جهازك.',
      linkText: 'أدوات PDF بدون رفع',
    },
    '/guides': {
      title: 'أدلة: حل مشكلات ملفات CSV وExcel وJSON ووورد',
      description: 'أدلة عملية لملفات CSV وExcel وJSON ووورد: افتحها دون Excel أو Word، وأصلح العربية المشوّهة وملف CSV في عمود واحد، وتحقق من أن الموقع لا يرفع ملفك أبدًا.',
      heading: 'الأدلة',
      intro: 'إجابات عملية لمشكلات الملفات الشائعة، مع الأداة المجانية التي تحلها في متصفحك.',
      linkText: 'الأدلة',
    },
    '/pdf-tools': {
      title: 'أدوات PDF مجانية – تعديل وتوقيع ودمج وتحويل PDF دون رفع',
      description: 'أدوات PDF مجانية في متصفحك: عدّل ووقّع وعبّئ ملفات PDF، وأضف علامة مائية وأرقام صفحات، وادمج وقسّم، وحوّل JPG إلى PDF وPDF إلى JPG. لا يُرفع أي ملف أبدًا.',
      heading: 'أدوات PDF',
      intro: 'أدوات PDF مجانية تعمل على جهازك: أضف نصوصًا وتظليلًا ورسومًا وتوقيعك، وعبّئ النماذج، وأضف علامات مائية ورؤوسًا وأرقام صفحات، وادمج الصفحات وقسّمها ورتّبها، وحوّل الصور إلى PDF والصفحات إلى صور أو نص، دون رفع أي شيء.',
      linkText: 'أدوات PDF',
      body: [
        'تعمل كل أدوات PDF هنا على جهازك. يقرأ متصفحك ملف PDF ويعدّله ويعطيك ملفًا جديدًا، ولا يُرسل شيء إلى خادم، فتبقى العقود والفواتير والنماذج خاصة، وتواصل الأدوات العمل دون اتصال بعد تحميل الصفحة.',
        'لتغيير صفحات الملف استخدم الدمج أو التقسيم أو حذف الصفحات أو استخراجها أو ترتيبها. ولتغيير ما على الصفحات استخدم «تعديل PDF» لمربعات النص والتظليل والرسم والأشكال، و«توقيع PDF» لتوقيع مرسوم أو مكتوب أو مرفوع، و«تعبئة نموذج PDF» لحقول النماذج، والعلامة المائية والرأس والتذييل وترقيم الصفحات للنص على كل صفحة. ولتغيير الصيغة حوّل الصور إلى PDF، أو PDF إلى صور أو نص أو استخرج صوره.',
        'تعرض كل أداة معاينة قبل التنزيل، وتمرر خطواتها التالية النتيجة إلى أداة أخرى في الذاكرة، فيمكنك دمج ملف وترقيمه وتوقيعه في زيارة واحدة.',
      ],
    },
    '/image-tools': {
      title: 'أدوات الصور – ضغط وتغيير حجم وتحويل الصور دون رفع',
      description: 'أدوات صور مجانية في متصفحك: اضغط الصور وغيّر حجمها وقصّها ودوّرها وأضف علامة مائية، وحوّل HEIC إلى JPG، وأزل بيانات GPS، واصنع الميمز. لا يُرفع أي ملف.',
      heading: 'أدوات الصور',
      intro: 'أدوات صور مجانية تعمل على جهازك: صغّر حجم الصور، وغيّر مقاسها لإنستغرام أو واتساب أو الجواز، وقصّها ودوّرها وأضف إليها علامة مائية، وحوّل HEIC وWebP وPNG وSVG، وأزل موقع GPS، وعدّل الصور أو اصنع الميمز، لعدة صور معًا.',
      linkText: 'أدوات الصور',
      body: [
        'تعمل كل أدوات الصور هنا على جهازك. يقرأ متصفحك الصور، ويعدّلها عامل في الخلفية، ثم تنزّل النتيجة؛ ولا يُرسل شيء إلى خادم، فتبقى صور العائلة وصور الهوية ولقطات الشاشة خاصة، وتواصل الأدوات العمل دون اتصال بعد تحميل الصفحة.',
        'لتصغير حجم الصور استخدم ضغط الصور أو حوّلها إلى WebP. ولتغيير شكلها استخدم تغيير الحجم أو القص أو التدوير. ولتغيير صيغتها استخدم محوّل الصور أو إحدى صفحات التحويل المخصصة، مثل HEIC إلى JPG لصور الآيفون. ولحمايتها أضف علامة مائية، أو أزل بيانات الكاميرا والتاريخ وموقع GPS قبل مشاركتها.',
        'تقبل معظم الأدوات عدة صور معًا وتعطيك ملف ZIP واحدًا. ويضع «JPG إلى PDF» الصور في ملف PDF، ويحوّل «PDF إلى JPG» صفحات PDF إلى صور.',
      ],
    },
    '/data-tools': {
      title: 'أدوات البيانات – تحويل CSV وJSON وExcel دون رفع الملفات',
      description: 'أدوات مجانية لملفات CSV وTSV وJSON وExcel: اعرض الجداول الكبيرة، وحوّل بين الصيغ، ونسّق JSON وتحقق منه، وأخفِ البيانات الشخصية. كل ذلك في متصفحك دون رفع أي ملف.',
      heading: 'أدوات البيانات',
      intro: 'أدوات مجانية للجداول وملفات البيانات: افتح CSV وJSON، وحوّل بين CSV وExcel وJSON، وتحقق من JSON، وأخفِ البيانات الشخصية، كل ذلك في متصفحك.',
      linkText: 'أدوات البيانات',
      body: [
        'تفتح أدوات البيانات ملفات CSV وTSV وJSON وExcel جداولَ أو أشجارًا في متصفحك، وتحوّل بينها وتنظّفها، دون رفع صف واحد. تُقرأ الملفات الكبيرة في عامل خلفي، فيُفتح ملف CSV فيه 120,000 صف في نحو ثانية.',
        'استخدم المحوّلات لنقل البيانات بين الصيغ: CSV إلى Excel أو JSON، وExcel إلى CSV أو JSON، وJSON إلى CSV مع تسطيح الكائنات المتداخلة في أعمدة. واستخدم منسّق JSON ومدقّقه لتنسيق الملف أو إيجاد سطر الخطأ بالضبط، و«إخفاء البيانات الحساسة» لاستبدال الأسماء والبريد وأرقام الهواتف والهويات قبل مشاركة الملف.',
      ],
    },
    '/office-tools': {
      title: 'أدوات المكتب – افتح ملفات Word وExcel وPowerPoint دون Office',
      description: 'أدوات مجانية لملفات المكتب: افتح مستندات Word ومصنفات Excel وملفات XLS القديمة وشرائح PowerPoint والملفات النصية في متصفحك دون Office. لا يُرفع أي ملف أبدًا.',
      heading: 'أدوات المكتب',
      intro: 'افتح ملفات Word وExcel وPowerPoint والملفات النصية دون تثبيت Office: عارضات مجانية تعمل في متصفحك ولا ترفع ملفاتك أبدًا. وفي عارضات Word وExcel وPowerPoint يمكنك البحث في الملف وطباعته أو حفظه بصيغة PDF، وتواصل الصفحة العمل دون اتصال بالإنترنت بعد تحميلها.',
      linkText: 'أدوات المكتب',
      body: [
        'تفتح أدوات المكتب الملفات التي تصلك في العمل دون Microsoft Office: مستندات Word (‎.docx و‎.dotx و‎.docm وOpenDocument ‎.odt)، ومصنفات Excel (‎.xlsx و‎.xlsm و‎.ods وملفات ‎.xls القديمة)، وعروض PowerPoint (‎.pptx و‎.ppsx، تجريبيًا)، والملفات النصية. يرسم متصفحك كل شيء، فلا يُرفع مستند سري لقراءته.',
        'يعرض عارض Word الصفحات بخطوطها وجداولها وصورها، مع لوحة تنقل وبحث وتعليقات وقراءة بصوت عالٍ. ويحتفظ عارض Excel بالمعادلات وتنسيقات الأرقام والأجزاء المثبتة، ويتيح تعديل الخلايا وتنزيل المصنف. ويعرض عارض PowerPoint الشرائح مع الملاحظات وشبكة الشرائح وعرض المقدّم. ويمكن لكلٍّ منها الطباعة أو الحفظ بصيغة PDF، وتظهر المستندات العربية من اليمين إلى اليسار.',
      ],
    },
    '/all-tools': {
      title: 'كل الأدوات المجانية: PDF والبيانات والمكتب | OpenAnyDoc',
      description: 'كل أدوات OpenAnyDoc المجانية في مكان واحد: أدوات PDF، ومحوّلات CSV وJSON، وإخفاء البيانات، وعارضات ملفات Word وExcel وPowerPoint. لا يُرفع أي ملف إلى أي خادم.',
      heading: 'كل الأدوات',
      intro: 'كل أدوات OpenAnyDoc مرتبة حسب نوع الملف الذي تعمل عليه. كلها تعمل في متصفحك، ولا ترفع أي منها ملفاتك.',
      linkText: 'كل الأدوات',
      body: [
        'تعمل كل أدوات OpenAnyDoc بالطريقة نفسها: تختار ملفًا، ويقوم متصفحك بالعمل، وتنزّل النتيجة. لا يُرفع شيء، ولا حساب ولا علامة مائية، وتعمل الأدوات دون اتصال بعد تحميل الصفحة. اختر أداة من مجموعات PDF أو البيانات أو المكتب أعلاه، أو أفلت أي ملف مدعوم على الصفحة الرئيسية فيُفتح في العارض المناسب.',
      ],
    },
  },
}

// The tool pages (viewers, converters, Mask data, the PDF tools) join pageSeo here so the breadcrumb, the search, the menus and the
// share images treat them like any page. Their words are in src/content/tools/<slug>.<locale>.json, fetched only for the page shown
// (about 50 KB for every tool in both languages): until then a tool's entry holds just its name. loadToolPageWords fills it in;
// main.tsx and App call it before drawing a tool page, entry-server.tsx before rendering one; the build scripts read every file
// themselves and call setToolPageWords.
for (const locale of ['en', 'ar'] as const) {
  for (const tool of liveTools) {
    const name = tool.name?.[locale] ?? tool.slug
    pageSeo[locale][toolPath(tool)] = { title: '', description: '', heading: name, intro: '', linkText: name }
  }
}

// A tool page's words, once read: they fill its pageSeo entry. The build scripts call this with the files read from disk.
export function setToolPageWords(locale: Locale, slug: string, content: ToolContent) {
  const path = `/${slug}`
  toolContent[locale][slug] = content
  pageSeo[locale][path] = { title: content.title, description: content.description, heading: content.heading, intro: content.intro ?? content.subtitle, answer: content.subtitle, linkText: pageSeo[locale][path].linkText }
}

export async function loadToolPageWords(locale: Locale, path: string) {
  const tool = liveTools.find((candidate) => toolPath(candidate) === path)
  if (!tool || toolContent[locale][tool.slug]) return
  setToolPageWords(locale, tool.slug, (await toolContentLoaders[locale][tool.slug]()).default as ToolContent)
}

// The Open Graph name of each language (og:locale and og:locale:alternate).
export const openGraphLocales: Record<Locale, string> = { en: 'en_US', ar: 'ar_AR' }

// The pages with a share picture of their own, format, landing and guide pages (public/og/, 1200 x 630, made by scripts/generate-og-images.mjs); every other page
// (About, Privacy, Terms, the changelog) shows the home page's picture in its language.
// The guides, in the order of the /guides index (App.tsx shows them with InfoPage; the header's search lists them).
export const guideAddresses = ['/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing', '/sign-pdf-without-adobe', '/pdf-tools-without-upload']

export const pagesWithShareImage = ['/', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/word-viewer', '/powerpoint-viewer', '/json-formatter', '/json-validator', '/tsv-viewer', '/large-csv-viewer', '/xls-viewer', '/excel-to-csv', '/csv-to-excel', '/excel-to-json', '/csv-to-json', '/json-to-csv', '/mask-data', '/guides', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing', '/sign-pdf-without-adobe', '/pdf-tools-without-upload']

// The live tool and hub pages have one each too, drawn from the registry.
export const registryPagesWithShareImage = [...liveTools.map(toolPath), ...liveHubs.map((hub) => hub.path), ALL_TOOLS_PATH]

export function getShareImage(locale: Locale, address: string) {
  const imageAddress = pagesWithShareImage.includes(address) || registryPagesWithShareImage.includes(address) ? address : '/'
  return {
    path: `/og/${locale}-${imageAddress === '/' ? 'home' : imageAddress.slice(1)}.png`,
    alt: `${SITE_NAME}: ${pageSeo[locale][imageAddress].heading}`,
  }
}
