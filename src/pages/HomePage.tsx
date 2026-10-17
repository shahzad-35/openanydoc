import { Suspense, lazy, useEffect, useState } from 'react'
import AboutContent from '../components/AboutContent'
import FormatGuide from '../components/FormatGuide'
import DropPanel from '../components/DropPanel'
import WhatsNewBanner from '../components/WhatsNewBanner'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { LOCALES, localizePath, useT } from '../i18n'
import { SITE_ORIGIN, getShareImage, openGraphLocales, pageSeo } from '../seo'
import SiteFooter, { PageLink } from '../components/SiteFooter'
import ThemeToggle from '../components/ThemeToggle'
import { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'

const AuroraBackdrop = lazy(() => import('../backdrop/AuroraBackdrop'))

function setMetaTag(keyAttribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector(`meta[${keyAttribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(keyAttribute, key)
    document.head.append(tag)
  }
  tag.setAttribute('content', content)
}

function setLinkTag(rel: string, href: string, hreflang?: string) {
  let tag = document.head.querySelector(hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    if (hreflang) tag.setAttribute('hreflang', hreflang)
    document.head.append(tag)
  }
  tag.setAttribute('href', href)
}

// The <head> tags scripts/build-static-pages.mjs writes for each page, set again when the page changes without a reload, so the
// title, description, canonical, language alternates and share tags always describe the page shown. `address` is the page
// without its language ('/csv-viewer'). <html lang> and dir are set by App.
// oxlint-disable-next-line react/only-export-components
export function usePageHead(address: string, title: string, description: string) {
  const { locale } = useT()
  useEffect(() => {
    const pageUrl = `${SITE_ORIGIN}${localizePath(locale, address)}`
    const shareImage = getShareImage(locale, address)
    document.title = title
    setMetaTag('name', 'description', description)
    setLinkTag('canonical', pageUrl)
    for (const alternateLocale of LOCALES) setLinkTag('alternate', `${SITE_ORIGIN}${localizePath(alternateLocale, address)}`, alternateLocale)
    setLinkTag('alternate', `${SITE_ORIGIN}${localizePath('en', address)}`, 'x-default')
    setMetaTag('property', 'og:title', title)
    setMetaTag('property', 'og:description', description)
    setMetaTag('property', 'og:url', pageUrl)
    setMetaTag('property', 'og:image', `${SITE_ORIGIN}${shareImage.path}`)
    setMetaTag('property', 'og:image:alt', shareImage.alt)
    setMetaTag('property', 'og:locale', openGraphLocales[locale])
    setMetaTag('property', 'og:locale:alternate', openGraphLocales[locale === 'en' ? 'ar' : 'en'])
    setMetaTag('name', 'twitter:title', title)
    setMetaTag('name', 'twitter:description', description)
    setMetaTag('name', 'twitter:image', `${SITE_ORIGIN}${shareImage.path}`)
  }, [locale, address, title, description])
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
  const { locale, t } = useT()
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

  // Each page gets its own title and description, in the page's language, for search results and browser tabs.
  const address = toolViewer?.toolPath ?? '/'
  const seo = pageSeo[locale][address]
  usePageHead(address, seo.title, seo.description)

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
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('skip.toContent')}
      </a>

      <div className="relative z-10">
        <header id="site-header" className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <p id="site-brand" className="type-h3">{toolViewer ? <PageLink id="brand-home-link" path="/" onNavigate={onNavigate}>OpenAnyDoc</PageLink> : 'OpenAnyDoc'}</p>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        {/* What's new is announced on the home page only, not on a format's own page. */}
        {!toolViewer && !isBannerDismissed && <WhatsNewBanner onNavigate={onNavigate} onDismiss={onDismissBanner} />}

        <main id="main" className="mx-auto max-w-5xl px-4 pb-20">
          <section id="hero" className="flex min-h-[calc(100dvh-6rem)] flex-col justify-center py-8 text-center">
            <h1 id="page-heading" className="type-h1 mx-auto max-w-3xl text-balance">{seo.heading}</h1>
            <p id="page-intro" className="mb-8 mt-3 text-ink-soft">{seo.intro}</p>
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

        <SiteFooter currentPath={address} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
