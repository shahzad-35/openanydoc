// The words search engines and visitors see first for each page: title, description, main heading and the sentence under it.
// Keyed by language ('en', 'ar'), then by page address.
// Plain data with no imports, because scripts/build-static-pages.mjs also reads it to write each page's <head> at build time.
//
// Rules for anything added here (see CLAUDE.md, "Writing for search"): the main phrase a person would type comes first in the
// title and the heading; a title is at most 60 characters and a description 150 to 160; every page has its own; say only what
// the page really does (no format that is not built); the heading is the only h1 of the page.

export const SITE_ORIGIN = 'https://openanydoc.com'
export const SITE_NAME = 'OpenAnyDoc'

type Locale = 'en' | 'ar'

export type PageSeo = { title: string; description: string; heading: string; intro: string }

// Keyed by language, then by the page address: '/' for the home page, the format's toolPath for each format page.
export const pageSeo: Record<Locale, Record<string, PageSeo>> = {
  en: {
    '/': {
      title: 'Free Online File Viewer and Editor – OpenAnyDoc',
      description: 'Free online file viewer and editor: open CSV, Excel (XLSX), JSON and TXT files without software and edit them in your browser. Private: no upload, no sign-up.',
      heading: 'Free Online File Viewer and Editor',
      intro: 'OpenAnyDoc is a free online file viewer and editor for CSV, Excel, JSON and TXT files. Open files online without software, edit them in your browser and download a copy: no upload, no sign-up, and your files never leave your device.',
    },
    '/csv-viewer': {
      title: 'CSV Viewer Online – Free CSV Editor, No Upload',
      description: 'CSV viewer online and free CSV editor: open a CSV file online, view large CSV files, search, sort, edit cells and download. Private: nothing is uploaded.',
      heading: 'CSV Viewer Online and CSV Editor',
      intro: 'A free CSV viewer online and CSV editor: open a CSV or TSV file as a searchable table, view large CSV files (a 120,000-row file opens in under a second) and edit CSV in your browser before you download it. Your file never leaves your device.',
    },
    '/excel-viewer': {
      title: 'Excel Viewer Online – Open XLSX Files Without Excel',
      description: 'Excel viewer online: open XLSX, XLS, XLSM and ODS files without Excel, edit Excel online free with formulas that recalculate, and save. No upload, no sign-up.',
      heading: 'Excel Viewer Online: Open and Edit XLSX Files',
      intro: 'A free Excel viewer online: open an XLSX file without Excel, with all its sheets, formats and merged cells, edit cells and formulas, and save the workbook in the same format. XLS, XLSM and ODS files open too, and your file never leaves your device.',
    },
    '/json-viewer': {
      title: 'JSON Viewer Online – Formatter, Validator & Tree View',
      description: 'JSON viewer online: a free JSON formatter, validator and tree viewer. Pretty print or minify JSON, fix errors by line and column, then download. No upload.',
      heading: 'JSON Viewer Online, Formatter and Editor',
      intro: 'A free JSON viewer online: open a JSON file or paste JSON, explore it as a tree, a table or formatted code, validate it and fix errors by line and column, then pretty print and download it. Your JSON never leaves your device.',
    },
    '/txt-viewer': {
      title: 'Open TXT File Online – Free Text Editor, No Upload',
      description: 'Open TXT file online and edit it free: a text file viewer and online text editor with find and replace, sort lines, remove duplicates and word count. No upload.',
      heading: 'Open TXT File Online: Free Text Viewer and Editor',
      intro: 'Open TXT file online in your browser and read or edit it like a notepad online: search, line numbers, and tools for lines, whitespace and case, with Arabic text shown right to left. Your file never leaves your device.',
    },
    '/about': {
      title: 'About OpenAnyDoc – Private Online File Viewer',
      description: 'OpenAnyDoc is a free file viewer and editor that runs in your browser and never uploads files: CSV, Excel, JSON and TXT now, and Word, PDF and PowerPoint soon.',
      heading: 'About OpenAnyDoc',
      intro: 'A free, privacy-first file viewer and editor that runs in your browser.',
    },
    '/privacy': {
      title: 'Privacy Policy – OpenAnyDoc',
      description: 'OpenAnyDoc privacy policy: files open in your browser and are never uploaded. No analytics, no cookies, no tracking. What your browser keeps and who hosts us.',
      heading: 'Privacy Policy',
      intro: 'In short: your files stay on your device, and we do not track you.',
    },
    '/terms': {
      title: 'Terms of Use – OpenAnyDoc',
      description: 'OpenAnyDoc terms of use: the file viewer and editor is free and provided as is, without warranty. Keep your original files: you are responsible for your edits.',
      heading: 'Terms of Use',
      intro: 'The short rules for using OpenAnyDoc.',
    },
  },
  ar: {
    '/': {
      title: 'عارض ملفات اون لاين مجاني – فتح الملفات بدون برامج',
      description: 'عارض ملفات اون لاين مجاني: افتح ملفات CSV وExcel وJSON وTXT وعدّلها في متصفحك. فتح الملفات بدون برامج وبدون تسجيل، وملفاتك لا تُرفع ولا تغادر جهازك أبدًا.',
      heading: 'عارض ملفات اون لاين مجاني ومحرر للملفات',
      intro: 'OpenAnyDoc عارض ملفات اون لاين مجاني تفتح به ملفات CSV وExcel وJSON وTXT وتعدّلها ثم تنزّل نسخة منها. فتح الملفات بدون برامج وبدون تسجيل، والملف يُقرأ داخل متصفحك فلا يُرفع ولا يغادر جهازك.',
    },
    '/csv-viewer': {
      title: 'عارض CSV اون لاين – فتح ملف CSV وتعديله مجانًا',
      description: 'عارض CSV اون لاين مجاني: فتح ملف CSV كجدول، والبحث والفرز وتعديل الخلايا مع عرض صحيح للحروف العربية، ثم التنزيل. تعديل ملف CSV اون لاين بدون رفع أي ملف.',
      heading: 'عارض CSV اون لاين ومحرر مجاني',
      intro: 'عارض CSV اون لاين مجاني: افتح ملف CSV كجدول تبحث فيه وتفرزه، حتى الملفات الكبيرة (يُفتح ملف من 120,000 صف في أقل من ثانية)، وتظهر الحروف العربية سليمة حتى في ملفات Windows-1256 القديمة. عدّل الخلايا ثم نزّل الملف، وملفك لا يغادر جهازك.',
    },
    '/excel-viewer': {
      title: 'فتح ملف اكسل اون لاين – عارض ملفات XLSX مجاني',
      description: 'فتح ملف اكسل اون لاين مجانًا: عارض ملفات XLSX وXLS وXLSM وODS، مع تعديل الخلايا والصيغ التي تُعاد حسابها ثم الحفظ. فتح ملف اكسل بدون برنامج وبدون رفع.',
      heading: 'فتح ملف اكسل اون لاين وتعديله بدون برنامج',
      intro: 'فتح ملف اكسل اون لاين بكل أوراقه، بدون برنامج Excel وبدون تسجيل: عارض ملفات XLSX وXLS وXLSM وODS يعرض التنسيقات والخلايا المدمجة، وتعدّل فيه الخلايا والصيغ ثم تحفظ المصنف بصيغته نفسها. ملفك لا يغادر جهازك.',
    },
    '/json-viewer': {
      title: 'عارض JSON اون لاين – تنسيق JSON وعرض شجري بدون رفع',
      description: 'عارض JSON مجاني: فتح ملف JSON أو لصقه، وتنسيق JSON اون لاين والتحقق منه، وعرضه كشجرة أو جدول، وإصلاح الأخطاء بالسطر والعمود ثم تنزيله. بدون رفع أي ملف.',
      heading: 'عارض JSON اون لاين ومنسق ومحرر',
      intro: 'عارض JSON مجاني يعمل في متصفحك: افتح ملف JSON أو الصقه، واستعرضه كشجرة أو جدول أو شيفرة منسقة، وتحقق منه وأصلح أخطاءه بمعرفة السطر والعمود، ثم نسّقه ونزّله. تنسيق JSON اون لاين دون أن يغادر ملفك جهازك.',
    },
    '/txt-viewer': {
      title: 'فتح ملف TXT اون لاين – محرر نصوص اون لاين مجاني',
      description: 'فتح ملف TXT اون لاين وتعديله مجانًا: محرر نصوص اون لاين فيه بحث واستبدال، وفرز الأسطر وحذف المكرر منها، وتغيير حالة الأحرف وعدّ الكلمات. ملفك لا يُرفع أبدًا.',
      heading: 'فتح ملف TXT اون لاين: عارض ومحرر نصوص مجاني',
      intro: 'فتح ملف TXT اون لاين وقراءته وتعديله في متصفحك: محرر نصوص اون لاين مع البحث وأرقام الأسطر وأدوات للأسطر والمسافات وحالة الأحرف، ويعرض النص العربي من اليمين إلى اليسار. ملفك لا يغادر جهازك.',
    },
    '/about': {
      title: 'عن OpenAnyDoc – عارض ملفات خاص اون لاين',
      description: 'عن OpenAnyDoc: عارض ومحرر ملفات اون لاين مجاني يعمل في متصفحك ولا يرفع ملفاتك أبدًا. يدعم اليوم CSV وExcel وJSON وTXT، وقريبًا ملفات وورد وPDF وباوربوينت.',
      heading: 'عن OpenAnyDoc',
      intro: 'عارض ومحرر ملفات مجاني يضع الخصوصية أولًا ويعمل داخل متصفحك.',
    },
    '/privacy': {
      title: 'سياسة الخصوصية – OpenAnyDoc',
      description: 'سياسة الخصوصية في OpenAnyDoc: تُفتح الملفات في متصفحك ولا تُرفع أبدًا. لا تحليلات ولا ملفات تعريف ارتباط ولا تتبع. ما يحفظه المتصفح ومن يستضيف الموقع.',
      heading: 'سياسة الخصوصية',
      intro: 'باختصار: ملفاتك تبقى على جهازك، ونحن لا نتتبعك.',
    },
    '/terms': {
      title: 'شروط الاستخدام – OpenAnyDoc',
      description: 'شروط استخدام OpenAnyDoc: عارض ومحرر الملفات مجاني ويُقدَّم كما هو دون أي ضمان. احتفظ دائمًا بملفاتك الأصلية، فأنت مسؤول عن الملفات التي تفتحها وتعدّلها.',
      heading: 'شروط الاستخدام',
      intro: 'القواعد المختصرة لاستخدام OpenAnyDoc.',
    },
  },
}

// The Open Graph name of each language (og:locale and og:locale:alternate).
export const openGraphLocales: Record<Locale, string> = { en: 'en_US', ar: 'ar_AR' }

// The pages with a share picture of their own (public/og/, 1200 x 630, made by scripts/generate-og-images.mjs); every other page
// (About, Privacy, Terms, the changelog) shows the home page's picture in its language.
export const pagesWithShareImage = ['/', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer']

export function getShareImage(locale: Locale, address: string) {
  const imageAddress = pagesWithShareImage.includes(address) ? address : '/'
  return {
    path: `/og/${locale}-${imageAddress === '/' ? 'home' : imageAddress.slice(1)}.png`,
    alt: `${SITE_NAME}: ${pageSeo[locale][imageAddress].heading}`,
  }
}
