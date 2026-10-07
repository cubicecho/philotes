import type { DB } from '@cubicecho/philotes-db';
import { normalizeContactValue } from '@cubicecho/philotes-db/normalize';
import { contactInfos, users } from '@cubicecho/philotes-db/schema';
import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { UNNORMALIZED_VALUE } from '../graphql/tenancy.ts';
import type { Transaction } from '../graphql/write-guards.ts';

// A contact detail's `normalizedValue` is what a caller or an email address is matched on: E.164 for
// a phone, lower case for the rest. It is derived, so nothing a client sends sets it.

/**
 * Reads the country a user's phone numbers are read in when they carry no country code.
 *
 * @param tx - The client or transaction to read with.
 * @param userId - The user.
 * @returns The ISO 3166-1 alpha-2 code.
 * @throws When the user's row is gone.
 */
export async function defaultCountryOf(tx: DB | Transaction, userId: string): Promise<string> {
  const [user] = await tx.select({ country: users.defaultCountry }).from(users).where(eq(users.id, userId));
  if (!user) {
    throw new Error(`User ${userId} has no row to read a default country from.`);
  }
  return user.country;
}

/**
 * Works out `normalizedValue` again for some of a user's contact details, and stores each one that changed.
 *
 * @param tx - The transaction to write in.
 * @param userId - The user who owns the rows.
 * @param [which] - Narrows the rows. Left out, every contact detail of the user is gone over.
 * @returns The normalized value of each row gone over, by the row's id.
 */
export async function renormalizeContactInfos(
  tx: Transaction,
  userId: string,
  which?: SQL,
): Promise<Map<string, string>> {
  const country = await defaultCountryOf(tx, userId);
  const rows = await tx
    .select({
      id: contactInfos.id,
      type: contactInfos.type,
      value: contactInfos.value,
      normalizedValue: contactInfos.normalizedValue,
    })
    .from(contactInfos)
    .where(and(eq(contactInfos.userId, userId), which));

  const normalizedById = new Map<string, string>();
  for (const row of rows) {
    const normalizedValue = normalizeContactValue(row.type, row.value, country);
    const isStale = normalizedValue !== row.normalizedValue;
    if (isStale) {
      await tx.update(contactInfos).set({ normalizedValue }).where(eq(contactInfos.id, row.id));
    }
    normalizedById.set(row.id, normalizedValue);
  }
  return normalizedById;
}

/** A written contact detail as the generated mutation hands it over: only the columns the client asked for. */
export interface WrittenContactInfo {
  id?: string;
  normalizedValue?: string;
}

/**
 * Works out `normalizedValue` for the contact details a write just produced, in the database and on
 * the rows themselves, which are what the mutation answers with.
 *
 * The rows carry only the columns the client selected. With every id in hand, exactly those rows are
 * gone over. Without, a create goes over the caller's rows that have no normalized value yet, and any
 * other write goes over all of the caller's. A row with no id keeps the value it came back with, so a
 * client that reads `normalizedValue` from a mutation selects `id` too.
 *
 * @param tx - The mutation's transaction.
 * @param userId - The caller.
 * @param isCreate - Whether the write made the rows.
 * @param rows - The written rows, as the database returned them.
 * @returns Nothing, once every row holds its normalized value.
 */
export async function normalizeWrittenContactInfos(
  tx: Transaction,
  userId: string,
  isCreate: boolean,
  rows: WrittenContactInfo[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const ids = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]));
  const hasEveryId = ids.length === rows.length;
  const unnormalized = isCreate ? eq(contactInfos.normalizedValue, UNNORMALIZED_VALUE) : undefined;
  const which = hasEveryId ? inArray(contactInfos.id, ids) : unnormalized;

  const normalizedById = await renormalizeContactInfos(tx, userId, which);
  for (const row of rows) {
    const normalizedValue = row.id === undefined ? undefined : normalizedById.get(row.id);
    if (normalizedValue !== undefined) {
      row.normalizedValue = normalizedValue;
    }
  }
}
