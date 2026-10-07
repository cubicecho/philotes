import { isPostgresUrl } from './database-url.ts';

/**
 * Applies the migrations with the migrator that matches the database's driver. The PGlite
 * migrator cannot drive a postgres-js connection, so the choice follows the URL the connection
 * was opened with.
 *
 * @param db - The database from this package.
 * @param migrationsFolder - The directory holding the generated migrations.
 * @param databaseUrl - The URL the database was opened with.
 * @returns Nothing, once every migration is applied.
 */
// biome-ignore lint/suspicious/noExplicitAny: the db type varies by driver at runtime
export async function runMigrations(db: any, migrationsFolder: string, databaseUrl: string): Promise<void> {
  if (isPostgresUrl(databaseUrl)) {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    await migrate(db, { migrationsFolder });
    return;
  }

  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(db, { migrationsFolder });
}
