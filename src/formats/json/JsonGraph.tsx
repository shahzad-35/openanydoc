import { useMemo, useState } from 'react'
import { Background, Controls, Handle, MiniMap, Position, ReactFlow } from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useT } from '../../i18n'
import { downloadTextFile } from '../registry'
import { formatValueText, isBigNumber } from './jsonTools'
import { getNodeAt, getPathKey } from './jsonModel'
import type { JsonPath, JsonValue } from './jsonModel'

// The graph view of the JSON page: every object and array is a box listing its simple fields, joined to the boxes of the objects
// and arrays inside it; pan, zoom and the minimap come from React Flow (@xyflow/react, MIT). The layout is a plain tidy tree
// (columns by depth, rows in document order). Export draws the same layout as SVG (and PNG from it) here, so nothing is fetched.

const MAX_BOXES = 1500
const MAX_FIELDS_SHOWN = 12
const BOX_WIDTH = 240
const COLUMN_GAP = 80
const ROW_GAP = 24
const LINE_HEIGHT = 18
const BOX_PADDING = 10

type GraphBox = { id: string; path: JsonPath; title: string; fields: string[]; moreCount: number; x: number; y: number; height: number }
type GraphLayout = { boxes: GraphBox[]; links: { from: string; to: string }[]; isCut: boolean }

const isContainerValue = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } => typeof value === 'object' && value !== null && !isBigNumber(value)

function layOutGraph(root: JsonValue, rootPath: JsonPath): GraphLayout {
  const boxes: GraphBox[] = []
  const links: { from: string; to: string }[] = []
  let nextFreeY = 0
  let isCut = false
  const place = (value: JsonValue, path: JsonPath, depth: number, title: string): GraphBox | null => {
    if (!isContainerValue(value)) return null
    if (boxes.length >= MAX_BOXES) {
      isCut = true
      return null
    }
    const entries: [string | number, JsonValue][] = Array.isArray(value) ? value.map((child, position) => [position, child]) : Object.entries(value)
    const simpleEntries = entries.filter(([, child]) => !isContainerValue(child))
    const fields = simpleEntries.slice(0, MAX_FIELDS_SHOWN).map(([step, child]) => `${step}: ${formatValueText(child)}`)
    const box: GraphBox = {
      id: getPathKey(path),
      path,
      title: `${title} ${Array.isArray(value) ? `[${value.length}]` : `{${entries.length}}`}`,
      fields,
      moreCount: simpleEntries.length - fields.length,
      x: depth * (BOX_WIDTH + COLUMN_GAP),
      y: 0,
      height: BOX_PADDING * 2 + LINE_HEIGHT * (1 + fields.length + (simpleEntries.length > fields.length ? 1 : 0)),
    }
    boxes.push(box)
    const children = entries.filter(([, child]) => isContainerValue(child)).map(([step, child]) => place(child, [...path, step], depth + 1, String(step))).filter((child): child is GraphBox => child !== null)
    for (const child of children) links.push({ from: box.id, to: child.id })
    // A box sits level with its first child; a box with no child takes the next free row.
    box.y = children.length > 0 ? children[0].y : nextFreeY
    nextFreeY = Math.max(nextFreeY, box.y + box.height + ROW_GAP)
    return box
  }
  const rootValue = getNodeAt(root, rootPath)
  place(rootValue, rootPath, 0, rootPath.length === 0 ? '$' : String(rootPath[rootPath.length - 1]))
  return { boxes, links, isCut }
}

