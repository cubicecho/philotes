import type { DB } from '@cubicecho/philotes-db';
import { persons, personTombstones, users } from '@cubicecho/philotes-db/schema';
import { and, eq, gt, inArray, type SQL } from 'drizzle-orm';
import type { AvatarStore } from '../persons/avatar-store.ts';
import { removeAvatarFile } from '../persons/avatars.ts';
import { defaultCountryOf } from '../persons/normalized-values.ts';
import { buryPersons } from '../persons/revisions.ts';
import { parseVCards } from '../vcard/decode.ts';
import { writeVCard } from '../vcard/encode.ts';
import { readCards, SaveMode, saveCard } from '../vcard/store.ts';
import { etagOf } from './dav.ts';

// A user's people as an address book: each person is one card, named by their uid, and tagged with the
// revision they last changed at.

/** What the address book reads and writes with. */
export interface BookDeps {
  /** Drizzle client. */
  db: DB;
  /** Where pictures are kept, or null to serve and take cards without them. */
  avatars: AvatarStore | null;
}

/** One card in the address book. */
export interface BookEntry {
  uid: string;
  /** The card's entity tag. */
  etag: string;
  /** The card as vCard text. Null when it was listed without being read. */
  vcard: string | null;
}

/** Which of a user's cards are read. */
export interface EntryFilter {
  /** Only these cards. */
  uids?: string[];
  /** Only cards changed after this revision. */
  since?: number;
  /** Reads each card's text, not only its tag. */
  withData: boolean;
}

/** What a request says the card must be for it to go ahead. */
export interface Preconditions {
  /** The tags of `If-Match`, or null when the request has none. `*` matches any card that exists. */
  ifMatch: string[] | null;
  /** True for `If-None-Match: *`: the card must not exist yet. */
  ifNoneMatch: boolean;
}

/** How a write to a card ended. */
export const WriteOutcome = {
  Created: 'created',
  Updated: 'updated',
  Deleted: 'deleted',
  /** No such card. */
  Missing: 'missing',
  /** The card is not as the request said it must be. */
  PreconditionFailed: 'precondition-failed',
} as const;
export type WriteOutcome = (typeof WriteOutcome)[keyof typeof WriteOutcome];

/** Thrown when a body is not one vCard. The message is safe to show. */
export class NotOneCardError extends Error {
  override name = 'NotOneCardError';
}

const ANY_TAG = '*';
const WEAK_TAG_PREFIX = 'W/';

/**
 * Reads the preconditions out of a request's headers.
 *
 * @param ifMatch - The `If-Match` header, if any.
 * @param ifNoneMatch - The `If-None-Match` header, if any.
 * @returns The preconditions.
 */
export function readPreconditions(ifMatch: string | undefined, ifNoneMatch: string | undefined): Preconditions {
  const tags = ifMatch
    ?.split(',')
    .map((tag) => tag.trim())
    .map((tag) => (tag.startsWith(WEAK_TAG_PREFIX) ? tag.slice(WEAK_TAG_PREFIX.length) : tag))
    .filter((tag) => tag !== '');
  return { ifMatch: tags ?? null, ifNoneMatch: ifNoneMatch?.trim() === ANY_TAG };
}

/**
 * Checks a card against what a request says it must be.
 *
 * @param preconditions - What the request says.
 * @param etag - The card's tag, or null when there is no such card.
 * @returns True when the request may go ahead.
 */
function holds(preconditions: Preconditions, etag: string | null): boolean {
  if (etag === null) {
    return preconditions.ifMatch === null;
  }
  const isMatch =
    preconditions.ifMatch === null || preconditions.ifMatch.includes(ANY_TAG) || preconditions.ifMatch.includes(etag);
  return isMatch && preconditions.ifNoneMatch === false;
}

/**
 * Reads how many changes a user's address book has seen.
 *
 * @param db - Drizzle client.
 * @param userId - The user.
 * @returns The count, which the sync token is written from.
 */
