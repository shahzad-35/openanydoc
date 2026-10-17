// The text tools of a plain text file that need no page: line transforms, statistics and hidden characters. Everything here is
// pure and returns ids, numbers and codes, never sentences; the page turns them into words in the active language.

export type TextToolId =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'inverse'
  | 'camel'
  | 'snake'
  | 'kebab'
  | 'trimTrailingSpaces'
  | 'trimBothEnds'
  | 'trimExtraSpaces'
  | 'collapseSpaces'
  | 'removeBlankLines'
  | 'collapseBlankLines'
  | 'tabsToSpaces'
  | 'spacesToTabs'
  | 'indent'
  | 'outdent'
  | 'sortAscending'
  | 'sortDescending'
  | 'sortNumeric'
  | 'sortNatural'
  | 'sortByLength'
  | 'reverseLines'
  | 'shuffleLines'
  | 'removeDuplicateLines'
  | 'onlyDuplicateLines'
  | 'joinLines'
  | 'splitLines'
  | 'numberLines'
  | 'removeLineNumbers'
  | 'addPrefixSuffix'
  | 'wrapInQuotes'
  | 'hardWrap'
  | 'unwrapParagraphs'
  | 'truncateLines'
  | 'removeAccents'
  | 'smartToAscii'
  | 'removeInvisibleMarks'
  | 'removeNonPrintable'
  | 'stripHtmlTags'
  | 'normalizeNfc'
  | 'normalizeNfd'
  | 'insertDateTime'

// Inserting the date works at the cursor, not on lines, so it is the one tool that cannot be a transform or a chain step.
export type TextTransformId = Exclude<TextToolId, 'insertDateTime'>

// Each tool reads only the options it needs; anything left out comes from TEXT_TOOL_DEFAULT_OPTIONS.
export type TextToolOptions = {
  // Sort A–Z, Z–A and natural, and remove duplicates.
  ignoreCase?: boolean
  tabWidth?: number
  // Join and split; `\n` and `\t` stand for a line break and a tab.
  separator?: string
  separatorIsRegex?: boolean
  skipBlankLines?: boolean
  startNumber?: number
  // `{n}` is the number, `{0n}` the number padded with zeros: '{n}. ', '{n}) ', '{n}: ', '[{n}] ', '{0n}. '.
  numberFormat?: string
  prefix?: string
  suffix?: string
  // Two characters: the opening and the closing one ('""', '()', '«»' ...).
  wrapPair?: string
  width?: number
  endWithEllipsis?: boolean
  // Shuffle; tests pass a seeded one.
  random?: () => number
}

export const TEXT_TOOL_DEFAULT_OPTIONS: Partial<Record<TextTransformId, TextToolOptions>> = {
  tabsToSpaces: { tabWidth: 4 },
  spacesToTabs: { tabWidth: 4 },
  joinLines: { separator: ', ', skipBlankLines: true },
  splitLines: { separator: ', ', separatorIsRegex: false },
  numberLines: { startNumber: 1, numberFormat: '{n}. ', skipBlankLines: true },
  addPrefixSuffix: { prefix: '- ', suffix: '', skipBlankLines: true },
  wrapInQuotes: { wrapPair: '""', skipBlankLines: true },
  hardWrap: { width: 72 },
  truncateLines: { width: 60, endWithEllipsis: true },
}

// Tools that change characters, not lines: with a selection they change exactly the selected text.
export const CHARACTER_TOOL_IDS: ReadonlySet<TextToolId> = new Set<TextToolId>([
  'upper',
  'lower',
  'title',
  'sentence',
  'inverse',
  'removeAccents',
  'smartToAscii',
  'removeInvisibleMarks',
  'removeNonPrintable',
  'stripHtmlTags',
  'normalizeNfc',
  'normalizeNfd',
])

const isBlank = (line: string) => line.trim() === ''
const unescapeTabsAndBreaks = (text: string) => text.replace(/\\(n|t|\\)/g, (_match, code: string) => (code === 'n' ? '\n' : code === 't' ? '\t' : '\\'))
const firstNumberIn = (line: string) => {
  const found = line.match(/-?\d+(?:\.\d+)?/)
  return found ? parseFloat(found[0]) : Infinity
}
// The words of a name, split at spaces, punctuation and lowercase-to-uppercase steps ("userName" is "user" and "Name").
const nameWords = (text: string) => text.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').match(/[\p{L}\p{N}]+/gu) ?? []
const keepingIndent = (change: (text: string) => string) => (line: string) => {
  const indent = line.match(/^\s*/)![0]
  return indent + change(line.slice(indent.length))
}
const lineCollator = (numeric: boolean, ignoreCase: boolean) => new Intl.Collator('en', { numeric, sensitivity: ignoreCase ? 'base' : 'variant', caseFirst: 'upper' })
const INVISIBLE_MARKS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g

