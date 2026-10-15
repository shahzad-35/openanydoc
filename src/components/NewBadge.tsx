import { useT } from '../i18n'
import { findReleasedFormat, isNewFormat } from '../whatsNew'
import type { Viewer } from '../viewers'

// A small "New" pill next to a format's name while its release window is open (see NEW_WINDOW_DAYS). It has visible text, so
// colour is never the only signal, and a hidden comma before it makes a screen reader say "JSON viewer, New".
export default function NewBadge({ viewerId }: { viewerId: Viewer['id'] }) {
  const { t } = useT()
  const released = findReleasedFormat(viewerId)
  if (!released || !isNewFormat(released.definition)) return null
  return (
    <span
      data-file-type={viewerId}
      className="ms-2 inline-flex items-center rounded-full bg-(--file-color) px-2 py-px align-middle text-[11px] font-semibold leading-4 text-on-accent"
    >
      <span className="sr-only">, </span>
      {t('badge.new')}
    </span>
  )
}
