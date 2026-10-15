// This module is fetched on demand (the first time Edit is used), not hot-reloaded as a component file.
/* oxlint-disable react/only-export-components */
import { Icon, IconButton, IconMenuButton } from '../../components/ToolbarControls'
import type { EditingModule } from '../registry'
import { jsonEditingModule } from './jsonModel'
import type { JsonIndent, JsonSelection, JsonViewerCommands } from './jsonModel'

const INDENT_CHOICES: { label: string; indent: JsonIndent }[] = [
  { label: '2 spaces', indent: 2 },
  { label: '4 spaces', indent: 4 },
  { label: 'Tab', indent: '\t' },
  { label: 'Minified (one line)', indent: 0 },
]

// The icons in the page's edit toolbar, after Undo, Redo and Revert all. Each one changes the document (or how it is written),
// so each one is saved in the downloaded file. Node actions work on the node selected in the tree.
function JsonToolbar({ selection, commands }: { selection: unknown; commands: unknown }) {
  const getActions = (commands as JsonViewerCommands | null)?.getActions
  const jsonSelection = selection as JsonSelection
  if (!getActions || jsonSelection === null) return null
  const { isValid, hasDocument, selectedNode, indent } = jsonSelection
  const canEditDocument = hasDocument && isValid
  const node = selectedNode
  const isContainerSelected = node?.kind === 'object' || node?.kind === 'array'
  const canChangeNode = canEditDocument && node !== null && !node.isRoot
  const nodeHint = node === null ? ' (select a node in the tree)' : ''
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  return (
    <>
      {divider}
      <IconMenuButton
        label="Format the saved JSON"
        isDisabled={!canEditDocument}
        items={INDENT_CHOICES.map(({ label, indent: choice }) => ({ label: choice === indent ? `${label} (current)` : label, onSelect: () => void getActions().setIndent(choice) }))}
      >
        <Icon>
          <path d="M4 6h16M8 12h12M12 18h8" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        label={`Sort keys${node?.kind === 'object' ? ' of the selected object' : ' of the whole document'}`}
        isDisabled={!canEditDocument}
        items={[
          { label: 'A to Z', onSelect: () => getActions().sortKeys('asc', false) },
          { label: 'Z to A', onSelect: () => getActions().sortKeys('desc', false) },
          { label: 'A to Z, including nested objects', onSelect: () => getActions().sortKeys('asc', true) },
          { label: 'Z to A, including nested objects', onSelect: () => getActions().sortKeys('desc', true) },
        ]}
      >
        <Icon>
          <path d="M4 7h8M4 12h12M4 17h16" />
          <path d="m19 5 0 8m0 0-2-2m2 2 2-2" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        label={`Sort the selected list${node?.kind === 'array' ? '' : ' (select a list in the tree)'}`}
        isDisabled={!canEditDocument || node?.kind !== 'array'}
        items={[
          { label: 'Ascending (numbers by size, text A to Z)', onSelect: () => getActions().sortSelectedArray('asc') },
          { label: 'Descending', onSelect: () => getActions().sortSelectedArray('desc') },
        ]}
      >
        <Icon>
          <path d="M5 4v16M5 20l-3-3M5 20l3-3" />
          <path d="M14 7h7M14 12h5M14 17h3" />
        </Icon>
      </IconMenuButton>
      {divider}
      <IconButton label={`Add a child to the selected ${node?.kind === 'array' ? 'list' : 'object'}${isContainerSelected ? '' : ' (select an object or list)'}`} isDisabled={!canEditDocument || !isContainerSelected} onClick={() => getActions().addChild()}>
        <Icon>
          <path d="M12 5v14M5 12h14" />
        </Icon>
      </IconButton>
      <IconButton label={`Duplicate the selected node${nodeHint}`} isDisabled={!canChangeNode} onClick={() => getActions().duplicateNode()}>
        <Icon>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </Icon>
      </IconButton>
      <IconButton label={`Move the selected node up${nodeHint}`} isDisabled={!canChangeNode || node?.isFirst === true} onClick={() => getActions().moveNode(-1)}>
        <Icon>
          <path d="m6 15 6-6 6 6" />
        </Icon>
      </IconButton>
      <IconButton label={`Move the selected node down${nodeHint}`} isDisabled={!canChangeNode || node?.isLast === true} onClick={() => getActions().moveNode(1)}>
        <Icon>
          <path d="m6 9 6 6 6-6" />
        </Icon>
      </IconButton>
      <IconButton label={`Delete the selected node${nodeHint}`} isDisabled={!canChangeNode} onClick={() => getActions().deleteNode()}>
        <Icon>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </Icon>
      </IconButton>
      {divider}
      <IconButton label="Find and replace text in values" isDisabled={!canEditDocument} onClick={() => (commands as JsonViewerCommands).toggleFindReplace()}>
        <Icon>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.5-4.5" />
        </Icon>
      </IconButton>
      {divider}
    </>
  )
}

export const jsonEditingModuleWithToolbar: EditingModule = { ...jsonEditingModule, ToolbarContent: JsonToolbar }
