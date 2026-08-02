import { useContentStore } from '@/stores/content'
import { parseDateRange } from '@/stores/lib/date-helpers'

const SITE_URL = 'https://spaceddf.xyz'
const SITE_NAME = 'Space DDF'
const DEFAULT_TITLE = 'Space DDF - 광주 전시공간 · 전시 대관 · 대안 예술 공간'
const DEFAULT_DESCRIPTION = 'Space DDF는 광주 동구 충장로에 위치한 대안 예술 공간입니다. 사진, 미디어아트, 설치 등 실험적 전시와 전시 대관, 워크숍, 오픈 포트폴리오 프로그램을 운영합니다.'
const DEFAULT_IMAGE = '/og-default.jpg'
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
const ARCHIVE_TITLE = '지역 전시·상영 아카이브 | Space DDF'
const ARCHIVE_DESCRIPTION = '광주, 전주, 전남 지역의 전시와 상영 정보를 지도와 리스트로 모아보는 Space DDF 지역 전시·상영 아카이브입니다.'
const ARCHIVE_ROUTE_TITLE = '진행 중 전시 길찾기 | Space DDF'
const ARCHIVE_ROUTE_DESCRIPTION = '현재 위치, 광주비엔날레전시관, ACC에서 진행 중인 지역 전시장까지 이동 경로를 선택합니다.'

function compactText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength = 160) {
  const text = compactText(value)

  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function absoluteUrl(path = '/') {
  return new URL(path || '/', SITE_URL).href
}

function setMeta(attribute, name, content) {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

function removeMeta(attribute, name) {
  document.head.querySelector(`meta[${attribute}="${name}"]`)?.remove()
}

function setCanonical(path) {
  let element = document.head.querySelector('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  element.setAttribute('href', absoluteUrl(path))
}

function dateToIso(date) {
  if (!date) return undefined

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function setStructuredData(value) {
  let element = document.getElementById('route-structured-data')

  if (!element) {
    element = document.createElement('script')
    element.id = 'route-structured-data'
    element.type = 'application/ld+json'
    document.head.appendChild(element)
  }

  element.textContent = JSON.stringify(value)
}

function getItem(route, store) {
  const slug = route.params.slug

  if (route.name === 'show-detail') return store.showBySlug(slug)
  if (route.name === 'project-detail') return store.projectBySlug(slug)

  return null
}

function artGalleryStructuredData() {
  return {
    '@type': ['ArtGallery', 'EventVenue'],
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description: '광주 동구 충장로에 위치한 전시공간 및 전시 대관이 가능한 대안 예술 공간 Space DDF.',
    logo: absoluteUrl('/apple-touch-icon.png'),
    image: absoluteUrl(DEFAULT_IMAGE),
    sameAs: [
      'https://www.instagram.com/space.ddf',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressRegion: '광주광역시',
      addressLocality: '동구',
      streetAddress: '충장로46번길 8-8 1층',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'space.ddf@gmail.com',
        availableLanguage: ['ko', 'en'],
      },
    ],
  }
}

function detailStructuredData(item, canonical, description, image) {
  const { start, end } = parseDateRange(item.dateRange)
  const lastDate = end || start
  const completed = lastDate && lastDate < new Date()

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: item._kind === 'project' ? 'Project' : 'Show',
            item: canonical,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: compactText(item.title),
            item: canonical,
          },
        ],
      },
      {
        '@type': 'Event',
        '@id': `${canonical}#event`,
        name: compactText(item.title),
        description,
        url: canonical,
        image: [image],
        startDate: dateToIso(start),
        endDate: dateToIso(end || start),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: completed
          ? 'https://schema.org/EventCompleted'
          : 'https://schema.org/EventScheduled',
        location: {
          '@id': `${SITE_URL}/#organization`,
        },
        organizer: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      artGalleryStructuredData(),
    ],
  }
}

function homeStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: absoluteUrl('/'),
        name: SITE_NAME,
        inLanguage: ['ko-KR', 'en'],
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      artGalleryStructuredData(),
    ],
  }
}

function archiveStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/archive-map#webpage`,
        url: absoluteUrl('/archive-map'),
        name: ARCHIVE_TITLE,
        description: ARCHIVE_DESCRIPTION,
        inLanguage: 'ko-KR',
        isPartOf: {
          '@id': `${SITE_URL}/#website`,
        },
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      artGalleryStructuredData(),
    ],
  }
}

export function updateSeo(route, pinia) {
  const store = useContentStore(pinia)
  const item = getItem(route, store)
  const isNotFound = route.name === 'not-found'
  const isArchive = route.name === 'regional-archive'
  const isArchiveRoute = route.name === 'archive-route'
  const canonicalPath = item ? route.path : isArchive ? '/archive-map' : isArchiveRoute ? '/archive-route' : '/'
  const canonical = absoluteUrl(canonicalPath)
  const title = item
    ? `${compactText(item.title)} | ${SITE_NAME}`
    : isNotFound
      ? `페이지를 찾을 수 없습니다 | ${SITE_NAME}`
      : isArchive
        ? ARCHIVE_TITLE
        : isArchiveRoute
          ? ARCHIVE_ROUTE_TITLE
          : DEFAULT_TITLE
  const sourceDescription = item?.summary || item?.description || item?.body?.[0] || (isArchive ? ARCHIVE_DESCRIPTION : isArchiveRoute ? ARCHIVE_ROUTE_DESCRIPTION : DEFAULT_DESCRIPTION)
  const description = truncate(sourceDescription) || DEFAULT_DESCRIPTION
  const image = absoluteUrl(item?.hero || item?.thumb || DEFAULT_IMAGE)
  const robots = isNotFound ? 'noindex, nofollow' : DEFAULT_ROBOTS

  document.title = title
  setCanonical(canonicalPath)
  setMeta('name', 'description', description)
  setMeta('name', 'robots', robots)
  setMeta('property', 'og:type', item ? 'article' : 'website')
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', canonical)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:alt', item ? `${compactText(item.title)} 대표 이미지` : 'Space DDF 전시공간 대표 이미지')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', image)
  setMeta('name', 'twitter:image:alt', item ? `${compactText(item.title)} 대표 이미지` : 'Space DDF 전시공간 대표 이미지')

  if (item) {
    removeMeta('property', 'og:image:width')
    removeMeta('property', 'og:image:height')
  } else {
    setMeta('property', 'og:image:width', '1200')
    setMeta('property', 'og:image:height', '630')
  }

  setStructuredData(item
    ? detailStructuredData(item, canonical, description, image)
    : isArchive
      ? archiveStructuredData()
      : homeStructuredData())
}
