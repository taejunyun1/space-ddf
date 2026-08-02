import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeBusRoutes,
  normalizeBusStop,
  normalizePublicParking,
  normalizeSubwayStation,
  syncTransportPoints,
} from '../src/transport-sync.js'

test('normalizes the documented Gwangju BIS bus-stop sample', () => {
  assert.deepEqual(normalizeBusStop({
    BUSSTOP_ID: '2513',
    BUSSTOP_NAME: '동원촌',
    LONGITUDE: '126.82839444',
    LATITUDE: '35.221225',
  }), {
    id: 'bus-2513',
    kind: 'bus_stop',
    name: '동원촌',
    lat: 35.221225,
    lng: 126.82839444,
  })
})

test('rejects non-public parking records', () => {
  assert.equal(normalizePublicParking({
    PARKING_ID: 'private-1',
    PARKING_NAME: '민영 주차장',
    PARKING_TYPE: '민영',
    LATITUDE: '35.15',
    LONGITUDE: '126.91',
  }), null)
})

test('normalizes public-data portal field names for parking and subway sources', () => {
  assert.deepEqual(normalizePublicParking({
    parkingManagementNumber: 'GJ-1',
    parkingName: '광주 공영주차장',
    parkingType: '공영',
    roadNameAddress: '광주광역시 동구',
    latitude: '35.15',
    longitude: '126.91',
  }), {
    id: 'parking-GJ-1', kind: 'public_parking', name: '광주 공영주차장',
    address: '광주광역시 동구', lat: 35.15, lng: 126.91,
  })

  assert.deepEqual(normalizeSubwayStation({
    stationNo: '104', stationName: '문화전당(구도청)', statnLa: '35.14661', statnLo: '126.92005',
    statnRdnAddr: '광주광역시 동구 문화전당로',
  }), {
    id: 'subway-104', kind: 'subway_station', name: '문화전당(구도청)',
    address: '광주광역시 동구 문화전당로', lat: 35.14661, lng: 126.92005,
  })
})

test('deduplicates bus route names while preserving their source order', () => {
  assert.deepEqual(normalizeBusRoutes([
    { BUSSTOP_ID: '2513', LINE_ID: '1' },
    { BUSSTOP_ID: '2513', LINE_ID: '2' },
    { BUSSTOP_ID: '2513', LINE_ID: '1' },
  ], [
    { LINE_ID: '1', LINE_NAME: '첨단09' },
    { LINE_ID: '2', LINE_NAME: '첨단09' },
  ]).get('2513'), ['첨단09'])
})

test('skips network requests and reports warnings when secrets are missing', async () => {
  let fetchCalls = 0
  const result = await syncTransportPoints({
    fetch() {
      fetchCalls += 1
      throw new Error('must not fetch without a secret')
    },
    DB: createDb(),
  })

  assert.deepEqual(result, { saved: 0, warnings: ['bus_key_missing', 'public_data_key_missing'] })
  assert.equal(fetchCalls, 0)
})

test('uses encoded service keys, refuses non-HTTPS public datasets, and batches D1 upserts', async () => {
  const calls = []
  const db = createDb()
  const result = await syncTransportPoints({
    GWANGJU_BUS_API_KEY: 'a key&value',
    PUBLIC_DATA_API_KEY: 'public key',
    GWANGJU_PARKING_DATA_URL: 'http://invalid.example/parking',
    GWANGJU_SUBWAY_DATA_URL: 'https://data.example/subway?format=json',
    DB: db,
    async fetch(url) {
      calls.push(String(url))
      if (String(url).includes('stationInfo')) return response({ STATION_LIST: [{
        BUSSTOP_ID: '2513', BUSSTOP_NAME: '동원촌', LONGITUDE: '126.82839444', LATITUDE: '35.221225',
      }] })
      if (String(url).includes('lineInfo')) return response({ LINE_LIST: [{ LINE_ID: '1', LINE_NAME: '첨단09' }] })
      if (String(url).includes('lineStationInfo')) return response({ LINE_STATION_LIST: [{ BUSSTOP_ID: '2513', LINE_ID: '1' }] })
      return response({ data: [{ STATION_ID: 's1', STATION_NAME: '문화전당역', LATITUDE: '35.146', LONGITUDE: '126.92' }] })
    },
  })

  assert.equal(calls.length, 4)
  assert.ok(calls.slice(0, 3).every(url => url.startsWith('https://apis.data.go.kr/6290000/gj_bis/')))
  assert.ok(calls.slice(0, 3).every(url => new URL(url).searchParams.get('serviceKey') === 'a key&value'))
  assert.match(calls[3], /^https:\/\/data\.example\/subway\?/) 
  assert.equal(new URL(calls[3]).searchParams.get('serviceKey'), 'public key')
  assert.deepEqual(result, { saved: 2, warnings: ['parking_url_invalid'] })
  assert.equal(db.batches.length, 1)
  assert.equal(db.batches[0].length, 2)
  assert.match(db.batches[0][0].sql, /INSERT INTO transport_points/)
  assert.match(db.batches[0][0].sql, /ON CONFLICT\(id\) DO UPDATE SET/)
})

function response(payload) {
  return new Response(JSON.stringify(payload), { status: 200 })
}

function createDb() {
  const batches = []
  return {
    batches,
    prepare(sql) {
      return {
        sql,
        bind(...values) {
          return { sql, values }
        },
      }
    },
    async batch(statements) {
      batches.push(statements)
    },
  }
}
