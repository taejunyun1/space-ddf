import {
  linkExhibitionSource,
  normalizeArchiveType,
  normalizeForKey,
  replaceExhibitionMetadata,
  statusFromDates,
  upsertSourceRecord,
  upsertVenue,
} from './artmap-crawler.js'

const GWANGJU_BOUNDS = {
  minLat: 34.9,
  maxLat: 35.4,
  minLng: 126.6,
  maxLng: 127.1,
}

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

const KOREAN_PAVILION_URL = 'https://www.gwangjubiennale.org/'
const ENGLISH_PAVILION_URL = 'https://www.gwangjubiennale.org/eng/'
const BIENNALE_SOURCE_ID = 'gwangju-biennale-pavilion'
const BIENNALE_SOURCE_NAME = '광주비엔날레 파빌리온'
const BIENNALE_CRAWL_TYPE = 'biennale-pavilions'

export function shouldRunBiennaleCrawl(edition, today) {
  if (!edition || edition.crawlCompletedAt) return false
  return edition.startDate <= today && today <= edition.endDate
}

export async function runBiennaleEditionIfDue(env, options = {}) {
  const now = options.now || new Date()
  const attemptAt = isoTimestamp(now)
  const today = seoulDate(now)
  const storedEdition = await readCurrentBiennaleEdition(env)
  const edition = normalizeEdition(storedEdition)
  const skippedStatus = biennaleSkipStatus(edition, today)

  if (skippedStatus) return { status: skippedStatus }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  const persistPavilions = options.persistPavilions || env.persistBiennalePavilions || persistBiennalePavilions
  const runId = `biennale-pavilion-${Date.now()}`

  await createBiennaleCrawlRun(env, runId, attemptAt)

  try {
    const koreanHtml = await fetchOfficialPavilionPage(fetchImpl, KOREAN_PAVILION_URL)
    assertMatchingEdition(parseBiennaleEdition(koreanHtml), edition)
    let records = parseBiennalePavilions(koreanHtml, edition)

    if (records.length === 0 || records.some(record => !record.address)) {
      const englishHtml = await fetchOfficialPavilionPage(fetchImpl, ENGLISH_PAVILION_URL)
      assertMatchingEdition(parseBiennaleEdition(englishHtml), edition)
      records = parseBiennalePavilions(englishHtml, edition)
    }

    validatePavilionRecords(records)
    const persistence = await persistPavilions(env, records, edition, { scrapedAt: attemptAt })
    await recordSuccessfulBiennaleAttempt(env, edition.edition, attemptAt)
    await finishBiennaleCrawlRun(env, runId, 'success', records.length, persistence?.saved ?? records.length)

    return {
      status: 'completed',
      edition: edition.edition,
      records: records.length,
      saved: persistence?.saved ?? records.length,
    }
  } catch (error) {
    const message = errorMessage(error)
    await recordFailedBiennaleAttempt(env, edition.edition, attemptAt, message)
    await finishBiennaleCrawlRun(env, runId, 'failed', 0, 0, message)

    if (error instanceof EditionMismatchError) {
      return { status: 'edition_mismatch', saved: 0 }
    }

    return { status: 'failed', edition: edition.edition, error: message, saved: 0 }
  }
}

async function readCurrentBiennaleEdition(env) {
  const incompleteEdition = await env.DB.prepare(`
    SELECT edition, edition_year, start_date, end_date,
           crawl_completed_at, last_attempt_at, last_attempt_status, last_error
    FROM biennale_editions
    WHERE crawl_completed_at IS NULL
    ORDER BY edition_year DESC
    LIMIT 1
  `).bind().first()

  if (incompleteEdition) return incompleteEdition

  return env.DB.prepare(`
    SELECT edition, edition_year, start_date, end_date,
           crawl_completed_at, last_attempt_at, last_attempt_status, last_error
    FROM biennale_editions
    ORDER BY edition_year DESC
    LIMIT 1
  `).bind().first()
}

function normalizeEdition(edition) {
  if (!edition) return null

  return {
    edition: edition.edition,
    editionYear: edition.editionYear ?? edition.edition_year,
    startDate: edition.startDate ?? edition.start_date,
    endDate: edition.endDate ?? edition.end_date,
    crawlCompletedAt: edition.crawlCompletedAt ?? edition.crawl_completed_at,
  }
}

