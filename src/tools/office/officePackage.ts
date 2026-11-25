// Reading and changing Office files (.docx, .xlsx, .pptx) as what they are: ZIP packages of XML parts tied together by
// relationship files and listed in [Content_Types].xml. The Word, Excel and PowerPoint tools edit the parts they need and leave
// everything else byte for byte as it was, so the result opens in Office without a repair. Runs on the page (DOMParser is not
// available in workers).
import JSZip from 'jszip'
import { runPdfTask } from '../pdf/pdfTasks'

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
const RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CONTENT_TYPES_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/content-types'
export const RELATIONSHIP_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const CUSTOM_PROPERTIES_TYPE = `${RELATIONSHIP_TYPE}/custom-properties`

export type Relationship = { id: string; type: string; target: string; isExternal: boolean }

export const WORD_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const POWERPOINT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

// A file saved by an old Office version, or an Office file encrypted with a password to open, is a compound file, not a ZIP.
export const isCompoundFile = (bytes: ArrayBuffer) => {
  const start = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  return start[0] === 0xd0 && start[1] === 0xcf && start[2] === 0x11 && start[3] === 0xe0
}

export async function readXmlPart(zip: JSZip, partPath: string) {
  const text = await zip.file(partPath)?.async('string')
  if (text === undefined) return null
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length > 0) throw new Error(`${partPath} is not well-formed`)
  return xml
}

export function writeXmlPart(zip: JSZip, partPath: string, xml: XMLDocument) {
  zip.file(partPath, XML_DECLARATION + new XMLSerializer().serializeToString(xml.documentElement))
}

// Elements written as XML text, made in `xml`'s own namespaces (declared on its root), so they serialize without new
// namespace declarations inside the part.
export function parseXmlElements(xml: XMLDocument, snippet: string) {
  const root = xml.documentElement
  const declarations = Array.from(root.attributes).filter((attribute) => attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:'))
  const wrapper = new DOMParser().parseFromString(`<wrapper ${declarations.map((attribute) => `${attribute.name}="${attribute.value}"`).join(' ')}>${snippet}</wrapper>`, 'application/xml')
  if (wrapper.getElementsByTagName('parsererror').length > 0) throw new Error('The XML snippet is not well-formed')
  return Array.from(wrapper.documentElement.children, (element) => xml.importNode(element, true) as Element)
}

// Adds namespace declarations to a part's root (a header that will hold a VML watermark needs v:, o: and w10:).
export function declareNamespaces(xml: XMLDocument, namespaces: Record<string, string>) {
  for (const [prefix, namespace] of Object.entries(namespaces)) {
    if (!xml.documentElement.hasAttribute(`xmlns:${prefix}`)) xml.documentElement.setAttributeNS('http://www.w3.org/2000/xmlns/', `xmlns:${prefix}`, namespace)
  }
}

export const escapeXmlText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------- paths and relationships

const folderOf = (partPath: string) => partPath.slice(0, partPath.lastIndexOf('/') + 1)
export const relationshipsPathOf = (partPath: string) => (partPath === '' ? '_rels/.rels' : `${folderOf(partPath)}_rels/${partPath.slice(partPath.lastIndexOf('/') + 1)}.rels`)

// A relationship's target as a path in the package ("../media/image1.png" from "word/document.xml" is "word/media/image1.png").
export function resolveTarget(partPath: string, target: string) {
  const parts = (target.startsWith('/') ? target.slice(1) : folderOf(partPath) + target).split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part !== '.' && part !== '') resolved.push(part)
  }
  return resolved.join('/')
}

function relativeTarget(fromPartPath: string, toPartPath: string) {
  const fromFolders = folderOf(fromPartPath).split('/').filter(Boolean)
  const toParts = toPartPath.split('/')
  let shared = 0
  while (shared < fromFolders.length && shared < toParts.length - 1 && fromFolders[shared] === toParts[shared]) shared++
  return [...fromFolders.slice(shared).map(() => '..'), ...toParts.slice(shared)].join('/')
}

