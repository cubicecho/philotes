import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const UPDATE_HOW_WE_MET =
  'mutation ($id: UUID!, $howWeMet: String) { updatePersons(set: { howWeMet: $howWeMet }, where: { id: { eq: $id } }) { id howWeMet } }';
const UPDATE_FIRST_MET =
  'mutation ($id: UUID!, $firstMetDate: String) { updatePersons(set: { firstMetDate: $firstMetDate }, where: { id: { eq: $id } }) { id firstMetDate } }';
const UPDATE_FREQUENCY =
  'mutation ($id: UUID!, $contactFrequency: String) { updatePersons(set: { contactFrequency: $contactFrequency }, where: { id: { eq: $id } }) { id contactFrequency } }';
const UPDATE_AVATAR =
  'mutation ($id: UUID!, $avatarPath: String) { updatePersons(set: { avatarPath: $avatarPath }, where: { id: { eq: $id } }) { id } }';
const RENAME =
  'mutation ($id: UUID!, $firstName: String) { updatePersons(set: { firstName: $firstName }, where: { id: { eq: $id } }) { id firstName } }';
const DELETE_SEVERAL = 'mutation ($ids: [UUID!]) { deletePersons(where: { id: { inArray: $ids } }) { id } }';
const DELETE_EVERYONE = 'mutation { deletePersons { id } }';
const DELETE_WITH_EMPTY_FILTER = 'mutation { deletePersons(where: {}) { id } }';
const CREATE_SEVERAL = 'mutation ($values: [CreatePersonInput!]!) { createPersons(values: $values) { id firstName } }';
const LIST_PERSONS = '{ persons { id firstName } }';

describe('what a user keeps about a person', () => {
  let db: TestDb;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
  });

  it('saves how the caller met the person', async () => {
    const id = await createPerson(db, userId, 'Ada');

    const data = await createClient(db, userId).expectOk(UPDATE_HOW_WE_MET, { id, howWeMet: 'At the library' });

    expect(data).toEqual({ updatePersons: [{ id, howWeMet: 'At the library' }] });
  });

  it('saves the day the caller first met the person', async () => {
    const id = await createPerson(db, userId, 'Grace');

    const data = await createClient(db, userId).expectOk(UPDATE_FIRST_MET, { id, firstMetDate: '2019-04-02' });

    expect(data).toEqual({ updatePersons: [{ id, firstMetDate: '2019-04-02' }] });
  });

  it('refuses a contact frequency outside the vocabulary', async () => {
    const id = await createPerson(db, userId, 'Linus');

    await createClient(db, userId).expectError(ErrorCode.BadUserInput, UPDATE_FREQUENCY, {
      id,
      contactFrequency: 'fortnightly',
    });
  });

  it('refuses an avatar path, which only an upload sets', async () => {
    const id = await createPerson(db, userId, 'Margaret');

    await createClient(db, userId).expectError(ErrorCode.BadUserInput, UPDATE_AVATAR, {
      id,
      avatarPath: '/avatars/someone-elses.png',
    });
  });
});

describe('a person belongs to one user', () => {
  let db: TestDb;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    otherUserId = await createUser(db, 'other@example.com');
  });

  it("adds each created person to the caller's people only", async () => {
    const client = createClient(db, userId);

    const created = await client.expectOk<{ createPersons: Array<{ id: string }> }>(CREATE_SEVERAL, {
      values: [
        { firstName: 'Ada', lastName: 'Lovelace' },
        { firstName: 'Grace', lastName: 'Hopper' },
      ],
    });

    const mine = await client.expectOk<{ persons: Array<{ id: string }> }>(LIST_PERSONS);
    const theirs = await createClient(db, otherUserId).expectOk<{ persons: Array<{ id: string }> }>(LIST_PERSONS);
    expect(mine.persons.map((person) => person.id).sort()).toEqual(
      created.createPersons.map((person) => person.id).sort(),
    );
    expect(theirs.persons).toEqual([]);
  });

  it('lets two users keep the same email address for their own people', async () => {
    const mineId = await createPerson(db, userId, 'Ada');
    const theirsId = await createPerson(db, otherUserId, 'Ada');
    const email = { type: dbSchema.ContactType.Email, value: 'ada@example.com' };

    await db.insert(dbSchema.contactInfos).values([
      { ...email, userId, personId: mineId },
      { ...email, userId: otherUserId, personId: theirsId },
    ]);

    const rows = await db.select().from(dbSchema.contactInfos).where(eq(dbSchema.contactInfos.value, email.value));
    expect(rows).toHaveLength(2);
  });

  it("does not rename another user's person", async () => {
    const theirsId = await createPerson(db, otherUserId, 'Linus');

    const data = await createClient(db, userId).expectOk(RENAME, { id: theirsId, firstName: 'Renamed' });

    expect(data).toEqual({ updatePersons: [] });
    const [theirs] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, theirsId));
    expect(theirs.firstName).toBe('Linus');
  });

  it("deletes the caller's person with what was recorded about them, and nobody else's", async () => {
    const mineId = await createPerson(db, userId, 'Margaret');
    const theirsId = await createPerson(db, otherUserId, 'Margaret');
    await db.insert(dbSchema.notes).values([
      { userId, personId: mineId, body: 'Mine' },
      { userId: otherUserId, personId: theirsId, body: 'Theirs' },
    ]);
    await db
      .insert(dbSchema.contactInfos)
      .values({ userId, personId: mineId, type: dbSchema.ContactType.Phone, value: '555-0100' });

    const data = await createClient(db, userId).expectOk(DELETE_SEVERAL, { ids: [mineId, theirsId] });

    expect(data).toEqual({ deletePersons: [{ id: mineId }] });
    const people = await db.select({ id: dbSchema.persons.id }).from(dbSchema.persons);
    expect(people.map((person: { id: string }) => person.id)).toContain(theirsId);
    const details = await db.select().from(dbSchema.contactInfos).where(eq(dbSchema.contactInfos.personId, mineId));
    expect(details).toEqual([]);
    const notes: Array<{ body: string; personId: string | null }> = await db
      .select({ body: dbSchema.notes.body, personId: dbSchema.notes.personId })
      .from(dbSchema.notes)
      .orderBy(dbSchema.notes.body);
    expect(notes).toEqual([
      { body: 'Mine', personId: null },
      { body: 'Theirs', personId: theirsId },
    ]);
  });

  it('refuses a delete that names nobody', async () => {
    await createPerson(db, userId, 'Katherine');
    const client = createClient(db, userId);

    const everyone = await client.run(DELETE_EVERYONE);
    const emptyFilter = await client.run(DELETE_WITH_EMPTY_FILTER);

    expect(everyone.errors).toBeDefined();
    expect(emptyFilter.errors).toBeDefined();
    const listed = await client.expectOk<{ persons: Array<{ firstName: string }> }>(LIST_PERSONS);
    expect(listed.persons.map((person) => person.firstName)).toContain('Katherine');
  });
});