function hardWrapLine(line: string, width: number) {
  if (line.length <= width) return [line]
  const indent = line.match(/^\s*/)![0]
  const wrappedLines: string[] = []
  let currentLine = ''
  for (const word of line.slice(indent.length).split(/ +/)) {
    if (currentLine && (indent + currentLine + ' ' + word).length > width) {
      wrappedLines.push(indent + currentLine)
      currentLine = word
    } else currentLine = currentLine ? currentLine + ' ' + word : word
  }
  if (currentLine) wrappedLines.push(indent + currentLine)
  return wrappedLines
}

function unwrapParagraphs(lines: string[]) {
  const unwrappedLines: string[] = []
  let paragraph: string | null = null
  for (const line of lines) {
    if (isBlank(line)) {
      if (paragraph !== null) unwrappedLines.push(paragraph)
      paragraph = null
      unwrappedLines.push(line)
    } else paragraph = paragraph === null ? line.replace(/\s+$/, '') : paragraph + ' ' + line.trim()
  }
  if (paragraph !== null) unwrappedLines.push(paragraph)
  return unwrappedLines
}

function numberLines(lines: string[], options: TextToolOptions) {
  let number = Number(options.startNumber) || 0
  const digitCount = String(number + lines.length).length
  return lines.map((line) => {
    if (options.skipBlankLines && isBlank(line)) return line
    const numberText = String(number++)
    return options.numberFormat!.replace('{n}', numberText).replace('{0n}', numberText.padStart(digitCount, '0')) + line
  })
}

function splitLines(lines: string[], options: TextToolOptions) {
  if (!options.separator) return lines
  if (!options.separatorIsRegex) return lines.flatMap((line) => line.split(unescapeTabsAndBreaks(options.separator!)))
  try {
    const separatorPattern = new RegExp(options.separator, 'u')
    return lines.flatMap((line) => line.split(separatorPattern))
  } catch {
    return lines
  }
}

function shuffleLines(lines: string[], random: () => number) {
  const shuffled = lines.slice()
  for (let position = shuffled.length - 1; position > 0; position--) {
    const otherPosition = Math.floor(random() * (position + 1))
    ;[shuffled[position], shuffled[otherPosition]] = [shuffled[otherPosition], shuffled[position]]
  }
  return shuffled
}

function removeDuplicateLines(lines: string[], ignoreCase: boolean) {
  const seenLines = new Set<string>()
  return lines.filter((line) => {
    if (isBlank(line)) return true
    const key = ignoreCase ? line.toLowerCase() : line
    if (seenLines.has(key)) return false
    seenLines.add(key)
    return true
  })
}

// Each line that occurs more than once, once, in the order it first appears.
function onlyDuplicateLines(lines: string[]) {
  const timesSeen = new Map<string, number>()
  for (const line of lines) if (!isBlank(line)) timesSeen.set(line, (timesSeen.get(line) ?? 0) + 1)
  const keptLines = new Set<string>()
  return lines.filter((line) => (timesSeen.get(line) ?? 0) > 1 && !keptLines.has(line) && Boolean(keptLines.add(line)))
}

