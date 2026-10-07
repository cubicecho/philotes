import { persons, personTombstones, UNREVISED, users } from '@cubicecho/philotes-db/schema';
import { and, eq, inArray, type SQL, sql } from 'drizzle-orm';
import type { Transaction } from '../graphql/write-guards.ts';

// A user's people are numbered by change. `users.personsRevision` counts the changes, a person's
// `revision` is the count when they last changed, and a deleted person leaves a tombstone holding the
// count when they went. A client that remembers the count asks for what is above it. Taking the next
// number locks the user's row until the transaction ends, so changes commit in the order they are
// numbered and a client never skips one that commits late.

/**
 * Counts one more change to a user's people.
 *
 * @param tx - The transaction the change is written in.
 * @param userId - The user.
 * @returns The number of the change.
 * @throws When the user's row is gone.
 */
async function nextRevision(tx: Transaction, userId: string): Promise<number> {
  const [counted] = await tx
    .update(users)
    .set({ personsRevision: sql`${users.personsRevision} + 1` })
    .where(eq(users.id, userId))
    .returning({ revision: users.personsRevision });
  if (!counted) {
    throw new Error(`User ${userId} has no row to count a change on.`);
  }
  return counted.revision;
}

/**
 * Marks some of a user's people as changed, as one change.
 *
 * @param tx - The transaction the change is written in.
 * @param userId - The user who owns them.
 * @param which - Narrows the user's people to the ones that changed.
 * @returns Nothing, once each has the new revision. Nothing is counted when no one matches.
 */
async function touchWhere(tx: Transaction, userId: string, which: SQL | undefined): Promise<void> {
  const changed = and(eq(persons.userId, userId), which);
  const [anyone] = await tx.select({ id: persons.id }).from(persons).where(changed).limit(1);
  if (!anyone) {
    return;
  }
  const revision = await nextRevision(tx, userId);
  await tx.update(persons).set({ revision }).where(changed);
}

/**
 * Marks people as changed: call it in the transaction of any write to a person or to a detail their
 * contact card carries (contact details, addresses, labels, important dates, the picture).
 *
 * @param tx - The transaction the change is written in.
 * @param userId - The user who owns them. Someone else's person is left alone.
 * @param personIds - The people that changed.
 * @returns Nothing, once each has the new revision.
 */
export async function touchPersons(tx: Transaction, userId: string, personIds: Iterable<string>): Promise<void> {
  const ids = [...new Set(personIds)];
  if (ids.length === 0) {
    return;
  }
  await touchWhere(tx, userId, inArray(persons.id, ids));
}

/**
 * Gives the people a write just made their first revision.
 *
 * @param tx - The transaction they were made in.
 * @param userId - The user who owns them.
 * @returns Nothing, once none of the user's people is unrevised.
 */
export async function touchNewPersons(tx: Transaction, userId: string): Promise<void> {
  await touchWhere(tx, userId, eq(persons.revision, UNREVISED));
}

/**
 * Leaves a tombstone for each person about to be deleted. Call it before the delete, in its transaction.
 *
 * @param tx - The transaction the delete is written in.
 * @param userId - The user who owns them.
 * @param personIds - The people about to go.
 * @returns Nothing, once each has a tombstone at the new revision.
 */
export async function buryPersons(tx: Transaction, userId: string, personIds: Iterable<string>): Promise<void> {
  const ids = [...new Set(personIds)];
  if (ids.length === 0) {
    return;
  }
  const leaving = await tx
    .select({ personId: persons.id, uid: persons.uid })
    .from(persons)
    .where(and(eq(persons.userId, userId), inArray(persons.id, ids)));
  if (leaving.length === 0) {
    return;
  }
  const revision = await nextRevision(tx, userId);
  await tx
    .insert(personTombstones)
    .values(leaving.map((person) => ({ ...person, userId, revision })))
    // A phone can make a person again under the uid of one it deleted, and delete them again.
    .onConflictDoUpdate({
      target: [personTombstones.userId, personTombstones.uid],
      set: { personId: sql`excluded.person_id`, revision, deletedAt: sql`now()` },
    });
}
