import type { InMemoryCache } from '@apollo/client';
import type { CacheStore } from './cache-store-base';

// The browser's half of `cache-store.ts`. A browser keeps no copy: it is online whenever the app has
// loaded at all, and a shared computer should not hold someone's contacts after the tab is closed.

/**
 * Keeps nothing.
 *
 * @param _cache - The cache a device would keep a copy of.
 * @returns A store that restores nothing and has nothing to forget.
 */
export function keepCache(_cache: InMemoryCache): CacheStore {
  return { isKept: false, restore: async () => undefined, forget: async () => undefined };
}
