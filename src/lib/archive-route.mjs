export const ARCHIVE_ROUTE_ORIGINS = Object.freeze([
  { id: 'current', label: '현재 위치', name: '', lat: null, lng: null },
  { id: 'biennale', label: '광주비엔날레전시관', name: '광주비엔날레전시관', lat: 35.18274895, lng: 126.8893391 },
  { id: 'acc', label: 'ACC', name: 'ACC', lat: 35.147057304166, lng: 126.92003143495 },
])

export const ARCHIVE_ROUTE_MODES = Object.freeze([
  { id: 'recommended', label: '추천', value: '' },
  { id: 'transit', label: '대중교통', value: 'transit' },
  { id: 'driving', label: '자동차·주차', value: 'driving' },
])

export function ongoingArchiveItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => String(item?.status ?? '').trim().toLowerCase() === 'ongoing')
}

export function parseArchiveRouteIds(queryValue) {
  const values = Array.isArray(queryValue) ? queryValue : [queryValue]
  return uniqueRouteIds(values.flatMap(value => String(value ?? '').split(',')))
}

export function serializeArchiveRouteIds(ids) {
  return uniqueRouteIds(ids).join(',')
}

export function toggleArchiveRouteId(ids, id) {
  const normalized = uniqueRouteIds(ids)
  const target = routeId(id)
  if (!target) return normalized
  return normalized.includes(target)
    ? normalized.filter(current => current !== target)
    : [...normalized, target]
}

export function moveArchiveRouteId(ids, index, offset) {
  const normalized = uniqueRouteIds(ids)
  const from = Number(index)
  const to = from + Number(offset)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= normalized.length || to < 0 || to >= normalized.length) {
    return normalized
  }
  const moved = [...normalized]
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item)
  return moved
}

function uniqueRouteIds(ids) {
  const seen = new Set()
  const normalized = []
  for (const value of Array.isArray(ids) ? ids : []) {
    const id = routeId(value)
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  return normalized
}

function routeId(value) {
  const id = String(value ?? '').trim()
  return id && !id.includes(',') ? id : ''
}

const NAVER_APP_NAME = 'https://spaceddf.xyz'
const NAVER_MAX_ROUTE_LOCATIONS = 6
export const NAVER_MAP_IOS_STORE_URL = 'https://apps.apple.com/kr/app/id311867728'
const NAVER_MAP_WEB_URL = 'https://map.naver.com/p/directions/'

function validCoordinate(value) {
  return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))
}

export function archiveRouteLocations(items) {
  const seen = new Set()
  const locations = []
  for (const item of Array.isArray(items) ? items : []) {
    if (!validCoordinate(item?.lat) || !validCoordinate(item?.lng)) continue
    const lat = Number(item.lat)
    const lng = Number(item.lng)
    const key = `${lat},${lng}`
    if (seen.has(key)) continue
    seen.add(key)
    locations.push({
      name: String(item?.venue || item?.title || '전시장'),
      lat,
      lng,
    })
  }
  return locations
}

export function buildArchiveRouteUrl({ items, originId = 'current', modeId = 'recommended' }) {
  const locations = archiveRouteLocations(items).slice(0, NAVER_MAX_ROUTE_LOCATIONS)
  if (!locations.length) return ''
  const origin = ARCHIVE_ROUTE_ORIGINS.find(option => option.id === originId) || ARCHIVE_ROUTE_ORIGINS[0]
  const action = locations.length > 1 || modeId === 'driving' ? 'car' : 'public'
  const url = new URL(`nmap://route/${action}`)
  const destination = locations.at(-1)

  if (Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    url.searchParams.set('slat', String(origin.lat))
    url.searchParams.set('slng', String(origin.lng))
    url.searchParams.set('sname', origin.name)
  }

  locations.slice(0, -1).forEach((location, index) => {
    const number = index + 1
    url.searchParams.set(`v${number}lat`, String(location.lat))
    url.searchParams.set(`v${number}lng`, String(location.lng))
    url.searchParams.set(`v${number}name`, location.name)
  })

  url.searchParams.set('dlat', String(destination.lat))
  url.searchParams.set('dlng', String(destination.lng))
  url.searchParams.set('dname', destination.name)
  url.searchParams.set('appname', NAVER_APP_NAME)
  return url.toString()
}

export function buildArchiveRouteWebUrl({ items, originId = 'current', originLocation = null, modeId = 'recommended' } = {}) {
  const locations = archiveRouteLocations(items).slice(0, NAVER_MAX_ROUTE_LOCATIONS)
  if (!locations.length) return NAVER_MAP_WEB_URL
  const origin = ARCHIVE_ROUTE_ORIGINS.find(option => option.id === originId) || ARCHIVE_ROUTE_ORIGINS[0]
  const destination = locations.at(-1)
  const resolvedOrigin = originId === 'current' && originLocation ? originLocation : origin
  const originSegment = Number.isFinite(resolvedOrigin.lat) && Number.isFinite(resolvedOrigin.lng)
    ? naverWebLocationSegment(resolvedOrigin)
    : '-'
  const destinationSegment = naverWebLocationSegment(destination)
  const waypointSegment = locations.slice(0, -1).map(naverWebLocationSegment).join(':') || '-'
  const action = locations.length > 1 || modeId === 'driving' ? 'car' : 'transit'
  return `${NAVER_MAP_WEB_URL}${originSegment}/${destinationSegment}/${waypointSegment}/${action}`
}

function naverWebLocationSegment(location) {
  const earthRadius = 6378137
  const longitude = Number(location.lng) * Math.PI / 180
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, Number(location.lat))) * Math.PI / 180
  const x = earthRadius * longitude
  const y = earthRadius * Math.log(Math.tan(Math.PI / 4 + latitude / 2))
  return `${x},${y},${encodeURIComponent(location.name)},,PLACE_POI`
}

export function detectArchiveRoutePlatform(userAgent = '', platform = '', maxTouchPoints = 0) {
  if (/android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (platform === 'MacIntel' && Number(maxTouchPoints) > 1) return 'ios'
  return 'desktop'
}

export function buildArchiveRouteLaunch({ appUrl, webUrl = NAVER_MAP_WEB_URL, platform = 'desktop' }) {
  if (!appUrl) return { kind: platform, url: '' }
  if (platform === 'android') {
    const routePath = appUrl.replace(/^nmap:\/\//, '')
    return {
      kind: 'android',
      url: `intent://${routePath}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`,
    }
  }
  if (platform === 'ios') return { kind: 'ios', url: appUrl, fallbackUrl: NAVER_MAP_IOS_STORE_URL }
  return { kind: 'desktop', url: webUrl }
}
