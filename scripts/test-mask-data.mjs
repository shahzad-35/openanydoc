// Unit tests for the Mask Data page's detection, masking and restore code (src/formats/mask), run with
// `npm run test:unit`. Every value here is made up: test card numbers, the published example IBANs and generated IDs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectSensitiveFields, findSensitiveSpansInText, isLuhnValid, isSelectedByDefault, isValidCardNumber, isValidIban, isValidSaudiNationalId, resolveOverlappingSpans } from '../src/formats/mask/detectSensitiveData.ts'
import { buildTokenKey, maskDocument, partiallyMaskValue } from '../src/formats/mask/maskData.ts'
import { parseKeyFile, restoreDocument } from '../src/formats/mask/restoreData.ts'

// A made-up 10-digit ID starting with `firstDigits` and ending in the digit that makes the Luhn check pass.
function makeSyntheticId(firstDigits) {
  for (let checkDigit = 0; checkDigit <= 9; checkDigit++) if (isLuhnValid(`${firstDigits}${checkDigit}`)) return `${firstDigits}${checkDigit}`
}

const firstId = makeSyntheticId('100000001')
const secondId = makeSyntheticId('200000002')

function tablesDocument(header, rows, sheetName = '') {
  return { kind: 'tables', sourceFormat: 'csv', tables: [{ sheetName, header, rows }] }
}

function findingFor(findings, label) {
  return findings.find((finding) => finding.label === label)
}

test('validators accept valid values and refuse near misses', () => {
  assert.equal(isValidIban('GB82WEST12345698765432'), true)
  assert.equal(isValidIban('GB82 WEST 1234 5698 7654 32'), true)
  assert.equal(isValidIban('GB83WEST12345698765432'), false)
  assert.equal(isValidCardNumber('4111 1111 1111 1111'), true)
  assert.equal(isValidCardNumber('4111111111111112'), false)
  assert.equal(isValidCardNumber('9111111111111111'), false)
  assert.equal(isValidSaudiNationalId(firstId), true)
  assert.equal(isValidSaudiNationalId(secondId), true)
  assert.equal(isValidSaudiNationalId(`3${firstId.slice(1)}`), false)
  assert.equal(isValidSaudiNationalId(firstId.slice(0, 9) + ((Number(firstId[9]) + 1) % 10)), false)
})

test('detects columns by header and values, in English and Arabic', () => {
  const document = tablesDocument(
    ['Full Name', 'الاسم', 'email', 'Mobile', 'national_id', 'IBAN', 'card_number', 'Address', 'DOB'],
    [
      ['Sara Example', 'سارة مثال', 'sara@example.com', '+966 50 000 0001', firstId, 'GB82WEST12345698765432', '4111111111111111', '12 Sample Street, Testville', '1990-01-02'],
      ['Omar Sample', 'عمر عينة', 'omar@example.org', '0500000002', secondId, 'GB82WEST12345698765432', '5555555555554444', '34 Demo Road, Mocktown', '1985-12-30'],
    ],
  )
  const { findings } = detectSensitiveFields(document)
  const expectedCategories = { 'Full Name': 'name', 'الاسم': 'name', email: 'email', Mobile: 'phone', national_id: 'nationalId', IBAN: 'iban', card_number: 'card', Address: 'address', DOB: 'birthDate' }
  for (const [label, category] of Object.entries(expectedCategories)) {
    const finding = findingFor(findings, label)
    assert.ok(finding, `${label} is flagged`)
    assert.equal(finding.category, category, `${label} is ${category}`)
    assert.equal(finding.confidence, 'high', `${label} is high confidence`)
    assert.ok(finding.examples.length > 0)
  }
})

test('does not flag amounts, order numbers, plain dates or product names', () => {
  const rows = Array.from({ length: 50 }, (_, position) => [`${1000000000 + position}`, (position * 13.5).toFixed(2), `2026-01-${String((position % 28) + 1).padStart(2, '0')}`, `Widget ${position}`, 'Blue'])
  const { findings, fields } = detectSensitiveFields(tablesDocument(['order_id', 'amount', 'created_at', 'product_name', 'colour'], rows))
  assert.deepEqual(findings, [])
  assert.equal(fields.length, 5, 'every column is listed for the visitor to pick')
})

