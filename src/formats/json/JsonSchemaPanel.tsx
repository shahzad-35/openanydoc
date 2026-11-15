import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { downloadTextFile } from '../registry'
import { formatPathText } from './jsonModel'
import type { JsonPath, JsonValue } from './jsonModel'
import { generateSchema, validateWithSchema } from './jsonSchemaTools'

const MAX_LISTED_ERRORS = 300

// JSON Schema: the open document checked against a schema pasted, chosen or dropped here, again whenever either changes, with each
// error linked to its node; or a schema written from the document ("Generate"), ready to copy, download or check with.
export default function JsonSchemaPanel({ root, fileName, onSelectPath, onCopy }: { root: JsonValue; fileName: string; onSelectPath: (path: JsonPath) => void; onCopy: (text: string) => void }) {
  const { t, tp } = useT()
  const [schemaText, setSchemaText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deferredSchemaText = useDeferredValue(schemaText)
  const deferredRoot = useDeferredValue(root)

  const check = useMemo((): { errors: ReturnType<typeof validateWithSchema> } | { schemaError: string } | null => {
    if (deferredSchemaText.trim() === '') return null
    let schema: unknown
    try {
      schema = JSON.parse(deferredSchemaText)
    } catch (error) {
      return { schemaError: error instanceof Error ? error.message : String(error) }
    }
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return { schemaError: t('json.schema.notAnObject') }
    try {
      return { errors: validateWithSchema(deferredRoot, schema) }
    } catch (error) {
      return { schemaError: error instanceof Error ? error.message : String(error) }
    }
  }, [deferredSchemaText, deferredRoot, t])

  async function readChosenFile(file: File | undefined) {
    if (file) setSchemaText(await file.text())
  }

  return (
    <div id="schema-view" className="view">
      <div className="cmp-input">
        <textarea
          id="schema-input"
          dir="ltr"
          spellCheck={false}
          placeholder={t('json.schema.placeholder')}
          aria-label={t('json.schema.inputLabel')}
          value={schemaText}
          onChange={(event) => setSchemaText(event.target.value)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void readChosenFile(event.dataTransfer.files[0])
          }}
        />
        <div className="cmp-actions">
          <input ref={fileInputRef} id="schema-file-input" type="file" accept=".json,application/json,application/schema+json" hidden onChange={(event) => void readChosenFile(event.target.files?.[0])} />
          <button className="btn sm" type="button" id="schema-choose-button" onClick={() => fileInputRef.current?.click()}>
            {t('json.schema.choose')}
          </button>
          <button className="btn sm" type="button" id="schema-generate-button" onClick={() => setSchemaText(JSON.stringify(generateSchema(root), null, 2))}>
            {t('json.schema.generate')}
          </button>
          <button className="btn sm" type="button" id="schema-copy-button" disabled={schemaText.trim() === ''} onClick={() => onCopy(schemaText)}>
            {t('json.schema.copy')}
          </button>
          <button className="btn sm" type="button" id="schema-download-button" disabled={schemaText.trim() === ''} onClick={() => downloadTextFile(`${fileName.replace(/\.[^.]+$/, '')}.schema.json`, schemaText, 'application/schema+json;charset=utf-8')}>
            {t('json.schema.download')}
          </button>
        </div>
        <p className="cmp-hint">{t('json.schema.hint')}</p>
      </div>
      {check && 'schemaError' in check && (
        <p className="cmp-error" id="schema-error" role="alert" dir="ltr">
          {check.schemaError}
        </p>
      )}
      {check && 'errors' in check && (
        <>
          <p className={`cmp-summary${check.errors.length === 0 ? ' ok' : ''}`} id="schema-summary" role="status">
            {check.errors.length === 0 ? t('json.schema.valid') : tp('json.schema.errorCount', check.errors.length)}
          </p>
          <ul className="cmp-list" id="schema-errors">
            {check.errors.slice(0, MAX_LISTED_ERRORS).map((error, position) => (
              <li key={position}>
                <button type="button" id={`schema-error-${position}`} className="cmp-diff changed" onClick={() => onSelectPath(error.path)}>
                  <code dir="ltr">{formatPathText(error.path)}</code>
                  <span className="m" dir="ltr">{error.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
