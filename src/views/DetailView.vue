<template>
  <article class="detail-wrap">
    <div class="main">
      <header class="detail-head">
        <h1 class="detail-title chip">{{ item?.title }}</h1>
      </header>

      <section class="content-grid">
        <div class="poster-row">
          <figure
            v-if="item?.hero"
            class="poster"
            role="button"
            tabindex="0"
            aria-label="대표 이미지 크게 보기"
            @click="openLightbox(0)"
            @keyup.enter="openLightbox(0)"
          >
            <img
              :src="item.preview || item.hero"
              :alt="`${item.title} 대표 이미지`"
              loading="eager"
              decoding="async"
              fetchpriority="high"
            />
          </figure>

          <div
            v-if="item?.credits?.length || item?.dateRange || item?.location"
            class="credit-block"
          >
            <p
              v-if="item?.dateRange"
              class="detail-date chip date-chip"
              style="margin-top:0"
            >
              {{ item?.dateRange }}
            </p>

            <p
              v-for="group in creditGroups"
              :key="group.label"
              class="credit-line"
            >
              <span class="credit-label">{{ group.label }}</span>
              <span v-if="group.entries.length" class="credit-values">
                <template v-for="(entry, entryIndex) in group.entries" :key="`${group.label}-${entryIndex}`">
                  <span v-if="entryIndex" class="credit-separator">, </span>
                  <template v-if="entry.kind === 'instagram'">
                    <span>{{ entry.value }}</span>
                    <a
                      class="instagram-link"
                      :href="entry.href"
                      :aria-label="`${entry.value || group.label} Instagram 열기`"
                      target="_blank"
                      rel="noopener noreferrer"
                    ><InstagramIcon /></a>
                  </template>
                  <a
                    v-else-if="entry.href"
                    :href="entry.href"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ entry.value || entry.linkLabel }}</a>
                  <span v-else>{{ entry.value }}</span>
                </template>
              </span>
            </p>

            <p v-if="item?.location" class="location-line">
              <strong>Location</strong> · {{ item.location }}
            </p>
          </div>
        </div>

        <div class="text-row">
          <div v-if="item?.body?.length" class="body-block">
            <p
              v-for="(para, i) in item.body"
              :key="'body' + i"
              class="body-text"
            >
              {{ para }}
            </p>
          </div>

          <div v-if="descriptionParas.length" class="desc-block">
            <p
              v-for="(d, i) in descriptionParas"
              :key="'desc' + i"
              class="desc-text"
            >
              {{ d }}
            </p>
          </div>
        </div>
      </section>

      <section v-if="item?.gallery?.length" class="gallery">
        <figure
          v-for="(g, i) in item.gallery"
          :key="i"
          class="gal-item"
          role="button"
          tabindex="0"
          :aria-label="`${item.title} 갤러리 이미지 ${i + 1} 크게 보기`"
          @click="openLightbox(item?.hero ? i + 1 : i)"
          @keyup.enter="openLightbox(item?.hero ? i + 1 : i)"
        >
          <img
            :src="typeof g === 'string' ? g : g.src"
            :srcset="typeof g === 'object' ? g.srcset : undefined"
            :sizes="typeof g === 'object' ? g.sizes : undefined"
            :alt="(typeof g === 'object' && g.alt) || `${item.title} 전시 이미지 ${i + 1}`"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          />
          <figcaption v-if="typeof g === 'object' && g.caption">
            {{ g.caption }}
          </figcaption>
        </figure>
      </section>
    </div>

    <aside class="side">
      <div class="sticky-wrap">
        <div
          class="panel list-section"
          :class="{
            'is-bottom': sideAtBottom,
            'can-scroll': sideCanScroll
          }"
        >
          <div class="code-block panel-wrap">
            <div>
              <h3 class="panel-title">{{ typeLabel }}</h3>
            </div>

            <div>
              <RouterLink class="back-link" to="/">← Back to Home</RouterLink>
            </div>
          </div>

          <ul
            ref="sideListRef"
            class="item-list side-list"
            @scroll.passive="updateSideListState"
          >
            <li v-for="it in sideList" :key="it.slug">
              <RouterLink
                :to="makeTo(it)"
                class="side-item row row-link"
                :class="{ active: it.slug === slug }"
                :aria-label="`${it.title} 상세로 이동`"
              >
                <div class="title side-title">{{ it.title }}</div>
                <div class="date side-date">{{ it.dateRange }}</div>
                <div class="meta side-meta">
                  {{ formatSideCredits(it) }}
                </div>
              </RouterLink>
            </li>
          </ul>

          <button
            v-if="sideCanScroll"
            type="button"
            class="scroll-control-btn"
            :class="{ 'is-up': sideAtBottom }"
            :aria-label="sideAtBottom ? `${typeLabel} 목록 위로 이동` : `${typeLabel} 목록 아래로 이동`"
            @click="scrollSideList"
          >
            {{ sideAtBottom ? '↑' : '↓' }}
          </button>
        </div>
      </div>
    </aside>
  </article>

  <vue-easy-lightbox
    :visible="lightboxVisible"
    :index="lightboxIndex"
    :imgs="[
      ...(item?.hero ? [item.hero] : []),
      ...((item?.gallery || []).map(g => (typeof g === 'string' ? g : (g.original || g.src))))
    ]"
    :maskClosable="true"
    :escDisabled="false"
    :downloadButton="false"
    @hide="lightboxVisible = false"
  />
