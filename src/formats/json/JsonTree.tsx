import { useVirtualizer } from '@tanstack/react-virtual'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { textControlClassName } from '../../buttonStyles'
import type { KeyboardEvent } from 'react'
import { flattenVisibleNodes, getChildEntries, getPathKey, isContainer } from './jsonModel'
import type { JsonPath, JsonValue, TreeRow } from './jsonModel'

const ROW_HEIGHT_PX = window.matchMedia('(pointer: coarse)').matches ? 36 : 28
const INDENT_PER_LEVEL_PX = 20
const ROW_PADDING_START_PX = 12
// The centre of a row's expand arrow (its box is 20px wide); the indent guides are drawn through it.
const ARROW_CENTRE_PX = 10
const selectedRowTint = 'bg-[color-mix(in_srgb,var(--file-color)_14%,var(--paper-raised))]'

// What the tree asks the viewer to change. A text return is a message to show next to the box; null means it worked.
export type JsonTreeActions = {
  setValue: (path: JsonPath, valueText: string) => string | null
  renameKey: (path: JsonPath, newKey: string) => string | null
  deleteNode: (path: JsonPath) => void
  moveNode: (path: JsonPath, direction: -1 | 1) => void
  addChild: (containerPath: JsonPath) => void
}

type JsonTreeProps = {
  root: JsonValue
  isEditable: boolean
  expandedKeys: ReadonlySet<string>
  onToggleExpanded: (pathKey: string) => void
  // Lower-case text to highlight, and the row the search is currently on.
  searchText: string
  currentMatchPathKey: string | null
  // The row the visitor picked (shown in the path bar under the tree).
  selectedPathKey: string | null
  onSelectPath: (path: JsonPath) => void
  actions: JsonTreeActions
}

type EditingBox = { pathKey: string; kind: 'value' | 'key'; draft: string; errorMessage: string }


export function HighlightedText({ text, searchText }: { text: string; searchText: string }) {
  if (searchText === '') return <>{text}</>
  const lowerCaseText = text.toLowerCase()
  const parts: ReactNode[] = []
  let searchFrom = 0
  for (let matchStart = lowerCaseText.indexOf(searchText); matchStart !== -1; matchStart = lowerCaseText.indexOf(searchText, searchFrom)) {
    parts.push(<Fragment key={`text-${matchStart}`}>{text.slice(searchFrom, matchStart)}</Fragment>)
    searchFrom = matchStart + searchText.length
    parts.push(
      <mark key={`match-${matchStart}`} className="rounded-sm bg-accent/30 text-inherit">
        {text.slice(matchStart, searchFrom)}
      </mark>,
    )
  }
  parts.push(<Fragment key="rest">{text.slice(searchFrom)}</Fragment>)
  return <>{parts}</>
}

// Keys, strings, numbers and true / false / null, found one line at a time (formatted JSON has few tokens per line).
const codeTokenPattern = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

export function HighlightedCodeLine({ lineText, searchText }: { lineText: string; searchText: string }) {
  if (lineText === '') return <>​</>
  const parts: ReactNode[] = []
  let textFrom = 0
  for (const token of lineText.matchAll(codeTokenPattern)) {
    const tokenStart = token.index
    if (tokenStart > textFrom) parts.push(<HighlightedText key={`plain-${textFrom}`} text={lineText.slice(textFrom, tokenStart)} searchText={searchText} />)
    const isKey = token[1] !== undefined && token[2] !== undefined
    const tokenText = isKey ? token[1] : token[0]
    const className = isKey ? 'text-accent' : token[1] !== undefined ? 'text-ink' : /^-?\d/.test(tokenText) ? 'text-(--file-color)' : 'text-ink-soft'
    parts.push(
      <span key={`token-${tokenStart}`} className={className}>
        <HighlightedText text={tokenText} searchText={searchText} />
      </span>,
    )
    textFrom = tokenStart + tokenText.length
  }
  if (textFrom < lineText.length) parts.push(<HighlightedText key="rest" text={lineText.slice(textFrom)} searchText={searchText} />)
  return <>{parts}</>
}

function describeCollapsedContainer(container: JsonValue) {
  if (!isContainer(container)) return ''
  const count = getChildEntries(container).length
  if (Array.isArray(container)) return `[…] ${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`
  return `{…} ${count.toLocaleString()} ${count === 1 ? 'key' : 'keys'}`
}

function getValueClassName(value: JsonValue) {
  if (typeof value === 'string') return 'text-ink'
  if (typeof value === 'number') return 'text-(--file-color)'
  return 'text-ink-soft'
}

