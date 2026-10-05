export const heroTitle = 'Open and edit CSV, Excel, Word, PDF and PowerPoint files online — free, instant, private.'
export const heroSubtitle = 'Your files never leave your device.'
export const footerText = 'OpenAnyDoc is free. Your files never leave your device.'
export const pasteHint = 'You can also paste CSV text with Ctrl+V (⌘+V on a Mac).'

export const privacyText =
  'Most online viewers upload your file to a server and show you the result from there, which means a copy of your file leaves your device. OpenAnyDoc works the other way round: your browser reads the file itself and draws it on your screen. The file is never uploaded, so there is nothing for us to store, see or lose.'

export const notSupportedNote = 'Older .doc and .ppt files are not supported.'

export const features = [
  'One drop zone for every supported format.',
  'Drag and drop, click to browse, or paste CSV text.',
  'Files are read in your browser and never uploaded.',
  'CSV files: automatic delimiter detection (comma, semicolon, tab, pipe) with a manual override, a first-row-is-header toggle, column sorting and search.',
  'Large CSV files stay smooth because only the visible rows are drawn.',
  'UTF-8 (with or without a BOM), UTF-16 and Arabic text are read correctly, and Arabic cells display right-to-left.',
  'Files over 50 MB show a warning, and OpenAnyDoc still tries to open them.',
  'Light and dark themes, with keyboard-friendly controls.',
]

export const faqItems = [
  { question: 'Is OpenAnyDoc free?', answer: 'Yes.' },
  {
    question: 'Is my file uploaded anywhere?',
    answer: 'No. Your browser reads the file and shows it on your screen. It does not leave your device.',
  },
  {
    question: 'Which files can I open?',
    answer: 'CSV and text tables (.csv, .tsv, .tab, .txt), Excel (.xlsx, .xls), Word (.docx), PDF (.pdf) and PowerPoint (.pptx).',
  },
  {
    question: 'How big can a file be?',
    answer:
      "There is no fixed limit; it depends on your browser's memory. Files over 50 MB show a warning, and OpenAnyDoc still tries to open them.",
  },
  {
    question: 'Can I edit my file or save changes?',
    answer: 'No. OpenAnyDoc is a viewer. It shows your file and does not change or save it.',
  },
  {
    question: 'Which CSV delimiters are supported?',
    answer: 'Comma, semicolon, tab and pipe. OpenAnyDoc detects the delimiter automatically, and you can choose one yourself.',
  },
  {
    question: 'Does it handle Arabic text?',
    answer:
      'Yes. UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256. Arabic cells display right-to-left.',
  },
  { question: 'Do I need to install anything?', answer: 'No. It runs in your browser.' },
  {
    question: 'What happens to my file when I close the tab?',
    answer: "Nothing is kept. The file is only held in your browser's memory while the page is open.",
  },
]
