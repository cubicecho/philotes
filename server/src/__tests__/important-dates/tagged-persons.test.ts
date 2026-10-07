import * as dbSchema from '@cubicecho/philotes-db/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestClient, type TestDb } from '../helpers.ts';

const TAG_PERSON =
  'mutation ($values: CreateImportantDatePersonInput!) { createImportantDatePerson(values: $values) { personId } }';
const UNTAG_PERSON = `mutation ($importantDateId: UUID!, $personId: UUID!) {
  deleteImportantDatePerson(where: { importantDateId: { eq: $importantDateId }, personId: { eq: $personId } }) {
    personId
  }
}`;
const TAGGED_PERSONS =
  'query ($id: UUID!) { importantDate(where: { id: { eq: $id } }) { taggedPersons { id firstName } } }';
const TAGGED_ON_DATES = 'query ($id: UUID!) { person(where: { id: { eq: $id } }) { taggedOnDates { id name } } }';

/** What the tagged-persons query returns. */
interface TaggedPersonsData {
  importantDate: { taggedPersons: Array<{ id: string; firstName: string }> };
}

describe('people tagged on an important date', () => {
  let db: TestDb;
  let owner: TestClient;
  let stranger: TestClient;
  let adaId: string;
  let spouseId: string;
  let strangerPersonId: string;
  let anniversaryId: string;
  let strangerDateId: string;

  /**
   * Inserts an important date.
   *
   * @param userId - The user who keeps the date.
   * @param personId - The person the date belongs to.
   * @returns The new date's id.
   */
  async function createDate(userId: string, personId: string): Promise<string> {
    const [row] = await db
      .insert(dbSchema.importantDates)
      .values({ userId, personId, name: 'Anniversary', date: '2020-06-01' })
      .returning({ id: dbSchema.importantDates.id });
    return row.id;
  }

  beforeAll(async () => {
    db = await createTestDb();
    const ownerId = await createUser(db, 'owner@example.com');
    const strangerId = await createUser(db, 'stranger@example.com');
    owner = createClient(db, ownerId);
    stranger = createClient(db, strangerId);
    adaId = await createPerson(db, ownerId, 'Ada');
    spouseId = await createPerson(db, ownerId, 'William');
    strangerPersonId = await createPerson(db, strangerId, 'Grace');
    anniversaryId = await createDate(ownerId, adaId);
    strangerDateId = await createDate(strangerId, strangerPersonId);
  });

  it('tags a person and reads them from both sides', async () => {
    await owner.expectOk(TAG_PERSON, { values: { importantDateId: anniversaryId, personId: spouseId } });

    const fromDate = await owner.expectOk<TaggedPersonsData>(TAGGED_PERSONS, { id: anniversaryId });
    expect(fromDate.importantDate.taggedPersons).toEqual([{ id: spouseId, firstName: 'William' }]);

    const fromPerson = await owner.expectOk<{ person: { taggedOnDates: Array<{ id: string }> } }>(TAGGED_ON_DATES, {
      id: spouseId,
    });
    expect(fromPerson.person.taggedOnDates.map((d) => d.id)).toEqual([anniversaryId]);
  });

  it('reports a person outside the caller’s contacts as not found', async () => {
    await owner.expectError(ErrorCode.NotFound, TAG_PERSON, {
      values: { importantDateId: anniversaryId, personId: strangerPersonId },
    });
  });

  it('reports another user’s date as not found', async () => {
    await owner.expectError(ErrorCode.NotFound, TAG_PERSON, {
      values: { importantDateId: strangerDateId, personId: spouseId },
    });
  });

  it('leaves the tag alone when another user tries to remove it, and removes it for its owner', async () => {
    await stranger.run(UNTAG_PERSON, { importantDateId: anniversaryId, personId: spouseId });
    const kept = await owner.expectOk<TaggedPersonsData>(TAGGED_PERSONS, { id: anniversaryId });
    expect(kept.importantDate.taggedPersons).toHaveLength(1);

    await owner.expectOk(UNTAG_PERSON, { importantDateId: anniversaryId, personId: spouseId });
    const gone = await owner.expectOk<TaggedPersonsData>(TAGGED_PERSONS, { id: anniversaryId });
    expect(gone.importantDate.taggedPersons).toEqual([]);
  });
});
