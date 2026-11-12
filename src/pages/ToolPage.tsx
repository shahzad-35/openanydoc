import { Suspense, lazy, useState } from 'react'
import DropPanel from '../components/DropPanel'
import { Wordmark } from '../components/KitIcon'
import LanguageSwitcher from '../components/LanguageSwitcher'
import NextSteps from '../components/NextSteps'
import SiteFooter, { PageBreadcrumb, PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import ThemeToggle from '../components/ThemeToggle'
import { PrivacySection } from '../components/AboutSections'
import { downloadTextFile } from '../formats/registry'
import { localizePath, useT } from '../i18n'
import { samplesByPage } from '../samples/toolSamples'
import { pageSeo } from '../seo'
import { findLiveTool, findRelatedTools, liveToolPages, toolContent, toolPath } from '../tools/registry'
import type { Tool } from '../tools/registry'
import { useFileIntake } from '../useFileIntake'
import { headerRowBreak } from './changelogMarkup'
import { usePageHead } from './HomePage'

// Each tool's component, loaded when its first file is chosen (or ahead, while the page is idle: App).
const toolComponents = new Map(liveToolPages.map((tool) => [tool.slug, lazy(tool.loadComponent as NonNullable<Tool['loadComponent']>)]))

// One page for every tool in src/tools/registry.ts that has no page of its own (Merge PDF ...): the Step 17C first screen (heading,
// the sentence that answers the search, the "nothing is uploaded" badge, the drop zone with two samples, then the tool), then the
// tool's features, how-to, limits, questions and six related tools. Its words come from src/content/tools/<slug>.<locale>.json.
// The chosen files and the result live in React state only; App draws this page afresh for each tool, so they are forgotten on leaving.
export default function ToolPage({
  tool,
  onNavigate,
  handoffFile,
  onHandoffConsumed,
  onOpenInViewer,
}: {
  tool: Tool
  onNavigate: (path: string) => void
  handoffFile: File | null
  onHandoffConsumed: () => void
  onOpenInViewer: (file: File, toolPath: string) => void
}) {
  const { locale, t } = useT()
  const address = toolPath(tool)
  const content = toolContent[locale][tool.slug]
  usePageHead(address, content.title, content.description)
  const ToolComponent = toolComponents.get(tool.slug) as NonNullable<ReturnType<typeof toolComponents.get>>
  const [chosenFiles, setChosenFiles] = useState<File[]>([])
  const [resultFile, setResultFile] = useState<File | null>(null)
  const [isDownloaded, setIsDownloaded] = useState(false)

  const intake = useFileIntake({
    acceptedExtensions: tool.inputFormats,
    onFileLoaded: (file) => {
      setResultFile(null)
      setChosenFiles((files) => (tool.takesSeveralFiles ? [...files, file] : [file]))
    },
    handoffFile,
    onHandoffConsumed,
    allowsSeveralFiles: tool.takesSeveralFiles,
    acceptsComingSoonFormats: true,
  })

  function startOver() {
    setChosenFiles([])
    setResultFile(null)
    setIsDownloaded(false)
  }

  // The next tools take the result in memory (App's hand-over, as the "Open it in the ... viewer" button does), never in the URL.
  const nextSteps = (tool.nextTools ?? []).flatMap((slug) => {
    const nextTool = findLiveTool(slug)
    if (!nextTool || !resultFile) return []
    return [{ id: slug, label: pageSeo[locale][toolPath(nextTool)].linkText as string, onSelect: () => onOpenInViewer(resultFile, localizePath(locale, toolPath(nextTool))) }]
  })

  return (
    <div id="tool-page" {...intake.dropTargetProps} className="toy-page relative min-h-dvh text-[17px] leading-normal text-ink">
      {intake.isDraggingOver && <div id="drag-over-outline" aria-hidden="true" className="pointer-events-none fixed inset-3 z-20 rounded-[30px] border-[3px] border-dashed border-accent" />}
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

      <main id="main" className="mx-auto max-w-[1120px] px-5 pb-24">
        <section id="hero" className="pt-4 sm:pt-10 md:pt-16">
          <PageBreadcrumb address={address} onNavigate={onNavigate} className="mx-auto flex max-w-[640px] justify-center" />
          <div className="mx-auto max-w-[640px] text-center">
            <h1 id="page-heading" className="type-display hero-in text-balance">{content.heading}</h1>
            <p id="page-answer" className="type-lead hero-in mt-3 text-ink-soft sm:mt-5">{content.subtitle}</p>
            <p id="page-proof" className="hero-in mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
              <span id="tool-privacy-badge" className="control-shape inline-flex items-center gap-1.5 bg-surface px-3 py-1 font-semibold text-ink">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t('tools.badge')}
              </span>
              <PageLink id="page-proof-link" path="/check-file-upload" onNavigate={onNavigate} className="text-ink-soft underline underline-offset-2 hover:text-ink">
                {t('hero.proofLink')}
              </PageLink>
            </p>
            <div className="hero-in mt-5 sm:mt-8">
              <DropPanel intake={intake} onNavigate={onNavigate} onOpenInViewer={onOpenInViewer} showExtensions={false} showOtherFormats={false} samples={samplesByPage[address]} />
            </div>
          </div>
          {chosenFiles.length > 0 && !resultFile && (
            <div id="tool-workspace" className="mx-auto mt-8 max-w-[760px]">
              <Suspense fallback={null}>
                <ToolComponent files={chosenFiles} onFilesChange={setChosenFiles} onAddFiles={intake.openFilePicker} onResult={setResultFile} />
              </Suspense>
            </div>
          )}
          {resultFile && (
            <div id="tool-result" className="mx-auto mt-8 max-w-[640px] overflow-hidden rounded-[22px] border-2 border-rule bg-paper-raised text-center">
              <div className="p-6">
                <p id="tool-result-message" role="status" className="font-semibold">
                  {t('tools.result.ready')} <bdi dir="ltr">{resultFile.name}</bdi>
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    id="tool-download-button"
                    type="button"
                    onClick={() => {
                      downloadTextFile(resultFile.name, resultFile, resultFile.type)
                      setIsDownloaded(true)
                    }}
                    className="btn btn--primary press"
                  >
                    {t('tools.result.download')}
                  </button>
                  <button id="tool-start-over-button" type="button" onClick={startOver} className="btn btn--quiet press">
                    {t('tools.result.startOver')}
                  </button>
                </div>
              </div>
              {isDownloaded && <NextSteps steps={nextSteps} isReady />}
            </div>
          )}
        </section>

        <div id="about-content" className="section-gap mx-auto max-w-3xl space-y-12">
          <section id="tool-features">
            <h2 id="tool-features-heading" className="sr-only">{t('tools.featuresHeading')}</h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {content.features.map((feature, position) => (
                <li key={feature.title} id={`tool-feature-${position + 1}`} className="rounded-[22px] border-2 border-rule bg-paper-raised p-5">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-[15px] text-ink-soft">{feature.text}</p>
                </li>
              ))}
            </ul>
          </section>
          <section id="how-to-section">
            <h2 id="how-to-heading" className="type-h3">{t('tools.howToHeading', { tool: content.heading })}</h2>
            <ol id="how-to-steps" className="mt-4 space-y-5">
              {content.steps.map((step, position) => (
                <li key={step.title} id={`how-to-step-${position + 1}`} className="flex gap-4">
                  <span aria-hidden="true" className="control-shape type-h3 grid size-8 shrink-0 place-items-center bg-accent text-sm text-on-accent">
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
          <section id="tool-limits-section">
            <h2 id="tool-limits-heading" className="type-h3">{t('tools.limitsHeading')}</h2>
            <ul id="tool-limits-list" className="mt-4 list-disc space-y-2 ps-6">
              {content.limits.map((limit, position) => (
                <li key={limit} id={`tool-limit-${position + 1}`}>{limit}</li>
              ))}
            </ul>
          </section>
          <section id="format-faq-section">
            <h2 id="format-faq-heading" className="type-h3">{t('tools.faqHeading')}</h2>
            <dl id="format-faq-list" className="rule-list mt-2">
              {content.faq.map((item, position) => (
                <div key={item.question} id={`format-faq-item-${position + 1}`} className="py-4">
                  <dt className="font-medium">{item.question}</dt>
                  <dd className="mt-1 text-ink-soft">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section id="related-tools">
            <h2 id="related-tools-heading" className="type-h3">{t('related.heading')}</h2>
            <ul id="related-tools-list" className="mt-4 flex flex-wrap gap-3">
              {findRelatedTools(tool).map((relatedTool) => (
                <li key={relatedTool.slug}>
                  <PageLink
                    id={`related-link-${relatedTool.slug}`}
                    path={toolPath(relatedTool)}
                    onNavigate={onNavigate}
                    className="control-shape solid-box inline-flex min-h-11 items-center border-rule bg-paper-raised px-4 font-medium transition-colors duration-200 hover:bg-paper"
                  >
                    {pageSeo[locale][toolPath(relatedTool)].linkText}
                  </PageLink>
                </li>
              ))}
            </ul>
          </section>
          <PrivacySection />
        </div>
      </main>

      <SiteFooter currentPath={address} onNavigate={onNavigate} />
    </div>
  )
}
