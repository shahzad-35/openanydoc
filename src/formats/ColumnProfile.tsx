// The column profile, shared by the CSV and Excel viewers: a column's counts, its spread (numbers), rows per week (dates) or most
// common values (text), with the charts drawn as plain SVG. Its look is in sheetChrome.css, which both viewers load.
/* oxlint-disable react/only-export-components */
import { useT } from '../i18n'
import type { Locale } from '../i18n'
import { buildHistogram, countRowsPerWeek, summarizeNumbers } from './csv/csvAnalysis'
import type { ColumnProfile, ColumnType } from './csv/csvAnalysis'

export function formatNumber(number: number | null | undefined, decimals: number) {
  if (number === null || number === undefined || Number.isNaN(number)) return '—'
  return number.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatShortDate(text: string, locale: Locale) {
  const time = Date.parse(text.slice(0, 10))
  if (Number.isNaN(time)) return text
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(time)
}

export function HistogramChart({ numbers, decimals, columnName, activeRange, onBinClick }: { numbers: number[]; decimals: number; columnName: string; activeRange?: { min: number | null; max: number | null }; onBinClick?: (from: number, to: number) => void }) {
  const { t } = useT()
  const bins = buildHistogram(numbers, 10)
  if (bins.length === 0) return null
  const width = 320
  const height = 96
  const tallest = Math.max(...bins.map((bin) => bin.count))
  const binWidth = (width - 8) / bins.length
  const min = bins[0].from
  const max = bins[bins.length - 1].to
  return (
    <svg className="hist" viewBox={`0 0 ${width} ${height + 18}`} role="img" aria-label={t('csv.wb.histogramLabel', { name: columnName, from: formatNumber(min, decimals), to: formatNumber(max, decimals) })}>
      {bins.map((bin, binPosition) => {
        const barHeight = bin.count ? Math.max(3, (bin.count / tallest) * (height - 14)) : 0
        const isInRange = !activeRange || ((activeRange.min === null || bin.to >= activeRange.min) && (activeRange.max === null || bin.from <= activeRange.max))
        return (
          <g key={binPosition} onClick={onBinClick ? () => onBinClick(bin.from, bin.to) : undefined} style={onBinClick ? { cursor: 'pointer' } : undefined}>
            <rect className={`b${isInRange ? ' in' : ''}`} x={4 + binPosition * binWidth + 1.5} y={height - barHeight} width={binWidth - 3} height={barHeight} rx="2">
              <title>{t('csv.wb.histogramBin', { from: formatNumber(bin.from, decimals), to: formatNumber(bin.to, decimals), count: bin.count })}</title>
            </rect>
            {bin.count > 0 && (
              <text x={4 + binPosition * binWidth + binWidth / 2} y={height - barHeight - 3} textAnchor="middle">
                {bin.count}
              </text>
            )}
          </g>
        )
      })}
      <line className="axis" x1="4" x2={width - 4} y1={height + 0.5} y2={height + 0.5} />
      <text x="4" y={height + 13}>
        {formatNumber(min, decimals)}
      </text>
      <text x={width / 2} y={height + 13} textAnchor="middle">
        {formatNumber(min + (max - min) / 2, decimals)}
      </text>
      <text x={width - 4} y={height + 13} textAnchor="end">
        {formatNumber(max, decimals)}
      </text>
    </svg>
  )
}

function WeekChart({ dateTexts, locale }: { dateTexts: string[]; locale: Locale }) {
  const { t } = useT()
  const weekCounts = countRowsPerWeek(dateTexts)
  if (weekCounts.length === 0) return null
  const width = 320
  const height = 80
  const tallest = Math.max(...weekCounts)
  const barWidth = (width - 8) / weekCounts.length
  const sorted = [...dateTexts].sort()
  return (
    <svg className="hist" viewBox={`0 0 ${width} ${height + 18}`} role="img" aria-label={t('csv.wb.rowsPerWeek')}>
      {weekCounts.map((count, week) => {
        const barHeight = count ? Math.max(3, (count / tallest) * (height - 14)) : 0
        return (
          <g key={week}>
            <rect className="b in" x={4 + week * barWidth + 2} y={height - barHeight} width={Math.max(1, barWidth - 4)} height={barHeight} rx="2">
              <title>{t('csv.wb.weekBar', { week: week + 1, count })}</title>
            </rect>
            {count > 0 && (
              <text x={4 + week * barWidth + barWidth / 2} y={height - barHeight - 3} textAnchor="middle">
                {count}
              </text>
            )}
          </g>
        )
      })}
      <line className="axis" x1="4" x2={width - 4} y1={height + 0.5} y2={height + 0.5} />
      <text x="4" y={height + 13}>
        {formatShortDate(sorted[0], locale)}
      </text>
      <text x={width - 4} y={height + 13} textAnchor="end">
        {formatShortDate(sorted[sorted.length - 1], locale)}
      </text>
    </svg>
  )
}

type ColumnProfileViewProps = {
  // The column's values, one per shown row, and their profile (buildColumnProfile).
  texts: readonly string[]
  profile: ColumnProfile
  type: ColumnType
  decimals: number
  columnName: string
  // The column's range filter, if any: bars outside it are drawn dimmed.
  activeRange?: { min: number | null; max: number | null }
  // A click on a bar filters the column to that range; a click on a top value shows only the rows with it.
  onRangeClick: (from: number, to: number) => void
  onValueClick: (value: string) => void
}

// The stats and the chart of one column.
export function ColumnProfileView({ texts, profile, type, decimals, columnName, activeRange, onRangeClick, onValueClick }: ColumnProfileViewProps) {
  const { locale, t } = useT()
  const numberSummary = summarizeNumbers(profile.numbers)
  const statItems: [string, string][] = [
    [t('csv.wb.count'), profile.filledCount.toLocaleString('en-US')],
    [t('csv.wb.blanks'), profile.blankCount.toLocaleString('en-US')],
    [t('csv.wb.distinct'), profile.distinctCount.toLocaleString('en-US')],
    ...(type === 'number'
      ? ([
          [t('csv.wb.min'), formatNumber(numberSummary?.min, decimals)],
          [t('csv.wb.max'), formatNumber(numberSummary?.max, decimals)],
          [t('csv.wb.mean'), formatNumber(numberSummary?.mean, 2)],
        ] as [string, string][])
      : type === 'date'
        ? ([
            [t('csv.wb.earliest'), profile.dates ? formatShortDate(profile.dates.first, locale) : '—'],
            [t('csv.wb.latest'), profile.dates ? formatShortDate(profile.dates.last, locale) : '—'],
          ] as [string, string][])
        : []),
  ]
  const topMax = profile.topValues[0]?.[1] ?? 1
  return (
    <>
      <div className="sec">
        <div className="stats">
          {statItems.map(([label, value]) => (
            <div key={label} className="stat">
              <div className="l">{label}</div>
              <div className="v" title={value}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="sec-title">{type === 'number' ? t('csv.wb.distribution') : type === 'date' ? t('csv.wb.rowsPerWeek') : t('csv.wb.topValues')}</div>
        {type === 'number' && <HistogramChart numbers={profile.numbers} decimals={decimals} columnName={columnName} activeRange={activeRange} onBinClick={onRangeClick} />}
        {type === 'date' && <WeekChart dateTexts={texts.filter((text) => text !== '')} locale={locale} />}
        {(type === 'text' || type === 'bool') && (
          <ul className="top-list">
            {profile.topValues.length === 0 && <li className="empty-value">{t('csv.wb.noValues')}</li>}
            {profile.topValues.map(([value, count], position) => (
              <li key={value}>
                <button className="tv" id={`top-value-${position}`} type="button" title={t('csv.wb.showOnlyValue', { name: columnName, value })} onClick={() => onValueClick(value)}>
                  <span className="fillbar" style={{ width: `${((count / topMax) * 100).toFixed(1)}%` }} />
                  <span dir="auto">{type === 'bool' ? (value.toLowerCase() === 'true' ? t('csv.wb.yesTrue') : t('csv.wb.noFalse')) : value}</span>
                </button>
                <span className="c">{count.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
