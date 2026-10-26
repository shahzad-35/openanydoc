import { Wordmark } from '../components/KitIcon'
import LanguageSwitcher from '../components/LanguageSwitcher'
import SiteFooter, { PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import ThemeToggle from '../components/ThemeToggle'
import { usePageHead } from './HomePage'
import { guidePages } from '../guides'
import { useT } from '../i18n'
import { CONTACT_EMAIL, infoPages, type InfoSection } from '../legalContent'
import { AUTHOR_NAME, pageSeo } from '../seo'

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const formatDate = (isoDate: string, locale: string) => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`))
const inlineLinkClassName = 'underline underline-offset-2 hover:text-accent'

// The contact address inside a sentence becomes a mailto link, and a section's `links` phrases become links to their pages (or to an
// outside address when the path is a full https address). Longer phrases are matched first, so "large CSV viewer" is not cut at "CSV viewer".
function withInlineLinks(text: string, links: InfoSection['links'] = [], onNavigate: (path: string) => void) {
  const phrases = [CONTACT_EMAIL, ...links.map((link) => link.text)].sort((a, b) => b.length - a.length)
  return text.split(new RegExp(`(${phrases.map(escapeForRegExp).join('|')})`)).map((part, position) => {
    if (part === CONTACT_EMAIL) {
      return (
        <a key={position} id="contact-email-link" href={`mailto:${CONTACT_EMAIL}`} className={inlineLinkClassName}>
          <bdi dir="ltr">{CONTACT_EMAIL}</bdi>
        </a>
      )
    }
    const link = links.find((candidate) => candidate.text === part)
    if (!link) return part
    if (link.path.startsWith('https://')) {
      return (
        <a key={position} id={`info-link-${new URL(link.path).hostname.split('.')[0]}`} href={link.path} rel="noopener" className={inlineLinkClassName}>
          {part}
        </a>
      )
    }
    return (
      <PageLink key={position} id={`info-link-${link.path.slice(1)}`} path={link.path} onNavigate={onNavigate} className={inlineLinkClassName}>
        {part}
      </PageLink>
    )
  })
}

// About, Privacy Policy, Terms of Use and the guides: a page of h2 sections drawn from src/legalContent.ts or src/guides.ts, with the
// home page's header and the site footer. `address` is the page without its language ('/privacy').
export default function InfoPage({ address, onNavigate }: { address: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const seo = pageSeo[locale][address]
  const content = infoPages[locale][address] ?? guidePages[locale][address]
  usePageHead(address, seo.title, seo.description)

  return (
    <div id="info-page" className="toy-page min-h-dvh text-[17px] leading-normal text-ink">
      <a
        id="skip-to-content-link"
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('skip.toContent')}
      </a>
      <header id="site-header" className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-5">
        <p id="site-brand" className="flex items-center">
          <PageLink id="brand-home-link" path="/" onNavigate={onNavigate} className="rounded-full">
            <Wordmark withMark />
          </PageLink>
        </p>
        <SiteNav currentPath={address} onNavigate={onNavigate} />
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher className="pill-link" />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-20">
        <div className="py-8 md:py-12">
          <h1 id="page-heading" className="type-h1 text-balance">{seo.heading}</h1>
          <p id="page-intro" className="mt-4 text-ink-soft">{seo.intro}</p>
          {content.lastUpdated && <p id="last-updated" className="mt-2 text-sm text-ink-soft">{content.lastUpdated}</p>}
          {content.published && (
            <p id="page-byline" className="mt-3 text-sm text-ink-soft">
              {t('guide.byline', { name: '' })}
              <PageLink id="byline-author-link" path="/about" onNavigate={onNavigate} className={inlineLinkClassName}>
                {AUTHOR_NAME}
              </PageLink>
              {' · '}
              <time dateTime={content.published}>{t('guide.published', { date: formatDate(content.published, locale) })}</time>
              {content.updated && content.updated !== content.published && (
                <>
                  {' · '}
                  <time dateTime={content.updated}>{t('guide.updated', { date: formatDate(content.updated, locale) })}</time>
                </>
              )}
            </p>
          )}
        </div>
        <div id="info-sections" className="space-y-10 rounded-[22px] border-2 border-rule bg-paper-raised p-6 md:p-10">
          {content.sections.map((section, position) => (
            <section key={section.heading} id={`info-section-${position + 1}`}>
              <h2 className="type-h3">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2">{withInlineLinks(paragraph, section.links, onNavigate)}</p>
              ))}
              {section.list && (
                <ul className="mt-2 list-disc space-y-1 ps-6">
                  {section.list.map((item) => (
                    <li key={item}>{withInlineLinks(item, section.links, onNavigate)}</li>
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
