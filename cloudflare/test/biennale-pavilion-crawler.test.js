import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  parseBiennaleEdition,
  parseBiennalePavilions,
  runBiennaleEditionIfDue,
  shouldRunBiennaleCrawl,
  webMercatorToWgs84,
} from '../src/biennale-pavilion-crawler.js'

const pavilionFixture = fs.readFileSync(new URL('./fixtures/biennale-pavilion-venues.html', import.meta.url), 'utf8')

function createBiennaleEnv(overrides = {}) {
  const edition = {
    edition: 16,
    edition_year: 2026,
    start_date: '2026-09-05',
    end_date: '2026-11-15',
    crawl_completed_at: null,
    last_attempt_at: null,
    last_attempt_status: null,
    last_error: null,
    ...overrides,
  }
  const statements = []

  return {
    edition,
    statements,
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            statements.push({ sql, values })
            return {
              async first() {
                if (/WHERE crawl_completed_at IS NULL/i.test(sql) && edition.crawl_completed_at) return null
                return { ...edition }
              },
              async run() {
                if (/crawl_completed_at\s*=\s*\?/i.test(sql)) {
                  edition.crawl_completed_at = values[0]
                  edition.last_attempt_at = values[1]
                  edition.last_attempt_status = 'success'
                  edition.last_error = null
                } else if (/last_attempt_status\s*=\s*'failed'/i.test(sql)) {
                  edition.last_attempt_at = values[0]
                  edition.last_attempt_status = 'failed'
                  edition.last_error = values[1]
                }
                return { success: true, meta: { changes: 1 } }
              },
            }
          },
        }
      },
      async batch() {
        return []
      },
    },
  }
}

function successfulResponse(html = pavilionFixture) {
  return {
    ok: true,
    async text() {
      return html
    },
  }
}

test('runs only for an incomplete edition within its inclusive local dates', () => {
  const edition = {
    startDate: '2026-09-05',
    endDate: '2026-11-15',
    crawlCompletedAt: null,
  }

  assert.equal(shouldRunBiennaleCrawl(edition, '2026-09-04'), false)
  assert.equal(shouldRunBiennaleCrawl(edition, '2026-09-05'), true)
  assert.equal(shouldRunBiennaleCrawl(edition, '2026-11-15'), true)
  assert.equal(shouldRunBiennaleCrawl(edition, '2026-11-16'), false)
  assert.equal(shouldRunBiennaleCrawl({ ...edition, crawlCompletedAt: '2026-09-06T00:00:00.000Z' }, '2026-09-06'), false)
})

test('skips before the Seoul start date without fetching', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-04T14:59:59.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'skipped_before_period')
  assert.equal(fetchCount, 0)
})

test('fetches once on the Seoul start date for an incomplete edition', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-04T15:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'completed')
  assert.equal(fetchCount, 1)
  assert.notEqual(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'success')
})

test('skips after the Seoul end date without fetching', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-11-16T03:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'skipped_after_period')
  assert.equal(fetchCount, 0)
})

test('skips a completed edition without fetching', async () => {
  const env = createBiennaleEnv({ crawl_completed_at: '2026-09-05T01:00:00.000Z' })
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-06T03:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'skipped_completed')
  assert.equal(fetchCount, 0)
})

test('records a failed fetch without completing and retries on the next invocation', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0
  const options = {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      if (fetchCount === 1) throw new Error('official site unavailable')
      return successfulResponse()
    },
  }

  const failed = await runBiennaleEditionIfDue(env, options)

  assert.equal(failed.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')

  const retried = await runBiennaleEditionIfDue(env, options)

  assert.equal(retried.status, 'completed')
  assert.equal(fetchCount, 2)
  assert.notEqual(env.edition.crawl_completed_at, null)
})

test('records a failed parse without completing and retries on the next invocation', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0
  const options = {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse(fetchCount <= 2 ? '<p>Temporarily unavailable</p>' : pavilionFixture)
    },
  }

  const failed = await runBiennaleEditionIfDue(env, options)

  assert.equal(failed.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')

  const retried = await runBiennaleEditionIfDue(env, options)

  assert.equal(retried.status, 'completed')
  assert.equal(fetchCount, 3)
})

