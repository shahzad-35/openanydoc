// The "Try a sample file" buttons of the tool pages: two small synthetic files per page (made-up names, example.com addresses, a
// published example IBAN, test card numbers). Text samples are written here; the binary ones (xlsx, xls, docx, pptx, pdf) are files in
// this folder made by scripts/generate-test-files.mjs and bundled as data, so a sample opens with no network request.
// This module is loaded on demand (and while the page is idle, so samples also open offline).
import { SAMPLE_JSON_TEXT } from '../formats/json/jsonTools'

// `preloadBundledFile`: fetches a bundled (binary) sample's data ahead, so it opens offline; text samples need nothing.
export type ToolSample = { id: string; buildFile: () => Promise<File>; preloadBundledFile?: () => Promise<unknown> }

const textFile = (fileName: string, text: string, type: string) => async () => new File([text], fileName, { type })
// A bundled file arrives as a data: address (Vite's ?inline); its bytes are decoded here, not fetched.
const bundledSample = (id: string, fileName: string, type: string, loadDataUrl: () => Promise<{ default: string }>): ToolSample => ({
  id,
  buildFile: async () => {
    const dataUrl = (await loadDataUrl()).default
    const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (character) => character.charCodeAt(0))
    return new File([bytes], fileName, { type })
  },
  preloadBundledFile: loadDataUrl,
})

const CUSTOMERS_CSV = `id,name,email,city,orders,total,joined
1,Chloé Martin,chloe.martin@example.com,Lyon,4,182.50,2025-02-11
2,Jonas Weber,jonas.weber@example.com,Graz,1,39.90,2025-03-02
3,Inês Costa,ines.costa@example.com,Porto,7,410.00,2025-03-19
4,Hugo Bernard,hugo.bernard@example.com,Bilbao,2,75.20,2025-04-07
5,Greta Ito,greta.ito@example.com,Turin,5,233.15,2025-04-28
6,Farid Haddad,farid.haddad@example.com,Leeds,3,120.00,2025-05-16
7,Elena Novak,elena.novak@example.com,Gdansk,9,512.75,2025-06-03
8,Bruno Silva,bruno.silva@example.com,Porto,1,18.40,2025-06-21
9,Alice Dumont,alice.dumont@example.com,Lyon,6,298.60,2025-07-09
10,Dmitri Ellis,dmitri.ellis@example.com,Malmö,2,64.00,2025-08-14
`
// No byte order mark on purpose: the viewer then offers the copy that opens correctly in Excel.
const ARABIC_CSV = `الرقم,الاسم,المدينة,الطلبات,المبلغ,تاريخ الانضمام
1,سارة أحمد,الرياض,4,182.50,2025-02-11
2,خالد يوسف,جدة,1,39.90,2025-03-02
3,ليلى عمر,الدمام,7,410.00,2025-03-19
4,يوسف علي,مكة المكرمة,2,75.20,2025-04-07
5,مريم حسن,المدينة المنورة,5,233.15,2025-04-28
6,عمر خالد,أبها,3,120.00,2025-05-16
7,نور سالم,الرياض,9,512.75,2025-06-03
8,أحمد سعيد,جدة,1,18.40,2025-06-21
`
const ESCAPE_SAMPLE_JSON = `{
  "event": "order.created",
  "orderId": 90210,
  "customer": { "name": "Chloé Martin", "email": "chloe.martin@example.com" },
  "note": "Ring twice and say \\"hi\\"",
  "items": [{ "sku": "BK-01", "qty": 2 }, { "sku": "PN-07", "qty": 5 }]
}
`
const PRODUCTS_TSV = 'sku\tproduct\tcategory\tprice\tin_stock\nBK-01\tNotebook, A5\tStationery\t4.90\t120\nPN-07\tGel pen (black)\tStationery\t1.20\t540\nLM-03\tDesk lamp\tHome\t29.00\t18\nBP-11\tBackpack 20 L\tBags\t39.50\t32\nWB-02\tWater bottle\tHome\t12.00\t75\n'
const ARABIC_TSV = 'الرمز\tالمنتج\tالفئة\tالسعر\tالمخزون\nBK-01\tدفتر ملاحظات\tقرطاسية\t4.90\t120\nPN-07\tقلم حبر أسود\tقرطاسية\t1.20\t540\nLM-03\tمصباح مكتب\tالمنزل\t29.00\t18\nBP-11\tحقيبة ظهر\tحقائب\t39.50\t32\n'
const RELEASE_NOTES_TXT = `Release notes, version 2.4 (synthetic sample)

New
- Files open up to twice as fast.
- Large files load in parts, so the page stays responsive.

Fixed
- Dates in the summary table now use the reader's format.
- The export no longer drops the last empty line.

Contact: support@example.com
`
const ARABIC_NOTES_TXT = `ملاحظات الإصدار 2.4 (عينة اصطناعية)

الجديد
- فتح الملفات أسرع حتى الضعف.
- الملفات الكبيرة تُحمّل على أجزاء، فتبقى الصفحة سريعة.

الإصلاحات
- التواريخ في جدول الملخص تظهر الآن بتنسيق القارئ.
- التصدير لم يعد يحذف السطر الفارغ الأخير.

للتواصل: support@example.com
`
const RECORDS_JSON = `[
  { "id": 1, "name": "Chloé Martin", "city": "Lyon", "orders": 4, "total": 182.5, "active": true },
  { "id": 2, "name": "Jonas Weber", "city": "Graz", "orders": 1, "total": 39.9, "active": false },
  { "id": 3, "name": "Inês Costa", "city": "Porto", "orders": 7, "total": 410, "active": true },
  { "id": 4, "name": "Hugo Bernard", "city": "Bilbao", "orders": 2, "total": 75.2, "active": true },
  { "id": 5, "name": "Greta Ito", "city": "Turin", "orders": 5, "total": 233.15, "active": false }
]
`
const NESTED_ORDERS_JSON = `[
  { "orderId": 1001, "customer": { "name": "Customer A", "city": "Lyon" }, "items": [{ "sku": "BK-01", "qty": 2 }], "paid": true },
  { "orderId": 1002, "customer": { "name": "Customer B", "city": "Graz" }, "items": [{ "sku": "PN-07", "qty": 5 }], "paid": false },
  { "orderId": 1003, "customer": { "name": "Customer C", "city": "Porto" }, "items": [{ "sku": "LM-03", "qty": 1 }], "paid": true }
]
`
// Two mistakes the validator explains and Repair fixes: a trailing comma and a missing quote.
const BROKEN_JSON = `{
  "store": "Demo Books & Co.",
  "open": true,
  "tags": ["books", "stationery",],
  "address": { "city": "Lahore", country: "PK" }
}
`
const PEOPLE_CSV = `full_name,email,mobile,national_id,iban,card_number,city,notes
Sara Example,sara@example.com,+966500000001,1000000008,GB82WEST12345698765432,4111111111111111,Riyadh,Call Sara Example on +966500000001 before Friday
Omar Sample,omar@example.org,+966500000002,2000000006,GB82WEST12345698765432,5555555555554444,Jeddah,Wrote to omar@example.org about the refund
Lina Demo,lina@example.net,+966500000003,1000000016,GB82WEST12345698765432,4111111111111111,Dammam,Nothing to add
`

