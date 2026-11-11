import { Suspense, lazy, useEffect, useState } from 'react'
import DropPanel from '../components/DropPanel'
import FormatGuide from '../components/FormatGuide'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeToggle from '../components/ThemeToggle'
import SiteFooter, { PageBreadcrumb, PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import WhatsNewBanner from '../components/WhatsNewBanner'
import DemoStage from '../components/home/DemoStage'
import { ClosingCta, DemoNote, FaqSection, FormatGrid, PrivacyContrast, StatsRow } from '../components/home/HomeSections'
import { Wordmark } from '../components/KitIcon'
import { useHasMounted } from '../components/NewBadge'
import ShortcutTabs, { useIsMacKeyboard } from '../components/home/ShortcutTabs'
import { LOCALES, localizePath, useT } from '../i18n'
import { SITE_ORIGIN, getShareImage, openGraphLocales, pageSeo } from '../seo'
import { useFileIntake } from '../useFileIntake'
import { supportedExtensions, viewers } from '../viewers'
import type { Viewer } from '../viewers'
import { samplesByPage } from '../samples/toolSamples'
import { Notice } from '../components/Messages'
import { headerRowBreak } from './changelogMarkup'

// oxlint-disable-next-line react/only-export-components
export const loadMaskDataTool = () => import('../formats/mask/MaskWorkbench')
const MaskWorkbench = lazy(loadMaskDataTool)
// The formats the Mask Data page takes, for its list of extensions.
const maskableViewers = viewers.filter((viewer) => ['csv', 'json', 'excel', 'text'].includes(viewer.id))

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
  const isMaskTool = toolViewer?.tool === 'mask'
  // The file chosen on the Mask Data page, in React state only. App draws this page afresh on entering and leaving the Mask Data
  // page, so the file is forgotten when the visitor leaves.
  const [maskFile, setMaskFile] = useState<File | null>(null)
  const hasMounted = useHasMounted()

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
    onFileLoaded: isMaskTool ? (file) => setMaskFile(file) : convertTo ? (file) => void convertAndOpen(file) : onFileLoaded,
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
        {/* The brand always leads home; on the home page itself it goes back to the top. */}
        <p id="site-brand" className="flex items-center">
          <PageLink id="brand-home-link" path="/" onNavigate={onNavigate} className="rounded-full" isCurrent={isHomePage}>
            <Wordmark withMark />
          </PageLink>
        </p>
        <span aria-hidden="true" className={headerRowBreak} />
        <SiteNav currentPath={address} onNavigate={onNavigate} />
        <div className="-me-3 flex items-center gap-1 sm:gap-2 xl:me-0">
          <LanguageSwitcher className="pill-link text-[15px] xl:px-3" />
          <ThemeToggle />
        </div>
        <button id="header-open-file-button" type="button" disabled={intake.isReading} onClick={intake.openFilePicker} className="btn btn--primary btn--compact press order-last xl:order-none xl:-ms-2">
          {t('nav.openFile')}
        </button>
      </header>

      {/* What's new is announced on the home page only, not on a format's own page. */}
      {isHomePage && !isBannerDismissed && <WhatsNewBanner onNavigate={onNavigate} onDismiss={onDismissBanner} />}

      <main id="main" className="mx-auto max-w-[1120px] px-5 pb-24">
        <section id="hero" className={isHomePage ? 'pt-10 md:pt-16' : 'pt-4 sm:pt-10 md:pt-16'}>
          {!isHomePage && <PageBreadcrumb address={address} onNavigate={onNavigate} className="mx-auto flex max-w-[640px] justify-center" />}
          <div className="mx-auto max-w-[640px] text-center">
            <h1 id="page-heading" className="type-display hero-in text-balance">{seo.heading}</h1>
            {isHomePage ? (
              <p id="page-intro" className="type-lead hero-in mt-5 text-ink-soft">{seo.intro}</p>
            ) : (
              <>
                {/* A tool page answers the search in one sentence and keeps the tool on a phone's first screen; its longer intro
                    moves under the tool. */}
                <p id="page-answer" className="type-lead hero-in mt-3 text-ink-soft sm:mt-5">{seo.answer}</p>
                <p id="page-proof" className="hero-in mt-2 text-sm text-ink-soft">
                  {t('hero.proof')}{' '}
                  <PageLink id="page-proof-link" path="/check-file-upload" onNavigate={onNavigate}>
                    {t('hero.proofLink')}
                  </PageLink>
                </p>
              </>
            )}
            {isHomePage && <p id="hero-fine-print" className="hero-in mt-3 text-sm font-semibold text-ink-soft">{t('hero.finePrint')}</p>}
            <div className={isHomePage ? 'hero-in mt-8' : 'hero-in mt-5 sm:mt-8'}>
              <DropPanel
                intake={intake}
                shownViewers={isMaskTool ? maskableViewers : toolViewer ? [toolViewer] : viewers}
                currentViewerId={isMaskTool ? undefined : toolViewer?.id}
                onNavigate={onNavigate}
                onOpenInViewer={onOpenInViewer}
                showExtensions={!isHomePage}
                showOtherFormats={!convertTo}
                pasteHint={isHomePage ? t('hero.pasteHint', { shortcut: isMac ? '⌘' : 'Ctrl' }) : undefined}
                samples={samplesByPage[address]}
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
          {/* The tool draws after the first render: it runs a worker and holds the file, nothing the static page can show. */}
          {isMaskTool && hasMounted && (
            <Suspense fallback={null}>
              <MaskWorkbench file={maskFile} />
            </Suspense>
          )}
          {isHomePage && (
            <div className="mt-12 md:mt-16">
              <DemoStage />
            </div>
          )}
        </section>

        {toolViewer ? (
          <div id="about-content" className="section-gap">
            <p id="page-intro" className="type-lead mx-auto mb-12 max-w-3xl text-ink-soft">{seo.intro}</p>
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
