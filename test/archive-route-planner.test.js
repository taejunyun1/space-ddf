const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const projectRoot = path.resolve(__dirname, '..')

test('archive route utilities keep only ongoing records', async () => {
  const { ongoingArchiveItems } = await import('../src/lib/archive-route.mjs')
  const items = [{ id: 'a', status: 'ongoing' }, { id: 'b', status: 'closed' }, { id: 'c', status: 'upcoming' }]
  assert.deepEqual(ongoingArchiveItems(items).map(item => item.id), ['a'])
})

test('archive route utilities normalize ongoing statuses', async () => {
  const { ongoingArchiveItems } = await import('../src/lib/archive-route.mjs')
  const items = [{ id: 'a', status: ' ONGOING ' }, { id: 'b', status: 'closed' }]
  assert.deepEqual(ongoingArchiveItems(items).map(item => item.id), ['a'])
})

test('current-location directions omit origin and encode destination', async () => {
  const { buildArchiveRouteUrl } = await import('../src/lib/archive-route.mjs')
  const url = new URL(buildArchiveRouteUrl({
    item: { venue: '스페이스 디디에프', address: '광주광역시 동구 충장로46번길 8-8' },
    originId: 'current',
    modeId: 'transit',
  }))
  assert.equal(url.searchParams.has('origin'), false)
  assert.equal(url.searchParams.get('destination'), '스페이스 디디에프, 광주광역시 동구 충장로46번길 8-8')
  assert.equal(url.searchParams.get('travelmode'), 'transit')
})

test('fixed origins and recommended mode use the approved values', async () => {
  const { buildArchiveRouteUrl } = await import('../src/lib/archive-route.mjs')
  const url = new URL(buildArchiveRouteUrl({
    item: { venue: '목적지', lat: 35.1, lng: 126.9 },
    originId: 'biennale',
    modeId: 'recommended',
  }))
  assert.equal(url.searchParams.get('origin'), '광주광역시 북구 비엔날레로 111')
  assert.equal(url.searchParams.get('destination'), '목적지, 35.1,126.9')
  assert.equal(url.searchParams.has('travelmode'), false)
})

test('router and planner expose the approved route contract', () => {
  const router = readProjectFile('src/router/index.js')
  const view = readProjectFile('src/views/ArchiveRouteView.vue')
  assert.match(router, /path:\s*'\/archive-route'/)
  assert.match(router, /name:\s*'archive-route'/)
  assert.match(view, /fetchArchiveItems/)
  assert.match(view, /ongoingArchiveItems/)
  assert.match(view, /route\.query\.to/)
  assert.match(view, /router\.replace/)
  assert.match(view, /target="_blank"/)
  assert.match(view, /rel="noopener noreferrer"/)
  assert.doesNotMatch(view, /loadGoogleMapsLibrary|maps\/api\/js|DirectionsService|Routes API/)
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}
