import { useDeferredValue, useMemo } from 'react'
import { useT } from '../../i18n'
import { summarizeGeoJson } from './jsonFormats'
import type { JsonValue } from './jsonModel'
import { formatValueText } from './jsonTools'

const MAX_SHOWN_FEATURES = 1000

// Map data, for a GeoJSON document: how many features there are, their geometry types, the area they cover and every feature's
// properties in one table. No map: drawing one would mean map tiles from another server.
export default function JsonGeoPanel({ root }: { root: JsonValue }) {
  const { t, tp } = useT()
  const deferredRoot = useDeferredValue(root)
  const summary = useMemo(() => summarizeGeoJson(deferredRoot), [deferredRoot])
  if (!summary) return <p className="empty">{t('json.geo.notGeoJson')}</p>
  const formatCoordinate = (number: number) => number.toFixed(5)
  return (
    <div id="geo-view" className="view">
      <p className="cmp-summary" id="geo-summary">
        {tp('json.geo.featureCount', summary.featureCount)}
        {' · '}
        <span dir="ltr">{summary.geometryCounts.map(([type, count]) => `${type} ${count}`).join(', ')}</span>
      </p>
      {summary.bounds && (
        <p className="cmp-hint" id="geo-bounds">
          {t('json.geo.bounds')}{' '}
          <bdi dir="ltr">
            {summary.bounds.map(formatCoordinate).join(', ')}
          </bdi>
        </p>
      )}
      {summary.propertyNames.length === 0 ? (
        <p className="empty">{t('json.geo.noProperties')}</p>
      ) : (
        <div className="query-result geo-table" dir="ltr">
          <table id="geo-properties-table">
            <thead>
              <tr>
                <th>#</th>
                {summary.propertyNames.map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows.slice(0, MAX_SHOWN_FEATURES).map((row, position) => (
                <tr key={position}>
                  <td>{position + 1}</td>
                  {row.map((value, column) => (
                    <td key={column} dir="auto">
                      {value === null ? '' : formatValueText(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {summary.rows.length > MAX_SHOWN_FEATURES && <p className="cmp-hint">{t('json.geo.firstRows', { count: MAX_SHOWN_FEATURES })}</p>}
    </div>
  )
}
