import type { DB } from '@philotes/db';
import { buildSchema } from '@vantreeseba/drizzle-graphql';
import type { GraphQLSchema } from 'graphql';
import { applyApiKeysExtension } from '../api-keys/resolvers.ts';
import { applyAuthExtension } from '../auth/resolvers.ts';
import { applyImportContactsExtension } from '../contact-import/resolvers.ts';
import { applyUpcomingDatesExtension } from '../important-dates/resolvers.ts';
import { applyMergeLabelsExtension } from '../labels/resolvers.ts';
import { applyUserScopeExtensions } from '../persons/resolvers.ts';
import { applyRelationshipsExtension } from '../relationships/resolvers.ts';
import { contextValues, exclude, features, scope } from './tenancy.ts';
import { onWrite } from './write-guards.ts';

/** What `createSchema` hands back. */
export interface BuiltSchema {
  schema: GraphQLSchema;
  /** drizzle-graphql's generated types and resolvers, for hand-built roots. */
  entities: ReturnType<typeof buildSchema>['entities'];
}

/** The hand-written extensions, in the order they are applied. */
const EXTENSIONS: Array<(schema: GraphQLSchema) => GraphQLSchema> = [
  applyAuthExtension,
  applyUserScopeExtensions,
  applyRelationshipsExtension,
  applyUpcomingDatesExtension,
  applyImportContactsExtension,
  applyMergeLabelsExtension,
  applyApiKeysExtension,
];

/**
 * Builds the served schema. Kept apart from schema.ts so tests can bind a throwaway db.
 *
 * @param db - Drizzle client.
 * @returns The schema and drizzle-graphql's generated entities.
 */
export function createSchema(db: DB): BuiltSchema {
  const { schema: generated, entities } = buildSchema(db, {
    prefixes: { insert: 'create', update: 'update', delete: 'delete' },
    // Table keys are plural (`tasks`). Types and single-row fields are singular (Task, task).
    typeNameMapper: 'singularize',
    // A RowScope per table, ANDed into every generated read, update and delete.
    scope,
    // Server-owned columns: removed from inputs and stamped from the context.
    contextValues,
    exclude,
    // Which generated writes exist, per table.
    features,
    // Before hooks per table, inside the mutation's transaction.
    onWrite,
  });

  const schema = EXTENSIONS.reduce((extended, applyExtension) => applyExtension(extended), generated);
  return { schema, entities };
}
