import type { Route } from 'fetchdts/compiler'
import type {
  AnyHTTPMethod,
  DynamicParam,
  Endpoint,
  HTTPMethod,
  TypedFetchMetadataField,
} from '../src'
import { describe, expectTypeOf, it } from 'vitest'

declare module 'fetchdts/compiler' {
  interface RouteMetadataExtension {
    contract: unknown
  }
}

interface StatusContract {
  contract: {
    responses: {
      200: { id: number }
      404: { message: string }
    }
  }
}

describe('consumer metadata extensions', () => {
  it('accepts augmented compiler metadata and rejects unknown fields', () => {
    const route = {
      segments: ['/users'],
      metadata: {
        GET: {
          responseType: '{ id: number }',
          contractType: '{ responses: { 200: { id: number }, 404: { message: string } } }',
        },
      },
    } satisfies Route
    expectTypeOf(route.metadata.GET.contractType).toBeString()

    const invalidRoute: Route = {
      segments: ['/invalid'],
      metadata: {
        GET: {
          // @ts-expect-error extensions are registered explicitly instead of accepting arbitrary metadata
          undeclaredType: 'string',
        },
      },
    }
    void invalidRoute
  })

  it('resolves a custom field without making fetchdts interpret it', () => {
    interface Routes {
      '/users': {
        [Endpoint]: {
          GET: StatusContract
          POST: {
            contract: { responses: { 201: { id: number, created: true } } }
          }
        }
      }
    }

    expectTypeOf<TypedFetchMetadataField<Routes, '/users', 'contract'>>().toEqualTypeOf<StatusContract['contract']>()
    expectTypeOf<TypedFetchMetadataField<Routes, '/users', 'missing'>>().toBeNever()
    expectTypeOf<TypedFetchMetadataField<Routes, '/missing', 'contract', 'GET', unknown>>().toBeUnknown()
    expectTypeOf<StatusResult<Routes, '/users'>>().toEqualTypeOf<
      | { status: 200, body: { id: number } }
      | { status: 404, body: { message: string } }
    >()
    expectTypeOf<StatusResult<Routes, '/users', 'POST'>>().toEqualTypeOf<
      { status: 201, body: { id: number, created: true } }
    >()
  })

  it('keeps ALL replacement and ambiguous-match semantics explicit', () => {
    interface Routes {
      '/all': {
        [Endpoint]: Record<Exclude<HTTPMethod, 'POST'>, StatusContract> & {
          POST: { response: { created: true } }
        }
      }
      '/ambiguous': {
        '/fixed': { [Endpoint]: { GET: StatusContract } }
        [DynamicParam]: { [Endpoint]: { GET: { response: { dynamic: true } } } }
      }
    }

    expectTypeOf<TypedFetchMetadataField<Routes, '/all', 'contract', 'DELETE'>>().toEqualTypeOf<StatusContract['contract']>()
    expectTypeOf<TypedFetchMetadataField<Routes, '/all', 'contract', 'POST', 'fallback'>>().toEqualTypeOf<'fallback'>()
    expectTypeOf<TypedFetchMetadataField<Routes, `/ambiguous/${string}`, 'contract', 'GET', 'fallback'>>().toEqualTypeOf<'fallback'>()
  })
})

type StatusResult<Routes, Path, Method extends AnyHTTPMethod = 'GET'>
  = TypedFetchMetadataField<Routes, Path, 'contract', Method> extends { responses: infer Responses }
    ? { [Status in keyof Responses]: { status: Status, body: Responses[Status] } }[keyof Responses]
    : never
