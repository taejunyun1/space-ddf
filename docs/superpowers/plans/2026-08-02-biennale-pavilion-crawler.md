# Gwangju Biennale Pavilion Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import official Gwangju Biennale pavilion venues once per edition during the stored exhibition period, group shared physical venues on the map, and never request the official site outside the execution gate.

**Architecture:** D1 stores edition dates and one-success completion state. The daily Worker cron performs only a local gate check; it calls a dedicated official-site parser once when an edition is active and incomplete, retries only failures, and persists pavilions through the existing archive tables. Parser, gate, and persistence are independently testable.

**Tech Stack:** Cloudflare Workers, D1, Node test runner, official Gwangju Biennale HTML

## Global Constraints

- Source ID is `gwangju-biennale-pavilion`.
- 2026 edition is 16; execution window is `2026-09-05` through `2026-11-15` in `Asia/Seoul`.
- No official-site request before the start date, after the end date, or after first success.
- Failed runs retry on the next scheduled event; successful runs never retry unless an authenticated manual reset occurs.
- Korean official page is primary; English is fallback only.
- Edition mismatch never overwrites public data and records `edition_mismatch`.
- Missing/unverified coordinates remain review-only and never create a public map marker.
- Same physical venue groups by `venueGroupKey`; individual pavilion exhibition records remain separate.

---

### Task 1: Edition gate and pavilion metadata schema

**Files:**
- Create: `cloudflare/migrations/0011_biennale_pavilions.sql`
- Create: `cloudflare/test/biennale-pavilion-crawler.test.js`

**Interfaces:**
- Produces: `biennale_editions` table and optional pavilion columns on `exhibitions`.

