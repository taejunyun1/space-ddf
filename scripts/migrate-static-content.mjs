import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { exportStaticContent } from './export-static-content.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const remote = process.argv.includes('--remote')
const exported = exportStaticContent()

console.log(`콘텐츠 ${exported.contents.length}개, 이미지 ${exported.assets.length}개`)
if (dryRun) process.exit(0)

const contentSql = exported.contents.map(content => {
  const id = stableId(content.type, content.slug)
  const startDate = parseStartDate(content.dateDisplay)
  return `INSERT INTO contents (id,type,slug,title,start_date,date_display,location,body,description,status,published_at)
VALUES (${q(id)},${q(content.type)},${q(content.slug)},${q(content.title)},${q(startDate)},${q(content.dateDisplay)},${q(content.location)},${q(content.body)},${q(content.description)},'published',CURRENT_TIMESTAMP)
ON CONFLICT(type,slug) DO UPDATE SET title=excluded.title,start_date=excluded.start_date,date_display=excluded.date_display,location=excluded.location,body=excluded.body,description=excluded.description,status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP;
DELETE FROM content_credits WHERE content_id=${q(id)};
${content.credits.map((credit, index) => `INSERT INTO content_credits (id,content_id,label,value,url,sort_order)
VALUES (${q(`${id}-credit-${index}`)},${q(id)},${q(credit.label)},${q(credit.value)},${q(credit.url)},${Number(credit.sortOrder || index)});`).join('\n')}`
}).join('\n')
const assetSql = exported.assets.map((asset, index) => {
  const contentId = stableId(asset.type, asset.slug)
  const assetId = stableAssetId(asset, index)
  const key = objectKey(asset)
  const stat = fs.statSync(path.join(root, asset.file))
  return `INSERT INTO content_assets (id,content_id,role,r2_key_original,mime_type,byte_size,sort_order,upload_status)
VALUES (${q(assetId)},${q(contentId)},${q(asset.role)},${q(key)},${q(mimeType(asset.file))},${stat.size},${Number(asset.sortOrder || 0)},'ready')
ON CONFLICT(id) DO UPDATE SET role=excluded.role,r2_key_original=excluded.r2_key_original,mime_type=excluded.mime_type,byte_size=excluded.byte_size,sort_order=excluded.sort_order,upload_status='ready';`
}).join('\n')
const publicationSql = exported.contents.map(content => {
  const id = stableId(content.type, content.slug)
  const payload = publicationPayload(content)
  return `INSERT INTO content_publications (content_id,type,slug,payload_json,published_at)
VALUES (${q(id)},${q(content.type)},${q(content.slug)},${q(JSON.stringify(payload))},CURRENT_TIMESTAMP)
ON CONFLICT(content_id) DO UPDATE SET type=excluded.type,slug=excluded.slug,payload_json=excluded.payload_json,published_at=CURRENT_TIMESTAMP;`
}).join('\n')
const sql = `${contentSql}\n${assetSql}\n${publicationSql}`
const sqlFile = path.join(root, '.content-migration.sql')
fs.writeFileSync(sqlFile, sql)

try {
  run('npx', ['wrangler', 'd1', 'execute', 'space-ddf-rentals', ...(remote ? ['--remote'] : ['--local']), '--file', sqlFile])
  for (const asset of exported.assets) {
    const key = objectKey(asset)
    run('npx', ['wrangler', 'r2', 'object', 'put', `space-ddf-content-assets/${key}`, '--file', path.join(root, asset.file), ...(remote ? ['--remote'] : [])])
  }
} finally {
  fs.rmSync(sqlFile, { force: true })
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

function stableId(type, slug) {
  return `legacy-${type}-${slug}`
}

function stableAssetId(asset, index) {
  return `${stableId(asset.type, asset.slug)}-${asset.role}-${index}`
}

function objectKey(asset) {
  return `legacy/${asset.type}/${asset.slug}/${path.basename(asset.file)}`
}

function publicationPayload(content) {
  const related = exported.assets
    .map((asset, index) => ({ ...asset, id: stableAssetId(asset, index) }))
    .filter(asset => asset.type === content.type && asset.slug === content.slug)
  const poster = related.find(asset => asset.role === 'poster')
  const preview = related.find(asset => asset.role === 'preview') || poster
  return {
    id: stableId(content.type, content.slug),
    ...content,
    startDate: parseStartDate(content.dateDisplay),
    dateRange: content.dateDisplay,
    hero: poster ? `/api/contents/assets/${poster.id}` : '',
    preview: preview ? `/api/contents/assets/${preview.id}` : '',
    gallery: related.filter(asset => asset.role === 'gallery').map(asset => ({
      src: `/api/contents/assets/${asset.id}`,
      original: `/api/contents/assets/${asset.id}`,
      alt: content.title,
      caption: '',
    })),
  }
}

function parseStartDate(value) {
  const match = String(value || '').match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!match) return ''
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function mimeType(file) {
  const extension = path.extname(file).toLowerCase()
  return {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.avif': 'image/avif',
  }[extension] || 'application/octet-stream'
}

function q(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}
