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
