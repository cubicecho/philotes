import * as dbSchema from '@philotes/db/schema';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const MERGE =
  'mutation ($keepId: UUID!, $deleteId: UUID!) { mergeLabelInto(keepId: $keepId, deleteId: $deleteId) { id } }';
const LABEL_COLOR = '#6b7280';

/**
 * Inserts a label.
 *
 * @param db - The test database.
 * @param userId - The label's owner.
 * @param label - The label's text.
 * @returns The new label's id.
 */
async function createLabel(db: TestDb, userId: string, label: string): Promise<string> {
  const [row] = await db
    .insert(dbSchema.labels)
    .values({ label, color: LABEL_COLOR, userId })
    .returning({ id: dbSchema.labels.id });
  return row.id;
}

describe('mergeLabelInto', () => {
  let db: TestDb;
  let userId: string;
  let strangerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    strangerId = await createUser(db, 'stranger@example.com');
  });

  it('moves the people on the deleted label to the kept one', async () => {
    const keepId = await createLabel(db, userId, 'friends');
    const deleteId = await createLabel(db, userId, 'pals');
    const personId = await createPerson(db, userId, 'Ada');
    await db.insert(dbSchema.personLabels).values({ personId, labelId: deleteId, userId });

    const result = await createClient(db, userId).run(MERGE, { keepId, deleteId });

    expect(result.errors).toBeUndefined();
    const rows = await db
      .select({ labelId: dbSchema.personLabels.labelId, userId: dbSchema.personLabels.userId })
      .from(dbSchema.personLabels)
      .where(eq(dbSchema.personLabels.personId, personId));
    expect(rows).toEqual([{ labelId: keepId, userId }]);
  });

  it('answers "not found" for a label the caller does not own', async () => {
    const keepId = await createLabel(db, userId, 'family');
    const foreignId = await createLabel(db, strangerId, 'theirs');

    const result = await createClient(db, userId).run(MERGE, { keepId, deleteId: foreignId });

    expect(result.errors?.[0].extensions.code).toBe(ErrorCode.NotFound);
  });
});
