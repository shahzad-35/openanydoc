// Several tables with the same header, one after the other: the rows of each further file are added under the first table. Pure,
// so the CSV page's "Add rows from other CSV files" and a future "Merge CSV files" page can share it. The header must match name
// for name and in the same order (spaces at either end ignored); otherwise the first file that differs is named.

type NamedTable = { fileName: string; rows: string[][] }

export function appendTables(baseRows: string[][], others: NamedTable[]): { rows: string[][] } | { differingFileName: string } {
  const headerKey = (row: string[] = []) => row.map((name) => name.trim()).join('\u0000')
  const baseHeaderKey = headerKey(baseRows[0])
  const differing = others.find((table) => headerKey(table.rows[0]) !== baseHeaderKey)
  if (differing) return { differingFileName: differing.fileName }
  return { rows: [...baseRows, ...others.flatMap((table) => table.rows.slice(1))] }
}
