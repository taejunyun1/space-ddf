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
      <fieldset class="content-type-field">
        <legend>콘텐츠 유형</legend>
        <div class="content-type-options">
          <label :class="{ active: modelValue.type === 'show' }">
            <input type="radio" value="show" name="content-type" :checked="modelValue.type === 'show'" @change="set('type', 'show')">
            Show
          </label>
          <label :class="{ active: modelValue.type === 'project' }">
            <input type="radio" value="project" name="content-type" :checked="modelValue.type === 'project'" @change="set('type', 'project')">
            Project
          </label>
        </div>
      </fieldset>
      <label>Slug<input :value="modelValue.slug" @compositionstart="startTextComposition" @compositionend="finishInput('slug', $event)" @input="setFromInput('slug', $event)"></label>
      <label class="wide">제목<input :value="modelValue.title" @compositionstart="startTextComposition" @compositionend="finishInput('title', $event)" @input="setFromInput('title', $event)"></label>
      <label>시작일<input type="date" :value="modelValue.startDate" @input="set('startDate', $event.target.value)"></label>
      <label>종료일<input type="date" :value="modelValue.endDate" @input="set('endDate', $event.target.value)"></label>
      <label class="wide">표시용 날짜<input :value="modelValue.dateDisplay" @compositionstart="startTextComposition" @compositionend="finishInput('dateDisplay', $event)" @input="setFromInput('dateDisplay', $event)"></label>
      <label class="wide">장소<input :value="modelValue.location" @compositionstart="startTextComposition" @compositionend="finishInput('location', $event)" @input="setFromInput('location', $event)"></label>

      <section class="structured-credit-fields wide" aria-labelledby="basic-info-heading">
        <div class="section-head">
          <strong id="basic-info-heading">기본 정보</strong>
        </div>
        <div v-for="group in standardCreditGroups" :key="group.label" class="credit-group">
          <div class="credit-group-head">
            <strong>{{ group.label }}</strong>
            <button type="button" :aria-label="`${group.label} 항목 추가`" @click="addStandardCredit(group.label)">+ 추가</button>
          </div>
          <div v-for="(row, rowIndex) in group.rows" :key="`${group.label}-${row.sourceIndex}-${rowIndex}`" class="credit-row">
            <input
              :value="row.value"
              :aria-label="`${group.label} 이름 또는 내용`"
              placeholder="이름 또는 내용"
              @compositionstart="startTextComposition"
              @compositionend="finishStandardCreditInput(group.label, row.sourceIndex, 'value', $event)"
              @input="setStandardCreditFromInput(group.label, row.sourceIndex, 'value', $event)"
            >
            <input
              :value="row.url"
              :aria-label="`${group.label} Instagram 또는 URL`"
              placeholder="Instagram 또는 URL (선택)"
              @compositionstart="startTextComposition"
              @compositionend="finishStandardCreditInput(group.label, row.sourceIndex, 'url', $event)"
              @input="setStandardCreditFromInput(group.label, row.sourceIndex, 'url', $event)"
            >
            <button v-if="row.sourceIndex >= 0" type="button" :aria-label="`${group.label} 항목 삭제`" @click="removeCredit(row.sourceIndex)">×</button>
          </div>
        </div>

        <div class="custom-credit-section">
          <div class="credit-group-head">
            <strong>기타 정보</strong>
            <button type="button" @click="addCustomCredit">기타 정보 추가</button>
          </div>
          <div v-for="row in customCreditRows" :key="`custom-${row.sourceIndex}`" class="credit-row custom-credit-row">
            <input :value="row.label" aria-label="기타 정보 라벨" placeholder="Homepage" @compositionstart="startTextComposition" @compositionend="finishCreditInput(row.sourceIndex, 'label', $event)" @input="setCreditFromInput(row.sourceIndex, 'label', $event)">
            <input :value="row.value" aria-label="기타 정보 내용" placeholder="내용" @compositionstart="startTextComposition" @compositionend="finishCreditInput(row.sourceIndex, 'value', $event)" @input="setCreditFromInput(row.sourceIndex, 'value', $event)">
            <input :value="row.url" aria-label="기타 정보 URL" placeholder="URL (선택)" @compositionstart="startTextComposition" @compositionend="finishCreditInput(row.sourceIndex, 'url', $event)" @input="setCreditFromInput(row.sourceIndex, 'url', $event)">
            <button type="button" aria-label="기타 정보 삭제" @click="removeCredit(row.sourceIndex)">×</button>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="section === 'content'" class="stack">
      <label>짧은 소개<textarea rows="5" :value="modelValue.body" @compositionstart="startTextComposition" @compositionend="finishInput('body', $event)" @input="setFromInput('body', $event)"></textarea></label>
      <label>본문<textarea rows="14" :value="modelValue.description" @compositionstart="startTextComposition" @compositionend="finishInput('description', $event)" @input="setFromInput('description', $event)"></textarea></label>
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
import { computed } from 'vue'
import { finishTextComposition, startTextComposition, updateTextInput } from '@/lib/text-input'
import { normalizeCreditLabel, STANDARD_CREDIT_LABELS } from '@/lib/credit-links.js'

