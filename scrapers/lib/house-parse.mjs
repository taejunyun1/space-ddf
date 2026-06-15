// 예술공간 집 (Wix) current-exhibition page. Unlike 호랑 (a clean list), 집 shows
// one current exhibition per page:
//   2026 예술공간 집 기획展 정승원      ← artist trails the 展 label
//   [우리가 사랑한 날들 The Days We Loved]  ← title in brackets
//   📅 2026.6.17. ~ 7.5.                  ← date range
import { parseDateRange } from './horang-parse.mjs'

export function parseHouseCurrent(innerText) {
  const lines = String(innerText || '').split('\n').map((l) => l.trim()).filter(Boolean)

  const titleLine = lines.find((l) => /\[.+\]/.test(l))
  const title = titleLine ? titleLine.replace(/[[\]]/g, '').trim() : ''

  const dateLine = lines.find((l) => parseDateRange(l))
  const range = dateLine ? parseDateRange(dateLine) : null

  const artistLine = lines.find((l) => /[展]\s*\S/.test(l) && /(기획|개인|초대|단체)?\s*展/.test(l))
  const artistMatch = artistLine ? artistLine.match(/展\s+([가-힣A-Za-z·,\s]{2,24})$/) : null
  const artist = artistMatch ? artistMatch[1].trim() : ''

  if (!title || !range) return null
  return { title, artists: artist ? [artist] : [], startDate: range.start, endDate: range.end }
}
