# SEO changes (October 2026)

What the technical SEO pass changed, what was left out on purpose, how it was measured, and what still has to be done by hand in Cloudflare, Google Search Console and Bing Webmaster Tools.

Commits: `7d6413d` crawlability, `d5b6623` sitemap lastmod and hreflang checks, `a145cde` structured data, `fcb3bdf` keywords, `d76d032` homepage, `6a5b297` brand, `92c1bef` landing pages, `f415dde` internal links. No performance commit was needed (see "Performance").

## Pages, titles, descriptions and H1

Read from the built `dist/<lang>/<page>/index.html` on 2026-10-17. The number after a title or description is its length in characters (titles at most 60, descriptions 150 to 160; `npm run test:privacy` fails otherwise).

### English

| Page | Title | Meta description | H1 |
|---|---|---|---|
| `/en` | Free Online File Viewer and Editor – OpenAnyDoc (47) | Free online file viewer and editor: open CSV, Excel (XLSX), JSON and TXT files without software and edit them in your browser. Private: no upload, no sign-up. (158) | Free Online File Viewer and Editor |
| `/en/csv-viewer` | CSV Viewer Online – Free CSV Editor, No Upload (46) | CSV viewer online and free CSV editor: open a CSV file online, view large CSV files, search, sort, edit cells and download. Private: nothing is uploaded. (153) | CSV Viewer Online and CSV Editor |
| `/en/excel-viewer` | Excel Viewer Online – Open XLSX Files Without Excel (51) | Excel viewer online: open XLSX, XLS, XLSM and ODS files without Excel, edit Excel online free with formulas that recalculate, and save. No upload, no sign-up. (158) | Excel Viewer Online: Open and Edit XLSX Files |
| `/en/json-viewer` | JSON Viewer Online – Formatter, Validator & Tree View (53) | JSON viewer online: a free JSON formatter, validator and tree viewer. Pretty print or minify JSON, fix errors by line and column, then download. No upload. (155) | JSON Viewer Online, Formatter and Editor |
| `/en/txt-viewer` | Open TXT File Online – Free Text Editor, No Upload (50) | Open TXT file online and edit it free: a text file viewer and online text editor with find and replace, sort lines, remove duplicates and word count. No upload. (160) | Open TXT File Online: Free Text Viewer and Editor |
| `/en/json-formatter` | JSON Formatter Online – Beautify and Pretty Print JSON (54) | JSON formatter online: beautify and pretty print JSON with 1, 2, 3, 4 or 8 spaces or a tab, minify it to one line or sort its keys. Free, nothing uploaded. (155) | JSON Formatter Online: Beautify and Minify JSON |
| `/en/json-validator` | JSON Validator Online – Find and Fix JSON Errors (48) | JSON validator online: check JSON syntax, see the line and column of an error, jump to it and repair trailing commas, comments and quotes. Free, no upload. (155) | JSON Validator Online: Check and Fix JSON |
| `/en/tsv-viewer` | TSV Viewer Online – Open TSV Files as a Table (45) | TSV viewer online: open a TSV or .tab file as a table, with tabs read as columns and the header row detected. Search, sort, edit and save it as TSV. No upload. (159) | TSV Viewer Online: Open Tab-Separated Files |
| `/en/large-csv-viewer` | Large CSV File Viewer – Open Big CSV Files Online (49) | Large CSV file viewer: open big CSV files in your browser with no row limit of its own. 120,000 rows opened in 0.9 s in our tests. Search and sort. No upload. (158) | Large CSV File Viewer: Open Big CSV Files Fast |
| `/en/xls-viewer` | XLS Viewer Online – Open Old Excel 97-2003 Files (48) | XLS viewer online: open old Excel 97-2003 .xls files without Excel, see every sheet, edit cells and formulas, and save as .xls. Free and private, no upload. (156) | XLS Viewer Online: Open Excel 97-2003 Files |
| `/en/about` | About OpenAnyDoc – Private Online File Viewer (45) | About OpenAnyDoc, built and run by Shahzad Ali: a free file viewer and editor that runs in your browser and never uploads files. CSV, Excel, JSON and TXT today. (160) | About OpenAnyDoc |
| `/en/privacy` | Privacy Policy – OpenAnyDoc (27) | OpenAnyDoc privacy policy: files open in your browser and are never uploaded. No analytics, no cookies, no tracking. What your browser keeps and who hosts us. (158) | Privacy Policy |
| `/en/terms` | Terms of Use – OpenAnyDoc (25) | OpenAnyDoc terms of use: the file viewer and editor is free and provided as is, without warranty. Keep your original files: you are responsible for your edits. (159) | Terms of Use |
| `/en/changelog` | OpenAnyDoc Changelog – New CSV, Excel, JSON & TXT Features (58) | See what's new in OpenAnyDoc, the free online viewer and editor for CSV, Excel (XLSX), JSON and TXT files, with every new feature listed by release and date. (157) | OpenAnyDoc changelog: what's new in our online CSV, Excel, JSON and TXT editors |

