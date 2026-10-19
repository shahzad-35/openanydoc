import NewBadge from '../components/NewBadge'
import SiteFooter from '../components/SiteFooter'
import { Wordmark } from '../components/KitIcon'
import SiteNav from '../components/SiteNav'
import changelog from '../data/changelog.json'
import { localizePath, useT } from '../i18n'
import { CHECK_ICON_PATH, changelogClasses, changelogIds } from './changelogMarkup'
import { usePageHead } from './HomePage'
import type { Locale, MessageKey } from '../i18n'
import { viewers } from '../viewers'
import type { Viewer } from '../viewers'

// scripts/build-static-pages.mjs writes the same page (same words, same structure) into dist/en/changelog and dist/ar/changelog
// at build time, so search engines read real content. This component takes over in the browser; it must stay in step with that script.

const otherLocale = (locale: Locale): Locale => (locale === 'en' ? 'ar' : 'en')

function formatDate(isoDate: string, locale: Locale) {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`))
}

export default function ChangelogPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  usePageHead('/changelog', t('changelog.title'), t('changelog.description'))

  function pageLink(id: string, path: string, className: string, children: React.ReactNode, hreflang?: Locale) {
    return (
      <a
        id={id}
        href={path}
        {...(hreflang ? { hrefLang: hreflang, lang: hreflang } : {})}
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

  const viewerById = new Map<string, Viewer>(viewers.map((viewer) => [viewer.id, viewer]))

  return (
    <div id={changelogIds.page} className={changelogClasses.page}>
      <header id={changelogIds.header} className={changelogClasses.header}>
        <p>{pageLink(changelogIds.brandLink, localizePath(locale, '/'), changelogClasses.brandLink, <Wordmark />)}</p>
        <SiteNav currentPath="/changelog" onNavigate={onNavigate} />
        <p>{pageLink(changelogIds.languageLink, `/${otherLocale(locale)}/changelog`, changelogClasses.languageLink, t('changelog.otherLanguage'), otherLocale(locale))}</p>
      </header>
      <main id={changelogIds.main} className={changelogClasses.main}>
        <div className={changelogClasses.intro}>
          <h1 id={changelogIds.heading} className={changelogClasses.heading}>{t('changelog.heading')}</h1>
          <p id={changelogIds.intro} className={changelogClasses.introText}>{t('changelog.intro')}</p>
        </div>
        <ol id={changelogIds.timeline} className={changelogClasses.timeline}>
          {changelog.map((entry) => (
            <li key={entry.version} id={changelogIds.release(entry.version)} data-file-type={entry.formats[0]} className={changelogClasses.entry}>
              <span aria-hidden="true" className={changelogClasses.dot} />
              <article className={changelogClasses.card}>
                <p className={changelogClasses.meta}>
                  <span className={changelogClasses.versionPill}>{t('changelog.version', { version: entry.version })}</span>
                  <time dateTime={entry.date}>{formatDate(entry.date, locale)}</time>
                </p>
                <h2 id={changelogIds.releaseTitle(entry.version)} className={changelogClasses.entryTitle}>{t(entry.title as MessageKey)}</h2>
                <ul className={changelogClasses.items}>
                  {entry.items.map((itemKey) => (
                    <li key={itemKey} className={changelogClasses.item}>
                      <svg aria-hidden="true" viewBox="0 0 24 24" className={changelogClasses.checkIcon} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={CHECK_ICON_PATH} />
                      </svg>
                      <span>{t(itemKey as MessageKey)}</span>
                    </li>
                  ))}
                </ul>
                <p className={changelogClasses.tryIt}>
                  <span className={changelogClasses.tryItLabel}>{t('changelog.tryIt')}</span>
                  {entry.formats.map((viewerId) => {
                    const viewer = viewerById.get(viewerId) as Viewer
                    return (
                      <span key={viewerId} className="inline-flex items-center">
                        {pageLink(changelogIds.tryFormat(entry.version, viewerId), localizePath(locale, viewer.toolPath as string), changelogClasses.formatLink, t('viewer.name', { format: viewer.label }))}
                        <NewBadge viewerId={viewer.id} />
                      </span>
                    )
                  })}
                </p>
              </article>
            </li>
          ))}
        </ol>
        {pageLink(changelogIds.backLink, localizePath(locale, '/'), changelogClasses.backLink, t('changelog.home'))}
      </main>
      <SiteFooter currentPath="/changelog" onNavigate={onNavigate} />
    </div>
  )
}
