// The words search engines and visitors see first for each page: title, description, main heading and the sentence under it.
// Keyed by language ('en', 'ar'), then by page address.
// Plain data with no imports, because scripts/build-static-pages.mjs also reads it to write each page's <head> at build time.
//
// Rules for anything added here (see CLAUDE.md, "Writing for search"): the main phrase a person would type comes first in the
// title and the heading; a title is at most 60 characters and a description 150 to 160; every page has its own; say only what
// the page really does (no format that is not built); the heading is the only h1 of the page.

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
export const X_HANDLE = '@openanydoc'

type Locale = 'en' | 'ar'

// `linkText`: the short, descriptive name that links to a format or landing page use (header nav, footer, related tools).
export type PageSeo = { title: string; description: string; heading: string; intro: string; linkText?: string }

// Keyed by language, then by the page address: '/' for the home page, the format's toolPath for each format page, the path of
// each landing page (landingPages in viewers.ts).
export const pageSeo: Record<Locale, Record<string, PageSeo>> = {
  en: {
    '/': {
      title: 'Free Online File Viewer and Editor, No Upload – OpenAnyDoc',
      description: 'Free online file viewer and editor: open CSV, Excel (XLSX), JSON and TXT files without software and edit them in your browser. Private: no upload, no sign-up.',
      heading: 'Free online file viewer and editor: open any file, upload nothing',
      intro: 'Drop a CSV, Excel, JSON or text file and it opens right here in your browser. A free online file viewer and editor, with no upload and no sign-up.',
    },
    '/csv-viewer': {
      title: 'CSV Viewer Online – Free CSV File Editor, No Upload',
      description: 'CSV viewer online and free CSV editor: open a CSV file online, view large CSV files, search, sort, edit cells and download. Private: nothing is uploaded.',
      heading: 'CSV Viewer Online and CSV Editor',
      intro: 'A free CSV viewer online and CSV editor: open a CSV or TSV file as a searchable table, view large CSV files (a 120,000-row file opens in under a second) and edit CSV in your browser before you download it. Your file never leaves your device.',
      linkText: 'CSV viewer',
    },
    '/excel-viewer': {
      title: 'Excel Viewer Online – Open XLSX Files Without Excel',
      description: 'Excel viewer online: open XLSX, XLS, XLSM and ODS files without Excel, edit Excel online free with formulas that recalculate, and save. No upload, no sign-up.',
      heading: 'Excel Viewer Online: Open and Edit XLSX Files',
      intro: 'A free Excel viewer online: open an XLSX file without Excel, with all its sheets, formats and merged cells, edit cells and formulas, and save the workbook in the same format. XLS, XLSM and ODS files open too, and your file never leaves your device.',
      linkText: 'Excel viewer',
    },
    '/json-viewer': {
      title: 'JSON Viewer Online – Formatter, Validator & Tree View',
      description: 'JSON viewer online: a free JSON formatter, validator and tree viewer. Pretty print or minify JSON, fix errors by line and column, then download. No upload.',
      heading: 'JSON Viewer Online, Formatter and Editor',
      intro: 'A free JSON viewer online: open a JSON file or paste JSON, explore it as a tree, a table or formatted code, validate it and fix errors by line and column, then pretty print and download it. Your JSON never leaves your device.',
      linkText: 'JSON viewer',
    },
    '/txt-viewer': {
      title: 'Open TXT File Online – Free Text Editor, No Upload',
      description: 'Open TXT file online and edit it free: a text file viewer and online text editor with find and replace, sort lines, remove duplicates and word count. No upload.',
      heading: 'Open TXT File Online: Free Text Viewer and Editor',
      intro: 'Open TXT file online in your browser and read or edit it like a notepad online: search, line numbers, and tools for lines, whitespace and case, with Arabic text shown right to left. Your file never leaves your device.',
      linkText: 'TXT editor',
    },
    '/json-formatter': {
      title: 'JSON Formatter Online – Beautify and Pretty Print JSON',
      description: 'JSON formatter online: beautify and pretty print JSON with 1, 2, 3, 4 or 8 spaces or a tab, minify it to one line or sort its keys. Free, nothing uploaded.',
      heading: 'JSON Formatter Online: Beautify and Minify JSON',
      intro: 'A free JSON formatter online: paste JSON or open a .json file, press Format to pretty print it with the indentation you choose, or Minify to put it on one line. The JSON beautifier keeps long numbers exactly and runs in your browser, so nothing is uploaded.',
      linkText: 'JSON formatter',
    },
    '/json-validator': {
      title: 'JSON Validator Online – Find and Fix JSON Syntax Errors',
      description: 'JSON validator online: check JSON syntax, see the line and column of an error, jump to it and repair trailing commas, comments and quotes. Free, no upload.',
      heading: 'JSON Validator Online: Check and Fix JSON',
      intro: 'A free JSON validator online: paste JSON or open a .json file and press Validate. If the JSON is not valid, you see what is wrong with its line and column, Go to error selects the spot, and Repair fixes the usual mistakes. Your JSON is checked in your browser and never uploaded.',
      linkText: 'JSON validator',
    },
    '/tsv-viewer': {
      title: 'TSV Viewer Online – Open TSV Files as a Table, No Upload',
      description: 'TSV viewer online: open a TSV or .tab file as a table, with tabs read as columns and the header row detected. Search, sort, edit and save it as TSV. No upload.',
      heading: 'TSV Viewer Online: Open Tab-Separated Files',
      intro: 'A free TSV viewer online: open a TSV file online and read its tab-separated values as a table, with the header row detected for you. Search, filter, sort and edit the cells, then download it as TSV again. The file is read in your browser and never uploaded.',
      linkText: 'TSV viewer',
    },
    '/large-csv-viewer': {
      title: 'Large CSV File Viewer – Open Big CSV Files Online, Free',
      description: 'Large CSV file viewer: open big CSV files in your browser with no row limit of its own. 120,000 rows opened in 0.9 s in our tests. Search and sort. No upload.',
      heading: 'Large CSV File Viewer: Open Big CSV Files Fast',
      intro: 'A free large CSV file viewer: view large CSV files in your browser, with no row limit of its own and only the rows on screen drawn. In our tests a 120,000-row file opened in 0.9 s, and sorting it by two columns took 0.9 s. Nothing is uploaded, so big exports stay on your device.',
      linkText: 'Large CSV file viewer',
    },
    '/xls-viewer': {
      title: 'XLS Viewer Online – Open Old Excel 97-2003 Files, No Upload',
      description: 'XLS viewer online: open old Excel 97-2003 .xls files without Excel, see every sheet, edit cells and formulas, and save as .xls. Free and private, no upload.',
      heading: 'XLS Viewer Online: Open Excel 97-2003 Files',
      intro: 'A free XLS viewer online: open an XLS file online, the older Excel 97-2003 format, without Excel and without an account. See every sheet with its values, formulas, number formats and merged cells, edit it and save it as .xls again. Fonts and colours are not shown for .xls files.',
      linkText: 'XLS viewer',
    },
    '/excel-to-csv': {
      title: 'Excel to CSV Converter Online – Free XLSX to CSV, No Upload',
      description: 'Excel to CSV converter online: drop an XLSX, XLS or ODS file and its first sheet opens as a UTF-8 CSV that keeps Arabic text, ready to edit. Free, no upload.',
      heading: 'Excel to CSV Converter Online',
      intro: 'Convert Excel to CSV in your browser: drop an XLSX, XLS or ODS file and its first sheet opens as a CSV in the CSV viewer, where you can edit it, pick another delimiter and download it. Arabic text gets the UTF-8 marker Excel needs. Your file never leaves your device.',
      linkText: 'Excel to CSV',
    },
    '/csv-to-excel': {
      title: 'CSV to Excel Converter Online – Make an XLSX File, Free',
      description: 'CSV to Excel converter online: drop a CSV or TSV file and it opens as an XLSX workbook with a bold header row and columns sized to fit, ready to edit. Private.',
      heading: 'CSV to Excel Converter: Make an XLSX File',
      intro: 'Convert CSV to Excel in your browser: drop a CSV or TSV file and it opens as an .xlsx workbook in the Excel viewer, with a bold header row and each column as wide as its text. Codes with leading zeros stay text. Edit it, then download. Your file never leaves your device.',
      linkText: 'CSV to Excel',
    },
    '/excel-to-json': {
      title: 'Excel to JSON Converter Online – XLSX to JSON Array, Free',
      description: 'Excel to JSON converter online: drop an XLSX, XLS or ODS file and its first sheet opens as a JSON array of objects keyed by the header row. Free, no upload.',
      heading: 'Excel to JSON Converter Online',
      intro: 'Convert Excel to JSON in your browser: drop a workbook and its first sheet opens in the JSON viewer as an array of objects, one per row, with the header row as keys. Numbers stay numbers and dates become ISO text. Format, copy or download it there. Nothing is uploaded.',
      linkText: 'Excel to JSON',
    },
    '/csv-to-json': {
      title: 'CSV to JSON Converter Online – Free, Private, No Upload',
      description: 'CSV to JSON converter online: drop a CSV file and it opens as a JSON array of objects keyed by the header row, ready to format, copy or download. No upload.',
      heading: 'CSV to JSON Converter Online',
      intro: 'Convert CSV to JSON in your browser: drop or paste a CSV or TSV file and it opens in the JSON viewer as an array of objects, one per row, with the header row as keys. The delimiter and encoding are detected for you. Your file never leaves your device.',
      linkText: 'CSV to JSON',
    },
    '/json-to-csv': {
      title: 'JSON to CSV Converter Online – Flatten Nested JSON, Free',
      description: 'JSON to CSV converter online: turn a JSON array of objects into a CSV table, with nested objects flattened into dot-notation columns like address.city. Private.',
      heading: 'JSON to CSV Converter: Flatten JSON to a Table',
      intro: 'Convert JSON to CSV in your browser: drop or paste a JSON array of objects and it opens in the CSV viewer with one row per object. Nested objects become columns such as address.city, and lists become items.0, items.1. Edit, filter and download it there. Nothing is uploaded.',
      linkText: 'JSON to CSV',
    },
    '/about': {
      title: 'About OpenAnyDoc – Private Online File Viewer',
      description: 'About OpenAnyDoc, built and run by Shahzad Ali: a free file viewer and editor that runs in your browser and never uploads files. CSV, Excel, JSON and TXT today.',
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
    '/guides': {
      title: 'Guides: Fix CSV, Excel and JSON File Problems',
      description: 'Short, practical guides to the problems people hit with CSV, Excel and JSON files: broken Arabic, one-column CSVs, files too big for Excel, JSON syntax errors.',
      heading: 'Guides',
      intro: 'Practical answers to common file problems, each with the free tool that fixes it in your browser.',
      linkText: 'Guides',
    },
  },
  ar: {
    '/': {
      title: 'عارض ملفات اون لاين مجاني – فتح الملفات بدون برامج',
      description: 'عارض ملفات اون لاين مجاني: افتح ملفات CSV وExcel وJSON وTXT وعدّلها في متصفحك. فتح الملفات بدون برامج وبدون تسجيل، وملفاتك لا تُرفع ولا تغادر جهازك أبدًا.',
      heading: 'عارض ومحرر ملفات اون لاين مجاني: افتح أي ملف بدون رفع',
      intro: 'أفلِت ملف CSV أو Excel أو JSON أو ملفًا نصيًا وسيُفتح هنا في متصفحك مباشرة. عارض ملفات اون لاين مجاني ومحرر للملفات، بدون رفع وبدون تسجيل.',
    },
    '/csv-viewer': {
      title: 'عارض CSV اون لاين – فتح ملف CSV وتعديله مجانًا بدون رفع',
      description: 'عارض CSV اون لاين مجاني: فتح ملف CSV كجدول، والبحث والفرز وتعديل الخلايا مع عرض صحيح للحروف العربية، ثم التنزيل. تعديل ملف CSV اون لاين بدون رفع أي ملف.',
      heading: 'عارض CSV اون لاين ومحرر مجاني',
      intro: 'عارض CSV اون لاين مجاني: افتح ملف CSV كجدول تبحث فيه وتفرزه، حتى الملفات الكبيرة (يُفتح ملف من 120,000 صف في أقل من ثانية)، وتظهر الحروف العربية سليمة حتى في ملفات Windows-1256 القديمة. عدّل الخلايا ثم نزّل الملف، وملفك لا يغادر جهازك.',
      linkText: 'عارض CSV',
    },
    '/excel-viewer': {
      title: 'فتح ملف اكسل اون لاين – عارض ملفات XLSX مجاني بدون برامج',
      description: 'فتح ملف اكسل اون لاين مجانًا: عارض ملفات XLSX وXLS وXLSM وODS، مع تعديل الخلايا والصيغ التي تُعاد حسابها ثم الحفظ. فتح ملف اكسل بدون برنامج وبدون رفع.',
      heading: 'فتح ملف اكسل اون لاين وتعديله بدون برنامج',
      intro: 'فتح ملف اكسل اون لاين بكل أوراقه، بدون برنامج Excel وبدون تسجيل: عارض ملفات XLSX وXLS وXLSM وODS يعرض التنسيقات والخلايا المدمجة، وتعدّل فيه الخلايا والصيغ ثم تحفظ المصنف بصيغته نفسها. ملفك لا يغادر جهازك.',
      linkText: 'عارض Excel',
    },
    '/json-viewer': {
      title: 'عارض JSON اون لاين – تنسيق JSON وعرض شجري بدون رفع',
      description: 'عارض JSON مجاني: فتح ملف JSON أو لصقه، وتنسيق JSON اون لاين والتحقق منه، وعرضه كشجرة أو جدول، وإصلاح الأخطاء بالسطر والعمود ثم تنزيله. بدون رفع أي ملف.',
      heading: 'عارض JSON اون لاين ومنسق ومحرر',
      intro: 'عارض JSON مجاني يعمل في متصفحك: افتح ملف JSON أو الصقه، واستعرضه كشجرة أو جدول أو شيفرة منسقة، وتحقق منه وأصلح أخطاءه بمعرفة السطر والعمود، ثم نسّقه ونزّله. تنسيق JSON اون لاين دون أن يغادر ملفك جهازك.',
      linkText: 'عارض JSON',
    },
    '/txt-viewer': {
      title: 'فتح ملف TXT اون لاين – محرر نصوص مجاني بدون رفع أو تسجيل',
      description: 'فتح ملف TXT اون لاين وتعديله مجانًا: محرر نصوص اون لاين فيه بحث واستبدال، وفرز الأسطر وحذف المكرر منها، وتغيير حالة الأحرف وعدّ الكلمات. ملفك لا يُرفع أبدًا.',
      heading: 'فتح ملف TXT اون لاين: عارض ومحرر نصوص مجاني',
      intro: 'فتح ملف TXT اون لاين وقراءته وتعديله في متصفحك: محرر نصوص اون لاين مع البحث وأرقام الأسطر وأدوات للأسطر والمسافات وحالة الأحرف، ويعرض النص العربي من اليمين إلى اليسار. ملفك لا يغادر جهازك.',
      linkText: 'محرر TXT',
    },
    '/json-formatter': {
      title: 'تنسيق JSON اون لاين – تجميل JSON وتصغيره مجانًا بدون رفع',
      description: 'تنسيق JSON اون لاين مجانًا: اجعل JSON مقروءًا بمسافة بادئة من 1 أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة، أو صغّره في سطر واحد ورتّب مفاتيحه. بدون رفع أي ملف.',
      heading: 'تنسيق JSON اون لاين: تجميل JSON وتصغيره',
      intro: 'أداة مجانية لتنسيق JSON اون لاين: الصق JSON أو افتح ملف .json، ثم اضغط «تنسيق» لعرضه مرتبًا بالمسافة البادئة التي تختارها، أو «تصغير» لجعله في سطر واحد. تحافظ الأداة على الأرقام الطويلة كما هي، وتعمل في متصفحك فلا يُرفع شيء.',
      linkText: 'تنسيق JSON',
    },
    '/json-validator': {
      title: 'التحقق من JSON اون لاين – اكتشاف أخطاء JSON وإصلاحها',
      description: 'التحقق من JSON اون لاين مجانًا: افحص صياغة JSON واعرف سطر الخطأ وعموده وانتقل إليه، وأصلح الفواصل الزائدة والتعليقات وعلامات الاقتباس. لا يُرفع أي ملف أبدًا.',
      heading: 'التحقق من JSON اون لاين وإصلاح أخطائه',
      intro: 'أداة مجانية للتحقق من JSON اون لاين: الصق JSON أو افتح ملف .json واضغط «تحقّق». إذا لم يكن JSON صالحًا، ترى سبب الخطأ مع رقم السطر والعمود، ويحدد زر «انتقل إلى الخطأ» موضعه، ويصلح زر «إصلاح» الأخطاء المعتادة. يُفحص JSON في متصفحك ولا يُرفع أبدًا.',
      linkText: 'التحقق من JSON',
    },
    '/tsv-viewer': {
      title: 'فتح ملف TSV اون لاين – عارض TSV مجاني كجدول بدون رفع',
      description: 'فتح ملف TSV اون لاين مجانًا: اعرض ملف TSV أو .tab كجدول تُقرأ فيه علامات الجدولة كأعمدة ويُكتشف صف العناوين، ثم ابحث ورتّب وعدّل ونزّله TSV. بدون رفع.',
      heading: 'فتح ملف TSV اون لاين وعرضه كجدول',
      intro: 'فتح ملف TSV اون لاين مجانًا: تُقرأ القيم المفصولة بعلامات الجدولة كجدول، ويُكتشف صف العناوين تلقائيًا. ابحث في الخلايا وصفِّها ورتّبها وعدّلها، ثم نزّل الملف بصيغة TSV من جديد. يُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
      linkText: 'عارض TSV',
    },
    '/large-csv-viewer': {
      title: 'عارض ملفات CSV الكبيرة – فتح ملف CSV كبير بسرعة اون لاين',
      description: 'عارض ملفات CSV الكبيرة مجانًا: افتح ملف CSV كبيرًا في متصفحك بلا حد للصفوف من عنده؛ فُتح ملف من 120,000 صف في 0.9 ثانية في اختباراتنا. بدون رفع أي ملف.',
      heading: 'عارض ملفات CSV الكبيرة: افتح الملفات الضخمة بسرعة',
      intro: 'عارض ملفات CSV الكبيرة مجاني يعمل في متصفحك: لا حد لعدد الصفوف من عنده، ولا يرسم إلا الصفوف الظاهرة على الشاشة. في اختباراتنا فُتح ملف من 120,000 صف في 0.9 ثانية، واستغرق ترتيبه حسب عمودين 0.9 ثانية. لا يُرفع شيء، فتبقى ملفات التصدير الكبيرة على جهازك.',
      linkText: 'عارض ملفات CSV الكبيرة',
    },
    '/xls-viewer': {
      title: 'فتح ملف XLS اون لاين – عارض ملفات Excel 97-2003 مجاني',
      description: 'فتح ملف XLS اون لاين مجانًا: اعرض ملفات Excel 97-2003 القديمة بدون برنامج Excel، بكل أوراقها، وعدّل الخلايا والصيغ واحفظها بصيغة .xls. بدون رفع وبدون تسجيل.',
      heading: 'فتح ملف XLS اون لاين بدون برنامج Excel',
      intro: 'فتح ملف XLS اون لاين مجانًا، وهي صيغة Excel 97-2003 القديمة، بدون برنامج Excel وبدون حساب. تظهر كل الأوراق بقيمها وصيغها وتنسيقات أرقامها وخلاياها المدمجة، وتعدّلها ثم تحفظها بصيغة .xls من جديد. لا تظهر الخطوط والألوان في ملفات .xls.',
      linkText: 'عارض XLS',
    },
    '/excel-to-csv': {
      title: 'تحويل Excel إلى CSV اون لاين – مجانًا وبدون رفع الملف',
      description: 'تحويل Excel إلى CSV اون لاين مجانًا: أفلت ملف XLSX أو XLS أو ODS فتُفتح ورقته الأولى ملفَّ CSV بترميز UTF-8 يحافظ على النص العربي، جاهزًا للتعديل. بدون رفع.',
      heading: 'تحويل Excel إلى CSV اون لاين',
      intro: 'حوّل ملف Excel إلى CSV في متصفحك: أفلت ملف XLSX أو XLS أو ODS فتُفتح ورقته الأولى ملفَّ CSV في عارض CSV، حيث تعدّله وتختار فاصلًا آخر وتنزّله. ويحصل النص العربي على علامة UTF-8 التي يحتاجها Excel. ملفك لا يغادر جهازك.',
      linkText: 'تحويل Excel إلى CSV',
    },
    '/csv-to-excel': {
      title: 'تحويل CSV إلى Excel اون لاين – إنشاء ملف XLSX مجانًا',
      description: 'تحويل CSV إلى Excel اون لاين مجانًا: أفلت ملف CSV أو TSV فيُفتح مصنف XLSX بصف عناوين عريض وأعمدة بعرض محتواها، جاهزًا للتعديل. خاص تمامًا، بدون رفع أي ملف.',
      heading: 'تحويل CSV إلى Excel: أنشئ ملف XLSX',
      intro: 'حوّل ملف CSV إلى Excel في متصفحك: أفلت ملف CSV أو TSV فيُفتح مصنف .xlsx في عارض Excel، بصف عناوين عريض وكل عمود بعرض نصه. تبقى الأرقام التي تبدأ بصفر نصًا كما هي. عدّله ثم نزّله. ملفك لا يغادر جهازك.',
      linkText: 'تحويل CSV إلى Excel',
    },
    '/excel-to-json': {
      title: 'تحويل Excel إلى JSON اون لاين – من XLSX إلى JSON مجانًا',
      description: 'تحويل Excel إلى JSON اون لاين مجانًا: أفلت ملف XLSX أو XLS أو ODS فتُفتح ورقته الأولى مصفوفة كائنات JSON مفاتيحها صف العناوين. بدون رفع أي ملف إلى أي خادم.',
      heading: 'تحويل Excel إلى JSON اون لاين',
      intro: 'حوّل ملف Excel إلى JSON في متصفحك: أفلت المصنف فتُفتح ورقته الأولى في عارض JSON مصفوفة كائنات، كائن لكل صف، ومفاتيحها من صف العناوين. تبقى الأرقام أرقامًا وتصبح التواريخ نصًا بصيغة ISO. نسّقه أو انسخه أو نزّله هناك. لا يُرفع شيء.',
      linkText: 'تحويل Excel إلى JSON',
    },
    '/csv-to-json': {
      title: 'تحويل CSV إلى JSON اون لاين – مجاني وخاص وبدون رفع',
      description: 'تحويل CSV إلى JSON اون لاين مجانًا: أفلت ملف CSV فيُفتح مصفوفة كائنات JSON مفاتيحها صف العناوين، جاهزًا للتنسيق والنسخ والتنزيل. لا يُرفع أي ملف أبدًا.',
      heading: 'تحويل CSV إلى JSON اون لاين',
      intro: 'حوّل ملف CSV إلى JSON في متصفحك: أفلت ملف CSV أو TSV أو الصقه فيُفتح في عارض JSON مصفوفة كائنات، كائن لكل صف، ومفاتيحها من صف العناوين. يُكتشف الفاصل والترميز تلقائيًا. ملفك لا يغادر جهازك.',
      linkText: 'تحويل CSV إلى JSON',
    },
    '/json-to-csv': {
      title: 'تحويل JSON إلى CSV اون لاين – تسطيح JSON المتداخل مجانًا',
      description: 'تحويل JSON إلى CSV اون لاين مجانًا: حوّل مصفوفة كائنات JSON إلى جدول CSV، وتصبح الكائنات المتداخلة أعمدة بأسماء نقطية مثل address.city. بدون رفع أي ملف.',
      heading: 'تحويل JSON إلى CSV: من JSON إلى جدول',
      intro: 'حوّل JSON إلى CSV في متصفحك: أفلت أو الصق مصفوفة كائنات JSON فتُفتح في عارض CSV بصف لكل كائن. تصبح الكائنات المتداخلة أعمدة مثل address.city، والقوائم أعمدة مثل items.0 وitems.1. عدّله وصفِّه ونزّله هناك. لا يُرفع شيء.',
      linkText: 'تحويل JSON إلى CSV',
    },
    '/about': {
      title: 'عن OpenAnyDoc – عارض ملفات خاص اون لاين',
      description: 'عن OpenAnyDoc الذي يبنيه ويديره شهزاد علي: عارض ومحرر ملفات مجاني يعمل في متصفحك ولا يرفع ملفاتك أبدًا. يدعم اليوم CSV وExcel وJSON وTXT، وقريبًا Word وPDF.',
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
    '/guides': {
      title: 'أدلة: حل مشكلات ملفات CSV وExcel وJSON',
      description: 'أدلة قصيرة وعملية للمشكلات التي يصطدم بها الناس مع ملفات CSV وExcel وJSON: العربية المشوّهة، وملف CSV في عمود واحد، وملف أكبر من Excel، وأخطاء صياغة JSON.',
      heading: 'الأدلة',
      intro: 'إجابات عملية لمشكلات الملفات الشائعة، مع الأداة المجانية التي تحلها في متصفحك.',
      linkText: 'الأدلة',
    },
  },
}

// The Open Graph name of each language (og:locale and og:locale:alternate).
export const openGraphLocales: Record<Locale, string> = { en: 'en_US', ar: 'ar_AR' }

// The pages with a share picture of their own, format, landing and guide pages (public/og/, 1200 x 630, made by scripts/generate-og-images.mjs); every other page
// (About, Privacy, Terms, the changelog) shows the home page's picture in its language.
export const pagesWithShareImage = ['/', '/csv-viewer', '/excel-viewer', '/json-viewer', '/txt-viewer', '/json-formatter', '/json-validator', '/tsv-viewer', '/large-csv-viewer', '/xls-viewer', '/excel-to-csv', '/csv-to-excel', '/excel-to-json', '/csv-to-json', '/json-to-csv', '/fix-arabic-csv-in-excel', '/csv-opens-in-one-column', '/csv-too-big-for-excel', '/json-unexpected-token']

export function getShareImage(locale: Locale, address: string) {
  const imageAddress = pagesWithShareImage.includes(address) ? address : '/'
  return {
    path: `/og/${locale}-${imageAddress === '/' ? 'home' : imageAddress.slice(1)}.png`,
    alt: `${SITE_NAME}: ${pageSeo[locale][imageAddress].heading}`,
  }
}
