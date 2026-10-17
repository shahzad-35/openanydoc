// The words search engines and visitors see first for each page: title, description, main heading and the sentence under it.
// Keyed by language ('en', 'ar'), then by page address.
// Plain data with no imports, because scripts/build-static-pages.mjs also reads it to write each page's <head> at build time.
//
// Rules for anything added here (see CLAUDE.md, "Writing for search"): the main phrase a person would type comes first in the
// title and the heading; a title is at most 60 characters and a description 120 to 160; every page has its own; say only what
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
      intro: 'Open files without software and edit files online free: CSV, Excel, JSON and TXT. A private file viewer with no upload and no sign-up: your files never leave your device.',
    },
    '/csv-viewer': {
      title: 'CSV Viewer Online – Free CSV Editor, No Upload',
      description: 'CSV viewer online and CSV editor: open a CSV file online, view large CSV files, search, sort, edit cells and download. Free, private, and nothing is uploaded.',
      heading: 'CSV Viewer Online and CSV Editor',
      intro: 'Open a CSV file online as a searchable table, view large CSV files, and edit the CSV file online cell by cell before you download it. Your file never leaves your device.',
    },
    '/excel-viewer': {
      title: 'Excel Viewer Online – Open XLSX Without Excel',
      description: 'Excel viewer online: open XLSX, XLS, XLSM and ODS files without Excel, edit Excel online free with formulas that recalculate, and save. No upload, no sign-up.',
      heading: 'Excel Viewer Online: Open and Edit XLSX Files',
      intro: 'Open an XLSX file without Excel, with all its sheets, edit cells and formulas, and save the workbook in the same format. Your file never leaves your device.',
    },
    '/json-viewer': {
      title: 'JSON Viewer Online: Formatter & Tree Viewer, No Upload',
      description: 'JSON viewer online and JSON editor: format and validate JSON, explore it in a tree viewer, fix errors and download. A free JSON formatter with no upload.',
      heading: 'JSON Viewer Online, Formatter and Editor',
      intro: 'Explore JSON as a tree, a table or formatted code, fix errors by line and column, then format and download it. A JSON formatter with no upload: your file never leaves your device.',
    },
    '/txt-viewer': {
      title: 'Text File Viewer & Editor Online (TXT) – OpenAnyDoc',
      description: 'Free online TXT editor: find and replace with regex, sort lines, remove duplicate lines, change case, count words and compare changes. No upload.',
      heading: 'Online Text File (TXT) Viewer and Editor',
      intro: 'Read and edit plain text files in the browser, with search, line numbers and handy tools for lines and whitespace. Your file never leaves your device.',
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
      title: 'عارض ملفات اونلاين ومحرر مجاني – OpenAnyDoc',
      description: 'عارض ملفات اونلاين ومحرر مجاني: افتح ملفات CSV وExcel وJSON وTXT بدون برنامج وعدّلها في متصفحك. خصوصية كاملة: لا رفع ولا تسجيل، وملفاتك لا تغادر جهازك.',
      heading: 'عارض ملفات اونلاين ومحرر مجاني',
      intro: 'افتح ملف اكسل بدون برنامج، وعدّل ملفات CSV وJSON وTXT في متصفحك: بدون رفع وبدون تسجيل وبدون تثبيت. ملفاتك لا تغادر جهازك أبدًا.',
    },
    '/csv-viewer': {
      title: 'عارض CSV اونلاين – حل مشكلة الحروف العربية في CSV',
      description: 'عارض ومحرر CSV مجاني: افتح ملف CSV اونلاين، وحل مشكلة الحروف العربية في ملف CSV تلقائيًا، وابحث وافرز وعدّل الخلايا ثم نزّل الملف. بدون رفع.',
      heading: 'عارض ومحرر CSV اونلاين',
      intro: 'افتح ملف CSV كجدول قابل للبحث، وتُعرض الحروف العربية بشكل صحيح حتى في ملفات Windows-1256 القديمة، وعدّل الخلايا والصفوف والأعمدة ثم نزّل النتيجة. ملفك لا يغادر جهازك أبدًا.',
    },
    '/excel-viewer': {
      title: 'فتح ملف اكسل بدون برنامج – عارض Excel اونلاين',
      description: 'عارض Excel اونلاين مجاني: فتح ملف اكسل بدون برنامج (XLSX وXLS وXLSM وODS)، وتعديل ملف اكسل اونلاين مع صيغ تُعاد حسابها، ثم الحفظ. بدون رفع وبدون تسجيل.',
      heading: 'فتح ملف اكسل بدون برنامج وتعديله اونلاين',
      intro: 'افتح مصنف Excel بكل أوراقه بدون برنامج Excel، وعدّل الخلايا والصيغ التي تُعاد حسابها، واحفظه بالصيغة نفسها. ملفك لا يغادر جهازك أبدًا.',
    },
    '/json-viewer': {
      title: 'عارض JSON اونلاين – منسق JSON وعرض شجري بدون رفع',
      description: 'عارض JSON اونلاين ومحرر مجاني: نسّق JSON وتحقق منه، واستعرضه كشجرة أو جدول، وأصلح الأخطاء بمعرفة السطر والعمود، ثم نزّل الملف. بدون رفع إلى أي خادم.',
      heading: 'عارض JSON اونلاين ومنسق ومحرر',
      intro: 'استعرض JSON كشجرة أو جدول أو شيفرة منسقة، وأصلح الأخطاء بمعرفة السطر والعمود، ثم نسّقه ورتّبه ونزّله. ملفك لا يغادر جهازك أبدًا.',
    },
    '/txt-viewer': {
      title: 'عارض ومحرر الملفات النصية أونلاين (TXT) – OpenAnyDoc',
      description: 'محرر TXT مجاني عبر الإنترنت: بحث واستبدال بالتعابير النمطية، وفرز الأسطر، وحذف المكرر منها، وتغيير حالة الأحرف، وعدّ الكلمات ومقارنة التغييرات. بدون رفع.',
      heading: 'عارض ومحرر الملفات النصية (TXT) أونلاين',
      intro: 'اقرأ الملفات النصية العادية وعدّلها في المتصفح، مع البحث وأرقام الأسطر وأدوات عملية للأسطر والمسافات. ملفك لا يغادر جهازك أبدًا.',
    },
    '/about': {
      title: 'عن OpenAnyDoc – عارض ملفات خاص اونلاين',
      description: 'عن OpenAnyDoc: عارض ومحرر ملفات مجاني يعمل في متصفحك ولا يرفع ملفاتك أبدًا. يدعم اليوم CSV وExcel وJSON وTXT، وقريبًا ملفات وورد وPDF وباوربوينت.',
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
      description: 'شروط استخدام OpenAnyDoc: عارض ومحرر الملفات مجاني ويُقدَّم كما هو دون أي ضمان. احتفظ بملفاتك الأصلية، فأنت مسؤول عن الملفات التي تفتحها وتعدّلها.',
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
