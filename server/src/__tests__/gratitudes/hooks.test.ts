import * as dbSchema from '@cubicecho/philotes-db/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { GRATITUDE_DEFAULTS } from '../../core/defaults.ts';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestClient, type TestDb } from '../helpers.ts';

const CREATE_GRATITUDE =
  'mutation ($values: CreateGratitudeInput!) { createGratitude(values: $values) { id body personId } }';
const UPDATE_GRATITUDE =
  'mutation ($id: UUID!, $set: UpdateGratitudeInput!) { updateGratitude(where: { id: { eq: $id } }, set: $set) { id } }';
const DELETE_GRATITUDE = 'mutation ($id: UUID!) { deleteGratitude(where: { id: { eq: $id } }) { id } }';
const PERSON_GRATITUDES = 'query ($id: UUID!) { person(where: { id: { eq: $id } }) { gratitudes { id body } } }';
const ALL_GRATITUDES = 'query { gratitudes { id } }';

describe('gratitudes', () => {
  let db: TestDb;
  let owner: TestClient;
  let stranger: TestClient;
  let ownPersonId: string;
  let strangerPersonId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const ownerId = await createUser(db, 'owner@example.com');
    const strangerId = await createUser(db, 'stranger@example.com');
    owner = createClient(db, ownerId);
    stranger = createClient(db, strangerId);
    ownPersonId = await createPerson(db, ownerId, 'Ada');
    strangerPersonId = await createPerson(db, strangerId, 'Grace');
  });

  it('records a gratitude and reads it back on the person', async () => {
    await owner.expectOk(CREATE_GRATITUDE, { values: { body: 'Always picks up the phone', personId: ownPersonId } });
    const data = await owner.expectOk<{ person: { gratitudes: Array<{ body: string }> } }>(PERSON_GRATITUDES, {
      id: ownPersonId,
    });
    expect(data.person.gratitudes.map((g) => g.body)).toEqual(['Always picks up the phone']);
  });

  it('keeps one user’s gratitudes from another', async () => {
    const data = await stranger.expectOk<{ gratitudes: unknown[] }>(ALL_GRATITUDES);
    expect(data.gratitudes).toEqual([]);
  });

  it('refuses an empty body, and one over the limit on update', async () => {
    await owner.expectError(ErrorCode.BadUserInput, CREATE_GRATITUDE, {
      values: { body: '  ', personId: ownPersonId },
    });
    const { createGratitude } = await owner.expectOk<{ createGratitude: { id: string } }>(CREATE_GRATITUDE, {
      values: { body: 'Kind', personId: ownPersonId },
    });
    const tooLong = 'x'.repeat(GRATITUDE_DEFAULTS.maxBodyLength + 1);
    await owner.expectError(ErrorCode.BadUserInput, UPDATE_GRATITUDE, {
      id: createGratitude.id,
      set: { body: tooLong },
    });
  });

  it('reports a person outside the caller’s contacts as not found', async () => {
    await owner.expectError(ErrorCode.NotFound, CREATE_GRATITUDE, {
      values: { body: 'hi', personId: strangerPersonId },
    });
  });

  it('does not delete another user’s gratitude', async () => {
    const { createGratitude } = await owner.expectOk<{ createGratitude: { id: string } }>(CREATE_GRATITUDE, {
      values: { body: 'Mine', personId: ownPersonId },
    });
    await stranger.run(DELETE_GRATITUDE, { id: createGratitude.id });
    const rows = await db.select({ id: dbSchema.gratitudes.id }).from(dbSchema.gratitudes);
    expect(rows.map((row: { id: string }) => row.id)).toContain(createGratitude.id);
  });
});
