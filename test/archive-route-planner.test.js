const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const parser = require('@babel/parser')

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

test('planner follows DDF tokens and responsive layout without embedded maps', () => {
  const view = readProjectFile('src/views/ArchiveRouteView.vue')
  assert.match(view, /var\(--ddf-paper\)/)
  assert.match(view, /var\(--ddf-ink\)/)
  assert.match(view, /var\(--ddf-status-open\)/)
  assert.match(view, /grid-template-columns:\s*minmax\(/)
  assert.match(view, /class="route-line"/)
  assert.match(view, /@media \(max-width:\s*780px\)/)
  assert.match(view, /env\(safe-area-inset-bottom\)/)
  assert.match(view, /prefers-reduced-motion/)
  assert.doesNotMatch(view, /<iframe|google-map-canvas/)
})

test('mobile planner controls are collapsed by default and retain page-first source order', () => {
  const view = readProjectFile('src/views/ArchiveRouteView.vue')
  const titleIndex = view.indexOf('<h1 id="route-planner-title"')
  const panelIndex = view.search(/<aside\s+class="route-planner-panel"/)

  assert.ok(titleIndex >= 0 && titleIndex < panelIndex)
  assert.match(view, /const routeControlsOpen = ref\(false\)/)
  assert.match(view, /ref="routeControlsToggle"[\s\S]*?class="route-controls-toggle ddf-focusable"[\s\S]*?:aria-expanded="routeControlsOpen"[\s\S]*?@click="openRouteControls"/)
  assert.match(view, /ref="routeControlsClose"[\s\S]*?class="route-controls-close ddf-focusable"[\s\S]*?@click="closeRouteControls"/)
  assert.match(view, /async function openRouteControls\(\)\s*\{[\s\S]*?routeControlsOpen\.value = true[\s\S]*?routeControlsClose\.value\?\.focus\(\)/)
  assert.match(view, /async function closeRouteControls\(\)\s*\{[\s\S]*?routeControlsOpen\.value = false[\s\S]*?routeControlsToggle\.value\?\.focus\(\)/)
  assert.match(view, /@media \(max-width:\s*780px\)[\s\S]*?\.route-controls\s*\{[\s\S]*?display:\s*none;/)
  assert.match(view, /@media \(max-width:\s*780px\)[\s\S]*?\.route-destinations\s*\{[\s\S]*?padding-bottom:\s*calc\(44px \+ 14px \+ 12px \+ env\(safe-area-inset-bottom\)\);/)
  assert.match(view, /@media \(max-width:\s*780px\)[\s\S]*?\.route-controls\.is-open\s*\{[\s\S]*?display:\s*block;[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*0;[\s\S]*?max-height:\s*calc\(100dvh - 24px\);[\s\S]*?overflow-y:\s*auto;[\s\S]*?env\(safe-area-inset-bottom\)/)
})

test('route planner radio inputs reuse the DDF keyboard focus treatment', () => {
  const view = readProjectFile('src/views/ArchiveRouteView.vue')
  assert.match(view, /<input class="ddf-focusable" v-model="originId" type="radio"/)
  assert.match(view, /<input class="ddf-focusable" v-model="modeId" type="radio"/)
  assert.doesNotMatch(view, /\.route-choice input:focus-visible/)
})

test('archive route has dedicated canonical Korean SEO metadata', () => {
  const seo = readProjectFile('src/lib/seo.js')

  assert.match(seo, /route\.name === 'archive-route'/)
  assert.match(seo, /전시 길찾기/)
  assert.match(seo, /archive-route.*'\/archive-route'|'\/archive-route'.*archive-route/s)
})

test('archive route dependency graph has no Google Maps API client', () => {
  const graph = collectLocalImportGraph('src/views/ArchiveRouteView.vue')
  const forbidden = /google-maps\.js|maps\.googleapis\.com|DirectionsService|Routes API/i

  assert.ok(graph.has('src/lib/archive-route.mjs'), 'guard must inspect route utility imports')
  assert.ok(graph.has('src/services/archive-api.js'), 'guard must inspect archive data imports')

  for (const relativePath of graph) {
    assert.doesNotMatch(readProjectFile(relativePath), forbidden, `${relativePath} imports or invokes a Google Maps API client`)
  }
})

function collectLocalImportGraph(entry) {
  const visited = new Set()
  const pending = [entry]

  while (pending.length) {
    const relativePath = pending.pop()
    if (visited.has(relativePath)) continue
    visited.add(relativePath)

    for (const specifier of staticImportSpecifiers(readProjectFile(relativePath), relativePath)) {
      const resolved = resolveLocalImport(relativePath, specifier)
      if (resolved && !visited.has(resolved)) pending.push(resolved)
    }
  }

  return visited
}

function staticImportSpecifiers(source, relativePath) {
  const script = relativePath.endsWith('.vue')
    ? Array.from(source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g), match => match[1]).join('\n')
    : source
  const ast = parser.parse(script, { sourceType: 'module' })

  return ast.program.body
    .filter(node => node.type === 'ImportDeclaration')
    .map(node => node.source.value)
}

function resolveLocalImport(fromRelativePath, specifier) {
  const sourceRoot = path.join(projectRoot, 'src')
  const basePath = specifier.startsWith('@/')
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(path.join(projectRoot, fromRelativePath)), specifier)
      : null

  if (!basePath) return null

  for (const candidate of [basePath, ...['.js', '.mjs', '.vue'].map(extension => `${basePath}${extension}`), path.join(basePath, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(projectRoot, candidate)
    }
  }

  throw new Error(`Unable to resolve local import ${specifier} from ${fromRelativePath}`)
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}
