// Generates synthetic CSV and Word test files into test-files/. Run: node scripts/generate-test-files.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'

const HUGE_FILE_ROW_COUNT = 120_000
const outputDirectory = new URL('../test-files/', import.meta.url)
mkdirSync(outputDirectory, { recursive: true })

// Seeded (mulberry32) so every run produces identical files.
function createRandomNumberGenerator(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}
const nextRandom = createRandomNumberGenerator(20261005)
const pickFrom = (items) => items[Math.floor(nextRandom() * items.length)]

const firstNames = ['Alice', 'Bruno', 'Chloe', 'Dmitri', 'Elena', 'Farid', 'Greta', 'Hugo', 'Ines', 'Jonas']
const lastNames = ['Archer', 'Bishop', 'Castro', 'Dumont', 'Ellis', 'Fischer', 'Garnier', 'Hale', 'Ito', 'Jensen']
const cities = ['Lyon', 'Porto', 'Graz', 'Leeds', 'Malmo', 'Turin', 'Gdansk', 'Bilbao']
const arabicFirstNames = ['أحمد', 'سارة', 'خالد', 'ليلى', 'يوسف', 'مريم', 'عمر', 'نور']
const arabicCities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'أبها']

function formatDate(dayOffset) {
  const date = new Date(Date.UTC(2024, 0, 1) + dayOffset * 86_400_000)
  return date.toISOString().slice(0, 10)
}

function buildCustomerRows(rowCount) {
  const rows = [['id', 'first_name', 'last_name', 'email', 'city', 'amount', 'signup_date', 'note']]
  for (let id = 1; id <= rowCount; id++) {
    const firstName = pickFrom(firstNames)
    const lastName = pickFrom(lastNames)
    rows.push([
      id,
      firstName,
      lastName,
      `${firstName}.${lastName}.${id}@example.com`.toLowerCase(),
      pickFrom(cities),
      (nextRandom() * 5000).toFixed(2),
      formatDate(Math.floor(nextRandom() * 700)),
      id % 7 === 0 ? 'Said "hello", twice; then left | quietly' : '',
    ])
  }
  return rows
}

function buildArabicRows(rowCount) {
  const rows = [['الرقم', 'الاسم', 'المدينة', 'المبلغ', 'التاريخ', 'ملاحظة']]
  for (let id = 1; id <= rowCount; id++) {
    rows.push([
      id,
      pickFrom(arabicFirstNames),
      pickFrom(arabicCities),
      (nextRandom() * 5000).toFixed(2),
      formatDate(Math.floor(nextRandom() * 700)),
      id % 4 === 0 ? 'قال "مرحبا"، ثم غادر' : '',
    ])
  }
  return rows
}

function toDelimitedText(rows, delimiter) {
  const needsQuoting = new RegExp(`["\\n\\r${delimiter === '|' ? '\\|' : delimiter}]`)
  return (
    rows
      .map((row) =>
        row
          .map((cell) => {
            const cellText = String(cell)
            return needsQuoting.test(cellText) ? `"${cellText.replaceAll('"', '""')}"` : cellText
          })
          .join(delimiter),
      )
      .join('\n') + '\n'
  )
}

function writeTestFile(fileName, contents) {
  writeFileSync(new URL(fileName, outputDirectory), contents)
}

const customerRows = buildCustomerRows(200)
const arabicText = toDelimitedText(buildArabicRows(40), ',')

writeTestFile('huge-120k-rows.csv', toDelimitedText(buildCustomerRows(HUGE_FILE_ROW_COUNT), ','))

writeTestFile('arabic-utf8.csv', arabicText)
writeTestFile('arabic-utf8-bom.csv', '﻿' + arabicText)

writeTestFile('delimiter-semicolon.csv', toDelimitedText(customerRows, ';'))
writeTestFile('delimiter-tab.csv', toDelimitedText(customerRows, '\t'))
writeTestFile('delimiter-pipe.csv', toDelimitedText(customerRows, '|'))

writeTestFile('empty.csv', '')

const garbageBytes = Buffer.from(Array.from({ length: 300 }, () => Math.floor(nextRandom() * 256)))
writeTestFile(
  'corrupted.csv',
  Buffer.concat([
    Buffer.from('id,name,city\n1,Alice,Lyon\n2,"Bruno,Porto\n'),
    Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x81, 0x00, 0x00]),
    garbageBytes,
    Buffer.from('\n3,"unterminated'),
  ]),
)

