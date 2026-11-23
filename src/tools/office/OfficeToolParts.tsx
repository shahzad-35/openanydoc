/* oxlint-disable react/only-export-components */
// What the Word, Excel and PowerPoint tools share: running a task with an error line, the tool's layout (hint, chosen files,
// options, button), and the metadata page, which is the same for the three formats.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import JSZip from 'jszip'
import { useT } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { Notice } from '../../components/Messages'
import type { ToolProps } from '../registry'
import { EXCEL_TYPE, POWERPOINT_TYPE, WORD_TYPE, isCompoundFile, packageToFile, readOfficeProperties, removeOfficeMetadata } from './officePackage'
import type { OfficeProperties } from './officePackage'

export const fieldClass = 'control-shape min-h-11 border-2 border-rule bg-paper-raised px-3 text-ink'
export const panelClass = 'space-y-3 rounded-[22px] border-2 border-rule bg-paper-raised p-5 text-start'

// A problem the visitor can act on ("this file needs a password to open"), shown with its own message.
export class OfficeToolProblem extends Error {
  readonly messageKey: MessageKey
  constructor(messageKey: MessageKey) {
    super(messageKey)
    this.messageKey = messageKey
  }
}

// Opens an Office file as a package, with a clear message for an old or encrypted file.
export async function openOfficePackage(file: File) {
  const bytes = await file.arrayBuffer()
  if (isCompoundFile(bytes)) throw new OfficeToolProblem('office.compoundFile')
  try {
    return await JSZip.loadAsync(bytes)
  } catch {
    throw new OfficeToolProblem('office.notOffice')
  }
}

const TYPE_BY_EXTENSION: Record<string, string> = { docx: WORD_TYPE, xlsx: EXCEL_TYPE, pptx: POWERPOINT_TYPE }
export const officeTypeOf = (fileName: string) => TYPE_BY_EXTENSION[fileName.toLowerCase().split('.').pop() ?? ''] ?? 'application/octet-stream'

export function useOfficeTask() {
  const [isWorking, setIsWorking] = useState(false)
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null)
  async function run(task: () => Promise<void>) {
    setErrorKey(null)
    setIsWorking(true)
    try {
      await task()
    } catch (error) {
      setErrorKey(error instanceof OfficeToolProblem ? error.messageKey : 'office.failed')
    } finally {
      setIsWorking(false)
    }
  }
  return { run, isWorking, errorKey, setErrorKey }
}

export function OfficeToolLayout({ toolId, hintKey, files, task, buttonKey, canRun = true, onRun, children }: { toolId: string; hintKey: MessageKey; files: File[]; task: ReturnType<typeof useOfficeTask>; buttonKey: MessageKey; canRun?: boolean; onRun: () => void; children?: ReactNode }) {
  const { t } = useT()
  return (
    <div id={`${toolId}-tool`} className="space-y-4">
      <p className="text-center text-sm text-ink-soft">{t(hintKey)}</p>
      {files.length > 0 && (
        <p className="text-center font-medium">
          {files.map((file, position) => (
            <bdi key={position} className="block">
              {file.name}
            </bdi>
          ))}
        </p>
      )}
      {children}
      <div className="flex justify-center">
        <button id={`${toolId}-button`} type="button" disabled={task.isWorking || !canRun} onClick={onRun} className="btn btn--primary press">
          {task.isWorking ? t('tools.working') : t(buttonKey)}
        </button>
      </div>
      <Notice id="tool-error" kind="error" role="alert" className="text-center font-medium text-danger" message={task.errorKey ? t(task.errorKey) : ''} />
    </div>
  )
}

const PROPERTY_LABELS: [keyof OfficeProperties, MessageKey][] = [
  ['title', 'office.metadata.title'],
  ['subject', 'office.metadata.subject'],
  ['author', 'office.metadata.author'],
  ['keywords', 'office.metadata.keywords'],
  ['lastModifiedBy', 'office.metadata.lastModifiedBy'],
  ['created', 'office.metadata.created'],
  ['modified', 'office.metadata.modified'],
  ['revision', 'office.metadata.revision'],
  ['application', 'office.metadata.application'],
  ['company', 'office.metadata.company'],
  ['manager', 'office.metadata.manager'],
]

