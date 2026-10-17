import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import DiscardEditsDialog from './components/DiscardEditsDialog'
import { LocaleContext, PagePathContext, SwitchLanguageContext, getBrowserLocale, getLocaleFromPath, loadLocale, localizePath, splitLocalePath } from './i18n'
import type { Locale } from './i18n'
import { ToastProvider } from './components/Messages'
import FileViewPage from './pages/FileViewPage'
import HomePage from './pages/HomePage'
import type { OpenedFile } from './useFileIntake'
import { findViewerByToolPath, getFileViewPath, isFileViewPath } from './viewers'

const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const InfoPage = lazy(() => import('./pages/InfoPage'))
const infoPageAddresses = ['/about', '/privacy', '/terms']

// What to show for the address in the browser. An address with no language gets one: the home page follows the browser's
// language, and an old link such as /csv-viewer goes to /en/csv-viewer, so links that existed before the Arabic version still
// work. Addresses that only exist for an open file (/en/view-pdf ...) go home, because the file lives in memory.
function resolveAddress(pathname: string) {
  const { locale, path } = splitLocalePath(pathname)
  if (isFileViewPath(path)) return localizePath(locale ?? getBrowserLocale(), '/')
  if (locale) return pathname
  return localizePath(path === '/' ? getBrowserLocale() : 'en', path)
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
      void loadLocale(getLocaleFromPath(address)).then(() => setPathname(address))
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
    setOpenedFile({ file, contents: fileContents })
    setFileKey((currentKey) => currentKey + 1)
    openedFilePathRef.current = localizePath(locale, getFileViewPath(file.name))
    window.history.pushState({ fromHomePage: true }, '', openedFilePathRef.current)
    setPathname(openedFilePathRef.current)
  }

  // Another file on the same file page: no new history entry, but the address follows the new file's type. The new key gives
  // the page a fresh edit session and mode.
  function replaceFile(file: File, fileContents: ArrayBuffer) {
    setOpenedFile({ file, contents: fileContents })
    setFileKey((currentKey) => currentKey + 1)
    openedFilePathRef.current = localizePath(locale, getFileViewPath(file.name))
    window.history.replaceState(window.history.state, '', openedFilePathRef.current)
    setPathname(openedFilePathRef.current)
  }

  function navigateTo(path: string) {
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo(0, 0)
  }

  // The same page in the other language. With a file open the entry is replaced (not added) so Back still closes the file and
  // the edits stay where they are; otherwise it is a normal visit.
  async function switchLanguage(newLocale: Locale) {
    await loadLocale(newLocale)
    const newAddress = localizePath(newLocale, path)
    if (openedFile) {
      window.history.replaceState(window.history.state, '', newAddress)
      openedFilePathRef.current = newAddress
      setPathname(newAddress)
    } else {
      navigateTo(newAddress)
    }
  }

  // The page language follows the address (/ar/... is right-to-left Arabic).
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  // Hands a file to another format's page. Leaving a page with unsaved edits asks first, as everywhere else.
  async function openInViewer(file: File, toolPath: string) {
    if (hasUnsavedEditsRef.current && !(await confirmDiscardEdits())) return
    navigateTo(toolPath)
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
            {openedFile ? (
              <FileViewPage
                key={fileKey}
                openedFile={openedFile}
                onClose={closeFile}
                onReplaceFile={replaceFile}
                confirmDiscardEdits={confirmDiscardEdits}
                onUnsavedEditsChange={reportUnsavedEdits}
              />
            ) : path === '/changelog' ? (
              <Suspense fallback={null}>
                <ChangelogPage onNavigate={navigateTo} />
              </Suspense>
            ) : infoPageAddresses.includes(path) ? (
              <Suspense fallback={null}>
                <InfoPage address={path} onNavigate={navigateTo} />
              </Suspense>
            ) : (
              <HomePage
                onFileLoaded={openFile}
                onNavigate={navigateTo}
                toolViewer={findViewerByToolPath(path)}
                isBannerDismissed={isBannerDismissed}
                onDismissBanner={() => setIsBannerDismissed(true)}
                handoffFile={handoffFile}
                onHandoffConsumed={() => setHandoffFile(null)}
                onOpenInViewer={openInViewer}
              />
            )}
            {discardRequest && (
              <DiscardEditsDialog onKeepEditing={() => answerDiscardRequest(false)} onDiscard={() => answerDiscardRequest(true)} />
            )}
          </ToastProvider>
        </PagePathContext.Provider>
      </SwitchLanguageContext.Provider>
    </LocaleContext.Provider>
  )
}
