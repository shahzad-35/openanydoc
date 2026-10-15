import { faqItems, features, notSupportedNote, privacyText } from '../content'
import { useT } from '../i18n'
import { viewers } from '../viewers'
import FileTypeChip from './FileTypeChip'
import NewBadge from './NewBadge'

export function PrivacySection() {
  const { t } = useT()
  return (
    <div id="privacy-section">
      <h2 id="privacy-heading" className="type-h3">Why OpenAnyDoc is private: your files are never uploaded</h2>
      <p id="privacy-text" className="mt-2">{privacyText}</p>
      <h3 id="new-features-heading" className="mt-4 font-semibold">{t('privacy.newFeaturesHeading')}</h3>
      <p id="new-features-text" className="mt-1">{t('privacy.newFeaturesText')}</p>
    </div>
  )
}

export function SupportedFilesSection() {
  return (
    <div id="supported-files-section">
      <h2 id="supported-files-heading" className="type-h3">Supported file types: CSV, Excel, JSON and TXT</h2>
      <ul id="supported-files-list" className="mt-2 space-y-3">
        {viewers.map((viewer) => (
          <li key={viewer.label} id={`supported-file-${viewer.id}`}>
            <FileTypeChip viewer={viewer} />
            <NewBadge viewerId={viewer.id} />{' '}
            <span className="font-mono text-sm text-ink-soft">{viewer.extensions.join('  ')}</span>
            <span className="block text-ink-soft">{viewer.description}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-ink-soft">{notSupportedNote}</p>
    </div>
  )
}

export function FeaturesSection() {
  return (
    <div id="features-section">
      <h2 id="features-heading" className="type-h3">Features of the free online file viewer and editor</h2>
      <ul id="features-list" className="mt-2 list-disc space-y-1 pl-6">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

export function FaqSection() {
  return (
    <div id="faq-section">
      <h2 id="faq-heading" className="type-h3">Frequently asked questions</h2>
      <dl id="faq-list" className="rule-list mt-2">
        {faqItems.map((item, position) => (
          <div key={item.question} id={`faq-item-${position + 1}`} className="py-4">
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-1 text-ink-soft">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
