import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { joinNodesAsList, localizePath, translateWithNodes, useT } from '../i18n'
import { getNewFormats } from '../whatsNew'
import { useHasMounted } from './NewBadge'
import type { Viewer } from '../viewers'

type WhatsNewBannerProps = {
  // Changes the page without a reload. Without it, links open in a new tab.
  onNavigate?: (path: string) => void
  onDismiss: () => void
}

function BannerLink({ id, path, onNavigate, className, children, fileType }: { id?: string; path: string; onNavigate?: (path: string) => void; className: string; children: ReactNode; fileType?: Viewer['id'] }) {
  return (
    <a
      id={id}
      href={path}
      data-file-type={fileType}
      {...(onNavigate ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      onClick={(event) => {
        if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onNavigate(path)
      }}
      className={className}
    >
      {children}
    </a>
  )
}

// A small card floating at the bottom end of the home page (nothing in the page moves; on a phone it is just the title and the
// button, so it hides as little of the page as possible), built from the registry: it names only the formats that are new right now. It closes itself after a few seconds (and can be closed sooner). Closing it
// is remembered by the page's React state for this tab only (see App.tsx); nothing is stored, and nothing takes focus or moves.
// How long the card stays before it closes itself. It waits while the pointer is over it or something inside has focus.
const AUTO_CLOSE_MILLISECONDS = 3000
// ...then it fades out over this long (instantly under reduced motion) before it is removed.
const FADE_MILLISECONDS = 1000

export default function WhatsNewBanner({ onNavigate, onDismiss }: WhatsNewBannerProps) {
  const { locale, t } = useT()
  // "New" depends on today's date, so it is worked out only in the browser (see useHasMounted).
  const announcedFormats = useHasMounted() ? getNewFormats() : []
  const hasAnnouncement = announcedFormats.length > 0
  const [isPaused, setIsPaused] = useState(false)
  const [isFading, setIsFading] = useState(false)
  // Pointing at it or focusing it stops the countdown and brings back a half-faded one.
  const pause = () => {
    setIsPaused(true)
    setIsFading(false)
  }
  const resume = () => setIsPaused(false)
  useEffect(() => {
    if (!hasAnnouncement || isPaused) return
    const fadeTimerId = window.setTimeout(() => setIsFading(true), AUTO_CLOSE_MILLISECONDS)
    const removeTimerId = window.setTimeout(onDismiss, AUTO_CLOSE_MILLISECONDS + FADE_MILLISECONDS)
    return () => {
      window.clearTimeout(fadeTimerId)
      window.clearTimeout(removeTimerId)
    }
  }, [hasAnnouncement, isPaused, onDismiss])
  if (!hasAnnouncement) return null

  const canEditAll = announcedFormats.every(({ definition }) => definition.editing)
  const formatLinks = announcedFormats.map(({ viewer }) => (
    <BannerLink key={viewer.id} id={`banner-link-${viewer.id}`} path={localizePath(locale, viewer.toolPath as string)} onNavigate={onNavigate} fileType={viewer.id} className="font-semibold text-(--file-color) underline-offset-2 hover:underline">
      {viewer.label}
    </BannerLink>
  ))

  return (
    <div
      id="whats-new-banner"
      role="region"
      aria-label={t('banner.label')}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`transition-opacity duration-1000 ease-out ${isFading ? 'opacity-0' : 'opacity-100'} fixed inset-x-0 bottom-4 z-20 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-1 overflow-hidden rounded-full bg-paper-raised p-1 shadow-[0_8px_28px_-8px_rgb(15_26_51/0.28)] sm:inset-x-auto sm:end-5 sm:bottom-5 sm:mx-0 sm:block sm:w-72 sm:rounded-2xl sm:p-4`}
    >
      <BannerLink
        id="banner-changelog-link-compact"
        path={localizePath(locale, '/changelog')}
        onNavigate={onNavigate}
        className="flex min-h-9 min-w-0 items-center gap-2 rounded-full pe-2 ps-1 font-medium text-ink sm:hidden"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M5 12v8h14v-8M12 8v12M12 8C9 8 7.5 6.5 8 5c.7-1.6 3.5-.8 4 3 .5-3.8 3.3-4.6 4-3 .5 1.5-1 3-4 3Z" />
          </svg>
        </span>
        <span className="truncate text-sm">{t('banner.title')}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </BannerLink>
      <svg
        id="banner-gift"
        aria-hidden="true"
        viewBox="0 0 96 96"
        className="pointer-events-none absolute -bottom-2 end-3 hidden size-16 text-ink/10 sm:block"
        fill="currentColor"
      >
        <path d="M48 36C38 36 30 30 32 21c2-8 12-8 16 4 4-12 14-12 16-4 2 9-6 15-16 15Zm-10-9c-1 4 3 6 10 6-1-5-5-9-10-6Zm20 0c-5-3-9 1-10 6 7 0 11-2 10-6Z" />
        <rect x="6" y="34" width="84" height="18" rx="9" />
        <rect x="14" y="52" width="68" height="50" />
        <rect x="41" y="52" width="14" height="50" fill="var(--paper-raised)" fillOpacity="0.55" />
      </svg>
      <button
        id="banner-close-button"
        type="button"
        aria-label={t('banner.close')}
        onClick={onDismiss}
        className="control-shape grid size-8 shrink-0 cursor-pointer place-items-center text-ink-soft transition-colors duration-200 hover:bg-paper hover:text-ink sm:absolute sm:end-2 sm:top-2 sm:size-7"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <p id="banner-title" className="hidden pe-8 font-[family-name:var(--font-display)] text-base font-semibold leading-tight sm:block">{t('banner.title')}</p>
      <p id="banner-message" className="mt-1 hidden text-sm leading-snug text-ink-soft sm:block sm:pe-16">
        {translateWithNodes(locale, canEditAll ? 'banner.openAndEdit' : 'banner.open', { formats: joinNodesAsList(locale, formatLinks) })}
      </p>
      <BannerLink
        id="banner-changelog-link"
        path={localizePath(locale, '/changelog')}
        onNavigate={onNavigate}
        className="control-shape mt-2 hidden min-h-7 items-center gap-1 bg-paper px-2.5 text-xs font-medium text-ink transition-colors duration-200 hover:bg-rule/60 pointer-coarse:min-h-10 sm:mt-2.5 sm:inline-flex"
      >
        {t('banner.changelog')}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </BannerLink>
    </div>
  )
}
