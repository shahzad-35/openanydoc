// The files the JSON page opens besides .json: JSON Lines (.jsonl, .ndjson), JSON5 and YAML are turned into JSON text when they
// are read (in the parse worker, which fetches this module only for them), and GeoJSON is plain JSON the page also summarises.
// Pure functions, so a future converter page can use them too.
import type { JsonValue } from './jsonModel'

export type JsonSourceFormat = 'json' | 'jsonLines' | 'json5' | 'yaml'

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
    const { load } = await import('js-yaml')
    return { jsonText: JSON.stringify(load(text) ?? null, null, 2) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // json5 and js-yaml both name the line in their messages ("at 3:5", "(3:5)").
    const lineMatch = /(?:at |\()(\d+):\d+/.exec(message)
    return { message, line: lineMatch ? Number(lineMatch[1]) : null }
  }
}

// An array as JSON Lines: one item per line, no indentation.
export function buildJsonLines(value: JsonValue) {
  const items = Array.isArray(value) ? value : [value]
  return items.map((item) => JSON.stringify(item)).join('\n') + '\n'
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
