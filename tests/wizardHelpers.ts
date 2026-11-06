import { flushPromises, mount } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'
import { PublishWizard } from '../src'
import type { PublishingAdapter } from '../src'
import { createTestAdapter, dataset } from './testAdapter'

export type Wrapper = VueWrapper<any>

export const PREVIEW = {
  datacite: {
    titles: [{ title: 'Dutch rent judgments' }],
    creators: [{ name: 'Doe, Jane' }],
    rightsList: [{ rights: 'Creative Commons Attribution 4.0', rightsIdentifier: 'cc-by-4.0' }],
  },
  ro_crate: {},
  card: '# Dataset card\n\nApproved text.',
  files: [
    { name: 'data.csv', size: 2048 },
    { name: 'DATASET_CARD.md', size: 120 },
  ],
}

export async function mountWizard(overrides: Partial<PublishingAdapter> = {}, props: Record<string, unknown> = { kind: 'dataset', id: 'ds-1' }) {
  const adapter = createTestAdapter({
    listArtefacts: vi.fn().mockResolvedValue([dataset()]),
    preview: vi.fn().mockResolvedValue(PREVIEW),
    ...overrides,
  })
  const wrapper = mount(PublishWizard, { props: { adapter, ...props }, attachTo: document.body })
  await flushPromises()
  return { adapter, wrapper }
}

/** The form control labelled `text` (label text up to an optional "(required)"). */
export function field(wrapper: Wrapper, text: string): DOMWrapper<HTMLInputElement> {
  const label = wrapper.findAll('label').find((l) => l.text().replace(/\s*\(required\)\s*$/, '').trim() === text)
  if (!label) throw new Error(`no label "${text}"`)
  return wrapper.find<HTMLInputElement>(`[id="${label.attributes('for')}"]`)
}

export function hasField(wrapper: Wrapper, text: string) {
  return wrapper.findAll('label').some((l) => l.text().replace(/\s*\(required\)\s*$/, '').trim() === text)
}

export function labelOf(wrapper: Wrapper, text: string) {
  const label = wrapper.findAll('label').find((l) => l.text().replace(/\s*\(required\)\s*$/, '').trim() === text)
  if (!label) throw new Error(`no label "${text}"`)
  return label
}

/** The checkbox or radio inside the label whose text contains `text`. */
export function choice(wrapper: Wrapper, text: string): DOMWrapper<HTMLInputElement> {
  const label = wrapper.findAll('label').find((l) => l.text().includes(text))
  if (!label) throw new Error(`no choice "${text}"`)
  return label.find<HTMLInputElement>('input')
}

export function button(wrapper: Wrapper, text: string) {
  return wrapper.findAll('button').find((b) => b.text() === text)
}

export async function click(wrapper: Wrapper, text: string) {
  const found = button(wrapper, text)
  if (!found) throw new Error(`no button "${text}"`)
  await found.trigger('click')
  await flushPromises()
}

/** Fill everything the default config requires, draft and approve the card. */
export async function completeDetails(wrapper: Wrapper) {
  await field(wrapper, 'Name').setValue('Doe, Jane')
  await click(wrapper, 'Draft the card')
  await choice(wrapper, 'I have read this card').setValue(true)
}

/** Complete the details and go to the preview. */
export async function toPreview(wrapper: Wrapper) {
  await completeDetails(wrapper)
  await click(wrapper, 'Preview the deposit')
}

export async function attestAll(wrapper: Wrapper) {
  await choice(wrapper, 'I may release it under').setValue(true)
  await choice(wrapper, 'I hold the rights').setValue(true)
  await choice(wrapper, 'no personal data').setValue(true)
}
