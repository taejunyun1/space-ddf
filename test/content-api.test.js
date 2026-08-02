import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  handleManageContentRequest,
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

for (const type of ['show', 'project']) {
  test(`${type} manager payload preserves every structured field`, () => {
    const input = {
      type,
      slug: `${type}-round-trip`,
      title: `${type} 제목`,
      startDate: '2026-08-02',
      endDate: '2026-08-12',
      dateDisplay: '2026.08.02. - 2026.08.12.',
      location: 'Space DDF',
      body: '짧은 소개',
      description: '본문',
      credits: [
        { label: '참여작가', value: '작가', url: 'https://instagram.com/artist' },
        { label: 'Homepage', value: '공식 사이트', url: 'https://example.com' },
      ],
      assets: [{ id: 'poster', role: 'poster', uploadStatus: 'ready' }],
    }
    const normalized = normalizeContentInput(input)

    assert.equal(normalized.type, type)
    assert.equal(normalized.slug, `${type}-round-trip`)
    assert.equal(normalized.title, `${type} 제목`)
    assert.equal(normalized.startDate, '2026-08-02')
    assert.equal(normalized.endDate, '2026-08-12')
    assert.equal(normalized.dateDisplay, '2026.08.02. - 2026.08.12.')
    assert.equal(normalized.location, 'Space DDF')
    assert.equal(normalized.body, '짧은 소개')
    assert.equal(normalized.description, '본문')
    assert.deepEqual(normalized.credits, [
      { label: 'Artists', value: '작가', url: 'https://instagram.com/artist', sortOrder: 0 },
      { label: 'Homepage', value: '공식 사이트', url: 'https://example.com', sortOrder: 1 },
    ])
    assert.deepEqual(normalized.assets, [{
      id: 'poster',
      role: 'poster',
      url: '',
      originalUrl: '',
      altText: '',
      caption: '',
      sortOrder: 0,
      uploadStatus: 'ready',
    }])
    assert.equal(validateContentForPublish(normalized).ok, true)
  })
}

test('published payload matches the existing detail view body and credit contracts', () => {
  const source = fs.readFileSync(new URL('../src/server/content-api.mjs', import.meta.url), 'utf8')
  assert.match(source, /body:\s*publicBody\(content\.body\)/)
  assert.match(source, /credits:\s*publicCredits\(content\.credits\)/)
  assert.match(source, /split\(\/\\n\\s\*\\n\/\)/)
  assert.match(source, /credit\.label,\s*credit\.value,\s*credit\.url/)
})

test('publishing always adds content to its home list and makes it the latest featured item', async () => {
  const calls = []
  const contentRow = {
    id: 'content-doom-unboxing',
    type: 'show',
    slug: 'doom-unboxing',
    title: '멸망 언박싱',
    start_date: '2026-08-01',
    end_date: '2026-08-12',
    date_display: '2026.08.01. - 2026.08.12.',
    location: 'Space DDF',
    body: '반품불가.',
    description: '',
    status: 'draft',
    show_on_home: 0,
    is_featured: 0,
    sort_order: 0,
    published_at: null,
    updated_at: '2026-08-01T00:00:00.000Z',
  }
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this },
        async first() { return contentRow },
        async all() {
          if (sql.includes('content_credits')) {
            return { results: [{ label: 'Artist', value: '김현석', url: '', sort_order: 0 }] }
          }
          if (sql.includes('content_assets')) {
            return { results: [{
              id: 'poster-1', role: 'poster', mime_type: 'image/jpeg', byte_size: 100,
              alt_text: '', caption: '', sort_order: 0, upload_status: 'ready',
            }] }
          }
          return { results: [] }
        },
      }
      return statement
    },
    async batch(statements) {
      calls.push(...statements)
      return statements.map(() => ({ success: true }))
    },
  }

  const response = await handleManageContentRequest({
    request: new Request('https://space-ddf.test/api/manage/contents/content-doom-unboxing/publish', {
      method: 'POST',
    }),
    env: { DB: db },
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.data.showOnHome, true)
  assert.equal(payload.data.isFeatured, true)
  assert.ok(payload.data.publishedAt)

  const clearPrevious = calls.find(call => call.sql.includes('UPDATE contents SET is_featured = 0'))
  assert.ok(clearPrevious)
  const publication = calls.find(call => call.sql.includes('INSERT INTO content_publications'))
  const publishedSnapshot = JSON.parse(publication.values[3])
  assert.equal(publishedSnapshot.showOnHome, true)
  assert.equal(publishedSnapshot.isFeatured, true)
  const current = calls.find(call => call.sql.includes("status='published'"))
  assert.match(current.sql, /show_on_home\s*=\s*1/)
  assert.match(current.sql, /is_featured\s*=\s*1/)
})
