const assert = require('node:assert/strict')
const test = require('node:test')

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
