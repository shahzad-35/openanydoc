// A table's other file formats (Markdown table, HTML table, SQL INSERT statements) and its split into parts. Pure functions over
// rows of cell text, the header first; the CSV page's download dialog uses them, and so can a future converter or "Split CSV" page.
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

// A whole HTML page holding the table, so it opens in a browser as it is. Cells follow their own text direction (dir="auto").
export function buildHtmlTable(rows: string[][], title: string) {
  const [header = [], ...dataRows] = rows
  const headerCells = header.map((text) => `<th dir="auto">${escapeHtml(text)}</th>`).join('')
  const bodyRows = dataRows.map((row) => `<tr>${header.map((_, position) => `<td dir="auto">${escapeHtml(row[position] ?? '')}</td>`).join('')}</tr>`).join('\n')
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n<table>\n<thead><tr>${headerCells}</tr></thead>\n<tbody>\n${bodyRows}\n</tbody>\n</table>\n</body>\n</html>\n`
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
