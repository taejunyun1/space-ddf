import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const baseUrl = process.env.QA_BASE_URL
const username = process.env.QA_AUTH_USER
const password = process.env.QA_AUTH_PASSWORD

assert.ok(baseUrl, 'QA_BASE_URL is required')
assert.ok(username, 'QA_AUTH_USER is required')
assert.ok(password, 'QA_AUTH_PASSWORD is required')

const origin = new URL(baseUrl).origin
const login = await fetch(new URL('/admin', origin), {
  method: 'POST',
  redirect: 'manual',
  body: new URLSearchParams({ username, password, next: '/admin' }),
})

assert.equal(login.status, 302, `admin login failed with ${login.status}`)
const cookie = String(login.headers.get('set-cookie') || '').split(';')[0]
assert.match(cookie, /^space_ddf_manage_session=/)

async function managerRequest(path, init = {}) {
  const method = String(init.method || 'GET').toUpperCase()
  const headers = new Headers(init.headers || {})
  headers.set('cookie', cookie)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('origin', origin)

  const response = await fetch(new URL(path, origin), { ...init, method, headers })
  const payload = await response.json()
  assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(payload)}`)
  return payload.data
}

const posterBytes = await fs.readFile(
  new URL('../src/assets/show/lost-topophilia/img1.jpg', import.meta.url),
)

for (const type of ['show', 'project']) {
  const slug = `qa-${type}-metadata-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`
  const created = await managerRequest('/api/manage/contents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, slug, title: `${type} QA` }),
  })

  try {
    const form = new FormData()
    form.set('role', 'poster')
    form.set('file', new Blob([posterBytes], { type: 'image/jpeg' }), 'poster.jpg')
    await managerRequest(`/api/manage/contents/${created.id}/assets`, {
      method: 'POST',
      body: form,
    })

    const expected = {
      type,
      slug,
      title: `${type} QA`,
      startDate: '2026-08-02',
      endDate: '2026-08-12',
      dateDisplay: '2026.08.02. - 2026.08.12.',
      location: 'Space DDF',
      body: '한글 소개',
      description: '한글 본문',
      credits: [
        { label: 'Artists', value: '테스트 작가', url: 'https://instagram.com/test' },
        { label: 'Homepage', value: '공식 사이트', url: 'https://example.com' },
      ],
    }

    await managerRequest(`/api/manage/contents/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(expected),
    })

    const reloaded = await managerRequest(`/api/manage/contents/${created.id}`)
    for (const key of [
      'type', 'slug', 'title', 'startDate', 'endDate', 'dateDisplay',
      'location', 'body', 'description',
    ]) {
      assert.equal(reloaded[key], expected[key], `${type} ${key} did not round-trip`)
    }
    assert.deepEqual(
      reloaded.credits.map(({ label, value, url }) => ({ label, value, url })),
      expected.credits,
    )

    await managerRequest(`/api/manage/contents/${created.id}/publish`, { method: 'POST' })
    const publicResponse = await fetch(new URL(`/api/contents/${type}/${slug}`, origin))
    const publicPayload = await publicResponse.json()
    assert.equal(publicResponse.ok, true, JSON.stringify(publicPayload))
    assert.equal(publicPayload.data.type, type)
    assert.match(
      publicPayload.data.credits.join('\n'),
      /Artists 테스트 작가 https:\/\/instagram\.com\/test/,
    )
    assert.match(
      publicPayload.data.credits.join('\n'),
      /Homepage 공식 사이트 https:\/\/example\.com/,
    )
  } finally {
    await managerRequest(`/api/manage/contents/${created.id}`, { method: 'DELETE' })
    const removed = await fetch(new URL(`/api/contents/${type}/${slug}`, origin))
    assert.equal(removed.status, 404, `${type} QA publication was not cleaned up`)
  }
}

process.stdout.write('admin Show/Project round-trip: ok\n')
