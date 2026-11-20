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
  // The colours: JSON (the JSON viewer), or XML and YAML (the XML viewer and YAML formatter pages).
  language?: CodeLanguage
}

type CodeLanguage = 'json' | 'xml' | 'yaml'
type CodeToken = { start: number; text: string; className: string }

// Keys, strings, true / false / null and numbers, found one line at a time (formatted JSON has few tokens per line).
const jsonTokenPattern = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
// XML: tag names, attribute names, quoted values and comments.
const xmlTokenPattern = /(<\/?[\w:.-]+|\/?>)|([\w:.-]+)(?==)|("[^"]*"|'[^']*')|(<!--.*?-->)/g
// YAML: comments, keys (before ": "), quoted strings, true / false / null and numbers.
const yamlTokenPattern = /(#.*$)|([^\s#:'"-][^#:]*?|"[^"]*"|'[^']*')(?=:(?:\s|$))|("(?:[^"\\]|\\.)*"|'[^']*')|\b(true|false|null|~)\b|-?\b\d+(?:\.\d+)?\b/g

function findJsonTokens(lineText: string): CodeToken[] {
  return Array.from(lineText.matchAll(jsonTokenPattern), (token) => {
    let className = 't-n'
    if (token[1] !== undefined) className = token[2] !== undefined ? 't-k' : 't-s'
    else if (token[3] !== undefined) className = token[3] === 'null' ? 't-z' : 't-b'
    else if (/^-?\d{16,}$/.test(token[0]) && !Number.isSafeInteger(Number(token[0]))) className = 't-n t-big'
    return { start: token.index, text: token[1] ?? token[0], className }
  })
}

function findMarkupTokens(lineText: string, language: 'xml' | 'yaml'): CodeToken[] {
  const pattern = language === 'xml' ? xmlTokenPattern : yamlTokenPattern
  return Array.from(lineText.matchAll(pattern), (token) => {
    const className = token[1] !== undefined ? (language === 'xml' ? 't-k' : 't-z') : token[2] !== undefined ? (language === 'xml' ? 't-b' : 't-k') : token[3] !== undefined ? 't-s' : token[4] !== undefined ? (language === 'xml' ? 't-z' : 't-b') : 't-n'
    return { start: token.index, text: token[0], className }
  })
}

// One line in colour. `selectedColumn` boxes the token that starts there; `errorColumn` puts a wavy line under the token (or the
// character) it falls in.
function HighlightedLine({ lineText, selectedColumn, errorColumn, language }: { lineText: string; selectedColumn: number | null; errorColumn: number | null; language: CodeLanguage }) {
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

  for (const token of language === 'json' ? findJsonTokens(lineText) : findMarkupTokens(lineText, language)) {
    const tokenStart = token.start
    const tokenText = token.text
    pushPlainText(tokenStart)
    let className = token.className
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
export default function JsonCodeEditor({ textareaRef, value, placeholder, ariaLabel, onChange, onBlur, onCursorMove, error, cursorLine, selectedStart, language = 'json' }: JsonCodeEditorProps) {
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
                    language={language}
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
