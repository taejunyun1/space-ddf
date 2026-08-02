import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('admin frontend exposes only the /admin route', () => {
  const router = read('src/router/index.js')
  const adminPaths = [...router.matchAll(/path:\s*'([^']*(?:admin|manage)[^']*)'/g)].map(match => match[1])

  assert.deepEqual(adminPaths, ['/admin'])
  assert.match(router, /name:\s*'admin'/)
  assert.match(router, /AdminView\.vue/)
})

test('admin shell combines rental and content panels without changing the URL', () => {
  const source = read('src/views/AdminView.vue')

  assert.match(source, /렌탈 관리/)
  assert.match(source, /콘텐츠 관리/)
  assert.match(source, /<AdminRentalsView/)
  assert.match(source, /<AdminContentsView/)
  assert.match(source, /<ContentPreviewModal/)
  assert.doesNotMatch(source, /RouterLink|router\.push|window\.open/)
})

test('content preview is emitted to the admin modal instead of opening a route', () => {
  const contents = read('src/views/AdminContentsView.vue')
  const modal = read('src/components/admin/ContentPreviewModal.vue')

  assert.match(contents, /defineEmits/)
  assert.match(contents, /emit\('preview',\s*draft\.value\)/)
  assert.doesNotMatch(contents, /window\.open|\/manage\/contents/)
  assert.match(modal, /role="dialog"/)
  assert.match(modal, /@click\.self="\$emit\('close'\)"/)
})

test('Cloudflare Pages protects /admin and serves managed detail fallbacks as frontend function routes', () => {
  const routes = JSON.parse(read('public/_routes.json'))
  const adminFunction = read('functions/admin/[[path]].js')

  assert.deepEqual(routes.include, ['/api/*', '/admin', '/shows/*', '/projects/*'])
  assert.match(adminFunction, /handleManagePageRoute/)
  assert.equal(fs.existsSync(path.join(root, 'functions/manage/[[path]].js')), false)
  assert.equal(fs.existsSync(path.join(root, 'src/server/admin-page.mjs')), false)
})
