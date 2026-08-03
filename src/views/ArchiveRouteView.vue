<template>
  <main class="route-planner-page">
    <section class="route-destinations" aria-labelledby="route-planner-title">
      <RouterLink class="route-back-link ddf-focusable" :to="{ name: 'regional-archive' }">
        ← 지역 아카이브로 돌아가기
      </RouterLink>

      <header class="route-header">
        <p class="ddf-kicker">Archive Route</p>
        <h1 id="route-planner-title" class="ddf-section-title">진행 중 전시 길찾기</h1>
        <p>방문할 전시를 순서대로 선택하면 네이버 지도에서 경로를 엽니다.</p>
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
            :class="{ 'is-selected': selectedIds.includes(item.id) }"
            :aria-pressed="selectedIds.includes(item.id)"
            @click="toggleDestination(item.id)"
          >
            <span v-if="selectedOrder(item.id)" class="route-order-badge" aria-hidden="true">
              {{ selectedOrder(item.id) }}
            </span>
            <span class="ddf-pill status">진행 중</span>
            <strong>{{ item.title }}</strong>
            <span>{{ item.venue }}</span>
            <small>{{ item.address || item.cityLabel }}</small>
          </button>
        </li>
      </ul>
      <p v-else-if="!loading" class="route-empty">조건에 맞는 진행 중 전시가 없습니다.</p>
    </section>

    <aside
      class="route-planner-panel"
      :class="{ 'is-mobile-controls-open': routeControlsOpen }"
      aria-labelledby="route-controls-title"
    >
      <button
        ref="routeControlsToggle"
        class="route-controls-toggle ddf-focusable"
        type="button"
        aria-controls="route-controls"
        :aria-expanded="routeControlsOpen"
        @click="openRouteControls"
      >
        {{ selectedItems.length ? `${selectedItems.length}곳 경로 설정` : '경로 설정 열기' }}
      </button>

      <div id="route-controls" class="route-controls" :class="{ 'is-open': routeControlsOpen }">
        <div class="route-controls-header">
          <h2 id="route-controls-title">오늘의 이동 경로</h2>
          <button
            ref="routeControlsClose"
            class="route-controls-close ddf-focusable"
            type="button"
            @click="closeRouteControls"
          >
            닫기
          </button>
        </div>

        <fieldset class="route-fieldset">
          <legend>출발지</legend>
          <label v-for="origin in ARCHIVE_ROUTE_ORIGINS" :key="origin.id" class="route-choice">
            <input class="ddf-focusable" v-model="originId" type="radio" name="archive-route-origin" :value="origin.id">
            <span>{{ origin.label }}</span>
          </label>
        </fieldset>

        <div class="route-line" aria-label="선택한 이동 경로">
          <div class="route-stop route-origin">
            <span>출발</span>
            <strong>{{ selectedOrigin.label }}</strong>
          </div>
          <div v-if="!selectedItems.length" class="route-stop route-empty-stop">
            <span>도착</span>
            <strong>목적지를 선택하세요</strong>
          </div>
          <div
            v-for="(item, index) in selectedItems"
            v-else
            :key="item.id"
            class="route-stop route-selected-stop"
          >
            <span>{{ index === selectedItems.length - 1 ? '도착' : `경유 ${index + 1}` }}</span>
            <strong>{{ item.venue }}</strong>
            <small>{{ item.address || item.cityLabel }}</small>
            <div class="route-stop-actions">
              <button
                type="button"
                class="route-stop-action ddf-focusable"
                :disabled="index === 0"
                :aria-label="`${item.venue} 순서를 위로 이동`"
                @click="moveSelectedItem(index, -1)"
              >↑</button>
              <button
                type="button"
                class="route-stop-action ddf-focusable"
                :disabled="index === selectedItems.length - 1"
                :aria-label="`${item.venue} 순서를 아래로 이동`"
                @click="moveSelectedItem(index, 1)"
              >↓</button>
              <button
                type="button"
                class="route-stop-action route-stop-remove ddf-focusable"
                :aria-label="`${item.venue} 경로에서 삭제`"
                @click="removeSelectedItem(item.id)"
              >삭제</button>
            </div>
          </div>
        </div>

        <button
          v-if="selectedItems.length >= 2"
          type="button"
          class="route-clear-button ddf-focusable"
          @click="clearSelectedItems"
        >경로 전체 지우기</button>

        <ArchiveNearbyTransport
          v-if="destinationItem"
          :transport="nearbyTransport"
          :loading="nearbyLoading"
          :error="nearbyError"
        />

        <fieldset class="route-fieldset">
          <legend>이동 방식</legend>
          <label v-for="mode in ARCHIVE_ROUTE_MODES" :key="mode.id" class="route-choice">
            <input class="ddf-focusable" v-model="modeId" type="radio" name="archive-route-mode" :value="mode.id">
            <span>{{ mode.label }}</span>
          </label>
        </fieldset>

        <p
          v-if="selectedItems.length > 1 && modeId !== 'driving'"
          class="route-mode-notice"
          role="status"
        >여러 장소 경유는 네이버 지도 지원 방식에 맞춰 자동차 경로로 엽니다.</p>

        <p
          v-if="routeLimitExceeded"
          class="route-mode-notice"
          role="status"
        >고유 장소 6곳까지만 경로에 포함됩니다.</p>

        <a
          v-if="directionsUrl"
          class="route-directions-link ddf-focusable"
          :href="directionsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M5 12h12m-5-5 5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
          </svg>
          <span>네이버 지도로 경로 열기</span>
        </a>
        <a
          v-if="directionsUrl"
          class="route-web-link ddf-focusable"
          :href="directionsWebUrl"
          target="_blank"
          rel="noopener noreferrer"
        >네이버 지도 웹 열기</a>
        <p v-else class="route-directions-help">방문할 전시를 선택하면 길찾기 버튼이 활성화됩니다.</p>
      </div>
    </aside>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArchiveNearbyTransport from '@/components/archive/ArchiveNearbyTransport.vue'