### Arabic

| Page | Title | Meta description | H1 |
|---|---|---|---|
| `/ar` | عارض ملفات اون لاين مجاني – فتح الملفات بدون برامج (50) | عارض ملفات اون لاين مجاني: افتح ملفات CSV وExcel وJSON وTXT وعدّلها في متصفحك. فتح الملفات بدون برامج وبدون تسجيل، وملفاتك لا تُرفع ولا تغادر جهازك أبدًا. (154) | عارض ملفات اون لاين مجاني ومحرر للملفات |
| `/ar/csv-viewer` | عارض CSV اون لاين – فتح ملف CSV وتعديله مجانًا (46) | عارض CSV اون لاين مجاني: فتح ملف CSV كجدول، والبحث والفرز وتعديل الخلايا مع عرض صحيح للحروف العربية، ثم التنزيل. تعديل ملف CSV اون لاين بدون رفع أي ملف. (152) | عارض CSV اون لاين ومحرر مجاني |
| `/ar/excel-viewer` | فتح ملف اكسل اون لاين – عارض ملفات XLSX مجاني (45) | فتح ملف اكسل اون لاين مجانًا: عارض ملفات XLSX وXLS وXLSM وODS، مع تعديل الخلايا والصيغ التي تُعاد حسابها ثم الحفظ. فتح ملف اكسل بدون برنامج وبدون رفع. (150) | فتح ملف اكسل اون لاين وتعديله بدون برنامج |
| `/ar/json-viewer` | عارض JSON اون لاين – تنسيق JSON وعرض شجري بدون رفع (50) | عارض JSON مجاني: فتح ملف JSON أو لصقه، وتنسيق JSON اون لاين والتحقق منه، وعرضه كشجرة أو جدول، وإصلاح الأخطاء بالسطر والعمود ثم تنزيله. بدون رفع أي ملف. (151) | عارض JSON اون لاين ومنسق ومحرر |
| `/ar/txt-viewer` | فتح ملف TXT اون لاين – محرر نصوص اون لاين مجاني (47) | فتح ملف TXT اون لاين وتعديله مجانًا: محرر نصوص اون لاين فيه بحث واستبدال، وفرز الأسطر وحذف المكرر منها، وتغيير حالة الأحرف وعدّ الكلمات. ملفك لا يُرفع أبدًا. (157) | فتح ملف TXT اون لاين: عارض ومحرر نصوص مجاني |
| `/ar/json-formatter` | تنسيق JSON اون لاين – تجميل JSON وتصغيره مجانًا (47) | تنسيق JSON اون لاين مجانًا: اجعل JSON مقروءًا بمسافة بادئة من 1 أو 2 أو 3 أو 4 أو 8 مسافات أو علامة جدولة، أو صغّره في سطر واحد ورتّب مفاتيحه. بدون رفع أي ملف. (159) | تنسيق JSON اون لاين: تجميل JSON وتصغيره |
| `/ar/json-validator` | التحقق من JSON اون لاين – اكتشاف أخطاء JSON وإصلاحها (52) | التحقق من JSON اون لاين مجانًا: افحص صياغة JSON واعرف سطر الخطأ وعموده وانتقل إليه، وأصلح الفواصل الزائدة والتعليقات وعلامات الاقتباس. لا يُرفع أي ملف أبدًا. (157) | التحقق من JSON اون لاين وإصلاح أخطائه |
| `/ar/tsv-viewer` | فتح ملف TSV اون لاين – عارض TSV مجاني كجدول (43) | فتح ملف TSV اون لاين مجانًا: اعرض ملف TSV أو .tab كجدول تُقرأ فيه علامات الجدولة كأعمدة ويُكتشف صف العناوين، ثم ابحث ورتّب وعدّل ونزّله TSV. بدون رفع. (150) | فتح ملف TSV اون لاين وعرضه كجدول |
| `/ar/large-csv-viewer` | عارض ملفات CSV الكبيرة – فتح ملف CSV كبير بسرعة (47) | عارض ملفات CSV الكبيرة مجانًا: افتح ملف CSV كبيرًا في متصفحك بلا حد للصفوف من عنده؛ فُتح ملف من 120,000 صف في 0.9 ثانية في اختباراتنا. بدون رفع أي ملف. (151) | عارض ملفات CSV الكبيرة: افتح الملفات الضخمة بسرعة |
| `/ar/xls-viewer` | فتح ملف XLS اون لاين – عارض ملفات Excel 97-2003 (47) | فتح ملف XLS اون لاين مجانًا: اعرض ملفات Excel 97-2003 القديمة بدون برنامج Excel، بكل أوراقها، وعدّل الخلايا والصيغ واحفظها بصيغة .xls. بدون رفع وبدون تسجيل. (156) | فتح ملف XLS اون لاين بدون برنامج Excel |
| `/ar/about` | عن OpenAnyDoc – عارض ملفات خاص اون لاين (39) | عن OpenAnyDoc الذي يبنيه ويديره شهزاد علي: عارض ومحرر ملفات مجاني يعمل في متصفحك ولا يرفع ملفاتك أبدًا. يدعم اليوم CSV وExcel وJSON وTXT، وقريبًا Word وPDF. (156) | عن OpenAnyDoc |
| `/ar/privacy` | سياسة الخصوصية – OpenAnyDoc (27) | سياسة الخصوصية في OpenAnyDoc: تُفتح الملفات في متصفحك ولا تُرفع أبدًا. لا تحليلات ولا ملفات تعريف ارتباط ولا تتبع. ما يحفظه المتصفح ومن يستضيف الموقع. (150) | سياسة الخصوصية |
| `/ar/terms` | شروط الاستخدام – OpenAnyDoc (27) | شروط استخدام OpenAnyDoc: عارض ومحرر الملفات مجاني ويُقدَّم كما هو دون أي ضمان. احتفظ دائمًا بملفاتك الأصلية، فأنت مسؤول عن الملفات التي تفتحها وتعدّلها. (152) | شروط الاستخدام |
| `/ar/changelog` | الجديد في OpenAnyDoc – محرر CSV وExcel وJSON اون لاين (53) | تعرّف على كل جديد في OpenAnyDoc: عارض ومحرر مجاني لملفات CSV وإكسل (XLSX) وJSON وTXT اون لاين، مع تفاصيل كل إصدار وتاريخه. ملفاتك لا تُرفع إلى أي خادم أبدًا. (157) | سجل التغييرات: الجديد في محررات CSV وExcel وJSON وTXT اون لاين |

