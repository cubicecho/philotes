import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPostgresUrl } from './database-url.ts';
import { relations } from './relations.ts';
import * as schema from './schema.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Where the database is: a Postgres URL, or a PGlite location. Defaults to `pgdata` at the repo root. */
export const DATABASE_URL = process.env.DATABASE_URL ?? path.join(projectRoot, 'pgdata');
const isProduction = process.env.NODE_ENV === 'production';

const isPostgres = isPostgresUrl(DATABASE_URL);

// biome-ignore lint/suspicious/noExplicitAny: db type varies by driver at runtime; callers cast as needed
export type DB = any;
export let db!: DB;

// drizzle-orm 1.0 rc.4 dropped the constructor's separate `schema` argument:
// the relations config built by defineRelations carries the tables, and it is
// what drizzle-graphql reads to generate the schema. Both drivers must pass it.
if (isPostgres) {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 rc overload resolution
  const { drizzle } = (await import('drizzle-orm/postgres-js')) as any;
  const connection = isProduction ? { url: DATABASE_URL, ssl: 'require' } : DATABASE_URL;
  db = drizzle({ connection, relations });
} else {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 rc overload resolution
  const { drizzle } = (await import('drizzle-orm/pglite')) as any;
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = DATABASE_URL.startsWith('file:') ? DATABASE_URL.slice(5) : DATABASE_URL;
  const client = new PGlite(dataDir);
  await client.waitReady;
  db = drizzle({ client, relations });
}

export * from './api-keys.ts';
export { isPostgresUrl } from './database-url.ts';
export { runMigrations } from './run-migrations.ts';
export * from './schema.ts';
export { schema };
