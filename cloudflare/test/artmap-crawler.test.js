import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  detectTargetRegion,
  inferArchiveType,
  normalizeArchiveType,
  parseArtmapDetail,
  parseArtmapList,
} from '../src/artmap-crawler.js'

describe('parseArtmapList', () => {
  it('parses current Artmap list cards', () => {
    const html = `
      <div class='wrap' id='wrap_0'>
        <a href='view.php?idx=32092'>
          <div class='new_exh_list'>
            <span id='ttl_4'>2025 오지호미술상 수상작가전</span><br/>
            <span>광주시립미술관/광주</span><br/>
            <span>2026.01.30 ~ 2026.04.12</span>
            <span class='mck' style='display:none;'>
              <input type='checkbox' name='maps[]' id='mapc32092' onclick='push_val("2025 오지호미술상 수상작가전", 35.1808412, 126.8824016, 32092, "광주시립미술관/광주", 14,"https://art-map.co.kr/poster.jpg")'>
            </span>
          </div>
        </a>
      </div>
    `

    const [record] = parseArtmapList(html, 'end')

    assert.equal(record.externalId, '32092')
    assert.equal(record.title, '2025 오지호미술상 수상작가전')
    assert.equal(record.venueName, '광주시립미술관')
    assert.equal(record.regionLabel, '광주')
    assert.equal(record.startDate, '2026-01-30')
    assert.equal(record.endDate, '2026-04-12')
    assert.equal(record.lat, 35.1808412)
    assert.equal(record.lng, 126.8824016)
    assert.equal(record.thumbnailUrl, 'https://art-map.co.kr/poster.jpg')
  })

  it('is resilient to input attribute ordering and date separators', () => {
    const html = `
      <a href="/exhibition/view.php?idx=32331">
        <div class="new_exh_list">
          <span>전남도립미술관/전남</span>
          <span>2026-04-07 ~ 2026-07-19</span>
          <input onclick='push_val("쿤 반 덴 브룩 《지구의 피부》", 34.967953, 127.5890074, "", "전남도립미술관/전남", 1396, "/poster.jpg")' id="mapc32331" type="checkbox">
        </div>
      </a>
    `

    const [record] = parseArtmapList(html, 'ing')

    assert.equal(record.externalId, '32331')
    assert.equal(record.startDate, '2026-04-07')
    assert.equal(record.endDate, '2026-07-19')
    assert.equal(record.thumbnailUrl, 'https://art-map.co.kr/poster.jpg')
  })

  it('preserves angle-bracket title text from JavaScript args', () => {
    const html = `
      <a href='view.php?idx=32188'>
        <span>2026.03.12 ~ 2026.05.31</span>
        <input id='mapc32188' onclick='push_val("김창열 개인전 < 물방울, 존재를 묻다 >", 35.8162793, 127.1409138, 32188, "아트이슈프로젝트/전북", 4919, "/poster.jpg")'>
      </a>
    `

    const [record] = parseArtmapList(html, 'end')

    assert.equal(record.title, '김창열 개인전 < 물방울, 존재를 묻다 >')
  })
})

describe('parseArtmapDetail', () => {
  it('extracts venue detail fields', () => {
    const html = `
      <table>
        <tr><th>장소</th><td>국립아시아문화전당(ACC)/광주</td></tr>
        <tr><th>주소</th><td>광주 동구 문화전당로 38</td></tr>
        <tr><th>작가</th><td>박치호 · 정광희</td></tr>
        <tr><th>사이트</th><td><a href="/external">바로가기</a></td></tr>
      </table>
      <pre>전시 소개<br>두 번째 줄</pre>
    `

    const detail = parseArtmapDetail(html)

    assert.equal(detail.venueName, '국립아시아문화전당(ACC)')
    assert.equal(detail.regionLabel, '광주')
    assert.equal(detail.address, '광주 동구 문화전당로 38')
    assert.deepEqual(detail.artists, ['박치호', '정광희'])
    assert.equal(detail.externalUrl, 'https://art-map.co.kr/external')
    assert.equal(detail.description, '전시 소개 두 번째 줄')
  })
})

