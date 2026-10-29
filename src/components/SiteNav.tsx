import { useEffect, useRef } from 'react'
import { useT } from '../i18n'
import { CHEVRON_ICON_PATH, navClasses } from '../pages/changelogMarkup'
import { pageSeo } from '../seo'
import { landingPages, viewers } from '../viewers'
import { PageLink } from './SiteFooter'

// The header's links to each viewer page on every content page (home, format and landing pages, About, Privacy, Terms, changelog),
// then a Convert menu with the conversion pages. `currentPath` is the page's address without its language.
// scripts/build-static-pages.mjs writes the same markup into the changelog pages: keep the two identical.
export default function SiteNav({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const convertMenuRef = useRef<HTMLDetailsElement>(null)

  // The Convert menu closes on a click outside it and on Escape, like the site's other menus.
  useEffect(() => {
    function closeConvertMenu(event: MouseEvent | KeyboardEvent) {
      const convertMenu = convertMenuRef.current
      if (!convertMenu?.open) return
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !convertMenu.contains(event.target as Node)) convertMenu.open = false
    }
    document.addEventListener('mousedown', closeConvertMenu)
    document.addEventListener('keydown', closeConvertMenu)
    return () => {
      document.removeEventListener('mousedown', closeConvertMenu)
      document.removeEventListener('keydown', closeConvertMenu)
    }
  }, [])

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
          <li>
            <details id="site-nav-convert" ref={convertMenuRef} className={navClasses.convertDetails}>
              <summary id="site-nav-convert-toggle" className={navClasses.convertSummary}>
                {t('convert.menuHeading')}
                <svg aria-hidden="true" viewBox="0 0 24 24" className={navClasses.convertChevron} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={CHEVRON_ICON_PATH} />
                </svg>
              </summary>
              <ul id="site-nav-convert-list" className={navClasses.convertList}>
                {landingPages
                  .filter((page) => page.convertTo)
                  .map((page) => (
                    <li key={page.path}>
                      <PageLink
                        id={`site-nav-link-${page.path.slice(1)}`}
                        path={page.path}
                        onNavigate={(path) => {
                          if (convertMenuRef.current) convertMenuRef.current.open = false
                          onNavigate(path)
                        }}
                        className={navClasses.convertLink}
                        isCurrent={page.path === currentPath}
                      >
                        {pageSeo[locale][page.path].linkText}
                      </PageLink>
                    </li>
                  ))}
              </ul>
            </details>
          </li>
        </ul>
      </details>
    </nav>
  )
}
