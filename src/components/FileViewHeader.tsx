import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { compactSecondaryButtonClassName } from '../buttonStyles'
import { localizePath, useT } from '../i18n'
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
  const { locale, t } = useT()
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
          <button
            id="legal-menu-button"
            type="button"
            popoverTarget="legal-menu"
            aria-haspopup="menu"
            aria-controls="legal-menu"
            aria-label={t('legal.menu')}
            data-tip={t('legal.menu')}
            data-tip-align="end"
            className="control-shape grid min-h-8 min-w-8 cursor-pointer place-items-center transition-colors duration-200 hover:bg-paper pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M5 12h.01M12 12h.01M19 12h.01" />
            </svg>
          </button>
          {/* Links open in a new tab, so the open file and its edits stay where they are. */}
          <div id="legal-menu" popover="auto" role="menu" aria-label={t('legal.menu')} className="box-shape solid-box fixed inset-auto end-4 top-12 m-0 w-64 border-rule bg-paper-raised p-1 text-sm text-ink">
            <a id="menu-link-privacy" role="menuitem" href={localizePath(locale, '/privacy')} target="_blank" rel="noopener" className="block rounded px-3 py-1.5 hover:bg-paper focus-visible:bg-paper">
              {t('legal.privacy')}
            </a>
            <a id="menu-link-terms" role="menuitem" href={localizePath(locale, '/terms')} target="_blank" rel="noopener" className="block rounded px-3 py-1.5 hover:bg-paper focus-visible:bg-paper">
              {t('legal.terms')}
            </a>
            <p id="menu-disclaimer" className="mt-1 border-t border-rule px-3 pt-2 pb-1.5 text-xs text-ink-soft">
              {t('legal.disclaimer')}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
