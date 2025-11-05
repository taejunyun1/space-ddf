// src/stores/lib/content-helpers.js

/** =========================
 *  날짜 파서 & 정렬 유틸
 *  ========================= */
export function parseDateRange(dateRange) {
  // ✅ 공백/빈 문자열 방어
  if (!dateRange || typeof dateRange !== 'string' || !dateRange.trim()) {
    return { start: null, end: null }
  }

  // 다양한 dash(–—-)를 통일
  const norm = dateRange.replace(/\s*[–—-]\s*/g, ' - ')
  const [startStr, endStr] = norm.split(' - ').map(s => s?.trim())

  const start = parseYMD(startStr)
  let end = endStr ? parseMaybeMDWithYear(endStr, start?.getFullYear()) : null

  // 연말~연초 걸치는 케이스(예: 12.20 - 01.05) 보정
  if (start && end && end < start && !/^\d{4}\./.test(endStr || '')) {
    end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate())
  }
  return { start, end }

  function parseYMD(s) {
    if (!s) return null
    // YYYY.MM.DD
    const m = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/)
    if (!m) return null
    const y = +m[1], mo = +m[2] - 1, d = +m[3]
    const dt = new Date(y, mo, d)
    return dt instanceof Date && !isNaN(dt.getTime()) ? dt : null
  }
  function parseMaybeMDWithYear(s, fallbackYear) {
    if (!s) return null
    // YYYY.MM.DD
    const full = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/)
    if (full) {
      const y = +full[1], mo = +full[2] - 1, d = +full[3]
      const dt = new Date(y, mo, d)
      return dt instanceof Date && !isNaN(dt.getTime()) ? dt : null
    }
    // MM.DD (연도 생략)
    const md = s.match(/^(\d{1,2})\.(\d{1,2})$/)
    if (md && Number.isInteger(fallbackYear)) {
      const mo = +md[1] - 1, d = +md[2]
      const dt = new Date(fallbackYear, mo, d)
      return dt instanceof Date && !isNaN(dt.getTime()) ? dt : null
    }
    return null
  }
}
export function sortKeyFromRange(item) {
  const { start, end } = parseDateRange(item?.dateRange)

  // 시작일이 없으면 가장 과거로 밀어버림
  const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY
  const endTime   = end ? end.getTime() : startTime

  return {
    start: startTime,
    end:   endTime,
    title: (item?.title || '').toLowerCase(),
  }
}

export function compareByRangeAsc(a, b) {
  const ka = sortKeyFromRange(a)
  const kb = sortKeyFromRange(b)

  // ✅ 시작일을 최우선으로 비교
  if (ka.start !== kb.start) return ka.start - kb.start
  // 그다음 종료일 비교
  if (ka.end !== kb.end)     return ka.end - kb.end
  // 마지막은 제목 알파벳순
  return ka.title.localeCompare(kb.title)
}

/** =========================
 *  공용 이미지 헬퍼
 *  ========================= */
const IMG_EXT = /\.(png|jpe?g|webp|gif|svg)$/i

function normalizeModule(mod) {
  return typeof mod === 'string' ? mod : (mod && mod.default) ? mod.default : ''
}
function sortByPathAsc(a, b) {
  return a.localeCompare(b)
}
function pickByName(urls, names) {
  const lower = urls.map(u => [u, String(u).toLowerCase()])
  const found = lower.find(([, low]) => names.some(n => low.includes(n)))
  return (found && found[0]) || urls[0] || null
}

/** =========================
 *  SHOW 이미지 자동 수집 (Webpack 보조 로더)
 *  - poster.* -> posterOf
 *  - imgN.*   -> importShowImages
 *  ========================= */
let postersCtx, imgsCtx
try {
  postersCtx = require.context('@/assets/show', true, /poster\.(jpg|jpeg|png|webp)$/i)
  imgsCtx    = require.context('@/assets/show', true, /img\d+\.(jpg|jpeg|png|webp)$/i)
} catch (e) {
  postersCtx = null
  imgsCtx = null
}

export function posterOf(slug) {
  if (!postersCtx) return ''
  const key = postersCtx.keys().find(p => p.includes(`/${slug}/`) && /\/poster\./i.test(p))
  return key ? normalizeModule(postersCtx(key)) : ''
}

export function importShowImages(slug) {
  if (!imgsCtx) return []
  const keys = imgsCtx.keys().filter(p => p.includes(`/${slug}/`))
  const getIndex = (p) => {
    const m = p.match(/img(\d+)\.(jpg|jpeg|png|webp)$/i)
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
  }
  return keys
    .sort((a, b) => {
      const ia = getIndex(a), ib = getIndex(b)
      if (ia !== ib) return ia - ib
      return a.localeCompare(b)
    })
    .map((k, i) => ({
      src: normalizeModule(imgsCtx(k)),
      alt: `${slug} view ${i + 1}`,
      caption: '',
    }))
}