export async function bookRevision(db: DB, userId: string): Promise<number> {
  const [user] = await db.select({ revision: users.personsRevision }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.revision ?? 0;
}

/**
 * Reads a user's cards.
 *
 * @param deps - The database and the avatar store.
 * @param userId - The user.
 * @param filter - Which cards, and whether with their text.
 * @returns The cards, in the order their people were created.
 */
export async function readEntries(deps: BookDeps, userId: string, filter: EntryFilter): Promise<BookEntry[]> {
  const { db, avatars } = deps;
  const isNobody = filter.uids !== undefined && filter.uids.length === 0;
  if (isNobody) {
    return [];
  }
  const conditions: Array<SQL | undefined> = [
    filter.uids === undefined ? undefined : inArray(persons.uid, filter.uids),
    filter.since === undefined ? undefined : gt(persons.revision, filter.since),
  ];
  const which = and(...conditions);
  if (filter.withData) {
    const cards = await readCards(db, userId, { which, avatars });
    return cards.map(({ uid, revision, updatedAt, card }) => ({
      uid,
      etag: etagOf(revision),
      vcard: writeVCard(card, { revisedAt: updatedAt }),
    }));
  }
  const rows = await db
    .select({ uid: persons.uid, revision: persons.revision })
    .from(persons)
    .where(and(eq(persons.userId, userId), which))
    .orderBy(persons.createdAt, persons.id);
  return rows.map(({ uid, revision }) => ({ uid, etag: etagOf(revision), vcard: null }));
}

/**
 * Reads which of a user's cards were deleted after a revision.
 *
 * @param db - Drizzle client.
 * @param userId - The user.
 * @param since - The revision a client last saw.
 * @returns The uids of the cards that are gone.
 */
export async function readDeletedSince(db: DB, userId: string, since: number): Promise<string[]> {
  const rows = await db
    .select({ uid: personTombstones.uid })
    .from(personTombstones)
    .where(and(eq(personTombstones.userId, userId), gt(personTombstones.revision, since)))
    .orderBy(personTombstones.revision, personTombstones.uid);
  return rows.map((row) => row.uid);
}

/**
 * Writes a card a client sent, as the whole truth about the person it names.
 *
 * @param deps - The database and the avatar store.
 * @param userId - The user whose address book it goes in.
 * @param uid - The card's name in the address book. It replaces whatever `UID` the card carries, so that
 * the card is always found again where it was put.
 * @param body - The vCard text.
 * @param preconditions - What the request says the card must be.
 * @returns Whether the card was created or updated, or why it was not written.
 * @throws NotOneCardError when the body does not hold exactly one card; VCardSyntaxError when it is not
 * a vCard; CardRejectedError when the card cannot be kept as it is.
 */
export async function putCard(
  deps: BookDeps,
  userId: string,
  uid: string,
  body: string,
  preconditions: Preconditions,
): Promise<WriteOutcome> {
  const cards = parseVCards(body);
  const [card] = cards;
  const isOneCard = cards.length === 1 && card !== undefined;
  if (isOneCard === false) {
    throw new NotOneCardError('The body must hold exactly one vCard.');
  }
  return deps.db.transaction(async (tx) => {
    const [person] = await tx
      .select({ id: persons.id, revision: persons.revision })
      .from(persons)
      .where(and(eq(persons.userId, userId), eq(persons.uid, uid)))
      .limit(1);
    const isRefused = holds(preconditions, person ? etagOf(person.revision) : null) === false;
    if (isRefused) {
      return WriteOutcome.PreconditionFailed;
    }
    const saved = await saveCard(
      tx,
      userId,
      { ...card, uid },
      {
        mode: SaveMode.Replace,
        personId: person?.id ?? null,
        country: await defaultCountryOf(tx, userId),
        avatars: deps.avatars,
      },
    );
    return saved.isNew ? WriteOutcome.Created : WriteOutcome.Updated;
  });
}

/**
 * Deletes a card, and with it the person and everything kept about them.
 *
 * @param deps - The database and the avatar store.
 * @param userId - The user whose address book it is in.
 * @param uid - The card's name in the address book.
 * @param preconditions - What the request says the card must be.
 * @returns Whether the card was deleted, or why it was not.
 */
export async function deleteCard(
  deps: BookDeps,
  userId: string,
  uid: string,
  preconditions: Preconditions,
): Promise<WriteOutcome> {
  const own = and(eq(persons.userId, userId), eq(persons.uid, uid));
  const result = await deps.db.transaction(async (tx) => {
    const [person] = await tx
      .select({ id: persons.id, revision: persons.revision, avatarPath: persons.avatarPath })
      .from(persons)
      .where(own)
      .limit(1);
    if (!person) {
      return { outcome: WriteOutcome.Missing, avatarPath: null };
    }
    const isRefused = holds(preconditions, etagOf(person.revision)) === false;
    if (isRefused) {
      return { outcome: WriteOutcome.PreconditionFailed, avatarPath: null };
    }
    await buryPersons(tx, userId, [person.id]);
    await tx.delete(persons).where(own);
    return { outcome: WriteOutcome.Deleted, avatarPath: person.avatarPath };
  });
  const { avatars } = deps;
  const { avatarPath } = result;
  if (avatars !== null && avatarPath !== null) {
    // After the commit: a delete that rolled back would otherwise leave a person pointing at no file.
    await removeAvatarFile(avatars, avatarPath);
  }
  return result.outcome;
}
