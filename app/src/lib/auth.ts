import { Platform } from 'react-native';

const TOKEN_KEY = 'philotes_token';

/**
 * Reads the stored session token.
 *
 * @returns The token, or null when signed out. Always null off the web, where nothing stores one.
 */
export function getToken(): string | null {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

/**
 * Stores the session token, which signs the user in. Does nothing off the web.
 *
 * @param token - The bearer token the server issued.
 */
export function setToken(token: string): void {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

/** Removes the stored session token, which signs the user out. Does nothing off the web. */
export function clearToken(): void {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Whether a session token is stored. The token is not checked: an expired one still counts.
 *
 * @returns True when there is a token.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