test('uses English only as an in-attempt fallback when Korean pavilion blocks lack addresses', async () => {
  const env = createBiennaleEnv()
  const urls = []
  const missingAddress = '<h4>1 Pavilion | Venue</h4><p>Hours: 10:00-18:00</p>'

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async url => {
      urls.push(url)
      return successfulResponse(urls.length === 1 ? missingAddress : pavilionFixture)
    },
  })

  assert.equal(result.status, 'completed')
  assert.equal(urls.length, 2)
  assert.notEqual(urls[0], urls[1])
})

test('does not complete when the injected pavilion persistence fails', async () => {
  const env = createBiennaleEnv()

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async () => successfulResponse(),
    persistPavilions: async () => {
      throw new Error('D1 persistence failed')
    },
  })

  assert.equal(result.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
})

test('rejects a discovered edition mismatch without changing archived pavilions', async () => {
  const env = createBiennaleEnv()
  const edition15Html = pavilionFixture.replace('The 16th Gwangju Biennale Pavilion', 'The 15th Gwangju Biennale Pavilion')

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async () => successfulResponse(edition15Html),
  })

  assert.deepEqual(result, { status: 'edition_mismatch', saved: 0 })
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
  assert.equal(env.statements.some(statement => /INSERT INTO exhibitions/i.test(statement.sql)), false)
  assert.equal(env.statements.some(statement => /UPDATE exhibitions\s+SET active = 0/i.test(statement.sql)), false)
  assert.equal(env.statements.some(statement => /INSERT INTO crawl_runs/i.test(statement.sql)), true)
  assert.equal(env.statements.some(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'failed'), true)
  assert.match(env.edition.last_error, /edition mismatch/i)
})

test('persists each verified pavilion while retaining one shared venue group', async () => {
  const env = createBiennaleEnv()

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async () => successfulResponse(),
  })

  assert.equal(result.status, 'completed')
  assert.equal(result.saved, 2)

  const pavilionUpserts = env.statements.filter(statement => /INSERT INTO exhibitions/i.test(statement.sql))
  assert.equal(pavilionUpserts.length, 2)
  assert.deepEqual(pavilionUpserts.map(statement => statement.values[26]), [16, 16])
  assert.equal(pavilionUpserts[0].values[29], pavilionUpserts[1].values[29])
  assert.match(pavilionUpserts[0].values[29], /^biennale-venue-coordinate-v1\|/)
  assert.equal(env.statements.filter(statement => /UPDATE exhibitions\s+SET active = 0/i.test(statement.sql)).length, 1)
})

test('keeps the prior archive active when persistence fails after one pavilion', async () => {
  const env = createBiennaleEnv()
  let metadataBatches = 0
  env.DB.batch = async () => {
    metadataBatches += 1
    if (metadataBatches === 2) throw new Error('second pavilion metadata failed')
    return []
  }

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async () => successfulResponse(),
  })

  assert.equal(result.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
  assert.equal(env.statements.some(statement => /UPDATE exhibitions\s+SET active = 0/i.test(statement.sql)), false)
})

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

test('parses named and numeric em dash entities in bounded edition dates', () => {
  for (const separator of ['&mdash;', '&#8212;', '&#x2014;']) {
    const html = `
      <h3>The 16th Gwangju Biennale Pavilion</h3>
      <p>Dates: September 5 ${separator} November 15, 2026</p>
    `

    assert.deepEqual(parseBiennaleEdition(html), {
      edition: 16,
      editionYear: 2026,
      startDate: '2026-09-05',
      endDate: '2026-11-15',
    }, separator)
  }
})

test('extracts bounded div labels without reading script, style, or the next pavilion block', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 First Pavilion | First Venue</h4>
    <script><div>Address: Scripted Address</div></script>
    <style>.hours::before { content: 'Hours: Scripted Hours'; }</style>
    <div><strong>Address:</strong> First &amp; Main Street, Gwangju</div>
    <div>Hours: 10:00 &#8212; 18:00</div>
    <h4>2 Second Pavilion | Second Venue</h4>
    <div><strong>Address:</strong> Second Address, Gwangju</div>
    <div>Hours: 11:00-19:00</div>
  `

  assert.deepEqual(parseBiennalePavilions(html, edition).map(record => [record.address, record.hours]), [
    ['First & Main Street, Gwangju', '10:00 — 18:00'],
    ['Second Address, Gwangju', '11:00-19:00'],
  ])
})
