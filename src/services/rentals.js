export async function fetchRentalAvailability() {
  const payload = await requestJson('/api/rentals/availability')

  return payload.data || { windows: [], unavailable: [] }
}

export async function submitRentalRequest(input) {
  const payload = await requestJson('/api/rentals/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return payload.data
}

export async function fetchAdminRentalRequests({
  status = 'all',
  query = '',
  year = '',
  includeDeleted = false,
  cursor = '',
  limit = 50,
} = {}) {
  const url = new URL('/api/manage/rentals/requests', window.location.origin)

  if (status && status !== 'all') url.searchParams.set('status', status)
  if (query) url.searchParams.set('q', query)
  if (year) url.searchParams.set('year', year)
  if (includeDeleted) url.searchParams.set('includeDeleted', 'true')
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  const payload = await requestJson(`${url.pathname}${url.search}`)

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta || { nextCursor: null, limit },
  }
}

export async function updateAdminRentalStatus(id, { status, adminNote }) {
  const payload = await requestJson(`/api/manage/rentals/requests/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, adminNote }),
  })

  return payload.data
}

export async function deleteAdminRentalRequest(id) {
  const payload = await requestJson(`/api/manage/rentals/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  return payload.data
}

export async function restoreAdminRentalRequest(id) {
  const payload = await requestJson(`/api/manage/rentals/requests/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: '{}',
  })

  return payload.data
}

export async function fetchAdminRentalHistory(id) {
  const payload = await requestJson(`/api/manage/rentals/requests/${encodeURIComponent(id)}/history`)
  return Array.isArray(payload.data) ? payload.data : []
}

export async function retryAdminRentalNotification(id) {
  const payload = await requestJson(`/api/manage/rentals/requests/${encodeURIComponent(id)}/notification`, {
    method: 'POST',
    body: '{}',
  })
  return payload.data
}

export async function fetchAdminRentalWindows() {
  const payload = await requestJson('/api/manage/rentals/windows')

  return Array.isArray(payload.data) ? payload.data : []
}

export async function createAdminRentalWindow(input) {
  const payload = await requestJson('/api/manage/rentals/windows', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return payload.data
}

export async function updateAdminRentalWindow(id, input) {
  const payload = await requestJson(`/api/manage/rentals/windows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return payload.data
}

export async function deleteAdminRentalWindow(id) {
  const payload = await requestJson(`/api/manage/rentals/windows/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  return payload.data
}

async function requestJson(path, options = {}) {
  if (isStaticPreviewWithoutFunctions()) {
    throw new RentalApiError(0, 'api_unavailable', '대관 API는 Cloudflare Pages Functions 환경에서 연결됩니다.')
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    throw new RentalApiError(response.status, 'api_unavailable', '대관 API 응답을 확인할 수 없습니다.')
  }

  const payload = await response.json()

  if (!response.ok) {
    throw new RentalApiError(
      response.status,
      payload.error?.code || 'request_failed',
      payload.error?.message || '요청을 처리하지 못했습니다.'
    )
  }

  return payload
}

function isStaticPreviewWithoutFunctions() {
  if (typeof window === 'undefined') return false

  const { hostname, port } = window.location

  return ['127.0.0.1', 'localhost'].includes(hostname) && (port === '4173' || port === '5173')
}

class RentalApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'RentalApiError'
    this.status = status
    this.code = code
  }
}
