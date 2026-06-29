# Cloudflare Pages Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the existing Space DDF Vue/Vite site for Cloudflare Pages deployment without changing public site behavior.

**Architecture:** Keep the current Vue app and static prerender flow. Add a Cloudflare-specific build command that outputs `dist/` without cPanel packaging, document Pages/DNS settings, and strengthen automated checks around Cloudflare routing, headers, and smoke routes.

**Tech Stack:** Vue 3, Vite, Vue Router, Pinia, Node test runner, Cloudflare Pages static hosting.

## Global Constraints

- Do not implement rental reservation UI, D1, Pages Functions, or admin pages in this phase.
- Do not remove the existing `npm run build` cPanel ZIP path; keep it as a temporary rollback path.
- Add Cloudflare deployment support through a separate `npm run build:pages` command.
- Cloudflare Pages build command must be `npm run build:pages`.
- Cloudflare Pages output directory must be `dist`.
- Keep existing CSP/hash generation behavior.
- Preserve existing routes: `/`, `/archive-map`, `/projects/:slug`, `/shows/:slug`.
- Do not stage or revert unrelated existing worktree changes.

---

## File Structure

- Modify `package.json`: add Cloudflare Pages build and smoke scripts.
- Modify `scripts/smoke-test.js`: include `/archive-map` in production smoke coverage.
- Create `test/cloudflare-pages-deploy.test.js`: assert Cloudflare build, routing, headers, and smoke route contracts.
- Create `docs/cloudflare-pages-deployment.md`: operator-facing deployment and DNS cutover checklist.
- Modify `README.md`: document Cloudflare Pages deployment while keeping cPanel fallback notes.

## Task 1: Add Cloudflare Pages Build Contract

**Files:**
- Modify: `package.json`
- Create: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Produces: `npm run build:pages`, which later tasks and Cloudflare Pages use.
- Produces: `npm run smoke:pages`, which smoke-tests a prebuilt deployment through `SMOKE_BASE_URL`.

- [ ] **Step 1: Write the failing test**

Create `test/cloudflare-pages-deploy.test.js` with:

```js
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('package exposes a Cloudflare Pages build that does not create cPanel zip output', () => {
  const pkg = JSON.parse(readProjectFile('package.json'))

  assert.equal(
    pkg.scripts['build:pages'],
    'npm run assets:manifest && vite build && npm run prerender && npm run csp:hashes'
  )
  assert.doesNotMatch(pkg.scripts['build:pages'], /package:dist/)
  assert.match(pkg.scripts.build, /package:dist/)
})

test('package exposes a Pages smoke command for deployed previews', () => {
  const pkg = JSON.parse(readProjectFile('package.json'))

  assert.equal(pkg.scripts['smoke:pages'], 'node scripts/smoke-test.js')
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: FAIL because `build:pages` and `smoke:pages` are not defined.

- [ ] **Step 3: Add minimal package scripts**

Modify `package.json` `scripts` to include:

```json
"build:pages": "npm run assets:manifest && vite build && npm run prerender && npm run csp:hashes",
"smoke:pages": "node scripts/smoke-test.js"
```

Keep the existing `build` script unchanged:

```json
"build": "npm run assets:manifest && vite build && npm run prerender && npm run csp:hashes && npm run package:dist"
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: PASS.

- [ ] **Step 5: Verify Cloudflare build command locally**

Run:

```bash
npm run build:pages
```

Expected: Vite build succeeds, prerender runs, CSP hashes are applied, and no `Created release/space-ddf-cpanel.zip` line appears.

- [ ] **Step 6: Commit**

```bash
git add package.json test/cloudflare-pages-deploy.test.js
git commit -m "2026-06-30 Cloudflare Pages 빌드 스크립트 추가"
```

## Task 2: Lock Cloudflare Routing and Header Contracts

**Files:**
- Modify: `test/cloudflare-pages-deploy.test.js`
- Verify existing: `public/_redirects`
- Verify existing: `public/_headers`

**Interfaces:**
- Consumes: `public/_redirects`, copied into `dist/_redirects` by Vite public asset handling.
- Consumes: `public/_headers`, copied into `dist/_headers` by Vite public asset handling.
- Produces: test coverage that protects Cloudflare SPA fallback and security header behavior.

- [ ] **Step 1: Add failing routing/header tests**

Append these tests to `test/cloudflare-pages-deploy.test.js`:

