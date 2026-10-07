import { bigint, boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { USER_DEFAULTS } from '../defaults.ts';

/** An account. better-auth owns the columns it names (auth.md); the rest of the schema hangs off `id`. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  /** Shown in the app. Sign-in without a name uses the email's local part. */
  name: text('name').notNull(),
  /** false until a magic link or provider has proved the address. */
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** The country a phone number written without a country code is read as: an ISO 3166-1 alpha-2 code. */
  defaultCountry: text('default_country').notNull().default(USER_DEFAULTS.country),
  /**
   * How many times the user's people have changed. Each change takes the next number, so a client that
   * remembers this one can ask for what changed after it.
   */
  personsRevision: bigint('persons_revision', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** A user row as read. */
export type User = typeof users.$inferSelect;
/** A user row as inserted. */
export type NewUser = typeof users.$inferInsert;
