import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq, is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { WRITE_HOOKS } from '../../graphql/build-schema.ts';
import { CARD_TABLES, type CardTable, OFF_CARD_TABLES } from '../../persons/revision-hooks.ts';
import { createClient, createContactInfo, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const { addresses, importantDates, labels, personLabels, persons, personTombstones, users } = dbSchema;

/** The rows each test starts with: one person with one of every detail a card carries. */
interface Fixture {
  personId: string;
  contactInfoId: string;
  addressId: string;
  importantDateId: string;
  /** The label the person wears. */
  labelId: string;
  /** A label nobody wears. */
  spareLabelId: string;
}

/** One generated write, and whether it changes the fixture's person. */
interface WriteCase {
  mutation: string;
  variables: (fixture: Fixture) => Record<string, unknown>;
  /** False for a write that touches nobody's card. */
  changesPerson: boolean;
}

/** The kinds of generated write every card table takes. */
type WriteKind = 'insert' | 'update' | 'delete';

const byId = (id: string) => ({ id });

// No mutation here selects `id` or `personId`: the hooks have to find the person without them.
/** A write of each kind to each table whose rows hang off a person. Adding a card table fails to compile until it has all three. */
const DETAIL_WRITES: Record<Exclude<CardTable, 'persons'>, Record<WriteKind, WriteCase>> = {
  contactInfos: {
    insert: {
      mutation:
        'mutation ($personId: UUID!) { createContactInfo(values: { personId: $personId, type: email, value: "new@example.com" }) { value } }',
      variables: ({ personId }) => ({ personId }),
      changesPerson: true,
    },
    update: {
      mutation:
        'mutation ($id: UUID!) { updateContactInfo(set: { value: "changed@example.com" }, where: { id: { eq: $id } }) { value } }',
      variables: ({ contactInfoId }) => byId(contactInfoId),
      changesPerson: true,
    },
    delete: {
      mutation: 'mutation ($id: UUID!) { deleteContactInfo(where: { id: { eq: $id } }) { value } }',
      variables: ({ contactInfoId }) => byId(contactInfoId),
      changesPerson: true,
    },
  },
  addresses: {
    insert: {
      mutation:
        'mutation ($personId: UUID!) { createAddress(values: { personId: $personId, type: home, line1: "1 New Street" }) { line1 } }',
      variables: ({ personId }) => ({ personId }),
      changesPerson: true,
    },
    update: {
      mutation: 'mutation ($id: UUID!) { updateAddress(set: { city: "Leeds" }, where: { id: { eq: $id } }) { city } }',
      variables: ({ addressId }) => byId(addressId),
      changesPerson: true,
    },
    delete: {
      mutation: 'mutation ($id: UUID!) { deleteAddress(where: { id: { eq: $id } }) { line1 } }',
      variables: ({ addressId }) => byId(addressId),
      changesPerson: true,
    },
  },
  importantDates: {
    insert: {
      mutation:
        'mutation ($personId: UUID!) { createImportantDate(values: { personId: $personId, name: "Graduation", date: "2001-06-01" }) { name } }',
      variables: ({ personId }) => ({ personId }),
      changesPerson: true,
    },
    update: {
      mutation:
        'mutation ($id: UUID!) { updateImportantDate(set: { date: "1990-03-04" }, where: { id: { eq: $id } }) { date } }',
      variables: ({ importantDateId }) => byId(importantDateId),
      changesPerson: true,
    },
    delete: {
      mutation: 'mutation ($id: UUID!) { deleteImportantDate(where: { id: { eq: $id } }) { name } }',
      variables: ({ importantDateId }) => byId(importantDateId),
      changesPerson: true,
    },
  },
  personLabels: {
    insert: {
      mutation:
        'mutation ($personId: UUID!, $labelId: UUID!) { createPersonLabel(values: { personId: $personId, labelId: $labelId }) { labelId } }',
      variables: ({ personId, spareLabelId }) => ({ personId, labelId: spareLabelId }),
      changesPerson: true,
    },
    update: {
      mutation:
        'mutation ($from: UUID!, $to: UUID!) { updatePersonLabel(set: { labelId: $to }, where: { labelId: { eq: $from } }) { labelId } }',
      variables: ({ labelId, spareLabelId }) => ({ from: labelId, to: spareLabelId }),
      changesPerson: true,
    },
    delete: {
      mutation: 'mutation ($labelId: UUID!) { deletePersonLabel(where: { labelId: { eq: $labelId } }) { labelId } }',
      variables: ({ labelId }) => ({ labelId }),
      changesPerson: true,
    },
  },
  labels: {
    insert: {
      mutation: 'mutation { createLabel(values: { label: "Brand new", color: "#112233" }) { label } }',
      variables: () => ({}),
      // Nobody wears a label that was only just made.
      changesPerson: false,
    },
    update: {
      mutation:
        'mutation ($id: UUID!) { updateLabel(set: { label: "Renamed" }, where: { id: { eq: $id } }) { label } }',
      variables: ({ labelId }) => byId(labelId),
      changesPerson: true,
    },
    delete: {
      mutation: 'mutation ($id: UUID!) { deleteLabel(where: { id: { eq: $id } }) { label } }',
      variables: ({ labelId }) => byId(labelId),
      changesPerson: true,
    },
  },
};

const DETAIL_CASES = Object.entries(DETAIL_WRITES).flatMap(([table, kinds]) =>
  Object.entries(kinds).map(([kind, write]) => ({ table, kind, write })),
);

const CREATE_PERSON = 'mutation { createPerson(values: { firstName: "Ada" }) { firstName } }';
const CREATE_TWO_PERSONS =
  'mutation { createPersons(values: [{ firstName: "Ada" }, { organization: "Acme" }]) { firstName } }';
const RENAME_PERSON =
  'mutation ($id: UUID!) { updatePerson(set: { firstName: "Renamed" }, where: { id: { eq: $id } }) { firstName } }';
const RENAME_BY_NAME =
  'mutation ($name: String!) { updatePersons(set: { nickname: "Nick" }, where: { firstName: { eq: $name } }) { nickname } }';
const RENAME_EACH =
  'mutation ($first: UUID!, $second: UUID!) { updatePersonsMany(updates: [{ set: { nickname: "One" }, where: { id: { eq: $first } } }, { set: { nickname: "Two" }, where: { id: { eq: $second } } }]) { nickname } }';
const RENAME_LABELLED =
  'mutation ($labelId: UUID!) { updatePersons(set: { nickname: "Nick" }, where: { labels: { some: { id: { eq: $labelId } } } }) { nickname } }';
const DELETE_PERSON = 'mutation ($id: UUID!) { deletePerson(where: { id: { eq: $id } }) { firstName } }';
const MERGE = 'mutation ($keepId: UUID!, $mergeId: UUID!) { mergePersons(keepId: $keepId, mergeId: $mergeId) }';
const MERGE_LABELS =
  'mutation ($keepId: UUID!, $deleteId: UUID!) { mergeLabelInto(keepId: $keepId, deleteId: $deleteId) { id } }';
const IMPORT = 'mutation ($csv: String!) { importGoogleContacts(csv: $csv) { imported merged errors } }';
const CHANGED_SINCE =
  'query ($since: Float!) { persons(where: { revision: { gt: $since } }) { id revision } personTombstones(where: { revision: { gt: $since } }) { uid revision } }';
const MY_REVISION = '{ me { personsRevision } }';
const CREATE_TOMBSTONE = 'mutation { createPersonTombstone(values: { uid: "x", revision: 1 }) { uid } }';
const SET_REVISION =
  'mutation ($id: UUID!) { updatePerson(set: { revision: 99 }, where: { id: { eq: $id } }) { firstName } }';

describe("a person's revision", () => {
  let db: TestDb;
  let userId: string;
  let otherUserId: string;
  let fixture: Fixture;

  /**
   * Reads a person's revision.
   *
   * @param id - The person.
   * @returns The revision, or undefined once they are gone.
   */
  async function revisionOf(id: string): Promise<number | undefined> {
    const [person] = await db.select({ revision: persons.revision }).from(persons).where(eq(persons.id, id));
    return person?.revision;
  }

  /**
   * Reads how many times a user's people have changed.
   *
   * @param id - The user.
   * @returns The user's counter.
   */
  async function counterOf(id: string): Promise<number> {
    const [user] = await db.select({ count: users.personsRevision }).from(users).where(eq(users.id, id));
    return user.count;
  }

  /**
   * Inserts a label.
   *
   * @param name - Its name.
   * @returns Its id.
   */
  async function createLabel(name: string): Promise<string> {
    const [label] = await db.insert(labels).values({ userId, label: name, color: '#445566' }).returning();
    return label.id;
  }

  beforeEach(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    otherUserId = await createUser(db, 'other@example.com');
    const personId = await createPerson(db, userId, 'Ada');
    const contactInfoId = await createContactInfo(db, {
      userId,
      personId,
      type: dbSchema.ContactType.Email,
      value: 'ada@example.com',
    });
    const [address] = await db
      .insert(addresses)
      .values({ userId, personId, type: dbSchema.AddressType.Home, line1: '1 Old Street' })
      .returning();
    const [date] = await db
      .insert(importantDates)
      .values({ userId, personId, name: 'Birthday', date: '1990-01-02' })
      .returning();
    const labelId = await createLabel('Friends');
    const spareLabelId = await createLabel('Spare');
    await db.insert(personLabels).values({ userId, personId, labelId });
    fixture = { personId, contactInfoId, addressId: address.id, importantDateId: date.id, labelId, spareLabelId };
  });

  it.each(DETAIL_CASES)('moves on a generated $kind of $table', async ({ write }) => {
    const before = await revisionOf(fixture.personId);
    const countBefore = await counterOf(userId);

    await createClient(db, userId).expectOk(write.mutation, write.variables(fixture));

    if (write.changesPerson) {
      expect(await revisionOf(fixture.personId)).toBe(countBefore + 1);
      expect(await counterOf(userId)).toBe(countBefore + 1);
    } else {
      expect(await revisionOf(fixture.personId)).toBe(before);
      expect(await counterOf(userId)).toBe(countBefore);
    }
  });

  it('has a hook on every card table, and a reason for every other table that points at a person', () => {
    const tables = Object.entries(dbSchema).flatMap(([key, value]) =>
      is(value, PgTable) ? [{ key, table: value }] : [],
    );
    const pointingAtPersons = tables
      .filter(({ table }) => getTableConfig(table).foreignKeys.some((fk) => fk.reference().foreignTable === persons))
      .map(({ key }) => key);
    const cardTables: string[] = [...CARD_TABLES];
    const isAccountedFor = (key: string) => cardTables.includes(key) || Object.hasOwn(OFF_CARD_TABLES, key);

    expect(pointingAtPersons.filter((key) => isAccountedFor(key) === false)).toEqual([]);
    expect(Object.keys(OFF_CARD_TABLES).filter((key) => pointingAtPersons.includes(key) === false)).toEqual([]);
    expect(cardTables.filter((key) => key in WRITE_HOOKS === false)).toEqual([]);
    expect(Object.keys(DETAIL_WRITES).sort()).toEqual(cardTables.filter((key) => key !== 'persons').sort());
  });

  it('gives a new person the next revision', async () => {
    const countBefore = await counterOf(userId);

    await createClient(db, userId).expectOk(CREATE_PERSON);

    const people: Array<{ revision: number }> = await db.select({ revision: persons.revision }).from(persons);
    // The fixture's person was inserted behind the API's back, and is swept up with the new one.
    expect(people.map((person) => person.revision)).toEqual([countBefore + 1, countBefore + 1]);
    expect(await counterOf(userId)).toBe(countBefore + 1);
  });

  it('tells the user how many changes their people have seen', async () => {
    const client = createClient(db, userId);
    await client.expectOk(CREATE_PERSON);

    const data = await client.expectOk<{ me: { personsRevision: number } }>(MY_REVISION);

    expect(data.me.personsRevision).toBe(await counterOf(userId));
  });

  it('counts a batch of new people as one change', async () => {
    const countBefore = await counterOf(userId);

    await createClient(db, userId).expectOk(CREATE_TWO_PERSONS);

    const [company] = await db.select().from(persons).where(eq(persons.organization, 'Acme'));
    expect(company.revision).toBe(countBefore + 1);
    expect(await counterOf(userId)).toBe(countBefore + 1);
  });

  it('moves on when the person is edited', async () => {
    await createClient(db, userId).expectOk(RENAME_PERSON, byId(fixture.personId));

    expect(await revisionOf(fixture.personId)).toBe(1);
  });

  it('moves on for exactly the people a filtered update reaches', async () => {
    const graceId = await createPerson(db, userId, 'Grace');

    await createClient(db, userId).expectOk(RENAME_BY_NAME, { name: 'Grace' });

    expect(await revisionOf(graceId)).toBe(1);
    expect(await revisionOf(fixture.personId)).toBe(dbSchema.UNREVISED);
  });

  it('moves on for each person a batch update names', async () => {
    const graceId = await createPerson(db, userId, 'Grace');
    const linusId = await createPerson(db, userId, 'Linus');

    await createClient(db, userId).expectOk(RENAME_EACH, { first: fixture.personId, second: graceId });

    expect(await revisionOf(fixture.personId)).toBe(1);
    expect(await revisionOf(graceId)).toBe(1);
    expect(await revisionOf(linusId)).toBe(dbSchema.UNREVISED);
  });

  it('moves on for the people an update reaches through a relation', async () => {
    await createClient(db, userId).expectOk(RENAME_LABELLED, { labelId: fixture.labelId });

    expect(await revisionOf(fixture.personId)).toBeGreaterThan(dbSchema.UNREVISED);
  });

  it("stays put when another user's write names the person", async () => {
    const theirs = createClient(db, otherUserId);

    await theirs.expectOk(RENAME_PERSON, byId(fixture.personId));
    await theirs.run(DETAIL_WRITES.contactInfos.insert.mutation, { personId: fixture.personId });
    await theirs.expectOk(DETAIL_WRITES.contactInfos.delete.mutation, byId(fixture.contactInfoId));

    expect(await revisionOf(fixture.personId)).toBe(dbSchema.UNREVISED);
    expect(await counterOf(userId)).toBe(0);
    expect(await counterOf(otherUserId)).toBe(0);
  });

  it('is not the client’s to set', async () => {
    const result = await createClient(db, userId).run(SET_REVISION, byId(fixture.personId));

    expect(result.errors).toBeDefined();
  });

  it('leaves a tombstone when the person is deleted', async () => {
    const [{ uid }] = await db.select({ uid: persons.uid }).from(persons).where(eq(persons.id, fixture.personId));

    await createClient(db, userId).expectOk(DELETE_PERSON, byId(fixture.personId));

    const tombstones = await db.select().from(personTombstones);
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]).toMatchObject({ userId, personId: fixture.personId, uid, revision: 1 });
    expect(await counterOf(userId)).toBe(1);
  });

  it("leaves no tombstone for a delete that names someone else's person", async () => {
    await createClient(db, otherUserId).expectOk(DELETE_PERSON, byId(fixture.personId));

    expect(await db.select().from(personTombstones)).toEqual([]);
    expect(await revisionOf(fixture.personId)).toBe(dbSchema.UNREVISED);
  });

  it('moves the kept person on and buries the merged one on a merge', async () => {
    const mergeId = await createPerson(db, userId, 'Ada');

    await createClient(db, userId).expectOk(MERGE, { keepId: fixture.personId, mergeId });

    expect(await revisionOf(fixture.personId)).toBe(1);
    const [tombstone] = await db.select().from(personTombstones);
    expect(tombstone).toMatchObject({ personId: mergeId, revision: 2 });
  });

  it('moves on for everyone who wears a label that is merged into another', async () => {
    await createClient(db, userId).expectOk(MERGE_LABELS, { keepId: fixture.spareLabelId, deleteId: fixture.labelId });

    expect(await revisionOf(fixture.personId)).toBe(1);
  });

  it('gives imported people a revision, and moves on the ones an import adds to', async () => {
    const csv = [
      'First Name,Last Name,E-mail 1 - Value,Phone 1 - Value',
      'Ada,Test,ada@example.com,555-0100',
      'Grace,Hopper,grace@example.com,',
    ].join('\n');

    await createClient(db, userId).expectOk(IMPORT, { csv });

    const [grace] = await db.select().from(persons).where(eq(persons.firstName, 'Grace'));
    expect(grace.revision).toBe(1);
    expect(await revisionOf(fixture.personId)).toBe(1);
  });

  it('lets a client ask for what changed after a revision, and only for its own', async () => {
    const client = createClient(db, userId);
    const goneId = await createPerson(db, userId, 'Gone');
    await client.expectOk(RENAME_PERSON, byId(fixture.personId));
    const since = await counterOf(userId);
    await client.expectOk(DETAIL_WRITES.addresses.update.mutation, byId(fixture.addressId));
    await client.expectOk(DELETE_PERSON, byId(goneId));

    const mine = await client.expectOk(CHANGED_SINCE, { since });
    const theirs = await createClient(db, otherUserId).expectOk(CHANGED_SINCE, { since: 0 });

    expect(mine).toMatchObject({
      persons: [{ id: fixture.personId, revision: since + 1 }],
      personTombstones: [{ revision: since + 2 }],
    });
    expect(theirs).toEqual({ persons: [], personTombstones: [] });
  });

  it('serves tombstones read-only', async () => {
    const result = await createClient(db, userId).run(CREATE_TOMBSTONE);

    expect(result.errors).toBeDefined();
    expect(await db.select().from(personTombstones)).toEqual([]);
  });
});
