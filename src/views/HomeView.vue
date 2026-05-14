<template>
  <div class="home-wrap">
    <section class="col-left">
      <h3 class="code-block">Location</h3>

      <figure class="map-box">
        <iframe
          class="map-iframe"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3262.2521703589455!2d126.90988227667317!3d35.150331258953756!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x35718dcb0676ea25%3A0xe52a9bee2121a68e!2z7Iqk7Y6Y7J207IqkIOuUlOuUlOyXkO2UhA!5e0!3m2!1sko!2skr!4v1754984708875!5m2!1sko!2skr"
          loading="lazy"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          title="스페이스 디디에프 위치 지도"
        ></iframe>
      </figure>

      <div class="place-info">
        <div>
          <div class="place-name">스페이스 디디에프</div>
          <div class="contact">
            <a href="mailto:space.ddf@gmail.com" aria-label="이메일로 문의하기">
              Space.ddf@gmail.com
            </a>
          </div>
        </div>

        <div class="addr">광주광역시 동구 충장로46-4 1층 스페이스 디디에프</div>
        <div class="hours">운영시간 11:00~18:00 / 월요일 및 공휴일 휴관</div>
      </div>
    </section>

    <section class="col-center">
      <RecentComponent
        v-if="recent"
        :image-src="recentThumb"
        :title="recent.title"
        :date-range="recent.dateRange"
        :desc="recentMeta"
        :link="recentLink"
        class="recent-card"
      />

      <RecentComponent
        v-else
        :image-src="recentThumb"
        title="준비 중"
        date-range=""
        desc="전시/프로젝트 업데이트를 기다려주세요."
        link="/shows"
        class="recent-card"
      />
    </section>

    <aside class="col-right">
      <div
        class="list-section"
        :class="{ 'is-bottom': projectAtBottom }"
      >
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
                {{ Array.isArray(p.credits) ? p.credits.join(', ') : (p.meta || '') }}
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

      <div
        class="list-section"
        :class="{ 'is-bottom': showAtBottom }"
      >
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
                {{ Array.isArray(s.credits) ? s.credits.join(', ') : (s.meta || '') }}
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

const store = useContentStore()

const projects = computed(() => store.projectsSortedDesc)
const shows = computed(() => store.showsSortedDesc)

const recent = computed(() => store.recent)
const recentMeta = computed(() => store.recentMeta)
const recentThumb = computed(() => store.recentThumb)
const recentLink = computed(() => store.recentLink)

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
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* ===== 기본 레이아웃 ===== */
.home-wrap {
  --line: #1C1C1C;
  --muted: #666;
  --gap: clamp(16px, 1.6vw, 28px);
  --page-x: clamp(18px, 3.5vw, 56px);
  --visual-max: 560px;

  width: 100%;
  max-width: 100vw;

  padding: 60px var(--page-x) 60px;
  margin: 0;

  display: grid;
  grid-template-columns:
    minmax(260px, 0.9fr)
    minmax(320px, 1.15fr)
    minmax(280px, 0.85fr);
  grid-template-areas: "left center right";
  gap: var(--gap);

  align-items: start;

  overflow-x: clip;
}

.col-left,
.col-center,
.col-right {
  min-width: 0;
  max-width: 100%;
}

.col-left {
  grid-area: left;

  display: flex;
  flex-direction: column;
  align-items: center;
}

.col-center {
  grid-area: center;

  display: flex;
  justify-content: center;
}

