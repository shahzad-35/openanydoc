import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { compactSecondaryButtonClassName } from '../buttonStyles'
import { formatFileSize } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import { findViewerForFileName } from '../viewers'
import FileTypeChip from './FileTypeChip'
import ThemeToggle from './ThemeToggle'

type FileViewHeaderProps = {
  openedFile: OpenedFile
  onClose: () => void
  // Return false (or a promise of false) to stop "Open another file" from running, e.g. when there are unsaved edits.
  onBeforeClear?: () => boolean | Promise<boolean>
  // "Open another file" asks for a new file in place; the wordmark is what goes back home.
  onOpenAnotherFile: () => void
  // Page-level controls (the View / Edit toggle and the change counter), shown before "Open another file".
  controls?: ReactNode
}

// The app bar at the top of every file page: brand, file type, name and size, and the way back home.
export default function FileViewHeader({ openedFile, onClose, onBeforeClear, onOpenAnotherFile, controls }: FileViewHeaderProps) {
  const viewer = findViewerForFileName(openedFile.file.name)
  const fileNameRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${openedFile.file.name} – OpenAnyDoc`
    fileNameRef.current?.focus()
    return () => {
      document.title = previousTitle
    }
  }, [openedFile])

  async function clearIfAllowed() {
    if (onBeforeClear && !(await onBeforeClear())) return
    onClose()
  }

  return (
    <header className="border-b border-rule bg-paper-raised">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-1.5">
        <button type="button" onClick={clearIfAllowed} className="type-h3 cursor-pointer text-lg!">
          OpenAnyDoc
        </button>
        <div className="order-3 flex min-w-0 basis-full items-center gap-3 sm:order-none sm:flex-1 sm:basis-24">
          {viewer && <FileTypeChip viewer={viewer} />}
          <h1 ref={fileNameRef} tabIndex={-1} className="truncate font-medium outline-none">
            {openedFile.file.name}
          </h1>
          <span className="shrink-0 text-ink-soft">{formatFileSize(openedFile.file.size)}</span>
        </div>
        {controls && <div className="order-3 flex basis-full items-center gap-3 sm:order-none sm:basis-auto">{controls}</div>}
        <button type="button" onClick={onOpenAnotherFile} className={`${compactSecondaryButtonClassName} order-4 sm:order-none`}>
          Open another file
        </button>
        <div className="order-2 ml-auto sm:order-none sm:ml-0">
          <ThemeToggle compact />
        </div>
      </div>
    </header>
  )
}
