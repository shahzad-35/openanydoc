// The single-picture editors: Photo editor (brightness, contrast, saturation, warmth, filters and text, with undo) and Meme
// generator (top and bottom captions in the classic outlined style: Anton for Latin, Baloo Bhaijaan 2 for Arabic). The preview is
// drawn on the page with the same maths and text pictures the image worker uses, so the download matches it.
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import '@fontsource/anton/latin-400.css'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useEditSession } from '../../formats/useEditSession'
import type { ToolProps } from '../registry'
import { drawTextPicture } from '../pdf/PdfToolParts'
import { adjustPixels } from './imageTasks'
import type { ImageStep, PhotoFilter } from './imageTasks'
import { OutputFields, fieldClass, outputNameOf, runImageBatch, useBatch, useReadImages } from './ImageToolParts'
import type { OutputChoice } from './ImageToolParts'

const PREVIEW_LONG_SIDE = 900
const hasArabicLetters = (text: string) => /[\u0600-\u06ff]/.test(text)

// The picture scaled for the preview, as a canvas.
function scaledCanvasOf(picture: ImageBitmap) {
  const scale = Math.min(1, PREVIEW_LONG_SIDE / Math.max(picture.width, picture.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(picture.width * scale)
  canvas.height = Math.round(picture.height * scale)
  canvas.getContext('2d')!.drawImage(picture, 0, 0, canvas.width, canvas.height)
  return canvas
}

// ---------------------------------------------------------------- Photo editor

type Adjustments = { brightness: number; contrast: number; saturation: number; warmth: number; filter: PhotoFilter }
type TextLayer = { id: number; text: string; x: number; y: number; sizeShare: number; color: string }
type PhotoEdits = { adjustments: Adjustments; texts: TextLayer[] }

const NO_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, filter: 'none' }
const FILTERS: PhotoFilter[] = ['none', 'mono', 'sepia', 'vivid', 'fade', 'cool', 'warm']
const TEXT_COLORS: Record<string, string> = { white: '#ffffff', black: '#1f1f1f', red: '#c0392b', blue: '#2f5fd0' }
const createNoEdits = (): PhotoEdits => ({ adjustments: NO_ADJUSTMENTS, texts: [] })
const countEdits = (edits: PhotoEdits) => Object.entries(edits.adjustments).filter(([key, value]) => value !== NO_ADJUSTMENTS[key as keyof Adjustments]).length + edits.texts.length
const isAdjusted = (adjustments: Adjustments) => Object.entries(adjustments).some(([key, value]) => value !== NO_ADJUSTMENTS[key as keyof Adjustments])

// A text layer as a picture for a picture `pictureWidth` pixels wide (its size is a share of the width).
async function textLayerPicture(layer: TextLayer, pictureWidth: number) {
  const drawn = await drawTextPicture(layer.text, { sizePoints: (layer.sizeShare * pictureWidth) / 4, color: layer.color, fontWeight: 700 })
  return { canvas: drawn.canvas, width: drawn.width * 4, height: drawn.height * 4 }
}

export function PhotoEditor({ files, onResult, onUnsavedEditsChange }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const readByFile = useReadImages(files)
  const read = readByFile.get(file)
  const picture = read && 'picture' in read ? read.picture : null
  const readingMessage = read && 'problem' in read ? t(read.problem === 'heic' ? 'tools.image.heicFailed' : 'tools.image.unreadable') : t('tools.pdf.reading')
  const session = useEditSession<PhotoEdits>(createNoEdits, countEdits)
  const [draft, setDraft] = useState<Adjustments | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null)
  const [format, setFormat] = useState<OutputChoice>('jpg')
  const [quality, setQuality] = useState(90)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ id: number; startX: number; startY: number; startLayer: TextLayer } | null>(null)
  const nextIdRef = useRef(1)
  const batch = useBatch(onResult)
  const adjustments = draft ?? session.edits.adjustments
  const texts = session.edits.texts
  const selectedText = texts.find((layer) => layer.id === selectedTextId)

  useEffect(() => {
    onUnsavedEditsChange?.(session.changeCount > 0)
  }, [session.changeCount, onUnsavedEditsChange])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !picture) return
    let isCurrent = true
    void (async () => {
      const drawn = scaledCanvasOf(picture)
      const context = drawn.getContext('2d')!
      if (isAdjusted(adjustments)) context.putImageData(adjustPixels(context.getImageData(0, 0, drawn.width, drawn.height), adjustments.brightness, adjustments.contrast, adjustments.saturation, adjustments.warmth, adjustments.filter), 0, 0)
      for (const layer of texts) {
        const layerPicture = await textLayerPicture(layer, drawn.width)
        context.drawImage(layerPicture.canvas, layer.x * drawn.width - layerPicture.width / 2, layer.y * drawn.height - layerPicture.height / 2, layerPicture.width, layerPicture.height)
      }
      if (!isCurrent) return
      canvas.width = drawn.width
      canvas.height = drawn.height
      canvas.getContext('2d')!.drawImage(drawn, 0, 0)
    })()
    return () => {
      isCurrent = false
    }
  }, [picture, adjustments, texts])

  // A slider moves the draft; letting go of it records one undo step.
  const commitDraft = () => {
    if (!draft) return
    const committed = draft
    setDraft(null)
    session.update((current) => ({ ...current, adjustments: committed }))
  }
  // A filter change also records a slider value not yet let go of, so neither hides the other.
  function changeFilter(filter: PhotoFilter) {
    const changed = { ...adjustments, filter }
    setDraft(null)
    session.update((current) => ({ ...current, adjustments: changed }))
  }
  function addText() {
    const id = nextIdRef.current++
    session.update((current) => ({ ...current, texts: [...current.texts, { id, text: t('tools.image.editor.newText'), x: 0.5, y: 0.5, sizeShare: 0.08, color: '#ffffff' }] }))
    setSelectedTextId(id)
  }
  const changeText = (id: number, change: Partial<TextLayer>) => session.update((current) => ({ ...current, texts: current.texts.map((layer) => (layer.id === id ? { ...layer, ...change } : layer)) }))

  // Dragging on the preview moves the text layer nearest the pointer.
  function startDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (texts.length === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    const nearest = [...texts].sort((first, second) => Math.hypot(first.x - x, first.y - y) - Math.hypot(second.x - x, second.y - y))[0]
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedTextId(nearest.id)
    dragRef.current = { id: nearest.id, startX: event.clientX, startY: event.clientY, startLayer: nearest }
  }
  function endDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, drag.startLayer.x + (event.clientX - drag.startX) / box.width))
    const y = Math.min(1, Math.max(0, drag.startLayer.y + (event.clientY - drag.startY) / box.height))
    if (x !== drag.startLayer.x || y !== drag.startLayer.y) changeText(drag.id, { x, y })
  }

  async function saveEdited() {
    if (!picture || !file) return
    const steps: ImageStep[] = []
    if (isAdjusted(adjustments)) steps.push({ type: 'adjust', ...adjustments })
    for (const layer of texts) {
      const layerPicture = await textLayerPicture(layer, picture.width)
      const width = layerPicture.width / picture.width
      const height = layerPicture.height / picture.height
      steps.push({ type: 'overlay', picture: await createImageBitmap(layerPicture.canvas), x: layer.x - width / 2, y: layer.y - height / 2, width, height, opacity: 1 })
    }
    const outputFormat = format === 'keep' ? 'jpg' : format
    const name = outputNameOf(file.name, 'edited', outputFormat)
    void batch.run(async (onProgress) => (await runImageBatch([{ name, steps, output: { format: outputFormat, quality, optimisePng: false } }], [picture], 'edited.zip', onProgress)).file)
  }

  const sliders: [keyof Omit<Adjustments, 'filter'>, MessageKey][] = [
    ['brightness', 'tools.image.editor.brightness'],
    ['contrast', 'tools.image.editor.contrast'],
    ['saturation', 'tools.image.editor.saturation'],
    ['warmth', 'tools.image.editor.warmth'],
  ]
  return (
    <div id="photo-editor-tool" className="space-y-5 text-start">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button id="photo-editor-undo-button" type="button" disabled={!session.canUndo} onClick={session.undo} className="btn btn--quiet btn--compact press">
          {t('tools.editor.undo')}
        </button>
        <button id="photo-editor-redo-button" type="button" disabled={!session.canRedo} onClick={session.redo} className="btn btn--quiet btn--compact press">
          {t('tools.editor.redo')}
        </button>
        <button id="photo-editor-reset-button" type="button" disabled={session.changeCount === 0} onClick={session.revertAll} className="btn btn--quiet btn--compact press">
          {t('tools.image.editor.reset')}
        </button>
        <button id="photo-editor-add-text-button" type="button" disabled={!picture} onClick={addText} className="btn btn--quiet btn--compact press">
          {t('tools.image.editor.addText')}
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        {/* The picture stays left to right on an Arabic page. */}
        <div dir="ltr" className="flex justify-center">
          {picture ? <canvas id="photo-editor-preview" ref={previewRef} role="img" aria-label={t('tools.image.previewLabel')} className="image-tool-preview touch-none" onPointerDown={startDrag} onPointerUp={endDrag} /> : <p id="photo-editor-status" className="text-ink-soft">{readingMessage}</p>}
        </div>
        <div className="space-y-4">
          {sliders.map(([key, labelKey]) => (
            <label key={key} className="flex flex-col gap-1 text-sm font-medium">
              {t(labelKey, { value: adjustments[key] })}
              <input id={`photo-editor-${key}-input`} type="range" min="-100" max="100" value={adjustments[key]} onChange={(event) => setDraft({ ...adjustments, [key]: Number(event.target.value) })} onPointerUp={commitDraft} onKeyUp={commitDraft} onBlur={commitDraft} className="min-h-11" />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('tools.image.editor.filter')}
            <select id="photo-editor-filter-select" value={adjustments.filter} onChange={(event) => changeFilter(event.target.value as PhotoFilter)} className={fieldClass}>
              {FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {t(`tools.image.editor.filter.${filter}`)}
                </option>
              ))}
            </select>
          </label>
          {selectedText && (
            <fieldset id="photo-editor-text-fields" className="space-y-2 rounded-[14px] border-2 border-rule p-3">
              <legend className="px-1 text-sm font-semibold">{t('tools.image.editor.textLayer')}</legend>
              <input id="photo-editor-text-input" type="text" dir="auto" value={selectedText.text} aria-label={t('tools.image.editor.textLabel')} onChange={(event) => changeText(selectedText.id, { text: event.target.value })} className={`${fieldClass} w-full`} />
              <label className="flex flex-col gap-1 text-sm">
                {t('tools.image.editor.textSize')}
                <input id="photo-editor-text-size-input" type="range" min="2" max="30" value={Math.round(selectedText.sizeShare * 100)} onChange={(event) => changeText(selectedText.id, { sizeShare: Number(event.target.value) / 100 })} className="min-h-11" />
              </label>
              <select id="photo-editor-text-color-select" value={Object.keys(TEXT_COLORS).find((name) => TEXT_COLORS[name] === selectedText.color) ?? 'white'} aria-label={t('tools.watermark.color')} onChange={(event) => changeText(selectedText.id, { color: TEXT_COLORS[event.target.value] })} className={`${fieldClass} w-full`}>
                {Object.keys(TEXT_COLORS).map((name) => (
                  <option key={name} value={name}>
                    {t(`tools.color.${name}` as MessageKey)}
                  </option>
                ))}
              </select>
              <button id="photo-editor-delete-text-button" type="button" onClick={() => session.update((current) => ({ ...current, texts: current.texts.filter((layer) => layer.id !== selectedText.id) }))} className="btn btn--quiet btn--compact press">
                {t('tools.editor.deleteItem')}
              </button>
              <p className="text-xs text-ink-soft">{t('tools.image.editor.dragHint')}</p>
            </fieldset>
          )}
        </div>
      </div>
      <OutputFields idPrefix="photo-editor" format={format} onFormatChange={setFormat} quality={quality} onQualityChange={setQuality} formats={['jpg', 'png', 'webp']} withKeep={false} />
      <div className="flex justify-center">
        <button id="photo-editor-save-button" type="button" disabled={!picture || batch.isRunning} onClick={() => void saveEdited()} className="btn btn--primary press">
          {batch.isRunning ? t('tools.working') : t('tools.editor.saveCopy')}
        </button>
      </div>
      {batch.progressBar}
      {batch.errorLine}
    </div>
  )
}

