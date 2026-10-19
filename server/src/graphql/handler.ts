import type { DB } from '@cubicecho/philotes-db';
import type { Request } from 'express';
import { createYoga } from 'graphql-yoga';
import type { AuthHost } from '../auth/auth-host.ts';
import { sessionUserId } from '../auth/better-auth.ts';
import type { RateLimiter } from '../auth/rate-limit.ts';
import { isProduction } from '../core/config.ts';
import { type Context, UNKNOWN_IP } from '../core/context.ts';
import type { MailService } from '../mail/reader.ts';
import type { AvatarStore } from '../persons/avatar-store.ts';
import { createSchema } from './build-schema.ts';
import { graphqlLogger } from './logger.ts';
import { useOperationLimits } from './operation-limits.ts';

/** What the handler passes on to resolvers. */
interface GraphQLHandlerDeps {
  db: DB;
  /** Hands out the current auth instance. Pairing a provider rebuilds it while the server runs. */
  authHost: AuthHost;
  limiter: RateLimiter;
  /** Where avatar images are kept. Left out, resolvers leave pictures alone. */
  avatarStore?: AvatarStore;
  /** Mailbox access. Left out, connecting a mailbox is refused. */
  mail?: MailService;
}

/** What Express hands Yoga alongside the fetch request. */
interface ServerContext {
  req?: Request;
}

/**
 * Builds the Yoga handler for /graphql.
 *
 * @param deps - The database, the auth host, the sign-in rate limiter, the avatar store and mailbox access.
 * @returns The Yoga instance, callable as Express middleware.
 */
export function createGraphQLHandler({ db, authHost, limiter, avatarStore, mail }: GraphQLHandlerDeps) {
  const { schema } = createSchema(db);
  return createYoga<ServerContext, Context>({
    schema,
    graphqlEndpoint: '/graphql',
    graphiql: isProduction() === false,
    // Masked errors are logged here with their real cause.
    logging: graphqlLogger,
    plugins: [useOperationLimits()],
    context: async ({ request, req }): Promise<Context> => {
      // Asked per request: pairing a provider swaps the instance while the server runs.
      const auth = authHost.current();
      return {
        db,
        auth,
        authHost,
        limiter,
        // Express's view of the caller, which honours TRUST_PROXY.
        ip: req?.ip ?? UNKNOWN_IP,
        userId: await sessionUserId(auth, request.headers),
        headers: request.headers,
        avatarStore: avatarStore ?? null,
        mail: mail ?? null,
      };
    },
  });
}