writeTestFile(
  'text-renamed.csv',
  [
    'Meeting notes',
    '',
    'This is a plain text file that was renamed to end in .csv. It has sentences, not columns.',
    'Nothing here is separated in a consistent way; some lines have commas, others do not.',
    '',
    'Next steps: check how the viewer reacts when the content is not tabular data.',
    '',
  ].join('\n'),
)

// ---- Word (.docx built by hand, .doc through macOS textutil) ----

const escapeXml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const WORD_NAMESPACES =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

// Child elements of rPr/pPr must follow the schema order, or Word reports the file as damaged.
function wordRun(text, format, rightToLeft) {
  const properties = [
    format.bold && '<w:b/>',
    format.italic && '<w:i/>',
    format.color && `<w:color w:val="${format.color}"/>`,
    format.underline && '<w:u w:val="single"/>',
    rightToLeft && '<w:rtl/>',
  ]
    .filter(Boolean)
    .join('')
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function wordParagraph(runsXml, { style, listId, listLevel = 0, rightToLeft }) {
  const properties = [
    style && `<w:pStyle w:val="${style}"/>`,
    listId && `<w:numPr><w:ilvl w:val="${listLevel}"/><w:numId w:val="${listId}"/></w:numPr>`,
    rightToLeft && '<w:bidi/>',
  ]
    .filter(Boolean)
    .join('')
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${runsXml}</w:p>`
}

function wordTableCell(text, { bold, fill, columnSpan = 1, rightToLeft }) {
  const properties =
    '<w:tcW w:w="0" w:type="auto"/>' +
    (columnSpan > 1 ? `<w:gridSpan w:val="${columnSpan}"/>` : '') +
    (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '')
  const paragraph = wordParagraph(wordRun(text, { bold }, rightToLeft), { rightToLeft })
  return `<w:tc><w:tcPr>${properties}</w:tcPr>${paragraph}</w:tc>`
}

function buildWordTable(wordText, rightToLeft) {
  const headerRow = wordText.tableHeader
    .map((label) => wordTableCell(label, { bold: true, fill: 'D9E2F3', rightToLeft }))
    .join('')
  const amounts = []
  const dataRows = [1, 2, 3].map(() => {
    const amount = Number((nextRandom() * 5000).toFixed(2))
    amounts.push(amount)
    return [pickFrom(wordText.names), pickFrom(wordText.cities), amount.toFixed(2), formatDate(Math.floor(nextRandom() * 700))]
      .map((cellText) => wordTableCell(cellText, { rightToLeft }))
      .join('')
  })
  const totalRow =
    wordTableCell(wordText.totalLabel, { bold: true, columnSpan: 2, fill: 'F2F2F2', rightToLeft }) +
    wordTableCell(amounts.reduce((sum, amount) => sum + amount, 0).toFixed(2), { bold: true, fill: 'F2F2F2', rightToLeft }) +
    wordTableCell('', { fill: 'F2F2F2', rightToLeft })
  const rows = [headerRow, ...dataRows, totalRow].map((cellsXml) => `<w:tr>${cellsXml}</w:tr>`).join('')
  return (
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>${rightToLeft ? '<w:bidiVisual/>' : ''}<w:tblW w:w="5000" w:type="pct"/></w:tblPr>` +
    `<w:tblGrid>${'<w:gridCol w:w="2250"/>'.repeat(4)}</w:tblGrid>${rows}</w:tbl>`
  )
}

const WORD_IMAGE_SIZE_EMU = 914400 // one inch

const wordInlineImage =
  '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
  `<wp:extent cx="${WORD_IMAGE_SIZE_EMU}" cy="${WORD_IMAGE_SIZE_EMU}"/><wp:docPr id="1" name="Logo"/>` +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
  '<pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
  '<pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
  `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${WORD_IMAGE_SIZE_EMU}" cy="${WORD_IMAGE_SIZE_EMU}"/></a:xfrm>` +
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
  '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'

