<template>
  <section class="vfp vfp-card vfp-registry" :aria-labelledby="headingId">
    <h3 :id="headingId" class="vfp-heading">Published on this platform</h3>
    <p v-if="loading" class="vfp-muted" role="status">Loading…</p>
    <LoadError v-else-if="error" :message="error" @retry="reload" />
    <PublishingOff v-else-if="config && !config.enabled" />
    <template v-else-if="config">
      <form class="vfp-filters" role="search" @submit.prevent="search">
        <div class="vfp-field">
          <label :for="`${headingId}-q`">Search</label>
          <input
            :id="`${headingId}-q`"
            v-model="q"
            type="search"
            class="vfp-input"
            placeholder="Title, description or keyword"
          />
        </div>
        <div class="vfp-field">
          <label :for="`${headingId}-kind`">Show</label>
          <select :id="`${headingId}-kind`" v-model="kind" class="vfp-input" @change="search">
            <option value="">Datasets and Models</option>
            <option value="dataset">Datasets</option>
            <option value="model">Models</option>
          </select>
        </div>
        <button type="submit" class="vfp-btn vfp-btn-primary">Search</button>
      </form>

      <p v-if="listError" class="vfp-alert vfp-alert-error" role="alert">{{ listError }}</p>
      <p v-else-if="searching" class="vfp-muted" role="status">Searching…</p>
      <p v-else-if="!publications.length" class="vfp-muted">
        {{ filtered ? 'No publications match. Try other words or show Datasets and Models.' : 'Nothing has been published on this platform yet.' }}
      </p>
      <ul v-else class="vfp-list" aria-label="Publications">
        <li v-for="p in publications" :key="p.id" class="vfp-list-item">
          <div class="vfp-row">
            <strong>{{ p.title }}</strong>
            <span class="vfp-badge">{{ KIND_LABEL[p.kind] }}</span>
            <span v-if="p.mine" class="vfp-badge vfp-badge-accent">Yours</span>
          </div>
          <p class="vfp-muted">
            DOI <a :href="doiUrl(p.doi)" target="_blank" rel="noopener noreferrer">{{ p.doi }}</a>
            · <a :href="p.record_url" target="_blank" rel="noopener noreferrer">View the record</a>
          </p>
          <p class="vfp-muted">
            {{ ACCESS_LABEL[p.access] ?? p.access }} · {{ licenseTitle(config, p.license) }}
            <template v-if="p.published_at"> · Published {{ formatDate(p.published_at) }}</template>
          </p>
          <p v-if="p.related_dataset_doi" class="vfp-muted">
            Trained on Dataset <a :href="doiUrl(p.related_dataset_doi)" target="_blank" rel="noopener noreferrer">{{ p.related_dataset_doi }}</a>
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { errorMessage, useAdapter, useConfig } from '../context'
import { ACCESS_LABEL, KIND_LABEL, doiUrl, licenseTitle } from '../labels'
import type { ArtefactKind, Publication, PublishingAdapter, PublishingConfig } from '../types'
import LoadError from './LoadError.vue'
import PublishingOff from './PublishingOff.vue'

const props = defineProps<{
  adapter?: PublishingAdapter
  /** The host config, if the parent already has it; otherwise it is fetched. */
  config?: PublishingConfig
  /** Start filtered to one kind. */
  kind?: ArtefactKind
}>()

const adapter = useAdapter(props.adapter)
const headingId = `vfp-registry-${Math.random().toString(36).slice(2, 8)}`

const q = ref('')
const kind = ref<ArtefactKind | ''>(props.kind ?? '')
const publications = ref<Publication[]>([])
const searching = ref(false)
const filtered = ref(false)
const listError = ref('')

async function fetchList() {
  const text = q.value.trim() || undefined
  const k = kind.value || undefined
  searching.value = true
  listError.value = ''
  try {
    publications.value = await adapter.listPublications(text, k)
    filtered.value = Boolean(text || k)
  } catch (e) {
    listError.value = errorMessage(e, 'The publications could not be loaded. Try again.')
  } finally {
    searching.value = false
  }
}

const { config, loading, error, reload } = useConfig(adapter, () => props.config, fetchList)

function search() {
  void fetchList()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}
</script>
