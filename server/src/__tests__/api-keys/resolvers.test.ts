import { apiKeys } from '@philotes/db/api-keys';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createTestDb, createUser, type TestDb } from '../helpers.ts';

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
    const [row] = await db.select({ revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, keyId));
    expect(row.revokedAt).not.toBeNull();
  });

  it('answers the same for another user’s key as for a key that does not exist', async () => {
    const keyId = await createKey(db, ownerId);

    const foreign = await createClient(db, strangerId).run(REVOKE, { id: keyId });
    const missing = await createClient(db, strangerId).run(REVOKE, { id: UNKNOWN_ID });

    expect(foreign.errors?.[0].extensions.code).toBe(ErrorCode.NotFound);
    expect(missing.errors?.[0].extensions.code).toBe(ErrorCode.NotFound);
    expect(missing.errors?.[0].message).toBe(foreign.errors?.[0].message);
    const [row] = await db.select({ revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, keyId));
    expect(row.revokedAt).toBeNull();
  });
});