// The document as a collapsible tree. Only the rows on screen are drawn. In Edit mode each row has buttons to change its
// value, rename its key, move it, add to it and delete it; changes are made by the viewer, through the shared edit session.
// A small icon button on a tree row (shown on hover, or always on touch screens). `children` are the icon's paths.
function RowActionButton({ id, label, isDanger = false, onClick, children }: { id: string; label: string; isDanger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      data-tip={label}
      onClick={onClick}
      className={`grid size-6 pointer-coarse:size-9 cursor-pointer place-items-center rounded hover:bg-paper-raised ${isDanger ? 'text-danger' : 'text-ink-soft hover:text-ink'}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 pointer-coarse:size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

export default function JsonTree({ root, isEditable, expandedKeys, onToggleExpanded, searchText, currentMatchPathKey, selectedPathKey, onSelectPath, actions }: JsonTreeProps) {
  const [editingBox, setEditingBox] = useState<EditingBox | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => flattenVisibleNodes(root, expandedKeys), [root, expandedKeys])

  // TanStack Virtual returns functions the React Compiler cannot memoize; this project does not use the compiler.
  // oxlint-disable-next-line react/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 20,
  })

  const currentMatchRowPosition = currentMatchPathKey === null ? -1 : rows.findIndex((row) => row.pathKey === currentMatchPathKey)
  const isCurrentMatchOnScreen = currentMatchRowPosition !== -1
  useEffect(() => {
    if (isCurrentMatchOnScreen) rowVirtualizer.scrollToIndex(currentMatchRowPosition, { align: 'center' })
    // Only when the current match changes or appears; expanding other rows must not pull the view back.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchPathKey, isCurrentMatchOnScreen])

  function startEditing(row: TreeRow, kind: 'value' | 'key') {
    setEditingBox({ pathKey: row.pathKey, kind, draft: kind === 'value' ? JSON.stringify(row.value) : String(row.label), errorMessage: '' })
  }

  function finishEditing(row: TreeRow, shouldCommit: boolean) {
    if (!editingBox) return
    if (!shouldCommit) {
      setEditingBox(null)
      return
    }
    const errorMessage =
      editingBox.kind === 'value' ? actions.setValue(row.path, editingBox.draft) : actions.renameKey(row.path, editingBox.draft)
    if (errorMessage === null) setEditingBox(null)
    else setEditingBox({ ...editingBox, errorMessage })
  }

  // Arrow keys like a file tree: Up and Down move, Right opens a node or steps into it, Left closes it or steps out.
  function handleTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement || rows.length === 0) return
    const selectedPosition = selectedPathKey === null ? -1 : rows.findIndex((row) => row.pathKey === selectedPathKey)
    const selectedRow = rows[selectedPosition]
    let newPosition = selectedPosition
    if (event.key === 'ArrowDown') newPosition = Math.min(rows.length - 1, selectedPosition + 1)
    else if (event.key === 'ArrowUp') newPosition = Math.max(0, selectedPosition - 1)
    else if (event.key === 'Home') newPosition = 0
    else if (event.key === 'End') newPosition = rows.length - 1
    else if (event.key === 'ArrowRight' && selectedRow && isContainer(selectedRow.value)) {
      if (expandedKeys.has(selectedRow.pathKey)) newPosition = selectedPosition + 1
      else onToggleExpanded(selectedRow.pathKey)
    } else if (event.key === 'ArrowLeft' && selectedRow) {
      if (isContainer(selectedRow.value) && expandedKeys.has(selectedRow.pathKey)) onToggleExpanded(selectedRow.pathKey)
      else if (selectedRow.path.length > 0) newPosition = rows.findIndex((row) => row.pathKey === getPathKey(selectedRow.path.slice(0, -1)))
    } else return
    event.preventDefault()
    if (newPosition < 0 || newPosition >= rows.length) return
    onSelectPath(rows[newPosition].path)
    rowVirtualizer.scrollToIndex(newPosition)
  }

  return (
    <div id="json-tree" ref={scrollContainerRef} tabIndex={0} onKeyDown={handleTreeKeyDown} aria-label="JSON tree, scrollable" className="min-h-0 flex-1 overflow-auto outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--file-color)">
      <div id="json-tree-rows" role="tree" className="relative w-full font-mono text-[13px]" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          const isExpanded = expandedKeys.has(row.pathKey)
          const isObjectMember = row.path.length > 0 && typeof row.label === 'string'
          const isEditingThisRow = editingBox?.pathKey === row.pathKey
          const isCurrentMatch = row.pathKey === currentMatchPathKey
          const isSelected = row.pathKey === selectedPathKey
          const canEditValue = isEditable && !isContainer(row.value)
          return (
            <div
              key={row.pathKey}
              id={`tree-row-${virtualRow.index}`}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={isContainer(row.value) ? isExpanded : undefined}
              aria-selected={isSelected}
              onClick={() => {
                onSelectPath(row.path)
                scrollContainerRef.current?.focus({ preventScroll: true })
              }}
              className={`group absolute left-0 flex w-full items-center gap-2 pe-3 transition-colors duration-150 ${
                isSelected ? selectedRowTint : isCurrentMatch ? 'bg-accent/10' : 'hover:bg-paper'
              }`}
              style={{ top: virtualRow.start, height: ROW_HEIGHT_PX, paddingInlineStart: ROW_PADDING_START_PX + row.depth * INDENT_PER_LEVEL_PX }}
            >
              {isSelected && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-(--file-color)" />}
              {Array.from({ length: row.depth }, (_, level) => (
                <span
                  key={level}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-px bg-rule"
                  style={{ left: ROW_PADDING_START_PX + level * INDENT_PER_LEVEL_PX + ARROW_CENTRE_PX }}
                />
              ))}
              {isContainer(row.value) ? (
                <button
                  id={`tree-toggle-${virtualRow.index}`}
                  type="button"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.label ?? 'root'}`}
                  onClick={() => onToggleExpanded(row.pathKey)}
                  className="inline-flex size-5 pointer-coarse:size-8 shrink-0 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-paper-raised"
                >
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={isExpanded ? 'M3 4.5 6 7.5l3-3' : 'M4.5 3 7.5 6l-3 3'} />
                  </svg>
                </button>
              ) : (
                <span aria-hidden="true" className="inline-block size-5 shrink-0" />
              )}

              {row.label === null && <span className="shrink-0 text-ink-soft">root</span>}
              {row.label !== null && (
                <span className="shrink-0 text-accent">
                  {isEditingThisRow && editingBox.kind === 'key' ? (
                    <input
                      id="tree-key-input"
                      autoFocus
                      aria-label="Key name"
                      aria-invalid={editingBox.errorMessage !== ''}
                      value={editingBox.draft}
                      onChange={(event) => setEditingBox({ ...editingBox, draft: event.target.value, errorMessage: '' })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') finishEditing(row, true)
                        if (event.key === 'Escape') finishEditing(row, false)
                      }}
                      onBlur={() => finishEditing(row, false)}
                      className={`${textControlClassName} w-44`}
                    />
                  ) : (
                    <>
                      {typeof row.label === 'string' ? <HighlightedText text={`"${row.label}"`} searchText={searchText} /> : <span className="text-ink-soft">{row.label}</span>}
                      <span className="text-ink-soft">:</span>
                    </>
                  )}
                </span>
              )}

              <span className={`min-w-0 truncate ${getValueClassName(row.value)}`}>
                {isEditingThisRow && editingBox.kind === 'value' ? (
                  <input
                    id="tree-value-input"
                    autoFocus
                    aria-label="Value, written as JSON"
                    aria-invalid={editingBox.errorMessage !== ''}
                    value={editingBox.draft}
                    onChange={(event) => setEditingBox({ ...editingBox, draft: event.target.value, errorMessage: '' })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') finishEditing(row, true)
                      if (event.key === 'Escape') finishEditing(row, false)
                    }}
                    onBlur={() => finishEditing(row, false)}
                    className={`${textControlClassName} w-72 max-w-full`}
                  />
                ) : isContainer(row.value) ? (
                  !isExpanded && <span className="text-ink-soft">{describeCollapsedContainer(row.value)}</span>
                ) : (
                  <HighlightedText text={JSON.stringify(row.value)} searchText={searchText} />
                )}
              </span>
              {isEditingThisRow && editingBox.errorMessage !== '' && (
                <span id="tree-edit-error" role="alert" className="shrink-0 font-sans text-xs text-danger">
                  {editingBox.errorMessage}
                </span>
              )}

              {isEditable && !isEditingThisRow && (
                <span className="ms-auto flex shrink-0 gap-1 font-sans opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                  {canEditValue && (
                    <RowActionButton id={`tree-edit-value-${virtualRow.index}`} label={`Edit the value of ${row.label}`} onClick={() => startEditing(row, 'value')}>
                      <path d="m4 20 1-4L16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
                    </RowActionButton>
                  )}
                  {isObjectMember && (
                    <RowActionButton id={`tree-rename-${virtualRow.index}`} label={`Rename the key ${row.label}`} onClick={() => startEditing(row, 'key')}>
                      <path d="M4 7h16M4 12h10M4 17h16" />
                      <path d="m17 12 3 3-3 3" />
                    </RowActionButton>
                  )}
                  {isContainer(row.value) && (
                    <RowActionButton id={`tree-add-${virtualRow.index}`} label={`Add a child to ${row.label ?? 'root'}`} onClick={() => actions.addChild(row.path)}>
                      <path d="M12 5v14M5 12h14" />
                    </RowActionButton>
                  )}
                  {row.path.length > 0 && (
                    <>
                      <RowActionButton id={`tree-move-up-${virtualRow.index}`} label={`Move ${row.label} up`} onClick={() => actions.moveNode(row.path, -1)}>
                        <path d="m6 15 6-6 6 6" />
                      </RowActionButton>
                      <RowActionButton id={`tree-move-down-${virtualRow.index}`} label={`Move ${row.label} down`} onClick={() => actions.moveNode(row.path, 1)}>
                        <path d="m6 9 6 6 6-6" />
                      </RowActionButton>
                      <RowActionButton id={`tree-delete-${virtualRow.index}`} label={`Delete ${row.label}`} isDanger onClick={() => actions.deleteNode(row.path)}>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </RowActionButton>
                    </>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
