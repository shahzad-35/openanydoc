import { useEffect, useRef, useState } from 'react'
import { Notice, useToast } from '../../components/Messages'
import { isolateText, useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { downloadTextFile } from '../registry'
import { TEXT_FIELD_ID, isSelectedByDefault } from './detectSensitiveData'
import type { Finding, MaskCategory, MaskField } from './detectSensitiveData'
import type { MaskWorkerResponse, PreviewTable } from './mask.worker'
import { PREVIEW_ROW_COUNT, buildTokenKey } from './maskData'
import type { MaskChoice, MaskStrategy, TokenKeyEntry } from './maskData'
import { buildOutputFile, buildOutputFileName, getFileFormat, readMaskSource, startMaskWorker } from './maskFiles'
import type { MaskOutputFormat } from './maskFiles'
import './maskWorkbench.css'

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; percent: number }
  | { status: 'ready'; fields: MaskField[]; findings: Finding[]; sheetNames: string[] }
  | { status: 'error'; message: string }
type FieldChoice = { isSelected: boolean; category: MaskCategory; strategy: MaskStrategy }
type MaskStep = 1 | 2 | 3

const STEPS: { step: MaskStep; labelKey: MessageKey }[] = [
  { step: 1, labelKey: 'mask.step.choose' },
  { step: 2, labelKey: 'mask.step.review' },
  { step: 3, labelKey: 'mask.step.download' },
]
const DOWNLOAD_LABELS: Record<MaskOutputFormat, MessageKey> = { csv: 'mask.downloadCsv', xlsx: 'mask.downloadExcel', json: 'mask.downloadJson', txt: 'mask.downloadTxt' }
const DOWNLOAD_NAMES: Record<MaskOutputFormat, string> = { csv: 'CSV', xlsx: 'Excel', json: 'JSON', txt: 'TXT' }
const DOWNLOAD_ICON_PATH = 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14'
// Arrows point the way the steps go, so they are mirrored in Arabic (.mw-flip).
const NEXT_ICON_PATH = 'M5 12h14m0 0-5-5m5 5-5 5'
const BACK_ICON_PATH = 'M19 12H5m0 0 5-5m-5 5 5 5'
const CHEVRON_ICON_PATH = 'm6 9 6 6 6-6'
const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18'
// The browser's own select arrow is drawn differently in each viewer; the panel's selects draw this one instead (.mw-select-wrap).
const SELECT_CHEVRON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico mw-select-chevron">
    <path d="m6 9 6 6 6-6" />
  </svg>
)
type ButtonLook = 'primary' | 'outline' | 'quiet' | 'icon'
// In a viewer the drawer uses that viewer's own buttons (.btn, .btn.primary ... from its workbench stylesheet), so they match the
// bar the drawer opened from; on the /mask-data page the panel's own .mw-btn buttons.
// (Not the workbenches' own "outline" class: that name is also Tailwind's outline utility, which draws a dark ring.)
const DRAWER_BUTTON_CLASSES: Record<ButtonLook, string> = { primary: 'btn primary', outline: 'btn mw-outline', quiet: 'btn', icon: 'btn icon' }
const PAGE_BUTTON_CLASSES: Record<ButtonLook, string> = { primary: 'mw-btn primary', outline: 'mw-btn', quiet: 'mw-btn ghost', icon: 'mw-btn ghost icon' }
const CATEGORIES: MaskCategory[] = ['name', 'email', 'phone', 'nationalId', 'iban', 'card', 'address', 'birthDate', 'freeText', 'other']
const STRATEGIES: MaskStrategy[] = ['token', 'partial', 'remove']
// With more fields than this, the column list gets a search box.
const SEARCHABLE_FIELD_COUNT = 8

function strategyLabelKey(category: MaskCategory, strategy: MaskStrategy): MessageKey {
  if (category === 'freeText' && strategy !== 'remove') return strategy === 'token' ? 'mask.strategy.tokenInText' : 'mask.strategy.partialInText'
  return `mask.strategy.${strategy}`
}

