<template>
  <main class="route-planner-page">
    <section class="route-destinations" aria-labelledby="route-planner-title">
      <RouterLink class="route-back-link ddf-focusable" :to="{ name: 'regional-archive' }">
        ← 지역 아카이브로 돌아가기
      </RouterLink>

      <header class="route-header">
        <p class="ddf-kicker">Archive Route</p>
        <h1 id="route-planner-title" class="ddf-section-title">진행 중 전시 길찾기</h1>
        <p>진행 중인 전시를 목적지로 선택하면 Google Maps에서 경로를 엽니다.</p>
      </header>

      <label class="route-search-label" for="route-search">전시장 검색</label>
      <input
        id="route-search"
        v-model="query"
        class="route-search ddf-focusable"
        type="search"
        placeholder="전시명 또는 전시장 검색"
      >

      <div class="route-city-filters" aria-label="지역 필터">
        <button
          v-for="city in archiveCities"
          :key="city.id"
          type="button"
          class="route-city-filter ddf-focusable"
          :class="{ 'is-active': activeCity === city.id }"
          :aria-pressed="activeCity === city.id"
          @click="activeCity = city.id"
        >
          {{ city.label }}
        </button>
      </div>

      <p class="route-result-count" aria-live="polite">
        <template v-if="loading">진행 중 전시를 불러오는 중입니다.</template>
        <template v-else>{{ visibleItems.length }}개의 진행 중 전시</template>
      </p>

      <ul v-if="!loading && visibleItems.length" class="route-destination-list">
        <li v-for="item in visibleItems" :key="item.id">
          <button
            type="button"
            class="route-destination ddf-focusable"
            :class="{ 'is-selected': selectedItem?.id === item.id }"
            :aria-pressed="selectedItem?.id === item.id"
            @click="selectDestination(item.id)"
          >
            <span class="ddf-pill status">진행 중</span>
            <strong>{{ item.title }}</strong>
            <span>{{ item.venue }}</span>
            <small>{{ item.address || item.cityLabel }}</small>
          </button>
        </li>
      </ul>
      <p v-else-if="!loading" class="route-empty">조건에 맞는 진행 중 전시가 없습니다.</p>
    </section>

    <aside class="route-planner-panel" aria-labelledby="route-controls-title">
      <h2 id="route-controls-title">오늘의 이동 경로</h2>

      <div class="route-controls">
        <fieldset class="route-fieldset">
          <legend>출발지</legend>
          <label v-for="origin in ARCHIVE_ROUTE_ORIGINS" :key="origin.id" class="route-choice">
            <input v-model="originId" type="radio" name="archive-route-origin" :value="origin.id">
            <span>{{ origin.label }}</span>
          </label>
        </fieldset>

        <div class="route-line" aria-label="선택한 이동 경로">
          <div>
            <span>출발</span>
            <strong>{{ selectedOrigin.label }}</strong>
          </div>
          <div>
            <span>도착</span>
            <strong>{{ selectedItem ? selectedItem.venue : '목적지를 선택하세요' }}</strong>
            <small v-if="selectedItem">{{ selectedItem.address || selectedItem.cityLabel }}</small>
          </div>
        </div>

        <fieldset class="route-fieldset">
          <legend>이동 방식</legend>
          <label v-for="mode in ARCHIVE_ROUTE_MODES" :key="mode.id" class="route-choice">
            <input v-model="modeId" type="radio" name="archive-route-mode" :value="mode.id">
            <span>{{ mode.label }}</span>
          </label>
        </fieldset>

        <a
          v-if="directionsUrl"
          class="route-directions-link ddf-focusable"
          :href="directionsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Maps에서 길찾기
        </a>
        <p v-else class="route-directions-help">목적지를 선택하면 길찾기 링크가 활성화됩니다.</p>
      </div>
    </aside>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { archiveCities, regionalArchiveItems } from '@/data/regionalArchive'
import {
  ARCHIVE_ROUTE_MODES,
  ARCHIVE_ROUTE_ORIGINS,
  buildArchiveRouteUrl,
  ongoingArchiveItems,
} from '@/lib/archive-route.mjs'
import { fetchArchiveItems } from '@/services/archive-api'

