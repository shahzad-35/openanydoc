import { useCallback, useEffect, useRef, useState } from 'react'
import DiscardEditsDialog from './components/DiscardEditsDialog'
import FileViewPage from './pages/FileViewPage'
import HomePage from './pages/HomePage'
import type { OpenedFile } from './useFileIntake'

const FILE_VIEW_PATH = '/view'

export default function App() {
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null)
  const [discardRequest, setDiscardRequest] = useState<{ answer: (shouldDiscard: boolean) => void } | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const hasUnsavedEditsRef = useRef(false)

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

  // The file only lives in memory, so /view never shows without one: a reload or Forward lands on home instead.
  useEffect(() => {
    function sendHomeIfOnFileViewPath() {
      if (window.location.pathname === FILE_VIEW_PATH) window.history.replaceState(null, '', '/')
    }

    function handleBrowserNavigation() {
      if (hasUnsavedEditsRef.current) {
        // Back or Forward with unsaved edits: stay on the file page and ask first.
        window.history.pushState({ fromHomePage: true }, '', FILE_VIEW_PATH)
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
    window.history.pushState({ fromHomePage: true }, '', FILE_VIEW_PATH)
  }

  // Another file on the same file page: no new history entry. The new key gives the page a fresh edit session and mode.
  function replaceFile(file: File, fileContents: ArrayBuffer) {
    setOpenedFile({ file, contents: fileContents })
    setFileKey((currentKey) => currentKey + 1)
  }

  function closeFile() {
    hasUnsavedEditsRef.current = false
    if (window.history.state?.fromHomePage) {
      window.history.back()
    } else {
      window.history.replaceState(null, '', '/')
      setOpenedFile(null)
    }
  }

  return (
    <>
      {openedFile ? (
        <FileViewPage
          key={fileKey}
          openedFile={openedFile}
          onClose={closeFile}
          onReplaceFile={replaceFile}
          confirmDiscardEdits={confirmDiscardEdits}
          onUnsavedEditsChange={reportUnsavedEdits}
        />
      ) : (
        <HomePage onFileLoaded={openFile} />
      )}
      {discardRequest && (
        <DiscardEditsDialog onKeepEditing={() => answerDiscardRequest(false)} onDiscard={() => answerDiscardRequest(true)} />
      )}
    </>
  )
}
