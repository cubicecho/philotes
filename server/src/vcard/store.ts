import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { DB } from '@cubicecho/philotes-db';
import { withNormalizedValue } from '@cubicecho/philotes-db/normalize';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { type AnyColumn, and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { LABEL_DEFAULTS } from '../core/defaults.ts';
import type { Transaction } from '../graphql/write-guards.ts';
import { importantDateInput } from '../important-dates/input.ts';
import { labelInput } from '../labels/input.ts';
import type { AvatarStore } from '../persons/avatar-store.ts';
import {
  AVATAR_MAX_BYTES,
  AVATAR_URL_PREFIX,
  EXTENSION_BY_MIME_TYPE,
  MIME_TYPE_BY_EXTENSION,
} from '../persons/avatars.ts';
import { addressInput, contactInfoInput, NAMING_KEYS, personInput } from '../persons/input.ts';
import { touchNewPersons, touchPersons } from '../persons/revisions.ts';
import type { Card, CardAddress, CardContactInfo, CardDate, CardPhoto } from './card.ts';

// Cards to and from the database. Reading gathers a person and the details a contact card carries into
// a Card; saving writes a Card onto a person. Both are scoped to one user, and a save counts as a
// change to that user's people only when it changed something.

const { addresses, contactInfos, importantDates, labels, personLabels, persons, personTombstones } = dbSchema;
const { ImportantDateKind, Recurrence } = dbSchema;

/** A day that is on the calendar, as `YYYY-MM-DD`. */
const CALENDAR_DAY = z.iso.date();

/** How a card is written onto a person who already exists. */
export const SaveMode = {
  /** The card is the truth: the person ends up holding exactly what it says. What a phone sends. */
  Replace: 'replace',
  /** The person is the truth: the card only fills what is empty and adds what is missing. What an import does. */
  Merge: 'merge',
} as const;
export type SaveMode = (typeof SaveMode)[keyof typeof SaveMode];

/** Thrown when a card cannot be saved as it is. The message is safe to show the user. */
export class CardRejectedError extends Error {
  override name = 'CardRejectedError';
}

/** A person as a card, with what a sync needs to know about them. */
export interface StoredCard {
  personId: string;
  /** The person's id in an address book. */
  uid: string;
  /** The user's change count when the person last changed. */
  revision: number;
  updatedAt: Date;
  card: Card;
}

/** What narrows a read. */
export interface ReadOptions {
  /** Narrows the user's people. Left out, everyone is read. */
  which?: SQL;
  /** Where pictures are kept. Left out, cards are read without their pictures. */
  avatars?: AvatarStore | null;
}

/** What a save needs beside the card. */
export interface SaveOptions {
  mode: SaveMode;
  /** The person the card is written onto, or null to make a new one. */
  personId: string | null;
  /** The user's default country, which numbers without a country code are read in. */
  country: string;
  /** Where pictures are kept, or null to leave pictures alone. */
  avatars: AvatarStore | null;
}

/** What a save did. */
export interface SavedCard {
  personId: string;
  isNew: boolean;
  /** False when the person already held everything the card says. */
  hasChanged: boolean;
}

/**
 * Parses a value, turning a zod failure into a rejected card.
 *
 * @param schema - The zod schema.
 * @param value - What the card holds.
 * @returns The parsed value.
 * @throws CardRejectedError with the schema's first message.
 */
function parseOrReject<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (result.success === false) {
    throw new CardRejectedError(result.error.issues[0]?.message ?? 'The card cannot be saved.');
  }
  return result.data;
}

/**
 * Groups rows by the person they belong to.
 *
 * @param rows - Rows that each carry a person's id.
 * @returns The rows of each person, by the person's id.
 */
function byPerson<Row extends { personId: string }>(rows: Row[]): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    grouped.set(row.personId, [...(grouped.get(row.personId) ?? []), row]);
  }
  return grouped;
}

/**
 * Reads a stored picture.
 *
 * @param avatars - Where pictures are kept.
 * @param avatarPath - The person's `avatarPath`.
 * @returns The picture, or null when the file is gone or is not an image type a card can carry.
 */
