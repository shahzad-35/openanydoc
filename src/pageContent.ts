// What each format page says beyond the hero: numbered steps for opening and editing a file ("How it works"), a short list of what
// the viewer handles, and questions people really ask about that file type (the seven shared questions first, answered for that
// format), in English and Arabic (with answers that match what the viewer does). It replaces the shared features and FAQ blocks on a format page,
// so every page has text of its own. Landing pages (/json-formatter ...) have only questions about their own job, none shared. Plain data with no imports, because scripts/build-static-pages.mjs also reads it to write
// the same text, and the same questions as FAQPage data, into each page's static HTML. Keep the answers true: only what is built.

export type GuideStep = { title: string; text: string }
// `link`: a phrase of the answer that becomes a link to another page; the FAQPage data keeps the plain answer.
export type GuideQuestion = { question: string; answer: string; link?: { text: string; path: string } }
type Locale = 'en' | 'ar'

export type FormatGuide = { stepsTitle: string; steps: GuideStep[]; handlesTitle: string; handles: string[]; faqTitle: string; faq: GuideQuestion[] }

// The "Related tools" links at the end of each format and landing page: other live pages a visitor of that page may want next.
// Keyed by the page's address; the link text is each page's `linkText` in seo.ts, in the page's language.
export const relatedPages: Record<string, string[]> = {
  '/csv-viewer': ['/tsv-viewer', '/large-csv-viewer', '/excel-viewer', '/fix-arabic-csv-in-excel'],
  '/tsv-viewer': ['/csv-viewer', '/large-csv-viewer', '/excel-viewer', '/fix-arabic-csv-in-excel'],
  '/large-csv-viewer': ['/csv-viewer', '/tsv-viewer', '/excel-viewer'],
  '/excel-viewer': ['/xls-viewer', '/csv-viewer'],
  '/xls-viewer': ['/excel-viewer', '/csv-viewer'],
  '/json-viewer': ['/json-formatter', '/json-validator', '/csv-viewer'],
  '/json-formatter': ['/json-validator', '/json-viewer'],
  '/json-validator': ['/json-formatter', '/json-viewer'],
  '/txt-viewer': ['/csv-viewer', '/json-viewer'],
}

