import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('transport migration stores normalized public transport points', () => {
  const sql = fs.readFileSync(new URL('../migrations/0010_nearby_transport.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS transport_points/)
  assert.match(sql, /kind TEXT NOT NULL CHECK \(kind IN \('bus_stop', 'subway_station', 'public_parking'\)\)/)
  assert.match(sql, /routes_json TEXT/)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_transport_points_kind_lat_lng/)
})
