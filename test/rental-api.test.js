const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('availability API returns public windows and distinguishes requested and confirmed rental blocks', async () => {
  const {
    handleRentalAvailability,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [
      {
        id: 'available-2026-09',
        start_date: '2026-09-13',
        end_date: '2026-09-30',
        status: 'available',
        label: '9월 대관 가능 일정',
        public_description: '9월 공개 안내',
        admin_notes: '공개되면 안 되는 메모',
      },
    ],
    activeRequests: [
      {
        id: 'request-new',
        requested_start_date: '2026-09-13',
        requested_end_date: '2026-09-16',
        status: 'new',
        applicant_name: '신청 팀',
      },
      {
        id: 'request-001',
        requested_start_date: '2026-09-20',
        requested_end_date: '2026-09-30',
        status: 'approved',
        applicant_name: '승인 팀',
      },
    ],
  })

  const response = await handleRentalAvailability({
    request: new Request('https://space-ddf.test/api/rentals/availability'),
    env: { DB: db },
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal('id' in payload.data.windows[0], false)
  assert.equal(payload.data.windows[0].type, 'rental-available')
  assert.equal(payload.data.windows[0].publicDescription, '9월 공개 안내')
  assert.equal('adminNotes' in payload.data.windows[0], false)
  assert.equal('notes' in payload.data.windows[0], false)
  assert.equal(payload.data.unavailable[0].status, 'new')
  assert.equal(payload.data.unavailable[0].type, 'rental-requested')
  assert.equal(payload.data.unavailable[0].label, '예약신청')
  assert.equal('id' in payload.data.unavailable[0], false)
  assert.equal('title' in payload.data.unavailable[0], false)
  assert.doesNotMatch(JSON.stringify(payload), /신청 팀|승인 팀/)
  assert.equal(payload.data.unavailable[1].status, 'approved')
  assert.equal(payload.data.unavailable[1].type, 'rental')
  assert.equal(payload.data.unavailable[1].label, '예약확정')
})

test('public rental request API validates and stores a new request', async () => {
  const {
    handleCreateRentalRequest,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [
      {
        id: 'available-2026-09',
        start_date: '2026-09-13',
        end_date: '2026-09-30',
        status: 'available',
        label: '9월 대관 가능 일정',
      },
    ],
  })

  const response = await handleCreateRentalRequest({
    request: createJsonRequest('https://space-ddf.test/api/rentals/requests', {
      applicantName: '테스트 팀',
      contact: 'artist@example.com',
      requestedStartDate: '2026-09-13',
      requestedEndDate: '2026-09-30',
      supportProgram: 'gwangju-foundation',
      projectDescription: '사진과 사운드 설치 프로젝트',
      privacyConsent: true,
      privacyPolicyVersion: '2026-07-11',
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    }),
    env: { DB: db },
  })
  const payload = await response.json()
  const batchCall = db.calls.find(call => call.type === 'batch')
  const insertCall = batchCall?.statements.find(statement => (
    statement.sql.includes('INSERT INTO rental_requests')
  ))

  assert.equal(response.status, 201)
  assert.equal(payload.data.status, 'new')
  assert.equal(payload.data.statusLabel, '예약신청')
  assert.equal(payload.data.notificationStatus, 'pending')
  assert.equal(payload.data.accepted, true)
  assert.ok(payload.data.receivedAt)
  for (const privateKey of [
    'id',
    'applicantName',
    'contact',
    'projectDescription',
    'idempotencyKey',
  ]) {
    assert.equal(privateKey in payload.data, false)
  }
  assert.ok(insertCall)
  assert.ok(insertCall.values.includes('테스트 팀'))
  assert.ok(insertCall.values.includes('artist@example.com'))
  assert.ok(insertCall.values.includes('pending'))
})

