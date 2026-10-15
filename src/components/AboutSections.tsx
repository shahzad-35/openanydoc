import { faqItems, features } from '../content'
import { useT } from '../i18n'
import { viewers } from '../viewers'
import FileTypeChip from './FileTypeChip'
import NewBadge from './NewBadge'

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

export function SupportedFilesSection() {
  const { t } = useT()
  return (
    <div id="supported-files-section">
      <h2 id="supported-files-heading" className="type-h3">{t('about.supportedHeading')}</h2>
      <ul id="supported-files-list" className="mt-2 space-y-3">
        {viewers.map((viewer) => (
          <li key={viewer.label} id={`supported-file-${viewer.id}`}>
            <FileTypeChip viewer={viewer} />
            <NewBadge viewerId={viewer.id} />{' '}
            <span dir="ltr" className="inline-block font-mono text-sm text-ink-soft">{viewer.extensions.join('  ')}</span>
            <span className="block text-ink-soft">{t(`viewer.description.${viewer.id}`)}</span>
          </li>
        ))}
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
