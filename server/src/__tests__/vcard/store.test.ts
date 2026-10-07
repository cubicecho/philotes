import { Readable } from 'node:stream';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../core/errors.ts';
import type { Transaction } from '../../graphql/write-guards.ts';
import type { AvatarStore } from '../../persons/avatar-store.ts';
import { type Card, emptyCard } from '../../vcard/card.ts';
import {
  CardRejectedError,
  findPersonByUid,
  readCards,
  SaveMode,
  type SaveOptions,
  saveCard,
} from '../../vcard/store.ts';
import { createClient, createContactInfo, createPerson, createTestDb, createUser, type TestDb } from '../helpers.ts';

const { ContactKind, ContactType, ImportantDateKind, AddressType } = dbSchema;
const COUNTRY = 'US';
const IMPORT = 'mutation ($vcf: String!) { importVCards(vcf: $vcf) { imported merged skipped errors } }';
const EXPORT = '{ exportVCards }';

/**
 * Builds a store that keeps its files in a map.
 *
 * @returns The store and its files.
 */
function memoryStore(): { store: AvatarStore; files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  const store: AvatarStore = {
    prepare: async () => {},
    put: async (name, body) => {
      files.set(name, body);
    },
    read: async (name) => {
      const body = files.get(name);
      return body === undefined ? null : Readable.from([body]);
    },
    remove: async (name) => {
      files.delete(name);
    },
  };
  return { store, files };
}

/** Ada's card, with one of everything. */
const ADA: Card = {
  ...emptyCard(),
  uid: 'ada-uid',
  firstName: 'Ada',
  lastName: 'Lovelace',
  organization: 'Analytical Engines',
  about: 'Wrote the first program.',
  contactInfos: [
    { type: ContactType.Email, value: 'ada@example.com', kind: ContactKind.Home, label: null, isPrimary: true },
    { type: ContactType.Phone, value: '(202) 555-0100', kind: ContactKind.Mobile, label: 'Boat', isPrimary: false },
  ],
  addresses: [
    {
      type: AddressType.Home,
      label: null,
      line1: '1 Main St',
      line2: null,
      city: 'London',
      state: null,
      postalCode: 'N1',
      country: 'UK',
      isPrimary: false,
    },
  ],
  dates: [
    { kind: ImportantDateKind.Birthday, name: 'Birthday', date: '1604-12-10', hasYear: false },
    { kind: ImportantDateKind.Other, name: 'Graduation', date: '2010-05-06', hasYear: true },
  ],
  labels: ['Friends', 'Mathematicians'],
  extra: '[["x-phonetic-first-name",{},"unknown","Ay-da"]]',
};

