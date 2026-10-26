// Guides: a page per problem people search for, solved with the viewers ("Why your CSV shows broken Arabic text in Excel"). Each has
// the same shape as an info page (legalContent.ts): h2 sections with paragraphs, an optional list and the phrases that link to other
// pages. Head text lives in seo.ts, the page is drawn by InfoPage.tsx. Plain data (the type import is erased), so the build script can read
// it too. Keep every claim about the viewers true to what they do.
import type { InfoPageContent } from './legalContent'

type Locale = 'en' | 'ar'

const CONTACT_EMAIL = 'support@openanydoc.com'

export const guidePages: Record<Locale, Record<string, InfoPageContent>> = {
  en: {
    '/fix-arabic-csv-in-excel': {
      published: '2026-10-20',
      updated: '2026-10-20',
      sections: [
        {
          heading: 'What the broken text looks like',
          paragraphs: [
            'You export a report, open the CSV in Excel, and the Arabic column reads "Ø§Ù„Ø±ÙŠØ§Ø¶" instead of "الرياض". Sometimes it is a row of question marks or empty boxes instead. The data in the file is almost always intact; Excel has only read it with the wrong character encoding.',
          ],
        },
        {
          heading: 'Why Excel gets the encoding wrong',
          paragraphs: [
            'A CSV file is plain text, and plain text carries no label saying which encoding it uses. Nearly every system today writes UTF-8, which covers Arabic and every other script.',
            'When you double-click a .csv, Excel does not ask. It assumes the old Windows code page of your computer (Windows-1252 on an English PC, Windows-1256 on an Arabic one) unless the file starts with a three-byte UTF-8 marker called the byte order mark, or BOM. Most exports leave the BOM out, so Excel reads each Arabic letter as two or three Latin symbols. Tab-separated files (.tsv) have exactly the same problem.',
          ],
          links: [{ text: 'Tab-separated files', path: '/tsv-viewer' }],
        },
        {
          heading: 'Fix 1: download an Excel-ready copy (free, nothing uploaded)',
          paragraphs: ['OpenAnyDoc adds the missing marker for you, and the file never leaves your computer:'],
          list: [
            'Open the CSV viewer and drop the file on the page. It checks for a BOM, UTF-16 and UTF-8, and falls back to Windows-1256 for older Arabic files; the status bar at the bottom shows the encoding it found.',
            'If the file has Arabic text and no BOM, an "Excel copy" button appears in the status bar. Click it.',
            'A copy named like your file with "-excel" added is downloaded, with the UTF-8 marker and Windows line endings. Double-click that copy and Excel shows the Arabic correctly.',
          ],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'Fix 2: import the file instead of opening it',
          paragraphs: [
            'Excel reads the encoding correctly when you import rather than double-click: go to Data, then Get Data, From File, From Text/CSV (older versions: Data, From Text), pick the file, set File Origin to "65001: Unicode (UTF-8)" and load it. It works every time, but you have to repeat it for every file, and the result is a workbook rather than the CSV itself.',
            'The normal Download button in OpenAnyDoc also adds the marker whenever the file holds non-English text, so any copy you edit there opens cleanly in Excel too. If Excel refuses the file altogether because it has more than about a million rows, the large CSV viewer opens it in the browser instead.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'Fix 3: write the file the right way next time',
          paragraphs: [
            'If the CSV is made in Excel, use Save As and choose "CSV UTF-8 (Comma delimited)": that format writes the BOM. If it comes from code or an export tool, write UTF-8 with a BOM for files that will be opened in Excel, or export an .xlsx workbook instead, which stores its encoding and never has this problem. You can check an XLSX in the Excel viewer without opening Excel.',
          ],
          links: [{ text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'The reverse case: a file that only Excel reads correctly',
          paragraphs: [
            'Exports from older Arabic systems are often Windows-1256 with no UTF-8 at all. Excel on an Arabic PC shows them fine, while browsers, editors and most modern tools assume UTF-8 and show nonsense. OpenAnyDoc reads such a file as Windows-1256 automatically, and if the guess is wrong you can pick the encoding yourself in the status bar. Downloading then writes UTF-8 with the marker, so the file opens correctly everywhere.',
          ],
        },
        {
          heading: 'When the letters are right but the order is wrong',
          paragraphs: [
            'If the Arabic letters themselves are correct but numbers, brackets or English words sit on the wrong side, the encoding is fine. That is text direction: set the cell or sheet to right-to-left in Excel (Page Layout, then Sheet Right-to-Left, or the paragraph direction buttons). In OpenAnyDoc, cells with Arabic text are shown right-to-left automatically.',
          ],
        },
        {
          heading: 'Still broken?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you see. Do not send the file if it holds personal data; the first line is usually enough.`],
        },
      ],
    },
    '/csv-opens-in-one-column': {
      published: '2026-10-22',
      updated: '2026-10-22',
      sections: [
        {
          heading: 'What you see',
          paragraphs: [
            'You double-click a .csv file and Excel shows every row squeezed into column A: "name;city;amount" in one cell, with the separators still visible. Sorting and formulas are useless, and Text to Columns is the only thing that seems to help. The file is fine; Excel just split it on the wrong character.',
          ],
        },
        {
          heading: 'Why Excel puts a CSV in one column',
          paragraphs: [
            'A CSV file has no header that says which character separates the fields. "Comma-separated" is the name, but Excel does not look for commas: when you double-click a .csv it uses the list separator of your Windows region. In countries that write decimals with a comma (most of Europe, and several Arabic locales) that separator is a semicolon, so a file with commas lands in one column. The reverse happens too: a file exported with semicolons opens in one column on an English PC.',
            'Tab-separated files (.tsv and .tab) and pipe-separated exports hit the same wall, because Excel only splits them if you go through the import dialog.',
          ],
        },
        {
          heading: 'Fix 1: let the viewer detect the separator, then save a copy Excel understands',
          paragraphs: ['OpenAnyDoc reads the file in your browser and nothing is uploaded:'],
          list: [
            'Open the CSV viewer and drop the file on the page. The delimiter (comma, semicolon, tab or pipe) is detected for you, and the status bar at the bottom shows which one it found. If the columns still look wrong, click the delimiter in the status bar and pick another.',
            'Press Download, or choose "Download options" in the More menu to pick the delimiter yourself: semicolon for a PC that writes decimals with a comma, comma for one that uses a point.',
            'Double-click the downloaded copy. Excel now splits it where you expect. For a .tsv or .tab file use the TSV viewer, which does the same with tabs.',
          ],
          links: [
            { text: 'CSV viewer', path: '/csv-viewer' },
            { text: 'TSV viewer', path: '/tsv-viewer' },
          ],
        },
        {
          heading: 'Fix 2: import instead of double-clicking',
          paragraphs: [
            'In Excel go to Data, then Get Data, From File, From Text/CSV (older versions: Data, From Text). The preview shows the data with a Delimiter box: choose comma, semicolon, tab or a custom character, then Load. Excel reads the file correctly every time, but you have to do it for every file, and the result is a workbook, not the CSV itself.',
            'If the data is already in one column, select it and use Data, then Text to Columns, choose Delimited, tick the separator, and finish. That fixes the sheet in front of you without reopening the file.',
          ],
        },
        {
          heading: 'Fix 3: tell Excel the separator inside the file',
          paragraphs: [
            'Excel honours a first line that reads sep=; (or sep=, sep=| and so on). Add it above the header and Excel splits the file on that character when double-clicked. It is an Excel-only trick: other programs show the line as data, so use it for files meant only for Excel.',
            'The lasting fix for one PC is the region setting: Windows Settings, Time & language, Language & region, Administrative language settings, Additional settings, List separator. Change it only if every file you open uses the same separator.',
          ],
        },
        {
          heading: 'Quotes, line breaks and numbers',
          paragraphs: [
            'A field that contains the separator itself, a line break or a quote must be wrapped in double quotes ("Riyadh, KSA"), with inner quotes doubled. A file that does this correctly survives any of the fixes above; one that does not will also break in the viewer, which then shows the uneven rows so you can see where. Leading zeros (postal codes, IDs) are a separate problem: Excel drops them when it guesses a number, while the viewer keeps them as written.',
          ],
        },
        {
          heading: 'Still in one column?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and paste the first two lines of the file (no personal data). The separator is usually visible right there.`],
        },
      ],
    },
    '/csv-too-big-for-excel': {
      published: '2026-10-22',
      updated: '2026-10-22',
      sections: [
        {
          heading: 'What you see',
          paragraphs: [
            'Excel says "File not loaded completely", the sheet stops at row 1,048,576, or Excel freezes for minutes on a file of a few hundred megabytes and then opens it with some rows missing. The export looked fine; it is simply larger than a worksheet can hold.',
          ],
        },
        {
          heading: 'Why Excel cannot open it',
          paragraphs: [
            'A worksheet holds at most 1,048,576 rows and 16,384 columns. A CSV with more rows is cut at that line, silently in older versions and with a warning in newer ones. Well below that limit the size itself bites: a 300 MB text file becomes several gigabytes of cells in memory, so Excel spends minutes parsing and may run out of memory. Google Sheets stops earlier, at 10 million cells per spreadsheet.',
          ],
        },
        {
          heading: 'Option 1: open it in the browser and cut it down',
          paragraphs: ['The large CSV viewer reads the file on your device, draws only the rows on screen, and never uploads it:'],
          list: [
            'Drop the file on that page. A 120,000-row file opens in under a second; the viewer has no row limit of its own, and a file over 50 MB shows a warning first because the limit is your device\'s memory, not the tool.',
            'Search, filter and sort as usual: a filter runs over every row, and a column profile shows blanks, distinct values and a chart.',
            'Keep only the rows you need: choose "Download options" in the More menu and tick "only the shown rows". The result is a CSV Excel opens without complaint.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'Option 2: load it into Excel without a worksheet',
          paragraphs: [
            'Excel can hold more than a million rows in its Data Model, just not in cells. Go to Data, Get Data, From File, From Text/CSV, then instead of Load choose Load To, tick "Only Create Connection" and "Add this data to the Data Model". You can then build a PivotTable over all the rows, filter in Power Query and load only a slice into a sheet.',
          ],
        },
        {
          heading: 'Option 3: split or summarise the file first',
          paragraphs: [
            'If the goal is a report, aggregate before Excel: a database (SQLite reads CSV directly with .import), a few lines of Python with pandas, or the command line (split -l 1000000 file.csv part_ on macOS and Linux) cut the file into pieces Excel can open. For a one-off look at the data, the browser viewer above is faster than any of these.',
          ],
        },
        {
          heading: 'What to check before you blame the size',
          paragraphs: [
            'A file that opens in one column, or with Arabic shown as symbols, is not too big; it has the wrong separator or encoding. Those are separate problems with their own fixes: CSV opens in one column and broken Arabic in Excel. And a .csv that is really an HTML page or a ZIP (common with downloads that failed) will not open anywhere until renamed.',
          ],
          links: [
            { text: 'CSV opens in one column', path: '/csv-opens-in-one-column' },
            { text: 'broken Arabic in Excel', path: '/fix-arabic-csv-in-excel' },
          ],
        },
        {
          heading: 'Still stuck?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with the file size and row count (no personal data), and what you need from the file.`],
        },
      ],
    },
    '/json-unexpected-token': {
      published: '2026-10-22',
      updated: '2026-10-22',
      sections: [
        {
          heading: 'What the error means',
          paragraphs: [
            '"Unexpected token } in JSON at position 412", "Unexpected end of JSON input", "Unexpected token < in JSON at position 0": every one of these comes from a JSON parser that read something the format does not allow. JSON is strict. One stray comma, a comment, or a single quote is enough, and the parser stops at the first character it cannot accept, which is often one character after the real mistake.',
          ],
        },
        {
          heading: 'The five usual causes',
          paragraphs: ['Read the token in the message; it tells you which one you have:'],
          list: [
            'Unexpected token < at position 0: the text is an HTML page, not JSON. A server answered with an error or login page. Open the address in the browser and look at what it really returns.',
            'Unexpected token u at position 0: the text is the word undefined. A variable was empty before it was parsed.',
            'Unexpected end of JSON input: the text stops early, usually an empty response or a file cut off while saving.',
            'Unexpected token } or ]: a trailing comma before a closing bracket ({"a": 1,}), which JavaScript allows and JSON does not.',
            'Unexpected token \' or a letter: single quotes, unquoted keys ({name: "x"}), a comment (// or /* */), or the words True, None, NaN or Infinity, which come from Python and are not JSON.',
          ],
        },
        {
          heading: 'Find the exact spot',
          paragraphs: [
            'The position in the message counts characters from the start, which is useless in a long file. The JSON validator shows the same parser message with the line and column, and Go to error selects that place in the text. Paste the text or drop the .json file; a file with a syntax error opens too, and the error shows right away. Nothing is uploaded: the check runs in your browser.',
          ],
          links: [{ text: 'JSON validator', path: '/json-validator' }],
        },
        {
          heading: 'Fix it automatically when it is one of the usual mistakes',
          paragraphs: [
            'Press Repair. It removes comments, adds missing commas and drops trailing ones, turns single and curly quotes into double quotes, quotes bare keys, and replaces True, False, None, NaN, undefined and Infinity with their JSON equivalents, then says what it changed. Validate again to confirm. Repair does not guess at missing brackets or cut-off files; for those the line and column show where to look.',
            'Once the text is valid, the JSON formatter indents it or minifies it to one line, and the tree view shows the structure.',
          ],
          links: [{ text: 'JSON formatter', path: '/json-formatter' }],
        },
        {
          heading: 'A byte order mark at position 0',
          paragraphs: [
            'A file saved as "UTF-8 with BOM" starts with three invisible bytes. Some parsers reject them with "Unexpected token  in JSON at position 0" (the token is the invisible character). Save the file as plain UTF-8 or strip the first character. The validator reads such files, so if it validates and your program does not, the BOM is the likely difference.',
          ],
        },
        {
          heading: 'Still invalid?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and paste the error message and the ten characters around the reported line (no personal data).`],
        },
      ],
    },
    '/guides': {
      sections: [
        {
          heading: 'Guides',
          paragraphs: ['Short, practical answers to the problems people hit with CSV, Excel and JSON files, each with the free tool that fixes it in your browser:'],
          list: [
            'Why your CSV shows broken Arabic text in Excel',
            'CSV opens in one column in Excel: how to fix the delimiter',
            'CSV too big for Excel: the 1,048,576-row limit and what to do',
            'JSON "unexpected token" errors: find the line and fix it',
          ],
          links: [
            { text: 'Why your CSV shows broken Arabic text in Excel', path: '/fix-arabic-csv-in-excel' },
            { text: 'CSV opens in one column in Excel: how to fix the delimiter', path: '/csv-opens-in-one-column' },
            { text: 'CSV too big for Excel: the 1,048,576-row limit and what to do', path: '/csv-too-big-for-excel' },
            { text: 'JSON "unexpected token" errors: find the line and fix it', path: '/json-unexpected-token' },
          ],
        },
        {
          heading: 'How these guides are written',
          paragraphs: [
            'Each guide is checked against the viewers before it is published: every step names a button that exists and every limit is one that was measured. The dates under a title say when it was written and when its text last changed.',
          ],
        },
        {
          heading: 'Missing a guide?',
          paragraphs: [`Tell us which problem you hit: ${CONTACT_EMAIL}.`],
        },
      ],
    },
  },
  ar: {
    '/fix-arabic-csv-in-excel': {
      published: '2026-10-20',
      updated: '2026-10-20',
      sections: [
        {
          heading: 'كيف يبدو النص المشوّه',
          paragraphs: [
            'تصدّر تقريرًا وتفتح ملف CSV في Excel، فإذا بالعمود العربي يظهر "Ø§Ù„Ø±ÙŠØ§Ø¶" بدل "الرياض". وأحيانًا يظهر صف من علامات الاستفهام أو مربعات فارغة بدلًا من ذلك. البيانات داخل الملف سليمة في الغالب؛ كل ما في الأمر أن Excel قرأها بترميز حروف خاطئ.',
          ],
        },
        {
          heading: 'لماذا يخطئ Excel في الترميز',
          paragraphs: [
            'ملف CSV نص عادي، والنص العادي لا يحمل أي علامة تقول بأي ترميز كُتب. وتكاد كل الأنظمة اليوم تكتب UTF-8، وهو يغطي العربية وكل الكتابات الأخرى.',
            'عندما تنقر نقرًا مزدوجًا على ملف .csv لا يسألك Excel، بل يفترض صفحة الرموز القديمة لجهازك (Windows-1252 على جهاز إنجليزي، وWindows-1256 على جهاز عربي) ما لم يبدأ الملف بعلامة UTF-8 من ثلاثة بايتات تُسمى علامة ترتيب البايتات (BOM). ومعظم عمليات التصدير تُغفل هذه العلامة، فيقرأ Excel كل حرف عربي على أنه رمزان أو ثلاثة رموز لاتينية. والملفات المفصولة بعلامة جدولة (.tsv) تعاني المشكلة نفسها تمامًا.',
          ],
          links: [{ text: 'الملفات المفصولة بعلامة جدولة', path: '/tsv-viewer' }],
        },
        {
          heading: 'الحل الأول: نزّل نسخة جاهزة لبرنامج Excel (مجانًا وبلا رفع)',
          paragraphs: ['يضيف OpenAnyDoc العلامة الناقصة بدلًا عنك، والملف لا يغادر جهازك أبدًا:'],
          list: [
            'افتح عارض CSV وأفلت الملف على الصفحة. يتحقق العارض من وجود BOM ومن UTF-16 وUTF-8، ويعود إلى Windows-1256 للملفات العربية القديمة؛ ويعرض شريط الحالة أسفل الصفحة الترميز الذي وجده.',
            'إذا كان في الملف نص عربي بلا BOM، يظهر زر «نسخة Excel» في شريط الحالة. انقر عليه.',
            'تُنزَّل نسخة باسم ملفك مع إضافة «-excel»، تحمل علامة UTF-8 ونهايات أسطر Windows. انقر عليها نقرًا مزدوجًا فيعرض Excel العربية بشكل صحيح.',
          ],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'الحل الثاني: استورد الملف بدل فتحه',
          paragraphs: [
            'يقرأ Excel الترميز بشكل صحيح عندما تستورد الملف بدل النقر المزدوج: من تبويب «بيانات» اختر «الحصول على البيانات» ثم «من ملف» ثم «من نص/CSV» (في الإصدارات الأقدم: «بيانات» ثم «من نص»)، واختر الملف، واضبط «أصل الملف» على «65001: Unicode (UTF-8)» ثم حمّله. ينجح هذا في كل مرة، لكن عليك تكراره مع كل ملف، والنتيجة مصنف وليس ملف CSV نفسه.',
            'ويضيف زر التنزيل العادي في OpenAnyDoc العلامة أيضًا كلما احتوى الملف على نص بغير الإنجليزية، فأي نسخة تعدّلها هناك تُفتح في Excel بلا مشكلة. وإذا رفض Excel الملف كله لأنه يتجاوز نحو مليون صف، فإن عارض ملفات CSV الكبيرة يفتحه في المتصفح.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'الحل الثالث: اكتب الملف بالطريقة الصحيحة في المرة القادمة',
          paragraphs: [
            'إذا كان ملف CSV يُنشأ في Excel، فاستخدم «حفظ باسم» واختر «CSV UTF-8 (محدد بفواصل)»: هذه الصيغة تكتب علامة BOM. وإذا كان يأتي من كود أو أداة تصدير، فاكتب UTF-8 مع BOM للملفات التي ستُفتح في Excel، أو صدّر مصنف .xlsx بدلًا منه، فهو يخزّن ترميزه ولا يقع في هذه المشكلة أبدًا. ويمكنك التحقق من ملف XLSX في عارض Excel دون فتح برنامج Excel.',
          ],
          links: [{ text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'الحالة المعاكسة: ملف لا يقرؤه صحيحًا إلا Excel',
          paragraphs: [
            'كثير من ملفات التصدير من الأنظمة العربية القديمة مكتوبة بترميز Windows-1256 بلا أي UTF-8. يعرضها Excel على جهاز عربي بشكل سليم، بينما تفترض المتصفحات والمحررات ومعظم الأدوات الحديثة UTF-8 فتعرض رموزًا بلا معنى. يقرأ OpenAnyDoc هذا الملف بترميز Windows-1256 تلقائيًا، وإن أخطأ التخمين فاختر الترميز بنفسك من شريط الحالة. وعند التنزيل يُكتب الملف بترميز UTF-8 مع العلامة، فيُفتح بشكل صحيح في كل مكان.',
          ],
        },
        {
          heading: 'عندما تكون الحروف صحيحة والترتيب خاطئًا',
          paragraphs: [
            'إذا كانت الحروف العربية نفسها صحيحة لكن الأرقام أو الأقواس أو الكلمات الإنجليزية تقف في الجهة الخطأ، فالترميز سليم. المشكلة في اتجاه النص: اضبط الخلية أو الورقة على اليمين إلى اليسار في Excel (تخطيط الصفحة ثم «ورقة من اليمين إلى اليسار»، أو أزرار اتجاه الفقرة). أما في OpenAnyDoc فتُعرض الخلايا ذات النص العربي من اليمين إلى اليسار تلقائيًا.',
          ],
        },
        {
          heading: 'ما زال النص مشوّهًا؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف لنا ما تراه. لا ترسل الملف إن كان يحوي بيانات شخصية؛ يكفي السطر الأول عادةً.`],
        },
      ],
    },
    '/csv-opens-in-one-column': {
      published: '2026-10-22',
      updated: '2026-10-22',
      sections: [
        {
          heading: 'ما الذي تراه',
          paragraphs: [
            'تنقر نقرًا مزدوجًا على ملف .csv فيعرض Excel كل صف محشورًا في العمود A: "الاسم;المدينة;المبلغ" في خلية واحدة والفواصل ظاهرة. لا الفرز ينفع ولا المعادلات. الملف سليم؛ كل ما في الأمر أن Excel قسّمه على الحرف الخطأ.',
          ],
        },
        {
          heading: 'لماذا يضع Excel ملف CSV في عمود واحد',
          paragraphs: [
            'ملف CSV لا يحمل ترويسة تقول أي حرف يفصل بين الحقول. الاسم يقول "مفصول بفواصل"، لكن Excel لا يبحث عن الفواصل: عند النقر المزدوج يستخدم "فاصل القائمة" المضبوط في إعدادات المنطقة في Windows. وفي البلدان التي تكتب الكسور العشرية بفاصلة (معظم أوروبا وعدد من الإعدادات العربية) يكون هذا الفاصل فاصلة منقوطة، فيستقر ملف مكتوب بالفواصل في عمود واحد. ويحدث العكس أيضًا: ملف مصدَّر بالفاصلة المنقوطة يُفتح في عمود واحد على جهاز إنجليزي.',
            'والملفات المفصولة بعلامة جدولة (.tsv و.tab) أو بالخط العمودي تصطدم بالحاجز نفسه، لأن Excel لا يقسّمها إلا عبر نافذة الاستيراد.',
          ],
        },
        {
          heading: 'الحل الأول: دع العارض يكتشف الفاصل ثم نزّل نسخة يفهمها Excel',
          paragraphs: ['يقرأ OpenAnyDoc الملف في متصفحك ولا يرفع شيئًا:'],
          list: [
            'افتح عارض CSV وأفلت الملف على الصفحة. يُكتشف الفاصل (فاصلة أو فاصلة منقوطة أو علامة جدولة أو خط عمودي) تلقائيًا، ويعرض شريط الحالة أسفل الصفحة الفاصل الذي وُجد. وإن بقيت الأعمدة خاطئة فانقر على الفاصل في شريط الحالة واختر غيره.',
            'اضغط «تنزيل»، أو اختر «خيارات التنزيل» من قائمة «المزيد» لتختار الفاصل بنفسك: فاصلة منقوطة لجهاز يكتب الكسور بفاصلة، وفاصلة لجهاز يكتبها بنقطة.',
            'انقر نقرًا مزدوجًا على النسخة المنزّلة فيقسّمها Excel حيث تتوقع. ولملفات .tsv و.tab استخدم عارض TSV الذي يفعل الشيء نفسه مع علامات الجدولة.',
          ],
          links: [
            { text: 'عارض CSV', path: '/csv-viewer' },
            { text: 'عارض TSV', path: '/tsv-viewer' },
          ],
        },
        {
          heading: 'الحل الثاني: استورد الملف بدل النقر المزدوج',
          paragraphs: [
            'في Excel اذهب إلى «بيانات» ثم «الحصول على البيانات» ثم «من ملف» ثم «من نص/CSV» (في الإصدارات الأقدم: «بيانات» ثم «من نص»). تعرض المعاينة البيانات مع خانة «المحدد»: اختر فاصلة أو فاصلة منقوطة أو علامة جدولة أو حرفًا مخصصًا ثم «تحميل». يقرأ Excel الملف صحيحًا في كل مرة، لكن عليك تكرار ذلك مع كل ملف، والنتيجة مصنف وليس ملف CSV نفسه.',
            'وإذا كانت البيانات في عمود واحد أمامك بالفعل فحدّدها واذهب إلى «بيانات» ثم «تحويل النص إلى أعمدة»، واختر «محدد»، وعلّم على الفاصل، ثم «إنهاء». هذا يصلح الورقة التي أمامك دون إعادة فتح الملف.',
          ],
        },
        {
          heading: 'الحل الثالث: أخبر Excel بالفاصل داخل الملف',
          paragraphs: [
            'يحترم Excel سطرًا أولًا نصه sep=; (أو sep=, أو sep=| وهكذا). أضفه فوق صف العناوين فيقسّم Excel الملف على ذلك الحرف عند النقر المزدوج. وهي حيلة خاصة بـ Excel: البرامج الأخرى تعرض هذا السطر كبيانات، فاستخدمها للملفات المخصصة لـ Excel فقط.',
            'أما الحل الدائم لجهاز واحد فهو إعداد المنطقة: إعدادات Windows ثم «الوقت واللغة» ثم «اللغة والمنطقة» ثم «إعدادات اللغة الإدارية» ثم «إعدادات إضافية» ثم «فاصل القائمة». غيّره فقط إذا كانت كل الملفات التي تفتحها تستخدم الفاصل نفسه.',
          ],
        },
        {
          heading: 'علامات الاقتباس وفواصل الأسطر والأرقام',
          paragraphs: [
            'أي حقل يحتوي على الفاصل نفسه أو فاصل سطر أو علامة اقتباس يجب أن يُحاط بعلامتي اقتباس مزدوجتين ("الرياض، السعودية") مع مضاعفة علامات الاقتباس الداخلية. والملف الذي يلتزم بذلك ينجو مع أي من الحلول أعلاه؛ أما الذي لا يلتزم فيتعطل في العارض أيضًا، لكنه يعرض الصفوف غير المتساوية لترى أين الخلل. وفقدان الأصفار في البداية (الرموز البريدية والمعرّفات) مشكلة منفصلة: يحذفها Excel حين يظنها رقمًا، بينما يبقيها العارض كما كُتبت.',
          ],
        },
        {
          heading: 'ما زال في عمود واحد؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} والصق أول سطرين من الملف (من دون بيانات شخصية). الفاصل يظهر هناك عادةً.`],
        },
      ],
    },
    '/csv-too-big-for-excel': {
      published: '2026-10-22',
      updated: '2026-10-22',
      sections: [
        {
          heading: 'ما الذي تراه',
          paragraphs: [
            'يقول Excel «لم يتم تحميل الملف بالكامل»، أو تتوقف الورقة عند الصف 1,048,576، أو يتجمد Excel دقائق مع ملف بمئات الميغابايتات ثم يفتحه ناقص الصفوف. ملف التصدير سليم؛ هو فقط أكبر مما تتسع له ورقة عمل.',
          ],
        },
        {
          heading: 'لماذا لا يستطيع Excel فتحه',
          paragraphs: [
            'تتسع ورقة العمل لـ 1,048,576 صفًا و16,384 عمودًا على الأكثر. وملف CSV بصفوف أكثر يُقطع عند ذلك السطر، بصمت في الإصدارات القديمة ومع تحذير في الأحدث. ودون هذا الحد بكثير يبدأ الحجم نفسه بالإيذاء: ملف نصي من 300 ميغابايت يتحول إلى غيغابايتات من الخلايا في الذاكرة، فيقضي Excel دقائق في التحليل وقد تنفد ذاكرته. أما Google Sheets فيتوقف أبكر، عند 10 ملايين خلية في الجدول.',
          ],
        },
        {
          heading: 'الخيار الأول: افتحه في المتصفح واقتطع ما تحتاجه',
          paragraphs: ['يقرأ عارض ملفات CSV الكبيرة الملف على جهازك، ويرسم الصفوف الظاهرة على الشاشة فقط، ولا يرفعه أبدًا:'],
          list: [
            'أفلت الملف على تلك الصفحة. يُفتح ملف من 120,000 صف في أقل من ثانية؛ وليس للعارض حد صفوف خاص به، ويعرض الملف الذي يتجاوز 50 ميغابايت تحذيرًا أولًا لأن الحد هو ذاكرة جهازك لا الأداة.',
            'ابحث وصفِّ ورتّب كالمعتاد: تعمل التصفية على كل الصفوف، ويعرض ملخص العمود الخلايا الفارغة والقيم المختلفة ومخططًا.',
            'أبقِ الصفوف التي تحتاجها فقط: اختر «خيارات التنزيل» من قائمة «المزيد» وعلّم على «الصفوف الظاهرة فقط». والنتيجة ملف CSV يفتحه Excel بلا اعتراض.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'الخيار الثاني: حمّله في Excel من دون ورقة عمل',
          paragraphs: [
            'يستطيع Excel الاحتفاظ بأكثر من مليون صف في نموذج البيانات، لكن ليس في الخلايا. اذهب إلى «بيانات» ثم «الحصول على البيانات» ثم «من ملف» ثم «من نص/CSV»، وبدل «تحميل» اختر «تحميل إلى» وعلّم على «إنشاء اتصال فقط» و«إضافة هذه البيانات إلى نموذج البيانات». يمكنك بعدها بناء PivotTable فوق كل الصفوف، والتصفية في Power Query، وتحميل شريحة فقط إلى ورقة.',
          ],
        },
        {
          heading: 'الخيار الثالث: قسّم الملف أو لخّصه أولًا',
          paragraphs: [
            'إذا كان الهدف تقريرًا فجمّع البيانات قبل Excel: قاعدة بيانات (SQLite يقرأ CSV مباشرة بالأمر .import)، أو بضعة أسطر Python مع pandas، أو سطر الأوامر (split -l 1000000 file.csv part_ على macOS وLinux) تقطع الملف إلى أجزاء يفتحها Excel. ولإلقاء نظرة واحدة على البيانات، عارض المتصفح أعلاه أسرع من كل هذه.',
          ],
        },
        {
          heading: 'ما الذي تتحقق منه قبل أن تلوم الحجم',
          paragraphs: [
            'الملف الذي يُفتح في عمود واحد، أو تظهر فيه العربية رموزًا، ليس كبيرًا جدًا؛ بل فيه فاصل أو ترميز خاطئ. وهاتان مشكلتان منفصلتان لكل منهما حلها: ملف CSV يُفتح في عمود واحد والعربية المشوّهة في Excel. وملف .csv هو في الحقيقة صفحة HTML أو ملف ZIP (شائع مع التنزيلات التي فشلت) لن يُفتح في أي مكان حتى تعيد تسميته.',
          ],
          links: [
            { text: 'ملف CSV يُفتح في عمود واحد', path: '/csv-opens-in-one-column' },
            { text: 'العربية المشوّهة في Excel', path: '/fix-arabic-csv-in-excel' },
          ],
        },
        {
          heading: 'ما زلت عالقًا؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} مع حجم الملف وعدد صفوفه (من دون بيانات شخصية) وما تحتاجه منه.`],
        },
      ],
    },
    '/json-unexpected-token': {
      published: '2026-10-22',
      updated: '2026-10-22',
      sections: [
        {
          heading: 'ماذا يعني الخطأ',
          paragraphs: [
            '"Unexpected token } in JSON at position 412" و"Unexpected end of JSON input" و"Unexpected token < in JSON at position 0": كل رسالة من هذه تأتي من محلل JSON قرأ شيئًا لا تسمح به الصيغة. JSON صارم: فاصلة زائدة واحدة أو تعليق أو علامة اقتباس مفردة تكفي، ويتوقف المحلل عند أول حرف لا يقبله، وهو غالبًا حرف بعد الخطأ الحقيقي.',
          ],
        },
        {
          heading: 'الأسباب الخمسة المعتادة',
          paragraphs: ['اقرأ الرمز (token) في الرسالة فهو يخبرك أيها لديك:'],
          list: [
            'Unexpected token < at position 0: النص صفحة HTML وليس JSON. أجاب الخادم بصفحة خطأ أو تسجيل دخول. افتح العنوان في المتصفح وانظر ما الذي يعيده فعلًا.',
            'Unexpected token u at position 0: النص هو الكلمة undefined. كان المتغير فارغًا قبل تحليله.',
            'Unexpected end of JSON input: النص ينتهي مبكرًا، عادةً استجابة فارغة أو ملف انقطع أثناء الحفظ.',
            'Unexpected token } أو ]: فاصلة زائدة قبل قوس الإغلاق ({"a": 1,})، وهو ما يسمح به JavaScript ولا يسمح به JSON.',
            'Unexpected token \' أو حرف: علامات اقتباس مفردة، أو مفاتيح بلا اقتباس ({name: "x"})، أو تعليق (// أو /* */)، أو الكلمات True وNone وNaN وInfinity القادمة من Python وليست JSON.',
          ],
        },
        {
          heading: 'اعثر على الموضع بالضبط',
          paragraphs: [
            'الموضع في الرسالة يعدّ الحروف من بداية النص، وهو بلا فائدة في ملف طويل. يعرض مدقق JSON رسالة المحلل نفسها مع السطر والعمود، ويحدد زر «انتقل إلى الخطأ» ذلك الموضع في النص. الصق النص أو أفلت ملف .json؛ ويُفتح الملف حتى لو كان فيه خطأ في الصياغة، ويظهر الخطأ فورًا. ولا يُرفع شيء: يعمل الفحص في متصفحك.',
          ],
          links: [{ text: 'مدقق JSON', path: '/json-validator' }],
        },
        {
          heading: 'أصلحه تلقائيًا إن كان أحد الأخطاء المعتادة',
          paragraphs: [
            'اضغط «إصلاح». يزيل التعليقات، ويضيف الفواصل الناقصة ويحذف الزائدة، ويحوّل علامات الاقتباس المفردة والمنحنية إلى مزدوجة، ويقتبس المفاتيح العارية، ويستبدل True وFalse وNone وNaN وundefined وInfinity بمقابلاتها في JSON، ثم يخبرك بما غيّره. اضغط «تحقّق» مرة أخرى للتأكد. ولا يخمّن «إصلاح» الأقواس الناقصة أو الملفات المقطوعة؛ ولهذه يدلّك السطر والعمود على مكان البحث.',
            'وحين يصبح النص صالحًا، يعيد منسّق JSON إزاحته أو يصغّره إلى سطر واحد، ويعرض شكل الشجرة بنيته.',
          ],
          links: [{ text: 'منسّق JSON', path: '/json-formatter' }],
        },
        {
          heading: 'علامة ترتيب البايتات عند الموضع 0',
          paragraphs: [
            'الملف المحفوظ بصيغة "UTF-8 مع BOM" يبدأ بثلاثة بايتات غير مرئية. ترفضها بعض المحللات برسالة "Unexpected token  in JSON at position 0" (الرمز هنا هو الحرف غير المرئي). احفظ الملف بصيغة UTF-8 عادية أو احذف الحرف الأول. ويقرأ المدقق هذه الملفات، فإذا نجح التحقق هنا وفشل في برنامجك فالفرق على الأرجح هو علامة BOM.',
          ],
        },
        {
          heading: 'ما زال غير صالح؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} والصق رسالة الخطأ والحروف العشرة حول السطر المذكور (من دون بيانات شخصية).`],
        },
      ],
    },
    '/guides': {
      sections: [
        {
          heading: 'الأدلة',
          paragraphs: ['إجابات قصيرة وعملية للمشكلات التي يصطدم بها الناس مع ملفات CSV وExcel وJSON، مع الأداة المجانية التي تحلها في متصفحك:'],
          list: [
            'لماذا تظهر العربية في ملف CSV برموز غريبة في Excel',
            'ملف CSV يُفتح في عمود واحد في Excel: كيف تصلح الفاصل',
            'ملف CSV أكبر من أن يفتحه Excel: حد 1,048,576 صفًا وما تفعله',
            'أخطاء JSON "unexpected token": اعثر على السطر وأصلحه',
          ],
          links: [
            { text: 'لماذا تظهر العربية في ملف CSV برموز غريبة في Excel', path: '/fix-arabic-csv-in-excel' },
            { text: 'ملف CSV يُفتح في عمود واحد في Excel: كيف تصلح الفاصل', path: '/csv-opens-in-one-column' },
            { text: 'ملف CSV أكبر من أن يفتحه Excel: حد 1,048,576 صفًا وما تفعله', path: '/csv-too-big-for-excel' },
            { text: 'أخطاء JSON "unexpected token": اعثر على السطر وأصلحه', path: '/json-unexpected-token' },
          ],
        },
        {
          heading: 'كيف تُكتب هذه الأدلة',
          paragraphs: [
            'يُراجع كل دليل على العارضات قبل نشره: كل خطوة تسمّي زرًا موجودًا فعلًا، وكل حد هو حد قِيس بالفعل. والتاريخان تحت العنوان يقولان متى كُتب الدليل ومتى تغيّر نصه آخر مرة.',
          ],
        },
        {
          heading: 'ينقصك دليل؟',
          paragraphs: [`أخبرنا بالمشكلة التي واجهتك: ${CONTACT_EMAIL}.`],
        },
      ],
    },
  },
}
