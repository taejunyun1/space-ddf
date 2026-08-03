<template>
  <nav class="archive-mode-tabs" aria-label="전시 아카이브 기능">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.to"
      class="archive-mode-tab ddf-focusable"
      :aria-current="route.path === tab.path ? 'page' : undefined"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { serializeArchiveRouteIds } from '@/lib/archive-route.mjs'

const props = defineProps({
  selectedIds: {
    type: Array,
    default: () => [],
  },
})

const route = useRoute()
const selectionQuery = computed(() => serializeArchiveRouteIds(props.selectedIds))
const tabs = computed(() => [
  { path: '/archive-map', label: '전시지도' },
  { path: '/archive-route', label: '길찾기' },
].map(tab => ({
  ...tab,
  to: { path: tab.path, query: selectionQuery.value ? { to: selectionQuery.value } : {} },
})))
</script>

<style scoped>
.archive-mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--ddf-line);
  margin: 14px 0 0;
}

.archive-mode-tab {
  min-height: 42px;
  display: grid;
  place-items: center;
  color: var(--ddf-ink);
  background: var(--ddf-paper);
  font-family: var(--ddf-font-mono);
  font-size: 12px;
  text-decoration: none;
}

.archive-mode-tab + .archive-mode-tab {
  border-left: 1px solid var(--ddf-line);
}

.archive-mode-tab[aria-current="page"] {
  color: var(--ddf-paper);
  background: var(--ddf-ink);
}
</style>
