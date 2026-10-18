import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixedAuthHost } from '../../auth/auth-host.ts';
import type { Auth } from '../../auth/better-auth.ts';
import { createRateLimiter } from '../../auth/rate-limit.ts';
import type { OidcConfig } from '../../core/config.ts';
import { ErrorCode } from '../../core/errors.ts';
import { HttpStatus } from '../../core/wire.ts';
import { createApp } from '../../http/app.ts';
import { SSO_CALLBACK_PATH, SSO_START_PATH } from '../../http/sso.ts';
import {
  closeTestDb,
  createClient,
  createTestAuth,
  createTestDb,
  createUser,
  resetTestDb,
  type TestDb,
} from '../helpers.ts';

// The whole OIDC sign-in through the real app, against a stand-in provider that
// does what heautou (oidc-provider) does: discovery, a JWKS, a code flow with a
// client secret in a Basic header, PKCE, and a signed id token carrying the nonce.

const VERIFY = 'mutation ($token: String!) { verifyOneTimeToken(token: $token) { token user { id } } }';
const CONFIG = '{ authConfig { sso { name signInUrl } } }';
/** What CONFIG answers. */
type ConfigData = { authConfig: { sso: { name: string; signInUrl: string } | null } };
const CLIENT_ID = 'philotes';
const CLIENT_SECRET = 'philotes-secret';

interface Profile {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

interface FakeProvider {
  issuer: string;
  /** Who the next sign-in is. */
  profile: Profile;
  /** Plays the browser at the authorize endpoint: the code and state it would be sent back with. */
  authorize(url: string): { code: string; state: string };
  close(): Promise<void>;
}

/**
 * Listens on a free loopback port.
 *
 * @param app - What to serve.
 * @returns The server, and the origin it answers on.
 */
async function listen(app: express.Express): Promise<{ server: Server; origin: string }> {
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/**
 * Stops a server.
 *
 * @param server - The server to stop.
 * @returns Once it has stopped.
 */
function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Starts the stand-in provider on a port of its own.
 *
 * @returns The provider, signing the next sign-in in as Ada.
 */
async function startProvider(): Promise<FakeProvider> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, { nonce: string; challenge: string; redirectUri: string; profile: Profile }>();
  const app = express();
  const { server, origin } = await listen(app);
  const issuer = `${origin}/oidc`;
  const provider: FakeProvider = {
    issuer,
    profile: { sub: 'u1', email: 'ada@example.com', name: 'Ada' },
    authorize(url) {
      const params = new URL(url).searchParams;
      expect(params.get('client_id')).toBe(CLIENT_ID);
      expect(params.get('scope')?.split(' ')).toEqual(expect.arrayContaining(['openid', 'email', 'profile']));
      expect(params.get('code_challenge_method')).toBe('S256');
      const code = randomUUID();
      codes.set(code, {
        nonce: params.get('nonce') ?? '',
        challenge: params.get('code_challenge') ?? '',
        redirectUri: params.get('redirect_uri') ?? '',
        profile: provider.profile,
      });
      return { code, state: params.get('state') ?? '' };
    },
    close: () => close(server),
  };

  app.get('/oidc/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/me`,
      jwks_uri: `${issuer}/jwks`,
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
    });
  });
  app.get('/oidc/jwks', (_req, res) => {
    res.json({ keys: [jwk] });
  });
  app.post('/oidc/token', express.urlencoded({ extended: false }), async (req, res) => {
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    if (req.headers.authorization !== `Basic ${basic}`) {
      res.status(401).json({ error: 'invalid_client' });
      return;
    }
    const grant = codes.get(req.body.code);
    codes.delete(req.body.code);
    const challenge = createHash('sha256').update(String(req.body.code_verifier)).digest('base64url');
    if (!grant || grant.challenge !== challenge || grant.redirectUri !== req.body.redirect_uri) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    const { profile } = grant;
    const idToken = await new SignJWT({
      ...profile,
      email_verified: profile.email ? true : undefined,
      nonce: grant.nonce,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(issuer)
      .setAudience(CLIENT_ID)
      .setSubject(profile.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    res.json({ access_token: `at-${profile.sub}`, token_type: 'Bearer', expires_in: 300, id_token: idToken });
  });
  app.get('/oidc/me', (req, res) => {
    const sub = String(req.headers.authorization).replace('Bearer at-', '');
    const profile = sub === provider.profile.sub ? provider.profile : null;
    res.json(profile ? { ...profile, email_verified: Boolean(profile.email) } : {});
  });
  return provider;
}

let db: TestDb;
let provider: FakeProvider;
let auth: Auth;
let philotes: Server;
let appUrl: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await closeTestDb(db);
});

beforeEach(async () => {
  await resetTestDb(db);
  provider = await startProvider();
  // Logged refusals are expected here; keep them out of the run's output.
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // createApp builds the routes before it is listening, and APP_URL has to name
  // the port it ends up on, so the app is mounted into an outer one.
  const outer = express();
  ({ server: philotes, origin: appUrl } = await listen(outer));
  // One origin for both: better-auth builds its callback from SERVER_URL, and http/sso.ts the app's pages from APP_URL.
  vi.stubEnv('APP_URL', appUrl);
  vi.stubEnv('SERVER_URL', appUrl);

  const oidc: OidcConfig = {
    issuer: provider.issuer,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    clientAuth: 'client_secret_basic',
    name: 'heautou',
  };
  auth = createTestAuth(db, oidc).auth;
  const authHost = fixedAuthHost(auth, oidc);
  // With a built client, so a route missing here would be answered by its SPA fallback, not a 404.
  const staticDir = await mkdtemp(join(tmpdir(), 'philotes-sso-'));
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>Philotes</title>');
  outer.use(createApp({ db, authHost, limiter: createRateLimiter(), staticDir }));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await close(philotes);
  await provider.close();
});

