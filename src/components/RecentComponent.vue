<template>
  <article class="recent-card">
    <h3 class="code-block">Recent&nbsp;Updated</h3>

    <component
      :is="componentTag"
      :href="activeHref || undefined"
      class="recent-content"
      :class="{ 'is-expired': isExpired }"
    >
      <!-- 기간이 지나지 않았을 때 -->
      <template v-if="!isExpired">
        <figure class="recent-figure">
          <img
            :src="imageSrc"
            :alt="`${title} 대표 이미지`"
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
        </figure>

        <div class="recent-meta">
          <div class="recent-name">{{ title }}</div>
          <div class="recent-date">{{ dateRange }}</div>

          <p class="recent-desc">
            {{ desc }}
          </p>

          <span v-if="link" class="recent-link">자세히 보기 →</span>
        </div>
      </template>

      <!-- 기간이 지났을 때 -->
      <div
        v-else
        class="recent-empty"
        role="status"
        aria-live="polite"
      >
        <div class="recent-empty-title">전시준비중입니다</div>
        <p class="recent-empty-desc">
          새로운 전시 소식을 곧 업데이트할 예정입니다.
        </p>
      </div>
    </component>
  </article>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { parseDateRange } from '@/stores/lib/date-helpers'

const props = defineProps({
  imageSrc: { type: String, required: true },
  title: { type: String, default: '' },
  dateRange: { type: String, default: '' },
  desc: { type: String, default: '' },
  link: { type: String, default: '' },
})

const now = ref(new Date())

let timerId = null

onMounted(() => {
  timerId = window.setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)
})

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId)
  }
})

function getEndOfDay(date) {
  const copied = new Date(date)
  copied.setHours(23, 59, 59, 999)
  return copied
}

const isExpired = computed(() => {
  const { start, end } = parseDateRange(props.dateRange)

  const compareDate = end || start

  if (!compareDate) {
    return false
  }

  return now.value.getTime() > getEndOfDay(compareDate).getTime()
})

const activeHref = computed(() => {
  return isExpired.value ? '' : props.link
})

const componentTag = computed(() => {
  return activeHref.value ? 'a' : 'div'
})
</script>



<style scoped>
.recent-card {
  display: flex;
  flex-direction: column;

  width: 100%;
  max-width: 100%;
  min-width: 0;
}

/* 제목 */
.recent-card h3 {
  margin: 0 0 14px;
}

/* CalendarComponent와 박스 크기/질감 맞춤 */
.recent-content {
  display: flex;
  flex-direction: column;

  width: 100%;
  max-width: 100%;
  min-width: 0;

  height: 100%;

  padding: 14px;

  border: 1px solid #1C1C1C;
  background: #fff;

  color: inherit;
  text-decoration: none;

  box-sizing: border-box;
}

/* 이미지 영역 */
.recent-figure {
  width: 100%;
  max-width: 100%;

  margin: 0;

  border: none;
  overflow: hidden;

  box-sizing: border-box;
}

/* 이미지 */
.recent-figure img {
  display: block;

  width: 100%;
  max-width: 100%;
  height: auto;

  object-fit: cover;
}

/* 하단 메타 정보 */
.recent-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: 12px;
  row-gap: 6px;

  width: 100%;
  max-width: 100%;
  min-width: 0;

  margin-top: 10px;
}

/* 제목 */
.recent-name {
  grid-column: 1 / 2;

  min-width: 0;

  font-weight: 600;
  line-height: 1.35;

  overflow-wrap: break-word;
  word-break: keep-all;
}

/* 날짜 */
.recent-date {
  grid-column: 2 / 3;

  color: #666;
  font-size: 14px;
  line-height: 1.35;

  white-space: nowrap;
}

/* 설명 */
.recent-desc {
  grid-column: 1 / 3;

  min-width: 0;

  margin: 6px 0 0;

  color: #555;
  line-height: 1.5;

  overflow-wrap: break-word;
  word-break: keep-all;
}

/* 자세히 보기 */
.recent-link {
  grid-column: 1 / 3;

  margin-top: 4px;

  font-size: 14px;
  color: #1C1C1C;
  text-decoration: none;
}

.recent-content:hover .recent-link {
  text-decoration: underline;
}

/* ===== 종료 후 빈 상태 ===== */
.recent-empty {
  width: 100%;
  min-height: 100%;

  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  padding: 32px;

  text-align: center;
  box-sizing: border-box;
}

.recent-empty-title {
  font-family: 'D2Coding', monospace;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
}

.recent-empty-desc {
  margin: 12px 0 0;

  color: #666;
  font-size: 14px;
  line-height: 1.5;

  word-break: keep-all;
}

.recent-content.is-expired {
  cursor: default;
}

/* ===== 태블릿 이하 ===== */
@media (max-width: 1024px) {
  .recent-content {
    min-height: 420px;
    padding: 12px;
  }

  .recent-name {
    font-size: 14px;
  }

  .recent-date,
  .recent-link {
    font-size: 11px;
  }

  .recent-desc {
    font-size: 11px;
    line-height: 1.4;
  }

  .recent-empty-title {
    font-size: 18px;
  }

  .recent-empty-desc {
    font-size: 11px;
  }
}

/* ===== 모바일 ===== */
@media (max-width: 768px) {
  .recent-card h3 {
    margin-bottom: 10px;
  }

  .recent-content {
    min-height: 320px;
    padding: 14px;
  }

  .recent-meta {
    grid-template-columns: 1fr;
    row-gap: 4px;
  }

  .recent-name,
  .recent-date,
  .recent-desc,
  .recent-link {
    grid-column: 1 / 2;
  }

  .recent-date {
    white-space: normal;
  }

  .recent-desc {
    margin-top: 4px;
  }

  .recent-empty {
    padding: 24px;
  }

  .recent-empty-title {
    font-size: 16px;
  }
}
</style>
