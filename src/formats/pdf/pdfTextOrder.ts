// Puts right-to-left lines of a PDF's text back into reading order for the text layer (selection, copy) and the search.
// Some PDFs (Chrome's "Save as PDF" among them) place every Arabic glyph on its own, so pdf.js makes one text item per glyph and
// keeps them in visual order, left to right: selected or searched, the words read backwards. A line made mostly of Arabic letters
// is rebuilt as one item in reading order: its pieces are ordered right to left, a Latin word or number inside keeps its own order,
// and brackets in Arabic text are mirrored back to the character that was typed. Arabic presentation forms (the shaped letters
// some PDFs map their glyphs to) become the letters that were typed, so copied text and search see ordinary Arabic.
import type { PDFPageProxy } from 'pdfjs-dist'

type TextItem = { str: string; dir: string; width: number; height: number; transform: number[]; fontName: string; hasEOL: boolean }
type TextContentEntry = TextItem | { type: string }
type TextContentChunk = { items: TextContentEntry[]; styles: Record<string, unknown>; lang: string | null }

const RIGHT_TO_LEFT_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/u
const LEFT_TO_RIGHT_LETTER = /[A-Za-z0-9À-ɏ]/u
const MIRRORED_BRACKETS: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' }

const ARABIC_PRESENTATION_FORMS = /[\uFB50-\uFDFF\uFE70-\uFEFF]+/gu

const isTextItem = (entry: TextContentEntry): entry is TextItem => 'str' in entry
function withTypedArabicLetters(item: TextItem): TextItem {
  const str = item.str.replace(ARABIC_PRESENTATION_FORMS, (forms) => forms.normalize('NFKC'))
  return str === item.str ? item : { ...item, str }
}
const directionOf = (text: string) => (RIGHT_TO_LEFT_LETTER.test(text) ? 'rtl' : LEFT_TO_RIGHT_LETTER.test(text) ? 'ltr' : 'neutral')

const COMBINING_MARKS_ONLY = /^\p{M}+$/u
// A gap wider than this many text heights between two pieces of a line is a gap between table cells.
const COLUMN_GAP_HEIGHTS = 1.2
// A Latin piece's own spaces and punctuation at its ends ("." of ".OpenAnyDoc", as pdf.js gives it) are split off, so they can
// sit in the Arabic text around it.
const LATIN_PIECE_ENDS = /^([^A-Za-z0-9À-ɏ]*)(.*?)([^A-Za-z0-9À-ɏ]*)$/su

// One line's items (already in visual order) as one string in reading order. Spaces and punctuation inside a Latin piece stay in
// it; between a Latin and an Arabic piece, or at the line's ends, they belong to the Arabic text (the line reads right to left).
function readLineRightToLeft(itemsLeftToRight: TextItem[]) {
  const runs: { direction: 'rtl' | 'ltr'; texts: string[] }[] = []
  let neutralsAfterLatin: string[] = []
  const addToRun = (direction: 'rtl' | 'ltr', texts: string[]) => {
    if (runs.at(-1)?.direction !== direction) runs.push({ direction, texts: [] })
    runs.at(-1)!.texts.push(...texts)
  }
  const pieces = itemsLeftToRight.flatMap((item) => (directionOf(item.str) === 'ltr' ? LATIN_PIECE_ENDS.exec(item.str)!.slice(1).filter(Boolean) : [item.str]))
  for (const piece of pieces) {
    const direction = directionOf(piece)
    if (direction === 'neutral' && runs.at(-1)?.direction === 'ltr') neutralsAfterLatin.push(piece)
    else if (direction === 'ltr' && runs.at(-1)?.direction === 'ltr') addToRun('ltr', [...neutralsAfterLatin, piece])
    else {
      if (neutralsAfterLatin.length) addToRun('rtl', neutralsAfterLatin)
      addToRun(direction === 'ltr' ? 'ltr' : 'rtl', [piece])
    }
    if (direction !== 'neutral') neutralsAfterLatin = []
  }
  if (neutralsAfterLatin.length) addToRun('rtl', neutralsAfterLatin)
  // In an Arabic run a diacritic (a zero-width piece drawn over the letter on its left) stays after its letter when the run is reversed.
  const readRightToLeft = (texts: string[]) => {
    const letters: string[] = []
    for (const text of texts) {
      if (COMBINING_MARKS_ONLY.test(text) && letters.length) letters[letters.length - 1] += text
      else letters.push(text.length === 1 ? (MIRRORED_BRACKETS[text] ?? text) : text)
    }
    return letters.reverse().join('')
  }
  return runs
    .reverse()
    .map((run) => (run.direction === 'ltr' ? run.texts.join('') : readRightToLeft(run.texts)))
    .join('')
}

