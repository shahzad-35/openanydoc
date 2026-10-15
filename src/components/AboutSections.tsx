import { faqItems, features, notSupportedNote, privacyText } from '../content'
import { useT } from '../i18n'
import { viewers } from '../viewers'
import FileTypeChip from './FileTypeChip'
import NewBadge from './NewBadge'

export function PrivacySection() {
  const { t } = useT()
  return (
    <div>
      <h2 className="type-h3">Why OpenAnyDoc is private: your files are never uploaded</h2>
      <p className="mt-2">{privacyText}</p>
      <h3 className="mt-4 font-semibold">{t('privacy.newFeaturesHeading')}</h3>
      <p className="mt-1">{t('privacy.newFeaturesText')}</p>
    </div>
  )
}

export function SupportedFilesSection() {
  return (
    <div>
      <h2 className="type-h3">Supported file types: CSV, Excel, JSON and TXT</h2>
      <ul className="mt-2 space-y-3">
        {viewers.map((viewer) => (
          <li key={viewer.label}>
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
    <div>
      <h2 className="type-h3">Features of the free online file viewer and editor</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

export function FaqSection() {
  return (
    <div>
      <h2 className="type-h3">Frequently asked questions</h2>
      <dl className="rule-list mt-2">
        {faqItems.map((item) => (
          <div key={item.question} className="py-4">
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-1 text-ink-soft">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
