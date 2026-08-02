import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  parseBiennaleEdition,
  parseBiennalePavilions,
  webMercatorToWgs84,
} from '../src/biennale-pavilion-crawler.js'

test('biennale migration stores edition gate and pavilion metadata', () => {
  const sql = fs.readFileSync(new URL('../migrations/0011_biennale_pavilions.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS biennale_editions/)
  assert.match(sql, /crawl_completed_at TEXT/)
  assert.match(sql, /INSERT INTO biennale_editions[\s\S]*2026-09-05[\s\S]*2026-11-15/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN pavilion_name TEXT/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN venue_group_key TEXT/)
})

test('parses official pavilion heading blocks into verified, grouped venue records', () => {
  const html = fs.readFileSync(new URL('./fixtures/biennale-pavilion-venues.html', import.meta.url), 'utf8')
  const edition = parseBiennaleEdition(html)
  const records = parseBiennalePavilions(html, edition)

  assert.deepEqual(edition, {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
  assert.equal(records.length, 2)
  assert.deepEqual(records.map(record => record.pavilionName), ['Malaysia', 'Myanmar'])
  assert.deepEqual(records.map(record => record.venueName), [
    'National Asian Culture Center(ACC), Creation Space 5',
    'ACC, Creation Space 5',
  ])
  assert.equal(records[0].address, '38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]')
  assert.equal(records[0].hours, '10:00-18:00')
  assert.equal(records[1].hours, '')
  assert.equal(records[0].venueGroupKey, records[1].venueGroupKey)
  assert.equal(records[0].geocodeStatus, 'verified')
  assert.equal(records[0].visibility, 'public')
  assert.equal(records[0].crawlWarning, '')
  assert.ok(records[0].lat >= 34.9 && records[0].lat <= 35.4)
  assert.ok(records[0].lng >= 126.6 && records[0].lng <= 127.1)
  assert.match(records[0].dedupeKey, /^16\|malaysia\|nationalasianculturecenteracccreationspace5\|2026-09-05$/)
  assert.match(records[1].dedupeKey, /^16\|myanmar\|acccreationspace5\|2026-09-05$/)
})

test('marks malformed or out-of-bounds maps for review without throwing', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const malformed = `
    <h4>3 &amp;nbsp; Test Pavilion | Test &amp; Venue</h4>
    <p>Address: 1  Test St, Gwangju</p>
    <a href="not a url">map</a>
    <h4>4 Example | Other Venue</h4>
    <p>Address: 2 Test St, Gwangju</p>
    <a href="https://map.naver.com/p/address/0,0">map</a>
  `

  const records = parseBiennalePavilions(malformed, edition)

  assert.equal(records.length, 2)
  assert.deepEqual(records.map(record => record.geocodeStatus), ['needs_review', 'needs_review'])
  assert.deepEqual(records.map(record => record.visibility), ['review', 'review'])
  assert.deepEqual(records.map(record => record.crawlWarning), ['missing_coordinates', 'missing_coordinates'])
  assert.deepEqual(records.map(record => [record.lat, record.lng]), [[null, null], [null, null]])
  assert.equal(records[0].pavilionName, 'Test Pavilion')
  assert.equal(records[0].venueName, 'Test & Venue')
})

test('converts Web Mercator coordinates to WGS84', () => {
  const coordinates = webMercatorToWgs84(14128808.1750051, 4183958.509357)

  assert.ok(Math.abs(coordinates.lat - 35.148) < 0.01)
  assert.ok(Math.abs(coordinates.lng - 126.921) < 0.01)
})