export async function readRelationships(zip: JSZip, partPath: string): Promise<Relationship[]> {
  const xml = await readXmlPart(zip, relationshipsPathOf(partPath))
  if (!xml) return []
  return Array.from(xml.getElementsByTagNameNS(RELATIONSHIPS_NAMESPACE, 'Relationship'), (element) => ({
    id: element.getAttribute('Id') ?? '',
    type: element.getAttribute('Type') ?? '',
    target: element.getAttribute('Target') ?? '',
    isExternal: element.getAttribute('TargetMode') === 'External',
  }))
}

async function writeRelationships(zip: JSZip, partPath: string, relationships: Relationship[]) {
  const lines = relationships.map((relationship) => `<Relationship Id="${escapeXmlText(relationship.id)}" Type="${escapeXmlText(relationship.type)}" Target="${escapeXmlText(relationship.target)}"${relationship.isExternal ? ' TargetMode="External"' : ''}/>`)
  zip.file(relationshipsPathOf(partPath), `${XML_DECLARATION}<Relationships xmlns="${RELATIONSHIPS_NAMESPACE}">${lines.join('')}</Relationships>`)
}

// Adds a relationship from `partPath` and returns its new id (one more than the highest rIdN in use).
export async function addRelationship(zip: JSZip, partPath: string, type: string, target: string, isExternal = false) {
  const relationships = await readRelationships(zip, partPath)
  const highest = Math.max(0, ...relationships.map((relationship) => Number(/^rId(\d+)$/.exec(relationship.id)?.[1] ?? 0)))
  const id = `rId${highest + 1}`
  await writeRelationships(zip, partPath, [...relationships, { id, type, target, isExternal }])
  return id
}

export async function removeRelationships(zip: JSZip, partPath: string, shouldRemove: (relationship: Relationship) => boolean) {
  const relationships = await readRelationships(zip, partPath)
  const kept = relationships.filter((relationship) => !shouldRemove(relationship))
  if (kept.length !== relationships.length) await writeRelationships(zip, partPath, kept)
  return relationships.filter((relationship) => !kept.includes(relationship))
}

// ---------------------------------------------------------------- content types

async function readContentTypes(zip: JSZip) {
  const xml = await readXmlPart(zip, '[Content_Types].xml')
  if (!xml) throw new Error('This is not an Office file')
  return xml
}

export async function contentTypeOf(zip: JSZip, partPath: string) {
  const xml = await readContentTypes(zip)
  const override = Array.from(xml.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, 'Override')).find((element) => element.getAttribute('PartName') === `/${partPath}`)
  if (override) return { contentType: override.getAttribute('ContentType') ?? '', isDefault: false }
  const extension = partPath.slice(partPath.lastIndexOf('.') + 1).toLowerCase()
  const fallback = Array.from(xml.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, 'Default')).find((element) => element.getAttribute('Extension')?.toLowerCase() === extension)
  return { contentType: fallback?.getAttribute('ContentType') ?? '', isDefault: true }
}

// Lists `partPath` with its content type: as an Override, or for a picture or other media by its extension.
export async function setContentType(zip: JSZip, partPath: string, contentType: string, isDefault = false) {
  const xml = await readContentTypes(zip)
  const root = xml.documentElement
  if (isDefault) {
    const extension = partPath.slice(partPath.lastIndexOf('.') + 1)
    if (Array.from(root.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, 'Default')).some((element) => element.getAttribute('Extension')?.toLowerCase() === extension.toLowerCase())) return
    const element = xml.createElementNS(CONTENT_TYPES_NAMESPACE, 'Default')
    element.setAttribute('Extension', extension)
    element.setAttribute('ContentType', contentType)
    root.insertBefore(element, root.firstChild)
  } else {
    const existing = Array.from(root.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, 'Override')).find((element) => element.getAttribute('PartName') === `/${partPath}`)
    const element = existing ?? root.appendChild(xml.createElementNS(CONTENT_TYPES_NAMESPACE, 'Override'))
    element.setAttribute('PartName', `/${partPath}`)
    element.setAttribute('ContentType', contentType)
  }
  writeXmlPart(zip, '[Content_Types].xml', xml)
}

