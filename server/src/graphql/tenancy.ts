import type { BuildSchemaConfig, RowScope } from '@vantreeseba/drizzle-graphql';
import { eq } from 'drizzle-orm';
import type { Context } from '../core/context.ts';
import { requireAuth } from '../core/errors.ts';

/** Tables scoped to their owner. A table missing from this list is visible across tenants. */
export const USER_OWNED_TABLES = [
  'addresses',
  'contactInfos',
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
  'relationshipTypes',
  'tasks',
  'userPersons',
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

/**
 * Restricts `persons` to the caller's contacts. A person row is shared between users, and
 * `user_persons` records who has added it.
 *
 * @param context - Request context.
 * @returns A relation filter, compiled the way a client `where` is.
 */
const scopeToContacts: RowScope<Context> = (context) => ({
  userPersons: { some: { userId: { eq: requireAuth(context) } } },
});

/** Row scope per table, ANDed into every generated read, update and delete after the client's own `where`. */
export const scope: NonNullable<BuildSchemaConfig['scope']> = {
  users: scopeToSelf,
  persons: scopeToContacts,
  ...Object.fromEntries(USER_OWNED_TABLES.map((name) => [name, scopeByUserId])),
};

/** Stamps `userId` from the request and removes it from inputs, so ownership is never caller-stated. */
export const contextValues: NonNullable<BuildSchemaConfig['contextValues']> = Object.fromEntries(
  USER_OWNED_TABLES.map((name) => [name, { userId: requireAuth }]),
);

/** better-auth's tables: sessions, credentials, one-time tokens and API key hashes. */
export const AUTH_TABLES = ['sessions', 'accounts', 'verifications', 'apikeys'] as const;

/** Auth tables never cross the API: not readable, not filterable, not reachable as a relation. */
export const exclude: NonNullable<BuildSchemaConfig['exclude']> = {
  tables: [...AUTH_TABLES],
};

/** User lifecycle belongs to the auth flow, not generated CRUD. */
export const features: NonNullable<BuildSchemaConfig['features']> = {
  insert: (table) => table !== 'users',
  update: (table) => table !== 'users',
  updateMany: (table) => table !== 'users',
  delete: (table) => table !== 'users',
  // The default, but stated. Nested writes bypass the child table's onWrite hooks.
  nestedWrites: false,
};
