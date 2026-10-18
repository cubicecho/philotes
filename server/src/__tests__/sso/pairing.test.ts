import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAdmin } from '../../auth/admin.ts';
import { type AuthHost, createAuthHost } from '../../auth/auth-host.ts';
import { sessionUserId } from '../../auth/better-auth.ts';
import { ErrorCode } from '../../core/errors.ts';
import { HttpStatus } from '../../core/wire.ts';
import { mountSso, SSO_START_PATH } from '../../http/sso.ts';
import { PairingFailure, parseSetupUrl } from '../../sso/pairing.ts';
import { readPairedOidc, SsoSource } from '../../sso/settings.ts';
import {
  closeTestDb,
  createClient,
  createSessionToken,
  createTestDb,
  createUser,
  resetTestDb,
  TEST_SECRET,
  type TestDb,
} from '../helpers.ts';

// Pairing with a provider by pasting a setup URL, against a stand-in for
// heautou's Dynamic Client Registration: discovery naming a registration
// endpoint, registration on an initial access token (RFC 7591), and deleting
// the client on its registration access token (RFC 7592).

const SETUP = 'query { ssoSetup { source issuer name canPair redirectUri } }';
const PAIR = 'mutation ($url: String!) { pairSso(setupUrl: $url) { source name canPair } }';
const UNPAIR = 'mutation { unpairSso { source name } }';
const CONFIG = '{ authConfig { sso { name signInUrl } } }';

/** What the queries above answer. */
interface SsoSetupData {
  source: string;
  issuer: string | null;
  name: string | null;
  canPair: boolean;
  redirectUri: string;
}
type ConfigData = { authConfig: { sso: { name: string; signInUrl: string } | null } };
type SetupData = { ssoSetup: SsoSetupData };
type PairData = { pairSso: Partial<SsoSetupData> };
type UnpairData = { unpairSso: Partial<SsoSetupData> };

const TOKEN = 'iat-good';
const CLIENT_ID = 'philotes-client';
const CLIENT_SECRET = 'philotes-secret';
const RAT = 'rat-1';

interface FakeDcr {
  issuer: string;
  /** What discovery says the issuer is. Set to something else to forge it. */
  claimedIssuer: string;
  /** Whether discovery names a registration endpoint. */
  canRegister: boolean;
  /** What the next registration answers, when the token is good. */
  answer: 'created' | 'badRedirect' | 'rateLimited';
  /** Bodies and auth headers registration was called with. */
  registrations: { body: Record<string, unknown>; authorization: string | undefined }[];
  /** Auth headers the client was deleted with. */
  deletions: (string | undefined)[];
  /** What deleting answers. */
  deleteStatus: number;
  close(): Promise<void>;
}

/**
 * Listens on a free loopback port.
 *
 * @param server - The server to start.
 * @returns The origin it answers on.
 */
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/**
 * Stops a server, dropping its keep-alive connections.
 *
 * @param server - The server to stop.
 * @returns Once it has stopped.
 */
function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

/**
 * Starts the stand-in provider, ready to register one client.
 *
 * @returns The provider and what it was asked.
 */
async function startDcr(): Promise<FakeDcr> {
  const app = express();
  const server = createServer(app);
  const issuer = `${await listen(server)}/oidc`;
  const fake: FakeDcr = {
    issuer,
    claimedIssuer: issuer,
    canRegister: true,
    answer: 'created',
    registrations: [],
    deletions: [],
    deleteStatus: 204,
    close: () => close(server),
  };
  app.get('/oidc/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer: fake.claimedIssuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      ...(fake.canRegister ? { registration_endpoint: `${issuer}/reg` } : {}),
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
    });
  });
  app.post('/oidc/reg', express.json(), (req, res) => {
    fake.registrations.push({ body: req.body, authorization: req.headers.authorization });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.status(401).json({ error: 'invalid_token', error_description: 'invalid token provided' });
      return;
    }
    if (fake.answer === 'rateLimited') {
      res.status(429).json({ error: 'too_many_requests' });
      return;
    }
    if (fake.answer === 'badRedirect') {
      res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris must use https' });
      return;
    }
    res.status(201).json({
      ...req.body,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      registration_access_token: RAT,
      registration_client_uri: `${issuer}/reg/${CLIENT_ID}`,
    });
  });
  app.delete(`/oidc/reg/${CLIENT_ID}`, (req, res) => {
    fake.deletions.push(req.headers.authorization);
    res.status(fake.deleteStatus).end();
  });
  return fake;
}

