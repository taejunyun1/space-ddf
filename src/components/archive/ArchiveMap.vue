<template>
  <section class="archive-map-pane" aria-label="전시 지도">
    <div class="map-toolbar">
      <div>
        <p class="ddf-kicker">Map View</p>
        <h2 class="ddf-section-title">{{ title }}</h2>
      </div>
      <div class="map-meta">
        <span v-if="selectedItem?.sourceType" class="ddf-pill">{{ selectedItem.sourceType }}</span>
        <span v-if="selectedItem?.scrapedAt" class="ddf-pill">{{ selectedItem.scrapedAt }}</span>
      </div>
    </div>

    <div class="map-shell">
      <div
        ref="mapElement"
        class="google-map-canvas"
        :aria-label="`${title} 구글 지도`"
      ></div>

      <div v-if="loading" class="map-loading" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div v-if="mapError" class="map-fallback" role="status">
        <p>{{ mapError }}</p>
      </div>

      <div v-if="items.length === 0 && !loading" class="map-fallback" role="status">
        <p>현재 진행 중인 전시가 없습니다.</p>
      </div>

      <div v-if="selectionUnavailable && !loading" class="map-notice" role="status">
        <p>이 기록은 현재 지도 표시 대상이 아닙니다.</p>
      </div>

      <aside v-if="selectedItem" class="map-detail" aria-live="polite">
        <div class="detail-kicker">
          <span class="ddf-pill city" :class="selectedItem.city">{{ selectedItem.cityLabel }}</span>
          <span class="ddf-pill">{{ archiveTypeLabel(selectedItem) }}</span>
          <span class="ddf-pill status" :class="selectedItem.status">{{ selectedItem.statusLabel }}</span>
        </div>
        <h3>{{ selectedItem.title }}</h3>
        <p>{{ selectedItem.venue }}</p>
        <dl>
          <div>
            <dt>기간</dt>
            <dd>{{ archiveSchedule(selectedItem) }}</dd>
          </div>
          <div>
            <dt>주소</dt>
            <dd>{{ selectedItem.address }}</dd>
          </div>
          <div>
            <dt>출처</dt>
            <dd>{{ selectedItem.sourceName }}</dd>
          </div>
        </dl>
        <a
          v-if="selectedItem.sourceUrl"
          class="ddf-source-link detail-link"
          :href="selectedItem.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          원문 보기
        </a>
        <router-link
          v-if="selectedItem?.id"
          class="ddf-source-link detail-link route-link"
          :to="{ name: 'archive-route', query: { to: selectedItem.id } }"
        >길찾기</router-link>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  archiveSchedule,
  archiveTypeLabel,
  archiveTypeValue,
} from '@/lib/archive-utils'
import {
  googleMapsMapId,
  hasGoogleMapsApiKey,
  loadGoogleMapsLibrary,
} from '@/services/google-maps'

const DEFAULT_CENTER = {
  lat: 35.05,
  lng: 126.78,
}

const DEFAULT_ZOOM = 10
const SINGLE_MARKER_ZOOM = 15
const SELECTED_MARKER_ZOOM = 12

const CITY_COLORS = {
  gwangju: 'var(--ddf-city-gwangju)',
  jeonju: 'var(--ddf-city-jeonju)',
  jeonnam: 'var(--ddf-city-jeonnam)',
  unknown: '#6c6c6c',
}

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  cities: {
    type: Array,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  selectedItem: {
    type: Object,
    default: null,
  },
  selectedId: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  selectionUnavailable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])
const mapElement = ref(null)
const mapError = ref('')
let googleMap = null
let markerMap = new Map()
let AdvancedMarkerElement = null
let previousAuthFailure = null

const markerGroups = computed(() => {
  const groups = new Map()

  props.items
    .filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
    .forEach(item => {
      const key = [
        item.city,
        item.venue,
        Number(item.lat).toFixed(5),
        Number(item.lng).toFixed(5),
      ].join('|')
      const current = groups.get(key)

      if (current) {
        current.count += 1
        current.itemIds.push(item.id)
        current.status = markerStatus(current.status, item.status)
        current.archiveType = current.archiveType === archiveTypeValue(item)
          ? current.archiveType
          : 'mixed'
        return
      }

      groups.set(key, {
        id: key,
        primaryId: item.id,
        itemIds: [item.id],
        count: 1,
        archiveType: archiveTypeValue(item),
        city: item.city,
        cityLabel: item.cityLabel,
        status: item.status,
        venue: item.venue,
        lat: Number(item.lat),
        lng: Number(item.lng),
      })
    })

  return Array.from(groups.values())
})

const selectedMarkerGroup = computed(() => (
  markerGroups.value.find(group => group.itemIds.includes(props.selectedId)) || null
))

onMounted(initMap)
onBeforeUnmount(() => {
  clearMarkers()
  window.gm_authFailure = previousAuthFailure
})

