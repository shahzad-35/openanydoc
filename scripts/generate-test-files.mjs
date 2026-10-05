// Generates synthetic CSV test files into test-files/. Run: node scripts/generate-test-files.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

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

console.log(`Wrote test files to ${outputDirectory.pathname}`)
