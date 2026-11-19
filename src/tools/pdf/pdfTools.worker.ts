import { zipSync } from 'fflate'
import { EncryptedPDFError, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNull, PDFRef, PDFStream, PDFString, TextRenderingMode, beginText, degrees, endText, popGraphicsState, pushGraphicsState, rgb, setCharacterSqueeze, setFontAndSize, setTextMatrix, setTextRenderingMode, showText } from 'pdf-lib'
import type { PDFObject, PDFOperator, PDFPage } from 'pdf-lib'
import type { LayerWord, NewFormField, OutputPage, PageOrientation, PageShape, PageSize, PdfTaskProgress, PdfTaskRequest, PdfTaskResponse } from './pdfTasks'

const ARROW_HEAD_LENGTH = 12
const PAGE_SIZES_IN_POINTS: Record<Exclude<PageSize, 'fit'>, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }
// A picture's own size becomes the page size at 96 pixels per inch (72 points per inch).
const POINTS_PER_PIXEL = 72 / 96

function reportProgress(done: number, total: number) {
  postMessage({ status: 'progress', done, total } satisfies PdfTaskProgress)
}

// copyPages copies everything a copied page refers to. A link or form field on a kept page that points at a page left out (removed,
// split off, redacted or cropped) brings that whole page, its text included, into the file outside the page list. So references to
// pages outside the page list are cleared, then every object the document no longer reaches is deleted.
function removeLeftOutPages(output: PDFDocument) {
  const { context } = output
  const keptPageRefs = new Set(output.getPages().map((page) => page.ref))
  const leftOutPageRefs = new Set(
    context
      .enumerateIndirectObjects()
      .filter(([ref, object]) => object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('Page') && !keptPageRefs.has(ref))
      .map(([ref]) => ref),
  )
  const clearLeftOutPageReferences = (object: PDFObject) => {
    const container = object instanceof PDFStream ? object.dict : object
    if (container instanceof PDFDict) {
      for (const [key, value] of container.entries()) {
        if (value instanceof PDFRef && leftOutPageRefs.has(value)) container.set(key, PDFNull)
        else clearLeftOutPageReferences(value)
      }
    } else if (container instanceof PDFArray) {
      container.asArray().forEach((value, index) => {
        if (value instanceof PDFRef && leftOutPageRefs.has(value)) container.set(index, PDFNull)
        else clearLeftOutPageReferences(value)
      })
    }
  }
  if (leftOutPageRefs.size) for (const [, object] of context.enumerateIndirectObjects()) clearLeftOutPageReferences(object)

  const reachableRefs = new Set<PDFRef>()
  const pending = [context.trailerInfo.Root, context.trailerInfo.Info].filter((object): object is PDFObject => object !== undefined)
  while (pending.length) {
    const object = pending.pop()!
    if (object instanceof PDFRef) {
      if (reachableRefs.has(object)) continue
      reachableRefs.add(object)
      const target = context.lookup(object)
      if (target) pending.push(target)
      continue
    }
    const container = object instanceof PDFStream ? object.dict : object
    if (container instanceof PDFDict) pending.push(...container.values())
    else if (container instanceof PDFArray) pending.push(...container.asArray())
  }
  for (const [ref] of context.enumerateIndirectObjects()) if (!reachableRefs.has(ref)) context.delete(ref)
}

// One output PDF from pages of the sources. Each source's pages are copied in one call (its fonts and pictures are copied once),
// a page used twice is copied twice, and each page's turn is added to the rotation it already has.
async function buildPdf(sources: PDFDocument[], pages: OutputPage[]) {
  const output = await PDFDocument.create()
  const copiedPagesBySource = new Map<number, Awaited<ReturnType<PDFDocument['copyPages']>>>()
  for (const [sourceIndex, source] of sources.entries()) {
    const pageIndexes = pages.flatMap((page) => ('sourceIndex' in page && page.sourceIndex === sourceIndex ? [page.pageIndex] : []))
    if (pageIndexes.length) copiedPagesBySource.set(sourceIndex, await output.copyPages(source, pageIndexes))
  }
  for (const page of pages) {
    if ('blankSize' in page) {
      output.addPage(page.blankSize)
      continue
    }
    const copiedPage = copiedPagesBySource.get(page.sourceIndex)!.shift()!
    copiedPage.setRotation(degrees((((copiedPage.getRotation().angle + page.rotation) % 360) + 360) % 360))
    output.addPage(copiedPage)
  }
  removeLeftOutPages(output)
  return output.save()
}

