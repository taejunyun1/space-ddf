# Archive Multi-Stop Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile archive list use normal page scrolling and let visitors build, reorder, share, and open an ordered multi-exhibition Google Maps route.

**Architecture:** Keep all route state in the existing `/archive-route` query under one comma-separated `to` value. Add pure selection and URL helpers to `archive-route.mjs`, then make `ArchiveRouteView.vue` render and mutate that ordered state while nearby transport follows the final destination. Limit the archive-list change to its mobile layout CSS.

**Tech Stack:** Vue 3 Composition API, Vue Router, native `URL`/`URLSearchParams`, Node test runner, scoped CSS, Cloudflare Pages.

## Global Constraints

- Visit order always remains under user control; do not auto-optimize.
- The last selected exhibition is the destination and earlier selections are ordered waypoints.
- Store ordered IDs as one comma-separated `to` query value; exhibition IDs may not contain commas.
- Do not add Google Maps JavaScript, Directions, Routes, or embedded-map requests.
- Keep map and route candidates limited to ongoing exhibitions while the archive list retains all records.
- Preserve DDF square corners, existing tokens, keyboard focus, and mobile safe-area handling.

---

### Task 1: Ordered route helpers

**Files:**
- Modify: `src/lib/archive-route.mjs`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Produces: `parseArchiveRouteIds(queryValue): string[]`
- Produces: `serializeArchiveRouteIds(ids): string`
- Produces: `toggleArchiveRouteId(ids, id): string[]`
- Produces: `moveArchiveRouteId(ids, index, offset): string[]`
- Changes: `buildArchiveRouteUrl({ items, originId, modeId }): string`

- [ ] **Step 1: Write failing pure-helper tests**

Add tests that assert:

