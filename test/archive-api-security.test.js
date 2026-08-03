const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

test('shared crawl-secret helper verifies equal and unequal values asynchronously', async () => {
  const { hasCrawlAccess } = await import('../cloudflare/src/index.js')
  const env = { CRAWL_SECRET: 'configured-test-value' }

  assert.equal(await hasCrawlAccess(new Request('https://archive.test', {
    headers: { 'x-crawl-secret': 'configured-test-value' },
  }), env), true)
  assert.equal(await hasCrawlAccess(new Request('https://archive.test', {
    headers: { 'x-crawl-secret': 'configured-test-value-extra' },
  }), env), false)
})

test('Archive exhibition API always filters public active records and clamps limit to 100', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const db = createDb()
  const response = await worker.fetch(
    new Request('https://archive.test/api/archive/exhibitions?visibility=all&limit=-1'),
    { DB: db, CRAWL_SECRET: 'secret' },
  )
  const payload = await response.json()
  const query = db.calls.find(call => call.sql.includes('FROM exhibitions e'))

  assert.equal(response.status, 200)
  assert.match(query.sql, /e\.visibility = \?/) 
  assert.match(query.sql, /COALESCE\(e\.active, 1\) = 1/)
  assert.equal(query.values[0], 'public')
  assert.equal(query.values.at(-2), 101)
  assert.equal(payload.meta.limit, 100)
})

test('Archive exhibition API derives current status from dates instead of stale stored status', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const db = createDbWithResults([{
    id: 'expired-show',
    title: '지난 전시',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    status: 'ongoing',
    effective_status: 'closed',
  }])
  const response = await worker.fetch(
    new Request('https://archive.test/api/archive/exhibitions?status=closed'),
    { DB: db },
  )
  const payload = await response.json()
  const query = db.calls.find(call => call.sql.includes('FROM exhibitions e'))

  assert.equal(response.status, 200)
  assert.equal(payload.data[0].status, 'closed')
  assert.equal(payload.data[0].statusLabel, '종료')
  assert.match(query.sql, /AS effective_status/)
  assert.match(query.sql, /effective_status = \?/)
  assert.doesNotMatch(query.sql, /e\.status = \?/)
})

test('Archive exhibition API binds source filters before derived status filter', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const db = createDb()
  await worker.fetch(
    new Request('https://archive.test/api/archive/exhibitions?city=gwangju&type=exhibition&status=ongoing'),
    { DB: db },
  )
  const query = db.calls.find(call => call.sql.includes('FROM exhibitions e'))

  assert.deepEqual(query.values, ['public', 'gwangju', 'exhibition', 'ongoing', 101, 0])
})

test('Archive operational source and crawl-run APIs require the crawl secret', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const db = createDb()
  const denied = await worker.fetch(new Request('https://archive.test/api/archive/sources'), {
    DB: db, CRAWL_SECRET: 'secret',
  })
  const allowed = await worker.fetch(new Request('https://archive.test/api/archive/sources', {
    headers: { 'x-crawl-secret': 'secret' },
  }), { DB: db, CRAWL_SECRET: 'secret' })

  assert.equal(denied.status, 401)
  assert.equal(allowed.status, 200)
})

test('transport sync API requires the crawl secret and accepts only POST', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const db = createDb()
  const denied = await worker.fetch(
    new Request('https://archive.test/api/archive/transport/sync', { method: 'POST' }),
    { DB: db, CRAWL_SECRET: 'secret' },
  )
  const allowed = await worker.fetch(
    new Request('https://archive.test/api/archive/transport/sync', {
      method: 'POST',
      headers: { 'x-crawl-secret': 'secret' },
    }),
    { DB: db, CRAWL_SECRET: 'secret' },
  )
  const get = await worker.fetch(
    new Request('https://archive.test/api/archive/transport/sync'),
    { DB: db, CRAWL_SECRET: 'secret' },
  )

  assert.equal(denied.status, 401)
  assert.equal(allowed.status, 200)
  assert.deepEqual(await allowed.json(), { saved: 0, warnings: ['bus_key_missing', 'public_data_key_missing'] })
  assert.equal(get.status, 405)
})

