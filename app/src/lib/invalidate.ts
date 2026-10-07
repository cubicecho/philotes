import type { ApolloCache } from '@apollo/client';

/** The root query fields a mutation can make stale. */
export type QueryField = 'persons' | 'labels';

/**
 * Drops root query fields from the cache, with every set of arguments they were read with. A
 * query on screen that reads one fetches again at once, and one that is not fetches when its
 * page is next opened. This is what a mutation's `update` calls when it changes rows that other
 * pages list.
 *
 * @param cache - The Apollo cache, as a mutation's `update` receives it.
 * @param fieldNames - The root fields the mutation changed.
 * @returns Nothing.
 */
export function invalidateQueryFields(cache: ApolloCache<unknown>, fieldNames: readonly QueryField[]): void {
  for (const fieldName of fieldNames) {
    cache.evict({ id: 'ROOT_QUERY', fieldName });
  }
  cache.gc();
}
