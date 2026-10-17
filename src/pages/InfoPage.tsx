import LanguageSwitcher from '../components/LanguageSwitcher'
import SiteFooter, { PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import ThemeToggle from '../components/ThemeToggle'
import { usePageHead } from './HomePage'
import { useT } from '../i18n'
import { CONTACT_EMAIL, infoPages } from '../legalContent'
import { pageSeo } from '../seo'

// The contact address inside a sentence becomes a mailto link.
function withContactEmailLink(text: string) {
  const [before, after] = text.split(CONTACT_EMAIL)
  if (after === undefined) return text
  return (
    <>
      {before}
      <a id="contact-email-link" href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-accent">
        <bdi dir="ltr">{CONTACT_EMAIL}</bdi>
      </a>
      {after}
    </>
  )
}

// About, Privacy Policy and Terms of Use: a page of h2 sections drawn from src/legalContent.ts, with the home page's header and the
// site footer. `address` is the page without its language ('/privacy').
export default function InfoPage({ address, onNavigate }: { address: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const seo = pageSeo[locale][address]
  const content = infoPages[locale][address]
  usePageHead(address, seo.title, seo.description)

  return (
    <div id="info-page" className="min-h-dvh bg-paper font-sans text-[18px] leading-normal text-ink">
      <a
        id="skip-to-content-link"
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('skip.toContent')}
      </a>
      <header id="site-header" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5">
        <p id="site-brand" className="type-h3">
          <PageLink id="brand-home-link" path="/" onNavigate={onNavigate}>OpenAnyDoc</PageLink>
        </p>
        <SiteNav currentPath={address} onNavigate={onNavigate} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-20">
        <div className="py-8 md:py-12">
          <h1 id="page-heading" className="type-h1 text-balance">{seo.heading}</h1>
          <p id="page-intro" className="mt-4 text-ink-soft">{seo.intro}</p>
          {content.lastUpdated && <p id="last-updated" className="mt-2 text-sm text-ink-soft">{content.lastUpdated}</p>}
        </div>
        <div id="info-sections" className="box-shape solid-box space-y-10 border-rule bg-paper-raised/90 p-6 md:p-10">
          {content.sections.map((section, position) => (
            <section key={section.heading} id={`info-section-${position + 1}`}>
              <h2 className="type-h3">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2">{withContactEmailLink(paragraph)}</p>
              ))}
              {section.list && (
                <ul className="mt-2 list-disc space-y-1 ps-6">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <SiteFooter currentPath={address} onNavigate={onNavigate} />
    </div>
  )
}