function JsonBoxNode({ data, selected }: NodeProps<Node<{ box: GraphBox }>>) {
  const { box } = data
  return (
    <div className={`jg-box${selected ? ' selected' : ''}`} dir="ltr">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="jg-title">{box.title}</div>
      {box.fields.map((field, position) => (
        <div key={position} className="jg-field">
          {field}
        </div>
      ))}
      {box.moreCount > 0 && <div className="jg-more">+{box.moreCount}</div>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}
const nodeTypes = { jsonBox: JsonBoxNode }

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const shorten = (text: string) => (text.length > 34 ? `${text.slice(0, 33)}…` : text)

// The layout as an SVG picture: boxes, their text and the links, in fixed light colours so it reads anywhere.
function buildGraphSvg(layout: GraphLayout) {
  const width = Math.max(...layout.boxes.map((box) => box.x + BOX_WIDTH)) + 20
  const height = Math.max(...layout.boxes.map((box) => box.y + box.height)) + 20
  const byId = new Map(layout.boxes.map((box) => [box.id, box]))
  const linkPaths = layout.links.map(({ from, to }) => {
    const source = byId.get(from) as GraphBox
    const target = byId.get(to) as GraphBox
    const startX = source.x + BOX_WIDTH + 10
    const startY = source.y + 10 + LINE_HEIGHT / 2 + BOX_PADDING
    const endX = target.x + 10
    const endY = target.y + 10 + LINE_HEIGHT / 2 + BOX_PADDING
    return `<path d="M${startX} ${startY} C${startX + 40} ${startY} ${endX - 40} ${endY} ${endX} ${endY}" fill="none" stroke="#9aa3b2" stroke-width="1.5"/>`
  })
  const boxShapes = layout.boxes.map((box) => {
    const lines = [box.title, ...box.fields, ...(box.moreCount > 0 ? [`+${box.moreCount}`] : [])]
    const texts = lines.map((line, position) => `<text x="${box.x + 10 + BOX_PADDING}" y="${box.y + 10 + BOX_PADDING + 13 + position * LINE_HEIGHT}" ${position === 0 ? 'font-weight="600" fill="#1b1f27"' : 'fill="#3d4452"'}>${escapeXml(shorten(line))}</text>`)
    return `<rect x="${box.x + 10}" y="${box.y + 10}" width="${BOX_WIDTH}" height="${box.height}" rx="8" fill="#ffffff" stroke="#c9cfd9"/>${texts.join('')}`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12"><rect width="100%" height="100%" fill="#f6f7f9"/>${linkPaths.join('')}${boxShapes.join('')}</svg>`
}

// The SVG drawn on a canvas at twice its size, saved as PNG. The picture is a blob: address (allowed by the page's policy).
async function buildGraphPng(svgText: string): Promise<Blob> {
  const svgAddress = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }))
  try {
    const picture = new Image()
    picture.src = svgAddress
    await picture.decode()
    const canvas = document.createElement('canvas')
    canvas.width = picture.naturalWidth * 2
    canvas.height = picture.naturalHeight * 2
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.scale(2, 2)
    context.drawImage(picture, 0, 0)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(svgAddress)
  }
}

export default function JsonGraph({ root, selectedPath, onSelectPath, fileName }: { root: JsonValue; selectedPath: JsonPath | null; onSelectPath: (path: JsonPath) => void; fileName: string }) {
  const { t } = useT()
  const [graphRootPath, setGraphRootPath] = useState<JsonPath>([])
  const layout = useMemo(() => layOutGraph(root, isContainerValue(getNodeAt(root, graphRootPath) ?? null) ? graphRootPath : []), [root, graphRootPath])
  const selectedKey = selectedPath === null ? null : getPathKey(selectedPath)
  const nodes: Node<{ box: GraphBox }>[] = useMemo(() => layout.boxes.map((box) => ({ id: box.id, type: 'jsonBox', position: { x: box.x, y: box.y }, data: { box }, selected: box.id === selectedKey, draggable: false })), [layout, selectedKey])
  const edges: Edge[] = useMemo(() => layout.links.map((link) => ({ id: `${link.from}>${link.to}`, source: link.from, target: link.to })), [layout])
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const selectedIsContainer = selectedPath !== null && isContainerValue(getNodeAt(root, selectedPath) ?? null)

  async function exportPicture(kind: 'svg' | 'png') {
    const svgText = buildGraphSvg(layout)
    if (kind === 'svg') downloadTextFile(`${baseName}-graph.svg`, svgText, 'image/svg+xml')
    else downloadTextFile(`${baseName}-graph.png`, await buildGraphPng(svgText), 'image/png')
  }

  return (
    <div id="graph-view" className="view">
      <div className="jg-bar">
        <button className="btn sm" type="button" id="graph-from-selected-button" disabled={!selectedIsContainer} onClick={() => selectedPath && setGraphRootPath(selectedPath)}>
          {t('json.graph.fromSelected')}
        </button>
        {graphRootPath.length > 0 && (
          <button className="btn sm" type="button" id="graph-whole-button" onClick={() => setGraphRootPath([])}>
            {t('json.graph.whole')}
          </button>
        )}
        <span className="spacer" />
        <button className="btn sm" type="button" id="graph-export-svg-button" disabled={layout.boxes.length === 0} onClick={() => void exportPicture('svg')}>
          {t('json.graph.exportSvg')}
        </button>
        <button className="btn sm" type="button" id="graph-export-png-button" disabled={layout.boxes.length === 0} onClick={() => void exportPicture('png')}>
          {t('json.graph.exportPng')}
        </button>
      </div>
      {layout.isCut && (
        <p className="jg-note" id="graph-cut-note">
          {t('json.graph.cut', { count: MAX_BOXES })}
        </p>
      )}
      {layout.boxes.length === 0 ? (
        <p className="empty">{t('json.graph.noContainers')}</p>
      ) : (
        <div className="jg-canvas" dir="ltr">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.05}
            nodesConnectable={false}
            nodesDraggable={false}
            onNodeClick={(_, node) => onSelectPath((node.data as { box: GraphBox }).box.path)}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      )}
    </div>
  )
}
