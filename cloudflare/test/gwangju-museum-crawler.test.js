import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseGwangjuMuseumDetail,
  parseGwangjuMuseumList,
} from '../src/gwangju-museum-crawler.js'

describe('parseGwangjuMuseumList', () => {
  it('parses official exhibition cards and dedupes responsive duplicates', () => {
    const html = `
      <a href="/pj/pjExhibit.php?pageID=artmuse0209000000&amp;action=view&amp;exhiCd=&amp;exhiTp=N&amp;lang=KOR&amp;eSeq=927">
        <div class="img"><img src="/upload/pj/PJ_EXHIBIT/1776837666434182.jpg" alt="2026 민주인권평화전 상세페이지 이동"></div>
        <span class="title">2026 민주인권평화전 [강요배: 시간을 품다]</span>
        <li><span>· 기간</span><p>2026.05.08 ~ 2026.09.27</p></li>
        <li><span>· 장소</span><p>시립미술관 본관 제1, 2전시실</p></li>
      </a>
      <a href="/pj/pjExhibit.php?pageID=artmuse0209000000&amp;action=view&amp;eSeq=927">
        <span class="title">2026 민주인권평화전 ...</span>
        <li>2026.05.08 ~ 2026.09.27</li>
      </a>
    `

    const records = parseGwangjuMuseumList(html, { type: 'N', fallbackStatus: 'ongoing' })

    assert.equal(records.length, 1)
    assert.equal(records[0].externalId, '927')
    assert.equal(records[0].title, '2026 민주인권평화전 [강요배: 시간을 품다]')
    assert.equal(records[0].venueName, '광주시립미술관')
    assert.equal(records[0].startDate, '2026-05-08')
    assert.equal(records[0].endDate, '2026-09-27')
    assert.equal(records[0].thumbnailUrl, 'https://artmuse.gwangju.go.kr/upload/pj/PJ_EXHIBIT/1776837666434182.jpg')
  })

  it('skips placeholder cards', () => {
    const html = `
      <a href="/pj/pjExhibit.php?action=view&amp;eSeq=865">
        <span class="title">다음 전시회를 준비중입니다.</span>
        <li><span>· 기간</span><p>2024.01.01 ~ 2024.12.31</p></li>
        <li><span>· 장소</span><p>시립미술관 본관</p></li>
      </a>
    `

    assert.equal(parseGwangjuMuseumList(html, { type: 'P', fallbackStatus: 'closed' }).length, 0)
  })
})

describe('parseGwangjuMuseumDetail', () => {
  it('extracts detail description and artists', () => {
    const html = `
      <h3>2026 하정웅미술관 청년작가초대전</h3>
      <span>· 장소</span><p>하정웅미술관 제1~3전시실</p>
      <span>· 출품작가</span><p>강철규, 김자이 · 장미</p>
      <h5>기획의도</h5>
      <p>청년작가 초대전 기획 설명</p>
      <h5>전시내용</h5>
      <p>전시 본문</p>
    `

    const detail = parseGwangjuMuseumDetail(html)

    assert.equal(detail.venueText, '하정웅미술관 제1~3전시실')
    assert.deepEqual(detail.artists, ['강철규', '김자이', '장미'])
    assert.match(detail.description, /청년작가 초대전/)
    assert.match(detail.description, /전시 본문/)
  })
})
