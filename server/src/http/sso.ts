import type { Express, Request, Response } from 'express';
import type { AuthHost } from '../auth/auth-host.ts';
import type { Auth } from '../auth/better-auth.ts';
import { appUrl, OIDC_PROVIDER_ID, serverUrl } from '../core/config.ts';
import { HttpStatus } from '../core/wire.ts';

// The two legs of an OIDC sign-in that cannot be GraphQL, because the browser
// has to be sent somewhere: out to the provider, and back from it. Both are
// better-auth's own endpoints (`signInSocial` and `/callback/:id`); this file
// only carries them over HTTP and changes how the session reaches the app.
//
// better-auth would end the callback by setting a session cookie. Philotes keeps
// its session as a bearer token in the app instead, so the cookie is dropped
// and the browser lands on /auth/sso with a one-time token, which the app swaps
// for the session over GraphQL (`verifyOneTimeToken`).

/** Where the login page's button sends the browser. */
export const SSO_START_PATH = `/sso/${OIDC_PROVIDER_ID}`;
/** Where the provider sends the browser back: better-auth's callback, at its default base path. */
export const SSO_CALLBACK_PATH = `/api/auth/callback/${OIDC_PROVIDER_ID}`;

/** The app's page that spends the one-time token. */
const SIGNED_IN_PATH = '/auth/sso';
/** The login page, which reads `?error=` and says signing in failed. */
const FAILED_PATH = '/login';

/** What the login page is told when something here went wrong before better-auth could say what. */
const SsoError = {
  SignInFailed: 'sign_in_failed',
  CallbackFailed: 'callback_failed',
  /** No provider: none was ever set, or it was disconnected after the login page loaded. */
  Off: 'sso_off',
} as const;
type SsoError = (typeof SsoError)[keyof typeof SsoError];

/**
 * Mounts the start and callback routes.
 *
 * @param app - The Express app. Mount before the static handler, whose fallback would answer both.
 * @param host - Where the current auth instance is. With no provider, both routes send the browser
 *   back to the login page.
 */
export function mountSso(app: Express, host: AuthHost): void {
  app.get(SSO_START_PATH, (req, res) => {
    if (host.oidc() === null) {
      off(res);
      return;
    }
    start(host.current(), req, res).catch((error: unknown) => fail(res, SsoError.SignInFailed, error));
  });
  app.get(SSO_CALLBACK_PATH, (req, res) => {
    if (host.oidc() === null) {
      off(res);
      return;
    }
    callback(host.current(), req, res).catch((error: unknown) => fail(res, SsoError.CallbackFailed, error));
  });
}

/**
 * Copies Express's headers into fetch `Headers`, which better-auth reads cookies from.
 *
 * @param raw - The request's headers as Express parsed them.
 * @returns The same headers, repeated ones appended.
 */
function toHeaders(raw: Request['headers']): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) {
      continue;
    }
    for (const one of Array.isArray(value) ? value : [value]) {
      headers.append(name, one);
    }
  }
  return headers;
}

/**
 * Starts a sign-in. better-auth makes the state (with a signed cookie that ties it to this
 * browser), the PKCE verifier and the nonce, and says where the provider's authorize page is.
 *
 * @param auth - The current auth instance.
 * @param req - The browser's request.
 * @param res - Answered with a redirect to the provider.
 */
async function start(auth: Auth, req: Request, res: Response): Promise<void> {
  const { headers, response } = await auth.api.signInSocial({
    body: {
      provider: OIDC_PROVIDER_ID,
      callbackURL: `${appUrl()}${SIGNED_IN_PATH}`,
      errorCallbackURL: `${appUrl()}${FAILED_PATH}`,
      disableRedirect: true,
    },
    headers: toHeaders(req.headers),
    returnHeaders: true,
  });
  const url = response && 'url' in response ? response.url : undefined;
  if (!url) {
    throw new Error('better-auth returned no authorize URL');
  }
  for (const cookie of headers?.getSetCookie() ?? []) {
    res.append('set-cookie', cookie);
  }
  res.redirect(HttpStatus.Found, url);
}

/**
 * The provider's redirect back. better-auth checks the state, swaps the code, verifies the id
 * token and opens a session; this then swaps the session cookie it would have set for a one-time
 * token on the app's URL.
 *
 * @param auth - The current auth instance.
 * @param req - The provider's redirect, as the browser followed it.
 * @param res - Answered with a redirect to the app.
 */
async function callback(auth: Auth, req: Request, res: Response): Promise<void> {
  // The callback is this server's, which in development is not the app's origin.
  const request = new Request(new URL(req.originalUrl, serverUrl()), {
    method: 'GET',
    headers: toHeaders(req.headers),
  });
  const response = await auth.handler(request);
  const ctx = await auth.$context;
  const sessionCookies = new Set([ctx.authCookies.sessionToken.name, ctx.authCookies.sessionData.name]);

  // The state cookie's expiry, and anything else that is not the session.
  for (const cookie of response.headers.getSetCookie()) {
    const isSessionCookie = sessionCookies.has(cookie.slice(0, cookie.indexOf('=')));
    if (isSessionCookie === false) {
      res.append('set-cookie', cookie);
    }
  }

  const location = response.headers.get('location');
  if (!location) {
    fail(
      res,
      SsoError.CallbackFailed,
      new Error(`better-auth's callback answered ${response.status} with no redirect`),
    );
    return;
  }

  // The bearer plugin sets this whenever a session cookie is: the new session.
  const session = response.headers.get('set-auth-token');
  if (!session) {
    // A refusal: better-auth is sending the browser to the login page with its error code.
    res.redirect(HttpStatus.Found, location);
    return;
  }
  const { token } = await auth.api.generateOneTimeToken({
    headers: new Headers({ authorization: `Bearer ${session}` }),
  });
  const target = new URL(location, appUrl());
  target.searchParams.set('token', token);
  res.redirect(HttpStatus.Found, target.toString());
}

/**
 * Sends the browser back to the login page, which says there is no provider to sign in with.
 *
 * @param res - Answered with the redirect.
 */
function off(res: Response): void {
  res.redirect(HttpStatus.Found, `${appUrl()}${FAILED_PATH}?error=${SsoError.Off}`);
}

/**
 * Logs a failure and sends the browser back to the login page, which says that signing in failed.
 *
 * @param res - Answered with the redirect, unless something was already sent.
 * @param code - What the login page is told.
 * @param error - What went wrong, for the log.
 */
function fail(res: Response, code: SsoError, error: unknown): void {
  console.error(`[auth] OIDC ${code}:`, error);
  if (res.headersSent) {
    return;
  }
  res.redirect(HttpStatus.Found, `${appUrl()}${FAILED_PATH}?error=${encodeURIComponent(code)}`);
}
