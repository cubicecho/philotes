import * as dbSchema from '@cubicecho/philotes-db/schema';
import type { BuildSchemaConfig, RowScope } from '@vantreeseba/drizzle-graphql';
import { eq, inArray } from 'drizzle-orm';
import type { Context } from '../core/context.ts';
import { requireAuth } from '../core/errors.ts';

// Multi-tenancy, expressed as drizzle-graphql configuration rather than as
// resolver wrappers. `scope` is ANDed into the SQL of every read, update and
// delete the library generates — list and single queries, aggregates, groupBy,
// relation fields (batched and eager), cursor pages — after the client's own
// `where`, so a client filter can only narrow it. `contextValues` is the
// write-side half: it takes the column out of the create and update inputs and
// stamps it from the request, so ownership is never something a caller states.
//
// `scope` cannot reach a plain insert, so a table whose ownership flows through
// a foreign key rather than a column of its own still needs its keys checked on
// create — see the onWrite hooks in resolvers/junction-ownership.ts.

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 table/column type compat
type AnyTable = any;

/** Tables carrying their own `user_id`. */
const USER_OWNED_TABLES = [
  'addresses',
  'contactInfos',
  'importantDates',
  'interactions',
  'labels',
  'notes',
  'personLabels',
  'personRelationships',
  'relationshipTypes',
  'tasks',
  'userPersons',
] as const;

/**
 * Junction tables carry no `user_id`; ownership flows through a parent row.
 * Each entry names the junction's foreign key and the user-owned parent it
 * points at, compiled to `fk IN (SELECT id FROM parent WHERE user_id = $1)`.
 */
const JUNCTION_PARENTS: Record<string, { fk: string; parent: AnyTable }> = {
  noteTags: { fk: 'noteId', parent: dbSchema.notes },
  noteMentions: { fk: 'noteId', parent: dbSchema.notes },
  interactionTags: { fk: 'interactionId', parent: dbSchema.interactions },
  importantDateTags: { fk: 'importantDateId', parent: dbSchema.importantDates },
};

const scopeByUserId: RowScope<Context> = (context, table) => eq((table as AnyTable).userId, requireAuth(context));

const scopeByParent =
  (fk: string, parent: AnyTable): RowScope<Context> =>
  (context, table) =>
    inArray(
      (table as AnyTable)[fk],
      context.db
        .select({ id: parent.id })
        .from(parent)
        .where(eq(parent.userId, requireAuth(context))),
    );

export const scope: NonNullable<BuildSchemaConfig['scope']> = {
  // A user row is only ever visible to its owner.
  users: (context, table) => eq((table as AnyTable).id, requireAuth(context as Context)),

  // persons rows are shared between users. A user sees the ones they have added
  // to their contacts, which is what user_persons records — expressed as a
  // relation filter so the library compiles it the same way it compiles a
  // client `where`.
  persons: (context) => ({ userPersons: { some: { userId: { eq: requireAuth(context as Context) } } } }),

  ...Object.fromEntries(USER_OWNED_TABLES.map((name) => [name, scopeByUserId])),
  ...Object.fromEntries(
    Object.entries(JUNCTION_PARENTS).map(([name, { fk, parent }]) => [name, scopeByParent(fk, parent)]),
  ),
};

/**
 * Columns the server owns: removed from every create and update input, stamped
 * from the request on insert. This is what makes `userId` unstatable rather
 * than merely overwritten, and it retires the nullable-userId patch the schema
 * used to apply to every generated input type.
 */
export const contextValues: NonNullable<BuildSchemaConfig['contextValues']> = Object.fromEntries(
  USER_OWNED_TABLES.map((name) => [name, { userId: (context: Context) => requireAuth(context) }]),
);

/** passwordHash must never cross the API — neither readable nor filterable. */
export const exclude: NonNullable<BuildSchemaConfig['exclude']> = {
  columns: { users: ['passwordHash'] },
};

/** User lifecycle belongs to the auth flow (magic links), not generated CRUD. */
export const features: NonNullable<BuildSchemaConfig['features']> = {
  insert: (table) => table !== 'users',
  update: (table) => table !== 'users',
  updateMany: (table) => table !== 'users',
  delete: (table) => table !== 'users',
  // The default, but stated. Nested writes bypass the child table's onWrite hooks.
  nestedWrites: false,
};
