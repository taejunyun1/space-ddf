const assert = require('node:assert/strict')
const test = require('node:test')

test('builds escaped HTML and plain text for the Space DDF manager', async () => {
  const {
    buildRentalRequestEmail,
  } = await import('../src/server/rental-notification.mjs')
  const message = buildRentalRequestEmail({
    applicantName: '<script>alert(1)</script>',
    contact: 'artist@example.com',
    requestedStartDate: '2026-09-13',
    requestedEndDate: '2026-09-20',
    supportProgram: 'k-art',
    projectDescription: '사진 & 사운드',
  }, 'https://spaceddf.xyz/manage/rentals')

  assert.deepEqual(message.from, {
    email: 'rental@spaceddf.xyz',
    name: 'Space DDF',
  })
  assert.equal(message.to, 'space.ddf@gmail.com')
  assert.equal(message.replyTo, 'artist@example.com')
  assert.match(message.subject, /새 대관 신청/)
  assert.doesNotMatch(message.subject, /[\r\n]/)
  assert.doesNotMatch(message.html, /<script>/)
  assert.match(message.html, /&lt;script&gt;/)
  assert.match(message.html, /사진 &amp; 사운드/)
  assert.match(message.html, /K-ART/)
  assert.match(message.text, /https:\/\/spaceddf\.xyz\/manage\/rentals/)
})

test('records sent after the binding accepts the message', async () => {
  const {
    deliverRentalRequestNotification,
  } = await import('../src/server/rental-notification.mjs')
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

  assert.deepEqual(result, { status: 'sent', errorCode: null, messageId: null })
  assert.equal(sent.length, 1)
  assert.deepEqual(db.requestUpdateValues(), [
    'sent',
    '2026-07-10T00:00:00.000Z',
    null,
    null,
    1,
    null,
    request.id,
  ])
})

test('records sent after the email service Worker accepts the message', async () => {
  const {
    deliverRentalRequestNotification,
  } = await import('../src/server/rental-notification.mjs')
  const db = createNotificationDb()
  const requests = []
  const request = validNotificationRequest()
  const result = await deliverRentalRequestNotification({
    db,
    email: {
      send: async () => {
        throw new Error('Service binding RPC send must not be used')
      },
      fetch: async (url, init) => {
        requests.push({ url, init })
        return new Response(JSON.stringify({ success: true, messageId: 'message-123' }), { status: 202 })
      },
    },
    request,
    adminUrl: 'https://spaceddf.xyz/manage/rentals',
    now: () => '2026-07-10T00:00:30.000Z',
  })

  assert.deepEqual(result, { status: 'sent', errorCode: null, messageId: 'message-123' })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://rental-email.internal/send')
  assert.equal(requests[0].init.method, 'POST')
  assert.equal(JSON.parse(requests[0].init.body).to, 'space.ddf@gmail.com')
  assert.deepEqual(db.requestUpdateValues(), [
    'sent',
    '2026-07-10T00:00:30.000Z',
    null,
    'message-123',
    1,
    null,
    request.id,
  ])
})

test('records a sanitized failure when the binding is unavailable', async () => {
  const {
    deliverRentalRequestNotification,
  } = await import('../src/server/rental-notification.mjs')
  const db = createNotificationDb()
  const result = await deliverRentalRequestNotification({
    db,
    email: undefined,
    request: validNotificationRequest(),
    adminUrl: 'https://spaceddf.xyz/manage/rentals',
    now: () => '2026-07-10T00:01:00.000Z',
  })

  assert.deepEqual(result, {
    status: 'failed',
    errorCode: 'email_binding_unavailable',
    messageId: null,
  })
  assert.ok(db.requestUpdateValues().includes('email_binding_unavailable'))
})

test('records a sanitized failure when the provider rejects delivery', async () => {
  const {
    deliverRentalRequestNotification,
  } = await import('../src/server/rental-notification.mjs')
  const db = createNotificationDb()
  const result = await deliverRentalRequestNotification({
    db,
    email: {
      send: async () => {
        throw new Error('provider response with private content')
      },
    },
    request: validNotificationRequest(),
    adminUrl: 'https://spaceddf.xyz/manage/rentals',
    now: () => '2026-07-10T00:02:00.000Z',
  })

  assert.deepEqual(result, {
    status: 'failed',
    errorCode: 'email_send_failed',
    messageId: null,
  })
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
    requestUpdateValues() {
      return calls.find(call => call.sql.includes('UPDATE rental_requests'))?.values
    },
  }
}
