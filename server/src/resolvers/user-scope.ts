import { schema as dbSchema } from '@philotes/db';
import {
  and,
  asc,
  type Column,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm';
import { extendSchema, GraphQLError, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../routes/graphql.ts';
import { requireAuth } from './auth.ts';

// ── SDL extensions ───────────────────────────────────────────────────────────
// Adds user_persons operations and a me query to the existing schema.

const USER_SCOPE_SDL = parse(`
  # Re-expose user-specific fields on Person so frontend queries stay unchanged.
  extend type Person {
    avatarPath: String
    contactFrequency: String
    howWeMet: String
    firstMetDate: String
  }

  extend type Query {
    me: User
    myPersonContext(personId: String!): UserPerson
  }

  extend type Mutation {
    addPersonToMyContacts(personId: String!): UserPerson!
    updateMyPersonContext(
      personId: String!
      contactFrequency: String
      howWeMet: String
      firstMetDate: String
      avatarPath: String
    ): UserPerson!
    removePersonFromMyContacts(personId: String!): Boolean!
  }
`);

// ── Helpers ──────────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
type AnyDB = any;

function notFound(entity: string): never {
  throw new GraphQLError(`${entity} not found`, {
    extensions: { code: 'NOT_FOUND' },
  });
}

// ── Override auto-generated resolvers to add userId scoping ─────────────────
//
// For each user-owned table the auto-generated list/single queries and all
// mutations are replaced with versions that enforce userId from context.
// The drizzle-graphql generated resolver functions are discarded; we run our
// own queries so we control the WHERE clause completely.

// ── GraphQL → Drizzle filter/sort translators ────────────────────────────────

type FieldFilter = Record<string, unknown>;
type PersonsWhere = {
  OR?: PersonsWhere[];
  AND?: PersonsWhere[];
  [key: string]: FieldFilter | PersonsWhere[] | undefined;
};
type PersonsOrderBy = Record<string, { direction: 'asc' | 'desc'; priority: number }>;

const PERSON_COLUMNS: Record<string, Column> = {
  id: dbSchema.persons.id as unknown as Column,
  firstName: dbSchema.persons.firstName as unknown as Column,
  lastName: dbSchema.persons.lastName as unknown as Column,
  email: dbSchema.persons.email as unknown as Column,
  createdAt: dbSchema.persons.createdAt as unknown as Column,
  updatedAt: dbSchema.persons.updatedAt as unknown as Column,
};

function buildFieldCondition(col: Column, filter: FieldFilter): SQL | undefined {
  const c = col as unknown as SQL;
  const conditions: SQL[] = [];
  if (filter.eq !== undefined) conditions.push(eq(c, filter.eq));
  if (filter.ne !== undefined) conditions.push(ne(c, filter.ne));
  if (filter.ilike !== undefined) conditions.push(ilike(c, filter.ilike as string));
  if (filter.like !== undefined) conditions.push(like(c, filter.like as string));
  if (filter.gt !== undefined) conditions.push(gt(c, filter.gt));
  if (filter.gte !== undefined) conditions.push(gte(c, filter.gte));
  if (filter.lt !== undefined) conditions.push(lt(c, filter.lt));
  if (filter.lte !== undefined) conditions.push(lte(c, filter.lte));
  if (filter.isNull === true) conditions.push(isNull(c));
  if (filter.isNotNull === true) conditions.push(isNotNull(c));
  if (Array.isArray(filter.inArray)) conditions.push(inArray(c, filter.inArray));
  if (Array.isArray(filter.notInArray)) conditions.push(notInArray(c, filter.notInArray));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function buildPersonsWhere(where: PersonsWhere): SQL | undefined {
  const parts: SQL[] = [];

  if (where.OR) {
    const orParts = where.OR.map(buildPersonsWhere).filter(Boolean) as SQL[];
    if (orParts.length > 0) parts.push(or(...orParts) as SQL);
  }
  if (where.AND) {
    const andParts = where.AND.map(buildPersonsWhere).filter(Boolean) as SQL[];
    if (andParts.length > 0) parts.push(and(...andParts) as SQL);
  }

  for (const [key, filter] of Object.entries(where)) {
    if (key === 'OR' || key === 'AND') continue;
    const col = PERSON_COLUMNS[key];
    if (!col || !filter || typeof filter !== 'object') continue;
    const cond = buildFieldCondition(col, filter as FieldFilter);
    if (cond) parts.push(cond);
  }

  return parts.length > 0 ? and(...parts) : undefined;
}

export function buildPersonsOrderBy(orderBy: PersonsOrderBy): SQL[] {
  return Object.entries(orderBy)
    .filter(([key]) => PERSON_COLUMNS[key])
    .sort(([, a], [, b]) => (a.priority ?? 0) - (b.priority ?? 0))
    .map(([key, { direction }]) => {
      const col = PERSON_COLUMNS[key] as unknown as Column;
      return direction === 'desc' ? desc(col) : asc(col);
    });
}

function overridePersonsResolvers(schema: GraphQLSchema): void {
  const queryType = schema.getType('Query') as GraphQLObjectType;
  const mutationType = schema.getType('Mutation') as GraphQLObjectType;
  const qf = queryType.getFields();
  const mf = mutationType.getFields();

  const personSelect = {
    id: dbSchema.persons.id,
    firstName: dbSchema.persons.firstName,
    lastName: dbSchema.persons.lastName,
    email: dbSchema.persons.email,
    createdAt: dbSchema.persons.createdAt,
    updatedAt: dbSchema.persons.updatedAt,
    // user-specific context fields surfaced via the user_persons join
    avatarPath: dbSchema.userPersons.avatarPath,
    contactFrequency: dbSchema.userPersons.contactFrequency,
    howWeMet: dbSchema.userPersons.howWeMet,
    firstMetDate: dbSchema.userPersons.firstMetDate,
  };

  // persons() — scoped to persons the user has added to their contacts
  qf.persons.resolve = async (_parent: unknown, args: Record<string, unknown>, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    const userJoin = and(
      eq(dbSchema.userPersons.personId, dbSchema.persons.id),
      eq(dbSchema.userPersons.userId, userId),
    );
    const whereFilter = args.where ? buildPersonsWhere(args.where as PersonsWhere) : undefined;
    const orderByClauses = args.orderBy ? buildPersonsOrderBy(args.orderBy as PersonsOrderBy) : [];

    return db
      .select(personSelect)
      .from(dbSchema.persons)
      .innerJoin(dbSchema.userPersons, userJoin)
      .where(whereFilter ? and(whereFilter) : undefined)
      .orderBy(
        ...(orderByClauses.length > 0
          ? orderByClauses
          : [asc(dbSchema.persons.lastName), asc(dbSchema.persons.firstName)]),
      )
      .limit((args.limit as number | undefined) ?? 1000)
      .offset((args.offset as number | undefined) ?? 0);
  };

  // person(where) — single, must be in user's contacts
  qf.person.resolve = async (_parent: unknown, args: { where?: { id?: { eq?: string } } }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    const id = args.where?.id?.eq;
    if (!id) return null;
    const rows = await db
      .select(personSelect)
      .from(dbSchema.persons)
      .innerJoin(
        dbSchema.userPersons,
        and(eq(dbSchema.userPersons.personId, dbSchema.persons.id), eq(dbSchema.userPersons.userId, userId)),
      )
      .where(eq(dbSchema.persons.id, id))
      .limit(1);
    return rows[0] ?? null;
  };

  // createPerson — creates person + auto-creates user_persons link
  mf.createPerson.resolve = async (_parent: unknown, args: { values: Record<string, unknown> }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    let personId: string;

    // Attempt insert; on unique-email conflict, reuse existing person
    try {
      const [inserted] = await db
        .insert(dbSchema.persons)
        .values({ ...args.values })
        .returning({ id: dbSchema.persons.id });
      if (!inserted) throw new GraphQLError('Failed to create person');
      personId = inserted.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('unique') && !msg.includes('duplicate')) throw err;
      // Email collision — find the existing person
      const [existing] = await db
        .select({ id: dbSchema.persons.id })
        .from(dbSchema.persons)
        .where(eq(dbSchema.persons.email, args.values.email as string));
      if (!existing) throw err;
      personId = existing.id;
    }

    // Ensure user_persons link exists (idempotent)
    await db.insert(dbSchema.userPersons).values({ userId, personId }).onConflictDoNothing();

    const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, personId));
    return person;
  };

  // updatePersons — only rows the user has in their contacts
  mf.updatePersons.resolve = async (
    _parent: unknown,
    args: { values: Record<string, unknown>; where?: Record<string, unknown> },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    // Collect personIds the user is allowed to update
    const userRows: Array<{ personId: string }> = await db
      .select({ personId: dbSchema.userPersons.personId })
      .from(dbSchema.userPersons)
      .where(eq(dbSchema.userPersons.userId, userId));

    const allowedIds = userRows.map((r) => r.personId);
    if (allowedIds.length === 0) return [];

    // We can't easily merge complex GraphQL where args with our id list here,
    // so we restrict to the id in where.id.eq if present, or all allowed ids.
    const targetId = (args.where as { id?: { eq?: string } } | undefined)?.id?.eq;
    const ids = targetId ? (allowedIds.includes(targetId) ? [targetId] : []) : allowedIds;
    if (ids.length === 0) return [];

    const results = [];
    for (const id of ids) {
      const [updated] = await db
        .update(dbSchema.persons)
        .set(args.values)
        .where(eq(dbSchema.persons.id, id))
        .returning();
      if (updated) results.push(updated);
    }
    return results;
  };

  // deletePersons — removes from user's contacts (not global registry)
  mf.deletePersons.resolve = async (_parent: unknown, args: { where?: Record<string, unknown> }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    const targetId = (args.where as { id?: { eq?: string } } | undefined)?.id?.eq;
    if (!targetId) return [];

    // Check user has this person
    const [link] = await db
      .select({ personId: dbSchema.userPersons.personId })
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, targetId)));

    if (!link) return [];

    // Remove from user's contacts; leave the shared person row intact
    await db
      .delete(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, targetId)));

    const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, targetId));
    return person ? [person] : [];
  };
}