async function readPhoto(avatars: AvatarStore, avatarPath: string): Promise<CardPhoto | null> {
  const name = avatarPath.slice(AVATAR_URL_PREFIX.length);
  const mediaType = MIME_TYPE_BY_EXTENSION[extname(name).toLowerCase()];
  const stream = mediaType === undefined ? null : await avatars.read(name);
  if (stream === null) {
    return null;
  }
  const chunks: Buffer[] = await stream.toArray();
  return { mediaType, data: Buffer.concat(chunks) };
}

/**
 * Reads a user's people as cards.
 *
 * @param db - The client or transaction to read with.
 * @param userId - The user whose people are read.
 * @param options - Which people, and whether with their pictures.
 * @returns A card for each person, in the order they were created. Within a card the primary detail
 * comes first, then the rest by type.
 */
export async function readCards(
  db: DB | Transaction,
  userId: string,
  options: ReadOptions = {},
): Promise<StoredCard[]> {
  const people = await db
    .select()
    .from(persons)
    .where(and(eq(persons.userId, userId), options.which))
    .orderBy(persons.createdAt, persons.id);
  if (people.length === 0) {
    return [];
  }
  const ids = people.map((person) => person.id);
  const ofThese = (table: { userId: AnyColumn; personId: AnyColumn }) =>
    and(eq(table.userId, userId), inArray(table.personId, ids));

  const [infoRows, addressRows, dateRows, labelRows] = await Promise.all([
    // Rows written together share a creation time, so the value settles their order.
    db
      .select()
      .from(contactInfos)
      .where(ofThese(contactInfos))
      .orderBy(desc(contactInfos.isPrimary), contactInfos.type, contactInfos.createdAt, contactInfos.value),
    db
      .select()
      .from(addresses)
      .where(ofThese(addresses))
      .orderBy(desc(addresses.isPrimary), addresses.createdAt, addresses.line1),
    db
      .select()
      .from(importantDates)
      .where(ofThese(importantDates))
      .orderBy(importantDates.date, importantDates.name, importantDates.id),
    db
      .select({ personId: personLabels.personId, label: labels.label })
      .from(personLabels)
      .innerJoin(labels, eq(labels.id, personLabels.labelId))
      .where(ofThese(personLabels))
      .orderBy(labels.label),
  ]);
  const infosOf = byPerson(infoRows);
  const addressesOf = byPerson(addressRows);
  const datesOf = byPerson(dateRows);
  const labelsOf = byPerson(labelRows);
  const avatars = options.avatars ?? null;

  const cards: StoredCard[] = [];
  for (const person of people) {
    const photo = avatars !== null && person.avatarPath !== null ? await readPhoto(avatars, person.avatarPath) : null;
    const card: Card = {
      uid: person.uid,
      namePrefix: person.namePrefix,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      nameSuffix: person.nameSuffix,
      nickname: person.nickname,
      organization: person.organization,
      department: person.department,
      jobTitle: person.jobTitle,
      about: person.about,
      contactInfos: (infosOf.get(person.id) ?? []).map(({ type, value, kind, label, isPrimary }) => ({
        type,
        value,
        kind,
        label,
        isPrimary,
      })),
      addresses: (addressesOf.get(person.id) ?? []).map((row) => ({
        type: row.type,
        label: row.label,
        line1: row.line1,
        line2: row.line2,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        country: row.country,
        isPrimary: row.isPrimary,
      })),
      dates: (datesOf.get(person.id) ?? []).map(({ kind, name, date, hasYear }) => ({ kind, name, date, hasYear })),
      labels: (labelsOf.get(person.id) ?? []).map((row) => row.label),
      photo,
      extra: person.vcardExtra,
    };
    cards.push({ personId: person.id, uid: person.uid, revision: person.revision, updatedAt: person.updatedAt, card });
  }
  return cards;
}

/**
 * Finds the person a user knows by an address-book id.
 *
 * @param db - The client or transaction to read with.
 * @param userId - The user.
 * @param uid - The id, as a card's `UID` gives it.
 * @returns The person's id, or null when the user has no such person.
 */