// ---------------------------------------------------------------- Meme generator

const MEME_LATIN_FONT = '"Anton", Impact, "Arial Black", sans-serif'
const MEME_ARABIC_FONT = '"Baloo Bhaijaan 2", "IBM Plex Sans Arabic", sans-serif'

// A caption in white with a black outline, wrapped to the picture's width, as a canvas `pictureWidth` pixels wide.
async function drawCaption(text: string, pictureWidth: number, sizeShare: number) {
  const isArabic = hasArabicLetters(text)
  const fontSize = Math.max(12, Math.round(pictureWidth * sizeShare))
  const font = `${isArabic ? 700 : 400} ${fontSize}px ${isArabic ? MEME_ARABIC_FONT : MEME_LATIN_FONT}`
  await document.fonts.load(font, text)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  context.font = font
  const maxWidth = pictureWidth * 0.92
  const lines: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const line = lines.length ? `${lines[lines.length - 1]} ${word}` : word
    if (lines.length && context.measureText(line).width <= maxWidth) lines[lines.length - 1] = line
    else lines.push(word)
  }
  const lineHeight = fontSize * 1.15
  canvas.width = pictureWidth
  canvas.height = Math.ceil(lineHeight * lines.length + fontSize * 0.3)
  context.font = font
  context.direction = isArabic ? 'rtl' : 'ltr'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.lineJoin = 'round'
  context.lineWidth = Math.max(2, fontSize / 8)
  context.strokeStyle = '#000000'
  context.fillStyle = '#ffffff'
  lines.forEach((line, index) => {
    context.strokeText(line, pictureWidth / 2, index * lineHeight + fontSize * 0.1)
    context.fillText(line, pictureWidth / 2, index * lineHeight + fontSize * 0.1)
  })
  return canvas
}

