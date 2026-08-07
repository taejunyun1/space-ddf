import test from 'node:test'
import assert from 'node:assert/strict'
import { selectCurrentShow, sortByPublishedAtDesc } from '../src/lib/home-content.js'

test('current hero only selects an active Show', () => {
  const now = new Date('2026-08-07T03:00:00.000Z')
  const active = { type: 'show', slug: 'active', startDate: '2026-08-01', endDate: '2026-08-12' }
  const ended = { type: 'show', slug: 'ended', startDate: '2026-07-01', endDate: '2026-07-12' }
  const project = { type: 'project', slug: 'project', startDate: '2026-08-01', endDate: '2026-08-12' }

  assert.equal(selectCurrentShow([ended, active], project, now), active)
  assert.equal(selectCurrentShow([ended], ended, now), null)
})

test('an active featured Show wins the hero selection', () => {
  const now = new Date('2026-08-07T03:00:00.000Z')
  const first = { type: 'show', slug: 'first', startDate: '2026-08-01', endDate: '2026-08-12' }
  const featured = { type: 'show', slug: 'featured', startDate: '2026-08-02', endDate: '2026-08-10' }

  assert.equal(selectCurrentShow([first, featured], featured, now), featured)
})

test('Recent Updated sorts managed content by publication time before exhibition dates', () => {
  const newlyPublishedArchive = { slug: 'old-show', publishedAt: '2026-08-07T09:00:00Z', startDate: '2021-01-01' }
  const olderPublication = { slug: 'new-show', publishedAt: '2026-08-06T09:00:00Z', startDate: '2026-08-01' }

  assert.deepEqual(
    sortByPublishedAtDesc([olderPublication, newlyPublishedArchive]).map(item => item.slug),
    ['old-show', 'new-show'],
  )
})
