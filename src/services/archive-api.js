const DEFAULT_ARCHIVE_API_BASE_URL = 'https://space-ddf-archive-api.taejunyun.workers.dev'

const SOURCE_TYPE_LABELS = {
  crawl: '크롤링',
  manual: '자체입력',
  submission: '제보',
}

const ARCHIVE_TYPE_LABELS = {
  exhibition: '전시',
  screening: '상영',
  talk: '토크',
  workshop: '워크숍',
  performance: '공연',
  market: '마켓',
  publication: '출판',
  etc: '기타',
}

export async function fetchArchiveItems({ limit = 500 } = {}) {
  const baseUrl = import.meta.env.VITE_ARCHIVE_API_BASE_URL || DEFAULT_ARCHIVE_API_BASE_URL
  const url = new URL('/api/archive/exhibitions', baseUrl)

  const items = []
  let cursor = ''

  do {
    url.searchParams.set('limit', String(Math.min(100, limit - items.length)))
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Archive API request failed: ${response.status}`)
    const payload = await response.json()
    items.push(...(Array.isArray(payload.data) ? payload.data : []))
    cursor = payload.meta?.nextCursor || ''
  } while (cursor && items.length < limit)

  return items.slice(0, limit).map(normalizeArchiveItem)
}

function normalizeArchiveItem(item) {
  const sourceType = item.sourceType || ''
  const archiveType = item.archiveType || item.type || 'exhibition'

  return {
    ...item,
    archiveType,
    typeLabel: item.typeLabel || ARCHIVE_TYPE_LABELS[archiveType] || '기록',
    lat: Number(item.lat),
    lng: Number(item.lng),
    artists: Array.isArray(item.artists) ? item.artists : [],
    category: Array.isArray(item.category) && item.category.length ? item.category : ['기타'],
    sourceType: SOURCE_TYPE_LABELS[sourceType] || sourceType,
    sourceTypeValue: sourceType,
    summary: item.summary || item.description || '',
  }
}