```js
test('Cloudflare redirects protect hashed assets before SPA fallback', () => {
  const redirects = readProjectFile('public/_redirects')

  assert.match(redirects, /\/img\/\*\s+\/404\.html\s+404/)
  assert.match(redirects, /\/js\/\*\s+\/404\.html\s+404/)
  assert.match(redirects, /\/css\/\*\s+\/404\.html\s+404/)
  assert.match(redirects, /\/assets\/\*\s+\/404\.html\s+404/)
  assert.match(redirects, /\/\*\s+\/index\.html\s+200/)
  assert.ok(
    redirects.indexOf('/js/*') < redirects.indexOf('/* /index.html 200'),
    'asset 404 rules must appear before SPA fallback'
  )
})

test('Cloudflare headers include CSP and immutable asset caching', () => {
  const headers = readProjectFile('public/_headers')

  assert.match(headers, /Content-Security-Policy:/)
  assert.match(headers, /connect-src[^\\n]*https:\/\/space-ddf-archive-api\.taejunyun\.workers\.dev/)
  assert.match(headers, /\/js\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/)
  assert.match(headers, /\/css\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/)
  assert.match(headers, /\/img\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/)
})
```

- [ ] **Step 2: Run test to verify current behavior**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: PASS if current `_redirects` and `_headers` already satisfy the contract. If it fails, continue to Step 3.

- [ ] **Step 3: Fix `_redirects` only if test fails**

Ensure `public/_redirects` contains this ordering:

```text
/img/* /404.html 404
/originals/* /404.html 404
/js/* /404.html 404
/css/* /404.html 404
/assets/* /404.html 404

/* /index.html 200
```

- [ ] **Step 4: Fix `_headers` only if test fails**

Ensure `public/_headers` has a global route block with CSP and separate immutable cache blocks:

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fastly.jsdelivr.net; img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://stats.g.doubleclick.net; frame-src https://www.google.com; connect-src 'self' https://space-ddf-archive-api.taejunyun.workers.dev https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://stats.g.doubleclick.net; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'none'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-Permitted-Cross-Domain-Policies: none
  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000

