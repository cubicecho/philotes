import { schema as dbSchema } from '@philotes/db';
import type { BuildSchemaConfig } from '@vantreeseba/drizzle-graphql';
import { and, eq, inArray } from 'drizzle-orm';
import { notFound, requireAuth } from '../core/errors.ts';
import type { Context } from './handler.ts';

// A row scope confines reads, updates and deletes, but it cannot reach a plain
// insert, and it says nothing about the rows a foreign key *points at*. These
// hooks close that half: on every create and update of a table that references
// another user's data by id, each referenced id must belong to the caller.
//
// They run at the `before` position, inside the mutation's own transaction, so
// a throw rolls the write back and there is no window between check and write.

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 table/column type compat
type AnyTable = any;
type Row = Record<string, unknown>;

/** A foreign key and the query that says which of its values the user owns. */
interface ForeignKey {
  /** Column property name on the referencing table. */
  key: string;
  /** Name used in the "not found" a caller sees — never leak another user's row. */
  entity: string;
  /** Ids among `ids` that belong to `userId`. */
  owned: (tx: AnyTable, userId: string, ids: string[]) => Promise<string[]>;
}

/** A parent table owned outright through its own `user_id`. */
const ownedDirectly = (key: string, entity: string, parent: AnyTable): ForeignKey => ({
  key,
  entity,
  owned: async (tx, userId, ids) => {
    const rows: Array<{ id: string }> = await tx
      .select({ id: parent.id })
      .from(parent)
      .where(and(inArray(parent.id, ids), eq(parent.userId, userId)));
    return rows.map((row) => row.id);
  },
});

/** persons are shared; a user owns the ones in their contacts. */
const ownedThroughContacts = (key: string): ForeignKey => ({
  key,
  entity: 'Person',
  owned: async (tx, userId, ids) => {
    const rows: Array<{ id: string }> = await tx
      .select({ id: dbSchema.userPersons.personId })
      .from(dbSchema.userPersons)
      .where(and(inArray(dbSchema.userPersons.personId, ids), eq(dbSchema.userPersons.userId, userId)));
    return rows.map((row) => row.id);
  },
});

const note = ownedDirectly('noteId', 'Note', dbSchema.notes);
const label = ownedDirectly('labelId', 'Label', dbSchema.labels);
const interaction = ownedDirectly('interactionId', 'Interaction', dbSchema.interactions);
const importantDate = ownedDirectly('importantDateId', 'ImportantDate', dbSchema.importantDates);

const FOREIGN_KEYS: Record<string, ForeignKey[]> = {
  noteTags: [note, label],
  noteMentions: [note, ownedThroughContacts('mentionedPersonId')],
  interactionTags: [interaction, label],
  importantDateTags: [importantDate, label],
  personLabels: [ownedThroughContacts('personId'), label],
};

/**
 * The rows a mutation is about to write: `values` on a create (one row or a
 * list), `set` on an update, one `set` per entry on a batch update. A delete
 * writes nothing and so has nothing to check.
 */
export function writtenRows(args: { values?: Row | Row[]; set?: Row; updates?: Array<{ set?: Row }> }): Row[] {
  if (args.values) {
    return Array.isArray(args.values) ? args.values : [args.values];
  }
  if (args.updates) {
    return args.updates.flatMap((entry) => (entry.set ? [entry.set] : []));
  }
  return args.set ? [args.set] : [];
}

async function assertForeignKeysOwned(
  tx: AnyTable,
  userId: string,
  rows: Row[],
  foreignKeys: ForeignKey[],
): Promise<void> {
  for (const fk of foreignKeys) {
    const referenced = [
      ...new Set(rows.map((row) => row[fk.key]).filter((id): id is string => typeof id === 'string')),
    ];
    if (referenced.length === 0) {
      continue;
    }
    const owned = new Set(await fk.owned(tx, userId, referenced));
    const missing = referenced.find((id) => owned.has(id) === false);
    if (missing !== undefined) {
      throw notFound(`${fk.entity} not found`);
    }
  }
}

export const onWrite: NonNullable<BuildSchemaConfig['onWrite']> = Object.fromEntries(
  Object.entries(FOREIGN_KEYS).map(([table, foreignKeys]) => [
    table,
    {
      before: async ({ args, context, tx }: { args: Row; context: unknown; tx: AnyTable }) =>
        assertForeignKeysOwned(tx, requireAuth(context as Context), writtenRows(args), foreignKeys),
    },
  ]),
);
