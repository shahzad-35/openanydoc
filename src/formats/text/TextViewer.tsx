import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { MiniFormatIcon, Wordmark } from '../../components/KitIcon'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import MenuBar from '../../components/MenuBar'
import type { MenuDefinition, MenuEntry } from '../../components/MenuBar'
import { FatalFileError } from '../../components/Messages'
import { isolateLeftToRight, isolateText, localizePath, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { formatFileSize, getLargeFileWarning } from '../../useFileIntake'
import { buildDownloadName, downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import {
  ENCODING_LABELS,
  applyTextTransform,
  applyToolChain,
  buildFindPattern,
  buildTextDownload,
  countOccurrences,
  diffLines,
  filterLinesByPattern,
  findSelectedLineRegion,
  findTextMatches,
  hasMixedLineEndings,
  readTextFile,
  replaceAllTextMatches,
  replaceTextMatch,
  splitIntoLines,
  withEditedText,
  withLineEnding,
} from './textEditing'
import type { EncodingChoice, TextChainStep, TextDiffRow, TextDownloadEncoding, TextEdits, TextLineEnding, TextMatch } from './textEditing'
import { TEXT_TOOL_DEFAULT_OPTIONS, computeTextStats, countSelection, findHiddenCharacters, transformLines } from './textTools'
import type { HiddenCharacterName, TextToolId, TextToolOptions, TextTransformId } from './textTools'
import './txtWorkbench.css'

// Above this many characters the text box would make typing slow: the file opens in the read view (only the visible lines are
// drawn) with an "Edit anyway" step, and an edited text this long is a plain text box without line numbers or highlights.
const LARGE_EDIT_CHARACTER_COUNT = 2_000_000
// With wrapping on, the mirror under the text box draws every line (wrapped lines have no fixed height), so it stops here.
const WRAPPED_MIRROR_LINE_LIMIT = 5_000
const COMMIT_DELAY_MS = 600
const EDITOR_PADDING_TOP_PX = 14
const LINE_HEIGHT_RATIO = 1.7
const MIRROR_EXTRA_LINES = 40
const CONTEXT_LINE_COUNT = 2
const MAX_LISTED_CHANGES = 200
const MAX_DIFF_ROWS = 3_000
const PREVIEW_LINE_COUNT = 14
const TOAST_MS = 4200
const PHONE_QUERY = '(max-width: 720px)'
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const shortcutLabel = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`)

const FONT_STACKS = {
  mono: '"IBM Plex Mono","IBM Plex Sans Arabic",ui-monospace,monospace',
  sans: '"IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif',
  serif: '"Iowan Old Style","Palatino Linotype",Georgia,"Times New Roman","IBM Plex Sans Arabic",serif',
}
type FontKey = keyof typeof FONT_STACKS
const TEXT_SIZES_PX = Array.from({ length: 19 }, (_, position) => position + 10)
const ENCODING_CHOICES: EncodingChoice[] = ['auto', 'utf-8', 'utf-16le', 'utf-16be', 'windows-1256', 'iso-8859-1']
const LINE_ENDING_NAMES: Record<TextLineEnding, string> = { '\n': 'LF', '\r\n': 'CRLF', '\r': 'CR' }
const DOWNLOAD_ENCODINGS: TextDownloadEncoding[] = ['utf-8', 'utf-8-bom', 'utf-16le', 'windows-1256']

type RibbonTabKey = 'home' | 'lines' | 'clean' | 'case' | 'find' | 'analyze' | 'view' | 'file'
type ActionKey =
  | 'findReplace'
  | 'goToLine'
  | 'copyAll'
  | 'print'
  | 'chain'
  | 'sortMenu'
  | 'sortIgnoreCase'
  | 'findMatchCase'
  | 'findWholeWord'
  | 'findRegex'
  | 'findInSelection'
  | 'keepMatching'
  | 'removeMatching'
  | 'countSelection'
  | 'bookmarkToggle'
  | 'bookmarkNext'
  | 'bookmarkPrevious'
  | 'bookmarksClear'
  | 'stats'
  | 'selectionStats'
  | 'compare'
  | 'diffInline'
  | 'diffSideBySide'
  | 'diffIgnoreWhitespace'
  | 'diffIgnoreCase'
  | 'changePrevious'
  | 'changeNext'
  | 'revertAll'
  | 'wrap'
  | 'lineNumbers'
  | 'currentLine'
  | 'minimap'
  | 'showHidden'
  | 'openFile'
  | 'reopen'
  | 'fixMixedEndings'
  | 'downloadOptions'
type ToolKey = TextToolId | ActionKey
type NoteKey = 'encoding' | 'endings' | 'large'
type RibbonItem = ['big' | 'small', ToolKey] | ['wrapColumn'] | ['select', 'font' | 'size' | 'encoding'] | ['note', NoteKey] | ['legal']
type RibbonGroup = { labelKey: MessageKey; tint?: 'sky' | 'mint' | 'butter' | 'lilac'; items: RibbonItem[] }

const RIBBON_TABS: [RibbonTabKey, MessageKey, string][] = [
  ['home', 'text.tab.home', 'home'],
  ['lines', 'text.tab.lines', 'sort'],
  ['clean', 'text.tab.clean', 'clean'],
  ['case', 'text.tab.case', 'upper'],
  ['find', 'text.tab.find', 'find'],
  ['analyze', 'text.tab.analyze', 'stats'],
  ['view', 'text.tab.view', 'eye'],
  ['file', 'text.tab.file', 'file'],
]

const RIBBON: Record<RibbonTabKey, RibbonGroup[]> = {
  home: [
    { labelKey: 'text.group.find', items: [['big', 'findReplace'], ['small', 'goToLine']] },
    { labelKey: 'text.group.clipboard', items: [['big', 'copyAll']] },
    { labelKey: 'text.group.sort', tint: 'sky', items: [['big', 'sortAscending'], ['small', 'sortDescending'], ['small', 'sortNatural']] },
    { labelKey: 'text.group.duplicates', tint: 'sky', items: [['big', 'removeDuplicateLines']] },
    { labelKey: 'text.group.whitespace', tint: 'butter', items: [['big', 'trimTrailingSpaces'], ['small', 'trimBothEnds'], ['small', 'removeBlankLines']] },
    { labelKey: 'text.group.chain', tint: 'lilac', items: [['big', 'chain']] },
  ],
  lines: [
    { labelKey: 'text.group.sort', tint: 'sky', items: [['big', 'sortMenu'], ['small', 'sortAscending'], ['small', 'sortDescending'], ['small', 'sortNatural'], ['small', 'sortByLength'], ['small', 'sortIgnoreCase']] },
    { labelKey: 'text.group.order', tint: 'sky', items: [['small', 'reverseLines'], ['small', 'shuffleLines']] },
    { labelKey: 'text.group.duplicates', tint: 'sky', items: [['big', 'removeDuplicateLines'], ['small', 'onlyDuplicateLines']] },
    { labelKey: 'text.group.joinSplit', tint: 'sky', items: [['small', 'joinLines'], ['small', 'splitLines']] },
    { labelKey: 'text.group.numbering', tint: 'sky', items: [['big', 'numberLines'], ['small', 'removeLineNumbers']] },
    { labelKey: 'text.group.addText', tint: 'sky', items: [['small', 'addPrefixSuffix'], ['small', 'wrapInQuotes']] },
    { labelKey: 'text.group.width', tint: 'sky', items: [['small', 'hardWrap'], ['small', 'unwrapParagraphs'], ['small', 'truncateLines']] },
    { labelKey: 'text.group.indent', tint: 'sky', items: [['small', 'indent'], ['small', 'outdent']] },
  ],
  clean: [
    { labelKey: 'text.group.whitespace', tint: 'butter', items: [['big', 'trimTrailingSpaces'], ['small', 'trimBothEnds'], ['small', 'trimExtraSpaces'], ['small', 'collapseSpaces']] },
    { labelKey: 'text.group.blankLines', tint: 'butter', items: [['small', 'removeBlankLines'], ['small', 'collapseBlankLines']] },
    { labelKey: 'text.group.tabs', tint: 'butter', items: [['small', 'tabsToSpaces'], ['small', 'spacesToTabs']] },
    {
      labelKey: 'text.group.characters',
      tint: 'butter',
      items: [['big', 'smartToAscii'], ['small', 'removeInvisibleMarks'], ['small', 'removeNonPrintable'], ['small', 'removeAccents'], ['small', 'stripHtmlTags']],
    },
    { labelKey: 'text.group.unicode', tint: 'butter', items: [['small', 'normalizeNfc'], ['small', 'normalizeNfd']] },
    { labelKey: 'text.group.insert', tint: 'butter', items: [['big', 'insertDateTime']] },
  ],
  case: [
    { labelKey: 'text.group.capitals', tint: 'mint', items: [['big', 'upper'], ['big', 'lower']] },
    { labelKey: 'text.group.words', tint: 'mint', items: [['big', 'title'], ['big', 'sentence'], ['small', 'inverse']] },
    { labelKey: 'text.group.codeNames', tint: 'mint', items: [['small', 'camel'], ['small', 'snake'], ['small', 'kebab']] },
  ],
  find: [
    { labelKey: 'text.group.find', items: [['big', 'findReplace'], ['small', 'findMatchCase'], ['small', 'findWholeWord'], ['small', 'findRegex'], ['small', 'findInSelection']] },
    { labelKey: 'text.group.filterLines', items: [['small', 'keepMatching'], ['small', 'removeMatching']] },
    { labelKey: 'text.group.count', items: [['big', 'countSelection']] },
    { labelKey: 'text.group.goTo', items: [['big', 'goToLine']] },
    { labelKey: 'text.group.bookmarks', items: [['big', 'bookmarkToggle'], ['small', 'bookmarkNext'], ['small', 'bookmarkPrevious'], ['small', 'bookmarksClear']] },
  ],
  analyze: [
    { labelKey: 'text.group.statistics', tint: 'lilac', items: [['big', 'stats'], ['small', 'selectionStats']] },
    { labelKey: 'text.group.compare', tint: 'lilac', items: [['big', 'compare'], ['small', 'diffInline'], ['small', 'diffSideBySide'], ['small', 'diffIgnoreWhitespace'], ['small', 'diffIgnoreCase']] },
    { labelKey: 'text.group.changes', tint: 'lilac', items: [['small', 'changePrevious'], ['small', 'changeNext'], ['big', 'revertAll']] },
  ],
  view: [
    { labelKey: 'text.group.wrap', items: [['big', 'wrap'], ['wrapColumn']] },
    { labelKey: 'text.group.show', items: [['small', 'lineNumbers'], ['small', 'currentLine'], ['small', 'minimap']] },
    { labelKey: 'text.group.hidden', items: [['big', 'showHidden']] },
    { labelKey: 'text.group.text', items: [['select', 'font'], ['select', 'size']] },
    { labelKey: 'text.group.output', items: [['small', 'copyAll'], ['small', 'print']] },
  ],
  file: [
    { labelKey: 'text.group.open', items: [['big', 'openFile']] },
    { labelKey: 'text.group.encoding', items: [['select', 'encoding'], ['small', 'reopen'], ['note', 'encoding']] },
    { labelKey: 'text.group.lineEndings', items: [['note', 'endings'], ['small', 'fixMixedEndings']] },
    { labelKey: 'text.group.save', items: [['big', 'downloadOptions']] },
    { labelKey: 'text.group.output', items: [['small', 'copyAll'], ['small', 'print']] },
    { labelKey: 'text.group.largeFiles', items: [['note', 'large']] },
    { labelKey: 'text.group.legal', items: [['legal']] },
  ],
}

const SORT_TOOL_IDS: TextTransformId[] = ['sortAscending', 'sortDescending', 'sortNumeric', 'sortNatural', 'sortByLength']

// The tools the chain can run, in the groups of its "Tool to add" list.
const TRANSFORM_GROUPS: [MessageKey, TextTransformId[]][] = [
  ['text.group.case', ['upper', 'lower', 'title', 'sentence', 'inverse', 'camel', 'snake', 'kebab']],
  ['text.group.whitespace', ['trimTrailingSpaces', 'trimBothEnds', 'trimExtraSpaces', 'collapseSpaces', 'removeBlankLines', 'collapseBlankLines', 'tabsToSpaces', 'spacesToTabs', 'indent', 'outdent']],
  ['text.group.lines', [...SORT_TOOL_IDS, 'reverseLines', 'shuffleLines', 'removeDuplicateLines', 'onlyDuplicateLines', 'joinLines', 'splitLines']],
  ['text.group.numbering', ['numberLines', 'removeLineNumbers', 'addPrefixSuffix', 'wrapInQuotes']],
  ['text.group.width', ['hardWrap', 'unwrapParagraphs', 'truncateLines']],
  ['text.group.characters', ['removeAccents', 'smartToAscii', 'removeInvisibleMarks', 'removeNonPrintable', 'stripHtmlTags', 'normalizeNfc', 'normalizeNfd']],
]

type OptionField = { key: keyof TextToolOptions; type: 'number' | 'text' | 'checkbox' | 'select'; labelKey: MessageKey; hintKey?: MessageKey; min?: number; max?: number; choices?: [string, string][] }
const SKIP_BLANK_FIELD: OptionField = { key: 'skipBlankLines', type: 'checkbox', labelKey: 'text.option.skipBlankLines' }
const TOOL_OPTION_FIELDS: Partial<Record<TextTransformId, OptionField[]>> = {
  tabsToSpaces: [{ key: 'tabWidth', type: 'number', labelKey: 'text.option.tabWidth', min: 1, max: 12 }],
  spacesToTabs: [{ key: 'tabWidth', type: 'number', labelKey: 'text.option.spacesPerTab', min: 1, max: 12 }],
  joinLines: [{ key: 'separator', type: 'text', labelKey: 'text.option.separator', hintKey: 'text.option.separatorHint' }, SKIP_BLANK_FIELD],
  splitLines: [{ key: 'separator', type: 'text', labelKey: 'text.option.splitAt' }, { key: 'separatorIsRegex', type: 'checkbox', labelKey: 'text.option.separatorIsRegex' }],
  numberLines: [
    { key: 'startNumber', type: 'number', labelKey: 'text.option.startAt', min: 0, max: 99999 },
    { key: 'numberFormat', type: 'select', labelKey: 'text.option.format', choices: [['{n}. ', '1. '], ['{n}) ', '1) '], ['{n}: ', '1: '], ['[{n}] ', '[1] '], ['{0n}. ', '01. ']] },
    SKIP_BLANK_FIELD,
  ],
  addPrefixSuffix: [{ key: 'prefix', type: 'text', labelKey: 'text.option.prefix' }, { key: 'suffix', type: 'text', labelKey: 'text.option.suffix' }, SKIP_BLANK_FIELD],
  wrapInQuotes: [
    { key: 'wrapPair', type: 'select', labelKey: 'text.option.wrapWith', choices: [['""', '"…"'], ["''", "'…'"], ['()', '(…)'], ['[]', '[…]'], ['{}', '{…}'], ['«»', '«…»'], ['``', '`…`']] },
    SKIP_BLANK_FIELD,
  ],
  hardWrap: [{ key: 'width', type: 'number', labelKey: 'text.option.wrapAtColumn', min: 10, max: 400 }],
  truncateLines: [{ key: 'width', type: 'number', labelKey: 'text.option.keepCharacters', min: 1, max: 1000 }, { key: 'endWithEllipsis', type: 'checkbox', labelKey: 'text.option.endWithEllipsis' }],
}

const TOOL_ICONS: Record<ToolKey, string> = {
  upper: 'upper',
  lower: 'lower',
  title: 'title',
  sentence: 'sentence',
  inverse: 'inverse',
  camel: 'camel',
  snake: 'snake',
  kebab: 'kebab',
  trimTrailingSpaces: 'trim',
  trimBothEnds: 'trim-both',
  trimExtraSpaces: 'collapse',
  collapseSpaces: 'collapse',
  removeBlankLines: 'blank',
  collapseBlankLines: 'blank-collapse',
  tabsToSpaces: 'tab',
  spacesToTabs: 'tab-back',
  indent: 'indent',
  outdent: 'outdent',
  sortAscending: 'sort-az',
  sortDescending: 'sort-za',
  sortNumeric: 'sort-num',
  sortNatural: 'sort-nat',
  sortByLength: 'sort-len',
  reverseLines: 'reverse',
  shuffleLines: 'shuffle',
  removeDuplicateLines: 'dedupe',
  onlyDuplicateLines: 'dupes',
  joinLines: 'join',
  splitLines: 'split',
  numberLines: 'number',
  removeLineNumbers: 'unnumber',
  addPrefixSuffix: 'prefix',
  wrapInQuotes: 'quote',
  hardWrap: 'hard-wrap',
  unwrapParagraphs: 'unwrap',
  truncateLines: 'truncate',
  removeAccents: 'accent',
  smartToAscii: 'ascii',
  removeInvisibleMarks: 'invisible',
  removeNonPrintable: 'nonprint',
  stripHtmlTags: 'html',
  normalizeNfc: 'nfc',
  normalizeNfd: 'nfd',
  insertDateTime: 'clock',
  findReplace: 'find',
  goToLine: 'goto',
  copyAll: 'copy',
  print: 'print',
  chain: 'chain',
  sortMenu: 'sort',
  sortIgnoreCase: 'case',
  findMatchCase: 'case',
  findWholeWord: 'word',
  findRegex: 'regex',
  findInSelection: 'in-sel',
  keepMatching: 'keep',
  removeMatching: 'remove-lines',
  countSelection: 'count',
  bookmarkToggle: 'bookmark',
  bookmarkNext: 'bm-next',
  bookmarkPrevious: 'bm-prev',
  bookmarksClear: 'bm-clear',
  stats: 'stats',
  selectionStats: 'sel-stats',
  compare: 'compare',
  diffInline: 'inline',
  diffSideBySide: 'side',
  diffIgnoreWhitespace: 'collapse',
  diffIgnoreCase: 'case',
  changePrevious: 'up',
  changeNext: 'chev',
  revertAll: 'revert',
  wrap: 'wrap',
  lineNumbers: 'lines',
  currentLine: 'cur-line',
  minimap: 'minimap',
  showHidden: 'hidden',
  openFile: 'open',
  reopen: 'revert',
  fixMixedEndings: 'endings',
  downloadOptions: 'download',
}

// The icons, drawn once and used by name (as in the design file). Static markup, no file content.
const ICON_SPRITE = `<defs>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 5 4.5 9.5 9 14"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/></symbol>
<symbol id="i-redo" viewBox="0 0 24 24"><path d="m15 5 4.5 4.5L15 14"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="i-up" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5v-2A2.5 2.5 0 0 0 13 4H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/></symbol>
<symbol id="i-print" viewBox="0 0 24 24"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/></symbol>
<symbol id="i-find" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></symbol>
<symbol id="i-replace" viewBox="0 0 24 24"><path d="M4 8h11a4 4 0 0 1 4 4"/><path d="m12 5 3 3-3 3"/><path d="M20 16H9a4 4 0 0 1-4-4"/><path d="m12 13-3 3 3 3"/></symbol>
<symbol id="i-goto" viewBox="0 0 24 24"><path d="M4 12h12"/><path d="m12 8 4 4-4 4"/><path d="M20 5v14"/></symbol>
<symbol id="i-sort-az" viewBox="0 0 24 24"><path d="M7 4v16M4 17l3 3 3-3"/><path d="m13 11 2.5-7 2.5 7M13.9 8.8h3.2"/><path d="M13 14h5l-5 6h5"/></symbol>
<symbol id="i-sort-za" viewBox="0 0 24 24"><path d="M7 4v16M4 17l3 3 3-3"/><path d="M13 4h5l-5 6h5"/><path d="m13 20 2.5-7 2.5 7M13.9 17.8h3.2"/></symbol>
<symbol id="i-sort-num" viewBox="0 0 24 24"><path d="M7 4v16M4 17l3 3 3-3"/><path d="M14.5 5.5 16.5 4v6.5"/><circle cx="16" cy="15.5" r="2"/><path d="M18 15.5V18a2 2 0 0 1-2 2h-1"/></symbol>
<symbol id="i-sort-nat" viewBox="0 0 24 24"><path d="M7 4v16M4 17l3 3 3-3"/><path d="M13 6h2M17.5 6h1M13 12h2M17.5 12h2.5M13 18h2M17.5 18h4"/></symbol>
<symbol id="i-sort-len" viewBox="0 0 24 24"><path d="M7 4v16M4 17l3 3 3-3"/><path d="M13 6h3M13 12h5M13 18h8"/></symbol>
<symbol id="i-sort" viewBox="0 0 24 24"><path d="M7 4v16"/><path d="m3.5 7.5 3.5-3.5 3.5 3.5"/><path d="M17 20V4"/><path d="m13.5 16.5 3.5 3.5 3.5-3.5"/></symbol>
<symbol id="i-reverse" viewBox="0 0 24 24"><path d="M7 4v16M4 7l3-3 3 3"/><path d="M17 20V4M14 17l3 3 3-3"/></symbol>
<symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M4 7h3c4 0 6 10 10 10h3M4 17h3c1.5 0 2.7-1.4 3.7-3.2M13.3 10.2C14.3 8.4 15.5 7 17 7h3"/><path d="m18 5 2 2-2 2M18 15l2 2-2 2"/></symbol>
<symbol id="i-dedupe" viewBox="0 0 24 24"><rect x="4" y="4" width="11" height="11" rx="2"/><path d="M9 19h9a2 2 0 0 0 2-2V8"/><path d="m7.5 9.5 2 2 3.5-4"/></symbol>
<symbol id="i-dupes" viewBox="0 0 24 24"><rect x="4" y="4" width="11" height="11" rx="2"/><path d="M9 19h9a2 2 0 0 0 2-2V8"/><path d="M7.5 8.5h4M7.5 11.5h4"/></symbol>
<symbol id="i-trim" viewBox="0 0 24 24"><path d="M4 7h10M4 12h7M4 17h9"/><path d="M20 4v16"/><path d="m17.5 9.5-2.5 2.5 2.5 2.5"/></symbol>
<symbol id="i-trim-both" viewBox="0 0 24 24"><path d="M4 4v16M20 4v16"/><path d="m8 9.5 2.5 2.5L8 14.5M16 9.5 13.5 12l2.5 2.5"/></symbol>
<symbol id="i-collapse" viewBox="0 0 24 24"><path d="M3 12h5M16 12h5"/><path d="m5.5 9.5 2.5 2.5-2.5 2.5M18.5 9.5 16 12l2.5 2.5"/><path d="M12 7v10"/></symbol>
<symbol id="i-blank" viewBox="0 0 24 24"><path d="M4 5h16M4 19h16"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5"/></symbol>
<symbol id="i-blank-collapse" viewBox="0 0 24 24"><path d="M4 4h16M4 20h16"/><path d="m9 8 3 3 3-3M9 16l3-3 3 3"/></symbol>
<symbol id="i-tab" viewBox="0 0 24 24"><path d="M4 12h11"/><path d="m11 8 4 4-4 4"/><path d="M19 6v12"/></symbol>
<symbol id="i-indent" viewBox="0 0 24 24"><path d="M11 6h9M11 12h9M11 18h9"/><path d="m4 9 3 3-3 3"/></symbol>
<symbol id="i-outdent" viewBox="0 0 24 24"><path d="M11 6h9M11 12h9M11 18h9"/><path d="M7 9l-3 3 3 3"/></symbol>
<symbol id="i-join" viewBox="0 0 24 24"><path d="M4 6h7M4 18h7M11 6c3 0 3 6 6 6h3M11 18c3 0 3-6 6-6"/></symbol>
<symbol id="i-split" viewBox="0 0 24 24"><path d="M20 6h-7M20 18h-7M13 6c-3 0-3 6-6 6H4M13 18c-3 0-3-6-6-6"/></symbol>
<symbol id="i-number" viewBox="0 0 24 24"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5h1.5v4M4 9h3M4 15.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3"/></symbol>
<symbol id="i-unnumber" viewBox="0 0 24 24"><path d="M11 6h9M11 12h9M11 18h9"/><path d="m4 4.5 3 3M7 4.5l-3 3M4 10.5l3 3M7 10.5l-3 3M4 16.5l3 3M7 16.5l-3 3"/></symbol>
<symbol id="i-prefix" viewBox="0 0 24 24"><path d="M5 9v6M2 12h6"/><path d="M11 7h10M11 12h10M11 17h10"/></symbol>
<symbol id="i-quote" viewBox="0 0 24 24"><path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M10 12h4"/></symbol>
<symbol id="i-hard-wrap" viewBox="0 0 24 24"><path d="M4 6h12M4 12h12M4 18h7"/><path d="M20 3v18"/></symbol>
<symbol id="i-unwrap" viewBox="0 0 24 24"><path d="M4 6h7M4 12h7M4 18h7"/><path d="M14 12h7M18 9l3 3-3 3"/></symbol>
<symbol id="i-truncate" viewBox="0 0 24 24"><path d="M4 8h11M4 16h8M15 4v16"/><path d="M18.5 8h.01M18.5 12h.01M18.5 16h.01"/></symbol>
<symbol id="i-accent" viewBox="0 0 24 24"><path d="M7 14.5h10a5 5 0 1 0-1.5 3.6"/><path d="m11 7 3-3"/></symbol>
<symbol id="i-ascii" viewBox="0 0 24 24"><path d="M7 5.5c-1 .8-1.5 2-1.5 3.5M11 5.5c-1 .8-1.5 2-1.5 3.5M15 5.5V9M19 5.5V9"/><path d="M5 16h14M16 13l3 3-3 3"/></symbol>
<symbol id="i-invisible" viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="2.5" stroke-dasharray="2 3"/><path d="M4 20 20 4"/></symbol>
<symbol id="i-nonprint" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7.5 12h.01M12 12h.01M16.5 12h.01"/></symbol>
<symbol id="i-html" viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></symbol>
<symbol id="i-chain" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5Z"/></symbol>
<symbol id="i-keep" viewBox="0 0 24 24"><path d="M4 6h12M4 12h7M4 18h7"/><path d="m14 16 2.5 2.5L21 14"/></symbol>
<symbol id="i-remove-lines" viewBox="0 0 24 24"><path d="M4 6h12M4 12h7M4 18h7"/><path d="m15 13 5 5M20 13l-5 5"/></symbol>
<symbol id="i-count" viewBox="0 0 24 24"><path d="M10 4 8 20M16 4l-2 16M5 9h15M4 15h15"/></symbol>
<symbol id="i-regex" viewBox="0 0 24 24"><circle cx="7" cy="17" r="1.4"/><path d="M15 5v8M11.5 7l7 4M18.5 7l-7 4"/></symbol>
<symbol id="i-case" viewBox="0 0 24 24"><path d="m4 18 5-12 5 12M5.8 14h6.4"/><path d="M17 10.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM19.5 10v8"/></symbol>
<symbol id="i-word" viewBox="0 0 24 24"><circle cx="8" cy="11" r="2.5"/><path d="M10.5 8.5v5M14 5v8.5"/><circle cx="16.5" cy="11" r="2.5"/><path d="M4 16.5v2h16v-2"/></symbol>
<symbol id="i-in-sel" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" stroke-dasharray="3 2.5"/><path d="M7 12h10"/></symbol>
<symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M7 4h10v17l-5-4-5 4Z"/></symbol>
<symbol id="i-bm-next" viewBox="0 0 24 24"><path d="M5 4h8v14l-4-3-4 3Z"/><path d="M18 6v12M15.5 15.5 18 18l2.5-2.5"/></symbol>
<symbol id="i-bm-prev" viewBox="0 0 24 24"><path d="M5 4h8v14l-4-3-4 3Z"/><path d="M18 18V6M15.5 8.5 18 6l2.5 2.5"/></symbol>
<symbol id="i-bm-clear" viewBox="0 0 24 24"><path d="M5 4h8v14l-4-3-4 3Z"/><path d="m16 14 5 5M21 14l-5 5"/></symbol>
<symbol id="i-stats" viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></symbol>
<symbol id="i-sel-stats" viewBox="0 0 24 24"><path d="M4 5h3M5.5 5v14M4 19h3"/><path d="M11 19v-6M15 19V9M19 19v-9"/></symbol>
<symbol id="i-compare" viewBox="0 0 24 24"><rect x="3" y="4" width="7.5" height="16" rx="2"/><rect x="13.5" y="4" width="7.5" height="16" rx="2"/><path d="M6 9h2M16 9h2M16 13h2M6 13h2"/></symbol>
<symbol id="i-inline" viewBox="0 0 24 24"><path d="M4 5h16M4 19h16"/><rect x="3" y="9" width="18" height="6" rx="2"/></symbol>
<symbol id="i-side" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16"/></symbol>
<symbol id="i-revert" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></symbol>
<symbol id="i-wrap" viewBox="0 0 24 24"><path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4"/><path d="m15 16-2 2 2 2"/><path d="M4 18h5"/></symbol>
<symbol id="i-lines" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/></symbol>
<symbol id="i-cur-line" viewBox="0 0 24 24"><path d="M5 5h14M5 19h14"/><rect x="3" y="9" width="18" height="6" rx="2"/></symbol>
<symbol id="i-minimap" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16M6.5 8.5h5M6.5 12h3M6.5 15.5h4"/></symbol>
<symbol id="i-hidden" viewBox="0 0 24 24"><path d="M13 4v16M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></symbol>
<symbol id="i-font" viewBox="0 0 24 24"><path d="M5 6h14M12 6v13M9 19h6"/></symbol>
<symbol id="i-open" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></symbol>
<symbol id="i-encoding" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9.5v5M10.5 9.5h2v5h-2ZM16.5 9.5v5"/></symbol>
<symbol id="i-endings" viewBox="0 0 24 24"><path d="M20 5v7a3 3 0 0 1-3 3H6"/><path d="m9 12-3 3 3 3"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5h.01"/></symbol>
<symbol id="i-tools" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></symbol>
<symbol id="i-up-down" viewBox="0 0 24 24"><path d="m8 10 4-4 4 4M8 14l4 4 4-4"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h5a1.5 1.5 0 0 0 1.5-1.5L17 7"/></symbol>
<symbol id="i-logo" viewBox="0 0 24 24"><path d="M7 6.5h7M7 11h10M7 15.5h6"/><path d="M15.5 15.5 18 18"/></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></symbol>
<symbol id="i-clean" viewBox="0 0 24 24"><path d="M11 3c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6Z"/><path d="M18.5 14.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-replace-all" viewBox="0 0 24 24"><path d="M3 5h10a4 4 0 0 1 4 4v1"/><path d="m14 7 3 3 3-3"/><path d="M3 11h7M3 15h7M3 19h14"/></symbol>
<symbol id="i-upper" viewBox="0 0 24 24"><path d="M3 18 6.5 6 10 18M4.2 14h4.6"/><path d="M13 6h3.5a3 3 0 0 1 0 6H13ZM13 12h4a3 3 0 0 1 0 6h-4Z"/></symbol>
<symbol id="i-lower" viewBox="0 0 24 24"><circle cx="7" cy="15" r="3"/><path d="M10 12v6M14 6v12"/><circle cx="17" cy="15" r="3"/></symbol>
<symbol id="i-title" viewBox="0 0 24 24"><path d="M3 18 6.5 6 10 18M4.2 14h4.6M14 6v12"/><circle cx="17" cy="15" r="3"/></symbol>
<symbol id="i-sentence" viewBox="0 0 24 24"><path d="M3 18 6.5 6 10 18M4.2 14h4.6"/><path d="M12.5 18h.01M15.5 10h5.5M15.5 14h5.5M15.5 18h3.5"/></symbol>
<symbol id="i-inverse" viewBox="0 0 24 24"><path d="M3 20 6.5 9 10 20M4.2 16.5h4.6"/><circle cx="16" cy="17" r="3"/><path d="M19 14v6"/><path d="M6 4.5h11M15 2.5l2 2-2 2"/></symbol>
<symbol id="i-camel" viewBox="0 0 24 24"><circle cx="6" cy="15" r="3"/><path d="M9 12v6"/><path d="M13 6h3.5a3 3 0 0 1 0 6H13ZM13 12h4a3 3 0 0 1 0 6h-4Z"/></symbol>
<symbol id="i-snake" viewBox="0 0 24 24"><circle cx="5" cy="15" r="3"/><path d="M8 12v6M10 18.5h3.5M15.5 6v12"/><circle cx="18.5" cy="15" r="3"/></symbol>
<symbol id="i-kebab" viewBox="0 0 24 24"><circle cx="5" cy="15" r="3"/><path d="M8 12v6M10 14.5h3.5M15.5 6v12"/><circle cx="18.5" cy="15" r="3"/></symbol>
<symbol id="i-tab-back" viewBox="0 0 24 24"><path d="M20 12H9"/><path d="m13 8-4 4 4 4"/><path d="M5 6v12"/></symbol>
<symbol id="i-nfc" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M17 9l-3 3 3 3"/></symbol>
<symbol id="i-nfd" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 9-3 3 3 3M14 9l3 3-3 3"/></symbol>
</defs>`

function Icon({ name }: { name: string }) {
  return (
    <svg className="ic" aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  )
}

// "sortAscending" becomes "sort-ascending", for element ids.
const toKebabCase = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function countLineBreaksBefore(text: string, offset: number) {
  let lineBreakCount = 0
  for (let position = text.indexOf('\n'); position !== -1 && position < offset; position = text.indexOf('\n', position + 1)) lineBreakCount++
  return lineBreakCount
}

function findLineStartOffset(text: string, line: number) {
  let offset = 0
  for (let lineNumber = 0; lineNumber < line; lineNumber++) {
    const lineBreak = text.indexOf('\n', offset)
    if (lineBreak === -1) break
    offset = lineBreak + 1
  }
  return offset
}

function formatDuration(seconds: number, t: ReturnType<typeof useT>['t']) {
  return seconds < 60 ? t('text.stats.seconds', { seconds }) : t('text.stats.minutes', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
}

function useIsPhoneLayout() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY)
    const update = () => setIsPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isPhone
}

// A native modal <dialog> that is open while `isOpen` is true; Escape and the backdrop close it through `onClose`. The browser
// gives focus back to the button that opened it.
function WorkbenchDialog({ id, titleId, isOpen, onClose, children }: { id: string; titleId: string; isOpen: boolean; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])
  return (
    <dialog id={id} ref={dialogRef} aria-labelledby={titleId} onClose={onClose}>
      {isOpen && children}
    </dialog>
  )
}

type LineRowProps = {
  lineIndex: number
  text: string
  isCurrent: boolean
  isBookmarked: boolean
  isFlashing: boolean
  matches: TextMatch[] | undefined
  currentMatchStart: number
  hiddenCharacters: Map<number, HiddenCharacterName> | undefined
  showHidden: boolean
  lineEndingLabel: string | null
  top?: number
  measureRef?: (element: HTMLElement | null) => void
}

// The pieces of one line: find marks, and with hidden characters shown, tabs, trailing spaces and invisible characters. In the
// mirror the text itself is transparent (the text box draws it), so only these marks show; they keep the characters, so the
// line is laid out exactly as in the text box.
function buildLineContent(text: string, matches: TextMatch[] | undefined, currentMatchStart: number, hiddenCharacters: Map<number, HiddenCharacterName> | undefined, showHidden: boolean) {
  if (!matches && !showHidden) return text
  const trailingStart = showHidden ? text.replace(/[ \t ]+$/, '').length : text.length
  const decorateHidden = (from: number, to: number) => {
    if (!showHidden) return text.slice(from, to)
    const parts: ReactNode[] = []
    let plainFrom = from
    for (let position = from; position < to; position++) {
      const character = text[position]
      const hiddenName = hiddenCharacters?.get(position)
      const isTab = character === '\t'
      const isTrailingSpace = character === ' ' && position >= trailingStart
      if (!isTab && !isTrailingSpace && !hiddenName) continue
      if (position > plainFrom) parts.push(text.slice(plainFrom, position))
      const className = isTab ? `hc tab${position >= trailingStart ? ' trail' : ''}` : isTrailingSpace ? 'hc sp' : 'hc badge'
      parts.push(
        <span key={position} className={className} data-c={hiddenName}>
          {character}
        </span>,
      )
      plainFrom = position + 1
    }
    if (to > plainFrom) parts.push(text.slice(plainFrom, to))
    return parts
  }
  if (!matches) return decorateHidden(0, text.length)
  const parts: ReactNode[] = []
  let from = 0
  for (const match of matches) {
    if (match.start > from) parts.push(<span key={`t${from}`}>{decorateHidden(from, match.start)}</span>)
    parts.push(
      <mark key={`m${match.start}`} className={match.start === currentMatchStart ? 'mc' : 'm'}>
        {decorateHidden(match.start, match.end)}
      </mark>,
    )
    from = match.end
  }
  if (text.length > from) parts.push(<span key={`t${from}`}>{decorateHidden(from, text.length)}</span>)
  return parts
}

// One line of the mirror (under the text box) or of the large-file view: its number, then its text in its own direction.
const LineRow = memo(function LineRow({ lineIndex, text, isCurrent, isBookmarked, isFlashing, matches, currentMatchStart, hiddenCharacters, showHidden, lineEndingLabel, top, measureRef }: LineRowProps) {
  const className = `ln${top === undefined ? '' : ' abs'}${isCurrent ? ' cur' : ''}${isBookmarked ? ' bm' : ''}${isFlashing ? ' flash' : ''}`
  return (
    <div className={className} data-line={lineIndex} data-index={lineIndex} ref={measureRef} style={top === undefined ? undefined : { top }}>
      <span className="gut" data-line={lineIndex}>
        {lineIndex + 1}
      </span>
      <div className="lt-clip">
        <div className="lt" dir="auto">
          {buildLineContent(text, matches, currentMatchStart, hiddenCharacters, showHidden)}
          {showHidden && lineEndingLabel && <span className="eol" data-eol={lineEndingLabel} />}
        </div>
      </div>
    </div>
  )
})

type Toast = { id: number; message: string; canUndo: boolean }
type PanelView = 'text' | 'stats' | 'compare'
type OpenDialog = 'goTo' | 'options' | 'download' | null
type OpenPopover = { kind: 'sort' | 'chain'; anchor: HTMLElement | null } | null
type FindOptions = { matchCase: boolean; wholeWord: boolean; isRegex: boolean }
type CompareSettings = { mode: 'inline' | 'side'; ignoreWhitespace: boolean; ignoreCase: boolean; index: number }
type DownloadSettings = { fileName: string; encoding: TextDownloadEncoding; lineEnding: TextLineEnding }
type ToolDescription = { label: string; hint: string; icon: string; keys?: string; isPressed?: boolean; isDisabled?: boolean; popup?: 'menu' | 'dialog'; run: (anchor: HTMLElement) => void }

// The TXT file page ("Compact ribbon"): a top bar, named ribbon tabs over icon tools in captioned groups, the text with its
// gutter, current line, bookmarks, minimap and hidden characters, and a status line. It fills the whole screen (the format is
// `ownsWholePage`) and is always editable. The text box keeps a draft that is committed after a pause or on blur; every tool is
// one change in the shared edit session (one undo step). Files over 2 million characters open in a read view first.
export default function TextViewer({ openedFile, session: untypedSession, confirmDiscardEdits, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const session = untypedSession as EditSession<TextEdits>
  const { reset: resetEditSession } = session
  const fileName = openedFile.file.name
  const isPhone = useIsPhoneLayout()

  const [encodingChoice, setEncodingChoice] = useState<EncodingChoice>('auto')
  const [encodingDraft, setEncodingDraft] = useState<EncodingChoice>('auto')
  const readableText = useMemo(() => readTextFile(openedFile.contents, encodingChoice), [openedFile, encodingChoice])
  const exportSource = readableText.status === 'ok' ? readableText : null
  const originalText = exportSource?.originalText ?? ''
  const currentText = session.edits.text ?? originalText
  const isLargeFile = originalText.length > LARGE_EDIT_CHARACTER_COUNT

  const [draftText, setDraftText] = useState(currentText)
  const [syncedText, setSyncedText] = useState(currentText)
  const lastCommittedTextRef = useRef(currentText)
  const commitTimerRef = useRef<number | undefined>(undefined)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [cursor, setCursor] = useState({ line: 0, column: 0 })
  const [isEditingLargeFile, setIsEditingLargeFile] = useState(false)

  const [activeTab, setActiveTab] = useState<RibbonTabKey>('home')
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false)
  const [isRibbonPeekOpen, setIsRibbonPeekOpen] = useState(false)
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false)
  const [panelView, setPanelView] = useState<PanelView>('text')
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [findOptions, setFindOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false, isRegex: false })
  const [findRange, setFindRange] = useState<{ start: number; end: number } | null>(null)
  const [matchIndex, setMatchIndex] = useState(0)

  const [wrapLines, setWrapLines] = useState(() => (originalText.match(/\n/g)?.length ?? 0) < WRAPPED_MIRROR_LINE_LIMIT)
  const [wrapColumn, setWrapColumn] = useState(0)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [highlightCurrentLine, setHighlightCurrentLine] = useState(true)
  const [showMinimap, setShowMinimap] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [fontKey, setFontKey] = useState<FontKey>('mono')
  const [textSizePx, setTextSizePx] = useState(14)
  const [bookmarks, setBookmarks] = useState<ReadonlySet<number>>(new Set())
  const [flashLine, setFlashLine] = useState(-1)
  const [sortIgnoreCase, setSortIgnoreCase] = useState(false)
  const [skipCommonWords, setSkipCommonWords] = useState(true)
  const [compare, setCompare] = useState<CompareSettings>({ mode: 'inline', ignoreWhitespace: false, ignoreCase: false, index: 0 })
  const [chainSteps, setChainSteps] = useState<TextChainStep[]>([])
  const [chainToolToAdd, setChainToolToAdd] = useState<TextTransformId>('trimTrailingSpaces')
  const [optionsTool, setOptionsTool] = useState<TextTransformId>('numberLines')
  const [optionsDraft, setOptionsDraft] = useState<TextToolOptions>({})
  const [goToText, setGoToText] = useState('')
  const [goToHint, setGoToHint] = useState('')
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings>({ fileName: '', encoding: 'utf-8', lineEnding: '\n' })
  const [isPrinting, setIsPrinting] = useState(false)
  const [editorSize, setEditorSize] = useState({ clientWidth: 800, clientHeight: 600 })
  const [visibleTopLine, setVisibleTopLine] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const readViewRef = useRef<HTMLDivElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipTimerRef = useRef<number | undefined>(undefined)
  const tooltipTargetRef = useRef<HTMLElement | null>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const chainPopoverRef = useRef<HTMLDivElement>(null)
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null)
  const minimapViewportRef = useRef<HTMLDivElement>(null)
  const tabMovesFocusRef = useRef(false)

  // The text changed from outside the text box (undo, redo, revert all, another encoding): show it. Our own commits are skipped.
  if (currentText !== syncedText) {
    setSyncedText(currentText)
    if (currentText !== lastCommittedTextRef.current) {
      lastCommittedTextRef.current = currentText
      setDraftText(currentText)
    }
  }

  const showReadView = isLargeFile && !isEditingLargeFile
  const deferredDraftText = useDeferredValue(draftText)
  const lines = useMemo(() => splitIntoLines(deferredDraftText), [deferredDraftText])
  const lineHeightPx = Math.round(textSizePx * LINE_HEIGHT_RATIO)
  const isPlainEditor = !showReadView && (draftText.length > LARGE_EDIT_CHARACTER_COUNT || (wrapLines && lines.length > WRAPPED_MIRROR_LINE_LIMIT))
  const hasSelection = selection.end > selection.start
  const selectedText = hasSelection ? draftText.slice(selection.start, selection.end) : ''
  const hasUncommittedTyping = draftText !== lastCommittedTextRef.current
  const isEdited = session.changeCount > 0 || hasUncommittedTyping
  const lineEndingCounts = exportSource?.lineEndingCounts ?? { crlf: 0, lf: 0, cr: 0 }
  const effectiveLineEnding = session.edits.lineEnding ?? exportSource?.lineEnding ?? '\n'
  const hasMixedEndings = hasMixedLineEndings(lineEndingCounts) && !session.edits.lineEnding
  const lineEndingLabel = hasMixedEndings ? t('text.status.mixedEndings') : LINE_ENDING_NAMES[effectiveLineEnding]
  const largeFileWarning = getLargeFileWarning(openedFile.file, locale)

  // ---------------------------------------------------------------- find
  const deferredFindQuery = useDeferredValue(findQuery)
  const findPattern = useMemo(() => buildFindPattern({ query: deferredFindQuery, ...findOptions }), [deferredFindQuery, findOptions])
  const matches = useMemo(
    () => (isFindOpen && typeof findPattern !== 'string' ? findTextMatches(deferredDraftText, findPattern, findRange ?? undefined) : []),
    [isFindOpen, findPattern, deferredDraftText, findRange],
  )
  const matchesByLine = useMemo(() => {
    const byLine = new Map<number, TextMatch[]>()
    for (const match of matches) {
      const lineMatches = byLine.get(match.line)
      if (lineMatches) lineMatches.push(match)
      else byLine.set(match.line, [match])
    }
    return byLine
  }, [matches])
  const currentMatch = matches.length > 0 ? matches[Math.min(matchIndex, matches.length - 1)] : undefined

  const hiddenCharacters = useMemo(() => (showHidden ? findHiddenCharacters(deferredDraftText) : null), [showHidden, deferredDraftText])
  const hiddenByLine = useMemo(() => {
    const byLine = new Map<number, Map<number, HiddenCharacterName>>()
    for (const character of hiddenCharacters?.characters ?? []) {
      const lineCharacters = byLine.get(character.line) ?? new Map<number, HiddenCharacterName>()
      lineCharacters.set(character.column, character.name)
      byLine.set(character.line, lineCharacters)
    }
    return byLine
  }, [hiddenCharacters])

  // ---------------------------------------------------------------- panels (worked out only while open)
  const stats = useMemo(() => (panelView === 'stats' ? computeTextStats(deferredDraftText, skipCommonWords) : null), [panelView, deferredDraftText, skipCommonWords])
  const selectionCounts = useMemo(() => (selectedText ? countSelection(selectedText) : null), [selectedText])
  const statusWordCount = useMemo(() => (deferredDraftText.length <= LARGE_EDIT_CHARACTER_COUNT ? countSelection(deferredDraftText).wordCount : null), [deferredDraftText])
  const diff = useMemo(
    () => (panelView === 'compare' ? diffLines(originalText, deferredDraftText, { ignoreWhitespace: compare.ignoreWhitespace, ignoreCase: compare.ignoreCase }) : null),
    [panelView, originalText, deferredDraftText, compare.ignoreWhitespace, compare.ignoreCase],
  )

  // ---------------------------------------------------------------- messages
  function showToast(message: string, canUndo = false) {
    window.clearTimeout(toastTimerRef.current)
    setToast({ id: Date.now(), message, canUndo })
    toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), [])

  // ---------------------------------------------------------------- the draft and the edit session
  function commitDraft(newText: string) {
    window.clearTimeout(commitTimerRef.current)
    lastCommittedTextRef.current = newText
    session.update((currentEdits) => withEditedText(currentEdits, originalText, newText))
  }

  function changeDraft(newText: string) {
    setDraftText(newText)
    window.clearTimeout(commitTimerRef.current)
    commitTimerRef.current = window.setTimeout(() => commitDraft(newText), COMMIT_DELAY_MS)
  }

  const liveText = () => textareaRef.current?.value ?? draftText

  // Typing not committed yet becomes its own undo step before a tool changes the text.
  function commitPendingTyping() {
    const text = liveText()
    if (text !== lastCommittedTextRef.current) commitDraft(text)
    return text
  }

  // A tool replaces the whole text in one step (one undo step) and puts the selection where the change says.
  function replaceDraftText(newText: string, selectionStart: number, selectionEnd: number) {
    setDraftText(newText)
    commitDraft(newText)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.setSelectionRange(selectionStart, selectionEnd)
      readTextareaSelection()
    })
  }

  function readTextareaSelection() {
    const textarea = textareaRef.current
    if (!textarea) return
    const caret = textarea.selectionDirection === 'backward' ? textarea.selectionStart : textarea.selectionEnd
    const line = countLineBreaksBefore(textarea.value, caret)
    setSelection({ start: textarea.selectionStart, end: textarea.selectionEnd })
    setCursor({ line, column: caret - (textarea.value.lastIndexOf('\n', caret - 1) + 1) })
  }

  function undo() {
    commitPendingTyping()
    session.undo()
  }

  function redo() {
    commitPendingTyping()
    session.redo()
  }

  // ---------------------------------------------------------------- scrolling and going to a line
  function scrollToLine(line: number) {
    if (showReadView) {
      lineVirtualizer.scrollToIndex(line, { align: 'center' })
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
    const row = mirrorRef.current?.querySelector<HTMLElement>(`.ln[data-line="${line}"]`)
    if (isPlainEditor) textarea.scrollTop = (line / Math.max(1, lines.length)) * textarea.scrollHeight - textarea.clientHeight / 2
    else if (!wrapLines) textarea.scrollTop = EDITOR_PADDING_TOP_PX + line * lineHeightPx - textarea.clientHeight / 2
    else if (row) textarea.scrollTop = row.offsetTop - textarea.clientHeight / 2
  }

  function flashLineBriefly(line: number) {
    setFlashLine(line)
    window.setTimeout(() => setFlashLine((current) => (current === line ? -1 : current)), 1100)
  }

  function goToLine(line: number, column = 0) {
    setPanelView('text')
    const targetLine = clamp(line, 0, Math.max(0, lines.length - 1))
    flashLineBriefly(targetLine)
    if (showReadView) {
      setCursor({ line: targetLine, column: 0 })
      scrollToLine(targetLine)
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
    const lineStart = findLineStartOffset(textarea.value, targetLine)
    const lineBreak = textarea.value.indexOf('\n', lineStart)
    const offset = lineStart + clamp(column, 0, (lineBreak === -1 ? textarea.value.length : lineBreak) - lineStart)
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(offset, offset)
    readTextareaSelection()
    scrollToLine(targetLine)
  }

  // ---------------------------------------------------------------- tools
  function selectionLineRange() {
    const text = liveText()
    const region = findSelectedLineRegion(text, selection.start, selection.end)
    return { first: countLineBreaksBefore(text, region.start), last: countLineBreaksBefore(text, region.end) }
  }

  function runTransform(toolId: TextToolId, options: TextToolOptions = {}) {
    const text = commitPendingTyping()
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? 0
    const end = textarea?.selectionEnd ?? 0
    const label = t(`text.tool.${toolId}` as MessageKey)
    const result = applyTextTransform(text, start, end, toolId, { ...options, ignoreCase: sortIgnoreCase })
    if (result.text === text) {
      showToast(t('text.toast.nothingToChange', { tool: label }))
      return
    }
    const { first, last } = selectionLineRange()
    replaceDraftText(result.text, result.selectionStart, result.selectionEnd)
    if (toolId === 'insertDateTime') showToast(t('text.toast.inserted', { text: isolateLeftToRight(result.text.slice(start, result.selectionEnd)) }), true)
    else showToast(end > start ? t('text.toast.appliedToLines', { tool: label, first: first + 1, last: last + 1 }) : label, true)
  }

  function openToolOptions(toolId: TextTransformId) {
    setOptionsTool(toolId)
    setOptionsDraft({ ...TEXT_TOOL_DEFAULT_OPTIONS[toolId] })
    setOpenDialog('options')
  }

  function runChain() {
    if (chainSteps.length === 0) return
    const text = commitPendingTyping()
    const result = applyToolChain(text, chainSteps, hasSelection ? selection : undefined)
    setOpenPopover(null)
    if (result.text === text) {
      showToast(t('text.toast.nothingToChange', { tool: t('text.chain.title') }))
      return
    }
    replaceDraftText(result.text, selection.start, selection.start)
    showToast(tp('text.toast.chainRan', chainSteps.length), true)
  }

  function openFind(focusInput: boolean) {
    setPanelView('text')
    setIsFindOpen(true)
    if (focusInput && selectedText && !selectedText.includes('\n')) {
      setFindQuery(selectedText)
      setMatchIndex(0)
    }
    if (focusInput)
      requestAnimationFrame(() => {
        findInputRef.current?.focus()
        findInputRef.current?.select()
      })
  }

  function closeFind() {
    setIsFindOpen(false)
    textareaRef.current?.focus({ preventScroll: true })
  }

  function toggleFindOption(option: keyof FindOptions) {
    setFindOptions((current) => ({ ...current, [option]: !current[option] }))
    setMatchIndex(0)
    if (!isFindOpen) openFind(false)
  }

  function toggleFindInSelection() {
    if (findRange) setFindRange(null)
    else if (hasSelection) setFindRange({ ...selection })
    else {
      showToast(t('text.toast.selectFirst'))
      return
    }
    setMatchIndex(0)
    if (!isFindOpen) openFind(false)
  }

  // Next and Previous select the match in the text box without taking the focus from the find box.
  function stepMatch(direction: 1 | -1) {
    if (matches.length === 0) return
    const newIndex = (Math.min(matchIndex, matches.length - 1) + direction + matches.length) % matches.length
    setMatchIndex(newIndex)
    const match = matches[newIndex]
    textareaRef.current?.setSelectionRange(match.offset, match.offset + match.end - match.start)
    setCursor({ line: match.line, column: match.start })
    scrollToLine(match.line)
  }

  function replaceCurrentMatch() {
    if (!currentMatch || typeof findPattern === 'string') return
    const text = commitPendingTyping()
    const result = replaceTextMatch(text, findPattern, currentMatch, replacement, findOptions.isRegex)
    if (result.text !== text) replaceDraftText(result.text, result.selectionEnd, result.selectionEnd)
  }

  function replaceAllMatches() {
    if (typeof findPattern === 'string') return
    const text = commitPendingTyping()
    const result = replaceAllTextMatches(text, findPattern, replacement, findOptions.isRegex, findRange ?? undefined)
    if (result.replacedCount === 0) {
      showToast(t('find.noMatches'))
      return
    }
    replaceDraftText(result.text, 0, 0)
    showToast(tp('text.toast.replacedAll', result.replacedCount), true)
  }

  function filterMatchingLines(keepMatchingLines: boolean) {
    if (typeof findPattern === 'string') {
      openFind(true)
      showToast(t('text.toast.typeFindFirst'))
      return
    }
    const text = commitPendingTyping()
    const newText = filterLinesByPattern(text, findPattern, keepMatchingLines, hasSelection ? selection : undefined)
    const label = t(keepMatchingLines ? 'text.tool.keepMatching' : 'text.tool.removeMatching')
    if (newText === text) showToast(t('text.toast.nothingToChange', { tool: label }))
    else {
      replaceDraftText(newText, 0, 0)
      showToast(label, true)
    }
  }

  function countSelectedText() {
    if (!selectedText) {
      showToast(t('text.toast.selectToCount'))
      return
    }
    const occurrenceCount = countOccurrences(liveText(), selectedText, findOptions.matchCase)
    const shownText = selectedText.length > 30 ? `${selectedText.slice(0, 30)}…` : selectedText
    showToast(tp('text.toast.occurrences', occurrenceCount, { text: isolateText(`“${shownText}”`) }))
  }

  function toggleBookmark(line = cursor.line) {
    const isBookmarked = bookmarks.has(line)
    setBookmarks((current) => {
      const next = new Set(current)
      if (isBookmarked) next.delete(line)
      else next.add(line)
      return next
    })
    showToast(t(isBookmarked ? 'text.toast.bookmarkRemoved' : 'text.toast.bookmarkAdded', { line: line + 1 }))
  }

  function jumpToBookmark(direction: 1 | -1) {
    const sortedLines = [...bookmarks].sort((first, second) => first - second)
    if (sortedLines.length === 0) return
    const target =
      direction > 0
        ? (sortedLines.find((line) => line > cursor.line) ?? sortedLines[0])
        : ([...sortedLines].reverse().find((line) => line < cursor.line) ?? sortedLines[sortedLines.length - 1])
    goToLine(target)
  }

  function togglePanel(view: 'stats' | 'compare') {
    setPanelView((current) => (current === view ? 'text' : view))
  }

  function stepChange(direction: 1 | -1) {
    setPanelView('compare')
    const hunkCount = diff?.hunks.length ?? 0
    if (hunkCount === 0) return
    const newIndex = (compare.index + direction + hunkCount) % hunkCount
    setCompare((current) => ({ ...current, index: newIndex }))
    requestAnimationFrame(() => document.querySelector(`#diff-output [data-hunk="${newIndex}"]`)?.scrollIntoView({ block: 'center' }))
  }

  function revertAll() {
    if (!isEdited) return
    commitPendingTyping()
    session.revertAll()
    setCompare((current) => ({ ...current, index: 0 }))
    showToast(t('text.toast.revertedAll'), true)
  }

  function fixMixedEndings() {
    if (!exportSource || !hasMixedEndings) return
    session.update((currentEdits) => withLineEnding(currentEdits, exportSource.lineEnding, exportSource.lineEnding, true))
    showToast(t('text.toast.endingsFixed', { type: isolateLeftToRight(LINE_ENDING_NAMES[exportSource.lineEnding]) }), true)
  }

  async function reopenWithEncoding() {
    if (encodingDraft === encodingChoice) return
    if (isEdited && !(await confirmDiscardEdits())) return
    window.clearTimeout(commitTimerRef.current)
    setEncodingChoice(encodingDraft)
    resetEditSession()
    setBookmarks(new Set())
    showToast(t('text.toast.reopened', { encoding: encodingDraft === 'auto' ? t('text.encoding.auto') : ENCODING_LABELS[encodingDraft] }))
  }

  async function copyAllText() {
    try {
      await navigator.clipboard.writeText(liveText().replace(/\n/g, effectiveLineEnding))
      showToast(tp('text.toast.copiedLines', lines.length))
    } catch {
      showToast(t('text.toast.copyBlocked'))
    }
  }

  function openGoToDialog() {
    setGoToText(String(cursor.line + 1))
    setGoToHint(t('text.goTo.hint', { last: lines.length }))
    setOpenDialog('goTo')
  }

  function openDownloadDialog() {
    const sourceEncoding: TextDownloadEncoding = exportSource?.hadByteOrderMark
      ? 'utf-8-bom'
      : readableText.status === 'ok' && readableText.encodingLabel === 'UTF-16 LE'
        ? 'utf-16le'
        : readableText.status === 'ok' && readableText.encodingLabel === 'Windows-1256'
          ? 'windows-1256'
          : 'utf-8'
    setDownloadSettings({ fileName: buildDownloadName(fileName, isEdited, null), encoding: sourceEncoding, lineEnding: effectiveLineEnding })
    setOpenDialog('download')
  }

  function toggleTheme() {
    const nextIsDark = !isDark
    document.documentElement.classList.toggle('dark', nextIsDark)
    try {
      localStorage.setItem('theme', nextIsDark ? 'dark' : 'light')
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    setIsDark(nextIsDark)
  }

  function chooseTab(tab: RibbonTabKey) {
    const isSameOpenTab = tab === activeTab && isRibbonPeekOpen
    setActiveTab(tab)
    if (isPhone) setIsToolsSheetOpen(true)
    else if (isRibbonCollapsed) setIsRibbonPeekOpen(!isSameOpenTab)
  }

  function toggleRibbonCollapsed() {
    setIsRibbonCollapsed((current) => !current)
    setIsRibbonPeekOpen(false)
  }

  // What each ribbon item is called, shows and does, as things are now.
  function describeTool(key: ToolKey): ToolDescription {
    const label = t(`text.tool.${key}` as MessageKey)
    const plain = (run: (anchor: HTMLElement) => void, extra: Partial<ToolDescription> = {}): ToolDescription => ({ label, hint: label, icon: TOOL_ICONS[key], run, ...extra })
    switch (key) {
      case 'findReplace':
        return plain(() => openFind(true), { keys: shortcutLabel('F') })
      case 'goToLine':
        return plain(openGoToDialog, { keys: shortcutLabel('G') })
      case 'copyAll':
        return plain(() => void copyAllText())
      case 'print':
        return plain(() => setIsPrinting(true))
      case 'chain':
        return plain((anchor) => setOpenPopover({ kind: 'chain', anchor }), { hint: t('text.tip.chain'), popup: 'dialog' })
      case 'sortMenu':
        return plain((anchor) => setOpenPopover({ kind: 'sort', anchor }), { popup: 'menu' })
      case 'sortIgnoreCase':
        return plain(() => setSortIgnoreCase((current) => !current), { isPressed: sortIgnoreCase })
      case 'findMatchCase':
        return plain(() => toggleFindOption('matchCase'), { isPressed: findOptions.matchCase })
      case 'findWholeWord':
        return plain(() => toggleFindOption('wholeWord'), { isPressed: findOptions.wholeWord })
      case 'findRegex':
        return plain(() => toggleFindOption('isRegex'), { isPressed: findOptions.isRegex })
      case 'findInSelection':
        return plain(toggleFindInSelection, { isPressed: findRange !== null })
      case 'keepMatching':
        return plain(() => filterMatchingLines(true))
      case 'removeMatching':
        return plain(() => filterMatchingLines(false))
      case 'countSelection':
        return plain(countSelectedText, { hint: t('text.tip.countSelection') })
      case 'bookmarkToggle':
        return plain(() => toggleBookmark(), { keys: shortcutLabel('F2') })
      case 'bookmarkNext':
        return plain(() => jumpToBookmark(1), { keys: 'F2', isDisabled: bookmarks.size === 0 })
      case 'bookmarkPrevious':
        return plain(() => jumpToBookmark(-1), { keys: 'Shift+F2', isDisabled: bookmarks.size === 0 })
      case 'bookmarksClear':
        return plain(() => setBookmarks(new Set()), { isDisabled: bookmarks.size === 0 })
      case 'stats':
        return plain(() => togglePanel('stats'), { isPressed: panelView === 'stats' })
      case 'selectionStats':
        return plain(() => {
          setPanelView('stats')
          requestAnimationFrame(() => document.getElementById('selection-card')?.scrollIntoView({ block: 'center' }))
        })
      case 'compare':
        return plain(() => togglePanel('compare'), { isPressed: panelView === 'compare' })
      case 'diffInline':
        return plain(
          () => {
            setCompare((current) => ({ ...current, mode: 'inline' }))
            setPanelView('compare')
          },
          { isPressed: compare.mode === 'inline' },
        )
      case 'diffSideBySide':
        return plain(
          () => {
            setCompare((current) => ({ ...current, mode: 'side' }))
            setPanelView('compare')
          },
          { isPressed: compare.mode === 'side' },
        )
      case 'diffIgnoreWhitespace':
        return plain(
          () => {
            setCompare((current) => ({ ...current, ignoreWhitespace: !current.ignoreWhitespace }))
            setPanelView('compare')
          },
          { isPressed: compare.ignoreWhitespace },
        )
      case 'diffIgnoreCase':
        return plain(
          () => {
            setCompare((current) => ({ ...current, ignoreCase: !current.ignoreCase }))
            setPanelView('compare')
          },
          { isPressed: compare.ignoreCase },
        )
      case 'changePrevious':
        return plain(() => stepChange(-1), { isDisabled: !isEdited })
      case 'changeNext':
        return plain(() => stepChange(1), { isDisabled: !isEdited })
      case 'revertAll':
        return plain(revertAll, { isDisabled: !isEdited })
      case 'wrap':
        return plain(() => setWrapLines((current) => !current), { isPressed: wrapLines })
      case 'lineNumbers':
        return plain(() => setShowLineNumbers((current) => !current), { isPressed: showLineNumbers })
      case 'currentLine':
        return plain(() => setHighlightCurrentLine((current) => !current), { isPressed: highlightCurrentLine })
      case 'minimap':
        return plain(() => setShowMinimap((current) => !current), { isPressed: showMinimap })
      case 'showHidden':
        return plain(() => setShowHidden((current) => !current), { isPressed: showHidden, hint: t('text.tip.showHidden') })
      case 'openFile':
        return plain(onOpenAnotherFile)
      case 'reopen':
        return plain(() => void reopenWithEncoding(), { hint: t('text.tip.reopen') })
      case 'fixMixedEndings':
        return plain(fixMixedEndings, { isDisabled: !hasMixedEndings })
      case 'downloadOptions':
        return plain(openDownloadDialog)
      case 'insertDateTime':
        return plain(() => runTransform('insertDateTime'), { hint: showReadView ? t('text.tip.insertNeedsEditing') : t('text.tip.insertDateTime'), isDisabled: showReadView })
      default: {
        const hasOptions = TOOL_OPTION_FIELDS[key] !== undefined
        return plain(() => (hasOptions ? openToolOptions(key) : runTransform(key)), { hint: hasOptions ? `${label}…` : label })
      }
    }
  }

  function noteText(note: NoteKey) {
    if (note === 'encoding') return t('text.note.encoding', { encoding: isolateLeftToRight(readableText.status === 'ok' ? readableText.encodingLabel : '—') })
    if (note === 'endings')
      return hasMixedEndings
        ? t('text.note.mixedEndings', { crlf: lineEndingCounts.crlf, lf: lineEndingCounts.lf, cr: lineEndingCounts.cr })
        : tp('text.note.endings', lines.length, { type: isolateLeftToRight(LINE_ENDING_NAMES[effectiveLineEnding]) })
    return t('text.note.large', { size: isolateLeftToRight(formatFileSize(openedFile.file.size)) })
  }

  // ---------------------------------------------------------------- page shortcuts (registered only while the page is open)
  const latestShortcutsRef = useRef({ openFind: () => {}, openGoTo: () => {}, toggleRibbon: () => {}, bookmarkKey: (_event: KeyboardEvent) => {}, undo: () => {}, redo: () => {}, escape: () => {} })
  useEffect(() => {
    latestShortcutsRef.current = {
      openFind: () => openFind(true),
      openGoTo: openGoToDialog,
      toggleRibbon: toggleRibbonCollapsed,
      bookmarkKey: (event) => (event.ctrlKey || event.metaKey ? toggleBookmark() : jumpToBookmark(event.shiftKey ? -1 : 1)),
      undo,
      redo,
      escape: () => {
        hideTooltip()
        if (document.querySelector('#txt-workbench dialog[open], #txt-workbench [popover]:popover-open:not(#tooltip)')) return
        if (isRibbonPeekOpen) setIsRibbonPeekOpen(false)
        else if (panelView !== 'text') setPanelView('text')
      },
    }
  })
  useEffect(() => {
    function runShortcut(event: KeyboardEvent) {
      const target = event.target
      const isTypingField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      const hasModifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const shortcuts = latestShortcutsRef.current
      if (event.key === 'Escape') shortcuts.escape()
      else if (hasModifier && key === 'g') {
        event.preventDefault()
        shortcuts.openGoTo()
      } else if (hasModifier && key === 'f') {
        event.preventDefault()
        shortcuts.openFind()
      } else if (hasModifier && event.key === 'F1') {
        event.preventDefault()
        shortcuts.toggleRibbon()
      } else if (event.key === 'F2') {
        event.preventDefault()
        shortcuts.bookmarkKey(event)
      } else if (hasModifier && !isTypingField && (key === 'z' || key === 'y')) {
        event.preventDefault()
        if (key === 'y' || event.shiftKey) shortcuts.redo()
        else shortcuts.undo()
      } else if (event.key === '/' && !isTypingField && !hasModifier) {
        event.preventDefault()
        shortcuts.openFind()
      }
    }
    window.addEventListener('keydown', runShortcut)
    return () => window.removeEventListener('keydown', runShortcut)
  }, [])

  // ---------------------------------------------------------------- tooltips: the label (and shortcut) of an icon button
  function hideTooltip() {
    window.clearTimeout(tooltipTimerRef.current)
    tooltipTargetRef.current = null
    const tooltip = tooltipRef.current
    if (!tooltip) return
    tooltip.classList.remove('show')
    if (tooltip.matches(':popover-open')) tooltip.hidePopover()
  }

  function showTooltipFor(element: HTMLElement) {
    const tooltip = tooltipRef.current
    if (!tooltip || !element.isConnected || element.getClientRects().length === 0) return
    tooltip.replaceChildren(document.createTextNode(element.dataset.hint ?? ''))
    if (element.dataset.keys) {
      const keys = document.createElement('kbd')
      keys.textContent = element.dataset.keys
      tooltip.append(keys)
    }
    if (!tooltip.matches(':popover-open')) tooltip.showPopover()
    const box = element.getBoundingClientRect()
    let top = box.bottom + 8
    if (top + tooltip.offsetHeight > window.innerHeight - 6) top = box.top - tooltip.offsetHeight - 8
    tooltip.style.left = `${clamp(box.left + box.width / 2 - tooltip.offsetWidth / 2, 6, window.innerWidth - tooltip.offsetWidth - 6)}px`
    tooltip.style.top = `${Math.max(6, top)}px`
    tooltip.classList.add('show')
  }

  function scheduleTooltip(element: HTMLElement | null) {
    if (element === tooltipTargetRef.current) return
    hideTooltip()
    if (!element) return
    tooltipTargetRef.current = element
    tooltipTimerRef.current = window.setTimeout(() => showTooltipFor(element), 300)
  }
  useEffect(() => () => window.clearTimeout(tooltipTimerRef.current), [])

  // ---------------------------------------------------------------- the mirror under the text box
  const effectiveWrapColumn = wrapLines ? wrapColumn : 0
  const characterWidthPx = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return textSizePx * 0.6
    context.font = `${textSizePx}px ${FONT_STACKS[fontKey]}`
    return context.measureText('0').width
  }, [textSizePx, fontKey])
  // The text's side padding, shared by the text box and the mirror; a wrap column widens the end padding.
  const textPaddingStartPx = isPhone ? 10 : 18
  const textPaddingEndPx = effectiveWrapColumn > 0 ? Math.max(isPhone ? 12 : 32, editorSize.clientWidth - textPaddingStartPx - effectiveWrapColumn * characterWidthPx) : isPhone ? 12 : 32

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const observer = new ResizeObserver(() => setEditorSize({ clientWidth: textarea.clientWidth, clientHeight: textarea.clientHeight }))
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [showReadView, isPlainEditor, showLineNumbers])

  // The mirror follows the text box's scroll position; drawn lines change only when the box scrolls past the extra ones.
  function syncMirrorWithTextarea() {
    const textarea = textareaRef.current
    const mirror = mirrorRef.current
    if (!textarea) return
    if (mirror) {
      mirror.style.top = `${-textarea.scrollTop}px`
      mirror.style.setProperty('--scroll-x', String(textarea.scrollLeft))
    }
    const topLine = Math.floor(textarea.scrollTop / lineHeightPx)
    setVisibleTopLine((current) => (Math.abs(current - topLine) > MIRROR_EXTRA_LINES / 2 ? topLine : current))
    updateMinimapViewport()
  }
  useLayoutEffect(syncMirrorWithTextarea)

  // ---------------------------------------------------------------- the large-file view
  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const lineVirtualizer = useVirtualizer({
    count: showReadView ? lines.length : 0,
    getScrollElement: () => readViewRef.current,
    estimateSize: () => lineHeightPx,
    paddingStart: EDITOR_PADDING_TOP_PX,
    paddingEnd: EDITOR_PADDING_TOP_PX,
    overscan: 20,
  })
  useEffect(() => {
    lineVirtualizer.measure()
  }, [lineVirtualizer, lineHeightPx, wrapLines, fontKey])

  // ---------------------------------------------------------------- minimap
  function updateMinimapViewport() {
    const viewport = minimapViewportRef.current
    const scrollBox = showReadView ? readViewRef.current : textareaRef.current
    const canvas = minimapCanvasRef.current
    if (!viewport || !scrollBox || !canvas) return
    const drawnHeight = Number(canvas.dataset.drawnHeight) || 0
    const ratio = scrollBox.scrollHeight > 0 ? drawnHeight / scrollBox.scrollHeight : 0
    viewport.style.top = `${8 + scrollBox.scrollTop * ratio - 2}px`
    viewport.style.height = `${Math.max(14, scrollBox.clientHeight * ratio + 4)}px`
  }

  useEffect(() => {
    const canvas = minimapCanvasRef.current
    if (!showMinimap || isPhone || !canvas) return
    const box = canvas.parentElement!
    const width = box.clientWidth
    const height = box.clientHeight
    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(pixelRatio, pixelRatio)
    const styles = getComputedStyle(box)
    const step = Math.min(4, (height - 16) / Math.max(1, lines.length))
    // A long file is drawn one sampled line per pixel row.
    const rowCount = Math.min(lines.length, Math.floor((height - 16) / Math.max(step, 1)))
    const drawnStep = (height - 16) / Math.max(1, rowCount) < step ? step : Math.min(step, (height - 16) / Math.max(1, rowCount))
    const matchLines = new Set(matches.map((match) => match.line))
    for (let row = 0; row < rowCount; row++) {
      const lineIndex = Math.floor((row * lines.length) / rowCount)
      const y = 8 + row * drawnStep
      if (matchLines.has(lineIndex)) {
        context.fillStyle = styles.getPropertyValue('--mark-cur')
        context.fillRect(2, y - 0.5, width - 4, Math.max(2, drawnStep))
      }
      if (bookmarks.has(lineIndex)) {
        context.fillStyle = styles.getPropertyValue('--accent')
        context.fillRect(2, y - 0.5, 3, Math.max(2.5, drawnStep))
      }
      context.fillStyle = styles.getPropertyValue('--ink')
      context.globalAlpha = 0.34
      const isRightToLeft = /^[^A-Za-z]*[؀-ۿ]/.test(lines[lineIndex])
      const expandedLine = lines[lineIndex].slice(0, 160).replace(/\t/g, '    ')
      for (const word of expandedLine.matchAll(/\S+/g)) {
        const wordStart = 8 + word.index * 0.62
        if (wordStart > width - 8) break
        const wordWidth = Math.min(Math.max(1, word[0].length * 0.62), width - 8 - wordStart)
        context.fillRect(isRightToLeft ? width - wordStart - wordWidth : wordStart, y, wordWidth, Math.max(1.4, drawnStep - 1.4))
      }
      context.globalAlpha = 1
    }
    canvas.dataset.drawnHeight = String(rowCount * drawnStep)
    canvas.dataset.lineCount = String(lines.length)
    updateMinimapViewport()
  })

  function scrollFromMinimap(event: ReactMouseEvent<HTMLDivElement>) {
    const canvas = minimapCanvasRef.current
    if (!canvas) return
    const drawnHeight = Number(canvas.dataset.drawnHeight) || 1
    const line = clamp(Math.floor(((event.nativeEvent.offsetY - 8) / drawnHeight) * lines.length), 0, lines.length - 1)
    scrollToLine(line)
  }

  // ---------------------------------------------------------------- popovers and printing
  useEffect(() => {
    const popovers = { sort: sortMenuRef.current, chain: chainPopoverRef.current }
    for (const [kind, popover] of Object.entries(popovers)) {
      if (!popover) continue
      const shouldBeOpen = openPopover?.kind === kind
      if (shouldBeOpen && !popover.matches(':popover-open')) {
        popover.showPopover()
        const anchor = openPopover.anchor?.isConnected && openPopover.anchor.offsetParent ? openPopover.anchor : document.getElementById('ribbon-tabs')
        if (anchor) {
          const box = anchor.getBoundingClientRect()
          const isRightToLeft = document.documentElement.dir === 'rtl'
          popover.style.left = `${clamp(isRightToLeft ? box.right - popover.offsetWidth : box.left, 8, window.innerWidth - popover.offsetWidth - 8)}px`
          popover.style.top = `${box.bottom + 4}px`
        }
      } else if (!shouldBeOpen && popover.matches(':popover-open')) popover.hidePopover()
    }
  }, [openPopover])

  useEffect(() => {
    const popovers = [sortMenuRef.current, chainPopoverRef.current]
    const closeWhenDismissed = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') setOpenPopover((current) => (current && document.getElementById(current.kind === 'sort' ? 'sort-menu' : 'chain-popover') === event.target ? null : current))
    }
    for (const popover of popovers) popover?.addEventListener('toggle', closeWhenDismissed)
    return () => {
      for (const popover of popovers) popover?.removeEventListener('toggle', closeWhenDismissed)
    }
  }, [])

  useEffect(() => {
    if (!isPrinting) return
    window.print()
    setIsPrinting(false)
  }, [isPrinting])

  useEffect(() => {
    setIsToolsSheetOpen((current) => current && isPhone)
  }, [isPhone])

  // ---------------------------------------------------------------- rendering helpers (render functions, not components)
  function renderToolButton(key: ToolKey, prefix: 'ribbon' | 'sheet', isBig: boolean) {
    const tool = describeTool(key)
    const id = `${prefix}-${toKebabCase(key)}-button`
    const popupId = tool.popup === 'menu' ? 'sort-menu' : tool.popup === 'dialog' ? 'chain-popover' : undefined
    return (
      <button
        key={key}
        type="button"
        className={`ib tb${isBig && prefix === 'ribbon' ? ' big' : ''}`}
        id={id}
        aria-label={tool.label}
        data-hint={tool.hint}
        data-keys={tool.keys}
        aria-pressed={tool.isPressed}
        aria-haspopup={tool.popup}
        aria-expanded={tool.popup ? openPopover?.kind === (tool.popup === 'menu' ? 'sort' : 'chain') : undefined}
        aria-controls={popupId}
        data-count={key === 'chain' ? chainSteps.length : undefined}
        disabled={tool.isDisabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          hideTooltip()
          const isToggle = tool.isPressed !== undefined || tool.popup !== undefined
          if (prefix === 'sheet' && !isToggle) setIsToolsSheetOpen(false)
          tool.run(event.currentTarget)
          if (prefix === 'ribbon' && isRibbonPeekOpen && !tool.popup) setIsRibbonPeekOpen(false)
        }}
      >
        <Icon name={tool.icon} />
      </button>
    )
  }

  function renderRibbonItem(item: RibbonItem, prefix: 'ribbon' | 'sheet') {
    if (item[0] === 'big' || item[0] === 'small') return renderToolButton(item[1], prefix, item[0] === 'big')
    if (item[0] === 'note') {
      const text = noteText(item[1])
      return (
        <button key={item[1]} type="button" className="ib tb" id={`${prefix}-${item[1]}-note-button`} aria-label={text} data-hint={text} onMouseDown={(event) => event.preventDefault()} onClick={() => showToast(text)}>
          <Icon name={item[1] === 'endings' ? 'endings' : 'info'} />
        </button>
      )
    }
    if (item[0] === 'legal') {
      // Open in a new tab, so the open file and its edits stay where they are. The phone sheet draws the same group again.
      const idPrefix = prefix === 'ribbon' ? 'menu' : 'sheet'
      return (
        <div key="legal" className="legal-links">
          <a className="ib tb" id={`${idPrefix}-link-privacy`} href={localizePath(locale, '/privacy')} target="_blank" rel="noopener" aria-label={t('legal.privacy')} data-hint={t('legal.privacy')}>
            <Icon name="lock" />
          </a>
          <a className="ib tb" id={`${idPrefix}-link-terms`} href={localizePath(locale, '/terms')} target="_blank" rel="noopener" aria-label={t('legal.terms')} data-hint={t('legal.terms')}>
            <Icon name="file" />
          </a>
          <p className="legal-note" id={`${idPrefix}-disclaimer`}>
            {t('legal.disclaimer')}
          </p>
        </div>
      )
    }
    if (item[0] === 'wrapColumn') {
      const inputId = `${prefix}-wrap-column-input`
      return (
        <label key="wrap-column" className="field" htmlFor={inputId} data-hint={t('text.tip.wrapColumn')}>
          <Icon name="hard-wrap" />
          <span className="vh">{t('text.field.wrapColumn')}</span>
          <input
            type="number"
            id={inputId}
            min={0}
            max={400}
            placeholder={t('text.field.off')}
            value={wrapColumn || ''}
            onChange={(event) => {
              const column = clamp(Number(event.target.value) || 0, 0, 400)
              setWrapColumn(column)
              if (column > 0) setWrapLines(true)
            }}
          />
        </label>
      )
    }
    const field = item[1]
    const selectId = `${prefix}-${field}-select`
    const fieldLabel = t(field === 'font' ? 'text.field.font' : field === 'size' ? 'text.field.size' : 'text.field.encoding')
    return (
      <label key={field} className="field" htmlFor={selectId} data-hint={fieldLabel}>
        <Icon name={field === 'font' ? 'font' : field === 'size' ? 'up-down' : 'encoding'} />
        <span className="vh">{fieldLabel}</span>
        {field === 'font' && (
          <select id={selectId} value={fontKey} onChange={(event) => setFontKey(event.target.value as FontKey)}>
            <option value="mono">{t('text.font.mono')}</option>
            <option value="sans">{t('text.font.sans')}</option>
            <option value="serif">{t('text.font.serif')}</option>
          </select>
        )}
        {field === 'size' && (
          <select id={selectId} value={textSizePx} onChange={(event) => setTextSizePx(Number(event.target.value))}>
            {TEXT_SIZES_PX.map((size) => (
              <option key={size} value={size}>
                {t('text.field.sizePx', { size })}
              </option>
            ))}
          </select>
        )}
        {field === 'encoding' && (
          <select id={selectId} value={encodingDraft} onChange={(event) => setEncodingDraft(event.target.value as EncodingChoice)}>
            {ENCODING_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice === 'auto' ? t('text.encoding.auto') : ENCODING_LABELS[choice]}
              </option>
            ))}
          </select>
        )}
      </label>
    )
  }

  // The menu bar, like a word processor's: one menu per ribbon tab (File first), listing the tab's tools by group. The toolbar
  // under it shows the open tab's tools as icons.
  function buildMenus(): MenuDefinition[] {
    const menuTabs = [...RIBBON_TABS.filter(([key]) => key === 'file'), ...RIBBON_TABS.filter(([key]) => key !== 'file')]
    return menuTabs.map(([tabKey, labelKey]) => ({
      id: tabKey,
      label: t(labelKey),
      items: RIBBON[tabKey].flatMap((group): MenuEntry[] => {
        const tools = group.items.flatMap((item): MenuEntry[] => {
          if (item[0] === 'legal') {
            return [
              { id: 'menu-link-privacy', label: t('legal.privacy'), icon: 'lock', href: localizePath(locale, '/privacy') },
              { id: 'menu-link-terms', label: t('legal.terms'), icon: 'file', href: localizePath(locale, '/terms') },
              { id: 'menu-disclaimer', note: t('legal.disclaimer') },
            ]
          }
          if ((item[0] !== 'big' && item[0] !== 'small') || item[1] === 'sortMenu') return []
          const key = item[1]
          const tool = describeTool(key)
          return [{
            id: toKebabCase(key),
            label: tool.label,
            icon: tool.icon,
            hint: tool.keys,
            kind: tool.isPressed === undefined ? undefined : 'checkbox',
            isChecked: tool.isPressed,
            isDisabled: tool.isDisabled,
            onSelect: () => tool.run(document.getElementById(`ribbon-${toKebabCase(key)}-button`) ?? (document.getElementById(`menu-${tabKey}`) as HTMLElement)),
          }]
        })
        return tools.length ? [{ heading: t(group.labelKey) }, ...tools] : []
      }),
    }))
  }

  function renderRibbon() {
    return (
      <nav id="ribbon" className={`${isRibbonCollapsed ? 'collapsed' : ''}${isRibbonPeekOpen ? ' peek' : ''}`} aria-label={t('text.ribbon.label')}>
        <div id="ribbon-tab-row">
          <div
            id="ribbon-tabs"
            role="tablist"
            aria-label={t('text.ribbon.tabs')}
            onKeyDown={(event) => {
              const keys = RIBBON_TABS.map(([key]) => key)
              const isRightToLeft = document.documentElement.dir === 'rtl'
              const step = event.key === 'ArrowRight' ? (isRightToLeft ? -1 : 1) : event.key === 'ArrowLeft' ? (isRightToLeft ? 1 : -1) : 0
              let index = keys.indexOf(activeTab)
              if (step) index = (index + step + keys.length) % keys.length
              else if (event.key === 'Home') index = 0
              else if (event.key === 'End') index = keys.length - 1
              else return
              event.preventDefault()
              setActiveTab(keys[index])
              document.getElementById(`ribbon-tab-${keys[index]}`)?.focus()
            }}
          >
            {RIBBON_TABS.map(([key, labelKey]) => (
              <button
                key={key}
                type="button"
                role="tab"
                className="rtab"
                id={`ribbon-tab-${key}`}
                aria-selected={activeTab === key}
                tabIndex={activeTab === key ? 0 : -1}
                aria-controls="ribbon-panel"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseTab(key)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ib"
            id="ribbon-collapse-button"
            aria-expanded={!isRibbonCollapsed || isRibbonPeekOpen}
            aria-controls="ribbon-panel"
            aria-label={t(isRibbonCollapsed ? 'text.ribbon.expand' : 'text.ribbon.collapse')}
            data-hint={t(isRibbonCollapsed ? 'text.ribbon.expand' : 'text.ribbon.collapse')}
            data-keys={shortcutLabel('F1')}
            onClick={toggleRibbonCollapsed}
          >
            <Icon name={isRibbonCollapsed ? 'chev' : 'up'} />
          </button>
        </div>
        <div id="ribbon-panel" role="tabpanel" aria-labelledby={`ribbon-tab-${activeTab}`}>
          {RIBBON[activeTab].map((group) => (
            <div key={group.labelKey} className="grp" role="group" aria-label={t(group.labelKey)} data-tint={group.tint}>
              <div className="grp-items">{group.items.map((item) => renderRibbonItem(item, 'ribbon'))}</div>
              <div className="grp-label" aria-hidden="true">
                {t(group.labelKey)}
              </div>
            </div>
          ))}
        </div>
      </nav>
    )
  }

  function renderToolsSheet() {
    const shownKeys = new Set<string>()
    return (
      <WorkbenchDialog id="tools-sheet" titleId="sheet-title" isOpen={isToolsSheetOpen} onClose={() => setIsToolsSheetOpen(false)}>
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id="sheet-title">{t('text.sheet.title', { tab: t(RIBBON_TABS.find(([key]) => key === activeTab)![1]) })}</h2>
          <button type="button" className="mini" id="sheet-close-button" aria-label={t('text.sheet.close')} onClick={() => setIsToolsSheetOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        <div id="sheet-chips" role="tablist" aria-label={t('text.ribbon.tabs')}>
          {RIBBON_TABS.map(([key, labelKey, icon]) => (
            <button key={key} type="button" role="tab" className="chip" id={`sheet-tab-${key}`} aria-selected={key === activeTab} aria-label={t('text.sheet.title', { tab: t(labelKey) })} onClick={() => setActiveTab(key)}>
              <Icon name={icon} />
            </button>
          ))}
        </div>
        <div id="sheet-body">
          {RIBBON[activeTab].map((group) => {
            // On a phone the sort menu is spread out into its tools.
            const items = group.items.flatMap((item): RibbonItem[] => ((item[0] === 'big' || item[0] === 'small') && item[1] === 'sortMenu' ? [...SORT_TOOL_IDS.map((id): RibbonItem => ['small', id]), ['small', 'sortIgnoreCase']] : [item]))
            const uniqueItems = items.filter((item) => item[0] !== 'big' && item[0] !== 'small' ? true : !shownKeys.has(item[1]) && Boolean(shownKeys.add(item[1])))
            return (
              <section key={group.labelKey} className="sg" data-tint={group.tint}>
                <h3>{t(group.labelKey)}</h3>
                <div className="sg-grid">{uniqueItems.map((item) => renderRibbonItem(item, 'sheet'))}</div>
              </section>
            )
          })}
        </div>
      </WorkbenchDialog>
    )
  }

  function renderSortMenu() {
    const menuItem = (toolId: TextTransformId, hintKey?: MessageKey) => (
      <button
        key={toolId}
        type="button"
        role="menuitem"
        id={`sort-menu-${toKebabCase(toolId)}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpenPopover(null)
          runTransform(toolId)
        }}
      >
        <Icon name={TOOL_ICONS[toolId]} />
        {t(`text.tool.${toolId}` as MessageKey)}
        {hintKey && <span className="hint">{t(hintKey)}</span>}
      </button>
    )
    return (
      <div id="sort-menu" className="menu" popover="auto" role="menu" aria-label={t('text.tool.sortMenu')} ref={sortMenuRef}>
        {menuItem('sortAscending')}
        {menuItem('sortDescending')}
        {menuItem('sortNumeric', 'text.sort.firstNumber')}
        {menuItem('sortNatural')}
        {menuItem('sortByLength', 'text.sort.shortFirst')}
        <hr />
        <label htmlFor="sort-menu-ignore-case">
          <input type="checkbox" role="menuitemcheckbox" id="sort-menu-ignore-case" checked={sortIgnoreCase} onChange={(event) => setSortIgnoreCase(event.target.checked)} />
          {t('text.tool.sortIgnoreCase')}
          <span className="hint">{t('text.sort.alsoDuplicates')}</span>
        </label>
        {menuItem('reverseLines')}
        {menuItem('shuffleLines')}
      </div>
    )
  }

  function describeOptions(toolId: TextTransformId, options: TextToolOptions | undefined) {
    const fields = TOOL_OPTION_FIELDS[toolId] ?? []
    return fields
      .filter((field) => field.type !== 'checkbox')
      .map((field) => {
        const value = String(options?.[field.key] ?? TEXT_TOOL_DEFAULT_OPTIONS[toolId]?.[field.key] ?? '')
        return field.choices?.find(([choice]) => choice === value)?.[1].trim() ?? JSON.stringify(value)
      })
      .join(', ')
  }

  function renderChainPopover() {
    const isOpen = openPopover?.kind === 'chain'
    const preview = isOpen && chainSteps.length > 0 ? applyToolChain(liveText(), chainSteps, hasSelection ? selection : undefined) : null
    const moveStep = (position: number, direction: number) =>
      setChainSteps((current) => {
        const next = current.slice()
        ;[next[position], next[position + direction]] = [next[position + direction], next[position]]
        return next
      })
    return (
      <div id="chain-popover" popover="auto" role="dialog" aria-labelledby="chain-title" ref={chainPopoverRef}>
        <div className="pop-head">
          <h2 id="chain-title">
            <Icon name="chain" />
            {t('text.chain.title')}
          </h2>
          <p>{t('text.chain.intro')}</p>
        </div>
        <ol id="chain-steps">
          {chainSteps.length === 0 && <li className="chain-empty">{t('text.chain.empty')}</li>}
          {chainSteps.map((step, position) => (
            <li key={position}>
              <span className="nm">
                {t(`text.tool.${step.toolId}` as MessageKey)}
                <small>{[describeOptions(step.toolId, step.options), preview ? tp('text.chain.changedLines', preview.changedLineCounts[position]) : ''].filter(Boolean).join(' · ')}</small>
              </span>
              <button type="button" className="mini" id={`chain-up-${position + 1}`} aria-label={t('text.chain.moveUp', { step: position + 1 })} disabled={position === 0} onClick={() => moveStep(position, -1)}>
                <Icon name="up" />
              </button>
              <button type="button" className="mini" id={`chain-down-${position + 1}`} aria-label={t('text.chain.moveDown', { step: position + 1 })} disabled={position === chainSteps.length - 1} onClick={() => moveStep(position, 1)}>
                <Icon name="chev" />
              </button>
              <button type="button" className="mini" id={`chain-remove-${position + 1}`} aria-label={t('text.chain.remove', { step: position + 1 })} onClick={() => setChainSteps((current) => current.filter((_, index) => index !== position))}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ol>
        <div className="chain-add">
          <label className="vh" htmlFor="chain-add-select">
            {t('text.chain.toolToAdd')}
          </label>
          <select id="chain-add-select" value={chainToolToAdd} onChange={(event) => setChainToolToAdd(event.target.value as TextTransformId)}>
            {TRANSFORM_GROUPS.map(([groupKey, toolIds]) => (
              <optgroup key={groupKey} label={t(groupKey)}>
                {toolIds.map((toolId) => (
                  <option key={toolId} value={toolId}>
                    {t(`text.tool.${toolId}` as MessageKey)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="sbtn" id="chain-add-button" onClick={() => setChainSteps((current) => [...current, { toolId: chainToolToAdd, options: { ...TEXT_TOOL_DEFAULT_OPTIONS[chainToolToAdd] }, enabled: true }])}>
            <Icon name="plus" />
            {t('text.chain.addStep')}
          </button>
        </div>
        <div className="pop-foot">
          <span id="chain-preview">{chainSteps.length === 0 ? t('text.chain.runsOn') : t(hasSelection ? 'text.chain.onSelection' : 'text.chain.onWholeFile')}</span>
          <button type="button" className="sbtn" id="chain-clear-button" disabled={chainSteps.length === 0} onClick={() => setChainSteps([])}>
            {t('text.chain.clear')}
          </button>
          <button type="button" className="btn primary" id="chain-apply-button" disabled={chainSteps.length === 0} onClick={runChain}>
            <Icon name="play" />
            {t('text.chain.run')}
          </button>
        </div>
      </div>
    )
  }

  function renderFindStrip() {
    const findCountText =
      findPattern === 'invalidPattern' ? t('text.find.invalid') : findQuery === '' || matches.length === 0 ? t('find.noMatches') : t('find.matchPosition', { position: Math.min(matchIndex, matches.length - 1) + 1, total: matches.length })
    const toggle = (id: string, labelKey: MessageKey, icon: string, isPressed: boolean, onToggle: () => void) => (
      <button type="button" className="ib tog" id={id} aria-pressed={isPressed} aria-label={t(labelKey)} data-hint={t(labelKey)} onClick={onToggle}>
        <Icon name={icon} />
      </button>
    )
    const action = (id: string, labelKey: MessageKey, icon: string, onClick: () => void, keys?: string) => (
      <button type="button" className="ib" id={id} aria-label={t(labelKey)} data-hint={t(labelKey)} data-keys={keys} onClick={onClick}>
        <Icon name={icon} />
      </button>
    )
    return (
      <div id="find-strip" role="search" aria-label={t('text.find.label')}>
        <div className="find-row">
          <input
            ref={findInputRef}
            className={`inp${findPattern === 'invalidPattern' ? ' invalid' : ''}`}
            id="find-input"
            type="search"
            dir="auto"
            placeholder={t('text.find.placeholder')}
            aria-label={t('text.find.findLabel')}
            autoComplete="off"
            spellCheck={false}
            value={findQuery}
            onChange={(event) => {
              setFindQuery(event.target.value)
              setMatchIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                stepMatch(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape') closeFind()
            }}
          />
          <span id="find-count" aria-live="polite">
            {findCountText}
          </span>
          {toggle('find-case-toggle', 'text.tool.findMatchCase', 'case', findOptions.matchCase, () => toggleFindOption('matchCase'))}
          {toggle('find-word-toggle', 'text.tool.findWholeWord', 'word', findOptions.wholeWord, () => toggleFindOption('wholeWord'))}
          {toggle('find-regex-toggle', 'text.tool.findRegex', 'regex', findOptions.isRegex, () => toggleFindOption('isRegex'))}
          {toggle('find-selection-toggle', 'text.tool.findInSelection', 'in-sel', findRange !== null, toggleFindInSelection)}
          <span className="find-sep" aria-hidden="true" />
          {action('find-prev-button', 'text.find.previous', 'up', () => stepMatch(-1), 'Shift+Enter')}
          {action('find-next-button', 'text.find.next', 'chev', () => stepMatch(1), 'Enter')}
          {action('find-close-button', 'text.find.close', 'close', closeFind, 'Esc')}
        </div>
        <div className="find-row">
          <input
            className="inp"
            id="replace-input"
            type="text"
            dir="auto"
            placeholder={t('text.find.replacePlaceholder')}
            aria-label={t('text.find.replacePlaceholder')}
            autoComplete="off"
            spellCheck={false}
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                replaceCurrentMatch()
              } else if (event.key === 'Escape') closeFind()
            }}
          />
          {action('replace-button', 'text.find.replace', 'replace', replaceCurrentMatch, 'Enter')}
          {action('replace-all-button', 'text.find.replaceAll', 'replace-all', replaceAllMatches)}
          <span className="find-sep" aria-hidden="true" />
          {action('find-keep-button', 'text.tool.keepMatching', 'keep', () => filterMatchingLines(true))}
          {action('find-remove-button', 'text.tool.removeMatching', 'remove-lines', () => filterMatchingLines(false))}
          {action('find-help-button', 'text.find.syntax', 'info', () => showToast(t('text.find.syntax')))}
        </div>
      </div>
    )
  }

  function renderLineRow(lineIndex: number, top?: number, measureRef?: (element: HTMLElement | null) => void) {
    return (
      <LineRow
        key={lineIndex}
        lineIndex={lineIndex}
        text={lines[lineIndex]}
        isCurrent={highlightCurrentLine && lineIndex === cursor.line}
        isBookmarked={bookmarks.has(lineIndex)}
        isFlashing={lineIndex === flashLine}
        matches={matchesByLine.get(lineIndex)}
        currentMatchStart={currentMatch?.line === lineIndex ? currentMatch.start : -1}
        hiddenCharacters={hiddenByLine.get(lineIndex)}
        showHidden={showHidden}
        lineEndingLabel={lineIndex === lines.length - 1 && !deferredDraftText.endsWith('\n') ? null : hasMixedEndings ? 'EOL' : LINE_ENDING_NAMES[effectiveLineEnding]}
        top={top}
        measureRef={measureRef}
      />
    )
  }

  function handleGutterClick(event: ReactMouseEvent<HTMLElement>) {
    const gutter = (event.target as HTMLElement).closest<HTMLElement>('.gut')
    if (gutter) toggleBookmark(Number(gutter.dataset.line))
    else if (showReadView) {
      const row = (event.target as HTMLElement).closest<HTMLElement>('.ln')
      if (row) setCursor({ line: Number(row.dataset.line), column: 0 })
    }
  }

  function renderEditor() {
    const textFaceStyle = {
      '--text-font': FONT_STACKS[fontKey],
      '--text-size': `${textSizePx}px`,
      '--line-px': `${lineHeightPx}px`,
      '--pad-start': `${textPaddingStartPx}px`,
      '--pad-end': `${textPaddingEndPx}px`,
    } as CSSProperties
    if (showReadView) {
      return (
        <div
          id="text-view"
          ref={readViewRef}
          dir="ltr"
          tabIndex={0}
          aria-label={t('text.readViewLabel', { name: isolateText(fileName) })}
          className={`text-face${wrapLines ? '' : ' nowrap'}${showLineNumbers ? '' : ' no-numbers'}`}
          style={textFaceStyle}
          onScroll={updateMinimapViewport}
          onClick={handleGutterClick}
        >
          <div className="rows" style={{ height: lineVirtualizer.getTotalSize() }}>
            {lineVirtualizer.getVirtualItems().map((virtualLine) => renderLineRow(virtualLine.index, virtualLine.start, lineVirtualizer.measureElement))}
          </div>
        </div>
      )
    }
    const firstDrawnLine = Math.max(0, visibleTopLine - MIRROR_EXTRA_LINES)
    const lastDrawnLine = Math.min(lines.length - 1, visibleTopLine + Math.ceil(editorSize.clientHeight / lineHeightPx) + MIRROR_EXTRA_LINES)
    const drawnLineIndexes = isPlainEditor ? [] : wrapLines ? lines.map((_, lineIndex) => lineIndex) : Array.from({ length: Math.max(0, lastDrawnLine - firstDrawnLine + 1) }, (_, offset) => firstDrawnLine + offset)
    const scrollClassName = isPlainEditor ? ' plain' : showLineNumbers ? '' : ' no-numbers'
    return (
      <div id="editor-scroll" dir="ltr" className={`text-face${scrollClassName}`} style={textFaceStyle}>
        {!isPlainEditor && (
          <div
            id="text-mirror"
            ref={mirrorRef}
            aria-hidden="true"
            className={wrapLines ? undefined : 'nowrap'}
            style={{ width: `calc(var(--gutter) + ${editorSize.clientWidth}px)`, paddingTop: wrapLines ? EDITOR_PADDING_TOP_PX : 0, height: wrapLines ? undefined : EDITOR_PADDING_TOP_PX + lines.length * lineHeightPx }}
            onClick={handleGutterClick}
          >
            {drawnLineIndexes.map((lineIndex) => renderLineRow(lineIndex, wrapLines ? undefined : EDITOR_PADDING_TOP_PX + lineIndex * lineHeightPx))}
          </div>
        )}
        {effectiveWrapColumn > 0 && !isPlainEditor && <div id="wrap-guide" aria-hidden="true" style={{ left: `calc(var(--gutter) + ${textPaddingStartPx + effectiveWrapColumn * characterWidthPx}px)` }} />}
        <textarea
          id="text-editor"
          ref={textareaRef}
          dir="ltr"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap={wrapLines ? 'soft' : 'off'}
          aria-label={t('text.editorLabel', { name: isolateText(fileName) })}
          value={draftText}
          onChange={(event) => changeDraft(event.target.value)}
          onBlur={(event) => {
            if (event.currentTarget.value !== lastCommittedTextRef.current) commitDraft(event.currentTarget.value)
          }}
          onSelect={readTextareaSelection}
          onClick={readTextareaSelection}
          onScroll={syncMirrorWithTextarea}
          onKeyDown={(event) => {
            // Tab types a tab; after Escape it moves the focus on, so the keyboard is never trapped here.
            if (event.key === 'Escape') tabMovesFocusRef.current = true
            else if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !tabMovesFocusRef.current) {
              event.preventDefault()
              document.execCommand('insertText', false, '\t')
            } else if (event.key !== 'Tab') tabMovesFocusRef.current = false
          }}
        />
      </div>
    )
  }

  function renderStatsPanel() {
    if (!stats) return null
    const kpi = (labelKey: MessageKey, value: string) => (
      <div className="kpi">
        <div className="k">{t(labelKey)}</div>
        <div className="v">{value}</div>
      </div>
    )
    const barRows = (entries: [string, number][]) =>
      entries.length === 0 ? (
        <p className="muted">{t('text.stats.nothing')}</p>
      ) : (
        entries.map(([word, count]) => (
          <div key={word} className="bar-row">
            <span className="w">
              <bdi>{word}</bdi>
            </span>
            <span className="bar">
              <i style={{ width: `${(count / entries[0][1]) * 100}%` }} />
            </span>
            <span className="n">{count.toLocaleString('en-US')}</span>
          </div>
        ))
      )
    const topLetters = stats.letterFrequency.slice(0, 16)
    const number = (value: number) => value.toLocaleString('en-US')
    return (
      <section className="panel-view" id="view-stats" aria-label={t('text.stats.title')}>
        <div className="view-head">
          <h2>{t('text.stats.title')}</h2>
          <span className="sub">{t('text.stats.subtitle', { name: isolateText(fileName) })}</span>
          <label className="mini-check" htmlFor="stats-stopwords-input">
            <input type="checkbox" id="stats-stopwords-input" checked={skipCommonWords} onChange={(event) => setSkipCommonWords(event.target.checked)} />
            {t('text.stats.skipCommon')}
          </label>
          <span className="head-end">
            <button type="button" className="ib" id="stats-close-button" aria-label={t('text.stats.close')} data-hint={t('text.stats.close')} data-keys="Esc" onClick={() => setPanelView('text')}>
              <Icon name="close" />
            </button>
          </span>
        </div>
        <div className="kpis">
          {kpi('text.stats.words', number(stats.wordCount))}
          {kpi('text.stats.characters', number(stats.characterCount))}
          {kpi('text.stats.withoutSpaces', number(stats.characterCountWithoutSpaces))}
          {kpi('text.stats.lines', number(stats.lineCount))}
          {kpi('text.stats.sentences', number(stats.sentenceCount))}
          {kpi('text.stats.paragraphs', number(stats.paragraphCount))}
          {kpi('text.stats.uniqueWords', number(stats.uniqueWordCount))}
          {kpi('text.stats.readingTime', formatDuration(stats.readingSeconds, t))}
          {kpi('text.stats.speakingTime', formatDuration(stats.speakingSeconds, t))}
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <h3>
              <Icon name="count" />
              {t('text.stats.topWords')}
            </h3>
            {barRows(stats.topWords)}
          </div>
          <div className="stat-card">
            <h3>
              <Icon name="join" />
              {t('text.stats.topPhrases')}
            </h3>
            {barRows(stats.topPhrases)}
          </div>
          <div className="stat-card">
            <h3>
              <Icon name="font" />
              {t('text.stats.letters')}
            </h3>
            <div className="chars">
              {topLetters.map(([letter, count]) => (
                <div key={letter} aria-label={`${letter}: ${count}`}>
                  <i style={{ height: `${(count / topLetters[0][1]) * 90}%` }} />
                  <span>{letter}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stat-card wide">
            <h3>
              <Icon name="sort-len" />
              {t('text.stats.longestLines')}
            </h3>
            {stats.longestLines.map(({ line, length }) => (
              <div key={line} className="long-row">
                <span className="n">{t('text.stats.line', { line: line + 1 })}</span>
                <span className="snip">
                  <bdi>{lines[line]?.trim() || t('text.stats.blank')}</bdi>
                </span>
                <span className="n">{tp('text.count.characters', length)}</span>
                <button type="button" className="ib" id={`longest-go-to-${line + 1}`} aria-label={t('text.goTo.line', { line: line + 1 })} data-hint={t('text.goTo.line', { line: line + 1 })} onClick={() => goToLine(line)}>
                  <Icon name="goto" />
                </button>
              </div>
            ))}
          </div>
          <div className="stat-card" id="selection-card">
            <h3>
              <Icon name="sel-stats" />
              {t('text.stats.selection')}
            </h3>
            {selectionCounts ? (
              <div className="sel-stats">
                <span>
                  {t('text.stats.words')} <b>{number(selectionCounts.wordCount)}</b>
                </span>
                <span>
                  {t('text.stats.characters')} <b>{number(selectionCounts.characterCount)}</b>
                </span>
                <span>
                  {t('text.stats.lines')} <b>{number(selectionCounts.lineCount)}</b>
                </span>
                <span>
                  {t('text.stats.withoutSpaces')} <b>{number(selectionCounts.characterCountWithoutSpaces)}</b>
                </span>
                <span>
                  {t('text.stats.sentences')} <b>{number(selectionCounts.sentenceCount)}</b>
                </span>
              </div>
            ) : (
              <p className="muted">{t('text.stats.selectionEmpty')}</p>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderComparePanel() {
    if (!diff) return null
    const { hunks, originalLines, currentLines } = diff
    const focusIndex = Math.min(compare.index, Math.max(0, hunks.length - 1))
    const intraline = (lineText: string, range: { start: number; end: number } | null) =>
      range ? (
        <>
          {lineText.slice(0, range.start)}
          <span className="dx">{lineText.slice(range.start, range.end)}</span>
          {lineText.slice(range.end)}
        </>
      ) : (
        lineText
      )
    const inlineRows: ReactNode[] = []
    const leftRows: ReactNode[] = []
    const rightRows: ReactNode[] = []
    let hiddenRowCount = 0
    const isFull = () => inlineRows.length + leftRows.length >= MAX_DIFF_ROWS
    const pushSkip = (count: number, key: string) => {
      if (count <= 0) return
      inlineRows.push(<div key={key} className="drow skip">{tp('text.compare.unchanged', count)}</div>)
      leftRows.push(<div key={key} className="drow skip">…</div>)
      rightRows.push(<div key={key} className="drow skip">…</div>)
    }
    const pushEqual = (originalLine: number, currentLine: number) => {
      const key = `e${currentLine}`
      inlineRows.push(
        <div key={key} className="drow">
          <span className="dn">{originalLine + 1}</span>
          <span className="dn">{currentLine + 1}</span>
          <span className="ds" />
          <span className="dt" dir="auto">{currentLines[currentLine]}</span>
        </div>,
      )
      leftRows.push(
        <div key={key} className="drow">
          <span className="dn">{originalLine + 1}</span>
          <span className="ds" />
          <span className="dt" dir="auto">{originalLines[originalLine]}</span>
        </div>,
      )
      rightRows.push(
        <div key={key} className="drow">
          <span className="dn">{currentLine + 1}</span>
          <span className="ds" />
          <span className="dt" dir="auto">{currentLines[currentLine]}</span>
        </div>,
      )
    }
    let shownUntil = 0
    hunks.forEach((hunk, hunkIndex) => {
      if (isFull()) {
        hiddenRowCount += hunk.rows.length
        return
      }
      const offsetBefore = hunk.currentStart - hunk.originalStart
      const contextStart = Math.max(shownUntil, hunk.currentStart - CONTEXT_LINE_COUNT)
      pushSkip(contextStart - shownUntil, `s${hunkIndex}`)
      for (let line = contextStart; line < hunk.currentStart; line++) pushEqual(line - offsetBefore, line)
      const focus = hunkIndex === focusIndex ? ' focus' : ''
      const removedRows = hunk.rows.filter((row): row is Exclude<TextDiffRow, { kind: 'added' }> => row.kind !== 'added')
      const addedRows = hunk.rows.filter((row): row is Exclude<TextDiffRow, { kind: 'removed' }> => row.kind !== 'removed')
      removedRows.forEach((row, position) => {
        const range = row.kind === 'changed' ? row.originalRange : null
        inlineRows.push(
          <div key={`d${row.originalLine}`} className={`drow del${focus}`} data-hunk={position === 0 ? hunkIndex : undefined}>
            <span className="dn">{row.originalLine + 1}</span>
            <span className="dn" />
            <span className="ds">−</span>
            <span className="dt" dir="auto">{intraline(originalLines[row.originalLine], range)}</span>
          </div>,
        )
      })
      addedRows.forEach((row) => {
        const range = row.kind === 'changed' ? row.currentRange : null
        inlineRows.push(
          <div key={`a${row.currentLine}`} className={`drow add${focus}`} data-hunk={removedRows.length === 0 && row === addedRows[0] ? hunkIndex : undefined}>
            <span className="dn" />
            <span className="dn">{row.currentLine + 1}</span>
            <span className="ds">+</span>
            <span className="dt" dir="auto">{intraline(currentLines[row.currentLine], range)}</span>
          </div>,
        )
      })
      for (let position = 0; position < Math.max(removedRows.length, addedRows.length); position++) {
        const removed = removedRows[position]
        const added = addedRows[position]
        leftRows.push(
          removed ? (
            <div key={`l${hunkIndex}-${position}`} className={`drow del${focus}`}>
              <span className="dn">{removed.originalLine + 1}</span>
              <span className="ds">−</span>
              <span className="dt" dir="auto">{intraline(originalLines[removed.originalLine], removed.kind === 'changed' ? removed.originalRange : null)}</span>
            </div>
          ) : (
            <div key={`l${hunkIndex}-${position}`} className="drow empty">
              <span className="dn" />
              <span className="ds" />
              <span className="dt"> </span>
            </div>
          ),
        )
        rightRows.push(
          added ? (
            <div key={`r${hunkIndex}-${position}`} className={`drow add${focus}`}>
              <span className="dn">{added.currentLine + 1}</span>
              <span className="ds">+</span>
              <span className="dt" dir="auto">{intraline(currentLines[added.currentLine], added.kind === 'changed' ? added.currentRange : null)}</span>
            </div>
          ) : (
            <div key={`r${hunkIndex}-${position}`} className="drow empty">
              <span className="dn" />
              <span className="ds" />
              <span className="dt"> </span>
            </div>
          ),
        )
      }
      const offsetAfter = hunk.currentEnd - hunk.originalEnd
      const contextEnd = Math.min(currentLines.length, hunk.currentEnd + CONTEXT_LINE_COUNT, hunks[hunkIndex + 1]?.currentStart ?? Infinity)
      for (let line = hunk.currentEnd; line < contextEnd; line++) pushEqual(line - offsetAfter, line)
      shownUntil = Math.max(shownUntil, contextEnd)
    })
    if (hiddenRowCount > 0) inlineRows.push(<div key="more" className="drow skip">{tp('text.compare.notShown', hiddenRowCount)}</div>)
    else pushSkip(currentLines.length - shownUntil, 'tail')
    const iconButton = (id: string, labelKey: MessageKey, icon: string, onClick: () => void, isDisabled = false, keys?: string) => (
      <button type="button" className="ib" id={id} aria-label={t(labelKey)} data-hint={t(labelKey)} data-keys={keys} disabled={isDisabled} onClick={onClick}>
        <Icon name={icon} />
      </button>
    )
    return (
      <section className="panel-view" id="view-compare" aria-label={t('text.compare.title')}>
        <div className="view-head">
          <h2>{t('text.compare.title')}</h2>
          <div className="seg" role="group" aria-label={t('text.compare.layout')}>
            <button type="button" className="ib" id="compare-inline-button" aria-pressed={compare.mode === 'inline'} aria-label={t('text.tool.diffInline')} data-hint={t('text.tool.diffInline')} onClick={() => setCompare((current) => ({ ...current, mode: 'inline' }))}>
              <Icon name="inline" />
            </button>
            <button type="button" className="ib" id="compare-side-button" aria-pressed={compare.mode === 'side'} aria-label={t('text.tool.diffSideBySide')} data-hint={t('text.tool.diffSideBySide')} onClick={() => setCompare((current) => ({ ...current, mode: 'side' }))}>
              <Icon name="side" />
            </button>
          </div>
          <label className="chk" htmlFor="compare-ignore-whitespace-input">
            <input type="checkbox" id="compare-ignore-whitespace-input" checked={compare.ignoreWhitespace} onChange={(event) => setCompare((current) => ({ ...current, ignoreWhitespace: event.target.checked }))} />
            {t('text.compare.ignoreWhitespace')}
          </label>
          <label className="chk" htmlFor="compare-ignore-case-input">
            <input type="checkbox" id="compare-ignore-case-input" checked={compare.ignoreCase} onChange={(event) => setCompare((current) => ({ ...current, ignoreCase: event.target.checked }))} />
            {t('text.compare.ignoreCase')}
          </label>
          <span className="change-count" id="change-count">
            {tp('text.compare.changes', hunks.length)}
          </span>
          <span className="sub">{t('text.compare.summary', { removed: diff.removedLineCount, added: diff.addedLineCount })}</span>
          {diff.tooManyChanges && <span className="sub">{t('text.compare.tooMany')}</span>}
          <span className="head-end">
            {iconButton('compare-prev-button', 'text.tool.changePrevious', 'up', () => stepChange(-1), hunks.length === 0)}
            {iconButton('compare-next-button', 'text.tool.changeNext', 'chev', () => stepChange(1), hunks.length === 0)}
            {iconButton('compare-revert-button', 'text.tool.revertAll', 'revert', revertAll, hunks.length === 0)}
            <span className="bar-sep" aria-hidden="true" />
            {iconButton('compare-close-button', 'text.compare.close', 'close', () => setPanelView('text'), false, 'Esc')}
          </span>
        </div>
        <div className="compare-body">
          <ul id="changes-list" aria-label={t('text.compare.changedLines')}>
            {hunks.length === 0 && <li className="muted">{t('text.compare.noChanges')}</li>}
            {hunks.slice(0, MAX_LISTED_CHANGES).map((hunk, hunkIndex) => {
              const kind = hunk.currentEnd === hunk.currentStart ? 'del' : hunk.originalEnd === hunk.originalStart ? 'add' : 'mod'
              const line = Math.min(hunk.currentStart, Math.max(0, currentLines.length - 1))
              const lineText = kind === 'del' ? originalLines[hunk.originalStart] : currentLines[hunk.currentStart]
              const extraLines = Math.max(hunk.originalEnd - hunk.originalStart, hunk.currentEnd - hunk.currentStart) - 1
              return (
                <li key={hunkIndex} className={hunkIndex === focusIndex ? 'active' : undefined}>
                  <span className={`kind ${kind}`}>{t(kind === 'del' ? 'text.compare.removed' : kind === 'add' ? 'text.compare.added' : 'text.compare.changed')}</span>
                  <span className="what">
                    {t('text.stats.line', { line: line + 1 })}
                    {extraLines > 0 ? ` (+${extraLines})` : ''}
                    <span dir="auto">{lineText?.trim() || t('text.stats.blank')}</span>
                  </span>
                  <button
                    type="button"
                    className="ib"
                    id={`change-go-to-${hunkIndex + 1}`}
                    aria-label={t('text.goTo.line', { line: line + 1 })}
                    data-hint={t('text.goTo.line', { line: line + 1 })}
                    onClick={() => {
                      setCompare((current) => ({ ...current, index: hunkIndex }))
                      goToLine(line)
                    }}
                  >
                    <Icon name="goto" />
                  </button>
                </li>
              )
            })}
            {hunks.length > MAX_LISTED_CHANGES && <li className="muted">{tp('text.compare.moreChanges', hunks.length - MAX_LISTED_CHANGES)}</li>}
          </ul>
          <div id="diff-output" dir="ltr">
            {compare.mode === 'inline' ? (
              inlineRows
            ) : (
              <div className="side">
                <div className="col">{leftRows}</div>
                <div className="col">{rightRows}</div>
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderGoToDialog() {
    function goNow() {
      const found = goToText.trim().match(/^(\d+)(?:\s*[:,]\s*(\d+))?$/)
      if (!found) {
        setGoToHint(t('text.goTo.invalid'))
        return
      }
      setOpenDialog(null)
      // After the dialog is gone, so the text box can take the focus.
      requestAnimationFrame(() => goToLine(Number(found[1]) - 1, found[2] ? Number(found[2]) - 1 : 0))
    }
    return (
      <form
        method="dialog"
        id="goto-form"
        onSubmit={(event) => {
          event.preventDefault()
          goNow()
        }}
      >
        <div className="dlg-head">
          <Icon name="goto" />
          <h2 id="goto-title">{t('text.tool.goToLine')}</h2>
        </div>
        <div className="dlg-body">
          <div className="form-row">
            <label htmlFor="goto-input">{t('text.goTo.label')}</label>
            <input className="inp" id="goto-input" autoComplete="off" dir="ltr" inputMode="numeric" placeholder={t('text.goTo.placeholder')} autoFocus value={goToText} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setGoToText(event.target.value)} />
            <span className="form-hint" id="goto-hint">
              {goToHint}
            </span>
          </div>
        </div>
        <div className="dlg-foot">
          <span className="note">
            <kbd>{shortcutLabel('G')}</kbd>
          </span>
          <button type="button" className="sbtn" id="goto-cancel-button" onClick={() => setOpenDialog(null)}>
            {t('text.dialog.cancel')}
          </button>
          <button type="submit" className="btn primary" id="goto-confirm-button">
            {t('text.goTo.go')}
          </button>
        </div>
      </form>
    )
  }

  function renderOptionsDialog() {
    const fields = TOOL_OPTION_FIELDS[optionsTool] ?? []
    const text = liveText()
    const region = findSelectedLineRegion(text, selection.start, selection.end)
    const regionLines = text.slice(region.start, region.end).split('\n')
    const changedLines = transformLines(regionLines, optionsTool, optionsDraft)
    const changedCount = changedLines.length === regionLines.length ? changedLines.filter((line, position) => line !== regionLines[position]).length : 0
    const previewLines = (shownLines: string[], otherLines: string[], className: string) =>
      shownLines.slice(0, PREVIEW_LINE_COUNT).map((line, position) => (
        <span key={position} className={line !== otherLines[position] ? className : undefined}>
          {(line.replace(/\t/g, '→   ') || ' ') + '\n'}
        </span>
      ))
    const firstLine = countLineBreaksBefore(text, region.start) + 1
    const scope = hasSelection ? t('text.options.scopeSelection', { first: firstLine, last: firstLine + regionLines.length - 1 }) : tp('text.options.scopeAll', regionLines.length)
    const change = changedLines.length !== regionLines.length ? t('text.options.lineCountChange', { before: regionLines.length, after: changedLines.length }) : tp('text.options.linesChange', changedCount, { total: regionLines.length })
    const setOption = (key: keyof TextToolOptions, value: string | number | boolean) => setOptionsDraft((current) => ({ ...current, [key]: value }))
    return (
      <form
        method="dialog"
        id="options-form"
        onSubmit={(event) => {
          event.preventDefault()
          setOpenDialog(null)
          runTransform(optionsTool, optionsDraft)
        }}
      >
        <div className="dlg-head">
          <Icon name={TOOL_ICONS[optionsTool]} />
          <h2 id="options-title">{t(`text.tool.${optionsTool}` as MessageKey)}</h2>
          <button type="button" className="mini" id="options-close-button" aria-label={t('text.dialog.close')} onClick={() => setOpenDialog(null)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dlg-body">
          <div className="opt-layout">
            <div id="options-fields">
              {fields.map((field) => {
                const inputId = `option-${toKebabCase(field.key)}-input`
                const value = optionsDraft[field.key]
                if (field.type === 'checkbox')
                  return (
                    <label key={field.key} className="chk" htmlFor={inputId}>
                      <input type="checkbox" id={inputId} checked={Boolean(value)} onChange={(event) => setOption(field.key, event.target.checked)} />
                      {t(field.labelKey)}
                    </label>
                  )
                return (
                  <div key={field.key} className="form-row">
                    <label htmlFor={inputId}>{t(field.labelKey)}</label>
                    {field.type === 'select' ? (
                      <select className="inp" id={inputId} dir="ltr" value={String(value)} onChange={(event) => setOption(field.key, event.target.value)}>
                        {field.choices!.map(([choice, choiceLabel]) => (
                          <option key={choice} value={choice}>
                            {choiceLabel}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="inp"
                        id={inputId}
                        type={field.type}
                        dir="ltr"
                        min={field.min}
                        max={field.max}
                        autoComplete="off"
                        spellCheck={false}
                        value={String(value ?? '')}
                        onChange={(event) => setOption(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)}
                      />
                    )}
                    {field.hintKey && <span className="form-hint">{t(field.hintKey)}</span>}
                  </div>
                )
              })}
            </div>
            <div>
              <div className="preview" dir="ltr">
                <div>
                  <h3>{t('text.options.before')}</h3>
                  <pre id="options-before">{previewLines(regionLines, changedLines, 'old')}</pre>
                </div>
                <div>
                  <h3>{t('text.options.after')}</h3>
                  <pre id="options-after">{previewLines(changedLines, regionLines, 'chg')}</pre>
                </div>
              </div>
              <div className="preview-foot" id="options-scope">
                {`${scope} ${change} ${t('text.options.oneStep')}`}
              </div>
            </div>
          </div>
        </div>
        <div className="dlg-foot">
          <button
            type="button"
            className="sbtn"
            id="options-chain-button"
            onClick={() => {
              setChainSteps((current) => [...current, { toolId: optionsTool, options: optionsDraft, enabled: true }])
              setOpenDialog(null)
              showToast(tp('text.toast.addedToChain', chainSteps.length + 1, { tool: `“${t(`text.tool.${optionsTool}` as MessageKey)}”` }))
            }}
          >
            <Icon name="chain" />
            {t('text.options.addToChain')}
          </button>
          <span className="note" />
          <button type="button" className="sbtn" id="options-cancel-button" onClick={() => setOpenDialog(null)}>
            {t('text.dialog.cancel')}
          </button>
          <button type="submit" className="btn primary" id="options-apply-button">
            {t('text.options.apply')}
          </button>
        </div>
      </form>
    )
  }

  function renderDownloadDialog() {
    if (!exportSource) return null
    const editsWithDraft = { ...session.edits, text: liveText() === originalText ? null : liveText() }
    const { bytes, unencodableCount } = buildTextDownload(editsWithDraft, exportSource, { encoding: downloadSettings.encoding, lineEnding: downloadSettings.lineEnding })
    const encodingNames: Record<TextDownloadEncoding, [string, MessageKey]> = {
      'utf-8': ['UTF-8', 'text.download.utf8Note'],
      'utf-8-bom': ['UTF-8 BOM', 'text.download.utf8BomNote'],
      'utf-16le': ['UTF-16 LE', 'text.download.utf16Note'],
      'windows-1256': ['Windows-1256', 'text.download.windows1256Note'],
    }
    const lineEndingNotes: [TextLineEnding, MessageKey][] = [
      ['\n', 'text.download.lfNote'],
      ['\r\n', 'text.download.crlfNote'],
      ['\r', 'text.download.crNote'],
    ]
    function saveFile() {
      commitPendingTyping()
      const name = /\.txt$/i.test(downloadSettings.fileName.trim()) ? downloadSettings.fileName.trim() : `${downloadSettings.fileName.trim().replace(/\.[^.]*$/, '') || 'text'}.txt`
      downloadTextFile(name, bytes, 'text/plain')
      setOpenDialog(null)
      showToast(t('text.toast.saved', { name: isolateText(name) }))
    }
    return (
      <form
        method="dialog"
        id="download-form"
        onSubmit={(event) => {
          event.preventDefault()
          saveFile()
        }}
      >
        <div className="dlg-head">
          <Icon name="download" />
          <h2 id="download-title">{t('text.download.title')}</h2>
          <button type="button" className="mini" id="download-close-button" aria-label={t('text.dialog.close')} onClick={() => setOpenDialog(null)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dlg-body">
          <div className="form-row">
            <label htmlFor="download-name-input">{t('text.download.fileName')}</label>
            <input className="inp" id="download-name-input" dir="auto" autoComplete="off" value={downloadSettings.fileName} onChange={(event) => setDownloadSettings((current) => ({ ...current, fileName: event.target.value }))} />
          </div>
          <fieldset id="download-encoding-group">
            <legend className="legend">{t('text.download.encoding')}</legend>
            <div className="radio-grid">
              {DOWNLOAD_ENCODINGS.map((encoding) => (
                <label key={encoding} className="radio" htmlFor={`download-encoding-${encoding}`}>
                  <input type="radio" name="download-encoding" id={`download-encoding-${encoding}`} checked={downloadSettings.encoding === encoding} onChange={() => setDownloadSettings((current) => ({ ...current, encoding }))} />
                  <span>
                    <bdi dir="ltr">{encodingNames[encoding][0]}</bdi>
                    <small>{t(encodingNames[encoding][1])}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset id="download-endings-group">
            <legend className="legend">{t('text.download.lineEndings')}</legend>
            <div className="radio-grid three">
              {lineEndingNotes.map(([lineEnding, noteKey]) => (
                <label key={LINE_ENDING_NAMES[lineEnding]} className="radio" htmlFor={`download-endings-${LINE_ENDING_NAMES[lineEnding].toLowerCase()}`}>
                  <input
                    type="radio"
                    name="download-endings"
                    id={`download-endings-${LINE_ENDING_NAMES[lineEnding].toLowerCase()}`}
                    checked={downloadSettings.lineEnding === lineEnding}
                    onChange={() => setDownloadSettings((current) => ({ ...current, lineEnding }))}
                  />
                  <span>
                    {LINE_ENDING_NAMES[lineEnding]}
                    <small>{t(noteKey)}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="summary" id="download-summary">
            <span>{tp('text.count.lines', lines.length)}</span>
            <span>
              <b>
                <bdi dir="ltr">{formatFileSize(bytes.length)}</bdi>
              </b>
            </span>
            <span>{encodingNames[downloadSettings.encoding][0]}</span>
            <span>{LINE_ENDING_NAMES[downloadSettings.lineEnding]}</span>
            {isEdited && <span>{t('text.download.includesEdits')}</span>}
          </div>
          {unencodableCount > 0 && (
            <div className="warn" id="download-warning">
              {tp('text.download.unencodable', unencodableCount)}
            </div>
          )}
        </div>
        <div className="dlg-foot">
          <span className="note">{t('text.download.privacy')}</span>
          <button type="button" className="sbtn" id="download-cancel-button" onClick={() => setOpenDialog(null)}>
            {t('text.dialog.cancel')}
          </button>
          <button type="submit" className="btn primary" id="download-confirm-button">
            <Icon name="download" />
            {t('text.download.button')}
          </button>
        </div>
      </form>
    )
  }

  function renderStatusBar() {
    const counts = [tp('text.count.lines', lines.length), statusWordCount === null ? '' : tp('text.count.words', statusWordCount), tp('text.count.characters', deferredDraftText.length)].filter(Boolean).join(' · ')
    const selectionLineCount = selectionCounts?.lineCount ?? 0
    return (
      <footer id="status-bar">
        <span className="st" id="status-position">
          {t('text.status.position', { line: cursor.line + 1, column: cursor.column + 1 })}
        </span>
        {selectionCounts && (
          <span className="st" id="status-selection">
            {t('text.status.selection', {
              details: [selectionLineCount > 1 ? tp('text.count.lines', selectionLineCount) : '', tp('text.count.words', selectionCounts.wordCount), tp('text.count.characters', selectionCounts.characterCount)].filter(Boolean).join(' · '),
            })}
          </span>
        )}
        <span className="st" id="status-counts">
          {counts}
        </span>
        <span className="st" id="status-bookmarks">
          {bookmarks.size === 0 ? t('text.status.noBookmarks') : tp('text.status.bookmarks', bookmarks.size)}
        </span>
        {showHidden && hiddenCharacters && (
          <span className="st" id="status-hidden">
            {tp('text.status.hiddenCharacters', hiddenCharacters.characterCount)}
          </span>
        )}
        <div className="st-right">
          <span className="st" id="status-legal-links">
            <a id="status-link-privacy" href={localizePath(locale, '/privacy')} target="_blank" rel="noopener">
              {t('legal.privacyShort')}
            </a>
            ·
            <a id="status-link-terms" href={localizePath(locale, '/terms')} target="_blank" rel="noopener">
              {t('legal.termsShort')}
            </a>
          </span>
          <span className="st" id="status-privacy">
            <Icon name="lock" />
            <span>{t('text.privacy')}</span>
          </span>
          <span className="st" id="status-encoding">
            {readableText.status === 'ok' ? readableText.encodingLabel : ''}
          </span>
          <span className="st" id="status-endings">
            {lineEndingLabel}
          </span>
          <span className="st" id="status-type">
            {t('text.status.type')}
          </span>
          <span className="st zoom" data-hint={t('text.field.size')}>
            <label htmlFor="zoom-range">
              <Icon name="font" />
              <span className="vh">{t('text.field.size')}</span>
            </label>
            <input id="zoom-range" type="range" min={10} max={28} step={1} value={textSizePx} onChange={(event) => setTextSizePx(Number(event.target.value))} />
            <span id="zoom-value">{t('text.field.sizePx', { size: textSizePx })}</span>
          </span>
        </div>
      </footer>
    )
  }

  const undoLabel = t(session.canUndo || hasUncommittedTyping ? 'toolbar.undo' : 'text.history.nothingToUndo')
  const redoLabel = t(session.canRedo ? 'toolbar.redo' : 'text.history.nothingToRedo')
  const canUndo = session.canUndo || hasUncommittedTyping

  return (
    <div
      id="txt-workbench"
      onPointerOver={(event) => {
        if (event.pointerType !== 'touch') scheduleTooltip((event.target as HTMLElement).closest<HTMLElement>('[data-hint]'))
      }}
      onPointerDownCapture={(event) => {
        hideTooltip()
        if (isRibbonPeekOpen && !(event.target as HTMLElement).closest('#ribbon, [popover], dialog')) setIsRibbonPeekOpen(false)
      }}
      onFocus={(event) => {
        const element = event.target.closest<HTMLElement>('[data-hint]')
        if (element === event.target && element.matches(':focus-visible')) scheduleTooltip(element)
      }}
      onBlur={(event) => {
        if (event.target === tooltipTargetRef.current) hideTooltip()
      }}
      onScrollCapture={hideTooltip}
    >
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />

      <header id="top-bar">
        <div className="brand">
          <button type="button" id="home-button" aria-label={t('text.home')} data-hint={t('text.home')} onClick={onClose}>
            <MiniFormatIcon format="txt" size={28} className="logo" />
          </button>
          <div className="title-stack">
            <div className="product">
              <Wordmark className="brand-name" />
              <span aria-hidden="true">·</span>
              <h1 id="page-title">{t('text.pageTitle')}</h1>
            </div>
            <div className="file-line">
              <span id="file-name" dir="auto">
                {fileName}
              </span>
              {isEdited && <span id="edited-dot" className="edited-dot" role="img" aria-label={t('text.edited')} />}
            </div>
          </div>
          <button type="button" className="ib" id="open-file-button" aria-label={t('text.tool.openFile')} data-hint={t('text.tip.openFile')} onClick={onOpenAnotherFile}>
            <Icon name="open" />
          </button>
        </div>
        <div className="top-end">
          <button type="button" className="ib" id="privacy-button" aria-label={t('text.privacy')} data-hint={t('text.privacy')} onClick={() => showToast(t('text.privacy'))}>
            <Icon name="lock" />
          </button>
          <span className="bar-sep" aria-hidden="true" />
          <div id="history-buttons">
            <button type="button" className="ib" id="undo-button" disabled={!canUndo} aria-label={undoLabel} data-hint={undoLabel} data-keys={shortcutLabel('Z')} onClick={undo}>
              <Icon name="undo" />
            </button>
            <button type="button" className="ib" id="redo-button" disabled={!session.canRedo} aria-label={redoLabel} data-hint={redoLabel} data-keys={shortcutLabel('Y')} onClick={redo}>
              <Icon name="redo" />
            </button>
          </div>
          <LanguageSwitcher className="" />
          <button type="button" className="ib primary" id="download-button" disabled={!exportSource} aria-label={t('text.tool.downloadOptions')} data-hint={t('text.tool.downloadOptions')} onClick={openDownloadDialog}>
            <Icon name="download" />
          </button>
          <button type="button" className="ib" id="theme-toggle" aria-label={isDark ? t('theme.toLight') : t('theme.toDark')} data-hint={isDark ? t('theme.toLight') : t('theme.toDark')} onClick={toggleTheme}>
            <svg className="ic i-sun" aria-hidden="true">
              <use href="#i-sun" />
            </svg>
            <svg className="ic i-moon" aria-hidden="true">
              <use href="#i-moon" />
            </svg>
          </button>
        </div>
      </header>

      <MenuBar menus={buildMenus()} isCompact={isPhone} label={t('menu.bar')} />

      {renderRibbon()}

      <main id="workspace">
        {readableText.status === 'error' ? (
          <div className="fatal">
            <FatalFileError title={t('text.error.title')} reason={t(readableText.messageKey)} hint={t('text.error.hint')} onOpenAnotherFile={onOpenAnotherFile} />
          </div>
        ) : (
          <>
            {showReadView && (
              <div className="note-strip" id="large-file-note" role="status">
                <Icon name="info" />
                <span>{t('text.large.readView', { size: isolateLeftToRight(formatFileSize(openedFile.file.size)) })}</span>
                <button type="button" className="sbtn" id="edit-anyway-button" onClick={() => setIsEditingLargeFile(true)}>
                  {t('text.large.editAnyway')}
                </button>
              </div>
            )}
            {!showReadView && isPlainEditor && (
              <div className="note-strip" id="plain-editor-note" role="status">
                <Icon name="info" />
                <span>{t(draftText.length > LARGE_EDIT_CHARACTER_COUNT ? 'text.large.plainEditor' : 'text.large.wrapTooLong', { lines: WRAPPED_MIRROR_LINE_LIMIT })}</span>
                {draftText.length <= LARGE_EDIT_CHARACTER_COUNT && (
                  <button type="button" className="sbtn" id="turn-wrap-off-button" onClick={() => setWrapLines(false)}>
                    {t('text.large.turnWrapOff')}
                  </button>
                )}
              </div>
            )}
            {largeFileWarning && !showReadView && !isPlainEditor && (
              <div className="note-strip" id="large-file-warning" role="status">
                <Icon name="info" />
                <span>{largeFileWarning}</span>
              </div>
            )}
            {isFindOpen && panelView === 'text' && renderFindStrip()}
            <section id="view-text" aria-label={t('text.textLabel')}>
              {renderEditor()}
              {showMinimap && !isPhone && (
                <div id="minimap" aria-hidden="true" onClick={scrollFromMinimap}>
                  <canvas ref={minimapCanvasRef} />
                  <div id="minimap-viewport" ref={minimapViewportRef} />
                </div>
              )}
            </section>
            {panelView === 'stats' && renderStatsPanel()}
            {panelView === 'compare' && renderComparePanel()}
          </>
        )}
      </main>

      {renderStatusBar()}

      <nav id="bottom-bar" aria-label={t('text.bottomBar')}>
        <button type="button" id="bottom-undo-button" disabled={!canUndo} aria-label={undoLabel} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" id="bottom-redo-button" disabled={!session.canRedo} aria-label={redoLabel} onClick={redo}>
          <Icon name="redo" />
        </button>
        <button type="button" id="bottom-find-button" aria-pressed={isFindOpen && panelView === 'text'} aria-label={t('text.tool.findReplace')} onClick={() => (isFindOpen && panelView === 'text' ? closeFind() : openFind(true))}>
          <Icon name="find" />
        </button>
        <button type="button" id="bottom-tools-button" aria-label={t('text.sheet.allTools')} onClick={() => setIsToolsSheetOpen(true)}>
          <Icon name="tools" />
        </button>
        <button type="button" id="bottom-stats-button" aria-pressed={panelView === 'stats'} aria-label={t('text.tool.stats')} onClick={() => togglePanel('stats')}>
          <Icon name="stats" />
        </button>
      </nav>

      {renderSortMenu()}
      {renderChainPopover()}
      <div id="tooltip" role="tooltip" popover="manual" ref={tooltipRef} />
      {renderToolsSheet()}
      <WorkbenchDialog id="goto-dialog" titleId="goto-title" isOpen={openDialog === 'goTo'} onClose={() => setOpenDialog(null)}>
        {renderGoToDialog()}
      </WorkbenchDialog>
      <WorkbenchDialog id="options-dialog" titleId="options-title" isOpen={openDialog === 'options'} onClose={() => setOpenDialog(null)}>
        {openDialog === 'options' && renderOptionsDialog()}
      </WorkbenchDialog>
      <WorkbenchDialog id="download-dialog" titleId="download-title" isOpen={openDialog === 'download'} onClose={() => setOpenDialog(null)}>
        {openDialog === 'download' && renderDownloadDialog()}
      </WorkbenchDialog>

      <div id="txt-toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.canUndo && (
              <button
                type="button"
                className="ib"
                id="toast-undo-button"
                aria-label={t('toolbar.undo')}
                data-hint={t('toolbar.undo')}
                data-keys={shortcutLabel('Z')}
                onClick={() => {
                  undo()
                  setToast(null)
                }}
              >
                <Icon name="undo" />
              </button>
            )}
          </div>
        )}
      </div>
      <div id="drop-overlay" aria-hidden="true">
        {t('text.dropOverlay')}
      </div>
      {isPrinting && <pre id="print-text">{liveText()}</pre>}
    </div>
  )
}
