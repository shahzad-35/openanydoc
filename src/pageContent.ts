// What each format page says beyond the hero: numbered steps for opening and editing a file, and questions people really ask about
// that file type, in English and Arabic (with answers that match what the viewer does). It replaces the shared features and FAQ blocks on a format page,
// so every page has text of its own. Plain data with no imports, because scripts/build-static-pages.mjs also reads it to write
// the same text, and the same questions as FAQPage data, into each page's static HTML. Keep the answers true: only what is built.

export type GuideStep = { title: string; text: string }
export type GuideQuestion = { question: string; answer: string }
type Locale = 'en' | 'ar'

export type FormatGuide = { stepsTitle: string; steps: GuideStep[]; faqTitle: string; faq: GuideQuestion[] }

// Keyed by language, then by the format page's address, like pageSeo in seo.ts. Both languages have the same steps and questions in the same order.
export const formatGuides: Record<Locale, Record<string, FormatGuide>> = {
  en: {
    '/csv-viewer': {
      stepsTitle: 'How to open a CSV file online',
      steps: [
        { title: 'Drop your file on the page', text: 'Drop a .csv, .tsv or .tab file on the page, or choose it from your device. It is read in your browser and never uploaded.' },
        { title: 'Check the columns', text: 'The delimiter (comma, semicolon, tab or pipe) is detected for you. If the columns look wrong, pick another delimiter from the list at the bottom, and turn "First row is header" on or off.' },
        { title: 'Search and sort', text: 'Type in the search box (press / to jump to it) to show only the rows that match, and click the arrows in a column header to sort that column.' },
        { title: 'Switch to Edit to make changes', text: 'Click a cell to edit it, add or delete rows and columns, use find and replace, or clean up a column or the whole table: change case, trim spaces, remove empty or duplicate rows. Undo and redo are always there.' },
        { title: 'Download your CSV', text: 'Use the download icon to save the edited file. The original file on your device is never changed.' },
      ],
      faqTitle: 'CSV viewer and editor: common questions',
      faq: [
        {
          question: 'Why does my CSV file open in a single column?',
          answer: 'The file probably uses a different separator from the comma, such as a semicolon, which is common in files saved by Excel in many countries. OpenAnyDoc detects comma, semicolon, tab and pipe automatically, and you can choose the delimiter yourself from the list at the bottom of the table.',
        },
        {
          question: 'How do I open a CSV file with Arabic or other non-English text?',
          answer: 'Just open it: UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256, the old Arabic encoding. Arabic cells display right-to-left. When you download, a byte order mark is added if the file has non-English text, so Excel shows it correctly.',
        },
        {
          question: 'Can I open a large CSV file online?',
          answer: 'Yes. A CSV file with 100,000 rows opens in under a second, because only the rows on screen are drawn, and it stays smooth while you edit. Files over 50 MB show a warning, and OpenAnyDoc still tries to open them; the limit is your browser\'s memory.',
        },
        {
          question: 'How do I remove duplicate rows from a CSV file?',
          answer: 'Switch to Edit, open the Clean up menu (the Aa icon) and choose "Table: remove duplicate rows". The first copy of each row is kept. The same menu can remove empty rows, trim spaces, change the case of a column and fill empty cells down.',
        },
        {
          question: 'Does the CSV editor keep leading zeros and long numbers?',
          answer: 'Yes. Every cell is read as text exactly as written, so postcodes like 00123 and long ID numbers are not changed into numbers or shortened.',
        },
        {
          question: 'Can I edit TSV and tab-separated files too?',
          answer: 'Yes. .tsv and .tab files open tab-separated, with the header row detected, and you can edit and download them the same way as a CSV file.',
        },
      ],
    },
    '/excel-viewer': {
      stepsTitle: 'How to open and edit an Excel file online',
      steps: [
        { title: 'Drop your workbook on the page', text: 'Choose an .xlsx, .xls, .xlsm or .ods file. It is read in your browser and never uploaded.' },
        { title: 'Move between sheets', text: 'Every sheet is a tab at the bottom, like in Excel. Dates, percentages and currencies are shown as formatted in the file, and merged cells are drawn as one cell.' },
        { title: 'Switch to Edit', text: 'Click a cell and type a value, or a formula such as =SUM(B2:B10). Formulas recalculate as you edit, and the cells that depend on them update.' },
        { title: 'Format your data', text: 'Use the toolbar to change number formats and currencies, insert or delete rows, columns and sheets, merge cells and, in .xlsx files, set bold, colours, fonts and borders.' },
        { title: 'Save the workbook', text: 'Use the save icon to download the workbook in the same format. The original file on your device is never changed.' },
      ],
      faqTitle: 'Excel viewer and editor: common questions',
      faq: [
        {
          question: 'How do I open an XLSX file without Excel?',
          answer: 'Drop the .xlsx file on this page. It opens in your browser with its sheets, formatting and merged cells, and you can edit it and save it again, with no Excel, no account and no upload.',
        },
        {
          question: 'Do formulas recalculate when I edit a cell?',
          answer: 'Yes. After you change a cell, formulas that depend on it show the new result, including common functions such as SUM, AVERAGE, IF, COUNTIF, SUMIF, VLOOKUP and INDEX/MATCH. If a formula uses a function that is not supported, it keeps the result saved in the file.',
        },
        {
          question: 'Will I lose formatting when I save the workbook?',
          answer: 'In .xlsx files, cell styles (bold, colours, fonts, borders, alignment), merged cells, number formats and column widths are kept. In .xls, .ods and .xlsm files, values, formulas, number formats, merged cells and column widths are kept but cell styles are not. Charts, images and macros are not kept in any format.',
        },
        {
          question: 'Can I open an old .xls file or an OpenDocument .ods spreadsheet?',
          answer: 'Yes. .xls (Excel 97 to 2003), .xlsm (macro-enabled) and .ods (OpenDocument, from LibreOffice) files open the same way as .xlsx, and are saved back in their own format.',
        },
        {
          question: 'Can I open a password-protected Excel file?',
          answer: 'No. Encrypted workbooks cannot be opened, because the file has to be read in your browser without sending it anywhere. Remove the password in Excel first, then open the file here.',
        },
        {
          question: 'How big an Excel file can I open?',
          answer: 'A sheet with 100,000 rows opens in about two seconds and stays smooth while you edit, because only the rows on screen are drawn. For workbooks over 8 MB, cell styles are not loaded, so those files open as values and formulas.',
        },
      ],
    },
    '/json-viewer': {
      stepsTitle: 'How to open and format a JSON file online',
      steps: [
        { title: 'Drop, paste or try a sample', text: 'Choose or drop a .json file, paste JSON with Ctrl+V, or try the sample. It is read in your browser, so API responses, configuration files and other private data are never uploaded.' },
        { title: 'Text and tree side by side', text: 'The text sits next to a collapsible tree (or a table for a list of objects) and an inspector; selecting a node in one shows it in the other. Search keys and values, or type a path such as $.orders[*].total.' },
        { title: 'Validate and repair', text: 'Validate shows the result with the size, keys, values and depth. If the JSON is not valid you see the line and column, and Repair fixes comments, trailing or missing commas, single quotes and unquoted keys.' },
        { title: 'Format and edit', text: 'Type in the text, or use the tree and the inspector. Format with 1, 2, 3, 4 or 8 spaces or a tab, minify, sort keys, and change, add, duplicate, move or delete nodes. Long numbers are kept exactly.' },
        { title: 'Download your JSON', text: 'Use the Download button to save the result. The original file on your device is never changed.' },
      ],
      faqTitle: 'JSON viewer and editor: common questions',
      faq: [
        {
          question: 'How do I format (pretty print) JSON online?',
          answer: 'Open your file and press Format, or choose 1, 2, 3, 4 or 8 spaces or Tab from the menu next to it. The text shows the formatted result and the download uses the same layout.',
        },
        {
          question: 'How do I minify JSON?',
          answer: 'Press Minify. All spaces and line breaks outside strings are removed, which makes the file smaller.',
        },
        {
          question: 'How do I find and fix the error in my JSON?',
          answer: 'When the JSON is not valid, OpenAnyDoc shows what is wrong with the line and column number, and "Go to error" selects the place in the text. Repair fixes the usual hand-written mistakes (comments, trailing or missing commas, single quotes, unquoted keys, True, None and NaN) and says what it changed.',
        },
        {
          question: 'Can I sort the keys of a JSON object alphabetically?',
          answer: 'Yes. Press Sort keys: the keys of every object, including the objects nested inside, are put in order from A to Z. Undo takes it back.',
        },
        {
          question: 'Can I open a large JSON file?',
          answer: 'JSON files up to 10 MB open, and a file of that size shows its tree in under a second. Larger files are refused, because every edit would make the page slow.',
        },
        {
          question: 'Is it safe to paste or open private JSON here?',
          answer: 'Your JSON is not uploaded: the browser reads the file and nothing is sent to a server, which makes it suitable for tokens, customer data in test files and internal configuration.',
        },
      ],
    },
    '/txt-viewer': {
      stepsTitle: 'How to open and edit a text file online',
      steps: [
        { title: 'Drop your .txt file on the page', text: 'Choose a text file, such as notes, a log or a list. It is read in your browser and never uploaded.' },
        { title: 'Read it comfortably', text: 'Turn line numbers and wrapping on or off, pick a font and a size, and search the text (press / to jump to the search box).' },
        { title: 'Switch to Edit', text: 'Type in the text box, or use the toolbar: change case, tidy spaces, sort, reverse or de-duplicate lines, indent, insert the date and time, and find and replace. With text selected, a tool works on the selection only.' },
        { title: 'Choose the line endings', text: 'Pick LF (Unix, macOS) or CRLF (Windows) for the saved file. Without a choice, the file keeps the line endings it had.' },
        { title: 'Download your text file', text: 'Use the download icon to save it. The original file on your device is never changed.' },
      ],
      faqTitle: 'Text file viewer and editor: common questions',
      faq: [
        {
          question: 'How do I change line endings (LF to CRLF) in a text file?',
          answer: 'Open the file, switch to Edit, open the line endings menu in the toolbar and choose LF or CRLF. The download uses your choice; a file that already ends its lines that way is left as it is.',
        },
        {
          question: 'How do I sort lines or remove duplicate lines in a text file?',
          answer: 'In Edit mode, open the lines menu and choose Sort A to Z, Sort Z to A, Reverse order or Remove duplicate lines. Select some lines first to change only those, or select nothing to change the whole text.',
        },
        {
          question: 'How do I change the case of text?',
          answer: 'Use the case menu in the toolbar: UPPERCASE, lowercase, Capitalize Each Word or Sentence case, on the selected text or on the whole file.',
        },
        {
          question: 'Can I open text files with Arabic or other non-English characters?',
          answer: 'Yes. UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256, the old Arabic encoding. Each line is shown in its own reading direction.',
        },
        {
          question: 'Can I open a large text or log file?',
          answer: 'Yes. In View mode only the visible lines are drawn, so large files stay fast. Editing a very large file (over about 2 million characters) can feel slower, and line numbers are hidden while you edit it.',
        },
        {
          question: 'Does it keep my file\'s line endings and encoding?',
          answer: 'Yes. Line endings stay as they were unless you choose others, and a file that started with a byte order mark keeps it. Saved text files are UTF-8.',
        },
      ],
    },
  },
  ar: {
    '/csv-viewer': {
      stepsTitle: 'كيف تفتح ملف CSV أونلاين',
      steps: [
        { title: 'أفلت ملفك على الصفحة', text: 'أفلت ملف .csv أو .tsv أو .tab على الصفحة، أو اخترْه من جهازك. يُقرأ الملف داخل متصفحك ولا يُرفع أبدًا.' },
        { title: 'تحقق من الأعمدة', text: 'يُكتشف الفاصل (فاصلة، فاصلة منقوطة، علامة جدولة أو شرطة عمودية) تلقائيًا. إذا بدت الأعمدة غير صحيحة، اختر فاصلًا آخر من القائمة في الأسفل، وفعّل «الصف الأول عناوين» أو أوقفه.' },
        { title: 'ابحث وافرز', text: 'اكتب في مربع البحث (اضغط / للانتقال إليه) لإظهار الصفوف المطابقة فقط، وانقر على الأسهم في عنوان العمود لفرز ذلك العمود.' },
        { title: 'انتقل إلى التحرير لإجراء التغييرات', text: 'انقر على خلية لتعديلها، وأضف الصفوف والأعمدة أو احذفها، واستخدم البحث والاستبدال، أو نظّف عمودًا أو الجدول كله: غيّر حالة الأحرف، واحذف المسافات الزائدة، واحذف الصفوف الفارغة أو المكررة. التراجع والإعادة متاحان دائمًا.' },
        { title: 'نزّل ملف CSV', text: 'استخدم أيقونة التنزيل لحفظ الملف المعدَّل. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      faqTitle: 'عارض ومحرر CSV: أسئلة شائعة',
      faq: [
        {
          question: 'لماذا يُفتح ملف CSV في عمود واحد؟',
          answer: 'غالبًا يستخدم الملف فاصلًا غير الفاصلة، مثل الفاصلة المنقوطة، وهذا شائع في الملفات التي يحفظها Excel في كثير من البلدان. يكتشف OpenAnyDoc الفاصلة والفاصلة المنقوطة وعلامة الجدولة والشرطة العمودية تلقائيًا، ويمكنك اختيار الفاصل بنفسك من القائمة في أسفل الجدول.',
        },
        {
          question: 'كيف أفتح ملف CSV فيه نص عربي أو بلغة غير الإنجليزية؟',
          answer: 'افتحه مباشرة: تُقرأ ملفات UTF-8 (مع BOM أو بدونه) وUTF-16 مباشرة، ويُقرأ الملف الذي ليس UTF-8 صالحًا بترميز Windows-1256، وهو الترميز العربي القديم. وتُعرض الخلايا العربية من اليمين إلى اليسار. عند التنزيل تُضاف علامة ترتيب البايت (BOM) إذا كان في الملف نص بلغة غير الإنجليزية، حتى يعرضه Excel بشكل صحيح.',
        },
        {
          question: 'هل يمكنني فتح ملف CSV كبير أونلاين؟',
          answer: 'نعم. يُفتح ملف CSV بـ 100,000 صف في أقل من ثانية، لأن الصفوف الظاهرة على الشاشة فقط هي التي تُرسم، ويبقى سريعًا أثناء التحرير. تظهر رسالة تحذير للملفات التي يزيد حجمها على 50 ميغابايت، ويحاول OpenAnyDoc فتحها مع ذلك؛ والحد هو ذاكرة متصفحك.',
        },
        {
          question: 'كيف أحذف الصفوف المكررة من ملف CSV؟',
          answer: 'انتقل إلى التحرير، وافتح قائمة التنظيف (أيقونة Aa) واختر «الجدول: حذف الصفوف المكررة». تبقى أول نسخة من كل صف. ومن القائمة نفسها يمكنك حذف الصفوف الفارغة، وإزالة المسافات الزائدة، وتغيير حالة أحرف عمود، وتعبئة الخلايا الفارغة للأسفل.',
        },
        {
          question: 'هل يحافظ محرر CSV على الأصفار البادئة والأرقام الطويلة؟',
          answer: 'نعم. تُقرأ كل خلية كنص تمامًا كما كُتبت، فلا تتحول الرموز البريدية مثل 00123 وأرقام المعرّفات الطويلة إلى أرقام ولا تُقتطع.',
        },
        {
          question: 'هل يمكنني تحرير ملفات TSV والملفات المفصولة بعلامة جدولة؟',
          answer: 'نعم. تُفتح ملفات .tsv و.tab مفصولة بعلامة جدولة مع اكتشاف صف العناوين، ويمكنك تحريرها وتنزيلها بالطريقة نفسها المتبعة مع ملف CSV.',
        },
      ],
    },
    '/excel-viewer': {
      stepsTitle: 'كيف تفتح ملف Excel وتعدّله أونلاين',
      steps: [
        { title: 'أفلت المصنف على الصفحة', text: 'اختر ملف .xlsx أو .xls أو .xlsm أو .ods. يُقرأ داخل متصفحك ولا يُرفع أبدًا.' },
        { title: 'تنقّل بين الأوراق', text: 'كل ورقة تبويب في الأسفل، كما في Excel. تُعرض التواريخ والنسب المئوية والعملات بتنسيقها في الملف، وتُرسم الخلايا المدمجة كخلية واحدة.' },
        { title: 'انتقل إلى التحرير', text: 'انقر على خلية واكتب قيمة أو صيغة مثل =SUM(B2:B10). تُعاد حساب الصيغ أثناء التعديل، وتتحدث الخلايا التي تعتمد عليها.' },
        { title: 'نسّق بياناتك', text: 'استخدم شريط الأدوات لتغيير تنسيقات الأرقام والعملات، وإدراج الصفوف والأعمدة والأوراق أو حذفها، ودمج الخلايا، وفي ملفات .xlsx اضبط الخط الغامق والألوان والخطوط والحدود.' },
        { title: 'احفظ المصنف', text: 'استخدم أيقونة الحفظ لتنزيل المصنف بالصيغة نفسها. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      faqTitle: 'عارض ومحرر Excel: أسئلة شائعة',
      faq: [
        {
          question: 'كيف أفتح ملف XLSX بدون Excel؟',
          answer: 'أفلت ملف .xlsx على هذه الصفحة. يُفتح في متصفحك مع أوراقه وتنسيقه وخلاياه المدمجة، ويمكنك تعديله وحفظه من جديد، بدون Excel وبدون حساب وبدون رفع.',
        },
        {
          question: 'هل تُعاد حساب الصيغ عند تعديل خلية؟',
          answer: 'نعم. بعد تغيير خلية، تعرض الصيغ التي تعتمد عليها النتيجة الجديدة، ومنها الدوال الشائعة مثل SUM وAVERAGE وIF وCOUNTIF وSUMIF وVLOOKUP وINDEX/MATCH. إذا استخدمت صيغة دالة غير مدعومة، تحتفظ بالنتيجة المحفوظة في الملف.',
        },
        {
          question: 'هل سأفقد التنسيق عند حفظ المصنف؟',
          answer: 'في ملفات .xlsx تُحفظ أنماط الخلايا (الخط الغامق، والألوان، والخطوط، والحدود، والمحاذاة) والخلايا المدمجة وتنسيقات الأرقام وعرض الأعمدة. وفي ملفات .xls و.ods و.xlsm تُحفظ القيم والصيغ وتنسيقات الأرقام والخلايا المدمجة وعرض الأعمدة، لكن أنماط الخلايا لا تُحفظ. أما المخططات والصور وحزم الماكرو فلا تُحفظ في أي صيغة.',
        },
        {
          question: 'هل يمكنني فتح ملف .xls قديم أو جدول OpenDocument بصيغة .ods؟',
          answer: 'نعم. تُفتح ملفات .xls (Excel 97 إلى 2003) و.xlsm (المفعّلة بالماكرو) و.ods (OpenDocument من LibreOffice) بالطريقة نفسها مثل .xlsx، وتُحفظ بصيغتها الأصلية.',
        },
        {
          question: 'هل يمكنني فتح ملف Excel محمي بكلمة مرور؟',
          answer: 'لا. لا يمكن فتح المصنفات المشفّرة، لأن الملف يجب أن يُقرأ في متصفحك دون إرساله إلى أي جهة. أزل كلمة المرور في Excel أولًا، ثم افتح الملف هنا.',
        },
        {
          question: 'ما أكبر حجم لملف Excel يمكنني فتحه؟',
          answer: 'تُفتح ورقة بـ 100,000 صف في نحو ثانيتين، وتبقى سريعة أثناء التحرير، لأن الصفوف الظاهرة على الشاشة فقط هي التي تُرسم. أما المصنفات التي يزيد حجمها على 8 ميغابايت فلا تُحمَّل أنماط خلاياها، فتُفتح بالقيم والصيغ فقط.',
        },
      ],
    },
    '/json-viewer': {
      stepsTitle: 'كيف تفتح ملف JSON وتنسّقه أونلاين',
      steps: [
        { title: 'أفلت ملفًا أو الصق JSON أو جرّب مثالًا', text: 'اختر ملف .json أو أفلته، أو الصق JSON باستخدام Ctrl+V، أو جرّب المثال. يُقرأ داخل متصفحك، فلا تُرفع استجابات API وملفات الإعدادات وغيرها من البيانات الخاصة.' },
        { title: 'النص والشجرة جنبًا إلى جنب', text: 'يظهر النص بجانب شجرة قابلة للطي (أو جدول لقائمة من الكائنات) ولوحة تفاصيل؛ تحديد عقدة في أحدهما يُظهرها في الآخر. ابحث في المفاتيح والقيم، أو اكتب مسارًا مثل $.orders[*].total.' },
        { title: 'تحقّق وأصلح', text: 'يعرض «تحقّق» النتيجة مع الحجم وعدد المفاتيح والقيم والعمق. إذا لم يكن JSON صالحًا فسترى السطر والعمود، ويصلح «إصلاح» التعليقات والفواصل الزائدة أو الناقصة وعلامات الاقتباس المفردة والمفاتيح غير المقتبسة.' },
        { title: 'نسّق وعدّل', text: 'اكتب في النص، أو استخدم الشجرة ولوحة التفاصيل. نسّق بمسافة واحدة أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة، واضغط الملف، ورتّب المفاتيح، وغيّر العقد وأضفها وكرّرها وانقلها واحذفها. تُحفظ الأرقام الطويلة كما هي.' },
        { title: 'نزّل ملف JSON', text: 'استخدم زر «تنزيل» لحفظ النتيجة. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      faqTitle: 'عارض ومحرر JSON: أسئلة شائعة',
      faq: [
        {
          question: 'كيف أنسّق JSON (Pretty Print) أونلاين؟',
          answer: 'افتح ملفك واضغط «تنسيق»، أو اختر مسافة واحدة أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة من القائمة المجاورة له. يعرض النص النتيجة المنسقة، ويستخدم التنزيل التخطيط نفسه.',
        },
        {
          question: 'كيف أضغط ملف JSON؟',
          answer: 'اضغط «تصغير». تُحذف كل المسافات وفواصل الأسطر خارج النصوص، فيصغر حجم الملف.',
        },
        {
          question: 'كيف أجد الخطأ في ملف JSON وأصلحه؟',
          answer: 'عندما لا يكون JSON صالحًا، يعرض OpenAnyDoc سبب الخطأ مع رقم السطر والعمود، ويحدد «انتقل إلى الخطأ» الموضع في النص. ويصلح «إصلاح» الأخطاء المعتادة في الكتابة اليدوية (التعليقات والفواصل الزائدة أو الناقصة وعلامات الاقتباس المفردة والمفاتيح غير المقتبسة وTrue وNone وNaN) ويذكر ما غيّره.',
        },
        {
          question: 'هل يمكنني ترتيب مفاتيح كائن JSON أبجديًا؟',
          answer: 'نعم. اضغط «ترتيب المفاتيح»: تُرتَّب مفاتيح كل كائن، ومنها الكائنات المتداخلة، من A إلى Z. ويعيدها «تراجع» كما كانت.',
        },
        {
          question: 'هل يمكنني فتح ملف JSON كبير؟',
          answer: 'تُفتح ملفات JSON حتى 10 ميغابايت، ويَظهر ملف بهذا الحجم كشجرة في أقل من ثانية. أما الملفات الأكبر فلا تُفتح، لأن كل تعديل سيجعل الصفحة بطيئة.',
        },
        {
          question: 'هل من الآمن فتح JSON خاص أو لصقه هنا؟',
          answer: 'ملف JSON لا يُرفع: يقرأ المتصفح الملف ولا يُرسل شيء إلى أي خادم، ما يجعله مناسبًا للرموز المميزة وبيانات العملاء في ملفات الاختبار وإعدادات الأنظمة الداخلية.',
        },
      ],
    },
    '/txt-viewer': {
      stepsTitle: 'كيف تفتح ملفًا نصيًا وتعدّله أونلاين',
      steps: [
        { title: 'أفلت ملف .txt على الصفحة', text: 'اختر ملفًا نصيًا، مثل ملاحظات أو سجل أو قائمة. يُقرأ داخل متصفحك ولا يُرفع أبدًا.' },
        { title: 'اقرأه براحة', text: 'فعّل أرقام الأسطر والتفاف النص أو أوقفهما، واختر الخط وحجمه، وابحث في النص (اضغط / للانتقال إلى مربع البحث).' },
        { title: 'انتقل إلى التحرير', text: 'اكتب في مربع النص، أو استخدم شريط الأدوات: غيّر حالة الأحرف، ورتّب المسافات، وافرز الأسطر أو اعكسها أو احذف المكرر منها، وأضف مسافة بادئة، وأدرج التاريخ والوقت، واستخدم البحث والاستبدال. وعند تحديد نص تعمل الأداة على التحديد فقط.' },
        { title: 'اختر نهايات الأسطر', text: 'اختر LF (Unix وmacOS) أو CRLF (Windows) للملف المحفوظ. وإن لم تختر، يحتفظ الملف بنهايات الأسطر التي كانت فيه.' },
        { title: 'نزّل ملفك النصي', text: 'استخدم أيقونة التنزيل لحفظه. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      faqTitle: 'عارض ومحرر الملفات النصية: أسئلة شائعة',
      faq: [
        {
          question: 'كيف أغيّر نهايات الأسطر (من LF إلى CRLF) في ملف نصي؟',
          answer: 'افتح الملف، وانتقل إلى التحرير، وافتح قائمة نهايات الأسطر في شريط الأدوات واختر LF أو CRLF. يستخدم التنزيل اختيارك؛ أما الملف الذي تنتهي أسطره بهذه الطريقة أصلًا فيبقى كما هو.',
        },
        {
          question: 'كيف أفرز الأسطر أو أحذف الأسطر المكررة في ملف نصي؟',
          answer: 'في وضع التحرير، افتح قائمة الأسطر واختر الفرز من A إلى Z أو من Z إلى A أو عكس الترتيب أو حذف الأسطر المكررة. حدّد بعض الأسطر أولًا لتغيير هذه الأسطر فقط، أو لا تحدد شيئًا لتغيير النص كله.',
        },
        {
          question: 'كيف أغيّر حالة الأحرف في النص؟',
          answer: 'استخدم قائمة حالة الأحرف في شريط الأدوات: أحرف كبيرة، أو أحرف صغيرة، أو أول حرف من كل كلمة كبير، أو حالة الجملة، على النص المحدد أو على الملف كله.',
        },
        {
          question: 'هل يمكنني فتح ملفات نصية فيها حروف عربية أو بلغات أخرى؟',
          answer: 'نعم. تُقرأ ملفات UTF-8 (مع BOM أو بدونه) وUTF-16 مباشرة، ويُقرأ الملف الذي ليس UTF-8 صالحًا بترميز Windows-1256، وهو الترميز العربي القديم. ويُعرض كل سطر باتجاه القراءة الخاص به.',
        },
        {
          question: 'هل يمكنني فتح ملف نصي أو سجل كبير؟',
          answer: 'نعم. في وضع العرض تُرسم الأسطر الظاهرة فقط، فتبقى الملفات الكبيرة سريعة. وقد يكون تحرير ملف كبير جدًا (أكثر من مليوني حرف تقريبًا) أبطأ، وتُخفى أرقام الأسطر أثناء تحريره.',
        },
        {
          question: 'هل يحافظ على نهايات الأسطر وترميز ملفي؟',
          answer: 'نعم. تبقى نهايات الأسطر كما كانت ما لم تختر غيرها، والملف الذي بدأ بعلامة ترتيب البايت (BOM) يحتفظ بها. والملفات النصية المحفوظة بترميز UTF-8.',
        },
      ],
    },
  },
}