const lineTransforms: Record<TextTransformId, (lines: string[], options: TextToolOptions) => string[]> = {
  upper: (lines) => lines.map((line) => line.toUpperCase()),
  lower: (lines) => lines.map((line) => line.toLowerCase()),
  title: (lines) => lines.map((line) => line.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toUpperCase())),
  sentence: (lines) => lines.map((line) => line.toLowerCase().replace(/(^[^\p{L}]*|[.!?…]\s+)(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toUpperCase())),
  inverse: (lines) => lines.map((line) => [...line].map((character) => (character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase())).join('')),
  camel: (lines) =>
    lines.map(keepingIndent((text) => nameWords(text).map((word, position) => (position ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase())).join(''))),
  snake: (lines) => lines.map(keepingIndent((text) => nameWords(text).map((word) => word.toLowerCase()).join('_'))),
  kebab: (lines) => lines.map(keepingIndent((text) => nameWords(text).map((word) => word.toLowerCase()).join('-'))),

  trimTrailingSpaces: (lines) => lines.map((line) => line.replace(/[ \t ]+$/, '')),
  trimBothEnds: (lines) => lines.map((line) => line.trim()),
  trimExtraSpaces: (lines) => lines.map((line) => line.trim().replace(/[ \t]+/g, ' ')),
  collapseSpaces: (lines) => lines.map((line) => line.replace(/(\S)[ \t]{2,}(?=\S)/g, '$1 ')),
  removeBlankLines: (lines) => lines.filter((line) => !isBlank(line)),
  collapseBlankLines: (lines) => lines.filter((line, position) => !(isBlank(line) && position > 0 && isBlank(lines[position - 1]))),
  tabsToSpaces: (lines, options) =>
    lines.map((line) => {
      const tabWidth = Number(options.tabWidth) || 4
      let expandedLine = ''
      for (const character of line) expandedLine += character === '\t' ? ' '.repeat(tabWidth - (expandedLine.length % tabWidth)) : character
      return expandedLine
    }),
  spacesToTabs: (lines, options) => {
    const tabWidth = Number(options.tabWidth) || 4
    return lines.map((line) => line.replace(/^ +/, (spaces) => '\t'.repeat(Math.floor(spaces.length / tabWidth)) + ' '.repeat(spaces.length % tabWidth)))
  },
  indent: (lines) => lines.map((line) => (isBlank(line) ? line : '  ' + line)),
  outdent: (lines) => lines.map((line) => line.replace(/^(\t| {1,2})/, '')),

  sortAscending: (lines, options) => lines.slice().sort(lineCollator(false, Boolean(options.ignoreCase)).compare),
  sortDescending: (lines, options) => {
    const collator = lineCollator(false, Boolean(options.ignoreCase))
    return lines.slice().sort((firstLine, secondLine) => collator.compare(secondLine, firstLine))
  },
  sortNumeric: (lines) => lines.slice().sort((firstLine, secondLine) => firstNumberIn(firstLine) - firstNumberIn(secondLine) || 0),
  sortNatural: (lines, options) => lines.slice().sort(lineCollator(true, Boolean(options.ignoreCase)).compare),
  sortByLength: (lines) => lines.slice().sort((firstLine, secondLine) => firstLine.length - secondLine.length),
  reverseLines: (lines) => lines.slice().reverse(),
  shuffleLines: (lines, options) => shuffleLines(lines, options.random ?? Math.random),
  removeDuplicateLines: (lines, options) => removeDuplicateLines(lines, Boolean(options.ignoreCase)),
  onlyDuplicateLines,
  joinLines: (lines, options) => [(options.skipBlankLines ? lines.filter((line) => !isBlank(line)) : lines).join(unescapeTabsAndBreaks(options.separator ?? ''))],
  splitLines,

  numberLines,
  removeLineNumbers: (lines) => lines.map((line) => line.replace(/^(\s*)(?:\d+[.):]|\[\d+\]|[-*•+])\s+/, '$1')),
  addPrefixSuffix: (lines, options) =>
    lines.map((line) => (options.skipBlankLines && isBlank(line) ? line : unescapeTabsAndBreaks(options.prefix ?? '') + line + unescapeTabsAndBreaks(options.suffix ?? ''))),
  wrapInQuotes: (lines, options) => {
    const [opening = '', closing = ''] = [...(options.wrapPair ?? '')]
    return lines.map((line) => (options.skipBlankLines && isBlank(line) ? line : opening + line + closing))
  },

  hardWrap: (lines, options) => lines.flatMap((line) => hardWrapLine(line, Number(options.width) || 72)),
  unwrapParagraphs,
  truncateLines: (lines, options) => {
    const width = Number(options.width) || 60
    return lines.map((line) => (line.length <= width ? line : options.endWithEllipsis ? line.slice(0, width - 1) + '…' : line.slice(0, width)))
  },

  removeAccents: (lines) => lines.map((line) => line.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')),
  smartToAscii: (lines) =>
    lines.map((line) =>
      line
        .replace(/[‘’‚‛‹›]/g, "'")
        .replace(/[“”„‟«»]/g, '"')
        .replace(/[–—―]/g, '-')
        .replace(/…/g, '...')
        .replace(/ /g, ' '),
    ),
  removeInvisibleMarks: (lines) => lines.map((line) => line.replace(INVISIBLE_MARKS, '')),
  // oxlint-disable-next-line no-control-regex -- removing control characters is the point
  removeNonPrintable: (lines) => lines.map((line) => line.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '')),
  stripHtmlTags: (lines) => lines.map((line) => line.replace(/<[^>]*>/g, '')),
  normalizeNfc: (lines) => lines.map((line) => line.normalize('NFC')),
  normalizeNfd: (lines) => lines.map((line) => line.normalize('NFD')),
}

// One tool on a list of lines, with its default options filled in.
export function transformLines(lines: string[], toolId: TextTransformId, options: TextToolOptions = {}) {
  return lineTransforms[toolId](lines, { ...TEXT_TOOL_DEFAULT_OPTIONS[toolId], ...options })
}

