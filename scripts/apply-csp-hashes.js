#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')

const CSP_BASE = {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fastly.jsdelivr.net'],
  scriptSrc: ['https://maps.googleapis.com', 'https://maps.gstatic.com'],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://*.googleapis.com',
    'https://*.ggpht.com',
  ],
  frameSrc: ['https://www.google.com'],
  connectSrc: [
    "'self'",
    'https://space-ddf-archive-api.taejunyun.workers.dev',
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://*.googleapis.com',
  ],
  manifestSrc: ["'self'"],
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist directory not found. Run the production build first.')
  }

  const htmlFiles = findFiles(distDir, file => file.endsWith('.html'))
  const hashes = inlineScriptHashes(htmlFiles)
  const headerCsp = buildCsp(hashes, { includeFrameAncestors: true })
  const htmlCsp = buildCsp(hashes, { includeFrameAncestors: false })

  for (const file of htmlFiles) {
    replaceHtmlCsp(file, htmlCsp)
  }

  replaceHtaccessCsp(path.join(distDir, '.htaccess'), headerCsp)
  replaceHeadersCsp(path.join(distDir, '_headers'), headerCsp)

  console.log(`Applied CSP with ${hashes.length} inline script hash${hashes.length === 1 ? '' : 'es'}.`)
}

function findFiles(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)

    if (entry.isDirectory()) return findFiles(target, predicate)
    return predicate(target) ? [target] : []
  })
}

function inlineScriptHashes(htmlFiles) {
  const hashes = new Set()
  const inlineScriptPattern = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8')
    let match

    while ((match = inlineScriptPattern.exec(html)) !== null) {
      if (!match[1]) continue

      hashes.add(`'sha256-${crypto
        .createHash('sha256')
        .update(match[1], 'utf8')
        .digest('base64')}'`)
    }
  }

  return Array.from(hashes).sort()
}

function buildCsp(scriptHashes, options) {
  const directives = [
    directive('default-src', CSP_BASE.defaultSrc),
    directive('script-src', ["'self'", ...scriptHashes, ...CSP_BASE.scriptSrc]),
    directive('style-src', CSP_BASE.styleSrc),
    directive('font-src', CSP_BASE.fontSrc),
    directive('img-src', CSP_BASE.imgSrc),
    directive('frame-src', CSP_BASE.frameSrc),
    directive('connect-src', CSP_BASE.connectSrc),
    directive('manifest-src', CSP_BASE.manifestSrc),
    directive('object-src', ["'none'"]),
    directive('base-uri', ["'self'"]),
    directive('form-action', ["'self'"]),
    directive('worker-src', ["'none'"]),
    'upgrade-insecure-requests',
  ]

  if (options.includeFrameAncestors) {
    directives.splice(directives.length - 2, 0, directive('frame-ancestors', ["'none'"]))
  }

  return directives.join('; ')
}

function directive(name, values) {
  return `${name} ${values.join(' ')}`
}

function replaceHtmlCsp(file, csp) {
  const html = fs.readFileSync(file, 'utf8')
  const replacement = [
    '<meta',
    '    http-equiv="Content-Security-Policy"',
    `    content="${escapeAttribute(csp)}"`,
    '  />',
  ].join('\n')
  const pattern = /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/i

  if (pattern.test(html)) {
    fs.writeFileSync(file, html.replace(pattern, replacement))
    return
  }

  if (!/<\/head>/i.test(html)) {
    throw new Error(`HTML head not found in ${path.relative(root, file)}`)
  }

  fs.writeFileSync(file, html.replace(/<\/head>/i, `  ${replacement}\n</head>`))
}

function replaceHtaccessCsp(file, csp) {
  if (!fs.existsSync(file)) return

  const source = fs.readFileSync(file, 'utf8')
  const updated = source.replace(
    /Header always set Content-Security-Policy "[^"]*"/,
    `Header always set Content-Security-Policy "${csp}"`,
  )

  if (updated === source) {
    throw new Error(`Content-Security-Policy header not found in ${path.relative(root, file)}`)
  }

  fs.writeFileSync(file, updated)
}

function replaceHeadersCsp(file, csp) {
  if (!fs.existsSync(file)) return

  const source = fs.readFileSync(file, 'utf8')
  const updated = source.replace(
    /^(\s*)Content-Security-Policy: .+$/m,
    `$1Content-Security-Policy: ${csp}`,
  )

  if (updated === source) {
    throw new Error(`Content-Security-Policy header not found in ${path.relative(root, file)}`)
  }

  fs.writeFileSync(file, updated)
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
}

main()
