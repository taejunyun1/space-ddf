# Archive Nearby Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cached nearby bus-stop/route, subway-station, and public-parking information to the independent archive route planner without using Google Places or route APIs.

**Architecture:** Normalize public transport datasets into one D1 `transport_points` table. A Cloudflare Worker module calculates bounded nearest results and exposes `/api/archive/nearby`; the Vue planner requests this endpoint only after a destination is selected. Public data service keys remain Worker secrets and missing datasets degrade to empty sections.

**Tech Stack:** Cloudflare Workers, D1, Node test runner, Vue 3, public Gwangju BIS/parking datasets

## Global Constraints

- Result priority is bus, subway, public parking.
- Return at most 2 bus stops with 5 route names each, 1 subway station, and 2 public parking records.
- Real-time bus arrivals are excluded.
- Sort by straight-line distance ascending.
- Public API keys never enter client bundles or repository files.
- A failed/missing source hides only that section; route planning remains usable.
- Do not enable Google Places, Directions, or Routes APIs.

---

### Task 1: D1 transport cache schema

**Files:**
- Create: `cloudflare/migrations/0010_nearby_transport.sql`
- Create: `cloudflare/test/nearby-transport.test.js`

**Interfaces:**
- Produces: `transport_points` schema consumed by `/api/archive/nearby`.

