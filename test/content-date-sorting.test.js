import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareByRangeAsc,
  parseDateRange,
  sortKeyFromRange,
} from '../src/stores/lib/date-helpers.js'

test('dot dates accept a trailing period', () => {
  const parsed = parseDateRange('2026.08.01. - 2026.08.12.')

  assert.equal(parsed.start?.getFullYear(), 2026)
  assert.equal(parsed.start?.getMonth(), 7)
  assert.equal(parsed.start?.getDate(), 1)
  assert.equal(parsed.end?.getDate(), 12)
})

test('managed startDate takes priority over the display date range', () => {
  const key = sortKeyFromRange({
    startDate: '2026-08-01',
    endDate: '2026-08-12',
    dateRange: '날짜 표기 없음',
  })

  const start = new Date(key.start)
  const end = new Date(key.end)

  assert.deepEqual(
    [start.getFullYear(), start.getMonth() + 1, start.getDate()],
    [2026, 8, 1],
  )
  assert.deepEqual(
    [end.getFullYear(), end.getMonth() + 1, end.getDate()],
    [2026, 8, 12],
  )
})

test('descending comparison places the latest managed show first', () => {
  const shows = [
    { title: '2025', dateRange: '2025.11.07 - 2025.11.12' },
    {
      title: '멸망 언박싱',
      startDate: '2026-08-01',
      endDate: '2026-08-12',
    },
  ]

  shows.sort((a, b) => compareByRangeAsc(b, a))

  assert.equal(shows[0].title, '멸망 언박싱')
})
