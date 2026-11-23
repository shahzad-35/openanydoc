// Generates synthetic CSV, Word, PowerPoint, PDF and photo test files into test-files/, and the binary sample files the tool pages bundle
// ("Try a sample file") into src/samples/ (commit those). Run: node scripts/generate-test-files.mjs
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import JSZip from 'jszip'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as XLSX from 'xlsx'

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

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const relationship = (id, type, target) =>
  `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`

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

// ---- PowerPoint (.pptx built by hand) ----

const PRESENTATION_NAMESPACES =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const SMARTART_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const SMARTART_DRAWING_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2008/diagram'
const presentationContentType = (type) => `application/vnd.openxmlformats-officedocument.${type}+xml`
const inchesToEmu = (inches) => Math.round(inches * 914400)
const shapePosition = ([x, y, width, height]) =>
  `<a:off x="${inchesToEmu(x)}" y="${inchesToEmu(y)}"/><a:ext cx="${inchesToEmu(width)}" cy="${inchesToEmu(height)}"/>`
const solidFill = (color) => `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`

const SHAPE_TREE_HEADER =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

function slideTextParagraph(text, { fontSize, bold, textColor, align }) {
  return (
    `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${fontSize}"${bold ? ' b="1"' : ''}>${solidFill(textColor)}</a:rPr>` +
    `<a:t>${escapeXml(text)}</a:t></a:r></a:p>`
  )
}

// A preset shape (rect, ellipse, star5, ...); without a fill it is a plain text box.
function slideShape(id, geometry, box, { fill, text = '', fontSize = 1800, bold = false, textColor = 'FFFFFF', align = 'ctr' }) {
  const fillAndLine = fill ? `${solidFill(fill)}<a:ln w="12700">${solidFill('404040')}</a:ln>` : '<a:noFill/>'
  const paragraph = text ? slideTextParagraph(text, { fontSize, bold, textColor, align }) : '<a:p><a:endParaRPr lang="en-US"/></a:p>'
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${geometry} ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm>${shapePosition(box)}</a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${fillAndLine}</p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/>${paragraph}</p:txBody></p:sp>`
  )
}

const slideTitle = (id, text) => slideShape(id, 'rect', [0.6, 0.4, 12.1, 1], { text, fontSize: 3200, bold: true, textColor: '1F3864', align: 'l' })

function slideArrowLine(id, box) {
  return (
    `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Arrow line ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
    `<p:spPr><a:xfrm>${shapePosition(box)}</a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>` +
    `<a:ln w="28575">${solidFill('404040')}<a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`
  )
}

// cropPercent trims each edge; rotation is in degrees.
function slidePicture(id, box, { rotation = 0, cropPercent = 0 } = {}) {
  const crop = cropPercent ? `<a:srcRect l="${cropPercent * 1000}" t="${cropPercent * 1000}" r="${cropPercent * 1000}" b="${cropPercent * 1000}"/>` : ''
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}" descr="OpenAnyDoc logo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rIdImage"/>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm${rotation ? ` rot="${rotation * 60000}"` : ''}>${shapePosition(box)}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  )
}

function slideTableCell(text, { bold, fill, textColor = '1F1F1F', columnSpan, mergedIntoPrevious }) {
  const paragraph = text
    ? `<a:p><a:r><a:rPr lang="en-US" sz="1400"${bold ? ' b="1"' : ''}>${solidFill(textColor)}</a:rPr><a:t>${escapeXml(text)}</a:t></a:r></a:p>`
    : '<a:p><a:endParaRPr lang="en-US"/></a:p>'
  const borders = ['lnL', 'lnR', 'lnT', 'lnB'].map((side) => `<a:${side} w="12700">${solidFill('808080')}</a:${side}>`).join('')
  return (
    `<a:tc${columnSpan ? ` gridSpan="${columnSpan}"` : ''}${mergedIntoPrevious ? ' hMerge="1"' : ''}>` +
    `<a:txBody><a:bodyPr/><a:lstStyle/>${paragraph}</a:txBody><a:tcPr>${borders}${fill ? solidFill(fill) : '<a:noFill/>'}</a:tcPr></a:tc>`
  )
}

function slideTable(id, box) {
  const headerCells = ['Name', 'City', 'Amount', 'Date'].map((label) => slideTableCell(label, { bold: true, fill: '2F5496', textColor: 'FFFFFF' }))
  const amounts = []
  const dataRows = [1, 2, 3, 4, 5].map((rowNumber) => {
    const amount = Number((nextRandom() * 5000).toFixed(2))
    amounts.push(amount)
    const fill = rowNumber % 2 === 0 ? 'F2F2F2' : undefined
    return [pickFrom(firstNames), pickFrom(cities), amount.toFixed(2), formatDate(Math.floor(nextRandom() * 700))].map((cellText) =>
      slideTableCell(cellText, { fill }),
    )
  })
  const totalCells = [
    slideTableCell('Total (merged across three columns)', { bold: true, fill: 'D9E2F3', columnSpan: 3 }),
    slideTableCell('', { fill: 'D9E2F3', mergedIntoPrevious: true }),
    slideTableCell('', { fill: 'D9E2F3', mergedIntoPrevious: true }),
    slideTableCell(amounts.reduce((sum, amount) => sum + amount, 0).toFixed(2), { bold: true, fill: 'D9E2F3' }),
  ]
  const columnWidth = inchesToEmu(box[2] / 4)
  const rows = [headerCells, ...dataRows, totalCells].map((cells) => `<a:tr h="${inchesToEmu(0.45)}">${cells.join('')}</a:tr>`).join('')
  return (
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm>${shapePosition(box)}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
    `<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${`<a:gridCol w="${columnWidth}"/>`.repeat(4)}</a:tblGrid>${rows}</a:tbl>` +
    '</a:graphicData></a:graphic></p:graphicFrame>'
  )
}

