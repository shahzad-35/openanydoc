import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { findViewerForFileName } from './viewers'
import type { Viewer } from './viewers'
import { findReleasedFormat } from './whatsNew'

const LARGE_FILE_WARNING_BYTES = 50 * 1024 * 1024

export type OpenedFile = {
  file: File
  contents: ArrayBuffer
}

type FileIntakeOptions = {
  acceptedExtensions: string[]
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
  // Pasting CSV text opens it as a file. Off where pasting must stay a normal paste, e.g. on the file page.
  allowPaste?: boolean
  // A file another page handed over (the "Open it in the ... viewer" button): it is opened once, through the same checks as a
  // dropped file, and `onHandoffConsumed` then tells the owner to forget it. It is kept in React state only.
  handoffFile?: File | null
  onHandoffConsumed?: () => void
}

// A file whose type another viewer opens: shown as an offer to open it there instead of as an error.
export type RedirectSuggestion = { viewer: Viewer; file: File }

export function formatFileSize(byteCount: number) {
  if (byteCount < 1024) return `${byteCount} B`
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`
}

export function getLargeFileWarning(file: File) {
  if (file.size <= LARGE_FILE_WARNING_BYTES) return null
  return `This file is ${formatFileSize(file.size)}. Large files can be slow or run out of memory, but we'll still try to open it.`
}

// Everything a drop zone needs, with no markup of its own, so each layout can build its own UI.
export function useFileIntake({ acceptedExtensions, onFileLoaded, allowPaste = true, handoffFile = null, onHandoffConsumed }: FileIntakeOptions) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [redirectSuggestion, setRedirectSuggestion] = useState<RedirectSuggestion | null>(null)
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const acceptsPastedText = allowPaste && acceptedExtensions.includes('.csv')

  function hasAcceptedExtension(fileName: string) {
    const lowerCaseFileName = fileName.toLowerCase()
    return acceptedExtensions.some((extension) => lowerCaseFileName.endsWith(extension))
  }

  async function loadFile(file: File) {
    setErrorMessage(null)
    setRedirectSuggestion(null)
    setLargeFileWarning(null)

    if (!hasAcceptedExtension(file.name)) {
      // The file is not read here: another viewer may open it, and the button hands the same File over.
      const otherViewer = findViewerForFileName(file.name)
      const releasedFormat = otherViewer && findReleasedFormat(otherViewer.id)
      if (releasedFormat) {
        setRedirectSuggestion({ viewer: releasedFormat.viewer, file })
        return
      }
      setErrorMessage(`${file.name} can't be opened here. OpenAnyDoc opens ${acceptedExtensions.join(', ')} files.`)
      return
    }

    setLargeFileWarning(getLargeFileWarning(file))
    setIsReading(true)
    try {
      const fileContents = await file.arrayBuffer()
      setLargeFileWarning(null)
      onFileLoaded(file, fileContents)
    } catch {
      setErrorMessage("Couldn't read this file. It may be too large for your browser's memory.")
    } finally {
      setIsReading(false)
    }
  }

  function openChosenFiles(files: File[]) {
    if (files.length === 0) return
    if (files.length > 1) {
      setErrorMessage('Open one file at a time.')
      return
    }
    loadFile(files[0])
  }

  // Opens the file another page handed over, once (a second run of this effect in development would open it twice).
  const handledHandoffRef = useRef<File | null>(null)
  useEffect(() => {
    if (!handoffFile || handledHandoffRef.current === handoffFile) return
    handledHandoffRef.current = handoffFile
    onHandoffConsumed?.()
    void loadFile(handoffFile)
    // loadFile and onHandoffConsumed are new functions on every render; the file itself is what starts this.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffFile])

  // Re-subscribes on every render so the handler always sees the current props.
  useEffect(() => {
    if (!acceptsPastedText) return

    function handlePaste(event: ClipboardEvent) {
      const pastedFiles = Array.from(event.clipboardData?.files ?? [])
      const pastedText = event.clipboardData?.getData('text/plain') ?? ''
      if (pastedFiles.length > 0) {
        openChosenFiles(pastedFiles)
      } else if (pastedText.trim() !== '') {
        loadFile(new File([pastedText], 'pasted.csv', { type: 'text/csv' }))
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  })

  const dropTargetProps = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      setIsDraggingOver(true)
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingOver(false)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      setIsDraggingOver(false)
      openChosenFiles(Array.from(event.dataTransfer.files))
    },
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={acceptedExtensions.join(',')}
      aria-label={`Choose a file: ${acceptedExtensions.join(', ')}`}
      className="hidden"
      onChange={(event) => {
        openChosenFiles(Array.from(event.target.files ?? []))
        event.target.value = ''
      }}
    />
  )

  const promptText = isReading ? 'Reading file' : isDraggingOver ? 'Release to open' : 'Drop a file here'

  return {
    acceptsPastedText,
    dropTargetProps,
    errorMessage,
    fileInput,
    isDraggingOver,
    isReading,
    largeFileWarning,
    openFilePicker: () => fileInputRef.current?.click(),
    promptText,
    redirectSuggestion,
  }
}
