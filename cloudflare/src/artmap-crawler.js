const ARTMAP_BASE_URL = 'https://art-map.co.kr'
const ARTMAP_LIST_URL = `${ARTMAP_BASE_URL}/data/new_exhibition.php`
const DEFAULT_SINCE_YEAR = 2024
const DEFAULT_MAX_PAGES = {
  ing: 8,
  exp: 8,
  end: 48,
}
const DEFAULT_END_STALE_PAGE_LIMIT = 16
const DEFAULT_FETCH_RETRIES = 2
const DEFAULT_FETCH_TIMEOUT_MS = 12000
const DEFAULT_RETRY_DELAY_MS = 350
const MAX_ERROR_SAMPLES = 20

const STATUS_BY_TYPE = {
  ing: 'ongoing',
  exp: 'upcoming',
  end: 'closed',
}

// Archive scope is intentionally narrow: visual-art exhibitions, independent
// film screenings, and workshops. Anything unmatched stays 'exhibition'.
const ARCHIVE_TYPES = new Set(['exhibition', 'screening', 'workshop'])
const SCREENING_VENUE_TERMS = ['광주극장', '운터강', 'untergang', '독립영화관', '시네마']
const SCREENING_KEYWORDS = ['상영', '스크리닝', 'screening', '영화제', '독립영화', '시네마', '필름']
const WORKSHOP_KEYWORDS = ['워크숍', '워크샵', 'workshop']