test('public rental request API schedules an administrator email after storage', async () => {
  const {
    handleCreateRentalRequest,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [
      {
        id: 'available-2026-09',
        start_date: '2026-09-13',
        end_date: '2026-09-30',
        status: 'available',
        label: '9월 대관 가능 일정',
      },
    ],
  })
  const backgroundTasks = []
  const sentMessages = []

  const response = await handleCreateRentalRequest({
    request: createJsonRequest('https://spaceddf.xyz/api/rentals/requests', {
      applicantName: '메일 테스트 팀',
      contact: 'artist@example.com',
      requestedStartDate: '2026-09-13',
      requestedEndDate: '2026-09-20',
      supportProgram: 'none',
      projectDescription: '백그라운드 알림 테스트',
      privacyConsent: true,
      privacyPolicyVersion: '2026-07-11',
      idempotencyKey: '223e4567-e89b-42d3-a456-426614174000',
    }),
    env: {
      DB: db,
      RENTAL_NOTIFICATION_EMAIL: {
        send: async message => sentMessages.push(message),
      },
    },
    waitUntil(task) {
      backgroundTasks.push(task)
    },
  })

  assert.equal(response.status, 201)
  assert.equal(backgroundTasks.length, 1)

  await Promise.all(backgroundTasks)

  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0].to, 'space.ddf@gmail.com')
  assert.match(sentMessages[0].html, /https:\/\/spaceddf\.xyz\/admin/)
  assert.ok(db.calls.some(call => (
    call.type === 'batch'
      && call.statements.some(statement => (
        statement.sql.includes('UPDATE rental_requests') && statement.values.includes('sent')
      ))
  )))
})

test('public rental request API rejects conflicting active ranges', async () => {
  const {
    handleCreateRentalRequest,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [
      {
        id: 'available-2026-09',
        start_date: '2026-09-13',
        end_date: '2026-09-30',
        status: 'available',
        label: '9월 대관 가능 일정',
      },
    ],
    conflictRequest: { id: 'request-existing' },
  })

  const response = await handleCreateRentalRequest({
    request: createJsonRequest('https://space-ddf.test/api/rentals/requests', {
      applicantName: '겹치는 팀',
      contact: 'artist@example.com',
      requestedStartDate: '2026-09-20',
      requestedEndDate: '2026-09-25',
      supportProgram: 'none',
      projectDescription: '겹치는 일정',
      privacyConsent: true,
      privacyPolicyVersion: '2026-07-11',
      idempotencyKey: '323e4567-e89b-42d3-a456-426614174000',
    }),
    env: { DB: db },
  })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.error.code, 'date_conflict')
})

test('public rental request API rejects ranges blocked by admin windows', async () => {
  const {
    handleCreateRentalRequest,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [
      {
        id: 'available-2026-09',
        start_date: '2026-09-13',
        end_date: '2026-09-30',
        status: 'available',
        label: '9월 대관 가능 일정',
      },
    ],
    blockedWindowConflict: { id: 'blocked-install' },
  })

  const response = await handleCreateRentalRequest({
    request: createJsonRequest('https://space-ddf.test/api/rentals/requests', {
      applicantName: '차단 일정 팀',
      contact: 'artist@example.com',
      requestedStartDate: '2026-09-20',
      requestedEndDate: '2026-09-25',
      supportProgram: 'none',
      projectDescription: '설치 기간과 겹치는 일정',
      privacyConsent: true,
      privacyPolicyVersion: '2026-07-11',
      idempotencyKey: '423e4567-e89b-42d3-a456-426614174000',
    }),
    env: { DB: db },
  })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.error.code, 'date_blocked')
})

test('rental conflict checks never use Google Calendar events', () => {
  const source = readProjectFile('src/server/rental-api.mjs')
  const createHandler = source.slice(
    source.indexOf('export async function handleCreateRentalRequest'),
    source.indexOf('export async function handleListRentalRequests'),
  )

  assert.doesNotMatch(createHandler, /google|ical/i)
  assert.match(createHandler, /status IN \('new', 'reviewing', 'approved'\)/)
  assert.match(createHandler, /status = 'blocked'/)
})

test('admin window API lists and creates rental availability windows', async () => {
  const {
    handleCreateRentalWindow,
    handleListRentalWindows,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windows: [
      {
        id: 'window-2026-10',
        start_date: '2026-10-01',
        end_date: '2026-10-22',
        status: 'available',
        label: '10월 대관 가능 일정',
        notes: '프론트에 공개',
      },
    ],
  })

  const listResponse = await handleListRentalWindows({
    request: new Request('https://space-ddf.test/api/manage/rentals/windows'),
    env: { DB: db },
  })
  const listPayload = await listResponse.json()
  const createResponse = await handleCreateRentalWindow({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/windows', {
      startDate: '2026-11-07',
      endDate: '2026-11-20',
      status: 'available',
      label: '11월 대관 가능 일정',
      notes: '지원사업 할인 검토',
    }),
    env: { DB: createFakeDb() },
  })
  const createPayload = await createResponse.json()

  assert.equal(listResponse.status, 200)
  assert.equal(listPayload.data[0].type, 'rental-available')
  assert.equal(listPayload.data[0].label, '10월 대관 가능 일정')
  assert.equal(createResponse.status, 201)
  assert.equal(createPayload.data.status, 'available')
  assert.equal(createPayload.data.type, 'rental-available')
})

