# Archive Map Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare Pages에서 `/archive-map` 직접 요청과 새로고침을 `200`으로 제공하고 Google Maps 지도를 정상 렌더링한다.

**Architecture:** 기존 SEO 프리렌더 스크립트의 정적 SPA 경로 목록에 `/archive-map`을 추가해 `dist/archive-map/index.html`을 생성한다. 범용 SPA fallback은 추가하지 않으므로 제거된 `/manage` 계열 경로는 계속 `404`로 유지한다.

**Tech Stack:** Vue 3, Vue Router, Vite, Node.js test runner, Cloudflare Pages, Google Maps JavaScript API

## Global Constraints

- Google Maps API 키 값과 API 제한 종류는 변경하지 않는다.
- `/manage`, `/manage/contents`, `/admin/contents`는 계속 `404`를 반환한다.
- `/admin`의 기존 인증 및 Pages Function 라우팅을 변경하지 않는다.
- 기존 `scripts/prerender-seo.js`의 정적 SPA 셸 생성 방식을 재사용한다.

---

### Task 1: Archive Map Prerender Regression

**Files:**
- Modify: `test/cloudflare-pages-deploy.test.js`
- Modify: `scripts/prerender-seo.js`
- Modify: `scripts/smoke-test.js`

**Interfaces:**
- Consumes: `STATIC_SPA_ROUTES: string[]` in `scripts/prerender-seo.js`
- Produces: `dist/archive-map/index.html` during `npm run build:pages`

- [ ] **Step 1: Write the failing route-list test**

Add this assertion to `SEO prerender writes static shells for top-level SPA routes used by Pages`:

```js
assert.match(source, /'\/archive-map'/)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: FAIL only because `scripts/prerender-seo.js` does not contain `'/archive-map'`.

- [ ] **Step 3: Add the minimal prerender route**

Change the route list in `scripts/prerender-seo.js` to:

```js
const STATIC_SPA_ROUTES = ['/rental', '/archive-map', '/admin']
```

- [ ] **Step 4: Add the route to deployment smoke coverage**

Change the public route list in `scripts/smoke-test.js` to:

```js
const routes = ['/', '/rental', '/archive-map', '/shows/jihye/', '/projects/artwall/']
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: all tests in the file pass.

- [ ] **Step 6: Commit the implementation**

```bash
git add test/cloudflare-pages-deploy.test.js scripts/prerender-seo.js scripts/smoke-test.js
git commit -m "2026-07-30 아카이브 지도 정적 라우팅 추가"
```

### Task 2: Build and Local Artifact Verification

**Files:**
- Verify: `dist/archive-map/index.html`
- Verify: `dist/rental/index.html`
- Verify: `dist/admin/index.html`

**Interfaces:**
- Consumes: `npm run build:pages`
- Produces: Cloudflare Pages-ready `dist/` tree

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected: exit code `0`, no failed tests.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code `0`.

- [ ] **Step 3: Build the Pages artifact**

Run:

```bash
npm run build:pages
```

Expected: exit code `0`.

- [ ] **Step 4: Verify generated route shells**

Run:

```bash
test -f dist/archive-map/index.html
test -f dist/rental/index.html
test -f dist/admin/index.html
```

Expected: exit code `0`.

- [ ] **Step 5: Verify removed nested admin routes were not generated**

Run:

```bash
test ! -e dist/manage
test ! -e dist/admin/contents
```

Expected: exit code `0`.

### Task 3: Production Deployment and QA

**Files:**
- Deploy: `dist/`
- Verify: `https://spaceddf.xyz/archive-map`

**Interfaces:**
- Consumes: verified `dist/` artifact and Cloudflare Pages project `space-ddf-home`
- Produces: production deployment serving the archive map route

- [ ] **Step 1: Deploy the verified artifact**

Run:

```bash
npx wrangler pages deploy dist --project-name space-ddf-home --branch main
```

Expected: successful Pages deployment URL.

- [ ] **Step 2: Verify public and removed routes**

Check:

```text
GET https://spaceddf.xyz/archive-map        -> 200
GET https://spaceddf.xyz/manage            -> 404
GET https://spaceddf.xyz/manage/contents   -> 404
GET https://spaceddf.xyz/admin/contents    -> 404
GET https://spaceddf.xyz/admin             -> 200
```

- [ ] **Step 3: Verify the actual map in a fresh browser tab**

Open `https://spaceddf.xyz/archive-map` and confirm:

```text
Page title: 지역 전시·상영 아카이브 | Space DDF
No visible "Google Maps API referrer 제한 확인 필요"
At least one `.gm-style` map container exists
No RefererNotAllowedMapError in the console
```

- [ ] **Step 4: Run the deployed smoke test**

Run:

```bash
npm run smoke:pages -- https://spaceddf.xyz
```

Expected: every public route returns success and `/admin` remains protected by the application login.

- [ ] **Step 5: Record deployment evidence**

Report the production URL, deployment URL, commit SHA, route status codes, test totals, and browser console result.
