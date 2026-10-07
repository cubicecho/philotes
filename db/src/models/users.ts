import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** An account. better-auth owns the columns it names (auth.md); the rest of the schema hangs off `id`. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  /** Shown in the app. Sign-in without a name uses the email's local part. */
  name: text('name').notNull(),
  /** false until a magic link or provider has proved the address. */
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
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
