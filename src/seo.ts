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
      title: 'Free CSV, Excel, JSON & TXT Viewer and Editor – OpenAnyDoc',
      description: 'Open, view and edit CSV, Excel (XLSX, XLS), JSON and TXT files online for free. Private: files are read in your browser and never uploaded.',
      heading: 'Free Online CSV, Excel, JSON and TXT Viewer and Editor',
      intro: 'Open and edit your files in the browser: no upload, no sign-up, no install. Your files never leave your device.',
    },
    '/csv-viewer': {
      title: 'CSV Viewer & Editor Online – Open and Edit CSV Free',
      description: 'Free online CSV viewer and editor: open large CSV and TSV files with automatic delimiter detection, search, sort, edit cells and download. No upload.',
      heading: 'Online CSV Viewer and Editor',
      intro: 'Open a CSV, TSV or tab file as a searchable table, edit cells, rows and columns, and download the result. Your file never leaves your device.',
    },
    '/excel-viewer': {
      title: 'Excel Viewer & Editor Online – Open XLSX, XLS Free',
      description: 'Free online Excel viewer and editor: open XLSX, XLS, XLSM and ODS files, edit cells and formulas, change formats and save. No upload, no sign-up.',
      heading: 'Online Excel Viewer and Editor (XLSX, XLS, XLSM, ODS)',
      intro: 'Open an Excel workbook with all its sheets, edit cells and formulas that recalculate, and save it in the same format. Your file never leaves your device.',
    },
    '/json-viewer': {
      title: 'JSON Viewer & Editor Online – Format and Edit JSON',
      description: 'Free online JSON viewer, formatter and editor: explore JSON as a tree, table or code, find errors, sort keys, minify and download. No upload.',
      heading: 'Online JSON Viewer and Editor',
      intro: 'Explore JSON as a tree, a table or formatted code, fix errors with line and column, then format, sort and download it. Your file never leaves your device.',
    },
    '/txt-viewer': {
      title: 'Text File Viewer & Editor Online (TXT) – OpenAnyDoc',
      description: 'Free online TXT editor: find and replace with regex, sort lines, remove duplicate lines, change case, count words and compare changes. No upload.',
      heading: 'Online Text File (TXT) Viewer and Editor',
      intro: 'Read and edit plain text files in the browser, with search, line numbers and handy tools for lines and whitespace. Your file never leaves your device.',
    },
  },
  ar: {
    '/': {
      title: 'عارض ومحرر CSV وExcel وJSON وTXT مجاني – OpenAnyDoc',
      description: 'افتح ملفات CSV وExcel (XLSX وXLS) وJSON وTXT واعرضها وعدّلها أونلاين مجانًا. خصوصية كاملة: تُقرأ الملفات في متصفحك ولا تُرفع أبدًا إلى أي خادم.',
      heading: 'عارض ومحرر CSV وExcel وJSON وTXT مجاني أونلاين',
      intro: 'افتح ملفاتك وعدّلها في المتصفح: بدون رفع وبدون تسجيل وبدون تثبيت. ملفاتك لا تغادر جهازك أبدًا.',
    },
    '/csv-viewer': {
      title: 'عارض ومحرر CSV أونلاين – فتح وتعديل مجاني',
      description: 'عارض ومحرر CSV مجاني عبر الإنترنت: افتح ملفات CSV وTSV الكبيرة مع اكتشاف تلقائي للفاصل، وابحث وافرز وعدّل الخلايا ثم نزّل الملف. بدون رفع.',
      heading: 'عارض ومحرر CSV أونلاين',
      intro: 'افتح ملف CSV أو TSV كجدول قابل للبحث، وعدّل الخلايا والصفوف والأعمدة، ثم نزّل النتيجة. ملفك لا يغادر جهازك أبدًا.',
    },
    '/excel-viewer': {
      title: 'عارض ومحرر Excel أونلاين – فتح XLSX وXLS مجانًا',
      description: 'عارض ومحرر Excel مجاني عبر الإنترنت: افتح ملفات XLSX وXLS وXLSM وODS، وعدّل الخلايا والصيغ، وغيّر التنسيقات ثم احفظ المصنف. بدون رفع وبدون تسجيل.',
      heading: 'عارض ومحرر Excel أونلاين (XLSX وXLS وXLSM وODS)',
      intro: 'افتح مصنف Excel بكل أوراقه، وعدّل الخلايا والصيغ التي تُعاد حسابها، واحفظه بالصيغة نفسها. ملفك لا يغادر جهازك أبدًا.',
    },
    '/json-viewer': {
      title: 'عارض ومحرر JSON أونلاين – تنسيق وتعديل JSON',
      description: 'عارض JSON ومنسّقه ومحرره مجانًا عبر الإنترنت: استعرض JSON كشجرة أو جدول أو شيفرة، واعثر على الأخطاء، ورتّب المفاتيح، واضغط الملف ثم نزّله. بدون رفع.',
      heading: 'عارض ومحرر JSON أونلاين',
      intro: 'استعرض JSON كشجرة أو جدول أو شيفرة منسقة، وأصلح الأخطاء بمعرفة السطر والعمود، ثم نسّقه ورتّبه ونزّله. ملفك لا يغادر جهازك أبدًا.',
    },
    '/txt-viewer': {
      title: 'عارض ومحرر الملفات النصية أونلاين (TXT) – OpenAnyDoc',
      description: 'محرر TXT مجاني عبر الإنترنت: بحث واستبدال بالتعابير النمطية، وفرز الأسطر، وحذف المكرر منها، وتغيير حالة الأحرف، وعدّ الكلمات ومقارنة التغييرات. بدون رفع.',
      heading: 'عارض ومحرر الملفات النصية (TXT) أونلاين',
      intro: 'اقرأ الملفات النصية العادية وعدّلها في المتصفح، مع البحث وأرقام الأسطر وأدوات عملية للأسطر والمسافات. ملفك لا يغادر جهازك أبدًا.',
    },
  },
}
