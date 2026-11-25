// The JSON page's text conversions: XML written here (no library), code types by quicktype-core (Apache-2.0, loaded only when
// asked for), and XML read and rewritten with the browser's own parser (DOMParser: the page only, not a worker). YAML uses
// js-yaml in the page. Used by the JSON viewer's Convert menu, its landing pages (/json-to-xml, /json-to-go ...), XML to JSON
// (src/formats/conversion.ts) and the XML viewer page (src/tools/data/MarkupWorkbench.tsx).
import { readJsonKeepingOrder } from './jsonTools'
import type { OrderedJsonValue } from './jsonTools'
import type { JsonValue } from './jsonModel'

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// An XML element name from a key: letters, digits, "_", "-" and "."; it must start with a letter or "_".
const toElementName = (key: string) => {
  const name = key.replace(/[^\p{L}\p{N}_.-]+/gu, '_')
  return /^[\p{L}_]/u.test(name) ? name : `_${name}`
}

// One root element (<root>); an object's keys become child elements in their written order, an array becomes repeated elements
// with the array's own name (or <item> inside another array), null an empty element. Numbers keep their exact digits.
export function jsonToXml(jsonText: string, rootName = 'root') {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>']
  const write = (node: OrderedJsonValue, name: string, indent: string) => {
    if (Array.isArray(node)) {
      if (node.length === 0) lines.push(`${indent}<${name}/>`)
      for (const item of node) write(item, Array.isArray(item) ? 'item' : name, indent)
      return
    }
    if (typeof node !== 'string') {
      if (node.members.length === 0) {
        lines.push(`${indent}<${name}/>`)
        return
      }
      lines.push(`${indent}<${name}>`)
      for (const member of node.members) write(member.value, toElementName(member.key), `${indent}  `)
      lines.push(`${indent}</${name}>`)
      return
    }
    if (node === 'null') lines.push(`${indent}<${name}/>`)
    else lines.push(`${indent}<${name}>${escapeXml(node.startsWith('"') ? (JSON.parse(node) as string) : node)}</${name}>`)
  }
  const document = readJsonKeepingOrder(jsonText).value
  if (Array.isArray(document)) {
    lines.push(`<${rootName}>`)
    for (const item of document) write(item, 'item', '  ')
    lines.push(`</${rootName}>`)
  } else {
    write(document, rootName, '')
  }
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------- Code types (quicktype-core)

export type CodeLanguage = 'typescript' | 'python' | 'go' | 'java' | 'csharp'
export const codeFileExtensions: Record<CodeLanguage, string> = { typescript: '.ts', python: '.py', go: '.go', java: '.java', csharp: '.cs' }

// Types for the document in one language, inferred from it as a sample: nested objects become their own types, items of a list
// are merged into one type, keys missing from some items are optional. Types only (no parsing helpers), so the code is short.
export async function jsonToCode(jsonText: string, language: CodeLanguage, rootName = 'Root') {
  const { InputData, jsonInputForTargetLanguage, quicktype } = await import('quicktype-core')
  const jsonInput = jsonInputForTargetLanguage(language)
  await jsonInput.addSource({ name: rootName, samples: [jsonText] })
  const inputData = new InputData()
  inputData.addInput(jsonInput)
  const rendererOptions: Record<string, string> = { 'just-types': 'true' }
  if (language === 'csharp') Object.assign(rendererOptions, { framework: 'SystemTextJson', namespace: 'Example' })
  if (language === 'java') rendererOptions.package = 'com.example'
  // Strings stay strings: no guessing dates, numbers, booleans, UUIDs or enums from what a string holds (JSON.parse doesn't).
  const result = await quicktype({ inputData, lang: language, rendererOptions, inferDateTimes: false, inferIntegerStrings: false, inferBooleanStrings: false, inferUuids: false, inferEnums: false })
  return result.lines.join('\n') + '\n'
}

// ---------------------------------------------------------------- XML (the browser's parser)

// The parser's message for XML that is not well-formed ("error on line 3 at column 7: ..."), with its line when it says one.
export function findXmlError(xmlText: string): { message: string; line: number | null } | null {
  const parsedDocument = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parserError = parsedDocument.getElementsByTagName('parsererror')[0]
  if (!parserError) return null
  const message = (parserError.querySelector('div')?.textContent ?? parserError.textContent ?? '').trim()
  const lineMatch = /line (\d+)/i.exec(message)
  return { message, line: lineMatch ? Number(lineMatch[1]) : null }
}

function parseXmlDocument(xmlText: string) {
  const parsedDocument = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (parsedDocument.getElementsByTagName('parsererror').length > 0) throw new Error(findXmlError(xmlText)?.message ?? 'XML')
  return parsedDocument
}

// An element as JSON: attributes as "@name", text as "#text", repeated child elements as a list; an element with only text is
// that text. Comments and processing instructions are left out.
function elementToJsonValue(element: Element): JsonValue {
  const childElements = Array.from(element.children)
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE)
    .map((node) => node.nodeValue ?? '')
    .join('')
    .trim()
  if (childElements.length === 0 && element.attributes.length === 0) return text
  const result: { [key: string]: JsonValue } = {}
  for (const attribute of Array.from(element.attributes)) result[`@${attribute.name}`] = attribute.value
  const repeatedNames = new Set<string>()
  for (const child of childElements) {
    const childValue = elementToJsonValue(child)
    const existing = result[child.nodeName]
    if (existing === undefined) {
      result[child.nodeName] = childValue
    } else if (repeatedNames.has(child.nodeName)) {
      ;(existing as JsonValue[]).push(childValue)
    } else {
      result[child.nodeName] = [existing, childValue]
      repeatedNames.add(child.nodeName)
    }
  }
  if (text) result['#text'] = text
  return result
}

