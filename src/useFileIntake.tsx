import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'

const LARGE_FILE_WARNING_BYTES = 50 * 1024 * 1024

export type OpenedFile = {
  file: File
  contents: ArrayBuffer
}

type FileIntakeOptions = {
  acceptedExtensions: string[]
  onFileLoaded: (file: File, fileContents: ArrayBuffer) => void
}

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
export function useFileIntake({ acceptedExtensions, onFileLoaded }: FileIntakeOptions) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const acceptsPastedText = acceptedExtensions.includes('.csv')

  function hasAcceptedExtension(fileName: string) {
    const lowerCaseFileName = fileName.toLowerCase()
    return acceptedExtensions.some((extension) => lowerCaseFileName.endsWith(extension))
  }

  async function loadFile(file: File) {
    setErrorMessage(null)
    setLargeFileWarning(null)

    if (!hasAcceptedExtension(file.name)) {
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
  }
}
