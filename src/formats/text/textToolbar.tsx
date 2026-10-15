// This module is fetched on demand (the first time Edit is used), not hot-reloaded as a component file.
/* oxlint-disable react/only-export-components */
import { useT } from '../../i18n'
import { Icon, IconButton, IconMenuButton } from '../../components/ToolbarControls'
import type { EditingModule } from '../registry'
import { textEditingModule } from './textEditing'
import { TextViewTools } from './textViewTools'
import type { TextSelection, TextViewerCommands } from './textEditing'

// The icons in the page's edit toolbar, after Undo, Redo and Revert all. Each one changes the text (or the line endings), so
// each one is saved in the downloaded file. With text selected, case and line actions work on the selection; otherwise on the
// whole text.
function TextToolbar({ selection, commands }: { selection: unknown; commands: unknown }) {
  const { t, idFor } = useT()
  const getActions = (commands as TextViewerCommands | null)?.getActions
  const textSelection = selection as TextSelection
  if (!getActions || textSelection === null) return null
  const hasSelection = textSelection.hasSelection
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  const lineEndingLabel = (lineEnding: '\n' | '\r\n', label: string) => (textSelection.lineEnding === lineEnding ? t('text.view.current', { label }) : label)
  return (
    <>
      {divider}
      <TextViewTools settings={textSelection.view} actions={getActions()} />
      {divider}
      <IconMenuButton
        id="toolbar-change-case"
        label={t(hasSelection ? 'text.toolbar.changeCaseSelection' : 'text.toolbar.changeCaseAll')}
        items={[
          { id: idFor('text.case.upper', true), label: t('text.case.upper'), onSelect: () => getActions().transform('upper') },
          { id: idFor('text.case.lower', true), label: t('text.case.lower'), onSelect: () => getActions().transform('lower') },
          { id: idFor('text.case.title', true), label: t('text.case.title'), onSelect: () => getActions().transform('title') },
          { id: idFor('text.case.sentence', true), label: t('text.case.sentence'), onSelect: () => getActions().transform('sentence') },
        ]}
      >
        <span className="text-[11px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconMenuButton
        id="toolbar-clean-up-whitespace"
        label={t(hasSelection ? 'text.toolbar.cleanUpSelection' : 'text.toolbar.cleanUpAll')}
        items={[
          { id: idFor('text.clean.trimTrailing', true), label: t('text.clean.trimTrailing'), onSelect: () => getActions().transform('trimTrailingSpaces') },
          { id: idFor('text.clean.trimExtra', true), label: t('text.clean.trimExtra'), onSelect: () => getActions().transform('trimExtraSpaces') },
          { id: idFor('text.clean.removeBlank', true), label: t('text.clean.removeBlank'), onSelect: () => getActions().transform('removeBlankLines') },
          { id: idFor('text.clean.collapseBlank', true), label: t('text.clean.collapseBlank'), onSelect: () => getActions().transform('collapseBlankLines') },
        ]}
      >
        <Icon>
          <path d="M4 6h16M4 12h10M4 18h16" />
          <path d="m17 10 4 4M21 10l-4 4" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id="toolbar-arrange-lines"
        label={t(hasSelection ? 'text.toolbar.arrangeSelection' : 'text.toolbar.arrangeAll')}
        items={[
          { id: idFor('text.arrange.sortAscending', true), label: t('text.arrange.sortAscending'), onSelect: () => getActions().transform('sortAscending') },
          { id: idFor('text.arrange.sortDescending', true), label: t('text.arrange.sortDescending'), onSelect: () => getActions().transform('sortDescending') },
          { id: idFor('text.arrange.reverse', true), label: t('text.arrange.reverse'), onSelect: () => getActions().transform('reverseLines') },
          { id: idFor('text.arrange.removeDuplicates', true), label: t('text.arrange.removeDuplicates'), onSelect: () => getActions().transform('removeDuplicateLines') },
          { id: idFor('text.arrange.join', true), label: t('text.arrange.join'), onSelect: () => getActions().transform('joinLines') },
        ]}
      >
        <Icon>
          <path d="M4 6h8M4 12h12M4 18h16" />
          <path d="m18 4v8m0 0-2-2m2 2 2-2" />
        </Icon>
      </IconMenuButton>
      <IconButton id={`toolbar-${idFor('text.toolbar.decreaseIndent')}`} label={t('text.toolbar.decreaseIndent')} onClick={() => getActions().transform('outdent')}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m8 9-3 3 3 3" />
        </Icon>
      </IconButton>
      <IconButton id={`toolbar-${idFor('text.toolbar.increaseIndent')}`} label={t('text.toolbar.increaseIndent')} onClick={() => getActions().transform('indent')}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m5 9 3 3-3 3" />
        </Icon>
      </IconButton>
      {divider}
      <IconButton id={`toolbar-${idFor('text.toolbar.insertDateTime')}`} label={t('text.toolbar.insertDateTime')} onClick={() => getActions().transform('insertDateTime')}>
        <Icon>
          <rect x="4" y="5" width="16" height="15" rx="1" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </Icon>
      </IconButton>
      <IconMenuButton
        id={`toolbar-${idFor('text.toolbar.lineEndings')}`}
        label={t('text.toolbar.lineEndings')}
        items={[
          { id: 'lf', label: lineEndingLabel('\n', 'LF (Unix, macOS)'), onSelect: () => getActions().setLineEnding('\n') },
          { id: 'crlf', label: lineEndingLabel('\r\n', 'CRLF (Windows)'), onSelect: () => getActions().setLineEnding('\r\n') },
        ]}
      >
        <Icon>
          <path d="M20 5v8a2 2 0 0 1-2 2H5" />
          <path d="m9 11-4 4 4 4" />
        </Icon>
      </IconMenuButton>
      <IconButton id={`toolbar-${idFor('find.label')}`} label={t('find.label')} onClick={() => (commands as TextViewerCommands).toggleFindReplace()}>
        <Icon>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.5-4.5" />
        </Icon>
      </IconButton>
      {divider}
    </>
  )
}

export const textEditingModuleWithToolbar: EditingModule = { ...textEditingModule, ToolbarContent: TextToolbar }
