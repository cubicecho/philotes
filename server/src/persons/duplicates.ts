import type { DB } from '@cubicecho/philotes-db';
import type { ContactType } from '@cubicecho/philotes-db/schema';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { DUPLICATE_DEFAULTS } from '../core/defaults.ts';
import { badInput, notFound, requireAuth } from '../core/errors.ts';
import { objectType } from '../graphql/object-type.ts';
import { buryPersons, touchPersons } from './revisions.ts';

const DUPLICATES_SDL = `
  """People in the caller's contacts who share one contact detail."""
  type DuplicateGroup {
    """The shared detail, trimmed and lower-cased."""
    matchValue: String!
    """What kind of detail it is."""
    matchType: ContactTypeEnum!
    personIds: [UUID!]!
  }

  extend type Query {
    potentialDuplicates: [DuplicateGroup!]!
  }

  extend type Mutation {
    mergePersons(keepId: UUID!, mergeId: UUID!): UUID!
  }
`;

/** A transaction as `db.transaction` hands it over. */
type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];

/** People in one user's contacts who share one contact detail. */
export interface DuplicateGroup {
  /** The shared detail, trimmed and lower-cased. */
  matchValue: string;
  matchType: ContactType;
  /** The people who hold it, two or more. */
  personIds: string[];
}

/** A table whose rows are about one person, and are moved whole when that person is merged away. */
interface PersonOwnedTable {
  table: PgTable;
  personColumn: AnyPgColumn;
  userColumn: AnyPgColumn;
}

/** Every table whose rows a merge repoints at the kept person as they are. */
export const PERSON_OWNED_TABLES: readonly PersonOwnedTable[] = [
  { table: dbSchema.notes, personColumn: dbSchema.notes.personId, userColumn: dbSchema.notes.userId },
  {
    table: dbSchema.interactions,
    personColumn: dbSchema.interactions.personId,
    userColumn: dbSchema.interactions.userId,
  },
  { table: dbSchema.tasks, personColumn: dbSchema.tasks.personId, userColumn: dbSchema.tasks.userId },
  {
    table: dbSchema.importantDates,
    personColumn: dbSchema.importantDates.personId,
    userColumn: dbSchema.importantDates.userId,
  },
  { table: dbSchema.addresses, personColumn: dbSchema.addresses.personId, userColumn: dbSchema.addresses.userId },
  { table: dbSchema.gratitudes, personColumn: dbSchema.gratitudes.personId, userColumn: dbSchema.gratitudes.userId },
];

/** A junction table that ties a person to one other row. Its composite key names both. */
interface PersonJunction {
  table: PgTable;
  /** The column naming the other row. */
  otherColumn: AnyPgColumn;
  personColumn: AnyPgColumn;
  userColumn: AnyPgColumn;
}

/** Every junction table whose rows a merge copies to the kept person. */
export const PERSON_JUNCTIONS: readonly PersonJunction[] = [
  {
    table: dbSchema.personLabels,
    otherColumn: dbSchema.personLabels.labelId,
    personColumn: dbSchema.personLabels.personId,
    userColumn: dbSchema.personLabels.userId,
  },
  {
    table: dbSchema.noteMentions,
    otherColumn: dbSchema.noteMentions.noteId,
    personColumn: dbSchema.noteMentions.mentionedPersonId,
    userColumn: dbSchema.noteMentions.userId,
  },
  {
    table: dbSchema.importantDatePersons,
    otherColumn: dbSchema.importantDatePersons.importantDateId,
    personColumn: dbSchema.importantDatePersons.personId,
    userColumn: dbSchema.importantDatePersons.userId,
  },
];

/** The tables a merge handles with its own rules: de-duplicated details and repointed relationships. */
export const SPECIALLY_MERGED_TABLES: readonly PgTable[] = [dbSchema.contactInfos, dbSchema.personRelationships];

/**
 * Puts a contact detail in the form two entries of it are compared in.
 *
 * @param value - The detail as stored.
 * @returns It trimmed and lower-cased.
 */
function normalizeDetail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Finds the people in a user's contacts who share a contact detail.
 *
 * @param db - Drizzle client.
 * @param userId - The user whose contacts are searched.
 * @returns The groups, ordered by the shared detail and capped at `DUPLICATE_DEFAULTS.maxGroups`.
 */
export async function findPotentialDuplicates(db: DB, userId: string): Promise<DuplicateGroup[]> {
  const details = await db
    .select({
      personId: dbSchema.contactInfos.personId,
      type: dbSchema.contactInfos.type,
      value: dbSchema.contactInfos.value,
    })
    .from(dbSchema.contactInfos)
    .where(eq(dbSchema.contactInfos.userId, userId));

  const groups = new Map<string, { matchType: ContactType; personIds: Set<string> }>();
  for (const { personId, type, value } of details) {
    const matchValue = normalizeDetail(value);
    if (!matchValue) {
      continue;
    }
    const group = groups.get(matchValue) ?? { matchType: type, personIds: new Set<string>() };
    group.personIds.add(personId);
    groups.set(matchValue, group);
  }

  return [...groups]
    .filter(([, group]) => group.personIds.size > 1)
    .map(([matchValue, group]) => ({ matchValue, matchType: group.matchType, personIds: [...group.personIds].sort() }))
    .sort((a, b) => a.matchValue.localeCompare(b.matchValue))
    .slice(0, DUPLICATE_DEFAULTS.maxGroups);
}