let db: TestDb;
let dcr: FakeDcr;
let host: AuthHost;
let philotes: Server;
let appUrl: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await closeTestDb(db);
});

beforeEach(async () => {
  vi.stubEnv('OIDC_ISSUER', '');
  vi.stubEnv('OIDC_CLIENT_ID', '');
  await resetTestDb(db);
  dcr = await startDcr();
  const app = express();
  philotes = createServer(app);
  appUrl = await listen(philotes);
  // The redirect URI registered with the provider is built from SERVER_URL; the login page from APP_URL.
  vi.stubEnv('APP_URL', appUrl);
  vi.stubEnv('SERVER_URL', appUrl);
  host = await createAuthHost(db, { secret: TEST_SECRET });
  mountSso(app, host);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await close(philotes);
  await dcr.close();
});

/**
 * Makes a client on the real host, so pairing rebuilds what sign-in uses.
 *
 * @param [userId] - Who is calling. Nobody by default.
 * @returns The client.
 */
function client(userId: string | null = null) {
  return createClient(db, userId, { authHost: host });
}

/**
 * Builds the setup URL the stand-in provider would hand out.
 *
 * @param [token] - The initial access token. The good one by default.
 * @param [name] - What the provider calls itself.
 * @returns The URL.
 */
function setupUrl(token = TOKEN, name = 'heautou'): string {
  return `${dcr.issuer}#setup=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`;
}

/**
 * Pairs, expecting one error.
 *
 * @param url - The setup URL.
 * @param [userId] - Who is calling. Nobody by default.
 * @returns The error's message and extensions.
 */
async function pairError(url: string, userId: string | null = null) {
  const result = await client(userId).run(PAIR, { url });
  expect(result.errors).toHaveLength(1);
  const [error] = result.errors ?? [];
  return { message: error?.message, ...error?.extensions };
}

/**
 * Creates the instance's admin.
 *
 * @param email - Their address.
 * @returns Their id.
 */
async function makeAdmin(email: string): Promise<string> {
  const id = await createUser(db, email);
  await db.update(dbSchema.users).set({ isAdmin: true }).where(eq(dbSchema.users.id, id));
  return id;
}

describe('setup URLs', () => {
  it('takes the issuer, token and name apart', () => {
    expect(parseSetupUrl('https://id.example.com/oidc#setup=abc&name=heautou')).toEqual({
      issuer: 'https://id.example.com/oidc',
      token: 'abc',
      name: 'heautou',
    });
  });

  it('calls a provider with no name SSO', () => {
    expect(parseSetupUrl('https://id.example.com/oidc/#setup=abc').name).toBe('SSO');
  });

  it('refuses anything that is not a setup URL', () => {
    expect(() => parseSetupUrl('not a url')).toThrow(/not a URL/);
    expect(() => parseSetupUrl('https://id.example.com/oidc')).toThrow(/no setup token/);
    expect(() => parseSetupUrl('ftp://id.example.com/oidc#setup=abc')).toThrow(/https/);
  });
});

