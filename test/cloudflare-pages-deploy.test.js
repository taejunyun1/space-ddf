const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('package exposes a Cloudflare Pages build that does not create cPanel zip output', () => {
  const pkg = JSON.parse(readProjectFile('package.json'))

  assert.equal(
    pkg.scripts['build:pages'],
    'npm run assets:manifest && vite build && npm run prerender && npm run csp:hashes'
  )
  assert.doesNotMatch(pkg.scripts['build:pages'], /package:dist/)
  assert.match(pkg.scripts.build, /package:dist/)
})

test('package exposes a Pages smoke command for deployed previews', () => {
  const pkg = JSON.parse(readProjectFile('package.json'))
  const smoke = readProjectFile('scripts/smoke-test.js')

  assert.equal(pkg.scripts['smoke:pages'], 'node scripts/smoke-test.js')
  assert.match(smoke, /require\('https'\)/)
  assert.match(smoke, /getHttpClient/)
})

test('Cloudflare Pages rental backend documents D1 binding and migration setup', () => {
  const wranglerExample = readProjectFile('wrangler.pages.example.jsonc')
  const docs = readProjectFile('docs/cloudflare-rental-deployment.md')

  assert.match(wranglerExample, /pages_build_output_dir/)
  assert.match(wranglerExample, /"binding":\s*"DB"/)
  assert.match(wranglerExample, /"database_name":\s*"space-ddf-rentals"/)
  assert.match(wranglerExample, /"migrations_dir":\s*"migrations"/)
  assert.doesNotMatch(wranglerExample, /ADMIN_ACCESS/)
  assert.match(wranglerExample, /"MANAGE_AUTH_USER":\s*"ddf"/)
  assert.doesNotMatch(wranglerExample, /MANAGE_AUTH_PASSWORD/)
  assert.doesNotMatch(wranglerExample, /MANAGE_AUTH_SECRET/)
  assert.match(docs, /GOOGLE_CALENDAR_ICAL_URL/)
  assert.match(docs, /\/api\/calendar\/google/)
  assert.match(docs, /Google/)
  assert.match(docs, /space\.ddf@gmail\.com/)
  assert.doesNotMatch(docs, /ADMIN_ACCESS_BYPASS/)
  assert.match(docs, /MANAGE_AUTH_PASSWORD/)
  assert.match(docs, /MANAGE_AUTH_SECRET/)
  assert.match(docs, /wrangler d1 create space-ddf-rentals/)
  assert.match(docs, /wrangler d1 migrations apply space-ddf-rentals --remote/)
  assert.match(docs, /\/admin/)
  assert.doesNotMatch(docs.replaceAll('/api/manage', ''), /\/manage(?:\/|\b)/)
  assert.match(docs, /\/api\/manage\/\*/)
})

test('local Cloudflare secrets files stay out of git', () => {
  const gitignore = readProjectFile('.gitignore')

  assert.match(gitignore, /\.dev\.vars/)
})

test('Pages production config enables the password-protected manage surface', () => {
  const wranglerConfig = readProjectFile('wrangler.jsonc')

  assert.doesNotMatch(wranglerConfig, /ADMIN_ACCESS/)
  assert.match(wranglerConfig, /"MANAGE_AUTH_USER":\s*"ddf"/)
  assert.doesNotMatch(wranglerConfig, /MANAGE_AUTH_PASSWORD/)
  assert.doesNotMatch(wranglerConfig, /MANAGE_AUTH_SECRET/)
})

test('Pages config binds the fixed rental notification destination', () => {
  const wranglerConfig = readProjectFile('wrangler.jsonc')
  const wranglerExample = readProjectFile('wrangler.pages.example.jsonc')
  const docs = readProjectFile('docs/cloudflare-rental-deployment.md')

  for (const config of [wranglerConfig, wranglerExample]) {
    assert.match(config, /RENTAL_NOTIFICATION_EMAIL/)
    assert.match(config, /space-ddf-rental-email/)
    assert.match(config, /"services"/)
  }

  assert.match(docs, /Rental Notification Email/)
  assert.match(docs, /rental@spaceddf\.xyz/)
  assert.match(docs, /Email Routing/)
  assert.match(docs, /Service Binding/)
  assert.match(docs, /받은편지함을 만들 필요가 없습니다/)
})

test('email Worker is private and bound to the verified destination', () => {
  const config = readProjectFile('wrangler.email-worker.jsonc')

  assert.match(config, /space-ddf-rental-email/)
  assert.match(config, /workers\/rental-email\/index\.mjs/)
  assert.match(config, /"workers_dev"\s*:\s*false/)
  assert.match(config, /rental@spaceddf\.xyz/)
  assert.match(config, /space\.ddf@gmail\.com/)
})

test('Pages Functions are scoped to API routes so SPA fallback works', () => {
  const routes = JSON.parse(readProjectFile('public/_routes.json'))

  assert.equal(routes.version, 1)
  assert.deepEqual(routes.include, ['/api/*', '/admin', '/shows/*', '/projects/*'])
  assert.deepEqual(routes.exclude, [])
})

test('managed detail routes fall back to the SPA shell when no prerendered asset exists', async () => {
  const { serveManagedDetailRoute } = await import('../src/server/detail-route.mjs')
  const requests = []
  const context = {
    request: new Request('https://spaceddf.xyz/shows/new-managed-show'),
    env: {
      ASSETS: {
        async fetch(request) {
          const url = new URL(request.url)
          requests.push(url.pathname)
          return url.pathname === '/'
            ? new Response('<div id="app"></div>', { status: 200 })
            : new Response('Not Found', { status: 404 })
        },
      },
    },
  }

  const response = await serveManagedDetailRoute(context)

  assert.equal(response.status, 200)
  assert.equal(await response.text(), '<div id="app"></div>')
  assert.deepEqual(requests, ['/shows/new-managed-show', '/'])
  assert.match(readProjectFile('functions/shows/[[path]].js'), /serveManagedDetailRoute/)
  assert.match(readProjectFile('functions/projects/[[path]].js'), /serveManagedDetailRoute/)
})

test('SEO prerender writes static shells for top-level SPA routes used by Pages', () => {
  const source = readProjectFile('scripts/prerender-seo.js')

  assert.match(source, /STATIC_SPA_ROUTES/)
  assert.match(source, /\/rental/)
  assert.match(source, /'\/archive-map'/)
  assert.match(source, /'\/admin'/)
  assert.doesNotMatch(source, /\/admin\/rentals|\/manage/)
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
