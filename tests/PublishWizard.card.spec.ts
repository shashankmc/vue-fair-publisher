import { describe, expect, it, vi } from 'vitest'
import { config } from './testAdapter'
import { button, choice, click, completeDetails, field, mountWizard } from './wizardHelpers'

describe('PublishWizard: creators and access', () => {
  it('sends the filled-in metadata, creators and access level to preview', async () => {
    const { adapter, wrapper } = await mountWizard()
    await field(wrapper, 'Keywords').setValue('rent, tenancy , ')
    await field(wrapper, 'License').setValue('cc0-1.0')
    await field(wrapper, 'Version').setValue('1.0')
    await field(wrapper, 'Name').setValue(' Doe, Jane ')
    await field(wrapper, 'Affiliation').setValue('Maastricht University')
    await click(wrapper, 'Add a creator')
    const names = wrapper.findAll('input[placeholder="Family, Given"]')
    await names[1].setValue('Roe, Rick')
    await click(wrapper, 'Draft the card')
    await choice(wrapper, 'I have read this card').setValue(true)

    await click(wrapper, 'Preview the deposit')

    expect(adapter.preview).toHaveBeenCalledWith({
      kind: 'dataset',
      id: 'ds-1',
      metadata: {
        title: 'Dutch rent judgments',
        description: 'Rent tribunal decisions labelled by outcome.',
        creators: [{ name: 'Doe, Jane', affiliation: 'Maastricht University' }, { name: 'Roe, Rick' }],
        keywords: ['rent', 'tenancy'],
        license: 'cc0-1.0',
        language: 'nl',
        jurisdiction: 'NL',
        document_type: 'judgment',
        version: '1.0',
      },
      access: 'open',
      card: { text: '# Dataset card\n\nDrafted.', approved: true },
      attestation: { license: false, rights: false, personal_data: false },
    })
    wrapper.unmount()
  })

  it('removes a creator', async () => {
    const { wrapper } = await mountWizard()
    await click(wrapper, 'Add a creator')
    expect(wrapper.findAll('input[placeholder="Family, Given"]')).toHaveLength(2)

    await click(wrapper, 'Remove creator 2')

    expect(wrapper.findAll('input[placeholder="Family, Given"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('explains each access level in plain language, offering only those the host allows', async () => {
    const { wrapper } = await mountWizard({
      getConfig: vi.fn().mockResolvedValue(config({ access_levels: ['restricted', 'metadata_only'] })),
    })

    expect(wrapper.text()).not.toContain('Anyone can download the files.')
    expect(wrapper.text()).toContain('people must ask you for the files')
    expect(wrapper.text()).toContain('No files are uploaded')
    wrapper.unmount()
  })

  it('requires access conditions for restricted access and sends them', async () => {
    const { adapter, wrapper } = await mountWizard()
    await completeDetails(wrapper)
    await choice(wrapper, 'Restricted').setValue(true)

    await click(wrapper, 'Preview the deposit')
    expect(adapter.preview).not.toHaveBeenCalled()
    expect(field(wrapper, 'Access conditions').attributes('aria-invalid')).toBe('true')

    await field(wrapper, 'Access conditions').setValue('Non-commercial research only.')
    await click(wrapper, 'Preview the deposit')

    expect(adapter.preview).toHaveBeenCalledWith(
      expect.objectContaining({ access: 'restricted', access_conditions: 'Non-commercial research only.' }),
    )
    wrapper.unmount()
  })

  it('sends metadata-only access', async () => {
    const { adapter, wrapper } = await mountWizard()
    await completeDetails(wrapper)
    await choice(wrapper, 'Metadata only').setValue(true)

    await click(wrapper, 'Preview the deposit')

    expect(adapter.preview).toHaveBeenCalledWith(expect.objectContaining({ access: 'metadata_only' }))
    expect(vi.mocked(adapter.preview).mock.calls[0][0]).not.toHaveProperty('access_conditions')
    wrapper.unmount()
  })
})

describe('PublishWizard: the card', () => {
  it('drafts the card for this artefact and says an AI wrote it', async () => {
    const { adapter, wrapper } = await mountWizard()

    await click(wrapper, 'Draft the card')

    expect(adapter.draftCard).toHaveBeenCalledWith({ kind: 'dataset', id: 'ds-1' })
    expect(field(wrapper, 'Card text').element.value).toBe('# Dataset card\n\nDrafted.')
    expect(wrapper.text()).toContain('An AI language model wrote this draft')
    expect(choice(wrapper, 'I have read this card').element.checked).toBe(false)
    wrapper.unmount()
  })

  it('says when the draft comes from a template', async () => {
    const { wrapper } = await mountWizard({ draftCard: vi.fn().mockResolvedValue({ card: '# Card', source: 'template' }) })

    await click(wrapper, 'Draft the card')

    expect(wrapper.text()).toContain('from a template')
    expect(wrapper.text()).not.toContain('An AI language model')
    wrapper.unmount()
  })

  it('sends the card as the user edited it', async () => {
    const { adapter, wrapper } = await mountWizard()
    await completeDetails(wrapper)
    await field(wrapper, 'Card text').setValue('# My own card')

    await click(wrapper, 'Preview the deposit')

    expect(adapter.preview).toHaveBeenCalledWith(expect.objectContaining({ card: { text: '# My own card', approved: true } }))
    wrapper.unmount()
  })

  it('does not preview a card that is not approved', async () => {
    const { adapter, wrapper } = await mountWizard()
    await completeDetails(wrapper)
    await choice(wrapper, 'I have read this card').setValue(false)

    await click(wrapper, 'Preview the deposit')

    expect(adapter.preview).not.toHaveBeenCalled()
    expect(choice(wrapper, 'I have read this card').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[role="alert"]').text()).toContain('Card approval')
    wrapper.unmount()
  })

  it('asks for approval again after a new draft', async () => {
    const { wrapper } = await mountWizard()
    await completeDetails(wrapper)

    await click(wrapper, 'Draft the card again')

    expect(choice(wrapper, 'I have read this card').element.checked).toBe(false)
    wrapper.unmount()
  })

  it('shows why the draft failed and that the user can write the card', async () => {
    const { wrapper } = await mountWizard({ draftCard: vi.fn().mockRejectedValue(new Error('The LLM is not available.')) })

    await click(wrapper, 'Draft the card')

    expect(wrapper.find('[role="alert"]').text()).toContain('The LLM is not available.')
    expect(wrapper.find('[role="alert"]').text()).toContain('write the card yourself')
    expect(button(wrapper, 'Draft the card')).toBeDefined()
    wrapper.unmount()
  })
})
