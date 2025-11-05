<template>
  <article class="recent-card">
    <h3 class="code-block">Recent&nbsp;Updated</h3>

    <!-- 링크로 전체 감싸기 -->
    <component :is="link ? 'a' : 'div'" 
               :href="link || null" 
               class="recent-content">
      <figure class="recent-figure">
        <img :src="imageSrc" :alt="title" />
      </figure>

      <div class="recent-meta">
        <div class="recent-name">{{ title }}</div>
        <div class="recent-date">{{ dateRange }}</div>
        <p class="recent-desc">
          {{ desc }}
        </p>
        <span v-if="link" class="recent-link">자세히 보기 →</span>
      </div>
    </component>
  </article>
</template>

<script setup>
defineProps({
  imageSrc: { type: String, required: true },
  title: { type: String, default: '' },
  dateRange: { type: String, default: '' },
  desc: { type: String, default: '' },
  link: { type: String, default: '' },
})
</script>

<style scoped>
.recent-card { display:flex; flex-direction:column; max-width:100%; }

/* figure + meta 묶음 */
.recent-content { 
  max-width:800px;  /* 🔽 550 → 520 */
  width: 100%; 
}

.recent-figure {
  width:100%; 
  border:1px solid #1C1C1C; 
  overflow:hidden; 
}

.recent-figure img { 
  width:100%; 
  height:auto; 
  display:block; 
  max-width: 100%;
}

.recent-meta { 
  display:grid; 
  grid-template-columns: 1fr auto; 
  row-gap:6px; 
  margin-top: 10px;
  max-width:100%; /* 이미지 폭 이상으로 늘어나지 않게 */
  word-wrap: break-word; /* 긴 단어도 줄바꿈 */
}

.recent-name { grid-column:1 / 2; font-weight:600; }
.recent-date { grid-column:2 / 3; color:#666; font-size:14px; }
.recent-desc { grid-column:1 / 3; color:#555; line-height:1.5; margin:6px 0 0; }
.recent-link { grid-column:1 / 3; font-size:14px; text-decoration:none; }

/* ===== 모바일 버전 (20% 축소) ===== */
@media (max-width: 1024px) {
  .recent-date,
  .recent-link {
    font-size: 11px; 
  }
  .recent-desc {
    font-size: 11px; 
    line-height: 1.4;
  }
  .recent-name {
    font-size: 14px; 
  }
}

/* ===== 모바일: ≤768px ===== */
@media (max-width: 768px) {
  .recent-content {
    max-width: 100%;   /* 520px 제한 해제 → 화면 가득 */
  }
  .recent-figure {
    width: 100%;       /* 부모 크기 따라 꽉 차기 */
  }
}

</style>