import { useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { useT } from '../../i18n'
import { KitIcon, MiniFormatIcon } from '../KitIcon'
import { NOTES_LINES, PRODUCTS_JSON, SALES_COLUMNS, SALES_ROWS, sampleFiles } from './sampleFiles'
import type { SampleFile } from './sampleFiles'

// The drag type of a sample chip. A real file has the type "Files" instead and is left to the page, which opens the real viewer.
const SAMPLE_DRAG_TYPE = 'application/x-openanydoc-sample'
const NOTES_WORD_COUNT = NOTES_LINES.join(' ').split(/\s+/).filter(Boolean).length

// The chip flies into the drop box and back while the mini viewer appears. Skipped when the visitor asked for less motion.
function flyChipIntoTarget(chip: HTMLElement | undefined, target: HTMLElement | null) {
  if (!chip || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const from = chip.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  chip.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.2 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ],
    { duration: 520, easing: 'ease-in-out' },
  )
}

function JsonValue({ value }: { value: unknown }): ReactNode {
  if (value === null) return <span className="b">null</span>
  if (typeof value === 'string') return <span className="s">"{value}"</span>
  if (typeof value === 'number') return <span className="n">{value}</span>
  if (typeof value === 'boolean') return <span className="b">{String(value)}</span>
  const entries = Array.isArray(value) ? value.map((item) => [null, item] as const) : Object.entries(value as Record<string, unknown>)
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return (
    <>
      <span className="p">{open}</span>
      <div className="demo-indent">
        {entries.map(([key, item], position) => (
          <div key={key ?? position}>
            {key !== null && (
              <>
                <span className="k">"{key}"</span>
                <span className="p">: </span>
              </>
            )}
            <JsonValue value={item} />
            {position < entries.length - 1 && <span className="p">,</span>}
          </div>
        ))}
      </div>
      <span className="p">{close}</span>
    </>
  )
}