function biennaleSkipStatus(edition, today) {
  if (!edition) return 'skipped_no_edition'
  if (edition.crawlCompletedAt) return 'skipped_completed'
  if (today < edition.startDate) return 'skipped_before_period'
  if (today > edition.endDate) return 'skipped_after_period'
  return shouldRunBiennaleCrawl(edition, today) ? '' : 'skipped_not_due'
}

function seoulDate(now) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid crawl timestamp')

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function isoTimestamp(now) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid crawl timestamp')
  return date.toISOString()
}

async function fetchOfficialPavilionPage(fetchImpl, url) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required')

  const response = await fetchImpl(url, {
    headers: {
      accept: 'text/html',
      'user-agent': 'SpaceDDFArchiveCrawler/1.0 (+https://spaceddf.xyz)',
    },
  })
  if (!response?.ok) throw new Error(`Biennale pavilion request failed: ${response?.status || 'unknown status'}`)
  return response.text()
}

function validatePavilionRecords(records) {
  if (!records.length) throw new Error('No pavilion blocks were parsed from the official page')
  if (records.some(record => !record.address)) throw new Error('Official pavilion records are missing addresses')
}

class EditionMismatchError extends Error {}

function assertMatchingEdition(discoveredEdition, storedEdition) {
  if (!discoveredEdition) return
  if (Number(discoveredEdition.edition) !== Number(storedEdition.edition)) {
    throw new EditionMismatchError(`Official pavilion edition mismatch: stored ${storedEdition.edition}, found ${discoveredEdition.edition}`)
  }
}

async function createBiennaleCrawlRun(env, runId, startedAt) {
  await env.DB.prepare(`
    INSERT INTO crawl_runs (id, source_id, status, crawl_type, request_url, started_at)
    VALUES (?, ?, 'running', ?, ?, ?)
  `).bind(runId, BIENNALE_SOURCE_ID, BIENNALE_CRAWL_TYPE, KOREAN_PAVILION_URL, startedAt).run()
}

async function finishBiennaleCrawlRun(env, runId, status, recordsFound, recordsSaved, message = null) {
  await env.DB.prepare(`
    UPDATE crawl_runs
    SET status = ?,
        finished_at = ?,
        records_found = ?,
        records_saved = ?,
        error_message = ?
    WHERE id = ?
  `).bind(status, new Date().toISOString(), recordsFound, recordsSaved, message, runId).run()
}

export async function persistBiennalePavilions(env, records, edition, options = {}) {
  const scrapedAt = options.scrapedAt || new Date().toISOString()
  let saved = 0

  for (const pavilion of records) {
    const record = archiveRecordForPavilion(pavilion, edition, scrapedAt)
    await upsertSourceRecord(env, record)
    record.venueId = await upsertVenue(env, record)
    const exhibitionId = await upsertBiennaleExhibition(env, record)
    await linkExhibitionSource(env, exhibitionId, record.sourceRecordId)
    await replaceExhibitionMetadata(env, exhibitionId, record)
    saved += 1
  }

  // Deactivate stale records only after every current pavilion persisted.
  // A partial failure must preserve the preceding public archive for retry.
  await env.DB.prepare(`
    UPDATE exhibitions
    SET active = 0, updated_at = ?
    WHERE source_name = ?
      AND edition = ?
      AND scraped_at < ?
      AND active = 1
  `).bind(new Date().toISOString(), BIENNALE_SOURCE_NAME, edition.edition, scrapedAt).run()

  return { saved }
}

