import { Icon, IconButton } from '../../components/ToolbarControls'

// The reading controls of a JSON file: which view to show, expand and collapse the tree, and copy. They change how the page
// looks (not the file), so they are shown in both View and Edit mode: the viewer draws them in View mode, and the edit toolbar adds
// the same controls (one shared component) in Edit mode.

export type JsonViewKind = 'tree' | 'table' | 'code'

export type JsonViewSettings = {
  viewKind: JsonViewKind
  canShowTable: boolean
  hasDocument: boolean
}

export type JsonViewActions = {
  setViewKind: (viewKind: JsonViewKind) => void
  expandAll: () => void
  collapseAll: () => void
  copyAll: () => void
}

export function JsonViewTools({ settings, actions }: { settings: JsonViewSettings; actions: JsonViewActions }) {
  const { viewKind, canShowTable, hasDocument } = settings
  return (
    <>
      <IconButton label="Tree view" isPressed={viewKind === 'tree'} isDisabled={!hasDocument} onClick={() => actions.setViewKind('tree')}>
        <Icon>
          <path d="M5 5h6M5 12h6M5 19h6" />
          <path d="M8 5v14" />
          <path d="M15 12h5M15 19h5" />
        </Icon>
      </IconButton>
      <IconButton
        label={canShowTable ? 'Table view' : 'Table view (needs a list of objects)'}
        isPressed={viewKind === 'table'}
        isDisabled={!canShowTable}
        onClick={() => actions.setViewKind('table')}
      >
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 10h18M3 15h18M10 4v16" />
        </Icon>
      </IconButton>
      <IconButton label="Code view" isPressed={viewKind === 'code'} onClick={() => actions.setViewKind('code')}>
        <Icon>
          <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 5l-4 14" />
        </Icon>
      </IconButton>
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-rule" />
      <IconButton label="Expand all" isDisabled={viewKind !== 'tree'} onClick={actions.expandAll}>
        <Icon>
          <path d="m7 7 5 5 5-5M7 13l5 5 5-5" />
        </Icon>
      </IconButton>
      <IconButton label="Collapse all" isDisabled={viewKind !== 'tree'} onClick={actions.collapseAll}>
        <Icon>
          <path d="m7 11 5-5 5 5M7 17l5-5 5 5" />
        </Icon>
      </IconButton>
      <IconButton label="Copy all the JSON" isDisabled={!hasDocument} onClick={actions.copyAll}>
        <Icon>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </Icon>
      </IconButton>
    </>
  )
}
