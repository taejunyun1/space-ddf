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

const sql = exported.contents.map(content => {
  const id = stableId(content.type, content.slug)
  return `INSERT INTO contents (id,type,slug,title,date_display,location,body,description,status)
VALUES (${q(id)},${q(content.type)},${q(content.slug)},${q(content.title)},${q(content.dateDisplay)},${q(content.location)},${q(content.body)},${q(content.description)},'draft')
ON CONFLICT(type,slug) DO UPDATE SET title=excluded.title,date_display=excluded.date_display,location=excluded.location,body=excluded.body,description=excluded.description,updated_at=CURRENT_TIMESTAMP;`
}).join('\n')
const sqlFile = path.join(root, '.content-migration.sql')
fs.writeFileSync(sqlFile, sql)

try {
  run('npx', ['wrangler', 'd1', 'execute', 'space-ddf-rentals', ...(remote ? ['--remote'] : ['--local']), '--file', sqlFile])
  for (const asset of exported.assets) {
    const key = `legacy/${asset.type}/${asset.slug}/${path.basename(asset.file)}`
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

function q(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}

