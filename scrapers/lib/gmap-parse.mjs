// 광주미디어아트플랫폼 (GMAP), 광주. Rendered page lists current exhibitions as
//   <title> / <subtitle or description…> / YYYY-MM-DD~YYYY-MM-DD
// Anchor on the date range and take the first line of the block as the title.
const DATE_RE = /(\d{4})-(\d{1,2})-(\d{1,2})\s*~\s*(\d{4})-(\d{1,2})-(\d{1,2})/
const NOISE_RE = /^(EXHIBITION|DOCENT|MORE|HOME|광주미디어아트플랫폼|유네스코|전시안내|전시$|컬처랩|창의벨트|커뮤니티|도슨트)/i
const pad = (n) => String(n).padStart(2, '0')

export function extractGmap(innerText) {
  const lines = String(innerText || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const out = []
  let buf = []

  for (const line of lines) {
    const m = line.match(DATE_RE)
    if (m) {
      if (buf.length) {
        out.push({
          title: buf[0],
          artists: [],
          startDate: `${m[1]}-${pad(m[2])}-${pad(m[3])}`,
          endDate: `${m[4]}-${pad(m[5])}-${pad(m[6])}`,
        })
      }
      buf = []
    } else if (!NOISE_RE.test(line)) {
      buf.push(line)
    }
  }

  return out
}
