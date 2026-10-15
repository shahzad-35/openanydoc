import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import DiscardEditsDialog from './components/DiscardEditsDialog'
import { LocaleContext, getLocaleFromPath } from './i18n'
import FileViewPage from './pages/FileViewPage'
import HomePage from './pages/HomePage'
import type { OpenedFile } from './useFileIntake'
import { findViewerByToolPath, getFileViewPath, isFileViewPath } from './viewers'

const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))

const isChangelogPath = (pathname: string) => /^\/(en|ar)\/changelog\/?$/.test(pathname)

export default function App() {
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null)
  const [discardRequest, setDiscardRequest] = useState<{ answer: (shouldDiscard: boolean) => void } | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [pathname, setPathname] = useState(window.location.pathname)
  // The "what's new" banner is closed in React state only, so it comes back when the tab is reloaded. Do not persist this
  // (no cookies, localStorage, sessionStorage or IndexedDB) and do not send it anywhere: DECISIONS.md, "What's new".
  const [isBannerDismissed, setIsBannerDismissed] = useState(false)
  // A file another page asked to open here (the wrong-file redirect); React state only, never in the URL.
  const [handoffFile, setHandoffFile] = useState<File | null>(null)
  const locale = getLocaleFromPath(pathname)
  const hasUnsavedEditsRef = useRef(false)
  const openedFilePathRef = useRef('/')

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

  // The file only lives in memory, so an address that exists only for an open file (/view-pdf ...) never shows without one: a
  // reload or Forward lands on home instead. A format's own address (/json-viewer ...) shows its page with the drop zone.
  useEffect(() => {
    function sendHomeIfOnFileViewPath() {
      if (isFileViewPath(window.location.pathname)) window.history.replaceState(null, '', '/')
      setPathname(window.location.pathname)
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
    openedFilePathRef.current = getFileViewPath(file.name)
    window.history.pushState({ fromHomePage: true }, '', openedFilePathRef.current)
    setPathname(openedFilePathRef.current)
  }

  // Another file on the same file page: no new history entry, but the address follows the new file's type. The new key gives
  // the page a fresh edit session and mode.
  function replaceFile(file: File, fileContents: ArrayBuffer) {
    setOpenedFile({ file, contents: fileContents })
    setFileKey((currentKey) => currentKey + 1)
    openedFilePathRef.current = getFileViewPath(file.name)
    window.history.replaceState(window.history.state, '', openedFilePathRef.current)
    setPathname(openedFilePathRef.current)
  }

  function navigateTo(path: string) {
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo(0, 0)
  }

  // The page language follows the address (/ar/changelog is right-to-left Arabic).
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
      window.history.replaceState(null, '', '/')
      setPathname('/')
      setOpenedFile(null)
    }
  }

  return (
    <LocaleContext.Provider value={locale}>
      {openedFile ? (
        <FileViewPage
          key={fileKey}
          openedFile={openedFile}
          onClose={closeFile}
          onReplaceFile={replaceFile}
          confirmDiscardEdits={confirmDiscardEdits}
          onUnsavedEditsChange={reportUnsavedEdits}
        />
      ) : isChangelogPath(pathname) ? (
        <Suspense fallback={null}>
          <ChangelogPage onNavigate={navigateTo} />
        </Suspense>
      ) : (
        <HomePage
          onFileLoaded={openFile}
          onNavigate={navigateTo}
          toolViewer={findViewerByToolPath(pathname)}
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
    </LocaleContext.Provider>
  )
}