```js
assert.deepEqual(parseArchiveRouteIds('a,b,a,,c'), ['a', 'b', 'c'])
assert.equal(serializeArchiveRouteIds(['a', 'b', 'a']), 'a,b')
assert.deepEqual(toggleArchiveRouteId(['a'], 'b'), ['a', 'b'])
assert.deepEqual(toggleArchiveRouteId(['a', 'b'], 'a'), ['b'])
assert.deepEqual(moveArchiveRouteId(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b'])
assert.deepEqual(moveArchiveRouteId(['a', 'b'], 0, -1), ['a', 'b'])
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run: `node --test --test-name-pattern='route IDs|ordered route' test/archive-route-planner.test.js`

Expected: FAIL because the helper exports do not exist and `buildArchiveRouteUrl` still accepts one `item`.

- [ ] **Step 3: Implement normalized immutable helpers**

Use trimmed non-empty scalar IDs, preserve first occurrence order, reject commas in individual IDs, and always return new arrays. Change URL generation to:

```js
export function buildArchiveRouteUrl({ items, originId = 'current', modeId = 'recommended' }) {
  const destinations = (Array.isArray(items) ? items : []).map(archiveDestination).filter(Boolean)
  if (!destinations.length) return ''
  const destination = destinations.at(-1)
  const waypoints = destinations.slice(0, -1)
  // retain existing origin/mode handling
  url.searchParams.set('destination', destination)
  if (waypoints.length) url.searchParams.set('waypoints', waypoints.join('|'))
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test --test-name-pattern='route IDs|ordered route|current-location|fixed origins' test/archive-route-planner.test.js`

Expected: all matching tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/archive-route.mjs test/archive-route-planner.test.js
git commit -m "2026-08-02 feat: add ordered archive route helpers"
```

### Task 2: Multi-select route planner and readable action

**Files:**
- Modify: `src/views/ArchiveRouteView.vue`
- Test: `test/archive-route-planner.test.js`

**Interfaces:**
- Consumes: ordered route helpers from Task 1.
- Produces: URL-driven selected items, ordered controls, and Google Maps route action.

- [ ] **Step 1: Write failing planner contract tests**

Assert that the view contains:

```js
assert.match(view, /const selectedIds = computed/)
assert.match(view, /const selectedItems = computed/)
assert.match(view, /:aria-pressed="selectedIds\.includes\(item\.id\)"/)
assert.match(view, /selectedOrder\(item\.id\)/)
assert.match(view, /moveSelectedItem\(index, -1\)/)
assert.match(view, /moveSelectedItem\(index, 1\)/)
assert.match(view, /removeSelectedItem\(item\.id\)/)
assert.match(view, /clearSelectedItems/)
assert.match(view, /곳 경로 열기|1곳 길찾기 열기/)
assert.match(view, /<svg[^>]*aria-hidden="true"/)
```

Also replace the nearby-transport watcher assertion so it follows `destinationItem`, the final selected item.

- [ ] **Step 2: Run planner tests and verify RED**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL on missing ordered state, controls, and action copy.

- [ ] **Step 3: Implement URL-driven multi-selection**

Compute valid selected IDs by parsing `route.query.to`, intersecting with ongoing item IDs, and preserving order. Serialize every toggle, move, remove, or clear through one `replaceSelectedIds(ids)` function that calls:

```js
router.replace({
  name: 'archive-route',
  query: { ...route.query, to: serializeArchiveRouteIds(ids) || undefined },
})
```

Render a numbered order badge on selected candidates. The ordered path begins with the origin, labels all non-final items `경유 N`, and labels the last item `도착`. Add accessible move-up, move-down, remove, and clear-all buttons.

- [ ] **Step 4: Implement the primary route action**

Build the link from `selectedItems`. Use an inline directional SVG and computed copy:

```js
const routeActionLabel = computed(() => selectedItems.value.length === 1
  ? '1곳 길찾기 열기'
  : `${selectedItems.value.length}곳 경로 열기`)
```

Style it as a full-width black button with white text, at least 48px tall, a strong border, centered icon/text, and visible hover/focus state. Keep square corners and existing DDF tokens.

- [ ] **Step 5: Run planner tests and verify GREEN**

Run: `node --test test/archive-route-planner.test.js`

Expected: all planner tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/views/ArchiveRouteView.vue test/archive-route-planner.test.js
git commit -m "2026-08-02 feat: support multi-stop archive routes"
```

### Task 3: Natural mobile archive scrolling

**Files:**
- Modify: `src/views/RegionalArchiveView.vue`
- Test: `test/archive-mobile-tabs.test.js`

**Interfaces:**
- Produces: normal document scrolling for mobile list view; map-tab sizing remains bounded.

- [ ] **Step 1: Replace the old height test with a failing natural-scroll test**

Assert inside the mobile media query that `.mobile-list-view .archive-list-pane` uses `height: auto` and `min-height: 0`, and that `.archive-list-content` uses `overflow: visible`. Assert that the mobile list rule contains no `calc(100dvh` and no `overflow-y: auto`.

- [ ] **Step 2: Run the mobile test and verify RED**

Run: `node --test --test-name-pattern='mobile list' test/archive-mobile-tabs.test.js`

Expected: FAIL because the existing list pane uses `calc(100dvh - 58px)`.

- [ ] **Step 3: Remove list-only viewport and nested-scroll constraints**

In the mobile media query, set the list pane and list content to normal flow:

```css
.mobile-list-view .archive-list-pane {
  height: auto;
  min-height: 0;
}

.mobile-list-view .archive-list-content {
  flex: none;
  min-height: 0;
  overflow: visible;
}
```

Do not alter `.mobile-map-view .archive-map-panel` or its bounded map shell.

- [ ] **Step 4: Run mobile tests and verify GREEN**

Run: `node --test test/archive-mobile-tabs.test.js`

Expected: all mobile archive tests pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/views/RegionalArchiveView.vue test/archive-mobile-tabs.test.js
git commit -m "2026-08-02 fix: let mobile archive list use page scroll"
```

### Task 4: Integrated QA and deployment

**Files:**
- Modify only if QA reveals an in-scope defect.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: verified Cloudflare Pages deployment.

- [ ] **Step 1: Run the full automated gate**

Run: `git diff --check && npm test && npm run lint && npm run build:pages`

Expected: exit 0; no failed tests, lint errors, or build errors.

- [ ] **Step 2: Run local browser QA at desktop and 390px mobile**

Verify the archive list scrolls as one page; selection numbering; toggle removal; reorder bounds; clear all; bottom sheet; reload persistence; final destination and ordered `waypoints`; new-tab/`noopener noreferrer`; and no Google Maps API client requests.

- [ ] **Step 3: Deploy to the configured production branch**

Run:

```bash
npx wrangler pages deploy dist \
  --project-name space-ddf-home \
  --branch space-ddf \
  --commit-dirty=true \
  --commit-message "2026-08-02 multi-stop archive route and mobile list"
```

Expected: deployment completes and returns a `space-ddf-home.pages.dev` URL.

- [ ] **Step 4: Run production smoke and direct route checks**

Run: `SMOKE_BASE_URL=https://spaceddf.xyz npm run smoke:pages`

Expected: all smoke routes pass. Then verify `/archive-route/?to=<id-a>,<id-b>` returns 200 and the production UI generates a Google Maps URL whose `waypoints` contains the first venue and whose `destination` contains the last venue.

- [ ] **Step 5: Commit QA-only fixes if any**

If QA required changes, stage only those files and commit with:

```bash
git commit -m "2026-08-02 fix: polish archive route mobile QA"
```
