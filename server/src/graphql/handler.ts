import type { Server } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import type { DB } from '@philotes/db';
import express, { Router } from 'express';
import { extractUserId } from '../auth/resolvers.ts';
import type { Context } from '../core/context.ts';
import { createSchema } from './build-schema.ts';

/**
 * Builds the `/graphql` router over one database.
 *
 * @param httpServer - The server to drain at shutdown.
 * @param db - Drizzle client.
 * @returns The router, to mount at `/graphql`.
 */
export async function createGraphQLRouter(httpServer: Server, db: DB) {
  const { schema } = createSchema(db);
  const apolloServer = new ApolloServer<Context>({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await apolloServer.start();

  const router = Router();

  router.use(
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ db, userId: extractUserId(req) }),
    }),
  );

  return router;
}