import { archiveCities, regionalArchiveItems } from '@/data/regionalArchive'
import {
  ARCHIVE_ROUTE_MODES,
  ARCHIVE_ROUTE_ORIGINS,
  archiveRouteLocations,
  buildArchiveRouteUrl,
  buildArchiveRouteWebUrl,
  moveArchiveRouteId,
  ongoingArchiveItems,
  parseArchiveRouteIds,
  serializeArchiveRouteIds,
  toggleArchiveRouteId,
} from '@/lib/archive-route.mjs'
import { fetchArchiveItems, fetchNearbyTransport } from '@/services/archive-api'

const route = useRoute()
const router = useRouter()
const allItems = ref([])
const loading = ref(true)
const query = ref('')
const activeCity = ref('all')
const originId = ref('current')
const modeId = ref('recommended')
const routeControlsOpen = ref(false)
const routeControlsToggle = ref(null)
const routeControlsClose = ref(null)
const nearbyTransport = ref(null)
const nearbyLoading = ref(false)
const nearbyError = ref(false)
const nearbyAbortController = ref(null)
const ongoingItems = computed(() => ongoingArchiveItems(allItems.value))
const visibleItems = computed(() => ongoingItems.value.filter(matchesFilters))
const selectedIds = computed(() => {
  const ongoingIds = new Set(ongoingItems.value.map(item => item.id))
  return parseArchiveRouteIds(route.query.to).filter(id => ongoingIds.has(id))
})
const selectedItems = computed(() => {
  const itemsById = new Map(ongoingItems.value.map(item => [item.id, item]))
  return selectedIds.value.map(id => itemsById.get(id)).filter(Boolean)
})
const destinationItem = computed(() => selectedItems.value.at(-1) || null)
const selectedOrigin = computed(() => (
  ARCHIVE_ROUTE_ORIGINS.find(origin => origin.id === originId.value) || ARCHIVE_ROUTE_ORIGINS[0]
))
const routeLocations = computed(() => archiveRouteLocations(selectedItems.value))
const directionsUrl = computed(() => buildArchiveRouteUrl({ items: selectedItems.value, originId: originId.value, modeId: modeId.value }))
const directionsWebUrl = buildArchiveRouteWebUrl()
const routeLimitExceeded = computed(() => routeLocations.value.length > 6)

onMounted(loadArchiveItems)
onBeforeUnmount(cancelNearbyTransport)
watch(destinationItem, loadNearbyTransport, { immediate: true })
watch([() => route.query.to, ongoingItems, loading], normalizeSelectedQuery)