/** =========================
 *  Vite 지원 동적 감지 (Babel 파싱 회피)
 *  ========================= */
function getViteGlob() {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('try { return (typeof import !== "undefined" && import.meta && import.meta.glob) ? import.meta.glob : null } catch (e) { return null }')
    return fn()
  } catch (e) {
    return null
  }
}

/** =========================
 *  공용 자동 로더 (Vite ↔ Webpack 분기)
 *  - kind: 'project' | 'show'
 *  - slug: 폴더명
 *  ========================= */
function autoAssetsFor(kind, slug) {
  // 1) Vite
  const viteGlob = getViteGlob()
  if (typeof viteGlob === 'function') {
    const files = viteGlob(`/src/assets/${kind}/${slug}/*`, { eager: true, import: 'default' })
    const urls = Object.entries(files)
      .filter(([path]) => IMG_EXT.test(path))
      .sort(([a], [b]) => sortByPathAsc(a, b))
      .map(([, url]) => url)

    const hero = pickByName(urls, ['poster.jpg', 'poster1.jpg', 'hero', 'cover', 'main'])
    const thumb = pickByName(urls, ['poster1.jpg', 'poster.jpg', 'thumb', 'cover', 'main'])
    const gallery = urls.filter(u => u !== hero && u !== thumb)
    return { hero, thumb, gallery, urls }
  }

  // 2) Webpack
  try {
    const ctx = require.context('@/assets', true, /\.(png|jpe?g|webp|gif|svg)$/i)
    const base = `./${kind}/${slug}/`
    const keys = ctx.keys().filter(k => k.startsWith(base)).sort(sortByPathAsc)
    const urls = keys.map(k => normalizeModule(ctx(k)))

    const hero = pickByName(urls, ['poster.jpg', 'poster1.jpg', 'hero', 'cover', 'main'])
    const thumb = pickByName(urls, ['poster1.jpg', 'poster.jpg', 'thumb', 'cover', 'main'])
    const gallery = urls.filter(u => u !== hero && u !== thumb)
    return { hero, thumb, gallery, urls }
  } catch (e) {
    return { hero: null, thumb: null, gallery: [], urls: [] }
  }
}


/** =========================
 *  SHOW 빌더
 *  ========================= */
export function makeShowsFromSlugs(slugs, metaMap, startIndex = 1) {
  return slugs.map((slug, idx) => {
    const idNum = (startIndex + idx).toString().padStart(3, '0')
    const meta = (metaMap && metaMap[slug]) || {}

    let { hero, thumb, gallery } = autoAssetsFor('show', slug)
    if (!hero && postersCtx) hero = posterOf(slug)
    if ((!gallery || !gallery.length) && imgsCtx) {
      const imgs = importShowImages(slug)
      if (imgs.length) gallery = imgs.map(i => i.src)
    }

    const poster = hero || thumb || ''
    const galleryArr = (gallery || []).map((src, i) => ({
      src, alt: `${slug} view ${i + 1}`, caption: '',
    }))

    return {
      id: `s${idNum}`,
      _kind: 'show',             // ✅ kind 명시
      type: 'show',
      slug,
      title: meta.title || undefined,
      dateRange: meta.dateRange || '',
      location: meta.location || undefined,
      credits: meta.credits || undefined,
      description: meta.description || undefined,

      body: Array.isArray(meta.body)
        ? meta.body
        : (meta.body ? [meta.body] : []),

      thumb: poster || '',
      hero: poster || '',
      gallery: galleryArr,
    }
  })
}

/** =========================
 *  PROJECT 빌더
 *  ========================= */
export function makeProjectsFromSlugs(slugs = [], metaMap = {}) {
  return slugs.map((slug, i) => {
    const meta = metaMap[slug] || {}
    const dir = meta.assetDir || slug
    const { hero, thumb, gallery } = autoAssetsFor('project', dir)

    return {
      id: meta.id || `p_${String(i + 1).padStart(3, '0')}`,
      _kind: 'project',          // ✅ kind 명시
      type: 'project',
      slug,
      title: meta.title || slug,
      dateRange: meta.dateRange || '',
      location: meta.location || '',
      summary: meta.summary || '',
      description: meta.description || '',

      body: Array.isArray(meta.body)
        ? meta.body
        : (meta.body ? [meta.body] : []),

      credits: Array.isArray(meta.credits) ? meta.credits : [],
      hero: hero || thumb || '',
      thumb: thumb || hero || '',
      gallery: (gallery || []),
      link: meta.link || meta.locationLink || undefined,
    }
  })
}