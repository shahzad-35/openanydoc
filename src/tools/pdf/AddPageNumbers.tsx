import { useState } from 'react'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { PdfFileList } from './MergePdf'
import { runPdfTask } from './pdfTasks'
import type { PageNumberPosition } from './pdfTasks'

const positions: PageNumberPosition[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left']
const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'

// Add page numbers: draws 1, 2, 3 ... (from the chosen first number) on every page of one PDF.
export default function AddPageNumbers({ files, onFilesChange, onResult }: ToolProps) {
  const { t } = useT()
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center')
  const [firstNumber, setFirstNumber] = useState(1)
  const [isNumbering, setIsNumbering] = useState(false)
  // An error belongs to the files it was about; changing the list clears it.
  const [error, setError] = useState<{ files: File[]; message: string } | null>(null)
  const errorMessage = error?.files === files ? error.message : ''
  const chosenFile = files[0]

  async function addPageNumbers() {
    setIsNumbering(true)
    const response = await runPdfTask({ type: 'add-page-numbers', pdf: await chosenFile.arrayBuffer(), position, firstNumber }).catch(() => null)
    setIsNumbering(false)
    if (response?.status === 'ok' && response.pdf) onResult(new File([response.pdf as BlobPart], chosenFile.name.replace(/(\.pdf)?$/i, '-numbered.pdf'), { type: 'application/pdf' }))
    else setError({ files, message: t(response?.status === 'error' && response.reason === 'encrypted' ? 'tools.pdf.encrypted' : 'tools.pdf.unreadable') })
  }

  return (
    <div id="add-page-numbers-tool" className="space-y-4">
      <PdfFileList files={files} onFilesChange={onFilesChange} />
      <div className="flex flex-wrap items-end justify-center gap-4 text-start">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.pageNumbers.position')}
          <select id="page-number-position-select" value={position} onChange={(event) => setPosition(event.target.value as PageNumberPosition)} className={fieldClass}>
            {positions.map((option) => (
              <option key={option} value={option}>
                {t(`tools.pageNumbers.position.${option}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('tools.pageNumbers.firstNumber')}
          <input id="page-number-first-input" type="number" min="0" dir="ltr" value={firstNumber} onChange={(event) => setFirstNumber(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className={`${fieldClass} w-28`} />
        </label>
        <button id="add-page-numbers-button" type="button" disabled={!chosenFile || isNumbering} onClick={() => void addPageNumbers()} className="btn btn--primary press">
          {isNumbering ? t('tools.working') : t('tools.pageNumbers.button')}
        </button>
      </div>
      <Notice id="add-page-numbers-error" kind="error" role="alert" className="text-center font-medium text-danger" message={errorMessage} />
    </div>
  )
}
