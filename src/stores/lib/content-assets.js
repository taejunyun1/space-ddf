import { assetEntriesFor } from './content-assets-manifest'
import { responsiveFor } from './responsive-manifest'

// The active asset registry is generated from scripts/content-asset-entries.js.
// Original images are not imported into Vite; they are served from /originals
// when the separate originals archive is uploaded to the host.

function naturalComparePath(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function basename(path) {
  return path.split('/').pop()?.toLowerCase() || ''
}

function pickEntry(entries, preferredNames) {
  for (const name of preferredNames) {
    const found = entries.find(entry => basename(entry.file) === name)
    if (found) return found
  }

  return entries[0] || null
}

function responsiveForEntry(kind, slug, entry) {
  const variants = responsiveFor(kind, slug, entry.base)

  if (!variants.length) return null

  return {
    src: variants[variants.length - 1].src,
    srcset: variants.map(entry => `${entry.src} ${entry.width}w`).join(', '),
    sizes: '(max-width: 900px) 100vw, 900px',
  }
}

export function assetsFor(kind, slug) {
  const sourceEntries = assetEntriesFor(kind, slug)

  if (!sourceEntries.length) {
    return {
      hero: null,
      thumb: null,
      gallery: [],
      urls: [],
      responsiveByUrl: {},
      originalByUrl: {},
    }
  }

  const entries = sourceEntries
    .map(entry => {
      const responsive = responsiveForEntry(kind, slug, entry)
      const displayUrl = responsive?.src || entry.original

      return {
        ...entry,
        displayUrl,
        responsive,
      }
    })
    .sort((a, b) => naturalComparePath(a.file, b.file))

  const heroEntry = pickEntry(entries, [
    'poster.jpg',
    'poster.png',
    'poster.webp',
    'poster1.jpg',
    'poster1.png',
    'poster1.webp',
    'hero.jpg',
    'hero.png',
    'hero.webp',
    'cover.jpg',
    'cover.png',
    'cover.webp',
    'main.jpg',
    'main.png',
    'main.webp',
  ])
  const thumbEntry = pickEntry(entries, [
    'poster1.jpg',
    'poster1.png',
    'poster1.webp',
    'poster.jpg',
    'poster.png',
    'poster.webp',
    'thumb.jpg',
    'thumb.png',
    'thumb.webp',
    'cover.jpg',
    'cover.png',
    'cover.webp',
    'main.jpg',
    'main.png',
    'main.webp',
  ])

  const hero = heroEntry?.displayUrl || null
  const thumb = thumbEntry?.displayUrl || hero
  const urls = entries.map(entry => entry.displayUrl)
  const gallery = urls.filter(url => url !== hero && url !== thumb)
  const responsiveByUrl = entries.reduce((result, entry) => {
    if (entry.responsive) {
      result[entry.displayUrl] = entry.responsive
    }

    return result
  }, {})
  const originalByUrl = entries.reduce((result, entry) => {
    result[entry.displayUrl] = entry.original
    return result
  }, {})

  return { hero, thumb, gallery, urls, responsiveByUrl, originalByUrl }
}