function matchesFilters(item) {
  const matchesCity = activeCity.value === 'all' || item.city === activeCity.value
  const normalizedQuery = query.value.trim().toLowerCase()
  const searchText = [item.title, item.venue, item.address, item.cityLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return matchesCity && (!normalizedQuery || searchText.includes(normalizedQuery))
}

function selectedOrder(id) {
  const index = selectedIds.value.indexOf(id)
  return index === -1 ? 0 : index + 1
}

function replaceSelectedIds(ids) {
  const to = serializeArchiveRouteIds(ids)
  router.replace({ name: 'archive-route', query: { ...route.query, to: to || undefined } })
}

function toggleDestination(id) {
  replaceSelectedIds(toggleArchiveRouteId(selectedIds.value, id))
}

function moveSelectedItem(index, offset) {
  replaceSelectedIds(moveArchiveRouteId(selectedIds.value, index, offset))
}

function removeSelectedItem(id) {
  replaceSelectedIds(selectedIds.value.filter(current => current !== id))
}

function clearSelectedItems() {
  replaceSelectedIds([])
}

function normalizeSelectedQuery() {
  if (loading.value) return
  const current = serializeArchiveRouteIds(parseArchiveRouteIds(route.query.to))
  const normalized = serializeArchiveRouteIds(selectedIds.value)
  if (current !== normalized) replaceSelectedIds(selectedIds.value)
}

async function openRouteControls() {
  routeControlsOpen.value = true
  await nextTick()
  routeControlsClose.value?.focus()
}

async function closeRouteControls() {
  routeControlsOpen.value = false
  await nextTick()
  routeControlsToggle.value?.focus()
}

function cancelNearbyTransport() {
  nearbyAbortController.value?.abort()
  nearbyAbortController.value = null
}

async function loadNearbyTransport(item) {
  cancelNearbyTransport()
  nearbyTransport.value = null
  nearbyError.value = false
  nearbyLoading.value = false

  if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return

  const requestController = new AbortController()
  nearbyAbortController.value = requestController
  nearbyLoading.value = true

  try {
    const transport = await fetchNearbyTransport({ lat: item.lat, lng: item.lng, signal: nearbyAbortController.value.signal })
    if (nearbyAbortController.value === requestController) nearbyTransport.value = transport
  } catch (error) {
    if (error.name !== 'AbortError' && nearbyAbortController.value === requestController) nearbyError.value = true
  } finally {
    if (nearbyAbortController.value === requestController) {
      nearbyLoading.value = false
      nearbyAbortController.value = null
    }
  }
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
  grid-template-areas: 'destinations planner';
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: var(--ddf-grid-gap);
  color: var(--ddf-ink);
  background: var(--ddf-paper);
}

.route-destinations,
.route-planner-panel {
  min-width: 0;
}

.route-destinations {
  grid-area: destinations;
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

.route-mode-notice {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--ddf-ink);
  font-size: 12px;
  line-height: 1.45;
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
  position: relative;
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
  padding-left: 52px;
}

.route-order-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  color: var(--ddf-paper) !important;
  background: var(--ddf-ink);
  font-family: var(--ddf-font-mono);
  font-size: 12px !important;
  font-weight: 700;
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
  grid-area: planner;
  align-self: start;
  position: sticky;
  top: 24px;
  border: 1px solid var(--ddf-line);
  padding: 20px;
}

.route-controls-toggle,
.route-controls-close {
  border: 1px solid var(--ddf-line);
  border-radius: 0;
  color: var(--ddf-ink);
  background: var(--ddf-paper);
  font: inherit;
  cursor: pointer;
}

.route-controls-toggle,
.route-controls-close {
  display: none;
}

.route-controls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.route-controls h2 {
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

.route-stop {
  position: relative;
  display: grid;
  gap: 3px;
}

.route-stop::before {
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

.route-stop-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.route-stop-action,
.route-clear-button {
  border: 1px solid var(--ddf-line);
  border-radius: 0;
  color: var(--ddf-ink);
  background: var(--ddf-paper);
  font-family: var(--ddf-font-mono);
  font-size: 11px;
  cursor: pointer;
}

.route-stop-action {
  min-width: 30px;
  min-height: 28px;
  padding: 0 8px;
}

.route-stop-action:disabled {
  cursor: default;
  opacity: 0.3;
}

.route-stop-remove {
  margin-left: auto;
}

.route-clear-button {
  width: 100%;
  min-height: 34px;
  margin: -10px 0 6px;
}

.route-directions-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 48px;
  margin-top: 24px;
  border: 2px solid var(--ddf-ink);
  padding: 0 16px;
  color: var(--ddf-paper);
  background: var(--ddf-ink);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.route-directions-link:hover {
  color: var(--ddf-paper);
  background: var(--ddf-ink);
  box-shadow: inset 0 0 0 2px var(--ddf-paper);
}

.route-web-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  margin-top: 8px;
  border: 1px solid var(--ddf-ink);
  color: var(--ddf-ink);
  background: var(--ddf-paper);
  font-size: 12px;
  text-decoration: none;
}

.route-web-link:hover {
  color: var(--ddf-paper);
  background: var(--ddf-ink);
}

@media (max-width: 780px) {
  .route-planner-page {
    grid-template-areas: 'destinations';
    grid-template-columns: 1fr;
    gap: 0;
    padding: 58px 16px 20px;
  }

  .route-planner-panel {
    grid-area: auto;
    position: static;
    height: 0;
    border: 0;
    padding: 0;
  }

  .route-destinations {
    padding-bottom: calc(44px + 14px + 12px + env(safe-area-inset-bottom));
  }

  .route-controls {
    display: none;
  }

  .route-planner-panel.is-mobile-controls-open .route-controls-toggle {
    display: none;
  }

  .route-controls-toggle {
    position: fixed;
    right: 16px;
    left: 16px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 14px;
  }

  .route-controls.is-open {
    display: block;
    position: fixed;
    right: 16px;
    left: 16px;
    bottom: 0;
    z-index: 10;
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
    border: 1px solid var(--ddf-line);
    padding: 14px;
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
    background: var(--ddf-paper);
  }

  .route-controls-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 10px;
  }

  .route-fieldset:first-child legend {
    margin-top: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-planner-page {
    scroll-behavior: auto;
  }
}
</style>
