# Admin Content Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a D1/R2-backed admin surface that manages Show and Project content without code changes or redeploys.

**Architecture:** A focused `content-api.mjs` owns validation, D1 transactions, publication snapshots, trash, and R2 uploads. Thin Pages Function routes apply the existing signed manager session. Vue reads published API content over the existing static store and exposes a three-column manager at `/manage/contents`.

**Tech Stack:** Vue 3, Pinia, Vue Router, Cloudflare Pages Functions, D1, R2, Node test runner

## Global Constraints

- Preserve existing `/shows/:slug` and `/projects/:slug` URLs.
- Store content metadata in D1 and image objects in R2.
- Support `show` and `project` only.
- Keep draft edits separate from the last published snapshot.
- Keep deleted content recoverable for 30 days.
- Fall back to existing static content when the public content API is unavailable.
- Follow test-first RED → GREEN → REFACTOR for every task.
- Do not expose draft fields, R2 keys, or manager-only state from public APIs.

---

## File Structure

- `migrations/0004_content_management.sql`: D1 tables, indexes, and publication snapshots.
- `src/server/content-api.mjs`: content validation, D1/R2 operations, serializers, publication and trash behavior.
- `functions/api/contents/[[path]].js`: public read routes.
- `functions/api/manage/contents/[[path]].js`: authenticated manager CRUD, publish, restore, and asset routes.
- `src/services/contents.js`: browser API client.
- `src/stores/lib/content-actions.js`: public API hydration with static fallback.
- `src/views/AdminContentsView.vue`: approved three-column content manager.
- `src/components/admin/ContentEditor.vue`: sectioned basic/content/image editor.
- `src/components/admin/ContentPublishPanel.vue`: validation, preview, publish, unpublish, trash actions.
- `scripts/migrate-static-content.mjs`: idempotent static metadata and asset import.
- `scripts/export-static-content.mjs`: converts the existing content store into importable JSON without evaluating Vue.
- `test/content-api.test.js`: server behavior tests.
- `test/content-frontend.test.js`: routes, service, store fallback, and UI contract tests.
- `test/content-migration.test.js`: static export/import completeness tests.

---

### Task 1: D1 Schema and Content Validation

**Files:**
- Create: `migrations/0004_content_management.sql`
- Create: `src/server/content-api.mjs`
- Create: `test/content-api.test.js`

**Interfaces:**
- Produces: `validateContentDraft(input)`, `validateContentForPublish(input)`, `handlePublicContentRequest(context)`, `handleManageContentRequest(context)`.
- Consumes: `context.env.DB`, `context.env.CONTENT_ASSETS`.

- [ ] **Step 1: Write failing schema and validation tests**

```js
test('content migration defines drafts, snapshots, credits, assets, and slug history', () => {
  const sql = readProjectFile('migrations/0004_content_management.sql')
  for (const table of ['contents', 'content_publications', 'content_credits', 'content_assets', 'content_slug_history']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
  }
})

test('publish validation requires title, start date, poster, credit, and body text', () => {
  assert.deepEqual(validateContentForPublish({ type: 'show', slug: 'draft' }).fields.sort(), [
    'body', 'credits', 'poster', 'startDate', 'title',
  ])
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test test/content-api.test.js`

Expected: FAIL because the migration and `content-api.mjs` do not exist.

- [ ] **Step 3: Add the schema and minimal validators**

```js
export function validateContentDraft(input = {}) {
  const fields = {}
  if (input.type != null && !['show', 'project'].includes(input.type)) fields.type = '타입을 확인해주세요.'
  if (input.slug != null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) fields.slug = 'slug 형식을 확인해주세요.'
  return { ok: Object.keys(fields).length === 0, fields }
}

export function validateContentForPublish(input = {}) {
  const fields = { ...validateContentDraft(input).fields }
  if (!input.title?.trim()) fields.title = '제목을 입력해주세요.'
  if (!input.startDate) fields.startDate = '시작일을 입력해주세요.'
  if (!input.body?.trim() && !input.description?.trim()) fields.body = '소개 또는 본문을 입력해주세요.'
  if (!input.credits?.length) fields.credits = '크레딧을 한 개 이상 입력해주세요.'
  if (!input.assets?.some(asset => asset.role === 'poster' && asset.uploadStatus === 'ready')) fields.poster = '포스터를 업로드해주세요.'
  return { ok: Object.keys(fields).length === 0, fields }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test test/content-api.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add migrations/0004_content_management.sql src/server/content-api.mjs test/content-api.test.js
git commit -m "2026-07-29 콘텐츠 D1 스키마와 검증 추가"
```

### Task 2: Authenticated CRUD and Publication Snapshots

**Files:**
- Modify: `src/server/content-api.mjs`
- Create: `functions/api/manage/contents/[[path]].js`
- Modify: `test/content-api.test.js`
- Modify: `test/manage-auth.test.js`

