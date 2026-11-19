// Slides as pictures. renderSlideToCanvas is the one way the site turns a slide into pixels: the PowerPoint viewer's "Save as PNG"
// uses it, and later tools (PowerPoint to PDF, to images, to video) are meant to reuse it with a PptxViewer opened on a hidden
// container. The slide is rendered by @aiden0z/pptx-renderer as HTML/SVG and drawn onto a canvas by modern-screenshot (MIT,
// loaded on first use) through an SVG foreignObject.
import JSZip from 'jszip'
import type { PptxViewer } from '@aiden0z/pptx-renderer'

export type SlideCanvasOptions = { width?: number }

// An empty picture: modern-screenshot treats a false answer as "not handled" and fetches the address itself.
const BLANK_PICTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

// modern-screenshot inlines every picture of the slide as a data: address. It is handed the pictures by drawing them onto a canvas
// (they are blob: addresses the renderer made), so nothing is fetched: the site's CSP allows no fetch of blob: addresses. Any
// other address (one a document's author wrote) becomes an empty picture, never a request.
export async function readImageAsDataUrl(address: string): Promise<string> {
  if (address.startsWith('data:')) return address
  if (!address.startsWith('blob:')) return BLANK_PICTURE
  const image = new Image()
  image.src = address
  try {
    await image.decode()
  } catch {
    return BLANK_PICTURE
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || 1
  canvas.height = image.naturalHeight || 1
  canvas.getContext('2d')?.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

// The renderer scales a slide with a CSS transform but keeps its full-size layout box, so a container that centres it would
// centre the unscaled box and shift the drawing. The slide is drawn into a wrapper of exactly its scaled size instead.
export function renderSlideInBox(viewer: PptxViewer, slideIndex: number, container: HTMLElement, scale: number) {
  const box = container.ownerDocument.createElement('div')
  box.style.cssText = `flex:none;width:${Math.floor(viewer.slideWidth * scale)}px;height:${Math.floor(viewer.slideHeight * scale)}px;overflow:hidden`
  container.replaceChildren(box)
  return viewer.renderSlideToContainer(slideIndex, box, scale)
}

export async function renderSlideToCanvas(viewer: PptxViewer, slideIndex: number, { width = 1920 }: SlideCanvasOptions = {}): Promise<HTMLCanvasElement> {
  // Rendered at its own size off screen (visible, so the copy is too), then scaled when drawn.
  const holder = document.createElement('div')
  holder.style.cssText = `position:fixed;left:-100000px;top:0;width:${viewer.slideWidth}px;height:${viewer.slideHeight}px;overflow:hidden;pointer-events:none`
  holder.setAttribute('aria-hidden', 'true')
  document.body.append(holder)
  const handle = viewer.renderSlideToContainer(slideIndex, holder, 1)
  try {
    if (!handle) throw new Error(`Slide ${slideIndex + 1} could not be rendered`)
    await handle.ready
    await Promise.all(Array.from(holder.querySelectorAll('img'), (image) => image.decode().catch(() => undefined)))
    const { domToCanvas } = await import('modern-screenshot')
    return await domToCanvas(handle.element, {
      width: viewer.slideWidth,
      height: viewer.slideHeight,
      scale: width / viewer.slideWidth,
      backgroundColor: '#ffffff',
      font: false,
      fetchFn: readImageAsDataUrl,
    })
  } finally {
    handle?.dispose()
    holder.remove()
  }
}

// toBlob throws when the browser treats the drawn slide as unsafe to export (some browsers do for foreignObject drawings).
export function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made'))), 'image/png')
  })
}

export const slideImageName = (deckName: string, slideIndex: number, slideCount: number) => `${deckName}-slide-${String(slideIndex + 1).padStart(Math.max(2, String(slideCount).length), '0')}.png`

export async function slidesToPngZip(viewer: PptxViewer, deckName: string, onProgress: (doneCount: number) => void) {
  const zip = new JSZip()
  for (let slideIndex = 0; slideIndex < viewer.slideCount; slideIndex++) {
    const canvas = await renderSlideToCanvas(viewer, slideIndex)
    zip.file(slideImageName(deckName, slideIndex, viewer.slideCount), await canvasToPngBlob(canvas))
    onProgress(slideIndex + 1)
  }
  return zip.generateAsync({ type: 'blob' })
}
