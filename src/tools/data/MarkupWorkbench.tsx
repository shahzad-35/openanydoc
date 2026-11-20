import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { CORE_SCHEMA, YAMLException, dump, load } from 'js-yaml'
import { uiIconShapes } from '../../components/KitIcon'
import { useToast } from '../../components/Messages'
import { useT } from '../../i18n'
import JsonCodeEditor from '../../formats/json/JsonCodeEditor'
import JsonTree from '../../formats/json/JsonTree'
import type { TreeRowAction } from '../../formats/json/JsonTree'
import { findXmlError, rewriteXml, xmlToJsonValue } from '../../formats/json/jsonConvert'
import { expandNodesUpToLimit, formatPathText, getPathKey } from '../../formats/json/jsonModel'
import type { JsonPath, JsonValue, TreeRow } from '../../formats/json/jsonModel'
import { downloadTextFile } from '../../formats/registry'
import type { ToolProps } from '../registry'
import '../../formats/json/jsonWorkbench.css'

// The XML viewer and the YAML formatter pages: the text to edit (the JSON viewer's code editor, with XML or YAML colours) beside
// the data as the JSON viewer's tree, checked as you type. XML is read by the browser's parser (attributes as "@name", text as
// "#text"), YAML by js-yaml with its core schema (no dates or custom types, so the tree shows what the text says). Nothing is
// stored; the text lives in this component only.

type MarkupFormat = 'xml' | 'yaml'
type TextCheck = { status: 'empty' } | { status: 'valid'; root: JsonValue } | { status: 'invalid'; message: string; line: number | null; column: number | null }

const MAX_TEXT_BYTES = 10 * 1024 * 1024
const FILE_TYPES: Record<MarkupFormat, string> = { xml: 'application/xml;charset=utf-8', yaml: 'application/yaml;charset=utf-8' }

function checkText(text: string, format: MarkupFormat): TextCheck {
  if (text.trim() === '') return { status: 'empty' }
  if (format === 'xml') {
    const xmlError = findXmlError(text)
    return xmlError ? { status: 'invalid', message: xmlError.message, line: xmlError.line, column: null } : { status: 'valid', root: xmlToJsonValue(text) }
  }
  try {
    return { status: 'valid', root: (load(text, { schema: CORE_SCHEMA }) ?? null) as JsonValue }
  } catch (error) {
    if (!(error instanceof YAMLException)) throw error
    return { status: 'invalid', message: error.reason, line: error.mark ? error.mark.line + 1 : null, column: error.mark ? error.mark.column + 1 : null }
  }
}

