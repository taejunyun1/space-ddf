import {
  enrichRecord,
  fetchWithRetry,
  linkExhibitionSource,
  normalizeForKey,
  replaceExhibitionMetadata,
  statusFromDates,
  upsertExhibition,
  upsertSourceRecord,
  upsertVenue,
} from './artmap-crawler.js'

const GMA_BASE_URL = 'https://artmuse.gwangju.go.kr'
const GMA_SOURCE_ID = 'gwangju-museum-of-art'
const GMA_SOURCE_NAME = '광주시립미술관'
const DEFAULT_FETCH_RETRIES = 2
const DEFAULT_FETCH_TIMEOUT_MS = 12000
const DEFAULT_RETRY_DELAY_MS = 350
const DEFAULT_MAX_PAGES = {
  N: 2,
  F: 2,
  P: 8,
}
const GMA_LIST_TYPES = [
  { type: 'N', pageId: 'artmuse0209000000', fallbackStatus: 'ongoing' },
  { type: 'F', pageId: 'artmuse0210000000', fallbackStatus: 'upcoming' },
  { type: 'P', pageId: 'artmuse0211000000', fallbackStatus: 'closed' },
]

const VENUE_HINTS = [
  {
    pattern: /하정웅/,
    venueName: '하정웅미술관',
    address: '광주광역시 서구 상무대로 1165',
    regional: true,
  },
  {
    pattern: /어린이/,
    venueName: '어린이미술관',
    address: '광주광역시 북구 하서로 52',
    lat: 35.1808412,
    lng: 126.8824016,
    regional: true,
  },
  {
    pattern: /G&J|광주전남갤러리/i,
    venueName: 'G&J갤러리',
    regional: true,
  },
  {
    pattern: /금남로/,
    venueName: '금남로분관',
    regional: true,
  },
  {
    pattern: /시립미술관|본관|광주시립미술관/,
    venueName: '광주시립미술관',
    address: '광주광역시 북구 하서로 52',
    lat: 35.1808412,
    lng: 126.8824016,
    regional: true,
  },
]

export async function crawlGwangjuMuseum(env, options = {}) {
  const runId = `gwangju-museum-${Date.now()}`
  const sinceYear = Number(options.sinceYear || 2024)
  const sinceDate = `${sinceYear}-01-01`
  const visibility = options.visibility || 'public'
  const maxPages = normalizeMaxPages(options.maxPages)
  const fetchOptions = {
    retries: positiveNumber(options.retries, DEFAULT_FETCH_RETRIES),
    timeoutMs: positiveNumber(options.timeoutMs, DEFAULT_FETCH_TIMEOUT_MS),
    retryDelayMs: positiveNumber(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS),
  }
  const startedAt = new Date().toISOString()
  const requestUrl = listUrl(GMA_LIST_TYPES[0], 1)
  const stats = {
    pages: { N: 0, F: 0, P: 0 },
    recordsFound: 0,
    recordsSaved: 0,
    exhibitionsSaved: 0,
    skippedOld: 0,
    skippedRegion: 0,
    detailErrors: 0,
    recordErrors: 0,
    errors: [],
  }

  await env.DB.prepare(`
    INSERT INTO crawl_runs (id, source_id, status, crawl_type, request_url, started_at)
    VALUES (?, ?, 'running', 'gwangju-museum-exhibitions', ?, ?)
  `).bind(runId, GMA_SOURCE_ID, requestUrl, startedAt).run()

  try {
    for (const listType of GMA_LIST_TYPES) {
      for (let page = 1; page <= (maxPages[listType.type] || 0); page += 1) {
        stats.pages[listType.type] += 1
        const html = await fetchGwangjuMuseumList(listType, page, fetchOptions)
        const records = parseGwangjuMuseumList(html, listType)
        if (!records.length) break

        stats.recordsFound += records.length

        for (const record of records) {
          try {
            await upsertSourceRecord(env, record)
            stats.recordsSaved += 1

            if (listType.type === 'P' && record.endDate && record.endDate < sinceDate) {
              stats.skippedOld += 1
              continue
            }

            const detail = await fetchGwangjuMuseumDetail(record.sourceUrl, fetchOptions)
              .catch(err => {
                stats.detailErrors += 1
                addErrorSample(stats, 'detail', record.externalId, err)
                return null
              })
            const venue = venueFromLocation(detail?.venueText || record.payload.location)
            if (!venue.regional) {
              stats.skippedRegion += 1
              continue
            }

            const enriched = enrichRecord({
              ...record,
              venueName: venue.venueName,
              normalizedVenueName: normalizeForKey(venue.venueName),
              lat: venue.lat ?? record.lat,
              lng: venue.lng ?? record.lng,
            }, {
              address: detail?.address || venue.address || '',
              venueName: venue.venueName,
              regionLabel: '광주',
              artists: detail?.artists || [],
              externalUrl: '',
              description: detail?.description || record.summary || '',
            }, {
              city: 'gwangju',
              cityLabel: '광주',
            }, visibility)

            await upsertVenue(env, enriched)
            const exhibitionId = await upsertExhibition(env, enriched)
            await linkExhibitionSource(env, exhibitionId, enriched.sourceRecordId)
            await replaceExhibitionMetadata(env, exhibitionId, enriched)
            stats.exhibitionsSaved += 1
          } catch (err) {
            stats.recordErrors += 1
            addErrorSample(stats, 'record', record.externalId, err)
          }
        }
      }
    }

    await env.DB.prepare(`
      UPDATE crawl_runs
      SET status = 'success',
          finished_at = ?,
          records_found = ?,
          records_saved = ?,
          metadata_json = ?
      WHERE id = ?
    `).bind(
      new Date().toISOString(),
      stats.recordsFound,
      stats.recordsSaved,
      JSON.stringify(stats),
      runId,
    ).run()

    return {
      ok: true,
      runId,
      recordsFound: stats.recordsFound,
      recordsSaved: stats.recordsSaved,
      exhibitionsSaved: stats.exhibitionsSaved,
      stats,
    }
  } catch (err) {
    await env.DB.prepare(`
      UPDATE crawl_runs
      SET status = 'failed',
          finished_at = ?,
          records_found = ?,
          records_saved = ?,
          error_message = ?,
          metadata_json = ?
      WHERE id = ?
    `).bind(
      new Date().toISOString(),
      stats.recordsFound,
      stats.recordsSaved,
      err instanceof Error ? err.message : String(err),
      JSON.stringify(stats),
      runId,
    ).run()

    throw err
  }
}