## Addresses

### New addresses (both languages, all in the sitemap with `lastmod` and hreflang `en`, `ar` and `x-default`)
- `/en/json-formatter`, `/ar/json-formatter`
- `/en/json-validator`, `/ar/json-validator`
- `/en/tsv-viewer`, `/ar/tsv-viewer`
- `/en/large-csv-viewer`, `/ar/large-csv-viewer`
- `/en/xls-viewer`, `/ar/xls-viewer`

No address was renamed or deleted. The sitemap now lists 28 addresses.

### Redirects
| Request | Result | Where it is set |
|---|---|---|
| `/en/csv-viewer/` (trailing slash) | redirect to `/en/csv-viewer` (307 in `wrangler dev`; the status is chosen by Cloudflare) | `wrangler.jsonc`: `assets.html_handling: "drop-trailing-slash"` |
| `/en/csv-viewer` | 200, the prerendered page | static asset |
| `/` with `Accept-Language: ar...` | 302 to `/ar`, with `Vary: Accept-Language` and `Cache-Control: no-store` | `src/worker.ts` (the worker runs only for `/`) |
| `/` with no or another language | 302 to `/en` (crawlers send no language, so they get English) | `src/worker.ts` |
| `/csv-viewer`, `/excel-viewer`, `/json-viewer`, `/txt-viewer` (old addresses without a language) | 301 to `/en/...` | `public/_redirects` |
| `https://www.openanydoc.com/...` | should be 301 to `https://openanydoc.com/...` | **not done yet**: a Cloudflare dashboard rule, steps below |
| `http://...` | should be 301 to `https://...` | **not done yet**: "Always Use HTTPS", steps below |

