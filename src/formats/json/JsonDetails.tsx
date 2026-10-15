import { useState } from 'react'
import { Icon, IconButton } from '../../components/ToolbarControls'
import { HighlightedCodeLine } from './JsonTree'
import { formatPathText, getChildEntries, isContainer } from './jsonModel'
import type { JsonPath, JsonValue } from './jsonModel'

const PREVIEW_MAX_CHILDREN = 50
const PREVIEW_MAX_DEPTH = 6
const PREVIEW_MAX_LINES = 300

function describeNode(node: JsonValue) {
  if (node === null) return 'null'
  if (typeof node === 'string') return `string, ${node.length.toLocaleString()} ${node.length === 1 ? 'character' : 'characters'}`
  if (!isContainer(node)) return typeof node
  const count = getChildEntries(node).length
  if (Array.isArray(node)) return `list, ${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`
  return `object, ${count.toLocaleString()} ${count === 1 ? 'key' : 'keys'}`
}

// A copy of the value that is short enough to show: long lists and objects keep their first items, deep parts are folded.
function shortenForPreview(value: JsonValue, depth: number): JsonValue {
  if (!isContainer(value)) return value
  const entries = getChildEntries(value)
  if (depth >= PREVIEW_MAX_DEPTH) return entries.length === 0 ? value : Array.isArray(value) ? `[… ${entries.length.toLocaleString()} items]` : `{… ${entries.length.toLocaleString()} keys}`
  const shown = entries.slice(0, PREVIEW_MAX_CHILDREN)
  const hiddenCount = entries.length - shown.length
  if (Array.isArray(value)) {
    const items = shown.map(([, child]) => shortenForPreview(child, depth + 1))
    return hiddenCount > 0 ? [...items, `… ${hiddenCount.toLocaleString()} more`] : items
  }
  const members = Object.fromEntries(shown.map(([key, child]) => [key, shortenForPreview(child, depth + 1)]))
  return hiddenCount > 0 ? { ...members, '…': `${hiddenCount.toLocaleString()} more keys` } : members
}

type JsonDetailsProps = { node: JsonValue | undefined; path: JsonPath | null }

// The side panel next to the tree on wide screens: what the selected row is, where it is, and its value.
export default function JsonDetails({ node, path }: JsonDetailsProps) {
  const [copyMessage, setCopyMessage] = useState('')

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(message)
    } catch {
      setCopyMessage('Copy not allowed')
    }
    window.setTimeout(() => setCopyMessage(''), 2000)
  }

  if (path === null || node === undefined) {
    return (
      <aside id="json-details" aria-label="Details" className="hidden w-80 shrink-0 border-l border-rule bg-paper p-5 text-ink-soft lg:block xl:w-96">
        <h2 className="font-semibold text-ink">Details</h2>
        <p className="mt-2">Select a row to see its path, type and value. Arrow keys move between rows.</p>
      </aside>
    )
  }

  const pathText = formatPathText(path)
  const previewLines = isContainer(node) ? JSON.stringify(shortenForPreview(node, 0), null, 2).split('\n') : []
  const hiddenLineCount = Math.max(0, previewLines.length - PREVIEW_MAX_LINES)

  return (
    <aside id="json-details" aria-label="Details" className="hidden w-80 shrink-0 flex-col border-l border-rule bg-paper lg:flex xl:w-96">
      <div className="border-b border-rule p-4">
        <h2 className="font-semibold">Details</h2>
        <p className="mt-2 text-ink-soft">Path</p>
        <code dir="ltr" className="mt-0.5 block break-all font-mono text-(--file-color)">
          {pathText}
        </code>
        <p className="mt-3 text-ink-soft">Type</p>
        <p className="mt-0.5">{describeNode(node)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <IconButton label="Copy path" onClick={() => copyText(pathText, 'Path copied')}>
            <Icon>
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M8 7.5c5 0 3 9 8 9" />
            </Icon>
          </IconButton>
          <IconButton label="Copy value" onClick={() => copyText(typeof node === 'string' ? node : JSON.stringify(node, null, 2), 'Value copied')}>
            <Icon>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </Icon>
          </IconButton>
          <span id="details-copy-message" aria-live="polite" className="text-ink-soft">
            {copyMessage}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <p className="text-ink-soft">{isContainer(node) ? 'Preview' : 'Value'}</p>
        {isContainer(node) ? (
          <pre dir="ltr" className="mt-1 font-mono text-[13px] leading-5">
            {previewLines.slice(0, PREVIEW_MAX_LINES).map((lineText, lineNumber) => (
              <div key={lineNumber} className="whitespace-pre">
                <HighlightedCodeLine lineText={lineText} searchText="" />
              </div>
            ))}
            {hiddenLineCount > 0 && <div className="mt-1 text-ink-soft">… {hiddenLineCount.toLocaleString()} more lines. Use the Copy value icon for everything.</div>}
          </pre>
        ) : (
          <p dir="auto" className="mt-1 whitespace-pre-wrap break-words font-mono text-[13px]">
            {typeof node === 'string' ? node : String(node)}
          </p>
        )}
      </div>
    </aside>
  )
}
