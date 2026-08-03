# Naver Archive Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/archive-route` Google directions links with coordinate-precise NAVER Maps app links and a NAVER Maps web fallback.

**Architecture:** Keep route selection and ordering in `ArchiveRouteView.vue`, while moving all NAVER URL construction, coordinate validation, venue deduplication, and six-location limiting into pure functions in `archive-route.mjs`. The main action opens the official `nmap://` URL Scheme; a secondary HTTPS link opens NAVER Maps web without adding a paid client API.

**Tech Stack:** Vue 3 Composition API, JavaScript ES modules, Node test runner, NAVER Maps URL Scheme, Cloudflare Pages.

## Global Constraints

- Use collected latitude and longitude rather than name/address search for route points.
- Omit `slat` and `slng` for current-location departure.
- Use fixed coordinates for ACC and Gwangju Biennale origins.
- Deduplicate exhibitions sharing an identical coordinate while preserving first-seen order.
- Support at most five waypoints and one destination per NAVER app URL.
- Use `/route/public` for one-place recommended/transit and `/route/car` for driving or multiple places.
- Keep the existing archive map and global site location map unchanged.
- Do not add NAVER Maps SDK, Google routes clients, or a paid directions API.

---

### Task 1: Pure NAVER Route URL Builder

**Files:**
- Modify: `src/lib/archive-route.mjs`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: archive items shaped as `{ venue, lat, lng }`, `originId`, and `modeId`.
- Produces: `archiveRouteLocations(items)`, `buildArchiveRouteUrl(options)`, `buildArchiveRouteWebUrl()`, and origin records with `lat`, `lng`, and `name`.

- [ ] **Step 1: Replace Google URL assertions with failing NAVER app URL assertions**

```js
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern='NAVER public route' test/archive-route-planner.test.js`

Expected: FAIL because the existing builder returns `https://www.google.com/maps/dir/`.

- [ ] **Step 3: Add failing fixed-origin, dedupe, and five-waypoint tests**

```js
test('NAVER car route maps ACC, five waypoints, and one destination', async () => {
  const { buildArchiveRouteUrl } = await import('../src/lib/archive-route.mjs')
  const items = Array.from({ length: 8 }, (_, index) => ({
    venue: `전시장 ${index + 1}`,
    lat: 35.10 + index / 100,
    lng: 126.80 + index / 100,
  }))
  items.splice(2, 0, { ...items[0], venue: '같은 장소의 다른 전시' })
  const url = new URL(buildArchiveRouteUrl({ items, originId: 'acc', modeId: 'recommended' }))

  assert.equal(`${url.host}${url.pathname}`, 'route/car')
  assert.equal(url.searchParams.get('slat'), '35.147057304166')
  assert.equal(url.searchParams.get('slng'), '126.92003143495')
  assert.equal(url.searchParams.get('sname'), 'ACC')
  assert.equal(url.searchParams.get('v1name'), '전시장 1')
  assert.equal(url.searchParams.get('v5name'), '전시장 5')
  assert.equal(url.searchParams.get('dname'), '전시장 6')
  assert.equal(url.searchParams.has('v6lat'), false)
})
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern='NAVER car route|NAVER public route' test/archive-route-planner.test.js`

Expected: FAIL on the Google protocol/path and missing NAVER parameters.

- [ ] **Step 5: Implement the minimal NAVER URL builder**

```js
const NAVER_APP_NAME = 'https://spaceddf.xyz'
const NAVER_MAX_ROUTE_LOCATIONS = 6

export const ARCHIVE_ROUTE_ORIGINS = Object.freeze([
  { id: 'current', label: '현재 위치', name: '', lat: null, lng: null },
  { id: 'biennale', label: '광주비엔날레전시관', name: '광주비엔날레전시관', lat: 35.18274895, lng: 126.8893391 },
  { id: 'acc', label: 'ACC', name: 'ACC', lat: 35.147057304166, lng: 126.92003143495 },
])

export function archiveRouteLocations(items) {
  const seen = new Set()
  const locations = []
  for (const item of Array.isArray(items) ? items : []) {
    const lat = Number(item?.lat)
    const lng = Number(item?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const key = `${lat},${lng}`
    if (seen.has(key)) continue
    seen.add(key)
    locations.push({ lat, lng, name: String(item?.venue || item?.title || '전시장') })
  }
  return locations
}

export function buildArchiveRouteUrl({ items, originId = 'current', modeId = 'recommended' }) {
  const locations = archiveRouteLocations(items).slice(0, NAVER_MAX_ROUTE_LOCATIONS)
  if (!locations.length) return ''
  const origin = ARCHIVE_ROUTE_ORIGINS.find(option => option.id === originId) || ARCHIVE_ROUTE_ORIGINS[0]
  const action = locations.length > 1 || modeId === 'driving' ? 'car' : 'public'
  const url = new URL(`nmap://route/${action}`)
  const destination = locations.at(-1)
  if (Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    url.searchParams.set('slat', String(origin.lat))
    url.searchParams.set('slng', String(origin.lng))
    url.searchParams.set('sname', origin.name)
  }
  locations.slice(0, -1).forEach((location, index) => {
    const number = index + 1
    url.searchParams.set(`v${number}lat`, String(location.lat))
    url.searchParams.set(`v${number}lng`, String(location.lng))
    url.searchParams.set(`v${number}name`, location.name)
  })
  url.searchParams.set('dlat', String(destination.lat))
  url.searchParams.set('dlng', String(destination.lng))
  url.searchParams.set('dname', destination.name)
  url.searchParams.set('appname', NAVER_APP_NAME)
  return url.toString()
}

