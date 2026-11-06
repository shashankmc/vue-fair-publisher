import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { PublishingAdapter } from '../src'
import { dataset, model, publication, refusal } from './testAdapter'
import { attestAll, button, choice, click, field, hasField, mountWizard, toPreview } from './wizardHelpers'

const published = publication({ doi: '10.5281/zenodo.999', record_url: 'https://zenodo.org/records/999' })

function publishButton(wrapper: Parameters<typeof button>[0]) {
  const found = button(wrapper, 'Publish')
  if (!found) throw new Error('no Publish button')
  return found
}

describe('PublishWizard: preview', () => {
  it('shows the files, the DataCite title, creators and license, and the card', async () => {
    const { wrapper } = await mountWizard()
    await toPreview(wrapper)

    const text = wrapper.text()
    expect(text).toContain('data.csv')
    expect(text).toContain('2 KB')
    expect(text).toContain('DATASET_CARD.md')
    expect(text).toContain('Dutch rent judgments')
    expect(text).toContain('Doe, Jane')
    expect(text).toContain('Creative Commons Attribution 4.0')
    expect(text).toContain('Approved text.')
    wrapper.unmount()
  })

  it('goes back to the details with everything kept', async () => {
    const { wrapper } = await mountWizard()
    await toPreview(wrapper)

    await click(wrapper, 'Back to the details')

    expect(field(wrapper, 'Name').element.value).toBe('Doe, Jane')
    expect(choice(wrapper, 'I have read this card').element.checked).toBe(true)
    wrapper.unmount()
  })

  it('stays on the details and shows the refusal when the preview is refused', async () => {
    const { wrapper } = await mountWizard({
      preview: vi.fn().mockRejectedValue(refusal('missing_fields', 'Some required fields are empty.', { missing: ['keywords', 'version'] })),
    })
    await toPreview(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toContain('Some required fields are empty.')
    expect(field(wrapper, 'Keywords').attributes('aria-invalid')).toBe('true')
    expect(field(wrapper, 'Version').attributes('aria-invalid')).toBe('true')
    expect(field(wrapper, 'Title').attributes('aria-invalid')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows a failed round trip at preview with its detail', async () => {
    const { wrapper } = await mountWizard({
      listArtefacts: vi.fn().mockResolvedValue([model()]),
      preview: vi.fn().mockRejectedValue(refusal('round_trip_failed', 'The exported Model does not predict what the platform Model does.', { detail: '3 of 40 holdout predictions differ' })),
    }, { kind: 'model', id: 'm-1' })
    await toPreview(wrapper)

    const alert = wrapper.find('[role="alert"]').text()
    expect(alert).toContain('The exported Model does not predict what the platform Model does.')
    expect(alert).toContain('3 of 40 holdout predictions differ')
    expect(alert).toContain('Publishing is refused')
    expect(button(wrapper, 'Publish')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('PublishWizard: attestation and publishing', () => {
  it('warns that a DOI cannot be withdrawn', async () => {
    const { wrapper } = await mountWizard()
    await toPreview(wrapper)

    expect(wrapper.text()).toContain('cannot be withdrawn')
    wrapper.unmount()
  })

  it('keeps Publish disabled until all three statements are confirmed', async () => {
    const { wrapper } = await mountWizard()
    await toPreview(wrapper)
    expect(publishButton(wrapper).attributes('disabled')).toBeDefined()

    await choice(wrapper, 'I may release it under').setValue(true)
    await choice(wrapper, 'I hold the rights').setValue(true)
    expect(publishButton(wrapper).attributes('disabled')).toBeDefined()

    await choice(wrapper, 'no personal data').setValue(true)
    expect(publishButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('names the chosen license in the license statement', async () => {
    const { wrapper } = await mountWizard()
    await toPreview(wrapper)

    expect(wrapper.findAll('label').find((l) => l.text().includes('I may release it under'))!.text()).toContain('Creative Commons Attribution 4.0')
    wrapper.unmount()
  })

  it('publishes with the attestation and shows the DOI and record link', async () => {
    const { adapter, wrapper } = await mountWizard({ publish: vi.fn().mockResolvedValue(published) })
    await toPreview(wrapper)
    await attestAll(wrapper)

    await click(wrapper, 'Publish')

    expect(adapter.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'dataset',
        id: 'ds-1',
        access: 'open',
        card: { text: '# Dataset card\n\nDrafted.', approved: true },
        attestation: { license: true, rights: true, personal_data: true },
      }),
    )
    expect(wrapper.text()).toContain('Published')
    expect(wrapper.find('a[href="https://doi.org/10.5281/zenodo.999"]').text()).toContain('10.5281/zenodo.999')
    expect(wrapper.find('a[href="https://zenodo.org/records/999"]').exists()).toBe(true)
    expect(wrapper.emitted('published')).toEqual([[published]])
    wrapper.unmount()
  })

  it('asks for the repository token before publishing when none is saved', async () => {
    const { adapter, wrapper } = await mountWizard({
      getTokenStatus: vi.fn().mockResolvedValue({ connected: false }),
      publish: vi.fn().mockResolvedValue(published),
    })
    await toPreview(wrapper)
    await attestAll(wrapper)

    expect(wrapper.text()).toContain('Zenodo token')
    expect(publishButton(wrapper).attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="password"]').setValue('zenodo-secret')
    await wrapper.find('.vfp-token form').trigger('submit')
    await flushPromises()

    expect(adapter.saveToken).toHaveBeenCalledWith('zenodo-secret')
    expect(publishButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('PublishWizard: refusals from publish', () => {
  async function refusedWith(
    error: Error,
    artefact = dataset(),
    props: Record<string, unknown> = { kind: 'dataset', id: 'ds-1' },
    overrides: Partial<PublishingAdapter> = {},
  ) {
    const mounted = await mountWizard(
      { listArtefacts: vi.fn().mockResolvedValue([artefact, dataset()]), publish: vi.fn().mockRejectedValue(error), ...overrides },
      props,
    )
    await toPreview(mounted.wrapper)
    await attestAll(mounted.wrapper)
    await click(mounted.wrapper, 'Publish')
    return mounted
  }

  it('token_required: shows the message and the token form', async () => {
    // Saved when the preview opened, gone by the time of publishing.
    const getTokenStatus = vi.fn().mockResolvedValueOnce({ connected: true }).mockResolvedValue({ connected: false })
    const { wrapper } = await refusedWith(refusal('token_required', 'Connect your Zenodo account first.'), dataset(), undefined, { getTokenStatus })

    expect(wrapper.find('[role="alert"]').text()).toContain('Connect your Zenodo account first.')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('round_trip_failed: shows the detail and that publishing is refused', async () => {
    const { wrapper } = await refusedWith(
      refusal('round_trip_failed', 'The exported Model does not predict what the platform Model does.', { detail: { mismatches: 3, total: 40 } }),
      model(),
      { kind: 'model', id: 'm-1' },
    )

    const alert = wrapper.find('[role="alert"]').text()
    expect(alert).toContain('The exported Model does not predict what the platform Model does.')
    expect(alert).toContain('"mismatches": 3')
    expect(alert).toContain('Publishing is refused')
    wrapper.unmount()
  })

  it('dataset_doi_required: names the Dataset and offers to switch to it', async () => {
    const { wrapper } = await refusedWith(
      refusal('dataset_doi_required', 'Publish the training Dataset first.', { training_dataset: { id: 'ds-1', title: 'Dutch rent judgments' } }),
      model({ training_dataset: null }),
      { kind: 'model', id: 'm-1' },
    )

    expect(wrapper.find('[role="alert"]').text()).toContain('Publish the training Dataset first.')
    expect(wrapper.find('[role="alert"]').text()).toContain('Dutch rent judgments')

    await click(wrapper, 'Publish the Dataset first')

    expect(wrapper.emitted('switch-artefact')).toEqual([[{ kind: 'dataset', id: 'ds-1' }]])
    expect(field(wrapper, 'Title').element.value).toBe('Dutch rent judgments')
    wrapper.unmount()
  })

  it('attestation_required: highlights the statements still missing', async () => {
    const { wrapper } = await refusedWith(refusal('attestation_required', 'Confirm all three statements.', { missing: ['personal_data'] }))

    expect(wrapper.find('[role="alert"]').text()).toContain('Confirm all three statements.')
    expect(choice(wrapper, 'no personal data').attributes('aria-invalid')).toBe('true')
    expect(choice(wrapper, 'I hold the rights').attributes('aria-invalid')).toBeUndefined()
    wrapper.unmount()
  })

  it('missing_fields: returns to the details with the fields highlighted', async () => {
    const { wrapper } = await refusedWith(refusal('missing_fields', 'Some required fields are empty.', { missing: ['description'] }))

    expect(hasField(wrapper, 'Description')).toBe(true)
    expect(field(wrapper, 'Description').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[role="alert"]').text()).toContain('Some required fields are empty.')
    wrapper.unmount()
  })

  it('repository_failed: shows the message and lets the user try again', async () => {
    const { adapter, wrapper } = await refusedWith(refusal('repository_failed', 'Zenodo did not answer. Try again in a few minutes.'))

    expect(wrapper.find('[role="alert"]').text()).toContain('Zenodo did not answer. Try again in a few minutes.')
    expect(publishButton(wrapper).attributes('disabled')).toBeUndefined()
    await click(wrapper, 'Publish')
    expect(adapter.publish).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('publishing_disabled: says publishing is turned off', async () => {
    const { wrapper } = await refusedWith(refusal('publishing_disabled', 'Publishing is off.'))

    expect(wrapper.text()).toContain('Publishing is turned off on this platform')
    expect(button(wrapper, 'Publish')).toBeUndefined()
    wrapper.unmount()
  })
})
