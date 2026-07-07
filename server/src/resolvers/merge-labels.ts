import { type DB, schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';

const MERGE_LABELS_SDL = `
  extend type Mutation {
    mergeLabelInto(keepId: String!, deleteId: String!): Label
  }
`;

interface JunctionDescriptor {
  table: typeof dbSchema.personLabels;
  fkColName: string;
  fkCol: (typeof dbSchema.personLabels)['personId'];
  labelCol: (typeof dbSchema.personLabels)['labelId'];
}

/**
 * Reassign all junction-table rows pointing to deleteId so they point to keepId.
 *
 * Uses insert-then-delete instead of UPDATE to avoid composite-PK violations:
 * if (personId, keepId) already exists, the insert is a no-op and the old row
 * is cleaned up. Any remaining rows pointing to deleteId are removed when the
 * label itself is deleted via CASCADE.
 */
async function reassignJunctionRows(
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle dynamic table API requires any
  db: any,
  descriptor: JunctionDescriptor,
  deleteId: string,
  keepId: string,
): Promise<void> {
  const { table, fkColName, fkCol, labelCol } = descriptor;

  const rows: Array<{ fk: string }> = await db.select({ fk: fkCol }).from(table).where(eq(labelCol, deleteId));

  for (const { fk } of rows) {
    await db
      .insert(table)
      .values({ [fkColName]: fk, labelId: keepId })
      .onConflictDoNothing()
      .catch(() => {});

    await db.delete(table).where(and(eq(fkCol, fk), eq(labelCol, deleteId)));
  }
}

export function applyMergeLabelsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, parse(MERGE_LABELS_SDL));

  const mutationType = extended.getMutationType();
  if (!mutationType) return extended;

  mutationType.getFields().mergeLabelInto.resolve = async (
    _parent: unknown,
    { keepId, deleteId }: { keepId: string; deleteId: string },
    context: { db: DB },
  ) => {
    const { db } = context;

    const junctions: JunctionDescriptor[] = [
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.personLabels as any,
        fkColName: 'personId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.personLabels.personId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.personLabels.labelId as any,
      },
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.interactionTags as any,
        fkColName: 'interactionId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.interactionTags.interactionId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.interactionTags.labelId as any,
      },
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.importantDateTags as any,
        fkColName: 'importantDateId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.importantDateTags.importantDateId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.importantDateTags.labelId as any,
      },
      {
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        table: dbSchema.noteTags as any,
        fkColName: 'noteId',
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        fkCol: dbSchema.noteTags.noteId as any,
        // biome-ignore lint/suspicious/noExplicitAny: cross-table type cast
        labelCol: dbSchema.noteTags.labelId as any,
      },
    ];

    for (const junction of junctions) {
      await reassignJunctionRows(db, junction, deleteId, keepId);
    }

    // Delete the source label — CASCADE removes any remaining junction rows
    await db.delete(dbSchema.labels).where(eq(dbSchema.labels.id, deleteId));

    // Return the kept label
    const [kept] = await db.select().from(dbSchema.labels).where(eq(dbSchema.labels.id, keepId));

    return kept ?? null;
  };

  return extended;
}
