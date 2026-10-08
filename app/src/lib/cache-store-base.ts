/** The copy of the cache a device keeps between runs, so that the app opens with no connection. */
export interface CacheStore {
  /** Whether this platform keeps a copy at all. */
  isKept: boolean;
  /** Fills the cache from the stored copy. Resolves once the cache is as full as it will get; never rejects. */
  restore: () => Promise<void>;
  /** Deletes the stored copy. Never rejects. */
  forget: () => Promise<void>;
}
