#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const contentFile = path.join(root, 'src/stores/content.js')
const indexFile = path.join(distDir, 'index.html')

const SITE_URL = 'https://spaceddf.xyz'
const SITE_NAME = 'Space DDF'
const DEFAULT_DESCRIPTION = 'Space DDF는 광주 동구 충장로에 위치한 대안 예술 공간입니다. 사진, 미디어아트, 설치 등 실험적 전시와 전시 대관, 워크숍, 오픈 포트폴리오 프로그램을 운영합니다.'
const DEFAULT_IMAGE = '/og-default.jpg'
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
const STATIC_SPA_ROUTES = ['/rental', '/archive-map', '/archive-route', '/admin']

function main() {
  if (!fs.existsSync(indexFile)) {
    throw new Error('dist/index.html not found. Run the production build first.')
  }

  const template = fs.readFileSync(indexFile, 'utf8')
  const data = readContentData()
  const routes = [
    ...data.showSlugs.map(slug => itemFromMeta('show', slug, data.showMeta[slug] || {})),
    ...data.projectSlugs.map(slug => itemFromMeta('project', slug, data.projectMeta[slug] || {})),
  ]

  for (const item of routes) {
    const routePath = item.kind === 'project'
      ? `/projects/${item.slug}`
      : `/shows/${item.slug}`
    const html = renderRouteHtml(template, item, routePath)
    const target = path.join(distDir, routePath, 'index.html')

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, html)
  }

  for (const routePath of STATIC_SPA_ROUTES) {
    const target = path.join(distDir, routePath, 'index.html')

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, template)
  }

  console.log(`Prerendered ${routes.length} detail routes.`)
}

function readContentData() {
  const source = fs.readFileSync(contentFile, 'utf8')
  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx'],
  })
  const variables = {}

  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration') continue

    for (const declaration of statement.declarations) {
      if (declaration.id?.type !== 'Identifier') continue

      if (['SHOW_SLUGS', 'SHOW_META', 'PROJECT_SLUGS', 'PROJECT_META'].includes(declaration.id.name)) {
        variables[declaration.id.name] = literalValue(declaration.init)
      }
    }
  }

  return {
    showSlugs: variables.SHOW_SLUGS || [],
    showMeta: variables.SHOW_META || {},
    projectSlugs: variables.PROJECT_SLUGS || [],
    projectMeta: variables.PROJECT_META || {},
  }
}

function literalValue(node) {
  if (!node) return undefined

  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'TemplateLiteral':
      if (node.expressions.length) {
        throw new Error('Template literals with expressions are not supported in content metadata.')
      }
      return node.quasis.map(quasi => quasi.value.cooked).join('')
    case 'ArrayExpression':
      return node.elements.map(element => literalValue(element))
    case 'ObjectExpression':
      return node.properties.reduce((result, property) => {
        if (property.type !== 'ObjectProperty') return result

        const key = property.key.type === 'Identifier'
          ? property.key.name
          : property.key.value
        result[key] = literalValue(property.value)
        return result
      }, {})
    default:
      throw new Error(`Unsupported metadata node: ${node.type}`)
  }
}

function itemFromMeta(kind, slug, meta) {
  const body = Array.isArray(meta.body)
    ? meta.body
    : (meta.body ? [meta.body] : [])

  return {
    kind,
    slug,
    title: meta.title || slug,
    dateRange: meta.dateRange || '',
    summary: meta.summary || '',
    description: meta.description || '',
    body,
  }
}

function renderRouteHtml(template, item, routePath) {
  const canonical = absoluteUrl(routePath)
  const title = `${compactText(item.title)} | ${SITE_NAME}`
  const description = truncate(item.summary || item.description || item.body[0] || DEFAULT_DESCRIPTION)
  const image = absoluteUrl(DEFAULT_IMAGE)
  const structuredData = JSON.stringify(detailStructuredData(item, canonical, description, image), null, 2)

  let html = template
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(title)}</title>`)
  html = replaceCanonical(html, canonical)
  html = replaceMeta(html, 'name', 'description', description)
  html = replaceMeta(html, 'name', 'robots', DEFAULT_ROBOTS)
  html = replaceMeta(html, 'property', 'og:type', 'article')
  html = replaceMeta(html, 'property', 'og:title', title)
  html = replaceMeta(html, 'property', 'og:description', description)
  html = replaceMeta(html, 'property', 'og:url', canonical)
  html = replaceMeta(html, 'property', 'og:image', image)
  html = replaceMeta(html, 'property', 'og:image:alt', `${compactText(item.title)} 대표 이미지`)
  html = removeMeta(html, 'property', 'og:image:width')
  html = removeMeta(html, 'property', 'og:image:height')
  html = replaceMeta(html, 'name', 'twitter:title', title)
  html = replaceMeta(html, 'name', 'twitter:description', description)
  html = replaceMeta(html, 'name', 'twitter:image', image)
  html = replaceMeta(html, 'name', 'twitter:image:alt', `${compactText(item.title)} 대표 이미지`)
  html = html.replace(
    /<script id="route-structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script id="route-structured-data" type="application/ld+json">\n${structuredData}\n  </script>`,
  )

  return html
}

