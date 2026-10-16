// Home page copy, keyed by language. The two languages have the same number of entries in the same order.
// Plain data with no runtime imports (the build script reads it). The footer line, paste hint, privacy text and the
// "older files" note live in the translation files (src/i18n).

export type Locale = 'en' | 'ar'

export const features: Record<Locale, string[]> = {
  en: [
    'One free online viewer and editor for CSV, Excel (XLSX, XLS, XLSM, ODS), JSON and TXT files, with Word, PDF and PowerPoint coming.',
    'Private by design: files are read in your browser and never uploaded, so there is no account and nothing to install.',
    'Drag and drop a file, click to browse, or paste CSV text.',
    'CSV and TSV viewer: automatic delimiter detection (comma, semicolon, tab, pipe), a first-row-is-header toggle, search, filters for each column, sorting by several columns, and a profile of each column.',
    'CSV editor: change cells, paste ranges, add or delete rows and columns, move and rename columns, find and replace, and clean up a column or the whole table (case, spaces, empty rows, duplicate rows, split, merge, transpose), with undo and redo.',
    'Handles large CSV files smoothly, because only the visible rows are drawn, even while you edit.',
    'Excel viewer and editor: open XLSX, XLS, XLSM and ODS workbooks with sheet tabs, formatted dates, percentages and currencies, merged cells and cell styles.',
    'Edit Excel cells and formulas that recalculate as you type, insert or delete rows, columns and sheets, add links, change number and date formats and, in XLSX files, fonts, borders, colours and alignment, then save the workbook in its own format.',
    'JSON viewer, validator and editor: paste, type or open JSON and see the text next to a collapsible tree (or a table for a list of objects) with an inspector, search, a path query, size and depth stats, and errors with the line and column.',
    'Edit JSON: repair hand-written mistakes (comments, trailing commas, single quotes, unquoted keys), change, add, duplicate, move or delete nodes, sort keys, choose 1 to 8 spaces, a tab or minified, and find and replace in the text. Long numbers are kept exactly, and large files are read in the background.',
    'Text file (TXT) viewer and editor: line numbers, search, font and size choices, change case, tidy spaces, sort, reverse and de-duplicate lines, choose LF or CRLF line endings and find and replace.',
    'Download what you see (your edits, the current sort and only the rows your search shows) in the file\'s own format.',
    'Reads UTF-8 (with or without a BOM), UTF-16 and Arabic text correctly, and shows Arabic cells right-to-left.',
    'Files over 50 MB show a warning, and OpenAnyDoc still tries to open them. JSON files open up to 10 MB.',
    'Light and dark themes and keyboard-friendly controls.',
  ],
  ar: [
      'عارض ومحرر مجاني عبر الإنترنت لملفات CSV وExcel (XLSX وXLS وXLSM وODS) وJSON وTXT، وقريبًا Word وPDF وPowerPoint.',
      'خصوصية بالتصميم: تُقرأ الملفات داخل متصفحك ولا تُرفع أبدًا، فلا حاجة إلى حساب ولا إلى تثبيت أي برنامج.',
      'اسحب الملف وأفلته، أو انقر لاختياره، أو الصق نص CSV.',
      'عارض CSV وTSV: اكتشاف تلقائي للفاصل (فاصلة، فاصلة منقوطة، علامة جدولة، شرطة عمودية)، وخيار «الصف الأول عناوين»، والبحث، وتصفية كل عمود، والترتيب حسب عدة أعمدة، وملخص لكل عمود.',
      'محرر CSV: عدّل الخلايا، والصق نطاقات، وأضف الصفوف والأعمدة أو احذفها، وانقل الأعمدة وأعد تسميتها، واستخدم البحث والاستبدال، ونظّف عمودًا أو الجدول كله (حالة الأحرف، المسافات، الصفوف الفارغة، الصفوف المكررة، التقسيم، الدمج، تبديل الصفوف والأعمدة)، مع التراجع والإعادة.',
      'يتعامل بسلاسة مع ملفات CSV الكبيرة، لأن الصفوف الظاهرة فقط هي التي تُرسم، حتى أثناء التحرير.',
      'عارض ومحرر Excel: افتح مصنفات XLSX وXLS وXLSM وODS مع تبويبات الأوراق، والتواريخ والنسب المئوية والعملات بتنسيقها، والخلايا المدمجة وأنماط الخلايا.',
      'عدّل خلايا Excel والصيغ التي تُعاد حسابها أثناء الكتابة، وأدرج الصفوف والأعمدة والأوراق أو احذفها، وأضف الروابط، وغيّر تنسيقات الأرقام والتواريخ، وفي ملفات XLSX غيّر الخطوط والحدود والألوان والمحاذاة، ثم احفظ المصنف بصيغته الأصلية.',
      'عارض JSON ومدقّقه ومحرره: الصق JSON أو اكتبه أو افتحه، وشاهد النص بجانب شجرة قابلة للطي (أو جدول لقائمة من الكائنات) مع لوحة تفاصيل وبحث واستعلام مسار وإحصاءات الحجم والعمق، ورسائل خطأ تذكر السطر والعمود.',
      'تحرير JSON: أصلح أخطاء الكتابة اليدوية (التعليقات والفواصل الزائدة وعلامات الاقتباس المفردة والمفاتيح غير المقتبسة)، وغيّر العقد وأضفها وكرّرها وانقلها واحذفها، ورتّب المفاتيح، واختر من مسافة إلى 8 مسافات أو علامة جدولة أو التصغير، وابحث في النص واستبدل. تُحفظ الأرقام الطويلة كما هي، وتُقرأ الملفات الكبيرة في الخلفية.',
      'عارض ومحرر الملفات النصية (TXT): أرقام الأسطر، والبحث، واختيار الخط وحجمه، وتغيير حالة الأحرف، وترتيب المسافات، وفرز الأسطر وعكسها وحذف المكرر منها، واختيار نهايات الأسطر LF أو CRLF، والبحث والاستبدال.',
      'نزّل ما تراه (تعديلاتك، والفرز الحالي، والصفوف التي يعرضها البحث فقط) بصيغة الملف نفسها.',
      'يقرأ ترميز UTF-8 (مع BOM أو بدونه) وUTF-16 والنصوص العربية قراءة صحيحة، ويعرض الخلايا العربية من اليمين إلى اليسار.',
      'تظهر رسالة تحذير للملفات التي يزيد حجمها على 50 ميغابايت، ويحاول OpenAnyDoc فتحها مع ذلك. وتُفتح ملفات JSON حتى 10 ميغابايت.',
      'مظهر فاتح ومظهر داكن، وعناصر تحكم تعمل بلوحة المفاتيح.',
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
      question: 'How do I open a CSV file online?',
      answer: 'Choose or drop your .csv, .tsv or .tab file on the CSV viewer. It opens as a table you can search, filter, sort and edit, with the delimiter detected automatically. Change cells, rows and columns, then download the result.',
    },
    {
      question: 'How do I open and edit an Excel (XLSX) file online for free?',
      answer: 'Choose or drop an .xlsx, .xls, .xlsm or .ods file on the Excel viewer. Use the sheet tabs to move between sheets, switch to Edit to change cells and formulas (formulas recalculate as you edit), then save the workbook in its own format.',
    },
    {
      question: 'How do I view and format a JSON file online?',
      answer: 'Open or paste your JSON on the JSON viewer. See the text next to a tree (or a table), validate it and see the line and column of any error, repair common mistakes, then format it with 1 to 8 spaces or a tab, minify it, sort the keys and download it.',
    },
    {
      question: 'Which file types can I open?',
      answer: 'CSV and tab-separated tables (.csv, .tsv, .tab), plain text (.txt), JSON (.json) and Excel (.xlsx, .xls, .xlsm, .ods). Word (.docx), PDF (.pdf) and PowerPoint (.pptx) are on the way.',
    },
    {
      question: 'Can I edit my file and save the changes?',
      answer:
        'Yes, for CSV, TXT, JSON and Excel files: switch to Edit (CSV and JSON open ready to edit), make your changes, with undo and redo, and download a copy. The file on your device is never changed, and your edits are not saved anywhere else, so download a copy before you leave. Excel files keep their formulas, number formats and merged cells, and .xlsx files keep their bold, colours and borders; charts, images and macros are not kept, and styles are not kept in .xls, .ods and .xlsm files or in very large workbooks. Word, PDF and PowerPoint cannot be edited yet.',
    },
    {
      question: 'Which CSV delimiters are supported?',
      answer: 'Comma, semicolon, tab and pipe. .csv files are detected automatically, .tsv and .tab files open tab-separated, and you can choose a delimiter yourself.',
    },
    {
      question: 'Does it handle Arabic and other Unicode text?',
      answer:
        'Yes. UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256. Arabic cells display right-to-left.',
    },
    {
      question: 'How big can a file be?',
      answer:
        "There is no fixed limit for CSV, TXT and Excel; it depends on your browser's memory. Files over 50 MB show a warning, and OpenAnyDoc still tries to open them. JSON files are the exception: they open up to 10 MB. A CSV file with 100,000 rows opens in under a second.",
    },
    { question: 'Do I need to install anything or create an account?', answer: 'No. OpenAnyDoc runs in your browser, with no install and no account.' },
    {
      question: 'What happens to my file when I close the tab?',
      answer: "Nothing is kept. The file is only held in your browser's memory while the page is open.",
    },
  ],
  ar: [
    {
      question: 'هل OpenAnyDoc مجاني فعلًا؟',
      answer: 'نعم. فتح ملفاتك وعرضها وتحريرها وتنزيلها مجاني، بدون حساب وبدون تسجيل.',
    },
    {
      question: 'هل من الآمن فتح ملفاتي عبر الإنترنت؟ وهل تُرفع؟',
      answer: 'ملفاتك لا تُرفع. يقرأ متصفحك الملف ويعرضه على شاشتك، فلا يغادر جهازك، ولا يوجد لدينا ما نخزّنه أو نطّلع عليه أو نفقده.',
    },
    {
      question: 'كيف أفتح ملف CSV أونلاين؟',
      answer: 'اختر ملف .csv أو .tsv أو .tab أو أفلته على عارض CSV. يُفتح كجدول يمكنك البحث فيه وتصفيته وترتيبه وتحريره، مع اكتشاف الفاصل تلقائيًا. عدّل الخلايا والصفوف والأعمدة، ثم نزّل النتيجة.',
    },
    {
      question: 'كيف أفتح ملف Excel (XLSX) وأعدّله أونلاين مجانًا؟',
      answer: 'اختر ملف .xlsx أو .xls أو .xlsm أو .ods أو أفلته على عارض Excel. استخدم تبويبات الأوراق للتنقل بين الأوراق، وانتقل إلى التحرير لتعديل الخلايا والصيغ (تُعاد حساب الصيغ أثناء التعديل)، ثم احفظ المصنف بصيغته الأصلية.',
    },
    {
      question: 'كيف أعرض ملف JSON وأنسّقه أونلاين؟',
      answer: 'افتح JSON أو الصقه على عارض JSON. شاهد النص بجانب شجرة (أو جدول)، وتحقّق منه وانظر سطر أي خطأ وعموده، وأصلح الأخطاء الشائعة، ثم نسّقه بمسافة إلى 8 مسافات أو علامة جدولة، أو صغّره، أو رتّب المفاتيح، ثم نزّله.',
    },
    {
      question: 'ما أنواع الملفات التي يمكنني فتحها؟',
      answer: 'جداول CSV والجداول المفصولة بعلامة جدولة (.csv و.tsv و.tab)، والنصوص العادية (.txt)، وJSON (.json)، وExcel (.xlsx و.xls و.xlsm و.ods). أما Word (.docx) وPDF (.pdf) وPowerPoint (.pptx) فهي قادمة قريبًا.',
    },
    {
      question: 'هل يمكنني تحرير ملفي وحفظ التغييرات؟',
      answer:
        'نعم، لملفات CSV وTXT وJSON وExcel: انتقل إلى التحرير (يُفتح CSV وJSON جاهزين للتحرير)، وأجرِ تغييراتك مع التراجع والإعادة، ثم نزّل نسخة. الملف الموجود على جهازك لا يتغير أبدًا، وتعديلاتك لا تُحفظ في أي مكان آخر، لذا نزّل نسخة قبل أن تغادر. تحتفظ ملفات Excel بصيغها وتنسيقات الأرقام والخلايا المدمجة، وتحتفظ ملفات .xlsx بالخط الغامق والألوان والحدود؛ أما المخططات والصور وحزم الماكرو فلا تُحفظ، ولا تُحفظ الأنماط في ملفات .xls و.ods و.xlsm ولا في المصنفات الكبيرة جدًا. لا يمكن تحرير Word وPDF وPowerPoint بعد.',
    },
    {
      question: 'ما الفواصل المدعومة في ملفات CSV؟',
      answer: 'الفاصلة، والفاصلة المنقوطة، وعلامة الجدولة، والشرطة العمودية. تُكتشف ملفات .csv تلقائيًا، وتُفتح ملفات .tsv و.tab مفصولة بعلامة جدولة، ويمكنك اختيار الفاصل بنفسك.',
    },
    {
      question: 'هل يدعم النص العربي ونصوص Unicode الأخرى؟',
      answer:
        'نعم. تُقرأ ملفات UTF-8 (مع BOM أو بدونه) وUTF-16 مباشرة، ويُقرأ الملف الذي ليس UTF-8 صالحًا بترميز Windows-1256. وتُعرض الخلايا العربية من اليمين إلى اليسار.',
    },
    {
      question: 'ما أكبر حجم يمكن فتحه؟',
      answer:
        'لا يوجد حد ثابت لملفات CSV وTXT وExcel؛ فالأمر يعتمد على ذاكرة متصفحك. تظهر رسالة تحذير للملفات التي يزيد حجمها على 50 ميغابايت، ويحاول OpenAnyDoc فتحها مع ذلك. والاستثناء ملفات JSON: تُفتح حتى 10 ميغابايت. يُفتح ملف CSV بـ 100,000 صف في أقل من ثانية.',
    },
    { question: 'هل أحتاج إلى تثبيت شيء أو إنشاء حساب؟', answer: 'لا. يعمل OpenAnyDoc في متصفحك، بدون تثبيت وبدون حساب.' },
    {
      question: 'ماذا يحدث لملفي عند إغلاق التبويب؟',
      answer: 'لا يُحفظ شيء. يبقى الملف في ذاكرة متصفحك فقط ما دامت الصفحة مفتوحة.',
    },
  ],
}
