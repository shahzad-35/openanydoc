import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import DiscardEditsDialog from './components/DiscardEditsDialog'
import { LocaleContext, PagePathContext, SwitchLanguageContext, getBrowserLocale, loadLocale, localizePath, splitLocalePath, useT } from './i18n'
import type { Locale } from './i18n'
import { ToastProvider } from './components/Messages'
import HomePage from './pages/HomePage'
import ToolPage from './pages/ToolPage'
import type { OpenedFile } from './useFileIntake'
import { formatDefinitions } from './formats/registry'
import { guideAddresses } from './seo'
import { findViewerByToolPath, getFileViewPath, isFileViewPath } from './viewers'
import type { ConversionTarget, Viewer } from './viewers'
import { preloadPageSamples } from './samples/toolSamples'
import { ALL_TOOLS_PATH, findLiveHub, findLiveToolPage, hubs } from './tools/registry'
import { loadToolPageWords } from './seo'
import { keepPageForOffline, takeLaunchedFiles, takeSharedFile } from './pwa'

const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
// The file page (viewers, editing, menus) is its own chunk, so content pages load only what they show.
const loadFileViewPage = () => import('./pages/FileViewPage')
const FileViewPage = lazy(loadFileViewPage)
const viewerIdForConversion: Record<ConversionTarget, Viewer['id']> = { csv: 'csv', xlsx: 'excel', json: 'json' }
// Word, Excel, PowerPoint and OpenDocument files are ZIP packages: the file intake reads their file list (fflate) before opening.
const OFFICE_PACKAGE_EXTENSIONS = ['.docx', '.dotx', '.docm', '.xlsx', '.xlsm', '.pptx', '.ppsx', '.potx', '.pptm', '.odt', '.ods']
const acceptsOfficePackages = (extensions: string[]) => extensions.some((extension) => OFFICE_PACKAGE_EXTENSIONS.includes(extension))

// A tiny script run in the SQL worker, so the worker and SQLite are fetched once.
const startSqlWorker = () => import('./formats/csv/sqliteWasm').then((sqlite) => sqlite.readTableFromSqlScript('CREATE TABLE warm_up (a); INSERT INTO warm_up VALUES (1);'))
const startJsonParseWorker = () => import('./formats/json/jsonModel').then((jsonModel) => jsonModel.parseJsonText('null', 'en'))
const loadJsonCodeWriter = () => Promise.all([import('./formats/json/jsonConvert'), import('quicktype-core')])
// The code a page's own task fetches only once a file is chosen (a panel the page opens on, a converter, a reader), by address.
const pageTaskCodeByPath: Record<string, () => Promise<unknown>> = {
  '/chart-maker': () => import('./formats/csv/CsvChartPanel'),
  '/sql-on-csv': () => Promise.all([import('./formats/csv/CsvQueryPanel'), startSqlWorker()]),
  '/sql-to-csv': startSqlWorker,
  '/xml-to-csv': () => import('./formats/json/jsonConvert'),
  '/xml-to-json': () => import('./formats/json/jsonConvert'),
  '/yaml-to-csv': () => import('js-yaml'),
  '/json-to-csv': startJsonParseWorker,
  '/json-graph': () => import('./formats/json/JsonGraph'),
  '/json-compare': () => import('./formats/json/JsonComparePanel'),
  '/json-schema': () => import('./formats/json/JsonSchemaPanel'),
  '/jsonpath': () => import('jsonpath-plus'),
  '/json-to-yaml': () => import('js-yaml'),
  // A YAML file is turned into JSON inside the parse worker, which fetches its YAML reader then.
  '/yaml-to-json': () => import('./formats/json/jsonModel').then((jsonModel) => jsonModel.parseJsonText('a: 1', 'en', 'yaml')),
  '/json-to-xml': () => import('./formats/json/jsonConvert'),
  '/json-to-typescript': loadJsonCodeWriter,
  '/json-to-python': loadJsonCodeWriter,
  '/json-to-go': loadJsonCodeWriter,
  '/json-to-java': loadJsonCodeWriter,
  '/json-to-csharp': loadJsonCodeWriter,
  '/word-to-markdown': () => Promise.all([import('./formats/word/wordDocument'), import('mammoth'), import('./formats/csv/csvExport')]),
  '/pptx-to-markdown': () => import('./formats/powerpoint/presentationText'),
  '/token-counter': () => Promise.all([import('./tools/pdf/PdfExtractTools'), import('mammoth'), import('./formats/powerpoint/presentationText'), import('./formats/conversion'), import('./formats/csv/csvExport')]),
}

