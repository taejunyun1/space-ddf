<template>
  <!-- 좌 85% / 우 15% -->
  <article class="detail-wrap">
    <!-- 본문(좌측) -->
    <div class="main">
      <header class="detail-head">
        <h1 class="detail-title chip">{{ item?.title }}</h1>
      </header>

      <!-- 상단: 포스터(좌) + 크레딧(우) / 하단: 본문 -->
      <section class="content-grid">
        <!-- 1행: 포스터 + 크레딧 -->
        <div class="poster-row">
          <!-- 포스터 -->
          <figure
            v-if="item?.hero"
            class="poster"
            role="button"
            tabindex="0"
            aria-label="대표 이미지 크게 보기"
            @click="openLightbox(0)"
            @keyup.enter="openLightbox(0)"
          >
            <img :src="item.hero" :alt="item.title" />
          </figure>

          <!-- 크레딧 -->
          <div
            v-if="item?.credits?.length || item?.dateRange || item?.location"
            class="credit-block"
          >
            <p v-if="item?.dateRange" class="detail-date chip date-chip" style="margin-top:0">
              {{ item?.dateRange }}
            </p>
            <p v-for="(c,i) in (item?.credits || [])" :key="i" class="credit-line">
              {{ c }}
            </p>
            <p v-if="item?.location" class="location-line">
              <strong>Location</strong> · {{ item.location }}
            </p>
          </div>
        </div>

        <!-- 2행: 본문 텍스트 -->
        <div class="text-row">
          <div v-if="item?.body?.length" class="body-block">
            <p v-for="(para,i) in item.body" :key="'body'+i" class="body-text">{{ para }}</p>
          </div>
          <div v-if="descriptionParas.length" class="desc-block">
            <p v-for="(d,i) in descriptionParas" :key="'desc'+i" class="desc-text">{{ d }}</p>
          </div>
        </div>
      </section>

      <!-- 갤러리 -->
      <section v-if="item?.gallery?.length" class="gallery">
        <figure
          v-for="(g,i) in item.gallery"
          :key="i"
          class="gal-item"
          role="button"
          tabindex="0"
          :aria-label="`${item.title} 갤러리 이미지 ${i+1} 크게 보기`"
          @click="openLightbox(item?.hero ? i + 1 : i)"
          @keyup.enter="openLightbox(item?.hero ? i + 1 : i)"
        >
          <img :src="typeof g==='string' ? g : g.src" :alt="(typeof g==='object' && g.alt) || item.title" />
          <figcaption v-if="typeof g==='object' && g.caption">{{ g.caption }}</figcaption>
        </figure>
      </section>
    </div>

    <!-- 사이드 -->
    <aside class="side">
      <div class="sticky-wrap">
        <div class="panel list-section">
          <div class="code-block panel-wrap">
            <div><h3 class="panel-title" style="font-size:18px">{{ typeLabel }}</h3></div>
            <div><RouterLink class="back-link" to="/">← Back to Home</RouterLink></div>
          </div>

          <ul class="item-list side-list">
            <li v-for="it in sideList" :key="it.slug">
              <RouterLink
                :to="makeTo(it)"
                class="side-item row row-link"
                :class="{ active: it.slug === slug }"
                :aria-label="`${it.title} 상세로 이동`"
              >
                <div class="title side-title">{{ it.title }}</div>
                <div class="date side-date">{{ it.dateRange }}</div>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  </article>

  <!-- 라이트박스 -->
  <vue-easy-lightbox
    :visible="lightboxVisible"
    :index="lightboxIndex"
    :imgs="[ ...(item?.hero ? [item.hero] : []), ...((item?.gallery || []).map(g => (typeof g==='string' ? g : g.src))) ]"
    :maskClosable="true"
    :escDisabled="false"
    :downloadButton="false"
    @hide="lightboxVisible = false"
  />
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useContentStore } from '@/stores/content'
import VueEasyLightbox from 'vue-easy-lightbox'

const props = defineProps({
  type: { type: String, required: false },
  slug: { type: String, required: false },
})

const route = useRoute()
const router = useRouter()
const store = useContentStore()

const type = computed(() => {
  if (props.type) return props.type
  const name = route.name?.toString() || ''
  return name.includes('project') ? 'project' : 'show'
})
const slug = computed(() => props.slug || route.params.slug)

const item = computed(() => {
  const s = slug.value
  return type.value === 'project' ? store.projectBySlug(s) : store.showBySlug(s)
})

const collection = computed(() =>
  type.value === 'project' ? store.projectsSortedDesc : store.showsSortedDesc
)
const sideList = computed(() => collection.value || [])
const typeLabel = computed(() => (type.value === 'project' ? 'Project' : 'Show'))
const makeTo = (it) => (type.value === 'project' ? `/projects/${it.slug}` : `/shows/${it.slug}`)

watchEffect(() => {
  if (!slug.value) return
  if (!item.value) {
    const target = router.hasRoute && router.hasRoute('not-found') ? { name: 'not-found' } : { path: '/' }
    router.replace(target)
  }
})

