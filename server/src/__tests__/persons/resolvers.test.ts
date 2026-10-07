import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const UPDATE_CONTEXT =
  'mutation ($personId: UUID!, $howWeMet: String) { updateMyPersonContext(personId: $personId, howWeMet: $howWeMet) { personId howWeMet } }';
const UPDATE_FIRST_MET =
  'mutation ($personId: UUID!, $firstMetDate: String) { updateMyPersonContext(personId: $personId, firstMetDate: $firstMetDate) { personId firstMetDate } }';
const DELETE_MANY = 'mutation ($ids: [UUID!]) { deletePerson(where: { id: { inArray: $ids } }) { id } }';
const DELETE_ONE = 'mutation ($id: UUID!) { deletePerson(where: { id: { eq: $id } }) { id } }';

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
