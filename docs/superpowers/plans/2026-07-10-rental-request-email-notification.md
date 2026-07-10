# Rental Request Email Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a transactional administrator email for each successfully stored rental request while preserving the request when email delivery fails.

**Architecture:** Extend `rental_requests` with notification metadata, isolate email rendering and delivery in `src/server/rental-notification.mjs`, and schedule delivery from the existing public request handler with `context.waitUntil`. The manager API returns the persisted notification state, and the existing manager detail view displays that state without exposing provider errors or applicant data in logs.

**Tech Stack:** Vue 3, Cloudflare Pages Functions, Cloudflare Email Service Workers binding, Cloudflare D1, Node.js built-in test runner, Wrangler.

## Global Constraints

- Sender: `Space DDF <rental@spaceddf.xyz>`.
- Recipient: `space.ddf@gmail.com`.
- Reply-to: `space.ddf@gmail.com`.
- A notification failure must never reject, delete, or change the status of a successfully stored rental request.
- Send both HTML and plain-text message bodies.
- Escape every applicant-controlled value inserted into HTML.
- Store only sanitized notification error codes, never provider response bodies or applicant content.
- Existing requests must be represented as `not_applicable`; new requests start as `pending`.
- This iteration does not add applicant confirmation email, status-change email, automatic retries, or a manual retry button.
- Use tests first for every production behavior change.
- Stage and commit only files owned by each task because the worktree contains unrelated user changes.

## File Structure

- Create `migrations/0002_rental_notification_status.sql`: adds notification metadata columns to `rental_requests`.
- Create `src/server/rental-notification.mjs`: renders escaped email content, calls the Cloudflare binding, and persists `sent` or `failed`.
- Create `test/rental-notification.test.js`: tests message fields, escaping, success, missing binding, and provider failure.
- Modify `src/server/rental-api.mjs`: initializes `pending`, returns notification metadata to manager consumers, and schedules delivery after D1 storage.
- Modify `test/rental-api.test.js`: verifies migration, pending state, scheduling, and manager normalization.
- Modify `src/views/AdminRentalsView.vue`: normalizes and displays the delivery state.
- Modify `test/rental-frontend-api.test.js`: verifies manager labels and state rendering.
- Modify `wrangler.jsonc` and `wrangler.pages.example.jsonc`: add the restricted `RENTAL_NOTIFICATION_EMAIL` binding.
- Modify `docs/cloudflare-rental-deployment.md`: document domain onboarding, sender identity, and production verification.
- Modify `test/cloudflare-pages-deploy.test.js`: verify binding and deployment documentation.

---

### Task 1: Persist Notification State

**Files:**
- Create: `migrations/0002_rental_notification_status.sql`
- Modify: `src/server/rental-api.mjs`
- Test: `test/rental-api.test.js`

**Interfaces:**
- Consumes: the existing `rental_requests` table and `normalizeRequest(row)` response mapper.
- Produces: `notificationStatus`, `notificationAttemptedAt`, and `notificationErrorCode` on normalized administrator request objects.

- [ ] **Step 1: Write the failing migration and API tests**

Add tests that require the new migration and normalized fields:

```js
test('notification migration adds delivery metadata without changing request status', () => {
  const migration = readProjectFile('migrations/0002_rental_notification_status.sql')

  assert.match(migration, /ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'not_applicable'/)
  assert.match(migration, /ADD COLUMN notification_attempted_at TEXT/)
  assert.match(migration, /ADD COLUMN notification_error_code TEXT/)
  assert.doesNotMatch(migration, /UPDATE rental_requests SET status/)
})

test('new requests start with pending email notification state', async () => {
  const { handleCreateRentalRequest } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [{
      id: 'available-2026-09',
      start_date: '2026-09-13',
      end_date: '2026-09-30',
      status: 'available',
      label: '9월 대관 가능 일정',
    }],
  })

  const response = await handleCreateRentalRequest({
    request: createJsonRequest('https://spaceddf.xyz/api/rentals/requests', {
      applicantName: '테스트 팀',
      contact: 'artist@example.com',
      requestedStartDate: '2026-09-13',
      requestedEndDate: '2026-09-20',
      supportProgram: 'none',
      projectDescription: '알림 상태 테스트',
    }),
    env: { DB: db },
  })
  const payload = await response.json()

  assert.equal(response.status, 201)
  assert.equal(payload.data.notificationStatus, 'pending')
  assert.ok(db.calls.some(call => (
    call.type === 'run'
      && call.sql.includes('INSERT INTO rental_requests')
      && call.values.includes('pending')
  )))
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/rental-api.test.js
```

