export const footerText = 'OpenAnyDoc is a free online file viewer and editor. Your files never leave your device.'
export const pasteHint = 'You can also paste CSV text with Ctrl+V (⌘+V on a Mac).'

export const privacyText =
  'Most online viewers upload your file to a server and show you the result from there, which means a copy of your file leaves your device. OpenAnyDoc works the other way round: your browser reads the file itself and draws it on your screen. The file is never uploaded, so there is nothing for us to store, see or lose.'

export const notSupportedNote = 'Older .doc and .ppt files are not supported.'

export const features = [
  'One free online viewer and editor for CSV, Excel (XLSX, XLS, XLSM, ODS), JSON and TXT files, with Word, PDF and PowerPoint coming.',
  'Private by design: files are read in your browser and never uploaded, so there is no account and nothing to install.',
  'Drag and drop a file, click to browse, or paste CSV text.',
  'CSV and TSV viewer: automatic delimiter detection (comma, semicolon, tab, pipe), a first-row-is-header toggle, column sorting and search.',
  'CSV editor: change cells, add or delete rows and columns, rename headers, find and replace, and clean up a column or the whole table (case, spaces, empty rows, duplicate rows), with undo and redo.',
  'Handles large CSV files smoothly, because only the visible rows are drawn, even while you edit.',
  'Excel viewer and editor: open XLSX, XLS, XLSM and ODS workbooks with sheet tabs, formatted dates, percentages and currencies, merged cells and cell styles.',
  'Edit Excel cells and formulas that recalculate as you type, insert or delete rows, columns and sheets, add links, change number and date formats and, in XLSX files, fonts, borders, colours and alignment, then save the workbook in its own format.',
  'JSON viewer, formatter and editor: explore JSON as a collapsible tree, a table (for a list of objects) or formatted code, with search and error messages that give the line and column.',
  'Edit JSON: change, add, duplicate, move or delete nodes, sort keys and lists, choose the indentation or minify, and find and replace text in values. Large JSON files are read in the background so the page stays responsive.',
  'Text file (TXT) viewer and editor: line numbers, search, font and size choices, change case, tidy spaces, sort, reverse and de-duplicate lines, choose LF or CRLF line endings and find and replace.',
  'Download what you see (your edits, the current sort and only the rows your search shows) as CSV or JSON, or copy it into Excel or Google Sheets.',
  'Reads UTF-8 (with or without a BOM), UTF-16 and Arabic text correctly, and shows Arabic cells right-to-left.',
  'Files over 50 MB show a warning, and OpenAnyDoc still tries to open them.',
  'Light and dark themes and keyboard-friendly controls.',
]

export const faqItems = [
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
    answer: 'Choose or drop your .csv, .tsv or .tab file on the CSV viewer. It opens as a searchable table with the delimiter detected automatically. Switch to Edit to change cells, rows and columns, then download the result.',
  },
  {
    question: 'How do I open and edit an Excel (XLSX) file online for free?',
    answer: 'Choose or drop an .xlsx, .xls, .xlsm or .ods file on the Excel viewer. Use the sheet tabs to move between sheets, switch to Edit to change cells and formulas (formulas recalculate as you edit), then save the workbook in its own format.',
  },
  {
    question: 'How do I view and format a JSON file online?',
    answer: 'Open your .json file on the JSON viewer. Explore it as a tree, a table or formatted code, see the line and column of any error, then format it with 2 spaces, 4 spaces or a tab, minify it, sort the keys and download it.',
  },
  {
    question: 'Which file types can I open?',
    answer: 'CSV and tab-separated tables (.csv, .tsv, .tab), plain text (.txt), JSON (.json) and Excel (.xlsx, .xls, .xlsm, .ods). Word (.docx), PDF (.pdf) and PowerPoint (.pptx) are on the way.',
  },
  {
    question: 'Can I edit my file and save the changes?',
    answer:
      'Yes, for CSV, TXT, JSON and Excel files: switch to Edit, make your changes, with undo and redo, and download a copy. The file on your device is never changed, and your edits are not saved anywhere else, so download a copy before you leave. Excel files keep their formulas, number formats and merged cells, and .xlsx files keep their bold, colours and borders; charts, images and macros are not kept, and styles are not kept in .xls, .ods and .xlsm files or in very large workbooks. Word, PDF and PowerPoint cannot be edited yet.',
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
      "There is no fixed limit; it depends on your browser's memory. Files over 50 MB show a warning, and OpenAnyDoc still tries to open them. A CSV file with 100,000 rows opens in under a second.",
  },
  { question: 'Do I need to install anything or create an account?', answer: 'No. OpenAnyDoc runs in your browser, with no install and no account.' },
  {
    question: 'What happens to my file when I close the tab?',
    answer: "Nothing is kept. The file is only held in your browser's memory while the page is open.",
  },
]
