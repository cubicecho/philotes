import { schema as dbSchema } from '@philotes/db';
import { and, eq } from 'drizzle-orm';
import { extendSchema, GraphQLError, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import { requireAuth } from '../auth/resolvers.ts';
import type { Context } from '../graphql/handler.ts';

// Row-level tenancy — which rows a user may read and write, and the userId
// stamped on the rows they create — is configured on buildSchema itself; see
// ../tenancy.ts. What is left here is the part that is not a scope: the
// per-user *context* a user keeps about a shared person, which lives in
// user_persons, and the two person mutations whose meaning is not the
// generated one.

// ── SDL extensions ───────────────────────────────────────────────────────────

const USER_SCOPE_SDL = parse(`
  # Per-user context about a shared person, surfaced on Person so a caller
  # never has to join user_persons itself.
  extend type Person {
    avatarPath: String
    contactFrequency: String
    howWeMet: String
    firstMetDate: String
  }

  extend type Query {
    me: User
    myPersonContext(personId: UUID!): UserPerson
  }

  extend type Mutation {
    addPersonToMyContacts(personId: UUID!): UserPerson!
    updateMyPersonContext(
      personId: UUID!
      contactFrequency: String
      howWeMet: String
      firstMetDate: String
      avatarPath: String
    ): UserPerson!
    removePersonFromMyContacts(personId: UUID!): Boolean!
  }
`);

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
type AnyDB = any;

function notFound(entity: string): never {
  throw new GraphQLError(`${entity} not found`, {
    extensions: { code: 'NOT_FOUND' },
  });
}

// ── Per-user person context ──────────────────────────────────────────────────
//
// The four extension fields above come from one user_persons row each. Rather
// than one lookup per person in a list, the whole of the caller's user_persons
// is read once per request and memoised on the context object — a personal CRM
// holds hundreds of contacts, not millions, and one indexed read on user_id
// beats a query per row of every list that selects an avatar.

type PersonContext = Record<string, unknown>;
const personContextsByRequest = new WeakMap<Context, Promise<Map<string, PersonContext>>>();

function personContexts(ctx: Context): Promise<Map<string, PersonContext>> {
  const cached = personContextsByRequest.get(ctx);
  if (cached) {
    return cached;
  }

  const userId = requireAuth(ctx);
  const loading = (async () => {
    const rows: PersonContext[] = await (ctx.db as AnyDB)
      .select()
      .from(dbSchema.userPersons)
      .where(eq(dbSchema.userPersons.userId, userId));
    return new Map(rows.map((row) => [row.personId as string, row]));
  })();

  personContextsByRequest.set(ctx, loading);
  return loading;
}

function applyPersonContextFields(schema: GraphQLSchema): void {
  const personFields = (schema.getType('Person') as GraphQLObjectType).getFields();
  for (const field of ['avatarPath', 'contactFrequency', 'howWeMet', 'firstMetDate'] as const) {
    personFields[field].resolve = async (parent: { id?: string }, _args: unknown, ctx: Context) => {
      if (!parent.id) {
        return null;
      }
      return (await personContexts(ctx)).get(parent.id)?.[field] ?? null;
    };
  }
}

// ── persons: the two mutations the generated ones cannot express ─────────────
//
// Reads, updates and deletes of persons are scoped through user_persons by the
// row scope, so the generated resolvers are correct as they stand. Creating and
// removing a person are not CRUD on the shared row: a create links the person
// to the caller's contacts (reusing an existing person on an email collision),
// and a delete unlinks rather than deleting a row other users can still see.

function overridePersonMutations(schema: GraphQLSchema): void {
  const mf = (schema.getMutationType() as GraphQLObjectType).getFields();

  mf.createPerson.resolve = async (_parent: unknown, args: { values: Record<string, unknown> }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    let personId: string;
    try {
      const [inserted] = await db
        .insert(dbSchema.persons)
        .values({ ...args.values })
        .returning({ id: dbSchema.persons.id });
      if (!inserted) {
        throw new GraphQLError('Failed to create person');
      }
      personId = inserted.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isOtherFailure = msg.includes('unique') === false && msg.includes('duplicate') === false;
      if (isOtherFailure) {
        throw err;
      }
      // Email collision — the person already exists; link to that row.
      const [existing] = await db
        .select({ id: dbSchema.persons.id })
        .from(dbSchema.persons)
        .where(eq(dbSchema.persons.email, args.values.email as string));
      if (!existing) {
        throw err;
      }
      personId = existing.id;
    }

    await db.insert(dbSchema.userPersons).values({ userId, personId }).onConflictDoNothing();

    const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, personId));
    return person;
  };

  mf.deletePerson.resolve = async (_parent: unknown, args: { where?: { id?: { eq?: string } } }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    const targetId = args.where?.id?.eq;
    if (!targetId) {
      return [];
    }

    const [removed] = await db
      .delete(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, targetId)))
      .returning({ personId: dbSchema.userPersons.personId });
    if (!removed) {
      return [];
    }

    // Leave the shared person row intact; it belongs to every other user who
    // has it in their contacts.
    const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, targetId));
    return person ? [person] : [];
  };
}

// ── me and user_persons resolvers ────────────────────────────────────────────

function addUserPersonsResolvers(schema: GraphQLSchema): void {
  const qf = (schema.getQueryType() as GraphQLObjectType).getFields();
  const mf = (schema.getMutationType() as GraphQLObjectType).getFields();

  qf.me.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    if (!ctx.userId) {
      return null;
    }
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
    if (!person) {
      notFound('Person');
    }

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

    if (!row) {
      notFound('UserPerson');
    }
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

  applyPersonContextFields(extendedSchema);
  overridePersonMutations(extendedSchema);
  addUserPersonsResolvers(extendedSchema);

  return extendedSchema;
}