// "Fit" makes the page the picture's own size plus the margin; A4 and Letter keep their size, turned to suit the picture.
function imagePageSize(image: { width: number; height: number }, pageSize: PageSize, orientation: PageOrientation, marginPoints: number): [number, number] {
  if (pageSize === 'fit') return [image.width * POINTS_PER_PIXEL + 2 * marginPoints, image.height * POINTS_PER_PIXEL + 2 * marginPoints]
  const [shortSide, longSide] = PAGE_SIZES_IN_POINTS[pageSize]
  const isLandscape = orientation === 'landscape' || (orientation === 'auto' && image.width > image.height)
  return isLandscape ? [longSide, shortSide] : [shortSide, longSide]
}

// A point on a page as it is shown (from its top-left corner, after the page's rotation, inside its crop box) in the page's own
// PDF coordinates. pdf.js shows /Rotate clockwise: at 90 the crop box's bottom-left corner is the top-left corner on screen.
function shownPointToPdf(page: PDFPage, shownX: number, shownY: number) {
  const { x: left, y: bottom, width, height } = page.getCropBox()
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270
  if (rotation === 90) return { x: left + shownY, y: bottom + shownX }
  if (rotation === 180) return { x: left + width - shownX, y: bottom + shownY }
  if (rotation === 270) return { x: left + width - shownY, y: bottom + height - shownX }
  return { x: left + shownX, y: bottom + height - shownY }
}

function drawShape(page: PDFPage, shape: PageShape) {
  const rotate = degrees(page.getRotation().angle)
  const color = rgb(...shape.color)
  const { x, y, width, height } = shape.box
  if (shape.kind === 'rectangle' || shape.kind === 'ellipse') {
    // Drawn upright as shown: anchored at its bottom-left corner on screen and turned with the page.
    const fill = shape.fill ? rgb(...shape.fill) : undefined
    if (shape.kind === 'rectangle') {
      page.drawRectangle({ ...shownPointToPdf(page, x, y + height), width, height, rotate, borderColor: color, borderWidth: shape.thickness, color: fill })
    } else {
      const isTurnedSideways = page.getRotation().angle % 180 !== 0
      page.drawEllipse({ ...shownPointToPdf(page, x + width / 2, y + height / 2), xScale: (isTurnedSideways ? height : width) / 2, yScale: (isTurnedSideways ? width : height) / 2, borderColor: color, borderWidth: shape.thickness, color: fill })
    }
    return
  }
  const line = (fromX: number, fromY: number, toX: number, toY: number) =>
    page.drawLine({ start: shownPointToPdf(page, fromX, fromY), end: shownPointToPdf(page, toX, toY), thickness: shape.thickness, color, lineCap: 1 })
  line(x, y, x + width, y + height)
  if (shape.kind !== 'arrow') return
  const angle = Math.atan2(height, width)
  for (const side of [-1, 1]) {
    const headAngle = angle + Math.PI + (side * Math.PI) / 7
    line(x + width, y + height, x + width + ARROW_HEAD_LENGTH * Math.cos(headAngle), y + height + ARROW_HEAD_LENGTH * Math.sin(headAngle))
  }
}

// ---------------------------------------------------------------- the invisible text layer over page pictures

