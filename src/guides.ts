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
  },
  ar: {
    '/fix-arabic-csv-in-excel': {
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
  },
}
