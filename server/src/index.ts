import './core/preflight.ts';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASE_URL, db, runMigrations } from '@philotes/db';
import { appUrl, port } from './core/config.ts';
import { createApp } from './http/app.ts';
import { stopOnSignals } from './http/shutdown.ts';

/** Every interface. The container's port mapping decides who can reach it. */
const LISTEN_HOST = '0.0.0.0';

const __dirname = dirname(fileURLToPath(import.meta.url));

// At boot, so starting on a fresh volume is the whole install.
await runMigrations(db, join(__dirname, '../../db/drizzle'), DATABASE_URL);

const app = createApp({
  db,
  avatarDir: join(__dirname, '../../avatars'),
  staticDir: join(__dirname, '../../app/dist'),
});

const server = app.listen(port(), LISTEN_HOST, () => {
  console.log(`[server] ready at ${appUrl()}`);
});
stopOnSignals(server);