test('admin window API rejects overlapping available windows', async () => {
  const {
    handleCreateRentalWindow,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    windowConflict: { id: 'window-existing' },
  })

  const response = await handleCreateRentalWindow({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/windows', {
      startDate: '2026-10-10',
      endDate: '2026-10-18',
      status: 'available',
      label: '중복 가능 일정',
    }),
    env: { DB: db },
  })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.error.code, 'window_conflict')
})

test('admin window API allows blocked windows inside available windows but blocks active requests', async () => {
  const {
    handleCreateRentalWindow,
  } = await import('../src/server/rental-api.mjs')
  const okResponse = await handleCreateRentalWindow({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/windows', {
      startDate: '2026-10-05',
      endDate: '2026-10-07',
      status: 'blocked',
      label: '설치 예비 기간',
    }),
    env: { DB: createFakeDb({ windows: [{ id: 'available-parent' }] }) },
  })
  const conflictResponse = await handleCreateRentalWindow({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/windows', {
      startDate: '2026-10-12',
      endDate: '2026-10-14',
      status: 'blocked',
      label: '운영 차단',
    }),
    env: { DB: createFakeDb({ activeRequestConflict: { id: 'rental-active' } }) },
  })
  const conflictPayload = await conflictResponse.json()

  assert.equal(okResponse.status, 201)
  assert.equal(conflictResponse.status, 409)
  assert.equal(conflictPayload.error.code, 'active_request_conflict')
})

test('admin window API refuses to delete windows that intersect active requests', async () => {
  const {
    handleDeleteRentalWindow,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    existingWindow: {
      id: 'window-2026-10',
      start_date: '2026-10-01',
      end_date: '2026-10-22',
      status: 'available',
      label: '10월 대관 가능 일정',
    },
    activeRequestConflict: { id: 'rental-active' },
  })

  const response = await handleDeleteRentalWindow({
    request: new Request('https://space-ddf.test/api/manage/rentals/windows/window-2026-10', {
      method: 'DELETE',
    }),
    env: { DB: db },
    params: { id: 'window-2026-10' },
  })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.error.code, 'active_request_conflict')
})

test('admin status API updates status and writes history', async () => {
  const {
    handleUpdateRentalRequestStatus,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    existingRequest: {
      id: 'rental_123',
      status: 'new',
      applicant_name: '테스트 팀',
      contact: 'artist@example.com',
      requested_start_date: '2026-09-13',
      requested_end_date: '2026-09-30',
      support_program: 'none',
      project_description: '프로젝트 소개',
      admin_note: null,
      created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:00.000Z',
    },
  })

  const response = await handleUpdateRentalRequestStatus({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/requests/rental_123/status', {
      status: 'approved',
      adminNote: '승인 안내 발송',
    }),
    env: { DB: db },
    params: { id: 'rental_123' },
  })
  const payload = await response.json()
  const batchCall = db.calls.find(call => call.type === 'batch')

  assert.equal(response.status, 200)
  assert.equal(payload.data.status, 'approved')
  assert.equal(payload.data.statusLabel, '대관승인')
  assert.ok(batchCall)
  assert.match(batchCall.statements[0].sql, /UPDATE rental_requests/)
  assert.match(batchCall.statements[1].sql, /INSERT INTO rental_status_history/)
})

