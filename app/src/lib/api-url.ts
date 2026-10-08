/**
 * Where the server is when nothing on the device says otherwise. Empty when the app is served by
 * the server itself, so paths stay relative; `EXPO_PUBLIC_API_URL` names it when the app runs on
 * another origin.
 */
const BUILD_API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// The one address every request is built from. It is read at each request and not at import, so a
// device can be pointed at a server after the bundle is built. `server-address.ts` keeps it stored.
let currentApiUrl = BUILD_API_URL;

/**
 * Where the server is.
 *
 * @returns The server's origin without a trailing slash, or `""` for the page's own origin.
 */
export function apiUrl(): string {
  return currentApiUrl;
}

/**
 * Points every later request at a server.
 *
 * @param url - The server's origin, as `normalizeServerUrl` writes it, or null for the build's own.
 */
export function setApiUrl(url: string | null): void {
  currentApiUrl = url ?? BUILD_API_URL;
}

const HTTPS_SCHEME = 'https://';
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const WEB_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Turns what someone typed for their server into the address requests are built from.
 *
 * @param input - A typed address, such as `philotes.example.com` or `http://192.168.1.20:3000/`.
 * @returns The address without a trailing slash, with `https://` when no scheme was typed, or null
 * when it is not a web address.
 */
export function normalizeServerUrl(input: string): string | null {
  const typed = input.trim();
  if (typed === '') {
    return null;
  }
  const withScheme = HAS_SCHEME.test(typed) ? typed : `${HTTPS_SCHEME}${typed}`;
  if (URL.canParse(withScheme) === false) {
    return null;
  }
  const url = new URL(withScheme);
  const isWebAddress = WEB_PROTOCOLS.has(url.protocol) && url.hostname !== '';
  if (isWebAddress === false) {
    return null;
  }
  // The path is kept, so a server behind a sub-path of a reverse proxy still works.
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

/**
 * The address of the GraphQL endpoint.
 *
 * @returns The URL.
 */
export function graphqlUrl(): string {
  return `${apiUrl()}/graphql`;
}

/**
 * The address of a stored avatar. The server stores the path with its `/avatars/` prefix, so it
 * is used as it is and only the origin is added.
 *
 * @param avatarPath - The path as the API returns it, such as `/avatars/<name>.png`.
 * @returns The URL to load the image from.
 */
export function avatarUrl(avatarPath: string): string {
  return `${apiUrl()}${avatarPath}`;
}

/**
 * The address a person's photo is uploaded to.
 *
 * @param personId - Whose photo it is.
 * @returns The URL.
 */
export function avatarUploadUrl(personId: string): string {
  return `${apiUrl()}/avatars/${personId}`;
}

/** The path of the CardDAV root, which a contacts client is pointed at. */
const CARDDAV_PATH = '/dav/';

/**
 * The address a contacts app syncs with: the server's CardDAV root.
 *
 * @returns The URL, or only its path when the page's own address is not known.
 */
export function cardDavUrl(): string {
  const origin = apiUrl() || (globalThis.location?.origin ?? '');
  return `${origin}${CARDDAV_PATH}`;
}
