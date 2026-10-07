import { db, schema as dbSchema } from '@philotes/db';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPerson, createUser, migrateTestDatabase, run } from './helpers/harness.ts';

const MERGE =
  'mutation ($keepId: UUID!, $deleteId: UUID!) { mergeLabelInto(keepId: $keepId, deleteId: $deleteId) { id } }';
const LABEL_COLOR = '#6b7280';

/**
 * Inserts a label.
 *
 * @param userId - The label's owner.
 * @param label - The label's text.
 * @returns The new label's id.
 */
async function createLabel(userId: string, label: string): Promise<string> {
  const [row] = await db
    .insert(dbSchema.labels)
    .values({ label, color: LABEL_COLOR, userId })
    .returning({ id: dbSchema.labels.id });
  return row.id;
}

describe('mergeLabelInto', () => {
  let userId: string;
  let strangerId: string;

  beforeAll(async () => {
    await migrateTestDatabase();
    userId = await createUser('owner@example.com');
    strangerId = await createUser('stranger@example.com');
  });

  it('moves the people on the deleted label to the kept one', async () => {
    const keepId = await createLabel(userId, 'friends');
    const deleteId = await createLabel(userId, 'pals');
    const personId = await createPerson(userId, 'Ada');
    await db.insert(dbSchema.personLabels).values({ personId, labelId: deleteId, userId });

    const result = await run(userId, MERGE, { keepId, deleteId });

    expect(result.errors).toBeUndefined();
    const rows = await db
      .select({ labelId: dbSchema.personLabels.labelId, userId: dbSchema.personLabels.userId })
      .from(dbSchema.personLabels)
      .where(eq(dbSchema.personLabels.personId, personId));
    expect(rows).toEqual([{ labelId: keepId, userId }]);
  });

  it('answers "not found" for a label the caller does not own', async () => {
    const keepId = await createLabel(userId, 'family');
    const foreignId = await createLabel(strangerId, 'theirs');

    const result = await run(userId, MERGE, { keepId, deleteId: foreignId });

    expect(result.errors?.[0].message).toBe('Label not found');
  });
});
