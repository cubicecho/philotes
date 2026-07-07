import type { Server } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import type { DB } from '@philotes/db';
import { db } from '@philotes/db';
import type DataLoader from 'dataloader';
import type { Request } from 'express';
import express, { Router } from 'express';
import { verifyToken } from '../resolvers/auth.ts';
import { schema } from '../schema.ts';

export interface Context {
  db: DB;
  userId: string | null;
  /**
   * Per-request cache of DataLoaders that batch Person nested-relation reads
   * (interactions, notes, …) so a list of N persons costs one query per
   * relation instead of N. Populated lazily by the field resolvers.
   */
  relationLoaders?: Map<string, DataLoader<string, unknown[]>>;
}

function extractUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  return payload?.userId ?? null;
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