const descriptionParas = computed(() => {
  const d = item.value?.description ?? item.value?.desc
  if (!d) return []
  return Array.isArray(d) ? d : [d]
})

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)
const openLightbox = (i) => { lightboxIndex.value = i; lightboxVisible.value = true }
</script>

<style scoped>
/* ===== 레이아웃: 좌 본문(유동) / 우 사이드(고정) ===== */
.detail-wrap{
  --gap:20px; --line:#1C1C1C; --muted:#666;
  display:grid;
  grid-template-columns:minmax(0,1fr) 400px;  /* 본문 유동 + 사이드 고정 */
  gap:var(--gap);
  padding:24px 20px 60px;
  padding-top:60px;
  width:100%;
  margin:0;
  box-sizing:border-box;

  /* 가로 스크롤 방지 */
  overflow-x: clip;
}
.detail-wrap > *{ min-width:0; } /* 그리드 자식 축소 허용 */

/* 부모(main-content)가 overflow로 잘리는 걸 방지 */
:global(.main-content){ overflow-x: clip; }

/* ===== 좌/우 영역 배치 ===== */
.detail-wrap .main{ grid-column:1; min-width:0; }
.detail-wrap .side{ grid-column:2; align-self:start; justify-self:end; }

/* 데스크탑에서만 사이드 고정폭 */
@media (min-width:1281px){
  .side{ min-width:400px; }
}

/* ===== 본문 내부 그리드 ===== */
.content-grid{
  display:grid;
  grid-template-rows:auto auto; 
  gap:18px;
  min-width:0;
}

/* 1행: 포스터 + 크레딧 */
.poster-row{
  display:grid;
  grid-template-columns:clamp(220px,32vw,360px) minmax(0,1fr);
  gap:18px;
  align-items:start;
  min-width:0;
}
.poster{ margin:0; border:1px solid #e6e6e6; background:#fff; cursor:zoom-in; }
.poster img{ display:block; width:100%; height:auto; object-fit:cover; }

/* 크레딧 */
.date-chip{ color:#666; }
.credit-line{ color:#666; margin:4px 0; line-height:1.4; }
.location-line{ color:#4b5563; margin-top:6px; }

/* 2행: 텍스트 */
.text-row{ min-width:0; }
.body-block{ display:grid; gap:12px; margin-top:2px; }
.body-text{ margin:0; white-space:pre-line; word-break:break-word; }
.desc-block{ display:grid; gap:10px; }
.desc-text{ line-height:1.6; white-space:pre-line; word-break:break-word; margin-top:0; }

/* 갤러리 */
.gallery{
  margin-top:25px;
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
  min-width:0;
}
.gal-item{ margin:0; cursor:zoom-in; }
.gal-item img{ width:100%; height:100%; display:block; object-fit:cover; }
.gal-item figcaption{ margin-top:6px; font-size:12px; color:#6b7280; }

/* ===== 반응형 ===== */
/* 중간 화면: 갤러리 2열 */
@media (max-width:1200px){
  .gallery{ grid-template-columns:repeat(2,minmax(0,1fr)); }
}

/* 작은 화면: 사이드 아래로 + 한 칼럼 고정 */
@media (max-width:1280px){
  .detail-wrap{
    grid-template-columns:1fr !important;
    grid-template-areas:none;
  }
  .detail-wrap .side{
    grid-column:1;
    justify-self:stretch;   /* 가로 꽉 */
    width:auto;
    min-width:0;            /* 고정폭 제거 */
  }
  .sticky-wrap{ position:static; }
  .poster-row{ grid-template-columns:1fr; gap:12px; }
  .title.side-title{ font-size:14px; }
  .date.side-date{ font-size:11px; }
}

/* 더 작은 화면: 갤러리 1열 */
@media (max-width:600px){
  .gallery{ grid-template-columns:1fr; }
}
.detail-title{
  font-size: 22px;
}

/* ===== 사이드 ===== */
.sticky-wrap{ position:sticky; top:24px; display:grid; }
.panel.list-section{}
.panel-wrap{ display:flex; justify-content:space-between; align-items:center; margin:0 0 10px; gap:8px; min-width:0; }
.panel-title{ font-weight:700; margin:0; }
.back-link{ font-size:13px; text-decoration:underline; }

.item-list.side-list{ list-style:none; padding:0; margin:0; border-top:1px solid var(--line); min-width:0; }
.side-item.row{
  padding:12px 0; border-bottom:1px solid var(--line);
  display:grid; grid-template-columns:minmax(0,1fr) auto; row-gap:4px;
  color:inherit; text-decoration:none; min-width:0;
}
.side-item.row:hover .title{ text-decoration:underline; }
.title.side-title{
  font-weight:600; font-size:16px; line-height:1.35;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;
}
.date.side-date{ color:var(--muted); font-size:13px; justify-self:end; align-self:start; }
.side-item.active .title{ font-weight:700; text-decoration:underline; }

/* 미디어 요소 안전장치 */
.detail-wrap :where(img,video,canvas,svg,iframe){
  max-inline-size:100%;
  block-size:auto;
  display:block;
}
</style>