</template>

<script setup>
import {
  ref,
  computed,
  watchEffect,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useContentStore } from '@/stores/content'
import VueEasyLightbox from 'vue-easy-lightbox'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'
import { groupContentCredits } from '@/lib/credit-links.js'

const props = defineProps({
  type: { type: String, required: false },
  slug: { type: String, required: false },
})

const route = useRoute()
const router = useRouter()
const store = useContentStore()

const type = computed(() => {
  if (props.type) return props.type

  const name = route.name?.toString() || ''
  return name.includes('project') ? 'project' : 'show'
})

const slug = computed(() => props.slug || route.params.slug)

const item = computed(() => {
  const s = slug.value

  return type.value === 'project'
    ? store.projectBySlug(s)
    : store.showBySlug(s)
})

const collection = computed(() =>
  type.value === 'project'
    ? store.projectsSortedDesc
    : store.showsSortedDesc
)

const sideList = computed(() => collection.value || [])

const typeLabel = computed(() =>
  type.value === 'project' ? 'Project' : 'Show'
)

const makeTo = (it) =>
  type.value === 'project'
    ? `/projects/${it.slug}`
    : `/shows/${it.slug}`

function formatSideCredits(it) {
  if (!it) return ''

  if (Array.isArray(it.credits)) {
    return it.credits
      .map(c => String(c || '').trim())
      .filter(Boolean)
      .join(', ')
  }

  return it.meta || it.summary || ''
}

watchEffect(() => {
  if (!slug.value) return

  if (!item.value) {
    const target =
      router.hasRoute && router.hasRoute('not-found')
        ? { name: 'not-found' }
        : { path: '/' }

    router.replace(target)
  }
})

const descriptionParas = computed(() => {
  const d = item.value?.description ?? item.value?.desc

  if (!d) return []

  return Array.isArray(d) ? d : [d]
})

const creditGroups = computed(() => {
  const grouped = groupContentCredits(item.value?.credits || [])
  return [...grouped.standard, ...grouped.custom]
})

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

const openLightbox = (i) => {
  lightboxIndex.value = i
  lightboxVisible.value = true
}

/* ===== 사이드 리스트 스크롤 상태 ===== */
const sideListRef = ref(null)
const sideAtBottom = ref(false)
const sideCanScroll = ref(false)

function updateSideListState(event = null) {
  const target = event?.currentTarget || sideListRef.value

  if (!target) return

  const threshold = 4
  const canScroll = target.scrollHeight > target.clientHeight + threshold
  const atBottom =
    canScroll &&
    target.scrollTop + target.clientHeight >= target.scrollHeight - threshold

  sideCanScroll.value = canScroll
  sideAtBottom.value = atBottom
}

function scrollSideList() {
  const target = sideListRef.value

  if (!target) return

  if (sideAtBottom.value) {
    target.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  } else {
    target.scrollBy({
      top: Math.max(target.clientHeight * 0.8, 180),
      behavior: 'smooth',
    })
  }
}

watch(
  () => [sideList.value.length, type.value, slug.value],
  async () => {
    await nextTick()
    updateSideListState()
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => {
    updateSideListState()
  })

  window.addEventListener('resize', updateSideListState)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSideListState)
})

</script>



<style scoped>

/* ===== 레이아웃: 본문 위 / 리스트 아래 ===== */
.detail-wrap {
  --gap: 20px;
  --line: #1C1C1C;
  --muted: #666;
  --side-row-h: 78px;

  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "main"
    "side";
  row-gap: 40px;

  width: 100%;
  margin: 0;
  padding: 60px 20px 60px;

  box-sizing: border-box;
  overflow-x: clip;
}

.detail-wrap > * {
  min-width: 0;
}

:global(.main-content) {
  overflow-x: clip;
}

/* ===== 좌/우 영역 ===== */
.detail-wrap .main {
  grid-area: main;
  min-width: 0;
}

.detail-wrap .side {
  grid-area: side;

  width: 100%;
  min-width: 0;

  justify-self: stretch;
  align-self: start;
}

/* ===== 본문 내부 그리드 ===== */
.content-grid {
  display: grid;
  grid-template-rows: auto auto;
  gap: 18px;
  min-width: 0;
}

/* ===== 1행: 포스터 + 크레딧 ===== */
.poster-row {
  display: grid;
  grid-template-columns: clamp(220px, 32vw, 360px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  min-width: 0;
}

.poster {
  margin: 0;
  border: 1px solid #e6e6e6;
  background: #fff;
  cursor: zoom-in;
}

.poster img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
}

