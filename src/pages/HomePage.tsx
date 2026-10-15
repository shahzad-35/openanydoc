import { Suspense, lazy, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import AboutContent from '../components/AboutContent'
import FormatGuide from '../components/FormatGuide'
import DropPanel from '../components/DropPanel'
import NewBadge from '../components/NewBadge'
import WhatsNewBanner from '../components/WhatsNewBanner'
import { useT } from '../i18n'
import { pageSeo } from '../seo'
import ThemeToggle from '../components/ThemeToggle'
import { footerText } from '../content'
import { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'

const AuroraBackdrop = lazy(() => import('../backdrop/AuroraBackdrop'))

// Footer links read quietly until hovered.
const footerLinkClassName = 'text-ink-soft underline-offset-2 hover:text-ink hover:underline'

const pagesWithOwnAddress = viewers.filter((viewer) => viewer.toolPath)

// A link that changes the page without reloading (the app has no router package); modified clicks open a new tab as usual.
function PageLink({ id, path, onNavigate, children, className = 'underline underline-offset-2 hover:text-ink' }: { id?: string; path: string; onNavigate: (path: string) => void; children: ReactNode; className?: string }) {
  return (
    <a
      id={id}
      href={path}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onNavigate(path)
      }}
      className={className}
    >
      {children}
    </a>
  )
}

// The whole screen is the drop target: a file dropped anywhere on the page opens, over a slow field of drifting particles.
// With `toolViewer` it is that format's own page (/json-viewer ...): the same screen for one format.
export default function HomePage({
  onFileLoaded,
  onNavigate,
  toolViewer,
  isBannerDismissed,
  onDismissBanner,
  handoffFile,
  onHandoffConsumed,
  onOpenInViewer,
}: {
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
  onNavigate: (path: string) => void
  toolViewer?: Viewer
  isBannerDismissed: boolean
  onDismissBanner: () => void
  handoffFile: File | null
  onHandoffConsumed: () => void
  onOpenInViewer: (file: File, toolPath: string) => void
}) {
  const { t } = useT()
  // The animated backdrop is decoration: it is fetched only after the page has appeared and the browser is idle, and not at all
  // when the visitor asked their browser to save data.
  const [isBackdropWanted, setIsBackdropWanted] = useState(false)
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    if (saveData) return
    const wantBackdrop = () => setIsBackdropWanted(true)
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(wantBackdrop, { timeout: 2000 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timerId = setTimeout(wantBackdrop, 500)
    return () => clearTimeout(timerId)
  }, [])

  const intake = useFileIntake({ acceptedExtensions: toolViewer?.extensions ?? supportedExtensions, onFileLoaded, handoffFile, onHandoffConsumed })

  // Each format's page gets its own title and description for search results and browser tabs.
  useEffect(() => {
    if (!toolViewer) return
    const previousTitle = document.title
    const descriptionTag = document.querySelector('meta[name="description"]')
    const previousDescription = descriptionTag?.getAttribute('content') ?? ''
    const seo = pageSeo[toolViewer.toolPath as string]
    document.title = seo.title
    descriptionTag?.setAttribute('content', seo.description)
    return () => {
      document.title = previousTitle
      descriptionTag?.setAttribute('content', previousDescription)
    }
  }, [toolViewer])

  return (
    <div id="home-page" {...intake.dropTargetProps} className="relative min-h-dvh bg-paper font-sans text-[18px] leading-normal text-ink">
      <div id="page-backdrop" aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        {isBackdropWanted && (
          <Suspense fallback={null}>
            <AuroraBackdrop />
          </Suspense>
        )}
      </div>
      {intake.isDraggingOver && (
        <div id="drag-over-outline" aria-hidden="true" className="pointer-events-none fixed inset-3 z-20 box-shape border-2 border-dashed border-accent" />
      )}

      <a
        id="skip-to-content-link"
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <div className="relative z-10">
        <header id="site-header" className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <p id="site-brand" className="type-h3">{toolViewer ? <PageLink id="brand-home-link" path="/" onNavigate={onNavigate}>OpenAnyDoc</PageLink> : 'OpenAnyDoc'}</p>
          <ThemeToggle />
        </header>

        {/* What's new is announced on the home page only, not on a format's own page. */}
        {!toolViewer && !isBannerDismissed && <WhatsNewBanner onNavigate={onNavigate} onDismiss={onDismissBanner} isContained />}

        <main id="main" className="mx-auto max-w-5xl px-4 pb-20">
          <section id="hero" className="flex min-h-[calc(100dvh-6rem)] flex-col justify-center py-8 text-center">
            <h1 id="page-heading" className="type-h1 mx-auto max-w-3xl text-balance">{toolViewer ? pageSeo[toolViewer.toolPath as string].heading : pageSeo['/'].heading}</h1>
            <p id="page-intro" className="mb-8 mt-3 text-ink-soft">{toolViewer ? pageSeo[toolViewer.toolPath as string].intro : pageSeo['/'].intro}</p>
            <DropPanel
              intake={intake}
              shownViewers={toolViewer ? [toolViewer] : viewers}
              currentViewerId={toolViewer?.id}
              onNavigate={onNavigate}
              onOpenInViewer={onOpenInViewer}
            />
          </section>

          <div id="about-content" className="box-shape mt-12 bg-paper-raised/90 p-6 backdrop-blur-md md:p-10">
            {toolViewer ? <FormatGuide address={toolViewer.toolPath as string} viewerId={toolViewer.id} /> : <AboutContent />}
          </div>
        </main>

        <footer id="site-footer" className="border-t border-rule bg-paper-raised/80 backdrop-blur-md">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <p className="type-h3">OpenAnyDoc</p>
              <p className="mt-2 max-w-xs text-ink-soft">{footerText}</p>
            </div>
            <nav id="footer-viewers" aria-label={t('footer.viewers')}>
              <h2 className="font-semibold">{t('footer.viewers')}</h2>
              <ul className="mt-3 space-y-2">
                {pagesWithOwnAddress
                  .filter((viewer) => viewer !== toolViewer)
                  .map((viewer) => (
                    <li key={viewer.id} className="flex items-center">
                      <PageLink id={`footer-link-${viewer.id}`} path={viewer.toolPath as string} onNavigate={onNavigate} className={footerLinkClassName}>
                        {viewer.label} viewer
                      </PageLink>
                      <NewBadge viewerId={viewer.id} />
                    </li>
                  ))}
              </ul>
            </nav>
            <nav id="footer-more" aria-label={t('footer.more')}>
              <h2 className="font-semibold">{t('footer.more')}</h2>
              <ul className="mt-3 space-y-2">
                {toolViewer && (
                  <li>
                    <PageLink id="footer-link-all-types" path="/" onNavigate={onNavigate} className={footerLinkClassName}>
                      {t('footer.allTypes')}
                    </PageLink>
                  </li>
                )}
                {!toolViewer && (
                  <li>
                    <PageLink id="footer-link-changelog" path="/en/changelog" onNavigate={onNavigate} className={footerLinkClassName}>
                      {t('footer.whatsNew')}
                    </PageLink>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  )
}
