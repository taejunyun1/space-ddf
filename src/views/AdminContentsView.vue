<template>
  <main class="admin-contents-page">
    <aside class="admin-content-nav">
      <header><p>Admin Contents</p><h1>콘텐츠 관리</h1></header>
      <nav><RouterLink to="/manage/rentals">대관 관리</RouterLink><RouterLink to="/manage/contents">콘텐츠 관리</RouterLink></nav>
      <button class="new-button" type="button" @click="createContent">+ 새 콘텐츠</button>
      <div class="filters">
        <button v-for="item in filters" :key="item.value" type="button" :class="{ active: activeFilter === item.value }" @click="activeFilter = item.value; loadContents()">{{ item.label }}</button>
      </div>
      <input v-model="query" aria-label="콘텐츠 검색" placeholder="제목 또는 slug 검색" @input="queueSearch">
      <button v-for="item in contents" :key="item.id" class="content-row" :class="{ active: draft?.id === item.id }" type="button" @click="selectContent(item)">
        <strong>{{ item.title || '제목 없음' }}</strong><small>{{ item.type }} · {{ statusLabel(item.status) }}</small>
      </button>
      <p v-if="!contents.length" class="empty">콘텐츠가 없습니다.</p>
    </aside>

    <ContentEditor v-if="draft" v-model="draft" v-model:section="activeSection" @upload="uploadAsset" @update-asset="updateAsset" @delete-asset="deleteAsset" />
    <section v-else class="empty-editor"><h2>콘텐츠를 선택하거나 새로 만드세요.</h2></section>
    <ContentPublishPanel v-if="draft" :content="draft" :validation="validation" :save-state-label="saveStateLabel"
      @preview="preview" @publish="publish" @unpublish="unpublish" @trash="trash" @restore="restore" @duplicate="duplicate" @focus-field="focusField" />
    <aside v-else class="empty-panel"></aside>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ContentEditor from '@/components/admin/ContentEditor.vue'
import ContentPublishPanel from '@/components/admin/ContentPublishPanel.vue'
import {
  createAdminContent, deleteAdminContentAsset, duplicateAdminContent, fetchAdminContent,
  fetchAdminContents, publishAdminContent, restoreAdminContent, trashAdminContent,
  unpublishAdminContent, updateAdminContent, updateAdminContentAsset, uploadAdminContentAsset,
} from '@/services/contents'

const contents = ref([])
const draft = ref(null)
const activeFilter = ref('')
const activeSection = ref('basic')
const query = ref('')
const notice = ref('')
const saveState = ref('saved')
let saveTimer
let searchTimer
const filters = [
  { label: '전체', value: '' }, { label: 'Show', value: 'show' }, { label: 'Project', value: 'project' },
  { label: '임시', value: 'draft' }, { label: '공개', value: 'published' }, { label: '휴지통', value: 'trash' },
]
const saveStateLabel = computed(() => ({ saving: '저장 중…', saved: '저장됨', failed: '저장 실패' }[saveState.value]))
const validation = computed(() => {
  if (!draft.value) return {}
  const fields = {}
  if (!draft.value.title?.trim()) fields.title = '제목을 입력해주세요.'
  if (!draft.value.startDate) fields.startDate = '시작일을 입력해주세요.'
  if (!draft.value.credits?.length) fields.credits = '크레딧을 입력해주세요.'
  if (!draft.value.body?.trim() && !draft.value.description?.trim()) fields.body = '소개 또는 본문을 입력해주세요.'
  if (!draft.value.assets?.some(item => item.role === 'poster' && item.uploadStatus === 'ready')) fields.poster = '포스터를 업로드해주세요.'
  return fields
})

watch(draft, (next, previous) => {
  if (!next?.id || next.id !== previous?.id) return
  clearTimeout(saveTimer)
  saveState.value = 'saving'
  saveTimer = setTimeout(saveDraft, 500)
}, { deep: true })

