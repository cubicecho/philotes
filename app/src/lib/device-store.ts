import * as SecureStore from 'expo-secure-store';

// What the app keeps on the device between runs: the session token and the server's address. On a
// device that is the system's encrypted store; `device-store.web.ts` is the browser's.

/** Values read or written this run, so a read never waits on the store. Null is a removed value. */
const known = new Map<string, string | null>();

/**
 * Reads a stored value.
 *
 * @param key - The value's name: letters, digits, `.`, `-` and `_`.
 * @returns The value, or null when nothing is stored under the name.
 */
export function readItem(key: string): string | null {
  const cached = known.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const stored = SecureStore.getItem(key);
  known.set(key, stored);
  return stored;
}

/**
 * Stores a value until it is removed, across restarts of the app.
 *
 * @param key - The value's name.
 * @param value - What to keep.
 */
export function writeItem(key: string, value: string): void {
  known.set(key, value);
  SecureStore.setItem(key, value);
}

/**
 * Removes a stored value. Reads see it gone at once; the store catches up in the background.
 *
 * @param key - The value's name.
 */
export function removeItem(key: string): void {
  known.set(key, null);
  SecureStore.deleteItemAsync(key).catch((error: unknown) => {
    console.error(`Could not remove ${key} from the device's store`, error);
  });
}