function archiveRecordForPavilion(pavilion, edition, scrapedAt) {
  const title = `${pavilion.pavilionName} Pavilion`
  const externalId = pavilion.dedupeKey
  const publicRecord = Number(pavilion.edition) === Number(edition.edition)
    && Boolean(pavilion.address)
    && pavilion.geocodeStatus === 'verified'
    && Number.isFinite(pavilion.lat)
    && Number.isFinite(pavilion.lng)

  return {
    sourceRecordId: `biennale-pavilion-${encodeURIComponent(externalId)}`,
    sourceId: BIENNALE_SOURCE_ID,
    externalId,
    sourceUrl: pavilion.mapUrl || KOREAN_PAVILION_URL,
    title,
    normalizedTitle: normalizeForKey(title),
    venueName: pavilion.venueName,
    normalizedVenueName: normalizeForKey(pavilion.venueName),
    city: 'gwangju',
    cityLabel: '광주',
    cityHint: '광주',
    regionLabel: '광주',
    periodText: `${pavilion.startDate} - ${pavilion.endDate}`,
    startDate: pavilion.startDate,
    endDate: pavilion.endDate,
    status: statusFromDates(pavilion.startDate, pavilion.endDate, 'upcoming'),
    address: pavilion.address,
    lat: pavilion.lat,
    lng: pavilion.lng,
    thumbnailUrl: '',
    payload: {
      edition: pavilion.edition,
      editionYear: pavilion.editionYear,
      pavilionName: pavilion.pavilionName,
      venueGroupKey: pavilion.venueGroupKey,
      geocodeStatus: pavilion.geocodeStatus,
      crawlWarning: pavilion.crawlWarning,
      hours: pavilion.hours,
      mapUrl: pavilion.mapUrl,
    },
    summary: `${pavilion.pavilionName} pavilion at ${pavilion.venueName}.`,
    description: pavilion.hours ? `Hours: ${pavilion.hours}` : '',
    artists: [],
    categories: [],
    canonicalSourceUrl: KOREAN_PAVILION_URL,
    sourceName: BIENNALE_SOURCE_NAME,
    sourceType: 'crawl',
    scrapedAt,
    visibility: publicRecord ? 'public' : 'review',
    archiveType: 'exhibition',
    regionConfidence: 'high',
    reviewReason: publicRecord ? null : pavilion.crawlWarning || 'unverified_pavilion',
    edition: pavilion.edition,
    editionYear: pavilion.editionYear,
    pavilionName: pavilion.pavilionName,
    venueGroupKey: pavilion.venueGroupKey,
    geocodeStatus: pavilion.geocodeStatus,
    crawlWarning: pavilion.crawlWarning || null,
    dedupeKey: pavilion.dedupeKey,
  }
}

export async function upsertBiennaleExhibition(env, record) {
  const exhibitionId = `biennale-exhibition-${encodeURIComponent(record.dedupeKey)}`

  await env.DB.prepare(`
    INSERT INTO exhibitions (
      id, dedupe_key, title, normalized_title, venue_id, venue_name, city, city_label,
      address, lat, lng, start_date, end_date, status, summary, description, thumbnail_url,
      canonical_source_url, source_name, source_type, scraped_at, visibility, archive_type,
      region_confidence, review_reason, updated_at, edition, edition_year, pavilion_name,
      venue_group_key, geocode_status, crawl_warning, active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(dedupe_key) DO UPDATE SET
      title = excluded.title,
      normalized_title = excluded.normalized_title,
      venue_id = excluded.venue_id,
      venue_name = excluded.venue_name,
      city = excluded.city,
      city_label = excluded.city_label,
      address = excluded.address,
      lat = excluded.lat,
      lng = excluded.lng,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      status = excluded.status,
      summary = excluded.summary,
      description = excluded.description,
      thumbnail_url = excluded.thumbnail_url,
      canonical_source_url = excluded.canonical_source_url,
      source_name = excluded.source_name,
      source_type = excluded.source_type,
      scraped_at = excluded.scraped_at,
      visibility = excluded.visibility,
      archive_type = excluded.archive_type,
      region_confidence = excluded.region_confidence,
      review_reason = excluded.review_reason,
      edition = excluded.edition,
      edition_year = excluded.edition_year,
      pavilion_name = excluded.pavilion_name,
      venue_group_key = excluded.venue_group_key,
      geocode_status = excluded.geocode_status,
      crawl_warning = excluded.crawl_warning,
      active = 1,
      updated_at = excluded.updated_at
  `).bind(
    exhibitionId,
    record.dedupeKey,
    record.title,
    record.normalizedTitle,
    record.venueId,
    record.venueName,
    record.city,
    record.cityLabel,
    record.address,
    record.lat,
    record.lng,
    record.startDate || null,
    record.endDate || null,
    record.status,
    record.summary,
    record.description,
    record.thumbnailUrl,
    record.canonicalSourceUrl,
    record.sourceName,
    record.sourceType,
    record.scrapedAt,
    record.visibility,
    normalizeArchiveType(record.archiveType),
    record.regionConfidence,
    record.reviewReason,
    record.scrapedAt,
    record.edition,
    record.editionYear,
    record.pavilionName,
    record.venueGroupKey,
    record.geocodeStatus,
    record.crawlWarning,
  ).run()

  return exhibitionId
}

