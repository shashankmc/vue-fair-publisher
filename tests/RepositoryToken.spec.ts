import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { ADAPTER_KEY, RepositoryToken, VueFairPublisherPlugin } from '../src'
import type { PublishingAdapter } from '../src'
import { callsBesidesConfig, config, createTestAdapter, refusal } from './testAdapter'

async function mounted(overrides: Partial<PublishingAdapter> = {}, props = {}) {
  const adapter = createTestAdapter(overrides)
  const wrapper = mount(RepositoryToken, { props: { adapter, ...props }, attachTo: document.body })
  await flushPromises()
  return { adapter, wrapper }
}

function button(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === text)
  if (!found) throw new Error(`no button "${text}"`)
  return found
}

describe('RepositoryToken', () => {
  it('says when the token is not connected and links to where to create one', async () => {
    const { wrapper } = await mounted({ getTokenStatus: vi.fn().mockResolvedValue({ connected: false }) })

    expect(wrapper.text()).toContain('Not connected')
    const link = wrapper.find('a[href="https://zenodo.org/account/settings/applications/tokens/new/"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(wrapper.find('label').text()).toContain('token')
    wrapper.unmount()
  })

  it('saves the token write-only and clears the field afterwards', async () => {
    const { adapter, wrapper } = await mounted({ getTokenStatus: vi.fn().mockResolvedValue({ connected: false }) })
    const input = wrapper.find('input[type="password"]')
    await input.setValue('zenodo-secret')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(adapter.saveToken).toHaveBeenCalledWith('zenodo-secret')
    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.text()).not.toContain('Not connected')
    expect(wrapper.html()).not.toContain('zenodo-secret')
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
    expect(wrapper.emitted('change')).toEqual([[true]])
    wrapper.unmount()
  })

  it('asks for the token instead of sending an empty one', async () => {
    const { adapter, wrapper } = await mounted({ getTokenStatus: vi.fn().mockResolvedValue({ connected: false }) })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(adapter.saveToken).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toContain('Paste your token')
    wrapper.unmount()
  })

  it('shows the backend refusal and clears the field when saving fails', async () => {
    const { wrapper } = await mounted({
      getTokenStatus: vi.fn().mockResolvedValue({ connected: false }),
      saveToken: vi.fn().mockRejectedValue(refusal('token_missing', 'The token is empty.')),
    })
    const input = wrapper.find('input[type="password"]')
    await input.setValue('  ')
    await input.setValue('bad-token')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('The token is empty.')
    expect((wrapper.find('input[type="password"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('Not connected')
    wrapper.unmount()
  })

  it('forgets a connected token', async () => {
    const { adapter, wrapper } = await mounted()
    expect(wrapper.text()).toContain('Connected')

    await button(wrapper, 'Disconnect').trigger('click')
    await flushPromises()

    expect(adapter.deleteToken).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Not connected')
    expect(wrapper.emitted('change')).toEqual([[false]])
    wrapper.unmount()
  })

  it('marks a sandbox repository', async () => {
    const sandbox = config({ repository: { ...config().repository, sandbox: true } })
    const { wrapper } = await mounted({ getConfig: vi.fn().mockResolvedValue(sandbox) })

    expect(wrapper.text()).toContain('Sandbox')
    wrapper.unmount()
  })

  it('does not mark a live repository as sandbox', async () => {
    const { wrapper } = await mounted()

    expect(wrapper.text()).not.toContain('Sandbox')
    wrapper.unmount()
  })

  it('uses a config passed in instead of fetching it', async () => {
    const { adapter, wrapper } = await mounted({}, { config: config({ repository: { ...config().repository, name: 'Zenodo Sandbox' } }) })

    expect(adapter.getConfig).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Zenodo Sandbox')
    wrapper.unmount()
  })

  it('says publishing is turned off and calls nothing else', async () => {
    const { adapter, wrapper } = await mounted({ getConfig: vi.fn().mockResolvedValue(config({ enabled: false })) })

    expect(wrapper.text()).toContain('Publishing is turned off on this platform')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(callsBesidesConfig(adapter)).toEqual([])
    wrapper.unmount()
  })

  it('shows why the config could not load, and loads again on request', async () => {
    const getConfig = vi.fn().mockRejectedValueOnce(new Error('Network down.')).mockResolvedValue(config())
    const { wrapper } = await mounted({ getConfig })

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down.')
    await button(wrapper, 'Try again').trigger('click')
    await flushPromises()

    expect(getConfig).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Connected')
    wrapper.unmount()
  })

  it('takes the adapter from the plugin', async () => {
    const adapter = createTestAdapter()
    const wrapper = mount(RepositoryToken, { global: { plugins: [[VueFairPublisherPlugin, { adapter }]] } })
    await flushPromises()

    expect(adapter.getTokenStatus).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Connected')
    wrapper.unmount()
  })

  it(`takes the adapter provided under ${ADAPTER_KEY}`, async () => {
    const adapter = createTestAdapter()
    const wrapper = mount({ render: () => h(RepositoryToken) }, { global: { provide: { [ADAPTER_KEY]: adapter } } })
    await flushPromises()

    expect(adapter.getTokenStatus).toHaveBeenCalled()
    wrapper.unmount()
  })
})