export function MemeGenerator({ files, onResult, onUnsavedEditsChange }: ToolProps) {
  const { t } = useT()
  const file = files[0]
  const readByFile = useReadImages(files)
  const read = readByFile.get(file)
  const picture = read && 'picture' in read ? read.picture : null
  const readingMessage = read && 'problem' in read ? t(read.problem === 'heic' ? 'tools.image.heicFailed' : 'tools.image.unreadable') : t('tools.pdf.reading')
  const [topText, setTopText] = useState('')
  const [bottomText, setBottomText] = useState('')
  const [sizeShare, setSizeShare] = useState(0.1)
  const [isUpperCase, setIsUpperCase] = useState(true)
  const [format, setFormat] = useState<OutputChoice>('jpg')
  const [quality, setQuality] = useState(90)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const batch = useBatch(onResult)
  const shown = (text: string) => (isUpperCase ? text.toLocaleUpperCase() : text).trim()
  const captions = [shown(topText), shown(bottomText)]

  useEffect(() => {
    onUnsavedEditsChange?.(topText.trim() !== '' || bottomText.trim() !== '')
  }, [topText, bottomText, onUnsavedEditsChange])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !picture) return
    let isCurrent = true
    void (async () => {
      const drawn = scaledCanvasOf(picture)
      const context = drawn.getContext('2d')!
      const [top, bottom] = await Promise.all(captions.map((caption) => (caption ? drawCaption(caption, drawn.width, sizeShare) : null)))
      if (top) context.drawImage(top, 0, drawn.height * 0.03)
      if (bottom) context.drawImage(bottom, 0, drawn.height * 0.97 - bottom.height)
      if (!isCurrent) return
      canvas.width = drawn.width
      canvas.height = drawn.height
      canvas.getContext('2d')!.drawImage(drawn, 0, 0)
    })()
    return () => {
      isCurrent = false
    }
    // captions is derived from the texts and the upper-case setting listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture, topText, bottomText, sizeShare, isUpperCase])

  async function saveMeme() {
    if (!picture || !file) return
    const steps: ImageStep[] = []
    for (const [index, caption] of captions.entries()) {
      if (!caption) continue
      const drawn = await drawCaption(caption, picture.width, sizeShare)
      const height = drawn.height / picture.height
      steps.push({ type: 'overlay', picture: await createImageBitmap(drawn), x: 0, y: index === 0 ? 0.03 : 0.97 - height, width: 1, height, opacity: 1 })
    }
    const outputFormat = format === 'keep' ? 'jpg' : format
    const name = outputNameOf(file.name, 'meme', outputFormat)
    void batch.run(async (onProgress) => (await runImageBatch([{ name, steps, output: { format: outputFormat, quality, optimisePng: false } }], [picture], 'meme.zip', onProgress)).file)
  }

  return (
    <div id="meme-generator-tool" className="space-y-5 text-start">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.image.meme.top')}
          <input id="meme-top-input" type="text" dir="auto" value={topText} onChange={(event) => setTopText(event.target.value)} className={`${fieldClass} w-full`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.image.meme.bottom')}
          <input id="meme-bottom-input" type="text" dir="auto" value={bottomText} onChange={(event) => setBottomText(event.target.value)} className={`${fieldClass} w-full`} />
        </label>
      </div>
      <div className="flex flex-wrap items-end justify-center gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.image.meme.size')}
          <input id="meme-size-input" type="range" min="5" max="18" value={Math.round(sizeShare * 100)} onChange={(event) => setSizeShare(Number(event.target.value) / 100)} className="min-h-11 w-44" />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input id="meme-uppercase-checkbox" type="checkbox" checked={isUpperCase} onChange={(event) => setIsUpperCase(event.target.checked)} className="size-5" />
          {t('tools.image.meme.upperCase')}
        </label>
        <OutputFields idPrefix="meme" format={format} onFormatChange={setFormat} quality={quality} onQualityChange={setQuality} formats={['jpg', 'png']} withKeep={false} />
      </div>
      <div dir="ltr" className="flex justify-center">
        {picture ? <canvas id="meme-preview" ref={previewRef} role="img" aria-label={t('tools.image.previewLabel')} className="image-tool-preview" /> : <p id="meme-status" className="text-ink-soft">{readingMessage}</p>}
      </div>
      <p className="text-center text-sm text-ink-soft">{t('tools.image.meme.fontNote')}</p>
      <div className="flex justify-center">
        <button id="meme-save-button" type="button" disabled={!picture || batch.isRunning || captions.every((caption) => !caption)} onClick={() => void saveMeme()} className="btn btn--primary press">
          {batch.isRunning ? t('tools.working') : t('tools.image.meme.button')}
        </button>
      </div>
      {batch.progressBar}
      {batch.errorLine}
    </div>
  )
}
