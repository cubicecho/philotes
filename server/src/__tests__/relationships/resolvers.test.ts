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
  let sharedId: string;
  let mineId: string;
  let theirsId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    otherUserId = await createUser(db, 'other@example.com');
    sharedId = await createPerson(db, userId, 'Ada');
    await db.insert(dbSchema.userPersons).values({ userId: otherUserId, personId: sharedId });
    mineId = await createPerson(db, userId, 'Grace');
    theirsId = await createPerson(db, otherUserId, 'Linus');
    await db.insert(dbSchema.personRelationships).values([
      { userId, fromPersonId: sharedId, toPersonId: mineId, type: 'colleague' },
      { userId: otherUserId, fromPersonId: theirsId, toPersonId: sharedId, type: 'sibling' },
    ]);
  });

  it('lists the relationships the caller recorded, seen from either end', async () => {
    const mine = await createClient(db, userId).expectOk<RelationshipsResult>(RELATIONSHIPS, { id: sharedId });
    const theirs = await createClient(db, otherUserId).expectOk<RelationshipsResult>(RELATIONSHIPS, { id: sharedId });

    expect(mine.person.relationships).toEqual([{ type: 'colleague', relatedPersonId: mineId }]);
    expect(theirs.person.relationships).toEqual([{ type: 'sibling', relatedPersonId: theirsId }]);
  });
});