describe('saving and reading a contact card', () => {
  let db: TestDb;
  let userId: string;
  let otherUserId: string;

  /**
   * Saves a card in a transaction of its own.
   *
   * @param card - The card.
   * @param options - What differs from a new person saved without pictures.
   * @param ownerId - The user to save for.
   * @returns What the save did.
   */
  function save(card: Card, options: Partial<SaveOptions> = {}, ownerId = userId) {
    return db.transaction((tx: Transaction) =>
      saveCard(tx, ownerId, card, {
        mode: SaveMode.Replace,
        personId: null,
        country: COUNTRY,
        avatars: null,
        ...options,
      }),
    );
  }

  /**
   * Reads a user's change count.
   *
   * @returns The count.
   */
  async function revisionOfUser(): Promise<number> {
    const [user] = await db.select().from(dbSchema.users).where(eq(dbSchema.users.id, userId));
    return user.personsRevision;
  }

  beforeEach(async () => {
    db = await createTestDb();
    userId = await createUser(db, 'owner@example.com');
    otherUserId = await createUser(db, 'other@example.com');
  });

  it('makes a person who reads back as the same card', async () => {
    const saved = await save(ADA);

    const [stored] = await readCards(db, userId);
    expect(saved).toEqual({ personId: stored.personId, isNew: true, hasChanged: true });
    expect(stored.card).toEqual(ADA);
    expect(stored.uid).toBe('ada-uid');
    expect(stored.revision).toBe(await revisionOfUser());
    expect(stored.revision).toBeGreaterThan(0);
  });

  it('stores a number in the form a caller is matched on', async () => {
    await save(ADA);

    const [phone] = await db
      .select()
      .from(dbSchema.contactInfos)
      .where(eq(dbSchema.contactInfos.type, ContactType.Phone));
    expect(phone.normalizedValue).toBe('+12025550100');
  });

  it('gives a person with no UID one of their own', async () => {
    await save({ ...emptyCard(), firstName: 'Grace' });

    const [stored] = await readCards(db, userId);
    expect(stored.uid).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.card.uid).toBe(stored.uid);
  });

  it("makes the labels a card names, and reuses the user's own whatever their case", async () => {
    await db.insert(dbSchema.labels).values({ userId, label: 'friends', color: '#ff0000' });
    await db.insert(dbSchema.labels).values({ userId: otherUserId, label: 'Mathematicians', color: '#ff0000' });

    await save(ADA);

    const mine = await db.select().from(dbSchema.labels).where(eq(dbSchema.labels.userId, userId));
    expect(mine.map((label: { label: string }) => label.label).sort()).toEqual(['Mathematicians', 'friends']);
    const [stored] = await readCards(db, userId);
    expect([...stored.card.labels].sort()).toEqual(['Mathematicians', 'friends']);
  });

  it('changes nothing, and counts no change, when the person already holds the card', async () => {
    const { personId } = await save(ADA);
    const before = await revisionOfUser();

    const again = await save(ADA, { personId });

    expect(again).toEqual({ personId, isNew: false, hasChanged: false });
    expect(await revisionOfUser()).toBe(before);
  });

  it('replaces what a person holds with what the card says, keeping the rows that did not change', async () => {
    const { personId } = await save(ADA);
    const before = await db.select().from(dbSchema.contactInfos).where(eq(dbSchema.contactInfos.personId, personId));
    const emailId = before.find((row: { type: string }) => row.type === ContactType.Email)?.id;
    const edited: Card = {
      ...ADA,
      lastName: 'King',
      organization: null,
      contactInfos: [
        { ...ADA.contactInfos[0], kind: ContactKind.Work },
        { type: ContactType.Phone, value: '+44 20 7946 0000', kind: null, label: null, isPrimary: false },
      ],
      addresses: [],
      dates: [{ kind: ImportantDateKind.Birthday, name: 'Birthday', date: '1815-12-10', hasYear: true }],
      labels: ['Friends'],
      extra: null,
    };

    const saved = await save(edited, { personId });

    const [stored] = await readCards(db, userId);
    expect(saved.hasChanged).toBe(true);
    expect(stored.card).toEqual(edited);
    expect(stored.revision).toBe(await revisionOfUser());
    const after = await db.select().from(dbSchema.contactInfos).where(eq(dbSchema.contactInfos.personId, personId));
    expect(after.find((row: { type: string }) => row.type === ContactType.Email)?.id).toBe(emailId);
  });

  it('takes the same number written another way for the one the person has', async () => {
    const { personId } = await save(ADA);

    await save(
      { ...ADA, contactInfos: [ADA.contactInfos[0], { ...ADA.contactInfos[1], value: '+1 202-555-0100' }] },
      { personId },
    );

    const phones = await db
      .select()
      .from(dbSchema.contactInfos)
      .where(and(eq(dbSchema.contactInfos.personId, personId), eq(dbSchema.contactInfos.type, ContactType.Phone)));
    expect(phones.map((phone: { value: string }) => phone.value)).toEqual(['+1 202-555-0100']);
  });

  it('merges a card into a person by filling what is empty and adding what is missing', async () => {
    const personId = await createPerson(db, userId, 'Augusta');
    await createContactInfo(db, { userId, personId, type: ContactType.Email, value: 'ADA@example.com' });
    await createContactInfo(db, { userId, personId, type: ContactType.Phone, value: '202-555-0199' });

    const saved = await save(ADA, { mode: SaveMode.Merge, personId });

    const [stored] = await readCards(db, userId);
    expect(saved).toEqual({ personId, isNew: false, hasChanged: true });
    expect(stored.card).toMatchObject({ firstName: 'Augusta', lastName: 'Test', organization: 'Analytical Engines' });
    // Sorted: the two numbers are saved moments apart, and which reads first is not what is being checked.
    expect(stored.card.contactInfos.map((info) => info.value).sort()).toEqual([
      '(202) 555-0100',
      '202-555-0199',
      'ADA@example.com',
    ]);
    expect(stored.card.addresses).toHaveLength(1);
    expect(stored.card.labels).toEqual(['Friends', 'Mathematicians']);
  });

  it.each([
    ['no name', { ...emptyCard(), jobTitle: 'Programmer' }, 'The card has no name, nickname or organization.'],
    ['a name that is too long', { ...emptyCard(), firstName: 'A'.repeat(5_000) }, 'First name is too long.'],
  ])('refuses a card with %s, and keeps nothing of it', async (_name, card, message) => {
    const withLabel = { ...card, labels: ['Left behind'] };

    await expect(save(withLabel)).rejects.toThrow(new CardRejectedError(message));

    expect(await db.select().from(dbSchema.persons)).toEqual([]);
    expect(await db.select().from(dbSchema.labels)).toEqual([]);
  });

  it('leaves out a day that is not on the calendar', async () => {
    await save({
      ...emptyCard(),
      firstName: 'Ada',
      dates: [{ kind: ImportantDateKind.Birthday, name: 'Birthday', date: '2001-02-30', hasYear: true }],
    });

    const [stored] = await readCards(db, userId);
    expect(stored.card.dates).toEqual([]);
  });

  it('clears the tombstone of a person who comes back', async () => {
    await db.insert(dbSchema.personTombstones).values({ userId, personId: userId, uid: 'ada-uid', revision: 1 });

    await save(ADA);

    expect(await db.select().from(dbSchema.personTombstones)).toEqual([]);
  });

  it("reads and writes only the caller's people", async () => {
    const { personId } = await save(ADA);
    await save({ ...ADA, firstName: 'Theirs' }, {}, otherUserId);

    expect(await findPersonByUid(db, userId, 'ada-uid')).toBe(personId);
    expect(await findPersonByUid(db, userId, 'nobody')).toBeNull();
    expect((await readCards(db, otherUserId)).map((stored) => stored.card.firstName)).toEqual(['Theirs']);
    await expect(save(ADA, { personId }, otherUserId)).rejects.toThrow(CardRejectedError);
  });

  it('narrows a read to some of the people', async () => {
    await save(ADA);
    await save({ ...emptyCard(), firstName: 'Grace', uid: 'grace-uid' });

    const cards = await readCards(db, userId, { which: eq(dbSchema.persons.uid, 'grace-uid') });

    expect(cards.map((stored) => stored.card.firstName)).toEqual(['Grace']);
  });

  describe('with pictures', () => {
    const photo = { mediaType: 'image/png', data: Buffer.from('first picture') };

    it('stores a picture and reads it back', async () => {
      const { store, files } = memoryStore();

      await save({ ...ADA, photo }, { avatars: store });

      const [stored] = await readCards(db, userId, { avatars: store });
      expect(stored.card.photo).toEqual(photo);
      expect([...files.keys()]).toEqual([expect.stringMatching(/^[0-9a-f-]{36}\.png$/)]);
      const [withoutPictures] = await readCards(db, userId);
      expect(withoutPictures.card.photo).toBeNull();
    });

    it('replaces a picture that changed, and leaves the same one alone', async () => {
      const { store, files } = memoryStore();
      const { personId } = await save({ ...ADA, photo }, { avatars: store });
      const [firstName] = files.keys();

      const same = await save({ ...ADA, photo }, { avatars: store, personId });
      const next = { mediaType: 'image/jpeg', data: Buffer.from('second picture') };
      const changed = await save({ ...ADA, photo: next }, { avatars: store, personId });

      expect(same.hasChanged).toBe(false);
      expect(changed.hasChanged).toBe(true);
      expect(files.has(firstName)).toBe(false);
      expect([...files.values()]).toEqual([next.data]);
    });

    it('removes the picture of a person whose card has none, but not when merging', async () => {
      const { store, files } = memoryStore();
      const { personId } = await save({ ...ADA, photo }, { avatars: store });

      await save(ADA, { avatars: store, personId, mode: SaveMode.Merge });
      expect(files.size).toBe(1);

      await save(ADA, { avatars: store, personId });
      expect(files.size).toBe(0);
      const [stored] = await readCards(db, userId, { avatars: store });
      expect(stored.card.photo).toBeNull();
    });

    it('passes over a picture of a type it does not keep', async () => {
      const { store, files } = memoryStore();

      await save({ ...ADA, photo: { mediaType: 'image/tiff', data: Buffer.from('tiff') } }, { avatars: store });

      expect(files.size).toBe(0);
    });
  });

  describe('through GraphQL', () => {
    const FILE = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'UID:ada-uid',
      'N:Lovelace;Ada;;;',
      'FN:Ada Lovelace',
      'EMAIL;TYPE=HOME:ada@example.com',
      'CATEGORIES:Friends',
      'PHOTO;ENCODING=b;TYPE=PNG:cGljdHVyZQ==',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Grace Hopper',
      'N:Hopper;Grace;;;',
      'TEL:+1 202 555 0111',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:',
      'TITLE:Nobody',
      'END:VCARD',
    ].join('\r\n');

    it('imports each card in a file, with its picture, and skips one that names nobody', async () => {
      const { store, files } = memoryStore();

      const data = await createClient(db, userId, { avatarStore: store }).expectOk(IMPORT, { vcf: FILE });

      expect(data).toEqual({ importVCards: { imported: 2, merged: 0, skipped: 1, errors: [] } });
      const cards = await readCards(db, userId);
      expect(cards.map((stored) => stored.card.firstName).sort()).toEqual(['Ada', 'Grace']);
      expect(cards.find((stored) => stored.card.firstName === 'Ada')?.card.labels).toEqual(['Friends']);
      expect([...files.values()]).toEqual([Buffer.from('picture')]);
    });

    it('adds nothing, and counts no change, when the same file is imported again', async () => {
      const client = createClient(db, userId);
      await client.expectOk(IMPORT, { vcf: FILE });
      const before = await revisionOfUser();

      const data = await client.expectOk(IMPORT, { vcf: FILE });

      expect(data).toEqual({ importVCards: { imported: 0, merged: 2, skipped: 1, errors: [] } });
      expect(await revisionOfUser()).toBe(before);
      expect(await db.select().from(dbSchema.contactInfos)).toHaveLength(2);
    });

    it('merges a card into the person who has its first email', async () => {
      const personId = await createPerson(db, userId, 'Augusta');
      await createContactInfo(db, { userId, personId, type: ContactType.Email, value: 'Ada@Example.com' });

      const data = await createClient(db, userId).expectOk(IMPORT, { vcf: FILE });

      expect(data).toEqual({ importVCards: { imported: 1, merged: 1, skipped: 1, errors: [] } });
      const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, personId));
      expect(person.firstName).toBe('Augusta');
      expect(person.uid).not.toBe('ada-uid');
    });

    it('does not merge a card into someone else who shares its number', async () => {
      const personId = await createPerson(db, userId, 'Howard');
      await createContactInfo(db, { userId, personId, type: ContactType.Phone, value: '202-555-0111' });

      const data = await createClient(db, userId).expectOk(IMPORT, { vcf: FILE });

      expect(data).toEqual({ importVCards: { imported: 2, merged: 0, skipped: 1, errors: [] } });
    });

    it('reports a card that cannot be saved and imports the rest', async () => {
      const long = FILE.replace('N:Hopper;Grace;;;', `N:Hopper;${'G'.repeat(5_000)};;;`);

      const data = await createClient(db, userId).expectOk<{ importVCards: { imported: number; errors: string[] } }>(
        IMPORT,
        { vcf: long },
      );

      expect(data.importVCards.imported).toBe(1);
      expect(data.importVCards.errors).toEqual([expect.stringContaining('First name is too long.')]);
    });

    it('refuses text that is not a vCard file', async () => {
      await createClient(db, userId).expectError(ErrorCode.BadUserInput, IMPORT, { vcf: 'First Name,Last Name' });
    });

    it('refuses a caller who is not signed in', async () => {
      await createClient(db, null).expectError(ErrorCode.Unauthenticated, IMPORT, { vcf: FILE });
      await createClient(db, null).expectError(ErrorCode.Unauthenticated, EXPORT);
    });

    it("exports the caller's people as a file that imports into another account", async () => {
      await save(ADA);
      await save({ ...emptyCard(), firstName: 'Theirs' }, {}, otherUserId);

      const { exportVCards } = await createClient(db, userId).expectOk<{ exportVCards: string }>(EXPORT);
      const thirdUserId = await createUser(db, 'third@example.com');
      await createClient(db, thirdUserId).expectOk(IMPORT, { vcf: exportVCards });

      expect(exportVCards).not.toContain('Theirs');
      const [copy] = await readCards(db, thirdUserId);
      expect(copy.card).toEqual(ADA);
    });

    it('exports an empty file for a caller with nobody', async () => {
      const data = await createClient(db, userId).expectOk(EXPORT);

      expect(data).toEqual({ exportVCards: '' });
    });
  });
});
