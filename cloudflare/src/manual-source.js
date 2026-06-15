// Manual / submission source: alternative spaces (호랑가시나무, 예술공간 집,
// 뽕뽕브릿지, 스페이스 DDF, Overlab, 빈틀 …) whose exhibitions are not on Artmap
// and whose own sites are JS-rendered. These are entered by hand through
// POST /api/archive/manual and flow into the same exhibitions table/map.

import {
  inferArchiveType,
  linkExhibitionSource,
  normalizeArchiveType,
  normalizeForKey,
  replaceExhibitionMetadata,
  statusFromDates,
  upsertExhibition,
  upsertSourceRecord,
  upsertVenue,
} from './artmap-crawler.js'

const CITY_LABELS = { gwangju: '광주', jeonju: '전북', jeonnam: '전남' }
const VALID_CITIES = new Set(['gwangju', 'jeonju', 'jeonnam'])

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function toIsoDate(value) {
  const text = clean(value)
  const match = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
  if (!match) return ''
  return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
}

function toArray(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,/·\n]/).map(clean).filter(Boolean)
  return []
}

function numberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Turn a loose manual submission into a normalized exhibition record matching the
// shape the shared upsert helpers expect. Throws on missing required fields.
export function buildManualExhibition(input = {}) {
  const title = clean(input.title)
  const venueName = clean(input.venue || input.venueName)

  if (!title) throw new Error('title is required')
  if (!venueName) throw new Error('venue is required')

  const city = VALID_CITIES.has(input.city) ? input.city : 'gwangju'
  const cityLabel = clean(input.cityLabel) || CITY_LABELS[city]
  const startDate = toIsoDate(input.startDate)
  const endDate = toIsoDate(input.endDate)
  const description = clean(input.description)
  const normalizedVenueName = normalizeForKey(venueName)
  const scrapedAt = new Date().toISOString()
  const externalId = clean(input.id) || `${normalizeForKey(venueName)}-${normalizeForKey(title)}-${startDate}`

  return {
    sourceRecordId: `manual-${externalId}`.slice(0, 96),
    sourceId: 'space-ddf',
    externalId,
    sourceUrl: clean(input.sourceUrl) || 'https://www.spaceddf.xyz',
    canonicalSourceUrl: clean(input.sourceUrl) || 'https://www.spaceddf.xyz',
    title,
    normalizedTitle: normalizeForKey(title),
    venueName,
    normalizedVenueName,
    regionLabel: cityLabel,
    cityHint: cityLabel,
    city,
    cityLabel,
    address: clean(input.address),
    lat: numberOrNull(input.lat),
    lng: numberOrNull(input.lng),
    startDate,
    endDate,
    periodText: startDate ? (endDate ? `${startDate} - ${endDate}` : startDate) : '',
    status: statusFromDates(startDate, endDate, 'unknown'),
    summary: clean(input.summary) || description.slice(0, 120),
    description,
    artists: toArray(input.artists),
    categories: toArray(input.categories),
    archiveType: normalizeArchiveType(clean(input.archiveType) || inferArchiveType({ title, venueName }, { description })),
    regionConfidence: 'high',
    reviewReason: null,
    thumbnailUrl: clean(input.thumbnail || input.thumbnailUrl),
    sourceName: clean(input.sourceName) || venueName,
    sourceType: 'manual',
    visibility: input.visibility === 'review' || input.visibility === 'hidden' ? input.visibility : 'public',
    scrapedAt,
    payload: { manual: true },
    dedupeKey: [normalizeForKey(title), normalizedVenueName, startDate].join('|'),
  }
}

export async function upsertManualExhibition(env, input) {
  const record = buildManualExhibition(input)

  await upsertSourceRecord(env, record)
  await upsertVenue(env, record)
  const exhibitionId = await upsertExhibition(env, record)
  await linkExhibitionSource(env, exhibitionId, record.sourceRecordId)
  await replaceExhibitionMetadata(env, exhibitionId, record)

  return { id: exhibitionId, dedupeKey: record.dedupeKey, title: record.title, venue: record.venueName }
}

export async function importManualExhibitions(env, items = []) {
  const results = []
  for (const item of items) {
    results.push(await upsertManualExhibition(env, item))
  }
  return { ok: true, imported: results.length, items: results }
}
