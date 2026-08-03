# Space DDF Rental Search and Conversion SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/rental` a crawlable, search-intent-aligned landing page for Gwangju art exhibition and workshop rentals while measuring the anonymous path from visit to successful inquiry.

**Architecture:** Keep `/rental` as the single rental landing route. Define shared rental SEO copy and JSON-LD in focused modules consumed by both the SPA SEO updater and the static prerenderer, then add factual on-page FAQ content and a failure-safe analytics event helper around the existing rental workflow.

**Tech Stack:** Vue 3, Vue Router, Vite, Node test runner, JSON-LD/Schema.org, Google Analytics `gtag`, Cloudflare Pages prerendering

## Global Constraints

- Target `광주 전시공간 대관`, `광주 예술전시 대관`, and `광주 워크숍 공간 대관`.
- Allowed uses are art exhibitions, photography/video/installation/sound/publishing/research projects, and art workshops.
- Do not target photo studios, commercial pop-ups, parties, or generic event rentals.
- Never claim unverified prices, dimensions, capacity, facilities, rankings, or inquiry volume.
- Preserve the existing Space DDF visual system and rental application behavior.
- Add the exact NAVER verification token `db3ba905f8c30216f6a47a1d221582fdb5bef855` once in the shared HTML head.
- Analytics must never include applicant contact, name, project text, or another free-form value.
- User-owned untracked paths `.playwright-cli/`, `.superpowers/brainstorm/`, `.wrangler/`, and `output/` must remain untouched.

---

## File Map

- Create `src/lib/rental-seo.mjs`: canonical rental title, description, FAQ copy, and JSON-LD graph factory shared across build and browser code.
- Create `src/services/rental-analytics.js`: small failure-safe event API that emits only allowlisted event names and metadata.
- Modify `src/lib/seo.js`: recognize the rental route and apply its shared metadata and graph.
- Modify `scripts/prerender-seo.js`: prerender `/rental` with the same metadata and graph.
- Modify `src/views/RentalView.vue`: render factual landing copy/FAQ and emit conversion events at existing workflow boundaries.
- Modify `index.html`: add NAVER site verification.
- Modify `public/sitemap.xml`: add canonical rental URL.
- Modify `src/views/DetailView.vue`: add a contextual rental link after detail content without changing content data.
- Modify or create tests under `test/`: lock verification, metadata parity, structured data, internal links, copy exclusions, and analytics privacy.

---

### Task 1: Shared rental SEO contract and NAVER verification

**Files:**
- Create: `src/lib/rental-seo.mjs`
- Modify: `index.html`
- Modify: `public/sitemap.xml`
- Create: `test/rental-seo.test.js`

**Interfaces:**
- Produces: `RENTAL_CANONICAL_PATH`, `RENTAL_TITLE`, `RENTAL_DESCRIPTION`, `RENTAL_FAQS`, and `rentalStructuredData({ siteUrl, venue })`.
- Consumes: no application state; `venue` contains the existing organization `@id` and object.

- [ ] **Step 1: Write failing contract tests**

```js
test('shared HTML exposes NAVER verification exactly once', () => {
  const html = readProjectFile('index.html')
  assert.equal((html.match(/name="naver-site-verification"/g) || []).length, 1)
  assert.match(html, /content="db3ba905f8c30216f6a47a1d221582fdb5bef855"/)
})

test('rental sitemap entry is canonical and high priority', () => {
  const sitemap = readProjectFile('public/sitemap.xml')
  assert.match(sitemap, /<loc>https:\/\/spaceddf\.xyz\/rental<\/loc>[\s\S]*?<changefreq>weekly<\/changefreq>[\s\S]*?<priority>0\.9<\/priority>/)
})

test('rental SEO contract targets art exhibitions and workshops only', async () => {
  const seo = await import('../src/lib/rental-seo.mjs')
  assert.equal(seo.RENTAL_CANONICAL_PATH, '/rental')
  assert.match(seo.RENTAL_TITLE, /광주 전시공간 대관/)
  assert.match(seo.RENTAL_DESCRIPTION, /예술전시/)
  assert.match(seo.RENTAL_DESCRIPTION, /워크숍/)
  assert.doesNotMatch(`${seo.RENTAL_TITLE} ${seo.RENTAL_DESCRIPTION}`, /촬영 스튜디오|상업 팝업|파티/)
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/rental-seo.test.js`

Expected: FAIL because `src/lib/rental-seo.mjs` and the verification/sitemap entries do not exist.

- [ ] **Step 3: Implement the shared contract and discovery tags**

