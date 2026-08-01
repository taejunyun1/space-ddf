# Structured Content Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give detail pages and `/admin` one compatible fixed metadata structure while preserving existing credit records and Instagram links.

**Architecture:** A shared frontend helper canonicalizes legacy labels and groups either API credit objects or public credit strings. `ContentEditor.vue` edits the existing credits array through fixed standard groups, while `DetailView.vue` consumes the same grouped representation and renders accessible links. The D1 schema and API contract remain unchanged.

**Tech Stack:** Vue 3 Composition API, Node test runner, Cloudflare Pages/D1, Playwright CLI.

## Global Constraints

- Standard order is `Artists`, `Curating`, `Critic`, `Graphic`, `Support`, `Archive`, `Directing`.
- Empty standard labels remain visible on detail pages and in the admin editor.
- Existing unknown credit labels remain editable and render after standard labels.
- Instagram URLs render as SVG icon links, never visible URL text.
- Existing `content_credits(label, value, url, sort_order)` storage remains unchanged.
- Korean IME-safe input handlers remain on every text input.

---

### Task 1: Shared credit normalization and grouping

**Files:**
- Create: `src/lib/content-credits.js`
- Test: `test/content-credits.test.js`

**Interfaces:**
- Produces: `STANDARD_CREDIT_LABELS`, `normalizeCreditLabel(label)`, `parseCreditRecord(record)`, and `groupContentCredits(records)`.
- `groupContentCredits` returns `{ standard: Array<{ label, entries }>, custom: Array<{ label, entries }> }`, and every standard label is present even when `entries` is empty.

- [ ] **Step 1: Write failing tests** for canonical aliases, fixed order, empty groups, repeated artist grouping, URL extraction from public strings, and custom-label preservation.
- [ ] **Step 2: Run `node --test test/content-credits.test.js`** and confirm assertion failures caused by missing behavior.
- [ ] **Step 3: Implement the minimal helper** with exact aliases from the approved design and safe `http`/`https` URL parsing.
- [ ] **Step 4: Re-run the focused test** and confirm all cases pass.
- [ ] **Step 5: Commit only the helper and its test** with message `콘텐츠 기본 정보 정규화 추가`.

### Task 2: Fixed basic-information editor

**Files:**
- Modify: `src/components/admin/ContentEditor.vue`
- Modify: `src/views/AdminContentsView.vue`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- Consumes: `STANDARD_CREDIT_LABELS`, `normalizeCreditLabel` from Task 1.
- Preserves: `modelValue.credits: Array<{ label, value, url, sortOrder? }>`.

- [ ] **Step 1: Add failing source-contract tests** asserting all seven labels appear in the basic section, contributor name/URL inputs exist, repeatable artist controls exist, custom credits remain available, and the content section contains only introduction/body.
- [ ] **Step 2: Run `node --test test/content-frontend.test.js`** and confirm the new assertions fail against the current free-form credit editor.
- [ ] **Step 3: Implement fixed groups in `ContentEditor.vue`** by deriving canonical rows from `modelValue.credits`, adding/updating/removing rows without discarding unknown labels, and applying composition-safe handlers to name, value, URL, and custom-label inputs.
- [ ] **Step 4: Update validation focus** so a credit error opens `basic`, not `content`, in `AdminContentsView.vue`.
- [ ] **Step 5: Re-run the focused frontend test** and confirm it passes.
- [ ] **Step 6: Commit editor/test changes** with message `어드민 기본 정보 입력 구조화`.

### Task 3: Structured detail-page display

**Files:**
- Modify: `src/views/DetailView.vue`
- Modify: `src/lib/credit-links.js`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- Consumes: `groupContentCredits(item.credits)` from Task 1.
- Keeps: `InstagramIcon.vue` and `parseCreditLine` security behavior.

- [ ] **Step 1: Add failing tests** asserting detail credits iterate grouped standard labels, show empty standard labels, group repeated artists, use the Instagram icon per linked entry, and place custom groups afterward.
- [ ] **Step 2: Run `node --test test/content-frontend.test.js test/content-credits.test.js`** and confirm expected failures.
- [ ] **Step 3: Replace flat credit lines with grouped rows** in `DetailView.vue`; show names inline within one row, add SVG links for Instagram entries, retain text links for non-Instagram URLs, and keep accessible labels plus `noopener noreferrer`.
- [ ] **Step 4: Adjust credit CSS** to match the supplied reference: muted labels/values, consistent vertical rhythm, date above credits, and Location below credits.
- [ ] **Step 5: Re-run focused tests** and confirm all pass.
- [ ] **Step 6: Commit detail changes** with message `상세 기본 정보 행 구조화`.

### Task 4: Full QA and production deployment

**Files:**
- QA artifacts only: `output/playwright/structured-info-admin.png`, `output/playwright/structured-info-detail-mobile.png`, `output/playwright/structured-info-detail-desktop.png`.

**Interfaces:**
- Verifies the complete admin → detail workflow and production Pages deployment.

- [ ] **Step 1: Run `npm run lint && npm test && npm run build:pages`** and require zero failures.
- [ ] **Step 2: Start the built app and browser-check** desktop/mobile detail layout against the three supplied screenshots, including label order, typography, Instagram icons, URL visibility, and horizontal overflow.
- [ ] **Step 3: Browser-check `/admin`** after logging in, confirm all fixed inputs are visible, and edit a disposable draft or use non-mutating inspection without altering the published exhibition.
- [ ] **Step 4: Deploy** with `npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf --commit-dirty=true`.
- [ ] **Step 5: Run `SMOKE_BASE_URL=https://spaceddf.xyz npm run smoke:pages`** and require all public/protected route checks to pass.
- [ ] **Step 6: Re-check production** at `/`, `/admin`, and `/shows/myulmang-unboxing`; require seven standard labels, five Instagram links, no visible Instagram URL, no console errors, and no horizontal overflow.
