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

// One line's items (already in visual order) as one string in reading order.
function readLineRightToLeft(itemsLeftToRight: TextItem[]) {
  const runs: { direction: 'rtl' | 'ltr'; texts: string[] }[] = []
  for (const item of itemsLeftToRight) {
    const itemDirection = directionOf(item.str)
    // Spaces and punctuation join the run they sit in; a line read right to left starts and ends in a right-to-left run.
    const direction = itemDirection === 'neutral' ? (runs.at(-1)?.direction ?? 'rtl') : itemDirection
    if (runs.at(-1)?.direction !== direction) runs.push({ direction, texts: [] })
    runs.at(-1)!.texts.push(item.str)
  }
  return runs
    .reverse()
    .map((run) => (run.direction === 'ltr' ? run.texts.join('') : [...run.texts].reverse().map((text) => (text.length === 1 ? (MIRRORED_BRACKETS[text] ?? text) : text)).join('')))
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
      const left = itemsLeftToRight[0].transform[4]
      const right = Math.max(...lineItems.map((item) => item.transform[4] + item.width))
      const merged: TextItem = {
        ...itemsLeftToRight[0],
        str: readLineRightToLeft(itemsLeftToRight),
        dir: 'rtl',
        width: right - left,
        height: Math.max(...lineItems.map((item) => item.height)),
        hasEOL: lineItems.at(-1)!.hasEOL,
      }
      // The merged item takes the place of the line's first item; its other items are dropped, marked-content entries stay.
      let isMergedPlaced = false
      for (const entry of lineEntries) {
        if (!isTextItem(entry)) result.push(entry)
        else if (!isMergedPlaced) {
          result.push(merged)
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
      const previous = lineItems.at(-1)
      const isSameLine = previous && !previous.hasEOL && Math.abs(entry.transform[5] - previous.transform[5]) <= Math.max(previous.height, entry.height) * 0.3
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