Expected: FAIL because `0002_rental_notification_status.sql` is missing and the response has no `notificationStatus`.

- [ ] **Step 3: Add the D1 migration**

Create `migrations/0002_rental_notification_status.sql`:

```sql
ALTER TABLE rental_requests
  ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (notification_status IN ('not_applicable', 'pending', 'sent', 'failed'));

ALTER TABLE rental_requests
  ADD COLUMN notification_attempted_at TEXT;

ALTER TABLE rental_requests
  ADD COLUMN notification_error_code TEXT;
```

- [ ] **Step 4: Initialize and normalize notification state**

Update the request insert in `handleCreateRentalRequest` to include:

```js
notification_status,
notification_attempted_at,
notification_error_code,
```

and values:

```js
'pending',
null,
null,
```

Return the initial public response with:

```js
notificationStatus: 'pending',
```

Add these columns to administrator request `SELECT` statements:

```sql
notification_status,
notification_attempted_at,
notification_error_code,
```

Extend `normalizeRequest(row)` with:

```js
notificationStatus: row.notification_status || 'not_applicable',
notificationAttemptedAt: row.notification_attempted_at || null,
notificationErrorCode: row.notification_error_code || null,
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node --test test/rental-api.test.js
```

Expected: all rental API tests PASS.

- [ ] **Step 6: Commit the persistence change**

```bash
git add migrations/0002_rental_notification_status.sql src/server/rental-api.mjs test/rental-api.test.js
git commit -m "2026-07-10 대관 메일 발송 상태 저장"
```

---

### Task 2: Render and Send the Administrator Email

**Files:**
- Create: `src/server/rental-notification.mjs`
- Create: `test/rental-notification.test.js`
- Modify: `src/server/rental-api.mjs`
- Modify: `test/rental-api.test.js`

**Interfaces:**
- Consumes: `env.RENTAL_NOTIFICATION_EMAIL`, a normalized request object, a D1 database binding, and the absolute `/manage/rentals` URL.
- Produces: `buildRentalRequestEmail(request, adminUrl)` and `deliverRentalRequestNotification({ db, email, request, adminUrl, now })`.

- [ ] **Step 1: Write failing email-rendering tests**

Create `test/rental-notification.test.js` with:

```js
test('builds escaped HTML and plain text for the Space DDF manager', async () => {
  const { buildRentalRequestEmail } = await import('../src/server/rental-notification.mjs')
  const message = buildRentalRequestEmail({
    applicantName: '<script>alert(1)</script>',
    contact: 'artist@example.com',
    requestedStartDate: '2026-09-13',
    requestedEndDate: '2026-09-20',
    supportProgram: 'k-art',
    projectDescription: '사진 & 사운드',
  }, 'https://spaceddf.xyz/manage/rentals')

  assert.deepEqual(message.from, { email: 'rental@spaceddf.xyz', name: 'Space DDF' })
  assert.equal(message.to, 'space.ddf@gmail.com')
  assert.equal(message.replyTo, 'space.ddf@gmail.com')
  assert.match(message.subject, /새 대관 신청/)
  assert.doesNotMatch(message.html, /<script>/)
  assert.match(message.html, /&lt;script&gt;/)
  assert.match(message.html, /사진 &amp; 사운드/)
  assert.match(message.text, /https:\/\/spaceddf\.xyz\/manage\/rentals/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test test/rental-notification.test.js
```

Expected: FAIL because `src/server/rental-notification.mjs` does not exist.

- [ ] **Step 3: Implement the pure message builder**

Create `src/server/rental-notification.mjs` with these constants and exports:

```js
const FROM = { email: 'rental@spaceddf.xyz', name: 'Space DDF' }
const RECIPIENT = 'space.ddf@gmail.com'
const SUPPORT_LABELS = {
  none: '해당 없음',
  'k-art': 'K-ART',
  'gwangju-foundation': '광주문화재단',
  other: '기타 지원사업',
}

export function buildRentalRequestEmail(request, adminUrl) {
  const subjectName = request.applicantName.replace(/[\r\n]+/g, ' ').trim()
  const rows = [
    ['신청자/팀명', request.applicantName],
    ['연락처', request.contact],
    ['희망 일정', `${request.requestedStartDate} - ${request.requestedEndDate}`],
    ['지원사업', SUPPORT_LABELS[request.supportProgram] || '기타 지원사업'],
    ['프로젝트 소개', request.projectDescription],
  ]

  return {
    from: FROM,
    to: RECIPIENT,
    replyTo: RECIPIENT,
    subject: `[Space DDF] 새 대관 신청 - ${subjectName}`,
    html: renderHtml(rows, adminUrl),
    text: renderText(rows, adminUrl),
  }
}
```

