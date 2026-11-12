// The words search engines and visitors see first for each page: title, description, main heading and the sentence under it.
// Keyed by language ('en', 'ar'), then by page address.
// Plain data whose only import is the tool registry (JSON and types), because scripts/build-static-pages.mjs also reads it to write
// each page's <head> at build time.
//
// Rules for anything added here (see CLAUDE.md, "Writing for search"): the main phrase a person would type comes first in the
// title and the heading; a title is at most 60 characters and a description 150 to 160; every page has its own; say only what
// the page really does (no format that is not built); the heading is the only h1 of the page.
import { liveHubs, liveToolPages, toolContent, toolPath, ALL_TOOLS_PATH } from './tools/registry.ts'

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
  en: 'OpenAnyDoc is a free, open-source viewer, editor and converter for CSV, Excel, JSON and TXT files, and a viewer for Word documents and PowerPoint slides, that runs in your browser: files are never uploaded.',
  ar: 'OpenAnyDoc عارض ومحرر ومحوّل مجاني ومفتوح المصدر لملفات CSV وExcel وJSON وTXT، وعارض لمستندات Word وشرائح PowerPoint، يعمل في متصفحك: لا تُرفع الملفات أبدًا.',
}

type Locale = 'en' | 'ar'

// `linkText`: the short, descriptive name that links to a format or landing page use (header nav, footer, related tools).
// `answer`: a tool page's one sentence under the H1 that answers the search (the tool stays on a phone's first screen; `intro` moves
// under the tool).
export type PageSeo = { title: string; description: string; heading: string; intro: string; answer?: string; linkText?: string }