// 150,000 rows of made-up orders, written when the button is pressed (a few megabytes: too big to bundle).
function buildLargeCsvText() {
  const cities = ['Lyon', 'Porto', 'Graz', 'Leeds', 'Malmö', 'Turin', 'Gdansk', 'Bilbao']
  const lines = ['order_id,city,units,amount,order_date']
  for (let orderId = 1; orderId <= 150_000; orderId++) {
    const day = String((orderId % 28) + 1).padStart(2, '0')
    lines.push(`${orderId},${cities[orderId % cities.length]},${(orderId * 7) % 50 + 1},${((orderId * 37) % 10_000) / 100},2025-${String((orderId % 12) + 1).padStart(2, '0')}-${day}`)
  }
  return `${lines.join('\n')}\n`
}

const CSV = 'text/csv'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const samples = {
  customersCsv: { id: 'customers-csv', buildFile: textFile('customers.csv', CUSTOMERS_CSV, CSV) },
  arabicCsv: { id: 'arabic-csv', buildFile: textFile('arabic-customers.csv', ARABIC_CSV, CSV) },
  largeCsv: { id: 'large-csv', buildFile: async () => new File([buildLargeCsvText()], 'orders-150000-rows.csv', { type: CSV }) },
  productsTsv: { id: 'products-tsv', buildFile: textFile('products.tsv', PRODUCTS_TSV, 'text/tab-separated-values') },
  arabicTsv: { id: 'arabic-tsv', buildFile: textFile('arabic-products.tsv', ARABIC_TSV, 'text/tab-separated-values') },
  releaseNotesTxt: { id: 'release-notes-txt', buildFile: textFile('release-notes.txt', RELEASE_NOTES_TXT, 'text/plain') },
  arabicNotesTxt: { id: 'arabic-notes-txt', buildFile: textFile('arabic-release-notes.txt', ARABIC_NOTES_TXT, 'text/plain') },
  nestedJson: { id: 'nested-json', buildFile: textFile('store.json', SAMPLE_JSON_TEXT, 'application/json') },
  recordsJson: { id: 'records-json', buildFile: textFile('customers.json', RECORDS_JSON, 'application/json') },
  nestedOrdersJson: { id: 'nested-orders-json', buildFile: textFile('orders.json', NESTED_ORDERS_JSON, 'application/json') },
  brokenJson: { id: 'broken-json', buildFile: textFile('broken.json', BROKEN_JSON, 'application/json') },
  // An API payload to escape, and the same kind of payload as an escaped string (as copied from a log) to unescape.
  payloadJson: { id: 'payload-json', buildFile: textFile('payload.json', ESCAPE_SAMPLE_JSON, 'application/json') },
  escapedJson: { id: 'escaped-json', buildFile: textFile('escaped-payload.json', JSON.stringify(JSON.stringify(JSON.parse(ESCAPE_SAMPLE_JSON))), 'application/json') },
  salesXlsx: bundledSample('sales-xlsx', 'sales-three-sheets.xlsx', XLSX_TYPE, () => import('./sales-three-sheets.xlsx?inline')),
  arabicXlsx: bundledSample('arabic-xlsx', 'arabic-branches.xlsx', XLSX_TYPE, () => import('./arabic-branches.xlsx?inline')),
  budgetXls: bundledSample('budget-xls', 'budget-1997.xls', 'application/vnd.ms-excel', () => import('./budget-1997.xls?inline')),
  stockXls: bundledSample('stock-xls', 'stock-two-sheets.xls', 'application/vnd.ms-excel', () => import('./stock-two-sheets.xls?inline')),
  quarterlyDocx: bundledSample('quarterly-docx', 'quarterly-summary.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./quarterly-summary.docx?inline')),
  arabicDocx: bundledSample('arabic-docx', 'arabic-summary.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./arabic-summary.docx?inline')),
  reviewPptx: bundledSample('review-pptx', 'quarterly-review-3-slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', () => import('./quarterly-review-3-slides.pptx?inline')),
  arabicPptx: bundledSample('arabic-pptx', 'arabic-review-3-slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', () => import('./arabic-review-3-slides.pptx?inline')),
  peopleCsv: { id: 'people-csv', buildFile: textFile('people.csv', PEOPLE_CSV, CSV) },
  peopleXlsx: bundledSample('people-xlsx', 'people-two-sheets.xlsx', XLSX_TYPE, () => import('./people-two-sheets.xlsx?inline')),
  reportPdf: bundledSample('report-pdf', 'report-3-pages.pdf', 'application/pdf', () => import('./report-3-pages.pdf?inline')),
  letterPdf: bundledSample('letter-pdf', 'letter-2-pages.pdf', 'application/pdf', () => import('./letter-2-pages.pdf?inline')),
} satisfies Record<string, ToolSample>

