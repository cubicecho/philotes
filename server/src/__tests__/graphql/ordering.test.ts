import * as dbSchema from '@cubicecho/philotes-db/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, createTestDb, createUser, type TestClient, type TestDb } from '../helpers.ts';

// The app orders its lists by a name with the id as the tiebreak. These hold the rule its queries rely on:
// the key with the higher priority sorts first.

/** Ids whose order is the reverse of their labels' alphabetical order. */
const FIRST_ID = '00000000-0000-4000-8000-000000000001';
const SECOND_ID = '00000000-0000-4000-8000-000000000002';

const LABELS = 'query ($orderBy: LabelOrderBy) { labels(orderBy: $orderBy, limit: 10, offset: 0) { label } }';

describe('ordering by more than one key', () => {
  let db: TestDb;
  let client: TestClient;

  beforeAll(async () => {
    db = await createTestDb();
    const userId = await createUser(db, 'owner@example.com');
    await db.insert(dbSchema.labels).values([
      { id: FIRST_ID, userId, label: 'Work', color: '#111111' },
      { id: SECOND_ID, userId, label: 'Family', color: '#222222' },
    ]);
    client = createClient(db, userId);
  });

  it('sorts by the key with the higher priority first', async () => {
    const data = await client.expectOk<{ labels: Array<{ label: string }> }>(LABELS, {
      orderBy: { label: { direction: 'asc', priority: 2 }, id: { direction: 'asc', priority: 1 } },
    });

    expect(data.labels.map((row) => row.label)).toEqual(['Family', 'Work']);
  });

  it('leaves a lower-priority key as the tiebreak only', async () => {
    const data = await client.expectOk<{ labels: Array<{ label: string }> }>(LABELS, {
      orderBy: { label: { direction: 'asc', priority: 1 }, id: { direction: 'asc', priority: 2 } },
    });

    expect(data.labels.map((row) => row.label)).toEqual(['Work', 'Family']);
  });
});
