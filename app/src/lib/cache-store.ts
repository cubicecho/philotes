import type { InMemoryCache, NormalizedCacheObject } from '@apollo/client';
import { CachePersistor } from 'apollo3-cache-persist';
import Storage from 'expo-sqlite/kv-store';
import { decodeCache, encodeCache } from '@/lib/cache-codec';
import { CACHE_STORE_DEFAULTS } from '@/lib/defaults';
import type { CacheStore } from './cache-store-base';

// A device keeps a copy of the cache in the app's own SQLite database, rewritten a moment after each
// change, so that what was on screen last time is there with no connection. `cache-store.web.ts` is
// the browser's half, which keeps nothing.

const STORAGE_KEY = 'philotes_apollo_cache';

/** What the persistor's constructor says it takes: only the form that serializes for itself. */
type PersistorOptions = ConstructorParameters<typeof CachePersistor<NormalizedCacheObject>>[0];

/** Reads and writes the copy, as the persistor's storage. It hands the persistor objects, not text. */
const storage = {
  async getItem(key: string): Promise<NormalizedCacheObject | null> {
    const text = await Storage.getItem(key);
    return text === null ? null : decodeCache(text);
  },
  async setItem(key: string, data: NormalizedCacheObject): Promise<void> {
    const text = encodeCache(data);
    const isTooLarge = text.length > CACHE_STORE_DEFAULTS.maxChars;
    if (isTooLarge) {
      // Better no copy than a stale one that looks current.
      console.warn(`The cache is ${text.length} characters, too large to keep on the device`);
      await Storage.removeItem(key);
      return;
    }
    await Storage.setItem(key, text);
  },
  async removeItem(key: string): Promise<void> {
    await Storage.removeItem(key);
  },
};

/**
 * Starts keeping a copy of a cache on the device.
 *
 * @param cache - The cache to copy after each change.
 * @returns The store, to restore the copy from at start and to forget it at sign-out.
 */
export function keepCache(cache: InMemoryCache): CacheStore {
  const options = {
    cache,
    storage,
    key: STORAGE_KEY,
    // The storage above writes the text itself, to keep dates as dates.
    serialize: false,
    debounce: CACHE_STORE_DEFAULTS.persistDebounceMs,
    // The size is checked above, where the text exists.
    maxSize: false,
  };
  // The class takes both forms; its constructor's type leaves this one out.
  const persistor = new CachePersistor(options as unknown as PersistorOptions);

  /** Deletes the copy, and reports rather than throws: no caller can do better than carry on. */
  async function forget(): Promise<void> {
    await persistor.purge().catch((error: unknown) => {
      console.error('Could not delete the stored cache', error);
    });
  }

  return {
    isKept: true,
    forget,
    restore: async () => {
      try {
        await persistor.restore();
      } catch (error) {
        console.error('Could not restore the stored cache', error);
        await forget();
      }
    },
  };
}
