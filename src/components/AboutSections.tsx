import { faqItems, features, toolCards } from '../content'
import { useT } from '../i18n'
import { findViewerByToolPath } from '../viewers'
import type { Viewer } from '../viewers'
import FileTypeChip from './FileTypeChip'
import NewBadge from './NewBadge'
import { PageLink } from './SiteFooter'

export function PrivacySection() {
  const { t } = useT()
  return (
    <div id="privacy-section">
      <h2 id="privacy-heading" className="type-h3">{t('about.privacyHeading')}</h2>
      <p id="privacy-text" className="mt-2">{t('about.privacyText')}</p>
      <h3 id="new-features-heading" className="mt-4 font-semibold">{t('privacy.newFeaturesHeading')}</h3>
      <p id="new-features-text" className="mt-1">{t('privacy.newFeaturesText')}</p>
    </div>
  )
}

// The home page's links to each tool page, one card per line of toolCards in src/content.ts.
export function ToolCardsSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  return (
    <div id="tool-cards-section">
      <h2 id="tool-cards-heading" className="type-h3">{t('about.supportedHeading')}</h2>
      <ul id="tool-cards-list" className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-1">
        {toolCards[locale].map((card) => {
          const viewer = findViewerByToolPath(card.path) as Viewer
          const cardId = card.path.slice(1)
          return (
            <li key={card.path} id={`tool-card-${cardId}`} className="box-shape solid-box border-rule bg-paper-raised p-4">
              <FileTypeChip viewer={viewer} />
              <NewBadge viewerId={viewer.id} />
              <h3 className="mt-2 font-semibold">
                <PageLink id={`tool-card-link-${cardId}`} path={card.path} onNavigate={onNavigate}>{card.linkText}</PageLink>
              </h3>
              <p className="mt-1 text-ink-soft">{card.text}</p>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-ink-soft">{t('about.notSupported')}</p>
    </div>
  )
}

export function FeaturesSection() {
  const { locale, t } = useT()
  return (
    <div id="features-section">
      <h2 id="features-heading" className="type-h3">{t('about.featuresHeading')}</h2>
      <ul id="features-list" className="mt-2 list-disc space-y-1 ps-6">
        {features[locale].map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

export function FaqSection() {
  const { locale, t } = useT()
  return (
    <div id="faq-section">
      <h2 id="faq-heading" className="type-h3">{t('about.faqHeading')}</h2>
      <dl id="faq-list" className="rule-list mt-2">
        {faqItems[locale].map((item, position) => (
          <div key={item.question} id={`faq-item-${position + 1}`} className="py-4">
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-1 text-ink-soft">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
