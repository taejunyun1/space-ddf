// src/stores/lib/content-getters.js
import { compareByRangeAsc } from './content-helpers'

const safeArray = (value) => (Array.isArray(value) ? value : [])

const sortByRangeAsc = (items) => {
  return [...safeArray(items)].sort(compareByRangeAsc)
}

const sortByRangeDesc = (items) => {
  return [...safeArray(items)].sort((a, b) => compareByRangeAsc(b, a))
}

const getItemKind = (item) => {
  return item?._kind || item?.type || null
}

const getItemLink = (item) => {
  if (!item?.slug) return '/shows'

  const kind = getItemKind(item)

  if (kind === 'project') {
    return `/projects/${item.slug}`
  }

  return `/shows/${item.slug}`
}

const getItemMeta = (item) => {
  if (!item) return ''

  if (Array.isArray(item.credits)) {
    return item.credits.join(', ')
  }

  return item.meta || ''
}

export const contentGetters = {
  // 단건 조회
  projectBySlug: (state) => (slug) => {
    return safeArray(state.projects).find((project) => project.slug === slug) || null
  },

  showBySlug: (state) => (slug) => {
    return safeArray(state.shows).find((show) => show.slug === slug) || null
  },

  // 기본 정렬: 과거 → 미래
  projectsSorted: (state) => {
    return sortByRangeAsc(state.projects)
  },

  showsSorted: (state) => {
    return sortByRangeAsc(state.shows)
  },

  // 최신순: 미래/최신 → 과거
  projectsSortedDesc: (state) => {
    return sortByRangeDesc(state.projects)
  },

  showsSortedDesc: (state) => {
    return sortByRangeDesc(state.shows)
  },

  // 전체 아이템
  allItems: (state) => {
    return [
      ...safeArray(state.projects),
      ...safeArray(state.shows),
    ]
  },

  // 전체 정렬
  allSortedByDate() {
    return sortByRangeAsc(this.allItems)
  },

  allSortedByDateDesc() {
    return sortByRangeDesc(this.allItems)
  },

  // 최신 1건
  recent() {
    return this.allSortedByDateDesc[0] || null
  },

  // 편의 게터
  metaOf: () => getItemMeta,

  thumbOf: (state) => (item) => {
    return item?.thumb || state.defaultThumb
  },

  heroOf: (state) => (item) => {
    return item?.hero || item?.thumb || state.defaultHero
  },

  linkOf: () => getItemLink,

  // Recent 편의
  recentMeta() {
    return this.metaOf(this.recent)
  },

  recentThumb() {
    return this.thumbOf(this.recent)
  },

  recentHero() {
    return this.heroOf(this.recent)
  },

  recentLink() {
    return this.linkOf(this.recent)
  },

  // 디버그 / 개발용
  recentProject() {
    return this.projectsSortedDesc[0] || null
  },

  recentShow() {
    return this.showsSortedDesc[0] || null
  },
}