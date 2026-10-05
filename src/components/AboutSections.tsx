import { faqItems, features, notSupportedNote, privacyText } from '../content'
import { viewers } from '../viewers'
import FileTypeChip from './FileTypeChip'

export function PrivacySection() {
  return (
    <div>
      <h2 className="type-h3">Why it is private</h2>
      <p className="mt-2">{privacyText}</p>
    </div>
  )
}

export function SupportedFilesSection() {
  return (
    <div>
      <h2 className="type-h3">Supported files</h2>
      <ul className="mt-2 space-y-3">
        {viewers.map((viewer) => (
          <li key={viewer.label}>
            <FileTypeChip viewer={viewer} />{' '}
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
      <h2 className="type-h3">Features</h2>
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
      <h2 className="type-h3">Questions</h2>
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
