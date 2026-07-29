import ICAL from 'ical.js'

const GOOGLE_CALENDAR_ICAL_ENV = 'GOOGLE_CALENDAR_ICAL_URL'
const CACHE_TTL_MS = 5 * 60 * 1000
let lastSuccessfulSync = null

export async function handleGoogleCalendarEvents({ request, env = {}, fetcher = fetch }) {
  if (request.method && request.method !== 'GET') {
    return jsonResponse({ error: { code: 'method_not_allowed', message: '지원하지 않는 요청입니다.' } }, 405)
  }

  const icalUrl = env[GOOGLE_CALENDAR_ICAL_ENV]
  if (!icalUrl) return syncResponse([], { configured: false, success: true })

  const now = new Date()
  if (lastSuccessfulSync && now.getTime() - lastSuccessfulSync.cachedAt < CACHE_TTL_MS) {
    return syncResponse(lastSuccessfulSync.events, {
      configured: true,
      success: true,
      syncedAt: lastSuccessfulSync.syncedAt,
      cached: true,
    })
  }

  if (!isValidCalendarUrl(icalUrl)) {
    return failedSyncResponse('invalid_calendar_url', 'Google Calendar iCal 설정을 확인해주세요.')
  }

  try {
    const response = await fetcher(icalUrl, {
      headers: { accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.1' },
      cf: { cacheTtl: 300, cacheEverything: true },
    })
    if (!response.ok) throw new Error('calendar_fetch_failed')

    const events = parseGoogleCalendarIcs(await response.text(), { now })
    const syncedAt = now.toISOString()
    lastSuccessfulSync = { events, syncedAt, cachedAt: now.getTime() }

    return syncResponse(events, { configured: true, success: true, syncedAt, cached: false })
  } catch (error) {
    const code = error?.message === 'calendar_fetch_failed'
      ? 'calendar_fetch_failed'
      : 'calendar_parse_failed'
    return failedSyncResponse(code, 'Google Calendar 일정을 불러오지 못했습니다.')
  }
}

export function parseGoogleCalendarIcs(ics, { now = new Date() } = {}) {
  const root = new ICAL.Component(ICAL.parse(String(ics || '')))
  const components = root.getAllSubcomponents('vevent')
  const groups = new Map()

  components.forEach((component) => {
    const uid = String(component.getFirstPropertyValue('uid') || '')
    if (!groups.has(uid)) groups.set(uid, { masters: [], exceptions: [] })
    const target = component.hasProperty('recurrence-id') ? 'exceptions' : 'masters'
    groups.get(uid)[target].push(component)
  })

  const range = createRange(now)
  const events = []

  groups.forEach(({ masters, exceptions }) => {
    masters.forEach((component) => {
      const event = new ICAL.Event(component, { exceptions })
      if (isCancelled(event)) return

      if (!event.isRecurring()) {
        const normalized = normalizeOccurrence(event, event.startDate, event.endDate, '')
        if (normalized && overlapsRange(normalized, range)) events.push(normalized)
        return
      }

      const iterator = event.iterator()
      let occurrence
      let guard = 0

      while ((occurrence = iterator.next()) && guard < 100000) {
        guard += 1
        if (occurrence.toJSDate() > range.end) break
        const details = event.getOccurrenceDetails(occurrence)
        if (isCancelled(details.item)) continue
        const normalized = normalizeOccurrence(
          details.item,
          details.startDate,
          details.endDate,
          occurrence.toString(),
        )
        if (normalized && overlapsRange(normalized, range)) events.push(normalized)
      }
    })
  })

  return events.sort((left, right) => (
    left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title)
  ))
}

function normalizeOccurrence(event, start, end, recurrenceKey) {
  if (!start) return null
  const title = String(event.summary || 'Google Calendar 일정').trim()
  const description = String(event.description || '').trim()
  const type = inferEventType(title, description)
  const startDate = dateKey(start)
  const endDate = normalizeEndDate(start, end || start)
  const uid = event.uid || `${title}-${startDate}`

  return stripEmpty({
    id: `google-${slugify(`${uid}-${recurrenceKey}`)}`,
    startDate,
    endDate,
    type,
    label: labelForType(type),
    title,
    status: 'confirmed',
    location: String(event.location || '').trim(),
    source: 'google-calendar',
  })
}

function isCancelled(event) {
  const status = event?.component?.getFirstPropertyValue('status')
  return String(status || '').toUpperCase() === 'CANCELLED'
}

function createRange(now) {
  const start = new Date(now)
  start.setUTCMonth(start.getUTCMonth() - 12)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setUTCMonth(end.getUTCMonth() + 18)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end, startDate: formatDateInKorea(start), endDate: formatDateInKorea(end) }
}

function overlapsRange(event, range) {
  return event.startDate <= range.endDate && event.endDate >= range.startDate
}

function dateKey(time) {
  if (time.isDate) {
    return `${String(time.year).padStart(4, '0')}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
  }
  return formatDateInKorea(time.toJSDate())
}

function normalizeEndDate(start, end) {
  const startDate = dateKey(start)
  const endDate = dateKey(end)
  return start.isDate && end.isDate && endDate > startDate ? addDays(endDate, -1) : endDate
}

function failedSyncResponse(code, message) {
  return syncResponse(lastSuccessfulSync?.events || [], {
    configured: true,
    success: false,
    syncedAt: lastSuccessfulSync?.syncedAt || null,
    errorCode: code,
    message,
    cached: Boolean(lastSuccessfulSync),
  })
}

function syncResponse(events, meta) {
  return jsonResponse({
    data: events,
    meta: { source: 'google-calendar', count: events.length, ...meta },
  }, 200, { 'cache-control': 'public, max-age=300, s-maxage=300' })
}

function isValidCalendarUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /(^|\.)calendar\.google\.com$/.test(url.hostname)
  } catch {
    return false
  }
}

function inferEventType(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  if (/(대관|rental|rent|reservation|예약)/i.test(text)) return 'rental'
  if (/(워크샵|workshop|class|talk|lecture|강연|강의)/i.test(text)) return 'workshop'
  return 'exhibition'
}

function labelForType(type) {
  if (type === 'rental') return '대관'
  if (type === 'workshop') return '워크샵'
  return '전시'
}

function formatDateInKorea(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function addDays(dateKeyValue, amount) {
  const [year, month, day] = dateKeyValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'event'
}

function stripEmpty(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== ''))
}

function jsonResponse(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}
