import { Suspense, lazy, useEffect, useState } from 'react'
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
import { downloadTextFile, formatDefinitions } from '../formats/registry'
import { isolateLeftToRight, localizePath, useT } from '../i18n'
import { samplesByPage } from '../samples/toolSamples'
import { pageSeo } from '../seo'
import { findLiveTool, findRelatedPages, hubs, liveTools, toolContent, toolPath } from '../tools/registry'
import type { Tool } from '../tools/registry'
import { formatFileSize, useFileIntake } from '../useFileIntake'
import { findViewerByToolPath, findViewerForFileName, viewers } from '../viewers'
import type { ConversionTarget, Viewer } from '../viewers'
import { headerRowBreak } from './changelogMarkup'
import { usePageHead } from './HomePage'

// The components of the tools that work on the page (Merge PDF ...), loaded when the first file is chosen (or ahead, while the
// page is idle: App).
const toolComponents = new Map(liveTools.flatMap((tool) => (tool.loadComponent ? [[tool.slug, lazy(tool.loadComponent)] as const] : [])))
// What a tool made, shown before the download (loaded with the first result only).
const ToolResultPreview = lazy(() => import('../tools/pdf/ToolResultPreview'))
const MaskWorkbench = lazy(() => import('../formats/mask/MaskWorkbench'))
const JsonUrlLoader = lazy(() => import('../formats/json/JsonUrlLoader'))
const viewerIdByConversionTarget: Record<ConversionTarget, Viewer['id']> = { csv: 'csv', xlsx: 'excel', json: 'json' }
// The formats the Mask Data page takes, for its list of extensions (only the extensions the page accepts are listed).
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
  onUnsavedEditsChange,
  confirmDiscardEdits,
}: {
  tool: Tool
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
  onNavigate: (path: string) => void
  handoffFile: File | null
  onHandoffConsumed: () => void
  onOpenInViewer: (file: File, toolPath: string) => void
  onUnsavedEditsChange: (hasUnsavedEdits: boolean) => void
  confirmDiscardEdits: () => Promise<boolean>
}) {
  const { locale, t } = useT()
  const address = toolPath(tool)
  const content = toolContent[locale][tool.slug]
  const toolName = pageSeo[locale][toolPath(tool)].linkText ?? content.heading
  usePageHead(address, content.title, content.description)
  // Every tool works offline (src/sw.ts); a tool whose own features don't say so gets the shared block.
  const offlineFeature = { title: t('toolPage.offlineFeature.title'), text: t('toolPage.offlineFeature.text') }
  const features = content.features.some((feature) => feature.title === offlineFeature.title) ? content.features : [...content.features, offlineFeature]
  const hasMounted = useHasMounted()
  const hasToolComponent = toolComponents.has(tool.slug)
  const ToolComponent = toolComponents.get(tool.slug) as NonNullable<ReturnType<typeof toolComponents.get>>
  const toolViewer = findViewerByToolPath(address)
  const convertTo = toolViewer?.convertTo
  const isMaskTool = toolViewer?.tool === 'mask'
  const aiHub = hubs.find((hub) => hub.category === 'ai')
  const isAiReadyTool = tool.group === 'aiReady' || (aiHub?.sharedTools?.aiReady ?? []).includes(tool.slug)
  // Pasted text opens as a file of the page's first format: on the JSON and CSV viewers' pages (YAML, XML, HTML or SQL on the
  // pages that read those), and on the CSV tools (CSV to SQL, Merge CSV ...). Not on Mask data, which takes the file itself.
  const pastedTextExtension =
    (toolViewer?.id === 'json' || toolViewer?.id === 'csv') && !isMaskTool ? toolViewer.extensions[0] : hasToolComponent && !tool.takesText && tool.inputFormats[0] === '.csv' ? '.csv' : undefined
  const [pastedText, setPastedText] = useState('')
  const [chosenFiles, setChosenFiles] = useState<File[]>([])
  const [resultFile, setResultFile] = useState<File | null>(null)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isUrlLoaderShown, setIsUrlLoaderShown] = useState(false)
  // What a conversion page shows while it converts, or why it could not.
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)

  // A file is read by its own format (an Excel file on a page that opens the CSV viewer); one already in the page's result format
  // (a CSV on the Pivot table page) opens as it is.
  async function convertAndOpen(file: File, fileContents: ArrayBuffer) {
    if (!toolViewer || !convertTo) return
    const fileViewerId = findViewerForFileName(file.name)?.id
    if (fileViewerId === viewerIdByConversionTarget[convertTo]) {
      onFileLoaded(file, fileContents)
      return
    }
    setIsConverting(true)
    setConversionError(null)
    const { convertForViewer } = await import('../formats/conversion')
    const result = await convertForViewer(file, fileViewerId ?? toolViewer.id, convertTo, locale)
    setIsConverting(false)
    if ('error' in result) {
      setConversionError(result.error)
      return
    }
    onFileLoaded(result.file, await result.file.arrayBuffer())
  }

  // A one-file tool replaces its file: with unsaved edits it asks first, and the tool starts afresh (key) so no edit carries over.
  async function keepChosenFile(file: File) {
    if (!tool.takesSeveralFiles && hasUnsavedEdits && !(await confirmDiscardEdits())) return
    setResultFile(null)
    setIsDownloaded(false)
    if (!tool.takesSeveralFiles) {
      setToolHasEdits(false)
      setToolSessionKey((key) => key + 1)
    }
    setChosenFiles((files) => (tool.takesSeveralFiles ? [...files, file] : [file]))
  }

  const intake = useFileIntake({
    acceptedExtensions: toolViewer?.extensions ?? tool.inputFormats,
    onFileLoaded: hasToolComponent || isMaskTool ? (file) => void keepChosenFile(file) : convertTo ? (file, fileContents) => void convertAndOpen(file, fileContents) : onFileLoaded,
    handoffFile,
    onHandoffConsumed,
    allowsSeveralFiles: tool.takesSeveralFiles,
    acceptsComingSoonFormats: hasToolComponent,
    pageMaxFileBytes: formatDefinitions.find((definition) => definition.viewerId === toolViewer?.id)?.maxFileBytes,
  })

  // An editing tool's edits count as saved once their copy is downloaded; going back to edit makes them unsaved again.
  const [toolHasEdits, setToolHasEdits] = useState(false)
  const [toolSessionKey, setToolSessionKey] = useState(0)
  const hasUnsavedEdits = toolHasEdits && !(resultFile && isDownloaded)
  useEffect(() => {
    onUnsavedEditsChange(hasUnsavedEdits)
    if (!hasUnsavedEdits) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasUnsavedEdits, onUnsavedEditsChange])
  useEffect(() => () => onUnsavedEditsChange(false), [onUnsavedEditsChange])

  async function startOver() {
    if (hasUnsavedEdits && !(await confirmDiscardEdits())) return
    setChosenFiles([])
    setResultFile(null)
    setIsDownloaded(false)
    setToolHasEdits(false)
  }

  function backToTool() {
    setResultFile(null)
    setIsDownloaded(false)
  }

  // The next tools take the result in memory (App's hand-over, as the "Open it in the ... viewer" button does), never in the URL.
  // A next tool that can't take the result (pictures, text or a ZIP made from a PDF) gets the PDF that was chosen instead.
  const nextSteps = (tool.nextTools ?? []).flatMap((slug) => {
    const nextTool = findLiveTool(slug)
    if (!nextTool || !resultFile) return []
    const takes = (file: File) => nextTool.inputFormats.some((extension) => file.name.toLowerCase().endsWith(extension))
    const handedFile = takes(resultFile) ? resultFile : chosenFiles.find(takes)
    if (!handedFile) return []
    return [{ id: slug, label: pageSeo[locale][toolPath(nextTool)].linkText as string, onSelect: () => onOpenInViewer(handedFile, localizePath(locale, toolPath(nextTool))) }]
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
              <span id="tool-privacy-badge" className="control-shape inline-flex items-center gap-1.5 bg-surface px-3 py-1 text-xs font-semibold text-ink sm:text-sm">
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
              {!tool.needsNoFile && <DropPanel
                intake={intake}
                shownViewers={isMaskTool && toolViewer ? maskableViewers.map((viewer) => ({ ...viewer, extensions: viewer.extensions.filter((extension) => toolViewer.extensions.includes(extension)) })) : toolViewer ? [toolViewer] : viewers}
                currentViewerId={isMaskTool ? undefined : toolViewer?.id}
                onNavigate={onNavigate}
                onOpenInViewer={onOpenInViewer}
                showExtensions={Boolean(toolViewer)}
                showOtherFormats={Boolean(toolViewer) && !convertTo}
                samples={samplesByPage[address]}
              />}
              {/* The JSON pages can also open a file from a web address the visitor types (their browser fetches it). */}
              {toolViewer?.id === 'json' && (
                <div className="mt-4">
                  {isUrlLoaderShown ? (
                    <Suspense fallback={null}>
                      <JsonUrlLoader onFileLoaded={(file) => void intake.openSampleFile(file)} />
                    </Suspense>
                  ) : (
                    <button id="open-url-button" type="button" className="btn btn--quiet btn--compact press" onClick={() => setIsUrlLoaderShown(true)}>
                      {t('json.url.menu')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {pastedTextExtension && (
            <details id="paste-text" className="mx-auto mt-4 max-w-[640px] text-center">
              <summary id="paste-text-summary" className="btn btn--quiet btn--compact press list-none">
                {t('tools.pasteText.summary')}
              </summary>
              <label htmlFor="paste-text-input" className="mt-3 block text-start text-sm font-semibold">
                {t('tools.pasteText.label')}
              </label>
              <textarea
                id="paste-text-input"
                dir="ltr"
                rows={6}
                spellCheck={false}
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                className="mt-1 w-full rounded-[14px] border-2 border-rule bg-paper-raised p-3 text-start font-mono text-sm pointer-coarse:text-base"
              />
              <button
                id="paste-text-open-button"
                type="button"
                disabled={pastedText.trim() === '' || intake.isReading}
                onClick={() => void intake.openSampleFile(new File([pastedText], `pasted${pastedTextExtension}`, { type: 'text/plain' }))}
                className="btn btn--primary btn--compact press mt-2"
              >
                {t('tools.pasteText.open')}
              </button>
            </details>
          )}
          {(pastedTextExtension || tool.takesText) && (
            <p id="pasted-text-note" className="mx-auto mt-3 max-w-[640px] text-center text-sm text-ink-soft">
              {t('tools.pastedTextNote')}
            </p>
          )}
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
          {/* Kept while the result shows (hidden), so an editing tool's edits are still there after "Back to the tool". */}
          {/* A text tool (Base64, JWT, XML viewer) is drawn at once; the others once a file is chosen. */}
          {hasToolComponent && (chosenFiles.length > 0 || ((tool.takesText || tool.needsNoFile) && hasMounted)) && (
            <div id="tool-workspace" hidden={resultFile !== null} className={`mx-auto mt-8 ${tool.isEditor ? 'max-w-[1100px]' : 'max-w-[760px]'}`}>
              <Suspense fallback={null}>
                <ToolComponent
                  key={toolSessionKey}
                  files={chosenFiles}
                  onFilesChange={setChosenFiles}
                  onAddFiles={intake.openFilePicker}
                  onResult={(file) => {
                    setResultFile(file)
                    setIsDownloaded(false)
                  }}
                  onUnsavedEditsChange={setToolHasEdits}
                  confirmDiscardEdits={confirmDiscardEdits}
                  onOpenInPage={(file, path) => onOpenInViewer(file, localizePath(locale, path))}
                />
              </Suspense>
            </div>
          )}
          {resultFile && (
            <div id="tool-result" className="mx-auto mt-8 max-w-[760px] overflow-hidden rounded-[22px] border-2 border-rule bg-paper-raised text-center">
              <div className="p-6">
                <p id="tool-result-message" role="status" className="font-semibold">
                  {t('tools.result.ready')} <bdi dir="ltr">{resultFile.name}</bdi>
                </p>
                {tool.showsSizeChange && chosenFiles[0] && (
                  <>
                    <p id="tool-result-size-change" className="mt-2 text-sm text-ink-soft">
                      {t('tools.result.sizeChange', { original: isolateLeftToRight(formatFileSize(chosenFiles[0].size)), result: isolateLeftToRight(formatFileSize(resultFile.size)), percent: Math.round((1 - resultFile.size / chosenFiles[0].size) * 100) })}
                    </p>
                    {/* An honest word when the saving is small, so the percentage is not read as a promise for other files. */}
                    {resultFile.size > chosenFiles[0].size * 0.9 && (
                      <p id="tool-result-small-saving" className="mt-1 text-sm text-ink-soft">
                        {t('tools.result.smallSaving')}
                      </p>
                    )}
                  </>
                )}
                <Suspense fallback={null}>
                  <ToolResultPreview file={resultFile} />
                </Suspense>
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
                  {tool.isEditor && (
                    <button id="tool-back-button" type="button" onClick={backToTool} className="btn btn--quiet press">
                      {t('tools.result.backToEditing')}
                    </button>
                  )}
                  <button id="tool-start-over-button" type="button" onClick={() => void startOver()} className="btn btn--quiet press">
                    {t('tools.result.startOver')}
                  </button>
                </div>
              </div>
              {isDownloaded && <NextSteps steps={nextSteps} isReady />}
            </div>
          )}
          {/* The AI-ready pages (the /ai-tools hub's tools): a reminder to take personal data out first, with the way to do it. */}
          {isAiReadyTool && (
            <aside id="ai-paste-box" aria-labelledby="ai-paste-box-title" className="mx-auto mt-8 max-w-[760px] rounded-[22px] border-2 border-rule bg-surface p-5 text-start">
              <h2 id="ai-paste-box-title" className="font-semibold">
                {t('aiReady.box.title')}
              </h2>
              <p className="mt-1 text-[15px] text-ink-soft">{t('aiReady.box.text')}</p>
              <PageLink id="ai-paste-box-link" path="/mask-data" onNavigate={onNavigate} className="mt-2 inline-flex min-h-8 items-center font-semibold text-accent underline underline-offset-2 pointer-coarse:min-h-11">
                {t('aiReady.box.link')}
              </PageLink>
            </aside>
          )}
        </section>

        <div id="about-content" className="section-gap">
          {content.intro && <p id="page-intro" className="type-lead mx-auto mb-12 max-w-3xl text-ink-soft">{content.intro}</p>}
          <section id="tool-features" className="mx-auto mb-12 max-w-3xl">
            <h2 id="tool-features-heading" className="sr-only">{t('tools.featuresHeading', { tool: toolName })}</h2>
            <ul className={`grid gap-4 ${features.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              {features.map((feature, position) => (
                <li key={feature.title} id={`tool-feature-${position + 1}`} className="rounded-[22px] border-2 border-rule bg-paper-raised p-5">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-[15px] text-ink-soft">{feature.text}</p>
                </li>
              ))}
            </ul>
          </section>
          <FormatGuide content={content} toolName={toolName} fileType={toolViewer?.id ?? 'pdf'} relatedPages={findRelatedPages(tool)} onNavigate={onNavigate} />
        </div>
      </main>

      <SiteFooter currentPath={address} onNavigate={onNavigate} />
    </div>
  )
}
