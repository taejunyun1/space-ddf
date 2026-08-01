import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  validateContentDraft,
  validateContentForPublish,
  normalizeContentInput,
} from '../src/server/content-api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('content migration defines drafts, snapshots, credits, assets, and slug history', () => {
  const sql = fs.readFileSync(path.join(root, 'migrations/0004_content_management.sql'), 'utf8')

  for (const table of [
    'contents',
    'content_publications',
    'content_credits',
    'content_assets',
    'content_slug_history',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
  }
})

test('draft validation accepts incomplete content but rejects invalid type and slug', () => {
  assert.equal(validateContentDraft({ type: 'show' }).ok, true)
  assert.deepEqual(validateContentDraft({ type: 'event', slug: 'Not Valid' }).fields, {
    type: '타입은 show 또는 project여야 합니다.',
    slug: 'slug는 영문 소문자, 숫자와 하이픈만 사용할 수 있습니다.',
  })
})

test('publish validation requires title, start date, poster, credit, and body text', () => {
  assert.deepEqual(
    Object.keys(validateContentForPublish({ type: 'show', slug: 'draft' }).fields).sort(),
    ['body', 'credits', 'poster', 'startDate', 'title'],
  )
})

test('content input normalizes repeatable credits and gallery assets', () => {
  const result = normalizeContentInput({
    type: 'show',
    slug: 'new-show',
    title: '  새 전시  ',
    credits: [
      { label: ' 참여작가 ', value: ' 작가 ', url: 'https://instagram.com/artist' },
      { label: 'Artists', value: '   ' },
      { label: 'Homepage', value: ' peer-up.com ', url: 'javascript:alert(1)' },
    ],
    assets: [{ id: 'poster', role: 'poster', uploadStatus: 'ready' }],
  })

  assert.equal(result.title, '새 전시')
  assert.deepEqual(result.credits, [
    { label: 'Artists', value: '작가', url: 'https://instagram.com/artist', sortOrder: 0 },
    { label: 'Homepage', value: 'peer-up.com', url: '', sortOrder: 2 },
  ])
  assert.equal(result.assets[0].role, 'poster')
})

test('label-only credits do not satisfy publish validation', () => {
  const result = validateContentForPublish({
    type: 'show',
    slug: 'empty-credit',
    title: '빈 크레딧',
    startDate: '2026-08-02',
    body: '본문',
    credits: [{ label: 'Artists', value: '' }],
    assets: [{ role: 'poster', uploadStatus: 'ready' }],
  })

  assert.equal(result.fields.credits, '내용이 있는 크레딧을 한 개 이상 입력해주세요.')
})

test('published payload matches the existing detail view body and credit contracts', () => {
  const source = fs.readFileSync(new URL('../src/server/content-api.mjs', import.meta.url), 'utf8')
  assert.match(source, /body:\s*publicBody\(content\.body\)/)
  assert.match(source, /credits:\s*publicCredits\(content\.credits\)/)
  assert.match(source, /split\(\/\\n\\s\*\\n\/\)/)
  assert.match(source, /credit\.label,\s*credit\.value,\s*credit\.url/)
})