// Keyed by language, then by the page address: '/' for the home page, the format's toolPath for each format page, the path of
// each landing page (landingPages in viewers.ts).
export const pageSeo: Record<Locale, Record<string, PageSeo>> = {
  en: {
    '/': {
      title: 'Free Online File Viewer and Editor, No Upload – OpenAnyDoc',
      description: 'Free online file viewer and editor: open CSV, Excel, JSON, TXT, Word and PowerPoint files with no software and edit them in your browser. No upload, no sign-up.',
      heading: 'Free online file viewer and editor: open any file, upload nothing',
      intro: 'Drop a CSV, Excel, JSON or text file to edit it, or view Word documents and PowerPoint slides, right here in your browser. A free online file viewer and editor, with no upload and no sign-up.',
    },
    '/csv-viewer': {
      title: 'CSV Viewer Online – Free CSV File Editor, No Upload',
      description: 'CSV viewer online: open a CSV file as a table, search, sort and edit cells, with Arabic text shown correctly, then download it. Free, nothing uploaded.',
      heading: 'CSV Viewer Online and CSV Editor',
      intro: 'A free CSV viewer online and CSV editor: open a CSV or TSV file as a searchable table, view large CSV files (a 120,000-row file opens in under a second) and edit CSV in your browser before you download it. Your file never leaves your device.',
      answer: 'Drop a CSV file to view, edit, sort and search it instantly; nothing is uploaded.',
      linkText: 'CSV viewer',
    },
    '/excel-viewer': {
      title: 'Excel Viewer Online – Open XLSX Files Without Excel',
      description: 'Excel viewer online: open XLSX, XLS and ODS files without Excel, switch between sheet tabs, and edit cells with formulas that recalculate. Free, no upload.',
      heading: 'Excel Viewer Online: Open and Edit XLSX Files',
      intro: 'A free Excel viewer online: open an XLSX file without Excel, with all its sheets, formats and merged cells, edit cells and formulas, and save the workbook in the same format. XLS, XLSM and ODS files open too, and your file never leaves your device.',
      answer: 'Drop an Excel file to view every sheet, edit cells and save it instantly; nothing is uploaded.',
      linkText: 'Excel viewer',
    },
    '/json-viewer': {
      title: 'JSON Viewer Online – Tree View, Formatter & Validator',
      description: 'JSON viewer online: see any JSON file as a tree you can fold, or as a table, then format it, validate it and fix errors by line. Free, nothing is uploaded.',
      heading: 'JSON Viewer Online, Formatter and Editor',
      intro: 'A free JSON viewer online: open a JSON file or paste JSON, explore it as a tree, a table or formatted code, validate it and fix errors by line and column, then pretty print and download it. Your JSON never leaves your device.',
      answer: 'Drop or paste JSON to see it as a tree, format it and find errors instantly; nothing is uploaded.',
      linkText: 'JSON viewer',
    },
    '/txt-viewer': {
      title: 'Open TXT File Online – Free Text Editor, No Upload',
      description: 'Open TXT file online and edit it: find and replace, sort lines, remove duplicates and count words, with Arabic and old encodings read. Nothing uploaded.',
      heading: 'Open TXT File Online: Free Text Viewer and Editor',
      intro: 'Open TXT file online in your browser and read or edit it like a notepad online: search, line numbers, and tools for lines, whitespace and case, with Arabic text shown right to left. Your file never leaves your device.',
      answer: 'Drop a text file to read, search and edit it instantly; nothing is uploaded.',
      linkText: 'TXT editor',
    },
    '/word-viewer': {
      title: 'DOCX Viewer Online – Open Word Documents Free, No Upload',
      description: 'DOCX viewer online: open Word documents as real pages with their fonts, tables and images, Arabic right-to-left, then print or save as PDF. No upload.',
      heading: 'Open Word Document Online: Free DOCX Viewer',
      intro: 'Open a Word document online in your browser: a free DOCX viewer that shows your .docx as pages, with its fonts, tables, images, lists, headers and footers, and Arabic documents right to left. Zoom in, fit the page to your screen, and print it or save it as PDF. Your file never leaves your device.',
      answer: 'Drop a Word document to read it page by page, zoom in and print it; nothing is uploaded.',
      linkText: 'Word viewer',
    },
    '/powerpoint-viewer': {
      title: 'PowerPoint Viewer Online – Open PPTX Free, No Upload (Beta)',
      description: 'PowerPoint viewer online: open PPTX slides with their text, images and tables, flip through thumbnails and present them full screen. No upload.',
      heading: 'PowerPoint Viewer Online (Beta)',
      intro: 'Open a PowerPoint presentation in your browser: a free PPTX viewer, in beta, that shows your slides with their text, images, tables and shapes. Move between them with thumbnails, buttons or the arrow keys, and present them full screen. Animations and some effects are simplified. Your file never leaves your device.',
      answer: 'Drop a PowerPoint file to flip through its slides and present them full screen; nothing is uploaded.',
      linkText: 'PowerPoint viewer (beta)',
    },
    '/json-formatter': {
      title: 'JSON Formatter Online – Beautify and Pretty Print JSON',
      description: 'JSON formatter online: pretty print JSON with 2 or 4 spaces or a tab, minify it to one line or sort its keys, keeping long numbers exact. Free, no upload.',
      heading: 'JSON Formatter Online: Beautify and Minify JSON',
      intro: 'A free JSON formatter online: paste JSON or open a .json file, press Format to pretty print it with the indentation you choose, or Minify to put it on one line. The JSON beautifier keeps long numbers exactly and runs in your browser, so nothing is uploaded.',
      answer: 'Paste or drop JSON and press Format to make it readable instantly; nothing is uploaded.',
      linkText: 'JSON formatter',
    },
    '/json-validator': {
      title: 'JSON Validator Online – Find and Fix JSON Syntax Errors',
      description: 'JSON validator online: check JSON syntax, see the line and column of each error, and repair trailing commas, comments and quotes in one click. No upload.',
      heading: 'JSON Validator Online: Check and Fix JSON',
      intro: 'A free JSON validator online: paste JSON or open a .json file and press Validate. If the JSON is not valid, you see what is wrong with its line and column, Go to error selects the spot, and Repair fixes the usual mistakes. Your JSON is checked in your browser and never uploaded.',
      answer: 'Paste or drop JSON to see whether it is valid and where any error is, instantly; nothing is uploaded.',
      linkText: 'JSON validator',
    },
    '/tsv-viewer': {
      title: 'TSV Viewer Online – Open TSV Files as a Table, No Upload',
      description: 'TSV viewer online: open a TSV or .tab file as a table with the header row detected, then search, sort, edit and save it as TSV again. No upload.',
      heading: 'TSV Viewer Online: Open Tab-Separated Files',
      intro: 'A free TSV viewer online: open a TSV file online and read its tab-separated values as a table, with the header row detected for you. Search, filter, sort and edit the cells, then download it as TSV again. The file is read in your browser and never uploaded.',
      answer: 'Drop a TSV file to see it as a table, then sort, search and edit it instantly; nothing is uploaded.',
      linkText: 'TSV viewer',
    },
    '/large-csv-viewer': {
      title: 'Large CSV File Viewer – Open Big CSV Files Online, Free',
      description: 'Large CSV file viewer: open CSV files with more rows than Excel\'s 1,048,576 limit in your browser, then search, sort and filter them. Free, no upload.',
      heading: 'Large CSV File Viewer: Open Big CSV Files Fast',
      intro: 'A free large CSV file viewer: view large CSV files in your browser, with no row limit of its own and only the rows on screen drawn. In our tests a 120,000-row file opened in 0.9 s, and sorting it by two columns took 0.9 s. Nothing is uploaded, so big exports stay on your device.',
      answer: 'Drop a big CSV file to open, search and sort it in seconds; nothing is uploaded.',
      linkText: 'Large CSV file viewer',
    },
    '/xls-viewer': {
      title: 'XLS Viewer Online – Open Old Excel 97-2003 Files, No Upload',
      description: 'XLS viewer online: open old Excel 97-2003 .xls files without Excel, see every sheet tab, edit cells and formulas and save as .xls again. Free, no upload.',
      heading: 'XLS Viewer Online: Open Excel 97-2003 Files',
      intro: 'A free XLS viewer online: open an XLS file online, the older Excel 97-2003 format, without Excel and without an account. See every sheet with its values, formulas, number formats and merged cells, edit it and save it as .xls again. Fonts and colours are not shown for .xls files.',
      answer: 'Drop an old .xls file to open every sheet and edit it instantly; nothing is uploaded.',
      linkText: 'XLS viewer',
    },
    '/excel-to-csv': {
      title: 'Excel to CSV Converter Online – Free XLSX to CSV, No Upload',
      description: 'Excel to CSV converter online: turn the first sheet of an XLSX, XLS or ODS file into a UTF-8 CSV that keeps Arabic text intact. No upload.',
      heading: 'Excel to CSV Converter Online',
      intro: 'Convert Excel to CSV in your browser: drop an XLSX, XLS or ODS file and its first sheet opens as a CSV in the CSV viewer, where you can edit it, pick another delimiter and download it. Arabic text gets the UTF-8 marker Excel needs. Your file never leaves your device.',
      answer: 'Drop an Excel file and it opens as a CSV, ready to edit and download; nothing is uploaded.',
      linkText: 'Excel to CSV',
    },
    '/csv-to-excel': {
      title: 'CSV to Excel Converter Online – Make an XLSX File, Free',
      description: 'CSV to Excel converter online: turn a CSV or TSV file into an XLSX workbook with a bold header and columns sized to fit, Arabic included. Free, no upload.',
      heading: 'CSV to Excel Converter: Make an XLSX File',
      intro: 'Convert CSV to Excel in your browser: drop a CSV or TSV file and it opens as an .xlsx workbook in the Excel viewer, with a bold header row and each column as wide as its text. Codes with leading zeros stay text. Edit it, then download. Your file never leaves your device.',
      answer: 'Drop a CSV file and it opens as an Excel workbook, ready to edit and download; nothing is uploaded.',
      linkText: 'CSV to Excel',
    },
    '/excel-to-json': {
      title: 'Excel to JSON Converter Online – XLSX to JSON Array, Free',
      description: 'Excel to JSON converter online: turn the first sheet of an XLSX, XLS or ODS file into a JSON array of objects keyed by the header row. No upload.',
      heading: 'Excel to JSON Converter Online',
      intro: 'Convert Excel to JSON in your browser: drop a workbook and its first sheet opens in the JSON viewer as an array of objects, one per row, with the header row as keys. Numbers stay numbers and dates become ISO text. Format, copy or download it there. Nothing is uploaded.',
      answer: 'Drop an Excel file and it opens as JSON, ready to format and download; nothing is uploaded.',
      linkText: 'Excel to JSON',
    },
    '/csv-to-json': {
      title: 'CSV to JSON Converter Online – Free, Private, No Upload',
      description: 'CSV to JSON converter online: turn a CSV file into a JSON array of objects keyed by the header row, with codes and phone numbers kept as text. No upload.',
      heading: 'CSV to JSON Converter Online',
      intro: 'Convert CSV to JSON in your browser: drop or paste a CSV or TSV file and it opens in the JSON viewer as an array of objects, one per row, with the header row as keys. The delimiter and encoding are detected for you. Your file never leaves your device.',
      answer: 'Drop a CSV file and it opens as JSON, ready to format and download; nothing is uploaded.',
      linkText: 'CSV to JSON',
    },
    '/json-to-csv': {
      title: 'JSON to CSV Converter Online – Flatten Nested JSON, Free',
      description: 'JSON to CSV converter online: turn a JSON array into a CSV table, with nested objects flattened into columns like address.city. No upload.',
      heading: 'JSON to CSV Converter: Flatten JSON to a Table',
      intro: 'Convert JSON to CSV in your browser: drop or paste a JSON array of objects and it opens in the CSV viewer with one row per object. Nested objects become columns such as address.city, and lists become items.0, items.1. Edit, filter and download it there. Nothing is uploaded.',
      answer: 'Drop a JSON file and it opens as a CSV table, ready to edit and download; nothing is uploaded.',
      linkText: 'JSON to CSV',
    },
    '/mask-data': {
      title: 'Anonymize CSV Online – Mask Personal Data in Excel and JSON',
      description: 'Anonymize CSV online: find names, emails, phone numbers, IDs, IBANs and cards in CSV, Excel or JSON files and replace them with tokens. Free, no upload.',
      heading: 'Mask Sensitive Data in CSV, Excel and JSON Files',
      intro: 'Find personal data in a CSV, Excel, JSON or text file and mask it in your browser before you share it: replace values with consistent tokens, hide all but the last characters, or remove the field. A private key file can put the values back later. Your file never leaves your device.',
      answer: 'Drop a file to find the personal data in it and mask it before you share it; nothing is uploaded.',
      linkText: 'Mask sensitive data',
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
    '/guides': {
      title: 'Guides: Fix CSV, Excel, JSON and Word File Problems',
      description: 'Practical guides to CSV, Excel, JSON and Word files: open them without Excel or Word, fix broken Arabic and one-column CSVs, and check a site does not upload.',
      heading: 'Guides',
      intro: 'Practical answers to common file problems, each with the free tool that fixes it in your browser.',
      linkText: 'Guides',
    },
    '/pdf-tools': {
      title: 'PDF Tools Online – Merge and Number PDF Files, No Upload',
      description: 'Free PDF tools that run in your browser: merge PDF files into one and add page numbers, with nothing uploaded. No sign-up, no watermark, and they work offline.',
      heading: 'PDF tools',
      intro: 'Free PDF tools that work on your own device: combine PDF files into one and number their pages, without uploading them anywhere.',
      linkText: 'PDF tools',
    },
    '/data-tools': {
      title: 'Data Tools Online – CSV, JSON and Excel Converters, No Upload',
      description: 'Free data tools for CSV, TSV, JSON and Excel files: view large tables, convert between formats, format and validate JSON, and mask personal data. No upload.',
      heading: 'Data tools',
      intro: 'Free tools for tables and data files: open CSV and JSON, convert between CSV, Excel and JSON, check JSON and hide personal data, all in your browser.',
      linkText: 'Data tools',
    },
    '/office-tools': {
      title: 'Office Tools Online – Open Word, Excel and PowerPoint Files',
      description: 'Free office file tools: open Word documents, Excel workbooks, old XLS files, PowerPoint slides and text files in your browser, no Office needed. No upload.',
      heading: 'Office tools',
      intro: 'Open Word, Excel, PowerPoint and text files without installing Office: free viewers that run in your browser and never upload your files.',
      linkText: 'Office tools',
    },
    '/all-tools': {
      title: 'All Free File Tools: PDF, Data and Office – OpenAnyDoc',
      description: 'Every free OpenAnyDoc tool in one place: PDF tools, CSV and JSON converters, data masking, and viewers for Word, Excel and PowerPoint files. Nothing uploaded.',
      heading: 'All tools',
      intro: 'Every tool on OpenAnyDoc, grouped by the kind of file it works on. Each one runs in your browser, and none of them uploads your files.',
      linkText: 'All tools',
    },
  },
  ar: {
    '/': {
      title: 'عارض ملفات اون لاين مجاني – فتح الملفات بدون برامج',
      description: 'عارض ملفات اون لاين مجاني: افتح ملفات CSV وExcel وJSON وTXT وWord وPowerPoint في متصفحك وعدّلها، بدون برامج وبدون تسجيل، وملفاتك لا تُرفع ولا تغادر جهازك.',
      heading: 'عارض ومحرر ملفات اون لاين مجاني: افتح أي ملف بدون رفع',
      intro: 'أفلِت ملف CSV أو Excel أو JSON أو ملفًا نصيًا لتعدّله، أو اعرض مستندات Word وشرائح PowerPoint، هنا في متصفحك مباشرة. عارض ملفات اون لاين مجاني ومحرر للملفات، بدون رفع وبدون تسجيل.',
    },
    '/csv-viewer': {
      title: 'عارض CSV اون لاين – فتح ملف CSV وتعديله مجانًا بدون رفع',
      description: 'عارض CSV اون لاين مجاني: افتح ملف CSV كجدول مع عرض صحيح للحروف العربية، وابحث ورتّب وعدّل الخلايا ثم نزّله. تعديل ملف CSV اون لاين بدون رفع أي ملف.',
      heading: 'عارض CSV اون لاين ومحرر مجاني',
      intro: 'عارض CSV اون لاين مجاني: افتح ملف CSV كجدول تبحث فيه وتفرزه، حتى الملفات الكبيرة (يُفتح ملف من 120,000 صف في أقل من ثانية)، وتظهر الحروف العربية سليمة حتى في ملفات Windows-1256 القديمة. عدّل الخلايا ثم نزّل الملف، وملفك لا يغادر جهازك.',
      answer: 'أفلت ملف CSV لتعرضه وتعدّله وترتّبه وتبحث فيه فورًا؛ لا يُرفع أي شيء.',
      linkText: 'عارض CSV',
    },
    '/excel-viewer': {
      title: 'فتح ملف اكسل اون لاين – عارض ملفات XLSX مجاني بدون برامج',
      description: 'فتح ملف اكسل اون لاين مجانًا: اعرض ملفات XLSX وXLS وODS بكل أوراقها وتنقّل بين تبويباتها، وعدّل الخلايا والصيغ ثم احفظها. بدون برنامج وبدون رفع أي ملف.',
      heading: 'فتح ملف اكسل اون لاين وتعديله بدون برنامج',
      intro: 'فتح ملف اكسل اون لاين بكل أوراقه، بدون برنامج Excel وبدون تسجيل: عارض ملفات XLSX وXLS وXLSM وODS يعرض التنسيقات والخلايا المدمجة، وتعدّل فيه الخلايا والصيغ ثم تحفظ المصنف بصيغته نفسها. ملفك لا يغادر جهازك.',
      answer: 'أفلت ملف Excel لتعرض كل أوراقه وتعدّل خلاياه وتحفظه فورًا؛ لا يُرفع أي شيء.',
      linkText: 'عارض Excel',
    },
    '/json-viewer': {
      title: 'عارض JSON اون لاين – تنسيق JSON وعرض شجري بدون رفع',
      description: 'عارض JSON اون لاين مجاني: اعرض ملف JSON كشجرة قابلة للطي أو كجدول، ونسّقه وتحقق منه وأصلح أخطاءه بالسطر والعمود ثم نزّله. بدون رفع أي ملف إلى أي خادم.',
      heading: 'عارض JSON اون لاين ومنسق ومحرر',
      intro: 'عارض JSON مجاني يعمل في متصفحك: افتح ملف JSON أو الصقه، واستعرضه كشجرة أو جدول أو شيفرة منسقة، وتحقق منه وأصلح أخطاءه بمعرفة السطر والعمود، ثم نسّقه ونزّله. تنسيق JSON اون لاين دون أن يغادر ملفك جهازك.',
      answer: 'أفلت ملف JSON أو الصقه لتراه كشجرة وتنسّقه وتجد أخطاءه فورًا؛ لا يُرفع أي شيء.',
      linkText: 'عارض JSON',
    },
    '/txt-viewer': {
      title: 'فتح ملف TXT اون لاين – محرر نصوص مجاني بدون رفع أو تسجيل',
      description: 'فتح ملف TXT اون لاين وتعديله مجانًا: بحث واستبدال، وفرز الأسطر وحذف المكرر، وعدّ الكلمات، مع قراءة النص العربي والترميزات القديمة. ملفك لا يُرفع أبدًا.',
      heading: 'فتح ملف TXT اون لاين: عارض ومحرر نصوص مجاني',
      intro: 'فتح ملف TXT اون لاين وقراءته وتعديله في متصفحك: محرر نصوص اون لاين مع البحث وأرقام الأسطر وأدوات للأسطر والمسافات وحالة الأحرف، ويعرض النص العربي من اليمين إلى اليسار. ملفك لا يغادر جهازك.',
      answer: 'أفلت ملفًا نصيًا لتقرأه وتبحث فيه وتعدّله فورًا؛ لا يُرفع أي شيء.',
      linkText: 'محرر TXT',
    },
    '/word-viewer': {
      title: 'فتح ملف وورد اون لاين – عارض Word وDOCX مجاني بدون رفع',
      description: 'فتح ملف وورد اون لاين مجانًا: اعرض مستندات Word وDOCX صفحاتٍ بخطوطها وجداولها وصورها، مع دعم العربية من اليمين لليسار والطباعة أو الحفظ PDF. بدون رفع.',
      heading: 'فتح ملف وورد اون لاين: عارض Word وDOCX مجاني',
      intro: 'فتح ملف وورد اون لاين في متصفحك: عارض DOCX مجاني يعرض ملف .docx صفحاتٍ كما هو، بخطوطه وجداوله وصوره وقوائمه وترويساته وتذييلاته، ويعرض المستندات العربية من اليمين إلى اليسار. كبّر وصغّر ولائم الصفحة مع شاشتك، ثم اطبعها أو احفظها PDF. ملفك لا يغادر جهازك.',
      answer: 'أفلت مستند Word لتقرأه صفحةً صفحة وتكبّره وتطبعه؛ لا يُرفع أي شيء.',
      linkText: 'عارض Word',
    },
    '/powerpoint-viewer': {
      title: 'فتح ملف بوربوينت اون لاين – عارض PPTX مجاني (تجريبي)',
      description: 'فتح ملف بوربوينت اون لاين مجانًا: اعرض شرائح PowerPoint وPPTX بنصوصها وصورها وجداولها، وتنقّل بالصور المصغّرة واعرضها بملء الشاشة. ملفك لا يُرفع أبدًا.',
      heading: 'فتح ملف بوربوينت اون لاين (تجريبي)',
      intro: 'فتح ملف بوربوينت اون لاين في متصفحك: عارض PPTX مجاني، في نسخة تجريبية، يعرض شرائحك بنصوصها وصورها وجداولها وأشكالها. تنقّل بينها بالصور المصغّرة أو الأزرار أو مفاتيح الأسهم، واعرضها بملء الشاشة. الحركات وبعض المؤثرات مبسّطة. ملفك لا يغادر جهازك.',
      answer: 'أفلت ملف PowerPoint لتتصفح شرائحه وتعرضها بملء الشاشة؛ لا يُرفع أي شيء.',
      linkText: 'عارض PowerPoint (تجريبي)',
    },
    '/json-formatter': {
      title: 'تنسيق JSON اون لاين – تجميل JSON وتصغيره مجانًا بدون رفع',
      description: 'تنسيق JSON اون لاين مجانًا: اجعل JSON مقروءًا بمسافتين أو أربع مسافات أو علامة جدولة، أو صغّره في سطر واحد، مع الحفاظ على الأرقام الطويلة كما هي. بدون رفع.',
      heading: 'تنسيق JSON اون لاين: تجميل JSON وتصغيره',
      intro: 'أداة مجانية لتنسيق JSON اون لاين: الصق JSON أو افتح ملف .json، ثم اضغط «تنسيق» لعرضه مرتبًا بالمسافة البادئة التي تختارها، أو «تصغير» لجعله في سطر واحد. تحافظ الأداة على الأرقام الطويلة كما هي، وتعمل في متصفحك فلا يُرفع شيء.',
      answer: 'الصق JSON أو أفلت ملفه واضغط «تنسيق» ليصبح مقروءًا فورًا؛ لا يُرفع أي شيء.',
      linkText: 'تنسيق JSON',
    },
    '/json-validator': {
      title: 'التحقق من JSON اون لاين – اكتشاف أخطاء JSON وإصلاحها',
      description: 'التحقق من JSON اون لاين مجانًا: افحص صياغة JSON واعرف سطر كل خطأ وعموده، وأصلح الفواصل الزائدة والتعليقات وعلامات الاقتباس بنقرة. لا يُرفع أي ملف أبدًا.',
      heading: 'التحقق من JSON اون لاين وإصلاح أخطائه',
      intro: 'أداة مجانية للتحقق من JSON اون لاين: الصق JSON أو افتح ملف .json واضغط «تحقّق». إذا لم يكن JSON صالحًا، ترى سبب الخطأ مع رقم السطر والعمود، ويحدد زر «انتقل إلى الخطأ» موضعه، ويصلح زر «إصلاح» الأخطاء المعتادة. يُفحص JSON في متصفحك ولا يُرفع أبدًا.',
      answer: 'الصق JSON أو أفلت ملفه لتعرف إن كان صحيحًا وأين الخطأ فورًا؛ لا يُرفع أي شيء.',
      linkText: 'التحقق من JSON',
    },
    '/tsv-viewer': {
      title: 'فتح ملف TSV اون لاين – عارض TSV مجاني كجدول بدون رفع',
      description: 'فتح ملف TSV اون لاين مجانًا: اعرض ملف TSV أو .tab كجدول مع اكتشاف صف العناوين، ثم ابحث ورتّب وعدّل واحفظه بصيغة TSV من جديد. بدون رفع أي ملف إلى أي خادم.',
      heading: 'فتح ملف TSV اون لاين وعرضه كجدول',
      intro: 'فتح ملف TSV اون لاين مجانًا: تُقرأ القيم المفصولة بعلامات الجدولة كجدول، ويُكتشف صف العناوين تلقائيًا. ابحث في الخلايا وصفِّها ورتّبها وعدّلها، ثم نزّل الملف بصيغة TSV من جديد. يُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
      answer: 'أفلت ملف TSV لتراه جدولًا وترتّبه وتبحث فيه وتعدّله فورًا؛ لا يُرفع أي شيء.',
      linkText: 'عارض TSV',
    },
    '/large-csv-viewer': {
      title: 'عارض ملفات CSV الكبيرة – فتح ملف CSV كبير بسرعة اون لاين',
      description: 'عارض ملفات CSV الكبيرة مجانًا: افتح في متصفحك ملفات CSV فيها صفوف أكثر من حد Excel البالغ 1,048,576 صفًا، وابحث فيها ورتّبها وصفّها. بدون رفع أي ملف.',
      heading: 'عارض ملفات CSV الكبيرة: افتح الملفات الضخمة بسرعة',
      intro: 'عارض ملفات CSV الكبيرة مجاني يعمل في متصفحك: لا حد لعدد الصفوف من عنده، ولا يرسم إلا الصفوف الظاهرة على الشاشة. في اختباراتنا فُتح ملف من 120,000 صف في 0.9 ثانية، واستغرق ترتيبه حسب عمودين 0.9 ثانية. لا يُرفع شيء، فتبقى ملفات التصدير الكبيرة على جهازك.',
      answer: 'أفلت ملف CSV كبيرًا لتفتحه وتبحث فيه وترتّبه في ثوانٍ؛ لا يُرفع أي شيء.',
      linkText: 'عارض ملفات CSV الكبيرة',
    },
    '/xls-viewer': {
      title: 'فتح ملف XLS اون لاين – عارض ملفات Excel 97-2003 مجاني',
      description: 'فتح ملف XLS اون لاين مجانًا: اعرض ملفات Excel 97-2003 القديمة بكل أوراقها بدون برنامج Excel، وعدّل الخلايا والصيغ واحفظها .xls. بدون رفع وبدون تسجيل.',
      heading: 'فتح ملف XLS اون لاين بدون برنامج Excel',
      intro: 'فتح ملف XLS اون لاين مجانًا، وهي صيغة Excel 97-2003 القديمة، بدون برنامج Excel وبدون حساب. تظهر كل الأوراق بقيمها وصيغها وتنسيقات أرقامها وخلاياها المدمجة، وتعدّلها ثم تحفظها بصيغة .xls من جديد. لا تظهر الخطوط والألوان في ملفات .xls.',
      answer: 'أفلت ملف .xls قديمًا لتفتح كل أوراقه وتعدّله فورًا؛ لا يُرفع أي شيء.',
      linkText: 'عارض XLS',
    },
    '/excel-to-csv': {
      title: 'تحويل Excel إلى CSV اون لاين – مجانًا وبدون رفع الملف',
      description: 'تحويل Excel إلى CSV اون لاين مجانًا: حوّل الورقة الأولى من ملف XLSX أو XLS أو ODS إلى ملف CSV بترميز UTF-8 يحافظ على النص العربي سليمًا. بدون رفع أي ملف.',
      heading: 'تحويل Excel إلى CSV اون لاين',
      intro: 'حوّل ملف Excel إلى CSV في متصفحك: أفلت ملف XLSX أو XLS أو ODS فتُفتح ورقته الأولى ملفَّ CSV في عارض CSV، حيث تعدّله وتختار فاصلًا آخر وتنزّله. ويحصل النص العربي على علامة UTF-8 التي يحتاجها Excel. ملفك لا يغادر جهازك.',
      answer: 'أفلت ملف Excel فيُفتح ملف CSV جاهزًا للتعديل والتنزيل؛ لا يُرفع أي شيء.',
      linkText: 'تحويل Excel إلى CSV',
    },
    '/csv-to-excel': {
      title: 'تحويل CSV إلى Excel اون لاين – إنشاء ملف XLSX مجانًا',
      description: 'تحويل CSV إلى Excel اون لاين مجانًا: حوّل ملف CSV أو TSV إلى مصنف XLSX بصف عناوين عريض وأعمدة بعرض محتواها، والنص العربي سليم. بدون رفع أي ملف أبدًا.',
      heading: 'تحويل CSV إلى Excel: أنشئ ملف XLSX',
      intro: 'حوّل ملف CSV إلى Excel في متصفحك: أفلت ملف CSV أو TSV فيُفتح مصنف .xlsx في عارض Excel، بصف عناوين عريض وكل عمود بعرض نصه. تبقى الأرقام التي تبدأ بصفر نصًا كما هي. عدّله ثم نزّله. ملفك لا يغادر جهازك.',
      answer: 'أفلت ملف CSV فيُفتح مصنف Excel جاهزًا للتعديل والتنزيل؛ لا يُرفع أي شيء.',
      linkText: 'تحويل CSV إلى Excel',
    },
    '/excel-to-json': {
      title: 'تحويل Excel إلى JSON اون لاين – من XLSX إلى JSON مجانًا',
      description: 'تحويل Excel إلى JSON اون لاين مجانًا: حوّل الورقة الأولى من ملف XLSX أو XLS أو ODS إلى مصفوفة كائنات JSON مفاتيحها صف العناوين. بدون رفع أي ملف أبدًا.',
      heading: 'تحويل Excel إلى JSON اون لاين',
      intro: 'حوّل ملف Excel إلى JSON في متصفحك: أفلت المصنف فتُفتح ورقته الأولى في عارض JSON مصفوفة كائنات، كائن لكل صف، ومفاتيحها من صف العناوين. تبقى الأرقام أرقامًا وتصبح التواريخ نصًا بصيغة ISO. نسّقه أو انسخه أو نزّله هناك. لا يُرفع شيء.',
      answer: 'أفلت ملف Excel فيُفتح JSON جاهزًا للتنسيق والتنزيل؛ لا يُرفع أي شيء.',
      linkText: 'تحويل Excel إلى JSON',
    },
    '/csv-to-json': {
      title: 'تحويل CSV إلى JSON اون لاين – مجاني وخاص وبدون رفع',
      description: 'تحويل CSV إلى JSON اون لاين مجانًا: حوّل ملف CSV إلى مصفوفة كائنات JSON مفاتيحها صف العناوين، وتبقى الرموز وأرقام الهواتف نصًا كما هي. لا يُرفع أي ملف.',
      heading: 'تحويل CSV إلى JSON اون لاين',
      intro: 'حوّل ملف CSV إلى JSON في متصفحك: أفلت ملف CSV أو TSV أو الصقه فيُفتح في عارض JSON مصفوفة كائنات، كائن لكل صف، ومفاتيحها من صف العناوين. يُكتشف الفاصل والترميز تلقائيًا. ملفك لا يغادر جهازك.',
      answer: 'أفلت ملف CSV فيُفتح JSON جاهزًا للتنسيق والتنزيل؛ لا يُرفع أي شيء.',
      linkText: 'تحويل CSV إلى JSON',
    },
    '/json-to-csv': {
      title: 'تحويل JSON إلى CSV اون لاين – تسطيح JSON المتداخل مجانًا',
      description: 'تحويل JSON إلى CSV اون لاين مجانًا: حوّل مصفوفة كائنات JSON إلى جدول CSV، وتصبح الكائنات المتداخلة أعمدة بأسماء مثل address.city. بدون رفع أي ملف أبدًا.',
      heading: 'تحويل JSON إلى CSV: من JSON إلى جدول',
      intro: 'حوّل JSON إلى CSV في متصفحك: أفلت أو الصق مصفوفة كائنات JSON فتُفتح في عارض CSV بصف لكل كائن. تصبح الكائنات المتداخلة أعمدة مثل address.city، والقوائم أعمدة مثل items.0 وitems.1. عدّله وصفِّه ونزّله هناك. لا يُرفع شيء.',
      answer: 'أفلت ملف JSON فيُفتح جدول CSV جاهزًا للتعديل والتنزيل؛ لا يُرفع أي شيء.',
      linkText: 'تحويل JSON إلى CSV',
    },
    '/mask-data': {
      title: 'إخفاء البيانات الحساسة في CSV وExcel وJSON – مجاني وخاص',
      description: 'إخفاء البيانات الحساسة اون لاين: اعثر على الأسماء والبريد وأرقام الجوال والهويات والآيبان والبطاقات في ملفات CSV وExcel وJSON واستبدلها برموز. بدون رفع.',
      heading: 'إخفاء البيانات الحساسة في ملفات CSV وExcel وJSON',
      intro: 'اعثر على البيانات الشخصية في ملف CSV أو Excel أو JSON أو ملف نصي وأخفِها في متصفحك قبل مشاركته: استبدل القيم برموز ثابتة، أو أخفِ كل شيء عدا آخر الأحرف، أو احذف الحقل. ويمكن لملف مفتاح خاص أن يعيد القيم لاحقًا. لا يغادر ملفك جهازك.',
      answer: 'أفلت ملفًا لتجد البيانات الشخصية فيه وتخفيها قبل مشاركته؛ لا يُرفع أي شيء.',
      linkText: 'إخفاء البيانات الحساسة',
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
    '/guides': {
      title: 'أدلة: حل مشكلات ملفات CSV وExcel وJSON ووورد',
      description: 'أدلة عملية لملفات CSV وExcel وJSON ووورد: افتحها دون Excel أو Word، وأصلح العربية المشوّهة وملف CSV في عمود واحد، وتحقق من أن الموقع لا يرفع ملفك أبدًا.',
      heading: 'الأدلة',
      intro: 'إجابات عملية لمشكلات الملفات الشائعة، مع الأداة المجانية التي تحلها في متصفحك.',
      linkText: 'الأدلة',
    },
    '/pdf-tools': {
      title: 'أدوات PDF على الإنترنت – دمج ملفات PDF وترقيمها دون رفع',
      description: 'أدوات PDF مجانية تعمل في متصفحك: ادمج ملفات PDF في ملف واحد وأضف أرقام الصفحات دون رفع أي شيء. دون تسجيل ودون علامة مائية، وتعمل أيضًا دون اتصال بالإنترنت.',
      heading: 'أدوات PDF',
      intro: 'أدوات PDF مجانية تعمل على جهازك: اجمع ملفات PDF في ملف واحد ورقّم صفحاتها، دون رفعها إلى أي مكان.',
      linkText: 'أدوات PDF',
    },
    '/data-tools': {
      title: 'أدوات البيانات – تحويل CSV وJSON وExcel دون رفع الملفات',
      description: 'أدوات مجانية لملفات CSV وTSV وJSON وExcel: اعرض الجداول الكبيرة، وحوّل بين الصيغ، ونسّق JSON وتحقق منه، وأخفِ البيانات الشخصية. كل ذلك في متصفحك دون رفع أي ملف.',
      heading: 'أدوات البيانات',
      intro: 'أدوات مجانية للجداول وملفات البيانات: افتح CSV وJSON، وحوّل بين CSV وExcel وJSON، وتحقق من JSON، وأخفِ البيانات الشخصية، كل ذلك في متصفحك.',
      linkText: 'أدوات البيانات',
    },
    '/office-tools': {
      title: 'أدوات المكتب – افتح ملفات Word وExcel وPowerPoint دون Office',
      description: 'أدوات مجانية لملفات المكتب: افتح مستندات Word ومصنفات Excel وملفات XLS القديمة وشرائح PowerPoint والملفات النصية في متصفحك دون Office. لا يُرفع أي ملف أبدًا.',
      heading: 'أدوات المكتب',
      intro: 'افتح ملفات Word وExcel وPowerPoint والملفات النصية دون تثبيت Office: عارضات مجانية تعمل في متصفحك ولا ترفع ملفاتك أبدًا.',
      linkText: 'أدوات المكتب',
    },
    '/all-tools': {
      title: 'كل أدوات الملفات المجانية: PDF والبيانات والمكتب – OpenAnyDoc',
      description: 'كل أدوات OpenAnyDoc المجانية في مكان واحد: أدوات PDF، ومحوّلات CSV وJSON، وإخفاء البيانات، وعارضات ملفات Word وExcel وPowerPoint. لا يُرفع أي ملف إلى أي خادم.',
      heading: 'كل الأدوات',
      intro: 'كل أدوات OpenAnyDoc مرتبة حسب نوع الملف الذي تعمل عليه. كلها تعمل في متصفحك، ولا ترفع أي منها ملفاتك.',
      linkText: 'كل الأدوات',
    },
  },
}

// The tool pages drawn by src/pages/ToolPage.tsx take their words from src/content/tools/<slug>.<locale>.json (through the
// registry); they join pageSeo here so the build, the breadcrumb, the search and the share images treat them like any page.
for (const locale of ['en', 'ar'] as const) {
  for (const tool of liveToolPages) {
    const content = toolContent[locale][tool.slug]
    pageSeo[locale][toolPath(tool)] = { title: content.title, description: content.description, heading: content.heading, intro: content.subtitle, answer: content.subtitle, linkText: content.linkText }
  }
}

// The Open Graph name of each language (og:locale and og:locale:alternate).
export const openGraphLocales: Record<Locale, string> = { en: 'en_US', ar: 'ar_AR' }

// The pages with a share picture of their own, format, landing and guide pages (public/og/, 1200 x 630, made by scripts/generate-og-images.mjs); every other page
// (About, Privacy, Terms, the changelog) shows the home page's picture in its language.
// The guides, in the order of the /guides index (App.tsx shows them with InfoPage; the header's search lists them).
export const guideAddresses = ['/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing']

export const pagesWithShareImage = ['/', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/word-viewer', '/powerpoint-viewer', '/json-formatter', '/json-validator', '/tsv-viewer', '/large-csv-viewer', '/xls-viewer', '/excel-to-csv', '/csv-to-excel', '/excel-to-json', '/csv-to-json', '/json-to-csv', '/mask-data', '/guides', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing']

// The live tool and hub pages have one each too, drawn from the registry.
export const registryPagesWithShareImage = [...liveToolPages.map(toolPath), ...liveHubs.map((hub) => hub.path), ALL_TOOLS_PATH]

export function getShareImage(locale: Locale, address: string) {
  const imageAddress = pagesWithShareImage.includes(address) || registryPagesWithShareImage.includes(address) ? address : '/'
  return {
    path: `/og/${locale}-${imageAddress === '/' ? 'home' : imageAddress.slice(1)}.png`,
    alt: `${SITE_NAME}: ${pageSeo[locale][imageAddress].heading}`,
  }
}
