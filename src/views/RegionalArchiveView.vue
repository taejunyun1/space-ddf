<template>
  <div
    class="archive-page"
    :class="{
      'mobile-list-view': activeMobileView === 'list',
      'mobile-map-view': activeMobileView === 'map',
    }"
  >
    <section class="archive-list-pane" aria-labelledby="archive-title">
      <header class="archive-header">
        <p class="ddf-kicker">Regional Archive</p>
        <h1 id="archive-title" class="ddf-section-title">지역 전시·상영 아카이브</h1>
        <p class="archive-summary">광주, 전주, 전남 전시·상영 수집 기록</p>
        <ArchiveModeTabs :selected-ids="selectedIds" />
      </header>

      <ArchiveFilters
        v-model:query="query"
        v-model:activeType="activeType"
        v-model:activeCity="activeCity"
        v-model:activeStatus="activeStatus"
        v-model:activeQuickFilter="activeQuickFilter"
        v-model:activeSort="activeSort"
        :location-available="Boolean(currentLocation)"
        :cities="archiveCities"
        :statuses="archiveStatuses"
        :types="archiveTypes"
        @request-location="requestLocation"
      />

      <div class="mobile-view-tabs" role="tablist" aria-label="아카이브 보기 방식">
        <button
          type="button"
          class="mobile-view-tab ddf-focusable"
          role="tab"
          :aria-selected="activeMobileView === 'list'"
          :class="{ 'is-active': activeMobileView === 'list' }"
          @click="activeMobileView = 'list'"
        >
          리스트로 보기
        </button>
        <button
          type="button"
          class="mobile-view-tab ddf-focusable"
          role="tab"
          :aria-selected="activeMobileView === 'map'"
          :class="{ 'is-active': activeMobileView === 'map' }"
          @click="activeMobileView = 'map'"
        >
          지도로 보기
        </button>
      </div>

      <div class="archive-count" :class="{ loading: isArchiveLoading }">
        <template v-if="isArchiveLoading">
          <span class="count-skeleton"></span>
          <i aria-hidden="true"></i>
          <span class="count-skeleton short"></span>
        </template>
        <template v-else>
          <strong>{{ filteredItems.length }}</strong>
          <span>records</span>
          <i aria-hidden="true"></i>
          <span>{{ visibleVenueCount }} venues</span>
        </template>
      </div>

      <div class="archive-list-content">
        <ArchiveList
          :items="filteredItems"
          :selected-id="selectedId"
          :loading="isArchiveLoading"
          :selected-route-ids="selectedIds"
          :route-limit-reached="routeLimitReached"
          @select="selectArchiveItem"
          @toggle-route="toggleRouteItem"
        />
      </div>
      <ArchiveRouteSelectionBar :selected-items="selectedRouteItems" />
    </section>

    <div class="archive-map-panel">
      <ArchiveMap
        :title="mapTitle"
        :cities="mapCities"
        :items="mapItems"
        :selected-id="mapSelectedId"
        :selected-item="mapSelectedItem"
        :selection-unavailable="mapSelectionUnavailable"
        :loading="isArchiveLoading"
        :selected-route-ids="selectedIds"
        :route-limit-reached="routeLimitReached"
        @select="selectArchiveItem"
        @toggle-route="toggleRouteItem"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  archiveCities,
  archiveStatuses,
  archiveTypes,
  regionalArchiveItems,
} from '@/data/regionalArchive'
import { useRegionalArchive } from '@/composables/useRegionalArchive'
import {
  NAVER_MAX_ROUTE_LOCATIONS,
  ongoingArchiveItems,
  parseArchiveRouteIds,
  serializeArchiveRouteIds,
  toggleLimitedArchiveRouteId,
} from '@/lib/archive-route.mjs'
import { fetchArchiveItems } from '@/services/archive-api'
import ArchiveFilters from '@/components/archive/ArchiveFilters.vue'
import ArchiveList from '@/components/archive/ArchiveList.vue'
import ArchiveMap from '@/components/archive/ArchiveMap.vue'
import ArchiveModeTabs from '@/components/archive/ArchiveModeTabs.vue'
import ArchiveRouteSelectionBar from '@/components/archive/ArchiveRouteSelectionBar.vue'

const archiveItems = ref([])
const isArchiveLoading = ref(true)
const activeMobileView = ref('list')
const route = useRoute()
const router = useRouter()

const ongoingItems = computed(() => ongoingArchiveItems(archiveItems.value))
const selectedIds = computed(() => {
  const ongoingIds = new Set(ongoingItems.value.map(item => item.id))
  return parseArchiveRouteIds(route.query.to)
    .filter(id => ongoingIds.has(id))
    .slice(0, NAVER_MAX_ROUTE_LOCATIONS)
})
const selectedRouteItems = computed(() => {
  const itemsById = new Map(ongoingItems.value.map(item => [item.id, item]))
  return selectedIds.value.map(id => itemsById.get(id)).filter(Boolean)
})
const routeLimitReached = computed(() => selectedIds.value.length >= NAVER_MAX_ROUTE_LOCATIONS)

