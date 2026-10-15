import type { ReactNode } from 'react'
import { joinNodesAsList, translateWithNodes, useT } from '../i18n'
import { getNewFormats } from '../whatsNew'
import type { Viewer } from '../viewers'

type WhatsNewBannerProps = {
  // The page the visitor is on: a format's own page does not announce that format.
  currentViewerId?: Viewer['id']
  // Changes the page without a reload. Without it (on a file page, where leaving could lose edits) links open in a new tab.
  onNavigate?: (path: string) => void
  onDismiss: () => void
  // Lines the row up with the home page's content column; on a file page it runs the full width like the other strips.
  isContained?: boolean
}

function BannerLink({ path, onNavigate, className, children, fileType }: { path: string; onNavigate?: (path: string) => void; className: string; children: ReactNode; fileType?: Viewer['id'] }) {
  return (
    <a
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

// A slim announcement under the header, built from the registry: it names only the formats that are new right now. Closing it
// is remembered by the page's React state for this tab only (see App.tsx); nothing is stored, and nothing takes focus or moves.
export default function WhatsNewBanner({ currentViewerId, onNavigate, onDismiss, isContained = false }: WhatsNewBannerProps) {
  const { locale, t } = useT()
  const announcedFormats = getNewFormats().filter(({ viewer }) => viewer.id !== currentViewerId)
  if (announcedFormats.length === 0) return null

  const canEditAll = announcedFormats.every(({ definition }) => definition.editing)
  const formatLinks = announcedFormats.map(({ viewer }) => (
    <BannerLink key={viewer.id} path={viewer.toolPath as string} onNavigate={onNavigate} fileType={viewer.id} className="font-semibold text-(--file-color) underline-offset-2 hover:underline">
      {viewer.label}
    </BannerLink>
  ))

  return (
    <div role="region" aria-label={t('banner.label')} className="relative z-10 border-b border-accent/25 bg-accent/10 backdrop-blur-sm">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-sm ${isContained ? 'mx-auto max-w-5xl' : ''}`}>
        <span className="control-shape shrink-0 bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">{t('badge.new')}</span>
        <p className="min-w-0 flex-1">{translateWithNodes(locale, canEditAll ? 'banner.openAndEdit' : 'banner.open', { formats: joinNodesAsList(locale, formatLinks) })}</p>
        <BannerLink
          path={`/${locale}/changelog`}
          onNavigate={onNavigate}
          className="control-shape shrink-0 border border-accent px-3 py-0.5 font-medium text-accent transition-colors duration-200 hover:bg-accent hover:text-on-accent"
        >
          {t('banner.changelog')}
        </BannerLink>
        <button
          type="button"
          aria-label={t('banner.close')}
          onClick={onDismiss}
          className="control-shape grid size-8 shrink-0 cursor-pointer place-items-center transition-colors duration-200 hover:bg-accent/15"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
