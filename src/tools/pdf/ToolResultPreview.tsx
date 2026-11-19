// What a tool made, shown before it is downloaded: a PDF's first pages and page count, a ZIP's files, a picture, or the start of a
// text file. Loaded with the result only.
import { useEffect, useState } from 'react'
import { unzipSync } from 'fflate'
import { isolateLeftToRight, useT } from '../../i18n'
import { formatFileSize } from '../../useFileIntake'
import { PdfThumbnailGrid, useOpenedPdfs } from './PdfToolParts'
import type { GridCard } from './PdfToolParts'

const PREVIEW_PAGE_COUNT = 8
const PREVIEW_LINE_COUNT = 12
const PREVIEW_ZIP_ENTRY_COUNT = 30

function PdfPreview({ file }: { file: File }) {
  const { t, tp } = useT()
  const opened = useOpenedPdfs([file]).get(file)
  if (opened && 'problem' in opened && opened.problem === 'encrypted') {
    return (
      <p id="tool-result-summary" className="text-sm text-ink-soft">
        {t('tools.preview.protected')}
      </p>
    )
  }
  if (!opened || !('document' in opened)) return null
  const cards: GridCard[] = Array.from({ length: Math.min(PREVIEW_PAGE_COUNT, opened.document.numPages) }, (_, pageIndex) => ({ key: `preview-${pageIndex}`, caption: String(pageIndex + 1), document: opened.document, pageIndex }))
  return (
    <>
      <p id="tool-result-summary" className="text-sm text-ink-soft">
        {tp('tools.pdf.pages', opened.document.numPages)}
        {opened.document.numPages > PREVIEW_PAGE_COUNT && ` · ${t('tools.preview.firstPages', { count: PREVIEW_PAGE_COUNT })}`}
      </p>
      <PdfThumbnailGrid id="tool-result-pages" label={t('tools.preview.label')} cards={cards} />
    </>
  )
}

function ZipPreview({ file }: { file: File }) {
  const { tp } = useT()
  const [entries, setEntries] = useState<{ name: string; size: number }[] | null>(null)
  useEffect(() => {
    let isCurrent = true
    void file.arrayBuffer().then((bytes) => {
      const listed: { name: string; size: number }[] = []
      // Only the list of files is read; nothing is unpacked.
      unzipSync(new Uint8Array(bytes), { filter: (entry) => (listed.push({ name: entry.name, size: entry.originalSize }), false) })
      if (isCurrent) setEntries(listed)
    })
    return () => {
      isCurrent = false
    }
  }, [file])
  if (!entries) return null
  return (
    <>
      <p id="tool-result-summary" className="text-sm text-ink-soft">{tp('tools.preview.files', entries.length)}</p>
      <ul id="tool-result-files" className="mx-auto max-h-64 max-w-[480px] overflow-auto text-start text-sm">
        {entries.slice(0, PREVIEW_ZIP_ENTRY_COUNT).map((entry) => (
          <li key={entry.name} className="flex justify-between gap-3 border-b border-rule py-1">
            <bdi className="truncate">{entry.name}</bdi>
            <span className="shrink-0 text-ink-soft">{isolateLeftToRight(formatFileSize(entry.size))}</span>
          </li>
        ))}
        {entries.length > PREVIEW_ZIP_ENTRY_COUNT && <li className="py-1 text-ink-soft">…</li>}
      </ul>
    </>
  )
}

function TextPreview({ file }: { file: File }) {
  const [firstLines, setFirstLines] = useState('')
  useEffect(() => {
    let isCurrent = true
    void file.text().then((text) => isCurrent && setFirstLines(text.split('\n').slice(0, PREVIEW_LINE_COUNT).join('\n')))
    return () => {
      isCurrent = false
    }
  }, [file])
  return (
    <pre id="tool-result-text" dir="auto" className="mx-auto max-h-64 max-w-[560px] overflow-auto whitespace-pre-wrap rounded-[14px] bg-surface p-4 text-start text-sm">
      {firstLines}
    </pre>
  )
}

function ImagePreview({ file }: { file: File }) {
  const { t } = useT()
  const [imageUrl, setImageUrl] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return imageUrl ? <img id="tool-result-image" src={imageUrl} alt={t('tools.preview.label')} className="mx-auto max-h-80 rounded-[10px] border border-rule" /> : null
}

export default function ToolResultPreview({ file }: { file: File }) {
  return (
    <div id="tool-result-preview" className="mt-4 space-y-3">
      {file.type === 'application/pdf' && <PdfPreview file={file} />}
      {file.type === 'application/zip' && <ZipPreview file={file} />}
      {file.type.startsWith('text/') && <TextPreview file={file} />}
      {file.type.startsWith('image/') && <ImagePreview file={file} />}
    </div>
  )
}
