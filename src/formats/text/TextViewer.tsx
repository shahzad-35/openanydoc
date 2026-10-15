import { useVirtualizer } from '@tanstack/react-virtual'
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import FindReplaceBar from '../../components/FindReplaceBar'
import { textControlClassName } from '../../buttonStyles'
import { Icon, IconButton } from '../../components/ToolbarControls'
import { decodeCsvBytes, looksLikeBinary } from '../../parseCsv'
import { getLargeFileWarning } from '../../useFileIntake'
import { buildDownloadName, downloadTextFile } from '../registry'
import type { FormatViewerProps } from '../registry'
import type { EditSession } from '../useEditSession'
import { applyTextTransform, buildTextDownload, findTextMatches, replaceAllTextMatches, withEditedText, withLineEnding } from './textEditing'
import { DEFAULT_TEXT_FONT_KEY, DEFAULT_TEXT_SIZE_PX, TEXT_FONT_CHOICES, TextViewTools } from './textViewTools'
import type { TextViewActions, TextViewSettings } from './textViewTools'
import type { TextActions, TextEdits, TextExportSource, TextSelection, TextViewerCommands } from './textEditing'

type ReadableText = ({ status: 'ok'; encodingLabel: string } & TextExportSource) | { status: 'error'; message: string }

const LINE_HEIGHT_RATIO = 1.7
const SHEET_VERTICAL_PADDING_PX = 12
// While editing, the text is one text box; beyond this size typing may feel slow, and the line numbers are left out.
const LARGE_EDIT_CHARACTER_COUNT = 2_000_000
const COMMIT_DELAY_MS = 600
const searchShortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
const noLines: string[] = []

function readPlainText(fileContents: ArrayBuffer): ReadableText {
  if (fileContents.byteLength === 0) return { status: 'error', message: 'This file is empty.' }
  if (looksLikeBinary(fileContents)) {
    return { status: 'error', message: "This doesn't look like a text file. It contains binary data, so it may be corrupted or a different file type." }
  }

  const { text, encodingLabel } = decodeCsvBytes(fileContents)
  if (text.trim() === '') return { status: 'error', message: 'This file is empty.' }

  return {
    status: 'ok',
    originalText: text.replace(/\r\n|\r/g, '\n'),
    lineEnding: text.includes('\r\n') ? '\r\n' : '\n',
    hadByteOrderMark: encodingLabel.startsWith('UTF-8 with BOM'),
    encodingLabel,
  }
}

