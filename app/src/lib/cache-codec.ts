import type { FieldPolicy, NormalizedCacheObject } from '@apollo/client';
import { scalarTypePolicies } from '@/__generated__/type-policies';
import { dateTypePolicy } from '@/lib/date-type-policy';
import { localIsoDate, parseLocalDay } from '@/lib/local-date';

// The cache as text, for the copy a device keeps between runs. The cache holds `Date` objects where
// the API sends dates, and plain JSON would bring every one of them back as a string.

/**
 * The shape of the stored text. Raise it when a change to what the cache holds would make an older
 * copy wrong to restore; a copy written under another number is dropped.
 */
export const CACHE_FORMAT = 1;

/** What is written to the device. */
interface StoredCache {
  format: number;
  data: NormalizedCacheObject;
}

/** An object as the cache holds it: fields by name, with its type under `__typename`. */
type CacheObject = Record<string, unknown>;

const policies: Record<string, { fields: Record<string, FieldPolicy<Date | null, string | Date | null>> } | undefined> =
  scalarTypePolicies;

/**
 * Finds what kind of date a field holds.
 *
 * @param holder - The object the field is on.
 * @param field - The field's name.
 * @returns The field's policy, or undefined when the field is not a date.
 */
function datePolicyOf(holder: CacheObject, field: string): FieldPolicy<Date | null, string | Date | null> | undefined {
  const typename = holder.__typename;
  return typeof typename === 'string' ? policies[typename]?.fields[field] : undefined;
}

/**
 * Writes the cache as text.
 *
 * @param data - The cache, as `cache.extract()` gives it.
 * @returns The text `decodeCache` reads back.
 */
export function encodeCache(data: NormalizedCacheObject): string {
  const stored: StoredCache = { format: CACHE_FORMAT, data };
  // A function, not an arrow: JSON hands the replacer the value's holder as `this`, and by the time
  // the replacer sees a date it is already a string.
  return JSON.stringify(stored, function (this: CacheObject, field: string, value: unknown) {
    const original = this[field];
    // A day is written as the day it is here, so that it is the same day wherever it is read back.
    const isDay = original instanceof Date && datePolicyOf(this, field) === dateTypePolicy;
    return isDay ? localIsoDate(original) : value;
  });
}

/**
 * Reads the cache back from text, with its dates as `Date` objects again.
 *
 * @param text - What `encodeCache` wrote.
 * @returns The cache, or null when the text is not a copy this version of the app can restore.
 */
export function decodeCache(text: string): NormalizedCacheObject | null {
  let stored: unknown;
  try {
    stored = JSON.parse(text, function (this: CacheObject, field: string, value: unknown) {
      const policy = typeof value === 'string' ? datePolicyOf(this, field) : undefined;
      if (policy === undefined || typeof value !== 'string') {
        return value;
      }
      return policy === dateTypePolicy ? parseLocalDay(value) : new Date(value);
    });
  } catch {
    return null;
  }
  const isRestorable =
    typeof stored === 'object' &&
    stored !== null &&
    (stored as Partial<StoredCache>).format === CACHE_FORMAT &&
    typeof (stored as Partial<StoredCache>).data === 'object' &&
    (stored as Partial<StoredCache>).data !== null;
  return isRestorable ? (stored as StoredCache).data : null;
}