function overrideUserOwnedTable<TTable extends { userId: unknown; id: unknown }>(
  schema: GraphQLSchema,
  table: TTable,
  queryName: string,
  queryListName: string,
  createMutationName: string,
  updateMutationName: string,
  deleteMutationName: string,
): void {
  const queryType = schema.getType('Query') as GraphQLObjectType;
  const mutationType = schema.getType('Mutation') as GraphQLObjectType;
  const qf = queryType.getFields();
  const mf = mutationType.getFields();

  // List query — filter by userId
  if (qf[queryListName]) {
    qf[queryListName].resolve = async (_parent: unknown, args: Record<string, unknown>, ctx: Context) => {
      const userId = requireAuth(ctx);
      const db = ctx.db as AnyDB;
      return db
        .select()
        .from(table)
        .where(eq((table as any).userId, userId))
        .limit((args.limit as number | undefined) ?? 1000)
        .offset((args.offset as number | undefined) ?? 0);
    };
  }

  // Single query — filter by userId
  if (qf[queryName]) {
    qf[queryName].resolve = async (_parent: unknown, args: { id: string }, ctx: Context) => {
      const userId = requireAuth(ctx);
      const db = ctx.db as AnyDB;
      const rows = await db
        .select()
        .from(table)
        .where(and(eq((table as any).id, args.id), eq((table as any).userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    };
  }

  // Create mutation — inject userId from context
  if (mf[createMutationName]) {
    mf[createMutationName].resolve = async (
      _parent: unknown,
      args: { values: Record<string, unknown> },
      ctx: Context,
    ) => {
      const userId = requireAuth(ctx);
      const db = ctx.db as AnyDB;
      const [row] = await db
        .insert(table)
        .values({ ...args.values, userId })
        .returning();
      return row;
    };
  }

  // Bulk create — inject userId on each row
  const bulkCreateName = `${createMutationName}s`;
  if (mf[bulkCreateName]) {
    mf[bulkCreateName].resolve = async (
      _parent: unknown,
      args: { values: Record<string, unknown>[] },
      ctx: Context,
    ) => {
      const userId = requireAuth(ctx);
      const db = ctx.db as AnyDB;
      if (!args.values.length) return [];
      return db
        .insert(table)
        .values(args.values.map((v) => ({ ...v, userId })))
        .returning();
    };
  }

  // Update — restrict to rows owned by user
  if (mf[updateMutationName]) {
    mf[updateMutationName].resolve = async (
      _parent: unknown,
      args: { values: Record<string, unknown>; where?: Record<string, unknown> },
      ctx: Context,
    ) => {
      const userId = requireAuth(ctx);
      const db = ctx.db as AnyDB;
      const targetId = (args.where as { id?: { eq?: string } } | undefined)?.id?.eq;
      const condition = targetId
        ? and(eq((table as any).id, targetId), eq((table as any).userId, userId))
        : eq((table as any).userId, userId);

      // Strip userId from update values — callers cannot change ownership
      const { userId: _uid, ...safeValues } = { ...args.values, userId: undefined };
      return db.update(table).set(safeValues).where(condition).returning();
    };
  }

  // Delete — restrict to rows owned by user
  if (mf[deleteMutationName]) {
    mf[deleteMutationName].resolve = async (
      _parent: unknown,
      args: { where?: Record<string, unknown> },
      ctx: Context,
    ) => {
      const userId = requireAuth(ctx);
      const db = ctx.db as AnyDB;
      const targetId = (args.where as { id?: { eq?: string } } | undefined)?.id?.eq;
      const condition = targetId
        ? and(eq((table as any).id, targetId), eq((table as any).userId, userId))
        : eq((table as any).userId, userId);

      return db.delete(table).where(condition).returning();
    };
  }
}

// ── me and user_persons resolvers ────────────────────────────────────────────

function addUserPersonsResolvers(schema: GraphQLSchema): void {
  const queryType = schema.getType('Query') as GraphQLObjectType;
  const mutationType = schema.getType('Mutation') as GraphQLObjectType;
  const qf = queryType.getFields();
  const mf = mutationType.getFields();

  qf.me.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    if (!ctx.userId) return null;
    const db = ctx.db as AnyDB;
    const [user] = await db
      .select({
        id: dbSchema.users.id,
        email: dbSchema.users.email,
        name: dbSchema.users.name,
        createdAt: dbSchema.users.createdAt,
        updatedAt: dbSchema.users.updatedAt,
      })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, ctx.userId));
    return user ?? null;
  };

  qf.myPersonContext.resolve = async (_parent: unknown, args: { personId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    const [row] = await db
      .select()
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, args.personId)));
    return row ?? null;
  };

  mf.addPersonToMyContacts.resolve = async (_parent: unknown, args: { personId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    const [person] = await db
      .select({ id: dbSchema.persons.id })
      .from(dbSchema.persons)
      .where(eq(dbSchema.persons.id, args.personId));
    if (!person) notFound('Person');

    await db.insert(dbSchema.userPersons).values({ userId, personId: args.personId }).onConflictDoNothing();

    const [row] = await db
      .select()
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, args.personId)));
    return row;
  };

  mf.updateMyPersonContext.resolve = async (
    _parent: unknown,
    args: {
      personId: string;
      contactFrequency?: string | null;
      howWeMet?: string | null;
      firstMetDate?: string | null;
      avatarPath?: string | null;
    },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    const { personId, ...updates } = args;

    const defined = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));

    const [row] = await db
      .update(dbSchema.userPersons)
      .set(defined)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, personId)))
      .returning();

    if (!row) notFound('UserPerson');
    return row;
  };

  mf.removePersonFromMyContacts.resolve = async (_parent: unknown, args: { personId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    await db
      .delete(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, args.personId)));
    return true;
  };
}