**Interfaces:**
- Consumes: `handleManageApiRequest(context, handler)` from `src/server/manage-auth.mjs`.
- Produces: manager list/create/read/update/publish/unpublish/delete/restore endpoints.

- [ ] **Step 1: Write failing manager API tests**

```js
test('manager creates an incomplete draft and returns the normalized record', async () => {
  const db = createContentDb()
  const response = await handleManageContentRequest(contextFor('/api/manage/contents', 'POST', {
    type: 'show', title: '새 전시',
  }, { DB: db }))
  assert.equal(response.status, 201)
  assert.equal((await response.json()).data.status, 'draft')
})

test('publishing copies a complete draft into the public snapshot', async () => {
  const response = await handleManageContentRequest(contextFor('/api/manage/contents/content-1/publish', 'POST', {}, env))
  assert.equal(response.status, 200)
  assert.equal(env.DB.publication.status, 'published')
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-api.test.js test/manage-auth.test.js`

Expected: FAIL with missing CRUD routing.

- [ ] **Step 3: Implement path dispatch and D1 repository operations**

```js
export async function handleManageContentRequest(context) {
  const { request, env } = context
  const path = new URL(request.url).pathname.replace(/^\/api\/manage\/contents\/?/, '')
  if (!path && request.method === 'GET') return listManagerContents(env.DB, request)
  if (!path && request.method === 'POST') return createContent(env.DB, await readJson(request))
  if (path.endsWith('/publish') && request.method === 'POST') return publishContent(env.DB, path.split('/')[0])
  if (path.endsWith('/unpublish') && request.method === 'POST') return unpublishContent(env.DB, path.split('/')[0])
  if (path.endsWith('/restore') && request.method === 'POST') return restoreContent(env.DB, path.split('/')[0])
  if (request.method === 'PATCH') return updateContent(env.DB, path, await readJson(request))
  if (request.method === 'DELETE') return trashContent(env.DB, path)
  return jsonError(404, 'content_route_not_found', '콘텐츠 요청을 찾을 수 없습니다.')
}
```

Use `DB.batch()` for draft fields, credits, and asset metadata. Use a transaction-equivalent D1 batch for publication snapshot replacement. Store the publication payload as normalized JSON so public reads never join draft tables.

- [ ] **Step 4: Add the authenticated catch-all route**

```js
import { handleManageApiRequest } from '../../../../src/server/manage-auth.mjs'
import { handleManageContentRequest } from '../../../../src/server/content-api.mjs'

export const onRequest = context =>
  handleManageApiRequest(context, handleManageContentRequest)
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test test/content-api.test.js test/manage-auth.test.js`

Expected: PASS.

```bash
git add src/server/content-api.mjs functions/api/manage/contents test/content-api.test.js test/manage-auth.test.js
git commit -m "2026-07-29 관리자 콘텐츠 CRUD와 공개본 추가"
```

### Task 3: R2 Asset Upload and Cleanup

**Files:**
- Modify: `src/server/content-api.mjs`
- Modify: `functions/api/manage/contents/[[path]].js`
- Modify: `wrangler.jsonc`
- Modify: `wrangler.pages.example.jsonc`
- Modify: `test/content-api.test.js`
- Modify: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Consumes: R2 binding `CONTENT_ASSETS`.
- Produces: `POST .../:id/assets`, `PATCH .../:id/assets/:assetId`, `DELETE .../:id/assets/:assetId`.

- [ ] **Step 1: Write failing upload tests**

```js
test('asset upload rejects unsupported signatures before writing R2', async () => {
  const response = await uploadAsset(env, 'content-1', new File(['text'], 'poster.jpg', { type: 'image/jpeg' }))
  assert.equal(response.status, 415)
  assert.equal(env.CONTENT_ASSETS.putCalls.length, 0)
})

test('ready poster is written under a content-scoped R2 key', async () => {
  const response = await uploadAsset(env, 'content-1', validJpegFile())
  assert.match((await response.json()).data.objectUrl, /contents\/content-1\/original\//)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-api.test.js test/cloudflare-pages-deploy.test.js`

Expected: FAIL because upload handling and R2 bindings are missing.

- [ ] **Step 3: Implement signature checks and R2 writes**

```js
const IMAGE_TYPES = {
  'image/jpeg': bytes => bytes[0] === 0xff && bytes[1] === 0xd8,
  'image/png': bytes => bytes[0] === 0x89 && bytes[1] === 0x50,
  'image/webp': bytes => String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
  'image/avif': bytes => String.fromCharCode(...bytes.slice(4, 12)).includes('ftyp'),
}
```

Accept multipart `file`, `role`, `altText`, and `caption`; limit files to 20 MiB; write originals under `contents/{contentId}/original/{assetId}.{ext}`; expose `/api/contents/assets/{assetId}` through the public handler; mark transformation fallback as `original` until a derived object exists.

