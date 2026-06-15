// Pure parsing for the 호랑가시나무 (Google Sites) exhibition list.
// Input is the rendered page innerText; each exhibition renders as
//   <title> / <artist or subtitle> / <date range>
// so we anchor on the date line and take the lines above it.

const DATE_RE = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*~\s*(?:(\d{4})\.\s*)?(\d{1,2})\.\s*(\d{1,2})/
const NOISE_RE = /^(current|past|upcoming|past exhibition|current exhibition)\b/i
const pad = (n) => String(n).padStart(2, '0')

export function parseDateRange(line) {
  const m = String(line).match(DATE_RE)
  if (!m) return null
  const [, y1, mo1, d1, y2, mo2, d2] = m
  const start = `${y1}-${pad(mo1)}-${pad(d1)}`
  const endYear = y2 ? Number(y2) : Number(y1)
  let end = `${endYear}-${pad(mo2)}-${pad(d2)}`
  if (end < start) end = `${endYear + 1}-${pad(mo2)}-${pad(d2)}` // range crosses new year
  return { start, end }
}

export function extractExhibitions(innerText) {
  const lines = String(innerText || '').split('\n')
  const out = []
  let buf = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || NOISE_RE.test(line)) continue

    const range = parseDateRange(line)
    if (range) {
      if (buf.length) {
        const [title, ...rest] = buf
        out.push({
          title,
          artists: rest.slice(0, 1),
          startDate: range.start,
          endDate: range.end,
        })
      }
      buf = []
    } else {
      buf.push(line)
      if (buf.length > 2) buf.shift() // keep only title + one subline
    }
  }

  return out
}
