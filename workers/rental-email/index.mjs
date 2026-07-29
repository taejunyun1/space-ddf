const SENDER = 'rental@spaceddf.xyz'
const SENDER_NAME = 'Space DDF'
const RECIPIENT = 'space.ddf@gmail.com'
const MAX_CONTENT_LENGTH = 100_000

export async function handleRentalEmailRequest(request, env) {
  const url = new URL(request.url)

  if (request.method !== 'POST' || url.pathname !== '/send') {
    return json({ success: false, error: 'not_found' }, 404)
  }

  let message
  try {
    message = await request.json()
  } catch {
    return json({ success: false, error: 'invalid_json' }, 400)
  }

  if (!isValidRentalMessage(message)) {
    return json({ success: false, error: 'invalid_message' }, 400)
  }

  if (!env.RENTAL_NOTIFICATION_EMAIL_PROVIDER?.send) {
    return json({ success: false, error: 'email_binding_unavailable' }, 503)
  }

  try {
    const result = await env.RENTAL_NOTIFICATION_EMAIL_PROVIDER.send(message)
    return json({ success: true, messageId: result?.messageId || null }, 202)
  } catch (error) {
    console.error('Rental notification email failed', error?.code || 'unknown')
    return json({ success: false, error: 'email_send_failed' }, 502)
  }
}

function isValidRentalMessage(message) {
  if (!message || typeof message !== 'object') return false
  if (message.from?.email !== SENDER || message.from?.name !== SENDER_NAME) return false
  if (message.to !== RECIPIENT || !isAllowedReplyTo(message.replyTo)) return false
  if (!isStringWithin(message.subject, 1, 200)) return false
  if (!message.subject.startsWith('[Space DDF] 새 대관 신청 - ')) return false
  if (!isStringWithin(message.html, 1, MAX_CONTENT_LENGTH)) return false
  if (!isStringWithin(message.text, 1, MAX_CONTENT_LENGTH)) return false
  return true
}

function isAllowedReplyTo(value) {
  return value === RECIPIENT || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''))
}

function isStringWithin(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default {
  fetch: handleRentalEmailRequest,
}