function buildWordBody(wordText, rightToLeft) {
  const plainParagraph = (text) => wordParagraph(wordRun(text, {}, rightToLeft), { rightToLeft })
  const listItem = ([text, listLevel], listId) =>
    wordParagraph(wordRun(text, {}, rightToLeft), { style: 'ListParagraph', listId, listLevel, rightToLeft })
  return [
    wordParagraph(wordRun(wordText.heading, {}, rightToLeft), { style: 'Heading1', rightToLeft }),
    wordParagraph(wordText.intro.map(([text, format]) => wordRun(text, format, rightToLeft)).join(''), { rightToLeft }),
    plainParagraph(wordText.mixedSentence),
    buildWordTable(wordText, rightToLeft),
    plainParagraph(wordText.bulletTitle),
    ...wordText.bulletItems.map((item) => listItem(item, 1)),
    plainParagraph(wordText.numberedTitle),
    ...wordText.numberedItems.map((item) => listItem(item, 2)),
    wordParagraph(wordInlineImage, { rightToLeft }),
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    wordParagraph(wordRun(wordText.secondPageHeading, {}, rightToLeft), { style: 'Heading1', rightToLeft }),
    plainParagraph(wordText.secondPageText),
  ].join('')
}

const WORD_STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${WORD_NAMESPACES}>` +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
  '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>' +
  '<w:rPr><w:b/><w:bCs/><w:color w:val="2F5496"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
  '<w:pPr><w:spacing w:after="0"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>' +
  '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:tblPr><w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('') +
  '</w:tblBorders><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
  '</w:styles>'

function wordListLevel(level, format, levelText) {
  return (
    `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${levelText}"/><w:lvlJc w:val="left"/>` +
    `<w:pPr><w:ind w:left="${720 * (level + 1)}" w:hanging="360"/></w:pPr></w:lvl>`
  )
}

