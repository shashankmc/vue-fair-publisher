<template>
  <div class="vfp-alert vfp-alert-error" role="alert">
    <p>{{ refusal.message }}</p>

    <template v-if="refusal.code === 'round_trip_failed'">
      <pre v-if="detail" class="vfp-detail">{{ detail }}</pre>
      <p>
        Publishing is refused: the exported Model must give the same answers as the platform Model on the holdout, or others could not
        reuse it. Retrain the Model, or ask the platform team for help.
      </p>
    </template>

    <template v-else-if="refusal.code === 'dataset_doi_required'">
      <p v-if="refusal.training_dataset">
        This Model was trained on the Dataset “{{ refusal.training_dataset.title }}”. Publish that Dataset first, then come back to this Model.
      </p>
      <button
        v-if="refusal.training_dataset"
        type="button"
        class="vfp-btn vfp-btn-primary"
        @click="$emit('switch', refusal.training_dataset)"
      >
        Publish the Dataset first
      </button>
    </template>

    <p v-else-if="refusal.code === 'token_required'">Connect your token below, then publish again.</p>
    <p v-else-if="refusal.code === 'attestation_required'">Confirm the highlighted statements, then publish again.</p>
    <p v-else-if="refusal.code === 'already_published'">Find it in the list of publications on this platform.</p>
    <p v-else-if="refusal.missing?.length && refusal.code !== 'local_missing'">Fill in the highlighted fields, then preview again.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PublishingError } from '../types'

const props = defineProps<{ refusal: PublishingError }>()
defineEmits<{ switch: [dataset: { id: string; title: string }] }>()

const detail = computed(() => {
  const d = props.refusal.detail
  if (d === undefined || d === null || d === '') return ''
  return typeof d === 'string' ? d : JSON.stringify(d, null, 2)
})
</script>
