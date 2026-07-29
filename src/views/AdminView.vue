<template>
  <main class="admin-page">
    <header class="admin-header">
      <div>
        <p>Space DDF Admin</p>
        <h1>관리자</h1>
      </div>
      <nav class="admin-area-tabs" role="tablist" aria-label="관리 영역">
        <button
          v-for="area in areas"
          :key="area.id"
          type="button"
          role="tab"
          :aria-selected="activeArea === area.id"
          :class="{ active: activeArea === area.id }"
          @click="activeArea = area.id"
        >
          {{ area.label }}
        </button>
      </nav>
    </header>

    <AdminRentalsView v-if="activeArea === 'rentals'" />
    <AdminContentsView v-else @preview="openPreview" />
    <ContentPreviewModal v-if="previewContent" :content="previewContent" @close="closePreview" />
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AdminContentsView from '@/views/AdminContentsView.vue'
import AdminRentalsView from '@/views/AdminRentalsView.vue'
import ContentPreviewModal from '@/components/admin/ContentPreviewModal.vue'

const areas = [
  { id: 'rentals', label: '렌탈 관리' },
  { id: 'contents', label: '콘텐츠 관리' },
]
const activeArea = ref('rentals')
const previewContent = ref(null)

function openPreview(content) { previewContent.value = content }
function closePreview() { previewContent.value = null }
function handleKeydown(event) {
  if (event.key === 'Escape' && previewContent.value) closePreview()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.admin-page{min-height:100vh;background:#fff;color:#1c1c1c;font-family:'D2Coding',monospace}
.admin-header{position:sticky;top:0;z-index:20;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:16px 20px;border-bottom:1px solid #1c1c1c;background:#fff}
.admin-header p,.admin-header h1{margin:0}.admin-header p{font-size:12px}.admin-header h1{font-size:25px}
.admin-area-tabs{display:flex}.admin-area-tabs button{min-width:130px;padding:11px 18px;border:1px solid #1c1c1c;background:#fff;font:inherit}
.admin-area-tabs button+button{border-left:0}.admin-area-tabs button.active{background:#1c1c1c;color:#fff}.admin-area-tabs button:focus-visible{position:relative;z-index:1;outline:3px solid #78aef7;outline-offset:2px}
@media(max-width:700px){.admin-header{position:static;display:block}.admin-area-tabs{margin-top:14px}.admin-area-tabs button{flex:1;min-width:0}}
</style>
