import type { DB } from '@cubicecho/philotes-db';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Auth } from '../auth/better-auth.ts';
import { createRateLimiter, type RateLimiter } from '../auth/rate-limit.ts';
import { DavPath } from '../carddav/dav.ts';
import { createCardDavRouter } from '../carddav/router.ts';
import { allowedOrigins, trustProxy } from '../core/config.ts';
import { HTTP_DEFAULTS } from '../core/defaults.ts';
import { HttpStatus } from '../core/wire.ts';
import { createGraphQLHandler } from '../graphql/handler.ts';
import { createIcalHandler } from '../important-dates/ical.ts';
import type { AvatarStore } from '../persons/avatar-store.ts';
import { createAvatarRouter } from '../persons/avatars.ts';
import { checkHealth } from './health.ts';
import { createStaticHandler } from './static.ts';

/** What the app talks to. Tests pass PGlite and leave the avatar store out. */
export interface AppDeps {
  db: DB;
  auth: Auth;
  /**
   * Throttles sign-in attempts.
   *
   * @defaultValue `createRateLimiter()`
   */
  limiter?: RateLimiter;
  /**
   * Where uploaded avatars are stored and served from. Left out, the avatar routes are not mounted and
   * the address book serves cards without pictures.
   */
  avatarStore?: AvatarStore;
  /** The built app's directory. Left out in tests. */
  staticDir?: string;
}

/**
 * Builds the Express app: /dav, /graphql, /healthz, /ical, /avatars and the built app.
 *
 * @param deps - What the app talks to.
 * @returns The app, not listening.
 */
export function createApp({ db, auth, limiter = createRateLimiter(), avatarStore, staticDir }: AppDeps): Express {
  const app = express();
  // Which proxy hops may set X-Forwarded-For, and so what `req.ip` is.
  app.set('trust proxy', trustProxy());
  // Before CORS, which answers every OPTIONS itself: a contacts client reads what the server can do from
  // that answer, and is not a browser.
  app.all(DavPath.WellKnown, (_req, res) => res.redirect(HttpStatus.MovedPermanently, DavPath.Root));
  app.use(DavPath.Mount, createCardDavRouter({ db, auth, avatarStore: avatarStore ?? null }));
  // The app is same-origin in production. The list only adds the dev app's origin.
  app.use(cors({ origin: allowedOrigins() }));
  const graphql = createGraphQLHandler({ db, auth, limiter, avatarStore });

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
  app.get('/ical', createIcalHandler({ db, auth }));
  if (avatarStore !== undefined) {
    app.use('/avatars', createAvatarRouter({ db, auth, store: avatarStore }));
  }
  if (staticDir !== undefined) {
    app.use(createStaticHandler(staticDir));
  }
  return app;
}
