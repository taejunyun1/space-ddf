const EARTH_RADIUS_METERS = 6371000
const BOUNDING_BOX_DEGREES = 0.08

const transportKinds = {
  bus_stop: { key: 'busStops', limit: 2 },
  subway_station: { key: 'subwayStations', limit: 1 },
  public_parking: { key: 'publicParking', limit: 2 },
}

function toRadians(degrees) {
  return degrees * Math.PI / 180
}

export function distanceMeters(a, b) {
  const latitudeDelta = toRadians(b.lat - a.lat)
  const longitudeDelta = toRadians(b.lng - a.lng)
  const aLatitude = toRadians(a.lat)
  const bLatitude = toRadians(b.lat)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(aLatitude) * Math.cos(bLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function parseRoutes(value) {
  if (!value) return []

  try {
    const routes = JSON.parse(value)
    return Array.isArray(routes) ? routes.slice(0, 5) : []
  } catch {
    return []
  }
}

function toTransportPoint(point, coordinates) {
  const { routes_json, ...transportPoint } = point

  return {
    ...transportPoint,
    routes: parseRoutes(routes_json),
    distanceMeters: Math.round(distanceMeters(coordinates, point)),
  }
}

export function rankTransportPoints(points, coordinates) {
  const ranked = {
    busStops: [],
    subwayStations: [],
    publicParking: [],
  }

  for (const [kind, { key, limit }] of Object.entries(transportKinds)) {
    ranked[key] = points
      .filter(point => point.kind === kind)
      .map(point => toTransportPoint(point, coordinates))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit)
  }

  return ranked
}

export async function listNearbyTransport(env, { lat, lng }) {
  try {
    const result = await env.DB.prepare(`
      SELECT id, kind, name, address, lat, lng, routes_json
      FROM transport_points
      WHERE kind IN (?, ?, ?)
        AND lat BETWEEN ? AND ?
        AND lng BETWEEN ? AND ?
    `).bind(
      'bus_stop',
      'subway_station',
      'public_parking',
      lat - BOUNDING_BOX_DEGREES,
      lat + BOUNDING_BOX_DEGREES,
      lng - BOUNDING_BOX_DEGREES,
      lng + BOUNDING_BOX_DEGREES,
    ).all()

    return {
      ...rankTransportPoints(result.results || [], { lat, lng }),
      warnings: [],
    }
  } catch {
    return {
      busStops: [],
      subwayStations: [],
      publicParking: [],
      warnings: ['transport_unavailable'],
    }
  }
}
