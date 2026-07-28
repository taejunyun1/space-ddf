import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function exportStaticContent() {
  const source = fs.readFileSync(path.join(root, 'src/stores/content.js'), 'utf8')
  const definitions = source
    .slice(0, source.indexOf('// src/stores/content.js\nexport const useContentStore'))
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*$/gm, '')
  const readDefinitions = new Function(`${definitions}
    return { SHOW_SLUGS, SHOW_META, PROJECT_SLUGS, PROJECT_META }
  `)
  const { SHOW_SLUGS, SHOW_META, PROJECT_SLUGS, PROJECT_META } = readDefinitions()
  const contents = [
    ...SHOW_SLUGS.map(slug => normalizeContent('show', slug, SHOW_META[slug] || {})),
    ...PROJECT_SLUGS.map(slug => normalizeContent('project', slug, PROJECT_META[slug] || {})),
  ]
  const assets = contents.flatMap(item => discoverAssets(item.type, item.slug))

  return { version: 1, contents, assets }
}

function normalizeContent(type, slug, meta) {
  const body = Array.isArray(meta.body) ? meta.body.join('\n\n') : String(meta.body || '').trim()
  return {
    type,
    slug,
    title: String(meta.title || slug).trim(),
    dateDisplay: String(meta.dateRange || '').trim(),
    location: String(meta.location || '').trim(),
    body,
    description: String(meta.description || '').trim(),
    credits: (meta.credits || []).map(normalizeCredit).filter(item => item.label || item.value),
    showOnHome: true,
    isFeatured: false,
  }
}

function normalizeCredit(value, sortOrder) {
  const text = String(value || '').trim()
  const space = text.indexOf(' ')
  return {
    label: space > 0 ? text.slice(0, space).trim() : text,
    value: space > 0 ? text.slice(space + 1).trim() : '',
    url: '',
    sortOrder,
  }
}

function discoverAssets(type, slug) {
  const kind = type === 'show' ? 'show' : 'project'
  const previewDir = path.join(root, 'src/assets/previews', kind)
  const contentDir = path.join(root, 'src/assets', kind, slug)
  const assets = []
  const preview = fs.existsSync(previewDir)
    ? fs.readdirSync(previewDir).find(name => path.parse(name).name === slug)
    : null

  if (preview) assets.push(assetRecord(type, slug, 'preview', path.join(previewDir, preview), 0))
  if (!fs.existsSync(contentDir)) return assets

  const files = fs.readdirSync(contentDir)
    .filter(name => /\.(?:jpe?g|png|webp|avif)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const posterIndex = files.findIndex(name => /^poster(?:\.|[-_])/i.test(name))
  if (posterIndex >= 0) assets.push(assetRecord(type, slug, 'poster', path.join(contentDir, files[posterIndex]), 0))
  files.forEach((name, index) => {
    if (index !== posterIndex) assets.push(assetRecord(type, slug, 'gallery', path.join(contentDir, name), index))
  })
  return assets
}

function assetRecord(type, slug, role, absolutePath, sortOrder) {
  return {
    type,
    slug,
    role,
    file: path.relative(root, absolutePath),
    sortOrder,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(exportStaticContent(), null, 2)}\n`)
}

