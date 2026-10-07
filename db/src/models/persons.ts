import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * A person. The row is shared between users: an email belongs to one row, and `user_persons` says whose
 * contacts the person is in.
 */
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_persons_last_name_first_name').on(t.lastName, t.firstName),
    uniqueIndex('uq_persons_email').on(t.email),
  ],
);

/** A person row as read. */
export type Person = typeof persons.$inferSelect;
/** A person row as inserted. */
export type NewPerson = typeof persons.$inferInsert;
