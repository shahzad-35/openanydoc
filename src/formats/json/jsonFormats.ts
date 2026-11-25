// The files the JSON page opens besides .json: JSON Lines (.jsonl, .ndjson), JSON5 and YAML are turned into JSON text when they
// are read (in the parse worker, which fetches this module only for them), and GeoJSON is plain JSON the page also summarises.
// Pure functions, so a future converter page can use them too.
import type { JsonValue } from './jsonModel'
import { readJsonKeepingOrder, writeJsonKeepingOrder } from './jsonTools'
import type { OrderedJsonValue } from './jsonTools'

export type JsonSourceFormat = 'json' | 'jsonLines' | 'json5' | 'yaml'

// YAML aliases (*name) reuse a value, so a 500-byte file can stand for billions of values; reading it is cheap, but anything that
// walks it (JSON text, tables, the tree) hangs. Counts the values a full walk would visit and stops past the limit.
export const YAML_TOO_LARGE_MESSAGE = 'This YAML repeats its aliases so many times that it would expand to more than a million values.'
export function isYamlWithinSizeLimit(value: unknown, limit = 1_000_000) {
  let visited = 0
  const pending: unknown[] = [value]
  while (pending.length > 0) {
    const current = pending.pop()
    if (++visited > limit) return false
    if (current instanceof Map) for (const child of current.values()) pending.push(child)
    else if (current !== null && typeof current === 'object') for (const child of Object.values(current)) pending.push(child)
  }
  return true
}

export function findJsonSourceFormat(fileName: string): JsonSourceFormat {
  const lowerCaseName = fileName.toLowerCase()
  if (lowerCaseName.endsWith('.jsonl') || lowerCaseName.endsWith('.ndjson')) return 'jsonLines'
  if (lowerCaseName.endsWith('.json5')) return 'json5'
  if (lowerCaseName.endsWith('.yaml') || lowerCaseName.endsWith('.yml')) return 'yaml'
  return 'json'
}

// The file's text as JSON text, or why it could not be read (with the line, when known).
export async function readSourceAsJsonText(text: string, format: Exclude<JsonSourceFormat, 'json'>): Promise<{ jsonText: string } | { message: string; line: number | null }> {
  if (format === 'jsonLines') {
    // Each line is kept as written (so long numbers stay exact); blank lines are skipped.
    const items: string[] = []
    const lines = text.split(/\r?\n/)
    for (let position = 0; position < lines.length; position++) {
      const line = lines[position].trim()
      if (line === '') continue
      try {
        JSON.parse(line)
      } catch (error) {
        return { message: error instanceof Error ? error.message : String(error), line: position + 1 }
      }
      items.push(`  ${line}`)
    }
    return { jsonText: `[\n${items.join(',\n')}\n]` }
  }
  try {
    if (format === 'json5') {
      const JSON5 = (await import('json5')).default
      return { jsonText: JSON.stringify(JSON5.parse(text), null, 2) }
    }
    // Mappings are read as Maps, which keep keys like "2024" in their written place (a plain object puts them first).
    const { CORE_SCHEMA, load, realMapTag } = await import('js-yaml')
    const value = load(text, { schema: CORE_SCHEMA.withTags(realMapTag) }) ?? null
    if (!isYamlWithinSizeLimit(value)) return { message: YAML_TOO_LARGE_MESSAGE, line: null }
    return { jsonText: writeJsonKeepingOrder(toOrderedJson(value), 2) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // json5 and js-yaml both name the line in their messages ("at 3:5", "(3:5)").
    const lineMatch = /(?:at |\()(\d+):\d+/.exec(message)
    return { message, line: lineMatch ? Number(lineMatch[1]) : null }
  }
}

// A value read from YAML, with Maps for its mappings, as the document the JSON writer takes.
function toOrderedJson(value: unknown): OrderedJsonValue {
  if (value instanceof Map) return { members: [...value].map(([key, child]) => ({ key: String(key), keyText: JSON.stringify(String(key)), value: toOrderedJson(child) })) }
  if (Array.isArray(value)) return value.map(toOrderedJson)
  return JSON.stringify(value) ?? 'null'
}

// A JSON array's text as JSON Lines: one item per line, no indentation, keys in their written order.
export function buildJsonLines(jsonText: string) {
  const document = readJsonKeepingOrder(jsonText).value
  const items = Array.isArray(document) ? document : [document]
  return items.map((item) => writeJsonKeepingOrder(item, 0)).join('\n') + '\n'
}

// ---------------------------------------------------------------- GeoJSON

type GeoFeature = { type: 'Feature'; geometry?: { type?: string; coordinates?: unknown } | null; properties?: Record<string, JsonValue> | null }
export type GeoJsonSummary = {
  featureCount: number
  geometryCounts: [string, number][]
  propertyNames: string[]
  rows: JsonValue[][]
  // West, south, east, north; null when no geometry has coordinates.
  bounds: [number, number, number, number] | null
}

function readFeatures(value: JsonValue): GeoFeature[] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const object = value as Record<string, JsonValue>
  if (object.type === 'FeatureCollection' && Array.isArray(object.features)) return object.features as unknown as GeoFeature[]
  if (object.type === 'Feature') return [object as unknown as GeoFeature]
  return null
}

export function isGeoJson(value: JsonValue | null) {
  return value !== null && readFeatures(value) !== null
}

// The feature count, the geometry types, every property in one table (a row per feature) and the bounding box.
export function summarizeGeoJson(value: JsonValue): GeoJsonSummary | null {
  const features = readFeatures(value)
  if (!features) return null
  const geometryCounts = new Map<string, number>()
  const propertyNames: string[] = []
  const seenNames = new Set<string>()
  let bounds: [number, number, number, number] | null = null
  const widenBounds = (coordinates: unknown) => {
    if (!Array.isArray(coordinates)) return
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const [longitude, latitude] = coordinates as number[]
      bounds = bounds ? [Math.min(bounds[0], longitude), Math.min(bounds[1], latitude), Math.max(bounds[2], longitude), Math.max(bounds[3], latitude)] : [longitude, latitude, longitude, latitude]
      return
    }
    for (const inner of coordinates) widenBounds(inner)
  }
  for (const feature of features) {
    const geometryType = feature?.geometry?.type ?? 'none'
    geometryCounts.set(geometryType, (geometryCounts.get(geometryType) ?? 0) + 1)
    widenBounds(feature?.geometry?.coordinates)
    for (const name of Object.keys(feature?.properties ?? {})) {
      if (!seenNames.has(name)) {
        seenNames.add(name)
        propertyNames.push(name)
      }
    }
  }
  const rows = features.map((feature) => propertyNames.map((name) => feature?.properties?.[name] ?? null))
  return { featureCount: features.length, geometryCounts: [...geometryCounts.entries()], propertyNames, rows, bounds }
}
