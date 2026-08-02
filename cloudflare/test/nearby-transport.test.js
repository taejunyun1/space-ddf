import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { distanceMeters, listNearbyTransport, rankTransportPoints } from '../src/nearby-transport.js'

test('transport migration stores normalized public transport points', () => {
  const sql = fs.readFileSync(new URL('../migrations/0010_nearby_transport.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS transport_points/)
  assert.match(sql, /kind TEXT NOT NULL CHECK \(kind IN \('bus_stop', 'subway_station', 'public_parking'\)\)/)
  assert.match(sql, /routes_json TEXT/)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_transport_points_kind_lat_lng/)
})

test('distance and ranking return approved limits', () => {
  assert.ok(distanceMeters({ lat: 35.15, lng: 126.91 }, { lat: 35.151, lng: 126.91 }) > 100)
  const ranked = rankTransportPoints([
    { id: 'b2', kind: 'bus_stop', lat: 35.152, lng: 126.91, routes_json: '["09","51","55","80","95","98"]' },
    { id: 'b1', kind: 'bus_stop', lat: 35.151, lng: 126.91, routes_json: '["01"]' },
    { id: 'b3', kind: 'bus_stop', lat: 35.153, lng: 126.91, routes_json: 'not-json' },
    { id: 's1', kind: 'subway_station', lat: 35.149, lng: 126.91 },
    { id: 's2', kind: 'subway_station', lat: 35.148, lng: 126.91 },
    { id: 'p1', kind: 'public_parking', lat: 35.153, lng: 126.91 },
    { id: 'p2', kind: 'public_parking', lat: 35.154, lng: 126.91 },
    { id: 'p3', kind: 'public_parking', lat: 35.155, lng: 126.91 },
  ], { lat: 35.15, lng: 126.91 })

  assert.deepEqual(ranked.busStops.map(item => item.id), ['b1', 'b2'])
  assert.equal(ranked.busStops[1].routes.length, 5)
  assert.ok(Number.isInteger(ranked.busStops[0].distanceMeters))
  assert.equal(ranked.subwayStations.length, 1)
  assert.deepEqual(ranked.publicParking.map(item => item.id), ['p1', 'p2'])
})

test('lists bounded D1 transport points in the public response shape', async () => {
  const calls = []
  const env = {
    DB: {
      prepare(sql) {
        calls.push({ sql })
        return {
          bind(...values) {
            calls[0].values = values
            return {
              async all() {
                return {
                  results: [
                    { id: 'b1', kind: 'bus_stop', name: '버스 정류장', address: '광주', lat: 35.151, lng: 126.91, routes_json: '["01"]' },
                    { id: 's1', kind: 'subway_station', name: '지하철역', address: '', lat: 35.149, lng: 126.91, routes_json: '[]' },
                    { id: 'p1', kind: 'public_parking', name: '공영주차장', address: null, lat: 35.153, lng: 126.91, routes_json: 'invalid' },
                  ],
                }
              },
            }
          },
        }
      },
    },
  }

  const nearby = await listNearbyTransport(env, { lat: 35.15, lng: 126.91 })

  assert.match(calls[0].sql, /FROM transport_points/)
  assert.match(calls[0].sql, /kind IN \(\?, \?, \?\)/)
  assert.deepEqual(calls[0].values, ['bus_stop', 'subway_station', 'public_parking', 35.07, 35.23, 126.83, 126.99])
  assert.deepEqual(nearby, {
    busStops: [{
      id: 'b1', kind: 'bus_stop', name: '버스 정류장', address: '광주', lat: 35.151, lng: 126.91,
      routes: ['01'], distanceMeters: 111,
    }],
    subwayStations: [{
      id: 's1', kind: 'subway_station', name: '지하철역', address: '', lat: 35.149, lng: 126.91,
      routes: [], distanceMeters: 111,
    }],
    publicParking: [{
      id: 'p1', kind: 'public_parking', name: '공영주차장', address: null, lat: 35.153, lng: 126.91,
      routes: [], distanceMeters: 334,
    }],
    warnings: [],
  })
})

test('returns a transport warning when the D1 query fails', async () => {
  const env = {
    DB: {
      prepare() {
        throw new Error('D1 unavailable')
      },
    },
  }

  assert.deepEqual(await listNearbyTransport(env, { lat: 35.15, lng: 126.91 }), {
    busStops: [],
    subwayStations: [],
    publicParking: [],
    warnings: ['transport_unavailable'],
  })
})
