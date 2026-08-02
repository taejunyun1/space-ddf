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
  assert.match(records[0].dedupeKey, /^biennale-dedupe-v1\|n:2:16\|s:8:malaysia\|s:52:national asian culture center\(acc\), creation space 5\|d:10:2026-09-05$/)
  assert.match(records[1].dedupeKey, /^biennale-dedupe-v1\|n:2:16\|s:7:myanmar\|s:21:acc, creation space 5\|d:10:2026-09-05$/)
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

test('parses named and numeric dash entities in bounded edition dates', () => {
  const namedEntity = `
    <h3>The 16th Gwangju Biennale Pavilion</h3>
    <p>Dates: September 5 &ndash; November 15, 2026</p>
  `
  const numericEntity = `
    <h3>The 16th Gwangju Biennale Pavilion</h3>
    <p>Dates: September 5 &#x2013; November 15, 2026</p>
  `

  assert.deepEqual(parseBiennaleEdition(namedEntity), {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
  assert.deepEqual(parseBiennaleEdition(numericEntity), {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
})

test('extracts nested address and hours labels from bounded paragraphs', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 Test Pavilion | Test Venue</h4>
    <p><strong>Hours:</strong> 10:00 &ndash; 18:00</p>
    <p><strong>Address:</strong> 38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
  `

  assert.deepEqual(parseBiennalePavilions(html, edition).map(record => [record.hours, record.address]), [[
    '10:00 – 18:00',
    '38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]',
  ]])
})

test('uses the verified coordinate rather than address spelling for venue groups', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 First Pavilion | ACC</h4>
    <p>Address: 38 Munhwajeondang-ro, Dong-gu, Gwangju</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
    <h4>2 Second Pavilion | ACC</h4>
    <p>Address: 38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
  `

  const records = parseBiennalePavilions(html, edition)

  assert.equal(records[0].venueGroupKey, records[1].venueGroupKey)
  assert.match(records[0].venueGroupKey, /^biennale-venue-coordinate-v1\|/)
})

test('uses unambiguous NFC-normalized dedupe components without collisions', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 A &amp; B | Venue</h4>
    <p>Address: 1 Test St, Gwangju</p>
    <h4>2 AB | Venue</h4>
    <p>Address: 2 Test St, Gwangju</p>
    <h4>3 Caf\u00e9 | Venue</h4>
    <p>Address: 3 Test St, Gwangju</p>
    <h4>4 Cafe\u0301 | Venue</h4>
    <p>Address: 4 Test St, Gwangju</p>
  `

  const records = parseBiennalePavilions(html, edition)

  assert.notEqual(records[0].dedupeKey, records[1].dedupeKey)
  assert.equal(records[2].dedupeKey, records[3].dedupeKey)
  assert.match(records[0].dedupeKey, /^biennale-dedupe-v1\|n:2:16\|s:5:a & b\|s:5:venue\|d:10:2026-09-05$/)
})

test('keeps an addressless verified venue in review while retaining its coordinate group', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 Test Pavilion | Usable Venue</h4>
    <p>Hours: 10:00-18:00</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
  `

  const [record] = parseBiennalePavilions(html, edition)

  assert.equal(record.address, '')
  assert.equal(record.geocodeStatus, 'verified')
  assert.equal(record.visibility, 'review')
  assert.equal(record.crawlWarning, 'missing_address')
  assert.match(record.venueGroupKey, /^biennale-venue-coordinate-v1\|/)
})
