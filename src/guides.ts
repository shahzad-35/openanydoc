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
    '/check-file-upload': {
      published: '2026-10-30',
      updated: '2026-11-01',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Open your browser\'s developer tools, watch the Network tab while you open a file, and look for a request that sends data out (a POST or PUT) or one whose size is close to your file\'s. If none appears, and the file still opens with the network switched off, the site read it on your own computer.'],
        },
        {
          heading: 'Step 1: open the Network tab',
          paragraphs: ['The steps work in any desktop browser:'],
          list: [
            'Chrome and Edge: press F12, or Ctrl+Shift+I on Windows and Cmd+Option+I on a Mac, then open Network.',
            'Firefox: the same keys, then Network.',
            'Safari: in Settings, Advanced, turn on "Show features for web developers", then choose Develop, Show Web Inspector, and open Network.',
            'Tick Preserve log in Chrome (Persist Logs in Firefox) so the list survives page changes, and press the clear button to start with an empty list.',
          ],
        },
        {
          heading: 'Step 2: open a file and read the list',
          paragraphs: ['Choose or drop a file; a harmless test file is best. Every line in the Network tab is one request. Look at the Method, Size and Type columns, then click the Fetch/XHR filter, which shows only the requests the page\'s code sends on its own, the usual way files are uploaded:'],
          list: [
            'A POST or PUT request right after you choose the file, especially one close to the file\'s size, is an upload. Click it and open Payload (Chrome) or Request (Firefox) to see what was sent.',
            'Requests to another domain at that moment, such as an analytics, storage or API address, mean something left the page. Check what they carry.',
            'GET requests for .js, .css or font files are the site loading its own code. They download to you and do not carry your file.',
            'WebSocket (WS) entries can carry data too. Open them and look at the Messages tab.',
          ],
        },
        {
          heading: 'Step 3: the offline test',
          paragraphs: ['Load the site, then disconnect: turn off Wi-Fi, or change "No throttling" to "Offline" in the Network tab. Now open a file. If it opens and you can work with it, the reading happens in your browser; a site that needs its server shows an error or keeps spinning. Reconnect afterwards and watch the Network tab for a minute, because a page could in principle keep a copy and send it later.'],
        },
        {
          heading: 'Step 4: read the site\'s security policy',
          paragraphs: ['Click the first request in the list (the page itself), open Headers and find content-security-policy under Response Headers. Its connect-src part lists the addresses the page\'s code may contact: connect-src \'self\' means only the site\'s own address, and the browser itself blocks everything else. A policy is a strong signal but not proof on its own, so combine it with steps 2 and 3.'],
        },
        {
          heading: 'What these checks show on OpenAnyDoc',
          paragraphs: ['Try them on the CSV viewer, the Excel viewer or the JSON viewer: opening, editing and downloading a file sends no Fetch/XHR request, no POST and no request to another site. The page\'s policy is connect-src \'self\', and once a tool page has finished loading, its files open with the network off. The privacy policy names the one thing the host, Cloudflare, does see: ordinary page requests, never file contents.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }, { text: 'Excel viewer', path: '/excel-viewer' }, { text: 'JSON viewer', path: '/json-viewer' }, { text: 'privacy policy', path: '/privacy' }],
        },
        {
          heading: 'What "processed in your browser" does not cover',
          paragraphs: ['It keeps the file off the network, not safe on your computer. Anything with access to the device, such as a browser extension allowed to read every site, can still see the page. Use a browser profile without extensions for sensitive files, and close the tab when you are done: the file lives in the page\'s memory and is gone when the tab closes.', 'It also stops at your computer: once you send the file to someone, or paste it into an AI assistant, its contents travel with it. Before that, mask the personal data in it; the guide on how to anonymize a file before sharing it shows the steps.'],
          links: [{ text: 'how to anonymize a file before sharing it', path: '/anonymize-data-before-sharing' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL}. If a check on OpenAnyDoc shows a request you did not expect, tell us what you saw.`],
        },
      ],
    },
    '/open-json-file': {
      published: '2026-10-30',
      updated: '2026-10-30',
      sections: [
        {
          heading: 'What a JSON file is',
          paragraphs: ['JSON (JavaScript Object Notation) is plain text that stores data as objects of "key": value pairs and as lists in square brackets. APIs, configuration files and data exports use it. Any program that opens text can open a .json file; the hard part is reading it when it is one long line or nested many levels deep.'],
        },
        {
          heading: 'The quickest way: open it in your browser',
          paragraphs: ['Drop the file on the JSON viewer, or paste JSON with Ctrl+V (Cmd+V on a Mac). It shows a tree you can fold, a table when the file is a list of objects, and the text with line numbers. Nothing is uploaded, and it works on a phone too: tap Choose a file and pick the .json from Files or your downloads. Files up to 10 MB open.'],
          links: [{ text: 'JSON viewer', path: '/json-viewer' }],
        },
        {
          heading: 'On Windows or a Mac with no extra software',
          paragraphs: ['Every browser opens JSON: drag the file onto a Chrome, Edge or Firefox window. Firefox shows a built-in viewer with a collapsible tree; the others show the text. Notepad on Windows and TextEdit on a Mac open it as text too: right-click the file, choose Open with, and pick the editor. They are fine for small files, but long lines and deep nesting are hard to follow.'],
        },
        {
          heading: 'In a code editor',
          paragraphs: ['If you work with JSON often, a code editor such as the free Visual Studio Code colours the syntax, folds objects and marks errors. Format Document (Shift+Alt+F on Windows, Shift+Option+F on a Mac) indents a file saved on one line.'],
        },
        {
          heading: 'Make a one-line file readable',
          paragraphs: ['A file saved on a single line is valid but unreadable. The JSON formatter indents it with 2 or 4 spaces (anything from 1 to 8, or a tab), can sort the keys, and minifies it again when you need a small file.'],
          links: [{ text: 'JSON formatter', path: '/json-formatter' }],
        },
        {
          heading: 'If the file will not open',
          paragraphs: ['The message usually says why:'],
          list: [
            '"Unexpected token" or "Unexpected end of JSON input" means the text breaks a JSON rule: a trailing comma, single quotes or a comment. The JSON validator shows the line and column and repairs the common mistakes, and the guide to unexpected token errors explains each message.',
            'A file that starts with < is an HTML page saved with a .json name, often an error page from a server.',
            'A file with one JSON object per line (.jsonl or .ndjson) is JSON Lines: each line is a separate document, so an ordinary JSON parser rejects the file as a whole, and OpenAnyDoc does not open it yet.',
            'Above 10 MB OpenAnyDoc refuses the file to keep the page responsive; a code editor or a command-line tool such as jq handles larger ones.',
          ],
          links: [{ text: 'JSON validator', path: '/json-validator' }, { text: 'guide to unexpected token errors', path: '/json-unexpected-token' }],
        },
        {
          heading: 'Turn JSON into a spreadsheet',
          paragraphs: ['If the file is a list of records, the JSON to CSV converter flattens it into columns (nested fields become headers such as address.city) and opens the result as a table you can download and open in Excel.'],
          links: [{ text: 'JSON to CSV converter', path: '/json-to-csv' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and say what you see when you open the file (no personal data).`],
        },
      ],
    },
    '/open-xlsx-without-excel': {
      published: '2026-10-30',
      updated: '2026-10-30',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['An .xlsx file is an Excel workbook, but you do not need Excel to open it. A browser-based viewer, LibreOffice, Google Sheets and Apple Numbers all read it for free. They differ in two ways: whether the file is uploaded, and how much of the formatting and formulas they keep.'],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Drop the file on the Excel viewer. Every sheet opens with its values, formulas, number formats and merged cells, and fonts, colours and fills show for .xlsx and .xlsm files up to 8 MB. You can edit cells and formulas, which recalculate, and download the workbook as .xlsx again. It also opens .xls, .xlsm and .ods files. Password-protected workbooks cannot be opened.'],
          links: [{ text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'Free desktop apps',
          paragraphs: ['Both work offline and keep the file on your computer:'],
          list: [
            'LibreOffice Calc (Windows, Mac and Linux) opens and saves .xlsx and keeps formulas and most formatting. It is the closest free equivalent to desktop Excel.',
            'Apple Numbers (Mac, iPhone and iPad) opens .xlsx and can export back to the Excel format; some Excel-only features are converted or dropped.',
          ],
        },
        {
          heading: 'Online suites (the file is uploaded)',
          paragraphs: ['Google Sheets opens an .xlsx after you upload it to Google Drive, and Excel for the web does the same with OneDrive. Both need an account, and the workbook is stored on their servers. That is fine for most files, but not for payroll, customer lists or anything you are not allowed to share.'],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Mobile browsers open OpenAnyDoc the same way: tap Choose a file and pick the workbook from Files or your downloads. Microsoft\'s Excel app and Google Sheets also have phone apps; both work with your account.'],
        },
        {
          heading: 'Only need the data?',
          paragraphs: ['If you only need the numbers in another program, convert the sheet. Excel to CSV turns the first sheet into a UTF-8 CSV that any program reads, and Excel to JSON turns it into a list of objects for code.'],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }, { text: 'Excel to JSON', path: '/excel-to-json' }],
        },
        {
          heading: 'Older and related formats',
          paragraphs: ['Three other extensions turn up next to .xlsx:'],
          list: [
            '.xls is the Excel 97 to 2003 format. The XLS viewer opens it with values, formulas and number formats, without cell styles.',
            '.xlsm is a workbook with macros. Viewers open the data; the macros never run outside Excel, and OpenAnyDoc does not keep them when it saves.',
            '.ods is the OpenDocument spreadsheet that LibreOffice saves by default. Excel and OpenAnyDoc both open it.',
          ],
          links: [{ text: 'XLS viewer', path: '/xls-viewer' }],
        },
        {
          heading: 'What may look different',
          paragraphs: ['Only Excel draws everything. When OpenAnyDoc saves a workbook it keeps values, formulas, number formats, merged cells and column widths, but not charts, images, pivot tables or conditional formats. If a workbook depends on those, keep the original file.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the workbook (no personal data).`],
        },
      ],
    },
    '/open-docx-without-word': {
      published: '2026-11-02',
      updated: '2026-11-02',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A .docx file is a Word document, but you do not need Microsoft Word to open it. A browser-based viewer, LibreOffice Writer, Google Docs and Apple Pages all read it for free. They differ in two ways: whether the file is uploaded, and how much of the layout and formatting they keep.'],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Drop the file on the Word viewer. The document opens as pages with its page size and margins, fonts, tables, pictures, lists, headers and footers with page numbers, and Arabic paragraphs and tables run right to left. You can zoom in, fit the page to your screen and download the original file again. The viewer reads documents but does not edit them yet. Password-protected documents cannot be opened.'],
          links: [{ text: 'Word viewer', path: '/word-viewer' }],
        },
        {
          heading: 'Save it as a PDF',
          paragraphs: ['To send or print the document, open it in the Word viewer and click Print / Save as PDF. Your browser\'s print dialog opens with only the document\'s pages; choose Save as PDF (Microsoft Print to PDF on Windows) as the printer. The PDF is made on your computer, so the document is not uploaded for this either.'],
          links: [{ text: 'Print / Save as PDF', path: '/word-viewer' }],
        },
        {
          heading: 'Free desktop apps',
          paragraphs: ['These work offline and keep the file on your computer:'],
          list: [
            'LibreOffice Writer (Windows, Mac and Linux) opens, edits and saves .docx and keeps most formatting. It is the closest free equivalent to desktop Word.',
            'Apple Pages (Mac, iPhone and iPad) opens .docx and can export back to the Word format; some Word-only features are converted or dropped.',
            'On a Mac, selecting the file in Finder and pressing the Space bar shows a quick preview, and TextEdit opens it with simpler formatting.',
          ],
        },
        {
          heading: 'Online suites (the file is uploaded)',
          paragraphs: ['Google Docs opens a .docx after you upload it to Google Drive, and Word for the web does the same with OneDrive. Both need an account, and the document is stored on their servers. That is fine for most files, but not for contracts, HR letters or anything you are not allowed to share. If you are unsure whether a site uploads your file, you can check it yourself.'],
          links: [{ text: 'check it yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Mobile browsers open OpenAnyDoc the same way: tap Choose a file and pick the document from Files or your downloads; the page fits the screen width. Microsoft\'s Word app and Google Docs also have phone apps; both work with your account.'],
        },
        {
          heading: 'Older and related formats',
          paragraphs: ['A few other extensions turn up next to .docx:'],
          list: [
            '.doc is the Word 97 to 2003 format. OpenAnyDoc does not open it; LibreOffice, Pages and Word do, and can save it as .docx, which then opens here.',
            '.docm is a document with macros and .dotx a template. Save either as a .docx first; the macros never run outside Word.',
            '.odt is the OpenDocument text format that LibreOffice saves by default, and .rtf an older rich text format. Word, LibreOffice and Pages open both.',
          ],
        },
        {
          heading: 'What may look different',
          paragraphs: ['Only Word draws everything exactly. Other apps, OpenAnyDoc included, replace fonts that are not installed on your device with similar ones, so lines and pages can break in other places, and charts, text boxes and some drawing shapes may be simplified. If the exact layout matters, keep the original file or ask the sender for a PDF.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the document (no personal data).`],
        },
      ],
    },
    '/csv-vs-excel-vs-json': {
      published: '2026-10-30',
      updated: '2026-10-30',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Use CSV for one table of plain data that many programs must read, Excel (.xlsx) for workbooks people open and edit with formulas and formatting, and JSON for structured or nested data that programs read and write.'],
        },
        {
          heading: 'CSV: one plain table',
          paragraphs: ['A CSV file is plain text: one line per row, with values separated by commas, or by semicolons in many countries. It has no types, sheets, formulas or formatting, so every program can read it and files stay small. The cost is ambiguity: neither the separator nor the text encoding is stored in the file, which is why CSV files sometimes open in one column or show broken Arabic in Excel.'],
          links: [{ text: 'open in one column', path: '/csv-opens-in-one-column' }, { text: 'show broken Arabic', path: '/fix-arabic-csv-in-excel' }],
        },
        {
          heading: 'Excel (.xlsx): a workbook',
          paragraphs: ['An .xlsx file is a zip archive of XML files in the Office Open XML format. It holds several sheets, typed cells (numbers, dates, text), formulas, number formats, styles, charts and more. A sheet holds at most 1,048,576 rows and 16,384 columns. It is the right format when people will open the file, but it is harder for scripts to write and read than CSV.'],
          links: [{ text: '1,048,576 rows', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'JSON: structured data',
          paragraphs: ['JSON is text too, but it stores objects and lists that can nest: an order can contain a customer and a list of items. Values are typed as strings, numbers, true or false, and null; there is no date type, so dates are written as text. Almost every programming language reads it, which is why APIs use it, but a spreadsheet cannot show the nesting without flattening it.'],
        },
        {
          heading: 'Side by side',
          paragraphs: ['The differences that matter in practice:'],
          list: [
            'Structure: CSV is one table; Excel has several sheets; JSON has nested objects and lists.',
            'Types: CSV has none, everything is text; Excel has numbers, dates, text and true/false; JSON has strings, numbers, true/false and null.',
            'Formulas and formatting: only Excel.',
            'Size: the CSV and JSON formats have no limit; Excel stops at about a million rows per sheet.',
            'Who reads it: CSV, almost everything; Excel, spreadsheet apps and libraries; JSON, programs, APIs and dedicated viewers.',
            'Text encoding: not recorded in a CSV file; Excel and JSON handle Unicode by design, and JSON exchanged between systems must be UTF-8.',
          ],
        },
        {
          heading: 'Which one to pick',
          paragraphs: ['A rule of thumb for the common cases:'],
          list: [
            'Sending a table to someone who will open it in Excel: .xlsx, so nothing about separators or encoding can go wrong.',
            'Importing into a database or another program: CSV in UTF-8.',
            'Data for an app, an API or a configuration file: JSON.',
            'Data with more than about a million rows: CSV or JSON, because Excel cannot hold it in one sheet.',
          ],
        },
        {
          heading: 'Converting between them',
          paragraphs: ['Each conversion runs in your browser, uploads nothing, and opens the result in its own viewer: Excel to CSV, CSV to Excel, Excel to JSON, CSV to JSON and JSON to CSV. Turning JSON into a table flattens nested fields into columns such as address.city, and converting a CSV makes its header row the JSON keys.'],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }, { text: 'CSV to Excel', path: '/csv-to-excel' }, { text: 'Excel to JSON', path: '/excel-to-json' }, { text: 'CSV to JSON', path: '/csv-to-json' }, { text: 'JSON to CSV', path: '/json-to-csv' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} if a conversion does not give you what you expected (no personal data).`],
        },
      ],
    },
    '/anonymize-data-before-sharing': {
      published: '2026-11-01',
      updated: '2026-11-01',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['To anonymize a CSV, Excel or JSON file before you share it, replace or remove every value that points to a person: names, email addresses, phone numbers, ID numbers, bank account and card numbers, addresses and dates of birth. Keep only the columns the other person needs, then check the result before you send it.'],
        },
        {
          heading: 'What counts as personal data in a spreadsheet',
          paragraphs: ['Some columns identify a person on their own; others only do so together. Look for both:'],
          list: [
            'Direct identifiers: full names, email addresses, phone numbers, national ID and residence permit numbers, passport numbers, IBANs and card numbers.',
            'Quasi-identifiers: date of birth, street address, postcode, job title, employer. One of them rarely names anyone, but three together often do.',
            'Free text: notes, comments and descriptions that mention a customer by name or paste in their email or phone number. These are the values people miss most often.',
          ],
        },
        {
          heading: 'Masking, pseudonymization and anonymization',
          paragraphs: [
            'Masking is the general word for hiding real values. Replacing each value with a consistent token, such as EMAIL-000001 for the same address wherever it appears, is pseudonymization: rows can still be matched and counted, and whoever holds the key can turn the tokens back into the original values.',
            'Removing a column, or hiding all but a few characters (****1234), cannot be undone, and it is closer to anonymization. Data protection laws often still treat pseudonymized data as personal data, so if your organization has a data protection or compliance contact, ask them which level a given file needs. This guide explains the techniques; it is not legal advice.',
          ],
        },
        {
          heading: 'How to mask a file in your browser, step by step',
          paragraphs: ['The Mask data tool does this on your device: the file is not uploaded.'],
          list: [
            'Open the Mask data page and choose your CSV, Excel, JSON or TXT file, or press Mask in the CSV, Excel or JSON viewer while the file is open.',
            'Check the columns it picked. Names, emails, phone numbers, IDs, IBANs, card numbers, addresses and dates of birth are ticked for you; open Columns to add anything it missed.',
            'Choose a method for each column: tokens to keep rows matchable, a partial mask to keep the last digits, or removal.',
            'Look at the preview of the first 20 rows, then download the masked copy as CSV, Excel or JSON.',
            'If you will need the real values back, also download the private key and keep it apart from the masked file.',
          ],
          links: [{ text: 'Mask data', path: '/mask-data' }],
        },
        {
          heading: 'Before you paste a file into an AI assistant',
          paragraphs: ['Mask the file first and paste the masked copy into ChatGPT, Claude, Gemini or any other assistant. Consistent tokens keep the analysis useful: the assistant can still count orders per customer or spot duplicates, because the same customer always has the same token. When it answers with tokens, such as "the rows with EMAIL-000017 have three returns", open the Restore tab with the private key to turn a masked file back into real values on your own computer.'],
        },
        {
          heading: 'Doing it by hand in Excel',
          paragraphs: ['For a small file you can mask by hand: delete the columns nobody needs, replace a name column with a formula such as ="Customer "&ROW(), and use Find and Replace for known values. It works, but it is easy to miss a name inside a notes column, the same person gets different stand-ins in different sheets, and nothing records how to undo it.'],
        },
        {
          heading: 'Check the result before you send it',
          paragraphs: ['Open the masked copy and search it before it leaves your computer:'],
          list: [
            'Search for "@" to catch email addresses that remain.',
            'Search for long runs of digits to catch phone, ID, account and card numbers.',
            'Read a few rows of every free-text column.',
            'Make sure the private key is not attached to the same email or uploaded with the file.',
          ],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} if a column was not found that should have been (describe it; no real data).`],
        },
      ],
    },
    '/guides': {
      sections: [
        {
          heading: 'Guides',
          paragraphs: ['Short, practical answers to the problems people hit with CSV, Excel and JSON files and Word documents, each with the free tool that fixes it in your browser:'],
          list: [
            'Why your CSV shows broken Arabic text in Excel',
            'CSV opens in one column in Excel: how to fix the delimiter',
            'CSV too big for Excel: the 1,048,576-row limit and what to do',
            'JSON "unexpected token" errors: find the line and fix it',
            'How to check that a website does not upload your file',
            'How to open a JSON file',
            'How to open an XLSX file without Excel',
            'How to open a DOCX file without Word',
            'CSV vs Excel vs JSON: the differences and when to use each',
            'How to anonymize a CSV or Excel file before sharing it',
          ],
          links: [
            { text: 'Why your CSV shows broken Arabic text in Excel', path: '/fix-arabic-csv-in-excel' },
            { text: 'CSV opens in one column in Excel: how to fix the delimiter', path: '/csv-opens-in-one-column' },
            { text: 'CSV too big for Excel: the 1,048,576-row limit and what to do', path: '/csv-too-big-for-excel' },
            { text: 'JSON "unexpected token" errors: find the line and fix it', path: '/json-unexpected-token' },
            { text: 'How to check that a website does not upload your file', path: '/check-file-upload' },
            { text: 'How to open a JSON file', path: '/open-json-file' },
            { text: 'How to open an XLSX file without Excel', path: '/open-xlsx-without-excel' },
            { text: 'How to open a DOCX file without Word', path: '/open-docx-without-word' },
            { text: 'CSV vs Excel vs JSON: the differences and when to use each', path: '/csv-vs-excel-vs-json' },
            { text: 'How to anonymize a CSV or Excel file before sharing it', path: '/anonymize-data-before-sharing' },
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
    '/check-file-upload': {
      published: '2026-10-30',
      updated: '2026-11-01',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['افتح أدوات المطوّر في متصفحك، وراقب تبويب Network وأنت تفتح ملفًا، وابحث عن طلب يرسل بيانات إلى الخارج (POST أو PUT) أو طلب يقترب حجمه من حجم ملفك. إن لم يظهر شيء من ذلك، وفُتح الملف والشبكة مفصولة، فالموقع قرأه على جهازك أنت.'],
        },
        {
          heading: 'الخطوة 1: افتح تبويب Network',
          paragraphs: ['تعمل الخطوات في أي متصفح على الحاسوب:'],
          list: [
            'Chrome وEdge: اضغط F12، أو Ctrl+Shift+I على ويندوز وCmd+Option+I على ماك، ثم افتح Network.',
            'Firefox: الاختصارات نفسها، ثم Network.',
            'Safari: من الإعدادات ثم «متقدم» فعّل «إظهار ميزات مطوري الويب»، ثم اختر Develop ثم Show Web Inspector وافتح Network.',
            'فعّل Preserve log في Chrome (أو Persist Logs في Firefox) كي تبقى القائمة عند تغيّر الصفحة، واضغط زر المسح لتبدأ بقائمة فارغة.',
          ],
        },
        {
          heading: 'الخطوة 2: افتح ملفًا واقرأ القائمة',
          paragraphs: ['اختر ملفًا أو أفلته، ويُفضَّل ملف تجربة لا ضرر منه. كل سطر في تبويب Network طلب واحد. انظر إلى أعمدة Method وSize وType، ثم اضغط مرشّح Fetch/XHR الذي يعرض الطلبات التي ترسلها شيفرة الصفحة من تلقاء نفسها، وهي الطريقة المعتادة لرفع الملفات:'],
          list: [
            'طلب POST أو PUT بعد اختيار الملف مباشرة، خاصة إن اقترب حجمه من حجم الملف، هو رفع. اضغط عليه وافتح Payload في Chrome أو Request في Firefox لترى ما أُرسل.',
            'طلبات إلى نطاق آخر في تلك اللحظة، مثل عنوان تحليلات أو تخزين أو API، تعني أن شيئًا غادر الصفحة. افحص ما تحمله.',
            'طلبات GET لملفات js وcss والخطوط هي الموقع يحمّل شيفرته. تنزل إليك ولا تحمل ملفك.',
            'مدخلات WebSocket (WS) قد تحمل بيانات أيضًا. افتحها وانظر في تبويب Messages.',
          ],
        },
        {
          heading: 'الخطوة 3: اختبار قطع الاتصال',
          paragraphs: ['حمّل الموقع ثم افصل الشبكة: أطفئ الواي فاي، أو غيّر «No throttling» إلى «Offline» في تبويب Network. افتح الآن ملفًا. إن فُتح وأمكنك العمل عليه، فالقراءة تحدث في متصفحك؛ أما الموقع الذي يحتاج خادمه فيعرض خطأ أو يبقى في انتظار. أعد الاتصال بعدها وراقب تبويب Network دقيقة، لأن الصفحة قادرة نظريًا على الاحتفاظ بنسخة وإرسالها لاحقًا.'],
        },
        {
          heading: 'الخطوة 4: اقرأ سياسة أمان الموقع',
          paragraphs: ['اضغط أول طلب في القائمة (الصفحة نفسها)، وافتح Headers، وابحث عن content-security-policy تحت Response Headers. يذكر جزء connect-src العناوين التي يُسمح لشيفرة الصفحة بالاتصال بها: connect-src \'self\' تعني عنوان الموقع وحده، ويمنع المتصفح نفسه كل ما عداه. السياسة دليل قوي لكنها وحدها ليست برهانًا، فاجمعها مع الخطوتين 2 و3.'],
        },
        {
          heading: 'ماذا تُظهر هذه الاختبارات على OpenAnyDoc',
          paragraphs: ['جرّبها على عارض CSV أو عارض Excel أو عارض JSON: فتح الملف وتعديله وتنزيله لا يرسل أي طلب Fetch/XHR، ولا طلب POST، ولا طلبًا إلى موقع آخر. سياسة الصفحة هي connect-src \'self\'، وبعد أن تكتمل صفحة الأداة تُفتح ملفاتها والشبكة مفصولة. وتذكر سياسة الخصوصية الشيء الوحيد الذي يراه المستضيف Cloudflare: طلبات الصفحات العادية، لا محتوى الملفات أبدًا.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }, { text: 'عارض Excel', path: '/excel-viewer' }, { text: 'عارض JSON', path: '/json-viewer' }, { text: 'سياسة الخصوصية', path: '/privacy' }],
        },
        {
          heading: 'ما لا تغطيه «المعالجة في المتصفح»',
          paragraphs: ['هي تُبعد الملف عن الشبكة، لكنها لا تحميه على جهازك. فكل ما له وصول إلى الجهاز، مثل إضافة متصفح مسموح لها بقراءة كل المواقع، يستطيع رؤية الصفحة. استخدم ملفًا شخصيًا في المتصفح بلا إضافات للملفات الحساسة، وأغلق التبويب عند الانتهاء: يبقى الملف في ذاكرة الصفحة ويختفي حين يُغلق التبويب.', 'وهي تتوقف عند جهازك أيضًا: فحين ترسل الملف إلى أحد أو تلصقه في مساعد ذكاء اصطناعي ينتقل محتواه معه. قبل ذلك أخفِ البيانات الشخصية فيه، ويشرح دليل كيف تخفي البيانات الشخصية قبل مشاركة الملف الخطوات.'],
          links: [{ text: 'كيف تخفي البيانات الشخصية قبل مشاركة الملف', path: '/anonymize-data-before-sharing' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL}. وإن أظهر اختبار على OpenAnyDoc طلبًا لم تتوقعه، فأخبرنا بما رأيت.`],
        },
      ],
    },
    '/open-json-file': {
      published: '2026-10-30',
      updated: '2026-10-30',
      sections: [
        {
          heading: 'ما هو ملف JSON',
          paragraphs: ['JSON نص عادي يخزّن البيانات في كائنات من أزواج "مفتاح": قيمة، وفي قوائم بين أقواس مربعة. تستخدمه واجهات API وملفات الإعدادات وتصدير البيانات. كل برنامج يفتح النصوص يفتح ملف json؛ الصعوبة في قراءته حين يكون سطرًا واحدًا طويلًا أو متداخلًا على مستويات كثيرة.'],
        },
        {
          heading: 'الطريقة الأسرع: افتحه في متصفحك',
          paragraphs: ['أفلت الملف على عارض JSON، أو الصق JSON بضغط Ctrl+V (أو Cmd+V على ماك). يعرض شجرة قابلة للطي، وجدولًا حين يكون الملف قائمة كائنات، والنص بأرقام الأسطر. لا يُرفع شيء، ويعمل على الهاتف أيضًا: اضغط «اختر ملفًا» وحدد ملف json من «الملفات» أو مجلد التنزيلات. تُفتح الملفات حتى 10 ميغابايت.'],
          links: [{ text: 'عارض JSON', path: '/json-viewer' }],
        },
        {
          heading: 'على ويندوز أو ماك دون برامج إضافية',
          paragraphs: ['كل متصفح يفتح JSON: اسحب الملف إلى نافذة Chrome أو Edge أو Firefox. يعرض Firefox عارضًا مدمجًا بشجرة قابلة للطي، وتعرض المتصفحات الأخرى النص. ويفتحه «المفكرة» على ويندوز وTextEdit على ماك نصًا أيضًا: اضغط بزر الفأرة الأيمن على الملف، واختر «فتح باستخدام»، ثم المحرر. يكفيان للملفات الصغيرة، لكن الأسطر الطويلة والتداخل العميق يصعب تتبعهما.'],
        },
        {
          heading: 'في محرر شيفرة',
          paragraphs: ['إن كنت تتعامل مع JSON كثيرًا، فمحرر شيفرة مثل Visual Studio Code المجاني يلوّن الصياغة ويطوي الكائنات ويُعلّم الأخطاء. ويرتّب أمر Format Document (Shift+Alt+F على ويندوز، وShift+Option+F على ماك) ملفًا محفوظًا في سطر واحد.'],
        },
        {
          heading: 'اجعل الملف المحفوظ في سطر واحد مقروءًا',
          paragraphs: ['الملف المحفوظ في سطر واحد صالح لكنه غير مقروء. يضيف منسّق JSON المسافات البادئة بمسافتين أو أربع (أي عدد من 1 إلى 8، أو علامة جدولة)، ويرتّب المفاتيح، ويضغط الملف من جديد حين تحتاج ملفًا صغيرًا.'],
          links: [{ text: 'منسّق JSON', path: '/json-formatter' }],
        },
        {
          heading: 'إن لم يُفتح الملف',
          paragraphs: ['الرسالة تقول السبب في الغالب:'],
          list: [
            '"Unexpected token" أو "Unexpected end of JSON input" تعني أن النص يخالف قاعدة من قواعد JSON: فاصلة زائدة، أو علامات اقتباس مفردة، أو تعليق. يعرض مدقق JSON السطر والعمود ويصلح الأخطاء الشائعة، ويشرح دليل أخطاء unexpected token كل رسالة.',
            'الملف الذي يبدأ بالعلامة < صفحة HTML حُفظت باسم json، وغالبًا صفحة خطأ من خادم.',
            'الملف الذي فيه كائن JSON في كل سطر (jsonl أو ndjson) هو JSON Lines: كل سطر مستند مستقل، فيرفض محلل JSON العادي الملف كله، ولا يفتحه OpenAnyDoc بعد.',
            'فوق 10 ميغابايت يرفض OpenAnyDoc الملف كي تبقى الصفحة سريعة الاستجابة؛ ويتعامل محرر شيفرة أو أداة سطر أوامر مثل jq مع الملفات الأكبر.',
          ],
          links: [{ text: 'مدقق JSON', path: '/json-validator' }, { text: 'دليل أخطاء unexpected token', path: '/json-unexpected-token' }],
        },
        {
          heading: 'حوّل JSON إلى جدول',
          paragraphs: ['إن كان الملف قائمة سجلات، فإن محوّل JSON إلى CSV يسطّح الحقول المتداخلة في أعمدة (تصبح عناوينها مثل address.city)، ويفتح النتيجة جدولًا يمكنك تنزيله وفتحه في Excel.'],
          links: [{ text: 'محوّل JSON إلى CSV', path: '/json-to-csv' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر ما يظهر حين تفتح الملف (دون بيانات شخصية).`],
        },
      ],
    },
    '/open-xlsx-without-excel': {
      published: '2026-10-30',
      updated: '2026-10-30',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف xlsx مصنف Excel، لكنك لا تحتاج إلى Excel لفتحه. يقرؤه مجانًا عارضٌ في المتصفح، وLibreOffice، وGoogle Sheets، وApple Numbers. ويختلفون في أمرين: هل يُرفع الملف، وكم يحفظون من التنسيق والصيغ.'],
        },
        {
          heading: 'في متصفحك، دون رفع أي شيء',
          paragraphs: ['أفلت الملف على عارض Excel. تُفتح كل الأوراق بقيمها وصيغها وتنسيقات أرقامها وخلاياها المدمجة، وتظهر الخطوط والألوان والتعبئة في ملفات xlsx وxlsm حتى 8 ميغابايت. يمكنك تعديل الخلايا والصيغ التي يُعاد حسابها، وتنزيل المصنف بصيغة xlsx من جديد. ويفتح أيضًا ملفات xls وxlsm وods. أما المصنفات المحمية بكلمة مرور فلا تُفتح.'],
          links: [{ text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'برامج مجانية للحاسوب',
          paragraphs: ['كلاهما يعمل دون إنترنت ويُبقي الملف على حاسوبك:'],
          list: [
            'LibreOffice Calc (ويندوز وماك ولينكس) يفتح xlsx ويحفظه، ويحتفظ بالصيغ ومعظم التنسيق. هو أقرب بديل مجاني لبرنامج Excel على الحاسوب.',
            'Apple Numbers (ماك وآيفون وآيباد) يفتح xlsx ويمكنه التصدير بصيغة Excel من جديد؛ وبعض الميزات الخاصة بـ Excel تُحوَّل أو تُحذف.',
          ],
        },
        {
          heading: 'الحزم على الإنترنت (يُرفع الملف)',
          paragraphs: ['يفتح Google Sheets ملف xlsx بعد رفعه إلى Google Drive، ويفعل Excel للويب الشيء نفسه مع OneDrive. كلاهما يحتاج حسابًا، ويُخزَّن المصنف على خوادمهما. هذا مقبول لمعظم الملفات، لكن ليس لكشوف الرواتب أو قوائم العملاء أو أي ملف لا يُسمح لك بمشاركته.'],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['تفتح متصفحات الهاتف OpenAnyDoc بالطريقة نفسها: اضغط «اختر ملفًا» وحدد المصنف من «الملفات» أو التنزيلات. ولتطبيق Excel من مايكروسوفت ولـ Google Sheets تطبيقات للهاتف أيضًا، ويعمل كلاهما بحسابك.'],
        },
        {
          heading: 'تحتاج البيانات فقط؟',
          paragraphs: ['إن كنت تحتاج الأرقام في برنامج آخر فقط، فحوّل الورقة: تحويل Excel إلى CSV يجعل الورقة الأولى ملف CSV بترميز UTF-8 يقرؤه كل برنامج، وتحويل Excel إلى JSON يجعلها قائمة كائنات للبرمجة.'],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }, { text: 'تحويل Excel إلى JSON', path: '/excel-to-json' }],
        },
        {
          heading: 'الصيغ الأقدم والقريبة',
          paragraphs: ['ثلاث امتدادات أخرى تظهر إلى جانب xlsx:'],
          list: [
            'xls صيغة Excel من 97 إلى 2003. يفتحها عارض XLS بالقيم والصيغ وتنسيقات الأرقام، دون أنماط الخلايا.',
            'xlsm مصنف فيه وحدات ماكرو. تفتح العارضات البيانات؛ ولا تعمل وحدات الماكرو خارج Excel، ولا يحتفظ بها OpenAnyDoc عند الحفظ.',
            'ods صيغة جداول OpenDocument التي يحفظ بها LibreOffice افتراضيًا. ويفتحها Excel وOpenAnyDoc كلاهما.',
          ],
          links: [{ text: 'عارض XLS', path: '/xls-viewer' }],
        },
        {
          heading: 'ما قد يبدو مختلفًا',
          paragraphs: ['لا يرسم كل شيء إلا Excel. حين يحفظ OpenAnyDoc المصنف يحتفظ بالقيم والصيغ وتنسيقات الأرقام والخلايا المدمجة وعرض الأعمدة، لكن لا يحتفظ بالمخططات والصور والجداول المحورية والتنسيق الشرطي. إن كان المصنف يعتمد على هذه العناصر، فاحتفظ بالملف الأصلي.'],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف المصنف (دون بيانات شخصية).`],
        },
      ],
    },
    '/open-docx-without-word': {
      published: '2026-11-02',
      updated: '2026-11-02',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف docx مستند وورد، لكنك لا تحتاج إلى برنامج Microsoft Word لفتحه. يقرؤه مجانًا عارضٌ في المتصفح، وLibreOffice Writer، وGoogle Docs، وApple Pages. ويختلفون في أمرين: هل يُرفع الملف، وكم يحفظون من تخطيطه وتنسيقه.'],
        },
        {
          heading: 'في متصفحك، دون رفع أي شيء',
          paragraphs: ['أفلت الملف على عارض وورد. يُفتح المستند صفحاتٍ بمقاس الصفحة وهوامشها، وبخطوطه وجداوله وصوره وقوائمه وترويساته وتذييلاته وأرقام صفحاته، وتظهر الفقرات والجداول العربية من اليمين إلى اليسار. يمكنك التكبير وملاءمة الصفحة مع شاشتك وتنزيل الملف الأصلي من جديد. يعرض العارض المستندات ولا يحررها بعد. أما المستندات المحمية بكلمة مرور فلا تُفتح.'],
          links: [{ text: 'عارض وورد', path: '/word-viewer' }],
        },
        {
          heading: 'احفظه ملف PDF',
          paragraphs: ['لإرسال المستند أو طباعته، افتحه في عارض وورد وانقر «طباعة / حفظ PDF». تُفتح نافذة الطباعة في متصفحك بصفحات المستند وحدها؛ اختر «حفظ بصيغة PDF» (أو Microsoft Print to PDF في ويندوز) طابعةً. يُنشأ ملف PDF على حاسوبك، فلا يُرفع المستند لهذا أيضًا.'],
          links: [{ text: 'طباعة / حفظ PDF', path: '/word-viewer' }],
        },
        {
          heading: 'برامج مجانية للحاسوب',
          paragraphs: ['تعمل دون إنترنت وتُبقي الملف على حاسوبك:'],
          list: [
            'LibreOffice Writer (ويندوز وماك ولينكس) يفتح docx ويحرره ويحفظه، ويحتفظ بمعظم التنسيق. هو أقرب بديل مجاني لبرنامج وورد على الحاسوب.',
            'Apple Pages (ماك وآيفون وآيباد) يفتح docx ويمكنه التصدير بصيغة وورد من جديد؛ وبعض الميزات الخاصة بوورد تُحوَّل أو تُحذف.',
            'على الماك، حدد الملف في Finder واضغط مفتاح المسافة لمعاينة سريعة، ويفتحه TextEdit بتنسيق أبسط.',
          ],
        },
        {
          heading: 'الحزم على الإنترنت (يُرفع الملف)',
          paragraphs: ['يفتح Google Docs ملف docx بعد رفعه إلى Google Drive، ويفعل Word للويب الشيء نفسه مع OneDrive. كلاهما يحتاج حسابًا، ويُخزَّن المستند على خوادمهما. هذا مقبول لمعظم الملفات، لكن ليس للعقود أو خطابات الموارد البشرية أو أي ملف لا يُسمح لك بمشاركته. وإن لم تكن متأكدًا أن موقعًا ما لا يرفع ملفك، يمكنك أن تتحقق بنفسك.'],
          links: [{ text: 'تتحقق بنفسك', path: '/check-file-upload' }],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['تفتح متصفحات الهاتف OpenAnyDoc بالطريقة نفسها: اضغط «اختر ملفًا» وحدد المستند من «الملفات» أو التنزيلات، فتُلاءم الصفحة عرض الشاشة. ولتطبيق Word من مايكروسوفت ولـ Google Docs تطبيقات للهاتف أيضًا، ويعمل كلاهما بحسابك.'],
        },
        {
          heading: 'الصيغ الأقدم والقريبة',
          paragraphs: ['امتدادات أخرى تظهر إلى جانب docx:'],
          list: [
            'doc صيغة وورد من 97 إلى 2003. لا يفتحها OpenAnyDoc؛ ويفتحها LibreOffice وPages ووورد، ويمكنها حفظها بصيغة docx التي تُفتح هنا بعد ذلك.',
            'docm مستند فيه وحدات ماكرو، وdotx قالب. احفظ أيًّا منهما بصيغة docx أولًا؛ ولا تعمل وحدات الماكرو خارج وورد.',
            'odt صيغة النصوص المفتوحة التي يحفظ بها LibreOffice افتراضيًا، وrtf صيغة نص منسق أقدم. يفتحهما وورد وLibreOffice وPages.',
          ],
        },
        {
          heading: 'ما قد يبدو مختلفًا',
          paragraphs: ['وورد وحده يرسم كل شيء كما هو تمامًا. البرامج الأخرى، ومنها OpenAnyDoc، تستبدل الخطوط غير المثبتة على جهازك بخطوط قريبة منها، فقد تنكسر الأسطر والصفحات في أماكن أخرى، وقد تُبسَّط المخططات ومربعات النص وبعض الأشكال. إن كان التخطيط الدقيق مهمًا، فاحتفظ بالملف الأصلي أو اطلب من المرسل نسخة PDF.'],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف المستند (دون بيانات شخصية).`],
        },
      ],
    },
    '/csv-vs-excel-vs-json': {
      published: '2026-10-30',
      updated: '2026-10-30',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['استخدم CSV لجدول واحد من بيانات بسيطة يجب أن تقرأه برامج كثيرة، وExcel (xlsx) لمصنفات يفتحها الناس ويعدّلونها بالصيغ والتنسيق، وJSON للبيانات المنظمة أو المتداخلة التي تقرؤها البرامج وتكتبها.'],
        },
        {
          heading: 'CSV: جدول نصي واحد',
          paragraphs: ['ملف CSV نص عادي: سطر لكل صف، والقيم مفصولة بفواصل، أو بفواصل منقوطة في بلدان كثيرة. لا أنواع فيه ولا أوراق ولا صيغ ولا تنسيق، فيقرؤه كل برنامج ويبقى صغيرًا. والثمن هو الغموض: لا يُخزَّن الفاصل ولا ترميز النص داخل الملف، ولهذا يُفتح ملف CSV أحيانًا في عمود واحد أو تظهر العربية فيه مشوّهة في Excel.'],
          links: [{ text: 'في عمود واحد', path: '/csv-opens-in-one-column' }, { text: 'تظهر العربية فيه مشوّهة', path: '/fix-arabic-csv-in-excel' }],
        },
        {
          heading: 'Excel (xlsx): مصنف',
          paragraphs: ['ملف xlsx أرشيف zip لملفات XML بصيغة Office Open XML. يحمل أوراقًا عدة، وخلايا لها أنواع (أرقام وتواريخ ونصوص)، وصيغًا، وتنسيقات أرقام، وأنماطًا، ومخططات وغيرها. تتسع الورقة الواحدة لـ 1,048,576 صفًا و16,384 عمودًا على الأكثر. هي الصيغة المناسبة حين يفتح الناس الملف، لكنها أصعب على البرامج كتابةً وقراءةً من CSV.'],
          links: [{ text: '1,048,576 صفًا', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'JSON: بيانات منظمة',
          paragraphs: ['JSON نص أيضًا، لكنه يخزّن كائنات وقوائم يمكن أن تتداخل: قد يحوي الطلب عميلًا وقائمة أصناف. والقيم لها أنواع: نصوص وأرقام وtrue أو false وnull؛ ولا يوجد نوع للتاريخ، فتُكتب التواريخ نصًا. تقرؤه كل لغات البرمجة تقريبًا، ولهذا تستخدمه واجهات API، لكن جدول البيانات لا يعرض التداخل إلا بعد تسطيحه.'],
        },
        {
          heading: 'مقارنة سريعة',
          paragraphs: ['الفروق التي تهم في العمل اليومي:'],
          list: [
            'البنية: CSV جدول واحد؛ وExcel أوراق عدة؛ وJSON كائنات وقوائم متداخلة.',
            'الأنواع: لا أنواع في CSV، فكل القيم نص؛ وفي Excel أرقام وتواريخ ونصوص وصح/خطأ؛ وفي JSON نصوص وأرقام وtrue/false وnull.',
            'الصيغ والتنسيق: في Excel وحده.',
            'الحجم: لا حد في صيغتي CSV وJSON؛ ويتوقف Excel عند نحو مليون صف في الورقة.',
            'من يقرؤه: CSV يقرؤه كل شيء تقريبًا؛ وExcel تقرؤه برامج الجداول ومكتباتها؛ وJSON تقرؤه البرامج وواجهات API والعارضات المخصصة.',
            'ترميز النص: لا يُسجَّل في ملف CSV؛ ويتعامل Excel وJSON مع Unicode بطبيعتهما، ويجب أن يكون JSON المتبادل بين الأنظمة بترميز UTF-8.',
          ],
        },
        {
          heading: 'أيها تختار',
          paragraphs: ['قاعدة عامة للحالات الشائعة:'],
          list: [
            'ترسل جدولًا لشخص سيفتحه في Excel: xlsx، فلا يمكن أن يخطئ الفاصل أو الترميز.',
            'تستورد إلى قاعدة بيانات أو برنامج آخر: CSV بترميز UTF-8.',
            'بيانات لتطبيق أو API أو ملف إعدادات: JSON.',
            'بيانات تتجاوز نحو مليون صف: CSV أو JSON، لأن Excel لا يتسع لها في ورقة واحدة.',
          ],
        },
        {
          heading: 'التحويل بينها',
          paragraphs: ['كل تحويل يعمل في متصفحك ولا يرفع شيئًا، ويفتح النتيجة في عارضها: Excel إلى CSV، وCSV إلى Excel، وExcel إلى JSON، وCSV إلى JSON، وJSON إلى CSV. تحويل JSON إلى جدول يسطّح الحقول المتداخلة في أعمدة مثل address.city، وتحويل ملف CSV يجعل صف العناوين مفاتيح JSON.'],
          links: [{ text: 'Excel إلى CSV', path: '/excel-to-csv' }, { text: 'CSV إلى Excel', path: '/csv-to-excel' }, { text: 'Excel إلى JSON', path: '/excel-to-json' }, { text: 'CSV إلى JSON', path: '/csv-to-json' }, { text: 'JSON إلى CSV', path: '/json-to-csv' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} إن لم يعطك تحويل ما توقعته (دون بيانات شخصية).`],
        },
      ],
    },
    '/anonymize-data-before-sharing': {
      published: '2026-11-01',
      updated: '2026-11-01',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لإخفاء هوية الأشخاص في ملف CSV أو Excel أو JSON قبل مشاركته، استبدل أو احذف كل قيمة تدل على شخص: الأسماء والبريد الإلكتروني وأرقام الهواتف وأرقام الهوية وأرقام الحسابات البنكية والبطاقات والعناوين وتواريخ الميلاد. أبقِ فقط الأعمدة التي يحتاجها من ستشاركه، ثم راجع النتيجة قبل الإرسال.'],
        },
        {
          heading: 'ما الذي يُعد بيانات شخصية في جدول البيانات',
          paragraphs: ['بعض الأعمدة تكشف الشخص وحدها، وبعضها لا يكشفه إلا مع غيره. ابحث عن النوعين:'],
          list: [
            'معرّفات مباشرة: الأسماء الكاملة والبريد الإلكتروني وأرقام الهواتف وأرقام الهوية الوطنية والإقامة وجوازات السفر والآيبان وأرقام البطاقات.',
            'معرّفات غير مباشرة: تاريخ الميلاد والعنوان والرمز البريدي والمسمى الوظيفي وجهة العمل. نادرًا ما يكشف أحدها شخصًا، لكن ثلاثة منها معًا كثيرًا ما تكشفه.',
            'النص الحر: الملاحظات والتعليقات والأوصاف التي تذكر العميل باسمه أو تحتوي بريده أو رقم هاتفه. وهذه أكثر القيم التي يغفل عنها الناس.',
          ],
        },
        {
          heading: 'الإخفاء والترميز المستعار وإخفاء الهوية',
          paragraphs: [
            'الإخفاء كلمة عامة لحجب القيم الحقيقية. استبدال كل قيمة برمز ثابت، مثل EMAIL-000001 للعنوان نفسه أينما ظهر، هو ترميز مستعار: تبقى الصفوف قابلة للربط والعد، ويستطيع من يملك المفتاح إعادة الرموز إلى قيمها الأصلية.',
            'أما حذف العمود أو إخفاء كل شيء عدا بضعة أحرف (****1234) فلا يمكن التراجع عنه، وهو أقرب إلى إخفاء الهوية. وكثيرًا ما تعدّ قوانين حماية البيانات البيانات ذات الترميز المستعار بيانات شخصية، فإن كان في جهتك مسؤول عن حماية البيانات أو الامتثال فاسأله عن المستوى الذي يحتاجه الملف. يشرح هذا الدليل الأساليب، وليس استشارة قانونية.',
          ],
        },
        {
          heading: 'كيف تخفي البيانات في متصفحك خطوة بخطوة',
          paragraphs: ['تؤدي أداة إخفاء البيانات ذلك على جهازك، ولا يُرفع الملف.'],
          list: [
            'افتح صفحة إخفاء البيانات واختر ملف CSV أو Excel أو JSON أو TXT، أو اضغط إخفاء في عارض CSV أو Excel أو JSON والملف مفتوح.',
            'راجع الأعمدة التي اختارتها الأداة. تُحدَّد لك الأسماء والبريد وأرقام الهواتف والهويات والآيبان والبطاقات والعناوين وتواريخ الميلاد، وافتح قائمة الأعمدة لإضافة ما فاتها.',
            'اختر طريقة لكل عمود: الرموز لتبقى الصفوف قابلة للربط، أو الإخفاء الجزئي لإبقاء آخر الأرقام، أو الحذف.',
            'راجع معاينة أول 20 صفًا، ثم نزّل النسخة المخفية بصيغة CSV أو Excel أو JSON.',
            'إن احتجت القيم الحقيقية لاحقًا فنزّل المفتاح الخاص أيضًا واحفظه بعيدًا عن الملف المخفي.',
          ],
          links: [{ text: 'إخفاء البيانات', path: '/mask-data' }],
        },
        {
          heading: 'قبل أن تلصق ملفًا في مساعد ذكاء اصطناعي',
          paragraphs: ['أخفِ البيانات أولًا والصق النسخة المخفية في ChatGPT أو Claude أو Gemini أو أي مساعد آخر. تُبقي الرموز الثابتة التحليل مفيدًا: يستطيع المساعد عدّ الطلبات لكل عميل أو اكتشاف التكرار، لأن العميل نفسه يحمل الرمز نفسه دائمًا. وحين يجيب بالرموز، مثل "الصفوف ذات EMAIL-000017 فيها ثلاثة مرتجعات"، افتح تبويب الاستعادة مع المفتاح الخاص لتعيد الملف المخفي إلى قيمه الحقيقية على جهازك.'],
        },
        {
          heading: 'الإخفاء يدويًا في Excel',
          paragraphs: ['في الملف الصغير يمكنك الإخفاء يدويًا: احذف الأعمدة التي لا يحتاجها أحد، واستبدل عمود الأسماء بصيغة مثل ="Customer "&ROW()، واستخدم البحث والاستبدال للقيم المعروفة. ينجح ذلك، لكن من السهل أن يفوتك اسم داخل عمود ملاحظات، ويأخذ الشخص نفسه بدائل مختلفة في أوراق مختلفة، ولا شيء يسجّل كيف تتراجع عنه.'],
        },
        {
          heading: 'راجع النتيجة قبل الإرسال',
          paragraphs: ['افتح النسخة المخفية وابحث فيها قبل أن تغادر جهازك:'],
          list: [
            'ابحث عن "@" لتلتقط عناوين البريد المتبقية.',
            'ابحث عن سلاسل الأرقام الطويلة لتلتقط أرقام الهواتف والهويات والحسابات والبطاقات.',
            'اقرأ بضعة صفوف من كل عمود نص حر.',
            'تأكد أن المفتاح الخاص ليس مرفقًا بالرسالة نفسها ولا مرفوعًا مع الملف.',
          ],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} إن لم يُكتشف عمود كان يجب اكتشافه (صِفه دون بيانات حقيقية).`],
        },
      ],
    },
    '/guides': {
      sections: [
        {
          heading: 'الأدلة',
          paragraphs: ['إجابات قصيرة وعملية للمشكلات التي يصطدم بها الناس مع ملفات CSV وExcel وJSON ومستندات وورد، مع الأداة المجانية التي تحلها في متصفحك:'],
          list: [
            'لماذا تظهر العربية في ملف CSV برموز غريبة في Excel',
            'ملف CSV يُفتح في عمود واحد في Excel: كيف تصلح الفاصل',
            'ملف CSV أكبر من أن يفتحه Excel: حد 1,048,576 صفًا وما تفعله',
            'أخطاء JSON "unexpected token": اعثر على السطر وأصلحه',
            'كيف تتحقق من أن الموقع لا يرفع ملفك',
            'كيف تفتح ملف JSON',
            'كيف تفتح ملف XLSX بدون Excel',
            'كيف تفتح ملف DOCX بدون وورد',
            'CSV أم Excel أم JSON: الفروق ومتى تستخدم كلًا منها',
            'كيف تخفي البيانات الشخصية في ملف CSV أو Excel قبل مشاركته',
          ],
          links: [
            { text: 'لماذا تظهر العربية في ملف CSV برموز غريبة في Excel', path: '/fix-arabic-csv-in-excel' },
            { text: 'ملف CSV يُفتح في عمود واحد في Excel: كيف تصلح الفاصل', path: '/csv-opens-in-one-column' },
            { text: 'ملف CSV أكبر من أن يفتحه Excel: حد 1,048,576 صفًا وما تفعله', path: '/csv-too-big-for-excel' },
            { text: 'أخطاء JSON "unexpected token": اعثر على السطر وأصلحه', path: '/json-unexpected-token' },
            { text: 'كيف تتحقق من أن الموقع لا يرفع ملفك', path: '/check-file-upload' },
            { text: 'كيف تفتح ملف JSON', path: '/open-json-file' },
            { text: 'كيف تفتح ملف XLSX بدون Excel', path: '/open-xlsx-without-excel' },
            { text: 'كيف تفتح ملف DOCX بدون وورد', path: '/open-docx-without-word' },
            { text: 'CSV أم Excel أم JSON: الفروق ومتى تستخدم كلًا منها', path: '/csv-vs-excel-vs-json' },
            { text: 'كيف تخفي البيانات الشخصية في ملف CSV أو Excel قبل مشاركته', path: '/anonymize-data-before-sharing' },
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