// Each font of the layer maps up to 255 one-byte codes to letters through its ToUnicode table: no glyphs are needed, since the
// text is never drawn (rendering mode 3), and it works for Arabic as for Latin with no font file.
const CODES_PER_LAYER_FONT = 255
const RIGHT_TO_LEFT_LETTER = /[\u0590-\u05FF\u0600-\u065F\u066A-\u06EF\u06FA-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u
const toUtf16Hex = (text: string) => Array.from({ length: text.length }, (_, index) => text.charCodeAt(index).toString(16).padStart(4, '0')).join('')
const glyphNameOf = (character: string) => (character.length === 1 ? `uni${toUtf16Hex(character).toUpperCase()}` : `u${character.codePointAt(0)!.toString(16).toUpperCase()}`)

function addLayerFont(output: PDFDocument, characters: string[]) {
  const mappings = characters.map((character, index) => `<${(index + 1).toString(16).padStart(2, '0')}> <${toUtf16Hex(character)}>`)
  const mappingBlocks: string[] = []
  for (let start = 0; start < mappings.length; start += 100) {
    const block = mappings.slice(start, start + 100)
    mappingBlocks.push(`${block.length} beginbfchar\n${block.join('\n')}\nendbfchar`)
  }
  const toUnicodeMap = [
    '/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def', '/CMapName /Adobe-Identity-UCS def', '/CMapType 2 def',
    '1 begincodespacerange', '<01> <FF>', 'endcodespacerange', ...mappingBlocks,
    'endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end',
  ].join('\n')
  return output.context.register(
    output.context.obj({
      Type: 'Font',
      Subtype: 'Type1',
      BaseFont: 'Helvetica',
      FirstChar: 1,
      LastChar: characters.length,
      Widths: characters.map(() => 500),
      Encoding: { Type: 'Encoding', Differences: [1, ...characters.map(glyphNameOf)] },
      ToUnicode: output.context.register(output.context.flateStream(toUnicodeMap)),
    }),
  )
}

// Text extractors read words in drawing order and turn right-to-left text back themselves, as for every PDF a browser makes, so a
// right-to-left word is written with its letters in visual order. Words are placed as the page is shown (shownPointToPdf) and turned
// with it, so they also fit an existing page with a crop box or a rotation (OCR PDF).
function drawInvisibleWords(output: PDFDocument, pages: { page: PDFPage; words: LayerWord[] }[]) {
  const characters = [...new Set(pages.flatMap(({ words }) => words.flatMap((word) => Array.from(word.text))))]
  const fontNames: PDFName[] = []
  const fontRefs: PDFRef[] = []
  const codeByCharacter = new Map<string, { fontIndex: number; code: number }>()
  for (let start = 0; start < characters.length; start += CODES_PER_LAYER_FONT) {
    const fontCharacters = characters.slice(start, start + CODES_PER_LAYER_FONT)
    fontCharacters.forEach((character, index) => codeByCharacter.set(character, { fontIndex: fontRefs.length, code: index + 1 }))
    fontNames.push(PDFName.of(`OpenAnyDocText${fontRefs.length}`))
    fontRefs.push(addLayerFont(output, fontCharacters))
  }
  for (const { page, words } of pages) {
    if (words.length === 0) continue
    const angle = (page.getRotation().angle * Math.PI) / 180
    const [cosine, sine] = [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))]
    fontRefs.forEach((fontRef, index) => page.node.setFontDictionary(fontNames[index], fontRef))
    const operators: PDFOperator[] = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)]
    for (const word of words) {
      // A word with Latin letters stays as it is, even with Arabic punctuation on it ("OpenAnyDoc؛").
      const letters = RIGHT_TO_LEFT_LETTER.test(word.text) && !/[A-Za-z]/.test(word.text) ? Array.from(word.text).reverse() : Array.from(word.text)
      // Every code is half an em wide; the squeeze stretches the word to its width on the picture.
      const start = shownPointToPdf(page, word.x, word.baselineY)
      operators.push(setCharacterSqueeze((100 * word.width) / (letters.length * 0.5 * word.fontSize)), setTextMatrix(cosine, sine, -sine, cosine, start.x, start.y))
      let fontIndex = -1
      let codes = ''
      const showCodes = () => codes && operators.push(setFontAndSize(fontNames[fontIndex], word.fontSize), showText(PDFHexString.of(codes)))
      for (const letter of letters) {
        const { fontIndex: letterFontIndex, code } = codeByCharacter.get(letter)!
        if (letterFontIndex !== fontIndex) {
          showCodes()
          fontIndex = letterFontIndex
          codes = ''
        }
        codes += code.toString(16).padStart(2, '0')
      }
      showCodes()
    }
    operators.push(endText(), popGraphicsState())
    page.pushOperators(...operators)
  }
}

// ---------------------------------------------------------------- qpdf (Protect and Unlock PDF)

type QpdfInstance = { callMain: (args: string[]) => number; FS: { writeFile: (path: string, data: Uint8Array) => void; readFile: (path: string) => Uint8Array } }

