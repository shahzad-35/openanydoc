// Combining and comparing tables. Pure, so the CSV page's "Add rows from other CSV files", the Merge CSV page and the Compare CSV
// page share them. The first row of every table is its header; names are compared with spaces at either end ignored.

type NamedTable = { fileName: string; rows: string[][] }

const trimmedNames = (row: string[] = []) => row.map((name) => name.trim())

// Several tables with the same column names, one after the other: the rows of each further file are added under the first
// table, its columns put in the first table's order. A file whose names differ (a column missing, added or renamed) is named.
export function appendTables(baseRows: string[][], others: NamedTable[]): { rows: string[][] } | { differingFileName: string } {
  const baseHeader = trimmedNames(baseRows[0])
  const sortedBaseKey = [...baseHeader].sort().join('\u0000')
  const differing = others.find((table) => [...trimmedNames(table.rows[0])].sort().join('\u0000') !== sortedBaseKey)
  if (differing) return { differingFileName: differing.fileName }
  const reorderedRows = others.flatMap((table) => {
    const header = trimmedNames(table.rows[0])
    const sourcePositions = baseHeader.map((name) => header.indexOf(name))
    return table.rows.slice(1).map((row) => sourcePositions.map((position) => row[position] ?? ''))
  })
  return { rows: [...baseRows, ...reorderedRows] }
}

export type TableComparison = {
  addedRows: string[][]
  removedRows: string[][]
  changedRows: { key: string; changes: { column: string; oldText: string; newText: string }[]; newRow: string[] }[]
  columnsOnlyInOld: string[]
  columnsOnlyInNew: string[]
  // Keys that appear more than once in a file (only the first such row is compared), and rows without a key.
  repeatedKeys: string[]
  rowsWithoutKey: number
  // The new file's header: every row above is in its column order (a removed row's values are put in it by name).
  header: string[]
}

// The old and new versions of a table, matched row by row on one key column: rows only in the new one are added, rows only in
// the old one removed, and rows in both with any different cell (compared as text) changed.
export function compareByKey(oldRows: string[][], newRows: string[][], keyColumn: string): TableComparison {
  const oldHeader = trimmedNames(oldRows[0])
  const newHeader = trimmedNames(newRows[0])
  const sharedColumns = newHeader.filter((name) => oldHeader.includes(name))
  const repeatedKeys = new Set<string>()
  let rowsWithoutKey = 0
  const indexByKey = (rows: string[][], header: string[]) => {
    const keyPosition = header.indexOf(keyColumn)
    const rowsByKey = new Map<string, string[]>()
    for (const row of rows.slice(1)) {
      const key = (row[keyPosition] ?? '').trim()
      if (key === '') rowsWithoutKey++
      else if (rowsByKey.has(key)) repeatedKeys.add(key)
      else rowsByKey.set(key, row)
    }
    return rowsByKey
  }
  const oldByKey = indexByKey(oldRows, oldHeader)
  const newByKey = indexByKey(newRows, newHeader)
  const inNewOrder = (oldRow: string[]) => newHeader.map((name) => (oldHeader.includes(name) ? (oldRow[oldHeader.indexOf(name)] ?? '') : ''))
  const changedRows: TableComparison['changedRows'] = []
  for (const [key, newRow] of newByKey) {
    const oldRow = oldByKey.get(key)
    if (!oldRow) continue
    const changes = sharedColumns
      .map((column) => ({ column, oldText: oldRow[oldHeader.indexOf(column)] ?? '', newText: newRow[newHeader.indexOf(column)] ?? '' }))
      .filter((change) => change.oldText !== change.newText)
    if (changes.length > 0) changedRows.push({ key, changes, newRow })
  }
  return {
    addedRows: [...newByKey].filter(([key]) => !oldByKey.has(key)).map(([, row]) => row),
    removedRows: [...oldByKey].filter(([key]) => !newByKey.has(key)).map(([, row]) => inNewOrder(row)),
    changedRows,
    columnsOnlyInOld: oldHeader.filter((name) => !newHeader.includes(name)),
    columnsOnlyInNew: newHeader.filter((name) => !oldHeader.includes(name)),
    repeatedKeys: [...repeatedKeys],
    rowsWithoutKey,
    header: newHeader,
  }
}
