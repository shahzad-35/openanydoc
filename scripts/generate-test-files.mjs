// Generates synthetic CSV, Word and PowerPoint test files into test-files/, and the binary sample files the tool pages bundle
// ("Try a sample file") into src/samples/ (commit those). Run: node scripts/generate-test-files.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
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
