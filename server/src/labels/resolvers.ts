import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { notFound, requireAuth } from '../core/errors.ts';

const MERGE_LABELS_SDL = `
  extend type Mutation {
    mergeLabelInto(keepId: UUID!, deleteId: UUID!): Label
  }
`;

/** A table that ties a label to one kind of row, and the column naming that row. */
interface Junction {
  table: PgTable;
  ownerColumn: AnyPgColumn;
  labelColumn: AnyPgColumn;
  userColumn: AnyPgColumn;
}

const JUNCTIONS: readonly Junction[] = [
  {
    table: dbSchema.personLabels,
    ownerColumn: dbSchema.personLabels.personId,
    labelColumn: dbSchema.personLabels.labelId,
    userColumn: dbSchema.personLabels.userId,
  },
  {
    table: dbSchema.interactionTags,
    ownerColumn: dbSchema.interactionTags.interactionId,
    labelColumn: dbSchema.interactionTags.labelId,
    userColumn: dbSchema.interactionTags.userId,
  },
  {
    table: dbSchema.importantDateTags,
    ownerColumn: dbSchema.importantDateTags.importantDateId,
    labelColumn: dbSchema.importantDateTags.labelId,
    userColumn: dbSchema.importantDateTags.userId,
  },
  {
    table: dbSchema.noteTags,
    ownerColumn: dbSchema.noteTags.noteId,
    labelColumn: dbSchema.noteTags.labelId,
    userColumn: dbSchema.noteTags.userId,
  },
];

/** A transaction as `db.transaction` hands it over. */
type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * Gives `keepId` every row of a junction table that `deleteId` has. A row `keepId` already has is
 * left alone, which an UPDATE could not do without breaking the composite key. The rows still
 * naming `deleteId` go when the label itself is deleted, by cascade.
 *
 * @param tx - The transaction to write in.
 * @param junction - The junction table and its columns.
 * @param deleteId - The label being merged away.
 * @param keepId - The label that takes its rows.
 * @param userId - The caller, who owns both labels.
 * @returns Nothing, once `keepId` has every row.
 */
async function copyJunctionRows(
  tx: Transaction,
  junction: Junction,
  deleteId: string,
  keepId: string,
  userId: string,
): Promise<void> {
  const { table, ownerColumn, labelColumn, userColumn } = junction;
  const columns = sql.join(
    [ownerColumn, labelColumn, userColumn].map((column) => sql.identifier(column.name)),
    sql`, `,
  );

  await tx.execute(sql`
    insert into ${table} (${columns})
    select ${ownerColumn}, ${keepId}::uuid, ${userId}::uuid from ${table} where ${labelColumn} = ${deleteId}
    on conflict do nothing
  `);
}

export function applyMergeLabelsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, parse(MERGE_LABELS_SDL));

  const mutationType = extended.getMutationType();
  if (!mutationType) {
    return extended;
  }

  mutationType.getFields().mergeLabelInto.resolve = async (
    _parent: unknown,
    { keepId, deleteId }: { keepId: string; deleteId: string },
    context: Context,
  ) => {
    const userId = requireAuth(context);
    const { db } = context;

    const owned = await db
      .select({ id: dbSchema.labels.id })
      .from(dbSchema.labels)
      .where(and(inArray(dbSchema.labels.id, [keepId, deleteId]), eq(dbSchema.labels.userId, userId)));
    const ownedIds = new Set(owned.map((l) => l.id));
    const isForeignLabel = ownedIds.has(keepId) === false || ownedIds.has(deleteId) === false;
    if (isForeignLabel) {
      throw notFound('Label not found');
    }

    const returnKept = async () => {
      const [kept] = await db.select().from(dbSchema.labels).where(eq(dbSchema.labels.id, keepId));
      return kept ?? null;
    };
    if (keepId === deleteId) {
      return returnKept();
    }

    await db.transaction(async (tx) => {
      for (const junction of JUNCTIONS) {
        await copyJunctionRows(tx, junction, deleteId, keepId, userId);
      }

      await tx.delete(dbSchema.labels).where(eq(dbSchema.labels.id, deleteId));
    });

    return returnKept();
  };

  return extended;
}
