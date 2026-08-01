# Project and Show Metadata Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize every Project and Show into one public information format and prove that `/admin` can enter, save, reload, publish, and expose the complete format without losing custom metadata.

**Architecture:** The existing `content_credits` array remains the storage contract. A shared credit normalizer canonicalizes standard labels and URLs before the API persists records, a reusable audit checks both static and managed content, and a targeted idempotent SQL cleanup fixes the three confirmed legacy anomalies without inventing facts. The existing shared Detail view remains the only public renderer for both content types.

**Tech Stack:** Vue 3 Composition API, Node.js built-in test runner, Cloudflare Pages Functions, D1/SQLite JSON functions, Wrangler, Playwright/browser QA.

## Global Constraints

- Standard order is `Artists`, `Curating`, `Critic`, `Graphic`, `Support`, `Archive`, `Directing`.
- Missing optional information is hidden on public pages but remains editable in `/admin`.
- `Homepage`, `Judgement`, and `Co-Directing` remain custom information after the standard groups.
- Instagram destinations render as accessible SVG icons; raw Instagram URLs never render as visible text.
- Empty virtual credit rows are not persisted and a label-only row cannot satisfy publish validation.
- Existing factual names and missing venue data must not be inferred or rewritten.
- Managed D1 and static fallback records must produce the same metadata format.
- Preserve unrelated dirty-worktree changes and stage only files owned by each task.

---

### Task 1: Canonical API credit normalization and publish validation

**Files:**
- Modify: `src/lib/credit-links.js`
- Modify: `src/server/content-api.mjs`
- Modify: `src/views/AdminContentsView.vue`
- Test: `test/content-credits.test.js`
- Test: `test/content-api.test.js`
- Test: `test/content-frontend.test.js`

**Interfaces:**
- Produces: `normalizeCreditUrl(value): string`, returning a normalized `http`/`https` URL or `''`.
- Changes: `normalizeContentInput(input).credits` canonicalizes standard labels and removes label-only rows.
- Changes: `validateContentForPublish(input)` requires `credit.label.trim()` and `credit.value.trim()` on at least one record.
- Preserves: `credits: Array<{ label, value, url, sortOrder }>` and all populated custom labels.

- [ ] **Step 1: Write failing normalizer and validation tests**

```js
test('credit URLs accept http links and reject unsafe protocols', () => {
  assert.equal(creditLinks.normalizeCreditUrl('https://instagram.com/kmhnsk'), 'https://instagram.com/kmhnsk')
  assert.equal(creditLinks.normalizeCreditUrl('javascript:alert(1)'), '')
  assert.equal(creditLinks.normalizeCreditUrl('not a url'), '')
})

test('content input canonicalizes labels and removes label-only rows', () => {
  const result = normalizeContentInput({
    credits: [
      { label: '참여작가', value: ' 김현석 ', url: 'https://instagram.com/kmhnsk' },
      { label: 'Artists', value: '   ' },
      { label: 'Homepage', value: 'peer-up.com', url: 'javascript:alert(1)' },
    ],
  })
  assert.deepEqual(result.credits, [
    { label: 'Artists', value: '김현석', url: 'https://instagram.com/kmhnsk', sortOrder: 0 },
    { label: 'Homepage', value: 'peer-up.com', url: '', sortOrder: 2 },
  ])
})

test('label-only credits do not satisfy publish validation', () => {
  const result = validateContentForPublish({
    type: 'show', slug: 'empty-credit', title: '빈 크레딧', startDate: '2026-08-02',
    body: '본문', credits: [{ label: 'Artists', value: '' }],
    assets: [{ role: 'poster', uploadStatus: 'ready' }],
  })
  assert.equal(result.fields.credits, '내용이 있는 크레딧을 한 개 이상 입력해주세요.')
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/content-credits.test.js test/content-api.test.js test/content-frontend.test.js`

Expected: FAIL because `normalizeCreditUrl` is missing, aliases remain uncanonicalized in API input, and a label-only row passes current length validation.

