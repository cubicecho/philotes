/** SQLSTATE for a unique or primary key violation. */
const PG_UNIQUE_VIOLATION = '23505';

/** The parts of a driver error this module reads. postgres-js and PGlite name the constraint differently. */
interface DriverError {
  code?: unknown;
  constraint_name?: unknown;
  constraint?: unknown;
  cause?: unknown;
  /** Where a GraphQLError keeps the error it wraps. */
  originalError?: unknown;
}

/**
 * Finds the unique constraint an error broke. Drizzle wraps the driver's error and drizzle-graphql wraps Drizzle's, so the chain is walked.
 *
 * @param error - Whatever was thrown.
 * @returns The constraint's name, an empty string when the driver gave none, or null when the error is not a unique violation.
 */
export function violatedUniqueConstraint(error: unknown): string | null {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    const { code, constraint_name: postgresName, constraint: pgliteName, cause, originalError }: DriverError = current;
    if (code === PG_UNIQUE_VIOLATION) {
      const name = postgresName ?? pgliteName;
      return typeof name === 'string' ? name : '';
    }
    current = cause ?? originalError;
  }
  return null;
}