- [ ] **Step 4: Bind R2 in both Wrangler configs**

```json
"r2_buckets": [
  { "binding": "CONTENT_ASSETS", "bucket_name": "space-ddf-content-assets" }
]
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test test/content-api.test.js test/cloudflare-pages-deploy.test.js`

Expected: PASS.

```bash
git add src/server/content-api.mjs wrangler.jsonc wrangler.pages.example.jsonc test/content-api.test.js test/cloudflare-pages-deploy.test.js
git commit -m "2026-07-29 콘텐츠 이미지 R2 업로드 추가"
```

### Task 4: Public API and Static Fallback Hydration

**Files:**
- Create: `functions/api/contents/[[path]].js`
- Create: `src/services/contents.js`
- Modify: `src/stores/content.js`
- Modify: `src/stores/lib/content-actions.js`
- Modify: `src/App.vue`
- Create: `test/content-frontend.test.js`
- Modify: `test/content-api.test.js`

**Interfaces:**
- Produces: `fetchPublishedContents(type)`, `fetchPublishedContent(type, slug)`, Pinia action `hydratePublishedContents()`.
- Consumes: existing static `shows` and `projects`.

- [ ] **Step 1: Write failing public and fallback tests**

```js
test('public list only returns published snapshots', async () => {
  const response = await handlePublicContentRequest(contextFor('/api/contents?type=show', 'GET', null, env))
  assert.deepEqual((await response.json()).data.map(item => item.slug), ['published-show'])
})

test('content store keeps static data when public hydration fails', () => {
  const source = readProjectFile('src/stores/lib/content-actions.js')
  assert.match(source, /catch[\\s\\S]*contentSource = 'static'/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-api.test.js test/content-frontend.test.js`

Expected: FAIL with missing public handler and service.

- [ ] **Step 3: Implement public serialization and client hydration**

```js
export const contentActions = {
  async hydratePublishedContents() {
    try {
      const [shows, projects] = await Promise.all([
        fetchPublishedContents('show'),
        fetchPublishedContents('project'),
      ])
      if (shows.length) this.shows = mergeBySlug(this.shows, shows)
      if (projects.length) this.projects = mergeBySlug(this.projects, projects)
      this.contentSource = 'api'
    } catch {
      this.contentSource = 'static'
    }
  },
}
```

Call hydration once in the app shell. Public records override matching static slugs; static-only records remain available throughout migration.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test test/content-api.test.js test/content-frontend.test.js`

Expected: PASS.

```bash
git add functions/api/contents src/services/contents.js src/stores/content.js src/stores/lib/content-actions.js src/App.vue test/content-api.test.js test/content-frontend.test.js
git commit -m "2026-07-29 공개 콘텐츠 API와 정적 fallback 추가"
```

### Task 5: Three-Column Admin Contents UI

**Files:**
- Create: `src/views/AdminContentsView.vue`
- Create: `src/components/admin/ContentEditor.vue`
- Create: `src/components/admin/ContentPublishPanel.vue`
- Modify: `src/services/contents.js`
- Modify: `src/router/index.js`
- Modify: `src/App.vue`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- Consumes: manager service methods `fetchAdminContents`, `createAdminContent`, `updateAdminContent`, `publishAdminContent`, `unpublishAdminContent`, `trashAdminContent`, `restoreAdminContent`, `uploadAdminContentAsset`.
- Produces: `/manage/contents` and `/admin/contents`.

- [ ] **Step 1: Write failing UI contract tests**

```js
test('router exposes protected content manager aliases', () => {
  const source = readProjectFile('src/router/index.js')
  assert.match(source, /path:\\s*'\\/manage\\/contents'/)
  assert.match(source, /name:\\s*'manage-contents'/)
})