/**
 * Reads the cookies a response set, as a request's Cookie header.
 *
 * @param response - The response.
 * @returns The header value.
 */
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/**
 * Walks the browser through a sign-in: the start route, the provider, the callback.
 *
 * @param [tamper] - Changes the provider's redirect before the browser follows it.
 * @returns Where the callback sent the browser, and the callback's response.
 */
async function signIn(tamper?: (callback: URL) => void): Promise<{ location: URL; callback: Response }> {
  const start = await fetch(`${appUrl}${SSO_START_PATH}`, { redirect: 'manual' });
  expect(start.status).toBe(HttpStatus.Found);
  const authorizeUrl = start.headers.get('location') ?? '';
  expect(authorizeUrl.startsWith(`${provider.issuer}/auth?`)).toBe(true);
  expect(new URL(authorizeUrl).searchParams.get('redirect_uri')).toBe(`${appUrl}${SSO_CALLBACK_PATH}`);

  const { code, state } = provider.authorize(authorizeUrl);
  const back = new URL(`${appUrl}${SSO_CALLBACK_PATH}`);
  back.searchParams.set('code', code);
  back.searchParams.set('state', state);
  back.searchParams.set('iss', provider.issuer);
  tamper?.(back);
  const callback = await fetch(back, { redirect: 'manual', headers: { cookie: cookiesFrom(start) } });
  expect(callback.status).toBe(HttpStatus.Found);
  return { location: new URL(callback.headers.get('location') ?? ''), callback };
}

/**
 * Swaps a one-time token for a session, as the app's /auth/sso page does.
 *
 * @param token - The token from the callback's redirect.
 * @returns The GraphQL result.
 */
function verify(token: string) {
  return createClient(db, null, { auth }).run(VERIFY, { token });
}

/**
 * Asks better-auth whose a bearer session is.
 *
 * @param token - The session token.
 * @returns The user id, or undefined for no session.
 */
async function sessionUserId(token: string): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
  return session?.user.id;
}

/**
 * Reads a user's name straight from the database.
 *
 * @param id - The user.
 * @returns The name, or null when it has none.
 */
async function nameOf(id: string): Promise<string | null> {
  const [user] = await db.query.users.findMany({ where: { id }, columns: { name: true } });
  return user?.name ?? null;
}

type Verified = { verifyOneTimeToken: { token: string; user: { id: string } } };

describe('OIDC sign-in', () => {
  it('lands on /auth/sso with a one-time token the app swaps for a session', async () => {
    const { location, callback } = await signIn();
    expect(location.origin + location.pathname).toBe(`${appUrl}/auth/sso`);
    // The session goes to the app as a bearer token, never as a cookie.
    expect(callback.headers.getSetCookie().some((cookie) => cookie.includes('session_token'))).toBe(false);

    const token = location.searchParams.get('token') ?? '';
    const result = await verify(token);
    expect(result.errors).toBeUndefined();
    const session = (result.data as Verified).verifyOneTimeToken;
    expect(await sessionUserId(session.token)).toBe(session.user.id);
    expect(await nameOf(session.user.id)).toBe('Ada');

    // Spent, and a spent token is bad input, not a signed-out session.
    await createClient(db, null, { auth }).expectError(ErrorCode.BadUserInput, VERIFY, { token });
  });

  it('signs an existing account in by the address the provider vouches for', async () => {
    const existing = await createUser(db, 'ada@example.com');
    const { location } = await signIn();
    const result = await verify(location.searchParams.get('token') ?? '');
    expect((result.data as Verified).verifyOneTimeToken.user.id).toBe(existing);
  });

  it('names a new account from the username when there is no name', async () => {
    provider.profile = { sub: 'u2', email: 'bob@example.com', preferred_username: 'bob' };
    const { location } = await signIn();
    const result = await verify(location.searchParams.get('token') ?? '');
    expect(await nameOf((result.data as Verified).verifyOneTimeToken.user.id)).toBe('bob');
  });

  it('sends a user with no address back to the login page', async () => {
    provider.profile = { sub: 'u3', name: 'No Mail' };
    const { location } = await signIn();
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBeTruthy();
    expect(location.searchParams.get('token')).toBeNull();
  });

  it('refuses a callback whose state does not match', async () => {
    const { location } = await signIn((back) => back.searchParams.set('state', 'forged'));
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBeTruthy();
    expect(location.searchParams.get('token')).toBeNull();
  });
});

describe('authConfig.sso', () => {
  it('is null without a provider', async () => {
    vi.stubEnv('OIDC_ISSUER', '');
    vi.stubEnv('OIDC_CLIENT_ID', '');
    const data = await createClient(db, null).expectOk<ConfigData>(CONFIG);
    expect(data.authConfig.sso).toBeNull();
  });

  it('names the provider and where to start', async () => {
    vi.stubEnv('OIDC_ISSUER', provider.issuer);
    vi.stubEnv('OIDC_CLIENT_ID', CLIENT_ID);
    vi.stubEnv('OIDC_NAME', 'heautou');
    const data = await createClient(db, null).expectOk<ConfigData>(CONFIG);
    expect(data.authConfig.sso).toEqual({ name: 'heautou', signInUrl: `${appUrl}${SSO_START_PATH}` });
  });
});