export async function findPersonByUid(db: DB | Transaction, userId: string, uid: string): Promise<string | null> {
  const [person] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.userId, userId), eq(persons.uid, uid)))
    .limit(1);
  return person?.id ?? null;
}

/**
 * Keeps the first of each item that shares a key.
 *
 * @param items - The items.
 * @param keyOf - What makes two items the same one.
 * @returns The distinct items, by key, in their first order.
 */
function distinctBy<Item>(items: Item[], keyOf: (item: Item) => string): Map<string, Item> {
  const distinct = new Map<string, Item>();
  for (const item of items) {
    const key = keyOf(item);
    const isFirst = distinct.has(key) === false;
    if (isFirst) {
      distinct.set(key, item);
    }
  }
  return distinct;
}

/**
 * Says whether a row already holds every value it is asked to take.
 *
 * @param row - The stored row.
 * @param values - The columns a card gives it.
 * @returns True when nothing would change.
 */
function holds<Values extends Record<string, unknown>>(row: Values, values: Partial<Values>): boolean {
  return Object.entries(values).every(([key, value]) => row[key] === value);
}

/** What the steps of a save share. */
interface Saving {
  tx: Transaction;
  userId: string;
  personId: string;
  /** True when rows the card does not name are deleted and matched rows take the card's values. */
  isReplacing: boolean;
}

/**
 * Brings a person's rows in one table in line with a card.
 *
 * @param saving - The save in progress.
 * @param plan.existing - The person's stored rows, each under its key.
 * @param plan.wanted - What the card holds, each under its key.
 * @param plan.insert - Adds the rows the person lacks.
 * @param plan.update - Gives a stored row the card's values, and says whether it changed.
 * @param plan.remove - Deletes stored rows by id.
 * @returns True when anything was written.
 */
async function reconcile<Row extends { id: string }, Item>(
  saving: Saving,
  plan: {
    existing: Map<string, Row>;
    wanted: Map<string, Item>;
    insert: (items: Item[]) => Promise<unknown>;
    update: (row: Row, item: Item) => Promise<boolean>;
    remove: (ids: string[]) => Promise<unknown>;
  },
): Promise<boolean> {
  const missing = [...plan.wanted].filter(([key]) => plan.existing.has(key) === false).map(([, item]) => item);
  let hasChanged = missing.length > 0;
  if (missing.length > 0) {
    await plan.insert(missing);
  }
  if (saving.isReplacing === false) {
    return hasChanged;
  }
  for (const [key, row] of plan.existing) {
    const item = plan.wanted.get(key);
    if (item !== undefined) {
      const wasUpdated = await plan.update(row, item);
      hasChanged = hasChanged || wasUpdated;
    }
  }
  const unwanted = [...plan.existing].filter(([key]) => plan.wanted.has(key) === false).map(([, row]) => row.id);
  if (unwanted.length > 0) {
    await plan.remove(unwanted);
    hasChanged = true;
  }
  return hasChanged;
}

/**
 * Writes a card's contact details onto a person. Two details are the same one when they have the same
 * type and the same normalized value, so a number written another way is not added twice.
 *
 * @param saving - The save in progress.
 * @param items - The card's details.
 * @param country - The country that numbers without a country code are read in.
 * @returns True when anything was written.
 */
async function saveContactInfos(saving: Saving, items: CardContactInfo[], country: string): Promise<boolean> {
  const { tx, userId, personId } = saving;
  const own = and(eq(contactInfos.userId, userId), eq(contactInfos.personId, personId));
  const keyOf = (row: { type: string; normalizedValue: string }) => `${row.type}\n${row.normalizedValue}`;
  const rows = items.map((item) => {
    const { value, label, kind } = parseOrReject(contactInfoInput.required(), item);
    return withNormalizedValue(
      { personId, userId, type: item.type, value, label, kind, isPrimary: item.isPrimary },
      country,
    );
  });
  const stored = await tx.select().from(contactInfos).where(own).orderBy(contactInfos.createdAt);
  return reconcile(saving, {
    existing: distinctBy(stored, keyOf),
    wanted: distinctBy(rows, keyOf),
    insert: (missing) => tx.insert(contactInfos).values(missing),
    update: async (row, { value, label, kind, isPrimary }) => {
      const values = { value, label, kind, isPrimary };
      if (holds(row, values)) {
        return false;
      }
      await tx.update(contactInfos).set(values).where(eq(contactInfos.id, row.id));
      return true;
    },
    remove: (ids) => tx.delete(contactInfos).where(and(own, inArray(contactInfos.id, ids))),
  });
}

