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
            'Microsoft\'s note on opening CSV UTF-8 files (checked 24 November 2026) says a UTF-8 CSV opens normally in Excel if it was saved with a byte order mark, or BOM, a three-byte marker at the start of the file. Most exports leave the BOM out, and that is when Arabic turns into symbols. Tab-separated files (.tsv) have exactly the same problem.',
          ],
          links: [{ text: 'Tab-separated files', path: '/tsv-viewer' }, { text: 'note on opening CSV UTF-8 files', path: 'https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032' }],
        },
        {
          heading: 'Fix 1: download an Excel-ready copy (free, nothing uploaded)',
          paragraphs: ['OpenAnyDoc adds the missing marker for you, and the file never leaves your computer:'],
          list: [
            'Open the CSV viewer and drop the file on the page. It checks for a BOM, UTF-16 and UTF-8, and falls back to Windows-1256 for older Arabic files, or Windows-1252 when the letters look Western European; the status bar at the bottom shows the encoding it found.',
            'If the file has Arabic text and no BOM, an "Excel copy" button appears in the status bar. Click it.',
            'A copy named like your file with "-excel" added is downloaded, with the UTF-8 marker and Windows line endings. Double-click that copy and Excel shows the Arabic correctly.',
          ],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'Fix 2: import the file instead of opening it',
          paragraphs: [
            'Microsoft\'s note on opening CSV UTF-8 files (checked 24 November 2026) gives a way to open a UTF-8 file that has no BOM: go to Data, then Get Data, From File, From Text/CSV, and pick the file. It works, but you have to repeat it for every file, and the result is a workbook rather than the CSV itself.',
            'The normal Download button in OpenAnyDoc also adds the marker whenever the file holds non-English text, so any copy you edit there opens cleanly in Excel too. If the file has more rows than an Excel sheet holds, the large CSV viewer opens it in the browser instead.',
          ],
          links: [{ text: 'note on opening CSV UTF-8 files', path: 'https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032' }, { text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'Fix 3: write the file the right way next time',
          paragraphs: [
            'If the CSV comes from code or an export tool, write UTF-8 with a BOM for files that will be opened in Excel, or export an .xlsx workbook instead, which stores its encoding and never has this problem. You can check an XLSX in the Excel viewer without opening Excel.',
          ],
          links: [{ text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'The reverse case: an older Arabic file',
          paragraphs: [
            'Exports from older Arabic systems are often Windows-1256 with no UTF-8 at all. Browsers, editors and most modern tools assume UTF-8 and show such a file as nonsense. OpenAnyDoc reads such a file as Windows-1256 automatically, and if the guess is wrong you can pick the encoding yourself in the status bar. Downloading then writes UTF-8 with the marker, so the file opens correctly everywhere.',
          ],
        },
        {
          heading: 'When the letters are right but the order is wrong',
          paragraphs: [
            'If the Arabic letters themselves are correct but numbers, brackets or English words sit on the wrong side, the encoding is fine. That is text direction. In OpenAnyDoc, cells with Arabic text are shown right-to-left automatically.',
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
            'A CSV file has no header that says which character separates the fields. "Comma-separated" is the name, but when you open a .csv directly, Excel uses your computer\'s current settings, and the list separator is set in the Windows region settings, as Microsoft\'s page on importing and exporting text files explains (checked 24 November 2026). The same page says that when the decimal separator is a comma, Excel uses a semicolon as the list separator, so a file with commas lands in one column. The reverse happens too: a file exported with semicolons opens in one column on a PC whose list separator is a comma.',
          ],
          links: [{ text: 'page on importing and exporting text files', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }],
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
            'In Excel go to Data, then Get Data, From File, From Text/CSV. The preview shows the data with a Delimiter box: choose comma, semicolon, tab or a custom character, then Load. The steps are in Microsoft\'s page on importing and exporting text files (checked 24 November 2026). It works, but you have to do it for every file, and the result is a workbook, not the CSV itself.',
            'If the data is already in one column, select it and use Data, then Text to Columns, choose Delimited, tick the separator, and finish. That fixes the sheet in front of you without reopening the file; Microsoft\'s page on splitting text into columns has the steps (checked 24 November 2026).',
          ],
          links: [{ text: 'page on importing and exporting text files', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }, { text: 'page on splitting text into columns', path: 'https://support.microsoft.com/en-us/office/split-text-into-different-columns-30b14928-5550-41f5-97ca-7a3e9c363ed7' }],
        },
        {
          heading: 'Fix 3: change the list separator in Windows',
          paragraphs: [
            'The lasting fix for one PC is the list separator in Windows. On Windows 11, search for Region Settings, select Administrative language settings, then Additional settings on the Formats tab, and type the separator in the List separator box on the Numbers tab. Microsoft\'s page on importing and exporting text files gives these steps (checked 24 November 2026) and notes that the change affects other programs on the computer too, so change it only if every file you open uses the same separator.',
          ],
          links: [{ text: 'page on importing and exporting text files', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }],
        },
        {
          heading: 'Quotes, line breaks and numbers',
          paragraphs: [
            'A field that contains the separator itself, a line break or a quote must be wrapped in double quotes ("Riyadh, KSA"), with inner quotes doubled. A file that does this correctly survives any of the fixes above; one that does not will also break in the viewer, which then shows the uneven rows so you can see where. Leading zeros (postal codes, IDs) are a separate problem: Excel drops them when it treats the value as a number, as Microsoft\'s page on keeping leading zeros explains (checked 24 November 2026), while the viewer keeps them as written.',
          ],
          links: [{ text: 'page on keeping leading zeros', path: 'https://support.microsoft.com/topic/1bf7b935-36e1-4985-842f-5dfa51f85fe7' }],
        },
        {
          heading: 'Still in one column?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and paste the first two lines of the file (no personal data). The separator is usually visible right there.`],
        },
      ],
    },
    '/csv-too-big-for-excel': {
      published: '2026-10-22',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'What you see',
          paragraphs: [
            'Excel warns "This data set is too large for the Excel grid. If you save this workbook, you\'ll lose data that wasn\'t loaded.", and the sheet stops at row 1,048,576, as Microsoft\'s page on a data set too large for the Excel grid describes (checked 24 November 2026). The export looked fine; it is simply larger than a worksheet can hold.',
          ],
          links: [{ text: 'page on a data set too large for the Excel grid', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }],
        },
        {
          heading: 'Why Excel cannot open it',
          paragraphs: [
            'A worksheet holds at most 1,048,576 rows and 16,384 columns, according to Microsoft\'s Excel specifications and limits page (checked 24 November 2026). A CSV with more rows is cut at that line. Google Sheets has its own limit: up to 20 million cells or 100MB for a spreadsheet created in or converted to Google Sheets, according to Google\'s page on files you can store in Google Drive (checked 24 November 2026).',
          ],
          links: [{ text: 'Excel specifications and limits page', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }, { text: 'files you can store in Google Drive', path: 'https://support.google.com/drive/answer/37603' }],
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
            'Excel can load all the rows for a PivotTable without putting them in cells. Open a blank workbook, go to Data, From Text/CSV, pick the file and select Import, then in the preview choose Load To and PivotTable Report. The steps are in Microsoft\'s page on a data set too large for the Excel grid (checked 24 November 2026).',
          ],
          links: [{ text: 'page on a data set too large for the Excel grid', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }],
        },
        {
          heading: 'Option 3: split or summarise the file first',
          paragraphs: [
            'If the goal is a report, aggregate before Excel: a database (most can import a CSV directly), a few lines of Python with pandas, or the command line (split -l 1000000 file.csv part_ on macOS and Linux) cut the file into pieces Excel can open. For a one-off look at the data, the browser viewer above is faster than any of these.',
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
      updated: '2026-11-23',
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
          paragraphs: ['Firefox and Microsoft Edge open a JSON file without extra software. Firefox shows it in a built-in viewer where objects and arrays fold open and closed, as its JSON viewer documentation describes. Edge shows the text as it is, with a Pretty-print checkbox that indents a file saved on one line, as Microsoft\'s page on viewing JSON in Edge describes (both checked 24 November 2026).'],
          links: [{ text: 'JSON viewer documentation', path: 'https://firefox-source-docs.mozilla.org/devtools-user/json_viewer/index.html' }, { text: 'viewing JSON in Edge', path: 'https://learn.microsoft.com/en-us/microsoft-edge/web-platform/json-viewer' }],
        },
        {
          heading: 'In a code editor',
          paragraphs: ['If you work with JSON often, a code editor such as Visual Studio Code helps. Its Format Document command (Shift+Alt+F on Windows, Shift+Option+F on a Mac) indents a file saved on one line, according to its basic editing documentation (checked 24 November 2026).'],
          links: [{ text: 'basic editing documentation', path: 'https://code.visualstudio.com/docs/editing/codebasics' }],
        },
        {
          heading: 'Make a one-line file readable',
          paragraphs: ['A file saved on a single line is valid but unreadable. The JSON formatter indents it with 2 or 4 spaces (or 1, 3 or 8 spaces, or a tab), can sort the keys, and minifies it again when you need a small file.'],
          links: [{ text: 'JSON formatter', path: '/json-formatter' }],
        },
        {
          heading: 'If the file will not open',
          paragraphs: ['The message usually says why:'],
          list: [
            '"Unexpected token" or "Unexpected end of JSON input" means the text breaks a JSON rule: a trailing comma, single quotes or a comment. The JSON validator shows the line and column and repairs the common mistakes, and the guide to unexpected token errors explains each message.',
            'A file that starts with < is an HTML page saved with a .json name, often an error page from a server.',
            'A file with one JSON object per line (.jsonl or .ndjson) is JSON Lines: each line is a separate document, so an ordinary JSON parser rejects the file as a whole. The JSON viewer opens .jsonl and .ndjson files line by line.',
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
      updated: '2026-11-23',
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
            'LibreOffice Calc (Windows, Mac and Linux) opens and saves .xlsx files, according to LibreOffice\'s system requirements and its help page on Microsoft Office files (checked 24 November 2026).',
            'Apple Numbers opens Excel spreadsheets and can export a copy to Excel, according to Apple\'s Numbers guide (checked 24 November 2026).',
          ],
          links: [{ text: 'system requirements', path: 'https://www.libreoffice.org/get-help/system-requirements/' }, { text: 'help page on Microsoft Office files', path: 'https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_user.html' }, { text: 'Numbers guide', path: 'https://support.apple.com/guide/numbers/tan9f3c54bdc/mac' }],
        },
        {
          heading: 'Online suites (the file is uploaded)',
          paragraphs: ['Google Sheets opens an .xlsx file that is in Google Drive, according to Google\'s page on using Office files (checked 24 November 2026). It needs a Google account, and the workbook is stored on Google\'s servers. That is fine for most files, but not for payroll, customer lists or anything you are not allowed to share.'],
          links: [{ text: 'page on using Office files', path: 'https://support.google.com/docs/answer/6055139' }],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Mobile browsers open OpenAnyDoc the same way: tap Choose a file and pick the workbook from Files or your downloads.'],
        },
        {
          heading: 'Only need the data?',
          paragraphs: ['If you only need the numbers in another program, convert the sheet. Excel to CSV turns the first sheet into a UTF-8 CSV that any program reads, and Excel to JSON turns it into a list of objects for code.'],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }, { text: 'Excel to JSON', path: '/excel-to-json' }],
        },
        {
          heading: 'Need to change the file, not just open it?',
          paragraphs: ['Besides editing cells in the viewer, these tools work on whole workbooks in your browser, without uploading them:'],
          list: [
            'Excel to PDF saves the sheets as PDF pages, fitted to the page width, with text you can still search.',
            'Merge Excel joins several workbooks into one .xlsx, every sheet as its own tab.',
            'Split Excel cuts a workbook into smaller .xlsx files by sheet, by number of rows or by the values of a column.',
            'Unprotect Excel removes sheet and workbook structure protection from a file you own, so you can edit it again. A file that needs a password to open stays locked without that password.',
            'Repair Excel reads a damaged workbook leniently and saves its data into a new, clean .xlsx file.',
            'Excel to Word turns one sheet into a table you can edit in a Word document.',
          ],
          links: [{ text: 'Excel to PDF', path: '/excel-to-pdf' }, { text: 'Merge Excel', path: '/merge-excel' }, { text: 'Split Excel', path: '/split-excel' }, { text: 'Unprotect Excel', path: '/unprotect-excel' }, { text: 'Repair Excel', path: '/repair-excel' }, { text: 'Excel to Word', path: '/excel-to-word' }],
        },
        {
          heading: 'Older and related formats',
          paragraphs: ['Three other extensions turn up next to .xlsx:'],
          list: [
            '.xls is the Excel 97 to 2003 format. The XLS viewer opens it with values, formulas and number formats, without cell styles.',
            '.xlsm is a workbook with macros. Viewers open the data; the macros never run outside Excel, and OpenAnyDoc does not keep them when it saves.',
            '.ods is the OpenDocument spreadsheet format. Excel opens it, according to Microsoft\'s list of file formats supported in Excel (checked 24 November 2026), and so does OpenAnyDoc.',
          ],
          links: [{ text: 'XLS viewer', path: '/xls-viewer' }, { text: 'list of file formats supported in Excel', path: 'https://support.microsoft.com/en-us/office/file-formats-that-are-supported-in-excel-0943ff2c-6014-4e8d-aaea-b83d51d46247' }],
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
      updated: '2026-11-23',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A .docx file is a Word document, but you do not need Microsoft Word to open it. A browser-based viewer, LibreOffice Writer, Google Docs and Apple Pages all read it for free. They differ in two ways: whether the file is uploaded, and how much of the layout and formatting they keep.'],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Drop the file on the Word viewer. The document opens as pages with its page size and margins, fonts, tables, pictures, lists, headers and footers with page numbers, and Arabic paragraphs and tables run right to left. You can zoom in, fit the page to your screen and download the original file again. The viewer shows documents without editing them; the browser tools further down change them. Password-protected documents cannot be opened.'],
          links: [{ text: 'Word viewer', path: '/word-viewer' }],
        },
        {
          heading: 'Save it as a PDF',
          paragraphs: ['To send or print the document, open it in the Word viewer and click Print / Save as PDF, or use Word to PDF to get a PDF with searchable text in one step. With Print / Save as PDF, your browser\'s print dialog opens with only the document\'s pages; choose Save as PDF (Microsoft Print to PDF on Windows) as the printer. Either way the PDF is made on your computer, so the document is not uploaded for this either.'],
          links: [{ text: 'Print / Save as PDF', path: '/word-viewer' }, { text: 'Word to PDF', path: '/word-to-pdf' }],
        },
        {
          heading: 'Need to change the file, not just open it?',
          paragraphs: ['These tools change a Word document in your browser, without uploading it:'],
          list: [
            'Word to PDF saves the document as a PDF, page by page, with text you can still select and search.',
            'Find and replace in Word replaces a word or phrase everywhere, headers and footnotes included, and keeps its formatting.',
            'Merge Word (in beta) joins two or more documents into one .docx, each starting on a new page.',
            'Remove Word comments deletes the comments and accepts or rejects every tracked change, for a clean copy to send.',
            'Word metadata shows who wrote, edited and saved the document, and removes those details in one click.',
          ],
          links: [{ text: 'Word to PDF', path: '/word-to-pdf' }, { text: 'Find and replace in Word', path: '/word-find-replace' }, { text: 'Merge Word', path: '/merge-word' }, { text: 'Remove Word comments', path: '/remove-word-comments' }, { text: 'Word metadata', path: '/word-metadata' }],
        },
        {
          heading: 'Free desktop apps',
          paragraphs: ['These work offline and keep the file on your computer:'],
          list: [
            'LibreOffice Writer (Windows, Mac and Linux) opens and saves .docx files, according to LibreOffice\'s system requirements and its help page on Microsoft Office files (checked 24 November 2026).',
            'Apple Pages on a Mac opens .doc and .docx files and can save them as Word files, according to Apple\'s Pages guide (checked 24 November 2026).',
            'On a Mac, selecting the file in Finder and pressing the Space bar shows a quick preview, as Apple\'s page on previewing files describes (checked 24 November 2026).',
          ],
          links: [{ text: 'system requirements', path: 'https://www.libreoffice.org/get-help/system-requirements/' }, { text: 'help page on Microsoft Office files', path: 'https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_user.html' }, { text: 'Pages guide', path: 'https://support.apple.com/guide/pages/tancdeedb11c/mac' }, { text: 'page on previewing files', path: 'https://support.apple.com/guide/mac-help/mchlgtd_prev01/mac' }],
        },
        {
          heading: 'Online suites (the file is uploaded)',
          paragraphs: ['Google Docs opens a .docx file that is in Google Drive, according to Google\'s page on using Office files (checked 24 November 2026). It needs a Google account, and the document is stored on Google\'s servers. That is fine for most files, but not for contracts, HR letters or anything you are not allowed to share. If you are unsure whether a site uploads your file, you can check it yourself.'],
          links: [{ text: 'page on using Office files', path: 'https://support.google.com/docs/answer/6055139' }, { text: 'check it yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Mobile browsers open OpenAnyDoc the same way: tap Choose a file and pick the document from Files or your downloads; the page fits the screen width.'],
        },
        {
          heading: 'Older and related formats',
          paragraphs: ['A few other extensions turn up next to .docx:'],
          list: [
            '.doc is the Word 97 to 2003 format. OpenAnyDoc does not open it; LibreOffice, Pages and Word do, and can save it as .docx, which then opens here.',
            '.docm is a document with macros and .dotx a template. The Word viewer opens both; the macros never run outside Word.',
            '.odt is the OpenDocument text format, and .rtf an older rich text format. The Word viewer here opens .odt.',
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
    '/sign-pdf-without-adobe': {
      published: '2026-11-17',
      updated: '2026-11-17',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['You do not need Adobe Acrobat to sign a PDF. You can sign it for free in your browser with OpenAnyDoc\'s Sign PDF, where nothing is uploaded, with Preview on a Mac, with Markup on an iPhone or iPad, or by drawing on the PDF in Microsoft Edge on Windows. All of these place a picture of your signature on the page. If the person who asked for the signature needs a certificate-based digital signature, you also need a digital ID, and LibreOffice can apply one for free.'],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Sign PDF works on any computer or phone with a modern browser, and the PDF never leaves your device:'],
          list: [
            'Open Sign PDF and choose your PDF, or drop it on the page.',
            'Click Create signature, then draw it with a mouse, finger or pen, type your name in one of three signature styles, or upload a photo of your signature (a white background can be made see-through).',
            'Drag the signature where it belongs and drag its corner to make it bigger or smaller.',
            'To sign every page, select the signature and copy it to all pages or to the pages you type, such as 1-3, 5.',
            'Click Save a copy, check the preview and download the signed PDF. Your signature is kept only while the page is open.',
          ],
          links: [{ text: 'Sign PDF', path: '/sign-pdf' }],
        },
        {
          heading: 'On a Mac: Preview',
          paragraphs: ['Preview, the PDF app that comes with every Mac, signs PDFs without any download. Open the PDF in Preview, show the Markup toolbar and click the Sign button. Create a signature with the trackpad, with the Mac\'s camera (sign on white paper and hold it up), or with an iPhone or iPad, then click the signature to place it and drag it into position. Saved signatures are available on your other Macs that use iCloud Drive. Apple describes the steps in its Preview guide (checked 24 November 2026).'],
          links: [{ text: 'Preview guide', path: 'https://support.apple.com/guide/preview/prvw35725/mac' }],
        },
        {
          heading: 'On an iPhone or iPad: Markup',
          paragraphs: ['Open the PDF in the Files app, tap the Markup button, tap the Add button and choose Add Signature. Sign your name with your finger and tap Done, then drag the signature where it belongs and drag a blue dot to resize it. iPhone saves the signature for the next time you add one with Markup. Apple describes the steps in its iPhone guide (checked 24 November 2026).'],
          links: [{ text: 'iPhone guide', path: 'https://support.apple.com/guide/iphone/fill-forms-sign-documents-create-signatures-iph1d3607e5c/ios' }],
        },
        {
          heading: 'On Windows: Microsoft Edge',
          paragraphs: ['Microsoft Edge has a built-in PDF reader, and Microsoft\'s page on the Edge PDF reader (checked 24 November 2026) says you can ink on a PDF to sign it or fill out a form. Open the PDF in Edge and write your signature in ink with a mouse, pen or finger. It is quick, but the signature is drawn freehand each time; Sign PDF in the browser lets you type or upload one instead and copy it to every page.'],
          links: [{ text: 'page on the Edge PDF reader', path: 'https://learn.microsoft.com/en-us/deployedge/microsoft-edge-pdf' }, { text: 'Sign PDF in the browser', path: '/sign-pdf' }],
        },
        {
          heading: 'A picture of a signature is not a digital signature',
          paragraphs: ['Every method above adds a visual signature: a picture of your handwriting placed on the page, like signing a printout. It does not prove who signed, and someone with a PDF editor could copy it.', 'A certificate-based digital signature is different. It uses a digital ID issued to you (by an employer, a bank, a government service or a certificate authority) and seals the file, so any later change shows. Some contracts, government forms and regulated processes require this kind.', 'If you have a digital ID, LibreOffice can sign an existing PDF with it for free: open LibreOffice, choose File, Digital Signatures, Sign Existing PDF (checked 24 November 2026), and follow the steps. Whether a visual signature is enough depends on who asked for it; when in doubt, ask them or your legal team.'],
          links: [{ text: 'Sign Existing PDF', path: 'https://help.libreoffice.org/latest/en-US/text/shared/01/signexistingpdf.html' }],
        },
        {
          heading: 'Before you send it',
          paragraphs: ['A few checks save a second round:'],
          list: [
            'Open the signed PDF again and look at every signed page; in OpenAnyDoc the preview shows the first pages before you download.',
            'If the PDF is a form, fill in its fields first with Fill PDF form, and tick Flatten on save so the answers cannot be changed.',
            'If you need to send several signed documents as one file, put them together with Merge PDF.',
          ],
          links: [{ text: 'Fill PDF form', path: '/fill-pdf' }, { text: 'Merge PDF', path: '/merge-pdf' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you need (no personal data).`],
        },
      ],
    },
    '/pdf-tools-without-upload': {
      published: '2026-11-17',
      updated: '2026-11-25',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['The three popular PDF sites below, iLovePDF, the PDF24 website and Sejda, upload your file to their servers, process it there and delete it later, according to their own pages. That is fine for many documents. If a file must not leave your device, use a tool that processes it locally: OpenAnyDoc in the browser, or a desktop app that works offline, such as PDF24 Creator on Windows. The facts below come from each service\'s own pages, checked on 25 November 2026.'],
        },
        {
          heading: 'How popular PDF sites handle your file (checked 25 November 2026)',
          paragraphs: ['What each service says on its own pages; follow the links for the current wording:'],
          list: [
            'iLovePDF: files are uploaded over HTTPS and kept "for a maximum of 2 hours" so you can download the result, then removed. Its pricing page lists a desktop app for Mac and Windows and mobile apps for iOS and Android on the Premium plan (US$4 a month billed yearly, or US$7 billed monthly), not on the free plan.',
            'PDF24 Tools (website): uploaded files are deleted from the server after one hour, and its FAQ says "All processing servers are located in data centers within the EU". The online tools are free "without restriction". PDF24 Creator, its Windows app, works offline.',
            'Sejda (website): its privacy policy says uploaded and output files are stored for processing and then permanently deleted, with no backups. For its AI features, the policy says content is sent to an AI sub-processor for transient processing and not stored. The policy also mentions Sejda Desktop, a downloadable app.',
          ],
          links: [{ text: 'iLovePDF', path: 'https://www.ilovepdf.com/help/faq' }, { text: 'pricing page', path: 'https://www.ilovepdf.com/pricing' }, { text: 'PDF24 Tools', path: 'https://tools.pdf24.org/en/faq' }, { text: 'Sejda', path: 'https://www.sejda.com/privacy' }],
        },
        {
          heading: 'Where those services do more',
          paragraphs: ['To be fair about the choice, these services offer things OpenAnyDoc does not, according to their own pages linked above:'],
          list: [
            'iLovePDF Premium merges up to 500 files in one batch (25 on the free plan), handles up to 4 GB per task, and adds Workflows, PDF to PDF/A and digital signatures. Its desktop and mobile apps are part of Premium too.',
            'PDF24 has no usage limits on its free online tools, and PDF24 Creator brings them to a Windows PC and works offline.',
            'Sejda has a desktop app as well as its website.',
            'Server tools don\'t depend on the memory of your own device, so very large batches can be easier there.',
            'OpenAnyDoc\'s Compress PDF keeps picture resolution, so a tool that lowers resolution can shrink a scanned PDF further.',
          ],
        },
        {
          heading: 'What OpenAnyDoc does differently',
          paragraphs: ['Every OpenAnyDoc PDF tool runs in your browser. The file is read, changed and saved on your device, and the page\'s security policy only lets it contact its own site, so there is no upload to delete later. You can check this yourself in the browser\'s network panel while a tool runs. The tools have no account, watermark or daily limit, read Arabic PDFs correctly, and the code is open source. Each tool works offline once you have used it with a connection; OCR PDF and Translate PDF also load their language data from this site the first time.'],
          links: [{ text: 'check this yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'The PDF tools that never upload',
          paragraphs: ['Each of these works on your own device:'],
          list: [
            'Merge, split, remove or extract pages, organize and rotate PDF pages.',
            'Edit PDF (text boxes, highlights, drawings, shapes, pictures), Sign PDF and Fill PDF form.',
            'Add page numbers, a watermark, or a header and footer.',
            'Convert JPG, PNG, WebP, TIFF or SVG to PDF, and PDF to JPG, PNG, text or its embedded images.',
            'Make a scanned PDF searchable with OCR PDF, in English or Arabic.',
            'Convert Word and Excel files to PDF, and PDF to Word, Excel or PowerPoint.',
            'Protect PDF with a password, or Unlock PDF when you know its password.',
            'Compress PDF, Flatten PDF, PDF to grayscale and Remove PDF metadata.',
          ],
          links: [{ text: 'Merge', path: '/merge-pdf' }, { text: 'OCR PDF', path: '/ocr-pdf' }, { text: 'Word and Excel files to PDF', path: '/word-to-pdf' }, { text: 'Protect PDF', path: '/protect-pdf' }, { text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'Compress PDF', path: '/compress-pdf' }, { text: 'Edit PDF', path: '/edit-pdf' }, { text: 'Sign PDF', path: '/sign-pdf' }, { text: 'Fill PDF form', path: '/fill-pdf' }, { text: 'Add page numbers', path: '/add-page-numbers' }, { text: 'JPG', path: '/jpg-to-pdf' }, { text: 'PDF to JPG', path: '/pdf-to-jpg' }],
        },
        {
          heading: 'Which to choose',
          paragraphs: ['A simple rule of thumb:'],
          list: [
            'Contracts, payslips, IDs, medical or customer files: use a tool that keeps the file on your device.',
            'You need to make a PDF smaller: Compress PDF re-saves its pictures in your browser and shows the size before and after; for resolution settings, use a desktop app.',
            'You are on a work computer where you cannot install software: a browser tool with no upload, such as OpenAnyDoc, avoids both problems.',
            'Your organisation has rules about where files may be processed: follow them, and ask your IT or compliance team when unsure.',
          ],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you need (no personal data).`],
        },
      ],
    },
    '/open-txt-file': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A .txt file is plain text, so any text editor opens it and you do not need to install anything. On Windows it opens in Notepad, on a Mac in TextEdit, on an iPhone or iPad in the Files app, and on Android in Google Docs, Google Drive or the text viewer of your file manager. Every web browser can show one too. If the text appears as strange symbols, the program has guessed the wrong encoding; the fix is further down.'],
        },
        {
          heading: 'On Windows',
          paragraphs: ['Double-click the file and it opens in Notepad, which comes with every version of Windows. If another program opens it instead, right-click the file, choose Open with, then Notepad, and choose to always use it if you want it as the default.'],
          list: [
            'Notepad shows the text exactly as it is, with no formatting.',
            'Microsoft Word also opens .txt files, and if the text looks garbled you can pick the encoding when you open the file, as Microsoft\'s page on choosing text encoding explains (checked 24 November 2026).',
            'Free code editors such as Notepad++ or Visual Studio Code open text files too.',
          ],
          links: [{ text: 'page on choosing text encoding', path: 'https://support.microsoft.com/en-us/office/choose-text-encoding-when-you-open-and-save-files-60d59c21-88b5-4006-831c-d536d42fd861' }],
        },
        {
          heading: 'On a Mac',
          paragraphs: ['TextEdit opens plain text files. To read one without opening any app, select it in Finder and press the Space bar for a quick preview. If TextEdit shows the wrong characters, open TextEdit, Settings (Preferences on older versions of macOS), Open and Save, set the plain text encoding for opening files to the right one, for example Unicode (UTF-8), and open the file again. Apple describes these steps in its page on previewing files and its TextEdit guide (checked 24 November 2026).'],
          links: [{ text: 'page on previewing files', path: 'https://support.apple.com/guide/mac-help/mchlgtd_prev01/mac' }, { text: 'TextEdit guide', path: 'https://support.apple.com/guide/textedit/txted1028/mac' }],
        },
        {
          heading: 'On a phone or tablet',
          paragraphs: ['On an iPhone or iPad, tap the file in the Files app to read the text; to change it, share it to an app that edits text, such as Pages. On Android, tap the file in your file manager or downloads: most phones show plain text directly, or offer Google Docs or Google Drive to open it. A phone browser works as well: in the TXT editor here the tools fold into a sheet and the text fills the screen.'],
          links: [{ text: 'TXT editor', path: '/txt-viewer' }],
        },
        {
          heading: 'In your browser, without installing anything',
          paragraphs: [
            'Every browser displays a text file: drag it onto an open window, or press Ctrl+O (Cmd+O on a Mac) and choose it. That shows the text, but you cannot change it.',
            'To read and edit it, drop the file on the TXT editor. It opens with line numbers and search, and lets you type, find and replace, sort lines, remove duplicates and change case; Arabic lines show right to left. Download saves a copy in the encoding and line endings you choose. Your browser reads the file itself, so it is never uploaded, and the page keeps working offline once it has loaded.',
          ],
          links: [{ text: 'TXT editor', path: '/txt-viewer' }],
        },
        {
          heading: 'When the text shows strange characters',
          paragraphs: ['A text file stores only bytes. The encoding says which bytes stand for which letters, and the file does not say which one it uses, so every program guesses. When the guess is wrong, Arabic turns into strings like "Ø§Ù„" or question marks, and accented letters break. Three encodings cover almost every file you will meet:'],
          list: [
            'UTF-8 is the standard today and covers every language. Some programs put an invisible marker at the start of the file, the byte order mark or BOM, so that others recognise it.',
            'UTF-16 is written by some Windows programs and exports. A program that expects UTF-8 shows it with gaps between the letters, or as nonsense.',
            'Windows-1256 is the older Arabic encoding of Windows, still produced by some older systems. Programs that assume UTF-8 cannot read its Arabic letters.',
          ],
        },
        {
          heading: 'Fix the encoding without uploading the file',
          paragraphs: [
            'Drop the file on the TXT editor. It recognises UTF-8 with or without a BOM, UTF-16, Windows-1256 and Windows-1252, and shows the encoding it found. If the text still looks wrong, choose another one in the Encoding group and click Reopen with this encoding.',
            'To pass the file on safely, download it as UTF-8, which every modern program reads; choose UTF-8 with BOM if it will be opened in older Windows programs that otherwise guess the old code page.',
          ],
          links: [{ text: 'TXT editor', path: '/txt-viewer' }],
        },
        {
          heading: 'Very large text files',
          paragraphs: [
            'Log files and data exports can run to hundreds of megabytes. Simple editors load the whole file at once and can become slow or stop responding with very large ones.',
            'The TXT editor has been tested with a 46 MB file, whose first lines appear in under half a second. Files over 50 MB show a warning first, and a file of more than about 2 million characters opens in a fast read view that draws only the lines on screen, while search and the other tools still work on the whole text. Beyond that, the limit is your device\'s memory. If the file is really a table of values separated by commas, the large CSV viewer is the better fit.',
          ],
          links: [{ text: 'TXT editor', path: '/txt-viewer' }, { text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'What a .txt file is',
          paragraphs: ['A .txt file holds only characters: letters, digits, spaces and line breaks. There is no bold, no font, no pictures and no page layout, which is why every device can open it and why it is used for notes, logs, lists and passing data between programs. Each line ends with an invisible line break: Windows writes CRLF, while Mac and Linux write LF. Most editors read both, and the TXT editor can save either. Files with other extensions, such as .log or .md, are plain text too and open in any text editor in the same way.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you see when you open the file (no personal data).`],
        },
      ],
    },
    '/open-csv-without-excel': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A CSV file is plain text: one row per line, with the values separated by commas. Excel is only one of many programs that read it. A browser-based viewer, Google Sheets, LibreOffice Calc, Apple Numbers and even a text editor all open it for free. They differ in three ways: whether the file is uploaded, how large a file they handle, and whether they get the separator and the encoding right.'],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Drop the file on the CSV viewer. It finds the separator (comma, semicolon, tab or pipe) and the encoding for you, and shows the rows as a table you can sort, filter, search and edit, with undo and redo. You can run SQL queries on the table, draw a chart of the rows shown, and download the file again as CSV, or as an Excel workbook when someone needs one. Your browser reads the file itself, so customer lists and exports never leave your computer, and leading zeros and long numbers stay as they were written.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'Free spreadsheet apps',
          paragraphs: ['Each of these opens a CSV as a sheet:'],
          list: [
            'LibreOffice Calc (Windows, Mac and Linux) shows an import window first, where you choose the character set and the separator before the data loads.',
            'Apple Numbers (Mac, iPhone and iPad) opens a CSV directly and can export it as an Excel file.',
            'Google Sheets opens a CSV after you upload it to Google Drive or bring it in with File, Import. It needs an account and keeps the file on Google\'s servers, which is fine for most files but not for payroll or customer data.',
          ],
        },
        {
          heading: 'In a text editor',
          paragraphs: ['Notepad, TextEdit or any code editor shows the raw file: each line is a row and the commas are visible. It is the quickest way to see which separator the file uses, whether the first line holds the headers, and whether values are wrapped in quotes. A wide table is hard to read this way, and deleting a single comma shifts every value after it into the wrong column, so edit with care.'],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Mobile browsers open the CSV viewer the same way: tap Choose a file and pick the CSV from Files or your downloads. On an iPhone or iPad, Numbers opens it as a spreadsheet, and on Android the Google Sheets app opens it with your Google account.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'Files too big for Excel',
          paragraphs: ['An Excel sheet stops at 1,048,576 rows. The large CSV viewer has no row limit of its own: a 120,000-row file opens in under a second, and the real limit is your device\'s memory, with a warning above 50 MB. Why Excel cuts the file short, and other ways around it, are explained in CSV too big for Excel.'],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }, { text: 'CSV too big for Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'The file opens in one column',
          paragraphs: ['If every row lands in column A, the file uses a separator your program does not expect: commas where your region uses semicolons, or the other way round. A viewer that detects the separator, LibreOffice\'s import window and Excel\'s own import from text all solve it; CSV opens in one column explains each fix. To rewrite the file with the separator you need, use Change CSV delimiter.'],
          links: [{ text: 'CSV opens in one column', path: '/csv-opens-in-one-column' }, { text: 'Change CSV delimiter', path: '/change-csv-delimiter' }],
        },
        {
          heading: 'Arabic text turns into symbols',
          paragraphs: ['When Arabic shows as "Ø§Ù„" or question marks, the program read a UTF-8 file with the wrong encoding. The CSV viewer reads UTF-8, UTF-16 and older Windows-1256 and Windows-1252 files correctly and shows Arabic right to left. For Excel itself, the guide to broken Arabic in a CSV shows how to make a copy that opens correctly with a double-click.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }, { text: 'broken Arabic in a CSV', path: '/fix-arabic-csv-in-excel' }],
        },
        {
          heading: 'What a CSV can and cannot hold',
          paragraphs: ['A CSV holds only values: no formulas, colours, column widths or second sheets. Anything you format in a spreadsheet app is lost when you save it as CSV again, so keep a workbook when you need those, and use the CSV to pass data between programs. The first line usually holds the column names, and a value that contains the separator or a line break is wrapped in double quotes.'],
        },
        {
          heading: 'Need an Excel file after all?',
          paragraphs: ['If a colleague or a system asks for an .xlsx, CSV to Excel turns the file into a workbook in your browser, with a bold header row, real numbers, and values like 007 or long IDs kept as text so no digit is lost. You never need Excel installed to make it, and the CSV is not uploaded.'],
          links: [{ text: 'CSV to Excel', path: '/csv-to-excel' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the file (no personal data).`],
        },
      ],
    },
    '/open-pptx-without-powerpoint': {
      published: '2026-11-20',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A .pptx file is a PowerPoint presentation, but you do not need PowerPoint to open it. A browser-based viewer, Google Slides, LibreOffice Impress and Apple Keynote all open it for free. Microsoft\'s standalone PowerPoint Viewer was retired on 30 April 2018, according to Microsoft\'s page on viewing a presentation without PowerPoint (checked 24 November 2026), so these are the options today. They differ in whether the file is uploaded, whether you can edit it, and how faithfully they draw the slides.'],
          links: [{ text: 'viewing a presentation without PowerPoint', path: 'https://support.microsoft.com/en-us/office/view-a-presentation-without-powerpoint-2f1077ab-9a4e-41ba-9f75-d55bd9b231a6' }],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Drop the file on the PowerPoint viewer. It is in beta and shows presentations; it does not edit them. What it does:'],
          list: [
            'Shows the slides with their text, fonts, pictures, tables, shapes and backgrounds, and moves between them with thumbnails, the previous and next buttons or the arrow keys.',
            'Shows the speaker notes under the slide, and a grid of all slides to jump to any of them.',
            'Presents full screen, or in a presenter view with the current and next slide, your notes and a timer while the audience sees the slide in a second window.',
            'Searches the slide text and notes, prints one slide per page, and saves the slides as a PDF or as PNG pictures.',
            'Does not play animations or transitions, and simplifies some effects and charts.',
          ],
          links: [{ text: 'PowerPoint viewer', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'Free apps that also edit',
          paragraphs: ['If you need to change the slides, these open and save .pptx:'],
          list: [
            'LibreOffice Impress (Windows, Mac and Linux) opens, edits and saves .pptx, and opens old .ppt files too.',
            'Apple Keynote (Mac, iPhone and iPad) opens .pptx and can export back to PowerPoint; some fonts may be replaced.',
            'Google Slides opens a .pptx after you upload it to Google Drive, and PowerPoint for the web does the same with OneDrive. Both need an account and store the presentation on their servers, which is fine for most decks but not for unreleased plans or figures.',
          ],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Mobile browsers open the PowerPoint viewer the same way: tap Choose a file and pick the presentation; the slide fills the width of the screen and the buttons move between slides. Microsoft says its free PowerPoint mobile app opens presentations too.'],
          links: [{ text: 'PowerPoint viewer', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'Old .ppt files and related formats',
          paragraphs: ['The .ppt extension is the PowerPoint 97 to 2003 format, a different kind of file. OpenAnyDoc\'s viewer does not open it. Open it in LibreOffice Impress or PowerPoint and save it as .pptx, and the new file opens here. These related extensions do open in the viewer:'],
          list: [
            '.ppsx is a slide show: the same content as a .pptx, set to start presenting when opened in PowerPoint.',
            '.potx is a template that new presentations are made from.',
            '.pptm is a presentation with macros. The slides open; the macros are never run.',
          ],
        },
        {
          heading: 'Need the words, not the slides?',
          paragraphs: ['To quote a deck in a report, search it or paste it into an AI chat, turn it into text. PowerPoint to Markdown writes each slide\'s title and bullet points, with the speaker notes under them, as a clean outline; pictures, charts and the layout are left out. The viewer itself can also export an outline of titles, text and notes as Markdown or plain text.'],
          links: [{ text: 'PowerPoint to Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'Need to change the file, not just open it?',
          paragraphs: ['The viewer does not edit slides, but these tools work on a whole presentation in your browser, without uploading it:'],
          list: [
            'PowerPoint to PDF saves the presentation as a PDF, one page per slide, with text you can still select and search.',
            'Merge PowerPoint (in beta) joins two or more presentations into one .pptx file, in the order you choose.',
            'Split PowerPoint cuts a presentation into several .pptx files, one per slide or by the slide ranges you type.',
            'Search PowerPoint finds a word in every slide and speaker note, with the slide number of each match.',
            'Watermark PowerPoint puts a text watermark such as CONFIDENTIAL or DRAFT on every slide.',
          ],
          links: [{ text: 'PowerPoint to PDF', path: '/pptx-to-pdf' }, { text: 'Merge PowerPoint', path: '/merge-pptx' }, { text: 'Split PowerPoint', path: '/split-pptx' }, { text: 'Search PowerPoint', path: '/search-pptx' }, { text: 'Watermark PowerPoint', path: '/watermark-pptx' }],
        },
        {
          heading: 'Which option to choose',
          paragraphs: ['A simple rule of thumb:'],
          list: [
            'You only need to read or present the slides, and the deck is confidential: a browser viewer that does not upload it.',
            'You need to change the slides: LibreOffice Impress or Keynote, on your own computer.',
            'You are working on the deck with other people: Google Slides or PowerPoint for the web, if the content may be stored there.',
            'You only need the words: PowerPoint to Markdown.',
          ],
          links: [{ text: 'PowerPoint to Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'What may look different',
          paragraphs: ['Only PowerPoint draws everything exactly. Other apps, OpenAnyDoc included, replace fonts that are not installed on your device with similar ones, so text can wrap differently. In the viewer here, SmartArt shows as PowerPoint last drew it, charts are approximate, embedded video may not play, and a slide it cannot draw yet shows a note instead of a broken layout, while the other slides are not affected. If the exact look matters, ask the sender for a PDF, which every browser opens.'],
          links: [{ text: 'which every browser opens', path: '/open-pdf-without-adobe' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the presentation (no personal data).`],
        },
      ],
    },
    '/open-pdf-without-adobe': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['You do not need Adobe Acrobat or Adobe Reader to open a PDF. Every modern web browser, including Chrome, Edge, Firefox and Safari, opens one: drag the file onto a window. A Mac opens PDFs in Preview, an iPhone or iPad in the Files or Books app, and an Android phone in the Google Drive app. All of these are free and usually already installed.'],
        },
        {
          heading: 'On a computer',
          paragraphs: ['What each system already has:'],
          list: [
            'Windows: Microsoft Edge has a built-in PDF reader; Microsoft\'s page on the Edge PDF reader lists zoom, search, highlights and basic form filling (checked 24 November 2026).',
            'Mac: Preview opens PDFs, fills in forms, adds text and signatures, and reorders pages.',
            'Linux: the document viewer that comes with most desktops opens PDFs.',
            'Any system: Chrome, Firefox and Safari show a PDF in a tab. Drag the file onto the window, or press Ctrl+O (Cmd+O on a Mac) and choose it.',
          ],
        },
        {
          heading: 'In your browser here, with nothing uploaded',
          paragraphs: ['Drop the file on the PDF viewer. It shows every page in one scroll with thumbnails, a page counter, zoom from 50% to 400%, fit to width and rotation, and searches the text with highlighted matches, Arabic included, in reading order. A password-protected PDF asks for its password, which is used only in that tab. The viewer looks the same on every device and keeps working offline once the page has loaded, and the file is read by your own browser, so it is never uploaded.'],
          links: [{ text: 'PDF viewer', path: '/pdf-viewer' }],
        },
        {
          heading: 'On a phone',
          paragraphs: ['On an iPhone or iPad, tap the PDF in the Files app to read it; the Markup button adds text and a signature, and the Books app keeps PDFs in a library. On Android, the Google Drive app opens PDFs from your downloads or email. The PDF viewer here works in a phone browser too, with the page thumbnails opening from the toolbar.'],
          links: [{ text: 'PDF viewer', path: '/pdf-viewer' }],
        },
        {
          heading: 'Why won\'t my PDF open?',
          paragraphs: ['Most PDFs that refuse to open, or open wrongly, have one of these problems:'],
          list: [
            'It asks for a password. The file is encrypted: type the password in your viewer. If you know the password and want a copy without it, Unlock PDF removes it on your device. It does not guess or crack passwords, so use it only for files you are allowed to unlock.',
            'It is damaged. A download that stopped early, a broken email attachment or a faulty export leaves a file that viewers call damaged. Repair PDF rebuilds the file\'s index and saves the pages that are intact; a page that is missing from the file cannot be brought back.',
            'It opens, but you cannot select or search the text. The PDF is a scan, so each page is a picture. OCR PDF reads the words in English or Arabic and gives you a PDF you can search, select and copy.',
            'It is not really a PDF. A file that was renamed to .pdf, or one of only a few bytes, opens in no PDF viewer; download it again or ask the sender for a new copy.',
          ],
          links: [{ text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'Repair PDF', path: '/repair-pdf' }, { text: 'OCR PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'Fill in and sign a PDF without Adobe',
          paragraphs: [
            'Microsoft Edge fills in basic PDF forms, and Preview does on a Mac. To fill in a form and save a clean copy without uploading it, use Fill PDF form: it handles text fields, multi-line boxes, checkboxes, radio buttons and drop-down lists, in English or Arabic, and can flatten the answers onto the page. XFA forms, an older Adobe format, are not supported there, and Microsoft\'s page on the Edge PDF reader says Edge does not support them either (checked 24 November 2026).',
            'For a signature, the guide to signing a PDF without Adobe walks through the free options on a computer and on a phone, and when a picture of a signature is not enough.',
          ],
          links: [{ text: 'Fill PDF form', path: '/fill-pdf' }, { text: 'signing a PDF without Adobe', path: '/sign-pdf-without-adobe' }],
        },
        {
          heading: 'Choose which app opens your PDFs',
          paragraphs: ['If PDFs keep opening in a program you do not want, change the default. On Windows, choose a default app for .pdf files in Settings, under Default apps, as Microsoft\'s page on changing default programs describes. On a Mac, select a PDF in Finder, choose File, Get Info, pick the app under Open with and click Change All, as Apple\'s Mac User Guide describes (both checked 24 November 2026). On a phone, the share or open menu lets you pick the app each time.'],
          links: [{ text: 'changing default programs', path: 'https://support.microsoft.com/en-gb/windows/change-default-programs-in-windows-27af8dcd-6d1c-44d0-a999-80d2c29b4f15' }, { text: 'Mac User Guide', path: 'https://support.apple.com/guide/mac-help/mh35597/mac' }],
        },
        {
          heading: 'Do you need Acrobat at all?',
          paragraphs: ['Adobe Acrobat Reader is free as well, and Adobe\'s Acrobat Reader page says text and image editing needs a paid Acrobat plan (checked 24 November 2026). You need neither to read, print, search, fill in or sign a PDF, or to merge, split, rotate and number its pages: browsers and the free PDF tools here do that on your own device.'],
          links: [{ text: 'PDF tools', path: '/pdf-tools' }, { text: 'Acrobat Reader page', path: 'https://www.adobe.com/acrobat/pdf-reader.html' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what happens when you open the file (no personal data).`],
        },
      ],
    },
    '/fix-arabic-text-copied-from-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Arabic text comes out reversed or broken because a PDF does not store sentences. It stores the shape of each letter and its place on the page, and many PDF readers copy those shapes in the order they sit on the page, from left to right, so the words come out backwards or with separated letters. Open the file in OpenAnyDoc\'s PDF viewer, or save its text with PDF to text or PDF to Word: they rebuild Arabic lines in reading order before you copy them.'],
          links: [{ text: 'PDF viewer', path: '/pdf-viewer' }, { text: 'PDF to text', path: '/pdf-to-text' }, { text: 'PDF to Word', path: '/pdf-to-word' }],
        },
        {
          heading: 'Why it happens',
          paragraphs: [
            'A Word document or a web page keeps text as it was typed: the letters in typing order, and the program shapes and orders them for the screen. A PDF is closer to a printout. It keeps the drawn shapes of the letters with the place on the page where each one goes, plus only as much information about the text behind them as the program that made the PDF chose to write.',
            'The page still looks right, because each shape is drawn where it belongs; the trouble shows only when the text is taken out, and each reader turns the shapes back into text in its own way. For Arabic, three things can go wrong:',
          ],
          list: [
            'Letters stored in visual order. Some programs place every Arabic letter on its own, left to right as it appears on the page. A reader that copies them in that order gives you each word backwards and the words of the line in reverse.',
            'Joined shapes instead of letters. Arabic letters change shape at the start, middle and end of a word. Some PDFs record those shapes, called presentation forms, instead of the ordinary letters, so pasted text can look right yet not match when you search for it, or show letters that do not join.',
            'Mixed lines. A number, a date or an English word inside an Arabic sentence runs left to right, and brackets face the other way in right-to-left text. A reader that ignores direction moves them to the wrong place or flips the brackets.',
          ],
        },
        {
          heading: 'Copy Arabic in reading order, with nothing uploaded',
          paragraphs: [
            'OpenAnyDoc\'s PDF tools rebuild right-to-left lines before you see the text. When a line is mostly Arabic, its pieces are put back in reading order from right to left, an English word or a number inside it keeps its own order, brackets are turned back into the character that was typed, and joined shapes become ordinary Arabic letters. Pick the tool that matches what you need:',
          ],
          list: [
            'A few lines: open the file in the PDF viewer, select the text and copy it. Ctrl+F (Cmd+F on a Mac) searches the Arabic text and highlights the matches.',
            'All of the text: PDF to text saves every page as a .txt file, Arabic in reading order, with optional markers where each page starts.',
            'Text you want to edit: PDF to Word writes an editable .docx with Arabic paragraphs set right to left, keeping headings, lists and pictures.',
          ],
          links: [{ text: 'PDF viewer', path: '/pdf-viewer' }, { text: 'PDF to text', path: '/pdf-to-text' }, { text: 'PDF to Word', path: '/pdf-to-word' }],
        },
        {
          heading: 'Private files stay on your device',
          paragraphs: ['The PDF is read by your own browser and never uploaded, so this works for contracts, statements and other documents you would not send to a website. You can check that nothing is uploaded in your browser\'s network panel. Once the page has loaded, the viewer keeps working without an internet connection, and PDF to text does too after you have used it once.'],
          links: [{ text: 'check that nothing is uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'Nothing to select? The PDF is a scan',
          paragraphs: [
            'A scanned PDF, or one made from phone photos, holds a picture of each page and no text at all. Nothing can be selected, search finds nothing, and PDF to text tells you it found no text. Run OCR PDF first: it reads the words on each page, in Arabic, English or both, and lays them over the page as invisible text, so the page looks exactly as before. Then copy from the new file in the viewer, or open it in PDF to text or PDF to Word.',
            'Text recognition makes mistakes, more so on blurry, small or handwritten text, so check names, numbers and dates against the page before you rely on them.',
          ],
          links: [{ text: 'OCR PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'Check the result yourself',
          paragraphs: ['A one-minute test tells you whether a copy is right:'],
          list: [
            'Pick a line and note its first word, the one at its right edge. Copy the line and paste it into a note or an email.',
            'The first word should be at the start of the pasted line (on the right in a right-to-left editor), and the letters of each word should join as they do on the page.',
            'If the last word comes first, or the letters stand apart, the copy is reversed or broken: copy it again from the PDF viewer here.',
            'Search the PDF for an Arabic word you can see on the page. If the viewer finds and highlights it, the text inside the file is usable.',
          ],
        },
        {
          heading: 'What it cannot fix',
          paragraphs: ['Some limits are worth knowing before you start:'],
          list: [
            'Tables come out as lines of text, not as a table. PDF to Word keeps the columns of a line apart with tab stops; PDF to Excel reads tables into cells.',
            'A PDF that needs a password to open must be unlocked first; Unlock PDF removes the password when you know it.',
            'If a PDF\'s letters copy as symbols in every reader, the file has no usable text behind them. Treat it like a scan: OCR PDF leaves pages that already have text as they are unless you choose otherwise, so choose to read those pages too.',
          ],
          links: [{ text: 'PDF to Excel', path: '/pdf-to-excel' }, { text: 'Unlock PDF', path: '/unlock-pdf' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe how the copied text looks (no personal data).`],
        },
      ],
    },
    '/cant-edit-text-in-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A PDF is a finished page, not a document you type into: it stores each letter at a fixed place, with no paragraphs that rewrap when you change a word, so clicking the text does nothing in most readers. To change a few words, cover them and type new text on top with Edit PDF. To rewrite whole paragraphs, convert the PDF to Word, edit it there and save a new PDF.'],
          links: [{ text: 'Edit PDF', path: '/edit-pdf' }],
        },
        {
          heading: 'Why a PDF has no editable paragraphs',
          paragraphs: [
            'A word processor keeps text as paragraphs: change a word and the line rewraps, the paragraph grows and the next page moves down. A PDF is made for the opposite job, to look the same on every screen and printer. When it is created, the text is broken into lines and letters, and each one is placed at a fixed point on the page with a font. No paragraph knows where it ends, so there is nothing to rewrap.',
            'Even the apps that change a PDF\'s own text work line by line, and they need the font that was used. PDFs often carry only the letters of a font that the document uses, so a new letter may have no shape to draw with.',
          ],
        },
        {
          heading: 'Other reasons a PDF refuses changes',
          paragraphs: ['If you cannot even select the text, or an app says editing is not allowed, one of these is the cause:'],
          list: [
            'It is a scan or a photo. Each page is a picture, so there is no text to select. Try to highlight a word: if nothing turns blue, this is why.',
            'It is protected against changes. Some PDFs open freely but block printing, copying or editing. If you are allowed to change the file, Unlock PDF lifts those restrictions without a password.',
            'It is a form. The parts you are meant to change are its fields; the rest of the page is fixed on purpose. Fill PDF form fills the fields.',
          ],
          links: [{ text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'Fill PDF form', path: '/fill-pdf' }],
        },
        {
          heading: 'Change a few words with Edit PDF',
          paragraphs: ['Edit PDF adds a layer on top of the page; it does not rewrite the text that is already there. To replace a word or a line:'],
          list: [
            'Open Edit PDF and choose your PDF, or drop it on the page.',
            'The shapes in Edit PDF are outlines, so hide the old words with a picture: choose Picture, pick a plain white image (a PNG or JPG of a white square), place it over the words and drag its corner until they are covered.',
            'Choose Text box, click on the white area and type the new words, then drag the box to line it up.',
            'Click Save a copy, check the preview and download the edited PDF. The file on your device stays as it was.',
          ],
          links: [{ text: 'Edit PDF', path: '/edit-pdf' }],
        },
        {
          heading: 'What to know about covering text',
          paragraphs: [
            'Every change can be undone and redone until you save. In the saved copy, text boxes, highlights and drawings stay editable in other PDF apps, while shapes and pictures become part of the page. The PDF is edited in your browser and never uploaded, and you can check that nothing is uploaded yourself.',
            'Covering is not deleting. The old words are still in the file under the white picture, and anyone can select, search or copy them. If the point is to remove something private, such as a name or an account number, use Redact PDF, which removes what is under each box from the new file.',
          ],
          links: [{ text: 'check that nothing is uploaded', path: '/check-file-upload' }, { text: 'Redact PDF', path: '/redact-pdf' }],
        },
        {
          heading: 'Rewrite paragraphs: convert to Word',
          paragraphs: [
            'When the change is longer than a line, or the text has to reflow, edit a Word copy instead. PDF to Word joins the lines back into paragraphs, turns larger text into headings and bulleted lines into lists, keeps pictures where they were, and writes Arabic paragraphs right to left. Edit the .docx in Word, Pages, LibreOffice or Google Docs, then save it as a PDF from there, or turn it back with Word to PDF.',
            'The result is close to the PDF, not an exact copy: drawn shapes, colours, backgrounds and multi-column page layouts are not kept, and tables come out as lines with tab stops. For a letter or a report that is usually fine; for a designed brochure, ask the sender for the original file.',
          ],
          links: [{ text: 'PDF to Word', path: '/pdf-to-word' }, { text: 'Word to PDF', path: '/word-to-pdf' }],
        },
        {
          heading: 'If the PDF is a scan',
          paragraphs: ['A scan has no text to edit or convert. Run OCR PDF first: it reads the words on each page, in English, Arabic or both, and adds them as invisible text over the page. The page looks the same, but the text can now be selected, and PDF to Word can turn it into an editable document. Check the result, because text recognition makes mistakes on blurry, small or handwritten text. If you only need to add a line to a scanned page, skip this step: a text box from Edit PDF works on a scan too.'],
          links: [{ text: 'OCR PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'Free options you may already have',
          paragraphs: ['A few apps on your own computer help as well:'],
          list: [
            'Microsoft Word opens a PDF and converts it into an editable document; Microsoft\'s page on editing a PDF says this works best with PDFs that are mostly text (checked 24 November 2026).',
            'Preview on a Mac adds text boxes, shapes and signatures to a PDF from its Markup toolbar.',
            'Microsoft Edge can add ink drawings and highlights to a PDF it opens, according to Microsoft\'s page on the Edge PDF reader (checked 24 November 2026).',
            'Adobe\'s paid Acrobat edits a PDF\'s text and images; Adobe\'s Acrobat Reader page says the free Reader does not (checked 24 November 2026).',
          ],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you are trying to change (no personal data).`],
        },
      ],
    },
    '/fill-pdf-form-without-acrobat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['You do not need Adobe Acrobat to fill in a PDF form. If the form has fillable fields, browsers, Preview on a Mac and the Files app on an iPhone can fill them, and OpenAnyDoc\'s Fill PDF form does it in your browser without uploading the file, then can flatten the answers so they cannot be changed. If the form is a flat page with no fields, type your answers on it with text boxes in Edit PDF.'],
          links: [{ text: 'Fill PDF form', path: '/fill-pdf' }, { text: 'Edit PDF', path: '/edit-pdf' }],
        },
        {
          heading: 'First, find out what kind of form you have',
          paragraphs: ['PDF forms come in three kinds, and the way to fill one depends on which it is:'],
          list: [
            'A fillable form has real fields; the standard kind is called AcroForm. Click a line and a cursor appears, or click a box and it shows a tick. The answers are stored in the fields, so they can be read and changed later.',
            'A flat form only looks like a form: a scan, or a page saved without fields. Clicking does nothing, so you place text where each answer goes.',
            'An XFA form uses XML Forms Architecture, which Microsoft\'s page on the Edge PDF reader calls a legacy format of forms that Edge does not support (checked 24 November 2026). Fill PDF form does not support XFA either.',
          ],
        },
        {
          heading: 'Fill in a fillable form, with nothing uploaded',
          paragraphs: ['Fill PDF form works on any computer or phone with a modern browser:'],
          list: [
            'Open Fill PDF form and choose your PDF, or drop it on the page. If the PDF has no fields, the tool says so and points you to Edit PDF.',
            'Click each field and type, tick or choose your answer. Text fields, multi-line boxes, checkboxes, radio buttons and drop-down lists all work, in English, Arabic or any language your keyboard types.',
            'Tick Flatten on save if the answers should be fixed, then click Save a copy and download the filled form.',
          ],
          links: [{ text: 'Fill PDF form', path: '/fill-pdf' }],
        },
        {
          heading: 'Your form stays on your device',
          paragraphs: ['Forms often hold names, addresses and ID numbers, so it matters where they go. The form is filled by your own browser and never sent to a server, and you can check that nothing is uploaded with your browser\'s network panel. The original file is not changed: Save a copy makes a new PDF.'],
          links: [{ text: 'check that nothing is uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'On a phone',
          paragraphs: ['Open Fill PDF form in your phone\'s browser, choose the file from your downloads or the Files app and tap each field. The phone\'s own apps can fill many forms too:'],
          list: [
            'iPhone and iPad: open the PDF in the Files app and tap a field to type in it. On a form without fields, the Markup button adds text and a signature.',
            'Android: the Google Drive app opens PDFs and can fill in many fillable forms, according to Google\'s Drive help (checked 24 November 2026).',
          ],
          links: [{ text: 'Fill PDF form', path: '/fill-pdf' }, { text: 'Drive help', path: 'https://support.google.com/drive/answer/9463834' }],
        },
        {
          heading: 'A flat form: type where the answers go',
          paragraphs: [
            'When a form has no fields, use Edit PDF. Choose Text box, click where an answer goes and type it, then drag the box into line. Tick a box by typing an X in it, or draw a tick with the Draw tool. Click Save a copy when every answer is in place.',
            'If you send the same form to many people, PDF Forms turns the flat page into a fillable one. Place text boxes, checkboxes, drop-down lists, choice buttons, date fields and a signature box, and the saved copy can be filled in Acrobat, Preview, browsers and Fill PDF form. Drop-down choices and starting values take Latin letters for now, but people can type Arabic into the fields.',
          ],
          links: [{ text: 'Edit PDF', path: '/edit-pdf' }, { text: 'PDF Forms', path: '/pdf-forms' }],
        },
        {
          heading: 'Flatten before you send it',
          paragraphs: [
            'A filled form keeps its answers in fields, so anyone who opens it can change them. Flatten on save draws every answer onto the page and removes the fields, so the copy you send stays as you filled it. Leave it off when someone else still has to fill in part of the form.',
            'Flattened answers are drawn as pictures, so they cannot be selected or searched afterwards.',
          ],
        },
        {
          heading: 'Sign it',
          paragraphs: ['Many forms end with a signature. Fill in the fields first, then open the saved copy in Sign PDF: the next steps after the download pass it on without choosing the file again. Draw your signature with a mouse or finger, type your name in a signature style, or upload a picture of it, and place it on the line. This is a visual signature, like signing a printout, not a certificate-based digital signature. The guide to signing a PDF without Adobe explains the difference and the free options on every device.'],
          links: [{ text: 'Sign PDF', path: '/sign-pdf' }, { text: 'signing a PDF without Adobe', path: '/sign-pdf-without-adobe' }],
        },
        {
          heading: 'Other free ways on a computer',
          paragraphs: ['You may not need a website at all:'],
          list: [
            'Microsoft Edge fills in basic PDF forms; Microsoft\'s page on its PDF reader says forms that use JavaScript are not supported (checked 24 November 2026).',
            'Preview on a Mac fills in fields, and on a flat form adds text boxes and signatures from its Markup toolbar.',
            'Adobe Acrobat Reader is free as well, according to Adobe\'s Acrobat Reader page (checked 24 November 2026).',
          ],
        },
        {
          heading: 'If the form will not open',
          paragraphs: ['A form that asks for a password, or that no app will open, has a different problem from filling it in. The guide on how to open a PDF without Adobe lists the usual causes and what to do about each.'],
          links: [{ text: 'how to open a PDF without Adobe', path: '/open-pdf-without-adobe' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the form you are trying to fill in (no personal data).`],
        },
      ],
    },
    '/stirling-pdf-alternative': {
      published: '2026-11-20',
      updated: '2026-11-25',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Stirling-PDF is a PDF toolkit you run on your own server, so files go from your staff\'s browsers to a machine you control and are processed there. OpenAnyDoc does the work inside each person\'s browser instead, so there is no server to run and the file never leaves the device. Stirling-PDF has far more operations, an API and automation; OpenAnyDoc is the lighter choice when everyday PDF tasks are what people need.'],
        },
        {
          heading: 'How Stirling-PDF works (checked 25 November 2026)',
          paragraphs: ['What Stirling-PDF says on its own pages; follow the links for the current wording:'],
          list: [
            'Self-hosted server: the GitHub README starts it with one Docker command and describes it as something you can "deploy on your own servers with a private API". The Docker guide lists three images, from a core-only one (about 2 GB of memory suggested) to a full one with a bundled AI engine (6 GB suggested).',
            'Where files are processed: its page on where tools run says that in a self-hosted setup "every tool runs on your server, even ones your computer could run". The desktop app also has a local-only mode in which nothing is uploaded. If an administrator turns on local document processing, documents stay on the device, and the tools that cannot run locally are hidden.',
            'Features: the README lists "50+ PDF tools", and the pricing page says "60+ PDF tools", including edit, merge, split, sign, redact, convert, OCR and compress, plus no-code pipelines and REST APIs for nearly all tools.',
            'Licence: the README calls Stirling-PDF "open-core". Its LICENSE file is MIT for most of the code, with several directories under their own separate licences.',
            'Plans: its plans page says a self-hosted server runs on the Free plan (5 users, and 1,000 units a month for automation, AI and API calls) until you add Team or Enterprise. The pricing page lists Team at $99 a month with 100 users; Enterprise is custom and adds air-gapped deployment, SCIM provisioning, and data residency and audit logs; single sign-on is listed from the Team plan.',
            'Stirling Cloud: its files and privacy page says compress, OCR, convert and watermark files are sent to Stirling\'s servers, processed and returned. Files you open in its editor stay in your browser\'s storage unless you sign in and choose to upload or share them.',
          ],
          links: [{ text: 'GitHub README', path: 'https://github.com/Stirling-Tools/Stirling-PDF' }, { text: 'Docker guide', path: 'https://docs.stirlingpdf.com/Server/Install/Docker/' }, { text: 'page on where tools run', path: 'https://docs.stirlingpdf.com/Desktop/Where-Tools-Run/' }, { text: 'LICENSE file', path: 'https://github.com/Stirling-Tools/Stirling-PDF/blob/main/LICENSE' }, { text: 'plans page', path: 'https://docs.stirlingpdf.com/Server/Licensing/Plans-and-Licences/' }, { text: 'pricing page', path: 'https://stirling.com/pricing' }, { text: 'files and privacy page', path: 'https://docs.stirlingpdf.com/Cloud/Files-and-Privacy/' }],
        },
        {
          heading: 'Where Stirling-PDF does more',
          paragraphs: ['To be fair about the choice, Stirling-PDF covers ground that OpenAnyDoc does not:'],
          list: [
            'Many more operations than OpenAnyDoc has.',
            'Pipelines that chain several steps and run on many files without anyone clicking through them.',
            'A REST API, so other systems in your company can send PDFs to it.',
            'Accounts, single sign-on and, on the paid plans, audit logging, which matter when you must show who did what.',
            'Server-side work that does not depend on the speed or memory of each employee\'s computer.',
          ],
        },
        {
          heading: 'What OpenAnyDoc does differently',
          paragraphs: [
            'OpenAnyDoc has more than 40 PDF tools, and every one runs in the browser of the person using it. The file is read, changed and saved on that device. The page\'s security policy only lets it contact its own site, so a document cannot be sent anywhere else; anyone can confirm this in the browser\'s network panel, as the guide to check this yourself explains.',
            'Keeping files in-house therefore does not need a processing server. Because the site is a folder of static files, an organisation can host its own copy on an internal network: build it and serve the folder from a web server that sends the same security headers as this site. There is no database, no user accounts, no Docker image to keep up to date and no processing limit, and the files employees open still never leave their devices. The source code is public on GitHub. Each tool also works offline once you have used it with a connection; OCR PDF and Translate PDF also load their language data from the site the first time.',
          ],
          links: [{ text: 'check this yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'Side by side',
          paragraphs: ['The main differences, in short:'],
          list: [
            'Where files are processed: Stirling-PDF self-hosted, on your server by default, and an administrator can turn on local processing, which hides the tools that can\'t run locally; OpenAnyDoc, in each user\'s browser.',
            'What you run: Stirling-PDF, a Docker container with 2 to 6 GB of memory suggested, or a desktop app; OpenAnyDoc, nothing, or static files on any web server.',
            'Users and limits: Stirling-PDF Free, 5 users on a self-hosted server, and 1,000 units a month for automation, AI and API calls (plans page, checked 25 November 2026); OpenAnyDoc, no accounts, and no automation or API to meter.',
            'Operations: Stirling-PDF, 50+ tools (60+ on its pricing page) with pipelines and an API; OpenAnyDoc, more than 40 PDF tools with no API.',
            'Compression: both; OpenAnyDoc re-saves pictures at three quality levels in the browser and does not lower their resolution.',
            'Large batches: Stirling-PDF, handled by the server; OpenAnyDoc, limited by each device\'s memory.',
          ],
        },
        {
          heading: 'The PDF tools OpenAnyDoc covers',
          paragraphs: ['Each of these works on the user\'s own device:'],
          list: [
            'Merge, split, remove or extract pages, organize, rotate and crop.',
            'Edit, sign and fill in PDF forms; add page numbers, a watermark, or a header and footer; redact and compare.',
            'OCR PDF makes a scanned PDF searchable in English or Arabic; the reader is loaded from the site itself on first use.',
            'Protect PDF locks a file with a password and AES-256 encryption; Unlock PDF removes a password you know.',
            'Convert Word and Excel to PDF, and PDF to Word, Excel, PowerPoint, JPG, text or Markdown.',
          ],
          links: [{ text: 'Merge', path: '/merge-pdf' }, { text: 'OCR PDF', path: '/ocr-pdf' }, { text: 'Protect PDF', path: '/protect-pdf' }, { text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'redact', path: '/redact-pdf' }, { text: 'Convert Word and Excel to PDF', path: '/word-to-pdf' }],
        },
        {
          heading: 'Who should stay with Stirling-PDF',
          paragraphs: ['Keep Stirling-PDF, or choose it, if you need to run the same steps on thousands of files, call PDF tools from other software through an API, or log who processed which document. Those are server jobs, and a browser tool is not built for them. Many teams can use both: Stirling-PDF for automation, OpenAnyDoc for everyday tasks that should never reach a server.'],
        },
        {
          heading: 'Which to choose',
          paragraphs: ['A simple rule of thumb:'],
          list: [
            'Staff need everyday PDF tasks and you do not want to run a server: OpenAnyDoc, hosted by us or on your own network.',
            'You need automation, an API or audit logs: Stirling-PDF.',
            'Your rules say documents may not leave the employee\'s device at all: a tool that processes them locally.',
            'You are unsure what your rules allow: ask your IT or compliance team first. More options are in PDF tools that do not upload your file.',
          ],
          links: [{ text: 'PDF tools that do not upload your file', path: '/pdf-tools-without-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you need, for example hosting a copy on your network (no personal data).`],
        },
      ],
    },
    '/jsonformatter-alternative': {
      published: '2026-11-20',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['jsonformatter.org and Code Beautify are popular free JSON tools with many converters and a way to save JSON as a shareable link. Both state that much of the work happens in your browser, but their saving and URL-loading features involve their servers, and they ask you not to save sensitive data. If you paste API responses, tokens or configuration files, OpenAnyDoc formats, validates and compares JSON in your browser and has no save-online feature at all.'],
        },
        {
          heading: 'What jsonformatter.org says (checked 24 November 2026)',
          paragraphs: ['From its home page and privacy policy:'],
          list: [
            'Validation: "Your JSON Data gets validated in the browser itself." The page also says it keeps the last formatted JSON in the browser\'s local storage.',
            'Saving: you can save JSON online without logging in, and its FAQ says such data "will become public". To keep it private, it asks you to log in. Links can expire after an hour, or after 30 days or never with an account.',
            'Sharing and loading: it supports URL linking for sharing JSON and a "Load URL" option for external data.',
            'Its privacy policy says, in capitals, "DO NOT SAVE SENSITIVE DATA USING THE SAVE FUNCTIONALITY", and that traffic is measured with Google Analytics and Clicky.',
            'Its pages don\'t say whether formatting or converting ever sends your JSON to a server.',
          ],
          links: [{ text: 'home page', path: 'https://jsonformatter.org/' }, { text: 'privacy policy', path: 'https://jsonformatter.org/policy' }],
        },
        {
          heading: 'What Code Beautify says (checked 24 November 2026)',
          paragraphs: ['From its JSON viewer page and privacy policy:'],
          list: [
            'Processing: its privacy policy says "99% of our tools are doing processing on browser using Java Script" and that it does not store data unless you use the Save Online feature.',
            'URLs and files: the same policy says that with URL loading and file upload, data travels between server and client, though it is not stored, and uploaded files are deleted.',
            'Saving: the JSON viewer page lets you save JSON as a link and share it. The policy says public data can be indexed by Google, suggests logging in to keep saved data private, and asks you not to save passwords, keys or real production data.',
            'Its pages don\'t say which of its tools are in the 1% that do not run in the browser.',
          ],
          links: [{ text: 'JSON viewer page', path: 'https://codebeautify.org/jsonviewer' }, { text: 'privacy policy', path: 'https://codebeautify.org/privacy-policy' }],
        },
        {
          heading: 'Where those sites do more',
          paragraphs: ['To be fair about the choice, both sites offer things OpenAnyDoc does not. Code Beautify converts JSON to Excel, HTML, TSV, text and Base64, and jsonformatter.org adds RSS to JSON and many tools for XML, HTML and CSS. Both let you save JSON as a link to send to a colleague, which OpenAnyDoc cannot do, and both have accounts that keep your saved snippets. For public sample data, that sharing is handy.'],
        },
        {
          heading: 'What OpenAnyDoc does differently',
          paragraphs: [
            'Every OpenAnyDoc JSON tool runs in your browser. Pasted JSON and opened files stay in the page\'s memory until you download a copy, and closing the tab discards them. There is no save-online button, no share link and no account, so nothing can become public by mistake. The site has no analytics.',
            'The page\'s security policy only lets it contact its own site, which you can check yourself in the browser\'s network panel. There is one exception, and you start it: "Open from a URL" on the JSON pages fetches the https address you type directly from your browser, through a separate frame that is allowed to do only that. The pages work offline once loaded, and JSON files up to 10 MB open.',
          ],
          links: [{ text: 'check yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'The JSON tools that keep your data in the browser',
          paragraphs: ['Each of these works on your own device:'],
          list: [
            'JSON formatter: pretty print with 1, 2, 3, 4 or 8 spaces or a tab, minify, and sort keys; long integers are kept digit for digit.',
            'JSON validator: shows the line and column of an error, and Repair fixes trailing commas, comments, single quotes and unquoted keys.',
            'JSON viewer: tree, table and text views, with editing and download.',
            'Compare JSON: differences by key and path, ignoring key order.',
            'JSON Schema, JSONPath queries, and code types for TypeScript, Python, Go, Java and C#; conversions to CSV, YAML and XML.',
            'Mask data: replace emails, names and other personal fields with tokens before you share a file.',
          ],
          links: [{ text: 'JSON formatter', path: '/json-formatter' }, { text: 'JSON validator', path: '/json-validator' }, { text: 'JSON viewer', path: '/json-viewer' }, { text: 'Compare JSON', path: '/json-compare' }, { text: 'JSON Schema', path: '/json-schema' }, { text: 'JSONPath', path: '/jsonpath' }, { text: 'TypeScript', path: '/json-to-typescript' }, { text: 'CSV', path: '/json-to-csv' }, { text: 'Mask data', path: '/mask-data' }],
        },
        {
          heading: 'Side by side',
          paragraphs: ['The main differences, in short:'],
          list: [
            'Where JSON is processed: jsonformatter.org validates in the browser, and its pages don\'t say more; Code Beautify says most tools run in the browser; OpenAnyDoc, every tool in the browser.',
            'Save online and share links: both sites, yes (public without login); OpenAnyDoc, no.',
            'Loading from a URL: both sites, yes, and Code Beautify says the data passes through its server; OpenAnyDoc, yes, fetched by your browser directly.',
            'Analytics: both sites name Google Analytics in their privacy policies; OpenAnyDoc has none.',
            'Number of converters: both sites, more.',
          ],
        },
        {
          heading: 'Who should stay with those sites',
          paragraphs: ['If your JSON is public sample data and you want to send a link to it, or you need a converter OpenAnyDoc lacks, jsonformatter.org and Code Beautify do that well. If the JSON holds API keys, tokens, customer records or internal configuration, use a tool that keeps it in your browser, mask the personal fields before sharing, and follow your company\'s rules on where such data may go.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you need (no personal data, and never paste a real token).`],
        },
      ],
    },
    '/reduce-photo-file-size': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['To get a photo under a limit such as 1 MB, make it smaller in pixels first, then save it as a JPG at a lower quality. A phone photo resized to about 1600 pixels on its long side and saved at quality 75 usually ends up well under 1 MB. Compress image shows the new size as you move the quality slider, and the photo never leaves your device.'],
          links: [{ text: 'Compress image', path: '/compress-image' }],
        },
        {
          heading: 'Why a phone photo is so large',
          paragraphs: ['A photo from a recent phone holds millions of pixels, far more than a screen or an upload form needs, and every pixel takes space. The file is often several megabytes before you do anything to it. Two things decide its size: how many pixels it has, and how hard its format squeezes them. A size limit is easiest to meet by working on both, in that order.', 'Many forms say what they accept, for example "JPG or PNG, under 1 MB", and sometimes a minimum width in pixels. Read that line first, because it decides the format and how far you can shrink the picture.'],
        },
        {
          heading: 'Step 1: resize first',
          paragraphs: ['Resizing removes pixels, and it saves more than any quality setting. Halving the width and the height leaves a quarter of the pixels, and the file shrinks with them. Open Resize image and choose one of three ways:'],
          list: [
            'Pixels: type a width such as 1600 and keep the aspect ratio on, so the photo is not stretched.',
            'Percent: shrink every picture by the same share, for example 50%.',
            'Ready sizes: Instagram and WhatsApp sizes, and common passport photo sizes at 300 dpi. These are common sizes, not official checks, so confirm the office\'s own rules.',
            'Resize image has the same format and quality fields as the compressor, so for a single photo one step can do both.',
          ],
          links: [{ text: 'Resize image', path: '/resize-image' }],
        },
        {
          heading: 'Step 2: lower the quality',
          paragraphs: ['Open Compress image, add the photo and move the quality slider. Quality 75 is a good start for photos: files are usually less than half the size and the difference is hard to see. The before-and-after view shows the first picture at that setting with its size before and after, so you can stop as soon as it is under the limit.', 'There is no box where you type "under 1 MB": you choose the quality and read the size. If 75 is not enough, try a lower value and look at faces, small text and skies, where blocky patches show first. If the quality has to drop a long way to fit, go back and resize instead; a smaller sharp photo looks better than a large blurry one.', 'Quality applies to JPG, WebP and AVIF. PNG is lossless: its pixels stay exactly the same, so a photo saved as PNG shrinks much less.'],
          links: [{ text: 'Compress image', path: '/compress-image' }],
        },
        {
          heading: 'Step 3: pick the format',
          paragraphs: ['The format matters as much as the quality:'],
          list: [
            'JPG: accepted by every form, email app and phone. The safe choice when you are not sure.',
            'WebP: usually 25–35% smaller than JPG at the same look, and it keeps transparency. Image to WebP converts to it, but some older email apps, desktop programs and forms still refuse it, so check what the form accepts.',
            'PNG: right for screenshots, logos and pictures with flat colour or sharp text. Photos saved as PNG stay large; convert them to JPG or WebP.',
            'AVIF: often smaller still, but slow to save (a few seconds per large photo) and accepted by fewer forms.',
          ],
          links: [{ text: 'Image to WebP', path: '/image-to-webp' }],
        },
        {
          heading: 'Check the result before you send it',
          paragraphs: ['Look at the downloaded file, not only the number in the tool: the size in the preview is for the first picture, and each photo in a batch comes out a little different.'],
          list: [
            'Open it in the Image viewer to see its size in pixels, its file size and the picture zoomed in.',
            'Aim a little under the limit. Computers and websites don\'t all count a megabyte the same way (1,000,000 or 1,048,576 bytes), so leave some room.',
            'If the photo got larger, it was already compressed hard; lower the quality or keep the original.',
            'If the form wants a PDF, turn the photo into one with JPG to PDF.',
          ],
          links: [{ text: 'Image viewer', path: '/image-viewer' }, { text: 'JPG to PDF', path: '/jpg-to-pdf' }],
        },
        {
          heading: 'A side effect worth knowing',
          paragraphs: ['The compressed file carries only the picture: the camera, date and GPS location in the original are not copied into it. That is usually what you want before sending a photo to someone you don\'t know. To see what a photo carries, or to clean it without changing the pixels, read how to remove the location from a photo. Compressing happens in your browser, and you can check that nothing is uploaded yourself.'],
          links: [{ text: 'remove the location from a photo', path: '/remove-location-from-photo' }, { text: 'check that nothing is uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the photo and the limit you need to meet (no personal data, and please don't attach the photo).`],
        },
      ],
    },
    '/open-heic-on-windows': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Windows opens iPhone HEIC photos in its Photos app once two add-ons from the Microsoft Store are installed: the HEIF Image Extensions and the HEVC Video Extensions. If you can\'t or don\'t want to install anything, open the photo in your browser with OpenAnyDoc\'s Image viewer, or turn it into a JPG with HEIC to JPG; both work in Chrome, Edge and Firefox on Windows, and the photo stays on your PC. To avoid the problem next time, set the iPhone to save photos as JPG.'],
          links: [{ text: 'Image viewer', path: '/image-viewer' }, { text: 'HEIC to JPG', path: '/heic-to-jpg' }],
        },
        {
          heading: 'What a HEIC file is',
          paragraphs: ['HEIC is the file type iPhones use for photos by default. It is a photo saved in the HEIF format, which takes less space than a JPG at a similar quality, so the same phone storage holds more photos. A Mac opens it in Photos and Preview with nothing to install, and an iPhone or iPad opens it in Photos.', 'The file may end in .heic or .heif. Both are the same kind of photo, and both open with the steps below. Some Android phones save HEIC photos too.'],
        },
        {
          heading: 'Why Windows may not open it',
          links: [{ text: 'page on HEIF and HEVC files in Photos', path: 'https://support.microsoft.com/help/4494024' }],
          paragraphs: ['Windows reads HEIC through add-ons rather than out of the box. Microsoft\'s page on HEIF and HEVC files in Photos (checked 24 November 2026) says the Photos app needs two from the Microsoft Store, the HEIF Image Extensions, which are free, and the HEVC Video Extensions, which are paid, and that you need both even if you only use photos. The picture inside a HEIC file is compressed the same way as HEVC video.', 'That route is fine on your own PC. It does not help on a work or school computer where the Store is blocked, on a shared or borrowed PC, or when you only need to open one photo once. Browsers can\'t help on their own either: Chrome, Edge and Firefox don\'t show HEIC themselves, which is also why many websites refuse it as an upload.'],
        },
        {
          heading: 'Open it in your browser, with nothing installed',
          paragraphs: ['OpenAnyDoc reads the photo on your PC. The first time you open a HEIC file in Chrome, Edge or Firefox, a HEIC decoder loads from this site and your browser keeps it; the photo itself is never uploaded.'],
          list: [
            'To look at a photo: open the Image viewer and drop the .heic file on the page. You can zoom, fit it to the window and see the camera, the date taken and, if the photo has one, its GPS location.',
            'To use it somewhere else: open HEIC to JPG, add one photo or many at once, choose the quality (90 keeps them looking the same) and download a JPG, or a ZIP of all of them.',
            'From the viewer, the next steps can compress, resize or clean the photo, or turn it into a PDF, without choosing the file again.',
          ],
          links: [{ text: 'Image viewer', path: '/image-viewer' }, { text: 'HEIC to JPG', path: '/heic-to-jpg' }],
        },
        {
          heading: 'What to expect from the JPG',
          paragraphs: ['The JPG comes out upright and at full size. It is usually larger than the HEIC it came from; if it is too big for an email or a form, see how to reduce a photo\'s file size. A few other points:'],
          list: [
            'A few HEIC photos taken with the newest iPhone settings may not decode. Save those as JPG on the phone first, with the setting in the next section.',
            'Live Photos become a still JPG; the short video is not kept.',
            'The camera, date and GPS details are not copied into the JPG. That is good for sharing, but keep the original if you want the date taken in your albums.',
          ],
          links: [{ text: 'reduce a photo\'s file size', path: '/reduce-photo-file-size' }],
        },
        {
          heading: 'Stop the iPhone making HEIC files',
          links: [{ text: 'Apple\'s page on HEIF and HEVC media', path: 'https://support.apple.com/en-us/116944' }],
          paragraphs: ['Two iPhone settings help, as Apple\'s page on HEIF and HEVC media describes (checked 24 November 2026). They change the photos you take or copy from now on, not the ones already saved.'],
          list: [
            'Settings, Camera, Formats, Most Compatible: the camera saves new photos as JPG instead of HEIC. They take more space on the phone.',
            'Settings, Apps, Photos, and leave Keep Originals off: photos imported to a computer with a cable might then be converted to JPEG on the way.',
          ],
        },
        {
          heading: 'Before you share the photo',
          paragraphs: ['A photo can show more than you mean to share: the faces in it and, inside the file, where it was taken. Before you post a converted photo you can blur faces in it, and the guide to removing the location from a photo explains what the file carries. Every step runs in your browser; to be sure, check for yourself that no file is uploaded.'],
          links: [{ text: 'blur faces', path: '/blur-face' }, { text: 'removing the location from a photo', path: '/remove-location-from-photo' }, { text: 'check for yourself that no file is uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} if a HEIC photo will not open, and say which phone took it and which browser you used (no personal data, and please don't attach the photo).`],
        },
      ],
    },
    '/remove-location-from-photo': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['If location was on for the camera, a phone photo carries the exact GPS position where it was taken, along with the phone model and the date. To remove it, add the photo to Remove image metadata: it lists what the photo contains and saves a clean copy, in your browser and without uploading it. On an iPhone you can also leave the location out for one share, from the share sheet\'s Options.'],
          links: [{ text: 'Remove image metadata', path: '/remove-image-metadata' }],
        },
        {
          heading: 'What a photo file carries',
          paragraphs: ['Phone cameras write details into each photo, beside the picture itself. This hidden part is called metadata, and most of it is stored as EXIF (some apps add XMP or IPTC fields too). It can include:'],
          list: [
            'GPS location: latitude and longitude, often precise enough to point at a single building, if location was allowed for the camera.',
            'The date and time the photo was taken.',
            'The phone or camera make and model, and the lens.',
            'The software that edited it, and sometimes an author name.',
            'Orientation: which way up the photo should be shown.',
          ],
        },
        {
          heading: 'Check what your photo reveals',
          paragraphs: ['None of this shows when you look at the photo, but anyone who gets the original file can read it. To see it yourself, open the photo in the Image viewer and open its details panel: it lists the camera, lens and date taken and, when the photo carries one, the GPS location, with a link to see it on OpenStreetMap if you choose to.', 'Remove image metadata shows the same details for each photo in plain words, for example "This photo contains your GPS location", before you save anything.'],
          links: [{ text: 'Image viewer', path: '/image-viewer' }, { text: 'Remove image metadata', path: '/remove-image-metadata' }],
        },
        {
          heading: 'Remove it in your browser',
          paragraphs: ['The photo is read and cleaned on your device and never sent to a server; you can check that it is not uploaded with your browser\'s own tools.'],
          list: [
            'Open Remove image metadata and add one photo or many.',
            'Read what each photo lists: GPS location, camera, date and any other details found.',
            'Click Download clean copies. Several photos come as one ZIP.',
          ],
          links: [{ text: 'Remove image metadata', path: '/remove-image-metadata' }, { text: 'check that it is not uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'Will the photo lose quality?',
          paragraphs: ['Not for JPG, PNG and WebP. Only the metadata is cut out and the picture data is copied as it is, so the photo looks exactly the same. A JPG keeps its colour profile, so colours don\'t shift. Each clean copy is read again before you get it, and the tool stops if any location, camera or date is still there.', 'Two exceptions. HEIC and TIFF photos are saved again as a high-quality JPG. And a JPG with a sideways orientation tag is turned upright in its pixels first, because removing the tag would show it on its side, so its pixels change slightly.'],
        },
        {
          heading: 'Stop the phone adding it',
          links: [{ text: 'Apple\'s page on location in photos', path: 'https://support.apple.com/guide/personal-safety/manage-location-metadata-in-photos-ips0d7a5df82/web' }],
          paragraphs: ['Phone settings can leave the location out from the start, or for one share. Menu names change between versions and phone makers, so look for these words:'],
          list: [
            'iPhone, for one share: in the share sheet, tap Options and turn off Location before you send, as Apple\'s page on location in photos explains (checked 24 November 2026).',
            'iPhone, for every new photo: Settings, Privacy & Security, Location Services, Camera, Never.',
            'Android: open the Camera app\'s settings and turn off the option for location tags or saving the location; its name depends on the phone maker.',
          ],
        },
        {
          heading: 'Don\'t social sites remove it anyway?',
          paragraphs: ['Many sites remove location details when you post a photo, but not all of them do, and messaging apps differ: some drop it when they shrink a photo, while sending the same photo as a file or by email usually keeps everything. Settings and policies also change over time. Cleaning the photo yourself first means you don\'t need to know which is which.', 'Photos you already took still carry their location even after you turn it off on the phone, so clean those before you send them.'],
        },
        {
          heading: 'What removing metadata can\'t do',
          paragraphs: ['A clean file can still give a place away through what is in the picture: a street sign, a house number, a number plate, a uniform or the view from a window. Faces are the same. Blur faces finds the faces and lets you drag over anything else, such as a badge or a number plate, before you share.', 'File names are not changed, so rename a file named after a place or a person. And when you shrink a photo for email or convert it from HEIC to JPG, the new file already leaves the camera, date and GPS details out.'],
          links: [{ text: 'Blur faces', path: '/blur-face' }, { text: 'shrink a photo for email', path: '/reduce-photo-file-size' }, { text: 'convert it from HEIC to JPG', path: '/heic-to-jpg' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} if a detail was left in a clean copy, and describe the photo and the app that made it (no personal data, and please don't attach the photo).`],
        },
      ],
    },
    '/remove-background-without-upload': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['OpenAnyDoc\'s Remove background cuts a person or an object out of a photo on your own device: an on-device AI model finds the subject in your browser, and the photo is never sent to a server. Save the result as a transparent PNG or on a white background. On an iPhone, iPad or Mac you can also lift the subject out of a photo with a touch and hold or a right-click.'],
          links: [{ text: 'Remove background', path: '/remove-background' }],
        },
        {
          heading: 'Why it matters where the photo goes',
          paragraphs: ['Some online background removers make the cut-out on their own servers, so the photo has to be uploaded first. That may not matter for a product shot, but it does for a family photo, a picture of a child or a portrait for an ID.', 'When the model runs in your browser, the photo stays on your device. You don\'t have to take that on trust: you can check that nothing is uploaded by watching your browser\'s network panel while you use the tool.'],
          links: [{ text: 'check that nothing is uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'What happens the first time',
          paragraphs: ['The first time you use it, the model and the runtime that runs it are loaded from OpenAnyDoc\'s own site: the model is 5 to 7 MB and the runtime 15 MB, up to about 22 MB in all. Your browser keeps them, so later uses start at once and work offline. The download goes one way only: the model comes to you, and your photo goes nowhere.'],
        },
        {
          heading: 'How to do it',
          paragraphs: ['Remove background works on one photo at a time:'],
          list: [
            'Open Remove background and choose or drop a JPG, PNG, WebP or HEIC photo.',
            'Choose A person for portraits, or An object or animal for products, pets and anything else.',
            'Slide across the before-and-after preview to check the edges.',
            'Choose transparent or white and click Remove background.',
          ],
          links: [{ text: 'Remove background', path: '/remove-background' }],
        },
        {
          heading: 'Transparent PNG or white background?',
          paragraphs: ['Pick by where the picture is going:'],
          list: [
            'Transparent PNG: the background is see-through, so the subject sits on any colour, picture or slide. Use it for designs, stickers and presentations, and place it on a new background in the Photo editor or a design app.',
            'White: the background is filled with white and the photo keeps its own format, so a JPG stays a JPG. Use it for shop listings and forms that ask for a plain background.',
            'For an ID or passport photo, check the issuing office\'s rules for background and size; Resize image has common passport sizes.',
          ],
          links: [{ text: 'Photo editor', path: '/photo-editor' }, { text: 'Resize image', path: '/resize-image' }],
        },
        {
          heading: 'If the file is too big',
          paragraphs: ['A transparent PNG of a photo is often larger than the JPG it came from. If a site limits the size and accepts WebP, Image to WebP keeps the transparency in a smaller file. For a white-background JPG, the guide to reducing a photo\'s file size covers resizing and quality.'],
          links: [{ text: 'Image to WebP', path: '/image-to-webp' }, { text: 'reducing a photo\'s file size', path: '/reduce-photo-file-size' }],
        },
        {
          heading: 'What works well, and what doesn\'t',
          paragraphs: ['The models are small enough to run on your device. That keeps the photo private, but on hard photos big commercial tools do better.'],
          list: [
            'Works well: one clear person or object, in focus, on a plain or simple background.',
            'Works well: products on a table, pets, and portraits, with soft edges around hair and shoulders.',
            'Can come out rough: fine or flyaway hair, glass and other see-through things, smoke, and busy backgrounds.',
            'If the edges are rough, try the other choice (A person or An object or animal), or a photo taken against a plainer wall.',
          ],
        },
        {
          heading: 'Options already on your devices',
          paragraphs: ['You may not need a website at all. These also work on the device (the makers\' pages, checked 24 November 2026):'],
          links: [{ text: 'touch and hold the subject', path: 'https://support.apple.com/102460' }, { text: 'choose Copy Subject', path: 'https://support.apple.com/guide/safari/ibrw1c2374cd/mac' }, { text: 'Remove background button', path: 'https://blogs.windows.com/windows-insider/2023/09/07/background-removal-in-paint-begins-rolling-out-to-windows-insiders/' }],
          list: [
            'iPhone and iPad: in Photos, touch and hold the subject of a photo until it lifts, then copy or share it.',
            'Mac: in Photos or Preview, right-click the photo and choose Copy Subject, then paste it into another app.',
            'Windows 11: recent versions of Paint have a Remove background button.',
          ],
        },
        {
          heading: 'Before you share the result',
          paragraphs: ['A cut-out still shows the person in it. If the photo has other people in it too, Blur faces hides them before you remove anything. And if you also send the original photo, read how to remove the location from a photo first.'],
          links: [{ text: 'Blur faces', path: '/blur-face' }, { text: 'remove the location from a photo', path: '/remove-location-from-photo' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the kind of photo that gave a rough result (no personal data, and please don't attach a photo of a real person).`],
        },
      ],
    },
    '/spreadsheet-to-ai-chat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Turn the sheet you need into a Markdown table with Excel to Markdown, check how many tokens it takes, and paste it into the chat with a sentence saying what the columns mean. A Markdown table keeps every value under its column name, so ChatGPT, Claude or Gemini can read it row by row. Hide names, emails and other personal data first; the chat keeps whatever you paste.'],
          links: [{ text: 'Excel to Markdown', path: '/excel-to-markdown' }],
        },
        {
          heading: 'Why not paste the cells or attach the workbook?',
          paragraphs: ['Copying cells out of Excel gives tab-separated text. That works for a small range, but in a chat box the tabs are invisible and a reader, human or AI, has to count them to know which value belongs to which column.', 'Attaching the .xlsx file sends the whole workbook: every sheet, hidden ones included, plus anything else stored in it. Often you only want one table read. Converting first means you choose exactly what leaves your device, and you can see it before you send it.'],
        },
        {
          heading: 'Markdown table or CSV?',
          paragraphs: ['Both work. The difference is readability against size. In our test, a synthetic table of 100 orders with 5 columns took 2,449 tokens as a Markdown table and 2,148 tokens as CSV, so the Markdown version was about 14% larger. The extra tokens are the pipes and the separator line.'],
          list: [
            'Choose a Markdown table when the table is small or medium, when cells contain commas, or when you want the chat to show the same table back to you.',
            'Choose CSV when the table is large and every token counts. Excel to CSV gives you the file; open it in any text editor and paste its text.',
            'For lists of records in JSON, the TOON format can be shorter still; see what TOON is and when it saves tokens.',
          ],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }, { text: 'what TOON is and when it saves tokens', path: '/what-is-toon-format' }],
        },
        {
          heading: 'One sheet at a time',
          paragraphs: ['Excel to Markdown converts the sheet you pick from its sheet list, one table per conversion. That is deliberate: two sheets with different columns pasted as one block confuse the reader about where one table ends. If the chat needs two sheets, paste them as two tables, each under a line such as "Sheet: Budget 2026".', 'To see what the whole workbook costs before you decide, drop it on the token counter: it counts every sheet, each written as a Markdown table under its sheet name.'],
          links: [{ text: 'token counter', path: '/token-counter' }],
        },
        {
          heading: 'Formulas or shown values?',
          paragraphs: ['The table holds each cell as Excel shows it. A formula appears as its result, and dates, percentages and prices keep their format, so 0.15 formatted as a percentage arrives as 15%. That is usually what you want the chat to reason about.', 'The formulas themselves are not in the table. If you want the chat to check or explain a formula, copy it from the formula bar and paste it as a separate line, with the cell it lives in. Merged cells give their value to the first cell of the range, and colours, fonts and comments are not kept, so if a colour carries meaning, add a column that says it in words.'],
        },
        {
          heading: 'How big is too big?',
          paragraphs: ['Chats measure what you paste in tokens, and the limit depends on the model and your plan. Long pastes can be refused, cut, or answered less carefully toward the end. Count first: the token counter shows the tokens, words and characters of a file or pasted text in your browser. Its count follows one common tokenizer, so for other models the number is an estimate.', 'If the number is high, make the table smaller before you paste it:'],
          list: [
            'Delete the columns the question does not need. IDs, internal codes and long notes are often the largest.',
            'Keep only the rows the question is about, or send a summary instead, made with Pivot table.',
            'Split a long table into parts with Split CSV and send them one message at a time.',
          ],
          links: [{ text: 'token counter', path: '/token-counter' }, { text: 'Pivot table', path: '/pivot-table' }, { text: 'Split CSV', path: '/split-csv' }],
        },
        {
          heading: 'Hide personal data first',
          paragraphs: ['Once pasted, the data is on the chat service\'s servers under its rules, not yours. If the sheet holds customer names, emails, phone numbers or ID numbers, run it through Mask data before you convert it. It finds those columns, replaces each value with a token such as EMAIL-000001, and gives the same value the same token everywhere, so the chat can still count, group and compare rows. Keep the private key if you want to put the real values back later. The guide to anonymizing a file before sharing explains the choices.'],
          links: [{ text: 'Mask data', path: '/mask-data' }, { text: 'guide to anonymizing a file before sharing', path: '/anonymize-data-before-sharing' }],
        },
        {
          heading: 'Step by step',
          paragraphs: ['The whole routine takes a minute, and the workbook is read by your browser at every step:'],
          list: [
            'Mask the workbook if it holds personal data, and save the masked copy.',
            'Open Excel to Markdown, choose the workbook and pick the sheet.',
            'Copy the table, paste it into the token counter if you are unsure of its size, and trim it if needed.',
            'In the chat, write one sentence about the table (what a row is, what each unclear column means), then paste the table and ask your question.',
          ],
          links: [{ text: 'Excel to Markdown', path: '/excel-to-markdown' }],
        },
        {
          heading: 'Other files',
          paragraphs: ['The same idea works for documents: a PDF with tables can go through PDF to Markdown, and the guides on Word documents and PowerPoint decks cover their own catches. For a CSV file, CSV to Markdown does the same job as the Excel tool.'],
          links: [{ text: 'PDF to Markdown', path: '/pdf-to-markdown' }, { text: 'Word documents', path: '/word-document-to-ai-chat' }, { text: 'PowerPoint decks', path: '/powerpoint-to-ai-chat' }, { text: 'CSV to Markdown', path: '/csv-to-markdown' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the sheet and what the chat got wrong (no personal data).`],
        },
      ],
    },
    '/make-markdown-table-from-csv': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Open or paste the CSV in CSV to Markdown: the first row becomes the table header, a separator line follows, and every other row becomes one line between pipes. Copy the result into a GitHub README, an issue, your docs or a chat, or download it as an .md file. Pipes inside cells are escaped for you, so the columns stay in place.'],
          links: [{ text: 'CSV to Markdown', path: '/csv-to-markdown' }],
        },
        {
          heading: 'What a Markdown table is made of',
          paragraphs: ['A Markdown table is plain text that GitHub, GitLab and most Markdown editors draw as a table. It has three parts:'],
          list: [
            'The header line: the column names between pipes, such as | Item | Qty | Price |.',
            'The separator line: three dashes per column, such as | --- | --- | --- |. Without it the lines are shown as ordinary text.',
            'One line per row, with the cells in the same order as the header.',
          ],
        },
        {
          heading: 'Alignment',
          paragraphs: ['The converter writes plain --- separators, which most readers show left-aligned. To align a column, edit its part of the separator line after you paste: :--- for left, :---: for centre and ---: for right. Right-aligning number columns makes prices and totals easier to compare. Only the separator line changes; the cells stay as they are. GitHub and GitLab follow these colons; a few simple editors ignore them and show every column the same way.'],
        },
        {
          heading: 'Pipes, line breaks and other characters in cells',
          paragraphs: ['Because the pipe marks a column border, a | inside a cell would split it in two. The converter writes it as \\|, which readers show as a plain pipe. A few other cases are worth knowing:'],
          list: [
            'A line break inside a cell is written as <br>. GitHub shows it as a new line within the cell; some editors show the tag as text, so shorten such cells if the table is going elsewhere.',
            'Markdown inside cells still works: *text* becomes italic and backticks become code. If a cell holds asterisks or underscores that should stay as they are, check the rendered table.',
            'Arabic letters stay as they are in a UTF-8 file or an Arabic Windows CSV, and accented letters stay as they are in a UTF-8 file or a Western European Windows CSV. The delimiter (comma, semicolon, tab or pipe) is detected from the file, so a semicolon CSV saved by Excel in Europe keeps its columns.',
          ],
        },
        {
          heading: 'The header row decides the columns',
          paragraphs: ['A Markdown table needs a header, so the first row of the CSV always becomes it. If your file has no header row, add one in the CSV viewer before converting, even if it is only Column 1, Column 2.', 'The header also sets the number of columns. A row with fewer cells gets empty ones at the end; a row with more cells than the header loses the extra ones. Give every column a name and nothing is dropped.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'Wide and long tables',
          paragraphs: ['Markdown has no limit on columns, but a reader does. On GitHub a wide table scrolls sideways, and on a phone more than five or six columns get hard to follow. If the table is for people to read:'],
          list: [
            'Remove the columns readers do not need before converting.',
            'If you have few rows and many columns, flip them with Transpose so each field becomes a row.',
            'Keep the full data as a CSV file in the repository and show a short table that links to it.',
          ],
          links: [{ text: 'Transpose', path: '/transpose' }],
        },
        {
          heading: 'What a Markdown table cannot hold',
          paragraphs: ['These limits come from Markdown itself, not from the converter, so no tool can get around them:'],
          list: [
            'No merged cells and no cells that span rows: complex layouts flatten into simple rows.',
            'No colours, fonts or cell borders; style comes from wherever the table is shown.',
            'No formulas: the table holds text. Totals must be in the CSV already.',
            'No second header row; if your CSV has two, merge them into one line of names first.',
          ],
        },
        {
          heading: 'Long tables in the converter',
          paragraphs: ['The preview shows the first 5,000 lines of the table. Copy and Download always take the whole table, so nothing is cut from what you paste. The file is read by your browser and never uploaded, which matters when the CSV is an export from a work system.'],
        },
        {
          heading: 'Pasting the table into a chat',
          paragraphs: ['A Markdown table is easy for an AI chat to read, because each value sits under its column name. A table costs more tokens than the same data as CSV, so for large tables count first with the token counter. If the data comes from a workbook, Excel to Markdown does the same job sheet by sheet, and the guide on giving an AI chat a spreadsheet covers size, formulas and hiding personal data.'],
          links: [{ text: 'token counter', path: '/token-counter' }, { text: 'Excel to Markdown', path: '/excel-to-markdown' }, { text: 'giving an AI chat a spreadsheet', path: '/spreadsheet-to-ai-chat' }],
        },
        {
          heading: 'Step by step',
          paragraphs: ['From file to rendered table:'],
          list: [
            'Open CSV to Markdown and choose the .csv or .tsv file, or paste the CSV text into the box.',
            'Check the preview: the header, the separator, then one line per row.',
            'Click Copy, paste the table into your README, issue or note, and adjust the separator line if you want alignment.',
            'Preview the page (on GitHub, the Preview tab) before you commit or post.',
          ],
          links: [{ text: 'CSV to Markdown', path: '/csv-to-markdown' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and paste the first two lines of the CSV and where the table goes wrong (no personal data).`],
        },
      ],
    },
    '/what-is-toon-format': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['TOON (Token-Oriented Object Notation) is an open text format for the same data as JSON, made to use fewer tokens when you paste data into an AI chat. It writes a list of objects with the same keys as one header line of field names and then one row of values per item, and nested objects with indentation instead of braces. It saves a lot on long, uniform lists and little or nothing on deeply nested or irregular data, especially compared with minified JSON.'],
        },
        {
          heading: 'What it looks like next to JSON',
          paragraphs: ['Take three synthetic orders. Formatted JSON repeats every key for every order and spends a line on each brace, 137 tokens in our test. The same data in TOON is four lines and 60 tokens:'],
          list: [
            'orders[3]{id,product,quantity,price,status}:',
            '  1001,Notebook,1,0.5,paid',
            '  1002,Pen,8,13.5,shipped',
            '  1003,Stapler,3,26.5,pending',
          ],
        },
        {
          heading: 'How to read it',
          paragraphs: ['The first line says: a list called orders, with 3 items, and these five fields. Each indented line is one item, with its values in the order of the fields. The item count and the field names act as a check, so a reader can tell when a row is missing or has a value too many.', 'Data that is not a uniform list looks like indented key: value lines, much like YAML. Text is quoted only when it has to be, for example a version written as "1.2" keeps its quotes so it stays text and is not read as a number. A list of mixed items is written with a dash before each item.'],
        },
        {
          heading: 'When it saves tokens, in our test',
          paragraphs: ['We converted three synthetic samples with the same converter and token count the JSON to TOON page uses. The comparison depends on the JSON you start from, so each sample was counted as formatted JSON (indented with 2 spaces) and as minified JSON (one line):'],
          list: [
            '100 orders with the same 5 keys: 4,291 tokens formatted, 2,387 minified, 1,571 as TOON. TOON was 63% smaller than formatted JSON and 34% smaller than minified JSON.',
            'A nested settings object, five levels deep: 236 formatted, 122 minified, 153 as TOON. Smaller than formatted JSON, but 25% larger than minified JSON.',
            '30 events of three different shapes: 1,239 formatted, 644 minified, 818 as TOON. Again smaller than formatted JSON and 27% larger than minified.',
          ],
        },
        {
          heading: 'Why the shape matters',
          paragraphs: ['TOON saves tokens by writing each key once for a whole list. When items share their keys, that removes most of the repetition. When there is no list to share keys across, as in a settings object or a mix of different records, there is nothing to remove, and the indentation TOON uses instead of braces costs about as much as the braces it replaces. Minified JSON has no indentation at all, which is why it beat TOON on those two samples.', 'One more comparison from the same test: the 100 orders as a plain CSV table took 1,367 tokens, fewer than TOON. For a flat table with no nesting, CSV or a Markdown table is just as good a choice; the guide on giving an AI chat a spreadsheet compares those two.'],
          links: [{ text: 'giving an AI chat a spreadsheet', path: '/spreadsheet-to-ai-chat' }],
        },
        {
          heading: 'Use TOON when',
          paragraphs: ['A quick rule from the numbers above:'],
          list: [
            'Use it for long lists of records with the same keys, such as API responses, exports and logs, especially when they have a few nested fields that CSV cannot hold.',
            'Skip it for configuration files, deeply nested documents and lists whose items all differ; minify the JSON instead with Minify JSON.',
            'Skip it for small data. Saving 50 tokens is not worth explaining a new format to the chat.',
          ],
          links: [{ text: 'Minify JSON', path: '/json-minify' }],
        },
        {
          heading: 'Measure your own data',
          paragraphs: ['Paste the JSON into JSON to TOON and it shows the token count before and after and the saving in percent. The "before" count is the JSON as you pasted it, so formatted JSON shows a bigger saving than the same data minified. For a fair test, minify it first, then convert. The counts follow one common tokenizer, so for other models they are estimates; the token counter uses the same count.', 'The conversion runs in your browser and nothing is sent to a server or to any AI service. If the data holds names, emails or ID numbers, hide them first with Mask data.'],
          links: [{ text: 'JSON to TOON', path: '/json-to-toon' }, { text: 'token counter', path: '/token-counter' }, { text: 'Mask data', path: '/mask-data' }],
        },
        {
          heading: 'Will a chat understand it?',
          paragraphs: ['TOON is new, and not every tool knows it by name. When you paste it into ChatGPT, Claude or Gemini, say in one sentence that the data is in TOON format and that the first line lists the fields. The header line makes the rows easy to follow even for a reader who has never seen the format.', 'TOON is also two-way: when a chat answers in TOON, or you want your data back, choose TOON to JSON on the JSON to TOON page to turn it back into ordinary JSON.'],
          links: [{ text: 'JSON to TOON', path: '/json-to-toon' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the shape of your data and the counts you saw (no personal data).`],
        },
      ],
    },
    '/convert-excel-to-json-for-api': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Make the first row of the sheet hold the field names your API expects, then open the workbook in Excel to JSON. You get an array with one object per row, keyed by the header row, with numbers as numbers, true and false as booleans, dates as ISO 8601 text and empty cells as null. Check the values that matter to your API, then copy or download the .json file.'],
          links: [{ text: 'Excel to JSON', path: '/excel-to-json' }],
        },
        {
          heading: 'The shape you get',
          paragraphs: ['A sheet with the columns sku, name, price and inStock becomes a JSON array like this, indented with 2 spaces:'],
          list: [
            '[ { "sku": "A-100", "name": "Notebook", "price": 4.5, "inStock": true }, { "sku": "A-101", "name": "Pen", "price": 1.2, "inStock": false } ]',
          ],
        },
        {
          heading: 'Why an array of objects',
          paragraphs: ['An array of objects is what most APIs and apps accept for a list of records, and what most languages read straight into a list. If your API wants the list inside an object, such as { "items": [...] }, wrap it in your code or edit it in the JSON viewer. Rows with nothing in them are skipped, so blank lines between blocks of data do not become empty objects.'],
          links: [{ text: 'JSON viewer', path: '/json-viewer' }],
        },
        {
          heading: 'Header row to keys',
          paragraphs: ['Every key comes from the header cell above it, exactly as written apart from spaces at the start and end. "Unit price" stays "Unit price", with its space and capital letter. APIs usually expect names like unitPrice or unit_price, so rename the header cells to match the API before converting; it is the one change that saves the most work later. Two rules cover the gaps:'],
          list: [
            'An empty header cell becomes its column letter, such as C.',
            'A header that appears twice gets a number: the second Price becomes Price_2, the third Price_3.',
          ],
        },
        {
          heading: 'Numbers and text',
          paragraphs: ['A cell that holds a number becomes a JSON number, using the stored value, not the format Excel shows. That matters in a few places:'],
          list: [
            'A cell shown as 15% becomes 0.15, and a price shown as 1,200.00 becomes 1200.',
            'A code stored as a number loses its leading zeros: 00123 shown through a number format becomes 123. Store such codes as text in Excel (format the column as Text, then type them again) and they arrive as "00123".',
            'Excel keeps only 15 significant digits in a number, so long reference numbers should be stored as text before they are typed in, or they are rounded in the workbook itself.',
            'TRUE and FALSE become true and false. Text stays a string, even if it looks like a number.',
          ],
        },
        {
          heading: 'Dates',
          paragraphs: ['A date cell becomes ISO 8601 text such as "2026-01-05T00:00:00.000Z", which every programming language can read back. The day is kept as the calendar day in the cell, whatever your computer\'s time zone. If your API wants only the date, take the first 10 characters (2026-01-05) in your code. A date typed as text, for example in a column formatted as Text, stays exactly as it was typed, so check that a date column holds real dates.'],
        },
        {
          heading: 'Empty cells and formulas',
          paragraphs: ['An empty cell becomes null, so every object has the same keys, which is what most APIs and schema checks expect. If your API wants missing fields left out instead, remove the null values in your code. A formula becomes its value; the formula itself, formatting, charts and images are not in the JSON.'],
        },
        {
          heading: 'Which sheet',
          paragraphs: ['Excel to JSON converts the first sheet. For another sheet, open the workbook in the Excel viewer, click the sheet\'s tab, then click Convert at the top and choose Convert to JSON. The viewer is also a quick place to rename header cells first: the conversion takes the sheet with your edits.'],
          links: [{ text: 'Excel to JSON', path: '/excel-to-json' }, { text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'Before you send it to the API',
          paragraphs: ['The result opens in the JSON viewer, where you can read it as a tree or a table, fix values and minify it. A few next steps help when the JSON feeds code:'],
          list: [
            'Write a schema from the result with JSON Schema, and check later files against it.',
            'Get TypeScript interfaces for the records with JSON to TypeScript.',
            'If the sheet holds customer names, emails or phone numbers and the JSON is test data, mask them first with Mask data.',
          ],
          links: [{ text: 'JSON Schema', path: '/json-schema' }, { text: 'JSON to TypeScript', path: '/json-to-typescript' }, { text: 'Mask data', path: '/mask-data' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with the header row and one made-up row of the sheet, and the JSON your API expects (no personal data).`],
        },
      ],
    },
    '/pdf-to-ai-chat-with-tables': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Turn the PDF into Markdown first and paste that, not text copied straight from the PDF. A PDF stores words at positions on a page, not rows and columns, so a plain copy runs the cells of a table together; Markdown writes each row on its own line with a | between cells, which ChatGPT, Claude and Gemini read as a table. OpenAnyDoc\'s PDF to Markdown does this in your browser, and the file is never uploaded.'],
          links: [{ text: 'PDF to Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'Why tables fall apart when you copy a PDF',
          paragraphs: [
            'A PDF is made for printing. Inside the file, a table is not a table: it is a set of short pieces of text, each placed at an exact spot on the page, plus some lines drawn around them. Nothing in the file says that "North" and "1,240" belong to the same row.',
            'When you select a table and copy it, your PDF reader guesses an order and joins the pieces with spaces or line breaks. A row like Region, Units, Total can arrive as three separate lines, or as one long line where you can no longer tell which number belongs to which column. An AI chat then has to guess the layout again, and a wrong guess shows up as a total in the wrong row or a summary that mixes two columns.',
            'Attaching the PDF to the chat does not remove the problem: the service reads the text out of the file in its own way, and you cannot see what it read before it answers. It also sends the whole file to that service, including pages you did not need to share.',
          ],
        },
        {
          heading: 'Why Markdown keeps rows and columns',
          paragraphs: ['Markdown is plain text with a few marks for structure. A table is written row by row, with a | between cells and a line of dashes under the header, for example:'],
          list: [
            '| Region | Units | Total |',
            '|---|---|---|',
            '| North | 120 | 1,240 |',
          ],
        },
        {
          heading: 'Rows and columns you can check',
          paragraphs: ['Every AI chat that reads Markdown understands this layout, and so can you: the cells are in plain sight, so you can check them before you send anything. Headings marked with # and lists marked with - travel the same way, which helps the chat tell a section title from the text under it.'],
        },
        {
          heading: 'How to do it, step by step',
          paragraphs: ['PDF to Markdown runs on your computer or phone, and nothing is sent to a server or to an AI service:'],
          list: [
            'Open PDF to Markdown and choose your PDF, or drop it on the page.',
            'Click Convert to Markdown. Text clearly larger than the body becomes #, ## or ### headings, bulleted and numbered lines become lists, and three or more lines in a row that are split into the same number of columns become a Markdown table.',
            'Read the result in the text box. Look at each table and check a few numbers against the PDF.',
            'Click Copy and paste it into the chat, or download it as .md, .txt or .html. The token count under the result tells you how much of the chat it will use.',
          ],
          links: [{ text: 'PDF to Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'When the table still comes out wrong',
          paragraphs: ['Tables are found from how the text lines up, so some PDFs need help:'],
          list: [
            'The result is empty: the PDF is probably scanned, so its pages are pictures with no text. Run OCR PDF first, then convert the new file. Text recognition reads tables as lines of words, so check those tables closely.',
            'Merged cells, cells that wrap onto a second line or empty cells can break a table into plain lines of text.',
            'Pages laid out in two columns may need a check of the reading order.',
            'Pictures and charts are left out; only the text is converted.',
          ],
          links: [{ text: 'OCR PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'For a large or messy table',
          paragraphs: ['If one big table is what you need, PDF to Excel puts each page in its own sheet, where you can fix a misplaced cell by hand. Then Excel to Markdown turns the sheet you pick into a clean Markdown table to paste.'],
          links: [{ text: 'PDF to Excel', path: '/pdf-to-excel' }, { text: 'Excel to Markdown', path: '/excel-to-markdown' }],
        },
        {
          heading: 'Check these before you paste',
          paragraphs: ['A few minutes here saves sharing more than you meant to:'],
          list: [
            'Personal data: names, email addresses, phone numbers and ID numbers. Mask data replaces them on your device; it reads plain text files, so rename the downloaded .md file to .txt and open it there.',
            'Length: if the token count is high, paste only the pages or the table you need. The guide to how many tokens your PDF uses explains the numbers.',
            'Your own rules: if the PDF is a work document, follow your organisation\'s rules on which AI services may see it.',
          ],
          links: [{ text: 'Mask data', path: '/mask-data' }, { text: 'how many tokens your PDF uses', path: '/how-many-tokens-is-my-pdf' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the table that did not come out right (no personal data).`],
        },
      ],
    },
    '/how-many-tokens-is-my-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['There is no fixed number of tokens per page: it depends on how many words the page holds, the language they are in, whether it is mostly tables, and which AI model reads it. In our test, a page of 415 English words came to 467 tokens, the same text in Arabic to 571, and a page holding one table of 40 rows to 889. To know your own file\'s number, drop it into OpenAnyDoc\'s Token counter, which counts it in your browser without uploading it.'],
          links: [{ text: 'Token counter', path: '/token-counter' }],
        },
        {
          heading: 'What a token is',
          paragraphs: [
            'An AI model does not read letters or words. It reads tokens: pieces of text that it treats as one unit. A short common word is often one token, a long or rare word is split into several, and punctuation, numbers and spaces take tokens too.',
            'Counting words is not the same thing. On our English test page below, 415 words came to 467 tokens, a little over one token per word, but that ratio changes from file to file.', 'Chat limits, file limits and the prices of AI services are counted in tokens. A long conversation also counts everything said before and the answer being written, so a document that only just fits may leave little room for the reply.',
          ],
        },
        {
          heading: 'Why a page count is a poor guide',
          paragraphs: ['"Ten pages" can mean very different amounts of text. We measured three synthetic pages with the same counter the site uses:'],
          list: [
            'A report page of plain English prose, 415 words: 467 tokens.',
            'The same report written in Arabic, 319 words: 571 tokens, about a fifth more for the same meaning.',
            'A page with one table of 40 rows and 5 columns (codes, regions, prices, totals), 247 words: 889 tokens, nearly twice the prose page with fewer words.',
            'A scanned page: 0 tokens until text recognition adds its text, because the page is only a picture.',
          ],
        },
        {
          heading: 'Where the differences come from',
          paragraphs: [
            'Tables cost more because numbers, codes and the | marks between cells are short pieces that are rarely joined into one token. Font size, margins and pictures change how many words fit on a page at all.',
            'Language matters because tokenizers learn their pieces from text, and most of that text is English. English words are often a single token; Arabic words, with their attached prefixes and suffixes, are more often split. That is why the Arabic page above had fewer words but more tokens.',
          ],
        },
        {
          heading: 'Why the model matters',
          paragraphs: ['Every AI model has its own tokenizer, so the same PDF gives a different number in each. OpenAnyDoc counts with one standard tokenizer that some widely used models share. For other models, Claude and Gemini among them, the number is an estimate, usually close but not exact. When a file is near a limit, leave some room rather than relying on the last few hundred tokens.'],
        },
        {
          heading: 'How to count your own PDF exactly',
          paragraphs: ['Token counter reads the file on your device; nothing is sent to a server or to an AI service:'],
          list: [
            'Open Token counter and choose your PDF, or drop it on the page. Word, PowerPoint, Excel, CSV, JSON, TXT and Markdown files work too, or you can paste text.',
            'The PDF is turned into the same Markdown that PDF to Markdown makes, so you count the text you would actually paste.',
            'Read the tokens, words and characters under the text box.',
            'The text box can be edited: delete the parts you will not paste and the count updates.',
          ],
          links: [{ text: 'Token counter', path: '/token-counter' }, { text: 'PDF to Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'If the number is too high',
          paragraphs: ['Send less rather than hoping the chat copes:'],
          list: [
            'Keep only the pages you need with Extract PDF pages, then count again.',
            'Cut a long report into parts with Split PDF and paste one part at a time, telling the chat to wait until the last part arrives.',
            'For lists of records in JSON, JSON to TOON writes the same data in a shorter form.',
            'If the count is 0, the PDF is scanned; run OCR PDF first.',
            'Tables cost the most, so paste them in a form the chat can read. Giving ChatGPT a PDF without losing the tables shows how.',
          ],
          links: [{ text: 'Extract PDF pages', path: '/extract-pdf-pages' }, { text: 'Split PDF', path: '/split-pdf' }, { text: 'JSON to TOON', path: '/json-to-toon' }, { text: 'OCR PDF', path: '/ocr-pdf' }, { text: 'Giving ChatGPT a PDF without losing the tables', path: '/pdf-to-ai-chat-with-tables' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the file and the count you see (no personal data).`],
        },
      ],
    },
    '/word-document-to-ai-chat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Convert the .docx file to Markdown and paste that. Markdown marks Word\'s headings with #, ## and ###, keeps bulleted and numbered lists as lists and keeps links with their address, so ChatGPT, Claude or Gemini can follow the outline of the document. OpenAnyDoc\'s Word to Markdown does it in your browser without uploading the file. Tables become Markdown tables too.'],
          links: [{ text: 'Word to Markdown', path: '/word-to-markdown' }],
        },
        {
          heading: 'What gets lost when you copy from Word',
          paragraphs: [
            'Word shows structure with styles: a heading is a paragraph with the Heading 1 style, a list is a paragraph with numbering switched on. Many chat boxes keep only the plain text of what you paste, so the styles are gone and a section title looks like any other line. On a long document the AI then has to guess where one part ends and the next begins.',
            'Attaching the .docx instead sends the whole file to the AI service, including comments, tracked changes or hidden text you may have forgotten about, and you cannot see which parts it actually read.',
          ],
        },
        {
          heading: 'What Markdown keeps',
          paragraphs: ['Markdown carries the structure as ordinary characters, so it survives any paste:'],
          list: [
            'Headings: Word\'s heading styles become #, ## and ###.',
            'Bold and italic text keep their marks.',
            'Bulleted and numbered lists stay lists, with sub-points indented under their parent.',
            'Links keep their address.',
            'Pictures, charts and shapes are left out; only the text is converted.',
          ],
        },
        {
          heading: 'How to do it',
          paragraphs: ['Word to Markdown runs on your device, and nothing is sent to a server or to an AI service:'],
          list: [
            'Open Word to Markdown and choose a .docx, .dotx or .docm file, or drop it on the page.',
            'The Markdown appears in a text box, with its token count.',
            'Read it through, then click Copy and paste it into the chat, or download the .md file.',
          ],
          links: [{ text: 'Word to Markdown', path: '/word-to-markdown' }],
        },
        {
          heading: 'Get the headings right in Word first',
          paragraphs: [
            'Headings are found from Word\'s heading styles, not from how text looks. A line you made bold and large by hand stays an ordinary paragraph. Before converting, click into each section title and choose Heading 1, Heading 2 or Heading 3 from the Styles list; the Navigation pane in Word shows which titles it already sees as headings.',
            'Old .doc files and OpenDocument .odt files are not read here. Open them in Word or LibreOffice and save them as .docx first. If you only want to read an .odt file, the Word viewer opens it.',
          ],
          links: [{ text: 'Word viewer', path: '/word-viewer' }],
        },
        {
          heading: 'Tables',
          paragraphs: ['Word to Markdown turns each table into a Markdown table, with the table\'s first row as the header row, so an AI chat reads the rows and columns instead of a run of loose cells. Markdown has no merged cells, so a table with merged cells or a table inside a table comes out flattened. When such a table matters, copy it from Word into a spreadsheet such as Excel or LibreOffice Calc, fix the layout there and save it as .xlsx; Excel to Markdown then turns that sheet into a clean Markdown table you can paste under the rest of the document. The same idea works for a table inside a PDF; see giving an AI chat a PDF without losing the tables.'],
          links: [{ text: 'Excel to Markdown', path: '/excel-to-markdown' }, { text: 'giving an AI chat a PDF without losing the tables', path: '/pdf-to-ai-chat-with-tables' }],
        },
        {
          heading: 'Before you paste',
          paragraphs: ['Two checks are worth the minute they take:'],
          list: [
            'Personal data: contracts, reports and letters often hold names, email addresses, phone numbers or ID numbers. Mask data replaces them on your device; it reads plain text files, so rename the downloaded .md file to .txt and open it there.',
            'Length: the token count under the result shows how much of the chat the document will fill. Token counter explains the number, and other models count a little differently.',
          ],
          links: [{ text: 'Mask data', path: '/mask-data' }, { text: 'Token counter', path: '/token-counter' }],
        },
        {
          heading: 'Ask by section',
          paragraphs: ['Once the Markdown is in the chat, you can point at parts of the document by their headings: rewrite the section called Payment terms in plain language, list every deadline under Delivery, or check that the summary matches the sections after it. Requests like these work only when the headings came through, which is the main reason to convert rather than paste.'],
        },
        {
          heading: 'Slides and PDFs',
          paragraphs: ['A presentation needs a different shape, one section per slide with its speaker notes; see giving a PowerPoint deck to an AI chat. For a PDF, use PDF to Markdown.'],
          links: [{ text: 'giving a PowerPoint deck to an AI chat', path: '/powerpoint-to-ai-chat' }, { text: 'PDF to Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the document (no personal data).`],
        },
      ],
    },
    '/powerpoint-to-ai-chat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Turn the deck into a text outline and paste that: one section per slide with its title, the slide\'s text as bullet points and the speaker notes underneath. OpenAnyDoc\'s PowerPoint to Markdown makes this outline from a .pptx file in your browser, without uploading it, so ChatGPT, Claude or Gemini can work slide by slide.'],
          links: [{ text: 'PowerPoint to Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'Why a deck is hard to paste',
          paragraphs: [
            'The words of a presentation are spread over dozens of separate text boxes. Copying them slide by slide is slow, since a forty-slide deck means forty rounds of copy and paste, and the order of the boxes often comes out wrong. The speaker notes, which usually hold the real explanation, sit in a separate pane and are easy to leave behind.',
            'Attaching the .pptx sends the whole file, pictures included, to the AI service, and you cannot see which text it picked up. A text outline is smaller, and you can read every word of it before you send it.',
          ],
        },
        {
          heading: 'What the outline looks like',
          paragraphs: ['Each slide follows the same pattern, numbered in the order of the slides in the file, so the chat can refer to "slide 4" and mean the same slide you do:'],
          list: [
            '# The deck\'s name, from the file name.',
            '## Slide 1: and the slide\'s title.',
            '- Each piece of text on the slide as a bullet point.',
            '> Speaker notes: written as a quote under their slide.',
          ],
        },
        {
          heading: 'How to do it',
          paragraphs: ['PowerPoint to Markdown runs on your device, and nothing is sent to a server or to an AI service:'],
          list: [
            'Open PowerPoint to Markdown and choose a .pptx, .ppsx, .potx or .pptm file, or drop it on the page.',
            'The outline appears in a text box, with its token count.',
            'Read it through, then click Copy and paste it into the chat, or download the .md file.',
          ],
          links: [{ text: 'PowerPoint to Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'What the outline keeps and what it drops',
          paragraphs: ['The outline carries the words of the file, read slide by slide. A few things are worth knowing:'],
          list: [
            'Titles come from the slide\'s title placeholder. A title typed into an ordinary text box shows up as a bullet point, and the slide is headed only Slide N.',
            'Indented sub-points come out at the same level as the points above them.',
            'Each cell of a table on a slide becomes its own bullet point.',
            'Hidden slides are included, so delete any you do not want to share.',
            'Pictures, charts, SmartArt and text inside pictures are left out.',
            'Comments left by reviewers are not included.',
            'Old .ppt files are not read; save them as .pptx in PowerPoint first.',
          ],
        },
        {
          heading: 'What to ask once it is pasted',
          paragraphs: ['Because every slide is labelled, you can ask for work slide by slide: a one-line summary of each slide, speaker notes for the slides that have none, a check that the notes and the slides say the same thing, or a shorter version of the deck for a ten-minute slot. Ask it to give the slide number with every change it suggests, so you can find each one quickly when you edit the deck. To see the slides as they were designed while you work, open the file in the PowerPoint viewer.'],
          links: [{ text: 'PowerPoint viewer', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'Before you paste',
          paragraphs: ['Speaker notes are written for the presenter, not the audience, so read them as well as the slides:'],
          list: [
            'Personal data: customer names, email addresses or phone numbers in notes or tables. Mask data replaces them on your device; it reads plain text files, so rename the downloaded .md file to .txt and open it there.',
            'Length: a long deck with full notes can use more tokens than you expect. The token count is shown with the outline; how many tokens a file uses explains the number.',
          ],
          links: [{ text: 'Mask data', path: '/mask-data' }, { text: 'how many tokens a file uses', path: '/how-many-tokens-is-my-pdf' }],
        },
        {
          heading: 'Documents too',
          paragraphs: ['For a report written in Word, the same idea keeps its headings and lists: see giving a Word document to an AI chat.'],
          links: [{ text: 'giving a Word document to an AI chat', path: '/word-document-to-ai-chat' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the presentation (no personal data).`],
        },
      ],
    },
    '/how-to-merge-pdf-files': {
      published: '2026-11-20',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A Mac can merge PDFs with Preview. Windows and Android have no merge built in, so the simplest way there is a browser tool. OpenAnyDoc\'s Merge PDF works in any modern browser on any of these devices and joins the files on your device, without uploading them.'],
          links: [{ text: 'Merge PDF', path: '/merge-pdf' }],
        },
        {
          heading: 'On a Mac: Preview',
          paragraphs: ['Preview, the PDF app that comes with every Mac, can add one PDF to another. Open the first PDF, choose View, then Thumbnails, and select the page after which the next file should go. Choose Edit, then Insert, then Page from File, and pick the other PDF. Drag thumbnails to change the order. Preview changes the file you opened, so if you want to keep the original, make a copy first with File, then Duplicate, and save the copy. The steps are in Apple\'s pages Add, delete, or move PDF pages and Combine PDFs in Preview (checked 24 November 2026).'],
          links: [{ text: 'Add, delete, or move PDF pages', path: 'https://support.apple.com/guide/preview/prvw11793/mac' }, { text: 'Combine PDFs in Preview', path: 'https://support.apple.com/guide/preview/prvw43696/mac' }],
        },
        {
          heading: 'On Windows: no built-in merge',
          paragraphs: ['Windows opens and prints PDFs in Microsoft Edge, but neither Edge nor Windows has a command that joins two PDFs. Printing to Microsoft Print to PDF makes a new PDF from one file at a time, so it cannot combine files either. You can install a PDF program, or use a tool in the browser you already have: open Merge PDF in Edge or Chrome, and there is nothing to install and nothing uploaded.'],
          links: [{ text: 'Merge PDF in Edge or Chrome', path: '/merge-pdf' }],
        },
        {
          heading: 'On Android: use the browser',
          paragraphs: ['Android has no merge built in, and the file apps that phone makers add differ. Open Merge PDF in Chrome or another browser, tap Choose a file and pick the PDFs from your downloads or another folder. On a phone, set the order with the arrows under each file.'],
        },
        {
          heading: 'In your browser, with nothing uploaded',
          paragraphs: ['Merge PDF works the same on a computer or phone:'],
          list: [
            'Choose two or more PDFs, or drop them on the page. You can add more at any time.',
            'Drag the thumbnails into order, or use the arrows under each file.',
            'Click Merge PDF and download one file, named after the first PDF.',
          ],
          links: [{ text: 'Merge PDF', path: '/merge-pdf' }],
        },
        {
          heading: 'Getting the order right',
          paragraphs: [
            'Merge PDF orders whole files: each thumbnail is a file\'s first page, and all its pages follow in their own order. That covers most jobs, such as a cover letter, then a form, then three receipts.',
            'If single pages need to move, for example to put one page of the second file in the middle of the first, merge first and then pass the result to Organize PDF. The next steps after the download hand the file over without choosing it again. Organize PDF also turns, duplicates and deletes pages, and Remove PDF pages drops pages you do not want to send.',
          ],
          links: [{ text: 'Organize PDF', path: '/organize-pdf' }, { text: 'Remove PDF pages', path: '/remove-pdf-pages' }],
        },
        {
          heading: 'Adding photos or blank pages',
          paragraphs: [
            'Merge PDF takes PDF files only. To add a photo of a receipt or a screenshot, turn it into a PDF first with JPG to PDF, then merge it with the rest. The guide on turning photos into one PDF covers page size and margins.',
            'To add a blank page, open the merged file in Organize PDF and insert one: it takes the size of the page before it. This is useful before printing on both sides, so that each document starts on a new sheet.',
          ],
          links: [{ text: 'JPG to PDF', path: '/jpg-to-pdf' }, { text: 'turning photos into one PDF', path: '/photos-to-one-pdf' }, { text: 'Organize PDF', path: '/organize-pdf' }],
        },
        {
          heading: 'File size',
          paragraphs: [
            'Merging copies the pages as they are, so text stays sharp and selectable, and the merged file is about as large as the files added together. Merging does not make anything smaller; to shrink the merged file afterwards, open it in Compress PDF.',
            'If the files are large because they are full of camera photos, make the photos smaller with Compress image before you turn them into a PDF. If the merged file is too big to email, cut it into parts again with Split PDF; the guide on how to split a PDF explains the page ranges. Very large sets of files are limited by your device\'s memory.',
          ],
          links: [{ text: 'Compress PDF', path: '/compress-pdf' }, { text: 'Compress image', path: '/compress-image' }, { text: 'Split PDF', path: '/split-pdf' }, { text: 'how to split a PDF', path: '/how-to-split-a-pdf' }],
        },
        {
          heading: 'If a file will not merge',
          paragraphs: ['Three things can get in the way:'],
          list: [
            'A PDF that needs a password to open cannot be read. If you know the password, remove it first with Unlock PDF, which also runs in your browser.',
            'Bookmarks and fillable form fields of the original files may not carry over. Fill in a form first with Fill PDF form and tick Flatten on save, so the answers stay as part of the page.',
            'A file that no app will open may be damaged; Repair PDF tries to rebuild it.',
          ],
          links: [{ text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'Fill PDF form', path: '/fill-pdf' }, { text: 'Repair PDF', path: '/repair-pdf' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the files you are trying to merge (no personal data).`],
        },
      ],
    },
    '/how-to-split-a-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['First decide what you want back: several files from one PDF, or one file with only some of its pages. Split PDF does the first, by page ranges, every few pages, or one file per page in a ZIP; Extract PDF pages saves the pages you click as one new PDF, and Remove PDF pages saves the PDF without the ones you click. All three run in your browser, nothing is uploaded, and your original file stays as it was.'],
          links: [{ text: 'Split PDF', path: '/split-pdf' }, { text: 'Extract PDF pages', path: '/extract-pdf-pages' }, { text: 'Remove PDF pages', path: '/remove-pdf-pages' }],
        },
        {
          heading: 'Which tool for which job',
          paragraphs: ['Pick by the result you need:'],
          list: [
            'Several files, each with its own pages: Split PDF, by page ranges or every few pages.',
            'Every page as its own file: Split PDF with One file per page, or Extract PDF pages with One PDF per page.',
            'One file with a few chosen pages: Extract PDF pages.',
            'The same file minus a few pages: Remove PDF pages.',
            'The same pages in a new order: Organize PDF.',
          ],
          links: [{ text: 'Split PDF', path: '/split-pdf' }, { text: 'Organize PDF', path: '/organize-pdf' }],
        },
        {
          heading: 'How to write page ranges',
          paragraphs: [
            'In Split PDF, choose By page ranges and type the ranges separated by commas. A hyphen means "from this page to that one", and each range becomes its own PDF. Page numbers count from the first page of the file, not from the numbers printed on the pages.',
            'Say a 12-page report has a two-page summary, eight pages of findings and a two-page appendix. Typing 1-2, 3-10, 11-12 gives three PDFs, one for each part. Typing 5 alone gives a file with page 5. Arabic digits and the Arabic comma work too.',
            'If the file is a stack of same-length documents, such as 30 pages of three-page forms, choose Every few pages and set 3 to get ten files. Several files come in one ZIP, named after your PDF and its page numbers.',
          ],
        },
        {
          heading: 'One file per page, in a ZIP',
          paragraphs: ['Choose One file per page and every page becomes its own PDF, all in one ZIP. Most computers and phones open a ZIP when you double-click or tap it, and show the PDFs inside. This is the way to send page 4 to one person and page 7 to another, or to hand pages to a system that takes one document per upload.'],
        },
        {
          heading: 'Saving only some pages',
          paragraphs: [
            'When you want one smaller PDF rather than many, use Extract PDF pages: click the thumbnails you want, Shift+click to pick a run, and download them as a new PDF. The pages keep the order they have in the original, and the name tells you what is inside, such as report-pages-2,4-6.pdf.',
            'When only a few pages must go, Remove PDF pages is quicker: click the ones to delete and download the rest. A PDF needs at least one page, so it will not remove them all. If the kept pages also need a new order, pass the result to Organize PDF.',
          ],
          links: [{ text: 'Extract PDF pages', path: '/extract-pdf-pages' }, { text: 'Remove PDF pages', path: '/remove-pdf-pages' }, { text: 'Organize PDF', path: '/organize-pdf' }],
        },
        {
          heading: 'Without a website',
          paragraphs: ['A computer can also save some pages as a new PDF through its print dialog:'],
          links: [{ text: 'Apple\'s Preview guide', path: 'https://support.apple.com/guide/preview/prvw11793/mac' }, { text: 'Chrome Help', path: 'https://support.google.com/chrome/answer/1069693?co=GENIE.Platform%3DAndroid' }],
          list: [
            'Mac: in Preview, select the page thumbnails you want in the sidebar and drag them to the desktop; Apple\'s Preview guide says this creates a new PDF (checked 24 November 2026). File, then Print, then Save as PDF from the PDF menu also saves a PDF.',
            'Windows: open the PDF in Microsoft Edge, choose Print, pick Microsoft Print to PDF as the printer, type the pages, and print to a new file.',
            'Android: in Chrome, Share, then Print, offers a Save as PDF printer (Chrome Help, checked 24 November 2026).',
          ],
        },
        {
          heading: 'What carries over',
          paragraphs: [
            'Split PDF copies pages as they are, so text stays sharp and selectable, and pictures keep their quality. A 150-page PDF splits in seconds, with a progress bar. Printing to PDF, as above, makes the pages again through the print system, so links and form fields may be lost; the tools here copy links with the pages, but form fields may not stay fillable.',
            'Bookmarks and links that jump between pages may not carry over to the new files. A PDF that needs a password to open must have the password removed first with Unlock PDF, if you know it.',
          ],
          links: [{ text: 'Split PDF', path: '/split-pdf' }, { text: 'Unlock PDF', path: '/unlock-pdf' }],
        },
        {
          heading: 'After splitting',
          paragraphs: ['Each part is an ordinary PDF. You can join parts with other files again, as the guide on how to merge PDF files shows, number each part\'s pages from 1 with Add page numbers, or put a password on a part before you send it, as explained in password-protecting a PDF.'],
          links: [{ text: 'how to merge PDF files', path: '/how-to-merge-pdf-files' }, { text: 'Add page numbers', path: '/add-page-numbers' }, { text: 'password-protecting a PDF', path: '/password-protect-pdf-free' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe how you want the PDF split (no personal data).`],
        },
      ],
    },
    '/photos-to-one-pdf': {
      published: '2026-11-20',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Add the photos to JPG to PDF in your browser, drag them into order, choose a page size and margin, and download one PDF. It reads JPG, PNG and iPhone HEIC photos, as well as WebP, TIFF and other pictures, on your device, so nothing is uploaded. For photos of paper documents, Scan to PDF straightens each page first.'],
          links: [{ text: 'JPG to PDF', path: '/jpg-to-pdf' }, { text: 'Scan to PDF', path: '/scan-to-pdf' }],
        },
        {
          heading: 'Choose the photos',
          paragraphs: [
            'On a phone, open JPG to PDF and tap Choose a file: the phone offers its photo library as well as its files, so you can pick photos straight from the camera roll. On a computer, drop the pictures on the page. You can add more at any time.',
            'iPhones save photos as HEIC by default. Safari reads them itself, since Safari 17 (WebKit\'s Safari 17.0 notes, checked 24 November 2026); in Chrome, Edge and Firefox a HEIC decoder loads the first time you add one, and the photo is still read on your device. A few photos taken with the newest iPhone settings may not decode; save those as JPG on the phone first, or convert them with HEIC to JPG.',
          ],
          links: [{ text: 'HEIC to JPG', path: '/heic-to-jpg' }, { text: 'WebKit\'s Safari 17.0 notes', path: 'https://webkit.org/blog/14445/' }],
        },
        {
          heading: 'Put them in order',
          paragraphs: ['The order you pick photos in is not always the order the pages should have. Drag the pictures into place with a mouse, or use the buttons under each picture on a phone. The PDF follows this order, one picture per page. Photos that the phone saved sideways but marked as turned are drawn upright, so a portrait photo stays portrait.'],
        },
        {
          heading: 'Page size, orientation and margins',
          paragraphs: ['Three settings decide how each photo sits on its page:'],
          list: [
            'Page size: A4 or Letter if the PDF will be printed or attached to a form (Letter is the usual paper size in the United States and Canada, A4 in most other countries), or Same as the picture if it will only be read on a screen.',
            'Orientation: Portrait, Landscape, or Follow each picture, which suits a mix of upright and wide photos.',
            'Margin: None, Small or Large. A small margin keeps a printer from cutting the edges; no margin suits a page the size of the picture.',
          ],
        },
        {
          heading: 'Photos of documents: use Scan to PDF',
          paragraphs: [
            'A photo of a letter or a receipt taken at an angle looks crooked in a PDF, with a dark table around it. Scan to PDF fixes that: drag the four corners onto the paper\'s corners and the page is straightened as if it had been scanned flat, and its Document look turns the paper white and the ink dark, evening out shadows. You can take the photos from that page with the phone\'s camera.',
            'Either way, the pages are pictures, so the words cannot be searched or copied. To make them searchable, see how to make a scanned PDF searchable.',
          ],
          links: [{ text: 'Scan to PDF', path: '/scan-to-pdf' }, { text: 'make a scanned PDF searchable', path: '/make-scanned-pdf-searchable' }],
        },
        {
          heading: 'Keeping the PDF small',
          paragraphs: [
            'JPG to PDF puts PNG photos, and JPG photos that are already upright, into the PDF as they are, without compressing them again; a JPG saved sideways is redrawn upright once. Quality is kept, but the PDF is about as large as the photos together, and phone photos are often several megabytes each.',
            'To make it smaller, make the photos smaller first:',
          ],
          list: [
            'Compress image: a quality of 75 usually gives files less than half the size, with a before and after view to check.',
            'Resize image: a photo for a document rarely needs the full camera resolution.',
            'Screenshots saved as PNG shrink less; convert them to JPG while compressing.',
            'Scan to PDF already reduces very large photos to 2,000 pixels on the long side of each page.',
            'Or make the finished PDF smaller with Compress PDF.',
          ],
          links: [{ text: 'Compress image', path: '/compress-image' }, { text: 'Resize image', path: '/resize-image' }, { text: 'Compress PDF', path: '/compress-pdf' }],
        },
        {
          heading: 'Location and camera details',
          paragraphs: ['Phone photos often record where and when they were taken and which phone took them. If the PDF is going to someone you do not know well, save clean copies of the photos first with Remove image metadata, which shows what each photo reveals before it removes it.'],
          links: [{ text: 'Remove image metadata', path: '/remove-image-metadata' }],
        },
        {
          heading: 'One PDF, or one per photo',
          paragraphs: ['In JPG to PDF, click Make PDF, check the preview and download one PDF. If each photo should be its own file, tick One PDF per picture and you get a ZIP instead. To add the photos to a PDF you already have, make the photo PDF first and then join the two with Merge PDF; the guide on how to merge PDF files covers the order.'],
          links: [{ text: 'JPG to PDF', path: '/jpg-to-pdf' }, { text: 'Merge PDF', path: '/merge-pdf' }, { text: 'how to merge PDF files', path: '/how-to-merge-pdf-files' }],
        },
        {
          heading: 'On the phone itself',
          links: [{ text: 'Scan Documents command', path: 'https://support.apple.com/108963' }, { text: 'Google Drive app has a scanner', path: 'https://support.google.com/drive/answer/3145835?co=GENIE.Platform%3DAndroid' }],
          paragraphs: ['Phones have their own ways too. On an iPhone or iPad, the Files and Notes apps have a Scan Documents command that photographs pages. On Android, the Google Drive app has a scanner that can save the scan as a PDF in your Drive (Apple\'s and Google\'s help pages, checked 24 November 2026). These give fewer choices of page size and margin, and Drive keeps the scan in your online account.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the photos you are trying to combine (no personal data).`],
        },
      ],
    },
    '/password-protect-pdf-free': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Choose the PDF in Protect PDF, type a password twice and download the locked copy. It is encrypted with AES-256 in your browser, and neither the file nor the password is uploaded; anyone who opens the copy needs the password. Send the password by a different route than the file, and keep the original, because a forgotten password cannot be recovered.'],
          links: [{ text: 'Protect PDF', path: '/protect-pdf' }],
        },
        {
          heading: 'Two kinds of PDF password',
          paragraphs: [
            'A PDF can carry two different passwords, and they do very different jobs.',
            'The password to open encrypts the file. Without it, the pages cannot be read at all. This is the one that keeps a document private.',
            'A permissions password goes with restrictions on printing, copying text and pictures, or changing the document. The file opens without it, and the restrictions are a request that most PDF readers honour, not a lock. A PDF that opens freely but will not print has only restrictions, and Unlock PDF lifts them without any password, which shows how little they protect.',
            'Protect PDF always sets a password to open, of at least 4 characters. Untick Print, Copy text and pictures or Change the document if you also want restrictions, and add an optional permissions password.',
          ],
          links: [{ text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'Protect PDF', path: '/protect-pdf' }],
        },
        {
          heading: 'What a password stops, and what it does not',
          paragraphs: ['A password to open keeps the content from anyone who has the file but not the password: an email sent to the wrong address, a lost USB stick, a shared folder with too many members. It does not stop everything:'],
          list: [
            'Anyone who has the password can read, print, photograph or forward the pages, and can save a copy without the password.',
            'The file name is not encrypted, so a name such as salary-review-2026.pdf already says what is inside. Give the file a plain name.',
            'A short or guessable password can be found by trying many passwords. AES-256 is the strongest encryption PDF readers support, but its strength depends on the password.',
            'A password does not show who sent the file or whether it was changed; that needs a certificate-based digital signature.',
          ],
        },
        {
          heading: 'Choose a password that holds',
          paragraphs: ['Use a long password: several unrelated words, with a number or a symbol between them, are easier to remember and harder to guess than one short word. Avoid names, dates of birth, phone numbers and anything printed in the document itself. Do not reuse a password from an email or bank account. Type it twice in Protect PDF; Show passwords lets you check it before you lock the file.'],
        },
        {
          heading: 'Send the password separately',
          paragraphs: [
            'A password in the same email as the file protects nothing: whoever gets the email gets both. Send the file one way and the password another:',
          ],
          list: [
            'Email the PDF, then send the password in a text message or a chat app, or say it on a call.',
            'For someone you send files to often, agree a password once, in person or by phone, rather than sending a new one each time.',
            'Never put the password in the file name, the email subject or the document.',
          ],
        },
        {
          heading: 'Restrictions: when they are worth it',
          paragraphs: ['Restrictions suit cases where you trust the reader but want to discourage casual changes, such as a final price list or a signed agreement sent for reference. Most readers will then grey out printing or copying. Do not rely on them for anything secret: anyone who can open the file can remove them, for example with Unlock PDF. If you set a permissions password, make it different from the password to open.'],
          links: [{ text: 'Unlock PDF', path: '/unlock-pdf' }],
        },
        {
          heading: 'Removing or changing the password later',
          paragraphs: ['Your original file stays on your device, unchanged and without a password, so keep it somewhere safe. To take the password off a locked copy, open it in Unlock PDF and type the password; it does not guess or crack passwords. To change a password, remove the old one there and protect the file again. Other tools, such as Merge PDF or Split PDF, need the password removed first.'],
          links: [{ text: 'Unlock PDF', path: '/unlock-pdf' }, { text: 'Merge PDF', path: '/merge-pdf' }, { text: 'Split PDF', path: '/split-pdf' }],
        },
        {
          heading: 'Other free ways',
          paragraphs: ['On a Mac, Preview can add a password when you export the PDF with File, then Export, then Permissions (Apple\'s Preview guide). Word and LibreOffice can encrypt a document with a password when they save it as a PDF (Microsoft\'s page on saving as PDF, LibreOffice\'s PDF export help; all checked 24 November 2026), which suits a document you wrote yourself. Protect PDF works with any PDF that opens without a password, including one that only restricts printing or copying, on any device, and keeps its text, pictures, links and form fields as they are.'],
          links: [{ text: 'Protect PDF', path: '/protect-pdf' }, { text: 'Apple\'s Preview guide', path: 'https://support.apple.com/guide/preview/prvw587dd90f/mac' }, { text: 'Microsoft\'s page on saving as PDF', path: 'https://support.microsoft.com/en-us/office/save-or-convert-to-pdf-or-xps-in-office-desktop-apps-d85416c5-7d77-4fd6-a216-6f4bf7c7c110' }, { text: 'LibreOffice\'s PDF export help', path: 'https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export_security.html' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you need to protect (no personal data, and never send a password).`],
        },
      ],
    },
    '/make-scanned-pdf-searchable': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A scanned PDF holds pictures of pages, so there is no text to search or copy. Text recognition (OCR) reads the words in those pictures and lays them over each page as invisible text. OCR PDF does this in your browser, in English, Arabic or both, without uploading the file; the first use loads the text reader from this site, and after that it works offline.'],
          links: [{ text: 'OCR PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'Is your PDF a scan?',
          paragraphs: [
            'Open the PDF and try to select a word, or press Ctrl+F (Cmd+F on a Mac) and search for a word you can see. If nothing selects and nothing is found, the page is a picture. PDFs made by a scanner, a phone app or Scan to PDF are usually like this, and so are documents that were printed and scanned back.',
            'Some PDFs mix both: typed pages with a few scanned ones. OCR PDF leaves pages that already have text as they are, unless you untick Leave pages that already have text.',
          ],
          links: [{ text: 'Scan to PDF', path: '/scan-to-pdf' }],
        },
        {
          heading: 'What OCR changes, and what it does not',
          paragraphs: [
            'The scan stays exactly as sharp as it was. OCR adds a layer of invisible text, word by word, over the places where the words appear. The page looks the same, but search finds words, you can select and copy text, and other tools can now read it.',
            'It does not make the page editable like a document: the words you see are still the picture. To change the wording, convert the searchable copy to Word, as explained in why you can\'t edit text in a PDF.',
          ],
          links: [{ text: 'why you can\'t edit text in a PDF', path: '/cant-edit-text-in-pdf' }],
        },
        {
          heading: 'Does OCR need to upload your file?',
          paragraphs: [
            'Many online OCR services, and cloud apps that turn a PDF into a document, read the file on their own servers, so the scan has to be uploaded. That is a real concern for scanned contracts, bank letters or medical forms.',
            'OCR PDF reads the text on your own device. The first time you use it, it loads the text reader and the English and Arabic language data, about 10 MB, from this site itself, not from another company. Your browser keeps them, so later uses start at once and work offline. You can check it in your browser\'s network panel: the reader loads the first time, and the PDF is never sent anywhere.',
          ],
          links: [{ text: 'check it in your browser\'s network panel', path: '/check-file-upload' }],
        },
        {
          heading: 'English, Arabic or both',
          paragraphs: ['Choose the language of the text before you start: English, Arabic, or Arabic and English for pages that mix them, such as a bilingual form. These are the only languages it reads. If it finds no words, check the language choice first, then try a sharper scan.'],
        },
        {
          heading: 'How accurate it is',
          paragraphs: ['Recognition is good on clean printed text and gets worse as the scan does. Know its limits before you rely on the result:'],
          list: [
            'Blurry, small or faint text gives more mistakes; check names, numbers and amounts that matter.',
            'Handwriting is not read reliably and usually comes out wrong.',
            'Tables and columns are read as lines of words, not as a table.',
            'Slightly tilted scans are fine, because words follow their line\'s slope; a page photographed at a steep angle is better straightened first with Scan to PDF.',
            'Reading takes a few seconds a page, depending on your device.',
          ],
          links: [{ text: 'Scan to PDF', path: '/scan-to-pdf' }],
        },
        {
          heading: 'Make it searchable',
          paragraphs: ['Open OCR PDF, choose the scanned PDF, pick the language and click Make searchable. Each page is read in turn. Download the copy and search it in any PDF reader, including the PDF viewer here.'],
          links: [{ text: 'OCR PDF', path: '/ocr-pdf' }, { text: 'PDF viewer', path: '/pdf-viewer' }],
        },
        {
          heading: 'Then get the text out',
          paragraphs: ['Once the PDF has a text layer, the conversion tools can read it:'],
          list: [
            'PDF to text saves every page\'s words as a plain .txt file, Arabic in reading order.',
            'PDF to Word rebuilds paragraphs, headings and lists in an editable document.',
            'Translate PDF turns English into Arabic or Arabic into English, and also needs OCR first for a scan.',
            'If Arabic copied from a PDF comes out reversed, see fixing Arabic text copied from a PDF.',
          ],
          links: [{ text: 'PDF to text', path: '/pdf-to-text' }, { text: 'PDF to Word', path: '/pdf-to-word' }, { text: 'Translate PDF', path: '/translate-pdf' }, { text: 'fixing Arabic text copied from a PDF', path: '/fix-arabic-text-copied-from-pdf' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the scan you are trying to read (no personal data).`],
        },
      ],
    },
    '/split-large-csv': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Cut the file by a number of rows or by a size in MB, and put the header row at the top of every part so each file opens on its own. For Excel, keep each part under 1,048,576 lines, header included. OpenAnyDoc\'s Split CSV does both in your browser: choose rows or MB per file and download all the parts as one ZIP, without uploading the file.'],
          links: [{ text: 'Split CSV', path: '/split-csv' }],
        },
        {
          heading: 'Why every part needs the header row',
          paragraphs: [
            'The first line of a CSV names the columns: order_id, order_date, region, amount. A plain cut leaves that line only in the first part. The second part starts in the middle of the data, so Excel shows a row of numbers where the column names should be, an import form maps the columns wrongly or refuses the file, and an AI chat has to guess what each value means.',
            'The second trap is a field that holds a line break inside quotes, such as an address or a comment. A tool that counts text lines can cut that record in two, leaving half of it at the end of one part and the rest at the top of the next. Splitting by records, not by lines, avoids it.',
          ],
        },
        {
          heading: 'How to split a CSV in your browser',
          paragraphs: ['Split CSV reads the file on your device; nothing is sent to a server:'],
          list: [
            'Open Split CSV and drop the .csv file on the page, or choose it. Once the table is read, the download dialog opens with "Split into several files (a .zip)" already ticked.',
            'In "Split by", keep "Rows per file" and type a number (10,000 is filled in), or pick "Size per file" and enter the MB per file. Under the rows box the dialog tells you how many files you will get.',
            'Press Download. You get one ZIP named after your file, such as orders-parts.zip, holding orders-part-1.csv, orders-part-2.csv and so on, each starting with the header row.',
            'To split only some of the data, close the dialog, filter the rows or hide the columns you don\'t need, then choose "Download options…" in the More menu, tick the shown-rows option and tick the split option again.',
            'A file over 50 MB shows a warning that it may be slow, then still opens if your browser has the memory. There is no row limit of its own. To look through a big file before you split it, use the large CSV viewer.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'A worked example: 2,500,000 rows for Excel',
          paragraphs: ['Say an export has a header and 2,500,000 data rows. An Excel worksheet holds 1,048,576 rows, header included (Microsoft\'s Excel specifications and limits, checked 24 November 2026), so one part can carry at most 1,048,575 data rows. A round 1,000,000 rows per file leaves room and is easy to check:'],
          list: [
            '2,500,000 ÷ 1,000,000 = 2.5, so you get 3 files.',
            'Part 1: the header and rows 1 to 1,000,000, so 1,000,001 lines.',
            'Part 2: the header and rows 1,000,001 to 2,000,000, so 1,000,001 lines.',
            'Part 3: the header and rows 2,000,001 to 2,500,000, so 500,001 lines.',
            'Every part is under 1,048,576 lines, and the parts add up to 2,500,000 data rows: nothing is lost and nothing is counted twice.',
          ],
          links: [{ text: 'Excel specifications and limits', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }],
        },
        {
          heading: 'What we measured on a test file',
          paragraphs: ['We made a synthetic file of orders (order_id, order_date, region, product_code, quantity, amount) with 250,000 data rows and 9.51 MB, and ran it through the same splitting rule the page uses:'],
          list: [
            '100,000 rows per file: 3 parts with 100,000, 100,000 and 50,000 data rows, each with the header.',
            '5 MB per file: 2 parts with 128,221 and 121,779 data rows, 4.88 MB and 4.63 MB. Size mode cuts between rows, so a part ends at the last whole row that fits and usually lands a little under the number you type.',
            'A plain split -l 100000 of the same file on macOS: 3 parts, and only the first had the header; the other two started with an order row.',
          ],
        },
        {
          heading: 'Choose the part size for where the file is going',
          paragraphs: ['The right number depends on what will read the parts:'],
          list: [
            'Excel: up to 1,048,575 data rows per part; 1,000,000 is a safe round number. If Excel is slow even below the row limit, CSV too big for Excel covers the other options.',
            'An upload form with a size limit, such as 10 MB: use "Size per file" and set it a little lower, for example 9 MB, because each part is about that size, not exactly.',
            'An AI chat: what counts there is tokens, not rows. Count one part with the Token counter, then pick a number of rows that fits. File too large for ChatGPT explains the limits.',
            'If a part opens in one column in Excel, the split is fine; the separator does not match your PC. CSV opens in one column explains the fix.',
          ],
          links: [
            { text: 'CSV too big for Excel', path: '/csv-too-big-for-excel' },
            { text: 'Token counter', path: '/token-counter' },
            { text: 'File too large for ChatGPT', path: '/file-too-large-for-chatgpt' },
            { text: 'CSV opens in one column', path: '/csv-opens-in-one-column' },
          ],
        },
        {
          heading: 'The command-line alternative',
          paragraphs: [
            'On macOS and Linux, split -l 1000000 orders.csv part_ cuts a file into pieces of 1,000,000 lines. It does some things better than a browser: it reads the file as a stream, so the file can be larger than your memory, it is fast, and it fits in a script that runs every night. Two things to know: it does not repeat the header, so only part_aa has the column names, and it counts text lines, not records, so a quoted field with a line break inside can be cut in two. split -b cuts at a byte count and can break a row in the middle.',
            'To repeat the header, split everything after the first line, then put the header back on each piece. On our test file these two commands gave three .csv parts that each start with the header. They still count lines, so use them only when no field holds a line break:',
          ],
          list: [
            'tail -n +2 orders.csv | split -l 1000000 - part_',
            'for f in part_*; do (head -n 1 orders.csv; cat "$f") > "$f.csv"; rm "$f"; done',
          ],
        },
        {
          heading: 'Does every part keep the header row?',
          paragraphs: ['Yes, every part made by Split CSV starts with the original header row, so each file opens or imports on its own. If the parts go into a system that wants data rows only, untick "Include the header row" in the same dialog before you press Download, and every part then holds just the rows.'],
        },
        {
          heading: 'Can I split a CSV by the values in one column?',
          paragraphs: ['Not in one step: Split CSV cuts by rows or by size, not by the values in a column. To get one file per region, filter the region column to one value, download the shown rows, and repeat for each value. With a handful of values that takes a few minutes; with hundreds of them, a script is quicker.'],
        },
        {
          heading: 'How do I put the parts back into one file?',
          paragraphs: ['Use Merge CSV: add the parts in order and it writes one CSV with a single header row. Columns are matched by name, so a part whose columns sit in a different order still lines up. Every part needs the same column names in its header, which is one more reason to keep the header in each part.'],
          links: [{ text: 'Merge CSV', path: '/merge-csv' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with the file size, the row count and where the parts need to go (no personal data).`],
        },
      ],
    },
    '/json-vs-json-lines': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A JSON file holds one value, usually one object or one list, and a program has to read the whole file before it can use it. A JSON Lines file (.jsonl, also written NDJSON, .ndjson) holds one JSON value on each line, so records can be read, written or appended one at a time. OpenAnyDoc\'s JSON viewer opens both kinds in your browser without uploading the file, and shows a .jsonl or .ndjson file as a list with one item per line.'],
          links: [{ text: 'JSON viewer', path: '/json-viewer' }],
        },
        {
          heading: 'The same three records, written both ways',
          paragraphs: ['Here are three synthetic log events. As one JSON document they sit inside square brackets, with a comma between them:'],
          list: [
            'JSON: [{"id":1,"event":"login"},{"id":2,"event":"upload"},{"id":3,"event":"logout"}]',
            'JSON Lines, line 1: {"id":1,"event":"login"}',
            'JSON Lines, line 2: {"id":2,"event":"upload"}',
            'JSON Lines, line 3: {"id":3,"event":"logout"}',
          ],
        },
        {
          heading: 'What the JSON Lines rules say (checked 24 November 2026)',
          paragraphs: ['jsonlines.org sets three rules and two conventions. The NDJSON specification describes the same layout under another name.'],
          list: [
            'The text is UTF-8, without a byte order mark.',
            'Each line is one valid JSON value. null is a valid line; a blank line is not.',
            'Lines end with a newline (\\n). Windows line endings (\\r\\n) also work, because spaces around a JSON value are ignored.',
            'A newline after the last line is strongly recommended but not required.',
            'Files may use the .jsonl extension, and the media type may be application/jsonl, which is not yet standardized.',
            'The NDJSON specification asks for the .ndjson extension and the media type application/x-ndjson.',
          ],
          links: [{ text: 'jsonlines.org', path: 'https://jsonlines.org/' }, { text: 'NDJSON specification', path: 'https://github.com/ndjson/ndjson-spec' }],
        },
        {
          heading: 'When each one is used',
          paragraphs: [
            'In JSON Lines there are no brackets around the file and no commas between records, and each line is complete on its own. A program can add a record by writing one more line at the end, without reading the file first, and the file can be split at any line break with every part still valid.',
            'So a rough rule: JSON when the data is read as one piece, JSON Lines when it is a stream of separate records.',
          ],
          list: [
            'JSON: API responses, configuration files and small exports that a program loads in one go.',
            'JSON Lines for logs: jsonlines.org calls it a great format for log files, because each event is one line that can be appended.',
            'JSON Lines between programs and in shell pipelines, where tools read and write one line at a time.',
            'JSON Lines for AI batch and training files. OpenAI\'s Batch API guide says batches start with a .jsonl file in which each line holds one request, and its fine-tuning guide asks for training data in JSONL format, one complete JSON structure per line (both checked 24 November 2026).',
          ],
          links: [{ text: 'Batch API guide', path: 'https://developers.openai.com/api/docs/guides/batch' }, { text: 'fine-tuning guide', path: 'https://developers.openai.com/api/docs/guides/supervised-fine-tuning' }],
        },
        {
          heading: 'How to open a .jsonl or .ndjson file',
          paragraphs: ['Drop the file on the JSON viewer, or choose it. It is read on your device; nothing is sent to a server.'],
          list: [
            'Each line becomes one item of a list, and a note says "Opened from JSON Lines: each line is an item of the list. Download saves JSON Lines again."',
            'The tree, table and text views work as they do for any JSON file. A file of records with the same fields reads best in the table.',
            'Blank lines are skipped rather than refused, so a file with an empty line at the end still opens.',
            'If one line is not valid JSON, the viewer stops and gives the number of that line, so you know where to look.',
            'Download saves the file as JSON Lines again, one item per line, with your edits.',
            'Files up to 10 MB open. The extension decides how the file is read: a JSON Lines file saved with a .json name is read as ordinary JSON and fails, so rename it to .jsonl first.',
          ],
        },
        {
          heading: 'How to convert between them',
          paragraphs: ['Once the .jsonl file is open in the JSON viewer:'],
          list: [
            'To JSON: open the Copy menu and choose Copy formatted. You get the records as one JSON list, inside square brackets, ready to paste or save.',
            'To a spreadsheet: open the Convert menu and choose Convert to CSV or Convert to Excel (.xlsx). Each record becomes a row and each field a column.',
            'From a JSON list to JSON Lines: OpenAnyDoc has no button for this direction yet. A command-line tool such as jq writes one item per line with jq -c ".[]".',
          ],
        },
        {
          heading: 'Why does my .jsonl file give an "Unexpected non-whitespace character" error?',
          paragraphs: ['That error means a program read the file as one JSON document and found a second value after the first line. The file is probably fine as JSON Lines. Open it with a tool that reads JSON Lines, or check that it is saved with a .jsonl or .ndjson name. The guide to unexpected token errors explains the other messages.'],
          links: [{ text: 'guide to unexpected token errors', path: '/json-unexpected-token' }],
        },
        {
          heading: 'Is NDJSON the same as JSON Lines?',
          paragraphs: ['For everyday use, yes: both put one JSON value on each line and end lines with a newline. They come from two separate write-ups, so the names differ, and so do the suggested extension and media type: .jsonl for JSON Lines, .ndjson and application/x-ndjson for NDJSON. OpenAnyDoc\'s JSON viewer opens both extensions the same way.'],
        },
        {
          heading: 'Can I open a JSON Lines file in Excel?',
          paragraphs: ['Not directly as a table, because Excel has no reader for one-object-per-line files. Open the .jsonl file in OpenAnyDoc\'s JSON viewer, choose Convert to Excel (.xlsx) from the Convert menu, and download the workbook. Nested fields become their own columns. How to open a JSON file covers the other ways to read JSON.'],
          links: [{ text: 'How to open a JSON file', path: '/open-json-file' }],
        },
        {
          heading: 'Is my file uploaded when I open it here?',
          paragraphs: ['No. The JSON viewer reads JSON and JSON Lines files with your own browser, on your device, and keeps them in the page\'s memory until you close the tab. Nothing is sent to a server, which matters for logs and AI batch files that often hold user data. You can check this yourself in the browser\'s network panel.'],
          links: [{ text: 'check this yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the file and what you see when you open it (no personal data).`],
        },
      ],
    },
    '/compare-two-json-files': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Compare the data, not the text: a JSON-aware comparison matches objects key by key and lists position by position, so new indentation or a different key order does not count as a change. OpenAnyDoc\'s Compare JSON does this in your browser without uploading either file, and lists every added, removed and changed value with its path, such as $.settings.language.'],
          links: [{ text: 'Compare JSON', path: '/json-compare' }],
        },
        {
          heading: 'Why a line-by-line diff misleads',
          paragraphs: [
            'A text diff compares lines. If one file was saved on a single line and the other was formatted with 2 spaces, every line differs. If a program wrote the same keys in another order, the diff shows lines removed in one place and added in another, although the data is the same.',
            'A JSON comparison reads both files first and compares what they hold. Whitespace never counts, and key order counts only if you ask for it.',
          ],
        },
        {
          heading: 'A worked example',
          paragraphs: ['Two versions of a synthetic account record. In the second, the plan was upgraded, a feature was added, the language changed, a coupon was used up, a trial date appeared, and the keys came out in another order:'],
          list: [
            'Before: {"id":"A-1042","plan":"basic","seats":5,"features":["export","search"],"settings":{"theme":"light","language":"en"},"coupon":"WELCOME"}',
            'After: {"plan":"pro","id":"A-1042","seats":5,"features":["export","search","share"],"settings":{"language":"ar","theme":"light"},"trialEnds":"2026-12-31"}',
          ],
        },
        {
          heading: 'What the comparison shows',
          paragraphs: ['With Ignore key order on, as it is by default, the summary reads "2 added, 1 removed, 2 changed." and the list underneath names each difference:'],
          list: [
            'Changed: $.plan ("basic" became "pro").',
            'Added: $.features[2] ("share").',
            'Changed: $.settings.language ("en" became "ar").',
            'Removed: $.coupon.',
            'Added: $.trialEnds.',
            'Turn Ignore key order off and the same five stay, followed by "2 objects have their keys in another order.": the whole record ($) and $.settings, each listed as Key order.',
            'id, seats and settings.theme are not listed, because they did not change.',
          ],
        },
        {
          heading: 'How to compare two JSON files, step by step',
          paragraphs: ['Both files are read on your device:'],
          list: [
            'Open Compare JSON and choose the first file, drop it on the page or paste the text. It opens on the Compare tab.',
            'Paste the second document into the box, drop its file on the box, or press Choose a file.',
            'Read the summary line, then the list of differences. Click one and both sides scroll to it.',
            'The open document is on the left and the second document on the right, both indented with 2 spaces. With Ignore key order on, keys are shown in alphabetical order on both sides, so equal objects line up.',
            'The changed lines are marked on each side, so you can read the values around a change.',
          ],
        },
        {
          heading: 'Lists, limits and invalid files',
          paragraphs: [
            'Objects are matched by key, but lists are matched by position: item 0 with item 0, item 1 with item 1. If "share" is put at the start of ["export","search"], the result is not one insertion but three lines: $.features[0] changed, $.features[1] changed and $.features[2] added, because every item moved one place.',
            'When you see a run of changes at the end of a list, check whether one item was inserted or deleted near its start. The list shows the first 300 differences, and each side shows up to 20,000 lines. The first file can be up to 10 MB.',
            'The second document is checked as you paste it: if it is not valid JSON, the parser\'s message appears under the box instead of a comparison. Fix it in the JSON validator, which shows the line and column and repairs common mistakes such as trailing commas. The guide to unexpected token errors explains each message.',
          ],
          links: [{ text: 'JSON validator', path: '/json-validator' }, { text: 'guide to unexpected token errors', path: '/json-unexpected-token' }],
        },
        {
          heading: 'Does key order matter when comparing JSON?',
          paragraphs: ['Usually not: in JSON, {"a":1,"b":2} and {"b":2,"a":1} hold the same data, so Compare JSON treats them as equal by default. Order can matter when a person reads the file, or when a test compares raw text. Turn Ignore key order off and every object whose keys moved is reported as Key order.'],
        },
        {
          heading: 'How do I compare an API response with a saved copy?',
          paragraphs: ['Open the saved .json file in Compare JSON first, so it sits on the left. Then copy the new response from your API client or the browser\'s network panel and paste it into the box on the Compare tab. Every field that was added, removed or changed since the saved copy is listed with its path.'],
        },
        {
          heading: 'Can I compare two JSON Lines files?',
          paragraphs: ['Yes, with one extra step, because the box reads one JSON document. Open the first .jsonl file in the JSON viewer, which reads each line as an item of a list, then switch to Compare. Open the second file in another tab, choose Copy formatted from the Copy menu and paste it. JSON vs JSON Lines explains the format.'],
          links: [{ text: 'JSON viewer', path: '/json-viewer' }, { text: 'JSON vs JSON Lines', path: '/json-vs-json-lines' }],
        },
        {
          heading: 'Are my files uploaded when I compare them?',
          paragraphs: ['No. Both documents are read and compared by your own browser, and nothing is saved or shared, so there is no link to send either. That matters when the files hold API keys or customer records. Our comparison of jsonformatter.org and Code Beautify shows how other JSON sites describe what they send to their servers.'],
          links: [{ text: 'comparison of jsonformatter.org and Code Beautify', path: '/jsonformatter-alternative' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the two files and the difference you expected to see (no personal data).`],
        },
      ],
    },
    '/excel-row-and-column-limits': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['An Excel worksheet holds at most 1,048,576 rows and 16,384 columns, and one cell holds at most 32,767 characters. Numbers keep only 15 digits, and Excel calculates only with dates from 1 January 1900 to 31 December 9999. When your data goes past these limits, OpenAnyDoc\'s large CSV viewer opens it in your browser with no row limit of its own, and Split CSV cuts it into parts Excel can open, without uploading the file.'],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }, { text: 'Split CSV', path: '/split-csv' }],
        },
        {
          heading: 'The limits, from Microsoft\'s own list',
          paragraphs: ['These figures come from Microsoft\'s Excel specifications and limits page (checked 24 November 2026), which applies to Excel for Microsoft 365 and Excel 2016, 2019, 2021 and 2024:'],
          list: [
            'Rows on a worksheet: 1,048,576.',
            'Columns on a worksheet: 16,384, so the last column is XFD.',
            'Characters in one cell: 32,767.',
            'Line breaks in one cell: 253.',
            'Characters in a header or footer: 255.',
            'Characters in a formula: 8,192; arguments in one function: 255; functions nested inside each other: 64.',
            'Number precision: 15 digits.',
            'Dates Excel can calculate with: 1 January 1900 to 31 December 9999.',
            'Items shown in a filter drop-down list: 10,000.',
            'Hyperlinks on a worksheet: 65,530.',
            'Different cell formats and cell styles in a workbook: 65,490.',
            'Undo levels: 100.',
            'Sheets in a workbook: limited only by available memory.',
          ],
          links: [{ text: 'Excel specifications and limits page', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }],
        },
        {
          heading: 'What each limit means for a real file',
          paragraphs: ['Most people only meet the row limit, which the guide on a CSV too big for Excel covers in detail. The other limits catch people out more quietly. The figures are from the Excel specifications and limits page and Microsoft\'s page on keeping leading zeros and large numbers (checked 24 November 2026):'],
          list: [
            'Columns: wide exports reach 16,384 long before they get near a million rows. A survey with one column per question and answer option, or sensor data with one column per reading, can be a few thousand rows long and still be too wide.',
            '15 digits: Excel keeps 15 significant digits of a number, so a 16-digit reference typed or opened as a number, such as 1234567890123456, is stored as 1234567890123450. Order numbers, barcodes and other long codes are safe only as text.',
            '32,767 characters: long free-text fields, such as comments, descriptions or JSON pasted into a column, can be longer than one cell holds.',
            '253 line breaks: an address or a note with many lines counts against this limit too, separately from the character limit.',
            'Dates before 1900: they are earlier than the first date Excel calculates with, so Excel cannot calculate with records from the 1800s as dates.',
            '10,000 filter items: a column with more different values than that does not show all of them in its filter list, so use a text filter such as Contains instead of ticking values.',
          ],
          links: [{ text: 'CSV too big for Excel', path: '/csv-too-big-for-excel' }, { text: 'Excel specifications and limits page', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }, { text: 'keeping leading zeros and large numbers', path: 'https://support.microsoft.com/en-us/office/keeping-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7' }],
        },
        {
          heading: 'Worked example: will this export fit?',
          paragraphs: ['Do the sums before you open the file. Two synthetic exports, and how to count your own:'],
          list: [
            'A sales export of 2,400,000 rows and 12 columns: the columns are fine, the rows are not. Cut into parts of 1,000,000 rows, it becomes three files of 1,000,000, 1,000,000 and 400,000 rows, each with the header row on top, and every part stays below 1,048,576.',
            'A sensor log of 5,000 rows that stores each second of a five-hour test in its own column: 18,000 columns, more than 16,384, although the row count is small. Hide the columns you do not need before you save it for Excel.',
            'To read the real size of a file before Excel sees it, drop it on the CSV viewer and choose Issues in the More menu: the File report gives rows × columns, the delimiter and the encoding. A line count from a text editor can be too high, because a quoted cell with a line break inside takes two lines but is one row.',
          ],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'When your data is over a limit',
          paragraphs: ['All of these run in your browser; the file is not uploaded:'],
          list: [
            'Too many rows to look through: open the file in the large CSV viewer. It has no row limit of its own, so the limit is your device\'s memory, and a file over 50 MB shows a warning first. Filter to the rows you need, then choose Download options in the More menu and tick only the shown rows.',
            'Too many rows for someone who uses Excel: Split CSV cuts the file by a number of rows or by a size in MB per file. Every part keeps the header row, and the parts download together as one ZIP.',
            'Too many columns: hide the columns you do not need in the CSV viewer, then choose Download options and tick only the shown rows. Hidden columns are left out of that copy.',
            'Long codes that must keep every digit: CSV to Excel turns only plain numbers into numbers. Values such as 007, phone numbers and whole numbers longer than 15 digits stay text, so no digit is lost.',
            'A workbook too big to work with: Split Excel cuts it into smaller .xlsx files by sheet, every N rows, or by the values of a column.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }, { text: 'Split CSV', path: '/split-csv' }, { text: 'CSV viewer', path: '/csv-viewer' }, { text: 'CSV to Excel', path: '/csv-to-excel' }, { text: 'Split Excel', path: '/split-excel' }],
        },
        {
          heading: 'Where Excel does more',
          paragraphs: [
            'Excel has its own way past the worksheet limit. Power Query and the Data Model load more than 1,048,576 rows without putting them in cells, and a PivotTable can then summarise all of them, as Microsoft\'s page on a data set too large for the Excel grid explains (checked 24 November 2026). On a 64-bit system Excel specifications and limits lists no hard limit on Data Model file size, only available memory and system resources.',
            'OpenAnyDoc\'s viewers show and edit the rows as a table, with filters, sorting and group by, but they have no PivotTables, and like Excel they are limited by your device\'s memory. If the data has outgrown a spreadsheet altogether, CSV vs Excel vs JSON explains when another format suits it better.',
          ],
          links: [{ text: 'data set too large for the Excel grid', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'Excel specifications and limits', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }, { text: 'CSV vs Excel vs JSON', path: '/csv-vs-excel-vs-json' }],
        },
        {
          heading: 'How many rows and columns can Excel have?',
          paragraphs: ['An Excel worksheet can have 1,048,576 rows and 16,384 columns, according to Microsoft\'s limits for Excel for Microsoft 365 and Excel 2016 to 2024. The older .xls format, used by Excel 97 to 2003, stops at 65,536 rows and 256 columns, according to Microsoft\'s pages on a data set too large for the Excel grid and on using Excel with earlier versions (checked 24 November 2026). A workbook can hold as many sheets as memory allows.'],
          links: [{ text: 'data set too large for the Excel grid', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'using Excel with earlier versions', path: 'https://support.microsoft.com/office/use-excel-with-earlier-versions-of-excel-2fd9ffcb-6fce-485b-85af-fecfd651a5ac' }],
        },
        {
          heading: 'Why did Excel change the last digits of my long number?',
          paragraphs: ['Excel keeps only 15 significant digits of any number, so longer numbers are rounded and the extra digits become zeros. It happens to long order numbers, reference codes and IDs. Format the column as Text before you enter the numbers, or bring the file in through Data, From Text/CSV and set that column\'s type to Text, as Microsoft\'s page on keeping leading zeros and large numbers explains (checked 24 November 2026).'],
          links: [{ text: 'keeping leading zeros and large numbers', path: 'https://support.microsoft.com/en-us/office/keeping-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7' }],
        },
        {
          heading: 'Is there a limit on the number of sheets or the length of a sheet name?',
          paragraphs: ['Microsoft lists no fixed number of sheets: a workbook can hold as many as your computer\'s memory allows. A sheet name can be at most 31 characters long, as Microsoft\'s page Rename a worksheet says (checked 24 November 2026). If a workbook has grown too big for the person who will receive it, Split Excel saves each sheet as its own file, in your browser.'],
          links: [{ text: 'Rename a worksheet', path: 'https://support.microsoft.com/en-us/office/rename-a-worksheet-3f1f7148-ee83-404d-8ef0-9ff99fbad1f9' }, { text: 'Split Excel', path: '/split-excel' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with the row and column count of your file and what you need from it (no personal data).`],
        },
      ],
    },
    '/find-hidden-sheets-in-excel': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A workbook can hide whole sheets, single rows and columns, and the formulas behind its numbers, and a sheet set to very hidden does not even appear in Excel\'s Unhide list. OpenAnyDoc\'s Excel viewer shows all of it at once: it lists hidden and very hidden sheets next to the sheet tabs, counts hidden rows and columns, and lists every formula, in your browser without uploading the file.'],
          links: [{ text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'Four places a workbook hides things',
          paragraphs: ['Check all four before you trust a workbook or share it:'],
          list: [
            'Hidden sheets: hidden with Hide on the sheet tab, and shown again with Unhide.',
            'Very hidden sheets: set in the VBA editor or by a macro. Microsoft\'s reference for sheet visibility (checked 24 November 2026) says the user cannot make such a sheet visible from the menus; only changing its Visible property does it.',
            'Hidden rows and columns: they keep their data but take no space on screen.',
            'Formulas: a cell shows a number, and the formula behind it can read from a hidden sheet, another workbook or a defined name.',
          ],
          links: [{ text: 'reference for sheet visibility', path: 'https://learn.microsoft.com/en-us/office/vba/api/excel.xlsheetvisibility' }],
        },
        {
          heading: 'Find hidden sheets, rows and columns in your browser',
          paragraphs: ['Open the workbook in the Excel viewer (.xlsx, .xlsm or .xls). The file is read on your device and nothing is uploaded:'],
          list: [
            'If the workbook hides sheets, a message says so when it opens, and a button such as "2 hidden" appears next to the sheet tabs.',
            'Click that button to list every hidden sheet, each tagged hidden or very hidden. Click one and it gets a tab, so you can read it like any other sheet.',
            'If the sheet on screen hides rows or columns, the status bar at the bottom shows how many, for example "Hidden rows: 3, columns: 1 · Show". Click Show, or tick Show hidden rows and columns in the View menu.',
            'For an overview, choose Workbook info in the View menu: the number of sheets, how many are hidden and very hidden, counts of formulas, notes and links, defined names, links to other workbooks, and whether the file contains macros. Macros are never run.',
          ],
          links: [{ text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'See every formula',
          paragraphs: ['The View menu has three ways to read what is behind the numbers:'],
          list: [
            'Show formulas (Ctrl+` on Windows, ⌘` on a Mac) puts each formula in its cell instead of its result.',
            'Formula list shows every formula in the workbook with its sheet, cell address and current value, and marks the ones on a hidden sheet. Type in the filter box, such as SUM or VLOOKUP, or tick This sheet only. Click a formula to go to its cell. The first 2,000 are listed.',
            'Search all sheets (Ctrl+Shift+F) searches every sheet, hidden ones included. Tick Look in formulas to search the formulas instead of the values.',
          ],
        },
        {
          heading: 'Worked example: a total that reads from hidden sheets',
          paragraphs: [
            'A synthetic budget workbook has three sheets: Summary, which is visible, Rates, which is hidden, and Lookup, which is very hidden. Summary shows a total of 18,750 in cell B4, and nothing else looks unusual.',
            'In the viewer, the message on opening says the workbook has 2 hidden sheets. Formula list shows Summary!B4 with =Rates!B2*Lookup!C7 and its value, 18,750. Opening the two hidden sheets shows that Rates!B2 is 1.25 and Lookup!C7 is 15,000. In Excel, Unhide would have offered only Rates: Lookup is very hidden and does not appear there.',
          ],
        },
        {
          heading: 'The Excel way',
          paragraphs: [
            'Excel does some things a viewer cannot: it unhides a sheet for good when you save, and it lets you edit the macros in the file. If you do not have Excel at hand, opening an XLSX file without Excel compares the free options.',
            'The steps in Excel (Microsoft\'s pages, checked 24 November 2026):',
          ],
          list: [
            'Hidden sheets: right-click any visible sheet tab, choose Unhide, select the sheets and click OK. The steps are in Hide or Unhide worksheets.',
            'Very hidden sheets: they are not in the Unhide list. Open the VBA editor (Alt+F11 on Windows, as Keyboard shortcuts in Excel lists) and set the sheet\'s Visible property to -1 - xlSheetVisible, the value given in Microsoft\'s reference for sheet visibility.',
            'Rows and columns: select the rows or columns on both sides, right-click and choose Unhide, or double-click the double line where they are hidden. The steps are in Hide or show rows or columns.',
            'Formulas: Show Formulas on the Formulas tab switches the sheet between formulas and results. The steps are in Display or hide formulas.',
          ],
          links: [
            { text: 'opening an XLSX file without Excel', path: '/open-xlsx-without-excel' },
            { text: 'Hide or Unhide worksheets', path: 'https://support.microsoft.com/en-us/office/hide-or-show-worksheets-or-workbooks-69f2701a-21f5-4186-87d7-341a8cf53344' },
            { text: 'Hide or show rows or columns', path: 'https://support.microsoft.com/en-us/office/hide-or-show-rows-or-columns-659c2cad-802e-44ee-a614-dde8443579f8' },
            { text: 'Keyboard shortcuts in Excel', path: 'https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f' },
            { text: 'reference for sheet visibility', path: 'https://learn.microsoft.com/en-us/office/vba/api/excel.xlsheetvisibility' },
            { text: 'Display or hide formulas', path: 'https://support.microsoft.com/en-us/office/display-or-hide-formulas-f7f5ab4e-bf24-4efc-8fc9-0c1b77a5356f' },
          ],
        },
        {
          heading: 'Showing a sheet is not unhiding it',
          paragraphs: [
            'Opening a hidden sheet in the viewer does not change the file. When you download the workbook from the viewer, hidden and very hidden sheets stay as they were, and hidden rows and columns stay hidden, so what you send looks the same as before.',
            'Hidden is not removed: anyone with the file can find these sheets the same way. Before you share a workbook, delete what the other person should not see, and read anonymizing data before sharing. Note that Every sheet as CSV, under Split, merge and export sheets in the Sheets menu, writes the hidden sheets too.',
            'Limits: hidden rows and columns are read from .xlsx and .xlsm files only, and the hidden sheets of an .ods file open as ordinary tabs. A workbook that needs a password to open cannot be read. Unprotect Excel removes sheet and workbook structure protection from a file you own, not a password to open it.',
          ],
          links: [{ text: 'anonymizing data before sharing', path: '/anonymize-data-before-sharing' }, { text: 'Unprotect Excel', path: '/unprotect-excel' }],
        },
        {
          heading: 'Why is Unhide greyed out in Excel?',
          paragraphs: ['Two things leave Excel\'s Unhide with nothing to offer. Sheets hidden as very hidden are not listed by the Unhide command, according to Hide or Unhide worksheets, and when the workbook structure is protected, Unhide is unavailable, according to Protect a workbook (Microsoft\'s pages, checked 24 November 2026). Opening the file in a viewer that reads the file itself shows both kinds of hidden sheet.'],
          links: [{ text: 'Hide or Unhide worksheets', path: 'https://support.microsoft.com/en-us/office/hide-or-show-worksheets-or-workbooks-69f2701a-21f5-4186-87d7-341a8cf53344' }, { text: 'Protect a workbook', path: 'https://support.microsoft.com/en-us/office/protect-a-workbook-7e365a4d-3e89-4616-84ca-1931257c1517' }],
        },
        {
          heading: 'What is a very hidden sheet in Excel?',
          paragraphs: ['A very hidden sheet is a sheet whose visibility is set to xlSheetVeryHidden, usually by a macro or in the VBA editor. Excel leaves it out of the Unhide list, so most people never know it is there. It still holds data and formulas, and other sheets can read from it.'],
        },
        {
          heading: 'Can a hidden sheet contain personal data?',
          paragraphs: ['Yes, a hidden sheet travels inside the file with everything on it, so names, phone numbers or salaries on a hidden sheet go wherever the workbook goes. Check the hidden and very hidden sheets before you send a workbook, and delete the ones the recipient should not have instead of hiding them again.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what the workbook hides and what you see (no personal data).`],
        },
      ],
    },
    '/excel-to-csv-without-breaking-arabic': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['To convert Excel to CSV and keep Arabic readable, save it as UTF-8 with a byte order mark (BOM): UTF-8 holds every Arabic letter, and the three-byte mark at the start of the file tells Excel how to read them. OpenAnyDoc\'s Excel to CSV does both in your browser: it writes UTF-8 and adds the mark whenever the sheet holds any character outside plain English text, such as Arabic letters, and the workbook is never uploaded.'],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }],
        },
        {
          heading: 'Two ways Arabic gets lost while saving',
          paragraphs: ['Saving to CSV can break Arabic at two points, and they look different. This guide is about writing the file correctly; if you already have a CSV that opens with broken Arabic, fixing a CSV that already shows broken Arabic covers the repair.'],
          list: [
            'The letters are replaced. If the CSV is written in an encoding that has no Arabic letters, they cannot be stored, and each one is usually written as a question mark. Nothing brings them back from that file; only saving from the workbook again helps.',
            'The letters are stored but read wrongly. A UTF-8 file without the mark keeps every letter, yet Excel can show it garbled when you double-click it: "الرياض" turns into "Ø§Ù„Ø±ÙŠØ§Ø¶". Microsoft\'s note on opening CSV UTF-8 files (checked 24 November 2026) says such a file opens normally if it was saved with a BOM.',
          ],
          links: [
            { text: 'fixing a CSV that already shows broken Arabic', path: '/fix-arabic-csv-in-excel' },
            { text: 'note on opening CSV UTF-8 files', path: 'https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032' },
          ],
        },
        {
          heading: 'What the bytes look like',
          paragraphs: ['A CSV is only bytes, so you can see the difference for yourself. Take the word الرياض, 6 letters:'],
          list: [
            'In UTF-8 it is 12 bytes, two per letter: D8 A7 D9 84 D8 B1 D9 8A D8 A7 D8 B6.',
            'In Windows-1256, the older Arabic Windows encoding, it is 6 bytes, one per letter.',
            'Read as Windows-1252, the Western encoding, those 12 UTF-8 bytes become Ø§Ù„Ø±ÙŠØ§Ø¶.',
            'The byte order mark is the three bytes EF BB BF at the very start of the file. Open the CSV in the CSV viewer and choose Issues in the More menu: the File report says the encoding and whether the file has a byte order mark. Or run node -e "console.log(require(\'fs\').readFileSync(\'file.csv\').subarray(0, 3))" and look for <Buffer ef bb bf>.',
          ],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'Convert in your browser, step by step',
          paragraphs: ['Excel to CSV reads the workbook on your device:'],
          list: [
            'Drop an .xlsx, .xls, .xlsm or .ods file on Excel to CSV. The first sheet is converted at once. For another sheet, open the workbook in the Excel viewer, click the sheet\'s tab, then Convert and Convert to CSV.',
            'The CSV opens in the CSV viewer: commas between the columns, Windows line endings (CRLF), UTF-8, and the byte order mark if any cell holds a character outside plain English text, such as an Arabic letter. A sheet with only English letters and digits gets no mark, because it does not need one.',
            'Check it: choose Issues in the More menu. The File report shows the encoding, the byte order mark (yes or no) and the line endings.',
            'Click Download, and the copy keeps the mark. Download options in the More menu let you pick a semicolon, tab or pipe, LF or CRLF line endings, and untick Add a byte order mark (helps Excel read Arabic) for a system that wants plain UTF-8.',
            'For every sheet at once, open the workbook in the Excel viewer, choose Split, merge and export sheets in the Sheets menu, then Download CSV files (ZIP). Each sheet, hidden ones included, becomes its own UTF-8 CSV with the mark.',
          ],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }, { text: 'Excel viewer', path: '/excel-viewer' }],
        },
        {
          heading: 'What ends up in the CSV',
          paragraphs: ['A CSV holds text only, so the converter writes each cell as the sheet shows it:'],
          list: [
            'Dates, percentages and currencies keep their shown format: 25% stays 25%, not 0.25.',
            'Formulas are written as the result saved in the workbook.',
            'Empty rows are left out.',
            'Long numbers in the General format are written in full: 123456789012 stays 123456789012, not the 1.23457E+11 a narrow column shows, up to the 15 significant digits Excel stores.',
            'Right-to-left sheet direction, fonts and colours are not kept, because a CSV stores no layout; the Arabic text itself is kept exactly.',
          ],
        },
        {
          heading: 'Doing it in Excel',
          paragraphs: [
            'In Excel, choose File, Save As, and pick a CSV type as the file type. Excel saves only the active sheet to a CSV, so repeat it for each sheet, as Microsoft\'s page on importing and exporting text files explains (checked 24 November 2026).',
            'Where Excel does more: it writes the CSV straight from the workbook you are already editing, in one step. Where it trips people up: the list of types also has CSV (Comma delimited), CSV (Macintosh) and CSV (MS-DOS), which Microsoft\'s list of text formats (checked 24 November 2026) describes as files for Windows, the Macintosh and MS-DOS, without a word about UTF-8.',
          ],
          links: [{ text: 'page on importing and exporting text files', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }, { text: 'list of text formats', path: 'https://support.microsoft.com/en-us/office/save-a-workbook-to-text-format-txt-or-csv-3e9a9d6c-70da-4255-aa28-fcacf1f081e6' }],
        },
        {
          heading: 'When the receiving system wants something else',
          paragraphs: ['Excel needs the mark, but a CSV is not always for Excel:'],
          list: [
            'A database import, a script or an accounting system may expect UTF-8 without the mark, and some read it as part of the first column name. Untick the byte order mark in Download options before you save.',
            'An older Arabic system may need Windows-1256. Change CSV encoding saves a CSV as UTF-8 with BOM, UTF-8, UTF-16 LE or Windows-1256, shows a preview first, and warns you when a character cannot be written in the encoding you chose.',
            'A system in a country that writes decimals with a comma may expect semicolons: pick the semicolon in Download options.',
          ],
          links: [{ text: 'Change CSV encoding', path: '/change-csv-encoding' }],
        },
        {
          heading: 'Why does my CSV show question marks instead of Arabic?',
          paragraphs: ['Question marks usually mean the Arabic letters were replaced when the file was saved, because the encoding used had no Arabic letters. If another program shows the same question marks, the letters are gone from that file. Convert the original workbook again as UTF-8 with a byte order mark, with Excel to CSV or with Excel\'s CSV UTF-8 type.'],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }],
        },
        {
          heading: 'Does a byte order mark cause problems outside Excel?',
          paragraphs: ['A byte order mark rarely causes problems: most programs that read UTF-8 recognise it and skip it. A few scripts and import tools do not, and show stray characters before the first column name. If the CSV is for such a system rather than for Excel, untick the byte order mark in Download options before you save.'],
        },
        {
          heading: 'Can one CSV file hold every sheet of my workbook?',
          paragraphs: ['No, a CSV file holds one table, so each sheet becomes its own file. Excel to CSV converts the first sheet or the one you pick in the Excel viewer; Split, merge and export sheets in the viewer\'s Sheets menu downloads them all as CSVs in one ZIP. CSV vs Excel vs JSON covers whether CSV is the right format.'],
          links: [{ text: 'Excel to CSV', path: '/excel-to-csv' }, { text: 'CSV vs Excel vs JSON', path: '/csv-vs-excel-vs-json' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you see in the CSV (no personal data). The first line is usually enough.`],
        },
      ],
    },
    '/read-speaker-notes-without-powerpoint': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['Open the .pptx file in a viewer that reads the notes as well as the slides, and each slide\'s speaker notes appear under it. OpenAnyDoc\'s PowerPoint viewer does this in your browser without uploading the file, and it can also search the notes, read them aloud, show them in a presenter view and export them as text.'],
          links: [{ text: 'PowerPoint viewer', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'How to read the notes in your browser',
          paragraphs: [
            'A .pptx file is a ZIP package of separate parts, and the speaker notes are not stored with the slides: each slide that has notes points to its own notes page, which PowerPoint keeps in the ppt/notesSlides folder. A program that only draws the slides never opens those parts. To see them, rename a copy of a deck from .pptx to .zip and open it; each notesSlide file holds the notes of one slide.',
            'The PowerPoint viewer reads both the slides and the notes pages, on your device:',
          ],
          list: [
            'Open the PowerPoint viewer and choose a .pptx, .ppsx, .potx or .pptm file, or drop it on the page.',
            'If the presentation has notes, the Speaker notes pane opens under the slide by itself. A slide without notes says "No notes for this slide.", and a deck with none at all says "This presentation has no speaker notes."',
            'Move with the thumbnails, the previous and next buttons or the arrow keys; the notes pane always shows the notes of the slide on screen.',
            'The Speaker notes button in the toolbar, or View, then Speaker notes, hides or shows the pane.',
          ],
        },
        {
          heading: 'Search the notes, hear them, present with them',
          paragraphs: ['Three more tools in the viewer use the notes. If you only need to find a word, Search PowerPoint lists every match in the slides and notes with its slide number, without drawing the slides:'],
          list: [
            'Search slides and notes (in the View menu) lists every match with its slide number and whether it is on the slide or in the notes. Click a match in the notes and the viewer opens that slide and highlights the words in the notes pane. Tick Match case to tell "Sales" from "sales".',
            'Read aloud: choose The speaker notes, then This slide only or From this slide to the end. Only the voices installed on your device are used, with an English voice and an Arabic voice and a speed setting.',
            'Present opens the presenter view: the current slide, the next slide, your notes with Smaller notes and Larger notes buttons, a timer you can pause and reset, and the time now. Open audience window shows the slide alone in a second window; if the browser blocks it, Present in this tab shows the slides full screen instead.',
          ],
          links: [{ text: 'Search PowerPoint', path: '/search-pptx' }],
        },
        {
          heading: 'Get the notes out as text',
          paragraphs: ['File, then Export outline, saves every slide\'s title, text and speaker notes in slide order, as Plain text (.txt) or Markdown (.md). Here is the plain text outline of a three-slide test deck, q3-review.pptx, with notes on the first two slides (in the file, the lines under each slide are indented):'],
          list: [
            'q3-review',
            'Slide 1: Quarterly review',
            'Sales team, Q3',
            'Speaker notes:',
            'Thank everyone for coming.',
            'Keep this under one minute.',
            'Slide 2: Results',
            'Orders up 12%',
            'Returns down',
            'Speaker notes:',
            'Pause here for questions.',
            'Slide 3: Next steps',
            'Hire two people',
          ],
        },
        {
          heading: 'Printing the notes, or giving them to an AI chat',
          paragraphs: ['Print / Save as PDF in the viewer prints the slides one per page, without the notes, and PowerPoint to PDF leaves the notes out too. For notes on paper, print the exported .txt file from any text editor. To hand the notes to ChatGPT, Claude or Gemini, PowerPoint to Markdown makes the same kind of outline with a token count; see giving a PowerPoint deck to an AI chat.'],
          links: [{ text: 'PowerPoint to PDF', path: '/pptx-to-pdf' }, { text: 'PowerPoint to Markdown', path: '/pptx-to-markdown' }, { text: 'giving a PowerPoint deck to an AI chat', path: '/powerpoint-to-ai-chat' }],
        },
        {
          heading: 'Other ways to read speaker notes',
          paragraphs: ['Each of these comes from the maker\'s own help pages (checked 24 November 2026). For a wider comparison of the apps, see how to open a PPTX file without PowerPoint.'],
          list: [
            'PowerPoint: the notes pane sits under each slide, and there is also a Notes Page view, on the View tab. Under File, then Print, the Notes Pages layout prints one slide and its notes per page, and File, then Export, then Create Handouts sends the notes to Word, next to or below the slides.',
            'PowerPoint for the web: you can write notes, but Microsoft says it cannot show them to you while you present; that needs the desktop app.',
            'Google Slides: Presenter view, then Speaker notes, shows them while you present, and File, then Print settings and preview, then 1 slide with notes prints each slide with its notes.',
            'Keynote on a Mac: it opens .pptx files, View, then Show Presenter Notes, shows the notes under the slide, and Apple says the notes can be printed along with the slides.',
          ],
          links: [
            { text: 'how to open a PPTX file without PowerPoint', path: '/open-pptx-without-powerpoint' },
            { text: 'Notes Page view, on the View tab', path: 'https://support.microsoft.com/en-us/office/choose-the-right-view-for-the-task-in-powerpoint-21332d8d-adbc-4717-a2c6-e25a697b40e9' },
            { text: 'the Notes Pages layout prints one slide and its notes per page', path: 'https://support.microsoft.com/en-us/powerpoint/print-speaker-notes' },
            { text: 'Microsoft says it cannot show them to you while you present', path: 'https://support.microsoft.com/en-us/office/add-speaker-notes-to-your-slides-26985155-35f5-45ba-812b-e1bd3c48928e' },
            { text: 'Presenter view, then Speaker notes', path: 'https://support.google.com/docs/answer/1696787' },
            { text: '1 slide with notes', path: 'https://support.google.com/docs/answer/143346' },
            { text: 'it opens .pptx files', path: 'https://support.apple.com/guide/keynote/open-or-close-a-presentation-tan72232b56/mac' },
            { text: 'Show Presenter Notes', path: 'https://support.apple.com/guide/keynote/add-and-view-presenter-notes-tand1a4ee7c/mac' },
          ],
        },
        {
          heading: 'Where those apps do more',
          paragraphs: ['OpenAnyDoc\'s viewer is in beta and only reads. PowerPoint and Keynote let you write and change notes; here they can only be read, searched, heard and exported. The viewer shows notes as plain text, one line per paragraph, without bold, colours or bullet marks. PowerPoint, Google Slides and Keynote also print each slide\'s picture together with its notes, which the viewer does not, and the viewer does not play animations or transitions when you present.'],
        },
        {
          heading: 'Can I edit speaker notes without PowerPoint?',
          paragraphs: ['You can edit speaker notes without the PowerPoint app in PowerPoint for the web, which Microsoft says lets you create notes (checked 24 November 2026), or in Keynote on a Mac, where you type them below the slide. OpenAnyDoc\'s PowerPoint viewer only reads notes: it shows, searches, reads aloud and exports them, and never changes your file.'],
          links: [{ text: 'which Microsoft says lets you create notes', path: 'https://support.microsoft.com/en-us/office/add-speaker-notes-to-your-slides-26985155-35f5-45ba-812b-e1bd3c48928e' }],
        },
        {
          heading: 'Why does my presentation show no speaker notes?',
          paragraphs: ['When the viewer says "This presentation has no speaker notes.", the file itself holds no notes text. That happens when the notes were never written, were deleted, or were typed into a text box on the slide instead. A picture pasted into the notes is not shown, and old .ppt files do not open here.'],
        },
        {
          heading: 'Is my presentation uploaded when I read the notes?',
          paragraphs: ['No, your presentation is not uploaded: your browser opens the .pptx file and reads its slides and notes on your own device. Search, read aloud, the presenter view and the outline export all run there, and they keep working offline once you have opened a presentation here. To check it yourself, see how to check that a website does not upload your file.'],
          links: [{ text: 'how to check that a website does not upload your file', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe the presentation and what you see in the notes pane (no personal data).`],
        },
      ],
    },
    '/compress-video-without-upload': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['To make a video small enough to email or send, lower its bitrate, and for a long video lower the picture size too, to 720p or 480p. A video\'s size is roughly its bitrate times its length, so a shorter or lower-bitrate video is a smaller file. Compress video does this in your browser: type the size you need in MB, or pick a quality, and the video never leaves your device.'],
          links: [{ text: 'Compress video', path: '/compress-video' }],
        },
        {
          heading: 'What makes a video file big',
          paragraphs: ['A video file is mostly picture data, and its size follows one simple rule: size = bitrate × length. Bitrate is how many bits each second of video uses, counted in megabits per second (Mbps) or kilobits per second (kbps). Divide by 8 to get bytes. These decide how big that gets:'],
          list: [
            'Length: twice as long at the same bitrate is twice the size. Cutting the parts nobody needs is the cheapest saving.',
            'Bitrate: the main dial. Halve it and the file is half the size; go too low and the picture turns blocky when things move fast.',
            'Resolution: more pixels need more bitrate to look sharp. 1280 × 720 has 44% of the pixels of 1920 × 1080, so 720p looks clean at a much lower bitrate.',
            'Frame rate: at 60 frames a second the same bitrate is spread over twice as many frames as at 30, so each frame gets less. Compressing keeps the frame rate as it is.',
            'Sound: small next to the picture. Speech sounds fine at 96 kbps, which is about 0.7 MB a minute.',
          ],
        },
        {
          heading: 'A worked example: one minute of phone video',
          paragraphs: ['Take a made-up clip: 60 seconds recorded at 16 Mbps, with sound. The numbers below are arithmetic, not a measurement of any phone.', 'Photos work differently: there you shrink the pixels and lower the JPG quality. For pictures, read how to reduce a photo\'s file size.'],
          list: [
            '16,000,000 bits × 60 seconds ÷ 8 = 120,000,000 bytes, about 120 MB. The tool shows it as 114.4 MB, because it counts a megabyte as 1,048,576 bytes.',
            'To email it under a 25 MB limit, type 20 as the target size. The tool aims 3% under that, keeps 96 kbps for the sound and gives the picture the rest: about 2.6 Mbps, a sixth of the original.',
            'The same 20 MB for a 3-minute clip leaves about 0.8 Mbps for the picture. That is thin for 1080p, so also choose 720p or 480p.',
            'The floor: the tool won\'t give the picture less than 150 kbps. With the sound, that is about 1.8 MB for each minute, so a 10-minute video can\'t get under about 17.6 MB. Trim it, or share a link instead.',
          ],
          links: [{ text: 'reduce a photo\'s file size', path: '/reduce-photo-file-size' }],
        },
        {
          heading: 'Size limits of common places to send a video',
          paragraphs: ['Each service sets its own limit and can change it. These numbers come from each service\'s own help page (checked 24 November 2026). Aim a little under the limit.'],
          list: [
            'Gmail: 25 MB for personal accounts; bigger attachments are replaced by a Google Drive link (Gmail Help). Work and school accounts follow their administrator\'s limit.',
            'Outlook.com: 25 MB for attached files, or 2 GB for a file shared from OneDrive (Outlook.com sending limits).',
            'WhatsApp: a default video limit of 100 MB at 720p on a faster connection and 64 MB at 480p on a slower one; documents can be up to 2 GB (WhatsApp Help Center).',
            'Discord: free accounts have a smaller limit per file than paid ones; read the current number in Discord\'s File Attachments FAQ before you compress.',
            'Forms and portals: the page usually states its limit next to the upload button. Use that number.',
          ],
          links: [
            { text: 'Gmail Help', path: 'https://support.google.com/mail/answer/6584' },
            { text: 'Outlook.com sending limits', path: 'https://support.microsoft.com/en-us/outlook/sending-limits-in-outlook-com' },
            { text: 'WhatsApp Help Center', path: 'https://faq.whatsapp.com/453914586839706' },
            { text: 'File Attachments FAQ', path: 'https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ' },
          ],
        },
        {
          heading: 'How to compress a video in your browser',
          paragraphs: ['Open Compress video and choose or drop the video: MP4, MOV, WebM, MKV, M4V or 3GP. Only the first video you choose is compressed.'],
          list: [
            'To meet a limit: click To a file size and type the size in MB; the box starts at half the original size. The result lands near that size, usually within a few percent, so type a little under the limit, for example 20 for 25 MB. If the size is too small to stay watchable, the page says so and gives the smallest size it can make.',
            'To keep it simple: click By quality and pick Smallest file, Small file, Balanced or Best picture. Small file is chosen to start with.',
            'To save the most: under Also make it smaller, choose 1080p, 720p or 480p. Only sizes smaller than your video are offered, and the shape is kept, so a tall phone video stays tall.',
            'Before you start, the page shows the original size and the new one. With By quality, the new size is measured by compressing the first 3 seconds and scaling up, so a video that gets busier later can come out larger.',
            'Click Compress video, watch the result on the page, then download it. A long job can be cancelled.',
          ],
          links: [{ text: 'Compress video', path: '/compress-video' }],
        },
        {
          heading: 'What file you get, and which browsers work',
          paragraphs: ['The compressed video keeps its format when it is MP4, MOV, WebM or MKV; M4V and 3GP videos become MP4. It is named after the original with -compressed added, for example clip-compressed.mp4.', 'An MP4 or MOV is made with H.264 video and AAC sound when the browser can make them (otherwise with another codec the format allows), the pair that most phones, computers and chat apps play. A WebM uses VP9 and Opus when the browser can make them. Recent Chrome and Edge read and make the most formats, and Safari and Firefox work with most videos. If your browser can\'t read or make a codec, the page names it and says what to try instead.', 'Long or 4K videos take a while and need free memory, because the new file is built on your device. Afterwards, Trim video cuts a start or end you don\'t need, and Resize video makes it square or a story size.'],
          links: [{ text: 'Trim video', path: '/trim-video' }, { text: 'Resize video', path: '/resize-video' }],
        },
        {
          heading: 'Should I lower the quality or the picture size?',
          paragraphs: ['Lowering the picture size usually saves more than lowering the quality, and it looks sharp on a phone screen. With By quality, the bitrate the tool uses follows the number of pixels, so 720p carries far less data than 1080p at the same setting. Keep the full size for short clips or when people will watch on a large screen.'],
        },
        {
          heading: 'Why does it say my video can\'t get that small?',
          paragraphs: ['The tool won\'t give the picture less than 150 kilobits per second, because below that a video stops being watchable. With 96 kbps for the sound, that floor is about 1.8 MB for every minute of video. If your limit is lower than that, trim the video first, or send a link to the file instead of the file itself.'],
        },
        {
          heading: 'Is my video uploaded when I compress it?',
          paragraphs: ['No, your video is compressed by your own browser, with the video encoders built into it, and nothing is sent to a server. You can check this yourself: open your browser\'s network panel, compress a video and look for an upload; there is none. The original file on your device is never changed either.'],
          links: [{ text: 'check this yourself', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with the video's format, its length and the size you need to reach (no personal data, and please don't attach the video).`],
        },
      ],
    },
    '/file-too-large-for-chatgpt': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['If a file is too large for ChatGPT, Claude or Gemini, send less of it: keep only the pages, sheets or rows your question needs, split the rest into parts, and paste each part as compact text. First check which limit you hit, because the upload size limit and the chat\'s token limit are fixed in different ways. OpenAnyDoc\'s Token counter measures the file and its split and convert tools cut it down, all in your browser without uploading it.'],
          links: [{ text: 'Token counter', path: '/token-counter' }],
        },
        {
          heading: 'Two different limits',
          paragraphs: [
            'An AI chat can refuse a file for two separate reasons. The first is the upload limit: the size in megabytes, the number of files or the number of pages the service accepts. The second is the context window: how much text, counted in tokens, the model can read at one time. A file can pass the first and still overflow the second.',
            'This is what each service\'s own help page says (checked 24 November 2026):',
          ],
          list: [
            'ChatGPT: documents up to 512 MB per file, text and document files capped at 2 million tokens per file, and CSV files and spreadsheets about 50 MB, depending on the size of each row. Source: ChatGPT\'s help page on uploading files.',
            'Claude: in a chat, 500 MB per file, up to 20 files, and PDFs up to 1,000 pages; for a PDF of more than 100 pages it reads the text only. Additional token limits may apply based on the length of the extracted text. Source: Claude\'s help page on uploads.',
            'Gemini: up to 10 files in one prompt and 100 MB per file other than video. Its help page explains that with a context window of 1 million tokens Gemini can read up to 1,500 pages of text, and that going past the window can lead to answers that miss part of the content. Source: Gemini Apps Help.',
            'Limits change with the plan and the model, and the help pages change too; check them before you rely on a number.',
          ],
          links: [
            { text: 'ChatGPT\'s help page on uploading files', path: 'https://help.openai.com/en/articles/8555545-file-uploads-faq' },
            { text: 'Claude\'s help page on uploads', path: 'https://support.claude.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude-ai' },
            { text: 'Gemini Apps Help', path: 'https://support.google.com/gemini/answer/14903178?hl=en' },
          ],
        },
        {
          heading: 'A 1 MB file can still be too long',
          paragraphs: [
            'Megabytes say little about tokens. We made a synthetic CSV of 20,000 orders with 7 columns (order number, date, region, product code, quantity, unit price, total) and counted it with the same counter the site uses:',
            'So the file is far below every upload limit above, yet its text alone would fill more than half of a 1-million-token context window before any question or answer. Other models count tokens their own way, so for them these numbers are estimates. Why tables, Arabic and the model change the count is explained in how many tokens a PDF uses.',
          ],
          list: [
            'The whole file: 1.02 MB and 590,807 tokens, about 29.5 tokens per row.',
            'The first 1,000 rows: 29,541 tokens. The first 5,000 rows: 147,670 tokens.',
            'The same 1,000 rows as indented JSON: 70,529 tokens, more than twice the CSV.',
            'The same 1,000 rows as a Markdown table: 34,559 tokens; as TOON: 30,545 tokens.',
          ],
          links: [{ text: 'how many tokens a PDF uses', path: '/how-many-tokens-is-my-pdf' }],
        },
        {
          heading: 'Measure the file first',
          paragraphs: ['Token counter reads the file on your device and shows the tokens, words and characters of the text you would paste:'],
          list: [
            'Open Token counter and drop the file, or paste text. It reads PDF, Word, PowerPoint, Excel, CSV, JSON, TXT and Markdown files.',
            'Compare the count with the limit of the chat you use, and leave room for your question and the answer.',
            'Delete what you do not need in the text box; the count updates as you edit.',
            'If a PDF counts 0 tokens, it is a scan with no text in it. Run OCR PDF first.',
          ],
          links: [{ text: 'OCR PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'Keep only what the question needs',
          paragraphs: ['The surest fix is to send less. Pick the tool for your file type:'],
          list: [
            'PDF: Extract PDF pages saves only the pages you click as a new PDF, such as the one chapter or the three tables you are asking about.',
            'A long PDF you need in full: Split PDF cuts it by page ranges, every few pages, or one file per page.',
            'Word: Split Word cuts a .docx at its Heading 1 or Heading 2 titles, or at page breaks, so each part is a whole section.',
            'Excel: Split Excel makes one file per sheet, one file every N rows, or one file per value of a column, such as one file per region.',
            'CSV: Split CSV cuts the file by rows per file or by megabytes per file, with the header row in every part. Filter rows or hide columns first, and the parts hold only those.',
          ],
          links: [{ text: 'Extract PDF pages', path: '/extract-pdf-pages' }, { text: 'Split PDF', path: '/split-pdf' }, { text: 'Split Word', path: '/split-word' }, { text: 'Split Excel', path: '/split-excel' }, { text: 'Split CSV', path: '/split-csv' }],
        },
        {
          heading: 'Make the text smaller',
          paragraphs: ['The same content can cost very different numbers of tokens depending on its form, and pasting text lets you see exactly what the chat gets:'],
          list: [
            'PDF: PDF to Markdown turns the pages into text with headings, lists and tables marked, so you can read what the chat will read and trim it. Giving ChatGPT a PDF without losing the tables covers the tables.',
            'Spreadsheets: paste CSV rather than JSON; in the test above it took less than half the tokens. Giving an AI chat a spreadsheet compares CSV with Markdown tables.',
            'JSON records: JSON to TOON writes the same list of records with the field names once at the top, and shows the token count before and after. Deeply nested data saves little.',
            'Columns nobody asked about cost tokens on every row; remove them before you paste.',
          ],
          links: [
            { text: 'PDF to Markdown', path: '/pdf-to-markdown' },
            { text: 'Giving ChatGPT a PDF without losing the tables', path: '/pdf-to-ai-chat-with-tables' },
            { text: 'Giving an AI chat a spreadsheet', path: '/spreadsheet-to-ai-chat' },
            { text: 'JSON to TOON', path: '/json-to-toon' },
          ],
        },
        {
          heading: 'Paste it in parts',
          paragraphs: [
            'When everything is needed, send it in parts in one conversation. Start with a short message such as "I will send a report in 4 parts. Reply only OK until I send part 4, then answer my question." Label each part ("Part 2 of 4: pages 11 to 20"), keep each one well inside the limit, and ask your question after the last part.',
            'All the parts sit in the same context window, so splitting does not add room: if the total is too large, the chat may miss details from the early parts. For a question about one section, a new chat with only that section works better. Before you paste, Mask data can replace names, email addresses and other personal data in a CSV, JSON, Excel or text file on your device.',
          ],
          links: [{ text: 'Mask data', path: '/mask-data' }],
        },
        {
          heading: 'Why did the chat ignore part of my file?',
          paragraphs: ['The chat probably read more than its context window holds. When a file is longer than the window, a service may answer from only part of it or miss details spread through it, and Gemini\'s help page says so directly. Count the text first, send only the pages or rows the question needs, and ask again in a new chat.'],
        },
        {
          heading: 'How many rows of a spreadsheet can I paste at once?',
          paragraphs: ['It depends on the number of columns and the length of the values, so count a sample rather than guess. In our test, a 7-column order table took about 29.5 tokens per row. Divide the room you have by your own tokens per row, then set Split CSV or Split Excel to that many rows per file.'],
        },
        {
          heading: 'Does counting or splitting the file upload it anywhere?',
          paragraphs: ['No, the file is read and split in your browser, and nothing is sent to a server or to an AI service. The only thing that reaches the chat is the text you paste yourself. You can check for yourself that nothing is uploaded by watching the network panel while a tool runs.'],
          links: [{ text: 'check for yourself that nothing is uploaded', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and say which kind of file and which chat you are working with (no personal data).`],
        },
      ],
    },
    '/best-free-csv-viewers': {
      published: '2026-11-24',
      updated: '2026-11-25',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['The best free CSV viewer is the one that fits your file: a browser viewer for private or very large files, a spreadsheet app when you need formulas, and a text editor to see the raw text. OpenAnyDoc\'s CSV viewer opens a CSV as a table you can search, sort and edit in your browser, and the file is never uploaded. Below are five other free options and what each one\'s own site says about it.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }],
        },
        {
          heading: 'How we chose',
          paragraphs: ['Each tool here had to pass three tests. The list is in no ranked order, and OpenAnyDoc comes first only because it is our own site, so judge it by the same facts as the others:'],
          list: [
            'Free to use for viewing with no time limit, according to its own site.',
            'Opens a .csv file on a computer, as a table or as plain text.',
            'For each app or service, its strengths and limits come from its own pages, which are linked below and were checked on 24 November 2026 (the desktop CSV apps again on 25 November 2026). Where a page says nothing, we say so instead of guessing. The text editors that come with Windows and macOS are described from what you see when a CSV opens in them.',
          ],
        },
        {
          heading: 'OpenAnyDoc CSV viewer, in your browser',
          paragraphs: [
            'Drop a .csv, .tsv or .tab file on the CSV viewer. It detects the separator (comma, semicolon, tab or pipe) and the encoding (UTF-8, UTF-16, the older Windows-1256 used for Arabic, or Windows-1252 for Western European letters), and shows the rows as a table you can search, filter, sort and edit, with undo. Every cell is read as text, so leading zeros and long ID numbers stay as written. You can also run SQL queries on the table and download it as CSV or as an Excel workbook.',
            'Limits: the viewer has no row limit of its own, but the file has to fit in your device\'s memory, and a file over 50 MB shows a warning first. It shows values only, because a CSV holds no formulas or formatting. For very big exports, the large CSV viewer opens the same viewer with a hint on cutting the file down.',
          ],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }, { text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'Free spreadsheet apps (checked 24 November 2026)',
          paragraphs: ['Two free spreadsheets open a CSV as a sheet:'],
          list: [
            'Google Sheets works in your web browser. Its product page says "Anyone with a Google Account can create in Sheets". To open a CSV, choose File, then Import in a spreadsheet; the import help page lists .csv, .tsv and .txt among the formats and can detect the separator automatically. Google\'s page on files you can store in Google Drive allows up to 20 million cells or 100MB for spreadsheets created in or converted to Google Sheets.',
            'LibreOffice Calc is part of LibreOffice, which its site calls "free and open source software". Opening a CSV shows a Text Import window first, where you set the character set, the separator and the type of each column, which helps with Arabic text and with files that would land in one column.',
          ],
          links: [
            { text: 'product page', path: 'https://workspace.google.com/products/sheets/' },
            { text: 'import help page', path: 'https://support.google.com/docs/answer/40608' },
            { text: 'files you can store in Google Drive', path: 'https://support.google.com/drive/answer/37603' },
            { text: 'free and open source software', path: 'https://www.libreoffice.org/discover/libreoffice/' },
            { text: 'Text Import window', path: 'https://help.libreoffice.org/latest/en-US/text/shared/00/00000208.html' },
          ],
        },
        {
          heading: 'Desktop CSV apps (checked 25 November 2026)',
          paragraphs: ['Two desktop apps are made for CSV files rather than for spreadsheets:'],
          list: [
            'Modern CSV runs on Windows, macOS and Linux. Its buy page says "You may use the Free version as long as you wish", and its home page says it is designed for files that overwhelm most spreadsheet applications. The Free version includes basic filters and hiding rows or columns, and leaves out SQL queries and SQL filters, pivot tables, charts, and merging or splitting files; those come with a paid licence (US$49 a year, or US$69 once).',
            'Tad runs on macOS, Linux and Windows. Its site describes it as a free desktop application for viewing and analysing tabular data, "a fast viewer for CSV and Parquet files" that supports large files.',
          ],
          links: [
            { text: 'buy page', path: 'https://www.moderncsv.com/buy/' },
            { text: 'home page', path: 'https://www.moderncsv.com/' },
            { text: 'Its site', path: 'https://www.tadviewer.com/' },
          ],
        },
        {
          heading: 'A text editor you already have',
          paragraphs: ['Notepad on Windows and TextEdit on a Mac show the raw file: one row per line, with the separators visible. It is the quickest way to see which separator a file uses, whether the first line holds the headers, and whether values are wrapped in quotes. A wide table is hard to read this way, and deleting a single separator shifts every later value into the wrong column, so edit with care.'],
        },
        {
          heading: 'Where the others do more',
          paragraphs: ['To be fair about the choice: Google Sheets lets several people edit the same spreadsheet at the same time, and both it and LibreOffice Calc have formulas, pivot tables and charts, according to the Google Sheets page and LibreOffice\'s help pages on Calc features and on pivot tables (checked 24 November 2026). Modern CSV\'s paid licence adds pivot tables, charts and SQL to a desktop app, and Tad also opens some database files. OpenAnyDoc edits the values in a CSV and saves CSV or Excel files, but it has no formulas and no live copy that a team edits together.'],
          links: [{ text: 'Google Sheets page', path: 'https://workspace.google.com/products/sheets/' }, { text: 'Calc features', path: 'https://help.libreoffice.org/latest/en-US/text/scalc/main0503.html' }, { text: 'on pivot tables', path: 'https://help.libreoffice.org/latest/en-US/text/scalc/guide/datapilot.html' }],
        },
        {
          heading: 'Which free CSV viewer opens the largest files?',
          paragraphs: ['No program has one fixed answer, because the real limit is usually your computer\'s memory. Google Sheets stops at 20 million cells per spreadsheet and spreadsheet apps stop at a row limit, while OpenAnyDoc has no row limit of its own and Modern CSV and Tad say they handle large files. Try your own file; CSV too big for Excel explains the other options.'],
          links: [{ text: 'CSV too big for Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'Can I open a CSV without uploading it anywhere?',
          paragraphs: ['Yes, any program that reads the file on your own device does that: a text editor, LibreOffice Calc, a desktop CSV app, or OpenAnyDoc in your browser. Google Sheets works with spreadsheets kept in Google Drive. To check a website yourself, watch the browser\'s network panel while the file opens, as shown in how to check that a website does not upload your file.'],
          links: [{ text: 'how to check that a website does not upload your file', path: '/check-file-upload' }],
        },
        {
          heading: 'How do I open a CSV on my phone?',
          paragraphs: ['Use your phone\'s browser: on OpenAnyDoc\'s CSV viewer, tap Choose a file and pick the CSV from Files or your downloads, and it opens as a table in a phone layout, with the tools in a menu. Nothing is installed and the file stays on the phone. More ways, on every device, are in how to open a CSV file without Excel.'],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }, { text: 'how to open a CSV file without Excel', path: '/open-csv-without-excel' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and tell us which CSV viewer we should look at next (no personal data).`],
        },
      ],
    },
    '/best-free-json-formatters': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['A JSON formatter that runs on your own computer keeps your JSON there: the JSON viewer built into Firefox, a code editor such as VS Code, or the jq command line. Among websites, JSONLint and JSON Crack say on their own pages that your JSON is processed in your browser, and OpenAnyDoc\'s JSON formatter formats it in your browser with no save or share feature at all. Below is what each one\'s pages say, in their own words where it matters.'],
          links: [{ text: 'JSON formatter', path: '/json-formatter' }],
        },
        {
          heading: 'How we chose',
          paragraphs: ['Every tool here is free to use and pretty prints JSON. We report only what each tool\'s own pages say about where pasted JSON goes, checked on 24 November 2026, and say so when a page is silent. The list is in no ranked order; OpenAnyDoc is our own site, so hold it to the same standard.'],
        },
        {
          heading: 'OpenAnyDoc JSON formatter',
          paragraphs: [
            'Paste JSON or open a .json file of up to 10 MB, then press Format to pretty print it with 1, 2, 3, 4 or 8 spaces or a tab, or Minify to put it on one line. Sort keys orders every object A to Z, and integers longer than JavaScript can hold are kept digit for digit. If the JSON is invalid, the JSON validator shows the line and column of the error, and Repair fixes trailing commas, comments and single quotes.',
            'The JSON stays in the page\'s memory until you download a copy. There is no save-online button, no share link, no account and no analytics, and the page\'s security policy only lets it contact its own site. The one exception is Open from a URL, which fetches the https address you type straight from your browser. Once loaded, the page works offline.',
          ],
          links: [{ text: 'JSON validator', path: '/json-validator' }],
        },
        {
          heading: 'Built into tools you may already have (checked 24 November 2026)',
          paragraphs: ['These format JSON on your own computer:'],
          list: [
            'Firefox: its documentation says "Firefox includes a JSON viewer". Open a JSON file or address in the browser and it shows a collapsible tree with a filter box, the raw text, and a pretty-printed version. It also reads JSON Lines, though it does not pretty print them.',
            'VS Code: free "for private or commercial use", says its FAQ. Format Document (Shift+Alt+F on Windows) pretty prints a JSON file, and the editor checks it against a JSON schema as you type. The same FAQ says it sends usage data to Microsoft, which the Telemetry Level setting turns off, and the JSON documentation says it can download schemas from http and https addresses.',
            'jq: "a lightweight and flexible command-line JSON processor" for Linux, macOS and Windows. Its manual says "By default, jq pretty-prints JSON output", so jq . file.json prints a file formatted; --indent sets up to 7 spaces, --tab uses tabs, and -c puts each object on one line.',
          ],
          links: [
            { text: 'its documentation', path: 'https://firefox-source-docs.mozilla.org/devtools-user/json_viewer/index.html' },
            { text: 'its FAQ', path: 'https://code.visualstudio.com/docs/supporting/faq' },
            { text: 'JSON documentation', path: 'https://code.visualstudio.com/docs/languages/json' },
            { text: 'command-line JSON processor', path: 'https://jqlang.org/' },
            { text: 'Its manual', path: 'https://jqlang.org/manual/' },
          ],
        },
        {
          heading: 'JSON formatter websites (checked 24 November 2026)',
          paragraphs: ['What the sites themselves say:'],
          list: [
            'JSONLint, a validator and reformatter: the JSONLint privacy policy says "All JSON validation happens client-side in your browser" and "Your JSON data is never sent to our servers for processing". The same policy names Google Analytics and an advertising partner that may set cookies. The JSONLint home page also accepts a URL and "will scrape it for JSON"; it does not say where that fetch runs.',
            'JSON Crack, which draws JSON as a graph: the JSON Crack home page says "Your data is never stored on our servers. Everything happens on your device." It supports about 300 KB of data, depending on the data and your hardware, and the JSON Crack privacy policy names Google Analytics.',
            'jsonformatter.org and Code Beautify both have a save-online feature, and their own pages say saved JSON can become public unless you log in. What each one says is in our jsonformatter.org alternative guide.',
          ],
          links: [
            { text: 'JSONLint privacy policy', path: 'https://jsonlint.com/privacy' },
            { text: 'JSONLint home page', path: 'https://jsonlint.com/' },
            { text: 'JSON Crack home page', path: 'https://jsoncrack.com/' },
            { text: 'JSON Crack privacy policy', path: 'https://jsoncrack.com/legal/privacy' },
            { text: 'jsonformatter.org alternative guide', path: '/jsonformatter-alternative' },
          ],
        },
        {
          heading: 'Side by side',
          paragraphs: ['The main differences, from the pages above:'],
          list: [
            'Where the JSON is formatted: Firefox, VS Code and jq on your computer; JSONLint, JSON Crack and OpenAnyDoc in your browser, by their own pages.',
            'Save-online links: jsonformatter.org and Code Beautify offer them; OpenAnyDoc has none.',
            'Analytics named in the privacy policy: Google Analytics for JSONLint and JSON Crack; OpenAnyDoc has no analytics.',
            'Size: JSON Crack about 300 KB; OpenAnyDoc 10 MB; the other pages we checked state no limit.',
            'Offline: Firefox, VS Code and jq always; OpenAnyDoc once the page has loaded.',
          ],
        },
        {
          heading: 'Where the others do more',
          paragraphs: ['To be fair about the choice: jq filters, reshapes and combines JSON inside scripts and pipelines, which no web page does for you. VS Code checks JSON against a schema while you edit and handles JSON next to your code. Firefox shows the request and response headers of JSON from a server. OpenAnyDoc\'s formatter stops at 10 MB and checks syntax only; for schemas there is a separate JSON Schema page, and JSON graph draws a file as connected boxes.'],
          links: [{ text: 'JSON Schema page', path: '/json-schema' }, { text: 'JSON graph', path: '/json-graph' }],
        },
        {
          heading: 'Is it safe to paste JSON with API keys into an online formatter?',
          paragraphs: ['It is safe only when the JSON never leaves your device, so check what the site says and what it does. A formatter that runs in your browser keeps the keys on your device, while one with save-online or share links can make them public by mistake. Better still, remove secrets before you paste, and replace any key already pasted somewhere you do not trust.'],
        },
        {
          heading: 'How can I check that a JSON formatter does not upload my data?',
          paragraphs: ['Open your browser\'s developer tools, switch to the Network tab, then paste and format the JSON: any request that carries your text appears there. A page that keeps the data local makes no such request. How to check that a website does not upload your file walks through it step by step, in Chrome, Edge, Firefox and Safari.'],
          links: [{ text: 'How to check that a website does not upload your file', path: '/check-file-upload' }],
        },
        {
          heading: 'What is the quickest way to pretty print JSON without a website?',
          paragraphs: ['If you have Firefox, open the .json file in it and switch to the pretty-printed view. In a terminal, jq . file.json prints the file formatted, and in VS Code, Format Document does the same. All three do the formatting on your own computer, so you never paste the JSON into a web page.'],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} and describe what you need (no personal data, and never paste a real token).`],
        },
      ],
    },
    '/openanydoc-vs-google-sheets-large-files': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: ['To open and search a very large CSV, a viewer that reads the file on your own device has the fewest limits: OpenAnyDoc\'s large CSV viewer has no row limit of its own, only your device\'s memory, and nothing is uploaded. Google Sheets holds up to 20 million cells per spreadsheet, a desktop Excel sheet stops at 1,048,576 rows, and Excel for the web opens workbooks of up to 100 MB in the browser, depending on your Microsoft 365 subscription. The spreadsheets still win when you need formulas, charts or a team editing together.'],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'The official limits (checked 24 November 2026)',
          paragraphs: ['From each product\'s own pages:'],
          list: [
            'Google Sheets: "Up to 20 million cells or 100MB for spreadsheets that are created in or converted to Google Sheets", from Google\'s page on files you can store in Google Drive.',
            'Excel on a computer: a worksheet is 1,048,576 rows by 16,384 columns, and a cell holds up to 32,767 characters, from Excel specifications and limits. 64-bit Excel has no hard limit on the file size of a Data Model workbook; 32-bit Excel shares 2 GB of address space with the workbook and add-ins.',
            'Excel for the web: the browser limit is 0–100 MB for workbooks in a SharePoint Online library and 0–10 MB for a workbook attached to an email in Outlook Web App, and Microsoft says it depends on your Microsoft 365 subscription, from File size limits for workbooks in SharePoint.',
            
            'OpenAnyDoc: no row limit of its own; the file has to fit in your device\'s memory, and a file over 50 MB shows a warning before it opens.',
          ],
          links: [
            { text: 'files you can store in Google Drive', path: 'https://support.google.com/drive/answer/37603' },
            { text: 'Excel specifications and limits', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' },
            { text: 'File size limits for workbooks in SharePoint', path: 'https://support.microsoft.com/en-us/office/file-size-limits-for-workbooks-in-sharepoint-9e5bc6f8-018f-415a-b890-5452687b325e' },
          ],
        },
        {
          heading: 'What OpenAnyDoc does with a large CSV',
          paragraphs: [
            'Drop the file on the large CSV viewer and your browser reads it on your device; nothing is sent to a server. The rows are read in the background and arrive in batches of 10,000, and only the rows on screen, plus a few around them, are drawn, so scrolling stays smooth. In OpenAnyDoc\'s own test, a 120,000-row file with 8 columns opened in about half a second on a laptop.',
            'With the file open you can search every column, filter, sort by several columns, see group-by totals and run SQL queries on the table. To get a file a spreadsheet can take, keep only the filtered rows with Download options in the More menu, or cut the file into parts with Split CSV, each part starting with the header row.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }, { text: 'Split CSV', path: '/split-csv' }],
        },
        {
          heading: 'Desktop CSV editors (checked 24 November 2026)',
          paragraphs: ['Desktop apps made for CSV avoid a spreadsheet\'s grid limits too. The Modern CSV home page says it "handles files beyond Excel\'s million-row limit" and, from its own testing, loads a file 28 times faster than Excel; its Free version can be used for as long as you wish. Tad\'s site calls it a free desktop viewer for CSV and Parquet files that "supports large files". Neither page states a maximum file size. More free programs are listed in how to open a CSV file without Excel.'],
          links: [
            { text: 'Modern CSV home page', path: 'https://www.moderncsv.com/' },
            { text: 'Tad\'s site', path: 'https://www.tadviewer.com/' },
            { text: 'how to open a CSV file without Excel', path: '/open-csv-without-excel' },
          ],
        },
        {
          heading: 'A test you can run yourself',
          paragraphs: ['Make a synthetic CSV and open it in each program. With Node.js installed on macOS or Linux, this one line writes big.csv: a header and 2,000,000 rows of made-up data in 10 columns.'],
          list: [
            'node -e "const f=require(\'fs\').createWriteStream(\'big.csv\');f.write(\'id,city,amount,date,code,a,b,c,d,e\\n\');for(let i=1;i<=2e6;i++)f.write(i+\',City\'+i%50+\',\'+i%997+\'.50,2026-01-\'+String(1+i%28).padStart(2,\'0\')+\',C\'+i%10000+\',1,2,3,4,5\\n\');f.end()"',
            'The file is 96,046,244 bytes (about 96 MB) and holds 20,000,010 cells, counting the header row. That is more rows than an Excel sheet holds and just over Google Sheets\' 20 million cells, while still under its 100MB figure. In OpenAnyDoc it passes 50 MB, so the size warning appears first.',
            'For each program, write down whether all 2,000,000 rows arrived and how long opening took. Change 2e6 to 1e6 for a file that fits in one Excel sheet.',
          ],
        },
        {
          heading: 'Where Google Sheets and Excel do more',
          paragraphs: ['Spreadsheets are built for work a viewer does not do. Google Sheets lets several people edit the same spreadsheet at the same time, with formulas, pivot tables and charts, as the Sheets product page says. Excel has formulas, PivotTables, charts and Power Query, and its Data Model can hold millions of rows, more than a sheet, as Microsoft\'s page on a memory-efficient Data Model says (both checked 24 November 2026); CSV too big for Excel shows the steps. OpenAnyDoc edits values and saves CSV or Excel files, but it has no formulas and no live copy that a team edits together.'],
          links: [{ text: 'Sheets product page', path: 'https://workspace.google.com/products/sheets/' }, { text: 'memory-efficient Data Model', path: 'https://support.microsoft.com/topic/951c73a9-21c4-46ab-9f5e-14a2833b6a70' }, { text: 'CSV too big for Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'Which one to use',
          paragraphs: ['Match the tool to the job:'],
          list: [
            'Looking through, searching or cutting down a big export: OpenAnyDoc\'s large CSV viewer, or a desktop CSV app.',
            'A file a team must edit together: Google Sheets, if it fits in 20 million cells.',
            'Formulas and pivot tables within a sheet\'s row limit: Excel or LibreOffice Calc on a computer.',
            'More rows than that in Excel: load the CSV into the Data Model, or split it first.',
            'Customer exports and other private data: a tool that reads the file on your device, within your company\'s rules on where data may go.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }, { text: 'split it first', path: '/split-csv' }],
        },
        {
          heading: 'Can Google Sheets open a CSV with more than a million rows?',
          paragraphs: ['It can, as long as the whole spreadsheet stays within Google\'s limit of 20 million cells or 100MB. Divide 20 million by the number of columns to find the most rows that fit: a 10-column file fits just under 2 million rows, a 40-column file only 500,000. Other sheets in the same spreadsheet count toward the limit too.'],
        },
        {
          heading: 'Is Excel for the web better than desktop Excel for big files?',
          paragraphs: ['Usually not. Microsoft lists a browser limit of 0–100 MB for workbooks in SharePoint Online, depending on your subscription, and 10 MB for a workbook opened from an Outlook Web App attachment. Above the limit, its page File size limits for workbooks in SharePoint suggests downloading the workbook and opening it in Excel on your device (checked 24 November 2026).'],
          links: [{ text: 'File size limits for workbooks in SharePoint', path: 'https://support.microsoft.com/en-us/office/file-size-limits-for-workbooks-in-sharepoint-9e5bc6f8-018f-415a-b890-5452687b325e' }],
        },
        {
          heading: 'Does my CSV leave my computer when I open it in OpenAnyDoc?',
          paragraphs: ['No. Your browser reads the file on your device, and the page makes no request that carries your file, so there is no upload to wait for, even with a large export. You can watch it yourself in the browser\'s network panel, as described in how to check that a website does not upload your file.'],
          links: [{ text: 'how to check that a website does not upload your file', path: '/check-file-upload' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with the file\'s size, rows and columns (no personal data), and what you need to do with it.`],
        },
      ],
    },
    '/large-csv-test': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'The short answer',
          paragraphs: [
            'A CSV with 3,000,000 rows does not fit in one Excel worksheet, which stops at 1,048,576 rows, and at 8 columns it is more than Google Sheets\' 20 million cells. Tools with no row limit of their own can open the whole file if the device has the memory, and OpenAnyDoc\'s large CSV viewer is one of them: it reads the file in your browser and uploads nothing. Below are the test file, what each of six tools\' published limits mean for it, and the steps to run the test on your own computer.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'The test file',
          paragraphs: ['Write the file with a short script, so it holds no real data:'],
          list: [
            'Rows: 3,000,000 data rows plus one header row, so 3,000,001 lines.',
            'Columns (8): order_id, order_date, region, category, product_code, quantity, unit_price, total.',
            'A typical line: 2,2025-07-10,South,Ink,P-99703,8,25.48,203.84.',
            'Size: well over 100 MB, depending on the random values; note your own file\'s size.',
            'Format: UTF-8 without a byte order mark, commas between fields, a line feed at the end of each line, no quoted fields.',
            'Cells: 3,000,001 lines × 8 columns = 24,000,008 cells.',
          ],
        },
        {
          heading: 'The computer, the browser and the rules',
          paragraphs: ['Open the same file on the same computer in every tool, one at a time, with nothing else running. Time each one from dropping or opening the file until the last row can be reached, and write down:'],
          list: [
            'Computer: model, processor, memory.',
            'Operating system.',
            'Browser for OpenAnyDoc and Google Sheets: name and version.',
            'Excel: version and build, 32-bit or 64-bit. LibreOffice Calc: version. Text editor: name and version.',
            'Test date. The official limits below were checked 24 November 2026.',
          ],
        },
        {
          heading: 'What to expect in each tool',
          paragraphs: [
            'The Excel and Google Sheets lines follow from each product\'s published limit; for the rest, write down what you see.',
          ],
          list: [
            'OpenAnyDoc large CSV viewer: a warning first, because the file is over 50 MB. Note how long the file takes to open and how many rows it reports. After it opens, a hint explains how to cut the file down for Excel. Time a sort by one column and a search too.',
            'OpenAnyDoc CSV viewer: the same viewer without the hint; note how long it takes to open.',
            'Excel (desktop): a worksheet holds 1,048,576 rows, so Excel can load at most the header and 1,048,575 data rows of this file. 3,000,000 − 1,048,575 = 1,951,425 rows, 65% of the data, are left out. Note the message shown and the time taken.',
            'Google Sheets (File, Import): a spreadsheet holds up to 20 million cells, so at 8 columns it holds at most 20,000,000 ÷ 8 = 2,500,000 rows, the header included, and 500,001 data rows would not fit. The same limit page also says 100MB per spreadsheet, and this file is over 100 MB. Note whether the import fails outright or loads part of the file.',
            'LibreOffice Calc: note what it shows and how many rows arrive.',
            'Text editor: note whether it opens the file, how long it takes, and whether scrolling and search keep up.',
          ],
          links: [
            { text: 'a worksheet holds 1,048,576 rows', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' },
            { text: 'a spreadsheet holds up to 20 million cells', path: 'https://support.google.com/drive/answer/37603' },
          ],
        },
        {
          heading: 'How OpenAnyDoc reads a file this big',
          paragraphs: [
            'Nothing is sent to a server. The browser reads the whole file into the tab\'s memory, and a background worker splits it into rows so the page stays responsive. The rows come back to the page in batches of 10,000, 301 batches for this file, and only the rows on screen are drawn, so scrolling does not slow down as the table grows. The viewer has no row limit of its own; the limit is the memory your browser can give one tab.',
            'Opened from the large CSV viewer page, the table shows a hint: filter the rows you need, then choose Download options and tick "only the shown rows". Opened from the CSV viewer, the same table appears without it. To cut the file into parts Excel can open, Split CSV saves it as smaller files of a set number of rows or megabytes, each with the header row.',
          ],
          links: [{ text: 'CSV viewer', path: '/csv-viewer' }, { text: 'Split CSV', path: '/split-csv' }],
        },
        {
          heading: 'What the other tools do better',
          paragraphs: ['A viewer is not the right tool for every job, and the others win in clear places (Microsoft\'s and Google\'s pages, checked 24 November 2026):'],
          list: [
            'Excel can load the complete data set through Power Query and analyse it with PivotTables, as Microsoft\'s page on a data set too large for the Excel grid explains, and it has formulas, charts and macros a viewer does not.',
            'Google Sheets keeps a file online for several people to edit at once, and its revision history lets you go back to earlier versions, as the Sheets product page says.',
            'LibreOffice Calc is a full spreadsheet that works offline, with formulas and charts, at no cost.',
            'A text editor made for large files shows the raw text exactly as written, which helps when a single line is broken.',
          ],
          links: [{ text: 'data set too large for the Excel grid', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'Sheets product page', path: 'https://workspace.google.com/products/sheets/' }],
        },
        {
          heading: 'How to repeat this test',
          paragraphs: ['Use the same file in every tool, and close other programs first:'],
          list: [
            'Write the file with a script of your choice: 3,000,000 rows of the 8 columns above with random values, UTF-8, commas, one header row. Check that it has 3,000,001 lines and note its size.',
            'Note the computer, operating system, browser and program versions.',
            'Open the large CSV viewer, drop the file, and time it from the drop until the row count appears. Then sort by one column and search for one product code, and time both.',
            'Repeat on the CSV viewer page.',
            'Open the file in Excel by double-clicking it, and note the message, the time and the last row number.',
            'In Google Sheets, choose File, Import, Upload, and note what happens.',
            'Open it in LibreOffice Calc and in your text editor, and note the same things.',
            'Run each tool three times and record the middle time.',
          ],
          links: [{ text: 'large CSV viewer', path: '/large-csv-viewer' }],
        },
        {
          heading: 'Can Excel open a CSV with 3 million rows?',
          paragraphs: [
            'Excel cannot show 3 million rows in one worksheet, because a worksheet stops at 1,048,576 rows. Opened directly, Excel warns that the data set is too large for the Excel grid and that some data was not loaded. Power Query can load the complete data set for PivotTables, or you can split the file first, as Microsoft\'s page on a data set too large for the Excel grid explains (checked 24 November 2026). CSV too big for Excel explains every option.',
          ],
          links: [{ text: 'data set too large for the Excel grid', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'CSV too big for Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'Why can\'t Google Sheets import a very large CSV?',
          paragraphs: [
            'Google Sheets caps each spreadsheet at 20 million cells or 100MB, so a long file with many columns runs out of room. Divide 20 million by your column count to see how many rows can fit. For a side-by-side look at both ways of working, see OpenAnyDoc vs Google Sheets for large files.',
          ],
          links: [{ text: 'OpenAnyDoc vs Google Sheets for large files', path: '/openanydoc-vs-google-sheets-large-files' }],
        },
        {
          heading: 'How do I split a large CSV so each part fits in Excel?',
          paragraphs: [
            'Split it into parts of at most 1,048,575 data rows each, so every part plus its header row fits on one worksheet. Split CSV does this in your browser by rows or by megabytes, puts the header in every part and downloads them as one ZIP. How to split a large CSV walks through it.',
          ],
          links: [{ text: 'Split CSV', path: '/split-csv' }, { text: 'How to split a large CSV', path: '/split-large-csv' }],
        },
        {
          heading: 'Questions?',
          paragraphs: [`Write to ${CONTACT_EMAIL} with your own results for this test, the row count and size of the file and the computer you used (no personal data).`],
        },
      ],
    },
    '/guides': {
      sections: [
        {
          heading: 'Guides',
          paragraphs: ['Short, practical answers to the problems people hit with CSV, Excel, JSON and text files, Word documents, PowerPoint slides and PDFs, each with the free tool that fixes it in your browser:'],
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
            'PDF tools that do not upload your file',
            'How to sign a PDF without Adobe',
            'How to open a TXT file: which program to use on any device',
            'How to open a CSV file without Excel',
            'How to open a PPTX file without PowerPoint',
            'How to open a PDF without Adobe',
            'Why Arabic text copied from a PDF comes out reversed, and how to fix it',
            'Why can\'t I edit the text in a PDF?',
            'How to fill in a PDF form without Acrobat',
            'A Stirling-PDF alternative that needs no server',
            'A jsonformatter.org and Code Beautify alternative',
            'How to give ChatGPT a PDF without losing the tables',
            'How many tokens is my PDF?',
            'How to give a Word document to an AI chat and keep its structure',
            'How to give a PowerPoint presentation to an AI chat',
            'How do I give an AI chat a spreadsheet it can read?',
            'How to make a Markdown table from a CSV file',
            'What is the TOON format, and when does it save tokens?',
            'How to merge PDF files on any device',
            'How to split a PDF or save only some pages',
            'How to turn phone photos into one PDF',
            'How to password-protect a PDF',
            'How to make a scanned PDF searchable',
            'How to reduce a photo\'s file size for email or a form',
            'How to open iPhone HEIC photos on Windows',
            'How to remove the location from a photo',
            'How to remove a photo\'s background without uploading it',
            'How to convert an Excel sheet to JSON for an API',
            'How to split a large CSV file into smaller files',
            'JSON vs JSON Lines: what is the difference?',
            'How to compare two JSON files and see what changed',
            'What are Excel\'s row and column limits?',
            'How do I find hidden sheets, rows and formulas in an Excel file?',
            'How do I convert Excel to CSV without breaking Arabic text?',
            'How to read speaker notes without PowerPoint',
            'How to compress a video without uploading it',
            'What to do when a file is too large for ChatGPT',
            'What is the best free CSV viewer?',
            'Which free JSON formatters don\'t store your data?',
            'OpenAnyDoc vs Google Sheets vs Excel: which opens large CSV files?',
            'How to test a 3-million-row CSV in 6 tools',
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
            { text: 'PDF tools that do not upload your file', path: '/pdf-tools-without-upload' },
            { text: 'How to sign a PDF without Adobe', path: '/sign-pdf-without-adobe' },
            { text: 'How to open a TXT file: which program to use on any device', path: '/open-txt-file' },
            { text: 'How to open a CSV file without Excel', path: '/open-csv-without-excel' },
            { text: 'How to open a PPTX file without PowerPoint', path: '/open-pptx-without-powerpoint' },
            { text: 'How to open a PDF without Adobe', path: '/open-pdf-without-adobe' },
            { text: 'Why Arabic text copied from a PDF comes out reversed, and how to fix it', path: '/fix-arabic-text-copied-from-pdf' },
            { text: 'Why can\'t I edit the text in a PDF?', path: '/cant-edit-text-in-pdf' },
            { text: 'How to fill in a PDF form without Acrobat', path: '/fill-pdf-form-without-acrobat' },
            { text: 'A Stirling-PDF alternative that needs no server', path: '/stirling-pdf-alternative' },
            { text: 'A jsonformatter.org and Code Beautify alternative', path: '/jsonformatter-alternative' },
            { text: 'How to give ChatGPT a PDF without losing the tables', path: '/pdf-to-ai-chat-with-tables' },
            { text: 'How many tokens is my PDF?', path: '/how-many-tokens-is-my-pdf' },
            { text: 'How to give a Word document to an AI chat and keep its structure', path: '/word-document-to-ai-chat' },
            { text: 'How to give a PowerPoint presentation to an AI chat', path: '/powerpoint-to-ai-chat' },
            { text: 'How do I give an AI chat a spreadsheet it can read?', path: '/spreadsheet-to-ai-chat' },
            { text: 'How to make a Markdown table from a CSV file', path: '/make-markdown-table-from-csv' },
            { text: 'What is the TOON format, and when does it save tokens?', path: '/what-is-toon-format' },
            { text: 'How to merge PDF files on any device', path: '/how-to-merge-pdf-files' },
            { text: 'How to split a PDF or save only some pages', path: '/how-to-split-a-pdf' },
            { text: 'How to turn phone photos into one PDF', path: '/photos-to-one-pdf' },
            { text: 'How to password-protect a PDF', path: '/password-protect-pdf-free' },
            { text: 'How to make a scanned PDF searchable', path: '/make-scanned-pdf-searchable' },
            { text: 'How to reduce a photo\'s file size for email or a form', path: '/reduce-photo-file-size' },
            { text: 'How to open iPhone HEIC photos on Windows', path: '/open-heic-on-windows' },
            { text: 'How to remove the location from a photo', path: '/remove-location-from-photo' },
            { text: 'How to remove a photo\'s background without uploading it', path: '/remove-background-without-upload' },
            { text: 'How to convert an Excel sheet to JSON for an API', path: '/convert-excel-to-json-for-api' },
            { text: 'How to split a large CSV file into smaller files', path: '/split-large-csv' },
            { text: 'JSON vs JSON Lines: what is the difference?', path: '/json-vs-json-lines' },
            { text: 'How to compare two JSON files and see what changed', path: '/compare-two-json-files' },
            { text: 'What are Excel\'s row and column limits?', path: '/excel-row-and-column-limits' },
            { text: 'How do I find hidden sheets, rows and formulas in an Excel file?', path: '/find-hidden-sheets-in-excel' },
            { text: 'How do I convert Excel to CSV without breaking Arabic text?', path: '/excel-to-csv-without-breaking-arabic' },
            { text: 'How to read speaker notes without PowerPoint', path: '/read-speaker-notes-without-powerpoint' },
            { text: 'How to compress a video without uploading it', path: '/compress-video-without-upload' },
            { text: 'What to do when a file is too large for ChatGPT', path: '/file-too-large-for-chatgpt' },
            { text: 'What is the best free CSV viewer?', path: '/best-free-csv-viewers' },
            { text: 'Which free JSON formatters don\'t store your data?', path: '/best-free-json-formatters' },
            { text: 'OpenAnyDoc vs Google Sheets vs Excel: which opens large CSV files?', path: '/openanydoc-vs-google-sheets-large-files' },
            { text: 'How to test a 3-million-row CSV in 6 tools', path: '/large-csv-test' },
          ],
        },
        {
          heading: 'Where to start',
          paragraphs: [
            'If someone sent you a file and you do not have the program it was made in, start with the guides on opening a file: a TXT file on any device, a CSV or XLSX file without Excel, a DOCX file without Word, a PPTX file without PowerPoint, a JSON file, or a PDF without Adobe. Each one lists the free options, says which of them upload your file, and what each keeps or drops.',
            'If the file opens but looks wrong, the problem guides explain the cause before the fix: Arabic that turns into symbols, a CSV that lands in one column, a file too big for Excel, or a JSON error that points at an unexpected token. If you are about to share a file, the guides on anonymizing data and on checking that a website does not upload your file show what to look for first.',
          ],
        },
        {
          heading: 'How these guides are written',
          paragraphs: [
            'Each guide is checked against the viewers before it is published: every step names a button that exists, and every limit comes from the tool\'s own settings, a test we ran or the maker\'s own page. The dates under a title say when it was written and when its text last changed.',
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
            'تقول ملاحظة Microsoft عن فتح ملفات CSV UTF-8 (تحققنا منها في 24 نوفمبر 2026) إن ملف CSV بترميز UTF-8 يُفتح في Excel بشكل طبيعي إذا حُفظ مع علامة ترتيب البايتات (BOM)، وهي علامة من ثلاثة بايتات في بداية الملف. ومعظم عمليات التصدير تُغفل هذه العلامة، وعندها تتحول العربية إلى رموز. والملفات المفصولة بعلامة جدولة (.tsv) تعاني المشكلة نفسها تمامًا.',
          ],
          links: [{ text: 'الملفات المفصولة بعلامة جدولة', path: '/tsv-viewer' }, { text: 'ملاحظة Microsoft عن فتح ملفات CSV UTF-8', path: 'https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032' }],
        },
        {
          heading: 'الحل الأول: نزّل نسخة جاهزة لبرنامج Excel (مجانًا وبلا رفع)',
          paragraphs: ['يضيف OpenAnyDoc العلامة الناقصة بدلًا عنك، والملف لا يغادر جهازك أبدًا:'],
          list: [
            'افتح عارض CSV وأفلت الملف على الصفحة. يتحقق العارض من وجود BOM ومن UTF-16 وUTF-8، ويعود إلى Windows-1256 للملفات العربية القديمة، أو إلى Windows-1252 إذا بدت الحروف أوروبية غربية؛ ويعرض شريط الحالة أسفل الصفحة الترميز الذي وجده.',
            'إذا كان في الملف نص عربي بلا BOM، يظهر زر «نسخة Excel» في شريط الحالة. انقر عليه.',
            'تُنزَّل نسخة باسم ملفك مع إضافة «-excel»، تحمل علامة UTF-8 ونهايات أسطر Windows. انقر عليها نقرًا مزدوجًا فيعرض Excel العربية بشكل صحيح.',
          ],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'الحل الثاني: استورد الملف بدل فتحه',
          paragraphs: [
            'تقدّم ملاحظة Microsoft عن فتح ملفات CSV UTF-8 (تحققنا منها في 24 نوفمبر 2026) طريقة لفتح ملف UTF-8 بلا علامة BOM: من تبويب «بيانات» اختر «الحصول على البيانات» ثم «من ملف» ثم «من نص/CSV»، واختر الملف. ينجح هذا، لكن عليك تكراره مع كل ملف، والنتيجة مصنف وليس ملف CSV نفسه.',
            'ويضيف زر التنزيل العادي في OpenAnyDoc العلامة أيضًا كلما احتوى الملف على نص بغير الإنجليزية، فأي نسخة تعدّلها هناك تُفتح في Excel بلا مشكلة. وإذا كان في الملف صفوف أكثر مما تتسع له ورقة Excel، فإن عارض ملفات CSV الكبيرة يفتحه في المتصفح.',
          ],
          links: [{ text: 'ملاحظة Microsoft عن فتح ملفات CSV UTF-8', path: 'https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032' }, { text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'الحل الثالث: اكتب الملف بالطريقة الصحيحة في المرة القادمة',
          paragraphs: [
            'إذا كان ملف CSV يأتي من كود أو أداة تصدير، فاكتب UTF-8 مع BOM للملفات التي ستُفتح في Excel، أو صدّر مصنف .xlsx بدلًا منه، فهو يخزّن ترميزه ولا يقع في هذه المشكلة أبدًا. ويمكنك التحقق من ملف XLSX في عارض Excel دون فتح برنامج Excel.',
          ],
          links: [{ text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'الحالة المعاكسة: ملف عربي قديم',
          paragraphs: [
            'كثير من ملفات التصدير من الأنظمة العربية القديمة مكتوبة بترميز Windows-1256 بلا أي UTF-8. وتفترض المتصفحات والمحررات ومعظم الأدوات الحديثة UTF-8 فتعرض هذا الملف رموزًا بلا معنى. يقرأ OpenAnyDoc هذا الملف بترميز Windows-1256 تلقائيًا، وإن أخطأ التخمين فاختر الترميز بنفسك من شريط الحالة. وعند التنزيل يُكتب الملف بترميز UTF-8 مع العلامة، فيُفتح بشكل صحيح في كل مكان.',
          ],
        },
        {
          heading: 'عندما تكون الحروف صحيحة والترتيب خاطئًا',
          paragraphs: [
            'إذا كانت الحروف العربية نفسها صحيحة لكن الأرقام أو الأقواس أو الكلمات الإنجليزية تقف في الجهة الخطأ، فالترميز سليم. المشكلة في اتجاه النص. أما في OpenAnyDoc فتُعرض الخلايا ذات النص العربي من اليمين إلى اليسار تلقائيًا.',
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
            'ملف CSV لا يحمل ترويسة تقول أي حرف يفصل بين الحقول. الاسم يقول "مفصول بفواصل"، لكن Excel حين تفتح ملف .csv مباشرة يستخدم الإعدادات الحالية لجهازك، و"فاصل القائمة" يُضبط في إعدادات المنطقة في Windows، كما تشرح صفحة Microsoft عن استيراد الملفات النصية وتصديرها (تحققنا منها في 24 نوفمبر 2026). وتقول الصفحة نفسها إن Excel يستخدم الفاصلة المنقوطة فاصلًا للقائمة حين يكون الفاصل العشري فاصلة، فيستقر ملف مكتوب بالفواصل في عمود واحد. ويحدث العكس أيضًا: ملف مصدَّر بالفاصلة المنقوطة يُفتح في عمود واحد على جهاز فاصل القائمة فيه فاصلة.',
          ],
          links: [{ text: 'صفحة Microsoft عن استيراد الملفات النصية وتصديرها', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }],
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
            'في Excel اذهب إلى «بيانات» ثم «الحصول على البيانات» ثم «من ملف» ثم «من نص/CSV». تعرض المعاينة البيانات مع خانة «المحدد»: اختر فاصلة أو فاصلة منقوطة أو علامة جدولة أو حرفًا مخصصًا ثم «تحميل». والخطوات في صفحة Microsoft عن استيراد الملفات النصية وتصديرها (تحققنا منها في 24 نوفمبر 2026). ينجح هذا، لكن عليك تكرار ذلك مع كل ملف، والنتيجة مصنف وليس ملف CSV نفسه.',
            'وإذا كانت البيانات في عمود واحد أمامك بالفعل فحدّدها واذهب إلى «بيانات» ثم «تحويل النص إلى أعمدة»، واختر «محدد»، وعلّم على الفاصل، ثم «إنهاء». هذا يصلح الورقة التي أمامك دون إعادة فتح الملف، والخطوات في صفحة Microsoft عن تقسيم النص إلى أعمدة (تحققنا منها في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'صفحة Microsoft عن استيراد الملفات النصية وتصديرها', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }, { text: 'صفحة Microsoft عن تقسيم النص إلى أعمدة', path: 'https://support.microsoft.com/en-us/office/split-text-into-different-columns-30b14928-5550-41f5-97ca-7a3e9c363ed7' }],
        },
        {
          heading: 'الحل الثالث: غيّر فاصل القائمة في Windows',
          paragraphs: [
            'أما الحل الدائم لجهاز واحد فهو "فاصل القائمة" في Windows. في Windows 11 ابحث عن «إعدادات المنطقة»، واختر «إعدادات اللغة الإدارية»، ثم «إعدادات إضافية» في تبويب «التنسيقات»، واكتب الفاصل في خانة «فاصل القائمة» في تبويب «الأرقام». وتذكر صفحة Microsoft عن استيراد الملفات النصية وتصديرها هذه الخطوات (تحققنا منها في 24 نوفمبر 2026)، وتنبّه إلى أن التغيير يشمل البرامج الأخرى على الجهاز أيضًا، فغيّره فقط إذا كانت كل الملفات التي تفتحها تستخدم الفاصل نفسه.',
          ],
          links: [{ text: 'صفحة Microsoft عن استيراد الملفات النصية وتصديرها', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }],
        },
        {
          heading: 'علامات الاقتباس وفواصل الأسطر والأرقام',
          paragraphs: [
            'أي حقل يحتوي على الفاصل نفسه أو فاصل سطر أو علامة اقتباس يجب أن يُحاط بعلامتي اقتباس مزدوجتين ("الرياض، السعودية") مع مضاعفة علامات الاقتباس الداخلية. والملف الذي يلتزم بذلك ينجو مع أي من الحلول أعلاه؛ أما الذي لا يلتزم فيتعطل في العارض أيضًا، لكنه يعرض الصفوف غير المتساوية لترى أين الخلل. وفقدان الأصفار في البداية (الرموز البريدية والمعرّفات) مشكلة منفصلة: يحذفها Excel حين يعامل القيمة رقمًا، كما تشرح صفحة Microsoft عن الاحتفاظ بالأصفار البادئة (تحققنا منها في 24 نوفمبر 2026)، بينما يبقيها العارض كما كُتبت.',
          ],
          links: [{ text: 'صفحة Microsoft عن الاحتفاظ بالأصفار البادئة', path: 'https://support.microsoft.com/topic/1bf7b935-36e1-4985-842f-5dfa51f85fe7' }],
        },
        {
          heading: 'ما زال في عمود واحد؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} والصق أول سطرين من الملف (من دون بيانات شخصية). الفاصل يظهر هناك عادةً.`],
        },
      ],
    },
    '/csv-too-big-for-excel': {
      published: '2026-10-22',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'ما الذي تراه',
          paragraphs: [
            'ينبّه Excel إلى أن مجموعة البيانات أكبر مما تتسع له شبكة Excel وأن حفظ المصنف سيُفقد البيانات التي لم تُحمَّل، وتتوقف الورقة عند الصف 1,048,576، كما تصف صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel (تحققنا منها في 24 نوفمبر 2026). ملف التصدير سليم؛ هو فقط أكبر مما تتسع له ورقة عمل.',
          ],
          links: [{ text: 'صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }],
        },
        {
          heading: 'لماذا لا يستطيع Excel فتحه',
          paragraphs: [
            'تتسع ورقة العمل لـ 1,048,576 صفًا و16,384 عمودًا على الأكثر، بحسب صفحة مواصفات Excel وحدوده لدى Microsoft (تحققنا منها في 24 نوفمبر 2026). وملف CSV بصفوف أكثر يُقطع عند ذلك السطر. ولـ Google Sheets حده الخاص: ما يصل إلى 20 مليون خلية أو 100 ميغابايت للجدول المُنشأ في Google Sheets أو المحوَّل إليه، بحسب صفحة Google عن الملفات التي يمكنك تخزينها في Google Drive (تحققنا منها في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'صفحة مواصفات Excel وحدوده', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }, { text: 'الملفات التي يمكنك تخزينها في Google Drive', path: 'https://support.google.com/drive/answer/37603' }],
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
            'يستطيع Excel تحميل كل الصفوف في PivotTable دون وضعها في الخلايا. افتح مصنفًا فارغًا، واذهب إلى «بيانات» ثم «من نص/CSV»، واختر الملف ثم «استيراد»، وفي المعاينة اختر «تحميل إلى» ثم «تقرير PivotTable». والخطوات في صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel (تحققنا منها في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }],
        },
        {
          heading: 'الخيار الثالث: قسّم الملف أو لخّصه أولًا',
          paragraphs: [
            'إذا كان الهدف تقريرًا فجمّع البيانات قبل Excel: قاعدة بيانات (معظمها يستورد ملف CSV مباشرة)، أو بضعة أسطر Python مع pandas، أو سطر الأوامر (split -l 1000000 file.csv part_ على macOS وLinux) تقطع الملف إلى أجزاء يفتحها Excel. ولإلقاء نظرة واحدة على البيانات، عارض المتصفح أعلاه أسرع من كل هذه.',
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
      updated: '2026-11-23',
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
          paragraphs: ['يفتح Firefox وMicrosoft Edge ملف JSON دون برامج إضافية. يعرضه Firefox في عارض مدمج تُطوى فيه الكائنات والمصفوفات وتُفتح، كما يصف توثيق عارض JSON فيه. ويعرض Edge النص كما هو، مع خانة Pretty-print ترتّب الملف المحفوظ في سطر واحد، كما تصف صفحة Microsoft عن عرض JSON في Edge (تحققنا منهما في 24 نوفمبر 2026).'],
          links: [{ text: 'توثيق عارض JSON', path: 'https://firefox-source-docs.mozilla.org/devtools-user/json_viewer/index.html' }, { text: 'صفحة Microsoft عن عرض JSON في Edge', path: 'https://learn.microsoft.com/en-us/microsoft-edge/web-platform/json-viewer' }],
        },
        {
          heading: 'في محرر شيفرة',
          paragraphs: ['إن كنت تتعامل مع JSON كثيرًا، فمحرر شيفرة مثل Visual Studio Code يساعدك. يرتّب أمر Format Document فيه (Shift+Alt+F على ويندوز، وShift+Option+F على ماك) ملفًا محفوظًا في سطر واحد، بحسب توثيق التحرير الأساسي فيه (تحققنا منه في 24 نوفمبر 2026).'],
          links: [{ text: 'توثيق التحرير الأساسي', path: 'https://code.visualstudio.com/docs/editing/codebasics' }],
        },
        {
          heading: 'اجعل الملف المحفوظ في سطر واحد مقروءًا',
          paragraphs: ['الملف المحفوظ في سطر واحد صالح لكنه غير مقروء. يضيف منسّق JSON المسافات البادئة بمسافتين أو أربع (أو بمسافة واحدة أو 3 أو 8، أو علامة جدولة)، ويرتّب المفاتيح، ويضغط الملف من جديد حين تحتاج ملفًا صغيرًا.'],
          links: [{ text: 'منسّق JSON', path: '/json-formatter' }],
        },
        {
          heading: 'إن لم يُفتح الملف',
          paragraphs: ['الرسالة تقول السبب في الغالب:'],
          list: [
            '"Unexpected token" أو "Unexpected end of JSON input" تعني أن النص يخالف قاعدة من قواعد JSON: فاصلة زائدة، أو علامات اقتباس مفردة، أو تعليق. يعرض مدقق JSON السطر والعمود ويصلح الأخطاء الشائعة، ويشرح دليل أخطاء unexpected token كل رسالة.',
            'الملف الذي يبدأ بالعلامة < صفحة HTML حُفظت باسم json، وغالبًا صفحة خطأ من خادم.',
            'الملف الذي فيه كائن JSON في كل سطر (jsonl أو ndjson) هو JSON Lines: كل سطر مستند مستقل، فيرفض محلل JSON العادي الملف كله. ويفتح عارض JSON ملفات jsonl وndjson سطرًا سطرًا.',
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
      updated: '2026-11-23',
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
            'LibreOffice Calc (ويندوز وماك ولينكس) يفتح ملفات xlsx ويحفظها، بحسب متطلبات النظام وصفحة المساعدة عن ملفات Microsoft Office لدى LibreOffice (تحققنا منهما في 24 نوفمبر 2026).',
            'Apple Numbers يفتح جداول Excel ويمكنه تصدير نسخة بصيغة Excel، بحسب دليل Numbers من Apple (تحققنا منه في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'متطلبات النظام', path: 'https://www.libreoffice.org/get-help/system-requirements/' }, { text: 'صفحة المساعدة عن ملفات Microsoft Office', path: 'https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_user.html' }, { text: 'دليل Numbers', path: 'https://support.apple.com/guide/numbers/tan9f3c54bdc/mac' }],
        },
        {
          heading: 'الحزم على الإنترنت (يُرفع الملف)',
          paragraphs: ['يفتح Google Sheets ملف xlsx الموجود في Google Drive، بحسب صفحة Google عن استخدام ملفات Office (تحققنا منها في 24 نوفمبر 2026). ويحتاج حساب Google، ويُخزَّن المصنف على خوادم Google. هذا مقبول لمعظم الملفات، لكن ليس لكشوف الرواتب أو قوائم العملاء أو أي ملف لا يُسمح لك بمشاركته.'],
          links: [{ text: 'صفحة Google عن استخدام ملفات Office', path: 'https://support.google.com/docs/answer/6055139' }],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['تفتح متصفحات الهاتف OpenAnyDoc بالطريقة نفسها: اضغط «اختر ملفًا» وحدد المصنف من «الملفات» أو التنزيلات.'],
        },
        {
          heading: 'تحتاج البيانات فقط؟',
          paragraphs: ['إن كنت تحتاج الأرقام في برنامج آخر فقط، فحوّل الورقة: تحويل Excel إلى CSV يجعل الورقة الأولى ملف CSV بترميز UTF-8 يقرؤه كل برنامج، وتحويل Excel إلى JSON يجعلها قائمة كائنات للبرمجة.'],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }, { text: 'تحويل Excel إلى JSON', path: '/excel-to-json' }],
        },
        {
          heading: 'تحتاج إلى تغيير الملف لا فتحه فقط؟',
          paragraphs: ['إلى جانب تعديل الخلايا في العارض، تعمل هذه الأدوات على المصنفات كاملة في متصفحك، دون رفعها:'],
          list: [
            'تحويل Excel إلى PDF يحفظ الأوراق صفحات PDF بعرض الصفحة، بنص يبقى قابلًا للبحث.',
            'دمج ملفات Excel يجمع عدة مصنفات في ملف xlsx واحد، كل ورقة في تبويب مستقل.',
            'تقسيم ملف Excel يقسّم المصنف إلى ملفات xlsx أصغر حسب الورقة أو عدد الصفوف أو قيم عمود.',
            'إزالة حماية Excel تزيل حماية الأوراق وبنية المصنف من ملف تملكه، فتستطيع تعديله من جديد. أما الملف الذي يحتاج كلمة مرور لفتحه فيبقى مقفلًا دونها.',
            'إصلاح ملف Excel يقرأ المصنف التالف بتساهل ويحفظ بياناته في ملف xlsx جديد سليم.',
            'تحويل Excel إلى Word يجعل ورقة واحدة جدولًا تعدّله في مستند وورد.',
          ],
          links: [{ text: 'تحويل Excel إلى PDF', path: '/excel-to-pdf' }, { text: 'دمج ملفات Excel', path: '/merge-excel' }, { text: 'تقسيم ملف Excel', path: '/split-excel' }, { text: 'إزالة حماية Excel', path: '/unprotect-excel' }, { text: 'إصلاح ملف Excel', path: '/repair-excel' }, { text: 'تحويل Excel إلى Word', path: '/excel-to-word' }],
        },
        {
          heading: 'الصيغ الأقدم والقريبة',
          paragraphs: ['ثلاث امتدادات أخرى تظهر إلى جانب xlsx:'],
          list: [
            'xls صيغة Excel من 97 إلى 2003. يفتحها عارض XLS بالقيم والصيغ وتنسيقات الأرقام، دون أنماط الخلايا.',
            'xlsm مصنف فيه وحدات ماكرو. تفتح العارضات البيانات؛ ولا تعمل وحدات الماكرو خارج Excel، ولا يحتفظ بها OpenAnyDoc عند الحفظ.',
            'ods صيغة جداول OpenDocument. ويفتحها Excel، بحسب قائمة Microsoft للصيغ التي يدعمها Excel (تحققنا منها في 24 نوفمبر 2026)، ويفتحها OpenAnyDoc أيضًا.',
          ],
          links: [{ text: 'عارض XLS', path: '/xls-viewer' }, { text: 'قائمة Microsoft للصيغ التي يدعمها Excel', path: 'https://support.microsoft.com/en-us/office/file-formats-that-are-supported-in-excel-0943ff2c-6014-4e8d-aaea-b83d51d46247' }],
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
      updated: '2026-11-23',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف docx مستند وورد، لكنك لا تحتاج إلى برنامج Microsoft Word لفتحه. يقرؤه مجانًا عارضٌ في المتصفح، وLibreOffice Writer، وGoogle Docs، وApple Pages. ويختلفون في أمرين: هل يُرفع الملف، وكم يحفظون من تخطيطه وتنسيقه.'],
        },
        {
          heading: 'في متصفحك، دون رفع أي شيء',
          paragraphs: ['أفلت الملف على عارض وورد. يُفتح المستند صفحاتٍ بمقاس الصفحة وهوامشها، وبخطوطه وجداوله وصوره وقوائمه وترويساته وتذييلاته وأرقام صفحاته، وتظهر الفقرات والجداول العربية من اليمين إلى اليسار. يمكنك التكبير وملاءمة الصفحة مع شاشتك وتنزيل الملف الأصلي من جديد. يعرض العارض المستندات دون أن يحررها؛ والأدوات المذكورة أدناه تغيّرها في المتصفح. أما المستندات المحمية بكلمة مرور فلا تُفتح.'],
          links: [{ text: 'عارض وورد', path: '/word-viewer' }],
        },
        {
          heading: 'احفظه ملف PDF',
          paragraphs: ['لإرسال المستند أو طباعته، افتحه في عارض وورد وانقر «طباعة / حفظ PDF»، أو استخدم أداة تحويل Word إلى PDF لتحصل على ملف PDF نصه قابل للبحث بخطوة واحدة. ومع «طباعة / حفظ PDF» تُفتح نافذة الطباعة في متصفحك بصفحات المستند وحدها؛ اختر «حفظ بصيغة PDF» (أو Microsoft Print to PDF في ويندوز) طابعةً. وفي الحالتين يُنشأ ملف PDF على حاسوبك، فلا يُرفع المستند لهذا أيضًا.'],
          links: [{ text: 'طباعة / حفظ PDF', path: '/word-viewer' }, { text: 'تحويل Word إلى PDF', path: '/word-to-pdf' }],
        },
        {
          heading: 'تحتاج إلى تغيير الملف لا فتحه فقط؟',
          paragraphs: ['هذه الأدوات تغيّر مستند وورد في متصفحك، دون رفعه:'],
          list: [
            'تحويل Word إلى PDF يحفظ المستند ملف PDF صفحةً صفحة، بنص يبقى قابلًا للتحديد والبحث.',
            'البحث والاستبدال في Word يستبدل كلمة أو عبارة في كل مكان من المستند، الرؤوس والحواشي أيضًا، مع بقاء تنسيقها.',
            'دمج ملفات Word (تجريبي) يجمع مستندين أو أكثر في ملف docx واحد، ويبدأ كل مستند في صفحة جديدة.',
            'إزالة التعليقات من Word تحذف التعليقات وتقبل كل تغيير متعقَّب أو ترفضه، لتحصل على نسخة نظيفة للإرسال.',
            'إزالة بيانات Word الوصفية تعرض من كتب المستند ومن عدّله وحفظه، وتحذف ذلك بنقرة واحدة.',
          ],
          links: [{ text: 'تحويل Word إلى PDF', path: '/word-to-pdf' }, { text: 'البحث والاستبدال في Word', path: '/word-find-replace' }, { text: 'دمج ملفات Word', path: '/merge-word' }, { text: 'إزالة التعليقات من Word', path: '/remove-word-comments' }, { text: 'إزالة بيانات Word الوصفية', path: '/word-metadata' }],
        },
        {
          heading: 'برامج مجانية للحاسوب',
          paragraphs: ['تعمل دون إنترنت وتُبقي الملف على حاسوبك:'],
          list: [
            'LibreOffice Writer (ويندوز وماك ولينكس) يفتح ملفات docx ويحفظها، بحسب متطلبات النظام وصفحة المساعدة عن ملفات Microsoft Office لدى LibreOffice (تحققنا منهما في 24 نوفمبر 2026).',
            'Apple Pages على الماك يفتح ملفات doc وdocx ويمكنه حفظها بصيغة وورد، بحسب دليل Pages من Apple (تحققنا منه في 24 نوفمبر 2026).',
            'على الماك، حدد الملف في Finder واضغط مفتاح المسافة لمعاينة سريعة، كما تصف صفحة Apple عن معاينة الملفات (تحققنا منها في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'متطلبات النظام', path: 'https://www.libreoffice.org/get-help/system-requirements/' }, { text: 'صفحة المساعدة عن ملفات Microsoft Office', path: 'https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_user.html' }, { text: 'دليل Pages', path: 'https://support.apple.com/guide/pages/tancdeedb11c/mac' }, { text: 'صفحة Apple عن معاينة الملفات', path: 'https://support.apple.com/guide/mac-help/mchlgtd_prev01/mac' }],
        },
        {
          heading: 'الحزم على الإنترنت (يُرفع الملف)',
          paragraphs: ['يفتح Google Docs ملف docx الموجود في Google Drive، بحسب صفحة Google عن استخدام ملفات Office (تحققنا منها في 24 نوفمبر 2026). ويحتاج حساب Google، ويُخزَّن المستند على خوادم Google. هذا مقبول لمعظم الملفات، لكن ليس للعقود أو خطابات الموارد البشرية أو أي ملف لا يُسمح لك بمشاركته. وإن لم تكن متأكدًا أن موقعًا ما لا يرفع ملفك، يمكنك أن تتحقق بنفسك.'],
          links: [{ text: 'تتحقق بنفسك', path: '/check-file-upload' }, { text: 'صفحة Google عن استخدام ملفات Office', path: 'https://support.google.com/docs/answer/6055139' }],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['تفتح متصفحات الهاتف OpenAnyDoc بالطريقة نفسها: اضغط «اختر ملفًا» وحدد المستند من «الملفات» أو التنزيلات، فتُلاءم الصفحة عرض الشاشة.'],
        },
        {
          heading: 'الصيغ الأقدم والقريبة',
          paragraphs: ['امتدادات أخرى تظهر إلى جانب docx:'],
          list: [
            'doc صيغة وورد من 97 إلى 2003. لا يفتحها OpenAnyDoc؛ ويفتحها LibreOffice وPages ووورد، ويمكنها حفظها بصيغة docx التي تُفتح هنا بعد ذلك.',
            'docm مستند فيه وحدات ماكرو، وdotx قالب. يفتح عارض وورد كليهما؛ ولا تعمل وحدات الماكرو خارج وورد.',
            'odt صيغة النصوص المفتوحة OpenDocument، وrtf صيغة نص منسق أقدم. ويفتح عارض وورد هنا ملفات odt.',
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
    '/sign-pdf-without-adobe': {
      published: '2026-11-17',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لا تحتاج إلى Adobe Acrobat لتوقيع ملف PDF. يمكنك توقيعه مجانًا في متصفحك باستخدام «توقيع PDF» من OpenAnyDoc دون رفع أي شيء، أو بتطبيق Preview على Mac، أو بأداة Markup على iPhone أو iPad، أو بالرسم على الملف في متصفح Microsoft Edge على Windows. كل هذه الطرق تضع صورة لتوقيعك على الصفحة. وإن طلبت الجهة توقيعًا رقميًا قائمًا على شهادة، فستحتاج أيضًا إلى هوية رقمية، ويمكن لبرنامج LibreOffice أن يطبّقها مجانًا.'],
        },
        {
          heading: 'في متصفحك دون رفع أي شيء',
          paragraphs: ['تعمل أداة «توقيع PDF» على أي حاسوب أو هاتف بمتصفح حديث، ولا يغادر الملف جهازك:'],
          list: [
            'افتح «توقيع PDF» واختر ملفك أو أفلته على الصفحة.',
            'انقر «إنشاء توقيع»، ثم ارسمه بالفأرة أو الإصبع أو القلم، أو اكتب اسمك بأحد ثلاثة أنماط توقيع، أو ارفع صورة لتوقيعك (ويمكن جعل الخلفية البيضاء شفافة).',
            'اسحب التوقيع إلى مكانه، واسحب زاويته لتكبيره أو تصغيره.',
            'لتوقيع كل الصفحات، حدّد التوقيع وانسخه إلى كل الصفحات أو إلى الصفحات التي تكتبها، مثل 1-3، 5.',
            'انقر «حفظ نسخة»، وراجع المعاينة، ونزّل الملف الموقّع. يبقى توقيعك فقط ما دامت الصفحة مفتوحة.',
          ],
          links: [{ text: 'توقيع PDF', path: '/sign-pdf' }],
        },
        {
          heading: 'على Mac: تطبيق Preview',
          paragraphs: ['يوقّع تطبيق Preview، الموجود في كل جهاز Mac، ملفات PDF دون تنزيل أي شيء. افتح الملف في Preview، وأظهر شريط أدوات Markup، وانقر زر التوقيع. أنشئ توقيعًا بلوحة اللمس، أو بكاميرا Mac (وقّع على ورقة بيضاء وارفعها أمامها)، أو بجهاز iPhone أو iPad، ثم انقر التوقيع لوضعه واسحبه إلى مكانه. وتتوفر التواقيع المحفوظة على أجهزة Mac الأخرى التي تستخدم iCloud Drive. وتشرح Apple الخطوات في دليل Preview (تحققنا منه في 24 نوفمبر 2026).'],
          links: [{ text: 'دليل Preview', path: 'https://support.apple.com/ar-ae/guide/preview/prvw35725/mac' }],
        },
        {
          heading: 'على iPhone أو iPad: أداة Markup',
          paragraphs: ['افتح ملف PDF في تطبيق «الملفات»، واضغط زر Markup، ثم زر الإضافة واختر «إضافة توقيع». وقّع باسمك بإصبعك واضغط «تم»، ثم اسحب التوقيع إلى مكانه واسحب إحدى النقاط الزرقاء لتغيير حجمه. ويحفظ iPhone التوقيع للمرة التالية التي تضيف فيها توقيعًا بأداة Markup. وتشرح Apple الخطوات في دليل iPhone (تحققنا منه في 24 نوفمبر 2026).'],
          links: [{ text: 'دليل iPhone', path: 'https://support.apple.com/guide/iphone/fill-forms-sign-documents-create-signatures-iph1d3607e5c/ios' }],
        },
        {
          heading: 'على Windows: متصفح Microsoft Edge',
          paragraphs: ['في متصفح Microsoft Edge قارئ PDF مدمج، وتقول صفحة Microsoft عن قارئ PDF في Edge (تحققنا منها في 24 نوفمبر 2026) إنه يتيح الكتابة بالحبر على ملف PDF لتوقيعه أو تعبئة نموذج. افتح الملف في Edge واكتب توقيعك بالحبر بالفأرة أو القلم أو الإصبع. الطريقة سريعة، لكن التوقيع يُرسم يدويًا في كل مرة؛ أما «توقيع PDF» في المتصفح فيتيح لك كتابته أو رفعه ونسخه إلى كل الصفحات.'],
          links: [{ text: 'صفحة Microsoft عن قارئ PDF في Edge', path: 'https://learn.microsoft.com/en-us/deployedge/microsoft-edge-pdf' }, { text: '«توقيع PDF» في المتصفح', path: '/sign-pdf' }],
        },
        {
          heading: 'صورة التوقيع ليست توقيعًا رقميًا',
          paragraphs: ['كل الطرق السابقة تضيف توقيعًا مرئيًا: صورة لخط يدك على الصفحة، كالتوقيع على ورقة مطبوعة. وهو لا يثبت هوية الموقّع، ويمكن لمن لديه محرر PDF أن ينسخه.', 'أما التوقيع الرقمي القائم على شهادة فمختلف: يستخدم هوية رقمية صادرة لك (من جهة عملك أو بنك أو خدمة حكومية أو جهة إصدار شهادات) ويختم الملف، فيظهر أي تغيير لاحق. وتشترط بعض العقود والنماذج الحكومية والإجراءات المنظّمة هذا النوع.', 'إن كانت لديك هوية رقمية، يمكن لبرنامج LibreOffice توقيع ملف PDF موجود بها مجانًا: افتح LibreOffice، واختر «ملف» ثم «التوقيعات الرقمية» ثم «توقيع ملف PDF موجود» (تحققنا منها في 24 نوفمبر 2026)، واتبع الخطوات. أما كفاية التوقيع المرئي فتعود إلى الجهة التي طلبته؛ وإن كنت غير متأكد فاسألها أو اسأل الفريق القانوني لديك.'],
          links: [{ text: 'توقيع ملف PDF موجود', path: 'https://help.libreoffice.org/latest/ar/text/shared/01/signexistingpdf.html' }],
        },
        {
          heading: 'قبل أن ترسله',
          paragraphs: ['بعض الفحوص توفّر عليك جولة ثانية:'],
          list: [
            'افتح الملف الموقّع مرة أخرى وانظر إلى كل صفحة موقّعة؛ وفي OpenAnyDoc تعرض المعاينة الصفحات الأولى قبل التنزيل.',
            'إن كان الملف نموذجًا، فعبّئ حقوله أولًا بأداة «تعبئة نموذج PDF»، وفعّل «تثبيت عند الحفظ» حتى لا يمكن تغيير الإجابات.',
            'وإن احتجت إلى إرسال عدة مستندات موقّعة في ملف واحد، فاجمعها بأداة «دمج PDF».',
          ],
          links: [{ text: 'تعبئة نموذج PDF', path: '/fill-pdf' }, { text: 'دمج PDF', path: '/merge-pdf' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف ما تحتاجه (دون بيانات شخصية).`],
        },
      ],
    },
    '/pdf-tools-without-upload': {
      published: '2026-11-17',
      updated: '2026-11-25',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['مواقع PDF الشائعة الثلاثة أدناه، iLovePDF وموقع PDF24 وSejda، ترفع ملفك إلى خوادمها وتعالجه هناك ثم تحذفه لاحقًا، بحسب صفحاتها نفسها. وهذا مقبول لكثير من المستندات. أما إن كان الملف لا يجوز أن يغادر جهازك، فاستخدم أداة تعالجه محليًا: OpenAnyDoc في المتصفح، أو تطبيق سطح مكتب يعمل دون اتصال مثل PDF24 Creator على Windows. والمعلومات أدناه من صفحات كل خدمة نفسها، وقد رُوجعت في 25 نوفمبر 2026.'],
        },
        {
          heading: 'كيف تتعامل مواقع PDF الشائعة مع ملفك (رُوجع في 25 نوفمبر 2026)',
          paragraphs: ['ما تقوله كل خدمة في صفحاتها؛ اتبع الروابط للاطلاع على النص الحالي:'],
          list: [
            'iLovePDF: تُرفع الملفات عبر HTTPS وتُحفظ «لمدة أقصاها ساعتان» لتتمكن من تنزيل النتيجة، ثم تُحذف. وتذكر صفحة الأسعار تطبيق سطح مكتب لـ Mac وWindows وتطبيقات للهاتف على iOS وAndroid ضمن خطة Premium (4 دولارات أمريكية شهريًا عند الدفع سنويًا، أو 7 دولارات عند الدفع شهريًا)، لا في الخطة المجانية.',
            'أدوات PDF24 (الموقع): تُحذف الملفات المرفوعة من الخادم بعد ساعة، وتقول صفحة الأسئلة الشائعة إن كل خوادم المعالجة في مراكز بيانات داخل الاتحاد الأوروبي. والأدوات على الإنترنت مجانية «دون قيود». أما PDF24 Creator، تطبيقها على Windows، فيعمل دون اتصال.',
            'Sejda (الموقع): تقول سياسة الخصوصية إن الملفات المرفوعة والناتجة تُخزَّن للمعالجة ثم تُحذف نهائيًا، دون نسخ احتياطية. ولميزات الذكاء الاصطناعي، تقول السياسة إن المحتوى يُرسل إلى معالج فرعي للذكاء الاصطناعي لمعالجة عابرة ولا يُخزَّن. وتذكر السياسة أيضًا Sejda Desktop، وهو تطبيق يُنزَّل على الحاسوب.',
          ],
          links: [{ text: 'iLovePDF', path: 'https://www.ilovepdf.com/help/faq' }, { text: 'صفحة الأسعار', path: 'https://www.ilovepdf.com/pricing' }, { text: 'PDF24', path: 'https://tools.pdf24.org/en/faq' }, { text: 'Sejda', path: 'https://www.sejda.com/privacy' }],
        },
        {
          heading: 'أين تقدّم تلك الخدمات أكثر',
          paragraphs: ['إنصافًا في المقارنة، تقدّم هذه الخدمات أمورًا لا يقدّمها OpenAnyDoc، بحسب صفحاتها المرتبطة أعلاه:'],
          list: [
            'تدمج خطة iLovePDF Premium حتى 500 ملف في دفعة واحدة (25 في الخطة المجانية)، وتعالج حتى 4 غيغابايت في المهمة الواحدة، وتضيف مسارات العمل (Workflows) والتحويل إلى PDF/A والتوقيعات الرقمية. وتطبيقات سطح المكتب والهاتف جزء من Premium أيضًا.',
            'لا حدود لاستخدام أدوات PDF24 المجانية على الإنترنت، ويجلب PDF24 Creator هذه الأدوات إلى حاسوب Windows ويعمل دون اتصال.',
            'لدى Sejda تطبيق سطح مكتب إلى جانب موقعها.',
            'أدوات الخادم لا تعتمد على ذاكرة جهازك، فقد تكون الدفعات الكبيرة جدًا أسهل فيها.',
            'تحافظ أداة ضغط PDF في OpenAnyDoc على دقة الصور، لذلك قد تصغّر أداةٌ تخفّض الدقة ملفَّ PDF الممسوح ضوئيًا أكثر.',
          ],
        },
        {
          heading: 'ما الذي يفعله OpenAnyDoc بشكل مختلف',
          paragraphs: ['تعمل كل أدوات PDF في OpenAnyDoc داخل متصفحك. يُقرأ الملف ويُعدَّل ويُحفظ على جهازك، ولا تسمح سياسة أمان الصفحة إلا بالاتصال بموقعها نفسه، فلا يوجد رفع يحتاج إلى حذف لاحقًا. ويمكنك التحقق بنفسك من لوحة الشبكة في المتصفح أثناء عمل الأداة. وتعمل الأدوات بلا حساب ولا علامة مائية ولا حد يومي، وتقرأ ملفات PDF العربية بشكل صحيح، والكود مفتوح المصدر. وتعمل كل أداة دون اتصال بعد أن تستخدمها مرة مع الاتصال؛ وتحمّل «OCR PDF» و«ترجمة PDF» أيضًا بيانات اللغة من هذا الموقع في أول استخدام.'],
          links: [{ text: 'التحقق بنفسك', path: '/check-file-upload' }],
        },
        {
          heading: 'أدوات PDF التي لا ترفع ملفك أبدًا',
          paragraphs: ['كلٌّ منها يعمل على جهازك:'],
          list: [
            'الدمج والتقسيم وحذف الصفحات واستخراجها وترتيبها وتدويرها.',
            '«تعديل PDF» (مربعات نص وتظليل ورسم وأشكال وصور)، و«توقيع PDF»، و«تعبئة نموذج PDF».',
            'ترقيم الصفحات، والعلامة المائية، والرأس والتذييل.',
            'تحويل صور JPG وPNG وWebP وTIFF وSVG إلى PDF، وتحويل PDF إلى JPG أو PNG أو نص أو استخراج صوره.',
            'جعل ملف PDF الممسوح ضوئيًا قابلًا للبحث بأداة «OCR PDF»، بالعربية أو الإنجليزية.',
            'تحويل ملفات وورد واكسل إلى PDF، وتحويل PDF إلى وورد أو اكسل أو بوربوينت.',
            'حماية PDF بكلمة مرور، أو «فتح قفل PDF» حين تعرف كلمة مروره.',
          ],
          links: [{ text: 'الدمج', path: '/merge-pdf' }, { text: '«تعديل PDF»', path: '/edit-pdf' }, { text: '«توقيع PDF»', path: '/sign-pdf' }, { text: '«تعبئة نموذج PDF»', path: '/fill-pdf' }, { text: 'ترقيم الصفحات', path: '/add-page-numbers' }, { text: 'تحويل صور JPG', path: '/jpg-to-pdf' }, { text: 'تحويل PDF إلى JPG', path: '/pdf-to-jpg' }, { text: '«OCR PDF»', path: '/ocr-pdf' }, { text: 'تحويل ملفات وورد واكسل إلى PDF', path: '/word-to-pdf' }, { text: 'حماية PDF', path: '/protect-pdf' }, { text: '«فتح قفل PDF»', path: '/unlock-pdf' }],
        },
        {
          heading: 'أيّها تختار',
          paragraphs: ['قاعدة بسيطة:'],
          list: [
            'العقود وكشوف الرواتب والهويات والملفات الطبية وملفات العملاء: استخدم أداة تُبقي الملف على جهازك.',
            'تحتاج إلى تصغير حجم ملف PDF: تحفظ أداة ضغط PDF صوره من جديد في متصفحك وتعرض الحجم قبل الضغط وبعده؛ ولإعدادات الدقة استخدم تطبيق سطح مكتب.',
            'تعمل على حاسوب عمل لا تستطيع تثبيت برامج عليه: أداة في المتصفح بلا رفع، مثل OpenAnyDoc، تحل المشكلتين معًا.',
            'لدى جهتك قواعد حول مكان معالجة الملفات: اتبعها، واسأل فريق تقنية المعلومات أو الامتثال عند الشك.',
          ],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف ما تحتاجه (دون بيانات شخصية).`],
        },
      ],
    },
    '/open-txt-file': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف txt نص عادي، فيفتحه أي محرر نصوص ولا تحتاج إلى تثبيت شيء. على ويندوز يُفتح في المفكرة (Notepad)، وعلى الماك في TextEdit، وعلى الآيفون والآيباد في تطبيق «الملفات»، وعلى أندرويد في Google Docs أو Google Drive أو عارض النصوص في مدير الملفات. ويعرضه أيضًا أي متصفح ويب. وإن ظهر النص رموزًا غريبة، فالبرنامج خمّن ترميزًا خاطئًا؛ والحل في الأسفل.'],
        },
        {
          heading: 'على ويندوز',
          paragraphs: ['انقر الملف نقرًا مزدوجًا فيُفتح في المفكرة التي تأتي مع كل إصدارات ويندوز. وإن فتحه برنامج آخر، فانقر الملف بالزر الأيمن واختر «فتح باستخدام» ثم المفكرة، واختر استخدامها دائمًا إن أردتها البرنامج الافتراضي.'],
          list: [
            'تعرض المفكرة النص كما هو تمامًا، بلا تنسيق.',
            'يفتح وورد أيضًا ملفات txt، وإن ظهر النص مشوّهًا يمكنك اختيار الترميز عند فتح الملف، كما تشرح صفحة Microsoft عن اختيار ترميز النص (تحققنا منها في 24 نوفمبر 2026).',
            'ومحررات الشيفرة المجانية مثل Notepad++ وVisual Studio Code تفتح الملفات النصية أيضًا.',
          ],
          links: [{ text: 'صفحة Microsoft عن اختيار ترميز النص', path: 'https://support.microsoft.com/en-us/office/choose-text-encoding-when-you-open-and-save-files-60d59c21-88b5-4006-831c-d536d42fd861' }],
        },
        {
          heading: 'على الماك',
          paragraphs: ['يفتح TextEdit ملفات النص العادي. ولقراءة الملف دون فتح أي تطبيق، حدده في Finder واضغط مفتاح المسافة لمعاينة سريعة. وإن عرض TextEdit حروفًا خاطئة، فافتح TextEdit ثم «الإعدادات» («التفضيلات» في إصدارات macOS الأقدم) ثم «فتح وحفظ»، واضبط ترميز النص العادي عند فتح الملفات على الترميز الصحيح، مثل Unicode (UTF-8)، ثم افتح الملف من جديد. وتشرح Apple هذه الخطوات في صفحتها عن معاينة الملفات وفي دليل TextEdit (تحققنا منهما في 24 نوفمبر 2026).'],
          links: [{ text: 'صفحتها عن معاينة الملفات', path: 'https://support.apple.com/guide/mac-help/mchlgtd_prev01/mac' }, { text: 'دليل TextEdit', path: 'https://support.apple.com/guide/textedit/txted1028/mac' }],
        },
        {
          heading: 'على الهاتف أو الجهاز اللوحي',
          paragraphs: ['على الآيفون أو الآيباد، اضغط الملف في تطبيق «الملفات» لتقرأ نصه؛ ولتعديله شاركه مع تطبيق يحرر النصوص مثل Pages. وعلى أندرويد، اضغط الملف في مدير الملفات أو التنزيلات: تعرض معظم الهواتف النص العادي مباشرة، أو تقترح Google Docs أو Google Drive لفتحه. ويصلح متصفح الهاتف أيضًا: في محرر TXT هنا تُطوى الأدوات في لوحة ويملأ النص الشاشة.'],
          links: [{ text: 'محرر TXT', path: '/txt-viewer' }],
        },
        {
          heading: 'في متصفحك، دون تثبيت أي شيء',
          paragraphs: [
            'يعرض كل متصفح الملف النصي: اسحبه إلى نافذة مفتوحة، أو اضغط Ctrl+O (أو Cmd+O على الماك) واختره. هكذا ترى النص لكنك لا تستطيع تغييره.',
            'لقراءته وتعديله، أفلت الملف على محرر TXT. يُفتح بأرقام الأسطر والبحث، ويتيح لك الكتابة والبحث والاستبدال وترتيب الأسطر وحذف المكرر منها وتغيير حالة الأحرف، وتظهر الأسطر العربية من اليمين إلى اليسار. ويحفظ زر التنزيل نسخة بالترميز ونهايات الأسطر التي تختارها. يقرأ متصفحك الملف بنفسه فلا يُرفع أبدًا، وتواصل الصفحة العمل دون اتصال بعد تحميلها.',
          ],
          links: [{ text: 'محرر TXT', path: '/txt-viewer' }],
        },
        {
          heading: 'حين يظهر النص رموزًا غريبة',
          paragraphs: ['لا يخزّن الملف النصي إلا بايتات. والترميز هو ما يحدد أي بايتات تمثل أي حروف، والملف لا يذكر ترميزه، فيخمّنه كل برنامج. وحين يخطئ التخمين تتحول العربية إلى سلاسل مثل «Ø§Ù„» أو علامات استفهام، وتتشوه الحروف ذات العلامات. ثلاثة ترميزات تغطي كل ملف تقريبًا:'],
          list: [
            'UTF-8 هو المعيار اليوم ويغطي كل اللغات. وتضع بعض البرامج علامة غير مرئية في بداية الملف، هي علامة ترتيب البايتات (BOM)، لتتعرف عليه البرامج الأخرى.',
            'UTF-16 تكتبه بعض برامج ويندوز وأدوات التصدير. والبرنامج الذي يتوقع UTF-8 يعرضه بفراغات بين الحروف أو كلامًا بلا معنى.',
            'Windows-1256 هو الترميز العربي القديم في ويندوز، وما زالت بعض الأنظمة القديمة تنتجه. والبرامج التي تفترض UTF-8 لا تقرأ حروفه العربية.',
          ],
        },
        {
          heading: 'أصلح الترميز دون رفع الملف',
          paragraphs: [
            'أفلت الملف على محرر TXT. يتعرف على UTF-8 بعلامة BOM أو دونها، وعلى UTF-16 وWindows-1256 وWindows-1252، ويعرض الترميز الذي وجده. وإن بقي النص خاطئًا، فاختر ترميزًا آخر في مجموعة «الترميز» وانقر «إعادة الفتح بهذا الترميز».',
            'ولتمرير الملف إلى غيرك بأمان، نزّله بترميز UTF-8 الذي يقرؤه كل برنامج حديث؛ واختر UTF-8 مع BOM إن كان سيُفتح في برامج ويندوز قديمة تخمّن صفحة الترميز القديمة إن لم تجد العلامة.',
          ],
          links: [{ text: 'محرر TXT', path: '/txt-viewer' }],
        },
        {
          heading: 'الملفات النصية الكبيرة جدًا',
          paragraphs: [
            'قد تبلغ ملفات السجلات وتصديرات البيانات مئات الميغابايت. والمحررات البسيطة تحمّل الملف كله دفعة واحدة، فقد تبطئ أو تتوقف عن الاستجابة مع الملفات الكبيرة جدًا.',
            'جُرّب محرر TXT على ملف حجمه 46 ميغابايت ظهرت أسطره الأولى في أقل من نصف ثانية. والملفات التي تتجاوز 50 ميغابايت يظهر قبلها تنبيه، والملف الذي يزيد على مليوني حرف تقريبًا يُفتح في عرض قراءة سريع لا يرسم إلا الأسطر الظاهرة على الشاشة، بينما يعمل البحث وباقي الأدوات على النص كله. وما بعد ذلك تحدده ذاكرة جهازك. وإن كان الملف في الحقيقة جدول قيم مفصولة بفواصل، فعارض ملفات CSV الكبيرة أنسب له.',
          ],
          links: [{ text: 'محرر TXT', path: '/txt-viewer' }, { text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'ما ملف txt؟',
          paragraphs: ['لا يحمل ملف txt إلا حروفًا: أحرفًا وأرقامًا ومسافات وفواصل أسطر. لا خط عريض ولا خطوط ولا صور ولا تخطيط صفحة، ولهذا يفتحه كل جهاز، ويُستخدم للملاحظات والسجلات والقوائم وتمرير البيانات بين البرامج. وينتهي كل سطر بفاصل سطر غير مرئي: يكتب ويندوز CRLF، ويكتب الماك ولينكس LF. تقرأ معظم المحررات النوعين، ويستطيع محرر TXT الحفظ بأي منهما. والملفات ذات الامتدادات الأخرى مثل log وmd نصوص عادية أيضًا، تُفتح في أي محرر نصوص بالطريقة نفسها.'],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف ما تراه حين تفتح الملف (دون بيانات شخصية).`],
        },
      ],
    },
    '/open-csv-without-excel': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف CSV نص عادي: كل صف في سطر، والقيم مفصولة بفواصل. واكسل ليس إلا واحدًا من برامج كثيرة تقرؤه. يفتحه مجانًا عارضٌ في المتصفح، وGoogle Sheets، وLibreOffice Calc، وApple Numbers، بل ومحرر النصوص أيضًا. ويختلفون في ثلاثة أمور: هل يُرفع الملف، وما حجم الملفات التي يتحملونها، وهل يصيبون الفاصل والترميز.'],
        },
        {
          heading: 'في متصفحك، دون رفع أي شيء',
          paragraphs: ['أفلت الملف على عارض CSV. يكتشف الفاصل (فاصلة أو فاصلة منقوطة أو علامة جدولة أو خط عمودي) والترميز تلقائيًا، ويعرض الصفوف جدولًا يمكنك ترتيبه وتصفيته والبحث فيه وتعديله، مع التراجع والإعادة. ويمكنك تشغيل استعلامات SQL على الجدول، ورسم مخطط للصفوف المعروضة، وتنزيل الملف من جديد بصيغة CSV، أو مصنف اكسل حين يطلبه أحد. يقرأ متصفحك الملف بنفسه، فلا تغادر قوائم العملاء والتصديرات حاسوبك، وتبقى الأصفار البادئة والأرقام الطويلة كما كُتبت.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'برامج جداول مجانية',
          paragraphs: ['كلٌّ منها يفتح ملف CSV ورقةً:'],
          list: [
            'LibreOffice Calc (ويندوز وماك ولينكس) يعرض نافذة استيراد أولًا، تختار فيها مجموعة الأحرف والفاصل قبل تحميل البيانات.',
            'Apple Numbers (ماك وآيفون وآيباد) يفتح ملف CSV مباشرة ويمكنه تصديره ملف اكسل.',
            'Google Sheets يفتح ملف CSV بعد رفعه إلى Google Drive أو جلبه عبر «ملف» ثم «استيراد». يحتاج حسابًا ويحفظ الملف على خوادم Google، وهذا مقبول لمعظم الملفات لكن ليس لكشوف الرواتب أو بيانات العملاء.',
          ],
        },
        {
          heading: 'في محرر نصوص',
          paragraphs: ['تعرض المفكرة أو TextEdit أو أي محرر شيفرة الملف الخام: كل سطر صف، والفواصل ظاهرة. إنها أسرع طريقة لمعرفة الفاصل الذي يستخدمه الملف، وهل يحمل السطر الأول العناوين، وهل القيم محاطة بعلامات اقتباس. لكن الجدول العريض صعب القراءة بهذه الطريقة، وحذف فاصلة واحدة يزيح كل القيم بعدها إلى عمود خاطئ، فعدّل بحذر.'],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['تفتح متصفحات الهاتف عارض CSV بالطريقة نفسها: اضغط «اختر ملفًا» وحدد ملف CSV من «الملفات» أو التنزيلات. وعلى الآيفون والآيباد يفتحه Numbers جدولًا، وعلى أندرويد يفتحه تطبيق Google Sheets بحساب Google.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'ملفات أكبر من أن يفتحها اكسل',
          paragraphs: ['تتوقف ورقة اكسل عند 1,048,576 صفًا. أما عارض ملفات CSV الكبيرة فلا حد للصفوف فيه: يُفتح ملف من 120,000 صف في أقل من ثانية، والحد الحقيقي هو ذاكرة جهازك، مع تنبيه فوق 50 ميغابايت. ولماذا يقطع اكسل الملف، وما الطرق الأخرى لتجاوز ذلك، تجده في دليل ملف CSV أكبر من أن يفتحه Excel.'],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }, { text: 'ملف CSV أكبر من أن يفتحه Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'الملف يُفتح في عمود واحد',
          paragraphs: ['إن استقر كل صف في العمود A، فالملف يستخدم فاصلًا لا يتوقعه برنامجك: فواصل عادية حيث تستخدم منطقتك الفاصلة المنقوطة، أو العكس. يحل المشكلةَ عارضٌ يكتشف الفاصل، ونافذة الاستيراد في LibreOffice، والاستيراد من نص في اكسل نفسه؛ ويشرح دليل ملف CSV يُفتح في عمود واحد كل حل. ولإعادة كتابة الملف بالفاصل الذي تحتاجه، استخدم أداة تغيير فاصل CSV.'],
          links: [{ text: 'ملف CSV يُفتح في عمود واحد', path: '/csv-opens-in-one-column' }, { text: 'تغيير فاصل CSV', path: '/change-csv-delimiter' }],
        },
        {
          heading: 'العربية تتحول إلى رموز',
          paragraphs: ['حين تظهر العربية على شكل «Ø§Ù„» أو علامات استفهام، فالبرنامج قرأ ملف UTF-8 بترميز خاطئ. يقرأ عارض CSV ملفات UTF-8 وUTF-16 وملفات Windows-1256 وWindows-1252 القديمة قراءة صحيحة، ويعرض العربية من اليمين إلى اليسار. ولاكسل نفسه، يشرح دليل العربية المشوّهة في ملف CSV كيف تصنع نسخة تُفتح صحيحة بنقرة مزدوجة.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }, { text: 'العربية المشوّهة في ملف CSV', path: '/fix-arabic-csv-in-excel' }],
        },
        {
          heading: 'ما يحمله ملف CSV وما لا يحمله',
          paragraphs: ['لا يحمل ملف CSV إلا القيم: لا صيغ ولا ألوان ولا عرض أعمدة ولا أوراق إضافية. وكل ما تنسّقه في برنامج جداول يضيع حين تحفظه CSV من جديد، فاحتفظ بمصنف حين تحتاج إلى ذلك، واستخدم CSV لتمرير البيانات بين البرامج. ويحمل السطر الأول عادةً أسماء الأعمدة، والقيمة التي تحتوي على الفاصل أو على فاصل سطر تُحاط بعلامتي اقتباس مزدوجتين.'],
        },
        {
          heading: 'تحتاج ملف اكسل في النهاية؟',
          paragraphs: ['إن طلب زميل أو نظام ملف xlsx، فأداة تحويل CSV إلى Excel تجعل الملف مصنفًا في متصفحك، بصف عناوين عريض، وأرقام حقيقية، وقيم مثل 007 والمعرّفات الطويلة محفوظة نصًا فلا يضيع أي رقم. لا تحتاج إلى تثبيت اكسل لذلك، ولا يُرفع ملف CSV.'],
          links: [{ text: 'تحويل CSV إلى Excel', path: '/csv-to-excel' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف الملف (دون بيانات شخصية).`],
        },
      ],
    },
    '/open-pptx-without-powerpoint': {
      published: '2026-11-20',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف pptx عرض تقديمي من بوربوينت، لكنك لا تحتاج إلى بوربوينت لفتحه. يفتحه مجانًا عارضٌ في المتصفح، وGoogle Slides، وLibreOffice Impress، وApple Keynote. وقد أوقفت مايكروسوفت برنامج PowerPoint Viewer المستقل في 30 أبريل 2018، بحسب صفحة Microsoft عن مشاهدة عرض تقديمي دون PowerPoint (تحققنا منها في 24 نوفمبر 2026)، فهذه هي الخيارات اليوم. ويختلفون في هل يُرفع الملف، وهل يمكنك تعديله، وما مدى دقة رسمهم للشرائح.'],
          links: [{ text: 'صفحة Microsoft عن مشاهدة عرض تقديمي دون PowerPoint', path: 'https://support.microsoft.com/en-us/office/view-a-presentation-without-powerpoint-2f1077ab-9a4e-41ba-9f75-d55bd9b231a6' }],
        },
        {
          heading: 'في متصفحك، دون رفع أي شيء',
          paragraphs: ['أفلت الملف على عارض PowerPoint. إنه تجريبي يعرض العروض التقديمية ولا يعدّلها. ما يفعله:'],
          list: [
            'يعرض الشرائح بنصوصها وخطوطها وصورها وجداولها وأشكالها وخلفياتها، وتتنقل بينها بالصور المصغّرة أو زرّي السابق والتالي أو مفاتيح الأسهم.',
            'يعرض ملاحظات المتحدث تحت الشريحة، وشبكة كل الشرائح للانتقال إلى أي منها.',
            'يقدّم العرض بملء الشاشة، أو في عرض المقدِّم بالشريحة الحالية والتالية وملاحظاتك ومؤقت، بينما يرى الحضور الشريحة في نافذة ثانية.',
            'يبحث في نصوص الشرائح والملاحظات، ويطبع شريحة في كل صفحة، ويحفظ الشرائح ملف PDF أو صور PNG.',
            'لا يشغّل الحركات والانتقالات، ويبسّط بعض التأثيرات والمخططات.',
          ],
          links: [{ text: 'عارض PowerPoint', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'برامج مجانية تعدّل أيضًا',
          paragraphs: ['إن احتجت إلى تغيير الشرائح، فهذه تفتح pptx وتحفظه:'],
          list: [
            'LibreOffice Impress (ويندوز وماك ولينكس) يفتح pptx ويعدّله ويحفظه، ويفتح ملفات ppt القديمة أيضًا.',
            'Apple Keynote (ماك وآيفون وآيباد) يفتح pptx ويمكنه التصدير بصيغة بوربوينت من جديد؛ وقد تُستبدل بعض الخطوط.',
            'يفتح Google Slides ملف pptx بعد رفعه إلى Google Drive، ويفعل PowerPoint للويب الشيء نفسه مع OneDrive. كلاهما يحتاج حسابًا ويخزّن العرض على خوادمه، وهذا مقبول لمعظم العروض لكن ليس للخطط أو الأرقام غير المعلنة.',
          ],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['تفتح متصفحات الهاتف عارض PowerPoint بالطريقة نفسها: اضغط «اختر ملفًا» وحدد العرض؛ تملأ الشريحة عرض الشاشة وتنتقل الأزرار بين الشرائح. وتقول مايكروسوفت إن تطبيق PowerPoint المجاني للهاتف يفتح العروض أيضًا.'],
          links: [{ text: 'عارض PowerPoint', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'ملفات ppt القديمة والصيغ القريبة',
          paragraphs: ['امتداد ppt هو صيغة بوربوينت من 97 إلى 2003، وهو نوع مختلف من الملفات لا يفتحه عارض OpenAnyDoc. افتحه في LibreOffice Impress أو بوربوينت واحفظه بصيغة pptx، فيُفتح الملف الجديد هنا. أما هذه الامتدادات القريبة فيفتحها العارض:'],
          list: [
            'ppsx عرض شرائح: المحتوى نفسه الذي في pptx، لكنه يبدأ العرض فور فتحه في بوربوينت.',
            'potx قالب تُصنع منه العروض الجديدة.',
            'pptm عرض فيه وحدات ماكرو. تُفتح الشرائح، ولا تعمل وحدات الماكرو أبدًا.',
          ],
        },
        {
          heading: 'تحتاج الكلمات لا الشرائح؟',
          paragraphs: ['لتقتبس من عرض في تقرير أو تبحث فيه أو تلصقه في محادثة ذكاء اصطناعي، حوّله إلى نص. أداة تحويل PowerPoint إلى Markdown تكتب عنوان كل شريحة ونقاطها، وتحتها ملاحظات المتحدث، مخططًا مرتبًا؛ وتُترك الصور والمخططات والتخطيط. ويستطيع العارض نفسه أيضًا تصدير مخطط بالعناوين والنصوص والملاحظات بصيغة Markdown أو نص عادي.'],
          links: [{ text: 'تحويل PowerPoint إلى Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'تحتاج إلى تغيير الملف لا فتحه فقط؟',
          paragraphs: ['لا يعدّل العارض الشرائح، لكن هذه الأدوات تعمل على العرض كاملًا في متصفحك، دون رفعه:'],
          list: [
            'تحويل PowerPoint إلى PDF يحفظ العرض ملف PDF، صفحة لكل شريحة، بنص يبقى قابلًا للتحديد والبحث.',
            'دمج عروض PowerPoint (تجريبي) يجمع عرضين أو أكثر في ملف pptx واحد بالترتيب الذي تختاره.',
            'تقسيم عرض PowerPoint يقسّم العرض إلى عدة ملفات pptx، ملف لكل شريحة أو حسب نطاقات الشرائح التي تكتبها.',
            'البحث في PowerPoint يجد كلمة في كل الشرائح وملاحظات المتحدث، مع رقم الشريحة لكل نتيجة.',
            'علامة مائية على PowerPoint تضع نصًا مثل «سري» أو «مسودة» على كل شريحة.',
          ],
          links: [{ text: 'تحويل PowerPoint إلى PDF', path: '/pptx-to-pdf' }, { text: 'دمج عروض PowerPoint', path: '/merge-pptx' }, { text: 'تقسيم عرض PowerPoint', path: '/split-pptx' }, { text: 'البحث في PowerPoint', path: '/search-pptx' }, { text: 'علامة مائية على PowerPoint', path: '/watermark-pptx' }],
        },
        {
          heading: 'أيّها تختار',
          paragraphs: ['قاعدة بسيطة:'],
          list: [
            'تحتاج فقط إلى قراءة الشرائح أو تقديمها، والعرض سري: عارض في المتصفح لا يرفعه.',
            'تحتاج إلى تغيير الشرائح: LibreOffice Impress أو Keynote، على حاسوبك.',
            'تعمل على العرض مع آخرين: Google Slides أو PowerPoint للويب، إن كان مسموحًا بتخزين المحتوى هناك.',
            'تحتاج الكلمات فقط: تحويل PowerPoint إلى Markdown.',
          ],
          links: [{ text: 'تحويل PowerPoint إلى Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'ما قد يبدو مختلفًا',
          paragraphs: ['بوربوينت وحده يرسم كل شيء كما هو تمامًا. البرامج الأخرى، ومنها OpenAnyDoc، تستبدل الخطوط غير المثبتة على جهازك بخطوط قريبة منها، فقد تلتف الأسطر بطريقة مختلفة. وفي العارض هنا يظهر SmartArt كما رسمه بوربوينت آخر مرة، وتُرسم المخططات تقريبيًا، وقد لا يعمل الفيديو المضمّن، والشريحة التي لا يستطيع رسمها بعد تعرض ملاحظة بدل تخطيط مكسور، دون أن تتأثر بقية الشرائح. وإن كان المظهر الدقيق مهمًا، فاطلب من المرسل نسخة PDF يفتحها كل متصفح.'],
          links: [{ text: 'يفتحها كل متصفح', path: '/open-pdf-without-adobe' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف العرض (دون بيانات شخصية).`],
        },
      ],
    },
    '/open-pdf-without-adobe': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['لا تحتاج إلى Adobe Acrobat أو Adobe Reader لفتح ملف بي دي اف. يفتحه كل متصفح ويب حديث، ومنها Chrome وEdge وFirefox وSafari: اسحب الملف إلى النافذة. ويفتح الماك ملفات PDF في تطبيق «معاينة» (Preview)، والآيفون والآيباد في تطبيق «الملفات» أو «الكتب»، وهاتف أندرويد في تطبيق Google Drive. كلها مجانية ومثبتة عادةً من قبل.'],
        },
        {
          heading: 'على الحاسوب',
          paragraphs: ['ما يوجد في كل نظام من قبل:'],
          list: [
            'ويندوز: في Microsoft Edge قارئ PDF مدمج؛ وتذكر صفحة Microsoft عن قارئ PDF في Edge التكبير والبحث والتظليل والتعبئة الأساسية للنماذج (تحققنا منها في 24 نوفمبر 2026).',
            'ماك: يفتح تطبيق «معاينة» ملفات PDF، ويعبّئ النماذج، ويضيف نصوصًا وتواقيع، ويعيد ترتيب الصفحات.',
            'لينكس: عارض المستندات الذي يأتي مع معظم أسطح المكتب يفتح ملفات PDF.',
            'أي نظام: يعرض Chrome وFirefox وSafari ملف PDF في تبويب. اسحب الملف إلى النافذة، أو اضغط Ctrl+O (أو Cmd+O على الماك) واختره.',
          ],
        },
        {
          heading: 'في متصفحك هنا، دون رفع أي شيء',
          paragraphs: ['أفلت الملف على عارض PDF. يعرض كل الصفحات في تمرير واحد مع صور مصغّرة وعدّاد للصفحات، وتكبير من 50% إلى 400%، وملاءمة العرض، والتدوير، ويبحث في النص مع إبراز النتائج، والعربية منه، بترتيب القراءة. والملف المحمي بكلمة مرور يطلب كلمته، التي لا تُستخدم إلا في ذلك التبويب. يبدو العارض واحدًا على كل جهاز، ويواصل العمل دون اتصال بعد تحميل الصفحة، ويقرأ متصفحك الملف بنفسه فلا يُرفع أبدًا.'],
          links: [{ text: 'عارض PDF', path: '/pdf-viewer' }],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['على الآيفون أو الآيباد، اضغط ملف PDF في تطبيق «الملفات» لتقرأه؛ ويضيف زر «التوصيف» (Markup) نصًا وتوقيعًا، ويحفظ تطبيق «الكتب» ملفات PDF في مكتبة. وعلى أندرويد يفتح تطبيق Google Drive ملفات PDF من التنزيلات أو البريد. ويعمل عارض PDF هنا في متصفح الهاتف أيضًا، وتُفتح صور الصفحات المصغّرة من شريط الأدوات.'],
          links: [{ text: 'عارض PDF', path: '/pdf-viewer' }],
        },
        {
          heading: 'لماذا لا يُفتح ملف PDF عندي؟',
          paragraphs: ['معظم ملفات PDF التي ترفض أن تُفتح، أو تُفتح بشكل خاطئ، فيها إحدى هذه المشكلات:'],
          list: [
            'يطلب كلمة مرور. الملف مشفّر: اكتب كلمة المرور في العارض. وإن كنت تعرفها وتريد نسخة بدونها، فأداة فتح قفل PDF تزيلها على جهازك. لا تخمّن الأداة كلمات المرور ولا تكسرها، فاستخدمها فقط للملفات المسموح لك بفتح قفلها.',
            'الملف تالف. التنزيل الذي توقف مبكرًا، أو المرفق المعطوب، أو التصدير الخاطئ، يترك ملفًا تقول عنه العارضات إنه تالف. أداة إصلاح PDF تعيد بناء فهرس الملف وتحفظ الصفحات السليمة؛ أما الصفحة الناقصة من الملف فلا يمكن استعادتها.',
            'يُفتح، لكنك لا تستطيع تحديد النص أو البحث فيه. الملف ممسوح ضوئيًا، فكل صفحة صورة. أداة التعرّف الضوئي على نص PDF تقرأ الكلمات بالعربية أو الإنجليزية وتعطيك ملف PDF يمكنك البحث فيه وتحديد نصه ونسخه.',
            'ليس ملف PDF في الحقيقة. الملف الذي غُيّر اسمه إلى pdf، أو الذي لا يتجاوز بضعة بايتات، لا يفتحه أي عارض PDF؛ نزّله من جديد أو اطلب من المرسل نسخة جديدة.',
          ],
          links: [{ text: 'فتح قفل PDF', path: '/unlock-pdf' }, { text: 'إصلاح PDF', path: '/repair-pdf' }, { text: 'التعرّف الضوئي على نص PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'عبّئ ملف PDF ووقّعه بدون Adobe',
          paragraphs: [
            'يعبّئ Microsoft Edge النماذج الأساسية، وكذلك «معاينة» على الماك. ولتعبئة نموذج وحفظ نسخة نظيفة دون رفعه، استخدم أداة تعبئة نموذج PDF: تتعامل مع حقول النص والمربعات متعددة الأسطر ومربعات الاختيار وأزرار الخيارات والقوائم المنسدلة، بالعربية أو الإنجليزية، ويمكنها تثبيت الإجابات على الصفحة. أما نماذج XFA، وهي صيغة قديمة من Adobe، فلا تدعمها الأداة، وتقول صفحة Microsoft عن قارئ PDF في Edge إن Edge لا يدعمها أيضًا (تحققنا منها في 24 نوفمبر 2026).',
            'وللتوقيع، يشرح دليل توقيع ملف PDF بدون Adobe الخيارات المجانية على الحاسوب والهاتف، ومتى لا تكفي صورة التوقيع.',
          ],
          links: [{ text: 'تعبئة نموذج PDF', path: '/fill-pdf' }, { text: 'توقيع ملف PDF بدون Adobe', path: '/sign-pdf-without-adobe' }],
        },
        {
          heading: 'اختر التطبيق الذي يفتح ملفات PDF',
          paragraphs: ['إن ظلت ملفات PDF تُفتح في برنامج لا تريده، فغيّر البرنامج الافتراضي. على ويندوز، اختر التطبيق الافتراضي لملفات pdf من «الإعدادات» ضمن «التطبيقات الافتراضية»، كما تصف صفحة Microsoft عن تغيير البرامج الافتراضية. وعلى الماك، حدد ملف PDF في Finder واختر «ملف» ثم «معلومات»، وحدد التطبيق تحت «فتح باستخدام» وانقر «تغيير الكل»، كما يصف دليل مستخدم Mac من Apple (تحققنا منهما في 24 نوفمبر 2026). وعلى الهاتف تتيح لك قائمة المشاركة أو الفتح اختيار التطبيق في كل مرة.'],
          links: [{ text: 'صفحة Microsoft عن تغيير البرامج الافتراضية', path: 'https://support.microsoft.com/en-gb/windows/change-default-programs-in-windows-27af8dcd-6d1c-44d0-a999-80d2c29b4f15' }, { text: 'دليل مستخدم Mac', path: 'https://support.apple.com/guide/mac-help/mh35597/mac' }],
        },
        {
          heading: 'هل تحتاج إلى Acrobat أصلًا؟',
          paragraphs: ['برنامج Adobe Acrobat Reader مجاني أيضًا، وتقول صفحة Acrobat Reader لدى Adobe إن تعديل النصوص والصور يحتاج إلى خطة Acrobat مدفوعة (تحققنا منها في 24 نوفمبر 2026). ولا تحتاج إلى أيٍّ منهما لقراءة ملف PDF أو طباعته أو البحث فيه أو تعبئته أو توقيعه، ولا لدمج صفحاته وتقسيمها وتدويرها وترقيمها: المتصفحات وأدوات PDF المجانية هنا تفعل ذلك على جهازك.'],
          links: [{ text: 'أدوات PDF', path: '/pdf-tools' }, { text: 'صفحة Acrobat Reader لدى Adobe', path: 'https://www.adobe.com/acrobat/pdf-reader.html' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف ما يحدث حين تفتح الملف (دون بيانات شخصية).`],
        },
      ],
    },
    '/fix-arabic-text-copied-from-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['يظهر النص العربي مقلوبًا أو بحروف مقطّعة لأن ملف بي دي اف لا يحفظ جُملًا. إنه يحفظ شكل كل حرف ومكانه على الصفحة، وكثير من برامج قراءة PDF تنسخ هذه الأشكال بترتيب ظهورها على الصفحة من اليسار إلى اليمين، فتخرج الكلمات معكوسة أو حروفها منفصلة. افتح الملف في عارض PDF في OpenAnyDoc، أو احفظ نصه بأداة تحويل PDF إلى نص أو تحويل PDF إلى Word: كلها تعيد بناء الأسطر العربية بترتيب القراءة قبل أن تنسخها.'],
          links: [{ text: 'عارض PDF', path: '/pdf-viewer' }, { text: 'تحويل PDF إلى نص', path: '/pdf-to-text' }, { text: 'تحويل PDF إلى Word', path: '/pdf-to-word' }],
        },
        {
          heading: 'لماذا يحدث ذلك؟',
          paragraphs: [
            'يحفظ مستند وورد أو صفحة الويب النص كما كُتب: الحروف بترتيب كتابتها، ثم يتولى البرنامج تشكيلها وترتيبها على الشاشة. أما ملف PDF فأقرب إلى ورقة مطبوعة: يحفظ أشكال الحروف المرسومة ومكان كل منها على الصفحة، ولا يحفظ عن النص الذي وراءها إلا ما اختار البرنامج الذي أنشأ الملف أن يكتبه.',
            'وتبقى الصفحة سليمة المظهر لأن كل شكل مرسوم في مكانه، ولا تظهر المشكلة إلا حين يخرج النص من الملف، وكل برنامج يعيد الأشكال إلى نص بطريقته. وفي العربية قد يحدث ثلاثة أخطاء:',
          ],
          list: [
            'حروف محفوظة بترتيب ظهورها. بعض البرامج تضع كل حرف عربي وحده، من اليسار إلى اليمين كما يظهر على الصفحة. والقارئ الذي ينسخها بهذا الترتيب يعطيك كل كلمة معكوسة، وكلمات السطر من آخرها إلى أولها.',
            'أشكال متصلة بدل الحروف. يتغير شكل الحرف العربي في أول الكلمة ووسطها وآخرها، وبعض ملفات PDF تسجّل هذه الأشكال، وتُسمى presentation forms، بدل الحروف العادية. فيبدو النص الملصوق سليمًا لكنه لا يطابق ما تبحث عنه، أو تظهر حروفه غير متصلة.',
            'أسطر مختلطة. الرقم أو التاريخ أو الكلمة الإنجليزية داخل جملة عربية تُقرأ من اليسار إلى اليمين، والأقواس تنعكس في النص العربي. والقارئ الذي يتجاهل الاتجاه يضعها في غير مكانها أو يقلب الأقواس.',
          ],
        },
        {
          heading: 'انسخ العربية بترتيب القراءة دون رفع الملف',
          paragraphs: [
            'تعيد أدوات PDF في OpenAnyDoc بناء الأسطر العربية قبل أن يصلك النص. فإذا كان معظم السطر عربيًا، رُتّبت أجزاؤه من اليمين إلى اليسار بترتيب القراءة، وبقيت الكلمة الإنجليزية أو الرقم داخله بترتيبه، وعادت الأقواس إلى الحرف الذي كُتب، وصارت الأشكال المتصلة حروفًا عربية عادية. اختر الأداة التي تناسب حاجتك:',
          ],
          list: [
            'لبضعة أسطر: افتح الملف في عارض PDF، وحدد النص وانسخه. ويبحث Ctrl+F (أو Cmd+F على الماك) في النص العربي ويبرز النتائج.',
            'للنص كله: تحفظ أداة تحويل PDF إلى نص كل الصفحات في ملف txt، والعربية بترتيب القراءة، مع علامة اختيارية عند بداية كل صفحة.',
            'لنص تريد تعديله: تكتب أداة تحويل PDF إلى Word ملف docx قابلًا للتعديل، فقراته العربية من اليمين إلى اليسار، مع العناوين والقوائم والصور.',
          ],
          links: [{ text: 'عارض PDF', path: '/pdf-viewer' }, { text: 'تحويل PDF إلى نص', path: '/pdf-to-text' }, { text: 'تحويل PDF إلى Word', path: '/pdf-to-word' }],
        },
        {
          heading: 'ملفاتك الخاصة تبقى على جهازك',
          paragraphs: ['يقرأ متصفحك ملف PDF بنفسه ولا يرفعه أبدًا، فيصلح هذا للعقود وكشوف الحساب وغيرها من المستندات التي لا ترسلها إلى موقع. ويمكنك أن تتحقق من أن الملف لا يُرفع من لوحة الشبكة في متصفحك. وبعد تحميل الصفحة يواصل العارض العمل دون اتصال بالإنترنت، وكذلك أداة تحويل PDF إلى نص بعد أن تستخدمها مرة.'],
          links: [{ text: 'تتحقق من أن الملف لا يُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'لا شيء يمكن تحديده؟ الملف ممسوح ضوئيًا',
          paragraphs: [
            'ملف PDF الممسوح ضوئيًا، أو المصنوع من صور الهاتف، يحمل صورة لكل صفحة ولا نص فيه أصلًا. لا يمكن تحديد شيء، ولا يجد البحث شيئًا، وتخبرك أداة تحويل PDF إلى نص أنها لم تجد نصًا. شغّل أداة التعرّف الضوئي على النص أولًا: تقرأ كلمات كل صفحة، بالعربية أو الإنجليزية أو كلتيهما، وتضعها فوق الصفحة نصًا غير مرئي، فتبقى الصفحة كما كانت. ثم انسخ من الملف الجديد في العارض، أو افتحه في أداة تحويل PDF إلى نص أو إلى Word.',
            'يخطئ التعرّف على النص أحيانًا، ويكثر خطؤه في النص الباهت أو الصغير أو المكتوب بخط اليد، فراجع الأسماء والأرقام والتواريخ مقابل الصفحة قبل أن تعتمد عليها.',
          ],
          links: [{ text: 'التعرّف الضوئي على النص', path: '/ocr-pdf' }],
        },
        {
          heading: 'تحقّق من النتيجة بنفسك',
          paragraphs: ['اختبار لا يأخذ دقيقة يخبرك هل النسخ سليم:'],
          list: [
            'اختر سطرًا واحفظ أول كلمة فيه، وهي التي على طرفه الأيمن. انسخ السطر والصقه في ملاحظة أو بريد.',
            'يجب أن تأتي تلك الكلمة في أول السطر الملصوق (على اليمين في محرر عربي)، وأن تتصل حروف كل كلمة كما تتصل على الصفحة.',
            'إن جاءت الكلمة الأخيرة أولًا، أو ظهرت الحروف منفصلة، فالنسخ مقلوب أو مكسور: انسخه من جديد من عارض PDF هنا.',
            'ابحث في الملف عن كلمة عربية تراها على الصفحة. إن وجدها العارض وأبرزها، فالنص الذي داخل الملف صالح للاستخدام.',
          ],
        },
        {
          heading: 'ما لا يمكن إصلاحه',
          paragraphs: ['حدود يحسن أن تعرفها قبل أن تبدأ:'],
          list: [
            'تخرج الجداول أسطرًا من النص لا جداول. تفصل أداة التحويل إلى Word أعمدة السطر بعلامات جدولة، وتقرأ أداة تحويل PDF إلى Excel الجداول في خلايا.',
            'ملف PDF الذي يحتاج إلى كلمة مرور لفتحه يجب فك قفله أولًا، وأداة فتح قفل PDF تزيل كلمة المرور إن كنت تعرفها.',
            'إن ظهرت حروف الملف رموزًا عند النسخ في كل برنامج، فلا نص صالحًا وراءها. عامله معاملة الملف الممسوح: تترك أداة التعرّف الضوئي الصفحات التي فيها نص كما هي ما لم تختر غير ذلك، فاختر أن تقرأ تلك الصفحات أيضًا.',
          ],
          links: [{ text: 'تحويل PDF إلى Excel', path: '/pdf-to-excel' }, { text: 'فتح قفل PDF', path: '/unlock-pdf' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف كيف يظهر النص المنسوخ (دون بيانات شخصية).`],
        },
      ],
    },
    '/cant-edit-text-in-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['ملف بي دي اف صفحة جاهزة لا مستند تكتب فيه: يحفظ كل حرف في مكان ثابت، ولا فقرات فيه تعيد ترتيب أسطرها حين تغيّر كلمة، ولهذا لا يحدث شيء حين تنقر على النص في معظم البرامج. لتغيير كلمات قليلة، غطّها واكتب فوقها بأداة تعديل PDF. ولإعادة كتابة فقرات كاملة، حوّل الملف إلى وورد وعدّله هناك ثم احفظه PDF من جديد.'],
          links: [{ text: 'تعديل PDF', path: '/edit-pdf' }],
        },
        {
          heading: 'لماذا لا توجد فقرات قابلة للتعديل في PDF؟',
          paragraphs: [
            'يحفظ معالج النصوص النص فقرات: تغيّر كلمة فيعاد ترتيب السطر، وتطول الفقرة، وتنزل الصفحة التالية. أما ملف PDF فمصنوع لعكس ذلك: أن يبدو واحدًا على كل شاشة وكل طابعة. فحين يُنشأ، يُقسَّم النص إلى أسطر وحروف، ويوضع كل منها في نقطة ثابتة على الصفحة بخط معيّن. لا توجد فقرة تعرف أين تنتهي، فلا شيء يعاد ترتيبه.',
            'وحتى البرامج التي تغيّر نص PDF الأصلي تعمل سطرًا سطرًا، وتحتاج إلى الخط الذي استُخدم. وكثيرًا ما يحمل الملف من الخط الحروف التي يستخدمها المستند فقط، فقد لا يجد الحرف الجديد شكلًا يُرسم به.',
          ],
        },
        {
          heading: 'أسباب أخرى تمنع التعديل',
          paragraphs: ['إن لم تستطع حتى تحديد النص، أو قال البرنامج إن التعديل غير مسموح، فالسبب واحد مما يلي:'],
          list: [
            'الملف ممسوح ضوئيًا أو صورة. كل صفحة صورة، فلا نص يُحدَّد. جرّب تحديد كلمة: إن لم يتلوّن شيء، فهذا هو السبب.',
            'الملف محمي من التغيير. بعض ملفات PDF تُفتح بلا كلمة مرور لكنها تمنع الطباعة أو النسخ أو التعديل. وإن كان مسموحًا لك بتغيير الملف، فأداة فتح قفل PDF ترفع هذه القيود دون كلمة مرور.',
            'الملف نموذج. ما يُفترض أن تغيّره هو حقوله، وباقي الصفحة ثابت عن قصد. وأداة تعبئة نموذج PDF تعبّئ الحقول.',
          ],
          links: [{ text: 'فتح قفل PDF', path: '/unlock-pdf' }, { text: 'تعبئة نموذج PDF', path: '/fill-pdf' }],
        },
        {
          heading: 'غيّر كلمات قليلة بأداة تعديل PDF',
          paragraphs: ['تضيف أداة تعديل PDF طبقة فوق الصفحة، ولا تعيد كتابة النص الموجود فيها. لتستبدل كلمة أو سطرًا:'],
          list: [
            'افتح أداة تعديل PDF واختر ملفك، أو أفلته على الصفحة.',
            'الأشكال في أداة تعديل PDF خطوط حول الشكل بلا تعبئة، فأخفِ الكلمات القديمة بصورة: اختر «صورة»، واختر صورة بيضاء سادة (ملف PNG أو JPG لمربع أبيض)، وضعها فوق الكلمات واسحب زاويتها حتى تغطيها.',
            'اختر «مربع نص»، وانقر على المساحة البيضاء واكتب الكلمات الجديدة، ثم اسحب المربع ليستقيم مع السطر.',
            'انقر «حفظ نسخة»، وراجع المعاينة ونزّل الملف المعدّل. ويبقى الملف الذي على جهازك كما هو.',
          ],
          links: [{ text: 'تعديل PDF', path: '/edit-pdf' }],
        },
        {
          heading: 'ما يجب أن تعرفه عن تغطية النص',
          paragraphs: [
            'يمكن التراجع عن كل تغيير وإعادته حتى تحفظ. وفي النسخة المحفوظة تبقى مربعات النص والتظليل والرسم قابلة للتعديل في برامج PDF الأخرى، أما الأشكال والصور فتصير جزءًا من الصفحة. ويُعدَّل الملف في متصفحك ولا يُرفع أبدًا، ويمكنك أن تتحقق من أن الملف لا يُرفع بنفسك.',
            'التغطية ليست حذفًا. الكلمات القديمة باقية في الملف تحت الصورة البيضاء، ويستطيع أي أحد تحديدها أو البحث عنها أو نسخها. فإن كان الهدف إزالة شيء خاص، كاسم أو رقم حساب، فاستخدم أداة تنقيح PDF، التي تحذف ما تحت كل مربع من الملف الجديد.',
          ],
          links: [{ text: 'تتحقق من أن الملف لا يُرفع', path: '/check-file-upload' }, { text: 'تنقيح PDF', path: '/redact-pdf' }],
        },
        {
          heading: 'لإعادة كتابة فقرات: حوّل الملف إلى وورد',
          paragraphs: [
            'حين يكون التغيير أطول من سطر، أو يجب أن يعاد ترتيب النص، عدّل نسخة وورد بدلًا من ذلك. تجمع أداة تحويل PDF إلى Word الأسطر في فقرات من جديد، وتجعل النص الأكبر عناوين والأسطر النقطية قوائم، وتبقي الصور في أماكنها، وتكتب الفقرات العربية من اليمين إلى اليسار. عدّل ملف docx في وورد أو Pages أو LibreOffice أو Google Docs، ثم احفظه PDF من هناك، أو أعده بأداة تحويل Word إلى PDF.',
            'النتيجة قريبة من ملف PDF وليست نسخة مطابقة: لا تُحفظ الأشكال المرسومة والألوان والخلفيات وتخطيط الأعمدة المتعددة، وتخرج الجداول أسطرًا بعلامات جدولة. يكفي هذا عادةً لخطاب أو تقرير، أما الكتيّب المصمَّم فاطلب ملفه الأصلي من مرسله.',
          ],
          links: [{ text: 'تحويل PDF إلى Word', path: '/pdf-to-word' }, { text: 'تحويل Word إلى PDF', path: '/word-to-pdf' }],
        },
        {
          heading: 'إن كان الملف ممسوحًا ضوئيًا',
          paragraphs: ['الملف الممسوح لا نص فيه يُعدَّل أو يُحوَّل. شغّل أداة التعرّف الضوئي على النص أولًا: تقرأ كلمات كل صفحة، بالعربية أو الإنجليزية أو كلتيهما، وتضيفها فوق الصفحة نصًا غير مرئي. تبقى الصفحة كما هي، لكن نصها يصير قابلًا للتحديد، وتستطيع أداة التحويل إلى Word أن تجعله مستندًا قابلًا للتعديل. راجع النتيجة، فالتعرّف على النص يخطئ في النص الباهت أو الصغير أو المكتوب بخط اليد. وإن كنت تريد فقط إضافة سطر إلى صفحة ممسوحة، فتجاوز هذه الخطوة: مربع النص في أداة تعديل PDF يعمل على الصفحة الممسوحة أيضًا.'],
          links: [{ text: 'التعرّف الضوئي على النص', path: '/ocr-pdf' }],
        },
        {
          heading: 'خيارات مجانية قد تكون عندك',
          paragraphs: ['بعض البرامج على حاسوبك تساعد أيضًا:'],
          list: [
            'يفتح Microsoft Word ملف PDF ويحوّله إلى مستند قابل للتعديل؛ وتقول صفحة Microsoft عن تعديل ملف PDF إن هذا ينجح أكثر مع ملفات PDF التي يغلب عليها النص (تحققنا منها في 24 نوفمبر 2026).',
            'يضيف تطبيق «معاينة» (Preview) على الماك مربعات نص وأشكالًا وتواقيع إلى ملف PDF من شريط أدوات التعليقات (Markup).',
            'يستطيع Microsoft Edge إضافة رسوم بالحبر وتظليل إلى ملف PDF يفتحه، بحسب صفحة Microsoft عن قارئ PDF في Edge (تحققنا منها في 24 نوفمبر 2026).',
            'يعدّل Adobe Acrobat المدفوع نصوص ملف PDF وصوره؛ وتقول صفحة Acrobat Reader لدى Adobe إن Reader المجاني لا يفعل ذلك (تحققنا منها في 24 نوفمبر 2026).',
          ],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف ما تحاول تغييره (دون بيانات شخصية).`],
        },
      ],
    },
    '/fill-pdf-form-without-acrobat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الجواب المختصر',
          paragraphs: ['لا تحتاج إلى Adobe Acrobat لتعبئة نموذج بي دي اف. إن كان في النموذج حقول قابلة للتعبئة، فالمتصفحات و«معاينة» على الماك وتطبيق «الملفات» على الآيفون تعبّئها، وأداة تعبئة نموذج PDF في OpenAnyDoc تفعل ذلك في متصفحك دون رفع الملف، ثم تستطيع تثبيت الإجابات فلا تُغيَّر. وإن كان النموذج صفحة مسطّحة بلا حقول، فاكتب إجاباتك عليها بمربعات نص في أداة تعديل PDF.'],
          links: [{ text: 'تعبئة نموذج PDF', path: '/fill-pdf' }, { text: 'تعديل PDF', path: '/edit-pdf' }],
        },
        {
          heading: 'أولًا: اعرف نوع النموذج الذي معك',
          paragraphs: ['نماذج PDF ثلاثة أنواع، وطريقة التعبئة تعتمد على النوع:'],
          list: [
            'النموذج القابل للتعبئة فيه حقول حقيقية، ويُسمى نوعها القياسي AcroForm. انقر على سطر فيظهر المؤشر، أو على مربع فتظهر فيه علامة. تُحفظ الإجابات في الحقول، فيمكن قراءتها وتغييرها لاحقًا.',
            'النموذج المسطّح يبدو نموذجًا فقط: صفحة ممسوحة ضوئيًا، أو صفحة حُفظت بلا حقول. النقر لا يفعل شيئًا، فتضع النص بنفسك حيث تذهب كل إجابة.',
            'نموذج XFA يستخدم XML Forms Architecture، وتصفها صفحة Microsoft عن قارئ PDF في Edge بأنها صيغة نماذج قديمة لا يدعمها Edge (تحققنا منها في 24 نوفمبر 2026). ولا تدعم أداة تعبئة نموذج PDF صيغة XFA أيضًا.',
          ],
        },
        {
          heading: 'عبّئ النموذج دون رفع أي شيء',
          paragraphs: ['تعمل أداة تعبئة نموذج PDF على أي حاسوب أو هاتف فيه متصفح حديث:'],
          list: [
            'افتح أداة تعبئة نموذج PDF واختر ملفك، أو أفلته على الصفحة. وإن لم يكن في الملف حقول، تخبرك الأداة بذلك وتدلّك على أداة تعديل PDF.',
            'انقر كل حقل واكتب إجابتك أو ضع علامة أو اختر. تعمل حقول النص والمربعات متعددة الأسطر ومربعات الاختيار وأزرار الخيارات والقوائم المنسدلة، بالعربية أو الإنجليزية أو أي لغة تكتبها لوحة مفاتيحك.',
            'ضع علامة على «تثبيت عند الحفظ» إن أردت أن تثبت الإجابات، ثم انقر «حفظ نسخة» ونزّل النموذج المعبّأ.',
          ],
          links: [{ text: 'تعبئة نموذج PDF', path: '/fill-pdf' }],
        },
        {
          heading: 'نموذجك يبقى على جهازك',
          paragraphs: ['كثيرًا ما تحمل النماذج أسماء وعناوين وأرقام هويات، فيهمّ أين تذهب. يعبّئ متصفحك النموذج بنفسه ولا يرسله إلى خادم، ويمكنك أن تتحقق من أن الملف لا يُرفع من لوحة الشبكة في متصفحك. ولا يتغير الملف الأصلي: «حفظ نسخة» يصنع ملف PDF جديدًا.'],
          links: [{ text: 'تتحقق من أن الملف لا يُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'على الهاتف',
          paragraphs: ['افتح أداة تعبئة نموذج PDF في متصفح هاتفك، واختر الملف من التنزيلات أو من تطبيق «الملفات»، ثم المس كل حقل. وتعبّئ تطبيقات الهاتف نفسه كثيرًا من النماذج أيضًا:'],
          list: [
            'الآيفون والآيباد: افتح ملف PDF في تطبيق «الملفات» والمس الحقل لتكتب فيه. وفي النموذج الذي بلا حقول، يضيف زر الترميز (Markup) نصًا وتوقيعًا.',
            'أندرويد: يفتح تطبيق Google Drive ملفات PDF ويستطيع تعبئة كثير من النماذج القابلة للتعبئة، بحسب مساعدة Google Drive (تحققنا منها في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'تعبئة نموذج PDF', path: '/fill-pdf' }, { text: 'مساعدة Google Drive', path: 'https://support.google.com/drive/answer/9463834' }],
        },
        {
          heading: 'نموذج مسطّح: اكتب حيث تذهب الإجابات',
          paragraphs: [
            'حين لا يكون في النموذج حقول، استخدم أداة تعديل PDF. اختر «مربع نص»، وانقر حيث تذهب الإجابة واكتبها، ثم اسحب المربع ليستقيم مع السطر. وضع علامة في المربع بكتابة X فيه، أو ارسم علامة بأداة الرسم. ثم انقر «حفظ نسخة» حين تكتمل الإجابات.',
            'وإن كنت ترسل النموذج نفسه إلى أشخاص كثيرين، فأداة إنشاء نماذج PDF تحوّل الصفحة المسطّحة إلى نموذج قابل للتعبئة. ضع مربعات نص ومربعات اختيار وقوائم منسدلة وأزرار خيارات وحقول تاريخ ومربع توقيع، فتُعبَّأ النسخة المحفوظة في Acrobat و«معاينة» والمتصفحات وأداة تعبئة نموذج PDF. خيارات القوائم والقيم الابتدائية تقبل الحروف اللاتينية فقط حاليًا، لكن يمكن كتابة العربية في الحقول عند التعبئة.',
          ],
          links: [{ text: 'تعديل PDF', path: '/edit-pdf' }, { text: 'إنشاء نماذج PDF', path: '/pdf-forms' }],
        },
        {
          heading: 'ثبّت الإجابات قبل الإرسال',
          paragraphs: [
            'يحتفظ النموذج المعبّأ بإجاباته في الحقول، فيستطيع كل من يفتحه أن يغيّرها. و«تثبيت عند الحفظ» يرسم كل إجابة على الصفحة ويزيل الحقول، فتبقى النسخة التي ترسلها كما عبّأتها. اتركه دون علامة إن كان على شخص آخر أن يعبّئ جزءًا من النموذج.',
            'تُرسم الإجابات المثبّتة صورًا، فلا يمكن تحديدها أو البحث فيها بعد ذلك.',
          ],
        },
        {
          heading: 'وقّعه',
          paragraphs: ['ينتهي كثير من النماذج بتوقيع. عبّئ الحقول أولًا، ثم افتح النسخة المحفوظة في أداة توقيع PDF: تنقلها الخطوات التالية بعد التنزيل دون أن تختار الملف من جديد. ارسم توقيعك بالفأرة أو بإصبعك، أو اكتب اسمك بخط توقيع، أو ارفع صورة له، وضعه على السطر. هذا توقيع مرئي، كالتوقيع على ورقة مطبوعة، وليس توقيعًا رقميًا بشهادة. ويشرح دليل توقيع ملف PDF بدون Adobe الفرق بينهما والخيارات المجانية على كل جهاز.'],
          links: [{ text: 'توقيع PDF', path: '/sign-pdf' }, { text: 'توقيع ملف PDF بدون Adobe', path: '/sign-pdf-without-adobe' }],
        },
        {
          heading: 'طرق مجانية أخرى على الحاسوب',
          paragraphs: ['قد لا تحتاج إلى موقع أصلًا:'],
          list: [
            'يعبّئ Microsoft Edge النماذج الأساسية؛ وتقول صفحة Microsoft عن قارئ PDF فيه إن النماذج التي تستخدم JavaScript غير مدعومة (تحققنا منها في 24 نوفمبر 2026).',
            'يعبّئ تطبيق «معاينة» على الماك الحقول، ويضيف إلى النموذج المسطّح مربعات نص وتواقيع من شريط أدوات التعليقات (Markup).',
            'برنامج Adobe Acrobat Reader مجاني أيضًا، بحسب صفحة Acrobat Reader لدى Adobe (تحققنا منها في 24 نوفمبر 2026).',
          ],
        },
        {
          heading: 'إن لم يُفتح النموذج',
          paragraphs: ['النموذج الذي يطلب كلمة مرور، أو الذي لا يفتحه أي برنامج، مشكلته غير التعبئة. ويعرض دليل كيف تفتح ملف PDF بدون Adobe الأسباب المعتادة وما تفعله في كل منها.'],
          links: [{ text: 'كيف تفتح ملف PDF بدون Adobe', path: '/open-pdf-without-adobe' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف النموذج الذي تحاول تعبئته (دون بيانات شخصية).`],
        },
      ],
    },
    '/stirling-pdf-alternative': {
      published: '2026-11-20',
      updated: '2026-11-25',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['Stirling-PDF مجموعة أدوات بي دي اف تشغّلها على خادمك أنت، فتنتقل الملفات من متصفحات الموظفين إلى جهاز تتحكم فيه وتُعالَج هناك. أما OpenAnyDoc فينجز العمل داخل متصفح كل شخص، فلا خادم تحتاج إلى تشغيله ولا يغادر الملف الجهاز. لدى Stirling-PDF عمليات أكثر بكثير وواجهة برمجية وأتمتة؛ وOpenAnyDoc الخيار الأخف حين يحتاج الناس إلى مهام PDF اليومية.'],
        },
        {
          heading: 'كيف يعمل Stirling-PDF (رُوجع في 25 نوفمبر 2026)',
          paragraphs: ['ما يقوله Stirling-PDF في صفحاته؛ اتبع الروابط للاطلاع على النص الحالي:'],
          list: [
            'خادم تستضيفه بنفسك: يشغّله ملف README على GitHub بأمر Docker واحد، ويصفه بأنه شيء يمكنك نشره «على خوادمك مع واجهة برمجية خاصة». ويذكر دليل Docker ثلاث صور، من صورة للأدوات الأساسية فقط (يُقترح لها نحو 2 غيغابايت من الذاكرة) إلى صورة كاملة بمحرك ذكاء اصطناعي مدمج (يُقترح لها 6 غيغابايت).',
            'أين تُعالَج الملفات: تقول صفحة أين تعمل الأدوات إن كل أداة في الاستضافة الذاتية «تعمل على خادمك، حتى التي يستطيع حاسوبك تشغيلها». ولتطبيق سطح المكتب وضع محلي فقط لا يُرفع فيه شيء. وإذا فعّل المسؤول المعالجة المحلية للمستندات، تبقى المستندات على الجهاز وتُخفى الأدوات التي لا تعمل محليًا.',
            'الميزات: يذكر ملف README أكثر من 50 أداة PDF، وتذكر صفحة الأسعار أكثر من 60، منها التعديل والدمج والتقسيم والتوقيع والتنقيح والتحويل وOCR والضغط، إضافة إلى مسارات عمل دون كود وواجهات REST لمعظم الأدوات.',
            'الترخيص: يصف ملف README مشروع Stirling-PDF بأنه «open-core» (نواة مفتوحة). وملف LICENSE يجعل معظم الكود بترخيص MIT، مع عدة مجلدات لكلٍّ منها ترخيص منفصل.',
            'الخطط: تقول صفحة الخطط إن الخادم المستضاف ذاتيًا يعمل بالخطة المجانية (5 مستخدمين، و1,000 وحدة شهريًا للأتمتة والذكاء الاصطناعي واستدعاءات الواجهة البرمجية) حتى تضيف خطة Team أو Enterprise. وتذكر صفحة الأسعار خطة Team بـ 99 دولارًا شهريًا لـ 100 مستخدم؛ وEnterprise بسعر مخصص وتضيف النشر المعزول عن الشبكة وتزويد SCIM وإقامة البيانات وسجلات التدقيق؛ ويُذكر الدخول الموحد بدءًا من خطة Team.',
            'Stirling Cloud: تقول صفحة الملفات والخصوصية إن ملفات الضغط وOCR والتحويل والعلامة المائية تُرسل إلى خوادم Stirling وتُعالَج ثم تُعاد. أما الملفات التي تفتحها في محرره فتبقى في تخزين متصفحك ما لم تسجّل الدخول وتختر رفعها أو مشاركتها.',
          ],
          links: [{ text: 'README على GitHub', path: 'https://github.com/Stirling-Tools/Stirling-PDF' }, { text: 'دليل Docker', path: 'https://docs.stirlingpdf.com/Server/Install/Docker/' }, { text: 'صفحة أين تعمل الأدوات', path: 'https://docs.stirlingpdf.com/Desktop/Where-Tools-Run/' }, { text: 'ملف LICENSE', path: 'https://github.com/Stirling-Tools/Stirling-PDF/blob/main/LICENSE' }, { text: 'صفحة الخطط', path: 'https://docs.stirlingpdf.com/Server/Licensing/Plans-and-Licences/' }, { text: 'صفحة الأسعار', path: 'https://stirling.com/pricing' }, { text: 'صفحة الملفات والخصوصية', path: 'https://docs.stirlingpdf.com/Cloud/Files-and-Privacy/' }],
        },
        {
          heading: 'أين يقدّم Stirling-PDF أكثر',
          paragraphs: ['إنصافًا في المقارنة، يغطي Stirling-PDF أمورًا لا يغطيها OpenAnyDoc:'],
          list: [
            'عمليات أكثر بكثير مما في OpenAnyDoc.',
            'مسارات عمل تربط عدة خطوات وتعمل على ملفات كثيرة دون أن ينقر أحد خطوة خطوة.',
            'واجهة REST برمجية، لترسل إليها أنظمة شركتك الأخرى ملفات PDF.',
            'حسابات ودخول موحد، وفي الخطط المدفوعة سجل تدقيق، وهذا مهم حين يجب أن تُثبت من فعل ماذا.',
            'معالجة على الخادم لا تعتمد على سرعة حاسوب كل موظف أو ذاكرته.',
          ],
        },
        {
          heading: 'ما الذي يفعله OpenAnyDoc بشكل مختلف',
          paragraphs: [
            'لدى OpenAnyDoc أكثر من 40 أداة PDF، وكلها تعمل في متصفح من يستخدمها. يُقرأ الملف ويُعدَّل ويُحفظ على ذلك الجهاز. ولا تسمح سياسة أمان الصفحة إلا بالاتصال بموقعها نفسه، فلا يمكن إرسال المستند إلى أي مكان آخر؛ ويستطيع أي شخص التأكد من ذلك في لوحة الشبكة في المتصفح، كما يشرح دليل التحقق بنفسك.',
            'لذلك لا يحتاج إبقاء الملفات داخل الجهة إلى خادم معالجة. ولأن الموقع مجلد من الملفات الثابتة، تستطيع أي جهة استضافة نسختها الخاصة على شبكتها الداخلية: ابنِه وقدّم المجلد من خادم ويب يرسل ترويسات الأمان نفسها التي يرسلها هذا الموقع. لا قاعدة بيانات ولا حسابات مستخدمين ولا صورة Docker تحتاج إلى تحديث ولا حد للمعالجة، وتبقى الملفات التي يفتحها الموظفون على أجهزتهم. والكود المصدري منشور على GitHub. وتعمل كل أداة دون اتصال أيضًا بعد أن تستخدمها مرة مع الاتصال؛ وتحمّل «OCR PDF» و«ترجمة PDF» أيضًا بيانات اللغة من الموقع في أول استخدام.',
          ],
          links: [{ text: 'التحقق بنفسك', path: '/check-file-upload' }],
        },
        {
          heading: 'مقارنة سريعة',
          paragraphs: ['أهم الفروق باختصار:'],
          list: [
            'أين تُعالَج الملفات: Stirling-PDF المستضاف ذاتيًا على خادمك افتراضيًا، ويستطيع المسؤول تفعيل المعالجة المحلية فتُخفى الأدوات التي لا تعمل محليًا؛ وOpenAnyDoc في متصفح كل مستخدم.',
            'ما الذي تشغّله: Stirling-PDF حاوية Docker مع 2 إلى 6 غيغابايت ذاكرة مقترحة، أو تطبيق سطح مكتب؛ وOpenAnyDoc لا شيء، أو ملفات ثابتة على أي خادم ويب.',
            'المستخدمون والحدود: خطة Stirling-PDF المجانية 5 مستخدمين على خادم مستضاف ذاتيًا، و1,000 وحدة شهريًا للأتمتة والذكاء الاصطناعي واستدعاءات الواجهة البرمجية (صفحة الخطط، رُوجعت في 25 نوفمبر 2026)؛ وOpenAnyDoc بلا حسابات، ولا أتمتة أو واجهة برمجية تُحتسب.',
            'العمليات: Stirling-PDF أكثر من 50 أداة (أكثر من 60 في صفحة الأسعار) مع مسارات عمل وواجهة برمجية؛ وOpenAnyDoc أكثر من 40 أداة PDF دون واجهة برمجية.',
            'الضغط: كلاهما؛ يحفظ OpenAnyDoc الصور بثلاثة مستويات جودة في المتصفح ولا يخفّض دقتها.',
            'الدفعات الكبيرة: يتولاها خادم Stirling-PDF؛ وفي OpenAnyDoc تحدها ذاكرة كل جهاز.',
          ],
        },
        {
          heading: 'أدوات PDF التي يغطيها OpenAnyDoc',
          paragraphs: ['كلٌّ منها يعمل على جهاز المستخدم نفسه:'],
          list: [
            'الدمج والتقسيم وحذف الصفحات واستخراجها وترتيبها وتدويرها وقصّها.',
            'التعديل والتوقيع وتعبئة النماذج؛ وترقيم الصفحات والعلامة المائية والرأس والتذييل؛ والتنقيح والمقارنة.',
            'أداة «OCR PDF» تجعل ملف بي دي اف الممسوح ضوئيًا قابلًا للبحث بالعربية أو الإنجليزية؛ ويُحمَّل قارئ النص من الموقع نفسه عند أول استخدام.',
            '«حماية PDF» تقفل الملف بكلمة مرور وتشفير AES-256؛ و«فتح قفل PDF» يزيل كلمة مرور تعرفها.',
            'تحويل وورد واكسل إلى PDF، وتحويل PDF إلى وورد أو اكسل أو بوربوينت أو JPG أو نص أو Markdown.',
          ],
          links: [{ text: 'الدمج', path: '/merge-pdf' }, { text: '«OCR PDF»', path: '/ocr-pdf' }, { text: '«حماية PDF»', path: '/protect-pdf' }, { text: '«فتح قفل PDF»', path: '/unlock-pdf' }, { text: 'التنقيح', path: '/redact-pdf' }, { text: 'تحويل وورد واكسل إلى PDF', path: '/word-to-pdf' }],
        },
        {
          heading: 'من الأفضل له أن يبقى مع Stirling-PDF',
          paragraphs: ['ابقَ مع Stirling-PDF، أو اختره، إن احتجت إلى تنفيذ الخطوات نفسها على آلاف الملفات، أو استدعاء أدوات PDF من برامج أخرى عبر واجهة برمجية، أو تسجيل من عالج أي مستند. هذه مهام خادم، وأداة المتصفح ليست مصممة لها. وتستطيع فرق كثيرة استخدام الاثنين: Stirling-PDF للأتمتة، وOpenAnyDoc على كل مكتب للدمج والتوقيع وOCR اليومي الذي لا ينبغي أن يصل إلى أي خادم.'],
        },
        {
          heading: 'أيّهما تختار',
          paragraphs: ['قاعدة بسيطة:'],
          list: [
            'يحتاج الموظفون إلى مهام PDF يومية ولا تريد تشغيل خادم: OpenAnyDoc، على موقعنا أو على شبكتك.',
            'تحتاج إلى أتمتة أو واجهة برمجية أو سجلات تدقيق: Stirling-PDF.',
            'تقول قواعدكم إن المستندات لا يجوز أن تغادر جهاز الموظف إطلاقًا: أداة تعالجها محليًا.',
            'لست متأكدًا مما تسمح به قواعدكم: اسأل فريق تقنية المعلومات أو الامتثال أولًا. وخيارات أخرى في أدوات PDF لا ترفع ملفك.',
          ],
          links: [{ text: 'أدوات PDF لا ترفع ملفك', path: '/pdf-tools-without-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف ما تحتاجه، مثل استضافة نسخة على شبكتك (دون بيانات شخصية).`],
        },
      ],
    },
    '/jsonformatter-alternative': {
      published: '2026-11-20',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['موقعا jsonformatter.org وCode Beautify أداتان مجانيتان شائعتان لملفات جيسون، فيهما محوّلات كثيرة وطريقة لحفظ JSON رابطًا قابلًا للمشاركة. يقول الموقعان إن جزءًا كبيرًا من العمل يجري في متصفحك، لكن ميزتي الحفظ والتحميل من رابط تمرّان بخوادمهما، ويطلبان منك ألا تحفظ بيانات حساسة. فإن كنت تلصق ردود API أو رموز وصول أو ملفات إعدادات، فإن OpenAnyDoc ينسّق JSON ويتحقق منه ويقارنه في متصفحك، ولا توجد فيه ميزة حفظ على الإنترنت أصلًا.'],
        },
        {
          heading: 'ما يقوله jsonformatter.org (رُوجع في 24 نوفمبر 2026)',
          paragraphs: ['من صفحته الرئيسية وسياسة الخصوصية:'],
          list: [
            'التحقق: «Your JSON Data gets validated in the browser itself»، أي يجري التحقق في المتصفح نفسه. وتقول الصفحة أيضًا إنه يحفظ آخر JSON منسّق في التخزين المحلي للمتصفح.',
            'الحفظ: يمكنك حفظ JSON على الإنترنت دون تسجيل دخول، وتقول أسئلته الشائعة إن هذه البيانات «ستصبح عامة». ولإبقائها خاصة يطلب منك تسجيل الدخول. وتنتهي صلاحية الروابط بعد ساعة، أو بعد 30 يومًا أو لا تنتهي مع حساب.',
            'المشاركة والتحميل: يدعم الروابط لمشاركة JSON، وخيار «Load URL» لتحميل بيانات خارجية.',
            'تقول سياسة الخصوصية بأحرف كبيرة «DO NOT SAVE SENSITIVE DATA USING THE SAVE FUNCTIONALITY» (لا تحفظ بيانات حساسة بميزة الحفظ)، وإن الزيارات تُقاس بـ Google Analytics وClicky.',
            'لا تذكر صفحاته هل يُرسَل JSON إلى خادم عند التنسيق أو التحويل.',
          ],
          links: [{ text: 'صفحته الرئيسية', path: 'https://jsonformatter.org/' }, { text: 'سياسة الخصوصية', path: 'https://jsonformatter.org/policy' }],
        },
        {
          heading: 'ما يقوله Code Beautify (رُوجع في 24 نوفمبر 2026)',
          paragraphs: ['من صفحة عارض JSON وسياسة الخصوصية:'],
          list: [
            'المعالجة: تقول سياسة الخصوصية إن 99% من أدواته تعالج البيانات في المتصفح بلغة JavaScript، وإنه لا يخزّن بيانات إلا إذا استخدمت ميزة Save Online.',
            'الروابط والملفات: تقول السياسة نفسها إن البيانات عند التحميل من رابط أو رفع ملف تنتقل بين الخادم والمتصفح دون أن تُخزَّن، وإن الملفات المرفوعة تُحذف.',
            'الحفظ: تتيح صفحة عارض JSON حفظ JSON رابطًا ومشاركته. وتقول السياسة إن البيانات العامة قد تفهرسها Google، وتقترح تسجيل الدخول لإبقاء المحفوظ خاصًا، وتطلب ألا تحفظ كلمات مرور أو مفاتيح أو بيانات إنتاج حقيقية.',
            'لا تذكر صفحاته أيّ أدواته من الـ 1% التي لا تعمل في المتصفح.',
          ],
          links: [{ text: 'صفحة عارض JSON', path: 'https://codebeautify.org/jsonviewer' }, { text: 'سياسة الخصوصية', path: 'https://codebeautify.org/privacy-policy' }],
        },
        {
          heading: 'أين يقدّم هذان الموقعان أكثر',
          paragraphs: ['إنصافًا في المقارنة، يقدّم الموقعان ما لا يقدّمه OpenAnyDoc. يحوّل Code Beautify ملفات JSON إلى Excel وHTML وTSV ونص وBase64، ويضيف jsonformatter.org تحويل RSS إلى JSON وأدوات كثيرة لـ XML وHTML وCSS. ويتيح كلاهما حفظ JSON رابطًا ترسله إلى زميل، وهو ما لا يستطيعه OpenAnyDoc، ولكليهما حسابات تحفظ مقتطفاتك. ومع بيانات أمثلة عامة، تكون هذه المشاركة مفيدة.'],
        },
        {
          heading: 'ما الذي يفعله OpenAnyDoc بشكل مختلف',
          paragraphs: [
            'تعمل كل أدوات جيسون في OpenAnyDoc داخل متصفحك. يبقى JSON الملصوق والملفات المفتوحة في ذاكرة الصفحة حتى تنزّل نسخة، وإغلاق التبويب يتجاهلها. لا يوجد زر حفظ على الإنترنت ولا رابط مشاركة ولا حساب، فلا يمكن أن يصبح شيء عامًا بالخطأ. ولا يستخدم الموقع أي أدوات تحليل للزيارات.',
            'لا تسمح سياسة أمان الصفحة إلا بالاتصال بموقعها نفسه، ويمكنك التحقق بنفسك من لوحة الشبكة في المتصفح. وهناك استثناء واحد تبدؤه أنت: «فتح من رابط» في صفحات JSON يجلب عنوان https الذي تكتبه مباشرة من متصفحك، عبر إطار منفصل لا يُسمح له إلا بذلك. وتعمل الصفحات دون اتصال بعد تحميلها، وتُفتح ملفات JSON حتى 10 ميغابايت.',
          ],
          links: [{ text: 'التحقق بنفسك', path: '/check-file-upload' }],
        },
        {
          heading: 'أدوات JSON التي تُبقي بياناتك في المتصفح',
          paragraphs: ['كلٌّ منها يعمل على جهازك:'],
          list: [
            'منسّق JSON: تنسيق بمسافة واحدة أو 2 أو 3 أو 4 أو 8 مسافات أو Tab، وضغط في سطر واحد، وترتيب المفاتيح؛ وتبقى الأعداد الطويلة كما هي رقمًا رقمًا.',
            'مدقق JSON: يعرض السطر والعمود لموضع الخطأ، وزر «إصلاح» يعالج الفواصل الزائدة والتعليقات وعلامات الاقتباس المفردة والمفاتيح بلا علامات اقتباس.',
            'عارض JSON: عرض شجري وجدولي ونصي، مع التعديل والتنزيل.',
            'مقارنة JSON: الفروق حسب المفتاح والمسار، مع تجاهل ترتيب المفاتيح.',
            'JSON Schema واستعلامات JSONPath، وأنواع الكود لـ TypeScript وPython وGo وJava وC#؛ والتحويل إلى CSV وYAML وXML.',
            'إخفاء البيانات: استبدال البريد والأسماء وغيرها من الحقول الشخصية برموز قبل مشاركة الملف.',
          ],
          links: [{ text: 'منسّق JSON', path: '/json-formatter' }, { text: 'مدقق JSON', path: '/json-validator' }, { text: 'عارض JSON', path: '/json-viewer' }, { text: 'مقارنة JSON', path: '/json-compare' }, { text: 'JSON Schema', path: '/json-schema' }, { text: 'JSONPath', path: '/jsonpath' }, { text: 'TypeScript', path: '/json-to-typescript' }, { text: 'CSV', path: '/json-to-csv' }, { text: 'إخفاء البيانات', path: '/mask-data' }],
        },
        {
          heading: 'مقارنة سريعة',
          paragraphs: ['أهم الفروق باختصار:'],
          list: [
            'أين يُعالَج JSON: يتحقق jsonformatter.org في المتصفح ولا تذكر صفحاته أكثر؛ ويقول Code Beautify إن معظم أدواته تعمل في المتصفح؛ وفي OpenAnyDoc كل الأدوات في المتصفح.',
            'الحفظ على الإنترنت وروابط المشاركة: في الموقعين نعم (عامة دون تسجيل دخول)؛ وفي OpenAnyDoc لا.',
            'التحميل من رابط: في الموقعين نعم، ويقول Code Beautify إن البيانات تمر بخادمه؛ وفي OpenAnyDoc نعم، يجلبه متصفحك مباشرة.',
            'تحليل الزيارات: يذكر الموقعان Google Analytics في سياسة الخصوصية؛ وOpenAnyDoc بلا تحليل.',
            'عدد المحوّلات: أكثر في الموقعين.',
          ],
        },
        {
          heading: 'من الأفضل له أن يبقى مع هذين الموقعين',
          paragraphs: ['إن كان JSON بيانات أمثلة عامة وتريد إرسال رابط إليها، أو تحتاج إلى محوّل لا يملكه OpenAnyDoc، فإن jsonformatter.org وCode Beautify يؤديان ذلك جيدًا. أما إن كان JSON يحوي مفاتيح API أو رموز وصول أو سجلات عملاء أو إعدادات داخلية، فاستخدم أداة تُبقيه في متصفحك، وأخفِ الحقول الشخصية قبل المشاركة، واتبع قواعد جهتك بشأن المكان الذي يجوز أن تذهب إليه هذه البيانات.'],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف ما تحتاجه (دون بيانات شخصية، ولا تلصق رمز وصول حقيقيًا أبدًا).`],
        },
      ],
    },
    '/reduce-photo-file-size': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لتجعل الصورة أصغر من حدّ مثل 1 ميغابايت، صغّر أبعادها بالبكسل أولًا، ثم احفظها بصيغة JPG بجودة أقل. صورة الهاتف التي يُصغَّر ضلعها الأطول إلى نحو 1600 بكسل وتُحفظ بجودة 75 تصبح عادةً أقل من 1 ميغابايت بفارق واضح. تعرض أداة «ضغط الصور» الحجم الجديد وأنت تحرّك شريط الجودة، ولا تغادر الصورة جهازك.'],
          links: [{ text: 'ضغط الصور', path: '/compress-image' }],
        },
        {
          heading: 'لماذا تكون صورة الهاتف كبيرة؟',
          paragraphs: ['تحمل صورة الهاتف الحديث ملايين البكسلات، أكثر بكثير مما تحتاجه شاشة أو نموذج رفع، وكل بكسل يأخذ مساحة. لذلك يبلغ حجم الملف عدة ميغابايتات قبل أن تفعل به أي شيء. يحدد حجمَه أمران: عدد البكسلات، ومدى ضغط الصيغة لها. وأسهل طريق للوصول إلى الحد المطلوب أن تعمل على الأمرين، بهذا الترتيب.', 'كثير من النماذج تذكر ما تقبله، مثل «JPG أو PNG، أقل من 1 ميغابايت»، وأحيانًا حدًّا أدنى للعرض بالبكسل. اقرأ هذا السطر أولًا، لأنه يحدد الصيغة والقدر الذي يمكنك أن تصغّر به الصورة.'],
        },
        {
          heading: 'الخطوة 1: غيّر الأبعاد أولًا',
          paragraphs: ['تغيير الأبعاد يحذف بكسلات، ويوفّر أكثر من أي إعداد للجودة. فإن قسمت العرض والارتفاع على اثنين بقي ربع البكسلات، وصغر الملف معها. افتح «تغيير حجم الصورة» واختر إحدى ثلاث طرق:'],
          list: [
            'بالبكسل: اكتب عرضًا مثل 1600 وأبقِ خيار الحفاظ على النسبة مفعّلًا حتى لا تتمدد الصورة.',
            'بالنسبة المئوية: صغّر كل الصور بالقدر نفسه، مثل 50%.',
            'المقاسات الجاهزة: مقاسات Instagram وWhatsApp، ومقاسات شائعة لصور جواز السفر بدقة 300 dpi. هذه مقاسات شائعة لا فحوص رسمية، فتأكد من قواعد الجهة نفسها.',
            'في أداة تغيير الحجم خانتا الصيغة والجودة نفسهما الموجودتان في أداة الضغط، فتكفي خطوة واحدة للأمرين إن كانت لديك صورة واحدة.',
          ],
          links: [{ text: 'تغيير حجم الصورة', path: '/resize-image' }],
        },
        {
          heading: 'الخطوة 2: خفّض الجودة',
          paragraphs: ['افتح «ضغط الصور» وأضف الصورة وحرّك شريط الجودة. الجودة 75 بداية جيدة للصور الفوتوغرافية: يصبح الملف عادةً أقل من نصف حجمه ويصعب أن تلاحظ الفرق. ويعرض المنظر «قبل وبعد» الصورة الأولى بهذا الإعداد مع حجمها قبل الضغط وبعده، فتتوقف حين يصبح أقل من الحد.', 'لا توجد خانة تكتب فيها «أقل من 1 ميغابايت»: أنت تختار الجودة وتقرأ الحجم. إن لم تكفِ 75 فجرّب قيمة أقل، وانظر إلى الوجوه والنصوص الصغيرة والسماء، فهناك تظهر المربعات المشوّهة أولًا. وإن احتجت إلى خفض الجودة كثيرًا، فارجع وصغّر الأبعاد بدلًا من ذلك؛ فالصورة الأصغر الحادة أجمل من صورة كبيرة ضبابية.', 'الجودة تنطبق على JPG وWebP وAVIF. أما PNG فضغطه بلا فقدان: تبقى بكسلاته كما هي تمامًا، لذلك تصغر الصورة الفوتوغرافية المحفوظة بصيغة PNG أقل بكثير.'],
          links: [{ text: 'ضغط الصور', path: '/compress-image' }],
        },
        {
          heading: 'الخطوة 3: اختر الصيغة',
          paragraphs: ['الصيغة مهمة بقدر الجودة:'],
          list: [
            'JPG: تقبلها كل النماذج وتطبيقات البريد والهواتف. الخيار الآمن حين لا تكون متأكدًا.',
            'WebP: أصغر من JPG عادةً بنسبة 25–35% بالمظهر نفسه، وتحفظ الشفافية. تحوّل إليها أداة «تحويل الصور إلى WebP»، لكن بعض تطبيقات البريد والبرامج القديمة وبعض النماذج ما زالت ترفضها، فتأكد مما يقبله النموذج.',
            'PNG: مناسبة للقطات الشاشة والشعارات والصور ذات الألوان المسطحة أو النص الحاد. الصور الفوتوغرافية المحفوظة بها تبقى كبيرة، فحوّلها إلى JPG أو WebP.',
            'AVIF: أصغر في الغالب، لكن حفظها بطيء (بضع ثوانٍ لكل صورة كبيرة) وتقبلها نماذج أقل.',
          ],
          links: [{ text: 'تحويل الصور إلى WebP', path: '/image-to-webp' }],
        },
        {
          heading: 'افحص النتيجة قبل الإرسال',
          paragraphs: ['انظر إلى الملف الذي نزّلته، لا إلى الرقم في الأداة وحده: فالحجم في المعاينة للصورة الأولى، وكل صورة في الدفعة تخرج بحجم مختلف قليلًا.'],
          list: [
            'افتحه في «عارض الصور» لترى أبعاده بالبكسل وحجم الملف والصورة مكبّرة.',
            'اجعل الحجم أقل من الحد بقليل. فالحواسيب والمواقع لا تحسب الميغابايت كلها بالطريقة نفسها (1,000,000 أو 1,048,576 بايت)، فاترك هامشًا.',
            'إن كبرت الصورة، فهي مضغوطة بشدة من قبل؛ خفّض الجودة أو احتفظ بالأصل.',
            'إن طلب النموذج ملف PDF، فحوّل الصورة بأداة «تحويل JPG إلى PDF».',
          ],
          links: [{ text: 'عارض الصور', path: '/image-viewer' }, { text: 'تحويل JPG إلى PDF', path: '/jpg-to-pdf' }],
        },
        {
          heading: 'أثر جانبي يستحق المعرفة',
          paragraphs: ['الملف المضغوط يحمل الصورة وحدها: لا تُنسخ إليه بيانات الكاميرا والتاريخ وموقع GPS الموجودة في الأصل. وهذا ما تريده عادةً قبل أن ترسل صورة إلى شخص لا تعرفه. ولتعرف ما تحمله الصورة، أو لتنظّفها دون تغيير بكسلاتها، اقرأ كيف تحذف الموقع من الصورة. يجري الضغط داخل متصفحك، ويمكنك أن تتحقق بنفسك من أن شيئًا لا يُرفع.'],
          links: [{ text: 'كيف تحذف الموقع من الصورة', path: '/remove-location-from-photo' }, { text: 'تتحقق بنفسك من أن شيئًا لا يُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر نوع الصورة والحد الذي تحتاج إليه (دون بيانات شخصية، ورجاءً لا ترفق الصورة).`],
        },
      ],
    },
    '/open-heic-on-windows': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['يفتح Windows صور HEIC من iPhone في تطبيق الصور بعد تثبيت إضافتين من Microsoft Store: ‏HEIF Image Extensions وHEVC Video Extensions. وإن لم تستطع التثبيت أو لم ترده، فافتح الصورة في متصفحك بـ«عارض الصور» من OpenAnyDoc، أو حوّلها إلى JPG بأداة «تحويل HEIC إلى JPG»؛ كلاهما يعمل في Chrome وEdge وFirefox على Windows، وتبقى الصورة على حاسوبك. ولتتجنب المشكلة لاحقًا، اضبط iPhone ليحفظ الصور بصيغة JPG.'],
          links: [{ text: 'عارض الصور', path: '/image-viewer' }, { text: 'تحويل HEIC إلى JPG', path: '/heic-to-jpg' }],
        },
        {
          heading: 'ما ملف HEIC؟',
          paragraphs: ['HEIC هو نوع الملف الذي يحفظ به iPhone الصور افتراضيًا. إنه صورة محفوظة بصيغة HEIF، تأخذ مساحة أقل من JPG بجودة مقاربة، فتتسع ذاكرة الهاتف لصور أكثر. يفتحها Mac في تطبيقي الصور وPreview دون تثبيت شيء، ويفتحها iPhone وiPad في تطبيق الصور.', 'قد ينتهي اسم الملف بـ .heic أو .heif، وكلاهما النوع نفسه من الصور، ويُفتحان بالخطوات أدناه. وبعض هواتف Android تحفظ الصور بصيغة HEIC أيضًا.'],
        },
        {
          heading: 'لماذا قد لا يفتحه Windows؟',
          links: [{ text: 'صفحة Microsoft عن ملفات HEIF وHEVC في تطبيق الصور', path: 'https://support.microsoft.com/help/4494024' }],
          paragraphs: ['يقرأ Windows صيغة HEIC بإضافات لا من تلقاء نفسه. وتقول صفحة Microsoft عن ملفات HEIF وHEVC في تطبيق الصور (تحققنا منها في 24 نوفمبر 2026) إن تطبيق الصور يحتاج إلى إضافتين من Microsoft Store: ‏HEIF Image Extensions وهي مجانية، وHEVC Video Extensions وهي مدفوعة، وإنك تحتاج إلى الاثنتين حتى لو كنت ستستخدم الصور فقط. والصورة داخل ملف HEIC مضغوطة بطريقة ضغط فيديو HEVC نفسها.', 'هذا الطريق مناسب على حاسوبك الشخصي، لكنه لا ينفع على حاسوب العمل أو الجامعة حين يكون المتجر محظورًا، ولا على جهاز مشترك أو مستعار، ولا حين تريد فتح صورة واحدة مرة واحدة. والمتصفحات لا تكفي وحدها: فـChrome وEdge وFirefox لا تعرض HEIC بنفسها، ولهذا ترفضها مواقع كثيرة عند الرفع.'],
        },
        {
          heading: 'افتحها في متصفحك دون تثبيت أي شيء',
          paragraphs: ['يقرأ OpenAnyDoc الصورة على حاسوبك. في أول مرة تفتح فيها ملف HEIC في Chrome أو Edge أو Firefox، يُحمَّل من هذا الموقع برنامج لفك HEIC ويحتفظ به متصفحك؛ أما الصورة نفسها فلا تُرفع أبدًا.'],
          list: [
            'لمشاهدة صورة: افتح «عارض الصور» وأفلت ملف .heic على الصفحة. يمكنك التكبير وملاءمة الصورة للنافذة ورؤية الكاميرا وتاريخ الالتقاط، وموقع GPS إن كانت الصورة تحمله.',
            'لاستخدامها في مكان آخر: افتح «تحويل HEIC إلى JPG» وأضف صورة واحدة أو عدة صور معًا، واختر الجودة (90 تبقيها بالمظهر نفسه)، ثم نزّل ملف JPG أو ملف ZIP بها جميعًا.',
            'ومن العارض، تتيح لك الخطوات التالية ضغط الصورة أو تغيير حجمها أو تنظيفها أو تحويلها إلى PDF دون اختيار الملف من جديد.',
          ],
          links: [{ text: 'عارض الصور', path: '/image-viewer' }, { text: 'تحويل HEIC إلى JPG', path: '/heic-to-jpg' }],
        },
        {
          heading: 'ما الذي تتوقعه من ملف JPG',
          paragraphs: ['يخرج ملف JPG معتدل الاتجاه وبحجمه الكامل، وهو عادةً أكبر من ملف HEIC الذي جاء منه؛ فإن كان كبيرًا على البريد أو النموذج، فاقرأ كيف تقلل حجم ملف الصورة. وبعض النقاط الأخرى:'],
          list: [
            'قد لا تُفك بعض صور HEIC الملتقطة بأحدث إعدادات iPhone. احفظها بصيغة JPG على الهاتف أولًا، بالإعداد المذكور في القسم التالي.',
            'الصور الحية (Live Photos) تصبح صورة JPG ثابتة، ولا يُحفظ المقطع القصير.',
            'لا تُنسخ بيانات الكاميرا والتاريخ وGPS إلى ملف JPG. هذا جيد للمشاركة، لكن احتفظ بالأصل إن أردت تاريخ الالتقاط في ألبوماتك.',
          ],
          links: [{ text: 'كيف تقلل حجم ملف الصورة', path: '/reduce-photo-file-size' }],
        },
        {
          heading: 'أوقف إنشاء ملفات HEIC على iPhone',
          links: [{ text: 'صفحة Apple عن صور HEIF وHEVC', path: 'https://support.apple.com/en-us/116944' }],
          paragraphs: ['يساعدك إعدادان في iPhone، كما تشرح صفحة Apple عن صور HEIF وHEVC (تحققنا منها في 24 نوفمبر 2026)، ويغيّران الصور التي تلتقطها أو تنسخها من الآن فصاعدًا، لا الصور المحفوظة من قبل.'],
          list: [
            'الإعدادات، الكاميرا، التنسيقات، «الأكثر توافقًا»: تحفظ الكاميرا الصور الجديدة بصيغة JPG بدل HEIC، وتأخذ مساحة أكبر على الهاتف.',
            'الإعدادات، التطبيقات، الصور، واترك «الاحتفاظ بالأصول» غير مفعّل: قد تُحوَّل حينها الصور التي تستوردها إلى الحاسوب بالكابل إلى JPEG أثناء النقل.',
          ],
        },
        {
          heading: 'قبل أن تشارك الصورة',
          paragraphs: ['قد تكشف الصورة أكثر مما تريد: الوجوه التي فيها، ومكان التقاطها المحفوظ داخل الملف. قبل نشر الصورة المحوّلة يمكنك تمويه الوجوه فيها، ويشرح دليل حذف الموقع من الصورة ما يحمله الملف. كل خطوة تجري في متصفحك، ولتطمئن، تحقق بنفسك من أن أي ملف لا يُرفع.'],
          links: [{ text: 'تمويه الوجوه', path: '/blur-face' }, { text: 'دليل حذف الموقع من الصورة', path: '/remove-location-from-photo' }, { text: 'تحقق بنفسك من أن أي ملف لا يُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} إن لم تُفتح صورة HEIC، واذكر الهاتف الذي التقطها والمتصفح الذي استخدمته (دون بيانات شخصية، ورجاءً لا ترفق الصورة).`],
        },
      ],
    },
    '/remove-location-from-photo': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['إن كانت خدمة الموقع مفعّلة للكاميرا، فصورة الهاتف تحمل موقع GPS الدقيق الذي التُقطت فيه، مع طراز الهاتف والتاريخ. لحذفه، أضف الصورة إلى أداة «حذف بيانات الصور»: تعرض ما تحتويه الصورة وتحفظ نسخة نظيفة، داخل متصفحك ودون رفعها. وعلى iPhone يمكنك أيضًا استبعاد الموقع عند مشاركة واحدة، من «الخيارات» في ورقة المشاركة.'],
          links: [{ text: 'حذف بيانات الصور', path: '/remove-image-metadata' }],
        },
        {
          heading: 'ما الذي يحمله ملف الصورة',
          paragraphs: ['تكتب كاميرات الهواتف تفاصيل داخل كل صورة، إلى جانب الصورة نفسها. يسمى هذا الجزء الخفي البيانات الوصفية، ويُحفظ معظمه بصيغة EXIF (وتضيف بعض التطبيقات حقول XMP أو IPTC). وقد يشمل:'],
          list: [
            'موقع GPS: خط العرض وخط الطول، وكثيرًا ما يكون دقيقًا بما يكفي للإشارة إلى مبنى بعينه، إن كان الموقع مسموحًا للكاميرا.',
            'تاريخ التقاط الصورة ووقته.',
            'الشركة المصنعة للهاتف أو الكاميرا وطرازها، والعدسة.',
            'البرنامج الذي عدّلها، وأحيانًا اسم مؤلف.',
            'الاتجاه: أي جهة يجب أن تُعرض الصورة عليها.',
          ],
        },
        {
          heading: 'اعرف ما تكشفه صورتك',
          paragraphs: ['لا يظهر شيء من هذا حين تنظر إلى الصورة، لكن أي شخص يحصل على الملف الأصلي يستطيع قراءته. لتراه بنفسك، افتح الصورة في «عارض الصور» وافتح لوحة التفاصيل: تعرض الكاميرا والعدسة وتاريخ الالتقاط، وموقع GPS إن كانت الصورة تحمله، مع رابط لرؤيته على OpenStreetMap إن شئت.', 'وتعرض أداة «حذف بيانات الصور» التفاصيل نفسها لكل صورة بكلمات واضحة، مثل «هذه الصورة تحتوي على موقعك عبر GPS»، قبل أن تحفظ أي شيء.'],
          links: [{ text: 'عارض الصور', path: '/image-viewer' }, { text: 'حذف بيانات الصور', path: '/remove-image-metadata' }],
        },
        {
          heading: 'احذفه في متصفحك',
          paragraphs: ['تُقرأ الصورة وتُنظَّف على جهازك ولا تُرسل إلى أي خادم، ويمكنك أن تتحقق من أنها لا تُرفع بأدوات متصفحك نفسه.'],
          list: [
            'افتح «حذف بيانات الصور» وأضف صورة واحدة أو أكثر.',
            'اقرأ ما تعرضه كل صورة: موقع GPS والكاميرا والتاريخ وأي تفاصيل أخرى وُجدت.',
            'انقر «تنزيل نسخ نظيفة». وإن كانت الصور عدة، فتصلك في ملف ZIP واحد.',
          ],
          links: [{ text: 'حذف بيانات الصور', path: '/remove-image-metadata' }, { text: 'تتحقق من أنها لا تُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'هل تفقد الصورة جودتها؟',
          paragraphs: ['لا، في صيغ JPG وPNG وWebP. تُقص البيانات الوصفية وحدها وتُنسخ بيانات الصورة كما هي، فتبدو الصورة مطابقة تمامًا. ويحتفظ ملف JPG بملف تعريف الألوان، فلا تتغير الألوان. وتُقرأ كل نسخة نظيفة مرة أخرى قبل أن تصلك، وتتوقف الأداة إن بقي أي موقع أو كاميرا أو تاريخ.', 'هناك استثناءان: صور HEIC وTIFF تُحفظ من جديد بصيغة JPG عالية الجودة. وصورة JPG التي تحمل وسم اتجاه جانبي تُدار أولًا لتصبح معتدلة في بكسلاتها، لأن حذف الوسم سيعرضها على جنبها، فتتغير بكسلاتها قليلًا.'],
        },
        {
          heading: 'امنع الهاتف من إضافته',
          links: [{ text: 'صفحة Apple عن الموقع في الصور', path: 'https://support.apple.com/guide/personal-safety/manage-location-metadata-in-photos-ips0d7a5df82/web' }],
          paragraphs: ['يمكن لإعدادات الهاتف أن تستبعد الموقع من البداية، أو في مشاركة واحدة. أسماء القوائم تختلف بين الإصدارات والشركات المصنعة، فابحث عن هذه الكلمات:'],
          list: [
            'iPhone لمشاركة واحدة: في ورقة المشاركة، اضغط «الخيارات» وأوقف «الموقع» قبل الإرسال، كما تشرح صفحة Apple عن الموقع في الصور (تحققنا منها في 24 نوفمبر 2026).',
            'iPhone لكل صورة جديدة: الإعدادات، الخصوصية والأمن، خدمات الموقع، الكاميرا، «أبدًا».',
            'Android: افتح إعدادات تطبيق الكاميرا وأوقف خيار وسوم الموقع أو حفظ الموقع؛ ويختلف اسمه بحسب الشركة المصنعة.',
          ],
        },
        {
          heading: 'ألا تحذفه مواقع التواصل تلقائيًا؟',
          paragraphs: ['كثير من المواقع تحذف بيانات الموقع حين تنشر صورة، لكن ليست كلها، وتطبيقات المراسلة تختلف: بعضها يحذفها حين يصغّر الصورة، بينما إرسال الصورة نفسها كملف أو بالبريد يُبقي كل شيء عادةً. كما أن الإعدادات والسياسات تتغير مع الوقت. وحين تنظّف الصورة بنفسك أولًا، لا تحتاج إلى معرفة أيها يفعل ماذا.', 'الصور التي التقطتها من قبل تبقى حاملة لموقعها حتى بعد إيقافه في الهاتف، فنظّفها قبل إرسالها.'],
        },
        {
          heading: 'ما لا يفعله حذف البيانات الوصفية',
          paragraphs: ['قد يكشف الملف النظيف المكان رغم ذلك بما يظهر في الصورة: لافتة شارع أو رقم منزل أو لوحة سيارة أو زي مدرسي أو المنظر من نافذة. والوجوه كذلك. تجد أداة «تمويه الوجوه» الوجوه، وتتيح لك السحب فوق أي شيء آخر، مثل بطاقة تعريف أو لوحة سيارة، قبل المشاركة.', 'لا تتغير أسماء الملفات، فغيّر اسم أي ملف مسمّى باسم مكان أو شخص. وحين تصغّر صورة لإرسالها بالبريد أو تحوّلها من HEIC إلى JPG، فالملف الجديد يستبعد بيانات الكاميرا والتاريخ وGPS من الأصل.'],
          links: [{ text: 'تمويه الوجوه', path: '/blur-face' }, { text: 'تصغّر صورة لإرسالها بالبريد', path: '/reduce-photo-file-size' }, { text: 'تحوّلها من HEIC إلى JPG', path: '/heic-to-jpg' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} إن بقيت تفصيلة في نسخة نظيفة، واذكر نوع الصورة والتطبيق الذي أنشأها (دون بيانات شخصية، ورجاءً لا ترفق الصورة).`],
        },
      ],
    },
    '/remove-background-without-upload': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['تقص أداة «إزالة خلفية الصورة» من OpenAnyDoc الشخص أو الشيء من الصورة على جهازك أنت: يجد نموذج ذكاء اصطناعي يعمل على الجهاز موضوع الصورة داخل متصفحك، ولا تُرسل الصورة إلى أي خادم. احفظ النتيجة بصيغة PNG شفافة أو على خلفية بيضاء. وعلى iPhone أو iPad أو Mac يمكنك أيضًا رفع الموضوع من الصورة بلمسة مطوّلة أو بالنقر بزر الفأرة الأيمن.'],
          links: [{ text: 'إزالة خلفية الصورة', path: '/remove-background' }],
        },
        {
          heading: 'لماذا يهم أين تذهب الصورة',
          paragraphs: ['بعض أدوات إزالة الخلفية على الإنترنت تقص الصورة على خوادمها، فلا بد من رفع الصورة أولًا. قد لا يهم ذلك في صورة منتج، لكنه يهم في صورة عائلية أو صورة طفل أو صورة شخصية لبطاقة هوية.', 'حين يعمل النموذج في متصفحك تبقى الصورة على جهازك. ولا تحتاج إلى أن تصدّق ذلك على الثقة: يمكنك أن تتحقق من أن شيئًا لا يُرفع بمراقبة لوحة الشبكة في متصفحك أثناء استخدام الأداة.'],
          links: [{ text: 'تتحقق من أن شيئًا لا يُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'ماذا يحدث في المرة الأولى',
          paragraphs: ['في أول استخدام يُحمَّل النموذج والبرنامج الذي يشغّله من موقع OpenAnyDoc نفسه: النموذج من 5 إلى 7 ميغابايت والبرنامج المشغّل 15 ميغابايت، أي نحو 22 ميغابايت في المجموع على الأكثر. يحتفظ بهما متصفحك، فتبدأ الاستخدامات التالية فورًا وتعمل دون اتصال. والتحميل في اتجاه واحد: النموذج يأتي إليك، وصورتك لا تذهب إلى أي مكان.'],
        },
        {
          heading: 'كيف تفعل ذلك',
          paragraphs: ['تعمل أداة «إزالة خلفية الصورة» على صورة واحدة في كل مرة:'],
          list: [
            'افتح «إزالة خلفية الصورة» واختر صورة JPG أو PNG أو WebP أو HEIC أو أفلتها على الصفحة.',
            'اختر «شخص» للصور الشخصية، أو «غرض أو حيوان» للمنتجات والحيوانات الأليفة وأي شيء آخر.',
            'اسحب عبر معاينة «قبل وبعد» لتفحص الحواف.',
            'اختر شفافة أو بيضاء وانقر «إزالة الخلفية».',
          ],
          links: [{ text: 'إزالة خلفية الصورة', path: '/remove-background' }],
        },
        {
          heading: 'PNG شفافة أم خلفية بيضاء؟',
          paragraphs: ['اختر بحسب المكان الذي ستذهب إليه الصورة:'],
          list: [
            'PNG شفافة: الخلفية شفافة، فيوضع الموضوع على أي لون أو صورة أو شريحة. استخدمها للتصاميم والملصقات والعروض التقديمية، وضعها على خلفية جديدة في «محرر الصور» أو في تطبيق تصميم.',
            'بيضاء: تُملأ الخلفية بالأبيض وتبقى الصورة بصيغتها، فملف JPG يبقى JPG. استخدمها لقوائم المتاجر والنماذج التي تطلب خلفية سادة.',
            'لصورة الهوية أو جواز السفر، تأكد من قواعد الجهة المُصدِرة للخلفية والمقاس؛ وفي أداة «تغيير حجم الصورة» مقاسات شائعة لجوازات السفر.',
          ],
          links: [{ text: 'محرر الصور', path: '/photo-editor' }, { text: 'تغيير حجم الصورة', path: '/resize-image' }],
        },
        {
          heading: 'إن كان الملف كبيرًا',
          paragraphs: ['ملف PNG الشفاف لصورة فوتوغرافية يكون في الغالب أكبر من ملف JPG الذي جاء منه. فإن حدّد الموقع حجمًا أقصى وكان يقبل WebP، فأداة «تحويل الصور إلى WebP» تحفظ الشفافية في ملف أصغر. وللصورة ذات الخلفية البيضاء بصيغة JPG، يشرح دليل تقليل حجم ملف الصورة تغيير الأبعاد والجودة.'],
          links: [{ text: 'تحويل الصور إلى WebP', path: '/image-to-webp' }, { text: 'دليل تقليل حجم ملف الصورة', path: '/reduce-photo-file-size' }],
        },
        {
          heading: 'ما الذي ينجح وما الذي لا ينجح',
          paragraphs: ['النماذج صغيرة بما يكفي لتعمل على جهازك. هذا يحفظ خصوصية الصورة، لكن الأدوات التجارية الكبيرة تتفوق في الصور الصعبة.'],
          list: [
            'ينجح جيدًا: شخص واحد واضح أو شيء واحد، بتركيز جيد، على خلفية سادة أو بسيطة.',
            'ينجح جيدًا: المنتجات على طاولة، والحيوانات الأليفة، والصور الشخصية بحواف ناعمة حول الشعر والكتفين.',
            'قد تخرج الحواف خشنة: الشعر الدقيق أو المتطاير، والزجاج وكل ما هو شفاف، والدخان، والخلفيات المزدحمة.',
            'إن خرجت الحواف خشنة، فجرّب الخيار الآخر («شخص» أو «غرض أو حيوان»)، أو صورة ملتقطة أمام جدار أبسط.',
          ],
        },
        {
          heading: 'خيارات موجودة على أجهزتك',
          paragraphs: ['قد لا تحتاج إلى موقع أصلًا، فهذه الطرق تعمل على الجهاز أيضًا (صفحات الشركات المصنّعة، تحققنا منها في 24 نوفمبر 2026):'],
          links: [{ text: 'المس موضوع الصورة مطوّلًا', path: 'https://support.apple.com/102460' }, { text: 'نسخ الموضوع', path: 'https://support.apple.com/guide/safari/ibrw1c2374cd/mac' }, { text: 'زر لإزالة الخلفية', path: 'https://blogs.windows.com/windows-insider/2023/09/07/background-removal-in-paint-begins-rolling-out-to-windows-insiders/' }],
          list: [
            'iPhone وiPad: في تطبيق الصور، المس موضوع الصورة مطوّلًا حتى يرتفع، ثم انسخه أو شاركه.',
            'Mac: في تطبيق الصور أو Preview، انقر الصورة بزر الفأرة الأيمن واختر «نسخ الموضوع»، ثم الصقه في تطبيق آخر.',
            'Windows 11: في الإصدارات الحديثة من Paint زر لإزالة الخلفية.',
          ],
        },
        {
          heading: 'قبل أن تشارك النتيجة',
          paragraphs: ['الصورة المقصوصة ما زالت تُظهر الشخص الذي فيها. وإن كان في الصورة أشخاص آخرون، فأداة «تمويه الوجوه» تخفيهم قبل أن تزيل أي شيء. وإن كنت سترسل الصورة الأصلية أيضًا، فاقرأ أولًا كيف تحذف الموقع من الصورة.'],
          links: [{ text: 'تمويه الوجوه', path: '/blur-face' }, { text: 'كيف تحذف الموقع من الصورة', path: '/remove-location-from-photo' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر نوع الصورة التي خرجت حوافها خشنة (دون بيانات شخصية، ورجاءً لا ترفق صورة لشخص حقيقي).`],
        },
      ],
    },
    '/spreadsheet-to-ai-chat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['حوّل الورقة التي تحتاجها إلى جدول Markdown بأداة تحويل Excel إلى Markdown، وتأكد من عدد الرموز (tokens) التي يأخذها، ثم الصقه في المحادثة مع جملة تشرح معنى الأعمدة. جدول Markdown يُبقي كل قيمة تحت اسم عمودها، فيقرؤه ChatGPT أو Claude أو Gemini صفًا صفًا. وقبل ذلك أخفِ الأسماء والإيميلات وغيرها من البيانات الشخصية، فالمحادثة تحتفظ بكل ما تلصقه.'],
          links: [{ text: 'تحويل Excel إلى Markdown', path: '/excel-to-markdown' }],
        },
        {
          heading: 'لماذا لا تلصق الخلايا مباشرة أو ترفق الملف؟',
          paragraphs: ['حين تنسخ خلايا من اكسل تحصل على نص تفصل بين قيمه علامات Tab. هذا يكفي لنطاق صغير، لكن العلامات لا تظهر في مربع المحادثة، فيضطر القارئ، إنسانًا كان أو ذكاءً اصطناعيًا، إلى عدّها ليعرف أي قيمة تتبع أي عمود. والخلايا الفارغة تزيد الأمر صعوبة.', 'أما إرفاق ملف .xlsx فيرسل المصنف كله: كل الأوراق، بما فيها المخفية، وكل ما خُزّن فيه. وفي الغالب تريد قراءة جدول واحد فقط. التحويل أولًا يجعلك تختار بالضبط ما يغادر جهازك، وتراه قبل أن ترسله.'],
        },
        {
          heading: 'جدول Markdown أم CSV؟',
          paragraphs: ['كلاهما يعمل، والفرق بين سهولة القراءة والحجم. في تجربتنا أخذ جدول تجريبي (100 طلب في 5 أعمدة) 2,449 رمزًا كجدول Markdown و2,148 رمزًا كملف CSV، أي أن نسخة Markdown أكبر بنحو 14%. الرموز الزائدة هي الخطوط العمودية وسطر الفصل.'],
          list: [
            'اختر جدول Markdown حين يكون الجدول صغيرًا أو متوسطًا، أو حين تحتوي الخلايا على فواصل، أو حين تريد أن تعرض لك المحادثة الجدول نفسه في ردها.',
            'اختر CSV حين يكون الجدول كبيرًا وكل رمز محسوبًا. أداة تحويل Excel إلى CSV تعطيك الملف؛ افتحه في أي محرر نصوص والصق نصه.',
            'ولقوائم السجلات بصيغة جيسون قد تكون صيغة TOON أقصر؛ اقرأ ما هي صيغة TOON ومتى توفّر الرموز.',
          ],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }, { text: 'ما هي صيغة TOON ومتى توفّر الرموز', path: '/what-is-toon-format' }],
        },
        {
          heading: 'ورقة واحدة في كل مرة',
          paragraphs: ['تحوّل أداة Excel إلى Markdown الورقة التي تختارها من قائمة الأوراق، جدولًا واحدًا في كل تحويل. وهذا مقصود: ورقتان بأعمدة مختلفة في كتلة واحدة تُربكان القارئ فلا يعرف أين ينتهي الجدول الأول. إن احتاجت المحادثة ورقتين فالصقهما جدولين، كلًّا تحت سطر مثل «الورقة: ميزانية 2026».', 'ولتعرف كم يكلّف المصنف كله قبل أن تقرر، أسقطه في عدّاد الرموز: فهو يعدّ كل الأوراق، كل واحدة منها جدول Markdown تحت اسم ورقتها.'],
          links: [{ text: 'عدّاد الرموز', path: '/token-counter' }],
        },
        {
          heading: 'المعادلات أم القيم الظاهرة؟',
          paragraphs: ['يحمل الجدول كل خلية كما يعرضها اكسل. المعادلة تظهر بنتيجتها، والتواريخ والنسب المئوية والأسعار تحتفظ بتنسيقها، فالقيمة 0.15 المنسّقة نسبةً مئوية تصل 15%. وهذا ما تريد عادةً أن تفكر فيه المحادثة.', 'أما المعادلات نفسها فليست في الجدول. إن أردت أن تراجع المحادثة معادلة أو تشرحها، فانسخها من شريط الصيغة والصقها في سطر مستقل مع اسم الخلية التي فيها. الخلايا المدمجة تعطي قيمتها لأول خلية في النطاق، والألوان والخطوط والتعليقات لا تُنقل، فإن كان للون معنى فأضف عمودًا يقوله بالكلمات.'],
        },
        {
          heading: 'متى يكون الجدول أكبر من اللازم؟',
          paragraphs: ['تقيس المحادثات ما تلصقه بالرموز، والحد يختلف باختلاف النموذج وخطة اشتراكك. والنصوص الطويلة قد تُرفض أو تُقطع أو تُجاب بعناية أقل كلما اقتربت من نهايتها. لذا عُدّ أولًا: يعرض عدّاد الرموز رموز الملف أو النص الملصوق وكلماته وحروفه داخل متصفحك. وهو يعدّ بطريقة أحد المقسّمات الشائعة، فالرقم تقريبي للنماذج الأخرى.', 'إن كان الرقم كبيرًا فصغّر الجدول قبل لصقه:'],
          list: [
            'احذف الأعمدة التي لا يحتاجها سؤالك. المعرّفات والرموز الداخلية والملاحظات الطويلة كثيرًا ما تكون الأكبر.',
            'أبقِ الصفوف التي يدور حولها السؤال فقط، أو أرسل ملخصًا بدلها تصنعه بأداة الجدول المحوري.',
            'قسّم الجدول الطويل إلى أجزاء بأداة تقسيم CSV وأرسلها رسالةً رسالة.',
          ],
          links: [{ text: 'عدّاد الرموز', path: '/token-counter' }, { text: 'الجدول المحوري', path: '/pivot-table' }, { text: 'تقسيم CSV', path: '/split-csv' }],
        },
        {
          heading: 'أخفِ البيانات الشخصية أولًا',
          paragraphs: ['بعد اللصق تصبح البيانات على خوادم خدمة المحادثة وتحت قواعدها لا قواعدك. إن كانت الورقة تضم أسماء عملاء أو إيميلات أو أرقام جوال أو أرقام هوية، فمرّرها على أداة إخفاء البيانات الحساسة قبل التحويل. تجد الأداة هذه الأعمدة وتستبدل كل قيمة برمز مثل EMAIL-000001، وتعطي القيمة نفسها الرمز نفسه في كل مكان، فتبقى المحادثة قادرة على العدّ والتجميع والمقارنة. واحتفظ بالمفتاح الخاص إن أردت إعادة القيم الحقيقية لاحقًا. ويشرح دليل إخفاء البيانات الشخصية قبل مشاركة الملف الخيارات المتاحة.'],
          links: [{ text: 'إخفاء البيانات الحساسة', path: '/mask-data' }, { text: 'دليل إخفاء البيانات الشخصية قبل مشاركة الملف', path: '/anonymize-data-before-sharing' }],
        },
        {
          heading: 'خطوة بخطوة',
          paragraphs: ['العملية كلها تستغرق دقيقة، ويقرأ متصفحك المصنف في كل خطوة:'],
          list: [
            'أخفِ البيانات الشخصية في المصنف إن وُجدت، واحفظ النسخة المُخفاة.',
            'افتح تحويل Excel إلى Markdown، واختر المصنف ثم الورقة.',
            'انسخ الجدول، والصقه في عدّاد الرموز إن لم تكن متأكدًا من حجمه، واختصره عند الحاجة.',
            'في المحادثة اكتب جملة عن الجدول (ماذا يمثّل كل صف، وما معنى كل عمود غير واضح)، ثم الصق الجدول واطرح سؤالك.',
          ],
          links: [{ text: 'تحويل Excel إلى Markdown', path: '/excel-to-markdown' }],
        },
        {
          heading: 'ملفات أخرى',
          paragraphs: ['الفكرة نفسها تصلح للمستندات: ملف PDF فيه جداول يمر عبر تحويل PDF إلى Markdown، ودليلا مستندات Word وعروض PowerPoint يشرحان ما يخص كلًّا منهما. ولملف CSV تؤدي أداة تحويل CSV إلى Markdown عمل أداة اكسل نفسه.'],
          links: [{ text: 'تحويل PDF إلى Markdown', path: '/pdf-to-markdown' }, { text: 'مستندات Word', path: '/word-document-to-ai-chat' }, { text: 'عروض PowerPoint', path: '/powerpoint-to-ai-chat' }, { text: 'تحويل CSV إلى Markdown', path: '/csv-to-markdown' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف الورقة وما أخطأت فيه المحادثة (دون بيانات شخصية).`],
        },
      ],
    },
    '/make-markdown-table-from-csv': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['افتح ملف CSV أو الصق نصه في أداة تحويل CSV إلى Markdown: يصبح الصف الأول رأس الجدول، يليه سطر الفصل، ثم يصبح كل صف آخر سطرًا واحدًا بين خطوط عمودية. انسخ النتيجة إلى ملف README على GitHub أو إلى بلاغ (issue) أو توثيق أو محادثة، أو نزّلها ملف .md. والخطوط العمودية داخل الخلايا تُعالَج تلقائيًا فتبقى الأعمدة في مكانها.'],
          links: [{ text: 'تحويل CSV إلى Markdown', path: '/csv-to-markdown' }],
        },
        {
          heading: 'مِمَّ يتكوّن جدول Markdown',
          paragraphs: ['جدول Markdown نص عادي يرسمه GitHub وGitLab ومعظم محررات Markdown جدولًا. وله ثلاثة أجزاء:'],
          list: [
            'سطر الرأس: أسماء الأعمدة بين خطوط عمودية، مثل | Item | Qty | Price |.',
            'سطر الفصل: ثلاث شرطات لكل عمود، مثل | --- | --- | --- |. ومن دونه تظهر الأسطر نصًا عاديًا.',
            'سطر لكل صف، وخلاياه بترتيب الرأس نفسه.',
          ],
        },
        {
          heading: 'محاذاة الأعمدة',
          paragraphs: ['تكتب الأداة فواصل --- بسيطة، ومعظم القارئات تعرضها بمحاذاة إلى اليسار. لتغيير محاذاة عمود عدّل جزءه من سطر الفصل بعد اللصق: :--- لليسار، و:---: للوسط، و---: لليمين. محاذاة أعمدة الأرقام إلى اليمين تسهّل مقارنة الأسعار والمجاميع. يتغيّر سطر الفصل وحده وتبقى الخلايا كما هي. يلتزم GitHub وGitLab بهذه النقطتين، وبعض المحررات البسيطة تتجاهلهما وتعرض الأعمدة كلها بالطريقة نفسها.'],
        },
        {
          heading: 'الخط العمودي وفواصل الأسطر ورموز أخرى في الخلايا',
          paragraphs: ['لأن الخط العمودي | يحدد حدود العمود، فإن ظهوره داخل خلية يقسمها إلى اثنتين. لذلك تكتبه الأداة \\|، فتعرضه القارئات خطًا عاديًا. وهناك حالات أخرى تستحق المعرفة:'],
          list: [
            'فاصل السطر داخل الخلية يُكتب <br>. يعرضه GitHub سطرًا جديدًا داخل الخلية، وبعض المحررات تعرض الوسم نصًا، فاختصر هذه الخلايا إن كان الجدول ذاهبًا إلى مكان آخر.',
            'تنسيق Markdown داخل الخلايا يعمل: *نص* يصبح مائلًا وعلامات backtick تجعله كودًا. إن كانت في خلية نجوم أو شرطات سفلية يجب أن تبقى كما هي، فراجع الجدول بعد عرضه.',
            'الحروف العربية تبقى كما هي في ملف UTF-8 أو ملف CSV عربي من ويندوز، والحروف ذات العلامات تبقى كما هي في ملف UTF-8 أو ملف CSV من ويندوز بلغات أوروبا الغربية. ويُكتشف الفاصل (فاصلة أو فاصلة منقوطة أو Tab أو خط عمودي) من الملف، فيحتفظ ملف CSV مفصول بفواصل منقوطة حفظه اكسل في أوروبا بأعمدته.',
          ],
        },
        {
          heading: 'صف الرأس يحدد الأعمدة',
          paragraphs: ['جدول Markdown يحتاج إلى رأس، لذلك يصبح الصف الأول من ملف CSV رأسًا دائمًا. إن لم يكن في ملفك صف رأس فأضف واحدًا في عارض CSV قبل التحويل، ولو كان «عمود 1، عمود 2».', 'والرأس يحدد أيضًا عدد الأعمدة. الصف الذي خلاياه أقل تُضاف إليه خلايا فارغة في آخره، والصف الذي خلاياه أكثر من الرأس تُحذف خلاياه الزائدة. سمِّ كل عمود فلا يضيع شيء.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'الجداول العريضة والطويلة',
          paragraphs: ['لا حدّ في Markdown لعدد الأعمدة، لكن للقارئ حدّ. على GitHub يُمرَّر الجدول العريض أفقيًا، وعلى الجوال يصعب تتبّع أكثر من خمسة أو ستة أعمدة. إن كان الجدول ليقرأه الناس:'],
          list: [
            'احذف الأعمدة التي لا يحتاجها القراء قبل التحويل.',
            'إن كانت الصفوف قليلة والأعمدة كثيرة فاقلبها بأداة تبديل الصفوف والأعمدة ليصبح كل حقل صفًا.',
            'احتفظ بالبيانات كاملة في ملف CSV داخل المستودع، واعرض جدولًا قصيرًا يربط إليه.',
          ],
          links: [{ text: 'تبديل الصفوف والأعمدة', path: '/transpose' }],
        },
        {
          heading: 'ما لا يستطيع جدول Markdown حمله',
          paragraphs: ['هذه الحدود من Markdown نفسه لا من الأداة، فلا تتجاوزها أي أداة:'],
          list: [
            'لا خلايا مدمجة ولا خلايا تمتد عبر صفوف: التخطيطات المعقدة تصبح صفوفًا بسيطة.',
            'لا ألوان ولا خطوط ولا حدود خلايا؛ الشكل يأتي من المكان الذي يُعرض فيه الجدول.',
            'لا معادلات: الجدول يحمل نصًا، فالمجاميع يجب أن تكون في ملف CSV أصلًا.',
            'لا صف رأس ثانٍ؛ إن كان في ملفك صفّا رأس فادمجهما في سطر أسماء واحد أولًا.',
          ],
        },
        {
          heading: 'الجداول الطويلة في الأداة',
          paragraphs: ['تعرض المعاينة أول 5,000 سطر من الجدول، أما زرّا النسخ والتنزيل فيأخذان الجدول كاملًا دائمًا، فلا يُقطع شيء مما تلصقه. ويقرأ متصفحك الملف ولا يرفعه، وهذا مهم حين يكون ملف CSV مُصدَّرًا من نظام عمل.'],
        },
        {
          heading: 'لصق الجدول في محادثة ذكاء اصطناعي',
          paragraphs: ['يسهل على محادثة الذكاء الاصطناعي أن تقرأ جدول Markdown، لأن كل قيمة تقع تحت اسم عمودها. لكن الجدول يكلّف رموزًا أكثر من البيانات نفسها بصيغة CSV، فعُدّ الجداول الكبيرة أولًا بعدّاد الرموز. وإن كانت البيانات في مصنف، فأداة تحويل Excel إلى Markdown تؤدي العمل نفسه ورقةً ورقة، ويشرح دليل إعطاء محادثة الذكاء الاصطناعي جدول بيانات الحجم والمعادلات وإخفاء البيانات الشخصية.'],
          links: [{ text: 'عدّاد الرموز', path: '/token-counter' }, { text: 'تحويل Excel إلى Markdown', path: '/excel-to-markdown' }, { text: 'دليل إعطاء محادثة الذكاء الاصطناعي جدول بيانات', path: '/spreadsheet-to-ai-chat' }],
        },
        {
          heading: 'خطوة بخطوة',
          paragraphs: ['من الملف إلى جدول معروض:'],
          list: [
            'افتح تحويل CSV إلى Markdown واختر ملف .csv أو .tsv، أو الصق نص CSV في المربع.',
            'راجع المعاينة: الرأس، ثم سطر الفصل، ثم سطر لكل صف.',
            'اضغط نسخ، والصق الجدول في README أو البلاغ أو الملاحظة، وعدّل سطر الفصل إن أردت محاذاة.',
            'عاين الصفحة (على GitHub من تبويب Preview) قبل الحفظ أو النشر.',
          ],
          links: [{ text: 'تحويل CSV إلى Markdown', path: '/csv-to-markdown' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} والصق أول سطرين من ملف CSV وأين يظهر الخلل في الجدول (دون بيانات شخصية).`],
        },
      ],
    },
    '/what-is-toon-format': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['TOON (اختصار Token-Oriented Object Notation) صيغة نصية مفتوحة تحمل البيانات نفسها التي يحملها JSON، وصُممت لتستهلك رموزًا (tokens) أقل حين تلصق البيانات في محادثة ذكاء اصطناعي. تكتب قائمة الكائنات ذات المفاتيح نفسها سطرَ رأسٍ واحدًا بأسماء الحقول ثم صفًا من القيم لكل عنصر، وتكتب الكائنات المتداخلة بالمسافات البادئة بدل الأقواس. توفّر كثيرًا في القوائم الطويلة المتشابهة، وقليلًا أو لا شيء في البيانات المتداخلة بعمق أو غير المنتظمة، خصوصًا مقارنةً بجيسون المضغوط.'],
        },
        {
          heading: 'كيف تبدو بجانب JSON',
          paragraphs: ['خذ ثلاثة طلبات تجريبية. جيسون المنسّق يكرر كل مفتاح في كل طلب ويخصص سطرًا لكل قوس، فأخذ 137 رمزًا في تجربتنا. والبيانات نفسها بصيغة TOON أربعة أسطر و60 رمزًا:'],
          list: [
            'orders[3]{id,product,quantity,price,status}:',
            '  1001,Notebook,1,0.5,paid',
            '  1002,Pen,8,13.5,shipped',
            '  1003,Stapler,3,26.5,pending',
          ],
        },
        {
          heading: 'كيف تقرؤها',
          paragraphs: ['السطر الأول يقول: قائمة اسمها orders فيها 3 عناصر، ولها هذه الحقول الخمسة. وكل سطر بعده بمسافة بادئة عنصرٌ واحد، قيمه بترتيب الحقول. ويعمل عدد العناصر وأسماء الحقول كأداة تحقق، فيعرف القارئ متى نقص صف أو زادت فيه قيمة.', 'والبيانات التي ليست قائمة متشابهة تظهر أسطرًا بمسافات بادئة على شكل key: value، قريبًا من YAML. ولا يوضع النص بين علامتي تنصيص إلا عند الحاجة، فرقم إصدار مكتوب "1.2" يحتفظ بعلامتيه ليبقى نصًا ولا يُقرأ رقمًا. أما القائمة المختلطة فيُكتب كل عنصر فيها بعد شرطة.'],
        },
        {
          heading: 'متى توفّر الرموز، في تجربتنا',
          paragraphs: ['حوّلنا ثلاث عينات تجريبية بالمحوّل نفسه وطريقة العدّ نفسها اللذين تستخدمهما صفحة تحويل JSON إلى TOON. والمقارنة تعتمد على شكل جيسون الذي تبدأ منه، لذلك عُدّت كل عينة جيسونًا منسّقًا (بمسافتين للإزاحة) وجيسونًا مضغوطًا (في سطر واحد):'],
          list: [
            '100 طلب بالمفاتيح الخمسة نفسها: 4,291 رمزًا منسّقًا، و2,387 مضغوطًا، و1,571 بصيغة TOON. أي أن TOON أصغر بنسبة 63% من المنسّق و34% من المضغوط.',
            'كائن إعدادات متداخل بعمق خمسة مستويات: 236 منسّقًا، و122 مضغوطًا، و153 بصيغة TOON. أصغر من المنسّق، لكنه أكبر بنسبة 25% من المضغوط.',
            '30 حدثًا بثلاثة أشكال مختلفة: 1,239 منسّقًا، و644 مضغوطًا، و818 بصيغة TOON. أصغر من المنسّق مرة أخرى، وأكبر بنسبة 27% من المضغوط.',
          ],
        },
        {
          heading: 'لماذا يهم شكل البيانات',
          paragraphs: ['توفّر TOON الرموز بكتابة كل مفتاح مرة واحدة للقائمة كلها. فحين تشترك العناصر في مفاتيحها يزول معظم التكرار. أما حين لا توجد قائمة تتشارك مفاتيحها، كما في كائن إعدادات أو خليط من سجلات مختلفة، فلا يوجد ما يُحذف، والمسافات البادئة التي تستخدمها TOON بدل الأقواس تكلّف تقريبًا ما تكلّفه الأقواس. وجيسون المضغوط بلا مسافات بادئة أصلًا، ولهذا تفوّق على TOON في هاتين العينتين.', 'ومقارنة أخرى من التجربة نفسها: الطلبات المئة كجدول CSV عادي أخذت 1,367 رمزًا، أقل من TOON. فللجدول المسطّح الذي لا تداخل فيه يكون CSV أو جدول Markdown خيارًا جيدًا بالقدر نفسه، ويقارن بينهما دليل إعطاء محادثة الذكاء الاصطناعي جدول بيانات.'],
          links: [{ text: 'دليل إعطاء محادثة الذكاء الاصطناعي جدول بيانات', path: '/spreadsheet-to-ai-chat' }],
        },
        {
          heading: 'استخدم TOON حين',
          paragraphs: ['قاعدة سريعة من الأرقام السابقة:'],
          list: [
            'استخدمها للقوائم الطويلة من السجلات ذات المفاتيح نفسها، مثل ردود الواجهات البرمجية والملفات المُصدَّرة والسجلات (logs)، خصوصًا إن كان فيها حقول متداخلة قليلة لا يحملها CSV.',
            'تجاوزها لملفات الإعدادات والمستندات المتداخلة بعمق والقوائم التي تختلف عناصرها كلها، واضغط جيسون بدلًا من ذلك بأداة ضغط JSON.',
            'تجاوزها للبيانات الصغيرة. توفير 50 رمزًا لا يستحق شرح صيغة جديدة للمحادثة.',
          ],
          links: [{ text: 'ضغط JSON', path: '/json-minify' }],
        },
        {
          heading: 'قِس بياناتك أنت',
          paragraphs: ['الصق جيسون في أداة تحويل JSON إلى TOON فتعرض عدد الرموز قبل التحويل وبعده ونسبة التوفير. وعدد «قبل» هو جيسون كما لصقته، فالمنسّق يُظهر توفيرًا أكبر من البيانات نفسها مضغوطة. ولمقارنة منصفة اضغطه أولًا ثم حوّله. والأعداد محسوبة بطريقة أحد المقسّمات الشائعة، فهي تقريبية للنماذج الأخرى، ويستخدم عدّاد الرموز الطريقة نفسها.', 'يجري التحويل في متصفحك ولا يُرسل شيء إلى خادم ولا إلى أي خدمة ذكاء اصطناعي. وإن كانت البيانات تضم أسماء أو إيميلات أو أرقام هوية فأخفِها أولًا بأداة إخفاء البيانات الحساسة.'],
          links: [{ text: 'تحويل JSON إلى TOON', path: '/json-to-toon' }, { text: 'عدّاد الرموز', path: '/token-counter' }, { text: 'إخفاء البيانات الحساسة', path: '/mask-data' }],
        },
        {
          heading: 'هل تفهمها المحادثة؟',
          paragraphs: ['TOON جديدة، ولا تعرفها كل الأدوات باسمها. حين تلصقها في ChatGPT أو Claude أو Gemini قل في جملة واحدة إن البيانات بصيغة TOON وإن السطر الأول يسرد الحقول. وسطر الرأس يجعل الصفوف سهلة المتابعة حتى لقارئ لم يرَ الصيغة من قبل.', 'وTOON تعمل في الاتجاهين: إن ردّت المحادثة بصيغة TOON أو أردت بياناتك كما كانت، فاختر TOON إلى JSON في صفحة تحويل JSON إلى TOON نفسها لتعيدها جيسون عاديًا.'],
          links: [{ text: 'صفحة تحويل JSON إلى TOON', path: '/json-to-toon' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف شكل بياناتك والأعداد التي ظهرت لك (دون بيانات شخصية).`],
        },
      ],
    },
    '/convert-excel-to-json-for-api': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['اجعل الصف الأول في الورقة يحمل أسماء الحقول التي تنتظرها الواجهة البرمجية (API)، ثم افتح المصنف في أداة تحويل Excel إلى JSON. ستحصل على مصفوفة فيها كائن لكل صف، مفاتيحه من صف الرأس، والأرقام فيه أرقام، وtrue وfalse قيم منطقية، والتواريخ نص بصيغة ISO 8601، والخلايا الفارغة null. راجع القيم المهمة لواجهتك، ثم انسخ النتيجة أو نزّل ملف .json.'],
          links: [{ text: 'تحويل Excel إلى JSON', path: '/excel-to-json' }],
        },
        {
          heading: 'الشكل الذي تحصل عليه',
          paragraphs: ['ورقة أعمدتها sku وname وprice وinStock تصبح مصفوفة جيسون مثل هذه، بإزاحة مسافتين:'],
          list: [
            '[ { "sku": "A-100", "name": "Notebook", "price": 4.5, "inStock": true }, { "sku": "A-101", "name": "Pen", "price": 1.2, "inStock": false } ]',
          ],
        },
        {
          heading: 'لماذا مصفوفة كائنات',
          paragraphs: ['مصفوفة الكائنات هي ما تقبله معظم الواجهات البرمجية والتطبيقات لقائمة سجلات، وما تقرؤه معظم لغات البرمجة قائمةً مباشرة. وإن كانت واجهتك تريد القائمة داخل كائن مثل { "items": [...] } فغلّفها في كودك أو عدّلها في عارض JSON. والصفوف الفارغة تمامًا تُتجاوز، فالأسطر الفارغة بين كتل البيانات لا تصبح كائنات فارغة.'],
          links: [{ text: 'عارض JSON', path: '/json-viewer' }],
        },
        {
          heading: 'من صف الرأس إلى المفاتيح',
          paragraphs: ['كل مفتاح يأتي من خلية الرأس فوقه، كما كُتب تمامًا باستثناء المسافات في أوله وآخره. فـ"Unit price" يبقى "Unit price" بمسافته وحرفه الكبير. والواجهات البرمجية تنتظر عادةً أسماء مثل unitPrice أو unit_price، فأعد تسمية خلايا الرأس لتطابق الواجهة قبل التحويل؛ إنها التغيير الوحيد الذي يوفّر أكبر قدر من العمل لاحقًا. وقاعدتان تغطيان الحالات الناقصة:'],
          list: [
            'خلية الرأس الفارغة تصبح حرف عمودها، مثل C.',
            'الرأس المكرر يأخذ رقمًا: Price الثاني يصبح Price_2، والثالث Price_3.',
          ],
        },
        {
          heading: 'الأرقام والنصوص',
          paragraphs: ['الخلية التي تحمل رقمًا تصبح رقمًا في جيسون، بقيمتها المخزنة لا بالتنسيق الذي يعرضه اكسل. وهذا مهم في مواضع قليلة:'],
          list: [
            'خلية تظهر 15% تصبح 0.15، وسعر يظهر 1,200.00 يصبح 1200.',
            'رمز مخزّن رقمًا يفقد أصفاره البادئة: 00123 المعروض بتنسيق أرقام يصبح 123. خزّن هذه الرموز نصًا في اكسل (نسّق العمود نصًا ثم اكتبها من جديد) فتصل "00123".',
            'يحفظ اكسل 15 رقمًا معنويًا فقط في الرقم، فالأرقام المرجعية الطويلة يجب أن تُخزَّن نصًا قبل كتابتها، وإلا قرّبها المصنف نفسه.',
            'TRUE وFALSE تصبحان true وfalse. والنص يبقى نصًا حتى لو بدا رقمًا.',
          ],
        },
        {
          heading: 'التواريخ',
          paragraphs: ['خلية التاريخ تصبح نصًا بصيغة ISO 8601 مثل "2026-01-05T00:00:00.000Z"، وهي صيغة تقرؤها كل لغات البرمجة. ويبقى اليوم هو اليوم المكتوب في الخلية مهما كانت المنطقة الزمنية لجهازك. وإن كانت واجهتك تريد التاريخ وحده فخذ أول 10 حروف (2026-01-05) في كودك. أما التاريخ المكتوب نصًا، في عمود منسّق نصًا مثلًا، فيبقى كما كُتب تمامًا، فتأكد أن عمود التاريخ يحمل تواريخ حقيقية.'],
        },
        {
          heading: 'الخلايا الفارغة والمعادلات',
          paragraphs: ['الخلية الفارغة تصبح null، فيحمل كل كائن المفاتيح نفسها، وهذا ما تنتظره معظم الواجهات البرمجية وفحوص المخططات. وإن كانت واجهتك تريد حذف الحقول الناقصة بدلًا من ذلك فاحذف قيم null في كودك. والمعادلة تصبح قيمتها؛ أما المعادلة نفسها والتنسيق والرسوم البيانية والصور فلا تنتقل إلى جيسون.'],
        },
        {
          heading: 'أي ورقة',
          paragraphs: ['تحوّل أداة Excel إلى JSON الورقة الأولى. ولورقة أخرى افتح المصنف في عارض Excel، واضغط تبويب الورقة، ثم اضغط «تحويل» في الأعلى واختر «تحويل إلى JSON». والعارض أيضًا مكان سريع لإعادة تسمية خلايا الرأس أولًا: فالتحويل يأخذ الورقة مع تعديلاتك.'],
          links: [{ text: 'Excel إلى JSON', path: '/excel-to-json' }, { text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'قبل أن ترسلها إلى الواجهة البرمجية',
          paragraphs: ['تُفتح النتيجة في عارض JSON، حيث تقرؤها شجرةً أو جدولًا، وتصحح القيم وتضغطها. وهذه خطوات تالية تفيد حين يغذّي جيسون كودًا:'],
          list: [
            'اكتب مخططًا (schema) من النتيجة بأداة JSON Schema، وافحص به الملفات اللاحقة.',
            'احصل على واجهات TypeScript للسجلات بأداة تحويل JSON إلى TypeScript.',
            'إن كانت الورقة تضم أسماء عملاء أو إيميلات أو أرقام جوال وكان جيسون بيانات اختبار، فأخفِها أولًا بأداة إخفاء البيانات الحساسة.',
          ],
          links: [{ text: 'JSON Schema', path: '/json-schema' }, { text: 'تحويل JSON إلى TypeScript', path: '/json-to-typescript' }, { text: 'إخفاء البيانات الحساسة', path: '/mask-data' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} مع صف الرأس وصف واحد مختلَق من الورقة، وجيسون الذي تنتظره واجهتك (دون بيانات شخصية).`],
        },
      ],
    },
    '/pdf-to-ai-chat-with-tables': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['حوّل ملف بي دي اف إلى Markdown أولًا والصق الناتج، لا النص المنسوخ من الملف مباشرة. فملف PDF يحفظ الكلمات في مواضع على الصفحة، لا في صفوف وأعمدة، لذلك يختلط محتوى خلايا الجدول عند النسخ العادي؛ أما Markdown فيكتب كل صف في سطر مستقل وبين الخلايا علامة |، فيقرؤه ChatGPT وClaude وGemini جدولًا. أداة تحويل PDF إلى Markdown في OpenAnyDoc تفعل ذلك داخل متصفحك، ولا يُرفع الملف أبدًا.'],
          links: [{ text: 'تحويل PDF إلى Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'لماذا تتفكك الجداول عند نسخها من PDF',
          paragraphs: [
            'صُمّم PDF للطباعة. والجدول داخل الملف ليس جدولًا فعلًا، بل قطع نصية قصيرة، كل قطعة في موضع محدد على الصفحة، مع خطوط مرسومة حولها. ولا شيء في الملف يقول إن «الشمال» و«1,240» في الصف نفسه.',
            'حين تحدد جدولًا وتنسخه، يخمّن قارئ PDF ترتيبًا ويصل القطع بمسافات أو أسطر جديدة. فقد يصل صف مثل المنطقة والكمية والإجمالي في ثلاثة أسطر منفصلة، أو في سطر طويل لا تعرف فيه أي رقم يتبع أي عمود. ثم تضطر محادثة الذكاء الاصطناعي إلى تخمين التخطيط من جديد، والتخمين الخاطئ يظهر إجماليًا في غير صفه أو ملخصًا يخلط عمودين.',
            'وإرفاق ملف PDF بالمحادثة لا يحل المشكلة: فالخدمة تستخرج النص من الملف بطريقتها، ولا ترى ما قرأته قبل أن تجيب. كما أنه يرسل الملف كله إلى تلك الخدمة، بما فيه صفحات لم تكن بحاجة إلى مشاركتها.',
          ],
        },
        {
          heading: 'لماذا يحافظ Markdown على الصفوف والأعمدة',
          paragraphs: ['Markdown نص عادي مع علامات قليلة تدل على البنية. يُكتب الجدول صفًا صفًا، وبين الخلايا علامة |، وتحت صف العناوين سطر من الشرطات، مثل:'],
          list: [
            '| المنطقة | الكمية | الإجمالي |',
            '|---|---|---|',
            '| الشمال | 120 | 1,240 |',
          ],
        },
        {
          heading: 'صفوف وأعمدة يمكنك مراجعتها',
          paragraphs: ['كل محادثة ذكاء اصطناعي تقرأ Markdown تفهم هذا التخطيط، وأنت كذلك: الخلايا أمام عينيك، فتراجعها قبل أن ترسل شيئًا. والعناوين المعلّمة بـ # والقوائم المعلّمة بـ - تنتقل بالطريقة نفسها، فتميّز المحادثة عنوان القسم من النص الذي تحته.'],
        },
        {
          heading: 'الخطوات',
          paragraphs: ['تعمل أداة تحويل PDF إلى Markdown على حاسوبك أو هاتفك، ولا يُرسل شيء إلى خادم أو إلى أي خدمة ذكاء اصطناعي:'],
          list: [
            'افتح أداة تحويل PDF إلى Markdown واختر ملفك، أو أسقطه على الصفحة.',
            'اضغط «تحويل إلى Markdown». النص الأكبر بوضوح من متن الصفحة يصبح عناوين #، ## أو ###، والأسطر التي تبدأ بنقطة أو رقم تصبح قوائم، وثلاثة أسطر متتالية أو أكثر مقسومة إلى العدد نفسه من الأعمدة تصبح جدول Markdown.',
            'اقرأ الناتج في مربع النص. راجع كل جدول وقارن بعض الأرقام بملف PDF.',
            'اضغط «نسخ» والصقه في المحادثة، أو نزّله بصيغة ‎.md أو ‎.txt أو ‎.html. ويخبرك عدد الرموز تحت الناتج بمقدار ما سيشغله من المحادثة.',
          ],
          links: [{ text: 'تحويل PDF إلى Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'إذا خرج الجدول خاطئًا',
          paragraphs: ['تُكتشف الجداول من اصطفاف النص، فبعض الملفات تحتاج إلى مساعدة:'],
          list: [
            'الناتج فارغ: الملف ممسوح ضوئيًا على الأرجح، أي أن صفحاته صور بلا نص. شغّل التعرف الضوئي على النص OCR أولًا، ثم حوّل الملف الجديد. والتعرف الضوئي يقرأ الجداول أسطرًا من الكلمات، فراجعها جيدًا.',
            'الخلايا المدمجة، والخلايا التي يلتف نصها إلى سطر ثانٍ، والخلايا الفارغة قد تحوّل الجدول إلى أسطر نص عادية.',
            'الصفحات المكتوبة في عمودين قد تحتاج إلى مراجعة ترتيب القراءة.',
            'الصور والرسوم البيانية لا تُنقل؛ يُحوَّل النص وحده.',
          ],
          links: [{ text: 'التعرف الضوئي على النص OCR', path: '/ocr-pdf' }],
        },
        {
          heading: 'لجدول كبير أو مضطرب',
          paragraphs: ['إن كان ما تحتاجه جدولًا كبيرًا واحدًا، فأداة تحويل PDF إلى Excel تضع كل صفحة في ورقة خاصة بها، فتصلح الخلية التي في غير مكانها بيدك. ثم تحوّل أداة Excel إلى Markdown الورقة التي تختارها إلى جدول Markdown نظيف للصق.'],
          links: [{ text: 'تحويل PDF إلى Excel', path: '/pdf-to-excel' }, { text: 'Excel إلى Markdown', path: '/excel-to-markdown' }],
        },
        {
          heading: 'راجع هذه قبل اللصق',
          paragraphs: ['دقائق قليلة هنا تمنعك من مشاركة أكثر مما قصدت:'],
          list: [
            'البيانات الشخصية: الأسماء وعناوين البريد وأرقام الهواتف وأرقام الهوية. أداة إخفاء البيانات تستبدلها على جهازك؛ وهي تقرأ الملفات النصية، فغيّر امتداد ملف ‎.md الذي نزّلته إلى ‎.txt وافتحه فيها.',
            'الطول: إن كان عدد الرموز كبيرًا، فالصق الصفحات أو الجدول الذي تحتاجه فقط. ويشرح دليل كم رمزًا يستهلك ملف PDF هذه الأرقام.',
            'قواعد جهتك: إن كان الملف من العمل، فاتبع قواعد جهتك بشأن خدمات الذكاء الاصطناعي التي يجوز أن تطّلع عليه.',
          ],
          links: [{ text: 'إخفاء البيانات', path: '/mask-data' }, { text: 'كم رمزًا يستهلك ملف PDF', path: '/how-many-tokens-is-my-pdf' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف الجدول الذي لم يخرج كما ينبغي (دون بيانات شخصية).`],
        },
      ],
    },
    '/how-many-tokens-is-my-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لا يوجد عدد ثابت من الرموز (Tokens) لكل صفحة: يعتمد العدد على كمية الكلمات في الصفحة، ولغتها، وهل هي جداول في معظمها، وأي نموذج ذكاء اصطناعي يقرؤها. في تجربتنا، جاءت صفحة من 415 كلمة إنجليزية في 467 رمزًا، والنص نفسه بالعربية في 571 رمزًا، وصفحة فيها جدول واحد من 40 صفًا في 889 رمزًا. ولتعرف رقم ملفك أنت، أسقطه في عدّاد الرموز في OpenAnyDoc، فيعدّه داخل متصفحك دون رفعه.'],
          links: [{ text: 'عدّاد الرموز', path: '/token-counter' }],
        },
        {
          heading: 'ما الرمز (Token)؟',
          paragraphs: [
            'نموذج الذكاء الاصطناعي لا يقرأ حروفًا ولا كلمات، بل يقرأ رموزًا: قطعًا من النص يعامل كلًّا منها وحدة واحدة. الكلمة القصيرة الشائعة رمز واحد غالبًا، والكلمة الطويلة أو النادرة تُقسم إلى عدة رموز، وعلامات الترقيم والأرقام والمسافات تأخذ رموزًا أيضًا.',
            'وعدّ الكلمات شيء آخر. ففي صفحتنا الإنجليزية التجريبية أدناه، جاءت 415 كلمة في 467 رمزًا، أي أكثر قليلًا من رمز لكل كلمة، لكن هذه النسبة تتغير من ملف إلى آخر.', 'حدود المحادثة وحدود الملفات وأسعار خدمات الذكاء الاصطناعي تُحسب كلها بالرموز. والمحادثة الطويلة تحسب أيضًا كل ما قيل قبلها والإجابة التي تُكتب، فالمستند الذي يكاد يتسع قد لا يترك مكانًا كافيًا للرد.',
          ],
        },
        {
          heading: 'لماذا لا يكفي عدد الصفحات',
          paragraphs: ['«عشر صفحات» قد تعني كميات مختلفة جدًا من النص. قسنا ثلاث صفحات تجريبية بالعدّاد نفسه الذي يستخدمه الموقع:'],
          list: [
            'صفحة تقرير بنص إنجليزي عادي، 415 كلمة: 467 رمزًا.',
            'التقرير نفسه مكتوبًا بالعربية، 319 كلمة: 571 رمزًا، أي نحو الخُمس أكثر للمعنى نفسه.',
            'صفحة فيها جدول واحد من 40 صفًا و5 أعمدة (رموز أصناف ومناطق وأسعار وإجماليات)، 247 كلمة: 889 رمزًا، أي قرابة ضعف صفحة النص مع كلمات أقل.',
            'صفحة ممسوحة ضوئيًا: صفر رموز حتى يضيف التعرف الضوئي نصها، لأن الصفحة مجرد صورة.',
          ],
        },
        {
          heading: 'من أين تأتي الفروق',
          paragraphs: [
            'الجداول أغلى لأن الأرقام والرموز وعلامات | بين الخلايا قطع قصيرة نادرًا ما تُجمع في رمز واحد. وحجم الخط والهوامش والصور تغيّر أصلًا عدد الكلمات التي تتسع لها الصفحة.',
            'واللغة مهمة لأن أدوات الترميز تتعلم قطعها من النصوص، ومعظم تلك النصوص إنجليزية. فالكلمة الإنجليزية رمز واحد في الغالب، أما الكلمة العربية بما يتصل بها من سوابق ولواحق فتُقسم أكثر. ولهذا كانت الصفحة العربية أعلاه أقل كلمات وأكثر رموزًا.',
          ],
        },
        {
          heading: 'لماذا يهم النموذج',
          paragraphs: ['لكل نموذج ذكاء اصطناعي أداة ترميز خاصة به، فيعطي الملف نفسه رقمًا مختلفًا في كل نموذج. يعدّ OpenAnyDoc بأداة ترميز قياسية واحدة تشترك فيها بعض النماذج الواسعة الانتشار. أما النماذج الأخرى، ومنها Claude وGemini، فالعدد بالنسبة لها تقديري، قريب في العادة لكنه ليس دقيقًا. وإن كان الملف قريبًا من الحد، فاترك هامشًا ولا تعتمد على آخر بضع مئات من الرموز.'],
        },
        {
          heading: 'كيف تعدّ رموز ملفك بدقة',
          paragraphs: ['يقرأ عدّاد الرموز الملف على جهازك، ولا يُرسل شيء إلى خادم أو إلى أي خدمة ذكاء اصطناعي:'],
          list: [
            'افتح عدّاد الرموز واختر ملف PDF، أو أسقطه على الصفحة. وتعمل ملفات وورد وبوربوينت وExcel وCSV وJSON وTXT وMarkdown أيضًا، أو يمكنك لصق نص.',
            'يتحول ملف PDF إلى Markdown نفسه الذي تنتجه أداة تحويل PDF إلى Markdown، فتعدّ النص الذي ستلصقه فعلًا.',
            'اقرأ عدد الرموز والكلمات والأحرف تحت مربع النص.',
            'مربع النص قابل للتعديل: احذف الأجزاء التي لن تلصقها فيتحدّث العدد.',
          ],
          links: [{ text: 'عدّاد الرموز', path: '/token-counter' }, { text: 'تحويل PDF إلى Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'إذا كان العدد كبيرًا',
          paragraphs: ['أرسل أقل بدل أن تأمل أن تتحمل المحادثة:'],
          list: [
            'احتفظ بالصفحات التي تحتاجها فقط بأداة استخراج صفحات PDF، ثم عدّ من جديد.',
            'قسّم التقرير الطويل إلى أجزاء بأداة تقسيم PDF، والصق جزءًا في كل مرة، واطلب من المحادثة أن تنتظر حتى يصل الجزء الأخير.',
            'لقوائم السجلات في JSON، تكتب أداة تحويل JSON إلى TOON البيانات نفسها بصيغة أقصر.',
            'إن كان العدد صفرًا، فالملف ممسوح ضوئيًا؛ شغّل التعرف الضوئي على النص أولًا.',
            'الجداول هي الأغلى، فالصقها بصيغة تقرؤها المحادثة. ويشرح دليل إعطاء ChatGPT ملف PDF دون فقدان الجداول الطريقة.',
          ],
          links: [{ text: 'استخراج صفحات PDF', path: '/extract-pdf-pages' }, { text: 'تقسيم PDF', path: '/split-pdf' }, { text: 'تحويل JSON إلى TOON', path: '/json-to-toon' }, { text: 'التعرف الضوئي على النص', path: '/ocr-pdf' }, { text: 'إعطاء ChatGPT ملف PDF دون فقدان الجداول', path: '/pdf-to-ai-chat-with-tables' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف الملف والعدد الذي تراه (دون بيانات شخصية).`],
        },
      ],
    },
    '/word-document-to-ai-chat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['حوّل ملف وورد ‎.docx إلى Markdown والصق الناتج. يعلّم Markdown عناوين وورد بـ # و## و###، ويُبقي القوائم النقطية والمرقّمة قوائم، ويحفظ الروابط بعناوينها، فيتابع ChatGPT أو Claude أو Gemini مخطط المستند. أداة تحويل Word إلى Markdown في OpenAnyDoc تفعل ذلك داخل متصفحك دون رفع الملف. وتصبح الجداول جداول Markdown أيضًا.'],
          links: [{ text: 'تحويل Word إلى Markdown', path: '/word-to-markdown' }],
        },
        {
          heading: 'ما الذي يضيع حين تنسخ من وورد',
          paragraphs: [
            'يُظهر وورد البنية بالأنماط: العنوان فقرة بنمط «عنوان 1»، والقائمة فقرة فُعّل فيها الترقيم. وكثير من مربعات المحادثة يحتفظ بالنص العادي فقط مما تلصقه، فتضيع الأنماط ويبدو عنوان القسم كأي سطر آخر. وفي المستند الطويل يضطر الذكاء الاصطناعي إلى تخمين أين ينتهي جزء ويبدأ آخر.',
            'وإرفاق ملف ‎.docx بدلًا من ذلك يرسل الملف كله إلى خدمة الذكاء الاصطناعي، بما فيه التعليقات والتغييرات المتعقَّبة أو النص المخفي الذي ربما نسيته، ولا ترى أي أجزاء قرأتها فعلًا.',
          ],
        },
        {
          heading: 'ما الذي يحفظه Markdown',
          paragraphs: ['يحمل Markdown البنية بحروف عادية، فتبقى مهما لصقته:'],
          list: [
            'العناوين: أنماط العناوين في وورد تصبح # و## و###.',
            'النص العريض والمائل يحتفظ بعلاماته.',
            'القوائم النقطية والمرقّمة تبقى قوائم، والنقاط الفرعية مزاحة تحت أصلها.',
            'الروابط تحتفظ بعناوينها.',
            'الصور والرسوم البيانية والأشكال لا تُنقل؛ يُحوَّل النص وحده.',
          ],
        },
        {
          heading: 'الخطوات',
          paragraphs: ['تعمل أداة تحويل Word إلى Markdown على جهازك، ولا يُرسل شيء إلى خادم أو إلى أي خدمة ذكاء اصطناعي:'],
          list: [
            'افتح أداة تحويل Word إلى Markdown واختر ملف ‎.docx أو ‎.dotx أو ‎.docm، أو أسقطه على الصفحة.',
            'يظهر Markdown في مربع نص، مع عدد الرموز.',
            'اقرأه، ثم اضغط «نسخ» والصقه في المحادثة، أو نزّل ملف ‎.md.',
          ],
          links: [{ text: 'تحويل Word إلى Markdown', path: '/word-to-markdown' }],
        },
        {
          heading: 'اضبط العناوين في وورد أولًا',
          paragraphs: [
            'تُعرف العناوين من أنماط العناوين في وورد، لا من شكل النص. فالسطر الذي جعلته عريضًا وكبيرًا بيدك يبقى فقرة عادية. قبل التحويل، ضع المؤشر في عنوان كل قسم واختر «عنوان 1» أو «عنوان 2» أو «عنوان 3» من قائمة الأنماط؛ ويُظهر لك جزء التنقل في وورد العناوين التي يراها عناوين فعلًا.',
            'ملفات ‎.doc القديمة وملفات OpenDocument بصيغة ‎.odt لا تُقرأ هنا. افتحها في وورد أو LibreOffice واحفظها بصيغة ‎.docx أولًا. وإن أردت قراءة ملف ‎.odt فقط، فعارض وورد يفتحه.',
          ],
          links: [{ text: 'عارض وورد', path: '/word-viewer' }],
        },
        {
          heading: 'الجداول',
          paragraphs: ['تحوّل أداة Word إلى Markdown كل جدول إلى جدول Markdown، ويصبح الصف الأول من الجدول صف العناوين، فتقرأ محادثة الذكاء الاصطناعي الصفوف والأعمدة بدل خلايا متفرقة. ولا توجد خلايا مدمجة في Markdown، فيخرج الجدول ذو الخلايا المدمجة أو الجدول داخل جدول مسطّحًا. وحين يهمك جدول كهذا، انسخه من وورد إلى جدول بيانات مثل Excel أو LibreOffice Calc، وأصلح ترتيبه هناك واحفظه بصيغة ‎.xlsx؛ ثم تحوّل أداة Excel إلى Markdown تلك الورقة إلى جدول Markdown نظيف تلصقه تحت بقية المستند. والفكرة نفسها تنفع مع جدول داخل ملف PDF؛ راجع دليل إعطاء محادثة ذكاء اصطناعي ملف PDF دون فقدان الجداول.'],
          links: [{ text: 'Excel إلى Markdown', path: '/excel-to-markdown' }, { text: 'إعطاء محادثة ذكاء اصطناعي ملف PDF دون فقدان الجداول', path: '/pdf-to-ai-chat-with-tables' }],
        },
        {
          heading: 'قبل اللصق',
          paragraphs: ['فحصان يستحقان الدقيقة التي يأخذانها:'],
          list: [
            'البيانات الشخصية: العقود والتقارير والخطابات تحوي غالبًا أسماء أو عناوين بريد أو أرقام هواتف أو أرقام هوية. أداة إخفاء البيانات تستبدلها على جهازك؛ وهي تقرأ الملفات النصية، فغيّر امتداد ملف ‎.md الذي نزّلته إلى ‎.txt وافتحه فيها.',
            'الطول: يبيّن عدد الرموز تحت الناتج مقدار ما سيشغله المستند من المحادثة. ويشرح عدّاد الرموز هذا الرقم، والنماذج الأخرى تعدّ بطريقة مختلفة قليلًا.',
          ],
          links: [{ text: 'إخفاء البيانات', path: '/mask-data' }, { text: 'عدّاد الرموز', path: '/token-counter' }],
        },
        {
          heading: 'اطلب بحسب القسم',
          paragraphs: ['بعد أن يصل Markdown إلى المحادثة، تستطيع الإشارة إلى أجزاء المستند بعناوينها: أعد كتابة قسم «شروط الدفع» بلغة بسيطة، أو اذكر كل موعد نهائي تحت «التسليم»، أو تحقق من أن الملخص يطابق الأقسام التي بعده. ولا تنجح هذه الطلبات إلا إذا وصلت العناوين، وهذا هو السبب الأهم للتحويل بدل اللصق المباشر.'],
        },
        {
          heading: 'العروض التقديمية وملفات PDF',
          paragraphs: ['العرض التقديمي يحتاج إلى شكل آخر، قسم لكل شريحة مع ملاحظات المتحدث؛ راجع دليل إعطاء محادثة ذكاء اصطناعي عرض بوربوينت. ولملف PDF، استخدم أداة تحويل PDF إلى Markdown.'],
          links: [{ text: 'إعطاء محادثة ذكاء اصطناعي عرض بوربوينت', path: '/powerpoint-to-ai-chat' }, { text: 'تحويل PDF إلى Markdown', path: '/pdf-to-markdown' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف المستند (دون بيانات شخصية).`],
        },
      ],
    },
    '/powerpoint-to-ai-chat': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['حوّل العرض إلى مخطط نصي والصقه: قسم لكل شريحة بعنوانها، ونص الشريحة نقاطًا، وملاحظات المتحدث تحتها. أداة تحويل PowerPoint إلى Markdown في OpenAnyDoc تصنع هذا المخطط من ملف ‎.pptx داخل متصفحك دون رفعه، فيعمل ChatGPT أو Claude أو Gemini شريحة شريحة.'],
          links: [{ text: 'تحويل PowerPoint إلى Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'لماذا يصعب لصق عرض تقديمي',
          paragraphs: [
            'كلمات العرض موزعة على عشرات مربعات النص المنفصلة. ونسخها شريحة شريحة بطيء، فالعرض ذو الأربعين شريحة يعني أربعين جولة من النسخ واللصق، وكثيرًا ما يخرج ترتيب المربعات خاطئًا. أما ملاحظات المتحدث، التي تحمل الشرح الحقيقي عادةً، فهي في جزء منفصل ويسهل نسيانها.',
            'وإرفاق ملف ‎.pptx يرسل الملف كله، بصوره، إلى خدمة الذكاء الاصطناعي، ولا ترى أي نص التقطته. أما المخطط النصي فأصغر، وتستطيع قراءة كل كلمة فيه قبل إرساله.',
          ],
        },
        {
          heading: 'شكل المخطط',
          paragraphs: ['كل شريحة تتبع النمط نفسه، مرقّمة بترتيب الشرائح في الملف، فحين تذكر المحادثة «الشريحة 4» تقصد الشريحة التي تقصدها أنت:'],
          list: [
            '# اسم العرض، مأخوذًا من اسم الملف.',
            '## الشريحة 1: ثم عنوان الشريحة.',
            '- كل نص في الشريحة نقطةً مستقلة.',
            '> ملاحظات المتحدث: مكتوبة اقتباسًا تحت شريحتها.',
          ],
        },
        {
          heading: 'الخطوات',
          paragraphs: ['تعمل أداة تحويل PowerPoint إلى Markdown على جهازك، ولا يُرسل شيء إلى خادم أو إلى أي خدمة ذكاء اصطناعي:'],
          list: [
            'افتح أداة تحويل PowerPoint إلى Markdown واختر ملف ‎.pptx أو ‎.ppsx أو ‎.potx أو ‎.pptm، أو أسقطه على الصفحة.',
            'يظهر المخطط في مربع نص، مع عدد الرموز.',
            'اقرأه، ثم اضغط «نسخ» والصقه في المحادثة، أو نزّل ملف ‎.md.',
          ],
          links: [{ text: 'تحويل PowerPoint إلى Markdown', path: '/pptx-to-markdown' }],
        },
        {
          heading: 'ما يحفظه المخطط وما يتركه',
          paragraphs: ['يحمل المخطط كلمات الملف، مقروءة شريحة شريحة. وهذه أمور تستحق المعرفة:'],
          list: [
            'العناوين تؤخذ من عنصر العنوان في الشريحة. والعنوان المكتوب في مربع نص عادي يظهر نقطةً، ولا يحمل رأس الشريحة إلا «الشريحة N».',
            'النقاط الفرعية المزاحة تخرج في مستوى النقاط التي فوقها نفسه.',
            'كل خلية في جدول على الشريحة تصبح نقطة مستقلة.',
            'الشرائح المخفية تُضمَّن أيضًا، فاحذف ما لا تريد مشاركته منها.',
            'الصور والرسوم البيانية وSmartArt والنص داخل الصور لا تُنقل.',
            'تعليقات المراجعين لا تُضمَّن.',
            'ملفات ‎.ppt القديمة لا تُقرأ؛ احفظها بصيغة ‎.pptx في بوربوينت أولًا.',
          ],
        },
        {
          heading: 'ماذا تطلب بعد اللصق',
          paragraphs: ['لأن كل شريحة معنونة، تستطيع طلب العمل شريحة شريحة: ملخص من سطر لكل شريحة، أو ملاحظات متحدث للشرائح التي لا ملاحظات لها، أو التحقق من أن الملاحظات والشرائح تقول الشيء نفسه، أو نسخة أقصر من العرض لفقرة مدتها عشر دقائق. واطلب منها أن تذكر رقم الشريحة مع كل تعديل تقترحه، لتجده بسرعة حين تعدّل العرض. ولترى الشرائح كما صُممت أثناء عملك، افتح الملف في عارض بوربوينت.'],
          links: [{ text: 'عارض بوربوينت', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'قبل اللصق',
          paragraphs: ['ملاحظات المتحدث مكتوبة للمقدّم لا للجمهور، فاقرأها كما تقرأ الشرائح:'],
          list: [
            'البيانات الشخصية: أسماء العملاء أو عناوين البريد أو أرقام الهواتف في الملاحظات أو الجداول. أداة إخفاء البيانات تستبدلها على جهازك؛ وهي تقرأ الملفات النصية، فغيّر امتداد ملف ‎.md الذي نزّلته إلى ‎.txt وافتحه فيها.',
            'الطول: العرض الطويل بملاحظات كاملة قد يستهلك رموزًا أكثر مما تتوقع. يظهر عدد الرموز مع المخطط، ويشرح دليل كم رمزًا يستهلك الملف هذا الرقم.',
          ],
          links: [{ text: 'إخفاء البيانات', path: '/mask-data' }, { text: 'كم رمزًا يستهلك الملف', path: '/how-many-tokens-is-my-pdf' }],
        },
        {
          heading: 'والمستندات أيضًا',
          paragraphs: ['لتقرير مكتوب في وورد، تحفظ الفكرة نفسها عناوينه وقوائمه: راجع دليل إعطاء محادثة ذكاء اصطناعي مستند وورد.'],
          links: [{ text: 'إعطاء محادثة ذكاء اصطناعي مستند وورد', path: '/word-document-to-ai-chat' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف العرض التقديمي (دون بيانات شخصية).`],
        },
      ],
    },
    '/how-to-merge-pdf-files': {
      published: '2026-11-20',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['يدمج جهاز Mac ملفات بي دي اف بتطبيق «معاينة» (Preview). أما Windows وأندرويد فليس فيهما دمج مدمج، فأسهل طريقة هناك أداة في المتصفح. تعمل أداة «دمج PDF» من OpenAnyDoc في أي متصفح حديث على كل هذه الأجهزة، وتجمع الملفات على جهازك دون رفعها.'],
          links: [{ text: 'دمج PDF', path: '/merge-pdf' }],
        },
        {
          heading: 'على Mac: تطبيق «معاينة»',
          paragraphs: ['يستطيع تطبيق «معاينة»، الموجود في كل جهاز Mac، أن يضيف ملف PDF إلى آخر. افتح الملف الأول، واختر «عرض» ثم «الصور المصغّرة»، وحدّد الصفحة التي تريد أن يأتي الملف التالي بعدها. ثم اختر «تحرير» ثم «إدراج» ثم «صفحة من ملف»، واختر الملف الآخر. اسحب الصور المصغّرة لتغيير الترتيب. ويغيّر «معاينة» الملف الذي فتحته نفسه، فإن أردت الاحتفاظ بالأصل فاصنع نسخة أولًا من «ملف» ثم «تكرار»، واحفظ النسخة. والخطوات في صفحتي Apple ‏Add, delete, or move PDF pages وCombine PDFs in Preview (تحققنا منهما في 24 نوفمبر 2026).'],
          links: [{ text: 'Add, delete, or move PDF pages', path: 'https://support.apple.com/guide/preview/prvw11793/mac' }, { text: 'Combine PDFs in Preview', path: 'https://support.apple.com/guide/preview/prvw43696/mac' }],
        },
        {
          heading: 'على Windows: لا دمج مدمجًا',
          paragraphs: ['يفتح Windows ملفات PDF ويطبعها في متصفح Microsoft Edge، لكن لا Edge ولا Windows فيه أمر يجمع ملفين. والطباعة إلى Microsoft Print to PDF تصنع ملفًا جديدًا من ملف واحد في كل مرة، فلا تدمج الملفات أيضًا. يمكنك تثبيت برنامج PDF، أو استخدام أداة في المتصفح الذي لديك: افتح أداة دمج PDF في Edge أو Chrome، فلا شيء تثبّته ولا شيء يُرفع.'],
          links: [{ text: 'دمج PDF في Edge أو Chrome', path: '/merge-pdf' }],
        },
        {
          heading: 'على أندرويد: استخدم المتصفح',
          paragraphs: ['ليس في أندرويد دمج مدمج، وتطبيقات الملفات التي يضيفها صانعو الهواتف تختلف من هاتف لآخر. افتح «دمج PDF» في Chrome أو أي متصفح آخر، واضغط «اختر ملفًا» واختر الملفات من التنزيلات أو من مجلد آخر. وعلى الهاتف، رتّبها بالأسهم الموجودة تحت كل ملف.'],
        },
        {
          heading: 'في متصفحك دون رفع أي شيء',
          paragraphs: ['تعمل أداة «دمج PDF» بالطريقة نفسها على الحاسوب والهاتف:'],
          list: [
            'اختر ملفين أو أكثر، أو أفلتها على الصفحة. ويمكنك إضافة المزيد في أي وقت.',
            'اسحب الصور المصغّرة إلى الترتيب الذي تريده، أو استخدم الأسهم تحت كل ملف.',
            'انقر «دمج PDF» ونزّل ملفًا واحدًا يحمل اسم الملف الأول.',
          ],
          links: [{ text: 'دمج PDF', path: '/merge-pdf' }],
        },
        {
          heading: 'كيف تضبط الترتيب',
          paragraphs: [
            'ترتّب أداة «دمج PDF» الملفات كاملة: كل صورة مصغّرة هي الصفحة الأولى من ملف، وتتبعها كل صفحاته بترتيبها. وهذا يكفي لمعظم الحالات، مثل خطاب تقديم ثم نموذج ثم ثلاثة إيصالات.',
            'وإن احتجت إلى نقل صفحات مفردة، كأن تضع صفحة من الملف الثاني في وسط الأول، فادمج أولًا ثم مرّر الناتج إلى «ترتيب صفحات PDF». فالخطوات التالية بعد التنزيل تسلّمه الملف دون أن تختاره من جديد. وتدوّر هذه الأداة الصفحات وتكرّرها وتحذفها أيضًا، أما «حذف صفحات PDF» فيحذف الصفحات التي لا تريد إرسالها.',
          ],
          links: [{ text: 'ترتيب صفحات PDF', path: '/organize-pdf' }, { text: 'حذف صفحات PDF', path: '/remove-pdf-pages' }],
        },
        {
          heading: 'إضافة صور أو صفحات فارغة',
          paragraphs: [
            'لا تقبل أداة «دمج PDF» إلا ملفات PDF. فلإضافة صورة إيصال أو لقطة شاشة، حوّلها أولًا إلى PDF بأداة «تحويل JPG إلى PDF»، ثم ادمجها مع البقية. ويشرح دليل جمع الصور في ملف PDF واحد مقاس الصفحة والهوامش.',
            'ولإضافة صفحة فارغة، افتح الملف المدموج في «ترتيب صفحات PDF» وأدرج صفحة، فتأخذ مقاس الصفحة التي قبلها. وهذا مفيد قبل الطباعة على الوجهين، حتى يبدأ كل مستند على ورقة جديدة.',
          ],
          links: [{ text: 'تحويل JPG إلى PDF', path: '/jpg-to-pdf' }, { text: 'جمع الصور في ملف PDF واحد', path: '/photos-to-one-pdf' }, { text: 'ترتيب صفحات PDF', path: '/organize-pdf' }],
        },
        {
          heading: 'حجم الملف',
          paragraphs: [
            'ينسخ الدمج الصفحات كما هي، فيبقى النص حادًّا وقابلًا للتحديد، ويكون حجم الملف المدموج قريبًا من مجموع أحجام الملفات. فالدمج لا يصغّر شيئًا؛ ولتصغير الملف المدموج بعد ذلك افتحه في أداة ضغط PDF.',
            'وإن كانت الملفات كبيرة لأنها مليئة بصور الكاميرا، فصغّر الصور بأداة «ضغط الصور» قبل تحويلها إلى PDF. وإن كان الملف المدموج أكبر من أن يُرسل بالبريد، فقسّمه إلى أجزاء بأداة «تقسيم PDF»؛ ويشرح دليل تقسيم ملف PDF نطاقات الصفحات. أما المجموعات الكبيرة جدًا من الملفات فتحدّها ذاكرة جهازك.',
          ],
          links: [{ text: 'ضغط PDF', path: '/compress-pdf' }, { text: 'ضغط الصور', path: '/compress-image' }, { text: 'تقسيم PDF', path: '/split-pdf' }, { text: 'دليل تقسيم ملف PDF', path: '/how-to-split-a-pdf' }],
        },
        {
          heading: 'إن رفض ملف أن يُدمج',
          paragraphs: ['ثلاثة أشياء قد تعترض الطريق:'],
          list: [
            'الملف الذي يحتاج إلى كلمة مرور لفتحه لا يمكن قراءته. إن كنت تعرف كلمة المرور، فأزلها أولًا بأداة «فتح قفل PDF»، وهي تعمل في متصفحك أيضًا.',
            'قد لا تنتقل الإشارات المرجعية وحقول النماذج القابلة للتعبئة من الملفات الأصلية. عبّئ النموذج أولًا بأداة «تعبئة نموذج PDF» وفعّل «تثبيت عند الحفظ»، فتبقى الإجابات جزءًا من الصفحة.',
            'والملف الذي لا يفتحه أي تطبيق قد يكون تالفًا، وتحاول أداة «إصلاح PDF» إعادة بنائه.',
          ],
          links: [{ text: 'فتح قفل PDF', path: '/unlock-pdf' }, { text: 'تعبئة نموذج PDF', path: '/fill-pdf' }, { text: 'إصلاح PDF', path: '/repair-pdf' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف الملفات التي تحاول دمجها (دون بيانات شخصية).`],
        },
      ],
    },
    '/how-to-split-a-pdf': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['حدّد أولًا ما تريده: عدة ملفات من ملف PDF واحد، أم ملفًا واحدًا فيه بعض صفحاته فقط. أداة «تقسيم PDF» تصنع الأول، حسب نطاقات الصفحات أو كل عدد من الصفحات أو ملفًا لكل صفحة في ملف ZIP؛ وأداة «استخراج صفحات PDF» تحفظ الصفحات التي تنقرها في ملف جديد، وأداة «حذف صفحات PDF» تحفظ الملف دون الصفحات التي تنقرها. والثلاث تعمل في متصفحك، فلا يُرفع شيء، ويبقى ملفك الأصلي كما هو.'],
          links: [{ text: 'تقسيم PDF', path: '/split-pdf' }, { text: 'استخراج صفحات PDF', path: '/extract-pdf-pages' }, { text: 'حذف صفحات PDF', path: '/remove-pdf-pages' }],
        },
        {
          heading: 'أي أداة لأي مهمة',
          paragraphs: ['اختر حسب النتيجة التي تحتاجها:'],
          list: [
            'عدة ملفات، لكل منها صفحاته: «تقسيم PDF»، حسب نطاقات الصفحات أو كل عدد من الصفحات.',
            'كل صفحة في ملف مستقل: «تقسيم PDF» مع «ملف لكل صفحة»، أو «استخراج صفحات PDF» مع «ملف PDF لكل صفحة».',
            'ملف واحد فيه صفحات تختارها: «استخراج صفحات PDF».',
            'الملف نفسه دون بضع صفحات: «حذف صفحات PDF».',
            'الصفحات نفسها بترتيب جديد: «ترتيب صفحات PDF».',
          ],
          links: [{ text: 'تقسيم PDF', path: '/split-pdf' }, { text: 'ترتيب صفحات PDF', path: '/organize-pdf' }],
        },
        {
          heading: 'كيف تكتب نطاقات الصفحات',
          paragraphs: [
            'في «تقسيم PDF»، اختر «حسب نطاقات الصفحات» واكتب النطاقات مفصولة بفواصل. الشرطة تعني «من هذه الصفحة إلى تلك»، وكل نطاق يصبح ملفًا مستقلًا. وتُعدّ الصفحات من أول صفحة في الملف، لا من الأرقام المطبوعة على الصفحات.',
            'لنفترض أن تقريرًا من 12 صفحة فيه ملخص من صفحتين، وثماني صفحات من النتائج، وملحق من صفحتين. كتابة 1-2، 3-10، 11-12 تعطيك ثلاثة ملفات، لكل جزء ملف. وكتابة 5 وحدها تعطيك ملفًا فيه الصفحة 5. وتعمل الأرقام العربية والفاصلة العربية أيضًا.',
            'وإن كان الملف مجموعة مستندات متساوية الطول، مثل 30 صفحة من نماذج كل منها ثلاث صفحات، فاختر «كل عدد من الصفحات» واكتب 3 لتحصل على عشرة ملفات. وتأتي الملفات المتعددة في ملف ZIP واحد، بأسماء مأخوذة من اسم ملفك وأرقام صفحاته.',
          ],
        },
        {
          heading: 'ملف لكل صفحة في ملف ZIP',
          paragraphs: ['اختر «ملف لكل صفحة» فتصبح كل صفحة ملف PDF مستقلًا، وكلها في ملف ZIP واحد. ومعظم الحواسيب والهواتف تفتح ملف ZIP بالنقر المزدوج أو اللمس، وتعرض الملفات التي فيه. وهذه هي الطريقة لترسل الصفحة 4 إلى شخص والصفحة 7 إلى آخر، أو لتسلّم الصفحات إلى نظام يقبل مستندًا واحدًا في كل رفع.'],
        },
        {
          heading: 'حفظ بعض الصفحات فقط',
          paragraphs: [
            'إن أردت ملفًا واحدًا أصغر لا عدة ملفات، فاستخدم «استخراج صفحات PDF»: انقر الصور المصغّرة التي تريدها، واستخدم Shift مع النقر لتحديد سلسلة، ونزّلها ملفًا جديدًا. تحافظ الصفحات على ترتيبها في الأصل، ويخبرك الاسم بما فيه، مثل report-pages-2,4-6.pdf.',
            'وإن كان المطلوب حذف صفحات قليلة فقط، فأداة «حذف صفحات PDF» أسرع: انقر الصفحات التي تريد حذفها ونزّل الباقي. ولا بد أن يبقى في الملف صفحة واحدة على الأقل، فلن تحذفها كلها. وإن احتاجت الصفحات الباقية إلى ترتيب جديد، فمرّر الناتج إلى «ترتيب صفحات PDF».',
          ],
          links: [{ text: 'استخراج صفحات PDF', path: '/extract-pdf-pages' }, { text: 'حذف صفحات PDF', path: '/remove-pdf-pages' }, { text: 'ترتيب صفحات PDF', path: '/organize-pdf' }],
        },
        {
          heading: 'دون موقع ويب',
          paragraphs: ['يستطيع الحاسوب أيضًا حفظ بعض الصفحات في ملف جديد من نافذة الطباعة:'],
          links: [{ text: 'دليل «معاينة» من Apple', path: 'https://support.apple.com/guide/preview/prvw11793/mac' }, { text: 'مساعدة Chrome', path: 'https://support.google.com/chrome/answer/1069693?co=GENIE.Platform%3DAndroid' }],
          list: [
            'Mac: في «معاينة»، حدّد الصور المصغّرة للصفحات التي تريدها في الشريط الجانبي واسحبها إلى سطح المكتب؛ ويقول دليل «معاينة» من Apple إن هذا ينشئ ملف PDF جديدًا (تحققنا منها في 24 نوفمبر 2026). ومن «ملف» ثم «طباعة» ثم «حفظ بتنسيق PDF» من قائمة PDF يُحفظ ملف PDF أيضًا.',
            'Windows: افتح الملف في Microsoft Edge، واختر «طباعة»، واختر Microsoft Print to PDF طابعةً، واكتب الصفحات، واطبعها إلى ملف جديد.',
            'أندرويد: في Chrome، يعرض أمر «طباعة» من «مشاركة» طابعة «حفظ بتنسيق PDF» (مساعدة Chrome، تحققنا منها في 24 نوفمبر 2026).',
          ],
        },
        {
          heading: 'ما الذي ينتقل إلى الملفات الجديدة',
          paragraphs: [
            'تنسخ أداة «تقسيم PDF» الصفحات كما هي، فيبقى النص حادًّا وقابلًا للتحديد، وتحتفظ الصور بجودتها. ويُقسَّم ملف من 150 صفحة في ثوانٍ، مع شريط تقدّم. أما الطباعة إلى PDF، كما في القسم السابق، فتعيد رسم الصفحات عبر نظام الطباعة، فقد تضيع الروابط وحقول النماذج؛ والأدوات هنا تنسخ الروابط مع الصفحات، لكن حقول النماذج قد لا تبقى قابلة للتعبئة.',
            'وقد لا تنتقل الإشارات المرجعية والروابط التي تقفز بين الصفحات إلى الملفات الجديدة. والملف الذي يحتاج إلى كلمة مرور لفتحه يجب أن تُزال كلمة مروره أولًا بأداة «فتح قفل PDF»، إن كنت تعرفها.',
          ],
          links: [{ text: 'تقسيم PDF', path: '/split-pdf' }, { text: 'فتح قفل PDF', path: '/unlock-pdf' }],
        },
        {
          heading: 'بعد التقسيم',
          paragraphs: ['كل جزء ملف PDF عادي. يمكنك جمعه مع ملفات أخرى من جديد، كما يشرح دليل دمج ملفات PDF، أو ترقيم صفحات كل جزء من 1 بأداة «ترقيم الصفحات»، أو وضع كلمة مرور على جزء قبل إرساله، كما يشرح دليل حماية ملف PDF بكلمة مرور.'],
          links: [{ text: 'دليل دمج ملفات PDF', path: '/how-to-merge-pdf-files' }, { text: 'ترقيم الصفحات', path: '/add-page-numbers' }, { text: 'دليل حماية ملف PDF بكلمة مرور', path: '/password-protect-pdf-free' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف كيف تريد تقسيم الملف (دون بيانات شخصية).`],
        },
      ],
    },
    '/photos-to-one-pdf': {
      published: '2026-11-20',
      updated: '2026-11-23',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['أضف الصور إلى أداة «تحويل JPG إلى PDF» في متصفحك، ورتّبها بالسحب، واختر مقاس الصفحة والهامش، ونزّل ملف بي دي اف واحدًا. تقرأ الأداة صور JPG وPNG وصور HEIC من iPhone، وكذلك WebP وTIFF وغيرها، على جهازك، فلا يُرفع شيء. أما صور المستندات الورقية، فأداة «مسح ضوئي إلى PDF» تقوّم كل صفحة أولًا.'],
          links: [{ text: 'تحويل JPG إلى PDF', path: '/jpg-to-pdf' }, { text: 'مسح ضوئي إلى PDF', path: '/scan-to-pdf' }],
        },
        {
          heading: 'اختر الصور',
          paragraphs: [
            'على الهاتف، افتح «تحويل JPG إلى PDF» واضغط «اختر ملفًا»: يعرض الهاتف مكتبة الصور إلى جانب الملفات، فتختار الصور مباشرة من ألبوم الكاميرا. وعلى الحاسوب، أفلت الصور على الصفحة. ويمكنك إضافة المزيد في أي وقت.',
            'يحفظ iPhone الصور بصيغة HEIC افتراضيًا. يقرؤها Safari بنفسه منذ Safari 17 (ملاحظات WebKit عن Safari 17.0، تحققنا منها في 24 نوفمبر 2026)، أما في Chrome وEdge وFirefox فيُحمَّل قارئ HEIC أول مرة تضيف فيها صورة منها، وتبقى الصورة تُقرأ على جهازك. وقد لا تُقرأ بعض الصور الملتقطة بأحدث إعدادات iPhone؛ فاحفظها بصيغة JPG على الهاتف أولًا، أو حوّلها بأداة «تحويل HEIC إلى JPG».',
          ],
          links: [{ text: 'تحويل HEIC إلى JPG', path: '/heic-to-jpg' }, { text: 'ملاحظات WebKit عن Safari 17.0', path: 'https://webkit.org/blog/14445/' }],
        },
        {
          heading: 'رتّب الصور',
          paragraphs: ['الترتيب الذي تختار به الصور ليس دائمًا الترتيب الذي يجب أن تأخذه الصفحات. اسحب الصور إلى أماكنها بالفأرة، أو استخدم الأزرار تحت كل صورة على الهاتف. ويتبع الملف هذا الترتيب، صورة في كل صفحة. والصور التي حفظها الهاتف مائلة مع علامة تدوير تُرسم معتدلة، فتبقى الصورة الطولية طولية.'],
        },
        {
          heading: 'مقاس الصفحة والاتجاه والهوامش',
          paragraphs: ['ثلاثة إعدادات تحدّد موضع كل صورة في صفحتها:'],
          list: [
            'مقاس الصفحة: A4 أو Letter إن كان الملف سيُطبع أو يُرفق بنموذج (Letter هو مقاس الورق المعتاد في الولايات المتحدة وكندا، وA4 في معظم البلدان الأخرى)، أو «بمقاس الصورة» إن كان سيُقرأ على الشاشة فقط.',
            'الاتجاه: طولي، أو عرضي، أو «حسب كل صورة»، وهو يناسب خليطًا من الصور الطولية والعريضة.',
            'الهامش: «بلا هامش» أو صغير أو كبير. الهامش الصغير يمنع الطابعة من قصّ الأطراف، و«بلا هامش» يناسب صفحة بمقاس الصورة.',
          ],
        },
        {
          heading: 'صور المستندات: استخدم «مسح ضوئي إلى PDF»',
          paragraphs: [
            'صورة خطاب أو إيصال ملتقطة بزاوية تبدو مائلة في ملف PDF، تحيط بها الطاولة الداكنة. أداة «مسح ضوئي إلى PDF» تصلح ذلك: اسحب الزوايا الأربع إلى زوايا الورقة فتُقوَّم الصفحة كأنها مُسحت مسطّحة، ويجعل خيار «مستند (أبيض وأسود)» في «المظهر» الورق أبيض والحبر داكنًا ويخفّف الظلال. ويمكنك التقاط الصور من تلك الصفحة بكاميرا الهاتف.',
            'وفي الحالتين تبقى الصفحات صورًا، فلا يمكن البحث في كلماتها أو نسخها. ولجعلها قابلة للبحث، اقرأ كيف تجعل ملف PDF الممسوح ضوئيًا قابلًا للبحث.',
          ],
          links: [{ text: 'مسح ضوئي إلى PDF', path: '/scan-to-pdf' }, { text: 'كيف تجعل ملف PDF الممسوح ضوئيًا قابلًا للبحث', path: '/make-scanned-pdf-searchable' }],
        },
        {
          heading: 'كيف تُبقي الملف صغيرًا',
          paragraphs: [
            'تضع أداة «تحويل JPG إلى PDF» صور PNG، وصور JPG المعتدلة أصلًا، في الملف كما هي، دون ضغطها مرة أخرى؛ أما صورة JPG المحفوظة على جنبها فيُعاد رسمها معتدلة مرة واحدة. فتبقى الجودة، لكن حجم الملف يقارب مجموع أحجام الصور، وصور الهاتف كثيرًا ما تبلغ عدة ميغابايت لكل صورة.',
            'ولتصغير الملف، صغّر الصور أولًا:',
          ],
          list: [
            '«ضغط الصور»: جودة 75 تعطي عادة ملفات أقل من نصف الحجم، مع عرض قبل وبعد للتحقق.',
            '«تغيير حجم الصورة»: صورة لمستند نادرًا ما تحتاج إلى دقة الكاميرا كاملة.',
            'لقطات الشاشة المحفوظة بصيغة PNG تصغر أقل؛ حوّلها إلى JPG أثناء الضغط.',
            'وأداة «مسح ضوئي إلى PDF» تصغّر الصور الكبيرة جدًا إلى 2000 بكسل على الضلع الطويل لكل صفحة.',
            'أو صغّر ملف PDF الجاهز بأداة «ضغط PDF».',
          ],
          links: [{ text: 'ضغط الصور', path: '/compress-image' }, { text: 'تغيير حجم الصورة', path: '/resize-image' }, { text: 'ضغط PDF', path: '/compress-pdf' }],
        },
        {
          heading: 'الموقع وبيانات الكاميرا',
          paragraphs: ['كثيرًا ما تسجّل صور الهاتف مكان التقاطها ووقته ونوع الهاتف. فإن كان الملف ذاهبًا إلى شخص لا تعرفه جيدًا، فاحفظ نسخًا نظيفة من الصور أولًا بأداة «حذف بيانات الصور»، وهي تعرض ما تكشفه كل صورة قبل أن تزيله.'],
          links: [{ text: 'حذف بيانات الصور', path: '/remove-image-metadata' }],
        },
        {
          heading: 'ملف واحد أو ملف لكل صورة',
          paragraphs: ['انقر «إنشاء PDF»، وراجع المعاينة، ونزّل ملفًا واحدًا. وإن أردت كل صورة في ملف مستقل، ففعّل «ملف PDF لكل صورة (ZIP)» فتحصل على ملف ZIP. ولإضافة الصور إلى ملف PDF موجود لديك، اصنع ملف الصور أولًا ثم اجمع الملفين بأداة «دمج PDF»؛ ويشرح دليل دمج ملفات PDF مسألة الترتيب.'],
          links: [{ text: 'دمج PDF', path: '/merge-pdf' }, { text: 'دليل دمج ملفات PDF', path: '/how-to-merge-pdf-files' }],
        },
        {
          heading: 'على الهاتف نفسه',
          paragraphs: ['للهواتف طرقها أيضًا. على iPhone وiPad، في تطبيقي «الملفات» و«الملاحظات» أمر «مسح المستندات» الذي يصوّر الصفحات. وعلى أندرويد، في تطبيق Google Drive ماسح يمكنه حفظ المسح ملف PDF في حسابك على Drive (صفحات المساعدة من Apple وGoogle، تحققنا منها في 24 نوفمبر 2026). لكن هذه الطرق تعطي خيارات أقل لمقاس الصفحة والهامش، وDrive يحفظ المسح في حسابك على الإنترنت. أما أداة تحويل JPG إلى PDF فتبقي كل شيء على جهازك.'],
          links: [{ text: 'تحويل JPG إلى PDF', path: '/jpg-to-pdf' }, { text: 'أمر «مسح المستندات»', path: 'https://support.apple.com/108963' }, { text: 'تطبيق Google Drive ماسح', path: 'https://support.google.com/drive/answer/3145835?co=GENIE.Platform%3DAndroid' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف الصور التي تحاول جمعها (دون بيانات شخصية).`],
        },
      ],
    },
    '/password-protect-pdf-free': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['اختر الملف في أداة «حماية PDF بكلمة مرور»، واكتب كلمة المرور مرتين، ونزّل النسخة المقفلة. تُشفَّر بمعيار AES-256 في متصفحك، ولا يُرفع الملف ولا كلمة المرور؛ وكل من يفتح النسخة يحتاج إلى كلمة المرور. أرسل كلمة المرور بطريق غير طريق الملف، واحتفظ بالأصل، لأن كلمة المرور المنسية لا يمكن استعادتها.'],
          links: [{ text: 'حماية PDF بكلمة مرور', path: '/protect-pdf' }],
        },
        {
          heading: 'نوعان من كلمات مرور PDF',
          paragraphs: [
            'يمكن أن يحمل ملف بي دي اف كلمتي مرور مختلفتين، ولكل منهما عمل مختلف تمامًا.',
            'كلمة المرور للفتح تشفّر الملف، ودونها لا يمكن قراءة الصفحات أبدًا. وهي التي تُبقي المستند خاصًا.',
            'أما كلمة مرور الأذونات فترافق قيودًا على الطباعة أو نسخ النص والصور أو تعديل المستند. يُفتح الملف دونها، والقيود طلب تحترمه معظم برامج قراءة PDF، لا قفل. والملف الذي يُفتح بحرية لكنه يرفض الطباعة لا يحمل إلا قيودًا، وأداة «فتح قفل PDF» ترفعها دون أي كلمة مرور، وهذا يبيّن قلة ما تحميه.',
            'تضع أداة «حماية PDF بكلمة مرور» دائمًا كلمة مرور للفتح، من 4 أحرف على الأقل. وألغِ تحديد «الطباعة» أو «نسخ النص والصور» أو «تعديل المستند» إن أردت قيودًا أيضًا، وأضف كلمة مرور أذونات اختيارية.',
          ],
          links: [{ text: 'فتح قفل PDF', path: '/unlock-pdf' }, { text: 'حماية PDF بكلمة مرور', path: '/protect-pdf' }],
        },
        {
          heading: 'ما الذي تمنعه كلمة المرور وما الذي لا تمنعه',
          paragraphs: ['كلمة المرور للفتح تحجب المحتوى عن كل من يصله الملف دون كلمة المرور: بريد أُرسل إلى عنوان خطأ، أو ذاكرة USB ضائعة، أو مجلد مشترك أعضاؤه كثيرون. لكنها لا تمنع كل شيء:'],
          list: [
            'من يعرف كلمة المرور يستطيع قراءة الصفحات وطباعتها وتصويرها وإعادة إرسالها، ويستطيع حفظ نسخة دون كلمة مرور.',
            'اسم الملف غير مشفّر، فاسم مثل salary-review-2026.pdf يكشف ما فيه سلفًا. أعطِ الملف اسمًا عاديًا.',
            'كلمة المرور القصيرة أو السهلة يمكن إيجادها بتجربة كلمات كثيرة. ومعيار AES-256 هو أقوى تشفير تدعمه برامج قراءة PDF، لكن قوته تعتمد على كلمة المرور.',
            'كلمة المرور لا تُظهر من أرسل الملف ولا إن كان قد تغيّر؛ فذلك يحتاج إلى توقيع رقمي قائم على شهادة.',
          ],
        },
        {
          heading: 'اختر كلمة مرور تصمد',
          paragraphs: ['استخدم كلمة مرور طويلة: عدة كلمات لا رابط بينها، مع رقم أو رمز بينها، أسهل في التذكّر وأصعب في التخمين من كلمة قصيرة واحدة. وتجنّب الأسماء وتواريخ الميلاد وأرقام الهواتف وأي شيء مطبوع في المستند نفسه. ولا تُعِد استخدام كلمة مرور بريدك أو حسابك المصرفي. اكتبها مرتين في الأداة، و«إظهار كلمات المرور» يتيح لك التحقق منها قبل قفل الملف.'],
        },
        {
          heading: 'أرسل كلمة المرور منفصلة',
          paragraphs: ['كلمة المرور في البريد نفسه الذي فيه الملف لا تحمي شيئًا: من يصله البريد يصله الاثنان. أرسل الملف بطريق وكلمة المرور بطريق آخر:'],
          list: [
            'أرسل الملف بالبريد، ثم أرسل كلمة المرور برسالة نصية أو تطبيق محادثة، أو قلها في مكالمة.',
            'ولمن ترسل إليه الملفات كثيرًا، اتفقا على كلمة مرور مرة واحدة، وجهًا لوجه أو بالهاتف، بدل إرسال كلمة جديدة كل مرة.',
            'ولا تضع كلمة المرور في اسم الملف أو عنوان البريد أو داخل المستند أبدًا.',
          ],
        },
        {
          heading: 'القيود: متى تستحق',
          paragraphs: ['تناسب القيود حالات تثق فيها بالقارئ لكنك تريد صرفه عن التعديل العابر، مثل قائمة أسعار نهائية أو اتفاق موقّع يُرسل للاطلاع. فتعطّل معظم البرامج حينها الطباعة أو النسخ. لكن لا تعتمد عليها لأي شيء سري: كل من يستطيع فتح الملف يستطيع إزالتها، مثلًا بأداة «فتح قفل PDF». وإن وضعت كلمة مرور للأذونات، فاجعلها مختلفة عن كلمة المرور للفتح.'],
          links: [{ text: 'فتح قفل PDF', path: '/unlock-pdf' }],
        },
        {
          heading: 'إزالة كلمة المرور أو تغييرها لاحقًا',
          paragraphs: ['يبقى ملفك الأصلي على جهازك، دون تغيير ودون كلمة مرور، فاحفظه في مكان آمن. ولإزالة كلمة المرور من نسخة مقفلة، افتحها في «فتح قفل PDF» واكتب كلمة المرور؛ فالأداة لا تخمّن كلمات المرور ولا تكسرها. ولتغيير كلمة المرور، أزل القديمة هناك ثم احمِ الملف من جديد. والأدوات الأخرى، مثل «دمج PDF» و«تقسيم PDF»، تحتاج إلى إزالة كلمة المرور أولًا.'],
          links: [{ text: 'فتح قفل PDF', path: '/unlock-pdf' }, { text: 'دمج PDF', path: '/merge-pdf' }, { text: 'تقسيم PDF', path: '/split-pdf' }],
        },
        {
          heading: 'طرق مجانية أخرى',
          paragraphs: ['على Mac، يستطيع تطبيق «معاينة» إضافة كلمة مرور حين تصدّر الملف من «ملف» ثم «تصدير» ثم «الأذونات» (دليل «معاينة» من Apple). ويستطيع Word وLibreOffice تشفير المستند بكلمة مرور حين يحفظانه بصيغة PDF (صفحة Microsoft عن الحفظ بصيغة PDF، ومساعدة LibreOffice عن تصدير PDF؛ تحققنا منها في 24 نوفمبر 2026)، وهذا يناسب مستندًا كتبته بنفسك. أما «حماية PDF بكلمة مرور» فتعمل مع أي ملف PDF يُفتح دون كلمة مرور، ومنه الملف الذي يمنع الطباعة أو النسخ فقط، على أي جهاز، وتُبقي نصه وصوره وروابطه وحقول نماذجه كما هي.'],
          links: [{ text: 'حماية PDF بكلمة مرور', path: '/protect-pdf' }, { text: 'دليل «معاينة» من Apple', path: 'https://support.apple.com/guide/preview/prvw587dd90f/mac' }, { text: 'صفحة Microsoft عن الحفظ بصيغة PDF', path: 'https://support.microsoft.com/en-us/office/save-or-convert-to-pdf-or-xps-in-office-desktop-apps-d85416c5-7d77-4fd6-a216-6f4bf7c7c110' }, { text: 'مساعدة LibreOffice عن تصدير PDF', path: 'https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export_security.html' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف ما تحتاج إلى حمايته (دون بيانات شخصية، ولا ترسل كلمة مرور أبدًا).`],
        },
      ],
    },
    '/make-scanned-pdf-searchable': {
      published: '2026-11-20',
      updated: '2026-11-20',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['ملف بي دي اف الممسوح ضوئيًا يحمل صورًا للصفحات، فلا نص فيه للبحث أو النسخ. والتعرّف الضوئي على النصوص (OCR) يقرأ الكلمات في تلك الصور ويضعها فوق كل صفحة نصًا غير مرئي. تفعل أداة «التعرّف الضوئي على نص PDF» ذلك في متصفحك، بالعربية أو الإنجليزية أو كلتيهما، دون رفع الملف؛ ويُحمَّل قارئ النصوص من هذا الموقع أول مرة، ثم يعمل دون اتصال.'],
          links: [{ text: 'التعرّف الضوئي على نص PDF', path: '/ocr-pdf' }],
        },
        {
          heading: 'هل ملفك ممسوح ضوئيًا؟',
          paragraphs: [
            'افتح الملف وحاول تحديد كلمة، أو اضغط Ctrl+F (أو Cmd+F على Mac) وابحث عن كلمة تراها. إن لم يتحدد شيء ولم يُعثر على شيء، فالصفحة صورة. والملفات التي يصنعها الماسح الضوئي أو تطبيق في الهاتف أو أداة «مسح ضوئي إلى PDF» تكون عادة كذلك، وكذلك المستندات التي طُبعت ثم مُسحت من جديد.',
            'وبعض الملفات تجمع النوعين: صفحات مكتوبة وبضع صفحات ممسوحة. تترك الأداة الصفحات التي فيها نص كما هي، إلا إن ألغيت تحديد «اترك الصفحات التي فيها نص».',
          ],
          links: [{ text: 'مسح ضوئي إلى PDF', path: '/scan-to-pdf' }],
        },
        {
          heading: 'ما الذي يغيّره التعرّف الضوئي وما الذي لا يغيّره',
          paragraphs: [
            'تبقى الصورة الممسوحة بالوضوح الذي كانت عليه. يضيف التعرّف الضوئي طبقة من النص غير المرئي، كلمة كلمة، فوق مواضع الكلمات. تبدو الصفحة كما هي، لكن البحث يجد الكلمات، ويمكنك تحديد النص ونسخه، وتستطيع الأدوات الأخرى قراءته الآن.',
            'لكنه لا يجعل الصفحة قابلة للتعديل كمستند: فالكلمات التي تراها ما زالت صورة. ولتغيير الصياغة، حوّل النسخة القابلة للبحث إلى Word، كما يشرح دليل لماذا لا تستطيع تعديل النص في ملف PDF.',
          ],
          links: [{ text: 'لماذا لا تستطيع تعديل النص في ملف PDF', path: '/cant-edit-text-in-pdf' }],
        },
        {
          heading: 'هل يحتاج التعرّف الضوئي إلى رفع ملفك؟',
          paragraphs: [
            'كثير من خدمات التعرّف الضوئي على الإنترنت، والتطبيقات السحابية التي تحوّل ملف PDF إلى مستند، تقرأ الملف على خوادمها، فلا بد من رفع المسح. وهذا مصدر قلق حقيقي مع العقود الممسوحة وخطابات البنوك والنماذج الطبية.',
            'أما هذه الأداة فتقرأ النص على جهازك أنت. وفي أول استخدام تحمّل قارئ النصوص وبيانات اللغتين العربية والإنجليزية، نحو 10 ميغابايت، من هذا الموقع نفسه لا من شركة أخرى. ويحتفظ بها متصفحك، فتبدأ المرات التالية فورًا وتعمل دون اتصال. ويمكنك التحقق من ذلك في لوحة الشبكة في متصفحك: يُحمَّل القارئ أول مرة، ولا يُرسل الملف إلى أي مكان.',
          ],
          links: [{ text: 'التحقق من ذلك في لوحة الشبكة في متصفحك', path: '/check-file-upload' }],
        },
        {
          heading: 'العربية أو الإنجليزية أو كلتاهما',
          paragraphs: ['اختر لغة النص قبل أن تبدأ: العربية، أو الإنجليزية، أو «العربية والإنجليزية» للصفحات التي تجمعهما، مثل نموذج بلغتين. وهاتان هما اللغتان الوحيدتان اللتان تقرؤهما الأداة. وإن لم تجد كلمات، فتحقّق من اختيار اللغة أولًا، ثم جرّب مسحًا أوضح.'],
        },
        {
          heading: 'ما مدى دقته',
          paragraphs: ['التعرّف جيد على النص المطبوع الواضح، ويسوء كلما ساء المسح. اعرف حدوده قبل أن تعتمد على النتيجة:'],
          list: [
            'النص الضبابي أو الصغير أو الباهت يعطي أخطاء أكثر؛ تحقّق من الأسماء والأرقام والمبالغ المهمة.',
            'خط اليد لا يُقرأ بشكل موثوق، وغالبًا ما يخرج خطأ.',
            'الجداول والأعمدة تُقرأ أسطرًا من الكلمات، لا جدولًا.',
            'المسح المائل قليلًا لا بأس به، لأن الكلمات تتبع ميل سطرها؛ أما الصفحة المصوّرة بزاوية حادة فالأفضل تقويمها أولًا بأداة «مسح ضوئي إلى PDF».',
            'تستغرق القراءة بضع ثوانٍ لكل صفحة، حسب جهازك.',
          ],
          links: [{ text: 'مسح ضوئي إلى PDF', path: '/scan-to-pdf' }],
        },
        {
          heading: 'اجعله قابلًا للبحث',
          paragraphs: ['افتح «التعرّف الضوئي على نص PDF»، واختر الملف الممسوح، واختر اللغة، وانقر «اجعله قابلًا للبحث». تُقرأ الصفحات واحدة بعد أخرى. نزّل النسخة وابحث فيها في أي برنامج لقراءة PDF، ومنها «عارض PDF» هنا.'],
          links: [{ text: 'التعرّف الضوئي على نص PDF', path: '/ocr-pdf' }, { text: 'عارض PDF', path: '/pdf-viewer' }],
        },
        {
          heading: 'ثم استخرج النص',
          paragraphs: ['بعد أن تصبح للملف طبقة نص، تستطيع أدوات التحويل قراءته:'],
          list: [
            '«تحويل PDF إلى نص» يحفظ كلمات كل صفحة في ملف .txt عادي، والعربية بترتيب القراءة.',
            '«تحويل PDF إلى Word» يعيد بناء الفقرات والعناوين والقوائم في مستند قابل للتعديل.',
            '«ترجمة PDF» تحوّل الإنجليزية إلى العربية والعربية إلى الإنجليزية، وتحتاج هي أيضًا إلى التعرّف الضوئي أولًا مع الملف الممسوح.',
            'وإن خرج النص العربي المنسوخ من PDF مقلوبًا، فاقرأ دليل إصلاح النص العربي المنسوخ من PDF.',
          ],
          links: [{ text: 'تحويل PDF إلى نص', path: '/pdf-to-text' }, { text: 'تحويل PDF إلى Word', path: '/pdf-to-word' }, { text: 'ترجمة PDF', path: '/translate-pdf' }, { text: 'إصلاح النص العربي المنسوخ من PDF', path: '/fix-arabic-text-copied-from-pdf' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف المسح الذي تحاول قراءته (دون بيانات شخصية).`],
        },
      ],
    },
    '/split-large-csv': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['اقطع الملف حسب عدد من الصفوف أو حسب حجم بالميغابايت، وضع صف العناوين في أول كل جزء ليُفتح كل ملف وحده. ولأجل Excel اجعل كل جزء أقل من 1,048,576 سطرًا مع صف العناوين. تقسيم CSV في OpenAnyDoc يفعل الأمرين داخل متصفحك: اختر عدد الصفوف أو الميغابايت لكل ملف ونزّل الأجزاء كلها في ملف ZIP واحد، دون رفع الملف.'],
          links: [{ text: 'تقسيم CSV', path: '/split-csv' }],
        },
        {
          heading: 'لماذا يحتاج كل جزء إلى صف العناوين',
          paragraphs: [
            'السطر الأول في ملف CSV يسمّي الأعمدة: order_id وorder_date وregion وamount. والقطع العادي يُبقي هذا السطر في الجزء الأول وحده. أما الجزء الثاني فيبدأ من وسط البيانات، فيعرض Excel صفًا من الأرقام مكان أسماء الأعمدة، ويربط نموذج الاستيراد الأعمدة خطأً أو يرفض الملف، وتضطر محادثة الذكاء الاصطناعي إلى تخمين معنى كل قيمة.',
            'والفخ الثاني حقل يحمل سطرًا جديدًا داخل علامات اقتباس، كعنوان أو تعليق. الأداة التي تعدّ أسطر النص قد تقطع هذا السجل نصفين، فيبقى نصفه في آخر جزء وبقيته في أول الجزء التالي. والتقسيم حسب السجلات لا حسب الأسطر يتجنب ذلك.',
          ],
        },
        {
          heading: 'كيف تقسّم ملف CSV داخل المتصفح',
          paragraphs: ['يقرأ تقسيم CSV الملف على جهازك، ولا يُرسل شيء إلى خادم:'],
          list: [
            'افتح صفحة التقسيم وأفلت ملف .csv عليها أو اختره. وبعد قراءة الجدول تُفتح نافذة التنزيل وخيار «تقسيم إلى عدة ملفات» محدد مسبقًا.',
            'في «التقسيم حسب» أبقِ «عدد الصفوف في كل ملف» واكتب رقمًا (القيمة المبدئية 10,000)، أو اختر «حجم كل ملف» وأدخل الميغابايت لكل ملف. وتحت خانة الصفوف تخبرك النافذة بعدد الملفات التي ستحصل عليها.',
            'اضغط «تنزيل». ستحصل على ملف ZIP واحد باسم ملفك، مثل orders-parts.zip، فيه orders-part-1.csv وorders-part-2.csv وهكذا، وكل جزء يبدأ بصف العناوين.',
            'لتقسيم جزء من البيانات فقط، أغلق النافذة وصفِّ الصفوف أو أخفِ الأعمدة التي لا تحتاجها، ثم اختر «خيارات التنزيل…» من قائمة «المزيد» وعلّم على خيار الصفوف الظاهرة وعلى خيار التقسيم من جديد.',
            'الملف الذي يتجاوز 50 ميغابايت يعرض تحذيرًا بأنه قد يكون بطيئًا، ثم يُفتح إن كانت ذاكرة متصفحك تكفي. وليس للأداة حد صفوف خاص بها. ولتتصفح ملفًا كبيرًا قبل تقسيمه استخدم عارض ملفات CSV الكبيرة.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'مثال محسوب: 2,500,000 صف لأجل Excel',
          paragraphs: ['لنفترض أن ملف تصدير فيه صف عناوين و2,500,000 صف بيانات. تتسع ورقة عمل Excel لـ 1,048,576 صفًا بما فيها صف العناوين (صفحة مواصفات Excel وحدوده من Microsoft، تاريخ المراجعة 24 نوفمبر 2026)، فأقصى ما يحمله الجزء الواحد 1,048,575 صف بيانات. والرقم المستدير 1,000,000 صف لكل ملف يترك هامشًا ويسهل التحقق منه:'],
          list: [
            '2,500,000 ÷ 1,000,000 = 2.5، إذن ستحصل على 3 ملفات.',
            'الجزء 1: صف العناوين والصفوف من 1 إلى 1,000,000، أي 1,000,001 سطر.',
            'الجزء 2: صف العناوين والصفوف من 1,000,001 إلى 2,000,000، أي 1,000,001 سطر.',
            'الجزء 3: صف العناوين والصفوف من 2,000,001 إلى 2,500,000، أي 500,001 سطر.',
            'كل جزء أقل من 1,048,576 سطرًا، ومجموع الأجزاء 2,500,000 صف بيانات: لم يضِع صف ولم يُحسب صف مرتين.',
          ],
          links: [{ text: 'مواصفات Excel وحدوده', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }],
        },
        {
          heading: 'ما الذي قسناه على ملف تجريبي',
          paragraphs: ['أنشأنا ملف طلبات مصطنعًا (order_id وorder_date وregion وproduct_code وquantity وamount) فيه 250,000 صف بيانات وحجمه 9.51 ميغابايت، ومررناه على قاعدة التقسيم نفسها التي تستخدمها الصفحة:'],
          list: [
            '100,000 صف لكل ملف: 3 أجزاء فيها 100,000 و100,000 و50,000 صف بيانات، ومع كل منها صف العناوين.',
            '5 ميغابايت لكل ملف: جزآن فيهما 128,221 و121,779 صف بيانات، بحجم 4.88 و4.63 ميغابايت. فالتقسيم بالحجم يقطع بين الصفوف، فينتهي الجزء عند آخر صف كامل يتسع له، ويأتي غالبًا أقل قليلًا من الرقم الذي تكتبه.',
            'أمر split -l 100000 العادي على الملف نفسه في macOS: 3 أجزاء، والأول وحده فيه صف العناوين؛ أما الجزآن الآخران فبدآ بصف طلب.',
          ],
        },
        {
          heading: 'اختر حجم الجزء حسب وجهة الملف',
          paragraphs: ['الرقم المناسب يتوقف على ما سيقرأ الأجزاء:'],
          list: [
            'Excel: حتى 1,048,575 صف بيانات في الجزء، و1,000,000 رقم مستدير آمن. وإن كان Excel بطيئًا حتى دون حد الصفوف، فدليل ملف CSV أكبر من أن يفتحه Excel يشرح الخيارات الأخرى.',
            'نموذج رفع له حد للحجم، مثل 10 ميغابايت: استخدم «حجم كل ملف» واجعله أقل قليلًا، 9 ميغابايت مثلًا، لأن حجم كل جزء تقريبي لا دقيق.',
            'محادثة ذكاء اصطناعي: المهم هناك الرموز لا الصفوف. عُدّ رموز جزء واحد بأداة عدّاد الرموز، ثم اختر عدد صفوف يتسع. ودليل ملف أكبر من أن يقبله ChatGPT يشرح الحدود.',
            'إن فُتح جزء في عمود واحد في Excel فالتقسيم سليم، لكن الفاصل لا يطابق إعدادات جهازك. ودليل ملف CSV يُفتح في عمود واحد يشرح الحل.',
          ],
          links: [
            { text: 'ملف CSV أكبر من أن يفتحه Excel', path: '/csv-too-big-for-excel' },
            { text: 'عدّاد الرموز', path: '/token-counter' },
            { text: 'ملف أكبر من أن يقبله ChatGPT', path: '/file-too-large-for-chatgpt' },
            { text: 'ملف CSV يُفتح في عمود واحد', path: '/csv-opens-in-one-column' },
          ],
        },
        {
          heading: 'البديل من سطر الأوامر',
          paragraphs: [
            'في macOS وLinux يقطع الأمر split -l 1000000 orders.csv part_ الملف إلى قطع من 1,000,000 سطر. وهو يتفوق على المتصفح في أمور: يقرأ الملف تدفقًا، فيمكن أن يكون الملف أكبر من ذاكرتك، وهو سريع، ويدخل في سكربت يعمل كل ليلة. لكن انتبه لأمرين: لا يكرر صف العناوين، فالجزء part_aa وحده فيه أسماء الأعمدة، ويعدّ أسطر النص لا السجلات، فقد يقطع حقلًا مقتبسًا فيه سطر جديد إلى نصفين. أما split -b فيقطع عند عدد من البايتات وقد يكسر الصف من منتصفه.',
            'لتكرار صف العناوين، قسّم كل ما بعد السطر الأول، ثم أعد صف العناوين إلى أول كل قطعة. على ملفنا التجريبي أعطى هذان الأمران ثلاثة أجزاء .csv يبدأ كل منها بصف العناوين. لكنهما ما زالا يعدّان الأسطر، فاستخدمهما فقط إن لم يكن في أي حقل سطر جديد:',
          ],
          list: [
            'tail -n +2 orders.csv | split -l 1000000 - part_',
            'for f in part_*; do (head -n 1 orders.csv; cat "$f") > "$f.csv"; rm "$f"; done',
          ],
        },
        {
          heading: 'هل يحتفظ كل جزء بصف العناوين؟',
          paragraphs: ['نعم، كل جزء يصنعه تقسيم CSV يبدأ بصف العناوين الأصلي، فيُفتح كل ملف أو يُستورد وحده. وإن كانت الأجزاء ذاهبة إلى نظام يريد صفوف البيانات فقط، فأزل العلامة عن «تضمين صف العناوين» في النافذة نفسها قبل أن تضغط «تنزيل»، فيحمل كل جزء الصفوف وحدها.'],
        },
        {
          heading: 'هل أستطيع تقسيم CSV حسب قيم عمود واحد؟',
          paragraphs: ['ليس بخطوة واحدة: تقسيم CSV يقطع حسب الصفوف أو الحجم، لا حسب قيم عمود. ولتحصل على ملف لكل منطقة، صفِّ عمود المنطقة على قيمة واحدة، ونزّل الصفوف الظاهرة، وكرر ذلك لكل قيمة. مع قيم قليلة يستغرق الأمر دقائق، ومع مئات القيم يكون السكربت أسرع.'],
        },
        {
          heading: 'كيف أعيد الأجزاء إلى ملف واحد؟',
          paragraphs: ['استخدم دمج CSV: أضف الأجزاء بترتيبها فيكتب ملف CSV واحدًا بصف عناوين واحد. تُطابَق الأعمدة بأسمائها، فالجزء الذي جاءت أعمدته بترتيب مختلف يصطف مع غيره. ويحتاج كل جزء إلى أسماء الأعمدة نفسها في صف عناوينه، وهذا سبب آخر لإبقاء صف العناوين في كل جزء.'],
          links: [{ text: 'دمج CSV', path: '/merge-csv' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر حجم الملف وعدد صفوفه والجهة التي ستذهب إليها الأجزاء (دون بيانات شخصية).`],
        },
      ],
    },
    '/json-vs-json-lines': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['ملف JSON يحمل قيمة واحدة، غالبًا كائنًا واحدًا أو قائمة واحدة، ولا بد للبرنامج أن يقرأ الملف كله قبل أن يستعمله. أما ملف JSON Lines ‏(jsonl، ويُسمّى أيضًا NDJSON بامتداد ndjson) فيحمل قيمة JSON واحدة في كل سطر، فتُقرأ السجلات أو تُكتب أو تُضاف واحدًا واحدًا. ويفتح عارض JSON في OpenAnyDoc النوعين داخل متصفحك دون رفع الملف، ويعرض ملف jsonl أو ndjson قائمةً كل سطر فيها عنصر.'],
          links: [{ text: 'عارض JSON', path: '/json-viewer' }],
        },
        {
          heading: 'السجلات الثلاثة نفسها بالصيغتين',
          paragraphs: ['هذه ثلاثة أحداث سجل تجريبية. في مستند JSON واحد تقع بين قوسين مربعين وبينها فواصل:'],
          list: [
            'JSON: ‏[{"id":1,"event":"login"},{"id":2,"event":"upload"},{"id":3,"event":"logout"}]',
            'JSON Lines، السطر 1: {"id":1,"event":"login"}',
            'JSON Lines، السطر 2: {"id":2,"event":"upload"}',
            'JSON Lines، السطر 3: {"id":3,"event":"logout"}',
          ],
        },
        {
          heading: 'ما تقوله قواعد JSON Lines (تحققنا في 24 نوفمبر 2026)',
          paragraphs: ['يضع موقع jsonlines.org ثلاث قواعد واصطلاحين. وتصف مواصفة NDJSON الترتيب نفسه باسم آخر.'],
          list: [
            'النص بترميز UTF-8 دون علامة ترتيب البايتات (BOM).',
            'كل سطر قيمة JSON واحدة صالحة. السطر null صالح، والسطر الفارغ غير صالح.',
            'ينتهي كل سطر بفاصل أسطر (\\n). وتعمل نهايات أسطر ويندوز (\\r\\n) أيضًا، لأن المسافات حول قيمة JSON تُتجاهل.',
            'يُستحسن بقوة وجود فاصل أسطر بعد السطر الأخير، لكنه ليس شرطًا.',
            'يمكن أن تحمل الملفات الامتداد jsonl، وقد يكون نوع الوسائط application/jsonl، وهو لم يُعتمد معيارًا بعد.',
            'وتطلب مواصفة NDJSON الامتداد ndjson ونوع الوسائط application/x-ndjson.',
          ],
          links: [{ text: 'jsonlines.org', path: 'https://jsonlines.org/' }, { text: 'مواصفة NDJSON', path: 'https://github.com/ndjson/ndjson-spec' }],
        },
        {
          heading: 'متى تُستعمل كل صيغة',
          paragraphs: [
            'في JSON Lines لا أقواس حول الملف ولا فواصل بين السجلات، وكل سطر كامل بذاته. يستطيع البرنامج أن يضيف سجلًا بكتابة سطر جديد في آخر الملف دون أن يقرأه أولًا، ويمكن تقسيم الملف عند أي فاصل أسطر فيبقى كل جزء صالحًا.',
            'فالقاعدة التقريبية: JSON حين تُقرأ البيانات قطعة واحدة، وJSON Lines حين تكون سلسلة من سجلات منفصلة.',
          ],
          list: [
            'JSON: ردود واجهات API، وملفات الإعدادات، والتصديرات الصغيرة التي يحمّلها البرنامج دفعة واحدة.',
            'JSON Lines للسجلات (Logs): يصفها موقع jsonlines.org بأنها صيغة ممتازة لملفات السجل، لأن كل حدث سطر يُضاف إلى آخر الملف.',
            'JSON Lines بين البرامج وفي سلاسل أوامر الطرفية، حيث تقرأ الأدوات سطرًا وتكتب سطرًا.',
            'JSON Lines لملفات الدفعات وبيانات التدريب في الذكاء الاصطناعي. يقول دليل Batch API من OpenAI إن الدفعة تبدأ بملف jsonl يحمل كل سطر فيه طلبًا واحدًا، ويطلب دليل الضبط الدقيق بيانات التدريب بصيغة JSONL، بنية JSON كاملة في كل سطر (تحققنا من الاثنين في 24 نوفمبر 2026).',
          ],
          links: [{ text: 'دليل Batch API', path: 'https://developers.openai.com/api/docs/guides/batch' }, { text: 'دليل الضبط الدقيق', path: 'https://developers.openai.com/api/docs/guides/supervised-fine-tuning' }],
        },
        {
          heading: 'كيف تفتح ملف jsonl أو ndjson',
          paragraphs: ['أفلت الملف على عارض JSON أو اختره. يُقرأ الملف على جهازك، ولا يُرسل شيء إلى أي خادم.'],
          list: [
            'يصبح كل سطر عنصرًا في قائمة، وتظهر ملاحظة: «فُتح من JSON Lines: كل سطر عنصر في القائمة. يحفظ التنزيل الملف بصيغة JSON Lines مرة أخرى.»',
            'تعمل طرق العرض كلها، الشجرة والجدول والنص، كما تعمل مع أي ملف JSON. والملف المكوّن من سجلات بالحقول نفسها يُقرأ أفضل في الجدول.',
            'تُتخطى الأسطر الفارغة ولا تُرفض، فالملف الذي ينتهي بسطر فارغ يُفتح أيضًا.',
            'إن لم يكن أحد الأسطر JSON صالحًا، يتوقف العارض ويذكر رقم ذلك السطر، فتعرف أين تبحث.',
            'يحفظ التنزيل الملف بصيغة JSON Lines مرة أخرى، عنصرًا في كل سطر، مع تعديلاتك.',
            'تُفتح الملفات حتى 10 ميغابايت. والامتداد هو ما يحدد طريقة القراءة: ملف JSON Lines محفوظ باسم ينتهي بـ json يُقرأ JSON عاديًا فيفشل، فغيّر امتداده إلى jsonl أولًا.',
          ],
        },
        {
          heading: 'كيف تحوّل بين الصيغتين',
          paragraphs: ['بعد أن يُفتح ملف jsonl في عارض JSON:'],
          list: [
            'إلى JSON: افتح قائمة «نسخ» واختر «نسخ منسّقًا». تحصل على السجلات قائمة JSON واحدة بين قوسين مربعين، جاهزة للصق أو الحفظ.',
            'إلى جدول بيانات: افتح قائمة «تحويل» واختر «تحويل إلى CSV» أو «تحويل إلى Excel». يصبح كل سجل صفًا وكل حقل عمودًا.',
            'من قائمة JSON إلى JSON Lines: ليس في OpenAnyDoc زر لهذا الاتجاه بعد. وتكتب أداة سطر أوامر مثل jq عنصرًا في كل سطر بالأمر jq -c ".[]".',
          ],
        },
        {
          heading: 'لماذا يعطي ملف jsonl الخطأ "Unexpected non-whitespace character"؟',
          paragraphs: ['يعني هذا الخطأ أن برنامجًا قرأ الملف مستند JSON واحدًا، فوجد قيمة ثانية بعد السطر الأول. والأرجح أن الملف سليم بصيغة JSON Lines. افتحه بأداة تقرأ JSON Lines، أو تأكد أنه محفوظ بامتداد jsonl أو ndjson. ويشرح دليل أخطاء unexpected token بقية الرسائل.'],
          links: [{ text: 'دليل أخطاء unexpected token', path: '/json-unexpected-token' }],
        },
        {
          heading: 'هل NDJSON هو JSON Lines نفسه؟',
          paragraphs: ['في الاستعمال اليومي نعم: كلاهما يضع قيمة JSON واحدة في كل سطر وينهي الأسطر بفاصل أسطر. لكنهما جاءا من وصفين منفصلين، فاختلف الاسم، واختلف الامتداد ونوع الوسائط المقترحان: jsonl لـ JSON Lines، وndjson مع application/x-ndjson لـ NDJSON. ويفتح عارض JSON في OpenAnyDoc الامتدادين بالطريقة نفسها.'],
        },
        {
          heading: 'هل أستطيع فتح ملف JSON Lines في اكسل؟',
          paragraphs: ['ليس جدولًا مباشرة، لأن اكسل لا يقرأ ملفات فيها كائن في كل سطر. افتح ملف jsonl في عارض JSON في OpenAnyDoc، واختر «تحويل إلى Excel» من قائمة «تحويل»، ثم نزّل المصنف. تصبح الحقول المتداخلة أعمدة مستقلة. ويشرح دليل كيف تفتح ملف JSON بقية طرق قراءة JSON.'],
          links: [{ text: 'كيف تفتح ملف JSON', path: '/open-json-file' }],
        },
        {
          heading: 'هل يُرفع ملفي حين أفتحه هنا؟',
          paragraphs: ['لا. يقرأ عارض JSON ملفات JSON وJSON Lines بمتصفحك أنت، على جهازك، ويبقيها في ذاكرة الصفحة حتى تغلق التبويب. لا يُرسل شيء إلى أي خادم، وهذا مهم لملفات السجل وملفات دفعات الذكاء الاصطناعي التي تحمل غالبًا بيانات مستخدمين. ويمكنك أن تتحقق بنفسك من ذلك في لوحة الشبكة في المتصفح.'],
          links: [{ text: 'تتحقق بنفسك', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف الملف وما يظهر حين تفتحه (دون بيانات شخصية).`],
        },
      ],
    },
    '/compare-two-json-files': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['قارن البيانات لا النص: المقارنة التي تفهم JSON تطابق الكائنات مفتاحًا بمفتاح والقوائم موضعًا بموضع، فلا تُحسب المسافات البادئة الجديدة ولا ترتيب المفاتيح المختلف تغييرًا. وتفعل ذلك أداة مقارنة JSON في OpenAnyDoc داخل متصفحك دون رفع أي من الملفين، وتسرد كل قيمة أُضيفت أو حُذفت أو تغيّرت مع مسارها، مثل $.settings.language.'],
          links: [{ text: 'مقارنة JSON', path: '/json-compare' }],
        },
        {
          heading: 'لماذا تضلّلك المقارنة سطرًا بسطر',
          paragraphs: [
            'المقارنة النصية تقارن الأسطر. إن حُفظ أحد الملفين في سطر واحد ونُسّق الآخر بمسافتين، اختلف كل سطر. وإن كتب برنامج المفاتيح نفسها بترتيب آخر، أظهرت المقارنة أسطرًا محذوفة في مكان ومضافة في مكان آخر، مع أن البيانات واحدة.',
            'أما مقارنة JSON فتقرأ الملفين أولًا وتقارن ما يحملانه. المسافات لا تُحسب أبدًا، وترتيب المفاتيح لا يُحسب إلا إن طلبت ذلك.',
          ],
        },
        {
          heading: 'مثال عملي',
          paragraphs: ['نسختان من سجل حساب تجريبي. في الثانية رُقّيت الخطة، وأُضيفت ميزة، وتغيّرت اللغة، واستُخدم الكوبون، وظهر تاريخ نهاية التجربة، وخرجت المفاتيح بترتيب آخر:'],
          list: [
            'قبل: {"id":"A-1042","plan":"basic","seats":5,"features":["export","search"],"settings":{"theme":"light","language":"en"},"coupon":"WELCOME"}',
            'بعد: {"plan":"pro","id":"A-1042","seats":5,"features":["export","search","share"],"settings":{"language":"ar","theme":"light"},"trialEnds":"2026-12-31"}',
          ],
        },
        {
          heading: 'ما تُظهره المقارنة',
          paragraphs: ['حين يكون خيار «تجاهل ترتيب المفاتيح» مفعّلًا، وهو كذلك افتراضيًا، يقول الملخص «أُضيف 2، وحُذف 1، وتغيّر 2.» وتذكر القائمة تحته كل فرق:'],
          list: [
            'متغيّر: $.plan (صارت "basic" إلى "pro").',
            'مُضاف: $.features[2] ‏("share").',
            'متغيّر: $.settings.language (صارت "en" إلى "ar").',
            'محذوف: $.coupon.',
            'مُضاف: $.trialEnds.',
            'أوقف «تجاهل ترتيب المفاتيح» فتبقى الفروق الخمسة، ويليها «كائنان مفاتيحهما بترتيب آخر.»: السجل كله ($) و$.settings، وكل منهما مذكور بعنوان «ترتيب المفاتيح».',
            'لا تظهر id وseats وsettings.theme في القائمة، لأنها لم تتغير.',
          ],
        },
        {
          heading: 'كيف تقارن ملفي JSON خطوة بخطوة',
          paragraphs: ['يُقرأ الملفان على جهازك:'],
          list: [
            'افتح مقارنة JSON واختر الملف الأول، أو أفلته على الصفحة، أو الصق نصه. يُفتح على تبويب «مقارنة».',
            'الصق المستند الثاني في المربع، أو أفلت ملفه على المربع، أو اضغط «اختر ملفًا».',
            'اقرأ سطر الملخص، ثم قائمة الفروق. اضغط أي فرق فينتقل الجانبان إليه.',
            'المستند المفتوح على اليسار والمستند الثاني على اليمين، وكلاهما بمسافتين بادئتين. وحين يكون «تجاهل ترتيب المفاتيح» مفعّلًا، تظهر المفاتيح بالترتيب الأبجدي في الجانبين، فتتقابل الكائنات المتساوية.',
            'تُعلَّم الأسطر المتغيرة في كل جانب، فتقرأ القيم المحيطة بكل تغيير.',
          ],
        },
        {
          heading: 'القوائم والحدود والملفات غير الصالحة',
          paragraphs: [
            'الكائنات تُطابق بالمفتاح، أما القوائم فتُطابق بالموضع: العنصر 0 مع العنصر 0، والعنصر 1 مع العنصر 1. إن وُضعت "share" في بداية ["export","search"]، فالنتيجة ليست إضافة واحدة بل ثلاثة أسطر: $.features[0] متغيّر، و$.features[1] متغيّر، و$.features[2] مُضاف، لأن كل عنصر انتقل موضعًا واحدًا.',
            'حين ترى سلسلة تغييرات في آخر قائمة، تحقّق هل أُدرج عنصر أو حُذف قرب بدايتها. تعرض القائمة أول 300 فرق، ويعرض كل جانب حتى 20,000 سطر. ويمكن أن يصل الملف الأول إلى 10 ميغابايت.',
            'يُفحص المستند الثاني أثناء لصقه: إن لم يكن JSON صالحًا، تظهر رسالة المحلل تحت المربع بدل المقارنة. أصلحه في مدقق JSON، الذي يعرض السطر والعمود ويصلح الأخطاء الشائعة مثل الفواصل الزائدة. ويشرح دليل أخطاء unexpected token كل رسالة.',
          ],
          links: [{ text: 'مدقق JSON', path: '/json-validator' }, { text: 'دليل أخطاء unexpected token', path: '/json-unexpected-token' }],
        },
        {
          heading: 'هل يهم ترتيب المفاتيح عند مقارنة JSON؟',
          paragraphs: ['في الغالب لا: في JSON يحمل {"a":1,"b":2} و{"b":2,"a":1} البيانات نفسها، لذلك تعدّهما مقارنة JSON متساويين افتراضيًا. وقد يهم الترتيب حين يقرأ إنسان الملف، أو حين يقارن اختبار آلي النص الخام. أوقف «تجاهل ترتيب المفاتيح» فيُذكر كل كائن تحركت مفاتيحه بعنوان «ترتيب المفاتيح».'],
        },
        {
          heading: 'كيف أقارن رد API بنسخة محفوظة؟',
          paragraphs: ['افتح ملف json المحفوظ في مقارنة JSON أولًا، فيكون على اليسار. ثم انسخ الرد الجديد من برنامج API الذي تستعمله أو من لوحة الشبكة في المتصفح، والصقه في المربع على تبويب «مقارنة». يُذكر كل حقل أُضيف أو حُذف أو تغيّر منذ النسخة المحفوظة مع مساره.'],
        },
        {
          heading: 'هل أستطيع مقارنة ملفي JSON Lines؟',
          paragraphs: ['نعم، بخطوة إضافية واحدة، لأن المربع يقرأ مستند JSON واحدًا. افتح ملف jsonl الأول في عارض JSON، الذي يقرأ كل سطر عنصرًا في قائمة، وانتقل إلى تبويب «مقارنة» فيه. افتح الملف الثاني في تبويب آخر، واختر «نسخ منسّقًا» من قائمة «نسخ»، ثم الصقه. ويشرح دليل الفرق بين JSON وJSON Lines هذه الصيغة.'],
          links: [{ text: 'عارض JSON', path: '/json-viewer' }, { text: 'الفرق بين JSON وJSON Lines', path: '/json-vs-json-lines' }],
        },
        {
          heading: 'هل يُرفع ملفاي حين أقارنهما؟',
          paragraphs: ['لا. يقرأ متصفحك أنت المستندين ويقارنهما، ولا يُحفظ شيء ولا يُشارك، فلا يوجد رابط لإرساله أيضًا. وهذا مهم حين يحمل الملفان مفاتيح API أو سجلات عملاء. وتعرض مقارنتنا بين jsonformatter.org وCode Beautify كيف تصف مواقع JSON أخرى ما ترسله إلى خوادمها.'],
          links: [{ text: 'مقارنتنا بين jsonformatter.org وCode Beautify', path: '/jsonformatter-alternative' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف الملفين والفرق الذي توقعت أن تراه (دون بيانات شخصية).`],
        },
      ],
    },
    '/excel-row-and-column-limits': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['تتسع ورقة Excel الواحدة لـ 1,048,576 صفًا و16,384 عمودًا على الأكثر، وتتسع الخلية الواحدة لـ 32,767 حرفًا. ولا يحتفظ Excel إلا بخمس عشرة خانة من أي رقم، ولا يحسب إلا بالتواريخ من 1 يناير 1900 إلى 31 ديسمبر 9999. وإذا تجاوزت بياناتك هذه الحدود، يفتحها عارض ملفات CSV الكبيرة في OpenAnyDoc داخل متصفحك دون حد للصفوف خاص به، وتقسّمها أداة تقسيم CSV إلى أجزاء يفتحها Excel، دون رفع الملف.'],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }, { text: 'تقسيم CSV', path: '/split-csv' }],
        },
        {
          heading: 'الحدود كما تذكرها Microsoft',
          paragraphs: ['هذه الأرقام منقولة من صفحة مواصفات Excel وحدوده لدى Microsoft (تحققنا منها في 24 نوفمبر 2026)، وهي تنطبق على Excel لـ Microsoft 365 وعلى Excel 2016 و2019 و2021 و2024:'],
          list: [
            'الصفوف في الورقة: 1,048,576.',
            'الأعمدة في الورقة: 16,384، فآخر عمود هو XFD.',
            'الأحرف في الخلية الواحدة: 32,767.',
            'فواصل الأسطر في الخلية الواحدة: 253.',
            'الأحرف في الرأس أو التذييل: 255.',
            'الأحرف في الصيغة: 8,192؛ والوسائط في الدالة الواحدة: 255؛ ومستويات الدوال المتداخلة: 64.',
            'دقة الأرقام: 15 خانة.',
            'التواريخ التي يحسب بها Excel: من 1 يناير 1900 إلى 31 ديسمبر 9999.',
            'العناصر المعروضة في قائمة التصفية المنسدلة: 10,000.',
            'الارتباطات التشعبية في الورقة: 65,530.',
            'تنسيقات الخلايا وأنماطها المختلفة في المصنف: 65,490.',
            'مستويات التراجع: 100.',
            'الأوراق في المصنف: لا يحدها إلا حجم الذاكرة المتاحة.',
          ],
          links: [{ text: 'صفحة مواصفات Excel وحدوده', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }],
        },
        {
          heading: 'ماذا يعني كل حد لملف حقيقي',
          paragraphs: ['معظم الناس لا يصطدمون إلا بحد الصفوف، وقد شرحه بالتفصيل دليل ملف CSV أكبر من أن يفتحه Excel. أما الحدود الأخرى فتوقع الناس بهدوء أكبر. والأرقام من صفحة مواصفات Excel وحدوده ومن صفحة Microsoft عن الاحتفاظ بالأصفار البادئة والأرقام الكبيرة (تحققنا منها في 24 نوفمبر 2026):'],
          list: [
            'الأعمدة: الملفات العريضة تبلغ 16,384 عمودًا قبل أن تقترب من مليون صف بكثير. فاستبيان فيه عمود لكل سؤال وخيار إجابة، أو بيانات أجهزة استشعار فيها عمود لكل قراءة، قد لا يتجاوز بضعة آلاف من الصفوف ويبقى أعرض من الحد.',
            'الخانات الخمس عشرة: يحتفظ Excel بخمس عشرة خانة معنوية من الرقم، فالرقم المرجعي المكوّن من 16 خانة مثل 1234567890123456، إذا كُتب أو فُتح رقمًا، يُخزَّن 1234567890123450. ولا تسلم أرقام الطلبات والباركود والرموز الطويلة إلا إذا بقيت نصًا.',
            '32,767 حرفًا: حقول النص الحر الطويلة، كالتعليقات والأوصاف أو JSON الملصق في عمود، قد تكون أطول مما تتسع له خلية واحدة.',
            '253 فاصل أسطر: العنوان أو الملاحظة متعددة الأسطر تُحسب على هذا الحد أيضًا، بمعزل عن حد الأحرف.',
            'التواريخ قبل 1900: هي أقدم من أول تاريخ يحسب به Excel، فلا يستطيع Excel أن يحسب بسجلات القرن التاسع عشر بوصفها تواريخ.',
            '10,000 عنصر في التصفية: العمود الذي فيه قيم مختلفة أكثر من ذلك لا تظهر كلها في قائمة التصفية، فاستخدم عامل تصفية نصيًا مثل «يحتوي على» بدل تحديد القيم.',
          ],
          links: [{ text: 'ملف CSV أكبر من أن يفتحه Excel', path: '/csv-too-big-for-excel' }, { text: 'صفحة مواصفات Excel وحدوده', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }, { text: 'الاحتفاظ بالأصفار البادئة والأرقام الكبيرة', path: 'https://support.microsoft.com/en-us/office/keeping-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7' }],
        },
        {
          heading: 'مثال عملي: هل يتسع هذا الملف؟',
          paragraphs: ['احسبها قبل أن تفتح الملف. إليك ملفين تجريبيين، وطريقة عدّ ملفك أنت:'],
          list: [
            'ملف مبيعات من 2,400,000 صف و12 عمودًا: الأعمدة لا مشكلة فيها، أما الصفوف فنعم. وإذا قُسّم إلى أجزاء من 1,000,000 صف صار ثلاثة ملفات من 1,000,000 و1,000,000 و400,000 صف، في أعلى كل منها صف العناوين، وكل جزء أقل من 1,048,576.',
            'سجل أجهزة استشعار من 5,000 صف يحفظ كل ثانية من تجربة مدتها خمس ساعات في عمود خاص بها: 18,000 عمود، أي أكثر من 16,384، مع أن عدد الصفوف صغير. أخفِ الأعمدة التي لا تحتاجها قبل أن تحفظه لبرنامج Excel.',
            'ولتعرف الحجم الحقيقي للملف قبل أن يراه Excel، أسقطه في عارض CSV واختر «المشكلات» من قائمة «المزيد»: يعرض «تقرير الملف» عدد الصفوف × الأعمدة والفاصل والترميز. أما عدّ الأسطر في محرر نصوص فقد يعطي رقمًا أكبر، لأن الخلية المقتبسة التي فيها فاصل أسطر تشغل سطرين وهي صف واحد.',
          ],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'إذا تجاوزت بياناتك أحد الحدود',
          paragraphs: ['كل هذا يعمل في متصفحك، ولا يُرفع الملف:'],
          list: [
            'صفوف أكثر من أن تتصفحها: افتح الملف في عارض ملفات CSV الكبيرة. ليس له حد للصفوف خاص به، فالحد هو ذاكرة جهازك، وتظهر للملف الأكبر من 50 ميغابايت رسالة تنبيه أولًا. صفِّ الصفوف التي تحتاجها، ثم اختر «خيارات التنزيل» من قائمة «المزيد» وعلّم على «الصفوف الظاهرة فقط».',
            'صفوف أكثر مما يحتمله Excel لدى من سيستلم الملف: تقسّم أداة تقسيم CSV الملف بعدد من الصفوف أو بحجم بالميغابايت لكل ملف. ويحتفظ كل جزء بصف العناوين، وتُنزَّل الأجزاء معًا في ملف ZIP واحد.',
            'أعمدة كثيرة: أخفِ الأعمدة التي لا تحتاجها في عارض CSV، ثم اختر «خيارات التنزيل» وعلّم على «الصفوف الظاهرة فقط». الأعمدة المخفية لا تدخل في تلك النسخة.',
            'رموز طويلة يجب أن تبقى كل خاناتها: أداة تحويل CSV إلى Excel لا تحوّل إلى أرقام إلا الأرقام البسيطة. أما قيم مثل 007 وأرقام الهواتف والأعداد الصحيحة الأطول من 15 خانة فتبقى نصًا، فلا تضيع أي خانة.',
            'مصنف أكبر من أن تعمل عليه: تقسّم أداة تقسيم ملف Excel المصنف إلى ملفات .xlsx أصغر حسب الورقة، أو كل عدد معيّن من الصفوف، أو حسب قيم عمود.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }, { text: 'تقسيم CSV', path: '/split-csv' }, { text: 'عارض CSV', path: '/csv-viewer' }, { text: 'تحويل CSV إلى Excel', path: '/csv-to-excel' }, { text: 'تقسيم ملف Excel', path: '/split-excel' }],
        },
        {
          heading: 'حيث يقدّم Excel أكثر',
          paragraphs: [
            'لدى Excel طريقته الخاصة لتجاوز حد الورقة. فأداة Power Query ونموذج البيانات (Data Model) يحمّلان أكثر من 1,048,576 صفًا دون وضعها في خلايا، ثم يستطيع جدول PivotTable تلخيصها كلها، كما تشرح صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel (تحققنا منها في 24 نوفمبر 2026). وعلى نظام 64 بت لا تذكر صفحة مواصفات Excel وحدوده حدًا ثابتًا لحجم ملف نموذج البيانات، بل الذاكرة المتاحة وموارد النظام فقط.',
            'أما عارضات OpenAnyDoc فتعرض الصفوف وتعدّلها في جدول، مع التصفية والترتيب والتجميع، لكن ليس فيها جداول PivotTable، وهي مثل Excel محدودة بذاكرة جهازك. وإن كانت بياناتك قد تجاوزت جدول البيانات أصلًا، فدليل CSV أم Excel أم JSON يشرح متى تناسبها صيغة أخرى.',
          ],
          links: [{ text: 'مجموعة بيانات أكبر من شبكة Excel', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'صفحة مواصفات Excel وحدوده', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' }, { text: 'CSV أم Excel أم JSON', path: '/csv-vs-excel-vs-json' }],
        },
        {
          heading: 'كم صفًا وعمودًا يتسع Excel؟',
          paragraphs: ['تتسع ورقة Excel لـ 1,048,576 صفًا و16,384 عمودًا، بحسب حدود Microsoft لبرنامج Excel لـ Microsoft 365 وExcel من 2016 إلى 2024. أما صيغة .xls الأقدم، التي استخدمها Excel من 97 إلى 2003، فتتوقف عند 65,536 صفًا و256 عمودًا، بحسب صفحتي Microsoft عن مجموعة بيانات أكبر من شبكة Excel وعن استخدام Excel مع الإصدارات الأقدم (تحققنا منها في 24 نوفمبر 2026). ويتسع المصنف لأوراق بقدر ما تسمح الذاكرة.'],
          links: [{ text: 'مجموعة بيانات أكبر من شبكة Excel', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'استخدام Excel مع الإصدارات الأقدم', path: 'https://support.microsoft.com/office/use-excel-with-earlier-versions-of-excel-2fd9ffcb-6fce-485b-85af-fecfd651a5ac' }],
        },
        {
          heading: 'لماذا غيّر Excel الخانات الأخيرة من رقمي الطويل؟',
          paragraphs: ['لا يحتفظ Excel إلا بخمس عشرة خانة معنوية من أي رقم، فتُقرَّب الأرقام الأطول وتصير الخانات الزائدة أصفارًا. ويحدث هذا لأرقام الطلبات الطويلة والرموز المرجعية والمعرّفات. نسّق العمود نصًا قبل إدخال الأرقام، أو استورد الملف من «بيانات» ثم «من نص/CSV» واجعل نوع ذلك العمود نصًا، كما تشرح صفحة Microsoft عن الاحتفاظ بالأصفار البادئة والأرقام الكبيرة (تحققنا منها في 24 نوفمبر 2026).'],
          links: [{ text: 'الاحتفاظ بالأصفار البادئة والأرقام الكبيرة', path: 'https://support.microsoft.com/en-us/office/keeping-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7' }],
        },
        {
          heading: 'هل هناك حد لعدد الأوراق أو لطول اسم الورقة؟',
          paragraphs: ['لا تذكر Microsoft عددًا ثابتًا للأوراق: يتسع المصنف لأوراق بقدر ما تسمح ذاكرة جهازك. أما اسم الورقة فحده 31 حرفًا، كما تذكر صفحة Microsoft عن إعادة تسمية ورقة عمل (تحققنا منها في 24 نوفمبر 2026). وإذا كبر المصنف على من سيستلمه، فأداة تقسيم ملف Excel تحفظ كل ورقة في ملف مستقل، داخل متصفحك.'],
          links: [{ text: 'إعادة تسمية ورقة عمل', path: 'https://support.microsoft.com/en-us/office/rename-a-worksheet-3f1f7148-ee83-404d-8ef0-9ff99fbad1f9' }, { text: 'تقسيم ملف Excel', path: '/split-excel' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر عدد صفوف ملفك وأعمدته وما تحتاجه منه (دون بيانات شخصية).`],
        },
      ],
    },
    '/find-hidden-sheets-in-excel': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['يمكن للمصنف أن يخفي أوراقًا كاملة، وصفوفًا وأعمدة بعينها، والصيغ التي تقف وراء أرقامه، والورقة المضبوطة على «مخفية جدًا» لا تظهر أصلًا في قائمة «إظهار» في Excel. ويعرض عارض Excel في OpenAnyDoc كل ذلك دفعة واحدة: يذكر الأوراق المخفية والمخفية جدًا بجانب ألسنة الأوراق، ويعدّ الصفوف والأعمدة المخفية، ويسرد كل صيغة، داخل متصفحك دون رفع الملف.'],
          links: [{ text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'أربعة أماكن يخفي فيها المصنف شيئًا',
          paragraphs: ['تحقق منها كلها قبل أن تثق بمصنف أو تشاركه:'],
          list: [
            'الأوراق المخفية: تُخفى بالأمر «إخفاء» من لسان الورقة، وتعود بالأمر «إظهار».',
            'الأوراق المخفية جدًا: تُضبط من محرر VBA أو بماكرو. ويقول مرجع Microsoft لحالة ظهور الورقة (تحققنا منه في 24 نوفمبر 2026) إن المستخدم لا يستطيع إظهار هذه الورقة من القوائم؛ لا يُظهرها إلا تغيير خاصية Visible لها.',
            'الصفوف والأعمدة المخفية: تحتفظ ببياناتها لكنها لا تشغل أي مساحة على الشاشة.',
            'الصيغ: تعرض الخلية رقمًا، وقد تقرأ الصيغة التي وراءه من ورقة مخفية أو من مصنف آخر أو من اسم معرّف.',
          ],
          links: [{ text: 'مرجع Microsoft لحالة ظهور الورقة', path: 'https://learn.microsoft.com/en-us/office/vba/api/excel.xlsheetvisibility' }],
        },
        {
          heading: 'اعثر على الأوراق والصفوف والأعمدة المخفية في متصفحك',
          paragraphs: ['افتح المصنف في عارض Excel (.xlsx أو .xlsm أو .xls). يُقرأ الملف على جهازك ولا يُرفع شيء:'],
          list: [
            'إن كان المصنف يخفي أوراقًا، تخبرك رسالة بذلك عند فتحه، ويظهر زر مثل «ورقتان مخفيتان» بجانب ألسنة الأوراق.',
            'انقر هذا الزر لترى قائمة بكل ورقة مخفية، وبجانب كل منها «مخفية» أو «مخفية جدًا». انقر إحداها فيصبح لها لسان، فتقرؤها مثل أي ورقة أخرى.',
            'إن كانت الورقة المعروضة تخفي صفوفًا أو أعمدة، يعرض شريط الحالة أسفل الصفحة عددها، مثل «صفوف مخفية: 3، أعمدة: 1 · إظهار». انقر «إظهار»، أو فعّل «إظهار الصفوف والأعمدة المخفية» من قائمة «عرض».',
            'وللحصول على نظرة شاملة، اختر «معلومات المصنف» من قائمة «عرض»: عدد الأوراق، وكم منها مخفية ومخفية جدًا، وعدد الصيغ والملاحظات والروابط، والأسماء المعرّفة، والروابط إلى مصنفات أخرى، وهل يحتوي الملف على وحدات ماكرو. ولا تُشغَّل وحدات الماكرو أبدًا.',
          ],
          links: [{ text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'اطّلع على كل صيغة',
          paragraphs: ['في قائمة «عرض» ثلاث طرق لقراءة ما وراء الأرقام:'],
          list: [
            '«إظهار الصيغ» (Ctrl+` في Windows و⌘` في Mac) يضع كل صيغة في خليتها بدل نتيجتها.',
            '«قائمة الصيغ» تعرض كل صيغة في المصنف مع ورقتها وعنوان خليتها وقيمتها الحالية، وتميّز الصيغ الموجودة في ورقة مخفية. اكتب في مربع التصفية، مثل SUM أو VLOOKUP، أو علّم على «هذه الورقة فقط». وانقر صيغة لتنتقل إلى خليتها. وتُعرض أول 2,000 صيغة.',
            '«البحث في كل الأوراق» (Ctrl+Shift+F) يبحث في كل ورقة، بما فيها المخفية. علّم على «البحث في الصيغ» لتبحث في الصيغ بدل القيم.',
          ],
        },
        {
          heading: 'مثال عملي: إجمالي يقرأ من أوراق مخفية',
          paragraphs: [
            'مصنف ميزانية تجريبي فيه ثلاث أوراق: Summary وهي ظاهرة، وRates وهي مخفية، وLookup وهي مخفية جدًا. تعرض Summary إجماليًا قدره 18,750 في الخلية B4، ولا شيء آخر يبدو غريبًا.',
            'في العارض، تقول الرسالة عند الفتح إن في المصنف ورقتين مخفيتين. وتعرض «قائمة الصيغ» الخلية Summary!B4 وفيها =Rates!B2*Lookup!C7 وقيمتها 18,750. وبفتح الورقتين المخفيتين يتبيّن أن Rates!B2 تساوي 1.25 وأن Lookup!C7 تساوي 15,000. أما في Excel فكان الأمر «إظهار» سيعرض Rates وحدها: فالورقة Lookup مخفية جدًا ولا تظهر هناك.',
          ],
        },
        {
          heading: 'طريقة Excel',
          paragraphs: [
            'يقدّم Excel ما لا يقدّمه العارض: يُظهر الورقة نهائيًا عند الحفظ، ويتيح تعديل وحدات الماكرو التي في الملف. وإن لم يكن Excel متاحًا لديك، فدليل فتح ملف XLSX بدون Excel يقارن الخيارات المجانية.',
            'خطوات Excel نفسها (صفحات Microsoft، تحققنا منها في 24 نوفمبر 2026):',
          ],
          list: [
            'الأوراق المخفية: انقر بزر الفأرة الأيمن على أي لسان ورقة ظاهر، واختر «إظهار»، وحدد الأوراق ثم انقر «موافق». الخطوات في صفحة إخفاء أوراق العمل أو إظهارها.',
            'الأوراق المخفية جدًا: لا تظهر في قائمة «إظهار». افتح محرر VBA (Alt+F11 في Windows، كما تذكر صفحة اختصارات لوحة المفاتيح في Excel)، واضبط خاصية Visible للورقة على -1 - xlSheetVisible، وهي القيمة الواردة في مرجع Microsoft لحالة ظهور الورقة.',
            'الصفوف والأعمدة: حدد الصفوف أو الأعمدة على جانبي الجزء المخفي، وانقر بزر الفأرة الأيمن واختر «إظهار»، أو انقر نقرًا مزدوجًا على الخط المزدوج في مكانها. الخطوات في صفحة إخفاء الصفوف أو الأعمدة أو إظهارها.',
            'الصيغ: الأمر «إظهار الصيغ» في تبويب «الصيغ» يبدّل الورقة بين الصيغ والنتائج. الخطوات في صفحة عرض الصيغ أو إخفاؤها.',
          ],
          links: [
            { text: 'فتح ملف XLSX بدون Excel', path: '/open-xlsx-without-excel' },
            { text: 'صفحة إخفاء أوراق العمل أو إظهارها', path: 'https://support.microsoft.com/en-us/office/hide-or-show-worksheets-or-workbooks-69f2701a-21f5-4186-87d7-341a8cf53344' },
            { text: 'صفحة إخفاء الصفوف أو الأعمدة أو إظهارها', path: 'https://support.microsoft.com/en-us/office/hide-or-show-rows-or-columns-659c2cad-802e-44ee-a614-dde8443579f8' },
            { text: 'اختصارات لوحة المفاتيح في Excel', path: 'https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f' },
            { text: 'مرجع Microsoft لحالة ظهور الورقة', path: 'https://learn.microsoft.com/en-us/office/vba/api/excel.xlsheetvisibility' },
            { text: 'صفحة عرض الصيغ أو إخفاؤها', path: 'https://support.microsoft.com/en-us/office/display-or-hide-formulas-f7f5ab4e-bf24-4efc-8fc9-0c1b77a5356f' },
          ],
        },
        {
          heading: 'إظهار الورقة في العارض لا يلغي إخفاءها',
          paragraphs: [
            'فتح ورقة مخفية في العارض لا يغيّر الملف. وعندما تنزّل المصنف من العارض، تبقى الأوراق المخفية والمخفية جدًا على حالها، وتبقى الصفوف والأعمدة المخفية مخفية، فيبدو ما ترسله كما كان من قبل.',
            'والمخفي ليس محذوفًا: كل من لديه الملف يستطيع العثور على هذه الأوراق بالطريقة نفسها. فقبل أن تشارك مصنفًا، احذف ما لا ينبغي أن يراه الطرف الآخر، واقرأ دليل إخفاء البيانات الشخصية قبل المشاركة. وانتبه إلى أن «كل الأوراق بصيغة CSV»، في نافذة «تقسيم الأوراق ودمجها وتصديرها» من قائمة «الأوراق»، يكتب الأوراق المخفية أيضًا.',
            'الحدود: تُقرأ الصفوف والأعمدة المخفية من ملفات .xlsx و.xlsm فقط، وتُفتح الأوراق المخفية في ملف .ods ألسنةً عادية. والمصنف الذي يحتاج كلمة مرور لفتحه لا يمكن قراءته. أما أداة إزالة حماية Excel فتزيل حماية الأوراق وبنية المصنف من ملف تملكه، لا كلمة مرور الفتح.',
          ],
          links: [{ text: 'إخفاء البيانات الشخصية قبل المشاركة', path: '/anonymize-data-before-sharing' }, { text: 'إزالة حماية Excel', path: '/unprotect-excel' }],
        },
        {
          heading: 'لماذا يكون الأمر «إظهار» معطّلًا في Excel؟',
          paragraphs: ['أمران يتركان الأمر «إظهار» في Excel بلا شيء يعرضه. فالأوراق المخفية جدًا لا يذكرها الأمر «إظهار»، بحسب صفحة إخفاء أوراق العمل أو إظهارها، وحين تكون بنية المصنف محمية يكون «إظهار» غير متاح، بحسب صفحة حماية مصنف (صفحات Microsoft، تحققنا منها في 24 نوفمبر 2026). أما فتح الملف في عارض يقرأ الملف نفسه فيكشف النوعين معًا.'],
          links: [{ text: 'صفحة إخفاء أوراق العمل أو إظهارها', path: 'https://support.microsoft.com/en-us/office/hide-or-show-worksheets-or-workbooks-69f2701a-21f5-4186-87d7-341a8cf53344' }, { text: 'صفحة حماية مصنف', path: 'https://support.microsoft.com/en-us/office/protect-a-workbook-7e365a4d-3e89-4616-84ca-1931257c1517' }],
        },
        {
          heading: 'ما الورقة المخفية جدًا في Excel؟',
          paragraphs: ['الورقة المخفية جدًا ورقة ضُبطت حالة ظهورها على xlSheetVeryHidden، غالبًا بماكرو أو من محرر VBA. ويستبعدها Excel من قائمة «إظهار»، فلا يعرف معظم الناس بوجودها. لكنها تظل تحمل بيانات وصيغًا، ويمكن للأوراق الأخرى أن تقرأ منها.'],
        },
        {
          heading: 'هل يمكن أن تحتوي ورقة مخفية على بيانات شخصية؟',
          paragraphs: ['نعم، فالورقة المخفية تنتقل داخل الملف بكل ما فيها، فالأسماء أو أرقام الهواتف أو الرواتب في ورقة مخفية تذهب حيثما يذهب المصنف. افحص الأوراق المخفية والمخفية جدًا قبل إرسال أي مصنف، واحذف ما لا ينبغي أن يصل إلى المستلم بدل أن تخفيه مرة أخرى.'],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف ما يخفيه المصنف وما تراه (دون بيانات شخصية).`],
        },
      ],
    },
    '/excel-to-csv-without-breaking-arabic': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لتحويل ملف Excel إلى CSV مع بقاء العربية مقروءة، احفظه بترميز UTF-8 مع علامة ترتيب البايتات (BOM): فترميز UTF-8 يحمل كل حرف عربي، والعلامة المكوّنة من ثلاثة بايتات في بداية الملف تخبر Excel كيف يقرؤه. وأداة تحويل Excel إلى CSV في OpenAnyDoc تفعل الأمرين داخل متصفحك: تكتب UTF-8 وتضيف العلامة كلما احتوت الورقة على أي حرف خارج النص الإنجليزي البسيط، كالحروف العربية، دون أن يُرفع المصنف.'],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }],
        },
        {
          heading: 'طريقتان تضيع بهما العربية عند الحفظ',
          paragraphs: ['قد تتلف العربية عند الحفظ بصيغة CSV في موضعين، ولكل منهما شكل مختلف. يتناول هذا الدليل كتابة الملف بشكل صحيح؛ أما إن كان لديك ملف CSV يُفتح بعربية مشوّهة، فدليل إصلاح ملف CSV تظهر فيه العربية مشوّهة يشرح الإصلاح.'],
          list: [
            'تُستبدل الحروف: إذا كُتب ملف CSV بترميز لا حروف عربية فيه، فلا يمكن تخزينها، ويُكتب كل حرف منها غالبًا علامة استفهام. ولا شيء يعيدها من ذلك الملف؛ الحل الوحيد أن تحفظ من المصنف مرة أخرى.',
            'تُخزَّن الحروف لكن تُقرأ خطأً: ملف UTF-8 بلا علامة يحتفظ بكل حرف، لكن Excel قد يعرضه مشوّهًا عند النقر المزدوج عليه، فتتحول «الرياض» إلى «Ø§Ù„Ø±ÙŠØ§Ø¶». وتقول ملاحظة Microsoft عن فتح ملفات CSV UTF-8 (تحققنا منها في 24 نوفمبر 2026) إن هذا الملف يُفتح بشكل عادي إذا حُفظ مع BOM.',
          ],
          links: [
            { text: 'إصلاح ملف CSV تظهر فيه العربية مشوّهة', path: '/fix-arabic-csv-in-excel' },
            { text: 'ملاحظة Microsoft عن فتح ملفات CSV UTF-8', path: 'https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032' },
          ],
        },
        {
          heading: 'كيف تبدو البايتات',
          paragraphs: ['ملف CSV مجرد بايتات، فيمكنك أن ترى الفرق بنفسك. خذ كلمة الرياض، وهي 6 حروف:'],
          list: [
            'بترميز UTF-8 تشغل 12 بايتًا، اثنين لكل حرف: D8 A7 D9 84 D8 B1 D9 8A D8 A7 D8 B6.',
            'بترميز Windows-1256، وهو ترميز Windows العربي القديم، تشغل 6 بايتات، واحدًا لكل حرف.',
            'إذا قُرئت هذه البايتات الاثنا عشر بترميز Windows-1252 الغربي، صارت Ø§Ù„Ø±ÙŠØ§Ø¶.',
            'علامة ترتيب البايتات هي البايتات الثلاثة EF BB BF في أول الملف تمامًا. افتح الملف في عارض CSV واختر «المشكلات» من قائمة «المزيد»: يذكر «تقرير الملف» الترميز وهل في الملف علامة BOM. أو شغّل الأمر node -e "console.log(require(\'fs\').readFileSync(\'file.csv\').subarray(0, 3))" وابحث عن <Buffer ef bb bf>.',
          ],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'حوّل الملف في متصفحك خطوة بخطوة',
          paragraphs: ['تقرأ أداة تحويل Excel إلى CSV المصنف على جهازك:'],
          list: [
            'أسقط ملف .xlsx أو .xls أو .xlsm أو .ods على الصفحة. تُحوَّل الورقة الأولى فورًا. ولورقة أخرى، افتح المصنف في عارض Excel، وانقر لسان الورقة، ثم «تحويل» و«تحويل إلى CSV».',
            'يُفتح ملف CSV في عارض CSV: فواصل بين الأعمدة، ونهايات أسطر Windows (CRLF)، وترميز UTF-8، وعلامة BOM إن كان في أي خلية حرف خارج النص الإنجليزي البسيط، كحرف عربي. والورقة التي ليس فيها إلا حروف إنجليزية وأرقام لا تأخذ العلامة، لأنها لا تحتاجها.',
            'تحقق منه: اختر «المشكلات» من قائمة «المزيد». يعرض «تقرير الملف» الترميز وعلامة BOM (نعم أو لا) ونهايات الأسطر.',
            'انقر «تنزيل»، فتحتفظ النسخة بالعلامة. ومن «خيارات التنزيل» في قائمة «المزيد» تختار الفاصلة المنقوطة أو علامة الجدولة أو الخط العمودي، ونهايات الأسطر LF أو CRLF، ويمكنك إلغاء «إضافة علامة ترتيب البايت (تساعد Excel على قراءة العربية)» لنظام يريد UTF-8 دون علامة.',
            'ولكل الأوراق دفعة واحدة، افتح المصنف في عارض Excel واختر «تقسيم الأوراق ودمجها وتصديرها» من قائمة «الأوراق»، ثم «تنزيل ملفات CSV (ZIP)». تصبح كل ورقة، بما فيها المخفية، ملف CSV مستقلًا بترميز UTF-8 مع العلامة.',
          ],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }, { text: 'عارض Excel', path: '/excel-viewer' }],
        },
        {
          heading: 'ما الذي يصل إلى ملف CSV',
          paragraphs: ['ملف CSV يحمل نصًا فقط، فتكتب الأداة كل خلية كما تعرضها الورقة:'],
          list: [
            'التواريخ والنسب المئوية والعملات تحتفظ بتنسيقها المعروض: 25% تبقى 25% ولا تصير 0.25.',
            'الصيغ تُكتب بالنتيجة المحفوظة في المصنف.',
            'الصفوف الفارغة تُحذف.',
            'تُكتب الأرقام الطويلة بتنسيق «عام» كاملة: فيبقى 123456789012 كما هو ولا يصير 1.23457E+11 كما يعرضه عمود ضيق، حتى 15 خانة معنوية وهو ما يحفظه Excel.',
            'اتجاه الورقة من اليمين إلى اليسار والخطوط والألوان لا تُحفظ، لأن ملف CSV لا يخزّن أي تخطيط؛ أما النص العربي نفسه فيُحفظ كما هو تمامًا.',
          ],
        },
        {
          heading: 'الطريقة في Excel',
          paragraphs: [
            'في Excel، اختر «ملف» ثم «حفظ باسم»، واختر نوعًا من أنواع CSV نوعًا للملف. ولا يحفظ Excel في ملف CSV إلا الورقة النشطة، فكرر ذلك لكل ورقة، كما تشرح صفحة Microsoft عن استيراد الملفات النصية وتصديرها (تحققنا منها في 24 نوفمبر 2026).',
            'ما يتفوق فيه Excel: يكتب ملف CSV مباشرة من المصنف الذي تعدّله، بخطوة واحدة. وما يوقع الناس فيه: قائمة الأنواع فيها أيضًا «CSV (محدد بفواصل)» و«CSV (Macintosh)» و«CSV (MS-DOS)»، وتصفها قائمة Microsoft لصيغ النص (تحققنا منها في 24 نوفمبر 2026) بأنها ملفات لأنظمة Windows وMacintosh وMS-DOS، دون أي ذكر لـ UTF-8.',
          ],
          links: [{ text: 'صفحة Microsoft عن استيراد الملفات النصية وتصديرها', path: 'https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba' }, { text: 'قائمة Microsoft لصيغ النص', path: 'https://support.microsoft.com/en-us/office/save-a-workbook-to-text-format-txt-or-csv-3e9a9d6c-70da-4255-aa28-fcacf1f081e6' }],
        },
        {
          heading: 'عندما يريد النظام المستقبِل شيئًا آخر',
          paragraphs: ['يحتاج Excel إلى العلامة، لكن ملف CSV ليس دائمًا لبرنامج Excel:'],
          list: [
            'قد يتوقع استيراد قاعدة بيانات أو سكربت أو نظام محاسبة UTF-8 بلا علامة، وبعضها يقرأ العلامة جزءًا من اسم العمود الأول. ألغِ علامة BOM من «خيارات التنزيل» قبل الحفظ.',
            'وقد يحتاج نظام عربي قديم إلى Windows-1256. تحفظ أداة تغيير ترميز CSV الملف بترميز UTF-8 مع BOM أو UTF-8 أو UTF-16 LE أو Windows-1256، وتعرض معاينة أولًا، وتنبّهك عندما يتعذر كتابة حرف بالترميز الذي اخترته.',
            'وقد يتوقع نظام في بلد يكتب الكسور العشرية بفاصلة أن تكون الفواصل منقوطة: اختر الفاصلة المنقوطة من «خيارات التنزيل».',
          ],
          links: [{ text: 'تغيير ترميز CSV', path: '/change-csv-encoding' }],
        },
        {
          heading: 'لماذا يعرض ملف CSV علامات استفهام بدل العربية؟',
          paragraphs: ['علامات الاستفهام تعني في الغالب أن الحروف العربية استُبدلت عند حفظ الملف، لأن الترميز المستخدم لا حروف عربية فيه. وإن أظهر برنامج آخر علامات الاستفهام نفسها، فالحروف قد ضاعت من ذلك الملف. حوّل المصنف الأصلي مرة أخرى بترميز UTF-8 مع BOM، بأداة تحويل Excel إلى CSV أو بنوع CSV UTF-8 في Excel.'],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }],
        },
        {
          heading: 'هل تسبب علامة BOM مشكلات خارج Excel؟',
          paragraphs: ['نادرًا ما تسبب علامة BOM مشكلات: معظم البرامج التي تقرأ UTF-8 تتعرف عليها وتتخطاها. لكن بعض السكربتات وأدوات الاستيراد لا تفعل، فتظهر رموز غريبة قبل اسم العمود الأول. وإن كان ملف CSV لنظام كهذا لا لبرنامج Excel، فألغِ علامة BOM من «خيارات التنزيل» قبل الحفظ.'],
        },
        {
          heading: 'هل يمكن أن يحمل ملف CSV واحد كل أوراق المصنف؟',
          paragraphs: ['لا، فملف CSV يحمل جدولًا واحدًا، فتصبح كل ورقة ملفًا مستقلًا. تحوّل أداة تحويل Excel إلى CSV الورقة الأولى، أو الورقة التي تختارها في عارض Excel، وينزّل «تقسيم الأوراق ودمجها وتصديرها» في قائمة «الأوراق» كل ورقة ملف CSV داخل ZIP واحد. أما هل CSV هي الصيغة المناسبة أصلًا، فيجيب عنه دليل CSV أم Excel أم JSON.'],
          links: [{ text: 'تحويل Excel إلى CSV', path: '/excel-to-csv' }, { text: 'CSV أم Excel أم JSON', path: '/csv-vs-excel-vs-json' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف ما تراه في ملف CSV (دون بيانات شخصية). يكفي السطر الأول عادةً.`],
        },
      ],
    },
    '/read-speaker-notes-without-powerpoint': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['افتح ملف ‎.pptx في عارض يقرأ الملاحظات مع الشرائح، فتظهر ملاحظات المتحدث تحت كل شريحة. عارض بوربوينت في OpenAnyDoc يفعل ذلك داخل متصفحك دون رفع الملف، ويتيح لك أيضًا البحث في الملاحظات وسماعها بصوت عالٍ ورؤيتها في عرض المقدِّم وتصديرها نصًا.'],
          links: [{ text: 'عارض بوربوينت', path: '/powerpoint-viewer' }],
        },
        {
          heading: 'كيف تقرأ الملاحظات في متصفحك',
          paragraphs: [
            'ملف ‎.pptx حزمة ZIP من أجزاء منفصلة، وملاحظات المتحدث لا تُحفظ مع الشرائح: كل شريحة لها ملاحظات تشير إلى صفحة ملاحظات خاصة بها، يضعها PowerPoint في مجلد ppt/notesSlides. والبرنامج الذي يرسم الشرائح فقط لا يفتح هذه الأجزاء أبدًا. ولتراها بنفسك، غيّر امتداد نسخة من العرض من ‎.pptx إلى ‎.zip وافتحها؛ كل ملف notesSlide فيها يحمل ملاحظات شريحة واحدة.',
            'يقرأ العارض الشرائح وصفحات الملاحظات معًا، على جهازك:',
          ],
          list: [
            'افتح العارض واختر ملف ‎.pptx أو ‎.ppsx أو ‎.potx أو ‎.pptm، أو أسقطه على الصفحة.',
            'إن كان في العرض ملاحظات، تنفتح لوحة «ملاحظات المتحدث» تحت الشريحة تلقائيًا. والشريحة التي لا ملاحظات لها تعرض «لا ملاحظات لهذه الشريحة.»، والعرض الخالي منها كلها يعرض «لا ملاحظات متحدث في هذا العرض.»',
            'تنقّل بالصور المصغّرة أو بزرّي السابق والتالي أو بمفاتيح الأسهم؛ تعرض اللوحة دائمًا ملاحظات الشريحة الظاهرة.',
            'زر «ملاحظات المتحدث» في شريط الأدوات، أو «عرض» ثم «ملاحظات المتحدث»، يُخفي اللوحة أو يُظهرها.',
          ],
        },
        {
          heading: 'ابحث في الملاحظات واستمع إليها وقدِّم بها',
          paragraphs: ['ثلاث أدوات أخرى في العارض تستخدم الملاحظات. وإن كنت تريد كلمة فقط، فأداة البحث في PowerPoint تسرد كل تطابق في الشرائح والملاحظات برقم شريحته، دون رسم الشرائح:'],
          list: [
            '«البحث في الشرائح والملاحظات» (في قائمة «عرض») يسرد كل تطابق برقم شريحته ويبيّن هل هو في الشريحة أم في الملاحظات. اضغط تطابقًا في الملاحظات فيفتح العارض تلك الشريحة ويظلّل الكلمات في لوحة الملاحظات. وفعّل «مطابقة حالة الأحرف» لتفرّق بين Sales وsales.',
            'القراءة بصوت عالٍ: اختر «ملاحظات المتحدث»، ثم «هذه الشريحة فقط» أو «من هذه الشريحة حتى النهاية». تُستخدم الأصوات المثبتة على جهازك فقط، بصوت عربي وصوت إنجليزي وإعداد للسرعة.',
            'زر «تقديم» يفتح عرض المقدِّم: الشريحة الحالية والتالية، وملاحظاتك مع زرّي «تصغير الملاحظات» و«تكبير الملاحظات»، ومؤقت تستطيع إيقافه وتصفيره، والساعة الآن. و«فتح نافذة الجمهور» يعرض الشريحة وحدها في نافذة ثانية؛ وإن منعها المتصفح، فإن «التقديم في هذه النافذة» يعرض الشرائح بملء الشاشة.',
          ],
          links: [{ text: 'البحث في PowerPoint', path: '/search-pptx' }],
        },
        {
          heading: 'أخرج الملاحظات نصًا',
          paragraphs: ['«ملف» ثم «تصدير المخطط» يحفظ عنوان كل شريحة ونصها وملاحظات المتحدث بترتيب الشرائح، بصيغة «نص عادي (.txt)» أو Markdown ‏(.md). هذا مخطط نصي لعرض تجريبي من ثلاث شرائح باسم q4-plan.pptx، في أول شريحتين منه ملاحظات (في الملف تكون الأسطر تحت كل شريحة مزاحة):'],
          list: [
            'q4-plan',
            'الشريحة 1: خطة الربع الرابع',
            'فريق المبيعات',
            'ملاحظات المتحدث:',
            'رحّب بالحضور.',
            'لا تتجاوز دقيقة واحدة هنا.',
            'الشريحة 2: النتائج',
            'الطلبات ارتفعت 12%',
            'المرتجعات انخفضت',
            'ملاحظات المتحدث:',
            'توقف هنا للأسئلة.',
            'الشريحة 3: الخطوات التالية',
            'توظيف شخصين',
          ],
        },
        {
          heading: 'طباعة الملاحظات أو إعطاؤها لمحادثة ذكاء اصطناعي',
          paragraphs: ['«طباعة / حفظ PDF» في العارض يطبع الشرائح شريحةً في كل صفحة دون الملاحظات، وأداة تحويل بوربوينت إلى PDF تترك الملاحظات أيضًا. ولطباعة الملاحظات على الورق، اطبع ملف ‎.txt المصدَّر من أي محرر نصوص. ولإعطاء الملاحظات لـ ChatGPT أو Claude أو Gemini، تصنع أداة تحويل PowerPoint إلى Markdown مخططًا من النوع نفسه مع عدد الرموز؛ راجع دليل إعطاء محادثة ذكاء اصطناعي عرض بوربوينت.'],
          links: [{ text: 'تحويل بوربوينت إلى PDF', path: '/pptx-to-pdf' }, { text: 'تحويل PowerPoint إلى Markdown', path: '/pptx-to-markdown' }, { text: 'إعطاء محادثة ذكاء اصطناعي عرض بوربوينت', path: '/powerpoint-to-ai-chat' }],
        },
        {
          heading: 'طرق أخرى لقراءة ملاحظات المتحدث',
          paragraphs: ['كل ما يلي مأخوذ من صفحات المساعدة الرسمية لكل شركة (تحققنا منها في 24 نوفمبر 2026). ولمقارنة أوسع بين البرامج، راجع دليل كيف تفتح ملف PPTX بدون بوربوينت.'],
          list: [
            'PowerPoint: لوحة الملاحظات تحت كل شريحة، وهناك أيضًا عرض Notes Page من تبويب View. ومن File ثم Print، يطبع تخطيط Notes Pages شريحة واحدة مع ملاحظاتها في كل صفحة، ومن File ثم Export ثم Create Handouts تُرسل الملاحظات إلى وورد، بجانب الشرائح أو تحتها.',
            'PowerPoint للويب: تستطيع كتابة الملاحظات، لكن Microsoft تقول إنه لا يعرضها لك أثناء التقديم؛ وهذا يحتاج إلى التطبيق المثبّت.',
            'Google Slides: من Presenter view ثم Speaker notes تظهر الملاحظات أثناء التقديم، ومن File ثم Print settings and preview ثم 1 slide with notes تُطبع كل شريحة مع ملاحظاتها.',
            'Keynote على Mac: يفتح ملفات ‎.pptx، ومن View ثم Show Presenter Notes تظهر الملاحظات تحت الشريحة، وتقول Apple إن الملاحظات يمكن طباعتها مع الشرائح.',
          ],
          links: [
            { text: 'كيف تفتح ملف PPTX بدون بوربوينت', path: '/open-pptx-without-powerpoint' },
            { text: 'عرض Notes Page من تبويب View', path: 'https://support.microsoft.com/en-us/office/choose-the-right-view-for-the-task-in-powerpoint-21332d8d-adbc-4717-a2c6-e25a697b40e9' },
            { text: 'يطبع تخطيط Notes Pages شريحة واحدة مع ملاحظاتها في كل صفحة', path: 'https://support.microsoft.com/en-us/powerpoint/print-speaker-notes' },
            { text: 'Microsoft تقول إنه لا يعرضها لك أثناء التقديم', path: 'https://support.microsoft.com/en-us/office/add-speaker-notes-to-your-slides-26985155-35f5-45ba-812b-e1bd3c48928e' },
            { text: 'من Presenter view ثم Speaker notes', path: 'https://support.google.com/docs/answer/1696787' },
            { text: '1 slide with notes', path: 'https://support.google.com/docs/answer/143346' },
            { text: 'يفتح ملفات ‎.pptx', path: 'https://support.apple.com/guide/keynote/open-or-close-a-presentation-tan72232b56/mac' },
            { text: 'Show Presenter Notes', path: 'https://support.apple.com/guide/keynote/add-and-view-presenter-notes-tand1a4ee7c/mac' },
          ],
        },
        {
          heading: 'أين تتفوق تلك البرامج',
          paragraphs: ['عارض OpenAnyDoc تجريبي وللقراءة فقط. PowerPoint وKeynote يتيحان كتابة الملاحظات وتعديلها؛ أما هنا فتُقرأ ويُبحث فيها وتُسمع وتُصدَّر فقط. ويعرض العارض الملاحظات نصًا عاديًا، سطرًا لكل فقرة، دون خط عريض أو ألوان أو علامات تعداد. كما يطبع PowerPoint وGoogle Slides وKeynote صورة كل شريحة مع ملاحظاتها، وهذا لا يفعله العارض، ولا يشغّل العارض الحركات والانتقالات حين تقدّم.'],
        },
        {
          heading: 'هل أستطيع تعديل ملاحظات المتحدث دون بوربوينت؟',
          paragraphs: ['نعم، تستطيع تعديل ملاحظات المتحدث دون تطبيق بوربوينت في PowerPoint للويب، الذي تقول Microsoft إنه يتيح إنشاء الملاحظات (تحققنا منها في 24 نوفمبر 2026)، أو في Keynote على Mac حيث تكتبها تحت الشريحة. أما عارض بوربوينت في OpenAnyDoc فيقرأ الملاحظات فقط: يعرضها ويبحث فيها ويقرؤها بصوت عالٍ ويصدّرها، ولا يغيّر ملفك أبدًا.'],
          links: [{ text: 'الذي تقول Microsoft إنه يتيح إنشاء الملاحظات', path: 'https://support.microsoft.com/en-us/office/add-speaker-notes-to-your-slides-26985155-35f5-45ba-812b-e1bd3c48928e' }],
        },
        {
          heading: 'لماذا لا تظهر ملاحظات المتحدث في عرضي؟',
          paragraphs: ['حين يقول العارض «لا ملاحظات متحدث في هذا العرض.»، فالملف نفسه لا يحمل نص ملاحظات. ويحدث ذلك حين لا تُكتب الملاحظات أصلًا، أو تُحذف، أو تُكتب في مربع نص على الشريحة نفسها. والصورة الملصقة في الملاحظات لا تظهر، وملفات ‎.ppt القديمة لا تُفتح هنا.'],
        },
        {
          heading: 'هل يُرفع العرض حين أقرأ ملاحظاته؟',
          paragraphs: ['لا، لا يُرفع عرضك: متصفحك يفتح ملف ‎.pptx ويقرأ شرائحه وملاحظاته على جهازك. والبحث والقراءة بصوت عالٍ وعرض المقدِّم وتصدير المخطط كلها تعمل هناك أيضًا، وتستمر دون اتصال بعد أن تفتح عرضًا هنا مرة. ولتتحقق بنفسك، راجع دليل كيف تتأكد أن موقعًا لا يرفع ملفك.'],
          links: [{ text: 'كيف تتأكد أن موقعًا لا يرفع ملفك', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصِف العرض التقديمي وما تراه في لوحة الملاحظات (دون بيانات شخصية).`],
        },
      ],
    },
    '/compress-video-without-upload': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لتجعل الفيديو صغيرًا بما يكفي لإرساله بالبريد أو في محادثة، خفّض معدل البت فيه، وإن كان طويلًا فصغّر أبعاد الصورة أيضًا إلى 720p أو 480p. فحجم الفيديو يساوي تقريبًا معدل البت مضروبًا في المدة، لذلك يصغر الملف حين يقصر الفيديو أو يقل معدل البت. تفعل أداة «ضغط الفيديو» ذلك داخل متصفحك: اكتب الحجم الذي تحتاج إليه بالميغابايت أو اختر جودة، ولا يغادر الفيديو جهازك.'],
          links: [{ text: 'ضغط الفيديو', path: '/compress-video' }],
        },
        {
          heading: 'ما الذي يجعل ملف الفيديو كبيرًا؟',
          paragraphs: ['معظم ملف الفيديو بيانات صورة، ويتبع حجمه قاعدة بسيطة: الحجم = معدل البت × المدة. ومعدل البت هو عدد البتات التي تستهلكها كل ثانية من الفيديو، ويُقاس بالميغابت في الثانية (Mbps) أو بالكيلوبت في الثانية (kbps). اقسم الناتج على 8 لتحصل على البايتات. وهذه الأمور تحدد إلى أي حد يكبر الملف:'],
          list: [
            'المدة: فيديو بضعف الطول وبمعدل البت نفسه يكون بضعف الحجم. وحذف الأجزاء التي لا يحتاج إليها أحد أرخص طرق التوفير.',
            'معدل البت: المفتاح الأهم. إن خفّضته إلى النصف صار الملف بنصف الحجم، وإن خفّضته كثيرًا ظهرت المربعات المشوّهة حين تتحرك الأشياء بسرعة.',
            'الأبعاد: كلما زادت البكسلات احتاجت الصورة إلى معدل بت أعلى لتبقى حادة. وفي 1280 × 720 نحو 44% من بكسلات 1920 × 1080، لذلك تبدو 720p نظيفة بمعدل بت أقل بكثير.',
            'معدل الإطارات: مع 60 إطارًا في الثانية يتوزع معدل البت نفسه على ضعف عدد الإطارات في 30، فينال كل إطار أقل. والضغط يُبقي معدل الإطارات كما هو.',
            'الصوت: صغير مقارنةً بالصورة. يبدو الكلام جيدًا بمعدل 96 kbps، أي نحو 0.7 ميغابايت في الدقيقة.',
          ],
        },
        {
          heading: 'مثال محسوب: دقيقة من فيديو الهاتف',
          paragraphs: ['خذ مقطعًا مفترضًا: 60 ثانية مسجلة بمعدل 16 Mbps مع الصوت. الأرقام أدناه حساب، لا قياس لأي هاتف.', 'الصور الثابتة تختلف: فيها تصغّر الأبعاد وتخفّض جودة JPG. ولذلك اقرأ كيف تقلل حجم ملف الصورة.'],
          list: [
            '16,000,000 بت × 60 ثانية ÷ 8 = 120,000,000 بايت، أي نحو 120 ميغابايت. وتعرضه الأداة 114.4 MB لأنها تحسب الميغابايت 1,048,576 بايت.',
            'لإرساله بالبريد تحت حد 25 ميغابايت، اكتب 20 حجمًا مطلوبًا. تستهدف الأداة أقل من ذلك بـ3%، وتحجز 96 kbps للصوت، وتعطي الصورة الباقي: نحو 2.6 Mbps، أي سدس الأصل.',
            'والحجم نفسه، 20 ميغابايت، لمقطع مدته 3 دقائق يترك للصورة نحو 0.8 Mbps. وهذا قليل على 1080p، فاختر معه 720p أو 480p.',
            'الحد الأدنى: لا تعطي الأداة الصورة أقل من 150 kbps. ومع الصوت يعني ذلك نحو 1.8 ميغابايت لكل دقيقة، فلا يمكن أن يقل فيديو مدته 10 دقائق عن نحو 17.6 ميغابايت. قصّه، أو شارك رابطًا بدلًا منه.',
          ],
          links: [{ text: 'كيف تقلل حجم ملف الصورة', path: '/reduce-photo-file-size' }],
        },
        {
          heading: 'حدود الحجم في الأماكن الشائعة لإرسال الفيديو',
          paragraphs: ['كل خدمة تضع حدها وقد تغيّره. الأرقام التالية من صفحة المساعدة الرسمية لكل خدمة (تحققنا منها في 24 نوفمبر 2026). اجعل الملف أقل من الحد بقليل.'],
          list: [
            'Gmail: الحد 25 ميغابايت للحسابات الشخصية، والمرفقات الأكبر تُستبدل برابط في Google Drive (مساعدة Gmail). أما حسابات العمل والجامعة فتتبع الحد الذي يضعه المسؤول عنها.',
            'Outlook.com: الحد 25 ميغابايت للملفات المرفقة، و2 غيغابايت للملف المشارك من OneDrive (حدود الإرسال في Outlook.com).',
            'WhatsApp: الحد الافتراضي للفيديو 100 ميغابايت بدقة 720p مع اتصال أسرع، و64 ميغابايت بدقة 480p مع اتصال أبطأ، ويصل حجم المستندات إلى 2 غيغابايت (مركز مساعدة WhatsApp).',
            'Discord: حد الملف الواحد في الحسابات المجانية أصغر منه في الحسابات المدفوعة؛ اقرأ الرقم الحالي في صفحة الأسئلة الشائعة عن المرفقات في Discord قبل الضغط.',
            'النماذج والبوابات: تذكر الصفحة حدها عادةً بجوار زر الرفع، فاعتمد ذلك الرقم.',
          ],
          links: [
            { text: 'مساعدة Gmail', path: 'https://support.google.com/mail/answer/6584' },
            { text: 'حدود الإرسال في Outlook.com', path: 'https://support.microsoft.com/en-us/outlook/sending-limits-in-outlook-com' },
            { text: 'مركز مساعدة WhatsApp', path: 'https://faq.whatsapp.com/453914586839706' },
            { text: 'صفحة الأسئلة الشائعة عن المرفقات', path: 'https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ' },
          ],
        },
        {
          heading: 'كيف تضغط الفيديو داخل متصفحك',
          paragraphs: ['افتح «ضغط الفيديو» واختر الفيديو أو أفلته على الصفحة: MP4 أو MOV أو WebM أو MKV أو M4V أو 3GP. ولا يُضغط إلا أول فيديو تختاره.'],
          list: [
            'للوصول إلى حد معيّن: اضغط «إلى حجم محدد» واكتب الحجم بالميغابايت؛ تبدأ الخانة بنصف الحجم الأصلي. تأتي النتيجة قريبة من هذا الحجم، بفارق بضعة في المئة غالبًا، فاكتب أقل من الحد قليلًا، مثل 20 لحد 25 ميغابايت. وإن كان الحجم أصغر من أن يبقى الفيديو صالحًا للمشاهدة، تخبرك الصفحة بذلك وتذكر أصغر حجم ممكن.',
            'للطريق الأبسط: اضغط «حسب الجودة» واختر «أصغر ملف» أو «ملف صغير» أو «متوازن» أو «أفضل صورة». والخيار المحدد في البداية «ملف صغير».',
            'لأكبر توفير: من «وتصغير أبعاد الصورة أيضًا» اختر 1080p أو 720p أو 480p. لا تظهر إلا الأبعاد الأصغر من الفيديو، ويُحفظ شكله، فيبقى فيديو الهاتف الطولي طوليًا.',
            'قبل البدء تعرض الصفحة الحجم الأصلي والحجم الجديد. وفي «حسب الجودة» يُقاس الحجم الجديد بضغط أول 3 ثوانٍ ثم مدّ النتيجة على المدة كلها، لذلك قد يخرج فيديو تزداد حركته لاحقًا أكبر من التقدير.',
            'اضغط زر «ضغط الفيديو» وشاهد النتيجة على الصفحة ثم نزّلها. ويمكنك إلغاء العملية الطويلة.',
          ],
          links: [{ text: 'ضغط الفيديو', path: '/compress-video' }],
        },
        {
          heading: 'الملف الذي تحصل عليه والمتصفحات التي تعمل',
          paragraphs: ['يحتفظ الفيديو المضغوط بصيغته إن كان MP4 أو MOV أو WebM أو MKV، أما فيديوهات M4V و3GP فتصبح MP4. ويحمل اسم الأصل مضافًا إليه -compressed، مثل clip-compressed.mp4.', 'يُصنع ملف MP4 أو MOV بفيديو H.264 وصوت AAC حين يستطيع المتصفح إنشاءهما (وإلا فبترميز آخر تسمح به الصيغة)، وهما الثنائي الذي تشغّله معظم الهواتف والحواسيب وتطبيقات المحادثة. أما WebM فيستخدم VP9 وOpus حين يستطيع المتصفح إنتاجهما. يقرأ Chrome وEdge الحديثان أكثر الصيغ وينشئانها، ويعمل Safari وFirefox مع معظم الفيديوهات. وإن لم يستطع متصفحك قراءة ترميز أو إنشاءه، تذكر الصفحة اسمه وتقترح ما تجرّبه بدلًا منه.', 'تستغرق الفيديوهات الطويلة أو التي بدقة 4K وقتًا وتحتاج إلى ذاكرة متاحة، لأن الملف الجديد يُبنى على جهازك. وبعد ذلك تقص أداة «قص الفيديو» البداية أو النهاية التي لا تحتاج إليها، وتجعله أداة «تغيير حجم الفيديو» مربعًا أو بمقاس القصة.'],
          links: [{ text: 'قص الفيديو', path: '/trim-video' }, { text: 'تغيير حجم الفيديو', path: '/resize-video' }],
        },
        {
          heading: 'هل أخفّض الجودة أم أبعاد الصورة؟',
          paragraphs: ['تصغير أبعاد الصورة يوفّر عادةً أكثر من خفض الجودة، ويبقى الفيديو حادًا على شاشة الهاتف. ففي «حسب الجودة» يتبع معدل البت الذي تستخدمه الأداة عدد البكسلات، لذلك تحمل 720p بيانات أقل بكثير من 1080p بالإعداد نفسه. أبقِ الأبعاد الكاملة للمقاطع القصيرة، أو حين سيُشاهد الفيديو على شاشة كبيرة.'],
        },
        {
          heading: 'لماذا تقول الأداة إن الفيديو لا يصغر إلى هذا الحد؟',
          paragraphs: ['لا تعطي الأداة الصورة أقل من 150 كيلوبت في الثانية، لأن الفيديو يصبح دون ذلك غير صالح للمشاهدة. ومع 96 kbps للصوت، يصبح هذا الحد الأدنى نحو 1.8 ميغابايت لكل دقيقة من الفيديو. فإن كان الحد المطلوب أقل من ذلك، فقصّ الفيديو أولًا، أو أرسل رابطًا إلى الملف بدلًا من الملف نفسه.'],
        },
        {
          heading: 'هل يُرفع الفيديو حين أضغطه؟',
          paragraphs: ['لا، يضغط متصفحك الفيديو بنفسه بأدوات ترميز الفيديو المدمجة فيه، ولا يُرسل شيء إلى أي خادم. ويمكنك أن تتحقق من ذلك بنفسك: افتح لوحة الشبكة في متصفحك واضغط فيديو وابحث عن أي رفع، فلن تجد شيئًا. ولا يتغير الملف الأصلي على جهازك أيضًا.'],
          links: [{ text: 'تتحقق من ذلك بنفسك', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر صيغة الفيديو ومدته والحجم الذي تحتاج إلى الوصول إليه (دون بيانات شخصية، ورجاءً لا ترفق الفيديو).`],
        },
      ],
    },
    '/file-too-large-for-chatgpt': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['إذا كان الملف أكبر مما يقبله ChatGPT أو Claude أو Gemini، فأرسل جزءًا أقل منه: احتفظ بالصفحات أو الأوراق أو الصفوف التي يحتاجها سؤالك فقط، وقسّم الباقي إلى أجزاء، والصق كل جزء نصًا مختصرًا. وتحقق أولًا من الحد الذي اصطدمت به، لأن حد حجم الرفع وحد الرموز في المحادثة يُعالَجان بطريقتين مختلفتين. يقيس عدّاد الرموز في OpenAnyDoc الملف، وتختصره أدوات التقسيم والتحويل، وكل ذلك داخل متصفحك دون رفعه.'],
          links: [{ text: 'عدّاد الرموز', path: '/token-counter' }],
        },
        {
          heading: 'حدّان مختلفان',
          paragraphs: [
            'قد ترفض محادثة الذكاء الاصطناعي الملف لسببين منفصلين. الأول حد الرفع: الحجم بالميغابايت أو عدد الملفات أو عدد الصفحات التي تقبلها الخدمة. والثاني نافذة السياق (Context window): مقدار النص، محسوبًا بالرموز، الذي يستطيع النموذج قراءته دفعة واحدة. وقد يجتاز الملف الحد الأول ثم يتجاوز الثاني.',
            'هذا ما تقوله صفحة المساعدة الرسمية لكل خدمة (راجعناها في 24 نوفمبر 2026):',
          ],
          list: [
            'ChatGPT: المستندات حتى 512 ميغابايت للملف، وملفات النصوص والمستندات بحد أقصى مليوني رمز للملف، وملفات CSV وجداول البيانات نحو 50 ميغابايت بحسب حجم كل صف. المصدر: صفحة مساعدة ChatGPT عن رفع الملفات.',
            'Claude: في المحادثة 500 ميغابايت للملف، وحتى 20 ملفًا، وملفات PDF حتى 1000 صفحة؛ وفي ملف PDF يزيد على 100 صفحة يقرأ النص وحده. وقد تنطبق حدود رموز إضافية بحسب طول النص المستخرج. المصدر: صفحة مساعدة Claude عن رفع الملفات.',
            'Gemini: حتى 10 ملفات في الطلب الواحد و100 ميغابايت للملف غير الفيديو. وتشرح صفحة مساعدته أنه بنافذة سياق من مليون رمز يستطيع قراءة ما يصل إلى 1500 صفحة نصية، وأن تجاوز النافذة قد يؤدي إلى إجابات تفوتها أجزاء من المحتوى. المصدر: مركز مساعدة Gemini.',
            'تتغير الحدود بحسب الخطة والنموذج، وتتغير صفحات المساعدة نفسها أيضًا؛ راجعها قبل أن تعتمد على رقم.',
          ],
          links: [
            { text: 'صفحة مساعدة ChatGPT عن رفع الملفات', path: 'https://help.openai.com/en/articles/8555545-file-uploads-faq' },
            { text: 'صفحة مساعدة Claude عن رفع الملفات', path: 'https://support.claude.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude-ai' },
            { text: 'مركز مساعدة Gemini', path: 'https://support.google.com/gemini/answer/14903178?hl=en' },
          ],
        },
        {
          heading: 'ملف من 1 ميغابايت قد يبقى أطول من اللازم',
          paragraphs: [
            'الميغابايت لا تخبرك بالكثير عن الرموز. أنشأنا ملف CSV تجريبيًا من 20,000 طلب في 7 أعمدة (رقم الطلب، والتاريخ، والمنطقة، ورمز المنتج، والكمية، وسعر الوحدة، والإجمالي)، وعددنا رموزه بالعدّاد نفسه الذي يستخدمه الموقع:',
            'فالملف أصغر بكثير من كل حدود الرفع أعلاه، ومع ذلك يملأ نصه وحده أكثر من نصف نافذة سياق من مليون رمز قبل أي سؤال أو إجابة. والنماذج الأخرى تعدّ الرموز بطريقتها، فهذه الأرقام تقديرية بالنسبة لها. ويشرح دليل كم رمزًا يستهلك ملف PDF لماذا تغيّر الجداول والعربية والنموذج العدد.',
          ],
          list: [
            'الملف كاملًا: 1.02 ميغابايت و590,807 رموز، أي نحو 29.5 رمزًا لكل صف.',
            'أول 1,000 صف: 29,541 رمزًا. أول 5,000 صف: 147,670 رمزًا.',
            'الصفوف الألف نفسها بصيغة JSON مزاحة: 70,529 رمزًا، أي أكثر من ضعف CSV.',
            'الصفوف الألف نفسها جدولَ Markdown: 34,559 رمزًا، وبصيغة TOON: 30,545 رمزًا.',
          ],
          links: [{ text: 'كم رمزًا يستهلك ملف PDF', path: '/how-many-tokens-is-my-pdf' }],
        },
        {
          heading: 'قِس الملف أولًا',
          paragraphs: ['يقرأ عدّاد الرموز الملف على جهازك، ويعرض عدد الرموز والكلمات والأحرف للنص الذي ستلصقه:'],
          list: [
            'افتح عدّاد الرموز وأسقط الملف، أو الصق نصًا. وهو يقرأ ملفات PDF ووورد وبوربوينت واكسل وCSV وJSON وTXT وMarkdown.',
            'قارن العدد بحد المحادثة التي تستخدمها، واترك مكانًا لسؤالك وللإجابة.',
            'احذف من مربع النص ما لا تحتاجه، فيتحدّث العدد مع كل تعديل.',
            'إن أعطى ملف PDF صفر رموز، فهو ممسوح ضوئيًا لا نص فيه. شغّل التعرف الضوئي على النص أولًا.',
          ],
          links: [{ text: 'التعرف الضوئي على النص', path: '/ocr-pdf' }],
        },
        {
          heading: 'احتفظ بما يحتاجه السؤال فقط',
          paragraphs: ['أضمن حل أن ترسل أقل. اختر الأداة بحسب نوع ملفك:'],
          list: [
            'PDF: تحفظ أداة استخراج صفحات PDF الصفحات التي تنقر عليها فقط في ملف PDF جديد، مثل الفصل الواحد أو الجداول الثلاثة التي تسأل عنها.',
            'ملف PDF طويل تحتاجه كله: تقسّمه أداة تقسيم PDF بنطاقات صفحات، أو كل بضع صفحات، أو ملفًا لكل صفحة.',
            'وورد: تقسّم أداة تقسيم ملف Word ملف ‎.docx عند عناوين «عنوان 1» أو «عنوان 2» أو عند فواصل الصفحات، فيكون كل جزء قسمًا كاملًا.',
            'اكسل: تصنع أداة تقسيم ملف Excel ملفًا لكل ورقة، أو ملفًا لكل عدد من الصفوف تحدده، أو ملفًا لكل قيمة في عمود، مثل ملف لكل منطقة.',
            'CSV: تقسّم أداة تقسيم CSV الملف بعدد صفوف لكل ملف أو بحجم بالميغابايت لكل ملف، وفي كل جزء صف العناوين. صفِّ الصفوف أو أخفِ الأعمدة أولًا، فلا تحمل الأجزاء إلا ما بقي.',
          ],
          links: [{ text: 'استخراج صفحات PDF', path: '/extract-pdf-pages' }, { text: 'تقسيم PDF', path: '/split-pdf' }, { text: 'تقسيم ملف Word', path: '/split-word' }, { text: 'تقسيم ملف Excel', path: '/split-excel' }, { text: 'تقسيم CSV', path: '/split-csv' }],
        },
        {
          heading: 'اجعل النص أصغر',
          paragraphs: ['المحتوى نفسه قد يكلّف أعدادًا مختلفة جدًا من الرموز بحسب صيغته، واللصق نصًا يريك بالضبط ما ستتلقاه المحادثة:'],
          list: [
            'PDF: تحوّل أداة تحويل PDF إلى Markdown الصفحات إلى نص تُعلَّم فيه العناوين والقوائم والجداول، فتقرأ ما ستقرؤه المحادثة وتختصره. ويتناول دليل إعطاء ChatGPT ملف PDF دون فقدان الجداول أمر الجداول.',
            'جداول البيانات: الصق CSV لا JSON؛ ففي التجربة أعلاه أخذ أقل من نصف الرموز. ويقارن دليل إعطاء محادثة الذكاء الاصطناعي جدول بيانات بين CSV وجداول Markdown.',
            'سجلات JSON: تكتب أداة تحويل JSON إلى TOON قائمة السجلات نفسها بأسماء الحقول مرة واحدة في أعلاها، وتعرض عدد الرموز قبل التحويل وبعده. والتوفير قليل في البيانات المتداخلة بعمق.',
            'الأعمدة التي لا يسأل عنها أحد تكلّف رموزًا في كل صف؛ احذفها قبل اللصق.',
          ],
          links: [
            { text: 'تحويل PDF إلى Markdown', path: '/pdf-to-markdown' },
            { text: 'إعطاء ChatGPT ملف PDF دون فقدان الجداول', path: '/pdf-to-ai-chat-with-tables' },
            { text: 'إعطاء محادثة الذكاء الاصطناعي جدول بيانات', path: '/spreadsheet-to-ai-chat' },
            { text: 'تحويل JSON إلى TOON', path: '/json-to-toon' },
          ],
        },
        {
          heading: 'الصقه على أجزاء',
          paragraphs: [
            'حين تحتاج المحتوى كله، أرسله على أجزاء في محادثة واحدة. ابدأ برسالة قصيرة مثل: «سأرسل تقريرًا في 4 أجزاء. ردّ بكلمة تم فقط حتى أرسل الجزء 4، ثم أجب عن سؤالي». وضع عنوانًا لكل جزء («الجزء 2 من 4: الصفحات 11 إلى 20»)، واجعل كل جزء أصغر من الحد بهامش واضح، واطرح سؤالك بعد الجزء الأخير.',
            'كل الأجزاء تبقى في نافذة السياق نفسها، فالتقسيم لا يزيد المساحة: إن كان المجموع كبيرًا جدًا، فقد تفوت المحادثة تفاصيل من الأجزاء الأولى. وللسؤال عن قسم واحد، تنجح محادثة جديدة فيها ذلك القسم وحده أكثر. وقبل اللصق، تستبدل أداة إخفاء البيانات الأسماء وعناوين البريد وغيرها من البيانات الشخصية في ملف CSV أو JSON أو اكسل أو ملف نصي على جهازك.',
          ],
          links: [{ text: 'إخفاء البيانات', path: '/mask-data' }],
        },
        {
          heading: 'لماذا تجاهلت المحادثة جزءًا من ملفي؟',
          paragraphs: ['الأرجح أن المحادثة قرأت أكثر مما تتسع له نافذة السياق. فحين يكون الملف أطول من النافذة، قد تجيب الخدمة من جزء منه فقط أو تفوتها تفاصيل موزعة فيه، وصفحة مساعدة Gemini تقول ذلك صراحة. عُدّ النص أولًا، وأرسل الصفحات أو الصفوف التي يحتاجها السؤال فقط، ثم اسأل من جديد في محادثة جديدة.'],
        },
        {
          heading: 'كم صفًا من جدول البيانات أستطيع لصقه دفعة واحدة؟',
          paragraphs: ['يعتمد ذلك على عدد الأعمدة وطول القيم، فعُدّ عينة بدل أن تخمّن. في تجربتنا، أخذ جدول طلبات من 7 أعمدة نحو 29.5 رمزًا لكل صف. اقسم المساحة المتاحة لك على عدد رموز الصف في ملفك، ثم اضبط تقسيم CSV أو تقسيم ملف Excel على هذا العدد من الصفوف لكل ملف.'],
        },
        {
          heading: 'هل يرفع العدّ أو التقسيم ملفي إلى أي مكان؟',
          paragraphs: ['لا، يُقرأ الملف ويُقسَّم داخل متصفحك، ولا يُرسل شيء إلى خادم أو إلى أي خدمة ذكاء اصطناعي. والشيء الوحيد الذي يصل إلى المحادثة هو النص الذي تلصقه بنفسك. ويمكنك أن تتحقق بنفسك من أن شيئًا لا يُرفع بمراقبة لوحة الشبكة أثناء عمل الأداة.'],
          links: [{ text: 'تتحقق بنفسك من أن شيئًا لا يُرفع', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} واذكر نوع الملف والمحادثة التي تستخدمها (دون بيانات شخصية).`],
        },
      ],
    },
    '/best-free-csv-viewers': {
      published: '2026-11-24',
      updated: '2026-11-25',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['أفضل عارض CSV مجاني هو الذي يناسب ملفك: عارض في المتصفح للملفات الخاصة أو الكبيرة جدًا، وتطبيق جداول بيانات حين تحتاج إلى الصيغ، ومحرر نصوص لرؤية النص الخام. يفتح عارض CSV في OpenAnyDoc الملف جدولًا تبحث فيه وترتّبه وتعدّله داخل متصفحك، ولا يُرفع الملف أبدًا. وفيما يلي خمسة خيارات مجانية أخرى وما يقوله موقع كلٍّ منها عنها.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }],
        },
        {
          heading: 'كيف اخترنا',
          paragraphs: ['كان على كل أداة هنا أن تجتاز ثلاثة شروط. القائمة ليست مرتبة حسب الأفضلية، ويأتي OpenAnyDoc أولًا لأنه موقعنا فقط، فاحكم عليه بالحقائق نفسها التي تحكم بها على غيره:'],
          list: [
            'مجانية للعرض بلا حد زمني، كما يقول موقعها.',
            'تفتح ملف .csv على الحاسوب، جدولًا أو نصًا عاديًا.',
            'نقاط قوة كل تطبيق أو خدمة وحدودها مأخوذة من صفحاتها، وهي مرتبطة أدناه وروجعت في 24 نوفمبر 2026 (وتطبيقات CSV لسطح المكتب مرة أخرى في 25 نوفمبر 2026). وحين لا تذكر الصفحة شيئًا نقول ذلك ولا نخمّن. أما محررات النصوص التي تأتي مع Windows وmacOS فنصفها بما تراه حين يُفتح فيها ملف CSV.',
          ],
        },
        {
          heading: 'عارض CSV في OpenAnyDoc، داخل متصفحك',
          paragraphs: [
            'أفلت ملف .csv أو .tsv أو .tab على عارض CSV. يكتشف الفاصل (فاصلة أو فاصلة منقوطة أو Tab أو خط عمودي) والترميز (UTF-8 أو UTF-16 أو ترميز Windows-1256 القديم للعربية أو Windows-1252 للحروف الأوروبية الغربية)، ويعرض الصفوف جدولًا تبحث فيه وتصفّيه وترتّبه وتعدّله، مع التراجع. تُقرأ كل خلية نصًا كما كُتبت، فتبقى الأصفار في البداية وأرقام المعرّفات الطويلة كما هي. ويمكنك أيضًا تشغيل استعلامات SQL على الجدول وتنزيله ملف CSV أو مصنف Excel.',
            'الحدود: ليس للعارض حد صفوف خاص به، لكن يجب أن يتسع الملف في ذاكرة جهازك، ويظهر تحذير أولًا للملف الذي يتجاوز 50 ميغابايت. ويعرض القيم فقط، لأن ملف CSV لا يحمل صيغًا ولا تنسيقًا. ولملفات التصدير الكبيرة جدًا، يفتح عارض ملفات CSV الكبيرة العارض نفسه مع تلميح لاقتطاع ما تحتاجه من الملف.',
          ],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }, { text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'تطبيقات جداول بيانات مجانية (رُوجعت في 24 نوفمبر 2026)',
          paragraphs: ['تطبيقان مجانيان يفتحان ملف CSV ورقةَ عمل:'],
          list: [
            'يعمل Google Sheets في متصفح الويب. تقول صفحة المنتج «Anyone with a Google Account can create in Sheets»، أي يستطيع كل من لديه حساب Google الإنشاء فيه. ولفتح ملف CSV اختر «ملف» ثم «استيراد» داخل جدول بيانات؛ وتذكر صفحة مساعدة الاستيراد صيغ .csv و.tsv و.txt بين الصيغ المدعومة، ويمكنها اكتشاف الفاصل تلقائيًا. وتسمح صفحة Google عن الملفات التي يمكن تخزينها في Google Drive بما يصل إلى 20 مليون خلية أو 100 ميغابايت للجداول المنشأة في Google Sheets أو المحوّلة إليه.',
            'LibreOffice Calc جزء من LibreOffice، الذي يصفه موقعه بأنه «free and open source software»، أي برنامج مجاني ومفتوح المصدر. وعند فتح ملف CSV تظهر أولًا نافذة استيراد النص، تختار فيها مجموعة المحارف والفاصل ونوع كل عمود، وهذا يساعد مع النص العربي ومع الملفات التي كانت ستنزل في عمود واحد.',
          ],
          links: [
            { text: 'صفحة المنتج', path: 'https://workspace.google.com/products/sheets/' },
            { text: 'صفحة مساعدة الاستيراد', path: 'https://support.google.com/docs/answer/40608' },
            { text: 'الملفات التي يمكن تخزينها في Google Drive', path: 'https://support.google.com/drive/answer/37603' },
            { text: 'يصفه موقعه', path: 'https://www.libreoffice.org/discover/libreoffice/' },
            { text: 'نافذة استيراد النص', path: 'https://help.libreoffice.org/latest/en-US/text/shared/00/00000208.html' },
          ],
        },
        {
          heading: 'تطبيقات CSV لسطح المكتب (رُوجعت في 25 نوفمبر 2026)',
          paragraphs: ['تطبيقان لسطح المكتب صُنعا لملفات CSV لا لجداول البيانات:'],
          list: [
            'يعمل Modern CSV على Windows وmacOS وLinux. تقول صفحة الشراء «You may use the Free version as long as you wish»، أي يمكنك استخدام النسخة المجانية ما شئت، وتقول صفحته الرئيسية إنه مصمم لملفات تُثقل معظم تطبيقات جداول البيانات. وتشمل النسخة المجانية التصفية الأساسية وإخفاء الصفوف أو الأعمدة، وتخلو من استعلامات SQL والتصفية بـ SQL والجداول المحورية والمخططات ودمج الملفات أو تقسيمها؛ فهذه مع الترخيص المدفوع (49 دولارًا أمريكيًا سنويًا، أو 69 دولارًا مرة واحدة).',
            'يعمل Tad على macOS وLinux وWindows. ويصفه موقعه بأنه تطبيق مجاني لسطح المكتب لعرض البيانات الجدولية وتحليلها، و«a fast viewer for CSV and Parquet files»، أي عارض سريع لملفات CSV وParquet، يدعم الملفات الكبيرة.',
          ],
          links: [
            { text: 'صفحة الشراء', path: 'https://www.moderncsv.com/buy/' },
            { text: 'صفحته الرئيسية', path: 'https://www.moderncsv.com/' },
            { text: 'ويصفه موقعه', path: 'https://www.tadviewer.com/' },
          ],
        },
        {
          heading: 'محرر نصوص موجود عندك',
          paragraphs: ['يعرض Notepad على Windows وTextEdit على Mac الملف الخام: صف في كل سطر، والفواصل ظاهرة. وهي أسرع طريقة لمعرفة الفاصل الذي يستخدمه الملف، وهل السطر الأول يحمل العناوين، وهل القيم محاطة بعلامات اقتباس. لكن قراءة جدول عريض بهذه الطريقة صعبة، وحذف فاصل واحد يزيح كل قيمة بعده إلى العمود الخطأ، فعدّل بحذر.'],
        },
        {
          heading: 'أين تقدّم الأدوات الأخرى أكثر',
          paragraphs: ['إنصافًا في المقارنة: يتيح Google Sheets لعدة أشخاص تعديل الجدول نفسه في الوقت نفسه، وفيه وفي LibreOffice Calc صيغ وجداول محورية ومخططات، بحسب صفحة Google Sheets وصفحتَي مساعدة LibreOffice عن ميزات Calc وعن الجداول المحورية (تحققنا منها في 24 نوفمبر 2026). ويضيف الترخيص المدفوع في Modern CSV الجداول المحورية والمخططات وSQL إلى تطبيق لسطح المكتب، ويفتح Tad أيضًا بعض ملفات قواعد البيانات. أما OpenAnyDoc فيعدّل القيم في ملف CSV ويحفظ ملفات CSV أو Excel، لكن لا صيغ فيه ولا نسخة حية يعدّلها فريق معًا.'],
          links: [{ text: 'صفحة Google Sheets', path: 'https://workspace.google.com/products/sheets/' }, { text: 'ميزات Calc', path: 'https://help.libreoffice.org/latest/en-US/text/scalc/main0503.html' }, { text: 'عن الجداول المحورية', path: 'https://help.libreoffice.org/latest/en-US/text/scalc/guide/datapilot.html' }],
        },
        {
          heading: 'أي عارض CSV مجاني يفتح أكبر الملفات؟',
          paragraphs: ['لا جواب ثابتًا لأي برنامج، لأن الحد الحقيقي عادةً هو ذاكرة حاسوبك. يتوقف Google Sheets عند 20 مليون خلية للجدول الواحد، وتتوقف تطبيقات جداول البيانات عند حد للصفوف، بينما ليس لـ OpenAnyDoc حد صفوف خاص به، ويقول Modern CSV وTad إنهما يتعاملان مع الملفات الكبيرة. جرّب ملفك، ويشرح دليل ملف CSV أكبر من أن يفتحه Excel الخيارات الأخرى.'],
          links: [{ text: 'ملف CSV أكبر من أن يفتحه Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'هل أستطيع فتح ملف CSV دون رفعه إلى أي مكان؟',
          paragraphs: ['نعم، كل برنامج يقرأ الملف على جهازك يفعل ذلك: محرر نصوص، أو LibreOffice Calc، أو تطبيق CSV لسطح المكتب، أو OpenAnyDoc في متصفحك. أما Google Sheets فيعمل مع جداول محفوظة في Google Drive. وللتحقق من أي موقع بنفسك راقب لوحة الشبكة في المتصفح أثناء فتح الملف، كما يشرح دليل كيف تتحقق من أن موقعًا لا يرفع ملفك.'],
          links: [{ text: 'كيف تتحقق من أن موقعًا لا يرفع ملفك', path: '/check-file-upload' }],
        },
        {
          heading: 'كيف أفتح ملف CSV على هاتفي؟',
          paragraphs: ['استخدم متصفح الهاتف: في عارض CSV على OpenAnyDoc اضغط «اختر ملفًا» واختر ملف CSV من «الملفات» أو التنزيلات، فيُفتح جدولًا بتخطيط مخصص للهاتف والأدوات في قائمة. لا يُثبَّت شيء ويبقى الملف على الهاتف. وتجد طرقًا أخرى على كل الأجهزة في دليل كيف تفتح ملف CSV من دون Excel.'],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }, { text: 'كيف تفتح ملف CSV من دون Excel', path: '/open-csv-without-excel' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وأخبرنا بعارض CSV الذي تريد أن نراجعه بعد ذلك (دون بيانات شخصية).`],
        },
      ],
    },
    '/best-free-json-formatters': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['منسّق JSON الذي يعمل على حاسوبك يُبقي بياناتك عليه: عارض JSON المدمج في Firefox، أو محرر برمجي مثل VS Code، أو أداة jq في سطر الأوامر. ومن بين المواقع، يقول JSONLint وJSON Crack في صفحاتهما إن JSON يُعالَج في متصفحك، أما منسّق JSON في OpenAnyDoc فينسّقه داخل متصفحك وليست فيه ميزة حفظ أو مشاركة أصلًا. وفيما يلي ما تقوله صفحات كل أداة، بكلماتها حيث يهم ذلك.'],
          links: [{ text: 'منسّق JSON', path: '/json-formatter' }],
        },
        {
          heading: 'كيف اخترنا',
          paragraphs: ['كل أداة هنا مجانية وتنسّق JSON. ننقل فقط ما تقوله صفحات كل أداة عن المكان الذي يذهب إليه JSON الملصوق، وقد رُوجعت في 24 نوفمبر 2026، ونذكر ذلك حين تسكت الصفحة. القائمة ليست مرتبة حسب الأفضلية؛ وOpenAnyDoc موقعنا، فاحكم عليه بالمعيار نفسه.'],
        },
        {
          heading: 'منسّق JSON في OpenAnyDoc',
          paragraphs: [
            'الصق JSON أو افتح ملف .json حتى 10 ميغابايت، ثم اضغط «تنسيق» لترتيبه بمسافة واحدة أو 2 أو 3 أو 4 أو 8 مسافات أو Tab، أو «تصغير» لوضعه في سطر واحد. ويرتّب «ترتيب المفاتيح» كل كائن من A إلى Z، وتبقى الأعداد الصحيحة الأطول مما تحتمله JavaScript كما هي رقمًا رقمًا. وإن كان JSON غير صالح، يعرض مدقق JSON سطر الخطأ وعموده، ويعالج «إصلاح» الفواصل الزائدة والتعليقات وعلامات الاقتباس المفردة.',
            'يبقى JSON في ذاكرة الصفحة حتى تنزّل نسخة. لا يوجد زر حفظ على الإنترنت ولا رابط مشاركة ولا حساب ولا أدوات تحليل للزيارات، ولا تسمح سياسة أمان الصفحة إلا بالاتصال بموقعها نفسه. والاستثناء الوحيد «فتح من عنوان URL»، الذي يجلب عنوان https الذي تكتبه مباشرة من متصفحك. وبعد تحميل الصفحة تعمل دون اتصال.',
          ],
          links: [{ text: 'مدقق JSON', path: '/json-validator' }],
        },
        {
          heading: 'مدمجة في أدوات قد تكون عندك (رُوجعت في 24 نوفمبر 2026)',
          paragraphs: ['هذه تنسّق JSON على حاسوبك:'],
          list: [
            'Firefox: تقول وثائقه «Firefox includes a JSON viewer»، أي إن فيه عارض JSON مدمجًا. افتح ملف JSON أو عنوانه في المتصفح فيعرضه شجرة قابلة للطي مع مربع تصفية، والنص الخام، ونسخة منسّقة. ويقرأ أيضًا JSON Lines، لكنه لا ينسّقها.',
            'VS Code: مجاني «for private or commercial use»، أي للاستخدام الشخصي والتجاري، كما تقول أسئلته الشائعة. ينسّق أمر Format Document ملف JSON (Shift+Alt+F على Windows)، ويتحقق المحرر منه مقابل JSON Schema أثناء الكتابة. وتقول الأسئلة الشائعة نفسها إنه يرسل بيانات استخدام إلى Microsoft، ويوقفها إعداد Telemetry Level، وتقول وثائق JSON فيه إنه قد ينزّل المخططات من عناوين http وhttps.',
            'jq: «a lightweight and flexible command-line JSON processor»، أي أداة سطر أوامر خفيفة لمعالجة JSON، على Linux وmacOS وWindows. ويقول دليلها «By default, jq pretty-prints JSON output»، أي إنها تنسّق المخرجات افتراضيًا، فالأمر jq . file.json يطبع الملف منسّقًا؛ ويحدد --indent حتى 7 مسافات، ويستخدم --tab علامات Tab، ويضع -c كل كائن في سطر واحد.',
          ],
          links: [
            { text: 'تقول وثائقه', path: 'https://firefox-source-docs.mozilla.org/devtools-user/json_viewer/index.html' },
            { text: 'أسئلته الشائعة', path: 'https://code.visualstudio.com/docs/supporting/faq' },
            { text: 'وثائق JSON فيه', path: 'https://code.visualstudio.com/docs/languages/json' },
            { text: 'أداة سطر أوامر خفيفة لمعالجة JSON', path: 'https://jqlang.org/' },
            { text: 'دليلها', path: 'https://jqlang.org/manual/' },
          ],
        },
        {
          heading: 'مواقع تنسيق JSON (رُوجعت في 24 نوفمبر 2026)',
          paragraphs: ['ما تقوله المواقع نفسها:'],
          list: [
            'JSONLint، أداة للتحقق من JSON وإعادة تنسيقه: تقول سياسة خصوصية JSONLint «All JSON validation happens client-side in your browser»، أي إن التحقق كله يجري في متصفحك، و«Your JSON data is never sent to our servers for processing»، أي لا تُرسَل بياناتك إلى خوادمه للمعالجة. وتذكر السياسة نفسها Google Analytics وشريكًا إعلانيًا قد يضع ملفات تعريف الارتباط. وتقبل صفحة JSONLint الرئيسية أيضًا رابطًا و«will scrape it for JSON»، أي تستخرج منه JSON، دون أن تذكر أين يجري هذا الجلب.',
            'JSON Crack، الذي يرسم JSON مخططًا: تقول صفحة JSON Crack الرئيسية «Your data is never stored on our servers. Everything happens on your device.»، أي لا تُخزَّن بياناتك على خوادمه ويجري كل شيء على جهازك. ويدعم نحو 300 كيلوبايت من البيانات، حسب البيانات وجهازك، وتذكر سياسة خصوصية JSON Crack أداة Google Analytics.',
            'لدى jsonformatter.org وCode Beautify ميزة حفظ على الإنترنت، وتقول صفحاتهما إن JSON المحفوظ قد يصبح عامًا ما لم تسجّل الدخول. وتجد ما يقوله كلٌّ منهما في دليلنا عن بديل jsonformatter.org.',
          ],
          links: [
            { text: 'سياسة خصوصية JSONLint', path: 'https://jsonlint.com/privacy' },
            { text: 'صفحة JSONLint الرئيسية', path: 'https://jsonlint.com/' },
            { text: 'صفحة JSON Crack الرئيسية', path: 'https://jsoncrack.com/' },
            { text: 'سياسة خصوصية JSON Crack', path: 'https://jsoncrack.com/legal/privacy' },
            { text: 'دليلنا عن بديل jsonformatter.org', path: '/jsonformatter-alternative' },
          ],
        },
        {
          heading: 'مقارنة سريعة',
          paragraphs: ['أهم الفروق، من الصفحات أعلاه:'],
          list: [
            'أين يُنسَّق JSON: على حاسوبك في Firefox وVS Code وjq؛ وفي متصفحك في JSONLint وJSON Crack وOpenAnyDoc، كما تقول صفحاتها.',
            'روابط الحفظ على الإنترنت: يقدّمها jsonformatter.org وCode Beautify؛ ولا يقدّمها OpenAnyDoc.',
            'أدوات التحليل المذكورة في سياسة الخصوصية: Google Analytics في JSONLint وJSON Crack؛ ولا تحليل في OpenAnyDoc.',
            'الحجم: نحو 300 كيلوبايت في JSON Crack؛ و10 ميغابايت في OpenAnyDoc؛ ولا تذكر الصفحات الأخرى التي راجعناها حدًا.',
            'دون اتصال: Firefox وVS Code وjq دائمًا؛ وOpenAnyDoc بعد تحميل الصفحة.',
          ],
        },
        {
          heading: 'أين تقدّم الأدوات الأخرى أكثر',
          paragraphs: ['إنصافًا في المقارنة: تصفّي jq ملفات JSON وتعيد تشكيلها وتدمجها داخل السكربتات وسلاسل الأوامر، وهذا ما لا تفعله لك صفحة ويب. ويتحقق VS Code من JSON مقابل مخطط أثناء التعديل ويتعامل معه بجانب الكود. ويعرض Firefox ترويسات الطلب والرد لـ JSON القادم من خادم. أما منسّق OpenAnyDoc فيتوقف عند 10 ميغابايت ويتحقق من الصياغة فقط؛ وللمخططات صفحة JSON Schema مستقلة، ويرسم مخطط JSON الملف صناديق متصلة.'],
          links: [{ text: 'صفحة JSON Schema', path: '/json-schema' }, { text: 'مخطط JSON', path: '/json-graph' }],
        },
        {
          heading: 'هل لصق JSON فيه مفاتيح API في منسّق على الإنترنت آمن؟',
          paragraphs: ['يكون آمنًا فقط حين لا يغادر JSON جهازك، فتحقق مما يقوله الموقع ومما يفعله. المنسّق الذي يعمل في متصفحك يُبقي المفاتيح على جهازك، أما الذي فيه حفظ على الإنترنت أو روابط مشاركة فقد يجعلها عامة بالخطأ. والأفضل أن تحذف الأسرار قبل اللصق، وأن تستبدل أي مفتاح لصقته في مكان لا تثق به.'],
        },
        {
          heading: 'كيف أتحقق من أن منسّق JSON لا يرفع بياناتي؟',
          paragraphs: ['افتح أدوات المطوّر في متصفحك وانتقل إلى تبويب Network، ثم الصق JSON ونسّقه: أي طلب يحمل نصك يظهر هناك. والصفحة التي تُبقي البيانات محلية لا ترسل طلبًا كهذا. ويشرح دليل كيف تتحقق من أن موقعًا لا يرفع ملفك ذلك خطوة خطوة، في Chrome وEdge وFirefox وSafari.'],
          links: [{ text: 'كيف تتحقق من أن موقعًا لا يرفع ملفك', path: '/check-file-upload' }],
        },
        {
          heading: 'ما أسرع طريقة لتنسيق JSON دون موقع؟',
          paragraphs: ['إن كان عندك Firefox فافتح ملف .json فيه وانتقل إلى العرض المنسّق. وفي الطرفية يطبع الأمر jq . file.json الملف منسّقًا، وفي VS Code يفعل Format Document الشيء نفسه. والثلاثة تنسّق على حاسوبك، فلا تلصق JSON في صفحة ويب أبدًا.'],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} وصف ما تحتاجه (دون بيانات شخصية، ولا تلصق رمز وصول حقيقيًا أبدًا).`],
        },
      ],
    },
    '/openanydoc-vs-google-sheets-large-files': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: ['لفتح ملف CSV كبير جدًا والبحث فيه، أقل الأدوات قيودًا هو عارض يقرأ الملف على جهازك: ليس لعارض ملفات CSV الكبيرة في OpenAnyDoc حد صفوف خاص به، والحد الوحيد ذاكرة جهازك، ولا يُرفع شيء. أما Google Sheets فيتسع لـ 20 مليون خلية في الجدول الواحد، وتتوقف ورقة Excel على الحاسوب عند 1,048,576 صفًا، ويفتح Excel للويب مصنفات حتى 100 ميغابايت في المتصفح حسب اشتراكك في Microsoft 365. وتبقى جداول البيانات الخيار الأفضل حين تحتاج إلى الصيغ أو المخططات أو فريق يعدّل معًا.'],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'الحدود الرسمية (رُوجعت في 24 نوفمبر 2026)',
          paragraphs: ['من صفحات كل منتج:'],
          list: [
            'Google Sheets: «Up to 20 million cells or 100MB for spreadsheets that are created in or converted to Google Sheets»، أي حتى 20 مليون خلية أو 100 ميغابايت للجداول المنشأة فيه أو المحوّلة إليه، من صفحة Google عن الملفات التي يمكن تخزينها في Google Drive.',
            'Excel على الحاسوب: ورقة العمل 1,048,576 صفًا في 16,384 عمودًا، وتتسع الخلية لـ 32,767 حرفًا، من صفحة مواصفات Excel وحدوده. ولا حد صارمًا لحجم ملف نموذج البيانات في Excel بنظام 64 بت؛ أما Excel بنظام 32 بت فيتقاسم 2 غيغابايت من مساحة العناوين مع المصنف والوظائف الإضافية.',
            'Excel للويب: حد المتصفح من 0 إلى 100 ميغابايت للمصنفات في مكتبة SharePoint Online، ومن 0 إلى 10 ميغابايت للمصنف المرفق برسالة في Outlook Web App، وتقول Microsoft إنه يعتمد على اشتراكك في Microsoft 365، من صفحة حدود حجم المصنفات في SharePoint.',
            
            'OpenAnyDoc: لا حد صفوف خاصًا به؛ يجب أن يتسع الملف في ذاكرة جهازك، ويظهر تحذير قبل فتح الملف الذي يتجاوز 50 ميغابايت.',
          ],
          links: [
            { text: 'الملفات التي يمكن تخزينها في Google Drive', path: 'https://support.google.com/drive/answer/37603' },
            { text: 'مواصفات Excel وحدوده', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' },
            { text: 'حدود حجم المصنفات في SharePoint', path: 'https://support.microsoft.com/en-us/office/file-size-limits-for-workbooks-in-sharepoint-9e5bc6f8-018f-415a-b890-5452687b325e' },
          ],
        },
        {
          heading: 'ما يفعله OpenAnyDoc بملف CSV كبير',
          paragraphs: [
            'أفلت الملف على عارض ملفات CSV الكبيرة فيقرؤه متصفحك على جهازك؛ ولا يُرسَل شيء إلى خادم. تُقرأ الصفوف في الخلفية وتصل على دفعات من 10,000 صف، ولا يُرسم إلا الصفوف الظاهرة على الشاشة وبضعة صفوف حولها، فيبقى التمرير سلسًا. وفي اختبار OpenAnyDoc نفسه فُتح ملف من 120,000 صف و8 أعمدة في نحو نصف ثانية على حاسوب محمول.',
            'وبعد فتح الملف يمكنك البحث في كل الأعمدة والتصفية والترتيب حسب عدة أعمدة ورؤية المجاميع حسب عمود وتشغيل استعلامات SQL على الجدول. وللحصول على ملف يتسع له برنامج جداول البيانات، أبقِ الصفوف المصفّاة فقط من «خيارات التنزيل» في قائمة «المزيد»، أو قسّم الملف أجزاءً بأداة تقسيم CSV، ويبدأ كل جزء بصف العناوين.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }, { text: 'تقسيم CSV', path: '/split-csv' }],
        },
        {
          heading: 'محررات CSV لسطح المكتب (رُوجعت في 24 نوفمبر 2026)',
          paragraphs: ['التطبيقات المصنوعة لملفات CSV على سطح المكتب تتجنب هي أيضًا حدود شبكة جداول البيانات. تقول صفحة Modern CSV الرئيسية إنه «handles files beyond Excel\'s million-row limit»، أي يتعامل مع ملفات تتجاوز حد المليون صف في Excel، وإنه وفق اختباراته يحمّل الملف أسرع من Excel بـ 28 مرة؛ ويمكن استخدام نسخته المجانية ما شئت. ويصفه موقع Tad بأنه عارض مجاني لسطح المكتب لملفات CSV وParquet «supports large files»، أي يدعم الملفات الكبيرة. ولا تذكر أيٌّ من الصفحتين حدًا أقصى لحجم الملف. وتجد برامج مجانية أخرى في دليل كيف تفتح ملف CSV من دون Excel.'],
          links: [
            { text: 'صفحة Modern CSV الرئيسية', path: 'https://www.moderncsv.com/' },
            { text: 'موقع Tad', path: 'https://www.tadviewer.com/' },
            { text: 'كيف تفتح ملف CSV من دون Excel', path: '/open-csv-without-excel' },
          ],
        },
        {
          heading: 'اختبار تجريه بنفسك',
          paragraphs: ['أنشئ ملف CSV ببيانات مصطنعة وافتحه في كل برنامج. إن كان Node.js مثبتًا على macOS أو Linux، فهذا السطر الواحد يكتب الملف big.csv: صف عناوين و2,000,000 صف من بيانات مختلَقة في 10 أعمدة.'],
          list: [
            'node -e "const f=require(\'fs\').createWriteStream(\'big.csv\');f.write(\'id,city,amount,date,code,a,b,c,d,e\\n\');for(let i=1;i<=2e6;i++)f.write(i+\',City\'+i%50+\',\'+i%997+\'.50,2026-01-\'+String(1+i%28).padStart(2,\'0\')+\',C\'+i%10000+\',1,2,3,4,5\\n\');f.end()"',
            'حجم الملف 96,046,244 بايت (نحو 96 ميغابايت)، وفيه 20,000,010 خلية مع صف العناوين. أي صفوف أكثر مما تتسع له ورقة Excel، وأكثر بقليل من 20 مليون خلية في Google Sheets، مع أنه دون رقم 100 ميغابايت. وفي OpenAnyDoc يتجاوز 50 ميغابايت، فيظهر تحذير الحجم أولًا.',
            'سجّل لكل برنامج هل وصلت الصفوف الـ 2,000,000 كلها وكم استغرق الفتح. وغيّر 2e6 إلى 1e6 لملف يتسع في ورقة Excel واحدة.',
          ],
        },
        {
          heading: 'أين يقدّم Google Sheets وExcel أكثر',
          paragraphs: ['جداول البيانات مصنوعة لعمل لا يؤديه العارض. يتيح Google Sheets لعدة أشخاص تعديل الجدول نفسه في الوقت نفسه، مع الصيغ والجداول المحورية والمخططات، كما تقول صفحة Sheets التعريفية. وفي Excel الصيغ وPivotTable والمخططات وPower Query، ويتسع نموذج البيانات فيه لملايين الصفوف، أي أكثر من الورقة، كما تقول صفحة Microsoft عن نموذج بيانات موفر للذاكرة (تحققنا منها في 24 نوفمبر 2026 كلتيهما)؛ ويشرح دليل ملف CSV أكبر من أن يفتحه Excel الخطوات. أما OpenAnyDoc فيعدّل القيم ويحفظ ملفات CSV أو Excel، لكن لا صيغ فيه ولا نسخة حية يعدّلها فريق معًا.'],
          links: [{ text: 'صفحة Sheets التعريفية', path: 'https://workspace.google.com/products/sheets/' }, { text: 'نموذج بيانات موفر للذاكرة', path: 'https://support.microsoft.com/topic/951c73a9-21c4-46ab-9f5e-14a2833b6a70' }, { text: 'ملف CSV أكبر من أن يفتحه Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'أيها تستخدم',
          paragraphs: ['اختر الأداة حسب المهمة:'],
          list: [
            'تصفح ملف تصدير كبير أو البحث فيه أو اقتطاع جزء منه: عارض ملفات CSV الكبيرة في OpenAnyDoc، أو تطبيق CSV لسطح المكتب.',
            'ملف يجب أن يعدّله فريق معًا: Google Sheets، إن اتسع له حد 20 مليون خلية.',
            'صيغ وجداول محورية ضمن حد الصفوف في الورقة: Excel أو LibreOffice Calc على الحاسوب.',
            'صفوف أكثر من ذلك في Excel: حمّل ملف CSV في نموذج البيانات، أو قسّمه أولًا.',
            'ملفات تصدير العملاء وغيرها من البيانات الخاصة: أداة تقرأ الملف على جهازك، ضمن قواعد جهتك بشأن المكان الذي يجوز أن تذهب إليه البيانات.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }, { text: 'قسّمه أولًا', path: '/split-csv' }],
        },
        {
          heading: 'هل يفتح Google Sheets ملف CSV فيه أكثر من مليون صف؟',
          paragraphs: ['نعم، ما دام الجدول كله ضمن حد Google البالغ 20 مليون خلية أو 100 ميغابايت. اقسم 20 مليونًا على عدد الأعمدة لتعرف أقصى عدد من الصفوف: يتسع ملف من 10 أعمدة لأقل بقليل من مليوني صف، وملف من 40 عمودًا لـ 500,000 صف فقط. وتُحسب الأوراق الأخرى في الجدول نفسه ضمن الحد أيضًا.'],
        },
        {
          heading: 'هل Excel للويب أفضل من Excel على الحاسوب للملفات الكبيرة؟',
          paragraphs: ['غالبًا لا. تذكر Microsoft حدًا للمتصفح من 0 إلى 100 ميغابايت للمصنفات في SharePoint Online حسب اشتراكك، و10 ميغابايت للمصنف المفتوح من مرفق في Outlook Web App. وفوق الحد تقترح صفحتها عن حدود حجم المصنفات في SharePoint تنزيل المصنف وفتحه في Excel على جهازك (تحققنا منها في 24 نوفمبر 2026).'],
          links: [{ text: 'حدود حجم المصنفات في SharePoint', path: 'https://support.microsoft.com/en-us/office/file-size-limits-for-workbooks-in-sharepoint-9e5bc6f8-018f-415a-b890-5452687b325e' }],
        },
        {
          heading: 'هل يغادر ملف CSV حاسوبي حين أفتحه في OpenAnyDoc؟',
          paragraphs: ['لا. يقرأ متصفحك الملف على جهازك، ولا ترسل الصفحة أي طلب يحمل ملفك، فلا رفع تنتظره حتى مع ملف تصدير كبير. ويمكنك مراقبة ذلك بنفسك في لوحة الشبكة في المتصفح، كما يشرح دليل كيف تتحقق من أن موقعًا لا يرفع ملفك.'],
          links: [{ text: 'كيف تتحقق من أن موقعًا لا يرفع ملفك', path: '/check-file-upload' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} مع حجم الملف وعدد صفوفه وأعمدته (دون بيانات شخصية)، وما تحتاج أن تفعله به.`],
        },
      ],
    },
    '/large-csv-test': {
      published: '2026-11-24',
      updated: '2026-11-24',
      sections: [
        {
          heading: 'الإجابة المختصرة',
          paragraphs: [
            'ملف CSV فيه 3,000,000 صف لا يتسع في ورقة عمل واحدة في Excel، لأن الورقة تتوقف عند 1,048,576 صفًا، وبأعمدته الثمانية يتجاوز حد Google Sheets البالغ 20 مليون خلية. أما الأدوات التي لا حد صفوف خاص بها فتفتح الملف كله إن كانت ذاكرة الجهاز تكفي، ومنها عارض ملفات CSV الكبيرة في OpenAnyDoc: يقرأ الملف داخل متصفحك ولا يرفع شيئًا. نعرض أدناه ملف الاختبار، وما تعنيه الحدود المنشورة لكل أداة من الأدوات الست بالنسبة إليه، وخطوات إجراء الاختبار على حاسوبك.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'ملف الاختبار',
          paragraphs: ['اكتب الملف ببرنامج نصي قصير، فلا يحوي أي بيانات حقيقية:'],
          list: [
            'الصفوف: 3,000,000 صف بيانات وصف عناوين واحد، أي 3,000,001 سطر.',
            'الأعمدة (8): order_id وorder_date وregion وcategory وproduct_code وquantity وunit_price وtotal.',
            'سطر نموذجي: 2,2025-07-10,South,Ink,P-99703,8,25.48,203.84.',
            'الحجم: أكثر من 100 ميغابايت بكثير، بحسب القيم العشوائية؛ سجّل حجم ملفك أنت.',
            'الصيغة: UTF-8 دون علامة ترتيب البايتات (BOM)، وفواصل بين الحقول، وسطر جديد في نهاية كل سطر، ولا حقول بين علامات تنصيص.',
            'الخلايا: 3,000,001 سطر × 8 أعمدة = 24,000,008 خلية.',
          ],
        },
        {
          heading: 'الجهاز والمتصفح وقواعد الاختبار',
          paragraphs: ['افتح الملف نفسه على الجهاز نفسه في كل أداة، أداة بعد أخرى، دون برامج أخرى تعمل. واحسب وقت كل أداة من إسقاط الملف أو فتحه حتى يمكن الوصول إلى آخر صف، وسجّل:'],
          list: [
            'الجهاز: الطراز والمعالج والذاكرة.',
            'نظام التشغيل.',
            'المتصفح المستخدم مع OpenAnyDoc وGoogle Sheets: الاسم والإصدار.',
            'Excel: الإصدار ورقم البناء، 32 أو 64 بت. LibreOffice Calc: الإصدار. محرر النصوص: الاسم والإصدار.',
            'تاريخ الاختبار. والحدود الرسمية أدناه مُراجعة في 24 نوفمبر 2026.',
          ],
        },
        {
          heading: 'ما تتوقعه في كل أداة',
          paragraphs: [
            'سطرا Excel وGoogle Sheets مستمدان من الحد المنشور لكل منتج؛ أما الباقي فسجّل فيه ما تراه.',
          ],
          list: [
            'عارض ملفات CSV الكبيرة في OpenAnyDoc: تحذير أولًا لأن الملف أكبر من 50 ميغابايت. سجّل كم يستغرق فتح الملف وكم صفًا يعرض. وبعد فتحه تظهر إرشادة تشرح كيف تقتطع من الملف ما يناسب Excel. واحسب أيضًا وقت الترتيب حسب عمود واحد ووقت البحث.',
            'عارض CSV في OpenAnyDoc: العارض نفسه دون الإرشادة؛ سجّل كم يستغرق فتح الملف.',
            'Excel (نسخة سطح المكتب): تتسع ورقة العمل لـ 1,048,576 صفًا، فلا يحمّل Excel من هذا الملف أكثر من صف العناوين و1,048,575 صف بيانات. أي إن 3,000,000 − 1,048,575 = 1,951,425 صفًا، 65% من البيانات، تبقى خارجه. سجّل الرسالة الظاهرة والوقت المستغرق.',
            'Google Sheets (ملف، استيراد): يتسع الجدول لما يصل إلى 20 مليون خلية، فبثمانية أعمدة يتسع لـ 20,000,000 ÷ 8 = 2,500,000 صف على الأكثر مع صف العناوين، فلا يتسع لـ 500,001 صف بيانات. وتذكر صفحة الحدود نفسها 100MB لكل جدول، وهذا الملف أكبر من 100 ميغابايت. سجّل هل فشل الاستيراد كليًا أم حمّل جزءًا من الملف.',
            'LibreOffice Calc: سجّل ما يعرضه وكم صفًا يصل.',
            'محرر النصوص: سجّل هل يفتح الملف، وكم يستغرق، وهل يواكب التمرير والبحث.',
          ],
          links: [
            { text: 'تتسع ورقة العمل لـ 1,048,576 صفًا', path: 'https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3' },
            { text: 'يتسع الجدول لما يصل إلى 20 مليون خلية', path: 'https://support.google.com/drive/answer/37603' },
          ],
        },
        {
          heading: 'كيف يقرأ OpenAnyDoc ملفًا بهذا الحجم',
          paragraphs: [
            'لا يُرسل شيء إلى أي خادم. يقرأ المتصفح الملف كله إلى ذاكرة التبويب، ويقسّمه عامل في الخلفية إلى صفوف كي تبقى الصفحة سريعة الاستجابة. وتعود الصفوف إلى الصفحة على دفعات من 10,000 صف، أي 301 دفعة لهذا الملف، ولا يُرسم إلا ما يظهر على الشاشة، فلا يبطؤ التمرير مهما كبر الجدول. وليس للعارض حد صفوف خاص به؛ الحد هو الذاكرة التي يمنحها متصفحك لتبويب واحد.',
            'إذا فُتح الملف من صفحة عارض ملفات CSV الكبيرة، يعرض الجدول إرشادة: صفِّ الصفوف التي تحتاجها، ثم اختر «خيارات التنزيل» وعلّم على «الصفوف الظاهرة فقط». وإذا فُتح من عارض CSV، يظهر الجدول نفسه دونها. ولتقطيع الملف إلى أجزاء يفتحها Excel، تحفظه أداة تقسيم CSV ملفات أصغر بعدد صفوف أو ميغابايتات تحدده، في كل منها صف العناوين.',
          ],
          links: [{ text: 'عارض CSV', path: '/csv-viewer' }, { text: 'تقسيم CSV', path: '/split-csv' }],
        },
        {
          heading: 'أين تتفوق الأدوات الأخرى',
          paragraphs: ['العارض ليس الأداة المناسبة لكل مهمة، وللأدوات الأخرى مواضع تتفوق فيها بوضوح (صفحات Microsoft وGoogle، تحققنا منها في 24 نوفمبر 2026):'],
          list: [
            'يستطيع Excel تحميل مجموعة البيانات كاملة عبر Power Query وتحليلها بجداول PivotTable، كما تشرح صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel، وفيه صيغ ومخططات ووحدات ماكرو لا يقدمها العارض.',
            'يحفظ Google Sheets الملف على الإنترنت ليحرره عدة أشخاص معًا، ويتيح سجل المراجعات الرجوع إلى إصدارات سابقة، كما تقول صفحة Sheets التعريفية.',
            'LibreOffice Calc جدول بيانات كامل يعمل دون اتصال، بصيغ ومخططات، ودون تكلفة.',
            'محرر النصوص المصمم للملفات الكبيرة يعرض النص الخام كما كُتب تمامًا، وهذا مفيد حين يكون سطر واحد معطوبًا.',
          ],
          links: [{ text: 'مجموعة بيانات أكبر من شبكة Excel', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'صفحة Sheets التعريفية', path: 'https://workspace.google.com/products/sheets/' }],
        },
        {
          heading: 'كيف تعيد هذا الاختبار',
          paragraphs: ['استخدم الملف نفسه في كل أداة، وأغلق البرامج الأخرى أولًا:'],
          list: [
            'اكتب الملف ببرنامج نصي تختاره: 3,000,000 صف من الأعمدة الثمانية أعلاه بقيم عشوائية، بترميز UTF-8 وفواصل وصف عناوين واحد. تأكد أن فيه 3,000,001 سطر، وسجّل حجمه.',
            'سجّل الجهاز ونظام التشغيل والمتصفح وإصدارات البرامج.',
            'افتح عارض ملفات CSV الكبيرة، وأسقط الملف، واحسب الوقت من الإسقاط حتى يظهر عدد الصفوف. ثم رتّب حسب عمود واحد وابحث عن رمز منتج واحد، واحسب وقت كل منهما.',
            'كرر ذلك في صفحة عارض CSV.',
            'افتح الملف في Excel بالنقر المزدوج، وسجّل الرسالة والوقت ورقم آخر صف.',
            'في Google Sheets اختر ملف ثم استيراد ثم تحميل، وسجّل ما يحدث.',
            'افتحه في LibreOffice Calc وفي محرر النصوص، وسجّل الأمور نفسها.',
            'شغّل كل أداة ثلاث مرات وسجّل الوقت الأوسط.',
          ],
          links: [{ text: 'عارض ملفات CSV الكبيرة', path: '/large-csv-viewer' }],
        },
        {
          heading: 'هل يفتح Excel ملف CSV فيه 3 ملايين صف؟',
          paragraphs: [
            'لا يستطيع Excel عرض 3 ملايين صف في ورقة عمل واحدة، لأن الورقة تتوقف عند 1,048,576 صفًا. وإذا فتحت الملف مباشرة يحذّر Excel من أن مجموعة البيانات أكبر من شبكة Excel وأن بعض البيانات لم يُحمَّل. ويمكن لـ Power Query تحميل مجموعة البيانات كاملة لجداول PivotTable، أو يمكنك تقسيم الملف أولًا، كما تشرح صفحة Microsoft عن مجموعة بيانات أكبر من شبكة Excel (تحققنا منها في 24 نوفمبر 2026). ويشرح دليل ملف CSV أكبر من أن يفتحه Excel كل الخيارات.',
          ],
          links: [{ text: 'مجموعة بيانات أكبر من شبكة Excel', path: 'https://support.microsoft.com/en-us/excel/what-to-do-if-a-data-set-is-too-large-for-the-excel-grid' }, { text: 'ملف CSV أكبر من أن يفتحه Excel', path: '/csv-too-big-for-excel' }],
        },
        {
          heading: 'لماذا لا يستورد Google Sheets ملف CSV كبيرًا جدًا؟',
          paragraphs: [
            'يحدّ Google Sheets كل جدول بـ 20 مليون خلية أو 100MB، فالملف الطويل الكثير الأعمدة تنفد مساحته. اقسم 20 مليونًا على عدد أعمدتك لتعرف كم صفًا يتسع. ولمقارنة الطريقتين جنبًا إلى جنب، اقرأ دليل OpenAnyDoc مقابل Google Sheets للملفات الكبيرة.',
          ],
          links: [{ text: 'OpenAnyDoc مقابل Google Sheets للملفات الكبيرة', path: '/openanydoc-vs-google-sheets-large-files' }],
        },
        {
          heading: 'كيف أقسّم ملف CSV كبيرًا ليتسع كل جزء في Excel؟',
          paragraphs: [
            'قسّمه إلى أجزاء لا يزيد كل منها على 1,048,575 صف بيانات، فيتسع كل جزء مع صف عناوينه في ورقة عمل واحدة. تفعل أداة تقسيم CSV ذلك داخل متصفحك بعدد الصفوف أو بالميغابايت، وتضع صف العناوين في كل جزء، وتنزّل الأجزاء في ملف ZIP واحد. ويشرح دليل كيف تقسّم ملف CSV كبيرًا الخطوات.',
          ],
          links: [{ text: 'تقسيم CSV', path: '/split-csv' }, { text: 'كيف تقسّم ملف CSV كبيرًا', path: '/split-large-csv' }],
        },
        {
          heading: 'أسئلة؟',
          paragraphs: [`راسلنا على ${CONTACT_EMAIL} بنتائجك أنت لهذا الاختبار، مع عدد صفوف الملف وحجمه والجهاز الذي استخدمته (دون بيانات شخصية).`],
        },
      ],
    },
    '/guides': {
      sections: [
        {
          heading: 'الأدلة',
          paragraphs: ['إجابات قصيرة وعملية للمشكلات التي يصطدم بها الناس مع ملفات CSV وExcel وJSON والملفات النصية ومستندات وورد وعروض بوربوينت وملفات PDF، مع الأداة المجانية التي تحلها في متصفحك:'],
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
            'أدوات PDF لا ترفع ملفك',
            'كيف توقّع ملف PDF بدون Adobe',
            'كيف تفتح ملف TXT: أي برنامج تستخدم على أي جهاز',
            'كيف تفتح ملف CSV بدون اكسل',
            'كيف تفتح ملف PPTX بدون بوربوينت',
            'كيف تفتح ملف PDF بدون Adobe',
            'لماذا يظهر النص العربي مقلوبًا حين تنسخه من ملف PDF، وكيف تصلحه',
            'لماذا لا تستطيع تعديل النص في ملف PDF؟',
            'كيف تعبّئ نموذج PDF بدون Acrobat',
            'بديل Stirling-PDF لا يحتاج إلى خادم',
            'بديل jsonformatter.org وCode Beautify',
            'كيف تعطي ChatGPT ملف PDF دون أن تفقد الجداول',
            'كم رمزًا يستهلك ملف PDF؟',
            'كيف تعطي محادثة ذكاء اصطناعي مستند وورد وتحافظ على بنيته',
            'كيف تعطي محادثة ذكاء اصطناعي عرض بوربوينت',
            'كيف أعطي محادثة الذكاء الاصطناعي جدول بيانات تقرؤه؟',
            'كيف تصنع جدول Markdown من ملف CSV',
            'ما هي صيغة TOON، ومتى توفّر الرموز؟',
            'كيف تدمج ملفات PDF على أي جهاز',
            'كيف تقسّم ملف PDF أو تحفظ بعض صفحاته',
            'كيف تجمع صور الهاتف في ملف PDF واحد',
            'كيف تحمي ملف PDF بكلمة مرور',
            'كيف تجعل ملف PDF الممسوح ضوئيًا قابلًا للبحث',
            'كيف تقلل حجم ملف الصورة للبريد أو النماذج',
            'كيف تفتح صور HEIC من iPhone على Windows',
            'كيف تحذف الموقع من الصورة',
            'كيف تزيل خلفية الصورة دون رفعها',
            'كيف تحوّل ورقة اكسل إلى JSON لواجهة برمجية',
            'كيف تقسّم ملف CSV كبيرًا إلى ملفات أصغر',
            'ما الفرق بين JSON وJSON Lines؟',
            'كيف تقارن ملفي JSON وتعرف ما الذي تغيّر',
            'ما حدود الصفوف والأعمدة في Excel؟',
            'كيف أعثر على الأوراق والصفوف والصيغ المخفية في ملف Excel؟',
            'كيف أحوّل ملف Excel إلى CSV دون أن تتشوه العربية؟',
            'كيف تقرأ ملاحظات المتحدث دون بوربوينت',
            'كيف تضغط فيديو دون رفعه',
            'ماذا تفعل حين يكون الملف أكبر من أن يقبله ChatGPT',
            'ما أفضل عارض CSV مجاني؟',
            'ما منسّقات JSON المجانية التي لا تخزّن بياناتك؟',
            'OpenAnyDoc أم Google Sheets أم Excel: أيها يفتح ملفات CSV الكبيرة؟',
            'كيف تختبر ملف CSV من 3 ملايين صف في 6 أدوات',
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
            { text: 'أدوات PDF لا ترفع ملفك', path: '/pdf-tools-without-upload' },
            { text: 'كيف توقّع ملف PDF بدون Adobe', path: '/sign-pdf-without-adobe' },
            { text: 'كيف تفتح ملف TXT: أي برنامج تستخدم على أي جهاز', path: '/open-txt-file' },
            { text: 'كيف تفتح ملف CSV بدون اكسل', path: '/open-csv-without-excel' },
            { text: 'كيف تفتح ملف PPTX بدون بوربوينت', path: '/open-pptx-without-powerpoint' },
            { text: 'كيف تفتح ملف PDF بدون Adobe', path: '/open-pdf-without-adobe' },
            { text: 'لماذا يظهر النص العربي مقلوبًا حين تنسخه من ملف PDF، وكيف تصلحه', path: '/fix-arabic-text-copied-from-pdf' },
            { text: 'لماذا لا تستطيع تعديل النص في ملف PDF؟', path: '/cant-edit-text-in-pdf' },
            { text: 'كيف تعبّئ نموذج PDF بدون Acrobat', path: '/fill-pdf-form-without-acrobat' },
            { text: 'بديل Stirling-PDF لا يحتاج إلى خادم', path: '/stirling-pdf-alternative' },
            { text: 'بديل jsonformatter.org وCode Beautify', path: '/jsonformatter-alternative' },
            { text: 'كيف تعطي ChatGPT ملف PDF دون أن تفقد الجداول', path: '/pdf-to-ai-chat-with-tables' },
            { text: 'كم رمزًا يستهلك ملف PDF؟', path: '/how-many-tokens-is-my-pdf' },
            { text: 'كيف تعطي محادثة ذكاء اصطناعي مستند وورد وتحافظ على بنيته', path: '/word-document-to-ai-chat' },
            { text: 'كيف تعطي محادثة ذكاء اصطناعي عرض بوربوينت', path: '/powerpoint-to-ai-chat' },
            { text: 'كيف أعطي محادثة الذكاء الاصطناعي جدول بيانات تقرؤه؟', path: '/spreadsheet-to-ai-chat' },
            { text: 'كيف تصنع جدول Markdown من ملف CSV', path: '/make-markdown-table-from-csv' },
            { text: 'ما هي صيغة TOON، ومتى توفّر الرموز؟', path: '/what-is-toon-format' },
            { text: 'كيف تدمج ملفات PDF على أي جهاز', path: '/how-to-merge-pdf-files' },
            { text: 'كيف تقسّم ملف PDF أو تحفظ بعض صفحاته', path: '/how-to-split-a-pdf' },
            { text: 'كيف تجمع صور الهاتف في ملف PDF واحد', path: '/photos-to-one-pdf' },
            { text: 'كيف تحمي ملف PDF بكلمة مرور', path: '/password-protect-pdf-free' },
            { text: 'كيف تجعل ملف PDF الممسوح ضوئيًا قابلًا للبحث', path: '/make-scanned-pdf-searchable' },
            { text: 'كيف تقلل حجم ملف الصورة للبريد أو النماذج', path: '/reduce-photo-file-size' },
            { text: 'كيف تفتح صور HEIC من iPhone على Windows', path: '/open-heic-on-windows' },
            { text: 'كيف تحذف الموقع من الصورة', path: '/remove-location-from-photo' },
            { text: 'كيف تزيل خلفية الصورة دون رفعها', path: '/remove-background-without-upload' },
            { text: 'كيف تحوّل ورقة اكسل إلى JSON لواجهة برمجية', path: '/convert-excel-to-json-for-api' },
            { text: 'كيف تقسّم ملف CSV كبيرًا إلى ملفات أصغر', path: '/split-large-csv' },
            { text: 'ما الفرق بين JSON وJSON Lines؟', path: '/json-vs-json-lines' },
            { text: 'كيف تقارن ملفي JSON وتعرف ما الذي تغيّر', path: '/compare-two-json-files' },
            { text: 'ما حدود الصفوف والأعمدة في Excel؟', path: '/excel-row-and-column-limits' },
            { text: 'كيف أعثر على الأوراق والصفوف والصيغ المخفية في ملف Excel؟', path: '/find-hidden-sheets-in-excel' },
            { text: 'كيف أحوّل ملف Excel إلى CSV دون أن تتشوه العربية؟', path: '/excel-to-csv-without-breaking-arabic' },
            { text: 'كيف تقرأ ملاحظات المتحدث دون بوربوينت', path: '/read-speaker-notes-without-powerpoint' },
            { text: 'كيف تضغط فيديو دون رفعه', path: '/compress-video-without-upload' },
            { text: 'ماذا تفعل حين يكون الملف أكبر من أن يقبله ChatGPT', path: '/file-too-large-for-chatgpt' },
            { text: 'ما أفضل عارض CSV مجاني؟', path: '/best-free-csv-viewers' },
            { text: 'ما منسّقات JSON المجانية التي لا تخزّن بياناتك؟', path: '/best-free-json-formatters' },
            { text: 'OpenAnyDoc أم Google Sheets أم Excel: أيها يفتح ملفات CSV الكبيرة؟', path: '/openanydoc-vs-google-sheets-large-files' },
            { text: 'كيف تختبر ملف CSV من 3 ملايين صف في 6 أدوات', path: '/large-csv-test' },
          ],
        },
        {
          heading: 'من أين تبدأ',
          paragraphs: [
            'إن أرسل إليك أحدهم ملفًا وليس لديك البرنامج الذي صُنع به، فابدأ بأدلة فتح الملفات: ملف TXT على أي جهاز، أو ملف CSV أو XLSX بدون اكسل، أو ملف DOCX بدون وورد، أو ملف PPTX بدون بوربوينت، أو ملف JSON، أو ملف PDF بدون Adobe. يسرد كل دليل الخيارات المجانية، ويذكر أيها يرفع ملفك، وما يحفظه كل منها وما يُسقطه.',
            'وإن فُتح الملف لكنه بدا خاطئًا، فأدلة المشكلات تشرح السبب قبل الحل: عربية تتحول إلى رموز، أو ملف CSV يستقر في عمود واحد، أو ملف أكبر من أن يفتحه Excel، أو خطأ JSON يشير إلى رمز غير متوقع. وإن كنت على وشك مشاركة ملف، فدليلا إخفاء البيانات والتحقق من أن الموقع لا يرفع ملفك يبيّنان ما تنظر إليه أولًا.',
          ],
        },
        {
          heading: 'كيف تُكتب هذه الأدلة',
          paragraphs: [
            'يُراجع كل دليل على العارضات قبل نشره: كل خطوة تسمّي زرًا موجودًا فعلًا، وكل حد مأخوذ من إعدادات الأداة نفسها أو من تجربة أجريناها أو من صفحة الجهة المصنِّعة نفسها. والتاريخان تحت العنوان يقولان متى كُتب الدليل ومتى تغيّر نصه آخر مرة.',
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