test('values alone find emails and checksummed numbers; names by shape alone are low confidence', () => {
  const { findings } = detectSensitiveFields(tablesDocument(['a', 'b', 'c'], [['x@example.com', 'GB82WEST12345698765432', 'Sara Example'], ['y@example.com', 'GB82WEST12345698765432', 'Omar Sample']]))
  assert.equal(findingFor(findings, 'a').confidence, 'medium')
  assert.equal(findingFor(findings, 'b').reason, 'checksum')
  assert.equal(findingFor(findings, 'c').confidence, 'low')
  assert.equal(isSelectedByDefault(findingFor(findings, 'c')), false)
})

test('free text columns are flagged and spans do not overlap', () => {
  const { findings } = detectSensitiveFields(tablesDocument(['notes'], [['Called the customer and wrote to sara@example.com about the order'], ['Left a message on +966 50 000 0001 after lunch today']]))
  assert.equal(findings[0].category, 'freeText')
  assert.equal(findings[0].reason, 'textMatches')
  const spans = findSensitiveSpansInText('card 4111 1111 1111 1111 and mail a@example.com')
  assert.deepEqual(spans.map((span) => span.category).sort(), ['card', 'email'])
  assert.deepEqual(resolveOverlappingSpans([{ start: 0, end: 5 }, { start: 0, end: 9 }, { start: 4, end: 12 }, { start: 9, end: 11 }]), [{ start: 0, end: 9 }, { start: 9, end: 11 }])
})

test('tokens are consistent across fields and inside free text', () => {
  const document = tablesDocument(
    ['name', 'email', 'contact', 'notes'],
    [
      ['Sara Example', 'sara@example.com', 'sara@example.com', 'Sara Example asked us to use sara@example.com'],
      ['Omar Sample', 'omar@example.org', 'sara@example.com', 'Nothing to report for this customer'],
    ],
  )
  const choices = [
    { fieldId: '[0,0]', category: 'name', strategy: 'token' },
    { fieldId: '[0,1]', category: 'email', strategy: 'token' },
    { fieldId: '[0,2]', category: 'email', strategy: 'token' },
    { fieldId: '[0,3]', category: 'freeText', strategy: 'token' },
  ]
  const { document: masked, tokens } = maskDocument(document, choices)
  const [firstRow, secondRow] = masked.tables[0].rows
  assert.deepEqual(firstRow, ['NAME-000001', 'EMAIL-000001', 'EMAIL-000001', 'NAME-000001 asked us to use EMAIL-000001'])
  assert.deepEqual(secondRow, ['NAME-000002', 'EMAIL-000002', 'EMAIL-000001', 'Nothing to report for this customer'])
  assert.equal(tokens['EMAIL-000001'].value, 'sara@example.com')
  const preview = maskDocument(document, choices, { sheetIndex: 0, rowCount: 1 })
  assert.deepEqual(preview.document.tables[0].rows, [firstRow])
})

test('partial masks and removal', () => {
  assert.equal(partiallyMaskValue('4111111111111111', 'card'), '****1111')
  assert.equal(partiallyMaskValue('sara@example.com', 'email'), 's***@example.com')
  assert.equal(partiallyMaskValue('1990-01-02', 'birthDate'), '1990-**-**')
  assert.equal(partiallyMaskValue('سارة مثال', 'name'), 'س***')
  assert.equal(partiallyMaskValue('123', 'phone'), '****')
  const { document: masked } = maskDocument(tablesDocument(['name', 'card'], [['Sara Example', '4111111111111111']]), [{ fieldId: '[0,1]', category: 'card', strategy: 'remove' }])
  assert.deepEqual(masked.tables[0].header, ['name'])
  assert.deepEqual(masked.tables[0].rows, [['Sara Example']])
})