test('content manager uses the approved navigation, editor, and publish panels', () => {
  const source = readProjectFile('src/views/AdminContentsView.vue')
  assert.match(source, /admin-content-nav/)
  assert.match(source, /<ContentEditor/)
  assert.match(source, /<ContentPublishPanel/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-frontend.test.js`

Expected: FAIL because the route and view do not exist.

- [ ] **Step 3: Implement the service and approved layout**

Use three responsibilities:

```vue
<main class="admin-contents-page">
  <aside class="admin-content-nav">...</aside>
  <ContentEditor v-model="draft" :section="activeSection" @upload="uploadAsset" />
  <ContentPublishPanel
    :content="draft"
    :validation="publishValidation"
    @preview="openPreview"
    @publish="publish"
    @trash="trash"
  />
</main>
```

Add 500 ms debounced autosave with visible `저장 중`, `저장됨`, and `저장 실패` states. Use basic/content/image section tabs, repeatable draggable credits, file inputs, gallery order controls, and responsive stacking below 960 px.

- [ ] **Step 4: Add navigation links and route aliases**

`/admin/contents` redirects to `/manage/contents`; `/manage` continues to default to rentals. The admin shell exposes `대관 관리` and `콘텐츠 관리`.

- [ ] **Step 5: Verify GREEN, build, and commit**

Run: `node --test test/content-frontend.test.js test/manage-auth.test.js && npm run build:pages`

Expected: tests PASS and Vite build exits 0.

```bash
git add src/views/AdminContentsView.vue src/components/admin src/services/contents.js src/router/index.js src/App.vue test/content-frontend.test.js
git commit -m "2026-07-29 관리자 콘텐츠 편집 화면 추가"
```

### Task 6: Preview, Redirect, Trash Purge, and Migration

**Files:**
- Modify: `src/server/content-api.mjs`
- Create: `scripts/export-static-content.mjs`
- Create: `scripts/migrate-static-content.mjs`
- Modify: `package.json`
- Create: `test/content-migration.test.js`
- Modify: `test/content-api.test.js`
- Modify: `workers/rental-ops/index.mjs`
- Modify: `wrangler.rental-ops.jsonc`

**Interfaces:**
- Produces: signed manager preview endpoint, slug redirect responses, `npm run content:export`, `npm run content:migrate`, scheduled purge.

- [ ] **Step 1: Write failing preview, redirect, purge, and migration tests**

```js
test('old slug returns the current canonical location', async () => {
  const response = await handlePublicContentRequest(contextFor('/api/contents/redirect/show/old-show', 'GET', null, env))
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('location'), '/shows/new-show')
})

test('static export includes every configured show and project slug', () => {
  const exported = exportStaticContent()
  assert.equal(exported.shows.length, expectedShowSlugs.length)
  assert.equal(exported.projects.length, expectedProjectSlugs.length)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-api.test.js test/content-migration.test.js`

Expected: FAIL with missing redirect and scripts.

- [ ] **Step 3: Implement idempotent export/import**

The exporter parses the literal slug arrays and metadata objects from `src/stores/content.js`, resolves asset manifests, and writes JSON to stdout. The importer uses D1 upserts keyed by `type + slug` and R2 `head()` before `put()` so reruns do not duplicate records or objects. `--dry-run` prints totals and unresolved assets without writes.

- [ ] **Step 4: Implement preview and cleanup**

Generate an HMAC preview token containing content ID and 30-minute expiry; validate it only on the draft preview route. Extend the scheduled operations worker to delete D1 content and R2 object keys whose `purge_after <= now`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test test/content-api.test.js test/content-migration.test.js test/rental-ops.test.js`

Expected: PASS.

```bash
git add src/server/content-api.mjs scripts/export-static-content.mjs scripts/migrate-static-content.mjs package.json package-lock.json test/content-api.test.js test/content-migration.test.js workers/rental-ops/index.mjs wrangler.rental-ops.jsonc
git commit -m "2026-07-29 콘텐츠 이전 미리보기와 정리 작업 추가"
```

### Task 7: Full Verification and Operational Documentation

**Files:**
- Modify: `docs/cloudflare-rental-deployment.md`
- Create: `docs/cloudflare-content-management.md`
- Modify: `scripts/smoke-test.js`
- Modify: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Documents and verifies D1 migration, R2 creation/binding, migration dry-run, import, and rollback.

- [ ] **Step 1: Write failing deployment contract tests**

```js
test('deployment docs include the content D1 migration and R2 bucket setup', () => {
  const docs = readProjectFile('docs/cloudflare-content-management.md')
  assert.match(docs, /wrangler d1 migrations apply/)
  assert.match(docs, /wrangler r2 bucket create space-ddf-content-assets/)
  assert.match(docs, /content:migrate -- --dry-run/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/cloudflare-pages-deploy.test.js`

Expected: FAIL because the content deployment guide is missing.

- [ ] **Step 3: Add exact runbook and smoke checks**

Document:

```bash
npx wrangler r2 bucket create space-ddf-content-assets
npx wrangler d1 migrations apply space-ddf-rentals --remote
npm run content:migrate -- --dry-run
npm run content:migrate -- --remote
npm run build:pages
npm run smoke:pages -- https://preview.example.pages.dev
```

Include rollback: disable API hydration, retain static store, keep D1/R2 data, and redeploy the previous Pages version.

- [ ] **Step 4: Run complete verification**

Run: `npm test && npm run lint && npm run build:pages`

Expected: all tests PASS, ESLint exits 0, build exits 0.

- [ ] **Step 5: Commit**

```bash
git add docs/cloudflare-content-management.md docs/cloudflare-rental-deployment.md scripts/smoke-test.js test/cloudflare-pages-deploy.test.js
git commit -m "2026-07-29 콘텐츠 관리 배포 문서와 검증 추가"
```