const {
  activeType,
  activeCity,
  activeStatus,
  activeQuickFilter,
  activeSort,
  currentLocation,
  query,
  selectedId,
  mapCities,
  filteredItems,
  visibleVenueCount,
  mapTitle,
  selectItem,
  requestLocation,
} = useRegionalArchive(ongoingItems, archiveCities)

const mapItems = computed(() => filteredItems.value)
const mapSelectedItem = computed(() => (
  mapItems.value.find(item => item.id === selectedId.value) || null
))
const mapSelectedId = computed(() => mapSelectedItem.value?.id || '')
const mapSelectionUnavailable = computed(() => Boolean(selectedId.value && !mapSelectedItem.value))

onMounted(loadArchiveItems)

function selectArchiveItem(id) {
  selectItem(id)
}

function toggleRouteItem(id) {
  const ids = toggleLimitedArchiveRouteId(selectedIds.value, id)
  const to = serializeArchiveRouteIds(ids)
  router.replace({ query: { ...route.query, to: to || undefined } })
}

async function loadArchiveItems() {
  isArchiveLoading.value = true

  try {
    const items = await fetchArchiveItems()
    if (items.length) archiveItems.value = items
  } catch {
    archiveItems.value = regionalArchiveItems
  } finally {
    isArchiveLoading.value = false
  }
}
</script>

<style scoped>
.archive-page {
  width: 100%;
  min-height: 100dvh;
  padding: var(--ddf-page-top) var(--ddf-page-x) 60px;
  display: grid;
  grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
  gap: var(--ddf-grid-gap);
  color: var(--ddf-ink);
  background: var(--ddf-paper);
}

.archive-list-pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 120px);
  min-height: 0;
}

.archive-map-panel {
  min-width: 0;
}

.archive-list-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mobile-view-tabs {
  display: none;
}

.archive-header {
  border-bottom: 1px solid var(--ddf-line);
  padding-bottom: 15px;
}

.archive-summary {
  margin: 12px 0 0;
  color: #333;
  font-size: 13px;
  line-height: 1.45;
}

.archive-count {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 0;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  color: var(--ddf-muted);
}

.archive-count strong {
  color: var(--ddf-ink);
  font-size: 15px;
}

.archive-count i {
  width: 1px;
  height: 12px;
  background: #cfcfcf;
}

.archive-count.loading {
  min-height: 44px;
}

.count-skeleton {
  position: relative;
  overflow: hidden;
  width: 92px;
  height: 13px;
  background: #ecece8;
}

.count-skeleton.short {
  width: 72px;
}

.count-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.72), transparent);
  animation: archive-view-skeleton 1.25s ease-in-out infinite;
}

@keyframes archive-view-skeleton {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 1180px) {
  .archive-page {
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 24px;
    padding-right: 24px;
    padding-left: 24px;
  }
}

@media (max-width: 1024px) {
  .archive-page {
    grid-template-columns: 1fr;
    padding: 58px 16px 44px;
  }

  .archive-list-pane {
    height: auto;
  }

  .archive-page.mobile-list-view {
    padding-bottom: 0;
  }

  .mobile-list-view .archive-list-pane {
    height: auto;
    min-height: 0;
  }

  .mobile-list-view .archive-list-content {
    flex: none;
    min-height: 0;
    overflow: visible;
  }

  .mobile-view-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    margin: 14px 0 0;
    border: 1px solid var(--ddf-line);
    color: var(--ddf-ink);
    background: var(--ddf-paper);
  }

  .mobile-view-tab {
    min-height: 42px;
    border: 0;
    border-right: 1px solid var(--ddf-line);
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-family: var(--ddf-font-mono);
    font-size: 13px;
    line-height: 1.2;
    cursor: pointer;
  }

  .mobile-view-tab:last-child {
    border-right: 0;
  }

  .mobile-view-tab.is-active {
    background: var(--ddf-line);
    color: var(--ddf-paper);
  }

  .archive-map-panel {
    display: none;
  }

  .mobile-map-view .archive-list-content {
    display: none;
  }

  .mobile-map-view .archive-map-panel {
    display: block;
  }

  .archive-map-panel :deep(.archive-map-pane) {
    position: static;
    min-height: 0;
  }

  .archive-map-panel :deep(.map-toolbar) {
    padding-bottom: 12px;
  }

  .archive-map-panel :deep(.map-shell) {
    height: min(68dvh, 560px);
    min-height: 430px;
  }
}

@media (max-width: 680px) {
  .archive-page {
    gap: 22px;
    padding-inline: 14px;
  }

  .archive-map-panel :deep(.map-shell) {
    height: 62dvh;
    min-height: 410px;
  }
}
</style>