Create exported constants and a graph factory whose output is:

```js
export const RENTAL_CANONICAL_PATH = '/rental'
export const RENTAL_TITLE = '광주 전시공간 대관 | 예술전시·워크숍 Space DDF'
export const RENTAL_DESCRIPTION = '광주 동구 Space DDF의 예술전시·워크숍 공간 대관 안내입니다. 사진, 영상, 설치, 사운드, 출판, 리서치 기반 프로젝트의 대관 가능 일정을 확인하고 온라인으로 신청하세요.'

export const RENTAL_FAQS = [
  { question: '어떤 프로젝트를 대관 신청할 수 있나요?', answer: '예술전시와 사진, 영상, 설치, 사운드, 출판, 리서치 기반 프로젝트 및 예술 워크숍을 신청할 수 있습니다.' },
  { question: '대관 일정은 어떻게 선택하나요?', answer: '페이지의 대관 가능 일정 안에서 시작일과 종료일을 차례로 선택한 뒤 신청서를 작성합니다.' },
  { question: '신청 후 바로 확정되나요?', answer: '접수 후 공간과 일정 검토를 거쳐 승인 여부와 결제 방법을 별도로 안내합니다.' },
  { question: '문화예술 지원사업 할인이 있나요?', answer: 'K-ART, 광주문화재단 등 문화예술 지원사업 준비자는 10% 할인을 검토합니다.' },
]
```

`rentalStructuredData` must return a graph containing `BreadcrumbList`, `Service`, `FAQPage`, and the supplied `ArtGallery`/`EventVenue`, with the service provider and area served linked to Space DDF and Gwangju.

Add the exact NAVER tag below the existing robots meta in `index.html`. Add `/rental` after the home entry in `public/sitemap.xml` with `weekly` and `0.9`.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test test/rental-seo.test.js`

Expected: all Task 1 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rental-seo.mjs index.html public/sitemap.xml test/rental-seo.test.js
git commit -m "2026-08-03 대관 SEO 공통 계약 및 네이버 인증 추가"
```

---

### Task 2: SPA and prerender metadata parity

**Files:**
- Modify: `src/lib/seo.js`
- Modify: `scripts/prerender-seo.js`
- Modify: `test/rental-seo.test.js`
- Modify: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Consumes: Task 1 constants and `rentalStructuredData`.
- Produces: identical `/rental` canonical, title, description, OG/Twitter values, and JSON-LD in browser navigation and `dist/rental/index.html`.

- [ ] **Step 1: Add failing SPA and prerender tests**

```js
test('browser SEO recognizes rental as its own canonical route', () => {
  const source = readProjectFile('src/lib/seo.js')
  assert.match(source, /route\.name === 'rental'/)
  assert.match(source, /RENTAL_CANONICAL_PATH/)
  assert.match(source, /rentalStructuredData/)
})

test('Pages prerender gives rental its dedicated search metadata', () => {
  const html = readProjectFile('dist/rental/index.html')
  assert.match(html, /<title>광주 전시공간 대관 \| 예술전시·워크숍 Space DDF<\/title>/)
  assert.match(html, /<link rel="canonical" href="https:\/\/spaceddf\.xyz\/rental" \/>/)
  assert.match(html, /"@type": "Service"/)
  assert.match(html, /"@type": "FAQPage"/)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test test/rental-seo.test.js test/cloudflare-pages-deploy.test.js`

Expected: FAIL because rental currently falls back to home metadata and prerender output.

- [ ] **Step 3: Implement route-aware browser SEO**

Import Task 1 exports in `src/lib/seo.js`, add `isRental`, and select:

```js
const canonicalPath = item
  ? route.path
  : isRental
    ? RENTAL_CANONICAL_PATH
    : isArchive
      ? '/archive-map'
      : isArchiveRoute
        ? '/archive-route'
        : '/'
```

Use `RENTAL_TITLE`, `RENTAL_DESCRIPTION`, and `rentalStructuredData({ siteUrl: SITE_URL, venue: artGalleryStructuredData() })` for the rental route. Preserve detail, archive, route, not-found, and home behavior.

- [ ] **Step 4: Implement static rental prerender parity**

Import the same shared exports in `scripts/prerender-seo.js`. Extend `renderStaticRouteHtml` so `/rental` replaces title, canonical, description, OG/Twitter tags, and `route-structured-data`. Leave `/archive-route` handling intact and keep `/admin` on the default non-rental metadata.

- [ ] **Step 5: Build and run focused tests**

Run: `npm run build:pages && node --test test/rental-seo.test.js test/cloudflare-pages-deploy.test.js`