// qpdf run once on the file at /input.pdf; its result is read from /output.pdf. Its .wasm is inlined in this worker (vite.config.ts,
// `inlinedWasmFiles`) and handed over as bytes (`feedQpdfWasmBytes`), so nothing is fetched. Exit codes: 0 done, 3 done with
// warnings, 2 failed (a wrong password among them).
async function runQpdf(args: string[], input: ArrayBuffer) {
  const [{ default: createQpdf }, { default: wasmAddress }] = await Promise.all([import('@neslinesli93/qpdf-wasm'), import('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url')])
  const wasmBinary = import.meta.env.DEV && !wasmAddress.startsWith('data:') ? new Uint8Array(await (await fetch(wasmAddress)).arrayBuffer()) : Uint8Array.from(atob(wasmAddress.slice(wasmAddress.indexOf(',') + 1)), (character) => character.charCodeAt(0))
  const qpdf = (await (createQpdf as unknown as (options: object) => Promise<QpdfInstance>)({ wasmBinary, locateFile: () => 'qpdf.wasm' })) as QpdfInstance
  qpdf.FS.writeFile('/input.pdf', new Uint8Array(input))
  const exitCode = qpdf.callMain([...args, '/input.pdf', '/output.pdf'])
  return exitCode === 0 || exitCode === 3 ? qpdf.FS.readFile('/output.pdf') : null
}

// A permissions password nobody is told, when none is given, so a reader doesn't treat the password to open as the permissions
// password. The restrictions stay advisory: anyone with the password to open can decrypt the file (Unlock PDF does).
const randomPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')

// ---------------------------------------------------------------- PDF Forms

const FIELD_BORDER = { borderColor: rgb(0.55, 0.6, 0.7), borderWidth: 1 }
// Field flag bit 2 (Ff): the field must be filled in before the form is submitted.
const REQUIRED_FLAG = 2

function addFormField(pdf: PDFDocument, field: NewFormField) {
  const form = pdf.getForm()
  const page = pdf.getPage(field.pageIndex)
  const { x, y, width, height } = field.box
  const corners = [shownPointToPdf(page, x, y), shownPointToPdf(page, x + width, y + height)]
  const rectangle = { x: Math.min(corners[0].x, corners[1].x), y: Math.min(corners[0].y, corners[1].y), width: Math.abs(corners[1].x - corners[0].x), height: Math.abs(corners[1].y - corners[0].y) }
  if (field.kind === 'signature') {
    // pdf-lib makes no signature fields: one is written by hand, a field and its widget in one dictionary.
    const widgetRef = pdf.context.register(
      pdf.context.obj({
        Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFHexString.fromText(field.name), F: 4, P: page.ref,
        Rect: [rectangle.x, rectangle.y, rectangle.x + rectangle.width, rectangle.y + rectangle.height],
        MK: { BC: [0.55, 0.6, 0.7] },
        Ff: field.isRequired ? REQUIRED_FLAG : 0,
      }),
    )
    page.node.addAnnot(widgetRef)
    form.acroForm.addField(widgetRef)
    return
  }
  if (field.kind === 'checkbox') {
    const checkBox = form.createCheckBox(field.name)
    checkBox.addToPage(page, { ...rectangle, ...FIELD_BORDER })
    if (field.defaultValue === 'checked') checkBox.check()
    if (field.isRequired) checkBox.enableRequired()
    return
  }
  if (field.kind === 'dropdown') {
    const dropdown = form.createDropdown(field.name)
    dropdown.addOptions(field.options)
    if (field.defaultValue) dropdown.select(field.defaultValue)
    dropdown.addToPage(page, { ...rectangle, ...FIELD_BORDER })
    if (field.isRequired) dropdown.enableRequired()
    return
  }
  if (field.kind === 'radio') {
    const radioGroup = form.createRadioGroup(field.name)
    const side = Math.min(rectangle.width, rectangle.height / field.options.length)
    field.options.forEach((option, index) => radioGroup.addOptionToPage(option, page, { x: rectangle.x, y: rectangle.y + rectangle.height - side * (index + 1), width: side, height: side, ...FIELD_BORDER }))
    if (field.defaultValue) radioGroup.select(field.defaultValue)
    if (field.isRequired) radioGroup.enableRequired()
    return
  }
  const textField = form.createTextField(field.name)
  if (field.kind === 'multiline') textField.enableMultiline()
  if (field.defaultValue) textField.setText(field.defaultValue)
  textField.addToPage(page, { ...rectangle, ...FIELD_BORDER })
  if (field.isRequired) textField.enableRequired()
  if (field.kind === 'date') {
    // Acrobat's own date scripts keep what is typed a date (other readers ignore them and keep a plain text field).
    textField.acroField.dict.set(
      PDFName.of('AA'),
      pdf.context.obj({ F: { S: 'JavaScript', JS: PDFString.of('AFDate_FormatEx("yyyy-mm-dd");') }, K: { S: 'JavaScript', JS: PDFString.of('AFDate_KeystrokeEx("yyyy-mm-dd");') } }),
    )
    textField.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText('yyyy-mm-dd'))
  }
}

