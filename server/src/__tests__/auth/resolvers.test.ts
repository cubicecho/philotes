import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth, MagicLink } from '../../auth/better-auth.ts';
import { createAuth } from '../../auth/better-auth.ts';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createTestAuth, createTestDb, TEST_SECRET, type TestDb } from '../helpers.ts';

const EMAIL = 'ada@example.com';
const PASSWORD = 'correct horse battery';
const SIGN_UP = `mutation ($email: String!, $password: String!, $name: String!) {
  signUp(email: $email, password: $password, name: $name) { token user { id email name createdAt } }
}`;
const SIGN_IN = `mutation ($email: String!, $password: String!) {
  signIn(email: $email, password: $password) { token user { id } }
}`;
const REQUEST_SIGN_IN = `mutation ($email: String!) {
  requestSignIn(email: $email) { sent session { token user { id email name } } }
}`;
const VERIFY = 'mutation ($token: String!) { verifyMagicLink(token: $token) { token user { id email } } }';
const SIGN_OUT = 'mutation { signOut }';
const AUTH_CONFIG = '{ authConfig { secureLocalNet magicLink password } }';
const ME = '{ me { id email } }';

interface Session {
  token: string;
  user: { id: string; email: string; name: string; createdAt: string };
}

/** A fresh database and a password hash per test take longer than the default allows on a busy machine. */
const SLOW_TEST_MS = 20_000;

describe('auth resolvers', { timeout: SLOW_TEST_MS }, () => {
  let db: TestDb;
  let auth: Auth;
  let links: MagicLink[];

  /**
   * Resolves a bearer token the way the handler does.
   *
   * @param token - A session token.
   * @returns The user's id, or null when the token opens no session.
   */
  async function userIdOf(token: string): Promise<string | null> {
    const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
    return session?.user.id ?? null;
  }

  beforeEach(async () => {
    db = await createTestDb();
    ({ auth, links } = createTestAuth(db));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signs up, then signs in, and both tokens open the account', async () => {
    const client = createClient(db, null, { auth });

    const { signUp } = await client.expectOk<{ signUp: Session }>(SIGN_UP, {
      email: ' Ada@Example.com ',
      password: PASSWORD,
      name: 'Ada',
    });
    const { signIn } = await client.expectOk<{ signIn: Session }>(SIGN_IN, { email: EMAIL, password: PASSWORD });

    expect(signUp.user).toMatchObject({ email: EMAIL, name: 'Ada' });
    expect(Number.isNaN(new Date(signUp.user.createdAt).getTime())).toBe(false);
    expect(await userIdOf(signUp.token)).toBe(signUp.user.id);
    expect(await userIdOf(signIn.token)).toBe(signUp.user.id);
    const { me } = await createClient(db, signUp.user.id, { auth }).expectOk<{ me: { email: string } }>(ME);
    expect(me.email).toBe(EMAIL);
  });

  it('answers a wrong password and an unknown account the same', async () => {
    const client = createClient(db, null, { auth });
    await client.expectOk(SIGN_UP, { email: EMAIL, password: PASSWORD, name: 'Ada' });

    const wrong = await client.expectError(ErrorCode.Unauthenticated, SIGN_IN, { email: EMAIL, password: 'nope-nope' });
    const unknown = await client.expectError(ErrorCode.Unauthenticated, SIGN_IN, {
      email: 'nobody@example.com',
      password: PASSWORD,
    });

    expect(unknown.message).toBe(wrong.message);
  });

  it('refuses a sign-up with a bad email, an empty name or a short password', async () => {
    const client = createClient(db, null, { auth });

    await client.expectError(ErrorCode.BadUserInput, SIGN_UP, { email: 'not-an-email', password: PASSWORD, name: 'A' });
    await client.expectError(ErrorCode.BadUserInput, SIGN_UP, { email: EMAIL, password: PASSWORD, name: '  ' });
    await client.expectError(ErrorCode.BadUserInput, SIGN_UP, { email: EMAIL, password: 'short', name: 'A' });
  });

  it('emails a link that signs in once', async () => {
    const client = createClient(db, null, { auth });

    const { requestSignIn } = await client.expectOk<{ requestSignIn: { sent: boolean; session: null } }>(
      REQUEST_SIGN_IN,
      { email: EMAIL },
    );
    const [link] = links;
    const { verifyMagicLink } = await client.expectOk<{ verifyMagicLink: Session }>(VERIFY, { token: link.token });

    expect(requestSignIn).toEqual({ sent: true, session: null });
    expect(link.email).toBe(EMAIL);
    expect(link.url).toContain(`/auth/verify?token=${link.token}`);
    expect(verifyMagicLink.user.email).toBe(EMAIL);
    expect(await userIdOf(verifyMagicLink.token)).toBe(verifyMagicLink.user.id);
    await client.expectError(ErrorCode.Unauthenticated, VERIFY, { token: link.token });
  });

  it('refuses a link token nobody was sent', async () => {
    await createClient(db, null, { auth }).expectError(ErrorCode.Unauthenticated, VERIFY, { token: 'made-up' });
  });

  it('offers no magic link when there is no way to deliver one', async () => {
    const client = createClient(db, null, { auth: createAuth(db, { secret: TEST_SECRET }) });

    const { authConfig } = await client.expectOk<{ authConfig: Record<string, boolean> }>(AUTH_CONFIG);

    expect(authConfig).toEqual({ secureLocalNet: false, magicLink: false, password: true });
    await client.expectError(ErrorCode.BadUserInput, REQUEST_SIGN_IN, { email: EMAIL });
  });

  it('signs any email in at once under SECURE_LOCAL_NET, and sends nothing', async () => {
    vi.stubEnv('SECURE_LOCAL_NET', 'true');
    const client = createClient(db, null, { auth });

    const first = await client.expectOk<{ requestSignIn: { sent: boolean; session: Session } }>(REQUEST_SIGN_IN, {
      email: EMAIL,
    });
    const second = await client.expectOk<{ requestSignIn: { sent: boolean; session: Session } }>(REQUEST_SIGN_IN, {
      email: 'ADA@example.com',
    });

    expect(first.requestSignIn.sent).toBe(false);
    expect(first.requestSignIn.session.user).toMatchObject({ email: EMAIL, name: 'ada' });
    expect(await userIdOf(first.requestSignIn.session.token)).toBe(first.requestSignIn.session.user.id);
    expect(second.requestSignIn.session.user.id).toBe(first.requestSignIn.session.user.id);
    expect(links).toEqual([]);
  });

  it('ends the session on sign-out', async () => {
    const anonymous = createClient(db, null, { auth });
    const { signUp } = await anonymous.expectOk<{ signUp: Session }>(SIGN_UP, {
      email: EMAIL,
      password: PASSWORD,
      name: 'Ada',
    });
    const headers = new Headers({ authorization: `Bearer ${signUp.token}` });

    const signedOut = await createClient(db, signUp.user.id, { auth, headers }).expectOk(SIGN_OUT);
    const again = await anonymous.expectOk(SIGN_OUT);

    expect(signedOut).toEqual({ signOut: true });
    expect(again).toEqual({ signOut: false });
    expect(await userIdOf(signUp.token)).toBeNull();
  });
});
