import './core/preflight.ts';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, db } from '@cubicecho/philotes-db';
import { waitForDatabase } from '@cubicecho/philotes-db/wait';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createAuthHost } from './auth/auth-host.ts';
import {
  appUrl,
  avatarDir,
  dbConnectTimeoutMs,
  mailCredentialKeys,
  objectStorage,
  oidcRedirectUri,
  port,
  secureLocalNet,
  serverUrl,
} from './core/config.ts';
import { errorMessage } from './core/errors.ts';
import { createApp } from './http/app.ts';
import { stopOnSignals } from './http/shutdown.ts';
import { parseKeyring, resealCredentials } from './mail/credential.ts';
import { createImapConnector } from './mail/imap-reader.ts';
import { createMailPoller } from './mail/poller.ts';
import type { MailService } from './mail/reader.ts';
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

// After migrate: the provider may be a pairing, which lives in the database.
const authHost = await createAuthHost(db);
const oidc = authHost.oidc();
if (oidc !== null) {
  // The redirect URI is the one thing the operator has to copy into the provider, exactly.
  console.log(`[auth] sign-in with ${oidc.name} (${oidc.issuer}); redirect URI ${oidcRedirectUri()}`);
}

// Preflight has already refused a malformed key, so this is a keyring or null.
const keyring = parseKeyring(mailCredentialKeys());
const mail: MailService | undefined = keyring === null ? undefined : { keyring, connect: createImapConnector() };
const poller = mail === undefined ? null : createMailPoller({ db, mail });
if (keyring === null) {
  console.log('[mail] MAIL_CREDENTIAL_KEYS is not set: mailboxes cannot be connected');
} else {
  const resealed = await resealCredentials(db, keyring);
  if (resealed > 0) {
    console.log(`[mail] re-sealed ${resealed} credentials under key ${keyring.current.id}`);
  }
}

const app = createApp({
  db,
  authHost,
  avatarStore,
  mail,
  staticDir: join(__dirname, '../../app/dist'),
});

const server = app.listen(port(), LISTEN_HOST, () => {
  console.log(`[server] ready at ${appUrl()}`);
  if (serverUrl() !== appUrl()) {
    console.log(`[server] browsers reach the API at ${serverUrl()}`);
  }
  poller?.start();
});
stopOnSignals(server, {
  // Stops taking mailboxes at once; the poll in flight is aborted and has finished before the pool closes.
  before: () => poller?.stop(),
  after: async () => {
    await poller?.stop();
    await closeDatabase();
  },
});
