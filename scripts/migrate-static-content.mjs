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
  return `INSERT INTO contents (id,type,slug,title,date_display,location,body,description,status)
VALUES (${q(id)},${q(content.type)},${q(content.slug)},${q(content.title)},${q(content.dateDisplay)},${q(content.location)},${q(content.body)},${q(content.description)},'draft')
ON CONFLICT(type,slug) DO UPDATE SET title=excluded.title,date_display=excluded.date_display,location=excluded.location,body=excluded.body,description=excluded.description,updated_at=CURRENT_TIMESTAMP;
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
const sql = `${contentSql}\n${assetSql}`
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
