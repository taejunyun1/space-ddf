export const STANDARD_CREDIT_LABELS = [
  'Artists',
  'Curating',
  'Critic',
  'Graphic',
  'Support',
  'Archive',
  'Directing',
]

const CREDIT_LABEL_ALIASES = new Map([
  ['artist', 'Artists'],
  ['artists', 'Artists'],
  ['참여작가', 'Artists'],
  ['작가', 'Artists'],
  ['curator', 'Curating'],
  ['curating', 'Curating'],
  ['기획', 'Curating'],
  ['critic', 'Critic'],
  ['비평', 'Critic'],
  ['graphic', 'Graphic'],
  ['그래픽', 'Graphic'],
  ['support', 'Support'],
  ['후원', 'Support'],
  ['archive', 'Archive'],
  ['기록', 'Archive'],
  ['directing', 'Directing'],
  ['디렉팅', 'Directing'],
])

export function normalizeCreditLabel(label) {
  const trimmed = String(label || '').trim()
  return CREDIT_LABEL_ALIASES.get(trimmed.toLowerCase()) || trimmed
}

export function normalizeCreditUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const candidate = /^www\./i.test(text) ? `https://${text}` : text

  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? candidate : ''
  } catch {
    return ''
  }
}

export function parseCreditLine(text) {
  const original = String(text || '').trim()
  const parts = original ? original.split(/\s+/) : []
  const lastPart = parts.at(-1) || ''
  const isLink = /^(https?:\/\/|www\.)\S+$/i.test(lastPart)

  if (!isLink) {
    return { prefix: original, href: '', label: '', kind: 'none' }
  }

  const prefix = parts.slice(0, -1).join(' ')
  const href = /^https?:\/\//i.test(lastPart)
    ? lastPart
    : `https://${lastPart}`

  try {
    const url = new URL(href)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { prefix: original, href: '', label: '', kind: 'none' }
    }

    const hostname = url.hostname.toLowerCase()
    const kind = hostname === 'instagram.com' || hostname.endsWith('.instagram.com')
      ? 'instagram'
      : 'external'

    return { prefix, href, label: lastPart, kind }
  } catch {
    return { prefix: original, href: '', label: '', kind: 'none' }
  }
}

export function parseCreditRecord(record) {
  if (record && typeof record === 'object') {
    const label = normalizeCreditLabel(record.label)
    const value = String(record.value || '').trim()
    const parsedLink = parseCreditLine(record.url || '')

    return {
      label,
      value,
      href: parsedLink.href,
      linkLabel: parsedLink.label,
      kind: parsedLink.kind,
    }
  }

  const parsedLine = parseCreditLine(record)
  const words = parsedLine.prefix.split(/\s+/).filter(Boolean)
  const rawLabel = words.shift() || ''

  return {
    label: normalizeCreditLabel(rawLabel),
    value: words.join(' '),
    href: parsedLine.href,
    linkLabel: parsedLine.label,
    kind: parsedLine.kind,
  }
}

export function groupContentCredits(records = []) {
  const standard = STANDARD_CREDIT_LABELS.map(label => ({ label, entries: [] }))
  const standardByLabel = new Map(standard.map(group => [group.label, group]))
  const custom = []
  const customByLabel = new Map()

  for (const record of records || []) {
    const parsed = parseCreditRecord(record)
    if (!parsed.label || (!parsed.value && !parsed.href)) continue

    if (standardByLabel.has(parsed.label)) {
      standardByLabel.get(parsed.label).entries.push(parsed)
      continue
    }

    if (!customByLabel.has(parsed.label)) {
      const group = { label: parsed.label, entries: [] }
      customByLabel.set(parsed.label, group)
      custom.push(group)
    }
    customByLabel.get(parsed.label).entries.push(parsed)
  }

  return { standard, custom }
}

export function formatCreditSummary(records = []) {
  const grouped = groupContentCredits(records)

  return [...grouped.standard, ...grouped.custom]
    .map((group) => {
      const values = group.entries
        .map(entry => entry.value)
        .filter(Boolean)

      return values.length ? `${group.label} ${values.join(', ')}` : ''
    })
    .filter(Boolean)
    .join(', ')
}
