import type { Route } from 'fetchdts/compiler'
import type { DynamicParam, Endpoint, TypedFetchMetadataField } from '../src'
import { describe, expectTypeOf, it } from 'vitest'

declare module 'fetchdts/compiler' {
  interface RouteMetadataExtension {
    contract: unknown
  }
}

describe('consumer-owned route metadata', () => {
  it('accepts registered compiler fields and rejects unknown fields', () => {
    const route = {
      segments: ['/users'],
      metadata: {
        GET: {
          responseType: 'User',
          contractType: '{ cache: true }',
        },
      },
    } satisfies Route

    expectTypeOf(route.metadata.GET.contractType).toEqualTypeOf<string>()

    const invalidRoute: Route = {
      segments: ['/invalid'],
      metadata: {
        GET: {
          // @ts-expect-error metadata fields must be registered explicitly
          unknownType: 'string',
        },
      },
    }
    void invalidRoute
  })

  it('returns a fallback for a missing route or field', () => {
    interface Routes {
      '/users': {
        [Endpoint]: {
          GET: { response: { id: number } }
        }
      }
    }

    expectTypeOf<TypedFetchMetadataField<Routes, '/users', 'contract'>>().toBeNever()
    expectTypeOf<TypedFetchMetadataField<Routes, '/missing', 'contract', 'GET', 'fallback'>>().toEqualTypeOf<'fallback'>()
  })

  it('uses fallback unless every ambiguous candidate declares the field', () => {
    interface PartiallyDeclared {
      '/users': {
        '/me': { [Endpoint]: { GET: { contract: 'static' } } }
        [DynamicParam]: { [Endpoint]: { GET: { response: 'dynamic' } } }
      }
    }
    interface FullyDeclared {
      '/users': {
        '/me': { [Endpoint]: { GET: { contract: 'static' } } }
        [DynamicParam]: { [Endpoint]: { GET: { contract: 'dynamic' } } }
      }
    }

    expectTypeOf<TypedFetchMetadataField<PartiallyDeclared, `/users/${string}`, 'contract', 'GET', 'fallback'>>().toEqualTypeOf<'fallback'>()
    expectTypeOf<TypedFetchMetadataField<FullyDeclared, `/users/${string}`, 'contract', 'GET', 'fallback'>>().toEqualTypeOf<'static' | 'dynamic'>()
  })
})