async function recordSuccessfulBiennaleAttempt(env, edition, attemptAt) {
  await env.DB.prepare(`
    UPDATE biennale_editions
    SET crawl_completed_at = ?,
        last_attempt_at = ?,
        last_attempt_status = 'success',
        last_error = NULL
    WHERE edition = ?
  `).bind(attemptAt, attemptAt, edition).run()
}

async function recordFailedBiennaleAttempt(env, edition, attemptAt, message) {
  await env.DB.prepare(`
    UPDATE biennale_editions
    SET last_attempt_at = ?,
        last_attempt_status = 'failed',
        last_error = ?
    WHERE edition = ?
  `).bind(attemptAt, message, edition).run()
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function parseBiennaleEdition(html) {
  const heading = headingBlocks(html).find(block => /\bgwangju\s+biennale\s+pavilion\b/i.test(block.text))
  if (!heading) return null

  const editionMatch = heading.text.match(/\b(\d+)(?:st|nd|rd|th)?\s+gwangju\s+biennale\b/i)
  const dates = parseDateRange(heading.content)
  if (!editionMatch || !dates) return null

  return {
    edition: Number(editionMatch[1]),
    editionYear: dates.year,
    startDate: dates.startDate,
    endDate: dates.endDate,
  }
}

export function parseBiennalePavilions(html, edition) {
  if (!edition?.edition || !edition.startDate || !edition.endDate) return []

  return headingBlocks(html)
    .filter(block => block.level === 4)
    .map(block => parsePavilionBlock(block, edition))
    .filter(Boolean)
}

export function webMercatorToWgs84(x, y) {
  const originShift = 20037508.342789244
  const lng = Number(x) / originShift * 180
  const lat = 180 / Math.PI * (2 * Math.atan(Math.exp(Number(y) / originShift * Math.PI)) - Math.PI / 2)
  return { lat, lng }
}

function parsePavilionBlock(block, edition) {
  const titleParts = cleanText(block.text)
    .replace(/^\d+\s*[.)-]?\s*/, '')
    .split('|')
    .map(cleanText)

  if (titleParts.length < 2 || !titleParts[0] || !titleParts[1]) return null

  const pavilionName = titleParts.shift()
  const venueName = cleanText(titleParts.join('|'))
  const address = labeledValue(block.content, 'Address')
  const hours = labeledValue(block.content, 'Hours')
  const mapUrl = mapUrlFromBlock(block.content)
  const coordinates = mapCoordinates(mapUrl)
  const verified = coordinates && isWithinGwangju(coordinates)
  const lat = verified ? coordinates.lat : null
  const lng = verified ? coordinates.lng : null
  const publicRecord = verified && Boolean(address) && Boolean(venueName)

  return {
    edition: edition.edition,
    editionYear: edition.editionYear,
    startDate: edition.startDate,
    endDate: edition.endDate,
    pavilionName,
    venueName,
    address,
    hours,
    mapUrl,
    lat,
    lng,
    venueGroupKey: venueGroupKey({ address, lat, lng, verified }),
    geocodeStatus: verified ? 'verified' : 'needs_review',
    visibility: publicRecord ? 'public' : 'review',
    crawlWarning: !verified ? 'missing_coordinates' : !address ? 'missing_address' : '',
    dedupeKey: dedupeKey(edition, pavilionName, venueName),
  }
}

function headingBlocks(html) {
  const source = String(html || '')
  const headings = []
  const pattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi
  let match

  while ((match = pattern.exec(source)) !== null) {
    headings.push({
      level: Number(match[1]),
      text: cleanText(match[2]),
      start: match.index,
      contentStart: pattern.lastIndex,
    })
  }

  return headings.map((heading, index) => ({
    ...heading,
    content: source.slice(heading.contentStart, headings[index + 1]?.start || source.length),
  }))
}

