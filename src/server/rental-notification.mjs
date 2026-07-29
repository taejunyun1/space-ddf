const FROM = { email: 'rental@spaceddf.xyz', name: 'Space DDF' }
const RECIPIENT = 'space.ddf@gmail.com'
const SUPPORT_LABELS = {
  none: '해당 없음',
  'k-art': 'K-ART',
  'gwangju-foundation': '광주문화재단',
  other: '기타 지원사업',
}

export function buildRentalRequestEmail(request, adminUrl) {
  const subjectName = String(request.applicantName || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  const rows = [
    ['신청자/팀명', request.applicantName],
    ['연락처', request.contact],
    ['희망 일정', `${request.requestedStartDate} - ${request.requestedEndDate}`],
    ['지원사업', SUPPORT_LABELS[request.supportProgram] || SUPPORT_LABELS.other],
    ['프로젝트 소개', request.projectDescription],
  ]

  return {
    from: FROM,
    to: RECIPIENT,
    replyTo: isEmail(request.contact) ? request.contact : RECIPIENT,
    subject: `[Space DDF] 새 대관 신청 - ${subjectName}`,
    html: renderHtml(rows, adminUrl),
    text: renderText(rows, adminUrl),
  }
}

export async function deliverRentalRequestNotification({
  db,
  email,
  request,
  adminUrl,
  now = () => new Date().toISOString(),
  attemptCount = 1,
}) {
  let status = 'sent'
  let errorCode = null
  let messageId = null

  try {
    if (!email || (
      typeof email.send !== 'function'
      && typeof email.fetch !== 'function'
    )) {
      status = 'failed'
      errorCode = 'email_binding_unavailable'
    } else {
      messageId = await sendNotificationEmail(email, buildRentalRequestEmail(request, adminUrl))
    }
  } catch {
    status = 'failed'
    errorCode = 'email_send_failed'
  }

  try {
    const attemptedAt = now()
    const retryAt = status === 'failed' ? nextRetryAt(attemptedAt, attemptCount) : null
    const outboxStatus = status === 'sent' ? 'sent' : (retryAt ? 'pending' : 'failed')
    const statements = [
      db.prepare(`
        UPDATE rental_requests
        SET notification_status = ?,
            notification_attempted_at = ?,
            notification_error_code = ?,
            notification_message_id = ?,
            notification_attempt_count = ?,
            notification_next_attempt_at = ?
        WHERE id = ?
      `).bind(status, attemptedAt, errorCode, messageId, attemptCount, retryAt, request.id),
      db.prepare(`
        UPDATE rental_notification_outbox
        SET status = ?, attempt_count = ?, next_attempt_at = COALESCE(?, next_attempt_at),
            last_attempt_at = ?, last_error_code = ?, message_id = ?, updated_at = ?
        WHERE request_id = ?
      `).bind(outboxStatus, attemptCount, retryAt, attemptedAt, errorCode, messageId, attemptedAt, request.id),
    ]
    if (typeof db.batch === 'function') await db.batch(statements)
    else for (const statement of statements) await statement.run()
  } catch {
    return { status, errorCode, messageId, persisted: false }
  }

  return { status, errorCode, messageId }
}

async function sendNotificationEmail(email, message) {
  if (typeof email.fetch === 'function') {
    const response = await email.fetch('https://rental-email.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error('Email service Worker rejected the notification')
    }
    const payload = await response.json().catch(() => ({}))
    return payload.messageId || null
  }

  const result = await email.send(message)
  return result?.messageId || null
}

function nextRetryAt(attemptedAt, attemptCount) {
  const delays = [1, 5, 30]
  const delayMinutes = delays[attemptCount - 1]
  if (!delayMinutes) return null
  return new Date(new Date(attemptedAt).getTime() + delayMinutes * 60 * 1000).toISOString()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function renderHtml(rows, adminUrl) {
  const tableRows = rows.map(([label, value]) => (
    `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
  )).join('')

  return [
    '<h1>새 대관 신청</h1>',
    `<table>${tableRows}</table>`,
    `<p><a href="${escapeHtml(adminUrl)}">관리자에서 신청 확인</a></p>`,
  ].join('')
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