export function buildArchiveRouteWebUrl() {
  return 'https://map.naver.com/p/directions/'
}
```

- [ ] **Step 6: Run route utility tests and verify GREEN**

Run: `node --test test/archive-route-planner.test.js`

Expected: all route planner tests pass.

- [ ] **Step 7: Commit the pure routing change**

```bash
git add src/lib/archive-route.mjs test/archive-route-planner.test.js
git commit -m "2026-08-03 네이버 지도 경로 URL 생성"
```

---

### Task 2: NAVER Route Planner UI

**Files:**
- Modify: `src/views/ArchiveRouteView.vue`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: `archiveRouteLocations`, `buildArchiveRouteUrl`, and `buildArchiveRouteWebUrl` from Task 1.
- Produces: a primary NAVER Maps app link, a secondary NAVER Maps web link, and selection-limit feedback.

- [ ] **Step 1: Write failing UI contract tests**

```js
test('planner exposes NAVER app and web actions without Google directions copy', () => {
  const view = readProjectFile('src/views/ArchiveRouteView.vue')

  assert.match(view, /네이버 지도로 경로 열기/)
  assert.match(view, /네이버 지도 웹 열기/)
  assert.match(view, /buildArchiveRouteWebUrl/)
  assert.match(view, /고유 장소 6곳까지만 경로에 포함됩니다/)
  assert.doesNotMatch(view, /Google Maps에서 경유 경로|Google Maps 지원 방식/)
})
```

- [ ] **Step 2: Run the UI contract test and verify RED**

Run: `node --test --test-name-pattern='NAVER app and web actions' test/archive-route-planner.test.js`

Expected: FAIL because the view still contains Google copy and has no NAVER web action.

- [ ] **Step 3: Implement computed URLs and limit state**

```js
import {
  archiveRouteLocations,
  buildArchiveRouteUrl,
  buildArchiveRouteWebUrl,
} from '@/lib/archive-route.mjs'

const routeLocations = computed(() => archiveRouteLocations(selectedItems.value))
const directionsUrl = computed(() => buildArchiveRouteUrl({
  items: selectedItems.value,
  originId: originId.value,
  modeId: modeId.value,
}))
const directionsWebUrl = buildArchiveRouteWebUrl()
const routeLimitExceeded = computed(() => routeLocations.value.length > 6)
```

- [ ] **Step 4: Replace the route action copy and add the web fallback**

```vue
<p>방문할 전시를 순서대로 선택하면 네이버 지도에서 경로를 엽니다.</p>

<p v-if="selectedItems.length > 1 && modeId !== 'driving'" class="route-mode-notice" role="status">
  여러 장소 경유는 네이버 지도 지원 방식에 맞춰 자동차 경로로 엽니다.
</p>
<p v-if="routeLimitExceeded" class="route-mode-notice" role="status">
  고유 장소 6곳까지만 경로에 포함됩니다.
</p>

<a v-if="directionsUrl" class="route-directions-link ddf-focusable" :href="directionsUrl">
  <span>네이버 지도로 경로 열기</span>
</a>
<a class="route-web-link ddf-focusable" :href="directionsWebUrl" target="_blank" rel="noopener noreferrer">
  네이버 지도 웹 열기
</a>
```

- [ ] **Step 5: Run route planner tests and verify GREEN**

Run: `node --test test/archive-route-planner.test.js`

Expected: all route planner tests pass.

- [ ] **Step 6: Commit the planner UI change**

```bash
git add src/views/ArchiveRouteView.vue test/archive-route-planner.test.js
git commit -m "2026-08-03 전시 경로 네이버 지도 UI 교체"
```

---

### Task 3: Full QA and Production Deployment

**Files:**
- Verify: `src/lib/archive-route.mjs`
- Verify: `src/views/ArchiveRouteView.vue`
- Verify: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: completed NAVER route utility and view.
- Produces: verified Cloudflare Pages deployment on `spaceddf.xyz`.

- [ ] **Step 1: Run all automated checks**

Run: `npm test && npm run lint && npm run build:pages`

Expected: all application and scraper tests pass, ESLint exits 0, and Vite creates `dist` successfully.

- [ ] **Step 2: Verify no Google directions dependency remains in the archive route**

Run: `rg -n "google.com/maps/dir|Google Maps에서 경유 경로|Google Maps 지원 방식" src/lib/archive-route.mjs src/views/ArchiveRouteView.vue test/archive-route-planner.test.js`

Expected: no matches.

- [ ] **Step 3: Deploy the Pages production branch**

Run: `npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf`

Expected: deployment completes and prints a `space-ddf-home.pages.dev` URL.

- [ ] **Step 4: Verify the production bundle**

Run: `curl --compressed -sS https://spaceddf.xyz/archive-route` and fetch the emitted `ArchiveRouteView` JavaScript asset.

Expected: production output contains `네이버 지도로 경로 열기`, `nmap://route/`, and no Google directions copy.

- [ ] **Step 5: Commit any QA-only test adjustment, push all commits, and report evidence**

```bash
git status --short
git push
```

Expected: tracked work is committed and `main` pushes successfully without staging unrelated untracked QA directories.
