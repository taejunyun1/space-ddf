import { compareByRangeAsc, parseDateRange } from '../stores/lib/date-helpers.js'

export function selectCurrentShow(shows = [], featured = null, now = new Date()) {
  if (isActiveShow(featured, now)) return featured

  return [...shows]
    .filter(item => isActiveShow(item, now))
    .sort((a, b) => compareByRangeAsc(b, a))[0] || null
}

export function sortByPublishedAtDesc(items = []) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const first = publicationTime(a.item)
      const second = publicationTime(b.item)
      if (first !== second) return second - first

      const dateOrder = compareByRangeAsc(b.item, a.item)
      return dateOrder || a.index - b.index
    })
    .map(entry => entry.item)
}

export function isActiveShow(item, now = new Date()) {
  if (!item || (item._kind || item.type) !== 'show') return false

  const range = parseDateRange(item.dateRange)
  const start = item.startDate || toDateKey(range.start)
  const end = item.endDate || toDateKey(range.end || range.start)
  const today = seoulDateKey(now)

  return Boolean(start && end && start <= today && today <= end)
}

function publicationTime(item) {
  const value = item?.publishedAt || item?.updatedAt || ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
}

function seoulDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = type => parts.find(entry => entry.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
