<template>
  <aside v-if="selectedItems.length" class="archive-route-selection" aria-label="선택 경로" aria-live="polite">
    <div>
      <strong>{{ selectedItems.length }} / {{ limit }}곳 선택</strong>
      <span>{{ selectedItems.map(item => item.venue || item.title).join(' → ') }}</span>
      <small v-if="selectedItems.length >= limit">최대 6곳까지 선택할 수 있습니다.</small>
    </div>
    <RouterLink class="archive-route-selection-link ddf-focusable" :to="routeTarget">
      길찾기에서 순서 정하기 →
    </RouterLink>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { NAVER_MAX_ROUTE_LOCATIONS, serializeArchiveRouteIds } from '@/lib/archive-route.mjs'

const props = defineProps({ selectedItems: { type: Array, required: true } })
const limit = NAVER_MAX_ROUTE_LOCATIONS
const routeTarget = computed(() => ({
  path: '/archive-route',
  query: { to: serializeArchiveRouteIds(props.selectedItems.map(item => item.id)) },
}))
</script>

<style scoped>
.archive-route-selection { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; margin-top: 10px; padding: 10px; border: 1px solid var(--ddf-line); background: var(--ddf-paper); }
.archive-route-selection div { min-width: 0; display: grid; gap: 3px; }
.archive-route-selection strong,.archive-route-selection span,.archive-route-selection small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.archive-route-selection strong { font-family: var(--ddf-font-mono); font-size: 11px; }
.archive-route-selection span,.archive-route-selection small { color: var(--ddf-muted); font-size: 10px; }
.archive-route-selection-link { min-height: 42px; display: grid; place-items: center; padding: 0 14px; color: var(--ddf-paper); background: var(--ddf-ink); font-size: 11px; font-weight: 700; text-decoration: none; }
@media (max-width: 680px) { .archive-route-selection { position: sticky; bottom: 0; z-index: 30; grid-template-columns: 1fr; padding-bottom: max(10px, env(safe-area-inset-bottom)); } .archive-route-selection-link { width: 100%; } }
</style>