watch(markerGroups, () => {
  syncMarkers()
})

watch(selectedMarkerGroup, () => {
  focusSelectedMarker()
})

async function initMap() {
  if (!hasGoogleMapsApiKey()) {
    mapError.value = 'Google Maps API key 확인 필요'
    return
  }

  try {
    previousAuthFailure = window.gm_authFailure
    window.gm_authFailure = () => {
      mapError.value = 'Google Maps API referrer 제한 확인 필요'
      clearMarkers()
      if (typeof previousAuthFailure === 'function') previousAuthFailure()
    }

    const { Map: GoogleMap } = await loadGoogleMapsLibrary('maps')
    const markerLibrary = await loadGoogleMapsLibrary('marker')
    AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement
    await nextTick()

    googleMap = new GoogleMap(mapElement.value, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      clickableIcons: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      mapTypeControl: false,
      mapId: googleMapsMapId(),
      scaleControl: false,
      streetViewControl: false,
    })

    syncMarkers()
  } catch (err) {
    mapError.value = 'Google 지도를 불러오지 못했습니다'
    console.error(err)
  }
}

function syncMarkers() {
  if (!googleMap || !AdvancedMarkerElement || mapError.value) return

  try {
    const nextIds = new Set(markerGroups.value.map(group => group.id))

    for (const [id, marker] of markerMap.entries()) {
      if (nextIds.has(id)) continue
      marker.map = null
      markerMap.delete(id)
    }

    markerGroups.value.forEach(group => {
      const selected = group.itemIds.includes(props.selectedId)
      const marker = markerMap.get(group.id) || createMarker(group)

      marker.position = { lat: group.lat, lng: group.lng }
      marker.title = markerTitle(group)
      marker.content = markerContent(group, selected)
      marker.zIndex = selected ? 20 : 10 + group.count
    })

    fitVisibleMarkers()
    focusSelectedMarker()
  } catch (err) {
    mapError.value = 'Google 지도 마커를 표시하지 못했습니다'
    console.error(err)
    clearMarkers()
  }
}

function createMarker(group) {
  const marker = new AdvancedMarkerElement({
    map: googleMap,
    position: { lat: group.lat, lng: group.lng },
    title: markerTitle(group),
    content: markerContent(group, group.itemIds.includes(props.selectedId)),
  })

  markerMap.set(group.id, marker)
  return marker
}

function clearMarkers() {
  markerMap.forEach(marker => {
    marker.map = null
  })
  markerMap = new Map()
  googleMap = null
}

function fitVisibleMarkers() {
  if (!googleMap) return

  if (!markerGroups.value.length) {
    googleMap.setCenter(DEFAULT_CENTER)
    googleMap.setZoom(DEFAULT_ZOOM)
    return
  }

  if (markerGroups.value.length === 1) {
    const [group] = markerGroups.value
    googleMap.setCenter({ lat: group.lat, lng: group.lng })
    googleMap.setZoom(SINGLE_MARKER_ZOOM)
    return
  }

  const bounds = new window.google.maps.LatLngBounds()
  markerGroups.value.forEach(group => bounds.extend({ lat: group.lat, lng: group.lng }))
  googleMap.fitBounds(bounds, 72)
}

function focusSelectedMarker() {
  if (!googleMap || !selectedMarkerGroup.value) return

  googleMap.panTo({
    lat: selectedMarkerGroup.value.lat,
    lng: selectedMarkerGroup.value.lng,
  })

  if (googleMap.getZoom() < SELECTED_MARKER_ZOOM) {
    googleMap.setZoom(SELECTED_MARKER_ZOOM)
  }
}

function markerContent(group, selected) {
  const marker = document.createElement('button')
  const color = CITY_COLORS[group.city] || CITY_COLORS.unknown
  const screening = group.archiveType === 'screening'
  const ongoing = group.status === 'ongoing'

  marker.type = 'button'
  marker.textContent = group.count > 1 ? String(group.count) : ongoing ? '현' : screening ? '상' : group.cityLabel.slice(0, 1)
  marker.setAttribute('aria-label', `${markerTitle(group)} 위치 선택`)
  marker.addEventListener('click', event => {
    event.stopPropagation()
    emit('select', group.primaryId)
  })

  Object.assign(marker.style, {
    width: selected ? '34px' : group.count > 1 ? '30px' : '26px',
    height: selected ? '34px' : group.count > 1 ? '30px' : '26px',
    border: selected ? '3px solid #1c1c1c' : '2px solid #ffffff',
    borderRadius: screening ? '7px' : '999px',
    background: color,
    color: '#ffffff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'D2Coding, ui-monospace, monospace',
    fontSize: group.count > 1 ? '11px' : '10px',
    fontWeight: '700',
    lineHeight: '1',
    opacity: group.status === 'closed' ? '0.72' : '0.96',
    padding: '0',
    boxShadow: [
      ongoing ? '0 0 0 5px var(--ddf-status-open-soft)' : '',
      selected ? '0 12px 28px rgba(0,0,0,0.30)' : '0 7px 18px rgba(0,0,0,0.22)',
    ].filter(Boolean).join(', '),
  })

  return marker
}

