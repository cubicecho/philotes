import type { SecondaryStorage } from 'better-auth';
import { MS_PER_SECOND } from '../core/wire.ts';

/** One stored value, and when it stops counting. */
interface Entry {
  value: string;
  /** Milliseconds since the epoch, or null for never. */
  expiresAt: number | null;
}

/**
 * In-process session storage. A restart signs everyone out, and a second replica won't see them.
 *
 * @returns A better-auth `SecondaryStorage` backed by a Map.
 */
export function memoryStorage(): SecondaryStorage {
  const entries = new Map<string, Entry>();

  const expiryFor = (ttlSeconds?: number): number | null => {
    const hasTtl = ttlSeconds !== undefined && ttlSeconds > 0;
    return hasTtl ? Date.now() + ttlSeconds * MS_PER_SECOND : null;
  };

  const liveEntry = (key: string): Entry | undefined => {
    const entry = entries.get(key);
    const hasExpired = entry !== undefined && entry.expiresAt !== null && entry.expiresAt <= Date.now();
    if (hasExpired) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    get: async (key) => liveEntry(key)?.value ?? null,
    getAndDelete: async (key) => {
      const value = liveEntry(key)?.value ?? null;
      entries.delete(key);
      return value;
    },
    increment: async (key, ttl) => {
      const entry = liveEntry(key);
      if (entry === undefined) {
        entries.set(key, { value: '1', expiresAt: expiryFor(ttl) });
        return 1;
      }
      // The expiry set when the counter was created stands: later increments never extend it.
      const count = Number(entry.value) + 1;
      entry.value = String(count);
      return count;
    },
    set: async (key, value, ttl) => {
      entries.set(key, { value, expiresAt: expiryFor(ttl) });
    },
    delete: async (key) => {
      entries.delete(key);
    },
  };
}
