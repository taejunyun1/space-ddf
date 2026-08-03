# Archive Map Radar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `/archive-map`을 진행 중 전시 탐색과 경로 선택 중심으로 개선하고 `/archive-route`와 공통 탭 및 선택 쿼리로 연결한다.

**Architecture:** 진행 전시 필터와 경로 ID 규약은 `archive-route.mjs`에 두 페이지가 공유하는 순수 함수로 유지한다. 지도 화면의 검색·빠른 필터·거리 정렬·선택 상태는 `useRegionalArchive`와 URL `to` 쿼리에서 파생하며, UI는 공통 탭·필터·목록·선택 바의 작은 컴포넌트로 나눈다. 주변 교통 API는 선택된 한 전시에만 요청해 호출량을 제한한다.

**Tech Stack:** Vue 3 Composition API, Vue Router, Vite, Node test runner, Cloudflare Pages Functions/D1, 기존 DDF CSS tokens

## Global Constraints

- 새로운 `/exhibition-radar` 라우트를 만들지 않는다.
- `/archive-map`과 `/archive-route` URL을 유지한다.
- 혼잡도, 혼잡 예상, 방문객 수 추정 기능과 문구를 추가하지 않는다.
- 지도와 목록에는 Asia/Seoul 기준 현재 진행 중인 전시만 표시한다.
- 경로 선택은 현재 `to` 쿼리 규약과 `NAVER_MAX_ROUTE_LOCATIONS = 6`을 공유한다.
- 확인되지 않은 무료 관람, 운영시간, 주차 정보를 추정하지 않는다.
- 주변 교통 API는 상세 선택된 전시에만 호출한다.
- 모바일은 기존 리스트/지도 전환 방식을 유지하며 하단 safe-area를 보장한다.
- 기존 사용자 변경과 `.playwright-cli/`, `.superpowers/brainstorm/`, `.wrangler/`, `output/`은 수정하거나 커밋하지 않는다.

---

## File Structure

- Create `src/components/archive/ArchiveModeTabs.vue`: 전시지도/길찾기 공통 탭과 `to` 쿼리 보존.
- Create `src/components/archive/ArchiveRouteSelectionBar.vue`: 선택 개수, 제한 안내, 길찾기 CTA.
- Modify `src/lib/archive-route.mjs`: 진행 전시 날짜 계산, 오늘 종료 판정, 제한된 ID 토글 순수 함수.
- Modify `src/composables/useRegionalArchive.js`: 빠른 필터, 거리 정렬, 위치 상태, 초기화 기능.
- Modify `src/components/archive/ArchiveFilters.vue`: 현재 위치, 빠른 필터, 정렬 UI.
- Modify `src/components/archive/ArchiveList.vue`: 오늘 종료, 거리, 교통 요약, 경로 선택 버튼.
- Modify `src/components/archive/ArchiveMap.vue`: 경로 선택 상태와 지도 상세의 경로 추가 버튼.
- Modify `src/views/RegionalArchiveView.vue`: 진행 전시만 제공, URL 선택 동기화, 주변 교통 단건 로드, 공통 탭과 선택 바 조합.
- Modify `src/views/ArchiveRouteView.vue`: 공통 탭 추가와 `to` 쿼리 보존.
- Modify `test/archive-route-planner.test.js`: 공유 탭, 제한, 쿼리 및 혼잡도 부재 회귀 테스트.
- Modify `test/regional-archive-mobile.test.js`: 진행 전시, 빠른 필터, 선택 바, 모바일 레이아웃 회귀 테스트.

---

### Task 1: Shared Archive Status and Route Selection Rules

**Files:**
- Modify: `src/lib/archive-route.mjs`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: archive item objects with `id`, `status`, `startDate`, `endDate`, `lat`, `lng`.
- Produces: `isArchiveEndingToday(item, now?)`, `toggleLimitedArchiveRouteId(ids, id, limit?)`, existing `ongoingArchiveItems(items)` and `NAVER_MAX_ROUTE_LOCATIONS`.

- [ ] **Step 1: Write failing tests for ending-today and limited selection**

