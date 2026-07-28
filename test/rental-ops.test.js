const assert = require('node:assert/strict')
const test = require('node:test')

test('rental operations retries due mail and purges expired trash', async () => {
  const { processRentalOperations } = await import('../workers/rental-ops/index.mjs')
  const calls = []
  const row = {
    request_id: 'rental-1', attempt_count: 1, applicant_name: '팀', contact: 'artist@example.com',
    requested_start_date: '2026-09-01', requested_end_date: '2026-09-02', support_program: 'none',
    project_description: '프로젝트',
  }
  const db = createDb(row, calls)
  const result = await processRentalOperations({
    DB: db,
    RENTAL_NOTIFICATION_EMAIL: { send: async () => ({ messageId: 'retry-ok' }) },
  }, new Date('2026-07-11T00:00:00.000Z'))

  assert.equal(result.notificationsProcessed, 1)
  assert.equal(result.requestsPurged, 1)
  assert.ok(calls.some(call => call.sql.includes('notification_attempt_count') && call.values.includes(2)))
  assert.ok(calls.some(call => call.sql.includes('DELETE FROM rental_requests')))
})

function createDb(row, calls) {
  return {
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { this.values = values; return this },
        async all() { calls.push({ sql, values: this.values }); return { results: [row] } },
        async run() { calls.push({ sql, values: this.values }); return { success: true, meta: { changes: 1 } } },
      }
    },
    async batch(statements) {
      statements.forEach(statement => calls.push({ sql: statement.sql, values: statement.values }))
      return statements.map(() => ({ success: true, meta: { changes: 1 } }))
    },
  }
}
