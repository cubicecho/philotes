import { apikeys } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Auth } from '../../auth/better-auth.ts';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createTestAuth, createTestDb, createUser, type TestDb } from '../helpers.ts';

const CREATE = 'mutation ($input: CreateApiKeyInput!) { myCreateApiKey(input: $input) { apiKey { id } } }';
const REVOKE = 'mutation ($id: ID!) { myRevokeApiKey(id: $id) }';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Creates an API key through the schema.
 *
 * @param db - The test database.
 * @param userId - The key's owner.
 * @returns The new key's id.
 */
async function createKey(db: TestDb, userId: string): Promise<string> {
  const result = await createClient(db, userId).run(CREATE, { input: { name: 'test key' } });
  const data = result.data as { myCreateApiKey: { apiKey: { id: string } } };
  return data.myCreateApiKey.apiKey.id;
}

const CREATE_FULL = `mutation ($input: CreateApiKeyInput!) {
  myCreateApiKey(input: $input) { token apiKey { id name keyPrefix lastUsedAt expiresAt createdAt } }
}`;
const LIST = '{ myApiKeys { id name keyPrefix lastUsedAt } }';
const MS_PER_DAY = 86_400_000;

interface Created {
  myCreateApiKey: {
    token: string;
    apiKey: { id: string; name: string; keyPrefix: string; expiresAt: string | null; createdAt: string };
  };
}

describe('myCreateApiKey and myApiKeys', () => {
  let db: TestDb;
  let auth: Auth;
  let ownerId: string;
  let strangerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    ({ auth } = createTestAuth(db));
    ownerId = await createUser(db, 'key-owner@example.com');
    strangerId = await createUser(db, 'key-stranger@example.com');
  });

  it('returns the whole key once, and stores only its hash', async () => {
    const { myCreateApiKey } = await createClient(db, ownerId, { auth }).expectOk<Created>(CREATE_FULL, {
      input: { name: ' Calendar ' },
    });
    const { token, apiKey } = myCreateApiKey;

    const [row] = await db.select().from(apikeys).where(eq(apikeys.id, apiKey.id));
    expect(token.startsWith('phlt_')).toBe(true);
    expect(apiKey).toMatchObject({ name: 'Calendar', expiresAt: null });
    expect(token.startsWith(apiKey.keyPrefix)).toBe(true);
    expect(apiKey.keyPrefix.length).toBeLessThan(token.length);
    expect(row.key).not.toBe(token);
    expect(row.referenceId).toBe(ownerId);
  });

  it('verifies a key to its owner, and stops once it is revoked', async () => {
    const client = createClient(db, ownerId, { auth });
    const { myCreateApiKey } = await client.expectOk<Created>(CREATE_FULL, { input: { name: 'Feed' } });

    const live = await auth.api.verifyApiKey({ body: { key: myCreateApiKey.token } });
    await client.expectOk(REVOKE, { id: myCreateApiKey.apiKey.id });
    const revoked = await auth.api.verifyApiKey({ body: { key: myCreateApiKey.token } });

    expect(live.key?.referenceId).toBe(ownerId);
    expect(revoked.valid).toBe(false);
  });

  it('sets the expiry asked for, and refuses one in the past', async () => {
    const client = createClient(db, ownerId, { auth });
    const inAMonth = new Date(Date.now() + 30 * MS_PER_DAY).toISOString();

    const { myCreateApiKey } = await client.expectOk<Created>(CREATE_FULL, {
      input: { name: 'Short', expiresAt: inAMonth },
    });

    const drift = Math.abs(new Date(myCreateApiKey.apiKey.expiresAt ?? 0).getTime() - new Date(inAMonth).getTime());
    expect(drift).toBeLessThan(5000);
    await client.expectError(ErrorCode.BadUserInput, CREATE_FULL, {
      input: { name: 'Late', expiresAt: '2001-01-01T00:00:00' },
    });
    await client.expectError(ErrorCode.BadUserInput, CREATE_FULL, { input: { name: '  ' } });
  });

  it('lists only the caller’s keys, and refuses a signed-out caller', async () => {
    const mine = await createClient(db, ownerId, { auth }).expectOk<{ myApiKeys: Array<{ name: string }> }>(LIST);
    const theirs = await createClient(db, strangerId, { auth }).expectOk<{ myApiKeys: unknown[] }>(LIST);

    expect(mine.myApiKeys.length).toBeGreaterThan(0);
    expect(theirs.myApiKeys).toEqual([]);
    await createClient(db, null, { auth }).expectError(ErrorCode.Unauthenticated, LIST);
  });
});

describe('myRevokeApiKey', () => {
  let db: TestDb;
  let ownerId: string;
  let strangerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = await createUser(db, 'owner@example.com');
    strangerId = await createUser(db, 'stranger@example.com');
  });

  it('revokes the caller’s own key', async () => {
    const keyId = await createKey(db, ownerId);

    const result = await createClient(db, ownerId).run(REVOKE, { id: keyId });

    expect(result.errors).toBeUndefined();
    expect(await db.select({ id: apikeys.id }).from(apikeys).where(eq(apikeys.id, keyId))).toEqual([]);
  });

  it('answers the same for another user’s key as for a key that does not exist', async () => {
    const keyId = await createKey(db, ownerId);

    const foreign = await createClient(db, strangerId).run(REVOKE, { id: keyId });
    const missing = await createClient(db, strangerId).run(REVOKE, { id: UNKNOWN_ID });

    expect(foreign.errors?.[0].extensions.code).toBe(ErrorCode.NotFound);
    expect(missing.errors?.[0].extensions.code).toBe(ErrorCode.NotFound);
    expect(missing.errors?.[0].message).toBe(foreign.errors?.[0].message);
    expect(await db.select({ id: apikeys.id }).from(apikeys).where(eq(apikeys.id, keyId))).toHaveLength(1);
  });
});
