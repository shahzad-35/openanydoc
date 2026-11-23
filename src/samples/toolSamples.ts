// The "Try a sample file" buttons of the tool pages: two small synthetic files per page (made-up names, example.com addresses, a
// published example IBAN, test card numbers). Text samples are written here; the binary ones (xlsx, xls, docx, pptx, pdf, jpg, png, heic, webp) are files in
// this folder made by scripts/generate-test-files.mjs and bundled as data, so a sample opens with no network request.
// This module is loaded on demand (and while the page is idle, so samples also open offline).
import { SAMPLE_JSON_TEXT } from '../formats/json/jsonTools'

// `preloadBundledFile`: fetches a bundled (binary) sample's data ahead, so it opens offline; text samples need nothing.
export type ToolSample = { id: string; buildFile: () => Promise<File>; preloadBundledFile?: () => Promise<unknown> }

const DIAGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#f4f7ff"/>
  <rect x="60" y="120" width="180" height="110" rx="18" fill="#2f5fd0"/>
  <rect x="360" y="120" width="180" height="110" rx="18" fill="#1e8449"/>
  <path d="M240 175 H350" stroke="#1f1f1f" stroke-width="6"/>
  <path d="M350 165 L364 175 L350 185 Z" fill="#1f1f1f"/>
  <text x="150" y="183" fill="#fff" font-family="Arial, sans-serif" font-size="26" text-anchor="middle">Your file</text>
  <text x="450" y="183" fill="#fff" font-family="Arial, sans-serif" font-size="26" text-anchor="middle">Your device</text>
  <text x="300" y="320" fill="#1f1f1f" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">Synthetic sample diagram</text>
</svg>
`
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="#d6409f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="4"/>
  <path d="M6.5 16.5l3.5-4.5 2.5 3 2-2.5 3 4"/>
  <circle cx="15" cy="8.5" r="1.5"/>
</svg>
`

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

// The developer tools' samples: an API response for the type generators, a config to sort, convert and compare, XML and YAML
// files, and short texts and tokens for the encoders. Made-up data only.
const API_RESPONSE_JSON = `{
  "id": 4102,
  "username": "sara.k",
  "email": "sara@example.com",
  "isActive": true,
  "score": 87.5,
  "createdAt": "2026-03-14T09:30:00Z",
  "roles": ["editor", "reviewer"],
  "address": { "city": "Riyadh", "postalCode": "12271" },
  "projects": [
    { "id": 1, "name": "Website", "dueDate": "2026-12-01", "budget": 12000 },
    { "id": 2, "name": "Mobile app", "budget": 30500.75, "archived": false }
  ],
  "manager": null
}
`
const UNSORTED_CONFIG_JSON = `{
  "version": 3,
  "name": "orders-service",
  "logging": { "level": "info", "format": "json", "destination": "stdout" },
  "database": { "port": 5432, "host": "db.example.com", "name": "orders", "pool": { "min": 2, "max": 10 } },
  "features": { "newCheckout": true, "betaReports": false },
  "allowedOrigins": ["https://example.com", "https://app.example.com"]
}
`
const CONFIG_YAML = `# Service settings (synthetic sample)
name: orders-service
version: 3
database:
  host: db.example.com
  port: 5432
  pool: { min: 2, max: 10 }
features:
  newCheckout: true
  betaReports: false
allowedOrigins:
  - https://example.com
  - https://app.example.com
`
const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: web
          image: example/web:1.4.2
          ports:
            - containerPort: 8080
          env:
            - name: GREETING
              value: "مرحبا"
`
// Valid YAML whose indentation is mixed (2 and 4 spaces), so Format has something to tidy.
const UNTIDY_YAML = `invoice: 1042
customer:
    name: Example Trading Co.
    city:   Jeddah
items:
- sku: A-100
  qty: 2
  price:   45.5
-   sku: B-220
    qty: 1
    price: 120
