const POSTGRES_SCHEMES = ['postgres://', 'postgresql://'] as const;

/**
 * Tells a Postgres server's URL from a PGlite location (a directory, `file:` path or `memory://`).
 *
 * @param databaseUrl - The value of `DATABASE_URL`.
 * @returns Whether the URL names a Postgres server.
 */
export function isPostgresUrl(databaseUrl: string): boolean {
  return POSTGRES_SCHEMES.some((scheme) => databaseUrl.startsWith(scheme));
}
