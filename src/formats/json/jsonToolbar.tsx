// This module is fetched on demand (the first time Edit is used), not hot-reloaded as a component file.
/* oxlint-disable react/only-export-components */
import { Icon, IconButton, IconMenuButton } from '../../components/ToolbarControls'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import type { EditingModule } from '../registry'
import { jsonEditingModule } from './jsonModel'
import { JsonViewTools } from './jsonViewTools'
import type { JsonIndent, JsonSelection, JsonViewerCommands } from './jsonModel'

const INDENT_CHOICES: { labelKey: MessageKey; indent: JsonIndent }[] = [
  { labelKey: 'json.toolbar.indent2', indent: 2 },
  { labelKey: 'json.toolbar.indent4', indent: 4 },
  { labelKey: 'json.toolbar.indentTab', indent: '\t' },
  { labelKey: 'json.toolbar.indentMinified', indent: 0 },
]

// The icons in the page's edit toolbar, after Undo, Redo and Revert all. Each one changes the document (or how it is written),
// so each one is saved in the downloaded file. Node actions work on the node selected in the tree.
function JsonToolbar({ selection, commands }: { selection: unknown; commands: unknown }) {
  const { t, idFor } = useT()
  const getActions = (commands as JsonViewerCommands | null)?.getActions
  const jsonSelection = selection as JsonSelection
  if (!getActions || jsonSelection === null) return null
  const { isValid, hasDocument, selectedNode, indent } = jsonSelection
  const canEditDocument = hasDocument && isValid
  const node = selectedNode
  const isContainerSelected = node?.kind === 'object' || node?.kind === 'array'
  const canChangeNode = canEditDocument && node !== null && !node.isRoot
  const nodeHint = node === null ? ` ${t('json.toolbar.nodeHint')}` : ''
  const toolbarId = (key: MessageKey) => `toolbar-${idFor(key)}`
  const divider = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rule" />
  return (
    <>
      {divider}
      <JsonViewTools settings={jsonSelection.view} actions={getActions()} />
      {divider}
      <IconMenuButton
        id={toolbarId('json.toolbar.formatSaved')}
        label={t('json.toolbar.formatSaved')}
        isDisabled={!canEditDocument}
        items={INDENT_CHOICES.map(({ labelKey, indent: choice }) => ({
          id: idFor(labelKey, true),
          label: choice === indent ? t('json.toolbar.current', { label: t(labelKey) }) : t(labelKey),
          onSelect: () => void getActions().setIndent(choice),
        }))}
      >
        <Icon>
          <path d="M4 6h16M8 12h12M12 18h8" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id="toolbar-sort-keys"
        label={t(node?.kind === 'object' ? 'json.toolbar.sortKeysOfObject' : 'json.toolbar.sortKeysOfDocument')}
        isDisabled={!canEditDocument}
        items={[
          { id: idFor('json.toolbar.sortAsc', true), label: t('json.toolbar.sortAsc'), onSelect: () => getActions().sortKeys('asc', false) },
          { id: idFor('json.toolbar.sortDesc', true), label: t('json.toolbar.sortDesc'), onSelect: () => getActions().sortKeys('desc', false) },
          { id: idFor('json.toolbar.sortAscNested', true), label: t('json.toolbar.sortAscNested'), onSelect: () => getActions().sortKeys('asc', true) },
          { id: idFor('json.toolbar.sortDescNested', true), label: t('json.toolbar.sortDescNested'), onSelect: () => getActions().sortKeys('desc', true) },
        ]}
      >
        <Icon>
          <path d="M4 7h8M4 12h12M4 17h16" />
          <path d="m19 5 0 8m0 0-2-2m2 2 2-2" />
        </Icon>
      </IconMenuButton>
      <IconMenuButton
        id="toolbar-sort-list"
        label={node?.kind === 'array' ? t('json.toolbar.sortList') : `${t('json.toolbar.sortList')} ${t('json.toolbar.sortListHint')}`}
        isDisabled={!canEditDocument || node?.kind !== 'array'}
        items={[
          { id: idFor('json.toolbar.listAsc', true), label: t('json.toolbar.listAsc'), onSelect: () => getActions().sortSelectedArray('asc') },
          { id: idFor('json.toolbar.listDesc', true), label: t('json.toolbar.listDesc'), onSelect: () => getActions().sortSelectedArray('desc') },
        ]}
      >
        <Icon>
          <path d="M5 4v16M5 20l-3-3M5 20l3-3" />
          <path d="M14 7h7M14 12h5M14 17h3" />
        </Icon>
      </IconMenuButton>
      {divider}
      <IconButton id="toolbar-add-child" label={`${t(node?.kind === 'array' ? 'json.toolbar.addChildToList' : 'json.toolbar.addChildToObject')}${isContainerSelected ? '' : ` ${t('json.toolbar.addChildHint')}`}`} isDisabled={!canEditDocument || !isContainerSelected} onClick={() => getActions().addChild()}>
        <Icon>
          <path d="M12 5v14M5 12h14" />
        </Icon>
      </IconButton>
      <IconButton id={toolbarId('json.toolbar.duplicateNode')} label={`${t('json.toolbar.duplicateNode')}${nodeHint}`} isDisabled={!canChangeNode} onClick={() => getActions().duplicateNode()}>
        <Icon>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </Icon>
      </IconButton>
      <IconButton id={toolbarId('json.toolbar.moveNodeUp')} label={`${t('json.toolbar.moveNodeUp')}${nodeHint}`} isDisabled={!canChangeNode || node?.isFirst === true} onClick={() => getActions().moveNode(-1)}>
        <Icon>
          <path d="m6 15 6-6 6 6" />
        </Icon>
      </IconButton>
      <IconButton id={toolbarId('json.toolbar.moveNodeDown')} label={`${t('json.toolbar.moveNodeDown')}${nodeHint}`} isDisabled={!canChangeNode || node?.isLast === true} onClick={() => getActions().moveNode(1)}>
        <Icon>
          <path d="m6 9 6 6 6-6" />
        </Icon>
      </IconButton>
      <IconButton id={toolbarId('json.toolbar.deleteNode')} label={`${t('json.toolbar.deleteNode')}${nodeHint}`} isDisabled={!canChangeNode} onClick={() => getActions().deleteNode()}>
        <Icon>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </Icon>
      </IconButton>
      {divider}
      <IconButton id={toolbarId('json.toolbar.findReplace')} label={t('json.toolbar.findReplace')} isDisabled={!canEditDocument} onClick={() => (commands as JsonViewerCommands).toggleFindReplace()}>
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
