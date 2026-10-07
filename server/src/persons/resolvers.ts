import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { badInput, notFound, requireAuth } from '../core/errors.ts';
import { violatedUniqueConstraint } from '../core/pg-errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { objectType } from '../graphql/object-type.ts';
import { personInput, userPersonInput } from './input.ts';

// Row scope lives in graphql/tenancy.ts. This file holds what a scope cannot say: what a user keeps
// about a shared person (user_persons), and the two person mutations that are not plain CRUD.

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

// The caller's user_persons rows are read once per request and kept against the context. A user has
// hundreds of contacts, so one indexed read beats a lookup per row of every list that shows an avatar.

/** What one user keeps about a person: a `user_persons` row. */
type PersonContext = typeof dbSchema.userPersons.$inferSelect;
/** The columns `createPerson` takes. The GraphQL input type requires the names. */
type NewPerson = typeof dbSchema.persons.$inferInsert;
const personContextsByRequest = new WeakMap<Context, Promise<Map<string, PersonContext>>>();

/**
 * Loads the caller's `user_persons` rows, once per request. Later calls with the same context share the
 * one read.
 *
 * @param ctx - Request context, which the rows are cached against.
 * @returns The caller's rows, by person id.
 * @throws UNAUTHENTICATED when nobody is signed in.
 */
function personContexts(ctx: Context): Promise<Map<string, PersonContext>> {
  const cached = personContextsByRequest.get(ctx);
  if (cached) {
    return cached;
  }

  const userId = requireAuth(ctx);
  const loading = (async () => {
    const rows = await ctx.db.select().from(dbSchema.userPersons).where(eq(dbSchema.userPersons.userId, userId));
    return new Map(rows.map((row) => [row.personId, row]));
  })();

  personContextsByRequest.set(ctx, loading);
  return loading;
}

/**
 * Sets the resolvers for the fields `Person` takes from the caller's own `user_persons` row:
 * `avatarPath`, `contactFrequency`, `howWeMet` and `firstMetDate`.
 *
 * @param schema - The extended schema, changed in place.
 */
function applyPersonContextFields(schema: GraphQLSchema): void {
  const personFields = objectType(schema, 'Person').getFields();
  for (const field of ['avatarPath', 'contactFrequency', 'howWeMet', 'firstMetDate'] as const) {
    /**
     * Resolves one of `Person`'s per-user fields from the caller's own `user_persons` row.
     *
     * @param parent - The person, as the parent resolver returned it.
     * @param _args - Unused.
     * @param ctx - Request context.
     * @returns The caller's value. null when the parent carries no id, the person is not in the caller's
     * contacts, or nothing is set.
     * @throws UNAUTHENTICATED when nobody is signed in.
     */
    personFields[field].resolve = async (parent: { id?: string }, _args: unknown, ctx: Context) => {
      if (!parent.id) {
        return null;
      }
      return (await personContexts(ctx)).get(parent.id)?.[field] ?? null;
    };
  }
}

// A person row is shared, so creating one links it to the caller (reusing the row that already holds
// the email), and deleting one unlinks it and leaves the row for the other users who can see it.

/**
 * Inserts a person, or finds the one that already holds the email. `persons` is shared, so two
 * users who add the same email share one row.
 *
 * @param db - Drizzle client.
 * @param values - The person columns, already validated.
 * @returns The id of the new or existing person.
 */
async function insertOrFindPerson(db: DB, values: NewPerson): Promise<string> {
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

/**
 * Replaces the generated `createPerson` and `deletePerson` resolvers. A person row is shared, so creating
 * one links it to the caller, and deleting one only unlinks it.
 *
 * @param schema - The extended schema, changed in place.
 */
function overridePersonMutations(schema: GraphQLSchema): void {
  const mf = objectType(schema, 'Mutation').getFields();

  /**
   * Resolves `Mutation.createPerson`. Adds a person to the signed-in caller's contacts. When a person
   * already holds the email, the caller is linked to that row and no new one is made.
   *
   * @param _parent - Unused.
   * @param args.values - The person's columns. The names and the email are validated and trimmed.
   * @param ctx - Request context.
   * @returns The person row, new or existing.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when a name or the email fails validation.
   */
  mf.createPerson.resolve = async (_parent: unknown, args: { values: NewPerson }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const { db } = ctx;

    // The parsed columns are the trimmed ones. Anything else the input carries passes through as sent.
    const values = { ...args.values, ...parseOrThrow(personInput, args.values) };
    const personId = await insertOrFindPerson(db, values);

    await db.insert(dbSchema.userPersons).values({ userId, personId }).onConflictDoNothing();

    const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, personId));
    return person;
  };

  /**
   * Resolves `Mutation.deletePerson`. Takes a person out of the signed-in caller's contacts. The shared
   * row stays for the other users who have it. The filter must be of the form `{ id: { eq } }`.
   *
   * @param _parent - Unused.
   * @param [args.where] - The filter naming the person by id.
   * @param ctx - Request context.
   * @returns The person, or null when they were not in the caller's contacts.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when the filter names no single id.
   */
  mf.deletePerson.resolve = async (_parent: unknown, args: { where?: { id?: { eq?: string } } }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const { db } = ctx;
    const targetId = args.where?.id?.eq;
    if (!targetId) {
      throw badInput('deletePerson takes one person at a time: where: { id: { eq: … } }.');
    }

    const [removed] = await db
      .delete(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, targetId)))
      .returning({ personId: dbSchema.userPersons.personId });
    if (!removed) {
      return null;
    }

    // Leave the shared person row intact; it belongs to every other user who
    // has it in their contacts.
    const [person] = await db.select().from(dbSchema.persons).where(eq(dbSchema.persons.id, targetId));
    return person ?? null;
  };
}

