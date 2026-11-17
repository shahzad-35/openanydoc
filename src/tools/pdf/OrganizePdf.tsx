// Organize PDF: the pages of the chosen PDF (and of any PDF added later, appended) in one grid, to reorder by dragging (or the
// arrow buttons), turn, duplicate, delete, or follow with a blank page; undo and redo work on the page list. Save builds the PDF
// in pdfTools.worker.ts.
import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { OutputPage } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, pdfResultFile, problemMessageKey, useOpenedPdfs } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

// A page of the list: a page of a chosen file (by the file itself, so removing nothing shifts it) or a blank page.
type OrganizedPage = { key: string; rotation: number } & ({ file: File; pageIndex: number } | { blankSize: [number, number] })

const A4_SIZE: [number, number] = [595.28, 841.89]
let nextPageKey = 0
const newPageKey = () => `organized-${nextPageKey++}`

export default function OrganizePdf({ files, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const openedByFile = useOpenedPdfs(files)
  const [history, setHistory] = useState<{ pages: OrganizedPage[][]; position: number }>({ pages: [[]], position: 0 })
  const pages = history.pages[history.position]
  const [addedFiles, setAddedFiles] = useState<File[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')

  function changePages(nextPages: OrganizedPage[]) {
    setHistory((previous) => ({ pages: [...previous.pages.slice(0, previous.position + 1), nextPages], position: previous.position + 1 }))
  }

  // A file whose pages are known is appended once (the first file is the start of the list; later ones are "Add another PDF").
  useEffect(() => {
    const readyFile = files.find((file) => !addedFiles.includes(file) && openedByFile.get(file) && 'document' in openedByFile.get(file)!)
    if (!readyFile) return
    const opened = openedByFile.get(readyFile) as { document: { numPages: number } }
    const newPages: OrganizedPage[] = Array.from({ length: opened.document.numPages }, (_, pageIndex) => ({ key: newPageKey(), file: readyFile, pageIndex, rotation: 0 }))
    // oxlint-disable-next-line react/set-state-in-effect
    setAddedFiles((previous) => [...previous, readyFile])
    // The first file starts the history; an added PDF is a step that can be undone.
    setHistory((previous) => (previous.pages.length === 1 && previous.pages[0].length === 0 ? { pages: [newPages], position: 0 } : { pages: [...previous.pages.slice(0, previous.position + 1), [...previous.pages[previous.position], ...newPages]], position: previous.position + 1 }))
  }, [files, openedByFile, addedFiles])

  const fileNumber = (file: File) => files.indexOf(file) + 1
  const cards: GridCard[] = pages.map((page, index) => {
    if ('blankSize' in page) return { key: page.key, caption: `${index + 1} · ${t('tools.grid.blankPage')}`, isBlank: true, rotation: page.rotation }
    const opened = openedByFile.get(page.file)
    const caption = files.length > 1 ? t('tools.organize.pageOfFile', { position: index + 1, page: page.pageIndex + 1, file: fileNumber(page.file) }) : String(index + 1)
    if (!opened || !('document' in opened)) return { key: page.key, caption, problem: t('tools.pdf.reading') }
    return { key: page.key, caption, document: opened.document, pageIndex: page.pageIndex, rotation: page.rotation }
  })

  function movePage(fromIndex: number, toIndex: number) {
    const nextPages = [...pages]
    const [movedPage] = nextPages.splice(fromIndex, 1)
    nextPages.splice(toIndex, 0, movedPage)
    changePages(nextPages)
  }
  const turnPage = (index: number, degrees: number) => changePages(pages.map((page, pageIndex) => (pageIndex === index ? { ...page, rotation: (((page.rotation + degrees) % 360) + 360) % 360 } : page)))
  const duplicatePage = (index: number) => changePages([...pages.slice(0, index + 1), { ...pages[index], key: newPageKey() }, ...pages.slice(index + 1)])
  const deletePage = (index: number) => changePages(pages.filter((_, pageIndex) => pageIndex !== index))
  async function insertBlankPageAfter(index: number) {
    // A blank page takes the size of the page before it.
    const page = pages[index]
    let size = A4_SIZE
    if ('blankSize' in page) size = page.blankSize
    else {
      const opened = openedByFile.get(page.file)
      if (opened && 'document' in opened) {
        const viewport = (await opened.document.getPage(page.pageIndex + 1)).getViewport({ scale: 1 })
        size = [viewport.width, viewport.height]
      }
    }
    changePages([...pages.slice(0, index + 1), { key: newPageKey(), blankSize: size, rotation: 0 }, ...pages.slice(index + 1)])
  }

  async function savePdf() {
    setError('')
    setIsWorking(true)
    const sourceFiles = files.filter((file) => pages.some((page) => 'file' in page && page.file === file))
    const outputPages: OutputPage[] = pages.map((page) => ('blankSize' in page ? { blankSize: page.blankSize } : { sourceIndex: sourceFiles.indexOf(page.file), pageIndex: page.pageIndex, rotation: page.rotation }))
    const response = await runPdfTask({ type: 'build-pdf', sources: await Promise.all(sourceFiles.map((file) => file.arrayBuffer())), pages: outputPages }).catch(() => null)
    setIsWorking(false)
    if (response?.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${baseNameOf(files[0].name)}-organized.pdf`))
    else setError(t(response?.status === 'error' ? problemMessageKey(response.reason) : 'tools.pdf.unreadable'))
  }

  const problemFiles = files.filter((file) => { const opened = openedByFile.get(file); return opened && 'problem' in opened })
  const actionClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  const icon = (path: string, flipInArabic = false) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-5${flipInArabic ? ' rtl:-scale-x-100' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
  )
  return (
    <div id="organize-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.organize.hint')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="organize-undo-button" type="button" disabled={history.position === 0} onClick={() => setHistory((previous) => ({ ...previous, position: previous.position - 1 }))} className="btn btn--quiet btn--compact press">
          {t('tools.organize.undo')}
        </button>
        <button id="organize-redo-button" type="button" disabled={history.position === history.pages.length - 1} onClick={() => setHistory((previous) => ({ ...previous, position: previous.position + 1 }))} className="btn btn--quiet btn--compact press">
          {t('tools.organize.redo')}
        </button>
        <button id="organize-add-pdf-button" type="button" onClick={onAddFiles} className="btn btn--quiet btn--compact press">
          {t('tools.organize.addPdf')}
        </button>
        <button id="organize-pdf-button" type="button" disabled={pages.length === 0 || isWorking} onClick={() => void savePdf()} className="btn btn--primary press">
          {isWorking ? t('tools.working') : t('tools.organize.button')}
        </button>
      </div>
      {problemFiles.map((file) => (
        <p key={file.name} role="alert" className="text-center text-sm font-medium text-danger">
          <bdi>{file.name}</bdi>: {t(problemMessageKey((openedByFile.get(file) as { problem: 'encrypted' | 'unreadable' }).problem))}
        </p>
      ))}
      {isWorking && <ProgressBar id="tool-progress" done={0} total={0} label={t('tools.progress.working')} />}
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={error} />
      <PdfThumbnailGrid
        id="organize-grid"
        label={t('tools.grid.pagesLabel')}
        cards={cards}
        onReorder={movePage}
        renderActions={(card, index) => (
          <>
            <button id={`organize-earlier-${index + 1}`} type="button" aria-label={t('tools.grid.moveEarlier', { name: card.caption })} data-tip={t('tools.grid.moveEarlierShort')} disabled={index === 0} onClick={() => movePage(index, index - 1)} className={actionClass}>{icon('m15 6-6 6 6 6', true)}</button>
            <button id={`organize-later-${index + 1}`} type="button" aria-label={t('tools.grid.moveLater', { name: card.caption })} data-tip={t('tools.grid.moveLaterShort')} disabled={index === pages.length - 1} onClick={() => movePage(index, index + 1)} className={actionClass}>{icon('m9 6 6 6-6 6', true)}</button>
            <button id={`organize-rotate-left-${index + 1}`} type="button" aria-label={t('tools.organize.rotateLeft', { name: card.caption })} data-tip={t('tools.rotate.left')} onClick={() => turnPage(index, -90)} className={actionClass}>{icon('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5')}</button>
            <button id={`organize-rotate-right-${index + 1}`} type="button" aria-label={t('tools.organize.rotateRight', { name: card.caption })} data-tip={t('tools.rotate.right')} onClick={() => turnPage(index, 90)} className={actionClass}>{icon('M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5')}</button>
            <button id={`organize-duplicate-${index + 1}`} type="button" aria-label={t('tools.organize.duplicate', { name: card.caption })} data-tip={t('tools.organize.duplicateShort')} onClick={() => duplicatePage(index)} className={actionClass}>{icon('M9 9h11v11H9zM5 15H4V4h11v1')}</button>
            <button id={`organize-blank-after-${index + 1}`} type="button" aria-label={t('tools.organize.blankAfter', { name: card.caption })} data-tip={t('tools.organize.blankAfterShort')} onClick={() => void insertBlankPageAfter(index)} className={actionClass}>{icon('M6 3h9l4 4v14H6zM12 10v6M9 13h6')}</button>
            <button id={`organize-delete-${index + 1}`} type="button" aria-label={t('tools.organize.delete', { name: card.caption })} data-tip={t('tools.organize.deleteShort')} disabled={pages.length === 1} onClick={() => deletePage(index)} className={actionClass}>{icon('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13')}</button>
          </>
        )}
      />
    </div>
  )
}
