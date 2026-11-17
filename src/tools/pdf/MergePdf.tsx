import { useState } from 'react'
import { isolateText, useT } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'
import type { OutputPage } from './pdfTasks'
import { PdfThumbnailGrid, ProgressBar, baseNameOf, pdfResultFile, problemMessageKey, useOpenedPdfs } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

// Merge PDF: the chosen PDFs, shown by their first page and reordered by dragging (or the arrow buttons), become one PDF.
export default function MergePdf({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t, tp } = useT()
  const openedByFile = useOpenedPdfs(files)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // An error belongs to the files it was about; changing the list clears it.
  const [error, setError] = useState<{ files: File[]; message: string } | null>(null)
  const errorMessage = error?.files === files ? error.message : ''

  // Keyed by the file (and how often it was chosen before), not by position, so a moved card keeps its drawn page.
  const timesSeen = new Map<File, number>()
  const cards: GridCard[] = files.map((file) => {
    const opened = openedByFile.get(file)
    timesSeen.set(file, (timesSeen.get(file) ?? 0) + 1)
    const key = `${file.name}-${file.size}-${file.lastModified}-${timesSeen.get(file)}`
    if (!opened) return { key, caption: file.name, problem: t('tools.pdf.reading') }
    if ('problem' in opened) return { key, caption: file.name, problem: t(problemMessageKey(opened.problem)) }
    return { key, caption: `${file.name} · ${tp('tools.pdf.pages', opened.document.numPages)}`, document: opened.document, pageIndex: 0 }
  })
  const isEveryFileReady = files.every((file) => { const opened = openedByFile.get(file); return opened && 'document' in opened })

  function moveFile(fromIndex: number, toIndex: number) {
    const reorderedFiles = [...files]
    const [movedFile] = reorderedFiles.splice(fromIndex, 1)
    reorderedFiles.splice(toIndex, 0, movedFile)
    onFilesChange(reorderedFiles)
  }

  async function mergeFiles() {
    const pages: OutputPage[] = files.flatMap((file, sourceIndex) => {
      const opened = openedByFile.get(file)
      const pageCount = opened && 'document' in opened ? opened.document.numPages : 0
      return Array.from({ length: pageCount }, (_, pageIndex) => ({ sourceIndex, pageIndex, rotation: 0 }))
    })
    setProgress({ done: 0, total: 0 })
    const response = await runPdfTask({ type: 'build-pdf', sources: await Promise.all(files.map((file) => file.arrayBuffer())), pages }).catch(() => null)
    setProgress(null)
    if (response?.status === 'ok' && response.pdf) onResult(pdfResultFile(response.pdf, `${baseNameOf(files[0].name)}-merged.pdf`))
    else setError({ files, message: t(response?.status === 'error' && response.reason === 'encrypted' ? 'tools.pdf.mergeEncrypted' : 'tools.pdf.mergeFailed') })
  }

  const moveButtonClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  return (
    <div id="merge-pdf-tool" className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t('tools.merge.dragHint')}</p>
      <PdfThumbnailGrid
        id="merge-pdf-grid"
        label={t('tools.merge.filesLabel')}
        cards={cards}
        onReorder={moveFile}
        renderActions={(card, index) => (
          <>
            <button id={`merge-pdf-earlier-${index + 1}`} type="button" aria-label={t('tools.grid.moveEarlier', { name: files[index].name })} disabled={index === 0} onClick={() => moveFile(index, index - 1)} className={moveButtonClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <button id={`merge-pdf-later-${index + 1}`} type="button" aria-label={t('tools.grid.moveLater', { name: files[index].name })} disabled={index === files.length - 1} onClick={() => moveFile(index, index + 1)} className={moveButtonClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <button id={`merge-pdf-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: files[index].name })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={moveButtonClass}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
            <span className="sr-only">{card.caption}</span>
          </>
        )}
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="pdf-add-files-button" type="button" onClick={onAddFiles} className="btn btn--quiet press">
          {t('tools.file.addMore')}
        </button>
        <button id="merge-pdf-button" type="button" disabled={files.length < 2 || !isEveryFileReady || progress !== null} onClick={() => void mergeFiles()} className="btn btn--primary press">
          {progress ? t('tools.working') : t('tools.merge.button')}
        </button>
      </div>
      {progress && <ProgressBar id="tool-progress" done={progress.done} total={progress.total} label={t('tools.progress.working')} />}
      {files.length === 1 && <p id="merge-pdf-hint" className="text-center text-sm text-ink-soft">{t('tools.merge.needTwo', { name: isolateText(files[0].name) })}</p>}
      <Notice id="merge-pdf-error" kind="error" role="alert" className="text-center font-medium text-danger" message={errorMessage} />
    </div>
  )
}
