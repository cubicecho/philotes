import type { DB } from '@cubicecho/philotes-db';
import { buildSchema, type OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { GraphQLDateTime } from 'graphql-scalars';
import { applyApiKeysExtension } from '../api-keys/resolvers.ts';
import { applyAuthExtension } from '../auth/resolvers.ts';
import { applyImportContactsExtension } from '../contact-import/resolvers.ts';
import { OPERATION_LIMIT_DEFAULTS } from '../core/defaults.ts';
import { gratitudeWriteHooks } from '../gratitudes/hooks.ts';
import { importantDateWriteHooks } from '../important-dates/hooks.ts';
import { applyUpcomingDatesExtension } from '../important-dates/resolvers.ts';
import { interactionWriteHooks } from '../interactions/hooks.ts';
import { labelWriteHooks } from '../labels/hooks.ts';
import { applyMergeLabelsExtension } from '../labels/resolvers.ts';
import { noteWriteHooks } from '../notes/hooks.ts';
import { applyDuplicatesExtension } from '../persons/duplicates.ts';
import { personWriteHooks } from '../persons/hooks.ts';
import { relationshipWriteHooks } from '../relationships/hooks.ts';
import { applyRelationshipsExtension } from '../relationships/resolvers.ts';
import { taskWriteHooks } from '../tasks/hooks.ts';
import { contextValues, exclude, features, scope } from './tenancy.ts';
import { mapWriteError } from './write-guards.ts';

/** Drizzle's name for a Postgres timestamp column. */
const TIMESTAMP_COLUMN = 'PgTimestamp';

/** Every table's write hooks. A table missing here takes generated writes unchecked. */
export const WRITE_HOOKS: OnWriteConfig = {
  ...personWriteHooks,
  ...noteWriteHooks,
  ...gratitudeWriteHooks,
  ...interactionWriteHooks,
  ...taskWriteHooks,
  ...importantDateWriteHooks,
  ...labelWriteHooks,
  ...relationshipWriteHooks,
};

/** The hand-written extensions, in the order they are applied. */
const EXTENSIONS: Array<(schema: GraphQLSchema) => GraphQLSchema> = [
  applyAuthExtension,
  applyRelationshipsExtension,
  applyUpcomingDatesExtension,
  applyImportContactsExtension,
  applyMergeLabelsExtension,
  applyDuplicatesExtension,
  applyApiKeysExtension,
];

/**
 * Builds the served schema. Kept apart from schema.ts so tests can bind a throwaway db.
 *
 * @param db - Drizzle client.
 * @returns The schema and drizzle-graphql's generated entities, typed by inference from the tables.
 */
export function createSchema(db: DB) {
  const { schema: generated, entities } = buildSchema(db, {
    prefixes: { insert: 'create', update: 'update', delete: 'delete' },
    // Table keys are plural (`tasks`). Types and single-row fields are singular (Task, task).
    typeNameMapper: 'singularize',
    // A RowScope per table, ANDed into every generated read, update and delete.
    scope,
    // Server-owned columns: removed from inputs and stamped from the context.
    contextValues,
    exclude,
    // Which generated writes exist, per table. Nested writes are off.
    features,
    // Before hooks per table, inside the mutation's transaction. Each domain folder exports its own.
    onWrite: WRITE_HOOKS,
    // A repeated unique value is the caller's to fix. Every other database error stays masked.
    onError: mapWriteError,
    // Every list, root or relation, gets a page size.
    limits: {
      defaultLimit: OPERATION_LIMIT_DEFAULTS.defaultPageSize,
      maxLimit: OPERATION_LIMIT_DEFAULTS.maxPageSize,
    },
    // Publishes each field's cost for useOperationLimits. On by default, and stated so nobody turns it off.
    complexity: true,
    // Without this, a null timestamp input parses as the epoch.
    mapColumnType: (column) => (column.columnType === TIMESTAMP_COLUMN ? { input: GraphQLDateTime } : undefined),
  });

  const withRoot = withMutationRoot(generated);
  const schema = EXTENSIONS.reduce((extended, applyExtension) => applyExtension(extended), withRoot);
  return { schema, entities };
}

/**
 * Adds an empty Mutation root when every generated write is off, so `extend type Mutation` has a target.
 *
 * @param schema - Generated schema.
 * @returns The schema, with a Mutation root.
 */
function withMutationRoot(schema: GraphQLSchema): GraphQLSchema {
  const mutationRoot = schema.getMutationType() ?? null;
  if (mutationRoot !== null) {
    return schema;
  }
  const emptyRoot = new GraphQLObjectType({ name: 'Mutation', fields: {} });
  return new GraphQLSchema({ ...schema.toConfig(), mutation: emptyRoot });
}
