import { Platform } from 'react-native';

const TOKEN_KEY = 'philotes_token';

export function getToken(): string | null {
  if (Platform.OS === 'web') return window.localStorage.getItem(TOKEN_KEY);
  return null;
}

export function setToken(token: string): void {
  if (Platform.OS === 'web') window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