// Word, Excel or PowerPoint metadata: the document's properties shown, then removed in a copy.
export function OfficeMetadata({ files, onResult, toolId }: ToolProps & { toolId: string }) {
  const { t } = useT()
  const task = useOfficeTask()
  const file = files[0]
  const [shown, setShown] = useState<{ file: File; properties: OfficeProperties } | null>(null)
  const { setErrorKey } = task
  useEffect(() => {
    let isCurrent = true
    openOfficePackage(file)
      .then(readOfficeProperties)
      .then((properties) => isCurrent && setShown({ file, properties }))
      .catch((error: unknown) => isCurrent && setErrorKey(error instanceof OfficeToolProblem ? error.messageKey : 'office.failed'))
    return () => {
      isCurrent = false
    }
  }, [file, setErrorKey])
  const properties = shown?.file === file ? shown.properties : null
  const filledFields = properties ? PROPERTY_LABELS.filter(([field]) => properties[field] !== '') : []
  return (
    <OfficeToolLayout
      toolId={toolId}
      hintKey="office.metadata.hint"
      files={files}
      task={task}
      buttonKey="office.metadata.button"
      canRun={properties !== null}
      onRun={() =>
        void task.run(async () => {
          const zip = await openOfficePackage(file)
          await removeOfficeMetadata(zip)
          onResult(await packageToFile(zip, file.name, officeTypeOf(file.name)))
        })
      }
    >
      {properties && (
        <div id={`${toolId}-properties`} className={panelClass}>
          {filledFields.length === 0 && properties.customCount === 0 ? (
            <p id={`${toolId}-none`}>{t('office.metadata.none')}</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {filledFields.map(([field, labelKey]) => (
                <div key={field} className="contents">
                  <dt className="font-medium">{t(labelKey)}</dt>
                  <dd dir="auto" className="break-words text-ink-soft">
                    {properties[field]}
                  </dd>
                </div>
              ))}
              {properties.customCount > 0 && (
                <>
                  <dt className="font-medium">{t('office.metadata.custom')}</dt>
                  <dd className="text-ink-soft">{properties.customCount}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}
    </OfficeToolLayout>
  )
}

// ---------------------------------------------------------------- Watermark options (Word and PowerPoint)

export type WatermarkColor = 'silver' | 'red' | 'blue'
export type WatermarkLayout = 'diagonal' | 'horizontal'

export function WatermarkFields({ idPrefix, text, onTextChange, color, onColorChange, layout, onLayoutChange }: { idPrefix: string; text: string; onTextChange: (text: string) => void; color: WatermarkColor; onColorChange: (color: WatermarkColor) => void; layout: WatermarkLayout; onLayoutChange: (layout: WatermarkLayout) => void }) {
  const { t } = useT()
  return (
    <div className="flex flex-wrap items-end justify-center gap-4 text-start">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('office.watermark.text')}
        <input id={`${idPrefix}-text-input`} dir="auto" maxLength={60} value={text} onChange={(event) => onTextChange(event.target.value)} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('office.watermark.color')}
        <select id={`${idPrefix}-color-select`} value={color} onChange={(event) => onColorChange(event.target.value as WatermarkColor)} className={fieldClass}>
          <option value="silver">{t('office.watermark.silver')}</option>
          <option value="red">{t('office.watermark.red')}</option>
          <option value="blue">{t('office.watermark.blue')}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('office.watermark.layout')}
        <select id={`${idPrefix}-layout-select`} value={layout} onChange={(event) => onLayoutChange(event.target.value as WatermarkLayout)} className={fieldClass}>
          <option value="diagonal">{t('office.watermark.diagonal')}</option>
          <option value="horizontal">{t('office.watermark.horizontal')}</option>
        </select>
      </label>
    </div>
  )
}
