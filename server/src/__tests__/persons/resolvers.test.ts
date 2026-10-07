import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const UPDATE_CONTEXT =
  'mutation ($personId: UUID!, $howWeMet: String) { updateMyPersonContext(personId: $personId, howWeMet: $howWeMet) { personId howWeMet } }';
const UPDATE_FIRST_MET =
  'mutation ($personId: UUID!, $firstMetDate: String) { updateMyPersonContext(personId: $personId, firstMetDate: $firstMetDate) { personId firstMetDate } }';
const DELETE_MANY = 'mutation ($ids: [UUID!]) { deletePerson(where: { id: { inArray: $ids } }) { id } }';
const DELETE_ONE = 'mutation ($id: UUID!) { deletePerson(where: { id: { eq: $id } }) { id } }';
const DELETE_SEVERAL = 'mutation ($ids: [UUID!]) { deletePersons(where: { id: { inArray: $ids } }) { id } }';
const DELETE_BY_NAME = 'mutation ($name: String!) { deletePersons(where: { firstName: { eq: $name } }) { id } }';
const DELETE_EVERYONE = 'mutation { deletePersons { id } }';
const CREATE_SEVERAL = 'mutation ($values: [CreatePersonInput!]!) { createPersons(values: $values) { id firstName } }';
const LIST_PERSONS = '{ persons { id } }';

describe('updateMyPersonContext', () => {
  let db: TestDb;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
  });

  it('returns the row unchanged when no field is named', async () => {
    const personId = await createPerson(db, userId, 'Ada');
    const client = createClient(db, userId);
    await client.run(UPDATE_CONTEXT, { personId, howWeMet: 'At the library' });

    const result = await client.run(UPDATE_CONTEXT, { personId });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ updateMyPersonContext: { personId, howWeMet: 'At the library' } });
  });

  it('saves the day the caller first met the person', async () => {
    const personId = await createPerson(db, userId, 'Grace');

    const data = await createClient(db, userId).expectOk(UPDATE_FIRST_MET, { personId, firstMetDate: '2019-04-02' });

    expect(data).toEqual({ updateMyPersonContext: { personId, firstMetDate: '2019-04-02' } });
  });

  it('refuses a first-met date that is not a calendar day', async () => {
    const personId = await createPerson(db, userId, 'Linus');

    await createClient(db, userId).expectError(ErrorCode.BadUserInput, UPDATE_FIRST_MET, {
      personId,
      firstMetDate: 'last spring',
    });
  });
});

describe('deletePerson', () => {
  let db: TestDb;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
  });

  it('refuses a filter that names no single id', async () => {
    const personId = await createPerson(db, userId, 'Ada');

    const result = await createClient(db, userId).run(DELETE_MANY, { ids: [personId] });

    expect(result.errors?.[0].extensions.code).toBe(ErrorCode.BadUserInput);
  });

  it('removes the person named by id', async () => {
    const personId = await createPerson(db, userId, 'Grace');

    const result = await createClient(db, userId).run(DELETE_ONE, { id: personId });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ deletePerson: { id: personId } });
  });

  it("answers null for a person who is not in the caller's contacts", async () => {
    const strangerId = await createUser(db, 'stranger@example.com');
    const personId = await createPerson(db, strangerId, 'Linus');

    const result = await createClient(db, userId).run(DELETE_ONE, { id: personId });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ deletePerson: null });
  });
});

describe('deletePersons', () => {
  let db: TestDb;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    otherUserId = await createUser(db, 'other@example.com');
  });

  it('only unlinks a person another user also has', async () => {
    const personId = await createPerson(db, userId, 'Ada');
    await db.insert(dbSchema.userPersons).values({ userId: otherUserId, personId });

    const result = await createClient(db, userId).run(DELETE_SEVERAL, { ids: [personId] });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ deletePersons: [{ id: personId }] });
    const remaining = await db
      .select({ userId: dbSchema.userPersons.userId })
      .from(dbSchema.userPersons)
      .where(eq(dbSchema.userPersons.personId, personId));
    expect(remaining).toEqual([{ userId: otherUserId }]);
    const persons = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, personId));
    expect(persons).toHaveLength(1);
  });

  it("leaves out a person who is not in the caller's contacts", async () => {
    const mineId = await createPerson(db, userId, 'Grace');
    const theirsId = await createPerson(db, otherUserId, 'Linus');

    const result = await createClient(db, userId).run(DELETE_SEVERAL, { ids: [mineId, theirsId] });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ deletePersons: [{ id: mineId }] });
    const theirs = await createClient(db, otherUserId).expectOk<{ persons: Array<{ id: string }> }>(LIST_PERSONS);
    expect(theirs.persons.map((person) => person.id)).toContain(theirsId);
  });

  it('refuses a filter that names no ids', async () => {
    await createPerson(db, userId, 'Margaret');
    const client = createClient(db, userId);

    const byName = await client.run(DELETE_BY_NAME, { name: 'Margaret' });
    const everyone = await client.run(DELETE_EVERYONE);

    expect(byName.errors?.[0].extensions.code).toBe(ErrorCode.BadUserInput);
    expect(everyone.errors?.[0].extensions.code).toBe(ErrorCode.BadUserInput);
  });
});

describe('createPersons', () => {
  it("adds each person to the caller's contacts", async () => {
    const db = await createTestDb();
    const userId = await createUser(db, 'owner@example.com');
    const client = createClient(db, userId);

    const created = await client.expectOk<{ createPersons: Array<{ id: string }> }>(CREATE_SEVERAL, {
      values: [
        { firstName: 'Ada', lastName: 'Lovelace' },
        { firstName: 'Grace', lastName: 'Hopper' },
      ],
    });

    const listed = await client.expectOk<{ persons: Array<{ id: string }> }>(LIST_PERSONS);
    expect(listed.persons.map((person) => person.id).sort()).toEqual(
      created.createPersons.map((person) => person.id).sort(),
    );
  });
});