- [ ] **Step 3: Add the shared URL and API normalization**

```js
// src/lib/credit-links.js
export function normalizeCreditUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const candidate = /^www\./i.test(text) ? `https://${text}` : text
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? candidate : ''
  } catch {
    return ''
  }
}
```

```js
// src/server/content-api.mjs
import { normalizeCreditLabel, normalizeCreditUrl } from '../lib/credit-links.js'

credits: Array.isArray(input.credits)
  ? input.credits
    .map((credit, index) => ({
      label: normalizeCreditLabel(text(credit?.label)),
      value: text(credit?.value),
      url: normalizeCreditUrl(credit?.url),
      sortOrder: integer(credit?.sortOrder ?? index),
    }))
    .filter(credit => credit.value || credit.url)
  : [],
```

Change publish validation to:

```js
if (!content.credits.some(credit => credit.label && credit.value)) {
  fields.credits = '내용이 있는 크레딧을 한 개 이상 입력해주세요.'
}
```

Use the same `.some(credit => credit?.label?.trim() && credit?.value?.trim())` predicate in `AdminContentsView.vue` so client and server report the same failure before publishing.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/content-credits.test.js test/content-api.test.js test/content-frontend.test.js`

Expected: all focused tests pass.

- [ ] **Step 5: Commit the normalization boundary**

```bash
git add src/lib/credit-links.js src/server/content-api.mjs src/views/AdminContentsView.vue test/content-credits.test.js test/content-api.test.js test/content-frontend.test.js
git commit -m "fix: admin 크레딧 저장 규칙 정규화"
```

### Task 2: Static fallback cleanup and metadata audit

**Files:**
- Create: `scripts/audit-content-metadata.mjs`
- Modify: `src/stores/content.js`
- Test: `test/content-metadata-audit.test.js`

**Interfaces:**
- Produces: `auditContentMetadata(contents): Array<{ type, slug, code, detail }>`.
- Consumes: `exportStaticContent()` from `scripts/export-static-content.mjs` and canonical labels from `src/lib/credit-links.js`.
- CLI contract: `node scripts/audit-content-metadata.mjs` exits `0` with `24 contents audited; 0 issues`, otherwise prints issues and exits `1`.

- [ ] **Step 1: Write failing audit tests with known invalid and valid records**

```js
test('metadata audit catches empty credits, URL locations, aliases, dates, and unsafe links', () => {
  const issues = auditContentMetadata([{
    type: 'project', slug: 'broken', dateDisplay: '', location: 'https://example.com',
    credits: [
      { label: 'Artist', value: '작가', url: '' },
      { label: 'Artists', value: '', url: '' },
      { label: 'Homepage', value: '사이트', url: 'javascript:alert(1)' },
    ],
  }])
  assert.deepEqual(new Set(issues.map(issue => issue.code)), new Set([
    'missing-date', 'url-location', 'noncanonical-label', 'empty-credit', 'invalid-credit-url',
  ]))
})

test('all static Project and Show metadata passes the canonical audit', () => {
  const { contents } = exportStaticContent()
  assert.deepEqual(auditContentMetadata(contents), [])
  assert.equal(contents.length, 24)
})
```

- [ ] **Step 2: Run the audit test and verify RED**

Run: `node --test test/content-metadata-audit.test.js`

Expected: FAIL because the audit module does not exist and the static records still contain three anomalies.

- [ ] **Step 3: Implement the pure audit and CLI**

The audit must emit these exact codes:

```js
const issue = (item, code, detail = '') => ({ type: item.type, slug: item.slug, code, detail })
// unsupported-type: type is not show/project
// missing-date: neither startDate nor dateDisplay is usable
// url-location: location begins with http:// or https://
// empty-credit: a stored record has neither value nor URL
// noncanonical-label: normalizeCreditLabel(label) differs from label
// invalid-credit-url: a non-empty URL fails normalizeCreditUrl
```

Allow populated custom labels unchanged. In CLI mode, audit `exportStaticContent().contents`, print the count, and set `process.exitCode = 1` only when issues exist.

