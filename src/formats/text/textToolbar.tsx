// This module is fetched on demand (the first time Edit is used), not hot-reloaded as a component file.
/* oxlint-disable react/only-export-components */
import { Icon, IconButton, IconMenuButton } from '../../components/ToolbarControls'
import type { EditingModule } from '../registry'
import { textEditingModule } from './textEditing'
import { TextViewTools } from './textViewTools'
import type { TextSelection, TextViewerCommands } from './textEditing'

// The icons in the page's edit toolbar, after Undo, Redo and Revert all. Each one changes the text (or the line endings), so
// each one is saved in the downloaded file. With text selected, case and line actions work on the selection; otherwise on the
// whole text.
function TextToolbar({ selection, commands }: { selection: unknown; commands: unknown }) {
  const getActions = (commands as TextViewerCommands | null)?.getActions
  const textSelection = selection as TextSelection
  if (!getActions || textSelection === null) return null
  const scope = textSelection.hasSelection ? 'the selection' : 'all the text'
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  const lineEndingLabel = (lineEnding: '\n' | '\r\n', name: string) => (textSelection.lineEnding === lineEnding ? `${name} (current)` : name)
  return (
    <>
      {divider}
      <TextViewTools settings={textSelection.view} actions={getActions()} />
      {divider}
      <IconMenuButton
        label={`Change case of ${scope}`}
        items={[
          { label: 'UPPERCASE', onSelect: () => getActions().transform('upper') },
          { label: 'lowercase', onSelect: () => getActions().transform('lower') },
          { label: 'Capitalize Each Word', onSelect: () => getActions().transform('title') },
          { label: 'Sentence case', onSelect: () => getActions().transform('sentence') },
        ]}
      >
        <span className="text-[11px] font-semibold">Aa</span>
      </IconMenuButton>
      <IconMenuButton
        label={`Clean up whitespace in ${scope}`}
        items={[
          { label: 'Trim trailing spaces', onSelect: () => getActions().transform('trimTrailingSpaces') },
          { label: 'Trim extra spaces', onSelect: () => getActions().transform('trimExtraSpaces') },
          { label: 'Remove blank lines', onSelect: () => getActions().transform('removeBlankLines') },
          { label: 'Collapse repeated blank lines', onSelect: () => getActions().transform('collapseBlankLines') },
        ]}
      >
        <Icon>
          <path d="M4 6h16M4 12h10M4 18h16" />
          <path d="m17 10 4 4M21 10l-4 4" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        label={`Arrange the lines of ${scope}`}
        items={[
          { label: 'Sort A to Z', onSelect: () => getActions().transform('sortAscending') },
          { label: 'Sort Z to A', onSelect: () => getActions().transform('sortDescending') },
          { label: 'Reverse order', onSelect: () => getActions().transform('reverseLines') },
          { label: 'Remove duplicate lines', onSelect: () => getActions().transform('removeDuplicateLines') },
          { label: 'Join lines into one', onSelect: () => getActions().transform('joinLines') },
        ]}
      >
        <Icon>
          <path d="M4 6h8M4 12h12M4 18h16" />
          <path d="m18 4v8m0 0-2-2m2 2 2-2" />
        </Icon>
      </IconMenuButton>
      <IconButton label="Decrease indent" onClick={() => getActions().transform('outdent')}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m8 9-3 3 3 3" />
        </Icon>
      </IconButton>
      <IconButton label="Increase indent" onClick={() => getActions().transform('indent')}>
        <Icon>
          <path d="M4 6h16M12 10h8M12 14h8M4 18h16" />
          <path d="m5 9 3 3-3 3" />
        </Icon>
      </IconButton>
      {divider}
      <IconButton label="Insert date and time" onClick={() => getActions().transform('insertDateTime')}>
        <Icon>
          <rect x="4" y="5" width="16" height="15" rx="1" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </Icon>
      </IconButton>
      <IconMenuButton
        label="Line endings of the saved file"
        items={[
          { label: lineEndingLabel('\n', 'LF (Unix, macOS)'), onSelect: () => getActions().setLineEnding('\n') },
          { label: lineEndingLabel('\r\n', 'CRLF (Windows)'), onSelect: () => getActions().setLineEnding('\r\n') },
        ]}
      >
        <Icon>
          <path d="M20 5v8a2 2 0 0 1-2 2H5" />
          <path d="m9 11-4 4 4 4" />
        </Icon>
      </IconMenuButton>
      <IconButton label="Find and replace" onClick={() => (commands as TextViewerCommands).toggleFindReplace()}>
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