// ── Main export ──────────────────────────────────────────────────────────────

export function applyUserScopeExtensions(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, USER_SCOPE_SDL);

  // persons — special: scoped via user_persons join
  overridePersonsResolvers(extendedSchema);

  // User-owned tables — simple userId column scoping
  overrideUserOwnedTable(extendedSchema, dbSchema.notes, 'note', 'notes', 'createNote', 'updateNotes', 'deleteNotes');
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.interactions,
    'interaction',
    'interactions',
    'createInteraction',
    'updateInteractions',
    'deleteInteractions',
  );
  overrideUserOwnedTable(extendedSchema, dbSchema.tasks, 'task', 'tasks', 'createTask', 'updateTasks', 'deleteTasks');
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.labels,
    'label',
    'labels',
    'createLabel',
    'updateLabels',
    'deleteLabels',
  );
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.importantDates,
    'importantDate',
    'importantDates',
    'createImportantDate',
    'updateImportantDates',
    'deleteImportantDates',
  );
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.personRelationships,
    'personRelationship',
    'personRelationships',
    'createPersonRelationship',
    'updatePersonRelationships',
    'deletePersonRelationships',
  );
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.addresses,
    'address',
    'addresses',
    'createAddress',
    'updateAddresses',
    'deleteAddresses',
  );
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.contactInfos,
    'contactInfo',
    'contactInfos',
    'createContactInfo',
    'updateContactInfos',
    'deleteContactInfos',
  );
  overrideUserOwnedTable(
    extendedSchema,
    dbSchema.relationshipTypes,
    'relationshipType',
    'relationshipTypes',
    'createRelationshipType',
    'updateRelationshipTypes',
    'deleteRelationshipTypes',
  );

  // Field resolvers for the Person type.
  // - Extended fields (avatarPath etc.) come from the user_persons join already
  //   embedded in the parent object by overridePersonsResolvers.
  // - Nested user-owned relations must filter by userId so users cannot see
  //   each other's data when two users track the same person.
  const personType = extendedSchema.getType('Person') as GraphQLObjectType;
  const personFields = personType.getFields();

  for (const field of ['avatarPath', 'contactFrequency', 'howWeMet', 'firstMetDate'] as const) {
    personFields[field].resolve = (parent: Record<string, unknown>) => parent[field] ?? null;
  }

  const userScopedPersonRelation =
    (table: { userId: unknown; personId: unknown }, personIdCol: unknown) =>
    async (parent: { id: string }, _args: unknown, ctx: Context) => {
      if (!ctx.userId) return [];
      const db = ctx.db as AnyDB;
      return (
        db
          .select()
          .from(table)
          // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
          .where(and(eq(personIdCol as any, parent.id), eq((table as any).userId, ctx.userId)))
      );
    };

  if (personFields.notes) {
    personFields.notes.resolve = userScopedPersonRelation(dbSchema.notes, dbSchema.notes.personId);
  }
  if (personFields.interactions) {
    personFields.interactions.resolve = userScopedPersonRelation(dbSchema.interactions, dbSchema.interactions.personId);
  }
  if (personFields.tasks) {
    personFields.tasks.resolve = userScopedPersonRelation(dbSchema.tasks, dbSchema.tasks.personId);
  }
  if (personFields.importantDates) {
    personFields.importantDates.resolve = userScopedPersonRelation(
      dbSchema.importantDates,
      dbSchema.importantDates.personId,
    );
  }
  if (personFields.contactInfos) {
    personFields.contactInfos.resolve = userScopedPersonRelation(dbSchema.contactInfos, dbSchema.contactInfos.personId);
  }
  if (personFields.addresses) {
    personFields.addresses.resolve = userScopedPersonRelation(dbSchema.addresses, dbSchema.addresses.personId);
  }

  // labels on a person — user_persons + person_labels, filtered by userId
  if (personFields.labels) {
    personFields.labels.resolve = async (parent: { id: string }, _args: unknown, ctx: Context) => {
      if (!ctx.userId) return [];
      const db = ctx.db as AnyDB;
      return db
        .select({
          id: dbSchema.labels.id,
          label: dbSchema.labels.label,
          color: dbSchema.labels.color,
          userId: dbSchema.labels.userId,
        })
        .from(dbSchema.labels)
        .innerJoin(
          dbSchema.personLabels,
          and(
            eq(dbSchema.personLabels.labelId, dbSchema.labels.id),
            eq(dbSchema.personLabels.personId, parent.id),
            eq(dbSchema.personLabels.userId, ctx.userId),
          ),
        );
    };
  }

  // mentionedInNotes — only notes owned by the current user that mention this person
  if (personFields.mentionedInNotes) {
    personFields.mentionedInNotes.resolve = async (parent: { id: string }, _args: unknown, ctx: Context) => {
      if (!ctx.userId) return [];
      const db = ctx.db as AnyDB;
      return db
        .select({
          id: dbSchema.notes.id,
          body: dbSchema.notes.body,
          personId: dbSchema.notes.personId,
          userId: dbSchema.notes.userId,
        })
        .from(dbSchema.notes)
        .innerJoin(
          dbSchema.noteMentions,
          and(
            eq(dbSchema.noteMentions.noteId, dbSchema.notes.id),
            eq(dbSchema.noteMentions.mentionedPersonId, parent.id),
          ),
        )
        .where(eq(dbSchema.notes.userId, ctx.userId));
    };
  }

  // user_persons + me queries/mutations
  addUserPersonsResolvers(extendedSchema);

  return extendedSchema;
}
