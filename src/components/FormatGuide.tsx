import { useT } from '../i18n'
import { pageSeo } from '../seo'
import type { ToolContent, ToolQuestion } from '../tools/registry'
import type { Viewer } from '../viewers'
import { PrivacySection } from './AboutSections'
import { PageLink } from './SiteFooter'

// The answer's `link` phrase becomes a link to that page; the text stays the same as the FAQPage data the build writes.
function withPageLink(item: ToolQuestion, onNavigate: (path: string) => void) {
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

// The text of a tool page under the tool: numbered steps ("How it works"), the viewer's screenshot, what it handles, a comparison
// table, what it can't do, the questions and answers, related pages, then the privacy note. Read from the tool's
// src/content/tools/<slug>.<locale>.json, which the build also uses for the page's static HTML and FAQ data. `fileType` colours the
// step numbers (data-file-type in index.css).
export default function FormatGuide({ content, fileType, relatedPages, onNavigate }: { content: ToolContent; fileType: Viewer['id']; relatedPages: string[]; onNavigate: (path: string) => void }) {
  const { locale, t } = useT()
  return (
    <div id="format-guide" data-file-type={fileType} className="mx-auto max-w-3xl space-y-12">
      <section id="how-to-section">
        <h2 id="how-to-heading" className="type-h3">{content.stepsTitle ?? t('tools.howToHeading', { tool: content.heading })}</h2>
        <ol id="how-to-steps" className="mt-4 space-y-5">
          {content.steps.map((step, position) => (
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
      {content.screenshot && (
        <figure id="viewer-screenshot" className="overflow-hidden rounded-[22px] border-2 border-rule bg-paper-raised">
          <img src={`/screenshots/${locale}-${fileType}.webp`} width="1200" height="750" loading="lazy" decoding="async" alt={content.screenshot.alt} className="block h-auto w-full" />
          <figcaption className="border-t border-rule px-4 py-3 text-sm text-ink-soft">{content.screenshot.caption}</figcaption>
        </figure>
      )}
      {content.handles && (
        <section id="handles-section">
          <h2 id="handles-heading" className="type-h3">{content.handlesTitle}</h2>
          <ul id="handles-list" className="mt-4 list-disc space-y-2 ps-6">
            {content.handles.map((item, position) => (
              <li key={item} id={`handles-item-${position + 1}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {content.comparison && (
        <section id="comparison-section">
          <h2 id="comparison-heading" className="type-h3">{content.comparison.title}</h2>
          <div className="mt-4 overflow-x-auto">
            <table id="comparison-table" className="w-full min-w-[560px] border-collapse text-[15px]">
              <thead>
                <tr>
                  <th scope="col" className="border-b-2 border-rule py-2 pe-3 text-start font-semibold"></th>
                  {content.comparison.columns.map((column) => (
                    <th key={column} scope="col" className="border-b-2 border-rule px-3 py-2 text-start font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.comparison.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="border-b border-rule py-2 pe-3 text-start align-top font-medium">{row.label}</th>
                    {row.cells.map((cell, position) => (
                      <td key={position} className={`border-b border-rule px-3 py-2 align-top ${position === 0 ? 'text-ink' : 'text-ink-soft'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section id="tool-limits-section">
        <h2 id="tool-limits-heading" className="type-h3">{t('tools.limitsHeading')}</h2>
        <ul id="tool-limits-list" className="mt-4 list-disc space-y-2 ps-6">
          {content.limits.map((limit, position) => (
            <li key={limit} id={`tool-limit-${position + 1}`}>{limit}</li>
          ))}
        </ul>
      </section>
      <section id="format-faq-section">
        <h2 id="format-faq-heading" className="type-h3">{content.faqTitle ?? t('tools.faqHeading')}</h2>
        <dl id="format-faq-list" className="rule-list mt-2">
          {content.faq.map((item, position) => (
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
          {relatedPages.map((path) => (
            <li key={path}>
              <PageLink
                id={`related-link-${path.slice(1)}`}
                path={path}
                onNavigate={onNavigate}
                className="control-shape solid-box inline-flex min-h-11 items-center border-rule bg-paper-raised px-4 font-medium transition-colors duration-200 hover:bg-paper"
              >
                {pageSeo[locale][path].linkText ?? pageSeo[locale][path].heading}
              </PageLink>
            </li>
          ))}
        </ul>
      </section>
      <PrivacySection />
    </div>
  )
}
