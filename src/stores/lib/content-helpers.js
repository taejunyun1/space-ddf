// src/stores/lib/content-helpers.js
import { assetsFor } from './content-assets'
import { previewFor } from './content-previews'

/** =========================
 *  SHOW 빌더
 *  ========================= */
export function makeShowsFromSlugs(slugs, metaMap, startIndex = 1) {
  return slugs.map((slug, idx) => {
    const idNum = (startIndex + idx).toString().padStart(3, '0')
    const meta = (metaMap && metaMap[slug]) || {}

    const { hero, thumb, gallery, responsiveByUrl, originalByUrl } = assetsFor('show', slug)
    const preview = previewFor('show', slug)

    const poster = hero || thumb || ''
    const galleryArr = (gallery || []).map((src, i) => {
      const responsive = responsiveByUrl[src] || {}

      return {
        src: responsive.src || src,
        original: originalByUrl[src] || src,
        srcset: responsive.srcset || '',
        sizes: responsive.sizes || '',
        alt: `${slug} view ${i + 1}`,
        caption: '',
      }
    })

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

      thumb: preview || poster || '',
      hero: poster || '',
      preview,
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
      const { hero, thumb, gallery, responsiveByUrl, originalByUrl } = assetsFor('project', dir)
    const preview = previewFor('project', dir)

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
      thumb: preview || thumb || hero || '',
      gallery: (gallery || []).map((src) => {
        const responsive = responsiveByUrl[src] || {}

        return {
          src: responsive.src || src,
          original: originalByUrl[src] || src,
          srcset: responsive.srcset || '',
          sizes: responsive.sizes || '',
        }
      }),
      preview,
      link: meta.link || meta.locationLink || undefined,
    }
  })
}
