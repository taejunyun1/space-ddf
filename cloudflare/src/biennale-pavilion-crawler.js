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
    `\\b(${monthNames})\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?\\s*[-–~]\\s*(${monthNames})\\s+(\\d{1,2}),\\s*(\\d{4})\\b`,
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
  const paragraph = paragraphTexts(content).find(text => labelPattern.test(text))
  return paragraph ? paragraph.replace(labelPattern, '').trim() : ''
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

function paragraphTexts(content) {
  const paragraphs = []
  const pattern = /<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi
  let match

  while ((match = pattern.exec(String(content || ''))) !== null) {
    paragraphs.push(cleanText(match[1]))
  }

  return paragraphs
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
