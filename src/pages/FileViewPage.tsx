import CsvViewer from '../components/CsvViewer'
import FileViewHeader from '../components/FileViewHeader'
import { getLargeFileWarning } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import { findViewerForFileName } from '../viewers'

type FileViewPageProps = {
  openedFile: OpenedFile
  onClose: () => void
  // Return false (or a promise of false) to stop "Open another file" from running, e.g. when there are unsaved edits.
  onBeforeClear?: () => boolean | Promise<boolean>
}

// The page a file opens on. CSV gets the full-page editor; the other types explain that previewing is not built yet.
export default function FileViewPage({ openedFile, onClose, onBeforeClear }: FileViewPageProps) {
  const viewer = findViewerForFileName(openedFile.file.name)

  if (viewer?.id === 'csv') {
    return <CsvViewer openedFile={openedFile} onClose={onClose} onBeforeClear={onBeforeClear} />
  }

  const largeFileWarning = getLargeFileWarning(openedFile.file)

  return (
    <div
      data-file-type={viewer?.id}
      className="min-h-dvh bg-paper font-sans text-[18px] leading-normal text-ink"
    >
      <FileViewHeader openedFile={openedFile} onClose={onClose} onBeforeClear={onBeforeClear} />

      <main id="main" className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {largeFileWarning && <p>{largeFileWarning}</p>}
        <section className="box-shape solid-box border-rule bg-paper-raised p-8">
          <h2 className="type-h3">{viewer?.label} preview is coming soon</h2>
          <p className="mt-2 text-ink-soft">
            The file was read in your browser and has not been uploaded. Previewing {viewer?.extensions.join(' and ')}{' '}
            files is not available yet.
          </p>
        </section>
      </main>
    </div>
  )
}
