import type { ReactNode } from 'react'
import { localizePath, useT } from '../i18n'
import { footerClasses, legalFooterLinks } from '../pages/changelogMarkup'
import { pageSeo } from '../seo'
import { landingPages, viewers } from '../viewers'
import NewBadge from './NewBadge'

const pagesWithOwnAddress = viewers.filter((viewer) => viewer.toolPath)

// A link that changes the page without reloading (the app has no router package); modified clicks open a new tab as usual.
// `path` is the address without its language ('/csv-viewer'); the link goes to the page in the current language.
// `isCurrent` marks the link to the page shown (aria-current="page").
export function PageLink({ id, path, onNavigate, children, className = 'underline underline-offset-2 hover:text-ink', isCurrent = false }: { id?: string; path: string; onNavigate: (path: string) => void; children: ReactNode; className?: string; isCurrent?: boolean }) {
  const { locale } = useT()
  const localizedPath = localizePath(locale, path)
  return (
    <a
      id={id}
      href={localizedPath}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onNavigate(localizedPath)
      }}
      className={className}
    >
      {children}
    </a>
  )
}

// The footer of every content page (home, format pages, About, Privacy, Terms, changelog). `currentPath` is the page's address
// without its language. scripts/build-static-pages.mjs writes the same footer into the changelog pages: keep the two in step.
export default function SiteFooter({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const isFormatPage = pagesWithOwnAddress.some((viewer) => viewer.toolPath === currentPath)
  return (
    <footer id="site-footer" className={footerClasses.footer}>
      <div className={footerClasses.columns}>
        <div>
          <p className={footerClasses.brand}>OpenAnyDoc</p>
          <p className={footerClasses.text}>{t('footer.text')}</p>
        </div>
        <nav id="footer-viewers" aria-label={t('footer.viewers')}>
          <h2 className={footerClasses.heading}>{t('footer.viewers')}</h2>
          <ul className={footerClasses.list}>
            {pagesWithOwnAddress
              .filter((viewer) => viewer.toolPath !== currentPath)
              .map((viewer) => (
                <li key={viewer.id} className={footerClasses.item}>
                  <PageLink id={`footer-link-${viewer.id}`} path={viewer.toolPath as string} onNavigate={onNavigate} className={footerClasses.link}>
                    {t('viewer.name', { format: viewer.label })}
                  </PageLink>
                  <NewBadge viewerId={viewer.id} />
                </li>
              ))}
            {landingPages
              .filter((page) => page.path !== currentPath)
              .map((page) => (
                <li key={page.path} className={footerClasses.item}>
                  <PageLink id={`footer-link-${page.path.slice(1)}`} path={page.path} onNavigate={onNavigate} className={footerClasses.link}>
                    {pageSeo[locale][page.path].linkText}
                  </PageLink>
                </li>
              ))}
          </ul>
        </nav>
        <nav id="footer-more" aria-label={t('footer.more')}>
          <h2 className={footerClasses.heading}>{t('footer.more')}</h2>
          <ul className={footerClasses.list}>
            {currentPath !== '/' && (
              <li>
                <PageLink id="footer-link-all-types" path="/" onNavigate={onNavigate} className={footerClasses.link}>
                  {t('footer.allTypes')}
                </PageLink>
              </li>
            )}
            {!isFormatPage && currentPath !== '/changelog' && (
              <li>
                <PageLink id="footer-link-changelog" path="/changelog" onNavigate={onNavigate} className={footerClasses.link}>
                  {t('footer.whatsNew')}
                </PageLink>
              </li>
            )}
          </ul>
        </nav>
        <nav id="footer-legal" aria-label={t('footer.legal')}>
          <h2 className={footerClasses.heading}>{t('footer.legal')}</h2>
          <ul className={footerClasses.list}>
            {legalFooterLinks.map((link) => (
              <li key={link.id}>
                <PageLink id={link.id} path={link.path} onNavigate={onNavigate} className={footerClasses.link}>
                  {t(link.labelKey)}
                </PageLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p id="footer-disclaimer" className={footerClasses.disclaimer}>
        {t('legal.disclaimer')}
      </p>
    </footer>
  )
}
