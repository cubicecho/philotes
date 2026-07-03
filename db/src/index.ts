import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relations } from './relations.ts';
import * as schema from './schema.ts';

// realpathSync resolves the node_modules/@philotes/db symlink back to db/,
// so the default pgdata path stays at the repo root even when Node runs
// with --preserve-symlinks (otherwise it lands in node_modules/@philotes/).
const __dirname = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot = path.resolve(__dirname, '../..');

const DATABASE_URL = process.env.DATABASE_URL ?? path.join(projectRoot, 'pgdata');
const isProduction = process.env.NODE_ENV === 'production';

const isPostgres = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

// biome-ignore lint/suspicious/noExplicitAny: db type varies by driver at runtime; callers cast as needed
export type DB = any;
export let db!: DB;

if (isPostgres) {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 beta overload resolution
  const { drizzle } = (await import('drizzle-orm/postgres-js')) as any;
  const connection = isProduction ? { url: DATABASE_URL, ssl: 'require' } : DATABASE_URL;
  db = drizzle({ connection, schema });
} else {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 beta overload resolution
  const { drizzle } = (await import('drizzle-orm/pglite')) as any;
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = DATABASE_URL.startsWith('file:') ? DATABASE_URL.slice(5) : DATABASE_URL;
  const client = new PGlite(dataDir);
  await client.waitReady;
  db = drizzle({ client, schema, relations });
}

export { schema };
export * from './api-keys.ts';
export * from './schema.ts';
