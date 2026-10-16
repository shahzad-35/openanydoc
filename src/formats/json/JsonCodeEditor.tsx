import { useEffect, useMemo, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

const LINE_HEIGHT_PX = 20
const PADDING_TOP_PX = 10
const EXTRA_LINES = 8
// Above this size the text box is plain (no colours or line numbers): splitting and drawing tens of megabytes on every keystroke
// would freeze the page.
const HIGHLIGHT_MAX_CHARACTERS = 2_000_000

type TextPosition = { line: number; column: number }

type JsonCodeEditorProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  placeholder: string
  ariaLabel: string
  onChange: (text: string) => void
  onBlur: (text: string) => void
  onCursorMove: () => void
  // Lines and columns count from 1. The error gets a wavy line and a red gutter dot; the selected node's first token a box.
  error: TextPosition | null
  cursorLine: number | null
  selectedStart: TextPosition | null
}

// Keys, strings, true / false / null and numbers, found one line at a time (formatted JSON has few tokens per line).
const codeTokenPattern = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function getTokenClassName(token: RegExpMatchArray) {
  if (token[1] !== undefined) return token[2] !== undefined ? 't-k' : 't-s'
  if (token[3] !== undefined) return token[3] === 'null' ? 't-z' : 't-b'
  const isBigNumber = /^-?\d{16,}$/.test(token[0]) && !Number.isSafeInteger(Number(token[0]))
  return isBigNumber ? 't-n t-big' : 't-n'
}

// One line in colour. `selectedColumn` boxes the token that starts there; `errorColumn` puts a wavy line under the token (or the
// character) it falls in.
function HighlightedLine({ lineText, selectedColumn, errorColumn }: { lineText: string; selectedColumn: number | null; errorColumn: number | null }) {
  if (lineText === '') return <> </>
  const errorAt = errorColumn === null ? -1 : errorColumn - 1
  const parts: ReactNode[] = []
  let textFrom = 0

  function pushPlainText(textEnd: number) {
    if (textEnd <= textFrom) return
    if (errorAt >= textFrom && errorAt < textEnd) {
      parts.push(lineText.slice(textFrom, errorAt), <span key={`error-${errorAt}`} className="t-err">{lineText[errorAt]}</span>, lineText.slice(errorAt + 1, textEnd))
    } else {
      parts.push(lineText.slice(textFrom, textEnd))
    }
  }

  for (const token of lineText.matchAll(codeTokenPattern)) {
    const tokenStart = token.index
    const tokenText = token[1] ?? token[0]
    pushPlainText(tokenStart)
    let className = getTokenClassName(token)
    if (tokenStart === (selectedColumn ?? 0) - 1) className += ' t-sel'
    if (errorAt >= tokenStart && errorAt < tokenStart + tokenText.length) className += ' t-err'
    parts.push(
      <span key={tokenStart} className={className}>
        {tokenText}
      </span>,
    )
    textFrom = tokenStart + tokenText.length
  }
  pushPlainText(lineText.length)
  return <>{parts}</>
}

// The text pane's editor: line numbers, coloured text and a real <textarea> on top with transparent text (so typing, selection,
// undo and the caret are the browser's own). Only the lines on screen are drawn, moved with the box's scroll position.
export default function JsonCodeEditor({ textareaRef, value, placeholder, ariaLabel, onChange, onBlur, onCursorMove, error, cursorLine, selectedStart }: JsonCodeEditorProps) {
  const [scroll, setScroll] = useState({ top: 0, left: 0, height: 600 })
  const lines = useMemo(() => (value.length <= HIGHLIGHT_MAX_CHARACTERS ? value.split('\n') : null), [value])

  useEffect(() => {
    const textBox = textareaRef.current
    if (!textBox) return
    const observer = new ResizeObserver(() => setScroll((current) => ({ ...current, height: textBox.clientHeight })))
    observer.observe(textBox)
    return () => observer.disconnect()
  }, [textareaRef])

  const firstLine = Math.max(0, Math.floor((scroll.top - PADDING_TOP_PX) / LINE_HEIGHT_PX) - EXTRA_LINES)
  const lastLine = lines === null ? -1 : Math.min(lines.length - 1, Math.ceil((scroll.top + scroll.height) / LINE_HEIGHT_PX) + EXTRA_LINES)
  const visibleLineIndexes = Array.from({ length: Math.max(0, lastLine - firstLine + 1) }, (_, offset) => firstLine + offset)
  const linesTopPx = PADDING_TOP_PX + firstLine * LINE_HEIGHT_PX
  const lineNumberDigits = String(lines?.length ?? 1).length

  return (
    <div className="editor" id="text-editor" dir="ltr">
      {lines !== null && (
        <div id="editor-gutter" aria-hidden="true" style={lineNumberDigits > 4 ? { width: lineNumberDigits * 8 + 18 } : undefined}>
          <div className="inner" style={{ paddingTop: linesTopPx, transform: `translateY(${-scroll.top}px)` }}>
            {visibleLineIndexes.map((lineIndex) => (
              <div key={lineIndex} className={`g${lineIndex + 1 === cursorLine ? ' cur' : ''}${lineIndex + 1 === error?.line ? ' err' : ''}`}>
                {lineIndex + 1}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="code-area">
        {lines !== null && (
          <pre id="editor-highlight" aria-hidden="true" style={{ paddingTop: linesTopPx, transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
            {visibleLineIndexes.map((lineIndex) => {
              const lineNumber = lineIndex + 1
              const isErrorLine = lineNumber === error?.line
              return (
                <div key={lineIndex} className={`hl-line${lineNumber === cursorLine ? ' cur' : ''}${isErrorLine ? ' err-line' : ''}`}>
                  <HighlightedLine
                    lineText={lines[lineIndex]}
                    selectedColumn={lineNumber === selectedStart?.line ? selectedStart.column : null}
                    errorColumn={isErrorLine ? error.column : null}
                  />
                </div>
              )
            })}
          </pre>
        )}
        <textarea
          id="json-text-input"
          ref={textareaRef}
          dir="ltr"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={error !== null}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onBlur(event.currentTarget.value)}
          onSelect={onCursorMove}
          onClick={onCursorMove}
          onScroll={(event) => {
            const textBox = event.currentTarget
            setScroll({ top: textBox.scrollTop, left: textBox.scrollLeft, height: textBox.clientHeight })
          }}
          className={lines === null ? 'plain' : undefined}
        />
      </div>
    </div>
  )
}
