import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { isolateText, useT } from '../../i18n'
import { flattenVisibleNodes, getChildEntries, getPathKey, isContainer } from './jsonModel'
import { formatValueText, getTypeName, getValueClassName, isBigNumber } from './jsonTools'
import type { JsonPath, JsonValue, TreeRow } from './jsonModel'

const ROW_HEIGHT_PX = window.matchMedia('(max-width: 760px)').matches ? 32 : 26
const PREVIEW_CHILD_COUNT = 3

export type TreeRowAction = 'add' | 'duplicate' | 'up' | 'down' | 'delete'

type JsonTreeProps = {
  root: JsonValue
  expandedKeys: ReadonlySet<string>
  onToggleExpanded: (pathKey: string) => void
  // Lower-case text to mark, and the rows that match it.
  searchText: string
  matchPathKeys: ReadonlySet<string>
  selectedPathKey: string | null
  onSelectPath: (path: JsonPath) => void
  // A row to scroll into view, e.g. the node under the cursor in the text.
  revealPathKey: string | null
  showTypes: boolean
  showIndexes: boolean
  // Dimmed while the text has an error and the tree shows the last valid version.
  isStale: boolean
  getLine: (pathKey: string) => number | null
  onRowAction: (action: TreeRowAction, row: TreeRow) => void
}

// The first place the search text appears, in a <mark>.
function MarkedText({ text, searchText }: { text: string; searchText: string }) {
  const matchStart = searchText === '' ? -1 : text.toLowerCase().indexOf(searchText)
  if (matchStart === -1) return <>{text}</>
  const matchEnd = matchStart + searchText.length
  return (
    <>
      {text.slice(0, matchStart)}
      <mark>{text.slice(matchStart, matchEnd)}</mark>
      {text.slice(matchEnd)}
    </>
  )
}

// "{3}  city: "Lahore", country: "PK", …" for a closed object; the first children, written short.
function ContainerPreview({ container, childCount }: { container: JsonValue[] | { [key: string]: JsonValue }; childCount: number }) {
  const isObject = !Array.isArray(container)
  const firstEntries = Array.isArray(container) ? getChildEntries(container.slice(0, PREVIEW_CHILD_COUNT)) : Object.keys(container).slice(0, PREVIEW_CHILD_COUNT).map((key): [string, JsonValue] => [key, container[key]])
  const parts: ReactNode[] = firstEntries.map(([label, child], position) => (
    <span key={label}>
      {position > 0 && ', '}
      {isObject && <b>{label}</b>}
      {isObject && ': '}
      {isContainer(child) ? (Array.isArray(child) ? `[${child.length}]` : '{…}') : formatValueText(child)}
    </span>
  ))
  return (
    <>
      {parts}
      {childCount > PREVIEW_CHILD_COUNT && ', …'}
    </>
  )
}

function SmallIcon({ name }: { name: string }) {
  return (
    <svg className="ico sm" aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  )
}