const route = useRoute()
const router = useRouter()
const allItems = ref([])
const loading = ref(true)
const query = ref('')
const activeCity = ref('all')
const originId = ref('current')
const modeId = ref('recommended')
const ongoingItems = computed(() => ongoingArchiveItems(allItems.value))
const visibleItems = computed(() => ongoingItems.value.filter(matchesFilters))
const selectedItem = computed(() => ongoingItems.value.find(item => item.id === String(route.query.to || '')) || null)
const selectedOrigin = computed(() => (
  ARCHIVE_ROUTE_ORIGINS.find(origin => origin.id === originId.value) || ARCHIVE_ROUTE_ORIGINS[0]
))
const directionsUrl = computed(() => buildArchiveRouteUrl({ item: selectedItem.value, originId: originId.value, modeId: modeId.value }))

onMounted(loadArchiveItems)

function matchesFilters(item) {
  const matchesCity = activeCity.value === 'all' || item.city === activeCity.value
  const normalizedQuery = query.value.trim().toLowerCase()
  const searchText = [item.title, item.venue, item.address, item.cityLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return matchesCity && (!normalizedQuery || searchText.includes(normalizedQuery))
}

function selectDestination(id) {
  router.replace({ name: 'archive-route', query: { ...route.query, to: id } })
}

async function loadArchiveItems() {
  loading.value = true

  try {
    const items = await fetchArchiveItems()
    allItems.value = items.length ? items : regionalArchiveItems
  } catch {
    allItems.value = regionalArchiveItems
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.route-planner-page {
  width: 100%;
  min-height: 100dvh;
  padding: var(--ddf-page-top) var(--ddf-page-x) 60px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: var(--ddf-grid-gap);
  color: var(--ddf-ink);
  background: var(--ddf-paper);
}

.route-destinations,
.route-planner-panel {
  min-width: 0;
}

.route-back-link {
  display: inline-flex;
  margin-bottom: 28px;
  color: inherit;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  text-decoration: none;
}

.route-header {
  border-bottom: 1px solid var(--ddf-line);
  padding-bottom: 16px;
}

.route-header p:last-child,
.route-empty,
.route-directions-help {
  margin: 10px 0 0;
  color: var(--ddf-muted);
  font-size: 13px;
  line-height: 1.5;
}

.route-search-label,
.route-fieldset legend {
  display: block;
  margin: 24px 0 8px;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  font-weight: 700;
}

.route-search {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--ddf-line);
  border-radius: 0;
  padding: 0 12px;
  color: var(--ddf-ink);
  background: var(--ddf-paper);
  font: inherit;
}

.route-city-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.route-city-filter,
.route-destination,
.route-directions-link {
  border: 1px solid var(--ddf-line);
  border-radius: 0;
  color: var(--ddf-ink);
  background: var(--ddf-paper);
  font: inherit;
}

.route-city-filter {
  min-height: 34px;
  padding: 0 10px;
  cursor: pointer;
}

.route-city-filter.is-active {
  color: var(--ddf-paper);
  background: var(--ddf-ink);
}

.route-result-count {
  margin: 20px 0 10px;
  color: var(--ddf-muted);
  font-family: var(--ddf-font-mono);
  font-size: 12px;
}

.route-destination-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.route-destination {
  display: grid;
  width: 100%;
  gap: 4px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
}

.route-destination.is-selected {
  border-color: var(--ddf-status-open);
  outline: 1px solid var(--ddf-status-open);
}

.route-destination strong {
  font-size: 15px;
}

.route-destination span:not(.ddf-pill),
.route-destination small {
  color: var(--ddf-muted);
  font-size: 13px;
}

.route-planner-panel {
  align-self: start;
  position: sticky;
  top: 24px;
  border: 1px solid var(--ddf-line);
  padding: 20px;
}

.route-planner-panel h2 {
  margin: 0;
  font-size: 18px;
}

.route-fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

.route-choice {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 14px;
  cursor: pointer;
}

.route-choice input {
  accent-color: var(--ddf-ink);
}

.route-line {
  display: grid;
  gap: 18px;
  margin: 22px 0;
  padding-left: 20px;
  border-left: 1px solid var(--ddf-line);
}

.route-line div {
  position: relative;
  display: grid;
  gap: 3px;
}

.route-line div::before {
  position: absolute;
  top: 5px;
  left: -25px;
  width: 8px;
  height: 8px;
  border: 1px solid var(--ddf-line);
  border-radius: 50%;
  background: var(--ddf-paper);
  content: '';
}

.route-line span,
.route-line small {
  color: var(--ddf-muted);
  font-family: var(--ddf-font-mono);
  font-size: 11px;
}

.route-directions-link {
  display: block;
  margin-top: 24px;
  padding: 13px;
  color: var(--ddf-paper);
  background: var(--ddf-ink);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

@media (max-width: 780px) {
  .route-planner-page {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 58px 16px 20px;
  }

  .route-planner-panel {
    position: static;
  }
}
</style>
