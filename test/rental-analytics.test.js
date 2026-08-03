const assert = require('node:assert/strict')
const test = require('node:test')

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
    error_code: 'date_conflict', contact: 'artist@example.com', projectIntro: 'private proposal',
  }, { windowRef: { gtag: (...args) => calls.push(args) } })
  assert.deepEqual(calls[0][2], { error_code: 'date_conflict' })
})

test('missing or throwing gtag never breaks rental interactions', async () => {
  const { trackRentalEvent } = await import('../src/services/rental-analytics.js')
  assert.equal(trackRentalEvent('rental_view', {}, { windowRef: {} }), false)
  assert.equal(trackRentalEvent('rental_view', {}, { windowRef: { gtag() { throw new Error('blocked') } } }), false)
})
