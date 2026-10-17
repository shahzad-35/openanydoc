import { useT } from '../i18n'
import { CHEVRON_ICON_PATH, navClasses } from '../pages/changelogMarkup'
import { pageSeo } from '../seo'
import { viewers } from '../viewers'
import { PageLink } from './SiteFooter'

// The header's links to each viewer page on every content page (home, format and landing pages, About, Privacy, Terms, changelog).
// `currentPath` is the page's address without its language. scripts/build-static-pages.mjs writes the same markup into the
// changelog pages: keep the two identical.
export default function SiteNav({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  return (
    <nav id="site-nav" aria-label={t('footer.viewers')} className={navClasses.nav}>
      <details id="site-nav-menu" className={navClasses.details}>
        <summary id="site-nav-toggle" className={navClasses.summary}>
          {t('footer.viewers')}
          <svg aria-hidden="true" viewBox="0 0 24 24" className={navClasses.chevron} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={CHEVRON_ICON_PATH} />
          </svg>
        </summary>
        <ul id="site-nav-list" className={navClasses.list}>
          {viewers
            .filter((viewer) => viewer.toolPath)
            .map((viewer) => (
              <li key={viewer.id}>
                <PageLink id={`site-nav-link-${viewer.id}`} path={viewer.toolPath as string} onNavigate={onNavigate} className={navClasses.link} isCurrent={viewer.toolPath === currentPath}>
                  {pageSeo[locale][viewer.toolPath as string].linkText}
                </PageLink>
              </li>
            ))}
        </ul>
      </details>
    </nav>
  )
}
