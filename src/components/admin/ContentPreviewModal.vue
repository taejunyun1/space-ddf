<template>
  <div
    class="content-preview-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="content-preview-title"
    @click.self="$emit('close')"
  >
    <article class="content-preview">
      <header>
        <div>
          <p>관리자 미리보기</p>
          <h2 id="content-preview-title">{{ content.title || '제목 없음' }}</h2>
        </div>
        <button type="button" aria-label="미리보기 닫기" @click="$emit('close')">닫기 ×</button>
      </header>
      <p class="content-preview-date">{{ content.dateDisplay || content.dateRange }}</p>
      <img v-if="poster" class="content-preview-poster" :src="poster.url" :alt="poster.altText || content.title">
      <section v-if="content.body">
        <p v-for="paragraph in paragraphs(content.body)" :key="paragraph">{{ paragraph }}</p>
      </section>
      <section v-if="content.description">
        <p v-for="paragraph in paragraphs(content.description)" :key="paragraph">{{ paragraph }}</p>
      </section>
      <div class="content-preview-gallery">
        <img v-for="asset in gallery" :key="asset.id" :src="asset.url" :alt="asset.altText || content.title">
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  content: { type: Object, required: true },
})

defineEmits(['close'])

const poster = computed(() => props.content.assets?.find(asset => asset.role === 'poster'))
const gallery = computed(() => props.content.assets?.filter(asset => asset.role === 'gallery') || [])
const paragraphs = text => String(text || '').split(/\n\s*\n/).map(value => value.trim()).filter(Boolean)
</script>

<style scoped>
.content-preview-backdrop{position:fixed;inset:0;z-index:1000;overflow:auto;padding:24px;background:rgba(20,20,20,.72)}
.content-preview{box-sizing:border-box;width:min(920px,100%);min-height:calc(100vh - 48px);margin:0 auto;padding:28px;background:#fff;color:#1c1c1c}
.content-preview header{display:flex;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:1px solid #1c1c1c}
.content-preview header p,.content-preview header h2{margin:0 0 5px}.content-preview header button{align-self:flex-start;padding:8px 12px;border:1px solid #1c1c1c;background:#fff}
.content-preview-date{margin:18px 0}.content-preview-poster{display:block;max-width:100%;max-height:70vh;margin:24px auto;object-fit:contain}
.content-preview section{margin:30px 0;line-height:1.75;white-space:pre-wrap}.content-preview-gallery{display:grid;gap:18px}.content-preview-gallery img{width:100%;height:auto}
@media(max-width:700px){.content-preview-backdrop{padding:0}.content-preview{min-height:100vh;padding:18px}}
</style>