describe('detectTargetRegion', () => {
  it('matches priority venues from D1 even when punctuation differs', () => {
    const region = detectTargetRegion({
      title: 'ACC NEXT 아시아 신진 작가전',
      venueName: '국립아시아문화전당(ACC)',
      cityHint: '',
      address: '',
      regionLabel: '',
    }, [{
      city: 'gwangju',
      cityLabel: '광주',
      terms: ['국립아시아문화전당ACC'],
    }])

    assert.equal(region.city, 'gwangju')
    assert.equal(region.cityLabel, '광주')
    assert.equal(region.confidence, 'high')
  })

  it('matches a candidate venue spelling variant via aliases (서학동사진관)', () => {
    const region = detectTargetRegion({
      title: '김지연 사진전 : 매몰',
      venueName: '서학동사진관',
      regionLabel: '전북',
    })

    assert.equal(region.city, 'jeonju')
    assert.equal(region.confidence, 'high')
  })

  it('includes alternative art spaces at high confidence', () => {
    const ddf = detectTargetRegion({ title: '전시', venueName: 'SPACE DDF', regionLabel: '' })
    assert.equal(ddf.city, 'gwangju')
    assert.equal(ddf.confidence, 'high')

    const ugro = detectTargetRegion({ title: '전시', venueName: '미테우그로' })
    assert.equal(ugro.city, 'gwangju')
    assert.equal(ugro.confidence, 'high')
  })

  it('reports medium confidence when only a region keyword matches', () => {
    const region = detectTargetRegion({ title: 'x', venueName: '전남도립미술관', regionLabel: '전남' })

    assert.equal(region.city, 'jeonnam')
    assert.equal(region.confidence, 'medium')
  })

  it('includes 전북 in scope and labels the specific 시군', () => {
    const jeonbuk = detectTargetRegion({ title: 'x', venueName: '전북도립미술관', regionLabel: '전북' })
    assert.equal(jeonbuk.city, 'jeonju')
    assert.equal(jeonbuk.cityLabel, '전북')

    const gunsan = detectTargetRegion({ title: 'x', venueName: '어느갤러리', address: '전북 군산시 어딘가' })
    assert.equal(gunsan.city, 'jeonju')
    assert.equal(gunsan.cityLabel, '군산')
  })

  it('marks records outside 광주·전북·전남 for dropping', () => {
    const region = detectTargetRegion({ title: 'x', venueName: '서울시립미술관', address: '서울 중구', regionLabel: '서울' })

    assert.equal(region.city, 'unknown')
    assert.equal(region.outOfScope, true)
  })

  it('keeps an unknown venue with no disqualifying region for review', () => {
    const region = detectTargetRegion({ title: '어떤 전시', venueName: '무명갤러리', regionLabel: '' })

    assert.equal(region.city, 'unknown')
    assert.equal(region.outOfScope, false)
  })
})

describe('inferArchiveType', () => {
  it('classifies screenings by venue and keyword', () => {
    assert.equal(inferArchiveType({ title: '독립영화 상영회', venueName: '광주극장' }), 'screening')
    assert.equal(inferArchiveType({ title: '시네마 토크' }, { description: '영화제 상영 프로그램' }), 'screening')
  })

  it('classifies workshops by keyword', () => {
    assert.equal(inferArchiveType({ title: '사진 워크숍 참가자 모집' }), 'workshop')
  })

  it('defaults to exhibition', () => {
    assert.equal(inferArchiveType({ title: '회화 개인전', venueName: '은암미술관' }), 'exhibition')
  })

  it('normalizes unsupported types back to exhibition', () => {
    assert.equal(normalizeArchiveType('performance'), 'exhibition')
    assert.equal(normalizeArchiveType('screening'), 'screening')
  })
})