async function fetchGwangjuMuseumList(listType, page, fetchOptions) {
  const response = await fetchWithRetry(listUrl(listType, page), {
    headers: {
      'user-agent': 'Mozilla/5.0 SpaceDDFArchiveCrawler/1.0 (+https://www.spaceddf.xyz)',
      accept: 'text/html',
    },
  }, fetchOptions)

  if (!response.ok) {
    throw new Error(`Gwangju Museum list request failed: ${response.status}`)
  }

  return response.text()
}

async function fetchGwangjuMuseumDetail(url, fetchOptions) {
  const response = await fetchWithRetry(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 SpaceDDFArchiveCrawler/1.0 (+https://www.spaceddf.xyz)',
      accept: 'text/html',
    },
  }, fetchOptions)

  if (!response.ok) {
    throw new Error(`Gwangju Museum detail request failed: ${response.status}`)
  }

  return parseGwangjuMuseumDetail(await response.text())
}

export function parseGwangjuMuseumList(html, listType) {
  const recordsById = new Map()
  const anchorPattern = /<a\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/a>/gi
  let match

  while ((match = anchorPattern.exec(html)) !== null) {
    const block = match[0]
    const href = getAttribute(block, 'href')
    const sourceUrl = absoluteUrl(href)
    if (!sourceUrl) continue

    const externalId = new URL(sourceUrl).searchParams.get('eSeq') || ''
    if (!externalId || recordsById.has(externalId)) continue

    const title = cleanText(firstMatch(block, /<span[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))
    const periodMatch = block.match(/(\d{4})[.:-](\d{1,2})[.:-](\d{1,2})\s*~\s*(\d{4})[.:-](\d{1,2})[.:-](\d{1,2})/)
    if (!title || !periodMatch) continue
    if (isPlaceholderTitle(title)) continue

    const startDate = formatDate(periodMatch.slice(1, 4))
    const endDate = formatDate(periodMatch.slice(4, 7))
    const location = cleanText(firstMatch(block, /<span>\s*·?\s*장소\s*<\/span>\s*<p>([\s\S]*?)<\/p>/i))
    const venue = venueFromLocation(location)
    const imgTag = block.match(/<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/i)?.[0] || ''
    const thumbnailUrl = absoluteUrl(getAttribute(imgTag, 'src'))

    recordsById.set(externalId, {
      sourceRecordId: `${GMA_SOURCE_ID}-${externalId}`,
      sourceId: GMA_SOURCE_ID,
      externalId,
      sourceUrl,
      title,
      normalizedTitle: normalizeForKey(title),
      venueName: venue.venueName,
      normalizedVenueName: normalizeForKey(venue.venueName),
      regionLabel: '광주',
      cityHint: '광주',
      periodText: `${startDate} - ${endDate}`,
      startDate,
      endDate,
      status: statusFromDates(startDate, endDate, listType.fallbackStatus),
      lat: venue.lat ?? null,
      lng: venue.lng ?? null,
      thumbnailUrl,
      sourceName: GMA_SOURCE_NAME,
      sourceType: 'crawl',
      scrapedAt: new Date().toISOString(),
      summary: '',
      payload: {
        officialType: listType.type,
        location,
      },
    })
  }

  return [...recordsById.values()]
}

export function parseGwangjuMuseumDetail(html) {
  const title = cleanText(firstMatch(html, /<h\d[^>]*>([\s\S]*?)<\/h\d>/i))
  const venueText = cleanText(labelValue(html, '장소'))
  const description = cleanText([
    sectionText(html, '기획의도'),
    sectionText(html, '전시내용'),
  ].filter(Boolean).join(' '))
  const artists = cleanText(labelValue(html, '출품작가'))
    .split(/[,/·\n]/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 20)

  return {
    title,
    venueText,
    address: venueFromLocation(venueText).address || '',
    artists,
    description,
  }
}

function listUrl(listType, page) {
  const params = new URLSearchParams({
    action: 'list',
    pageID: listType.pageId,
    exhiCd: '',
    exhiTp: listType.type,
    lang: 'KOR',
  })
  if (page > 1) params.set('movePage', String(page))

  return `${GMA_BASE_URL}/pj/pjExhibit.php?${params.toString()}`
}

function normalizeMaxPages(maxPages = {}) {
  const singlePageLimit = Number(maxPages)
  if (Number.isFinite(singlePageLimit) && singlePageLimit > 0) {
    return { N: singlePageLimit, F: singlePageLimit, P: singlePageLimit }
  }

  return {
    N: positiveNumber(maxPages.N || maxPages.ing || maxPages.current, DEFAULT_MAX_PAGES.N),
    F: positiveNumber(maxPages.F || maxPages.exp || maxPages.upcoming, DEFAULT_MAX_PAGES.F),
    P: positiveNumber(maxPages.P || maxPages.end || maxPages.past, DEFAULT_MAX_PAGES.P),
  }
}

function venueFromLocation(location) {
  const text = cleanText(location)
  return VENUE_HINTS.find(venue => venue.pattern.test(text)) || {
    venueName: text || GMA_SOURCE_NAME,
    address: '',
    regional: false,
  }
}

function isPlaceholderTitle(title) {
  return /준비\s*중|준비중/.test(title)
}

function addErrorSample(stats, stage, externalId, err) {
  if (stats.errors.length >= 20) return
  stats.errors.push({
    stage,
    externalId: externalId ? String(externalId) : '',
    message: err instanceof Error ? err.message : String(err),
  })
}

function labelValue(html, label) {
  return firstMatch(html, new RegExp(`<span>\\s*·?\\s*${escapeRegExp(label)}\\s*<\\/span>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'))
}

function sectionText(html, label) {
  return firstMatch(html, new RegExp(`<h\\d[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/h\\d>([\\s\\S]*?)(?=<h\\d|<footer|<\\/main|$)`, 'i'))
}

function firstMatch(value, pattern) {
  const match = String(value || '').match(pattern)
  return match ? match[1] : ''
}

function getAttribute(tag, name) {
  const pattern = new RegExp(`${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = String(tag || '').match(pattern)
  return cleanText(match?.[1] || match?.[2] || match?.[3] || '')
}

function absoluteUrl(value) {
  const text = decodeEntities(String(value || '')).trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  if (text.startsWith('//')) return `https:${text}`
  if (text.startsWith('/')) return `${GMA_BASE_URL}${text}`

  return `${GMA_BASE_URL}/${text.replace(/^\.?\//, '')}`
}

function formatDate(parts) {
  const [year, month, day] = parts
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function cleanText(value) {
  return decodeEntities(stripTags(String(value || '')))
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
