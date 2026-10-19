import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type ContactCard, ContactCardOutcome, type SaveContactCardResult } from '../../contact-cards/resolvers.ts';
import { ErrorCode } from '../../core/errors.ts';
import {
  closeTestDb,
  createClient,
  createContactInfo,
  createPerson,
  createTestDb,
  createUser,
  resetTestDb,
  type TestClient,
  type TestDb,
} from '../helpers.ts';

const { ContactType, ContactKind, AddressType, ImportantDateKind, labels, personLabels, persons } = dbSchema;

const CARD_FIELDS = `
  personId revision cursor namePrefix firstName middleName lastName nameSuffix nickname organization department
  jobTitle about
  contactInfos { type value kind label isPrimary }
  addresses { type label line1 line2 city state postalCode country isPrimary }
  dates { kind name date hasYear }
`;
const CONTACT_CARDS = `query ($since: Float, $after: String, $limit: Int) {
  contactCards(since: $since, after: $after, limit: $limit) { ${CARD_FIELDS} }
}`;
const SAVE = `mutation ($input: ContactCardInput!) {
  saveContactCard(input: $input) { outcome card { ${CARD_FIELDS} } }
}`;
const DELETE_IF_UNCHANGED = `mutation ($id: UUID!, $revision: Float!) {
  deletePersons(where: { id: { eq: $id }, revision: { eq: $revision } }) { id }
}`;
const MY_LABELS = '{ person: persons(limit: 1) { labels { label } } }';

/** A contact as a phone sends it: Grace, with one of each detail. */
const GRACE = {
  personId: null,
  ifRevision: null,
  namePrefix: null,
  firstName: 'Grace',
  middleName: 'Brewster',
  lastName: 'Hopper',
  nameSuffix: null,
  nickname: 'Amazing Grace',
  organization: 'US Navy',
  department: null,
  jobTitle: 'Rear Admiral',
  about: 'Found the moth.',
  contactInfos: [
    { type: ContactType.Phone, value: '+1 202 555 0100', kind: ContactKind.Mobile, label: null, isPrimary: true },
    { type: ContactType.Email, value: 'grace@example.com', kind: ContactKind.Work, label: null, isPrimary: false },
  ],
  addresses: [
    {
      type: AddressType.Work,
      label: null,
      line1: '1 Navy Way',
      line2: null,
      city: 'Arlington',
      state: 'VA',
      postalCode: '22202',
      country: 'US',
      isPrimary: true,
    },
  ],
  dates: [{ kind: ImportantDateKind.Birthday, name: 'Birthday', date: '1604-12-09', hasYear: false }],
};

