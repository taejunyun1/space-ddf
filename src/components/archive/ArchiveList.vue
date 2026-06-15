<template>
  <ol v-if="loading" class="archive-list ddf-scrollbar" aria-label="아카이브 로딩 중">
    <li v-for="index in 5" :key="`archive-skeleton-${index}`">
      <article class="archive-card skeleton-card" aria-hidden="true">
        <div class="card-main">
          <span class="skeleton-line skeleton-pills"></span>
          <span class="skeleton-line skeleton-title"></span>
          <span class="skeleton-line skeleton-meta"></span>
          <span class="skeleton-line skeleton-summary"></span>
          <span class="skeleton-line skeleton-tags"></span>
        </div>
        <span class="skeleton-source"></span>
      </article>
    </li>
  </ol>

  <div v-else-if="!items.length" class="archive-empty" role="status">
    <p>조건에 맞는 기록이 없습니다.</p>
  </div>

  <ol v-else class="archive-list ddf-scrollbar">
    <li v-for="item in items" :key="item.id">
      <article
        class="archive-card"
        :class="{ selected: selectedId === item.id, 'is-ongoing': item.status === 'ongoing' }"
      >
        <button
          type="button"
          class="card-main ddf-focusable"
          @click="$emit('select', item.id)"
        >
          <span class="card-topline">
            <span class="ddf-pill">{{ item.cityLabel }}</span>
            <span class="ddf-pill type" :class="archiveTypeValue(item)">
              {{ archiveTypeLabel(item) }}
            </span>
            <span class="ddf-pill status" :class="item.status">{{ item.statusLabel }}</span>
          </span>
          <span class="card-title">{{ item.title }}</span>
          <span class="card-meta">{{ item.venue }} · {{ archiveSchedule(item) }}</span>
          <span class="card-summary">{{ item.summary }}</span>
          <span class="card-tags">
            <span v-for="tag in item.category" :key="`${item.id}-${tag}`" class="ddf-pill">
              {{ tag }}
            </span>
          </span>
        </button>

        <a
          v-if="item.sourceUrl"
          class="ddf-source-link"
          :href="item.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          원문
        </a>
      </article>
    </li>
  </ol>
</template>

<script setup>
import {
  archiveSchedule,
  archiveTypeLabel,
  archiveTypeValue,
} from '@/lib/archive-utils'

defineProps({
  items: {
    type: Array,
    required: true,
  },
  selectedId: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['select'])
</script>

<style scoped>
.archive-list {
  flex: 1 1 auto;
  min-height: 0;
  list-style: none;
  margin: 0;
  padding: 0 8px 0 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.archive-list li {
  padding: 0;
}

.archive-empty {
  flex: 1 1 auto;
  min-height: 160px;
  display: grid;
  place-items: center;
  border-top: 1px solid var(--ddf-subtle-line);
  border-bottom: 1px solid var(--ddf-subtle-line);
  color: var(--ddf-muted);
}

.archive-empty p {
  margin: 0;
  font-family: var(--ddf-font-mono);
  font-size: 12px;
}

.archive-card {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 12px;
  align-items: start;
  padding: 14px 0;
  border-top: 1px solid var(--ddf-subtle-line);
  background: transparent;
  color: inherit;
}

.archive-list li:last-child .archive-card {
  border-bottom: 1px solid var(--ddf-subtle-line);
}

.archive-card:hover .card-title,
.archive-card.selected .card-title {
  text-decoration: underline;
}

.archive-card.selected {
  padding-left: 10px;
  border-top-color: var(--ddf-line);
  border-left: 3px solid var(--ddf-line);
}

.archive-card.is-ongoing {
  padding-left: 10px;
  background: linear-gradient(90deg, var(--ddf-status-open-soft), transparent 72%);
  box-shadow: inset 3px 0 0 var(--ddf-status-open);
}

.archive-card.is-ongoing.selected {
  border-left-color: var(--ddf-status-open);
  box-shadow: none;
}

.card-main {
  min-width: 0;
  display: grid;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card-topline,
.card-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.status.ongoing {
  border-color: var(--ddf-status-open);
  background: var(--ddf-status-open);
  color: var(--ddf-paper);
  font-weight: 700;
}

.status.upcoming {
  border-color: var(--ddf-city-jeonnam);
  color: var(--ddf-city-jeonnam);
}

.status.closed {
  border-color: #929292;
  color: #626262;
}

.type.screening {
  border-color: var(--ddf-line);
  background: var(--ddf-soft);
  color: var(--ddf-ink);
}

.card-title {
  display: block;
  min-width: 0;
  font-size: 16px;
  line-height: 1.32;
  font-weight: 700;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.card-meta,
.card-summary {
  display: block;
  min-width: 0;
  font-size: 12px;
  line-height: 1.45;
}

.card-meta {
  color: var(--ddf-muted);
}

.card-summary {
  color: #333;
}

.card-tags :deep(.ddf-pill) {
  min-height: 20px;
  padding: 4px 7px;
  color: #555;
  background: var(--ddf-tag-bg);
}

.skeleton-card {
  pointer-events: none;
}

.skeleton-line,
.skeleton-source {
  display: block;
  position: relative;
  overflow: hidden;
  background: #ecece8;
}

.skeleton-line::after,
.skeleton-source::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.72), transparent);
  animation: archive-skeleton 1.25s ease-in-out infinite;
}

.skeleton-pills {
  width: 145px;
  height: 22px;
  border-radius: 999px;
}

.skeleton-title {
  width: min(86%, 310px);
  height: 18px;
}

.skeleton-meta {
  width: min(72%, 260px);
  height: 13px;
}

.skeleton-summary {
  width: 100%;
  height: 34px;
}

.skeleton-tags {
  width: 175px;
  height: 20px;
  border-radius: 999px;
}

.skeleton-source {
  width: 50px;
  height: 28px;
  border-radius: 999px;
}

@keyframes archive-skeleton {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 1024px) {
  .archive-list {
    max-height: 460px;
  }
}

@media (max-width: 680px) {
  .archive-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .ddf-source-link {
    justify-self: start;
  }

  .card-title {
    font-size: 15px;
  }
}
</style>
