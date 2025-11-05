// src/stores/lib/content-getters.js
import { compareByRangeAsc } from './content-helpers'

export const contentGetters = {
  // 단건 조회
  projectBySlug: (state) => (slug) =>
    (state.projects || []).find(p => p.slug === slug) || null,
  showBySlug: (state) => (slug) =>
    (state.shows || []).find(s => s.slug === slug) || null,

  // 기본 정렬(오름차순: 과거→미래)
  projectsSorted: (state) =>
    [...(state.projects || [])].sort(compareByRangeAsc),
  showsSorted: (state) =>
    [...(state.shows || [])].sort(compareByRangeAsc),

  // 최신순(내림차순)
  projectsSortedDesc() {
    return [...(this.projects || [])].sort((a, b) => -compareByRangeAsc(a, b))
  },
  showsSortedDesc() {
    return [...(this.shows || [])].sort((a, b) => -compareByRangeAsc(a, b))
  },

  // ✅ 합치기 (_kind는 actions/빌더에서 이미 주입)
  allItems() {
    return [...(this.projects || []), ...(this.shows || [])]
  },

  // 합쳐서 정렬
  allSortedByDate() {
    return [...this.allItems].sort(compareByRangeAsc)
  },
  allSortedByDateDesc() {
    return [...this.allItems].sort((a, b) => -compareByRangeAsc(a, b))
  },

  // 최신 1건
  recent() {
    const arr = this.allSortedByDateDesc
    return arr.length ? arr[0] : null
  },

  // 편의 게터
  metaOf: () => (item) =>
    item ? (Array.isArray(item.credits) ? item.credits.join(', ') : (item.meta || '')) : '',

  thumbOf: (state) => (item) =>
    item?.thumb || state.defaultThumb,

  heroOf: (state) => (item) =>
    item?.hero || item?.thumb || state.defaultHero,

  // ✅ 링크는 _kind 기준
  linkOf: () => (item) => {
    if (!item) return '/shows'
    const kind = item._kind || item.type
    return kind === 'project' ? `/projects/${item.slug}` : `/shows/${item.slug}`
  },

  // Recent 편의
  recentMeta()  { return this.metaOf(this.recent)  },
  recentThumb() { return this.thumbOf(this.recent) },
  recentHero()  { return this.heroOf(this.recent)  },
  recentLink()  { return this.linkOf(this.recent)  },

  // (옵션) 디버그
  recentProject() { return this.projectsSortedDesc[0] || null },
  recentShow()    { return this.showsSortedDesc[0] || null },
}