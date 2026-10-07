import * as dbSchema from '@cubicecho/philotes-db/schema';
import { extractFilters, type WriteHookPayload, type WriteHookPositions } from '@vantreeseba/drizzle-graphql';
import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { requireAuth } from '../core/errors.ts';
import { type Row, type Transaction, writtenRows } from '../graphql/write-guards.ts';
import { buryPersons, touchNewPersons, touchPersons } from './revisions.ts';

// Every generated write to a table a contact card is drawn from counts as a change to the people it
// touches. The people are found before the statement runs, from the write's own `where`: the rows an
// `after` hook is handed carry only the columns the client selected, which need not name the person
// (cubicecho/drizzle-graphql#177).

const { addresses, contactInfos, importantDates, labels, personLabels, persons } = dbSchema;

/** The tables whose rows belong to one person, by the column that says which. */
const DETAIL_TABLES = { addresses, contactInfos, importantDates, personLabels } as const;

/** A table a contact card is drawn from, by its schema key. */
export type CardTable = keyof typeof DETAIL_TABLES | 'labels' | 'persons';

/** Every table a contact card is drawn from. A write to one of them changes a person's revision. */
export const CARD_TABLES: readonly CardTable[] = [
  'addresses',
  'contactInfos',
  'importantDates',
  'labels',
  'personLabels',
  'persons',
];

/**
 * The tables that point at a person and are not on their contact card, each with why a write to it
 * leaves the person's revision alone. A new table that points at a person goes here or in `CARD_TABLES`.
 */
export const OFF_CARD_TABLES: Readonly<Record<string, string>> = {
  gratitudes: 'Private to Philotes. A phone never sees it.',
  importantDatePersons: "Tags someone else in a date. The card carries only the dates that are the person's own.",
  interactions: 'Private to Philotes. A phone never sees it.',
  noteMentions: 'Private to Philotes. A phone never sees it.',
  notes: "Private to Philotes. The card's note is the person's `about`.",
  personRelationships: 'Relationships do not travel over vCard.',
  tasks: 'Private to Philotes. A phone never sees it.',
};

/** The column a detail row names its person in. */
const PERSON_KEY = 'personId';

/** The writes that make rows, which have no `where`. */
const ROW_MAKING_WRITES = new Set(['insert', 'upsert']);
const DELETE = 'delete';

/** A generated `where` argument, as the filter compiler takes it. */
type Where = Parameters<typeof extractFilters>[2];

/** The arguments a generated write can narrow its rows with. */
interface NarrowingArgs {
  where?: Where;
  /** One entry per statement on a batch update. */
  updates?: Array<{ where?: Where }>;
}

/**
 * Compiles one generated `where` into SQL.
 *
 * @param table - The table it filters.
 * @param key - The table's schema key.
 * @param where - The argument as the client sent it.
 * @returns The condition, or undefined for "every row": a missing filter, or one that reaches through
 * a relation, which cannot be compiled here. Too many people marked as changed costs a re-sync; too few
 * loses a change.
 */
function compileWhere(table: PgTable, key: string, where: Where | undefined): SQL | undefined {
  if (where === undefined) {
    return undefined;
  }
  try {
    return extractFilters(table, key, where);
  } catch {
    return undefined;
  }
}

/**
 * Builds the condition for the rows a write is about to change.
 *
 * @param table - The table being written.
 * @param key - The table's schema key.
 * @param args - The mutation's arguments.
 * @returns The condition, or undefined when any of its statements can reach every row.
 */
function writtenWhere(table: PgTable, key: string, args: NarrowingArgs): SQL | undefined {
  const wheres = args.updates === undefined ? [args.where] : args.updates.map((update) => update.where);
  const conditions = wheres.map((where) => compileWhere(table, key, where));
  const defined = conditions.filter((condition) => condition !== undefined);
  const reachesEveryRow = defined.length < conditions.length;
  return reachesEveryRow ? undefined : or(...defined);
}

/**
 * Finds the people whose card holds the rows a write is about to change.
 *
 * @param tx - The mutation's transaction.
 * @param userId - The caller.
 * @param key - The table being written.
 * @param args - The mutation's arguments.
 * @returns The ids of the people, each once or more.
 */
async function personsOfWrittenRows(
  tx: Transaction,
  userId: string,
  key: CardTable,
  args: NarrowingArgs,
): Promise<string[]> {
  if (key === 'persons') {
    const which = and(eq(persons.userId, userId), writtenWhere(persons, key, args));
    const rows = await tx.select({ id: persons.id }).from(persons).where(which);
    return rows.map((row) => row.id);
  }
  if (key === 'labels') {
    // A label's name is on the card of everyone who wears it.
    const which = and(eq(labels.userId, userId), writtenWhere(labels, key, args));
    const written = tx.select({ id: labels.id }).from(labels).where(which);
    const rows = await tx
      .select({ id: personLabels.personId })
      .from(personLabels)
      .where(inArray(personLabels.labelId, written));
    return rows.map((row) => row.id);
  }
  const table = DETAIL_TABLES[key];
  const which = and(eq(table.userId, userId), writtenWhere(table, key, args));
  const rows = await tx.select({ id: table.personId }).from(table).where(which);
  return rows.flatMap((row) => (row.id === null ? [] : [row.id]));
}

/**
 * Reads the people the written rows name: a new detail's person, or the one a detail is moved to.
 *
 * @param rows - The rows a write supplies.
 * @returns The ids named.
 */
function personsNamedBy(rows: Row[]): string[] {
  return rows.map((row) => row[PERSON_KEY]).filter((id) => typeof id === 'string');
}

/**
 * Wraps a card table's hooks so that every generated write to it counts as a change to the people it
 * touches, and a deleted person leaves a tombstone.
 *
 * @param key - The table's schema key.
 * @param hooks - The table's own hooks, which still run first.
 * @returns The hook positions for `onWrite`.
 */
export function countingChanges(key: CardTable, hooks: WriteHookPositions): WriteHookPositions {
  return {
    /**
     * Runs the table's own checks, then marks the people the write will touch.
     *
     * @param payload - The write about to run.
     */
    before: async (payload: WriteHookPayload) => {
      await hooks.before?.(payload);
      const { args, context, operation, tx } = payload;
      const userId = requireAuth(context);
      const named = personsNamedBy(writtenRows(args));
      if (ROW_MAKING_WRITES.has(operation)) {
        await touchPersons(tx, userId, named);
        return;
      }
      const written = await personsOfWrittenRows(tx, userId, key, args);
      const isPersonDelete = key === 'persons' && operation === DELETE;
      if (isPersonDelete) {
        await buryPersons(tx, userId, written);
        return;
      }
      await touchPersons(tx, userId, [...written, ...named]);
    },
    /**
     * Runs the table's own follow-up, then gives new people their first revision.
     *
     * @param payload - The write that just ran.
     */
    after: async (payload: WriteHookPayload) => {
      await hooks.after?.(payload);
      const madePersons = key === 'persons' && ROW_MAKING_WRITES.has(payload.operation);
      if (madePersons) {
        await touchNewPersons(payload.tx, requireAuth(payload.context));
      }
    },
  };
}
