import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpAdapter } from '../src'
import type { PublishRequest } from '../src'

interface Call {
  url: string
  method: string
  auth?: string
  contentType?: string
  body?: unknown
}

function reply(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  })
}

function stubFetch(response: () => Response) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    calls.push({
      url,
      method: init.method ?? 'GET',
      auth: headers.Authorization,
      contentType: headers['Content-Type'],
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    return response()
  })
  return calls
}

function adapter() {
  return createHttpAdapter({ baseUrl: '/api/publishing', getAuthToken: () => 'tok-1' })
}

const request: PublishRequest = {
  kind: 'dataset',
  id: 'ds-1',
  metadata: { title: 'Rent cases', creators: [{ name: 'Doe, Jane' }], license: 'cc-by-4.0' },
  access: 'restricted',
  access_conditions: 'For research only.',
  card: { text: '# Card', approved: true },
  attestation: { license: true, rights: true, personal_data: true },
}

const publication = {
  id: 'pub-1',
  kind: 'dataset',
  artefact_id: 'ds-1',
  title: 'Rent cases',
  doi: '10.5281/zenodo.123',
  record_url: 'https://zenodo.org/records/123',
  access: 'open',
  license: 'cc-by-4.0',
  related_dataset_doi: null,
  published_at: '2026-11-06T10:00:00Z',
  mine: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createHttpAdapter routes', () => {
  it('getConfig: GET /config', async () => {
    const config = { enabled: true, licenses: [] }
    const calls = stubFetch(() => reply(200, config))

    expect(await adapter().getConfig()).toEqual(config)
    expect(calls).toEqual([{ url: '/api/publishing/config', method: 'GET', auth: 'Bearer tok-1', contentType: undefined, body: undefined }])
  })

  it('getTokenStatus: GET /token', async () => {
    const calls = stubFetch(() => reply(200, { connected: false }))

    expect(await adapter().getTokenStatus()).toEqual({ connected: false })
    expect(calls[0]).toMatchObject({ url: '/api/publishing/token', method: 'GET' })
  })

  it('saveToken: PUT /token with {token}', async () => {
    const calls = stubFetch(() => reply(200, { connected: true }))

    expect(await adapter().saveToken('secret-abc')).toEqual({ connected: true })
    expect(calls[0]).toMatchObject({
      url: '/api/publishing/token',
      method: 'PUT',
      contentType: 'application/json',
      body: { token: 'secret-abc' },
    })
  })

  it('deleteToken: DELETE /token, answered 204 with no body', async () => {
    const calls = stubFetch(() => reply(204))

    await expect(adapter().deleteToken()).resolves.toBeUndefined()
    expect(calls[0]).toMatchObject({ url: '/api/publishing/token', method: 'DELETE' })
  })

  it('listArtefacts: GET /artefacts, unwrapping artefacts', async () => {
    const artefact = { kind: 'dataset', id: 'ds-1', title: 'Rent cases' }
    const calls = stubFetch(() => reply(200, { artefacts: [artefact] }))

    expect(await adapter().listArtefacts()).toEqual([artefact])
    expect(calls[0]).toMatchObject({ url: '/api/publishing/artefacts', method: 'GET' })
  })

  it('draftCard: POST /card-draft with the artefact ref', async () => {
    const calls = stubFetch(() => reply(200, { card: '# Dataset card', source: 'llm' }))

    expect(await adapter().draftCard({ kind: 'model', id: 'm-1' })).toEqual({ card: '# Dataset card', source: 'llm' })
    expect(calls[0]).toMatchObject({ url: '/api/publishing/card-draft', method: 'POST', body: { kind: 'model', id: 'm-1' } })
  })

  it('preview: POST /preview with the publish request', async () => {
    const preview = { datacite: { titles: [{ title: 'Rent cases' }] }, ro_crate: {}, card: '# Card', files: [{ name: 'data.csv', size: 10 }] }
    const calls = stubFetch(() => reply(200, preview))

    expect(await adapter().preview(request)).toEqual(preview)
    expect(calls[0]).toMatchObject({ url: '/api/publishing/preview', method: 'POST', body: request })
  })

  it('publish: POST /publish, answered 201, unwrapping publication', async () => {
    const calls = stubFetch(() => reply(201, { publication }))

    expect(await adapter().publish(request)).toEqual(publication)
    expect(calls[0]).toMatchObject({ url: '/api/publishing/publish', method: 'POST', body: request })
  })

  it('listPublications: GET /registry without a query', async () => {
    const calls = stubFetch(() => reply(200, { publications: [publication] }))

    expect(await adapter().listPublications()).toEqual([publication])
    expect(calls[0]).toMatchObject({ url: '/api/publishing/registry', method: 'GET' })
  })

  it('listPublications: GET /registry?q=&kind=', async () => {
    const calls = stubFetch(() => reply(200, { publications: [] }))

    await adapter().listPublications('rent & lease', 'model')
    expect(calls[0].url).toBe('/api/publishing/registry?q=rent+%26+lease&kind=model')
  })

  it('listPublications: leaves out an empty q', async () => {
    const calls = stubFetch(() => reply(200, { publications: [] }))

    await adapter().listPublications('', 'dataset')
    expect(calls[0].url).toBe('/api/publishing/registry?kind=dataset')
  })

  it('getPublication: GET /registry/{id}, encoded, unwrapping publication', async () => {
    const calls = stubFetch(() => reply(200, { publication }))

    expect(await adapter().getPublication('pub/1')).toEqual(publication)
    expect(calls[0]).toMatchObject({ url: '/api/publishing/registry/pub%2F1', method: 'GET' })
  })
})

