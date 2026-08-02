<template>
  <article class="recent-card">
    <h3 class="code-block">Recent&nbsp;Updated</h3>

    <component
      :is="link ? 'a' : 'div'"
      :href="link || undefined"
      class="recent-content"
    >
      <figure class="recent-figure">
        <img
          :src="imageSrc"
          :alt="`${title} 대표 이미지`"
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </figure>
    </component>
  </article>
</template>

<script setup>
defineProps({
  imageSrc: { type: String, required: true },
  title: { type: String, default: '' },
  link: { type: String, default: '' },
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

/* ===== 태블릿 이하 ===== */
@media (max-width: 1024px) {
  .recent-content {
    padding: 12px;
  }
}

/* ===== 모바일 ===== */
@media (max-width: 768px) {
  .recent-card h3 {
    margin-bottom: 10px;
  }

  .recent-content {
    padding: 14px;
  }
}
</style>