test('nested JSON: detects, masks, removes and restores, keeping types', () => {
  const root = {
    customers: [
      { profile: { fullName: 'Sara Example', email: 'sara@example.com' }, card: '4111111111111111', points: 12, note: 'Prefers sara@example.com over phone calls at work' },
      { profile: { fullName: 'Omar Sample', email: 'omar@example.org' }, card: '5555555555554444', points: 7, note: 'No preference given yet by this customer at all' },
    ],
  }
  const { findings } = detectSensitiveFields({ kind: 'json', root })
  assert.equal(findingFor(findings, 'customers[].profile.email').category, 'email')
  assert.equal(findingFor(findings, 'customers[].profile.fullName').category, 'name')
  assert.equal(findingFor(findings, 'customers[].card').category, 'card')
  assert.equal(findingFor(findings, 'customers[].points'), undefined)
  const choices = findings.map((finding) => ({ fieldId: finding.fieldId, category: finding.category, strategy: finding.category === 'card' ? 'remove' : 'token' }))
  const { document: masked, tokens } = maskDocument({ kind: 'json', root }, choices)
  assert.equal(masked.root.customers[0].card, undefined)
  assert.equal(masked.root.customers[0].profile.email, 'EMAIL-000001')
  assert.equal(masked.root.customers[0].note, 'Prefers EMAIL-000001 over phone calls at work')
  assert.equal(masked.root.customers[1].points, 7)
  const key = parseKeyFile(JSON.stringify(buildTokenKey(tokens, 'people.json')))
  const { document: restored, unknownTokenCount } = restoreDocument(masked, key)
  assert.equal(unknownTokenCount, 0)
  const expected = structuredClone(root)
  for (const customer of expected.customers) delete customer.card
  assert.deepEqual(restored.root, expected)
})

test('tables round trip: mask then restore gives back every value with its type', () => {
  const birthDate = new Date(Date.UTC(1990, 0, 2))
  const document = { kind: 'tables', sourceFormat: 'excel', tables: [
    { sheetName: 'People', header: ['name', 'phone', 'DOB', 'notes'], rows: [['Sara Example', 500000001, birthDate, 'Call Sara Example on 0500000002 please'], ['Omar Sample', 500000003, null, '']] },
    { sheetName: 'Other', header: ['email'], rows: [['omar@example.org']] },
  ] }
  const choices = [
    { fieldId: '[0,0]', category: 'name', strategy: 'token' },
    { fieldId: '[0,1]', category: 'phone', strategy: 'token' },
    { fieldId: '[0,2]', category: 'birthDate', strategy: 'token' },
    { fieldId: '[0,3]', category: 'freeText', strategy: 'token' },
    { fieldId: '[1,0]', category: 'email', strategy: 'token' },
  ]
  const { document: masked, tokens } = maskDocument(document, choices)
  assert.equal(masked.tables[0].rows[0][3], 'Call NAME-000001 on PHONE-000002 please')
  assert.equal(masked.tables[0].rows[1][2], null)
  const { document: restored, restoredCount } = restoreDocument(masked, buildTokenKey(tokens, 'people.xlsx'))
  assert.deepEqual(restored, document)
  assert.equal(restoredCount, 8)
})

test('key files: refuses other JSON and counts unknown tokens', () => {
  assert.equal(parseKeyFile('{"tokens":{}}'), null)
  assert.equal(parseKeyFile('not json'), null)
  const key = parseKeyFile(JSON.stringify(buildTokenKey({ 'EMAIL-000001': { value: 'a@example.com', type: 'string' } }, 'x.csv')))
  const { document, unknownTokenCount } = restoreDocument(tablesDocument(['email'], [['EMAIL-000001'], ['EMAIL-000002 and EMAIL-000001']]), key)
  assert.deepEqual(document.tables[0].rows, [['a@example.com'], ['EMAIL-000002 and a@example.com']])
  assert.equal(unknownTokenCount, 1)
})

test('a column the scan missed can be masked as Other, and restored', () => {
  const document = tablesDocument(['staff_code', 'team'], [['A-7781', 'Blue'], ['A-7782', 'Blue']])
  const { document: masked, tokens } = maskDocument(document, [{ fieldId: '[0,0]', category: 'other', strategy: 'token' }])
  assert.deepEqual(masked.tables[0].rows, [['VAL-000001', 'Blue'], ['VAL-000002', 'Blue']])
  assert.deepEqual(restoreDocument(masked, buildTokenKey(tokens, 'staff.csv')).document, document)
})

test('a text file is masked as free text and restored', () => {
  const text = 'Hello,\nplease write to sara@example.com or call +966 50 000 0001.\nThanks'
  const { findings, fields } = detectSensitiveFields({ kind: 'text', text })
  assert.equal(fields.length, 1)
  assert.equal(findings[0].category, 'freeText')
  assert.equal(findings[0].reason, 'textMatches')
  const { document: masked, tokens } = maskDocument({ kind: 'text', text }, [{ fieldId: fields[0].fieldId, category: 'freeText', strategy: 'token' }])
  assert.equal(masked.text, 'Hello,\nplease write to EMAIL-000001 or call PHONE-000001.\nThanks')
  assert.equal(restoreDocument(masked, buildTokenKey(tokens, 'note.txt')).document.text, text)
})
