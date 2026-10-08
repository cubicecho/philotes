import { readItem, removeItem, writeItem } from '@/lib/device-store';

const TOKEN_KEY = 'philotes_token';

/**
 * Reads the stored session token.
 *
 * @returns The token, or null when signed out.
 */
export function getToken(): string | null {
  return readItem(TOKEN_KEY);
}

/**
 * Stores the session token, which signs the user in.
 *
 * @param token - The bearer token the server issued.
 */
export function setToken(token: string): void {
  writeItem(TOKEN_KEY, token);
}

/** Removes the stored session token, which signs the user out. */
export function clearToken(): void {
  removeItem(TOKEN_KEY);
}

/**
 * Whether a session token is stored. The token is not checked: an expired one still counts.
 *
 * @returns True when there is a token.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * The header that carries the session to the server, for requests Apollo does not send.
 *
 * @returns The `authorization` header, or no headers when signed out.
 */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token === null ? {} : { authorization: `Bearer ${token}` };
}
