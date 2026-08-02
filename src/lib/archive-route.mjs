export const ARCHIVE_ROUTE_ORIGINS = Object.freeze([
  { id: 'current', label: '현재 위치', value: '' },
  { id: 'biennale', label: '광주비엔날레전시관', value: '광주광역시 북구 비엔날레로 111' },
  { id: 'acc', label: 'ACC', value: '광주광역시 동구 문화전당로 38' },
])

export const ARCHIVE_ROUTE_MODES = Object.freeze([
  { id: 'recommended', label: '추천', value: '' },
  { id: 'transit', label: '대중교통', value: 'transit' },
  { id: 'driving', label: '자동차·주차', value: 'driving' },
])

export function ongoingArchiveItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => String(item?.status ?? '').trim().toLowerCase() === 'ongoing')
}

export function archiveDestination(item) {
  if (!item) return ''
  if (item.address) return [item.venue, item.address].filter(Boolean).join(', ')
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? [item.venue, `${lat},${lng}`].filter(Boolean).join(', ')
    : ''
}

export function buildArchiveRouteUrl({ item, originId = 'current', modeId = 'recommended' }) {
  const destination = archiveDestination(item)
  if (!destination) return ''
  const origin = ARCHIVE_ROUTE_ORIGINS.find(option => option.id === originId) || ARCHIVE_ROUTE_ORIGINS[0]
  const mode = ARCHIVE_ROUTE_MODES.find(option => option.id === modeId) || ARCHIVE_ROUTE_MODES[0]
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', destination)
  if (origin.value) url.searchParams.set('origin', origin.value)
  if (mode.value) url.searchParams.set('travelmode', mode.value)
  return url.toString()
}
