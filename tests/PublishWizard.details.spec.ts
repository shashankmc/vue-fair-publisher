import { describe, expect, it, vi } from 'vitest'
import { callsBesidesConfig, config, dataset, model, publication } from './testAdapter'
import { button, click, field, hasField, labelOf, mountWizard } from './wizardHelpers'

describe('PublishWizard: what to publish', () => {
  it('opens the artefact named by kind and id, prefilled from it', async () => {
    const { adapter, wrapper } = await mountWizard()

    expect(adapter.listArtefacts).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Publish the Dataset')
    expect(field(wrapper, 'Title').element.value).toBe('Dutch rent judgments')
    expect(field(wrapper, 'Description').element.value).toBe('Rent tribunal decisions labelled by outcome.')
    expect(field(wrapper, 'Jurisdiction').element.value).toBe('NL')
    expect(field(wrapper, 'Language').element.value).toBe('nl')
    expect(field(wrapper, 'Document type').element.value).toBe('judgment')
    wrapper.unmount()
  })

  it('prefills the ECLI when the artefact has one', async () => {
    const withEcli = dataset({ legal: { jurisdiction: 'NL', language: 'nl', document_type: 'judgment', ecli: 'ECLI:NL:HR:2020:1' } })
    const { wrapper } = await mountWizard({ listArtefacts: vi.fn().mockResolvedValue([withEcli]) })

    expect(field(wrapper, 'ECLI').element.value).toBe('ECLI:NL:HR:2020:1')
    wrapper.unmount()
  })

  it('lets the user pick from what they can publish when no artefact is named', async () => {
    const { wrapper } = await mountWizard({ listArtefacts: vi.fn().mockResolvedValue([dataset(), model()]) }, {})

    expect(hasField(wrapper, 'Title')).toBe(false)
    await field(wrapper, 'What do you want to publish?').setValue('model:m-1')
    await click(wrapper, 'Continue')

    expect(wrapper.text()).toContain('Publish the Model')
    expect(field(wrapper, 'Title').element.value).toBe('Rent outcome classifier')
    wrapper.unmount()
  })

  it('says when there is nothing to publish', async () => {
    const { wrapper } = await mountWizard({ listArtefacts: vi.fn().mockResolvedValue([]) }, {})

    expect(wrapper.text()).toContain('You have no Datasets or Models to publish yet.')
    wrapper.unmount()
  })

  it('says when the named artefact is not among those the user can publish', async () => {
    const { wrapper } = await mountWizard({}, { kind: 'model', id: 'nope' })

    expect(wrapper.find('[role="alert"]').text()).toContain('This Model could not be found')
    wrapper.unmount()
  })

  it('shows the DOI instead of the form when the artefact is already published', async () => {
    const published = dataset({ publication: publication() })
    const { wrapper } = await mountWizard({ listArtefacts: vi.fn().mockResolvedValue([published]) })

    expect(wrapper.text()).toContain('already published')
    expect(wrapper.find('a[href="https://doi.org/10.5281/zenodo.111"]').exists()).toBe(true)
    expect(hasField(wrapper, 'Title')).toBe(false)
    wrapper.unmount()
  })

  it('says publishing is turned off and calls nothing else', async () => {
    const { adapter, wrapper } = await mountWizard({ getConfig: vi.fn().mockResolvedValue(config({ enabled: false })) })

    expect(wrapper.text()).toContain('Publishing is turned off on this platform')
    expect(callsBesidesConfig(adapter)).toEqual([])
    wrapper.unmount()
  })
})

describe('PublishWizard: metadata form', () => {
  it('marks the fields the host requires', async () => {
    const { wrapper } = await mountWizard({
      getConfig: vi.fn().mockResolvedValue(config({ required_fields: ['title', 'keywords', 'version'] })),
    })

    expect(labelOf(wrapper, 'Title').text()).toContain('(required)')
    expect(labelOf(wrapper, 'Keywords').text()).toContain('(required)')
    expect(labelOf(wrapper, 'Version').text()).toContain('(required)')
    expect(field(wrapper, 'Version').attributes('aria-required')).toBe('true')
    expect(labelOf(wrapper, 'Description').text()).not.toContain('(required)')
    expect(labelOf(wrapper, 'License').text()).not.toContain('(required)')
    wrapper.unmount()
  })

  it("offers only the host's licenses", async () => {
    const { wrapper } = await mountWizard()
    const options = field(wrapper, 'License').findAll('option').filter((o) => o.attributes('value'))

    expect(options.map((o) => [o.attributes('value'), o.text()])).toEqual([
      ['cc-by-4.0', 'Creative Commons Attribution 4.0'],
      ['cc0-1.0', 'CC0 1.0 Public Domain'],
    ])
    wrapper.unmount()
  })

  it('does not preview before the required fields are filled, and says which are missing', async () => {
    const { adapter, wrapper } = await mountWizard()
    await field(wrapper, 'Title').setValue('')

    await click(wrapper, 'Preview the deposit')

    expect(adapter.preview).not.toHaveBeenCalled()
    expect(field(wrapper, 'Title').attributes('aria-invalid')).toBe('true')
    expect(field(wrapper, 'Name').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[role="alert"]').text()).toContain('Fill in')
    wrapper.unmount()
  })

  it('has no Publish button before the preview', async () => {
    const { wrapper } = await mountWizard()

    expect(button(wrapper, 'Publish')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('PublishWizard: a Model needs a published training Dataset', () => {
  const unpublishedTraining = model({ training_dataset: { id: 'ds-1', title: 'Dutch rent judgments', doi: null } })

  it('explains that the Dataset must be published first and offers to switch to it', async () => {
    const { adapter, wrapper } = await mountWizard(
      { listArtefacts: vi.fn().mockResolvedValue([unpublishedTraining, dataset()]) },
      { kind: 'model', id: 'm-1' },
    )

    expect(wrapper.text()).toContain('Dutch rent judgments')
    expect(wrapper.text()).toContain('Publish the Dataset first')
    expect(hasField(wrapper, 'Title')).toBe(false)
    expect(adapter.draftCard).not.toHaveBeenCalled()

    await click(wrapper, 'Publish the Dataset first')

    expect(wrapper.emitted('switch-artefact')).toEqual([[{ kind: 'dataset', id: 'ds-1' }]])
    expect(wrapper.text()).toContain('Publish the Dataset')
    expect(field(wrapper, 'Title').element.value).toBe('Dutch rent judgments')
    wrapper.unmount()
  })

  it('opens a Model whose training Dataset has a DOI', async () => {
    const { wrapper } = await mountWizard({ listArtefacts: vi.fn().mockResolvedValue([model()]) }, { kind: 'model', id: 'm-1' })

    expect(wrapper.text()).toContain('10.5281/zenodo.111')
    expect(field(wrapper, 'Title').element.value).toBe('Rent outcome classifier')
    wrapper.unmount()
  })
})
