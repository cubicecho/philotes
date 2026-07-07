import { db as dbInstance, schema as dbSchema } from '@philotes/db';
import { buildSchema } from '@vantreeseba/drizzle-graphql';

// drizzle-orm 1.0 beta no longer stores fullSchema on the instance; inject it
// so the drizzle-graphql fork (which reads db._.fullSchema) still works.
if (!dbInstance._.fullSchema) {
  // biome-ignore lint/suspicious/noExplicitAny: compatibility shim for drizzle-orm 1.0 beta
  (dbInstance._ as any).fullSchema = dbSchema;
}

import { GraphQLInputObjectType, GraphQLNonNull, type GraphQLNullableType, type GraphQLSchema } from 'graphql';
import { applyApiKeysExtension } from './resolvers/api-keys.ts';
import { applyAuthExtension } from './resolvers/auth.ts';
import { applyDeduplicateExtension } from './resolvers/deduplicate.ts';
import { applyImportantDatePersonsExtension } from './resolvers/important-date-persons.ts';
import { applyImportContactsExtension } from './resolvers/import-contacts.ts';
import { applyMergeLabelsExtension } from './resolvers/merge-labels.ts';
import { applyNullListCoercion } from './resolvers/null-lists.ts';
import { applyRelationshipsExtension } from './resolvers/relationships.ts';
import { applyScalarResolvers } from './resolvers/scalars.ts';
import { applyUpcomingDatesExtension } from './resolvers/upcoming-dates.ts';
import { applyUserScopeExtensions } from './resolvers/user-scope.ts';

const { schema: drizzleSchema, entities } = buildSchema(dbInstance, {
  singularTypes: true,
  prefixes: {
    insert: 'create',
    update: 'update',
    delete: 'delete',
  },
  suffixes: {
    list: 's',
    single: '',
  },
});

function makeUserIdOptionalInInputs(s: GraphQLSchema): GraphQLSchema {
  for (const type of Object.values(s.getTypeMap())) {
    if (!(type instanceof GraphQLInputObjectType)) continue;
    const fields = type.getFields();
    if ('userId' in fields && fields.userId.type instanceof GraphQLNonNull) {
      (fields.userId as { type: unknown }).type = (fields.userId.type as GraphQLNonNull<GraphQLNullableType>).ofType;
    }
  }
  return s;
}

// let schema = drizzleSchema;
let schema = applyAuthExtension(drizzleSchema);
schema = makeUserIdOptionalInInputs(schema);
schema = applyUserScopeExtensions(schema);
schema = applyRelationshipsExtension(schema);
schema = applyUpcomingDatesExtension(schema);
schema = applyScalarResolvers(schema);
schema = applyNullListCoercion(schema);
schema = applyImportContactsExtension(schema);
schema = applyMergeLabelsExtension(schema);
schema = applyDeduplicateExtension(schema);
schema = applyImportantDatePersonsExtension(schema);
schema = applyApiKeysExtension(schema);

export { schema, entities };
