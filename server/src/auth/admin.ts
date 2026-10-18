import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { and, eq, sql } from 'drizzle-orm';

// Who runs the instance. One thing only needs it so far: changing how people
// sign in (sso/resolvers.ts). Whoever sets an instance up is its first account,
// so that account becomes the admin, and nobody is asked to edit a database row.

/**
 * Whether a user is an admin.
 *
 * @param db - The database.
 * @param userId - The user.
 * @returns Their flag; false for a user that does not exist.
 */
export async function isAdmin(db: DB, userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: dbSchema.users.isAdmin })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId));
  return user?.isAdmin === true;
}

/**
 * Makes a new account the admin when the instance has none.
 *
 * @param db - The database.
 * @param userId - The account just created.
 *
 * @remarks
 * One statement, so two first sign-ins at once cannot both claim it.
 */
export async function claimFirstAdmin(db: DB, userId: string): Promise<void> {
  await db
    .update(dbSchema.users)
    .set({ isAdmin: true })
    .where(and(eq(dbSchema.users.id, userId), sql`NOT EXISTS (SELECT 1 FROM users WHERE is_admin)`));
}

/**
 * Whether anyone has an account yet.
 *
 * @param db - The database.
 * @returns True once the first account exists.
 */
export async function hasUsers(db: DB): Promise<boolean> {
  const [row] = await db.select({ id: dbSchema.users.id }).from(dbSchema.users).limit(1);
  return row !== undefined;
}