function SampleViewerBody({ sample }: { sample: SampleFile }) {
  if (sample.id === 'csv') {
    return (
      <div className="demo-scroll">
        <table className="demo-table" dir="ltr">
          <thead>
            <tr>
              {SALES_COLUMNS.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SALES_ROWS.map((row) => (
              <tr key={row.join()}>
                {row.map((cell, position) => (
                  <td key={position}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (sample.id === 'json') {
    return (
      <div className="demo-scroll">
        <pre className="demo-code">
          <JsonValue value={PRODUCTS_JSON} />
        </pre>
      </div>
    )
  }
  return (
    <div className="demo-scroll">
      <ol className="demo-lines">
        {NOTES_LINES.map((line, position) => (
          <li key={position}>
            <span>{line === '' ? ' ' : line}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// The hero demo: three made-up files to drag into a box, which then shows a small read-only viewer. Works with a mouse (drag),
// a keyboard (Enter picks a file up, Enter on the box drops it, arrows switch files, Escape puts it back) and touch (tap, tap).
// Everything in it is simulated; a real file dropped anywhere on the page, the box included, opens the real viewer.
export default function DemoStage() {
  const { t } = useT()
  const [focusedSampleId, setFocusedSampleId] = useState<SampleFile['id']>(sampleFiles[0].id)
  const [liftedSample, setLiftedSample] = useState<SampleFile | null>(null)
  const [openedSample, setOpenedSample] = useState<SampleFile | null>(null)
  const [isOverTarget, setIsOverTarget] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const chipRefs = useRef(new Map<SampleFile['id'], HTMLButtonElement>())
  const targetRef = useRef<HTMLDivElement>(null)

  const summaryFor = (sample: SampleFile) => (sample.id === 'txt' ? t('demo.summary.txt', { words: NOTES_WORD_COUNT }) : t(`demo.summary.${sample.id}`))

  function liftSample(sample: SampleFile) {
    setLiftedSample(sample)
    setFocusedSampleId(sample.id)
    setAnnouncement(t('demo.pickedUp', { name: sample.name }))
  }

  function putBack() {
    if (!liftedSample) return
    setAnnouncement(t('demo.putBack', { name: liftedSample.name }))
    setLiftedSample(null)
    setIsOverTarget(false)
  }

  function openSample(sample: SampleFile) {
    flyChipIntoTarget(chipRefs.current.get(sample.id), targetRef.current)
    setLiftedSample(null)
    setIsOverTarget(false)
    setOpenedSample(sample)
    setAnnouncement(t('demo.opened', { name: sample.name, summary: summaryFor(sample) }))
  }

  function resetDemo() {
    const sample = openedSample
    setOpenedSample(null)
    setAnnouncement(t('demo.resetDone'))
    if (sample) requestAnimationFrame(() => chipRefs.current.get(sample.id)?.focus())
  }

  // Arrows move between the chips (and move the picked-up file with them); Escape puts a picked-up file back.
  function handleChipKeyDown(event: KeyboardEvent<HTMLButtonElement>, sample: SampleFile) {
    if (event.key === 'Escape') {
      if (liftedSample) {
        event.preventDefault()
        putBack()
      }
      return
    }
    const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl'
    const position = sampleFiles.indexOf(sample)
    let nextPosition: number
    if (event.key === 'ArrowRight') nextPosition = position + (isRightToLeft ? -1 : 1)
    else if (event.key === 'ArrowLeft') nextPosition = position + (isRightToLeft ? 1 : -1)
    else if (event.key === 'ArrowDown') nextPosition = position + 1
    else if (event.key === 'ArrowUp') nextPosition = position - 1
    else return
    event.preventDefault()
    const nextSample = sampleFiles[(nextPosition + sampleFiles.length) % sampleFiles.length]
    setFocusedSampleId(nextSample.id)
    if (liftedSample) liftSample(nextSample)
    chipRefs.current.get(nextSample.id)?.focus()
  }

  function handleTargetKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!liftedSample) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openSample(liftedSample)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      putBack()
    }
  }

  const isSampleDrag = (event: DragEvent) => event.dataTransfer.types.includes(SAMPLE_DRAG_TYPE)

  function handleTargetDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isSampleDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setIsOverTarget(true)
  }

  function handleTargetDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOverTarget(false)
  }

  function handleTargetDrop(event: DragEvent<HTMLDivElement>) {
    if (!isSampleDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    const sample = sampleFiles.find((candidate) => candidate.id === event.dataTransfer.getData(SAMPLE_DRAG_TYPE))
    if (sample) openSample(sample)
  }

  return (
    <section id="demo-stage" aria-labelledby="demo-heading" className="demo-stage hero-in p-5 sm:p-8 lg:p-10">
      <h2 id="demo-heading" className="sr-only">{t('demo.heading')}</h2>
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-10">
        <div>
          <p className="text-sm font-semibold text-ink-soft">{t('demo.dragThis')}</p>
          <ul aria-label={t('demo.samplesLabel')} className="mt-3 flex flex-wrap gap-3 md:flex-col md:items-start">
            {sampleFiles.map((sample) => (
              <li key={sample.id}>
                <button
                  id={`demo-sample-${sample.id}`}
                  ref={(element) => {
                    if (element) chipRefs.current.set(sample.id, element)
                    else chipRefs.current.delete(sample.id)
                  }}
                  type="button"
                  draggable
                  tabIndex={sample.id === focusedSampleId ? 0 : -1}
                  aria-pressed={liftedSample?.id === sample.id}
                  aria-describedby="demo-chip-hint"
                  className="demo-chip press"
                  onClick={() => (liftedSample?.id === sample.id ? putBack() : liftSample(sample))}
                  onKeyDown={(event) => handleChipKeyDown(event, sample)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(SAMPLE_DRAG_TYPE, sample.id)
                    event.dataTransfer.effectAllowed = 'move'
                    liftSample(sample)
                  }}
                  onDragEnd={() => {
                    setLiftedSample(null)
                    setIsOverTarget(false)
                  }}
                >
                  <MiniFormatIcon format={sample.format} />
                  <span dir="ltr">{sample.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p id="demo-chip-hint" className="mt-4 max-w-[260px] text-sm text-ink-soft">{t('demo.chipHint')}</p>
        </div>

        <div className="min-w-0">
          {openedSample ? (
            <div id="demo-viewer" className="demo-viewer">
              <div className="demo-viewer-head">
                <MiniFormatIcon format={openedSample.format} />
                <span dir="ltr" className="font-mono text-sm font-semibold">{openedSample.name}</span>
                <span className="text-sm text-ink-soft">{summaryFor(openedSample)}</span>
                <span className="status-chip">
                  <KitIcon name="no-cloud" size={16} />
                  {t('demo.nothingUploaded')}
                </span>
                <button id="demo-reset-button" type="button" onClick={resetDemo} className="btn btn--quiet press ms-auto min-h-10 px-4 text-[15px]">
                  <KitIcon name="undo" size={18} />
                  {t('demo.reset')}
                </button>
              </div>
              <SampleViewerBody sample={openedSample} />
            </div>
          ) : (
            <div
              id="demo-target"
              ref={targetRef}
              role="button"
              tabIndex={0}
              className={`demo-target ${liftedSample ? 'is-armed' : ''} ${isOverTarget ? 'is-over' : ''}`}
              onClick={() => liftedSample && openSample(liftedSample)}
              onKeyDown={handleTargetKeyDown}
              onDragOver={handleTargetDragOver}
              onDragLeave={handleTargetDragLeave}
              onDrop={handleTargetDrop}
            >
              <KitIcon name="drop" size={40} className="text-ink-soft" />
              <p className="type-h3">{liftedSample ? t('demo.dropArmed', { name: liftedSample.name }) : t('demo.dropHere')}</p>
              <p className="text-sm text-ink-soft">{t('demo.dropSub')}</p>
            </div>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  )
}
