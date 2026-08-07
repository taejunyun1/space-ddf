<template>
  <div class="archive-home">
    <h1 class="ddf-visually-hidden">Space DDF - 광주 충장로 대안 예술 공간</h1>

    <section v-if="currentShow" class="archive-hero" aria-labelledby="current-show-title">
      <RouterLink class="archive-hero-poster" :to="recentLink">
        <img
          :src="recentHero"
          :alt="`${currentShow.title} 포스터`"
          fetchpriority="high"
          decoding="async"
        />
        <span class="archive-hero-poster-meta">
          <b>{{ recentKindLabel }}</b>
          <span>{{ currentShow.dateRange }}</span>
        </span>
      </RouterLink>

      <div class="archive-hero-info">
        <p class="archive-index-label">Now showing / 01</p>
        <div class="archive-hero-copy">
          <h2 id="current-show-title">{{ currentShow.title }}</h2>
          <dl>
            <div v-if="currentShow.dateRange">
              <dt>Date</dt>
              <dd>{{ currentShow.dateRange }}</dd>
            </div>
            <div v-if="recentLocation">
              <dt>Location</dt>
              <dd>{{ recentLocation }}</dd>
            </div>
            <div v-if="recentHours">
              <dt>Hours</dt>
              <dd>{{ recentHours }}</dd>
            </div>
          </dl>
          <p v-if="recentDescription" class="archive-hero-description">
            {{ recentDescription }}
          </p>
        </div>
        <RouterLink class="archive-outline-cta" :to="recentLink">
          전시 정보 보기 <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </section>

    <section v-else class="archive-empty-hero">
      <p class="archive-index-label">Now showing</p>
      <h2>다음 전시를 준비하고 있습니다.</h2>
    </section>

    <section class="archive-recent" aria-labelledby="recent-heading">
      <header class="archive-section-heading">
        <h2 id="recent-heading">Recent Updated</h2>
        <span>{{ recentItems.length }} records</span>
      </header>
      <div class="archive-poster-strip">
        <RouterLink
          v-for="item in recentItems"
          :key="`${item._kind || item.type}-${item.slug}`"
          class="archive-poster-link"
          :to="store.linkOf(item)"
          :aria-label="`${item.title} 상세 보기`"
        >
          <img :src="store.thumbOf(item)" :alt="`${item.title} 포스터`" loading="lazy" decoding="async" />
          <span class="ddf-visually-hidden">{{ item.title }} · {{ item.dateRange }}</span>
        </RouterLink>
      </div>
    </section>

    <div class="archive-lower-grid">
      <section class="archive-content-index" aria-label="Show와 Project 최신 목록">
        <div id="show" class="archive-index-column">
          <header class="archive-section-heading">
            <h2>Show</h2>
            <span>{{ shows.length }}</span>
          </header>
          <ol class="archive-record-list">
            <li v-for="(show, index) in shows" :key="show.slug">
              <RouterLink :to="`/shows/${show.slug}`">
                <span class="archive-record-number">{{ padIndex(index) }}</span>
                <span class="archive-record-title">{{ show.title }}</span>
                <time>{{ show.dateRange }}</time>
                <small>{{ formatItemCredits(show) }}</small>
              </RouterLink>
            </li>
          </ol>
        </div>

        <div id="project" class="archive-index-column">
          <header class="archive-section-heading">
            <h2>Project</h2>
            <span>{{ projects.length }}</span>
          </header>
          <ol class="archive-record-list">
            <li v-for="(project, index) in projects" :key="project.slug">
              <RouterLink :to="`/projects/${project.slug}`">
                <span class="archive-record-number">{{ padIndex(index) }}</span>
                <span class="archive-record-title">{{ project.title }}</span>
                <time>{{ project.dateRange }}</time>
                <small>{{ formatItemCredits(project) }}</small>
              </RouterLink>
            </li>
          </ol>
        </div>
      </section>

      <section class="exhibition-field" aria-labelledby="field-heading">
        <header class="archive-section-heading">
          <h2 id="field-heading">Exhibition Field</h2>
          <span>Gwangju · Jeonbuk · Jeonnam</span>
        </header>
        <nav aria-label="지역 전시 탐색">
          <RouterLink to="/archive-map">
            <span class="field-mark" aria-hidden="true">⌖</span>
            <span><b>전시 아카이브</b><small>진행 중인 전시를 지도와 목록으로 탐색</small></span>
            <span aria-hidden="true">MAP →</span>
          </RouterLink>
          <RouterLink to="/archive-map?mode=radar">
            <span class="field-mark" aria-hidden="true">◉</span>
            <span><b>전시 레이더</b><small>현재 위치에서 가까운 전시 확인</small></span>
            <span aria-hidden="true">NOW →</span>
          </RouterLink>
          <RouterLink to="/archive-route">
            <span class="field-mark" aria-hidden="true">↗</span>
            <span><b>경로 만들기</b><small>여러 전시장을 골라 경유 경로 구성</small></span>
            <span aria-hidden="true">ROUTE →</span>
          </RouterLink>
        </nav>
      </section>
    </div>

    <RouterLink class="archive-rental-cta" to="/rental">
      <span><b>Space Rental</b> / 전시·워크숍 대관 문의</span>
      <span>일정 확인 및 신청 <span aria-hidden="true">↗</span></span>
    </RouterLink>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useContentStore } from '@/stores/content'
