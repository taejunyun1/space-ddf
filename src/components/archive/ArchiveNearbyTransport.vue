<template>
  <section v-if="hasContent || loading || error" class="archive-nearby-transport" aria-labelledby="nearby-transport-title">
    <h3 id="nearby-transport-title">주변 교통</h3>
    <p v-if="loading" class="archive-nearby-transport__status" aria-live="polite">주변 교통 정보를 확인하는 중입니다.</p>
    <p v-else-if="error" class="archive-nearby-transport__status" role="status">주변 교통 정보를 불러오지 못했습니다.</p>

    <div v-if="busStops.length" class="archive-nearby-transport__section">
      <h4>버스</h4>
      <ul>
        <li v-for="item in busStops" :key="item.id || `${item.name}-${item.distanceMeters}`">
          <strong>{{ item.name }}</strong>
          <span v-if="Number.isFinite(Number(item.distanceMeters))">{{ formatDistance(item.distanceMeters) }}</span>
          <small v-if="item.routes?.length">{{ item.routes.join(' · ') }}</small>
        </li>
      </ul>
    </div>

    <div v-if="subwayStations.length" class="archive-nearby-transport__section">
      <h4>지하철</h4>
      <ul>
        <li v-for="item in subwayStations" :key="item.id || `${item.name}-${item.distanceMeters}`">
          <strong>{{ item.name }}</strong>
          <span v-if="Number.isFinite(Number(item.distanceMeters))">{{ formatDistance(item.distanceMeters) }}</span>
        </li>
      </ul>
    </div>

    <div v-if="publicParking.length" class="archive-nearby-transport__section">
      <h4>공영주차장</h4>
      <ul>
        <li v-for="item in publicParking" :key="item.id || `${item.name}-${item.distanceMeters}`">
          <strong>{{ item.name }}</strong>
          <span v-if="Number.isFinite(Number(item.distanceMeters))">{{ formatDistance(item.distanceMeters) }}</span>
          <small v-if="item.address">{{ item.address }}</small>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  transport: { type: Object, default: null },
  loading: Boolean,
  error: Boolean,
})

const busStops = computed(() => safeItems(props.transport?.busStops))
const subwayStations = computed(() => safeItems(props.transport?.subwayStations))
const publicParking = computed(() => safeItems(props.transport?.publicParking))
const hasContent = computed(() => busStops.value.length || subwayStations.value.length || publicParking.value.length)

function safeItems(items) {
  return Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : []
}

function formatDistance(distanceMeters) {
  return `${Math.round(Number(distanceMeters))}m`
}
</script>

<style scoped>
.archive-nearby-transport {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--ddf-line);
}

.archive-nearby-transport h3,
.archive-nearby-transport h4 {
  margin: 0;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
}

.archive-nearby-transport h3 {
  font-weight: 700;
}

.archive-nearby-transport__status {
  margin: 8px 0 0;
  color: var(--ddf-muted);
  font-size: 13px;
  line-height: 1.5;
}

.archive-nearby-transport__section {
  margin-top: 16px;
}

.archive-nearby-transport ul {
  display: grid;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.archive-nearby-transport li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 10px;
  padding-left: 10px;
  border-left: 1px solid var(--ddf-line);
  font-size: 13px;
}

.archive-nearby-transport strong {
  min-width: 0;
}

.archive-nearby-transport span,
.archive-nearby-transport small {
  color: var(--ddf-muted);
  font-family: var(--ddf-font-mono);
  font-size: 11px;
}

.archive-nearby-transport small {
  grid-column: 1 / -1;
  line-height: 1.4;
}
</style>