async function runTask(request: PdfTaskRequest): Promise<PdfTaskResponse> {
  if (request.type === 'warm-up') return { status: 'ok' }
  if (request.type === 'count-pages') return { status: 'ok', pageCount: (await PDFDocument.load(request.pdf)).getPageCount() }
  if (request.type === 'build-pdf') {
    const sources = await Promise.all(request.sources.map((sourceBytes) => PDFDocument.load(sourceBytes)))
    return { status: 'ok', pdf: await buildPdf(sources, request.pages) }
  }
  if (request.type === 'build-pdfs') {
    const sources = await Promise.all(request.sources.map((sourceBytes) => PDFDocument.load(sourceBytes)))
    const zipEntries: Record<string, Uint8Array> = {}
    for (const [position, outputDocument] of request.documents.entries()) {
      zipEntries[outputDocument.name] = await buildPdf(sources, outputDocument.pages)
      reportProgress(position + 1, request.documents.length)
    }
    // PDFs are compressed inside already; storing them keeps the ZIP quick to make.
    return { status: 'ok', zip: zipSync(zipEntries, { level: 0 }) }
  }
  if (request.type === 'images-to-pdf') {
    const documents: { name: string; pdf: PDFDocument }[] = []
    let currentPdf: PDFDocument | null = null
    for (const [position, image] of request.images.entries()) {
      if (!currentPdf || request.isOnePdfPerImage) {
        currentPdf = await PDFDocument.create()
        documents.push({ name: request.isOnePdfPerImage ? `${image.name.replace(/\.[^.]+$/, '')}.pdf` : request.pdfName, pdf: currentPdf })
      }
      const embeddedImage = image.kind === 'jpg' ? await currentPdf.embedJpg(image.bytes) : await currentPdf.embedPng(image.bytes)
      const page = currentPdf.addPage(imagePageSize(image, request.pageSize, request.orientation, request.marginPoints))
      // The picture fills the room inside the margin, centred, keeping its proportions.
      const room = { width: page.getWidth() - 2 * request.marginPoints, height: page.getHeight() - 2 * request.marginPoints }
      const scale = Math.min(room.width / image.width, room.height / image.height)
      const drawn = { width: image.width * scale, height: image.height * scale }
      page.drawImage(embeddedImage, { x: (page.getWidth() - drawn.width) / 2, y: (page.getHeight() - drawn.height) / 2, ...drawn })
      reportProgress(position + 1, request.images.length)
    }
    if (documents.length === 1) return { status: 'ok', pdf: await documents[0].pdf.save() }
    const zipEntries: Record<string, Uint8Array> = {}
    for (const document of documents) zipEntries[document.name] = await document.pdf.save()
    return { status: 'ok', zip: zipSync(zipEntries, { level: 0 }) }
  }
  if (request.type === 'zip') {
    return { status: 'ok', zip: zipSync(Object.fromEntries(request.files.map((file) => [file.name, new Uint8Array(file.bytes)])), { level: 0 }) }
  }
  if (request.type === 'crop-pdf') {
    const pdf = await PDFDocument.load(request.pdf)
    const pages = pdf.getPages()
    for (const pageIndex of request.pageIndexes) {
      const page = pages[pageIndex]
      const isTurnedSideways = page.getRotation().angle % 180 !== 0
      const { width, height } = page.getCropBox()
      const [shownWidth, shownHeight] = isTurnedSideways ? [height, width] : [width, height]
      const { x, y, width: boxWidth, height: boxHeight } = request.box
      const firstCorner = shownPointToPdf(page, x * shownWidth, y * shownHeight)
      const oppositeCorner = shownPointToPdf(page, (x + boxWidth) * shownWidth, (y + boxHeight) * shownHeight)
      const left = Math.min(firstCorner.x, oppositeCorner.x)
      const bottom = Math.min(firstCorner.y, oppositeCorner.y)
      const cropped = [left, bottom, Math.abs(oppositeCorner.x - firstCorner.x), Math.abs(oppositeCorner.y - firstCorner.y)] as const
      page.setCropBox(...cropped)
      page.setMediaBox(...cropped)
    }
    return { status: 'ok', pdf: await pdf.save() }
  }
  if (request.type === 'picture-pages') {
    const source = request.pdf ? await PDFDocument.load(request.pdf) : null
    const output = await PDFDocument.create()
    const pictureByPage = new Map(request.pictures.map((picture) => [picture.pageIndex, picture]))
    const keptPageIndexes = Array.from({ length: request.pageCount }, (_, pageIndex) => pageIndex).filter((pageIndex) => !pictureByPage.has(pageIndex))
    const copiedPages = source && keptPageIndexes.length ? await output.copyPages(source, keptPageIndexes) : []
    const picturePages: { page: PDFPage; words: LayerWord[] }[] = []
    for (let pageIndex = 0; pageIndex < request.pageCount; pageIndex++) {
      const picture = pictureByPage.get(pageIndex)
      if (!picture) {
        output.addPage(copiedPages.shift()!)
        continue
      }
      const page = output.addPage([picture.widthPoints, picture.heightPoints])
      page.drawImage(await output.embedJpg(picture.jpg), { x: 0, y: 0, width: picture.widthPoints, height: picture.heightPoints })
      picturePages.push({ page, words: picture.words })
      reportProgress(pageIndex + 1, request.pageCount)
    }
    drawInvisibleWords(output, picturePages)
    removeLeftOutPages(output)
    return { status: 'ok', pdf: await output.save() }
  }
  if (request.type === 'text-layer-pdf') {
    const pdf = await PDFDocument.load(request.pdf)
    drawInvisibleWords(pdf, request.pages.map(({ pageIndex, words }) => ({ page: pdf.getPage(pageIndex), words })))
    return { status: 'ok', pdf: await pdf.save() }
  }
  if (request.type === 'add-form-fields') {
    const pdf = await PDFDocument.load(request.pdf)
    for (const field of request.fields) addFormField(pdf, field)
    return { status: 'ok', pdf: await pdf.save() }
  }
  if (request.type === 'protect-pdf') {
    if ((await PDFDocument.load(request.pdf, { ignoreEncryption: true })).isEncrypted) return { status: 'error', reason: 'encrypted' }
    const restrictions = [...(request.canPrint ? [] : ['--print=none']), ...(request.canCopy ? [] : ['--extract=n']), ...(request.canEdit ? [] : ['--modify=none'])]
    const ownerPassword = request.ownerPassword || (restrictions.length ? randomPassword() : request.userPassword)
    const pdf = await runQpdf(['--encrypt', `--user-password=${request.userPassword}`, `--owner-password=${ownerPassword}`, '--bits=256', ...restrictions, '--'], request.pdf)
    return pdf ? { status: 'ok', pdf } : { status: 'error', reason: 'unreadable' }
  }
  if (request.type === 'unlock-pdf') {
    if (!(await PDFDocument.load(request.pdf, { ignoreEncryption: true })).isEncrypted) return { status: 'error', reason: 'not-encrypted' }
    const pdf = await runQpdf([...(request.password ? [`--password=${request.password}`] : []), '--decrypt'], request.pdf)
    return pdf ? { status: 'ok', pdf } : { status: 'error', reason: 'wrong-password' }
  }
  if (request.type === 'repair-pdf') {
    const pdf = await PDFDocument.load(request.pdf, { throwOnInvalidObject: false, updateMetadata: false })
    if (pdf.getPageCount() === 0) throw new Error('No pages')
    return { status: 'ok', pdf: await pdf.save() }
  }
  const pdf = await PDFDocument.load(request.pdf)
  if (request.removeFormFields) {
    const form = pdf.getForm()
    for (const field of form.getFields()) form.removeField(field)
  }
  const images = await Promise.all(request.images.map((imageBytes) => pdf.embedPng(imageBytes)))
  const pages = pdf.getPages()
  for (const [position, stamp] of request.stamps.entries()) {
    const page = pages[stamp.pageIndex]
    const { x, y, width, height } = stamp.box
    // The picture stands upright on screen: anchored at its bottom-left corner as shown, and turned with the page.
    page.drawImage(images[stamp.imageIndex], { ...shownPointToPdf(page, x, y + height), width, height, rotate: degrees(page.getRotation().angle), opacity: stamp.opacity ?? 1 })
    if (position % 25 === 24) reportProgress(position + 1, request.stamps.length)
  }
  for (const shape of request.shapes ?? []) drawShape(pages[shape.pageIndex], shape)
  return { status: 'ok', pdf: await pdf.save() }
}

self.onmessage = async (event: MessageEvent<PdfTaskRequest>) => {
  let response: PdfTaskResponse
  try {
    response = await runTask(event.data)
  } catch (error) {
    response = { status: 'error', reason: error instanceof EncryptedPDFError ? 'encrypted' : 'unreadable' }
  }
  postMessage(response)
}
