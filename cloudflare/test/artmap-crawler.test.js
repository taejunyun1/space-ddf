import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  detectTargetRegion,
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
  })
})