onMounted(loadContents)
async function loadContents() {
  const type = ['show', 'project'].includes(activeFilter.value) ? activeFilter.value : ''
  const status = ['draft', 'published', 'unpublished'].includes(activeFilter.value) ? activeFilter.value : ''
  try { contents.value = await fetchAdminContents({ type, status, q: query.value, deletedOnly: activeFilter.value === 'trash' }) }
  catch (error) { notice.value = error.message }
}
function queueSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(loadContents, 300) }
async function selectContent(item) { draft.value = await fetchAdminContent(item.id); activeSection.value = 'basic' }
async function createContent() {
  draft.value = await createAdminContent({ type: ['show', 'project'].includes(activeFilter.value) ? activeFilter.value : 'show', title: '', credits: [], assets: [] })
  contents.value.unshift(draft.value)
}
async function saveDraft() {
  clearTimeout(saveTimer)
  saveState.value = 'saving'
  try {
    const saved = await updateAdminContent(draft.value.id, draft.value)
    draft.value = saved
    saveState.value = 'saved'
    await loadContents()
    return true
  } catch (error) {
    saveState.value = 'failed'
    notice.value = error.message
    return false
  }
}
async function uploadAsset(input) {
  try {
    const asset = await uploadAdminContentAsset(draft.value.id, input)
    draft.value = { ...draft.value, assets: [...(draft.value.assets || []), asset] }
  } catch (error) { notice.value = error.message }
}
async function updateAsset({ asset, ...changes }) {
  const updated = await updateAdminContentAsset(draft.value.id, asset.id, { ...asset, ...changes })
  draft.value = { ...draft.value, assets: draft.value.assets.map(item => item.id === asset.id ? updated : item) }
}
async function deleteAsset(asset) {
  await deleteAdminContentAsset(draft.value.id, asset.id)
  draft.value = { ...draft.value, assets: draft.value.assets.filter(item => item.id !== asset.id) }
}
async function publish() {
  if (!await saveDraft()) return
  try { draft.value = await publishAdminContent(draft.value.id); notice.value = '콘텐츠를 공개했습니다.'; await loadContents() }
  catch (error) { notice.value = error.message; activeSection.value = error.fields?.poster ? 'images' : 'basic' }
}
async function unpublish() { draft.value = await unpublishAdminContent(draft.value.id); await loadContents() }
async function trash() {
  if (!window.confirm('이 콘텐츠를 30일 휴지통으로 이동할까요?')) return
  await trashAdminContent(draft.value.id); draft.value = null; await loadContents()
}
async function restore() { draft.value = await restoreAdminContent(draft.value.id); await loadContents() }
async function duplicate() {
  draft.value = await duplicateAdminContent(draft.value.id)
  contents.value.unshift(draft.value)
}
function preview() { window.open(`/manage/contents/${draft.value.id}/preview`, '_blank', 'noopener') }
function focusField(field) { activeSection.value = field === 'poster' ? 'images' : field === 'credits' || field === 'body' ? 'content' : 'basic' }
const statusLabel = status => ({ draft: '임시저장', published: '공개', unpublished: '비공개' }[status] || status)
</script>

<style scoped>
.admin-contents-page{display:grid;grid-template-columns:minmax(210px,.7fr) minmax(420px,1.5fr) minmax(210px,.65fr);min-height:100vh;font-family:'D2Coding',monospace}.admin-content-nav{padding:18px;border-right:1px solid #1c1c1c;background:#f6f6f6}.admin-content-nav header p,.admin-content-nav header h1{margin:0 0 5px}.admin-content-nav nav{display:flex;gap:10px;margin:16px 0}.new-button,.filters button,.content-row{width:100%;padding:10px;border:1px solid #1c1c1c;background:#fff;text-align:left}.filters{display:grid;grid-template-columns:repeat(3,1fr);margin:12px 0}.filters .active,.content-row.active{background:#1c1c1c;color:#fff}.admin-content-nav>input{box-sizing:border-box;width:100%;padding:10px;margin-bottom:10px}.content-row{display:grid;gap:4px;border-bottom:0}.empty-editor{padding:28px}.empty-panel{background:#f6f6f6;border-left:1px solid #1c1c1c}.notice{position:fixed;right:20px;bottom:20px;padding:12px;background:#1c1c1c;color:#fff}@media(max-width:960px){.admin-contents-page{grid-template-columns:220px 1fr}.publish-panel,.empty-panel{grid-column:1/-1;border-left:0;border-top:1px solid #1c1c1c}}@media(max-width:700px){.admin-contents-page{display:block}.admin-content-nav{border-right:0;border-bottom:1px solid #1c1c1c}}
</style>
