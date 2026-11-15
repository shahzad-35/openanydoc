// JSON Schema on the JSON page: checking the document against a schema with @cfworker/json-schema (MIT; it checks without writing
// code at run time, so the page's Content-Security-Policy needs no 'unsafe-eval', which Ajv would), and writing a schema that
// describes the document. Pure; loaded with the Schema panel.
import { Validator } from '@cfworker/json-schema'
import type { Schema, SchemaDraft } from '@cfworker/json-schema'
import { isBigNumber, pointerToPath, toPlainJson } from './jsonTools'
import type { JsonPath, JsonValue } from './jsonModel'

export type SchemaError = { path: JsonPath; message: string; keyword: string }

const PARENT_KEYWORDS = new Set(['properties', 'items', 'prefixItems', 'additionalProperties', 'allOf', '$ref', 'dependentSchemas'])
const DRAFTS: [string, SchemaDraft][] = [['draft-04', '4'], ['draft-07', '7'], ['2019-09', '2019-09'], ['2020-12', '2020-12']]

// The schema's draft from its $schema address, else 2020-12. Errors are the most specific ones (the leaves), each with the path of
// the node it is about.
export function validateWithSchema(value: JsonValue, schema: object): SchemaError[] {
  const schemaAddress = (schema as { $schema?: string }).$schema ?? ''
  const draft = DRAFTS.find(([marker]) => schemaAddress.includes(marker))?.[1] ?? '2020-12'
  const document = toPlainJson(value)
  const result = new Validator(schema as Schema, draft, false).validate(document)
  if (result.valid) return []
  // The validator also reports each failing parent keyword ("properties", "items" ...); only the ones it found the cause in stay.
  const leafErrors = result.errors.filter((error) => !PARENT_KEYWORDS.has(error.keyword))
  return (leafErrors.length > 0 ? leafErrors : result.errors).map((error) => ({ path: pointerToPath(error.instanceLocation, document), message: error.error, keyword: error.keyword }))
}

// ---------------------------------------------------------------- writing a schema

type GeneratedSchema = Record<string, unknown>
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URI_PATTERN = /^https?:\/\/\S+$/

function typeOfValue(value: JsonValue): string {
  if (value === null) return 'null'
  if (isBigNumber(value)) return 'number'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

// One schema that fits every sample: types merged (integer folds into number), object properties merged with `required` holding
// the keys every sample has, array items merged, and a string format only when every sample fits it.
function describeSamples(samples: JsonValue[]): GeneratedSchema {
  const types = new Set(samples.map(typeOfValue))
  if (types.has('integer') && types.has('number')) types.delete('integer')
  const schema: GeneratedSchema = { type: types.size === 1 ? [...types][0] : [...types] }
  const objects = samples.filter((sample) => typeOfValue(sample) === 'object') as { [key: string]: JsonValue }[]
  if (objects.length > 0) {
    const keys = [...new Set(objects.flatMap((object) => Object.keys(object)))]
    schema.properties = Object.fromEntries(keys.map((key) => [key, describeSamples(objects.filter((object) => key in object).map((object) => object[key]))]))
    const required = keys.filter((key) => objects.every((object) => key in object))
    if (required.length > 0) schema.required = required
  }
  const arrays = samples.filter(Array.isArray) as JsonValue[][]
  const items = arrays.flat()
  if (arrays.length > 0 && items.length > 0) schema.items = describeSamples(items)
  const strings = samples.filter((sample): sample is string => typeof sample === 'string')
  if (strings.length > 0 && strings.length === samples.length) {
    const format = strings.every((text) => DATE_TIME_PATTERN.test(text)) ? 'date-time' : strings.every((text) => DATE_PATTERN.test(text)) ? 'date' : strings.every((text) => EMAIL_PATTERN.test(text)) ? 'email' : strings.every((text) => URI_PATTERN.test(text)) ? 'uri' : null
    if (format) schema.format = format
  }
  return schema
}

export function generateSchema(value: JsonValue): GeneratedSchema {
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...describeSamples([value]) }
}
