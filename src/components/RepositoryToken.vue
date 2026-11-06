<template>
  <section class="vfp vfp-card vfp-token" :aria-labelledby="headingId">
    <p v-if="loading" class="vfp-muted" role="status">Loading…</p>
    <LoadError v-else-if="error" :message="error" @retry="reload" />
    <PublishingOff v-else-if="config && !config.enabled" />
    <template v-else-if="config">
      <div class="vfp-row">
        <h3 :id="headingId" class="vfp-heading">{{ config.repository.name }} token</h3>
        <span v-if="config.repository.sandbox" class="vfp-badge vfp-badge-warning">Sandbox</span>
        <span class="vfp-badge" :class="connected ? 'vfp-badge-success' : 'vfp-badge-muted'">
          {{ connected ? 'Connected' : 'Not connected' }}
        </span>
      </div>
      <p v-if="config.repository.sandbox" class="vfp-muted">
        This is a test repository. Records published here are not real and their DOIs do not resolve.
      </p>

      <template v-if="connected">
        <p class="vfp-muted">
          Your personal {{ config.repository.name }} token is saved. Publications go to your own {{ config.repository.name }} account.
        </p>
        <button type="button" class="vfp-btn vfp-btn-secondary" :disabled="busy" @click="disconnect">Disconnect</button>
      </template>

      <form v-else class="vfp-form" novalidate @submit.prevent="connect">
        <p class="vfp-muted">
          Publications go to your own {{ config.repository.name }} account, so this platform needs a personal token.
          <a :href="config.repository.token_url" target="_blank" rel="noopener noreferrer">Create a token on {{ config.repository.name }}</a>
          with the deposit scopes, then paste it here. It is saved for you only and never shown again.
        </p>
        <div class="vfp-field">
          <label :for="inputId">Personal {{ config.repository.name }} token</label>
          <input
            :id="inputId"
            ref="tokenInput"
            type="password"
            class="vfp-input"
            autocomplete="off"
            spellcheck="false"
            :aria-describedby="formError ? errorId : undefined"
            :aria-invalid="formError ? 'true' : undefined"
          />
        </div>
        <button type="submit" class="vfp-btn vfp-btn-primary" :disabled="busy">Connect</button>
      </form>

      <p v-if="formError" :id="errorId" class="vfp-alert vfp-alert-error" role="alert">{{ formError }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { errorMessage, useAdapter, useConfig } from '../context'
import type { PublishingAdapter, PublishingConfig } from '../types'
import LoadError from './LoadError.vue'
import PublishingOff from './PublishingOff.vue'

const props = defineProps<{
  adapter?: PublishingAdapter
  /** The host config, if the parent already has it; otherwise it is fetched. */
  config?: PublishingConfig
}>()

const emit = defineEmits<{
  /** The token was saved (true) or forgotten (false). */
  change: [connected: boolean]
}>()

const adapter = useAdapter(props.adapter)
const uid = Math.random().toString(36).slice(2, 8)
const headingId = `vfp-token-${uid}`
const inputId = `vfp-token-input-${uid}`
const errorId = `vfp-token-error-${uid}`

const connected = ref(false)
const busy = ref(false)
const formError = ref('')
// The token is read from the field only when submitting and is never kept in
// component state; the field is emptied once the request is done.
const tokenInput = ref<HTMLInputElement | null>(null)

const { config, loading, error, reload } = useConfig(
  adapter,
  () => props.config,
  async () => {
    connected.value = (await adapter.getTokenStatus()).connected
  },
)

async function connect() {
  const field = tokenInput.value
  if (!field) return
  formError.value = ''
  if (!field.value.trim()) {
    formError.value = 'Paste your token first.'
    field.focus()
    return
  }
  busy.value = true
  try {
    connected.value = (await adapter.saveToken(field.value.trim())).connected
    emit('change', connected.value)
  } catch (e) {
    formError.value = `${errorMessage(e)} Check the token and paste it again.`
  } finally {
    field.value = ''
    busy.value = false
  }
}

async function disconnect() {
  formError.value = ''
  busy.value = true
  try {
    await adapter.deleteToken()
    connected.value = false
    emit('change', false)
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