describe('pairSso', () => {
  it('registers Philotes and puts the button on the login page without a restart', async () => {
    expect((await client().expectOk<ConfigData>(CONFIG)).authConfig.sso).toBeNull();
    expect((await client().expectOk<SetupData>(SETUP)).ssoSetup).toMatchObject({
      source: SsoSource.None,
      canPair: true,
    });

    const data = await client().expectOk<PairData>(PAIR, { url: setupUrl() });
    expect(data.pairSso).toEqual({ source: SsoSource.Paired, name: 'heautou', canPair: true });

    expect(dcr.registrations).toHaveLength(1);
    const [registration] = dcr.registrations;
    expect(registration?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(registration?.body).toEqual({
      client_name: 'Philotes',
      redirect_uris: [`${appUrl}/api/auth/callback/oidc`],
      token_endpoint_auth_method: 'client_secret_basic',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    });

    expect(await readPairedOidc(db)).toMatchObject({
      issuer: dcr.issuer,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      name: 'heautou',
      registrationAccessToken: RAT,
      registrationClientUri: `${dcr.issuer}/reg/${CLIENT_ID}`,
    });
    expect((await client().expectOk<ConfigData>(CONFIG)).authConfig.sso).toEqual({
      name: 'heautou',
      signInUrl: `${appUrl}${SSO_START_PATH}`,
    });

    // The running server's sign-in now goes to the provider, as the new client.
    const start = await fetch(`${appUrl}${SSO_START_PATH}`, { redirect: 'manual' });
    expect(start.status).toBe(HttpStatus.Found);
    const authorize = new URL(start.headers.get('location') ?? '');
    expect(`${authorize.origin}${authorize.pathname}`).toBe(`${dcr.issuer}/auth`);
    expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID);
  });

  it('says a used or expired setup URL is spent, and keeps nothing', async () => {
    const error = await pairError(setupUrl('iat-used'));
    expect(error).toMatchObject({ code: ErrorCode.BadUserInput, reason: PairingFailure.Expired });
    expect(error.message).toMatch(/new one/);
    expect(await readPairedOidc(db)).toBeNull();
    expect(host.oidc()).toBeNull();
  });

  it('passes on why the provider refused the registration', async () => {
    dcr.answer = 'badRedirect';
    const error = await pairError(setupUrl());
    expect(error).toMatchObject({ code: ErrorCode.BadUserInput, reason: PairingFailure.Refused });
    expect(error.message).toMatch(/redirect_uris must use https/);
    expect(await readPairedOidc(db)).toBeNull();
  });

  it('says when the provider is rate limiting', async () => {
    dcr.answer = 'rateLimited';
    expect(await pairError(setupUrl())).toMatchObject({
      code: ErrorCode.TooManyRequests,
      reason: PairingFailure.RateLimited,
    });
  });

  it('refuses a discovery document that names another issuer, before sending the token', async () => {
    dcr.claimedIssuer = 'https://evil.example.com/oidc';
    expect(await pairError(setupUrl())).toMatchObject({
      code: ErrorCode.BadUserInput,
      reason: PairingFailure.NotAProvider,
    });
    expect(dcr.registrations).toHaveLength(0);
  });

  it('says when nothing answers at the URL', async () => {
    expect(await pairError('http://127.0.0.1:1/oidc#setup=abc')).toMatchObject({
      reason: PairingFailure.NotAProvider,
    });
  });

  it('says when the provider cannot pair', async () => {
    dcr.canRegister = false;
    expect(await pairError(setupUrl())).toMatchObject({ reason: PairingFailure.NoRegistration });
  });

  it('will not pair over an existing pairing', async () => {
    await client().expectOk<PairData>(PAIR, { url: setupUrl() });
    expect(await pairError(setupUrl())).toMatchObject({ code: ErrorCode.Conflict });
  });

  it('signs nobody out, even with sessions kept in memory', async () => {
    vi.stubEnv('SESSION_STORE', 'memory');
    const memoryHost = await createAuthHost(db, { secret: TEST_SECRET });
    const admin = await makeAdmin('admin@example.com');
    const token = await createSessionToken(memoryHost.current(), admin);
    const headers = new Headers({ authorization: `Bearer ${token}` });

    await createClient(db, admin, { authHost: memoryHost }).expectOk<PairData>(PAIR, { url: setupUrl() });
    expect(await sessionUserId(memoryHost.current(), headers)).toBe(admin);
  });
});

