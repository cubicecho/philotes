import type { DB } from '@cubicecho/philotes-db';
import { oidcRedirectUri } from '../core/config.ts';
import { AUTH_DEFAULTS } from '../core/defaults.ts';
import { HttpStatus } from '../core/wire.ts';
import { clearPairedOidc, type PairedOidc, readPairedOidc, savePairedOidc } from './settings.ts';

// Pairing with an OIDC provider by pasting one URL, instead of copying a client
// id and secret into the environment. The provider (heautou, or any other that
// does OAuth 2.0 Dynamic Client Registration) hands its admin a setup URL:
//
//   <issuer>#setup=<initial access token>&name=<what to call it>
//
// Philotes reads the issuer's discovery document, registers itself at its
// registration endpoint with the token (RFC 7591), and keeps the client it gets
// back. Unpairing deletes that client at the provider (RFC 7592).
//
// The token is a credential: it is sent once, to the endpoint the issuer names,
// and never logged or stored.

/** Why pairing failed, for the app to say what to do next. Sent as `extensions.reason`. */
export const PairingFailure = {
  /** The text is not a setup URL. */
  BadUrl: 'BAD_URL',
  /** Nothing at the URL answers as an OIDC provider, or it names a different issuer. */
  NotAProvider: 'NOT_A_PROVIDER',
  /** The provider has no registration endpoint. */
  NoRegistration: 'NO_REGISTRATION',
  /** The setup URL has expired, was used already, or was cancelled. */
  Expired: 'EXPIRED',
  /** The provider would not register Philotes as described. */
  Refused: 'REFUSED',
  /** The provider is turning requests away for now. */
  RateLimited: 'RATE_LIMITED',
} as const;
/** One of the values in `PairingFailure`. */
export type PairingFailure = (typeof PairingFailure)[keyof typeof PairingFailure];

/** A pairing that did not happen, and why. */
export class PairingError extends Error {
  readonly reason: PairingFailure;

  constructor(reason: PairingFailure, message: string) {
    super(message);
    this.name = 'PairingError';
    this.reason = reason;
  }
}

/** A setup URL, taken apart. */
export interface SetupUrl {
  issuer: string;
  token: string;
  name: string;
}

/** What Philotes asks the provider to call it. */
const CLIENT_NAME = 'Philotes';

/**
 * Takes a setup URL apart.
 *
 * @param text - What was pasted.
 * @returns The issuer, the initial access token and the provider's name.
 * @throws A `PairingError` (BAD_URL) when it is not a setup URL.
 */
export function parseSetupUrl(text: string): SetupUrl {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    throw new PairingError(PairingFailure.BadUrl, 'That is not a URL. Paste the setup URL your provider gave you.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new PairingError(PairingFailure.BadUrl, 'A setup URL starts with https://.');
  }
  const params = new URLSearchParams(url.hash.slice(1));
  const token = params.get('setup');
  if (!token) {
    throw new PairingError(
      PairingFailure.BadUrl,
      'That URL has no setup token. Copy the whole setup URL from your provider.',
    );
  }
  url.hash = '';
  url.search = '';
  return {
    issuer: url.toString().replace(/\/+$/, ''),
    token,
    name: params.get('name')?.trim() || AUTH_DEFAULTS.oidcName,
  };
}

/** Fetches with a timeout, calling any network failure the provider being unreachable. */
async function call(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(AUTH_DEFAULTS.oidcPairingTimeoutMs) });
  } catch {
    throw new PairingError(PairingFailure.NotAProvider, `Could not reach ${new URL(url).origin}. Check the setup URL.`);
  }
}

