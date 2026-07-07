import { db } from './index.ts';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const isPostgres = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

if (isPostgres) {
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  // biome-ignore lint/suspicious/noExplicitAny: union db type is compatible at runtime
  await migrate(db as any, { migrationsFolder: './drizzle/' });
} else {
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  // biome-ignore lint/suspicious/noExplicitAny: union db type is compatible at runtime
  await migrate(db as any, { migrationsFolder: './drizzle/' });
}

console.log('Migration complete.');