- [ ] **Step 4: Normalize the three static fallback anomalies**

Apply these exact changes in `src/stores/content.js`:

```js
// community-chat-2025: remove 'Artists  ' entirely

// peer-up-2023 and peer-up-2024
location: '',
credits: [
  // keep every existing populated credit in its current order
  'Homepage peer-up.com https://www.peer-up.com/',
]
```

Do not change `Homepage`, `Judgement`, or `Co-Directing`, and do not add unverified venue or artist values.

- [ ] **Step 5: Run the focused audit and export**

Run: `node --test test/content-metadata-audit.test.js && node scripts/audit-content-metadata.mjs && npm run content:export >/tmp/ddf-content-export.json`

Expected: tests pass; audit prints `24 contents audited; 0 issues`; export exits `0` and writes valid JSON.

- [ ] **Step 6: Commit static normalization and audit**

```bash
git add scripts/audit-content-metadata.mjs src/stores/content.js test/content-metadata-audit.test.js
git commit -m "fix: 기존 Project·Show 기본 정보 정규화"
```

### Task 3: Admin Show/Project input and round-trip regression coverage

**Files:**
- Create: `scripts/qa-admin-content-roundtrip.mjs`
- Modify: `test/content-api.test.js`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- Verifies: the existing `Show`/`Project` selector and all seven standard groups plus custom label/value/URL fields.
- Verifies: `normalizeContentInput()` round-trips the manager payload for both content types without dropping dates, location, credits, text, or assets.
- Verifies: public formatting groups standard labels and retains custom metadata after them.
- CLI contract: with `QA_BASE_URL`, `QA_AUTH_USER`, and `QA_AUTH_PASSWORD`, create and clean up disposable Show and Project records through the real local Pages API.

- [ ] **Step 1: Add source-contract tests for every required admin field**

```js
test('admin exposes the complete Project and Show basic information format', () => {
  const editor = read('src/components/admin/ContentEditor.vue')
  for (const copy of [
    '콘텐츠 유형', 'Show', 'Project', 'Slug', '제목', '시작일', '종료일',
    '표시용 날짜', '장소', 'Artists', 'Curating', 'Critic', 'Graphic',
    'Support', 'Archive', 'Directing', '기타 정보', 'Instagram 또는 URL',
  ]) assert.match(editor, new RegExp(copy))
  assert.match(editor, /compositionstart/)
  assert.match(editor, /compositionend/)
})
```

- [ ] **Step 2: Add data round-trip tests for one Show and one Project**

```js
for (const type of ['show', 'project']) {
  test(`${type} manager payload preserves every structured field`, () => {
    const input = {
      type, slug: `${type}-round-trip`, title: `${type} 제목`,
      startDate: '2026-08-02', endDate: '2026-08-12',
      dateDisplay: '2026.08.02. - 2026.08.12.', location: 'Space DDF',
      body: '짧은 소개', description: '본문',
      credits: [
        { label: '참여작가', value: '작가', url: 'https://instagram.com/artist' },
        { label: 'Homepage', value: '공식 사이트', url: 'https://example.com' },
      ],
      assets: [{ id: 'poster', role: 'poster', uploadStatus: 'ready' }],
    }
    const normalized = normalizeContentInput(input)
    assert.equal(normalized.type, type)
    assert.equal(normalized.slug, `${type}-round-trip`)
    assert.equal(normalized.title, `${type} 제목`)
    assert.equal(normalized.startDate, '2026-08-02')
    assert.equal(normalized.endDate, '2026-08-12')
    assert.equal(normalized.dateDisplay, '2026.08.02. - 2026.08.12.')
    assert.equal(normalized.location, 'Space DDF')
    assert.equal(normalized.body, '짧은 소개')
    assert.equal(normalized.description, '본문')
    assert.deepEqual(normalized.credits, [
      { label: 'Artists', value: '작가', url: 'https://instagram.com/artist', sortOrder: 0 },
      { label: 'Homepage', value: '공식 사이트', url: 'https://example.com', sortOrder: 1 },
    ])
    assert.deepEqual(normalized.assets, [{
      id: 'poster', role: 'poster', url: '', originalUrl: '', altText: '', caption: '',
      sortOrder: 0, uploadStatus: 'ready',
    }])
    assert.equal(validateContentForPublish(normalized).ok, true)
  })
}
```

