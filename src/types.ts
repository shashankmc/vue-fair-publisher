// Types mirroring fair-publishing's HTTP API (docs/openapi.yaml, mounted under
// /api/publishing). Field names follow the wire format.

export type ArtefactKind = 'dataset' | 'model'
export type AccessLevel = 'open' | 'restricted' | 'metadata_only'

/** Metadata fields a host may require (`config.required_fields`). */
export type MetadataField =
  | 'title'
  | 'description'
  | 'creators'
  | 'keywords'
  | 'license'
  | 'language'
  | 'jurisdiction'
  | 'document_type'
  | 'version'

export interface RepositoryInfo {
  /** e.g. "zenodo" */
  id: string
  name: string
  sandbox: boolean
  /** Where the user creates a personal token. */
  token_url: string
}

export interface License {
  /** e.g. "cc-by-4.0" */
  id: string
  title: string
}

export interface PublishingConfig {
  /** The host's feature gate for this user. When false every other route answers 403 publishing_disabled. */
  enabled: boolean
  repository: RepositoryInfo
  community: string | null
  licenses: License[]
  required_fields: MetadataField[]
  access_levels: AccessLevel[]
}

export interface TokenStatus {
  connected: boolean
}

export interface ArtefactRef {
  kind: ArtefactKind
  id: string
}

export interface LegalFields {
  jurisdiction: string | null
  language: string | null
  document_type: string | null
  ecli: string | null
}

export interface TrainingDatasetRef {
  id: string
  title: string
  doi: string | null
}

export interface Artefact {
  kind: ArtefactKind
  id: string
  title: string
  description: string
  task_type: string | null
  legal: LegalFields
  /** Models only. */
  training_dataset: TrainingDatasetRef | null
  publication: Publication | null
}

export interface Creator {
  /** "Family, Given" */
  name: string
  affiliation?: string
  orcid?: string
}

export interface PublishMetadata {
  title?: string
  description?: string
  creators?: Creator[]
  keywords?: string[]
  /** One of config.licenses[].id */
  license?: string
  language?: string
  jurisdiction?: string
  document_type?: string
  ecli?: string
  version?: string
}

export interface Attestation {
  /** The user may release it under the chosen license. */
  license: boolean
  /** The user holds the rights to the content. */
  rights: boolean
  /** It contains no personal data that may not be published. */
  personal_data: boolean
}

export interface PublishRequest {
  kind: ArtefactKind
  id: string
  metadata: PublishMetadata
  access: AccessLevel
  /** Required for restricted. */
  access_conditions?: string
  card: { text: string; approved: boolean }
  attestation: Attestation
}

export interface CardDraft {
  card: string
  source: 'llm' | 'template'
}

export interface PreviewFile {
  name: string
  size: number
}

export interface Preview {
  /** DataCite metadata (attributes). */
  datacite: Record<string, unknown>
  /** ro-crate-metadata.json */
  ro_crate: Record<string, unknown>
  card: string
  files: PreviewFile[]
}

export interface Publication {
  id: string
  kind: ArtefactKind
  artefact_id: string
  title: string
  doi: string
  record_url: string
  access: AccessLevel
  license: string
  related_dataset_doi: string | null
  published_at: string
  mine: boolean
}

/** Every refusal code the contract names. Unknown codes are still shown by their message. */
export type PublishingErrorCode =
  | 'publishing_disabled'
  | 'token_missing'
  | 'token_required'
  | 'attestation_required'
  | 'missing_fields'
  | 'invalid_license'
  | 'invalid_access'
  | 'access_conditions_required'
  | 'card_not_approved'
  | 'dataset_doi_required'
  | 'already_published'
  | 'round_trip_failed'
  | 'repository_failed'

/** What an adapter method rejects with: the backend's message, its code and
 * any extra fields it sent (`missing`, `training_dataset`, `detail`, ...). */
export interface PublishingError extends Error {
  /** HTTP status, when the error came from the backend. */
  status?: number
  code?: PublishingErrorCode | string
  /** attestation_required / missing_fields: the attestation keys or metadata fields. */
  missing?: string[]
  /** dataset_doi_required: the Dataset to publish first. */
  training_dataset?: { id: string; title: string }
  /** round_trip_failed: what did not match. */
  detail?: unknown
  [extra: string]: unknown
}

/** One method per route of the publishing API. Each rejects with a `PublishingError`. */
export interface PublishingAdapter {
  getConfig(): Promise<PublishingConfig>
  getTokenStatus(): Promise<TokenStatus>
  /** Write-only: the token is never returned. */
  saveToken(token: string): Promise<TokenStatus>
  deleteToken(): Promise<void>
  listArtefacts(): Promise<Artefact[]>
  draftCard(ref: ArtefactRef): Promise<CardDraft>
  preview(request: PublishRequest): Promise<Preview>
  publish(request: PublishRequest): Promise<Publication>
  listPublications(q?: string, kind?: ArtefactKind): Promise<Publication[]>
  getPublication(id: string): Promise<Publication>
}