// Once a page is idle it fetches the file page and the viewer its visitors are about to need (the page's own format, the result's
// format on a conversion page, CSV on the home page) or the page's tool, with the code its task fetches later (workers are started
// once), so a file then opens and the task runs with no network and no wait. Offline or after a new
// release the fetch fails; the file then fails to open with LoadFailedMessage, not here.
function preloadFileOpening(path: string) {
  // The page's bundled sample files ("Try a sample file"), so they also open offline.
  void preloadPageSamples(path).catch(() => {})
  const pageTaskCode = pageTaskCodeByPath[path]?.()
  // A tool page: its component, the result preview (which also lists ZIP results) and, for the tools that read PDFs, pdf.js with
  // its worker and the worker with pdf-lib (an empty task fetches it). The AI-ready pages count tokens.
  const toolPage = findLiveToolPage(path)
  if (toolPage?.loadComponent) {
    const preloads = [toolPage.loadComponent(), import('./tools/pdf/ToolResultPreview'), pageTaskCode]
    if (toolPage.category === 'pdf' || toolPage.inputFormats.includes('.pdf')) {
      preloads.push(import('./formats/pdf/pdfLibrary').then((pdfLibrary) => pdfLibrary.warmUpPdfWorker()))
      preloads.push(import('./tools/pdf/pdfTasks').then(({ runPdfTask }) => runPdfTask({ type: 'warm-up' })))
    }
    const aiHub = hubs.find((hub) => hub.category === 'ai')
    if (toolPage.group === 'aiReady' || (aiHub?.sharedTools?.aiReady ?? []).includes(toolPage.slug)) {
      preloads.push(import('./tools/ai/textStats').then((textStats) => textStats.countTokens('')))
    }
    return Promise.all(preloads)
  }
  const toolViewer = findViewerByToolPath(path)
  const officePackageReader = toolViewer && acceptsOfficePackages(toolViewer.extensions) ? import('fflate') : undefined
  // The Mask Data page keeps the file on the page: it needs its tool and the Excel writer, not a viewer.
  if (toolViewer?.tool === 'mask') {
    return Promise.all([import('./formats/mask/MaskWorkbench'), import('./formats/excel/excelStyles').then((stylesFile) => stylesFile.loadExcelJs())])
  }
  const viewerId = toolViewer?.convertTo ? viewerIdForConversion[toolViewer.convertTo] : (toolViewer?.id ?? (path === '/' ? 'csv' : undefined))
  const preloads = [loadFileViewPage(), formatDefinitions.find((definition) => definition.viewerId === viewerId)?.preloadViewer?.(), pageTaskCode, officePackageReader]
  if (toolViewer?.convertTo) preloads.push(import('./formats/conversion'))
  return Promise.all(preloads)
}

// A part of the app that throws while drawing (most often code that could not be fetched: offline, or the page is older than the
// latest release) shows a message with a reload button instead of a blank page.
class LoadFailedBoundary extends Component<{ children: ReactNode }, { hasFailed: boolean }> {
  state = { hasFailed: false }
  static getDerivedStateFromError() {
    return { hasFailed: true }
  }
  render() {
    return this.state.hasFailed ? <LoadFailedMessage /> : this.props.children
  }
}

function LoadFailedMessage() {
  const { t } = useT()
  return (
    <main id="main" className="toy-page mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      <p id="load-failed-message" role="alert" className="text-lg text-ink">
        {t('app.loadFailed')}
      </p>
      <button id="reload-page-button" type="button" onClick={() => window.location.reload()} className="btn btn--primary press">
        {t('app.reload')}
      </button>
    </main>
  )
}
const InfoPage = lazy(() => import('./pages/InfoPage'))
const HubPage = lazy(() => import('./pages/HubPage'))
const infoPageAddresses = ['/about', '/privacy', '/terms', '/guides', ...guideAddresses]

