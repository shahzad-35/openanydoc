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
import { ALL_TOOLS_PATH, findLiveHub, findLiveToolPage } from './tools/registry'
import { loadToolPageWords } from './seo'

const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
// The file page (viewers, editing, menus) is its own chunk, so content pages load only what they show.
const loadFileViewPage = () => import('./pages/FileViewPage')
const FileViewPage = lazy(loadFileViewPage)
const viewerIdForConversion: Record<ConversionTarget, Viewer['id']> = { csv: 'csv', xlsx: 'excel', json: 'json' }

// Once a page is idle it fetches the file page and the viewer its visitors are about to need (the page's own format, the result's
// format on a conversion page, CSV on the home page), so a file then opens with no network and no wait.
function preloadFileOpening(path: string) {
  // The page's bundled sample files ("Try a sample file"), so they also open offline.
  void preloadPageSamples(path).catch(() => {})
  // A tool page: its component and, for the PDF tools, the worker with pdf-lib (an empty task fetches it).
  const toolPage = findLiveToolPage(path)
  if (toolPage?.loadComponent) {
    const preloads: Promise<unknown>[] = [toolPage.loadComponent?.() ?? Promise.resolve()]
    if (toolPage.category === 'pdf') preloads.push(import('./tools/pdf/pdfTasks').then(({ runPdfTask }) => runPdfTask({ type: 'warm-up' })))
    void Promise.all(preloads).catch(() => {})
    return
  }
  const toolViewer = findViewerByToolPath(path)
  // The Mask Data page keeps the file on the page: it needs its tool and the Excel writer, not a viewer.
  if (toolViewer?.tool === 'mask') {
    void Promise.all([import('./formats/mask/MaskWorkbench'), import('./formats/excel/excelStyles').then((stylesFile) => stylesFile.loadExcelJs())]).catch(() => {})
    return
  }
  const viewerId = toolViewer?.convertTo ? viewerIdForConversion[toolViewer.convertTo] : (toolViewer?.id ?? (path === '/' ? 'csv' : undefined))
  const preloads = [loadFileViewPage(), formatDefinitions.find((definition) => definition.viewerId === viewerId)?.preloadViewer?.()]
  if (toolViewer?.convertTo) preloads.push(import('./formats/conversion'))
  // Offline or after a new release the fetch fails; the file then fails to open with LoadFailedMessage, not here.
  void Promise.all(preloads).catch(() => {})
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

  // The file only lives in memory, so an address that exists only for an open file (/en/view-pdf ...) never shows without one: a
  // reload or Forward lands on home instead. A format's own address (/en/json-viewer ...) shows its page with the drop zone.
  useEffect(() => {
    function sendHomeIfOnFileViewPath() {
      const address = showResolvedAddress()
      void loadAddressWords(address).then(() => setPathname(address))
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
      setOpenedFile(null)
      sendHomeIfOnFileViewPath()
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

  async function navigateTo(path: string) {
    await loadAddressWords(path)
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo(0, 0)
  }

  // The same page in the other language. With a file open the entry is replaced (not added) so Back still closes the file and
  // the edits stay where they are; otherwise it is a normal visit.
  async function switchLanguage(newLocale: Locale) {
    const newAddress = localizePath(newLocale, path)
    await loadAddressWords(newAddress)
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
    const preloadTimer = window.setTimeout(() => preloadFileOpening(path), 1500)
    return () => window.clearTimeout(preloadTimer)
  }, [path, openedFile])

  // The page language follows the address (/ar/... is right-to-left Arabic).
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  // Hands a file to another format's page. Leaving a page with unsaved edits asks first, as everywhere else.
  async function openInViewer(file: File, toolPath: string) {
    if (hasUnsavedEditsRef.current && !(await confirmDiscardEdits())) return
    await navigateTo(toolPath)
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
              {openedFile ? (
                <Suspense fallback={null}>
                  <FileViewPage
                    key={fileKey}
                    openedFile={openedFile}
                    onClose={closeFile}
                    onReplaceFile={replaceFile}
                    confirmDiscardEdits={confirmDiscardEdits}
                    onUnsavedEditsChange={reportUnsavedEdits}
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
