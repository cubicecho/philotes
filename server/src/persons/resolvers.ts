import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { notFound, requireAuth } from '../core/errors.ts';
import { violatedUniqueConstraint } from '../core/pg-errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { objectType } from '../graphql/object-type.ts';
import { personInput, userPersonInput } from './input.ts';

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
  const personFields = objectType(schema, 'Person').getFields();
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

/**
 * Inserts a person, or finds the one that already holds the email. `persons` is shared, so two
 * users who add the same email share one row.
 *
 * @param db - Drizzle client.
 * @param values - The person columns, already validated.
 * @returns The id of the new or existing person.
 */
async function insertOrFindPerson(db: AnyDB, values: Record<string, unknown>): Promise<string> {
  const { email } = values;
  try {
    const [inserted] = await db.insert(dbSchema.persons).values(values).returning({ id: dbSchema.persons.id });
    if (inserted === undefined) {
      throw new Error('The person insert returned no row.');
    }
    return inserted.id;
  } catch (error) {
    const isEmailTaken = violatedUniqueConstraint(error) !== null && typeof email === 'string';
    if (isEmailTaken === false) {
      throw error;
    }
    const [existing] = await db
      .select({ id: dbSchema.persons.id })
      .from(dbSchema.persons)
      .where(eq(dbSchema.persons.email, email));
    if (existing === undefined) {
      throw error;
    }
    return existing.id;
  }
}

function overridePersonMutations(schema: GraphQLSchema): void {
  const mf = objectType(schema, 'Mutation').getFields();

  mf.createPerson.resolve = async (_parent: unknown, args: { values: Record<string, unknown> }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    // The parsed columns are the trimmed ones. Anything else the input carries passes through as sent.
    const values = { ...args.values, ...parseOrThrow(personInput, args.values) };
    const personId = await insertOrFindPerson(db, values);

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

// ── user_persons resolvers ────────────────────────────────────────────

function addUserPersonsResolvers(schema: GraphQLSchema): void {
  const qf = objectType(schema, 'Query').getFields();
  const mf = objectType(schema, 'Mutation').getFields();

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
      throw notFound('Person not found');
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
    parseOrThrow(userPersonInput, defined);

    const [row] = await db
      .update(dbSchema.userPersons)
      .set(defined)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, personId)))
      .returning();

    if (!row) {
      throw notFound('Person not found');
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
