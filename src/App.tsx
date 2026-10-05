import { useEffect, useState } from 'react'
import FileViewPage from './pages/FileViewPage'
import HomePage from './pages/HomePage'
import type { OpenedFile } from './useFileIntake'

const FILE_VIEW_PATH = '/view'

export default function App() {
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null)

  // The file only lives in memory, so /view never shows without one: a reload or Forward lands on home instead.
  useEffect(() => {
    function sendHomeIfOnFileViewPath() {
      if (window.location.pathname === FILE_VIEW_PATH) window.history.replaceState(null, '', '/')
    }

    function handleBrowserNavigation() {
      setOpenedFile(null)
      sendHomeIfOnFileViewPath()
    }

    sendHomeIfOnFileViewPath()
    window.addEventListener('popstate', handleBrowserNavigation)
    return () => window.removeEventListener('popstate', handleBrowserNavigation)
  }, [])

  function openFile(file: File, fileContents: ArrayBuffer) {
    setOpenedFile({ file, contents: fileContents })
    window.history.pushState({ fromHomePage: true }, '', FILE_VIEW_PATH)
  }

  function closeFile() {
    if (window.history.state?.fromHomePage) {
      window.history.back()
    } else {
      window.history.replaceState(null, '', '/')
      setOpenedFile(null)
    }
  }

  return openedFile ? <FileViewPage openedFile={openedFile} onClose={closeFile} /> : <HomePage onFileLoaded={openFile} />
}
