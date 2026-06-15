<template>
  <div class="archive-page">
    <section class="archive-list-pane" aria-labelledby="archive-title">
      <header class="archive-header">
        <p class="ddf-kicker">Regional Archive</p>
        <h1 id="archive-title" class="ddf-section-title">지역 전시·상영 아카이브</h1>
        <p class="archive-summary">광주, 전주, 전남 전시·상영 수집 기록</p>
      </header>

      <ArchiveFilters
        v-model:query="query"
        v-model:activeType="activeType"
        v-model:activeCity="activeCity"
        v-model:activeStatus="activeStatus"
        :cities="archiveCities"
        :statuses="archiveStatuses"
        :types="archiveTypes"
      />

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

      <ArchiveList
        :items="filteredItems"
        :selected-id="selectedId"
        :loading="isArchiveLoading"
        @select="selectItem"
      />
    </section>

    <ArchiveMap
      :title="mapTitle"
      :cities="mapCities"
      :items="filteredItems"
      :selected-id="selectedId"
      :selected-item="selectedItem"
      :loading="isArchiveLoading"
      @select="selectItem"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import {
  archiveCities,
  archiveStatuses,
  archiveTypes,
  regionalArchiveItems,
} from '@/data/regionalArchive'
import { useRegionalArchive } from '@/composables/useRegionalArchive'
import { fetchArchiveItems } from '@/services/archive-api'
import ArchiveFilters from '@/components/archive/ArchiveFilters.vue'
import ArchiveList from '@/components/archive/ArchiveList.vue'
import ArchiveMap from '@/components/archive/ArchiveMap.vue'

const archiveItems = ref([])
const isArchiveLoading = ref(true)

const {
  activeType,
  activeCity,
  activeStatus,
  query,
  selectedId,
  mapCities,
  filteredItems,
  selectedItem,
  visibleVenueCount,
  mapTitle,
  selectItem,
} = useRegionalArchive(archiveItems, archiveCities)

onMounted(loadArchiveItems)

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
}

@media (max-width: 680px) {
  .archive-page {
    gap: 22px;
    padding-inline: 14px;
  }
}
</style>
