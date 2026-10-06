import { db as dbInstance } from '@philotes/db';
import { buildSchema } from '@vantreeseba/drizzle-graphql';
import { applyApiKeysExtension } from './resolvers/api-keys.ts';
import { applyAuthExtension } from './resolvers/auth.ts';
import { applyImportContactsExtension } from './resolvers/import-contacts.ts';
import { onWrite } from './resolvers/junction-ownership.ts';
import { applyMergeLabelsExtension } from './resolvers/merge-labels.ts';
import { applyRelationshipsExtension } from './resolvers/relationships.ts';
import { applyUpcomingDatesExtension } from './resolvers/upcoming-dates.ts';
import { applyUserScopeExtensions } from './resolvers/user-scope.ts';
import { contextValues, exclude, features, scope } from './tenancy.ts';

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
