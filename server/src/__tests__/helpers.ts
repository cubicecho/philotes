import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASE_URL, db, schema as dbSchema, runMigrations } from '@philotes/db';
import { type ExecutionResult, graphql } from 'graphql';
import { schema } from '../graphql/schema.ts';

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../../db/drizzle');

/**
 * Applies the migrations to this test file's database. vitest.config.ts points `DATABASE_URL` at
 * an in-memory PGlite, and each test file loads its own copy of the db package.
 *
 * @returns Nothing, once the tables exist.
 */
export async function migrateTestDatabase(): Promise<void> {
  await runMigrations(db, MIGRATIONS_FOLDER, DATABASE_URL);
}

/**
 * Inserts a user.
 *
 * @param email - The user's email, unique in the database.
 * @returns The new user's id.
 */
export async function createUser(email: string): Promise<string> {
  const [user] = await db.insert(dbSchema.users).values({ email }).returning({ id: dbSchema.users.id });
  return user.id;
}

/**
 * Inserts a person and links it to a user.
 *
 * @param userId - The user who gets the person in their list.
 * @param firstName - The person's first name. The last name is always "Test".
 * @returns The new person's id.
 */
export async function createPerson(userId: string, firstName: string): Promise<string> {
  const [person] = await db
    .insert(dbSchema.persons)
    .values({ firstName, lastName: 'Test' })
    .returning({ id: dbSchema.persons.id });
  await db.insert(dbSchema.userPersons).values({ userId, personId: person.id });
  return person.id;
}

/**
 * Runs one GraphQL operation against the real schema, as a user.
 *
 * @param userId - The signed-in user, or null for an anonymous request.
 * @param source - The operation text.
 * @param variableValues - The operation's variables.
 * @returns The execution result, errors included.
 */
export function run(
  userId: string | null,
  source: string,
  variableValues: Record<string, unknown> = {},
): Promise<ExecutionResult> {
  return graphql({ schema, source, variableValues, contextValue: { db, userId } });
}
