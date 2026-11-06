<template>
  <div class="vfp-alert vfp-alert-error" role="alert">
    <p>{{ message }}</p>
    <button type="button" class="vfp-btn vfp-btn-secondary" @click="$emit('retry')">Try again</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>