function parseDateRange(content) {
  const text = cleanText(content)
  const monthNames = Object.keys(MONTHS).join('|')
  const pattern = new RegExp(
    `\\b(${monthNames})\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?\\s*[-–—~]\\s*(${monthNames})\\s+(\\d{1,2}),\\s*(\\d{4})\\b`,
    'i',
  )
  const match = text.match(pattern)
  if (!match) return null

  const endYear = Number(match[6])
  const startYear = Number(match[3] || endYear)
  const startMonth = MONTHS[match[1].toLowerCase()]
  const endMonth = MONTHS[match[4].toLowerCase()]
  const startDay = Number(match[2])
  const endDay = Number(match[5])
  if (![startYear, endYear, startMonth, endMonth, startDay, endDay].every(Number.isFinite)) return null

  return {
    year: startYear,
    startDate: formatDate(startYear, startMonth, startDay),
    endDate: formatDate(endYear, endMonth, endDay),
  }
}

function labeledValue(content, label) {
  const labelPattern = new RegExp(`^${escapeRegExp(label)}\\s*:\\s*`, 'i')
  const labeledBlock = labeledBlockTexts(content).find(text => labelPattern.test(text))
  return labeledBlock ? labeledBlock.replace(labelPattern, '').trim() : ''
}

function mapUrlFromBlock(content) {
  const anchors = String(content || '').match(/<a\b(?:(?:"[^"]*")|(?:'[^']*')|[^'">])*>/gi) || []
  for (const anchor of anchors) {
    const href = attribute(anchor, 'href')
    if (href && /map/i.test(href)) return href
  }
  return ''
}

function mapCoordinates(mapUrl) {
  if (!mapUrl) return null

  try {
    const parsed = new URL(mapUrl)
    if (!/^https?:$/.test(parsed.protocol)) return null
    const match = `${parsed.pathname}${parsed.search}`.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (!match) return null

    const coordinates = webMercatorToWgs84(match[1], match[2])
    return Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng) ? coordinates : null
  } catch {
    return null
  }
}

function isWithinGwangju({ lat, lng }) {
  return lat >= GWANGJU_BOUNDS.minLat
    && lat <= GWANGJU_BOUNDS.maxLat
    && lng >= GWANGJU_BOUNDS.minLng
    && lng <= GWANGJU_BOUNDS.maxLng
}

function attribute(tag, name) {
  const match = String(tag || '').match(new RegExp(`${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return cleanText(match?.[1] || match?.[2] || match?.[3] || '')
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function venueGroupKey({ address, lat, lng, verified }) {
  if (verified) {
    return `biennale-venue-coordinate-v1|${keyComponent('lat', Number(lat).toFixed(5))}|${keyComponent('lng', Number(lng).toFixed(5))}`
  }

  if (!address) return ''
  return `biennale-venue-address-v1|${keyComponent('address', address)}`
}

function dedupeKey(edition, pavilionName, venueName) {
  return [
    'biennale-dedupe-v1',
    keyComponent('n', edition.edition),
    keyComponent('s', pavilionName),
    keyComponent('s', venueName),
    keyComponent('d', edition.startDate),
  ].join('|')
}

function keyComponent(type, value) {
  const normalized = normalizeKeyComponent(value)
  return `${type}:${normalized.length}:${normalized}`
}

function normalizeKeyComponent(value) {
  return cleanText(value).normalize('NFC').toLowerCase()
}

function labeledBlockTexts(content) {
  const blocks = []
  const source = String(content || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  const pattern = /<(p|div)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  let match

  while ((match = pattern.exec(source)) !== null) {
    blocks.push(cleanText(match[2]))
  }

  return blocks
}

function cleanText(value) {
  return decodeEntities(String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
  }
  let decoded = String(value || '')

  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, reference) => {
      const namedValue = named[reference.toLowerCase()]
      if (namedValue !== undefined) return namedValue

      const numeric = reference.startsWith('#x') || reference.startsWith('#X')
        ? Number.parseInt(reference.slice(2), 16)
        : Number.parseInt(reference.slice(1), 10)
      if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 0x10ffff || (numeric >= 0xd800 && numeric <= 0xdfff)) {
        return entity
      }

      return String.fromCodePoint(numeric)
    })
    if (next === decoded) break
    decoded = next
  }

  return decoded
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
