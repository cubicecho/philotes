import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import type { WriteHookPayload, WriteHookPositions, WriteOperation } from '@vantreeseba/drizzle-graphql';
import { and, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { badInput, notFound, requireAuth } from '../core/errors.ts';
import { violatedUniqueConstraint } from '../core/pg-errors.ts';
import { parseOrThrow } from '../core/validation.ts';

/** One written row: column values by TS key. */
export type Row = Record<string, unknown>;
/** The transaction a mutation and its hooks run in. */
export type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];
/** A user-owned table that other tables point at. */
type OwnedParent =
  | typeof dbSchema.notes
  | typeof dbSchema.labels
  | typeof dbSchema.interactions
  | typeof dbSchema.importantDates;
/** `persons` is shared between users. A person is the caller's when a `user_persons` row links the two. */
type SharedParent = typeof dbSchema.persons;

/** A column that references a parent the caller must own. */
export interface ForeignKey {
  /** The referencing column's TS key. */
  key: string;
  /** What the parent is called in error messages. */
  entity: string;
  parent: OwnedParent | SharedParent;
}

/** Writes that supply no rows, so there is nothing to check before them. */
export const WRITES_WITHOUT_ROWS = new Set<WriteOperation>(['delete', 'restore']);

/** The arguments a generated write can carry rows in. */
interface WriteArgs {
  /** Rows on create. */
  values?: Row | Row[];
  /** The changed columns on update. */
  set?: Row;
  /** One entry per statement on batch update. */
  updates?: Array<{ set?: Row }>;
}

/**
 * Collects the rows a write supplies.
 *
 * @param args - Mutation args.
 * @returns One row per written set.
 */
export function writtenRows(args: WriteArgs): Row[] {
  if (args.values !== undefined) {
    return Array.isArray(args.values) ? args.values : [args.values];
  }
  if (args.updates !== undefined) {
    return args.updates.flatMap((update) => (update.set === undefined ? [] : [update.set]));
  }
  if (args.set !== undefined) {
    return [args.set];
  }
  return [];
}

/**
 * Tells the shared `persons` table from the tables a user owns outright.
 *
 * @param parent - The table a foreign key points at.
 * @returns Whether it is `persons`.
 */
function isSharedParent(parent: ForeignKey['parent']): parent is SharedParent {
  return parent === dbSchema.persons;
}

/**
 * Finds which of the referenced parents belong to the caller.
 *
 * @param tx - Mutation transaction.
 * @param userId - Caller.
 * @param parent - The table the ids point at.
 * @param ids - Referenced ids.
 * @returns The ids the caller owns, or for `persons`, has in their contacts.
 */
async function ownedIds(
  tx: Transaction,
  userId: string,
  parent: ForeignKey['parent'],
  ids: string[],
): Promise<Set<string>> {
  if (isSharedParent(parent)) {
    const { userPersons } = dbSchema;
    const isLinkedToCaller = and(inArray(userPersons.personId, ids), eq(userPersons.userId, userId));
    const linked = await tx.select({ id: userPersons.personId }).from(userPersons).where(isLinkedToCaller);
    return new Set(linked.map((row) => row.id));
  }
  const isOwnedByCaller = and(inArray(parent.id, ids), eq(parent.userId, userId));
  const owned = await tx.select({ id: parent.id }).from(parent).where(isOwnedByCaller);
  return new Set(owned.map((row) => row.id));
}

/**
 * Checks that every parent the rows point at belongs to the caller.
 *
 * @param tx - Mutation transaction.
 * @param userId - Caller.
 * @param rows - Written rows.
 * @param foreignKeys - Foreign keys to check.
 * @throws A NOT_FOUND error naming the parent when one is someone else's or missing.
 */
export async function assertForeignKeysOwned(
  tx: Transaction,
  userId: string,
  rows: Row[],
  foreignKeys: ForeignKey[],
): Promise<void> {
  for (const { key, entity, parent } of foreignKeys) {
    const ids = rows.map((row) => row[key]).filter((id) => typeof id === 'string');
    const referenced = [...new Set(ids)];
    if (referenced.length === 0) {
      continue;
    }
    const owned = await ownedIds(tx, userId, parent, referenced);
    const hasForeignParent = referenced.some((id) => owned.has(id) === false);
    if (hasForeignParent) {
      // NOT_FOUND, not FORBIDDEN: "you may not touch this" would confirm the row exists.
      throw notFound(`${entity} not found`);
    }
  }
}

/** What a table checks before each of its generated writes. */
export interface WriteGuard {
  /** The table's input schema. A junction table of ids has none. */
  input?: z.ZodType;
  /** The parents its rows point at. */
  foreignKeys?: ForeignKey[];
}

/**
 * Builds a table's `before` hook: every written row is validated, then every parent it names must be the caller's.
 *
 * @param guard - The table's input schema and foreign keys.
 * @returns The hook positions for `onWrite`.
 */
export function guardWrites({ input, foreignKeys = [] }: WriteGuard): WriteHookPositions {
  return {
    /**
     * Validates input and parent ownership.
     *
     * @param payload - The write about to run.
     */
    before: async ({ args, context, tx }: WriteHookPayload) => {
      const rows = writtenRows(args);
      if (input !== undefined) {
        for (const row of rows) {
          parseOrThrow(input, row);
        }
      }
      await assertForeignKeysOwned(tx, requireAuth(context), rows, foreignKeys);
    },
  };
}

/** What a caller is told when a write repeats a value that must be unique, by constraint name. */
const UNIQUE_VIOLATION_MESSAGES: Record<string, string> = {
  uq_persons_email: 'Another contact already uses that email.',
};
const UNIQUE_VIOLATION_FALLBACK = 'That already exists.';

/**
 * Turns a unique violation from a generated write into BAD_USER_INPUT. Passed to drizzle-graphql as `onError`.
 *
 * @param error - What the generated resolver threw.
 * @returns The coded error, or undefined to keep drizzle-graphql's default handling.
 */
export function mapWriteError(error: unknown): unknown {
  const constraint = violatedUniqueConstraint(error);
  if (constraint === null) {
    return undefined;
  }
  return badInput(UNIQUE_VIOLATION_MESSAGES[constraint] ?? UNIQUE_VIOLATION_FALLBACK);
}
