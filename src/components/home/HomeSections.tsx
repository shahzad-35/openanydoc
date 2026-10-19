import { faqItems, toolCards } from '../../content'
import { formatDefinitions } from '../../formats/registry'
import { isolateLeftToRight, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { pageSeo } from '../../seo'
import { LARGE_FILE_WARNING_BYTES } from '../../useFileIntake'
import { landingPages, viewers } from '../../viewers'
import type { Viewer } from '../../viewers'
import { getReleasedFormats } from '../../whatsNew'
import { FormatCapabilities } from '../DropPanel'
import NewBadge from '../NewBadge'
import { PageLink } from '../SiteFooter'
import { KitIcon, MiniFormatIcon } from '../KitIcon'
import type { MiniFormat } from '../KitIcon'

const MEGABYTE = 1024 * 1024

// Three numbers, all read from the code: live formats, their extensions, and the bytes that leave the device.
export function StatsRow() {
  const { t } = useT()
  const releasedFormats = getReleasedFormats()
  const extensions = releasedFormats.flatMap(({ viewer }) => viewer.extensions)
  const stats = [
    { id: 'types', value: releasedFormats.length, title: t('stats.types.title'), text: t('stats.types.text') },
    { id: 'extensions', value: extensions.length, title: t('stats.extensions.title'), text: extensions.join('  '), isCode: true },
    { id: 'bytes', value: 0, title: t('stats.bytes.title'), text: t('stats.bytes.text') },
  ]
  return (
    <section id="stats" aria-label={t('stats.label')} className="section-gap">
      <ul className="grid gap-10 sm:grid-cols-3">
        {stats.map((stat) => (
          <li key={stat.id} id={`stat-${stat.id}`}>
            <p className="stat-number">{stat.value}</p>
            <h2 className="type-h3 mt-3">{stat.title}</h2>
            <p dir={stat.isCode ? 'ltr' : undefined} className={`mt-1 text-ink-soft ${stat.isCode ? 'font-mono text-[15px] text-start' : ''}`}>
              {stat.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

type FormatGroup = { id: string; format: MiniFormat; titleKey: MessageKey; viewerIds: Viewer['id'][]; noteKey: MessageKey }

const formatGroups: FormatGroup[] = [
  { id: 'spreadsheets', format: 'xlsx', titleKey: 'formats.group.spreadsheets', viewerIds: ['csv', 'excel'], noteKey: 'formats.note.spreadsheets' },
  { id: 'data', format: 'json', titleKey: 'formats.group.data', viewerIds: ['json'], noteKey: 'formats.note.data' },
  { id: 'text', format: 'txt', titleKey: 'formats.group.text', viewerIds: ['text'], noteKey: 'formats.note.text' },
  { id: 'soon', format: 'unsupported', titleKey: 'formats.group.soon', viewerIds: ['word', 'pdf', 'powerpoint'], noteKey: 'about.notSupported' },
]

const jsonLimitMegabytes = (formatDefinitions.find((definition) => definition.viewerId === 'json')?.maxFileBytes ?? 0) / MEGABYTE

// Every format grouped by what it is for, with its extensions as chips and one line of fine print. The rows keep the
// extension-row / extension-capabilities ids that scripts/test-whats-new.mjs reads.
export function FormatGrid({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const noteValues = { limit: isolateLeftToRight(`${jsonLimitMegabytes} MB`), size: isolateLeftToRight(`${LARGE_FILE_WARNING_BYTES / MEGABYTE} MB`) }
  return (
    <section id="formats" aria-labelledby="formats-heading" className="section-gap">
      <h2 id="formats-heading" className="type-h2 text-balance">{t('formats.heading')}</h2>
      <p className="type-lead mt-3 max-w-[640px] text-ink-soft">{t('formats.lead')}</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {formatGroups.map((group) => (
          <div key={group.id} id={`format-group-${group.id}`} className="soft-card">
            <h3 className="type-h3 flex items-center gap-3">
              <MiniFormatIcon format={group.format} size={28} />
              {t(group.titleKey)}
            </h3>
            <ul className="mt-5 space-y-5">
              {group.viewerIds.map((viewerId) => {
                const viewer = viewers.find((candidate) => candidate.id === viewerId) as Viewer
                const card = toolCards[locale].find((candidate) => candidate.path === viewer.toolPath)
                return (
                  <li key={viewerId} id={`extension-row-${viewerId}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div>
                      <p className="font-semibold">
                        {viewer.toolPath && card ? (
                          <PageLink id={`tool-card-link-${viewer.toolPath.slice(1)}`} path={viewer.toolPath} onNavigate={onNavigate} className="underline-offset-4 hover:text-accent hover:underline">
                            {card.linkText}
                          </PageLink>
                        ) : (
                          viewer.label
                        )}
                        <NewBadge viewerId={viewerId} />
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        <FormatCapabilities idPrefix="extension-capabilities" viewerId={viewerId} />
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {viewer.extensions.map((extension) => (
                        <span key={extension} dir="ltr" className="chip">
                          {extension}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-5 text-sm text-ink-soft">{t(group.noteKey, noteValues)}</p>
          </div>
        ))}
      </div>
      <ul id="landing-links-list" aria-label={t('about.moreFileTools')} className="mt-6 flex flex-wrap gap-2">
        {landingPages.map((page) => (
          <li key={page.path}>
            <PageLink id={`landing-link-${page.path.slice(1)}`} path={page.path} onNavigate={onNavigate} className="pill-link border-2 border-line text-sm">
              {pageSeo[locale][page.path].linkText}
            </PageLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Uploading versus reading locally, side by side.
export function PrivacyContrast() {
  const { t } = useT()
  return (
    <section id="privacy" aria-labelledby="privacy-heading" className="section-gap">
      <h2 id="privacy-heading" className="type-h2 text-balance">{t('privacy.heading')}</h2>
      <p id="privacy-note" className="type-lead mt-3 max-w-[640px] text-ink-soft">{t('about.privacyText')}</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div id="privacy-upload" className="soft-card">
          <span className="grid size-12 place-items-center rounded-2xl bg-paper-raised text-(--txt-base) dark:text-(--txt)">
            <KitIcon name="upload" />
          </span>
          <h3 className="type-h3 mt-4">{t('privacy.uploadTitle')}</h3>
          <p className="mt-2 text-ink-soft">{t('privacy.uploadText')}</p>
        </div>
        <div id="privacy-local" className="soft-card">
          <span className="grid size-12 place-items-center rounded-2xl bg-paper-raised text-(--ok-base) dark:text-(--ok)">
            <KitIcon name="shield" />
          </span>
          <h3 className="type-h3 mt-4">{t('privacy.localTitle')}</h3>
          <p className="mt-2 text-ink-soft">{t('privacy.localText')}</p>
        </div>
      </div>
    </section>
  )
}

// The home page's questions, as a quiet list (the build writes them as FAQPage data too, so they stay on the page).
export function FaqSection() {
  const { locale, t } = useT()
  return (
    <section id="faq-section" aria-labelledby="faq-heading" className="section-gap">
      <h2 id="faq-heading" className="type-h2 text-balance">{t('about.faqHeading')}</h2>
      <dl id="faq-list" className="mt-8 grid gap-x-10 border-t border-line md:grid-cols-2">
        {faqItems[locale].map((item, position) => (
          <div key={item.question} id={`faq-item-${position + 1}`} className="border-b border-line py-5">
            <dt className="text-lg font-semibold">{item.question}</dt>
            <dd className="mt-2 text-ink-soft">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const ctaItemKeys = ['cta.item1', 'cta.item2', 'cta.item3'] as const

export function ClosingCta({ onOpenFile }: { onOpenFile: () => void }) {
  const { t } = useT()
  return (
    <section id="closing-cta" aria-labelledby="cta-heading" className="section-gap text-center">
      <h2 id="cta-heading" className="type-h2 text-balance">{t('cta.heading')}</h2>
      <ul className="mx-auto mt-6 flex w-fit max-w-[640px] flex-col gap-3 text-start">
        {ctaItemKeys.map((key) => (
          <li key={key} className="flex items-center gap-3 text-lg">
            <KitIcon name="check" size={22} className="shrink-0 text-(--ok-base) dark:text-(--ok)" />
            {t(key)}
          </li>
        ))}
      </ul>
      <button id="cta-open-file-button" type="button" onClick={onOpenFile} className="btn btn--primary btn--hero press mt-8">
        {t('nav.openFile')}
      </button>
      <p className="mt-4 text-sm text-ink-soft">{t('cta.finePrint')}</p>
    </section>
  )
}

// How the hero demo is used with a mouse, a keyboard and touch, and that it is simulated.
export function DemoNote() {
  const { t } = useT()
  return (
    <section id="demo-note" aria-labelledby="demo-note-heading" className="mx-auto max-w-[1120px] px-5 pb-10 text-sm text-ink-soft">
      <h2 id="demo-note-heading" className="font-semibold text-ink">{t('demoNote.heading')}</h2>
      <p className="mt-2 max-w-[760px]">{t('demoNote.text')}</p>
      <p className="mt-2 font-semibold">{t('demoNote.simulated')}</p>
      <p className="mt-1 max-w-[760px]">{t('demoNote.simulatedScope')}</p>
    </section>
  )
}