// The two samples of each tool page, by its address without the language. Each file has an extension the page accepts.
export const samplesByPage: Record<string, ToolSample[]> = {
  '/csv-viewer': [samples.customersCsv, samples.arabicCsv],
  '/large-csv-viewer': [samples.largeCsv, samples.customersCsv],
  '/tsv-viewer': [samples.productsTsv, samples.arabicTsv],
  '/csv-to-excel': [samples.customersCsv, samples.arabicCsv],
  '/csv-to-json': [samples.customersCsv, samples.arabicCsv],
  '/txt-viewer': [samples.releaseNotesTxt, samples.arabicNotesTxt],
  '/json-viewer': [samples.nestedJson, samples.recordsJson],
  '/json-formatter': [samples.nestedJson, samples.recordsJson],
  '/json-validator': [samples.brokenJson, samples.nestedJson],
  '/json-escape-unescape': [samples.escapedJson, samples.payloadJson],
  '/json-to-csv': [samples.recordsJson, samples.nestedOrdersJson],
  '/excel-viewer': [samples.salesXlsx, samples.arabicXlsx],
  '/excel-to-csv': [samples.salesXlsx, samples.arabicXlsx],
  '/excel-to-json': [samples.salesXlsx, samples.arabicXlsx],
  '/xls-viewer': [samples.budgetXls, samples.stockXls],
  '/word-viewer': [samples.quarterlyDocx, samples.arabicDocx],
  '/powerpoint-viewer': [samples.reviewPptx, samples.arabicPptx],
  '/mask-data': [samples.peopleCsv, samples.peopleXlsx],
  '/merge-pdf': [samples.reportPdf, samples.letterPdf],
  '/add-page-numbers': [samples.reportPdf, samples.letterPdf],
}

// Fetches a page's bundled samples while the page is idle, so they open with no network later.
export function preloadPageSamples(address: string) {
  return Promise.all((samplesByPage[address] ?? []).map((sample) => sample.preloadBundledFile?.()))
}
