import type { DB } from '@cubicecho/philotes-db';
import type { Request } from 'express';
import { createYoga } from 'graphql-yoga';
import { type Auth, sessionUserId } from '../auth/better-auth.ts';
import type { RateLimiter } from '../auth/rate-limit.ts';
import { isProduction } from '../core/config.ts';
import { type Context, UNKNOWN_IP } from '../core/context.ts';
import { createSchema } from './build-schema.ts';
import { graphqlLogger } from './logger.ts';
import { useOperationLimits } from './operation-limits.ts';

/** What the handler passes on to resolvers. */
interface GraphQLHandlerDeps {
  db: DB;
  auth: Auth;
  limiter: RateLimiter;
}

/** What Express hands Yoga alongside the fetch request. */
interface ServerContext {
  req?: Request;
}

/**
 * Builds the Yoga handler for /graphql.
 *
 * @param deps - The database, the auth instance and the sign-in rate limiter.
 * @returns The Yoga instance, callable as Express middleware.
 */
export function createGraphQLHandler({ db, auth, limiter }: GraphQLHandlerDeps) {
  const { schema } = createSchema(db);
  return createYoga<ServerContext, Context>({
    schema,
    graphqlEndpoint: '/graphql',
    graphiql: isProduction() === false,
    // Masked errors are logged here with their real cause.
    logging: graphqlLogger,
    plugins: [useOperationLimits()],
    context: async ({ request, req }): Promise<Context> => ({
      db,
      auth,
      limiter,
      // Express's view of the caller, which honours TRUST_PROXY.
      ip: req?.ip ?? UNKNOWN_IP,
      userId: await sessionUserId(auth, request.headers),
      headers: request.headers,
    }),
  });
}