Expected: build succeeds and focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo.js scripts/prerender-seo.js test/rental-seo.test.js test/cloudflare-pages-deploy.test.js
git commit -m "2026-08-03 대관 라우트 검색 메타데이터 분리"
```

---

### Task 3: Factual rental landing copy, FAQ, and internal links

**Files:**
- Modify: `src/views/RentalView.vue`
- Modify: `src/views/DetailView.vue`
- Modify: `test/home-rental-calendar.test.js`
- Modify: `test/rental-seo.test.js`

**Interfaces:**
- Consumes: `RENTAL_FAQS` from Task 1.
- Produces: visible H1/search copy and FAQs that exactly match JSON-LD, plus contextual `/rental` links from public content.

- [ ] **Step 1: Add failing content-contract tests**

```js
test('rental page has one search-intent H1 and renders shared FAQ copy', () => {
  const view = readProjectFile('src/views/RentalView.vue')
  assert.equal((view.match(/<h1[\s>]/g) || []).length, 1)
  assert.match(view, /광주 전시공간 대관/)
  assert.match(view, /v-for="item in rentalFaqs"/)
  assert.match(view, /RENTAL_FAQS/)
  assert.doesNotMatch(view, /촬영 스튜디오|상업 팝업|파티 대관/)
})

test('public exhibition details link contextually to rental', () => {
  const view = readProjectFile('src/views/DetailView.vue')
  assert.match(view, /to="\/rental"/)
  assert.match(view, /광주 전시공간 대관/)
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test test/rental-seo.test.js test/home-rental-calendar.test.js`

Expected: FAIL because the rental H1, shared FAQ, and detail link are absent.

- [ ] **Step 3: Implement semantic page content**

Change the single H1 to `광주 전시공간 대관` and retain `Space DDF Rental` as the existing small label. Update its supporting paragraph to mention art exhibitions and workshops without excluded uses.

Import `RENTAL_FAQS`, assign `const rentalFaqs = RENTAL_FAQS`, and render after the main layout:

```vue
<section class="rental-faq" aria-labelledby="rental-faq-title">
  <h2 id="rental-faq-title">대관 안내 FAQ</h2>
  <dl>
    <div v-for="item in rentalFaqs" :key="item.question">
      <dt>{{ item.question }}</dt>
      <dd>{{ item.answer }}</dd>
    </div>
  </dl>
</section>
```

Style the FAQ using the current border, spacing, font-size, and responsive breakpoints; do not introduce cards, gradients, badges, or large display typography.

- [ ] **Step 4: Add the contextual detail link**

After the detail body/credits, add one compact `RouterLink` reading `광주 전시공간 대관 안내` and a factual line that Space DDF accepts art exhibition and workshop proposals. Keep it visually subordinate to the artwork content.

- [ ] **Step 5: Run focused and regression tests**

Run: `node --test test/rental-seo.test.js test/home-rental-calendar.test.js test/content-frontend.test.js`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/RentalView.vue src/views/DetailView.vue test/rental-seo.test.js test/home-rental-calendar.test.js
git commit -m "2026-08-03 대관 검색 랜딩 콘텐츠 및 내부 링크 추가"
```

---

### Task 4: Privacy-safe rental conversion analytics

**Files:**
- Create: `src/services/rental-analytics.js`
- Modify: `src/views/RentalView.vue`
- Create: `test/rental-analytics.test.js`

**Interfaces:**
- Produces: `trackRentalEvent(name, parameters?, { windowRef }?) => boolean` and fixed `RENTAL_ANALYTICS_EVENTS`.
- Consumes: `window.gtag` installed by the existing production-only analytics loader.

- [ ] **Step 1: Write failing analytics tests**

```js
test('rental analytics emits only allowlisted events', async () => {
  const calls = []
  const { trackRentalEvent } = await import('../src/services/rental-analytics.js')
  assert.equal(trackRentalEvent('rental_view', {}, { windowRef: { gtag: (...args) => calls.push(args) } }), true)
  assert.deepEqual(calls[0], ['event', 'rental_view', {}])
  assert.equal(trackRentalEvent('applicant_email', {}, { windowRef: { gtag() {} } }), false)
})

test('rental analytics strips free-form and personal fields', async () => {
  const calls = []
  const { trackRentalEvent } = await import('../src/services/rental-analytics.js')
  trackRentalEvent('rental_submit_error', {
    error_code: 'date_conflict',
    contact: 'artist@example.com',
    projectIntro: 'private proposal',
  }, { windowRef: { gtag: (...args) => calls.push(args) } })
  assert.deepEqual(calls[0][2], { error_code: 'date_conflict' })
})

test('missing or throwing gtag never breaks rental interactions', async () => {
  const { trackRentalEvent } = await import('../src/services/rental-analytics.js')
  assert.equal(trackRentalEvent('rental_view', {}, { windowRef: {} }), false)
  assert.equal(trackRentalEvent('rental_view', {}, { windowRef: { gtag() { throw new Error('blocked') } } }), false)
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/rental-analytics.test.js`

Expected: FAIL because the analytics module does not exist.

- [ ] **Step 3: Implement the allowlisted helper**

Allow only these names:

```js
export const RENTAL_ANALYTICS_EVENTS = Object.freeze([
  'rental_view',
  'rental_date_select',
  'rental_form_start',
  'rental_submit_success',
  'rental_submit_error',
])
```

Allow only `source`, `support_program`, `duration_days`, and `error_code` parameters; coerce them to bounded primitive values and drop every other key. Wrap `gtag` lookup and invocation in `try/catch`, returning `false` on absence or failure.

- [ ] **Step 4: Attach events to existing workflow boundaries**

In `RentalView.vue`:

- call `rental_view` once in `onMounted`;
- call `rental_date_select` after a valid start/end range is stored, with bounded `duration_days` only;
- add an `@input="trackFormStart"` handler on the form and use a local boolean so `rental_form_start` fires once;
- call `rental_submit_success` only after `submitRentalRequest` resolves;
- call `rental_submit_error` in the existing catch with a fixed code derived from the known `RentalApiError.code`, falling back to `unknown`.

Never pass `form.name`, `form.contact`, `form.projectIntro`, selected dates, or notice text.

- [ ] **Step 5: Run focused tests and regression tests**

Run: `node --test test/rental-analytics.test.js test/rental-frontend-api.test.js test/home-rental-calendar.test.js`

Expected: all tests PASS and existing form submission contracts remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/services/rental-analytics.js src/views/RentalView.vue test/rental-analytics.test.js
git commit -m "2026-08-03 대관 문의 전환 이벤트 측정 추가"
```

---

### Task 5: Full QA, browser verification, and deployment

**Files:**
- Modify only if QA exposes a defect in files already listed above.
- Do not add browser screenshots, traces, `.playwright-cli`, `.wrangler`, or `output` artifacts to git.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: verified production build and deployed Cloudflare Pages release.

- [ ] **Step 1: Run complete automated QA**

Run:

```bash
npm test
npm run lint
npm run build:pages
git diff --check
```

Expected: all repository and scraper tests PASS, lint exits 0, Pages build exits 0, and diff check prints nothing.

- [ ] **Step 2: Inspect production HTML**

Run:

```bash
rg -n "naver-site-verification|광주 전시공간 대관|https://spaceddf.xyz/rental|FAQPage|Service" dist/index.html dist/rental/index.html
```

Expected: NAVER verification appears in both documents; dedicated rental metadata, canonical, FAQ, and Service appear in `dist/rental/index.html`.

- [ ] **Step 3: Browser QA at desktop and mobile widths**

Run the production preview and inspect `/rental` at approximately 1280px and 390px widths. Confirm:

- exactly one visible H1 reads `광주 전시공간 대관`;
- supporting copy mentions art exhibitions and workshops but not excluded uses;
- available-date calendar and application form still work;
- FAQ is visible after the application layout and matches JSON-LD;
- the public detail page has a contextual rental link;
- no horizontal overflow, clipped controls, console errors, or layout overlap occurs.

- [ ] **Step 4: Verify structured data and copy contracts**

Parse the `route-structured-data` JSON from `dist/rental/index.html` with Node, assert it contains one `Service` and one `FAQPage`, and compare FAQ question/answer strings with `RENTAL_FAQS`. Confirm no excluded keyword or unverified price/capacity/dimension exists.

- [ ] **Step 5: Commit QA fixes if required**

```bash
git add <only-the-reviewed-source-and-test-files>
git commit -m "2026-08-03 대관 SEO 반응형 및 구조화 데이터 QA 보완"
```

Skip this commit if no source change is required.

- [ ] **Step 6: Push and deploy**

```bash
git push origin main
npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf
```

Expected: main push succeeds and Wrangler returns a unique Pages preview URL.

- [ ] **Step 7: Production smoke verification**

Run HTTP checks for the preview URL and `https://spaceddf.xyz/rental`, expecting status 200. Fetch the production HTML and verify the NAVER token, rental canonical, title, and JSON-LD markers are present before reporting completion.
