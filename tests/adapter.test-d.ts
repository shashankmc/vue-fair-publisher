import { describe, expectTypeOf, it } from 'vitest'
import type { PublishingAdapter, PublishingError, TokenStatus } from '../src'

describe('PublishingAdapter', () => {
  it('has one method per route of the publishing API', () => {
    expectTypeOf<keyof PublishingAdapter>().toEqualTypeOf<
      | 'getConfig'
      | 'getTokenStatus'
      | 'saveToken'
      | 'deleteToken'
      | 'listArtefacts'
      | 'draftCard'
      | 'preview'
      | 'publish'
      | 'listPublications'
      | 'getPublication'
    >()
  })

  it('never returns the token', () => {
    expectTypeOf<Awaited<ReturnType<PublishingAdapter['saveToken']>>>().toEqualTypeOf<TokenStatus>()
    expectTypeOf<Awaited<ReturnType<PublishingAdapter['getTokenStatus']>>>().not.toHaveProperty('token')
  })

  it('rejects with the backend code and its extra fields', () => {
    expectTypeOf<PublishingError>().toMatchTypeOf<Error>()
    expectTypeOf<PublishingError>().toHaveProperty('code')
    expectTypeOf<PublishingError>().toHaveProperty('missing')
    expectTypeOf<PublishingError>().toHaveProperty('training_dataset')
    expectTypeOf<PublishingError>().toHaveProperty('detail')
  })
})
