import { apiKeys, db } from '@philotes/db';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createUser, migrateTestDatabase, run } from '../helpers.ts';

const CREATE = 'mutation ($input: CreateApiKeyInput!) { myCreateApiKey(input: $input) { apiKey { id } } }';
const REVOKE = 'mutation ($id: ID!) { myRevokeApiKey(id: $id) }';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Creates an API key through the schema.
 *
 * @param userId - The key's owner.
 * @returns The new key's id.
 */
async function createKey(userId: string): Promise<string> {
  const result = await run(userId, CREATE, { input: { name: 'test key' } });
  const data = result.data as { myCreateApiKey: { apiKey: { id: string } } };
  return data.myCreateApiKey.apiKey.id;
}

describe('myRevokeApiKey', () => {
  let ownerId: string;
  let strangerId: string;

  beforeAll(async () => {
    await migrateTestDatabase();
    ownerId = await createUser('owner@example.com');
    strangerId = await createUser('stranger@example.com');
  });

  it('revokes the caller’s own key', async () => {
    const keyId = await createKey(ownerId);

    const result = await run(ownerId, REVOKE, { id: keyId });

    expect(result.errors).toBeUndefined();
    const [row] = await db.select({ revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, keyId));
    expect(row.revokedAt).not.toBeNull();
  });

  it('answers the same for another user’s key as for a key that does not exist', async () => {
    const keyId = await createKey(ownerId);

    const foreign = await run(strangerId, REVOKE, { id: keyId });
    const missing = await run(strangerId, REVOKE, { id: UNKNOWN_ID });

    expect(foreign.errors?.[0].message).toBe('API key not found');
    expect(missing.errors?.[0].message).toBe(foreign.errors?.[0].message);
    const [row] = await db.select({ revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, keyId));
    expect(row.revokedAt).toBeNull();
  });
});