- [ ] **Step 3: Add an executable local API round-trip check**

Implement `scripts/qa-admin-content-roundtrip.mjs` with this exact flow for both `show` and `project`:

```js
const auth = `Basic ${Buffer.from(`${process.env.QA_AUTH_USER}:${process.env.QA_AUTH_PASSWORD}`).toString('base64')}`
const request = async (path, init = {}) => {
  const response = await fetch(new URL(path, process.env.QA_BASE_URL), {
    ...init,
    headers: { authorization: auth, ...(init.headers || {}) },
  })
  const payload = await response.json()
  assert.equal(response.ok, true, JSON.stringify(payload))
  return payload.data
}

for (const type of ['show', 'project']) {
  const slug = `qa-${type}-metadata-roundtrip`
  const created = await request('/api/manage/contents', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, slug, title: `${type} QA` }),
  })
  try {
    const form = new FormData()
    form.set('role', 'poster')
    form.set('file', new Blob([
      await fs.readFile(new URL('../src/assets/show/lost-topophilia/img1.jpg', import.meta.url)),
    ], { type: 'image/jpeg' }), 'poster.jpg')
    await request(`/api/manage/contents/${created.id}/assets`, { method: 'POST', body: form })

    const expected = {
      type, slug, title: `${type} QA`, startDate: '2026-08-02', endDate: '2026-08-12',
      dateDisplay: '2026.08.02. - 2026.08.12.', location: 'Space DDF',
      body: '한글 소개', description: '한글 본문',
      credits: [
        { label: 'Artists', value: '테스트 작가', url: 'https://instagram.com/test' },
        { label: 'Homepage', value: '공식 사이트', url: 'https://example.com' },
      ],
    }
    await request(`/api/manage/contents/${created.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(expected),
    })
    const reloaded = await request(`/api/manage/contents/${created.id}`)
    for (const key of ['type', 'slug', 'title', 'startDate', 'endDate', 'dateDisplay', 'location', 'body', 'description']) {
      assert.equal(reloaded[key], expected[key])
    }
    assert.deepEqual(reloaded.credits.map(({ label, value, url }) => ({ label, value, url })), expected.credits)
    await request(`/api/manage/contents/${created.id}/publish`, { method: 'POST' })
    const publicResponse = await fetch(new URL(`/api/contents/${type}/${slug}`, process.env.QA_BASE_URL))
    const publicPayload = await publicResponse.json()
    assert.equal(publicResponse.ok, true)
    assert.equal(publicPayload.data.type, type)
    assert.match(publicPayload.data.credits.join('\n'), /Artists 테스트 작가 https:\/\/instagram\.com\/test/)
    assert.match(publicPayload.data.credits.join('\n'), /Homepage 공식 사이트 https:\/\/example\.com/)
  } finally {
    await request(`/api/manage/contents/${created.id}`, { method: 'DELETE' })
  }
}
```

Import `node:assert/strict` and `node:fs/promises`, fail immediately when required environment variables are absent, and print `admin Show/Project round-trip: ok` only after both records are cleaned up.

- [ ] **Step 4: Run unit contracts and the real local API round trip**

Run: `node --test test/content-api.test.js test/content-frontend.test.js`

Expected: PASS, confirming the editor fields and Task 1 normalization contract.

Prepare and start local Pages in a separate terminal:

```bash
npx wrangler d1 migrations apply space-ddf-rentals --local
MANAGE_AUTH_PASSWORD=qa-local-password npx wrangler pages dev dist --port 8788
```

Then run:

```bash
QA_BASE_URL=http://127.0.0.1:8788 QA_AUTH_USER=ddf QA_AUTH_PASSWORD=qa-local-password node scripts/qa-admin-content-roundtrip.mjs
```

Expected: `admin Show/Project round-trip: ok`, and neither disposable slug remains published afterward.

- [ ] **Step 5: Commit the verified workflow tests**

Run: `node --test test/content-api.test.js test/content-frontend.test.js`

Expected: all tests pass.

```bash
git add scripts/qa-admin-content-roundtrip.mjs test/content-api.test.js test/content-frontend.test.js
git commit -m "test: admin Project·Show 업로드 왕복 검증"
```

### Task 4: Production D1 backup and idempotent legacy cleanup

**Files:**
- Create: `scripts/sql/normalize-project-show-metadata.sql`
- Backup artifact, do not commit: `.wrangler/backups/content-before-project-show-normalization-2026-08-02.sql`

**Interfaces:**
- Consumes database: `space-ddf-rentals` from `wrangler.jsonc`.
- Changes only slugs: `community-chat-2025`, `peer-up-2023`, `peer-up-2024`.
- Keeps `contents`, `content_credits`, and `content_publications.payload_json` synchronized.

- [ ] **Step 1: Write idempotent cleanup SQL**

The file must contain guarded statements equivalent to:

```sql
DELETE FROM content_credits
WHERE content_id = (SELECT id FROM contents WHERE slug = 'community-chat-2025')
  AND label = 'Artists' AND TRIM(COALESCE(value, '')) = '' AND TRIM(COALESCE(url, '')) = '';

