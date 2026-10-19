import MenuBar from '../components/MenuBar'
import type { MenuDefinition } from '../components/MenuBar'
import { isolateLeftToRight, localizePath, useT } from '../i18n'
import { formatFileSize, getLargeFileWarning } from '../useFileIntake'
import { findViewerForFileName } from '../viewers'
import type { FormatViewerProps } from './registry'
import { DropOverlay, SheetIconSprite, TopBar, useIsNarrowScreen, useThemeToggle } from './sheet/SheetChrome'
import './sheet/sheetChrome.css'

// Stands in for formats whose preview is not built yet (Word, PDF, PowerPoint), in the word-processor frame of the other file
// pages: title row, menu bar, and the message on a page. Only File and Help have items; nothing pretends to edit.
export default function ComingSoonViewer({ openedFile, onOpenAnotherFile, onClose }: FormatViewerProps) {
  const { locale, t } = useT()
  const viewer = findViewerForFileName(openedFile.file.name)
  const largeFileWarning = getLargeFileWarning(openedFile.file, locale)
  const [isDark, toggleTheme] = useThemeToggle()
  const isNarrow = useIsNarrowScreen()

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { id: 'open', label: t('menu.openAnother'), icon: 'open', onSelect: onOpenAnotherFile },
        { id: 'close', label: t('menu.close'), icon: 'x', onSelect: onClose },
      ],
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        { id: 'menu-link-privacy', label: t('legal.privacy'), icon: 'lock', href: localizePath(locale, '/privacy') },
        { id: 'menu-link-terms', label: t('legal.terms'), icon: 'file', href: localizePath(locale, '/terms') },
        { id: 'menu-disclaimer', note: t('legal.disclaimer') },
      ],
    },
  ]

  return (
    <div id="docs-workbench">
      <SheetIconSprite />
      <TopBar
        format="unsupported"
        fileName={openedFile.file.name}
        fileSize={formatFileSize(openedFile.file.size)}
        isModified={false}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        canDownload={false}
        downloadLabel={t('toolbar.download')}
        downloadTip={t('toolbar.download')}
        onDownload={() => {}}
        onHome={onClose}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <MenuBar menus={menus} isCompact={isNarrow} label={t('menu.bar')} />
      <main id="main" className="docs-canvas">
        <section className="docs-page" aria-labelledby="coming-soon-title">
          <h2 id="coming-soon-title" className="type-h3">
            {t('comingSoon.title', { format: viewer?.label ?? '' })}
          </h2>
          <p className="mt-2 text-ink-soft">{t('comingSoon.text', { extensions: isolateLeftToRight(viewer?.extensions.join(' / ') ?? '') })}</p>
          {largeFileWarning && <p className="mt-2 text-ink-soft">{largeFileWarning}</p>}
          <button className="btn outline mt-6" id="choose-another-file-button" type="button" onClick={onOpenAnotherFile}>
            {t('menu.openAnother')}
          </button>
        </section>
      </main>
      <DropOverlay />
    </div>
  )
}