paid: false
`
const CATALOG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<catalog updated="2026-11-01">
  <book id="b1" lang="en">
    <title>Learning Data Formats</title>
    <author>Example Author</author>
    <price currency="SAR">89.00</price>
  </book>
  <book id="b2" lang="ar">
    <title>مقدمة في البيانات</title>
    <author>مؤلف تجريبي</author>
    <price currency="SAR">65.50</price>
  </book>
</catalog>
`
const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Example news</title><link>https://example.com/</link><item><title>Release 2.1 is out</title><pubDate>Mon, 03 Nov 2026 08:00:00 GMT</pubDate></item><item><title>Maintenance window</title><pubDate>Fri, 07 Nov 2026 22:00:00 GMT</pubDate></item></channel></rss>
`
const GREETING_TEXT = 'Hello from OpenAnyDoc! مرحبا بكم 👋\n'
const ENCODED_URL_TEXT = 'https://example.com/search?q=%D9%85%D9%84%D9%81%20csv&sort=newest&page=2\n'
// A JSON Web Token from made-up claims; the signature is random bytes, as nothing here verifies it.
const toBase64Url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const buildSampleJwt = (payload: object) => `${toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${toBase64Url(JSON.stringify(payload))}.c2FtcGxlLXNpZ25hdHVyZS1ub3QtcmVhbA`
const EXPIRED_JWT = buildSampleJwt({ sub: '4102', name: 'Sara K.', role: 'editor', iat: 1767225600, exp: 1767229200 })
const LONG_LIVED_JWT = buildSampleJwt({ sub: 'service-42', scope: 'reports:read', iss: 'https://auth.example.com', iat: 1795000000, nbf: 1795000000, exp: 4102444800 })

// Step 19's data tools: orders to pivot and chart, files with problems to validate, repeated rows, mixed case, two months to
// merge (columns in another order), two price lists to compare, a semicolon file, a Windows-1256 Arabic file, YAML, HTML and SQL
// tables. Made-up data only.
const ORDERS_CSV = `order_id,region,product,month,quantity,amount
1001,North,Laptop,2026-01,2,2400
1002,South,Phone,2026-01,5,3250
1003,East,Laptop,2026-01,1,1200
1004,North,Tablet,2026-02,3,1350
1005,West,Phone,2026-02,4,2600
1006,South,Laptop,2026-02,2,2400
1007,East,Tablet,2026-03,6,2700
1008,North,Phone,2026-03,2,1300
1009,West,Laptop,2026-03,3,3600
1010,South,Tablet,2026-03,1,450
1011,East,Phone,2026-04,3,1950
1012,North,Laptop,2026-04,1,1200
`
const BROKEN_CSV = `id,name,city,amount
1,Chloé Martin,Lyon,182.50
2,"Jonas Weber,Graz,39.90
3, Inês Costa ,Porto,410.00
4,Hugo Bernard,Bilbao
5,Greta Ito,Turin,233.15,extra
6,Farid Haddad,Leeds,n/a
6,Farid Haddad,Leeds,n/a
`
const DUPLICATES_CSV = `email,name,plan
ana@example.com,Ana Silva,Pro
ben@example.com,Ben Okafor,Free
ana@example.com,Ana Silva,Pro
cara@example.com,Cara Lind,Team
ben@example.com,Ben Okafor,Free
dev@example.com,Dev Patel,Pro
ana@example.com,Ana Silva,Pro
`
const QUARTERLY_CSV = `metric,Q1,Q2,Q3,Q4
Revenue,120,135,128,160
Costs,80,82,85,90
Customers,410,455,470,520
`
const MIXED_CASE_CSV = `name,city,status
sara AHMED,riyadh,ACTIVE
JOHN smith,LONDON,inactive
maría garcía,Madrid,Active
li WEI,beijing,ACTIVE
`
const JANUARY_CSV = `date,product,quantity,amount
2026-01-05,Laptop,2,2400
2026-01-12,Phone,5,3250
2026-01-20,Tablet,1,450
`
const FEBRUARY_CSV = `product,date,amount,quantity
Phone,2026-02-02,1300,2
Laptop,2026-02-14,3600,3
`
const OLD_PRICES_CSV = `sku,name,price,stock
A-100,Desk lamp,25.00,40
A-101,Office chair,149.00,12
A-102,Monitor stand,39.00,25
A-103,Keyboard,59.00,30
`
const NEW_PRICES_CSV = `sku,name,price,stock
A-100,Desk lamp,27.50,40
A-101,Office chair,149.00,8
A-103,Keyboard,59.00,30
A-104,Webcam,79.00,15
`
const SEMICOLON_CSV = `artikel;menge;preis;datum
Lampe;2;25,00;05.01.2026
Stuhl;1;149,00;12.01.2026
Monitor;3;189,90;20.01.2026
`
const STAFF_YAML = `# Team list (synthetic sample)
- name: Sara Ahmed
  role: Engineer
  office: { city: Riyadh, floor: 3 }
  start: 2024-03-01
- name: John Smith
  role: Designer
  office: { city: London, floor: 1 }
  start: 2023-09-15
- name: Maria Garcia
  role: Manager
  office: { city: Madrid, floor: 2 }
  start: 2022-01-10
`
const README_MD = `# Project notes (synthetic sample)

A short **Markdown** file with the usual parts: headings, lists, a table, code and a link.

## Next steps

1. Check the totals in the *summary* table.
2. Send the report to [the team](https://example.com/team).
   - Ask for comments by Friday.
   - Keep the old version.

| Region | Q1 | Q2 |
| --- | ---: | ---: |
| North | 1,240 | 1,385 |
| South | 980 | 1,102 |

> Numbers are made up for this example.

\`\`\`
total = north + south
\`\`\`

Contact: support@example.com
`
const ARABIC_MD = `# ملاحظات المشروع (عينة اصطناعية)

ملف **Markdown** قصير فيه عناوين وقوائم وجدول.

## الخطوات التالية

1. راجع المجاميع في جدول *الملخص*.
2. أرسل التقرير إلى الفريق.
   - اطلب الملاحظات قبل يوم الخميس.
   - احتفظ بالنسخة القديمة.

| المنطقة | الربع الأول | الربع الثاني |
| --- | ---: | ---: |
| الرياض | 1,240 | 1,385 |
| جدة | 980 | 1,102 |

> الأرقام مختلقة لهذا المثال.

للتواصل: support@example.com
`
const PRICES_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Plans</title></head><body>
<h1>Plans (synthetic sample)</h1>
<table>
  <thead><tr><th>Plan</th><th>Monthly</th><th>Yearly</th><th>Users</th></tr></thead>
  <tbody>
    <tr><td>Starter</td><td>$9</td><td>$90</td><td>1</td></tr>
    <tr><td>Team</td><td>$29</td><td>$290</td><td>10</td></tr>
    <tr><td>Business</td><td colspan="2">Contact us</td><td>Unlimited</td></tr>
  </tbody>
</table>
</body></html>
`
const SCHEDULE_HTML = `<table>
  <tr><th>Day</th><th>Time</th><th>Session</th></tr>
  <tr><td rowspan="2">Monday</td><td>09:00</td><td>Welcome</td></tr>
  <tr><td>11:00</td><td>Data formats</td></tr>
  <tr><td>Tuesday</td><td>10:00</td><td>Workshop</td></tr>
</table>
`
const MYSQL_DUMP_SQL = `-- MySQL dump (synthetic sample)
/*!40101 SET NAMES utf8mb4 */;
DROP TABLE IF EXISTS \`customers\`;
CREATE TABLE \`customers\` (
  \`id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) NOT NULL,
  \`city\` varchar(50) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4;
LOCK TABLES \`customers\` WRITE;
INSERT INTO \`customers\` VALUES (1,'Sara Ahmed','Riyadh'),(2,'John Smith','London'),(3,'O''Brien Ltd','Dublin');
UNLOCK TABLES;
`
const ORDERS_SQL = `CREATE TABLE orders (id INTEGER PRIMARY KEY, product TEXT, quantity INTEGER, amount REAL);
INSERT INTO orders VALUES (1, 'Laptop', 2, 2400.0);
INSERT INTO orders VALUES (2, 'Phone', 5, 3250.0);
INSERT INTO orders VALUES (3, 'Tablet', 1, 450.0);
`

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
  summaryV2Docx: bundledSample('summary-v2-docx', 'quarterly-summary-v2.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./quarterly-summary-v2.docx?inline')),
  reviewedDocx: bundledSample('reviewed-docx', 'quarterly-summary-reviewed.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./quarterly-summary-reviewed.docx?inline')),
  letterTemplateDocx: bundledSample('letter-template-docx', 'letter-template.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./letter-template.docx?inline')),
  protectedXlsx: bundledSample('protected-xlsx', 'sales-protected.xlsx', XLSX_TYPE, () => import('./sales-protected.xlsx?inline')),
  salesV2Xlsx: bundledSample('sales-v2-xlsx', 'sales-three-sheets-v2.xlsx', XLSX_TYPE, () => import('./sales-three-sheets-v2.xlsx?inline')),
  macroPptm: bundledSample('macro-pptm', 'quarterly-review-macro.pptm', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12', () => import('./quarterly-review-macro.pptm?inline')),
  arabicProtectedXlsx: bundledSample('arabic-protected-xlsx', 'arabic-protected.xlsx', XLSX_TYPE, () => import('./arabic-protected.xlsx?inline')),
  arabicMacroPptm: bundledSample('arabic-macro-pptm', 'arabic-review-macro.pptm', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12', () => import('./arabic-review-macro.pptm?inline')),
  detailsPdf: bundledSample('details-pdf', 'report-with-details.pdf', 'application/pdf', () => import('./report-with-details.pdf?inline')),
  arabicDetailsPdf: bundledSample('arabic-details-pdf', 'arabic-guide-with-details.pdf', 'application/pdf', () => import('./arabic-guide-with-details.pdf?inline')),
  detailsDocx: bundledSample('details-docx', 'summary-with-details.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./summary-with-details.docx?inline')),
  arabicDetailsDocx: bundledSample('arabic-details-docx', 'arabic-summary-with-details.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => import('./arabic-summary-with-details.docx?inline')),
  detailsPptx: bundledSample('details-pptx', 'review-with-details.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', () => import('./review-with-details.pptx?inline')),
  arabicDetailsPptx: bundledSample('arabic-details-pptx', 'arabic-review-with-details.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', () => import('./arabic-review-with-details.pptx?inline')),
  peopleCsv: { id: 'people-csv', buildFile: textFile('people.csv', PEOPLE_CSV, CSV) },
  peopleXlsx: bundledSample('people-xlsx', 'people-two-sheets.xlsx', XLSX_TYPE, () => import('./people-two-sheets.xlsx?inline')),
  reportPdf: bundledSample('report-pdf', 'report-3-pages.pdf', 'application/pdf', () => import('./report-3-pages.pdf?inline')),
  letterPdf: bundledSample('letter-pdf', 'letter-2-pages.pdf', 'application/pdf', () => import('./letter-2-pages.pdf?inline')),
  guidePdf: bundledSample('guide-pdf', 'arabic-english-guide.pdf', 'application/pdf', () => import('./arabic-english-guide.pdf?inline')),
  photoJpg: bundledSample('photo-jpg', 'landscape-photo.jpg', 'image/jpeg', () => import('./landscape-photo.jpg?inline')),
  chartPng: bundledSample('chart-png', 'sales-chart.png', 'image/png', () => import('./sales-chart.png?inline')),
  photoReportPdf: bundledSample('photo-report-pdf', 'photo-report-2-pages.pdf', 'application/pdf', () => import('./photo-report-2-pages.pdf?inline')),
  formPdf: bundledSample('form-pdf', 'form-2-pages.pdf', 'application/pdf', () => import('./form-2-pages.pdf?inline')),
  feedbackFormPdf: bundledSample('feedback-form-pdf', 'feedback-form.pdf', 'application/pdf', () => import('./feedback-form.pdf?inline')),
  contractV1Pdf: bundledSample('contract-v1-pdf', 'contract-v1.pdf', 'application/pdf', () => import('./contract-v1.pdf?inline')),
  contractV2Pdf: bundledSample('contract-v2-pdf', 'contract-v2.pdf', 'application/pdf', () => import('./contract-v2.pdf?inline')),
  scanReceiptJpg: bundledSample('scan-receipt-jpg', 'scan-receipt.jpg', 'image/jpeg', () => import('./scan-receipt.jpg?inline')),
  scanLetterJpg: bundledSample('scan-letter-jpg', 'scan-letter.jpg', 'image/jpeg', () => import('./scan-letter.jpg?inline')),
  blankFormPdf: bundledSample('blank-form-pdf', 'blank-form-layout.pdf', 'application/pdf', () => import('./blank-form-layout.pdf?inline')),
  lockedPdf: bundledSample('locked-pdf', 'report-locked.pdf', 'application/pdf', () => import('./report-locked.pdf?inline')),
  noPrintingPdf: bundledSample('no-printing-pdf', 'letter-no-printing.pdf', 'application/pdf', () => import('./letter-no-printing.pdf?inline')),
  salesTablePdf: bundledSample('sales-table-pdf', 'sales-table.pdf', 'application/pdf', () => import('./sales-table.pdf?inline')),
  scannedLetterPdf: bundledSample('scanned-letter-pdf', 'scanned-letter.pdf', 'application/pdf', () => import('./scanned-letter.pdf?inline')),
  scannedArabicPdf: bundledSample('scanned-arabic-pdf', 'scanned-arabic-notice.pdf', 'application/pdf', () => import('./scanned-arabic-notice.pdf?inline')),
  facesTeamJpg: bundledSample('faces-team-jpg', 'faces-team.jpg', 'image/jpeg', () => import('./faces-team.jpg?inline')),
  facePortraitJpg: bundledSample('face-portrait-jpg', 'face-portrait.jpg', 'image/jpeg', () => import('./face-portrait.jpg?inline')),
  mugJpg: bundledSample('mug-jpg', 'mug-on-desk.jpg', 'image/jpeg', () => import('./mug-on-desk.jpg?inline')),
  smallLandscapeJpg: bundledSample('small-landscape-jpg', 'small-landscape.jpg', 'image/jpeg', () => import('./small-landscape.jpg?inline')),
  plantJpg: bundledSample('plant-jpg', 'plant-on-shelf.jpg', 'image/jpeg', () => import('./plant-on-shelf.jpg?inline')),
  damagedPdf: bundledSample('damaged-pdf', 'damaged-report.pdf', 'application/pdf', () => import('./damaged-report.pdf?inline')),
  phonePhotoJpg: bundledSample('phone-photo-jpg', 'phone-photo-gps.jpg', 'image/jpeg', () => import('./phone-photo-gps.jpg?inline')),
  phonePhotoHeic: bundledSample('phone-photo-heic', 'phone-photo.heic', 'image/heic', () => import('./phone-photo.heic?inline')),
  beachHeic: bundledSample('beach-heic', 'beach-photo.heic', 'image/heic', () => import('./beach-photo.heic?inline')),
  photoWebp: bundledSample('photo-webp', 'landscape-photo.webp', 'image/webp', () => import('./landscape-photo.webp?inline')),
  badgePng: bundledSample('badge-png', 'badge-transparent.png', 'image/png', () => import('./badge-transparent.png?inline')),
  badgeWebp: bundledSample('badge-webp', 'badge-transparent.webp', 'image/webp', () => import('./badge-transparent.webp?inline')),
  memeDesk: bundledSample('meme-desk', 'meme-desk.jpg', 'image/jpeg', () => import('./meme-desk.jpg?inline')),
  memeBeach: bundledSample('meme-beach', 'meme-beach.jpg', 'image/jpeg', () => import('./meme-beach.jpg?inline')),
  apiResponseJson: { id: 'api-response-json', buildFile: textFile('user-response.json', API_RESPONSE_JSON, 'application/json') },
  unsortedConfigJson: { id: 'unsorted-config-json', buildFile: textFile('service-config.json', UNSORTED_CONFIG_JSON, 'application/json') },
  configYaml: { id: 'config-yaml', buildFile: textFile('service-config.yaml', CONFIG_YAML, 'application/yaml') },
  deploymentYaml: { id: 'deployment-yaml', buildFile: textFile('deployment.yaml', DEPLOYMENT_YAML, 'application/yaml') },
  untidyYaml: { id: 'untidy-yaml', buildFile: textFile('invoice.yaml', UNTIDY_YAML, 'application/yaml') },
  catalogXml: { id: 'catalog-xml', buildFile: textFile('catalog.xml', CATALOG_XML, 'application/xml') },
  feedXml: { id: 'feed-xml', buildFile: textFile('news-feed.xml', FEED_XML, 'application/xml') },
  greetingTxt: { id: 'greeting-txt', buildFile: textFile('greeting.txt', GREETING_TEXT, 'text/plain') },
  greetingBase64Txt: { id: 'greeting-base64-txt', buildFile: async () => new File([btoa(String.fromCharCode(...new TextEncoder().encode(GREETING_TEXT)))], 'greeting-base64.txt', { type: 'text/plain' }) },
  encodedUrlTxt: { id: 'encoded-url-txt', buildFile: textFile('encoded-link.txt', ENCODED_URL_TEXT, 'text/plain') },
  plainUrlTxt: { id: 'plain-url-txt', buildFile: textFile('search-link.txt', 'https://example.com/search?q=ملف csv&sort=newest\n', 'text/plain') },
  expiredJwt: { id: 'expired-jwt', buildFile: async () => new File([EXPIRED_JWT], 'expired-token.txt', { type: 'text/plain' }) },
  longLivedJwt: { id: 'long-lived-jwt', buildFile: async () => new File([LONG_LIVED_JWT], 'service-token.txt', { type: 'text/plain' }) },
  ordersCsv: { id: 'orders-csv', buildFile: textFile('orders.csv', ORDERS_CSV, CSV) },
  brokenCsv: { id: 'broken-csv', buildFile: textFile('broken.csv', BROKEN_CSV, CSV) },
  duplicatesCsv: { id: 'duplicates-csv', buildFile: textFile('sign-ups.csv', DUPLICATES_CSV, CSV) },
  quarterlyCsv: { id: 'quarterly-csv', buildFile: textFile('quarterly.csv', QUARTERLY_CSV, CSV) },
  mixedCaseCsv: { id: 'mixed-case-csv', buildFile: textFile('contacts.csv', MIXED_CASE_CSV, CSV) },
  januaryCsv: { id: 'january-csv', buildFile: textFile('sales-january.csv', JANUARY_CSV, CSV) },
  februaryCsv: { id: 'february-csv', buildFile: textFile('sales-february.csv', FEBRUARY_CSV, CSV) },
  oldPricesCsv: { id: 'old-prices-csv', buildFile: textFile('prices-old.csv', OLD_PRICES_CSV, CSV) },
  newPricesCsv: { id: 'new-prices-csv', buildFile: textFile('prices-new.csv', NEW_PRICES_CSV, CSV) },
  semicolonCsv: { id: 'semicolon-csv', buildFile: textFile('bestellung.csv', SEMICOLON_CSV, CSV) },
  // The Arabic customer list saved as Windows-1256, as old Arabic Windows programs write it.
  windows1256Csv: { id: 'windows-1256-csv', buildFile: async () => new File([(await import('../formats/text/textEditing')).encodeText(ARABIC_CSV, 'windows-1256').bytes], 'arabic-windows-1256.csv', { type: CSV }) },
  staffYaml: { id: 'staff-yaml', buildFile: textFile('team.yaml', STAFF_YAML, 'application/yaml') },
  pricesHtml: { id: 'prices-html', buildFile: textFile('plans.html', PRICES_HTML, 'text/html') },
  scheduleHtml: { id: 'schedule-html', buildFile: textFile('schedule.html', SCHEDULE_HTML, 'text/html') },
  readmeMd: { id: 'readme-md', buildFile: textFile('project-notes.md', README_MD, 'text/markdown') },
  arabicMd: { id: 'arabic-md', buildFile: textFile('arabic-notes.md', ARABIC_MD, 'text/markdown') },
  mysqlDumpSql: { id: 'mysql-dump-sql', buildFile: textFile('customers-dump.sql', MYSQL_DUMP_SQL, 'application/sql') },
  ordersSql: { id: 'orders-sql', buildFile: textFile('orders.sql', ORDERS_SQL, 'application/sql') },
  diagramSvg: { id: 'diagram-svg', buildFile: textFile('diagram.svg', DIAGRAM_SVG, 'image/svg+xml') },
  iconSvg: { id: 'icon-svg', buildFile: textFile('picture-icon.svg', ICON_SVG, 'image/svg+xml') },
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
  '/json-escape': [samples.escapedJson, samples.payloadJson],
  '/json-minify': [samples.nestedJson, samples.recordsJson],
  '/json-sort': [samples.unsortedConfigJson, samples.nestedJson],
  '/json-tree-viewer': [samples.nestedOrdersJson, samples.apiResponseJson],
  '/json-graph': [samples.nestedJson, samples.apiResponseJson],
  '/json-compare': [samples.unsortedConfigJson, samples.recordsJson],
  '/json-schema': [samples.apiResponseJson, samples.recordsJson],
  '/jsonpath': [samples.nestedJson, samples.nestedOrdersJson],
  '/json-to-yaml': [samples.unsortedConfigJson, samples.apiResponseJson],
  '/yaml-to-json': [samples.configYaml, samples.deploymentYaml],
  '/json-to-xml': [samples.recordsJson, samples.apiResponseJson],
  '/xml-to-json': [samples.catalogXml, samples.feedXml],
  '/json-to-typescript': [samples.apiResponseJson, samples.nestedOrdersJson],
  '/json-to-python': [samples.apiResponseJson, samples.nestedOrdersJson],
  '/json-to-go': [samples.apiResponseJson, samples.nestedOrdersJson],
  '/json-to-java': [samples.apiResponseJson, samples.nestedOrdersJson],
  '/json-to-csharp': [samples.apiResponseJson, samples.nestedOrdersJson],
  '/xml-viewer': [samples.catalogXml, samples.feedXml],
  '/yaml-formatter': [samples.untidyYaml, samples.deploymentYaml],
  '/base64-encode-decode': [samples.greetingTxt, samples.greetingBase64Txt],
  '/url-encode-decode': [samples.encodedUrlTxt, samples.plainUrlTxt],
  '/jwt-decoder': [samples.expiredJwt, samples.longLivedJwt],
  '/word-to-markdown': [samples.quarterlyDocx, samples.arabicDocx],
  '/pptx-to-markdown': [samples.reviewPptx, samples.arabicPptx],
  '/token-counter': [samples.reportPdf, samples.quarterlyDocx],
  '/ai-summarizer': [samples.reportPdf, samples.arabicDocx],
  '/translate-document': [samples.quarterlyDocx, samples.arabicNotesTxt],
  '/chat-with-pdf': [samples.reportPdf, samples.guidePdf],
  '/json-to-toon': [samples.recordsJson, samples.apiResponseJson],
  '/csv-to-sql': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-sql': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-xml': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-xml': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-yaml': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-yaml': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-markdown': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-markdown': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-html': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-html': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-latex': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-latex': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-fixed-width': [samples.customersCsv, samples.arabicCsv],
  '/excel-to-fixed-width': [samples.salesXlsx, samples.arabicXlsx],
  '/xml-to-csv': [samples.catalogXml, samples.feedXml],
  '/yaml-to-csv': [samples.staffYaml, samples.deploymentYaml],
  '/html-table-to-csv': [samples.pricesHtml, samples.scheduleHtml],
  '/sql-to-csv': [samples.mysqlDumpSql, samples.ordersSql],
  '/csv-validator': [samples.brokenCsv, samples.customersCsv],
  '/split-csv': [samples.largeCsv, samples.customersCsv],
  '/sql-on-csv': [samples.ordersCsv, samples.salesXlsx],
  '/pivot-table': [samples.ordersCsv, samples.salesXlsx],
  '/chart-maker': [samples.ordersCsv, samples.arabicCsv],
  '/remove-duplicates': [samples.duplicatesCsv, samples.brokenCsv],
  '/transpose': [samples.quarterlyCsv, samples.customersCsv],
  '/change-case': [samples.mixedCaseCsv, samples.customersCsv],
  '/merge-csv': [samples.januaryCsv, samples.februaryCsv],
  '/compare-csv': [samples.oldPricesCsv, samples.newPricesCsv],
  '/change-csv-encoding': [samples.windows1256Csv, samples.arabicCsv],
  '/change-csv-delimiter': [samples.semicolonCsv, samples.customersCsv],
  '/json-to-csv': [samples.recordsJson, samples.nestedOrdersJson],
  '/excel-viewer': [samples.salesXlsx, samples.arabicXlsx],
  '/excel-to-csv': [samples.salesXlsx, samples.arabicXlsx],
  '/excel-to-json': [samples.salesXlsx, samples.arabicXlsx],
  '/xls-viewer': [samples.budgetXls, samples.stockXls],
  '/word-viewer': [samples.quarterlyDocx, samples.arabicDocx],
  '/powerpoint-viewer': [samples.reviewPptx, samples.arabicPptx],
  '/mask-data': [samples.peopleCsv, samples.peopleXlsx],
  '/pdf-viewer': [samples.reportPdf, samples.guidePdf],
  '/merge-pdf': [samples.reportPdf, samples.letterPdf],
  '/add-page-numbers': [samples.reportPdf, samples.letterPdf],
  '/split-pdf': [samples.reportPdf, samples.guidePdf],
  '/remove-pdf-pages': [samples.reportPdf, samples.letterPdf],
  '/extract-pdf-pages': [samples.reportPdf, samples.guidePdf],
  '/organize-pdf': [samples.reportPdf, samples.letterPdf],
  '/rotate-pdf': [samples.letterPdf, samples.reportPdf],
  '/jpg-to-pdf': [samples.photoJpg, samples.chartPng],
  '/pdf-to-jpg': [samples.reportPdf, samples.guidePdf],
  '/pdf-to-text': [samples.guidePdf, samples.reportPdf],
  '/extract-pdf-images': [samples.photoReportPdf, samples.guidePdf],
  '/edit-pdf': [samples.reportPdf, samples.guidePdf],
  '/sign-pdf': [samples.letterPdf, samples.formPdf],
  '/fill-pdf': [samples.formPdf, samples.feedbackFormPdf],
  '/watermark-pdf': [samples.reportPdf, samples.guidePdf],
  '/header-footer-pdf': [samples.reportPdf, samples.guidePdf],
  '/crop-pdf': [samples.reportPdf, samples.letterPdf],
  '/redact-pdf': [samples.letterPdf, samples.reportPdf],
  '/compare-pdf': [samples.contractV1Pdf, samples.contractV2Pdf],
  '/pdf-to-markdown': [samples.reportPdf, samples.guidePdf],
  '/scan-to-pdf': [samples.scanReceiptJpg, samples.scanLetterJpg],
  '/pdf-forms': [samples.blankFormPdf, samples.letterPdf],
  '/protect-pdf': [samples.reportPdf, samples.letterPdf],
  '/unlock-pdf': [samples.lockedPdf, samples.noPrintingPdf],
  '/pdf-to-word': [samples.reportPdf, samples.guidePdf],
  '/translate-pdf': [samples.reportPdf, samples.guidePdf],
  '/pdf-to-excel': [samples.salesTablePdf, samples.letterPdf],
  '/pdf-to-powerpoint': [samples.photoReportPdf, samples.reportPdf],
  '/word-to-pdf': [samples.quarterlyDocx, samples.arabicDocx],
  '/excel-to-pdf': [samples.salesXlsx, samples.arabicXlsx],
  '/pptx-to-pdf': [samples.reviewPptx, samples.arabicPptx],
  '/pptx-to-jpg': [samples.reviewPptx, samples.arabicPptx],
  '/word-to-jpg': [samples.quarterlyDocx, samples.arabicDocx],
  '/excel-to-jpg': [samples.salesXlsx, samples.arabicXlsx],
  '/csv-to-pdf': [samples.customersCsv, samples.arabicCsv],
  '/images-to-pptx': [samples.photoJpg, samples.chartPng],
  '/merge-word': [samples.quarterlyDocx, samples.arabicDocx],
  '/split-word': [samples.quarterlyDocx, samples.arabicDocx],
  '/compare-word': [samples.quarterlyDocx, samples.summaryV2Docx],
  '/word-counter': [samples.quarterlyDocx, samples.arabicNotesTxt],
  '/word-find-replace': [samples.quarterlyDocx, samples.arabicDocx],
  '/remove-word-comments': [samples.reviewedDocx, samples.quarterlyDocx],
  '/word-metadata': [samples.detailsDocx, samples.arabicDetailsDocx],
  '/extract-word-images': [samples.quarterlyDocx, samples.arabicDocx],
  '/watermark-word': [samples.quarterlyDocx, samples.arabicDocx],
  '/word-mail-merge': [samples.letterTemplateDocx, samples.customersCsv],
  '/merge-excel': [samples.salesXlsx, samples.peopleXlsx],
  '/split-excel': [samples.salesXlsx, samples.peopleXlsx],
  '/compare-excel': [samples.salesXlsx, samples.salesV2Xlsx],
  '/unprotect-excel': [samples.protectedXlsx, samples.arabicProtectedXlsx],
  '/repair-excel': [samples.salesXlsx, samples.budgetXls],
  '/excel-metadata': [samples.salesXlsx, samples.arabicXlsx],
  '/excel-to-word': [samples.salesXlsx, samples.arabicXlsx],
  '/merge-pptx': [samples.reviewPptx, samples.arabicPptx],
  '/split-pptx': [samples.reviewPptx, samples.arabicPptx],
  '/extract-pptx-media': [samples.reviewPptx, samples.macroPptm],
  '/search-pptx': [samples.reviewPptx, samples.arabicPptx],
  '/pptx-metadata': [samples.detailsPptx, samples.arabicDetailsPptx],
  '/pptm-to-pptx': [samples.macroPptm, samples.arabicMacroPptm],
  '/watermark-pptx': [samples.reviewPptx, samples.arabicPptx],
  '/markdown-to-word': [samples.readmeMd, samples.arabicMd],
  '/markdown-to-pdf': [samples.readmeMd, samples.arabicMd],
  '/text-to-word': [samples.releaseNotesTxt, samples.arabicNotesTxt],
  '/text-to-pdf': [samples.releaseNotesTxt, samples.arabicNotesTxt],
  '/html-to-word': [samples.pricesHtml, samples.scheduleHtml],
  '/html-to-pdf': [samples.pricesHtml, samples.scheduleHtml],
  '/ocr-pdf': [samples.scannedLetterPdf, samples.scannedArabicPdf],
  '/blur-face': [samples.facesTeamJpg, samples.facePortraitJpg],
  '/remove-background': [samples.mugJpg, samples.plantJpg],
  '/upscale-image': [samples.smallLandscapeJpg, samples.badgePng],
  '/image-to-text': [samples.scanReceiptJpg, samples.scanLetterJpg],
  '/repair-pdf': [samples.damagedPdf, samples.letterPdf],
  '/compress-pdf': [samples.photoReportPdf, samples.guidePdf],
  '/pdf-to-grayscale': [samples.photoReportPdf, samples.guidePdf],
  '/remove-pdf-metadata': [samples.detailsPdf, samples.arabicDetailsPdf],
  '/flatten-pdf': [samples.feedbackFormPdf, samples.formPdf],
  '/image-viewer': [samples.phonePhotoJpg, samples.phonePhotoHeic],
  '/compress-image': [samples.photoJpg, samples.chartPng],
  '/resize-image': [samples.phonePhotoJpg, samples.chartPng],
  '/crop-image': [samples.phonePhotoJpg, samples.badgePng],
  '/rotate-image': [samples.photoJpg, samples.chartPng],
  '/watermark-image': [samples.photoJpg, samples.phonePhotoJpg],
  '/remove-image-metadata': [samples.phonePhotoJpg, samples.phonePhotoHeic],
  '/photo-editor': [samples.photoJpg, samples.phonePhotoJpg],
  '/convert-image': [samples.phonePhotoHeic, samples.badgePng],
  '/heic-to-jpg': [samples.phonePhotoHeic, samples.beachHeic],
  '/webp-to-jpg': [samples.photoWebp, samples.badgeWebp],
  '/png-to-jpg': [samples.chartPng, samples.badgePng],
  '/jpg-to-png': [samples.photoJpg, samples.phonePhotoJpg],
  '/svg-to-png': [samples.diagramSvg, samples.iconSvg],
  '/image-to-webp': [samples.photoJpg, samples.badgePng],
  '/meme-generator': [samples.memeDesk, samples.memeBeach],
}

// Fetches a page's bundled samples while the page is idle, so they open with no network later.
export function preloadPageSamples(address: string) {
  return Promise.all((samplesByPage[address] ?? []).map((sample) => sample.preloadBundledFile?.()))
}
