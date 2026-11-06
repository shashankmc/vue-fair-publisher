<template>
  <div class="vfp-alert vfp-alert-error" role="alert">
    <p>{{ refusal.message }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { PublishingError } from '../types'

defineProps<{ refusal: PublishingError }>()
</script>
