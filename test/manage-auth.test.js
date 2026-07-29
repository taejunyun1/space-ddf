const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const authEnv = {
  MANAGE_AUTH_USER: 'ddf',
  MANAGE_AUTH_PASSWORD: 'secret-password',
  MANAGE_AUTH_SECRET: 'test-signing-secret',
}

test('admin page route renders the password login screen without changing the URL', async () => {
  const {
    handleManagePageRoute,
  } = await import('../src/server/manage-auth.mjs')

  const response = await handleManagePageRoute({
    request: new Request('https://space-ddf.test/admin'),
    env: authEnv,
    next() {
      throw new Error('unauthenticated manage request should not render')
    },
  })

  assert.equal(response.status, 200)
  assert.match(await response.text(), /action="\/admin"/)
})

test('manage login page accepts the configured username and password and sets an HttpOnly session cookie', async () => {
  const {
    handleManagePageRoute,
  } = await import('../src/server/manage-auth.mjs')

  const loginPage = await handleManagePageRoute({
    request: new Request('https://space-ddf.test/admin'),
    env: authEnv,
    next() {
      throw new Error('login page should be rendered by the manage auth function')
    },
  })
  const loginBody = await loginPage.text()

  assert.equal(loginPage.status, 200)
  assert.match(loginBody, /name="username"/)
  assert.match(loginBody, /name="password"/)

  const failedLogin = await handleManagePageRoute({
    request: createFormRequest('https://space-ddf.test/admin', {
      username: 'ddf',
      password: 'wrong',
      next: '/admin',
    }),
    env: authEnv,
    next() {
      throw new Error('login post should be handled by the manage auth function')
    },
  })

  assert.equal(failedLogin.status, 401)
  assert.equal(failedLogin.headers.get('set-cookie'), null)

  const successfulLogin = await handleManagePageRoute({
    request: createFormRequest('https://space-ddf.test/admin', {
      username: 'ddf',
      password: 'secret-password',
      next: '/admin',
    }),
    env: authEnv,
    next() {
      throw new Error('login post should be handled by the manage auth function')
    },
  })
  const sessionCookie = successfulLogin.headers.get('set-cookie')

  assert.equal(successfulLogin.status, 302)
  assert.equal(successfulLogin.headers.get('location'), 'https://space-ddf.test/admin')
  assert.match(sessionCookie, /space_ddf_manage_session=/)
  assert.match(sessionCookie, /HttpOnly/)
  assert.match(sessionCookie, /SameSite=Lax/)
})

test('manage page route serves the admin shell when the signed session cookie is present', async () => {
  const {
    handleManagePageRoute,
  } = await import('../src/server/manage-auth.mjs')

  const login = await handleManagePageRoute({
    request: createFormRequest('https://space-ddf.test/admin', {
      username: 'ddf',
      password: 'secret-password',
      next: '/admin',
    }),
    env: authEnv,
    next() {
      throw new Error('login post should be handled by the manage auth function')
    },
  })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const response = await handleManagePageRoute({
    request: new Request('https://space-ddf.test/admin', {
      headers: { cookie },
    }),
    env: authEnv,
    next() {
      return new Response('manage shell')
    },
  })

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'manage shell')
})

test('manage API wrapper rejects missing sessions and delegates when the signed cookie exists', async () => {
  const {
    handleManageApiRequest,
    handleManagePageRoute,
  } = await import('../src/server/manage-auth.mjs')

  const missingSessionResponse = await handleManageApiRequest({
    request: new Request('https://space-ddf.test/api/manage/rentals/requests'),
    env: authEnv,
  }, () => Response.json({ data: 'should not run' }))
  const missingSessionPayload = await missingSessionResponse.json()

  assert.equal(missingSessionResponse.status, 401)
  assert.equal(missingSessionPayload.error.code, 'manage_auth_required')

  const login = await handleManagePageRoute({
    request: createFormRequest('https://space-ddf.test/admin', {
      username: 'ddf',
      password: 'secret-password',
      next: '/admin',
    }),
    env: authEnv,
    next() {
      throw new Error('login post should be handled by the manage auth function')
    },
  })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const authorizedResponse = await handleManageApiRequest({
    request: new Request('https://space-ddf.test/api/manage/rentals/requests', {
      headers: { cookie },
    }),
    env: authEnv,
  }, () => Response.json({ data: 'delegated' }))
  const authorizedPayload = await authorizedResponse.json()

  assert.equal(authorizedResponse.status, 200)
  assert.equal(authorizedPayload.data, 'delegated')
})

test('manage API wrapper requires a same-origin Origin header for state-changing requests', async () => {
  const { handleManageApiRequest, handleManagePageRoute } = await import('../src/server/manage-auth.mjs')
  const login = await handleManagePageRoute({
    request: createFormRequest('https://space-ddf.test/admin', {
      username: 'ddf',
      password: 'secret-password',
      next: '/admin',
    }),
    env: authEnv,
    next() { throw new Error('login post should be handled') },
  })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const invoke = origin => handleManageApiRequest({
    request: new Request('https://space-ddf.test/api/manage/rentals/requests/id/status', {
      method: 'PATCH',
      headers: { cookie, ...(origin ? { origin } : {}) },
    }),
    env: authEnv,
  }, () => Response.json({ data: 'changed' }))

  const missing = await invoke('')
  const mismatched = await invoke('https://attacker.example')
  const allowed = await invoke('https://space-ddf.test')

  assert.equal(missing.status, 403)
  assert.equal((await missing.json()).error.code, 'invalid_origin')
  assert.equal(mismatched.status, 403)
  assert.equal(allowed.status, 200)
})

test('manage API route files require the signed password session before delegating to rental handlers', () => {
  const routes = JSON.parse(readProjectFile('public/_routes.json'))

  assert.deepEqual(routes.include, ['/api/*', '/admin'])
  assert.match(readProjectFile('functions/admin/[[path]].js'), /handleManagePageRoute/)
  assert.match(readProjectFile('functions/api/manage/rentals/requests/index.js'), /handleManageListRentalRequests/)
  assert.match(
    readProjectFile('functions/api/manage/rentals/requests/[id]/status.js'),
    /handleManageUpdateRentalRequestStatus/
  )
})

function createFormRequest(url, fields) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
