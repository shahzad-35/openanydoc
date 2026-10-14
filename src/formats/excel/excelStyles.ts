// Cell styles (bold, colours, fills, alignment, borders) are read from .xlsx and .xlsm files with ExcelJS, because SheetJS
// Community does not return them. ExcelJS (about 1 MB) is loaded only when a workbook of those types is opened, and styles are
// skipped for large files, where holding a style per cell would be too much memory.

import type { Color, Workbook } from 'exceljs'
import type { CellStyle } from './excelEdits'

export const MAX_STYLED_FILE_BYTES = 8_000_000

export async function loadExcelJs() {
  const excelJsModule = (await import('exceljs')) as unknown as { default?: typeof import('exceljs') } & typeof import('exceljs')
  return excelJsModule.default ?? excelJsModule
}

const THEME_COLOR_NAMES = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']
const DEFAULT_THEME_COLORS = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47']

// The workbook's own theme colours, in the order Excel numbers them, or the standard Office ones.
function readThemeColors(workbook: Workbook) {
  const themeXml = String((workbook as unknown as { _themes?: Record<string, unknown> })._themes?.theme1 ?? '')
  return THEME_COLOR_NAMES.map((name, index) => {
    const match = new RegExp(`<a:${name}>\\s*<a:(?:srgbClr val|sysClr[^>]*lastClr)="([0-9A-Fa-f]{6})"`).exec(themeXml)
    return match ? match[1].toUpperCase() : DEFAULT_THEME_COLORS[index]
  })
}

// A tint lightens (positive) or darkens (negative) a colour; this is a close linear version of Excel's rule.
function applyTint(hexColor: string, tint: number) {
  const channels = [0, 2, 4].map((start) => parseInt(hexColor.slice(start, start + 2), 16))
  return channels
    .map((channel) => Math.round(tint < 0 ? channel * (1 + tint) : channel + (255 - channel) * tint))
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function toArgbColor(color: Partial<Color> | undefined, themeColors: string[]): Partial<Color> | undefined {
  if (!color) return undefined
  if (color.argb) return { argb: color.argb }
  if (color.theme !== undefined) return { argb: `FF${applyTint(themeColors[color.theme] ?? '000000', (color as { tint?: number }).tint ?? 0)}` }
  return undefined
}

// One style object is shared by all the cells that have it, so 100,000 styled cells cost a few objects, not 100,000.
export async function readWorkbookStyles(contents: ArrayBuffer, sheetNames: string[]) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(contents)
  const themeColors = readThemeColors(workbook)
  const sharedStyles = new Map<string, CellStyle>()
  const stylesBySheet = new Map<number, Map<string, CellStyle>>()

  sheetNames.forEach((sheetName, sheetIndex) => {
    const worksheet = workbook.getWorksheet(sheetName)
    if (!worksheet) return
    const stylesByCell = new Map<string, CellStyle>()
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const { font, fill, alignment, border } = cell.style
        const style: CellStyle = {}
        if (font) style.font = { ...font, color: toArgbColor(font.color, themeColors) }
        if (fill?.type === 'pattern' && fill.pattern === 'solid') style.fill = { ...fill, fgColor: toArgbColor(fill.fgColor, themeColors), bgColor: undefined }
        if (alignment) style.alignment = alignment
        if (border && Object.keys(border).length > 0) style.border = border
        const styleKey = JSON.stringify(style)
        let sharedStyle = sharedStyles.get(styleKey)
        if (!sharedStyle) {
          sharedStyle = style
          sharedStyles.set(styleKey, style)
        }
        stylesByCell.set(`${rowNumber - 1}:${columnNumber - 1}`, sharedStyle)
      })
    })
    stylesBySheet.set(sheetIndex, stylesByCell)
  })
  return stylesBySheet
}
