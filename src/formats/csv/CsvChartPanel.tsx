import { useEffect, useMemo, useRef, useState } from 'react'
import { ArcElement, BarController, BarElement, CategoryScale, Chart, Legend, LineController, LineElement, LinearScale, PieController, PointElement, Tooltip } from 'chart.js'
import { useT } from '../../i18n'
import { downloadTextFile } from '../registry'
import { compareCellTexts, groupRows, parseNumber } from './csvAnalysis'
import type { ColumnType, GroupAggregate } from './csvAnalysis'

// Only the parts the three charts need, so the chart chunk stays small (Chart.js, MIT).
Chart.register(BarController, LineController, PieController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend)

type ChartKind = 'bar' | 'line' | 'pie'
export type ChartColumn = { id: number; name: string; type: ColumnType }

const MAX_BARS = 30
const MAX_SLICES = 12

// A quick chart of the rows on screen (after filters and search): one category column, and per category the count of rows or
// the sum or average of a number column. Loaded when its panel opens; a future "CSV chart" page can use it with the same props.
export default function CsvChartPanel({ columns, rowIds, readText }: { columns: ChartColumn[]; rowIds: readonly number[]; readText: (rowId: number, columnId: number) => string }) {
  const { locale, t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const numberColumns = columns.filter((column) => column.type === 'number')
  const [chartKind, setChartKind] = useState<ChartKind>('bar')
  const [categoryColumnId, setCategoryColumnId] = useState(() => (columns.find((column) => column.type !== 'number') ?? columns[0])?.id ?? 0)
  const [aggregate, setAggregate] = useState<GroupAggregate>('count')
  // The first number column that is not an ID (order numbers make a meaningless sum).
  const [valueColumnId, setValueColumnId] = useState(() => (numberColumns.find((column) => !/(^|[\s_-])(id|no|number|code|رقم)$|^(id|رقم)([\s_-]|$)/i.test(column.name)) ?? numberColumns[0])?.id ?? null)
  const categoryType = columns.find((column) => column.id === categoryColumnId)?.type ?? 'text'
  const effectiveAggregate = valueColumnId === null ? 'count' : aggregate

  const points = useMemo(() => {
    const totals = groupRows(rowIds, (rowId) => readText(rowId, categoryColumnId), (rowId) => (valueColumnId === null ? null : parseNumber(readText(rowId, valueColumnId))), effectiveAggregate)
    // A line follows the categories' own order (numbers, dates); bars and slices show the largest first.
    if (chartKind === 'line') return [...totals].sort((first, second) => compareCellTexts(first.group, second.group, categoryType)).slice(0, MAX_BARS)
    if (chartKind === 'bar') return totals.slice(0, MAX_BARS)
    if (totals.length <= MAX_SLICES) return totals
    const otherValue = totals.slice(MAX_SLICES - 1).reduce((sum, total) => sum + total.value, 0)
    return [...totals.slice(0, MAX_SLICES - 1), { group: t('csv.chart.other'), value: otherValue }]
  }, [rowIds, readText, categoryColumnId, valueColumnId, effectiveAggregate, chartKind, categoryType, t])

  useEffect(() => {
    if (!canvasRef.current) return
    // The workbench's own colours (csvWorkbench.css), read where the chart sits, so light and dark both work.
    const style = getComputedStyle(canvasRef.current)
    const accent = style.getPropertyValue('--accent').trim() || '#3b5bfd'
    const ink = style.getPropertyValue('--text').trim() || '#1f2433'
    const rule = style.getPropertyValue('--line').trim() || '#e2e5ec'
    const isRightToLeft = locale === 'ar'
    // Slices take the format colours in turn, so neighbouring slices differ.
    const sliceColors = ['--type-csv', '--type-excel', '--type-json', '--type-text', '--type-word', '--type-powerpoint', '--type-pdf'].map((name) => style.getPropertyValue(name).trim() || accent)
    const chart = new Chart(canvasRef.current, {
      type: chartKind,
      data: {
        labels: points.map((point) => point.group || t('csv.wb.emptyValue')),
        datasets: [{ data: points.map((point) => point.value), backgroundColor: chartKind === 'pie' ? points.map((_, position) => sliceColors[position % sliceColors.length]) : accent, borderColor: chartKind === 'pie' ? '#ffffff' : accent }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        locale: `${locale}-u-nu-latn`,
        plugins: { legend: { display: chartKind === 'pie', rtl: isRightToLeft, labels: { color: ink } }, tooltip: { rtl: isRightToLeft } },
        scales: chartKind === 'pie' ? {} : { x: { reverse: isRightToLeft, ticks: { color: ink }, grid: { color: rule } }, y: { position: isRightToLeft ? 'right' : 'left', ticks: { color: ink }, grid: { color: rule } } },
      },
    })
    return () => chart.destroy()
  }, [chartKind, points, locale, t])

  // The chart as a PNG on the panel's own background (a transparent PNG shows black text on black in dark viewers).
  function downloadChartPicture() {
    const chartCanvas = canvasRef.current
    if (!chartCanvas) return
    const pictureCanvas = document.createElement('canvas')
    pictureCanvas.width = chartCanvas.width
    pictureCanvas.height = chartCanvas.height
    const context = pictureCanvas.getContext('2d')
    if (!context) return
    context.fillStyle = getComputedStyle(chartCanvas).getPropertyValue('--panel').trim() || '#ffffff'
    context.fillRect(0, 0, pictureCanvas.width, pictureCanvas.height)
    context.drawImage(chartCanvas, 0, 0)
    pictureCanvas.toBlob((pictureBlob) => pictureBlob && downloadTextFile('chart.png', pictureBlob, 'image/png'), 'image/png')
  }

  if (columns.length === 0) return <div className="empty-note">{t('csv.wb.nothingToGroup')}</div>
  return (
    <>
      <div className="sec">
        <div className="group-controls">
          <label className="field">
            {t('csv.chart.type')}
            <select id="chart-type-select" value={chartKind} onChange={(event) => setChartKind(event.target.value as ChartKind)}>
              <option value="bar">{t('csv.chart.bar')}</option>
              <option value="line">{t('csv.chart.line')}</option>
              <option value="pie">{t('csv.chart.pie')}</option>
            </select>
          </label>
          <label className="field">
            {t('csv.chart.category')}
            <select id="chart-category-select" value={categoryColumnId} onChange={(event) => setCategoryColumnId(Number(event.target.value))}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('csv.wb.show')}
            <select id="chart-value-select" value={effectiveAggregate} onChange={(event) => setAggregate(event.target.value as GroupAggregate)}>
              <option value="count">{t('csv.wb.countOfRows')}</option>
              <option value="sum" disabled={valueColumnId === null}>{t('csv.wb.sumOf')}</option>
              <option value="avg" disabled={valueColumnId === null}>{t('csv.wb.averageOf')}</option>
            </select>
          </label>
          <label className="field">
            {t('csv.wb.column')}
            <select id="chart-value-column-select" value={valueColumnId ?? ''} disabled={effectiveAggregate === 'count'} onChange={(event) => setValueColumnId(Number(event.target.value))}>
              {numberColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="sec">
        <div className="chart-box">
          <canvas id="csv-chart-canvas" ref={canvasRef} role="img" aria-label={t('csv.chart.label', { by: columns.find((column) => column.id === categoryColumnId)?.name ?? '' })} />
        </div>
        <button className="btn sm outline" id="chart-download-button" type="button" style={{ marginTop: 10 }} onClick={downloadChartPicture}>
          {t('csv.chart.downloadPng')}
        </button>
        <div className="small-note" style={{ marginTop: 8 }}>
          {t('csv.chart.note', { rows: rowIds.length })}
        </div>
      </div>
    </>
  )
}
