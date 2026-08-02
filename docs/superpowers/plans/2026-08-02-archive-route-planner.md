# Archive Route Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show only ongoing exhibitions on the archive map and provide a separate, DDF-styled `/archive-route` planner that opens the chosen route in a new Google Maps window without loading Google Maps APIs on the planner page.

**Architecture:** Keep `/archive-map` responsible for browsing and selecting current exhibitions. A pure `.mjs` module owns ongoing filtering and Google Maps URL construction; `ArchiveRouteView.vue` consumes the existing archive API, owns destination/origin/mode state, and never imports the Google Maps loader. The selected archive ID travels through `?to={id}`.

**Tech Stack:** Vue 3, Vue Router 4, Vite 8, Node test runner, Cloudflare Pages, Google Maps URLs

## Global Constraints

- Map data is exactly records whose normalized status is `ongoing`; list/archive data remains unchanged.
- Planner route is `/archive-route`; selected destination query is `to`.
- Origins are `current`, `biennale`, and `acc`.
- Modes are `recommended`, `transit`, and `driving`.
- The planner must not import or request Google Maps JavaScript API, Directions API, or Routes API.
- Current location is represented by omitting the Google Maps `origin` parameter.
- Final links use `target="_blank"` and `rel="noopener noreferrer"`.
- No new npm dependency.

---

### Task 1: Pure route and ongoing-item utilities

**Files:**
- Create: `src/lib/archive-route.mjs`
- Create: `test/archive-route-planner.test.js`

**Interfaces:**
- Produces: `ongoingArchiveItems(items) -> Array`, `archiveDestination(item) -> string`, `buildArchiveRouteUrl({ item, originId, modeId }) -> string`, `ARCHIVE_ROUTE_ORIGINS`, `ARCHIVE_ROUTE_MODES`.

- [ ] **Step 1: Write the failing unit tests**

```js
const assert = require('node:assert/strict')
const test = require('node:test')

test('archive route utilities keep only ongoing records', async () => {
  const { ongoingArchiveItems } = await import('../src/lib/archive-route.mjs')
  const items = [{ id: 'a', status: 'ongoing' }, { id: 'b', status: 'closed' }, { id: 'c', status: 'upcoming' }]
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
```

- [ ] **Step 2: Run tests and verify the missing module failure**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/archive-route.mjs`.

- [ ] **Step 3: Implement the pure module**

```js
export const ARCHIVE_ROUTE_ORIGINS = Object.freeze([
  { id: 'current', label: '현재 위치', value: '' },
  { id: 'biennale', label: '광주비엔날레전시관', value: '광주광역시 북구 비엔날레로 111' },
  { id: 'acc', label: 'ACC', value: '광주광역시 동구 문화전당로 38' },
])

export const ARCHIVE_ROUTE_MODES = Object.freeze([
  { id: 'recommended', label: '추천', value: '' },
  { id: 'transit', label: '대중교통', value: 'transit' },
  { id: 'driving', label: '자동차·주차', value: 'driving' },
])

export function ongoingArchiveItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => item.status === 'ongoing')
}

export function archiveDestination(item) {
  if (!item) return ''
  if (item.address) return [item.venue, item.address].filter(Boolean).join(', ')
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? [item.venue, `${lat},${lng}`].filter(Boolean).join(', ')
    : ''
}