/**
 * Writes a card's addresses onto a person. Two addresses are the same one when every part matches,
 * whatever the case.
 *
 * @param saving - The save in progress.
 * @param items - The card's addresses.
 * @returns True when anything was written.
 */
async function saveAddresses(saving: Saving, items: CardAddress[]): Promise<boolean> {
  const { tx, userId, personId } = saving;
  const own = and(eq(addresses.userId, userId), eq(addresses.personId, personId));
  const keyOf = (row: Pick<CardAddress, 'line1' | 'line2' | 'city' | 'state' | 'postalCode' | 'country'>) =>
    [row.line1, row.line2, row.city, row.state, row.postalCode, row.country]
      .map((part) => (part ?? '').trim().toLowerCase())
      .join('\n');
  const rows = items.map((item) => ({
    personId,
    userId,
    type: item.type,
    isPrimary: item.isPrimary,
    ...parseOrReject(addressInput.required(), item),
  }));
  const stored = await tx.select().from(addresses).where(own).orderBy(addresses.createdAt);
  return reconcile(saving, {
    existing: distinctBy(stored, keyOf),
    wanted: distinctBy(rows, keyOf),
    insert: (missing) => tx.insert(addresses).values(missing),
    update: async (row, { type, label, isPrimary }) => {
      const values = { type, label, isPrimary };
      if (holds(row, values)) {
        return false;
      }
      await tx.update(addresses).set(values).where(eq(addresses.id, row.id));
      return true;
    },
    remove: (ids) => tx.delete(addresses).where(and(own, inArray(addresses.id, ids))),
  });
}

/**
 * Writes a card's dates onto a person. A person has one birthday and one anniversary; any other date
 * is told apart by its name.
 *
 * @param saving - The save in progress.
 * @param items - The card's dates.
 * @returns True when anything was written.
 */
async function saveDates(saving: Saving, items: CardDate[]): Promise<boolean> {
  const { tx, userId, personId } = saving;
  const own = and(eq(importantDates.userId, userId), eq(importantDates.personId, personId));
  const keyOf = (row: Pick<CardDate, 'kind' | 'name'>) =>
    row.kind === ImportantDateKind.Other ? `${row.kind}\n${row.name.trim().toLowerCase()}` : row.kind;
  // A card may hold a day that does not exist, such as the 30th of February. It is left out.
  const real = items
    .filter((item) => CALENDAR_DAY.safeParse(item.date).success)
    .map((item) => ({ ...item, ...parseOrReject(importantDateInput.pick({ name: true }).required(), item) }));
  const stored = await tx.select().from(importantDates).where(own).orderBy(importantDates.createdAt);
  return reconcile(saving, {
    existing: distinctBy(stored, keyOf),
    wanted: distinctBy(real, keyOf),
    insert: (missing) =>
      tx
        .insert(importantDates)
        .values(missing.map((item) => ({ ...item, personId, userId, recurrence: Recurrence.Yearly }))),
    update: async (row, { date, hasYear }) => {
      const values = { date, hasYear };
      if (holds(row, values)) {
        return false;
      }
      await tx.update(importantDates).set(values).where(eq(importantDates.id, row.id));
      return true;
    },
    remove: (ids) => tx.delete(importantDates).where(and(own, inArray(importantDates.id, ids))),
  });
}

/**
 * Finds the user's label of each name, whatever its case, and makes the ones that do not exist.
 *
 * @param tx - The transaction to write in.
 * @param userId - The user.
 * @param names - The label names a card gives.
 * @returns The id of each name's label, in the names' order.
 */
