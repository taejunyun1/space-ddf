<template>
  <div class="archive-controls" aria-label="아카이브 필터">
    <label class="search-wrap">
      <span>Search</span>
      <input
        v-model.trim="queryModel"
        type="search"
        placeholder="전시, 상영, 공간, 지역"
        autocomplete="off"
      />
    </label>

    <button type="button" class="archive-location-button ddf-focusable" @click="$emit('request-location')">
      현재 위치로 <strong>내 주변</strong> 보기
    </button>

    <div class="filter-group quick-filters" aria-label="빠른 필터">
      <button
        v-for="filter in quickFilters"
        :key="filter.id"
        type="button"
        class="ddf-filter-button"
        :class="{ 'is-active': quickFilterModel === filter.id }"
        :aria-pressed="quickFilterModel === filter.id"
        @click="quickFilterModel = filter.id"
      >{{ filter.label }}</button>
    </div>

    <label class="archive-sort-wrap">
      <span>정렬</span>
      <select v-model="sortModel" :disabled="!locationAvailable">
        <option value="default">기본 순서</option>
        <option value="distance">가까운 순</option>
      </select>
    </label>

    <div class="filter-group" aria-label="유형 선택">
      <button
        v-for="type in types"
        :key="type.id"
        type="button"
        class="ddf-filter-button"
        :class="{ 'is-active': typeModel === type.id }"
        @click="typeModel = type.id"
      >
        {{ type.label }}
      </button>
    </div>

    <div class="filter-group" aria-label="지역 선택">
      <button
        v-for="city in cities"
        :key="city.id"
        type="button"
        class="ddf-filter-button"
        :class="[{ 'is-active': cityModel === city.id }, city.id !== 'all' ? city.id : '']"
        @click="cityModel = city.id"
      >
        {{ city.label }}
      </button>
    </div>

    <div class="filter-group" aria-label="상태 선택">
      <button
        v-for="status in statuses"
        :key="status.id"
        type="button"
        class="ddf-filter-button"
        :class="{ 'is-active': statusModel === status.id }"
        @click="statusModel = status.id"
      >
        {{ status.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const quickFilters = [
  { id: 'all', label: '전체' },
  { id: 'ending-today', label: '오늘 종료' },
  { id: 'free', label: '무료' },
  { id: 'parking', label: '주차 가능' },
]

const props = defineProps({
  cities: {
    type: Array,
    required: true,
  },
  statuses: {
    type: Array,
    required: true,
  },
  types: {
    type: Array,
    required: true,
  },
  query: {
    type: String,
    required: true,
  },
  activeType: {
    type: String,
    required: true,
  },
  activeCity: {
    type: String,
    required: true,
  },
  activeStatus: {
    type: String,
    required: true,
  },
  activeQuickFilter: { type: String, required: true },
  activeSort: { type: String, required: true },
  locationAvailable: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:query',
  'update:activeType',
  'update:activeCity',
  'update:activeStatus',
  'update:activeQuickFilter',
  'update:activeSort',
  'request-location',
])

const queryModel = computed({
  get: () => props.query,
  set: value => emit('update:query', value),
})

const cityModel = computed({
  get: () => props.activeCity,
  set: value => emit('update:activeCity', value),
})

const typeModel = computed({
  get: () => props.activeType,
  set: value => emit('update:activeType', value),
})

const statusModel = computed({
  get: () => props.activeStatus,
  set: value => emit('update:activeStatus', value),
})

const quickFilterModel = computed({
  get: () => props.activeQuickFilter,
  set: value => emit('update:activeQuickFilter', value),
})

const sortModel = computed({
  get: () => props.activeSort,
  set: value => emit('update:activeSort', value),
})
</script>

<style scoped>
.archive-controls {
  display: grid;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--ddf-line);
}

.search-wrap {
  display: grid;
  gap: 8px;
}

.search-wrap span {
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  color: var(--ddf-muted);
}

.search-wrap input {
  width: 100%;
  height: 38px;
  border: 1px solid var(--ddf-line);
  border-radius: 0;
  background: var(--ddf-paper);
  padding: 0 11px;
  font: inherit;
  font-size: 13px;
  color: var(--ddf-ink);
}

.search-wrap input:focus {
  outline: 2px solid var(--ddf-line);
  outline-offset: 2px;
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.archive-location-button,
.archive-sort-wrap select {
  min-height: 38px;
  border: 1px solid var(--ddf-line);
  border-radius: 0;
  background: var(--ddf-paper);
  color: var(--ddf-ink);
  font: inherit;
}

.archive-location-button { cursor: pointer; }

.archive-sort-wrap { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px; font-size: 12px; color: var(--ddf-muted); }

.filter-group[aria-label="지역 선택"] .gwangju {
  border-color: var(--ddf-city-gwangju);
  color: var(--ddf-city-gwangju);
}

.filter-group[aria-label="지역 선택"] .jeonju {
  border-color: var(--ddf-city-jeonju);
  color: var(--ddf-city-jeonju);
}

.filter-group[aria-label="지역 선택"] .jeonnam {
  border-color: var(--ddf-city-jeonnam);
  color: var(--ddf-city-jeonnam);
}

.filter-group[aria-label="지역 선택"] .gwangju.is-active {
  background: var(--ddf-city-gwangju);
  color: var(--ddf-paper);
}

.filter-group[aria-label="지역 선택"] .jeonju.is-active {
  background: var(--ddf-city-jeonju);
  color: var(--ddf-paper);
}

.filter-group[aria-label="지역 선택"] .jeonnam.is-active {
  background: var(--ddf-city-jeonnam);
  color: var(--ddf-paper);
}
</style>