test('admin status API rejects reactivation when another active request now conflicts', async () => {
  const { handleUpdateRentalRequestStatus } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    batchChanges: 0,
    existingRequest: {
      id: 'rental-rejected', status: 'rejected', applicant_name: '반려 팀', contact: 'artist@example.com',
      requested_start_date: '2026-09-13', requested_end_date: '2026-09-20', support_program: 'none',
      project_description: '프로젝트', admin_note: null, created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:00.000Z', deleted_at: null,
    },
  })
  const response = await handleUpdateRentalRequestStatus({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/requests/rental-rejected/status', {
      status: 'approved', adminNote: '',
    }),
    env: { DB: db }, params: { id: 'rental-rejected' },
  })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'date_conflict')
})

test('admin status API does not append history for an unchanged status', async () => {
  const { handleUpdateRentalRequestStatus } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({ existingRequest: {
    id: 'same', status: 'reviewing', applicant_name: '팀', contact: 'a@example.com',
    requested_start_date: '2026-09-01', requested_end_date: '2026-09-02', support_program: 'none',
    project_description: '소개', admin_note: '메모', created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z', deleted_at: null,
  } })
  const response = await handleUpdateRentalRequestStatus({
    request: createJsonRequest('https://space-ddf.test/api/manage/rentals/requests/same/status', {
      status: 'reviewing', adminNote: '메모',
    }), env: { DB: db }, params: { id: 'same' },
  })
  assert.equal(response.status, 200)
  assert.equal(db.calls.some(call => call.sql?.includes('INSERT INTO rental_status_history')), false)
})

test('public rental request requires privacy consent and enforces field limits', async () => {
  const { handleCreateRentalRequest } = await import('../src/server/rental-api.mjs')
  const base = {
    applicantName: '팀', contact: 'artist@example.com', requestedStartDate: '2026-09-01',
    requestedEndDate: '2026-09-02', supportProgram: 'none', projectDescription: '소개',
    privacyPolicyVersion: '2026-07-11', idempotencyKey: '523e4567-e89b-42d3-a456-426614174000',
  }
  const consentResponse = await handleCreateRentalRequest({
    request: createJsonRequest('https://space-ddf.test/api/rentals/requests', base), env: { DB: createFakeDb() },
  })
  const lengthResponse = await handleCreateRentalRequest({
    request: createJsonRequest('https://space-ddf.test/api/rentals/requests', {
      ...base, applicantName: '가'.repeat(101), privacyConsent: true,
    }), env: { DB: createFakeDb() },
  })
  assert.equal((await consentResponse.json()).error.code, 'privacy_consent_required')
  assert.equal((await lengthResponse.json()).error.code, 'field_too_long')
})

test('public rental request rejects a filled honeypot field', async () => {
  const { handleCreateRentalRequest } = await import('../src/server/rental-api.mjs')
  const response = await handleCreateRentalRequest({
    request: createJsonRequest('https://space-ddf.test/api/rentals/requests', {
      applicantName: '봇', contact: 'bot@example.com', requestedStartDate: '2026-09-01',
      requestedEndDate: '2026-09-02', supportProgram: 'none', projectDescription: 'spam',
      privacyConsent: true, privacyPolicyVersion: '2026-07-11', website: 'https://spam.example',
      idempotencyKey: '623e4567-e89b-42d3-a456-426614174000',
    }), env: { DB: createFakeDb() },
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'spam_detected')
})

test('admin delete API moves a rental request to the 30-day trash', async () => {
  const {
    handleDeleteRentalRequest,
  } = await import('../src/server/rental-api.mjs')
  const db = createFakeDb({
    existingRequest: {
      id: 'rental_delete',
      status: 'new',
      applicant_name: '삭제 팀',
      contact: 'artist@example.com',
      requested_start_date: '2026-09-13',
      requested_end_date: '2026-09-30',
      support_program: 'none',
      project_description: '삭제 테스트',
      admin_note: null,
      created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:00.000Z',
    },
  })

  const response = await handleDeleteRentalRequest({
    request: new Request('https://space-ddf.test/api/manage/rentals/requests/rental_delete', {
      method: 'DELETE',
    }),
    env: { DB: db },
    params: { id: 'rental_delete' },
  })
  const payload = await response.json()
  const updateCall = db.calls.find(call => call.type === 'run' && call.sql.includes('SET deleted_at'))

  assert.equal(response.status, 200)
  assert.equal(payload.data.id, 'rental_delete')
  assert.equal(payload.data.deleted, true)
  assert.ok(updateCall)
  assert.match(payload.data.purgeAfter, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(db.calls.some(call => call.sql?.includes('DELETE FROM rental_requests')), false)
})

test('Pages Functions route files delegate to shared rental handlers', () => {
  assert.match(readProjectFile('functions/api/rentals/availability.js'), /handleRentalAvailability/)
  assert.match(readProjectFile('functions/api/rentals/requests.js'), /handleCreateRentalRequest/)
  assert.deepEqual(
    fs.existsSync(path.join(root, 'functions/api/admin'))
      ? fs.readdirSync(path.join(root, 'functions/api/admin'), { recursive: true }).filter(name => name.endsWith('.js'))
      : [],
    [],
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/requests/index.js'),
    /handleListRentalRequests/
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/requests/[id]/status.js'),
    /handleUpdateRentalRequestStatus/
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/requests/[id].js'),
    /handleManageDeleteRentalRequest/
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/windows/index.js'),
    /handleListRentalWindows/
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/windows/index.js'),
    /handleCreateRentalWindow/
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/windows/[id].js'),
    /handleUpdateRentalWindow/
  )
  assert.match(
    readProjectFile('functions/api/manage/rentals/windows/[id].js'),
    /handleDeleteRentalWindow/
  )
})

test('D1 migration defines rental tables without hardcoded availability windows', () => {
  const migration = readProjectFile('migrations/0001_rental_reservations.sql')

  assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? rental_windows/)
  assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? rental_requests/)
  assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? rental_status_history/)
  assert.doesNotMatch(migration, /INSERT OR IGNORE INTO rental_windows/)
  assert.doesNotMatch(migration, /available-2026-/)
})

