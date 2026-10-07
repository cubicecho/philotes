import * as dbSchema from '@cubicecho/philotes-db/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const RELATIONSHIPS =
  'query ($id: UUID!) { person(where: { id: { eq: $id } }) { relationships { type relatedPersonId } } }';

interface RelationshipsResult {
  person: { relationships: Array<{ type: string; relatedPersonId: string }> };
}

describe('Person.relationships', () => {
  let db: TestDb;
  let userId: string;
  let otherUserId: string;
  let adaId: string;
  let mineId: string;
  let theirAdaId: string;
  let theirsId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    otherUserId = await createUser(db, 'other@example.com');
    adaId = await createPerson(db, userId, 'Ada');
    mineId = await createPerson(db, userId, 'Grace');
    theirAdaId = await createPerson(db, otherUserId, 'Ada');
    theirsId = await createPerson(db, otherUserId, 'Linus');
    await db.insert(dbSchema.personRelationships).values([
      { userId, fromPersonId: adaId, toPersonId: mineId, type: 'colleague' },
      { userId: otherUserId, fromPersonId: theirsId, toPersonId: theirAdaId, type: 'sibling' },
    ]);
  });

  it('lists the relationships the caller recorded, seen from either end', async () => {
    const mine = await createClient(db, userId).expectOk<RelationshipsResult>(RELATIONSHIPS, { id: adaId });
    const theirs = await createClient(db, otherUserId).expectOk<RelationshipsResult>(RELATIONSHIPS, { id: theirAdaId });

    expect(mine.person.relationships).toEqual([{ type: 'colleague', relatedPersonId: mineId }]);
    expect(theirs.person.relationships).toEqual([{ type: 'sibling', relatedPersonId: theirsId }]);
  });
});