test('biennale crawl endpoint is POST-only, authenticated, and keeps the edition gate', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const get = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale'),
    { DB: createBiennaleDb(), CRAWL_SECRET: 'secret' },
  )
  const denied = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale', { method: 'POST' }),
    { DB: createBiennaleDb(), CRAWL_SECRET: 'secret' },
  )
  const completedDb = createBiennaleDb({ crawl_completed_at: '2026-09-06T00:00:00.000Z' })
  const completed = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale?force=true', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-crawl-secret': 'secret' },
      body: JSON.stringify({ force: true }),
    }),
    { DB: completedDb, CRAWL_SECRET: 'secret' },
  )

  assert.equal(get.status, 405)
  assert.equal(denied.status, 401)
  assert.equal(completed.status, 200)
  assert.deepEqual(await completed.json(), { status: 'skipped_completed' })
  assert.equal(completedDb.calls.some(call => /INSERT INTO crawl_runs/i.test(call.sql)), false)
})

test('biennale reset endpoint is POST-only, authenticated, validates edition, and only resets that edition', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const get = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale/reset'),
    { DB: createBiennaleDb(), CRAWL_SECRET: 'secret' },
  )
  const denied = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale/reset', { method: 'POST' }),
    { DB: createBiennaleDb(), CRAWL_SECRET: 'secret' },
  )
  const invalid = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-crawl-secret': 'secret' },
      body: JSON.stringify({ edition: '16 OR 1=1' }),
    }),
    { DB: createBiennaleDb(), CRAWL_SECRET: 'secret' },
  )
  const missing = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-crawl-secret': 'secret' },
      body: JSON.stringify({ edition: 17 }),
    }),
    { DB: createBiennaleDb(), CRAWL_SECRET: 'secret' },
  )
  const db = createBiennaleDb()
  const reset = await worker.fetch(
    new Request('https://archive.test/api/archive/crawl/gwangju-biennale/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-crawl-secret': 'secret' },
      body: JSON.stringify({ edition: 16 }),
    }),
    { DB: db, CRAWL_SECRET: 'secret' },
  )

  assert.equal(get.status, 405)
  assert.equal(denied.status, 401)
  assert.equal(invalid.status, 400)
  assert.equal(missing.status, 404)
  assert.equal(reset.status, 200)
  assert.deepEqual(await reset.json(), { edition: 16, status: 'reset' })
  const update = db.calls.find(call => /UPDATE biennale_editions/i.test(call.sql))
  assert.match(update.sql, /crawl_completed_at = NULL/)
  assert.match(update.sql, /last_attempt_at = NULL/)
  assert.match(update.sql, /last_attempt_status = NULL/)
  assert.match(update.sql, /last_error = NULL/)
  assert.match(update.sql, /claim_token = NULL/)
  assert.match(update.sql, /claim_expires_at = NULL/)
  assert.deepEqual(update.values, [16])
})

test('biennale reset rejects malformed or non-object payloads without querying D1', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const cases = [
    ['JSON null', { headers: { 'content-type': 'application/json' }, body: 'null' }],
    ['JSON array', { headers: { 'content-type': 'application/json' }, body: '[16]' }],
    ['float edition', { headers: { 'content-type': 'application/json' }, body: '{"edition":16.5}' }],
    ['malformed JSON', { headers: { 'content-type': 'application/json' }, body: '{"edition":' }],
    ['absent body', {}],
    ['wrong content type', { headers: { 'content-type': 'text/plain' }, body: '{"edition":16}' }],
  ]

  for (const [description, init] of cases) {
    const db = createBiennaleDb()
    const response = await worker.fetch(
      new Request('https://archive.test/api/archive/crawl/gwangju-biennale/reset', {
        method: 'POST',
        ...init,
        headers: { ...init.headers, 'x-crawl-secret': 'secret' },
      }),
      { DB: db, CRAWL_SECRET: 'secret' },
    )

    assert.equal(response.status, 400, description)
    assert.deepEqual(await response.json(), { error: 'A positive integer edition is required' }, description)
    assert.equal(db.calls.length, 0, description)
  }
})

