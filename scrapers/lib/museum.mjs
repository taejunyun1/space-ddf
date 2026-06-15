// 광주시립미술관: the official site blocks Cloudflare Worker IPs (always 0 records
// from the Worker), but a plain fetch from GitHub's runners works. Reuse the
// existing list parser and map to manual-API items. No browser needed.

import { parseGwangjuMuseumList } from '../../cloudflare/src/gwangju-museum-crawler.js'

const BASE = 'https://artmuse.gwangju.go.kr'
const TYPES = [
  { type: 'N', pageId: 'artmuse0209000000', fallbackStatus: 'ongoing' },
  { type: 'F', pageId: 'artmuse0210000000', fallbackStatus: 'upcoming' },
  { type: 'P', pageId: 'artmuse0211000000', fallbackStatus: 'closed' },
]
// Main building coordinate; used when a branch venue has no known location.
const DEFAULT_COORD = { lat: 35.1808412, lng: 126.8824016 }

function listUrl(t, page) {
  const params = new URLSearchParams({ action: 'list', pageID: t.pageId, exhiCd: '', exhiTp: t.type, lang: 'KOR' })
  if (page > 1) params.set('movePage', String(page))
  return `${BASE}/pj/pjExhibit.php?${params.toString()}`
}

export async function scrapeGwangjuMuseum({ sinceYear = 2024, maxPagesPast = 3 } = {}) {
  const items = []
  const seen = new Set()
  const sinceDate = `${sinceYear}-01-01`

  for (const t of TYPES) {
    const pages = t.type === 'P' ? maxPagesPast : 1
    for (let page = 1; page <= pages; page += 1) {
      const res = await fetch(listUrl(t, page), {
        headers: { 'user-agent': 'Mozilla/5.0 SpaceDDFArchiveScraper/1.0 (+https://www.spaceddf.xyz)', accept: 'text/html' },
      })
      if (!res.ok) break
      const records = parseGwangjuMuseumList(await res.text(), t)
      if (!records.length) break

      for (const r of records) {
        if (seen.has(r.externalId)) continue
        seen.add(r.externalId)
        if (t.type === 'P' && r.endDate && r.endDate < sinceDate) continue

        items.push({
          title: r.title,
          venue: r.venueName || '광주시립미술관',
          city: 'gwangju',
          cityLabel: '광주',
          lat: r.lat ?? DEFAULT_COORD.lat,
          lng: r.lng ?? DEFAULT_COORD.lng,
          startDate: r.startDate,
          endDate: r.endDate,
          sourceUrl: r.sourceUrl,
          sourceName: '광주시립미술관',
        })
      }
    }
  }

  return items
}
