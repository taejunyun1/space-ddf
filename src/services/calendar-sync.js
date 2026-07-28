export async function fetchGoogleCalendarEvents() {
  const sync = await fetchGoogleCalendarSync()
  return sync.events
}

export async function fetchGoogleCalendarSync() {
  if (isStaticPreviewWithoutFunctions()) {
    return { events: [], meta: { configured: false, success: true } }
  }

  const response = await fetch('/api/calendar/google', {
    headers: { accept: 'application/json' },
  })
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    throw new Error('Google Calendar 응답을 확인할 수 없습니다.')
  }

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Google Calendar 일정을 불러오지 못했습니다.')
  }

  return {
    events: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta || { configured: false, success: false },
  }
}

function isStaticPreviewWithoutFunctions() {
  if (typeof window === 'undefined') return false

  const { hostname, port } = window.location

  return ['127.0.0.1', 'localhost'].includes(hostname) && (port === '4173' || port === '5173')
}