/**
 * Sets the resolvers that read and change the caller's own link to a person: `myPersonContext`,
 * `addPersonToMyContacts`, `updateMyPersonContext` and `removePersonFromMyContacts`.
 *
 * @param schema - The extended schema, changed in place.
 */
function addUserPersonsResolvers(schema: GraphQLSchema): void {
  const qf = objectType(schema, 'Query').getFields();
  const mf = objectType(schema, 'Mutation').getFields();

  /**
   * Resolves `Query.myPersonContext`. Reads what the signed-in caller keeps about a person.
   *
   * @param _parent - Unused.
   * @param args.personId - The person.
   * @param ctx - Request context.
   * @returns The caller's `user_persons` row, or null when the person is not in their contacts.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
  qf.myPersonContext.resolve = async (_parent: unknown, args: { personId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const { db } = ctx;
    const [row] = await db
      .select()
      .from(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, args.personId)));
    return row ?? null;
  };

  /**
   * Resolves `Mutation.addPersonToMyContacts`. Puts an existing person in the signed-in caller's contacts.
   * Any person's id is taken, whoever added the row. Adding one already there changes nothing.
   *
   * @param _parent - Unused.
   * @param args.personId - The person to add.
   * @param ctx - Request context.
   * @returns The caller's `user_persons` row for the person.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws NOT_FOUND when no person has the id.
   */
  mf.addPersonToMyContacts.resolve = async (_parent: unknown, args: { personId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const { db } = ctx;

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

  /**
   * Resolves `Mutation.updateMyPersonContext`. Changes what the signed-in caller keeps about a person. An
   * argument left out is left alone, and null clears it.
   *
   * @param _parent - Unused.
   * @param args.personId - The person.
   * @param [args.contactFrequency] - How often the caller means to be in touch: weekly, monthly, quarterly or yearly.
   * @param [args.howWeMet] - How the caller met the person.
   * @param [args.firstMetDate] - When they first met, as `YYYY-MM-DD`.
   * @param [args.avatarPath] - The stored path of the caller's picture of the person.
   * @param ctx - Request context.
   * @returns The updated `user_persons` row.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when a value fails validation.
   * @throws NOT_FOUND when the person is not in the caller's contacts.
   */
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
    const { db } = ctx;
    const { personId, ...updates } = args;

    // GraphQL passes a named-but-absent argument as undefined, which is not the null that clears a field.
    const named = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    const defined = parseOrThrow(userPersonInput, named);

    const isCallersRow = and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, personId));
    // An update that sets nothing is not valid SQL, so a call naming no field reads the row as it stands.
    const hasNothingToSet = Object.keys(defined).length === 0;
    const [row] = hasNothingToSet
      ? await db.select().from(dbSchema.userPersons).where(isCallersRow)
      : await db.update(dbSchema.userPersons).set(defined).where(isCallersRow).returning();

    if (!row) {
      throw notFound('Person not found');
    }
    return row;
  };

  /**
   * Resolves `Mutation.removePersonFromMyContacts`. Takes a person out of the signed-in caller's contacts.
   *
   * @param _parent - Unused.
   * @param args.personId - The person to remove.
   * @param ctx - Request context.
   * @returns true, whether or not the person was there.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
  mf.removePersonFromMyContacts.resolve = async (_parent: unknown, args: { personId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const { db } = ctx;
    await db
      .delete(dbSchema.userPersons)
      .where(and(eq(dbSchema.userPersons.userId, userId), eq(dbSchema.userPersons.personId, args.personId)));
    return true;
  };
}

/**
 * Adds what a user keeps about a shared person to the schema: the per-user fields on `Person`, the
 * contact-list query and mutations, and the `createPerson` and `deletePerson` overrides.
 *
 * @param schema - The schema so far.
 * @returns The schema with the per-user person fields.
 */
export function applyUserScopeExtensions(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, USER_SCOPE_SDL);

  applyPersonContextFields(extendedSchema);
  overridePersonMutations(extendedSchema);
  addUserPersonsResolvers(extendedSchema);

  return extendedSchema;
}
