import { Platform } from 'react-native';
import { apiUrl, setApiUrl } from '@/lib/api-url';
import { readItem, writeItem } from '@/lib/device-store';

// The server a device was pointed at, kept between runs. The web app is served by its server, or
// built for one, and never asks.

const SERVER_URL_KEY = 'philotes_server_url';

/** Whether this platform lets the user say where the server is. */
export const CAN_CHOOSE_SERVER = Platform.OS !== 'web';

if (CAN_CHOOSE_SERVER) {
  // At import, which is before the first request: `apollo.ts` imports this module.
  setApiUrl(readItem(SERVER_URL_KEY));
}

/**
 * Whether the app knows which server to talk to.
 *
 * @returns False on a device that has not been given an address yet.
 */
export function hasServerAddress(): boolean {
  return CAN_CHOOSE_SERVER === false || apiUrl() !== '';
}

/**
 * Points the app at a server, now and on every later run.
 *
 * @param url - The server's address, as `normalizeServerUrl` writes it.
 */
export function saveServerAddress(url: string): void {
  writeItem(SERVER_URL_KEY, url);
  setApiUrl(url);
}
