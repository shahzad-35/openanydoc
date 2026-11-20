// A table's other file formats (Markdown, HTML, SQL INSERT statements, XML, LaTeX, fixed-width text) and its split into parts.
// Pure functions over rows of cell text, the header first; the CSV page's download dialog, the CSV/Excel to ... pages
// (src/tools/data/TableToText.tsx) and the Split CSV page use them.
// The first row is the header in all of them.

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const NUMBER_PATTERN = /^[-+]?\d+(\.\d+)?$/

// A Markdown (GitHub) table: pipes escaped, line breaks inside a cell become <br>.
export function buildMarkdownTable(rows: string[][]) {
  const [header = [], ...dataRows] = rows
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
  const line = (cells: string[]) => `| ${header.map((_, position) => cell(cells[position] ?? '')).join(' | ')} |`
  return [line(header), `| ${header.map(() => '---').join(' | ')} |`, ...dataRows.map(line)].join('\n') + '\n'
}

// The <table> alone, to paste into a page. Cells follow their own text direction (dir="auto").
export function buildHtmlTableElement(rows: string[][]) {
  const [header = [], ...dataRows] = rows
  const headerCells = header.map((text) => `<th dir="auto">${escapeHtml(text)}</th>`).join('')
  const bodyRows = dataRows.map((row) => `<tr>${header.map((_, position) => `<td dir="auto">${escapeHtml(row[position] ?? '')}</td>`).join('')}</tr>`).join('\n')
  return `<table>\n<thead><tr>${headerCells}</tr></thead>\n<tbody>\n${bodyRows}\n</tbody>\n</table>\n`
}