/* ===== 오른쪽 컬럼 ===== */
.col-right {
  grid-area: right;

  display: flex;
  flex-direction: column;
  gap: 16px;

  min-width: 0;
  max-width: 100%;

  height: calc(100vh - 120px);
  min-height: 0;

  overflow: hidden;
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

.col-left > .code-block,
.col-center :deep(.code-block) {
  max-width: var(--visual-max);
}

/* ===== 왼쪽 지도 ===== */
.map-box {
  width: 100%;
  max-width: var(--visual-max);
  margin: 0;

  aspect-ratio: 4 / 5;

  border: 1px solid var(--line);
  overflow: hidden;
}

.map-iframe {
  display: block;
  width: 100%;
  height: 100%;

  border: 0;
}

/* ===== 장소 정보 ===== */
.place-info {
  width: 100%;
  max-width: var(--visual-max);

  margin-top: 10px;

  font-size: 13px;
  line-height: 1.45;
  color: #333;

  display: grid;
  gap: 4px;
}

.place-info > div:first-child {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: 12px;
  align-items: start;
}

.place-name {
  min-width: 0;
  font-weight: 700;
  word-break: keep-all;
}

.contact {
  min-width: 0;
  justify-self: end;
}

.contact a {
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}

.contact a:hover {
  text-decoration: underline;
}

.addr,
.hours {
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* ===== 가운데 RecentComponent 보정 ===== */
.recent-card {
  width: 100%;
  max-width: var(--visual-max);
  min-width: 0;
}

.col-center :deep(.recent-content) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.col-center :deep(.recent-figure) {
  width: 100%;
  max-width: 100%;
  margin: 0;
  box-sizing: border-box;
}

.col-center :deep(.recent-figure img) {
  display: block;
  width: 100%;
  height: auto;
}

.col-center :deep(.recent-meta) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

/* ===== 오른쪽 리스트 섹션 ===== */
.list-section {
  position: relative;

  width: 100%;
  min-width: 0;
  min-height: 0;

  display: flex;
  flex-direction: column;
}

/* Project 영역 */
.col-right .list-section:first-child {
  flex: 0 1 42%;
  min-height: 160px;
  max-height: 42%;
}

/* Show 영역 */
.col-right .list-section:last-child {
  flex: 1 1 auto;
  min-height: 0;
}

/* 하단 흐림 효과 */
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

/* 최하단에 도달했을 때 하단 흐림 축소 */
.list-section.is-bottom::before {
  height: 28px;
  opacity: 0.65;
}

/* 제목은 고정, 리스트만 스크롤 */
.item-list {
  width: 100%;
  min-width: 0;
  min-height: 0;

  flex: 1 1 auto;

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

/* ===== 아래/위 이동 버튼 ===== */
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
    color 0.18s ease,
    bottom 0.18s ease;
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

/* 최하단에서는 위로 가는 버튼 느낌 */
.scroll-control-btn.is-up {
  background: #1C1C1C;
  color: #fff;
}

.scroll-control-btn.is-up:hover {
  background: #fff;
  color: #1C1C1C;
}

/* ===== 공통 행 레이아웃 ===== */
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

/* ===== Project / Show 타이포그래피 ===== */
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
  flex: 0 0 auto;
  height: 8px;
}

/* ===== 1280px 이상 ===== */
@media (min-width: 1280px) {
  .home-wrap {
    --visual-max: 580px;

    grid-template-columns:
      minmax(300px, 0.95fr)
      minmax(380px, 1.2fr)
      minmax(300px, 0.85fr);
  }
}

/* ===== 중간 데스크톱 ===== */
@media (max-width: 1180px) {
  .home-wrap {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "left center"
      "right right";
    gap: 24px;
  }

  .col-center {
    justify-content: center;
  }

  .col-right {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 24px;
    row-gap: 16px;

    height: auto;
    min-height: 0;

    overflow: visible;
  }

  .col-right .list-section:first-child,
  .col-right .list-section:last-child {
    min-height: 0;
    max-height: 420px;
  }

  .item-list {
    max-height: 360px;
  }

  .divider {
    display: none;
  }
}

/* ===== 태블릿 이하 ===== */
@media (max-width: 1024px) {
  .home-wrap {
    --visual-max: 100%;

    padding: 60px 16px 48px;
    gap: 18px;
  }

  .code-block {
    font-size: 14px;
    margin-bottom: 10px;
  }

  .map-box {
    aspect-ratio: 4 / 5;
  }

  .place-info {
    font-size: 11px;
  }

  .title {
    font-size: 14px;
  }

  .date,
  .meta {
    font-size: 11px;
  }

  .scroll-control-btn {
    width: 22px;
    height: 22px;
    font-size: 14px;
  }
}

/* ===== 모바일: 1컬럼 ===== */
@media (max-width: 768px) {
  .home-wrap {
    grid-template-columns: 1fr;
    grid-template-areas:
      "left"
      "center"
      "right";

    gap: 22px;
    padding: 56px 14px 44px;
  }

  .col-center {
    justify-content: stretch;
  }

  .map-box {
    aspect-ratio: 1 / 1;
  }

  .col-right {
    display: flex;
    flex-direction: column;
    gap: 18px;

    height: auto;
    min-height: 0;

    overflow: visible;
  }

  .col-right .list-section:first-child,
  .col-right .list-section:last-child {
    flex: none;
    min-height: 0;
    max-height: none;
  }

  .list-section {
    min-height: 0;
  }

  .list-section::before {
    display: block;
    height: 38px;
  }

  .list-section.is-bottom::before {
    height: 24px;
    opacity: 0.55;
  }

  .item-list {
    flex: none;

    max-height: 300px;
    min-height: 0;

    padding-bottom: 42px;

    overflow-y: auto;
    overflow-x: hidden;

    border-top: 1px solid var(--line);
  }

  .scroll-control-btn {
    display: flex;

    width: 22px;
    height: 22px;

    bottom: 8px;

    font-size: 15px;

    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #1C1C1C;
  }

  .divider {
    display: block;
    height: 6px;
  }

  .place-info > div:first-child {
    grid-template-columns: 1fr;
    row-gap: 2px;
  }

  .contact {
    justify-self: start;
  }

  .contact a {
    white-space: normal;
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

/* ===== 작은 모바일: 321px ~ 440px ===== */
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

/* ===== 초소형: ≤320px ===== */
@media (max-width: 320px) {
  .home-wrap {
    gap: 16px;
    padding: 52px 12px 36px;
  }

  .code-block {
    font-size: 13px;
  }

  .place-info {
    font-size: 10.5px;
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
</style>