.gal-item {
  content-visibility: auto;
  contain-intrinsic-size: 720px;
}

/* ===== 크레딧 ===== */
.date-chip {
  color: #666;
}

.credit-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;
  color: #666;
  margin: 0 0 12px;
  line-height: 1.4;
}

.credit-label {
  flex: 0 0 auto;
}

.credit-values {
  min-width: 0;
}

.credit-line :deep(a) {
  color: inherit;
  text-decoration: underline;
}

.credit-block .credit-line a {
  color: inherit;
  text-decoration: underline;
}

.credit-block .credit-line .instagram-link {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  vertical-align: -3px;
  text-decoration: none;
}

.location-line {
  color: #4b5563;
  margin-top: 6px;
}

/* ===== 2행: 텍스트 ===== */
.text-row {
  min-width: 0;
}

.body-block {
  display: grid;
  gap: 12px;
  margin-top: 2px;
}

.body-text {
  margin: 0;
  white-space: pre-line;
  word-break: break-word;
}

.desc-block {
  display: grid;
  gap: 10px;
}

.desc-text {
  line-height: 1.6;
  white-space: pre-line;
  word-break: break-word;
  margin-top: 0;
}

/* ===== 갤러리 ===== */
.gallery {
  margin-top: 25px;

  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  min-width: 0;
}

.gal-item {
  margin: 0;
  cursor: zoom-in;
}

.gal-item img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.gal-item figcaption {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.detail-title {
  font-size: 22px;
}

/* ===== 하단 리스트 ===== */
.sticky-wrap {
  position: static;
  display: grid;
  width: 100%;
}

.panel.list-section {
  position: relative;

  width: 100%;
  min-width: 0;

  display: flex;
  flex-direction: column;
}

.panel-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin: 0 0 10px;
  gap: 8px;

  min-width: 0;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.back-link {
  font-size: 13px;
  text-decoration: underline;
}

/* ===== 하단 리스트: 최대 5개 높이 + 내부 스크롤 ===== */
.item-list.side-list {
  width: 100%;
  min-width: 0;

  list-style: none;
  padding: 0 0 36px;
  margin: 0;

  border-top: 1px solid var(--line);

  max-height: calc(var(--side-row-h) * 5 + 36px + 1px);

  overflow-y: auto;
  overflow-x: hidden;

  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scroll-behavior: smooth;
}

/* 스크롤 가능할 때만 하단 흐림 효과 */
.panel.list-section.can-scroll::before {
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

.panel.list-section.can-scroll.is-bottom::before {
  height: 28px;
  opacity: 0.65;
}

/* 스크롤바 */
.item-list.side-list::-webkit-scrollbar {
  width: 6px;
}

.item-list.side-list::-webkit-scrollbar-track {
  background: transparent;
}

.item-list.side-list::-webkit-scrollbar-thumb {
  background: #BDBDBD;
  border-radius: 999px;
}

.item-list.side-list::-webkit-scrollbar-thumb:hover {
  background: #888;
}

.item-list.side-list {
  scrollbar-width: thin;
  scrollbar-color: #BDBDBD transparent;
}

/* ===== 하단 리스트 항목 ===== */
.side-item.row {
  padding: 10px 0;

  border-bottom: 1px solid var(--line);

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 10px;
  row-gap: 4px;

  color: inherit;
  text-decoration: none;

  min-width: 0;
}

.side-item.row:hover .title {
  text-decoration: underline;
}

.title.side-title {
  grid-column: 1 / 2;

  font-weight: 600;
  font-size: 16px;
  line-height: 1.35;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date.side-date {
  grid-column: 2 / 3;

  color: var(--muted);
  font-size: 13px;
  line-height: 1.35;

  justify-self: end;
  align-self: start;

  white-space: nowrap;
}

.meta.side-meta {
  grid-column: 1 / 3;

  min-width: 0;

  color: #444;
  font-size: 12px;
  line-height: 1.4;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-item.active .title {
  font-weight: 700;
  text-decoration: underline;
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
  color: #fff;
  background: #1C1C1C;
}

.scroll-control-btn.is-up:hover {
  color: #1C1C1C;
  background: #fff;
}

/* ===== 미디어 요소 안전장치 ===== */
.detail-wrap :where(img, video, canvas, svg, iframe) {
  max-inline-size: 100%;
  block-size: auto;
  display: block;
}

/* ===== 반응형 ===== */
@media (max-width: 1200px) {
  .gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .poster-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .title.side-title {
    font-size: 14px;
  }

  .date.side-date,
  .meta.side-meta {
    font-size: 11px;
  }
}

/* 더 작은 화면 */
@media (max-width: 600px) {
  .gallery {
    grid-template-columns: 1fr;
  }

  .detail-wrap {
    padding: 56px 14px 44px;
    row-gap: 28px;
  }

  .panel-wrap {
    align-items: flex-start;
  }

  .panel-title {
    font-size: 16px;
  }

  .back-link {
    font-size: 12px;
  }
}

</style>