Implement private `escapeHtml`, `renderHtml`, and `renderText` helpers. `escapeHtml` must replace `&`, `<`, `>`, `"`, and `'`.

```js
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHtml(rows, adminUrl) {
  const tableRows = rows.map(([label, value]) => (
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
  )).join('')

  return `<h1>새 대관 신청</h1><table>${tableRows}</table>`
    + `<p><a href="${escapeHtml(adminUrl)}">관리자에서 신청 확인</a></p>`
}

function renderText(rows, adminUrl) {
  return [
    '새 대관 신청',
    '',
    ...rows.map(([label, value]) => `${label}: ${String(value ?? '')}`),
    '',
    `관리자 확인: ${adminUrl}`,
  ].join('\n')
}
```

- [ ] **Step 4: Write failing delivery-state tests**

Add tests for a successful binding, no binding, and a throwing binding:

```js
test('records sent after the binding accepts the message', async () => {
  const db = createNotificationDb()
  const sent = []
  const request = validNotificationRequest()
  const result = await deliverRentalRequestNotification({
    db,
    email: { send: async message => sent.push(message) },
    request,
    adminUrl: 'https://spaceddf.xyz/manage/rentals',
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.equal(result.status, 'sent')
  assert.equal(sent.length, 1)
  assert.deepEqual(db.lastUpdateValues(), [
    'sent', '2026-07-10T00:00:00.000Z', null, request.id,
  ])
})

test('records a sanitized failure when the binding is unavailable', async () => {
  const db = createNotificationDb()
  const result = await deliverRentalRequestNotification({
    db,
    email: undefined,
    request: validNotificationRequest(),
    adminUrl: 'https://spaceddf.xyz/manage/rentals',
  })

  assert.deepEqual(result, {
    status: 'failed',
    errorCode: 'email_binding_unavailable',
  })
})

test('records a sanitized failure when the provider rejects delivery', async () => {
  const db = createNotificationDb()
  const result = await deliverRentalRequestNotification({
    db,
    email: { send: async () => { throw new Error('provider response with private content') } },
    request: validNotificationRequest(),
    adminUrl: 'https://spaceddf.xyz/manage/rentals',
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.errorCode, 'email_send_failed')
  assert.doesNotMatch(JSON.stringify(db.calls), /provider response/)
})

function validNotificationRequest() {
  return {
    id: 'rental_email_test',
    applicantName: '테스트 팀',
    contact: 'artist@example.com',
    requestedStartDate: '2026-09-13',
    requestedEndDate: '2026-09-20',
    supportProgram: 'none',
    projectDescription: '이메일 알림 테스트',
  }
}

function createNotificationDb() {
  const calls = []

  return {
    calls,
    prepare(sql) {
      return {
        values: [],
        bind(...values) {
          this.values = values
          return this
        },
        async run() {
          calls.push({ sql, values: this.values })
          return { success: true }
        },
      }
    },
    lastUpdateValues() {
      return calls.at(-1)?.values
    },
  }
}
```

- [ ] **Step 5: Run the delivery tests and verify RED**

Run:

```bash
node --test test/rental-notification.test.js
```

Expected: rendering test PASS and delivery tests FAIL because `deliverRentalRequestNotification` is not exported.

- [ ] **Step 6: Implement delivery and sanitized status updates**

Add:

```js
export async function deliverRentalRequestNotification({
  db,
  email,
  request,
  adminUrl,
  now = () => new Date().toISOString(),
}) {
  let status = 'sent'
  let errorCode = null

  try {
    if (!email || typeof email.send !== 'function') {
      status = 'failed'
      errorCode = 'email_binding_unavailable'
    } else {
      await email.send(buildRentalRequestEmail(request, adminUrl))
    }
  } catch {
    status = 'failed'
    errorCode = 'email_send_failed'
  }

  try {
    await db.prepare(`
      UPDATE rental_requests
      SET notification_status = ?,
          notification_attempted_at = ?,
          notification_error_code = ?
      WHERE id = ?
    `).bind(status, now(), errorCode, request.id).run()
  } catch {
    return { status, errorCode, persisted: false }
  }

  return { status, errorCode }
}
```

- [ ] **Step 7: Verify delivery tests GREEN**

Run:

```bash
node --test test/rental-notification.test.js
```

Expected: all notification tests PASS.

- [ ] **Step 8: Write the failing request-handler scheduling test**