export function putRightToLeftLinesInReadingOrder(entries: TextContentEntry[]): TextContentEntry[] {
  const result: TextContentEntry[] = []
  // The current line's entries as they came (marked-content entries included) and its text items.
  let lineEntries: TextContentEntry[] = []
  let lineItems: TextItem[] = []

  const flushLine = () => {
    const rightToLeftItems = lineItems.filter((item) => directionOf(item.str) === 'rtl')
    const leftToRightItems = lineItems.filter((item) => directionOf(item.str) === 'ltr')
    // Only lines split into several Arabic pieces and mostly Arabic are rebuilt; any other line passes through as it came.
    if (rightToLeftItems.length >= 2 && rightToLeftItems.length >= leftToRightItems.length) {
      const itemsLeftToRight = [...lineItems].sort((first, second) => first.transform[4] - second.transform[4])
      // A table row is one line with wide gaps between its cells: each cell is rebuilt on its own and keeps its own place, and the
      // cells come in reading order, right to left, a space apart, so the gaps are not lost.
      const cells: TextItem[][] = []
      for (const item of itemsLeftToRight) {
        const cell = cells.at(-1)
        const cellRight = cell ? Math.max(...cell.map((cellItem) => cellItem.transform[4] + cellItem.width)) : 0
        if (cell && item.transform[4] - cellRight <= COLUMN_GAP_HEIGHTS * Math.max(item.height, cell[0].height)) cell.push(item)
        else cells.push([item])
      }
      const mergedCells = cells.reverse().map((cellItems, cellIndex): TextItem => {
        const left = cellItems[0].transform[4]
        const right = Math.max(...cellItems.map((item) => item.transform[4] + item.width))
        const isLastCell = cellIndex === cells.length - 1
        return {
          ...cellItems[0],
          str: readLineRightToLeft(cellItems) + (isLastCell ? '' : ' '),
          dir: 'rtl',
          width: right - left,
          height: Math.max(...cellItems.map((item) => item.height)),
          hasEOL: isLastCell && lineItems.at(-1)!.hasEOL,
        }
      })
      // The rebuilt cells take the place of the line's first item; its other items are dropped, marked-content entries stay.
      let isMergedPlaced = false
      for (const entry of lineEntries) {
        if (!isTextItem(entry)) result.push(entry)
        else if (!isMergedPlaced) {
          result.push(...mergedCells)
          isMergedPlaced = true
        }
      }
    } else {
      result.push(...lineEntries)
    }
    lineEntries = []
    lineItems = []
  }

  for (const originalEntry of entries) {
    const entry = isTextItem(originalEntry) ? withTypedArabicLetters(originalEntry) : originalEntry
    if (isTextItem(entry)) {
      // A diacritic sits above or below its letter, so it never starts a line, and the next letter is compared with the letter.
      const previous = lineItems.findLast((item) => !COMBINING_MARKS_ONLY.test(item.str)) ?? lineItems.at(-1)
      const isDiacritic = COMBINING_MARKS_ONLY.test(entry.str)
      const isSameLine = previous && !lineItems.at(-1)!.hasEOL && (isDiacritic || Math.abs(entry.transform[5] - previous.transform[5]) <= Math.max(previous.height, entry.height) * 0.3)
      if (previous && !isSameLine) flushLine()
      lineItems.push(entry)
    }
    lineEntries.push(entry)
  }
  flushLine()
  return result
}

// Every page's text goes through streamTextContent (getTextContent reads it too), so one wrapper covers the text layer and search.
let isPageTextReordered = false
export function reorderRightToLeftTextOf(page: PDFPageProxy) {
  if (isPageTextReordered) return
  isPageTextReordered = true
  const pagePrototype = Object.getPrototypeOf(page) as { streamTextContent: (...args: unknown[]) => ReadableStream<TextContentChunk> }
  const streamTextContent = pagePrototype.streamTextContent
  pagePrototype.streamTextContent = function (...args: unknown[]) {
    const original = streamTextContent.apply(this, args)
    return new ReadableStream<TextContentChunk>({
      async start(controller) {
        const reader = original.getReader()
        const whole: TextContentChunk = { items: [], styles: {}, lang: null }
        try {
          for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            whole.items.push(...chunk.value.items)
            Object.assign(whole.styles, chunk.value.styles)
            whole.lang ??= chunk.value.lang
          }
          controller.enqueue({ ...whole, items: putRightToLeftLinesInReadingOrder(whole.items) })
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })
  }
}
