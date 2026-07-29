import { crawlArtmap } from './artmap-crawler.js'
import { crawlGwangjuMuseum } from './gwangju-museum-crawler.js'
import { importManualExhibitions } from './manual-source.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-crawl-secret',
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {}),
    },
  })
}

function error(message, status = 500) {
  return json({ error: message }, { status })
}

function normalizeParam(value) {
  return value ? String(value).trim().toLowerCase() : ''
}

function numberParam(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toArchiveItem(row) {
  return {
    id: row.id,
    title: row.title,
    city: row.city,
    cityLabel: row.city_label,
    venue: row.venue_name,
    address: row.address || '',
    lat: row.lat,
    lng: row.lng,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    period: row.period || '',
    status: row.status,
    statusLabel: statusLabel(row.status),
    archiveType: row.archive_type || 'exhibition',
    typeLabel: typeLabel(row.archive_type),
    regionConfidence: row.region_confidence || '',
    reviewReason: row.review_reason || '',
    artists: parseJsonArray(row.artists_json),
    category: parseJsonArray(row.categories_json),
    thumbnail: row.thumbnail_url || '',
    sourceName: row.source_name,
    sourceUrl: row.canonical_source_url,
    sourceType: row.source_type,
    scrapedAt: row.scraped_at || '',
    description: row.description || '',
    summary: row.summary || '',
  }
}

function parseJsonArray(value) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseJsonObject(value) {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function statusLabel(status) {
  if (status === 'ongoing') return '진행'
  if (status === 'upcoming') return '예정'
  if (status === 'closed') return '종료'
  return '미정'
}

function typeLabel(type) {
  if (type === 'screening') return '상영'
  if (type === 'workshop') return '워크숍'
  return '전시'
}

async function listExhibitions(request, env) {
  const url = new URL(request.url)
  const city = normalizeParam(url.searchParams.get('city'))
  const status = normalizeParam(url.searchParams.get('status'))
  const type = normalizeParam(url.searchParams.get('type'))
  const limit = Math.min(Math.max(numberParam(url.searchParams.get('limit'), 100), 1), 100)
  const offset = decodeOffsetCursor(url.searchParams.get('cursor'))
  const values = ['public']
  const where = ['e.visibility = ?', 'COALESCE(e.active, 1) = 1']

  if (city && city !== 'all') {
    where.push('e.city = ?')
    values.push(city)
  }

  if (status && status !== 'all') {
    where.push('e.status = ?')
    values.push(status)
  }

  if (type && type !== 'all') {
    where.push('e.archive_type = ?')
    values.push(type)
  }

  values.push(limit + 1, offset)

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const statement = env.DB.prepare(`
    SELECT
      e.*,
      CASE
        WHEN e.start_date IS NOT NULL AND e.end_date IS NOT NULL
          THEN e.start_date || ' - ' || e.end_date
        WHEN e.start_date IS NOT NULL
          THEN e.start_date
        ELSE ''
      END AS period,
      COALESCE((
        SELECT json_group_array(artist_name)
        FROM exhibition_artists
        WHERE exhibition_id = e.id
      ), '[]') AS artists_json,
      COALESCE((
        SELECT json_group_array(category)
        FROM exhibition_categories
        WHERE exhibition_id = e.id
      ), '[]') AS categories_json
    FROM exhibitions e
    ${whereSql}
    ORDER BY
      CASE e.status
        WHEN 'ongoing' THEN 0
        WHEN 'upcoming' THEN 1
        WHEN 'closed' THEN 2
        ELSE 3
      END,
      COALESCE(e.start_date, e.updated_at) DESC
    LIMIT ? OFFSET ?
  `)

  const result = await statement.bind(...values).all()

  const rows = result.results || []
  const pageRows = rows.slice(0, limit)
  return json({
    data: pageRows.map(toArchiveItem),
    count: pageRows.length,
    meta: {
      nextCursor: rows.length > limit ? encodeOffsetCursor(offset + limit) : null,
      limit,
    },
  })
}

async function listVenues(_request, env) {
  const venues = await env.DB.prepare(`
    SELECT
      id,
      name,
      city,
      city_label AS cityLabel,
      region_label AS regionLabel,
      address,
      lat,
      lng,
      priority,
      source_url AS sourceUrl
    FROM venues
    ORDER BY city, priority DESC, name
  `).all()

  if (venues.results.length) {
    return json({
      data: venues.results,
      count: venues.results.length,
    })
  }

  const priorityVenues = await env.DB.prepare(`
    SELECT
      id,
      name,
      city,
      city_label AS cityLabel,
      NULL AS regionLabel,
      NULL AS address,
      NULL AS lat,
      NULL AS lng,
      priority,
      NULL AS sourceUrl
    FROM priority_venues
    ORDER BY city, priority DESC, name
  `).all()

  return json({
    data: priorityVenues.results,
    count: priorityVenues.results.length,
    fallback: 'priority_venues',
  })
}

async function listSources(_request, env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      name,
      base_url AS baseUrl,
      source_type AS sourceType,
      enabled,
      updated_at AS updatedAt
    FROM sources
    ORDER BY id
  `).all()

  return json({
    data: result.results,
    count: result.results.length,
  })
}

async function listCrawlRuns(request, env) {
  const url = new URL(request.url)
  const limit = Math.min(numberParam(url.searchParams.get('limit'), 20), 100)
  const result = await env.DB.prepare(`
    SELECT
      id,
      source_id AS sourceId,
      status,
      crawl_type AS crawlType,
      request_url AS requestUrl,
      started_at AS startedAt,
      finished_at AS finishedAt,
      records_found AS recordsFound,
      records_saved AS recordsSaved,
      error_message AS errorMessage,
      metadata_json AS metadataJson
    FROM crawl_runs
    ORDER BY started_at DESC
    LIMIT ?
  `).bind(limit).all()

  return json({
    data: result.results.map(run => ({
      ...run,
      metadata: parseJsonObject(run.metadataJson),
      metadataJson: undefined,
    })),
    count: result.results.length,
  })
}

async function health(env) {
  const result = await env.DB.prepare('SELECT COUNT(*) AS count FROM sources').first()

  return json({
    ok: true,
    database: 'space-ddf-archive',
    sources: result.count,
  })
}

async function parseJsonBody(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) return {}

  try {
    return await request.json()
  } catch {
    return {}
  }
}

function hasCrawlAccess(request, env) {
  const secret = env.CRAWL_SECRET
  if (!secret) return false

  return request.headers.get('x-crawl-secret') === secret
}

function crawlOptionsFromRequest(request, body) {
  const url = new URL(request.url)
  const hasMaxPagesObject = body.maxPages && typeof body.maxPages === 'object'
  const pageLimit = hasMaxPagesObject
    ? null
    : numberParam(body.maxPages || url.searchParams.get('maxPages'), null)

  return {
    sinceYear: numberParam(body.sinceYear || url.searchParams.get('sinceYear'), undefined),
    visibility: normalizeParam(body.visibility || url.searchParams.get('visibility')) || 'public',
    endStalePageLimit: numberParam(body.endStalePageLimit || url.searchParams.get('endStalePageLimit'), undefined),
    retries: numberParam(body.retries || url.searchParams.get('retries'), undefined),
    timeoutMs: numberParam(body.timeoutMs || url.searchParams.get('timeoutMs'), undefined),
    retryDelayMs: numberParam(body.retryDelayMs || url.searchParams.get('retryDelayMs'), undefined),
    maxPages: hasMaxPagesObject
      ? {
        ing: numberParam(body.maxPages.ing, undefined),
        exp: numberParam(body.maxPages.exp, undefined),
        end: numberParam(body.maxPages.end, undefined),
      }
      : pageLimit
        ? {
          ing: pageLimit,
          exp: pageLimit,
          end: pageLimit,
        }
        : undefined,
  }
}

async function runArtmapCrawl(request, env) {
  if (!hasCrawlAccess(request, env)) return error('Unauthorized', 401)

  const body = await parseJsonBody(request)
  const result = await crawlArtmap(env, crawlOptionsFromRequest(request, body))

  return json(result)
}

async function runGwangjuMuseumCrawl(request, env) {
  if (!hasCrawlAccess(request, env)) return error('Unauthorized', 401)

  const body = await parseJsonBody(request)
  const result = await crawlGwangjuMuseum(env, crawlOptionsFromRequest(request, body))

  return json(result)
}

// Manual / submission entry for alternative spaces. Accepts a single record or
// { items: [...] }. Upserts into the same exhibitions table as sourceType=manual.
async function runManualUpsert(request, env) {
  if (!hasCrawlAccess(request, env)) return error('Unauthorized', 401)

  const body = await parseJsonBody(request)
  const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [body]

  try {
    const result = await importManualExhibitions(env, items)
    return json(result)
  } catch {
    return error('Invalid manual record', 400)
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: jsonHeaders })

    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/archive/crawl/artmap') {
        if (request.method !== 'POST') return error('Method not allowed', 405)
        return runArtmapCrawl(request, env)
      }

      if (url.pathname === '/api/archive/crawl/gwangju-museum') {
        if (request.method !== 'POST') return error('Method not allowed', 405)
        return runGwangjuMuseumCrawl(request, env)
      }

      if (url.pathname === '/api/archive/manual') {
        if (request.method !== 'POST') return error('Method not allowed', 405)
        return runManualUpsert(request, env)
      }

      if (request.method !== 'GET') return error('Method not allowed', 405)

      if (url.pathname === '/api/archive/exhibitions') return listExhibitions(request, env)
      if (url.pathname === '/api/archive/venues') return listVenues(request, env)
      if (url.pathname === '/api/archive/sources') {
        if (!hasCrawlAccess(request, env)) return error('Unauthorized', 401)
        return listSources(request, env)
      }
      if (url.pathname === '/api/archive/crawl/runs') {
        if (!hasCrawlAccess(request, env)) return error('Unauthorized', 401)
        return listCrawlRuns(request, env)
      }
      if (url.pathname === '/api/archive/health') return health(env)

      return error('Not found', 404)
    } catch {
      return error('Internal server error')
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([
      runScheduledCrawl(env, 'artmap', 'artmap-scheduled', () => crawlArtmap(env, { visibility: 'public' })),
      runScheduledCrawl(env, 'gwangju-museum-of-art', 'gwangju-museum-scheduled', () => crawlGwangjuMuseum(env, { visibility: 'public' })),
    ]))
  },
}

function encodeOffsetCursor(offset) {
  return btoa(String(offset)).replace(/=+$/g, '')
}

function decodeOffsetCursor(value) {
  if (!value) return 0
  try {
    const offset = Number.parseInt(atob(value), 10)
    return Number.isInteger(offset) && offset >= 0 ? offset : 0
  } catch {
    return 0
  }
}

// Each crawler logs its own crawl_runs row once it starts. This wrapper catches
// failures that happen before/around that (import errors, early throws) so a
// broken source surfaces in /api/archive/crawl/runs instead of failing silently.
async function runScheduledCrawl(env, sourceId, crawlType, run) {
  try {
    return await run()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`scheduled crawl failed: ${crawlType}: ${message}`)

    try {
      await env.DB.prepare(`
        INSERT INTO crawl_runs (id, source_id, status, crawl_type, request_url, started_at, finished_at, error_message)
        VALUES (?, ?, 'failed', ?, 'scheduled', ?, ?, ?)
      `).bind(
        `${crawlType}-${Date.now()}`,
        sourceId,
        crawlType,
        new Date().toISOString(),
        new Date().toISOString(),
        message,
      ).run()
    } catch (logErr) {
      console.error(`failed to record scheduled crawl failure: ${logErr instanceof Error ? logErr.message : logErr}`)
    }

    return null
  }
}
