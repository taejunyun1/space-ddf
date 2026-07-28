import test from 'node:test'
import assert from 'node:assert/strict'
import { exportStaticContent } from '../scripts/export-static-content.mjs'

test('static export includes every configured show and project slug with normalized credits', () => {
  const exported = exportStaticContent()
  assert.ok(exported.contents.length >= 20)
  assert.ok(exported.contents.some(item => item.type === 'show' && item.slug === 'water-photo-automat'))
  assert.ok(exported.contents.some(item => item.type === 'project' && item.slug === 'artwall'))
  assert.ok(exported.contents.every(item => Array.isArray(item.credits)))
})

test('static export reports asset files for migration', () => {
  const exported = exportStaticContent()
  assert.ok(exported.assets.some(asset => asset.role === 'preview'))
  assert.ok(exported.assets.some(asset => asset.role === 'gallery'))
})
