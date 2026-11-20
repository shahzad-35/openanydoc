import { Wordmark } from '../components/KitIcon'
import LanguageSwitcher from '../components/LanguageSwitcher'
import SiteFooter, { PageBreadcrumb, PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import ThemeToggle from '../components/ThemeToggle'
import { useT } from '../i18n'
import type { MessageKey } from '../i18n'
import { guideAddresses, pageSeo } from '../seo'
import { ALL_TOOLS_PATH, findToolIcon, liveHubs, liveTools, toolPath } from '../tools/registry'
import type { Hub } from '../tools/registry'
import { headerRowBreak } from './changelogMarkup'
import { usePageHead } from './HomePage'

// A grid of one hub's live tools, under one heading per task group (Organize, Convert ...). /all-tools leaves out the tools a hub
// borrows from another category (`sharedTools`), so each tool is listed once there.
function HubToolGroups({ hub, groupHeadingLevel, showsSharedTools, onNavigate }: { hub: Hub; groupHeadingLevel: 'h2' | 'h3'; showsSharedTools: boolean; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const GroupHeading = groupHeadingLevel
  return hub.groups.map((group) => {
    const groupTools = liveTools.filter((tool) => (tool.category === hub.category && tool.group === group) || (showsSharedTools && hub.sharedTools?.[group]?.includes(tool.slug)))
    if (groupTools.length === 0) return null
    return (
      <section key={group} id={`hub-group-${hub.category}-${group.toLowerCase()}`} className="mt-8">
        <GroupHeading className="type-h3">{t(`tools.group.${group}` as MessageKey)}</GroupHeading>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groupTools.map((tool) => (
            <li key={tool.slug}>
              <PageLink
                id={`hub-tool-link-${tool.slug}`}
                path={toolPath(tool)}
                onNavigate={onNavigate}
                className="flex min-h-11 items-center gap-3 rounded-[18px] border-2 border-rule bg-paper-raised p-4 transition-colors duration-200 hover:border-accent"
              >
                <span aria-hidden="true" className={`nav-icon nav-icon-${findToolIcon(tool)} shrink-0`} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="font-semibold text-ink">{pageSeo[locale][toolPath(tool)].linkText}</span>
                  <span className="mt-1 text-sm text-ink-soft">{t(`nav.note.${tool.slug}` as MessageKey)}</span>
                </span>
              </PageLink>
            </li>
          ))}
        </ul>
      </section>
    )
  })
}

// A hub page (/pdf-tools, /data-tools ...): the live tools of one category grouped by task, then that category's guides. With no
// `hub` it is /all-tools: every live hub, one after the other. Words in src/seo.ts; tools from src/tools/registry.ts.
export default function HubPage({ hub, onNavigate }: { hub?: Hub; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const address = hub?.path ?? ALL_TOOLS_PATH
  const seo = pageSeo[locale][address]
  usePageHead(address, seo.title, seo.description)
  // A hub lists its own guides; All tools lists every guide (and the index), so each guide is one click from the tool list.
  const hubGuideAddresses = hub ? hub.guides : ['/guides', ...guideAddresses]

  return (
    <div id="hub-page" className="toy-page min-h-dvh text-[17px] leading-normal text-ink">
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
        <span aria-hidden="true" className={headerRowBreak} />
        <SiteNav currentPath={address} onNavigate={onNavigate} />
        <div className="-me-3 flex items-center gap-1 sm:gap-2 xl:me-0">
          <LanguageSwitcher className="pill-link text-[15px] xl:px-3" />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1120px] px-5 pb-20">
        <div className="mx-auto max-w-3xl py-8 text-center md:py-12">
          <PageBreadcrumb address={address} onNavigate={onNavigate} className="flex justify-center" />
          <h1 id="page-heading" className="type-display text-balance">{seo.heading}</h1>
          <p id="page-intro" className="type-lead mt-4 text-ink-soft">{seo.intro}</p>
        </div>
        {hub ? (
          <HubToolGroups hub={hub} groupHeadingLevel="h2" showsSharedTools onNavigate={onNavigate} />
        ) : (
          liveHubs.map((liveHub) => (
            <section key={liveHub.category} id={`hub-section-${liveHub.category}`} className="mt-12">
              <h2 className="type-h2">
                <PageLink id={`hub-link-${liveHub.category}`} path={liveHub.path} onNavigate={onNavigate} className="hover:text-accent">
                  {pageSeo[locale][liveHub.path].heading}
                </PageLink>
              </h2>
              <HubToolGroups hub={liveHub} groupHeadingLevel="h3" showsSharedTools={false} onNavigate={onNavigate} />
            </section>
          ))
        )}
        {hubGuideAddresses.length > 0 && (
          <section id="hub-guides" className="mt-12">
            <h2 id="hub-guides-heading" className="type-h3">{t('tools.hub.guidesHeading')}</h2>
            <ul id="hub-guides-list" className="mt-4 flex flex-wrap gap-3">
              {hubGuideAddresses.map((guideAddress) => (
                <li key={guideAddress}>
                  <PageLink
                    id={`hub-guide-link-${guideAddress.slice(1)}`}
                    path={guideAddress}
                    onNavigate={onNavigate}
                    className="control-shape solid-box inline-flex min-h-11 items-center border-rule bg-paper-raised px-4 font-medium transition-colors duration-200 hover:bg-paper"
                  >
                    {pageSeo[locale][guideAddress].linkText ?? pageSeo[locale][guideAddress].heading}
                  </PageLink>
                </li>
              ))}
            </ul>
          </section>
        )}
        {hub?.relatedTools && (
          <section id="hub-related-tools" className="mt-12">
            <h2 id="hub-related-tools-heading" className="type-h3">{t('tools.hub.relatedToolsHeading')}</h2>
            <ul id="hub-related-tools-list" className="mt-4 flex flex-wrap gap-3">
              {hub.relatedTools.map((slug) => (
                <li key={slug}>
                  <PageLink id={`hub-related-tool-link-${slug}`} path={`/${slug}`} onNavigate={onNavigate} className="control-shape solid-box inline-flex min-h-11 items-center border-rule bg-paper-raised px-4 font-medium transition-colors duration-200 hover:bg-paper">
                    {pageSeo[locale][`/${slug}`].linkText ?? pageSeo[locale][`/${slug}`].heading}
                  </PageLink>
                </li>
              ))}
            </ul>
          </section>
        )}
        {seo.body && (
          <section id="hub-about" aria-labelledby="hub-about-heading" className="mt-12 max-w-3xl">
            <h2 id="hub-about-heading" className="type-h3">{t('tools.hub.aboutHeading')}</h2>
            {seo.body.map((paragraph, position) => (
              <p key={position} id={`hub-about-text-${position + 1}`} className="mt-4 text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        )}
      </main>

      <SiteFooter currentPath={address} onNavigate={onNavigate} />
    </div>
  )
}
