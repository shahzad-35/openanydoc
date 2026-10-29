import { useEffect, useState } from 'react'
import DropPanel from '../components/DropPanel'
import FormatGuide from '../components/FormatGuide'
import LanguageSwitcher from '../components/LanguageSwitcher'
import SiteFooter, { PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import WhatsNewBanner from '../components/WhatsNewBanner'
import DemoStage from '../components/home/DemoStage'
import { ClosingCta, DemoNote, FaqSection, FormatGrid, PrivacyContrast, StatsRow } from '../components/home/HomeSections'
import { Wordmark } from '../components/KitIcon'
import ShortcutTabs, { useIsMacKeyboard } from '../components/home/ShortcutTabs'
import { LOCALES, localizePath, useT } from '../i18n'
import { SITE_ORIGIN, getShareImage, openGraphLocales, pageSeo } from '../seo'
import { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'
import { Notice } from '../components/Messages'

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

// The whole screen is the drop target: a file dropped anywhere on the page opens in its viewer. The home page is the Toy Blocks
// landing page (hero with the simulated demo, stats, shortcuts, formats, privacy, questions, closing call); with `toolViewer` it
// is that format's own page (/json-viewer ...): the same hero for one format, with that page's guide under it. On a conversion page
// (/csv-to-excel ...) the chosen file is converted at once and the result opens in the viewer of its new format.
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
  const isMac = useIsMacKeyboard()
  // What a conversion page shows while it converts, or why it could not; it belongs to that page (`address`).
  const [conversionState, setConversionState] = useState<{ address: string; errorMessage: string | null } | null>(null)
  const convertTo = toolViewer?.convertTo

  async function convertAndOpen(file: File) {
    if (!toolViewer || !convertTo) return
    const conversionAddress = toolViewer.toolPath as string
    setConversionState({ address: conversionAddress, errorMessage: null })
    const { convertForViewer } = await import('../formats/conversion')
    const result = await convertForViewer(file, toolViewer.id, convertTo, locale)
    if ('error' in result) {
      setConversionState({ address: conversionAddress, errorMessage: result.error })
      return
    }
    setConversionState(null)
    onFileLoaded(result.file, await result.file.arrayBuffer())
  }

  const intake = useFileIntake({
    acceptedExtensions: toolViewer?.extensions ?? supportedExtensions,
    onFileLoaded: convertTo ? (file) => void convertAndOpen(file) : onFileLoaded,
    handoffFile,
    onHandoffConsumed,
  })

  // Each page gets its own title and description, in the page's language, for search results and browser tabs.
  const address = toolViewer?.toolPath ?? '/'
  const seo = pageSeo[locale][address]
  usePageHead(address, seo.title, seo.description)
  const isHomePage = !toolViewer

  return (
    <div id="home-page" {...intake.dropTargetProps} className="toy-page relative min-h-dvh text-[17px] leading-normal text-ink">
      {intake.isDraggingOver && <div id="drag-over-outline" aria-hidden="true" className="pointer-events-none fixed inset-3 z-20 rounded-[30px] border-[3px] border-dashed border-accent" />}

      <a
        id="skip-to-content-link"
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper-raised"
      >
        {t('skip.toContent')}
      </a>

      <header id="site-header" className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-5">
        <p id="site-brand" className="flex items-center">
          {toolViewer ? (
            <PageLink id="brand-home-link" path="/" onNavigate={onNavigate} className="rounded-full">
              <Wordmark withMark />
            </PageLink>
          ) : (
            <Wordmark withMark />
          )}
        </p>
        <SiteNav currentPath={address} onNavigate={onNavigate} />
        <div className="flex items-center gap-1 sm:gap-2">
          <PageLink id="header-link-privacy" path="/privacy" onNavigate={onNavigate} className="pill-link hidden sm:inline-flex">
            {t('legal.privacyShort')}
          </PageLink>
          <LanguageSwitcher className="pill-link" />
          <button id="header-open-file-button" type="button" disabled={intake.isReading} onClick={intake.openFilePicker} className="btn btn--primary press ms-1">
            {t('nav.openFile')}
          </button>
        </div>
      </header>

      {/* What's new is announced on the home page only, not on a format's own page. */}
      {isHomePage && !isBannerDismissed && <WhatsNewBanner onNavigate={onNavigate} onDismiss={onDismissBanner} />}

      <main id="main" className="mx-auto max-w-[1120px] px-5 pb-24">
        <section id="hero" className="pt-10 md:pt-16">
          <div className="mx-auto max-w-[640px] text-center">
            <h1 id="page-heading" className="type-display hero-in text-balance">{seo.heading}</h1>
            <p id="page-intro" className="type-lead hero-in mt-5 text-ink-soft">{seo.intro}</p>
            {isHomePage && <p id="hero-fine-print" className="hero-in mt-3 text-sm font-semibold text-ink-soft">{t('hero.finePrint')}</p>}
            <div className="hero-in mt-8">
              <DropPanel
                intake={intake}
                shownViewers={toolViewer ? [toolViewer] : viewers}
                currentViewerId={toolViewer?.id}
                onNavigate={onNavigate}
                onOpenInViewer={onOpenInViewer}
                showExtensions={!isHomePage}
                showOtherFormats={!convertTo}
                pasteHint={isHomePage ? t('hero.pasteHint', { shortcut: isMac ? '⌘' : 'Ctrl' }) : undefined}
              />
            </div>
          </div>
          {conversionState?.address === address && (
            <div id="conversion-messages" aria-live="polite" className="mx-auto mt-6 max-w-[640px] text-center">
              {conversionState.errorMessage === null && (
                <p id="conversion-status" role="status" className="font-medium text-ink-soft">
                  {t('convert.converting')}
                </p>
              )}
              <Notice id="conversion-error" kind="error" role="alert" className="font-medium text-danger" message={conversionState.errorMessage ?? ''} />
            </div>
          )}
          {isHomePage && (
            <div className="mt-12 md:mt-16">
              <DemoStage />
            </div>
          )}
        </section>

        {toolViewer ? (
          <div id="about-content" className="section-gap">
            <FormatGuide address={address} viewerId={toolViewer.id} onNavigate={onNavigate} />
          </div>
        ) : (
          <>
            <StatsRow />
            <ShortcutTabs />
            <FormatGrid onNavigate={onNavigate} />
            <PrivacyContrast />
            <FaqSection />
            <ClosingCta onOpenFile={intake.openFilePicker} />
          </>
        )}
      </main>

      {isHomePage && <DemoNote />}
      <SiteFooter currentPath={address} onNavigate={onNavigate} />
    </div>
  )
}