function splitIntoLines(text: string) {
  const lines = text.split('\n')
  // A final line break ends the last line; it does not start another one.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

// A line with every match of the search text highlighted.
function HighlightedLine({ lineText, searchText }: { lineText: string; searchText: string }) {
  if (searchText === '') return <>{lineText === '' ? '​' : lineText}</>
  const lowerCaseLine = lineText.toLowerCase()
  const parts: ReactNode[] = []
  let searchFrom = 0
  for (let matchStart = lowerCaseLine.indexOf(searchText); matchStart !== -1; matchStart = lowerCaseLine.indexOf(searchText, searchFrom)) {
    parts.push(<Fragment key={`text-${matchStart}`}>{lineText.slice(searchFrom, matchStart)}</Fragment>)
    searchFrom = matchStart + searchText.length
    parts.push(
      <mark key={`match-${matchStart}`} className="rounded-sm bg-accent/30 text-inherit">
        {lineText.slice(matchStart, searchFrom)}
      </mark>,
    )
  }
  parts.push(<Fragment key="rest">{lineText.slice(searchFrom)}</Fragment>)
  return <>{parts}</>
}

// A plain text file as a document. In View mode: a sheet with a line-number gutter, search, and reading controls, every line
// aligned to its own language direction, drawn only where visible so a very long file stays smooth. In Edit mode the same
// sheet holds one text box; the edits join the page's undo, redo and Download.
export default function TextViewer({ openedFile, mode, session: untypedSession, onExportSourceChange, onSelectionChange, onCommandsChange }: FormatViewerProps) {
  const session = untypedSession as EditSession<TextEdits>
  const readableText = useMemo(() => readPlainText(openedFile.contents), [openedFile])
  const largeFileWarning = getLargeFileWarning(openedFile.file)
  const originalText = readableText.status === 'ok' ? readableText.originalText : ''
  const currentText = session.edits.text ?? originalText
  const isEditing = mode === 'edit'

  const [searchText, setSearchText] = useState('')
  const [currentMatchPosition, setCurrentMatchPosition] = useState(0)
  const [wantsLineNumbers, setWantsLineNumbers] = useState(true)
  const [wrapLines, setWrapLines] = useState(true)
  const [fontKey, setFontKey] = useState(DEFAULT_TEXT_FONT_KEY)
  const [textSizePx, setTextSizePx] = useState(DEFAULT_TEXT_SIZE_PX)
  const [copyMessage, setCopyMessage] = useState('')
  const [draftText, setDraftText] = useState(currentText)
  const [syncedText, setSyncedText] = useState(currentText)
  const [hasSelection, setHasSelection] = useState(false)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [matchPosition, setMatchPosition] = useState(0)
  const [replaceResultMessage, setReplaceResultMessage] = useState('')
  const deferredDraftText = useDeferredValue(draftText)
  const deferredFindText = useDeferredValue(findText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const deferredSearchText = useDeferredValue(searchText.toLowerCase())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const commitTimerRef = useRef<number | undefined>(undefined)
  const lastCommittedTextRef = useRef(currentText)

  const lines = useMemo(() => (readableText.status === 'ok' ? splitIntoLines(currentText) : noLines), [readableText.status, currentText])
  const lineHeightPx = Math.round(textSizePx * LINE_HEIGHT_RATIO)
  const isLargeForEditing = draftText.length > LARGE_EDIT_CHARACTER_COUNT
  // While editing, line numbers need every line to be one row, so they are available only without wrapping.
  const showLineNumbers = wantsLineNumbers && (!isEditing || (!wrapLines && !isLargeForEditing))
  const editedLineCount = useMemo(() => (isEditing && showLineNumbers ? (draftText.match(/\n/g)?.length ?? 0) + 1 : 0), [isEditing, showLineNumbers, draftText])
  const gutterLineCount = isEditing ? editedLineCount : lines.length
  const gutterWidthPx = showLineNumbers ? gutterLineCount.toLocaleString().length * 9 + 30 : 0
  const editGutterNumbers = useMemo(() => Array.from({ length: editedLineCount }, (_, lineNumber) => lineNumber + 1).join('\n'), [editedLineCount])

  // The text changed from outside the text box (undo, redo, revert all): show it. Our own commits are skipped.
  if (currentText !== syncedText) {
    setSyncedText(currentText)
    if (currentText !== lastCommittedTextRef.current) {
      lastCommittedTextRef.current = currentText
      setDraftText(currentText)
    }
  }

  const exportSource = useMemo<TextExportSource | null>(
    () => (readableText.status === 'ok' ? { originalText: readableText.originalText, lineEnding: readableText.lineEnding, hadByteOrderMark: readableText.hadByteOrderMark } : null),
    [readableText],
  )
  useEffect(() => {
    onExportSourceChange(exportSource)
  }, [exportSource, onExportSourceChange])

  const matchingLineNumbers = useMemo(() => {
    if (deferredSearchText === '' || isEditing) return []
    const matches: number[] = []
    lines.forEach((lineText, lineNumber) => {
      if (lineText.toLowerCase().includes(deferredSearchText)) matches.push(lineNumber)
    })
    return matches
  }, [lines, deferredSearchText, isEditing])

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const lineVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => lineHeightPx,
    paddingStart: SHEET_VERTICAL_PADDING_PX,
    paddingEnd: SHEET_VERTICAL_PADDING_PX,
    overscan: 20,
  })

  // Line heights change with the text size and with wrapping.
  useEffect(() => {
    lineVirtualizer.measure()
  }, [lineVirtualizer, lineHeightPx, wrapLines])

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

  // Replaces the whole text in one step (one undo step) and puts the selection where the change says.
  function replaceDraftText(newText: string, selectionStart: number, selectionEnd: number) {
    setDraftText(newText)
    commitDraft(newText)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd)
    })
  }

  function transformText(kind: Parameters<typeof applyTextTransform>[3]) {
    const textarea = textareaRef.current
    const liveText = textarea?.value ?? draftText
    const result = applyTextTransform(liveText, textarea?.selectionStart ?? 0, textarea?.selectionEnd ?? 0, kind)
    if (result.text !== liveText) replaceDraftText(result.text, result.selectionStart, result.selectionEnd)
  }

  // Find and replace works on the text in the box: Next and Previous select the match in the box.
  const matchStarts = useMemo(
    () => (isFindOpen ? findTextMatches(deferredDraftText, deferredFindText, matchCase) : []),
    [isFindOpen, deferredDraftText, deferredFindText, matchCase],
  )

  function goToTextMatch(newPosition: number) {
    if (matchStarts.length === 0) return
    const wrappedPosition = (newPosition + matchStarts.length) % matchStarts.length
    setMatchPosition(wrappedPosition)
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(matchStarts[wrappedPosition], matchStarts[wrappedPosition] + findText.length)
  }

  function replaceCurrentMatch() {
    const textarea = textareaRef.current
    if (!textarea || matchStarts.length === 0) return
    const matchStart = matchStarts[Math.min(matchPosition, matchStarts.length - 1)]
    const newText = textarea.value.slice(0, matchStart) + replaceText + textarea.value.slice(matchStart + findText.length)
    replaceDraftText(newText, matchStart, matchStart + replaceText.length)
    setReplaceResultMessage('Replaced 1 match')
  }

  function replaceAllMatches() {
    const textarea = textareaRef.current
    if (!textarea) return
    const newText = replaceAllTextMatches(textarea.value, findText, replaceText, matchCase)
    replaceDraftText(newText, 0, 0)
    setReplaceResultMessage(`Replaced ${matchStarts.length.toLocaleString()} ${matchStarts.length === 1 ? 'match' : 'matches'}`)
  }

  const lineNumbersAvailable = !isEditing || (!wrapLines && !isLargeForEditing)
  const viewSettings: TextViewSettings = { fontKey, textSizePx, wrapLines, showLineNumbers, lineNumbersAvailable }
  const viewActions: TextViewActions = {
    setFontKey,
    setTextSize: setTextSizePx,
    toggleWrapLines: () => setWrapLines((wasWrapped) => !wasWrapped),
    toggleLineNumbers: () => setWantsLineNumbers((wanted) => !wanted),
    copyAllText: () => void copyAllText(),
  }

  // The toolbar reaches the viewer through this stable commands object, which calls the latest functions.
  const latestActionsRef = useRef<TextActions | null>(null)
  useEffect(() => {
    latestActionsRef.current = {
      ...viewActions,
      transform: transformText,
      setLineEnding: (lineEnding) => {
        if (exportSource) session.update((currentEdits) => withLineEnding(currentEdits, exportSource.lineEnding, lineEnding))
      },
    }
  })
  const viewerCommands = useMemo<TextViewerCommands>(
    () => ({
      toggleFindReplace: () => setIsFindOpen((wasOpen) => !wasOpen),
      getActions: () => latestActionsRef.current as TextActions,
    }),
    [],
  )
  useEffect(() => {
    onCommandsChange(viewerCommands)
  }, [onCommandsChange, viewerCommands])

  const effectiveLineEnding = session.edits.lineEnding ?? exportSource?.lineEnding ?? '\n'
  useEffect(() => {
    onSelectionChange(exportSource ? ({ hasSelection, lineEnding: effectiveLineEnding, view: { fontKey, textSizePx, wrapLines, showLineNumbers, lineNumbersAvailable } } satisfies TextSelection) : null)
  }, [exportSource, hasSelection, effectiveLineEnding, fontKey, textSizePx, wrapLines, showLineNumbers, lineNumbersAvailable, onSelectionChange])

  const wordCount = useMemo(() => (isEditing ? (deferredDraftText.match(/\S+/g)?.length ?? 0) : 0), [isEditing, deferredDraftText])

  function goToMatch(newMatchPosition: number) {
    if (matchingLineNumbers.length === 0) return
    const wrappedPosition = (newMatchPosition + matchingLineNumbers.length) % matchingLineNumbers.length
    setCurrentMatchPosition(wrappedPosition)
    lineVirtualizer.scrollToIndex(matchingLineNumbers[wrappedPosition], { align: 'center' })
  }

  async function copyAllText() {
    try {
      await navigator.clipboard.writeText(currentText)
      setCopyMessage('Copied')
    } catch {
      setCopyMessage('Copy not allowed')
    }
    window.setTimeout(() => setCopyMessage(''), 2000)
  }

  function downloadCurrentText() {
    if (!exportSource) return
    downloadTextFile(
      buildDownloadName(openedFile.file.name, session.changeCount > 0, null),
      buildTextDownload(session.edits, exportSource, exportSource.hadByteOrderMark),
      'text/plain;charset=utf-8',
    )
  }

  if (readableText.status === 'error') {
    return (
      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        <div role="alert" className="box-shape solid-box m-6 max-w-2xl border-danger p-6">
          <h2 className="type-h3">This file can't be shown</h2>
          <p className="mt-2">{readableText.message}</p>
          <p className="mt-2 text-ink-soft">Use "Open another file" above to try a different file.</p>
        </div>
      </main>
    )
  }

  const hasSearch = deferredSearchText !== '' && !isEditing
  const matchStatus = !hasSearch ? '' : matchingLineNumbers.length === 0 ? 'No matches' : `${currentMatchPosition + 1} of ${matchingLineNumbers.length.toLocaleString()}`
  const currentMatchLineNumber = matchingLineNumbers[currentMatchPosition]
  const fontFamily = (TEXT_FONT_CHOICES.find((font) => font.key === fontKey) ?? TEXT_FONT_CHOICES[0]).css
  const textStyle = { fontSize: textSizePx, lineHeight: `${lineHeightPx}px`, tabSize: 4, fontFamily }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[13px]">
      {!isEditing && (
        <div role="toolbar" aria-label="Text tools" className="flex items-center gap-1 overflow-x-auto border-b border-rule bg-paper px-4 py-1 md:flex-wrap md:overflow-visible">
          <TextViewTools settings={viewSettings} actions={viewActions} />
          <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-rule" />
          <div className="relative shrink-0">
            <label>
              <span className="sr-only">Search text</span>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                dir="auto"
                placeholder="Search text"
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
                className={`${textControlClassName} w-56 pl-9 ${searchText === '' ? 'pr-16' : 'pr-3'}`}
              />
            </label>
            {searchText === '' && (
              <kbd aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-paper px-1.5 py-0.5 font-sans text-[11px] text-ink-soft">
                {searchShortcutLabel}
              </kbd>
            )}
          </div>
          {hasSearch && (
            <>
              <p aria-live="polite" className="shrink-0 whitespace-nowrap px-1 text-ink-soft">
                {matchStatus}
              </p>
              <IconButton label="Previous match" isDisabled={matchingLineNumbers.length === 0} onClick={() => goToMatch(currentMatchPosition - 1)}>
                <Icon>
                  <path d="m6 15 6-6 6 6" />
                </Icon>
              </IconButton>
              <IconButton label="Next match" isDisabled={matchingLineNumbers.length === 0} onClick={() => goToMatch(currentMatchPosition + 1)}>
                <Icon>
                  <path d="m6 9 6 6 6-6" />
                </Icon>
              </IconButton>
            </>
          )}
          <div className="ml-auto shrink-0" data-tip-align="end">
            <IconButton label="Download" onClick={downloadCurrentText}>
              <Icon>
                <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
              </Icon>
            </IconButton>
          </div>
        </div>
      )}

      {isEditing && isFindOpen && (
        <FindReplaceBar
          findText={findText}
          replaceText={replaceText}
          matchCase={matchCase}
          matchCount={matchStarts.length}
          matchPosition={matchPosition}
          resultMessage={replaceResultMessage}
          onFindChange={(newText) => {
            setFindText(newText)
            setMatchPosition(0)
            setReplaceResultMessage('')
          }}
          onReplaceChange={(newText) => {
            setReplaceText(newText)
            setReplaceResultMessage('')
          }}
          onMatchCaseChange={(newValue) => {
            setMatchCase(newValue)
            setMatchPosition(0)
            setReplaceResultMessage('')
          }}
          onPrevious={() => goToTextMatch(matchPosition - 1)}
          onNext={() => goToTextMatch(matchPosition + 1)}
          onReplace={replaceCurrentMatch}
          onReplaceAll={replaceAllMatches}
          onClose={() => setIsFindOpen(false)}
        />
      )}

      {largeFileWarning && <p className="border-b border-rule bg-paper px-4 py-2">{largeFileWarning}</p>}
      {isEditing && isLargeForEditing && (
        <p className="border-b border-rule bg-paper px-4 py-2">This file is large, so typing may feel slow and line numbers are hidden while editing. View mode stays fast.</p>
      )}

      <main id="main" className="flex min-h-0 flex-1 flex-col bg-paper-raised">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t-2 border-t-(--file-color)">
          {isEditing ? (
            <div className="flex min-h-0 flex-1">
              {showLineNumbers && (
                <div ref={gutterRef} aria-hidden="true" className="shrink-0 select-none overflow-hidden border-r border-rule bg-paper text-right text-ink-soft tabular-nums" style={{ width: gutterWidthPx }}>
                  <pre className="pr-3" style={{ ...textStyle, paddingBlock: SHEET_VERTICAL_PADDING_PX }}>
                    {editGutterNumbers}
                  </pre>
                </div>
              )}
              <textarea
                ref={textareaRef}
                autoFocus
                dir="auto"
                spellCheck={false}
                wrap={wrapLines ? 'soft' : 'off'}
                aria-label="Edit text"
                value={draftText}
                onChange={(event) => changeDraft(event.target.value)}
                onBlur={(event) => commitDraft(event.currentTarget.value)}
                onSelect={(event) => setHasSelection(event.currentTarget.selectionEnd > event.currentTarget.selectionStart)}
                onScroll={(event) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
                }}
                className="min-w-0 flex-1 resize-none bg-transparent px-4 outline-none"
                style={{ ...textStyle, paddingBlock: SHEET_VERTICAL_PADDING_PX }}
              />
            </div>
          ) : (
            <div ref={scrollContainerRef} tabIndex={0} aria-label="Text content, scrollable" className="min-h-0 flex-1 overflow-auto outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--file-color)">
              <div role="document" className={`relative ${wrapLines ? '' : 'w-max min-w-full'}`} style={{ ...textStyle, height: lineVirtualizer.getTotalSize() }}>
                {lineVirtualizer.getVirtualItems().map((virtualLine) => {
                  const isCurrentMatch = hasSearch && virtualLine.index === currentMatchLineNumber
                  return (
                    <div
                      key={virtualLine.key}
                      ref={lineVirtualizer.measureElement}
                      data-index={virtualLine.index}
                      className={`group absolute left-0 flex min-w-full transition-colors duration-150 ${wrapLines ? 'right-0' : 'w-max'} ${isCurrentMatch ? 'bg-accent/10' : 'hover:bg-paper'}`}
                      style={{ top: virtualLine.start }}
                    >
                      {showLineNumbers && (
                        <span aria-hidden="true" className="sticky left-0 z-10 shrink-0 select-none border-r border-rule bg-paper pr-3 text-right text-ink-soft tabular-nums transition-colors duration-150 group-hover:text-ink" style={{ width: gutterWidthPx }}>
                          {(virtualLine.index + 1).toLocaleString()}
                        </span>
                      )}
                      <span dir="auto" className={`min-w-0 flex-1 px-4 text-start ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
                        <HighlightedLine lineText={lines[virtualLine.index]} searchText={deferredSearchText} />
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
        <p className="whitespace-nowrap font-semibold">{(isEditing ? splitIntoLines(draftText).length : lines.length).toLocaleString()} lines</p>
        <p className="text-ink-soft">{(isEditing ? draftText : currentText).length.toLocaleString()} characters</p>
        {isEditing && <p className="text-ink-soft">{wordCount.toLocaleString()} words</p>}
        <p className="text-ink-soft">Encoding: {readableText.encodingLabel}</p>
        {copyMessage && (
          <p role="status" className="font-medium">
            {copyMessage}
          </p>
        )}
        <p className="ml-auto text-ink-soft">{isEditing ? 'Changes are kept in your browser until you download' : `Press ${searchShortcutLabel} or / to search`}</p>
      </footer>
    </div>
  )
}
