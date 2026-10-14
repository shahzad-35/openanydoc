// fast-formula-parser ships without types; only what excelFormulas.ts uses is declared.
declare module 'fast-formula-parser' {
  type CellReference = { sheet: string; row: number; col: number }
  type RangeReference = { sheet: string; from: { row: number; col: number }; to: { row: number; col: number } }
  type Hooks = {
    onCell: (reference: CellReference) => unknown
    onRange: (reference: RangeReference) => unknown[][]
  }
  export class FormulaError {
    constructor(error: string)
    error: string
  }
  export default class FormulaParser {
    constructor(hooks: Hooks)
    parse(formula: string, position: { sheet: string; row: number; col: number }): unknown
  }
}