function markerTitle(group) {
  const label = group.archiveType === 'screening' ? '상영' : group.archiveType === 'mixed' ? '기록' : '전시'
  const statusLabel = group.status === 'ongoing' ? '현재 관람 가능 ' : ''
  return `${group.venue} ${statusLabel}${label} ${group.count}개`
}

function markerStatus(current, next) {
  const order = {
    ongoing: 0,
    upcoming: 1,
    closed: 2,
    unknown: 3,
  }

  return order[next] < order[current] ? next : current
}
</script>

<style scoped>
.archive-map-pane {
  position: sticky;
  top: 28px;
  align-self: start;
  display: grid;
  gap: 14px;
  min-width: 0;
  min-height: calc(100dvh - 120px);
}

.map-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--ddf-line);
  padding-bottom: 14px;
}

.map-meta,
.detail-kicker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.map-meta {
  justify-content: flex-end;
}

.map-shell {
  position: relative;
  min-height: 0;
  height: calc(100dvh - 150px);
  border: 1px solid var(--ddf-line);
  background: var(--ddf-soft);
  overflow: hidden;
}

.google-map-canvas {
  position: absolute;
  inset: 0;
  background: #ecebe6;
}

.map-fallback {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.44)),
    #ecebe6;
}

.map-loading {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  gap: 12px;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42)),
    #ecebe6;
}

.map-loading span {
  position: relative;
  display: block;
  overflow: hidden;
  width: min(68%, 420px);
  height: 16px;
  background: rgba(255, 255, 255, 0.78);
}

.map-loading span:nth-child(2) {
  width: min(48%, 310px);
}

.map-loading span:nth-child(3) {
  width: min(58%, 360px);
}

.map-loading span::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(28, 28, 28, 0.10), transparent);
  animation: archive-map-skeleton 1.25s ease-in-out infinite;
}

@keyframes archive-map-skeleton {
  100% {
    transform: translateX(100%);
  }
}

.map-fallback p {
  margin: 0;
  border: 1px solid var(--ddf-line);
  background: rgba(255, 255, 255, 0.9);
  padding: 10px 12px;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  line-height: 1.4;
}

.map-notice {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 6;
  max-width: min(360px, calc(100% - 36px));
}

.map-notice p {
  margin: 0;
  border: 1px solid var(--ddf-line);
  background: rgba(255, 255, 255, 0.94);
  padding: 10px 12px;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  line-height: 1.4;
}

.map-detail {
  position: absolute;
  left: 18px;
  right: auto;
  bottom: 18px;
  z-index: 6;
  display: grid;
  gap: 10px;
  width: min(410px, calc(100% - 36px));
  border: 1px solid var(--ddf-line);
  background: rgba(255, 255, 255, 0.94);
  padding: 15px;
  backdrop-filter: blur(4px);
}

.detail-kicker :deep(.ddf-pill) {
  border-color: var(--ddf-line);
  color: var(--ddf-ink);
}

.detail-kicker .city.gwangju {
  border-color: var(--ddf-city-gwangju);
  color: var(--ddf-city-gwangju);
}

.detail-kicker .city.jeonju {
  border-color: var(--ddf-city-jeonju);
  color: var(--ddf-city-jeonju);
}

.detail-kicker .city.jeonnam {
  border-color: var(--ddf-city-jeonnam);
  color: var(--ddf-city-jeonnam);
}

.detail-kicker .status.ongoing {
  border-color: var(--ddf-status-open);
  background: var(--ddf-status-open);
  color: var(--ddf-paper);
  font-weight: 700;
}

.map-detail h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.28;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.map-detail p {
  margin: 0;
  color: #333;
  font-size: 13px;
}

.map-detail dl {
  display: grid;
  gap: 5px;
  margin: 0;
}

.map-detail dl div {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
}

.map-detail dt,
.map-detail dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
}

.map-detail dt {
  color: var(--ddf-muted);
}

.detail-link {
  justify-self: start;
  min-height: 32px;
  padding: 7px 12px;
}

@media (max-width: 1180px) {
  .map-shell {
    height: calc(100dvh - 142px);
  }
}

@media (max-width: 1024px) {
  .archive-map-pane {
    position: static;
    min-height: 0;
  }

  .map-shell {
    height: min(680px, 82dvh);
  }
}

@media (max-width: 680px) {
  .map-toolbar {
    align-items: start;
    flex-direction: column;
  }

  .map-meta {
    justify-content: flex-start;
  }

  .map-shell {
    height: 620px;
  }

  .map-detail {
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto;
    padding: 13px;
  }

  .map-detail h3 {
    font-size: 16px;
  }
}
</style>