const props = defineProps({ modelValue: { type: Object, required: true }, section: { type: String, default: 'basic' } })
const emit = defineEmits(['update:modelValue', 'update:section', 'upload', 'update-asset', 'delete-asset'])
const sections = [{ id: 'basic', label: '1. 기본 정보' }, { id: 'content', label: '2. 내용' }, { id: 'images', label: '3. 이미지' }]
const set = (key, value) => {
  if (props.modelValue[key] === value) return
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const setFromInput = (key, event) => updateTextInput(event, value => set(key, value))
const finishInput = (key, event) => finishTextComposition(event, value => set(key, value))
const creditRecords = computed(() => Array.isArray(props.modelValue.credits) ? props.modelValue.credits : [])
const standardCreditGroups = computed(() => STANDARD_CREDIT_LABELS.map(label => {
  const rows = creditRecords.value
    .map((credit, sourceIndex) => ({ ...credit, sourceIndex }))
    .filter(credit => normalizeCreditLabel(credit.label) === label)

  return {
    label,
    rows: rows.length ? rows : [{ label, value: '', url: '', sourceIndex: -1 }],
  }
}))
const customCreditRows = computed(() => creditRecords.value
  .map((credit, sourceIndex) => ({ ...credit, sourceIndex }))
  .filter(credit => !STANDARD_CREDIT_LABELS.includes(normalizeCreditLabel(credit.label))))

function setCredit(index, key, value) {
  if (creditRecords.value[index]?.[key] === value) return
  const credits = creditRecords.value.map((item, i) => i === index ? { ...item, [key]: value } : item)
  set('credits', credits)
}
const setCreditFromInput = (index, key, event) => updateTextInput(event, value => setCredit(index, key, value))
const finishCreditInput = (index, key, event) => finishTextComposition(event, value => setCredit(index, key, value))
function setStandardCredit(label, sourceIndex, key, value) {
  if (sourceIndex >= 0) {
    setCredit(sourceIndex, key, value)
    return
  }

  set('credits', [...creditRecords.value, { label, value: key === 'value' ? value : '', url: key === 'url' ? value : '' }])
}
const setStandardCreditFromInput = (label, sourceIndex, key, event) => updateTextInput(event, value => setStandardCredit(label, sourceIndex, key, value))
const finishStandardCreditInput = (label, sourceIndex, key, event) => finishTextComposition(event, value => setStandardCredit(label, sourceIndex, key, value))
const addStandardCredit = label => set('credits', [...creditRecords.value, { label, value: '', url: '' }])
const addCustomCredit = () => set('credits', [...creditRecords.value, { label: '', value: '', url: '' }])
const removeCredit = index => set('credits', creditRecords.value.filter((_, i) => i !== index))
function upload(event, role) {
  for (const file of event.target.files || []) emit('upload', { file, role })
  event.target.value = ''
}
</script>

<style scoped>
.content-editor{padding:22px;min-width:0}.content-editor header p,.content-editor header h1{margin:0 0 5px}.content-editor nav{display:grid;grid-template-columns:repeat(3,1fr);margin:24px 0;border-bottom:1px solid #1c1c1c}.content-editor nav button{padding:12px;border:0;background:#fff}.content-editor nav .active{background:#1c1c1c;color:#fff}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.wide,.content-type-field{grid-column:1/-1}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,select,textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #999;border-radius:0;font:inherit}.content-type-field{margin:0;padding:0;border:0}.content-type-field legend{margin-bottom:6px;font-size:13px;font-weight:700}.content-type-options{display:grid;grid-template-columns:1fr 1fr}.content-type-options label{display:flex;align-items:center;justify-content:center;padding:11px;border:1px solid #1c1c1c;cursor:pointer}.content-type-options label+label{border-left:0}.content-type-options label.active{background:#1c1c1c;color:#fff}.content-type-options input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.stack{display:grid;gap:16px}.structured-credit-fields{display:grid;gap:14px;margin-top:8px;padding-top:18px;border-top:1px solid #1c1c1c}.credit-group{display:grid;gap:7px}.credit-group-head,.section-head,.credit-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.credit-group-head strong{min-width:78px;font-size:13px}.credit-group-head button,.credit-row button{flex:0 0 auto;padding:8px;border:1px solid #999;background:#fff}.credit-row input{flex:1;min-width:0}.custom-credit-section{display:grid;gap:7px;padding-top:14px;border-top:1px solid #ccc}.custom-credit-row{display:grid;grid-template-columns:.7fr 1fr 1fr auto}.asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}.asset-grid figure{margin:0}.asset-grid img{width:100%;aspect-ratio:1;object-fit:cover}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.wide,.content-type-field{grid-column:auto}.credit-row,.custom-credit-row{display:grid;grid-template-columns:1fr auto}.credit-row input{grid-column:1/-1}.credit-row button{grid-column:2}.structured-credit-fields{grid-column:auto}}
</style>