Add a `waitUntil` collector to `test/rental-api.test.js` and assert that storage returns `201` before the collected delivery finishes:

```js
const backgroundTasks = []
const sentMessages = []
const email = { send: async message => sentMessages.push(message) }
const db = createFakeDb({
  windows: [{
    id: 'available-2026-09',
    start_date: '2026-09-13',
    end_date: '2026-09-30',
    status: 'available',
    label: '9월 대관 가능 일정',
  }],
})
const response = await handleCreateRentalRequest({
  request: createJsonRequest('https://spaceddf.xyz/api/rentals/requests', {
    applicantName: '테스트 팀',
    contact: 'artist@example.com',
    requestedStartDate: '2026-09-13',
    requestedEndDate: '2026-09-20',
    supportProgram: 'none',
    projectDescription: '백그라운드 알림 테스트',
  }),
  env: { DB: db, RENTAL_NOTIFICATION_EMAIL: email },
  waitUntil(task) { backgroundTasks.push(task) },
})

assert.equal(response.status, 201)
assert.equal(backgroundTasks.length, 1)
await Promise.all(backgroundTasks)
assert.equal(sentMessages.length, 1)
```

- [ ] **Step 9: Run the API test and verify RED**

Run:

```bash
node --test test/rental-api.test.js
```

Expected: FAIL because the request handler does not schedule notification delivery.

- [ ] **Step 10: Schedule delivery only after both D1 inserts succeed**

Import the delivery helper and, immediately after writing status history, create the delivery request:

```js
const notificationTask = deliverRentalRequestNotification({
  db,
  email: context.env.RENTAL_NOTIFICATION_EMAIL,
  request: { id, ...input },
  adminUrl: new URL('/manage/rentals', context.request.url).href,
})

if (typeof context.waitUntil === 'function') {
  context.waitUntil(notificationTask)
} else {
  await notificationTask
}
```

Do not include the notification result in the success/failure decision for the `201` response.

- [ ] **Step 11: Run server tests and commit**

Run:

```bash
node --test test/rental-notification.test.js test/rental-api.test.js
```

Expected: all selected tests PASS.

Commit:

```bash
git add src/server/rental-notification.mjs src/server/rental-api.mjs test/rental-notification.test.js test/rental-api.test.js
git commit -m "2026-07-10 대관 신청 관리자 메일 발송"
```

---

### Task 3: Display Delivery State in the Manager

**Files:**
- Modify: `src/views/AdminRentalsView.vue`
- Test: `test/rental-frontend-api.test.js`

**Interfaces:**
- Consumes: `notificationStatus`, `notificationAttemptedAt`, and `notificationErrorCode` from the manager request API.
- Produces: a visible Korean label and state class in the selected request detail.

- [ ] **Step 1: Write the failing manager-source test**

Add:

```js
test('manager rental detail labels email notification state', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /notificationStatus/)
  assert.match(source, /메일 발송 대기/)
  assert.match(source, /메일 발송됨/)
  assert.match(source, /메일 발송 실패/)
  assert.match(source, /notification-failed/)
})
```

- [ ] **Step 2: Run the frontend test and verify RED**

Run:

```bash
node --test test/rental-frontend-api.test.js
```

Expected: FAIL because the manager view does not render notification status.

- [ ] **Step 3: Normalize status and add manager labels**

Extend `normalizeAdminRequest`:

```js
notificationStatus: request.notificationStatus || 'not_applicable',
notificationAttemptedAt: request.notificationAttemptedAt || null,
notificationErrorCode: request.notificationErrorCode || null,
```

Add a computed helper:

```js
const notificationMeta = computed(() => {
  const status = selectedRequest.value?.notificationStatus || 'not_applicable'
  return {
    pending: { label: '메일 발송 대기', className: 'notification-pending' },
    sent: { label: '메일 발송됨', className: 'notification-sent' },
    failed: { label: '메일 발송 실패', className: 'notification-failed' },
    not_applicable: { label: '메일 알림 이전 신청', className: 'notification-not-applicable' },
  }[status]
})
```

Render one detail row with the label. For `failed`, add the sentence `대관 신청은 정상 저장되었습니다.` without rendering the provider error code:

```vue
<div class="admin-detail-row">
  <span>메일 알림</span>
  <div>
    <strong
      class="notification-state"
      :class="notificationMeta.className"
    >
      {{ notificationMeta.label }}
    </strong>
    <p v-if="selectedRequest.notificationStatus === 'failed'">
      대관 신청은 정상 저장되었습니다.
    </p>
  </div>
</div>
```

