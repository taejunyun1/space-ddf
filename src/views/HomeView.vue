<template>
  <div class="home-wrap">
    <h1 class="ddf-visually-hidden">Space DDF - 광주 충장로 대안 예술 공간</h1>

    <section class="col-left">
      <h3 class="code-block">Calendar</h3>

      <CalendarComponent class="calendar-card" />
    </section>

    <section class="col-center">
      <RecentComponent
        v-if="recent"
        :image-src="recentThumb"
        :title="recent.title"
        :link="recentLink"
        class="recent-card"
      />

      <RecentComponent
        v-else
        :image-src="recentThumb"
        title="준비 중"
        link="/shows"
        class="recent-card"
      />
    </section>

    <aside class="col-right">
      <div class="list-section" :class="{ 'is-bottom': projectAtBottom }">
        <h3 class="code-block">Project</h3>

        <ul
          ref="projectListRef"
          class="item-list"
          @scroll.passive="updateListState('project', $event)"
        >
          <li v-for="p in projects" :key="p.slug">
            <RouterLink
              class="row row-link"
              :to="`/projects/${p.slug}`"
              :aria-label="`${p.title} 상세로 이동`"
            >
              <div class="title">{{ p.title }}</div>
              <div class="date">{{ p.dateRange }}</div>
              <div class="meta">
                {{ formatItemCredits(p) }}
              </div>
            </RouterLink>
          </li>
        </ul>

        <button
          v-if="projectCanScroll"
          type="button"
          class="scroll-control-btn"
          :class="{ 'is-up': projectAtBottom }"
          :aria-label="projectAtBottom ? 'Project 목록 위로 이동' : 'Project 목록 아래로 이동'"
          @click="scrollList('project')"
        >
          {{ projectAtBottom ? '↑' : '↓' }}
        </button>
      </div>

      <div class="divider"></div>

      <div class="list-section" :class="{ 'is-bottom': showAtBottom }">
        <h3 class="code-block">Show</h3>

        <ul
          ref="showListRef"
          class="item-list"
          @scroll.passive="updateListState('show', $event)"
        >
          <li v-for="s in shows" :key="s.slug">
            <RouterLink
              class="row row-link"
              :to="`/shows/${s.slug}`"
              :aria-label="`${s.title} 상세로 이동`"
            >
              <div class="title">{{ s.title }}</div>
              <div class="date">{{ s.dateRange }}</div>
              <div class="meta">
                {{ formatItemCredits(s) }}
              </div>
            </RouterLink>
          </li>
        </ul>

        <button
          v-if="showCanScroll"
          type="button"
          class="scroll-control-btn"
          :class="{ 'is-up': showAtBottom }"
          :aria-label="showAtBottom ? 'Show 목록 위로 이동' : 'Show 목록 아래로 이동'"
          @click="scrollList('show')"
        >
          {{ showAtBottom ? '↑' : '↓' }}
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useContentStore } from '@/stores/content'
import RecentComponent from '@/components/RecentComponent.vue'
import CalendarComponent from '@/components/CalendarComponent.vue'
import { formatCreditSummary } from '@/lib/credit-links.js'

const store = useContentStore()

const projects = computed(() => store.projectsSortedDesc)
const shows = computed(() => store.showsSortedDesc)

const recent = computed(() => store.recent)
const recentThumb = computed(() => store.recentThumb)
const recentLink = computed(() => store.recentLink)

function formatItemCredits(item) {
  if (Array.isArray(item?.credits)) {
    return formatCreditSummary(item.credits)
  }

  return item?.meta || ''
}

const projectListRef = ref(null)
const showListRef = ref(null)

const projectAtBottom = ref(false)
const showAtBottom = ref(false)

const projectCanScroll = ref(false)
const showCanScroll = ref(false)

function getListTarget(type) {
  return type === 'project'
    ? projectListRef.value
    : showListRef.value
}

function setCanScroll(type, value) {
  if (type === 'project') {
    projectCanScroll.value = value
  } else {
    showCanScroll.value = value
  }
}

function setAtBottom(type, value) {
  if (type === 'project') {
    projectAtBottom.value = value
  } else {
    showAtBottom.value = value
  }
}

function updateListState(type, event = null) {
  const target = event?.currentTarget || getListTarget(type)

  if (!target) return

  const threshold = 4
  const canScroll = target.scrollHeight > target.clientHeight + threshold
  const atBottom =
    canScroll &&
    target.scrollTop + target.clientHeight >= target.scrollHeight - threshold

  setCanScroll(type, canScroll)
  setAtBottom(type, atBottom)
}

function updateAllListState() {
  updateListState('project')
  updateListState('show')
}