// What to show for the address in the browser. An address with no language gets one: the home page follows the browser's
// language, and an old link such as /csv-viewer goes to /en/csv-viewer, so links that existed before the Arabic version still
// work. Addresses that only exist for an open file (/en/view-pdf ...) go home, because the file lives in memory.
function resolveAddress(pathname: string) {
  const { locale, path } = splitLocalePath(pathname)
  if (isFileViewPath(path)) return localizePath(locale ?? getBrowserLocale(), '/')
  if (locale) return pathname
  return localizePath(path === '/' ? getBrowserLocale() : 'en', path)
}

// After moving to another page in the app, focus goes to its heading, so a screen reader announces the new page and Tab starts
// from there. Lazily loaded pages may take a few frames to appear.
function focusNewPageHeading(oldHeading = document.querySelector('h1'), framesLeft = 30) {
  requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>('h1')
    if (!heading || heading === oldHeading) {
      if (framesLeft > 0) focusNewPageHeading(oldHeading, framesLeft - 1)
      return
    }
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  })
}

// What a page needs before it is drawn: its language file and, on a tool page, that tool's words (fetched per page, src/seo.ts).
function loadAddressWords(address: string) {
  const { locale, path } = splitLocalePath(address)
  return Promise.all([loadLocale(locale ?? 'en'), loadToolPageWords(locale ?? 'en', path)])
}

// Shows the resolved address in the browser's address bar (replacing the entry, so Back never lands on the old address).
function showResolvedAddress() {
  const address = resolveAddress(window.location.pathname)
  if (address !== window.location.pathname) window.history.replaceState(window.history.state, '', address + window.location.search + window.location.hash)
  return address
}