const WORD_NUMBERING_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${WORD_NAMESPACES}>` +
  `<w:abstractNum w:abstractNumId="0">${wordListLevel(0, 'bullet', '•')}${wordListLevel(1, 'bullet', '◦')}</w:abstractNum>` +
  `<w:abstractNum w:abstractNumId="1">${wordListLevel(0, 'decimal', '%1.')}${wordListLevel(1, 'lowerLetter', '%2)')}</w:abstractNum>` +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '</w:numbering>'

function buildDocx(wordText, rightToLeft) {
  const headerXml = wordParagraph(wordRun(wordText.header, { color: '808080' }, rightToLeft), { rightToLeft })
  const pageNumberField =
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
  const footerXml = wordParagraph(wordRun(wordText.footerPrefix, {}, rightToLeft) + pageNumberField, { rightToLeft })
  const sectionProperties =
    '<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
    `${rightToLeft ? '<w:bidi/>' : ''}</w:sectPr>`
  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  const relationship = (id, type, target) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`
  const contentTypeOverride = (partName, type) =>
    `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`

  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `${xmlDeclaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
      contentTypeOverride('/word/document.xml', 'document.main') +
      contentTypeOverride('/word/styles.xml', 'styles') +
      contentTypeOverride('/word/numbering.xml', 'numbering') +
      contentTypeOverride('/word/header1.xml', 'header') +
      contentTypeOverride('/word/footer1.xml', 'footer') +
      '</Types>',
  )
  zip.file(
    '_rels/.rels',
    `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      relationship('rIdDocument', 'officeDocument', 'word/document.xml') +
      '</Relationships>',
  )
  zip.file(
    'word/_rels/document.xml.rels',
    `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      relationship('rIdStyles', 'styles', 'styles.xml') +
      relationship('rIdNumbering', 'numbering', 'numbering.xml') +
      relationship('rIdHeader', 'header', 'header1.xml') +
      relationship('rIdFooter', 'footer', 'footer1.xml') +
      relationship('rIdImage', 'image', 'media/image1.png') +
      '</Relationships>',
  )
  zip.file('word/document.xml', `${xmlDeclaration}<w:document ${WORD_NAMESPACES}><w:body>${buildWordBody(wordText, rightToLeft)}${sectionProperties}</w:body></w:document>`)
  zip.file('word/styles.xml', WORD_STYLES_XML)
  zip.file('word/numbering.xml', WORD_NUMBERING_XML)
  zip.file('word/header1.xml', `${xmlDeclaration}<w:hdr ${WORD_NAMESPACES}>${headerXml}</w:hdr>`)
  zip.file('word/footer1.xml', `${xmlDeclaration}<w:ftr ${WORD_NAMESPACES}>${footerXml}</w:ftr>`)
  zip.file('word/media/image1.png', readFileSync(new URL('../public/logo.png', import.meta.url)))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

const englishWordText = {
  heading: 'Quarterly summary (synthetic sample)',
  intro: [
    ['This is a ', {}],
    ['synthetic', { bold: true }],
    [' test document with ', {}],
    ['italic', { italic: true }],
    [', ', {}],
    ['underlined', { underline: true }],
    [' and ', {}],
    ['coloured', { color: 'C0504D' }],
    [' text.', {}],
  ],
  mixedSentence: 'Version 2.4.1 is out; write to support@example.com with questions.',
  tableHeader: ['Name', 'City', 'Amount', 'Date'],
  totalLabel: 'Total',
  names: firstNames,
  cities,
  bulletTitle: 'What changed:',
  bulletItems: [
    ['Faster file opening', 0],
    ['Large files load in chunks', 1],
    ['Nothing is uploaded', 1],
    ['New export options', 0],
  ],
  numberedTitle: 'Next steps:',
  numberedItems: [
    ['Review the table above', 0],
    ['Check the totals', 1],
    ['Compare with last quarter', 1],
    ['Share the summary', 0],
  ],
  secondPageHeading: 'Second page',
  secondPageText: 'This page exists to check page breaks, the repeated header and the page number in the footer.',
  header: 'OpenAnyDoc sample — header',
  footerPrefix: 'Page ',
}

const arabicWordText = {
  heading: 'ملخص ربع سنوي (عينة اصطناعية)',
  intro: [
    ['هذا ', {}],
    ['مستند اختبار', { bold: true }],
    [' اصطناعي يحتوي على نص ', {}],
    ['مائل', { italic: true }],
    [' و', {}],
    ['مسطّر', { underline: true }],
    [' و', {}],
    ['ملوّن', { color: 'C0504D' }],
    ['.', {}],
  ],
  mixedSentence: 'صدر الإصدار 2.4.1 من OpenAnyDoc؛ راسلنا على support@example.com لأي سؤال.',
  tableHeader: ['الاسم', 'المدينة', 'المبلغ', 'التاريخ'],
  totalLabel: 'المجموع',
  names: arabicFirstNames,
  cities: arabicCities,
  bulletTitle: 'ما الذي تغيّر:',
  bulletItems: [
    ['فتح الملفات أسرع', 0],
    ['الملفات الكبيرة تُحمّل على أجزاء', 1],
    ['لا يُرفع أي ملف', 1],
    ['خيارات تصدير جديدة', 0],
  ],
  numberedTitle: 'الخطوات التالية:',
  numberedItems: [
    ['راجع الجدول أعلاه', 0],
    ['تحقق من المجاميع', 1],
    ['قارن بالربع الماضي', 1],
    ['شارك الملخص', 0],
  ],
  secondPageHeading: 'الصفحة الثانية',
  secondPageText: 'هذه الصفحة للتحقق من فواصل الصفحات وتكرار الترويسة ورقم الصفحة في التذييل.',
  header: 'عينة OpenAnyDoc — الترويسة',
  footerPrefix: 'صفحة ',
}

writeTestFile('word-rich.docx', await buildDocx(englishWordText, false))
writeTestFile('word-arabic.docx', await buildDocx(arabicWordText, true))

const legacyWordHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Legacy Word sample</title></head><body>
<h1>Legacy Word 97 sample</h1>
<p>An old <b>.doc</b> file with <i>italic</i> and <u>underlined</u> text, made by macOS textutil.</p>
<table border="1"><tr><th>Name</th><th>City</th><th>Amount</th></tr>
<tr><td>Alice</td><td>Lyon</td><td>120.50</td></tr><tr><td>Bruno</td><td>Porto</td><td>89.99</td></tr></table>
<ul><li>First point<ul><li>Nested point</li></ul></li><li>Second point</li></ul>
<ol><li>Step one</li><li>Step two</li></ol>
</body></html>`
const legacyHtmlPath = join(tmpdir(), 'openanydoc-legacy-word.html')
writeFileSync(legacyHtmlPath, legacyWordHtml)
try {
  execFileSync('textutil', ['-convert', 'doc', '-output', new URL('word-legacy.doc', outputDirectory).pathname, legacyHtmlPath])
} catch {
  console.log('Skipped word-legacy.doc: macOS textutil is not available.')
}
rmSync(legacyHtmlPath)

console.log(`Wrote test files to ${outputDirectory.pathname}`)