// ---------------------------------------------------------------- statistics

const READING_WORDS_PER_MINUTE = 238
const SPEAKING_WORDS_PER_MINUTE = 150
const TOP_ENTRY_COUNT = 10
const LONGEST_LINE_COUNT = 4
const COMMON_ENGLISH_WORDS = new Set('the a an and or of to in on for is are be it this that with as at by from so has have should can will not no'.split(' '))
const WORD_PATTERN = /\p{L}[\p{L}\p{M}\p{N}'’-]*/gu
const wordSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null

// Calls `onWord` for each word, split the way the browser splits words for its language rules (Arabic included), or by letters
// where it cannot. `isFirstOnLine` lets a caller pair only words on the same line.
function forEachWord(text: string, onWord: (word: string, isFirstOnLine: boolean) => void) {
  let isFirstOnLine = true
  if (wordSegmenter) {
    for (const segment of wordSegmenter.segment(text)) {
      if (segment.isWordLike) {
        onWord(segment.segment, isFirstOnLine)
        isFirstOnLine = false
      } else if (segment.segment.includes('\n')) isFirstOnLine = true
    }
    return
  }
  let previousWordEnd = 0
  for (const found of text.matchAll(WORD_PATTERN)) {
    onWord(found[0], previousWordEnd === 0 || text.lastIndexOf('\n', found.index) >= previousWordEnd)
    previousWordEnd = found.index + found[0].length
  }
}

function countWords(text: string) {
  let wordCount = 0
  forEachWord(text, () => wordCount++)
  return wordCount
}

function countSentences(text: string) {
  let sentenceCount = 0
  for (const sentence of text.split(/(?<=[.!?…؟])\s+|\n\s*\n/)) if (/\p{L}/u.test(sentence)) sentenceCount++
  return sentenceCount
}

const countNonSpaceCharacters = (text: string) => text.replace(/\s+/g, '').length

// The `count` most frequent entries, most frequent first, ties in code-unit order. One pass, no sort of every entry.
function mostFrequent(counts: Map<string, number>, count: number, isIncluded: (key: string) => boolean = () => true) {
  const best: [string, number][] = []
  const comesBefore = (first: [string, number], second: [string, number]) => first[1] > second[1] || (first[1] === second[1] && first[0] < second[0])
  for (const entry of counts) {
    if (best.length === count && !comesBefore(entry, best[count - 1])) continue
    if (!isIncluded(entry[0])) continue
    let position = Math.min(best.length, count - 1)
    best[position] = entry
    while (position > 0 && comesBefore(best[position], best[position - 1])) {
      ;[best[position], best[position - 1]] = [best[position - 1], best[position]]
      position--
    }
  }
  return best
}

export type TextStats = {
  wordCount: number
  characterCount: number
  characterCountWithoutSpaces: number
  lineCount: number
  blankLineCount: number
  sentenceCount: number
  paragraphCount: number
  uniqueWordCount: number
  readingSeconds: number
  speakingSeconds: number
  // Line numbers start at 0; longest first.
  longestLines: { line: number; length: number }[]
  topWords: [string, number][]
  topPhrases: [string, number][]
  // Every letter (lower case) with its count, most frequent first.
  letterFrequency: [string, number][]
}

// The statistics of the whole text. `skipCommonWords` leaves short and common English words out of the top words only.
export function computeTextStats(text: string, skipCommonWords = true): TextStats {
  const lines = text.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const wordCounts = new Map<string, number>()
  const phraseCounts = new Map<string, number>()
  const longestLines: { line: number; length: number }[] = []
  let blankLineCount = 0
  let paragraphCount = 0
  let isInParagraph = false
  lines.forEach((line, lineNumber) => {
    if (longestLines.length < LONGEST_LINE_COUNT || line.length > longestLines[longestLines.length - 1].length) {
      longestLines.push({ line: lineNumber, length: line.length })
      longestLines.sort((first, second) => second.length - first.length || first.line - second.line)
      if (longestLines.length > LONGEST_LINE_COUNT) longestLines.pop()
    }
    if (isBlank(line)) blankLineCount++
    else if (!isInParagraph) paragraphCount++
    isInParagraph = !isBlank(line)
  })

  let wordCount = 0
  let previousWord = ''
  forEachWord(text, (word, isFirstOnLine) => {
    const lowerCaseWord = word.toLowerCase()
    wordCount++
    wordCounts.set(lowerCaseWord, (wordCounts.get(lowerCaseWord) ?? 0) + 1)
    if (!isFirstOnLine) {
      const phrase = previousWord + ' ' + lowerCaseWord
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
    }
    previousWord = lowerCaseWord
  })

  // Counted per UTF-16 unit, which is fast; letters outside the Basic Multilingual Plane are left out.
  const lowerCaseText = text.toLowerCase()
  const characterCounts = new Uint32Array(65536)
  for (let position = 0; position < lowerCaseText.length; position++) characterCounts[lowerCaseText.charCodeAt(position)]++
  const letterFrequency: [string, number][] = []
  characterCounts.forEach((count, characterCode) => {
    if (count > 0 && /\p{L}/u.test(String.fromCharCode(characterCode))) letterFrequency.push([String.fromCharCode(characterCode), count])
  })
  letterFrequency.sort((first, second) => second[1] - first[1])

  return {
    wordCount,
    characterCount: text.length,
    characterCountWithoutSpaces: countNonSpaceCharacters(text),
    lineCount: lines.length,
    blankLineCount,
    sentenceCount: countSentences(text),
    paragraphCount,
    uniqueWordCount: wordCounts.size,
    readingSeconds: Math.round((wordCount / READING_WORDS_PER_MINUTE) * 60),
    speakingSeconds: Math.round((wordCount / SPEAKING_WORDS_PER_MINUTE) * 60),
    longestLines,
    topWords: mostFrequent(wordCounts, TOP_ENTRY_COUNT, (word) => !skipCommonWords || (word.length > 1 && !COMMON_ENGLISH_WORDS.has(word))),
    topPhrases: mostFrequent(phraseCounts, TOP_ENTRY_COUNT),
    letterFrequency,
  }
}

// The few counts the status bar shows for the selected text.
export function countSelection(selectedText: string) {
  return {
    wordCount: countWords(selectedText),
    characterCount: selectedText.length,
    characterCountWithoutSpaces: countNonSpaceCharacters(selectedText),
    lineCount: selectedText === '' ? 0 : selectedText.split('\n').length,
    sentenceCount: countSentences(selectedText),
  }
}

// ---------------------------------------------------------------- hidden characters

export type HiddenCharacterName =
  | 'BOM'
  | 'ZWSP'
  | 'ZWNJ'
  | 'ZWJ'
  | 'WJ'
  | 'NBSP'
  | 'LRM'
  | 'RLM'
  | 'ALM'
  | 'LRE'
  | 'RLE'
  | 'PDF'
  | 'LRO'
  | 'RLO'
  | 'LRI'
  | 'RLI'
  | 'FSI'
  | 'PDI'
  | 'otherFormat'
  | 'control'

const HIDDEN_CHARACTER_NAMES: Record<number, HiddenCharacterName> = {
  0xfeff: 'BOM',
  0x200b: 'ZWSP',
  0x200c: 'ZWNJ',
  0x200d: 'ZWJ',
  0x2060: 'WJ',
  0x00a0: 'NBSP',
  0x200e: 'LRM',
  0x200f: 'RLM',
  0x061c: 'ALM',
  0x202a: 'LRE',
  0x202b: 'RLE',
  0x202c: 'PDF',
  0x202d: 'LRO',
  0x202e: 'RLO',
  0x2066: 'LRI',
  0x2067: 'RLI',
  0x2068: 'FSI',
  0x2069: 'PDI',
}

// No-break space, format characters (Cf) and control characters (Cc) other than tab and line break.
// oxlint-disable-next-line no-control-regex -- finding control characters is the point
const HIDDEN_CHARACTER_PATTERN = /[ \p{Cf}\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu
const MAX_LISTED_HIDDEN_CHARACTERS = 10_000

// Line and column numbers start at 0. Only the first 10,000 characters are listed; `characterCount` counts them all.
export function findHiddenCharacters(text: string) {
  const characters: { line: number; column: number; codePoint: number; name: HiddenCharacterName }[] = []
  const trailingWhitespaceLines: number[] = []
  let characterCount = 0
  text.split('\n').forEach((line, lineNumber) => {
    if (/[ \t ]$/.test(line)) trailingWhitespaceLines.push(lineNumber)
    for (const found of line.matchAll(HIDDEN_CHARACTER_PATTERN)) {
      characterCount++
      if (characters.length === MAX_LISTED_HIDDEN_CHARACTERS) continue
      const codePoint = found[0].codePointAt(0)!
      const name = HIDDEN_CHARACTER_NAMES[codePoint] ?? (/\p{Cc}/u.test(found[0]) ? 'control' : 'otherFormat')
      characters.push({ line: lineNumber, column: found.index, codePoint, name })
    }
  })
  return { characters, characterCount, trailingWhitespaceLines }
}
