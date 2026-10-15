import { formatGuides } from '../pageContent'
import type { Viewer } from '../viewers'
import { PrivacySection } from './AboutSections'

// The text that fills a format's own page under the drop zone: numbered steps, then that file type's questions and answers, then
// the privacy note. Read from src/pageContent.ts, which the build also uses for the page's static HTML and FAQ data.
export default function FormatGuide({ address, viewerId }: { address: string; viewerId: Viewer['id'] }) {
  const guide = formatGuides[address]
  if (!guide) return null
  return (
    <div id="format-guide" data-file-type={viewerId} className="mx-auto max-w-3xl space-y-12">
      <section id="how-to-section">
        <h2 id="how-to-heading" className="type-h3">{guide.stepsTitle}</h2>
        <ol id="how-to-steps" className="mt-4 space-y-5">
          {guide.steps.map((step, position) => (
            <li key={step.title} id={`how-to-step-${position + 1}`} className="flex gap-4">
              <span aria-hidden="true" className="control-shape type-h3 grid size-8 shrink-0 place-items-center bg-(--file-color) text-sm text-on-accent">
                {position + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-ink-soft">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section id="format-faq-section">
        <h2 id="format-faq-heading" className="type-h3">{guide.faqTitle}</h2>
        <dl id="format-faq-list" className="rule-list mt-2">
          {guide.faq.map((item, position) => (
            <div key={item.question} id={`format-faq-item-${position + 1}`} className="py-4">
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 text-ink-soft">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
      <PrivacySection />
    </div>
  )
}
