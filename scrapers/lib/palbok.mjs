// 팔복예술공장 (전주, 전북). Server-rendered listing: each item has a
// class="list-junbox-d2" title and a "일정 : YYYY-MM-DD ~ YYYY-MM-DD" range.
// robots.txt allows /main/. No browser needed.

const LIST_URL = 'https://palbokart.kr/main/inner.php?sMenu=B1000'

function unescapeHtml(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
}

function iso(d) {
  const m = String(d).match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/)
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : ''
}

export function parsePalbokList(html) {
  const out = []
  const segments = String(html).split('class="list-junbox-d2"').slice(1)

  for (const seg of segments) {
    const titleMatch = seg.match(/[^>]*>([^<]+)/)
    const title = titleMatch ? unescapeHtml(titleMatch[1]).trim() : ''
    const text = unescapeHtml(seg.replace(/<[^>]+>/g, ' '))
    const dateMatch = text.match(/(\d{4}[.-]\d{1,2}[.-]\d{1,2})\s*[~-]\s*(\d{4}[.-]\d{1,2}[.-]\d{1,2})/)
    if (!title || !dateMatch) continue

    out.push({ title, startDate: iso(dateMatch[1]), endDate: iso(dateMatch[2]) })
  }

  return out
}

export async function scrapePalbok() {
  const res = await fetch(LIST_URL, {
    headers: { 'user-agent': 'SpaceDDFArchiveScraper/1.0 (+https://spaceddf.xyz)', accept: 'text/html' },
  })
  if (!res.ok) throw new Error(`palbok fetch failed: ${res.status}`)

  return parsePalbokList(await res.text()).map((e) => ({
    title: e.title,
    venue: '팔복예술공장',
    city: 'jeonju',
    cityLabel: '전주',
    address: '전북특별자치도 전주시 덕진구 구렛들1길 46',
    lat: 35.8703,
    lng: 127.1003,
    startDate: e.startDate,
    endDate: e.endDate,
    sourceUrl: LIST_URL,
    sourceName: '팔복예술공장',
  }))
}
