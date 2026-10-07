import { schema as dbSchema } from '@philotes/db';
import { and, eq, inArray } from 'drizzle-orm';
import { extendSchema, GraphQLError, type GraphQLSchema, parse } from 'graphql';
import { requireAuth } from '../auth/resolvers.ts';
import type { Context } from '../graphql/handler.ts';

const MERGE_LABELS_SDL = `
  extend type Mutation {
    mergeLabelInto(keepId: UUID!, deleteId: UUID!): Label
  }
`;

interface JunctionDescriptor {
  table: typeof dbSchema.personLabels;
  fkColName: string;
  fkCol: (typeof dbSchema.personLabels)['personId'];
  labelCol: (typeof dbSchema.personLabels)['labelId'];
  /** Whether the table has its own `userId` column, which a new row must then carry. */
  hasOwner: boolean;
}

/**
 * Reassign all junction-table rows pointing to deleteId so they point to keepId.
 *
 * Uses insert-then-delete instead of UPDATE to avoid composite-PK violations:
 * if (personId, keepId) already exists, the insert is a no-op and the old row
 * is cleaned up. Any remaining rows pointing to deleteId are removed when the
 * label itself is deleted via CASCADE.
 *
 * @param db - The transaction to write in.
 * @param descriptor - The junction table and its columns.
 * @param deleteId - The label being merged away.
 * @param keepId - The label that takes its rows.
 * @param userId - The caller, who owns both labels.
 * @returns Nothing, once every row points at `keepId`.
 */
async function reassignJunctionRows(
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle dynamic table API requires any
  db: any,
  descriptor: JunctionDescriptor,
  deleteId: string,
  keepId: string,
  userId: string,
): Promise<void> {
  const { table, fkColName, fkCol, labelCol, hasOwner } = descriptor;
  const owner = hasOwner ? { userId } : {};

  const rows: Array<{ fk: string }> = await db.select({ fk: fkCol }).from(table).where(eq(labelCol, deleteId));

  for (const { fk } of rows) {
    await db
      .insert(table)
      .values({ [fkColName]: fk, labelId: keepId, ...owner })
      .onConflictDoNothing();

    await db.delete(table).where(and(eq(fkCol, fk), eq(labelCol, deleteId)));
  }
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
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    const db = context.db as any;

    const owned: Array<{ id: string }> = await db
      .select({ id: dbSchema.labels.id })
      .from(dbSchema.labels)
      .where(and(inArray(dbSchema.labels.id, [keepId, deleteId]), eq(dbSchema.labels.userId, userId)));
    const ownedIds = new Set(owned.map((l) => l.id));
    const isForeignLabel = ownedIds.has(keepId) === false || ownedIds.has(deleteId) === false;
    if (isForeignLabel) {
      throw new GraphQLError('Label not found');
    }

    const returnKept = async () => {
      const [kept] = await db.select().from(dbSchema.labels).where(eq(dbSchema.labels.id, keepId));
      return kept ?? null;
    };
    if (keepId === deleteId) {
      return returnKept();
    }

    const junctions: JunctionDescriptor[] = [
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.personLabels as any,
        fkColName: 'personId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.personLabels.personId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.personLabels.labelId as any,
        hasOwner: true,
      },
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.interactionTags as any,
        fkColName: 'interactionId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.interactionTags.interactionId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.interactionTags.labelId as any,
        hasOwner: false,
      },
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.importantDateTags as any,
        fkColName: 'importantDateId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.importantDateTags.importantDateId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.importantDateTags.labelId as any,
        hasOwner: false,
      },
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.noteTags as any,
        fkColName: 'noteId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.noteTags.noteId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.noteTags.labelId as any,
        hasOwner: false,
      },
    ];

    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    await db.transaction(async (tx: any) => {
      for (const junction of junctions) {
        await reassignJunctionRows(tx, junction, deleteId, keepId, userId);
      }

      // Delete the source label — CASCADE removes any remaining junction rows
      await tx.delete(dbSchema.labels).where(eq(dbSchema.labels.id, deleteId));
    });

    return returnKept();
  };

  return extended;
}
