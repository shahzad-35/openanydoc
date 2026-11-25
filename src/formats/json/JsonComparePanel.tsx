import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { isolateLeftToRight, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { formatDefinitions } from '../registry'
import { diffJson, formatWithPaths } from './jsonDiff'
import { findJsonSourceFormat, readSourceAsJsonText } from './jsonFormats'
import type { JsonDifference, PathLine } from './jsonDiff'
import { formatPathText, getPathKey } from './jsonModel'
import type { JsonPath, JsonValue } from './jsonModel'
import { parseKeepingBigNumbers, restoreBigNumbers } from './jsonTools'

const MAX_SHOWN_LINES = 20_000
const MAX_LISTED_DIFFERENCES = 300
// The second document has the same size limit as the open one.
const MAX_FILE_BYTES = formatDefinitions.find((format) => format.viewerId === 'json')?.maxFileBytes ?? Infinity

type Side = 'left' | 'right'

// Whether a line belongs to a node that differs (the node itself or anything inside it), and how.
function markLines(lines: PathLine[], differences: JsonDifference[], side: Side) {
  const kindByKey = new Map<string, JsonDifference['kind']>()
  for (const difference of differences) {
    if ((side === 'left' && difference.kind === 'added') || (side === 'right' && difference.kind === 'removed')) continue
    kindByKey.set(getPathKey(difference.path), difference.kind)
  }
  return lines.map((line) => {
    for (let length = line.path.length; length >= 0; length--) {
      const kind = kindByKey.get(getPathKey(line.path.slice(0, length)))
      // A reordered object marks only its own lines, not everything in it.
      if (kind && (kind !== 'reordered' || length === line.path.length)) return kind
    }
    return null
  })
}

// Compare: the open document (with its edits) against a second one pasted, chosen or dropped here, side by side, with added,
// removed and changed nodes marked. Objects compare by key; "Ignore key order" (on by default) also lines the keys up.
export default function JsonComparePanel({ root }: { root: JsonValue }) {
  const { t, tp } = useT()
  const [otherText, setOtherText] = useState('')
  const [otherName, setOtherName] = useState('')
  const [fileError, setFileError] = useState('')
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deferredOtherText = useDeferredValue(otherText)

  const describeTooLarge = (byteCount: number) =>
    `${t('intake.tooLarge', { size: isolateLeftToRight(formatFileSize(byteCount)) })} ${t('intake.tooLargeDetail', { format: 'JSON', limit: isolateLeftToRight(`${MAX_FILE_BYTES / (1024 * 1024)} MB`) })}`

  // Pasted text: its length in characters is at most its size in bytes, so this quick check never refuses a text under the limit.
  const isPastedTextTooLarge = deferredOtherText.length > MAX_FILE_BYTES
  const other = useMemo((): { value: JsonValue } | { error: string } | null => {
    if (deferredOtherText.trim() === '' || isPastedTextTooLarge) return null
    try {
      const { value, bigNumberCount } = parseKeepingBigNumbers(deferredOtherText)
      return { value: bigNumberCount > 0 ? restoreBigNumbers(value) : (value as JsonValue) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [deferredOtherText, isPastedTextTooLarge])
  const shownError = fileError || (isPastedTextTooLarge ? describeTooLarge(new Blob([deferredOtherText]).size) : other && 'error' in other ? other.error : '')

  const comparison = useMemo(() => {
    if (!other || 'error' in other) return null
    const differences = diffJson(root, other.value, ignoreKeyOrder)
    const leftLines = formatWithPaths(root, ignoreKeyOrder).slice(0, MAX_SHOWN_LINES)
    const rightLines = formatWithPaths(other.value, ignoreKeyOrder).slice(0, MAX_SHOWN_LINES)
    const counts = { added: 0, removed: 0, changed: 0, reordered: 0 }
    for (const difference of differences) counts[difference.kind]++
    return { differences, leftLines, rightLines, leftMarks: markLines(leftLines, differences, 'left'), rightMarks: markLines(rightLines, differences, 'right'), counts }
  }, [root, other, ignoreKeyOrder])

  // A JSON Lines file is compared as a list of its lines, as the page opens it.
  async function readChosenFile(file: File | undefined) {
    if (!file) return
    setFileError('')
    setOtherName('')
    setOtherText('')
    if (file.size > MAX_FILE_BYTES) {
      setFileError(describeTooLarge(file.size))
      return
    }
    const text = await file.text()
    if (findJsonSourceFormat(file.name) === 'jsonLines') {
      const converted = await readSourceAsJsonText(text, 'jsonLines')
      if ('message' in converted) {
        setFileError(converted.line === null ? converted.message : t('markup.errorAt', { line: converted.line, message: converted.message }))
        return
      }
      setOtherName(file.name)
      setOtherText(converted.jsonText)
      return
    }
    setOtherName(file.name)
    setOtherText(text)
  }

  // Scrolls both sides to the first line of a difference's node.
  function showDifference(path: JsonPath) {
    const key = getPathKey(path)
    for (const side of ['left', 'right'] as const) {
      const lines = side === 'left' ? comparison?.leftLines : comparison?.rightLines
      const position = lines?.findIndex((line) => getPathKey(line.path) === key) ?? -1
      if (position >= 0) document.getElementById(`compare-${side}-line-${position}`)?.scrollIntoView({ block: 'center' })
    }
  }

  const renderSide = (side: Side, lines: PathLine[], marks: (JsonDifference['kind'] | null)[]) => (
    <div className="cmp-col">
      <p className="cmp-col-title" dir="auto">{t(side === 'left' ? 'json.compare.leftTitle' : 'json.compare.rightTitle')}</p>
    <pre className="cmp-side" id={`compare-${side}`} dir="ltr">
      {lines.map((line, position) => (
        <div key={position} id={`compare-${side}-line-${position}`} className={marks[position] ? `cmp-line ${marks[position]}` : 'cmp-line'}>
          <span className="ln">{position + 1}</span>
          {line.text}
        </div>
      ))}
    </pre>
    </div>
  )

  return (
    <div id="compare-view" className="view">
      <div className="cmp-input">
        <textarea
          id="compare-input"
          dir="ltr"
          spellCheck={false}
          placeholder={t('json.compare.placeholder')}
          aria-label={t('json.compare.inputLabel')}
          value={otherText}
          onChange={(event) => {
            setOtherName('')
            setFileError('')
            setOtherText(event.target.value)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void readChosenFile(event.dataTransfer.files[0])
          }}
        />
        <div className="cmp-actions">
          <input ref={fileInputRef} id="compare-file-input" type="file" accept=".json,.jsonl,.ndjson,.geojson,application/json" hidden onChange={(event) => void readChosenFile(event.target.files?.[0])} />
          <button className="btn sm" type="button" id="compare-choose-button" onClick={() => fileInputRef.current?.click()}>
            {t('json.compare.choose')}
          </button>
          {otherName && <bdi className="cmp-name">{otherName}</bdi>}
          <label className="cmp-check">
            <input type="checkbox" id="compare-ignore-order-checkbox" checked={ignoreKeyOrder} onChange={(event) => setIgnoreKeyOrder(event.target.checked)} />
            {t('json.compare.ignoreKeyOrder')}
          </label>
        </div>
      </div>
      {shownError && (
        <p className="cmp-error" id="compare-error" role="alert" dir="auto">
          {shownError}
        </p>
      )}
      {comparison && (
        <>
          <p className="cmp-summary" id="compare-summary">
            {comparison.differences.length === 0
              ? t('json.compare.same')
              : t('json.compare.summary', { added: comparison.counts.added, removed: comparison.counts.removed, changed: comparison.counts.changed })}
            {comparison.counts.reordered > 0 && ` ${tp('json.compare.reordered', comparison.counts.reordered)}`}
          </p>
          {comparison.differences.length > 0 && (
            <ul className="cmp-list" id="compare-differences">
              {comparison.differences.slice(0, MAX_LISTED_DIFFERENCES).map((difference, position) => (
                <li key={position}>
                  <button type="button" id={`compare-difference-${position}`} className={`cmp-diff ${difference.kind}`} onClick={() => showDifference(difference.path)}>
                    <span className="k">{t(`json.compare.kind.${difference.kind}` as MessageKey)}</span>
                    <code dir="ltr">{formatPathText(difference.path)}</code>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* The open document stays on the left in both languages, like the text it is compared with. */}
          <div className="cmp-sides" dir="ltr">
            {renderSide('left', comparison.leftLines, comparison.leftMarks)}
            {renderSide('right', comparison.rightLines, comparison.rightMarks)}
          </div>
        </>
      )}
    </div>
  )
}
