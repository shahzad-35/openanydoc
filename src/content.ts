// Home page copy, keyed by language. The two languages have the same number of entries in the same order. The home FAQ keeps
// eight general questions; how to open each file type is answered on that type's own page.
// Plain data with no runtime imports (the build script reads it). The footer line, paste hint, privacy text and the
// "older files" note live in the translation files (src/i18n).

export type Locale = 'en' | 'ar'

export const features: Record<Locale, string[]> = {
  en: [
    'CSV, Excel (XLSX, XLS, XLSM, ODS), JSON and TXT files open in your browser today; Word, PDF and PowerPoint are coming.',
    'Edit as well as view, with undo and redo, then download the file in its own format.',
    'Large files: a 120,000-row CSV opens in under a second, and files over 50 MB show a warning.',
    'Arabic and right-to-left text is shown correctly (UTF-8, UTF-16 and Windows-1256), and the whole site is in English and Arabic.',
    'Works in a phone browser, in light and dark themes, with keyboard-friendly controls.',
  ],
  ar: [
    'تُفتح ملفات CSV وExcel (XLSX وXLS وXLSM وODS) وJSON وTXT في متصفحك اليوم، وملفات Word وPDF وPowerPoint قادمة.',
    'عرض وتعديل معًا، مع التراجع والإعادة، ثم تنزيل الملف بصيغته نفسها.',
    'الملفات الكبيرة: يُفتح ملف CSV من 120,000 صف في أقل من ثانية، وتظهر رسالة تحذير للملفات الأكبر من 50 ميغابايت.',
    'يُعرض النص العربي من اليمين إلى اليسار بشكل صحيح (UTF-8 وUTF-16 وWindows-1256)، والموقع كله بالعربية والإنجليزية.',
    'يعمل في متصفح الجوال، بمظهر فاتح وآخر داكن، مع عناصر تحكم تعمل بلوحة المفاتيح.',
  ],
}

// One card per tool page on the home page. The link text is the phrase people search for; add a line to add a card.
export const toolCards: Record<Locale, { path: string; linkText: string; text: string }[]> = {
  en: [
    { path: '/csv-viewer', linkText: 'Open CSV files online', text: 'View, search, sort and edit CSV and TSV tables, even large ones, then download the CSV.' },
    { path: '/excel-viewer', linkText: 'Open Excel files online', text: 'View XLSX, XLS, XLSM and ODS workbooks with every sheet, edit cells and formulas, and save.' },
    { path: '/json-viewer', linkText: 'View and format JSON online', text: 'Explore JSON as a tree, validate it, fix errors, then pretty print or minify it.' },
    { path: '/txt-viewer', linkText: 'Open TXT files online', text: 'Read and edit plain text with find and replace, line tools and word counts.' },
  ],
  ar: [
    { path: '/csv-viewer', linkText: 'فتح ملف CSV اون لاين', text: 'اعرض جداول CSV وTSV وابحث فيها ورتّبها وعدّلها، حتى الكبيرة منها، ثم نزّل الملف.' },
    { path: '/excel-viewer', linkText: 'فتح ملف اكسل اون لاين', text: 'اعرض مصنفات XLSX وXLS وXLSM وODS بكل أوراقها، وعدّل الخلايا والصيغ ثم احفظ المصنف.' },
    { path: '/json-viewer', linkText: 'عارض JSON وتنسيقه اون لاين', text: 'استعرض JSON كشجرة، وتحقق منه وأصلح أخطاءه، ثم نسّقه أو صغّره.' },
    { path: '/txt-viewer', linkText: 'فتح ملف TXT اون لاين', text: 'اقرأ النص العادي وعدّله مع البحث والاستبدال وأدوات الأسطر وعدّ الكلمات.' },
  ],
}

