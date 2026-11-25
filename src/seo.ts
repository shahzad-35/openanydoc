// The words search engines and visitors see first for each page: title, description, main heading and the sentence under it.
// Keyed by language ('en', 'ar'), then by page address.
// Plain data whose only import is the tool registry (JSON and types), because scripts/build-static-pages.mjs also reads it to write
// each page's <head> at build time.
//
// Rules for anything added here: the main phrase a person would type comes first in the
// title and the heading; a title is at most 60 characters and a description 150 to 160; every page has its own; say only what
// the page really does (no format that is not built); the heading is the only h1 of the page.
import { liveHubs, liveTools, toolContent, toolContentLoaders, toolPath, ALL_TOOLS_PATH } from './tools/registry.ts'
import type { ToolContent } from './tools/registry.ts'

export const SITE_ORIGIN = 'https://www.openanydoc.com'
export const SITE_NAME = 'OpenAnyDoc'
export const AUTHOR_NAME = 'OpenAnyDoc'
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
  en: 'OpenAnyDoc is a free, open-source set of file tools that runs in your browser: a viewer, editor and converter for CSV, Excel, JSON and TXT files, viewers for Word, PowerPoint, PDF, image and video files, and PDF, Office, image, video and AI tools. Files are never uploaded.',
  ar: 'OpenAnyDoc مجموعة أدوات ملفات مجانية ومفتوحة المصدر تعمل في متصفحك: عارض ومحرر ومحوّل لملفات CSV وExcel وJSON وTXT، وعارضات لملفات Word وPowerPoint وPDF والصور والفيديو، وأدوات PDF والمكتب والصور والفيديو والذكاء الاصطناعي. لا تُرفع الملفات أبدًا.',
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
      description: 'Free online file viewer and editor: open CSV, Excel, JSON, Word, PowerPoint, PDF, image and video files in your browser and edit them. No upload, no sign-up.',
      heading: 'Free online file viewer and editor: open any file, upload nothing',
      intro: 'Drop a CSV, Excel, JSON or text file to edit it, view Word, PowerPoint and PDF files, or edit, sign and merge PDFs, right here in your browser. A free online file viewer and editor, with no upload and no sign-up.',
    },
    '/about': {
      title: 'About OpenAnyDoc – Private Online File Viewer',
      description: 'About OpenAnyDoc: free file tools for CSV, Excel, JSON, Word, PowerPoint, PDF, image and video files that run in your browser and never upload your files.',
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
      title: 'PDF Tools Without Upload: What iLovePDF and PDF24 Do With Files',
      description: 'How iLovePDF, PDF24 and Sejda handle your PDF, from their own pages, where they do more, and free browser PDF tools that keep the file on your device.',
      heading: 'PDF tools that do not upload your file',
      intro: 'How popular PDF sites handle your file, where they do more, and the tools that keep a PDF on your own device.',
      linkText: 'PDF tools without upload',
    },
    '/open-txt-file': {
      title: 'How to Open a TXT File: Which Program to Use on Any Device',
      description: 'Which program opens a .txt file: Notepad on Windows, TextEdit on a Mac, Files on iPhone, Android apps or a browser, and how to fix text with strange characters.',
      heading: 'How to open a TXT file: which program to use on any device',
      intro: 'The program that opens a text file on Windows, Mac, iPhone and Android, how to read one in a browser, and how to fix text that shows strange characters.',
      linkText: 'How to open a TXT file',
    },
    '/open-csv-without-excel': {
      title: 'How to Open a CSV File Without Excel: Free Ways, No Upload',
      description: 'Open a CSV without Excel for free: in your browser with no upload, Google Sheets, LibreOffice, Numbers or a text editor, plus fixes for big files and Arabic.',
      heading: 'How to open a CSV file without Excel',
      intro: 'The free options, which of them upload your file, and what to do when a CSV is too big, lands in one column or shows broken Arabic.',
      linkText: 'Open CSV without Excel',
    },
    '/open-pptx-without-powerpoint': {
      title: 'How to Open a PPTX File Without PowerPoint: Free Options',
      description: 'Free ways to open a .pptx file without PowerPoint: in your browser with no upload, Google Slides, LibreOffice Impress, Keynote or a phone, and old .ppt files.',
      heading: 'How to open a PPTX file without PowerPoint',
      intro: 'The free options, which of them upload your presentation, which of them edit it, and what to do with an old .ppt file.',
      linkText: 'Open PPTX without PowerPoint',
    },
    '/open-pdf-without-adobe': {
      title: 'How to Open a PDF Without Adobe: Free Ways on Any Device',
      description: 'Open a PDF without Adobe Reader: any browser, Preview on Mac, Files on iPhone, Drive on Android, why a PDF will not open, and how to fill and sign it for free.',
      heading: 'How to open a PDF without Adobe',
      intro: 'The free programs every computer and phone already has, why a PDF sometimes will not open, and how to fill in and sign one without Adobe.',
      linkText: 'Open PDF without Adobe',
    },
    '/fix-arabic-text-copied-from-pdf': {
      title: 'Arabic Text Reversed When Copied From a PDF? How to Fix It',
      description: 'Why Arabic text copied from a PDF comes out reversed or with broken letters, and how to copy it in reading order in your browser with no upload, scans too.',
      heading: 'Why Arabic text copied from a PDF comes out reversed, and how to fix it',
      intro: 'What a PDF stores instead of sentences, why Arabic copies backwards, and how to get the text out in reading order without uploading the file.',
      linkText: 'Arabic text from a PDF reversed',
    },
    '/cant-edit-text-in-pdf': {
      title: 'Why Can\'t I Edit Text in a PDF? The Reasons and Free Fixes',
      description: 'Why a PDF\'s text can\'t be edited like a Word file, and what to do: add text on top, convert it to Word, or read a scan with OCR first, free and with no upload.',
      heading: 'Why can\'t I edit the text in a PDF?',
      intro: 'Why PDFs have no paragraphs to edit, how to change a few words or rewrite whole pages, and what to do when the PDF is a scan.',
      linkText: 'Can\'t edit text in a PDF',
    },
    '/fill-pdf-form-without-acrobat': {
      title: 'Fill a PDF Form Without Acrobat, on a Computer or Phone',
      description: 'Fill in a PDF form without Adobe Acrobat: fillable fields or a flat page, on a computer or phone, then flatten and sign it. Free in your browser, no upload.',
      heading: 'How to fill in a PDF form without Acrobat',
      intro: 'How to tell a fillable form from a flat one, how to fill in each kind on a computer or phone, and how to flatten and sign it before you send it.',
      linkText: 'Fill a PDF form without Acrobat',
    },
    '/stirling-pdf-alternative': {
      title: 'Stirling-PDF Alternative That Runs in Your Browser',
      description: 'Stirling-PDF vs a browser-only PDF toolkit: where files are processed, what you must host, plans and limits, from its own pages, and where Stirling does more.',
      heading: 'A Stirling-PDF alternative that needs no server',
      intro: 'How Stirling-PDF handles your files, where it does more, and PDF tools that keep every file on the employee\'s own device.',
      linkText: 'Stirling-PDF alternative',
    },
    '/jsonformatter-alternative': {
      title: 'jsonformatter.org Alternative That Keeps JSON in Your Browser',
      description: 'How jsonformatter.org and Code Beautify handle pasted JSON, from their own pages, and a JSON formatter and validator that keeps keys and tokens on your device.',
      heading: 'A jsonformatter.org and Code Beautify alternative',
      intro: 'What the popular JSON sites say about saving, sharing and loading your data, where they do more, and JSON tools that keep it in your browser.',
      linkText: 'JSON formatter alternative',
    },
    '/reduce-photo-file-size': {
      title: 'How to Get a Photo Under 1 MB for Email or an Upload Form',
      description: 'Get a photo under 1 MB or any upload limit: resize first, pick the right quality and format, then check the result. Done in your browser, nothing uploaded.',
      heading: 'How to reduce a photo\'s file size for email or a form',
      intro: 'Resize, quality and format, in the order that saves the most, and how to check the file before a form refuses it.',
      linkText: 'Reduce photo file size',
    },
    '/open-heic-on-windows': {
      title: 'Open HEIC Photos on Windows Without Installing Anything',
      description: 'Why Windows won\'t open iPhone HEIC photos, how to view or convert them to JPG in your browser with nothing to install, and how to make the iPhone shoot JPG.',
      heading: 'How to open iPhone HEIC photos on Windows',
      intro: 'What a HEIC file is, why Windows needs an add-on for it, and how to open or convert one in any browser without uploading it.',
      linkText: 'Open HEIC on Windows',
    },
    '/remove-location-from-photo': {
      title: 'Remove Location from a Photo Before You Post or Send It',
      description: 'What GPS, camera and date details a phone photo carries, how to check them, how to remove them without losing quality, and phone settings that leave them out.',
      heading: 'How to remove the location from a photo',
      intro: 'What a photo file reveals, how to see it, and how to send a clean copy without uploading the original anywhere.',
      linkText: 'Remove location from a photo',
    },
    '/remove-background-without-upload': {
      title: 'Removing a Photo Background: What Works Well and What to Avoid',
      description: 'Cut a person or object out of a photo with an on-device AI model in your browser: transparent PNG or white, what works well, and options already on your phone.',
      heading: 'How to remove a photo\'s background without uploading it',
      intro: 'How an on-device model cuts out the subject, what the first use loads, which photos work best and which to avoid.',
      linkText: 'Remove background without upload',
    },
    '/spreadsheet-to-ai-chat': {
      title: 'Spreadsheet to AI Chat: Paste a Table It Can Actually Read',
      description: 'How to give ChatGPT, Claude or Gemini a spreadsheet it can read: Markdown table or CSV, one sheet at a time, size in tokens, formulas, and hiding personal data.',
      heading: 'How do I give an AI chat a spreadsheet it can read?',
      intro: 'Turn one sheet into a Markdown table, check its size in tokens and hide personal data before you paste it into a chat.',
      linkText: 'Spreadsheet to AI chat',
    },
    '/make-markdown-table-from-csv': {
      title: 'Markdown Tables from CSV: Alignment, Pipes and Wide Tables',
      description: 'Turn a CSV into a Markdown table for a README, docs or AI chat: header and separator lines, column alignment, pipes and line breaks in cells, and wide tables.',
      heading: 'How to make a Markdown table from a CSV file',
      intro: 'What a Markdown table is made of, how to align its columns, and what to do about pipes, line breaks and wide tables.',
      linkText: 'Markdown table from CSV',
    },
    '/what-is-toon-format': {
      title: 'What Is TOON Format? JSON vs TOON and When It Saves Tokens',
      description: 'TOON (Token-Oriented Object Notation) explained: what it looks like next to JSON, how to read it, and measured token counts for uniform lists and nested data.',
      heading: 'What is the TOON format, and when does it save tokens?',
      intro: 'TOON writes the same data as JSON in fewer tokens, but only for some shapes of data. Here is what it looks like and what our own counts showed.',
      linkText: 'What is TOON?',
    },
    '/convert-excel-to-json-for-api': {
      title: 'Convert Excel to JSON for an API: Keys, Types, Dates, Nulls',
      description: 'Turn an Excel sheet into JSON an API or app can use: header row to keys, numbers vs text, leading zeros, ISO dates, empty cells as null, and picking the sheet.',
      heading: 'How to convert an Excel sheet to JSON for an API',
      intro: 'Prepare the header row, know how numbers, dates and empty cells come out, and get an array of objects your code can send.',
      linkText: 'Excel to JSON for an API',
    },
    '/split-large-csv': {
      title: 'How to Split a Big CSV for Excel\'s Row Limit, Header Kept',
      description: 'Split a big CSV by rows or size with the header row in every part: for Excel\'s 1,048,576 rows, upload limits or AI chats. Free, in your browser, no upload.',
      heading: 'How to split a large CSV file into smaller files',
      intro: 'Split a big CSV by rows or size with the header in every part, a worked example for Excel, and the command-line way explained fairly.',
      linkText: 'Split a large CSV',
    },
    '/json-vs-json-lines': {
      title: 'JSON vs JSON Lines (.jsonl, NDJSON): The Difference',
      description: 'JSON holds one value; JSON Lines (.jsonl, NDJSON) holds one per line. When each is used (logs, exports, AI batch files) and how to open and convert them.',
      heading: 'JSON vs JSON Lines: what is the difference?',
      intro: 'What changes when JSON is written one record per line, where each format is used, and how to open and convert a .jsonl file.',
      linkText: 'JSON vs JSON Lines',
    },
    '/compare-two-json-files': {
      title: 'Why a Text Diff Misleads on JSON, and How to Compare by Key',
      description: 'Compare two JSON files by key, not by line: see added, removed and changed values with their paths, ignore key order, and read a worked before/after example.',
      heading: 'How to compare two JSON files and see what changed',
      intro: 'Why a text diff misleads, what a JSON comparison reports, and a worked example with a before and after file.',
      linkText: 'Compare two JSON files',
    },
    '/excel-row-and-column-limits': {
      title: 'Excel Row and Column Limits: Rows, Columns, Cells, Digits',
      description: 'Excel\'s limits from Microsoft\'s own list: 1,048,576 rows, 16,384 columns, 32,767 characters a cell, 15 digits, and what to do when your data is bigger.',
      heading: 'What are Excel\'s row and column limits?',
      intro: 'Every Excel limit worth knowing, from Microsoft\'s own list, what each one means for a real file, and what to do when your data goes past them.',
      linkText: 'Excel row and column limits',
    },
    '/find-hidden-sheets-in-excel': {
      title: 'Find Hidden Sheets in Excel, Including Very Hidden Ones',
      description: 'How to find hidden and very hidden sheets, hidden rows and columns, and every formula in an Excel workbook, in Excel or in your browser with nothing uploaded.',
      heading: 'How do I find hidden sheets, rows and formulas in an Excel file?',
      intro: 'The four places a workbook hides things, how to see them all in your browser, and how to unhide them in Excel, very hidden sheets included.',
      linkText: 'Find hidden sheets in Excel',
    },
    '/excel-to-csv-without-breaking-arabic': {
      title: 'Excel to CSV Without Breaking Arabic: UTF-8 and the BOM',
      description: 'Convert Excel to CSV and keep Arabic readable: why letters turn into ? or symbols, what UTF-8 and the BOM do, and how to save a CSV that Excel opens correctly.',
      heading: 'How do I convert Excel to CSV without breaking Arabic text?',
      intro: 'Why Arabic gets lost when a workbook is saved as CSV, what the bytes look like, and how to write a UTF-8 CSV with the mark Excel needs.',
      linkText: 'Excel to CSV with Arabic',
    },
    '/read-speaker-notes-without-powerpoint': {
      title: 'Read Speaker Notes Without PowerPoint: View, Search, Export',
      description: 'Read the speaker notes in a .pptx without PowerPoint: see them under each slide, search them, hear them read aloud and export them as text, with no upload.',
      heading: 'How to read speaker notes without PowerPoint',
      intro: 'Where the notes sit in a .pptx file, how to read, search, hear and export them in your browser, and what PowerPoint, Google Slides and Keynote offer.',
      linkText: 'Read speaker notes',
    },
    '/compress-video-without-upload': {
      title: 'Video Too Big for Email or WhatsApp? Work Out the Size You Need',
      description: 'Make a video small enough for email, WhatsApp or a form: what makes it big, the size arithmetic, real limits, and how to shrink it in your browser, no upload.',
      heading: 'How to compress a video without uploading it',
      intro: 'Why videos are big, how to work out the size you can reach, the limits of common places, and how to compress one on your own device.',
      linkText: 'Compress video without upload',
    },
    '/file-too-large-for-chatgpt': {
      title: 'File Too Large for ChatGPT? How to Cut It Down to Size',
      description: 'Why ChatGPT, Claude or Gemini refuse a big file, the upload and token limits from their help pages, and how to count, split and shrink it in your browser.',
      heading: 'What to do when a file is too large for ChatGPT',
      intro: 'The two limits an AI chat sets, a measured example, and the steps to cut a PDF, Word, Excel or CSV file down to a size it can read.',
      linkText: 'File too large for AI chat',
    },
    '/best-free-csv-viewers': {
      title: 'Best Free CSV Viewers: Six Free Ways to Open a CSV File',
      description: 'Six free ways to open a CSV file, from a browser viewer that uploads nothing to Google Sheets, LibreOffice Calc and desktop CSV apps, with each one\'s limits.',
      heading: 'What is the best free CSV viewer?',
      intro: 'Six free ways to open and view a CSV file, what each one does well, and the limits its own pages state.',
      linkText: 'Best free CSV viewers',
    },
    '/best-free-json-formatters': {
      title: 'Best Free JSON Formatters That Don\'t Store Your Data',
      description: 'Six free JSON formatters compared by what their own pages say about your data: browser tools, a code editor, a terminal tool, and websites that keep JSON local.',
      heading: 'Which free JSON formatters don\'t store your data?',
      intro: 'Six free ways to pretty print JSON, and exactly what each one\'s own pages say about where your JSON goes.',
      linkText: 'Best free JSON formatters',
    },
    '/openanydoc-vs-google-sheets-large-files': {
      title: 'OpenAnyDoc vs Google Sheets vs Excel for Large CSV Files',
      description: 'Large CSV files compared: Google Sheets\' 20 million cells, Excel\'s 1,048,576 rows, Excel for the web\'s size limits, and a browser viewer with no row limit.',
      heading: 'OpenAnyDoc vs Google Sheets vs Excel: which opens large CSV files?',
      intro: 'The official limits of Google Sheets, Excel and Excel for the web, what OpenAnyDoc does with a big CSV, and where each one does more.',
      linkText: 'Large CSV: OpenAnyDoc vs Sheets',
    },
    '/large-csv-test': {
      title: 'Large CSV Test: Try 3 Million Rows in 6 Tools Yourself',
      description: 'A test you can run: one synthetic 3-million-row CSV in Excel, Google Sheets, LibreOffice, a text editor and OpenAnyDoc, with the limits that decide the outcome.',
      heading: 'How to test a 3-million-row CSV in 6 tools',
      intro: 'One synthetic file with 3,000,000 rows, six tools, the official limits that decide the outcome, and the steps to run the test yourself.',
      linkText: '3-million-row CSV test',
    },
    '/pdf-to-ai-chat-with-tables': {
      title: 'PDF to ChatGPT Without Losing Tables: Paste It as Markdown',
      description: 'Why tables break when you copy a PDF into ChatGPT, Claude or Gemini, how Markdown keeps rows and columns, and how to convert in your browser with no upload.',
      heading: 'How to give ChatGPT a PDF without losing the tables',
      intro: 'Why copied PDF tables run together, how Markdown keeps every row and column, and what to check before you paste.',
      linkText: 'PDF tables in an AI chat',
    },
    '/how-many-tokens-is-my-pdf': {
      title: 'How Many Tokens Is My PDF? Count It Before You Paste',
      description: 'What a token is, why Arabic, tables and the AI model change the count, why pages are a poor guide, and how to count a PDF\'s tokens in your browser, no upload.',
      heading: 'How many tokens is my PDF?',
      intro: 'What decides a PDF\'s token count, measured examples in English, Arabic and a table, and how to count your own file exactly.',
      linkText: 'Tokens in a PDF',
    },
    '/word-document-to-ai-chat': {
      title: 'Word Document to AI Chat Without Losing Headings or Lists',
      description: 'Give a Word .docx file to ChatGPT, Claude or Gemini with its headings, lists and links kept as Markdown, plus a step for tables. In your browser, no upload.',
      heading: 'How to give a Word document to an AI chat and keep its structure',
      intro: 'Why pasted Word text loses its outline, what Markdown keeps, how to handle tables, and what to check before you paste.',
      linkText: 'Word document to AI chat',
    },
    '/powerpoint-to-ai-chat': {
      title: 'PowerPoint to AI Chat: Slide Titles and Notes as Text',
      description: 'Give a PowerPoint deck to ChatGPT, Claude or Gemini as a text outline with slide titles, bullet points and speaker notes, made in your browser with no upload.',
      heading: 'How to give a PowerPoint presentation to an AI chat',
      intro: 'Turn a deck into an outline an AI chat can work through slide by slide, with the speaker notes, and know what the outline leaves out.',
      linkText: 'PowerPoint to AI chat',
    },
    '/how-to-merge-pdf-files': {
      title: 'How to Merge PDF Files on Mac, Windows, iPhone and Android',
      description: 'Merge PDF files on any device: Preview on a Mac, Files or Shortcuts on iPhone, the browser on Windows and Android, plus page order, photos and file size.',
      heading: 'How to merge PDF files on any device',
      intro: 'The free ways to combine PDFs on a computer or phone, which of them need no install, and how to handle order, photos, blank pages and size.',
      linkText: 'Merge PDF files on any device',
    },
    '/how-to-split-a-pdf': {
      title: 'How to Split a PDF: Separate Pages or Save Only Some',
      description: 'Split a PDF into separate files by page ranges, every few pages or one per page, or save only the pages you need, in the browser or with Preview and Edge.',
      heading: 'How to split a PDF or save only some pages',
      intro: 'Which tool fits which job, how to write page ranges, one file per page in a ZIP, and the free ways already on your computer.',
      linkText: 'Split a PDF',
    },
    '/photos-to-one-pdf': {
      title: 'Phone Photos to One PDF: HEIC, Page Order and Page Size',
      description: 'Turn phone photos into one PDF: pick JPG, HEIC or PNG pictures, set their order, page size and margins, straighten document photos and keep the file small.',
      heading: 'How to turn phone photos into one PDF',
      intro: 'Order, page size and margins, photos of paper documents, and how to keep the PDF small enough to send.',
      linkText: 'Photos to one PDF',
    },
    '/password-protect-pdf-free': {
      title: 'PDF Password vs Restrictions: What Each One Really Protects',
      description: 'Password-protect a PDF for free: the password to open versus print and copy restrictions, what a password stops, how to send it, and how to remove it later.',
      heading: 'How to password-protect a PDF',
      intro: 'The two kinds of PDF password, what each one really protects, and how to share a locked file safely.',
      linkText: 'Password-protect a PDF',
    },
    '/make-scanned-pdf-searchable': {
      title: 'Why a Scanned PDF Isn\'t Searchable and How OCR Fixes It',
      description: 'Make a scanned PDF searchable: what OCR does, English and Arabic, why it need not upload your file, how accurate it is, and how to get the text into Word.',
      heading: 'How to make a scanned PDF searchable',
      intro: 'What text recognition adds to a scan, where it runs, how far to trust it, and what to do with the text afterwards.',
      linkText: 'Make a scanned PDF searchable',
    },
    '/guides': {
      title: 'Guides: Open and Fix CSV, Excel, Word, PDF and TXT Files',
      description: 'Practical guides: open TXT, CSV, Excel, Word, PowerPoint and PDF files without the program they came from, fix broken Arabic and one-column CSVs, and more.',
      heading: 'Guides to opening and fixing CSV, Excel, Word, PowerPoint, PDF and text files',
      intro: 'Practical answers to the questions people ask about their files, from which program opens a TXT file to why a CSV shows broken Arabic, each with the free tool that solves it in your browser.',
      linkText: 'Guides',
    },
    '/pdf-tools': {
      title: 'PDF Tools Online – Compress, Edit, Merge, Convert, No Upload',
      description: 'Free PDF tools in your browser: compress, edit, sign, merge and split PDFs, convert to and from Word, Excel and JPG, OCR and protect them. Nothing is uploaded.',
      heading: 'Free PDF tools that never upload your file',
      intro: 'Free PDF tools that work on your own device: compress a PDF, convert it to and from Word, Excel and PowerPoint, add text, highlights, drawings and a signature, fill in forms, add watermarks, headers and page numbers, merge, split and organize pages, and turn pictures into a PDF and pages into pictures or text, without uploading anything.',
      linkText: 'PDF tools',
      body: [
        'Every PDF tool here runs on your own device. Your browser reads the PDF, changes it and hands you a new file; nothing is sent to a server, so contracts, invoices and forms stay private, and each tool keeps working offline once you have used it.',
        'To change which pages a PDF has, use Merge, Split, Remove pages, Extract pages or Organize. To change what is on the pages, use Edit PDF for text boxes, highlights, drawings and shapes, Sign PDF for a drawn, typed or uploaded signature, Fill PDF form for form fields, and Watermark, Header and footer or Add page numbers for text on every page. To change the format, turn pictures into a PDF with JPG to PDF, or a PDF into pictures, text or its embedded images.',
        'To make a PDF smaller or fix it, use Compress PDF (pictures re-saved at the quality you choose, with the size shown before and after), PDF to grayscale, Repair PDF, or OCR PDF to make a scan searchable. To move between formats, Word, Excel, PowerPoint, Markdown, HTML, text and CSV files become PDFs with text you can still search, and PDF to Word, Excel or PowerPoint turns a PDF back into an editable file. To keep a PDF safe, Protect PDF adds a password, Redact PDF removes text for good, Flatten PDF locks form values, and Remove PDF metadata clears the author and dates.',
        'Each tool shows a preview before you download, and its next steps pass the result to another tool in memory, so you can merge, number and sign a PDF in one visit.',
      ],
    },
    '/video-tools': {
      title: 'Video Tools Online – Convert, Compress, Trim, No Upload',
      description: 'Free video tools in your browser: convert MOV, WebM and MKV to MP4, compress, trim, crop and merge videos, make GIFs and MP3s, record your screen. No upload.',
      heading: 'Free video tools: convert, compress, trim and edit videos',
      intro: 'Free video tools that work on your own device: convert MOV, WebM and MKV to MP4, make a video smaller, trim, crop, rotate, resize, merge or loop it, change its speed, mute it or give it new sound, turn it into a GIF or an MP3, and record your screen or webcam.',
      linkText: 'Video tools',
      body: [
        'Every video tool here runs on your own device. Your browser reads the video, a background worker changes it with the video encoders built into the browser, and you download the result; nothing is sent to a server, so family videos, screen recordings and work calls stay private, and each tool keeps working offline once you have used it.',
        'To make a video play everywhere, convert it to MP4 with H.264 picture and AAC sound. To make it smaller for email or chat, use Compress video with a quality level or a target size, or Resize video. To keep only part of it, use Trim; to change its shape, Crop, Rotate or Flip. Merge videos joins clips into one, Loop video repeats one, and Change video speed makes it faster or slower.',
        'Which videos can my browser read? That depends on the browser: Chrome and Edge read the most, Safari reads HEVC from iPhones, and Firefox reads a little less. When a video uses a codec this browser can\'t read or make, the page names the codec and suggests one that works, rather than giving you a broken file.',
        'Can I record my screen without installing anything? Yes. The screen recorder and the webcam recorder record in the browser and give you a video file to save; nothing is uploaded, and the recording stops as soon as you press Stop or close the tab. PowerPoint to video turns slides into an MP4 with the number of seconds per slide you choose.',
      ],
    },
    '/image-tools': {
      title: 'Image Tools Online – Compress, Resize, Convert, No Upload',
      description: 'Free image tools in your browser: compress, resize, crop, rotate and watermark pictures, convert HEIC to JPG, remove GPS data and make memes. Nothing uploaded.',
      heading: 'Free image tools: compress, resize, convert and edit photos',
      intro: 'Free picture tools that work on your own device: make photos smaller, resize them for Instagram, WhatsApp or a passport, crop, rotate and watermark them, convert HEIC, WebP, PNG and SVG, remove the GPS location, and edit photos or make memes, many pictures at once.',
      linkText: 'Image tools',
      body: [
        'Every image tool here runs on your own device. Your browser reads the pictures, a background worker changes them, and you download the result; nothing is sent to a server, so family photos, ID pictures and screenshots stay private, and each tool keeps working offline once you have used it.',
        'To make pictures smaller, use Compress image or convert them to WebP. To change their shape, use Resize, Crop or Rotate. To change their format, use the image converter or one of the pages for a single pair, such as HEIC to JPG for iPhone photos. To protect them, add a watermark, or remove the camera, date and GPS location before you share them.',
        'Most tools take many pictures at once and hand you one ZIP file. JPG to PDF puts pictures into a PDF, and PDF to JPG turns PDF pages back into pictures.',
        'Can I hide faces or remove a background without uploading the photo? Yes. Blur faces finds the faces in a photo and covers them with blur or large squares, Remove background cuts out a person or an object onto a transparent or white background, and Upscale makes a small picture two or four times larger. Each uses an on-device AI model that this site sends to your browser the first time (about 16 to 22 MB) and that works offline after that. The models are small, so check the result: a side view or a very small face can be missed, and fine hair can come out rough.',
        'Which program opens a HEIC, WebP or TIFF picture? The image viewer opens JPG, PNG, WebP, GIF, BMP, TIFF, SVG and iPhone HEIC photos in the browser, zooms in, and shows the camera, date and location a photo carries, so you can see what you would share before you send it. The photo editor adjusts light and colour, adds a filter or text, and saves a copy.',
      ],
    },
    '/data-tools': {
      title: 'Data Tools Online – Convert CSV, JSON and Excel, No Upload',
      description: 'Free data tools for CSV, TSV, JSON and Excel files: view large tables, convert between formats, format and validate JSON, and mask personal data. No upload.',
      heading: 'Free data tools for CSV, Excel and JSON files',
      intro: 'Free tools for tables and data files: open CSV, JSON, XML and YAML, convert between more than a dozen formats, clean, compare and query tables, and hide personal data, all in your browser with nothing uploaded.',
      linkText: 'Data tools',
      body: [
        'Need to open a CSV without Excel? The CSV viewer shows a CSV or TSV file as a table you can sort, filter, search and edit, and the large CSV viewer opens files with more rows than an Excel sheet holds: a 120,000-row file opens in about a second. The JSON viewer shows a file as a tree or a table, the XML viewer as a collapsible tree, and the YAML formatter finds errors by line and reformats the file.',
        'Need the data in another format? CSV and Excel files convert to JSON, SQL INSERT statements, XML, YAML, Markdown, HTML and LaTeX tables, or fixed-width text, and to each other. JSON converts to CSV with nested objects flattened into columns, to YAML, XML or compact TOON, and to types and classes for TypeScript, Python, Go, Java and C#. XML, YAML, HTML tables and SQL files turn back into CSV.',
        'Need to clean or check a file? The CSV validator reports every problem by row, and the JSON formatter and validator point to the exact line of a syntax error. Remove duplicates drops repeated rows, Change case fixes the letters of a column, Transpose flips rows and columns, Split CSV cuts a big file into smaller ones and Merge CSV joins files with the same header. Compare CSV shows which rows were added, removed or changed, and Change CSV encoding or Change CSV delimiter rewrites a file for the program that will read it.',
        'Need answers from the data? SQL on CSV runs standard queries on a table, Pivot table shows totals by the fields you pick, and Chart maker draws a chart from two columns and saves it as a picture.',
        'Need to share it safely? Mask sensitive data finds names, emails, phone numbers and ID numbers and masks them before the file leaves your hands, and the Base64, URL and JWT tools encode and decode the strings developers paste every day. Every tool runs in your browser, so not a single row is uploaded.',
      ],
    },
    '/ai-tools': {
      title: 'AI-Ready File Tools – Turn Files into Text for AI Chats',
      description: 'Turn PDF, Word and PowerPoint files into Markdown, count tokens and shrink JSON with TOON before you paste into an AI chat. Free, in your browser, no upload.',
      heading: 'AI-ready file tools: turn documents into clean text for AI chats',
      intro: 'Turn PDFs, Word documents, slide decks and spreadsheets into clean Markdown, count their tokens, and write JSON as compact TOON before you paste it into ChatGPT, Claude or Gemini.',
      linkText: 'AI-ready tools',
      body: [
        'Want to ask an AI chat about a PDF, a Word document or a slide deck? Text copied straight out of a file loses its headings, lists and tables, and a long file can run past what a chat accepts. These tools write the file as clean Markdown first. PDF to Markdown turns the largest text into headings and keeps lists and simple tables, Word to Markdown keeps Word\'s headings, lists, links and tables, and PowerPoint to Markdown writes each slide\'s title and bullet points with the speaker notes under them. Excel to Markdown and CSV to Markdown write a sheet as a Markdown table. Pictures and charts are left out, and a scanned PDF has no text to convert until OCR PDF has read it.',
        'Will it fit? The token counter shows how many tokens, words and characters a file or a piece of text uses, so you know whether it fits before you paste it, and can trim it if it does not; counts for different chats are estimates, because each one counts a little differently. JSON to TOON rewrites JSON as compact TOON, which writes the keys of a list of records once instead of on every item, and shows the token count before and after; it also turns TOON back into JSON.',
        'Everything runs in your browser: no file is uploaded and nothing is sent to any AI service. The AI-ready tools only prepare your text, so what you paste is clean and you know how long it is.',
        'Some AI runs right here instead. The AI summarizer, Translate document and Chat with PDF use the AI built into recent desktop Chrome, on your device. OCR PDF and Image to text read the words in scans and photos in English and Arabic; Remove background, Blur faces and Upscale image (beta) work on pictures; and Translate PDF turns English into Arabic and back. Their models are files of this site, loaded the first time and kept by your browser, so they work offline after that and your files never leave your device.',
        'Before you paste anything into an AI chat, check it for personal details. Mask data replaces names, emails, phone numbers and ID numbers in CSV, Excel, JSON and text files, on your device.',
      ],
    },
    '/office-tools': {
      title: 'Office Tools – Convert, Merge, Split Word, Excel and PPTX',
      description: 'Free office file tools: open, convert, merge, split, compare and clean Word, Excel and PowerPoint files in your browser, no Office needed. Nothing is uploaded.',
      heading: 'Free office tools: open, convert and edit Word, Excel and PowerPoint files',
      intro: 'Open, convert and change Word, Excel, PowerPoint and text files without installing Office: free viewers and tools that run in your browser and never upload your files.',
      linkText: 'Office tools',
      body: [
        'Received a file you cannot open? The office tools open the files people send at work without Microsoft Office: Word documents (.docx, .dotx, .docm and OpenDocument .odt), Excel workbooks (.xlsx, .xlsm, .ods and old .xls files), PowerPoint presentations (.pptx, .ppsx, .potx and .pptm, in beta) and plain text files. Everything is drawn by your browser, so a confidential document is never uploaded to read it, and the pages keep working offline once they have loaded.',
        'The Word viewer shows pages with their fonts, tables and pictures, plus a navigation pane, search, comments and read aloud. The Excel viewer keeps formulas, number formats and frozen panes and lets you edit cells and download the workbook. The PowerPoint viewer shows slides with speaker notes, a grid of all slides, full screen and a presenter view. The TXT editor reads and edits text files and fixes their encoding. The Word, Excel and PowerPoint viewers can print or save as PDF, and Arabic documents display right to left.',
        'Need a PDF to send? Word to PDF and Excel to PDF save a document or a workbook as PDF pages with text you can still select and search. Need the words for an AI chat, a wiki or notes? Word to Markdown and PowerPoint to Markdown turn headings, lists, tables and speaker notes into clean Markdown, and Excel to CSV or Excel to JSON pull the data out of a sheet.',
        'Need to change the file itself? Merge or split Word documents, Excel workbooks and PowerPoint presentations; find and replace text across a Word document; remove comments and tracked changes before you send it; add a CONFIDENTIAL watermark; make one letter per row of a spreadsheet with mail merge; compare two versions of a Word document or a workbook; take off sheet protection from a workbook you own or repair one Excel will not open; and see or remove the author, company and dates stored in any of the three. Each tool edits the file in your browser.',
        'Not sure which app to use? The guides compare the free options for each kind of file: how to open a DOCX file without Word, an XLSX file without Excel, a PPTX file without PowerPoint and a TXT file on any device, which of them upload your file, and what each one keeps.',
      ],
    },
    '/all-tools': {
      title: 'All Free File Tools: PDF, Office, Image, Video, Data and AI',
      description: 'Every free OpenAnyDoc tool in one place: PDF, Word, Excel and PowerPoint tools, image and video tools, CSV and JSON converters, on-device AI. Nothing uploaded.',
      heading: 'All free file tools: PDF, Office, image, video, data and AI',
      intro: 'Every tool on OpenAnyDoc, grouped by the kind of file it works on. Each one runs in your browser, and none of them uploads your files.',
      linkText: 'All tools',
      body: [
        'Every OpenAnyDoc tool works the same way: you choose a file, your browser does the work, and you download the result. Nothing is uploaded, there is no account and no watermark, and each tool works offline once you have used it. Pick a tool from the PDF, office, image, video, data or AI groups above, or drop any supported file on the home page and it opens in the right viewer.',
      ],
    },
  },
  ar: {
    '/': {
      title: 'عارض ملفات اون لاين مجاني – فتح الملفات بدون برامج',
      description: 'عارض ملفات اون لاين مجاني: افتح ملفات CSV واكسل وJSON ووورد وبوربوينت وPDF والصور والفيديو في متصفحك وعدّلها، بلا برامج ولا تسجيل، ولا تُرفع ملفاتك أبدًا.',
      heading: 'عارض ومحرر ملفات اون لاين مجاني: افتح أي ملف بدون رفع',
      intro: 'أفلِت ملف CSV أو Excel أو JSON أو ملفًا نصيًا لتعدّله، أو اعرض ملفات Word وPowerPoint وPDF، أو عدّل ملفات PDF ووقّعها وادمجها، هنا في متصفحك مباشرة. عارض ملفات اون لاين مجاني ومحرر للملفات، بدون رفع وبدون تسجيل.',
    },
    '/about': {
      title: 'عن OpenAnyDoc – عارض ملفات خاص اون لاين',
      description: 'عن OpenAnyDoc: أدوات ملفات مجانية لـCSV وExcel وJSON وWord وPowerPoint وPDF والصور والفيديو، تعمل في متصفحك ولا ترفع ملفاتك أبدًا، دون حساب ودون إعلانات.',
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
      title: 'أدوات PDF دون رفع: ماذا تفعل iLovePDF وPDF24 بملفاتك',
      description: 'كيف تتعامل iLovePDF وPDF24 وSejda مع ملف PDF وفق صفحاتها، وأين تقدّم أكثر، وأدوات PDF مجانية تعمل في متصفحك فلا يغادر الملف جهازك ولا يُرفع إلى أي خادم.',
      heading: 'أدوات PDF لا ترفع ملفك',
      intro: 'كيف تتعامل مواقع PDF الشائعة مع ملفك، وأين تقدّم أكثر، والأدوات التي تُبقي الملف على جهازك.',
      linkText: 'أدوات PDF بدون رفع',
    },
    '/open-txt-file': {
      title: 'كيف تفتح ملف TXT النصي: أي برنامج تستخدم على أي جهاز',
      description: 'أي برنامج يفتح ملف txt: المفكرة على ويندوز، وTextEdit على الماك، و«الملفات» على الآيفون، وتطبيقات أندرويد، وأي متصفح، وكيف تصلح النص الذي يظهر برموز غريبة.',
      heading: 'كيف تفتح ملف TXT: أي برنامج تستخدم على أي جهاز',
      intro: 'البرنامج الذي يفتح الملف النصي على ويندوز والماك والآيفون وأندرويد، وكيف تقرؤه في المتصفح، وكيف تصلح النص الذي يظهر برموز غريبة.',
      linkText: 'كيف تفتح ملف TXT',
    },
    '/open-csv-without-excel': {
      title: 'كيف تفتح ملف CSV بدون اكسل: طرق مجانية بلا رفع للملف',
      description: 'افتح ملف CSV بدون اكسل مجانًا: في متصفحك دون رفع، أو في Google Sheets وLibreOffice وNumbers ومحرر النصوص، مع حلول للملفات الكبيرة جدًا والعربية المشوّهة.',
      heading: 'كيف تفتح ملف CSV بدون اكسل',
      intro: 'الخيارات المجانية، وأيها يرفع ملفك، وماذا تفعل حين يكون ملف CSV كبيرًا جدًا أو يُفتح في عمود واحد أو تظهر عربيته مشوّهة.',
      linkText: 'فتح CSV بدون اكسل',
    },
    '/open-pptx-without-powerpoint': {
      title: 'كيف تفتح ملف PPTX بدون بوربوينت: طرق مجانية بلا رفع',
      description: 'طرق مجانية لفتح ملف pptx بدون بوربوينت: في متصفحك دون رفع، أو في Google Slides وLibreOffice Impress وKeynote وعلى الهاتف، وماذا تفعل بملفات ppt القديمة.',
      heading: 'كيف تفتح ملف PPTX بدون بوربوينت',
      intro: 'الخيارات المجانية، وأيها يرفع عرضك، وأيها يعدّله، وماذا تفعل بملف ppt قديم.',
      linkText: 'فتح PPTX بدون بوربوينت',
    },
    '/open-pdf-without-adobe': {
      title: 'كيف تفتح ملف PDF بدون Adobe: طرق مجانية على أي جهاز',
      description: 'افتح ملف بي دي اف بدون Adobe Reader: في أي متصفح، و«معاينة» على الماك، و«الملفات» على الآيفون، وDrive على أندرويد، ولماذا لا يُفتح الملف، وكيف تعبّئه وتوقّعه.',
      heading: 'كيف تفتح ملف PDF بدون Adobe',
      intro: 'البرامج المجانية الموجودة في كل حاسوب وهاتف، ولماذا يرفض ملف PDF أحيانًا أن يُفتح، وكيف تعبّئه وتوقّعه بدون Adobe.',
      linkText: 'فتح PDF بدون Adobe',
    },
    '/fix-arabic-text-copied-from-pdf': {
      title: 'نسخ نص عربي من PDF يظهر مقلوب؟ السبب وطريقة الإصلاح',
      description: 'لماذا يظهر النص العربي المنسوخ من ملف بي دي اف مقلوبًا أو بحروف مقطّعة، وكيف تنسخه بترتيب القراءة في متصفحك دون رفع الملف، حتى من الملفات الممسوحة ضوئيًا.',
      heading: 'لماذا يظهر النص العربي مقلوبًا حين تنسخه من ملف PDF، وكيف تصلحه',
      intro: 'ما الذي يحفظه ملف PDF بدل الجمل، ولماذا تُنسخ العربية معكوسة، وكيف تخرج النص بترتيب القراءة دون رفع الملف.',
      linkText: 'نص عربي مقلوب من PDF',
    },
    '/cant-edit-text-in-pdf': {
      title: 'لماذا لا أستطيع تعديل النص في ملف PDF؟ الأسباب والحلول',
      description: 'لماذا لا يُعدَّل نص ملف بي دي اف كما يُعدَّل ملف وورد، وماذا تفعل: أضف نصًا فوقه، أو حوّله إلى وورد، أو اقرأ الملف الممسوح بالتعرّف الضوئي، مجانًا ودون رفع.',
      heading: 'لماذا لا تستطيع تعديل النص في ملف PDF؟',
      intro: 'لماذا لا توجد في ملف PDF فقرات تُعدَّل، وكيف تغيّر كلمات قليلة أو تعيد كتابة صفحات كاملة، وماذا تفعل حين يكون الملف ممسوحًا ضوئيًا.',
      linkText: 'تعذّر تعديل نص PDF',
    },
    '/fill-pdf-form-without-acrobat': {
      title: 'كيف تعبّئ نموذج PDF بدون Acrobat على الحاسوب أو الهاتف',
      description: 'عبّئ نموذج بي دي اف بدون Adobe Acrobat: حقول قابلة للتعبئة أو صفحة مسطّحة، على الحاسوب أو الهاتف، ثم ثبّت الإجابات ووقّعه. مجانًا في متصفحك ودون رفع الملف.',
      heading: 'كيف تعبّئ نموذج PDF بدون Acrobat',
      intro: 'كيف تميّز النموذج القابل للتعبئة من المسطّح، وكيف تعبّئ كلًّا منهما على الحاسوب أو الهاتف، وكيف تثبّت الإجابات وتوقّعه قبل إرساله.',
      linkText: 'تعبئة نموذج PDF بدون Acrobat',
    },
    '/stirling-pdf-alternative': {
      title: 'بديل Stirling-PDF يعمل في متصفحك دون خادم ودون رفع ملفات',
      description: 'مقارنة Stirling-PDF بأدوات بي دي اف تعمل في المتصفح فقط: أين تُعالَج الملفات وما الذي تستضيفه والخطط والحدود، من صفحاته نفسها، ومتى يقدّم Stirling-PDF أكثر.',
      heading: 'بديل Stirling-PDF لا يحتاج إلى خادم',
      intro: 'كيف يتعامل Stirling-PDF مع ملفاتك، وأين يقدّم أكثر، وأدوات PDF تُبقي كل ملف على جهاز الموظف نفسه.',
      linkText: 'بديل Stirling-PDF',
    },
    '/jsonformatter-alternative': {
      title: 'بديل jsonformatter.org يُبقي بيانات JSON داخل متصفحك',
      description: 'كيف يتعامل jsonformatter.org وCode Beautify مع JSON الملصوق وفق صفحاتهما، ومنسّق ومدقق جيسون يُبقي مفاتيح API ورموز الوصول داخل متصفحك فلا تغادر جهازك.',
      heading: 'بديل jsonformatter.org وCode Beautify',
      intro: 'ما يقوله موقعا JSON الشائعان عن حفظ بياناتك ومشاركتها وتحميلها، وأين يقدّمان أكثر، وأدوات JSON تُبقيها في متصفحك.',
      linkText: 'بديل منسّق JSON',
    },
    '/reduce-photo-file-size': {
      title: 'كيف تجعل حجم الصورة أقل من 1 ميغابايت للبريد أو نموذج رفع',
      description: 'اجعل صورتك أقل من 1 ميغابايت أو أي حد للرفع: غيّر الأبعاد أولًا، واختر الجودة والصيغة المناسبتين، ثم افحص النتيجة. ويتم كل ذلك في متصفحك دون رفع أي ملف.',
      heading: 'كيف تقلل حجم ملف الصورة للبريد أو النماذج',
      intro: 'الأبعاد والجودة والصيغة بالترتيب الذي يوفّر أكثر، وكيف تفحص الملف قبل أن يرفضه النموذج.',
      linkText: 'تقليل حجم ملف الصورة',
    },
    '/open-heic-on-windows': {
      title: 'فتح صور HEIC على Windows دون تثبيت أي برنامج أو إضافة',
      description: 'لماذا لا يفتح Windows صور HEIC من iPhone، وكيف تعرضها أو تحوّلها إلى JPG في متصفحك دون تثبيت أي شيء، وكيف تضبط iPhone ليلتقط الصور بصيغة JPG بدلًا منها.',
      heading: 'كيف تفتح صور HEIC من iPhone على Windows',
      intro: 'ما ملف HEIC، ولماذا يحتاج Windows إلى إضافة لفتحه، وكيف تفتحه أو تحوّله في أي متصفح دون رفعه.',
      linkText: 'فتح HEIC على Windows',
    },
    '/remove-location-from-photo': {
      title: 'حذف الموقع الجغرافي من الصورة قبل نشرها أو إرسالها لأي شخص',
      description: 'ما بيانات GPS والكاميرا والتاريخ التي تحملها صورة الهاتف، وكيف تراها، وكيف تحذفها دون أن تفقد الصورة جودتها، وإعدادات الهاتف التي تمنع إضافتها من البداية.',
      heading: 'كيف تحذف الموقع من الصورة',
      intro: 'ما الذي يكشفه ملف الصورة، وكيف تراه، وكيف ترسل نسخة نظيفة دون رفع الأصل إلى أي مكان.',
      linkText: 'حذف الموقع من الصورة',
    },
    '/remove-background-without-upload': {
      title: 'إزالة خلفية الصورة: ما الذي ينجح جيدًا وما الذي يجب تجنبه',
      description: 'قص شخص أو شيء من صورة بنموذج ذكاء اصطناعي يعمل على جهازك داخل المتصفح: PNG شفافة أو خلفية بيضاء، وما الذي ينجح جيدًا، وخيارات موجودة على هاتفك وحاسوبك أصلًا.',
      heading: 'كيف تزيل خلفية الصورة دون رفعها',
      intro: 'كيف يقص نموذج يعمل على الجهاز موضوع الصورة، وما الذي يُحمَّل في أول استخدام، وأي الصور تنجح أكثر وأيها تتجنب.',
      linkText: 'إزالة الخلفية دون رفع',
    },
    '/spreadsheet-to-ai-chat': {
      title: 'جدول اكسل لمحادثة الذكاء الاصطناعي: الصقه بصيغة يفهمها',
      description: 'كيف تعطي ChatGPT أو Claude أو Gemini جدول بيانات يقرؤه: جدول Markdown أم CSV، وورقة واحدة في كل مرة، والحجم بالرموز، والمعادلات، وإخفاء البيانات الشخصية.',
      heading: 'كيف أعطي محادثة الذكاء الاصطناعي جدول بيانات تقرؤه؟',
      intro: 'حوّل ورقة واحدة إلى جدول Markdown، وتأكد من حجمها بالرموز، وأخفِ البيانات الشخصية قبل لصقها في المحادثة.',
      linkText: 'جدول بيانات لمحادثة الذكاء الاصطناعي',
    },
    '/make-markdown-table-from-csv': {
      title: 'جداول Markdown من CSV: المحاذاة والخط العمودي والجداول العريضة',
      description: 'حوّل ملف CSV إلى جدول Markdown لملف README أو التوثيق أو محادثة ذكاء اصطناعي: سطر الرأس والفصل، ومحاذاة الأعمدة، والخط العمودي داخل الخلايا، والجداول العريضة.',
      heading: 'كيف تصنع جدول Markdown من ملف CSV',
      intro: 'مِمَّ يتكوّن جدول Markdown، وكيف تحاذي أعمدته، وماذا تفعل بالخطوط العمودية وفواصل الأسطر والجداول العريضة.',
      linkText: 'جدول Markdown من CSV',
    },
    '/what-is-toon-format': {
      title: 'ما هي صيغة TOON؟ مقارنتها بجيسون JSON ومتى توفّر الرموز',
      description: 'شرح صيغة TOON (Token-Oriented Object Notation): كيف تبدو بجانب JSON، وكيف تقرؤها، وأعداد رموز قسناها بأنفسنا للقوائم المتشابهة والبيانات المتداخلة بعمق.',
      heading: 'ما هي صيغة TOON، ومتى توفّر الرموز؟',
      intro: 'تكتب TOON بيانات JSON نفسها برموز أقل، لكن لبعض أشكال البيانات فقط. إليك شكلها وما أظهرته أعدادنا.',
      linkText: 'ما هي صيغة TOON؟',
    },
    '/convert-excel-to-json-for-api': {
      title: 'تحويل اكسل إلى جيسون لواجهة API: المفاتيح والأنواع والتواريخ',
      description: 'حوّل ورقة اكسل إلى JSON تستخدمه واجهة برمجية أو تطبيق: صف الرأس مفاتيحَ، والأرقام والنصوص، والأصفار البادئة، وتواريخ ISO، والخلايا الفارغة null، واختيار الورقة.',
      heading: 'كيف تحوّل ورقة اكسل إلى JSON لواجهة برمجية',
      intro: 'جهّز صف الرأس، واعرف كيف تخرج الأرقام والتواريخ والخلايا الفارغة، واحصل على مصفوفة كائنات يرسلها كودك.',
      linkText: 'اكسل إلى جيسون لواجهة API',
    },
    '/split-large-csv': {
      title: 'كيف تقسّم ملف CSV كبيرًا ليناسب حد صفوف Excel مع العناوين',
      description: 'قسّم ملف CSV كبيرًا حسب الصفوف أو الحجم مع صف العناوين في كل جزء، لأجل حد Excel البالغ 1,048,576 صفًا أو حدود الرفع أو محادثات الذكاء الاصطناعي، داخل متصفحك.',
      heading: 'كيف تقسّم ملف CSV كبيرًا إلى ملفات أصغر',
      intro: 'قسّم ملف CSV كبيرًا حسب الصفوف أو الحجم مع صف العناوين في كل جزء، مع مثال محسوب لأجل Excel، وشرح منصف لطريقة سطر الأوامر.',
      linkText: 'تقسيم ملف CSV كبير',
    },
    '/json-vs-json-lines': {
      title: 'JSON أم JSON Lines ‏(jsonl وNDJSON)؟ الفرق ومتى تستخدم كلًّا',
      description: 'ملف JSON يحمل قيمة واحدة، وJSON Lines ‏(jsonl وNDJSON) قيمة في كل سطر. متى تُستعمل كل صيغة في السجلات والتصدير وملفات الذكاء الاصطناعي، وكيف تفتحها وتحوّلها.',
      heading: 'ما الفرق بين JSON وJSON Lines؟',
      intro: 'ما الذي يتغير حين يُكتب JSON سجلًا في كل سطر، وأين تُستعمل كل صيغة، وكيف تفتح ملف jsonl وتحوّله.',
      linkText: 'JSON أم JSON Lines',
    },
    '/compare-two-json-files': {
      title: 'لماذا يضلّلك فرق الأسطر في JSON وكيف تقارن الملفين بالمفاتيح',
      description: 'قارن ملفي JSON بالمفتاح لا بالسطر: القيم المضافة والمحذوفة والمتغيرة مع مساراتها، وتجاهل ترتيب المفاتيح، ومثال عملي على ملف قبل التعديل وبعده، كله في متصفحك.',
      heading: 'كيف تقارن ملفي JSON وتعرف ما الذي تغيّر',
      intro: 'لماذا تضلّلك المقارنة النصية، وما الذي تذكره مقارنة JSON، ومثال عملي على ملف قبل التعديل وبعده.',
      linkText: 'مقارنة ملفي JSON',
    },
    '/excel-row-and-column-limits': {
      title: 'حدود الصفوف والأعمدة في Excel: الخلايا والأحرف والخانات',
      description: 'حدود Excel كما تذكرها Microsoft: 1,048,576 صفًا و16,384 عمودًا و32,767 حرفًا في الخلية و15 خانة للرقم، وماذا تفعل حين تتجاوز بياناتك هذه الحدود دون رفع الملف.',
      heading: 'ما حدود الصفوف والأعمدة في Excel؟',
      intro: 'كل حد في Excel يستحق المعرفة، من قائمة Microsoft نفسها، وما يعنيه لملف حقيقي، وماذا تفعل حين تتجاوزه بياناتك.',
      linkText: 'حدود الصفوف والأعمدة في Excel',
    },
    '/find-hidden-sheets-in-excel': {
      title: 'اكتشف الأوراق المخفية في Excel، حتى المخفية جدًا منها',
      description: 'كيف تعثر على الأوراق المخفية والمخفية جدًا والصفوف والأعمدة المخفية وكل صيغة في مصنف Excel، في برنامج Excel نفسه أو داخل متصفحك مجانًا دون رفع أي ملف.',
      heading: 'كيف أعثر على الأوراق والصفوف والصيغ المخفية في ملف Excel؟',
      intro: 'الأماكن الأربعة التي يخفي فيها المصنف شيئًا، وكيف تراها كلها في متصفحك، وكيف تُظهرها في Excel، بما فيها الأوراق المخفية جدًا.',
      linkText: 'الأوراق المخفية في Excel',
    },
    '/excel-to-csv-without-breaking-arabic': {
      title: 'تحويل Excel إلى CSV دون تشويه العربية: UTF-8 وعلامة BOM',
      description: 'حوّل ملف Excel إلى CSV واحفظ العربية مقروءة: لماذا تتحول الحروف إلى علامات استفهام أو رموز، وما دور UTF-8 وعلامة BOM، وكيف تحفظ ملفًا يفتحه Excel سليمًا.',
      heading: 'كيف أحوّل ملف Excel إلى CSV دون أن تتشوه العربية؟',
      intro: 'لماذا تضيع العربية عند حفظ المصنف بصيغة CSV، وكيف تبدو البايتات، وكيف تكتب ملف CSV بترميز UTF-8 مع العلامة التي يحتاجها Excel.',
      linkText: 'تحويل Excel إلى CSV بالعربية',
    },
    '/read-speaker-notes-without-powerpoint': {
      title: 'قراءة ملاحظات المتحدث دون بوربوينت: عرضها والبحث فيها وتصديرها',
      description: 'اقرأ ملاحظات المتحدث في ملف ‎.pptx دون بوربوينت: تظهر تحت كل شريحة، وتبحث فيها وتسمعها بصوت عالٍ وتصدّرها نصًا، كل ذلك في متصفحك ودون رفع الملف إلى أي خادم.',
      heading: 'كيف تقرأ ملاحظات المتحدث دون بوربوينت',
      intro: 'أين توجد الملاحظات في ملف ‎.pptx، وكيف تقرؤها وتبحث فيها وتسمعها وتصدّرها في متصفحك، وما الذي يقدّمه PowerPoint وGoogle Slides وKeynote.',
      linkText: 'قراءة ملاحظات المتحدث',
    },
    '/compress-video-without-upload': {
      title: 'فيديو أكبر من حد البريد أو WhatsApp؟ احسب الحجم الذي تحتاجه',
      description: 'اجعل الفيديو صغيرًا بما يكفي للبريد أو WhatsApp أو نموذج رفع: ما الذي يكبّره، وكيف تحسب حجمه، وحدود الخدمات الشائعة، وكيف تضغطه داخل متصفحك دون رفع أي ملف.',
      heading: 'كيف تضغط فيديو دون رفعه',
      intro: 'لماذا تكون الفيديوهات كبيرة، وكيف تحسب الحجم الذي يمكنك الوصول إليه، وحدود الأماكن الشائعة، وكيف تضغط الفيديو على جهازك.',
      linkText: 'ضغط الفيديو دون رفع',
    },
    '/file-too-large-for-chatgpt': {
      title: 'ملف أكبر من أن يقبله ChatGPT؟ كيف تقسّمه وتختصره',
      description: 'لماذا يرفض ChatGPT أو Claude أو Gemini الملف الكبير، وحدود الرفع والرموز كما تذكرها صفحات مساعدتها، وكيف تعدّ الملف وتقسّمه وتختصره داخل متصفحك دون رفعه.',
      heading: 'ماذا تفعل حين يكون الملف أكبر من أن يقبله ChatGPT',
      intro: 'الحدّان اللذان تضعهما محادثة الذكاء الاصطناعي، ومثال مقيس، وخطوات اختصار ملف PDF أو وورد أو اكسل أو CSV إلى حجم تقرؤه.',
      linkText: 'ملف كبير على محادثة الذكاء الاصطناعي',
    },
    '/best-free-csv-viewers': {
      title: 'أفضل عارض CSV مجاني: ست طرق مجانية لفتح ملف CSV وعرضه',
      description: 'ست طرق مجانية لفتح ملف CSV، من عارض في المتصفح لا يرفع شيئًا إلى Google Sheets وLibreOffice Calc وتطبيقات CSV لسطح المكتب، مع حدود كل أداة كما تذكرها صفحاتها.',
      heading: 'ما أفضل عارض CSV مجاني؟',
      intro: 'ست طرق مجانية لفتح ملف CSV وعرضه، وما تجيده كل واحدة، والحدود التي تذكرها صفحاتها.',
      linkText: 'أفضل عارض CSV مجاني',
    },
    '/best-free-json-formatters': {
      title: 'أفضل منسّق JSON مجاني لا يخزّن بياناتك: ست أدوات',
      description: 'ست أدوات مجانية لتنسيق JSON مقارنة بما تقوله صفحاتها عن بياناتك: أدوات في المتصفح ومحرر برمجي وسطر الأوامر ومواقع تُبقي JSON على جهازك دون أن تخزّنه أبدًا.',
      heading: 'ما منسّقات JSON المجانية التي لا تخزّن بياناتك؟',
      intro: 'ست طرق مجانية لتنسيق JSON، وما تقوله صفحات كل واحدة بالضبط عن المكان الذي يذهب إليه JSON.',
      linkText: 'أفضل منسّقات JSON المجانية',
    },
    '/openanydoc-vs-google-sheets-large-files': {
      title: 'OpenAnyDoc أم Google Sheets أم Excel لملفات CSV الكبيرة',
      description: 'مقارنة لملفات CSV الكبيرة: حد 20 مليون خلية في Google Sheets، و1,048,576 صفًا في Excel، وحدود الحجم في Excel للويب، وعارض في المتصفح بلا حد خاص به للصفوف.',
      heading: 'OpenAnyDoc أم Google Sheets أم Excel: أيها يفتح ملفات CSV الكبيرة؟',
      intro: 'الحدود الرسمية لـ Google Sheets وExcel وExcel للويب، وما يفعله OpenAnyDoc بملف CSV كبير، وأين يقدّم كلٌّ منها أكثر.',
      linkText: 'CSV كبير: OpenAnyDoc أم Sheets',
    },
    '/large-csv-test': {
      title: 'اختبار ملف CSV كبير: جرّب 3 ملايين صف في 6 أدوات بنفسك',
      description: 'اختبار تجريه بنفسك: ملف CSV تجريبي واحد من 3 ملايين صف في Excel وGoogle Sheets وLibreOffice ومحرر نصوص وOpenAnyDoc، مع الحدود الرسمية التي تحدد النتيجة.',
      heading: 'كيف تختبر ملف CSV من 3 ملايين صف في 6 أدوات',
      intro: 'ملف تجريبي واحد فيه 3,000,000 صف، وست أدوات، والحدود الرسمية التي تحدد النتيجة، وخطوات إجراء الاختبار بنفسك.',
      linkText: 'اختبار CSV الكبير',
    },
    '/pdf-to-ai-chat-with-tables': {
      title: 'ملف PDF إلى ChatGPT دون فقدان الجداول: الصقه بصيغة Markdown',
      description: 'لماذا تتفكك الجداول حين تنسخ ملف بي دي اف إلى ChatGPT أو Claude أو Gemini، وكيف يحفظ Markdown الصفوف والأعمدة، وكيف تحوّله إلى Markdown في متصفحك دون رفع الملف.',
      heading: 'كيف تعطي ChatGPT ملف PDF دون أن تفقد الجداول',
      intro: 'لماذا تختلط جداول PDF المنسوخة، وكيف يحفظ Markdown كل صف وعمود، وما الذي تراجعه قبل اللصق.',
      linkText: 'جداول PDF في محادثة الذكاء الاصطناعي',
    },
    '/how-many-tokens-is-my-pdf': {
      title: 'كم رمزًا (Token) في ملف PDF؟ اعرف العدد قبل أن تلصقه',
      description: 'ما الرمز، ولماذا تغيّر العربية والجداول ونموذج الذكاء الاصطناعي العدد، ولماذا لا يكفي عدد الصفحات، وكيف تعدّ رموز ملف بي دي اف بدقة داخل متصفحك دون رفعه.',
      heading: 'كم رمزًا يستهلك ملف PDF؟',
      intro: 'ما الذي يحدد عدد رموز ملف PDF، وأمثلة مقيسة بالإنجليزية والعربية وجدول، وكيف تعدّ رموز ملفك بدقة.',
      linkText: 'رموز ملف PDF',
    },
    '/word-document-to-ai-chat': {
      title: 'مستند وورد إلى محادثة ذكاء اصطناعي دون فقدان العناوين',
      description: 'أعطِ ChatGPT أو Claude أو Gemini ملف وورد docx بعناوينه وقوائمه وروابطه محفوظة بصيغة Markdown، مع خطوة إضافية للجداول. كل ذلك يعمل داخل متصفحك دون رفع الملف.',
      heading: 'كيف تعطي محادثة ذكاء اصطناعي مستند وورد وتحافظ على بنيته',
      intro: 'لماذا يفقد نص وورد الملصوق مخططه، وما الذي يحفظه Markdown، وكيف تتعامل مع الجداول، وما الذي تراجعه قبل اللصق.',
      linkText: 'مستند وورد إلى محادثة ذكاء اصطناعي',
    },
    '/powerpoint-to-ai-chat': {
      title: 'عرض بوربوينت إلى محادثة ذكاء اصطناعي: العناوين والملاحظات',
      description: 'أعطِ ChatGPT أو Claude أو Gemini عرض بوربوينت مخططًا نصيًا بعناوين الشرائح ونقاطها وملاحظات المتحدث. يُصنع المخطط داخل متصفحك، ولا يُرفع أي ملف إلى أي خادم.',
      heading: 'كيف تعطي محادثة ذكاء اصطناعي عرض بوربوينت',
      intro: 'حوّل العرض إلى مخطط تعمل عليه المحادثة شريحة شريحة، مع ملاحظات المتحدث، واعرف ما الذي يتركه المخطط.',
      linkText: 'بوربوينت إلى محادثة ذكاء اصطناعي',
    },
    '/how-to-merge-pdf-files': {
      title: 'كيف تدمج ملفات PDF على Mac وWindows وiPhone وأندرويد',
      description: 'ادمج ملفات بي دي اف على أي جهاز: «معاينة» على Mac، و«الملفات» أو «الاختصارات» على iPhone، والمتصفح على Windows وأندرويد، مع الترتيب والصور وحجم الملف.',
      heading: 'كيف تدمج ملفات PDF على أي جهاز',
      intro: 'الطرق المجانية لجمع ملفات PDF على الحاسوب أو الهاتف، وأيّها لا يحتاج إلى تثبيت، وكيف تضبط الترتيب والصور والصفحات الفارغة والحجم.',
      linkText: 'دمج ملفات PDF على أي جهاز',
    },
    '/how-to-split-a-pdf': {
      title: 'كيف تقسّم ملف PDF: افصل الصفحات أو احفظ بعضها فقط مجانًا',
      description: 'قسّم ملف بي دي اف إلى ملفات حسب نطاقات الصفحات أو كل عدد من الصفحات أو ملفًا لكل صفحة، أو احفظ الصفحات التي تحتاجها فقط، في المتصفح أو بأدوات جهازك نفسه.',
      heading: 'كيف تقسّم ملف PDF أو تحفظ بعض صفحاته',
      intro: 'أي أداة تناسب أي مهمة، وكيف تكتب نطاقات الصفحات، وملف لكل صفحة في ZIP، والطرق المجانية الموجودة في حاسوبك.',
      linkText: 'تقسيم ملف PDF',
    },
    '/photos-to-one-pdf': {
      title: 'صور الهاتف في ملف PDF واحد: HEIC وترتيب الصفحات ومقاسها',
      description: 'حوّل صور الهاتف إلى ملف بي دي اف واحد: اختر صور JPG أو HEIC أو PNG، ورتّبها، واضبط مقاس الصفحة والهوامش، وقوّم صور المستندات الورقية، وأبقِ الملف صغيرًا.',
      heading: 'كيف تجمع صور الهاتف في ملف PDF واحد',
      intro: 'الترتيب ومقاس الصفحة والهوامش، وصور المستندات الورقية، وكيف تُبقي الملف صغيرًا بما يكفي لإرساله.',
      linkText: 'جمع الصور في PDF واحد',
    },
    '/password-protect-pdf-free': {
      title: 'كلمة مرور PDF أم قيوده: ما الذي يحميه كلٌّ منهما فعلًا',
      description: 'احمِ ملف بي دي اف بكلمة مرور مجانًا: الفرق بين كلمة مرور الفتح وقيود الطباعة والنسخ، وما الذي تمنعه كلمة المرور، وكيف ترسلها بأمان، وكيف تزيلها لاحقًا.',
      heading: 'كيف تحمي ملف PDF بكلمة مرور',
      intro: 'نوعا كلمات مرور PDF، وما يحميه كل منهما فعلًا، وكيف تشارك ملفًا مقفلًا بأمان.',
      linkText: 'حماية ملف PDF بكلمة مرور',
    },
    '/make-scanned-pdf-searchable': {
      title: 'لماذا لا يمكن البحث في ملف PDF الممسوح ضوئيًا وكيف يحل OCR ذلك',
      description: 'اجعل ملف بي دي اف الممسوح ضوئيًا قابلًا للبحث: ماذا يفعل التعرّف الضوئي، والعربية والإنجليزية، ولماذا لا يلزم رفع ملفك، ومدى دقته، وكيف تنقل النص إلى Word.',
      heading: 'كيف تجعل ملف PDF الممسوح ضوئيًا قابلًا للبحث',
      intro: 'ما يضيفه التعرّف الضوئي إلى المسح، وأين يعمل، وإلى أي حد تثق به، وماذا تفعل بالنص بعده.',
      linkText: 'جعل PDF الممسوح قابلًا للبحث',
    },
    '/guides': {
      title: 'أدلة: فتح ملفات CSV واكسل ووورد وPDF وTXT وإصلاحها',
      description: 'أدلة عملية: افتح ملفات TXT وCSV واكسل ووورد وبوربوينت وPDF دون البرنامج الذي صُنعت به، وأصلح العربية المشوّهة وملف CSV الذي يُفتح في عمود واحد، وغير ذلك.',
      heading: 'أدلة فتح ملفات CSV واكسل ووورد وبوربوينت وPDF والنصوص وإصلاحها',
      intro: 'إجابات عملية للأسئلة التي يطرحها الناس عن ملفاتهم، من البرنامج الذي يفتح ملف TXT إلى سبب ظهور العربية مشوّهة في ملف CSV، مع الأداة المجانية التي تحلها في متصفحك.',
      linkText: 'الأدلة',
    },
    '/pdf-tools': {
      title: 'أدوات PDF مجانية – ضغط وتعديل ودمج وتحويل بي دي اف دون رفع',
      description: 'أدوات PDF مجانية في متصفحك: اضغط ملفات بي دي اف وعدّلها ووقّعها وادمجها وقسّمها، وحوّلها من وإلى Word وExcel وJPG، واستخرج نصها وأضف كلمة مرور. لا يُرفع أي ملف.',
      heading: 'أدوات PDF مجانية لا ترفع ملفك أبدًا',
      intro: 'أدوات PDF مجانية تعمل على جهازك: اضغط ملف PDF، وحوّله من وإلى Word وExcel وPowerPoint، وأضف نصوصًا وتظليلًا ورسومًا وتوقيعك، وعبّئ النماذج، وأضف علامات مائية ورؤوسًا وأرقام صفحات، وادمج الصفحات وقسّمها ورتّبها، وحوّل الصور إلى PDF والصفحات إلى صور أو نص، دون رفع أي شيء.',
      linkText: 'أدوات PDF',
      body: [
        'تعمل كل أدوات PDF هنا على جهازك. يقرأ متصفحك ملف PDF ويعدّله ويعطيك ملفًا جديدًا، ولا يُرسل شيء إلى خادم، فتبقى العقود والفواتير والنماذج خاصة، وتواصل كل أداة العمل دون اتصال بعد أن تستخدمها مرة.',
        'لتغيير صفحات الملف استخدم الدمج أو التقسيم أو حذف الصفحات أو استخراجها أو ترتيبها. ولتغيير ما على الصفحات استخدم «تعديل PDF» لمربعات النص والتظليل والرسم والأشكال، و«توقيع PDF» لتوقيع مرسوم أو مكتوب أو مرفوع، و«تعبئة نموذج PDF» لحقول النماذج، والعلامة المائية والرأس والتذييل وترقيم الصفحات للنص على كل صفحة. ولتغيير الصيغة حوّل الصور إلى PDF، أو PDF إلى صور أو نص أو استخرج صوره.',
        'لتصغير ملف PDF أو إصلاحه استخدم «ضغط PDF» (تُحفظ الصور بالجودة التي تختارها ويُعرض الحجم قبل الضغط وبعده)، أو التحويل إلى تدرج رمادي، أو «إصلاح PDF»، أو «التعرّف الضوئي» لجعل الملف الممسوح قابلًا للبحث. وللتنقل بين الصيغ تصبح ملفات Word وExcel وPowerPoint وMarkdown وHTML والنص وCSV ملفات PDF يبقى نصها قابلًا للبحث، ويعيد تحويل PDF إلى Word أو Excel أو PowerPoint الملف قابلًا للتعديل. ولحماية الملف تضيف «حماية PDF» كلمة مرور، ويحذف «تنقيح PDF» النص نهائيًا، ويثبّت «تسطيح PDF» قيم النماذج، وتزيل «إزالة بيانات PDF الوصفية» اسم المؤلف والتواريخ.',
        'تعرض كل أداة معاينة قبل التنزيل، وتمرر خطواتها التالية النتيجة إلى أداة أخرى في الذاكرة، فيمكنك دمج ملف وترقيمه وتوقيعه في زيارة واحدة.',
      ],
    },
    '/video-tools': {
      title: 'أدوات الفيديو أونلاين – تحويل وضغط وقص بدون رفع',
      description: 'أدوات فيديو مجانية في متصفحك: حوّل MOV وWebM وMKV إلى MP4، واضغط الفيديو وقصّه واقتطعه وادمجه، واصنع GIF وMP3، وسجّل شاشتك. دون رفع أي ملف إلى أي خادم.',
      heading: 'أدوات فيديو مجانية: تحويل وضغط وقص وتعديل الفيديو',
      intro: 'أدوات فيديو مجانية تعمل على جهازك: حوّل MOV وWebM وMKV إلى MP4، وصغّر حجم الفيديو، واقتطع منه أو قصّ إطاره أو دوّره أو غيّر مقاسه، وادمج المقاطع أو كرّرها، وغيّر سرعتها، واكتم صوتها أو ضع لها صوتًا جديدًا، وحوّلها إلى GIF أو MP3، وسجّل شاشتك أو كاميرتك.',
      linkText: 'أدوات الفيديو',
      body: [
        'كل أدوات الفيديو هنا تعمل على جهازك. يقرأ متصفحك الفيديو، ويغيّره عامل في الخلفية بمرمّزات الفيديو المدمجة في المتصفح، ثم تنزّل النتيجة؛ لا يُرسل شيء إلى أي خادم، فتبقى فيديوهات العائلة وتسجيلات الشاشة ومكالمات العمل خاصة، وتعمل كل أداة دون اتصال بعد أن تستخدمها مرة.',
        'ليعمل الفيديو على كل الأجهزة، حوّله إلى MP4 بصورة H.264 وصوت AAC. ولتصغير حجمه للبريد أو المحادثات، استخدم ضغط الفيديو بمستوى جودة أو بحجم تختاره، أو غيّر مقاسه. ولإبقاء جزء منه فقط استخدم الاقتطاع، ولتغيير شكله القص أو التدوير أو القلب. ويجمع دمج الفيديو المقاطع في ملف واحد، ويكرّر تكرار الفيديو مقطعًا واحدًا، ويسرّع تغيير السرعة الفيديو أو يبطئه.',
        'ما الفيديوهات التي يقرؤها متصفحي؟ يعتمد ذلك على المتصفح: Chrome وEdge يقرآن أكثر الصيغ، وSafari يقرأ HEVC من iPhone، وFirefox يقرأ أقل قليلًا. وعندما يستخدم الفيديو ترميزًا لا يستطيع هذا المتصفح قراءته أو إنشاءه، تذكر الصفحة اسم الترميز وتقترح ترميزًا يعمل، بدلًا من أن تعطيك ملفًا معطوبًا.',
        'هل يمكنني تسجيل شاشتي دون تثبيت أي برنامج؟ نعم. يسجّل مسجّل الشاشة ومسجّل الكاميرا داخل المتصفح ويعطيانك ملف فيديو لحفظه؛ لا يُرفع شيء، ويتوقف التسجيل بمجرد الضغط على إيقاف أو إغلاق التبويب. ويحوّل تحويل PowerPoint إلى فيديو الشرائح إلى MP4 بعدد الثواني الذي تختاره لكل شريحة.',
      ],
    },
    '/image-tools': {
      title: 'أدوات الصور – ضغط وتغيير حجم وتحويل الصور دون رفع',
      description: 'أدوات صور مجانية في متصفحك: اضغط الصور وغيّر حجمها وقصّها ودوّرها وأضف علامة مائية، وحوّل HEIC إلى JPG، وأزل بيانات GPS، واصنع الميمز. لا يُرفع أي ملف.',
      heading: 'أدوات صور مجانية: ضغط الصور وتغيير حجمها وتحويلها وتعديلها',
      intro: 'أدوات صور مجانية تعمل على جهازك: صغّر حجم الصور، وغيّر مقاسها لإنستغرام أو واتساب أو الجواز، وقصّها ودوّرها وأضف إليها علامة مائية، وحوّل HEIC وWebP وPNG وSVG، وأزل موقع GPS، وعدّل الصور أو اصنع الميمز، لعدة صور معًا.',
      linkText: 'أدوات الصور',
      body: [
        'تعمل كل أدوات الصور هنا على جهازك. يقرأ متصفحك الصور، ويعدّلها عامل في الخلفية، ثم تنزّل النتيجة؛ ولا يُرسل شيء إلى خادم، فتبقى صور العائلة وصور الهوية ولقطات الشاشة خاصة، وتواصل كل أداة العمل دون اتصال بعد أن تستخدمها مرة.',
        'لتصغير حجم الصور استخدم ضغط الصور أو حوّلها إلى WebP. ولتغيير شكلها استخدم تغيير الحجم أو القص أو التدوير. ولتغيير صيغتها استخدم محوّل الصور أو إحدى صفحات التحويل المخصصة، مثل HEIC إلى JPG لصور الآيفون. ولحمايتها أضف علامة مائية، أو أزل بيانات الكاميرا والتاريخ وموقع GPS قبل مشاركتها.',
        'تقبل معظم الأدوات عدة صور معًا وتعطيك ملف ZIP واحدًا. ويضع «JPG إلى PDF» الصور في ملف PDF، ويحوّل «PDF إلى JPG» صفحات PDF إلى صور.',
        'هل يمكنني إخفاء الوجوه أو إزالة الخلفية دون رفع الصورة؟ نعم. تجد أداة تمويه الوجوه الوجوه في الصورة وتغطيها بتمويه أو بمربعات كبيرة، وتقص أداة إزالة الخلفية شخصًا أو غرضًا على خلفية شفافة أو بيضاء، وتكبّر أداة تكبير الصورة الصورة الصغيرة مرتين أو أربع مرات. وتستخدم كل منها نموذج ذكاء اصطناعي يعمل على جهازك، يرسله هذا الموقع إلى متصفحك في أول استخدام (نحو 16 إلى 22 ميغابايت) ثم يعمل دون اتصال. النماذج صغيرة، فراجع النتيجة: قد يفوتها وجه جانبي أو صغير جدًا، وقد يخرج الشعر الدقيق خشنًا.',
        'أي برنامج يفتح صور HEIC أو WebP أو TIFF؟ يفتح عارض الصور صور JPG وPNG وWebP وGIF وBMP وTIFF وSVG وصور HEIC من الآيفون في المتصفح، ويكبّرها، ويعرض الكاميرا والتاريخ والموقع المحفوظة في الصورة، لترى ما ستشاركه قبل إرساله. ويعدّل محرر الصور الإضاءة والألوان، ويضيف فلترًا أو نصًا، ويحفظ نسخة.',
      ],
    },
    '/data-tools': {
      title: 'أدوات البيانات – تحويل CSV وJSON وExcel دون رفع الملفات',
      description: 'أدوات مجانية لملفات CSV وTSV وJSON وExcel: اعرض الجداول الكبيرة، وحوّل بين الصيغ، ونسّق JSON وتحقق منه، وأخفِ البيانات الشخصية. كل ذلك في متصفحك دون رفع أي ملف.',
      heading: 'أدوات بيانات مجانية لملفات CSV واكسل وJSON',
      intro: 'أدوات مجانية للجداول وملفات البيانات: افتح CSV وJSON وXML وYAML، وحوّل بين أكثر من اثنتي عشرة صيغة، ونظّف الجداول وقارنها واستعلم عنها، وأخفِ البيانات الشخصية، كل ذلك في متصفحك دون رفع أي شيء.',
      linkText: 'أدوات البيانات',
      body: [
        'تريد فتح ملف CSV بدون اكسل؟ يعرض عارض CSV ملف CSV أو TSV جدولًا يمكنك ترتيبه وتصفيته والبحث فيه وتعديله، ويفتح عارض ملفات CSV الكبيرة ملفات فيها صفوف أكثر مما تتسع له ورقة اكسل: يُفتح ملف من 120,000 صف في نحو ثانية. ويعرض عارض JSON الملف شجرةً أو جدولًا، وعارض XML شجرةً قابلة للطي، ويجد منسّق YAML الأخطاء بأرقام أسطرها ويعيد تنسيق الملف.',
        'تحتاج البيانات بصيغة أخرى؟ تتحول ملفات CSV واكسل إلى JSON، وإلى جمل SQL INSERT، وXML وYAML، وجداول Markdown وHTML وLaTeX، ونص بعرض ثابت، وإلى بعضها بعضًا. ويتحول JSON إلى CSV مع تسطيح الكائنات المتداخلة في أعمدة، وإلى YAML أو XML أو TOON المختصرة، وإلى أنواع وأصناف للغات TypeScript وPython وGo وJava وC#. وتعود ملفات XML وYAML وجداول HTML وملفات SQL إلى CSV.',
        'تريد تنظيف ملف أو التحقق منه؟ يقدّم مدقّق CSV تقريرًا بكل مشكلة وصفّها، ويشير منسّق JSON ومدقّقه إلى سطر الخطأ بالضبط. وتحذف أداة إزالة التكرار الصفوف المكررة، وتصلح أداة تغيير حالة الأحرف حروف عمود كامل، وتقلب أداة التبديل الصفوف والأعمدة، ويقسّم «تقسيم CSV» ملفًا كبيرًا إلى ملفات أصغر، ويجمع «دمج CSV» ملفات لها صف العناوين نفسه. وتبيّن «مقارنة CSV» الصفوف المضافة والمحذوفة والمعدّلة، وتعيد أداتا تغيير ترميز CSV وتغيير فاصله كتابة الملف للبرنامج الذي سيقرؤه.',
        'تريد إجابات من البيانات؟ يشغّل «SQL على CSV» استعلامات قياسية على الجدول، ويعرض الجدول المحوري المجاميع حسب الحقول التي تختارها، ويرسم صانع المخططات مخططًا من عمودين ويحفظه صورة.',
        'تريد مشاركة الملف بأمان؟ تجد أداة إخفاء البيانات الحساسة الأسماء والبريد وأرقام الهواتف وأرقام الهوية وتخفيها قبل أن يغادر الملف يدك، وتشفّر أدوات Base64 وURL وJWT النصوص التي يلصقها المطورون كل يوم وتفك تشفيرها. تعمل كل أداة في متصفحك، فلا يُرفع صف واحد.',
      ],
    },
    '/ai-tools': {
      title: 'أدوات ملفات جاهزة للذكاء الاصطناعي – حوّلها إلى نص',
      description: 'حوّل ملفات PDF وWord وPowerPoint إلى Markdown، واعدد الرموز، واختصر JSON بصيغة TOON قبل لصقها في محادثة ذكاء اصطناعي. مجانًا في متصفحك، ولا يُرفع أي شيء.',
      heading: 'أدوات ملفات جاهزة للذكاء الاصطناعي: حوّل المستندات إلى نص مرتب',
      intro: 'حوّل ملفات PDF ومستندات Word وعروض الشرائح والجداول إلى Markdown مرتب، واعرف عدد رموزها، واكتب JSON بصيغة TOON المختصرة قبل أن تلصقها في ChatGPT أو Claude أو Gemini.',
      linkText: 'أدوات جاهزة للذكاء الاصطناعي',
      body: [
        'تريد أن تسأل محادثة ذكاء اصطناعي عن ملف PDF أو مستند وورد أو عرض شرائح؟ النص المنسوخ من الملف مباشرة يفقد عناوينه وقوائمه وجداوله، وقد يتجاوز الملف الطويل ما تقبله المحادثة. تكتب هذه الأدوات الملف أولًا بصيغة Markdown مرتبة: تحويل PDF إلى Markdown يجعل النص الأكبر عناوين ويحتفظ بالقوائم والجداول البسيطة، وتحويل Word إلى Markdown يحتفظ بعناوين وورد وقوائمه وروابطه وجداوله، وتحويل PowerPoint إلى Markdown يكتب عنوان كل شريحة ونقاطها وتحتها ملاحظات المتحدث. ويكتب تحويل Excel إلى Markdown وتحويل CSV إلى Markdown الورقة جدول Markdown. وتُترك الصور والمخططات، وملف PDF الممسوح ضوئيًا لا نص فيه يُحوَّل حتى تقرأه أداة التعرّف الضوئي على النص.',
        'هل يتسع له؟ يعرض عدّاد الرموز عدد الرموز والكلمات والحروف في ملف أو نص، فتعرف هل يتسع قبل أن تلصقه، وتختصره إن لم يتسع؛ والأعداد للمحادثات المختلفة تقديرية، لأن كلًّا منها يعدّ بطريقة مختلفة قليلًا. وتعيد أداة JSON إلى TOON كتابة JSON بصيغة TOON المختصرة، التي تكتب مفاتيح قائمة السجلات مرة واحدة بدل تكرارها في كل عنصر، وتعرض عدد الرموز قبل التحويل وبعده؛ وتعيد TOON إلى JSON أيضًا.',
        'يجري كل شيء في متصفحك: لا يُرفع أي ملف، ولا يُرسل شيء إلى أي خدمة ذكاء اصطناعي. تُعدّ الأدوات الجاهزة للذكاء الاصطناعي نصك فقط، ليكون ما تلصقه مرتبًا وتعرف طوله.',
        'وبعض الذكاء الاصطناعي يعمل هنا مباشرة. تستخدم أدوات التلخيص بالذكاء الاصطناعي وترجمة مستند والمحادثة مع PDF الذكاء الاصطناعي المدمج في كروم الحديث على الحاسوب، على جهازك. ويقرأ التعرّف الضوئي على نص PDF وتحويل الصورة إلى نص الكلمات في المسح الضوئي والصور بالعربية والإنجليزية؛ وتعمل إزالة الخلفية وتمويه الوجوه وتكبير الصورة بدقة (تجريبي) على الصور؛ وتترجم أداة ترجمة PDF من الإنجليزية إلى العربية وبالعكس. نماذجها ملفات من هذا الموقع، تُحمَّل في أول مرة ويحتفظ بها متصفحك، فتعمل بعدها دون اتصال ولا تغادر ملفاتك جهازك.',
        'قبل أن تلصق أي شيء في محادثة ذكاء اصطناعي، تحقق من خلوّه من البيانات الشخصية. أداة إخفاء البيانات تستبدل الأسماء والبريد وأرقام الهواتف وأرقام الهوية في ملفات CSV وExcel وJSON والنصوص، على جهازك.',
      ],
    },
    '/office-tools': {
      title: 'أدوات المكتب – حوّل وادمج وقسّم ملفات وورد واكسل وبوربوينت',
      description: 'أدوات مجانية لملفات المكتب: افتح ملفات وورد واكسل وبوربوينت وحوّلها وادمجها وقسّمها وقارنها ونظّفها من بيانات المؤلف في متصفحك دون Office. لا يُرفع أي ملف.',
      heading: 'أدوات مكتب مجانية: افتح ملفات وورد واكسل وبوربوينت وحوّلها وعدّلها',
      intro: 'افتح ملفات Word وExcel وPowerPoint والملفات النصية وحوّلها وعدّلها دون تثبيت Office: عارضات وأدوات مجانية تعمل في متصفحك ولا ترفع ملفاتك أبدًا. وفي عارضات Word وExcel وPowerPoint يمكنك البحث في الملف وطباعته أو حفظه بصيغة PDF، وتواصل الصفحة العمل دون اتصال بالإنترنت بعد تحميلها.',
      linkText: 'أدوات المكتب',
      body: [
        'وصلك ملف لا تستطيع فتحه؟ تفتح أدوات المكتب الملفات التي تصلك في العمل دون Microsoft Office: مستندات Word (‎.docx و‎.dotx و‎.docm وOpenDocument ‎.odt)، ومصنفات Excel (‎.xlsx و‎.xlsm و‎.ods وملفات ‎.xls القديمة)، وعروض PowerPoint (‎.pptx و‎.ppsx و‎.potx و‎.pptm، تجريبيًا)، والملفات النصية. يرسم متصفحك كل شيء، فلا يُرفع مستند سري لقراءته، وتواصل الصفحات العمل دون اتصال بعد تحميلها.',
        'يعرض عارض Word الصفحات بخطوطها وجداولها وصورها، مع لوحة تنقل وبحث وتعليقات وقراءة بصوت عالٍ. ويحتفظ عارض Excel بالمعادلات وتنسيقات الأرقام والأجزاء المثبتة، ويتيح تعديل الخلايا وتنزيل المصنف. ويعرض عارض PowerPoint الشرائح مع ملاحظات المتحدث وشبكة كل الشرائح وملء الشاشة وعرض المقدّم. ويقرأ محرر TXT الملفات النصية ويعدّلها ويصلح ترميزها. ويمكن لعارضات Word وExcel وPowerPoint الطباعة أو الحفظ بصيغة PDF، وتظهر المستندات العربية من اليمين إلى اليسار.',
        'تحتاج ملف PDF لإرساله؟ تحفظ أداتا تحويل Word إلى PDF وتحويل Excel إلى PDF المستند أو المصنف صفحات PDF يبقى نصها قابلًا للتحديد والبحث. وتحتاج الكلمات لمحادثة ذكاء اصطناعي أو ويكي أو ملاحظات؟ تحوّل أداتا Word إلى Markdown وPowerPoint إلى Markdown العناوين والقوائم والجداول وملاحظات المتحدث إلى Markdown مرتب، وتستخرج أداتا تحويل Excel إلى CSV وExcel إلى JSON بيانات الورقة.',
        'تحتاج إلى تعديل الملف نفسه؟ ادمج مستندات Word ومصنفات Excel وعروض PowerPoint أو قسّمها، وابحث عن نص واستبدله في مستند Word كله، وأزل التعليقات والتغييرات المتعقَّبة قبل الإرسال، وأضف علامة مائية «سري»، وأنشئ رسالة لكل صف من جدول بدمج المراسلات، وقارن نسختين من مستند Word أو مصنف، وأزل حماية الأوراق من مصنف تملكه أو أصلح مصنفًا لا يفتحه Excel، واعرض بيانات المؤلف والشركة والتواريخ المحفوظة في أي منها أو أزلها. تعدّل كل أداة الملف في متصفحك.',
        'لست متأكدًا أي برنامج تستخدم؟ تقارن الأدلة الخيارات المجانية لكل نوع ملف: كيف تفتح ملف DOCX بدون وورد، وملف XLSX بدون اكسل، وملف PPTX بدون بوربوينت، وملف TXT على أي جهاز، وأيها يرفع ملفك، وما يحفظه كل منها.',
      ],
    },
    '/all-tools': {
      title: 'كل الأدوات المجانية: PDF والمكتب والصور والفيديو والبيانات',
      description: 'كل أدوات OpenAnyDoc المجانية في مكان واحد: أدوات PDF ووورد واكسل وبوربوينت، وأدوات الصور والفيديو، ومحوّلات CSV وJSON، وذكاء اصطناعي على جهازك. لا يُرفع أي ملف.',
      heading: 'كل الأدوات المجانية: PDF والمكتب والصور والفيديو والبيانات والذكاء الاصطناعي',
      intro: 'كل أدوات OpenAnyDoc مرتبة حسب نوع الملف الذي تعمل عليه. كلها تعمل في متصفحك، ولا ترفع أي منها ملفاتك.',
      linkText: 'كل الأدوات',
      body: [
        'تعمل كل أدوات OpenAnyDoc بالطريقة نفسها: تختار ملفًا، ويقوم متصفحك بالعمل، وتنزّل النتيجة. لا يُرفع شيء، ولا حساب ولا علامة مائية، وتعمل كل أداة دون اتصال بعد أن تستخدمها مرة. اختر أداة من مجموعات PDF أو المكتب أو الصور أو الفيديو أو البيانات أو الذكاء الاصطناعي أعلاه، أو أفلت أي ملف مدعوم على الصفحة الرئيسية فيُفتح في العارض المناسب.',
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
export const guideAddresses = ['/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing', '/sign-pdf-without-adobe', '/pdf-tools-without-upload', '/open-txt-file', '/open-csv-without-excel', '/open-pptx-without-powerpoint', '/open-pdf-without-adobe', '/fix-arabic-text-copied-from-pdf', '/cant-edit-text-in-pdf', '/fill-pdf-form-without-acrobat', '/stirling-pdf-alternative', '/jsonformatter-alternative', '/pdf-to-ai-chat-with-tables', '/how-many-tokens-is-my-pdf', '/word-document-to-ai-chat', '/powerpoint-to-ai-chat', '/spreadsheet-to-ai-chat', '/make-markdown-table-from-csv', '/what-is-toon-format', '/how-to-merge-pdf-files', '/how-to-split-a-pdf', '/photos-to-one-pdf', '/password-protect-pdf-free', '/make-scanned-pdf-searchable', '/reduce-photo-file-size', '/open-heic-on-windows', '/remove-location-from-photo', '/remove-background-without-upload', '/convert-excel-to-json-for-api', '/split-large-csv', '/json-vs-json-lines', '/compare-two-json-files', '/excel-row-and-column-limits', '/find-hidden-sheets-in-excel', '/excel-to-csv-without-breaking-arabic', '/read-speaker-notes-without-powerpoint', '/compress-video-without-upload', '/file-too-large-for-chatgpt', '/best-free-csv-viewers', '/best-free-json-formatters', '/openanydoc-vs-google-sheets-large-files', '/large-csv-test']

export const pagesWithShareImage = ['/', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/word-viewer', '/powerpoint-viewer', '/json-formatter', '/json-validator', '/tsv-viewer', '/large-csv-viewer', '/xls-viewer', '/excel-to-csv', '/csv-to-excel', '/excel-to-json', '/csv-to-json', '/json-to-csv', '/mask-data', '/guides', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token', '/check-file-upload', '/open-json-file', '/open-xlsx-without-excel', '/open-docx-without-word', '/csv-vs-excel-vs-json', '/anonymize-data-before-sharing', '/sign-pdf-without-adobe', '/pdf-tools-without-upload', '/open-txt-file', '/open-csv-without-excel', '/open-pptx-without-powerpoint', '/open-pdf-without-adobe', '/fix-arabic-text-copied-from-pdf', '/cant-edit-text-in-pdf', '/fill-pdf-form-without-acrobat', '/stirling-pdf-alternative', '/jsonformatter-alternative', '/pdf-to-ai-chat-with-tables', '/how-many-tokens-is-my-pdf', '/word-document-to-ai-chat', '/powerpoint-to-ai-chat', '/spreadsheet-to-ai-chat', '/make-markdown-table-from-csv', '/what-is-toon-format', '/how-to-merge-pdf-files', '/how-to-split-a-pdf', '/photos-to-one-pdf', '/password-protect-pdf-free', '/make-scanned-pdf-searchable', '/reduce-photo-file-size', '/open-heic-on-windows', '/remove-location-from-photo', '/remove-background-without-upload', '/convert-excel-to-json-for-api', '/split-large-csv', '/json-vs-json-lines', '/compare-two-json-files', '/excel-row-and-column-limits', '/find-hidden-sheets-in-excel', '/excel-to-csv-without-breaking-arabic', '/read-speaker-notes-without-powerpoint', '/compress-video-without-upload', '/file-too-large-for-chatgpt', '/best-free-csv-viewers', '/best-free-json-formatters', '/openanydoc-vs-google-sheets-large-files', '/large-csv-test']

// The live tool and hub pages have one each too, drawn from the registry.
export const registryPagesWithShareImage = [...liveTools.map(toolPath), ...liveHubs.map((hub) => hub.path), ALL_TOOLS_PATH]

export function getShareImage(locale: Locale, address: string) {
  const imageAddress = pagesWithShareImage.includes(address) || registryPagesWithShareImage.includes(address) ? address : '/'
  return {
    path: `/og/${locale}-${imageAddress === '/' ? 'home' : imageAddress.slice(1)}.png`,
    alt: `${SITE_NAME}: ${pageSeo[locale][imageAddress].heading}`,
  }
}
