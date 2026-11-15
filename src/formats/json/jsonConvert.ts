// The JSON page's text conversions written here (no library): XML and TypeScript interfaces. YAML uses js-yaml in the page.
// Pure, so a future "JSON to XML" or "JSON to TypeScript" page can use them too.
import { isBigNumber } from './jsonTools'
import type { JsonValue } from './jsonModel'

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// An XML element name from a key: letters, digits, "_", "-" and "."; it must start with a letter or "_".
const toElementName = (key: string) => {
  const name = key.replace(/[^\p{L}\p{N}_.-]+/gu, '_')
  return /^[\p{L}_]/u.test(name) ? name : `_${name}`
}

// One root element (<root>); an object's keys become child elements, an array becomes repeated elements with the array's own
// name (or <item> inside another array), null an empty element.
export function jsonToXml(value: JsonValue, rootName = 'root') {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>']
  const write = (node: JsonValue, name: string, indent: string) => {
    if (Array.isArray(node)) {
      if (node.length === 0) lines.push(`${indent}<${name}/>`)
      for (const item of node) write(item, Array.isArray(item) ? 'item' : name, indent)
      return
    }
    if (typeof node === 'object' && node !== null && !isBigNumber(node)) {
      const entries = Object.entries(node)
      if (entries.length === 0) {
        lines.push(`${indent}<${name}/>`)
        return
      }
      lines.push(`${indent}<${name}>`)
      for (const [key, child] of entries) write(child, toElementName(key), `${indent}  `)
      lines.push(`${indent}</${name}>`)
      return
    }
    if (node === null) lines.push(`${indent}<${name}/>`)
    else lines.push(`${indent}<${name}>${escapeXml(isBigNumber(node) ? node.rawJSON : String(node))}</${name}>`)
  }
  if (Array.isArray(value)) {
    lines.push(`<${rootName}>`)
    for (const item of value) write(item, 'item', '  ')
    lines.push(`</${rootName}>`)
  } else {
    write(value, rootName, '')
  }
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------- TypeScript

const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/
const toTypeName = (key: string) => {
  const words = key.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  const name = words.map((word) => word[0].toUpperCase() + word.slice(1)).join('') || 'Item'
  return /^\d/.test(name) ? `T${name}` : name
}

// One interface per object shape, named after its key (Root for the document); keys missing from some items of a list are
// optional; mixed values become a union; empty lists are unknown[].
export function jsonToTypeScript(value: JsonValue, rootName = 'Root') {
  const interfaces: string[] = []
  const usedNames = new Set<string>()
  const uniqueName = (base: string) => {
    let name = base
    for (let number = 2; usedNames.has(name); number++) name = `${base}${number}`
    usedNames.add(name)
    return name
  }
  const typeOf = (samples: JsonValue[], name: string): string => {
    const types = new Set<string>()
    const objects = samples.filter((sample) => typeof sample === 'object' && sample !== null && !Array.isArray(sample) && !isBigNumber(sample)) as { [key: string]: JsonValue }[]
    const arrays = samples.filter(Array.isArray) as JsonValue[][]
    for (const sample of samples) {
      if (sample === null) types.add('null')
      else if (isBigNumber(sample) || typeof sample === 'number') types.add('number')
      else if (typeof sample === 'string') types.add('string')
      else if (typeof sample === 'boolean') types.add('boolean')
    }
    if (objects.length > 0) {
      const interfaceName = uniqueName(toTypeName(name))
      const keys = [...new Set(objects.flatMap((object) => Object.keys(object)))]
      const members = keys.map((key) => {
        const present = objects.filter((object) => key in object)
        const property = IDENTIFIER_PATTERN.test(key) ? key : JSON.stringify(key)
        return `  ${property}${present.length < objects.length ? '?' : ''}: ${typeOf(present.map((object) => object[key]), key)}`
      })
      interfaces.push(`export interface ${interfaceName} {\n${members.join('\n')}\n}`)
      types.add(interfaceName)
    }
    if (arrays.length > 0) {
      const items = arrays.flat()
      const itemType = items.length === 0 ? 'unknown' : typeOf(items, name.endsWith('s') ? name.slice(0, -1) : `${name}Item`)
      types.add(itemType.includes('|') ? `(${itemType})[]` : `${itemType}[]`)
    }
    return types.size === 0 ? 'unknown' : [...types].join(' | ')
  }
  const rootType = typeOf([value], rootName)
  // A document that is not an object still gets a name to use.
  if (!usedNames.has(rootName)) interfaces.push(`export type ${rootName} = ${rootType}`)
  return interfaces.reverse().join('\n\n') + '\n'
}
