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
        { title: 'Check the columns', text: 'The delimiter (comma, semicolon, tab or pipe) and the encoding are detected for you. If the columns look wrong, click the delimiter in the status bar at the bottom to pick another one, or turn "First row is header" on or off.' },
        { title: 'Search, filter and sort', text: 'Type in the search box (press / to jump to it) to find rows in every column. Use Filter, or the menu in a column header, to keep only the rows you need, and Shift+click column headers to sort by one or more columns. Click a header to see that column\'s profile: blanks, distinct values, numbers and a chart.' },
        { title: 'Edit and clean up', text: 'Every cell can be edited: click it and type, or paste cells copied from a spreadsheet. Add or delete rows and columns, use Find & replace, or open Clean up to change case, trim spaces, fill down blanks, split or merge columns, remove duplicate rows or transpose the table. Undo and redo are always there.' },
        { title: 'Download your CSV', text: 'Click Download to save every row with the file\'s own delimiter, or choose "Download options" in the More menu to change the delimiter, quotes or line endings, or to keep only the filtered rows. The original file on your device is never changed.' },
      ],
      faqTitle: 'CSV viewer and editor: common questions',
      faq: [
        {
          question: 'Why does my CSV file open in a single column?',
          answer: 'The file probably uses a different separator from the comma, such as a semicolon, which is common in files saved by Excel in many countries. OpenAnyDoc detects comma, semicolon, tab and pipe automatically, and you can choose the delimiter yourself by clicking it in the status bar at the bottom of the page.',
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
          answer: 'Open Clean up and choose "Remove duplicate rows", then pick the columns that must match for two rows to count as duplicates. The first copy of each row is kept. The same menu can remove empty rows, trim spaces, change the case of a column and fill empty cells down.',
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
        { title: 'Drop your .txt file on the page', text: 'Choose or drop a text file, such as notes, a log or a list. It is read in your browser, never uploaded, and opens ready to edit.' },
        { title: 'Type, or pick a tool from the ribbon', text: 'Type in the text, or open a tab (Lines, Clean, Case, Find, Analyze, View, File) and click a tool: sort, de-duplicate, number or join lines, trim spaces, change case. With text selected, a tool changes only the selected lines. Each tool is one undo step.' },
        { title: 'Find, replace and check', text: 'Press Ctrl+F (or /) to find and replace, with match case, whole word and regular expressions. Statistics count words, sentences and reading time, and Compare shows every change against the original file.' },
        { title: 'See what is hidden', text: 'Show hidden characters to spot tabs, trailing spaces, zero-width characters and line endings, then remove them with the Clean tools. Bookmarks and Go to line help in long files.' },
        { title: 'Download your text file', text: 'Click Download and choose UTF-8, UTF-8 with BOM, UTF-16 or Windows-1256, and LF, CRLF or CR line endings. The original file on your device is never changed.' },
      ],
      faqTitle: 'Text file viewer and editor: common questions',
      faq: [
        {
          question: 'How do I change line endings (LF to CRLF) in a text file?',
          answer: 'Open the file and click Download, then choose LF (macOS, Linux), CRLF (Windows) or CR for the saved file. If the file mixes line endings, File and then Fix mixed line endings makes them all the same.',
        },
        {
          question: 'How do I sort lines or remove duplicate lines in a text file?',
          answer: 'Open the Lines tab and choose Sort A–Z, Z–A, numeric, natural or by length, Reverse, Shuffle or Remove duplicate lines. Select some lines first to change only those; Ignore case applies to sorting and to duplicates.',
        },
        {
          question: 'How do I find and replace text with a regular expression?',
          answer: 'Press Ctrl+F, turn on the regular expression button and type a pattern such as TODO: (\\w+). In the replacement, $1 inserts a group, \\n a line break and \\t a tab. Replace all is one undo step, and you can also keep or remove the matching lines.',
        },
        {
          question: 'How do I count the words and characters in a text file?',
          answer: 'The status line always shows the lines, words and characters, and the counts of the selected text. Analyze and then Statistics adds sentences, paragraphs, unique words, reading time, the most frequent words and the longest lines.',
        },
        {
          question: 'Can I open text files with Arabic or other non-English characters?',
          answer: 'Yes. UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256, the old Arabic encoding. Each line is shown in its own reading direction. If the text looks wrong, choose another encoding in the File tab and reopen it.',
        },
        {
          question: 'Can I open a large text or log file?',
          answer: 'Yes. A file over about 2 million characters opens in a fast read view that draws only the visible lines, and every tool still works on the whole text. Choose Edit anyway to type in it; typing in a very large file is slower and line numbers are hidden while you do.',
        },
      ],
    },
  },
  ar: {
    '/csv-viewer': {
      stepsTitle: 'كيف تفتح ملف CSV أونلاين',
      steps: [
        { title: 'أفلت ملفك على الصفحة', text: 'أفلت ملف .csv أو .tsv أو .tab على الصفحة، أو اخترْه من جهازك. يُقرأ الملف داخل متصفحك ولا يُرفع أبدًا.' },
        { title: 'تحقق من الأعمدة', text: 'يُكتشف الفاصل (فاصلة، فاصلة منقوطة، علامة جدولة أو شرطة عمودية) والترميز تلقائيًا. إذا بدت الأعمدة غير صحيحة، انقر على الفاصل في شريط الحالة في الأسفل لاختيار فاصل آخر، وفعّل «الصف الأول عناوين» أو أوقفه.' },
        { title: 'ابحث وصفِّ ورتّب', text: 'اكتب في مربع البحث (اضغط / للانتقال إليه) للعثور على الصفوف في كل الأعمدة. استخدم «تصفية» أو قائمة عنوان العمود لإبقاء الصفوف التي تحتاجها فقط، وانقر مع Shift على عناوين الأعمدة للترتيب حسب عمود واحد أو أكثر. انقر على عنوان عمود لترى ملخصه: الخلايا الفارغة والقيم المختلفة والأرقام ومخططًا.' },
        { title: 'حرّر ونظّف', text: 'كل خلية قابلة للتحرير: انقر عليها واكتب، أو الصق خلايا منسوخة من جدول بيانات. أضف الصفوف والأعمدة أو احذفها، واستخدم «بحث واستبدال»، أو افتح «تنظيف» لتغيير حالة الأحرف وحذف المسافات الزائدة وتعبئة الفراغات للأسفل وتقسيم الأعمدة أو دمجها وحذف الصفوف المكررة أو تبديل الصفوف والأعمدة. التراجع والإعادة متاحان دائمًا.' },
        { title: 'نزّل ملف CSV', text: 'انقر على «تنزيل» لحفظ كل الصفوف بفاصل الملف نفسه، أو اختر «خيارات التنزيل» من قائمة «المزيد» لتغيير الفاصل أو علامات الاقتباس أو نهايات الأسطر، أو لإبقاء الصفوف المصفّاة فقط. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      faqTitle: 'عارض ومحرر CSV: أسئلة شائعة',
      faq: [
        {
          question: 'لماذا يُفتح ملف CSV في عمود واحد؟',
          answer: 'غالبًا يستخدم الملف فاصلًا غير الفاصلة، مثل الفاصلة المنقوطة، وهذا شائع في الملفات التي يحفظها Excel في كثير من البلدان. يكتشف OpenAnyDoc الفاصلة والفاصلة المنقوطة وعلامة الجدولة والشرطة العمودية تلقائيًا، ويمكنك اختيار الفاصل بنفسك بالنقر عليه في شريط الحالة أسفل الصفحة.',
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
          answer: 'افتح «تنظيف» واختر «إزالة الصفوف المكررة»، ثم اختر الأعمدة التي يجب أن تتطابق ليُعدّ الصفّان مكررين. تبقى أول نسخة من كل صف. ومن القائمة نفسها يمكنك حذف الصفوف الفارغة، وإزالة المسافات الزائدة، وتغيير حالة أحرف عمود، وتعبئة الخلايا الفارغة للأسفل.',
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
        { title: 'أفلت ملف .txt على الصفحة', text: 'اختر ملفًا نصيًا أو أفلته، مثل ملاحظات أو سجل أو قائمة. يُقرأ داخل متصفحك ولا يُرفع أبدًا، ويُفتح جاهزًا للتحرير.' },
        { title: 'اكتب أو اختر أداة من الشريط', text: 'اكتب في النص، أو افتح تبويبًا (الأسطر، تنظيف، حالة الأحرف، بحث، تحليل، عرض، ملف) وانقر أداة: فرز الأسطر أو حذف المكرر منها أو ترقيمها أو دمجها، وحذف المسافات، وتغيير حالة الأحرف. وعند تحديد نص تغيّر الأداة الأسطر المحددة فقط. وكل أداة خطوة تراجع واحدة.' },
        { title: 'ابحث واستبدل وراجع', text: 'اضغط Ctrl+F (أو /) للبحث والاستبدال، مع مطابقة حالة الأحرف والكلمة الكاملة والتعابير النمطية. وتعدّ الإحصاءات الكلمات والجمل ووقت القراءة، وتعرض المقارنة كل تغيير مقارنةً بالملف الأصلي.' },
        { title: 'شاهد المخفي', text: 'أظهر الأحرف المخفية لترى علامات الجدولة والمسافات في نهاية الأسطر والأحرف صفرية العرض ونهايات الأسطر، ثم احذفها بأدوات التنظيف. وتساعدك الإشارات المرجعية والانتقال إلى سطر في الملفات الطويلة.' },
        { title: 'نزّل ملفك النصي', text: 'انقر «تنزيل» واختر UTF-8 أو UTF-8 مع BOM أو UTF-16 أو Windows-1256، ونهايات الأسطر LF أو CRLF أو CR. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      faqTitle: 'عارض ومحرر الملفات النصية: أسئلة شائعة',
      faq: [
        {
          question: 'كيف أغيّر نهايات الأسطر (من LF إلى CRLF) في ملف نصي؟',
          answer: 'افتح الملف وانقر «تنزيل»، ثم اختر LF (macOS وLinux) أو CRLF (Windows) أو CR للملف المحفوظ. وإذا كانت نهايات الأسطر في الملف مختلطة، فإن «ملف» ثم «توحيد نهايات الأسطر المختلطة» يجعلها كلها متماثلة.',
        },
        {
          question: 'كيف أفرز الأسطر أو أحذف الأسطر المكررة في ملف نصي؟',
          answer: 'افتح تبويب «الأسطر» واختر الفرز من A إلى Z أو من Z إلى A أو الفرز الرقمي أو الطبيعي أو حسب الطول، أو عكس الترتيب، أو الخلط، أو حذف الأسطر المكررة. حدّد بعض الأسطر أولًا لتغييرها وحدها؛ ويسري «تجاهل حالة الأحرف» على الفرز وعلى المكرر.',
        },
        {
          question: 'كيف أبحث عن نص وأستبدله باستخدام تعبير نمطي؟',
          answer: 'اضغط Ctrl+F، وفعّل زر التعبير النمطي، واكتب نمطًا مثل TODO: (\\w+). وفي نص الاستبدال يُدرج $1 مجموعة، و\\n سطرًا جديدًا، و\\t علامة جدولة. و«استبدال الكل» خطوة تراجع واحدة، ويمكنك أيضًا إبقاء الأسطر المطابقة أو حذفها.',
        },
        {
          question: 'كيف أعدّ الكلمات والأحرف في ملف نصي؟',
          answer: 'يعرض سطر الحالة دائمًا عدد الأسطر والكلمات والأحرف، وأعداد النص المحدد. ويضيف «تحليل» ثم «الإحصاءات» الجمل والفقرات والكلمات الفريدة ووقت القراءة والكلمات الأكثر تكرارًا وأطول الأسطر.',
        },
        {
          question: 'هل يمكنني فتح ملفات نصية فيها حروف عربية أو بلغات أخرى؟',
          answer: 'نعم. تُقرأ ملفات UTF-8 (مع BOM أو بدونه) وUTF-16 مباشرة، ويُقرأ الملف الذي ليس UTF-8 صالحًا بترميز Windows-1256، وهو الترميز العربي القديم. ويُعرض كل سطر باتجاه القراءة الخاص به. وإذا ظهر النص بشكل خاطئ، فاختر ترميزًا آخر في تبويب «ملف» وأعد فتحه.',
        },
        {
          question: 'هل يمكنني فتح ملف نصي أو سجل كبير؟',
          answer: 'نعم. يُفتح الملف الذي يزيد على مليوني حرف تقريبًا في عرض سريع للقراءة يرسم الأسطر الظاهرة فقط، وتعمل كل الأدوات على النص كاملًا. اختر «التحرير على أي حال» للكتابة فيه؛ فالكتابة في ملف كبير جدًا أبطأ، وتُخفى أرقام الأسطر أثناء ذلك.',
        },
      ],
    },
  },
}
