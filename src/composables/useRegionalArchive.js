import { computed, isRef, ref, watch } from 'vue'
import { archiveSearchText, archiveTypeValue } from '@/lib/archive-utils'

export function useRegionalArchive(sourceItems, cities) {
  const activeType = ref('all')
  const activeCity = ref('all')
  const activeStatus = ref('all')
  const query = ref('')
  const selectedId = ref(readItems()[0]?.id || '')

  const items = computed(readItems)
  const mapCities = computed(() => cities.filter(city => city.id !== 'all'))

  const filteredItems = computed(() => {
    const keyword = query.value.toLowerCase()

    return items.value.filter(item => {
      const matchesType = activeType.value === 'all' || archiveTypeValue(item) === activeType.value
      const matchesCity = activeCity.value === 'all' || item.city === activeCity.value
      const matchesStatus = activeStatus.value === 'all' || item.status === activeStatus.value
      const matchesQuery = !keyword || archiveSearchText(item).includes(keyword)

      return matchesType && matchesCity && matchesStatus && matchesQuery
    })
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
    query,
    selectedId,
    mapCities,
    filteredItems,
    selectedItem,
    visibleVenueCount,
    mapTitle,
    selectItem,
  }
}