async function labelIdsFor(tx: Transaction, userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) {
    return [];
  }
  const known = await tx.select({ id: labels.id, label: labels.label }).from(labels).where(eq(labels.userId, userId));
  const idByName = new Map(known.map((row) => [row.label.toLowerCase(), row.id]));
  for (const name of names) {
    const { label } = parseOrReject(labelInput.pick({ label: true }).required(), { label: name });
    const isKnown = idByName.has(label.toLowerCase());
    if (isKnown) {
      continue;
    }
    const [made] = await tx
      .insert(labels)
      .values({ userId, label, color: LABEL_DEFAULTS.importedColor })
      .returning({ id: labels.id });
    idByName.set(label.toLowerCase(), made.id);
  }
  return names.flatMap((name) => idByName.get(name.trim().toLowerCase()) ?? []);
}

/**
 * Writes a card's labels onto a person, making the labels the user does not have yet.
 *
 * @param saving - The save in progress.
 * @param names - The card's label names.
 * @returns True when anything was written.
 */
async function saveLabels(saving: Saving, names: string[]): Promise<boolean> {
  const { tx, userId, personId } = saving;
  const own = and(eq(personLabels.userId, userId), eq(personLabels.personId, personId));
  const wanted = new Set(await labelIdsFor(tx, userId, names));
  const stored = await tx.select({ labelId: personLabels.labelId }).from(personLabels).where(own);
  const held = new Set(stored.map((row) => row.labelId));

  const missing = [...wanted].filter((labelId) => held.has(labelId) === false);
  if (missing.length > 0) {
    await tx.insert(personLabels).values(missing.map((labelId) => ({ personId, userId, labelId })));
  }
  const unwanted = saving.isReplacing ? [...held].filter((labelId) => wanted.has(labelId) === false) : [];
  if (unwanted.length > 0) {
    await tx.delete(personLabels).where(and(own, inArray(personLabels.labelId, unwanted)));
  }
  return missing.length > 0 || unwanted.length > 0;
}

/**
 * Writes a card's picture onto a person. A picture that is too large, or of a type Philotes does not
 * keep, is passed over and the person keeps what they had. The file is stored before the transaction
 * commits: one that then fails leaves a file nothing points at, which costs space and shows nobody anything.
 *
 * @param saving - The save in progress.
 * @param avatars - Where pictures are kept.
 * @param photo - The card's picture, or null when it has none.
 * @param currentPath - The person's `avatarPath` now.
 * @returns True when the person's picture changed.
 */
async function savePhoto(
  saving: Saving,
  avatars: AvatarStore,
  photo: CardPhoto | null,
  currentPath: string | null,
): Promise<boolean> {
  const { tx, userId, personId } = saving;
  const own = and(eq(persons.userId, userId), eq(persons.id, personId));
  const currentName = currentPath?.slice(AVATAR_URL_PREFIX.length) ?? null;

  if (photo === null) {
    const isRemoving = saving.isReplacing && currentName !== null;
    if (isRemoving) {
      await tx.update(persons).set({ avatarPath: null }).where(own);
      await avatars.remove(currentName);
    }
    return isRemoving;
  }

  const isKept = saving.isReplacing === false && currentName !== null;
  const extension = EXTENSION_BY_MIME_TYPE[photo.mediaType];
  const isStorable = extension !== undefined && photo.data.length > 0 && photo.data.length <= AVATAR_MAX_BYTES;
  if (isKept || isStorable === false) {
    return false;
  }
  const current = currentPath === null ? null : await readPhoto(avatars, currentPath);
  const isSamePicture = current?.data.equals(photo.data) === true;
  if (isSamePicture) {
    return false;
  }
  const name = `${randomUUID()}${extension}`;
  await avatars.put(name, photo.data, photo.mediaType);
  await tx
    .update(persons)
    .set({ avatarPath: `${AVATAR_URL_PREFIX}${name}` })
    .where(own);
  if (currentName !== null) {
    await avatars.remove(currentName);
  }
  return true;
}