function replaceCanonical(html, href) {
  const escapedHref = escapeAttribute(href)
  const replacement = `<link rel="canonical" href="${escapedHref}" />`

  if (/<link\s+rel="canonical"[^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel="canonical"[^>]*>/i, replacement)
  }

  return html.replace('</head>', `  ${replacement}\n</head>`)
}

function replaceMeta(html, attribute, name, content) {
  const attr = escapeRegExp(attribute)
  const metaName = escapeRegExp(name)
  const replacement = `<meta ${attribute}="${escapeAttribute(name)}" content="${escapeAttribute(content)}" />`
  const pattern = new RegExp(`<meta\\s+${attr}="${metaName}"[^>]*>`, 'i')

  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }

  return html.replace('</head>', `  ${replacement}\n</head>`)
}

function removeMeta(html, attribute, name) {
  const attr = escapeRegExp(attribute)
  const metaName = escapeRegExp(name)
  const pattern = new RegExp(`\\s*<meta\\s+${attr}="${metaName}"[^>]*>`, 'ig')
  return html.replace(pattern, '')
}

function detailStructuredData(item, canonical, description, image) {
  const { start, end } = parseDateRange(item.dateRange)
  const lastDate = end || start
  const completed = lastDate && lastDate < new Date()

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: item.kind === 'project' ? 'Project' : 'Show',
            item: canonical,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: compactText(item.title),
            item: canonical,
          },
        ],
      },
      {
        '@type': 'Event',
        '@id': `${canonical}#event`,
        name: compactText(item.title),
        description,
        url: canonical,
        image: [image],
        startDate: dateToIso(start),
        endDate: dateToIso(end || start),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: completed
          ? 'https://schema.org/EventCompleted'
          : 'https://schema.org/EventScheduled',
        location: {
          '@id': `${SITE_URL}/#organization`,
        },
        organizer: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      artGalleryStructuredData(),
    ],
  }
}

function artGalleryStructuredData() {
  return {
    '@type': ['ArtGallery', 'EventVenue'],
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description: '광주 동구 충장로에 위치한 전시공간 및 전시 대관이 가능한 대안 예술 공간 Space DDF.',
    logo: absoluteUrl('/apple-touch-icon.png'),
    image: absoluteUrl(DEFAULT_IMAGE),
    sameAs: [
      'https://www.instagram.com/space.ddf',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressRegion: '광주광역시',
      addressLocality: '동구',
      streetAddress: '충장로46번길 8-8 1층',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'space.ddf@gmail.com',
        availableLanguage: ['ko', 'en'],
      },
    ],
  }
}

function parseDateRange(dateRange) {
  if (!dateRange || typeof dateRange !== 'string' || !dateRange.trim()) {
    return { start: null, end: null }
  }

  const normalized = dateRange.replace(/\s*[–—-]\s*/g, ' - ')
  const [startText, endText] = normalized.split(' - ').map(value => value?.trim())
  const start = parseYmd(startText)
  let end = endText ? parseMaybeMdWithYear(endText, start?.getFullYear()) : null

  if (start && end && end < start && !/^\d{4}\./.test(endText || '')) {
    end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate())
  }

  return { start, end }
}

function parseYmd(value) {
  if (!value) return null

  const match = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/)
  if (!match) return null

  return validDate(+match[1], +match[2] - 1, +match[3])
}

function parseMaybeMdWithYear(value, fallbackYear) {
  if (!value) return null

  const fullMatch = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/)
  if (fullMatch) {
    return validDate(+fullMatch[1], +fullMatch[2] - 1, +fullMatch[3])
  }

  const shortMatch = value.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!shortMatch || !Number.isInteger(fallbackYear)) return null

  return validDate(fallbackYear, +shortMatch[1] - 1, +shortMatch[2])
}

function validDate(year, month, day) {
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function dateToIso(date) {
  if (!date) return undefined

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function absoluteUrl(pathname = '/') {
  return new URL(pathname || '/', SITE_URL).href
}

function compactText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength = 160) {
  const text = compactText(value)

  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value) {
  return escapeText(value)
    .replace(/"/g, '&quot;')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

main()
