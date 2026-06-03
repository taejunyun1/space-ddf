#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const releaseDir = path.join(root, 'release')
const archiveName = 'space-ddf-cpanel.zip'
const archivePath = path.join(releaseDir, archiveName)

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist directory not found. Run npm run build first.')
  }

  fs.mkdirSync(releaseDir, { recursive: true })
  fs.rmSync(archivePath, { force: true })

  const result = spawnSync('zip', [
    '-qry',
    archivePath,
    '.',
    '-x',
    '*.DS_Store',
    '*/.DS_Store',
    '__MACOSX/*',
    '*/__MACOSX/*',
  ], {
    cwd: distDir,
    env: {
      ...process.env,
      COPYFILE_DISABLE: '1',
    },
    stdio: 'inherit',
  })

  if (result.error) {
    throw new Error(`Failed to run zip: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`zip exited with status ${result.status}`)
  }

  const size = fs.statSync(archivePath).size
  console.log(`Created ${path.relative(root, archivePath)} (${formatBytes(size)}).`)
  console.log('Upload this zip to cPanel public_html and extract it there.')
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`
}

main()
