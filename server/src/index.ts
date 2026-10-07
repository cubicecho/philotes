import './core/preflight.ts';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, db } from '@cubicecho/philotes-db';
import { waitForDatabase } from '@cubicecho/philotes-db/wait';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createAuth } from './auth/better-auth.ts';
import { appUrl, avatarDir, dbConnectTimeoutMs, objectStorage, port, secureLocalNet } from './core/config.ts';
import { errorMessage } from './core/errors.ts';
import { createApp } from './http/app.ts';
import { stopOnSignals } from './http/shutdown.ts';
import { createDiskAvatarStore } from './persons/avatar-store.ts';
import { createS3AvatarStore } from './persons/avatar-store-s3.ts';

/** Postgres's port, shown when DATABASE_URL names none. */
const DEFAULT_POSTGRES_PORT = '5432';
/** Every interface. The container's port mapping decides who can reach it. */
const LISTEN_HOST = '0.0.0.0';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  await waitForDatabase(db, { connectTimeoutMs: dbConnectTimeoutMs() });
} catch (error) {
  const { hostname, port: urlPort } = new URL(process.env.DATABASE_URL ?? '');
  const dbPort = urlPort === '' ? DEFAULT_POSTGRES_PORT : urlPort;
  console.error(`[db] cannot reach Postgres at ${hostname}:${dbPort}: ${errorMessage(error)}`);
  console.error('[db] check DATABASE_URL in .env, and that `npm run db:up` has started it.');
  process.exit(1);
}

// At boot, so `docker compose up` on a fresh volume is the whole install.
await migrate(db, { migrationsFolder: join(__dirname, '../../db/drizzle') });

if (secureLocalNet()) {
  console.warn('[auth] SECURE_LOCAL_NET is on: any email signs in without a link. Private networks only.');
}

const storage = objectStorage();
const avatarStore = storage === null ? createDiskAvatarStore(avatarDir()) : createS3AvatarStore(storage);
try {
  // Makes the directory, or the bucket when it is missing, so a fresh install needs no setup step.
  await avatarStore.prepare();
} catch (error) {
  const place = storage === null ? avatarDir() : `bucket "${storage.bucket}" at ${storage.endpoint}`;
  console.error(`[avatars] cannot use ${place}: ${errorMessage(error)}`);
  process.exit(1);
}
console.log(storage === null ? `[avatars] kept in ${avatarDir()}` : `[avatars] kept in bucket "${storage.bucket}"`);

const app = createApp({
  db,
  auth: createAuth(db),
  avatarStore,
  staticDir: join(__dirname, '../../app/dist'),
});

const server = app.listen(port(), LISTEN_HOST, () => {
  console.log(`[server] ready at ${appUrl()}`);
});
stopOnSignals(server, { after: closeDatabase });
