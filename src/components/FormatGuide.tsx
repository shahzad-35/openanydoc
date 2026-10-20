import { useT } from '../i18n'
import { formatGuides, relatedPages, type GuideQuestion } from '../pageContent'
import { pageSeo } from '../seo'
import type { Viewer } from '../viewers'
import { PrivacySection } from './AboutSections'
import { PageLink } from './SiteFooter'

// The answer's `link` phrase becomes a link to that page; the text stays the same as the FAQPage data the build writes.
function withPageLink(item: GuideQuestion, onNavigate: (path: string) => void) {
  if (!item.link) return item.answer
  const [before, after] = item.answer.split(item.link.text)
  if (after === undefined) return item.answer
  return (
    <>
      {before}
      <PageLink id={`format-faq-link-${item.link.path.slice(1)}`} path={item.link.path} onNavigate={onNavigate} className="underline underline-offset-2 hover:text-accent">
        {item.link.text}
      </PageLink>
      {after}
    </>
  )
}

// The text that fills a format or landing page under the drop zone: numbered steps ("How it works"), what the viewer handles, then
// that page's questions and answers, links to related pages, then the privacy note. Read from src/pageContent.ts, which the build also uses for the page's static HTML and FAQ data.
export default function FormatGuide({ address, viewerId, onNavigate }: { address: string; viewerId: Viewer['id']; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  const guide = formatGuides[locale][address]
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
      <section id="handles-section">
        <h2 id="handles-heading" className="type-h3">{guide.handlesTitle}</h2>
        <ul id="handles-list" className="mt-4 list-disc space-y-2 ps-6">
          {guide.handles.map((item, position) => (
            <li key={item} id={`handles-item-${position + 1}`}>{item}</li>
          ))}
        </ul>
      </section>
      <section id="format-faq-section">
        <h2 id="format-faq-heading" className="type-h3">{guide.faqTitle}</h2>
        <dl id="format-faq-list" className="rule-list mt-2">
          {guide.faq.map((item, position) => (
            <div key={item.question} id={`format-faq-item-${position + 1}`} className="py-4">
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 text-ink-soft">{withPageLink(item, onNavigate)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="related-tools">
        <h2 id="related-tools-heading" className="type-h3">{t('related.heading')}</h2>
        <ul id="related-tools-list" className="mt-4 flex flex-wrap gap-3">
          {relatedPages[address].map((path) => (
            <li key={path}>
              <PageLink
                id={`related-link-${path.slice(1)}`}
                path={path}
                onNavigate={onNavigate}
                className="control-shape solid-box inline-flex min-h-11 items-center border-rule bg-paper-raised px-4 font-medium transition-colors duration-200 hover:bg-paper"
              >
                {pageSeo[locale][path].linkText}
              </PageLink>
            </li>
          ))}
        </ul>
      </section>
      <PrivacySection />
    </div>
  )
}
