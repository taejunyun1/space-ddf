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

test('route IDs parse, serialize, toggle, and move in stable order', async () => {
  const {
    moveArchiveRouteId,
    parseArchiveRouteIds,
    serializeArchiveRouteIds,
    toggleArchiveRouteId,
  } = await import('../src/lib/archive-route.mjs')

  assert.deepEqual(parseArchiveRouteIds('a,b,a,,c'), ['a', 'b', 'c'])
  assert.deepEqual(parseArchiveRouteIds(['a,b', 'c']), ['a', 'b', 'c'])
  assert.equal(serializeArchiveRouteIds(['a', 'b', 'a', 'bad,id']), 'a,b')
  assert.deepEqual(toggleArchiveRouteId(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(toggleArchiveRouteId(['a', 'b'], 'a'), ['b'])
  assert.deepEqual(moveArchiveRouteId(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b'])
  assert.deepEqual(moveArchiveRouteId(['a', 'b'], 0, -1), ['a', 'b'])
})

test('current-location transit opens NAVER public route without a fixed origin', async () => {
  const { buildArchiveRouteUrl } = await import('../src/lib/archive-route.mjs')
  const url = new URL(buildArchiveRouteUrl({
    items: [{ venue: '스페이스 디디에프', lat: 35.1503, lng: 126.9099 }],
    originId: 'current',
    modeId: 'transit',
  }))

  assert.equal(url.protocol, 'nmap:')
  assert.equal(`${url.host}${url.pathname}`, 'route/public')
  assert.equal(url.searchParams.has('slat'), false)
  assert.equal(url.searchParams.get('dlat'), '35.1503')
  assert.equal(url.searchParams.get('dlng'), '126.9099')
  assert.equal(url.searchParams.get('dname'), '스페이스 디디에프')
  assert.equal(url.searchParams.get('appname'), 'https://spaceddf.xyz')
})

test('fixed Biennale origin uses its verified coordinates', async () => {
  const { buildArchiveRouteUrl } = await import('../src/lib/archive-route.mjs')
  const url = new URL(buildArchiveRouteUrl({
    items: [{ venue: '목적지', lat: 35.1, lng: 126.9 }],
    originId: 'biennale',
    modeId: 'recommended',
  }))

  assert.equal(url.searchParams.get('slat'), '35.18274895')
  assert.equal(url.searchParams.get('slng'), '126.8893391')
  assert.equal(url.searchParams.get('sname'), '광주비엔날레전시관')
})

test('NAVER car route maps ACC, five waypoints, and one destination', async () => {
  const { buildArchiveRouteUrl } = await import('../src/lib/archive-route.mjs')
  const items = Array.from({ length: 8 }, (_, index) => ({
    venue: `전시장 ${index + 1}`,
    lat: 35.10 + index / 100,
    lng: 126.80 + index / 100,
  }))
  items.splice(2, 0, { ...items[0], venue: '같은 장소의 다른 전시' })
  const url = new URL(buildArchiveRouteUrl({
    items,
    originId: 'acc',
    modeId: 'recommended',
  }))

  assert.equal(`${url.host}${url.pathname}`, 'route/car')
  assert.equal(url.searchParams.get('slat'), '35.147057304166')
  assert.equal(url.searchParams.get('slng'), '126.92003143495')
  assert.equal(url.searchParams.get('sname'), 'ACC')
  assert.equal(url.searchParams.get('v1name'), '전시장 1')
  assert.equal(url.searchParams.get('v5name'), '전시장 5')
  assert.equal(url.searchParams.get('dname'), '전시장 6')
  assert.equal(url.searchParams.has('v6lat'), false)
})

test('archive route locations remove invalid and duplicate coordinates in stable order', async () => {
  const { archiveRouteLocations } = await import('../src/lib/archive-route.mjs')
  const locations = archiveRouteLocations([
    { venue: '첫 장소', lat: 35.1, lng: 126.9 },
    { venue: '좌표 없음', lat: null, lng: null },
    { venue: '같은 장소', lat: 35.1, lng: 126.9 },
    { venue: '둘째 장소', lat: 35.2, lng: 127.0 },
  ])

  assert.deepEqual(locations, [
    { name: '첫 장소', lat: 35.1, lng: 126.9 },
    { name: '둘째 장소', lat: 35.2, lng: 127 },
  ])
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

test('planner exposes ordered multi-selection controls and a readable route action', () => {
  const view = readProjectFile('src/views/ArchiveRouteView.vue')

  assert.match(view, /const selectedIds = computed/)
  assert.match(view, /const selectedItems = computed/)
  assert.match(view, /const destinationItem = computed/)
  assert.match(view, /:aria-pressed="selectedIds\.includes\(item\.id\)"/)
  assert.match(view, /selectedOrder\(item\.id\)/)
  assert.match(view, /moveSelectedItem\(index, -1\)/)
  assert.match(view, /moveSelectedItem\(index, 1\)/)
  assert.match(view, /removeSelectedItem\(item\.id\)/)
  assert.match(view, /clearSelectedItems/)
  assert.match(view, /1곳 길찾기 열기/)
  assert.match(view, /곳 경로 열기/)
  assert.match(view, /여러 장소 경유는 Google Maps 지원 방식에 맞춰 자동차 경로로 엽니다/)
  assert.match(view, /<svg[^>]*aria-hidden="true"/)
  assert.match(view, /min-height:\s*48px/)
  assert.match(view, /\.route-directions-link:hover\s*{[\s\S]*?color:\s*var\(--ddf-paper\);[\s\S]*?background:\s*var\(--ddf-ink\);/)
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

test('archive route suppresses the sidebar map iframe while preserving accessible location details', () => {
  const app = readProjectFile('src/App.vue')

  assert.match(app, /import \{[^}]*computed[^}]*\} from 'vue'/)
  assert.match(app, /import \{ useRoute \} from 'vue-router'/)
  assert.match(app, /const route = useRoute\(\)/)
  assert.match(app, /const showSidebarMap = computed\(\(\) => Boolean\(route\.name\) && route\.name !== 'archive-route'\)/)
  assert.match(app, /<figure(?=[^>]*class="side-map-box")(?=[^>]*v-if="showSidebarMap")[^>]*>[\s\S]*?<iframe[\s\S]*?https:\/\/www\.google\.com\/maps\/embed/)
  assert.match(app, /<a[^>]*class="location-link"[^>]*href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
  assert.match(app, /target="_blank"/)
  assert.match(app, /rel="noopener noreferrer"/)
  assert.match(app, /광주광역시 동구 충장로46번길 8-8 1층/)
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

test('nearby transport client requests the archive nearby endpoint with destination coordinates', () => {
  const service = readProjectFile('src/services/archive-api.js')

  assert.match(service, /export async function fetchNearbyTransport\(\{ lat, lng, signal \}\)/)
  assert.match(service, /new URL\('\/api\/archive\/nearby', baseUrl\)/)
  assert.match(service, /url\.searchParams\.set\('lat', String\(lat\)\)/)
  assert.match(service, /url\.searchParams\.set\('lng', String\(lng\)\)/)
  assert.match(service, /fetch\(url\.toString\(\), \{ headers: \{ accept: 'application\/json' \}, signal \}\)/)
})

test('nearby transport summary keeps empty transport types out of the route planner', () => {
  const componentPath = path.join(projectRoot, 'src/components/archive/ArchiveNearbyTransport.vue')
  assert.ok(fs.existsSync(componentPath), 'nearby transport summary component must exist')

  const component = fs.readFileSync(componentPath, 'utf8')
  assert.match(component, /버스/)
  assert.match(component, /지하철/)
  assert.match(component, /공영주차장/)
  assert.match(component, /v-if="busStops\.length"/)
  assert.match(component, /v-if="subwayStations\.length"/)
  assert.match(component, /v-if="publicParking\.length"/)
  assert.match(component, /distanceMeters/)
  assert.doesNotMatch(component, /정보가 없습니다|없음|empty/i)
})

test('route planner loads nearby transport only for the final destination and cancels stale work', () => {
  const view = readProjectFile('src/views/ArchiveRouteView.vue')

  assert.match(view, /import ArchiveNearbyTransport from '@\/components\/archive\/ArchiveNearbyTransport\.vue'/)
  assert.match(view, /import \{[^}]*fetchNearbyTransport[^}]*\} from '@\/services\/archive-api'/)
  assert.match(view, /<ArchiveNearbyTransport[\s\S]*?:transport="nearbyTransport"[\s\S]*?:loading="nearbyLoading"[\s\S]*?:error="nearbyError"/)
  assert.match(view, /watch\(destinationItem, loadNearbyTransport, \{ immediate: true \}\)/)
  assert.match(view, /nearbyTransport\.value = null[\s\S]*?nearbyError\.value = false[\s\S]*?nearbyLoading\.value = false[\s\S]*?if \(!item/)
  assert.match(view, /if \(!item \|\| !Number\.isFinite\(item\.lat\) \|\| !Number\.isFinite\(item\.lng\)\) return/)
  assert.match(view, /fetchNearbyTransport\(\{ lat: item\.lat, lng: item\.lng, signal: nearbyAbortController\.value\.signal \}\)/)
  assert.match(view, /onBeforeUnmount\(cancelNearbyTransport\)/)
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
