const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('source index contains no executable inline scripts', () => {
  const html = readProjectFile('index.html')
  const inlineExecutableScripts = extractInlineExecutableScripts(html)

  assert.deepEqual(inlineExecutableScripts, [])
})

test('google analytics uses environment configuration behind a production hostname guard', () => {
  const indexHtml = readProjectFile('index.html')
  const analyticsSource = readProjectFile('src/services/analytics.js')
  const productionEnv = readProjectFile('.env.production')

  assert.doesNotMatch(indexHtml, /\bG-[A-Z0-9]+\b/)
  assert.doesNotMatch(analyticsSource, /\bG-[A-Z0-9]+\b/)
  assert.match(analyticsSource, /VITE_GA_MEASUREMENT_ID/)
  assert.match(analyticsSource, /spaceddf\.xyz/)
  assert.doesNotMatch(analyticsSource, /www\.spaceddf\.xyz/)
  assert.match(productionEnv, /^VITE_GA_MEASUREMENT_ID=G-[A-Z0-9]+$/m)
})

test('CSP allows Cloudflare Web Analytics beacon on proxied custom domains', () => {
  const cspSource = readProjectFile('scripts/apply-csp-hashes.js')
  const headers = readProjectFile('public/_headers')
  const html = readProjectFile('index.html')
  const generatedConnectSources = cspSource.match(/connectSrc:\s*\[[\s\S]*?\]/)?.[0] || ''

  assert.match(cspSource, /https:\/\/static\.cloudflareinsights\.com/)
  assert.match(generatedConnectSources, /https:\/\/cloudflareinsights\.com/)
  assert.match(headers, /script-src[^;\n]*https:\/\/static\.cloudflareinsights\.com/)
  assert.match(headers, /connect-src[^;\n]*https:\/\/cloudflareinsights\.com/)
  assert.match(html, /script-src[^"]*https:\/\/static\.cloudflareinsights\.com/)
  assert.match(html, /connect-src[^"]*https:\/\/cloudflareinsights\.com/)
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function extractInlineExecutableScripts(html) {
  const inlineScriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  const scripts = []
  let match

  while ((match = inlineScriptPattern.exec(html)) !== null) {
    const [, attributes, body] = match

    if (/\bsrc\s*=/i.test(attributes)) continue
    if (!body.trim()) continue
    if (!isExecutableScript(attributes)) continue

    scripts.push(body.trim())
  }

  return scripts
}

function isExecutableScript(attributes) {
  const typeMatch = attributes.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)
  const type = typeMatch ? typeMatch[1].toLowerCase() : ''

  return !type || type === 'text/javascript' || type === 'module' || type === 'application/javascript'
}
