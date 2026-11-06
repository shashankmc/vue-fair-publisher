import type { AccessLevel, ArtefactKind, PublishingConfig } from './types'

export const KIND_LABEL: Record<ArtefactKind, string> = { dataset: 'Dataset', model: 'Model' }

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  open: 'Open',
  restricted: 'Restricted',
  metadata_only: 'Metadata only',
}

export const ACCESS_HINT: Record<AccessLevel, string> = {
  open: 'Anyone can download the files.',
  restricted: 'Anyone can see the description, but people must ask you for the files. You decide who gets them, under the conditions you write.',
  metadata_only: 'Only the description is published, with a DOI. No files are uploaded.',
}

export function licenseTitle(config: PublishingConfig | null, id: string): string {
  return config?.licenses.find((l) => l.id === id)?.title ?? id
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`
}