// The document as a collapsible tree, drawn with the studio's row markup. Only the rows on screen are drawn. Each row has
// buttons (shown on hover and on the selected row) to add, duplicate, move and delete; the viewer makes the changes.
export default function JsonTree({ root, expandedKeys, onToggleExpanded, searchText, matchPathKeys, selectedPathKey, onSelectPath, revealPathKey, showTypes, showIndexes, isStale, getLine, onRowAction }: JsonTreeProps) {
  const { t } = useT()
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

  const revealRowPosition = revealPathKey === null ? -1 : rows.findIndex((row) => row.pathKey === revealPathKey)
  useEffect(() => {
    if (revealRowPosition !== -1) rowVirtualizer.scrollToIndex(revealRowPosition, { align: 'auto' })
    // Only when the row to reveal changes or appears (after its parents open).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [revealPathKey, revealRowPosition !== -1])

  const selectedPosition = selectedPathKey === null ? -1 : rows.findIndex((row) => row.pathKey === selectedPathKey)

  // Arrow keys like a file tree: Up and Down move, Right opens a node or steps into it, Left closes it or steps out.
  function handleTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || rows.length === 0) return
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
    } else if (event.key === 'Delete' && selectedRow && selectedRow.path.length > 0) {
      onRowAction('delete', selectedRow)
    } else return
    event.preventDefault()
    if (newPosition < 0 || newPosition >= rows.length || newPosition === selectedPosition) return
    onSelectPath(rows[newPosition].path)
    rowVirtualizer.scrollToIndex(newPosition)
  }

  return (
    <div
      id="tree-view"
      ref={scrollContainerRef}
      dir="ltr"
      role="tree"
      aria-label={t('json.tree.label')}
      aria-activedescendant={selectedPosition === -1 ? undefined : `tree-row-${selectedPosition}`}
      tabIndex={0}
      onKeyDown={handleTreeKeyDown}
      className={`view${showTypes ? '' : ' no-types'}${isStale ? ' dim' : ''}`}
    >
      <div className="tree-rows" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          const rowId = virtualRow.index
          const isExpanded = expandedKeys.has(row.pathKey)
          const isSelected = row.pathKey === selectedPathKey
          const isRoot = row.path.length === 0
          const rowName = row.label === null ? t('json.tree.root') : isolateText(String(row.label))
          const line = isSelected ? getLine(row.pathKey) : null
          const childCount = isContainer(row.value) ? (Array.isArray(row.value) ? row.value.length : Object.keys(row.value).length) : 0
          return (
            <div
              key={row.pathKey}
              id={`tree-row-${rowId}`}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-selected={isSelected}
              aria-expanded={isContainer(row.value) ? isExpanded : undefined}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return
                onSelectPath(row.path)
                scrollContainerRef.current?.focus({ preventScroll: true })
              }}
              className={`row${isSelected ? ' sel' : ''}${matchPathKeys.has(row.pathKey) ? ' match' : ''}`}
              style={{ '--d': row.depth, top: virtualRow.start } as CSSProperties}
            >
              {isContainer(row.value) ? (
                <button
                  id={`tree-toggle-${rowId}`}
                  className="tw"
                  type="button"
                  tabIndex={-1}
                  aria-label={t(isExpanded ? 'json.tree.collapse' : 'json.tree.expand', { name: rowName })}
                  aria-expanded={isExpanded}
                  onClick={() => onToggleExpanded(row.pathKey)}
                >
                  <SmallIcon name="chev-right" />
                </button>
              ) : (
                <span className="tw-gap" />
              )}
              {isRoot ? (
                <span className="tk root">{t('json.tree.root')}</span>
              ) : typeof row.label === 'number' ? (
                showIndexes && (
                  <span className="ti">
                    {row.label}
                    <span className="colon">:</span>
                  </span>
                )
              ) : (
                <span className="tk">
                  <MarkedText text={String(row.label)} searchText={searchText} />
                  <span className="colon">:</span>
                </span>
              )}
              {isContainer(row.value) ? (
                <span className="sum">
                  {Array.isArray(row.value) ? `[${childCount}]` : `{${childCount}}`}
                  {!isExpanded && childCount > 0 && (
                    <>
                      {'\u2002'}
                      <ContainerPreview container={row.value} childCount={childCount} />
                    </>
                  )}
                </span>
              ) : (
                <span className={`tv ${getValueClassName(row.value)}`}>
                  <MarkedText text={formatValueText(row.value)} searchText={searchText} />
                </span>
              )}
              {isBigNumber(row.value) && (
                <span className="badge big" title={t('json.wb.bigTip')}>
                  {t('json.wb.big')}
                  <span className="long">{t('json.wb.bigRest')}</span>
                </span>
              )}
              {showTypes && <span className="ty">{getTypeName(row.value)}</span>}
              {line !== null && <span className="ln-ref">L{line}</span>}
              <span className="acts">
                <button id={`tree-add-${rowId}`} type="button" tabIndex={-1} aria-label={t(isContainer(row.value) ? 'json.wb.addChild' : 'json.wb.addAfter')} title={t(isContainer(row.value) ? 'json.wb.addChild' : 'json.wb.addAfter')} onClick={() => onRowAction('add', row)}>
                  <SmallIcon name="plus" />
                </button>
                <button id={`tree-duplicate-${rowId}`} type="button" tabIndex={-1} aria-label={t('json.details.duplicate')} title={t('json.details.duplicate')} disabled={isRoot} onClick={() => onRowAction('duplicate', row)}>
                  <SmallIcon name="dup" />
                </button>
                <button id={`tree-move-up-${rowId}`} type="button" tabIndex={-1} aria-label={t('json.wb.moveUp')} title={t('json.wb.moveUp')} disabled={isRoot || row.position === 0} onClick={() => onRowAction('up', row)}>
                  <SmallIcon name="up" />
                </button>
                <button id={`tree-move-down-${rowId}`} type="button" tabIndex={-1} aria-label={t('json.wb.moveDown')} title={t('json.wb.moveDown')} disabled={isRoot || row.position === row.siblingCount - 1} onClick={() => onRowAction('down', row)}>
                  <SmallIcon name="down" />
                </button>
                <button id={`tree-delete-${rowId}`} className="del" type="button" tabIndex={-1} aria-label={t('json.details.delete')} title={t('json.details.delete')} disabled={isRoot} onClick={() => onRowAction('delete', row)}>
                  <SmallIcon name="trash" />
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