```js
test('ending today uses the Asia/Seoul calendar date', () => {
  assert.equal(isArchiveEndingToday({ endDate: '2026-08-03' }, new Date('2026-08-03T14:59:00Z')), true)
  assert.equal(isArchiveEndingToday({ endDate: '2026-08-02' }, new Date('2026-08-03T14:59:00Z')), false)
})

test('limited route selection refuses a seventh location', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f']
  assert.deepEqual(toggleLimitedArchiveRouteId(six, 'g'), six)
  assert.deepEqual(toggleLimitedArchiveRouteId(six, 'f'), ['a', 'b', 'c', 'd', 'e'])
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL because `isArchiveEndingToday` and `toggleLimitedArchiveRouteId` are not exported.

- [ ] **Step 3: Implement the minimal pure functions**

```js
export function isArchiveEndingToday(item, now = new Date()) {
  const endDate = String(item?.endDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false
  const seoulDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return endDate === seoulDate
}

export function toggleLimitedArchiveRouteId(ids, id, limit = NAVER_MAX_ROUTE_LOCATIONS) {
  const normalized = uniqueRouteIds(ids)
  const target = routeId(id)
  if (!target) return normalized
  if (normalized.includes(target)) return normalized.filter(current => current !== target)
  if (normalized.length >= limit) return normalized
  return [...normalized, target]
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/archive-route-planner.test.js`

Expected: all archive route planner tests PASS.

- [ ] **Step 5: Commit the shared rule layer**

```bash
git add src/lib/archive-route.mjs test/archive-route-planner.test.js
git commit -m "2026-08-03 전시지도 경로 선택 규칙 추가"
```

---

### Task 2: Shared Map and Route Tabs

**Files:**
- Create: `src/components/archive/ArchiveModeTabs.vue`
- Modify: `src/views/RegionalArchiveView.vue`
- Modify: `src/views/ArchiveRouteView.vue`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: prop `selectedIds: string[]`; current route path.
- Produces: two `RouterLink` controls with `{ path: '/archive-map' | '/archive-route', query: { to?: string } }`.

- [ ] **Step 1: Add a failing source-contract test**

```js
test('archive map and route share query-preserving mode tabs', () => {
  const tabs = read('src/components/archive/ArchiveModeTabs.vue')
  const mapView = read('src/views/RegionalArchiveView.vue')
  const routeView = read('src/views/ArchiveRouteView.vue')
  assert.match(tabs, /전시지도/)
  assert.match(tabs, /길찾기/)
  assert.match(tabs, /serializeArchiveRouteIds/)
  assert.match(tabs, /aria-current/)
  assert.match(mapView, /<ArchiveModeTabs/)
  assert.match(routeView, /<ArchiveModeTabs/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL because `ArchiveModeTabs.vue` does not exist.

- [ ] **Step 3: Implement `ArchiveModeTabs.vue` and mount it in both views**

```vue
<template>
  <nav class="archive-mode-tabs" aria-label="전시 아카이브 기능">
    <RouterLink v-for="tab in tabs" :key="tab.path" :to="tab.to"
      class="archive-mode-tab ddf-focusable" :aria-current="route.path === tab.path ? 'page' : undefined">
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { serializeArchiveRouteIds } from '@/lib/archive-route.mjs'
const props = defineProps({ selectedIds: { type: Array, default: () => [] } })
const route = useRoute()
const toQuery = computed(() => serializeArchiveRouteIds(props.selectedIds))
const tabs = computed(() => ['/archive-map', '/archive-route'].map((path, index) => ({
  path, label: index ? '길찾기' : '전시지도',
  to: { path, query: toQuery.value ? { to: toQuery.value } : {} },
})))
</script>
```

Add `<ArchiveModeTabs :selected-ids="selectedIds" />` below each page header and use the existing DDF line, paper, ink, focus tokens for a two-column tab style.

- [ ] **Step 4: Run the focused test and build**

Run: `node --test test/archive-route-planner.test.js && npm run build:pages`

Expected: PASS and Vite build succeeds.

- [ ] **Step 5: Commit the shared tabs**

```bash
git add src/components/archive/ArchiveModeTabs.vue src/views/RegionalArchiveView.vue src/views/ArchiveRouteView.vue test/archive-route-planner.test.js
git commit -m "2026-08-03 전시지도 길찾기 공통 탭 추가"
```

---

### Task 3: Ongoing Radar Filters and Location Sorting

**Files:**
- Modify: `src/composables/useRegionalArchive.js`
- Modify: `src/components/archive/ArchiveFilters.vue`
- Modify: `src/views/RegionalArchiveView.vue`
- Test: `test/regional-archive-mobile.test.js`

**Interfaces:**
- Consumes: ongoing archive items, `currentLocation: { lat: number, lng: number } | null`.
- Produces: `activeQuickFilter`, `activeSort`, `requestLocation`, `resetFilters`, and `filteredItems` ordered by stable default or distance.

- [ ] **Step 1: Add failing tests for radar controls and ongoing-only input**

```js
test('regional archive exposes verified radar filters without crowd copy', () => {
  assert.match(view, /v-model:activeQuickFilter/)
  assert.match(filters, /오늘 종료/)
  assert.match(filters, /무료/)
  assert.match(filters, /주차 가능/)
  assert.match(filters, /내 주변/)
  assert.doesNotMatch(`${view}\n${filters}\n${composable}`, /혼잡|crowd/i)
})

test('regional archive feeds only ongoing records into list and map', () => {
  assert.match(view, /ongoingArchiveItems\(archiveItems\.value\)/)
  assert.match(view, /useRegionalArchive\(ongoingItems/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/regional-archive-mobile.test.js`

Expected: FAIL because quick filters and location controls are absent.

- [ ] **Step 3: Add filter state and explicit verified predicates**

```js
const activeQuickFilter = ref('all')
const activeSort = ref('default')
const currentLocation = ref(null)

function matchesQuickFilter(item) {
  if (activeQuickFilter.value === 'ending-today') return isArchiveEndingToday(item)
  if (activeQuickFilter.value === 'free') return item.admission === 'free' || item.isFree === true
  if (activeQuickFilter.value === 'parking') return item.nearbyTransport?.parking?.length > 0
  return true
}
```

Use a haversine helper only when `currentLocation` and valid item coordinates exist. Preserve source order for equal or missing distances. `requestLocation()` calls browser geolocation once with `maximumAge: 300000` and non-blocking denial handling.

- [ ] **Step 4: Add the controls to `ArchiveFilters.vue`**

Add props/models for `activeQuickFilter`, `activeSort`, `locationAvailable`, and emit `request-location`. Render actual buttons for `전체`, `오늘 종료`, `무료`, `주차 가능`, plus a `<select>` for `기본 순서` and `가까운 순`; hide/disable `가까운 순` until location exists.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test test/regional-archive-mobile.test.js`

Expected: all regional archive tests PASS.

- [ ] **Step 6: Commit the radar filters**

```bash
git add src/composables/useRegionalArchive.js src/components/archive/ArchiveFilters.vue src/views/RegionalArchiveView.vue test/regional-archive-mobile.test.js
git commit -m "2026-08-03 전시지도 탐색 필터 개선"
```

---

### Task 4: Route Selection in List and Map

**Files:**
- Create: `src/components/archive/ArchiveRouteSelectionBar.vue`
- Modify: `src/components/archive/ArchiveList.vue`
- Modify: `src/components/archive/ArchiveMap.vue`
- Modify: `src/views/RegionalArchiveView.vue`
- Test: `test/regional-archive-mobile.test.js`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: `selectedIds: string[]`, `selectedItems: ArchiveItem[]`, `limit: number`, item IDs.
- Produces: `toggle-route` events and `/archive-route?to=<ordered IDs>` CTA.

- [ ] **Step 1: Add failing source-contract tests**

```js
test('archive list and map expose ordered route selection', () => {
  assert.match(list, /selected-route-ids/)
  assert.match(list, /경로에 추가/)
  assert.match(list, /선택됨/)
  assert.match(map, /toggle-route/)
  assert.match(view, /toggleLimitedArchiveRouteId/)
  assert.match(view, /ArchiveRouteSelectionBar/)
})

test('selection bar links to the existing route planner with ordered IDs', () => {
  const bar = read('src/components/archive/ArchiveRouteSelectionBar.vue')
  assert.match(bar, /serializeArchiveRouteIds/)
  assert.match(bar, /길찾기에서 순서 정하기/)
  assert.match(bar, /최대 6곳/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/regional-archive-mobile.test.js test/archive-route-planner.test.js`

Expected: FAIL because the route selection bar and controls do not exist.

- [ ] **Step 3: Implement URL-backed selection in `RegionalArchiveView.vue`**

```js
const route = useRoute()
const router = useRouter()
const selectedRouteIds = computed(() => {
  const ongoingIds = new Set(ongoingItems.value.map(item => item.id))
  return parseArchiveRouteIds(route.query.to)
    .filter(id => ongoingIds.has(id))
    .slice(0, NAVER_MAX_ROUTE_LOCATIONS)
})

function toggleRouteItem(id) {
  const ids = toggleLimitedArchiveRouteId(selectedRouteIds.value, id)
  router.replace({ query: { ...route.query, to: serializeArchiveRouteIds(ids) || undefined } })
}
```

- [ ] **Step 4: Implement list, map, and selection bar UI**

`ArchiveList` and `ArchiveMap` receive `selectedRouteIds` and emit `toggle-route`. Disable unselected add buttons when the limit is reached, but keep selected removal buttons enabled. The selection bar renders selected item names, `n / 6곳`, the limit status message, and a `RouterLink` to `/archive-route` with the serialized query.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test test/regional-archive-mobile.test.js test/archive-route-planner.test.js`

Expected: PASS with ordered selection and seventh-item prevention covered.

- [ ] **Step 6: Commit route selection UI**

```bash
git add src/components/archive/ArchiveRouteSelectionBar.vue src/components/archive/ArchiveList.vue src/components/archive/ArchiveMap.vue src/views/RegionalArchiveView.vue test/regional-archive-mobile.test.js test/archive-route-planner.test.js
git commit -m "2026-08-03 전시지도 다중 경로 선택 추가"
```

---

### Task 5: Selected Exhibition Transport Summary and Empty States

**Files:**
- Modify: `src/views/RegionalArchiveView.vue`
- Modify: `src/components/archive/ArchiveList.vue`
- Modify: `src/components/archive/ArchiveNearbyTransport.vue`
- Test: `test/archive-route-planner.test.js`
- Test: `test/regional-archive-mobile.test.js`

**Interfaces:**
- Consumes: `fetchNearbyTransport({ lat, lng, signal })` for only `selectedItem`.
- Produces: selected card transport summary; non-blocking loading/error state; filter reset empty state.

- [ ] **Step 1: Add failing tests for bounded transport loading**

```js
test('archive map loads nearby transport only for the selected exhibition', () => {
  assert.match(view, /watch\(selectedItem/)
  assert.match(view, /fetchNearbyTransport\(\{ lat: item\.lat, lng: item\.lng/)
  assert.match(view, /AbortController/)
  assert.doesNotMatch(view, /Promise\.all\([^)]*fetchNearbyTransport/)
})

test('archive list hides missing metadata and exposes filter reset', () => {
  assert.match(list, /v-if="distanceLabel\(item\)"/)
  assert.match(list, /v-if="transportSummary/)
  assert.match(list, /필터 초기화/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/regional-archive-mobile.test.js test/archive-route-planner.test.js`

Expected: FAIL because map-side transport loading and reset UI are absent.

- [ ] **Step 3: Implement cancelable selected-item transport loading**

```js
watch(selectedItem, async item => {
  transportController?.abort()
  selectedTransport.value = null
  if (!item || !validCoordinate(item.lat) || !validCoordinate(item.lng)) return
  transportController = new AbortController()
  try {
    selectedTransport.value = await fetchNearbyTransport({
      lat: item.lat, lng: item.lng, signal: transportController.signal,
    })
  } catch (error) {
    if (error.name !== 'AbortError') transportError.value = true
  }
}, { immediate: true })
```

- [ ] **Step 4: Render only populated metadata and distinct empty states**

Pass transport only to the selected list item. Render bus route count, subway count, and public parking count only when non-zero. Show `현재 진행 중인 전시가 없습니다` when the ongoing source is empty; otherwise show `조건에 맞는 전시가 없습니다` with a `필터 초기화` button.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test test/regional-archive-mobile.test.js test/archive-route-planner.test.js`

Expected: PASS and no transport fan-out pattern is present.

- [ ] **Step 6: Commit transport and empty states**

```bash
git add src/views/RegionalArchiveView.vue src/components/archive/ArchiveList.vue src/components/archive/ArchiveNearbyTransport.vue test/regional-archive-mobile.test.js test/archive-route-planner.test.js
git commit -m "2026-08-03 전시지도 교통 요약 및 빈 상태 개선"
```

---

### Task 6: Responsive Visual Integration and Production QA

**Files:**
- Modify: `src/views/RegionalArchiveView.vue`
- Modify: `src/views/ArchiveRouteView.vue`
- Modify: `src/components/archive/ArchiveModeTabs.vue`
- Modify: `src/components/archive/ArchiveRouteSelectionBar.vue`
- Modify: `src/components/archive/ArchiveFilters.vue`
- Modify: `src/components/archive/ArchiveList.vue`
- Modify: `test/regional-archive-mobile.test.js`

**Interfaces:**
- Consumes: accepted V2 mockup at `.superpowers/brainstorm/38310-1785736462/content/exhibition-radar-no-crowd.html` as visual direction only.
- Produces: DDF-styled responsive map/list workflow with no clipped content or horizontal page overflow.

- [ ] **Step 1: Add failing responsive source assertions**

```js
test('archive radar keeps the mobile map/list tabs and safe route bar', () => {
  assert.match(view, /mobile-view-tabs/)
  assert.match(selectionBar, /env\(safe-area-inset-bottom\)/)
  assert.match(modeTabs, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/regional-archive-mobile.test.js`

Expected: FAIL until the common tab and safe-area styles exist.

- [ ] **Step 3: Apply the accepted visual hierarchy with existing DDF tokens**

Keep the current paper/ink/line typography system. On desktop, retain the list/map split and place mode tabs above search. On mobile, retain the list/map view switch, allow filter chips to scroll horizontally, and keep the selection bar in normal/sticky flow without covering the last card. Do not introduce crowd colors or a new dashboard visual language.

- [ ] **Step 4: Run automated verification**

Run: `npm test && npm run lint && npm run build:pages && git diff --check`

Expected: 268 or more tests PASS, ESLint exits 0, Vite/Pages build succeeds, and diff check is clean.

- [ ] **Step 5: Run browser QA at desktop and mobile sizes**

Start: `npm run dev -- --host 127.0.0.1`

Verify:
- `/archive-map` shows only ongoing records and common tabs.
- Search, existing filters, quick filters, map/list mobile switch, and filter reset work.
- Location allow and deny paths remain usable.
- One through six selections persist in `to`; seventh selection is disabled.
- `/archive-route` receives ordered selections and back-navigation preserves them.
- Missing transport metadata does not leave empty labels.
- No `혼잡` or `crowd` copy appears.
- 1440×900 desktop and 390×844 mobile have no horizontal page overflow or clipped CTA.

- [ ] **Step 6: Commit responsive integration**

```bash
git add src/views/RegionalArchiveView.vue src/views/ArchiveRouteView.vue src/components/archive/ArchiveModeTabs.vue src/components/archive/ArchiveRouteSelectionBar.vue src/components/archive/ArchiveFilters.vue src/components/archive/ArchiveList.vue test/regional-archive-mobile.test.js
git commit -m "2026-08-03 전시지도 레이더 반응형 통합"
```

- [ ] **Step 7: Push and deploy after final verification**

```bash
git push origin main
npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf
```

Expected: deployment URL is returned; `https://spaceddf.xyz/archive-map` and `https://spaceddf.xyz/archive-route` return HTTP 200 after redirects.