// Shows the shape on click; with fade it also fades in over half a second.
function clickEntranceAnimation(firstTimeNodeId, shapeId, fade) {
  const [groupId, stepId, effectId, showId, fadeId] = [0, 1, 2, 3, 4].map((offset) => firstTimeNodeId + offset)
  const target = `<p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl>`
  const showShape =
    `<p:set><p:cBhvr><p:cTn id="${showId}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${target}` +
    '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
  const fadeIn = fade ? `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${fadeId}" dur="500"/>${target}</p:cBhvr></p:animEffect>` : ''
  return (
    `<p:par><p:cTn id="${groupId}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="${stepId}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="${effectId}" presetID="${fade ? 10 : 1}" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${showShape}${fadeIn}</p:childTnLst></p:cTn></p:par>` +
    '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  )
}

function slideAnimationTiming(animations) {
  const effects = animations.map(({ shapeId, fade }, index) => clickEntranceAnimation(3 + index * 5, shapeId, fade)).join('')
  const builds = animations.map(({ shapeId }) => `<p:bldP spid="${shapeId}" grpId="0" animBg="1"/>`).join('')
  return (
    '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${effects}</p:childTnLst></p:cTn>` +
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
    '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>' +
    `</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${builds}</p:bldLst></p:timing>`
  )
}

// SmartArt: the data model holds the text; drawing1.xml holds the shapes PowerPoint last drew, which most viewers render.
const smartArtModelId = (number) => `{6F1A2B3C-0000-4000-8000-${String(number).padStart(12, '0')}}`
const SMARTART_STEPS = ['Choose a file', 'Read it in the browser', 'Edit and save']

function smartArtFrame(id, box) {
  return (
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="SmartArt process ${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm>${shapePosition(box)}</p:xfrm><a:graphic><a:graphicData uri="${SMARTART_NAMESPACE}">` +
    `<dgm:relIds xmlns:dgm="${SMARTART_NAMESPACE}" r:dm="rIdDiagramData" r:lo="rIdDiagramLayout" r:qs="rIdDiagramStyle" r:cs="rIdDiagramColors"/>` +
    '</a:graphicData></a:graphic></p:graphicFrame>'
  )
}

function buildSmartArtData() {
  const textBody = (text) =>
    `<dgm:t><a:bodyPr/><a:lstStyle/><a:p>${text ? `<a:r><a:rPr lang="en-US"/><a:t>${escapeXml(text)}</a:t></a:r>` : '<a:endParaRPr lang="en-US"/>'}</a:p></dgm:t>`
  const documentPoint =
    `<dgm:pt modelId="${smartArtModelId(0)}" type="doc"><dgm:prSet loTypeId="urn:microsoft.com/office/officeart/2005/8/layout/process1" loCatId="process" ` +
    'qsTypeId="urn:microsoft.com/office/officeart/2005/8/quickstyle/simple1" qsCatId="simple" ' +
    `csTypeId="urn:microsoft.com/office/officeart/2005/8/colors/accent1_2" csCatId="accent1"/><dgm:spPr/>${textBody('')}</dgm:pt>`
  const stepPoints = SMARTART_STEPS.map((step, index) => {
    const connectionId = smartArtModelId(31 + index)
    return (
      `<dgm:pt modelId="${smartArtModelId(1 + index)}"><dgm:prSet phldrT="[Text]"/><dgm:spPr/>${textBody(step)}</dgm:pt>` +
      `<dgm:pt modelId="${smartArtModelId(11 + index)}" type="parTrans" cxnId="${connectionId}"><dgm:prSet/><dgm:spPr/>${textBody('')}</dgm:pt>` +
      `<dgm:pt modelId="${smartArtModelId(21 + index)}" type="sibTrans" cxnId="${connectionId}"><dgm:prSet/><dgm:spPr/>${textBody('')}</dgm:pt>`
    )
  })
  const connections = SMARTART_STEPS.map(
    (step, index) =>
      `<dgm:cxn modelId="${smartArtModelId(31 + index)}" srcId="${smartArtModelId(0)}" destId="${smartArtModelId(1 + index)}" ` +
      `srcOrd="${index}" destOrd="0" parTransId="${smartArtModelId(11 + index)}" sibTransId="${smartArtModelId(21 + index)}"/>`,
  )
  return (
    `${xmlDeclaration}<dgm:dataModel xmlns:dgm="${SMARTART_NAMESPACE}" ${PRESENTATION_NAMESPACES}>` +
    `<dgm:ptLst>${documentPoint}${stepPoints.join('')}</dgm:ptLst><dgm:cxnLst>${connections.join('')}</dgm:cxnLst><dgm:bg/><dgm:whole/>` +
    `<dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram"><dsp:dataModelExt xmlns:dsp="${SMARTART_DRAWING_NAMESPACE}" ` +
    `relId="rIdDiagramDrawing" minVer="${SMARTART_NAMESPACE}"/></a:ext></dgm:extLst></dgm:dataModel>`
  )
}

function buildSmartArtDrawing() {
  const drawingShape = (modelId, geometry, box, text) =>
    `<dsp:sp modelId="${modelId}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr>` +
    `<dsp:spPr><a:xfrm>${shapePosition(box)}</a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln w="12700"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln></dsp:spPr>` +
    `<dsp:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/>` +
    (text ? `<a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>` : '<a:endParaRPr lang="en-US"/>') +
    `</a:p></dsp:txBody><dsp:txXfrm>${shapePosition(box)}</dsp:txXfrm></dsp:sp>`
  const shapes = SMARTART_STEPS.flatMap((step, index) => {
    const stepShape = drawingShape(smartArtModelId(1 + index), 'roundRect', [index * 3.7, 0.7, 2.6, 1.6], step)
    const isLastStep = index === SMARTART_STEPS.length - 1
    return isLastStep ? [stepShape] : [stepShape, drawingShape(smartArtModelId(21 + index), 'rightArrow', [index * 3.7 + 2.85, 1.2, 0.6, 0.6], '')]
  })
  return (
    `${xmlDeclaration}<dsp:drawing xmlns:dgm="${SMARTART_NAMESPACE}" xmlns:dsp="${SMARTART_DRAWING_NAMESPACE}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>${shapes.join('')}</dsp:spTree></dsp:drawing>`
  )
}

const SMARTART_LAYOUT_XML =
  `${xmlDeclaration}<dgm:layoutDef xmlns:dgm="${SMARTART_NAMESPACE}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
  'uniqueId="urn:microsoft.com/office/officeart/2005/8/layout/process1"><dgm:title val=""/><dgm:desc val=""/>' +
  '<dgm:catLst><dgm:cat type="process" pri="1000"/></dgm:catLst><dgm:layoutNode name="Name0"/></dgm:layoutDef>'

const SMARTART_STYLE_XML =
  `${xmlDeclaration}<dgm:styleDef xmlns:dgm="${SMARTART_NAMESPACE}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
  'uniqueId="urn:microsoft.com/office/officeart/2005/8/quickstyle/simple1"><dgm:title val=""/><dgm:desc val=""/>' +
  '<dgm:catLst><dgm:cat type="simple" pri="10100"/></dgm:catLst>' +
  '<dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d>' +
  '<dgm:styleLbl name="node1"><dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d><dgm:sp3d/><dgm:txPr/>' +
  '<dgm:style><a:lnRef idx="2"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef>' +
  '<a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></dgm:style></dgm:styleLbl></dgm:styleDef>'

const SMARTART_COLORS_XML =
  `${xmlDeclaration}<dgm:colorsDef xmlns:dgm="${SMARTART_NAMESPACE}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
  'uniqueId="urn:microsoft.com/office/officeart/2005/8/colors/accent1_2"><dgm:title val=""/><dgm:desc val=""/>' +
  '<dgm:catLst><dgm:cat type="accent1" pri="11200"/></dgm:catLst><dgm:styleLbl name="node1">' +
  '<dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"/></dgm:fillClrLst><dgm:linClrLst meth="repeat"><a:schemeClr val="lt1"/></dgm:linClrLst>' +
  '<dgm:effectClrLst/><dgm:txLinClrLst/><dgm:txFillClrLst meth="repeat"><a:schemeClr val="lt1"/></dgm:txFillClrLst><dgm:txEffectClrLst/></dgm:styleLbl></dgm:colorsDef>'

const themeColor = (name, color) => `<a:${name}><a:srgbClr val="${color}"/></a:${name}>`
const PRESENTATION_THEME_XML =
  `${xmlDeclaration}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements>` +
  '<a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
  [
    ['dk2', '44546A'],
    ['lt2', 'E7E6E6'],
    ['accent1', '4472C4'],
    ['accent2', 'ED7D31'],
    ['accent3', 'A5A5A5'],
    ['accent4', 'FFC000'],
    ['accent5', '5B9BD5'],
    ['accent6', '70AD47'],
    ['hlink', '0563C1'],
    ['folHlink', '954F72'],
  ]
    .map(([name, color]) => themeColor(name, color))
    .join('') +
  '</a:clrScheme><a:fontScheme name="Office">' +
  '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="Office">' +
  `<a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst>` +
  `<a:lnStyleLst>${'<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst>` +
  `<a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst>` +
  `<a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst>` +
  '</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'

const SLIDE_MASTER_XML =
  `${xmlDeclaration}<p:sldMaster ${PRESENTATION_NAMESPACES}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>` +
  `<p:spTree>${SHAPE_TREE_HEADER}</p:spTree></p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout"/></p:sldLayoutIdLst></p:sldMaster>'

const SLIDE_LAYOUT_XML =
  `${xmlDeclaration}<p:sldLayout ${PRESENTATION_NAMESPACES} type="blank" preserve="1"><p:cSld name="Blank">` +
  `<p:spTree>${SHAPE_TREE_HEADER}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`

// slides: [{ shapes, transition, timing, relationships }]; extraParts: [{ path, contents, contentType }].
function buildPptx(slides, extraParts) {
  const relationshipsXml = (relationshipsXmlInside) =>
    `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipsXmlInside}</Relationships>`
  const slideNumbers = slides.map((slide, index) => index + 1)
  const contentTypeOverride = (partName, type) => `<Override PartName="${partName}" ContentType="${type}"/>`

  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `${xmlDeclaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
      contentTypeOverride('/ppt/presentation.xml', presentationContentType('presentationml.presentation.main')) +
      contentTypeOverride('/ppt/slideMasters/slideMaster1.xml', presentationContentType('presentationml.slideMaster')) +
      contentTypeOverride('/ppt/slideLayouts/slideLayout1.xml', presentationContentType('presentationml.slideLayout')) +
      contentTypeOverride('/ppt/theme/theme1.xml', presentationContentType('theme')) +
      slideNumbers.map((number) => contentTypeOverride(`/ppt/slides/slide${number}.xml`, presentationContentType('presentationml.slide'))).join('') +
      extraParts
        .filter((part) => part.contentType)
        .map((part) => contentTypeOverride(`/${part.path}`, part.contentType))
        .join('') +
      '</Types>',
  )
  zip.file('_rels/.rels', relationshipsXml(relationship('rIdPresentation', 'officeDocument', 'ppt/presentation.xml')))
  zip.file(
    'ppt/presentation.xml',
    `${xmlDeclaration}<p:presentation ${PRESENTATION_NAMESPACES}>` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>' +
      `<p:sldIdLst>${slideNumbers.map((number) => `<p:sldId id="${255 + number}" r:id="rIdSlide${number}"/>`).join('')}</p:sldIdLst>` +
      `<p:sldSz cx="${inchesToEmu(13.333)}" cy="${inchesToEmu(7.5)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    relationshipsXml(
      relationship('rIdMaster', 'slideMaster', 'slideMasters/slideMaster1.xml') +
        relationship('rIdTheme', 'theme', 'theme/theme1.xml') +
        slideNumbers.map((number) => relationship(`rIdSlide${number}`, 'slide', `slides/slide${number}.xml`)).join(''),
    ),
  )
  zip.file('ppt/theme/theme1.xml', PRESENTATION_THEME_XML)
  zip.file('ppt/slideMasters/slideMaster1.xml', SLIDE_MASTER_XML)
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    relationshipsXml(relationship('rIdLayout', 'slideLayout', '../slideLayouts/slideLayout1.xml') + relationship('rIdTheme', 'theme', '../theme/theme1.xml')),
  )
  zip.file('ppt/slideLayouts/slideLayout1.xml', SLIDE_LAYOUT_XML)
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', relationshipsXml(relationship('rIdMaster', 'slideMaster', '../slideMasters/slideMaster1.xml')))
  slides.forEach((slide, index) => {
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      `${xmlDeclaration}<p:sld ${PRESENTATION_NAMESPACES}><p:cSld><p:spTree>${SHAPE_TREE_HEADER}${slide.shapes}</p:spTree></p:cSld>` +
        `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${slide.transition ?? ''}${slide.timing ?? ''}</p:sld>`,
    )
    zip.file(
      `ppt/slides/_rels/slide${index + 1}.xml.rels`,
      relationshipsXml(relationship('rIdLayout', 'slideLayout', '../slideLayouts/slideLayout1.xml') + (slide.relationships ?? '')),
    )
  })
  extraParts.forEach((part) => zip.file(part.path, part.contents))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

const logoPart = { path: 'ppt/media/image1.png', contents: readFileSync(new URL('../public/logo.png', import.meta.url)) }
const imageRelationship = relationship('rIdImage', 'image', '../media/image1.png')

const richSlides = [
  {
    shapes:
      slideShape(2, 'rect', [0.8, 2.2, 8, 1.4], { text: 'Quarterly review (synthetic sample)', fontSize: 4400, bold: true, textColor: '1F3864', align: 'l' }) +
      slideShape(3, 'rect', [0.8, 3.6, 8, 0.8], { text: 'A test deck with images, a table and basic shapes', fontSize: 2000, textColor: '595959', align: 'l' }) +
      slidePicture(4, [9.6, 1.9, 2.8, 2.8]),
    relationships: imageRelationship,
  },
  {
    shapes:
      slideTitle(2, 'Basic shapes') +
      slideShape(3, 'rect', [0.8, 1.8, 2.4, 1.4], { fill: '4472C4', text: 'Rectangle' }) +
      slideShape(4, 'roundRect', [3.8, 1.8, 2.4, 1.4], { fill: 'ED7D31', text: 'Rounded' }) +
      slideShape(5, 'ellipse', [6.8, 1.8, 2.4, 1.4], { fill: '70AD47', text: 'Ellipse' }) +
      slideShape(6, 'triangle', [9.8, 1.6, 2.4, 1.8], { fill: 'FFC000', text: 'Triangle', textColor: '1F1F1F' }) +
      slideShape(7, 'rightArrow', [0.8, 4.4, 2.8, 1.2], { fill: '5B9BD5', text: 'Arrow' }) +
      slideShape(8, 'star5', [4.2, 4.0, 2.0, 2.0], { fill: 'FFD966', text: 'Star', textColor: '1F1F1F' }) +
      slideShape(9, 'hexagon', [6.8, 4.2, 2.4, 1.6], { fill: 'A5A5A5', text: 'Hexagon' }) +
      slideArrowLine(10, [9.8, 4.4, 2.4, 1.2]),
  },
  {
    shapes: slideTitle(2, 'Table with a merged total row') + slideTable(3, [0.8, 1.6, 11.7, 3.15]),
  },
  {
    shapes:
      slideTitle(2, 'Images: plain, scaled, rotated and cropped') +
      slidePicture(3, [0.8, 2.0, 2.6, 2.6]) +
      slidePicture(4, [3.9, 2.6, 1.4, 1.4]) +
      slidePicture(5, [6.0, 2.0, 2.6, 2.6], { rotation: 20 }) +
      slidePicture(6, [9.4, 2.0, 2.6, 2.6], { cropPercent: 20 }),
    relationships: imageRelationship,
  },
]

const animatedSlides = [
  {
    shapes:
      slideTitle(2, 'Animations and transitions') +
      slideShape(3, 'roundRect', [1.5, 2.4, 4.5, 2], { fill: '4472C4', text: 'Click 1: appears', fontSize: 2400 }) +
      slideShape(4, 'roundRect', [7.3, 2.4, 4.5, 2], { fill: 'ED7D31', text: 'Click 2: fades in', fontSize: 2400 }),
    transition: '<p:transition spd="med"><p:fade/></p:transition>',
    timing: slideAnimationTiming([
      { shapeId: 3, fade: false },
      { shapeId: 4, fade: true },
    ]),
  },
  {
    shapes: slideTitle(2, 'SmartArt: a three-step process') + smartArtFrame(3, [1.65, 2.0, 10, 3]),
    transition: '<p:transition spd="med"><p:push dir="u"/></p:transition>',
    relationships:
      relationship('rIdDiagramData', 'diagramData', '../diagrams/data1.xml') +
      relationship('rIdDiagramLayout', 'diagramLayout', '../diagrams/layout1.xml') +
      relationship('rIdDiagramStyle', 'diagramQuickStyle', '../diagrams/quickStyle1.xml') +
      relationship('rIdDiagramColors', 'diagramColors', '../diagrams/colors1.xml') +
      '<Relationship Id="rIdDiagramDrawing" Type="http://schemas.microsoft.com/office/2007/relationships/diagramDrawing" Target="../diagrams/drawing1.xml"/>',
  },
]

const smartArtParts = [
  { path: 'ppt/diagrams/data1.xml', contents: buildSmartArtData(), contentType: presentationContentType('drawingml.diagramData') },
  { path: 'ppt/diagrams/layout1.xml', contents: SMARTART_LAYOUT_XML, contentType: presentationContentType('drawingml.diagramLayout') },
  { path: 'ppt/diagrams/quickStyle1.xml', contents: SMARTART_STYLE_XML, contentType: presentationContentType('drawingml.diagramStyle') },
  { path: 'ppt/diagrams/colors1.xml', contents: SMARTART_COLORS_XML, contentType: presentationContentType('drawingml.diagramColors') },
  { path: 'ppt/diagrams/drawing1.xml', contents: buildSmartArtDrawing(), contentType: 'application/vnd.ms-office.drawingml.diagramDrawing+xml' },
]

writeTestFile('powerpoint-rich.pptx', await buildPptx(richSlides, [logoPart]))
writeTestFile('powerpoint-animated.pptx', await buildPptx(animatedSlides, smartArtParts))

// ---- Sample files for the tool pages (src/samples/, bundled with the site; synthetic data only) ----
// Written after every test file so the seeded random numbers above, and so the test files, stay the same.

const sampleDirectory = new URL('../src/samples/', import.meta.url)
mkdirSync(sampleDirectory, { recursive: true })
const writeSampleFile = (fileName, contents) => writeFileSync(new URL(fileName, sampleDirectory), contents)

function buildWorkbookBuffer(sheets, { rightToLeft = false, bookType = 'xlsx' } = {}) {
  const workbook = XLSX.utils.book_new()
  for (const { name, rows, formulas = {} } of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    // Each formula keeps its result too, as Excel saves it, so converters and viewers that don't calculate still show the number.
    for (const [address, [formula, value]] of Object.entries(formulas)) worksheet[address] = { t: 'n', f: formula, v: value }
    XLSX.utils.book_append_sheet(workbook, worksheet, name)
  }
  if (rightToLeft) workbook.Workbook = { Views: [{ RTL: true }] }
  return XLSX.write(workbook, { type: 'buffer', bookType, compression: true })
}

const salesRows = [['Month', 'Product', 'Units', 'Price', 'Revenue']]
const salesFormulas = {}
const products = ['Notebook', 'Desk lamp', 'Backpack', 'Water bottle']
for (let row = 2; row <= 13; row++) {
  const units = 20 + Math.floor(nextRandom() * 80)
  const price = Number((5 + nextRandom() * 45).toFixed(2))
  salesRows.push([`2026-${String(row - 1).padStart(2, '0')}`, pickFrom(products), units, price])
  salesFormulas[`E${row}`] = [`C${row}*D${row}`, Number((units * price).toFixed(2))]
}
const salesColumn = (columnIndex) => salesRows.slice(1).map((row) => row[columnIndex])
const sumOf = (numbers) => Number(numbers.reduce((total, number) => total + number, 0).toFixed(2))
writeSampleFile(
  'sales-three-sheets.xlsx',
  buildWorkbookBuffer([
    { name: 'Sales', rows: salesRows, formulas: salesFormulas },
    { name: 'Customers', rows: [['Name', 'City', 'Email'], ...firstNames.slice(0, 8).map((name, index) => [`${name} ${lastNames[index]}`, cities[index], `${name}.${lastNames[index]}@example.com`.toLowerCase()])] },
    { name: 'Summary', rows: [['Measure', 'Value'], ['Total units'], ['Total revenue'], ['Average price']], formulas: { B2: ['SUM(Sales!C2:C13)', sumOf(salesColumn(2))], B3: ['SUM(Sales!E2:E13)', sumOf(Object.values(salesFormulas).map(([, value]) => value))], B4: ['AVERAGE(Sales!D2:D13)', Number((sumOf(salesColumn(3)) / 12).toFixed(2))] } },
  ]),
)
writeSampleFile('arabic-branches.xlsx', buildWorkbookBuffer([{ name: 'الفروع', rows: buildArabicRows(15) }], { rightToLeft: true }))
writeSampleFile('budget-1997.xls', buildWorkbookBuffer([{ name: 'Budget', rows: [['Item', 'Q1', 'Q2', 'Q3', 'Q4'], ['Rent', 1200, 1200, 1200, 1200], ['Travel', 300, 450, 200, 600], ['Supplies', 150, 120, 180, 90]] }], { bookType: 'biff8' }))
writeSampleFile(
  'stock-two-sheets.xls',
  buildWorkbookBuffer(
    [
      { name: 'Stock', rows: [['Product', 'In stock', 'Reorder at'], ...products.map((product) => [product, Math.floor(nextRandom() * 200), 25])] },
      { name: 'Suppliers', rows: [['Supplier', 'Country'], ['Northwind Paper (sample)', 'Portugal'], ['Bright Lamps (sample)', 'Austria']] },
    ],
    { bookType: 'biff8' },
  ),
)

// Synthetic people for Mask data: example.com addresses, a published example IBAN, test card numbers, IDs made of a pattern.
function makePatternId(firstDigits) {
  const isLuhnValid = (digits) => [...digits].reverse().reduce((sum, digit, position) => sum + (position % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][digit] : Number(digit)), 0) % 10 === 0
  for (let checkDigit = 0; checkDigit <= 9; checkDigit++) if (isLuhnValid(`${firstDigits}${checkDigit}`)) return `${firstDigits}${checkDigit}`
}
writeSampleFile(
  'people-two-sheets.xlsx',
  buildWorkbookBuffer([
    { name: 'Customers', rows: [['Full name', 'Email', 'Mobile', 'National ID', 'IBAN'], ['Sara Example', 'sara@example.com', '+966500000001', makePatternId('100000000'), 'GB82WEST12345698765432'], ['Omar Sample', 'omar@example.org', '+966500000002', makePatternId('200000000'), 'GB82WEST12345698765432'], ['Lina Demo', 'lina@example.net', '+966500000003', makePatternId('100000001'), 'GB82WEST12345698765432']] },
    { name: 'Staff', rows: [['Employee name', 'Work email', 'Phone', 'Team'], ['Hugo Test', 'hugo@example.com', '+966500000004', 'Sales'], ['Ines Placeholder', 'ines@example.com', '+966500000005', 'Support']] },
  ]),
)

writeSampleFile('quarterly-summary.docx', await buildDocx(englishWordText, false))
writeSampleFile('arabic-summary.docx', await buildDocx(arabicWordText, true))
writeSampleFile('quarterly-review-3-slides.pptx', await buildPptx(richSlides.slice(0, 3), [logoPart]))
const arabicSlideText = (id, box, text, options) => slideShape(id, 'rect', box, { textColor: '1F1F1F', align: 'r', ...options, text })
writeSampleFile(
  'arabic-review-3-slides.pptx',
  await buildPptx(
    [
      { shapes: arabicSlideText(2, [4.5, 2.2, 8, 1.4], 'مراجعة ربع سنوية (عينة اصطناعية)', { fontSize: 4400, bold: true, textColor: '1F3864' }) + arabicSlideText(3, [4.5, 3.6, 8, 0.8], 'عرض تجريبي من ثلاث شرائح', { fontSize: 2000, textColor: '595959' }) },
      { shapes: arabicSlideText(2, [0.8, 0.5, 11.7, 1], 'أبرز النتائج', { fontSize: 3200, bold: true }) + slideShape(3, 'roundRect', [7.8, 2, 4.7, 1.4], { fill: '4472C4', text: 'نمو المبيعات ١٢٪', fontSize: 2400 }) + slideShape(4, 'roundRect', [0.8, 2, 4.7, 1.4], { fill: '70AD47', text: 'عملاء جدد: ٣٤٠', fontSize: 2400 }) },
      { shapes: arabicSlideText(2, [0.8, 0.5, 11.7, 1], 'الخطوات التالية', { fontSize: 3200, bold: true }) + arabicSlideText(3, [0.8, 1.8, 11.7, 3], 'مراجعة الأرقام، ثم مشاركة الملخص مع الفريق', { fontSize: 2400 }) },
    ],
    [],
  ),
)

console.log(`Wrote test files to ${outputDirectory.pathname} and sample files to ${sampleDirectory.pathname}`)

// The PDF tools' samples (Merge PDF, Add page numbers): plain A4 pages of made-up text, with fixed dates so every run writes the
// same bytes.
async function buildSamplePdf(title, pageTexts) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreationDate(new Date('2026-11-01T00:00:00Z'))
  pdf.setModificationDate(new Date('2026-11-01T00:00:00Z'))
  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)
  pageTexts.forEach(([heading, ...lines]) => {
    const page = pdf.addPage([595, 842])
    page.drawText(heading, { x: 60, y: 760, size: 22, font: headingFont, color: rgb(0.1, 0.1, 0.15) })
    lines.forEach((line, index) => page.drawText(line, { x: 60, y: 720 - index * 22, size: 12, font: bodyFont, color: rgb(0.2, 0.2, 0.25) }))
  })
  return pdf.save()
}
writeSampleFile(
  'report-3-pages.pdf',
  await buildSamplePdf('Quarterly report (synthetic sample)', [
    ['Quarterly report', 'A synthetic sample for OpenAnyDoc.', 'Sales grew in every region this quarter.', 'Page 1 of the report: summary.'],
    ['Sales by region', 'North: 1,240 units', 'South: 980 units', 'West: 1,105 units'],
    ['Next steps', 'Open two more shops in the spring.', 'Review the price list in March.', 'Contact: team@example.com'],
  ]),
)
writeSampleFile(
  'letter-2-pages.pdf',
  await buildSamplePdf('Letter (synthetic sample)', [
    ['Dear customer,', 'Thank you for your order of 12 notebooks.', 'Your parcel leaves our warehouse on Monday.', 'The invoice is on the next page.'],
    ['Invoice 2026-118', '12 x Notebook, A5     58.80', 'Shipping               4.90', 'Total                 63.70'],
  ]),
)
// Compare PDF's samples: two versions of a made-up contract (a changed fee, a new clause, a removed line).
writeSampleFile(
  'contract-v1.pdf',
  await buildSamplePdf('Service contract, version 1 (synthetic sample)', [
    ['Service contract', 'Between Example Studio and Example Shop.', 'Start date: 1 December 2026.', 'Monthly fee: 400.00', 'Either side may end it with 30 days notice.'],
    ['Terms', 'Work is delivered every Friday.', 'Invoices are paid within 14 days.', 'Contact: studio@example.com'],
  ]),
)
writeSampleFile(
  'contract-v2.pdf',
  await buildSamplePdf('Service contract, version 2 (synthetic sample)', [
    ['Service contract', 'Between Example Studio and Example Shop.', 'Start date: 1 December 2026.', 'Monthly fee: 450.00', 'Either side may end it with 60 days notice.'],
    ['Terms', 'Work is delivered every Friday.', 'Invoices are paid within 30 days.', 'Weekend support is not included.'],
  ]),
)
// PDF to Excel's sample: a table of made-up sales, with a heading, column headings and numbers right-aligned in columns.
{
  const tablePdf = await PDFDocument.create()
  tablePdf.setTitle('Sales by region (synthetic sample)')
  tablePdf.setCreationDate(new Date('2026-11-01T00:00:00Z'))
  tablePdf.setModificationDate(new Date('2026-11-01T00:00:00Z'))
  const headingFont = await tablePdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await tablePdf.embedFont(StandardFonts.Helvetica)
  const page = tablePdf.addPage([595, 842])
  page.drawText('Sales by region, 2026', { x: 60, y: 760, size: 20, font: headingFont })
  const rows = [['Region', 'Q1', 'Q2', 'Q3', 'Q4'], ['North', '1,240', '1,380', '1,410', '1,520'], ['South', '980', '1,105', '1,060', '1,190'], ['West', '1,105', '1,240', '1,300', '1,355'], ['East', '870', '910', '1,020', '1,095'], ['Total', '4,195', '4,635', '4,790', '5,160']]
  rows.forEach((cells, rowIndex) => {
    const font = rowIndex === 0 || rowIndex === rows.length - 1 ? headingFont : bodyFont
    cells.forEach((text, columnIndex) => {
      const width = font.widthOfTextAtSize(text, 12)
      page.drawText(text, { x: columnIndex === 0 ? 60 : 200 + columnIndex * 80 - width, y: 710 - rowIndex * 24, size: 12, font })
    })
  })
  writeSampleFile('sales-table.pdf', await tablePdf.save())
}
// PDF Forms' sample: a form printed as text and lines only, with no fields yet.
writeSampleFile(
  'blank-form-layout.pdf',
  await buildSamplePdf('Workshop registration, no fields (synthetic sample)', [
    ['Workshop registration', 'Full name:  ________________________________', 'Email:  ____________________________________', 'Date of birth:  ______________', 'Workshop:  [ Morning ]  [ Afternoon ]', 'I agree to the terms  [   ]', 'Signature:  ________________________'],
  ]),
)
// Unlock PDF's samples, locked by qpdf (the library the tool uses): the report with a password to open ("openanydoc", shown on the
// sample button) and the letter with printing and copying locked but no password to open. AES-128 with qpdf's fixed id and IV, so
// every run writes the same bytes (AES-256 salts its keys at random).
{
  const createQpdf = createRequire(import.meta.url)('@neslinesli93/qpdf-wasm')
  const qpdfWasmPath = new URL('../node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm', import.meta.url).pathname
  const lockWithQpdf = async (inputName, outputName, encryptArguments) => {
    const qpdf = await createQpdf({ locateFile: () => qpdfWasmPath })
    qpdf.FS.writeFile('/input.pdf', readFileSync(new URL(inputName, sampleDirectory)))
    const exitCode = qpdf.callMain(['--static-id', '--static-aes-iv', '--encrypt', ...encryptArguments, '--', '/input.pdf', '/output.pdf'])
    if (exitCode !== 0) throw new Error(`qpdf could not lock ${inputName}`)
    writeSampleFile(outputName, qpdf.FS.readFile('/output.pdf'))
  }
  // qpdf's positional form (user password, owner password, key length), the only one that takes an empty password to open.
  await lockWithQpdf('report-3-pages.pdf', 'report-locked.pdf', ['openanydoc', 'openanydoc-owner', '128', '--use-aes=y'])
  await lockWithQpdf('letter-2-pages.pdf', 'letter-no-printing.pdf', ['', 'openanydoc-owner', '128', '--use-aes=y', '--print=none', '--extract=n'])
}
// Repair PDF's sample: the report with a wrong cross-reference offset and its end cut off (no %%EOF), as after a broken download.
{
  const reportPdf = await PDFDocument.load(readFileSync(new URL('report-3-pages.pdf', sampleDirectory)), { updateMetadata: false })
  const reportText = Buffer.from(await reportPdf.save({ useObjectStreams: false })).toString('latin1')
  const damagedText = reportText.replace(/startxref\s+\d+/, 'startxref\n999999')
  writeSampleFile('damaged-report.pdf', Buffer.from(damagedText.slice(0, damagedText.lastIndexOf('%%EOF')), 'latin1'))
}

// ---------------------------------------------------------------- PDF and photo test files (macOS: Chrome, sips, cwebp, Swift)
// Long, scanned, Arabic, Urdu, password-protected and fillable-form PDFs, and synthetic photos as JPG, PNG, WebP and HEIC.
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const testFilePath = (fileName) => new URL(fileName, outputDirectory).pathname

function runChromeOnHtml(html, chromeArguments) {
  const htmlPath = join(tmpdir(), 'openanydoc-test-page.html')
  writeFileSync(htmlPath, html)
  execFileSync(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-pdf-header-footer', ...chromeArguments, `file://${htmlPath}`], { stdio: 'ignore' })
  rmSync(htmlPath)
}
const printHtmlToPdf = (html, fileName) => runChromeOnHtml(html, [`--print-to-pdf=${testFilePath(fileName)}`])
const screenshotHtml = (html, width, height, pngPath) => runChromeOnHtml(html, [`--screenshot=${pngPath}`, `--window-size=${width},${height}`])

const longPdf = await PDFDocument.create()
const longPdfHeadingFont = await longPdf.embedFont(StandardFonts.HelveticaBold)
const longPdfBodyFont = await longPdf.embedFont(StandardFonts.Helvetica)
for (let pageNumber = 1; pageNumber <= 300; pageNumber++) {
  const page = longPdf.addPage([595, 842])
  page.drawText(`Chapter ${Math.ceil(pageNumber / 10)}, page ${pageNumber}`, { x: 60, y: 770, size: 20, font: longPdfHeadingFont })
  for (let lineIndex = 0; lineIndex < 30; lineIndex++) {
    const line = `${pickFrom(firstNames)} ${pickFrom(lastNames)} shipped ${Math.floor(nextRandom() * 900) + 10} units to ${pickFrom(cities)} on line ${lineIndex + 1}.`
    page.drawText(line, { x: 60, y: 730 - lineIndex * 22, size: 11, font: longPdfBodyFont })
  }
}
writeFileSync(testFilePath('pdf-long-300-pages.pdf'), await longPdf.save())

const formPdf = await PDFDocument.create()
const formPdfFont = await formPdf.embedFont(StandardFonts.Helvetica)
const formPage = formPdf.addPage([595, 842])
const form = formPdf.getForm()
formPage.drawText('Membership form (synthetic)', { x: 60, y: 770, size: 20, font: formPdfFont })
const formLabels = ['Full name', 'Email', 'City', 'Plan', 'Contact by', 'Newsletter', 'Comments']
formLabels.forEach((label, index) => formPage.drawText(label, { x: 60, y: 715 - index * 50, size: 12, font: formPdfFont }))
form.createTextField('full-name').addToPage(formPage, { x: 180, y: 705, width: 300, height: 24 })
form.createTextField('email').addToPage(formPage, { x: 180, y: 655, width: 300, height: 24 })
form.createTextField('city').addToPage(formPage, { x: 180, y: 605, width: 300, height: 24 })
const planDropdown = form.createDropdown('plan')
planDropdown.addOptions(['Free', 'Team', 'Business'])
planDropdown.select('Free')
planDropdown.addToPage(formPage, { x: 180, y: 555, width: 150, height: 24 })
const contactRadioGroup = form.createRadioGroup('contact-by')
contactRadioGroup.addOptionToPage('email', formPage, { x: 180, y: 507, width: 16, height: 16 })
contactRadioGroup.addOptionToPage('phone', formPage, { x: 240, y: 507, width: 16, height: 16 })
formPage.drawText('Email        Phone', { x: 200, y: 510, size: 11, font: formPdfFont })
form.createCheckBox('newsletter').addToPage(formPage, { x: 180, y: 457, width: 16, height: 16 })
const commentsField = form.createTextField('comments')
commentsField.enableMultiline()
commentsField.addToPage(formPage, { x: 180, y: 340, width: 300, height: 100 })
const fillableFormBytes = await formPdf.save()
writeFileSync(testFilePath('pdf-fillable-form.pdf'), fillableFormBytes)

// PDFKit encrypts with AES; the open password is test1234.
const unprotectedPdfPath = join(tmpdir(), 'openanydoc-unprotected.pdf')
writeFileSync(unprotectedPdfPath, fillableFormBytes)
const encryptPdfSwift = `import PDFKit
let arguments = CommandLine.arguments
let document = PDFDocument(url: URL(fileURLWithPath: arguments[1]))!
let options: [PDFDocumentWriteOption: Any] = [.userPasswordOption: "test1234", .ownerPasswordOption: "owner-test1234"]
if !document.write(to: URL(fileURLWithPath: arguments[2]), withOptions: options) { exit(1) }`
execFileSync('swift', ['-', unprotectedPdfPath, testFilePath('pdf-password-test1234.pdf')], { input: encryptPdfSwift })
rmSync(unprotectedPdfPath)

const rightToLeftPageHtml = (language, fontFamily, heading, paragraphs, [regionWord, northWord, southWord]) => `<!doctype html><html lang="${language}" dir="rtl"><meta charset="utf-8">
<style>@page { size: A4; margin: 2cm } body { font-family: ${fontFamily}; font-size: 15pt; line-height: 2.1 } h1 { font-size: 24pt }
p { break-inside: avoid } table { border-collapse: collapse; width: 100% } td, th { border: 1px solid #888; padding: 4px 10px }</style>
<h1>${heading}</h1>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
<table><tr><th>${regionWord}</th><th>2025</th><th>2026</th></tr><tr><td>${northWord}</td><td>١٢٤٠</td><td>1,380</td></tr><tr><td>${southWord}</td><td>٩٨٠</td><td>1,105</td></tr></table></html>`
printHtmlToPdf(
  rightToLeftPageHtml('ar', '"Geeza Pro", serif', 'تقرير المبيعات الربع سنوي (عينة اصطناعية)', [
    'نمت المبيعات في جميع المناطق خلال هذا الربع، وارتفع عدد العملاء الجدد إلى ٣٤٠ عميلاً.',
    'يحتوي هذا الملف على نص عربي مع أرقام عربية وأرقام لاتينية مثل 2026 وكلمات إنجليزية مثل <bdi>OpenAnyDoc</bdi> داخل الجملة.',
    'الخطوات التالية: مراجعة قائمة الأسعار في شهر مارس، ثم مشاركة الملخص مع الفريق.',
  ], ['المنطقة', 'الشمال', 'الجنوب']),
  'pdf-arabic.pdf',
)
printHtmlToPdf(
  rightToLeftPageHtml('ur', '"Noto Nastaliq Urdu", serif', 'سہ ماہی فروخت کی رپورٹ (مصنوعی نمونہ)', [
    'اس سہ ماہی میں تمام علاقوں میں فروخت بڑھی، اور نئے گاہکوں کی تعداد ۳۴۰ ہو گئی۔',
    'یہ فائل اردو متن پر مشتمل ہے جس میں ٹ، ڈ، ڑ، ں اور ے جیسے حروف، اور 2026 جیسے لاطینی ہندسے شامل ہیں۔',
    'اگلے اقدامات: مارچ میں قیمتوں کی فہرست کا جائزہ لیں، پھر خلاصہ ٹیم کے ساتھ شیئر کریں۔',
  ], ['علاقہ', 'شمال', 'جنوب']),
  'pdf-urdu.pdf',
)

// A scanned letter: two page pictures (slightly tilted, greyish paper) and no text layer.
const scannedPdf = await PDFDocument.create()
for (const [pageNumber, tilt] of [[1, -0.8], [2, 0.6]]) {
  const scanPngPath = join(tmpdir(), `openanydoc-scan-${pageNumber}.png`)
  const scanJpgPath = join(tmpdir(), `openanydoc-scan-${pageNumber}.jpg`)
  screenshotHtml(
    `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#cfccc4"><div style="margin:30px;padding:90px;height:1600px;background:#f1eee6;transform:rotate(${tilt}deg);filter:blur(0.6px) contrast(1.1);font:28px/1.7 Georgia,serif;color:#333">
<h1 style="font-size:44px">Scanned letter, page ${pageNumber} of 2</h1><p>Dear customer,</p><p>This page is a picture of paper, made for testing. It has no text layer, so text search and copy find nothing until the page is read with OCR.</p>
<p>Invoice 2026-${117 + pageNumber}: 12 notebooks, total 63.70.</p><p>Kind regards,<br>The synthetic team</p></div></body>`,
    1240,
    1754,
    scanPngPath,
  )
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '60', scanPngPath, '--out', scanJpgPath], { stdio: 'ignore' })
  const scanImage = await scannedPdf.embedJpg(readFileSync(scanJpgPath))
  scannedPdf.addPage([595, 842]).drawImage(scanImage, { x: 0, y: 0, width: 595, height: 842 })
  rmSync(scanPngPath)
  rmSync(scanJpgPath)
}
writeFileSync(testFilePath('pdf-scanned-2-pages.pdf'), await scannedPdf.save())
// OCR PDF's samples: one scanned page each, English and Arabic, pictures of paper with no text layer (small enough to bundle).
for (const [fileName, direction, pageHtml] of [
  ['scanned-letter.pdf', 'ltr', '<h1 style="font-size:40px">Scanned letter</h1><p>Dear customer,</p><p>This page is a picture of paper, made for testing. Search and copy find nothing until it is read with OCR.</p><p>Invoice 2026-118: 12 notebooks, total 63.70.</p><p>Kind regards,<br>The synthetic team</p>'],
  ['scanned-arabic-notice.pdf', 'rtl', '<h1 style="font-size:40px">إشعار ممسوح ضوئيًا</h1><p>عزيزي العميل،</p><p>هذه الصفحة صورة لورقة، صُنعت للتجربة. لا يجد البحث والنسخ شيئًا حتى تُقرأ بالتعرّف الضوئي على النص.</p><p>الفاتورة رقم 118: اثنا عشر دفترًا، المجموع 63.70.</p><p>مع التحية،<br>فريق العينات</p>'],
]) {
  const samplePngPath = join(tmpdir(), 'openanydoc-ocr-sample.png')
  const sampleJpgPath = join(tmpdir(), 'openanydoc-ocr-sample.jpg')
  screenshotHtml(
    `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#cfccc4"><div dir="${direction}" style="margin:20px;padding:60px;height:1100px;background:#f1eee6;transform:rotate(-0.5deg);filter:blur(0.4px) contrast(1.1);font:24px/1.7 Georgia,'Geeza Pro',serif;color:#333">${pageHtml}</div></body>`,
    900,
    1273,
    samplePngPath,
  )
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', samplePngPath, '--out', sampleJpgPath], { stdio: 'ignore' })
  const samplePdf = await PDFDocument.create()
  samplePdf.setCreationDate(new Date('2026-11-01T00:00:00Z'))
  samplePdf.setModificationDate(new Date('2026-11-01T00:00:00Z'))
  samplePdf.addPage([595, 842]).drawImage(await samplePdf.embedJpg(readFileSync(sampleJpgPath)), { x: 0, y: 0, width: 595, height: 842 })
  writeSampleFile(fileName, await samplePdf.save())
  rmSync(samplePngPath)
  rmSync(sampleJpgPath)
}