/**
 * Writes a card's own fields onto a person, or makes the person.
 *
 * @param tx - The transaction to write in.
 * @param userId - The user who owns the person.
 * @param card - The card.
 * @param options - The person to write onto, and how.
 * @returns The person's id, their picture's path, and whether anything was written.
 * @throws CardRejectedError when the card would leave the person with no name, or a field is too long.
 */
async function savePerson(
  tx: Transaction,
  userId: string,
  card: Card,
  options: Pick<SaveOptions, 'mode' | 'personId'>,
): Promise<{ personId: string; avatarPath: string | null; hasChanged: boolean }> {
  const fields = parseOrReject(personInput.required(), {
    namePrefix: card.namePrefix,
    firstName: card.firstName,
    middleName: card.middleName,
    lastName: card.lastName,
    nameSuffix: card.nameSuffix,
    nickname: card.nickname,
    organization: card.organization,
    jobTitle: card.jobTitle,
    department: card.department,
    about: card.about,
    contactFrequency: null,
    howWeMet: null,
    firstMetDate: null,
  });
  const { contactFrequency: _frequency, howWeMet: _howWeMet, firstMetDate: _firstMet, ...onCard } = fields;
  const isNamed = NAMING_KEYS.some((key) => onCard[key] !== null);

  if (options.personId === null) {
    if (isNamed === false) {
      throw new CardRejectedError('The card has no name, nickname or organization.');
    }
    const uid = card.uid ?? undefined;
    if (uid !== undefined) {
      // A person who comes back is no longer deleted.
      await tx.delete(personTombstones).where(and(eq(personTombstones.userId, userId), eq(personTombstones.uid, uid)));
    }
    const [made] = await tx
      .insert(persons)
      .values({ ...onCard, userId, uid, vcardExtra: card.extra })
      .returning({ id: persons.id });
    return { personId: made.id, avatarPath: null, hasChanged: true };
  }

  const own = and(eq(persons.userId, userId), eq(persons.id, options.personId));
  const [person] = await tx.select().from(persons).where(own).limit(1);
  if (!person) {
    throw new CardRejectedError('The person this card belongs to is gone.');
  }
  const offered = { ...onCard, vcardExtra: card.extra };
  let values: Partial<typeof offered> = offered;
  if (options.mode === SaveMode.Merge) {
    // Only what the person does not have yet.
    const empty = Object.entries(offered).filter(([key]) => person[key as keyof typeof offered] === null);
    values = Object.fromEntries(empty);
  } else if (isNamed === false) {
    throw new CardRejectedError('The card has no name, nickname or organization.');
  }
  const hasChanged = holds(person, values) === false;
  if (hasChanged) {
    await tx.update(persons).set(values).where(own);
  }
  return { personId: person.id, avatarPath: person.avatarPath, hasChanged };
}

/**
 * Writes a card onto one of a user's people, or makes a new person from it, and counts the change.
 *
 * @param tx - The transaction to write in.
 * @param userId - The user who owns the person.
 * @param card - The card.
 * @param options - The person to write onto, how, and where pictures go.
 * @returns The person, whether they are new, and whether anything changed.
 * @throws CardRejectedError when the card cannot be saved as it is. Nothing of it is kept: the caller
 * rolls the transaction back.
 */
export async function saveCard(tx: Transaction, userId: string, card: Card, options: SaveOptions): Promise<SavedCard> {
  const person = await savePerson(tx, userId, card, options);
  const isNew = options.personId === null;
  const saving: Saving = {
    tx,
    userId,
    personId: person.personId,
    isReplacing: options.mode === SaveMode.Replace,
  };

  // One after another: they share the transaction's single connection.
  const changes = [
    person.hasChanged,
    await saveContactInfos(saving, card.contactInfos, options.country),
    await saveAddresses(saving, card.addresses),
    await saveDates(saving, card.dates),
    await saveLabels(saving, card.labels),
    options.avatars === null ? false : await savePhoto(saving, options.avatars, card.photo, person.avatarPath),
  ];
  const hasChanged = changes.some(Boolean);
  if (isNew) {
    await touchNewPersons(tx, userId);
  } else if (hasChanged) {
    await touchPersons(tx, userId, [person.personId]);
  }
  return { personId: person.personId, isNew, hasChanged };
}
