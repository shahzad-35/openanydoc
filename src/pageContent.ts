// What each format page says beyond the hero: numbered steps for opening and editing a file, and questions people really ask about
// that file type (with answers that match what the viewer does). It replaces the shared features and FAQ blocks on a format page,
// so every page has text of its own. Plain data with no imports, because scripts/build-static-pages.mjs also reads it to write
// the same text, and the same questions as FAQPage data, into each page's static HTML. Keep the answers true: only what is built.

export type GuideStep = { title: string; text: string }
export type GuideQuestion = { question: string; answer: string }
export type FormatGuide = { stepsTitle: string; steps: GuideStep[]; faqTitle: string; faq: GuideQuestion[] }

// Keyed by the format page's address, like pageSeo in seo.ts.
export const formatGuides: Record<string, FormatGuide> = {
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
      { title: 'Drop your JSON file on the page', text: 'Choose a .json file. It is read in your browser, so API responses, configuration files and other private data are never uploaded.' },
      { title: 'Explore it three ways', text: 'View the file as a collapsible tree, as a table (when it is a list of objects) or as formatted code. Search works on keys and values.' },
      { title: 'Fix errors', text: 'If the file is not valid JSON you see the message with its line and column, and in the code view "Go to error" puts the cursor on the problem.' },
      { title: 'Format and edit', text: 'Switch to Edit. Choose 2 spaces, 4 spaces, a tab or minified from the Format menu, sort keys or lists, and change, add, duplicate, move or delete nodes.' },
      { title: 'Download your JSON', text: 'Use the download icon to save the result. The original file on your device is never changed.' },
    ],
    faqTitle: 'JSON viewer and editor: common questions',
    faq: [
      {
        question: 'How do I format (pretty print) JSON online?',
        answer: 'Open your file, switch to Edit and choose 2 spaces, 4 spaces or Tab from the Format menu. The code view shows the formatted result and the download uses the same layout.',
      },
      {
        question: 'How do I minify JSON?',
        answer: 'Switch to Edit, open the Format menu and choose "Minified (one line)". All spaces and line breaks outside strings are removed, which makes the file smaller.',
      },
      {
        question: 'How do I find the error in my JSON?',
        answer: 'When the JSON is not valid, OpenAnyDoc shows what is wrong with the line and column number. In the code view, "Go to error" selects the place in the text. Typing in the code view re-checks the JSON as you type.',
      },
      {
        question: 'Can I sort the keys of a JSON object alphabetically?',
        answer: 'Yes. In Edit mode use the Sort keys menu for the selected object or the whole document, A to Z or Z to A, with or without the objects nested inside. You can also sort a selected list.',
      },
      {
        question: 'Can I open a large JSON file?',
        answer: 'Yes. A file of about 50 MB opens, because it is read in the background so the page stays responsive. Files over 50 MB show a warning, and the limit is your browser\'s memory.',
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
}
