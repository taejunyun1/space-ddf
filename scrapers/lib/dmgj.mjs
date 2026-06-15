// 디어마이광주 (광주 통합 문화플랫폼) 전시 목록.
// IMPORTANT: dmgj.kr/robots.txt disallows /event.es but ALLOWS /menu.es. The
// menu.es page server-renders the same first-page listing, so we crawl the
// allowed path only (no pagination via event.es). Supplementary 광주 source.

import https from 'node:https'
import { parseDateRange } from './horang-parse.mjs'

// p_cate=0302 = 전시 category. menu.es is robots-allowed; event.es is not.
const LIST_URL = 'https://dmgj.kr/menu.es?mid=a10302000000&p_cate=0302'
const DETAIL_BASE = 'https://dmgj.kr'

// dmgj.kr serves an incomplete TLS chain (omits the intermediate cert), which
// curl/browsers tolerate via AIA fetching but Node rejects with
// UNABLE_TO_VERIFY_LEAF_SIGNATURE. Relax verification ONLY for this read-only
// public listing fetch (no credentials, non-sensitive data) via node:https.
function fetchListingHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        headers: { 'user-agent': 'SpaceDDFArchiveScraper/1.0 (+https://www.spaceddf.xyz)', accept: 'text/html' },
      },
      (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          res.resume()
          reject(new Error(`dmgj fetch failed: ${res.statusCode}`))
          return
        }
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve(data))
      },
    )
    req.on('error', reject)
    req.setTimeout(25000, () => req.destroy(new Error('dmgj fetch timeout')))
  })
}

function unescapeHtml(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

export function parseDmgjList(html) {
  const out = []
  const blocks = String(html).match(/<li\b[\s\S]*?<\/li>/g) || []

  for (const block of blocks) {
    const titleMatch = block.match(/info_tit[^>]*>([^<]+)/)
    if (!titleMatch) continue
    const title = unescapeHtml(titleMatch[1]).trim()

    const segments = unescapeHtml(block.replace(/<[^>]+>/g, '\n'))
      .split('\n').map((s) => s.trim()).filter(Boolean)

    const dateIdx = segments.findIndex((s) => parseDateRange(s))
    if (dateIdx < 0) continue
    const range = parseDateRange(segments[dateIdx])

    // Venue is the segment immediately before the date (and not the title).
    const prev = segments[dateIdx - 1]
    const venue = prev && prev !== title ? prev : ''
    if (!venue) continue

    const hrefMatch = block.match(/href="([^"]*event\.es[^"]*)"/)
    const href = hrefMatch ? `${DETAIL_BASE}${unescapeHtml(hrefMatch[1])}` : LIST_URL

    out.push({ title, venue, startDate: range.start, endDate: range.end, sourceUrl: href })
  }

  return out
}

export async function scrapeDmgj() {
  const html = await fetchListingHtml(LIST_URL)

  return parseDmgjList(html).map((e) => ({
    title: e.title,
    venue: e.venue,
    city: 'gwangju',
    cityLabel: '광주',
    startDate: e.startDate,
    endDate: e.endDate,
    sourceUrl: e.sourceUrl,
    sourceName: '디어마이광주',
  }))
}