// Synthetic photos: a landscape and a portrait scene, each saved as PNG, JPG, WebP and HEIC.
for (const [photoName, width, height] of [['photo-landscape', 1600, 1200], ['photo-portrait', 1200, 1600]]) {
  const photoPngPath = testFilePath(`${photoName}.png`)
  screenshotHtml(
    `<!doctype html><body style="margin:0;height:100vh;overflow:hidden;background:linear-gradient(#5b8fd6,#f3c9a0 62%,#3f7a3a 62%,#25502a)">
<div style="position:absolute;left:62%;top:30%;width:160px;height:160px;border-radius:50%;background:radial-gradient(#fff6c8,#ffb347)"></div>
<div style="position:absolute;left:-10%;top:52%;width:70%;height:40%;border-radius:50%;background:#4f8a45"></div>
<div style="position:absolute;left:40%;top:56%;width:80%;height:45%;border-radius:50%;background:#386b33"></div></body>`,
    width,
    height,
    photoPngPath,
  )
  execFileSync('sips', ['-s', 'format', 'jpeg', photoPngPath, '--out', testFilePath(`${photoName}.jpg`)], { stdio: 'ignore' })
  execFileSync('sips', ['-s', 'format', 'heic', photoPngPath, '--out', testFilePath(`${photoName}.heic`)], { stdio: 'ignore' })
  execFileSync('cwebp', ['-quiet', '-q', '80', photoPngPath, '-o', testFilePath(`${photoName}.webp`)])
}

