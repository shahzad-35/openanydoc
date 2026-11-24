import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { isolateLeftToRight, translate, useT } from './i18n'
import type { Locale } from './i18n'
import { findFormatForFileName } from './formats/registry'
import { findViewerForFileName } from './viewers'
import type { Viewer } from './viewers'
import { findReleasedFormat, getFormatCapabilities, getReleasedFormats } from './whatsNew'

// The file chooser lists each extension's media types as well: iOS Safari and Android Chrome match files by type, and leave
// some greyed out when given only an extension they cannot map (.tsv, .json on older iOS). Android labels CSV either way.
// Word, Excel, PowerPoint and OpenDocument files are ZIP packages. A small one can unpack to gigabytes (a "zip bomb") and run the
// tab out of memory, so the sizes its file list declares are added up first; nothing is unpacked for this.
const OFFICE_PACKAGE_EXTENSION = /\.(docx|dotx|docm|xlsx|xlsm|pptx|ppsx|potx|pptm|odt|ods)$/i
const MAX_UNPACKED_OFFICE_BYTES = 1024 ** 3
async function unpackedSizeOf(fileContents: ArrayBuffer) {
  const { unzipSync } = await import('fflate')
  let total = 0
  try {
    unzipSync(new Uint8Array(fileContents), { filter: (entry) => ((total += entry.originalSize), false) })
  } catch {
    // Not a readable ZIP: the viewer reports that itself.
  }
  return total
}

