import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { PublicationRegistry } from '../src'
import type { PublishingAdapter } from '../src'
import { callsBesidesConfig, config, createTestAdapter, publication } from './testAdapter'

const dataset = publication()
const restrictedModel = publication({
  id: 'pub-2',
  kind: 'model',
  artefact_id: 'm-1',
  title: 'Rent outcome classifier',
  doi: '10.5281/zenodo.222',
  record_url: 'https://zenodo.org/records/222',
  access: 'restricted',
  license: 'cc0-1.0',
  related_dataset_doi: '10.5281/zenodo.111',
  mine: false,
})
const metadataOnly = publication({ id: 'pub-3', title: 'Court letters', doi: '10.5281/zenodo.333', access: 'metadata_only', license: 'other-closed', mine: false })

async function mounted(overrides: Partial<PublishingAdapter> = {}, props = {}) {
  const adapter = createTestAdapter({
    listPublications: vi.fn().mockResolvedValue([dataset, restrictedModel, metadataOnly]),
    ...overrides,
  })
  const wrapper = mount(PublicationRegistry, { props: { adapter, ...props }, attachTo: document.body })
  await flushPromises()
  return { adapter, wrapper }
}

function items(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[aria-label="Publications"] > li')
}

describe('PublicationRegistry', () => {
  it('lists every publication with its DOI link and record link', async () => {
    const { adapter, wrapper } = await mounted()

    expect(adapter.listPublications).toHaveBeenCalledWith(undefined, undefined)
    expect(items(wrapper)).toHaveLength(3)
    const first = items(wrapper)[0]
    expect(first.text()).toContain('Dutch rent judgments')
    expect(first.find('a[href="https://doi.org/10.5281/zenodo.111"]').text()).toContain('10.5281/zenodo.111')
    expect(first.find('a[href="https://zenodo.org/records/111"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the kind, access level and license of each', async () => {
    const { wrapper } = await mounted()
    const [first, second, third] = items(wrapper)

    expect(first.text()).toContain('Dataset')
    expect(first.text()).toContain('Open')
    expect(first.text()).toContain('Creative Commons Attribution 4.0')
    expect(second.text()).toContain('Model')
    expect(second.text()).toContain('Restricted')
    expect(second.text()).toContain('CC0 1.0 Public Domain')
    expect(third.text()).toContain('Metadata only')
    expect(third.text()).toContain('other-closed')
    wrapper.unmount()
  })

  it("links a Model to its training Dataset's DOI", async () => {
    const { wrapper } = await mounted()

    expect(items(wrapper)[1].find('a[href="https://doi.org/10.5281/zenodo.111"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it("marks the user's own publications", async () => {
    const { wrapper } = await mounted()
    const [first, second] = items(wrapper)

    expect(first.text()).toContain('Yours')
    expect(second.text()).not.toContain('Yours')
    wrapper.unmount()
  })

  it('searches by text', async () => {
    const { adapter, wrapper } = await mounted()
    await wrapper.find('input[type="search"]').setValue('  rent  ')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(adapter.listPublications).toHaveBeenLastCalledWith('rent', undefined)
    wrapper.unmount()
  })

  it('filters by kind as soon as it changes, keeping the search text', async () => {
    const { adapter, wrapper } = await mounted()
    await wrapper.find('input[type="search"]').setValue('rent')

    await wrapper.find('select').setValue('model')
    await flushPromises()

    expect(adapter.listPublications).toHaveBeenLastCalledWith('rent', 'model')
    wrapper.unmount()
  })

  it('starts with the kind the host asks for', async () => {
    const { adapter, wrapper } = await mounted({}, { kind: 'dataset' })

    expect(adapter.listPublications).toHaveBeenCalledWith(undefined, 'dataset')
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('dataset')
    wrapper.unmount()
  })

  it('says when nothing has been published', async () => {
    const { wrapper } = await mounted({ listPublications: vi.fn().mockResolvedValue([]) })

    expect(wrapper.text()).toContain('Nothing has been published on this platform yet.')
    wrapper.unmount()
  })

  it('says when nothing matches a search', async () => {
    const listPublications = vi.fn().mockResolvedValueOnce([dataset]).mockResolvedValue([])
    const { wrapper } = await mounted({ listPublications })
    await wrapper.find('input[type="search"]').setValue('tax')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('No publications match')
    wrapper.unmount()
  })

  it('shows why the list could not load', async () => {
    const { wrapper } = await mounted({ listPublications: vi.fn().mockRejectedValue(new Error('The registry is not answering.')) })

    expect(wrapper.find('[role="alert"]').text()).toContain('The registry is not answering.')
    wrapper.unmount()
  })

  it('says publishing is turned off and calls nothing else', async () => {
    const { adapter, wrapper } = await mounted({ getConfig: vi.fn().mockResolvedValue(config({ enabled: false })) })

    expect(wrapper.text()).toContain('Publishing is turned off on this platform')
    expect(callsBesidesConfig(adapter)).toEqual([])
    wrapper.unmount()
  })
})