// Takes a part out: its file, its relationships file and its Override. Relationships pointing at it are the caller's to remove.
export async function removePart(zip: JSZip, partPath: string) {
  zip.remove(partPath)
  zip.remove(relationshipsPathOf(partPath))
  const xml = await readContentTypes(zip)
  for (const element of Array.from(xml.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, 'Override'))) if (element.getAttribute('PartName') === `/${partPath}`) element.remove()
  writeXmlPart(zip, '[Content_Types].xml', xml)
}

// Pictures and other media no relationship points at any more (after slides or pages were taken out) are removed.
export async function removeUnreferencedMedia(zip: JSZip, mediaFolder: string) {
  const referenced = new Set<string>()
  for (const relationshipsPath of Object.keys(zip.files).filter((path) => path.endsWith('.rels'))) {
    const partPath = relationshipsPath.replace(/_rels\/([^/]*)\.rels$/, '$1')
    for (const relationship of await readRelationships(zip, partPath)) if (!relationship.isExternal) referenced.add(resolveTarget(partPath, relationship.target))
  }
  for (const path of Object.keys(zip.files)) if (path.startsWith(mediaFolder) && !path.includes('/_rels/') && !zip.files[path].dir && !referenced.has(path)) await removePart(zip, path)
}

// ---------------------------------------------------------------- copying parts between packages

// What to do with a relationship of a part being copied: point it at an existing part of the target (a path), copy its target
// along (undefined), or drop it (null).
export type MapRelationship = (relationship: Relationship, sourcePath: string) => Promise<string | null | undefined> | string | null | undefined

function freePartPath(zip: JSZip, wantedPath: string) {
  if (!zip.file(wantedPath)) return wantedPath
  const dot = wantedPath.lastIndexOf('.')
  const [stem, extension] = dot > wantedPath.lastIndexOf('/') ? [wantedPath.slice(0, dot), wantedPath.slice(dot)] : [wantedPath, '']
  const bareStem = stem.replace(/\d+$/, '')
  for (let number = 1; ; number++) if (!zip.file(`${bareStem}${number}${extension}`)) return `${bareStem}${number}${extension}`
}

// Copies a part from one package to another with every part it points to (pictures, charts and their data, notes), renamed when
// the name is taken, and returns its path in the target. `copied` remembers what was copied, so a part pointed to twice (or
// pointing back, as a notes page to its slide) is copied once.
export async function copyPartTree(source: JSZip, sourcePath: string, target: JSZip, mapRelationship: MapRelationship, copied = new Map<string, string>()): Promise<string> {
  const alreadyCopied = copied.get(sourcePath)
  if (alreadyCopied) return alreadyCopied
  const targetPath = freePartPath(target, sourcePath)
  copied.set(sourcePath, targetPath)
  target.file(targetPath, await source.file(sourcePath)!.async('uint8array'))
  const { contentType, isDefault } = await contentTypeOf(source, sourcePath)
  if (contentType) await setContentType(target, targetPath, contentType, isDefault)
  const relationships: Relationship[] = []
  for (const relationship of await readRelationships(source, sourcePath)) {
    if (relationship.isExternal) {
      relationships.push(relationship)
      continue
    }
    const linkedSourcePath = resolveTarget(sourcePath, relationship.target)
    const mapped = await mapRelationship(relationship, linkedSourcePath)
    if (mapped === null) continue
    const linkedTargetPath = mapped ?? (source.file(linkedSourcePath) ? await copyPartTree(source, linkedSourcePath, target, mapRelationship, copied) : null)
    if (linkedTargetPath) relationships.push({ ...relationship, target: relativeTarget(targetPath, linkedTargetPath) })
  }
  if (relationships.length > 0) await writeRelationships(target, targetPath, relationships)
  return targetPath
}

// ---------------------------------------------------------------- document properties

export type OfficeProperties = { title: string; subject: string; author: string; keywords: string; lastModifiedBy: string; created: string; modified: string; revision: string; application: string; company: string; manager: string; customCount: number }

const CORE_FIELDS = ['title', 'subject', 'creator', 'keywords', 'description', 'lastModifiedBy', 'revision', 'created', 'modified', 'lastPrinted', 'category', 'contentStatus', 'identifier', 'language', 'version']
const APP_FIELDS = ['Application', 'AppVersion', 'Company', 'Manager', 'HyperlinkBase', 'Template']