All canonical, hreflang and sitemap addresses are the no-slash form, and no link in the built HTML ends in a slash (a test checks this).

## Structured data (JSON-LD, written into each page at build time)
| Page type | Types | Notes |
|---|---|---|
| Home (`/en`, `/ar`) | `WebSite`, `Organization`, `FAQPage` | WebSite: name, alternateName ("Open Any Doc", "OpenAnyDoc.com"), url, inLanguage. Organization: name, url, logo (`/logo.png`, 512 x 512 PNG), email `support@openanydoc.com`, founder Shahzad Ali. FAQPage: the 8 visible questions. |
| Tool pages (CSV, Excel, JSON, TXT) | `SoftwareApplication` + `WebApplication`, `FAQPage`, `BreadcrumbList` | applicationCategory `UtilitiesApplication`, operatingSystem "Any (web browser)", offers price 0 USD, featureList (true features only), url, inLanguage. Breadcrumb: Home › tool. |
| Landing pages (5) | the same three types | Breadcrumb: Home › viewer › page (for example Home › JSON viewer › JSON formatter). FAQ from the page's own questions. |
| About, Privacy, Terms | `BreadcrumbList` | |
| Changelog | none | |

The FAQPage data is built from the same text as the visible FAQ, and a test fails if they differ.

## Deliberately not done
- **Conversion pages** (csv-to-excel, excel-to-csv, csv-to-json, json-to-csv): nothing on the site converts files, and the project rule is that a download keeps the file's own format. A page for a feature that does not exist would mislead visitors and search engines. Listed in the pending items for when the feature is built.
- **"Works offline"**: not true. There is no service worker; the page keeps working without a network once it is loaded, but it is not an offline app, and the copy says exactly that.
- **WebP or AVIF for the share pictures**: the only raster images are the Open Graph pictures and `logo.png`, and neither appears on the page itself, so they do not affect page speed. Social networks and chat apps read PNG most reliably. Everything visible is inline SVG.
- **aggregateRating**: there are no real ratings or reviews, and invented ones break Google's rules.
- **sameAs**: there are no official profiles yet. Add the LinkedIn company page once it exists (checklist below).

## Performance

Lighthouse 12, default mobile throttling (and the desktop preset), served by `wrangler dev` so `_headers`, the worker and `html_handling` behave as in production. Scores are Performance / Accessibility / Best Practices / SEO.

