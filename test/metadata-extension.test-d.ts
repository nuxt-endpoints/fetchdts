import type { Route } from 'fetchdts/compiler'
import type { DynamicParam, Endpoint, TypedFetchResolvedMeta } from '../src'
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

    expectTypeOf<'contract' extends keyof TypedFetchResolvedMeta<Routes, '/users', 'GET'> ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<TypedFetchResolvedMeta<Routes, '/missing', 'GET'>>().toBeNever()
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

    expectTypeOf<'contract' extends keyof TypedFetchResolvedMeta<PartiallyDeclared, `/users/${string}`, 'GET'> ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<TypedFetchResolvedMeta<FullyDeclared, `/users/${string}`, 'GET'>['contract']>().toEqualTypeOf<'static' | 'dynamic'>()
  })
})
