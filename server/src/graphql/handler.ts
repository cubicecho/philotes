import type { DB } from '@cubicecho/philotes-db';
import { createYoga } from 'graphql-yoga';
import { extractUserId } from '../auth/resolvers.ts';
import { isProduction } from '../core/config.ts';
import type { Context } from '../core/context.ts';
import { createSchema } from './build-schema.ts';
import { graphqlLogger } from './logger.ts';
import { useOperationLimits } from './operation-limits.ts';

/** What the handler passes on to resolvers. */
interface GraphQLHandlerDeps {
  db: DB;
}

/**
 * Builds the Yoga handler for /graphql.
 *
 * @param deps - The database.
 * @returns The Yoga instance, callable as Express middleware.
 */
export function createGraphQLHandler({ db }: GraphQLHandlerDeps) {
  const { schema } = createSchema(db);
  return createYoga<Record<string, unknown>, Context>({
    schema,
    graphqlEndpoint: '/graphql',
    graphiql: isProduction() === false,
    // Masked errors are logged here with their real cause.
    logging: graphqlLogger,
    plugins: [useOperationLimits()],
    context: ({ request }): Context => {
      const authorization = request.headers.get('authorization') ?? undefined;
      return { db, userId: extractUserId({ headers: { authorization } }) };
    },
  });
}