export const faqItems: Record<Locale, { question: string; answer: string }[]> = {
  en: [
    {
      question: 'Is OpenAnyDoc really free?',
      answer: 'Yes. Opening, viewing, editing and downloading your files is free, with no account and no sign-up.',
    },
    {
      question: 'Is it safe to open my files online? Are they uploaded?',
      answer: 'Your files are not uploaded. Your browser reads the file and shows it on your screen, so it never leaves your device and there is nothing for us to store, see or lose.',
    },
    {
      question: 'Which file types can I open?',
      answer: 'CSV and tab-separated tables (.csv, .tsv, .tab), plain text (.txt), JSON (.json) and Excel (.xlsx, .xls, .xlsm, .ods). Word (.docx), PDF (.pdf) and PowerPoint (.pptx) are on the way.',
    },
    {
      question: 'Can I edit my file and save the changes?',
      answer:
        'Yes, for CSV, TXT, JSON and Excel files: make your changes, with undo and redo, and download a copy in the same format. The file on your device is never changed and edits are not kept anywhere else, so download before you leave. Excel files keep formulas, number formats and merged cells; charts, images and macros are not kept.',
    },
    {
      question: 'How big can a file be?',
      answer:
        "There is no fixed limit for CSV, TXT and Excel; it depends on your browser's memory. Files over 50 MB show a warning, and OpenAnyDoc still tries to open them. JSON files are the exception: they open up to 10 MB. A 120,000-row CSV file opens in under a second, and a 46 MB text file has been tested.",
    },
    {
      question: 'Does it handle Arabic and other Unicode text?',
      answer:
        'Yes. UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256. Arabic cells display right-to-left.',
    },
    {
      question: 'Does it work on my phone?',
      answer: 'Yes. Every viewer works in a phone browser: the CSV, JSON and TXT pages have their own phone layouts, and the Excel page adapts to a small screen. Big sheets are easier on a larger screen.',
    },
    { question: 'Do I need to install anything or create an account?', answer: 'No. OpenAnyDoc runs in your browser, with no install and no account.' },
  ],
  ar: [
    {
      question: 'هل OpenAnyDoc مجاني فعلًا؟',
      answer: 'نعم. فتح ملفاتك وعرضها وتحريرها وتنزيلها مجاني، بدون حساب وبدون تسجيل.',
    },
    {
      question: 'هل من الآمن فتح ملفاتي اون لاين؟ وهل تُرفع؟',
      answer: 'ملفاتك لا تُرفع. يقرأ متصفحك الملف ويعرضه على شاشتك، فلا يغادر جهازك، ولا يوجد لدينا ما نخزّنه أو نطّلع عليه أو نفقده.',
    },
    {
      question: 'ما أنواع الملفات التي يمكنني فتحها؟',
      answer: 'جداول CSV والجداول المفصولة بعلامة جدولة (.csv و.tsv و.tab)، والنصوص العادية (.txt)، وJSON (.json)، وExcel (.xlsx و.xls و.xlsm و.ods). أما Word (.docx) وPDF (.pdf) وPowerPoint (.pptx) فهي قادمة قريبًا.',
    },
    {
      question: 'هل يمكنني تحرير ملفي وحفظ التغييرات؟',
      answer:
        'نعم، لملفات CSV وTXT وJSON وExcel: أجرِ تغييراتك مع التراجع والإعادة، ثم نزّل نسخة بالصيغة نفسها. الملف الموجود على جهازك لا يتغير أبدًا، والتعديلات لا تُحفظ في مكان آخر، فنزّل نسختك قبل أن تغادر. تحتفظ ملفات Excel بصيغها وتنسيقات الأرقام والخلايا المدمجة؛ أما المخططات والصور وحزم الماكرو فلا تُحفظ.',
    },
    {
      question: 'ما أكبر حجم يمكن فتحه؟',
      answer:
        'لا يوجد حد ثابت لملفات CSV وTXT وExcel؛ فالأمر يعتمد على ذاكرة متصفحك. تظهر رسالة تحذير للملفات التي يزيد حجمها على 50 ميغابايت، ويحاول OpenAnyDoc فتحها مع ذلك. والاستثناء ملفات JSON: تُفتح حتى 10 ميغابايت. يُفتح ملف CSV من 120,000 صف في أقل من ثانية، وقد جُرّب ملف نصي بحجم 46 ميغابايت.',
    },
    {
      question: 'هل يدعم النص العربي ونصوص Unicode الأخرى؟',
      answer:
        'نعم. تُقرأ ملفات UTF-8 (مع BOM أو بدونه) وUTF-16 مباشرة، ويُقرأ الملف الذي ليس UTF-8 صالحًا بترميز Windows-1256. وتُعرض الخلايا العربية من اليمين إلى اليسار.',
    },
    {
      question: 'هل يعمل على الجوال؟',
      answer: 'نعم. كل العارضات تعمل في متصفح الجوال: لصفحات CSV وJSON وTXT تخطيط خاص بالجوال، وتتكيف صفحة Excel مع الشاشة الصغيرة. والأوراق الكبيرة أسهل على شاشة أكبر.',
    },
    { question: 'هل أحتاج إلى تثبيت شيء أو إنشاء حساب؟', answer: 'لا. يعمل OpenAnyDoc في متصفحك، بدون تثبيت وبدون حساب.' },
  ],
}
