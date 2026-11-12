import { useEffect } from 'react'
import DropPanel from '../components/DropPanel'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeToggle from '../components/ThemeToggle'
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
import { ALL_TOOLS_PATH, findLiveTool, findToolIcon, popularToolSlugs, toolPath } from '../tools/registry'
import type { MessageKey } from '../i18n'
import { headerRowBreak } from './changelogMarkup'

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

// The home page, the Toy Blocks landing page: hero with the simulated demo, the most-used tools, stats, shortcuts, formats, privacy,
// questions and a closing call. The whole screen is the drop target: a file dropped anywhere opens in its viewer. Every tool's own
// page (/csv-viewer, /merge-pdf ...) is src/pages/ToolPage.tsx.
export default function HomePage({
  onFileLoaded,
  onNavigate,
  isBannerDismissed,
  onDismissBanner,
  handoffFile,
  onHandoffConsumed,
  onOpenInViewer,
}: {
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
  onNavigate: (path: string) => void
  isBannerDismissed: boolean
  onDismissBanner: () => void
  handoffFile: File | null
  onHandoffConsumed: () => void
  onOpenInViewer: (file: File, toolPath: string) => void
}) {
  const { locale, t } = useT()
  const isMac = useIsMacKeyboard()
  const intake = useFileIntake({ acceptedExtensions: supportedExtensions, onFileLoaded, handoffFile, onHandoffConsumed })
  const seo = pageSeo[locale]['/']
  usePageHead('/', seo.title, seo.description)

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
          <PageLink id="brand-home-link" path="/" onNavigate={onNavigate} className="rounded-full" isCurrent>
            <Wordmark withMark />
          </PageLink>
        </p>
        <span aria-hidden="true" className={headerRowBreak} />
        <SiteNav currentPath="/" onNavigate={onNavigate} />
        <div className="-me-3 flex items-center gap-1 sm:gap-2 xl:me-0">
          <LanguageSwitcher className="pill-link text-[15px] xl:px-3" />
          <ThemeToggle />
        </div>
        <button id="header-open-file-button" type="button" disabled={intake.isReading} onClick={intake.openFilePicker} className="btn btn--primary btn--compact press order-last xl:order-none xl:-ms-2">
          {t('nav.openFile')}
        </button>
      </header>

      {!isBannerDismissed && <WhatsNewBanner onNavigate={onNavigate} onDismiss={onDismissBanner} />}

      <main id="main" className="mx-auto max-w-[1120px] px-5 pb-24">
        <section id="hero" className="pt-10 md:pt-16">
          <div className="mx-auto max-w-[640px] text-center">
            <h1 id="page-heading" className="type-display hero-in text-balance">{seo.heading}</h1>
            <p id="page-intro" className="type-lead hero-in mt-5 text-ink-soft">{seo.intro}</p>
            <p id="hero-fine-print" className="hero-in mt-3 text-sm font-semibold text-ink-soft">{t('hero.finePrint')}</p>
            <div className="hero-in mt-8">
              <DropPanel
                intake={intake}
                shownViewers={viewers}
                onNavigate={onNavigate}
                onOpenInViewer={onOpenInViewer}
                showExtensions={false}
                pasteHint={t('hero.pasteHint', { shortcut: isMac ? '⌘' : 'Ctrl' })}
              />
            </div>
          </div>
          <div className="mt-12 md:mt-16">
            <DemoStage />
          </div>
        </section>

        <section id="popular-tools" className="section-gap">
          <h2 id="popular-tools-heading" className="type-h2 text-center">{t('home.popularTools')}</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popularToolSlugs.flatMap((slug) => {
              const tool = findLiveTool(slug)
              if (!tool) return []
              return [
                <li key={slug}>
                  <PageLink id={`popular-tool-link-${slug}`} path={toolPath(tool)} onNavigate={onNavigate} className="flex h-full min-h-11 items-center gap-3 rounded-[18px] border-2 border-rule bg-paper-raised p-4 transition-colors duration-200 hover:border-accent">
                    <span aria-hidden="true" className={`nav-icon nav-icon-${findToolIcon(tool)} shrink-0`} />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="font-semibold text-ink">{pageSeo[locale][toolPath(tool)].linkText}</span>
                      <span className="mt-1 text-sm text-ink-soft">{t(`nav.note.${slug}` as MessageKey)}</span>
                    </span>
                  </PageLink>
                </li>,
              ]
            })}
          </ul>
          <p className="mt-6 text-center">
            <PageLink id="popular-tools-all-link" path={ALL_TOOLS_PATH} onNavigate={onNavigate} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
              {t('tools.menu.seeAll')}
            </PageLink>
          </p>
        </section>

        <StatsRow />
        <ShortcutTabs />
        <FormatGrid onNavigate={onNavigate} />
        <PrivacyContrast />
        <FaqSection />
        <ClosingCta onOpenFile={intake.openFilePicker} />
      </main>

      <DemoNote />
      <SiteFooter currentPath="/" onNavigate={onNavigate} />
    </div>
  )
}
