import { computed, isRef, ref, watch } from 'vue'
import { archiveSearchText, archiveTypeValue } from '@/lib/archive-utils'
import { isArchiveEndingToday } from '@/lib/archive-route.mjs'

export function useRegionalArchive(sourceItems, cities) {
  const activeType = ref('all')
  const activeCity = ref('all')
  const activeStatus = ref('all')
  const query = ref('')
  const activeQuickFilter = ref('all')
  const activeSort = ref('default')
  const currentLocation = ref(null)
  const locationError = ref(false)
  const selectedId = ref(readItems()[0]?.id || '')

  const items = computed(readItems)
  const mapCities = computed(() => cities.filter(city => city.id !== 'all'))

  const filteredItems = computed(() => {
    const keyword = query.value.toLowerCase()

    const matches = items.value.filter(item => {
      const matchesType = activeType.value === 'all' || archiveTypeValue(item) === activeType.value
      const matchesCity = activeCity.value === 'all' || item.city === activeCity.value
      const matchesStatus = activeStatus.value === 'all' || item.status === activeStatus.value
      const matchesQuery = !keyword || archiveSearchText(item).includes(keyword)

      const matchesQuickFilter = activeQuickFilter.value === 'all'
        || (activeQuickFilter.value === 'ending-today' && isArchiveEndingToday(item))
        || (activeQuickFilter.value === 'free' && (item.isFree === true || item.admission === 'free'))
        || (activeQuickFilter.value === 'parking' && Boolean(item.hasPublicParking || item.nearbyTransport?.parking?.length))

      return matchesType && matchesCity && matchesStatus && matchesQuery && matchesQuickFilter
    })

    if (activeSort.value !== 'distance' || !currentLocation.value) return matches
    return matches.map((item, index) => ({ item, index, distance: itemDistance(item) }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.index - b.index)
      .map(entry => entry.item)
  })

  const selectedItem = computed(() => (
    filteredItems.value.find(item => item.id === selectedId.value) ||
    filteredItems.value[0] ||
    null
  ))

  const visibleVenueCount = computed(() => (
    new Set(filteredItems.value.map(item => item.venue)).size
  ))

  const mapTitle = computed(() => {
    if (activeCity.value === 'all') return '광주 · 전주 · 전남'

    return cities.find(city => city.id === activeCity.value)?.label || '전시 지도'
  })

  function selectItem(id) {
    selectedId.value = id
  }

  function requestLocation() {
    locationError.value = false
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      locationError.value = true
      return
    }
    navigator.geolocation.getCurrentPosition(position => {
      currentLocation.value = { lat: position.coords.latitude, lng: position.coords.longitude }
      activeSort.value = 'distance'
    }, () => {
      locationError.value = true
    }, { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 })
  }

  function itemDistance(item) {
    if (!currentLocation.value || !validCoordinate(item?.lat) || !validCoordinate(item?.lng)) return null
    return distanceKm(currentLocation.value.lat, currentLocation.value.lng, Number(item.lat), Number(item.lng))
  }

  function resetFilters() {
    activeType.value = 'all'
    activeCity.value = 'all'
    activeStatus.value = 'all'
    activeQuickFilter.value = 'all'
    activeSort.value = 'default'
    query.value = ''
  }

  function readItems() {
    return (isRef(sourceItems) ? sourceItems.value : sourceItems) || []
  }

  watch(filteredItems, nextItems => {
    if (!nextItems.length) {
      selectedId.value = ''
      return
    }

    if (!nextItems.some(item => item.id === selectedId.value)) {
      selectedId.value = nextItems[0].id
    }
  })

  return {
    items,
    activeType,
    activeCity,
    activeStatus,
    activeQuickFilter,
    activeSort,
    currentLocation,
    locationError,
    query,
    selectedId,
    mapCities,
    filteredItems,
    selectedItem,
    visibleVenueCount,
    mapTitle,
    selectItem,
    requestLocation,
    itemDistance,
    resetFilters,
  }
}

function validCoordinate(value) {
  return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRadians = value => value * Math.PI / 180
  const latDelta = toRadians(lat2 - lat1)
  const lngDelta = toRadians(lng2 - lng1)
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lngDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