function scrollList(type) {
  const target = getListTarget(type)

  if (!target) return

  const isBottom = type === 'project'
    ? projectAtBottom.value
    : showAtBottom.value

  if (isBottom) {
    target.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  } else {
    target.scrollBy({
      top: Math.max(target.clientHeight * 0.75, 180),
      behavior: 'smooth',
    })
  }
}

onMounted(() => {
  nextTick(() => {
    updateAllListState()
  })

  window.addEventListener('resize', updateAllListState)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateAllListState)
})
</script>

<style scoped>

/* ===== 기본 레이아웃 ===== */
.home-wrap {
  --line: var(--ddf-line);
  --muted: var(--ddf-muted);
  --gap: var(--ddf-grid-gap);
  --page-x: var(--ddf-page-x);
  --top-card-height: 640px;
  --calendar-card-height: 640px;
  --bottom-list-height: 360px;

  width: 100%;
  max-width: 100vw;

  padding: 60px var(--page-x) 60px;
  margin: 0;

  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto auto;
  grid-template-areas:
    "left center"
    "right right";

  column-gap: var(--gap);
  row-gap: 34px;

  align-items: start;

  overflow-x: clip;
}

.col-left,
.col-center,
.col-right {
  min-width: 0;
  max-width: 100%;
}

/* ===== 상단 좌우 영역 ===== */
.col-left {
  grid-area: left;
  display: flex;
  flex-direction: column;
}

.col-center {
  grid-area: center;
  display: flex;
  flex-direction: column;
}

/* ===== 섹션 타이틀 ===== */
.code-block {
  width: 100%;

  font-family: 'D2Coding', monospace;
  font-size: 18px;
  line-height: 1.2;
  margin: 0 0 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* ===== Calendar / Recent 카드 높이 통일 ===== */
.calendar-card,
.recent-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.recent-card {
  height: auto;
}

.calendar-card {
  height: auto;
  min-height: var(--calendar-card-height);
  overflow: visible;
}

.calendar-card :deep(.ddf-calendar) {
  height: auto;
  min-height: var(--calendar-card-height);
}

.recent-card {
  display: flex;
  flex-direction: column;
}

.col-center :deep(.recent-content) {
  width: 100%;
  max-width: 100%;
  min-width: 0;

  height: auto;
  min-height: 0 !important;

  border: 1px solid var(--line) !important;
  background: #fff;

  box-sizing: border-box;
}

.col-center :deep(.recent-figure) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.col-center :deep(.recent-figure) {
  margin: 0;
  box-sizing: border-box;
}

.col-center :deep(.recent-figure img) {
  display: block;
  width: 100%;
  height: auto;
}

/* ===== 하단 Project / Show 영역 ===== */
.col-right {
  grid-area: right;

  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: var(--gap);

  width: 100%;
  min-width: 0;
  max-width: 100%;

  height: auto;
  min-height: 0;

  overflow: visible;

  align-items: start;
}

.list-section {
  position: relative;

  width: 100%;
  min-width: 0;
  max-width: 100%;

  height: var(--bottom-list-height);
  min-height: 0;

  display: flex;
  flex-direction: column;

  overflow: hidden;
}

.list-section::before {
  content: "";

  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;

  height: 44px;

  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0),
    rgba(255, 255, 255, 0.96)
  );

  pointer-events: none;
  z-index: 2;
}

.list-section.is-bottom::before {
  height: 28px;
  opacity: 0.65;
}

.item-list {
  width: 100%;
  min-width: 0;

  flex: 1 1 auto;
  min-height: 0;

  list-style: none;
  padding: 0 0 36px;
  margin: 0;

  border-top: 1px solid var(--line);

  overflow-y: auto;
  overflow-x: hidden;

  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scroll-behavior: smooth;
}

.item-list > li {
  margin: 0;
  padding: 0;
  min-width: 0;
}

/* 스크롤바 */
.item-list::-webkit-scrollbar {
  width: 6px;
}

.item-list::-webkit-scrollbar-track {
  background: transparent;
}

.item-list::-webkit-scrollbar-thumb {
  background: #BDBDBD;
  border-radius: 999px;
}

.item-list::-webkit-scrollbar-thumb:hover {
  background: #888;
}

.item-list {
  scrollbar-width: thin;
  scrollbar-color: #BDBDBD transparent;
}

