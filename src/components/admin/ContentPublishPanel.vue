<template>
  <aside class="publish-panel">
    <p>공개 상태</p>
    <h2>{{ content.status === 'published' ? '공개' : content.status === 'unpublished' ? '비공개' : '임시저장' }}</h2>
    <small>{{ saveStateLabel }}</small>
    <button type="button" @click="$emit('preview')">미리보기</button>
    <button v-if="content.status !== 'published'" class="primary" type="button" @click="$emit('publish')">공개하기</button>
    <button v-else type="button" @click="$emit('unpublish')">비공개 전환</button>
    <div v-if="Object.keys(validation).length" class="validation">
      <strong>공개 전 확인</strong>
      <a v-for="(message, key) in validation" :key="key" href="#" @click.prevent="$emit('focus-field', key)">{{ message }}</a>
    </div>
    <hr>
    <button class="danger" type="button" @click="$emit('trash')">휴지통으로 이동</button>
  </aside>
</template>
<script setup>
defineProps({ content: { type: Object, required: true }, validation: { type: Object, default: () => ({}) }, saveStateLabel: { type: String, default: '저장됨' } })
defineEmits(['preview', 'publish', 'unpublish', 'trash', 'focus-field'])
</script>
<style scoped>
.publish-panel{padding:20px;background:#f3f3f3;border-left:1px solid #1c1c1c;display:flex;flex-direction:column;gap:10px}.publish-panel p,.publish-panel h2{margin:0}.publish-panel button{padding:11px;border:1px solid #1c1c1c;background:#fff}.publish-panel .primary{background:#1c1c1c;color:#fff}.publish-panel .danger{color:#a32820}.validation{display:grid;gap:7px;margin-top:12px}.validation a{color:#a32820;font-size:12px}
</style>

