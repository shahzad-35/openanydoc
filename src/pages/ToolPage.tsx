import { Suspense, lazy, useState } from 'react'
import DropPanel from '../components/DropPanel'
import FormatGuide from '../components/FormatGuide'
import { Wordmark } from '../components/KitIcon'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Notice } from '../components/Messages'
import { useHasMounted } from '../components/NewBadge'
import NextSteps from '../components/NextSteps'
import SiteFooter, { PageBreadcrumb, PageLink } from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import ThemeToggle from '../components/ThemeToggle'
import { downloadTextFile } from '../formats/registry'
import { localizePath, useT } from '../i18n'
import { samplesByPage } from '../samples/toolSamples'
import { pageSeo } from '../seo'
import { findLiveTool, findRelatedPages, liveTools, toolContent, toolPath } from '../tools/registry'
import type { Tool } from '../tools/registry'
import { useFileIntake } from '../useFileIntake'
import { findViewerByToolPath, viewers } from '../viewers'
import { headerRowBreak } from './changelogMarkup'
import { usePageHead } from './HomePage'

// The components of the tools that work on the page (Merge PDF ...), loaded when the first file is chosen (or ahead, while the
// page is idle: App).
const toolComponents = new Map(liveTools.flatMap((tool) => (tool.loadComponent ? [[tool.slug, lazy(tool.loadComponent)] as const] : [])))
const MaskWorkbench = lazy(() => import('../formats/mask/MaskWorkbench'))
// The formats the Mask Data page takes, for its list of extensions.
const maskableViewers = viewers.filter((viewer) => ['csv', 'json', 'excel', 'text'].includes(viewer.id))

// One page for every tool in src/tools/registry.ts. First screen (Step 17C): breadcrumb, heading, the sentence that answers the
// search, the "nothing is uploaded" badge, the drop zone with two samples, then the tool. Under it: the longer intro, the feature
// blocks and FormatGuide (how-to, screenshot, what it handles, comparison, limits, questions, related pages). Words from
// src/content/tools/<slug>.<locale>.json.
// What a chosen file does depends on the tool: a tool with a component (Merge PDF) keeps it on the page and offers the result for
// download and to the next tools; a viewer's page opens it in the viewer (onFileLoaded); a conversion page converts it first and
// opens the result in the viewer of its new format; Mask data keeps it on the page. Files and results live in React state only;
// App draws this page afresh for each tool, so they are forgotten on leaving.
export default function ToolPage({
  tool,
  onFileLoaded,
  onNavigate,
  handoffFile,
  onHandoffConsumed,
  onOpenInViewer,
}: {
  tool: Tool
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
  onNavigate: (path: string) => void
  handoffFile: File | null
  onHandoffConsumed: () => void
  onOpenInViewer: (file: File, toolPath: string) => void
}) {
  const { locale, t } = useT()
  const address = toolPath(tool)
  const content = toolContent[locale][tool.slug]
  usePageHead(address, content.title, content.description)
  const hasMounted = useHasMounted()
  const hasToolComponent = toolComponents.has(tool.slug)
  const ToolComponent = toolComponents.get(tool.slug) as NonNullable<ReturnType<typeof toolComponents.get>>
  const toolViewer = findViewerByToolPath(address)
  const convertTo = toolViewer?.convertTo
  const isMaskTool = toolViewer?.tool === 'mask'
  const [chosenFiles, setChosenFiles] = useState<File[]>([])
  const [resultFile, setResultFile] = useState<File | null>(null)
  const [isDownloaded, setIsDownloaded] = useState(false)
  // What a conversion page shows while it converts, or why it could not.
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)

  async function convertAndOpen(file: File) {
    if (!toolViewer || !convertTo) return
    setIsConverting(true)
    setConversionError(null)
    const { convertForViewer } = await import('../formats/conversion')
    const result = await convertForViewer(file, toolViewer.id, convertTo, locale)
    setIsConverting(false)
    if ('error' in result) {
      setConversionError(result.error)
      return
    }
    onFileLoaded(result.file, await result.file.arrayBuffer())
  }

  function keepChosenFile(file: File) {
    setResultFile(null)
    setChosenFiles((files) => (tool.takesSeveralFiles ? [...files, file] : [file]))
  }

  const intake = useFileIntake({
    acceptedExtensions: toolViewer?.extensions ?? tool.inputFormats,
    onFileLoaded: hasToolComponent || isMaskTool ? keepChosenFile : convertTo ? (file) => void convertAndOpen(file) : onFileLoaded,
    handoffFile,
    onHandoffConsumed,
    allowsSeveralFiles: tool.takesSeveralFiles,
    acceptsComingSoonFormats: hasToolComponent,
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
        <button id="header-open-file-button" type="button" disabled={intake.isReading} onClick={intake.openFilePicker} className="btn btn--primary btn--compact press order-last xl:order-none xl:-ms-2">
          {t('nav.openFile')}
        </button>
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
              <DropPanel
                intake={intake}
                shownViewers={isMaskTool ? maskableViewers : toolViewer ? [toolViewer] : viewers}
                currentViewerId={isMaskTool ? undefined : toolViewer?.id}
                onNavigate={onNavigate}
                onOpenInViewer={onOpenInViewer}
                showExtensions={Boolean(toolViewer)}
                showOtherFormats={Boolean(toolViewer) && !convertTo}
                samples={samplesByPage[address]}
              />
            </div>
          </div>
          {(isConverting || conversionError) && (
            <div id="conversion-messages" aria-live="polite" className="mx-auto mt-6 max-w-[640px] text-center">
              {isConverting && (
                <p id="conversion-status" role="status" className="font-medium text-ink-soft">
                  {t('convert.converting')}
                </p>
              )}
              <Notice id="conversion-error" kind="error" role="alert" className="font-medium text-danger" message={conversionError ?? ''} />
            </div>
          )}
          {/* Mask data draws after the first render: it runs a worker and holds the file, nothing the static page can show. */}
          {isMaskTool && hasMounted && (
            <Suspense fallback={null}>
              <MaskWorkbench file={chosenFiles[0] ?? null} />
            </Suspense>
          )}
          {hasToolComponent && chosenFiles.length > 0 && !resultFile && (
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

        <div id="about-content" className="section-gap">
          {content.intro && <p id="page-intro" className="type-lead mx-auto mb-12 max-w-3xl text-ink-soft">{content.intro}</p>}
          <section id="tool-features" className="mx-auto mb-12 max-w-3xl">
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
          <FormatGuide content={content} fileType={toolViewer?.id ?? 'pdf'} relatedPages={findRelatedPages(tool)} onNavigate={onNavigate} />
        </div>
      </main>

      <SiteFooter currentPath={address} onNavigate={onNavigate} />
    </div>
  )
}
