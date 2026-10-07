import { beforeAll, describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../auth/rate-limit.ts';
import { RATE_LIMIT_DEFAULTS } from '../../core/defaults.ts';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createTestAuth, createTestDb, type TestDb } from '../helpers.ts';

const SIGN_IN = 'mutation ($email: String!) { signIn(email: $email, password: "wrong-password") { token } }';
const MS_PER_MINUTE = 60_000;

describe('createRateLimiter', () => {
  it('allows the budget, then refuses with the seconds left', () => {
    let now = 0;
    const limiter = createRateLimiter({ maxAttempts: 2, windowMinutes: 1 }, () => now);
    limiter.hit('a');
    now = 10_000;
    limiter.hit('a');

    expect(() => limiter.hit('a')).toThrow('Try again in 50 seconds.');
  });

  it('counts each key on its own, and records nothing for a refused attempt', () => {
    const limiter = createRateLimiter({ maxAttempts: 1 });
    limiter.hit('a');

    expect(() => limiter.hit('a', 'b')).toThrow();
    expect(() => limiter.hit('b')).not.toThrow();
  });

  it('allows again once the window has passed', () => {
    let now = 0;
    const limiter = createRateLimiter({ maxAttempts: 1, windowMinutes: 1 }, () => now);
    limiter.hit('a');
    now = MS_PER_MINUTE;

    expect(() => limiter.hit('a')).not.toThrow();
  });

  it('keeps the defaults an override leaves out', () => {
    const limiter = createRateLimiter({ windowMinutes: 1 });
    for (let attempt = 0; attempt < RATE_LIMIT_DEFAULTS.maxAttempts; attempt += 1) {
      limiter.hit('a');
    }

    expect(() => limiter.hit('a')).toThrow();
  });

  it('forgets stale keys once it is crowded', () => {
    let now = 0;
    const limiter = createRateLimiter({ maxAttempts: 1, windowMinutes: 1, sweepAtKeys: 2 }, () => now);
    limiter.hit('a');
    limiter.hit('b');
    now = MS_PER_MINUTE;
    limiter.hit('c');

    expect(() => limiter.hit('a', 'b')).not.toThrow();
  });
});

describe('sign-in throttling', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it('refuses an address that is over its budget, whichever account it tries', async () => {
    const { auth } = createTestAuth(db);
    const limiter = createRateLimiter({ maxAttempts: 2 });
    const client = createClient(db, null, { auth, limiter });
    await client.expectError(ErrorCode.Unauthenticated, SIGN_IN, { email: 'one@example.com' });
    await client.expectError(ErrorCode.Unauthenticated, SIGN_IN, { email: 'two@example.com' });

    const error = await client.expectError(ErrorCode.TooManyRequests, SIGN_IN, { email: 'three@example.com' });

    expect(error.extensions.retryAfter).toBeGreaterThan(0);
  });

  it('refuses an account that is over its budget, whichever address and spelling is used', async () => {
    const { auth } = createTestAuth(db);
    const limiter = createRateLimiter({ maxAttempts: 2 });
    const from = (ip: string) => createClient(db, null, { auth, limiter, ip });
    await from('203.0.113.1').expectError(ErrorCode.Unauthenticated, SIGN_IN, { email: 'target@example.com' });
    await from('203.0.113.2').expectError(ErrorCode.Unauthenticated, SIGN_IN, { email: ' TARGET@example.com' });

    await from('203.0.113.3').expectError(ErrorCode.TooManyRequests, SIGN_IN, { email: 'Target@Example.com' });
  });
});
