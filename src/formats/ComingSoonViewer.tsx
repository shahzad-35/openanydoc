import { isolateLeftToRight, useT } from '../i18n'
import { getLargeFileWarning } from '../useFileIntake'
import { findViewerForFileName } from '../viewers'
import type { FormatViewerProps } from './registry'

// Stands in for formats whose preview is not built yet.
export default function ComingSoonViewer({ openedFile }: FormatViewerProps) {
  const { locale, t } = useT()
  const viewer = findViewerForFileName(openedFile.file.name)
  const largeFileWarning = getLargeFileWarning(openedFile.file, locale)

  return (
    <main id="main" className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
      {largeFileWarning && <p>{largeFileWarning}</p>}
      <section className="box-shape solid-box border-rule bg-paper-raised p-8">
        <h2 className="type-h3">{t('comingSoon.title', { format: viewer?.label ?? '' })}</h2>
        <p className="mt-2 text-ink-soft">
          {t('comingSoon.text', { extensions: isolateLeftToRight(viewer?.extensions.join(' / ') ?? '') })}
        </p>
      </section>
    </main>
  )
}