export function buildArchiveRouteUrl({ item, originId = 'current', modeId = 'recommended' }) {
  const destination = archiveDestination(item)
  if (!destination) return ''
  const origin = ARCHIVE_ROUTE_ORIGINS.find(option => option.id === originId) || ARCHIVE_ROUTE_ORIGINS[0]
  const mode = ARCHIVE_ROUTE_MODES.find(option => option.id === modeId) || ARCHIVE_ROUTE_MODES[0]
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', destination)
  if (origin.value) url.searchParams.set('origin', origin.value)
  if (mode.value) url.searchParams.set('travelmode', mode.value)
  return url.toString()
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test test/archive-route-planner.test.js`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archive-route.mjs test/archive-route-planner.test.js
git commit -m "feat: add archive route URL utilities"
```

---

### Task 2: Ongoing-only map and planner entry link

**Files:**
- Modify: `src/views/RegionalArchiveView.vue:74-128`
- Modify: `src/components/archive/ArchiveMap.vue:27-58`
- Modify: `test/archive-mobile-tabs.test.js`

**Interfaces:**
- Consumes: `ongoingArchiveItems(items)` from Task 1.
- Produces: router link `/archive-route?to={selectedItem.id}` for a selected ongoing item.

- [ ] **Step 1: Replace the existing closed-only assertion with failing behavior assertions**

```js
test('regional archive map contains only ongoing records and links to the planner', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  const map = readProjectFile('src/components/archive/ArchiveMap.vue')
  assert.match(view, /ongoingArchiveItems\(filteredItems\.value\)/)
  assert.doesNotMatch(view, /item\.status\s*!==\s*'closed'/)
  assert.match(view, /:selection-unavailable="mapSelectionUnavailable"/)
  assert.match(map, /name:\s*'archive-route'/)
  assert.match(map, /query:\s*{\s*to:\s*selectedItem\.id\s*}/)
  assert.match(map, />길찾기</)
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/archive-mobile-tabs.test.js`

Expected: FAIL because the map still filters only `closed` and has no planner link.

- [ ] **Step 3: Implement the ongoing filter and map link**

In `RegionalArchiveView.vue`:

```js
import { ongoingArchiveItems } from '@/lib/archive-route.mjs'

const mapItems = computed(() => ongoingArchiveItems(filteredItems.value))
const mapSelectedItem = computed(() => (
  mapItems.value.find(item => item.id === selectedId.value) || null
))
const mapSelectionUnavailable = computed(() => Boolean(selectedId.value && !mapSelectedItem.value))
```

In `ArchiveMap.vue`, after the source link:

```vue
<router-link
  v-if="selectedItem?.id"
  class="ddf-source-link detail-link route-link"
  :to="{ name: 'archive-route', query: { to: selectedItem.id } }"
>
  길찾기
</router-link>
```

Add an empty overlay when `items.length === 0 && !loading`, and a non-current selection notice when no map item matches the list selection. Copy must be exactly `현재 진행 중인 전시가 없습니다.` and `이 기록은 현재 지도 표시 대상이 아닙니다.`.

Pass `:selection-unavailable="mapSelectionUnavailable"` from the view and add a Boolean `selectionUnavailable` prop to `ArchiveMap.vue`; use that prop for the second notice rather than inferring from the map's fallback selection.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/archive-mobile-tabs.test.js test/archive-route-planner.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/RegionalArchiveView.vue src/components/archive/ArchiveMap.vue test/archive-mobile-tabs.test.js
git commit -m "feat: limit archive map to ongoing exhibitions"
```

---

### Task 3: Independent planner state and page

**Files:**
- Create: `src/views/ArchiveRouteView.vue`
- Modify: `src/router/index.js:12-21`
- Modify: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: `fetchArchiveItems`, `ongoingArchiveItems`, `buildArchiveRouteUrl`, `ARCHIVE_ROUTE_ORIGINS`, `ARCHIVE_ROUTE_MODES`.
- Produces: named route `archive-route`, query-driven selected destination, and safe external route link.

- [ ] **Step 1: Add failing source-contract tests**

```js
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
```

Also add the local `readProjectFile()` helper used by other repository tests.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL because `ArchiveRouteView.vue` and the route do not exist.

- [ ] **Step 3: Add the route and planner implementation**

Router entry:

```js
{
  path: '/archive-route',
  name: 'archive-route',
  component: () => import('@/views/ArchiveRouteView.vue'),
},
```

The view script must use this state contract:

```js
const allItems = ref([])
const loading = ref(true)
const query = ref('')
const activeCity = ref('all')
const originId = ref('current')
const modeId = ref('recommended')
const ongoingItems = computed(() => ongoingArchiveItems(allItems.value))
const visibleItems = computed(() => ongoingItems.value.filter(matchesFilters))
const selectedItem = computed(() => ongoingItems.value.find(item => item.id === String(route.query.to || '')) || null)
const directionsUrl = computed(() => buildArchiveRouteUrl({ item: selectedItem.value, originId: originId.value, modeId: modeId.value }))

function selectDestination(id) {
  router.replace({ name: 'archive-route', query: { ...route.query, to: id } })
}
```

The template must contain: a back link to `regional-archive`, search and city filters, a list of ongoing destinations, three origin radio controls, three mode controls, a start/destination route line, and the safe external anchor. Do not auto-select the first item when `to` is missing or invalid.

- [ ] **Step 4: Run tests and lint the changed files**

Run: `node --test test/archive-route-planner.test.js && npx eslint src/views/ArchiveRouteView.vue src/router/index.js src/lib/archive-route.mjs`

Expected: tests PASS and ESLint exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/views/ArchiveRouteView.vue src/router/index.js test/archive-route-planner.test.js
git commit -m "feat: add independent archive route planner"
```

---

### Task 4: DDF visual system and responsive interaction

**Files:**
- Modify: `src/views/ArchiveRouteView.vue`
- Modify: `test/archive-route-planner.test.js`

**Interfaces:**
- Produces: desktop two-column planner and mobile bottom-sheet controls using existing DDF tokens.

- [ ] **Step 1: Add failing visual-contract assertions**

```js
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
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL on missing route-line/mobile CSS contracts.

- [ ] **Step 3: Add scoped styles and accessible motion behavior**

Use the existing variables only. Desktop `.route-planner-page` is a two-column grid; `.route-planner-panel` is sticky. Mobile below `780px` becomes one column and `.route-controls` is sticky at the bottom with `padding-bottom: calc(14px + env(safe-area-inset-bottom))`. The `.route-line` uses one solid `var(--ddf-line)` vertical rule with two semantic stops; no decorative gradients, shadows, or new fonts. Focus states reuse `.ddf-focusable`.

- [ ] **Step 4: Run tests and production build**

Run: `node --test test/archive-route-planner.test.js && npm run build:pages`

Expected: tests PASS; build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/views/ArchiveRouteView.vue test/archive-route-planner.test.js
git commit -m "style: refine archive route planner UX"
```

---

### Task 5: Direct-route packaging, SEO, and network guard

**Files:**
- Modify: `scripts/prerender-seo.js:14-18`
- Modify: `src/lib/seo.js:8-12,190-240`
- Modify: `test/cloudflare-pages-deploy.test.js`
- Modify: `test/archive-route-planner.test.js`

**Interfaces:**
- Produces: prerendered `/archive-route/index.html`, canonical route metadata, and a source-level Google API import guard.

- [ ] **Step 1: Add failing deployment and SEO tests**

```js
assert.match(source, /'\/archive-route'/)
assert.match(seo, /route\.name === 'archive-route'/)
assert.match(seo, /전시 길찾기/)
```

Add a planner test that reads the transitive imports named in `ArchiveRouteView.vue` and asserts none reference `google-maps.js`, `maps.googleapis.com`, `DirectionsService`, or `Routes API`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test test/archive-route-planner.test.js test/cloudflare-pages-deploy.test.js`

Expected: FAIL because the static route and SEO branch are absent.

- [ ] **Step 3: Add route packaging and SEO metadata**

Set:

```js
const STATIC_SPA_ROUTES = ['/rental', '/archive-map', '/archive-route', '/admin']
```

Add route-specific SEO values:

```js
const ARCHIVE_ROUTE_TITLE = '진행 중 전시 길찾기 | Space DDF'
const ARCHIVE_ROUTE_DESCRIPTION = '현재 위치, 광주비엔날레전시관, ACC에서 진행 중인 지역 전시장까지 이동 경로를 선택합니다.'
```

Use canonical `/archive-route` whenever `route.name === 'archive-route'`; ignore the `to` query in the canonical URL.

- [ ] **Step 4: Run full frontend verification**

Run: `node --test test/archive-route-planner.test.js test/archive-mobile-tabs.test.js test/cloudflare-pages-deploy.test.js && npm run build:pages`

Expected: all tests PASS and `dist/archive-route/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add scripts/prerender-seo.js src/lib/seo.js test/cloudflare-pages-deploy.test.js test/archive-route-planner.test.js
git commit -m "feat: package archive route planner for Pages"
```

---

### Task 6: Browser QA and deployment

**Files:**
- Modify only if QA reveals a scoped defect: files from Tasks 1-5

**Interfaces:**
- Produces: verified production behavior on desktop and mobile.

- [ ] **Step 1: Run the complete regression suite**

Run: `npm test && npm run build:pages`

Expected: all repository tests PASS and build exits 0.

- [ ] **Step 2: Preview and verify interactions**

Run: `npm run preview`

Verify at desktop and a 390px-wide mobile viewport:

- `/archive-map` markers represent only ongoing records.
- `길찾기` preserves the selected ID in `/archive-route?to=...`.
- invalid or closed IDs select nothing.
- current, Biennale, and ACC origins create the expected Google Maps URL.
- Google link opens a new tab.
- planner page network contains no request to `maps.googleapis.com`, `maps.gstatic.com`, Directions, or Routes.

- [ ] **Step 3: Deploy the Pages build**

Run: `npx wrangler pages deploy dist --project-name space-ddf-home --branch main --commit-dirty=true --commit-message "archive route planner"`

Do not change environment variables.

Expected: deployment succeeds and returns a preview URL.

- [ ] **Step 4: Production smoke test**

Run: `SMOKE_BASE_URL=https://spaceddf.xyz npm run smoke:pages`

Expected: smoke command exits 0. Manually repeat the network guard and Google link checks on `https://spaceddf.xyz/archive-route`.

- [ ] **Step 5: Commit any QA-only fix, otherwise record no-code completion**

If a fix was required, commit only its related files with `fix: correct archive route planner QA issue`. If no fix was required, do not create an empty commit.