// `initialPathname` is set by the build's server render (src/entry-server.tsx), where there is no browser address to read.
export default function App({ initialPathname }: { initialPathname?: string }) {
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null)
  const [discardRequest, setDiscardRequest] = useState<{ answer: (shouldDiscard: boolean) => void } | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [pathname, setPathname] = useState(() => initialPathname ?? showResolvedAddress())
  // The "what's new" banner is closed in React state only, so it comes back when the tab is reloaded. Do not persist this
  // (no cookies, localStorage, sessionStorage or IndexedDB) and do not send it anywhere: DECISIONS.md, "What's new".
  const [isBannerDismissed, setIsBannerDismissed] = useState(false)
  // A file another page asked to open here (the wrong-file redirect); React state only, never in the URL.
  const [handoffFile, setHandoffFile] = useState<File | null>(null)
  // A page's words could not be fetched (offline, or the site was updated): the reload message instead of a click that does nothing.
  const [hasPageLoadFailed, setHasPageLoadFailed] = useState(false)
  const { locale: addressLocale, path } = splitLocalePath(pathname)
  const locale: Locale = addressLocale ?? 'en'
  const toolPage = findLiveToolPage(path)
  const hasUnsavedEditsRef = useRef(false)
  const openedFilePathRef = useRef('/en')

  // Shows the "Discard your edits?" dialog and resolves with the visitor's choice.
  const confirmDiscardEdits = useCallback(
    () => new Promise<boolean>((resolve) => setDiscardRequest({ answer: resolve })),
    [],
  )

  function answerDiscardRequest(shouldDiscard: boolean) {
    discardRequest?.answer(shouldDiscard)
    setDiscardRequest(null)
  }

  const reportUnsavedEdits = useCallback((hasUnsavedEdits: boolean) => {
    hasUnsavedEditsRef.current = hasUnsavedEdits
  }, [])
  // An editing tool page: Back or Forward with unsaved edits returns to this same address while the dialog asks.
  const reportToolUnsavedEdits = useCallback((hasUnsavedEdits: boolean) => {
    hasUnsavedEditsRef.current = hasUnsavedEdits
    if (hasUnsavedEdits) openedFilePathRef.current = window.location.pathname
  }, [])

  // The file only lives in memory, so an address that exists only for an open file (/en/view-pdf ...) never shows without one: a
  // reload or Forward lands on home instead. A format's own address (/en/json-viewer ...) shows its page with the drop zone.
  useEffect(() => {
    // The page is drawn only once its words are there: a file opened from home sits at its viewer's address (/en/csv-viewer), so
    // closing it must not draw that tool page before its words have loaded (it would have none). `closesFile`: Back or Forward
    // left the file page, so the file goes in the same step as the address changes.
    function sendHomeIfOnFileViewPath(closesFile = false) {
      const address = showResolvedAddress()
      void loadAddressWords(address).then(() => {
        if (closesFile) setOpenedFile(null)
        setPathname(address)
      })
    }

    function handleBrowserNavigation() {
      if (hasUnsavedEditsRef.current) {
        // Back or Forward with unsaved edits: stay on the file page and ask first.
        window.history.pushState({ fromHomePage: true }, '', openedFilePathRef.current)
        confirmDiscardEdits().then((shouldDiscard) => {
          if (!shouldDiscard) return
          hasUnsavedEditsRef.current = false
          window.history.back()
        })
        return
      }
      sendHomeIfOnFileViewPath(true)
    }

    sendHomeIfOnFileViewPath()
    window.addEventListener('popstate', handleBrowserNavigation)
    return () => window.removeEventListener('popstate', handleBrowserNavigation)
  }, [confirmDiscardEdits])

  function openFile(file: File, fileContents: ArrayBuffer) {
    setOpenedFile({ file, contents: fileContents, openedFrom: path })
    setFileKey((currentKey) => currentKey + 1)
    openedFilePathRef.current = localizePath(locale, getFileViewPath(file.name))
    window.history.pushState({ fromHomePage: true }, '', openedFilePathRef.current)
    setPathname(openedFilePathRef.current)
  }

  // Another file on the same file page: no new history entry, but the address follows the new file's type. The new key gives
  // the page a fresh edit session and mode.
  function replaceFile(file: File, fileContents: ArrayBuffer) {
    setOpenedFile({ file, contents: fileContents, openedFrom: path })
    setFileKey((currentKey) => currentKey + 1)
    openedFilePathRef.current = localizePath(locale, getFileViewPath(file.name))
    window.history.replaceState(window.history.state, '', openedFilePathRef.current)
    setPathname(openedFilePathRef.current)
  }

  // Leaving a tool page with unsaved edits asks first; the same page in the other language keeps them, so it does not ask.
  async function navigateTo(newAddress: string) {
    const isSamePageInOtherLanguage = splitLocalePath(newAddress).path === path
    if (!openedFile && hasUnsavedEditsRef.current && !isSamePageInOtherLanguage) {
      if (!(await confirmDiscardEdits())) return
      hasUnsavedEditsRef.current = false
    }
    try {
      await loadAddressWords(newAddress)
    } catch {
      setHasPageLoadFailed(true)
      return
    }
    window.history.pushState(null, '', newAddress)
    setPathname(newAddress)
    window.scrollTo(0, 0)
    focusNewPageHeading()
  }

  // The same page in the other language. With a file open the entry is replaced (not added) so Back still closes the file and
  // the edits stay where they are; otherwise it is a normal visit.
  async function switchLanguage(newLocale: Locale) {
    const newAddress = localizePath(newLocale, path)
    try {
      await loadAddressWords(newAddress)
    } catch {
      setHasPageLoadFailed(true)
      return
    }
    if (openedFile) {
      window.history.replaceState(window.history.state, '', newAddress)
      openedFilePathRef.current = newAddress
      setPathname(newAddress)
    } else {
      navigateTo(newAddress)
    }
  }

  useEffect(() => {
    if (openedFile) return
    // Once fetched, the service worker keeps the page and what it loaded (src/pwa.ts), and the footer says it is available offline.
    const preloadTimer = window.setTimeout(() => {
      const wasControlledByServiceWorker = !('serviceWorker' in navigator) || Boolean(navigator.serviceWorker.controller)
      void preloadFileOpening(path)
        .then(keepPageForOffline)
        // On a first visit the workers started before the service worker took over and fetched their own imports past it (the
        // page cannot list those): started once more, they are cached too.
        .then(() => {
          if (!wasControlledByServiceWorker) return preloadFileOpening(path)
        })
        .catch(() => {})
    }, 1500)
    return () => window.clearTimeout(preloadTimer)
  }, [path, openedFile])

  // A file opened with the installed app from the desktop, or shared to it on Android (?shared=1), opens as if dropped on home,
  // which sends it to its viewer. The manifests start both on the home page (scripts/build-static-pages.mjs).
  useEffect(() => {
    function openFileFromOutside(file: File) {
      setOpenedFile(null)
      setHandoffFile(file)
    }
    takeLaunchedFiles(openFileFromOutside)
    if (!new URLSearchParams(window.location.search).has('shared')) return
    window.history.replaceState(window.history.state, '', window.location.pathname)
    // Only the installed app is a share target. Any website can post a form to /share, but that opens a normal browser tab, so
    // a file arriving there was not shared by the visitor: it is thrown away unopened.
    if (!window.matchMedia('(display-mode: standalone)').matches) {
      void caches.delete('shared-files')
      return
    }
    void takeSharedFile().then((sharedFile) => sharedFile && openFileFromOutside(sharedFile))
  }, [])

  // The page language follows the address (/ar/... is right-to-left Arabic).
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  // Hands a file to another format's page. Leaving a page with unsaved edits asks first, as everywhere else.
  async function openInViewer(file: File, toolPath: string) {
    await navigateTo(toolPath)
    setHandoffFile(file)
  }

  // The open file handed to a tool page (the image viewer's Compress, Resize ...): the file page closes and the tool gets the file.
  // The file closes only after navigating: closed first, App would draw the page under it, whose words may never have loaded.
  async function openFileInTool(file: File, toolPath: string) {
    hasUnsavedEditsRef.current = false
    await navigateTo(toolPath)
    setOpenedFile(null)
    setHandoffFile(file)
  }

  function closeFile() {
    hasUnsavedEditsRef.current = false
    if (window.history.state?.fromHomePage) {
      window.history.back()
    } else {
      const homeAddress = localizePath(locale, '/')
      window.history.replaceState(null, '', homeAddress)
      setPathname(homeAddress)
      setOpenedFile(null)
    }
  }

  return (
    <LocaleContext.Provider value={locale}>
      <SwitchLanguageContext.Provider value={switchLanguage}>
        <PagePathContext.Provider value={path}>
          <ToastProvider>
            <LoadFailedBoundary key={openedFile ? `file-${fileKey}` : 'page'}>
              {hasPageLoadFailed ? (
                <LoadFailedMessage />
              ) : openedFile ? (
                <Suspense fallback={null}>
                  <FileViewPage
                    key={fileKey}
                    openedFile={openedFile}
                    onClose={closeFile}
                    onReplaceFile={replaceFile}
                    confirmDiscardEdits={confirmDiscardEdits}
                    onUnsavedEditsChange={reportUnsavedEdits}
                    onOpenInTool={(file, toolPath) => void openFileInTool(file, toolPath)}
                  />
                </Suspense>
              ) : path === '/changelog' ? (
                <Suspense fallback={null}>
                  <ChangelogPage onNavigate={navigateTo} />
                </Suspense>
              ) : toolPage ? (
                <ToolPage
                  key={toolPage.slug}
                  tool={toolPage}
                  onFileLoaded={openFile}
                  onNavigate={navigateTo}
                  handoffFile={handoffFile}
                  onHandoffConsumed={() => setHandoffFile(null)}
                  onOpenInViewer={openInViewer}
                  onUnsavedEditsChange={reportToolUnsavedEdits}
                  confirmDiscardEdits={confirmDiscardEdits}
                />
              ) : findLiveHub(path) || path === ALL_TOOLS_PATH ? (
                <Suspense fallback={null}>
                  <HubPage key={path} hub={findLiveHub(path)} onNavigate={navigateTo} />
                </Suspense>
              ) : infoPageAddresses.includes(path) ? (
                <Suspense fallback={null}>
                  <InfoPage address={path} onNavigate={navigateTo} />
                </Suspense>
              ) : (
                <HomePage
                  onFileLoaded={openFile}
                  onNavigate={navigateTo}
                  isBannerDismissed={isBannerDismissed}
                  onDismissBanner={() => setIsBannerDismissed(true)}
                  handoffFile={handoffFile}
                  onHandoffConsumed={() => setHandoffFile(null)}
                  onOpenInViewer={openInViewer}
                />
              )}
            </LoadFailedBoundary>
            {discardRequest && (
              <DiscardEditsDialog onKeepEditing={() => answerDiscardRequest(false)} onDiscard={() => answerDiscardRequest(true)} />
            )}
          </ToastProvider>
        </PagePathContext.Provider>
      </SwitchLanguageContext.Provider>
    </LocaleContext.Provider>
  )
}
