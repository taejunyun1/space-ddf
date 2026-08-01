import test from 'node:test'
import assert from 'node:assert/strict'

import { auditContentMetadata } from '../scripts/audit-content-metadata.mjs'
import { exportStaticContent } from '../scripts/export-static-content.mjs'

test('metadata audit catches invalid types, dates, locations, credits, aliases, and links', () => {
  const issues = auditContentMetadata([{
    type: 'event',
    slug: 'broken',
    dateDisplay: '',
    location: 'https://example.com',
    credits: [
      { label: 'Artist', value: '작가', url: '' },
      { label: 'Artists', value: '', url: '' },
      { label: 'Homepage', value: '사이트', url: 'javascript:alert(1)' },
    ],
  }])

  assert.deepEqual(new Set(issues.map(issue => issue.code)), new Set([
    'unsupported-type',
    'missing-date',
    'url-location',
    'noncanonical-label',
    'empty-credit',
    'invalid-credit-url',
  ]))
})

test('metadata audit accepts public string credits and populated custom labels', () => {
  const issues = auditContentMetadata([{
    type: 'project',
    slug: 'compatible',
    dateRange: '2026.08.01. - 2026.08.12.',
    location: '',
    credits: [
      'Artists 작가 https://instagram.com/artist',
      'Judgement 심사위원',
      'Co-Directing 협력공간',
      'Homepage peer-up.com https://www.peer-up.com/',
    ],
  }])

  assert.deepEqual(issues, [])
})

test('all static Project and Show metadata passes the canonical audit', () => {
  const { contents } = exportStaticContent()

  assert.equal(contents.length, 24)
  assert.deepEqual(auditContentMetadata(contents), [])
})
