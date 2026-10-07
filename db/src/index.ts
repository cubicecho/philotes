import { DATABASE_DEFAULTS } from './defaults.ts';
import { relations } from './relations.ts';
import * as schema from './schema.ts';
import { requiresSsl } from './ssl.ts';

const url = process.env.DATABASE_URL ?? '';
if (url === '') {
  throw new Error(
    'DATABASE_URL is not set. Set it in .env, for example postgres://philotes:philotes@localhost:5439/philotes.',
  );
}

const isProduction = process.env.NODE_ENV === 'production';
const mustForceSsl = isProduction && requiresSsl(url);
const { drizzle } = await import('drizzle-orm/postgres-js');

/** The app's Drizzle client. Doesn't connect until the first query. */
export const db = drizzle({
  connection: {
    url,
    ...(mustForceSsl ? { ssl: 'require' as const } : {}),
    // Idempotent migrations emit a NOTICE on every boot.
    onnotice: () => {},
  },
  relations,
});
export type DB = typeof db;

/**
 * Closes the pool at shutdown, after the server has drained.
 *
 * @returns Resolves once every connection is closed. Queries still running are cancelled after `closeTimeoutSeconds`.
 */
export const closeDatabase = (): Promise<void> => db.$client.end({ timeout: DATABASE_DEFAULTS.closeTimeoutSeconds });

export * from './schema.ts';
export { relations, schema };
