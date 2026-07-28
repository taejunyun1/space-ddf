export async function fetchPublishedContents(type) {
  const payload = await requestJson(`/api/contents?type=${encodeURIComponent(type)}`)
  return Array.isArray(payload.data) ? payload.data : []
}

export async function fetchPublishedContent(type, slug) {
  return (await requestJson(`/api/contents/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`)).data
}

export async function fetchAdminContents(filters = {}) {
  const url = new URL('/api/manage/contents', window.location.origin)
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value != null && value !== false) url.searchParams.set(key, String(value))
  }
  return (await requestJson(`${url.pathname}${url.search}`)).data || []
}

export async function fetchAdminContent(id) {
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}`)).data
}

export async function createAdminContent(input) {
  return (await requestJson('/api/manage/contents', {
    method: 'POST',
    body: JSON.stringify(input),
  })).data
}

export async function updateAdminContent(id, input) {
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })).data
}

export async function publishAdminContent(id) {
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: '{}',
  })).data
}

export async function unpublishAdminContent(id) {
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
    body: '{}',
  })).data
}

export async function trashAdminContent(id) {
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })).data
}

export async function restoreAdminContent(id) {
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: '{}',
  })).data
}

export async function uploadAdminContentAsset(id, { file, role, altText = '', caption = '', sortOrder = 0 }) {
  const body = new FormData()
  body.set('file', file)
  body.set('role', role)
  body.set('altText', altText)
  body.set('caption', caption)
  body.set('sortOrder', String(sortOrder))
  return (await requestJson(`/api/manage/contents/${encodeURIComponent(id)}/assets`, {
    method: 'POST',
    body,
  })).data
}

async function requestJson(path, options = {}) {
  const headers = { accept: 'application/json', ...(options.headers || {}) }
  if (!(options.body instanceof FormData)) headers['content-type'] = 'application/json'
  const response = await fetch(path, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error?.message || '콘텐츠 요청을 처리하지 못했습니다.')
    error.code = payload.error?.code || 'request_failed'
    error.status = response.status
    error.fields = payload.error?.fields || {}
    throw error
  }
  return payload
}