/**
 * Fills what the kept person lacks from the merged one: contact frequency, how they met, when, and
 * the avatar.
 *
 * @param tx - The transaction to write in.
 * @param userId - The caller.
 * @param keepId - The person who stays.
 * @param mergeId - The person merged away.
 * @returns Nothing, once the kept person's fields are written.
 */
async function mergePersonFields(tx: Transaction, userId: string, keepId: string, mergeId: string): Promise<void> {
  const { persons } = dbSchema;
  const rows = await tx
    .select()
    .from(persons)
    .where(and(eq(persons.userId, userId), inArray(persons.id, [keepId, mergeId])));
  const kept = rows.find((row) => row.id === keepId);
  const merged = rows.find((row) => row.id === mergeId);
  if (!kept || !merged) {
    return;
  }

  await tx
    .update(persons)
    .set({
      contactFrequency: kept.contactFrequency ?? merged.contactFrequency,
      howWeMet: kept.howWeMet ?? merged.howWeMet,
      firstMetDate: kept.firstMetDate ?? merged.firstMetDate,
      avatarPath: kept.avatarPath ?? merged.avatarPath,
    })
    .where(eq(persons.id, keepId));
}

/**
 * Moves the merged person's contact details to the kept person. A detail the kept person already
 * has is dropped, and a moved one is no longer primary, so the kept person's primary stands.
 *
 * @param tx - The transaction to write in.
 * @param userId - The caller.
 * @param keepId - The person who stays.
 * @param mergeId - The person merged away.
 * @returns Nothing, once the merged person has no contact details left.
 */
async function mergeContactInfos(tx: Transaction, userId: string, keepId: string, mergeId: string): Promise<void> {
  const rows = await tx
    .select({
      id: dbSchema.contactInfos.id,
      personId: dbSchema.contactInfos.personId,
      value: dbSchema.contactInfos.value,
    })
    .from(dbSchema.contactInfos)
    .where(and(eq(dbSchema.contactInfos.userId, userId), inArray(dbSchema.contactInfos.personId, [keepId, mergeId])));

  const keptValues = new Set(rows.filter((row) => row.personId === keepId).map((row) => normalizeDetail(row.value)));
  const movedIds: string[] = [];
  const droppedIds: string[] = [];
  for (const row of rows.filter((candidate) => candidate.personId === mergeId)) {
    const value = normalizeDetail(row.value);
    if (keptValues.has(value)) {
      droppedIds.push(row.id);
      continue;
    }
    keptValues.add(value);
    movedIds.push(row.id);
  }

  if (movedIds.length > 0) {
    await tx
      .update(dbSchema.contactInfos)
      .set({ personId: keepId, isPrimary: false })
      .where(inArray(dbSchema.contactInfos.id, movedIds));
  }
  if (droppedIds.length > 0) {
    await tx.delete(dbSchema.contactInfos).where(inArray(dbSchema.contactInfos.id, droppedIds));
  }
}

/**
 * Gives the kept person every row of a junction table the merged person has, then removes the
 * merged person's. A row the kept person already has is left alone, which an UPDATE could not do
 * without breaking the composite key.
 *
 * @param tx - The transaction to write in.
 * @param junction - The junction table and its columns.
 * @param userId - The caller.
 * @param keepId - The person who stays.
 * @param mergeId - The person merged away.
 * @returns Nothing, once the merged person has no rows left in the table.
 */
async function mergeJunctionRows(
  tx: Transaction,
  junction: PersonJunction,
  userId: string,
  keepId: string,
  mergeId: string,
): Promise<void> {
  const { table, otherColumn, personColumn, userColumn } = junction;
  const columns = sql.join(
    [otherColumn, personColumn, userColumn].map((column) => sql.identifier(column.name)),
    sql`, `,
  );
  const mergedRows = and(eq(personColumn, mergeId), eq(userColumn, userId));

  await tx.execute(sql`
    insert into ${table} (${columns})
    select ${otherColumn}, ${keepId}::uuid, ${userId}::uuid from ${table} where ${mergedRows}
    on conflict do nothing
  `);
  await tx.delete(table).where(mergedRows);
}

/**
 * Points the merged person's relationships at the kept person. A relationship between the two
 * would join the kept person to themselves, so it is removed, and so is a relationship the kept
 * person now has twice.
 *
 * @param tx - The transaction to write in.
 * @param userId - The caller.
 * @param keepId - The person who stays.
 * @param mergeId - The person merged away.
 * @returns Nothing, once no relationship of the caller's names the merged person.
 */
