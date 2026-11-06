import type {
  Artefact,
  ArtefactKind,
  ArtefactRef,
  CardDraft,
  Preview,
  Publication,
  PublishingAdapter,
  PublishingConfig,
  PublishingError,
  PublishRequest,
  TokenStatus,
} from '../types'

export interface HttpAdapterOptions {
  /** Where the host mounts the publishing API, e.g. "/api/publishing" or "https://app.example.com/api/publishing". */
  baseUrl: string
  /** Called on every request; return the bearer token, or nothing to send none (e.g. cookie sign-in). */
  getAuthToken?: () => string | null | undefined
}

async function parseOrThrow(res: Response): Promise<any> {
  const text = await res.text()
  let data: any = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = {}
    }
  }
  if (!res.ok) {
    const { error: message, ...extra } = data && typeof data === 'object' ? data : ({} as Record<string, unknown>)
    const error = new Error(
      typeof message === 'string' && message ? message : `The publishing service answered ${res.status} ${res.statusText}. Try again later.`,
    ) as PublishingError
    Object.assign(error, extra)
    error.status = res.status
    throw error
  }
  return data
}

/** A `PublishingAdapter` that talks to fair-publishing's HTTP API with fetch. */
export function createHttpAdapter(opts: HttpAdapterOptions): PublishingAdapter {
  const base = opts.baseUrl.replace(/\/+$/, '')

  function send(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {}
    const token = opts.getAuthToken?.()
    if (token) headers.Authorization = `Bearer ${token}`
    const init: RequestInit = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    return fetch(`${base}${path}`, init).then(parseOrThrow)
  }

  return {
    getConfig: (): Promise<PublishingConfig> => send('GET', '/config'),
    getTokenStatus: (): Promise<TokenStatus> => send('GET', '/token'),
    saveToken: (token: string): Promise<TokenStatus> => send('PUT', '/token', { token }),
    deleteToken: async (): Promise<void> => {
      await send('DELETE', '/token')
    },
    listArtefacts: async (): Promise<Artefact[]> => (await send('GET', '/artefacts')).artefacts ?? [],
    draftCard: (ref: ArtefactRef): Promise<CardDraft> => send('POST', '/card-draft', { kind: ref.kind, id: ref.id }),
    preview: (request: PublishRequest): Promise<Preview> => send('POST', '/preview', request),
    publish: async (request: PublishRequest): Promise<Publication> => (await send('POST', '/publish', request)).publication,
    listPublications: async (q?: string, kind?: ArtefactKind): Promise<Publication[]> => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (kind) params.set('kind', kind)
      const query = params.toString()
      return (await send('GET', `/registry${query ? `?${query}` : ''}`)).publications ?? []
    },
    getPublication: async (id: string): Promise<Publication> =>
      (await send('GET', `/registry/${encodeURIComponent(id)}`)).publication,
  }
}
