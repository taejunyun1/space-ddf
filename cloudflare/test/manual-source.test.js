import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildManualExhibition } from '../src/manual-source.js'

describe('buildManualExhibition', () => {
  it('normalizes a manual submission into an exhibition record', () => {
    const r = buildManualExhibition({
      title: '<미완결을 성취하는 법> 신수와 개인전',
      venue: '스페이스 디디에프',
      city: 'gwangju',
      address: '광주광역시 동구 충장로46번길 8-8 1층',
      lat: 35.150331,
      lng: 126.909882,
      startDate: '2025.09.30',
      endDate: '2025.10.12',
      artists: '신수와',
      sourceUrl: 'https://www.spaceddf.xyz/shows/suwa',
    })

    assert.equal(r.sourceType, 'manual')
    assert.equal(r.city, 'gwangju')
    assert.equal(r.cityLabel, '광주')
    assert.equal(r.startDate, '2025-09-30')
    assert.equal(r.endDate, '2025-10-12')
    assert.equal(r.archiveType, 'exhibition')
    assert.equal(r.regionConfidence, 'high')
    assert.equal(r.visibility, 'public')
    assert.deepEqual(r.artists, ['신수와'])
    assert.equal(r.lat, 35.150331)
    assert.equal(r.dedupeKey.split('|').length, 3)
  })

  it('infers workshop / screening types from the title', () => {
    assert.equal(buildManualExhibition({ title: '사진 워크숍', venue: '뽕뽕브릿지' }).archiveType, 'workshop')
    assert.equal(buildManualExhibition({ title: '독립영화 상영회', venue: '광주극장' }).archiveType, 'screening')
  })

  it('requires title and venue', () => {
    assert.throws(() => buildManualExhibition({ venue: 'x' }), /title is required/)
    assert.throws(() => buildManualExhibition({ title: 'x' }), /venue is required/)
  })

  it('drops an unsupported city back to gwangju default and keeps a custom cityLabel', () => {
    const r = buildManualExhibition({ title: 't', venue: 'v', city: 'seoul', cityLabel: '광주 동구' })
    assert.equal(r.city, 'gwangju')
    assert.equal(r.cityLabel, '광주 동구')
  })
})
