import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq, inArray } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { createClient, createPerson, createTestDb, createUser, type TestClient, type TestDb } from '../helpers.ts';

const CREATE =
  'mutation ($values: CreateContactInfoInput!) { createContactInfo(values: $values) { id kind normalizedValue } }';
const CREATE_SEVERAL =
  'mutation ($values: [CreateContactInfoInput!]!) { createContactInfos(values: $values) { id value normalizedValue } }';
const UPDATE_VALUE =
  'mutation ($id: UUID!, $value: String) { updateContactInfos(set: { value: $value }, where: { id: { eq: $id } }) { id normalizedValue } }';
const UPDATE_VALUE_BLIND =
  'mutation ($id: UUID!, $value: String) { updateContactInfos(set: { value: $value }, where: { id: { eq: $id } }) { value } }';
const CREATE_BLIND = 'mutation ($values: CreateContactInfoInput!) { createContactInfo(values: $values) { value } }';
const SET_COUNTRY = 'mutation ($country: String!) { setDefaultCountry(country: $country) { id defaultCountry } }';
const ME = '{ me { defaultCountry } }';

interface Created {
  createContactInfo: { id: string; kind: string | null; normalizedValue: string };
}

describe("a contact detail's normalized value", () => {
  let db: TestDb;
  let owner: TestClient;
  let personId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const userId = await createUser(db, 'owner@example.com');
    owner = createClient(db, userId);
    personId = await createPerson(db, userId, 'Ada');
  });

  it('is the E.164 form of a new phone number, read in the default country', async () => {
    const data = await owner.expectOk<Created>(CREATE, {
      values: { personId, type: 'phone', value: '(212) 555-0100', kind: 'mobile' },
    });

    expect(data.createContactInfo).toMatchObject({ kind: 'mobile', normalizedValue: '+12125550100' });
  });

  it('is worked out for every row of one create', async () => {
    const data = await owner.expectOk(CREATE_SEVERAL, {
      values: [
        { personId, type: 'email', value: ' Ada@Example.com ' },
        { personId, type: 'fax', value: '212 555 0199' },
      ],
    });

    expect(data).toMatchObject({
      createContactInfos: [
        { value: 'Ada@Example.com', normalizedValue: 'ada@example.com' },
        { value: '212 555 0199', normalizedValue: '+12125550199' },
      ],
    });
  });

  it('follows the value when it changes', async () => {
    const created = await owner.expectOk<Created>(CREATE, {
      values: { personId, type: 'phone', value: '212-555-0101' },
    });

    const data = await owner.expectOk(UPDATE_VALUE, { id: created.createContactInfo.id, value: '212-555-0102' });

    expect(data).toMatchObject({ updateContactInfos: [{ normalizedValue: '+12125550102' }] });
  });

  it('is stored for a write that does not ask for the id back', async () => {
    await owner.expectOk(CREATE_BLIND, { values: { personId, type: 'phone', value: '212-555-0104' } });
    const created = await owner.expectOk<Created>(CREATE, {
      values: { personId, type: 'phone', value: '212-555-0105' },
    });
    await owner.expectOk(UPDATE_VALUE_BLIND, { id: created.createContactInfo.id, value: '212-555-0106' });

    const stored: Array<{ value: string; normalizedValue: string }> = await db
      .select({ value: dbSchema.contactInfos.value, normalizedValue: dbSchema.contactInfos.normalizedValue })
      .from(dbSchema.contactInfos)
      .where(inArray(dbSchema.contactInfos.value, ['212-555-0104', '212-555-0106']))
      .orderBy(dbSchema.contactInfos.value);
    expect(stored).toEqual([
      { value: '212-555-0104', normalizedValue: '+12125550104' },
      { value: '212-555-0106', normalizedValue: '+12125550106' },
    ]);
  });

  it('cannot be set by a client', async () => {
    const result = await owner.run(CREATE, {
      values: { personId, type: 'phone', value: '212-555-0103', normalizedValue: '+10000000000' },
    });

    expect(result.errors).toBeDefined();
  });
});

describe('setDefaultCountry', () => {
  let db: TestDb;
  let userId: string;
  let owner: TestClient;
  let personId: string;

  beforeAll(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    owner = createClient(db, userId);
    personId = await createPerson(db, userId, 'Ada');
  });

  it('starts as the United States', async () => {
    expect(await owner.expectOk(ME)).toEqual({ me: { defaultCountry: 'US' } });
  });

  it('reads the numbers the caller already has in the new country, and nobody else’s', async () => {
    const strangerId = await createUser(db, 'stranger@example.com');
    const stranger = createClient(db, strangerId);
    const theirPersonId = await createPerson(db, strangerId, 'Grace');
    const london = { type: 'phone', value: '020 7946 0958' };
    const mine = await owner.expectOk<Created>(CREATE, { values: { ...london, personId } });
    const theirs = await stranger.expectOk<Created>(CREATE, { values: { ...london, personId: theirPersonId } });
    expect(mine.createContactInfo.normalizedValue).toBe('02079460958');

    const data = await owner.expectOk(SET_COUNTRY, { country: 'gb' });

    expect(data).toEqual({ setDefaultCountry: { id: userId, defaultCountry: 'GB' } });
    const rows: Array<{ id: string; normalizedValue: string }> = await db
      .select({ id: dbSchema.contactInfos.id, normalizedValue: dbSchema.contactInfos.normalizedValue })
      .from(dbSchema.contactInfos)
      .where(eq(dbSchema.contactInfos.value, london.value));
    const normalizedById = new Map(rows.map((row) => [row.id, row.normalizedValue]));
    expect(normalizedById.get(mine.createContactInfo.id)).toBe('+442079460958');
    expect(normalizedById.get(theirs.createContactInfo.id)).toBe('02079460958');
  });

  it('refuses a word that is no country', async () => {
    await owner.expectError(ErrorCode.BadUserInput, SET_COUNTRY, { country: 'ZZ' });
  });

  it('refuses a caller who is not signed in', async () => {
    await createClient(db, null).expectError(ErrorCode.Unauthenticated, SET_COUNTRY, { country: 'US' });
  });
});