// More photos for the picture tools: a large JPG with GPS data, an iPhone-style HEIC, a transparent PNG, an SVG and a transparent
// WebP. Made-up place and device: the GPS point is a public square, the camera a generic iPhone model name.

// An EXIF block (big-endian TIFF) with the camera, the date, and a GPS position in degrees, minutes and seconds.
function buildExifSegment({ make, model, dateTime, latitude, longitude, altitudeMeters }) {
  const entries = (tags) => tags.length
  const ifd0Tags = [
    [0x010f, 2, `${make}\0`],
    [0x0110, 2, `${model}\0`],
    [0x0112, 3, 1],
    [0x0132, 2, `${dateTime}\0`],
    [0x8825, 4, 0],
  ]
  const toRational = (value) => {
    const degrees = Math.floor(Math.abs(value))
    const minutesFull = (Math.abs(value) - degrees) * 60
    const minutes = Math.floor(minutesFull)
    const secondsHundredths = Math.round((minutesFull - minutes) * 60 * 100)
    return [[degrees, 1], [minutes, 1], [secondsHundredths, 100]]
  }
  const gpsTags = [
    [0x0000, 1, [2, 3, 0, 0]],
    [0x0001, 2, latitude >= 0 ? 'N\0' : 'S\0'],
    [0x0002, 5, toRational(latitude)],
    [0x0003, 2, longitude >= 0 ? 'E\0' : 'W\0'],
    [0x0004, 5, toRational(longitude)],
    [0x0005, 1, [0]],
    [0x0006, 5, [[Math.round(altitudeMeters * 10), 10]]],
  ]
  // Lay out: header (8) | IFD0 | IFD0 data | GPS IFD | GPS data.
  const ifdSize = (tags) => 2 + entries(tags) * 12 + 4
  const valueBytes = (type, value) => {
    if (type === 2) return Buffer.from(value, 'latin1')
    if (type === 1) return Buffer.from(value)
    if (type === 3) { const buffer = Buffer.alloc(2); buffer.writeUInt16BE(value); return buffer }
    if (type === 4) { const buffer = Buffer.alloc(4); buffer.writeUInt32BE(value); return buffer }
    const buffer = Buffer.alloc(value.length * 8)
    value.forEach(([numerator, denominator], index) => { buffer.writeUInt32BE(numerator, index * 8); buffer.writeUInt32BE(denominator, index * 8 + 4) })
    return buffer
  }
  const countOf = (type, value) => (type === 2 || type === 1 ? valueBytes(type, value).length : type === 5 ? value.length : 1)
  function writeIfd(tags, start, gpsOffset) {
    const head = Buffer.alloc(ifdSize(tags))
    head.writeUInt16BE(tags.length, 0)
    const extra = []
    let dataOffset = start + head.length
    tags.forEach(([tag, type, rawValue], index) => {
      const value = tag === 0x8825 ? gpsOffset : rawValue
      const bytes = valueBytes(type, value)
      const at = 2 + index * 12
      head.writeUInt16BE(tag, at)
      head.writeUInt16BE(type, at + 2)
      head.writeUInt32BE(countOf(type, value), at + 4)
      if (bytes.length <= 4) bytes.copy(head, at + 8)
      else {
        head.writeUInt32BE(dataOffset, at + 8)
        const padded = bytes.length % 2 ? Buffer.concat([bytes, Buffer.alloc(1)]) : bytes
        extra.push(padded)
        dataOffset += padded.length
      }
    })
    return Buffer.concat([head, ...extra])
  }
  const ifd0Length = writeIfd(ifd0Tags, 8, 0).length
  const tiff = Buffer.concat([Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]), writeIfd(ifd0Tags, 8, 8 + ifd0Length), writeIfd(gpsTags, 8 + ifd0Length, 0)])
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const segmentHeader = Buffer.alloc(4)
  segmentHeader.writeUInt16BE(0xffe1, 0)
  segmentHeader.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([segmentHeader, payload])
}

