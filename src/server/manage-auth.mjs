const COOKIE_NAME = 'space_ddf_manage_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12
const DEFAULT_MANAGE_AUTH_USER = 'ddf'

export async function handleManagePageRoute(context) {
  const url = new URL(context.request.url)

  if (url.pathname !== '/admin' && url.pathname !== '/admin/') return context.next()
  if (context.request.method === 'POST') return handleLoginPost(context)
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const session = await verifyManageSession(context)

  if (!session) {
    return createLoginPageResponse(context.request, { nextPath: '/admin' })
  }

  return context.next()
}

export async function handleManageApiRequest(context, handler) {
  const session = await verifyManageSession(context)

  if (!session) {
    return jsonError(401, 'manage_auth_required', '관리자 로그인이 필요합니다.')
  }

  if (isStateChangingMethod(context.request.method) && !hasSameOrigin(context.request)) {
    return jsonError(403, 'invalid_origin', '허용되지 않은 출처의 요청입니다.')
  }

  return handler(context)
}

function isStateChangingMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase())
}

function hasSameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

async function handleLoginPost(context) {
  const request = context.request
  const form = await request.formData()
  const username = normalizeCredential(form.get('username'))
  const password = normalizeCredential(form.get('password'))
  const nextPath = normalizeNextPath(form.get('next')) || '/admin'
  const credentialsValid = await verifyCredentials(context.env || {}, username, password)

  if (!credentialsValid) {
    return createLoginPageResponse(request, {
      status: 401,
      message: '아이디 또는 비밀번호를 확인해주세요.',
      nextPath,
    })
  }

  const cookie = await createSessionCookie(context.env || {}, request, username)
  const nextUrl = new URL(nextPath, request.url)

  return new Response(null, {
    status: 302,
    headers: {
      location: nextUrl.toString(),
      'set-cookie': cookie,
      'cache-control': 'no-store',
    },
  })
}

async function verifyCredentials(env, username, password) {
  const configuredUsername = normalizeCredential(env.MANAGE_AUTH_USER || DEFAULT_MANAGE_AUTH_USER)
  const configuredPassword = normalizeCredential(env.MANAGE_AUTH_PASSWORD)

  if (!configuredUsername || !configuredPassword) return false

  const usernameMatches = await secureEqual(username, configuredUsername)
  const passwordMatches = await secureEqual(password, configuredPassword)

  return usernameMatches && passwordMatches
}

async function createSessionCookie(env, request, username) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = {
    sub: username,
    exp: expiresAt,
    nonce: crypto.randomUUID(),
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = await signValue(env, encodedPayload)
  const secure = new URL(request.url).protocol === 'https:' ? 'Secure' : ''

  return [
    `${COOKIE_NAME}=${encodedPayload}.${signature}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure.trim(),
  ].filter(Boolean).join('; ')
}

async function verifyManageSession(context) {
  const token = parseCookies(context.request.headers.get('cookie'))[COOKIE_NAME]
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = await signValue(context.env || {}, encodedPayload)
  const signatureMatches = await secureEqual(signature, expectedSignature)
  if (!signatureMatches) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload))

    if (!payload?.sub || !Number.isFinite(payload.exp)) return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

async function signValue(env, value) {
  const secret = normalizeCredential(env.MANAGE_AUTH_SECRET || env.MANAGE_AUTH_PASSWORD)
  if (!secret) return ''

  const key = await crypto.subtle.importKey(
    'raw',
    textBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textBytes(value))

  return bytesToBase64Url(new Uint8Array(signature))
}

async function secureEqual(left, right) {
  const leftDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', textBytes(left)))
  const rightDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', textBytes(right)))
  let difference = leftDigest.length ^ rightDigest.length

  for (let index = 0; index < Math.max(leftDigest.length, rightDigest.length); index += 1) {
    difference |= (leftDigest[index] || 0) ^ (rightDigest[index] || 0)
  }

  return difference === 0
}

function createLoginPageResponse(request, { status = 200, message = '', nextPath = '' } = {}) {
  const loginUrl = new URL(request.url)
  const resolvedNextPath = normalizeNextPath(nextPath || loginUrl.searchParams.get('next')) || '/admin'
  const body = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>관리자 로그인 | Space DDF</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1c1c1c; background: #fff; }
    main { width: min(420px, calc(100% - 48px)); margin: 12vh auto 0; }
    h1 { margin: 0 0 28px; font-size: 28px; line-height: 1.2; }
    label { display: block; margin: 0 0 16px; font-size: 13px; font-weight: 700; color: #666; }
    input { box-sizing: border-box; width: 100%; margin-top: 6px; padding: 13px 12px; border: 1px solid #1c1c1c; border-radius: 0; font: inherit; }
    button { width: 100%; margin-top: 8px; padding: 14px 12px; border: 1px solid #1c1c1c; background: #1c1c1c; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    p { margin: 0 0 18px; color: #666; line-height: 1.5; }
    .error { color: #c8372d; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>관리자 로그인</h1>
    <p>Space DDF 렌탈·콘텐츠 관리 화면입니다.</p>
    ${message ? `<p class="error">${escapeHtml(message)}</p>` : ''}
    <form method="post" action="/admin">
      <input type="hidden" name="next" value="${escapeAttribute(resolvedNextPath)}" />
      <label>아이디
        <input name="username" autocomplete="username" required />
      </label>
      <label>비밀번호
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit">로그인</button>
    </form>
  </main>
</body>
</html>`

  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function normalizeNextPath(value) {
  const nextPath = normalizeCredential(value)

  if (nextPath !== '/admin') return ''
  if (nextPath.startsWith('//')) return ''

  return nextPath
}

function normalizeCredential(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseCookies(cookieHeader = '') {
  if (typeof cookieHeader !== 'string') return {}

  return cookieHeader.split(';').reduce((cookies, part) => {
    const [name, ...valueParts] = part.trim().split('=')

    if (name) cookies[name] = valueParts.join('=')
    return cookies
  }, {})
}

function jsonError(status, code, message) {
  return Response.json({
    error: { code, message },
  }, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function base64UrlEncode(value) {
  return bytesToBase64Url(textBytes(value))
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function bytesToBase64Url(bytes) {
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function textBytes(value) {
  return new TextEncoder().encode(String(value))
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[character]
  })
}

function escapeAttribute(value) {
  return escapeHtml(value)
}
