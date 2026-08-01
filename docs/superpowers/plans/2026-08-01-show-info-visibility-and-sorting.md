# Show Information Visibility and Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `멸망 언박싱` credits, hide empty public information rows, and order the Show list newest-to-oldest by actual start date.

**Architecture:** Date normalization stays in the existing store helper so all Show consumers share one deterministic sort key. The detail view filters the existing normalized credit groups only at render time, leaving the seven-field admin editor intact. Production data is updated transactionally in D1 across draft credits and the currently published JSON payload, then verified through the public API and browser.

**Tech Stack:** Vue 3, Pinia, Node test runner, Cloudflare Pages, Cloudflare D1, Playwright/browser QA.

## Global Constraints

- `멸망 언박싱` adds `Graphic 정한결`, `Support 전남광주통합특별시, 광주문화재단`, and `Archive 정한결`.
- Public detail pages hide every standard or custom credit group with no non-empty entries.
- `/admin` retains all seven standard information inputs.
- Show lists are newest-to-oldest by `startDate`, with `dateRange` as fallback.
- Date parsing accepts `YYYY-MM-DD`, `YYYY.MM.DD`, and `YYYY.MM.DD.`.
- Existing Instagram SVG icons, contributor URLs, and accessible labels remain unchanged.
- Unrelated dirty-worktree changes must not be staged or reverted.

---

### Task 1: Robust exhibition date sorting

**Files:**
- Modify: `src/stores/lib/date-helpers.js`
- Test: `test/content-date-sorting.test.js`

**Interfaces:**
- Consumes: content objects with optional `startDate`, `endDate`, `dateRange`, and `title` fields.
- Produces: unchanged `parseDateRange(dateRange)`, `sortKeyFromRange(item)`, and `compareByRangeAsc(a, b)` exports.

- [ ] **Step 1: Write the failing runtime tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { compareByRangeAsc, parseDateRange, sortKeyFromRange } from '../src/stores/lib/date-helpers.js'

test('dot dates accept a trailing period', () => {
  const parsed = parseDateRange('2026.08.01. - 2026.08.12.')
  assert.equal(parsed.start?.getFullYear(), 2026)
  assert.equal(parsed.start?.getMonth(), 7)
  assert.equal(parsed.start?.getDate(), 1)
  assert.equal(parsed.end?.getDate(), 12)
})

test('managed startDate takes priority over the display date range', () => {
  const key = sortKeyFromRange({
    startDate: '2026-08-01',
    endDate: '2026-08-12',
    dateRange: '날짜 표기 없음',
  })
  assert.equal(new Date(key.start).toISOString().slice(0, 10), '2026-08-01')
  assert.equal(new Date(key.end).toISOString().slice(0, 10), '2026-08-12')
})

test('descending comparison places the latest managed show first', () => {
  const shows = [
    { title: '2025', dateRange: '2025.11.07 - 2025.11.12' },
    { title: '멸망 언박싱', startDate: '2026-08-01', endDate: '2026-08-12' },
  ]
  shows.sort((a, b) => compareByRangeAsc(b, a))
  assert.equal(shows[0].title, '멸망 언박싱')
})
```

- [ ] **Step 2: Run `node --test test/content-date-sorting.test.js`** and require failures for trailing-period parsing and managed dates.
- [ ] **Step 3: Extend date normalization** with a private parser that accepts ISO and dot syntax, tolerates one final period, uses `startDate`/`endDate` before `dateRange`, and preserves invalid-date fallback behavior.
- [ ] **Step 4: Re-run `node --test test/content-date-sorting.test.js`** and require all tests to pass.
- [ ] **Step 5: Commit only the date helper and focused test** with message `fix: Show 최신순 날짜 정렬 보완`.

### Task 2: Hide empty public information rows

**Files:**
- Modify: `src/views/DetailView.vue`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- Consumes: `groupContentCredits(item.credits)` returning `{ standard, custom }` groups.
- Produces: `creditGroups`, containing only groups whose `entries.length` is greater than zero.

- [ ] **Step 1: Add a failing source-contract test**

```js
test('detail hides empty credit groups while the admin keeps all standard inputs', () => {
  const detail = read('src/views/DetailView.vue')
  const editor = read('src/components/admin/ContentEditor.vue')

  assert.match(detail, /\.filter\(group => group\.entries\.length > 0\)/)
  assert.match(editor, /STANDARD_CREDIT_LABELS/)
})
```

- [ ] **Step 2: Run `node --test test/content-frontend.test.js`** and require the new detail assertion to fail.
- [ ] **Step 3: Filter grouped credits in the detail computed value** while leaving `groupContentCredits` and `ContentEditor.vue` unchanged, so empty rows disappear publicly but remain editable in admin.
- [ ] **Step 4: Re-run `node --test test/content-frontend.test.js test/content-credits.test.js`** and require all focused tests to pass.
- [ ] **Step 5: Commit only the detail view and focused test** with message `fix: 상세 빈 기본 정보 숨김`.

### Task 3: Update the published exhibition data

**Files:**
- No repository files changed; remote D1 rows are updated after a read-only target check.

**Interfaces:**
- Consumes: the `contents.id` for type `show` and slug `myulmang-unboxing`.
- Updates: `content_credits` and `content_publications.payload_json` for that exact content ID.

- [ ] **Step 1: Read the Wrangler instructions and inspect the exact remote target** using read-only D1 queries for `contents`, `content_credits`, and the active publication payload.
- [ ] **Step 2: Build one explicit D1 transaction** that deletes only existing `Graphic`, `Support`, and `Archive` rows for this content, inserts the three approved rows at deterministic sort positions, and replaces the publication payload's `credits` array while preserving Artists and Curating URLs.
- [ ] **Step 3: Execute the transaction against the remote `space-ddf-rentals` database** and require a successful result.
- [ ] **Step 4: Re-query the three tables** and require exactly the approved values, no empty Critic/Directing records, five linked Artists, and one Curating entry.

### Task 4: Full QA and production deployment

**Files:**
- Build output only: `dist/`.
- Browser artifacts only: `output/playwright/`.

**Interfaces:**
- Verifies the repository, production data, Cloudflare Pages deployment, and public/admin rendering as one workflow.

- [ ] **Step 1: Run `npm run lint && npm test && npm run build:pages`** and require zero failures.
- [ ] **Step 2: Run a local built-app browser QA** and require: newest Show first, no empty detail labels, five Instagram SVG links, seven admin inputs, and no desktop/mobile horizontal overflow.
- [ ] **Step 3: Deploy with `npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf --commit-dirty=true`** and capture the deployment URL.
- [ ] **Step 4: Run `SMOKE_BASE_URL=https://spaceddf.xyz npm run smoke:pages`** and require all public and protected route checks to pass.
- [ ] **Step 5: Re-check production `/`, `/shows/myulmang-unboxing`, `/admin`, and the public content API**; require `멸망 언박싱` first in Show, labels Artists/Curating/Graphic/Support/Archive only, correct approved values, five Instagram SVG links, and no visible Instagram URLs.
- [ ] **Step 6: Review `git status` and commits** to confirm no unrelated user changes were staged, then report deployment and QA results.