- [ ] **Step 1: Write a failing schema contract test**

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('transport migration stores normalized public transport points', () => {
  const sql = fs.readFileSync(new URL('../migrations/0010_nearby_transport.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS transport_points/)
  assert.match(sql, /kind TEXT NOT NULL CHECK \(kind IN \('bus_stop', 'subway_station', 'public_parking'\)\)/)
  assert.match(sql, /routes_json TEXT/)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_transport_points_kind_lat_lng/)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/nearby-transport.test.js`

Expected: FAIL with `ENOENT` for migration 0010.

- [ ] **Step 3: Create the migration**

```sql
CREATE TABLE IF NOT EXISTS transport_points (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('bus_stop', 'subway_station', 'public_parking')),
  name TEXT NOT NULL,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  routes_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  source_name TEXT NOT NULL,
  source_updated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_transport_points_kind_lat_lng
  ON transport_points(kind, lat, lng);
```

- [ ] **Step 4: Run the schema test**

Run: `node --test cloudflare/test/nearby-transport.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/migrations/0010_nearby_transport.sql cloudflare/test/nearby-transport.test.js
git commit -m "feat: add nearby transport cache schema"
```

---

### Task 2: Distance calculation and nearby query

**Files:**
- Create: `cloudflare/src/nearby-transport.js`
- Modify: `cloudflare/test/nearby-transport.test.js`

**Interfaces:**
- Produces: `distanceMeters(a, b) -> number`, `listNearbyTransport(env, { lat, lng }) -> { busStops, subwayStations, publicParking, warnings }`.

- [ ] **Step 1: Add failing pure-function and response-shape tests**

```js
import { distanceMeters, rankTransportPoints } from '../src/nearby-transport.js'

test('distance and ranking return approved limits', () => {
  assert.ok(distanceMeters({ lat: 35.15, lng: 126.91 }, { lat: 35.151, lng: 126.91 }) > 100)
  const ranked = rankTransportPoints([
    { id: 'b2', kind: 'bus_stop', lat: 35.152, lng: 126.91, routes_json: '["09","51","55","80","95","98"]' },
    { id: 'b1', kind: 'bus_stop', lat: 35.151, lng: 126.91, routes_json: '["01"]' },
    { id: 's1', kind: 'subway_station', lat: 35.149, lng: 126.91 },
    { id: 'p1', kind: 'public_parking', lat: 35.153, lng: 126.91 },
  ], { lat: 35.15, lng: 126.91 })
  assert.deepEqual(ranked.busStops.map(item => item.id), ['b1', 'b2'])
  assert.equal(ranked.busStops[1].routes.length, 5)
  assert.equal(ranked.subwayStations.length, 1)
  assert.equal(ranked.publicParking.length, 1)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/nearby-transport.test.js`

Expected: FAIL because `nearby-transport.js` is missing.

- [ ] **Step 3: Implement ranking and D1 query**

Implement Haversine distance with Earth radius `6371000`. Query a `0.08` degree bounding box for all three kinds, parse `routes_json` defensively, attach integer `distanceMeters`, sort ascending, and slice with limits `{ bus_stop: 2, subway_station: 1, public_parking: 2 }`. `listNearbyTransport` returns empty arrays plus `warnings: ['transport_unavailable']` when D1 fails.

- [ ] **Step 4: Run tests**

Run: `node --test cloudflare/test/nearby-transport.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/nearby-transport.js cloudflare/test/nearby-transport.test.js
git commit -m "feat: rank cached nearby transport points"
```

---

### Task 3: Public nearby API

**Files:**
- Modify: `cloudflare/src/index.js:1-5,360-405`
- Modify: `test/archive-api-security.test.js`

**Interfaces:**
- Consumes: `listNearbyTransport(env, { lat, lng })`.
- Produces: public GET `/api/archive/nearby?lat={lat}&lng={lng}`.

- [ ] **Step 1: Add failing Worker API tests**

```js
test('nearby API validates coordinates before querying D1', async () => {
  const response = await worker.fetch(new Request('https://archive.test/api/archive/nearby?lat=x&lng=126.9'), { DB: createDb() })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Valid lat and lng are required' })
})
```

Add a valid-coordinate case expecting keys `busStops`, `subwayStations`, `publicParking`, and `warnings`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/archive-api-security.test.js`

Expected: FAIL with 404 for `/api/archive/nearby`.

- [ ] **Step 3: Add the route**

```js
async function nearbyTransport(request, env) {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return error('Valid lat and lng are required', 400)
  return json(await listNearbyTransport(env, { lat, lng }), {
    headers: { 'cache-control': 'public, max-age=300, s-maxage=86400' },
  })
}
```

Dispatch it only for GET `/api/archive/nearby`.

- [ ] **Step 4: Run tests**

Run: `node --test test/archive-api-security.test.js cloudflare/test/nearby-transport.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/index.js test/archive-api-security.test.js
git commit -m "feat: expose cached nearby transport API"
```

---

### Task 4: Authenticated public-data synchronization

**Files:**
- Create: `cloudflare/src/transport-sync.js`
- Create: `cloudflare/test/transport-sync.test.js`
- Modify: `cloudflare/src/index.js`
- Modify: `cloudflare/wrangler.jsonc`
- Modify: `docs/regional-archive-guide.md`

**Interfaces:**
- Produces: `syncTransportPoints(env) -> { saved, warnings }` and authenticated POST `/api/archive/transport/sync`.
- Consumes Worker secrets: `GWANGJU_BUS_API_KEY`, `PUBLIC_DATA_API_KEY`.

- [ ] **Step 1: Write failing normalization tests**

Use small inline fixtures and assert:

```js
assert.deepEqual(normalizeBusStop({ BUSSTOP_ID: '2513', BUSSTOP_NAME: '동원촌', LONGITUDE: '126.82839444', LATITUDE: '35.221225' }), {
  id: 'bus-2513', kind: 'bus_stop', name: '동원촌', lat: 35.221225, lng: 126.82839444,
})
```

Also assert that parking normalization rejects non-public records and that bus route names are deduplicated.

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/transport-sync.test.js`

Expected: FAIL because the sync module is missing.

- [ ] **Step 3: Implement sync normalization and batched upsert**

The module must fetch only when the corresponding secret exists. Use the Gwangju BIS base `https://apis.data.go.kr/6290000/gj_bis` with `/stationInfo`, `/lineInfo`, and `/lineStationInfo`; send the key as the encoded `serviceKey` query parameter. Read parking and subway source URLs from the Worker vars `GWANGJU_PARKING_DATA_URL` and `GWANGJU_SUBWAY_DATA_URL`, require HTTPS, and send `PUBLIC_DATA_API_KEY` as `serviceKey`. Normalize coordinates and upsert with:

```sql
INSERT INTO transport_points (id, kind, name, address, lat, lng, routes_json, metadata_json, source_name, source_updated_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  routes_json = excluded.routes_json,
  metadata_json = excluded.metadata_json,
  source_updated_at = excluded.source_updated_at,
  updated_at = excluded.updated_at
```

Missing keys add `bus_key_missing` or `public_data_key_missing` warnings and do not fail the whole sync. Protect POST `/api/archive/transport/sync` with the existing `x-crawl-secret` check.

- [ ] **Step 4: Run tests and document secrets**

Run: `node --test cloudflare/test/transport-sync.test.js test/archive-api-security.test.js`

Expected: all tests PASS. Documentation names the two secrets without values and includes the Wrangler secret commands.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/transport-sync.js cloudflare/test/transport-sync.test.js cloudflare/src/index.js cloudflare/wrangler.jsonc docs/regional-archive-guide.md
git commit -m "feat: sync Gwangju public transport data"
```

---

### Task 5: Planner nearby-information UI

**Files:**
- Modify: `src/services/archive-api.js`
- Create: `src/components/archive/ArchiveNearbyTransport.vue`
- Modify: `src/views/ArchiveRouteView.vue`
- Modify: `test/archive-route-planner.test.js`

**Interfaces:**
- Produces: `fetchNearbyTransport({ lat, lng })` and a destination-driven transport summary component.

- [ ] **Step 1: Add failing source and pure URL tests**

Assert the service calls `/api/archive/nearby`, the component labels are `버스`, `지하철`, `공영주차장`, and the route view passes only a selected destination's coordinates. Assert absent arrays use `v-if` and no empty fallback row is rendered.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/archive-route-planner.test.js`

Expected: FAIL because service/component contracts are absent.

- [ ] **Step 3: Implement the API client and component**

```js
export async function fetchNearbyTransport({ lat, lng }) {
  const baseUrl = import.meta.env.VITE_ARCHIVE_API_BASE_URL || DEFAULT_ARCHIVE_API_BASE_URL
  const url = new URL('/api/archive/nearby', baseUrl)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lng', String(lng))
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Nearby transport request failed: ${response.status}`)
  return response.json()
}
```

The component renders up to the server-enforced limits, shows distance in meters, and hides a type section when its array is empty. The route view cancels stale display by clearing data before each selected destination request.

- [ ] **Step 4: Run frontend verification**

Run: `node --test test/archive-route-planner.test.js && npm run build:pages`

Expected: tests PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/archive-api.js src/components/archive/ArchiveNearbyTransport.vue src/views/ArchiveRouteView.vue test/archive-route-planner.test.js
git commit -m "feat: show nearby transport in route planner"
```

---

### Task 6: Migration, secrets, data sync, and production QA

**Files:**
- No source files unless a scoped QA defect is found.

**Interfaces:**
- Produces: populated production transport cache.

- [ ] **Step 1: Run all tests**

Run: `npm test && npm run build:pages`

Expected: all tests PASS and build exits 0.

- [ ] **Step 2: Apply D1 migration**

Run from `cloudflare`: `npx wrangler d1 migrations apply space-ddf-archive --remote`

Expected: migration `0010_nearby_transport.sql` succeeds.

- [ ] **Step 3: Configure approved secrets**

Run `npx wrangler secret put GWANGJU_BUS_API_KEY` and `npx wrangler secret put PUBLIC_DATA_API_KEY` from `cloudflare`. Configure the approved HTTPS dataset URLs as `GWANGJU_PARKING_DATA_URL` and `GWANGJU_SUBWAY_DATA_URL` in `cloudflare/wrangler.jsonc`. Paste secret values only into Wrangler prompts; never echo or log them.

- [ ] **Step 4: Deploy Worker and trigger one authenticated sync**

Run from `cloudflare`: `npx wrangler deploy`.

Then POST `/api/archive/transport/sync` with `x-crawl-secret` supplied outside shell history.

Expected: 200 response with `saved > 0`; warnings may report an unavailable optional dataset.

- [ ] **Step 5: Verify live results and planner degradation**

Verify `/api/archive/nearby` for one ACC coordinate and one Biennale coordinate. Confirm distance ordering and actual place names, then temporarily simulate an empty response locally and confirm route planning remains available.
