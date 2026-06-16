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
import { parseHouseCurrent } from './lib/house-parse.mjs'
import { extractGmap } from './lib/gmap-parse.mjs'
import { scrapeGwangjuMuseum } from './lib/museum.mjs'
import { scrapePalbok } from './lib/palbok.mjs'
// import { scrapeDmgj } from './lib/dmgj.mjs' // disabled — robots (see fetchSources)

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
  {
    id: 'artspace-house',
    venue: '예술공간 집',
    city: 'gwangju',
    cityLabel: '광주',
    address: '광주광역시 동구 제봉로158번길 11-5',
    lat: 35.1518319,
    lng: 126.9198964,
    sourceUrl: 'https://www.artspacehouse.com',
    // Wix site: one current exhibition per page. Navigate home → "NOW" link.
    customScrape: async (page) => {
      await page.goto('https://www.artspacehouse.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(2500)
      const href = await page.evaluate(() => {
        const a = [...document.querySelectorAll('a')].find((el) => /(^|\s)NOW(\s|$)/i.test((el.innerText || '').trim()))
        return a ? a.href : null
      })
      if (href) {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForTimeout(2500)
      }
      const text = await page.evaluate(() => document.body.innerText)
      const rec = parseHouseCurrent(text)
      return rec ? [rec] : []
    },
  },
  {
    id: 'gmap',
    venue: '광주미디어아트플랫폼',
    city: 'gwangju',
    cityLabel: '광주',
    address: '광주광역시 동구 천변우로 415',
    lat: 35.1484274,
    lng: 126.9093966,
    url: 'https://gmap.gwangju.go.kr/',
    sourceUrl: 'https://gmap.gwangju.go.kr/',
    sectionEnd: /DOCENT/i,
    extract: extractGmap,
  },
]

async function renderText(page, url) {
  // 'networkidle' frequently times out on sites with continuous background
  // requests (Google Sites/Wix analytics). 'domcontentloaded' + a settle wait
  // is far more reliable in CI.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
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
  // --no-sandbox is required on GitHub Actions runners.
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  let total = 0
  let failures = 0

  try {
    for (const v of VENUES) {
      // Each venue is isolated: one site being down/slow must not abort the rest.
      try {
        const page = await browser.newPage({ userAgent: 'SpaceDDFArchiveScraper/1.0 (+https://www.spaceddf.xyz)' })
        let exhibitions
        try {
          if (v.customScrape) {
            exhibitions = await v.customScrape(page)
          } else {
            const text = await renderText(page, v.url)
            exhibitions = v.extract(sliceSection(text, v.sectionStart, v.sectionEnd))
          }
        } finally {
          await page.close()
        }

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
        if (items.length && !DRY_RUN) {
          const r = await postManual(items)
          console.log(`[${v.id}] posted: ${r.imported}`)
          total += r.imported || 0
        }
      } catch (err) {
        failures += 1
        console.error(`[${v.id}] failed: ${err.message}`)
      }
    }
  } finally {
    await browser.close()
  }

  // Fetch-based sources (no browser). These sites block Cloudflare Worker IPs
  // but respond to GitHub's runners.
  const fetchSources = [
    { id: 'gwangju-museum', run: () => scrapeGwangjuMuseum({ sinceYear: 2024, maxPagesPast: 3 }) },
    { id: 'palbok', run: () => scrapePalbok() },
    // DMGJ disabled: /menu.es (robots-allowed) 302-redirects to /event.es
    // (robots-DISALLOWED), so the listing is only reachable by crawling a
    // disallowed path. Respect robots — re-enable only with site permission.
    // { id: 'dmgj', run: () => scrapeDmgj() },
  ]

  for (const src of fetchSources) {
    try {
      const items = await src.run()
      console.log(`[${src.id}] extracted ${items.length} exhibitions`)
      if (items.length && !DRY_RUN) {
        const r = await postManual(items)
        console.log(`[${src.id}] posted: ${r.imported}`)
        total += r.imported || 0
      }
    } catch (err) {
      failures += 1
      console.error(`[${src.id}] failed: ${err.message}`)
    }
  }

  console.log(DRY_RUN ? `dry run complete (${failures} source failures)` : `done — imported ${total}, ${failures} source failures`)

  // Surface a fully-broken run, but tolerate partial source failures so one
  // flaky site doesn't red-X the whole schedule.
  if (failures && total === 0 && !DRY_RUN) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
