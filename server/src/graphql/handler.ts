import type { Server } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import type { DB } from '@philotes/db';
import { db } from '@philotes/db';
import express, { Router } from 'express';
import { extractUserId } from '../auth/resolvers.ts';
import { schema } from './schema.ts';

export interface Context {
  db: DB;
  userId: string | null;
}

export async function createGraphQLRouter(httpServer: Server) {
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