/** The body of a JSON response, or an empty object when it has none. */
async function json(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The issuer's registration endpoint, once its discovery document has been checked as the issuer's own. */
async function discover(issuer: string): Promise<string> {
  const response = await call(`${issuer}/.well-known/openid-configuration`, {
    headers: { accept: 'application/json' },
  });
  const doc = response.ok ? await json(response) : {};
  // A document naming another issuer would have the token sent wherever it says.
  if (text(doc.issuer)?.replace(/\/+$/, '') !== issuer) {
    throw new PairingError(
      PairingFailure.NotAProvider,
      `${issuer} is not an OpenID Connect provider. Check the setup URL.`,
    );
  }
  const endpoint = text(doc.registration_endpoint);
  if (endpoint === null) {
    throw new PairingError(
      PairingFailure.NoRegistration,
      'This provider does not support pairing. Set OIDC_ISSUER and OIDC_CLIENT_ID in the environment instead.',
    );
  }
  return endpoint;
}

/** What Philotes asks to be registered as. */
function clientMetadata() {
  return {
    client_name: CLIENT_NAME,
    redirect_uris: [oidcRedirectUri()],
    token_endpoint_auth_method: 'client_secret_basic',
    grant_types: ['authorization_code'],
    response_types: ['code'],
  };
}

/** Turns a failed registration call into what to tell the admin. */
async function refusal(response: Response): Promise<PairingError> {
  const body = await json(response);
  const description = text(body.error_description) ?? text(body.error);
  if (response.status === HttpStatus.Unauthorized || body.error === 'invalid_token') {
    return new PairingError(
      PairingFailure.Expired,
      'This setup URL has expired, was used already, or was cancelled. Ask your provider for a new one.',
    );
  }
  if (response.status === HttpStatus.TooManyRequests) {
    return new PairingError(
      PairingFailure.RateLimited,
      'The provider is turning requests away for now. Try again in a minute.',
    );
  }
  if (response.status === HttpStatus.BadRequest) {
    return new PairingError(
      PairingFailure.Refused,
      `The provider refused to register ${CLIENT_NAME}: ${description ?? 'no reason given'}.`,
    );
  }
  return new PairingError(
    PairingFailure.NotAProvider,
    `The provider answered ${response.status} when asked to register ${CLIENT_NAME}.`,
  );
}

/**
 * Registers Philotes with the provider a setup URL names, and keeps the client.
 *
 * @param db - The database.
 * @param setupUrl - What the admin pasted.
 * @returns The pairing as saved. The caller rebuilds the auth instance (auth/auth-host.ts) to use it.
 * @throws A `PairingError` saying why, when nothing was paired.
 */
export async function pair(db: DB, setupUrl: string): Promise<PairedOidc> {
  const setup = parseSetupUrl(setupUrl);
  const endpoint = await discover(setup.issuer);
  const response = await call(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${setup.token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(clientMetadata()),
  });
  if (response.ok === false) {
    throw await refusal(response);
  }
  const body = await json(response);
  const clientId = text(body.client_id);
  if (clientId === null) {
    throw new PairingError(
      PairingFailure.NotAProvider,
      `The provider registered ${CLIENT_NAME} but sent back no client id.`,
    );
  }
  const paired: PairedOidc = {
    issuer: setup.issuer,
    clientId,
    clientSecret: text(body.client_secret),
    // The provider may have registered another method than the one asked for; its answer is what counts.
    clientAuth: body.token_endpoint_auth_method === 'client_secret_post' ? 'client_secret_post' : 'client_secret_basic',
    name: setup.name,
    registrationAccessToken: text(body.registration_access_token),
    registrationClientUri: text(body.registration_client_uri),
  };
  await savePairedOidc(db, paired);
  return paired;
}

/**
 * Deletes Philotes's client at the provider and forgets the pairing.
 *
 * @param db - The database.
 * @returns Whether the provider confirmed the client is gone.
 *
 * @remarks
 * The pairing is forgotten even when the provider cannot be reached, so an admin is never stuck
 * with a provider they want gone; the provider's admin can remove the client on their side.
 */
export async function unpair(db: DB): Promise<boolean> {
  const paired = await readPairedOidc(db);
  if (paired === null) {
    return true;
  }
  let removed = false;
  if (paired.registrationClientUri && paired.registrationAccessToken) {
    try {
      const response = await fetch(paired.registrationClientUri, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${paired.registrationAccessToken}` },
        signal: AbortSignal.timeout(AUTH_DEFAULTS.oidcPairingTimeoutMs),
      });
      // A 401 or a 404: the client is already gone, which is what was wanted.
      removed = response.ok || response.status === HttpStatus.Unauthorized || response.status === HttpStatus.NotFound;
      if (removed === false) {
        console.warn(`[auth] OIDC provider answered ${response.status} to deleting the client`);
      }
    } catch (error) {
      console.warn('[auth] could not reach the OIDC provider to delete the client:', error);
    }
  }
  await clearPairedOidc(db);
  return removed;
}
