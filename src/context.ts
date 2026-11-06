import { inject, onMounted, ref, shallowRef } from 'vue'
import type { PublishingAdapter, PublishingConfig } from './types'

/** Injection key under which the plugin (or a host) provides the adapter. */
export const ADAPTER_KEY = 'vfp:adapter'

export function useAdapter(fromProp: PublishingAdapter | undefined): PublishingAdapter {
  const adapter = fromProp ?? inject<PublishingAdapter | null>(ADAPTER_KEY, null)
  if (!adapter) {
    throw new Error(`vue-fair-publisher: pass an adapter prop, install VueFairPublisherPlugin, or provide one under "${ADAPTER_KEY}".`)
  }
  return adapter
}

export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  return e instanceof Error && e.message ? e.message : fallback
}

/** Loads the host config (unless one is passed in), then runs `onReady` only
 * when publishing is enabled, so a disabled platform is never called again. */
export function useConfig(
  adapter: PublishingAdapter,
  given: () => PublishingConfig | undefined,
  onReady: (config: PublishingConfig) => void | Promise<void>,
) {
  const config = shallowRef<PublishingConfig | null>(null)
  const loading = ref(true)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    try {
      config.value = given() ?? (await adapter.getConfig())
      if (config.value.enabled) await onReady(config.value)
    } catch (e) {
      error.value = errorMessage(e, 'The publishing settings could not be loaded. Try again.')
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { config, loading, error, reload: load }
}
