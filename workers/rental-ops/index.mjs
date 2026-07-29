import { deliverRentalRequestNotification } from '../../src/server/rental-notification.mjs'

const BATCH_SIZE = 20

export async function processRentalOperations(env, now = new Date()) {
  const nowIso = now.toISOString()
  const result = await env.DB.prepare(`
    SELECT
      o.request_id, o.attempt_count,
      r.applicant_name, r.contact, r.requested_start_date, r.requested_end_date,
      r.support_program, r.project_description
    FROM rental_notification_outbox o
    JOIN rental_requests r ON r.id = o.request_id
    WHERE o.status = 'pending' AND o.next_attempt_at <= ? AND r.deleted_at IS NULL
    ORDER BY o.next_attempt_at ASC
    LIMIT ?
  `).bind(nowIso, BATCH_SIZE).all()

  for (const row of result.results || []) {
    await deliverRentalRequestNotification({
      db: env.DB,
      email: env.RENTAL_NOTIFICATION_EMAIL,
      request: {
        id: row.request_id,
        applicantName: row.applicant_name,
        contact: row.contact,
        requestedStartDate: row.requested_start_date,
        requestedEndDate: row.requested_end_date,
        supportProgram: row.support_program,
        projectDescription: row.project_description,
      },
      adminUrl: 'https://spaceddf.xyz/manage/rentals',
      now: () => nowIso,
      attemptCount: Number(row.attempt_count || 0) + 1,
    })
  }

  const purgeResult = await env.DB.batch([
    env.DB.prepare(`
      DELETE FROM rental_notification_outbox
      WHERE request_id IN (SELECT id FROM rental_requests WHERE purge_after <= ?)
    `).bind(nowIso),
    env.DB.prepare(`
      DELETE FROM rental_status_history
      WHERE request_id IN (SELECT id FROM rental_requests WHERE purge_after <= ?)
    `).bind(nowIso),
    env.DB.prepare('DELETE FROM rental_requests WHERE purge_after <= ?').bind(nowIso),
  ])

  return {
    notificationsProcessed: (result.results || []).length,
    requestsPurged: purgeResult[2]?.meta?.changes || 0,
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processRentalOperations(env))
  },
}