- [ ] **Step 1: Write the failing schema contract**

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('biennale migration stores edition gate and pavilion metadata', () => {
  const sql = fs.readFileSync(new URL('../migrations/0011_biennale_pavilions.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS biennale_editions/)
  assert.match(sql, /crawl_completed_at TEXT/)
  assert.match(sql, /INSERT INTO biennale_editions[\s\S]*2026-09-05[\s\S]*2026-11-15/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN pavilion_name TEXT/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN venue_group_key TEXT/)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: FAIL with `ENOENT` for migration 0011.

- [ ] **Step 3: Create the migration**

```sql
CREATE TABLE IF NOT EXISTS biennale_editions (
  edition INTEGER PRIMARY KEY,
  edition_year INTEGER NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  crawl_completed_at TEXT,
  last_attempt_at TEXT,
  last_attempt_status TEXT CHECK (last_attempt_status IN ('success', 'failed') OR last_attempt_status IS NULL),
  last_error TEXT
);

INSERT OR IGNORE INTO biennale_editions (edition, edition_year, start_date, end_date)
VALUES (16, 2026, '2026-09-05', '2026-11-15');

INSERT OR IGNORE INTO sources (id, name, base_url, source_type, robots_notes)
VALUES ('gwangju-biennale-pavilion', '광주비엔날레 파빌리온', 'https://www.gwangjubiennale.org', 'crawl', 'Official public pavilion and venue pages only');

ALTER TABLE exhibitions ADD COLUMN edition INTEGER;
ALTER TABLE exhibitions ADD COLUMN edition_year INTEGER;
ALTER TABLE exhibitions ADD COLUMN pavilion_name TEXT;
ALTER TABLE exhibitions ADD COLUMN venue_group_key TEXT;
ALTER TABLE exhibitions ADD COLUMN geocode_status TEXT CHECK (geocode_status IN ('verified', 'needs_review') OR geocode_status IS NULL);
ALTER TABLE exhibitions ADD COLUMN crawl_warning TEXT;

CREATE INDEX IF NOT EXISTS idx_exhibitions_edition_venue_group
  ON exhibitions(edition_year, venue_group_key, active);
```

- [ ] **Step 4: Run the schema test**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/migrations/0011_biennale_pavilions.sql cloudflare/test/biennale-pavilion-crawler.test.js
git commit -m "feat: add biennale edition gate schema"
```

---

### Task 2: Official venue parser and coordinate conversion

**Files:**
- Create: `cloudflare/src/biennale-pavilion-crawler.js`
- Create: `cloudflare/test/fixtures/biennale-pavilion-venues.html`
- Modify: `cloudflare/test/biennale-pavilion-crawler.test.js`

**Interfaces:**
- Produces: `parseBiennaleEdition(html)`, `parseBiennalePavilions(html, edition)`, `webMercatorToWgs84(x, y)`.

- [ ] **Step 1: Add a minimal official-shape fixture and failing parser tests**

Fixture content:

```html
<h3>The 16th Gwangju Biennale Pavilion</h3>
<p>Dates: September 5 - November 15, 2026</p>
<h4>1 Malaysia | National Asian Culture Center(ACC), Creation Space 5</h4>
<p>Hours: 10:00-18:00</p>
<p>Address: 38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]</p>
<a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
<h4>2 Myanmar | ACC, Creation Space 5</h4>
<p>Address: 38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]</p>
<a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
```

Tests assert edition/year/dates, two separate pavilion records, identical `venueGroupKey`, verified coordinates near Gwangju, and dedupe keys containing edition, pavilion, venue, and start date.

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: FAIL because parser exports are missing.

- [ ] **Step 3: Implement parsing**

Use bounded heading blocks rather than one page-wide regex. Normalize HTML entities and whitespace. Parse titles as `pavilionName | venueName`; parse address, hours, map URL, edition, and date range. Convert Web Mercator with:

```js
export function webMercatorToWgs84(x, y) {
  const originShift = 20037508.342789244
  const lng = Number(x) / originShift * 180
  const lat = 180 / Math.PI * (2 * Math.atan(Math.exp(Number(y) / originShift * Math.PI)) - Math.PI / 2)
  return { lat, lng }
}
```

Set `geocodeStatus='verified'` only for finite coordinates inside the broad Gwangju bounds `34.9 <= lat <= 35.4` and `126.6 <= lng <= 127.1`; otherwise set `needs_review`, `visibility='review'`, and `crawlWarning='missing_coordinates'`.

- [ ] **Step 4: Run parser tests**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: parser and conversion tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/biennale-pavilion-crawler.js cloudflare/test/fixtures/biennale-pavilion-venues.html cloudflare/test/biennale-pavilion-crawler.test.js
git commit -m "feat: parse official biennale pavilion venues"
```

---

### Task 3: Local execution gate

**Files:**
- Modify: `cloudflare/src/biennale-pavilion-crawler.js`
- Modify: `cloudflare/test/biennale-pavilion-crawler.test.js`

**Interfaces:**
- Produces: `shouldRunBiennaleCrawl(edition, now) -> boolean`, `runBiennaleEditionIfDue(env, { now, fetchImpl })`.

- [ ] **Step 1: Add failing gate tests**

Test four exact cases with a fetch spy:

- `2026-09-04`: returns `skipped_before_period`, fetch count 0.
- `2026-09-05` with `crawlCompletedAt=null`: fetch count 1.
- `2026-11-16`: returns `skipped_after_period`, fetch count 0.
- `2026-09-06` with completed timestamp: returns `skipped_completed`, fetch count 0.

Add a failed-fetch case asserting completion remains null and the next invocation fetches again.

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: FAIL because gate functions are missing.

- [ ] **Step 3: Implement the gate before all network calls**

```js
export function shouldRunBiennaleCrawl(edition, today) {
  if (!edition || edition.crawlCompletedAt) return false
  return edition.startDate <= today && today <= edition.endDate
}
```

`runBiennaleEditionIfDue` reads the current incomplete edition from D1 first, calculates the `Asia/Seoul` date, returns a skip result without calling `fetchImpl` when outside the gate, and records `last_attempt_at/status/error`. It sets `crawl_completed_at` only after parse validation and all persistence operations succeed.

Within an allowed run, fetch the Korean official venue URL first. Fetch the English venue URL only when the Korean response has no pavilion blocks or lacks address fields. Both requests belong to the same one-time edition attempt; no fallback request is allowed outside the gate.

- [ ] **Step 4: Run gate tests**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: all gate tests PASS and fetch spy counts match exactly.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/biennale-pavilion-crawler.js cloudflare/test/biennale-pavilion-crawler.test.js
git commit -m "feat: gate biennale crawl to one successful run"
```

---

### Task 4: Edition validation and archive persistence

**Files:**
- Modify: `cloudflare/src/biennale-pavilion-crawler.js`
- Modify: `cloudflare/src/artmap-crawler.js:680-850`
- Modify: `cloudflare/src/index.js:30-65`
- Modify: `cloudflare/test/biennale-pavilion-crawler.test.js`

**Interfaces:**
- Consumes existing exported `upsertSourceRecord`, `upsertVenue`, `linkExhibitionSource`, and `replaceExhibitionMetadata`.
- Produces: `upsertBiennaleExhibition(env, record)` and API response pavilion metadata.

- [ ] **Step 1: Add failing persistence and mismatch tests**

Assert that edition 15 HTML against a stored edition 16 produces `{ status: 'edition_mismatch', saved: 0 }`, never calls exhibition upsert, leaves previous public records active, and writes the warning to a failed crawl run. Assert a valid run creates two exhibition records but one shared `venueGroupKey`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: FAIL because persistence and mismatch handling are incomplete.

- [ ] **Step 3: Add a pavilion-aware exhibition upsert**

Keep shared generic persistence exports in `artmap-crawler.js`; do not duplicate source/venue/link SQL. Add a dedicated exhibition statement that includes:

```sql
edition = excluded.edition,
edition_year = excluded.edition_year,
pavilion_name = excluded.pavilion_name,
venue_group_key = excluded.venue_group_key,
geocode_status = excluded.geocode_status,
crawl_warning = excluded.crawl_warning
```

Use dedupe key `edition|normalized pavilion name|normalized venue|start date`. Public visibility requires edition match, address, and verified coordinates. Extend `toArchiveItem()` so the public API returns `edition`, `editionYear`, `pavilionName`, `venueGroupKey`, and `geocodeStatus`.

- [ ] **Step 4: Run crawler and API tests**

Run: `node --test cloudflare/test/biennale-pavilion-crawler.test.js test/archive-api-security.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/biennale-pavilion-crawler.js cloudflare/src/artmap-crawler.js cloudflare/src/index.js cloudflare/test/biennale-pavilion-crawler.test.js
git commit -m "feat: persist verified biennale pavilions"
```

---

### Task 5: Scheduled and authenticated manual execution

**Files:**
- Modify: `cloudflare/src/index.js:300-425`
- Modify: `test/archive-api-security.test.js`
- Modify: `cloudflare/test/biennale-pavilion-crawler.test.js`
- Modify: `docs/regional-archive-guide.md`

**Interfaces:**
- Produces: scheduled call to local-gated runner and authenticated POST `/api/archive/crawl/gwangju-biennale`.

- [ ] **Step 1: Add failing dispatch tests**

Assert GET returns 405, unauthenticated POST returns 401, authenticated POST invokes the same gated runner, and scheduled dispatch contains `runBiennaleEditionIfDue`. Assert the manual endpoint does not bypass a completed edition. Add the same authorization checks for POST `/api/archive/crawl/gwangju-biennale/reset`, and assert its JSON body `{ "edition": 16 }` clears only edition 16 completion/attempt fields.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/archive-api-security.test.js cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: FAIL with 404 and missing scheduled call.

- [ ] **Step 3: Wire the runner**

```js
if (url.pathname === '/api/archive/crawl/gwangju-biennale') {
  if (request.method !== 'POST') return error('Method not allowed', 405)
  if (!hasCrawlAccess(request, env)) return error('Unauthorized', 401)
  return json(await runBiennaleEditionIfDue(env, { now: new Date() }))
}
```

Add `runScheduledCrawl(..., () => runBiennaleEditionIfDue(env, { now: new Date() }))` to the existing `Promise.allSettled`. The runner itself performs the D1 gate before any external fetch. Document the once-per-edition behavior and the authenticated reset procedure; reset requires explicit edition ID and clears only `crawl_completed_at`.

Implement the reset route with:

```sql
UPDATE biennale_editions
SET crawl_completed_at = NULL,
    last_attempt_at = NULL,
    last_attempt_status = NULL,
    last_error = NULL
WHERE edition = ?
```

Return 400 when `edition` is not a positive integer and 404 when the update reports zero changed rows.

- [ ] **Step 4: Run tests**

Run: `node --test test/archive-api-security.test.js cloudflare/test/biennale-pavilion-crawler.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare/src/index.js test/archive-api-security.test.js cloudflare/test/biennale-pavilion-crawler.test.js docs/regional-archive-guide.md
git commit -m "feat: schedule one-time biennale pavilion crawl"
```

---

### Task 6: Shared-venue map grouping

**Files:**
- Modify: `src/components/archive/ArchiveMap.vue:100-155,275-355`
- Modify: `test/archive-mobile-tabs.test.js`

**Interfaces:**
- Consumes: optional `venueGroupKey` from archive API.
- Produces: one marker per physical venue with a selectable pavilion list.

- [ ] **Step 1: Add failing grouping assertions**

Require marker grouping key to prefer `item.venueGroupKey` and fall back to existing city/venue/coordinate grouping. Add a pure fixture assertion or extracted helper proving two ACC pavilion records with the same group key create one group with `count=2` and both item IDs.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/archive-mobile-tabs.test.js`

Expected: FAIL because grouping ignores `venueGroupKey`.

- [ ] **Step 3: Implement grouping and pavilion list**

Use:

```js
const key = item.venueGroupKey || [item.city, item.venue, Number(item.lat).toFixed(5), Number(item.lng).toFixed(5)].join('|')
```

Store the group's item IDs and render each selected-group pavilion title in the detail card. The route link uses the currently selected pavilion ID, not the group primary ID.

- [ ] **Step 4: Run frontend verification**

Run: `node --test test/archive-mobile-tabs.test.js test/archive-route-planner.test.js && npm run build:pages`

Expected: tests PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/archive/ArchiveMap.vue test/archive-mobile-tabs.test.js
git commit -m "feat: group biennale pavilions by venue"
```

---

### Task 7: Production migration, dry run, and deployment

**Files:**
- No source files unless a scoped QA defect is found.

**Interfaces:**
- Produces: migrated production Worker with a pending 2026 edition gate.

- [ ] **Step 1: Run the complete regression suite**

Run: `npm test && npm run build:pages`

Expected: all tests PASS and build exits 0.

- [ ] **Step 2: Apply migration**

Run from `cloudflare`: `npx wrangler d1 migrations apply space-ddf-archive --remote`

Expected: `0011_biennale_pavilions.sql` succeeds and edition 16 is incomplete.

- [ ] **Step 3: Deploy the archive Worker**

Run from `cloudflare`: `npx wrangler deploy`.

Expected: deployment succeeds without changing the existing cron schedule.

- [ ] **Step 4: Verify the gate without crawling**

Before `2026-09-05`, invoke the authenticated endpoint once and confirm response `skipped_before_period`, no new official-site crawl run, and no pavilion exhibition records. Do not reset or force the edition.

- [ ] **Step 5: Deploy frontend and smoke test**

Deploy the tested Pages `dist`, then run `SMOKE_BASE_URL=https://spaceddf.xyz npm run smoke:pages`. Confirm existing archive map and route planner still work. During the active period, verify the first successful crawl sets completion and a second invocation returns `skipped_completed` without an official-site request.