describe('contact cards', () => {
  let db: TestDb;
  let userId: string;
  let client: TestClient;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(db);
    userId = await createUser(db, 'me@example.com');
    client = createClient(db, userId);
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  /**
   * Saves a contact.
   *
   * @param input - The contact, as the phone sends it.
   * @returns The result.
   */
  async function save(input: Record<string, unknown>): Promise<SaveContactCardResult> {
    const data = await client.expectOk<{ saveContactCard: SaveContactCardResult }>(SAVE, { input });
    return data.saveContactCard;
  }

  /**
   * Lists the caller's cards.
   *
   * @param variables - `since`, `after` and `limit`.
   * @returns The cards.
   */
  async function list(variables: Record<string, unknown> = {}): Promise<ContactCard[]> {
    const data = await client.expectOk<{ contactCards: ContactCard[] }>(CONTACT_CARDS, variables);
    return data.contactCards;
  }

  it('lists only the caller’s people, with their details, a page at a time', async () => {
    const ids = [await createPerson(db, userId, 'Ada'), await createPerson(db, userId, 'Alan')].sort();
    await createContactInfo(db, { userId, personId: ids[0], type: ContactType.Email, value: 'one@example.com' });
    const stranger = await createUser(db, 'them@example.com');
    await createPerson(db, stranger, 'Not mine');

    const first = await list({ limit: 1 });
    const second = await list({ limit: 1, after: first[0]?.cursor });
    const third = await list({ limit: 1, after: second[0]?.cursor });

    expect([...first, ...second].map((card) => card.personId)).toEqual(ids);
    expect(third).toEqual([]);
    expect(first[0]?.contactInfos).toEqual([
      { type: ContactType.Email, value: 'one@example.com', kind: null, label: null, isPrimary: false },
    ]);
  });

  it('leaves out the people not changed after `since`', async () => {
    const created = await save(GRACE);
    const revision = created.card?.revision ?? 0;
    await save({ ...GRACE, firstName: 'Later', contactInfos: [], addresses: [], dates: [] });

    const changed = await list({ since: revision });

    expect(changed.map((card) => card.firstName)).toEqual(['Later']);
  });

  it('makes a person from a contact the phone made', async () => {
    const { outcome, card } = await save(GRACE);

    expect(outcome).toBe(ContactCardOutcome.Created);
    expect(card?.revision).toBeGreaterThan(0);
    expect(card).toMatchObject({
      firstName: 'Grace',
      nickname: 'Amazing Grace',
      jobTitle: 'Rear Admiral',
      about: 'Found the moth.',
      dates: GRACE.dates,
      addresses: GRACE.addresses,
    });
    expect(card?.contactInfos).toHaveLength(2);
  });

  it('replaces what a person holds, and keeps their labels', async () => {
    const created = await save(GRACE);
    const personId = created.card?.personId ?? '';
    const [label] = await db.insert(labels).values({ userId, label: 'Navy', color: '#000000' }).returning();
    await db.insert(personLabels).values({ userId, personId, labelId: label.id });
    const [before] = await db.select({ revision: persons.revision }).from(persons).where(eq(persons.id, personId));

    const { outcome, card } = await save({
      ...GRACE,
      personId,
      ifRevision: before.revision,
      nickname: null,
      contactInfos: [GRACE.contactInfos[1]],
      addresses: [],
    });

    expect(outcome).toBe(ContactCardOutcome.Updated);
    expect(card?.nickname).toBeNull();
    expect(card?.contactInfos.map((info) => info.type)).toEqual([ContactType.Email]);
    expect(card?.addresses).toEqual([]);
    expect(card?.revision).toBeGreaterThan(before.revision);
    const labelled = await client.expectOk<{ person: Array<{ labels: Array<{ label: string }> }> }>(MY_LABELS);
    expect(labelled.person[0]?.labels).toEqual([{ label: 'Navy' }]);
  });

  it('writes nothing over a person who changed after the phone last saw them', async () => {
    const created = await save(GRACE);
    const personId = created.card?.personId ?? '';
    const stale = created.card?.revision ?? 0;
    await client.expectOk(
      'mutation ($id: UUID!) { updatePerson(set: { nickname: "Grandma COBOL" }, where: { id: { eq: $id } }) { id } }',
      {
        id: personId,
      },
    );

    const { outcome, card } = await save({ ...GRACE, personId, ifRevision: stale, firstName: 'Phone edit' });

    expect(outcome).toBe(ContactCardOutcome.Conflict);
    expect(card).toMatchObject({ firstName: 'Grace', nickname: 'Grandma COBOL' });
  });

  it('calls a person who is gone, or is someone else’s, a conflict and says nothing of them', async () => {
    const stranger = await createUser(db, 'them@example.com');
    const theirs = await createPerson(db, stranger, 'Theirs');

    const { outcome, card } = await save({ ...GRACE, personId: theirs, ifRevision: 1 });

    expect(outcome).toBe(ContactCardOutcome.Conflict);
    expect(card).toBeNull();
    const [untouched] = await db.select().from(persons).where(eq(persons.id, theirs));
    expect(untouched.firstName).toBe('Theirs');
  });

  it('refuses a change with no revision to check, and a contact with no name', async () => {
    const created = await save(GRACE);

    await client.expectError(ErrorCode.BadUserInput, SAVE, {
      input: { ...GRACE, personId: created.card?.personId },
    });
    await client.expectError(ErrorCode.BadUserInput, SAVE, {
      input: { ...GRACE, firstName: null, middleName: null, lastName: null, nickname: null, organization: null },
    });
    await client.expectError(ErrorCode.BadUserInput, SAVE, {
      input: { ...GRACE, contactInfos: [{ ...GRACE.contactInfos[0], type: 'pager' }] },
    });
  });

  it('deletes through the generated mutation only while the revision still matches', async () => {
    const created = await save(GRACE);
    const id = created.card?.personId ?? '';
    const revision = created.card?.revision ?? 0;

    const stale = await client.expectOk<{ deletePersons: unknown[] }>(DELETE_IF_UNCHANGED, {
      id,
      revision: revision - 1,
    });
    const current = await client.expectOk<{ deletePersons: unknown[] }>(DELETE_IF_UNCHANGED, { id, revision });

    expect(stale.deletePersons).toEqual([]);
    expect(current.deletePersons).toEqual([{ id }]);
  });

  it('needs a signed-in caller', async () => {
    const anonymous = createClient(db, null);

    await anonymous.expectError(ErrorCode.Unauthenticated, CONTACT_CARDS);
    await anonymous.expectError(ErrorCode.Unauthenticated, SAVE, { input: GRACE });
  });
});
