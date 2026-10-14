import { useVirtualizer } from '@tanstack/react-virtual'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { textControlClassName, viewerBarButtonClassName as barButtonClassName, viewerSegmentButtonClassName as segmentButtonClassName } from '../../buttonStyles'
import { getLargeFileWarning } from '../../useFileIntake'
import { buildDownloadName, downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import JsonTable from './JsonTable'
import JsonDetails from './JsonDetails'
import JsonTree, { HighlightedCodeLine } from './JsonTree'
import type { JsonTreeActions } from './JsonTree'
import {
  buildJsonDownload,
  expandNodesUpToLimit,
  formatPathText,
  findMatchingPaths,
  getChildEntries,
  getNodeAt,
  getPathKey,
  isArrayOfObjects,
  isContainer,
  parseJsonText,
  withAddedChild,
  withMovedNode,
  withNewRoot,
  withoutNodeAt,
  withRenamedKey,
  withValueAt,
} from './jsonModel'
import type { JsonEdits, JsonExportSource, JsonParseResult, JsonPath, JsonValue } from './jsonModel'

const COMMIT_DELAY_MS = 600
const CODE_LINE_HEIGHT_PX = 22
const MAX_TREE_MATCHES = 500
const searchShortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
const noLines: string[] = []

type JsonParseError = Extract<JsonParseResult, { status: 'error' }>

function BarIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function describeRoot(root: JsonValue) {
  if (!isContainer(root)) return 'A single value'
  const count = getChildEntries(root).length
  if (Array.isArray(root)) return `Array of ${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`
  return `Object with ${count.toLocaleString()} ${count === 1 ? 'key' : 'keys'}`
}

function describeErrorPosition(error: JsonParseError) {
  return error.line === null ? '' : `Line ${error.line.toLocaleString()}, column ${error.column?.toLocaleString()}: `
}

// A JSON file as a tree or as formatted code. The file is parsed in a Web Worker; edits are kept as the parsed document
// (changing a node copies only the path to it), so the undo history stays small even for a 50 MB file.
export default function JsonViewer({ openedFile, mode, session: untypedSession, onExportSourceChange }: FormatViewerProps) {
  const session = untypedSession as EditSession<JsonEdits>
  const edits = session.edits
  const isEditing = mode === 'edit'
  const originalText = useMemo(() => new TextDecoder().decode(openedFile.contents), [openedFile])
  const largeFileWarning = getLargeFileWarning(openedFile.file)

  const [parseResult, setParseResult] = useState<JsonParseResult | null>(null)
  const [viewKind, setViewKind] = useState<'tree' | 'table' | 'code'>('tree')
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  const [expandNotice, setExpandNotice] = useState('')
  const [searchText, setSearchText] = useState('')
  const [currentMatchPosition, setCurrentMatchPosition] = useState(0)
  const [copyMessage, setCopyMessage] = useState('')
  const [selectedPath, setSelectedPath] = useState<JsonPath | null>(null)
  const [pathCopyMessage, setPathCopyMessage] = useState('')
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
    parseJsonText(originalText).then((result) => {
      if (isStale) return
      setParseResult(result)
      if (result.status === 'ok') setExpandedKeys(new Set([getPathKey([])]))
      else setViewKind('code')
    })
    return () => {
      isStale = true
    }
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
  const matchStatus = !hasSearch ? '' : matchCount === 0 ? 'No matches' : `${currentMatchPosition + 1} of ${matchCount.toLocaleString()}${treeMatches?.isLimited ? '+' : ''}`

  function goToMatch(newMatchPosition: number) {
    if (matchCount === 0) return
    const wrappedPosition = (newMatchPosition + matchCount) % matchCount
    setCurrentMatchPosition(wrappedPosition)
    if (!treeMatches) lineVirtualizer.scrollToIndex(matchingLineNumbers[wrappedPosition], { align: 'center' })
  }

  async function commitDraft(text: string) {
    window.clearTimeout(commitTimerRef.current)
    if (text === lastCommittedTextRef.current) {
      setDraftError(null)
      return
    }
    const result = await parseJsonText(text)
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

  function changeIndent(indent: 0 | 2) {
    if (root === null) return
    session.update((currentEdits) => withNewRoot(currentEdits, originalRoot, currentEdits.root ?? root, indent))
  }

  function changeDocument(change: (currentRoot: JsonValue) => JsonValue) {
    session.update((currentEdits) => {
      const currentRoot = currentEdits.root ?? originalRoot
      return currentRoot === null ? currentEdits : withNewRoot(currentEdits, originalRoot, change(currentRoot))
    })
  }

  const treeActions: JsonTreeActions = {
    setValue(path, valueText) {
      let newValue: JsonValue
      try {
        newValue = JSON.parse(valueText)
      } catch {
        return 'Not valid JSON. Put text in "quotes".'
      }
      changeDocument((currentRoot) => withValueAt(currentRoot, path, newValue))
      return null
    },
    renameKey(path, newKey) {
      const parent = root === null ? null : getNodeAt(root, path.slice(0, -1))
      if (newKey === path[path.length - 1]) return null
      if (parent !== null && isContainer(parent) && !Array.isArray(parent) && Object.hasOwn(parent, newKey)) return 'That key already exists here.'
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
    setExpandNotice(isLimited ? 'Expanded the first levels only: this document is too large to open everything at once.' : '')
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
      setPathCopyMessage('Copied')
    } catch {
      setPathCopyMessage('Copy not allowed')
    }
    window.setTimeout(() => setPathCopyMessage(''), 2000)
  }

  function getCurrentJsonText() {
    return buildJsonDownload(edits, exportSource)
  }

  async function copyAllText() {
    try {
      await navigator.clipboard.writeText(getCurrentJsonText())
      setCopyMessage('Copied')
    } catch {
      setCopyMessage('Copy not allowed')
    }
    window.setTimeout(() => setCopyMessage(''), 2000)
  }

  function downloadCurrentJson() {
    downloadTextFile(buildDownloadName(openedFile.file.name, session.changeCount > 0, null), getCurrentJsonText(), 'application/json;charset=utf-8')
  }

  const gutterWidthPx = codeLines.length.toLocaleString().length * 9 + 30

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[13px]">
      <div role="toolbar" aria-label="JSON tools" className="flex items-center gap-2 overflow-x-auto border-b border-rule bg-paper px-4 py-1.5 md:flex-wrap md:overflow-visible">
        <div role="group" aria-label="View" className="control-shape solid-box flex shrink-0 gap-0.5 border-rule p-0.5">
          <button type="button" aria-pressed={showTree} disabled={root === null} onClick={() => setViewKind('tree')} className={segmentButtonClassName}>
            Tree
          </button>
          <button
            type="button"
            aria-pressed={showTable}
            disabled={!canShowTable}
            title={canShowTable ? undefined : 'The table view needs a list of objects'}
            onClick={() => setViewKind('table')}
            className={segmentButtonClassName}
          >
            Table
          </button>
          <button type="button" aria-pressed={showCode} onClick={() => setViewKind('code')} className={segmentButtonClassName}>
            Code
          </button>
        </div>

        <div className="relative shrink-0">
          <label>
            <span className="sr-only">Search keys and values</span>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              dir="auto"
              disabled={isEditing && showCode}
              placeholder={isEditing && showCode ? 'Search works in View mode, the tree or the table' : showTable ? 'Search rows' : 'Search keys and values'}
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
              className={`${textControlClassName} w-64 pl-9 ${searchText === '' ? 'pr-16' : 'pr-3'} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
          {searchText === '' && (
            <kbd aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-paper px-1.5 py-0.5 font-sans text-[11px] text-ink-soft">
              {searchShortcutLabel}
            </kbd>
          )}
        </div>
        {hasSearch && !showTable && (
          <>
            <p aria-live="polite" className="shrink-0 whitespace-nowrap text-ink-soft">
              {matchStatus}
            </p>
            <button type="button" aria-label="Previous match" disabled={matchCount === 0} onClick={() => goToMatch(currentMatchPosition - 1)} className={barButtonClassName}>
              <BarIcon>
                <path d="m6 15 6-6 6 6" />
              </BarIcon>
            </button>
            <button type="button" aria-label="Next match" disabled={matchCount === 0} onClick={() => goToMatch(currentMatchPosition + 1)} className={barButtonClassName}>
              <BarIcon>
                <path d="m6 9 6 6 6-6" />
              </BarIcon>
            </button>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {showTree && (
            <>
              <button type="button" onClick={expandAll} className={barButtonClassName}>
                Expand all
              </button>
              <button type="button" onClick={collapseAll} className={barButtonClassName}>
                Collapse all
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button type="button" disabled={root === null || draftError !== null} onClick={() => changeIndent(2)} className={barButtonClassName}>
                Format
              </button>
              <button type="button" disabled={root === null || draftError !== null} onClick={() => changeIndent(0)} className={barButtonClassName}>
                Minify
              </button>
            </>
          )}
          <button type="button" disabled={root === null} onClick={copyAllText} className={barButtonClassName}>
            <BarIcon>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </BarIcon>
            <span aria-live="polite">{copyMessage || 'Copy'}</span>
          </button>
          {!isEditing && (
            <button type="button" disabled={root === null} onClick={downloadCurrentJson} className={barButtonClassName}>
              <BarIcon>
                <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
              </BarIcon>
              Download
            </button>
          )}
        </div>
      </div>

      {largeFileWarning && <p className="border-b border-rule bg-paper px-4 py-2">{largeFileWarning}</p>}
      {expandNotice && <p className="border-b border-rule bg-paper px-4 py-2">{expandNotice}</p>}
      {validationError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-danger bg-paper px-4 py-2 text-danger">
          <p className="min-w-0 flex-1">
            <strong>Not valid JSON. </strong>
            {describeErrorPosition(validationError)}
            {validationError.message}
          </p>
          {isEditing && validationError.line !== null && showCode && (
            <button type="button" onClick={selectErrorInTextBox} className={barButtonClassName}>
              Go to error
            </button>
          )}
        </div>
      ) : (
        isEditing && showCode && (
          <p role="status" className="border-b border-rule bg-paper px-4 py-2 text-ink-soft">
            Valid JSON
          </p>
        )
      )}

      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t-2 border-t-(--file-color)">
          {parseResult === null ? (
            <p role="status" className="p-6 text-ink-soft">
              Reading file…
            </p>
          ) : showTree ? (
            <div className="flex min-h-0 flex-1">
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
              ref={textareaRef}
              autoFocus
              dir="ltr"
              spellCheck={false}
              wrap="off"
              aria-label="Edit JSON"
              aria-invalid={validationError !== null}
              value={draftText}
              onChange={(event) => changeDraft(event.target.value)}
              onBlur={(event) => commitDraft(event.currentTarget.value)}
              className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-[22px] outline-none"
            />
          ) : (
            <div ref={codeScrollRef} tabIndex={0} aria-label="JSON code, scrollable" className="min-h-0 flex-1 overflow-auto outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--file-color)">
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
                        {(virtualLine.index + 1).toLocaleString()}
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

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule bg-paper px-4 py-0.5 text-xs">
        <p className="whitespace-nowrap font-semibold">{root === null ? 'JSON' : describeRoot(root)}</p>
        {showTree && selectedPath !== null && (
          <p className="flex min-w-0 items-center gap-2 lg:hidden">
            <span className="sr-only">Selected path</span>
            <code dir="ltr" className="min-w-0 truncate font-mono text-(--file-color)">
              {formatPathText(selectedPath)}
            </code>
            <button type="button" onClick={copySelectedPath} className="shrink-0 cursor-pointer rounded px-1.5 text-ink-soft underline underline-offset-2 hover:text-ink">
              <span aria-live="polite">{pathCopyMessage || 'Copy path'}</span>
            </button>
          </p>
        )}
        {(showCode || edits.root === null) && <p className="text-ink-soft">{(showCode ? codeText : originalText).length.toLocaleString()} characters</p>}
        <p className="ml-auto text-ink-soft">{isEditing ? 'Changes are kept in your browser until you download' : `Press ${searchShortcutLabel} or / to search`}</p>
      </footer>
    </div>
  )
}
