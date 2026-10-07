import * as dbSchema from '@cubicecho/philotes-db/schema';
import { ContactType } from '@cubicecho/philotes-db/schema';
import { and, eq, getTableName, is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import { PERSON_JUNCTIONS, PERSON_OWNED_TABLES, SPECIALLY_MERGED_TABLES } from '../../persons/duplicates.ts';
import { createClient, createPerson, createTestDb, createUser, type TestClient, type TestDb } from '../helpers.ts';

const DUPLICATES = 'query { potentialDuplicates { matchValue matchType personIds } }';
const MERGE = 'mutation ($keepId: UUID!, $mergeId: UUID!) { mergePersons(keepId: $keepId, mergeId: $mergeId) }';

/** What the duplicates query returns. */
interface DuplicatesData {
  potentialDuplicates: Array<{ matchValue: string; matchType: string; personIds: string[] }>;
}

describe('duplicate people', () => {
  it('has a merge rule for every table that points at a person', () => {
    const exported: unknown[] = Object.values(dbSchema);
    const pointingAtPersons = exported
      .flatMap((value) => (is(value, PgTable) ? [value] : []))
      .filter((table) =>
        getTableConfig(table).foreignKeys.some((key) => key.reference().foreignTable === dbSchema.persons),
      )
      .map((table) => getTableName(table))
      .sort();
    const merged = [
      ...PERSON_OWNED_TABLES.map((entry) => entry.table),
      ...PERSON_JUNCTIONS.map((entry) => entry.table),
      ...SPECIALLY_MERGED_TABLES,
    ]
      .map((table) => getTableName(table))
      .sort();

    expect(merged).toEqual(pointingAtPersons);
  });

  let db: TestDb;
  let userId: string;
  let strangerId: string;
  let owner: TestClient;
  let keepId: string;
  let mergeId: string;

  /**
   * Inserts a contact detail for the owner.
   *
   * @param personId - The person the detail reaches.
   * @param value - The detail.
   * @param type - What kind of detail it is.
   * @returns Nothing, once the row is written.
   */
  async function addDetail(personId: string, value: string, type: ContactType = ContactType.Email): Promise<void> {
    await db.insert(dbSchema.contactInfos).values({ personId, userId, type, value, isPrimary: true });
  }

  beforeEach(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    strangerId = await createUser(db, 'stranger@example.com');
    owner = createClient(db, userId);
    keepId = await createPerson(db, userId, 'Ada');
    mergeId = await createPerson(db, userId, 'Ada L.');
  });

  it('groups people who share a contact detail, whatever its case', async () => {
    await addDetail(keepId, 'ada@example.com');
    await addDetail(mergeId, ' Ada@Example.com ');
    await addDetail(mergeId, '555-0100', ContactType.Phone);

    const data = await owner.expectOk<DuplicatesData>(DUPLICATES);

    expect(data.potentialDuplicates).toEqual([
      { matchValue: 'ada@example.com', matchType: ContactType.Email, personIds: [keepId, mergeId].sort() },
    ]);
  });

  it('counts a person’s own email as an email detail', async () => {
    await db.update(dbSchema.persons).set({ email: 'ada@example.com' }).where(eq(dbSchema.persons.id, keepId));
    await addDetail(mergeId, 'ada@example.com');

    const data = await owner.expectOk<DuplicatesData>(DUPLICATES);

    expect(data.potentialDuplicates.map((group) => group.personIds)).toEqual([[keepId, mergeId].sort()]);
  });

  it('does not match across users', async () => {
    const theirs = await createPerson(db, strangerId, 'Grace');
    await addDetail(keepId, 'shared@example.com');
    await db
      .insert(dbSchema.contactInfos)
      .values({ personId: theirs, userId: strangerId, type: ContactType.Email, value: 'shared@example.com' });

    const data = await owner.expectOk<DuplicatesData>(DUPLICATES);

    expect(data.potentialDuplicates).toEqual([]);
  });

  it('moves what was recorded about the merged person to the kept one', async () => {
    await db.insert(dbSchema.notes).values({ userId, personId: mergeId, body: 'Met at the fair' });
    await db.insert(dbSchema.gratitudes).values({ userId, personId: mergeId, body: 'Patient' });
    await db
      .update(dbSchema.userPersons)
      .set({ howWeMet: 'At the fair' })
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, mergeId)));

    await owner.expectOk(MERGE, { keepId, mergeId });

    const notes = await db.select({ personId: dbSchema.notes.personId }).from(dbSchema.notes);
    const gratitudes = await db.select({ personId: dbSchema.gratitudes.personId }).from(dbSchema.gratitudes);
    const links = await db.select().from(dbSchema.userPersons).where(eq(dbSchema.userPersons.userId, userId));
    expect(notes).toEqual([{ personId: keepId }]);
    expect(gratitudes).toEqual([{ personId: keepId }]);
    expect(links.map((link: { personId: string; howWeMet: string | null }) => [link.personId, link.howWeMet])).toEqual([
      [keepId, 'At the fair'],
    ]);
  });

  it('keeps one of a contact detail both people had, and the kept person’s primary', async () => {
    await addDetail(keepId, 'ada@example.com');
    await addDetail(mergeId, 'ADA@example.com');
    await addDetail(mergeId, '555-0100', ContactType.Phone);

    await owner.expectOk(MERGE, { keepId, mergeId });

    const rows = await db
      .select({
        personId: dbSchema.contactInfos.personId,
        value: dbSchema.contactInfos.value,
        isPrimary: dbSchema.contactInfos.isPrimary,
      })
      .from(dbSchema.contactInfos)
      .orderBy(dbSchema.contactInfos.value);
    expect(rows).toEqual([
      { personId: keepId, value: '555-0100', isPrimary: false },
      { personId: keepId, value: 'ada@example.com', isPrimary: true },
    ]);
  });

  it('merges labels and relationships without doubling them or joining the person to themselves', async () => {
    const friendId = await createPerson(db, userId, 'Charles');
    const [label] = await db
      .insert(dbSchema.labels)
      .values({ label: 'friends', color: '#6b7280', userId })
      .returning({ id: dbSchema.labels.id });
    await db.insert(dbSchema.personLabels).values([
      { personId: keepId, labelId: label.id, userId },
      { personId: mergeId, labelId: label.id, userId },
    ]);
    await db.insert(dbSchema.personRelationships).values([
      { userId, fromPersonId: keepId, toPersonId: friendId, type: 'friend' },
      { userId, fromPersonId: mergeId, toPersonId: friendId, type: 'friend' },
      { userId, fromPersonId: mergeId, toPersonId: keepId, type: 'sibling' },
    ]);

    await owner.expectOk(MERGE, { keepId, mergeId });

    const labels = await db.select({ personId: dbSchema.personLabels.personId }).from(dbSchema.personLabels);
    const relationships = await db
      .select({ from: dbSchema.personRelationships.fromPersonId, to: dbSchema.personRelationships.toPersonId })
      .from(dbSchema.personRelationships);
    expect(labels).toEqual([{ personId: keepId }]);
    expect(relationships).toEqual([{ from: keepId, to: friendId }]);
  });

  it('drops a tag that would put the kept person on their own date', async () => {
    const [date] = await db
      .insert(dbSchema.importantDates)
      .values({ userId, personId: keepId, name: 'Anniversary', date: '2020-06-01' })
      .returning({ id: dbSchema.importantDates.id });
    await db.insert(dbSchema.importantDatePersons).values({ importantDateId: date.id, personId: mergeId, userId });

    await owner.expectOk(MERGE, { keepId, mergeId });

    expect(await db.select().from(dbSchema.importantDatePersons)).toEqual([]);
  });

  it('leaves the shared person row for another user who has it', async () => {
    await db.insert(dbSchema.userPersons).values({ userId: strangerId, personId: mergeId });

    await owner.expectOk(MERGE, { keepId, mergeId });

    const links = await db.select().from(dbSchema.userPersons).where(eq(dbSchema.userPersons.personId, mergeId));
    expect(links.map((link: { userId: string }) => link.userId)).toEqual([strangerId]);
  });

  it('answers "not found" for a person outside the caller’s contacts, and writes nothing', async () => {
    const theirs = await createPerson(db, strangerId, 'Grace');

    await owner.expectError(ErrorCode.NotFound, MERGE, { keepId, mergeId: theirs });
    await owner.expectError(ErrorCode.NotFound, MERGE, { keepId: theirs, mergeId });

    const links = await db.select().from(dbSchema.userPersons).where(eq(dbSchema.userPersons.userId, userId));
    expect(links).toHaveLength(2);
  });

  it('refuses to merge a person into themselves', async () => {
    await owner.expectError(ErrorCode.BadUserInput, MERGE, { keepId, mergeId: keepId });
  });
});
