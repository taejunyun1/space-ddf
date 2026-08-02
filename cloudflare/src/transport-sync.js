const GWANGJU_BIS_BASE_URL = 'https://apis.data.go.kr/6290000/gj_bis'

const UPSERT_TRANSPORT_POINT = `
  INSERT INTO transport_points (id, kind, name, address, lat, lng, routes_json, metadata_json, source_name, source_updated_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    address = excluded.address,
    lat = excluded.lat,
    lng = excluded.lng,
    routes_json = excluded.routes_json,
    metadata_json = excluded.metadata_json,
    source_updated_at = excluded.source_updated_at,
    updated_at = excluded.updated_at
`

function value(record, keys) {
  for (const key of keys) {
    const found = record?.[key]
    if (found !== undefined && found !== null && String(found).trim() !== '') return found
  }

  const wanted = new Set(keys.map(key => key.toLowerCase()))
  for (const [key, found] of Object.entries(record || {})) {
    if (wanted.has(key.toLowerCase()) && found !== undefined && found !== null && String(found).trim() !== '') return found
  }

  return undefined
}

function text(record, keys) {
  const found = value(record, keys)
  return found === undefined ? '' : String(found).trim()
}

function coordinate(record, keys) {
  const parsed = Number(value(record, keys))
  return Number.isFinite(parsed) ? parsed : null
}

function coordinates(record) {
  const lat = coordinate(record, ['LATITUDE', 'lat', 'latitude', 'stationLatitude', 'parkingLatitude', 'statnLa', 'Y_COORD', 'Y', '위도'])
  const lng = coordinate(record, ['LONGITUDE', 'lng', 'longitude', 'stationLongitude', 'parkingLongitude', 'statnLo', 'X_COORD', 'X', '경도'])
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null
}

export function normalizeBusStop(record) {
  const id = text(record, ['BUSSTOP_ID', 'STATION_ID', 'STOP_ID'])
  const name = text(record, ['BUSSTOP_NAME', 'STATION_NAME', 'STOP_NAME'])
  const point = coordinates(record)
  if (!id || !name || !point) return null

  return { id: `bus-${id}`, kind: 'bus_stop', name, ...point }
}

export function normalizeBusRoutes(lineStations, lines) {
  const lineNames = new Map()
  for (const line of lines) {
    const id = text(line, ['LINE_ID', 'ROUTE_ID'])
    const name = text(line, ['LINE_NAME', 'ROUTE_NAME', 'BUS_ROUTE_NAME'])
    if (id && name) lineNames.set(id, name)
  }

  const routesByStop = new Map()
  for (const lineStation of lineStations) {
    const stopId = text(lineStation, ['BUSSTOP_ID', 'STATION_ID', 'STOP_ID'])
    const lineId = text(lineStation, ['LINE_ID', 'ROUTE_ID'])
    const name = lineNames.get(lineId)
    if (!stopId || !name) continue

    const routes = routesByStop.get(stopId) || []
    if (!routes.includes(name)) routes.push(name)
    routesByStop.set(stopId, routes)
  }

  return routesByStop
}

export function normalizePublicParking(record) {
  const type = text(record, ['PARKING_TYPE', 'PARKING_CATEGORY', 'parkingType', '주차장구분', '구분'])
  if (!['공영', 'public'].includes(type.toLowerCase())) return null

  const id = text(record, ['PARKING_ID', 'PKLT_ID', 'parkingManagementNumber', 'ID', '주차장관리번호'])
  const name = text(record, ['PARKING_NAME', 'PKLT_NM', 'parkingName', 'NAME', '주차장명'])
  const point = coordinates(record)
  if (!id || !name || !point) return null

  return {
    id: `parking-${id}`,
    kind: 'public_parking',
    name,
    address: text(record, ['ADDRESS', 'ADDR', 'roadNameAddress', '주소', '도로명주소']) || null,
    ...point,
  }
}

export function normalizeSubwayStation(record) {
  const id = text(record, ['STATION_ID', 'SUBWAY_STATION_ID', 'stationNo', 'ID', '역번호'])
  const name = text(record, ['STATION_NAME', 'SUBWAY_STATION_NAME', 'stationName', 'NAME', '역명'])
  const point = coordinates(record)
  if (!id || !name || !point) return null

  return {
    id: `subway-${id}`,
    kind: 'subway_station',
    name,
    address: text(record, ['ADDRESS', 'ADDR', 'stationRoadNameAddress', 'statnRdnAddr', 'roadNameAddress', '주소', '도로명주소']) || null,
    ...point,
  }
}

