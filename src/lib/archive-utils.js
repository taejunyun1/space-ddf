export const ARCHIVE_TYPE_LABELS = {
  exhibition: '전시',
  screening: '상영',
  talk: '토크',
  workshop: '워크숍',
  performance: '공연',
  market: '마켓',
  publication: '출판',
  etc: '기타',
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function archiveTypeValue(item) {
  return item.archiveType || item.type || 'exhibition'
}

export function archiveTypeLabel(item) {
  const type = archiveTypeValue(item)
  return item.typeLabel || ARCHIVE_TYPE_LABELS[type] || '기록'
}

export function archiveSearchText(item) {
  return normalizeText([
    item.title,
    archiveTypeLabel(item),
    archiveTypeValue(item),
    item.venue,
    item.cityLabel,
    item.address,
    item.summary,
    item.description,
    item.screeningTime,
    item.director,
    item.organizer,
    item.sourceName,
    item.sourceUrl,
    ...(item.artists || []),
    ...(item.category || []),
  ].join(' '))
}

export function archivePeriod(item) {
  if (item.period) return item.period

  if (item.startDate && item.endDate) return `${item.startDate} - ${item.endDate}`
  if (item.startDate) return item.startDate

  return ''
}

export function archiveSchedule(item) {
  return [
    archivePeriod(item),
    item.screeningTime,
  ].filter(Boolean).join(' · ')
}