const PICKER_MIME_TYPES: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.avif': ['image/avif'],
  '.gif': ['image/gif'],
  '.bmp': ['image/bmp'],
  '.heic': ['image/heic'],
  '.heif': ['image/heif'],
  '.tif': ['image/tiff'],
  '.tiff': ['image/tiff'],
  '.svg': ['image/svg+xml'],
  '.mp4': ['video/mp4'],
  '.m4v': ['video/x-m4v', 'video/mp4'],
  '.mov': ['video/quicktime'],
  '.webm': ['video/webm'],
  '.mkv': ['video/x-matroska'],
  '.avi': ['video/x-msvideo'],
  '.ogv': ['video/ogg'],
  '.3gp': ['video/3gpp'],
  '.mp3': ['audio/mpeg'],
  '.m4a': ['audio/mp4'],
  '.wav': ['audio/wav'],
  '.ogg': ['audio/ogg'],
  '.aac': ['audio/aac'],
  '.csv': ['text/csv', 'text/comma-separated-values'],
  '.tsv': ['text/tab-separated-values'],
  '.txt': ['text/plain'],
  '.json': ['application/json'],
  '.jsonl': ['application/x-ndjson', 'application/jsonl'],
  '.ndjson': ['application/x-ndjson'],
  '.json5': ['application/json5'],
  '.geojson': ['application/geo+json'],
  '.yaml': ['application/yaml', 'text/yaml'],
  '.yml': ['application/yaml', 'text/yaml'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsm': ['application/vnd.ms-excel.sheet.macroEnabled.12'],
  '.ods': ['application/vnd.oasis.opendocument.spreadsheet'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pdf': ['application/pdf'],
  '.parquet': ['application/vnd.apache.parquet'],
}

export const LARGE_FILE_WARNING_BYTES = 50 * 1024 * 1024

// `openedFrom`: the page the file was opened on, without its language ('/json-validator'); a landing page opens its viewer in its own mode.
export type OpenedFile = {
  file: File
  contents: ArrayBuffer
  openedFrom?: string
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
  // A tool page (src/pages/ToolPage.tsx): takes several files at once (each goes to onFileLoaded), and takes its formats even when
  // no viewer opens them yet (JPG to PDF takes pictures, which no viewer opens).
  allowsSeveralFiles?: boolean
  acceptsComingSoonFormats?: boolean
}

// A file whose type another viewer opens: shown as an offer to open it there instead of as an error.
export type RedirectSuggestion = { viewer: Viewer; file: File }

export function formatFileSize(byteCount: number) {
  if (byteCount < 1024) return `${byteCount} B`
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`
}

export function getLargeFileWarning(file: File, locale: Locale) {
  if (file.size <= LARGE_FILE_WARNING_BYTES) return null
  return translate(locale, 'intake.largeFile', { size: isolateLeftToRight(formatFileSize(file.size)) })
}

// Everything a drop zone needs, with no markup of its own, so each layout can build its own UI.
export function useFileIntake({ acceptedExtensions, onFileLoaded, allowPaste = true, handoffFile = null, onHandoffConsumed, allowsSeveralFiles = false, acceptsComingSoonFormats = false }: FileIntakeOptions) {
  const { locale, t } = useT()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // The grey line under an error toast, for the rejection that can say what to do instead.
  // Counts every file the visitor tries, so the same rejection twice in a row is a new event (a toast shows again).
  const [attemptCount, setAttemptCount] = useState(0)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [redirectSuggestion, setRedirectSuggestion] = useState<RedirectSuggestion | null>(null)
  const [comingSoonViewer, setComingSoonViewer] = useState<Viewer | null>(null)
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const acceptsPastedJson = acceptedExtensions.includes('.json')
  // YAML, XML, HTML and SQL pages (YAML to JSON, XML to CSV, HTML table to CSV, SQL to CSV ...) take pasted text as their own format.
  const pastedMarkupExtension = acceptedExtensions.find((extension) => ['.yaml', '.yml', '.xml', '.html', '.htm', '.sql'].includes(extension))
  const acceptsPastedText = allowPaste && (acceptedExtensions.includes('.csv') || acceptsPastedJson || pastedMarkupExtension !== undefined)

  function hasAcceptedExtension(fileName: string) {
    const lowerCaseFileName = fileName.toLowerCase()
    return acceptedExtensions.some((extension) => lowerCaseFileName.endsWith(extension))
  }

  async function loadFile(file: File) {
    setAttemptCount((count) => count + 1)
    setErrorMessage(null)
    setErrorDetail(null)
    setRedirectSuggestion(null)
    setComingSoonViewer(null)
    setLargeFileWarning(null)

    // A registered format whose viewer is not built yet (PDF): say so instead of opening a page or an error.
    const droppedViewer = findViewerForFileName(file.name)
    if (droppedViewer && getFormatCapabilities(droppedViewer.id)?.isComingSoon && !acceptsComingSoonFormats) {
      setComingSoonViewer(droppedViewer)
      return
    }

    // Old binary Word and PowerPoint files cannot be read in the browser; say how to get a .docx or .pptx instead of the generic "cannot open".
    if (file.name.toLowerCase().endsWith('.doc')) {
      setErrorMessage(t('intake.legacyWord'))
      setErrorDetail(t('intake.legacyWordDetail'))
      return
    }
    if (file.name.toLowerCase().endsWith('.ppt')) {
      setErrorMessage(t('intake.legacyPowerPoint'))
      setErrorDetail(t('intake.legacyPowerPointDetail'))
      return
    }

    const maxFileBytes = findFormatForFileName(file.name)?.maxFileBytes
    if (maxFileBytes !== undefined && file.size > maxFileBytes) {
      setErrorMessage(t('intake.tooLarge', { size: isolateLeftToRight(formatFileSize(file.size)) }))
      setErrorDetail(t('intake.tooLargeDetail', { format: droppedViewer?.label ?? '', limit: isolateLeftToRight(`${maxFileBytes / (1024 * 1024)} MB`) }))
      return
    }

    if (!hasAcceptedExtension(file.name)) {
      // The file is not read here: another viewer may open it, and the button hands the same File over.
      const otherViewer = findViewerForFileName(file.name)
      const releasedFormat = otherViewer && findReleasedFormat(otherViewer.id)
      if (releasedFormat) {
        setRedirectSuggestion({ viewer: releasedFormat.viewer, file })
        return
      }
      setErrorMessage(t('intake.cannotOpen'))
      // A page that takes every format (home) names them all; a viewer or tool page names only the files it takes.
      const isEveryFormatAccepted = [...releasedExtensions].every((extension) => acceptedExtensions.includes(extension))
      setErrorDetail(isEveryFormatAccepted ? t('intake.tryThese') : t('intake.pageTakes', { extensions: isolateLeftToRight(choosableExtensions.join(', ')) }))
      return
    }

    setLargeFileWarning(getLargeFileWarning(file, locale))
    setIsReading(true)
    try {
      const fileContents = await file.arrayBuffer()
      setLargeFileWarning(null)
      if (OFFICE_PACKAGE_EXTENSION.test(file.name) && (await unpackedSizeOf(fileContents)) > MAX_UNPACKED_OFFICE_BYTES) {
        setErrorMessage(t('intake.unpacksTooLarge'))
        setErrorDetail(t('intake.unpacksTooLargeDetail'))
        return
      }
      onFileLoaded(file, fileContents)
    } catch {
      setErrorMessage(t('intake.readFailed'))
    } finally {
      setIsReading(false)
    }
  }

  function openChosenFiles(files: File[]) {
    if (files.length === 0) return
    if (allowsSeveralFiles) {
      // One after another, so the files keep the order they were chosen in (a large file would otherwise arrive last).
      void (async () => {
        for (const file of files) await loadFile(file)
      })()
      return
    }
    if (files.length > 1) {
      setErrorMessage(t('intake.oneFile'))
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
      // Pasting into a text box (the page's paste box, a tool's own text) is that box's; only a paste on the page opens a file.
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return
      const pastedFiles = Array.from(event.clipboardData?.files ?? [])
      const pastedText = event.clipboardData?.getData('text/plain') ?? ''
      if (pastedFiles.length > 0) {
        openChosenFiles(pastedFiles)
      } else if (pastedText.trim() !== '') {
        // Text that starts like JSON (or any text on the JSON page) opens as JSON; other text as CSV.
        const isJson = acceptsPastedJson && (/^\s*[[{]/.test(pastedText) || !acceptedExtensions.includes('.csv'))
        if (isJson) loadFile(new File([pastedText], 'pasted.json', { type: 'application/json' }))
        else if (pastedMarkupExtension) loadFile(new File([pastedText], `pasted${pastedMarkupExtension}`, { type: 'text/plain' }))
        else loadFile(new File([pastedText], 'pasted.csv', { type: 'text/csv' }))
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  })

  const dropTargetProps = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      // Files only: the home page's demo drags its own sample chips, which the demo handles itself.
      if (!event.dataTransfer.types.includes('Files')) return
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

  // The file chooser offers only the formats that open today; a dropped coming-soon file still gets its "coming soon" message.
  const releasedExtensions = new Set(getReleasedFormats().flatMap(({ viewer }) => viewer.extensions))
  const choosableExtensions = acceptsComingSoonFormats ? acceptedExtensions : acceptedExtensions.filter((extension) => releasedExtensions.has(extension))
  // .doc and .ppt stay choosable wherever .docx and .pptx are, so an old Office file gets its own message.
  const pickerExtensions = [...choosableExtensions, ...(choosableExtensions.includes('.docx') ? ['.doc'] : []), ...(choosableExtensions.includes('.pptx') ? ['.ppt'] : [])]
  const fileInput = (
    <input
      id="file-input"
      ref={fileInputRef}
      type="file"
      multiple={allowsSeveralFiles}
      accept={[...pickerExtensions, ...pickerExtensions.flatMap((extension) => PICKER_MIME_TYPES[extension] ?? [])].join(',')}
      aria-label={t('intake.fileInputLabel', { extensions: isolateLeftToRight(choosableExtensions.join(', ')) })}
      className="hidden"
      onChange={(event) => {
        openChosenFiles(Array.from(event.target.files ?? []))
        event.target.value = ''
      }}
    />
  )

  return {
    acceptsPastedText,
    attemptCount,
    clearRedirectSuggestion: () => setRedirectSuggestion(null),
    comingSoonViewer,
    dropTargetProps,
    errorDetail,
    errorMessage,
    fileInput,
    isDraggingOver,
    isReading,
    largeFileWarning,
    openFilePicker: () => fileInputRef.current?.click(),
    openFiles: openChosenFiles,
    // A sample file ("Try a sample file"), made in memory: it opens like a chosen file.
    openSampleFile: (file: File) => loadFile(file),
    redirectSuggestion,
  }
}
