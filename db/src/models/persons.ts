import { date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/** How often a user means to be in touch with a person. */
export const ContactFrequency = {
  Weekly: 'weekly',
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  Yearly: 'yearly',
} as const;
export type ContactFrequency = (typeof ContactFrequency)[keyof typeof ContactFrequency];

/** A person in one user's contacts. Two users who know the same person each hold their own row. */
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    contactFrequency: text('contact_frequency').$type<ContactFrequency>(),
    howWeMet: text('how_we_met'),
    firstMetDate: date('first_met_date'),
    /** The stored path of the person's picture, `/avatars/<file>`. null when there is none. */
    avatarPath: text('avatar_path'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_persons_user_id').on(t.userId),
    index('idx_persons_last_name_first_name').on(t.lastName, t.firstName),
  ],
);

/** A person row as read. */
export type Person = typeof persons.$inferSelect;
/** A person row as inserted. */
export type NewPerson = typeof persons.$inferInsert;