function records(payload, keys) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key]
  }

  for (const key of ['response', 'body', 'items', 'item', 'data', 'result', 'results']) {
    const found = records(payload[key], keys)
    if (found.length) return found
  }

  return []
}

function authenticatedUrl(baseUrl, key) {
  let url
  try {
    url = new URL(baseUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  url.searchParams.set('serviceKey', key)
  return url
}

async function fetchJson(env, url) {
  const fetcher = env.fetch || fetch
  const response = await fetcher(url.toString())
  if (!response.ok) throw new Error(`Public data request failed (${response.status})`)
  return response.json()
}

function bisUrl(path, key) {
  return authenticatedUrl(`${GWANGJU_BIS_BASE_URL}/${path}`, key)
}

function toStoredPoint(point, sourceName, now, routes = []) {
  return {
    ...point,
    routes,
    sourceName,
    sourceUpdatedAt: now,
    updatedAt: now,
  }
}

function addPublicSource(points, payload, normalizer, sourceName, now) {
  for (const record of records(payload, ['items', 'item', 'data', 'results', 'records'])) {
    const point = normalizer(record)
    if (point) points.push(toStoredPoint(point, sourceName, now))
  }
}

async function syncBus(env, key, now) {
  const [stopsPayload, linesPayload, lineStationsPayload] = await Promise.all([
    fetchJson(env, bisUrl('stationInfo', key)),
    fetchJson(env, bisUrl('lineInfo', key)),
    fetchJson(env, bisUrl('lineStationInfo', key)),
  ])
  const routesByStop = normalizeBusRoutes(
    records(lineStationsPayload, ['LINE_STATION_LIST', 'lineStationInfo', 'items']),
    records(linesPayload, ['LINE_LIST', 'lineInfo', 'items']),
  )

  return records(stopsPayload, ['STATION_LIST', 'stationInfo', 'items'])
    .map(normalizeBusStop)
    .filter(Boolean)
    .map(point => toStoredPoint(point, 'Gwangju BIS', now, routesByStop.get(point.id.slice(4)) || []))
}

function appendSourceWarning(warnings, source, reason) {
  warnings.push(`${source}_${reason}`)
}

export async function syncTransportPoints(env) {
  const warnings = []
  const points = []
  const now = new Date().toISOString()

  if (!env.GWANGJU_BUS_API_KEY) {
    warnings.push('bus_key_missing')
  } else {
    try {
      points.push(...await syncBus(env, env.GWANGJU_BUS_API_KEY, now))
    } catch {
      appendSourceWarning(warnings, 'bus', 'sync_failed')
    }
  }

  if (!env.PUBLIC_DATA_API_KEY) {
    warnings.push('public_data_key_missing')
  } else {
    for (const [source, urlValue, normalizer, sourceName] of [
      ['parking', env.GWANGJU_PARKING_DATA_URL, normalizePublicParking, 'Gwangju public parking'],
      ['subway', env.GWANGJU_SUBWAY_DATA_URL, normalizeSubwayStation, 'Gwangju subway'],
    ]) {
      const url = authenticatedUrl(urlValue, env.PUBLIC_DATA_API_KEY)
      if (!url) {
        appendSourceWarning(warnings, source, 'url_invalid')
        continue
      }

      try {
        addPublicSource(points, await fetchJson(env, url), normalizer, sourceName, now)
      } catch {
        appendSourceWarning(warnings, source, 'sync_failed')
      }
    }
  }

  const uniquePoints = [...new Map(points.map(point => [point.id, point])).values()]
  if (!uniquePoints.length) return { saved: 0, warnings }

  try {
    await env.DB.batch(uniquePoints.map(point => env.DB.prepare(UPSERT_TRANSPORT_POINT).bind(
      point.id,
      point.kind,
      point.name,
      point.address || null,
      point.lat,
      point.lng,
      JSON.stringify(point.routes),
      JSON.stringify({ source: point.sourceName }),
      point.sourceName,
      point.sourceUpdatedAt,
      point.updatedAt,
    )))
    return { saved: uniquePoints.length, warnings }
  } catch {
    warnings.push('transport_upsert_failed')
    return { saved: 0, warnings }
  }
}