// The masked rows ('after') or the original ones ('before'); in 'after', the cells masking changed are highlighted. Data, so left to right.
function PreviewGrid({ preview, view }: { preview: { before: PreviewTable; after: PreviewTable }; view: 'before' | 'after' }) {
  const table = preview[view]
  return (
    <div dir="ltr" className="mw-table-wrap">
      <table id="mask-preview-table" data-view={view} className="mw-table">
        <thead>
          <tr>
            {table.header.map((columnName, columnIndex) => (
              <th key={columnIndex} scope="col">{columnName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cellText, columnIndex) => {
                const originalColumn = preview.before.header.indexOf(table.header[columnIndex])
                const isChanged = view === 'after' && preview.before.rows[rowIndex]?.[originalColumn] !== cellText
                return (
                  <td key={columnIndex} title={cellText} className={isChanged ? 'changed' : undefined}>
                    {cellText}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The Mask Data panel: on the /mask-data page under its drop zone, and in each viewer as a drawer over the open file (`onClose`
// set). The Mask tab scans `file` and goes in three steps: the columns to mask with a type and method each (every column of the
// file can be picked; the scan's finds start ticked), the first rows before and after, then the download and the private key. The
// Restore tab puts the values back from a masked file and its key. Files, choices and keys live in this component's memory only.
export default function MaskWorkbench({ file, onClose }: { file: File | null; onClose?: () => void }) {
  const { locale, t } = useT()
  const { showToast } = useToast()
  const isDrawer = onClose !== undefined
  const buttonClasses = isDrawer ? DRAWER_BUTTON_CLASSES : PAGE_BUTTON_CLASSES
  const [activeTab, setActiveTab] = useState<'mask' | 'restore'>('mask')
  const [step, setStep] = useState<MaskStep>(1)
  const [scanState, setScanState] = useState<ScanState>({ status: 'idle' })
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({})
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [previewSheetIndex, setPreviewSheetIndex] = useState(0)
  const [previewView, setPreviewView] = useState<'before' | 'after'>('after')
  const [preview, setPreview] = useState<{ before: PreviewTable; after: PreviewTable } | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [createsKey, setCreatesKey] = useState(false)
  // The tokens of the last masked download, for its key; cleared when the choices change, since the key would no longer match.
  const [lastTokens, setLastTokens] = useState<Record<string, TokenKeyEntry> | null>(null)
  const [maskedFile, setMaskedFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const workerRef = useRef<ReturnType<typeof startMaskWorker> | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const worker = startMaskWorker((share) => setScanState((state) => (state.status === 'scanning' ? { status: 'scanning', percent: Math.round(share * 100) } : state)))
    workerRef.current = worker
    return () => worker.stop()
  }, [])

  // The drawer takes the focus as it opens and closes on Escape; the column list closes on a click outside it and on Escape.
  useEffect(() => {
    if (isDrawer) panelRef.current?.querySelector<HTMLElement>('#mask-close-button')?.focus()
  }, [isDrawer])
  useEffect(() => {
    function closeOnEscapeOrOutsideClick(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return
        if (isPickerOpen) setIsPickerOpen(false)
        else onClose?.()
      } else if (isPickerOpen && !pickerRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnEscapeOrOutsideClick)
    document.addEventListener('keydown', closeOnEscapeOrOutsideClick)
    return () => {
      document.removeEventListener('mousedown', closeOnEscapeOrOutsideClick)
      document.removeEventListener('keydown', closeOnEscapeOrOutsideClick)
    }
  }, [isPickerOpen, onClose])

  const fields = scanState.status === 'ready' ? scanState.fields : []
  const findingsById = new Map((scanState.status === 'ready' ? scanState.findings : []).map((finding) => [finding.fieldId, finding]))
  const isTextFile = fields.length === 1 && fields[0].fieldId === TEXT_FIELD_ID
  const selectedFields = fields.filter((field) => fieldChoices[field.fieldId]?.isSelected)
  const choices: MaskChoice[] = selectedFields.map((field) => ({ fieldId: field.fieldId, category: fieldChoices[field.fieldId].category, strategy: fieldChoices[field.fieldId].strategy }))
  const choicesText = JSON.stringify(choices)
  const outputFormats: MaskOutputFormat[] = isTextFile ? ['txt'] : ['csv', 'xlsx', 'json']
  const fieldLabel = (field: MaskField) => (field.fieldId === TEXT_FIELD_ID ? t('mask.wholeText') : field.label)

  function describeWorkerError(response: MaskWorkerResponse) {
    return response.type === 'error' && response.reason === 'json' ? t('mask.error.json', { detail: response.detail }) : t('mask.error.failed')
  }

  useEffect(() => {
    if (!file) return
    let isCurrent = true
    setActiveTab('mask')
    setStep(1)
    setScanState({ status: 'scanning', percent: 0 })
    setPreview(null)
    setLastTokens(null)
    setErrorMessage('')
    setPreviewSheetIndex(0)
    void (async () => {
      const readResult = await readMaskSource(file, locale)
      if ('error' in readResult) {
        if (isCurrent) setScanState({ status: 'error', message: readResult.error })
        return
      }
      const response = await workerRef.current!.request({ type: 'scan', source: readResult.source }).catch(() => null)
      if (!isCurrent) return
      if (response?.type !== 'scanned') {
        setScanState({ status: 'error', message: response ? describeWorkerError(response) : t('mask.error.failed') })
        return
      }
      const scannedFindings = new Map(response.findings.map((finding) => [finding.fieldId, finding]))
      setFieldChoices(
        Object.fromEntries(
          response.fields.map((field) => {
            const finding = scannedFindings.get(field.fieldId)
            return [field.fieldId, { isSelected: finding ? isSelectedByDefault(finding) : false, category: finding?.category ?? 'other', strategy: 'token' }]
          }),
        ),
      )
      setScanState({ status: 'ready', fields: response.fields, findings: response.findings, sheetNames: response.sheetNames })
    })()
    return () => {
      isCurrent = false
    }
    // A new file starts a new scan; the locale and messages are read as they are then.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // The preview follows every change of choice or sheet.
  useEffect(() => {
    if (scanState.status !== 'ready') return
    let isCurrent = true
    setLastTokens(null)
    workerRef.current!
      .request({ type: 'preview', choices: JSON.parse(choicesText), sheetIndex: previewSheetIndex })
      .then((response) => {
        if (isCurrent && response.type === 'preview') setPreview({ before: response.before, after: response.after })
      })
      .catch(() => setErrorMessage(t('mask.error.failed')))
    return () => {
      isCurrent = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [scanState, choicesText, previewSheetIndex])

  function updateFieldChoice(fieldId: string, change: Partial<FieldChoice>) {
    setFieldChoices((current) => ({ ...current, [fieldId]: { ...current[fieldId], ...change } }))
  }

  async function downloadMaskedFile(target: MaskOutputFormat) {
    if (!file || scanState.status !== 'ready') return
    setIsWorking(true)
    setErrorMessage('')
    try {
      const response = await workerRef.current!.request({ type: 'mask', choices })
      if (response.type !== 'masked') {
        setErrorMessage(describeWorkerError(response))
        return
      }
      const sheetName = target === 'csv' && scanState.sheetNames.length > 1 ? scanState.sheetNames[previewSheetIndex] : ''
      const fileName = buildOutputFileName(file.name, 'masked', target, sheetName)
      const outputFile = await buildOutputFile(response.document, target, fileName, previewSheetIndex, locale)
      if ('error' in outputFile) {
        setErrorMessage(outputFile.error)
        return
      }
      downloadTextFile(fileName, outputFile, outputFile.type)
      setLastTokens(response.tokens)
      showToast({ message: t('mask.saved', { name: isolateText(fileName) }), kind: 'success' })
    } catch {
      setErrorMessage(t('mask.error.failed'))
    } finally {
      setIsWorking(false)
    }
  }

  function downloadKey() {
    if (!file || !lastTokens) return
    const keyFileName = buildOutputFileName(file.name, 'private-key', 'json')
    downloadTextFile(keyFileName, JSON.stringify(buildTokenKey(lastTokens, file.name), null, 2), 'application/json')
    showToast({ message: t('mask.keySaved', { name: isolateText(keyFileName) }), kind: 'success' })
  }

  async function restoreAndDownload() {
    if (!maskedFile || !keyFile) return
    setIsWorking(true)
    setRestoreMessage(null)
    try {
      const readResult = await readMaskSource(maskedFile, locale)
      if ('error' in readResult) {
        setRestoreMessage({ kind: 'error', text: readResult.error })
        return
      }
      const response = await workerRef.current!.request({ type: 'restore', source: readResult.source, keyText: await keyFile.text() })
      if (response.type !== 'restored') {
        setRestoreMessage({ kind: 'error', text: response.type === 'error' && response.reason === 'key' ? t('mask.restore.badKey') : describeWorkerError(response) })
        return
      }
      const target = getFileFormat(maskedFile.name)
      const fileName = buildOutputFileName(maskedFile.name.replace(/-masked(?=\.[^.]+$)/, ''), 'restored', target)
      const outputFile = await buildOutputFile(response.document, target, fileName, 0, locale)
      if ('error' in outputFile) {
        setRestoreMessage({ kind: 'error', text: outputFile.error })
        return
      }
      downloadTextFile(fileName, outputFile, outputFile.type)
      const doneText = t('mask.restore.done', { count: response.restoredCount, name: isolateText(fileName) })
      setRestoreMessage({ kind: 'success', text: response.unknownTokenCount > 0 ? `${doneText} ${t('mask.restore.unknown', { count: response.unknownTokenCount })}` : doneText })
    } catch {
      setRestoreMessage({ kind: 'error', text: t('mask.error.failed') })
    } finally {
      setIsWorking(false)
    }
  }

  // "Email · High", with the reason and examples as its tooltip.
  function renderFindingTag(finding: Finding) {
    const reason = t(`mask.reason.${finding.reason}`, { percent: finding.matchPercent })
    const examples = finding.examples.length > 0 ? ` ${t('mask.examples')} ${finding.examples.join(', ')}` : ''
    return (
      <span className={`mw-tag${finding.confidence === 'low' ? ' low' : ''}`} title={reason + examples} data-confidence={finding.confidence}>
        {t(`mask.category.${finding.category}`)} · {t(`mask.level.${finding.confidence}`)}
      </span>
    )
  }

  const normalizedQuery = pickerQuery.trim().toLowerCase()
  const columnPicker = (
    <div className="mw-picker" ref={pickerRef}>
      <button id="mask-columns-button" type="button" className={buttonClasses.outline} title={t('mask.columnsTip')} aria-haspopup="true" aria-expanded={isPickerOpen} aria-controls="mask-columns-list" onClick={() => setIsPickerOpen(!isPickerOpen)}>
        {t('mask.columnsButton', { count: selectedFields.length, total: fields.length })}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico"><path d={CHEVRON_ICON_PATH} /></svg>
      </button>
      {isPickerOpen && (
        <div id="mask-columns-list" className="mw-picker-list" role="group" aria-label={t('mask.step.choose')}>
          {fields.length > SEARCHABLE_FIELD_COUNT && (
            <input id="mask-columns-search" type="search" className="mw-picker-search" placeholder={t('mask.searchColumns')} aria-label={t('mask.searchColumns')} value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} />
          )}
          {fields.map((field, fieldIndex) => {
            if (normalizedQuery && !field.label.toLowerCase().includes(normalizedQuery)) return null
            const finding = findingsById.get(field.fieldId)
            const startsSheet = field.sheetName && field.sheetName !== fields[fieldIndex - 1]?.sheetName
            return (
              <div key={field.fieldId}>
                {startsSheet && <p className="mw-picker-sheet">{field.sheetName}</p>}
                <label htmlFor={`mask-field-${fieldIndex + 1}-checkbox`} className="mw-picker-item">
                  <input id={`mask-field-${fieldIndex + 1}-checkbox`} type="checkbox" checked={fieldChoices[field.fieldId]?.isSelected ?? false} onChange={(event) => updateFieldChoice(field.fieldId, { isSelected: event.target.checked })} />
                  <bdi className="mw-picker-name">{fieldLabel(field)}</bdi>
                  {finding && renderFindingTag(finding)}
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const chosenFieldRows = (
    <div id="mask-chosen-fields" className="mw-rows">
      {selectedFields.length === 0 && <p className="mw-empty">{fields.length === 0 ? t('mask.noFields') : t('mask.noColumns')}</p>}
      {fields.map((field, fieldIndex) => {
        const choice = fieldChoices[field.fieldId]
        if (!choice?.isSelected) return null
        const rowId = `mask-field-${fieldIndex + 1}`
        const finding = findingsById.get(field.fieldId)
        const label = isolateText(fieldLabel(field))
        return (
          <div key={field.fieldId} id={rowId} data-category={choice.category} className="mw-row">
            <span className="mw-row-name" title={fieldLabel(field)}>
              <bdi>{fieldLabel(field)}</bdi>
              {(field.sheetName || finding) && (
                <span className="mw-row-sheet">
                  {field.sheetName}
                  {field.sheetName && finding && ' · '}
                  {finding && t(`mask.level.${finding.confidence}`)}
                </span>
              )}
            </span>
            <span className="mw-select-wrap">
              <select id={`${rowId}-type`} className="mw-select" aria-label={t('mask.typeLabel', { field: label })} title={t('mask.typeLabel', { field: fieldLabel(field) })} value={choice.category} disabled={isTextFile} onChange={(event) => updateFieldChoice(field.fieldId, { category: event.target.value as MaskCategory })}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{t(`mask.category.${category}`)}</option>
                ))}
              </select>
              {SELECT_CHEVRON}
            </span>
            <span className="mw-select-wrap">
              <select id={`${rowId}-strategy`} className="mw-select" aria-label={t('mask.strategyLabel', { field: label })} title={t('mask.strategyLabel', { field: fieldLabel(field) })} value={choice.strategy} onChange={(event) => updateFieldChoice(field.fieldId, { strategy: event.target.value as MaskStrategy })}>
                {STRATEGIES.filter((strategy) => !(isTextFile && strategy === 'remove')).map((strategy) => (
                  <option key={strategy} value={strategy}>{t(strategyLabelKey(choice.category, strategy))}</option>
                ))}
              </select>
              {SELECT_CHEVRON}
            </span>
            <button id={`${rowId}-remove`} type="button" className={`${buttonClasses.icon} mw-remove`} aria-label={t('mask.removeRow', { field: label })} title={t('mask.removeRow', { field: label })} onClick={() => updateFieldChoice(field.fieldId, { isSelected: false })}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico"><path d={CLOSE_ICON_PATH} /></svg>
            </button>
          </div>
        )
      })}
    </div>
  )

  const stepContent =
    step === 1 ? (
      <div className="mw-stack">
        {!isTextFile && columnPicker}
        {findingsById.size === 0 && fields.length > 0 && !isTextFile && <p className="mw-muted mw-small">{t('mask.noFindings')}</p>}
        {chosenFieldRows}
      </div>
    ) : step === 2 ? (
      <div className="mw-stack">
        <div className="flex flex-wrap items-center gap-2">
          <div id="mask-preview-view" role="group" aria-label={t('mask.previewView')} className="mw-segmented">
            {(['after', 'before'] as const).map((view) => (
              <button key={view} id={`mask-preview-${view}-button`} type="button" aria-pressed={previewView === view} title={t(view === 'after' ? 'mask.afterTip' : 'mask.beforeTip')} onClick={() => setPreviewView(view)}>
                {t(view === 'after' ? 'mask.after' : 'mask.before')}
              </button>
            ))}
          </div>
          {scanState.status === 'ready' && scanState.sheetNames.length > 1 && (
            <span className="mw-select-wrap">
              <select id="mask-preview-sheet-select" className="mw-select" aria-label={t('mask.previewSheet')} title={t('mask.previewSheet')} value={previewSheetIndex} onChange={(event) => setPreviewSheetIndex(Number(event.target.value))}>
                {scanState.sheetNames.map((sheetName, sheetIndex) => (
                  <option key={sheetIndex} value={sheetIndex}>{sheetName}</option>
                ))}
              </select>
              {SELECT_CHEVRON}
            </span>
          )}
          <span className="mw-muted mw-small">{t('mask.previewHeading', { count: PREVIEW_ROW_COUNT })}</span>
        </div>
        {preview && <PreviewGrid preview={preview} view={previewView} />}
      </div>
    ) : (
      <div className="mw-stack">
        <div className="mw-formats">
          {outputFormats.map((target, position) => (
            <button key={target} id={`download-masked-${target}-button`} type="button" aria-label={t(DOWNLOAD_LABELS[target])} title={isWorking ? t('mask.working') : t('mask.downloadTip', { name: buildOutputFileName(file?.name ?? '', 'masked', target) })} disabled={isWorking} onClick={() => void downloadMaskedFile(target)} className={position === 0 ? buttonClasses.primary : buttonClasses.outline}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico"><path d={DOWNLOAD_ICON_PATH} /></svg>
              {DOWNLOAD_NAMES[target]}
            </button>
          ))}
        </div>
        <label htmlFor="mask-key-checkbox" className="flex items-center gap-2 font-medium">
          <input id="mask-key-checkbox" type="checkbox" checked={createsKey} onChange={(event) => setCreatesKey(event.target.checked)} />
          {t('mask.keyOption')}
        </label>
        {createsKey && (
          <>
            <p id="mask-key-warning" className="mw-small mw-danger">{t('mask.keyWarning')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button id="download-mask-key-button" type="button" disabled={isWorking || !lastTokens} title={lastTokens ? t('mask.keyTip') : t('mask.keyHint')} onClick={downloadKey} className={buttonClasses.outline}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico"><path d={DOWNLOAD_ICON_PATH} /></svg>
                {t('mask.downloadKey')}
              </button>
              {!lastTokens && <span id="mask-key-hint" className="mw-muted mw-small">{t('mask.keyHint')}</span>}
            </div>
          </>
        )}
        {isWorking && <p id="mask-working-status" role="status" className="mw-muted mw-small">{t('mask.working')}</p>}
      </div>
    )

  const isReady = scanState.status === 'ready' && file !== null
  return (
    <div
      id="mask-tool"
      ref={panelRef}
      className={`mask-workbench ${isDrawer ? 'mask-drawer' : 'mask-page'}`}
      role={isDrawer ? 'dialog' : 'region'}
      aria-modal={isDrawer ? false : undefined}
      aria-labelledby="mask-title"
    >
      <div className="mw-head">
        <h2 id="mask-title" className="mw-title">{t('mask.title')}</h2>
        {file && <bdi className="mw-file">{file.name}</bdi>}
        <span className="mw-spacer" />
        <div id="mask-tabs" role="tablist" aria-label={t('mask.tabs')} className="mw-segmented">
          <button id="mask-tab" type="button" role="tab" aria-selected={activeTab === 'mask'} aria-controls="mask-panel" title={t('mask.tab.maskTip')} onClick={() => setActiveTab('mask')}>
            {t('mask.tab.mask')}
          </button>
          <button id="restore-tab" type="button" role="tab" aria-selected={activeTab === 'restore'} aria-controls="restore-panel" title={t('mask.tab.restoreTip')} onClick={() => setActiveTab('restore')}>
            {t('mask.tab.restore')}
          </button>
        </div>
        {isDrawer && (
          <button id="mask-close-button" type="button" className={buttonClasses.icon} aria-label={t('mask.close')} title={t('mask.closeTip')} onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico"><path d={CLOSE_ICON_PATH} /></svg>
          </button>
        )}
      </div>

      {activeTab === 'mask' ? (
        <>
          {isReady && (
            <nav id="mask-steps" aria-label={t('mask.steps')} className="mw-bar">
              <ol className="mw-segmented m-0 list-none p-0.5">
                {STEPS.map(({ step: listedStep, labelKey }) => (
                  <li key={listedStep}>
                    <button id={`mask-step-${listedStep}-button`} type="button" aria-current={step === listedStep ? 'step' : undefined} title={t('mask.stepTip', { step: listedStep, name: t(labelKey) })} onClick={() => setStep(listedStep)}>
                      <span aria-hidden="true" className="mw-step-number">{listedStep}</span>
                      {t(labelKey)}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div id="mask-panel" role="tabpanel" aria-labelledby="mask-tab" className="mw-body mw-stack">
            <p id="mask-warning" className="mw-warning">{t('mask.warning')}</p>
            {scanState.status === 'idle' && <p id="mask-choose-first" className="mw-muted">{t('mask.chooseFirst')}</p>}
            {scanState.status === 'scanning' && file && (
              <p id="mask-status" role="status" className="mw-muted">
                {t('mask.scanning', { name: isolateText(file.name), percent: scanState.percent })}
              </p>
            )}
            <Notice id="mask-error" kind="error" role="alert" className="mw-danger font-medium" message={scanState.status === 'error' ? scanState.message : errorMessage} />
            {isReady && stepContent}
          </div>
          {isReady && (
            <div className="mw-foot">
              <span id="mask-selected-count" className="mw-muted mw-small">{t('mask.selectedCount', { count: selectedFields.length, total: fields.length })}</span>
              <span className="mw-spacer" />
              {step > 1 && (
                <button id="mask-back-button" type="button" className={buttonClasses.outline} title={t('mask.backTip', { name: t(STEPS[step - 2].labelKey) })} onClick={() => setStep((step - 1) as MaskStep)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico mw-flip"><path d={BACK_ICON_PATH} /></svg>
                  {t('mask.back')}
                </button>
              )}
              {step < 3 && (
                <button id="mask-next-button" type="button" className={buttonClasses.primary} title={t('mask.nextTip', { name: t(STEPS[step].labelKey) })} onClick={() => setStep((step + 1) as MaskStep)}>
                  {t(step === 1 ? 'mask.next.review' : 'mask.next.download')}
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="mw-ico mw-flip"><path d={NEXT_ICON_PATH} /></svg>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div id="restore-panel" role="tabpanel" aria-labelledby="restore-tab" className="mw-body mw-stack">
          <p className="mw-muted">{t('mask.restore.lead')}</p>
          <label htmlFor="restore-file-input" className="block">
            <span className="mw-label">{t('mask.restore.file')}</span>
            <input id="restore-file-input" type="file" accept=".csv,.tsv,.tab,.json,.xlsx,.xls,.xlsm,.ods,.txt" onChange={(event) => setMaskedFile(event.target.files?.[0] ?? null)} className="mw-file-input mt-1" />
          </label>
          <label htmlFor="restore-key-input" className="block">
            <span className="mw-label">{t('mask.restore.key')}</span>
            <input id="restore-key-input" type="file" accept=".json" onChange={(event) => setKeyFile(event.target.files?.[0] ?? null)} className="mw-file-input mt-1" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button id="restore-button" type="button" disabled={!maskedFile || !keyFile || isWorking} title={!maskedFile || !keyFile ? t('mask.restore.needBoth') : t('mask.restore.tip')} onClick={() => void restoreAndDownload()} className={buttonClasses.primary}>
              {t('mask.restore.button')}
            </button>
            {isWorking && <span id="restore-status" role="status" className="mw-muted mw-small">{t('mask.restore.working')}</span>}
          </div>
          <Notice id="restore-message" kind={restoreMessage?.kind ?? 'info'} role={restoreMessage?.kind === 'error' ? 'alert' : 'status'} className={restoreMessage?.kind === 'error' ? 'mw-danger font-medium' : 'font-medium'} message={restoreMessage?.text ?? ''} />
        </div>
      )}
    </div>
  )
}