test('scheduled crawl dispatch includes the gated biennale runner', () => {
  const source = fs.readFileSync('cloudflare/src/index.js', 'utf8')
  assert.match(source, /runScheduledCrawl\(env, 'gwangju-biennale-pavilion', 'biennale-pavilions-scheduled', \(\) => runBiennaleEditionIfDue\(env, \{ now: new Date\(\) \}\)\)/)
})

test('nearby API rejects invalid raw and numeric coordinates before querying D1', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default

  const cases = [
    ['missing latitude', 'lng=126.9'],
    ['missing longitude', 'lat=35.15'],
    ['empty latitude', 'lat=&lng=126.9'],
    ['empty longitude', 'lat=35.15&lng='],
    ['whitespace latitude', 'lat=%20&lng=126.9'],
    ['whitespace longitude', 'lat=35.15&lng=%20'],
    ['NaN latitude', 'lat=NaN&lng=126.9'],
    ['NaN longitude', 'lat=35.15&lng=NaN'],
    ['out-of-range latitude', 'lat=91&lng=126.9'],
    ['out-of-range longitude', 'lat=35.15&lng=181'],
  ]

  for (const [description, query] of cases) {
    const db = createDb()
    const response = await worker.fetch(new Request(`https://archive.test/api/archive/nearby?${query}`), { DB: db })

    assert.equal(response.status, 400, description)
    assert.deepEqual(await response.json(), { error: 'Valid lat and lng are required' })
    assert.equal(db.calls.length, 0)
  }
})

test('nearby API is GET-only and matches only its exact path', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default

  const postDb = createDb()
  const post = await worker.fetch(
    new Request('https://archive.test/api/archive/nearby?lat=35.15&lng=126.9', { method: 'POST' }),
    { DB: postDb },
  )
  assert.equal(post.status, 405)
  assert.equal(postDb.calls.length, 0)

  const extraPathDb = createDb()
  const extraPath = await worker.fetch(
    new Request('https://archive.test/api/archive/nearby/extra?lat=35.15&lng=126.9'),
    { DB: extraPathDb },
  )
  assert.equal(extraPath.status, 404)
  assert.equal(extraPathDb.calls.length, 0)
})

test('nearby API returns public transport sections with shared-cache headers', async () => {
  const worker = (await import('../cloudflare/src/index.js')).default
  const response = await worker.fetch(
    new Request('https://archive.test/api/archive/nearby?lat=35.15&lng=126.91'),
    { DB: createDb() },
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(Object.keys(payload).sort(), ['busStops', 'publicParking', 'subwayStations', 'warnings'])
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300, s-maxage=86400')
})

function createDb() {
  const calls = []
  return {
    calls,
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { this.values = values; return this },
        async all() { calls.push({ sql, values: this.values }); return { results: [] } },
        async first() { calls.push({ sql, values: this.values }); return { count: 0 } },
      }
    },
  }
}

function createDbWithResults(results) {
  const calls = []
  return {
    calls,
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { this.values = values; return this },
        async all() { calls.push({ sql, values: this.values }); return { results } },
        async first() { calls.push({ sql, values: this.values }); return { count: results.length } },
      }
    },
  }
}

function createBiennaleDb(edition = {}) {
  const calls = []
  const row = {
    edition: 16,
    edition_year: 2026,
    start_date: '2026-09-05',
    end_date: '2026-11-15',
    crawl_completed_at: null,
    ...edition,
  }
  return {
    calls,
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { this.values = values; return this },
        async first() {
          calls.push({ sql, values: this.values })
          if (/FROM biennale_editions/i.test(sql)) {
            if (/WHERE crawl_completed_at IS NULL/i.test(sql) && row.crawl_completed_at) return null
            return row
          }
          return null
        },
        async run() {
          calls.push({ sql, values: this.values })
          if (/UPDATE biennale_editions/i.test(sql) && this.values[0] === row.edition) {
            row.crawl_completed_at = null
            row.last_attempt_at = null
            row.last_attempt_status = null
            row.last_error = null
            return { meta: { changes: 1 } }
          }
          return { meta: { changes: 0 } }
        },
      }
    },
  }
}
