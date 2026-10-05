import { useEffect, useRef, useState } from 'react'

const LARGE_FILE_WARNING_BYTES = 50 * 1024 * 1024

const buttonClassName =
  'min-h-11 min-w-11 cursor-pointer rounded-lg border border-ink-soft px-4 text-sm font-medium text-ink transition duration-200 hover:bg-paper-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

type FileDropZoneProps = {
  acceptedExtensions: string[]
  acceptsPastedText?: boolean
  onFileLoaded?: (file: File, fileContents: ArrayBuffer) => void
  onClear?: () => void
}

function formatFileSize(byteCount: number) {
  if (byteCount < 1024) return `${byteCount} B`
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileDropZone({
  acceptedExtensions,
  acceptsPastedText = false,
  onFileLoaded,
  onClear,
}: FileDropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const acceptedExtensionsText = acceptedExtensions.join(' or ')

  function hasAcceptedExtension(fileName: string) {
    const lowerCaseFileName = fileName.toLowerCase()
    return acceptedExtensions.some((extension) => lowerCaseFileName.endsWith(extension))
  }

  async function loadFile(file: File) {
    setErrorMessage(null)
    setLargeFileWarning(null)

    if (!hasAcceptedExtension(file.name)) {
      setErrorMessage(`${file.name} can't be opened here. This viewer accepts ${acceptedExtensionsText} files.`)
      return
    }

    if (file.size > LARGE_FILE_WARNING_BYTES) {
      setLargeFileWarning(
        `This file is ${formatFileSize(file.size)}. Large files can be slow or run out of memory, but we'll still try to open it.`,
      )
    }

    setIsReading(true)
    try {
      const fileContents = await file.arrayBuffer()
      setSelectedFile(file)
      onFileLoaded?.(file, fileContents)
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

  function clearFile() {
    setSelectedFile(null)
    setErrorMessage(null)
    setLargeFileWarning(null)
    onClear?.()
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

  return (
    <div>
      {selectedFile ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-ink-soft p-6">
          <p>
            <span className="block break-all font-medium">{selectedFile.name}</span>
            <span className="text-ink-soft">{formatFileSize(selectedFile.size)}</span>
          </p>
          <button type="button" onClick={clearFile} className={buttonClassName}>
            Clear / open another file
          </button>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setIsDraggingOver(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDraggingOver(false)
            openChosenFiles(Array.from(event.dataTransfer.files))
          }}
          className={`rounded-lg border border-dashed p-8 transition-colors duration-200 sm:p-12 ${
            isDraggingOver ? 'border-accent bg-paper-raised' : 'border-ink-soft'
          }`}
        >
          <p className="max-w-[45ch] text-lg leading-relaxed">
            Drop a {acceptedExtensionsText} file here, or choose one from your device.
          </p>
          {acceptsPastedText && (
            <p className="mt-2 text-ink-soft">You can also paste CSV text with Ctrl+V (⌘+V on a Mac).</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedExtensions.join(',')}
            aria-label={`Choose a ${acceptedExtensionsText} file`}
            className="hidden"
            onChange={(event) => {
              openChosenFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={isReading}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-6 ${buttonClassName}`}
          >
            Choose a file
          </button>
        </div>
      )}

      <div aria-live="polite" className="mt-4 space-y-2">
        {isReading && <p className="text-ink-soft">Reading file</p>}
        {largeFileWarning && <p>{largeFileWarning}</p>}
        {errorMessage && <p className="font-medium text-accent">{errorMessage}</p>}
      </div>
    </div>
  )
}
