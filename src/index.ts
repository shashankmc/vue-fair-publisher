import type { App } from 'vue'
import './styles/tokens.css'
import './styles/components.css'
import { createHttpAdapter } from './adapters/http'
import type { HttpAdapterOptions } from './adapters/http'
import PublishWizard from './components/PublishWizard.vue'
import PublicationRegistry from './components/PublicationRegistry.vue'
import RepositoryToken from './components/RepositoryToken.vue'
import { ADAPTER_KEY } from './context'
import type { PublishingAdapter } from './types'

export interface VueFairPublisherOptions {
  /** An adapter, or the options for createHttpAdapter. */
  adapter: PublishingAdapter | HttpAdapterOptions
}

/** Provides the adapter under `vfp:adapter` and registers every component globally. */
export const VueFairPublisherPlugin = {
  install(app: App, opts: VueFairPublisherOptions) {
    const adapter = 'baseUrl' in opts.adapter ? createHttpAdapter(opts.adapter) : opts.adapter
    app.provide(ADAPTER_KEY, adapter)
    app.component('RepositoryToken', RepositoryToken)
    app.component('PublicationRegistry', PublicationRegistry)
    app.component('PublishWizard', PublishWizard)
  },
}

export default VueFairPublisherPlugin

export { ADAPTER_KEY, PublicationRegistry, PublishWizard, RepositoryToken, createHttpAdapter }
export type { HttpAdapterOptions }
export * from './types'