async function mergeRelationships(tx: Transaction, userId: string, keepId: string, mergeId: string): Promise<void> {
  const { personRelationships } = dbSchema;
  const isOwn = eq(personRelationships.userId, userId);

  await tx
    .update(personRelationships)
    .set({ fromPersonId: keepId })
    .where(and(isOwn, eq(personRelationships.fromPersonId, mergeId)));
  await tx
    .update(personRelationships)
    .set({ toPersonId: keepId })
    .where(and(isOwn, eq(personRelationships.toPersonId, mergeId)));
  await tx
    .delete(personRelationships)
    .where(and(isOwn, eq(personRelationships.fromPersonId, keepId), eq(personRelationships.toPersonId, keepId)));

  await tx.execute(sql`
    delete from ${personRelationships} as later
    using ${personRelationships} as earlier
    where later.user_id = ${userId}::uuid
      and earlier.user_id = later.user_id
      and earlier.from_person_id = later.from_person_id
      and earlier.to_person_id = later.to_person_id
      and earlier.type = later.type
      and earlier.id < later.id
      and ${keepId}::uuid in (later.from_person_id, later.to_person_id)
  `);
}

/**
 * Removes the tags that name the kept person on one of their own dates, which a merge leaves
 * behind when the two people were tagged on each other's dates.
 *
 * @param tx - The transaction to write in.
 * @param userId - The caller.
 * @param keepId - The person who stays.
 * @returns Nothing, once no date of the kept person tags them.
 */
async function removeSelfTaggedDates(tx: Transaction, userId: string, keepId: string): Promise<void> {
  const { importantDatePersons, importantDates } = dbSchema;
  const ownDates = tx
    .select({ id: importantDates.id })
    .from(importantDates)
    .where(and(eq(importantDates.userId, userId), eq(importantDates.personId, keepId)));

  await tx
    .delete(importantDatePersons)
    .where(
      and(
        eq(importantDatePersons.userId, userId),
        eq(importantDatePersons.personId, keepId),
        inArray(importantDatePersons.importantDateId, ownDates),
      ),
    );
}

/**
 * Folds one of a user's people into another, in one transaction: everything recorded about the
 * merged person moves to the kept one, and the merged person is deleted.
 *
 * @param db - Drizzle client.
 * @param userId - The caller, who owns both people.
 * @param keepId - The person who stays.
 * @param mergeId - The person merged away.
 * @returns Nothing, once the merge is committed.
 */
export async function mergePersons(db: DB, userId: string, keepId: string, mergeId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await mergePersonFields(tx, userId, keepId, mergeId);

    for (const { table, personColumn, userColumn } of PERSON_OWNED_TABLES) {
      await tx.execute(sql`
        update ${table} set ${sql.identifier(personColumn.name)} = ${keepId}::uuid
        where ${personColumn} = ${mergeId} and ${userColumn} = ${userId}
      `);
    }

    await mergeContactInfos(tx, userId, keepId, mergeId);
    for (const junction of PERSON_JUNCTIONS) {
      await mergeJunctionRows(tx, junction, userId, keepId, mergeId);
    }
    await removeSelfTaggedDates(tx, userId, keepId);
    await mergeRelationships(tx, userId, keepId, mergeId);

    // To a phone the kept contact changed and the merged one was deleted.
    await touchPersons(tx, userId, [keepId]);
    await buryPersons(tx, userId, [mergeId]);
    const { persons } = dbSchema;
    await tx.delete(persons).where(and(eq(persons.userId, userId), eq(persons.id, mergeId)));
  });
}

/**
 * Adds `potentialDuplicates` and `mergePersons` to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the duplicate query and the merge mutation.
 */
export function applyDuplicatesExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, parse(DUPLICATES_SDL));

  const queryType = objectType(extended, 'Query');
  const mutationType = objectType(extended, 'Mutation');

  /**
   * Resolves `Query.potentialDuplicates`. Lists the people in the signed-in caller's contacts who
   * share a contact detail.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param context - Request context.
   * @returns The groups, each of two or more people.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
  queryType.getFields().potentialDuplicates.resolve = (_parent: unknown, _args: unknown, context: Context) =>
    findPotentialDuplicates(context.db, requireAuth(context));

  /**
   * Resolves `Mutation.mergePersons`. Folds one person in the signed-in caller's contacts into
   * another.
   *
   * @param _parent - Unused.
   * @param args.keepId - The person who stays.
   * @param args.mergeId - The person merged into them and deleted.
   * @param context - Request context.
   * @returns The kept person's id.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when both ids name the same person.
   * @throws NOT_FOUND when either person is not the caller's.
   */
  mutationType.getFields().mergePersons.resolve = async (
    _parent: unknown,
    { keepId, mergeId }: { keepId: string; mergeId: string },
    context: Context,
  ) => {
    const userId = requireAuth(context);
    const { db } = context;
    if (keepId === mergeId) {
      throw badInput('A person cannot be merged into themselves.');
    }

    const { persons } = dbSchema;
    const owned = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.userId, userId), inArray(persons.id, [keepId, mergeId])));
    const hasBoth = owned.length === 2;
    if (hasBoth === false) {
      throw notFound('Person not found');
    }

    await mergePersons(db, userId, keepId, mergeId);
    return keepId;
  };

  return extended;
}
