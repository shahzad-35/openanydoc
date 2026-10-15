import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { compactSecondaryButtonClassName } from '../buttonStyles'
import { useT } from '../i18n'
import { formatFileSize } from '../useFileIntake'
import type { OpenedFile } from '../useFileIntake'
import { findTableFormat, findViewerForFileName } from '../viewers'
import FileTypeChip from './FileTypeChip'
import LanguageSwitcher from './LanguageSwitcher'
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
  const { t } = useT()
  const viewer = findViewerForFileName(openedFile.file.name)
  const fileNameRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = t('file.title', { name: openedFile.file.name })
    fileNameRef.current?.focus()
    return () => {
      document.title = previousTitle
    }
    // t changes with the language: the title follows it without moving focus again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFile])

  async function clearIfAllowed() {
    if (onBeforeClear && !(await onBeforeClear())) return
    onClose()
  }

  return (
    <header id="file-header" className="border-b border-rule bg-paper-raised">
      <a
        id="skip-to-content-link"
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('skip.toContent')}
      </a>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1">
        <button id="brand-home-button" type="button" onClick={clearIfAllowed} className="type-h3 cursor-pointer text-base!">
          OpenAnyDoc
        </button>
        <div id="file-summary" className="order-3 flex min-w-0 basis-full items-center gap-3 sm:order-none sm:flex-1 sm:basis-24">
          {viewer && <FileTypeChip viewer={viewer} label={viewer.id === 'csv' ? findTableFormat(openedFile.file.name).label : viewer.label} />}
          <h1 id="file-name" ref={fileNameRef} tabIndex={-1} className="truncate font-medium outline-none">
            {openedFile.file.name}
          </h1>
          <span id="file-size" dir="ltr" className="shrink-0 text-ink-soft">{formatFileSize(openedFile.file.size)}</span>
        </div>
        {controls && <div id="file-mode-controls" className="order-3 flex basis-full items-center gap-3 sm:order-none sm:basis-auto">{controls}</div>}
        <button id="open-another-file-button" type="button" onClick={onOpenAnotherFile} className={`${compactSecondaryButtonClassName} order-4 sm:order-none`}>
          {t('file.openAnother')}
        </button>
        <div className="order-2 ms-auto flex items-center gap-2 sm:order-none sm:ms-0">
          <LanguageSwitcher compact />
          <ThemeToggle compact />
        </div>
      </div>
    </header>
  )
}