- [ ] **Step 4: Add restrained state styling**

Use existing manager status colors and compact text sizing:

```css
.notification-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.notification-state::before {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  content: '';
  background: currentColor;
}

.notification-pending { color: #d97706; }
.notification-sent { color: #16794a; }
.notification-failed { color: #c7392f; }
.notification-not-applicable { color: #737373; }
```

- [ ] **Step 5: Run frontend tests, lint, and commit**

Run:

```bash
node --test test/rental-frontend-api.test.js
npm run lint
```

Expected: frontend tests and lint PASS.

Commit:

```bash
git add src/views/AdminRentalsView.vue test/rental-frontend-api.test.js
git commit -m "2026-07-10 관리자 메일 발송 상태 표시"
```

---

### Task 4: Configure Cloudflare Email Sending and Deploy

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `wrangler.pages.example.jsonc`
- Modify: `docs/cloudflare-rental-deployment.md`
- Modify: `test/cloudflare-pages-deploy.test.js`

**Interfaces:**
- Consumes: the onboarded `spaceddf.xyz` Email Sending domain and verified production Pages deployment.
- Produces: `env.RENTAL_NOTIFICATION_EMAIL` restricted to `space.ddf@gmail.com`.

- [ ] **Step 1: Write the failing binding/configuration test**

Add assertions:

```js
test('Pages config binds the fixed rental notification destination', () => {
  const config = readProjectFile('wrangler.pages.example.jsonc')
  const docs = readProjectFile('docs/cloudflare-rental-deployment.md')

  assert.match(config, /RENTAL_NOTIFICATION_EMAIL/)
  assert.match(config, /destination_address[^\n]+space\.ddf@gmail\.com/)
  assert.match(docs, /rental@spaceddf\.xyz/)
  assert.match(docs, /Email Sending/)
})
```

- [ ] **Step 2: Run the configuration test and verify RED**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: FAIL because the email binding and onboarding documentation are absent.

- [ ] **Step 3: Add the restricted email binding**

Add to both Wrangler configurations:

```jsonc
"send_email": [
  {
    "name": "RENTAL_NOTIFICATION_EMAIL",
    "destination_address": "space.ddf@gmail.com"
  }
]
```

The application code remains responsible for the fixed sender `rental@spaceddf.xyz`; Cloudflare verifies that its domain is onboarded.

- [ ] **Step 4: Document the production setup**

Add a `Rental Notification Email` section that states:

1. Open Cloudflare Dashboard > Compute > Email Service > Email Sending.
2. Onboard `spaceddf.xyz` and wait for sending DNS records to become active.
3. No inbox for `rental@spaceddf.xyz` is required.
4. Deploy with the `RENTAL_NOTIFICATION_EMAIL` binding.
5. Submit a real request and confirm receipt at `space.ddf@gmail.com`.
6. Confirm Reply targets `space.ddf@gmail.com` and `/manage/rentals` shows `메일 발송됨`.

- [ ] **Step 5: Run configuration test and commit**

Run:

```bash
node --test test/cloudflare-pages-deploy.test.js
```

Expected: PASS.

Commit:

```bash
git add wrangler.jsonc wrangler.pages.example.jsonc docs/cloudflare-rental-deployment.md test/cloudflare-pages-deploy.test.js
git commit -m "2026-07-10 Cloudflare 대관 메일 설정"
```

- [ ] **Step 6: Run complete verification**

Run:

```bash
node --test test/*.test.js
npm run lint
npm run build:pages
git diff --check
```

Expected: every test passes, lint exits successfully, the Pages build completes, and `git diff --check` prints no errors.

- [ ] **Step 7: Apply the migration and deploy**

After Cloudflare authentication and Email Sending onboarding are confirmed:

```bash
npx wrangler d1 migrations apply space-ddf-rentals --remote
npx wrangler pages deploy dist --project-name space-ddf-home --commit-dirty=true --commit-message "2026-07-10 rental request email notification"
```

Expected: migration `0002_rental_notification_status.sql` is applied once and Pages returns a successful deployment URL.

- [ ] **Step 8: Verify production without creating an unwanted live request**

First verify read-only behavior:

```bash
curl -fsS https://spaceddf.xyz/api/rentals/availability
curl -I https://spaceddf.xyz/manage/rentals
```

Expected: availability returns JSON and the manager route redirects unauthenticated requests to login.

Then submit one intentionally identified production test request through the public form, confirm receipt in `space.ddf@gmail.com`, verify the manager delivery label, and delete the test request from the manager.