// Throws the parser's message when the XML is not well-formed.
export function xmlToJsonValue(xmlText: string): JsonValue {
  const root = parseXmlDocument(xmlText).documentElement
  return { [root.nodeName]: elementToJsonValue(root) }
}

// The XML again, one element per line indented by `indentUnit`, or on one line when it is '' (Minify). Whitespace-only text
// between elements is dropped and text is trimmed; an element holding only text stays on one line.
export function rewriteXml(xmlText: string, indentUnit: string) {
  const parsedDocument = parseXmlDocument(xmlText)
  const serializer = new XMLSerializer()
  const lines: string[] = []
  const writeNode = (node: Node, indent: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue?.trim() ?? ''
      if (text) lines.push(indent + escapeXml(text).replace(/&quot;/g, '"'))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      lines.push(indent + serializer.serializeToString(node))
      return
    }
    const element = node as Element
    const startTag = `<${element.nodeName}${Array.from(element.attributes).map((attribute) => ` ${attribute.name}="${escapeXml(attribute.value)}"`).join('')}`
    const children = Array.from(element.childNodes).filter((child) => child.nodeType !== Node.TEXT_NODE || child.nodeValue?.trim())
    if (children.length === 0) {
      lines.push(`${indent}${startTag}/>`)
    } else if (children.every((child) => child.nodeType === Node.TEXT_NODE)) {
      lines.push(`${indent}${startTag}>${escapeXml(element.textContent?.trim() ?? '').replace(/&quot;/g, '"')}</${element.nodeName}>`)
    } else {
      lines.push(`${indent}${startTag}>`)
      for (const child of children) writeNode(child, indent + indentUnit)
      lines.push(`${indent}</${element.nodeName}>`)
    }
  }
  if (/^\s*<\?xml/.test(xmlText)) lines.push(/^\s*(<\?xml[^?]*\?>)/.exec(xmlText)?.[1] ?? '')
  for (const node of Array.from(parsedDocument.childNodes)) writeNode(node, '')
  return indentUnit === '' ? lines.join('') : lines.join('\n') + '\n'
}
