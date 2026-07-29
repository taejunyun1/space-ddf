const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('www redirect Worker preserves path and query on the canonical domain', async () => {
  const worker = (await import('../workers/www-redirect/index.mjs')).default
  const response = await worker.fetch(
    new Request('https://www.spaceddf.xyz/rental?source=www')
  )

  assert.equal(response.status, 301)
  assert.equal(response.headers.get('location'), 'https://spaceddf.xyz/rental?source=www')
})

test('www redirect Worker owns only the www hostname route', () => {
  const config = fs.readFileSync(path.join(root, 'wrangler.www-redirect.jsonc'), 'utf8')

  assert.match(config, /"workers_dev"\s*:\s*false/)
  assert.match(config, /"pattern"\s*:\s*"www\.spaceddf\.xyz\/\*"/)
  assert.match(config, /"zone_name"\s*:\s*"spaceddf\.xyz"/)
})