import { formatCreditSummary } from '@/lib/credit-links.js'
import { selectCurrentShow, sortByPublishedAtDesc } from '@/lib/home-content.js'

const store = useContentStore()
const projects = computed(() => store.projectsSortedDesc)
const shows = computed(() => store.showsSortedDesc)
const currentShow = computed(() => selectCurrentShow(store.shows, store.featuredContent))
const recentHero = computed(() => store.heroOf(currentShow.value))
const recentLink = computed(() => store.linkOf(currentShow.value))
const recentItems = computed(() => sortByPublishedAtDesc(store.allItems))
const recentKindLabel = computed(() => 'Show')
const recentLocation = computed(() => currentShow.value?.location || currentShow.value?.venue || '')
const recentHours = computed(() => currentShow.value?.hours || currentShow.value?.openingHours || '')
const recentDescription = computed(() => {
  const value = currentShow.value?.summary || currentShow.value?.excerpt || currentShow.value?.body || ''
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 150)
})

function padIndex(index) {
  return String(index + 1).padStart(2, '0')
}

function formatItemCredits(item) {
  if (Array.isArray(item?.credits)) return formatCreditSummary(item.credits)
  return item?.meta || ''
}
</script>

<style scoped>
.archive-home { width: 100%; padding: var(--ddf-page-top) var(--ddf-page-x) 0; overflow-x: clip; }
.archive-hero { min-height: min(68vh, 680px); display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(260px, .65fr); border: 1px solid var(--ddf-line); background: var(--ddf-paper); }
.archive-hero-poster { position: relative; display: grid; place-items: center; min-width: 0; padding: var(--ddf-space-4); border-right: 1px solid var(--ddf-line); color: inherit; background: var(--ddf-paper-soft); overflow: hidden; }
.archive-hero-poster img { display: block; width: 100%; height: 100%; max-height: 640px; object-fit: contain; }
.archive-hero-poster-meta { position: absolute; inset: auto var(--ddf-space-6) var(--ddf-space-6); display: flex; justify-content: space-between; gap: 12px; padding: 7px 9px; color: #fff; background: rgba(23,23,23,.88); font: 10px/1.2 var(--ddf-font-mono); }
.archive-hero-info { display: flex; flex-direction: column; padding: var(--ddf-space-4); }
.archive-index-label { margin: 0; color: var(--ddf-muted); font: 11px/1.2 var(--ddf-font-mono); text-transform: uppercase; }
.archive-hero-copy { margin: auto 0; }
.archive-hero-copy h2 { margin: 0 0 28px; max-width: 100%; font-size: clamp(30px, 3vw, 44px); line-height: .92; letter-spacing: -.075em; overflow-wrap: anywhere; word-break: keep-all; }
.archive-hero-copy dl { margin: 0 0 22px; }
.archive-hero-copy dl div { display: grid; grid-template-columns: 70px 1fr; gap: 8px; padding: 8px 0; border-top: 1px solid var(--ddf-line-soft); font-size: 12px; }
.archive-hero-copy dt { font-family: var(--ddf-font-mono); color: var(--ddf-muted); }.archive-hero-copy dd { margin: 0; }
.archive-hero-description { margin: 0; font-size: 13px; line-height: 1.55; }
.archive-outline-cta { display: flex; justify-content: space-between; min-height: 44px; padding: 13px 12px; border: 1px solid var(--ddf-line); color: inherit; text-decoration: none; font-weight: 700; font-size: 12px; }
.archive-outline-cta:hover { background: var(--ddf-ink); color: #fff; }
.archive-empty-hero { padding: 80px 24px; border: 1px solid; }.archive-empty-hero h2 { font-size: clamp(30px, 5vw, 72px); }
.archive-recent { margin-top: var(--ddf-space-8); }
.archive-section-heading { min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--ddf-line); }
.archive-section-heading h2 { margin: 0; font: 700 13px/1.2 var(--ddf-font-mono); text-transform: uppercase; }.archive-section-heading span { color: var(--ddf-muted); font: 10px/1.2 var(--ddf-font-mono); }
.archive-poster-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-left: 1px solid var(--ddf-line); }
.archive-poster-link { min-width: 0; aspect-ratio: 3/4; padding: 7px; border-right: 1px solid var(--ddf-line); border-bottom: 1px solid var(--ddf-line); background: #fff; }
.archive-poster-link img { width: 100%; height: 100%; display: block; object-fit: cover; }
.archive-lower-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .55fr); margin-top: var(--ddf-space-8); border-top: 1px solid; }
.archive-content-index { display: grid; grid-template-columns: 1fr 1fr; border-left: 1px solid; }.archive-index-column { min-width: 0; border-right: 1px solid; }
.archive-index-column .archive-section-heading, .exhibition-field .archive-section-heading { padding: 0 12px; }
.archive-record-list { margin: 0; padding: 0; list-style: none; }.archive-record-list a { display: grid; grid-template-columns: 28px minmax(0,1fr) auto; gap: 7px; padding: 12px; border-bottom: 1px solid var(--ddf-line-soft); color: inherit; text-decoration: none; }.archive-record-list a:hover { background: var(--ddf-paper-soft); }
.archive-record-number, .archive-record-list time { color: var(--ddf-muted); font: 9px/1.4 var(--ddf-font-mono); }.archive-record-title { min-width: 0; font-size: 12px; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.archive-record-list small { grid-column: 2/4; color: var(--ddf-muted); font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.exhibition-field { min-width: 0; border-right: 1px solid; }.exhibition-field nav a { display: grid; grid-template-columns: 26px minmax(0,1fr) auto; align-items: center; gap: 9px; min-height: 68px; padding: 10px 12px; border-bottom: 1px solid; color: inherit; text-decoration: none; }.exhibition-field nav a:hover { background: var(--ddf-route); }.field-mark { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--ddf-route); font-size: 11px; }.exhibition-field b,.exhibition-field small { display: block; }.exhibition-field b { font-size: 12px; }.exhibition-field small { margin-top: 3px; color: var(--ddf-muted); font-size: 9px; line-height: 1.35; }.exhibition-field nav a > span:last-child { font: 9px/1 var(--ddf-font-mono); }
.archive-rental-cta { display: flex; justify-content: space-between; align-items: center; gap: 20px; min-height: 58px; margin-top: var(--ddf-space-8); padding: 0 var(--ddf-space-4); background: var(--ddf-ink); color: #fff; text-decoration: none; font: 11px/1.3 var(--ddf-font-mono); }.archive-rental-cta:hover { background: var(--ddf-signal); }

@media (max-width: 1100px) { .archive-hero { grid-template-columns: minmax(0,1.35fr) minmax(240px,.65fr); }.archive-lower-grid { grid-template-columns: 1fr; }.exhibition-field { border-left: 1px solid; }.archive-poster-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 768px) {
  .archive-home { padding: 56px 12px 0; }
  .archive-hero { min-height: 0; grid-template-columns: 1fr; }
  .archive-hero-poster { min-height: 62vh; border-right: 0; border-bottom: 1px solid; padding: 9px; }
  .archive-hero-poster-meta { inset: auto 16px 16px; }
  .archive-hero-info { padding: 12px; }
  .archive-hero-copy { margin: 18px 0 14px; }.archive-hero-copy h2 { margin-bottom: 16px; font-size: clamp(32px, 12vw, 52px); }.archive-hero-description { display: none; }
  .archive-poster-strip { grid-template-columns: minmax(0, 1fr); }
  .archive-content-index { grid-template-columns: 1fr; }.archive-index-column { border-bottom: 1px solid; }
  .archive-record-list a { grid-template-columns: 24px minmax(0,1fr); }.archive-record-list time { grid-column: 2; }.archive-record-list small { grid-column: 2; }
  .archive-lower-grid { margin-top: 24px; }.exhibition-field { background: var(--ddf-paper-soft); }
  .archive-rental-cta { min-height: 64px; margin: 24px -12px 0; padding: 10px 16px; background: var(--ddf-signal); }
  .archive-rental-cta > span:last-child { text-align: right; }
  .archive-record-title, .exhibition-field b, .archive-rental-cta { font-size: 15px; }
  .archive-record-list time, .archive-record-list small, .exhibition-field small { font-size: 12px; }
}
</style>
