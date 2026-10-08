// The browser's half of `device-store.ts`: the same three functions over `localStorage`.

/**
 * Reads a stored value.
 *
 * @param key - The value's name.
 * @returns The value, or null when nothing is stored under the name.
 */
export function readItem(key: string): string | null {
  return window.localStorage.getItem(key);
}

/**
 * Stores a value until it is removed, across visits.
 *
 * @param key - The value's name.
 * @param value - What to keep.
 */
export function writeItem(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

/**
 * Removes a stored value.
 *
 * @param key - The value's name.
 */
export function removeItem(key: string): void {
  window.localStorage.removeItem(key);
}