// Keyed by language, then by the format or landing page's address, like pageSeo in seo.ts. Both languages have the same steps and questions in the same order.
export const formatGuides: Record<Locale, Record<string, FormatGuide>> = {
  en: {
    '/csv-viewer': {
      stepsTitle: 'How it works: open and edit a CSV file online',
      steps: [
        { title: 'Drop your file on the page', text: 'Drop a .csv, .tsv or .tab file on the page, or choose it from your device. It is read in your browser and never uploaded.' },
        { title: 'Check the columns', text: 'The delimiter (comma, semicolon, tab or pipe) and the encoding are detected for you. If the columns look wrong, click the delimiter in the status bar at the bottom to pick another one, or turn "First row is header" on or off.' },
        { title: 'Search, filter and sort', text: 'Type in the search box (press / to jump to it) to find rows in every column. Use Filter, or the menu in a column header, to keep only the rows you need, and Shift+click column headers to sort by one or more columns. Click a header to see that column\'s profile: blanks, distinct values, numbers and a chart.' },
        { title: 'Edit and clean up', text: 'Every cell can be edited: click it and type, or paste cells copied from a spreadsheet. Add or delete rows and columns, use Find & replace, or open Clean up to change case, trim spaces, fill down blanks, split or merge columns, remove duplicate rows or transpose the table. Undo and redo are always there.' },
        { title: 'Download your CSV', text: 'Click Download to save every row with the file\'s own delimiter, or choose "Download options" in the More menu to change the delimiter, quotes or line endings, or to keep only the filtered rows. The original file on your device is never changed.' },
      ],
      handlesTitle: 'What the CSV file reader handles: CSV, TSV and tab files',
      handles: [
        'Files: .csv, .tsv and .tab, with the delimiter (comma, semicolon, tab or pipe) detected for you.',
        'Encodings: UTF-8 with or without a BOM, UTF-16, and Windows-1256 for older Arabic files, so Arabic text shows correctly and right to left.',
        'Size: no row limit of its own; a 120,000-row file opens in under a second, and files over 50 MB show a warning first.',
        'Editing: cells, rows and columns, find and replace, clean-up tools, filters, sorting and column profiles, with undo and redo.',
        'Saving: a CSV with the file\'s own delimiter, or your choice of delimiter, quotes and line endings; leading zeros and long numbers stay as written.',
      ],
      faqTitle: 'CSV viewer online: common questions',
      faq: [
        {
          question: 'Is my file uploaded?',
          answer: 'No. Your browser reads the CSV file itself and draws the table on your screen. Nothing is sent to a server, so the file never leaves your device.',
        },
        {
          question: 'Can I edit and save it?',
          answer: 'Yes. Edit cells, add or delete rows and columns, find and replace or clean up the data, then click Download to save a CSV with the file\'s own delimiter, or pick another delimiter, quotes or line endings in Download options.',
        },
        {
          question: 'Is the original changed?',
          answer: 'No. Your edits stay in the page\'s memory until you download a copy, and the file on your device is never touched. Closing the tab discards the edits; if there are unsaved ones, the browser asks first.',
        },
        {
          question: 'Is there a file size limit?',
          answer: 'There is no fixed limit: the limit is your browser\'s memory, so you can view large CSV files. A 120,000-row file opens in under a second, because only the rows on screen are drawn, and files over 50 MB show a warning but still open if memory allows. Unlike Excel, which stops at 1,048,576 rows per sheet, the CSV viewer has no row limit of its own.',
        },
        {
          question: 'Does it work on mobile?',
          answer: 'Yes. The CSV page has its own phone layout, with the tools in a menu and the table scrolling sideways, so you can view and edit a CSV file in a phone browser.',
        },
        {
          question: 'Does it work offline?',
          answer: 'Once the page and its CSV viewer have loaded, opening and editing files need no network. It is not an installable offline app, though: the page has to be loaded online first.',
        },
        {
          question: 'Can my company host its own copy?',
          answer: 'Not at the moment: OpenAnyDoc is only offered at openanydoc.com, and no licence for running your own copy is available yet. If your company needs this, write to support@openanydoc.com.',
        },
        {
          question: 'Why does my CSV file open in a single column?',
          answer: 'The file probably uses a different separator from the comma, such as a semicolon, which is common in files saved by Excel in many countries. OpenAnyDoc detects comma, semicolon, tab and pipe automatically, and you can choose the delimiter yourself by clicking it in the status bar at the bottom of the page.',
        },
        {
          question: 'How do I open a CSV file with Arabic or other non-English text?',
          answer: 'Just open it: UTF-8 (with or without a BOM) and UTF-16 files are read directly, and a file that is not valid UTF-8 is read as Windows-1256, the old Arabic encoding. Arabic cells display right-to-left. When you download, a byte order mark is added if the file has non-English text, so Excel shows it correctly. For the Excel side of the problem, read Fix broken Arabic in a CSV.',
          link: { text: 'Fix broken Arabic in a CSV', path: '/fix-arabic-csv-in-excel' },
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
          question: 'Can I open a TSV file online and edit it?',
          answer: 'Yes. .tsv and .tab files open tab-separated, with the header row detected, and you can edit and download them the same way as a CSV file.',
        },
      ],
    },
    '/excel-viewer': {
      stepsTitle: 'How it works: view an Excel file in your browser and edit it',
      steps: [
        { title: 'Drop your workbook on the page', text: 'Choose an .xlsx, .xls, .xlsm or .ods file. It is read in your browser and never uploaded.' },
        { title: 'Move between sheets', text: 'Every sheet is a tab at the bottom, like in Excel. Dates, percentages and currencies are shown as formatted in the file, and merged cells are drawn as one cell.' },
        { title: 'Switch to Edit', text: 'Click a cell and type a value, or a formula such as =SUM(B2:B10). Formulas recalculate as you edit, and the cells that depend on them update.' },
        { title: 'Format your data', text: 'Use the toolbar to change number formats and currencies, insert or delete rows, columns and sheets, merge cells and, in .xlsx files, set bold, colours, fonts and borders.' },
        { title: 'Save the workbook', text: 'Use the save icon to download the workbook in the same format. The original file on your device is never changed.' },
      ],
      handlesTitle: 'What the free XLSX viewer handles: XLSX, XLS, XLSM and ODS',
      handles: [
        'Files: .xlsx, .xls (Excel 97 to 2003), .xlsm (macro-enabled) and .ods (OpenDocument), with every sheet. Password-protected workbooks cannot be opened.',
        'Display: number, date, percentage and currency formats and merged cells; fonts, colours and fills in .xlsx and .xlsm files up to 8 MB.',
        'Editing: values and formulas that recalculate, rows, columns and sheets, merged cells and number formats; in .xlsx files also bold, italic, colours, fills and alignment.',
        'Kept on save: values, formulas with their results, number formats, merged cells and column widths, in the file\'s own format. Cell styles are saved only in .xlsx files.',
        'Not kept on save: charts, images, pivot tables, conditional formats, data validation, defined names and macros.',
        'Size: no fixed limit; files over 50 MB show a warning first, and cell styles are read only for files up to 8 MB.',
      ],
      faqTitle: 'Excel viewer online: common questions',
      faq: [
        {
          question: 'Is my file uploaded?',
          answer: 'No. Your browser reads the workbook itself and draws the sheets on your screen. Nothing is sent to a server, so the file never leaves your device.',
        },
        {
          question: 'Can I edit and save it?',
          answer: 'Yes. Switch to Edit to change cells and formulas, insert or delete rows, columns and sheets, merge cells and change number formats, then save the workbook in its own format: .xlsx, .xls, .xlsm or .ods.',
        },
        {
          question: 'Is the original changed?',
          answer: 'No. Your edits stay in the page\'s memory until you download a copy, and the file on your device is never touched. Closing the tab discards the edits; if there are unsaved ones, the browser asks first.',
        },
        {
          question: 'Is there a file size limit?',
          answer: 'There is no fixed limit: the limit is your browser\'s memory. A sheet with 100,000 rows opens in about two seconds, and files over 50 MB show a warning first. Cell styles are read only for files up to 8 MB, so larger workbooks open as values and formulas.',
        },
        {
          question: 'Does it work on mobile?',
          answer: 'Yes. The Excel page adapts to a phone screen, so you can open, view and edit a workbook in a phone browser. Big sheets are easier to work with on a larger screen.',
        },
        {
          question: 'Does it work offline?',
          answer: 'Once the page and its Excel viewer have loaded, opening and editing files need no network. It is not an installable offline app, though: the page has to be loaded online first.',
        },
        {
          question: 'Can my company host its own copy?',
          answer: 'Not at the moment: OpenAnyDoc is only offered at openanydoc.com, and no licence for running your own copy is available yet. If your company needs this, write to support@openanydoc.com.',
        },
        {
          question: 'How do I open an XLSX file online without Excel?',
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
          question: 'Can I open an old .xls file or an .ods spreadsheet online?',
          answer: 'Yes. .xls (Excel 97 to 2003), .xlsm (macro-enabled) and .ods (OpenDocument, from LibreOffice) files open the same way as .xlsx, and are saved back in their own format.',
        },
        {
          question: 'Can I open a password-protected Excel file?',
          answer: 'No. Encrypted workbooks cannot be opened, because the file has to be read in your browser without sending it anywhere. Remove the password in Excel first, then open the file here.',
        },
      ],
    },
    '/json-viewer': {
      stepsTitle: 'How it works: open a JSON file online, format and edit it',
      steps: [
        { title: 'Drop, paste or try a sample', text: 'Choose or drop a .json file, paste JSON with Ctrl+V, or try the sample. It is read in your browser, so API responses, configuration files and other private data are never uploaded.' },
        { title: 'Text and tree side by side', text: 'The text sits next to a collapsible tree (or a table for a list of objects) and an inspector; selecting a node in one shows it in the other. Search keys and values, or type a path such as $.orders[*].total.' },
        { title: 'Validate and repair', text: 'Validate shows the result with the size, keys, values and depth. If the JSON is not valid you see the line and column, and Repair fixes comments, trailing or missing commas, single quotes and unquoted keys.' },
        { title: 'Format and edit', text: 'Type in the text, or use the tree and the inspector. Format with 1, 2, 3, 4 or 8 spaces or a tab, minify, sort keys, and change, add, duplicate, move or delete nodes. Long numbers are kept exactly.' },
        { title: 'Download your JSON', text: 'Use the Download button to save the result. The original file on your device is never changed.' },
      ],
      handlesTitle: 'What the JSON tree viewer handles: files and pasted JSON',
      handles: [
        'Input: .json files, or JSON pasted with Ctrl+V; a list of objects can also be shown as a table.',
        'Size: up to 10 MB; larger files are refused before they are read. Above 5 MB the text pane starts closed.',
        'Numbers: integers longer than JavaScript can hold (beyond 2^53) are kept exactly.',
        'Errors: the line and column of the problem, and Repair for comments, trailing or missing commas, single quotes and unquoted keys.',
        'Editing: in the text or the tree; change, add, duplicate, move or delete nodes, format with 1 to 8 spaces or a tab, minify and sort keys, with undo.',
        'Saving: a .json file in the layout you chose.',
      ],
      faqTitle: 'JSON viewer online: common questions',
      faq: [
        {
          question: 'Is my file uploaded?',
          answer: 'No. Your browser reads and checks the JSON itself, and pasted JSON stays in the page too. Nothing is sent to a server, which makes it suitable for API responses, tokens and internal configuration.',
        },
        {
          question: 'Can I edit and save it?',
          answer: 'Yes. Type in the text or edit the tree: change, add, duplicate, move or delete nodes, format, minify or sort keys, then press Download to save a .json file.',
        },
        {
          question: 'Is the original changed?',
          answer: 'No. Your edits stay in the page\'s memory until you download a copy, and the file on your device is never touched. Closing the tab discards the edits; if there are unsaved ones, the browser asks first.',
        },
        {
          question: 'Is there a file size limit?',
          answer: 'Yes: JSON files up to 10 MB open, and larger files are refused before they are read, because every edit would make the page slow. A file of that size shows its tree in under a second; above 5 MB the text pane starts closed and opens with "Show the text".',
        },
        {
          question: 'Does it work on mobile?',
          answer: 'Yes. On a phone the JSON page switches to Text, Tree and Inspector tabs instead of side-by-side panes, with the main actions in a bar at the bottom.',
        },
        {
          question: 'Does it work offline?',
          answer: 'Once the page and its JSON viewer have loaded, opening and editing files need no network. It is not an installable offline app, though: the page has to be loaded online first.',
        },
        {
          question: 'Can my company host its own copy?',
          answer: 'Not at the moment: OpenAnyDoc is only offered at openanydoc.com, and no licence for running your own copy is available yet. If your company needs this, write to support@openanydoc.com.',
        },
        {
          question: 'How do I format, beautify or pretty print JSON online?',
          answer: 'Open your file and press Format, the JSON beautifier, or choose 1, 2, 3, 4 or 8 spaces or Tab from the menu next to it. The text shows the formatted result and the download uses the same layout.',
        },
        {
          question: 'How do I minify JSON?',
          answer: 'Press Minify. All spaces and line breaks outside strings are removed, which makes the file smaller.',
        },
        {
          question: 'Can it validate JSON and show where the error is?',
          answer: 'When the JSON is not valid, OpenAnyDoc shows what is wrong with the line and column number, and "Go to error" selects the place in the text. Repair fixes the usual hand-written mistakes (comments, trailing or missing commas, single quotes, unquoted keys, True, None and NaN) and says what it changed.',
        },
        {
          question: 'Can I sort the keys of a JSON object alphabetically?',
          answer: 'Yes. Press Sort keys: the keys of every object, including the objects nested inside, are put in order from A to Z. Undo takes it back.',
        },
      ],
    },
    '/txt-viewer': {
      stepsTitle: 'How it works: open TXT file online and edit it',
      steps: [
        { title: 'Drop your .txt file on the page', text: 'Choose or drop a text file, such as notes, a log or a list. It is read in your browser, never uploaded, and opens ready to edit.' },
        { title: 'Type, or pick a tool from the ribbon', text: 'Type in the text, or open a tab (Lines, Clean, Case, Find, Analyze, View, File) and click a tool: sort, de-duplicate, number or join lines, trim spaces, change case. With text selected, a tool changes only the selected lines. Each tool is one undo step.' },
        { title: 'Find, replace and check', text: 'Press Ctrl+F (or /) to find and replace, with match case, whole word and regular expressions. Statistics count words, sentences and reading time, and Compare shows every change against the original file.' },
        { title: 'See what is hidden', text: 'Show hidden characters to spot tabs, trailing spaces, zero-width characters and line endings, then remove them with the Clean tools. Bookmarks and Go to line help in long files.' },
        { title: 'Download your text file', text: 'Click Download and choose UTF-8, UTF-8 with BOM, UTF-16 or Windows-1256, and LF, CRLF or CR line endings. The original file on your device is never changed.' },
      ],
      handlesTitle: 'What the text file viewer handles: TXT files',
      handles: [
        'Files: plain text .txt files, such as notes, logs and lists.',
        'Encodings: UTF-8 with or without a BOM, UTF-16, and Windows-1256 for older Arabic text; you can reopen a file with another encoding, and each line shows in its own reading direction.',
        'Size: a 46 MB text file has been tested; files over 50 MB show a warning first, and above about 2 million characters the file opens in a fast read view.',
        'Editing: typing, plus tools for sorting, duplicates, numbering, whitespace and case, find and replace with regular expressions, statistics and compare.',
        'Saving: UTF-8, UTF-8 with BOM, UTF-16 or Windows-1256, with LF, CRLF or CR line endings.',
      ],
      faqTitle: 'Online text editor: common questions',
      faq: [
        {
          question: 'Is my file uploaded?',
          answer: 'No. Your browser reads the text file itself and shows it on your screen. Nothing is sent to a server, so the file never leaves your device.',
        },
        {
          question: 'Can I edit and save it?',
          answer: 'Yes. The file opens ready to edit: type, or use the ribbon tools for lines, whitespace and case, then click Download and choose the encoding (UTF-8, UTF-8 with BOM, UTF-16 or Windows-1256) and the line endings (LF, CRLF or CR).',
        },
        {
          question: 'Is the original changed?',
          answer: 'No. Your edits stay in the page\'s memory until you download a copy, and the file on your device is never touched. Closing the tab discards the edits; if there are unsaved ones, the browser asks first.',
        },
        {
          question: 'Is there a file size limit?',
          answer: 'There is no fixed limit: the limit is your browser\'s memory, and files over 50 MB show a warning first. A 46 MB text file shows its first lines in under half a second. A file over about 2 million characters opens in a fast read view that draws only the visible lines, and every tool still works on the whole text. Choose Edit anyway to type in it; typing in a very large file is slower.',
        },
        {
          question: 'Does it work on mobile?',
          answer: 'Yes. On a phone the ribbon becomes a tools sheet and the text fills the screen, so you can read and edit text files in a phone browser.',
        },
        {
          question: 'Does it work offline?',
          answer: 'Once the page and its text viewer have loaded, opening and editing files need no network. It is not an installable offline app, though: the page has to be loaded online first.',
        },
        {
          question: 'Can my company host its own copy?',
          answer: 'Not at the moment: OpenAnyDoc is only offered at openanydoc.com, and no licence for running your own copy is available yet. If your company needs this, write to support@openanydoc.com.',
        },
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
      ],
    },
    '/json-formatter': {
      stepsTitle: 'How it works: format JSON in a few steps',
      steps: [
        { title: 'Paste or open your JSON', text: 'Press Ctrl+V anywhere on this page to paste JSON, or drop a .json file. Try a sample JSON if you just want to see it work.' },
        { title: 'Pick the indentation', text: 'Open the menu next to Format and choose 1, 2, 3, 4 or 8 spaces or a tab. Format pretty prints the whole document with it.' },
        { title: 'Minify or sort keys if you need to', text: 'Minify removes every space and line break outside strings and shows how much smaller the file became. Sort keys puts the keys of every object in order from A to Z.' },
        { title: 'Copy or download', text: 'Copy formatted or Copy minified puts the result on your clipboard; Download saves a .json file in the layout you chose.' },
      ],
      handlesTitle: 'What the JSON beautifier handles',
      handles: [
        'Indentation: 1, 2, 3, 4 or 8 spaces, or a tab.',
        'Minify: one line, with the size before and after.',
        'Sort keys: A to Z in every object, nested ones included, as one undo step.',
        'Long numbers: integers beyond 2^53 are written back exactly as they were, not rounded.',
        'Input: pasted JSON or a .json file up to 10 MB.',
      ],
      faqTitle: 'JSON formatter: questions and answers',
      faq: [
        {
          question: 'What is the difference between formatting and minifying JSON?',
          answer: 'Formatting, or pretty printing, puts each key and value on its own indented line so people can read it. Minifying removes all spaces and line breaks outside strings, so the file is as small as possible. The data is the same either way.',
        },
        {
          question: 'Which indentation should I use to pretty print JSON?',
          answer: 'Two spaces is the most common choice and the default here. Four spaces is common in some code styles, and a tab lets each reader\'s editor choose the width. The formatter offers 1, 2, 3, 4 and 8 spaces and tab.',
        },
        {
          question: 'Will formatting change my numbers or the order of keys?',
          answer: 'No. Format and Minify only change spaces and line breaks. Keys keep their order unless you press Sort keys, and integers too long for JavaScript are kept digit for digit.',
        },
        {
          question: 'Can I format JSON that has an error in it?',
          answer: 'Not until the error is fixed, because formatting needs valid JSON. The page shows the line and column of the problem, and Repair fixes common mistakes such as trailing commas, comments and single quotes; then Format works.',
        },
        {
          question: 'Is it safe to format JSON with API keys or tokens in it?',
          answer: 'The JSON is formatted inside your browser and is not uploaded or stored anywhere, so tokens and internal settings stay on your device.',
        },
        {
          question: 'How large a JSON file can I format?',
          answer: 'Up to 10 MB. Larger files are refused before they are read, because every action on them would be slow.',
        },
      ],
    },
    '/json-validator': {
      stepsTitle: 'How it works: validate JSON and fix errors',
      steps: [
        { title: 'Paste or open the JSON', text: 'Press Ctrl+V on this page or drop a .json file. A file with a syntax error opens too, and the error shows right away.' },
        { title: 'Press Validate', text: 'Press Validate (Ctrl+Enter, or ⌘+Enter on a Mac). Valid JSON shows its size and how many keys and values it has, and how deep it goes.' },
        { title: 'Go to the error', text: 'Invalid JSON shows the parser\'s message with the line and column. Go to error selects that place in the text so you can fix it by hand.' },
        { title: 'Repair common mistakes', text: 'Repair fixes comments, trailing or missing commas, single and curly quotes, unquoted keys and the words True, False, None and NaN, then says what it changed. Validate again to confirm.' },
      ],
      handlesTitle: 'What the JSON syntax checker looks at',
      handles: [
        'Syntax: standard JSON, checked with your browser\'s own JSON parser.',
        'Error location: the parser\'s message with the line and column, and Go to error.',
        'Repair: comments, trailing and missing commas, single and curly quotes, unquoted keys, and True, False, None, NaN, undefined and Infinity.',
        'Not checked: JSON Schema. The validator checks the syntax, not whether the data matches a schema.',
        'Size: files up to 10 MB.',
      ],
      faqTitle: 'JSON validator: questions and answers',
      faq: [
        {
          question: 'How do I check if my JSON is valid?',
          answer: 'Paste it on this page or open the file, then press Validate. "Valid JSON" means any standard parser can read it; otherwise the message, line and column show what to fix.',
        },
        {
          question: 'Why is my JSON invalid?',
          answer: 'The usual causes are a comma after the last item, comments, single quotes instead of double quotes, keys without quotes, and values such as True, None or NaN copied from Python or JavaScript. Standard JSON allows none of these, and Repair fixes all of them.',
        },
        {
          question: 'Does it validate against a JSON Schema?',
          answer: 'No. It checks that the text is well-formed JSON. It does not compare the data with a JSON Schema.',
        },
        {
          question: 'What does Repair change, and can I undo it?',
          answer: 'Only the mistakes listed in its message, and never the text inside strings. If you do not like the result, press Undo. If something else is still wrong, that error is shown with its place.',
        },
        {
          question: 'Is my JSON sent anywhere to be validated?',
          answer: 'No. Validation runs with your browser\'s own JSON parser on your device, and nothing is sent to a server.',
        },
        {
          question: 'Can it validate large JSON files?',
          answer: 'Yes, up to 10 MB. Larger files are refused before they are read.',
        },
      ],
    },
    '/tsv-viewer': {
      stepsTitle: 'How it works: open a TSV file online',
      steps: [
        { title: 'Drop a .tsv or .tab file', text: 'Choose the file or drop it anywhere on the page. It opens with tab as the separator, read in your browser and never uploaded.' },
        { title: 'Check the header row', text: 'Whether the first row holds column names is worked out from how the rows look. If that is wrong, click the delimiter in the status bar at the bottom and turn "First row is header" on or off.' },
        { title: 'Search, filter and sort', text: 'Search every column, add filters, and Shift+click column headers to sort by more than one column.' },
        { title: 'Edit and download', text: 'Edit cells, rows and columns, then press Download: the file is saved with tabs again, with its own line endings.' },
      ],
      handlesTitle: 'What the TSV file viewer handles',
      handles: [
        'Files: .tsv and .tab, read with tab as the separator.',
        'Header row: worked out from the data, and you can switch it.',
        'Quoted values: read the way Excel and Google Sheets write them, so a tab or line break inside quotes stays in one cell.',
        'Encodings: UTF-8, UTF-16 and Windows-1256 for older Arabic files.',
        'Saving: tab-separated again with the file\'s line endings; Download options set quotes and line endings or keep only the filtered rows.',
      ],
      faqTitle: 'TSV files: questions and answers',
      faq: [
        {
          question: 'What is a TSV file?',
          answer: 'A TSV (tab-separated values) file is a plain text table: one row per line, with a tab between the columns. Databases, spreadsheets and many data tools export it, because tabs rarely appear inside values.',
        },
        {
          question: 'How do I open a TSV file online?',
          answer: 'Drop the .tsv file on this page or choose it with the button. It opens as a table in your browser, without Excel and without uploading it.',
        },
        {
          question: 'What is the difference between TSV and CSV?',
          answer: 'Both are plain text tables. CSV separates columns with commas (or semicolons in many countries), TSV with tabs. TSV needs quotes less often, because values rarely contain tabs.',
        },
        {
          question: 'Can I edit a TSV file and keep it as TSV?',
          answer: 'Yes. Edit cells, add or delete rows and columns, then press Download: the file is written with tabs, as it came.',
        },
        {
          question: 'My .txt file is tab-separated. Can I open it here?',
          answer: 'This page opens .tsv and .tab files. A .txt file opens in the TXT editor as text; rename it to .tsv to see it as a table.',
        },
        {
          question: 'Does the TSV viewer handle large files?',
          answer: 'Yes. It uses the same table as the CSV viewer, where a 120,000-row file opened in under a second in our tests. Files over 50 MB show a warning first.',
        },
      ],
    },
    '/large-csv-viewer': {
      stepsTitle: 'How it works: view a large CSV file',
      steps: [
        { title: 'Drop the big file', text: 'Choose or drop the .csv, .tsv or .tab file. Files over 50 MB show a warning that they may be slow, and still open if your browser has the memory.' },
        { title: 'Scroll the whole table', text: 'Only the rows on screen are drawn, so scrolling stays smooth however many rows the file has.' },
        { title: 'Find the rows you need', text: 'Search every column, add filters, or sort by one or more columns. Group by shows counts, sums or averages by a column.' },
        { title: 'Save a smaller file', text: 'Download options in the More menu can keep only the filtered rows, so you can cut a big export down to the part you need.' },
      ],
      handlesTitle: 'What the big CSV viewer handles',
      handles: [
        'Rows: no row limit of its own; the limit is your browser\'s memory. Excel stops at 1,048,576 rows per sheet.',
        'Measured on a 120,000-row file: open 0.9 s, sort by two columns 0.9 s, search 0.4 s, filter 0.1 s, download 0.4 s.',
        'Files over 50 MB: a warning first, then the file still opens if memory allows.',
        'Column profile: blanks, distinct values, numbers and a chart for the selected column.',
        'Encodings: UTF-8, UTF-16 and Windows-1256.',
      ],
      faqTitle: 'Large CSV files: questions and answers',
      faq: [
        {
          question: 'How do I open a CSV file that is too large for Excel?',
          answer: 'Excel shows at most 1,048,576 rows per sheet and leaves out the rest. Drop the file here instead: this viewer has no row limit of its own, only your browser\'s memory. The largest file we have measured has 120,000 rows, so try yours and watch for the 50 MB warning.',
        },
        {
          question: 'How fast does a large CSV file open?',
          answer: 'In our tests a 120,000-row file with 8 columns opened in 0.9 seconds, a sort by two columns took 0.9 s, a search 0.4 s and a filter 0.1 s. Times depend on your device.',
        },
        {
          question: 'What happens with a CSV file over 50 MB?',
          answer: 'You see a warning that it may be slow or run out of memory, and the viewer still tries to open it. How far it gets depends on your browser and your device\'s memory.',
        },
        {
          question: 'Can I cut a big CSV down to the rows I need?',
          answer: 'Yes. Filter or search for the rows, then choose Download options in the More menu and keep only the filtered rows. The original file is not changed.',
        },
        {
          question: 'Why does a large CSV scroll smoothly here?',
          answer: 'Only the rows on screen, and a few around them, exist in the page at any time; the rest are drawn as you scroll. Search and sort work on lists of row numbers, not copies of the rows.',
        },
        {
          question: 'Is a large CSV file uploaded to a server to open it?',
          answer: 'No. Even a big file is read by your browser on your device, so there is no upload to wait for, and the limit is your device\'s memory.',
        },
      ],
    },
    '/xls-viewer': {
      stepsTitle: 'How it works: open an XLS file online',
      steps: [
        { title: 'Drop the .xls file', text: 'Choose the file or drop it on the page. It is read in your browser and never uploaded. For .xlsx, .xlsm and .ods files, use the Excel viewer.' },
        { title: 'Look through the sheets', text: 'Each sheet is a tab at the bottom. Dates, percentages and currencies show as formatted in the file, and merged cells are drawn as one cell.' },
        { title: 'Edit values and formulas', text: 'Switch to Edit and type values or formulas such as =SUM(B2:B10); formulas recalculate as you edit. Insert or delete rows, columns and sheets.' },
        { title: 'Save as .xls', text: 'The save icon downloads an .xls file again. Keep your original: some parts of an .xls file are not written back (see below).' },
      ],
      handlesTitle: 'What the XLS file viewer handles, and what it does not',
      handles: [
        'Files: .xls (Excel 97 to 2003). Password-protected workbooks cannot be opened.',
        'Shown: values, formulas with their results, number and date formats, merged cells and every sheet.',
        'Not shown: fonts, colours, fills and borders. Cell styles are read only from .xlsx and .xlsm files, so the style buttons are off for .xls.',
        'Kept on save: values, formulas with their results, number formats, merged cells and column widths, as .xls.',
        'Not kept on save: cell styles, charts, images, pivot tables, conditional formats, data validation, defined names and macros. Keep your original file.',
      ],
      faqTitle: 'XLS files: questions and answers',
      faq: [
        {
          question: 'What is an XLS file?',
          answer: 'XLS is the workbook format of Excel 97 to 2003, used before .xlsx arrived with Excel 2007. Many old reports, archives and exports from older systems are still .xls files.',
        },
        {
          question: 'How do I open an XLS file without Excel?',
          answer: 'Drop it on this page. It opens in your browser with all its sheets, and you can read, edit and save it without installing Excel or creating an account.',
        },
        {
          question: 'Why don\'t I see the colours and fonts of my .xls file?',
          answer: 'This viewer reads cell styles only from .xlsx and .xlsm files. In an .xls file you see the values, formulas, number formats and merged cells, but not fonts, colours, fills or borders.',
        },
        {
          question: 'Will saving an .xls file here lose anything?',
          answer: 'Yes, some things. Values, formulas, number formats, merged cells and column widths are written back, but cell styles, charts, images, pivot tables, conditional formats, data validation, defined names and macros are not. The saved file is a new copy; your original is not changed.',
        },
        {
          question: 'Can I convert XLS to XLSX here?',
          answer: 'No. Saving keeps the file\'s own format, so an .xls file is saved as .xls.',
        },
        {
          question: 'Do the formulas in an XLS file still work?',
          answer: 'Yes. Formulas show their saved results, and after you edit a cell the formulas that depend on it are recalculated, for common functions such as SUM, IF, VLOOKUP and INDEX/MATCH. A formula with a function that is not supported keeps its saved result.',
        },
      ],
    },
  },
  ar: {
    '/csv-viewer': {
      stepsTitle: 'كيف يعمل: فتح ملف CSV وتعديله اون لاين',
      steps: [
        { title: 'أفلت ملفك على الصفحة', text: 'أفلت ملف .csv أو .tsv أو .tab على الصفحة، أو اخترْه من جهازك. يُقرأ الملف داخل متصفحك ولا يُرفع أبدًا.' },
        { title: 'تحقق من الأعمدة', text: 'يُكتشف الفاصل (فاصلة، فاصلة منقوطة، علامة جدولة أو شرطة عمودية) والترميز تلقائيًا. إذا بدت الأعمدة غير صحيحة، انقر على الفاصل في شريط الحالة في الأسفل لاختيار فاصل آخر، وفعّل «الصف الأول عناوين» أو أوقفه.' },
        { title: 'ابحث وصفِّ ورتّب', text: 'اكتب في مربع البحث (اضغط / للانتقال إليه) للعثور على الصفوف في كل الأعمدة. استخدم «تصفية» أو قائمة عنوان العمود لإبقاء الصفوف التي تحتاجها فقط، وانقر مع Shift على عناوين الأعمدة للترتيب حسب عمود واحد أو أكثر. انقر على عنوان عمود لترى ملخصه: الخلايا الفارغة والقيم المختلفة والأرقام ومخططًا.' },
        { title: 'حرّر ونظّف', text: 'كل خلية قابلة للتحرير: انقر عليها واكتب، أو الصق خلايا منسوخة من جدول بيانات. أضف الصفوف والأعمدة أو احذفها، واستخدم «بحث واستبدال»، أو افتح «تنظيف» لتغيير حالة الأحرف وحذف المسافات الزائدة وتعبئة الفراغات للأسفل وتقسيم الأعمدة أو دمجها وحذف الصفوف المكررة أو تبديل الصفوف والأعمدة. التراجع والإعادة متاحان دائمًا.' },
        { title: 'نزّل ملف CSV', text: 'انقر على «تنزيل» لحفظ كل الصفوف بفاصل الملف نفسه، أو اختر «خيارات التنزيل» من قائمة «المزيد» لتغيير الفاصل أو علامات الاقتباس أو نهايات الأسطر، أو لإبقاء الصفوف المصفّاة فقط. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      handlesTitle: 'ما يقرؤه عارض CSV: ملفات CSV وTSV والمفصولة بعلامة جدولة',
      handles: [
        'الملفات: .csv و.tsv و.tab، مع اكتشاف الفاصل تلقائيًا (فاصلة أو فاصلة منقوطة أو علامة جدولة أو شرطة عمودية).',
        'الترميز: UTF-8 مع BOM أو بدونه، وUTF-16، وWindows-1256 لملفات العربية القديمة، فتظهر الحروف العربية صحيحة ومن اليمين إلى اليسار.',
        'الحجم: لا حد لعدد الصفوف؛ يُفتح ملف من 120,000 صف في أقل من ثانية، وتظهر رسالة تحذير أولًا للملفات التي تزيد على 50 ميغابايت.',
        'التحرير: الخلايا والصفوف والأعمدة، والبحث والاستبدال، وأدوات التنظيف، والتصفية والترتيب وملخص الأعمدة، مع التراجع والإعادة.',
        'الحفظ: ملف CSV بفاصل الملف نفسه، أو بالفاصل وعلامات الاقتباس ونهايات الأسطر التي تختارها؛ وتبقى الأصفار البادئة والأرقام الطويلة كما كُتبت.',
      ],
      faqTitle: 'عارض CSV اون لاين: أسئلة شائعة',
      faq: [
        {
          question: 'هل يُرفع ملفي؟',
          answer: 'لا. يقرأ متصفحك ملف CSV بنفسه ويرسم الجدول على شاشتك. لا يُرسل شيء إلى أي خادم، فلا يغادر الملف جهازك.',
        },
        {
          question: 'هل يمكنني تعديله وحفظه؟',
          answer: 'نعم. عدّل الخلايا، وأضف الصفوف والأعمدة أو احذفها، واستخدم البحث والاستبدال أو التنظيف، ثم انقر «تنزيل» لحفظ ملف CSV بفاصل الملف نفسه، أو اختر فاصلًا آخر أو علامات اقتباس أو نهايات أسطر من «خيارات التنزيل».',
        },
        {
          question: 'هل يتغير الملف الأصلي؟',
          answer: 'لا. تبقى تعديلاتك في ذاكرة الصفحة حتى تنزّل نسخة، ولا يُمس الملف الموجود على جهازك أبدًا. إغلاق التبويب يتجاهل التعديلات، ويسألك المتصفح أولًا إذا كانت هناك تعديلات لم تُحفظ.',
        },
        {
          question: 'هل هناك حد لحجم الملف؟',
          answer: 'لا يوجد حد ثابت: الحد هو ذاكرة متصفحك، فتستطيع عرض ملفات CSV الكبيرة. يُفتح ملف من 120,000 صف في أقل من ثانية لأن الصفوف الظاهرة فقط هي التي تُرسم، وتظهر رسالة تحذير للملفات التي تزيد على 50 ميغابايت ثم تُفتح إذا سمحت الذاكرة. وبخلاف Excel الذي يتوقف عند 1,048,576 صفًا في الورقة، لا يضع عارض CSV حدًا لعدد الصفوف.',
        },
        {
          question: 'هل يعمل على الجوال؟',
          answer: 'نعم. لصفحة CSV تخطيط خاص بالجوال، فيه الأدوات في قائمة والجدول يتحرك أفقيًا، فتستطيع عرض ملف CSV وتعديله في متصفح الجوال.',
        },
        {
          question: 'هل يعمل بدون إنترنت؟',
          answer: 'بعد تحميل الصفحة وعارض CSV، لا يحتاج فتح الملفات وتعديلها إلى أي اتصال بالإنترنت. لكنه ليس تطبيقًا يُثبَّت للعمل دون اتصال: يجب تحميل الصفحة وأنت متصل أولًا.',
        },
        {
          question: 'هل يمكن لشركتي استضافة نسخة خاصة بها؟',
          answer: 'ليس حاليًا: يُقدَّم OpenAnyDoc على openanydoc.com فقط، ولا يوجد بعدُ ترخيص لتشغيل نسخة خاصة بك. إذا كانت شركتك تحتاج إلى ذلك، فراسلنا على support@openanydoc.com.',
        },
        {
          question: 'لماذا يُفتح ملف CSV في عمود واحد؟',
          answer: 'غالبًا يستخدم الملف فاصلًا غير الفاصلة، مثل الفاصلة المنقوطة، وهذا شائع في الملفات التي يحفظها Excel في كثير من البلدان. يكتشف OpenAnyDoc الفاصلة والفاصلة المنقوطة وعلامة الجدولة والشرطة العمودية تلقائيًا، ويمكنك اختيار الفاصل بنفسك بالنقر عليه في شريط الحالة أسفل الصفحة.',
        },
        {
          question: 'كيف أفتح ملف CSV فيه نص عربي أو بلغة غير الإنجليزية؟',
          answer: 'افتحه مباشرة: تُقرأ ملفات UTF-8 (مع BOM أو بدونه) وUTF-16 مباشرة، ويُقرأ الملف الذي ليس UTF-8 صالحًا بترميز Windows-1256، وهو الترميز العربي القديم. وتُعرض الخلايا العربية من اليمين إلى اليسار. عند التنزيل تُضاف علامة ترتيب البايت (BOM) إذا كان في الملف نص بلغة غير الإنجليزية، حتى يعرضه Excel بشكل صحيح. ولمعرفة جانب Excel من المشكلة اقرأ إصلاح العربية المشوّهة في CSV.',
          link: { text: 'إصلاح العربية المشوّهة في CSV', path: '/fix-arabic-csv-in-excel' },
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
          question: 'هل يمكنني فتح ملف TSV اون لاين وتعديله؟',
          answer: 'نعم. تُفتح ملفات .tsv و.tab مفصولة بعلامة جدولة مع اكتشاف صف العناوين، ويمكنك تحريرها وتنزيلها بالطريقة نفسها المتبعة مع ملف CSV.',
        },
      ],
    },
    '/excel-viewer': {
      stepsTitle: 'كيف يعمل: افتح ملف اكسل في متصفحك وعدّله',
      steps: [
        { title: 'أفلت المصنف على الصفحة', text: 'اختر ملف .xlsx أو .xls أو .xlsm أو .ods. يُقرأ داخل متصفحك ولا يُرفع أبدًا.' },
        { title: 'تنقّل بين الأوراق', text: 'كل ورقة تبويب في الأسفل، كما في Excel. تُعرض التواريخ والنسب المئوية والعملات بتنسيقها في الملف، وتُرسم الخلايا المدمجة كخلية واحدة.' },
        { title: 'انتقل إلى التحرير', text: 'انقر على خلية واكتب قيمة أو صيغة مثل =SUM(B2:B10). تُعاد حساب الصيغ أثناء التعديل، وتتحدث الخلايا التي تعتمد عليها.' },
        { title: 'نسّق بياناتك', text: 'استخدم شريط الأدوات لتغيير تنسيقات الأرقام والعملات، وإدراج الصفوف والأعمدة والأوراق أو حذفها، ودمج الخلايا، وفي ملفات .xlsx اضبط الخط الغامق والألوان والخطوط والحدود.' },
        { title: 'احفظ المصنف', text: 'استخدم أيقونة الحفظ لتنزيل المصنف بالصيغة نفسها. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      handlesTitle: 'ما يدعمه عارض ملفات XLSX: ملفات XLSX وXLS وXLSM وODS',
      handles: [
        'الملفات: .xlsx و.xls (Excel 97 إلى 2003) و.xlsm (المفعّلة بالماكرو) و.ods (OpenDocument)، بكل أوراقها. لا يمكن فتح المصنفات المحمية بكلمة مرور.',
        'العرض: تنسيقات الأرقام والتواريخ والنسب المئوية والعملات والخلايا المدمجة؛ والخطوط والألوان والتعبئة في ملفات .xlsx و.xlsm حتى 8 ميغابايت.',
        'التحرير: القيم والصيغ التي تُعاد حسابها، والصفوف والأعمدة والأوراق، ودمج الخلايا وتنسيقات الأرقام؛ وفي ملفات .xlsx أيضًا الخط الغامق والمائل والألوان والتعبئة والمحاذاة.',
        'ما يُحفظ: القيم، والصيغ مع نتائجها، وتنسيقات الأرقام، والخلايا المدمجة، وعرض الأعمدة، بصيغة الملف نفسها. وأنماط الخلايا تُحفظ في ملفات .xlsx فقط.',
        'ما لا يُحفظ: المخططات والصور والجداول المحورية والتنسيق الشرطي والتحقق من صحة البيانات والأسماء المعرّفة وحزم الماكرو.',
        'الحجم: لا يوجد حد ثابت؛ تظهر رسالة تحذير أولًا للملفات التي تزيد على 50 ميغابايت، ولا تُقرأ أنماط الخلايا إلا للملفات حتى 8 ميغابايت.',
      ],
      faqTitle: 'فتح ملف اكسل اون لاين: أسئلة شائعة',
      faq: [
        {
          question: 'هل يُرفع ملفي؟',
          answer: 'لا. يقرأ متصفحك المصنف بنفسه ويرسم الأوراق على شاشتك. لا يُرسل شيء إلى أي خادم، فلا يغادر الملف جهازك.',
        },
        {
          question: 'هل يمكنني تعديله وحفظه؟',
          answer: 'نعم. انتقل إلى «تحرير» لتغيير الخلايا والصيغ، وإدراج الصفوف والأعمدة والأوراق أو حذفها، ودمج الخلايا وتغيير تنسيقات الأرقام، ثم احفظ المصنف بصيغته: .xlsx أو .xls أو .xlsm أو .ods.',
        },
        {
          question: 'هل يتغير الملف الأصلي؟',
          answer: 'لا. تبقى تعديلاتك في ذاكرة الصفحة حتى تنزّل نسخة، ولا يُمس الملف الموجود على جهازك أبدًا. إغلاق التبويب يتجاهل التعديلات، ويسألك المتصفح أولًا إذا كانت هناك تعديلات لم تُحفظ.',
        },
        {
          question: 'هل هناك حد لحجم الملف؟',
          answer: 'لا يوجد حد ثابت: الحد هو ذاكرة متصفحك. تُفتح ورقة بـ 100,000 صف في نحو ثانيتين، وتظهر رسالة تحذير أولًا للملفات التي تزيد على 50 ميغابايت. ولا تُقرأ أنماط الخلايا إلا للملفات حتى 8 ميغابايت، فتُفتح المصنفات الأكبر بالقيم والصيغ.',
        },
        {
          question: 'هل يعمل على الجوال؟',
          answer: 'نعم. تتكيف صفحة Excel مع شاشة الجوال، فتستطيع فتح المصنف وعرضه وتعديله في متصفح الجوال. والأوراق الكبيرة أسهل على شاشة أكبر.',
        },
        {
          question: 'هل يعمل بدون إنترنت؟',
          answer: 'بعد تحميل الصفحة وعارض Excel، لا يحتاج فتح الملفات وتعديلها إلى أي اتصال بالإنترنت. لكنه ليس تطبيقًا يُثبَّت للعمل دون اتصال: يجب تحميل الصفحة وأنت متصل أولًا.',
        },
        {
          question: 'هل يمكن لشركتي استضافة نسخة خاصة بها؟',
          answer: 'ليس حاليًا: يُقدَّم OpenAnyDoc على openanydoc.com فقط، ولا يوجد بعدُ ترخيص لتشغيل نسخة خاصة بك. إذا كانت شركتك تحتاج إلى ذلك، فراسلنا على support@openanydoc.com.',
        },
        {
          question: 'كيف أفتح ملف اكسل بدون برنامج Excel؟',
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
      ],
    },
    '/json-viewer': {
      stepsTitle: 'كيف يعمل: فتح ملف JSON وتنسيقه وتعديله اون لاين',
      steps: [
        { title: 'أفلت ملفًا أو الصق JSON أو جرّب مثالًا', text: 'اختر ملف .json أو أفلته، أو الصق JSON باستخدام Ctrl+V، أو جرّب المثال. يُقرأ داخل متصفحك، فلا تُرفع استجابات API وملفات الإعدادات وغيرها من البيانات الخاصة.' },
        { title: 'النص والشجرة جنبًا إلى جنب', text: 'يظهر النص بجانب شجرة قابلة للطي (أو جدول لقائمة من الكائنات) ولوحة تفاصيل؛ تحديد عقدة في أحدهما يُظهرها في الآخر. ابحث في المفاتيح والقيم، أو اكتب مسارًا مثل $.orders[*].total.' },
        { title: 'تحقّق وأصلح', text: 'يعرض «تحقّق» النتيجة مع الحجم وعدد المفاتيح والقيم والعمق. إذا لم يكن JSON صالحًا فسترى السطر والعمود، ويصلح «إصلاح» التعليقات والفواصل الزائدة أو الناقصة وعلامات الاقتباس المفردة والمفاتيح غير المقتبسة.' },
        { title: 'نسّق وعدّل', text: 'اكتب في النص، أو استخدم الشجرة ولوحة التفاصيل. نسّق بمسافة واحدة أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة، واضغط الملف، ورتّب المفاتيح، وغيّر العقد وأضفها وكرّرها وانقلها واحذفها. تُحفظ الأرقام الطويلة كما هي.' },
        { title: 'نزّل ملف JSON', text: 'استخدم زر «تنزيل» لحفظ النتيجة. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      handlesTitle: 'ما يعرضه عارض JSON: الملفات وJSON الملصوق',
      handles: [
        'الإدخال: ملفات .json، أو JSON ملصوق باستخدام Ctrl+V؛ ويمكن عرض قائمة من الكائنات كجدول أيضًا.',
        'الحجم: حتى 10 ميغابايت؛ تُرفض الملفات الأكبر قبل قراءتها. وفوق 5 ميغابايت تبدأ لوحة النص مغلقة.',
        'الأرقام: تُحفظ الأعداد الصحيحة الأطول مما تتسع له JavaScript (أكبر من 2^53) كما هي تمامًا.',
        'الأخطاء: السطر والعمود الذي فيه المشكلة، و«إصلاح» للتعليقات والفواصل الزائدة أو الناقصة وعلامات الاقتباس المفردة والمفاتيح غير المقتبسة.',
        'التحرير: في النص أو في الشجرة؛ غيّر العقد وأضفها وكرّرها وانقلها واحذفها، ونسّق بمسافة إلى 8 مسافات أو بعلامة جدولة، واضغط الملف ورتّب المفاتيح، مع التراجع.',
        'الحفظ: ملف .json بالتخطيط الذي اخترته.',
      ],
      faqTitle: 'عارض JSON: أسئلة شائعة',
      faq: [
        {
          question: 'هل يُرفع ملفي؟',
          answer: 'لا. يقرأ متصفحك JSON ويتحقق منه بنفسه، ويبقى JSON الملصوق في الصفحة أيضًا. لا يُرسل شيء إلى أي خادم، ما يجعله مناسبًا لاستجابات API والرموز المميزة وإعدادات الأنظمة الداخلية.',
        },
        {
          question: 'هل يمكنني تعديله وحفظه؟',
          answer: 'نعم. اكتب في النص أو عدّل الشجرة: غيّر العقد وأضفها وكرّرها وانقلها واحذفها، ونسّق الملف أو اضغطه أو رتّب مفاتيحه، ثم اضغط «تنزيل» لحفظ ملف .json.',
        },
        {
          question: 'هل يتغير الملف الأصلي؟',
          answer: 'لا. تبقى تعديلاتك في ذاكرة الصفحة حتى تنزّل نسخة، ولا يُمس الملف الموجود على جهازك أبدًا. إغلاق التبويب يتجاهل التعديلات، ويسألك المتصفح أولًا إذا كانت هناك تعديلات لم تُحفظ.',
        },
        {
          question: 'هل هناك حد لحجم الملف؟',
          answer: 'نعم: تُفتح ملفات JSON حتى 10 ميغابايت، وتُرفض الملفات الأكبر قبل قراءتها، لأن كل تعديل سيجعل الصفحة بطيئة. ويَظهر ملف بهذا الحجم كشجرة في أقل من ثانية؛ وفوق 5 ميغابايت تبدأ لوحة النص مغلقة وتُفتح بزر «إظهار النص».',
        },
        {
          question: 'هل يعمل على الجوال؟',
          answer: 'نعم. على الجوال تتحول صفحة JSON إلى تبويبات النص والشجرة والتفاصيل بدل اللوحات المتجاورة، مع الإجراءات الرئيسية في شريط أسفل الشاشة.',
        },
        {
          question: 'هل يعمل بدون إنترنت؟',
          answer: 'بعد تحميل الصفحة وعارض JSON، لا يحتاج فتح الملفات وتعديلها إلى أي اتصال بالإنترنت. لكنه ليس تطبيقًا يُثبَّت للعمل دون اتصال: يجب تحميل الصفحة وأنت متصل أولًا.',
        },
        {
          question: 'هل يمكن لشركتي استضافة نسخة خاصة بها؟',
          answer: 'ليس حاليًا: يُقدَّم OpenAnyDoc على openanydoc.com فقط، ولا يوجد بعدُ ترخيص لتشغيل نسخة خاصة بك. إذا كانت شركتك تحتاج إلى ذلك، فراسلنا على support@openanydoc.com.',
        },
        {
          question: 'كيف أنسّق JSON اون لاين (Pretty Print)؟',
          answer: 'افتح ملفك واضغط «تنسيق»، أو اختر مسافة واحدة أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة من القائمة المجاورة له. يعرض النص النتيجة المنسقة، ويستخدم التنزيل التخطيط نفسه.',
        },
        {
          question: 'كيف أضغط ملف JSON؟',
          answer: 'اضغط «تصغير». تُحذف كل المسافات وفواصل الأسطر خارج النصوص، فيصغر حجم الملف.',
        },
        {
          question: 'هل يتحقق من صحة JSON ويحدد مكان الخطأ؟',
          answer: 'عندما لا يكون JSON صالحًا، يعرض OpenAnyDoc سبب الخطأ مع رقم السطر والعمود، ويحدد «انتقل إلى الخطأ» الموضع في النص. ويصلح «إصلاح» الأخطاء المعتادة في الكتابة اليدوية (التعليقات والفواصل الزائدة أو الناقصة وعلامات الاقتباس المفردة والمفاتيح غير المقتبسة وTrue وNone وNaN) ويذكر ما غيّره.',
        },
        {
          question: 'هل يمكنني ترتيب مفاتيح كائن JSON أبجديًا؟',
          answer: 'نعم. اضغط «ترتيب المفاتيح»: تُرتَّب مفاتيح كل كائن، ومنها الكائنات المتداخلة، من A إلى Z. ويعيدها «تراجع» كما كانت.',
        },
      ],
    },
    '/txt-viewer': {
      stepsTitle: 'كيف يعمل: فتح ملف TXT اون لاين وتعديله',
      steps: [
        { title: 'أفلت ملف .txt على الصفحة', text: 'اختر ملفًا نصيًا أو أفلته، مثل ملاحظات أو سجل أو قائمة. يُقرأ داخل متصفحك ولا يُرفع أبدًا، ويُفتح جاهزًا للتحرير.' },
        { title: 'اكتب أو اختر أداة من الشريط', text: 'اكتب في النص، أو افتح تبويبًا (الأسطر، تنظيف، حالة الأحرف، بحث، تحليل، عرض، ملف) وانقر أداة: فرز الأسطر أو حذف المكرر منها أو ترقيمها أو دمجها، وحذف المسافات، وتغيير حالة الأحرف. وعند تحديد نص تغيّر الأداة الأسطر المحددة فقط. وكل أداة خطوة تراجع واحدة.' },
        { title: 'ابحث واستبدل وراجع', text: 'اضغط Ctrl+F (أو /) للبحث والاستبدال، مع مطابقة حالة الأحرف والكلمة الكاملة والتعابير النمطية. وتعدّ الإحصاءات الكلمات والجمل ووقت القراءة، وتعرض المقارنة كل تغيير مقارنةً بالملف الأصلي.' },
        { title: 'شاهد المخفي', text: 'أظهر الأحرف المخفية لترى علامات الجدولة والمسافات في نهاية الأسطر والأحرف صفرية العرض ونهايات الأسطر، ثم احذفها بأدوات التنظيف. وتساعدك الإشارات المرجعية والانتقال إلى سطر في الملفات الطويلة.' },
        { title: 'نزّل ملفك النصي', text: 'انقر «تنزيل» واختر UTF-8 أو UTF-8 مع BOM أو UTF-16 أو Windows-1256، ونهايات الأسطر LF أو CRLF أو CR. الملف الأصلي على جهازك لا يتغير أبدًا.' },
      ],
      handlesTitle: 'ما يدعمه محرر النصوص: ملفات TXT',
      handles: [
        'الملفات: الملفات النصية العادية .txt، مثل الملاحظات والسجلات والقوائم.',
        'الترميز: UTF-8 مع BOM أو بدونه، وUTF-16، وWindows-1256 للنصوص العربية القديمة؛ ويمكنك إعادة فتح الملف بترميز آخر، ويُعرض كل سطر باتجاه القراءة الخاص به.',
        'الحجم: جُرّب ملف نصي بحجم 46 ميغابايت، وتظهر رسالة تحذير أولًا للملفات التي تزيد على 50 ميغابايت؛ وفوق مليوني حرف تقريبًا يُفتح الملف في عرض سريع للقراءة.',
        'التحرير: الكتابة، وأدوات للفرز والمكرر والترقيم والمسافات وحالة الأحرف، والبحث والاستبدال بالتعابير النمطية، والإحصاءات والمقارنة.',
        'الحفظ: UTF-8 أو UTF-8 مع BOM أو UTF-16 أو Windows-1256، مع نهايات الأسطر LF أو CRLF أو CR.',
      ],
      faqTitle: 'محرر نصوص اون لاين: أسئلة شائعة',
      faq: [
        {
          question: 'هل يُرفع ملفي؟',
          answer: 'لا. يقرأ متصفحك الملف النصي بنفسه ويعرضه على شاشتك. لا يُرسل شيء إلى أي خادم، فلا يغادر الملف جهازك.',
        },
        {
          question: 'هل يمكنني تعديله وحفظه؟',
          answer: 'نعم. يُفتح الملف جاهزًا للتحرير: اكتب، أو استخدم أدوات الشريط للأسطر والمسافات وحالة الأحرف، ثم انقر «تنزيل» واختر الترميز (UTF-8 أو UTF-8 مع BOM أو UTF-16 أو Windows-1256) ونهايات الأسطر (LF أو CRLF أو CR).',
        },
        {
          question: 'هل يتغير الملف الأصلي؟',
          answer: 'لا. تبقى تعديلاتك في ذاكرة الصفحة حتى تنزّل نسخة، ولا يُمس الملف الموجود على جهازك أبدًا. إغلاق التبويب يتجاهل التعديلات، ويسألك المتصفح أولًا إذا كانت هناك تعديلات لم تُحفظ.',
        },
        {
          question: 'هل هناك حد لحجم الملف؟',
          answer: 'لا يوجد حد ثابت: الحد هو ذاكرة متصفحك، وتظهر رسالة تحذير أولًا للملفات التي تزيد على 50 ميغابايت. وتظهر الأسطر الأولى من ملف نصي بحجم 46 ميغابايت في أقل من نصف ثانية. والملف الذي يزيد على مليوني حرف تقريبًا يُفتح في عرض سريع للقراءة يرسم الأسطر الظاهرة فقط، وتعمل كل الأدوات على النص كاملًا. اختر «التحرير على أي حال» للكتابة فيه؛ فالكتابة في ملف كبير جدًا أبطأ.',
        },
        {
          question: 'هل يعمل على الجوال؟',
          answer: 'نعم. على الجوال يتحول الشريط إلى لوحة أدوات ويملأ النص الشاشة، فتستطيع قراءة الملفات النصية وتعديلها في متصفح الجوال.',
        },
        {
          question: 'هل يعمل بدون إنترنت؟',
          answer: 'بعد تحميل الصفحة وعارض النصوص، لا يحتاج فتح الملفات وتعديلها إلى أي اتصال بالإنترنت. لكنه ليس تطبيقًا يُثبَّت للعمل دون اتصال: يجب تحميل الصفحة وأنت متصل أولًا.',
        },
        {
          question: 'هل يمكن لشركتي استضافة نسخة خاصة بها؟',
          answer: 'ليس حاليًا: يُقدَّم OpenAnyDoc على openanydoc.com فقط، ولا يوجد بعدُ ترخيص لتشغيل نسخة خاصة بك. إذا كانت شركتك تحتاج إلى ذلك، فراسلنا على support@openanydoc.com.',
        },
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
      ],
    },
    '/json-formatter': {
      stepsTitle: 'كيف يعمل: تنسيق JSON في خطوات قليلة',
      steps: [
        { title: 'الصق JSON أو افتح ملفه', text: 'اضغط Ctrl+V في أي مكان من هذه الصفحة للصق JSON، أو أفلت ملف .json. وإن أردت أن ترى طريقة العمل فقط، فاضغط «جرّب مثال JSON».' },
        { title: 'اختر المسافة البادئة', text: 'افتح القائمة بجانب «تنسيق» واختر 1 أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة، فيُرتَّب المستند كله بها.' },
        { title: 'صغّره أو رتّب مفاتيحه عند الحاجة', text: 'يحذف «تصغير» كل المسافات وفواصل الأسطر خارج النصوص ويعرض حجم الملف قبل التصغير وبعده، ويرتب «ترتيب المفاتيح» مفاتيح كل كائن من A إلى Z.' },
        { title: 'انسخ النتيجة أو نزّلها', text: 'يضع «نسخ منسّقًا» أو «نسخ مصغّرًا» النتيجة في الحافظة، ويحفظ «تنزيل» ملف .json بالتنسيق الذي اخترته.' },
      ],
      handlesTitle: 'ما يدعمه منسق JSON',
      handles: [
        'المسافة البادئة: 1 أو 2 أو 3 أو 4 أو 8 مسافات، أو علامة جدولة.',
        'التصغير: سطر واحد، مع الحجم قبل التصغير وبعده.',
        'ترتيب المفاتيح: من A إلى Z في كل كائن، بما فيها الكائنات المتداخلة، بخطوة تراجع واحدة.',
        'الأرقام الطويلة: الأعداد الصحيحة التي تتجاوز 2^53 تُكتب كما كانت دون تقريب.',
        'المدخلات: JSON ملصوق أو ملف .json حتى 10 ميغابايت.',
      ],
      faqTitle: 'تنسيق JSON: أسئلة وأجوبة',
      faq: [
        {
          question: 'ما الفرق بين تنسيق JSON وتصغيره؟',
          answer: 'التنسيق يضع كل مفتاح وقيمة في سطر خاص بمسافة بادئة ليسهل على الناس قراءته، والتصغير يحذف كل المسافات وفواصل الأسطر خارج النصوص ليصبح الملف أصغر ما يمكن. والبيانات نفسها لا تتغير في الحالتين.',
        },
        {
          question: 'ما المسافة البادئة المناسبة لتنسيق JSON؟',
          answer: 'المسافتان هما الاختيار الأكثر شيوعًا وهما الافتراضي هنا، وتُستخدم أربع مسافات في بعض أنماط البرمجة، أما علامة الجدولة فتترك لمحرر كل قارئ تحديد عرضها. وتتوفر 1 و2 و3 و4 و8 مسافات وعلامة الجدولة.',
        },
        {
          question: 'هل يغيّر التنسيق أرقامي أو ترتيب المفاتيح؟',
          answer: 'لا. يغيّر «تنسيق» و«تصغير» المسافات وفواصل الأسطر فقط. وتبقى المفاتيح بترتيبها ما لم تضغط «ترتيب المفاتيح»، وتُحفظ الأعداد الصحيحة الطويلة رقمًا رقمًا.',
        },
        {
          question: 'هل يمكنني تنسيق JSON فيه خطأ؟',
          answer: 'ليس قبل إصلاح الخطأ، لأن التنسيق يحتاج إلى JSON صالح. تعرض الصفحة سطر الخطأ وعموده، ويصلح زر «إصلاح» الأخطاء الشائعة مثل الفواصل الزائدة والتعليقات وعلامات الاقتباس المفردة، ثم يعمل التنسيق.',
        },
        {
          question: 'هل من الآمن تنسيق JSON فيه مفاتيح API أو رموز دخول؟',
          answer: 'يُنسَّق JSON داخل متصفحك ولا يُرفع إلى أي خادم ولا يُحفظ في أي مكان، فتبقى الرموز والإعدادات الداخلية على جهازك.',
        },
        {
          question: 'ما أكبر ملف JSON يمكن تنسيقه؟',
          answer: 'حتى 10 ميغابايت. تُرفض الملفات الأكبر قبل قراءتها، لأن كل عملية عليها ستكون بطيئة.',
        },
      ],
    },
    '/json-validator': {
      stepsTitle: 'كيف يعمل: التحقق من JSON وإصلاح أخطائه',
      steps: [
        { title: 'الصق JSON أو افتح الملف', text: 'اضغط Ctrl+V في هذه الصفحة أو أفلت ملف .json. ويُفتح الملف حتى لو كان فيه خطأ في الصياغة، ويظهر الخطأ فورًا.' },
        { title: 'اضغط «تحقّق»', text: 'اضغط «تحقّق» (أو Ctrl+Enter، و⌘+Enter على Mac). ويعرض JSON الصالح حجمه وعدد مفاتيحه وقيمه وعمقه.' },
        { title: 'انتقل إلى الخطأ', text: 'يعرض JSON غير الصالح رسالة المحلل مع السطر والعمود، ويحدد «انتقل إلى الخطأ» ذلك الموضع في النص لتصلحه بنفسك.' },
        { title: 'أصلح الأخطاء الشائعة', text: 'يصلح «إصلاح» التعليقات والفواصل الزائدة أو الناقصة وعلامات الاقتباس المفردة والمنحنية والمفاتيح غير المقتبسة والكلمات True وFalse وNone وNaN، ثم يخبرك بما غيّره. اضغط «تحقّق» مرة أخرى للتأكد.' },
      ],
      handlesTitle: 'ما يفحصه مدقق صياغة JSON',
      handles: [
        'الصياغة: JSON القياسي، يُفحص بمحلل JSON الموجود في متصفحك.',
        'موضع الخطأ: رسالة المحلل مع السطر والعمود، وزر «انتقل إلى الخطأ».',
        'الإصلاح: التعليقات، والفواصل الزائدة والناقصة، وعلامات الاقتباس المفردة والمنحنية، والمفاتيح غير المقتبسة، وTrue وFalse وNone وNaN وundefined وInfinity.',
        'لا يُفحص: مخطط JSON Schema. تتحقق الأداة من الصياغة لا من مطابقة البيانات لمخطط.',
        'الحجم: ملفات حتى 10 ميغابايت.',
      ],
      faqTitle: 'التحقق من JSON: أسئلة وأجوبة',
      faq: [
        {
          question: 'كيف أعرف إن كان JSON صالحًا؟',
          answer: 'الصقه في هذه الصفحة أو افتح الملف ثم اضغط «تحقّق». وعبارة «JSON صالح» تعني أن أي محلل قياسي يستطيع قراءته، وإلا فالرسالة والسطر والعمود تبيّن ما يجب إصلاحه.',
        },
        {
          question: 'لماذا JSON الخاص بي غير صالح؟',
          answer: 'أكثر الأسباب شيوعًا: فاصلة بعد آخر عنصر، أو تعليقات، أو علامات اقتباس مفردة بدل المزدوجة، أو مفاتيح بلا علامات اقتباس، أو قيم مثل True وNone وNaN منسوخة من Python أو JavaScript. لا يسمح JSON القياسي بأي منها، وزر «إصلاح» يصلحها كلها.',
        },
        {
          question: 'هل يتحقق من مطابقة JSON Schema؟',
          answer: 'لا. يتحقق من أن النص JSON سليم الصياغة فقط، ولا يقارن البيانات بمخطط JSON Schema.',
        },
        {
          question: 'ماذا يغيّر زر «إصلاح»، وهل يمكنني التراجع عنه؟',
          answer: 'يغيّر الأخطاء المذكورة في رسالته فقط، ولا يمس النص داخل السلاسل النصية. وإذا لم تعجبك النتيجة فاضغط «تراجع». وإذا بقي خطأ آخر فإنه يظهر مع موضعه.',
        },
        {
          question: 'هل يُرسل JSON إلى أي مكان للتحقق منه؟',
          answer: 'لا. يجري التحقق بمحلل JSON الموجود في متصفحك وعلى جهازك، ولا يُرسل شيء إلى أي خادم.',
        },
        {
          question: 'هل يمكن التحقق من ملفات JSON الكبيرة؟',
          answer: 'نعم، حتى 10 ميغابايت. تُرفض الملفات الأكبر قبل قراءتها.',
        },
      ],
    },
    '/tsv-viewer': {
      stepsTitle: 'كيف يعمل: فتح ملف TSV اون لاين',
      steps: [
        { title: 'أفلت ملف .tsv أو .tab', text: 'اختر الملف أو أفلته في أي مكان من الصفحة. يُفتح وعلامة الجدولة هي الفاصل، ويُقرأ في متصفحك ولا يُرفع أبدًا.' },
        { title: 'تحقق من صف العناوين', text: 'يُستنتج من شكل الصفوف إن كان الصف الأول يحمل أسماء الأعمدة. وإن كان الاستنتاج خاطئًا، فانقر على الفاصل في شريط الحالة في الأسفل وفعّل «الصف الأول هو صف العناوين» أو أوقفه.' },
        { title: 'ابحث وصفِّ ورتّب', text: 'ابحث في كل الأعمدة، وأضف عوامل تصفية، وانقر مع Shift على عناوين الأعمدة للترتيب حسب أكثر من عمود.' },
        { title: 'عدّل ونزّل', text: 'عدّل الخلايا والصفوف والأعمدة، ثم اضغط «تنزيل»: يُحفظ الملف بعلامات الجدولة من جديد مع نهايات أسطره.' },
      ],
      handlesTitle: 'ما يدعمه عارض ملفات TSV',
      handles: [
        'الملفات: .tsv و.tab، تُقرأ وعلامة الجدولة هي الفاصل.',
        'صف العناوين: يُستنتج من البيانات ويمكنك تغييره.',
        'القيم بين علامات الاقتباس: تُقرأ كما يكتبها Excel وGoogle Sheets، فتبقى علامة الجدولة أو السطر الجديد داخل الاقتباس في خلية واحدة.',
        'الترميز: UTF-8 وUTF-16 وWindows-1256 للملفات العربية القديمة.',
        'الحفظ: بعلامات الجدولة من جديد مع نهايات أسطر الملف، وتضبط «خيارات التنزيل» علامات الاقتباس ونهايات الأسطر أو تبقي الصفوف المصفّاة فقط.',
      ],
      faqTitle: 'ملفات TSV: أسئلة وأجوبة',
      faq: [
        {
          question: 'ما هو ملف TSV؟',
          answer: 'ملف TSV (قيم مفصولة بعلامات جدولة) جدول بنص عادي: صف في كل سطر، وعلامة جدولة بين الأعمدة. تصدّره قواعد البيانات وجداول البيانات وأدوات كثيرة، لأن علامة الجدولة نادرًا ما تظهر داخل القيم.',
        },
        {
          question: 'كيف أفتح ملف TSV اون لاين؟',
          answer: 'أفلت ملف .tsv على هذه الصفحة أو اختره بالزر، فيُفتح كجدول في متصفحك بدون Excel وبدون رفعه.',
        },
        {
          question: 'ما الفرق بين TSV وCSV؟',
          answer: 'كلاهما جدول بنص عادي. يفصل CSV الأعمدة بالفواصل (أو بالفاصلة المنقوطة في بلدان كثيرة)، ويفصلها TSV بعلامات الجدولة، ولذلك يحتاج TSV إلى علامات الاقتباس أقل.',
        },
        {
          question: 'هل يمكنني تعديل ملف TSV وحفظه بصيغة TSV؟',
          answer: 'نعم. عدّل الخلايا وأضف الصفوف والأعمدة أو احذفها، ثم اضغط «تنزيل»، فيُكتب الملف بعلامات الجدولة كما جاء.',
        },
        {
          question: 'ملف .txt عندي مفصول بعلامات جدولة، فهل أفتحه هنا؟',
          answer: 'تفتح هذه الصفحة ملفات .tsv و.tab. أما ملف .txt فيُفتح في محرر TXT كنص؛ غيّر امتداده إلى .tsv لتراه جدولًا.',
        },
        {
          question: 'هل يتعامل عارض TSV مع الملفات الكبيرة؟',
          answer: 'نعم، فهو يستخدم جدول عارض CSV نفسه، الذي فتح ملفًا من 120,000 صف في أقل من ثانية في اختباراتنا. وتظهر رسالة تحذير أولًا للملفات الأكبر من 50 ميغابايت.',
        },
      ],
    },
    '/large-csv-viewer': {
      stepsTitle: 'كيف يعمل: عرض ملف CSV كبير',
      steps: [
        { title: 'أفلت الملف الكبير', text: 'اختر ملف .csv أو .tsv أو .tab أو أفلته. تظهر للملفات الأكبر من 50 ميغابايت رسالة تحذير بأنها قد تكون بطيئة، ثم تُفتح إن كانت ذاكرة متصفحك تكفي.' },
        { title: 'تصفّح الجدول كله', text: 'لا تُرسم إلا الصفوف الظاهرة على الشاشة، فيبقى التمرير سلسًا مهما كان عدد صفوف الملف.' },
        { title: 'اعثر على الصفوف التي تحتاجها', text: 'ابحث في كل الأعمدة، وأضف عوامل تصفية، أو رتّب حسب عمود أو أكثر. ويعرض «تجميع حسب» العدد أو المجموع أو المتوسط حسب عمود.' },
        { title: 'احفظ ملفًا أصغر', text: 'تتيح «خيارات التنزيل» في قائمة «المزيد» إبقاء الصفوف المصفّاة فقط، فتختصر ملف التصدير الكبير إلى الجزء الذي تحتاجه.' },
      ],
      handlesTitle: 'ما يدعمه عارض CSV الكبير',
      handles: [
        'الصفوف: لا حد لها من عند العارض، والحد هو ذاكرة متصفحك. أما Excel فيتوقف عند 1,048,576 صفًا في الورقة.',
        'القياسات على ملف من 120,000 صف: الفتح 0.9 ثانية، والترتيب حسب عمودين 0.9 ثانية، والبحث 0.4 ثانية، والتصفية 0.1 ثانية، والتنزيل 0.4 ثانية.',
        'الملفات الأكبر من 50 ميغابايت: رسالة تحذير أولًا، ثم يُفتح الملف إن كانت الذاكرة تكفي.',
        'ملخص العمود: الخلايا الفارغة والقيم المختلفة والأرقام ومخطط للعمود المحدد.',
        'الترميز: UTF-8 وUTF-16 وWindows-1256.',
      ],
      faqTitle: 'ملفات CSV الكبيرة: أسئلة وأجوبة',
      faq: [
        {
          question: 'كيف أفتح ملف CSV أكبر من أن يفتحه Excel؟',
          answer: 'يعرض Excel 1,048,576 صفًا على الأكثر في الورقة ويترك الباقي. أفلت الملف هنا بدلًا من ذلك: لا حد للصفوف من عند هذا العارض، والحد هو ذاكرة متصفحك. وأكبر ملف قسناه فيه 120,000 صف، فجرّب ملفك وانتبه لتحذير الـ 50 ميغابايت.',
        },
        {
          question: 'ما سرعة فتح ملف CSV كبير؟',
          answer: 'في اختباراتنا فُتح ملف من 120,000 صف و8 أعمدة في 0.9 ثانية، واستغرق ترتيبه حسب عمودين 0.9 ثانية، والبحث 0.4 ثانية، والتصفية 0.1 ثانية. وتختلف الأوقات حسب جهازك.',
        },
        {
          question: 'ماذا يحدث مع ملف CSV أكبر من 50 ميغابايت؟',
          answer: 'تظهر رسالة تحذير بأنه قد يكون بطيئًا أو قد تنفد معه الذاكرة، ثم يحاول العارض فتحه. ويتوقف ذلك على متصفحك وذاكرة جهازك.',
        },
        {
          question: 'هل يمكنني اختصار ملف CSV كبير إلى الصفوف التي أحتاجها؟',
          answer: 'نعم. صفِّ الصفوف أو ابحث عنها، ثم اختر «خيارات التنزيل» من قائمة «المزيد» وأبقِ الصفوف المصفّاة فقط. ولا يتغير الملف الأصلي.',
        },
        {
          question: 'لماذا يبقى التمرير سلسًا في ملف CSV كبير هنا؟',
          answer: 'لا يوجد في الصفحة في أي وقت إلا الصفوف الظاهرة على الشاشة وبضعة صفوف حولها، ويُرسم الباقي أثناء التمرير. ويعمل البحث والترتيب على قوائم بأرقام الصفوف لا على نسخ منها.',
        },
        {
          question: 'هل يُرفع ملف CSV الكبير إلى خادم لفتحه؟',
          answer: 'لا. حتى الملف الكبير يقرؤه متصفحك على جهازك، فلا تنتظر أي رفع، والحد هو ذاكرة جهازك.',
        },
      ],
    },
    '/xls-viewer': {
      stepsTitle: 'كيف يعمل: فتح ملف XLS اون لاين',
      steps: [
        { title: 'أفلت ملف .xls', text: 'اختر الملف أو أفلته على الصفحة، فيُقرأ في متصفحك ولا يُرفع أبدًا. أما ملفات .xlsx و.xlsm و.ods فتُفتح في عارض Excel.' },
        { title: 'تصفّح الأوراق', text: 'كل ورقة تبويب في الأسفل. وتظهر التواريخ والنسب المئوية والعملات كما نُسّقت في الملف، وتُرسم الخلايا المدمجة خلية واحدة.' },
        { title: 'عدّل القيم والصيغ', text: 'انتقل إلى «تحرير» واكتب قيمًا أو صيغًا مثل =SUM(B2:B10)، فيُعاد حساب الصيغ أثناء التعديل. وأدرج الصفوف والأعمدة والأوراق أو احذفها.' },
        { title: 'احفظ بصيغة .xls', text: 'تنزّل أيقونة الحفظ ملف .xls من جديد. احتفظ بملفك الأصلي، فبعض محتويات ملف .xls لا تُكتب عند الحفظ (انظر أدناه).' },
      ],
      handlesTitle: 'ما يدعمه عارض ملفات XLS، وما لا يدعمه',
      handles: [
        'الملفات: .xls (Excel 97 إلى 2003). لا يمكن فتح المصنفات المحمية بكلمة مرور.',
        'يظهر: القيم، والصيغ مع نتائجها، وتنسيقات الأرقام والتواريخ، والخلايا المدمجة، وكل الأوراق.',
        'لا يظهر: الخطوط والألوان والتعبئة والحدود، لأن أنماط الخلايا تُقرأ من ملفات .xlsx و.xlsm فقط، ولذلك تتعطل أزرار التنسيق في ملفات .xls.',
        'يُحفظ: القيم، والصيغ مع نتائجها، وتنسيقات الأرقام، والخلايا المدمجة، وعرض الأعمدة، بصيغة .xls.',
        'لا يُحفظ: أنماط الخلايا والمخططات والصور والجداول المحورية والتنسيق الشرطي والتحقق من صحة البيانات والأسماء المعرّفة وحزم الماكرو. احتفظ بملفك الأصلي.',
      ],
      faqTitle: 'ملفات XLS: أسئلة وأجوبة',
      faq: [
        {
          question: 'ما هو ملف XLS؟',
          answer: 'XLS صيغة مصنفات Excel 97 إلى 2003، قبل أن تأتي صيغة .xlsx مع Excel 2007. وما زالت تقارير وأرشيفات قديمة كثيرة وملفات مصدّرة من أنظمة قديمة بصيغة .xls.',
        },
        {
          question: 'كيف أفتح ملف XLS بدون Excel؟',
          answer: 'أفلته على هذه الصفحة، فيُفتح في متصفحك بكل أوراقه، وتقرؤه وتعدّله وتحفظه بدون تثبيت Excel وبدون إنشاء حساب.',
        },
        {
          question: 'لماذا لا أرى ألوان ملف .xls وخطوطه؟',
          answer: 'يقرأ هذا العارض أنماط الخلايا من ملفات .xlsx و.xlsm فقط. في ملف .xls ترى القيم والصيغ وتنسيقات الأرقام والخلايا المدمجة، لا الخطوط والألوان والتعبئة والحدود.',
        },
        {
          question: 'هل أفقد شيئًا عند حفظ ملف .xls هنا؟',
          answer: 'نعم، بعض الأشياء. تُكتب القيم والصيغ وتنسيقات الأرقام والخلايا المدمجة وعرض الأعمدة، أما أنماط الخلايا والمخططات والصور والجداول المحورية والتنسيق الشرطي والتحقق من صحة البيانات والأسماء المعرّفة وحزم الماكرو فلا تُكتب. والملف الذي تحفظه نسخة جديدة، وملفك الأصلي لا يتغير.',
        },
        {
          question: 'هل يمكنني تحويل XLS إلى XLSX هنا؟',
          answer: 'لا. يحتفظ الحفظ بصيغة الملف نفسها، فيُحفظ ملف .xls بصيغة .xls.',
        },
        {
          question: 'هل تعمل الصيغ في ملف XLS؟',
          answer: 'نعم. تظهر الصيغ بنتائجها المحفوظة، وبعد تعديل خلية يُعاد حساب الصيغ التي تعتمد عليها، للدوال الشائعة مثل SUM وIF وVLOOKUP وINDEX/MATCH. أما الصيغة التي فيها دالة غير مدعومة فتحتفظ بنتيجتها المحفوظة.',
        },
      ],
    },
  },
}