UPDATE contents SET location = '', updated_at = datetime('now')
WHERE slug IN ('peer-up-2023', 'peer-up-2024')
  AND location LIKE 'http%';

INSERT INTO content_credits (id, content_id, label, value, url, sort_order)
SELECT 'normalized-homepage-' || c.id, c.id, 'Homepage', 'peer-up.com',
       'https://www.peer-up.com/', COALESCE(MAX(cc.sort_order), -1) + 1
FROM contents c LEFT JOIN content_credits cc ON cc.content_id = c.id
WHERE c.slug IN ('peer-up-2023', 'peer-up-2024')
  AND NOT EXISTS (
    SELECT 1 FROM content_credits existing
    WHERE existing.content_id = c.id AND existing.label = 'Homepage'
  )
GROUP BY c.id;
```

Also update the three matching publication JSON snapshots: remove the empty `Artists` element for `community-chat-2025`, set the two Peer-up locations to `''`, and append the Homepage credit only when not already present. Wrap all statements in `BEGIN TRANSACTION; ... COMMIT;`.

Use these exact guarded JSON updates:

```sql
UPDATE content_publications
SET payload_json = json_remove(payload_json, '$.credits[0]')
WHERE slug = 'community-chat-2025'
  AND json_extract(payload_json, '$.credits[0]') = 'Artists';

UPDATE content_publications
SET payload_json = json_set(payload_json, '$.location', '')
WHERE slug IN ('peer-up-2023', 'peer-up-2024')
  AND json_extract(payload_json, '$.location') LIKE 'http%';

UPDATE content_publications
SET payload_json = json_insert(
  payload_json,
  '$.credits[#]',
  'Homepage peer-up.com https://www.peer-up.com/'
)
WHERE slug IN ('peer-up-2023', 'peer-up-2024')
  AND NOT EXISTS (
    SELECT 1 FROM json_each(payload_json, '$.credits')
    WHERE value LIKE 'Homepage %'
  );
