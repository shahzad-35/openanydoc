import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { MiniFormatIcon, Wordmark, uiIconShapes } from '../../components/KitIcon'
import type { UiIconName } from '../../components/KitIcon'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { isolateLeftToRight, localizePath, translatePlural, translateWithNodes, useT } from '../../i18n'
import type { Locale, MessageKey } from '../../i18n'
import { formatFileSize, getLargeFileWarning } from '../../useFileIntake'
import { buildDownloadName, downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import JsonCodeEditor from './JsonCodeEditor'
import JsonTable from './JsonTable'
import JsonTree from './JsonTree'
import type { TreeRowAction } from './JsonTree'
import {
  LINE_MAP_MAX_CHARACTERS,
  SAMPLE_JSON_TEXT,
  buildLineMap,
  computeJsonStats,
  countRepairFixes,
  findPathKeyAt,
  formatValueText,
  getTypeName,
  getValueClassName,
  isBigNumber,
  parseValueExactly,
  repairJson,
  runPathQuery,
} from './jsonTools'
import type { RepairFixes } from './jsonTools'
import {
  buildJsonDownload,
  expandNodesUpToLimit,
  findMatchingPaths,
  formatPathText,
  getNodeAt,
  getPathKey,
  isArrayOfObjects,
  isContainer,
  parseJsonText,
  sortKeys,
  withAddedChild,
  withDuplicatedNode,
  withIndent,
  withMovedNode,
  withNewRoot,
  withoutNodeAt,
  withRenamedKey,
  withValueAt,
} from './jsonModel'
import type { JsonEdits, JsonIndent, JsonParseResult, JsonPath, JsonValue, TreeRow } from './jsonModel'
import './jsonWorkbench.css'

const COMMIT_DELAY_MS = 600
const LINE_HEIGHT_PX = 20
const MAX_TREE_MATCHES = 500
const MAX_QUERY_RESULTS = 200
const TOAST_MS = 1600
// The table looks this far into the document for the first list of objects.
const TABLE_SEARCH_NODE_LIMIT = 5000
// A file this long opens with its text closed: the browser's own text box costs about half a second per keystroke at 6.5 MB,
// and the tree stays fast without it.
const TEXT_PANE_AUTO_HIDE_CHARACTERS = 5_000_000
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const modifierKeyLabel = isMac ? '⌘' : 'Ctrl+'

const INDENT_CHOICES: { labelKey: MessageKey; indent: Exclude<JsonIndent, 0> }[] = [
  { labelKey: 'json.toolbar.indent1', indent: 1 },
  { labelKey: 'json.toolbar.indent2', indent: 2 },
  { labelKey: 'json.toolbar.indent3', indent: 3 },
  { labelKey: 'json.toolbar.indent4', indent: 4 },
  { labelKey: 'json.toolbar.indent8', indent: 8 },
  { labelKey: 'json.toolbar.indentTab', indent: '\t' },
]

type JsonParseError = Extract<JsonParseResult, { status: 'error' }>
type MobileTab = 'text' | 'tree' | 'inspector'
// What the message above the text says after an action (the parse error, when there is one, takes its place).
type WorkbenchNotice =
  | { kind: 'opened' }
  | { kind: 'formatterHint' }
  | { kind: 'largeFile'; message: string }
  | { kind: 'valid' }
  | { kind: 'repaired'; fixes: string }
  | { kind: 'nothingToRepair' }
  | { kind: 'formatted'; indentLabel: string }
  | { kind: 'minified'; bytesBefore: number }
  | { kind: 'sorted' }
  | null

// "removed 2 trailing commas, quoted 1 key and removed 1 comment", from what Repair changed.
function describeRepairFixes(fixes: RepairFixes, locale: Locale) {
  const parts = (Object.keys(fixes) as (keyof RepairFixes)[]).filter((kind) => fixes[kind] > 0).map((kind) => translatePlural(locale, `json.repair.${kind}`, fixes[kind]))
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts)
}

// Line and column (from 1) of a position in the text.
function findLineAndColumn(text: string, position: number) {
  const before = text.slice(0, position)
  const lineStart = before.lastIndexOf('\n') + 1
  return { line: before.split('\n').length, column: position - lineStart + 1 }
}

// Opens the containers above a node, so the node is on screen in the tree.
function withAncestorsExpanded(currentKeys: ReadonlySet<string>, path: JsonPath): ReadonlySet<string> {
  const newKeys = new Set(currentKeys)
  for (let depth = 0; depth < path.length; depth++) newKeys.add(getPathKey(path.slice(0, depth)))
  return newKeys.size === currentKeys.size ? currentKeys : newKeys
}

// The first list of objects in the document, looked for level by level (the root itself first).
function findTablePath(root: JsonValue): JsonPath | null {
  const queue: { path: JsonPath; value: JsonValue }[] = [{ path: [], value: root }]
  for (let position = 0; position < queue.length && position < TABLE_SEARCH_NODE_LIMIT; position++) {
    const { path, value } = queue[position]
    if (isArrayOfObjects(value)) return path
    if (isContainer(value) && !Array.isArray(value)) for (const [key, child] of Object.entries(value)) queue.push({ path: [...path, key], value: child })
  }
  return null
}

// The number inside a translated text, in bold ("<b>33</b> keys").
function withBoldNumber(text: string, count: number) {
  const numberText = String(count)
  const numberStart = text.indexOf(numberText)
  if (numberStart === -1) return text
  return (
    <>
      {text.slice(0, numberStart)}
      <b>{numberText}</b>
      {text.slice(numberStart + numberText.length)}
    </>
  )
}

