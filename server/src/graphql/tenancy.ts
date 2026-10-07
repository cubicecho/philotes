import type { BuildSchemaConfig, RowScope } from '@vantreeseba/drizzle-graphql';
import { eq } from 'drizzle-orm';
import type { Context } from '../core/context.ts';
import { requireAuth } from '../core/errors.ts';

/** Tables scoped to their owner. A table missing from this list is visible across tenants. */
export const USER_OWNED_TABLES = [
  'addresses',
  'contactInfos',
  'gratitudes',
  'importantDatePersons',
  'importantDateTags',
  'importantDates',
  'interactionTags',
  'interactions',
  'labels',
  'noteMentions',
  'noteTags',
  'notes',
  'personLabels',
  'personRelationships',
  'personTombstones',
  'persons',
  'relationshipTypes',
  'tasks',
] as const;

/**
 * Restricts a table to the caller's rows.
 *
 * @param context - Request context.
 * @param table - Table being queried.
 * @returns The `user_id = caller` condition.
 */
const scopeByUserId: RowScope<Context> = (context, table) => eq(table.userId, requireAuth(context));

/**
 * Restricts `users` to the caller's own row.
 *
 * @param context - Request context.
 * @param table - The users table.
 * @returns The `id = caller` condition.
 */
const scopeToSelf: RowScope<Context> = (context, table) => eq(table.id, requireAuth(context));

/** Row scope per table, ANDed into every generated read, update and delete after the client's own `where`. */
export const scope: NonNullable<BuildSchemaConfig['scope']> = {
  users: scopeToSelf,
  ...Object.fromEntries(USER_OWNED_TABLES.map((name) => [name, scopeByUserId])),
};

/** What a new contact detail's `normalizedValue` holds until the `after` hook has worked it out. */
export const UNNORMALIZED_VALUE = '';

/**
 * Leaves a column to the database on insert: its default, or the expression it is generated from.
 *
 * @returns Nothing, which the insert reads as "not given".
 */
const databaseOwned = (): undefined => undefined;

/**
 * Columns the server owns: removed from inputs and stamped on insert. `userId` comes from the request,
 * so ownership is never caller-stated. A person's `uid` is the id a phone knows the contact by, and
 * their display and sort names are generated from the name columns. A contact detail's
 * `normalizedValue` is derived from its value by the `after` hook in `persons/hooks.ts`.
 */
export const contextValues: NonNullable<BuildSchemaConfig['contextValues']> = {
  ...Object.fromEntries(USER_OWNED_TABLES.map((name) => [name, { userId: requireAuth }])),
  persons: {
    userId: requireAuth,
    uid: databaseOwned,
    displayName: databaseOwned,
    sortName: databaseOwned,
    revision: databaseOwned,
  },
  contactInfos: { userId: requireAuth, normalizedValue: () => UNNORMALIZED_VALUE },
};

/** better-auth's tables: sessions, credentials, one-time tokens and API key hashes. */
export const AUTH_TABLES = ['sessions', 'accounts', 'verifications', 'apikeys'] as const;

/** Auth tables never cross the API: not readable, not filterable, not reachable as a relation. */
export const exclude: NonNullable<BuildSchemaConfig['exclude']> = {
  tables: [...AUTH_TABLES],
  // What a phone sent that Philotes has no field for. Only the vCard codec reads or writes it.
  columns: { persons: ['vcardExtra'] },
};

/**
 * The tables the API only reads. User lifecycle belongs to the auth flow, and a tombstone is written by
 * the delete it records.
 */
export const READ_ONLY_TABLES: ReadonlySet<string> = new Set(['users', 'personTombstones']);

/**
 * Says whether a table takes generated writes.
 *
 * @param table - The table's schema key.
 * @returns False for a read-only table.
 */
const isWritable = (table: string): boolean => READ_ONLY_TABLES.has(table) === false;

/** Which generated operations exist, per table. */
export const features: NonNullable<BuildSchemaConfig['features']> = {
  insert: isWritable,
  update: isWritable,
  updateMany: isWritable,
  delete: isWritable,
  // Deleting a person takes everything recorded about them, so a delete or update of people names which.
  requireWhere: (table) => table === 'persons',
  // The default, but stated. Nested writes bypass the child table's onWrite hooks.
  nestedWrites: false,
};
