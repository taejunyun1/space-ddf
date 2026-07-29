<template>
  <section class="content-editor">
    <header>
      <p>현재 편집</p>
      <h1>{{ modelValue.title || '새 콘텐츠' }}</h1>
      <small>{{ modelValue.type }} · /{{ modelValue.type === 'project' ? 'projects' : 'shows' }}/{{ modelValue.slug }}</small>
    </header>

    <nav aria-label="콘텐츠 편집 섹션">
      <button v-for="item in sections" :key="item.id" type="button"
        :class="{ active: section === item.id }" @click="$emit('update:section', item.id)">
        {{ item.label }}
      </button>
    </nav>

    <div v-if="section === 'basic'" class="form-grid">
      <label>타입
        <select :value="modelValue.type" @change="set('type', $event.target.value)">
          <option value="show">Show</option><option value="project">Project</option>
        </select>
      </label>
      <label>Slug<input :value="modelValue.slug" @input="set('slug', $event.target.value)"></label>
      <label class="wide">제목<input :value="modelValue.title" @input="set('title', $event.target.value)"></label>
      <label>시작일<input type="date" :value="modelValue.startDate" @input="set('startDate', $event.target.value)"></label>
      <label>종료일<input type="date" :value="modelValue.endDate" @input="set('endDate', $event.target.value)"></label>
      <label class="wide">표시용 날짜<input :value="modelValue.dateDisplay" @input="set('dateDisplay', $event.target.value)"></label>
      <label class="wide">장소<input :value="modelValue.location" @input="set('location', $event.target.value)"></label>
      <label class="check"><input type="checkbox" :checked="modelValue.showOnHome" @change="set('showOnHome', $event.target.checked)"> 메인 목록에 표시</label>
      <label class="check"><input type="checkbox" :checked="modelValue.isFeatured" @change="set('isFeatured', $event.target.checked)"> Recent Updated 대표 콘텐츠</label>
    </div>

    <div v-else-if="section === 'content'" class="stack">
      <div class="section-head"><strong>크레딧</strong><button type="button" @click="addCredit">+ 추가</button></div>
      <div v-for="(credit, index) in modelValue.credits" :key="index" class="credit-row">
        <input :value="credit.label" placeholder="Artist" @input="setCredit(index, 'label', $event.target.value)">
        <input :value="credit.value" placeholder="이름" @input="setCredit(index, 'value', $event.target.value)">
        <button type="button" aria-label="크레딧 삭제" @click="removeCredit(index)">×</button>
      </div>
      <label>짧은 소개<textarea rows="5" :value="modelValue.body" @input="set('body', $event.target.value)"></textarea></label>
      <label>본문<textarea rows="14" :value="modelValue.description" @input="set('description', $event.target.value)"></textarea></label>
    </div>

    <div v-else class="stack">
      <label>대표 포스터<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" @change="upload($event, 'poster')"></label>
      <label>목록 프리뷰<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" @change="upload($event, 'preview')"></label>
      <label>갤러리 이미지<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" @change="upload($event, 'gallery')"></label>
      <div class="asset-grid">
        <figure v-for="asset in modelValue.assets" :key="asset.id">
          <img :src="asset.url" :alt="asset.altText || asset.role">
          <figcaption>{{ asset.role }} · {{ asset.uploadStatus }}</figcaption>
          <input :value="asset.altText" placeholder="대체문구" @change="$emit('update-asset', { asset, altText: $event.target.value })">
          <input :value="asset.caption" placeholder="캡션" @change="$emit('update-asset', { asset, caption: $event.target.value })">
          <button type="button" @click="$emit('delete-asset', asset)">이미지 삭제</button>
        </figure>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({ modelValue: { type: Object, required: true }, section: { type: String, default: 'basic' } })
const emit = defineEmits(['update:modelValue', 'update:section', 'upload', 'update-asset', 'delete-asset'])
const sections = [{ id: 'basic', label: '1. 기본 정보' }, { id: 'content', label: '2. 내용' }, { id: 'images', label: '3. 이미지' }]
const set = (key, value) => emit('update:modelValue', { ...props.modelValue, [key]: value })
function setCredit(index, key, value) {
  const credits = props.modelValue.credits.map((item, i) => i === index ? { ...item, [key]: value } : item)
  set('credits', credits)
}
const addCredit = () => set('credits', [...props.modelValue.credits, { label: '', value: '', url: '' }])
const removeCredit = index => set('credits', props.modelValue.credits.filter((_, i) => i !== index))
function upload(event, role) {
  for (const file of event.target.files || []) emit('upload', { file, role })
  event.target.value = ''
}
</script>

<style scoped>
.content-editor{padding:22px;min-width:0}.content-editor header p,.content-editor header h1{margin:0 0 5px}.content-editor nav{display:grid;grid-template-columns:repeat(3,1fr);margin:24px 0;border-bottom:1px solid #1c1c1c}.content-editor nav button{padding:12px;border:0;background:#fff}.content-editor nav .active{background:#1c1c1c;color:#fff}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.wide{grid-column:1/-1}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,select,textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #999;border-radius:0;font:inherit}.check{display:flex;align-items:center}.check input{width:auto}.stack{display:grid;gap:16px}.section-head,.credit-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.credit-row input{flex:1}.asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}.asset-grid figure{margin:0}.asset-grid img{width:100%;aspect-ratio:1;object-fit:cover}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