describe('createHttpAdapter options', () => {
  it('drops a trailing slash from baseUrl', async () => {
    const calls = stubFetch(() => reply(200, { connected: true }))

    await createHttpAdapter({ baseUrl: 'https://host.example/api/publishing/' }).getTokenStatus()
    expect(calls[0].url).toBe('https://host.example/api/publishing/token')
  })

  it('sends no Authorization header without a token', async () => {
    const calls = stubFetch(() => reply(200, { connected: true }))

    await createHttpAdapter({ baseUrl: '/api/publishing', getAuthToken: () => null }).getTokenStatus()
    expect(calls[0].auth).toBeUndefined()
  })
})

describe('createHttpAdapter errors', () => {
  it('rejects with the message, status, code and every extra field', async () => {
    stubFetch(() =>
      reply(409, {
        error: 'Publish the training Dataset first.',
        code: 'dataset_doi_required',
        training_dataset: { id: 'ds-1', title: 'Rent cases' },
      }),
    )

    const error = await adapter().publish(request).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Publish the training Dataset first.')
    expect(error.status).toBe(409)
    expect(error.code).toBe('dataset_doi_required')
    expect(error.training_dataset).toEqual({ id: 'ds-1', title: 'Rent cases' })
  })

  it('carries missing for attestation_required', async () => {
    stubFetch(() => reply(400, { error: 'Confirm all three statements.', code: 'attestation_required', missing: ['rights'] }))

    const error = await adapter().publish(request).catch((e) => e)
    expect(error.code).toBe('attestation_required')
    expect(error.missing).toEqual(['rights'])
  })

  it('carries detail for round_trip_failed', async () => {
    stubFetch(() => reply(422, { error: 'The exported Model does not match.', code: 'round_trip_failed', detail: '3 of 40 differ' }))

    const error = await adapter().preview(request).catch((e) => e)
    expect(error.code).toBe('round_trip_failed')
    expect(error.detail).toBe('3 of 40 differ')
  })

  it('gives a readable message when the body is not JSON', async () => {
    stubFetch(() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))

    const error = await adapter().getConfig().catch((e) => e)
    expect(error.status).toBe(502)
    expect(error.code).toBeUndefined()
    expect(error.message).toContain('502')
  })
})
