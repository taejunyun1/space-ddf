<template>
  <main class="preview-page">
    <header><RouterLink to="/manage/contents">← 편집으로 돌아가기</RouterLink><span>관리자 미리보기</span></header>
    <article v-if="content">
      <h1>{{ content.title }}</h1>
      <p>{{ content.dateDisplay || content.dateRange }}</p>
      <img v-if="poster" :src="poster.url" :alt="poster.altText || content.title">
      <section v-if="content.body"><p v-for="paragraph in paragraphs(content.body)" :key="paragraph">{{ paragraph }}</p></section>
      <section v-if="content.description"><p v-for="paragraph in paragraphs(content.description)" :key="paragraph">{{ paragraph }}</p></section>
      <div class="gallery"><img v-for="asset in gallery" :key="asset.id" :src="asset.url" :alt="asset.altText || content.title"></div>
    </article>
    <p v-else>{{ notice || '미리보기를 불러오는 중입니다.' }}</p>
  </main>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { fetchAdminContent } from '@/services/contents'
const route = useRoute()
const content = ref(null)
const notice = ref('')
const poster = computed(() => content.value?.assets?.find(asset => asset.role === 'poster'))
const gallery = computed(() => content.value?.assets?.filter(asset => asset.role === 'gallery') || [])
const paragraphs = text => String(text || '').split(/\n\s*\n/).map(value => value.trim()).filter(Boolean)
onMounted(async () => {
  try { content.value = await fetchAdminContent(route.params.id) }
  catch (error) { notice.value = error.message }
})
</script>
<style scoped>
.preview-page{max-width:1180px;margin:0 auto;padding:24px}.preview-page header{display:flex;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid #1c1c1c}.preview-page article{max-width:820px;margin:32px auto}.preview-page article>img{display:block;max-width:100%;max-height:75vh;margin:24px auto;object-fit:contain}.preview-page section{margin:32px 0;white-space:pre-wrap;line-height:1.75}.gallery{display:grid;gap:18px}.gallery img{width:100%;height:auto}
</style>

