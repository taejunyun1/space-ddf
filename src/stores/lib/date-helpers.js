export function parseDateRange(dateRange) {
  if (!dateRange || typeof dateRange !== 'string' || !dateRange.trim()) {
    return { start: null, end: null }
  }

  const normalized = dateRange.replace(/\s*[–—-]\s*/g, ' - ')
  const [startText, endText] = normalized.split(' - ').map(value => value?.trim())
  const start = parseYmd(startText)
  let end = endText ? parseMaybeMdWithYear(endText, start?.getFullYear()) : null

  if (start && end && end < start && !/^\d{4}\./.test(endText || '')) {
    end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate())
  }

  return { start, end }
}

export function sortKeyFromRange(item) {
  const parsedRange = parseDateRange(item?.dateRange)
  const start = parseYmd(item?.startDate) || parsedRange.start
  const end = parseYmd(item?.endDate) || parsedRange.end
  const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY
  const endTime = end ? end.getTime() : startTime

  return {
    start: startTime,
    end: endTime,
    title: (item?.title || '').toLowerCase(),
  }
}

export function compareByRangeAsc(a, b) {
  const first = sortKeyFromRange(a)
  const second = sortKeyFromRange(b)

  if (first.start !== second.start) return first.start - second.start
  if (first.end !== second.end) return first.end - second.end

  return first.title.localeCompare(second.title)
}

function parseYmd(value) {
  if (!value) return null

  const match = value.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\.?$/)
  if (!match) return null

  return validDate(+match[1], +match[2] - 1, +match[3])
}

function parseMaybeMdWithYear(value, fallbackYear) {
  if (!value) return null

  const fullMatch = value.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\.?$/)
  if (fullMatch) {
    return validDate(+fullMatch[1], +fullMatch[2] - 1, +fullMatch[3])
  }

  const shortMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.?$/)
  if (!shortMatch || !Number.isInteger(fallbackYear)) return null

  return validDate(fallbackYear, +shortMatch[1] - 1, +shortMatch[2])
}

function validDate(year, month, day) {
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}