/* ===== 스크롤 버튼 ===== */
.scroll-control-btn {
  position: absolute;
  left: 50%;
  bottom: 7px;

  transform: translateX(-50%);

  width: 22px;
  height: 22px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;
  margin: 0;

  font-family: 'D2Coding', monospace;
  font-size: 15px;
  font-weight: 700;
  line-height: 1;

  color: #1C1C1C;
  background: rgba(255, 255, 255, 0.94);

  border: 1px solid #1C1C1C;
  border-radius: 999px;

  cursor: pointer;
  z-index: 4;

  transition:
    transform 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.scroll-control-btn:hover {
  color: #fff;
  background: #1C1C1C;
  transform: translateX(-50%) translateY(1px);
}

.scroll-control-btn:active {
  transform: translateX(-50%) translateY(3px);
}

.scroll-control-btn:focus-visible {
  outline: 2px solid #1C1C1C;
  outline-offset: 3px;
}

.scroll-control-btn.is-up {
  background: #1C1C1C;
  color: #fff;
}

.scroll-control-btn.is-up:hover {
  background: #fff;
  color: #1C1C1C;
}

/* ===== Project / Show 행 ===== */
.row {
  width: 100%;
  min-width: 0;

  padding: 12px 0;

  border-bottom: 1px solid var(--line);

  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: 10px;
  row-gap: 4px;
}

.row-link {
  text-decoration: none;
  color: inherit;
}

.row-link:hover .title {
  text-decoration: underline;
}

.title {
  grid-column: 1 / 2;

  min-width: 0;

  font-weight: 600;
  font-size: 16px;
  line-height: 1.35;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date {
  grid-column: 2 / 3;

  color: var(--muted);
  font-size: 13px;
  line-height: 1.35;

  justify-self: end;
  align-self: start;

  white-space: nowrap;
}

.meta {
  grid-column: 1 / 3;

  min-width: 0;

  color: #444;
  font-size: 13px;
  line-height: 1.45;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.divider {
  display: none;
}

/* ===== 넓은 화면 ===== */
@media (min-width: 1440px) {
  .home-wrap {
    --top-card-height: 640px;
    --calendar-card-height: 640px;
    --bottom-list-height: 400px;
  }
}

/* ===== 중간 데스크톱 ===== */
@media (max-width: 1180px) {
  .home-wrap {
    --top-card-height: 560px;
    --calendar-card-height: 560px;
    --bottom-list-height: 380px;

    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 24px;
    row-gap: 28px;
  }
}

/* ===== 태블릿 이하 ===== */
@media (max-width: 1024px) {
  .home-wrap {
    --top-card-height: 500px;
    --calendar-card-height: 500px;
    --bottom-list-height: 360px;

    padding: 60px 16px 48px;
    gap: 18px;
  }

  .code-block {
    font-size: 14px;
    margin-bottom: 10px;
  }

  .title {
    font-size: 14px;
  }

  .date,
  .meta {
    font-size: 11px;
  }

  .scroll-control-btn {
    font-size: 14px;
  }
}

/* ===== 모바일 ===== */
@media (max-width: 768px) {
  .home-wrap {
    --top-card-height: auto;
    --bottom-list-height: auto;

    grid-template-columns: 1fr;
    grid-template-areas:
      "center"
      "right"
      "left";

    gap: 22px;
    padding: 56px 14px 44px;
  }

  .calendar-card,
  .recent-card {
    height: auto;
  }

  .calendar-card,
  .calendar-card :deep(.ddf-calendar) {
    min-height: 0;
  }

  .calendar-card {
    overflow: visible;
  }

  .col-center :deep(.recent-content) {
    height: auto;
    min-height: 0 !important;
  }

  .col-right {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .list-section {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .item-list {
    flex: none;

    max-height: 300px;
    min-height: 0;

    padding-bottom: 42px;

    overflow-y: auto;
    overflow-x: hidden;
  }

  .divider {
    display: block;
    height: 6px;
  }

  .row {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 3px;
  }

  .title,
  .date,
  .meta {
    grid-column: 1 / 2;
  }

  .title {
    font-size: 15px;
    white-space: normal;
    overflow: visible;
    text-overflow: initial;
  }

  .date {
    justify-self: start;
    font-size: 12px;
  }

  .meta {
    font-size: 12px;
  }
}

/* ===== 작은 모바일 ===== */
@media (min-width: 321px) and (max-width: 440px) {
  .home-wrap {
    gap: 18px;
    padding: 56px 14px 40px;
  }

  .item-list {
    max-height: 280px;
  }

  .title {
    font-size: 14px;
  }

  .date,
  .meta {
    font-size: 12px;
  }
}

/* ===== 초소형 ===== */
@media (max-width: 320px) {
  .home-wrap {
    gap: 16px;
    padding: 52px 12px 36px;
  }

  .code-block {
    font-size: 13px;
  }

  .item-list {
    max-height: 260px;
    padding-bottom: 40px;
  }

  .scroll-control-btn {
    width: 26px;
    height: 26px;
    font-size: 15px;
  }

  .title {
    font-size: 14px;
  }

  .date,
  .meta {
    font-size: 11px;
  }
}
.calendar-card :deep(.ddf-calendar),
.calendar-card :deep(.ddf-calendar-grid),
.calendar-card :deep(.ddf-calendar-day) {
  overflow: visible;
}
</style>