describe('who may pair', () => {
  it('is anyone while there are no accounts', async () => {
    expect((await client().expectOk<SetupData>(SETUP)).ssoSetup.canPair).toBe(true);
  });

  it('is only the admin once anyone has an account', async () => {
    const admin = await makeAdmin('admin@example.com');
    const member = await createUser(db, 'member@example.com');

    expect((await client().expectOk<SetupData>(SETUP)).ssoSetup).toMatchObject({ canPair: false, issuer: null });
    expect((await client(member).expectOk<SetupData>(SETUP)).ssoSetup.canPair).toBe(false);
    expect((await client(admin).expectOk<SetupData>(SETUP)).ssoSetup.canPair).toBe(true);

    expect(await pairError(setupUrl())).toMatchObject({ code: ErrorCode.Forbidden });
    expect(await pairError(setupUrl(), member)).toMatchObject({ code: ErrorCode.Forbidden });
    expect(dcr.registrations).toHaveLength(0);

    await client(admin).expectOk<PairData>(PAIR, { url: setupUrl() });
    expect((await client(admin).expectOk<SetupData>(SETUP)).ssoSetup).toMatchObject({
      source: SsoSource.Paired,
      issuer: dcr.issuer,
    });
  });

  it('is nobody when the environment names the provider, which wins', async () => {
    vi.stubEnv('OIDC_ISSUER', 'https://env.example.com/oidc');
    vi.stubEnv('OIDC_CLIENT_ID', 'env-client');
    vi.stubEnv('OIDC_NAME', 'Corp SSO');
    const admin = await makeAdmin('admin@example.com');

    expect((await client(admin).expectOk<SetupData>(SETUP)).ssoSetup).toMatchObject({
      source: SsoSource.Env,
      name: 'Corp SSO',
      canPair: false,
    });
    expect((await client(admin).expectOk<ConfigData>(CONFIG)).authConfig.sso?.name).toBe('Corp SSO');
    expect(await pairError(setupUrl(), admin)).toMatchObject({ code: ErrorCode.Forbidden });
  });

  const TEST_SOURCE = { method: 'test' };

  it('makes the first account better-auth creates the admin, and no other', async () => {
    const internal = (await host.current().$context).internalAdapter;
    const first = await internal.createUser(
      { email: 'first@example.com', name: 'first', emailVerified: true },
      TEST_SOURCE,
    );
    const second = await internal.createUser(
      { email: 'second@example.com', name: 'second', emailVerified: true },
      TEST_SOURCE,
    );
    expect(await isAdmin(db, first.id)).toBe(true);
    expect(await isAdmin(db, second.id)).toBe(false);
  });
});

describe('unpairSso', () => {
  it('deletes the client at the provider and takes the button away', async () => {
    const admin = await makeAdmin('admin@example.com');
    await client(admin).expectOk<PairData>(PAIR, { url: setupUrl() });
    expect(host.oidc()).not.toBeNull();

    const data = await client(admin).expectOk<UnpairData>(UNPAIR);
    expect(data.unpairSso).toEqual({ source: SsoSource.None, name: null });
    expect(dcr.deletions).toEqual([`Bearer ${RAT}`]);
    expect(await readPairedOidc(db)).toBeNull();
    expect(host.oidc()).toBeNull();
    expect((await client(admin).expectOk<ConfigData>(CONFIG)).authConfig.sso).toBeNull();

    // With nothing paired, the sign-in route sends the browser back to the login page.
    const start = await fetch(`${appUrl}${SSO_START_PATH}`, { redirect: 'manual' });
    expect(new URL(start.headers.get('location') ?? '').searchParams.get('error')).toBe('sso_off');
  });

  it('counts a client the provider already removed as gone', async () => {
    const admin = await makeAdmin('admin@example.com');
    await client(admin).expectOk<PairData>(PAIR, { url: setupUrl() });
    dcr.deleteStatus = 401;
    await client(admin).expectOk<UnpairData>(UNPAIR);
    expect(await readPairedOidc(db)).toBeNull();
  });

  it('forgets the pairing even when the provider will not delete the client', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const admin = await makeAdmin('admin@example.com');
    await client(admin).expectOk<PairData>(PAIR, { url: setupUrl() });
    dcr.deleteStatus = 500;
    await client(admin).expectOk<UnpairData>(UNPAIR);
    expect(await readPairedOidc(db)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[auth]'));
  });

  it('is the admin’s once anyone has an account', async () => {
    await client().expectOk<PairData>(PAIR, { url: setupUrl() });
    const member = await createUser(db, 'member@example.com');
    const result = await client(member).run(UNPAIR);
    expect(result.errors?.[0]?.extensions?.code).toBe(ErrorCode.Forbidden);
    expect(await readPairedOidc(db)).not.toBeNull();
  });
});
