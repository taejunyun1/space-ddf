#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const contentEntries = require('./content-asset-entries')

const root = path.resolve(__dirname, '..')
const releaseDir = path.join(root, 'release')
const archiveName = 'space-ddf-originals.zip'
const archivePath = path.join(releaseDir, archiveName)
const imagePattern = /\.(?:png|jpe?g|webp|gif|svg)$/i

function main() {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'space-ddf-originals-'))
  const originalsRoot = path.join(staging, 'originals')

  try {
    for (const { kind, slug } of contentEntries) {
      const sourceDir = path.join(root, 'src/assets', kind, slug)
      const targetDir = path.join(originalsRoot, kind, slug)

      if (!fs.existsSync(sourceDir)) {
        throw new Error(`Missing asset directory: ${path.relative(root, sourceDir)}`)
      }

      fs.mkdirSync(targetDir, { recursive: true })

      for (const file of fs.readdirSync(sourceDir).sort(naturalCompare)) {
        const source = path.join(sourceDir, file)

        if (!imagePattern.test(file) || !fs.statSync(source).isFile()) continue

        fs.copyFileSync(source, path.join(targetDir, file))
      }
    }

    fs.mkdirSync(releaseDir, { recursive: true })
    fs.rmSync(archivePath, { force: true })

    const result = spawnSync('zip', [
      '-qry',
      archivePath,
      'originals',
      '-x',
      '*.DS_Store',
      '*/.DS_Store',
      '__MACOSX/*',
      '*/__MACOSX/*',
    ], {
      cwd: staging,
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
    console.log('Upload this zip to cPanel public_html and extract it once, or when original images change.')
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
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

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

main()
