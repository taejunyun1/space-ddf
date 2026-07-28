import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('content service exposes public hydration and manager mutations', () => {
  const source = read('src/services/contents.js')
  for (const name of [
    'fetchPublishedContents',
    'fetchAdminContents',
    'createAdminContent',
    'updateAdminContent',
    'publishAdminContent',
    'uploadAdminContentAsset',
  ]) {
    assert.match(source, new RegExp(`export async function ${name}`))
  }
})

test('content store keeps static data when public hydration fails', () => {
  const source = read('src/stores/lib/content-actions.js')
  assert.match(source, /hydratePublishedContents/)
  assert.match(source, /catch[\s\S]*contentSource = 'static'/)
})

test('router exposes protected content manager and admin redirect', () => {
  const source = read('src/router/index.js')
  assert.match(source, /path:\s*'\/manage\/contents'/)
  assert.match(source, /name:\s*'manage-contents'/)
  assert.match(source, /path:\s*'\/admin\/contents'/)
})

test('content manager uses the approved navigation editor and publish panels', () => {
  const source = read('src/views/AdminContentsView.vue')
  assert.match(source, /admin-content-nav/)
  assert.match(source, /<ContentEditor/)
  assert.match(source, /<ContentPublishPanel/)
})