const firstText = (xml: XMLDocument | null, localName: string) => (xml ? (Array.from(xml.getElementsByTagName('*')).find((element) => element.localName === localName)?.textContent?.trim() ?? '') : '')

export async function readOfficeProperties(zip: JSZip): Promise<OfficeProperties> {
  const core = await readXmlPart(zip, 'docProps/core.xml')
  const app = await readXmlPart(zip, 'docProps/app.xml')
  const custom = await readXmlPart(zip, 'docProps/custom.xml')
  return {
    title: firstText(core, 'title'),
    subject: firstText(core, 'subject'),
    author: firstText(core, 'creator'),
    keywords: firstText(core, 'keywords'),
    lastModifiedBy: firstText(core, 'lastModifiedBy'),
    created: firstText(core, 'created'),
    modified: firstText(core, 'modified'),
    revision: firstText(core, 'revision'),
    application: firstText(app, 'Application'),
    company: firstText(app, 'Company'),
    manager: firstText(app, 'Manager'),
    customCount: custom ? Array.from(custom.documentElement.children).length : 0,
  }
}

// Empties the document's own properties (author, dates, application, company…) and removes its custom properties. The
// application's name is optional and Office writes it again on save; the statistics it recomputes on save stay.
export async function removeOfficeMetadata(zip: JSZip) {
  const core = await readXmlPart(zip, 'docProps/core.xml')
  if (core) {
    for (const element of Array.from(core.documentElement.children)) if (CORE_FIELDS.includes(element.localName)) element.remove()
    writeXmlPart(zip, 'docProps/core.xml', core)
  }
  const app = await readXmlPart(zip, 'docProps/app.xml')
  if (app) {
    for (const element of Array.from(app.documentElement.children)) if (APP_FIELDS.includes(element.localName)) element.remove()
    writeXmlPart(zip, 'docProps/app.xml', app)
  }
  for (const relationship of await removeRelationships(zip, '', (candidate) => candidate.type === CUSTOM_PROPERTIES_TYPE)) await removePart(zip, resolveTarget('', relationship.target))
}

// ---------------------------------------------------------------- results

// pptxgenjs lists a content type for a second slide master it never writes. A content type for a part that is not in the
// package breaks the package rules, so such entries are taken out of the files it writes (Images to PowerPoint, PDF to PowerPoint).
export async function removeTypesOfMissingParts(bytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes)
  const xml = await readContentTypes(zip)
  const missing = Array.from(xml.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, 'Override')).filter((element) => !zip.file((element.getAttribute('PartName') ?? '').slice(1)))
  if (missing.length === 0) return bytes
  for (const element of missing) element.remove()
  writeXmlPart(zip, '[Content_Types].xml', xml)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

export async function packageToFile(zip: JSZip, fileName: string, type: string) {
  return new File([await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', mimeType: type })], fileName, { type })
}

// Several result files in one ZIP (the PDF worker's ZIP task), or the file itself when there is one.
export async function filesToResult(files: File[], zipName: string) {
  if (files.length === 1) return files[0]
  const response = await runPdfTask({ type: 'zip', files: await Promise.all(files.map(async (file) => ({ name: file.name, bytes: await file.arrayBuffer() }))) })
  if (response.status !== 'ok' || !response.zip) throw new Error('The ZIP could not be made')
  return new File([response.zip as BlobPart], zipName, { type: 'application/zip' })
}

// Every file under `folder` (pictures, video, sound) at its original quality.
export async function extractMediaFiles(zip: JSZip, folder: string) {
  const paths = Object.keys(zip.files).filter((path) => path.startsWith(folder) && !zip.files[path].dir)
  return Promise.all(paths.map(async (path) => new File([await zip.file(path)!.async('arraybuffer')], path.slice(folder.length).replaceAll('/', '-'))))
}

// A file name made from a text (a heading, a mail-merge value): no characters file systems refuse, not too long.
// oxlint-disable-next-line no-control-regex -- control characters are exactly what file names must not contain
export const safeFileName = (text: string, fallback: string) => text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || fallback
