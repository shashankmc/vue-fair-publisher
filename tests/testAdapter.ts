import { vi } from 'vitest'
import type { Artefact, Publication, PublishingAdapter, PublishingConfig, PublishingError } from '../src'

// Fixtures follow fair-publishing's docs/openapi.yaml.

export function config(overrides: Partial<PublishingConfig> = {}): PublishingConfig {
  return {
    enabled: true,
    repository: { id: 'zenodo', name: 'Zenodo', sandbox: false, token_url: 'https://zenodo.org/account/settings/applications/tokens/new/' },
    community: null,
    licenses: [
      { id: 'cc-by-4.0', title: 'Creative Commons Attribution 4.0' },
      { id: 'cc0-1.0', title: 'CC0 1.0 Public Domain' },
    ],
    required_fields: ['title', 'description', 'creators', 'license'],
    access_levels: ['open', 'restricted', 'metadata_only'],
    ...overrides,
  }
}

export function dataset(overrides: Partial<Artefact> = {}): Artefact {
  return {
    kind: 'dataset',
    id: 'ds-1',
    title: 'Dutch rent judgments',
    description: 'Rent tribunal decisions labelled by outcome.',
    task_type: 'classification',
    legal: { jurisdiction: 'NL', language: 'nl', document_type: 'judgment', ecli: null },
    training_dataset: null,
    publication: null,
    ...overrides,
  }
}

export function model(overrides: Partial<Artefact> = {}): Artefact {
  return {
    kind: 'model',
    id: 'm-1',
    title: 'Rent outcome classifier',
    description: 'Predicts the outcome of a rent case.',
    task_type: 'classification',
    legal: { jurisdiction: 'NL', language: 'nl', document_type: 'judgment', ecli: null },
    training_dataset: { id: 'ds-1', title: 'Dutch rent judgments', doi: '10.5281/zenodo.111' },
    publication: null,
    ...overrides,
  }
}

export function publication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'pub-1',
    kind: 'dataset',
    artefact_id: 'ds-1',
    title: 'Dutch rent judgments',
    doi: '10.5281/zenodo.111',
    record_url: 'https://zenodo.org/records/111',
    access: 'open',
    license: 'cc-by-4.0',
    related_dataset_doi: null,
    published_at: '2026-11-06T10:00:00Z',
    mine: true,
    ...overrides,
  }
}

/** A rejection the way createHttpAdapter builds it. */
export function refusal(code: string, message: string, extra: Record<string, unknown> = {}): PublishingError {
  return Object.assign(new Error(message), { code, ...extra }) as PublishingError
}

/** Every method is a vi.fn(); tests override what they need. */
export function createTestAdapter(overrides: Partial<PublishingAdapter> = {}): PublishingAdapter {
  return {
    getConfig: vi.fn().mockResolvedValue(config()),
    getTokenStatus: vi.fn().mockResolvedValue({ connected: true }),
    saveToken: vi.fn().mockResolvedValue({ connected: true }),
    deleteToken: vi.fn().mockResolvedValue(undefined),
    listArtefacts: vi.fn().mockResolvedValue([dataset()]),
    draftCard: vi.fn().mockResolvedValue({ card: '# Dataset card\n\nDrafted.', source: 'llm' }),
    preview: vi.fn(),
    publish: vi.fn(),
    listPublications: vi.fn().mockResolvedValue([]),
    getPublication: vi.fn(),
    ...overrides,
  }
}

/** Methods other than getConfig, for asserting nothing else was called. */
export function callsBesidesConfig(adapter: PublishingAdapter) {
  return (Object.keys(adapter) as (keyof PublishingAdapter)[])
    .filter((k) => k !== 'getConfig')
    .filter((k) => (adapter[k] as ReturnType<typeof vi.fn>).mock.calls.length > 0)
}
