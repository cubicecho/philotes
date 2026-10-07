import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiKeys } from '@cubicecho/philotes-db/api-keys';
import { relations } from '@cubicecho/philotes-db/relations';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { PGlite } from '@electric-sql/pglite';
import { pushSchema } from 'drizzle-kit/api-postgres';
import { drizzle } from 'drizzle-orm/pglite';
import { type ExecutionResult, type GraphQLError, graphql } from 'graphql';
import { expect } from 'vitest';
import type { ErrorCode } from '../core/errors.ts';
import { createSchema } from '../graphql/build-schema.ts';

/**
 * The test database. PGlite and postgres-js clients share the query API but not a type, so the
 * harness uses the same loose type the db package exports.
 */
// biome-ignore lint/suspicious/noExplicitAny: the two drivers have no common Drizzle type
export type TestDb = any;

/** What a test drives the schema through, as one user. */
export interface TestClient {
  /** Runs an operation and returns the raw result, errors included. */
  run: (source: string, variables?: Record<string, unknown>) => Promise<ExecutionResult>;
  /** Runs an operation that must succeed and returns its data. */
  expectOk: <T = Record<string, unknown>>(source: string, variables?: Record<string, unknown>) => Promise<T>;
  /** Runs an operation that must fail with the code and returns the error. */
  expectError: (code: ErrorCode, source: string, variables?: Record<string, unknown>) => Promise<GraphQLError>;
}

/**
 * Creates an empty in-memory database with the current tables. The tables come from the schema
 * files, not the migrations, so a test never waits on a migration being generated.
 *
 * @returns A Drizzle client over a database no other test shares.
 */
export async function createTestDb(): Promise<TestDb> {
  const db = drizzle({ client: new PGlite('memory://'), relations });
  const { apply } = await pushSchema({ ...dbSchema, apiKeys }, db);
  await apply();
  return db;
}

/**
 * Inserts a user.
 *
 * @param db - The test database.
 * @param email - The user's email, unique in the database.
 * @returns The new user's id.
 */
export async function createUser(db: TestDb, email: string): Promise<string> {
  const [user] = await db.insert(dbSchema.users).values({ email }).returning({ id: dbSchema.users.id });
  return user.id;
}

/**
 * Inserts a person and links it to a user.
 *
 * @param db - The test database.
 * @param userId - The user who gets the person in their list.
 * @param firstName - The person's first name. The last name is always "Test".
 * @returns The new person's id.
 */
export async function createPerson(db: TestDb, userId: string, firstName: string): Promise<string> {
  const [person] = await db
    .insert(dbSchema.persons)
    .values({ firstName, lastName: 'Test' })
    .returning({ id: dbSchema.persons.id });
  await db.insert(dbSchema.userPersons).values({ userId, personId: person.id });
  return person.id;
}

/**
 * Builds a client that runs operations against the real schema, as one user.
 *
 * @param db - The test database.
 * @param userId - The signed-in user, or null for an anonymous request.
 * @returns The client.
 */
export function createClient(db: TestDb, userId: string | null): TestClient {
  const { schema } = createSchema(db);
  const run: TestClient['run'] = (source, variableValues = {}) =>
    graphql({ schema, source, variableValues, contextValue: { db, userId } });

  return {
    run,
    expectOk: async <T>(source: string, variables?: Record<string, unknown>) => {
      const result = await run(source, variables);
      expect(result.errors).toBeUndefined();
      return result.data as T;
    },
    expectError: async (code, source, variables) => {
      const result = await run(source, variables);
      const [error] = result.errors ?? [];
      expect(error?.extensions.code).toBe(code);
      return error;
    },
  };
}

/**
 * Reads the port a listening server was given.
 *
 * @param server - A server listening on port 0.
 * @returns The port.
 */
export function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}
