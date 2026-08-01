# Automatic Recent and Mobile Rental Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every successfully published admin content item appear in its selected Show/Project home list and become the persistent Recent Updated item, while placing the mobile Calendar rental area last.

**Architecture:** The publish handler owns the visibility invariant and atomically makes the published item the sole featured item. The public store hydrates the featured endpoint separately from type lists and uses it ahead of the static date-based fallback. Admin presentation exposes only the type choice; mobile ordering is handled by the existing HomeView grid areas.

**Tech Stack:** Vue 3, Pinia, Cloudflare Pages Functions, D1, Node test runner, Playwright/browser QA, Wrangler 4.

## Global Constraints

- The sole manager page remains `/admin`; internal `/api/manage/*` routes remain unchanged.
- Uploading assets does not publish content; only a successful Publish changes public lists and Recent.
- Every successful Publish forces `showOnHome=true` and `isFeatured=true`.
- The latest published item remains in Recent regardless of exhibition end date.
- At 768px and below, home order is Recent, Project/Show lists, Calendar.
- Preserve unrelated dirty-worktree changes and existing static-content fallback behavior.

---

### Task 1: Enforce publish visibility and latest-featured invariant

**Files:**
- Modify: `test/content-api.test.js`
- Modify: `src/server/content-api.mjs`

**Interfaces:**
- Consumes: `publishContent(db, id)` and existing D1 content/publication rows.
- Produces: publish response with `showOnHome: true`, `isFeatured: true`, `publishedAt`; public payload with the same visibility values; exactly one featured publication.

- [ ] **Step 1: Write failing server tests**

Add a publish test whose draft starts with `showOnHome: false` and `isFeatured: false`. Assert the batch clears all other featured rows, updates the current `contents` row to featured/home-visible, writes a public payload containing both values as `true`, and returns those values.

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-api.test.js`

Expected: FAIL because publish currently trusts the draft visibility flags and only clears previous featured content conditionally.

- [ ] **Step 3: Implement the invariant**

In `publishContent`, derive a publish-only object with `showOnHome: true` and `isFeatured: true`, build the public payload from it, always clear previous featured flags, and update the current content row with `show_on_home=1`, `is_featured=1`, status and timestamps in the same batch.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/content-api.test.js`

Expected: all content API tests PASS.

### Task 2: Hydrate and select the server-featured Recent item

**Files:**
- Modify: `test/content-frontend.test.js`
- Modify: `src/services/contents.js`
- Modify: `src/stores/content.js`
- Modify: `src/stores/lib/content-actions.js`
- Modify: `src/stores/lib/content-getters.js`

**Interfaces:**
- Produces: `fetchFeaturedContent(): Promise<object|null>`; store state `featuredContent`; getter `recent` that returns `featuredContent` before the existing date fallback.

- [ ] **Step 1: Write failing store/service tests**

Assert that the service calls `/api/contents/featured`, hydration requests it alongside Show and Project lists without making its failure discard successful lists, and the `recent` getter prioritizes `state.featuredContent`.

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-frontend.test.js`

Expected: FAIL because the featured service and store state do not exist.

- [ ] **Step 3: Implement featured hydration**

Add `fetchFeaturedContent`. During `hydratePublishedContents`, fetch the two lists and featured item, merge lists as before, set the featured item with `_kind` derived from `type`, and leave it null on a featured-only failure. Add `featuredContent: null` to state and update `recent()` to return it before `allSortedByDateDesc[0]`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/content-frontend.test.js`

Expected: all content frontend tests PASS.

### Task 3: Make the admin upload/publish flow express the invariant

**Files:**
- Modify: `test/content-frontend.test.js`
- Modify: `src/components/admin/ContentEditor.vue`
- Modify: `src/views/AdminContentsView.vue`

**Interfaces:**
- Consumes: existing draft auto-save and asset upload functions.
- Produces: accessible Show/Project type selector; no manual home/featured checkboxes; publish response replaces the local draft and reports the automatic result.

- [ ] **Step 1: Write failing admin source tests**

Assert `ContentEditor` has an accessible content-type choice for `show` and `project`, does not render `showOnHome` or `isFeatured` checkboxes, and `publish()` saves the current draft before publishing and keeps the returned response.

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-frontend.test.js`

Expected: FAIL because manual visibility checkboxes remain.

- [ ] **Step 3: Implement the admin UI update**

Replace the type select with a two-choice radio/segmented fieldset using the existing visual system. Remove both visibility checkboxes. Keep `saveDraft()` before `publishAdminContent()`, and update the success notice to state that the item was added to its list and Recent Updated.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/content-frontend.test.js`

Expected: all content frontend tests PASS.

### Task 4: Keep Recent visible and move mobile Calendar last

**Files:**
- Modify: `test/home-rental-calendar.test.js`
- Modify: `src/components/RecentComponent.vue`
- Modify: `src/views/HomeView.vue`

**Interfaces:**
- Produces: persistent Recent card; mobile grid areas `"center" "right" "left"`; unchanged desktop layout.

- [ ] **Step 1: Write failing home tests**

Assert `RecentComponent` no longer computes or branches on `isExpired`, and the 768px HomeView media query contains the ordered grid areas `center`, `right`, `left`.

- [ ] **Step 2: Verify RED**

Run: `node --test test/home-rental-calendar.test.js`

Expected: FAIL because Recent currently hides expired items and mobile order starts with `left`.

- [ ] **Step 3: Implement the responsive behavior**

Remove the timer/date-expiration branch from `RecentComponent`, always render its content and link, and update only the mobile grid area order in `HomeView.vue`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/home-rental-calendar.test.js`

Expected: all home/rental tests PASS.

### Task 5: Regression verification and production QA

**Files:**
- Verify: all modified application and test files
- Runtime data: Cloudflare D1 `space-ddf-rentals`

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: verified production behavior and corrected `<멸망 언박싱>` visibility state.

- [ ] **Step 1: Run repository verification**

Run: `npm run lint && npm test && npm run build:pages`

Expected: lint exits 0, every Node and scraper test passes, Pages build exits 0.

- [ ] **Step 2: Run local browser QA**

Start the app and verify desktop home, 390px mobile home, `/admin` type selection, Korean IME entry, image controls, validation failure, preview and Publish behavior. Confirm no horizontal overflow and mobile visual order Recent → lists → Calendar.

- [ ] **Step 3: Deploy application**

Run: `npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf --commit-dirty=true`

Expected: Pages reports Deployment complete.

- [ ] **Step 4: Correct current content visibility**

Use read-only D1 queries first to identify `<멸망 언박싱>`, its type and publication row. Then update only that row to `type='show'`, `show_on_home=1`, `is_featured=1`, clear other featured flags, and update its publication payload without changing text or assets.

- [ ] **Step 5: Run production QA**

Run the production smoke suite and browser-check `/admin`, desktop/mobile home, the Show list row, Recent card, and the `<멸망 언박싱>` detail link. Confirm legacy `/manage*` paths remain 404.

- [ ] **Step 6: Record evidence**

Capture exact test counts, deployment URL, D1 row identity, desktop/mobile screenshots, observed DOM order, and route status codes for the final handoff.
