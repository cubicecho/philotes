import type { DB } from '@philotes/db';
import cors from 'cors';
import express, { type Express } from 'express';
import { allowedOrigins, trustProxy } from '../core/config.ts';
import { HTTP_DEFAULTS } from '../core/defaults.ts';
import { HttpStatus } from '../core/wire.ts';
import { createGraphQLHandler } from '../graphql/handler.ts';
import { createIcalHandler } from '../important-dates/ical.ts';
import { createAvatarRouter } from '../persons/avatars.ts';
import { checkHealth } from './health.ts';
import { createStaticHandler } from './static.ts';

/** What the app talks to. Tests pass PGlite and a temporary avatar directory. */
export interface AppDeps {
  db: DB;
  /** Where uploaded avatars are stored and served from. Left out, the avatar routes are not mounted. */
  avatarDir?: string;
  /** The built app's directory. Left out in tests. */
  staticDir?: string;
}

/**
 * Builds the Express app: /graphql, /healthz, /ical, /avatars and the built app.
 *
 * @param deps - What the app talks to.
 * @returns The app, not listening.
 */
export function createApp({ db, avatarDir, staticDir }: AppDeps): Express {
  const app = express();
  // Which proxy hops may set X-Forwarded-For, and so what `req.ip` is.
  app.set('trust proxy', trustProxy());
  // The app is same-origin in production. The list only adds the dev app's origin.
  app.use(cors({ origin: allowedOrigins() }));
  const graphql = createGraphQLHandler({ db });

  // Yoga reads a body Express already parsed, so this is where the size cap goes. Over it: 413.
  app.use(graphql.graphqlEndpoint, express.json({ limit: HTTP_DEFAULTS.bodyLimit }));
  // `all`, not `use`: a mounted `use` strips the path, and Yoga matches graphqlEndpoint itself.
  app.all(graphql.graphqlEndpoint, (req, res) => graphql(req, res));
  // Before the static handler, whose fallback would answer 200 while the database is down.
  app.get('/healthz', async (_req, res) => {
    const health = await checkHealth(db);
    const status = health.ok ? HttpStatus.Ok : HttpStatus.ServiceUnavailable;
    res.status(status).json(health);
  });
  app.get('/ical', createIcalHandler(db));
  if (avatarDir !== undefined) {
    app.use('/avatars', express.static(avatarDir));
    app.use('/avatars', createAvatarRouter({ db, avatarDir }));
  }
  if (staticDir !== undefined) {
    app.use(createStaticHandler(staticDir));
  }
  return app;
}