// The JPEG with its own APP0/APP1 segments replaced by the EXIF block above.
function withExif(jpegBytes, exifSegment) {
  let offset = 2
  while (jpegBytes[offset] === 0xff && (jpegBytes[offset + 1] === 0xe0 || jpegBytes[offset + 1] === 0xe1)) offset += 2 + jpegBytes.readUInt16BE(offset + 2)
  return Buffer.concat([jpegBytes.subarray(0, 2), exifSegment, jpegBytes.subarray(offset)])
}

const outdoorSceneHtml = `<!doctype html><body style="margin:0;height:100vh;overflow:hidden;background:linear-gradient(#4f86d4,#f2c79b 58%,#6b9b4f 58%,#2f5c27)">
<div style="position:absolute;left:68%;top:22%;width:8vw;height:8vw;border-radius:50%;background:radial-gradient(#fff7cf,#ffb347)"></div>
<div style="position:absolute;left:10%;top:40%;width:18%;height:20%;background:#d8c3a5;border-radius:6px 6px 0 0"></div>
<div style="position:absolute;left:12%;top:44%;width:4%;height:6%;background:#5d7fa8"></div><div style="position:absolute;left:20%;top:44%;width:4%;height:6%;background:#5d7fa8"></div>
<div style="position:absolute;left:-10%;top:55%;width:70%;height:45%;border-radius:50%;background:#4f8a45"></div>
<div style="position:absolute;left:45%;top:60%;width:75%;height:45%;border-radius:50%;background:#386b33"></div></body>`
const exifScene = { make: 'Apple', model: 'iPhone 15 Pro', dateTime: '2026:11:10 16:42:05', latitude: 24.6877, longitude: 46.7219, altitudeMeters: 612.4 }

// 1. A large JPG (6000 x 4000, about 24 megapixels) with GPS data.
const largePngPath = join(tmpdir(), 'openanydoc-large-photo.png')
// Fine grain like a camera sensor's, so the file is as heavy as a real 24-megapixel photo (a flat scene compresses to under 1 MB).
const sensorGrainScript = `<canvas id="grain" style="position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:overlay"></canvas><script>
const canvas = document.getElementById('grain'); canvas.width = innerWidth; canvas.height = innerHeight
const context = canvas.getContext('2d'); const pixels = context.createImageData(canvas.width, canvas.height)
let seed = 7; const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
for (let index = 0; index < pixels.data.length; index += 4) { const shade = 90 + next() * 76; pixels.data.set([shade, shade, shade, 120], index) }
context.putImageData(pixels, 0, 0)</script>`
screenshotHtml(outdoorSceneHtml.replace('</body>', `${sensorGrainScript}</body>`), 6000, 4000, largePngPath)
const largeJpgPath = join(tmpdir(), 'openanydoc-large-photo.jpg')
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', largePngPath, '--out', largeJpgPath], { stdio: 'ignore' })
writeFileSync(testFilePath('photo-large-gps.jpg'), withExif(readFileSync(largeJpgPath), buildExifSegment(exifScene)))
rmSync(largePngPath)
rmSync(largeJpgPath)

// 2. An iPhone-style HEIC: 4032 x 3024 like an iPhone's main camera, HEVC-encoded by macOS (the encoder iPhones use), with the
// iPhone EXIF and GPS above.
const iphonePngPath = join(tmpdir(), 'openanydoc-iphone-photo.png')
screenshotHtml(outdoorSceneHtml, 4032, 3024, iphonePngPath)
const iphoneJpgPath = join(tmpdir(), 'openanydoc-iphone-photo.jpg')
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', iphonePngPath, '--out', iphoneJpgPath], { stdio: 'ignore' })
writeFileSync(iphoneJpgPath, withExif(readFileSync(iphoneJpgPath), buildExifSegment(exifScene)))
execFileSync('sips', ['-s', 'format', 'heic', iphoneJpgPath, '--out', testFilePath('photo-iphone.heic')], { stdio: 'ignore' })
rmSync(iphonePngPath)
rmSync(iphoneJpgPath)

