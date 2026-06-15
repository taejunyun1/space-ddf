import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseDateRange, extractExhibitions } from '../lib/horang-parse.mjs'
import { parseHouseCurrent } from '../lib/house-parse.mjs'

describe('parseDateRange', () => {
  it('parses an abbreviated end date (inherits year/month)', () => {
    assert.deepEqual(parseDateRange('2026. 06. 09. ~ 06. 21.'), { start: '2026-06-09', end: '2026-06-21' })
  })

  it('parses a full end date', () => {
    assert.deepEqual(parseDateRange('2026. 05. 12. ~ 2026. 06. 14.'), { start: '2026-05-12', end: '2026-06-14' })
  })

  it('rolls the end into the next year when it would precede the start', () => {
    assert.deepEqual(parseDateRange('2025. 12. 20. ~ 01. 10.'), { start: '2025-12-20', end: '2026-01-10' })
  })

  it('returns null when there is no date range', () => {
    assert.equal(parseDateRange('빛의 공간 속으로'), null)
  })
})

describe('extractExhibitions', () => {
  it('pairs title / artist / date blocks and skips section headers', () => {
    const text = [
      'CURRENT EXHIBITION',
      '빛의 공간 속으로',
      '이순행',
      '2026. 06. 09. ~ 06. 21.',
      '애도하는 궤',
      '김기린 선화',
      '2026. 06. 05. ~ 06. 18.',
    ].join('\n')

    const out = extractExhibitions(text)
    assert.equal(out.length, 2)
    assert.deepEqual(out[0], { title: '빛의 공간 속으로', artists: ['이순행'], startDate: '2026-06-09', endDate: '2026-06-21' })
    assert.equal(out[1].title, '애도하는 궤')
    assert.deepEqual(out[1].artists, ['김기린 선화'])
  })
})

describe('parseHouseCurrent', () => {
  it('extracts the bracketed title, trailing artist, and 📅 date', () => {
    const text = [
      '< Back',
      '2026 예술공간 집 기획展 정승원',
      '[우리가 사랑한 날들 The Days We Loved ]',
      '📅 2026.6.17. ~ 7.5. *월 휴관',
      '⏱️ 10:00~18:00',
    ].join('\n')

    assert.deepEqual(parseHouseCurrent(text), {
      title: '우리가 사랑한 날들 The Days We Loved',
      artists: ['정승원'],
      startDate: '2026-06-17',
      endDate: '2026-07-05',
    })
  })

  it('returns null when no exhibition is present', () => {
    assert.equal(parseHouseCurrent('Home\nABOUT US\nEXHIBITIONS'), null)
  })
})