// Alternative art spaces + spelling variants that differ from the canonical
// name registered in priority_venues / TARGET_REGION_PATTERNS. Matched at high
// confidence so these community spaces are reliably included and not missed on a
// name mismatch. Curated list — extend as new spaces appear.
const VENUE_ALIASES = [
  // 광주 대안공간
  { city: 'gwangju', cityLabel: '광주', terms: ['스페이스ddf', 'spaceddf', 'space ddf', 'space.ddf', '스페이스디디에프'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['오버랩', 'overlab', '대안공간오버랩'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['호랑가시나무', '호랑가시나무아트폴리곤', '호랑가시나무창작소'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['뽕뽕브릿지', '뽕뽕브리지'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['솅겐갤러리', 'schengengallery', 'schengen gallery'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['미테우그로', 'miteugro', 'mite ugro', 'mite-ugro'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['산수싸리'] },
  { city: 'gwangju', cityLabel: '광주', terms: ['대안공간rga', '대안공간 rga'] },
  // 전북 대안공간
  { city: 'jeonju', cityLabel: '전주', terms: ['서학동사진관', '서학동사진미술관'] },
  { city: 'jeonju', cityLabel: '전주', terms: ['우주계란'] },
  { city: 'jeonju', cityLabel: '전주', terms: ['아트이슈프로젝트', 'artissueproject'] },
  { city: 'jeonju', cityLabel: '전주', terms: ['서신갤러리'] },
]

// Explicit out-of-scope region labels (outside 광주·전북·전남). An unknown-venue
// record that carries one of these is dropped; an unknown-venue record with no
// disqualifying label came from the 광주/전라 portal with no placement, so it is
// parked for review instead of being silently lost (guide: include unknown spaces).
const OUT_OF_SCOPE_TERMS = [
  '서울', '경기', '인천', '부산', '대구', '대전', '울산', '세종',
  '강원', '충북', '충남', '경북', '경남', '제주', '충청', '경상',
]

const CITY_LABELS = {
  gwangju: '광주',
  jeonju: '전북', // bucket covers all of 전라북도; specific 시군 set via cityLabel
  jeonnam: '전남',
  unknown: '미정',
}

const JEONNAM_AREAS = [
  { label: '목포', terms: ['목포', '목포시'] },
  { label: '여수', terms: ['여수', '여수시'] },
  { label: '순천', terms: ['순천', '순천시'] },
  { label: '나주', terms: ['나주', '나주시', '빛가람'] },
  { label: '광양', terms: ['광양', '광양시'] },
  { label: '담양', terms: ['담양', '담양군'] },
  { label: '곡성', terms: ['곡성', '곡성군'] },
  { label: '구례', terms: ['구례', '구례군'] },
  { label: '고흥', terms: ['고흥', '고흥군'] },
  { label: '보성', terms: ['보성', '보성군'] },
  { label: '화순', terms: ['화순', '화순군'] },
  { label: '장흥', terms: ['장흥', '장흥군'] },
  { label: '강진', terms: ['강진', '강진군'] },
  { label: '해남', terms: ['해남', '해남군'] },
  { label: '영암', terms: ['영암', '영암군'] },
  { label: '무안', terms: ['무안', '무안군'] },
  { label: '함평', terms: ['함평', '함평군'] },
  { label: '영광', terms: ['영광', '영광군'] },
  { label: '장성', terms: ['장성', '장성군'] },
  { label: '완도', terms: ['완도', '완도군'] },
  { label: '진도', terms: ['진도', '진도군'] },
  { label: '신안', terms: ['신안', '신안군'] },
]

// 전라북도 시군. The `jeonju` bucket covers all of 전북; cityLabel shows the
// specific city the same way the jeonnam bucket does.
const JEONBUK_AREAS = [
  { label: '전주', terms: ['전주', '전주시'] },
  { label: '군산', terms: ['군산', '군산시'] },
  { label: '익산', terms: ['익산', '익산시'] },
  { label: '완주', terms: ['완주', '완주군'] },
  { label: '정읍', terms: ['정읍', '정읍시'] },
  { label: '남원', terms: ['남원', '남원시'] },
  { label: '김제', terms: ['김제', '김제시'] },
  { label: '진안', terms: ['진안', '진안군'] },
  { label: '무주', terms: ['무주', '무주군'] },
  { label: '장수', terms: ['장수', '장수군'] },
  { label: '임실', terms: ['임실', '임실군'] },
  { label: '순창', terms: ['순창', '순창군'] },
  { label: '고창', terms: ['고창', '고창군'] },
  { label: '부안', terms: ['부안', '부안군'] },
]

const TARGET_REGION_PATTERNS = [
  {
    city: 'gwangju',
    cityLabel: '광주',
    terms: [
      '광주',
      '국립아시아문화전당',
      'ACC',
      '광주시립미술관',
      '광주비엔날레전시관',
      '광주비엔날레',
      'GMAP',
      '광주미디어아트플랫폼',
      '예술공간집',
      '스페이스 디디에프',
      '스페이스디디에프',
      '디디에프',
      'SPACE DDF',
      '오버랩',
      '대안공간오버랩',
      'OverLab',
      '호랑가시나무',
      '호랑가시나무 창작소',
      '호랑가시나무 아트폴리곤',
      '뽕뽕브릿지',
      '이강하미술관',
      '미로센터',
      '무등갤러리',
      '광주극장',
      '운터강',
      'Untergang',
      '산수미술관',
      '드영미술관',
      '10년후그라운드',
      '솅겐갤러리',
      '하정웅미술관',
      '의재미술관',
      '은암미술관',
      '국윤미술관',
      '양림미술관',
      '우제길미술관',
      '무등현대미술관',
      '광주신세계갤러리',
      '신세계갤러리',
      '롯데갤러리광주점',
      '롯데갤러리 광주점',
      '광주예술의전당갤러리',
      '광주예술의전당',
      '광주여성전시관',
      'Herstory',
      '일곡갤러리',
      '자미갤러리',
      '조선대미술관',
      '조선대학교미술관',
      '한희원미술관',
      '소촌아트팩토리',
      '이이남스튜디오',
      '이이남 스튜디오',
      '아크갤러리',
      '아크 갤러리',
      '산수싸리',
      '대안공간RGA',
      '대안공간 RGA',
    ],
  },
  {
    city: 'jeonju',
    cityLabel: '전북',
    terms: [
      '전북',
      '전라북도',
      '아트갤러리전주',
      '전주현대미술관',
      '서학동사진미술관',
      '서학동사진관',
      '교동미술관',
      '우진문화공간',
      '팔복 예술공장',
      '팔복예술공장',
      '전주부채문화관',
      '국립전주박물관',
      '전주영화제작소',
      '전북도립미술관',
      '아트이슈프로젝트',
      '서신갤러리',
      '삼례문화예술촌',
      ...JEONBUK_AREAS.flatMap(area => area.terms),
    ],
  },
  {
    city: 'jeonnam',
    cityLabel: '전남',
    terms: [
      '전남',
      '전라남도',
      '전남도립미술관',
      '담빛예술창고',
      '해동문화예술촌',
      '목포문화예술회관',
      '성옥기념관',
      '노적봉예술공원',
      '노적봉예술공원미술관',
      '국립해양문화재연구소',
      '목포근대역사관',
      '나주정미소',
      '나주목문화관',
      '나주영상테마파크',
      '나주복암리고분전시관',
      ...JEONNAM_AREAS.flatMap(area => area.terms),
    ],
  },
]

export async function crawlArtmap(env, options = {}) {
  const runId = `artmap-${Date.now()}`
  const sinceYear = Number(options.sinceYear || DEFAULT_SINCE_YEAR)
  const sinceDate = `${sinceYear}-01-01`
  const visibility = options.visibility || 'public'
  const endStalePageLimit = positiveNumber(options.endStalePageLimit, DEFAULT_END_STALE_PAGE_LIMIT)
  const fetchOptions = {
    retries: positiveNumber(options.retries, DEFAULT_FETCH_RETRIES),
    timeoutMs: positiveNumber(options.timeoutMs, DEFAULT_FETCH_TIMEOUT_MS),
    retryDelayMs: positiveNumber(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS),
  }
  const maxPages = {
    ...DEFAULT_MAX_PAGES,
    ...(options.maxPages || {}),
  }
  const startedAt = new Date().toISOString()
  const runUrl = `${ARTMAP_LIST_URL}?area=5&cate=0`
  let recordsFound = 0
  let recordsSaved = 0
  let exhibitionsSaved = 0
  const stats = createCrawlStats()

  await env.DB.prepare(`
    INSERT INTO crawl_runs (id, source_id, status, crawl_type, request_url, started_at)
    VALUES (?, 'artmap', 'running', 'artmap-area-5', ?, ?)
  `).bind(runId, runUrl, startedAt).run()

  try {
    const priorityVenuePatterns = await loadPriorityVenuePatterns(env)

    for (const type of ['ing', 'exp', 'end']) {
      const pageLimit = maxPages[type] || 0
      let staleEndPages = 0

      for (let page = 0; page < pageLimit; page += 1) {
        stats.pages[type] += 1

        const html = await fetchArtmapList(type, page * 4, page, fetchOptions)

        if (!html || html.trim() === 'end' || html.includes('해당 조건에 일치하는 전시가 없습니다')) {
          stats.emptyPages += 1
          break
        }

        const records = parseArtmapList(html, type)
        if (!records.length) {
          stats.parseEmptyPages += 1
          break
        }

        recordsFound += records.length

        if (type === 'end' && records.every(record => isOlderThanSince(record, sinceDate))) {
          staleEndPages += 1
        } else {
          staleEndPages = 0
        }

        for (const record of records) {
          try {
            await upsertSourceRecord(env, record)
            recordsSaved += 1

            if (type === 'end' && isOlderThanSince(record, sinceDate)) {
              stats.skippedOld += 1
              continue
            }

            const detail = await fetchArtmapDetail(record.externalId, fetchOptions)
              .then(result => {
                stats.detailsFetched += 1
                return result
              })
              .catch(err => {
                stats.detailErrors += 1
                addErrorSample(stats, 'detail', record.externalId, err)
                return null
              })
            const region = detectTargetRegion({
              ...record,
              address: detail?.address || '',
              venueName: detail?.venueName || record.venueName,
            }, priorityVenuePatterns)

            let effectiveVisibility = visibility
            let reviewReason = null

            if (region.city === 'unknown') {
              if (region.outOfScope) {
                // Explicit out-of-scope region label (전북/타 지역) → drop.
                stats.skippedRegion += 1
                continue
              }

              // Unknown venue, no disqualifying region → park for human review
              // instead of dropping (guide: include unknown spaces).
              effectiveVisibility = 'review'
              reviewReason = 'unmatched-venue'
              stats.reviewSaved += 1
            } else if (region.confidence === 'medium') {
              stats.mediumConfidence += 1
            }

            const enriched = enrichRecord(record, detail, region, effectiveVisibility, { reviewReason })

            await upsertVenue(env, enriched)
            const exhibitionId = await upsertExhibition(env, enriched)
            await linkExhibitionSource(env, exhibitionId, enriched.sourceRecordId)
            await replaceExhibitionMetadata(env, exhibitionId, enriched)
            exhibitionsSaved += 1
          } catch (err) {
            stats.recordErrors += 1
            addErrorSample(stats, 'record', record.externalId, err)
          }
        }

        if (type === 'end' && staleEndPages >= endStalePageLimit) {
          stats.staleEndPages = staleEndPages
          break
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
    `).bind(new Date().toISOString(), recordsFound, recordsSaved, JSON.stringify(stats), runId).run()

    return {
      ok: true,
      runId,
      recordsFound,
      recordsSaved,
      exhibitionsSaved,
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
      recordsFound,
      recordsSaved,
      err instanceof Error ? err.message : String(err),
      JSON.stringify(stats),
      runId,
    ).run()

    throw err
  }
}

function createCrawlStats() {
  return {
    pages: {
      ing: 0,
      exp: 0,
      end: 0,
    },
    emptyPages: 0,
    parseEmptyPages: 0,
    detailsFetched: 0,
    detailErrors: 0,
    skippedOld: 0,
    skippedRegion: 0,
    reviewSaved: 0,
    mediumConfidence: 0,
    recordErrors: 0,
    staleEndPages: 0,
    errors: [],
  }
}

function addErrorSample(stats, stage, externalId, err) {
  if (stats.errors.length >= MAX_ERROR_SAMPLES) return

  stats.errors.push({
    stage,
    externalId: externalId ? String(externalId) : '',
    message: err instanceof Error ? err.message : String(err),
  })
}

function isOlderThanSince(record, sinceDate) {
  if (!record.endDate) return false
  return record.endDate < sinceDate
}

async function loadPriorityVenuePatterns(env) {
  try {
    const result = await env.DB.prepare(`
      SELECT name, normalized_name AS normalizedName, city, city_label AS cityLabel
      FROM priority_venues
      ORDER BY priority DESC, name
    `).all()

    return result.results.map(row => ({
      city: row.city,
      cityLabel: row.cityLabel,
      terms: [row.name, row.normalizedName].filter(Boolean),
    }))
  } catch {
    return []
  }
}

async function fetchArtmapList(type, start, wrap, fetchOptions) {
  const params = new URLSearchParams({
    start: String(start),
    wrap: String(wrap),
    type,
    area: '5',
    cate: '0',
    od: '0',
    v_cnt: '0',
    online: '0',
  })
  const response = await fetchWithRetry(ARTMAP_LIST_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': 'SpaceDDFArchiveCrawler/1.0 (+https://www.spaceddf.xyz)',
    },
    body: params.toString(),
  }, fetchOptions)

  if (!response.ok) {
    throw new Error(`Artmap list request failed: ${response.status}`)
  }

  return response.text()
}

async function fetchArtmapDetail(externalId, fetchOptions) {
  const response = await fetchWithRetry(`${ARTMAP_BASE_URL}/exhibition/view.php?idx=${encodeURIComponent(externalId)}`, {
    headers: {
      'user-agent': 'SpaceDDFArchiveCrawler/1.0 (+https://www.spaceddf.xyz)',
    },
  }, fetchOptions)

  if (!response.ok) {
    throw new Error(`Artmap detail request failed: ${response.status}`)
  }

  return parseArtmapDetail(await response.text())
}

export async function fetchWithRetry(url, init = {}, options = {}) {
  const retries = positiveNumber(options.retries, DEFAULT_FETCH_RETRIES)
  const timeoutMs = positiveNumber(options.timeoutMs, DEFAULT_FETCH_TIMEOUT_MS)
  const retryDelayMs = positiveNumber(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS)
  let lastError

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: timeoutSignal(timeoutMs),
      })

      if (!shouldRetryResponse(response) || attempt === retries) return response
      lastError = new Error(`Retryable response: ${response.status}`)
    } catch (err) {
      lastError = err
      if (attempt === retries) break
    }

    await sleep(retryDelayMs * (attempt + 1))
  }

  throw lastError
}

function shouldRetryResponse(response) {
  return [408, 429, 500, 502, 503, 504].includes(response.status)
}

function timeoutSignal(timeoutMs) {
  if (!timeoutMs || typeof AbortSignal === 'undefined' || !AbortSignal.timeout) return undefined
  return AbortSignal.timeout(timeoutMs)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function parseArtmapList(html, type) {
  const records = []
  const inputPattern = /<input\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi
  let match

  while ((match = inputPattern.exec(html)) !== null) {
    const inputTag = match[0]
    const id = getAttribute(inputTag, 'id').replace(/^mapc/i, '')
    const onclick = getAttribute(inputTag, 'onclick')
    if (!id || !onclick.includes('push_val')) continue

    const onclickMatch = onclick.match(/push_val\(([\s\S]*)\)/)
    const args = parseJsArgs(onclickMatch ? onclickMatch[1] : '')
    const hrefId = nearestHrefExternalId(html, match.index)
    const externalId = String(args[3] || id || hrefId || '').trim()
    if (!externalId) continue

    const periodMatch = extractPeriodMatch(html, match.index)
    const venueParts = splitVenue(args[4])
    const title = cleanPlainText(args[0])
    const startDate = periodMatch ? formatDate(periodMatch.slice(1, 4)) : ''
    const endDate = periodMatch ? formatDate(periodMatch.slice(4, 7)) : ''

    records.push({
      sourceRecordId: `artmap-${externalId}`,
      sourceId: 'artmap',
      externalId,
      sourceUrl: `${ARTMAP_BASE_URL}/exhibition/view.php?idx=${externalId}`,
      title,
      normalizedTitle: normalizeForKey(title),
      venueName: venueParts.name,
      normalizedVenueName: normalizeForKey(venueParts.name),
      regionLabel: venueParts.region,
      cityHint: venueParts.region,
      periodText: startDate && endDate ? `${startDate} - ${endDate}` : '',
      startDate,
      endDate,
      status: statusFromDates(startDate, endDate, STATUS_BY_TYPE[type]),
      lat: numberOrNull(args[1]),
      lng: numberOrNull(args[2]),
      thumbnailUrl: absoluteUrl(args[6]),
      sourceName: '아트맵',
      sourceType: 'crawl',
      scrapedAt: new Date().toISOString(),
      payload: {
        artmapType: type,
        museumId: args[5] ? String(args[5]) : '',
        originalVenue: cleanText(args[4]),
      },
    })
  }

  return records
}

function getAttribute(tag, name) {
  const pattern = new RegExp(`${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = tag.match(pattern)
  return cleanPlainText(match?.[1] || match?.[2] || match?.[3] || '')
}

function nearestHrefExternalId(html, inputIndex) {
  const before = html.slice(Math.max(0, inputIndex - 1300), inputIndex)
  const matches = [...before.matchAll(/href=["'](?:\.?\/)?view\.php\?idx=(\d+)["']/gi)]
  return matches.at(-1)?.[1] || ''
}

function extractPeriodMatch(html, inputIndex) {
  const snippet = html.slice(Math.max(0, inputIndex - 1300), Math.min(html.length, inputIndex + 300))
  return snippet.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*~\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
}

function formatDate(parts) {
  const [year, month, day] = parts
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseArtmapDetail(html) {
  const siteCell = tableCellRaw(html, '사이트')
  const venueParts = splitVenue(tableCell(html, '장소'))

  return {
    address: tableCell(html, '주소'),
    venueName: venueParts.name,
    regionLabel: venueParts.region,
    artists: parseArtists(tableCell(html, '작가')),
    externalUrl: firstHref(siteCell),
    description: parseDescription(html),
  }
}

export function enrichRecord(record, detail, region, visibility, extra = {}) {
  const description = detail?.description || ''
  const summary = makeSummary(description) || `${record.venueName}에서 진행된 지역 전시 기록.`
  const address = detail?.address || ''
  const venueName = cleanText(detail?.venueName || record.venueName)
  const sourceUrl = detail?.externalUrl || record.sourceUrl

  return {
    ...record,
    city: region.city,
    cityLabel: region.cityLabel || CITY_LABELS[region.city],
    venueName,
    normalizedVenueName: normalizeForKey(venueName),
    address,
    regionLabel: detail?.regionLabel || record.regionLabel,
    canonicalSourceUrl: sourceUrl,
    description,
    summary,
    artists: detail?.artists || [],
    categories: inferCategories(record.title, description),
    archiveType: normalizeArchiveType(record.archiveType || inferArchiveType(record, detail)),
    regionConfidence: region.confidence || 'medium',
    reviewReason: extra.reviewReason || null,
    visibility,
    dedupeKey: [
      normalizeForKey(record.title),
      normalizeForKey(venueName),
      record.startDate || '',
    ].join('|'),
  }
}

export async function upsertSourceRecord(env, record) {
  await env.DB.prepare(`
    INSERT INTO source_records (
      id,
      source_id,
      external_id,
      source_url,
      title,
      venue_name,
      city_hint,
      period_text,
      lat,
      lng,
      thumbnail_url,
      payload_json,
      content_hash,
      first_seen_at,
      last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, external_id) DO UPDATE SET
      source_url = excluded.source_url,
      title = excluded.title,
      venue_name = excluded.venue_name,
      city_hint = excluded.city_hint,
      period_text = excluded.period_text,
      lat = excluded.lat,
      lng = excluded.lng,
      thumbnail_url = excluded.thumbnail_url,
      payload_json = excluded.payload_json,
      content_hash = excluded.content_hash,
      last_seen_at = excluded.last_seen_at
  `).bind(
    record.sourceRecordId,
    record.sourceId,
    record.externalId,
    record.sourceUrl,
    record.title,
    record.venueName,
    record.cityHint,
    record.periodText,
    record.lat,
    record.lng,
    record.thumbnailUrl,
    JSON.stringify(record.payload),
    contentHashForSourceRecord(record),
    record.scrapedAt,
    record.scrapedAt,
  ).run()
}

export async function upsertVenue(env, record) {
  const venueId = `venue-${record.city}-${hashText(record.normalizedVenueName).slice(0, 12)}`

  await env.DB.prepare(`
    INSERT INTO venues (
      id,
      name,
      normalized_name,
      city,
      city_label,
      region_label,
      address,
      lat,
      lng,
      source_url,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(normalized_name, city) DO UPDATE SET
	      name = excluded.name,
	      city_label = excluded.city_label,
	      region_label = COALESCE(NULLIF(excluded.region_label, ''), venues.region_label),
	      address = COALESCE(NULLIF(excluded.address, ''), venues.address),
	      lat = COALESCE(excluded.lat, venues.lat),
	      lng = COALESCE(excluded.lng, venues.lng),
	      source_url = COALESCE(NULLIF(excluded.source_url, ''), venues.source_url),
	      updated_at = excluded.updated_at
  `).bind(
    venueId,
    record.venueName,
    record.normalizedVenueName,
    record.city,
    record.cityLabel,
    record.regionLabel,
    record.address,
    record.lat,
    record.lng,
    record.canonicalSourceUrl,
    record.scrapedAt,
  ).run()
}

export async function upsertExhibition(env, record) {
  const exhibitionId = `exhibition-${hashText(record.dedupeKey).slice(0, 16)}`
  const venueId = `venue-${record.city}-${hashText(record.normalizedVenueName).slice(0, 12)}`

  await env.DB.prepare(`
    INSERT INTO exhibitions (
      id,
      dedupe_key,
      title,
      normalized_title,
      venue_id,
      venue_name,
      city,
      city_label,
      address,
      lat,
      lng,
      start_date,
      end_date,
      status,
      summary,
      description,
      thumbnail_url,
      canonical_source_url,
      source_name,
      source_type,
      scraped_at,
      visibility,
      archive_type,
      region_confidence,
      review_reason,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dedupe_key) DO UPDATE SET
	      title = excluded.title,
	      normalized_title = excluded.normalized_title,
	      venue_id = excluded.venue_id,
	      venue_name = excluded.venue_name,
	      city = excluded.city,
	      city_label = excluded.city_label,
	      address = COALESCE(NULLIF(excluded.address, ''), exhibitions.address),
	      lat = COALESCE(excluded.lat, exhibitions.lat),
	      lng = COALESCE(excluded.lng, exhibitions.lng),
	      start_date = excluded.start_date,
	      end_date = excluded.end_date,
	      status = excluded.status,
	      summary = COALESCE(NULLIF(excluded.summary, ''), exhibitions.summary),
	      description = COALESCE(NULLIF(excluded.description, ''), exhibitions.description),
	      thumbnail_url = COALESCE(NULLIF(excluded.thumbnail_url, ''), exhibitions.thumbnail_url),
	      canonical_source_url = COALESCE(NULLIF(excluded.canonical_source_url, ''), exhibitions.canonical_source_url),
	      source_name = excluded.source_name,
	      source_type = excluded.source_type,
	      scraped_at = excluded.scraped_at,
      visibility = excluded.visibility,
      archive_type = excluded.archive_type,
      region_confidence = excluded.region_confidence,
      review_reason = excluded.review_reason,
      updated_at = excluded.updated_at
  `).bind(
    exhibitionId,
    record.dedupeKey,
    record.title,
    record.normalizedTitle,
    venueId,
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
    record.regionConfidence || 'medium',
    record.reviewReason || null,
    record.scrapedAt,
  ).run()

  return exhibitionId
}

export async function linkExhibitionSource(env, exhibitionId, sourceRecordId) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO exhibition_sources (exhibition_id, source_record_id, is_primary)
    VALUES (?, ?, 1)
  `).bind(exhibitionId, sourceRecordId).run()
}

export async function replaceExhibitionMetadata(env, exhibitionId, record) {
  await env.DB.prepare('DELETE FROM exhibition_artists WHERE exhibition_id = ?')
    .bind(exhibitionId)
    .run()
  await env.DB.prepare('DELETE FROM exhibition_categories WHERE exhibition_id = ?')
    .bind(exhibitionId)
    .run()

  for (const artist of record.artists) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO exhibition_artists (exhibition_id, artist_name, normalized_artist_name)
      VALUES (?, ?, ?)
    `).bind(exhibitionId, artist, normalizeForKey(artist)).run()
  }

  for (const category of record.categories) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO exhibition_categories (exhibition_id, category)
      VALUES (?, ?)
    `).bind(exhibitionId, category).run()
  }
}

function parseJsArgs(value) {
  const args = []
  let current = ''
  let quote = ''
  let escaped = false

  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      current += char
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = ''
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === ',') {
      args.push(cleanPlainText(current))
      current = ''
      continue
    }

    current += char
  }

  args.push(cleanPlainText(current))
  return args
}

function splitVenue(value) {
  const text = cleanText(value)
  const parts = text.split('/')
  const region = parts.length > 1 ? cleanText(parts.pop()) : ''

  return {
    name: cleanText(parts.join('/')) || text,
    region,
  }
}

export function detectTargetRegion(record, priorityVenuePatterns = []) {
  const haystack = normalizeForSearch([
    record.title,
    record.venueName,
    record.cityHint,
    record.address,
    record.regionLabel,
  ].join(' '))

  // High confidence: a specifically registered candidate venue (DB priority
  // list or a known spelling alias) was matched by name.
  for (const venue of [...priorityVenuePatterns, ...VENUE_ALIASES]) {
    if (venue.terms.some(term => includesSearchTerm(haystack, term))) {
      return {
        city: venue.city,
        confidence: 'high',
        cityLabel: venue.cityLabel || areaLabelFor(venue.city, haystack),
      }
    }
  }

  // Medium confidence: matched a region/venue keyword from the curated patterns.
  for (const group of TARGET_REGION_PATTERNS) {
    if (group.terms.some(term => includesSearchTerm(haystack, term))) {
      return {
        city: group.city,
        confidence: 'medium',
        // Prefer the specific 시군 over the generic province label.
        cityLabel: areaLabelFor(group.city, haystack) || group.cityLabel,
      }
    }
  }

  return {
    city: 'unknown',
    confidence: 'none',
    cityLabel: CITY_LABELS.unknown,
    // No target match. If it carries an out-of-scope label it is dropped; if it
    // has no disqualifying region at all it is kept for review.
    outOfScope: OUT_OF_SCOPE_TERMS.some(term => includesSearchTerm(haystack, term)),
  }
}

// Narrow the archive to the three supported buckets. Screening wins over
// workshop, which wins over the default exhibition.
export function inferArchiveType(record = {}, detail = {}) {
  const venue = normalizeForSearch(`${record.venueName || ''} ${detail.venueName || ''}`)
  const text = normalizeForSearch(`${record.title || ''} ${detail.description || ''}`)

  if (SCREENING_VENUE_TERMS.some(term => includesSearchTerm(venue, term))) return 'screening'
  if (SCREENING_KEYWORDS.some(term => includesSearchTerm(text, term))) return 'screening'
  if (WORKSHOP_KEYWORDS.some(term => includesSearchTerm(text, term))) return 'workshop'

  return 'exhibition'
}

export function normalizeArchiveType(value) {
  return ARCHIVE_TYPES.has(value) ? value : 'exhibition'
}

// Resolve the specific 시군 label within a province bucket (jeonnam / jeonbuk).
// Falls back to the generic province label for gwangju and unmatched cases.
function areaLabelFor(city, haystack) {
  if (city === 'jeonnam') return detectAreaLabel(JEONNAM_AREAS, haystack) || CITY_LABELS.jeonnam
  if (city === 'jeonju') return detectAreaLabel(JEONBUK_AREAS, haystack) || CITY_LABELS.jeonju
  return CITY_LABELS[city] || CITY_LABELS.unknown
}

function detectAreaLabel(areas, haystack) {
  const match = areas.find(area => (
    area.terms.some(term => includesSearchTerm(haystack, term))
  ))

  return match?.label || ''
}

function includesSearchTerm(haystack, term) {
  const needle = normalizeForSearch(term)
  return Boolean(needle && haystack.includes(needle))
}

function tableCell(html, label) {
  return cleanText(tableCellRaw(html, label))
}

function tableCellRaw(html, label) {
  const pattern = new RegExp(`<th[^>]*>[\\s\\S]*?${escapeRegExp(label)}[\\s\\S]*?<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i')
  const match = html.match(pattern)
  return match ? match[1] : ''
}

function firstHref(html) {
  const match = html.match(/href=["']([^"']+)["']/i)
  return match ? absoluteUrl(match[1]) : ''
}

function parseArtists(html) {
  const text = stripTags(html)
  if (!text) return []

  return text
    .split(/[,/·\n]/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 20)
}

function parseDescription(html) {
  const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
  return match ? cleanText(match[1]) : ''
}

function inferCategories(title, description) {
  const text = normalizeForSearch(`${title} ${description}`)
  const categories = []

  if (text.includes('사진')) categories.push('사진')
  if (text.includes('미디어') || text.includes('영상') || text.includes('디지털')) categories.push('미디어')
  if (text.includes('회화') || text.includes('그림')) categories.push('회화')
  if (text.includes('설치')) categories.push('설치')
  if (text.includes('공예')) categories.push('공예')
  if (!categories.length) categories.push('기타')

  return categories
}

export function statusFromDates(startDate, endDate, fallback) {
  const today = new Date().toISOString().slice(0, 10)

  if (startDate && startDate > today) return 'upcoming'
  if (endDate && endDate < today) return 'closed'
  if (startDate && endDate && startDate <= today && today <= endDate) return 'ongoing'

  return fallback || 'unknown'
}

function makeSummary(description) {
  return cleanText(description)
    .replace(/\s+/g, ' ')
    .slice(0, 120)
}

function absoluteUrl(value) {
  const text = cleanText(value)
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  if (text.startsWith('//')) return `https:${text}`
  if (text.startsWith('/')) return `${ARTMAP_BASE_URL}${text}`

  return `${ARTMAP_BASE_URL}/${text.replace(/^\.?\//, '')}`
}

function cleanPlainText(value) {
  return decodeEntities(String(value || ''))
    .replace(/\\(["'])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanText(value) {
  return decodeEntities(stripTags(String(value || '')))
    .replace(/\\(["'])/g, '$1')
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

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function normalizeForKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
}

function normalizeForSearch(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
}

function contentHashForSourceRecord(record) {
  return hashText(JSON.stringify({
    sourceId: record.sourceId,
    externalId: record.externalId,
    sourceUrl: record.sourceUrl,
    title: record.title,
    venueName: record.venueName,
    cityHint: record.cityHint,
    periodText: record.periodText,
    lat: record.lat,
    lng: record.lng,
    thumbnailUrl: record.thumbnailUrl,
    payload: record.payload,
  }))
}

function hashText(value) {
  let hash = 5381
  const text = String(value || '')

  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i)
    hash &= 0xffffffff
  }

  return Math.abs(hash).toString(36)
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