function MarkupWorkbench({ format, files, onOpenInPage }: ToolProps & { format: MarkupFormat }) {
  const { t } = useT()
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState(`pasted.${format}`)
  const [indentSize, setIndentSize] = useState(2)
  const [selectedPath, setSelectedPath] = useState<JsonPath | null>(null)
  const [toggledKeys, setToggledKeys] = useState<{ forRoot: JsonValue | null; keys: ReadonlySet<string> }>({ forRoot: null, keys: new Set() })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const deferredText = useDeferredValue(text)
  const textCheck = useMemo(() => checkText(deferredText, format), [deferredText, format])
  const root = textCheck.status === 'valid' ? textCheck.root : null
  // The tree opens two levels deep for each new version of the data; the visitor's own opening and closing apply until it changes.
  const defaultExpandedKeys = useMemo(() => (root === null ? new Set<string>() : expandNodesUpToLimit(root, 2).expandedKeys), [root])
  const expandedKeys = toggledKeys.forRoot === root ? toggledKeys.keys : defaultExpandedKeys

  // A chosen file or a sample fills the text box.
  const chosenFile = files.at(-1)
  useEffect(() => {
    if (!chosenFile) return
    if (chosenFile.size > MAX_TEXT_BYTES) {
      showToast({ kind: 'error', message: t('markup.tooLarge') })
      return
    }
    void chosenFile.text().then((fileText) => {
      setText(fileText)
      setFileName(chosenFile.name)
    })
  }, [chosenFile, showToast, t])

  function toggleExpanded(pathKey: string) {
    const newKeys = new Set(expandedKeys)
    if (!newKeys.delete(pathKey)) newKeys.add(pathKey)
    setToggledKeys({ forRoot: root, keys: newKeys })
  }

  function handleRowAction(action: TreeRowAction, row: TreeRow) {
    if (action === 'copyPath') void copyToClipboard(formatPathText(row.path))
  }

  async function copyToClipboard(copiedText: string) {
    try {
      await navigator.clipboard.writeText(copiedText)
      showToast({ kind: 'success', message: t('markup.copied') })
    } catch {
      showToast({ kind: 'error', message: t('json.status.copyNotAllowed') })
    }
  }

  function validateNow() {
    const currentCheck = checkText(text, format)
    if (currentCheck.status === 'valid') showToast({ kind: 'success', message: t(format === 'xml' ? 'markup.valid.xml' : 'markup.valid.yaml') })
    else if (currentCheck.status === 'invalid') showToast({ kind: 'error', message: describeError(currentCheck) })
  }

  function describeError(invalidCheck: Extract<TextCheck, { status: 'invalid' }>) {
    return invalidCheck.line === null ? invalidCheck.message : t('markup.errorAt', { line: invalidCheck.line, message: invalidCheck.message })
  }

  // Format and Minify rewrite the text; text that does not read is left as it is, with the reason.
  function rewriteText(isMinified: boolean) {
    const currentCheck = checkText(text, format)
    if (currentCheck.status !== 'valid') {
      if (currentCheck.status === 'invalid') showToast({ kind: 'error', message: describeError(currentCheck) })
      return
    }
    const indentUnit = isMinified ? '' : ' '.repeat(indentSize)
    setText(format === 'xml' ? rewriteXml(text, indentUnit) : dump(currentCheck.root, { indent: indentSize, lineWidth: -1, noRefs: true, schema: CORE_SCHEMA }))
  }

  const errorPosition = textCheck.status === 'invalid' && textCheck.line !== null ? { line: textCheck.line, column: textCheck.column ?? 1 } : null
  const isTextReadable = textCheck.status === 'valid'

  return (
    <div id="json-workbench" className="markup-workbench" data-format={format}>
      <svg width="0" height="0" className="mw-sprite" aria-hidden="true">
        <symbol id="i-chev-right" viewBox="0 0 24 24">
          <path d="m10 7 5 5-5 5" />
        </symbol>
        <symbol id="i-copy" viewBox="0 0 24 24">
          {uiIconShapes.copy}
        </symbol>
      </svg>
      <div className="mw-toolbar" role="toolbar" aria-label={t('markup.toolbar')}>
        <button className="btn sm primary" type="button" id="markup-validate-button" disabled={textCheck.status === 'empty'} onClick={validateNow}>
          {t('markup.validate')}
        </button>
        <span className="mw-group">
          <label htmlFor="markup-indent-select" className="sr-only">
            {t('markup.indent')}
          </label>
          <select id="markup-indent-select" value={indentSize} onChange={(event) => setIndentSize(Number(event.target.value))}>
            <option value={2}>{t('markup.indentSpaces', { count: 2 })}</option>
            <option value={4}>{t('markup.indentSpaces', { count: 4 })}</option>
          </select>
          <button className="btn sm outline" type="button" id="markup-format-button" disabled={!isTextReadable} onClick={() => rewriteText(false)}>
            {t('markup.format')}
          </button>
        </span>
        {format === 'xml' && (
          <button className="btn sm outline" type="button" id="markup-minify-button" disabled={!isTextReadable} onClick={() => rewriteText(true)}>
            {t('markup.minify')}
          </button>
        )}
        <button className="btn sm outline" type="button" id="markup-copy-button" disabled={text === ''} onClick={() => void copyToClipboard(text)}>
          {t('markup.copy')}
        </button>
        <button className="btn sm outline" type="button" id="markup-download-button" disabled={text === ''} onClick={() => downloadTextFile(fileName, text, FILE_TYPES[format])}>
          {t('markup.download')}
        </button>
        <button
          className="btn sm outline"
          type="button"
          id="markup-open-as-json-button"
          disabled={!isTextReadable}
          onClick={() => onOpenInPage?.(new File([text], fileName, { type: FILE_TYPES[format] }), format === 'xml' ? '/xml-to-json' : '/yaml-to-json')}
        >
          {t(format === 'xml' ? 'markup.openAsJson' : 'markup.convertToJson')}
        </button>
      </div>
      <p id="markup-status" className={`mw-status ${textCheck.status}`} role="status">
        {textCheck.status === 'empty' ? t(format === 'xml' ? 'markup.empty.xml' : 'markup.empty.yaml') : textCheck.status === 'valid' ? t(format === 'xml' ? 'markup.valid.xml' : 'markup.valid.yaml') : describeError(textCheck)}
      </p>
      <div className="mw-panes">
        <section id="markup-text-pane" className="mw-text-pane" aria-label={t(format === 'xml' ? 'markup.textLabel.xml' : 'markup.textLabel.yaml')}>
          <JsonCodeEditor
            textareaRef={textareaRef}
            value={text}
            placeholder={t(format === 'xml' ? 'markup.placeholder.xml' : 'markup.placeholder.yaml')}
            ariaLabel={t(format === 'xml' ? 'markup.textLabel.xml' : 'markup.textLabel.yaml')}
            onChange={setText}
            onBlur={() => {}}
            onCursorMove={() => {}}
            error={errorPosition}
            cursorLine={null}
            selectedStart={null}
            language={format}
          />
        </section>
        <section id="markup-tree-pane" className="mw-tree-pane" aria-label={t('markup.treeLabel')}>
          {root !== null ? (
            <JsonTree
              root={root}
              expandedKeys={expandedKeys}
              onToggleExpanded={toggleExpanded}
              searchText=""
              matchPathKeys={new Set()}
              selectedPathKey={selectedPath === null ? null : getPathKey(selectedPath)}
              onSelectPath={setSelectedPath}
              revealPathKey={null}
              showTypes
              showIndexes
              isStale={false}
              getLine={() => null}
              onRowAction={handleRowAction}
            />
          ) : (
            <p className="mw-tree-empty">{t('markup.treeEmpty')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

export function XmlViewer(props: ToolProps) {
  return <MarkupWorkbench {...props} format="xml" />
}

export function YamlFormatter(props: ToolProps) {
  return <MarkupWorkbench {...props} format="yaml" />
}
