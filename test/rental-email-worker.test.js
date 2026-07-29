const assert = require('node:assert/strict')
const test = require('node:test')

test('accepts a valid internal rental notification and sends it', async () => {
  const { handleRentalEmailRequest } = await import('../workers/rental-email/index.mjs')
  const sent = []
  const response = await handleRentalEmailRequest(
    new Request('https://rental-email.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validMessage()),
    }),
    { RENTAL_NOTIFICATION_EMAIL_PROVIDER: { send: async message => sent.push(message) } },
  )

  assert.equal(response.status, 202)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].from.email, 'rental@spaceddf.xyz')
  assert.equal(sent[0].to, 'space.ddf@gmail.com')
})

test('rejects unsupported recipients without sending', async () => {
  const { handleRentalEmailRequest } = await import('../workers/rental-email/index.mjs')
  const sent = []
  const message = validMessage()
  message.to = 'other@example.com'
  const response = await handleRentalEmailRequest(
    new Request('https://rental-email.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    }),
    { RENTAL_NOTIFICATION_EMAIL_PROVIDER: { send: async email => sent.push(email) } },
  )

  assert.equal(response.status, 400)
  assert.equal(sent.length, 0)
})

test('accepts an applicant email as reply-to while keeping the fixed recipient', async () => {
  const { handleRentalEmailRequest } = await import('../workers/rental-email/index.mjs')
  const sent = []
  const message = validMessage()
  message.replyTo = 'artist@example.com'
  const response = await handleRentalEmailRequest(
    new Request('https://rental-email.internal/send', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(message),
    }),
    { RENTAL_NOTIFICATION_EMAIL_PROVIDER: { send: async email => sent.push(email) } },
  )
  assert.equal(response.status, 202)
  assert.equal(sent[0].replyTo, 'artist@example.com')
})

function validMessage() {
  return {
    from: { email: 'rental@spaceddf.xyz', name: 'Space DDF' },
    to: 'space.ddf@gmail.com',
    replyTo: 'space.ddf@gmail.com',
    subject: '[Space DDF] 새 대관 신청 - 테스트 팀',
    html: '<h1>새 대관 신청</h1>',
    text: '새 대관 신청',
  }
}
