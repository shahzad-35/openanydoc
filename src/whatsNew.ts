import { NEW_WINDOW_DAYS } from './releaseConfig'
import { formatDefinitions } from './formats/registry'
import type { FormatDefinition } from './formats/registry'
import { viewers } from './viewers'
import type { Viewer } from './viewers'

// Everything about what is new is worked out from the dates shipped in the registry and today's date in the visitor's own
// time zone. Nothing about the visitor is read, kept or sent, and the result is never written into prerendered HTML.

export type ReleasedFormat = { viewer: Viewer; definition: FormatDefinition }

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

// Whole calendar days from the release day to today, both as local dates (so a daylight-saving change never shifts the count).
function daysSince(addedOn: string, today: Date) {
  const [year, month, day] = addedOn.split('-').map(Number)
  const releaseDay = Date.UTC(year, month - 1, day)
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((currentDay - releaseDay) / MILLISECONDS_PER_DAY)
}

export function isNewFormat(definition: FormatDefinition, today = new Date()) {
  if (!definition.addedOn) return false
  const days = daysSince(definition.addedOn, today)
  return days >= 0 && days < NEW_WINDOW_DAYS
}

// The formats that are live: a page of their own and a release date.
export function getReleasedFormats(): ReleasedFormat[] {
  return viewers.flatMap((viewer) => {
    const definition = formatDefinitions.find((candidate) => candidate.viewerId === viewer.id)
    return viewer.toolPath && definition?.addedOn ? [{ viewer, definition }] : []
  })
}

export function getNewFormats(today = new Date()) {
  return getReleasedFormats().filter(({ definition }) => isNewFormat(definition, today))
}

export function getOtherReleasedFormats(currentViewerId?: Viewer['id']) {
  return getReleasedFormats().filter(({ viewer }) => viewer.id !== currentViewerId)
}

export function findReleasedFormat(viewerId: Viewer['id']) {
  return getReleasedFormats().find(({ viewer }) => viewer.id === viewerId)
}

// The format to suggest after a save: the first related one that is live.
export function pickRelatedFormat(currentViewerId: Viewer['id']) {
  const related = formatDefinitions.find((definition) => definition.viewerId === currentViewerId)?.related ?? []
  return related.map(findReleasedFormat).find((released) => released !== undefined)
}
