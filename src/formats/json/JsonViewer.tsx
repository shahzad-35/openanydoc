import { useVirtualizer } from '@tanstack/react-virtual'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import FindReplaceBar from '../../components/FindReplaceBar'
import { textControlClassName } from '../../buttonStyles'
import { Icon, IconButton } from '../../components/ToolbarControls'
import { isolateLeftToRight, translatePlural, useT } from '../../i18n'
import type { Locale } from '../../i18n'
import { Notice, useIsPhone } from '../../components/Messages'
import ModalDialog from '../../components/ModalDialog'
import { primaryButtonClassName, secondaryButtonClassName } from '../../buttonStyles'
import { getLargeFileWarning } from '../../useFileIntake'
import { buildDownloadName, downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import JsonTable from './JsonTable'
import JsonDetails from './JsonDetails'
import { JsonViewTools } from './jsonViewTools'
import type { JsonViewActions, JsonViewSettings } from './jsonViewTools'
import JsonTree, { HighlightedCodeLine } from './JsonTree'
import type { JsonTreeActions } from './JsonTree'
import {
  buildJsonDownload,
  countMatchingValues,
  expandNodesUpToLimit,
  formatPathText,
  findMatchingPaths,
  getChildEntries,
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
  withReplacedValues,
  withSortedArray,
  withValueAt,
} from './jsonModel'
import type { JsonActions, JsonEdits, JsonExportSource, JsonIndent, JsonParseResult, JsonPath, JsonSelection, JsonValue, JsonViewerCommands } from './jsonModel'

const COMMIT_DELAY_MS = 600
const CODE_LINE_HEIGHT_PX = 22
const MAX_TREE_MATCHES = 500
const searchShortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
const noLines: string[] = []

type JsonParseError = Extract<JsonParseResult, { status: 'error' }>

function describeRoot(root: JsonValue, locale: Locale, singleValueText: string) {
  if (!isContainer(root)) return singleValueText
  return translatePlural(locale, Array.isArray(root) ? 'json.summary.array' : 'json.summary.object', getChildEntries(root).length)
}

// A JSON file as a tree or as formatted code. The file is parsed in a Web Worker; edits are kept as the parsed document
// (changing a node copies only the path to it), so the undo history stays small even for a 50 MB file.
export default function JsonViewer({ openedFile, mode, session: untypedSession, onExportSourceChange, onSelectionChange, onCommandsChange }: FormatViewerProps) {
  const { locale, t, tp, idFor } = useT()
  const session = untypedSession as EditSession<JsonEdits>
  const edits = session.edits
  const isEditing = mode === 'edit'
  const originalText = useMemo(() => new TextDecoder().decode(openedFile.contents), [openedFile])
  const largeFileWarning = getLargeFileWarning(openedFile.file, locale)

  const [parseResult, setParseResult] = useState<JsonParseResult | null>(null)
  const [viewKind, setViewKind] = useState<'tree' | 'table' | 'code'>('tree')
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  const [expandNotice, setExpandNotice] = useState('')
  const [searchText, setSearchText] = useState('')
  const [currentMatchPosition, setCurrentMatchPosition] = useState(0)
  const [copyMessage, setCopyMessage] = useState('')
  const isPhone = useIsPhone()
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false)
  const [selectedPath, setSelectedPath] = useState<JsonPath | null>(null)
  const [pathCopyMessage, setPathCopyMessage] = useState('')
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [replaceResultMessage, setReplaceResultMessage] = useState('')
  const deferredFindText = useDeferredValue(findText)
  const deferredSearchText = useDeferredValue(searchText.toLowerCase())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const codeScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const originalRoot = parseResult?.status === 'ok' ? parseResult.value : null
  const root = edits.root ?? originalRoot
  const originalParseError = edits.root === null && parseResult?.status === 'error' ? parseResult : null

  const canShowTable = isArrayOfObjects(root)
  const activeView = root === null ? 'code' : viewKind === 'table' && !canShowTable ? 'tree' : viewKind
  const showTree = activeView === 'tree'
  const showTable = activeView === 'table'
  const showCode = activeView === 'code'
  const showCodeLines = showCode && !isEditing

  // The text of the code view: the original as written while untouched (a one-line file is spread out so it can be read),
  // otherwise the edited document with the chosen indentation. It is built only while the code view is open: writing out a
  // 50 MB document after every tree or table edit would freeze the page.
  const codeText = useMemo(() => {
    if (!showCode) return ''
    if (edits.root !== null) return JSON.stringify(edits.root, null, edits.indent)
    if (originalRoot !== null && !originalText.includes('\n')) return JSON.stringify(originalRoot, null, 2)
    return originalText
  }, [showCode, edits.root, edits.indent, originalRoot, originalText])

  const [draftText, setDraftText] = useState(codeText)
  const [syncedText, setSyncedText] = useState(codeText)
  const [draftError, setDraftError] = useState<JsonParseError | null>(null)
  const lastCommittedTextRef = useRef(codeText)
  const latestDraftRef = useRef(codeText)
  const commitTimerRef = useRef<number | undefined>(undefined)
  const inFlightCommitRef = useRef<{ text: string; promise: Promise<void> } | null>(null)

  // The text changed from outside the text box (undo, redo, revert all, a tree edit, the file finished loading): show it.
  // Our own commits are skipped, so the formatting being typed is never replaced under the cursor.
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

  useEffect(() => {
    setParseResult(null)
    setExpandedKeys(new Set())
    let isStale = false
    parseJsonText(originalText, locale).then((result) => {
      if (isStale) return
      setParseResult(result)
      if (result.status === 'ok') setExpandedKeys(new Set([getPathKey([])]))
      else setViewKind('code')
    })
    return () => {
      isStale = true
    }
  // The language only words a start-up failure message; changing it must not read the file again.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [originalText])

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), [])

  const exportSource = useMemo<JsonExportSource>(() => ({ originalText }), [originalText])
  useEffect(() => {
    onExportSourceChange(exportSource)
  }, [exportSource, onExportSourceChange])

  // Cmd+K (Ctrl+K) or "/" jumps to the search box.
  useEffect(() => {
    function focusSearchOnShortcut(event: KeyboardEvent) {
      const isSearchShortcut = (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || event.key === '/'
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
      if (!isSearchShortcut || (event.key === '/' && isTyping)) return
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    window.addEventListener('keydown', focusSearchOnShortcut)
    return () => window.removeEventListener('keydown', focusSearchOnShortcut)
  }, [])

  const codeLines = useMemo(() => (showCodeLines ? codeText.split('\n') : noLines), [showCodeLines, codeText])

  const treeMatches = useMemo(
    () => (showTree && deferredSearchText !== '' ? findMatchingPaths(root, deferredSearchText, MAX_TREE_MATCHES) : null),
    [showTree, root, deferredSearchText],
  )
  const matchingLineNumbers = useMemo(() => {
    if (!showCodeLines || deferredSearchText === '') return []
    const matches: number[] = []
    codeLines.forEach((lineText, lineNumber) => {
      if (lineText.toLowerCase().includes(deferredSearchText)) matches.push(lineNumber)
    })
    return matches
  }, [showCodeLines, codeLines, deferredSearchText])

  // A match inside a collapsed node opens the nodes above it.
  useEffect(() => {
    if (!treeMatches || treeMatches.paths.length === 0) return
    setExpandedKeys((currentKeys) => {
      const newKeys = new Set(currentKeys)
      for (const path of treeMatches.paths) {
        for (let depth = 0; depth < path.length; depth++) newKeys.add(getPathKey(path.slice(0, depth)))
      }
      return newKeys.size === currentKeys.size ? currentKeys : newKeys
    })
  }, [treeMatches])

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const lineVirtualizer = useVirtualizer({
    count: codeLines.length,
    getScrollElement: () => codeScrollRef.current,
    estimateSize: () => CODE_LINE_HEIGHT_PX,
    overscan: 20,
  })

  const hasSearch = deferredSearchText !== ''
  const matchCount = treeMatches ? treeMatches.paths.length : matchingLineNumbers.length
  const currentMatchPathKey = treeMatches && treeMatches.paths.length > 0 ? getPathKey(treeMatches.paths[currentMatchPosition] ?? treeMatches.paths[0]) : null
  const matchStatus = !hasSearch ? '' : matchCount === 0 ? t('find.noMatches') : t('find.matchPosition', { position: currentMatchPosition + 1, total: treeMatches?.isLimited ? `${matchCount.toLocaleString('en')}+` : matchCount })

  function goToMatch(newMatchPosition: number) {
    if (matchCount === 0) return
    const wrappedPosition = (newMatchPosition + matchCount) % matchCount
    setCurrentMatchPosition(wrappedPosition)
    if (!treeMatches) lineVirtualizer.scrollToIndex(matchingLineNumbers[wrappedPosition], { align: 'center' })
  }

  // The same text is read once even when the box losing focus and a toolbar action both ask for it, so it is one undo step.
  function commitDraft(text: string) {
    if (inFlightCommitRef.current?.text === text) return inFlightCommitRef.current.promise
    const promise = commitDraftNow(text).finally(() => {
      if (inFlightCommitRef.current?.promise === promise) inFlightCommitRef.current = null
    })
    inFlightCommitRef.current = { text, promise }
    return promise
  }

  async function commitDraftNow(text: string) {
    window.clearTimeout(commitTimerRef.current)
    if (text === lastCommittedTextRef.current) {
      setDraftError(null)
      return
    }
    const result = await parseJsonText(text, locale)
    if (text !== latestDraftRef.current) return
    if (result.status === 'error') {
      setDraftError(result)
      return
    }
    setDraftError(null)
    lastCommittedTextRef.current = JSON.stringify(result.value, null, session.edits.indent)
    session.update((currentEdits) => withNewRoot(currentEdits, originalRoot, result.value))
  }

  function changeDraft(text: string) {
    setDraftText(text)
    latestDraftRef.current = text
    window.clearTimeout(commitTimerRef.current)
    commitTimerRef.current = window.setTimeout(() => commitDraft(text), COMMIT_DELAY_MS)
  }

  function selectErrorInTextBox() {
    const textBox = textareaRef.current
    if (!textBox || !validationError || validationError.line === null) return
    const lineLengths = draftText.split('\n').slice(0, validationError.line - 1).map((lineText) => lineText.length + 1)
    const errorOffset = lineLengths.reduce((total, length) => total + length, 0) + (validationError.column ?? 1) - 1
    textBox.focus()
    textBox.setSelectionRange(errorOffset, errorOffset + 1)
  }

  function changeDocument(change: (currentRoot: JsonValue) => JsonValue) {
    session.update((currentEdits) => {
      const currentRoot = currentEdits.root ?? originalRoot
      return currentRoot === null ? currentEdits : withNewRoot(currentEdits, originalRoot, change(currentRoot))
    })
  }

  // A toolbar change to the document first reads what was typed in the code box, so it never races the box's own commit.
  async function changeDocumentAfterTyping(change: (currentRoot: JsonValue) => JsonValue) {
    if (isEditing && showCode) await commitDraft(latestDraftRef.current)
    changeDocument(change)
  }

  const treeActions: JsonTreeActions = {
    setValue(path, valueText) {
      let newValue: JsonValue
      try {
        newValue = JSON.parse(valueText)
      } catch {
        return t('json.viewer.invalidValue')
      }
      changeDocument((currentRoot) => withValueAt(currentRoot, path, newValue))
      return null
    },
    renameKey(path, newKey) {
      const parent = root === null ? null : getNodeAt(root, path.slice(0, -1))
      if (newKey === path[path.length - 1]) return null
      if (parent !== null && isContainer(parent) && !Array.isArray(parent) && Object.hasOwn(parent, newKey)) return t('json.viewer.keyExists')
      changeDocument((currentRoot) => withRenamedKey(currentRoot, path, newKey))
      setSelectedPath([...path.slice(0, -1), newKey])
      return null
    },
    deleteNode(path) {
      changeDocument((currentRoot) => withoutNodeAt(currentRoot, path))
      setSelectedPath(null)
    },
    moveNode(path, direction) {
      changeDocument((currentRoot) => withMovedNode(currentRoot, path, direction))
      const step = path[path.length - 1]
      // An item in a list changes position, so its path follows it; a key keeps its name.
      if (typeof step === 'number') setSelectedPath([...path.slice(0, -1), step + direction])
    },
    addChild(containerPath) {
      changeDocument((currentRoot) => withAddedChild(currentRoot, containerPath))
      setExpandedKeys((currentKeys) => new Set(currentKeys).add(getPathKey(containerPath)))
    },
  }

  const selectedNodeInfo = useMemo<NonNullable<JsonSelection>['selectedNode']>(() => {
    if (!showTree || selectedPath === null || root === null) return null
    const node = getNodeAt(root, selectedPath)
    const isRoot = selectedPath.length === 0
    const siblings = isRoot ? [] : getChildEntries(getNodeAt(root, selectedPath.slice(0, -1)) as never)
    const position = siblings.findIndex(([label]) => label === selectedPath[selectedPath.length - 1])
    return {
      kind: !isContainer(node) ? 'value' : Array.isArray(node) ? 'array' : 'object',
      isRoot,
      isFirst: isRoot || position === 0,
      isLast: isRoot || position === siblings.length - 1,
    }
  }, [showTree, selectedPath, root])

  const viewSettings: JsonViewSettings = { viewKind: activeView, canShowTable, hasDocument: root !== null }
  const viewActions: JsonViewActions = { setViewKind, expandAll, collapseAll, copyAll: () => void copyAllText() }

  // The toolbar reaches the viewer through this stable commands object, which calls the latest functions.
  const latestActionsRef = useRef<JsonActions | null>(null)
  useEffect(() => {
    latestActionsRef.current = {
      ...viewActions,
      setIndent: async (indent: JsonIndent) => {
        if (isEditing && showCode) await commitDraft(latestDraftRef.current)
        if (originalRoot !== null) session.update((currentEdits) => withIndent(currentEdits, originalText, originalRoot, indent))
      },
      sortKeys: (direction, includeNested) => {
        const targetPath = selectedNodeInfo?.kind === 'object' && selectedPath !== null ? selectedPath : []
        void changeDocumentAfterTyping((currentRoot) => {
          const target = getNodeAt(currentRoot, targetPath)
          const sorted = sortKeys(target, direction, includeNested)
          return sorted === target ? currentRoot : withValueAt(currentRoot, targetPath, sorted)
        })
      },
      sortSelectedArray: (direction) => {
        if (selectedPath !== null) void changeDocumentAfterTyping((currentRoot) => withSortedArray(currentRoot, selectedPath, direction))
      },
      addChild: () => {
        if (selectedPath !== null) treeActions.addChild(selectedPath)
      },
      duplicateNode: () => {
        if (selectedPath === null || selectedPath.length === 0) return
        changeDocument((currentRoot) => withDuplicatedNode(currentRoot, selectedPath))
        const step = selectedPath[selectedPath.length - 1]
        if (typeof step === 'number') setSelectedPath([...selectedPath.slice(0, -1), step + 1])
      },
      moveNode: (direction) => {
        if (selectedPath !== null && selectedPath.length > 0) treeActions.moveNode(selectedPath, direction)
      },
      deleteNode: () => {
        if (selectedPath !== null && selectedPath.length > 0) treeActions.deleteNode(selectedPath)
      },
    }
  })
  const viewerCommands = useMemo<JsonViewerCommands>(
    () => ({
      toggleFindReplace: () => setIsFindOpen((wasOpen) => !wasOpen),
      getActions: () => latestActionsRef.current as JsonActions,
    }),
    [],
  )
  useEffect(() => {
    onCommandsChange(viewerCommands)
  }, [onCommandsChange, viewerCommands])

  const isDocumentValid = root !== null && draftError === null
  useEffect(() => {
    onSelectionChange({
      isValid: isDocumentValid,
      hasDocument: root !== null,
      selectedNode: selectedNodeInfo,
      indent: edits.indent,
      view: { viewKind: activeView, canShowTable, hasDocument: root !== null },
    } satisfies NonNullable<JsonSelection>)
  }, [activeView, canShowTable, isDocumentValid, root, selectedNodeInfo, edits.indent, onSelectionChange])

  // Find and replace works on the text inside string values, in every view; keys and structure are never touched.
  const deferredRoot = useDeferredValue(root)
  const valueMatchCount = useMemo(
    () => (isFindOpen && deferredRoot !== null ? countMatchingValues(deferredRoot, deferredFindText, matchCase) : 0),
    [isFindOpen, deferredRoot, deferredFindText, matchCase],
  )

  function replaceAllValues() {
    void changeDocumentAfterTyping((currentRoot) => withReplacedValues(currentRoot, findText, replaceText, matchCase))
    setReplaceResultMessage(tp('json.viewer.replacedIn', valueMatchCount))
  }

  function toggleExpanded(pathKey: string) {
    setExpandedKeys((currentKeys) => {
      const newKeys = new Set(currentKeys)
      if (!newKeys.delete(pathKey)) newKeys.add(pathKey)
      return newKeys
    })
  }

  function expandAll() {
    if (root === null) return
    const { expandedKeys: allKeys, isLimited } = expandNodesUpToLimit(root)
    setExpandedKeys(allKeys)
    setExpandNotice(isLimited ? t('json.viewer.expandLimited') : '')
  }

  function collapseAll() {
    setExpandedKeys(new Set([getPathKey([])]))
    setExpandNotice('')
  }

  // A cell committed twice with the same value (Enter, then the box losing focus) must not add a second edit.
  function setTableCell(rowPosition: number, columnName: string, newValue: JsonValue) {
    session.update((currentEdits) => {
      const currentRoot = currentEdits.root ?? originalRoot
      if (currentRoot === null) return currentEdits
      const currentValue = getNodeAt(currentRoot, [rowPosition, columnName])
      if (JSON.stringify(currentValue) === JSON.stringify(newValue)) return currentEdits
      return withNewRoot(currentEdits, originalRoot, withValueAt(currentRoot, [rowPosition, columnName], newValue))
    })
  }

  async function copySelectedPath() {
    if (selectedPath === null) return
    try {
      await navigator.clipboard.writeText(formatPathText(selectedPath))
      setPathCopyMessage(t('json.status.copied'))
    } catch {
      setPathCopyMessage(t('json.status.copyNotAllowed'))
    }
    window.setTimeout(() => setPathCopyMessage(''), 2000)
  }

  function getCurrentJsonText() {
    return buildJsonDownload(edits, exportSource)
  }

  async function copyAllText() {
    try {
      await navigator.clipboard.writeText(getCurrentJsonText())
      setCopyMessage(t('json.status.copied'))
    } catch {
      setCopyMessage(t('json.status.copyNotAllowed'))
    }
    window.setTimeout(() => setCopyMessage(''), 2000)
  }

  function downloadCurrentJson() {
    downloadTextFile(buildDownloadName(openedFile.file.name, session.changeCount > 0, null), getCurrentJsonText(), 'application/json;charset=utf-8')
  }

  const gutterWidthPx = codeLines.length.toLocaleString('en').length * 9 + 30

  return (
    <div id="json-viewer" className="flex min-h-0 flex-1 flex-col text-[13px]">
      <div id="json-view-toolbar" role="toolbar" aria-label={isEditing ? t('json.viewer.searchLabel') : t('json.viewer.toolsLabel')} className="flex items-center gap-1 overflow-x-auto border-b border-rule bg-paper px-4 py-1 md:flex-wrap md:overflow-visible">
        {!isEditing && (
          <>
            <JsonViewTools settings={viewSettings} actions={viewActions} />
            <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-rule" />
          </>
        )}
        <div className="relative shrink-0">
          <label>
            <span className="sr-only">{t('json.viewer.searchKeysAndValues')}</span>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
            <input
              id="search-input"
              ref={searchInputRef}
              type="search"
              disabled={isEditing && showCode}
              placeholder={isEditing && showCode ? t('json.viewer.searchNotInCodeEdit') : showTable ? t('json.viewer.searchRows') : t('json.viewer.searchKeysAndValues')}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                setCurrentMatchPosition(0)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  goToMatch(currentMatchPosition + (event.shiftKey ? -1 : 1))
                }
              }}
              className={`${textControlClassName} w-64 ps-9 ${searchText === '' ? 'pe-16' : 'pe-3'} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
          {searchText === '' && (
            <kbd aria-hidden="true" className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-paper px-1.5 py-0.5 font-sans text-[11px] text-ink-soft">
              <bdi dir="ltr">{searchShortcutLabel}</bdi>
            </kbd>
          )}
        </div>
        {hasSearch && !showTable && (
          <>
            <p id="search-match-status" aria-live="polite" className="shrink-0 whitespace-nowrap px-1 text-ink-soft">
              {matchStatus}
            </p>
            <IconButton id={`toolbar-${idFor('json.viewer.previousMatch')}`} label={t('json.viewer.previousMatch')} isDisabled={matchCount === 0} onClick={() => goToMatch(currentMatchPosition - 1)}>
              <Icon>
                <path d="m6 15 6-6 6 6" />
              </Icon>
            </IconButton>
            <IconButton id={`toolbar-${idFor('json.viewer.nextMatch')}`} label={t('json.viewer.nextMatch')} isDisabled={matchCount === 0} onClick={() => goToMatch(currentMatchPosition + 1)}>
              <Icon>
                <path d="m6 9 6 6 6-6" />
              </Icon>
            </IconButton>
          </>
        )}
        {!isEditing && (
          <div className="ms-auto shrink-0" data-tip-align="end">
            <IconButton id="toolbar-download" label={t('toolbar.download')} isDisabled={root === null} onClick={downloadCurrentJson}>
              <Icon>
                <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
              </Icon>
            </IconButton>
          </div>
        )}
      </div>

      {isEditing && isFindOpen && (
        <FindReplaceBar
          findText={findText}
          replaceText={replaceText}
          matchCase={matchCase}
          matchCount={valueMatchCount}
          resultMessage={replaceResultMessage}
          onFindChange={(newText) => {
            setFindText(newText)
            setReplaceResultMessage('')
          }}
          onReplaceChange={(newText) => {
            setReplaceText(newText)
            setReplaceResultMessage('')
          }}
          onMatchCaseChange={(newValue) => {
            setMatchCase(newValue)
            setReplaceResultMessage('')
          }}
          onReplaceAll={replaceAllValues}
          onClose={() => setIsFindOpen(false)}
        />
      )}
      <Notice id="large-file-warning" kind="warning" className="border-b border-rule bg-paper px-4 py-2" message={largeFileWarning ?? ''} />
      <Notice id="expand-notice" kind="info" className="border-b border-rule bg-paper px-4 py-2" message={expandNotice} />
      {validationError && isPhone ? (
        <>
          <button
            id="json-error-bar"
            type="button"
            onClick={() => setIsErrorDialogOpen(true)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-b border-danger bg-paper px-4 text-start text-sm text-danger"
          >
            <span className="min-w-0 flex-1 truncate">
              <strong>{t('json.viewer.notValid')} </strong>
              {validationError.line !== null && t('json.viewer.errorPosition', { line: validationError.line, column: validationError.column ?? 1 })}
            </span>
            <span className="shrink-0 font-medium underline">{t('json.error.details')}</span>
          </button>
          {isErrorDialogOpen && (
            <ModalDialog id="dialog-json-error" title={t('json.viewer.notValid')} onClose={() => setIsErrorDialogOpen(false)}>
              <p id="json-error-message" role="alert" className="mt-3">
                {validationError.line !== null && `${t('json.viewer.errorPosition', { line: validationError.line, column: validationError.column ?? 1 })} `}
                <bdi dir="ltr">{validationError.message}</bdi>
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                {isEditing && validationError.line !== null && showCode && (
                  <button
                    id="json-error-go-to-button"
                    type="button"
                    onClick={() => {
                      setIsErrorDialogOpen(false)
                      selectErrorInTextBox()
                    }}
                    className={primaryButtonClassName}
                  >
                    {t('json.viewer.goToError')}
                  </button>
                )}
                <button id="json-error-close-button" type="button" autoFocus onClick={() => setIsErrorDialogOpen(false)} className={isEditing && showCode ? secondaryButtonClassName : primaryButtonClassName}>
                  {t('find.close')}
                </button>
              </div>
            </ModalDialog>
          )}
        </>
      ) : validationError ? (
        <div id="json-error" role="alert" className="flex flex-wrap items-center gap-3 border-b border-danger bg-paper px-4 py-2 text-danger">
          <p className="min-w-0 flex-1">
            <strong>{t('json.viewer.notValid')} </strong>
            {validationError.line !== null && `${t('json.viewer.errorPosition', { line: validationError.line, column: validationError.column ?? 1 })} `}
            <bdi dir="ltr">{validationError.message}</bdi>
          </p>
          {isEditing && validationError.line !== null && showCode && (
            <IconButton id={`toolbar-${idFor('json.viewer.goToError')}`} label={t('json.viewer.goToError')} onClick={selectErrorInTextBox}>
              <Icon>
                <circle cx="12" cy="12" r="7" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
              </Icon>
            </IconButton>
          )}
        </div>
      ) : (
        isEditing && showCode && (
          <p id="json-valid-status" role="status" className="border-b border-rule bg-paper px-4 py-2 text-ink-soft">
            {t('json.viewer.valid')}
          </p>
        )
      )}

      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t-2 border-t-(--file-color)">
          {parseResult === null ? (
            <p id="json-loading" role="status" className="p-6 text-ink-soft">
              {t('json.viewer.reading')}
            </p>
          ) : showTree ? (
            <div id="json-tree-view" className="flex min-h-0 flex-1">
              <JsonTree
                root={root}
                isEditable={isEditing}
                expandedKeys={expandedKeys}
                onToggleExpanded={toggleExpanded}
                searchText={deferredSearchText}
                currentMatchPathKey={currentMatchPathKey}
                selectedPathKey={selectedPath === null ? null : getPathKey(selectedPath)}
                onSelectPath={setSelectedPath}
                actions={treeActions}
              />
              <JsonDetails node={selectedPath === null || root === null ? undefined : getNodeAt(root, selectedPath)} path={selectedPath} />
            </div>
          ) : showTable ? (
            <JsonTable rows={root as JsonValue[]} originalRows={originalRoot} isEditable={isEditing} searchText={deferredSearchText} onSetCell={setTableCell} />
          ) : isEditing ? (
            <textarea
              id="json-code-editor"
              ref={textareaRef}
              autoFocus
              dir="ltr"
              spellCheck={false}
              wrap="off"
              aria-label={t('json.viewer.editLabel')}
              aria-invalid={validationError !== null}
              value={draftText}
              onChange={(event) => changeDraft(event.target.value)}
              onBlur={(event) => commitDraft(event.currentTarget.value)}
              className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-[22px] outline-none"
            />
          ) : (
            <div id="json-code-view" ref={codeScrollRef} dir="ltr" tabIndex={0} aria-label={t('json.viewer.codeLabel')} className="min-h-0 flex-1 overflow-auto outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--file-color)">
              <div role="document" dir="ltr" className="relative w-max min-w-full font-mono text-[13px]" style={{ height: lineVirtualizer.getTotalSize() }}>
                {lineVirtualizer.getVirtualItems().map((virtualLine) => {
                  const isErrorLine = validationError?.line === virtualLine.index + 1
                  const isCurrentMatch = hasSearch && virtualLine.index === matchingLineNumbers[currentMatchPosition]
                  return (
                    <div
                      key={virtualLine.key}
                      className={`group absolute left-0 flex w-max min-w-full transition-colors duration-150 ${isErrorLine ? 'bg-danger/10' : isCurrentMatch ? 'bg-accent/10' : 'hover:bg-paper'}`}
                      style={{ top: virtualLine.start, height: CODE_LINE_HEIGHT_PX, lineHeight: `${CODE_LINE_HEIGHT_PX}px` }}
                    >
                      <span aria-hidden="true" className="sticky left-0 z-10 shrink-0 select-none border-r border-rule bg-paper pr-3 text-right text-ink-soft tabular-nums" style={{ width: gutterWidthPx }}>
                        {(virtualLine.index + 1).toLocaleString('en')}
                      </span>
                      <span className="whitespace-pre px-4">
                        <HighlightedCodeLine lineText={codeLines[virtualLine.index]} searchText={deferredSearchText} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer id="json-status-bar" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-0.5 text-xs">
        <p id="json-summary" className="whitespace-nowrap font-semibold">{root === null ? 'JSON' : describeRoot(root, locale, t('json.summary.single'))}</p>
        {showTree && selectedPath !== null && (
          <p id="selected-path-bar" className="flex min-w-0 items-center gap-2 lg:hidden">
            <span className="sr-only">{t('json.viewer.selectedPath')}</span>
            <code id="selected-path" dir="ltr" className="min-w-0 truncate font-mono text-(--file-color)">
              {formatPathText(selectedPath)}
            </code>
            <IconButton id="footer-copy-path-button" label={t('json.details.copyPath')} onClick={copySelectedPath}>
              <Icon>
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <path d="M8 7.5c5 0 3 9 8 9" />
              </Icon>
            </IconButton>
            <Notice id="path-copy-message" kind="success" role="status" className="font-medium" message={pathCopyMessage} />
          </p>
        )}
        <Notice id="copy-message" kind="success" role="status" className="font-medium" message={copyMessage} />
        {(showCode || edits.root === null) && <p className="text-ink-soft">{tp('json.viewer.characters', (showCode ? codeText : originalText).length)}</p>}
        <p className="ms-auto text-ink-soft">{isEditing ? t('json.viewer.editingNote') : t('json.viewer.searchHint', { shortcut: isolateLeftToRight(searchShortcutLabel) })}</p>
      </footer>
    </div>
  )
}
