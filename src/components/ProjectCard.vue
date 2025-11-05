<template>
  <router-link class="block group" :to="`/projects/${item.slug}`">
    <figure class="overflow-hidden">
      <img :src="item.thumb" :alt="item.title" class="w-full object-cover transition group-hover:scale-[1.02]" />
    </figure>
    <div class="mt-2">
      <h3 class="text-lg font-semibold">{{ item.title }}</h3>
      <p class="text-sm text-gray-500">{{ item.dateRange }}</p>
      <p class="text-sm mt-1 line-clamp-2">{{ item.summary }}</p>
    </div>
  </router-link>
</template>

<script setup>
defineProps({ item: { type: Object, required: true } })
</script>
