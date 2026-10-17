import { useSyncExternalStore } from 'react'
import { useT } from '../i18n'
import { findReleasedFormat, isNewFormat } from '../whatsNew'
import type { Viewer } from '../viewers'

const subscribeToNothing = () => () => {}

// False in the build's server render and in the first browser render that takes over its markup, true after that. Anything that
// depends on today's date or the browser is drawn only once this is true, so the two renders match (no hydration mismatch).
// oxlint-disable-next-line react/only-export-components
export function useHasMounted() {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false)
}

// A small "New" pill next to a format's name while its release window is open (see NEW_WINDOW_DAYS). It has visible text, so
// colour is never the only signal, and a hidden comma before it makes a screen reader say "JSON viewer, New".
export default function NewBadge({ viewerId }: { viewerId: Viewer['id'] }) {
  const { t } = useT()
  const hasMounted = useHasMounted()
  const released = findReleasedFormat(viewerId)
  if (!hasMounted || !released || !isNewFormat(released.definition)) return null
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
