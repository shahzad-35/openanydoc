import { useEffect, useState } from 'react'
import { isolateLeftToRight, isolateText, useT } from '../../i18n'
import { Notice } from '../../components/Messages'
import { formatFileSize } from '../../useFileIntake'
import type { ToolProps } from '../registry'
import { runPdfTask } from './pdfTasks'

// What reading a chosen PDF found: its page count, or why it cannot be used.
type PdfCheck = { pageCount: number } | { problem: 'encrypted' | 'unreadable' }

// The chosen PDFs, each with its size and page count (or why it cannot be read), with buttons to reorder and remove them, and
// (when `onAddFiles` is given) to add more. Shared by the PDF tools; the list order is the order the tool uses.
export function PdfFileList({ files, onFilesChange, onAddFiles }: { files: File[]; onFilesChange: (files: File[]) => void; onAddFiles?: () => void }) {
  const { t, tp } = useT()
  const [checksByFile, setChecksByFile] = useState(new Map<File, PdfCheck>())

  // One file at a time: each finished check runs this again for the next unchecked file.
  useEffect(() => {
    const uncheckedFile = files.find((file) => !checksByFile.has(file))
    if (!uncheckedFile) return
    let isCurrent = true
    void uncheckedFile
      .arrayBuffer()
      .then((pdf) => runPdfTask({ type: 'count-pages', pdf }))
      .catch(() => null)
      .then((response) => {
        const check: PdfCheck = response?.status === 'ok' ? { pageCount: response.pageCount ?? 0 } : { problem: response?.status === 'error' ? response.reason : 'unreadable' }
        if (isCurrent) setChecksByFile((checks) => new Map(checks).set(uncheckedFile, check))
      })
    return () => {
      isCurrent = false
    }
  }, [files, checksByFile])

  function moveFile(fromIndex: number, toIndex: number) {
    const reorderedFiles = [...files]
    const [movedFile] = reorderedFiles.splice(fromIndex, 1)
    reorderedFiles.splice(toIndex, 0, movedFile)
    onFilesChange(reorderedFiles)
  }

  const iconButtonClass = 'grid size-11 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-40'
  return (
    <div id="pdf-file-list" className="mx-auto max-w-[640px] text-start">
      <ol className="divide-y divide-rule rounded-[18px] border-2 border-rule bg-paper-raised">
        {files.map((file, index) => {
          const check = checksByFile.get(file)
          return (
            <li key={`${file.name}-${index}`} id={`pdf-file-${index + 1}`} className="flex items-center gap-2 py-2 ps-4 pe-2">
              <span aria-hidden="true" className="nav-icon nav-icon-pdf shrink-0" />
              <span className="min-w-0 flex-1">
                <bdi className="block truncate font-medium">{file.name}</bdi>
                <span className={`block text-sm ${check && 'problem' in check ? 'text-danger' : 'text-ink-soft'}`}>
                  {!check ? t('tools.pdf.reading') : 'problem' in check ? t(check.problem === 'encrypted' ? 'tools.pdf.encrypted' : 'tools.pdf.unreadable') : `${tp('tools.pdf.pages', check.pageCount)} · ${isolateLeftToRight(formatFileSize(file.size))}`}
                </span>
              </span>
              {files.length > 1 && (
                <>
                  <button id={`pdf-file-up-${index + 1}`} type="button" aria-label={t('tools.file.moveUp', { name: file.name })} disabled={index === 0} onClick={() => moveFile(index, index - 1)} className={iconButtonClass}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
                  </button>
                  <button id={`pdf-file-down-${index + 1}`} type="button" aria-label={t('tools.file.moveDown', { name: file.name })} disabled={index === files.length - 1} onClick={() => moveFile(index, index + 1)} className={iconButtonClass}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </>
              )}
              <button id={`pdf-file-remove-${index + 1}`} type="button" aria-label={t('tools.file.remove', { name: file.name })} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))} className={iconButtonClass}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </li>
          )
        })}
      </ol>
      {onAddFiles && (
        <p className="mt-3 text-center">
          <button id="pdf-add-files-button" type="button" onClick={onAddFiles} className="btn btn--quiet btn--compact press">
            {t('tools.file.addMore')}
          </button>
        </p>
      )}
    </div>
  )
}

// Merge PDF: the chosen PDFs, in the order shown, become one PDF.
export default function MergePdf({ files, onFilesChange, onAddFiles, onResult }: ToolProps) {
  const { t } = useT()
  const [isMerging, setIsMerging] = useState(false)
  // An error belongs to the files it was about; changing the list clears it.
  const [error, setError] = useState<{ files: File[]; message: string } | null>(null)
  const errorMessage = error?.files === files ? error.message : ''

  async function mergeFiles() {
    setIsMerging(true)
    const response = await runPdfTask({ type: 'merge', pdfs: await Promise.all(files.map((file) => file.arrayBuffer())) }).catch(() => null)
    setIsMerging(false)
    if (response?.status === 'ok' && response.pdf) onResult(new File([response.pdf as BlobPart], 'merged.pdf', { type: 'application/pdf' }))
    else setError({ files, message: t(response?.status === 'error' && response.reason === 'encrypted' ? 'tools.pdf.mergeEncrypted' : 'tools.pdf.mergeFailed') })
  }

  return (
    <div id="merge-pdf-tool" className="space-y-4">
      <PdfFileList files={files} onFilesChange={onFilesChange} onAddFiles={onAddFiles} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button id="merge-pdf-button" type="button" disabled={files.length < 2 || isMerging} onClick={() => void mergeFiles()} className="btn btn--primary press">
          {isMerging ? t('tools.working') : t('tools.merge.button')}
        </button>
      </div>
      {files.length === 1 && <p id="merge-pdf-hint" className="text-center text-sm text-ink-soft">{t('tools.merge.needTwo', { name: isolateText(files[0].name) })}</p>}
      <Notice id="merge-pdf-error" kind="error" role="alert" className="text-center font-medium text-danger" message={errorMessage} />
    </div>
  )
}
