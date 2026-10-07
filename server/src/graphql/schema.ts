import { db as dbInstance } from '@philotes/db';
import { buildSchema } from '@vantreeseba/drizzle-graphql';
import { applyApiKeysExtension } from '../api-keys/resolvers.ts';
import { applyAuthExtension } from '../auth/resolvers.ts';
import { applyImportContactsExtension } from '../contact-import/resolvers.ts';
import { applyUpcomingDatesExtension } from '../important-dates/resolvers.ts';
import { applyMergeLabelsExtension } from '../labels/resolvers.ts';
import { applyUserScopeExtensions } from '../persons/resolvers.ts';
import { applyRelationshipsExtension } from '../relationships/resolvers.ts';
import { contextValues, exclude, features, scope } from './tenancy.ts';
import { onWrite } from './write-guards.ts';

const { schema: drizzleSchema, entities } = buildSchema(dbInstance, {
  prefixes: {
    insert: 'create',
    update: 'update',
    delete: 'delete',
  },
  // Table keys are plural (e.g. `tasks`); derive singular names for type and
  // single-row field naming (Task, task, createTask).
  typeNameMapper: 'singularize',
  // Multi-tenancy lives in the generated SQL rather than in resolver wrappers.
  scope,
  contextValues,
  exclude,
  features,
  onWrite,
});

let schema = applyAuthExtension(drizzleSchema);
schema = applyUserScopeExtensions(schema);
schema = applyRelationshipsExtension(schema);
schema = applyUpcomingDatesExtension(schema);
schema = applyImportContactsExtension(schema);
schema = applyMergeLabelsExtension(schema);
schema = applyApiKeysExtension(schema);

export { entities, schema };
