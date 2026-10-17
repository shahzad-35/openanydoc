// The text of the About, Privacy Policy and Terms of Use pages, in English and Arabic. Each page's title, description, h1 and intro
// live in seo.ts like every other page; this holds the sections under them. Plain data with no imports, so the build script can
// read it too. The privacy and terms text are plain-language templates that have not had a legal review yet (DECISIONS.md,
// 2026-10-17): keep every sentence true to what the site does, and change them only together with the code they describe.

type Locale = 'en' | 'ar'

export const CONTACT_EMAIL = 'support@openanydoc.com'

export type InfoSection = { heading: string; paragraphs: string[]; list?: string[] }
export type InfoPageContent = { lastUpdated?: string; sections: InfoSection[] }

// Keyed by language, then by the page address, like pageSeo in seo.ts.
export const infoPages: Record<Locale, Record<string, InfoPageContent>> = {
  en: {
    '/about': {
      sections: [
        {
          heading: 'What OpenAnyDoc is',
          paragraphs: [
            'OpenAnyDoc is a free online file viewer and editor. Drop a file on the page to read it, search it, edit it and download a copy, with no sign-up and no software to install.',
          ],
        },
        {
          heading: 'Your files never leave your browser',
          paragraphs: [
            'Most online viewers upload your file to a server. OpenAnyDoc does not: your browser reads the file and draws it on your screen, and your edits stay in the page until you download them. There is nothing for us to store, see or lose.',
          ],
        },
        {
          heading: 'File types',
          paragraphs: ['Today you can open and edit:'],
          list: [
            'CSV and tab-separated files (.csv, .tsv, .tab)',
            'Excel workbooks (.xlsx, .xls, .xlsm, .ods)',
            'JSON files (.json)',
            'Plain text files (.txt)',
          ],
        },
        {
          heading: 'Coming later',
          paragraphs: ['Word (.docx), PDF and PowerPoint (.pptx) files are coming. They cannot be opened yet.'],
        },
        {
          heading: 'Languages',
          paragraphs: ['The whole site is available in English and Arabic, and Arabic text inside files is shown right to left.'],
        },
        {
          heading: 'Contact',
          paragraphs: [`Questions or feedback: ${CONTACT_EMAIL}.`],
        },
      ],
    },
    '/privacy': {
      lastUpdated: 'Last updated: 2026-10-17',
      sections: [
        {
          heading: 'Your files are never uploaded',
          paragraphs: [
            'Files you open on OpenAnyDoc are read and edited by your own browser, on your own device. They are never sent to us or to anyone else, and we cannot see them.',
          ],
        },
        {
          heading: 'Your edits stay in memory',
          paragraphs: [
            'Edits are kept in the page\'s memory until you download a copy. The original file on your device is never changed. Closing or reloading the tab discards the edits.',
          ],
        },
        {
          heading: 'No analytics, no cookies, no tracking',
          paragraphs: [
            'OpenAnyDoc has no analytics, no advertising, no cookies and no tracking of any kind. We do not record which files or file types you open.',
          ],
        },
        {
          heading: 'What your browser keeps',
          paragraphs: ['Two small settings are kept in your browser and are never sent anywhere:'],
          list: [
            'Your light or dark theme choice, kept until you clear your browser\'s site data.',
            'The order of the colours in the list of file types, kept only until you close the tab.',
          ],
        },
        {
          heading: 'Hosting',
          paragraphs: [
            'The site is hosted on Cloudflare Pages. To deliver the pages, Cloudflare\'s servers process standard request data, such as your IP address and your browser\'s user agent. We do not receive or store file data, because files never leave your browser.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [`Questions about privacy: ${CONTACT_EMAIL}.`],
        },
      ],
    },
    '/terms': {
      lastUpdated: 'Last updated: 2026-10-17',
      sections: [
        {
          heading: 'Free and as is',
          paragraphs: [
            'OpenAnyDoc is free to use. It is provided "as is", without any warranty: we do not promise that it will always be available, free of errors or right for your purpose.',
          ],
        },
        {
          heading: 'Your files are your responsibility',
          paragraphs: [
            'You are responsible for the files you open and edit, and for having the right to use them. Keep your original files: OpenAnyDoc never changes them, but a downloaded copy may not keep everything the original had.',
          ],
        },
        {
          heading: 'No liability for rendering or saving errors',
          paragraphs: [
            'A file may look different from how it looks in other software, and a saved copy may lose content or formatting. We are not liable for any loss or damage caused by how a file is shown, edited or saved.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [`Questions about these terms: ${CONTACT_EMAIL}.`],
        },
      ],
    },
  },
  ar: {
    '/about': {
      sections: [
        {
          heading: 'ما هو OpenAnyDoc',
          paragraphs: [
            'OpenAnyDoc عارض ومحرر ملفات مجاني على الإنترنت. أفلت ملفًا على الصفحة لتقرأه وتبحث فيه وتعدّله وتنزّل نسخة منه، بدون تسجيل وبدون تثبيت أي برنامج.',
          ],
        },
        {
          heading: 'ملفاتك لا تغادر متصفحك أبدًا',
          paragraphs: [
            'معظم العارضات على الإنترنت ترفع ملفك إلى خادم. أما OpenAnyDoc فلا يفعل ذلك: يقرأ متصفحك الملف ويرسمه على شاشتك، وتبقى تعديلاتك في الصفحة حتى تنزّلها. لا يوجد ما نخزّنه أو نراه أو نفقده.',
          ],
        },
        {
          heading: 'أنواع الملفات',
          paragraphs: ['يمكنك اليوم فتح وتعديل:'],
          list: [
            'ملفات CSV والملفات المفصولة بعلامة جدولة (.csv و.tsv و.tab)',
            'مصنفات Excel (.xlsx و.xls و.xlsm و.ods)',
            'ملفات JSON (.json)',
            'الملفات النصية العادية (.txt)',
          ],
        },
        {
          heading: 'قريبًا',
          paragraphs: ['ملفات وورد (.docx) وPDF وباوربوينت (.pptx) قادمة، ولا يمكن فتحها بعد.'],
        },
        {
          heading: 'اللغات',
          paragraphs: ['الموقع كله متاح بالعربية والإنجليزية، ويُعرض النص العربي داخل الملفات من اليمين إلى اليسار.'],
        },
        {
          heading: 'التواصل',
          paragraphs: [`للأسئلة والملاحظات: ${CONTACT_EMAIL}.`],
        },
      ],
    },
    '/privacy': {
      lastUpdated: 'آخر تحديث: 2026-10-17',
      sections: [
        {
          heading: 'ملفاتك لا تُرفع أبدًا',
          paragraphs: [
            'الملفات التي تفتحها في OpenAnyDoc يقرؤها ويعدّلها متصفحك أنت، على جهازك أنت. لا تُرسل إلينا ولا إلى أي جهة أخرى، ولا نستطيع رؤيتها.',
          ],
        },
        {
          heading: 'تعديلاتك تبقى في الذاكرة',
          paragraphs: [
            'تبقى التعديلات في ذاكرة الصفحة حتى تنزّل نسخة. الملف الأصلي على جهازك لا يتغير أبدًا. وإغلاق التبويب أو إعادة تحميله يتجاهل التعديلات.',
          ],
        },
        {
          heading: 'لا تحليلات ولا ملفات تعريف ارتباط ولا تتبع',
          paragraphs: [
            'لا يستخدم OpenAnyDoc أي أدوات تحليلات أو إعلانات أو ملفات تعريف ارتباط (كوكيز) أو أي نوع من التتبع. ولا نسجّل الملفات أو أنواع الملفات التي تفتحها.',
          ],
        },
        {
          heading: 'ما يحفظه متصفحك',
          paragraphs: ['يحفظ متصفحك إعدادين صغيرين، ولا يُرسلان إلى أي مكان:'],
          list: [
            'اختيارك للمظهر الفاتح أو الداكن، ويبقى حتى تمسح بيانات الموقع من متصفحك.',
            'ترتيب الألوان في قائمة أنواع الملفات، ويبقى حتى تغلق التبويب فقط.',
          ],
        },
        {
          heading: 'الاستضافة',
          paragraphs: [
            'الموقع مستضاف على Cloudflare Pages. ولتوصيل الصفحات تعالج خوادم Cloudflare بيانات الطلب المعتادة، مثل عنوان IP ووكيل المستخدم في متصفحك. ونحن لا نستقبل بيانات الملفات ولا نخزّنها، لأن الملفات لا تغادر متصفحك.',
          ],
        },
        {
          heading: 'التواصل',
          paragraphs: [`للأسئلة عن الخصوصية: ${CONTACT_EMAIL}.`],
        },
      ],
    },
    '/terms': {
      lastUpdated: 'آخر تحديث: 2026-10-17',
      sections: [
        {
          heading: 'مجاني وكما هو',
          paragraphs: [
            'استخدام OpenAnyDoc مجاني. ويُقدَّم «كما هو» دون أي ضمان: لا نعد بأن يكون متاحًا دائمًا أو خاليًا من الأخطاء أو مناسبًا لغرضك.',
          ],
        },
        {
          heading: 'ملفاتك مسؤوليتك',
          paragraphs: [
            'أنت مسؤول عن الملفات التي تفتحها وتعدّلها، وعن امتلاكك حق استخدامها. احتفظ بملفاتك الأصلية: OpenAnyDoc لا يغيّرها أبدًا، لكن النسخة المنزّلة قد لا تحتفظ بكل ما كان في الأصل.',
          ],
        },
        {
          heading: 'لا مسؤولية عن أخطاء العرض أو الحفظ',
          paragraphs: [
            'قد يبدو الملف مختلفًا عمّا يبدو عليه في برامج أخرى، وقد تفقد النسخة المحفوظة بعض المحتوى أو التنسيق. ولسنا مسؤولين عن أي خسارة أو ضرر ينتج عن طريقة عرض الملف أو تعديله أو حفظه.',
          ],
        },
        {
          heading: 'التواصل',
          paragraphs: [`للأسئلة عن هذه الشروط: ${CONTACT_EMAIL}.`],
        },
      ],
    },
  },
}