/js/*
  Cache-Control: public, max-age=31536000, immutable

/css/*
  Cache-Control: public, max-age=31536000, immutable

/img/*
  Cache-Control: public, max-age=31536000, immutable
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test/cloudflare-pages-deploy.test.js public/_redirects public/_headers
git commit -m "2026-06-30 Cloudflare 라우팅 및 헤더 계약 검증"
```

## Task 3: Expand Smoke Coverage for Cloudflare Pages Routes

**Files:**
- Modify: `scripts/smoke-test.js`
- Modify: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Consumes: `SMOKE_BASE_URL`, already supported by `scripts/smoke-test.js`.
- Produces: smoke coverage for `/archive-map`, which is an SPA route that must work after Cloudflare fallback.

- [ ] **Step 1: Add failing route coverage test**

Append this test to `test/cloudflare-pages-deploy.test.js`:

```js
test('smoke test covers the regional archive SPA route', () => {
  const smokeSource = readProjectFile('scripts/smoke-test.js')

  assert.match(smokeSource, /const routes = \[[\s\S]*'\/archive-map'[\s\S]*\]/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: FAIL if `/archive-map` is not in the `routes` array.

- [ ] **Step 3: Add `/archive-map` to smoke routes**

Modify `scripts/smoke-test.js`:

```js
const routes = ['/', '/archive-map', '/shows/jihye/', '/projects/artwall/']
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full smoke locally**

Run:

```bash
npm run build:pages
npm run smoke
```

Expected:

```text
OK / - Space DDF - 광주 전시공간 · 전시 대관 · 대안 예술 공간
OK /archive-map - 지역 전시·상영 아카이브 | Space DDF
OK /shows/jihye/ - <걸어가는 것들 움직이는 것들> 김지혜 개인전 | Space DDF
OK /projects/artwall/ - <Artwall Project> | Space DDF
```

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke-test.js test/cloudflare-pages-deploy.test.js
git commit -m "2026-06-30 Cloudflare Pages 주요 라우트 스모크 확대"
```

## Task 4: Document Cloudflare Pages and DNS Cutover

**Files:**
- Create: `docs/cloudflare-pages-deployment.md`
- Modify: `README.md`
- Modify: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Produces: operator checklist for creating the Pages project, setting build/output, moving DNS, and verifying production.
- Produces: README entry points for future maintainers.

- [ ] **Step 1: Add failing documentation test**

Append this test to `test/cloudflare-pages-deploy.test.js`:

```js
test('Cloudflare deployment documentation records build and DNS cutover settings', () => {
  const doc = readProjectFile('docs/cloudflare-pages-deployment.md')
  const readme = readProjectFile('README.md')

  assert.match(doc, /Build command:\s+`npm run build:pages`/)
  assert.match(doc, /Output directory:\s+`dist`/)
  assert.match(doc, /Cloudflare nameservers/)
  assert.match(doc, /space\.ddf@gmail\.com/)
  assert.match(doc, /Google Maps API referrer/)
  assert.match(readme, /Cloudflare Pages/)
  assert.match(readme, /npm run build:pages/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: FAIL because `docs/cloudflare-pages-deployment.md` does not exist or README is missing Cloudflare details.

- [ ] **Step 3: Create deployment documentation**

Create `docs/cloudflare-pages-deployment.md`:

```markdown
# Cloudflare Pages Deployment

## Build Settings

- Project type: Cloudflare Pages
- Build command: `npm run build:pages`
- Output directory: `dist`
- Production branch: `space-ddf`

## Pre-Cutover Checklist

1. Run `npm run lint`.
2. Run `node --test test/*.test.js`.
3. Run `npm run build:pages`.
4. Run `npm run smoke`.
5. Create or update the Cloudflare Pages project.
6. Confirm the `*.pages.dev` preview renders `/`, `/archive-map`, `/shows/jihye/`, and `/projects/artwall/`.
7. Confirm `_headers` and `_redirects` are present in the Pages deployment.

## DNS Cutover

1. Add the domain to Cloudflare.
2. Review imported DNS records.
3. Keep only records that are still needed.
4. Add `space-ddf.com` and `www.space-ddf.com` as Cloudflare Pages custom domains.
5. Replace the current hosting provider nameservers with the Cloudflare nameservers shown in the Cloudflare dashboard.
6. Wait for DNS propagation.
7. Verify HTTPS, root domain, `www`, SPA fallback, assets, and SEO routes.

Space DDF currently uses `space.ddf@gmail.com`, so there are no domain-mail MX records to preserve for the current email workflow. If domain email is added later, configure MX, SPF, DKIM, and DMARC before changing mail handling.

## Post-Cutover Checks

1. Open `https://space-ddf.com/`.
2. Open `https://space-ddf.com/archive-map`.
3. Open one show detail route.
4. Open one project detail route.
5. Check browser console errors.
6. Confirm Google Maps API referrer settings include the production domain.
7. Keep the cPanel build path available until production Cloudflare Pages deploys have been stable.
```

- [ ] **Step 4: Update README deployment section**

Add this section to `README.md` after the build instructions:

````markdown
## Cloudflare Pages 배포

Cloudflare Pages 이전 후 기본 배포 명령은 아래와 같습니다.

```
npm run build:pages
```

Cloudflare Pages 설정:

- Build command: `npm run build:pages`
- Output directory: `dist`

기존 `npm run build`는 cPanel 업로드용 ZIP을 만들기 때문에 Cloudflare Pages의 기본 빌드 명령으로 사용하지 않습니다. DNS 전환 및 운영 체크리스트는 `docs/cloudflare-pages-deployment.md`를 참고합니다.
````

- [ ] **Step 5: Run documentation test**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/cloudflare-pages-deployment.md README.md test/cloudflare-pages-deploy.test.js
git commit -m "2026-06-30 Cloudflare Pages 배포 문서 추가"
```

## Task 5: Final Phase 1 Verification

**Files:**
- No new files.
- Verify: full project.

**Interfaces:**
- Consumes: all previous Phase 1 changes.
- Produces: verified Cloudflare Pages migration readiness.

- [ ] **Step 1: Run full test suite**

Run:

```bash
node --test test/*.test.js
```

Expected: all tests pass with 0 failures.

- [ ] **Step 2: Run crawler tests**

Run:

```bash
npm run test:crawler
```

Expected: all crawler tests pass. If Wrangler secrets or Cloudflare-only bindings are required and local tests cannot run, record the exact failure and do not claim crawler coverage passed.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: ESLint exits 0.

- [ ] **Step 4: Run Cloudflare Pages build**

Run:

```bash
npm run build:pages
```

Expected: `dist/` is generated, prerendering succeeds, CSP hashes are applied, and no cPanel ZIP packaging runs.

- [ ] **Step 5: Run local smoke test**

Run:

```bash
npm run smoke
```

Expected: all configured routes print `OK`.

- [ ] **Step 6: Check generated deployment assets**

Run:

```bash
test -f dist/_headers
test -f dist/_redirects
test -f dist/index.html
```

Expected: all commands exit 0.

- [ ] **Step 7: Check git diff**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` shows only intentional Phase 1 files plus any unrelated pre-existing worktree changes.

- [ ] **Step 8: Commit verification-only adjustments if any**

If Task 5 required changes, commit them:

```bash
git add package.json scripts/smoke-test.js test/cloudflare-pages-deploy.test.js public/_redirects public/_headers README.md docs/cloudflare-pages-deployment.md
git commit -m "2026-06-30 Cloudflare Pages 이전 검증 정리"
```

If no files changed, do not create an empty commit.

## Execution Handoff

Plan complete when this file is saved. Recommended execution mode is subagent-driven task execution because each task has a separate test cycle and commit boundary.