test('notification migration adds delivery metadata without changing request status', () => {
  const migration = readProjectFile('migrations/0002_rental_notification_status.sql')

  assert.match(migration, /ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'not_applicable'/)
  assert.match(migration, /ADD COLUMN notification_attempted_at TEXT/)
  assert.match(migration, /ADD COLUMN notification_error_code TEXT/)
  assert.doesNotMatch(migration, /UPDATE rental_requests SET status/)
})

test('hardening migration separates private notes and adds privacy, trash, idempotency, and outbox fields', () => {
  const migration = readProjectFile('migrations/0003_rental_hardening.sql')

  assert.match(migration, /ADD COLUMN public_description TEXT/)
  assert.match(migration, /ADD COLUMN admin_notes TEXT/)
  assert.match(migration, /SET admin_notes = notes/)
  assert.match(migration, /idempotency_key/)
  assert.match(migration, /privacy_consent_at/)
  assert.match(migration, /deleted_at/)
  assert.match(migration, /purge_after/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS rental_notification_outbox/)
})

function createJsonRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createFakeDb({
  windows = [],
  activeRequests = [],
  conflictRequest = null,
  existingRequest = null,
  existingWindow = null,
  windowConflict = null,
  blockedWindowConflict = null,
  activeRequestConflict = null,
  batchChanges = 1,
} = {}) {
  const calls = []

  return {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values
          return this
        },
        async all() {
          calls.push({ type: 'all', sql, values: this.values })

          if (sql.includes('FROM rental_windows')) return { results: windows }
          if (sql.includes('FROM rental_requests')) return { results: activeRequests }

          return { results: [] }
        },
        async first() {
          calls.push({ type: 'first', sql, values: this.values })

          if (sql.includes('FROM rental_windows') && sql.includes('WHERE id = ?')) return existingWindow
          if (sql.includes('FROM rental_windows') && this.values[0] === 'blocked') return blockedWindowConflict
          if (sql.includes('FROM rental_windows') && this.values[0] === 'available') {
            return windowConflict || windows[0] || null
          }
          if (sql.includes('FROM rental_requests') && sql.includes('status IN')) {
            return activeRequestConflict || conflictRequest
          }
          if (sql.includes('FROM rental_requests') && sql.includes('WHERE id = ?')) return existingRequest

          return null
        },
        async run() {
          calls.push({ type: 'run', sql, values: this.values })

          return { success: true }
        },
      }

      return statement
    },
    async batch(statements) {
      calls.push({
        type: 'batch',
        statements: statements.map(statement => ({
          sql: statement.sql,
          values: statement.values,
        })),
      })

      return statements.map(() => ({ success: true, meta: { changes: batchChanges } }))
    },
  }
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