| Page | Earlier pass (static server) | Start of this pass (`602a780`) | Final |
|---|---|---|---|
| `/en` mobile | 97 / 100 / 100 / 100, LCP 2.13 s, CLS 0 | 98 / 100 / 100 / 100, LCP 1.97 s, CLS 0 (97 and LCP 2.14 s when reached at `/en`, which then redirected to `/en/`) | 98 / 100 / 100 / 100, LCP 1.98 s, CLS 0, TBT 0 ms |
| `/en/csv-viewer` mobile | 97 / 100 / 100 / 100, LCP 2.12 s, CLS 0 | 98 / 100 / 100 / 100, LCP 1.98 s, CLS 0 | 98 / 100 / 100 / 100, LCP 1.97 s, CLS 0, TBT 24 ms |
| `/ar` mobile | 89, LCP 3.03 s, CLS 0.028 | 92, LCP 2.86 s, CLS 0 | 92 / 100 / 100 / 100, LCP 2.88 s, CLS 0 |
| `/en/json-viewer` mobile | 97, LCP 2.12 s | 98, LCP 1.97 s | 98, LCP 1.97 s |
| `/en/excel-viewer`, `/en/txt-viewer` mobile | 97, LCP 2.11 to 2.12 s | – | 98, LCP 1.96 to 1.97 s |
| `/en/json-formatter`, `/en/large-csv-viewer` mobile (new) | – | – | 98, LCP 1.98 to 1.99 s |
| `/ar/csv-viewer` mobile | – | – | 92, LCP 2.88 s, CLS 0 |
| Every page, desktop | 100 | 100 | 100 / 100 / 100 / 100, LCP 0.46 to 0.62 s |

- The new homepage text, the header nav, the related links and the landing pages did not slow anything down: the scores are the same as at `602a780`. Nothing needed fixing, so there is no performance commit.
- **Interaction (INP stand-in):** event timing (`PerformanceObserver`, type `event`) in headless Chrome at 390 x 800 with 4x CPU slowdown, real mouse events over CDP. Opening and closing the phone "All tools" menu: 24 ms each; the language switch (English to Arabic, done in the page): 32 to 40 ms. Well under 200 ms.
- **Arabic pages** stay at 92 on mobile with LCP about 2.9 s, unchanged by this pass: they load about 160 KB more (the two preloaded Arabic font weights and the Arabic strings). Not a target of this pass; noted in the pending items.
- These are local numbers (no brotli, no HTTP/2). Measure again on the live site after deploy.

## Cloudflare dashboard steps (for you)

These two settings cannot be set in code. Until they are on, `www.openanydoc.com` and `http://` serve duplicate copies of every page.

### 1. Check that `www` has a proxied DNS record
1. Log in at https://dash.cloudflare.com and click the **openanydoc.com** domain.
2. In the left menu click **DNS** → **Records**.
3. Look for a record whose **Name** is `www`.
   - If it exists, its **Proxy status** must show the orange cloud (**Proxied**). If it shows a grey cloud ("DNS only"), click **Edit**, switch the toggle to **Proxied**, click **Save**.
   - If there is none, click **Add record**: **Type** `AAAA`, **Name** `www`, **IPv6 address** `100::`, **Proxy status** Proxied, then **Save**. (`100::` is a placeholder address; Cloudflare answers the request itself and the redirect rule below sends it on, so nothing ever reaches that address.)
   - If the record's type shows **Worker** (www added as a Custom Domain of the worker), that is fine too: it is already proxied.
   - A redirect rule only runs on traffic that passes through Cloudflare, which is what the orange cloud means.

### 2. Redirect `www` to the apex domain (301)
1. Still in the **openanydoc.com** domain, open **Rules** in the left menu, then **Redirect Rules** (on newer dashboards: **Rules** → **Overview**, then **Create rule** → **Redirect Rule**).
2. Click **Create rule** and choose the template **Redirect from WWW to root** (if you see a list of templates, it is under "Redirect Rules").
3. Check what the template filled in:
   - **When incoming requests match**: hostname equals `www.openanydoc.com`.
   - **Then**: **Type** Dynamic, **Expression** `concat("https://openanydoc.com", http.request.uri.path)`, **Status code** `301`, **Preserve query string** ticked.
4. Give it a name such as "www to apex" and click **Deploy**.