```

- [ ] **Step 2: Verify SQL syntax locally without mutating production**

Run: `npx wrangler d1 migrations apply space-ddf-rentals --local && npx wrangler d1 execute space-ddf-rentals --local --file scripts/sql/normalize-project-show-metadata.sql`

Expected: command exits `0`; a second identical run also exits `0`, demonstrating idempotency.

- [ ] **Step 3: Export the production backup**

Run:

```bash
mkdir -p .wrangler/backups
npx wrangler d1 export space-ddf-rentals --remote --output .wrangler/backups/content-before-project-show-normalization-2026-08-02.sql
```

Expected: backup file exists and is non-empty. Do not print its contents or commit it.

- [ ] **Step 4: Inspect exact production targets before mutation**

Run:

```bash
npx wrangler d1 execute space-ddf-rentals --remote --command "SELECT c.slug,c.location,cc.label,cc.value,cc.url FROM contents c LEFT JOIN content_credits cc ON cc.content_id=c.id WHERE c.slug IN ('community-chat-2025','peer-up-2023','peer-up-2024') ORDER BY c.slug,cc.sort_order"
```

Expected: only the three approved slugs appear; one empty Artists row and two URL locations are present before cleanup.

- [ ] **Step 5: Apply once and verify managed/public consistency**

Run: `npx wrangler d1 execute space-ddf-rentals --remote --file scripts/sql/normalize-project-show-metadata.sql`

Then query the same three slugs plus `json_extract(payload_json, '$.location')` and `json_each(payload_json, '$.credits')`.

Expected: no empty credit rows, no URL locations, each Peer-up record has one Homepage credit, and publication JSON matches the relational rows.

- [ ] **Step 6: Commit the reviewed SQL**

```bash
git add scripts/sql/normalize-project-show-metadata.sql
git commit -m "fix: 관리 콘텐츠 레거시 기본 정보 정리"
```

### Task 5: Full QA, browser verification, and production deployment

**Files:**
- QA artifacts only, do not commit: `output/playwright/project-show-metadata-*.png`

**Interfaces:**
- Verifies the complete static fallback, D1 managed payload, `/admin`, public Show/Project detail, Recent Updated, ordering, mobile layout, and production deployment.

- [ ] **Step 1: Run all automated gates**

Run: `npm run lint && npm test && npm run build:pages`

Expected: lint exits `0`, every Node/scraper test passes, and Vite/Pages build exits `0`.

- [ ] **Step 2: Run static and production-data audits**

Run: `node scripts/audit-content-metadata.mjs`

Fetch `https://spaceddf.xyz/api/contents?type=show` and `?type=project`, combine both `data` arrays, and pass them to the same `auditContentMetadata` function.

Expected: static count is `24`; production count is `25` including `멸망 언박싱`; both audits return zero issues.

- [ ] **Step 3: Browser-check `/admin` at desktop and mobile widths**

At `1440x1000` and `390x844`, verify:

- Show/Project selector, dates, location, all seven fixed groups, custom information, text, and image inputs exist.
- Korean composition produces completed syllables and does not create duplicated/partial credit rows.
- A disposable local draft can be saved and reopened with identical structured metadata.
- There is no horizontal overflow or console error.

- [ ] **Step 4: Browser-check representative public content before deployment**

Verify `/shows/myulmang-unboxing`, `/projects/open-portfolio-2025`, `/projects/community-chat-2025`, and `/projects/peer-up-2024`:

- populated groups follow canonical order and missing groups are hidden;
- custom rows follow standard rows;
- Instagram links use SVG icons without raw URL text;
- community-chat has no empty Artists line;
- Peer-up has no URL in Location and retains Homepage;
- Show list remains newest-first and Recent Updated remains poster-only.

- [ ] **Step 5: Deploy the verified Pages build**

Run:

```bash
npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf --commit-dirty=true
```

Expected: Wrangler returns an immutable `*.space-ddf-home.pages.dev` URL and completes successfully.

- [ ] **Step 6: Run custom-domain smoke tests and final browser checks**

Run: `SMOKE_BASE_URL=https://spaceddf.xyz npm run smoke:pages`

Expected: all route, asset, admin-auth, and API smoke checks pass. Revisit the four representative routes on the custom domain and require no console errors, no horizontal overflow, correct metadata order, and the same D1/static audit result.

- [ ] **Step 7: Record final evidence**

Report the deployment URL, commit hashes, automated test counts, audited content counts, D1 backup path, and the exact routes checked. Do not claim completion unless every gate above has fresh passing output.
