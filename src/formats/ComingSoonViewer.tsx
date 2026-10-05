import { getLargeFileWarning } from '../useFileIntake'
import { findViewerForFileName } from '../viewers'
import type { FormatViewerProps } from './registry'

// Stands in for formats whose preview is not built yet.
export default function ComingSoonViewer({ openedFile }: FormatViewerProps) {
  const viewer = findViewerForFileName(openedFile.file.name)
  const largeFileWarning = getLargeFileWarning(openedFile.file)

  return (
    <main id="main" className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
      {largeFileWarning && <p>{largeFileWarning}</p>}
      <section className="box-shape solid-box border-rule bg-paper-raised p-8">
        <h2 className="type-h3">{viewer?.label} preview is coming soon</h2>
        <p className="mt-2 text-ink-soft">
          The file was read in your browser and has not been uploaded. Previewing {viewer?.extensions.join(' and ')} files is
          not available yet.
        </p>
      </section>
    </main>
  )
}
