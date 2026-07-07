import { schema as dbSchema } from '@philotes/db';
import { and, type Column, eq, inArray, or } from 'drizzle-orm';
import { extendSchema, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../routes/graphql.ts';
import { requireAuth } from './auth.ts';

// ── SDL ───────────────────────────────────────────────────────────────────────

const DEDUPLICATE_SDL = parse(`
  type DuplicateGroup {
    matchValue: String!
    matchType: String!
    personIds: [String!]!
  }

  extend type Query {
    potentialDuplicates: [DuplicateGroup!]!
  }

  extend type Mutation {
    mergePersons(primaryId: String!, duplicateId: String!): Boolean!
  }
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
type AnyDB = any;

// Move a child table's rows from one person to another for a given user.
async function reassignRows(
  db: AnyDB,
  table: { personId: Column; userId: Column },
  fromPersonId: string,
  toPersonId: string,
  userId: string,
): Promise<void> {
  await db
    .update(table)
    .set({ personId: toPersonId })
    .where(and(eq(table.userId, userId), eq(table.personId, fromPersonId)));
}

// ── potentialDuplicates resolver ──────────────────────────────────────────────

async function findPotentialDuplicates(
  db: AnyDB,
  userId: string,
): Promise<Array<{ matchValue: string; matchType: string; personIds: string[] }>> {
  // Fetch all contact infos for this user
  const rows: Array<{ personId: string; type: string; value: string }> = await db
    .select({
      personId: dbSchema.contactInfos.personId,
      type: dbSchema.contactInfos.type,
      value: dbSchema.contactInfos.value,
    })
    .from(dbSchema.contactInfos)
    .where(eq(dbSchema.contactInfos.userId, userId));

  // Group by value — any value shared by 2+ persons is a potential duplicate
  const valueMap = new Map<string, { type: string; personIds: Set<string> }>();
  for (const row of rows) {
    const key = row.value.toLowerCase().trim();
    if (!key) continue;
    if (!valueMap.has(key)) {
      valueMap.set(key, { type: row.type, personIds: new Set() });
    }
    valueMap.get(key)!.personIds.add(row.personId);
  }

  const groups: Array<{ matchValue: string; matchType: string; personIds: string[] }> = [];
  for (const [value, { type, personIds }] of valueMap) {
    if (personIds.size >= 2) {
      groups.push({ matchValue: value, matchType: type, personIds: [...personIds] });
    }
  }

  return groups;
}

// ── mergePersons resolver ─────────────────────────────────────────────────────

async function mergeDuplicate(db: AnyDB, userId: string, primaryId: string, duplicateId: string): Promise<void> {
  // 1. Merge user_persons context — fill null fields on primary from duplicate
  const [[primaryCtx], [dupCtx]] = await Promise.all([
    db
      .select()
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, primaryId))),
    db
      .select()
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, duplicateId))),
  ]);

  // Fill any null context field on the primary from the duplicate. Guard on the
  // primary row existing; when only the duplicate has context there is nothing
  // to update against (the primary must already be in the user's contacts).
  if (primaryCtx && dupCtx) {
    await db
      .update(dbSchema.userPersons)
      .set({
        contactFrequency: primaryCtx.contactFrequency ?? dupCtx.contactFrequency,
        howWeMet: primaryCtx.howWeMet ?? dupCtx.howWeMet,
        firstMetDate: primaryCtx.firstMetDate ?? dupCtx.firstMetDate,
        avatarPath: primaryCtx.avatarPath ?? dupCtx.avatarPath,
      })
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, primaryId)));
  }

  // 2. Move simple child rows (notes, interactions, tasks, importantDates,
  //    addresses, gratitudes). gratitudes MUST be included: it FKs persons with
  //    onDelete cascade, so omitting it means step 7's delete silently destroys
  //    the user's gratitude entries for the duplicate instead of moving them.
  await Promise.all([
    reassignRows(db, dbSchema.notes, duplicateId, primaryId, userId),
    reassignRows(db, dbSchema.interactions, duplicateId, primaryId, userId),
    reassignRows(db, dbSchema.tasks, duplicateId, primaryId, userId),
    reassignRows(db, dbSchema.importantDates, duplicateId, primaryId, userId),
    reassignRows(db, dbSchema.addresses, duplicateId, primaryId, userId),
    reassignRows(db, dbSchema.gratitudes, duplicateId, primaryId, userId),
  ]);

  // 2b. Repoint note @mentions of the duplicate (in this user's notes) onto the
  //     primary. note_mentions has a composite PK (noteId, mentionedPersonId)
  //     and FKs persons with onDelete cascade, so a plain UPDATE could hit a PK
  //     conflict and the rows would otherwise be cascade-deleted at step 7.
  await reassignNoteMentions(db, duplicateId, primaryId, userId);

  // 3. Merge contactInfos — skip values the primary already has
  const existingInfos: Array<{ value: string }> = await db
    .select({ value: dbSchema.contactInfos.value })
    .from(dbSchema.contactInfos)
    .where(and(eq(dbSchema.contactInfos.userId, userId), eq(dbSchema.contactInfos.personId, primaryId)));
  const existingValues = new Set(existingInfos.map((r) => r.value.toLowerCase().trim()));

  const dupInfos: Array<{ id: string; value: string }> = await db
    .select({ id: dbSchema.contactInfos.id, value: dbSchema.contactInfos.value })
    .from(dbSchema.contactInfos)
    .where(and(eq(dbSchema.contactInfos.userId, userId), eq(dbSchema.contactInfos.personId, duplicateId)));

  const toMove = dupInfos.filter((r) => !existingValues.has(r.value.toLowerCase().trim()));
  if (toMove.length > 0) {
    await db
      .update(dbSchema.contactInfos)
      .set({ personId: primaryId })
      .where(
        inArray(
          dbSchema.contactInfos.id,
          toMove.map((r) => r.id),
        ),
      );
  }

  // 4. Merge person labels — insert any the primary doesn't already have
  const dupLabels: Array<{ labelId: string }> = await db
    .select({ labelId: dbSchema.personLabels.labelId })
    .from(dbSchema.personLabels)
    .where(and(eq(dbSchema.personLabels.userId, userId), eq(dbSchema.personLabels.personId, duplicateId)));

  for (const { labelId } of dupLabels) {
    await db.insert(dbSchema.personLabels).values({ personId: primaryId, labelId, userId }).onConflictDoNothing();
  }

  // 5. Merge personRelationships — repoint from/to duplicate → primary, skip self-loops
  const dupRels: Array<{ id: string; fromPersonId: string; toPersonId: string; type: string }> = await db
    .select({
      id: dbSchema.personRelationships.id,
      fromPersonId: dbSchema.personRelationships.fromPersonId,
      toPersonId: dbSchema.personRelationships.toPersonId,
      type: dbSchema.personRelationships.type,
    })
    .from(dbSchema.personRelationships)
    .where(
      and(
        eq(dbSchema.personRelationships.userId, userId),
        or(
          eq(dbSchema.personRelationships.fromPersonId, duplicateId),
          eq(dbSchema.personRelationships.toPersonId, duplicateId),
        ),
      ),
    );

  for (const rel of dupRels) {
    const newFrom = rel.fromPersonId === duplicateId ? primaryId : rel.fromPersonId;
    const newTo = rel.toPersonId === duplicateId ? primaryId : rel.toPersonId;
    if (newFrom === newTo) continue; // skip self-referential
    await db
      .insert(dbSchema.personRelationships)
      .values({ fromPersonId: newFrom, toPersonId: newTo, userId, type: rel.type })
      .onConflictDoNothing();
  }

  // 6. Remove duplicate's user_persons entry (removes it from this user's contacts)
  await db
    .delete(dbSchema.userPersons)
    .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, duplicateId)));

  // 7. If no other user tracks the duplicate person AND no child rows still
  //    reference it, delete the shared person row. The reference check prevents
  //    (a) destroying another tenant's cascade-linked data (gratitudes,
  //    interactions, …) they kept after removing the person from their contacts,
  //    and (b) a FK violation from notes.personId (no cascade → RESTRICT).
  const remaining: Array<{ userId: string }> = await db
    .select({ userId: dbSchema.userPersons.userId })
    .from(dbSchema.userPersons)
    .where(eq(dbSchema.userPersons.personId, duplicateId))
    .limit(1);

  if (remaining.length === 0 && !(await personStillReferenced(db, duplicateId))) {
    await db.delete(dbSchema.persons).where(eq(dbSchema.persons.id, duplicateId));
  }
}

// Repoint the current user's note mentions of `fromPersonId` onto `toPersonId`,
// avoiding the (noteId, mentionedPersonId) PK conflict by inserting-then-deleting.
async function reassignNoteMentions(
  db: AnyDB,
  fromPersonId: string,
  toPersonId: string,
  userId: string,
): Promise<void> {
  const mentions: Array<{ noteId: string }> = await db
    .select({ noteId: dbSchema.noteMentions.noteId })
    .from(dbSchema.noteMentions)
    .innerJoin(dbSchema.notes, eq(dbSchema.notes.id, dbSchema.noteMentions.noteId))
    .where(and(eq(dbSchema.notes.userId, userId), eq(dbSchema.noteMentions.mentionedPersonId, fromPersonId)));

  for (const { noteId } of mentions) {
    await db.insert(dbSchema.noteMentions).values({ noteId, mentionedPersonId: toPersonId }).onConflictDoNothing();
    await db
      .delete(dbSchema.noteMentions)
      .where(and(eq(dbSchema.noteMentions.noteId, noteId), eq(dbSchema.noteMentions.mentionedPersonId, fromPersonId)));
  }
}

// True if any child row (belonging to any user) still references the person.
async function personStillReferenced(db: AnyDB, personId: string): Promise<boolean> {
  const tables: AnyDB[] = [
    dbSchema.contactInfos,
    dbSchema.notes,
    dbSchema.interactions,
    dbSchema.tasks,
    dbSchema.importantDates,
    dbSchema.addresses,
    dbSchema.gratitudes,
    dbSchema.personLabels,
  ];
  for (const table of tables) {
    const [row] = await db
      .select({ personId: table.personId })
      .from(table)
      .where(eq(table.personId, personId))
      .limit(1);
    if (row) return true;
  }
  // personRelationships uses from/to columns rather than personId.
  const [rel] = await db
    .select({ id: dbSchema.personRelationships.id })
    .from(dbSchema.personRelationships)
    .where(
      or(
        eq(dbSchema.personRelationships.fromPersonId, personId),
        eq(dbSchema.personRelationships.toPersonId, personId),
      ),
    )
    .limit(1);
  if (rel) return true;
  // note_mentions references persons via mentionedPersonId.
  const [mention] = await db
    .select({ noteId: dbSchema.noteMentions.noteId })
    .from(dbSchema.noteMentions)
    .where(eq(dbSchema.noteMentions.mentionedPersonId, personId))
    .limit(1);
  return Boolean(mention);
}

// ── Extension ─────────────────────────────────────────────────────────────────

export function applyDeduplicateExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, DEDUPLICATE_SDL);
  const queryType = extendedSchema.getType('Query') as GraphQLObjectType;
  const mutationType = extendedSchema.getType('Mutation') as GraphQLObjectType;

  queryType.getFields().potentialDuplicates.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    const userId = requireAuth(ctx);
    return findPotentialDuplicates(ctx.db as AnyDB, userId);
  };

  mutationType.getFields().mergePersons.resolve = async (
    _parent: unknown,
    args: { primaryId: string; duplicateId: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    // Wrap the ~10 writes in a transaction so a mid-merge failure rolls back
    // instead of leaving the two records half-merged.
    const db = ctx.db as AnyDB;
    await db.transaction((tx: AnyDB) => mergeDuplicate(tx, userId, args.primaryId, args.duplicateId));
    return true;
  };

  return extendedSchema;
}