### 3. Always use HTTPS
1. In the left menu click **SSL/TLS** → **Edge Certificates**.
2. Scroll to **Always Use HTTPS** and switch it **On**. Every `http://` request then gets a 301 to `https://`.

### 4. Check it worked
Run these in a terminal (a few minutes after saving):
```sh
curl -I https://www.openanydoc.com/en
# expect: HTTP/2 301 and  location: https://openanydoc.com/en

curl -I "https://www.openanydoc.com/en/csv-viewer?x=1"
# expect: 301 to https://openanydoc.com/en/csv-viewer?x=1 (path and query kept)

curl -I http://openanydoc.com/en
# expect: 301 to https://openanydoc.com/en
```

## Post-deploy checklist

After you push and the deploy finishes:

### Confirm the redirects live
```sh
curl -sI https://openanydoc.com/en | head -1                      # HTTP/2 200
curl -sI https://openanydoc.com/en/ | grep -i -e '^HTTP' -e '^location'     # redirect, location: /en
curl -sI https://openanydoc.com/ | grep -i -e '^HTTP' -e '^location'        # 302, location: /en
curl -sI -H 'Accept-Language: ar' https://openanydoc.com/ | grep -i -e '^HTTP' -e '^location'   # 302, location: /ar
curl -sI https://openanydoc.com/csv-viewer | grep -i -e '^HTTP' -e '^location'  # 301, location: /en/csv-viewer
curl -sI https://openanydoc.com/en/json-formatter | head -1        # HTTP/2 200
curl -s https://openanydoc.com/en | grep -c '<h1'                   # 1
curl -sI https://www.openanydoc.com/en | grep -i -e '^HTTP' -e '^location'  # 301 to https://openanydoc.com/en (after the dashboard steps)
```

### Google Search Console (https://search.google.com/search-console)
1. Check that the property is a **Domain** property for `openanydoc.com` (it covers www, http and https). If you only have a URL-prefix property, add the Domain property too (verified with a DNS TXT record in Cloudflare).
2. **Sitemaps**: submit (or resubmit) `https://openanydoc.com/sitemap.xml`. Status should become "Success" with 28 discovered pages.
3. **URL Inspection** → paste the address → **Request indexing**, for `/en`, `/ar`, each tool page (`/en/csv-viewer`, `/en/excel-viewer`, `/en/json-viewer`, `/en/txt-viewer`) and each landing page (`/en/json-formatter`, `/en/json-validator`, `/en/tsv-viewer`, `/en/large-csv-viewer`, `/en/xls-viewer`), then the same in `/ar`. Google allows only about 10 to 12 requests per property per day, so spread them over two or three days, English first.
4. **Rich Results Test** (https://search.google.com/test/rich-results) on `https://openanydoc.com/en`, `https://openanydoc.com/en/csv-viewer` and `https://openanydoc.com/en/json-formatter`. Expect FAQ, Breadcrumbs and Software App (and Organization on the home page) with no errors.
5. Every week for 4 weeks: **Indexing** → **Pages**. Watch the "Crawled – currently not indexed" and "Page with redirect" lists. Old `/en/` style addresses and `www` addresses showing as "Page with redirect" is expected.

### Bing Webmaster Tools (https://www.bing.com/webmasters)
1. Check the site is verified (you can import it from Search Console).
2. **Sitemaps**: submit `https://openanydoc.com/sitemap.xml`.
3. **URL Submission**: submit `/en`, `/ar` and the tool and landing pages.

### Getting known
- **Product Hunt**: launch page with the one-liner and screenshots from `.claude/launch-kit/`.
- **AlternativeTo**: add OpenAnyDoc as an alternative under "CSV viewer" (and "CSV editor") and "JSON viewer" (and "JSON formatter").
- **GitHub awesome-lists**: relevant lists of privacy-friendly or developer tools (for example lists of online JSON or CSV tools); read each list's contribution rules first.

### When the LinkedIn company page exists
Send the page address: it goes into the home page's `Organization` structured data as `sameAs` (in `scripts/build-static-pages.mjs`), and the home page is checked again in the Rich Results Test.