// A whole HTML page holding the table, so it opens in a browser as it is.
export function buildHtmlTable(rows: string[][], title: string) {
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n${buildHtmlTableElement(rows)}</body>\n</html>\n`
}

// An XML element name from a column name: letters, digits, "_", "-" and "."; it starts with a letter or "_".
function toXmlElementName(name: string, position: number) {
  const elementName = name.trim().replace(/[^\p{L}\p{N}_.-]+/gu, '_') || `column_${position + 1}`
  return /^[\p{L}_]/u.test(elementName) ? elementName : `_${elementName}`
}

// <rows><row><name>value</name>…</row>…</rows>; every value is text, with <, > and & escaped.
export function buildXmlRows(rows: string[][], rootName: string, rowName: string) {
  const [header = [], ...dataRows] = rows
  const elementNames = header.map(toXmlElementName)
  const root = toXmlElementName(rootName, 0)
  const row = toXmlElementName(rowName, 0)
  const rowElements = dataRows.map((cells) => `  <${row}>\n${elementNames.map((name, position) => `    <${name}>${escapeHtml(cells[position] ?? '').replace(/&quot;/g, '"')}</${name}>`).join('\n')}\n  </${row}>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n${rowElements.join('\n')}\n</${root}>\n`
}

// A LaTeX tabular: one left-aligned column per column, rules above and below the header and at the end; the ten special
// characters escaped. The tabular only (no table float, caption or label).
export function buildLatexTable(rows: string[][]) {
  const [header = [], ...dataRows] = rows
  const latexSpecials: Record<string, string> = { '&': '\\&', '%': '\\%', $: '\\$', '#': '\\#', _: '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}', '\\': '\\textbackslash{}' }
  const escapeLatex = (text: string) => text.replace(/[&%$#_{}~^\\]/g, (character) => latexSpecials[character]).replace(/\r?\n/g, ' ')
  const line = (cells: string[]) => `${header.map((_, position) => escapeLatex(cells[position] ?? '')).join(' & ')} \\\\`
  return [`\\begin{tabular}{${'l'.repeat(header.length)}}`, '\\hline', line(header), '\\hline', ...dataRows.map(line), '\\hline', '\\end{tabular}'].join('\n') + '\n'
}

// The width a text takes in a monospaced font: wide (CJK, full-width) characters count as two.
const displayWidth = (text: string) => Array.from(text).reduce((width, character) => width + (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u.test(character) ? 2 : 1), 0)

// Plain text with every column padded to its widest cell and `gap` spaces between columns; the header is underlined with dashes.
export function buildFixedWidthText(rows: string[][], gap: number) {
  const [header = [], ...dataRows] = rows
  const cleanRows = [header, ...dataRows].map((cells) => header.map((_, position) => (cells[position] ?? '').replace(/\s+/g, ' ')))
  const widths = header.map((_, position) => Math.max(...cleanRows.map((cells) => displayWidth(cells[position]))))
  const line = (cells: string[]) => cells.map((cell, position) => cell + ' '.repeat(widths[position] - displayWidth(cell))).join(' '.repeat(gap)).trimEnd()
  const [headerLine, ...dataLines] = cleanRows.map(line)
  return [headerLine, widths.map((width) => '-'.repeat(width)).join(' '.repeat(gap)), ...dataLines].join('\n') + '\n'
}

// A name SQL accepts without quoting trouble: letters, digits and underscores, not starting with a digit.
export function toSqlTableName(fileName: string) {
  const name = fileName.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '')
  return /^\p{N}/u.test(name) || name === '' ? `t_${name}` : name
}

// CREATE TABLE, then one INSERT per row. Identifiers are double-quoted; a column is a number column when every filled cell is a
// plain number (then empty cells become NULL); text has its single quotes doubled.
export function buildSqlInserts(rows: string[][], tableName: string) {
  const [header = [], ...dataRows] = rows
  const quoteName = (name: string) => `"${name.replace(/"/g, '""')}"`
  const isNumberColumn = header.map((_, position) => {
    const filled = dataRows.map((row) => (row[position] ?? '').trim()).filter((text) => text !== '')
    return filled.length > 0 && filled.every((text) => NUMBER_PATTERN.test(text))
  })
  const columnList = header.map((name, position) => quoteName(name || `column_${position + 1}`)).join(', ')
  const createTable = `CREATE TABLE ${quoteName(tableName)} (${header.map((name, position) => `${quoteName(name || `column_${position + 1}`)} ${isNumberColumn[position] ? 'REAL' : 'TEXT'}`).join(', ')});`
  const value = (text: string, position: number) => {
    if (isNumberColumn[position]) return text.trim() === '' ? 'NULL' : text.trim()
    return `'${text.replace(/'/g, "''")}'`
  }
  const inserts = dataRows.map((row) => `INSERT INTO ${quoteName(tableName)} (${columnList}) VALUES (${header.map((_, position) => value(row[position] ?? '', position)).join(', ')});`)
  return [createTable, ...inserts].join('\n') + '\n'
}

// The rows in parts of `rowsPerPart` data rows each, every part starting with the header.
export function splitIntoParts(rows: string[][], rowsPerPart: number) {
  const [header = [], ...dataRows] = rows
  const parts: string[][][] = []
  for (let start = 0; start < dataRows.length; start += rowsPerPart) parts.push([header, ...dataRows.slice(start, start + rowsPerPart)])
  return parts
}

// The rows in parts of about `maxBytes` each (UTF-8, a comma between cells), every part starting with the header; a row larger
// than the limit gets a part of its own.
export function splitIntoPartsBySize(rows: string[][], maxBytes: number) {
  const [header = [], ...dataRows] = rows
  const encoder = new TextEncoder()
  const measureBytes = (row: string[]) => encoder.encode(row.join(',')).length + 2
  const headerBytes = measureBytes(header)
  const parts: string[][][] = []
  let currentPart: string[][] = [header]
  let currentBytes = headerBytes
  for (const row of dataRows) {
    const rowBytes = measureBytes(row)
    if (currentPart.length > 1 && currentBytes + rowBytes > maxBytes) {
      parts.push(currentPart)
      currentPart = [header]
      currentBytes = headerBytes
    }
    currentPart.push(row)
    currentBytes += rowBytes
  }
  if (currentPart.length > 1) parts.push(currentPart)
  return parts
}