// 3. A transparent PNG (RGBA): a logo-like badge with soft edges on a fully see-through background, written directly.
function encodePng(width, height, pixelAt) {
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) rows.set(pixelAt(x, y), y * (width * 4 + 1) + 1 + x * 4)
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([length, body, checksum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
const badgeSize = 800
const transparentPng = encodePng(badgeSize, badgeSize, (x, y) => {
  const distance = Math.hypot(x - badgeSize / 2, y - badgeSize / 2)
  const ring = badgeSize * 0.42
  const alpha = Math.max(0, Math.min(1, ring - distance + 1))
  const isInnerSquare = Math.abs(x - badgeSize / 2) < badgeSize * 0.16 && Math.abs(y - badgeSize / 2) < badgeSize * 0.16
  return isInnerSquare ? [255, 255, 255, Math.round(alpha * 255)] : [47, 95, 208, Math.round(alpha * 230)]
})
writeFileSync(testFilePath('logo-transparent.png'), transparentPng)

// 4. An SVG with a viewBox, a gradient, text in English and Arabic, and a rotated shape (drawn by the browser).
writeFileSync(
  testFilePath('diagram.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f0ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#sky)"/>
  <rect x="140" y="220" width="300" height="180" rx="24" fill="#2f5fd0"/>
  <rect x="760" y="220" width="300" height="180" rx="24" fill="#1e8449"/>
  <path d="M440 310 H760" stroke="#1f1f1f" stroke-width="8" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#1f1f1f"/></marker></defs>
  <text x="290" y="320" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="40" text-anchor="middle">Upload</text>
  <text x="910" y="320" fill="#ffffff" font-family="Geeza Pro, Arial, sans-serif" font-size="40" text-anchor="middle">جهازك</text>
  <rect x="560" y="520" width="80" height="80" fill="#c0392b" transform="rotate(30 600 560)"/>
  <text x="600" y="720" fill="#1f1f1f" font-family="Helvetica, Arial, sans-serif" font-size="28" text-anchor="middle">Synthetic test diagram</text>
</svg>
`,
)

// 5. A WebP with transparency (lossy colour, lossless alpha), made from the transparent PNG.
execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '100', testFilePath('logo-transparent.png'), '-o', testFilePath('logo-transparent.webp')])
console.log('Wrote the extra photo test files (large GPS JPG, iPhone HEIC, transparent PNG, SVG, transparent WebP).')
console.log('Wrote the PDF and photo test files.')

// The PDF viewer's second sample: a bilingual Arabic and English guide drawn by Chrome, so the Arabic is shaped and the text can be
// selected and searched. The fonts are the site's own (IBM Plex Sans and IBM Plex Sans Arabic, SIL Open Font License), embedded in
// the page as data so Chrome embeds them in the PDF.
const embeddedFont = (packageName, fileName) => `data:font/woff2;base64,${readFileSync(new URL(`../node_modules/@fontsource/${packageName}/files/${fileName}`, import.meta.url)).toString('base64')}`
const guideFontFaces = [
  ['IBM Plex Sans', 'ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2', 400],
  ['IBM Plex Sans', 'ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2', 600],
  ['IBM Plex Sans Arabic', 'ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-400-normal.woff2', 400],
  ['IBM Plex Sans Arabic', 'ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-600-normal.woff2', 600],
]
  .map(([family, packageName, fileName, weight]) => `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url(${embeddedFont(packageName, fileName)}) format("woff2") }`)
  .join('\n')
const guideHtml = `<!doctype html><html lang="ar"><meta charset="utf-8"><title>Arabic and English guide (synthetic sample)</title>
<style>${guideFontFaces}
@page { size: A4; margin: 2cm } body { font-family: "IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif; font-size: 12pt; line-height: 1.7; color: #1f2328 }
h1 { font-size: 22pt; margin: 0 0 4pt } h2 { font-size: 15pt; margin: 18pt 0 6pt } section { break-after: page } section:last-child { break-after: auto }
.ar { direction: rtl; text-align: right; font-family: "IBM Plex Sans Arabic", "IBM Plex Sans", sans-serif; font-size: 13pt }
.en { direction: ltr } table { border-collapse: collapse; width: 100%; margin-top: 8pt } td, th { border: 1px solid #9aa0a6; padding: 4pt 8pt }
.note { color: #5b616e; font-size: 10pt }</style>
<section>
<div class="ar"><h1>دليل المستخدم (عينة اصطناعية)</h1><p>هذا ملف PDF تجريبي باللغتين العربية والإنجليزية، صُنع لتجربة عارض PDF في OpenAnyDoc. ابحث عن كلمة «المبيعات» أو حدّد هذه الفقرة لنسخها.</p>
<h2>ملخص الربع</h2><p>نمت المبيعات في جميع المناطق، وارتفع عدد العملاء الجدد إلى ٣٤٠ عميلًا. يحتوي السطر التالي على أرقام لاتينية مثل 2026 وكلمة <bdi>OpenAnyDoc</bdi> داخل الجملة.</p>
<table><tr><th>المنطقة</th><th>2025</th><th>2026</th></tr><tr><td>الشمال</td><td>١٢٤٠</td><td>1,380</td></tr><tr><td>الجنوب</td><td>٩٨٠</td><td>1,105</td></tr><tr><td>الغرب</td><td>١١٠٥</td><td>1,240</td></tr></table></div>
<p class="note en">A synthetic sample: the names and numbers are made up.</p>
</section>
<section class="en"><h1>User guide (synthetic sample)</h1><p>This two-page PDF is a made-up guide in Arabic and English for trying the OpenAnyDoc PDF viewer. Search for the word "sales", select this paragraph, or rotate the page.</p>
<h2>Quarter summary</h2><p>Sales grew in every region, and new customers rose to 340. The table repeats the figures from the Arabic page.</p>
<table><tr><th>Region</th><th>2025</th><th>2026</th></tr><tr><td>North</td><td>1,240</td><td>1,380</td></tr><tr><td>South</td><td>980</td><td>1,105</td></tr><tr><td>West</td><td>1,105</td><td>1,240</td></tr></table>
<h2 class="ar">الخطوات التالية</h2><p class="ar">مراجعة قائمة الأسعار في شهر مارس، ثم مشاركة الملخص مع الفريق.</p></section></html>`
runChromeOnHtml(guideHtml, [`--print-to-pdf=${new URL('arabic-english-guide.pdf', sampleDirectory).pathname}`])
console.log('Wrote the PDF viewer sample arabic-english-guide.pdf.')

// The JPG to PDF page's two samples: a landscape photo (JPG) and a bar chart (PNG), small enough to bundle.
const samplePhotoPngPath = join(tmpdir(), 'openanydoc-sample-photo.png')
screenshotHtml(
  `<!doctype html><body style="margin:0;height:100vh;overflow:hidden;background:linear-gradient(#5b8fd6,#f3c9a0 62%,#3f7a3a 62%,#25502a)">
<div style="position:absolute;left:62%;top:30%;width:90px;height:90px;border-radius:50%;background:radial-gradient(#fff6c8,#ffb347)"></div>
<div style="position:absolute;left:-10%;top:52%;width:70%;height:40%;border-radius:50%;background:#4f8a45"></div>
<div style="position:absolute;left:40%;top:56%;width:80%;height:45%;border-radius:50%;background:#386b33"></div></body>`,
  900,
  600,
  samplePhotoPngPath,
)
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', samplePhotoPngPath, '--out', new URL('landscape-photo.jpg', sampleDirectory).pathname], { stdio: 'ignore' })
rmSync(samplePhotoPngPath)
screenshotHtml(
  `<!doctype html><body style="margin:0;padding:40px;background:#fff;font:20px Helvetica,Arial,sans-serif;color:#1f1f1f">
<div style="font-weight:bold;font-size:26px;margin-bottom:24px">Sales by region, 2026</div>
<div style="display:flex;align-items:flex-end;gap:36px;height:320px;border-bottom:2px solid #1f1f1f;padding:0 30px">
${[['North', 280, '#2f6fd6'], ['South', 220, '#e8833a'], ['West', 250, '#3a9a5b'], ['East', 170, '#8a5cc7']].map(([region, barHeight, color]) => `<div style="flex:1;text-align:center"><div style="height:${barHeight}px;background:${color};border-radius:6px 6px 0 0"></div><div style="margin-top:10px">${region}</div></div>`).join('')}
</div></body>`,
  700,
  480,
  new URL('sales-chart.png', sampleDirectory).pathname,
)
console.log('Wrote the JPG to PDF samples landscape-photo.jpg and sales-chart.png.')
// Upscale image's sample: the landscape photo at 400 pixels wide, small enough to enlarge in a few seconds.
execFileSync('sips', ['--resampleWidth', '400', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', new URL('landscape-photo.jpg', sampleDirectory).pathname, '--out', new URL('small-landscape.jpg', sampleDirectory).pathname], { stdio: 'ignore' })

// The image pages' samples, small enough to bundle: a phone photo with the made-up camera, date and GPS point above (JPG and
// HEIC), a beach photo as HEIC, the landscape photo as WebP, a transparent badge (PNG and WebP) and two meme templates.
const phonePhotoPngPath = join(tmpdir(), 'openanydoc-phone-photo.png')
screenshotHtml(outdoorSceneHtml, 900, 675, phonePhotoPngPath)
const phonePhotoJpgPath = new URL('phone-photo-gps.jpg', sampleDirectory).pathname
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', phonePhotoPngPath, '--out', phonePhotoJpgPath], { stdio: 'ignore' })
writeFileSync(phonePhotoJpgPath, withExif(readFileSync(phonePhotoJpgPath), buildExifSegment(exifScene)))
execFileSync('sips', ['-s', 'format', 'heic', '-s', 'formatOptions', '60', phonePhotoJpgPath, '--out', new URL('phone-photo.heic', sampleDirectory).pathname], { stdio: 'ignore' })
rmSync(phonePhotoPngPath)
const beachSceneHtml = `<!doctype html><body style="margin:0;height:100vh;overflow:hidden;background:linear-gradient(#f7a35c,#fbd38d 45%,#3d8fc4 45%,#2a6f9e 70%,#f1d9a8 70%)">
<div style="position:absolute;left:44%;top:30%;width:12vw;height:12vw;border-radius:50%;background:radial-gradient(#fff3c4,#ff8c42)"></div>
<div style="position:absolute;left:8%;top:62%;width:6%;height:30%;background:#6b4226;transform:rotate(-8deg)"></div>
<div style="position:absolute;left:0;top:52%;width:22%;height:16%;border-radius:50%;background:#2e7d32"></div></body>`
const beachPngPath = join(tmpdir(), 'openanydoc-beach.png')
screenshotHtml(beachSceneHtml, 800, 600, beachPngPath)
execFileSync('sips', ['-s', 'format', 'heic', '-s', 'formatOptions', '60', beachPngPath, '--out', new URL('beach-photo.heic', sampleDirectory).pathname], { stdio: 'ignore' })
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', beachPngPath, '--out', new URL('meme-beach.jpg', sampleDirectory).pathname], { stdio: 'ignore' })
rmSync(beachPngPath)
const deskSceneHtml = `<!doctype html><body style="margin:0;height:100vh;overflow:hidden;background:linear-gradient(#dfe7ef,#c9d6e3 64%,#8d6e4f 64%,#6d5038)">
<div style="position:absolute;left:30%;top:34%;width:40%;height:28%;background:#2b2f36;border-radius:10px;border:10px solid #4a505a"></div>
<div style="position:absolute;left:26%;top:62%;width:48%;height:4%;background:#4a505a;border-radius:0 0 12px 12px"></div>
<div style="position:absolute;left:78%;top:50%;width:7%;height:12%;background:#f4f4f4;border-radius:0 0 10px 10px"></div>
<div style="position:absolute;left:10%;top:14%;width:16%;height:24%;background:#fff;border:8px solid #b08a5a"></div></body>`
const deskPngPath = join(tmpdir(), 'openanydoc-desk.png')
screenshotHtml(deskSceneHtml, 800, 600, deskPngPath)
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', deskPngPath, '--out', new URL('meme-desk.jpg', sampleDirectory).pathname], { stdio: 'ignore' })
rmSync(deskPngPath)
// Scan to PDF's samples: phone photos of paper on a desk, taken at an angle and lit unevenly, as a camera would (portrait).
const paperPhotoHtml = (paperHtml, tilt) => `<!doctype html><body style="margin:0;height:100vh;overflow:hidden;background:radial-gradient(circle at 30% 20%,#b58a5c,#7a5534 70%,#5a3d24)">
<div style="position:absolute;left:14%;top:12%;width:72%;height:74%;padding:5% 6%;box-sizing:border-box;background:linear-gradient(115deg,#ffffff,#f1ede4 55%,#d9d2c3);font:22px Helvetica,Arial,sans-serif;color:#262626;box-shadow:0 18px 40px rgba(0,0,0,.45);transform:perspective(1100px) ${tilt}">${paperHtml}</div>
<div style="position:absolute;inset:0;background:linear-gradient(200deg,rgba(255,255,240,.18),rgba(0,0,0,.28))"></div></body>`
const scanSamples = [
  ['scan-receipt.jpg', 'rotateX(16deg) rotateZ(-5deg)', `<div style="font-weight:bold;font-size:34px;margin-bottom:28px">Example Café</div><div>Receipt 0412 · 14 Nov 2026</div><hr style="margin:24px 0"><div>2 × Coffee ............ 7.00</div><div style="margin-top:12px">1 × Croissant ........ 3.20</div><div style="margin-top:12px">1 × Orange juice ..... 4.50</div><hr style="margin:24px 0"><div style="font-weight:bold">Total ................ 14.70</div><div style="margin-top:40px;font-size:18px">Synthetic sample · no real shop</div>`],
  ['scan-letter.jpg', 'rotateX(10deg) rotateY(-12deg) rotateZ(4deg)', `<div style="font-weight:bold;font-size:30px;margin-bottom:30px">Dear neighbour,</div><p style="line-height:1.6">The street party is on Saturday at 3 pm in the square. Please bring a chair and something to share.</p><p style="line-height:1.6">Children's games start at 4 pm, music at 6 pm.</p><p style="margin-top:40px">— The residents' committee</p><p style="margin-top:40px;font-size:18px">Synthetic sample for OpenAnyDoc</p>`],
]
for (const [fileName, tilt, paperHtml] of scanSamples) {
  const scanPhotoPngPath = join(tmpdir(), 'openanydoc-scan-photo.png')
  screenshotHtml(paperPhotoHtml(paperHtml, tilt), 900, 1200, scanPhotoPngPath)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', scanPhotoPngPath, '--out', new URL(fileName, sampleDirectory).pathname], { stdio: 'ignore' })
  rmSync(scanPhotoPngPath)
}
console.log('Wrote the Scan to PDF samples scan-receipt.jpg and scan-letter.jpg.')
// Blur face and Remove background's samples: drawn, made-up people and a mug (no real person in any of them).
const drawnFace = (left, top, size, skin, hair) => `<div style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size * 1.3}px">
<div style="position:absolute;left:-6%;top:-12%;width:112%;height:62%;border-radius:50% 50% 40% 40%;background:${hair}"></div>
<div style="position:absolute;inset:0;border-radius:46% 46% 50% 50%/40% 40% 60% 60%;background:radial-gradient(circle at 50% 38%,${skin},color-mix(in srgb,${skin} 78%,#5a3a28))"></div>
<div style="position:absolute;left:-6%;top:-10%;width:112%;height:30%;border-radius:50% 50% 30% 30%;background:${hair}"></div>
${[24, 58].map((x) => `<div style="position:absolute;left:${x}%;top:36%;width:18%;height:4%;border-radius:40%;background:#3b2a20"></div><div style="position:absolute;left:${x}%;top:42%;width:18%;height:8%;border-radius:50%;background:#fff"></div><div style="position:absolute;left:${x + 5}%;top:42.5%;width:8%;height:7%;border-radius:50%;background:#2a1b12"></div>`).join('')}
<div style="position:absolute;left:44%;top:50%;width:12%;height:18%;border-radius:40% 40% 50% 50%;background:color-mix(in srgb,${skin} 82%,#6b4230)"></div>
<div style="position:absolute;left:33%;top:74%;width:34%;height:8%;border-radius:0 0 50% 50%;background:#a5524f"></div></div>`
const faceSamples = [
  ['faces-team.jpg', 1200, 800, `background:linear-gradient(#cfe0ee,#e9eef2 60%,#b8a48c 60%)`, [[180, 220, 190, '#e8b897', '#2b1d14'], [520, 190, 200, '#c68a62', '#111'], [860, 230, 185, '#f1c8a8', '#7a4b26']]],
  ['face-portrait.jpg', 800, 1000, `background:linear-gradient(135deg,#d9c8b4,#a99a88)`, [[230, 230, 340, '#d9a37e', '#2a1a10']]],
]
for (const [fileName, width, height, backdrop, faces] of faceSamples) {
  const facesPngPath = join(tmpdir(), 'openanydoc-faces.png')
  screenshotHtml(`<!doctype html><body style="margin:0;height:100vh;overflow:hidden;position:relative;${backdrop}">${faces.map((face) => drawnFace(...face)).join('')}</body>`, width, height, facesPngPath)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', facesPngPath, '--out', new URL(fileName, sampleDirectory).pathname], { stdio: 'ignore' })
  rmSync(facesPngPath)
}
{
  const mugPngPath = join(tmpdir(), 'openanydoc-mug.png')
  screenshotHtml(`<!doctype html><body style="margin:0;height:100vh;overflow:hidden;position:relative;background:linear-gradient(#e7dfd3,#d6cab9 62%,#8c6a4b 62%,#6e523a)">
<div style="position:absolute;left:300px;top:250px;width:260px;height:300px;border-radius:12px 12px 40px 40px;background:linear-gradient(90deg,#1f5fa8,#3d86d6 45%,#1a4f8e)"></div>
<div style="position:absolute;left:520px;top:310px;width:120px;height:150px;border:28px solid #2a6dbd;border-radius:50%;border-left-color:transparent"></div>
<div style="position:absolute;left:300px;top:236px;width:260px;height:40px;border-radius:50%;background:#174a85"></div>
<div style="position:absolute;left:310px;top:244px;width:240px;height:26px;border-radius:50%;background:#4a2c18"></div></body>`, 900, 700, mugPngPath)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', mugPngPath, '--out', new URL('mug-on-desk.jpg', sampleDirectory).pathname], { stdio: 'ignore' })
  rmSync(mugPngPath)
}
{
  const plantPngPath = join(tmpdir(), 'openanydoc-plant.png')
  screenshotHtml(`<!doctype html><body style="margin:0;height:100vh;overflow:hidden;position:relative;background:linear-gradient(#f3eadf,#e6d8c6 70%,#a07d5c 70%,#80603f)">
${[[350, 130, -25], [420, 90, 5], [480, 140, 30], [300, 200, -50], [520, 210, 55]].map(([left, top, turn]) => `<div style="position:absolute;left:${left}px;top:${top}px;width:90px;height:230px;border-radius:50% 50% 50% 50%/80% 80% 20% 20%;background:linear-gradient(90deg,#2f7d3a,#4fa55a);transform:rotate(${turn}deg);transform-origin:50% 100%"></div>`).join('')}
<div style="position:absolute;left:330px;top:390px;width:240px;height:200px;border-radius:0 0 40px 40px;background:linear-gradient(90deg,#c0623c,#d98057 50%,#a8512f)"></div>
<div style="position:absolute;left:316px;top:380px;width:268px;height:36px;border-radius:8px;background:#b5593a"></div></body>`, 900, 700, plantPngPath)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', plantPngPath, '--out', new URL('plant-on-shelf.jpg', sampleDirectory).pathname], { stdio: 'ignore' })
  rmSync(plantPngPath)
}
console.log('Wrote the Blur face and Remove background samples faces-team.jpg, face-portrait.jpg, mug-on-desk.jpg and plant-on-shelf.jpg.')
const badgeSampleSize = 400
writeFileSync(
  new URL('badge-transparent.png', sampleDirectory),
  encodePng(badgeSampleSize, badgeSampleSize, (x, y) => {
    const distance = Math.hypot(x - badgeSampleSize / 2, y - badgeSampleSize / 2)
    const alpha = Math.max(0, Math.min(1, badgeSampleSize * 0.42 - distance + 1))
    const isInnerSquare = Math.abs(x - badgeSampleSize / 2) < badgeSampleSize * 0.16 && Math.abs(y - badgeSampleSize / 2) < badgeSampleSize * 0.16
    return isInnerSquare ? [255, 255, 255, Math.round(alpha * 255)] : [214, 64, 159, Math.round(alpha * 235)]
  }),
)
execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '100', new URL('badge-transparent.png', sampleDirectory).pathname, '-o', new URL('badge-transparent.webp', sampleDirectory).pathname])
execFileSync('cwebp', ['-quiet', '-q', '75', new URL('landscape-photo.jpg', sampleDirectory).pathname, '-o', new URL('landscape-photo.webp', sampleDirectory).pathname])
console.log('Wrote the image page samples (phone photo JPG and HEIC, beach HEIC, landscape WebP, transparent badge PNG and WebP, two meme templates).')

// The Extract images page's sample: a 2-page PDF holding the photo and the chart above as pictures.
const picturesPdf = await PDFDocument.create()
picturesPdf.setTitle('Photo report (synthetic sample)')
picturesPdf.setCreationDate(new Date('2026-11-01T00:00:00Z'))
picturesPdf.setModificationDate(new Date('2026-11-01T00:00:00Z'))
const picturesHeadingFont = await picturesPdf.embedFont(StandardFonts.HelveticaBold)
const samplePhoto = await picturesPdf.embedJpg(new Uint8Array(readFileSync(new URL('landscape-photo.jpg', sampleDirectory))))
const sampleChart = await picturesPdf.embedPng(new Uint8Array(readFileSync(new URL('sales-chart.png', sampleDirectory))))
for (const [heading, picture] of [['Site visit', samplePhoto], ['Sales by region', sampleChart]]) {
  const page = picturesPdf.addPage([595, 842])
  page.drawText(heading, { x: 60, y: 760, size: 22, font: picturesHeadingFont, color: rgb(0.1, 0.1, 0.15) })
  const pictureSize = picture.scaleToFit(475, 600)
  page.drawImage(picture, { x: 60, y: 730 - pictureSize.height, width: pictureSize.width, height: pictureSize.height })
}
writeSampleFile('photo-report-2-pages.pdf', await picturesPdf.save())
console.log('Wrote the Extract images sample photo-report-2-pages.pdf.')

// The Fill PDF page's sample: a 2-page form with text fields, a drop-down, a checkbox and a radio group (made-up labels).
const registrationFormPdf = await PDFDocument.create()
registrationFormPdf.setTitle('Registration form (synthetic sample)')
registrationFormPdf.setCreationDate(new Date('2026-11-01T00:00:00Z'))
registrationFormPdf.setModificationDate(new Date('2026-11-01T00:00:00Z'))
const formHeadingFont = await registrationFormPdf.embedFont(StandardFonts.HelveticaBold)
const formBodyFont = await registrationFormPdf.embedFont(StandardFonts.Helvetica)
const sampleForm = registrationFormPdf.getForm()
const firstFormPage = registrationFormPdf.addPage([595, 842])
firstFormPage.drawText('Workshop registration', { x: 60, y: 760, size: 22, font: formHeadingFont, color: rgb(0.1, 0.1, 0.15) })
for (const [label, fieldName, y] of [['Full name', 'full_name', 690], ['Email', 'email', 640], ['Company', 'company', 590]]) {
  firstFormPage.drawText(label, { x: 60, y: y + 6, size: 12, font: formBodyFont })
  sampleForm.createTextField(fieldName).addToPage(firstFormPage, { x: 180, y, width: 300, height: 24 })
}
firstFormPage.drawText('City', { x: 60, y: 546, size: 12, font: formBodyFont })
const cityField = sampleForm.createDropdown('city')
cityField.addOptions(['Riyadh', 'Jeddah', 'Dammam', 'Other'])
cityField.addToPage(firstFormPage, { x: 180, y: 540, width: 160, height: 24 })
const secondFormPage = registrationFormPdf.addPage([595, 842])
secondFormPage.drawText('Session and consent', { x: 60, y: 760, size: 22, font: formHeadingFont, color: rgb(0.1, 0.1, 0.15) })
const sessionField = sampleForm.createRadioGroup('session')
for (const [label, value, y] of [['Morning session', 'morning', 700], ['Afternoon session', 'afternoon', 670]]) {
  sessionField.addOptionToPage(value, secondFormPage, { x: 60, y, width: 16, height: 16 })
  secondFormPage.drawText(label, { x: 86, y: y + 3, size: 12, font: formBodyFont })
}
const consentField = sampleForm.createCheckBox('newsletter')
consentField.addToPage(secondFormPage, { x: 60, y: 620, width: 16, height: 16 })
secondFormPage.drawText('Send me the workshop notes by email', { x: 86, y: 623, size: 12, font: formBodyFont })
writeSampleFile('form-2-pages.pdf', await registrationFormPdf.save())
console.log('Wrote the Fill PDF sample form-2-pages.pdf.')

// Fill PDF's second sample: a one-page feedback form (text box, rating drop-down, checkbox).
const feedbackPdf = await PDFDocument.create()
feedbackPdf.setTitle('Feedback form (synthetic sample)')
feedbackPdf.setCreationDate(new Date('2026-11-01T00:00:00Z'))
feedbackPdf.setModificationDate(new Date('2026-11-01T00:00:00Z'))
const feedbackHeadingFont = await feedbackPdf.embedFont(StandardFonts.HelveticaBold)
const feedbackBodyFont = await feedbackPdf.embedFont(StandardFonts.Helvetica)
const feedbackForm = feedbackPdf.getForm()
const feedbackPage = feedbackPdf.addPage([595, 842])
feedbackPage.drawText('Customer feedback', { x: 60, y: 760, size: 22, font: feedbackHeadingFont, color: rgb(0.1, 0.1, 0.15) })
feedbackPage.drawText('Order number', { x: 60, y: 706, size: 12, font: feedbackBodyFont })
feedbackForm.createTextField('order_number').addToPage(feedbackPage, { x: 180, y: 700, width: 160, height: 24 })
feedbackPage.drawText('Rating', { x: 60, y: 656, size: 12, font: feedbackBodyFont })
const ratingField = feedbackForm.createDropdown('rating')
ratingField.addOptions(['Excellent', 'Good', 'Fair', 'Poor'])
ratingField.addToPage(feedbackPage, { x: 180, y: 650, width: 160, height: 24 })
feedbackPage.drawText('Comments', { x: 60, y: 606, size: 12, font: feedbackBodyFont })
const feedbackCommentsField = feedbackForm.createTextField('comments')
feedbackCommentsField.enableMultiline()
feedbackCommentsField.addToPage(feedbackPage, { x: 180, y: 500, width: 340, height: 120 })
feedbackForm.createCheckBox('contact_me').addToPage(feedbackPage, { x: 60, y: 460, width: 16, height: 16 })
feedbackPage.drawText('You may contact me about this feedback', { x: 86, y: 463, size: 12, font: feedbackBodyFont })
writeSampleFile('feedback-form.pdf', await feedbackPdf.save())
console.log('Wrote the Fill PDF sample feedback-form.pdf.')

// ---------------------------------------------------------------- Word, Excel and PowerPoint tool samples
// Made from the samples above, edited as packages: a second version of the Word summary (Compare Word), the same summary with
// comments and tracked changes (Remove comments), a mail-merge letter template, a protected and a changed copy of the sales
// workbook (Unprotect and Compare Excel), and the review deck as a macro-enabled .pptm (Remove macros).
const loadSample = async (fileName) => JSZip.loadAsync(readFileSync(new URL(fileName, sampleDirectory)))
const writeSamplePackage = async (zip, fileName) => writeSampleFile(fileName, await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))
async function editSamplePart(zip, partPath, edit) {
  const xml = await zip.file(partPath).async('string')
  const edited = edit(xml)
  if (edited === xml) throw new Error(`Sample edit changed nothing in ${partPath}`)
  zip.file(partPath, edited)
}

const summaryVersion2 = await loadSample('quarterly-summary.docx')
await editSamplePart(summaryVersion2, 'word/document.xml', (xml) => xml.replace('Version 2.4.1 is out; write to', 'Version 2.5 is out with faster exports; write to').replace(' test document with ', ' sample document with '))
await writeSamplePackage(summaryVersion2, 'quarterly-summary-v2.docx')

const reviewedSummary = await loadSample('quarterly-summary.docx')
const commentAuthor = 'w:author="Reviewer (synthetic)" w:date="2026-11-20T10:00:00Z"'
await editSamplePart(reviewedSummary, 'word/document.xml', (xml) =>
  xml
    .replace('<w:r><w:t xml:space="preserve">Version 2.4.1 is out; write to support@example.com with questions.</w:t></w:r>', `<w:commentRangeStart w:id="0"/><w:r><w:t xml:space="preserve">Version </w:t></w:r><w:del w:id="1" ${commentAuthor}><w:r><w:delText>2.4.1</w:delText></w:r></w:del><w:ins w:id="2" ${commentAuthor}><w:r><w:t>2.5</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> is out; write to support@example.com with questions.</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>`),
)
reviewedSummary.file('word/comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" ${commentAuthor} w:initials="R"><w:p><w:r><w:t>Check the version number before sending.</w:t></w:r></w:p></w:comment></w:comments>`)
await editSamplePart(reviewedSummary, '[Content_Types].xml', (xml) => xml.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'))
await editSamplePart(reviewedSummary, 'word/_rels/document.xml.rels', (xml) => xml.replace('</Relationships>', '<Relationship Id="rIdComments1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'))
await writeSamplePackage(reviewedSummary, 'quarterly-summary-reviewed.docx')

const { Document, Packer, Paragraph, TextRun, HeadingLevel } = createRequire(import.meta.url)('docx')
const letterParagraphs = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Order summary (synthetic sample)')] }),
  new Paragraph({ children: [new TextRun('Dear '), new TextRun({ text: '{{name}}', bold: true }), new TextRun(',')] }),
  new Paragraph({ children: [new TextRun('Thank you for your '), new TextRun('{{orders}}'), new TextRun(' orders since '), new TextRun('{{joined}}'), new TextRun('. Your total so far is '), new TextRun({ text: '{{total}}', bold: true }), new TextRun('.')] }),
  new Paragraph({ children: [new TextRun('We will send the next catalogue to our '), new TextRun('{{city}}'), new TextRun(' shop.')] }),
  new Paragraph({ children: [new TextRun('Kind regards,')] }),
]
writeSampleFile('letter-template.docx', await Packer.toBuffer(new Document({ sections: [{ children: letterParagraphs }] })))

const protectedSales = await loadSample('sales-three-sheets.xlsx')
await editSamplePart(protectedSales, 'xl/worksheets/sheet1.xml', (xml) => xml.replace('</sheetData>', '</sheetData><sheetProtection sheet="1" objects="1" scenarios="1"/>'))
await editSamplePart(protectedSales, 'xl/workbook.xml', (xml) => xml.replace('<sheets>', '<workbookProtection lockStructure="1"/><sheets>'))
await writeSamplePackage(protectedSales, 'sales-protected.xlsx')

const salesVersion2 = await loadSample('sales-three-sheets.xlsx')
await editSamplePart(salesVersion2, 'xl/worksheets/sheet1.xml', (xml) => xml.replace('<c r="C2"><v>85</v></c>', '<c r="C2"><v>92</v></c>').replace('<v>Desk lamp</v>', '<v>Desk lamp (LED)</v>'))
await writeSamplePackage(salesVersion2, 'sales-three-sheets-v2.xlsx')

const macroDeck = await loadSample('quarterly-review-3-slides.pptx')
macroDeck.file('ppt/vbaProject.bin', new TextEncoder().encode('Synthetic placeholder for a macro project. OpenAnyDoc never runs or reads it.'))
await editSamplePart(macroDeck, '[Content_Types].xml', (xml) =>
  xml
    .replace('application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml', 'application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml')
    .replace('</Types>', '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'),
)
await editSamplePart(macroDeck, 'ppt/_rels/presentation.xml.rels', (xml) => xml.replace('</Relationships>', '<Relationship Id="rIdVba1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>'))
await writeSamplePackage(macroDeck, 'quarterly-review-macro.pptm')
const protectedArabic = await loadSample('arabic-branches.xlsx')
await editSamplePart(protectedArabic, 'xl/worksheets/sheet1.xml', (xml) => xml.replace('</sheetData>', '</sheetData><sheetProtection sheet="1" objects="1" scenarios="1"/>'))
await writeSamplePackage(protectedArabic, 'arabic-protected.xlsx')

const arabicMacroDeck = await loadSample('arabic-review-3-slides.pptx')
arabicMacroDeck.file('ppt/vbaProject.bin', new TextEncoder().encode('Synthetic placeholder for a macro project. OpenAnyDoc never runs or reads it.'))
await editSamplePart(arabicMacroDeck, '[Content_Types].xml', (xml) =>
  xml
    .replace('application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml', 'application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml')
    .replace('</Types>', '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'),
)
await editSamplePart(arabicMacroDeck, 'ppt/_rels/presentation.xml.rels', (xml) => xml.replace('</Relationships>', '<Relationship Id="rIdVba1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>'))
await writeSamplePackage(arabicMacroDeck, 'arabic-review-macro.pptm')
console.log('Wrote the Arabic protected workbook and macro deck samples.')
// Copies with document properties for the metadata pages (made-up author and company).
async function writeSampleWithProperties(sourceName, fileName, { title, author, company, application }) {
  const zip = await loadSample(sourceName)
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><cp:lastModifiedBy>${author}</cp:lastModifiedBy><cp:revision>4</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-02T09:15:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-11-18T16:40:00Z</dcterms:modified></cp:coreProperties>`)
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${application}</Application><Company>${company}</Company><Manager>${author}</Manager></Properties>`)
  await editSamplePart(zip, '[Content_Types].xml', (xml) => xml.replace('</Types>', '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'))
  await editSamplePart(zip, '_rels/.rels', (xml) => xml.replace('</Relationships>', '<Relationship Id="rIdCore1" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rIdApp1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'))
  await writeSamplePackage(zip, fileName)
}
await writeSampleWithProperties('quarterly-summary.docx', 'summary-with-details.docx', { title: 'Quarterly summary', author: 'Sample Author', company: 'Example Ltd', application: 'Microsoft Office Word' })
await writeSampleWithProperties('arabic-summary.docx', 'arabic-summary-with-details.docx', { title: 'ملخص ربع سنوي', author: 'مؤلف تجريبي', company: 'شركة المثال', application: 'Microsoft Office Word' })
await writeSampleWithProperties('quarterly-review-3-slides.pptx', 'review-with-details.pptx', { title: 'Quarterly review', author: 'Sample Author', company: 'Example Ltd', application: 'Microsoft Office PowerPoint' })
await writeSampleWithProperties('arabic-review-3-slides.pptx', 'arabic-review-with-details.pptx', { title: 'مراجعة ربع سنوية', author: 'مؤلف تجريبي', company: 'شركة المثال', application: 'Microsoft Office PowerPoint' })
// Remove PDF metadata: copies of two PDF samples with made-up document properties (the originals name the library that made them).
for (const [sourceName, fileName, details] of [
  ['report-3-pages.pdf', 'report-with-details.pdf', { title: 'Quarterly report', author: 'Sample Author', subject: 'Sales by region', keywords: ['sales', 'quarterly'], creator: 'Example Writer 4.2', producer: 'Example PDF Maker' }],
  ['arabic-english-guide.pdf', 'arabic-guide-with-details.pdf', { title: 'دليل المستخدم', author: 'مؤلف تجريبي', subject: 'دليل تجريبي', keywords: ['دليل'], creator: 'Example Writer 4.2', producer: 'Example PDF Maker' }],
]) {
  const document = await PDFDocument.load(readFileSync(new URL(sourceName, sampleDirectory)), { updateMetadata: false })
  document.setTitle(details.title)
  document.setAuthor(details.author)
  document.setSubject(details.subject)
  document.setKeywords(details.keywords)
  document.setCreator(details.creator)
  document.setProducer(details.producer)
  document.setCreationDate(new Date('2026-10-02T09:15:00Z'))
  document.setModificationDate(new Date('2026-11-18T16:40:00Z'))
  writeSampleFile(fileName, await document.save())
}
console.log('Wrote the Word, Excel and PowerPoint tool samples.')