function SpriteIcon({ name, isSmall = false, className = '' }: { name: string; isSmall?: boolean; className?: string }) {
  return (
    <svg className={`ico${isSmall ? ' sm' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  )
}

// The icons, drawn once and used by name (as in the design file).
const iconPaths: Record<string, ReactNode> = {
  braces: <path d="M8 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </>
  ),
  tick: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  wrench: <path d="M14.5 4.2a5 5 0 0 0-5.8 6.6L3.8 15.7a2 2 0 0 0 2.8 2.8l4.9-4.9a5 5 0 0 0 6.6-5.8l-2.9 2.9-2.4-.6-.6-2.4z" />,
  indent: <path d="M4 6h16M10 10h10M10 14h10M4 18h16M4 9.5l3 2.5-3 2.5" />,
  minify: <path d="M4 12h16M8 8l4 4 4-4M8 16l4-4 4 4" transform="rotate(90 12 12)" />,
  sort: <path d="M7 4v16M4 17l3 3 3-3M14 5h6l-6 6h6M14 14h6M14 18h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  'chev-down': <path d="m7 10 5 5 5-5" />,
  'chev-right': <path d="m10 7 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  dup: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M14 11v6M11 14h6M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  replace: (
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="m14 14 2.5 2.5M17 9h3M18.5 7.5v3M15 20h6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />,
  unfold: <path d="M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3M4 12h16" transform="rotate(180 12 12)" />,
  fold: <path d="M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3M4 12h16" />,
  tree: <path d="M5 4v14a2 2 0 0 0 2 2h3M5 9h5M14 7h6M14 13h6M14 19h6" />,
  panel: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 14h17" />
    </>
  ),
}

// The JSON file page (design option 1, "Studio split"): its own command bar, the text on one side and the tree or table with an
// inspector on the other, linked both ways, and a status bar with the document's stats and a path query. It fills the whole
// screen (the format is marked `ownsWholePage`). The file is parsed in a Web Worker; edits are kept as the parsed document
// (changing a node copies only the path to it), so undo stays small.
export default function JsonViewer({ openedFile, session: untypedSession, onOpenAnotherFile, onClose, onOpenConvertedFile }: FormatViewerProps) {
  const { locale, t, tp } = useT()
  const session = untypedSession as EditSession<JsonEdits>
  const edits = session.edits
  const originalText = useMemo(() => new TextDecoder().decode(openedFile.contents), [openedFile])
  const fileName = openedFile.file.name

  const [parseResult, setParseResult] = useState<JsonParseResult | null>(null)
  const [structureView, setStructureView] = useState<'tree' | 'table'>('tree')
  const [mobileTab, setMobileTab] = useState<MobileTab>('tree')
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  const [expandLevel, setExpandLevel] = useState<number | null>(null)
  const [showTypes, setShowTypes] = useState(true)
  const [showIndexes, setShowIndexes] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [textPanePercent, setTextPanePercent] = useState(46)
  const [isSplitDragging, setIsSplitDragging] = useState(false)
  const [isLargeTextShown, setIsLargeTextShown] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [currentMatchPosition, setCurrentMatchPosition] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedPath, setSelectedPath] = useState<JsonPath | null>(null)
  const [revealPathKey, setRevealPathKey] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ line: number; column: number } | null>(null)
  const [notice, setNotice] = useState<WorkbenchNotice>(() => {
    const largeFileWarning = getLargeFileWarning(openedFile.file, locale)
    if (largeFileWarning) return { kind: 'largeFile', message: largeFileWarning }
    return openedFile.openedFrom === '/json-formatter' ? { kind: 'formatterHint' } : { kind: 'opened' }
  })
  // Opened from the validator page: validate once as soon as the file is read, so the result is the first thing shown.
  const hasValidatedOnOpenRef = useRef(false)
  const [validityPulseCount, setValidityPulseCount] = useState(0)
  const [pathQuery, setPathQuery] = useState('')
  const [isQueryOpen, setIsQueryOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [openMenu, setOpenMenu] = useState<'indent' | 'copy' | 'more' | 'convert' | null>(null)
  const [chosenIndent, setChosenIndent] = useState<Exclude<JsonIndent, 0>>(2)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [toast, setToast] = useState({ message: '', isShown: false })
  const [inspectorError, setInspectorError] = useState('')
  const [isGoToErrorRequested, setIsGoToErrorRequested] = useState(false)
  const deferredSearchText = useDeferredValue(searchText.trim().toLowerCase())
  const deferredPathQuery = useDeferredValue(pathQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const workbenchRef = useRef<HTMLElement>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  // Whether the last selection came from the text (then the text is not scrolled) or from the tree, a search or a query.
  const selectionFromTextRef = useRef(false)

  const originalRoot = parseResult?.status === 'ok' ? parseResult.value : null
  const root = edits.root ?? originalRoot
  const originalParseError = edits.root === null && parseResult?.status === 'error' ? parseResult : null
  const isTextHiddenForSize = originalText.length > TEXT_PANE_AUTO_HIDE_CHARACTERS && !isLargeTextShown
  const showText = !isTextHiddenForSize

  // The text: the original as written while untouched (a one-line file is spread out so it can be read), otherwise the edited
  // document with the chosen indentation. Built only while the text is shown: writing out a 50 MB document after every tree edit
  // would freeze the page.
  const codeText = useMemo(() => {
    if (!showText) return ''
    if (edits.root !== null) return JSON.stringify(edits.root, null, edits.indent)
    if (originalRoot !== null && !originalText.includes('\n')) return JSON.stringify(originalRoot, null, 2)
    return originalText
  }, [showText, edits.root, edits.indent, originalRoot, originalText])

  const [draftText, setDraftText] = useState(codeText)
  const [syncedText, setSyncedText] = useState(codeText)
  const [draftError, setDraftError] = useState<JsonParseError | null>(null)
  const lastCommittedTextRef = useRef(codeText)
  const latestDraftRef = useRef(codeText)
  const commitTimerRef = useRef<number | undefined>(undefined)
  const inFlightCommitRef = useRef<{ text: string; promise: Promise<JsonParseError | null> } | null>(null)

  // The text changed from outside the text box (undo, redo, a tree edit, Repair, the file finished loading): show it. Our own
  // commits are skipped, so the formatting being typed is never replaced under the cursor.
  if (codeText !== syncedText) {
    setSyncedText(codeText)
    if (codeText !== lastCommittedTextRef.current) {
      lastCommittedTextRef.current = codeText
      latestDraftRef.current = codeText
      setDraftText(codeText)
      setDraftError(null)
    }
  }

  const validationError = draftError ?? originalParseError
  const isDraftEmpty = !/\S/.test(draftText)
  const canChangeDocument = root !== null && validationError === null

  const pageTitle = t('file.title', { name: fileName })
  useEffect(() => {
    const previousTitle = document.title
    document.title = pageTitle
    return () => {
      document.title = previousTitle
    }
  }, [pageTitle])

  useEffect(() => {
    setParseResult(null)
    setExpandedKeys(new Set())
    let isStale = false
    parseJsonText(originalText, locale).then((result) => {
      if (isStale) return
      setParseResult(result)
      if (result.status === 'ok') setExpandedKeys(expandNodesUpToLimit(result.value, 2).expandedKeys)
      else setMobileTab('text')
    })
    return () => {
      isStale = true
    }
  // The language only words a start-up failure message; changing it must not read the file again.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [originalText])

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), [])

  // A file that could not be read at first gets its tree opened once it becomes valid (by typing or Repair).
  const hasDocument = root !== null
  useEffect(() => {
    const currentRoot = session.edits.root ?? originalRoot
    if (currentRoot !== null) setExpandedKeys((currentKeys) => (currentKeys.size > 0 ? currentKeys : expandNodesUpToLimit(currentRoot, 2).expandedKeys))
    // Only when a document appears or goes away.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDocument])

  useEffect(() => {
    const showFullscreenState = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', showFullscreenState)
    return () => document.removeEventListener('fullscreenchange', showFullscreenState)
  }, [])

  // A click outside a menu or the query closes it.
  useEffect(() => {
    function closeMenusOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.split-btn')) setOpenMenu(null)
      if (!target.closest('#path-query')) setIsQueryOpen(false)
    }
    document.addEventListener('click', closeMenusOnOutsideClick)
    return () => document.removeEventListener('click', closeMenusOnOutsideClick)
  }, [])

  // Where every node starts in the text, so the text and the tree can follow each other. Skipped for very long text.
  const deferredDraftText = useDeferredValue(draftText)
  const lineMap = useMemo(() => (showText && deferredDraftText.length <= LINE_MAP_MAX_CHARACTERS ? buildLineMap(deferredDraftText) : null), [showText, deferredDraftText])
  const draftLineCount = useMemo(() => deferredDraftText.split('\n').length, [deferredDraftText])
  const selectedPathKey = selectedPath === null ? null : getPathKey(selectedPath)
  const selectedStart = selectedPathKey === null || validationError ? null : (lineMap?.startByPathKey.get(selectedPathKey) ?? null)

  const treeMatches = useMemo(
    () => (deferredSearchText !== '' && root !== null ? findMatchingPaths(root, deferredSearchText, MAX_TREE_MATCHES) : null),
    [root, deferredSearchText],
  )
  const matchPathKeys = useMemo(() => new Set(treeMatches?.paths.map(getPathKey) ?? []), [treeMatches])
  const matchCount = treeMatches?.paths.length ?? 0

  // Selects a node and shows it in both panes. `fromText` keeps the text where it is (the cursor is already there).
  function selectNode(path: JsonPath, fromText: boolean) {
    selectionFromTextRef.current = fromText
    setSelectedPath(path)
    setRevealPathKey(getPathKey(path))
    setExpandedKeys((currentKeys) => withAncestorsExpanded(currentKeys, path))
    setInspectorError('')
  }

  // A match inside a collapsed node opens the nodes above it.
  useEffect(() => {
    if (!treeMatches || treeMatches.paths.length === 0) return
    setExpandedKeys((currentKeys) => treeMatches.paths.reduce(withAncestorsExpanded, currentKeys))
  }, [treeMatches])

  // The node picked in the tree (or found by a search or a query) is scrolled into view in the text.
  const selectedLine = selectedStart?.line ?? null
  useEffect(() => {
    const textBox = textareaRef.current
    if (selectedLine === null || selectionFromTextRef.current || !textBox) return
    textBox.scrollTop = Math.max(0, (selectedLine - 1) * LINE_HEIGHT_PX - textBox.clientHeight / 3)
    // Only when the selection moves; scrolling must not follow every keystroke.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPathKey, selectedLine])

  function goToMatch(newMatchPosition: number) {
    if (!treeMatches || matchCount === 0) return
    const wrappedPosition = (newMatchPosition + matchCount) % matchCount
    setCurrentMatchPosition(wrappedPosition)
    selectNode(treeMatches.paths[wrappedPosition], false)
  }

  function showToast(message: string) {
    window.clearTimeout(toastTimerRef.current)
    setToast({ message, isShown: true })
    toastTimerRef.current = window.setTimeout(() => setToast((current) => ({ ...current, isShown: false })), TOAST_MS)
  }

  // The same text is read once even when the box losing focus and an action both ask for it, so it is one undo step. Resolves
  // with the parse error, or null when the text is valid (or empty, or already read).
  function commitDraft(text: string) {
    if (inFlightCommitRef.current?.text === text) return inFlightCommitRef.current.promise
    const promise = commitDraftNow(text).finally(() => {
      if (inFlightCommitRef.current?.promise === promise) inFlightCommitRef.current = null
    })
    inFlightCommitRef.current = { text, promise }
    return promise
  }

  async function commitDraftNow(text: string): Promise<JsonParseError | null> {
    window.clearTimeout(commitTimerRef.current)
    // An empty box (after Clear) waits for new text: nothing is wrong yet, and the last document stays.
    if (text === lastCommittedTextRef.current || !/\S/.test(text)) {
      setDraftError(null)
      return null
    }
    const result = await parseJsonText(text, locale)
    if (text !== latestDraftRef.current) return null
    if (result.status === 'error') {
      setDraftError(result)
      return result
    }
    setDraftError(null)
    lastCommittedTextRef.current = JSON.stringify(result.value, null, session.edits.indent)
    session.update((currentEdits) => withNewRoot(currentEdits, originalRoot, result.value))
    return null
  }

  function changeDraft(text: string) {
    setDraftText(text)
    latestDraftRef.current = text
    setNotice(null)
    window.clearTimeout(commitTimerRef.current)
    commitTimerRef.current = window.setTimeout(() => commitDraft(text), COMMIT_DELAY_MS)
  }

  // Replaces the whole text at once (Sample, Clear, Repair, Replace) and reads it straight away.
  function replaceDraft(text: string) {
    changeDraft(text)
    void commitDraft(text)
  }

  // Reads what is typed before an action on the document. Resolves false when the text is not valid JSON.
  async function commitTypingFirst() {
    return (showText ? await commitDraft(latestDraftRef.current) : null) === null
  }

  function selectErrorInTextBox() {
    const textBox = textareaRef.current
    if (!textBox || !validationError || validationError.line === null) return
    setMobileTab('text')
    const lineLengths = draftText.split('\n').slice(0, validationError.line - 1).map((lineText) => lineText.length + 1)
    const errorOffset = lineLengths.reduce((total, length) => total + length, 0) + (validationError.column ?? 1) - 1
    textBox.focus()
    textBox.setSelectionRange(errorOffset, errorOffset + 1)
    textBox.scrollTop = Math.max(0, (validationError.line - 1) * LINE_HEIGHT_PX - textBox.clientHeight / 3)
  }

  // The cursor moved in the text box: show where it is, and select the node under it in the tree.
  function followTextCursor() {
    const textBox = textareaRef.current
    // Above the linking limit the position is not worked out on every cursor move (it reads the text up to the cursor).
    if (!textBox || lineMap === null) return
    const position = findLineAndColumn(textBox.value, textBox.selectionStart)
    setCursor(position)
    if (validationError) return
    const pathKey = findPathKeyAt(lineMap, position.line, position.column)
    if (pathKey !== null && pathKey !== selectedPathKey) selectNode(JSON.parse(pathKey) as JsonPath, true)
  }

  function changeDocument(change: (currentRoot: JsonValue) => JsonValue) {
    session.update((currentEdits) => {
      const currentRoot = currentEdits.root ?? originalRoot
      return currentRoot === null ? currentEdits : withNewRoot(currentEdits, originalRoot, change(currentRoot))
    })
  }

  // The error is selected in the text once it is on screen (the parse result arrives after this click).
  useEffect(() => {
    if (!isGoToErrorRequested || !validationError) return
    setIsGoToErrorRequested(false)
    selectErrorInTextBox()
    // selectErrorInTextBox reads the current text and error; only the request and the error decide when it runs.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isGoToErrorRequested, validationError])

  async function validateNow() {
    const typingError = showText ? await commitDraft(latestDraftRef.current) : null
    const isOriginalStillInvalid = originalParseError !== null && (!showText || latestDraftRef.current === originalText)
    setValidityPulseCount((count) => count + 1)
    if (typingError !== null || isOriginalStillInvalid) {
      setNotice(null)
      setIsGoToErrorRequested(true)
      return
    }
    setNotice({ kind: 'valid' })
  }

  useEffect(() => {
    if (openedFile.openedFrom !== '/json-validator' || parseResult === null || hasValidatedOnOpenRef.current) return
    hasValidatedOnOpenRef.current = true
    void validateNow()
    // validateNow reads the latest draft through refs; it is not a dependency.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFile.openedFrom, parseResult])

  // Repair: fix the usual hand-written mistakes, then read the result. The text box then shows the repaired document.
  async function repairText() {
    const sourceText = showText ? latestDraftRef.current : originalText
    const { text: repairedText, fixes } = repairJson(sourceText)
    if (countRepairFixes(fixes) === 0) {
      setNotice({ kind: 'nothingToRepair' })
      return
    }
    const result = await parseJsonText(repairedText, locale)
    if (result.status === 'error') {
      replaceDraft(repairedText)
      return
    }
    window.clearTimeout(commitTimerRef.current)
    setDraftError(null)
    session.update((currentEdits) => withNewRoot(currentEdits, originalRoot, result.value))
    setNotice({ kind: 'repaired', fixes: describeRepairFixes(fixes, locale) })
  }

  // Resolves false when the text could not be read, so nothing was changed.
  async function formatWithIndent(indent: JsonIndent) {
    if (!(await commitTypingFirst())) return false
    session.update((currentEdits) => {
      const currentRoot = currentEdits.root ?? originalRoot
      return currentRoot === null ? currentEdits : withIndent(currentEdits, originalText, currentRoot, indent)
    })
    return true
  }

  async function formatDocument(indent: Exclude<JsonIndent, 0>) {
    setChosenIndent(indent)
    setOpenMenu(null)
    const choice = INDENT_CHOICES.find((candidate) => candidate.indent === indent)
    if ((await formatWithIndent(indent)) && choice) setNotice({ kind: 'formatted', indentLabel: t(choice.labelKey) })
  }

  async function minifyDocument() {
    const bytesBefore = sizeInBytes
    if (await formatWithIndent(0)) setNotice({ kind: 'minified', bytesBefore })
  }

  async function sortDocumentKeys() {
    if (!(await commitTypingFirst())) return
    changeDocument((currentRoot) => sortKeys(currentRoot, 'asc', true))
    setNotice({ kind: 'sorted' })
  }

  async function undoLastChange() {
    if (showText) await commitDraft(latestDraftRef.current)
    session.undo()
  }

  async function redoLastChange() {
    if (showText) await commitDraft(latestDraftRef.current)
    session.redo()
  }

  function runRowAction(action: TreeRowAction, row: TreeRow) {
    const parentPath = row.path.slice(0, -1)
    const step = row.path[row.path.length - 1]
    if (action === 'add') {
      if (isContainer(row.value)) {
        changeDocument((currentRoot) => withAddedChild(currentRoot, row.path))
        setExpandedKeys((currentKeys) => new Set(currentKeys).add(row.pathKey))
      } else {
        changeDocument((currentRoot) => withAddedChild(currentRoot, parentPath, step))
      }
      showToast(t('json.wb.added'))
    } else if (action === 'duplicate') {
      changeDocument((currentRoot) => withDuplicatedNode(currentRoot, row.path))
      if (typeof step === 'number') setSelectedPath([...parentPath, step + 1])
      showToast(t('json.wb.duplicated'))
    } else if (action === 'up' || action === 'down') {
      const direction = action === 'up' ? -1 : 1
      changeDocument((currentRoot) => withMovedNode(currentRoot, row.path, direction))
      // An item in a list changes position, so its path follows it; a key keeps its name.
      if (typeof step === 'number') setSelectedPath([...parentPath, step + direction])
      showToast(t(action === 'up' ? 'json.wb.movedUp' : 'json.wb.movedDown'))
    } else {
      changeDocument((currentRoot) => withoutNodeAt(currentRoot, row.path))
      setSelectedPath(parentPath)
      showToast(t('json.wb.deleted'))
    }
  }

  function findRowForPath(path: JsonPath): TreeRow | null {
    if (root === null) return null
    const parent = path.length === 0 ? null : getNodeAt(root, path.slice(0, -1))
    const siblingLabels = parent !== null && isContainer(parent) ? (Array.isArray(parent) ? parent.map((_, position) => position) : Object.keys(parent)) : [null]
    const step = path.length === 0 ? null : path[path.length - 1]
    return { path, pathKey: getPathKey(path), label: step, value: getNodeAt(root, path), depth: path.length, position: siblingLabels.indexOf(step as never), siblingCount: siblingLabels.length }
  }

  // The inspector's value box: valid JSON is read as JSON (5, true, null, "text"); anything else is kept as text.
  function commitInspectorValue(path: JsonPath, currentValue: JsonValue, typedText: string) {
    let newValue: JsonValue
    try {
      newValue = parseValueExactly(typedText.trim())
      if (isContainer(newValue)) newValue = typedText
    } catch {
      newValue = typedText
    }
    if (formatValueText(newValue) === formatValueText(currentValue)) return
    changeDocument((currentRoot) => withValueAt(currentRoot, path, newValue))
    showToast(t('json.wb.valueUpdated'))
  }

  function commitInspectorKey(path: JsonPath, typedKey: string) {
    const oldKey = path[path.length - 1]
    if (root === null || typedKey === oldKey) return
    const parent = getNodeAt(root, path.slice(0, -1))
    if (isContainer(parent) && !Array.isArray(parent) && Object.hasOwn(parent, typedKey)) {
      setInspectorError(t('json.viewer.keyExists'))
      return
    }
    changeDocument((currentRoot) => withRenamedKey(currentRoot, path, typedKey))
    setSelectedPath([...path.slice(0, -1), typedKey])
    showToast(t('json.wb.keyRenamed'))
  }

  async function copyText(text: string, doneMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(doneMessage)
    } catch {
      showToast(t('json.status.copyNotAllowed'))
    }
  }

  // The JSON as Download saves it, with typing in the text pane committed first; null when that typing is not valid JSON.
  async function buildDocumentText() {
    const hasUncommittedTyping = showText && latestDraftRef.current !== codeText
    if (hasUncommittedTyping) {
      const typingError = await commitDraft(latestDraftRef.current)
      if (typingError) {
        setIsGoToErrorRequested(true)
        return null
      }
    }
    return { fileText: hasUncommittedTyping ? latestDraftRef.current : buildJsonDownload(edits, { originalText }), hasUncommittedTyping }
  }

  async function downloadDocument() {
    const documentText = await buildDocumentText()
    if (!documentText) return
    downloadTextFile(buildDownloadName(fileName, documentText.hasUncommittedTyping || session.changeCount > 0, null), documentText.fileText, 'application/json;charset=utf-8')
  }

  // The JSON as Download would save it, converted to CSV and opened in the CSV viewer.
  async function convertToCsv() {
    const documentText = await buildDocumentText()
    if (!documentText) return
    const { convertForViewer } = await import('../conversion')
    const result = await convertForViewer(new File([documentText.fileText], fileName, { type: 'application/json' }), 'json', 'csv', locale)
    if ('error' in result) showToast(result.error)
    else onOpenConvertedFile(result.file)
  }

  function replaceNextInText() {
    const textBox = textareaRef.current
    if (findText === '' || !textBox) return
    const text = latestDraftRef.current
    const nextPosition = text.indexOf(findText, textBox.selectionEnd)
    const position = nextPosition !== -1 ? nextPosition : text.indexOf(findText)
    if (position !== -1) replaceDraft(text.slice(0, position) + replaceText + text.slice(position + findText.length))
  }

  function replaceAllInText() {
    if (findText === '') return
    const text = latestDraftRef.current
    const count = text.split(findText).length - 1
    if (count === 0) return
    replaceDraft(text.split(findText).join(replaceText))
    showToast(tp('json.wb.replaced', count))
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

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // Some browsers and app views do not allow full screen; the page simply stays as it is.
    }
  }

  function focusSearch() {
    setIsSearchOpen(true)
    setMobileTab('tree')
    window.setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }

  // Page shortcuts: "/" and Ctrl/Cmd+K search, Ctrl/Cmd+Enter validates, Escape closes menus. They read the latest functions.
  const latestShortcutActionsRef = useRef({ validate: validateNow, focusSearch })
  useEffect(() => {
    latestShortcutActionsRef.current = { validate: validateNow, focusSearch }
  })
  useEffect(() => {
    function runShortcut(event: KeyboardEvent) {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
      const hasModifier = event.metaKey || event.ctrlKey
      if (event.key === 'Escape') {
        setOpenMenu(null)
        setIsQueryOpen(false)
        setIsSearchOpen(false)
        return
      }
      if ((hasModifier && event.key.toLowerCase() === 'k') || (event.key === '/' && !isTyping)) {
        event.preventDefault()
        latestShortcutActionsRef.current.focusSearch()
      } else if (hasModifier && event.key === 'Enter') {
        event.preventDefault()
        void latestShortcutActionsRef.current.validate()
      }
    }
    window.addEventListener('keydown', runShortcut)
    return () => window.removeEventListener('keydown', runShortcut)
  }, [])

  // Stats for the status bar and the "valid" message, worked out after typing settles.
  const deferredRoot = useDeferredValue(root)
  const stats = useMemo(() => (deferredRoot === null ? null : computeJsonStats(deferredRoot)), [deferredRoot])
  const sizeInBytes = useMemo(() => {
    if (edits.root === null) return openedFile.contents.byteLength
    if (deferredRoot === null) return 0
    return new TextEncoder().encode(JSON.stringify(deferredRoot, null, edits.indent)).length
  }, [edits.root, edits.indent, deferredRoot, openedFile])

  const queryPaths = useMemo(
    () => (deferredPathQuery.trim() === '' || deferredRoot === null ? null : runPathQuery(deferredRoot, deferredPathQuery, MAX_QUERY_RESULTS)),
    [deferredPathQuery, deferredRoot],
  )
  const isQueryInvalid = deferredPathQuery.trim() !== '' && deferredRoot !== null && queryPaths === null

  const tablePath = useMemo(() => (root === null ? null : findTablePath(root)), [root])
  const activeView = structureView === 'table' && tablePath !== null ? 'table' : 'tree'

  function toggleExpanded(pathKey: string) {
    setExpandLevel(null)
    setExpandedKeys((currentKeys) => {
      const newKeys = new Set(currentKeys)
      if (!newKeys.delete(pathKey)) newKeys.add(pathKey)
      return newKeys
    })
  }

  function expandToLevel(level: number | null) {
    if (root === null) return
    const { expandedKeys: newKeys, isLimited } = expandNodesUpToLimit(root, level ?? Infinity)
    setExpandedKeys(newKeys)
    setExpandLevel(level ?? Infinity)
    if (isLimited) showToast(t('json.viewer.expandLimited'))
  }

  // A cell committed twice with the same value (Enter, then the box losing focus) must not add a second edit.
  function setTableCell(rowPosition: number, columnName: string, newValue: JsonValue) {
    if (tablePath === null) return
    const cellPath = [...tablePath, rowPosition, columnName]
    session.update((currentEdits) => {
      const currentRoot = currentEdits.root ?? originalRoot
      if (currentRoot === null) return currentEdits
      if (JSON.stringify(getNodeAt(currentRoot, cellPath)) === JSON.stringify(newValue)) return currentEdits
      return withNewRoot(currentEdits, originalRoot, withValueAt(currentRoot, cellPath, newValue))
    })
  }

  // The divider between the panes: drag it, or use the arrow keys when it has focus. In Arabic the text pane is on the right.
  function resizePanes(event: ReactPointerEvent<HTMLDivElement>) {
    const workbench = workbenchRef.current
    if (!workbench || !isSplitDragging) return
    const box = workbench.getBoundingClientRect()
    const isRightToLeft = getComputedStyle(workbench).direction === 'rtl'
    const offset = isRightToLeft ? box.right - event.clientX : event.clientX - box.left
    setTextPanePercent(Math.min(70, Math.max(25, (offset / box.width) * 100)))
  }

  const selectedNode = selectedPath === null || root === null ? undefined : getNodeAt(root, selectedPath)
  const selectedRow = selectedPath === null || selectedNode === undefined ? null : findRowForPath(selectedPath)
  const selectedPathText = selectedPath === null ? '' : formatPathText(selectedPath)
  const indentLabel = edits.indent === 0 ? t('json.status.minified') : edits.indent === '\t' ? t('json.wb.tabs') : t('json.status.spaces', { count: edits.indent })
  const chosenIndentChoice = INDENT_CHOICES.find((choice) => choice.indent === chosenIndent) ?? INDENT_CHOICES[1]
  const isEmpty = isDraftEmpty && (root === null || !showText)
  const validityText = isEmpty
    ? t('json.wb.empty')
    : validationError
      ? validationError.line !== null
        ? t('json.wb.invalidAt', { line: validationError.line, column: validationError.column ?? 1 })
        : t('json.status.invalid')
      : t('json.viewer.valid')
  const errorPosition = validationError?.line != null ? { line: validationError.line, column: validationError.column ?? 1 } : null
  const shortcutLabel = (key: string) => `${modifierKeyLabel}${key}`
  const queryResultCount = queryPaths?.length ?? 0

  function renderNoticeContent(currentNotice: NonNullable<WorkbenchNotice>): { className: string; icon: string; content: ReactNode; canUndo: boolean } {
    switch (currentNotice.kind) {
      case 'opened':
        return { className: 'info', icon: 'sparkle', canUndo: false, content: translateWithNodes(locale, 'json.wb.openedNotice', { name: <strong dir="auto">{fileName}</strong> }) }
      case 'formatterHint':
        return { className: 'info', icon: 'sparkle', canUndo: false, content: t('json.wb.formatterHint') }
      case 'largeFile':
        return { className: 'info', icon: 'sparkle', canUndo: false, content: currentNotice.message }
      case 'valid':
        return {
          className: 'ok',
          icon: 'check',
          canUndo: false,
          content: (
            <>
              <strong>{t('json.wb.validTitle')}</strong>{' '}
              {stats && new Intl.ListFormat(locale, { style: 'long', type: 'unit' }).format([tp('json.stats.keys', stats.keys), tp('json.stats.values', stats.values), t('json.stats.depth', { depth: stats.depth })])}
            </>
          ),
        }
      case 'repaired':
        return {
          className: 'info',
          icon: 'sparkle',
          canUndo: true,
          content: (
            <>
              <strong>{t('json.wb.repairedTitle')}</strong> {currentNotice.fixes}
            </>
          ),
        }
      case 'nothingToRepair':
        return { className: 'info', icon: 'sparkle', canUndo: false, content: t('json.repair.nothing') }
      case 'formatted':
        return {
          className: 'ok',
          icon: 'check',
          canUndo: true,
          content: (
            <>
              <strong>{t('json.wb.formattedTitle')}</strong> {t('json.wb.formattedDetail', { indent: currentNotice.indentLabel })}
            </>
          ),
        }
      case 'minified':
        return {
          className: 'ok',
          icon: 'check',
          canUndo: true,
          content: (
            <>
              <strong>{t('json.wb.minifiedTitle')}</strong> {t('json.wb.minifiedDetail', { before: isolateLeftToRight(formatFileSize(currentNotice.bytesBefore)), after: isolateLeftToRight(formatFileSize(sizeInBytes)) })}
            </>
          ),
        }
      case 'sorted':
        return {
          className: 'ok',
          icon: 'check',
          canUndo: true,
          content: (
            <>
              <strong>{t('json.wb.sortedTitle')}</strong> {t('json.wb.sortedDetail')}
            </>
          ),
        }
    }
  }

  const shownNotice = validationError ? null : notice && renderNoticeContent(notice)

  const textPane = (
    <section className="pane" id="text-pane" aria-label={t('json.wb.textPane')}>
      <div className="pane-head">
        <span className="file-tab" dir="auto">
          <SpriteIcon name="braces" isSmall />
          {fileName}
        </span>
        {showText && <span className="pane-sub lines" id="text-lines-label">{tp('json.pane.lines', draftLineCount)}</span>}
        <div className="spacer" />
        <button className="btn sm" type="button" id="open-file-button" onClick={onOpenAnotherFile}>
          <SpriteIcon name="folder" isSmall />
          {t('json.wb.open')}
        </button>
        <button className="btn sm" type="button" id="sample-button" disabled={!showText} onClick={() => replaceDraft(SAMPLE_JSON_TEXT)}>
          {t('json.pane.sample')}
        </button>
        <button
          className="btn sm"
          type="button"
          id="clear-button"
          disabled={!showText}
          onClick={() => {
            replaceDraft('')
            textareaRef.current?.focus()
          }}
        >
          {t('json.pane.clear')}
        </button>
        <span className="vsep text-extra" />
        <button className="btn sm icon text-extra" type="button" id="undo-button" aria-label={t('toolbar.undo')} title={t('toolbar.undoTip')} disabled={!session.canUndo && draftText === codeText} onClick={() => void undoLastChange()}>
          <SpriteIcon name="undo" isSmall />
        </button>
        <button className="btn sm icon text-extra" type="button" id="redo-button" aria-label={t('toolbar.redo')} title={t('toolbar.redoTip')} disabled={!session.canRedo} onClick={() => void redoLastChange()}>
          <SpriteIcon name="redo" isSmall />
        </button>
        <button
          className="btn sm icon text-extra"
          type="button"
          id="find-replace-button"
          aria-label={t('find.label')}
          aria-expanded={isFindOpen}
          aria-controls="find-replace-bar"
          title={t('find.label')}
          disabled={!showText}
          onClick={() => {
            setIsFindOpen(!isFindOpen)
            if (!isFindOpen) window.setTimeout(() => findInputRef.current?.focus())
          }}
        >
          <SpriteIcon name="replace" isSmall />
        </button>
        <span className="split-btn">
          <button
            className="btn sm icon"
            type="button"
            id="copy-button"
            aria-label={t('json.toolbar.copyMenu')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'copy'}
            aria-controls="copy-button-menu"
            title={t('json.toolbar.copyMenu')}
            disabled={root === null}
            onClick={() => setOpenMenu(openMenu === 'copy' ? null : 'copy')}
          >
            <SpriteIcon name="copy" isSmall />
          </button>
          {openMenu === 'copy' && root !== null && (
            <div className="menu right" id="copy-button-menu" role="menu">
              <button
                role="menuitem"
                type="button"
                id="copy-button-menu-formatted"
                onClick={() => {
                  setOpenMenu(null)
                  void copyText(JSON.stringify(root, null, chosenIndent), t('json.wb.formattedCopied'))
                }}
              >
                <SpriteIcon name="indent" isSmall />
                {t('json.toolbar.copyFormatted')}
                <span className="hint">{chosenIndent === '\t' ? t('json.toolbar.indentTab') : t('json.wb.spacesShort', { count: chosenIndent })}</span>
              </button>
              <button
                role="menuitem"
                type="button"
                id="copy-button-menu-minified"
                onClick={() => {
                  setOpenMenu(null)
                  void copyText(JSON.stringify(root), t('json.wb.minifiedCopied'))
                }}
              >
                <SpriteIcon name="minify" isSmall />
                {t('json.toolbar.copyMinified')}
              </button>
            </div>
          )}
        </span>
      </div>
      {isFindOpen && showText && (
        <div id="find-replace-bar" role="search" aria-label={t('find.label')}>
          <span className="field">
            <SpriteIcon name="search" isSmall />
            <input id="find-input" ref={findInputRef} dir="ltr" placeholder={t('find.find')} aria-label={t('find.find')} value={findText} onChange={(event) => setFindText(event.target.value)} />
            <span className="insp-where" id="find-count">
              {findText === '' ? '' : draftText.split(findText).length - 1}
            </span>
          </span>
          <span className="field">
            <input id="replace-input" dir="ltr" placeholder={t('find.replaceWith')} aria-label={t('find.replaceWith')} value={replaceText} onChange={(event) => setReplaceText(event.target.value)} />
          </span>
          <button className="btn sm outline" type="button" id="replace-button" disabled={findText === ''} onClick={replaceNextInText}>
            {t('find.replace')}
          </button>
          <button className="btn sm outline" type="button" id="replace-all-button" disabled={findText === ''} onClick={replaceAllInText}>
            {t('find.replaceAll')}
          </button>
        </div>
      )}
      {validationError ? (
        <div id="editor-notice" className="notice error" role="alert">
          <SpriteIcon name="alert" isSmall />
          <span className="msg">
            {errorPosition && <strong>{t('json.wb.errorAt', { line: errorPosition.line, column: errorPosition.column })}</strong>}
            {' '}
            <bdi dir="ltr">{validationError.message}</bdi>
          </span>
          {errorPosition && showText && (
            <button className="btn sm outline" type="button" id="go-to-error-button" onClick={selectErrorInTextBox}>
              {t('json.wb.goToError')}
            </button>
          )}
          <button className="btn sm primary" type="button" id="notice-repair-button" onClick={() => void repairText()}>
            <SpriteIcon name="wrench" isSmall />
            {t('json.wb.repair')}
          </button>
        </div>
      ) : (
        shownNotice && (
          <div id="editor-notice" className={`notice ${shownNotice.className}`} role="status">
            <SpriteIcon name={shownNotice.icon} isSmall />
            <span className="msg">{shownNotice.content}</span>
            {shownNotice.canUndo && session.canUndo && (
              <button
                className="btn sm"
                type="button"
                id="notice-undo-button"
                onClick={() => {
                  setNotice(null)
                  session.undo()
                }}
              >
                {t('toolbar.undo')}
              </button>
            )}
            <button className="btn sm icon" type="button" id="notice-close-button" aria-label={t('json.wb.dismiss')} onClick={() => setNotice(null)}>
              <SpriteIcon name="x" isSmall />
            </button>
          </div>
        )
      )}
      {isTextHiddenForSize ? (
        <div className="empty" id="text-hidden-note">
          <p>{t('json.pane.textHidden')}</p>
          <button className="btn sm outline" type="button" id="show-text-button" onClick={() => setIsLargeTextShown(true)}>
            {t('json.pane.showText')}
          </button>
        </div>
      ) : parseResult === null ? (
        <p className="empty" id="text-loading" role="status">
          {t('json.viewer.reading')}
        </p>
      ) : (
        <JsonCodeEditor
          textareaRef={textareaRef}
          value={draftText}
          placeholder={t('json.pane.placeholder')}
          ariaLabel={t('json.wb.textLabel')}
          onChange={changeDraft}
          onBlur={(text) => void commitDraft(text)}
          onCursorMove={followTextCursor}
          error={errorPosition}
          cursorLine={cursor?.line ?? null}
          selectedStart={selectedStart}
        />
      )}
      <div className="drop-hint" id="drop-hint">
        <SpriteIcon name="download" isSmall />
        <span className="drop-text">{t('json.wb.dropHint', { shortcut: shortcutLabel('V') })}</span>
        <span className="privacy-mobile">{t('json.status.private')}</span>
      </div>
    </section>
  )

  const inspectorBody =
    selectedRow === null || selectedPath === null || selectedNode === undefined ? (
      <div className="empty" style={{ padding: 14 }}>
        {t('json.wb.inspectorEmpty')}
      </div>
    ) : (
      <>
        <dl className="insp-grid">
          <dt>{t('json.details.path')}</dt>
          <dd>
            <span className="insp-path" id="inspector-path" dir="ltr" title={selectedPathText}>
              {selectedPathText}
            </span>
            <button className="btn sm icon" type="button" id="inspector-copy-path-icon" aria-label={t('json.details.copyPath')} onClick={() => void copyText(selectedPathText, t('json.details.pathCopied'))}>
              <SpriteIcon name="copy" isSmall />
            </button>
          </dd>
          {typeof selectedRow.label === 'string' && (
            <>
              <dt>{t('json.wb.key')}</dt>
              <dd>
                <label className="insp-value" htmlFor="inspector-key-input">
                  <span className="sr-only">{t('json.wb.editKey')}</span>
                  <input
                    id="inspector-key-input"
                    key={selectedPathKey}
                    dir="auto"
                    className="t-k"
                    defaultValue={selectedRow.label}
                    spellCheck={false}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitInspectorKey(selectedPath, event.currentTarget.value)
                    }}
                    onBlur={(event) => commitInspectorKey(selectedPath, event.currentTarget.value)}
                    onChange={() => setInspectorError('')}
                  />
                </label>
              </dd>
              {inspectorError !== '' && (
                <dd className="insp-note error" id="inspector-key-error" role="alert">
                  {inspectorError}
                </dd>
              )}
            </>
          )}
          <dt>{t('json.details.type')}</dt>
          <dd>
            <span className="type-pill">
              {getTypeName(selectedNode)}
              {isBigNumber(selectedNode) && ` · ${t('json.wb.big')}`}
            </span>
            {selectedStart && <span className="insp-where">{t('json.wb.lineColumn', { line: selectedStart.line, column: selectedStart.column })}</span>}
          </dd>
          <dt>{t('json.details.value')}</dt>
          <dd>
            {isContainer(selectedNode) ? (
              <span className="insp-value" id="inspector-value">
                {Array.isArray(selectedNode) ? tp('json.summary.array', selectedNode.length) : tp('json.summary.object', Object.keys(selectedNode).length)}
              </span>
            ) : (
              <label className="insp-value" htmlFor="inspector-value-input">
                <span className="sr-only">{t('json.wb.editValue')}</span>
                <input
                  id="inspector-value-input"
                  key={`${selectedPathKey}:${formatValueText(selectedNode)}`}
                  dir="ltr"
                  className={`t-${getValueClassName(selectedNode)}`}
                  defaultValue={formatValueText(selectedNode)}
                  spellCheck={false}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitInspectorValue(selectedPath, selectedNode, event.currentTarget.value)
                  }}
                  onBlur={(event) => commitInspectorValue(selectedPath, selectedNode, event.currentTarget.value)}
                />
              </label>
            )}
          </dd>
          {isBigNumber(selectedNode) && <dd className="insp-note">{t('json.wb.bigNote', { rounded: String(Number(selectedNode.rawJSON)) })}</dd>}
        </dl>
        <div className="insp-actions">
          <button className="btn sm outline" type="button" id="copy-path-button" onClick={() => void copyText(selectedPathText, t('json.details.pathCopied'))}>
            <SpriteIcon name="copy" isSmall />
            {t('json.details.copyPath')}
          </button>
          <button
            className="btn sm outline"
            type="button"
            id="copy-value-button"
            onClick={() => void copyText(typeof selectedNode === 'string' ? selectedNode : isContainer(selectedNode) ? JSON.stringify(selectedNode, null, chosenIndent) : formatValueText(selectedNode), t('json.details.valueCopied'))}
          >
            <SpriteIcon name="copy" isSmall />
            {t('json.details.copyValue')}
          </button>
          <span className="spacer" />
          <button className="btn sm" type="button" id="inspector-duplicate-button" disabled={selectedPath.length === 0} onClick={() => runRowAction('duplicate', selectedRow)}>
            <SpriteIcon name="dup" isSmall />
            {t('json.details.duplicate')}
          </button>
          <button className="btn sm danger" type="button" id="inspector-delete-button" disabled={selectedPath.length === 0} onClick={() => runRowAction('delete', selectedRow)}>
            <SpriteIcon name="trash" isSmall />
            {t('json.details.delete')}
          </button>
        </div>
      </>
    )

  const treePane = (
    <section className="pane" id="tree-pane" aria-label={t('json.wb.structurePane')}>
      <div className="pane-head">
        <div className="tabs" role="tablist" aria-label={t('json.structure.view')}>
          <button role="tab" type="button" id="tree-tab" aria-selected={activeView === 'tree'} aria-controls="tree-view" onClick={() => setStructureView('tree')}>
            <SpriteIcon name="tree" isSmall />
            {t('json.structure.tree')}
          </button>
          <button
            role="tab"
            type="button"
            id="table-tab"
            aria-selected={activeView === 'table'}
            aria-controls="table-view"
            disabled={tablePath === null}
            title={tablePath === null ? t('json.wb.noTable') : undefined}
            onClick={() => setStructureView('table')}
          >
            <SpriteIcon name="panel" isSmall />
            {t('json.structure.table')}
          </button>
        </div>
        <span className="pane-sub" id="tree-sync-label">
          <span className={`live-dot${validationError ? ' paused' : ''}`} id="live-dot" />
          <span className="lbl" id="live-text">
            {validationError ? t('json.wb.paused') : t('json.wb.live')}
          </span>
        </span>
        <div className="spacer" />
        {activeView === 'tree' && (
          <>
            <button className="btn sm icon" type="button" id="expand-all-button" aria-label={t('json.wb.expandAll')} title={t('json.wb.expandAll')} disabled={root === null} onClick={() => expandToLevel(null)}>
              <SpriteIcon name="unfold" isSmall />
            </button>
            <button
              className="btn sm icon"
              type="button"
              id="collapse-all-button"
              aria-label={t('json.toolbar.collapseAll')}
              title={t('json.toolbar.collapseAll')}
              disabled={root === null}
              onClick={() => {
                setExpandedKeys(new Set([getPathKey([])]))
                setExpandLevel(1)
              }}
            >
              <SpriteIcon name="fold" isSmall />
            </button>
          </>
        )}
      </div>
      {activeView === 'tree' && (
        <div id="tree-options" role="group" aria-label={t('json.wb.treeOptions')}>
          <button className="chip" type="button" id="show-types-toggle" aria-pressed={showTypes} onClick={() => setShowTypes(!showTypes)}>
            <span className="box" />
            {t('json.structure.types')}
          </button>
          <button className="chip" type="button" id="show-indexes-toggle" aria-pressed={showIndexes} onClick={() => setShowIndexes(!showIndexes)}>
            <span className="box" />
            {t('json.structure.indexes')}
          </button>
          <span className="seg" role="group" aria-label={t('json.structure.expandTo')}>
            <span className="lbl">{t('json.structure.expandTo')}</span>
            {[1, 2, 3].map((level) => (
              <button key={level} type="button" id={`level-${level}-button`} aria-label={t('json.structure.expandToLevel', { level })} aria-pressed={expandLevel === level} disabled={root === null} onClick={() => expandToLevel(level)}>
                {level}
              </button>
            ))}
            <button type="button" id="level-all-button" aria-pressed={expandLevel === Infinity} disabled={root === null} onClick={() => expandToLevel(null)}>
              {t('json.structure.all')}
            </button>
          </span>
        </div>
      )}
      {validationError && root !== null && (
        <div id="stale-banner">
          <SpriteIcon name="alert" isSmall />
          <span>{t('json.wb.stale')}</span>
        </div>
      )}
      {parseResult === null ? (
        <p className="empty" id="tree-loading">
          {t('json.viewer.reading')}
        </p>
      ) : root === null ? (
        <div className="view" id="tree-view">
          <p className="empty">{validationError ? t('json.wb.fixToSeeTree') : t('json.wb.emptyTree')}</p>
        </div>
      ) : activeView === 'table' && tablePath !== null ? (
        <div className="view" id="table-view">
          <JsonTable
            rows={getNodeAt(root, tablePath) as JsonValue[]}
            originalRows={originalRoot === null ? [] : (getNodeAt(originalRoot, tablePath) ?? [])}
            sourcePathText={formatPathText(tablePath)}
            onSetCell={setTableCell}
          />
        </div>
      ) : (
        <JsonTree
          root={root}
          expandedKeys={expandedKeys}
          onToggleExpanded={toggleExpanded}
          searchText={deferredSearchText}
          matchPathKeys={matchPathKeys}
          selectedPathKey={selectedPathKey}
          onSelectPath={(path) => selectNode(path, false)}
          revealPathKey={revealPathKey}
          showTypes={showTypes}
          showIndexes={showIndexes}
          isStale={validationError !== null}
          getLine={(pathKey) => lineMap?.startByPathKey.get(pathKey)?.line ?? null}
          onRowAction={runRowAction}
        />
      )}
      <section id="inspector-drawer" aria-label={t('json.details.title')}>
        <button id="inspector-toggle" type="button" aria-expanded={isInspectorOpen} aria-controls="inspector-body" onClick={() => setIsInspectorOpen(!isInspectorOpen)}>
          <SpriteIcon name="chev-down" isSmall className="chev" />
          <span className="pane-title">{t('json.details.title')}</span>
          <span id="inspector-mini" dir="ltr">
            {selectedPathText}
          </span>
        </button>
        <div id="inspector-body" hidden={!isInspectorOpen}>
          {inspectorBody}
        </div>
      </section>
    </section>
  )

  return (
    <div id="json-workbench" data-mtab={mobileTab} data-opened-from={openedFile.openedFrom?.slice(1)}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        {Object.entries(iconPaths).map(([name, paths]) => (
          <symbol key={name} id={`i-${name}`} viewBox="0 0 24 24">
            {uiIconShapes[name as UiIconName] ?? paths}
          </symbol>
        ))}
      </svg>

      <header id="command-bar" className={isSearchOpen ? 'search-open' : undefined}>
        <button className="brand" type="button" id="home-button" aria-label={t('json.wb.home')} onClick={onClose}>
          <MiniFormatIcon format="json" size={26} className="logo" />
          <span className="brand-text">
            <Wordmark className="brand-name" />
            <h1 className="page-title" id="page-title">
              {t('json.wb.title')}
            </h1>
          </span>
        </button>
        <span className="slash" aria-hidden="true">
          /
        </span>
        <button className="file-chip" id="file-chip-button" type="button" title={t('file.openAnother')} onClick={onOpenAnotherFile}>
          <SpriteIcon name="file" isSmall />
          <span className="fname" dir="auto">
            {fileName}
          </span>
          <span className="fsize" id="file-size-chip" dir="ltr">
            {formatFileSize(sizeInBytes)}
          </span>
          {session.changeCount > 0 && <span className="mod" title={t('json.wb.edited')} />}
        </button>
        <div className="spacer" />
        <div className="cmds" role="toolbar" aria-label={t('json.wb.commands')} id="command-toolbar">
          <button className="btn" type="button" id="validate-button" title={t('json.wb.validateTip', { shortcut: shortcutLabel('Enter') })} disabled={isEmpty} onClick={() => void validateNow()}>
            <SpriteIcon name="check" />
            {t('json.toolbar.validate')}
          </button>
          <button className="btn" type="button" id="repair-button" title={t('json.wb.repairTip')} disabled={isEmpty} onClick={() => void repairText()}>
            <SpriteIcon name="wrench" />
            {t('json.wb.repair')}
          </button>
          <span className="split-btn">
            <button className="btn main" type="button" id="format-button" title={t('json.wb.formatTip')} disabled={!canChangeDocument} onClick={() => void formatDocument(chosenIndent)}>
              <SpriteIcon name="indent" />
              {t('json.toolbar.format')}
            </button>
            <button
              className="btn caret"
              type="button"
              id="indent-button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'indent'}
              aria-controls="indent-button-menu"
              aria-label={t('json.wb.indentation')}
              disabled={!canChangeDocument}
              onClick={() => setOpenMenu(openMenu === 'indent' ? null : 'indent')}
            >
              <span id="indent-label">{t(chosenIndentChoice.labelKey)}</span>
              <SpriteIcon name="chev-down" isSmall />
            </button>
            {openMenu === 'indent' && (
              <div className="menu" id="indent-button-menu" role="menu">
                <div className="menu-label">{t('json.wb.indentation')}</div>
                {INDENT_CHOICES.map((choice) => (
                  <button
                    key={String(choice.indent)}
                    role="menuitemradio"
                    type="button"
                    id={`indent-button-menu-${choice.indent === '\t' ? 'tab' : choice.indent === 1 ? '1-space' : `${choice.indent}-spaces`}`}
                    aria-checked={choice.indent === chosenIndent}
                    onClick={() => void formatDocument(choice.indent)}
                  >
                    <SpriteIcon name="tick" isSmall className="check" />
                    {t(choice.labelKey)}
                    {choice.indent === 2 && <span className="hint">{t('json.wb.default')}</span>}
                  </button>
                ))}
              </div>
            )}
          </span>
          <button className="btn" type="button" id="minify-button" title={t('json.wb.minifyTip')} disabled={!canChangeDocument} onClick={() => void minifyDocument()}>
            <SpriteIcon name="minify" />
            {t('json.toolbar.minifyShort')}
          </button>
          <button className="btn" type="button" id="sort-keys-button" title={t('json.wb.sortTip')} disabled={!canChangeDocument} onClick={() => void sortDocumentKeys()}>
            <SpriteIcon name="sort" />
            <span>
              {t('json.wb.sort')}
              <span className="lbl-opt"> {t('json.wb.keys')}</span>
            </span>
          </button>
        </div>
        <div className="spacer" />
        <label className="search" id="search-box">
          <SpriteIcon name="search" />
          <input
            id="search-input"
            ref={searchInputRef}
            type="search"
            dir="auto"
            placeholder={t('json.viewer.searchKeysAndValues')}
            aria-label={t('json.viewer.searchKeysAndValues')}
            autoComplete="off"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value)
              setCurrentMatchPosition(0)
              setStructureView('tree')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                goToMatch(currentMatchPosition + (event.shiftKey ? -1 : 1))
              }
            }}
          />
          <span id="search-count" aria-live="polite">
            {deferredSearchText === '' ? '' : treeMatches?.isLimited ? t('json.wb.foundMany', { count: MAX_TREE_MATCHES }) : tp('json.wb.found', matchCount)}
          </span>
          <kbd>/</kbd>
        </label>
        <button className="btn icon" type="button" id="mobile-search-button" aria-label={t('json.wb.search')} aria-expanded={isSearchOpen} onClick={() => (isSearchOpen ? setIsSearchOpen(false) : focusSearch())}>
          <SpriteIcon name="search" />
        </button>
        <button className="btn icon" type="button" id="fullscreen-button" aria-label={t(isFullscreen ? 'json.toolbar.exitFullscreen' : 'json.toolbar.fullscreen')} title={t(isFullscreen ? 'json.toolbar.exitFullscreen' : 'json.toolbar.fullscreen')} onClick={() => void toggleFullscreen()}>
          <SpriteIcon name="expand" />
        </button>
        <span className="split-btn">
          <button
            className="btn"
            type="button"
            id="convert-button"
            aria-label={t('convert.menuHeading')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'convert'}
            aria-controls="convert-button-menu"
            onClick={() => setOpenMenu(openMenu === 'convert' ? null : 'convert')}
          >
            <SpriteIcon name="replace" />
            <span className="convert-label">{t('convert.menuHeading')}</span>
            <SpriteIcon name="chev-down" isSmall />
          </button>
          {openMenu === 'convert' && (
            <div className="menu right" id="convert-button-menu" role="menu">
              <button
                role="menuitem"
                type="button"
                id="convert-button-menu-to-csv"
                onClick={() => {
                  setOpenMenu(null)
                  void convertToCsv()
                }}
              >
                <SpriteIcon name="file" isSmall />
                {t('convert.toCsv')}
              </button>
            </div>
          )}
        </span>
        <LanguageSwitcher className="btn" />
        <span className="split-btn">
          <button
            className="btn icon"
            type="button"
            id="more-button"
            aria-label={t('legal.menu')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'more'}
            aria-controls="more-button-menu"
            title={t('legal.menu')}
            onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
          >
            <SpriteIcon name="more" />
          </button>
          {openMenu === 'more' && (
            // The links open in a new tab, so the open file and its edits stay where they are.
            <div className="menu right" id="more-button-menu" role="menu">
              <a role="menuitem" id="menu-link-privacy" href={localizePath(locale, '/privacy')} target="_blank" rel="noopener" onClick={() => setOpenMenu(null)}>
                <SpriteIcon name="lock" isSmall />
                {t('legal.privacy')}
              </a>
              <a role="menuitem" id="menu-link-terms" href={localizePath(locale, '/terms')} target="_blank" rel="noopener" onClick={() => setOpenMenu(null)}>
                <SpriteIcon name="file" isSmall />
                {t('legal.terms')}
              </a>
              <p className="menu-note" id="menu-disclaimer">
                {t('legal.disclaimer')}
              </p>
            </div>
          )}
        </span>
        <button className="btn icon" type="button" id="theme-toggle" aria-label={isDark ? t('theme.toLight') : t('theme.toDark')} title={isDark ? t('theme.toLight') : t('theme.toDark')} onClick={toggleTheme}>
          <SpriteIcon name="sun" className="i-sun" />
          <SpriteIcon name="moon" className="i-moon" />
        </button>
        <button className="btn primary icon" type="button" id="download-button" aria-label={t('json.wb.downloadFile', { name: fileName })} title={t('json.wb.downloadFile', { name: fileName })} onClick={() => void downloadDocument()}>
          <SpriteIcon name="download" />
        </button>
      </header>

      <div id="mobile-pane-tabs" role="tablist" aria-label={t('json.pane.tabs')}>
        {(['text', 'tree', 'inspector'] as const).map((tab) => (
          <button key={tab} role="tab" type="button" id={`mobile-tab-${tab}`} aria-selected={mobileTab === tab} onClick={() => setMobileTab(tab)}>
            {tab === 'text' && <span className={`vdot${validationError ? ' err' : ''}`} id="mobile-validity-dot" />}
            {t(tab === 'text' ? 'json.pane.text' : tab === 'tree' ? 'json.pane.structure' : 'json.pane.details')}
          </button>
        ))}
      </div>

      <main id="workbench" ref={workbenchRef} style={{ '--left': `${textPanePercent}%` } as CSSProperties}>
        {textPane}
        <div
          id="split-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('json.pane.resize')}
          aria-valuemin={25}
          aria-valuemax={70}
          aria-valuenow={Math.round(textPanePercent)}
          tabIndex={0}
          className={isSplitDragging ? 'dragging' : undefined}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            setIsSplitDragging(true)
          }}
          onPointerMove={resizePanes}
          onPointerUp={() => setIsSplitDragging(false)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
            const grows = (event.key === 'ArrowRight') !== isRightToLeft
            setTextPanePercent((percent) => Math.min(70, Math.max(25, percent + (grows ? 2 : -2))))
          }}
        >
          <span className="grip" />
        </div>
        {treePane}
      </main>

      <footer id="status-bar">
        <button
          className={`sb${validationError ? ' invalid' : ''}${isEmpty ? ' empty' : ''}${validityPulseCount > 0 ? ' pulse' : ''}`}
          type="button"
          id="validity-status"
          title={t('json.toolbar.validate')}
          onClick={() => void validateNow()}
        >
          <span key={validityPulseCount} className="vdot" />
          <span id="validity-text">{validityText}</span>
        </button>
        <span className="sb-sep" />
        <span className="sb stat" id="stat-size">
          <b dir="ltr">{formatFileSize(sizeInBytes)}</b>
        </span>
        {stats && (
          <>
            <span className="sb stat" id="stat-keys">
              {withBoldNumber(tp('json.stats.keys', stats.keys), stats.keys)}
            </span>
            <span className="sb stat" id="stat-values">
              {withBoldNumber(tp('json.stats.values', stats.values), stats.values)}
            </span>
            <span className="sb stat" id="stat-depth">
              {withBoldNumber(t('json.stats.depth', { depth: stats.depth }), stats.depth)}
            </span>
          </>
        )}
        <span className="sb-sep" />
        <div id="path-query">
          <label htmlFor="path-query-input">{t('json.query.label')}</label>
          <input
            id="path-query-input"
            dir="ltr"
            value={pathQuery}
            placeholder="$.orders[*].total"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={isQueryInvalid}
            aria-describedby="query-results-button"
            onChange={(event) => {
              setPathQuery(event.target.value)
              setIsQueryOpen(true)
            }}
            onFocus={() => setIsQueryOpen(true)}
          />
          <button
            type="button"
            id="query-results-button"
            className={queryResultCount === 0 ? 'none' : undefined}
            aria-expanded={isQueryOpen}
            aria-controls="query-results-popover"
            aria-label={t('json.wb.showResults')}
            onClick={() => setIsQueryOpen(!isQueryOpen)}
          >
            {isQueryInvalid ? '!' : queryResultCount}
          </button>
          {isQueryOpen && (
            <div id="query-results-popover" role="dialog" aria-label={t('json.wb.queryResults')}>
              <div className="qp-head">
                {queryPaths !== null ? <span id="query-count">{withBoldNumber(tp('json.wb.resultsFor', queryPaths.length), queryPaths.length)}</span> : <span>{t('json.wb.notAPath')}</span>}{' '}
                <code dir="ltr">{queryPaths !== null ? pathQuery : '$.orders[*].total'}</code>
              </div>
              {queryPaths !== null && queryPaths.length > 0 && root !== null ? (
                queryPaths.slice(0, 50).map((path, position) => {
                  const value = getNodeAt(root, path)
                  return (
                    <button
                      key={getPathKey(path)}
                      className="qp-row"
                      type="button"
                      id={`query-result-${position}`}
                      dir="ltr"
                      onClick={() => {
                        selectNode(path, false)
                        setStructureView('tree')
                        setIsQueryOpen(false)
                        setMobileTab('tree')
                      }}
                    >
                      <span className="p">{formatPathText(path)}</span>
                      <span className="v">{isContainer(value) ? (Array.isArray(value) ? `[${value.length}]` : '{…}') : formatValueText(value)}</span>
                    </button>
                  )
                })
              ) : (
                <div className="qp-empty">{queryPaths !== null ? t('json.wb.noMatch') : t('json.wb.queryHelp')}</div>
              )}
            </div>
          )}
        </div>
        {cursor && (
          <span className="sb" id="cursor-position">
            {t('json.status.cursor', { line: cursor.line, column: cursor.column })}
          </span>
        )}
        <span className="sb" id="indent-status">
          {indentLabel}
        </span>
        <span className="sb" id="encoding-status">
          UTF-8
        </span>
        <div className="spacer" />
        <span className="sb" id="status-legal-links">
          <a id="status-link-privacy" href={localizePath(locale, '/privacy')} target="_blank" rel="noopener">
            {t('legal.privacyShort')}
          </a>
          ·
          <a id="status-link-terms" href={localizePath(locale, '/terms')} target="_blank" rel="noopener">
            {t('legal.termsShort')}
          </a>
        </span>
        <span className="privacy privacy-desktop" id="privacy-note">
          <SpriteIcon name="lock" isSmall />
          {t('json.status.private')}
        </span>
      </footer>

      <nav id="mobile-action-bar" aria-label={t('json.wb.actions')}>
        <button type="button" id="mobile-validate-button" className="accent" disabled={isEmpty} onClick={() => void validateNow()}>
          <SpriteIcon name="check" />
          {t('json.toolbar.validate')}
        </button>
        <button type="button" id="mobile-repair-button" disabled={isEmpty} onClick={() => void repairText()}>
          <SpriteIcon name="wrench" />
          {t('json.wb.repair')}
        </button>
        <button type="button" id="mobile-format-button" disabled={!canChangeDocument} onClick={() => void formatDocument(chosenIndent)}>
          <SpriteIcon name="indent" />
          {t('json.toolbar.format')}
        </button>
        <button type="button" id="mobile-minify-button" disabled={!canChangeDocument} onClick={() => void minifyDocument()}>
          <SpriteIcon name="minify" />
          {t('json.toolbar.minifyShort')}
        </button>
        <button type="button" id="mobile-sort-keys-button" disabled={!canChangeDocument} onClick={() => void sortDocumentKeys()}>
          <SpriteIcon name="sort" />
          {t('json.toolbar.sortKeysShort')}
        </button>
      </nav>

      <div id="drop-overlay">{t('json.wb.dropOverlay')}</div>
      <div id="toast" role="status" aria-live="polite" className={toast.isShown ? 'show' : undefined}>
        {toast.message}
      </div>
    </div>
  )
}
