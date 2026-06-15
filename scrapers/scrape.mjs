// Free scheduled scraper for venues whose exhibition data needs JS rendering.
// Runs headless Chromium (GitHub Actions), extracts exhibitions, and POSTs them
// to the Worker's manual ingestion API. No Cloudflare cost.
//
//   API_BASE       Worker base URL (default: production)
//   CRAWL_SECRET   x-crawl-secret for POST /api/archive/manual (required to write)
//   DRY_RUN=1      print records instead of POSTing
//
// Add a venue: append to VENUES with its rendered-page URL, location, and the
// section anchors. The extractor (extractExhibitions) is reused across Google
// Sites-style venues; add a per-venue extractor only if the layout differs.

import { chromium } from 'playwright'
import { extractExhibitions } from './lib/horang-parse.mjs'

const API_BASE = process.env.API_BASE || 'https://space-ddf-archive-api.taejunyun.workers.dev'
const CRAWL_SECRET = process.env.CRAWL_SECRET || ''
const DRY_RUN = process.env.DRY_RUN === '1' || !CRAWL_SECRET

const VENUES = [
  {
    id: 'horang-art-polygon',
    venue: '호랑가시나무 아트폴리곤',
    city: 'gwangju',
    cityLabel: '광주',
    address: '광주광역시 남구 제중로47번길 22',
    lat: 35.1386744,
    lng: 126.9126491,
    url: 'https://www.horang.art/art-polygon/exhibition/current',
    sourceUrl: 'https://www.horang.art/art-polygon/exhibition/current',
    sectionStart: /CURRENT EXHIBITION/i,
    sectionEnd: /Home\s+Creative Studio|Copyright/i,
    extract: extractExhibitions,
  },
]

async function renderText(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1500)
  return page.evaluate(() => document.body.innerText)
}

function sliceSection(text, startRe, endRe) {
  let body = text
  const s = startRe ? body.search(startRe) : -1
  if (s >= 0) body = body.slice(s)
  if (endRe) {
    const e = body.search(endRe)
    if (e >= 0) body = body.slice(0, e)
  }
  return body
}

async function postManual(items) {
  const res = await fetch(`${API_BASE}/api/archive/manual`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-crawl-secret': CRAWL_SECRET },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(`manual POST failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ userAgent: 'SpaceDDFArchiveScraper/1.0 (+https://www.spaceddf.xyz)' })
  let total = 0

  try {
    for (const v of VENUES) {
      const text = await renderText(page, v.url)
      const section = sliceSection(text, v.sectionStart, v.sectionEnd)
      const exhibitions = v.extract(section)

      const items = exhibitions.map((e) => ({
        title: e.title,
        venue: v.venue,
        city: v.city,
        cityLabel: v.cityLabel,
        address: v.address,
        lat: v.lat,
        lng: v.lng,
        startDate: e.startDate,
        endDate: e.endDate,
        artists: e.artists,
        sourceUrl: v.sourceUrl,
      }))

      console.log(`[${v.id}] extracted ${items.length} exhibitions`)
      for (const it of items) console.log(`   • ${it.startDate}~${it.endDate} | ${it.title} | ${(it.artists || []).join(', ')}`)

      if (!items.length) continue

      if (DRY_RUN) {
        console.log(`[${v.id}] DRY_RUN — not posting`)
      } else {
        const r = await postManual(items)
        console.log(`[${v.id}] posted: ${r.imported}`)
        total += r.imported || 0
      }
    }
  } finally {
    await browser.close()
  }

  console.log(DRY_RUN ? 'dry run complete' : `done — imported ${total}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
